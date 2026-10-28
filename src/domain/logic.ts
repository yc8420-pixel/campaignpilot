import { z } from "zod";
import Papa from "papaparse";
import {
  BrandSchema,
  BriefSchema,
  CopySchema,
  DomainError,
  Workspace,
  Variant,
  Copy,
  Analysis,
  InputVersion,
  latest,
  inputVersion,
  sameInput,
  uid,
  now,
  channelName,
  StrategySchema,
  ContentOutputSchema,
  AnalysisSchema,
  Channel,
  stableJson,
} from "./types";
import {
  strategy,
  makeSeed,
  copies,
  analysis,
  brand as fixtureBrand,
  brief as fixtureBrief,
} from "./seed";
import { previewCsv, metrics, metricHash, goldenCsv } from "./analytics";
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("save_brand"), brand: BrandSchema }),
  z.object({ type: z.literal("save_brief"), brief: BriefSchema }),
  z.object({ type: z.literal("select_angle"), id: z.string().max(80) }),
  z.object({
    type: z.literal("edit_content"),
    id: z.string().max(100),
    versionId: z.string().max(100),
    copy: CopySchema,
  }),
  z.object({
    type: z.literal("review"),
    id: z.string().max(100),
    versionId: z.string().max(100),
    decision: z.enum(["approved", "rejected"]),
    note: z.string().max(1000),
  }),
  z.object({ type: z.literal("fork_variant"), id: z.string().max(100) }),
  z.object({
    type: z.literal("export"),
    ids: z.array(z.string()).min(1).max(20),
    format: z.enum(["markdown", "csv"]),
  }),
  z.object({
    type: z.literal("import"),
    text: z.string().max(2 * 1024 * 1024),
    name: z.string().max(200),
    warningsAccepted: z.boolean(),
  }),
  z.object({ type: z.literal("fixture_strategy") }),
  z.object({ type: z.literal("fixture_content"), channel: Channel }),
  z.object({ type: z.literal("fixture_analysis") }),
]);
export type Action = z.infer<typeof ActionSchema>;
export type Rule = {
  level: "block" | "warning";
  code: string;
  message: string;
};
export function checkCopy(
  copy: Copy,
  s: Workspace,
  channel: Channel,
  input: InputVersion,
): Rule[] {
  const issues: Rule[] = [];
  if (!sameInput(input, inputVersion(s)))
    issues.push({
      level: "block",
      code: "STALE",
      message: "资料或活动需求已更新，请基于新版本重新生成。",
    });
  const facts = s.brand.facts.filter((f) => f.confirmed);
  const ids = new Set(facts.map((f) => f.id));
  const text = [
    copy.title,
    copy.body,
    copy.cta,
    ...copy.shots.map((x) => x.voiceover),
  ].join("\n");
  for (const claim of copy.claims)
    if (!claim.factIds.length || claim.factIds.some((id) => !ids.has(id)))
      issues.push({
        level: "block",
        code: "REFERENCE",
        message: `「${claim.text}」缺少有效的已确认事实引用。`,
      });
  for (const term of s.brand.forbidden)
    if (term && text.includes(term))
      issues.push({
        level: "block",
        code: "FORBIDDEN",
        message: `包含品牌禁用表述「${term}」。`,
      });
  for (const term of ["防水", "认证", "销量", "用户好评", "全网最低", "最轻"])
    if (text.includes(term) && !facts.some((f) => f.value.includes(term)))
      issues.push({
        level: "block",
        code: "UNSUPPORTED",
        message: `「${term}」未获已确认资料支持，请删除或补充依据。`,
      });
  const prices = [...text.matchAll(/(\d+(?:\.\d{1,2})?)\s*元/g)].map(
    (m) => m[1],
  );
  for (const price of prices)
    if (!facts.some((f) => f.value.includes(price + "元")))
      issues.push({
        level: "block",
        code: "PRICE",
        message: `价格${price}元不在已确认资料中。`,
      });
  if (!copy.cta.trim() || !copy.title.trim() || !copy.body.trim())
    issues.push({
      level: "block",
      code: "EMPTY",
      message: "标题、正文和行动引导不可为空。",
    });
  if (channel === "douyin") {
    let end = 0;
    for (const shot of copy.shots) {
      if (shot.start !== end || shot.end <= shot.start)
        issues.push({
          level: "block",
          code: "TIMELINE",
          message: "分镜时间必须连续且不重叠。",
        });
      end = shot.end;
    }
    if (end < 25 || end > 35)
      issues.push({
        level: "block",
        code: "DURATION",
        message: "脚本时间合计需在25–35秒之间。",
      });
    issues.push({
      level: "warning",
      code: "READ_ALOUD",
      message: "请实际试读，时间字段不等于成片时长。",
    });
  }
  if (copy.claims.length === 0)
    issues.push({
      level: "warning",
      code: "HUMAN",
      message: "未列出事实引用，请人工确认是否包含产品事实。",
    });
  return issues;
}
export function validateStrategy(data: unknown, s: Workspace) {
  const result = StrategySchema.parse(data);
  if (result.budget.reduce((a, b) => a + b.cents, 0) > s.brief.budgetCents)
    throw new DomainError("BUDGET", "方案预算超过活动预算");
  const ids = new Set(
    s.brand.facts.filter((f) => f.confirmed).map((f) => f.id),
  );
  if (result.angles.some((a) => a.factIds.some((id) => !ids.has(id))))
    throw new DomainError("REFERENCE", "方案引用了不存在或未确认的事实");
  if (new Set(result.angles.map((a) => a.id)).size !== 3)
    throw new DomainError("ANGLES", "内容角度ID不能重复");
  return result;
}
function fixtureAllowed(s: Workspace) {
  if (s.mode !== "fixture")
    throw new DomainError("MODE", "真实模式不能使用样例响应", 403);
  if (
    JSON.stringify(s.brand) !== JSON.stringify(fixtureBrand) ||
    JSON.stringify(s.brief) !== JSON.stringify(fixtureBrief)
  )
    throw new DomainError(
      "FIXTURE_MISMATCH",
      "输入已改变。预生成响应仅适用于原始样例，请重置演示或使用真实模式。",
    );
}
const getVariant = (s: Workspace, id: string) => {
  const v = s.variants.find((v) => v.id === id);
  if (!v) throw new DomainError("NOT_FOUND", "内容不存在", 404);
  return v;
};
function addAudit(s: Workspace, action: string, detail: string) {
  s.audit.unshift({ id: uid(), at: now(), action, detail });
}
export type MutationResult = {
  workspace: Workspace;
  download?: { filename: string; content: string; mime: string };
  message?: string;
};
export async function transition(
  original: Workspace,
  raw: unknown,
): Promise<MutationResult> {
  const action = ActionSchema.parse(raw);
  const s = structuredClone(original);
  let download: MutationResult["download"];
  let message: string | undefined;
  switch (action.type) {
    case "save_brand":
      s.brand = action.brand;
      s.brandRevision++;
      addAudit(
        s,
        "更新品牌资料",
        `资料版本 v${s.brandRevision}；旧内容需重新审核。`,
      );
      break;
    case "save_brief":
      s.brief = action.brief;
      s.name = action.brief.title;
      s.briefRevision++;
      addAudit(s, "更新活动需求", `需求版本 v${s.briefRevision}`);
      break;
    case "select_angle":
      if (
        !s.strategy ||
        !s.strategy.data.angles.some((a) => a.id === action.id)
      )
        throw new DomainError("ANGLE", "内容角度不存在");
      s.selectedAngle = action.id;
      addAudit(s, "选择内容角度", action.id);
      break;
    case "edit_content": {
      const v = getVariant(s, action.id);
      const current = latest(v);
      if (current.id !== action.versionId)
        throw new DomainError("CONFLICT", "内容已被修改，请刷新后重试", 409);
      if (v.deliveredVersionId)
        throw new DomainError(
          "DELIVERED",
          "已交付的内容不能改写，请复制为新变体",
          409,
        );
      v.versions.push({
        ...current,
        id: uid(),
        number: current.number + 1,
        copy: action.copy,
        status: "draft",
        reviewNote: "",
        reviewedAt: null,
        createdAt: now(),
      });
      addAudit(
        s,
        "保存新草稿",
        `${channelName(v.channel)} ${v.label} · v${current.number + 1}`,
      );
      break;
    }
    case "review": {
      const v = getVariant(s, action.id),
        current = latest(v);
      if (current.id !== action.versionId)
        throw new DomainError("CONFLICT", "审核版本已过期", 409);
      if (v.deliveredVersionId)
        throw new DomainError("DELIVERED", "已交付版本的审核记录不可更改");
      if (action.decision === "approved") {
        const blocks = checkCopy(
          current.copy,
          s,
          v.channel,
          current.input,
        ).filter((r) => r.level === "block");
        if (blocks.length)
          throw new DomainError(
            "REVIEW_BLOCKED",
            blocks.map((x) => x.message).join("；"),
          );
      }
      if (action.decision === "rejected" && !action.note.trim())
        throw new DomainError("NOTE", "退回需要填写原因");
      current.status = action.decision;
      current.reviewNote = action.note;
      current.reviewedAt = now();
      addAudit(
        s,
        action.decision === "approved" ? "人工审核通过" : "退回修改",
        `${v.id} / ${current.id}：${action.note || "已核对事实、表达及渠道格式"}`,
      );
      break;
    }
    case "fork_variant": {
      if (s.variants.length >= 20)
        throw new DomainError("VARIANT_LIMIT", "每活动最多20个内容变体");
      const old = getVariant(s, action.id),
        version = latest(old);
      const id = uid();
      s.variants.push({
        id,
        channel: old.channel,
        label: old.label + " · 新实验",
        deliveredVersionId: null,
        versions: [
          {
            ...structuredClone(version),
            id: uid(),
            number: 1,
            status: "draft",
            reviewNote: "",
            reviewedAt: null,
            createdAt: now(),
          },
        ],
      });
      addAudit(s, "复制为新变体", id);
      break;
    }
    case "export": {
      if (new Set(action.ids).size !== action.ids.length)
        throw new DomainError("DUPLICATE", "不能重复选择内容");
      const selected = action.ids.map((id) => getVariant(s, id));
      for (const v of selected) {
        const c = latest(v);
        if (
          c.status !== "approved" ||
          checkCopy(c.copy, s, v.channel, c.input).some(
            (x) => x.level === "block",
          )
        )
          throw new DomainError(
            "NOT_APPROVED",
            "正式导出仅支持当前资料对应的已审核版本",
          );
        v.deliveredVersionId = c.id;
      }
      const manifest = selected.map((v) => ({
        variantId: v.id,
        versionId: latest(v).id,
      }));
      const stamp = now();
      s.exports.push({ id: uid(), createdAt: stamp, manifest });
      download = exportContents(s, selected, action.format);
      addAudit(s, "正式导出", `${manifest.length}份内容；已交付不代表已发布`);
      break;
    }
    case "import": {
      const p = await previewCsv(action.text, s);
      if (p.errors.length)
        throw new DomainError(
          "CSV_INVALID",
          p.errors
            .slice(0, 4)
            .map((e) => `第${e.row}行 ${e.column}：${e.message}`)
            .join("；"),
        );
      if (p.duplicate) {
        message = "该文件已导入，没有重复累计。";
        return { workspace: original, message };
      }
      if (p.warnings.length && !action.warningsAccepted)
        throw new DomainError("CSV_WARNING", "请先核实并确认数据警告");
      if (
        s.batches.reduce((n, b) => n + b.rows.length, 0) + p.rows.length >
        50000
      )
        throw new DomainError("DATA_LIMIT", "本活动最多50000行数据");
      s.batches.push({
        id: uid(),
        hash: p.hash,
        name: action.name,
        createdAt: now(),
        warnings: p.warnings,
        rows: p.rows,
      });
      addAudit(s, "导入数据", `${action.name} · ${p.rows.length}行，整批提交`);
      break;
    }
    case "fixture_strategy":
      fixtureAllowed(s);
      s.strategy = { data: structuredClone(strategy), input: inputVersion(s) };
      addAudit(s, "载入预生成方案", "没有调用真实模型");
      break;
    case "fixture_content": {
      fixtureAllowed(s);
      if (s.variants.length > 18)
        throw new DomainError("VARIANT_LIMIT", "每活动最多20个内容变体");
      for (const [i, copy] of copies[action.channel].entries()) {
        const id = uid();
        s.variants.push({
          id,
          channel: action.channel,
          label: i === 0 ? "A" : "B",
          deliveredVersionId: null,
          versions: [
            {
              id: uid(),
              number: 1,
              copy: structuredClone(copy),
              input: inputVersion(s),
              brandSnapshot: structuredClone(s.brand),
              status: "draft",
              reviewNote: "",
              reviewedAt: null,
              createdAt: now(),
            },
          ],
        });
      }
      addAudit(
        s,
        "载入预生成内容",
        channelName(action.channel) + "；没有调用真实模型",
      );
      break;
    }
    case "fixture_analysis": {
      fixtureAllowed(s);
      const rows = s.batches.flatMap((b) => b.rows);
      const m = metrics(rows);
      const relevant = s.variants.filter((v) =>
        rows.some((r) => r.variant_id === v.id),
      );
      const golden = await previewCsv(goldenCsv(s), { ...s, batches: [] });
      if (
        stableJson(
          [...rows].sort((a, b) => a.variant_id.localeCompare(b.variant_id)),
        ) !==
          stableJson(
            [...golden.rows].sort((a, b) =>
              a.variant_id.localeCompare(b.variant_id),
            ),
          ) ||
        rows.length !== 2 ||
        m.impressions !== 30000 ||
        m.clicks !== 700 ||
        m.orders !== 20 ||
        m.spend !== 140000 ||
        m.revenue !== 538000 ||
        relevant.some(
          (v) =>
            JSON.stringify(latest(v).copy) !==
            JSON.stringify(copies[v.channel][v.label === "A" ? 0 : 1]),
        )
      )
        throw new DomainError(
          "FIXTURE_MISMATCH",
          "数据或关联内容与样例不匹配。确定性指标已计算，新AI复盘需真实模式。",
        );
      s.analyses.push({
        id: uid(),
        data: structuredClone(analysis),
        hash: await metricHash(s),
        metrics: m,
        createdAt: now(),
      });
      addAudit(s, "载入预生成复盘", "仅适用黄金样例；没有调用真实模型");
      break;
    }
  }
  s.revision++;
  return { workspace: s, download, message };
}
export function csvCell(s: string) {
  return /^[\s]*[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
export function exportContents(
  s: Workspace,
  variants: Variant[],
  format: "markdown" | "csv",
) {
  const sample =
    s.mode === "fixture" ? "虚构品牌 / 模拟演示" : "用户提供资料 / 人工审核";
  const content =
    format === "markdown"
      ? `# ${s.brief.title}\n\n${sample} · 交付不代表平台发布\n\n` +
        variants
          .map((v) => {
            const c = latest(v);
            return `## ${channelName(v.channel)} ${v.label} · ${c.copy.title}\n\n活动：${s.id}\n\n变体：${v.id} / 版本：${c.id}\n\n${c.copy.body}\n\n${c.copy.shots.map((x) => `${x.start}–${x.end}秒｜画面：${x.visual}\n口播：${x.voiceover}`).join("\n\n")}\n\n行动引导：${c.copy.cta}\n\n${c.copy.hashtags.map((t) => "#" + t).join(" ")}\n\n依据：${c.copy.claims.map((x) => x.text + " [" + x.factIds.join(", ") + "]").join("；")}\n\n审核：${c.reviewedAt} · ${c.reviewNote || "通过"}\n`;
          })
          .join("\n---\n\n")
      : "\uFEFF" +
        Papa.unparse(
          variants.map((v) => {
            const c = latest(v);
            return {
              campaign_id: s.id,
              channel: v.channel,
              variant_id: v.id,
              content_version_id: c.id,
              title: csvCell(c.copy.title),
              body: csvCell(c.copy.body),
              cta: csvCell(c.copy.cta),
              shots: csvCell(
                c.copy.shots
                  .map(
                    (x) => `${x.start}-${x.end}秒 ${x.visual} / ${x.voiceover}`,
                  )
                  .join("\n"),
              ),
              reviewed_at: c.reviewedAt,
              source: sample,
            };
          }),
        );
  return {
    filename: `campaignpilot-${s.id}.${format === "markdown" ? "md" : "csv"}`,
    content,
    mime:
      format === "markdown"
        ? "text/markdown;charset=utf-8"
        : "text/csv;charset=utf-8",
  };
}
export function applyGenerated(
  original: Workspace,
  step: "strategy" | "xiaohongshu" | "douyin" | "analysis",
  output: unknown,
  input: InputVersion,
  snapshotHash?: string,
): Workspace {
  if (!sameInput(input, inputVersion(original)))
    throw new DomainError("STALE", "生成期间资料已变化，结果未应用", 409);
  const s = structuredClone(original);
  if (step === "strategy") {
    s.strategy = { data: validateStrategy(output, s), input };
    s.selectedAngle = s.strategy.data.angles[0].id;
  } else if (step === "analysis") {
    const data: Analysis = AnalysisSchema.parse(output);
    if (!snapshotHash) throw new DomainError("SNAPSHOT", "缺少指标快照");
    s.analyses.push({
      id: uid(),
      data,
      hash: snapshotHash,
      metrics: metrics(s.batches.flatMap((b) => b.rows)),
      createdAt: now(),
    });
  } else {
    if (s.variants.length > 18)
      throw new DomainError("VARIANT_LIMIT", "每活动最多20个内容变体");
    const data = ContentOutputSchema.parse(output);
    if (new Set(data.variants.map((v) => v.label)).size !== 2)
      throw new DomainError("VARIANTS", "需要A/B两个不同变体");
    for (const v of data.variants) {
      if (checkCopy(v.copy, s, step, input).some((r) => r.level === "block"))
        throw new DomainError(
          "CONTENT_INVALID",
          "输出包含未通过的事实、引用或格式检查",
        );
      s.variants.push({
        id: uid(),
        channel: step,
        label: v.label,
        deliveredVersionId: null,
        versions: [
          {
            id: uid(),
            number: 1,
            copy: v.copy,
            input,
            brandSnapshot: structuredClone(s.brand),
            status: "draft",
            reviewNote: "",
            reviewedAt: null,
            createdAt: now(),
          },
        ],
      });
    }
  }
  addAudit(s, "真实AI生成", step);
  s.revision++;
  return s;
}

/** Create a separate next-round brief; never overwrite evidence from the measured campaign. */
export async function experimentWorkspace(
  parent: Workspace,
  analysisId: string,
  index: number,
): Promise<Workspace> {
  const report = parent.analyses.find((a) => a.id === analysisId);
  if (!report || report.hash !== (await metricHash(parent)))
    throw new DomainError("STALE", "复盘已过期，请先生成最新复盘");
  const e = report.data.experiments[index];
  if (!e) throw new DomainError("NOT_FOUND", "实验不存在");
  const next = makeSeed(parent.mode);
  next.id = uid();
  next.brand = structuredClone(parent.brand);
  next.brief = structuredClone(parent.brief);
  next.brief.title = parent.brief.title.slice(0, 105) + " · 下一轮测试";
  next.brief.notes = [
    `来源活动：${parent.id}；复盘：${report.id}`,
    e.change,
    e.keep,
    e.measure,
    e.check,
  ]
    .join("\n")
    .slice(0, 2000);
  next.name = next.brief.title;
  next.strategy = null;
  next.selectedAngle = "";
  next.variants = [];
  next.audit = [
    {
      id: uid(),
      at: now(),
      action: "创建下一轮实验",
      detail: `来自 ${parent.id} 的已确认建议；日期与预算需核对。`,
    },
  ];
  return next;
}
