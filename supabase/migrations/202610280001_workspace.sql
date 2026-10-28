-- CampaignPilot: tenant-isolated aggregates with immutable snapshots.
-- Client roles can only SELECT their own rows. All writes use server-only RPCs.
create table public.workspaces (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 revision integer not null default 0 check(revision>=0), state jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(state->>'id'=id::text), check(state->>'mode'='live')
);
create index workspaces_owner on public.workspaces(owner_id);
create table public.workspace_revisions (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 revision integer not null, owner_id uuid not null references auth.users(id), state jsonb not null,
 created_at timestamptz not null default now(), primary key(workspace_id,revision)
);
create table public.ai_runs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 idempotency_key text not null, request_hash text not null, step text not null, model text not null,
 status text not null default 'running' check(status in ('running','succeeded','failed','unknown')),
 attempts integer not null default 0 check(attempts between 0 and 2),
 reserved_micro_usd bigint not null check(reserved_micro_usd>=0), actual_micro_usd bigint,
 usage jsonb, error_code text, started_at timestamptz not null default now(), deadline_at timestamptz not null default(now()+interval '45 seconds'),
 finished_at timestamptz, unique(owner_id,idempotency_key)
);
create unique index one_active_run on public.ai_runs(workspace_id) where status='running';
create table public.daily_usage (
 owner_id uuid not null references auth.users(id), day date not null,
 calls integer not null default 0, reserved_calls integer not null default 0,
 spent_micro_usd bigint not null default 0, reserved_micro_usd bigint not null default 0,
 primary key(owner_id,day),check(calls>=0 and reserved_calls>=0 and spent_micro_usd>=0 and reserved_micro_usd>=0)
);
alter table public.workspaces enable row level security;
alter table public.workspace_revisions enable row level security;
alter table public.ai_runs enable row level security;
alter table public.daily_usage enable row level security;
create policy own_workspaces on public.workspaces for select to authenticated using(auth.uid()=owner_id);
create policy own_history on public.workspace_revisions for select to authenticated using(auth.uid()=owner_id);
create policy own_runs on public.ai_runs for select to authenticated using(auth.uid()=owner_id);
create policy own_usage on public.daily_usage for select to authenticated using(auth.uid()=owner_id);
revoke all on public.workspaces,public.workspace_revisions,public.ai_runs,public.daily_usage from anon,authenticated;
grant select on public.workspaces,public.workspace_revisions,public.ai_runs,public.daily_usage to authenticated;
grant all on public.workspaces,public.workspace_revisions,public.ai_runs,public.daily_usage to service_role;

create function public.cp_create_workspace(p_user uuid,p_state jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_state->>'mode'<>'live' or (p_state->>'revision')::int<>0 then raise exception 'INVALID_STATE'; end if;
 insert into workspaces(id,owner_id,state) values((p_state->>'id')::uuid,p_user,p_state);
 insert into workspace_revisions(workspace_id,revision,owner_id,state) values((p_state->>'id')::uuid,0,p_user,p_state);
 return p_state;
end $$;
create function public.cp_save_workspace(p_user uuid,p_id uuid,p_expected integer,p_state jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w workspaces;
begin
 select * into w from workspaces where id=p_id and owner_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if w.revision<>p_expected then raise exception 'REVISION_CONFLICT'; end if;
 if p_state->>'id'<>p_id::text or p_state->>'mode'<>'live' or (p_state->>'revision')::int<>p_expected+1 then raise exception 'INVALID_STATE'; end if;
 update workspaces set state=p_state,revision=p_expected+1,updated_at=now() where id=p_id;
 insert into workspace_revisions(workspace_id,revision,owner_id,state) values(p_id,p_expected+1,p_user,p_state);
 return p_state;
end $$;
create function public.cp_claim_run(p_user uuid,p_id uuid,p_key text,p_hash text,p_step text,p_model text,p_call_limit integer,p_budget bigint,p_reserve bigint) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w workspaces;r ai_runs;u daily_usage;d date:=(now() at time zone 'UTC')::date;
begin
 select * into w from workspaces where id=p_id and owner_id=p_user for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into r from ai_runs where owner_id=p_user and idempotency_key=p_key;
 if found then
  if r.request_hash<>p_hash or r.workspace_id<>p_id then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  if r.status='running' and r.deadline_at<now() then update ai_runs set status='unknown',error_code='EXPIRED',finished_at=now() where id=r.id returning * into r;end if;
  return to_jsonb(r)||jsonb_build_object('claimed',false);
 end if;
 update ai_runs set status='unknown',error_code='EXPIRED',finished_at=now() where workspace_id=p_id and status='running' and deadline_at<now();
 if exists(select 1 from ai_runs where workspace_id=p_id and status='running') then raise exception 'ALREADY_RUNNING';end if;
 insert into daily_usage(owner_id,day) values(p_user,d) on conflict do nothing;
 select * into u from daily_usage where owner_id=p_user and day=d for update;
 if p_call_limit<2 or p_reserve<1 or u.calls+u.reserved_calls+2>p_call_limit or u.spent_micro_usd+u.reserved_micro_usd+p_reserve>p_budget then raise exception 'QUOTA';end if;
 update daily_usage set reserved_calls=reserved_calls+2,reserved_micro_usd=reserved_micro_usd+p_reserve where owner_id=p_user and day=d;
 insert into ai_runs(owner_id,workspace_id,idempotency_key,request_hash,step,model,reserved_micro_usd) values(p_user,p_id,p_key,p_hash,p_step,p_model,p_reserve) returning * into r;
 return to_jsonb(r)||jsonb_build_object('claimed',true);
end $$;
create function public.cp_record_attempt(p_user uuid,p_run uuid) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 update ai_runs set attempts=attempts+1 where id=p_run and owner_id=p_user and status='running' and attempts<2 and deadline_at>now() returning attempts into n;
 if not found then raise exception 'DEADLINE_OR_ATTEMPTS';end if;return n;
end $$;
create function public.cp_finish_run(p_user uuid,p_run uuid,p_status text,p_expected integer,p_state jsonb,p_cost bigint,p_usage jsonb,p_error text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r ai_runs;w workspaces;final_status text:=p_status;
begin
 -- Consistent lock order: workspace before run, as in claim_run.
 select * into r from ai_runs where id=p_run and owner_id=p_user;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into w from workspaces where id=r.workspace_id and owner_id=p_user for update;
 select * into r from ai_runs where id=p_run and owner_id=p_user for update;
 if r.status<>'running' then return to_jsonb(r);end if;
 if p_status not in('succeeded','failed','unknown') then raise exception 'INVALID_STATUS';end if;
 if p_cost is not null and p_cost<0 then raise exception 'INVALID_COST';end if;
 if p_status='succeeded' then
  if w.revision<>p_expected then final_status:='failed';p_error:='REVISION_CONFLICT';
  elsif r.deadline_at<now() then final_status:='unknown';p_error:='EXPIRED';
  else perform cp_save_workspace(p_user,w.id,p_expected,p_state);end if;
 end if;
 if p_cost is not null and final_status<>'unknown' then
  update daily_usage set reserved_calls=reserved_calls-2,calls=calls+r.attempts,reserved_micro_usd=reserved_micro_usd-r.reserved_micro_usd,spent_micro_usd=spent_micro_usd+p_cost where owner_id=p_user and day=(r.started_at at time zone 'UTC')::date;
 end if;
 update ai_runs set status=final_status,actual_micro_usd=p_cost,usage=p_usage,error_code=p_error,finished_at=now() where id=p_run returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.cp_create_workspace(uuid,jsonb),public.cp_save_workspace(uuid,uuid,integer,jsonb),public.cp_claim_run(uuid,uuid,text,text,text,text,integer,bigint,bigint),public.cp_record_attempt(uuid,uuid),public.cp_finish_run(uuid,uuid,text,integer,jsonb,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.cp_create_workspace(uuid,jsonb),public.cp_save_workspace(uuid,uuid,integer,jsonb),public.cp_claim_run(uuid,uuid,text,text,text,text,integer,bigint,bigint),public.cp_record_attempt(uuid,uuid),public.cp_finish_run(uuid,uuid,text,integer,jsonb,bigint,jsonb,text) to service_role;
