-- Admin panel (DATABASE.md §5.9–5.11, §7.3, §9.2).
--
-- Members can read only their own access row and the non-secret runtime
-- configuration. Every write to these tables happens through the server's
-- admin module with service_role, after the server re-verifies an admin
-- session; no authenticated INSERT/UPDATE policy exists, so a signed-in
-- account cannot grant itself access through the Data API.

-- ── 5.9 app_users: database-managed access list ─────────────────────────────
create table public.app_users (
  email         text         primary key,
  role          text         not null default 'member',
  is_active     boolean      not null default true,
  can_generate  boolean      not null default true,
  created_at    timestamptz  not null default now(),
  created_by    text,
  updated_at    timestamptz  not null default now(),
  updated_by    text,

  constraint app_users_email_normalized check (
    email = lower(btrim(email))
    and length(email) between 3 and 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  ),
  constraint app_users_role_valid check (role in ('member', 'admin'))
);

create trigger app_users_touch_updated_at
  before update on public.app_users
  for each row execute function public.touch_updated_at();

-- ── 5.10 app_settings: runtime overrides; NULL means "use the env default" ──
create table public.app_settings (
  id                       smallint              primary key default 1,
  ai_generation_enabled    boolean,
  regen_daily_limit        integer,
  global_daily_ai_limit    integer,
  plan_day_of_month        smallint,
  planning_horizon_months  smallint,
  ai_model                 text,
  ai_base_url              text,
  news_feed_urls           text[],
  enabled_platforms        public.platform[],
  enabled_pillars          public.content_pillar[],
  updated_at               timestamptz           not null default now(),
  updated_by               text,

  constraint app_settings_singleton check (id = 1),
  constraint app_settings_regen_limit_range
    check (regen_daily_limit is null or regen_daily_limit between 1 and 1000),
  constraint app_settings_global_limit_range
    check (global_daily_ai_limit is null or global_daily_ai_limit between 1 and 10000),
  constraint app_settings_plan_day_range
    check (plan_day_of_month is null or plan_day_of_month between 1 and 31),
  constraint app_settings_horizon_range
    check (planning_horizon_months is null or planning_horizon_months between 1 and 12),
  constraint app_settings_model_bounded
    check (ai_model is null or (ai_model = btrim(ai_model) and length(ai_model) between 1 and 200)),
  constraint app_settings_base_url_https_v1
    check (ai_base_url is null or (
      length(ai_base_url) <= 500
      and ai_base_url ~ '^https://[^/?#@[:space:]]+(/[^?#@[:space:]]*)?/v1/?$'
    )),
  constraint app_settings_feed_count
    check (news_feed_urls is null or cardinality(news_feed_urls) <= 25),
  constraint app_settings_platforms_present
    check (enabled_platforms is null or cardinality(enabled_platforms) between 1 and 3),
  -- News may be omitted when no feed has items, so three other pillars must
  -- remain for the planning rules (no adjacent-day pillar repeat) to hold.
  constraint app_settings_pillars_plannable
    check (enabled_pillars is null or (
      cardinality(enabled_pillars) <= 10
      and cardinality(array_remove(enabled_pillars, 'salesforce_news'::public.content_pillar)) >= 3
    ))
);

create trigger app_settings_touch_updated_at
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ── 5.11 prompt_instructions: append-only versions per prompt scope ─────────
-- The latest row per scope is active; an empty string clears instructions.
create table public.prompt_instructions (
  id            bigint       generated always as identity primary key,
  scope         text         not null,
  instructions  text         not null,
  created_at    timestamptz  not null default now(),
  created_by    text,

  constraint prompt_instructions_scope_valid
    check (scope in ('content', 'planning', 'daily_tip')),
  constraint prompt_instructions_bounded
    check (instructions = btrim(instructions) and length(instructions) <= 2000)
);

create or replace function public.reject_prompt_instruction_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'prompt_instructions is append-only: % is not permitted', tg_op;
end;
$$;

create trigger prompt_instructions_no_update
  before update on public.prompt_instructions
  for each row execute function public.reject_prompt_instruction_mutation();

create trigger prompt_instructions_no_delete
  before delete on public.prompt_instructions
  for each row execute function public.reject_prompt_instruction_mutation();

-- ── generation_runs.actor_email: per-user usage attribution ─────────────────
-- Derived from the caller's JWT, never from the request body; an update can
-- never rewrite it. Scheduled (service_role) runs carry no email.
alter table public.generation_runs add column actor_email text;

create or replace function public.stamp_generation_run_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.actor_email := old.actor_email;
  else
    new.actor_email := lower(nullif(btrim(
      coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email'
    ), ''));
  end if;
  return new;
end;
$$;

create trigger generation_runs_stamp_actor
  before insert or update on public.generation_runs
  for each row execute function public.stamp_generation_run_actor();

-- ── RLS (§7.3) ──────────────────────────────────────────────────────────────
alter table public.app_users enable row level security;

create policy app_users_select_self
  on public.app_users for select
  to authenticated
  using (
    email = lower(btrim(
      coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email'
    ))
  );

alter table public.app_settings enable row level security;

create policy app_settings_select
  on public.app_settings for select
  to authenticated
  using (true);

alter table public.prompt_instructions enable row level security;

create policy prompt_instructions_select
  on public.prompt_instructions for select
  to authenticated
  using (true);

-- Trigger functions are never called directly.
revoke all on function public.reject_prompt_instruction_mutation() from public, anon, authenticated;
revoke all on function public.stamp_generation_run_actor() from public, anon, authenticated;
