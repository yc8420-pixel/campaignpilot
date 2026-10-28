import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch();
const cold = [],
  warm = [];
try {
  for (let i = 0; i < 10; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let start = performance.now();
    await page.goto("http://127.0.0.1:5174/");
    await page.getByRole("heading", { level: 1 }).waitFor();
    cold.push(performance.now() - start);
    start = performance.now();
    await page.reload();
    await page.getByRole("heading", { level: 1 }).waitFor();
    warm.push(performance.now() - start);
    await context.close();
  }
  const summary = (values) => ({
    n: values.length,
    medianMs: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)],
    p95Ms: [...values].sort((a, b) => a - b)[
      Math.ceil(values.length * 0.95) - 1
    ],
    samplesMs: values,
  });
  writeFileSync(
    "artifacts/performance.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment:
          "macOS arm64, headless Chromium, Vite production preview on loopback, no throttling",
        measurement:
          "navigation to first visible h1; not LCP and not public-network SLA",
        newBrowserContext: summary(cold),
        sameContextReload: summary(warm),
        realModelLatency: null,
        realModelCost: null,
      },
      null,
      2,
    ),
  );
  console.log("Saved 20 actual local navigation measurements.");
} finally {
  await browser.close();
}
