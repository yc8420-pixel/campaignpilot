import { createClient } from "@supabase/supabase-js";
import { DomainError, Workspace } from "../domain/types";
export const configured = () =>
  Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY,
  );
export function publicClient() {
  if (!configured())
    throw new DomainError(
      "NOT_CONFIGURED",
      "真实模式尚未配置Supabase；公开演示可正常使用。",
      503,
    );
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function adminClient() {
  if (!configured())
    throw new DomainError("NOT_CONFIGURED", "数据库未配置", 503);
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function dbError(message: string): never {
  const code = [
    "NOT_FOUND",
    "REVISION_CONFLICT",
    "IDEMPOTENCY_CONFLICT",
    "ALREADY_RUNNING",
    "QUOTA",
    "DEADLINE_OR_ATTEMPTS",
  ].find((c) => message.includes(c));
  const info: Record<string, [number, string]> = {
    NOT_FOUND: [404, "资源不存在"],
    REVISION_CONFLICT: [409, "数据已改变，请刷新后重试"],
    IDEMPOTENCY_CONFLICT: [409, "相同幂等键对应不同请求"],
    ALREADY_RUNNING: [409, "本活动已有生成任务"],
    QUOTA: [429, "已达到调用或费用额度"],
    DEADLINE_OR_ATTEMPTS: [409, "执行预算已结束"],
  };
  if (code) throw new DomainError(code, info[code][1], info[code][0]);
  throw new DomainError(
    "DATABASE_ERROR",
    "数据库操作失败，请按请求编号检查服务端配置。",
    503,
  );
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await adminClient().rpc(name, args);
  if (error) dbError(error.message);
  return data;
}
export async function getWorkspace(
  user: string,
  id: string,
): Promise<Workspace> {
  const { data, error } = await adminClient()
    .from("workspaces")
    .select("state")
    .eq("owner_id", user)
    .eq("id", id)
    .maybeSingle();
  if (error) dbError(error.message);
  if (!data) throw new DomainError("NOT_FOUND", "活动不存在", 404);
  return data.state as Workspace;
}
