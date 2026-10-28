// Records actual browser interactions. Pauses are reading time, never fake generation time.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const root = "artifacts/video";
mkdirSync(root, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: root, size: { width: 1440, height: 1000 } },
  acceptDownloads: true,
});
const page = await context.newPage();
const started = Date.now();
const scenes = [];
const nav = async (name) =>
  page.locator("nav").getByRole("button", { name }).click();
async function hold(until, title) {
  scenes.push({ atSeconds: Math.round((Date.now() - started) / 1000), title });
  console.log(title);
  const left = until * 1000 - (Date.now() - started);
  if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
}
try {
  await page.goto("http://127.0.0.1:5174/");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await hold(13, "00:00 工作概览：虚构案例与演示模式");
  await page.getByRole("button", { name: "了解营策台" }).click();
  await hold(25, "00:13 流程说明：预生成响应，无真实AI调用");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await nav("品牌资料");
  await hold(42, "00:25 产品事实与原始来源");
  await nav("活动策略");
  await page.getByText("一份清楚的选包清单").scrollIntoViewIfNeeded();
  await hold(60, "00:42 活动目标、预算与三个角度");
  await nav("内容工坊");
  await hold(69, "01:00 双渠道内容 A/B");
  await page.getByRole("button", { name: "编辑与审核" }).first().click();
  await page
    .getByRole("button", { name: "F001", exact: false })
    .first()
    .click();
  await hold(87, "01:09 文案审核与来源快照");
  await page
    .getByLabel("审核意见")
    .fill("演示自检：核对已提供事实、价格和来源。");
  await page.getByRole("button", { name: "确认审核通过" }).click();
  await page.getByRole("button", { name: "← 返回内容列表" }).click();
  await page.getByRole("button", { name: "编辑与审核" }).nth(1).click();
  await page.getByLabel("审核意见").fill("演示自检：规格清单与来源一致。");
  await page.getByRole("button", { name: "确认审核通过" }).click();
  await page.getByRole("button", { name: "← 返回内容列表" }).click();
  await hold(99, "01:27 人工确认 A/B 审核");
  await page.getByRole("button", { name: "导出已通过内容" }).click();
  await hold(108, "01:39 交付导出：锁定版本，不代表发布");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 Markdown" }).click();
  await (await downloaded).saveAs(root + "/recording-export.md");
  await nav("数据复盘");
  await page.getByRole("button", { name: "预览模拟数据" }).click();
  await hold(122, "01:48 CSV 预览与合同校验");
  await page.getByRole("button", { name: "确认导入" }).click();
  await page.getByText("表现概览").scrollIntoViewIfNeeded();
  await hold(139, "02:02 确定性指标：CTR 2.33%、CPA 70、ROAS 3.84");
  await page.getByRole("button", { name: "查看样例复盘" }).click();
  await page.getByText("可核对的观察").scrollIntoViewIfNeeded();
  await hold(158, "02:19 复盘：观察、假设与限制");
  await page
    .getByRole("button", { name: "采用并预填下一轮需求" })
    .first()
    .click();
  await hold(173, "02:38 确认下一轮实验：不覆盖原活动");
  await page.getByRole("button", { name: "确认创建下一轮活动" }).click();
  await hold(180, "02:53 新活动需求；日期、预算待核对");
  const video = page.video();
  await context.close();
  await video.saveAs(root + "/campaignpilot-3min.webm");
  writeFileSync(
    root + "/chapters.json",
    JSON.stringify(
      {
        mode: "fixture",
        realAiCalls: 0,
        unedited: true,
        durationTargetSeconds: 180,
        scenes,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
