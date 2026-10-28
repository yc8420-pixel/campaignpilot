import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "营策台 CampaignPilot · AI 营销工作台",
  description:
    "从品牌事实到内容审核与数据复盘。虚构品牌、预生成响应的公开演示。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
