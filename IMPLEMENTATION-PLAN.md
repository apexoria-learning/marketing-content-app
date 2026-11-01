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
| Supabase project (dev + prod) | Phase 2 | Two separate projects — preview must never touch production (`ARCHITECTURE.md` §15.1) |
| Google Cloud OAuth client + consent screen | Phase 3 | Test users added manually (`D3`) |
| Portkey account, API key, virtual key | Phase 8 | **User-supplied** |
| Vercel project | Phase 0 verification | Hobby tier |
| Decisions `DR-3` and `DR-7` | Phase 8/9 | Follower baselines; Salesforce feed source list. Defaults exist, so nothing blocks |

---

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
- [ ] Migrations apply cleanly to an empty database
- [ ] `DATABASE.md` §11 checklist passes
- [ ] Generated types compile
- [ ] Dev seed produces a browsable month containing every edge case above
- [ ] Brand profile seeded with genuine Apexoria content, not placeholders

> **Gate:** do not start Phase 6 until 2.10 produces data rich enough to exercise every state in `DESIGN.md` §9.2.

---

## PHASE 3 — Authentication

**Goal:** nothing is reachable without an allowlisted Google session, and the pipeline every future action depends on exists.

### Tasks

| # | Task |
|---|---|
| 3.1 | Supabase client factories in `server/db/` — browser, server, middleware, and a separately named service-role factory |
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
- [ ] Sign-in works end to end with a real Google account
- [ ] Allowlist denial verified
- [ ] No content visible pre-login
- [ ] Wrapper enforces session and allowlist independently of middleware
- [ ] Auth-related items in `API.md` §13 pass

---

## PHASE 4 — App shell and PWA

**Goal:** the navigation chrome and installability.

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
- [ ] Installs with correct icon and splash on both platforms
- [ ] Lighthouse reports installable
- [ ] Tab scroll positions preserved independently
- [ ] Safe areas correct on a notched device
- [ ] Service worker update prompt verified

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
- [ ] All six formats render correctly from fixtures
- [ ] Generated content rendered at ≥16px with authored line breaks intact
- [ ] Posted treatment keeps content readable
- [ ] No component accesses the database
- [ ] Schema types align with generated database types

---

## PHASE 6 — Read screens

**Goal:** every screen renders real data from the seed, with all four states.

### Tasks

| # | Task |
|---|---|
| 6.1 | `server/db/queries` — the twelve queries in `DATABASE.md` §6.2, typed |
| 6.2 | Search-param parsing: enum allowlist, silent fallback to defaults, never echoed |
| 6.3 | **Today** (S3) — date, progress ring, tip, swipeable deck with 16px peek and page dots |
| 6.4 | **Calendar** (S4) — month grid, platform dots, posted indicators, filters, `DaySheet`, swipe between months, permanent legend |
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
- [ ] All five screens render from the dev seed
- [ ] Every empty state in `DESIGN.md` §9.2 reachable and correct
- [ ] Deck, calendar and month swipe all have non-gesture equivalents
- [ ] `DESIGN.md` §14 checklist passes per screen

---

## PHASE 7 — Status tracking

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
- [ ] J1 passes end to end
- [ ] Tick animation, haptic and ring advance choreographed together
- [ ] Posted items immutable
- [ ] Archive shows complete history

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
