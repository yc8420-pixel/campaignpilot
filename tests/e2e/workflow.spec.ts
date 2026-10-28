import { test, expect, Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
const screenDir = "artifacts/screenshots";
async function nav(page: Page, name: string) {
  await page.locator("nav").getByRole("button", { name, exact: false }).click();
}
async function approve(page: Page, index: number) {
  await page.getByRole("button", { name: "编辑与审核" }).nth(index).click();
  await expect(
    page.getByRole("button", { name: "确认审核通过" }),
  ).toBeEnabled();
  await page.getByLabel("审核意见").fill("已核对价格、规格、来源和渠道表达。");
  await page.getByRole("button", { name: "确认审核通过" }).click();
  await expect(
    page.getByText("审核通过", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "← 返回内容列表" }).click();
}
async function exported(page: Page) {
  await nav(page, "内容工坊");
  await approve(page, 0);
  await approve(page, 1);
  await page.getByRole("button", { name: "导出已通过内容" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 Markdown" }).click();
  expect((await download).suggestedFilename()).toContain(".md");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
test("E01 public demo is honest, isolated and resettable", async ({
  page,
  context,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/") || r.url().includes("openai.com"))
      apiRequests.push(r.url());
  });
  await expect(page.getByText("演示模式 · 预生成响应")).toBeVisible();
  await nav(page, "品牌资料");
  await page.getByLabel("品牌名称", { exact: true }).fill("仅在这个浏览器");
  await page.getByRole("button", { name: "保存资料版本" }).click();
  await page.reload();
  await nav(page, "品牌资料");
  await expect(page.getByLabel("品牌名称", { exact: true })).toHaveValue(
    "仅在这个浏览器",
  );
  const other = await context.browser()!.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("http://127.0.0.1:5174/");
  await otherPage
    .locator("nav")
    .getByRole("button", { name: "品牌资料" })
    .click();
  await expect(otherPage.getByLabel("品牌名称", { exact: true })).toHaveValue(
    "轻行",
  );
  await other.close();
  await page.getByRole("button", { name: "重置演示" }).click();
  await page.getByRole("button", { name: "确认重置" }).click();
  await nav(page, "品牌资料");
  await expect(page.getByLabel("品牌名称", { exact: true })).toHaveValue(
    "轻行",
  );
  expect(apiRequests).toEqual([]);
});
test("E08 edited copy invalidates approval and unsupported claim blocks it", async ({
  page,
}) => {
  await nav(page, "内容工坊");
  await page.getByRole("button", { name: "编辑与审核" }).first().click();
  const body = page.getByLabel("正文 / 脚本概述");
  await body.fill((await body.inputValue()) + " 百分百防水");
  await expect(
    page.getByRole("button", { name: "确认审核通过" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "保存新草稿" }).click();
  await expect(
    page.getByText("包含品牌禁用表述「百分百防水」。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "确认审核通过" }),
  ).toBeDisabled();
  await body.fill((await body.inputValue()).replace(" 百分百防水", ""));
  await page.getByRole("button", { name: "保存新草稿" }).click();
  await page.getByRole("button", { name: "确认审核通过" }).click();
  await page.getByLabel("标题", { exact: true }).fill("新的标题");
  await expect(
    page.getByRole("button", { name: "确认审核通过" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "保存新草稿" }).click();
  await expect(page.getByText("待审核", { exact: true }).first()).toBeVisible();
});
test("E09/E11/E13 complete review-export-import-analysis flow and evidence", async ({
  page,
}) => {
  mkdirSync(screenDir, { recursive: true });
  await page.screenshot({
    path: screenDir + "/01-dashboard.png",
    fullPage: true,
  });
  await exported(page);
  await nav(page, "数据复盘");
  await page.getByRole("button", { name: "预览模拟数据" }).click();
  await expect(page.getByText("2 行可导入")).toBeVisible();
  await page.getByRole("button", { name: "确认导入" }).click();
  await expect(page.getByText("2.33%", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("¥70.00", { exact: true })).toBeVisible();
  await expect(page.getByText("3.84×", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "查看样例复盘" }).click();
  await expect(
    page.getByText("只改变开场，验证场景表达", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: screenDir + "/03-analytics.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "预览模拟数据" }).click();
  await expect(
    page.getByText("该文件已导入，再次提交不会累计。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认导入" }).click();
  await expect(page.getByText("该文件已导入，没有重复累计。")).toBeVisible();
  await page.reload();
  await nav(page, "数据复盘");
  await expect(page.getByText("2.33%", { exact: true }).first()).toBeVisible();
});
test("E10 wrong CSV reports row errors and never imports partial data", async ({
  page,
}) => {
  await exported(page);
  await nav(page, "数据复盘");
  const csv =
    "date,campaign_id,channel,variant_id,impressions,clicks,orders,spend,revenue,currency,attribution_window\n2026-10-03,qingxing-demo,xiaohongshu,xhs-a,10000,300,12,600,3228,USD,last_click_7d";
  await page.getByLabel("选择CSV文件").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText("第 2 行 · currency：仅支持CNY")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认导入" })).toHaveCount(0);
  await expect(page.getByText("还没有可分析的数据")).toBeVisible();
});
test("E04 changed fixture input cannot masquerade as live generation", async ({
  page,
}) => {
  await nav(page, "品牌资料");
  await page.getByLabel("品牌名称", { exact: true }).fill("自定义品牌");
  await page.getByRole("button", { name: "保存资料版本" }).click();
  await nav(page, "活动策略");
  await page.getByRole("button", { name: "查看示例方案" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "预生成响应仅适用于原始样例",
  );
});
test("mobile layout has no horizontal overflow and navigation remains usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "打开导航" }).click();
  await nav(page, "内容工坊");
  await page.getByRole("button", { name: "编辑与审核" }).first().click();
  await expect(
    page.getByRole("button", { name: "确认审核通过" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  mkdirSync(screenDir, { recursive: true });
  await page.screenshot({ path: screenDir + "/04-mobile.png", fullPage: true });
});
test("strategy and sources can be inspected; scripts are editable text", async ({
  page,
}) => {
  await nav(page, "活动策略");
  await expect(page.getByText("一份清楚的选包清单")).toBeVisible();
  mkdirSync(screenDir, { recursive: true });
  await page.screenshot({
    path: screenDir + "/02-strategy.png",
    fullPage: true,
  });
  await nav(page, "内容工坊");
  await page.getByRole("button", { name: "抖音脚本", exact: true }).click();
  await page.getByRole("button", { name: "编辑与审核" }).first().click();
  await expect(page.getByText("分镜与口播")).toBeVisible();
  await page
    .getByRole("button", { name: "F001", exact: false })
    .first()
    .click();
  await expect(page.getByText("F001 · 历史来源快照")).toBeVisible();
});

test("next experiment preserves old results and creates a separate brief only after confirmation", async ({
  page,
}) => {
  await exported(page);
  await nav(page, "数据复盘");
  await page.getByRole("button", { name: "预览模拟数据" }).click();
  await page.getByRole("button", { name: "确认导入" }).click();
  await page.getByRole("button", { name: "查看样例复盘" }).click();
  await page
    .getByRole("button", { name: "采用并预填下一轮需求" })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "确认下一轮实验需求" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认创建下一轮活动" }).click();
  await expect(page.getByLabel("活动名称")).toHaveValue(/下一轮测试/);
  await nav(page, "内容工坊");
  await expect(page.getByText("这里还没有内容")).toBeVisible();
});
test("unsaved navigation can be cancelled and malformed browser data recovers", async ({
  page,
}) => {
  await nav(page, "品牌资料");
  await page.getByLabel("品牌名称", { exact: true }).fill("未保存编辑");
  page.once("dialog", (dialog) => dialog.dismiss());
  await nav(page, "内容工坊");
  await expect(page.getByLabel("品牌名称", { exact: true })).toHaveValue(
    "未保存编辑",
  );
  await page.getByRole("button", { name: "保存资料版本" }).click();
  await page.evaluate(() =>
    localStorage.setItem(
      "campaignpilot-workspaces-v1",
      JSON.stringify([{ schemaVersion: 1, mode: "fixture", variants: [] }]),
    ),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("已恢复初始样例");
  await nav(page, "品牌资料");
  await expect(page.getByLabel("品牌名称", { exact: true })).toHaveValue(
    "轻行",
  );
});
test("keyboard focus stays in a modal and Escape restores the triggering control", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "了解营策台" });
  await trigger.click();
  const close = page.getByRole("button", { name: "关闭", exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
