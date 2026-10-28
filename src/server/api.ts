import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  publicClient,
  adminClient,
  configured,
  getWorkspace,
  rpc,
  dbError,
} from "./db";
import { DomainError, hash, inputVersion, now } from "../domain/types";
import { makeSeed } from "../domain/seed";
import {
  transition,
  applyGenerated,
  experimentWorkspace,
} from "../domain/logic";
import { metricHash } from "../domain/analytics";
import {
  generate,
  ProviderFailure,
  PROMPT_VERSION,
  Step,
} from "../ai/provider";
const COOKIE = "cp_access";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function body(req: NextRequest, max = 2300000) {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > max)
    throw new DomainError("PAYLOAD", "请求内容超限", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("JSON", "请求格式无效", 400);
  }
}
async function user(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) throw new DomainError("UNAUTHENTICATED", "请先登录真实模式", 401);
  const { data, error } = await publicClient().auth.getUser(token);
  if (error || !data.user)
    throw new DomainError("UNAUTHENTICATED", "会话已过期，请重新登录", 401);
  return data.user;
}
function positiveEnv(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new DomainError("CONFIG", "费用或配额配置无效", 503);
  return n;
}
export async function handler(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const path = req.nextUrl.pathname.replace(/^\/api\//, "").split("/");
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (!origin || origin !== req.nextUrl.origin)
        throw new DomainError("ORIGIN", "请求来源不匹配", 403);
    }
    if (path[0] === "status")
      return json({
        configured: configured(),
        aiEnabled:
          process.env.AI_ENABLED === "true" &&
          Boolean(process.env.OPENAI_API_KEY && process.env.AI_MODEL),
        mode: "live",
      });
    if (path[0] === "login" && req.method === "POST") {
      const input = z
        .object({
          email: z.string().email().max(200),
          password: z.string().min(1).max(200),
        })
        .parse(await body(req, 3000));
      const { data, error } =
        await publicClient().auth.signInWithPassword(input);
      if (error || !data.session)
        throw new DomainError("LOGIN", "邮箱或密码不正确，或账号未创建", 401);
      const res = json({ user: { id: data.user.id, email: data.user.email } });
      res.cookies.set(COOKIE, data.session.access_token, {
        httpOnly: true,
        secure: req.nextUrl.protocol === "https:",
        sameSite: "strict",
        path: "/",
        maxAge: Math.min(data.session.expires_in, 3600),
      });
      return res;
    }
    if (path[0] === "logout" && req.method === "POST") {
      const res = json({ ok: true });
      res.cookies.set(COOKIE, "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
        sameSite: "strict",
      });
      return res;
    }
    const actor = await user(req);
    if (path[0] === "workspaces" && path.length === 1) {
      if (req.method === "GET") {
        const { data, error } = await adminClient()
          .from("workspaces")
          .select("state")
          .eq("owner_id", actor.id)
          .order("updated_at", { ascending: false });
        if (error) dbError(error.message);
        return json({ workspaces: data?.map((d) => d.state) ?? [] });
      }
      if (req.method === "POST") {
        const input = z
          .object({
            sourceId: z.string().uuid(),
            analysisId: z.string(),
            index: z.number().int().min(0).max(4),
            expectedRevision: z.number().int(),
          })
          .optional();
        const raw = z
          .record(z.string(), z.unknown())
          .parse(await body(req, 3000));
        const source = Object.keys(raw).length ? input.parse(raw) : undefined;
        let seed = makeSeed("live");
        if (source) {
          const parent = await getWorkspace(actor.id, source.sourceId);
          if (parent.revision !== source.expectedRevision)
            throw new DomainError(
              "REVISION_CONFLICT",
              "原活动已更新，请刷新",
              409,
            );
          seed = await experimentWorkspace(
            parent,
            source.analysisId,
            source.index,
          );
        }
        return json(
          {
            workspace: await rpc("cp_create_workspace", {
              p_user: actor.id,
              p_state: seed,
            }),
          },
          201,
        );
      }
    }
    if (path[0] === "workspaces" && path[1]) {
      const id = z.string().uuid().parse(path[1]);
      const state = await getWorkspace(actor.id, id);
      if (path.length === 2 && req.method === "GET")
        return json({ workspace: state });
      if (path[2] === "mutate" && req.method === "POST") {
        const raw = z
          .object({
            expectedRevision: z.number().int().nonnegative(),
            action: z.unknown(),
          })
          .parse(await body(req));
        if (raw.expectedRevision !== state.revision)
          throw new DomainError(
            "REVISION_CONFLICT",
            "数据已更新，请刷新后重试",
            409,
          );
        const result = await transition(state, raw.action);
        if (result.workspace.revision === state.revision) return json(result);
        await rpc("cp_save_workspace", {
          p_user: actor.id,
          p_id: id,
          p_expected: state.revision,
          p_state: result.workspace,
        });
        return json(result);
      }
      if (path[2] === "generate" && req.method === "POST") {
        const input = z
          .object({
            step: z.enum(["strategy", "xiaohongshu", "douyin", "analysis"]),
            key: z.string().uuid(),
            expectedRevision: z.number().int().nonnegative(),
          })
          .parse(await body(req, 3000));
        const allowed = (process.env.AI_ALLOWED_USER_IDS ?? "")
          .split(",")
          .map((s) => s.trim());
        if (!allowed.includes(actor.id))
          throw new DomainError("FORBIDDEN", "此账号未获真实AI调用权限", 403);
        if (
          process.env.AI_ENABLED !== "true" ||
          !process.env.OPENAI_API_KEY ||
          !process.env.AI_MODEL
        )
          throw new DomainError(
            "AI_DISABLED",
            "真实AI尚未启用；请查看配置说明",
            503,
          );
        // Resolve a completed idempotency key before checking the now-advanced revision.
        const requestHash = await hash({
          id,
          step: input.step,
          revision: input.expectedRevision,
          model: process.env.AI_MODEL,
          prompt: PROMPT_VERSION,
        });
        const { data: existing, error: lookupError } = await adminClient()
          .from("ai_runs")
          .select("id,workspace_id,request_hash,status,deadline_at")
          .eq("owner_id", actor.id)
          .eq("idempotency_key", input.key)
          .maybeSingle();
        if (lookupError) dbError(lookupError.message);
        if (existing) {
          if (
            existing.workspace_id !== id ||
            existing.request_hash !== requestHash
          )
            throw new DomainError(
              "IDEMPOTENCY_CONFLICT",
              "同一请求编号不能用于不同输入",
              409,
            );
          return json({
            workspace: state,
            run: {
              ...existing,
              claimed: false,
              status:
                existing.status === "running" &&
                Date.parse(existing.deadline_at) < Date.now()
                  ? "unknown"
                  : existing.status,
            },
          });
        }
        if (state.revision !== input.expectedRevision)
          throw new DomainError("REVISION_CONFLICT", "输入已改变，请刷新", 409);
        if (
          (input.step === "xiaohongshu" || input.step === "douyin") &&
          (!state.strategy ||
            state.strategy.input.brand !== state.brandRevision ||
            state.strategy.input.brief !== state.briefRevision)
        )
          throw new DomainError("STRATEGY", "请先生成当前资料对应的活动方案");
        if (input.step === "analysis" && !state.batches.length)
          throw new DomainError("NO_DATA", "请先导入指标数据");
        const reserve = positiveEnv("AI_RESERVATION_MICRO_USD", 100000);
        const run = await rpc("cp_claim_run", {
          p_user: actor.id,
          p_id: id,
          p_key: input.key,
          p_hash: requestHash,
          p_step: input.step,
          p_model: process.env.AI_MODEL,
          p_call_limit: positiveEnv("AI_DAILY_CALL_LIMIT", 20),
          p_budget: positiveEnv("AI_DAILY_BUDGET_MICRO_USD", 2000000),
          p_reserve: reserve,
        });
        if (!run.claimed)
          return json({ workspace: await getWorkspace(actor.id, id), run });
        const start = Date.now();
        let result: Awaited<ReturnType<typeof generate>> | undefined;
        let cost: number | null = null;
        try {
          result = await generate(
            state,
            input.step as Step,
            { apiKey: process.env.OPENAI_API_KEY, model: process.env.AI_MODEL },
            () => rpc("cp_record_attempt", { p_user: actor.id, p_run: run.id }),
          );
          const inputPrice = Number(process.env.AI_INPUT_USD_PER_MILLION),
            outputPrice = Number(process.env.AI_OUTPUT_USD_PER_MILLION);
          if (
            result.inputTokens !== null &&
            result.outputTokens !== null &&
            process.env.AI_INPUT_USD_PER_MILLION &&
            process.env.AI_OUTPUT_USD_PER_MILLION &&
            Number.isFinite(inputPrice) &&
            Number.isFinite(outputPrice) &&
            inputPrice >= 0 &&
            outputPrice >= 0
          )
            cost = Math.ceil(
              result.inputTokens * inputPrice +
                result.outputTokens * outputPrice,
            );
          const updated = applyGenerated(
            state,
            input.step,
            result.output,
            inputVersion(state),
            input.step === "analysis" ? await metricHash(state) : undefined,
          );
          updated.runs.unshift({
            id: run.id,
            step: input.step,
            status: "succeeded",
            mode: "live",
            model: process.env.AI_MODEL,
            promptVersion: PROMPT_VERSION,
            createdAt: now(),
            durationMs: Date.now() - start,
            attempts: result.attempts,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            error: null,
          });
          const finished = await rpc("cp_finish_run", {
            p_user: actor.id,
            p_run: run.id,
            p_status: "succeeded",
            p_expected: state.revision,
            p_state: updated,
            p_cost: cost,
            p_usage: {
              input: result.inputTokens,
              output: result.outputTokens,
              requestId: result.requestId,
              pricingDate: process.env.AI_PRICING_DATE ?? null,
            },
            p_error: null,
          });
          return json({
            workspace: await getWorkspace(actor.id, id),
            run: finished,
          });
        } catch (e) {
          const uncertain = e instanceof ProviderFailure && e.uncertain;
          const code = e instanceof DomainError ? e.code : "OUTPUT_VALIDATION";
          await rpc("cp_finish_run", {
            p_user: actor.id,
            p_run: run.id,
            p_status: uncertain ? "unknown" : "failed",
            p_expected: state.revision,
            p_state: null,
            p_cost: cost,
            p_usage: result
              ? { input: result.inputTokens, output: result.outputTokens }
              : null,
            p_error: code,
          });
          throw e;
        }
      }
      if (path[2] === "runs" && req.method === "GET") {
        const { data, error } = await adminClient()
          .from("ai_runs")
          .select(
            "id,step,status,model,attempts,usage,error_code,started_at,deadline_at,finished_at,actual_micro_usd",
          )
          .eq("owner_id", actor.id)
          .eq("workspace_id", id)
          .order("started_at", { ascending: false });
        if (error) dbError(error.message);
        return json({
          runs: (data ?? []).map((r) => ({
            ...r,
            status:
              r.status === "running" &&
              new Date(r.deadline_at).getTime() < Date.now()
                ? "unknown"
                : r.status,
          })),
        });
      }
    }
    throw new DomainError("NOT_FOUND", "接口不存在", 404);
  } catch (e) {
    const error =
      e instanceof DomainError
        ? e
        : e instanceof z.ZodError
          ? new DomainError(
              "VALIDATION",
              e.issues
                .map((i) => i.message)
                .slice(0, 4)
                .join("；"),
            )
          : new DomainError(
              "INTERNAL",
              "请求未完成，请按请求编号检查记录",
              500,
            );
    console.error(
      JSON.stringify({ requestId, code: error.code, status: error.status }),
    );
    return json(
      { code: error.code, message: error.message, requestId },
      error.status,
    );
  }
}
