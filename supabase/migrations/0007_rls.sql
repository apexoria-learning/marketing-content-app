-- DATABASE.md §7.3, §7.5. Deny-by-default on every table: RLS enabled with no
-- matching policy returns zero rows and rejects every write.
--
-- Policies check authentication, never ownership — content belongs to the
-- business, not to the person signed in (§7.1). `using (true)` is therefore
-- correct and intentional.

-- ── brand_profile: seeded once, edited in Settings (US-16) ──────────────────
alter table public.brand_profile enable row level security;

create policy brand_profile_select
  on public.brand_profile for select
  to authenticated
  using (true);

create policy brand_profile_update
  on public.brand_profile for update
  to authenticated
  using (true) with check (true);

-- No INSERT or DELETE policy: the singleton is never created or destroyed
-- at runtime.

-- ── content_plans: manual "Plan this month" runs as the user (FR-5.5) ───────
alter table public.content_plans enable row level security;

create policy content_plans_select
  on public.content_plans for select
  to authenticated
  using (true);

create policy content_plans_insert
  on public.content_plans for insert
  to authenticated
  with check (true);

create policy content_plans_update
  on public.content_plans for update
  to authenticated
  using (true) with check (true);

-- ── content_items ───────────────────────────────────────────────────────────
alter table public.content_items enable row level security;

create policy content_items_select
  on public.content_items for select
  to authenticated
  using (true);

create policy content_items_insert
  on public.content_items for insert
  to authenticated
  with check (true);

create policy content_items_update
  on public.content_items for update
  to authenticated
  using (true) with check (true);

-- No DELETE policy: content is never deleted; `skipped` is the retire path
-- (US-15).

-- ── daily_tips: written only by cron via service_role ───────────────────────
alter table public.daily_tips enable row level security;

create policy daily_tips_select
  on public.daily_tips for select
  to authenticated
  using (true);

-- ── news_items: read for grounding; ingestion and pruning are cron-only ─────
alter table public.news_items enable row level security;

create policy news_items_select
  on public.news_items for select
  to authenticated
  using (true);

-- ── activity_log: append-only (FR-7.4) ──────────────────────────────────────
alter table public.activity_log enable row level security;

create policy activity_log_select
  on public.activity_log for select
  to authenticated
  using (true);

create policy activity_log_insert
  on public.activity_log for insert
  to authenticated
  with check (true);

-- The absence of UPDATE/DELETE policies is the enforcement for authenticated;
-- the triggers in 0006 bind service_role as well.

-- ── generation_runs: users trigger generation, so they open and close runs ──
alter table public.generation_runs enable row level security;

create policy generation_runs_select
  on public.generation_runs for select
  to authenticated
  using (true);

create policy generation_runs_insert
  on public.generation_runs for insert
  to authenticated
  with check (true);

create policy generation_runs_update
  on public.generation_runs for update
  to authenticated
  using (true) with check (true);

-- ── rate_limits: reachable only via consume_rate_limit (SECURITY DEFINER) ───
alter table public.rate_limits enable row level security;

-- Intentionally no policies at all. If users could UPDATE their own quota
-- rows, the spend control protecting R4 would be self-service.
