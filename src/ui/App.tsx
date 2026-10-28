"use client";
import { useState, useEffect, useRef, ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Download,
  Upload,
  LayoutDashboard,
  BookOpen,
  Target,
  Feather,
  ChartNoAxesCombined,
  History,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  Menu,
  LogOut,
  Copy as CopyIcon,
  Search,
  Package,
} from "lucide-react";
import {
  Workspace,
  Brand,
  Brief,
  Copy,
  Variant,
  latest,
  channelName,
  sameInput,
  inputVersion,
} from "../domain/types";
import { restoreWorkspaces } from "../domain/storage";
import { makeSeed } from "../domain/seed";
import {
  transition,
  Action,
  MutationResult,
  checkCopy,
  experimentWorkspace,
} from "../domain/logic";
import {
  previewCsv,
  CsvPreview,
  metrics,
  display,
  goldenCsv,
  metricHash,
} from "../domain/analytics";
import "./styles.css";
type Page =
  "overview" | "brand" | "strategy" | "content" | "analytics" | "history";
const nav = [
  { id: "overview" as Page, label: "工作概览", icon: LayoutDashboard },
  { id: "brand" as Page, label: "品牌资料", icon: BookOpen },
  { id: "strategy" as Page, label: "活动策略", icon: Target },
  { id: "content" as Page, label: "内容工坊", icon: Feather },
  { id: "analytics" as Page, label: "数据复盘", icon: ChartNoAxesCombined },
  { id: "history" as Page, label: "运行记录", icon: History },
];
const STORE = "campaignpilot-workspaces-v1";
export function saveFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function api(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message ?? "请求失败");
  return data;
}
const Money = ({ cents }: { cents: number }) => (
  <>¥{(cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</>
);
function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"tag " + tone}>{children}</span>;
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Package size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const beforeNavigate = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "nav button,a.wordmark,[data-discard]",
        ) &&
        !window.confirm("有未保存的修改。确认离开并放弃这些修改吗？")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
    };
  }, [dirty]);
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
        ) ?? [],
      );
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = focusables(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Backpack() {
  return (
    <svg className="bag-art" viewBox="0 0 300 280" aria-hidden="true">
      <defs>
        <linearGradient id="bagShade" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#a7bb9c" />
          <stop offset="1" stopColor="#506b57" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="257" rx="105" ry="14" fill="#071c15" opacity=".4" />
      <path
        d="M117 61C103 7 196 7 189 61"
        fill="none"
        stroke="#91a98a"
        strokeWidth="14"
      />
      <path
        d="M97 76C45 88 64 206 69 243M204 76C257 96 236 210 235 244"
        fill="none"
        stroke="#49644f"
        strokeWidth="22"
      />
      <path
        d="M94 61Q155 37 211 64L231 224Q232 250 207 251H98Q72 248 76 221Z"
        fill="url(#bagShade)"
        stroke="#acc0a3"
        strokeWidth="2"
      />
      <path d="M94 66Q150 45 209 67L217 139H85Z" fill="#789371" />
      <path d="M88 143H219M99 156H208" stroke="#263f32" strokeWidth="3" />
      <path d="M101 158L97 227H211L207 158" fill="#78916f" stroke="#a4b59a" />
      <path d="M211 156L214 169" stroke="#e0e7ce" strokeWidth="3" />
      <rect x="139" y="95" width="38" height="17" rx="3" fill="#d7dec7" />
      <text x="158" y="107" textAnchor="middle" fill="#3b5541" fontSize="9">
        轻行
      </text>
      <path
        d="M77 171L64 179V217L78 223M229 171L242 179V216L230 224"
        fill="#547053"
        stroke="#8da483"
      />
      <circle cx="242" cy="59" r="23" fill="#dce9bd" />
      <path
        d="m233 59 6 6 11-13"
        fill="none"
        stroke="#254e39"
        strokeWidth="3"
      />
    </svg>
  );
}
export default function App({
  mode = "fixture",
  hostedDemo = false,
}: {
  mode?: "fixture" | "live";
  hostedDemo?: boolean;
}) {
  const [all, setAll] = useState<Workspace[]>([]),
    [active, setActive] = useState(""),
    [page, setPage] = useState<Page>("overview"),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    [modal, setModal] = useState<"reset" | "new" | "about" | null>(null),
    [sidebar, setSidebar] = useState(false),
    [loggedIn, setLoggedIn] = useState(false),
    [liveConfigured, setLiveConfigured] = useState(false);
  const [experiment, setExperiment] = useState<{
    analysisId: string;
    index: number;
    preview: Workspace;
  } | null>(null);
  const ws = all.find((s) => s.id === active) ?? all[0];
  function tell(text: string, error = false) {
    setNotice({ text, error });
  }
  useEffect(() => {
    if (mode === "fixture") {
      try {
        const stored = localStorage.getItem(STORE);
        const parsed = stored ? JSON.parse(stored) : null;
        if (parsed) {
          const restored = restoreWorkspaces(parsed);
          setAll(restored);
          setActive(restored[0].id);
        } else {
          const seed = makeSeed();
          setAll([seed]);
          setActive(seed.id);
        }
      } catch {
        const seed = makeSeed();
        setAll([seed]);
        setActive(seed.id);
        tell(
          "浏览器存储不可用或旧数据已损坏，已恢复初始样例。请确认后再编辑。",
          true,
        );
      }
      setReady(true);
    } else {
      api("status")
        .then((r) => setLiveConfigured(r.configured))
        .catch(() => setLiveConfigured(false));
      api("workspaces")
        .then((r) => {
          setAll(r.workspaces);
          setActive(r.workspaces[0]?.id ?? "");
          setLoggedIn(true);
        })
        .catch(() => setLoggedIn(false))
        .finally(() => setReady(true));
    }
  }, [mode]);
  useEffect(() => {
    if (mode === "fixture" && ready && all.length) {
      try {
        localStorage.setItem(STORE, JSON.stringify(all));
      } catch {
        tell("无法保存到浏览器，刷新可能丢失本次改动。", true);
      }
    }
  }, [all, mode, ready]);
  function update(next: Workspace) {
    setAll((old) => old.map((s) => (s.id === next.id ? next : s)));
  }
  async function perform(action: Action) {
    if (!ws || busy) return;
    setBusy(true);
    try {
      const result: MutationResult =
        mode === "fixture"
          ? await transition(ws, action)
          : await api(`workspaces/${ws.id}/mutate`, {
              expectedRevision: ws.revision,
              action,
            });
      update(result.workspace);
      if (result.download)
        saveFile(
          result.download.filename,
          result.download.content,
          result.download.mime,
        );
      tell(result.message ?? "已保存");
      return result.workspace;
    } catch (e) {
      tell((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function generate(
    step: "strategy" | "xiaohongshu" | "douyin" | "analysis",
  ) {
    if (mode === "fixture") {
      return perform(
        step === "strategy"
          ? { type: "fixture_strategy" }
          : step === "analysis"
            ? { type: "fixture_analysis" }
            : { type: "fixture_content", channel: step },
      );
    }
    if (!ws || busy) return;
    setBusy(true);
    try {
      const res = await api(`workspaces/${ws.id}/generate`, {
        step,
        key: crypto.randomUUID(),
        expectedRevision: ws.revision,
      });
      update(res.workspace);
      if (res.run.status !== "succeeded")
        tell(
          `执行状态：${res.run.status}。未应用结果，请查看运行记录；未知结果重试可能再次计费。`,
          true,
        );
      else tell("真实生成已完成，结果已保存");
    } catch (e) {
      tell((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function createCampaign() {
    setBusy(true);
    try {
      let next: Workspace;
      if (mode === "fixture") {
        next = makeSeed();
        next.id = crypto.randomUUID();
        next.name = "轻行 · 新活动";
        next.brief.title = next.name;
        next.variants = [];
        next.strategy = null;
      } else {
        const res = await api("workspaces", {});
        next = res.workspace;
      }
      setAll((a) => [next, ...a]);
      setActive(next.id);
      setPage("brand");
      setModal(null);
      tell(
        "新活动已创建。样例模式自定义输入可编辑保存，AI响应仅支持原始案例。",
      );
    } catch (e) {
      tell((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function prepareExperiment(analysisId: string, index: number) {
    try {
      setExperiment({
        analysisId,
        index,
        preview: await experimentWorkspace(ws, analysisId, index),
      });
    } catch (e) {
      tell((e as Error).message, true);
    }
  }
  async function confirmExperiment() {
    if (!experiment || busy) return;
    setBusy(true);
    try {
      const next =
        mode === "fixture"
          ? await experimentWorkspace(
              ws,
              experiment.analysisId,
              experiment.index,
            )
          : (
              await api("workspaces", {
                sourceId: ws.id,
                analysisId: experiment.analysisId,
                index: experiment.index,
                expectedRevision: ws.revision,
              })
            ).workspace;
      setAll((a) => [next, ...a]);
      setActive(next.id);
      setPage("strategy");
      setExperiment(null);
      tell("下一轮活动已创建。请核对日期、预算与目标后保存需求。");
    } catch (e) {
      tell((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const approved =
    ws?.variants.filter((v) => latest(v).status === "approved").length ?? 0;
  const stale = ws?.strategy
    ? !sameInput(ws.strategy.input, inputVersion(ws))
    : false;
  const rows = ws?.batches.flatMap((b) => b.rows) ?? [];
  const m = metrics(rows);
  if (!ready)
    return (
      <div className="boot">
        <div className="brand-symbol">营</div>
        <p>正在打开营策台…</p>
      </div>
    );
  if (mode === "live" && !loggedIn)
    return (
      <Login
        configured={liveConfigured}
        onLogin={async () => {
          const res = await api("workspaces");
          setAll(res.workspaces);
          setActive(res.workspaces[0]?.id ?? "");
          setLoggedIn(true);
        }}
      />
    );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (sidebar ? "open" : "")}>
        <a className="wordmark" href={mode === "fixture" ? "/" : "/workspace"}>
          <span className="brand-symbol">营</span>
          <span>
            营策台<small>CAMPAIGNPILOT</small>
          </span>
        </a>
        <div className="workspace-label">
          营销工作空间 <ChevronDown size={14} />
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => {
                setPage(n.id);
                setSidebar(false);
              }}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "content" && (
                <span className="nav-count">{ws?.variants.length ?? 0}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <Sparkles size={18} />
          </div>
          <strong>让创意有依据</strong>
          <p>
            从一份产品资料，
            <br />
            到下一次更清楚的决策。
          </p>
          <button onClick={() => setModal("about")}>
            了解工作流程 <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="profile">
          <span className="avatar">{mode === "fixture" ? "访" : "我"}</span>
          <div>
            <strong>{mode === "fixture" ? "演示访客" : "个人工作空间"}</strong>
            <small>
              {mode === "fixture"
                ? "数据只保存在你的浏览器"
                : "受保护的真实模式"}
            </small>
          </div>
          {mode === "live" && (
            <button
              aria-label="退出登录"
              className="icon-button"
              onClick={async () => {
                await api("logout", {});
                setAll([]);
                setLoggedIn(false);
              }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="打开导航"
            onClick={() => setSidebar(!sidebar)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            工作空间 <ChevronRight size={13} />{" "}
            <strong>{nav.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="top-actions">
            <span className="mode-pill">
              <i />
              {mode === "fixture" ? "演示模式 · 预生成响应" : "真实模式"}
            </span>
            <button
              className="icon-button"
              aria-label="了解营策台"
              onClick={() => setModal("about")}
            >
              <BookOpen size={18} />
            </button>
          </div>
        </header>
        <div className="page-content">
          {!ws ? (
            <Empty
              title="开始你的第一个营销活动"
              action={
                <button className="primary" onClick={() => setModal("new")}>
                  <Plus size={16} />
                  新建活动
                </button>
              }
            >
              真实活动会独立保存，先确认品牌资料，再开始生成。
            </Empty>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {page === "overview"
                      ? "YOUR MARKETING, IN FOCUS"
                      : "CAMPAIGN WORKSPACE"}
                  </div>
                  <h1>
                    {page === "overview"
                      ? "把每一次创意，变成下一步行动。"
                      : nav.find((n) => n.id === page)?.label}
                  </h1>
                  <p>
                    {page === "overview"
                      ? "品牌事实、内容生产与数据复盘，在同一个工作台有序推进。"
                      : ws.name}
                  </p>
                </div>
                <div className="heading-actions">
                  {mode === "fixture" && (
                    <button
                      className="secondary small"
                      onClick={() => setModal("reset")}
                    >
                      <RotateCcw size={15} />
                      重置演示
                    </button>
                  )}
                  <button
                    className="primary small"
                    onClick={() => setModal("new")}
                  >
                    <Plus size={16} />
                    新建活动
                  </button>
                </div>
              </div>
              {all.length > 1 && (
                <label className="campaign-switch">
                  当前活动
                  <select
                    value={ws.id}
                    onChange={(e) => setActive(e.target.value)}
                  >
                    {all.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {page === "overview" && (
                <>
                  <div className="overview-grid">
                    <section className="hero">
                      <div className="hero-copy">
                        <div className="hero-tag">
                          <span />
                          正在准备的活动
                        </div>
                        <h2>
                          {ws.brand.name === "轻行" &&
                          ws.brand.product === "城市通勤背包" ? (
                            <>
                              把通勤，
                              <br />
                              装得刚刚好。
                            </>
                          ) : (
                            <>
                              从产品事实，
                              <br />
                              走向营销行动。
                            </>
                          )}
                        </h2>
                        <p>
                          {ws.brand.name}
                          {ws.brand.product} · {ws.brief.title}
                        </p>
                        <div className="hero-facts">
                          {ws.brand.facts
                            .filter((f) => f.confirmed)
                            .slice(0, 3)
                            .map((f) => (
                              <span key={f.id}>
                                {f.value} · {f.label}
                              </span>
                            ))}
                        </div>
                        <button
                          className="light-button"
                          onClick={() => setPage("content")}
                        >
                          进入内容工坊 <ArrowUpRight size={17} />
                        </button>
                      </div>
                      <div className="hero-visual">
                        <span className="hero-grid" />
                        {ws.brand.name === "轻行" &&
                        ws.brand.product === "城市通勤背包" ? (
                          <Backpack />
                        ) : (
                          <Package
                            size={160}
                            strokeWidth={1}
                            aria-hidden="true"
                          />
                        )}
                        <span className="visual-caption">
                          QINGXING / EVERYDAY CARRY
                          <br />
                          虚构产品示意 · 不代表实物
                        </span>
                      </div>
                    </section>
                    <section className="panel workflow">
                      <div className="section-head">
                        <h2>活动进度</h2>
                        <Tag tone="green">
                          {approved ? "审核进行中" : "准备就绪"}
                        </Tag>
                      </div>
                      {[
                        {
                          label: "确认品牌事实",
                          sub: `${ws.brand.facts.filter((f) => f.confirmed).length} 条已确认资料`,
                          done: true,
                          p: "brand",
                        },
                        {
                          label: "梳理活动策略",
                          sub: stale
                            ? "资料已更新，需重新生成"
                            : "目标、人群与内容角度",
                          done: !!ws.strategy && !stale,
                          p: "strategy",
                        },
                        {
                          label: "内容生成与审核",
                          sub: `${approved} / ${ws.variants.length} 份已通过`,
                          done: approved > 0,
                          p: "content",
                        },
                        {
                          label: "导出执行材料",
                          sub: `${ws.exports.length} 次正式导出`,
                          done: ws.exports.length > 0,
                          p: "content",
                        },
                        {
                          label: "回传数据与复盘",
                          sub: rows.length
                            ? `${rows.length} 行数据已导入`
                            : "等待回传数据",
                          done: ws.analyses.length > 0,
                          p: "analytics",
                        },
                      ].map((step, i) => (
                        <button
                          key={step.label}
                          className="workflow-step"
                          onClick={() => setPage(step.p as Page)}
                        >
                          <span
                            className={
                              "step-number " + (step.done ? "done" : "")
                            }
                          >
                            {step.done ? <Check size={14} /> : i + 1}
                          </span>
                          <span>
                            <strong>{step.label}</strong>
                            <small>{step.sub}</small>
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </section>
                  </div>
                  <div className="stats-grid">
                    <Stat
                      icon={<Target size={18} />}
                      label="活动预算"
                      value={<Money cents={ws.brief.budgetCents} />}
                      sub="计划投入 · 非实际支出"
                    />
                    <Stat
                      icon={<Feather size={18} />}
                      label="内容草稿"
                      value={ws.variants.length.toString().padStart(2, "0")}
                      sub="2 种渠道形式 · A/B 表达"
                    />
                    <Stat
                      icon={<ShieldCheck size={18} />}
                      label="已审核内容"
                      value={approved.toString().padStart(2, "0")}
                      sub="人工确认后才可正式导出"
                    />
                    <Stat
                      icon={<ChartNoAxesCombined size={18} />}
                      label="归因订单"
                      value={rows.length ? m.orders.toString() : "—"}
                      sub={
                        rows.length
                          ? mode === "fixture"
                            ? "模拟数据 · last_click_7d"
                            : "回传数据 · last_click_7d"
                          : "导入数据后开始计算"
                      }
                    />
                  </div>
                  <div className="section-head section-gap">
                    <div>
                      <h2>
                        创意工作区{" "}
                        <span className="muted">/ CONTENT STUDIO</span>
                      </h2>
                      <p>先核对依据，再让表达更有吸引力。</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("content")}
                    >
                      查看全部 <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="content-preview-grid">
                    {ws.variants.slice(0, 3).map((v, i) => (
                      <button
                        className="content-preview"
                        key={v.id}
                        onClick={() => setPage("content")}
                      >
                        <div className={"preview-art art-" + i}>
                          <span className="art-channel">
                            {channelName(v.channel)} / {v.label}
                          </span>
                          <span className="art-copy">
                            {i === 0 ? (
                              <>
                                日常有序，
                                <br />
                                通勤从容。
                              </>
                            ) : i === 1 ? (
                              <>
                                少一点纠结，
                                <br />
                                多一点清楚。
                              </>
                            ) : (
                              <>
                                30 秒，
                                <br />
                                看见日常。
                              </>
                            )}
                          </span>
                          <span className="art-bottom">
                            {ws.brand.name} <ArrowUpRight size={17} />
                          </span>
                        </div>
                        <div className="preview-details">
                          <Status status={latest(v).status} />
                          <h3>{latest(v).copy.title}</h3>
                          <p>
                            {channelName(v.channel)} ·{" "}
                            {latest(v).copy.claims.length} 条事实引用{" "}
                            <ArrowUpRight size={16} />
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="bottom-strip">
                    <ShieldCheck size={19} />
                    <p>
                      <strong>每一份输出，都有来处。</strong>{" "}
                      产品事实可追溯，内容需要人工审核，指标由代码计算。
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setPage("brand")}
                    >
                      查看品牌事实 <ArrowRight size={15} />
                    </button>
                  </div>
                </>
              )}
              {page === "brand" && (
                <BrandEditor
                  key={ws.id + "-" + ws.brandRevision}
                  ws={ws}
                  busy={busy}
                  onSave={(b) => perform({ type: "save_brand", brand: b })}
                />
              )}
              {page === "strategy" && (
                <StrategyPage
                  key={ws.id + "-" + ws.briefRevision}
                  ws={ws}
                  busy={busy}
                  onSave={(b) => perform({ type: "save_brief", brief: b })}
                  onGenerate={() => generate("strategy")}
                  onSelect={(id) => perform({ type: "select_angle", id })}
                  onContent={() => setPage("content")}
                />
              )}
              {page === "content" && (
                <ContentPage
                  ws={ws}
                  busy={busy}
                  perform={perform}
                  generate={generate}
                />
              )}
              {page === "analytics" && (
                <Analytics
                  ws={ws}
                  busy={busy}
                  perform={perform}
                  generate={() => generate("analysis")}
                  tell={tell}
                  goContent={() => setPage("content")}
                  onExperiment={prepareExperiment}
                />
              )}
              {page === "history" && <HistoryPage ws={ws} />}
            </>
          )}
          <footer>
            <span>营策台 / CAMPAIGNPILOT</span>
            <span>
              {mode === "fixture"
                ? "虚构品牌 · 模拟数据 · 预生成 AI 响应"
                : "个人作品 · 真实模式需要服务端配置"}
            </span>
            <button onClick={() => setModal("about")}>
              作品说明 <ExternalLink size={12} />
            </button>
          </footer>
        </div>
      </main>
      {busy && (
        <div className="busy-indicator" role="status">
          <span className="spinner" />
          正在处理，请保持页面打开…
        </div>
      )}
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={"toast " + (notice.error ? "error" : "")}
        >
          <span>
            {notice.error ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
          </span>
          <p>{notice.text}</p>
          <button aria-label="关闭提示" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {experiment && (
        <Modal title="确认下一轮实验需求" onClose={() => setExperiment(null)}>
          <h3>{experiment.preview.brief.title}</h3>
          <p className="preserve">{experiment.preview.brief.notes}</p>
          <div className="callout">
            将创建独立活动，保留本轮全部数据与报告。日期与预算沿用本轮，创建后请在需求表单中核对。
          </div>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setExperiment(null)}>
              取消
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={confirmExperiment}
            >
              确认创建下一轮活动
            </button>
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="重置当前演示" onClose={() => setModal(null)}>
          <p>
            将恢复原始轻行案例，当前活动的本地编辑、审核与导入数据会清除，其他活动不受影响。
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              取消
            </button>
            <button
              className="primary"
              onClick={() => {
                const seed = makeSeed();
                seed.id = ws.id;
                setAll((a) => a.map((s) => (s.id === ws.id ? seed : s)));
                setModal(null);
                setPage("overview");
                tell("已恢复原始样例");
              }}
            >
              确认重置
            </button>
          </div>
        </Modal>
      )}
      {modal === "new" && (
        <Modal title="新建营销活动" onClose={() => setModal(null)}>
          <p>
            {mode === "fixture"
              ? "创建一份独立的本地活动，使用轻行资料作为起点。自定义输入可以保存；需要实时生成时，请使用配置完成的真实模式。"
              : "创建一份独立的真实活动，先录入和确认自己的产品事实。"}
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              取消
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={createCampaign}
            >
              创建活动
            </button>
          </div>
        </Modal>
      )}
      {modal === "about" && (
        <Modal title="关于营策台" onClose={() => setModal(null)}>
          <p className="lead">
            把品牌事实、渠道表达和数据依据放进同一条可审核的工作流。
          </p>
          <ol className="about-list">
            <li>确认资料与活动需求，区分事实和假设。</li>
            <li>生成小红书文案与抖音文本脚本，人工检查后导出。</li>
            <li>通过标准CSV回传数据，用确定性公式计算指标。</li>
            <li>复盘观察与下一步实验，不把相关性当因果。</li>
          </ol>
          <div className="callout">
            当前
            {mode === "fixture"
              ? "为公开演示：品牌虚构、数据模拟、AI响应预生成。编辑、审核、导出和计算实际在浏览器内执行。"
              : "为真实模式：身份与数据由Supabase管理，AI只在服务端调用。"}{" "}
            不连接实际发布或投放平台。
          </div>
          <p className="small-note">
            真实模式入口适用于运行完整 Next.js
            应用的环境。静态在线演示不提供真实登录服务。
          </p>
          {mode === "fixture" && !hostedDemo && (
            <a className="secondary" href="/workspace">
              打开真实模式入口 <ArrowUpRight size={15} />
            </a>
          )}
        </Modal>
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub: string;
}) {
  return (
    <section className="stat-card">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </section>
  );
}
function Status({ status }: { status: string }) {
  return (
    <Tag
      tone={
        status === "approved"
          ? "green"
          : status === "rejected"
            ? "red"
            : "amber"
      }
    >
      {status === "approved"
        ? "审核通过"
        : status === "rejected"
          ? "已退回"
          : "待审核"}
    </Tag>
  );
}
function BrandEditor({
  ws,
  busy,
  onSave,
}: {
  ws: Workspace;
  busy: boolean;
  onSave: (b: Brand) => unknown;
}) {
  const [b, setB] = useState(structuredClone(ws.brand));
  useUnsavedChanges(JSON.stringify(b) !== JSON.stringify(ws.brand));
  return (
    <div className="two-column">
      <section className="panel form-panel">
        <div className="section-head">
          <div>
            <h2>品牌与产品</h2>
            <p>只使用有依据、已经确认的信息。</p>
          </div>
          <Tag>版本 v{ws.brandRevision}</Tag>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(b);
          }}
        >
          <div className="form-grid">
            <label>
              品牌名称
              <input
                required
                value={b.name}
                onChange={(e) => setB({ ...b, name: e.target.value })}
              />
            </label>
            <label>
              产品名称
              <input
                required
                value={b.product}
                onChange={(e) => setB({ ...b, product: e.target.value })}
              />
            </label>
          </div>
          <label>
            品牌语气
            <textarea
              rows={3}
              value={b.tone}
              onChange={(e) => setB({ ...b, tone: e.target.value })}
            />
          </label>
          <label>
            禁用表述（每行一条）
            <textarea
              rows={3}
              value={b.forbidden.join("\n")}
              onChange={(e) =>
                setB({
                  ...b,
                  forbidden: e.target.value.split("\n").filter(Boolean),
                })
              }
            />
          </label>
          <div className="section-head section-gap">
            <h3>可引用的产品事实</h3>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setB({
                  ...b,
                  facts: [
                    ...b.facts,
                    {
                      id: "F" + String(b.facts.length + 1).padStart(3, "0"),
                      label: "新事实",
                      value: "",
                      source: "",
                      confirmed: false,
                    },
                  ],
                })
              }
            >
              <Plus size={15} />
              添加事实
            </button>
          </div>
          {b.facts.map((f, i) => (
            <div className="fact-edit" key={i}>
              <div className="fact-label">
                <Tag>{f.id}</Tag>
                <input
                  aria-label={f.id + "名称"}
                  value={f.label}
                  onChange={(e) =>
                    setB({
                      ...b,
                      facts: b.facts.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={f.confirmed}
                    onChange={(e) =>
                      setB({
                        ...b,
                        facts: b.facts.map((x, j) =>
                          j === i ? { ...x, confirmed: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                  已确认
                </label>
              </div>
              <label>
                事实值
                <input
                  required
                  value={f.value}
                  onChange={(e) =>
                    setB({
                      ...b,
                      facts: b.facts.map((x, j) =>
                        j === i ? { ...x, value: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                来源原文
                <textarea
                  required
                  rows={2}
                  value={f.source}
                  onChange={(e) =>
                    setB({
                      ...b,
                      facts: b.facts.map((x, j) =>
                        j === i ? { ...x, source: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
            </div>
          ))}
          <div className="form-actions">
            <span>保存后建立新版本，已有输出会标记过期。</span>
            <button disabled={busy} className="primary" type="submit">
              保存资料版本 <Check size={16} />
            </button>
          </div>
        </form>
      </section>
      <aside className="panel side-explainer">
        <div className="round-icon">
          <ShieldCheck />
        </div>
        <h2>有引用，也需要判断。</h2>
        <p>事实编号帮助追溯资料；引用存在，并不代表一句话已被证明正确。</p>
        <h3>这个样例没有提供</h3>
        <ul>
          <li>防水或防摔等级</li>
          <li>电脑适配尺寸</li>
          <li>销量、认证与用户评价</li>
          <li>真实营销效果</li>
        </ul>
        <div className="callout">
          资料不足时保留“待确认”，不要让AI替品牌做没有依据的承诺。
        </div>
      </aside>
    </div>
  );
}
function StrategyPage({
  ws,
  busy,
  onSave,
  onGenerate,
  onSelect,
  onContent,
}: {
  ws: Workspace;
  busy: boolean;
  onSave: (b: Brief) => unknown;
  onGenerate: () => unknown;
  onSelect: (id: string) => unknown;
  onContent: () => void;
}) {
  const [b, setB] = useState(structuredClone(ws.brief));
  useUnsavedChanges(JSON.stringify(b) !== JSON.stringify(ws.brief));
  const [editing, setEditing] = useState(!ws.strategy);
  const stale = ws.strategy && !sameInput(ws.strategy.input, inputVersion(ws));
  return (
    <>
      <section className="panel brief-panel">
        <div className="section-head">
          <div>
            <h2>
              活动需求 <Tag>v{ws.briefRevision}</Tag>
            </h2>
            <p>让每个内容方向都回答一个明确的业务问题。</p>
          </div>
          <button
            className="secondary small"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "收起表单" : "编辑需求"}
          </button>
        </div>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave(b);
            }}
          >
            <div className="form-grid">
              <label>
                活动名称
                <input
                  required
                  value={b.title}
                  onChange={(e) => setB({ ...b, title: e.target.value })}
                />
              </label>
              <label>
                目标
                <input
                  required
                  value={b.goal}
                  onChange={(e) => setB({ ...b, goal: e.target.value })}
                />
              </label>
              <label>
                预算（元）
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={b.budgetCents / 100}
                  onChange={(e) =>
                    setB({
                      ...b,
                      budgetCents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </label>
              <label>
                业务时区
                <input
                  value={b.timezone}
                  onChange={(e) => setB({ ...b, timezone: e.target.value })}
                />
              </label>
              <label>
                开始日期
                <input
                  type="date"
                  value={b.start}
                  onChange={(e) => setB({ ...b, start: e.target.value })}
                />
              </label>
              <label>
                结束日期
                <input
                  type="date"
                  value={b.end}
                  onChange={(e) => setB({ ...b, end: e.target.value })}
                />
              </label>
            </div>
            <label>
              目标人群
              <textarea
                value={b.audience}
                onChange={(e) => setB({ ...b, audience: e.target.value })}
              />
            </label>
            <label>
              补充说明
              <textarea
                value={b.notes}
                onChange={(e) => setB({ ...b, notes: e.target.value })}
              />
            </label>
            <div className="form-actions">
              <span>保存需求会使旧内容过期。</span>
              <button className="primary" disabled={busy}>
                保存需求
              </button>
            </div>
          </form>
        ) : (
          <div className="brief-summary">
            <div>
              <small>业务目标</small>
              <strong>{ws.brief.goal}</strong>
            </div>
            <div>
              <small>计划预算</small>
              <strong>
                <Money cents={ws.brief.budgetCents} />
              </strong>
            </div>
            <div>
              <small>活动周期</small>
              <strong>
                {ws.brief.start} — {ws.brief.end}
              </strong>
            </div>
            <div>
              <small>内容渠道</small>
              <strong>{ws.brief.channels.map(channelName).join(" / ")}</strong>
            </div>
          </div>
        )}
      </section>
      <div className="section-head section-gap">
        <div>
          <h2>活动方案</h2>
          <p>
            {ws.mode === "fixture"
              ? "以下为预生成的样例方案，不调用真实AI。"
              : "基于已确认资料生成，并保留输入版本。"}
          </p>
        </div>
        <button className="primary" disabled={busy} onClick={onGenerate}>
          <Sparkles size={16} />
          {ws.mode === "fixture" ? "查看示例方案" : "生成活动方案"}
        </button>
      </div>
      {stale && (
        <div className="callout warning">
          输入已更新，本方案基于旧资料，需要重新生成。
        </div>
      )}
      {ws.strategy ? (
        <>
          <section className="strategy-intro">
            <span className="eyebrow">CAMPAIGN DIRECTION</span>
            <h2>{ws.strategy.data.summary}</h2>
          </section>
          <div className="angle-grid">
            {ws.strategy.data.angles.map((angle, i) => (
              <button
                key={angle.id}
                className={
                  "angle-card " +
                  (ws.selectedAngle === angle.id ? "selected" : "")
                }
                onClick={() => onSelect(angle.id)}
              >
                <div>
                  <span className="angle-index">0{i + 1}</span>
                  {ws.selectedAngle === angle.id && <CheckCircle2 size={19} />}
                </div>
                <h3>{angle.title}</h3>
                <p>{angle.description}</p>
                <span className="angle-metric">验证指标 / {angle.metric}</span>
                <div className="chips">
                  {angle.factIds.map((f) => (
                    <Tag key={f}>{f}</Tag>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className="two-column balanced section-gap">
            <section className="panel">
              <h2>14天执行节奏</h2>
              <div className="timeline">
                {ws.strategy.data.timeline.map((t) => (
                  <div key={t.period}>
                    <span>{t.period}</span>
                    <p>{t.action}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <h2>
                预算建议 <small className="muted">非实际支出</small>
              </h2>
              {ws.strategy.data.budget.map((b) => (
                <div className="budget-line" key={b.label}>
                  <div>
                    <span>{b.label}</span>
                    <strong>
                      <Money cents={b.cents} />
                    </strong>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${ws.brief.budgetCents ? (b.cents / ws.brief.budgetCents) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>
          </div>
          <section className="panel section-gap">
            <div className="section-head">
              <h2>假设与待确认</h2>
              <button className="primary" onClick={onContent}>
                进入内容工坊 <ArrowRight size={16} />
              </button>
            </div>
            <div className="two-column balanced">
              <div>
                <h3>需要验证的判断</h3>
                <ul className="plain-list">
                  {ws.strategy.data.assumptions
                    .concat(ws.strategy.data.audienceHypotheses)
                    .map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                </ul>
              </div>
              <div>
                <h3>信息缺口</h3>
                <ul className="plain-list">
                  {ws.strategy.data.missing.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      ) : (
        <Empty title="先生成一份有依据的方案">
          确认产品资料和活动需求后，再继续。
        </Empty>
      )}
    </>
  );
}
function ContentPage({
  ws,
  busy,
  perform,
  generate,
}: {
  ws: Workspace;
  busy: boolean;
  perform: (a: Action) => Promise<Workspace | undefined>;
  generate: (
    step: "strategy" | "xiaohongshu" | "douyin" | "analysis",
  ) => unknown;
}) {
  const [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [exportOpen, setExportOpen] = useState(false);
  const variants = ws.variants.filter(
    (v) =>
      (filter === "all" || v.channel === filter) &&
      latest(v).copy.title.includes(query),
  );
  const v = ws.variants.find((v) => v.id === selected);
  const approved = ws.variants.filter(
    (v) =>
      latest(v).status === "approved" &&
      !checkCopy(latest(v).copy, ws, v.channel, latest(v).input).some(
        (r) => r.level === "block",
      ),
  );
  return (
    <>
      <div className="content-toolbar">
        <div className="tabs">
          {[
            ["all", "全部内容"],
            ["xiaohongshu", "小红书图文"],
            ["douyin", "抖音脚本"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <label className="search">
            <Search size={15} />
            <input
              aria-label="搜索内容"
              placeholder="搜索内容标题"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            disabled={!approved.length || busy}
            onClick={() => setExportOpen(true)}
          >
            <Download size={16} />
            导出已通过内容
          </button>
        </div>
      </div>
      <div className="generation-strip">
        <div>
          <Sparkles size={18} />
          <span>
            {ws.mode === "fixture"
              ? "使用已确认资料的预生成样例"
              : "以当前已选角度生成双版本内容"}
          </span>
        </div>
        <div>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => generate("xiaohongshu")}
          >
            {ws.mode === "fixture" ? "载入图文样例" : "生成图文 A/B"}{" "}
            <Plus size={15} />
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => generate("douyin")}
          >
            {ws.mode === "fixture" ? "载入脚本样例" : "生成脚本 A/B"}{" "}
            <Plus size={15} />
          </button>
        </div>
      </div>
      {v ? (
        <>
          <button
            className="back-button"
            data-discard
            onClick={() => setSelected(null)}
          >
            ← 返回内容列表
          </button>
          <Editor
            key={latest(v).id}
            ws={ws}
            variant={v}
            busy={busy}
            perform={perform}
          />
        </>
      ) : variants.length ? (
        <div className="content-list">
          {variants.map((v) => {
            const c = latest(v),
              blocks = checkCopy(c.copy, ws, v.channel, c.input).filter(
                (r) => r.level === "block",
              );
            return (
              <article className="content-row" key={v.id}>
                <div className={"channel-square " + v.channel}>
                  {v.channel === "xiaohongshu" ? "书" : "音"}
                </div>
                <div className="content-row-main">
                  <div className="chips">
                    <small>
                      {channelName(v.channel)} / 版本 {v.label}
                    </small>
                    <Status status={c.status} />
                    {v.deliveredVersionId && <Tag>已交付</Tag>}
                    {blocks.length > 0 && (
                      <Tag tone="red">{blocks.length}项待处理</Tag>
                    )}
                  </div>
                  <h3>{c.copy.title}</h3>
                  <p>{c.copy.body.slice(0, 100)}…</p>
                  <div className="content-meta">
                    <span>
                      <BookOpen size={13} />
                      {c.copy.claims.length}条事实引用
                    </span>
                    <span>
                      <History size={13} />
                      内容 v{c.number}
                    </span>
                    <span>
                      {v.channel === "douyin" ? "30秒文本脚本" : "图文文案"}
                    </span>
                  </div>
                </div>
                <button className="secondary" onClick={() => setSelected(v.id)}>
                  编辑与审核 <ArrowUpRight size={15} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty title="这里还没有内容">
          生成或载入样例后，开始你的第一轮审核。
        </Empty>
      )}
      <div className="callout section-gap">
        <ShieldCheck size={18} />
        <span>
          “审核通过”是人的决定。系统检查引用、明确禁用表述与部分事实冲突，不能替代完整语义核对。导出只表示交付，不代表发布。
        </span>
      </div>
      {exportOpen && (
        <Modal title="导出已审核内容" onClose={() => setExportOpen(false)}>
          <p>
            本次包含 {approved.length}{" "}
            份内容。首次正式导出将锁定交付版本；之后实质改稿需复制为新变体。
          </p>
          <ul className="plain-list">
            {approved.map((v) => (
              <li key={v.id}>
                {channelName(v.channel)} {v.label} · {latest(v).copy.title}
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                await perform({
                  type: "export",
                  ids: approved.map((v) => v.id),
                  format: "csv",
                });
                setExportOpen(false);
              }}
            >
              下载 CSV
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                await perform({
                  type: "export",
                  ids: approved.map((v) => v.id),
                  format: "markdown",
                });
                setExportOpen(false);
              }}
            >
              下载 Markdown
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Editor({
  ws,
  variant: v,
  busy,
  perform,
}: {
  ws: Workspace;
  variant: Variant;
  busy: boolean;
  perform: (a: Action) => Promise<Workspace | undefined>;
}) {
  const current = latest(v),
    [copy, setCopy] = useState<Copy>(structuredClone(current.copy)),
    [note, setNote] = useState(""),
    [source, setSource] = useState<string | null>(null),
    [history, setHistory] = useState(false);
  const dirty = JSON.stringify(copy) !== JSON.stringify(current.copy);
  useUnsavedChanges(dirty);
  const rules = checkCopy(copy, ws, v.channel, current.input);
  const locked = !!v.deliveredVersionId;
  return (
    <div className="editor-grid">
      <section className="panel form-panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              {channelName(v.channel)} / VARIANT {v.label}
            </div>
            <h2>打磨表达，保留依据。</h2>
          </div>
          <Status status={current.status} />
        </div>
        {locked && (
          <div className="callout">
            此版本已交付，无法改写。
            <button
              className="text-button"
              disabled={busy}
              onClick={() => perform({ type: "fork_variant", id: v.id })}
            >
              <CopyIcon size={14} />
              复制为新变体
            </button>
          </div>
        )}
        <label>
          标题
          <input
            disabled={locked}
            value={copy.title}
            onChange={(e) => setCopy({ ...copy, title: e.target.value })}
          />
        </label>
        <label>
          正文 / 脚本概述
          <textarea
            className="body-editor"
            rows={10}
            disabled={locked}
            value={copy.body}
            onChange={(e) => setCopy({ ...copy, body: e.target.value })}
          />
        </label>
        {v.channel === "douyin" && (
          <div className="shots-editor">
            <h3>分镜与口播</h3>
            {copy.shots.map((shot, i) => (
              <div className="shot" key={i}>
                <span className="shot-time">
                  {shot.start}–{shot.end} 秒
                </span>
                <label>
                  画面
                  <textarea
                    disabled={locked}
                    rows={2}
                    value={shot.visual}
                    onChange={(e) =>
                      setCopy({
                        ...copy,
                        shots: copy.shots.map((s, j) =>
                          j === i ? { ...s, visual: e.target.value } : s,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  口播
                  <textarea
                    disabled={locked}
                    rows={2}
                    value={shot.voiceover}
                    onChange={(e) =>
                      setCopy({
                        ...copy,
                        shots: copy.shots.map((s, j) =>
                          j === i ? { ...s, voiceover: e.target.value } : s,
                        ),
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        )}
        <label>
          行动引导
          <input
            disabled={locked}
            value={copy.cta}
            onChange={(e) => setCopy({ ...copy, cta: e.target.value })}
          />
        </label>
        <label>
          话题（空格分隔）
          <input
            disabled={locked}
            value={copy.hashtags.join(" ")}
            onChange={(e) =>
              setCopy({
                ...copy,
                hashtags: e.target.value.split(/\s+/).filter(Boolean),
              })
            }
          />
        </label>
        <div className="form-actions">
          <span>
            {dirty ? "有未保存改动，保存后需重新审核。" : "当前内容已保存"}
          </span>
          <button
            className="primary"
            disabled={busy || !dirty || locked}
            onClick={() =>
              perform({
                type: "edit_content",
                id: v.id,
                versionId: current.id,
                copy,
              })
            }
          >
            保存新草稿
          </button>
        </div>
        <button
          className="text-button section-gap"
          onClick={() => setHistory(!history)}
        >
          <History size={15} />
          版本历史（{v.versions.length}）
        </button>
        {history && (
          <div className="history-versions">
            {v.versions.map((version) => (
              <details key={version.id}>
                <summary>
                  v{version.number} · {version.status} ·{" "}
                  {new Date(version.createdAt).toLocaleString("zh-CN")}
                </summary>
                <p className="preserve">{version.copy.body}</p>
                <p>
                  资料版本 {version.input.brand} / 需求版本{" "}
                  {version.input.brief}
                </p>
                <p>{version.reviewNote}</p>
              </details>
            ))}
          </div>
        )}
      </section>
      <aside className="review-sidebar">
        <section className="panel">
          <div className="section-head">
            <h3>事实依据</h3>
            <BookOpen size={17} />
          </div>
          {copy.claims.map((claim, i) => (
            <div className="citation" key={i}>
              <strong>{claim.text}</strong>
              <div>
                {claim.factIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setSource(source === id ? null : id)}
                  >
                    {id} <ArrowUpRight size={11} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {source && (
            <div className="source-box">
              <strong>{source} · 历史来源快照</strong>
              <p>
                {current.brandSnapshot.facts.find((f) => f.id === source)
                  ?.source ?? "引用不存在"}
              </p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-head">
            <h3>审核检查</h3>
            <ShieldCheck size={18} />
          </div>
          {rules.length ? (
            rules.map((r, i) => (
              <div className={"rule " + r.level} key={i}>
                <AlertCircle size={16} />
                <p>{r.message}</p>
              </div>
            ))
          ) : (
            <div className="rule pass">
              <CheckCircle2 size={17} />
              <p>自动规则未发现阻断项，仍需人工核对。</p>
            </div>
          )}
          <label>
            审核意见
            <textarea
              rows={3}
              placeholder="记录核对结论或退回原因"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={locked}
            />
          </label>
          <button
            className="primary full"
            disabled={
              busy || dirty || locked || rules.some((r) => r.level === "block")
            }
            onClick={() =>
              perform({
                type: "review",
                id: v.id,
                versionId: current.id,
                decision: "approved",
                note,
              })
            }
          >
            <Check size={16} />
            确认审核通过
          </button>
          <button
            className="secondary full"
            disabled={busy || dirty || locked || !note.trim()}
            onClick={() =>
              perform({
                type: "review",
                id: v.id,
                versionId: current.id,
                decision: "rejected",
                note,
              })
            }
          >
            退回修改
          </button>
          <small className="small-note">
            修改正文后，旧审核不会继承。交付版本保持不变。
          </small>
        </section>
      </aside>
    </div>
  );
}
function Analytics({
  ws,
  busy,
  perform,
  generate,
  tell,
  goContent,
  onExperiment,
}: {
  ws: Workspace;
  busy: boolean;
  perform: (a: Action) => Promise<Workspace | undefined>;
  generate: () => unknown;
  tell: (s: string, error?: boolean) => void;
  goContent: () => void;
  onExperiment: (analysisId: string, index: number) => unknown;
}) {
  const [fileText, setFileText] = useState(""),
    [fileName, setFileName] = useState(""),
    [preview, setPreview] = useState<CsvPreview | null>(null),
    [accepted, setAccepted] = useState(false),
    [filter, setFilter] = useState("all"),
    [from, setFrom] = useState(ws.brief.start),
    [to, setTo] = useState(ws.brief.end),
    [currentHash, setHash] = useState("");
  useEffect(() => {
    metricHash(ws).then(setHash);
  }, [ws]);
  const allRows = ws.batches.flatMap((b) => b.rows);
  const rows = allRows.filter(
      (r) =>
        (filter === "all" || r.channel === filter) &&
        r.date >= from &&
        r.date <= to,
    ),
    m = metrics(rows),
    report = ws.analyses.at(-1);
  const ready =
    ws.variants.filter(
      (v) => v.channel === "xiaohongshu" && v.deliveredVersionId,
    ).length >= 2;
  async function inspect(text: string, name: string) {
    setFileText(text);
    setFileName(name);
    setAccepted(false);
    setPreview(null);
    try {
      setPreview(await previewCsv(text, ws));
    } catch (e) {
      tell((e as Error).message, true);
    }
  }
  const metricLabels = {
    ctr: "点击率 CTR",
    cvr: "点击到订单 CVR",
    cpc: "每点击成本 CPC",
    cpa: "每订单成本 CPA",
    roas: "广告回报 ROAS",
    orders: "归因订单",
    spend: "花费",
    revenue: "销售额",
  };
  return (
    <>
      <section className="panel import-panel">
        <div className="section-head">
          <div>
            <h2>把数据带回来</h2>
            <p>固定口径：CNY · 末次点击 7 天 · 日期为点击发生日</p>
          </div>
          <button
            className="secondary"
            onClick={() =>
              saveFile(
                "campaignpilot-metrics-template.csv",
                goldenCsv(ws),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={16} />
            下载样例模板
          </button>
        </div>
        <div className="upload-area">
          <div>
            <span className="upload-symbol">
              <Upload size={23} />
            </span>
            <strong>导入你的 CSV 报表</strong>
            <p>UTF-8 · 最多 2 MB / 5,000 行 · 先预览，再提交</p>
          </div>
          <label className="primary file-button">
            <Upload size={16} />
            选择 CSV 文件
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="选择CSV文件"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  tell("文件不能超过2 MB", true);
                  return;
                }
                await inspect(await f.text(), f.name);
                e.target.value = "";
              }}
            />
          </label>
          <span className="upload-or">或</span>
          <button
            className="secondary"
            onClick={() => inspect(goldenCsv(ws), "轻行黄金样例.csv")}
          >
            预览模拟数据
          </button>
        </div>
        {!ready && (
          <div className="callout warning">
            数据需要对应已交付的内容版本。先审核并导出小红书 A/B
            两份内容，再导入样例。
            <button className="text-button" onClick={goContent}>
              去审核内容 <ArrowRight size={14} />
            </button>
          </div>
        )}
        {preview && (
          <div className="csv-preview">
            <div className="section-head">
              <h3>{fileName}</h3>
              <Tag tone={preview.errors.length ? "red" : "green"}>
                {preview.errors.length
                  ? `${preview.errors.length} 项错误`
                  : `${preview.rows.length} 行可导入`}
              </Tag>
            </div>
            {preview.errors.length > 0 ? (
              <div className="error-list">
                {preview.errors.slice(0, 20).map((e, i) => (
                  <p key={i}>
                    第 {e.row} 行 · {e.column}：{e.message}
                  </p>
                ))}
              </div>
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>变体</th>
                        <th>曝光</th>
                        <th>点击</th>
                        <th>订单</th>
                        <th>花费</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td>{r.date}</td>
                          <td>{r.variant_id}</td>
                          <td>{r.impressions.toLocaleString()}</td>
                          <td>{r.clicks}</td>
                          <td>{r.orders}</td>
                          <td>
                            <Money cents={r.spend} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.warnings.map((w, i) => (
                  <p className="warning-text" key={i}>
                    {w}
                  </p>
                ))}
                {preview.warnings.length > 0 && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    已核实警告；理解同键数据不能增量覆盖。
                  </label>
                )}
                <div className="form-actions">
                  <span>
                    {preview.duplicate
                      ? "该文件已导入，再次提交不会累计。"
                      : "确认后整批提交；任一行错误则全部拒绝。"}
                  </span>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !!preview.errors.length ||
                      (!!preview.warnings.length && !accepted)
                    }
                    onClick={async () => {
                      const updated = await perform({
                        type: "import",
                        text: fileText,
                        name: fileName,
                        warningsAccepted: accepted,
                      });
                      if (updated) setPreview(null);
                    }}
                  >
                    确认导入
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
      <div className="section-head section-gap">
        <div>
          <h2>表现概览</h2>
          <p>所有指标由确定性公式计算，非AI估算。</p>
        </div>
        <div className="filter-row">
          <select
            aria-label="筛选渠道"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">全部渠道</option>
            <option value="xiaohongshu">小红书</option>
            <option value="douyin">抖音</option>
          </select>
          <input
            aria-label="起始日期"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>—</span>
          <input
            aria-label="截至日期"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      <div className="stats-grid analytics-stats">
        <Stat
          icon={<Target size={17} />}
          label="点击率 CTR"
          value={rows.length ? display(m.ctr, "percent") : "—"}
          sub={`${m.clicks} 点击 ÷ ${m.impressions} 曝光`}
        />
        <Stat
          icon={<ArrowUpRight size={17} />}
          label="点击到订单 CVR"
          value={rows.length ? display(m.cvr, "percent") : "—"}
          sub={`${m.orders} 订单 ÷ ${m.clicks} 点击`}
        />
        <Stat
          icon={<ChartNoAxesCombined size={17} />}
          label="每订单成本 CPA"
          value={rows.length ? display(m.cpa, "money") : "—"}
          sub={`¥${(m.spend / 100).toFixed(2)} 花费 ÷ ${m.orders} 订单`}
        />
        <Stat
          icon={<Feather size={17} />}
          label="广告回报 ROAS"
          value={rows.length ? display(m.roas) + "×" : "—"}
          sub={`¥${(m.revenue / 100).toFixed(2)} 销售额 ÷ ¥${(m.spend / 100).toFixed(2)}`}
        />
      </div>
      {rows.length > 0 ? (
        <section className="panel section-gap">
          <div className="section-head">
            <h2>内容变体对比</h2>
            <Tag>按实际分子、分母汇总</Tag>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>内容变体</th>
                  <th>曝光量</th>
                  <th>CTR</th>
                  <th>CVR</th>
                  <th>CPC</th>
                  <th>CPA</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {ws.variants
                  .filter((v) => rows.some((r) => r.variant_id === v.id))
                  .map((v) => {
                    const vm = metrics(
                      rows.filter((r) => r.variant_id === v.id),
                    );
                    return (
                      <tr key={v.id}>
                        <td>
                          <strong>
                            {channelName(v.channel)} {v.label}
                          </strong>
                          <small>{latest(v).copy.title}</small>
                        </td>
                        <td>{vm.impressions.toLocaleString()}</td>
                        <td>{display(vm.ctr, "percent")}</td>
                        <td>{display(vm.cvr, "percent")}</td>
                        <td>{display(vm.cpc, "money")}</td>
                        <td>{display(vm.cpa, "money")}</td>
                        <td>
                          <span
                            className="mini-bar"
                            style={{
                              width: Math.min((vm.roas ?? 0) * 12, 90) + "px",
                            }}
                          />
                          {display(vm.roas)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <details className="formula-details">
            <summary>查看公式与数据边界</summary>
            <p>
              CTR = 点击 / 曝光；CVR = 订单 / 点击；CPC = 花费 / 点击；CPA =
              花费 / 订单；ROAS = 销售额 /
              花费。分母为0时显示N/A；汇总先加总分子和分母，不平均百分比。
            </p>
            <p>
              订单为普通归因订单，不能直接用于首购指标。上游归因仅为声明，聚合CSV无法证明归因真实性。ROAS不是净利润率。
            </p>
          </details>
        </section>
      ) : (
        <Empty title="还没有可分析的数据">
          审核并导出内容后，导入样例CSV即可查看可复算的指标。
        </Empty>
      )}
      <div className="section-head section-gap">
        <div>
          <h2>从观察，到下一次实验</h2>
          <p>复盘使用全活动已导入数据，不受上方显示筛选影响。</p>
        </div>
        <button
          className="primary"
          disabled={busy || !allRows.length}
          onClick={generate}
        >
          <Sparkles size={16} />
          {ws.mode === "fixture" ? "查看样例复盘" : "生成AI复盘"}
        </button>
      </div>
      {report ? (
        <section className="panel analysis-panel">
          <div className="section-head">
            <Tag tone={report.hash === currentHash ? "green" : "amber"}>
              {report.hash === currentHash
                ? "对应当前数据快照"
                : "旧数据快照 · 请重新生成"}
            </Tag>
            <small className="muted">
              {ws.mode === "fixture" ? "预生成样例" : "真实模型输出"} ·{" "}
              {new Date(report.createdAt).toLocaleString("zh-CN")}
            </small>
          </div>
          <div className="report-grid">
            <div>
              <span className="report-number">01 / OBSERVATIONS</span>
              <h3>可核对的观察</h3>
              {report.data.observations.map((o, i) => (
                <div className="observation" key={i}>
                  <strong>
                    {metricLabels[o.metric]}{" "}
                    <span>
                      {o.metric === "spend" || o.metric === "revenue"
                        ? "¥" + (report.metrics[o.metric] / 100).toFixed(2)
                        : o.metric === "orders"
                          ? report.metrics.orders
                          : display(
                              report.metrics[o.metric],
                              o.metric === "ctr" || o.metric === "cvr"
                                ? "percent"
                                : o.metric === "cpc" || o.metric === "cpa"
                                  ? "money"
                                  : "ratio",
                            )}
                    </span>
                  </strong>
                  <p>{o.text}</p>
                </div>
              ))}
            </div>
            <div>
              <span className="report-number">02 / HYPOTHESES</span>
              <h3>还需要验证的解释</h3>
              {report.data.hypotheses.map((h, i) => (
                <p key={i}>{h}</p>
              ))}
              <div className="callout">
                {report.data.limitations.map((x, i) => (
                  <p key={i}>{x}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="experiment-section">
            <span className="report-number">03 / NEXT EXPERIMENT</span>
            {report.data.experiments.map((e, i) => (
              <div className="experiment" key={i}>
                <div>
                  <h3>{e.title}</h3>
                  <p>
                    <strong>改变：</strong>
                    {e.change}
                  </p>
                  <p>
                    <strong>保持：</strong>
                    {e.keep}
                  </p>
                  <p>
                    <strong>指标：</strong>
                    {e.measure}
                  </p>
                  <p>
                    <strong>检查：</strong>
                    {e.check}
                  </p>
                </div>
                <button
                  className="secondary"
                  disabled={busy || report.hash !== currentHash}
                  onClick={() => onExperiment(report.id, i)}
                >
                  采用并预填下一轮需求 <ArrowUpRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="analysis-placeholder">
          <Sparkles size={24} />
          <p>数据就绪后，把观察整理成下一步可验证的行动。</p>
        </div>
      )}
      {ws.batches.length > 0 && (
        <details className="panel section-gap">
          <summary>导入记录（{ws.batches.length}）</summary>
          {ws.batches.map((b) => (
            <p key={b.id}>
              {b.name} · {b.rows.length}行 · {b.hash.slice(0, 12)} ·{" "}
              {new Date(b.createdAt).toLocaleString("zh-CN")}
            </p>
          ))}
        </details>
      )}
    </>
  );
}
function HistoryPage({ ws }: { ws: Workspace }) {
  const [remoteRuns, setRemoteRuns] = useState<
      {
        id: string;
        step: string;
        status: string;
        model: string;
        attempts: number;
        error_code: string | null;
        started_at: string;
        actual_micro_usd: number | null;
      }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (ws.mode === "live")
      api(`workspaces/${ws.id}/runs`)
        .then((d) => setRemoteRuns(d.runs))
        .catch((e) => setError(e.message));
  }, [ws.id, ws.mode, ws.revision]);
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <h2>模型执行记录</h2>
          <Tag>{ws.mode === "fixture" ? "无真实调用" : "服务端执行"}</Tag>
        </div>
        {ws.mode === "fixture" ? (
          <div className="callout">
            <Sparkles size={19} />
            <span>
              演示使用预生成响应，实际模型调用次数为 0。页面不会伪造
              token、耗时或费用。
            </span>
          </div>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : remoteRuns.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>步骤</th>
                  <th>状态</th>
                  <th>模型</th>
                  <th>尝试</th>
                  <th>估计费用 USD</th>
                  <th>诊断</th>
                </tr>
              </thead>
              <tbody>
                {remoteRuns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.step}
                      <small>{r.id.slice(0, 8)}</small>
                    </td>
                    <td>{r.status}</td>
                    <td>{r.model}</td>
                    <td>{r.attempts}</td>
                    <td>
                      {r.actual_micro_usd === null
                        ? "未知 / 保留预算"
                        : "$" + (r.actual_micro_usd / 1e6).toFixed(4)}
                    </td>
                    <td>{r.error_code ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="尚无真实模型调用">
            完成配置并生成内容后，执行记录会显示在这里。
          </Empty>
        )}
        <p className="small-note">
          超时后的外部结果可能未知；显式重试可能再次计费。应用账本不能替代供应商账单。
        </p>
      </section>
      <section className="panel section-gap">
        <div className="section-head">
          <h2>活动操作记录</h2>
          <Tag>{ws.audit.length} 条</Tag>
        </div>
        {ws.audit.length ? (
          <div className="audit-list">
            {ws.audit.map((a) => (
              <div key={a.id}>
                <span className="audit-dot" />
                <div>
                  <strong>{a.action}</strong>
                  <p>{a.detail}</p>
                </div>
                <time>{new Date(a.at).toLocaleString("zh-CN")}</time>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="从第一步开始">
            保存资料、审核或导入数据后，操作会记录在此。
          </Empty>
        )}
      </section>
    </>
  );
}
function Login({
  configured,
  onLogin,
}: {
  configured: boolean;
  onLogin: () => Promise<void>;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="wordmark">
          <span className="brand-symbol">营</span>
          <span>
            营策台<small>CAMPAIGNPILOT</small>
          </span>
        </div>
        <h1>
          让每一次创意，
          <br />
          都有依据。
        </h1>
        <p>
          从品牌资料到营销复盘，
          <br />
          一个清晰、可审核的工作空间。
        </p>
        <Backpack />
      </section>
      <section className="login-form panel">
        <Tag tone="green">真实工作空间</Tag>
        <h2>欢迎回来</h2>
        <p>使用预先创建的账号登录。此入口不开放注册。</p>
        {!configured && (
          <div className="callout warning">
            真实模式尚未配置Supabase与服务端凭据。无需账号的演示模式已经可用。
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("login", { email, password });
              setPassword("");
              await onLogin();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            邮箱
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            密码
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="warning-text">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy || !configured}>
            登录真实模式 <ArrowRight size={16} />
          </button>
        </form>
        <a className="text-button" href="/">
          先体验公开演示 <ArrowUpRight size={16} />
        </a>
        <small className="small-note">
          模型密钥只在服务端读取，不在浏览器中保存。
        </small>
      </section>
    </div>
  );
}
