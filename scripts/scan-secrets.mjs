// Reports paths, never matching secret values. This heuristic complements manual review.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
const roots = [
  "src",
  "app",
  "scripts",
  "tests",
  "supabase",
  ".github",
  "sites/campaignpilot-demo/dist",
];
const patterns = [
  /\bsk-[A-Za-z0-9_-]{24,}\b/,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{25,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const files = [];
function walk(path) {
  for (const name of readdirSync(path)) {
    const file = path + "/" + name;
    if (statSync(file).isDirectory()) walk(file);
    else files.push(file);
  }
}
for (const path of roots) walk(path);
const hits = files.filter((path) =>
  patterns.some((pattern) => pattern.test(readFileSync(path, "utf8"))),
);
writeFileSync(
  "artifacts/secret-scan.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope: roots,
      filesChecked: files.length,
      findings: hits.map((path) => ({
        path,
        kind: "credential-pattern",
        value: "REDACTED",
      })),
      limitation:
        "Heuristic detection of common credential formats, not proof of absence of all secrets.",
    },
    null,
    2,
  ),
);
console.log(
  `${files.length} source/build files checked; ${hits.length} suspected credentials (values redacted).`,
);
if (hits.length) process.exitCode = 1;
