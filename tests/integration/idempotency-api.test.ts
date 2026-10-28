import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeSeed } from "../../src/domain/seed";
import { hash, DomainError } from "../../src/domain/types";
import { PROMPT_VERSION } from "../../src/ai/provider";
const db = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("../../src/server/db", () => ({
  configured: () => true,
  publicClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-a" } } }) },
  }),
  adminClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: db.maybeSingle,
      };
      return chain;
    },
  }),
  getWorkspace: db.getWorkspace,
  rpc: db.rpc,
  dbError: (m: string) => {
    throw new Error(m);
  },
}));
import { handler } from "../../src/server/api";
let s = makeSeed("live");
const key = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  s = makeSeed("live");
  s.revision = 4;
  db.getWorkspace.mockResolvedValue(s);
  vi.stubEnv("AI_ALLOWED_USER_IDS", "user-a");
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  vi.stubEnv("AI_MODEL", "test-model");
});
afterEach(() => vi.unstubAllEnvs());
function request(revision = 3) {
  return new NextRequest(
    `http://localhost:3000/api/workspaces/${s.id}/generate`,
    {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: "cp_access=opaque-test-token",
      },
      body: JSON.stringify({
        step: "strategy",
        key,
        expectedRevision: revision,
      }),
    },
  );
}
it("replay after completion returns existing result even when the workspace revision advanced", async () => {
  db.maybeSingle.mockResolvedValue({
    data: {
      id: "completed-run",
      workspace_id: s.id,
      request_hash: await hash({
        id: s.id,
        step: "strategy",
        revision: 3,
        model: "test-model",
        prompt: PROMPT_VERSION,
      }),
      status: "succeeded",
      deadline_at: "2026-01-01",
    },
    error: null,
  });
  const res = await handler(request());
  expect(res.status).toBe(200);
  expect((await res.json()).run).toMatchObject({
    id: "completed-run",
    claimed: false,
    status: "succeeded",
  });
  expect(db.rpc).not.toHaveBeenCalled();
});
it("same key with different input is a conflict before any provider call", async () => {
  db.maybeSingle.mockResolvedValue({
    data: {
      id: "existing",
      workspace_id: s.id,
      request_hash: "different",
      status: "succeeded",
    },
    error: null,
  });
  const res = await handler(request(4));
  expect(res.status).toBe(409);
  expect((await res.json()).code).toBe("IDEMPOTENCY_CONFLICT");
  expect(db.rpc).not.toHaveBeenCalled();
});
it("foreign workspace is rejected at the ownership boundary before run lookup", async () => {
  db.getWorkspace.mockRejectedValue(
    new DomainError("NOT_FOUND", "活动不存在", 404),
  );
  expect((await handler(request())).status).toBe(404);
  expect(db.maybeSingle).not.toHaveBeenCalled();
  expect(db.rpc).not.toHaveBeenCalled();
});
it("null create-workspace input is a controlled validation error", async () => {
  const res = await handler(
    new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: "cp_access=opaque-test-token",
      },
      body: "null",
    }),
  );
  expect(res.status).toBe(422);
  expect(db.rpc).not.toHaveBeenCalled();
});
