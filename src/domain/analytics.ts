import Papa from "papaparse";
import { DomainError, MetricRow, Metrics, Workspace, hash } from "./types";
export const CSV_FIELDS = [
  "date",
  "campaign_id",
  "channel",
  "variant_id",
  "impressions",
  "clicks",
  "orders",
  "spend",
  "revenue",
  "currency",
  "attribution_window",
];
export function metrics(rows: MetricRow[]): Metrics {
  const t = rows.reduce(
    (a, r) => ({
      impressions: a.impressions + r.impressions,
      clicks: a.clicks + r.clicks,
      orders: a.orders + r.orders,
      spend: a.spend + r.spend,
      revenue: a.revenue + r.revenue,
    }),
    { impressions: 0, clicks: 0, orders: 0, spend: 0, revenue: 0 },
  );
  const div = (n: number, d: number) => (d === 0 ? null : n / d);
  return {
    ...t,
    ctr: div(t.clicks, t.impressions),
    cvr: div(t.orders, t.clicks),
    cpc: div(t.spend / 100, t.clicks),
    cpa: div(t.spend / 100, t.orders),
    roas: div(t.revenue, t.spend),
  };
}
export const rowKey = (r: MetricRow) =>
  [r.date, r.campaign_id, r.channel, r.variant_id].join("|");
export function parseMoney(raw: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw new Error("金额须为非负数字，最多两位小数");
  const [whole, decimal = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100000000000)
    throw new Error("金额超出上限");
  return cents;
}
export type CsvPreview = {
  rows: MetricRow[];
  errors: { row: number; column: string; message: string }[];
  warnings: string[];
  hash: string;
  duplicate: boolean;
};
export async function previewCsv(
  text: string,
  s: Workspace,
  clock = new Date(),
): Promise<CsvPreview> {
  const fileHash = await hash(text);
  const out: CsvPreview = {
    rows: [],
    errors: [],
    warnings: [],
    hash: fileHash,
    duplicate: s.batches.some((b) => b.hash === fileHash),
  };
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new DomainError("FILE_TOO_LARGE", "文件不能超过2 MB", 413);
  if (text.includes("\uFFFD"))
    throw new DomainError("ENCODING", "请上传UTF-8编码文件");
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length) {
    out.errors = parsed.errors.map((e) => ({
      row: (e.row ?? 0) + 1,
      column: "CSV",
      message: e.message,
    }));
    return out;
  }
  const [header, ...data] = parsed.data;
  if (!header || data.length === 0) {
    out.errors.push({
      row: 1,
      column: "文件",
      message: "需要表头和至少一行数据",
    });
    return out;
  }
  if (data.length > 5000) throw new DomainError("ROW_LIMIT", "最多5000行", 413);
  if (
    header.length !== CSV_FIELDS.length ||
    new Set(header).size !== header.length ||
    CSV_FIELDS.some((f) => !header.includes(f))
  ) {
    out.errors.push({
      row: 1,
      column: "表头",
      message: "字段缺失、重复或包含未知列，请使用下载的模板",
    });
    return out;
  }
  const existing = new Set(s.batches.flatMap((b) => b.rows.map(rowKey)));
  const seen = new Set<string>();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: s.brief.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(clock);
  const matureBefore = new Date(today + "T00:00:00Z").getTime() - 7 * 86400000;
  for (const [i, values] of data.entries()) {
    const row = i + 2;
    let bad = false;
    if (values.length !== header.length) {
      out.errors.push({ row, column: "行", message: "列数与表头不一致" });
      continue;
    }
    const obj = Object.fromEntries(header.map((h, j) => [h, values[j].trim()]));
    const err = (column: string, message: string) => {
      bad = true;
      out.errors.push({ row, column, message });
    };
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(obj.date) ||
      Number.isNaN(Date.parse(obj.date)) ||
      new Date(obj.date).toISOString().slice(0, 10) !== obj.date
    )
      err("date", "日期须为有效YYYY-MM-DD");
    else if (obj.date < s.brief.start || obj.date > s.brief.end)
      err("date", "日期不在本活动时间范围内");
    if (obj.campaign_id !== s.id) err("campaign_id", "活动编号不匹配");
    if (!["xiaohongshu", "douyin"].includes(obj.channel))
      err("channel", "渠道不支持");
    const variant = s.variants.find(
      (v) => v.id === obj.variant_id && v.channel === obj.channel,
    );
    if (!variant?.deliveredVersionId)
      err("variant_id", "需要对应已正式导出的内容变体");
    if (obj.currency !== "CNY") err("currency", "仅支持CNY");
    if (obj.attribution_window !== "last_click_7d")
      err("attribution_window", "仅支持末次点击7天口径");
    const nums: Record<string, number> = {};
    for (const key of ["impressions", "clicks", "orders"]) {
      if (
        !/^\d+$/.test(obj[key]) ||
        !Number.isSafeInteger(Number(obj[key])) ||
        Number(obj[key]) > 1e10
      )
        err(key, "须为非负整数且不超过100亿");
      else nums[key] = Number(obj[key]);
    }
    for (const key of ["spend", "revenue"]) {
      try {
        nums[key] = parseMoney(obj[key]);
      } catch (e) {
        err(key, (e as Error).message);
      }
    }
    if (bad) continue;
    const r: MetricRow = {
      date: obj.date,
      campaign_id: obj.campaign_id,
      channel: obj.channel as MetricRow["channel"],
      variant_id: obj.variant_id,
      impressions: nums.impressions,
      clicks: nums.clicks,
      orders: nums.orders,
      spend: nums.spend,
      revenue: nums.revenue,
      currency: "CNY",
      attribution_window: "last_click_7d",
    };
    const key = rowKey(r);
    if (seen.has(key)) err("variant_id", "文件内自然键重复");
    if (existing.has(key) && !out.duplicate)
      err("variant_id", "与已导入数据冲突，整批拒绝");
    seen.add(key);
    if (r.clicks > r.impressions || r.orders > r.clicks)
      out.warnings.push(`第${row}行：漏斗数值关系异常，请核实上游口径。`);
    if (new Date(r.date).getTime() > matureBefore)
      out.warnings.push(
        `第${row}行：7天归因窗口未成熟；本版不支持同键增量回填。`,
      );
    if (!bad) out.rows.push(r);
  }
  return out;
}
export function goldenCsv(s: Workspace) {
  const variants = s.variants
    .filter((v) => v.channel === "xiaohongshu")
    .slice(0, 2);
  return Papa.unparse({
    fields: CSV_FIELDS,
    data: variants.map((v, i) => [
      "2026-10-03",
      s.id,
      v.channel,
      v.id,
      i ? 20000 : 10000,
      i ? 400 : 300,
      i ? 8 : 12,
      i ? "800.00" : "600.00",
      i ? "2152.00" : "3228.00",
      "CNY",
      "last_click_7d",
    ]),
  });
}
export async function metricHash(s: Workspace) {
  return hash({
    rows: s.batches.flatMap((b) => b.rows),
    versions: s.variants
      .filter((v) => v.deliveredVersionId)
      .map((v) => [v.id, v.deliveredVersionId]),
  });
}
export const display = (
  value: number | null,
  kind: "percent" | "money" | "ratio" = "ratio",
) =>
  value === null
    ? "N/A"
    : kind === "percent"
      ? (value * 100).toFixed(2) + "%"
      : kind === "money"
        ? "¥" + value.toFixed(2)
        : value.toFixed(2);
