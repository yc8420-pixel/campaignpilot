import { mkdirSync, writeFileSync } from "node:fs";
import { makeSeed } from "../src/domain/seed";
import { transition } from "../src/domain/logic";
import { latest } from "../src/domain/types";
import { goldenCsv, metrics } from "../src/domain/analytics";
async function main() {
  let s = makeSeed();
  for (const v of s.variants)
    s = (
      await transition(s, {
        type: "review",
        id: v.id,
        versionId: latest(v).id,
        decision: "approved",
        note: "开发者样例自检：核对事实、来源与渠道格式。非独立质量评测。",
      })
    ).workspace;
  mkdirSync("artifacts/samples", { recursive: true });
  for (const format of ["markdown", "csv"] as const) {
    const result = await transition(s, {
      type: "export",
      ids: s.variants.map((v) => v.id),
      format,
    });
    s = result.workspace;
    writeFileSync(
      "artifacts/samples/" + result.download!.filename,
      result.download!.content,
    );
  }
  writeFileSync("artifacts/samples/golden-metrics.csv", goldenCsv(s));
  s = (
    await transition(s, {
      type: "import",
      text: goldenCsv(s),
      name: "golden-metrics.csv",
      warningsAccepted: true,
    })
  ).workspace;
  writeFileSync(
    "artifacts/samples/golden-expected.json",
    JSON.stringify(metrics(s.batches.flatMap((b) => b.rows)), null, 2),
  );
  console.log(
    "Exported reviewed fictional samples and independently testable golden metrics.",
  );
}
main();
