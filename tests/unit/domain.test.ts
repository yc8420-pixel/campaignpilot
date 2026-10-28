import { describe, it, expect } from "vitest";
import { makeSeed } from "../../src/domain/seed";
import {
  transition,
  checkCopy,
  applyGenerated,
  csvCell,
  validateStrategy,
  experimentWorkspace,
} from "../../src/domain/logic";
import {
  latest,
  inputVersion,
  BriefSchema,
  BrandSchema,
} from "../../src/domain/types";
import {
  previewCsv,
  goldenCsv,
  metrics,
  parseMoney,
  metricHash,
} from "../../src/domain/analytics";
async function delivered() {
  let s = makeSeed();
  for (const id of ["xhs-a", "xhs-b"])
    s = (
      await transition(s, {
        type: "review",
        id,
        versionId: latest(s.variants.find((v) => v.id === id)!).id,
        decision: "approved",
        note: "人工核对通过",
      })
    ).workspace;
  return (
    await transition(s, {
      type: "export",
      ids: ["xhs-a", "xhs-b"],
      format: "markdown",
    })
  ).workspace;
}
describe("facts and brief contracts", () => {
  it("rejects bad date, reversed range, negative money and duplicate channels", () => {
    const s = makeSeed();
    for (const change of [
      { start: "2026-02-31" },
      { end: "2026-09-01" },
      { budgetCents: -1 },
      { channels: ["douyin", "douyin"] },
    ])
      expect(BriefSchema.safeParse({ ...s.brief, ...change }).success).toBe(
        false,
      );
  });
  it("rejects duplicate fact IDs", () => {
    const s = makeSeed();
    s.brand.facts.push(s.brand.facts[0]);
    expect(BrandSchema.safeParse(s.brand).success).toBe(false);
  });
  it("rejects over-budget strategies and invalid citations", () => {
    const s = makeSeed();
    const data = structuredClone(s.strategy!.data);
    data.budget[0].cents = 999999;
    expect(() => validateStrategy(data, s)).toThrow("预算");
    data.budget[0].cents = 100;
    data.angles[0].factIds = ["foreign"];
    expect(() => validateStrategy(data, s)).toThrow("引用");
  });
});
describe("review and immutable delivery", () => {
  it("seed copies pass blocking checks and scripts have continuous timeline", () => {
    const s = makeSeed();
    for (const v of s.variants)
      expect(
        checkCopy(latest(v).copy, s, v.channel, latest(v).input).filter(
          (r) => r.level === "block",
        ),
      ).toEqual([]);
  });
  it("blocks fabricated waterproof, wrong price and cross-brand citation", () => {
    const s = makeSeed(),
      c = structuredClone(latest(s.variants[0]).copy);
    c.body += " 百分百防水，活动价199元";
    c.claims.push({ text: "认证", factIds: ["OTHER"] });
    expect(
      checkCopy(c, s, "xiaohongshu", inputVersion(s)).map((x) => x.code),
    ).toEqual(
      expect.arrayContaining([
        "FORBIDDEN",
        "UNSUPPORTED",
        "PRICE",
        "REFERENCE",
      ]),
    );
  });
  it("editing approved content creates a new unapproved version and preserves history", async () => {
    let s = makeSeed();
    s = (
      await transition(s, {
        type: "review",
        id: "xhs-a",
        versionId: latest(s.variants[0]).id,
        decision: "approved",
        note: "核对",
      })
    ).workspace;
    const before = latest(s.variants[0]);
    s = (
      await transition(s, {
        type: "edit_content",
        id: "xhs-a",
        versionId: before.id,
        copy: { ...before.copy, title: "今天的通勤清单" },
      })
    ).workspace;
    expect(s.variants[0].versions[0].status).toBe("approved");
    expect(latest(s.variants[0]).status).toBe("draft");
    await expect(
      transition(s, { type: "export", ids: ["xhs-a"], format: "markdown" }),
    ).rejects.toThrow("审核");
  });
  it("rejects stale edits and stale facts; source snapshots remain unchanged", async () => {
    let s = makeSeed();
    const original = structuredClone(latest(s.variants[0]).brandSnapshot);
    await expect(
      transition(s, {
        type: "edit_content",
        id: "xhs-a",
        versionId: "stale",
        copy: latest(s.variants[0]).copy,
      }),
    ).rejects.toThrow("修改");
    s = (
      await transition(s, {
        type: "save_brand",
        brand: { ...s.brand, name: "新品牌" },
      })
    ).workspace;
    expect(
      checkCopy(
        latest(s.variants[0]).copy,
        s,
        "xiaohongshu",
        latest(s.variants[0]).input,
      ).some((r) => r.code === "STALE"),
    ).toBe(true);
    expect(latest(s.variants[0]).brandSnapshot).toEqual(original);
  });
  it("locks delivery and forks a distinct experiment", async () => {
    let s = await delivered();
    expect(s.variants[0].deliveredVersionId).toBe(latest(s.variants[0]).id);
    await expect(
      transition(s, {
        type: "edit_content",
        id: "xhs-a",
        versionId: latest(s.variants[0]).id,
        copy: latest(s.variants[0]).copy,
      }),
    ).rejects.toThrow("复制");
    s = (await transition(s, { type: "fork_variant", id: "xhs-a" })).workspace;
    expect(s.variants.at(-1)!.id).not.toBe("xhs-a");
    expect(latest(s.variants.at(-1)!).status).toBe("draft");
    expect(s.variants.at(-1)!.deliveredVersionId).toBeNull();
  });
  it("rejects anonymous fixture substitution in live workspace", async () => {
    const s = makeSeed("live");
    await expect(transition(s, { type: "fixture_strategy" })).rejects.toThrow(
      "真实模式",
    );
  });
  it("does not label an old fixture as generated for changed inputs", async () => {
    let s = makeSeed();
    s = (
      await transition(s, {
        type: "save_brand",
        brand: { ...s.brand, name: "改变品牌" },
      })
    ).workspace;
    await expect(transition(s, { type: "fixture_strategy" })).rejects.toThrow(
      "输入已改变",
    );
  });
  it("formal export contains exact versions and formula text is neutralized", async () => {
    const s = await delivered();
    const res = await transition(s, {
      type: "export",
      ids: ["xhs-a", "xhs-b"],
      format: "csv",
    });
    expect(res.download!.content).toContain("content_version_id");
    expect(res.download!.content).toContain(latest(s.variants[0]).id);
    for (const cell of [
      "=SUM(A1)",
      "+CMD",
      "-CMD",
      "@CMD",
      "\t=1",
      "\r=1",
      "   =1",
    ])
      expect(csvCell(cell).startsWith("'")).toBe(true);
    expect(csvCell("普通文案")).toBe("普通文案");
  });
});
describe("CSV atomic import and deterministic analytics", () => {
  it("parses exact decimal money and rejects missing, negative and scientific notation", () => {
    expect(parseMoney("600.01")).toBe(60001);
    for (const bad of ["", "-1", "1e3", "3.141", "NaN"])
      expect(() => parseMoney(bad)).toThrow();
  });
  it("computes the golden answer using weighted totals", async () => {
    const s = await delivered(),
      p = await previewCsv(goldenCsv(s), s);
    expect(p.errors).toEqual([]);
    const m = metrics(p.rows);
    expect(m).toMatchObject({
      impressions: 30000,
      clicks: 700,
      orders: 20,
      spend: 140000,
      revenue: 538000,
      cpc: 2,
      cpa: 70,
    });
    expect(m.ctr).toBeCloseTo(700 / 30000, 12);
    expect(m.cvr).toBeCloseTo(20 / 700, 12);
    expect(m.roas).toBeCloseTo(5380 / 1400, 12);
  });
  it("returns null for zero denominator and zero only for valid zero numerator", async () => {
    const s = await delivered(),
      p = await previewCsv(goldenCsv(s), s);
    expect(metrics([])).toMatchObject({
      ctr: null,
      cvr: null,
      cpc: null,
      cpa: null,
      roas: null,
    });
    expect(
      metrics([{ ...p.rows[0], clicks: 0, orders: 0, revenue: 0 }]),
    ).toMatchObject({ ctr: 0, cvr: null, cpc: null, cpa: null, roas: 0 });
  });
  it("rejects unexported or foreign variants", async () => {
    const s = makeSeed(),
      p = await previewCsv(goldenCsv(s), s);
    expect(p.errors.every((e) => e.column === "variant_id")).toBe(true);
  });
  it("same file is idempotent; reordered overlapping file is rejected", async () => {
    let s = await delivered();
    const csv = goldenCsv(s);
    s = (
      await transition(s, {
        type: "import",
        text: csv,
        name: "a.csv",
        warningsAccepted: false,
      })
    ).workspace;
    const same = await transition(s, {
      type: "import",
      text: csv,
      name: "renamed.csv",
      warningsAccepted: false,
    });
    expect(same.workspace.batches).toHaveLength(1);
    const [head, ...lines] = csv.split("\r\n");
    await expect(
      transition(s, {
        type: "import",
        text: [head, ...lines.reverse()].join("\r\n"),
        name: "reordered.csv",
        warningsAccepted: false,
      }),
    ).rejects.toThrow("冲突");
    expect(s.batches).toHaveLength(1);
  });
  it.each(["currency", "date", "clicks", "campaign_id", "attribution_window"])(
    "invalid %s rejects the whole batch without changing prior state",
    async (field) => {
      const s = await delivered();
      const lines = goldenCsv(s).split("\r\n");
      const keys = lines[0].split(",");
      const cells = lines[2].split(",");
      cells[keys.indexOf(field)] = {
        currency: "USD",
        date: "2026-02-31",
        clicks: "",
        campaign_id: "someone-else",
        attribution_window: "first_click",
      }[field]!;
      lines[2] = cells.join(",");
      const before = JSON.stringify(s);
      await expect(
        transition(s, {
          type: "import",
          text: lines.join("\r\n"),
          name: "bad.csv",
          warningsAccepted: false,
        }),
      ).rejects.toThrow();
      expect(JSON.stringify(s)).toBe(before);
    },
  );
  it("rejects duplicate columns, duplicate rows, empty files and incorrect quoting", async () => {
    const s = await delivered();
    const valid = goldenCsv(s);
    for (const bad of [
      "",
      valid.split("\r\n")[0],
      valid.replace("clicks", "orders"),
      valid + "\r\n" + valid.split("\r\n")[1],
      valid + '\r\n"unclosed',
    ])
      expect((await previewCsv(bad, s)).errors.length).toBeGreaterThan(0);
  });
  it("accepts BOM and changed column order", async () => {
    const s = await delivered();
    expect((await previewCsv("\uFEFF" + goldenCsv(s), s)).errors).toEqual([]);
    const reversed = goldenCsv(s)
      .split("\r\n")
      .map((l) => l.split(",").reverse().join(","))
      .join("\r\n");
    expect((await previewCsv(reversed, s)).errors).toEqual([]);
  });
  it("enforces file and row limits", async () => {
    const s = await delivered();
    await expect(
      previewCsv("x".repeat(2 * 1024 * 1024 + 1), s),
    ).rejects.toThrow("2 MB");
    const [head, row] = goldenCsv(s).split("\r\n");
    await expect(
      previewCsv([head, ...Array(5001).fill(row)].join("\r\n"), s),
    ).rejects.toThrow("5000");
  });
  it("warns about immature data and suspicious funnel without silently importing", async () => {
    const s = await delivered();
    const csv = goldenCsv(s).replace("10000,300,12", "10,300,12");
    const p = await previewCsv(csv, s, new Date("2026-10-04T00:00:00Z"));
    expect(p.warnings.length).toBeGreaterThan(0);
    await expect(
      transition(s, {
        type: "import",
        text: csv,
        name: "warn.csv",
        warningsAccepted: false,
      }),
    ).rejects.toThrow("警告");
  });
  it("analysis binds to a snapshot and does not reuse fixture on new metrics", async () => {
    let s = await delivered();
    s = (
      await transition(s, {
        type: "import",
        text: goldenCsv(s),
        name: "golden.csv",
        warningsAccepted: false,
      })
    ).workspace;
    s = (await transition(s, { type: "fixture_analysis" })).workspace;
    expect(s.analyses[0].hash).toBe(await metricHash(s));
    const newCsv = goldenCsv(s).replaceAll("2026-10-03", "2026-10-04");
    s = (
      await transition(s, {
        type: "import",
        text: newCsv,
        name: "day2.csv",
        warningsAccepted: false,
      })
    ).workspace;
    expect(s.analyses[0].hash).not.toBe(await metricHash(s));
    await expect(transition(s, { type: "fixture_analysis" })).rejects.toThrow(
      "不匹配",
    );
    await expect(experimentWorkspace(s, s.analyses[0].id, 0)).rejects.toThrow(
      "过期",
    );
  });
  it("generated outputs require matching input versions and real output schema", () => {
    const s = makeSeed();
    expect(() =>
      applyGenerated(s, "strategy", s.strategy!.data, { brand: 999, brief: 1 }),
    ).toThrow("变化");
    expect(() =>
      applyGenerated(s, "xiaohongshu", { variants: [] }, inputVersion(s)),
    ).toThrow();
  });
});

it("does not reuse a fixture analysis when per-variant metrics are swapped", async () => {
  const s = await delivered();
  const preview = await previewCsv(goldenCsv(s), s);
  const rows = structuredClone(preview.rows);
  [rows[0].variant_id, rows[1].variant_id] = [
    rows[1].variant_id,
    rows[0].variant_id,
  ];
  s.batches = [
    {
      id: "test",
      hash: "test",
      createdAt: new Date().toISOString(),
      name: "swapped",
      warnings: [],
      rows,
    },
  ];
  await expect(transition(s, { type: "fixture_analysis" })).rejects.toThrow(
    "与样例不匹配",
  );
});
it("an adopted experiment creates a clean independent campaign and keeps original evidence", async () => {
  let s = await delivered();
  s = (
    await transition(s, {
      type: "import",
      text: goldenCsv(s),
      name: "golden.csv",
      warningsAccepted: true,
    })
  ).workspace;
  s = (await transition(s, { type: "fixture_analysis" })).workspace;
  const before = JSON.stringify(s);
  const next = await experimentWorkspace(s, s.analyses[0].id, 0);
  expect(next.id).not.toBe(s.id);
  expect(next.variants).toEqual([]);
  expect(next.batches).toEqual([]);
  expect(next.strategy).toBeNull();
  expect(next.brief.notes).toContain(s.id);
  expect(next.brief.title).toContain("下一轮");
  expect(JSON.stringify(s)).toBe(before);
});

import { restoreWorkspaces } from "../../src/domain/storage";
it("restores only complete supported browser state", () => {
  expect(restoreWorkspaces([makeSeed()])[0].name).toContain("轻行");
  expect(() =>
    restoreWorkspaces([{ schemaVersion: 1, mode: "fixture", variants: [] }]),
  ).toThrow();
  const s = makeSeed();
  s.variants[0].versions = [];
  expect(() => restoreWorkspaces([s])).toThrow();
});
