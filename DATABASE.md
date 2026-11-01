# DATABASE.md — Apexoria Content Co-pilot

**Source of truth for:** the complete data model, constraints, access control and operational data concerns.
**Derived from:** `PRD.md` v1.0 (§13 Data requirements, §12 Roles) and `ARCHITECTURE.md` v1.0 (§5 Database, §6 Auth, §13 Security).
**Scope:** MVP (v1).

---

## 1. Design philosophy

The product's single real failure mode is **bad rows** — a half-generated content item, a news post with a fabricated source, three items on one day, a "posted" record with no timestamp. Users never see a race condition or a slow query at this volume; they absolutely see wrong content.

So the schema is built on one rule:

> **Illegal states are made unrepresentable by the database, not merely avoided by the application.**

Every invariant the PRD states in prose is enforced as a constraint, a unique index, or a trigger. The application layer validates too (`ARCHITECTURE.md` §9.3), but the database is the layer that cannot be bypassed by a bug, a bad migration, a console session, or a future contributor who does not know the rules.

### What this schema deliberately does *not* do

| Avoided | Reason |
|---|---|
| A `users` or `profiles` table | Supabase manages `auth.users`. Content belongs to the business, not to a person (`PRD §12`). Copying user rows would create a sync problem for zero benefit |
| `user_id` ownership columns | There is one role with full capability. Ownership columns would imply an authorization model that does not exist |
| Denormalised counters (`item_count`, `posted_count`) | Derivable by `COUNT(*)` over hundreds of rows. A cached count is a bug waiting to drift — this is a **deliberate deviation from `ARCHITECTURE.md` §5.2**, which listed `item_count` on `content_plans` |
| A separate `queue` or `jobs` table | `content_items.status = 'idea'` *is* the queue (`ARCHITECTURE.md` A2) |
| Soft-delete flags | Nothing is deleted in v1. `skipped` is a product state, not a deletion |
| Partitioning, materialised views, sharding | ~720 content rows per year. Premature by three orders of magnitude |
| Per-platform or per-format child tables | Format-specific payloads differ in shape, not in lifecycle. One table with a validated `jsonb` body is simpler and keeps every query single-table |
| Storing AI prompts or raw model responses | `prompt_version` gives reproducibility (`NFR-7.2`) without storing large, sensitive-adjacent blobs |

---

## 2. Database technology

| Aspect | Choice |
|---|---|
| Engine | **PostgreSQL 15+**, hosted on **Supabase** (free tier) |
| Access | Supabase client (PostgREST) from the Next.js server runtime only |
| Authentication source | Supabase Auth (`auth.users`), Google provider |
| Authorization | **Row Level Security**, deny-by-default, on every table |
| Schema | All application objects in `public` |
| Extensions | `pgcrypto` (for `gen_random_uuid()`) — the only extension required |
| Migrations | Forward-only SQL files applied via the Supabase CLI |
| Type generation | Supabase CLI generates TypeScript types consumed by `server/db/` |

**Why Postgres rather than a document store:** this data is deeply relational and invariant-heavy. Roughly a dozen rules in `PRD §13` map directly onto `CHECK`, `UNIQUE` and foreign-key constraints. A document database would push every one of those into application code, which is exactly the outcome §1 rejects.

---

## 3. Entity relationship

### 3.1 Diagram

```
                    ┌────────────────────┐
                    │  brand_profile     │   singleton (id = 1)
                    │  ────────────────  │   generation context;
                    │  no FKs            │   intentionally unlinked
                    └────────────────────┘

┌────────────────────┐
│  content_plans     │   one row per planned month
│  PK id             │
│  UQ plan_month     │
└─────────┬──────────┘
          │ 1
          │          ON DELETE SET NULL
          │          (plans are disposable; items are not)
          │ 0..n
┌─────────▼──────────────────────────────┐
│  content_items                         │   the core entity
│  PK id                                 │
│  FK plan_id    → content_plans.id      │
│  UQ (scheduled_date, slot)             │ ◄── enforces max 2/day
└─────────┬───────────────────────┬──────┘
          │ 1                     │ 1
          │ 0..n                  │ 0..n
┌─────────▼──────────┐  ┌─────────▼──────────┐
│  activity_log      │  │  generation_runs   │
│  PK id             │  │  PK id             │
│  FK content_item_id│  │  FK content_item_id│  nullable:
│  APPEND-ONLY       │  │  ON DELETE SET NULL│  month/news runs
└────────────────────┘  └────────────────────┘  have no item


┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│  daily_tips        │  │  news_items        │  │  rate_limits       │
│  PK id             │  │  PK id             │  │  PK (actor_key,    │
│  UQ tip_date       │  │  UQ url_hash       │  │      action_key,   │
│                    │  │                    │  │      window_start) │
│  no FKs            │  │  no FKs            │  │  no FKs            │
└────────────────────┘  └────────────────────┘  └────────────────────┘
```

### 3.2 Relationship rationale

| Relationship | Cardinality | Delete rule | Why |
|---|---|---|---|
| `content_plans` → `content_items` | 1 : 0..n | `SET NULL` | A plan is a generation *event*; the items are the asset. Deleting a failed plan record must never cascade into deleting content |
| `content_items` → `activity_log` | 1 : 0..n | `CASCADE` | Audit history is meaningless without its item. Items are never deleted in v1, so this never fires |
| `content_items` → `generation_runs` | 1 : 0..n | `SET NULL` | Run records are operational telemetry and must survive independently; month-plan and news-ingest runs have no item at all |

**`news_items` is intentionally not foreign-keyed to `content_items`.** Sources are denormalised into `content_items.source_refs` as a `jsonb` snapshot at generation time. This is the one place duplication is correct: a source must remain exactly as it was cited even after the feed row is pruned by retention (`FR-3.3`). A foreign key would either block pruning or silently break citations — both worse than a frozen copy.

**`brand_profile` has no relationships by design.** It is generation *input*, captured into each item's `prompt_version`. Linking it would wrongly imply that editing the brand profile retroactively changes existing content, which `US-16 AC3` explicitly forbids.

---

## 4. Enumerated types

Native Postgres enums rather than `CHECK (x IN (...))`.

> **Deviation from `ARCHITECTURE.md` §5.2**, which specified `CHECK` constraints. Native enums are chosen because the Supabase CLI generates them as TypeScript string-literal unions, so `platform`, `format`, `pillar` and `status` become compile-time-checked types flowing straight into the Zod schemas. `CHECK` constraints generate as plain `string`, losing that safety at precisely the boundary where `ARCHITECTURE.md` §9.3 needs it most.
>
> **Cost of this choice:** adding a value requires `ALTER TYPE ... ADD VALUE`, which cannot run inside a transaction block alongside other DDL. Any migration adding an enum value must contain *only* that statement. Removing a value requires a type rebuild. Given these five sets are stable product vocabulary defined in `PRD §6`, that trade is correct.

```sql
create type public.platform          as enum ('instagram', 'linkedin', 'whatsapp');

create type public.content_format    as enum ('carousel', 'reel', 'post', 'story', 'meme', 'poll');

create type public.content_pillar    as enum (
  'salesforce_tips', 'salesforce_news', 'memes', 'interview_questions',
  'success_stories', 'course_promos', 'career_guidance',
  'behind_the_scenes', 'myth_busting', 'polls_engagement'
);

create type public.content_status    as enum ('idea', 'ready', 'posted', 'skipped');

create type public.plan_status       as enum ('pending', 'generating', 'complete', 'failed');

create type public.run_kind          as enum (
  'month_skeleton', 'item_hydration', 'item_regeneration', 'daily_tip', 'news_ingest'
);

create type public.run_status        as enum ('running', 'success', 'partial', 'failed');

create type public.activity_action   as enum (
  'created', 'hydrated', 'regenerated', 'status_changed', 'note_added'
);
```

`content_pillar` values map 1:1 to `PRD §6.1`. `content_status` values map 1:1 to `FR-7.1`.

---

## 5. Tables

### 5.1 `brand_profile`

Singleton holding the generation context (`PRD §13`, `FR-8`).

```sql
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
```

| Column | Purpose |
|---|---|
| `id` | Pinned to `1`. A `CHECK` makes a second row impossible, which is stronger and simpler than a partial unique index |
| `tone_*` | Per-platform voice rules (`D12`) — separate columns because all three are always needed and always distinct |
| `do_list` / `dont_list` | `text[]` because `DESIGN.md §8` edits them as removable chips, not free text |
| `links` | `jsonb` — an open-ended set of social/website URLs with no query requirements |
| `updated_by` | Attribution only (§8.2) |

### 5.2 `content_plans`

One row per planned month — a record of the generation event (`FR-2.1`).

```sql
create table public.content_plans (
  id              uuid         primary key default gen_random_uuid(),
  plan_month      date         not null unique,
  status          plan_status  not null default 'pending',
  model           text,
  prompt_version  text,
  generated_at    timestamptz,
  created_at      timestamptz  not null default now(),

  constraint content_plans_month_is_first_day
    check (plan_month = date_trunc('month', plan_month)::date),
  constraint content_plans_generated_at_consistent
    check ((status = 'complete') = (generated_at is not null))
);
```

- `plan_month` is `UNIQUE` — this is what makes month planning **idempotent** (`FR-5.3`). A concurrent or repeated planning attempt fails on the unique constraint rather than producing a duplicate month.
- The first-day `CHECK` eliminates an entire class of off-by-one bug where `2026-11-15` and `2026-11-01` are treated as different months.

### 5.3 `content_items`

The core entity. Every other table exists to support, audit or feed it.

```sql
create table public.content_items (
  id                 uuid            primary key default gen_random_uuid(),
  plan_id            uuid            references public.content_plans(id) on delete set null,

  -- scheduling
  scheduled_date     date            not null,
  slot               smallint        not null,

  -- classification
  platform           platform        not null,
  format             content_format  not null,
  pillar             content_pillar  not null,

  -- phase 1: skeleton
  idea               text            not null,

  -- phase 2: hydrated payload
  title              text,
  hook               text,
  caption            text,
  body               jsonb,
  hashtags           text[]          not null default '{}',
  cta                text,
  design_brief       jsonb,
  source_refs        jsonb           not null default '[]'::jsonb,

  -- lifecycle
  status             content_status  not null default 'idea',
  posted_at          timestamptz,
  posted_by          text,
  skip_reason        text,

  -- generation metadata
  regenerated_count  smallint        not null default 0,
  prompt_version     text,
  generation_error   text,
  hydrated_at        timestamptz,

  created_at         timestamptz     not null default now(),
  updated_at         timestamptz     not null default now(),

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
```

#### Notable design decisions

**`slot` + `UNIQUE (scheduled_date, slot)` instead of a counting trigger.**
`ARCHITECTURE.md` §5.2 proposed a `BEFORE INSERT` trigger that rejects a third item on a date. **This schema replaces that with a unique constraint, and the change is a correctness fix, not a style preference.** A counting trigger runs `SELECT count(*)` and then inserts; two concurrent transactions can both read `1` and both insert, yielding three rows. A unique index is enforced by the storage engine and cannot be raced. It is also faster, self-documenting, and gives the planner a free composite index on `(scheduled_date, slot)` that serves the Today, Calendar and anti-repetition queries.

**`idea` is `NOT NULL`; everything else from phase 2 is nullable.**
This is the two-phase generation model (`ARCHITECTURE.md` §4.3) expressed in the schema. A skeleton row is valid and useful with only an idea. The `content_items_usable_is_hydrated` constraint then guarantees that the moment a row claims to be `ready` or `posted`, it is *completely* hydrated — making a half-generated item visible to a user physically impossible.

**The news-sourcing constraint is the product's credibility control.**
`PRD` risk `R2` ("factually wrong Salesforce claims damage credibility") is rated High. `FR-3.5` and `US-12` require sources. Enforcing it as a `CHECK` means a sourceless news item cannot reach a user even if the prompt, the Zod schema and the service layer all fail simultaneously.

**Format/platform compatibility encoded as a constraint.**
`PRD §6.2` defines which formats are valid on which platform. A reel on LinkedIn is not a product decision to be re-litigated in a code review — it is rejected by the database.

### 5.4 `daily_tips`

Internal marketing tips (`D10`, `FR-4`).

```sql
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
```

`UNIQUE (tip_date)` enforces `FR-4.1` ("exactly one tip per calendar day") and makes tip generation idempotent — the daily cron can run twice with no duplicate.

### 5.5 `news_items`

Ingested grounding data (`FR-3`).

```sql
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
```

- `url_hash` is the SHA-256 hex digest of the **normalised** URL (lowercased host, tracking parameters stripped, trailing slash removed). Hashing the normalised form — rather than making `url` itself unique — means the same article arriving from two feeds with different `utm_*` parameters deduplicates correctly (`FR-3.2`).
- `char(64)` is fixed-width and therefore self-validating as a SHA-256 digest.
- The `http(s)` `CHECK` is a cheap guard against a malformed feed injecting a `javascript:` or `data:` URL that would later be rendered as a tappable source link (`DESIGN.md §6.3`).

### 5.6 `activity_log`

Append-only audit trail (`FR-7.4`, `US-14`).

```sql
create table public.activity_log (
  id               bigint           generated always as identity primary key,
  content_item_id  uuid             not null
                     references public.content_items(id) on delete cascade,
  action           activity_action  not null,
  from_value       text,
  to_value         text,
  actor_email      text,
  note             text,
  created_at       timestamptz      not null default now()
);
```

- `actor_email` is `NULL` for system actions (cron-driven hydration and generation). A null actor unambiguously means "the system", with no sentinel value to misinterpret.
- `from_value` / `to_value` are `text` rather than the `content_status` enum because `action` covers more than status changes (`regenerated`, `note_added`). Typing them to one enum would be wrong for the other actions.
- `bigint identity` rather than `uuid`: this is the only table that grows monotonically and is always read in insertion order. A sequential key is smaller, better clustered and naturally ordered.

Append-only is enforced in two independent ways — see §7.4.

### 5.7 `generation_runs`

Operational telemetry (`NFR-3.4`, `NFR-6.4`). The sole observability mechanism in v1, since `NFR-2.10` rules out third-party APM.

```sql
create table public.generation_runs (
  id                 bigint       generated always as identity primary key,
  kind               run_kind     not null,
  status             run_status   not null default 'running',
  target_month       date,
  content_item_id    uuid         references public.content_items(id) on delete set null,
  model              text,
  prompt_version     text,
  input_tokens       integer,
  output_tokens      integer,
  estimated_cost_usd numeric(10, 6),
  items_processed    smallint     not null default 0,
  error              text,
  started_at         timestamptz  not null default now(),
  finished_at        timestamptz,

  constraint generation_runs_finished_after_started
    check (finished_at is null or finished_at >= started_at),
  constraint generation_runs_terminal_has_finished
    check (status = 'running' or finished_at is not null),
  constraint generation_runs_failure_has_reason
    check (status <> 'failed' or error is not null)
);
```

`numeric(10,6)` for cost — never a float. Sub-cent precision matters when `NFR-6.3` depends on these numbers for spend control, and binary floating point is the wrong tool for money.

`generation_runs_failure_has_reason` guarantees that a failed run is always diagnosable. A failure with a null error is the single worst thing an observability table can contain.

### 5.8 `rate_limits`

AI spend control (`NFR-2.7`, `NFR-6.3`, `DR-5`).

```sql
create table public.rate_limits (
  actor_key     text         not null,
  action_key    text         not null,
  window_start  timestamptz  not null,
  count         integer      not null default 0,
  updated_at    timestamptz  not null default now(),

  primary key (actor_key, action_key, window_start),
  constraint rate_limits_count_non_negative check (count >= 0)
);
```

- `actor_key` is a user email, or the literal `'global'` for the system-wide cap.
- The composite primary key *is* the lookup index; no secondary index is needed or created.
- This table has **no RLS policies at all** (§7.3) — it is reachable only through a `SECURITY DEFINER` function, so a user can neither read nor tamper with their own quota.

---

## 6. Indexes

Indexes are derived from the actual queries the journeys in `PRD §7` generate — not from guessing at future access patterns.

### 6.1 Scale context

| Table | Steady-state size |
|---|---|
| `content_items` | ~60/month → **~720/year** |
| `activity_log` | ~3 per item → **~2,000/year** |
| `news_items` | rolling window, **~500 at any time** |
| `daily_tips` | **365/year** |
| `generation_runs` | ~40/day → **~15,000/year** |

**At this volume Postgres will sequential-scan most of these tables faster than it could use an index.** Every index below therefore has to justify itself on a basis other than raw volume: either it backs a correctness-critical constraint, or it keeps a hot-path query plan stable as the table grows over years.

### 6.2 Query-to-index mapping

| # | Query | Journey | Index |
|---|---|---|---|
| Q1 | Today's items for a date, ordered by slot | J1 | `content_items_date_slot_unique` |
| Q2 | Month range for the calendar + progress ring | J1, J4 | `content_items_date_slot_unique` (range scan) |
| Q3 | Hydration queue: `status='idea'` by date, limited | Cron §4.3 | `idx_content_items_hydration_queue` |
| Q4 | Create queue: `status in ('idea','ready')` by date | J2 | `idx_content_items_work_queue` |
| Q5 | Archive: posted, newest first | J5 | `idx_content_items_posted` |
| Q6 | Anti-repetition: posted in last 60 days | `FR-2.5` | `idx_content_items_posted` |
| Q7 | Recent news for grounding, newest first | `FR-3.4` | `idx_news_items_published` |
| Q8 | Dedupe on ingest | `FR-3.2` | `news_items_url_hash_key` (unique) |
| Q9 | Today's tip | `US-4` | `daily_tips_tip_date_key` (unique) |
| Q10 | Activity for one item, newest first | `US-14` | `idx_activity_log_item` |
| Q11 | Recent runs for the Settings log | S8 | `idx_generation_runs_recent` |
| Q12 | Rate-limit lookup | `NFR-2.7` | `rate_limits_pkey` |

Q1–Q11 have typed server-only read helpers. Q12 is an index mapping for the atomic quota operation, **not an authenticated SELECT API**: the policy matrix below intentionally denies quota reads. AI phases must use `consume_rate_limit`, never add a direct authenticated lookup to satisfy a query checklist.

### 6.3 Definitions

```sql
-- Q3: the hydration queue. Partial, so it indexes only pending work
-- and shrinks to near-zero rows once a month is fully hydrated.
create index idx_content_items_hydration_queue
  on public.content_items (scheduled_date)
  where status = 'idea';

-- Q4: the designer's work queue (Create screen).
create index idx_content_items_work_queue
  on public.content_items (scheduled_date)
  where status in ('idea', 'ready');

-- Q5, Q6: archive listing and the 60-day anti-repetition lookback.
create index idx_content_items_posted
  on public.content_items (posted_at desc)
  where status = 'posted';

-- Q7: news grounding, newest first. NULLS LAST because published_at
-- is nullable when a feed omits a date.
create index idx_news_items_published
  on public.news_items (published_at desc nulls last);

-- Q10: audit trail for a single item.
create index idx_activity_log_item
  on public.activity_log (content_item_id, created_at desc);

-- Q11: the Settings run log.
create index idx_generation_runs_recent
  on public.generation_runs (started_at desc);

-- FK support: avoids a sequential scan when a content_plans row is
-- deleted and plan_id must be nulled across items.
create index idx_content_items_plan
  on public.content_items (plan_id)
  where plan_id is not null;
```

### 6.4 Deliberately absent

| Not indexed | Why |
|---|---|
| `content_items.platform`, `.format`, `.pillar` | Used only as **filters on an already-narrow result set** (a month, or the queue). Postgres filters 60 rows in microseconds. Three low-cardinality indexes would slow every write for no measurable read gain |
| `content_items.status` alone | Always paired with a date ordering; the partial indexes above are strictly better |
| `activity_log.actor_email` | No query filters by actor in v1. Would be added only if a per-user audit view ships |
| `generation_runs.kind` / `.status` | The Settings log reads the most recent N rows unfiltered |
| Any `jsonb` GIN index | Nothing queries *inside* `body`, `design_brief` or `source_refs`. They are read whole and rendered. A GIN index would add significant write cost for a capability the product does not have |

Partial indexes are used throughout because they stay small permanently: `idx_content_items_hydration_queue` holds only un-hydrated rows and typically contains a handful of entries, regardless of how many years of content accumulate.

---

## 7. Ownership, authorization and RLS

### 7.1 The authorization model

`PRD §12` defines exactly one role: an authenticated, allowlisted team member with full capability. The schema reflects this honestly:

> **Policies check *authentication*, never ownership.** Content belongs to Apexoria Learning, not to the person who happened to be signed in. `posted_by`, `actor_email` and `updated_by` are **attribution, not authorization** — they record who acted; they never gate what anyone may do.

Keeping those two concepts separate is what makes the future Designer role (`DR-1`) a contained change: adding a `user_roles` table and tightening mutation policies, with no attribution columns to rework.

### 7.2 Database roles

| Role | Used by | RLS |
|---|---|---|
| `anon` | Unauthenticated browser | Subject to RLS. **No policy grants it anything** → every table returns zero rows |
| `authenticated` | Signed-in team member, via Server Components and Server Actions | Subject to RLS. Policies below |
| `service_role` | The daily cron route handler **only** (`ARCHITECTURE.md` §5.3) | **Bypasses RLS.** The highest-value secret in the system |

`anon` returning nothing is the `L4` launch criterion and the final backstop in the three-layer auth model (`ARCHITECTURE.md` §6.2): even if middleware were misconfigured and a page leaked, no data follows.

### 7.3 Policy matrix

RLS is enabled on **every** table. Deny-by-default: a table with RLS enabled and no matching policy returns zero rows and rejects every write.

| Table | `authenticated` SELECT | INSERT | UPDATE | DELETE | Rationale |
|---|---|---|---|---|---|
| `brand_profile` | ✅ | ❌ | ✅ | ❌ | Seeded once; edited in Settings (`US-16`). Never created or destroyed at runtime |
| `content_plans` | ✅ | ✅ | ✅ | ❌ | Manual "Plan this month" runs as the user (`FR-5.5`) |
| `content_items` | ✅ | ✅ | ✅ | ❌ | **No delete policy — content is never deleted**; `skipped` is the product's retire path (`US-15`) |
| `daily_tips` | ✅ | ❌ | ❌ | ❌ | Read-only to users; written only by cron via `service_role` |
| `news_items` | ✅ | ❌ | ❌ | ❌ | Read needed for grounding during user-triggered planning; ingestion and pruning are cron-only |
| `activity_log` | ✅ | ✅ | ❌ | ❌ | **Append-only** (`FR-7.4`) — the absence of UPDATE/DELETE policies is the enforcement |
| `generation_runs` | ✅ | ✅ | ✅ | ❌ | Users trigger generation, so they must open and close their own run records |
| `rate_limits` | ❌ | ❌ | ❌ | ❌ | **No policies whatsoever.** Reachable only via a `SECURITY DEFINER` function |

The `rate_limits` row is the sharpest line in this table. If users could `UPDATE` their own quota rows, the spend control protecting `R4` would be self-service. Total RLS denial plus a definer function means the counter is only ever touched by trusted, audited code.

### 7.4 Append-only enforcement for `activity_log`

`ARCHITECTURE.md` §5.2 claims append-only is "a database guarantee rather than a convention". RLS alone does **not** deliver that, because `service_role` bypasses RLS entirely. Two layers are therefore required:

```sql
-- Layer 1: RLS — no UPDATE or DELETE policy exists for `authenticated`.

-- Layer 2: a trigger that also binds service_role and any superuser session.
create or replace function public.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'activity_log is append-only: % is not permitted', tg_op;
end;
$$;

create trigger activity_log_no_update
  before update on public.activity_log
  for each row execute function public.reject_mutation();

create trigger activity_log_no_delete
  before delete on public.activity_log
  for each row execute function public.reject_mutation();
```

The only sanctioned way past this is an audited migration that drops the triggers, performs the change, and recreates them — a deliberate, reviewable act rather than an accident (see §8.3).

### 7.5 Representative policies

```sql
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

-- No DELETE policy: deletion is impossible for authenticated users.

alter table public.rate_limits enable row level security;
-- Intentionally no policies at all.
```

`using (true)` is correct and intentional here — it reads "any authenticated session may see any row", which is precisely `PRD §12`. It would be misleading to dress a single-role model in ownership predicates that enforce nothing.

### 7.6 The rate-limit function

```sql
create or replace function public.consume_rate_limit(
  p_actor_key    text,
  p_action_key   text,
  p_window_start timestamptz,
  p_limit        integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.rate_limits (actor_key, action_key, window_start, count)
  values (p_actor_key, p_action_key, p_window_start, 1)
  on conflict (actor_key, action_key, window_start) do update
    set count = public.rate_limits.count + 1,
        updated_at = now()
    where public.rate_limits.count < p_limit
  returning true;
$$;

revoke all   on function public.consume_rate_limit(text, text, timestamptz, integer) from public;
grant execute on function public.consume_rate_limit(text, text, timestamptz, integer) to authenticated;
```

- **Atomic by construction.** The read, the comparison and the increment happen in a single statement, so two concurrent regenerations cannot both pass a limit of one. A read-then-write in application code could.
- Returns `true` when consumption succeeded; returns **no row** (→ `null`) when the limit is reached, which the caller maps to `RATE_LIMITED` (`ARCHITECTURE.md` §12.1).
- `set search_path = ''` is mandatory on every `SECURITY DEFINER` function. Without it, a caller can manipulate `search_path` to resolve `rate_limits` to an object they control and execute code with the definer's privileges. All object references are therefore schema-qualified.

### 7.7 Supporting triggers

```sql
-- updated_at maintenance (brand_profile, content_items)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Status transitions, per PRD §13.
-- Legal: idea→ready, ready→posted, idea|ready→skipped,
--        posted→ready (un-tick), skipped→ready.
-- A CHECK constraint cannot express this because it cannot see OLD.
create or replace function public.enforce_status_transition()
returns trigger language plpgsql as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'idea'    and new.status in ('ready', 'skipped')) or
    (old.status = 'ready'   and new.status in ('posted', 'skipped')) or
    (old.status = 'posted'  and new.status = 'ready') or
    (old.status = 'skipped' and new.status = 'ready')
  ) then
    raise exception 'illegal status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

-- Posted items are immutable with respect to content (FR-2.7, PRD §13).
-- Notes are appended to activity_log, never written back onto the item.
create or replace function public.protect_posted_content()
returns trigger language plpgsql as $$
begin
  if old.status = 'posted' and new.status = 'posted' and (
       new.hook         is distinct from old.hook
    or new.caption      is distinct from old.caption
    or new.body         is distinct from old.body
    or new.hashtags     is distinct from old.hashtags
    or new.cta          is distinct from old.cta
    or new.design_brief is distinct from old.design_brief
    or new.source_refs  is distinct from old.source_refs
  ) then
    raise exception 'content of a posted item cannot be modified';
  end if;
  return new;
end;
$$;
```

Together these make `US-11 AC3` ("regeneration is blocked on posted items") unbypassable: regeneration rewrites content fields, and the trigger refuses while `status = 'posted'`.

**Atomic status changes.** `change_content_status` (migration `0010`) locks the
target item, applies the requested status, and appends the corresponding
`activity_log` event in one database transaction. It derives `posted_by` and
the audit actor from the verified PostgREST JWT claims rather than accepting
identity from user input. This is required because separate PostgREST update
and insert requests cannot provide the transaction guarantee required by
`API.md §5.1`.

---

## 8. Sensitive data

### 8.1 What is *not* stored

| Not stored | Where it lives instead |
|---|---|
| Passwords, password hashes | Nowhere — Google OAuth only (`D3`) |
| OAuth tokens, refresh tokens, sessions | Supabase Auth internals; the app never reads them |
| Portkey keys, service-role key, `CRON_SECRET` | Environment variables only (`ARCHITECTURE.md` §11) |
| Student or audience personal data | Never collected — the product has no audience-facing data path |
| Raw prompts or raw model responses | Only `prompt_version` is kept (`NFR-7.2`) |
| Payment or financial data | Not applicable |

### 8.2 What *is* stored

The only personal data in the entire schema is the **email address of a signed-in team member**, in three attribution columns:

| Column | Purpose | Lawful basis |
|---|---|---|
| `content_items.posted_by` | Who marked an item posted (`FR-7.3`) | Legitimate interest — internal accountability |
| `activity_log.actor_email` | Who performed each logged action | Legitimate interest — audit trail |
| `brand_profile.updated_by` | Who last edited the brand profile | Legitimate interest |

Scope: fewer than ten internal team members (`A1`). No audience, customer or student data is held, which keeps this schema out of scope for most data-protection obligations that would otherwise apply.

**Email is stored denormalised as `text`, not as a foreign key to `auth.users`.** This is intentional: the audit trail must survive a user being removed from `auth.users` (`PRD §12` — access is revoked by removing the Google account). A foreign key would either block removal or orphan the history. An immutable string snapshot is the correct choice for an audit record.

### 8.3 Content-level privacy

`DR-2` proposes that `success_stories` use placeholder names by default. That is a **generation policy, not a schema control** — it is enforced in the prompt layer and in the brand profile's `dont_list`, since the database cannot distinguish a real name from a pseudonym.

The schema's contribution is `US-16`: real names appear only when a team member explicitly enters them into `brand_profile`, making the entry of personal data a deliberate, attributable act (`updated_by`).

### 8.4 Erasure path

`activity_log` is append-only by trigger (§7.4), which is a genuine conflict with an erasure request. The sanctioned procedure is explicit and audited:

1. An administrator authors a migration that drops the two append-only triggers.
2. The migration overwrites `actor_email`, `posted_by` and `updated_by` for the subject with a tombstone such as `removed-user@apexoria.invalid`.
3. The migration recreates the triggers.
4. The migration is committed, so the erasure is itself part of the permanent record.

This is deliberately inconvenient. Append-only loses its meaning if routine code can bypass it; making erasure a reviewed migration preserves the guarantee while keeping a lawful path open.

### 8.5 Transport and at-rest

- TLS enforced on all connections; Supabase encrypts at rest.
- Database credentials never reach the browser — `anon` key only, and it is powerless without a session (§7.2).
- No `jsonb` column stores anything user-identifying; `body`, `design_brief` and `source_refs` contain only generated marketing content and public URLs.

---

## 9. Migrations

### 9.1 Strategy

Forward-only SQL files in `supabase/migrations/`, applied via the Supabase CLI, numbered by timestamp. No down-migrations: a mistake is corrected by a new forward migration, which is honest about the fact that a down-migration is rarely tested and never run under pressure.

### 9.2 Ordering within the initial migration set

```
0001_extensions.sql        pgcrypto
0002_enums.sql             the eight enum types (§4)
0003_tables.sql            all eight tables with inline constraints
0004_indexes.sql           §6.3
0005_functions.sql         touch_updated_at, enforce_status_transition,
                           protect_posted_content, reject_mutation,
                           consume_rate_limit
0006_triggers.sql          bind the functions to tables
0007_rls.sql               enable RLS + every policy (§7.3)
0008_grants.sql            function grants/revokes
0009_seed_brand_profile.sql
0010_change_content_status.sql
                           atomically update status + append audit event
```

Separating `0007_rls.sql` is deliberate: RLS gets its own reviewable diff, so "did this release change who can see what?" is answerable by looking at one file.

#### Hosted development migrations through GitHub Actions

No local database is required to deploy migrations. The manually dispatched
[manual migration workflow](./.github/workflows/migrate-development.yml)
targets only `hkexglskvqaaeouvfdwm`. Under the temporary owner-approved exception
in `ARCHITECTURE.md` §15.1, this project serves both preview and the live site.
Treat it as production; its original development label is not an isolation
guarantee.

Keep the GitHub environment `supabase-development` (a legacy name) with these secrets:

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token belonging to an
  authorized account with access to the shared project.
- `SUPABASE_DB_PASSWORD`: the shared project's database password,
  not its publishable key or service-role key.

Restrict that environment to the repository default branch and configure
required reviewers where the repository's GitHub plan supports them. The
workflow also rejects other branches, has read-only repository permissions,
pins its actions and CLI, and serializes runs without cancelling an active
migration.

Run it first with `apply_migrations` unchecked to inspect migration history
and the dry-run output. Run again with both `apply_migrations` and
`acknowledge_shared_target` checked to apply reviewed pending forward migrations.
The acknowledgement is required because changes affect the live site.
It never runs `db reset` or `--include-seed`; migration
`0009` seeds the brand profile, but the synthetic development fixtures remain
excluded.

After applying, the workflow runs
[read-only database checks](./scripts/verify-database.sql) over the development
session pooler with TLS required by the client's `PGSSLMODE=require`.
The same `psql` session prints `\conninfo` before running the checks.
PostgreSQL's `pg_stat_ssl` describes the pooler-to-database connection, not
the client's TLS connection to the pooler, so it is not used to validate
client transport encryption. These check table/RLS presence, forbidden
policies, function permissions, audit triggers, and the brand singleton.
These deployment checks do not replace behavioral integration tests.
No other hosted target or automatic push/pull-request trigger is configured.

#### Isolated behavioral tests and generated types

[Database CI](./.github/workflows/database-tests.yml) starts PostgreSQL 15 on the
GitHub runner, applies all migrations in throwaway databases, and runs the schema
and fixture suites. It uses no hosted Supabase credentials. Local runs may skip
when PostgreSQL is unavailable; CI requires the database and fails if unreachable.
Test and type-generation URLs must use loopback hosts without query overrides.

The concurrency test uses ten distinct PostgreSQL connections, not ten queued
queries on one connection. Supabase CLI 2.122.0 generates
`src/server/db/database.types.ts` from a separate migrated scratch database.
The generated file is formatted with the existing Prettier configuration and
committed as the query contract, never hand-edited. Both user and middleware
clients use its `Database` generic; validated JSON/RPC results still pass through
Zod at the external-data boundary.
CI rejects drift and uploads the file as the `database-types` artifact; retrieve
that artifact after a migration when local generation is unavailable.
`npm run db:types:ci` runs this generator on a runner with the CLI and Docker;
`npm run db:types` remains the local Supabase equivalent.

### 9.3 Rules

| Rule | Why |
|---|---|
| **A new table ships with its RLS policies in the same release** | A table with RLS enabled and no policy silently returns nothing; a table *without* RLS enabled silently returns everything. The second is a breach. This is a release blocker (`ARCHITECTURE.md` §5.4) |
| **Enum value additions get their own migration file, alone** | `ALTER TYPE ... ADD VALUE` cannot be combined with other DDL in one transaction (§4) |
| **Expand → migrate → contract for breaking changes** | Add the new column, backfill, switch code, drop the old column in a later release. Keeps application rollback safe at all times |
| **Every migration is backward-compatible within its release** | `ARCHITECTURE.md` §15.2 applies migrations *before* deploying dependent code; the old code must survive the new schema |
| **No destructive DDL in v1** | No `DROP COLUMN`, no `DROP TABLE`, no `TRUNCATE`. Given §10, destructive changes are effectively irreversible |
| **Constraints are added `NOT VALID` then validated** on populated tables | Avoids a long exclusive lock |
| **Migrations are tested against a seeded isolated database** before production | Local Supabase or the GitHub Actions PostgreSQL service (`ARCHITECTURE.md` §14.2); never the shared hosted project |

### 9.4 Seeding

**Production seed — `brand_profile` only, idempotent:**

```sql
insert into public.brand_profile (
  id, business_name, business_description, audience_description,
  courses, tone_instagram, tone_linkedin, tone_whatsapp, do_list, dont_list, links
) values (1, 'Apexoria Learning', /* … real Apexoria content … */ )
on conflict (id) do nothing;
```

`ON CONFLICT DO NOTHING` makes re-running the migration safe and guarantees a re-run never overwrites edits the team has made in Settings.

Seeding real brand content is a `PRD §17` release-checklist item, because generation quality (`R1`) depends on it almost entirely. An empty brand profile produces exactly the generic, off-brand content the product exists to avoid.

**Development seed — additionally:**
- ~20 `news_items` with realistic Salesforce titles and valid URLs.
- One `content_plans` row plus a full month of `content_items` spanning every status, platform, format and pillar — deliberately including edge cases the UI must handle: an overdue unposted item, a day with zero items, a day with two, a skipped item, and a sourceless non-news item.
- 30 days of `daily_tips`.

Development seed data is never applied to production and lives outside the numbered migration sequence.

While Supabase is shared, development fixtures run only in isolated CI databases.
The hosted test site therefore has no synthetic browsable month. The existing
seed uses a rolling 31-day window (today minus 21 through today plus 9) to keep
overdue, today, empty-day, and upcoming states available across calendar
boundaries; it is deterministic relative to the database date. JSON payload
validation against the domain schemas remains a Phase 5 responsibility.

---

## 10. Backup and recovery

### 10.1 The actual risk

> **Verified: the Supabase Free plan includes no automated backups and no point-in-time recovery.** Supabase's own documentation directs free-tier users to export their data manually. Paid plans add daily backups (7-day retention on Pro), with PITR as a separate add-on.

`PRD` `NFR-6.1` requires the stack to run on free tiers. Taken literally, that means **an accidental `DROP TABLE` or a bad migration against production is unrecoverable** — losing the content calendar, and more painfully the permanent archive that `US-14` promises to retain indefinitely.

This is the most significant operational gap in the v1 design, and it is a consequence of a cost constraint rather than an oversight. It is documented here rather than buried.

### 10.2 Mitigations already in the schema

These reduce the likelihood of data loss but do nothing about recovery:

| Control | Protects against |
|---|---|
| No `DELETE` policy on any table | Accidental or malicious deletion through the application |
| Append-only `activity_log` | History rewriting |
| `protect_posted_content` trigger | Overwriting archived content |
| Forward-only, non-destructive migrations (§9.3) | Schema accidents |
| `skipped` instead of delete | The product never needs a destructive path |

Within normal operation, the application has **no way to destroy data**. The exposure is operator error and platform failure.

### 10.3 Recommended backup approach for v1

A weekly scheduled export, costing nothing:

```
GitHub Actions (weekly cron)
  → pg_dump against the production database (read-only credential)
  → gzip + encrypt
  → store as an Actions artifact with 90-day retention,
    or push to a private repository / object store
```

Characteristics:

| Property | Value |
|---|---|
| **RPO** (max data loss) | Up to 7 days |
| **RTO** (time to restore) | ~1 hour — provision a project, restore the dump, repoint environment variables |
| **Cost** | Zero |
| **Coverage** | Full schema and data; excludes Supabase Auth internals |

A 7-day RPO is defensible for this product: content is regenerable from the AI, the brand profile is small, and the genuinely irreplaceable asset — the posted archive — grows slowly. Losing up to a week of "marked posted" ticks is an annoyance, not a disaster.

### 10.4 Recommendation

> **Upgrade to Supabase Pro before the archive becomes valuable.** Daily automated backups with 7-day retention reduce RPO from 7 days to 24 hours and remove the need to operate a bespoke dump pipeline. The trigger point is when the posted archive represents more effort than it would cost to recreate — realistically, after about three months of consistent use, which is precisely when metrics `M6`/`M7` are being evaluated.

Until then, the weekly export in §10.3 is the minimum responsible position, and it should ship with v1 rather than being deferred.

### 10.5 Restore procedure

1. Provision a new Supabase project.
2. Apply migrations `0001`–`0008` (schema, functions, triggers, RLS).
3. Restore data from the most recent dump, **excluding** the brand-profile seed to avoid a conflict.
4. Verify: RLS enabled on all eight tables; `anon` returns zero rows; append-only triggers present.
5. Repoint `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
6. Re-register the Google OAuth redirect URI for the new project.
7. Run the daily cron manually and confirm a clean `generation_runs` row.

Step 4 is not optional. A restore that silently loses RLS turns a recovery into a data breach.

### 10.6 Free-tier pausing

Supabase pauses free projects after a period of inactivity. The once-daily cron (`ARCHITECTURE.md` §4.5) touches the database every day, so the project stays active as a side effect of normal operation. Worth knowing, because it means **cron failing silently for a week is a double failure** — no content *and* a paused database. The in-app failure banner (`ARCHITECTURE.md` §12.3) is what prevents that going unnoticed.

---

## 11. Verification checklist

Release gates for the data layer, mapping to `PRD §17`.

- [ ] All eight tables created; migrations apply cleanly to an empty database
- [ ] RLS **enabled** on all eight tables (`L4`)
- [ ] `anon` returns zero rows from every table — tested explicitly
- [ ] `rate_limits` has no policies; direct access as `authenticated` fails
- [ ] `consume_rate_limit` is `SECURITY DEFINER` with `search_path = ''`
- [ ] A third insert on one `scheduled_date` fails on the unique constraint
- [ ] A `ready` item missing `caption`, `body` or `design_brief` is rejected
- [ ] A `ready` `salesforce_news` item with empty `source_refs` is rejected
- [ ] A reel on LinkedIn is rejected
- [ ] WhatsApp item with hashtags is rejected
- [ ] `status = 'posted'` without `posted_at`/`posted_by` is rejected
- [ ] Illegal status transitions raise (e.g. `idea → posted`, `skipped → posted`)
- [ ] Content fields of a posted item cannot be updated
- [ ] `UPDATE` and `DELETE` on `activity_log` both raise
- [ ] Concurrent `consume_rate_limit` calls never exceed the limit
- [ ] Re-running the daily cron creates no duplicate tips, plans or news rows
- [ ] Supabase type generation succeeds and matches the Zod schemas
- [ ] Backup workflow runs and produces a restorable dump (§10.3)
- [ ] Restore procedure rehearsed once against a scratch project (§10.5)

---

**Preceded by:** `PRD.md` — product requirements · `DESIGN.md` — visual and interaction design · `ARCHITECTURE.md` — system architecture.
