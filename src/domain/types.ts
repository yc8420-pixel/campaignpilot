import { z } from "zod";
export const Channel = z.enum(["xiaohongshu", "douyin"]);
export type Channel = z.infer<typeof Channel>;
export const FactSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(500),
  source: z.string().min(1).max(8000),
  confirmed: z.boolean(),
});
export const BrandSchema = z
  .object({
    name: z.string().min(1).max(80),
    product: z.string().min(1).max(100),
    tone: z.string().min(1).max(500),
    forbidden: z.array(z.string().max(100)).max(30),
    facts: z.array(FactSchema).min(1).max(30),
  })
  .refine(
    (b) => new Set(b.facts.map((f) => f.id)).size === b.facts.length,
    "事实编号不可重复",
  )
  .refine(
    (b) =>
      b.facts.reduce((n, f) => n + f.source.length + f.value.length, 0) <=
      12000,
    "事实和来源合计不能超过12000字符",
  );
export type Brand = z.infer<typeof BrandSchema>;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "无效日期",
  );
export const BriefSchema = z
  .object({
    title: z.string().min(1).max(120),
    goal: z.string().min(1).max(300),
    audience: z.string().min(1).max(500),
    budgetCents: z.number().int().min(0).max(100000000),
    start: date,
    end: date,
    timezone: z.string().refine((s) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: s });
        return true;
      } catch {
        return false;
      }
    }, "无效时区"),
    channels: z
      .array(Channel)
      .min(1)
      .max(2)
      .refine((a) => new Set(a).size === a.length),
    notes: z.string().max(2000),
  })
  .refine((b) => b.end >= b.start, "结束日期不能早于开始日期");
export type Brief = z.infer<typeof BriefSchema>;
export const StrategySchema = z.object({
  summary: z.string().min(1).max(3000),
  audienceHypotheses: z.array(z.string()).max(8),
  angles: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        factIds: z.array(z.string()),
        metric: z.string(),
      }),
    )
    .length(3),
  budget: z
    .array(z.object({ label: z.string(), cents: z.number().int().min(0) }))
    .max(10),
  timeline: z
    .array(z.object({ period: z.string(), action: z.string() }))
    .max(14),
  assumptions: z.array(z.string()).max(10),
  missing: z.array(z.string()).max(10),
});
export type Strategy = z.infer<typeof StrategySchema>;
export const CopySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  cta: z.string().min(1).max(500),
  hashtags: z.array(z.string()).max(12),
  claims: z
    .array(
      z.object({ text: z.string().max(500), factIds: z.array(z.string()) }),
    )
    .max(30),
  shots: z
    .array(
      z.object({
        start: z.number().min(0),
        end: z.number().max(35),
        visual: z.string().max(500),
        voiceover: z.string().max(800),
      }),
    )
    .max(12),
  assumptions: z.array(z.string()).max(10),
});
export type Copy = z.infer<typeof CopySchema>;
export const ContentOutputSchema = z.object({
  variants: z
    .array(z.object({ label: z.enum(["A", "B"]), copy: CopySchema }))
    .length(2),
});
export const AnalysisSchema = z.object({
  observations: z
    .array(
      z.object({
        metric: z.enum([
          "ctr",
          "cvr",
          "cpc",
          "cpa",
          "roas",
          "orders",
          "spend",
          "revenue",
        ]),
        text: z.string().max(1000),
      }),
    )
    .min(1)
    .max(8),
  hypotheses: z.array(z.string().max(1000)).max(8),
  experiments: z
    .array(
      z.object({
        title: z.string(),
        change: z.string(),
        keep: z.string(),
        measure: z.string(),
        check: z.string(),
      }),
    )
    .min(1)
    .max(5),
  limitations: z.array(z.string().max(1000)).min(1).max(10),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
export type InputVersion = { brand: number; brief: number };
export type ContentVersion = {
  id: string;
  number: number;
  copy: Copy;
  input: InputVersion;
  brandSnapshot: Brand;
  status: "draft" | "approved" | "rejected";
  reviewNote: string;
  reviewedAt: string | null;
  createdAt: string;
};
export type Variant = {
  id: string;
  channel: Channel;
  label: string;
  versions: ContentVersion[];
  deliveredVersionId: string | null;
};
export type MetricRow = {
  date: string;
  campaign_id: string;
  channel: Channel;
  variant_id: string;
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  revenue: number;
  currency: "CNY";
  attribution_window: "last_click_7d";
};
export type ImportBatch = {
  id: string;
  hash: string;
  name: string;
  createdAt: string;
  warnings: string[];
  rows: MetricRow[];
};
export type Totals = {
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  revenue: number;
};
export type Metrics = Totals & {
  ctr: number | null;
  cvr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
};
export type Run = {
  id: string;
  step: string;
  status: "running" | "succeeded" | "failed" | "unknown";
  mode: "fixture" | "live";
  model: string;
  promptVersion: string;
  createdAt: string;
  durationMs: number;
  attempts: number;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
};
export type Workspace = {
  schemaVersion: 1;
  id: string;
  revision: number;
  name: string;
  mode: "fixture" | "live";
  brand: Brand;
  brandRevision: number;
  brief: Brief;
  briefRevision: number;
  strategy: { data: Strategy; input: InputVersion } | null;
  selectedAngle: string;
  variants: Variant[];
  batches: ImportBatch[];
  analyses: {
    id: string;
    data: Analysis;
    hash: string;
    metrics: Metrics;
    createdAt: string;
  }[];
  exports: {
    id: string;
    createdAt: string;
    manifest: { variantId: string; versionId: string }[];
  }[];
  runs: Run[];
  audit: { id: string; at: string; action: string; detail: string }[];
};
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const latest = (v: Variant) => v.versions[v.versions.length - 1];
export const inputVersion = (s: Workspace): InputVersion => ({
  brand: s.brandRevision,
  brief: s.briefRevision,
});
export const sameInput = (a: InputVersion, b: InputVersion) =>
  a.brand === b.brand && a.brief === b.brief;
export const channelName = (c: Channel) =>
  c === "xiaohongshu" ? "小红书" : "抖音";
export function stableJson(x: unknown): string {
  if (Array.isArray(x)) return "[" + x.map(stableJson).join(",") + "]";
  if (x && typeof x === "object")
    return (
      "{" +
      Object.entries(x)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + stableJson(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(x) ?? "null";
}
export async function hash(x: unknown) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(typeof x === "string" ? x : stableJson(x)),
      ),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
