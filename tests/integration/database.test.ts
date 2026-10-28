import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { makeSeed } from "../../src/domain/seed";
import { Workspace } from "../../src/domain/types";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon,service_role;insert into auth.users values('${A}'),('${B}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610280001_workspace.sql", "utf8"),
  );
});
afterAll(async () => {
  await db.close();
});
async function create(owner = A) {
  await db.exec("reset role");
  const state = makeSeed("live");
  await db.query("select cp_create_workspace($1,$2)", [
    owner,
    JSON.stringify(state),
  ]);
  return state;
}
async function claim(s: Workspace, key = crypto.randomUUID(), limit = 20) {
  const q = await db.query<{
    result: { id: string; claimed: boolean; status: string };
  }>(
    "select cp_claim_run($1,$2,$3,$4,'strategy','mock-model',$5,2000000,100000) as result",
    [A, s.id, key, "hash-" + key, limit],
  );
  return q.rows[0].result;
}
describe("Postgres migrations, RLS, transactions and quota", () => {
  it("migration creates an isolated live workspace and immutable initial snapshot", async () => {
    const s = await create();
    expect(
      (
        await db.query(
          "select * from workspace_revisions where workspace_id=$1",
          [s.id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("account B and anonymous cannot select A rows; authenticated cannot write directly or call mutation RPC", async () => {
    const s = await create();
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${B}',false);`,
    );
    expect(
      (await db.query("select * from workspaces where id=$1", [s.id])).rows,
    ).toHaveLength(0);
    await expect(
      db.query("update workspaces set revision=4 where id=$1", [s.id]),
    ).rejects.toThrow();
    await expect(
      db.query("select cp_save_workspace($1,$2,0,$3)", [
        A,
        s.id,
        JSON.stringify({ ...s, revision: 1 }),
      ]),
    ).rejects.toThrow("permission");
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from workspaces")).rejects.toThrow(
      "permission",
    );
    await db.exec("reset role");
  });
  it("A can read only owned workspace; wrong-owner server mutation is rejected", async () => {
    const s = await create();
    const other = await create(B);
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${A}',false);`,
    );
    expect(
      (await db.query("select * from workspaces where id=$1", [s.id])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from workspaces where id=$1", [other.id])).rows,
    ).toHaveLength(0);
    await db.exec("reset role");
    await expect(
      db.query("select cp_save_workspace($1,$2,0,$3)", [
        B,
        s.id,
        JSON.stringify({ ...s, revision: 1 }),
      ]),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("optimistic concurrency commits a whole aggregate once and preserves previous versions", async () => {
    const s = await create();
    const next = { ...s, revision: 1, name: "saved" };
    await db.query("select cp_save_workspace($1,$2,0,$3)", [
      A,
      s.id,
      JSON.stringify(next),
    ]);
    await expect(
      db.query("select cp_save_workspace($1,$2,0,$3)", [
        A,
        s.id,
        JSON.stringify(next),
      ]),
    ).rejects.toThrow("REVISION_CONFLICT");
    expect(
      (
        await db.query(
          "select * from workspace_revisions where workspace_id=$1",
          [s.id],
        )
      ).rows,
    ).toHaveLength(2);
  });
  it("same idempotency key returns same run, altered payload conflicts, another active run blocked", async () => {
    const s = await create();
    const key = crypto.randomUUID(),
      r = await claim(s, key),
      again = await claim(s, key);
    expect(again.id).toBe(r.id);
    expect(again.claimed).toBe(false);
    await expect(
      db.query(
        "select cp_claim_run($1,$2,$3,'other','strategy','m',20,2000000,100000)",
        [A, s.id, key],
      ),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(claim(s)).rejects.toThrow("ALREADY_RUNNING");
  });
  it("atomically reserves budget and rejects over-limit calls", async () => {
    const s = await create();
    await expect(claim(s, crypto.randomUUID(), 1)).rejects.toThrow("QUOTA");
    const q = await db.query("select * from ai_runs where workspace_id=$1", [
      s.id,
    ]);
    expect(q.rows).toHaveLength(0);
  });
  it("counts attempts at most twice and publishes output with run state atomically", async () => {
    const s = await create();
    const r = await claim(s);
    for (let i = 0; i < 2; i++)
      await db.query("select cp_record_attempt($1,$2)", [A, r.id]);
    await expect(
      db.query("select cp_record_attempt($1,$2)", [A, r.id]),
    ).rejects.toThrow("DEADLINE");
    await db.query(
      "select cp_finish_run($1,$2,'succeeded',0,$3,1200,'{}',null)",
      [A, r.id, JSON.stringify({ ...s, revision: 1, name: "generated" })],
    );
    const w = await db.query<{ state: Workspace }>(
      "select state from workspaces where id=$1",
      [s.id],
    );
    expect(w.rows[0].state.name).toBe("generated");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from ai_runs where id=$1",
          [r.id],
        )
      ).rows[0].status,
    ).toBe("succeeded");
  });
  it("version conflict discards stale model output but keeps accounting and failure evidence", async () => {
    const s = await create();
    const r = await claim(s);
    await db.query("select cp_save_workspace($1,$2,0,$3)", [
      A,
      s.id,
      JSON.stringify({ ...s, revision: 1, name: "user edit" }),
    ]);
    await db.query(
      "select cp_finish_run($1,$2,'succeeded',0,$3,1000,'{}',null)",
      [A, r.id, JSON.stringify({ ...s, revision: 1, name: "stale AI" })],
    );
    expect(
      (
        await db.query<{ state: Workspace }>(
          "select state from workspaces where id=$1",
          [s.id],
        )
      ).rows[0].state.name,
    ).toBe("user edit");
    expect(
      (
        await db.query<{ error_code: string }>(
          "select error_code from ai_runs where id=$1",
          [r.id],
        )
      ).rows[0].error_code,
    ).toBe("REVISION_CONFLICT");
  });
  it("unknown outcome retains reserved cost and expired records never rerun automatically", async () => {
    const s = await create(),
      key = crypto.randomUUID(),
      r = await claim(s, key);
    await db.query(
      "update ai_runs set deadline_at=now()-interval '1 second' where id=$1",
      [r.id],
    );
    const same = await claim(s, key);
    expect(same.status).toBe("unknown");
    expect(same.claimed).toBe(false);
    const u = await db.query<{ reserved_micro_usd: number }>(
      "select reserved_micro_usd from daily_usage where owner_id=$1",
      [A],
    );
    expect(Number(u.rows[0].reserved_micro_usd)).toBeGreaterThan(0);
  });
});
