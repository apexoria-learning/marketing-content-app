# IMPLEMENTATION-PLAN.md — Apexoria Content Co-pilot

**Derived from:** `PRD.md` · `DESIGN.md` · `ARCHITECTURE.md` · `DATABASE.md` · `API.md` · `AGENTS.md`
**Scope:** MVP (v1). No feature, library or capability appears here that is not already specified in those documents.

---

## 1. Sequencing strategy

### 1.1 The central decision: build the product before building the AI

The obvious ordering is *schema → AI → screens*, because the AI generates the content the screens display. **That ordering is wrong**, and avoiding it is the single most important choice in this plan.

Instead: **a deterministic development seed (Phase 2) stands in for the AI, and the entire product is built and verified against it (Phases 4–7) before a single model call is written (Phase 8).**

Why:

| Benefit | Detail |
|---|---|
| **Screens become deterministic to test** | A fixture-backed Today screen has a knowable state. An AI-backed one does not. Playwright against generated content is flaky by construction |
| **Zero AI spend during the longest phase** | UI work is the bulk of the effort and would otherwise burn tokens on every reload |
| **Failures stay attributable** | When the AI arrives in Phase 8, any bug is in the AI layer, because the UI is already proven |
| **Edge cases are chosen, not awaited** | The seed deliberately contains an overdue item, an empty day, a two-item day, a skipped item and every format — states that would take weeks to occur naturally |
| **A usable product exists early** | After Phase 7 the team can plan a month manually in the database and the app works end to end |

The seed is therefore not a convenience. It is load-bearing infrastructure, and Task 2.10 is a first-class deliverable.

### 1.2 Other ordering rules

- **Quality gates come first (Phase 0).** The secret scan, strict TypeScript and lint rules must exist before there is code to violate them. Retrofitting a token-enforcement lint rule across 26 built components is far more expensive than having it from the start.
- **The Server Action wrapper lands in Phase 3**, with auth, because every later action depends on it. Building actions first and retrofitting the auth pipeline is how an unauthenticated action survives to production (`API.md` §2.3).
- **Zod domain schemas land in Phase 5**, before both the UI that renders them and the AI that produces them, so there is exactly one definition and no drift.
- **Hardening is a phase, not a step.** Phase 14 exists because `NFR-2` treats security as the primary risk, not as a cleanup task.

### 1.3 Parallel track — provisioning (start immediately)

These have external lead time and block later phases. Begin on day one, independent of Phase 0.

| Item | Blocks | Notes |
|---|---|---|
| Supabase project (dev + prod) | Phase 2 | Normally separate; temporary owner-approved sharing is documented in `ARCHITECTURE.md` §15.1. Fixtures and mutation tests remain isolated in CI |
| Google Cloud OAuth client + consent screen | Phase 3 | Test users added manually (`D3`) |
| Portkey account, API key, virtual key | Phase 8 | **User-supplied** |
| Vercel project | Phase 0 verification | Hobby tier |
| Decisions `DR-3` and `DR-7` | Phase 8/9 | Follower baselines; Salesforce feed source list. Defaults exist, so nothing blocks |

---

### 1.4 Remaining delivery groups (initialized 2026-11-01)

The user approved continuing the remaining phases in groups. Existing phase
requirements and completion gates remain authoritative; grouping does not
waive the risk checkpoints in section 3.

| Group | Phases | Deliverable | Hard stop before completion |
|---|---|---|---|
| A — Grounded AI foundation | 8–9 | Portkey client, versioned prompts, output repair/source validation, per-call accounting, safe news ingestion | Confirm Portkey routing/model and accounting configuration; owner-approved real smoke call must return valid output |
| B — Generation workflows | 10–11 | Atomic month planning, deterministic planning rules, bounded hydration/tips, capped generation actions and complete UI states | Planning validator and rollback/concurrency tests pass; J3 passes before release |
| C — Automation and owner controls | 12–13 | Failure-isolated daily job, settings/brand editing, planning trigger and readable run log | Owner approves live cron activation and real generation spend; repeat runs prove idempotent |
| D — Release hardening and recovery | 14–16 | Security/accessibility gates, deployment verification, encrypted backups and scratch restore rehearsal | Backup destination/encryption and scratch target approved; manual production/device checks and restore verification pass |

Start with Group A; proceed to later groups only after each group's gates pass.
Tests use mocked AI and isolated databases. Hosted schema changes remain
reviewed, forward-only manual migrations; no hosted resets or development seeds.
Real AI calls, live content generation, cron activation and restoration are not
implicitly authorized by initializing this plan.

Portkey reference inspected read-only: the user's InterviewPrep application uses
an OpenAI-compatible transport, config-ID routing and no SDK retries. This app
already specifies the installed Portkey SDK, virtual-key routing and gateway-owned
retries. Reuse the compatible boundary/error-handling patterns, not the other
app's dependencies, credentials or user metadata.

**Current gate:** the user subsequently provided the gateway integration example
and confirmed authorization to use it for Apexoria's application/data.
Model-alias routing supersedes the interim config-ID proposal: use the custom
HTTPS endpoint and `@dsvertex/anthropic.claude-sonnet-5-5` per API.md §8.1,
without a virtual key or config ID. Environment validation and isolated browser
configuration are updated for that setup. The server-only SDK transport now
requests non-streamed JSON, uses lowercase token limits, enforces a 60s abort
deadline, disables SDK retries, rejects incomplete/refused responses and requires
token usage instead of silently defaulting missing counts to zero. Local
validation passes: 296 tests, typecheck, lint, production build and the 59-file
client-secret scan; 84 database tests are intentionally skipped on the laptop.
Prompt composition, generated-output schemas, canonical source cross-checks,
and one repair per parse/schema/business stage are implemented. Per-call run
logging opens before the request and fails closed on telemetry errors. Cost
estimation uses integer fixed-point arithmetic with explicitly supplied pricing;
no unverified model price is hardcoded.
News parsing/fetching and repository adapters are implemented, including DNS
address pinning, private IPv4 rejection, 2 MB streamed body limits, three redirects,
one retry, RSS/Atom parsing, declaration rejection, URL deduplication, per-feed
isolation, conditional validators and caller-supplied retention. The fetcher
uses IPv4 DNS only; IPv6-only feeds fail explicitly instead of bypassing address
validation. Conditional validators are caller-owned state, not a new database
table. Live activation and persistent state wiring remain deferred to Phase 12.
Latest local gates: 329 tests pass; 84 database tests intentionally skipped;
typecheck, lint, production build and 59-file secret scan pass.
Group A cannot be signed off until feed URLs/retention and verified pricing or
gateway cost accounting are confirmed, and an explicitly approved real smoke
call passes. No new action or cron route calls these modules yet.
The owner confirmed 30-day news retention and continued mock-only testing.
`NEWS_RETENTION_DAYS` now exposes that approved default. Feed selection and
verified gateway pricing remain pending; no paid smoke test is authorized.
Verified public RSS candidates are Salesforce News
(`https://www.salesforce.com/news/feed/`) and Salesforce Ben
(`https://www.salesforceben.com/feed/`); both returned RSS during public research.
The suggested Salesforce Developers `/blogs/rss.xml` returned 404 and is not
recommended. The owner approved both verified feeds; they are now the defaults
when `NEWS_FEED_URLS` is unset. An explicitly empty value still disables feeds.
Portkey's cost-management documentation confirms model-catalog pricing and
existing per-request log/analytics cost visibility; it does not verify this
custom gateway's active rates. Pricing/retry confirmation is pending with the
authorized gateway administrator. Inspect existing InterviewPrep logs/catalog or
ask the authorized gateway administrator, without making a new AI request.
Mocked tests only remain authorized;
real calls require explicit approval, real credentials remain outside the
repository, and cost metadata/retry behavior still require verification.
No remaining phase is marked complete.

**Subsequent owner decision (2026-11-01):** verified pricing is deferred:
record tokens and run outcomes with explicitly unknown (`NULL`) cost.
The owner confirmed no gateway retries are configured; keep SDK retries
disabled and surface transport failures without automatic retries. This
supersedes the earlier pricing/retry configuration gates and original retry
requirement. No paid call is authorized; the real smoke checkpoint remains.
Unknown cost does not provide monetary spend enforcement. Fixed-point pricing
support remains available when verified rates are supplied later.

**Group B started (2026-11-01):** the owner approved proceeding with mocked
implementation while Group A's real smoke gate remains open, and activating
signed-in user generation only after Group B passes. Agent calls remain
mock-only. Approved near-duplicate rule: normalized word-set Jaccard ≥0.70
plus exact matches. When news is absent, explicitly omit that pillar and
enforce twice-monthly coverage of the other nine.

The first Group B increment implements generation input schemas, deterministic
month validation/generation with one repair, a transactional month-plan RPC,
bounded hydration orchestration and anti-repeating daily tips. Persistence
adapters, generation actions/rate limits and UI are subsequently wired below;
J3 remains pending and live generation is not active. New migration `0012` requires isolated SQL validation and
generated-type refresh before adapter wiring and manual hosted deployment.
Simulated 240-second batch tests verify 30 items at 8s/item and 20 at 12s/item;
these are not real-model throughput measurements.
The `0012` generated types were retrieved from isolated CI; SQL feature checks
passed there. The composed month service now loads safe brand/news/history
context, records model calls with unknown cost and commits via the typed RPC.
Migration `0013` prepares atomic payload/history writes, day slots and combined
daily quotas. Generated RPC types for `0013` were retrieved from the isolated CI artifact.
Item/day adapters, four authorized generation actions, atomic user/global/month
quotas, item hydration/regeneration controls and Calendar/Today planning controls
are wired. `AI_GENERATION_ENABLED=false` keeps generation disabled by default.
Unknown transport/save-confirmation outcomes require a reload before retry;
regeneration guidance and errors stay within the sheet. Posted items cannot
generate; already hydrated items do not issue another AI request. Recent posted
ideas are paginated over the entire 60-day window, not silently truncated at 120.
Feature-only validation is used per the owner's request; no paid AI call, hosted
mutation test or cron activation has occurred. The daily-tip persistence service
now returns an existing same-day tip without generating, stores validated output
once, handles concurrent date conflicts and explicitly reports AI failure while
retaining the last saved tip. Persistence failures still propagate.
The batch service is composed with typed database reads/writes and item
generation, drains oldest unfinished items within the existing 240s/30-item
bounds, and stops immediately on infrastructure/run-telemetry failures rather
than continuing unlogged calls.
Latest local feature gates: 69 mocked tests, typecheck and focused lint pass.
Four targeted browser checks pass using intercepted Server Action responses
and dummy local configuration: single automatic hydration with staged loading
and Updated confirmation, regeneration guidance/error preservation, quota reset
sheet and reload-required transport failure. The development-only gallery hosts
these opt-in examples; production still returns 404. The browser checks caught
and fixed duplicate guidance-field IDs when multiple generation controls mount.
New SQL persistence regression coverage is written but has not run locally;
this laptop has no isolated PostgreSQL. Isolated SQL validation and reviewed
hosted migrations remain open before Group B signoff/activation; cron routes are
not yet wired or activated. Hosted migrations have not been run by the agent.

**Live month-planning timeout fix (2026-11-01):** the first live Calendar
attempt failed with gateway 408 "Request exceeded the timeout sent in this
request: 60000 ms". The SDK's `requestTimeout` is forwarded as the gateway's
per-request deadline, and a whole-month plan is one non-streamed response, far
larger than an item. Month planning now uses a bounded 120s per-request deadline
(initial + one repair ≤ 240s); Calendar declares `maxDuration = 300`. Items, days
and tips keep 60s. A gateway 408 is now classified as a timeout. Actual
month-plan latency/token counts were not recorded because the request was cut
off; confirm them from the next gateway log.

**Live "AI response validation failed" fix (2026-11-01):** the SDK defaults to
sending `strict-open-ai-compliance: false`, so the gateway returned Claude's raw
`stop_reason` (`end_turn`) as `finish_reason`. The transport accepts only
OpenAI's `stop`, so every Claude reply — items, days, tips and months — was
rejected even when complete. Mocked tests had used `stop` and missed it. The
client now requests strict compliance (`end_turn → stop`, `max_tokens → length`);
truncated replies remain rejected. Validation-failure logs now include the
non-sensitive finish reason and completion-token count. The observed month reply
also used ~267-character mini-briefs (31 of 34 over 200 characters) instead of
the `one_line_idea` that ARCHITECTURE.md §4.3 specifies, so skeleton ideas are
now single-line, ≤200 characters, in both the prompt and the schema.

**Live item-generation fix and Group B completion work (2026-11-01):** month
planning now works live. Item "Generate content" failed with "Something went
wrong on our side" before any AI call: the item path passed the whole content
row to `loadGenerationContext`, which spread it into the `.strict()` context
schema, so `id`/`status`/`hook`/... raised a ZodError (`unrecognized_keys`, no
database code → `UNEXPECTED`). Month planning passed a four-field literal and
was unaffected; unit tests had mocked the loader. The loader now picks the four
slot fields explicitly; a regression test reproduces the original failure.
Because auto-hydration did not record this non-AI failure, opening unfinished
items repeatedly charged quota; that path is now fixed.
Item hydration/regeneration requests now get 120s each under a shared 240s
budget (combined with any batch caller's earlier deadline), and the item route
declares `maxDuration = 300`, matching the evidence that a 60s cap is too short
for large replies. Month planning checks horizon and existing plan before
charging quota; the control shows a non-blocking progress banner and becomes a
disabled "Month planned"/"Day planned" button after success. The item control
keeps a stable key so the gold "Updated" eyebrow survives the refresh, cross-
fades in, and fades after 2s (opacity-only under reduced motion).
Feature validation: 89 focused unit tests, 16 mocked browser checks (including
design-system axe/CSP/reduced motion), typecheck, lint and production build pass.
Phase 12 (Group C) owns cron hydration batches and daily-tip writes, which RLS
restricts to `service_role`. Remaining Group B gaps are the seeded J3 journey
and isolated SQL rollback checks running in CI, plus confirming real item
latency in the gateway log.

**Display names (2026-11-01):** at the owner's request, "Posted by" and history
attribution show the person's Google name instead of their email. Migration
`0014` adds a read-only, authenticated-only lookup over Supabase Auth metadata,
limited to people already recorded in the app; stored attribution remains email
and the UI falls back to the email when no name exists or before `0014` is
applied. The owner must apply `0014` via the manual migration workflow (dry run
first). Its generated type entry was written to match generator output and is
verified by CI's drift gate; its SQL behaviour is covered by isolated CI tests.

**Owner live confirmation (2026-11-01):** after `18c96f6` deployed, the owner
confirmed month planning and item content generation work on the live site.
This is owner-reported; the agent did not measure live latency or token usage.
The owner also reported that both latest GitHub Actions workflows (database
validation and seeded browser journeys) passed. On that owner-reported evidence,
Group B (Phases 10–11) is signed off. The owner paused before Group C; the
nightly job remains unbuilt and inactive.

**Group C scope change requested:** move automation/brand settings into the
existing admin panel at `C:\Apex\apexoria\src\admin`. Review its auth, deployment,
database and server boundaries before implementing that integration; do not
assume its authorization can replace this app's independent safeguards.
The initial review confirmed Firebase authentication in the admin frontend and
Firebase-token/server email-allowlist checks in its Vercel API, versus Supabase
sessions in Content Co-pilot. The owner approved a server-to-server bridge:
the admin backend verifies Firebase admin access, then calls a separately
protected Content Co-pilot API. Privileged database/AI credentials stay on the
Content Co-pilot server; no browser-held integration secret and no implicit
trust in the frontend's admin flag. Bridge implementation and activation remain
pending.
Groups C/D are not started and real-smoke/backup/live cron gates remain.

**In-app admin panel (2026-11-03, owner-approved).** At the owner's request an
admin panel was built **inside Content Co-pilot** (`/admin`, PRD `US-17`, S9)
instead of the external Firebase bridge, which stays unbuilt. Owner decisions:
`ADMIN_EMAILS` owners plus database-promoted admins; a database access list
replaces `ALLOWED_EMAILS` (kept only as a fallback until imported) and access
now **fails closed**; admin reads/writes use a scoped service-role module
behind a server-verified `AdminActor` (approved deviation from "service role in
cron only"); prompt management is versioned editorial instructions subordinate
to built-in rules (not full template editing); filters are planning
platforms/pillars and news feeds; runtime overrides cover AI on/off, limits,
planning day/horizon, model alias and gateway URL (the API key stays in env);
per-person AI permission and token attribution. Migration `0015` and its
generated-type entries were written to match generator output; SQL behaviour
was validated against a disposable local PostgreSQL 17 (all 100 integration
tests, including 10 new ones, pass), not yet in CI on PostgreSQL 15.
**Before deploying:** set `ADMIN_EMAILS`, apply `0015` via the manual
migration workflow (dry run first), then import `ALLOWED_EMAILS` from
`/admin/users`. Daily-tip instructions, `PLAN_DAY_OF_MONTH` and news feeds take
effect only once the Phase 12 cron exists. Cost is still recorded as unknown.

## 2. Phase map

| # | Phase | Depends on | Outcome |
|---|---|---|---|
| 0 | Project foundation | — | Empty app with every quality gate enforced |
| 1 | Design system | 0 | Tokens and primitives |
| 2 | Database and seed | 0 | Schema + deterministic fixtures |
| 3 | Authentication | 0, 2 | Sign-in, gating, action wrapper |
| 4 | App shell and PWA | 1, 3 | Navigation, installable |
| 5 | Domain model and content components | 1, 2 | Schemas + content rendering |
| 6 | Read screens | 4, 5 | All screens render from seed |
| 7 | Status tracking | 6 | **Product usable end to end** |
| 8 | AI client and prompts | 2, 5 | Validated generation of one item |
| 9 | News ingestion | 2 | Grounding data |
| 10 | Generation services | 8, 9 | Month skeleton + hydration |
| 11 | Generation actions and rate limiting | 7, 10 | User-triggered generation |
| 12 | Scheduled job | 10, 11 | Autonomous operation |
| 13 | Settings and brand profile | 7, 12 | Configuration |
| 14 | Security hardening | 11, 12, 13 | Checklists pass |
| 15 | Test completion and accessibility | 14 | All gates pass |
| 16 | Deployment | 15 | Production |

Phases 8 and 9 may run in parallel with 6 and 7 if capacity allows — they share no files.

---

## PHASE 0 — Project foundation

**Goal:** a deployable empty application in which every quality gate from `AGENTS.md` §3 is already enforced.

### Tasks

| # | Task |
|---|---|
| 0.1 | Scaffold Next.js 15 App Router, TypeScript `strict`, Tailwind v4 |
| 0.2 | ESLint + Prettier, including two custom rules: **no raw colour/px values in Tailwind arbitrary classes**, and **no non-`NEXT_PUBLIC_` env reference outside `server/`** |
| 0.3 | Vitest config (unit + integration projects) and Playwright config (mobile viewport, 390×844) |
| 0.4 | Typed, Zod-validated config module that **fails fast at boot** on a missing or malformed variable; author `.env.example` with names and comments, no values |
| 0.5 | `scripts/check-client-bundle.mjs` — scans built client output for every secret value; wire into `npm run build` |
| 0.6 | `next.config.ts`: strict CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; configure `serverActions.allowedOrigins` |
| 0.7 | Create the empty folder skeleton exactly as `ARCHITECTURE.md` §10, with a `server-only` import in each `server/` barrel |
| 0.8 | npm scripts per `AGENTS.md` §3; `.gitignore` covering `.env*`, build output, generated types |

### Files
`package.json` · `next.config.ts` · `tsconfig.json` · `eslint.config.*` · `vitest.config.ts` · `playwright.config.ts` · `.env.example` · `.gitignore` · `scripts/check-client-bundle.mjs` · `src/server/config/`

> **Amended:** this originally read `src/lib/config/`. The config module reads secrets, and `ARCHITECTURE.md` §11 restricts those to `server/` while `ARCHITECTURE.md` §10 defines `lib/` as client-safe. The module therefore lives at `src/server/config/`, split into a pure `env-schema.ts` (testable, no `server-only` import) and `env.ts` (imports `server-only`, fails fast at boot).

### Database / API changes
None.

### Tests
- Config module: rejects missing required variable, rejects malformed value, accepts a valid set.
- Secret scan: **fails** when a planted fake secret appears in client output, **passes** on a clean build. Verifying the scanner catches something is the point — an unproven scanner is worse than none.

### Completion criteria
- [ ] `typecheck`, `lint`, `test`, `build` all pass
- [ ] Secret scan proven to fail on a planted secret
- [ ] Security headers present on a Vercel preview deployment (verified over the wire)
- [ ] Both custom lint rules proven to fire
- [ ] Folder skeleton matches `ARCHITECTURE.md` §10

---

## PHASE 1 — Design system

**Goal:** every token and primitive in `DESIGN.md` exists, is token-driven, and is accessible.

### Tasks

| # | Task |
|---|---|
| 1.1 | `tokens.css` — all colour, type, spacing, radius, elevation and motion tokens (`DESIGN.md` §3–5), with the `[data-theme="light"]` remap |
| 1.2 | Map tokens into the Tailwind theme as semantic names; confirm the Phase 0 lint rule enforces them |
| 1.3 | Self-host and subset Space Grotesk, Inter, JetBrains Mono with metric-compatible fallbacks (no layout shift) |
| 1.4 | Primitives: `Button` (5 variants × 6 states), `Chip`, `Input`, `Textarea`, `SegmentedControl`, `Skeleton`, `Toast`, `BottomSheet` |
| 1.5 | `StatusTick` (spring tick draw, haptics, real checkbox semantics) and `ProgressRing` |
| 1.6 | `EmptyState`, `ErrorState`, `Banner` |
| 1.7 | Reduced-motion provider implementing every fallback in `DESIGN.md` §10.5 |
| 1.8 | Icon set — outline, 1.75px stroke, including custom-drawn platform glyphs (never pasted brand logos) |

### Prerequisites
Phase 0.

### Database / API changes
None.

### Tests
- `axe` on every primitive, including all `Button` states.
- `BottomSheet`: focus trap, Escape close, focus restoration to trigger.
- `StatusTick` exposed as a checkbox with a descriptive label.
- Reduced-motion: no transform animation runs; no functionality lost.
- Contrast: automated check of every token pair in both themes.

### Completion criteria
- [ ] No literal colour, size or duration in any component
- [ ] Both themes meet the contrast floors in `DESIGN.md` §3.4
- [ ] UI remains fully usable in greyscale
- [ ] All targets ≥ 44×44px
- [ ] `DESIGN.md` §14 checklist passes for every primitive

---

## PHASE 2 — Database and seed

**Goal:** a schema in which illegal states are unrepresentable, plus the fixtures that unblock Phases 4–7.

### Tasks

| # | Task |
|---|---|
| 2.1 | `0001_extensions.sql` — `pgcrypto` |
| 2.2 | `0002_enums.sql` — the eight enum types |
| 2.3 | `0003_tables.sql` — eight tables with every inline constraint from `DATABASE.md` §5 |
| 2.4 | `0004_indexes.sql` — the seven indexes in §6.3, no others |
| 2.5 | `0005_functions.sql` — `touch_updated_at`, `enforce_status_transition`, `protect_posted_content`, `reject_mutation`, `consume_rate_limit` |
| 2.6 | `0006_triggers.sql` — bind functions, including both `activity_log` append-only triggers |
| 2.7 | `0007_rls.sql` — enable RLS on all eight tables plus every policy; `rate_limits` gets **none** |
| 2.8 | `0008_grants.sql` — revoke `consume_rate_limit` from public, grant to `authenticated` |
| 2.9 | `0009_seed_brand_profile.sql` — **real Apexoria content**, idempotent via `ON CONFLICT DO NOTHING` |
| 2.10 | **Development seed script** — a deterministic month of `content_items` covering every platform, format, pillar and status, and deliberately including: an overdue unposted item, an empty day, a two-item day, a skipped item, an un-hydrated `idea` item; plus ~20 `news_items` and 30 `daily_tips` |
| 2.11 | Wire Supabase TypeScript type generation into the workflow |

### Prerequisites
Phase 0; Supabase dev project provisioned.

**Approved temporary environment exception (2026-11-01):** the hosted project is
shared until the owner requests a split. Phase 2 fixtures and mutation tests must
run in isolated GitHub Actions PostgreSQL, never on hosted Supabase. No local
database installation is permitted on the office laptop. The existing seed is a
rolling 31-day fixture window so its UI edge cases remain available year-round.
This does not seed the live site; hosted fixture browsing is deferred.

### Database changes
All of them. This phase *is* the schema.

### Tests
The full `DATABASE.md` §11 list, notably:
- `anon` returns zero rows from all eight tables.
- Third insert on one `scheduled_date` fails on the unique constraint.
- `ready` item missing `caption`/`body`/`design_brief` rejected.
- `ready` `salesforce_news` item with empty `source_refs` rejected.
- Reel on LinkedIn rejected; WhatsApp item with hashtags rejected.
- Illegal status transitions raise; posted content cannot be updated.
- `UPDATE` and `DELETE` on `activity_log` both raise.
- `consume_rate_limit` never exceeds the limit under concurrency.

### Completion criteria
- [x] Migrations apply cleanly to an empty isolated CI database
- [x] Phase 2 schema, RLS, constraint, trigger and concurrency gates from `DATABASE.md` §11 pass in CI
- [x] Supabase CLI-generated types compile and type both database client factories; CI checks drift
- [x] Dev seed supplies the rolling fixture window and all required edge cases in isolated CI databases
- [x] Brand profile seeded with genuine Apexoria content, not placeholders

Hosted fixture browsing is deferred under the approved shared-database exception.
The cron-idempotency, backup and restore release gates in `DATABASE.md` §11 remain
for their later implementation phases; the schema suites check row uniqueness
but do not claim to exercise a cron handler that does not yet exist.

> **Gate:** do not start Phase 6 until 2.10 produces data rich enough to exercise every state in `DESIGN.md` §9.2.

---

## PHASE 3 — Authentication

**Goal:** nothing is reachable without an allowlisted Google session, and the pipeline every future action depends on exists.

### Tasks

| # | Task |
|---|---|
| 3.1 | Supabase client factories in `server/db/` — server, middleware, and a separately named cron service-role factory; no browser client (approved correction: server-only access and HTTP-only sessions) |
| 3.2 | `middleware.ts` — session refresh and redirect for protected routes |
| 3.3 | `/auth/callback` — PKCE exchange, allowlist check, **session destruction on denial**, open-redirect defence on `next` |
| 3.4 | `(app)/layout.tsx` — independent session + allowlist re-verification (the real gate) |
| 3.5 | **Server Action wrapper** — the six-step pipeline from `API.md` §4.2 and the result envelope from §4.1 |
| 3.6 | `/sign-in` and `/no-access` screens per `DESIGN.md` §13 (S1, S2) |

### Prerequisites
Phases 0, 2; Google OAuth client provisioned.

### Database / API changes
No schema change. Implements `API.md` §3.1.

### Tests
- Unauthenticated request to every protected route redirects to `/sign-in`.
- `next` rejects `//evil.com`, `/\evil.com`, `https://evil.com`; accepts `/calendar`.
- Non-allowlisted sign-in **destroys the session**, then redirects.
- Wrapper unit tests: each of the six steps short-circuits with the correct code.
- An action without a session returns `UNAUTHENTICATED`, never throws.

### Completion criteria
- [x] Sign-in works end to end with a real Google account (owner confirmed on 2026-11-01; recheck after deploying Phase 3 changes)
- [x] Allowlist denial and local session destruction verified in callback, middleware and action tests
- [x] No content visible pre-login; protected-route redirects and independent layout checks pass
- [x] Wrapper enforces session and allowlist independently of middleware
- [x] Implemented auth-related items in `API.md` §13 pass automated tests; future cron endpoints remain out of this phase

**Manual deployment gate:** after these changes are deployed, verify login,
sign-out, and a non-allowlisted Google account on the live domain. No second
account or hosted allowlist is changed automatically. Do not consider the live
denial check complete based only on mocked tests.

---

## PHASE 4 — App shell and PWA

**Goal:** the navigation chrome and installability.

**Current approved batch:** Phases 4–6 plus Phase 7 reversible tracking; AI generation remains deferred. The user confirmed deployed Phase 3 login/sign-out/denial, approved isolated Supabase browser CI, and authorized focused commits/pushes. No hosted database reset or fixture writes are permitted.

**Approved refinements:** posted-only Archive (skipped content remains in Calendar/detail), agenda below 400px, readable posted-card styling instead of whole-card opacity, and seven-day last-verified-session offline reads with explicit purge/expiry rules in ARCHITECTURE.md §3.2.

**Automated verification (2026-11-01):** 280 local tests pass; 83 database tests are intentionally skipped on the shared laptop. Typecheck, lint, production build, the 59-file client-secret scan, 23 existing browser regressions and the production anonymous offline-shell test pass. Isolated database CI passes all 363 tests without skips, including migrations/RLS/concurrency, schema fixtures and generated-type drift. Production browser CI passes all 24 tests, including all six formats, screen accessibility, 320px/text enlargement, verbatim/long-press/fallback copy, 30-row Archive keysets while another page posts content, posting/Undo/history, offline refresh and sign-out cache purge. Month/scope navigation, keyboard focus and tab scroll preservation now pass using the user's approved full-document GET refinement (API.md §6.2). Safari rubber-band overscroll is normalized to zero when saving tab offsets, preserving the other tabs' positions.

**Manual release sign-off (user-confirmed, 2026-11-01):** the user confirmed iOS Safari and Android Chrome installation/icon/splash, safe areas and navigation/action-bar clearance, the worker update prompt/reload, visual/keyboard/greyscale/haptic review, production Lighthouse thresholds (Performance ≥90, Accessibility ≥95, Best Practices ≥95), and measured layout shift with no unexpected content jumps. These are user-reported checks, not measurements independently collected by the agent. Phases 4–6 and approved Phase 7 tracking are signed off. AI generation remains deferred. Verified code/test commit: `efc4f56`; database run `41297386506` and browser run `41297386566` both succeeded.

### Tasks

| # | Task |
|---|---|
| 4.1 | `AppShell` — page gradient, scroll container, safe-area insets |
| 4.2 | `PageHeader` — sticky, `h1`→`h3` collapse on scroll |
| 4.3 | `BottomNav` — floating pill, four destinations, active state by icon + label + dot |
| 4.4 | `ActionBar` — contextual per screen, hides on scroll-down, returns on scroll-up |
| 4.5 | Route transitions per `DESIGN.md` §7.2 (cross-fade between tabs, slide-up to detail) |
| 4.6 | `manifest.ts`, icons incl. maskable, splash, theme colour |
| 4.7 | Serwist service worker — shell precache, versioned, skip-waiting, in-app update prompt |
| 4.8 | `loading.tsx`, `error.tsx` per route group, `global-error.tsx` |

### Prerequisites
Phases 1, 3.

### Database / API changes
None.

### Tests
- Navigation landmark with current-page state exposed.
- Keyboard navigation through all four destinations.
- Install succeeds on iOS Safari and Android Chrome.
- Offline: shell loads; uncached route shows the offline empty state.
- Nothing is obscured by the nav pill at the end of scroll.

### Completion criteria
- [x] Installs with correct icon and splash on both platforms
- [x] Lighthouse reports installable
- [x] Tab scroll positions preserved independently
- [x] Safe areas correct on a notched device
- [x] Service worker update prompt verified

---

## PHASE 5 — Domain model and content components

**Goal:** one definition of a content item, and the components that render every format.

### Tasks

| # | Task |
|---|---|
| 5.1 | Zod schemas: `ContentItem`, per-format `body` (slides / script / frame / poll), `DesignBrief`, `SourceRef`, `DailyTip`, `MonthSkeleton` |
| 5.2 | Infer all TypeScript types from schemas — no hand-written parallel types |
| 5.3 | `PlatformBadge` (3 variants), `PillarChip`, `FormatChip`, `StatusPill` |
| 5.4 | `ContentCard` — full and condensed, including the posted treatment (dim + gold tick, no strikethrough) |
| 5.5 | `TipCard` — visually distinct from `ContentCard` so it is never mistaken for postable content |
| 5.6 | `CopyBlock` — clipboard, long-press, inline "Copied", selectable fallback when the API is unavailable |
| 5.7 | `SlideList`, `ScriptList`, `BriefSection` (fixed subsection order), `SourceList` (hidden when empty; `danger` warning on a sourceless news item) |
| 5.8 | `QueueRow` with overdue treatment |

### Prerequisites
Phases 1, 2.

### Database / API changes
None — schemas must match the `DATABASE.md` §5.3 column shapes exactly.

### Tests
- Schemas against valid, malformed, partial and adversarial payloads (the highest-value unit tests in the project).
- `CopyBlock`: clipboard success, long-press, unavailable-API fallback, line breaks and emoji preserved.
- Every format renders from a fixture.
- Line clamping never truncates mid-word with an inserted ellipsis.

### Completion criteria
- [x] All six formats render correctly from fixtures
- [x] Generated content rendered at ≥16px with authored line breaks intact
- [x] Posted treatment keeps content readable
- [x] No component accesses the database
- [x] Schema types align with generated database types

---

## PHASE 6 — Read screens

**Goal:** every screen renders real data from the seed, with all four states.

### Tasks

| # | Task |
|---|---|
| 6.1 | `server/db/queries` — Q1–Q11 in `DATABASE.md` §6.2, typed; Q12 is the atomic quota RPC, not a permitted authenticated SELECT |
| 6.2 | Search-param parsing: enum allowlist, silent fallback to defaults, never echoed |
| 6.3 | **Today** (S3) — date, progress ring, tip, swipeable deck with 16px peek and page dots |
| 6.4 | **Calendar** (S4) — agenda below 400px / month grid at wider widths, platform dots, posted indicators, filters, `DaySheet`, swipe between months, permanent legend |
| 6.5 | **Create** (S5) — format groups in fixed order, overdue group first, segmented filter |
| 6.6 | **Item detail** (S6) — fixed section order across all formats |
| 6.7 | **Archive** (S7) — scope control, filters, summary counts, keyset pagination |
| 6.8 | Loading, empty and error states for all of the above per `DESIGN.md` §9 |

### Prerequisites
Phases 4, 5.

### Database / API changes
Read-only. Implements the read contracts in `API.md` §6.

### Tests
- Invalid search params fall back to defaults; tampered cursor treated as page one.
- Keyset pagination stable while rows change.
- Skeletons cause no layout shift.
- `axe` on all five screens.
- No horizontal scroll at 320px; usable at 200% zoom.
- Partial e2e for J2 (designer queue ordering and grouping).

### Completion criteria
- [x] All five screens render from the dev seed
- [x] Every empty state in `DESIGN.md` §9.2 reachable and correct
- [x] Deck, calendar and month swipe all have non-gesture equivalents
- [x] `DESIGN.md` §14 checklist passes per screen

---

## PHASE 7 — Status tracking

**Approved staging refinement:** until hydration is implemented, unfinished ideas cannot be skipped by the application. Skip stays reversible for fully hydrated content; existing skipped unfinished ideas remain accessible in Calendar/detail. Revisit this restriction when the hydration action lands.

**Goal:** the product becomes genuinely usable end to end.

### Tasks

| # | Task |
|---|---|
| 7.1 | `markPosted` — optimistic via `useOptimistic`, rollback with reverse animation and `Undo` toast |
| 7.2 | `skipItem` — reversible toggle with optional reason |
| 7.3 | `addNote` — appends to `activity_log`, never written onto the item |
| 7.4 | Status service enforcing legal transitions before the database trigger does |
| 7.5 | Progress ring advances on the same 240ms timeline as the tick |
| 7.6 | Archive renders notes, actor and posted time from the activity log |
| 7.7 | "All done for today" state, including the single celebratory moment |

### Prerequisites
Phase 6.

### Database / API changes
Implements `API.md` §5.1. No schema change.

### Tests
- Legal transitions succeed; illegal ones map to `VALIDATION` with a user-safe message.
- `posted_by` taken from session, never from input.
- Optimistic rollback on server failure.
- Un-tick recorded in the activity log.
- **e2e J1** — open → read → copy → mark posted → ring advances → survives reload.

### Completion criteria
- [x] J1 passes end to end
- [x] Tick animation, haptic and ring advance choreographed together
- [x] Posted items immutable
- [x] Archive shows complete history

> **Milestone.** With a manually seeded month, the product now delivers its core value. Everything after this automates the content supply.

---

## PHASE 8 — AI client and prompts

**Goal:** one validated content item generated from a real model call.

### Tasks

| # | Task |
|---|---|
| 8.1 | `server/ai/client` — Portkey wrapper, `server-only`, 60s timeout, 2 retries with backoff, structured output, no streaming |
| 8.2 | `generation_runs` logging: tokens, `numeric` cost, duration, error |
| 8.3 | Prompt builders — four layers (system / context / task / steer), versioned |
| 8.4 | Output validation with the one-attempt repair loop (parse error, then field errors) |
| 8.5 | Source cross-check — strip URLs absent from `news_items`; fail the item if none survives |

### Prerequisites
Phases 2, 5; **Portkey key supplied**.

### Database / API changes
Writes `generation_runs`. No schema change.

### Tests
- Client mocked at the `ai/client` boundary; unit tests make no network calls.
- Repair loop: malformed JSON, then schema-invalid, then success.
- Fabricated URL stripped; sourceless news item rejected.
- Prompt builders deterministic given fixed inputs; brand profile verifiably included.
- One **real** smoke call, run manually, not in CI.

### Completion criteria
- [ ] A valid, schema-conforming item generated from a real call
- [ ] Token and cost recorded
- [ ] No AI module importable from client code
- [ ] Failure leaves no partial write

---

## PHASE 9 — News ingestion

**Goal:** factual grounding, safely parsed.

### Tasks

| # | Task |
|---|---|
| 9.1 | Fetch: 10s timeout, 1 retry, conditional `ETag`/`If-Modified-Since`, 2 MB body cap, ≤3 redirects, HTTPS public hosts only |
| 9.2 | Parse with `fast-xml-parser`, **external entities disabled**; strip HTML to plain text |
| 9.3 | Normalise URL (lowercase host, strip tracking params, strip trailing slash) → SHA-256 `url_hash` |
| 9.4 | Upsert with dedupe; prune beyond the retention window |
| 9.5 | Per-feed isolation — one failure never blocks the rest |

### Prerequisites
Phase 2; feed list (`DR-7`, defaults available).

### Database / API changes
Writes `news_items`, `generation_runs`. No schema change.

### Tests
- Malformed XML, empty feed, feed missing `published_at`.
- **XXE payload neutralised.**
- Oversized body abandoned, not buffered.
- Same article with differing `utm_*` deduplicates to one row.
- `javascript:` URL rejected before storage.
- One failing feed does not prevent the others ingesting.

### Completion criteria
- [ ] Ingest populates `news_items` idempotently
- [ ] Re-run creates no duplicates
- [ ] All safety tests pass

---

## PHASE 10 — Generation services

**Goal:** a full month planned and hydrated within platform limits.

### Tasks

| # | Task |
|---|---|
| 10.1 | Month skeleton generator — one call, returns date/platform/format/pillar/idea per slot |
| 10.2 | **Deterministic planning-rule validator** — `FR-2.2`–`FR-2.5` verified in code, not trusted to the prompt |
| 10.3 | Repair call naming specific violations; reject the run whole if still violating |
| 10.4 | Hydration service — batch bounded by a **~240s time budget** under the 300s cap, per-item isolation, failure leaves `idea` + `generation_error` |
| 10.5 | Daily tip generator with 30-day topic anti-repetition and fallback to the most recent tip |
| 10.6 | Atomic write semantics — a plan writes fully or not at all |

### Prerequisites
Phases 8, 9.

### Database / API changes
Writes `content_plans`, `content_items`, `daily_tips`, `generation_runs`. No schema change.

### Tests
- Validator against deliberately violating skeletons: consecutive pillar repeat, pillar appearing once, format repeat, 60-day near-duplicate, three items on a date.
- Time budget stops cleanly mid-batch without a partial write.
- Failed item remains `idea` with the error recorded.
- Re-planning an existing month returns `VALIDATION`, not a duplicate.

### Completion criteria
- [ ] A full month skeleton generates and passes the validator
- [ ] Hydration drains 20–30 items within budget
- [ ] Every pillar appears ≥ twice; no consecutive repeats
- [ ] Nothing partial ever persists

---

## PHASE 11 — Generation actions and rate limiting

**Goal:** user-triggered generation, spend-capped.

### Tasks

| # | Task |
|---|---|
| 11.1 | Rate limiter wrapping `consume_rate_limit`; IST midnight window; shared `ai_generate` budget + global cap |
| 11.2 | `regenerateItem` + steer sheet with three example chips; blocked on posted items |
| 11.3 | `hydrateItem` — just-in-time, idempotent no-op if already hydrated |
| 11.4 | `planMonth` — horizon-bounded, idempotent |
| 11.5 | `generateForDay` |
| 11.6 | Inline staged loading ("Researching… → Writing… → Briefing…"), cross-fade with "Updated" marker, non-blocking banner for month generation |

### Prerequisites
Phases 7, 10.

### Database / API changes
Implements `API.md` §5.2 and §7. Uses `rate_limits`. No schema change.

### Tests
- Concurrent `consume_rate_limit` calls never exceed the limit.
- A rate-limited request makes **no** AI call.
- `RATE_LIMITED` returns `retry_after` and renders as a sheet, not a toast.
- Regenerating a posted item rejected by both service and trigger.
- Date, platform and pillar preserved; `regenerated_count` increments.
- **e2e J3** — regenerate with a steer.

### Completion criteria
- [ ] J3 passes
- [ ] Caps enforced atomically
- [ ] Failed regeneration leaves the item untouched
- [ ] Rest of the app stays interactive during generation

---

## PHASE 12 — Scheduled job

**Goal:** the system runs itself.

### Tasks

| # | Task |
|---|---|
| 12.1 | `/api/cron/daily` with **constant-time** bearer comparison; `401` empty body |
| 12.2 | Four stages, each failure-isolated, each writing a `generation_runs` row |
| 12.3 | All dates derived from the actual run timestamp converted to **IST** — never from the cron expression |
| 12.4 | `maxDuration = 300`, self-limited to ~240s |
| 12.5 | `vercel.json` cron entry (UTC); cron disabled outside production |
| 12.6 | Stage summary response — counts and durations only, never content |

### Prerequisites
Phases 10, 11.

### Database / API changes
Implements `API.md` §3.2. Uses `service_role` — the only place it appears.

### Tests
- Missing or wrong bearer → `401` with empty body.
- Running twice produces no duplicate tips, plans or news rows.
- One failing stage does not prevent later stages.
- Month planning triggers only on `PLAN_DAY_OF_MONTH` in IST.
- A simulated missed day self-heals on the next run.

### Completion criteria
- [ ] Manual invocation performs all four stages
- [ ] Idempotent across repeated runs
- [ ] Service-role key unreachable from any action or component
- [ ] Failures visible in `generation_runs`

---

## PHASE 13 — Settings and brand profile

**Goal:** the owner can steer generation without a deployment.

### Tasks

| # | Task |
|---|---|
| 13.1 | Brand profile editor — autosave on blur, quiet "Saved" indicator, no Save button, chip editors for arrays |
| 13.2 | `updateBrandProfile` with field limits (`API.md` §4.3) |
| 13.3 | Manual "Plan this month" trigger |
| 13.4 | Compact run log — status and time only |
| 13.5 | Theme control, install hint, version |
| 13.6 | Sign out with confirmation sheet |

### Prerequisites
Phases 7, 12.

### Database / API changes
Writes `brand_profile`. Reads `generation_runs`. No schema change.

### Tests
- Autosave on blur; no unsaved-changes trap.
- Field limits enforced (these feed prompts — an unbounded field is a cost and injection vector).
- `updated_by` from session.
- Brand edits affect subsequent generations only, never existing items.

### Completion criteria
- [ ] All brand fields editable and persisted
- [ ] Changed tone demonstrably alters the next generation
- [ ] Run log readable by a non-technical owner
- [ ] Sign out confirms before acting

---

## PHASE 14 — Security hardening

**Goal:** both security checklists pass in full.

### Tasks

| # | Task |
|---|---|
| 14.1 | Tighten CSP to the minimum viable policy; verify all headers over the wire |
| 14.2 | Run the secret scan against the real production bundle |
| 14.3 | Automated RLS verification suite — `anon` returns zero rows from all eight tables |
| 14.4 | Confirm `rate_limits` unreachable as `authenticated` except via the definer function |
| 14.5 | Verify `serverActions.allowedOrigins` blocks cross-origin invocation |
| 14.6 | Audit every error path for leakage: no stack trace, model name, provider name, table name or ID |
| 14.7 | Confirm no personal data appears in any AI prompt |
| 14.8 | `npm audit`; confirm the dependency list still matches `ARCHITECTURE.md` §2.1 |

### Prerequisites
Phases 11, 12, 13.

### Database / API changes
None — verification only.

### Tests
The complete `API.md` §13 and `DATABASE.md` §11 checklists.

### Completion criteria
- [ ] Both checklists pass with no exceptions
- [ ] Build fails if any secret reaches the client
- [ ] No high-severity dependency advisory
- [ ] No new dependency introduced since Phase 0

---

## PHASE 15 — Test completion and accessibility

**Goal:** every automated gate in `ARCHITECTURE.md` §14.4 passes.

### Tasks

| # | Task |
|---|---|
| 15.1 | Complete unit coverage for the seven priority targets in `ARCHITECTURE.md` §14.1 |
| 15.2 | Stabilise e2e J1, J2, J3 against mocked AI |
| 15.3 | `axe` on all eight screens |
| 15.4 | Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA installable |
| 15.5 | Manual sweep: 320px, 200% zoom, greyscale, reduced motion, landscape, keyboard-only |
| 15.6 | Wire every gate into the pipeline as release-blocking |

### Prerequisites
Phase 14.

### Database / API changes
None.

### Completion criteria
- [ ] All gates pass and block release on failure
- [ ] `NFR-1.5` thresholds met
- [ ] Product fully usable in greyscale and keyboard-only
- [ ] No functionality lost under `prefers-reduced-motion`

---

## PHASE 16 — Deployment

**Goal:** production, verified against `PRD.md` §17.

### Tasks

| # | Task |
|---|---|
| 16.1 | Production Supabase project; apply migrations; seed real brand profile; verify RLS enabled on all eight tables |
| 16.2 | Production Google OAuth client; exact redirect URIs; add test users |
| 16.3 | All environment variables in Vercel production; confirm preview points at the dev project with cron disabled |
| 16.4 | Register the cron schedule; invoke manually and confirm a clean run |
| 16.5 | **Weekly backup workflow** — GitHub Action running `pg_dump`, gzipped and encrypted (`DATABASE.md` §10.3) |
| 16.6 | **Rehearse the restore procedure once** against a scratch project (`DATABASE.md` §10.5) |
| 16.7 | Generate a full month end to end on production; verify valid output for every day |
| 16.8 | Install the PWA on a real iOS and a real Android device |
| 16.9 | Walk the `PRD.md` §17 release checklist |

### Prerequisites
Phase 15.

### Completion criteria
- [ ] `L1`–`L7` all satisfied
- [ ] Backup produces a restorable dump
- [ ] Restore rehearsed, including the RLS verification step
- [ ] Full month generated on production
- [ ] PWA installs correctly on both platforms

> **16.5 and 16.6 are not optional.** Supabase Free provides no automated backups and no PITR (`DATABASE.md` §10.1). Until the weekly dump exists, an accidental drop is unrecoverable. And a restore that silently loses RLS converts a recovery into a data breach — which is why 16.6 rehearses it before it is needed.

---

## 3. Risk checkpoints

| After | Verify | If it fails |
|---|---|---|
| Phase 2 | Seed exercises every UI state | Expand the seed — do not proceed into Phase 6 blind |
| Phase 7 | Core loop genuinely usable with manual content | The product thesis is wrong; stop before investing in AI |
| Phase 8 | Real generation returns schema-valid output on first or repaired attempt | Revisit prompts or model choice before building services on top |
| Phase 10 | Validator catches planted violations | The quality guarantee behind `M4` and `M5` is illusory |
| Phase 12 | Double-run creates nothing duplicate | Idempotency is broken; fix before relying on cron |
| Phase 14 | Both checklists pass | Release blocker |

### Deferred decisions
`DR-1`, `DR-2`, `DR-4`, `DR-5`, `DR-6` all have working defaults in configuration and block nothing. `DR-3` (follower baselines) is needed only for post-launch measurement. `DR-7` (feed sources) has a default set and is changeable without a deploy.

---

## 4. Recommended first task

> ### **Task 0.1 — Scaffold the Next.js application**

**Why this first:** every other task edits files that do not yet exist. More importantly, Phase 0 installs the guardrails — strict TypeScript, the token lint rule, the secret scan — and each of those is dramatically cheaper to adopt now than to retrofit across a built codebase. The token rule in particular would otherwise require revisiting all 26 components from Phase 1.

**Do:**
1. Initialise Next.js 15 (App Router) with TypeScript and Tailwind v4 at the repository root, alongside the existing documents.
2. Set `strict: true` plus `noUncheckedIndexedAccess`; configure the `@/` path alias.
3. Create the empty folder skeleton exactly as `ARCHITECTURE.md` §10.
4. Add the npm scripts listed in `AGENTS.md` §3 (placeholders are fine where the tool is not yet configured).
5. Add `.gitignore` covering `.env*`, `.next`, `node_modules` and generated types.
6. Commit as `chore: scaffold next.js application`.

**Done when:** `npm run dev` serves a page, `npm run typecheck` passes, the folder structure matches `ARCHITECTURE.md` §10, and no dependency beyond the Phase 0 set has been installed.

**Explicitly not in this task:** no components, no database, no auth, no styling beyond the Tailwind default. Tasks 0.2–0.8 follow individually.

**In parallel, start now:** provision the two Supabase projects, create the Google OAuth client, and obtain the Portkey key (§1.3). These have external lead time and block Phases 2, 3 and 8.

---

**Preceded by:** `PRD.md` · `DESIGN.md` · `ARCHITECTURE.md` · `DATABASE.md` · `API.md` · `AGENTS.md`.
