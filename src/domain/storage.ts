import { z } from "zod";
import {
  BrandSchema,
  BriefSchema,
  CopySchema,
  StrategySchema,
  AnalysisSchema,
  Channel,
  Workspace,
} from "./types";
const input = z.object({ brand: z.number().int(), brief: z.number().int() });
const workspace = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  revision: z.number().int(),
  name: z.string(),
  mode: z.literal("fixture"),
  brand: BrandSchema,
  brandRevision: z.number().int(),
  brief: BriefSchema,
  briefRevision: z.number().int(),
  strategy: z.object({ data: StrategySchema, input }).nullable(),
  selectedAngle: z.string(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        channel: Channel,
        label: z.string(),
        deliveredVersionId: z.string().nullable(),
        versions: z
          .array(
            z.object({
              id: z.string(),
              number: z.number().int(),
              copy: CopySchema,
              input,
              brandSnapshot: BrandSchema,
              status: z.enum(["draft", "approved", "rejected"]),
              reviewNote: z.string(),
              reviewedAt: z.string().nullable(),
              createdAt: z.string(),
            }),
          )
          .min(1),
      }),
    )
    .max(20),
  batches: z.array(
    z.object({
      id: z.string(),
      hash: z.string(),
      name: z.string(),
      createdAt: z.string(),
      warnings: z.array(z.string()),
      rows: z.array(
        z.object({
          date: z.string(),
          campaign_id: z.string(),
          channel: Channel,
          variant_id: z.string(),
          impressions: z.number().int().nonnegative(),
          clicks: z.number().int().nonnegative(),
          orders: z.number().int().nonnegative(),
          spend: z.number().int().nonnegative(),
          revenue: z.number().int().nonnegative(),
          currency: z.literal("CNY"),
          attribution_window: z.literal("last_click_7d"),
        }),
      ),
    }),
  ),
  analyses: z.array(
    z.object({
      id: z.string(),
      data: AnalysisSchema,
      hash: z.string(),
      createdAt: z.string(),
      metrics: z.object({
        impressions: z.number(),
        clicks: z.number(),
        orders: z.number(),
        spend: z.number(),
        revenue: z.number(),
        ctr: z.number().nullable(),
        cvr: z.number().nullable(),
        cpc: z.number().nullable(),
        cpa: z.number().nullable(),
        roas: z.number().nullable(),
      }),
    }),
  ),
  exports: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      manifest: z.array(
        z.object({ variantId: z.string(), versionId: z.string() }),
      ),
    }),
  ),
  runs: z.array(
    z.object({
      id: z.string(),
      step: z.string(),
      status: z.enum(["running", "succeeded", "failed", "unknown"]),
      mode: z.enum(["fixture", "live"]),
      model: z.string(),
      promptVersion: z.string(),
      createdAt: z.string(),
      durationMs: z.number(),
      attempts: z.number(),
      inputTokens: z.number().nullable(),
      outputTokens: z.number().nullable(),
      error: z.string().nullable(),
    }),
  ),
  audit: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      action: z.string(),
      detail: z.string(),
    }),
  ),
});
/** Browser storage is untrusted; restore only a complete supported aggregate. */
export function restoreWorkspaces(value: unknown): Workspace[] {
  return z.array(workspace).min(1).max(50).parse(value);
}
