-- DATABASE.md §5. Every invariant stated in prose by the PRD is enforced here
-- as a constraint, so illegal states are unrepresentable rather than merely
-- avoided by the application.

-- ── 5.1 brand_profile ───────────────────────────────────────────────────────
create table public.brand_profile (
  id                    smallint     primary key default 1,
  business_name         text         not null,
  business_description  text         not null,
  audience_description  text         not null,
  courses               text[]       not null default '{}',
  current_offers        text,
  tone_instagram        text         not null,
  tone_linkedin         text         not null,
  tone_whatsapp         text         not null,
  do_list               text[]       not null default '{}',
  dont_list             text[]       not null default '{}',
  links                 jsonb        not null default '{}'::jsonb,
  updated_at            timestamptz  not null default now(),
  updated_by            text,

  constraint brand_profile_singleton
    check (id = 1),
  constraint brand_profile_links_is_object
    check (jsonb_typeof(links) = 'object')
);

-- ── 5.2 content_plans ───────────────────────────────────────────────────────
create table public.content_plans (
  id              uuid                primary key default gen_random_uuid(),
  plan_month      date                not null unique,
  status          public.plan_status  not null default 'pending',
  model           text,
  prompt_version  text,
  generated_at    timestamptz,
  created_at      timestamptz         not null default now(),

  constraint content_plans_month_is_first_day
    check (plan_month = date_trunc('month', plan_month)::date),
  constraint content_plans_generated_at_consistent
    check ((status = 'complete') = (generated_at is not null))
);

-- ── 5.3 content_items ───────────────────────────────────────────────────────
create table public.content_items (
  id                 uuid                   primary key default gen_random_uuid(),
  plan_id            uuid                   references public.content_plans(id) on delete set null,

  -- scheduling
  scheduled_date     date                   not null,
  slot               smallint               not null,

  -- classification
  platform           public.platform        not null,
  format             public.content_format  not null,
  pillar             public.content_pillar  not null,

  -- phase 1: skeleton
  idea               text                   not null,

  -- phase 2: hydrated payload
  title              text,
  hook               text,
  caption            text,
  body               jsonb,
  hashtags           text[]                 not null default '{}',
  cta                text,
  design_brief       jsonb,
  source_refs        jsonb                  not null default '[]'::jsonb,

  -- lifecycle
  status             public.content_status  not null default 'idea',
  posted_at          timestamptz,
  posted_by          text,
  skip_reason        text,

  -- generation metadata
  regenerated_count  smallint               not null default 0,
  prompt_version     text,
  generation_error   text,
  hydrated_at        timestamptz,

  created_at         timestamptz            not null default now(),
  updated_at         timestamptz            not null default now(),

  -- ── max two items per day (D9, FR-2.1) ──────────────────────────────
  constraint content_items_slot_range
    check (slot between 1 and 2),
  constraint content_items_date_slot_unique
    unique (scheduled_date, slot),

  -- ── format/platform compatibility (PRD §6.2) ────────────────────────
  constraint content_items_format_platform_valid check (
    (format = 'carousel' and platform in ('instagram', 'linkedin')) or
    (format = 'reel'     and platform =  'instagram')               or
    (format = 'post'     and platform in ('instagram', 'linkedin')) or
    (format = 'story'    and platform in ('instagram', 'whatsapp')) or
    (format = 'meme'     and platform in ('instagram', 'whatsapp')) or
    (format = 'poll'     and platform in ('instagram', 'linkedin'))
  ),

  -- ── a usable item is a complete item (NFR-3.2) ──────────────────────
  constraint content_items_usable_is_hydrated check (
    status in ('idea', 'skipped')
    or (hook is not null and caption is not null
        and body is not null and design_brief is not null
        and hydrated_at is not null)
  ),

  -- ── news must be sourced (FR-3.5, US-12, risk R2) ───────────────────
  constraint content_items_news_requires_sources check (
    pillar <> 'salesforce_news'
    or status in ('idea', 'skipped')
    or jsonb_array_length(source_refs) > 0
  ),

  -- ── WhatsApp Status carries no hashtags (PRD §6.3) ──────────────────
  constraint content_items_whatsapp_no_hashtags
    check (platform <> 'whatsapp' or cardinality(hashtags) = 0),

  -- ── posted bookkeeping is complete and consistent (FR-7.3) ──────────
  constraint content_items_posted_consistent check (
    (status = 'posted') = (posted_at is not null and posted_by is not null)
  ),
  constraint content_items_skip_reason_only_when_skipped
    check (status = 'skipped' or skip_reason is null),

  -- ── shape and sanity ────────────────────────────────────────────────
  constraint content_items_source_refs_is_array
    check (jsonb_typeof(source_refs) = 'array'),
  constraint content_items_body_is_object
    check (body is null or jsonb_typeof(body) = 'object'),
  constraint content_items_design_brief_is_object
    check (design_brief is null or jsonb_typeof(design_brief) = 'object'),
  constraint content_items_regen_count_non_negative
    check (regenerated_count >= 0)
);

-- ── 5.4 daily_tips ──────────────────────────────────────────────────────────
create table public.daily_tips (
  id              uuid         primary key default gen_random_uuid(),
  tip_date        date         not null unique,
  tip             text         not null,
  category        text,
  prompt_version  text,
  created_at      timestamptz  not null default now(),

  constraint daily_tips_tip_not_blank
    check (length(btrim(tip)) > 0)
);

-- ── 5.5 news_items ──────────────────────────────────────────────────────────
create table public.news_items (
  id            uuid         primary key default gen_random_uuid(),
  source        text         not null,
  title         text         not null,
  url           text         not null,
  url_hash      char(64)     not null unique,
  published_at  timestamptz,
  summary       text,
  fetched_at    timestamptz  not null default now(),

  constraint news_items_url_is_http
    check (url ~* '^https?://')
);

-- ── 5.6 activity_log ────────────────────────────────────────────────────────
create table public.activity_log (
  id               bigint                  generated always as identity primary key,
  content_item_id  uuid                    not null
                     references public.content_items(id) on delete cascade,
  action           public.activity_action  not null,
  from_value       text,
  to_value         text,
  actor_email      text,
  note             text,
  created_at       timestamptz             not null default now()
);

-- ── 5.7 generation_runs ─────────────────────────────────────────────────────
create table public.generation_runs (
  id                 bigint             generated always as identity primary key,
  kind               public.run_kind    not null,
  status             public.run_status  not null default 'running',
  target_month       date,
  content_item_id    uuid               references public.content_items(id) on delete set null,
  model              text,
  prompt_version     text,
  input_tokens       integer,
  output_tokens      integer,
  estimated_cost_usd numeric(10, 6),
  items_processed    smallint           not null default 0,
  error              text,
  started_at         timestamptz        not null default now(),
  finished_at        timestamptz,

  constraint generation_runs_finished_after_started
    check (finished_at is null or finished_at >= started_at),
  constraint generation_runs_terminal_has_finished
    check (status = 'running' or finished_at is not null),
  constraint generation_runs_failure_has_reason
    check (status <> 'failed' or error is not null)
);

-- ── 5.8 rate_limits ─────────────────────────────────────────────────────────
create table public.rate_limits (
  actor_key     text         not null,
  action_key    text         not null,
  window_start  timestamptz  not null,
  count         integer      not null default 0,
  updated_at    timestamptz  not null default now(),

  primary key (actor_key, action_key, window_start),
  constraint rate_limits_count_non_negative check (count >= 0)
);
