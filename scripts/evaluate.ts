/** Opt-in offline evaluation. No production database writes or automatic human scores. */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { generate } from "../src/ai/provider";
import { applyGenerated } from "../src/domain/logic";
import { Workspace, inputVersion, hash } from "../src/domain/types";
import { goldenCsv, previewCsv, metricHash } from "../src/domain/analytics";
async function main() {
  if (
    process.env.EVAL_LIVE_CONFIRM !== "I_UNDERSTAND_COST" ||
    !process.env.OPENAI_API_KEY ||
    !process.env.AI_MODEL
  )
    throw new Error(
      "Evaluation not started: set OPENAI_API_KEY, AI_MODEL and EVAL_LIVE_CONFIRM=I_UNDERSTAND_COST. These calls may incur charges.",
    );
  const split = process.env.EVAL_SPLIT ?? "development";
  if (!["development", "holdout"].includes(split))
    throw new Error("EVAL_SPLIT must be development or holdout");
  const maxCalls = Number(process.env.EVAL_MAX_CALLS ?? 12);
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 200)
    throw new Error("EVAL_MAX_CALLS: 1–200");
  const cases = (
    JSON.parse(readFileSync("evals/regular.json", "utf8")).cases as {
      id: string;
      split: string;
      workspace: Workspace;
    }[]
  ).filter((c) => c.split === split);
  const runId = new Date().toISOString().replaceAll(":", "-");
  const dir = `artifacts/evals/${runId}`;
  mkdirSync(dir, { recursive: true });
  let calls = 0;
  for (const c of cases)
    for (let round = 1; round <= 2; round++) {
      let state = structuredClone(c.workspace);
      const outputs: unknown[] = [];
      let error: string | null = null;
      try {
        for (const step of [
          "strategy",
          "xiaohongshu",
          "douyin",
          "analysis",
        ] as const) {
          if (step === "analysis") {
            // Synthetic benchmark data only; this never marks user content approved or writes to a database.
            const evaluationContext = structuredClone(state);
            for (const v of evaluationContext.variants)
              v.deliveredVersionId = v.versions.at(-1)!.id;
            const data = await previewCsv(
              goldenCsv(evaluationContext),
              evaluationContext,
            );
            evaluationContext.batches = [
              {
                id: "evaluation-only",
                hash: await hash(data.rows),
                name: "synthetic-metrics",
                createdAt: new Date().toISOString(),
                warnings: ["Synthetic benchmark, not real campaign results"],
                rows: data.rows,
              },
            ];
            state = evaluationContext;
          }
          const start = Date.now();
          const result = await generate(
            state,
            step,
            {
              apiKey: process.env.OPENAI_API_KEY!,
              model: process.env.AI_MODEL!,
            },
            async () => {
              if (calls >= maxCalls) throw new Error("EVAL_CALL_LIMIT");
              calls++;
            },
          );
          outputs.push({ step, durationMs: Date.now() - start, ...result });
          state = applyGenerated(
            state,
            step,
            result.output,
            inputVersion(state),
            step === "analysis" ? await metricHash(state) : undefined,
          );
        }
      } catch (e) {
        error = (e as Error).message;
      }
      writeFileSync(
        `${dir}/${c.id}-round${round}.json`,
        JSON.stringify(
          {
            caseId: c.id,
            round,
            split,
            model: process.env.AI_MODEL,
            outputs,
            error,
            cumulativeProviderAttempts: calls,
            humanReview: null,
          },
          null,
          2,
        ),
      );
      if (calls >= maxCalls) break;
    }
  console.log(
    `Saved actual outputs to ${dir}; ${calls} provider attempts. Human quality scores remain unset.`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
