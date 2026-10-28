import {
  Workspace,
  Brand,
  Brief,
  Strategy,
  Copy,
  Analysis,
  Channel,
} from "./types";
export const brand: Brand = {
  name: "轻行",
  product: "城市通勤背包",
  tone: "简洁、实用、克制。把产品事实讲清楚，让用户自己判断。",
  forbidden: ["全网最低", "百分百防水", "销量第一", "永不损坏"],
  facts: [
    {
      id: "F001",
      label: "产品容量",
      value: "18L",
      source: "轻行虚构产品资料 v1：容量18L。",
      confirmed: true,
    },
    {
      id: "F002",
      label: "包体重量",
      value: "0.65kg",
      source: "轻行虚构产品资料 v1：包体重量0.65kg。",
      confirmed: true,
    },
    {
      id: "F003",
      label: "日常标价",
      value: "299元",
      source: "轻行虚构价格表 v1：标价299元。",
      confirmed: true,
    },
    {
      id: "F004",
      label: "活动价格",
      value: "269元",
      source: "轻行虚构价格表 v1：本次活动价269元。",
      confirmed: true,
    },
    {
      id: "F005",
      label: "收纳结构",
      value: "独立电脑隔层",
      source: "轻行虚构产品资料 v1：配有独立电脑隔层，未提供适配尺寸。",
      confirmed: true,
    },
  ],
};
export const brief: Brief = {
  title: "轻行 · 城市通勤新品计划",
  goal: "获取可归因订单",
  audience:
    "在通勤、办公室与下班生活之间切换的城市通勤人群。该画像是待验证假设。",
  budgetCents: 500000,
  start: "2026-10-01",
  end: "2026-10-14",
  timezone: "Asia/Shanghai",
  channels: ["xiaohongshu", "douyin"],
  notes: "用真实规格说话，不补造防水、销量、电脑适配尺寸或用户证言。",
};
export const strategy: Strategy = {
  summary:
    "用「把通勤装得刚刚好」连接日常场景与可核对的产品事实。先比较场景叙事和规格表达，再用同口径数据决定下一轮测试。",
  audienceHypotheses: [
    "用户可能更关心日常装取和收纳组织，而非堆砌功能。",
    "通勤场景是否比规格介绍更能带来点击，需要小规模对照验证。",
  ],
  angles: [
    {
      id: "scene",
      title: "装下今天的日常",
      description:
        "以出门、进办公室和下班三个片段，展示18L通勤收纳的使用想象。",
      factIds: ["F001", "F005"],
      metric: "点击率 CTR",
    },
    {
      id: "light",
      title: "让通勤，轻一点",
      description: "用0.65kg的已知重量切入，把主观感受保留给用户判断。",
      factIds: ["F002"],
      metric: "点击到订单 CVR",
    },
    {
      id: "value",
      title: "一份清楚的选包清单",
      description: "列出容量、重量、隔层和活动价，给用户具体的购买判断依据。",
      factIds: ["F001", "F002", "F004", "F005"],
      metric: "每归因订单成本 CPA",
    },
  ],
  budget: [
    { label: "内容测试与小额投放", cents: 300000 },
    { label: "素材制作与调整", cents: 120000 },
    { label: "复测预留", cents: 80000 },
  ],
  timeline: [
    {
      period: "第 1–3 天",
      action: "核对资料，准备两种表达方向，完成审核与素材交付。",
    },
    {
      period: "第 4–10 天",
      action: "人工执行小额内容测试，保持人群、预算和时间条件尽量一致。",
    },
    {
      period: "第 11–14 天",
      action: "汇总已成熟数据，记录观察，准备下一轮单变量测试。",
    },
  ],
  assumptions: [
    "预算为计划分配，不代表已发生支出。",
    "渠道和人群选择均属于假设；本工具不执行实际发布或投放。",
  ],
  missing: [
    "电脑适配尺寸尚未提供，不在文案中承诺。",
    "防水等级、销量和认证资料尚未提供。",
  ],
};
const claims = [
  { text: "18L", factIds: ["F001"] },
  { text: "0.65kg", factIds: ["F002"] },
  { text: "活动价269元", factIds: ["F004"] },
  { text: "独立电脑隔层", factIds: ["F005"] },
];
export const copies: Record<Channel, Copy[]> = {
  xiaohongshu: [
    {
      title: "把通勤装得刚刚好",
      body: "早上出门，你会把什么放进包里？\n\n一台电脑、一本书，还有今天要做的事。轻行通勤背包，18L容量，配有独立电脑隔层；0.65kg包体，让选择多一项清楚的参考。\n\n不替你定义通勤的样子。把每天需要的东西，按自己的习惯安排。\n\n本次活动价269元。电脑适配尺寸请先确认。",
      cta: "查看产品信息，确认是否适合你的日常。",
      hashtags: ["通勤装备", "日常收纳", "轻行背包"],
      claims,
      shots: [],
      assumptions: ["日常场景为创意表达，非真实用户评价。"],
    },
    {
      title: "选通勤包，先看这四件事",
      body: "面对一排背包，不妨先把条件列清楚。\n\n① 容量：18L\n② 包体重量：0.65kg\n③ 收纳：独立电脑隔层\n④ 本次活动价：269元（标价299元）\n\n选择不一定要复杂。先对照日常需要，再确认电脑适配尺寸。\n\n这是一份关于轻行通勤背包的产品信息清单。",
      cta: "收藏清单，按自己的需求逐项核对。",
      hashtags: ["通勤好物", "选包清单", "理性选择"],
      claims: [...claims, { text: "标价299元", factIds: ["F003"] }],
      shots: [],
      assumptions: [],
    },
  ],
  douyin: [
    {
      title: "30秒，整理一次出门的节奏",
      body: "从出门前的桌面收纳切入，镜头展示产品与已提供规格。",
      cta: "了解产品详情，确认电脑适配尺寸。",
      hashtags: ["通勤日常"],
      claims,
      shots: [
        {
          start: 0,
          end: 5,
          visual: "俯拍桌面，电脑与书本依次入画。",
          voiceover: "出门前，你会带上哪些日常？",
        },
        {
          start: 5,
          end: 13,
          visual: "展示背包全貌，叠加18L与0.65kg。",
          voiceover: "轻行通勤背包，18L容量，包体重量0.65kg。",
        },
        {
          start: 13,
          end: 23,
          visual: "打开独立电脑隔层，避免展示未经确认的适配尺寸。",
          voiceover: "有独立电脑隔层。先核对适配尺寸，再按自己的习惯整理。",
        },
        {
          start: 23,
          end: 30,
          visual: "背包静物收尾，清楚显示活动价格。",
          voiceover: "本次活动价269元。看看它是否适合你的通勤。",
        },
      ],
      assumptions: ["需实际拍摄和试读；时间字段不保证成片时长。"],
    },
    {
      title: "一只通勤包的信息卡",
      body: "用四张视觉信息卡介绍产品，不添加未确认的功能。",
      cta: "把需求列出来，再做选择。",
      hashtags: ["选包指南"],
      claims,
      shots: [
        {
          start: 0,
          end: 6,
          visual: "信息卡「先列条件，再选包」。",
          voiceover: "选通勤包，先看看这些信息。",
        },
        {
          start: 6,
          end: 15,
          visual: "容量与重量信息卡交替出现。",
          voiceover: "18L容量，0.65kg包体重量。都是可以核对的规格。",
        },
        {
          start: 15,
          end: 24,
          visual: "展示隔层结构与269元活动价。",
          voiceover: "独立电脑隔层，本次活动价269元。适配尺寸还要先确认。",
        },
        {
          start: 24,
          end: 30,
          visual: "产品全貌定格。",
          voiceover: "轻行，把选择留给你的实际需要。",
        },
      ],
      assumptions: ["画面安排为拍摄建议，不是已有产品视频。"],
    },
  ],
};
export const analysis: Analysis = {
  observations: [
    {
      metric: "ctr",
      text: "按曝光加权汇总后的点击率由总点击与总曝光计算，不能平均两个变体的百分比。",
    },
    {
      metric: "cpa",
      text: "A的每归因订单成本为50元，B为100元；这是本组模拟数据的描述。",
    },
    {
      metric: "roas",
      text: "汇总销售额与花费之比只描述广告回报，不包含商品或履约成本。",
    },
  ],
  hypotheses: [
    "场景表达可能更容易让受众理解产品用途，但人群、时段和投放差异也可能影响结果。",
  ],
  experiments: [
    {
      title: "只改变开场，验证场景表达",
      change: "比较「出门前的收纳场景」与「四项规格清单」两个开场。",
      keep: "产品价格、投放人群、素材长度与计划预算保持一致。",
      measure: "CTR和点击到订单CVR，同时观察CPA。",
      check: "完成同等观察期并等待7天归因窗口成熟后复盘。",
    },
  ],
  limitations: [
    "全部为模拟数据，不能证明真实营销收益。",
    "样本有限，未进行随机对照或显著性检验。",
    "订单不等于首购；ROAS不等于净利润率。",
  ],
};
export function makeSeed(mode: "fixture" | "live" = "fixture"): Workspace {
  return {
    schemaVersion: 1,
    id: mode === "fixture" ? "qingxing-demo" : crypto.randomUUID(),
    revision: 0,
    name: brief.title,
    mode,
    brand: structuredClone(brand),
    brandRevision: 1,
    brief: structuredClone(brief),
    briefRevision: 1,
    strategy:
      mode === "fixture"
        ? { data: structuredClone(strategy), input: { brand: 1, brief: 1 } }
        : null,
    selectedAngle: "scene",
    variants:
      mode === "fixture"
        ? (["xiaohongshu", "douyin"] as Channel[]).flatMap((channel) =>
            copies[channel].map((copy, i) => ({
              id: `${channel === "xiaohongshu" ? "xhs" : "dy"}-${i === 0 ? "a" : "b"}`,
              channel,
              label: i === 0 ? "A" : "B",
              deliveredVersionId: null,
              versions: [
                {
                  id: `${channel}-${i}-v1`,
                  number: 1,
                  copy: structuredClone(copy),
                  input: { brand: 1, brief: 1 },
                  brandSnapshot: structuredClone(brand),
                  status: "draft" as const,
                  reviewNote: "",
                  reviewedAt: null,
                  createdAt: "2026-10-01T00:00:00.000Z",
                },
              ],
            })),
          )
        : [],
    batches: [],
    analyses: [],
    exports: [],
    runs: [],
    audit: [],
  };
}
