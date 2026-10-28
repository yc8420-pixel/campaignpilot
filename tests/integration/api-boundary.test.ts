import { it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { handler } from "../../src/server/api";
afterEach(() => vi.unstubAllEnvs());
it("anonymous workspace access is rejected before configuration or data lookup", async () => {
  const res = await handler(
    new NextRequest("http://localhost:3000/api/workspaces"),
  );
  expect(res.status).toBe(401);
  expect(await res.json()).toMatchObject({ code: "UNAUTHENTICATED" });
});
it("cross-origin writes are refused before any business action", async () => {
  const res = await handler(
    new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      headers: { origin: "https://untrusted.example" },
    }),
  );
  expect(res.status).toBe(403);
});
it("missing credentials clearly disables real mode without disclosing values", async () => {
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  const res = await handler(
    new NextRequest("http://localhost:3000/api/status"),
  );
  expect(await res.json()).toEqual({
    configured: false,
    aiEnabled: false,
    mode: "live",
  });
  expect(res.headers.get("cache-control")).toContain("no-store");
});
it("bad JSON is a controlled error", async () => {
  const res = await handler(
    new NextRequest("http://localhost:3000/api/login", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: "{invalid",
    }),
  );
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ code: "JSON" });
});
