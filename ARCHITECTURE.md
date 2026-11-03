# ARCHITECTURE.md — Apexoria Content Co-pilot

**Source of truth for:** technical architecture, implementation structure, security boundaries and delivery.
**Derived from:** `PRD.md` v1.0 and `DESIGN.md` v1.0.
**Scope:** MVP (v1). Future-scale concerns are isolated in §16 and must not influence v1 implementation.

---

## 1. Architectural position

### 1.1 What this system actually is

Strip away the framing and the product is: **a scheduled job that writes rows, and a phone-shaped reader for those rows.** Traffic is under ten users. Writes are a handful per day. The expensive, slow, failure-prone part is a single outbound AI call.

Architecture must therefore optimise for exactly three things:

1. **Correctness of generated data** — bad rows are the only real failure mode users will feel.
2. **Zero secret leakage** — one exposed key is a financial and reputational incident (`NFR-2`).
3. **Low cognitive load for a small team** — one person must be able to hold the whole system in their head.

It must *not* optimise for throughput, horizontal scale, or deployment flexibility. Those are not problems this product has.

### 1.2 The decisive constraint

The architecture is shaped by one hard limit:

> **On Vercel Hobby, every cron job is triggered at most once per day, fires only on a best-effort basis within its scheduled hour, is scheduled in UTC only, and runs inside a 300-second function cap.**

(Hobby permits up to 100 cron *definitions* per project — the binding constraint is the once-per-day trigger frequency, not the job count.)

A month of content is 30–60 items, each with a caption, a body payload and a full design brief. That is far beyond what one model call can emit, and far beyond five minutes. Every significant decision below — two-phase generation, bounded work per invocation, the `idea → ready` status split, just-in-time hydration — exists to satisfy this constraint without adding a queue service, a worker, or a paid tier.

Two second-order consequences follow and are easy to miss:

- **Schedules are UTC.** `PLAN_DAY_OF_MONTH` is evaluated against IST in application code, not encoded in the cron expression, so an early-morning IST run does not silently land on the previous UTC day.
- **Trigger time drifts within the hour.** No stage may assume a precise execution time; all date logic derives from the actual run timestamp.

### 1.3 Principles

| # | Principle | Consequence |
|---|---|---|
| A1 | **One deployable unit** | A single Next.js app. No separate API service, no microservices, no containers. |
| A2 | **The database is the queue** | Work-in-progress is represented by row status, not by an external queue. |
| A3 | **Secrets never cross the network boundary** | All AI and privileged database access is server-side only, enforced by tooling, not discipline. |
| A4 | **Trust nothing that crosses a boundary** | User input *and* model output are both validated against schemas before touching the database. |
| A5 | **Bounded work per invocation** | Every job does a fixed, small amount of work and is safe to re-run. Resumption is implicit. |
| A6 | **Partial failure must not corrupt** | Generation either produces valid rows or changes nothing. |
| A7 | **Prefer platform primitives over libraries** | React Server Components over a data-fetching library; Postgres over Redis; `fetch` over an HTTP client. |
| A8 | **Every dependency must justify its presence** | A dependency is added only if removing it would mean writing something genuinely hard. |

---

## 2. Recommended tech stack

### 2.1 Selected stack

| Layer | Choice | Version intent |
|---|---|---|
| Framework | **Next.js (App Router)** | Latest stable 15.x |
| Language | **TypeScript**, `strict: true` | 5.x |
| UI runtime | **React Server Components + Server Actions** | React 19 |
| Styling | **Tailwind CSS** with CSS custom properties for design tokens | v4 |
| Animation | **Motion** (formerly Framer Motion) | Latest stable |
| Database | **Supabase Postgres** | Free tier |
| Auth | **Supabase Auth**, Google provider, via `@supabase/ssr` | Latest stable |
| Validation | **Zod** | v3+ |
| AI gateway | **Portkey SDK** → **Claude Sonnet** | Latest stable |
| Feed parsing | **fast-xml-parser** | Latest stable |
| Service worker | **Serwist** (`@serwist/next`) | Latest stable |
| Unit tests | **Vitest** | Latest stable |
| E2E tests | **Playwright** | Latest stable |
| Lint / format | **ESLint** (`next/core-web-vitals`, `next/typescript`) + **Prettier** | Latest stable |
| Hosting | **Vercel** | Hobby tier |
| Scheduling | **Vercel Cron** | Hobby tier |

That is the complete runtime dependency list. Thirteen production packages. If a fourteenth is proposed, it must displace one of these or solve a problem listed in §16.

### 2.2 Reasoning, decision by decision

**Next.js App Router — because it collapses two tiers into one.**
The product needs server-rendered reads (the content *is* the page), a small number of privileged mutations, and two webhook-style endpoints. A separate backend would mean a second deployment, a second auth integration, CORS, and a network hop for data that Server Components can read directly from Postgres during render. Server Components also give the secret boundary for free: code in a Server Component physically cannot ship to the browser. Given Vercel hosting is already fixed by the PRD (`D1`), Next.js is the native choice.

**React Server Components + Server Actions instead of a client data layer.**
The instinct is to reach for TanStack Query or SWR. Both are rejected: they solve cache invalidation across many concurrent clients, and this app has one user per device reading data that changes a few times a day. Server Components fetch during render with no client-side waterfall, no loading flash, and no cache to invalidate. Mutations use Server Actions with `useOptimistic` for the instant tick feedback `DESIGN.md §10.3` demands, and `revalidatePath` to refresh. This removes an entire category of state-synchronisation bugs and roughly 40 KB of client JavaScript.

**Route Handlers only where HTTP is genuinely required** — the cron entrypoint, the OAuth callback, and a health check. Everything else is a Server Action. Fewer public surfaces means fewer things to secure.

**Supabase — because it collapses database and auth.**
Fixed by the PRD (`D2`, `D3`). It is the right call independently: Postgres with real constraints (the data model in §5 leans on `CHECK`, `UNIQUE` and foreign keys to make illegal states unrepresentable), Google OAuth without hand-rolling a session layer, and Row Level Security as a second enforcement layer beneath the application. The free tier comfortably exceeds this workload.

**Tailwind with CSS custom properties — because `DESIGN.md` is token-driven.**
The design system mandates that no component hard-codes a colour, size or spacing value. Tokens are declared once as CSS variables (enabling the light/dark remap in `DESIGN.md §3.3` with no component branching) and exposed to Tailwind as theme values. Components reference semantic utilities only. A CSS-in-JS library would add runtime cost for zero benefit; plain CSS Modules would lose the enforced scale.

**Motion — the one animation dependency.**
`DESIGN.md §10` specifies spring physics on the status tick, choreographed multi-element timelines, gesture-driven paging on the Today deck, and a global `prefers-reduced-motion` kill switch. Hand-rolling gesture-driven paging with correct momentum and interruption handling is genuinely hard; this is the rare dependency that earns its place. It is used only in `components/ui` and `components/content`.

**Zod — the boundary validator, used twice.**
Once for user input into Server Actions, once for model output. The second use is the important one: a language model is an untrusted remote service that returns a string. Zod schemas are the single definition of a valid content item, and TypeScript types are inferred from them so the schema and the type can never drift.

**Portkey → Claude Sonnet.**
Fixed by the PRD (`D4`). Architecturally valuable beyond the mandate: it provides retries, timeouts, fallbacks and per-request token/cost observability at the gateway rather than in application code, and it decouples the model identity from the codebase — switching models becomes configuration.

**Serwist for the service worker.**
`FR-9` requires offline reads and installability. Serwist is the maintained successor to `next-pwa` with first-class App Router support. A hand-written service worker is possible but cache-versioning and update-flow bugs are subtle and user-visible.

**Postgres for rate limiting — not Redis.**
`NFR-2.7` requires per-user and global rate limits. Adding Upstash or Redis means another service, another credential, another failure mode, for a counter that increments perhaps fifty times a day. A single table with an atomic upsert inside a Postgres function is correct, transactional, and free.

**Vitest + Playwright.**
Vitest shares the Vite transform pipeline and runs the pure logic that actually carries risk (schemas, planning rules, rate limiting, status transitions). Playwright covers the three critical journeys `NFR-7.4` names. No component-level snapshot testing — it tests the implementation, not the behaviour, and `DESIGN.md` is the arbiter of appearance.

### 2.3 Deliberately rejected

| Rejected | Why |
|---|---|
| Separate Node/Express API | Second deployment, second auth integration, network hop, zero benefit at this scale (`A1`) |
| An ORM (Prisma, Drizzle) | A generated Supabase type definition plus a thin query module covers ~15 query shapes. An ORM adds a schema source competing with the migrations and, for Prisma, a heavy client in a serverless runtime |
| TanStack Query / SWR / Redux / Zustand | Server Components eliminate the problem they solve. Client state in this app is ephemeral UI state only (sheet open, deck index) |
| Redis / Upstash | Another service for a counter Postgres handles transactionally |
| A queue service (QStash, Inngest, SQS) | `A2` — `content_items.status` is the queue. Cron drains it in bounded batches |
| Background workers / containers | No workload justifies always-on compute |
| A component library (MUI, Chakra, shadcn wholesale) | `DESIGN.md` defines a specific, opinionated system with banned patterns. Importing a generic library means fighting its defaults. Headless primitives may be used *selectively* for the sheet and checkbox if focus-trap correctness proves fiddly |
| GraphQL / tRPC | Server Actions already provide end-to-end type safety with no schema layer |
| Sentry or a third-party APM in v1 | `NFR-2.10` restricts third parties receiving content data. `generation_runs` plus Vercel's own logs cover v1 observability |
| Storybook | Fourteen screens, one designer, one developer. The review checklist in `DESIGN.md §14` is the control |

---

## 3. System architecture

### 3.1 Topology

```
┌──────────────────────────────────────────────────────────────┐
│  BROWSER  (untrusted)                                        │
│  ├─ Installed PWA shell, Serwist service worker              │
│  ├─ Client Components: gestures, optimistic UI, sheets       │
│  └─ Supabase anon key only — no other credential exists here │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS · session cookie (httpOnly, secure)
┌───────────────▼──────────────────────────────────────────────┐
│  VERCEL  (trusted — single Next.js deployment)               │
│  ├─ middleware ....... session refresh + route gate          │
│  ├─ Server Components  reads, rendered server-side           │
│  ├─ Server Actions ... mutations, validated + rate-limited   │
│  ├─ Route Handlers ... /auth/callback, /api/cron/daily       │
│  └─ server/ .......... db · ai · news · auth · security      │
│       All secrets live here and only here                    │
└──┬───────────────────┬───────────────────┬───────────────────┘
   │ service role      │ gateway key       │ plain HTTPS GET
┌──▼────────────┐ ┌────▼──────────┐ ┌──────▼─────────────────┐
│ SUPABASE      │ │ PORTKEY       │ │ SALESFORCE RSS FEEDS   │
│ Postgres + RLS│ │ → Claude      │ │ (read-only, public)    │
│ Auth (Google) │ │   Sonnet      │ │                        │
└───────────────┘ └───────────────┘ └────────────────────────┘
            ▲
            │ once daily, bearer-authenticated
   ┌────────┴─────────┐
   │  VERCEL CRON     │
   └──────────────────┘
```

Four boxes. One deployable. No internal network to secure.

### 3.2 Frontend architecture

**Default to server.** A component is a Server Component unless it needs state, an effect, a browser API or a gesture. In practice the client boundary is small and predictable:

| Must be a Client Component | Reason |
|---|---|
| `TodayDeck` | Gesture paging, deck index state |
| `StatusTick` | Optimistic state, tick animation, haptics |
| `CopyBlock` | Clipboard API, long-press, transient "Copied" label |
| `BottomSheet`, `FilterBar`, `SegmentedControl` | Open/selection state, focus trap |
| `ActionBar`, `PageHeader` | Scroll-direction response |
| `RegenerateSheet`, brand profile fields | Form state |
| `InstallPrompt`, `ThemeToggle` | Browser APIs |
| `FormSubmitButton` | `useFormStatus` for pending authentication submissions; wraps the existing `Button`, with no client data access |
| `AppShell`, `BottomNav`, `PwaControls` | Per-tab scroll restoration, route motion, long-background resume, navigation state, install/update/connectivity APIs and acknowledged cache purge before sign-out |
| `CalendarView`, `ScopeControl` | Day-sheet state, month swipe/chevrons, and URL-based segment selection |
| `TrackedTick`, `ItemActions`, `usePosting` | Optimistic status changes, shared Today tick/button/ring state, reversible tracking and note/skip sheet submission |
| `GrantAccessForm`, `UserAccessRow`, `ImportAllowlistControl`, `InstructionsEditor`, `PlanningFiltersForm`, `RuntimeSettingsForm`, `PlatformManager`, `PlatformForm`, `PillarManager`, `PillarForm`, `AdminSectionNav`, `useAdminAction` | Admin panel form state, confirmation sheets, action feedback and scrolling the active section link into view (`features/admin`, `US-17`–`US-19`); data stays server-rendered |
| `PlatformCatalogueProvider`, `PlatformBadge`, `PlatformName`, `PillarCatalogueProvider`, `PillarChip`, `PillarName` | The `(app)` layout loads the platform and pillar catalogues' display fields once per request and provides them by context, so badges, chips and labels in both server- and client-rendered trees never hard-code platforms or pillars |

Everything else — page shells, `ContentCard` content, `SlideList`, `ScriptList`, `BriefSection`, `CalendarGrid`, `QueueRow`, `TipCard`, archive lists — renders on the server.

Shared presentational cards may also render beneath the Today/Calendar client boundary. Client props use inferred `ContentPreview`/`ItemControls` projections, excluding generation errors and internal generation metadata. Item bodies and audit sections remain server-rendered; no component constructs a database client.

**Rules.**
- `"use client"` is placed on the smallest possible component, never on a page or layout.
- Client Components receive plain serialisable data, never database clients or server utilities.
- Server-only modules import the `server-only` package so an accidental client import fails at build time (`A3`).
- Client state is ephemeral UI state only. Nothing that belongs in the database is mirrored into client state.
- Loading UI uses route-level `loading.tsx` and `<Suspense>` with the shape-accurate skeletons `DESIGN.md §9.1` specifies — never a spinner on a full page.
- `error.tsx` exists at each route group; `global-error.tsx` catches the rest.

**Rendering strategy.** All authenticated routes are dynamic — they depend on the session cookie and on per-day data. There is no static generation to reason about and no stale-cache class of bug. Perceived speed comes from server proximity to the database, small payloads and the service worker shell, not from caching.

**Approved offline privacy policy (Phases 4–7).** Offline reads rely on the last server-verified, allowlisted session, not live authorization. Middleware marks eligible private GET responses with an opaque user identity and a deadline no later than seven days after verification. The worker keeps at most 30 private HTML documents; it never caches OAuth callbacks, Server Action POSTs, or partial RSC responses. On client navigation it downloads a complete HTML document only for a same-origin private route, re-checking authorization server-side. Background cache requests cannot fetch auth callbacks.

**Approved read-navigation refinement.** Cursor, month and scope/format changes use full-document GET navigation rather than unreliable query-only RSC transitions. Native filter forms use the same transport. `lib/utils/read-navigation` restores control focus and persists only the four public tab paths with numeric scroll offsets in session storage. `AppShell` saves on pagehide and retries restoration while a route skeleton is present, so document reloads and streaming content do not erase other tabs' positions. Cursor pages reset the current tab to the top.

Sign-out waits for worker acknowledgement that private data was purged before clearing the server session. Online authorization denial, account changes, session expiry and worker activation also purge private data. Successful mutations invalidate stale private pages and download the current page again. Uncached/expired offline routes receive the public offline shell. Cache data is local device storage, not encrypted storage; offline devices cannot detect an external session revocation or allowlist change until they reconnect. This shared-device limitation was explicitly approved.

Serwist's automatic `cacheOnNavigation` is disabled: private caching must pass the policy above. Navigation preload remains explicitly disabled to preserve the single-use OAuth callback fix. Updates wait for an in-app Update confirmation, then send `SKIP_WAITING` and reload on controller change; public assets are revisioned by Serwist. The precache excludes Next's per-build-ID `_buildManifest.js`/`_ssgManifest.js` (unused by the App Router), so `sw.js` is byte-identical across builds with no shipped-asset change and the prompt appears only for a real update. The prompt clears itself if its waiting worker is activated by another tab or becomes redundant.

**Authenticated browser CI exception:** the dedicated browser workflow starts a disposable loopback Supabase stack in GitHub Actions, applies the development seed, creates a confirmed test account via that stack's local admin credential, and signs in normally to produce ignored Playwright cookie storage. Only this CI setup script uses the isolated admin API; application authorization is never bypassed. The script rejects non-CI execution and any API/database target outside the approved loopback stack. No hosted secrets, resets, seed writes, or browser-cookie artifacts are used/uploaded.

**Design token implementation.** Tokens from `DESIGN.md §3–5` are declared as CSS custom properties on `:root`, re-declared under a `[data-theme="light"]` selector, and surfaced to Tailwind as semantic names (`bg-surface-1`, `text-secondary`, `rounded-xl`, `gap-4`). Components use semantic utilities exclusively. An ESLint rule forbids arbitrary-value Tailwind classes containing raw colours or pixel values, which makes the checklist item *"Only tokens used"* mechanically enforced rather than a review opinion.

### 3.3 Backend architecture

Three entry types, each with a fixed contract:

| Entry type | Count | Used for | Authentication |
|---|---|---|---|
| **Server Component** | ~8 | All reads | Session, enforced in layout + middleware |
| **Server Action** | ~10 | All user-initiated mutations | Session, re-verified inside every action |
| **Route Handler** | 3 | OAuth callback, cron, health | Callback: OAuth code · Cron: bearer secret · Health: none |

Beneath them sits a layered `server/` module with a strictly one-directional dependency rule:

```
actions/ ──────┐
route handlers ┴──▶ services/ ──▶ db/ ──▶ Supabase
                       │
                       ├──▶ ai/    ──▶ Portkey ──▶ Claude
                       ├──▶ news/  ──▶ RSS feeds
                       └──▶ security/ (rate limit, cron auth)
```

- `db/` is the only module that constructs a Supabase client or writes SQL-shaped queries.
- `ai/` is the only module that knows Portkey exists. It returns validated, typed domain objects — never raw model responses.
- `services/` holds orchestration and business rules (planning rules, status transitions, hydration budget). It is pure enough to unit test without network access.
- `actions/` are thin: authenticate → validate input → rate limit → call a service → revalidate → return a typed result.

No layer may import from a layer above it. This is the one structural rule that keeps the codebase navigable as it grows.

---

## 4. Data flow

### 4.1 Read — opening the Today screen

```
Tap icon → service worker serves shell instantly
  → request to Vercel with session cookie
  → middleware refreshes the Supabase session
  → (app)/layout verifies the session, redirects if absent or not allowed
  → Today Server Component queries, in parallel:
        · today's content_items
        · today's daily_tip (fallback: most recent)
        · month posted/planned counts
  → RLS re-checks every row against the caller's identity
  → HTML + RSC payload streams back; skeletons resolve in place
  → Client Components hydrate: deck gestures, ticks, copy controls
```

No client-side fetch. No loading waterfall. One network round trip after the shell.

### 4.2 Write — marking an item posted

```
Tap StatusTick
  → useOptimistic flips state instantly; tick draws; ring advances; haptic fires
  → Server Action `markPosted(itemId, posted, note?)`
       1. Verify session                      → fail: redirect to sign-in
       2. Validate input with Zod             → fail: typed validation error
       3. Load item, assert status transition is legal (PRD §13)
       4. Update status, posted_at, posted_by
       5. Insert an activity_log row (same transaction)
       6. revalidatePath for the affected routes
  → Success: server state matches the optimistic state; nothing visibly changes
  → Failure: optimistic state rolls back with reverse animation + Undo toast
```

The optimistic update is the user's reality; the server call is reconciliation. This is what makes `DESIGN.md §10.3` feel instant on a slow connection.

### 4.3 Generation — two-phase, the core of the system

A full month cannot be generated in one call or in sixty seconds (§1.2). It is split so that every unit of work is small, valid in isolation, and resumable.

**Phase 1 — Skeleton (one model call, a few seconds).**

```
plan_month(YYYY-MM)
  → load brand_profile, pillar usage history, last 60 days of posted items
  → one Claude call: "allocate dates for this month"
  → returns, per date, 1–2 slots: { date, platform, format, pillar, one_line_idea }
  → validate against MonthSkeletonSchema
  → validate against planning rules (FR-2.2 … FR-2.5) — see §4.4
  → insert all rows with status = 'idea'   ← the queue is now populated
```

Cheap, fast, atomic. The user immediately has a complete, meaningful calendar.

**Phase 2 — Hydration (many small calls, bounded per invocation).**

```
hydrate_batch(limit = N)
  → SELECT * FROM content_items
      WHERE status = 'idea'
      ORDER BY scheduled_date ASC
      LIMIT N                              ← the queue is just a query
  → for each item:
        · gather grounding (news_items for the News pillar)
        · one Claude call → full caption, body payload, hashtags, CTA, design brief
        · validate against the format-specific schema
        · on success → UPDATE row, status = 'ready'
        · on failure → leave status = 'idea', record the error, continue
  → stop when the time budget (~240s) is exhausted, leaving headroom under the 300s cap
```

The batch is bounded by *time*, not only by count, so a slow model response cannot cause a timeout mid-write.

**Just-in-time hydration.** If a user opens an item still in `idea` status, the detail page hydrates that single item on demand and shows the staged inline loading state from `DESIGN.md §9.1`. The user is never blocked waiting for a nightly job to catch up.

**Why this shape earns its complexity:** it is the minimum structure that fits a 300-second serverless cap and a once-daily cron without adding a queue service — and it maps exactly onto the `idea → ready` statuses the PRD already defined for product reasons. A 300s budget drains roughly 20–30 items per run, so a fresh month reaches fully-`ready` within two to three nightly runs; just-in-time hydration covers anything a user reaches first.

### 4.4 Planning rules are code, not prompt

`FR-2.2`–`FR-2.5` (pillar rotation, no consecutive repeats, every pillar twice monthly, format variation, 60-day anti-repetition) are **verified deterministically after generation**, not merely requested in the prompt.

```
validate_plan(skeleton)
  → pillar repeated on consecutive days?        → violation
  → any pillar appearing fewer than twice?      → violation
  → same format twice running on a platform?    → violation
  → idea too similar to a post in the last 60d? → violation
  → more than 2 items on any date?              → violation

violations → one repair call naming the specific violations
still violating → reject the run, change nothing, log the failure
```

Models are persuadable, not reliable. Constraints that matter are enforced by code. This is also what makes metric `M4` (pillar coverage) a guarantee rather than a hope.

Owner-approved refinements: normalize idea words with Unicode NFKC and compare
word-set Jaccard similarity at ≥0.70, including exact normalized matches.
When news grounding is absent, omit every `requires_news` pillar explicitly
and require coverage of the remaining enabled pillars; require every enabled
pillar when sources exist.
See API.md §5.2. Month persistence uses the invoker/RLS-constrained
`commit_month_plan` transaction, not sequential parent/child writes.

The platform/format matrix is **catalogue data**, not code (`DATABASE.md`
§5.12–5.13). Planning services load the enabled platforms with their formats
(`server/services/planning-scope.ts`), pass them to the prompt and to the
validator as `PlanningFilters`, and fail closed with guidance when fewer than
two enabled platform/format pairs exist. A slot on a disabled or unknown
platform, or with a format the platform does not support, is a violation;
the database trigger re-checks the same rules on insert.

Pillars follow the same pattern (`DATABASE.md` §5.14). The planning scope also
loads the enabled catalogue pillars with their purpose, guidance and
`requires_news` flag, anchors context on the first enabled pillar that does not
need news, and fails closed when fewer than three such pillars (or more than
fourteen enabled pillars) exist. A slot on a disabled or unknown pillar, or on
a news pillar without news, is a violation; no code names a specific pillar.

### 4.5 The daily cron

One job, because each Hobby cron fires at most once per day (§1.2). Splitting into several jobs would buy nothing — they would all still run once daily, while multiplying the authentication surface and the failure modes. It runs four stages in dependency order, each independently failure-isolated:

```
GET /api/cron/daily          (bearer-authenticated)
  │
  ├─ 1. Ingest news       → fetch feeds, dedupe by url_hash, prune old
  │                         per-feed failure logged and skipped (FR-3.6)
  ├─ 2. Daily tip         → generate if today's is missing
  ├─ 3. Month planning    → only when day-of-month = PLAN_DAY and the
  │                         target month has no plan (idempotent)
  └─ 4. Hydrate batch     → drain `idea` items within the remaining budget
```

A failure in any stage is recorded in `generation_runs` and does not prevent later stages. The whole endpoint is idempotent: re-running it performs no duplicate work.

**Catch-up behaviour.** Because every stage is driven by *current database state* rather than by "what should have happened", a missed cron day self-heals on the next run. No backfill logic exists, because none is needed — this is `A5` paying for itself.

---

## 5. Database

### 5.1 Approach

Postgres is used as a database, not as a key-value store with JSON in it. Enumerations are constrained, relationships are foreign keys, invariants are `CHECK` and `UNIQUE` constraints. The intent is that **the database rejects illegal states even if the application has a bug**.

Variable-shaped payloads (carousel slides vs. reel scripts vs. poll options) are stored as `jsonb`, but every write passes through a Zod schema first, so the JSON shape is still guaranteed at the application boundary.

### 5.2 Tables

**`brand_profile`** — singleton, enforced by a `CHECK (id = 1)` constraint.

| Column | Type | Notes |
|---|---|---|
| `id` | `int` PK | Always `1` |
| `business_description` | `text` | |
| `courses` | `text[]` | |
| `current_offers` | `text` | |
| `audience_description` | `text` | |
| `tone_instagram` / `tone_linkedin` / `tone_whatsapp` | `text` | Per-platform voice (`D12`) |
| `do_list` / `dont_list` | `text[]` | |
| `links` | `jsonb` | Website and social URLs |
| `updated_at` | `timestamptz` | |

**`content_plans`** — one row per planned month.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `plan_month` | `date` | **Unique.** First day of the month |
| `status` | `text` | `pending` / `generating` / `complete` / `failed` |
| `model` | `text` | Model identifier used |
| `prompt_version` | `text` | Reproducibility (`NFR-7.2`) |
| `generated_at` | `timestamptz` | |

**`content_items`** — the core table.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `plan_id` | `uuid` FK → `content_plans` | `ON DELETE SET NULL` — plans are disposable, items are not |
| `scheduled_date` | `date` | Indexed |
| `platform` | `text` | FK → admin-managed `platforms(key)`; format/hashtag rules from the catalogue (`DATABASE.md` §5.12–5.13) |
| `format` | `text` | `CHECK IN ('carousel','reel','post','story','meme','poll')` |
| `pillar` | `text` | FK → admin-managed `pillars(key)`; news-sourcing rule from the catalogue (`DATABASE.md` §5.14) |
| `title`, `hook`, `caption`, `cta` | `text` | |
| `body` | `jsonb` | Slides / script / frame / poll — shape determined by `format` |
| `hashtags` | `text[]` | |
| `design_brief` | `jsonb` | Fixed subsection shape (`DESIGN.md §6.3`) |
| `source_refs` | `jsonb` | `[{ title, url, source }]` |
| `status` | `text` | `CHECK IN ('idea','ready','posted','skipped')`, indexed |
| `posted_at` | `timestamptz` | |
| `posted_by` | `text` | Email of the acting user |
| `skip_reason` | `text` | |
| `regenerated_count` | `int` | Default `0` |
| `prompt_version` | `text` | |
| `generation_error` | `text` | Last hydration failure, for diagnosis |
| `created_at` / `updated_at` | `timestamptz` | |

Constraints and indexes:
- Composite index on `(scheduled_date, status)` — serves Today, Calendar and Create.
- Partial index on `status = 'idea'` ordered by `scheduled_date` — the hydration queue query.
- A `BEFORE INSERT` trigger rejects a third item on any date, enforcing `D9` at the database level.
- A `BEFORE UPDATE` trigger blocks content-field changes once `status = 'posted'` (`FR-2.7`, `PRD §13`). Notes remain appendable via `activity_log`.

**`daily_tips`** — `tip_date` is `UNIQUE` (`FR-4.1`). Columns: `id`, `tip_date`, `tip`, `category`, `created_at`.

**`news_items`** — `url_hash` is `UNIQUE` (`FR-3.2`). Columns: `id`, `source`, `title`, `url`, `url_hash`, `published_at`, `summary`, `fetched_at`. Indexed on `published_at DESC`.

**`activity_log`** — append-only (`FR-7.4`). Columns: `id`, `content_item_id` FK, `action`, `from_value`, `to_value`, `actor_email`, `note`, `created_at`. No `UPDATE` or `DELETE` policy exists for any role, which makes append-only a database guarantee rather than a convention.

**`generation_runs`** — observability (`NFR-3.4`). Columns: `id`, `kind`, `status`, `started_at`, `finished_at`, `input_tokens`, `output_tokens`, `estimated_cost`, `items_processed`, `error`.

**`rate_limits`** — `(actor_key, action_key, window_start)` as a composite primary key. Columns: plus `count`.

### 5.3 Access pattern

- **Reads** use a request-scoped client carrying the user's session. RLS applies.
- **User-initiated writes** use the same session-scoped client. RLS applies.
- **The service-role client is used in exactly two places: the cron route handler**, which has no user session, **and the scoped admin module** (`server/db/admin.ts`, §6.3), reachable only through admin services that require a verified `AdminActor`. Each is constructed inside `server/db/` behind a function whose name makes its privilege obvious; the admin factory is private to its module and neither is re-exported from the `db` barrel.

Supabase CLI generates TypeScript types from the live schema; those types flow through `db/` into services. A schema change that breaks a query is a compile error, not a runtime surprise.

### 5.4 Migrations

Plain SQL files in `supabase/migrations/`, forward-only, applied through the Supabase CLI. Every migration is reviewed for whether it also needs an RLS policy — a new table without a policy is a release blocker, not a follow-up ticket.

---

## 6. Authentication and authorization

### 6.1 Flow

```
/sign-in → "Continue with Google"
  → Supabase OAuth redirect → Google consent
  → /auth/callback?code=...
  → exchange code for session, set httpOnly secure cookies
  → check access list (owner → app_users row → legacy ALLOWED_EMAILS)
       allowed     → redirect to /
       not allowed → sign out server-side, redirect to /no-access
       unreadable  → sign out server-side, redirect to /sign-in?error=session
```

The session lives in host-only `httpOnly`, `sameSite=lax` cookies managed by `@supabase/ssr` (also `secure` in production), with a seven-day cookie lifetime. No token is readable by JavaScript. Middleware refreshes the session on each request so active installed-PWA sessions do not expire mid-use; Supabase Auth's refresh-token lifetime remains the upper bound.

Supabase clients remain server-side: user and middleware factories are in
`server/db/`, while `cron-client.ts` exposes the separately named
`createCronServiceRoleClient` with session persistence and refresh disabled.
The cron factory is not re-exported through the shared barrel and has no runtime
caller until the cron phase. There is no browser client: HTTP-only cookies and
server-rendered reads do not require one.

### 6.2 Three layers of enforcement

Defence in depth, because `NFR-2` treats access as the primary risk:

| Layer | Enforces | Fails how |
|---|---|---|
| **1. Google Cloud Console test users** (`D3`) | Who can complete OAuth at all | Google blocks sign-in before any code runs |
| **2. Server-side access list** (`FR-1.3`) | `ADMIN_EMAILS` owners → active `app_users` row → unimported `ALLOWED_EMAILS` entry, on every session validation (callback, middleware, layout, every action). Fails closed: empty lists and unreadable rows admit no one | Session terminated, redirect to `/no-access` (unreadable list: `/sign-in?error=session`) |
| **3. Postgres RLS** (`NFR-2.3`) | Row access, independent of application logic | Query returns zero rows |

Layer 3 matters most. Even if middleware were misconfigured and a page leaked, the anon key alone returns nothing, because every table is deny-by-default and policies require `auth.role() = 'authenticated'`.

### 6.3 Authorization model

`PRD §12` defines two roles: **Member** and **Admin** (`US-17`). Therefore:

- RLS policies on content check *authentication*, not per-row ownership. There is no `user_id` column on content, because content belongs to the business, not to a person.
- `posted_by` and `activity_log.actor_email` are **attribution, not authorization**. They record who did something; they never gate what anyone may do. `generation_runs.actor_email` is stamped from the JWT by a trigger and is likewise attribution (usage reporting).
- Role, active state and per-person AI permission live in `app_users` (`DATABASE.md` §5.9). Members can read only their own row; **no authenticated write policy exists**, so a signed-in account cannot grant itself access through the Data API.
- `ADMIN_EMAILS` owners are admins resolved from the environment and never depend on the database, so a database outage or panel mistake cannot lock the owner out.
- **Admin operations use a scoped service-role client** (owner-approved deviation, 2026-11-03). `server/db/admin.ts` creates it in a private factory; its only callers are `server/services/admin.ts` functions, each of which requires an `AdminActor` token that `toAdminActor` issues only after `getAuthorizedUser` verified an admin session in that request. Admin pages call `requireAdminPage()` themselves (layouts do not re-run on client navigation); admin actions use `runAdminAction`. A member is refused with `FORBIDDEN` without losing their session.
- Cron acts as a system actor authenticated by a shared secret, not a user session.

### 6.4 Route protection

- `middleware.ts` refreshes the session and redirects unauthenticated requests away from protected routes before any page renders.
- The `(app)` layout independently re-verifies the session and the allowlist. Middleware is a convenience and a performance optimisation; the layout is the actual gate.
- **Every Server Action re-verifies the session itself.** Actions are independently addressable HTTP endpoints — treating middleware as sufficient protection for them is a well-known and serious mistake.

---

## 7. API architecture

### 7.1 Surface

| Surface | Path | Method | Auth | Purpose |
|---|---|---|---|---|
| Route Handler | `/auth/callback` | GET | OAuth code | Session exchange, allowlist check |
| Route Handler | `/api/cron/daily` | GET | `Bearer CRON_SECRET` | The four-stage daily job (§4.5) |
| Route Handler | `/api/health` | GET | None | Liveness only — returns status, never data |

Everything else is a Server Action. There is no public REST API, no API versioning, and no CORS configuration, because there is no external consumer. Adding one is a §16 concern.

### 7.2 Server Actions

| Action | Input | Rate limited | Notes |
|---|---|---|---|
| `markPosted` | item id, posted flag, optional note | No | Optimistic; validates status transition |
| `skipItem` | item id, optional reason | No | |
| `regenerateItem` | item id, optional steer text | **Yes** — per user per day (`DR-5`, default 20) | Blocked when `posted` (`US-11 AC3`) |
| `hydrateItem` | item id | **Yes** — shares the regeneration budget | Just-in-time hydration (§4.3) |
| `planMonth` | month | **Yes** — low global limit | Manual trigger (`FR-5.5`) |
| `generateForDay` | date | **Yes** | Fills an empty day |
| `updateBrandProfile` | profile fields | No | Autosave on blur (`DESIGN.md §8`) |
| `setTheme` | theme | No | Cookie only |
| `grantUserAccess`, `updateUserAccess`, `importAllowlist` | email, role, active, AI permission | No | Admin only (`runAdminAction`); owners and self are refused |
| `updateAppSettings` | runtime overrides, planning filters | No | Admin only; `null` restores the environment value |
| `saveEditorialInstructions` | scope, text ≤ 2,000 | No | Admin only; appends a version |
| `savePlatform`, `reorderPlatform` | catalogue platform fields / key + direction | No | Admin only; atomic `save_platform`; keeps ≥ 2 enabled platform/format pairs |
| `savePillar`, `reorderPillar` | catalogue pillar fields / key + direction | No | Admin only; atomic `save_pillar`; keeps ≥ 3 enabled pillars without news and ≤ 14 enabled |

**Uniform contract.** Every action returns a discriminated result — success with typed data, or failure with a stable error code and a user-safe message. Actions never throw across the client boundary, because thrown errors in production are reduced to an opaque digest and the UI cannot render the specific recovery guidance `DESIGN.md §9.3` requires.

**Uniform pipeline.** Every action, without exception:

```
1. Verify session and allowlist
2. Parse input with Zod
3. Check rate limit (where applicable)
4. Delegate to a service
5. Revalidate affected paths
6. Return a typed result
```

Steps 1–3 are a shared wrapper, so an action cannot accidentally omit them.

### 7.3 Cron contract

- Rejects any request without the exact bearer secret, returning `401` with no body — the endpoint reveals nothing about itself to an unauthenticated caller.
- Returns `200` with a stage-by-stage summary when at least one stage succeeds; `500` only on total failure, so Vercel's retry signal reflects genuine failure.
- Writes a `generation_runs` row per stage regardless of outcome.
- Declares an explicit `maxDuration` of 300 and self-limits its work budget to ~240s, leaving headroom for teardown.
- Derives all dates from the actual run timestamp in IST, never from the cron expression, because Hobby schedules are UTC and fire anywhere within the scheduled hour.

---

## 8. External services

| Service | Role | Credential | Failure mode | Degradation |
|---|---|---|---|---|
| **Supabase Postgres** | Data | Anon key (client), service role (cron and the scoped admin module, §6.3) | Unavailable | Reads fall back to the service-worker cache; writes roll back optimistic state with a retry toast |
| **Supabase Auth** | Google sign-in | Anon key + OAuth secret | Unavailable | Sign-in error with retry; existing sessions continue |
| **Portkey → Claude** | Generation | Portkey API key, server-only | Timeout, rate limit, invalid output | Retry with backoff → repair attempt → mark run failed, **change nothing** (`NFR-3.2`) |
| **Salesforce RSS feeds** | News grounding | None (public) | Feed down, malformed, blocked | Per-feed isolation; generation proceeds ungrounded and **never invents news** (`FR-3.6`, `R2`) |
| **Vercel Cron** | Scheduling | `CRON_SECRET` | Missed run | Self-healing on the next run (§4.5); manual trigger available |

Feed URLs are **configuration, not code** (`PRD §14`), stored as an environment value so sources change without a deployment (`A3` of the PRD's assumptions).

---

## 9. AI architecture

### 9.1 Boundary

```
services/  ──▶  ai/generators  ──▶  ai/prompts   (assemble)
                      │          ──▶ ai/client    (Portkey call)
                      │          ──▶ ai/schemas   (Zod validate)
                      ▼
            typed domain objects — never raw model output
```

Nothing outside `server/ai/` knows which model is in use, what a prompt looks like, or that Portkey exists. Swapping models or providers touches one directory.

### 9.2 Prompt composition

Six layers, assembled in a fixed order so that caching and reasoning both behave predictably:

| Layer | Contents | Volatility |
|---|---|---|
| **System** | Role, brand profile, platform tone rules, do/don't lists, hard constraints | Changes when the brand profile changes |
| **Context** | Recent `news_items` (`requires_news` pillars only), pillar usage history, last 60 days of posted ideas | Changes daily |
| **Task** | The specific instruction and the exact output schema; enabled platforms with their formats and enabled pillar keys for planning; the item's platform rules (label, hashtag limit, caption limit) and the built-in news-sourcing rule for news pillars from the catalogues for content | Fixed per generator |
| **Platform and pillar guidance** | The platform's admin-written guidance and the pillars' admin-written names, purposes and guidance (planners receive every plannable pillar's), JSON-encoded in their own messages explicitly subordinate to the rules above | Per catalogue edit |
| **Editorial instructions** | Admin-authored house style per scope (`content`, `planning`, `daily_tip`; `DATABASE.md` §5.11), ≤ 2,000 chars, sent as its own message explicitly subordinate to the factual, privacy, platform and schema rules | Per saved version |
| **Steer** | Optional user instruction from the regeneration sheet | Per request |

Every prompt carries a `prompt_version`, persisted on the row it produced (`NFR-7.2`). When editorial instructions are active the version gains a `+i<version>` suffix (e.g. `content-v2+i4`; `v2` added catalogue pillar rules), so output changes stay attributable. Admin planning filters are enforced again by the deterministic validator (§4.4), never trusted to the prompt alone.

### 9.3 Structured output and validation

Model output is treated as a hostile string until proven otherwise (`A4`):

```
request structured output (JSON mode / tool schema)
  → parse
      fail → one repair attempt, echoing the parse error
  → validate with the format-specific Zod schema
      fail → one repair attempt, naming the invalid fields
  → apply business rules (§4.4)
      fail → repair, then reject the run
  → persist
```

Invariants:
- **Nothing partial is ever written.** A failed item leaves its row in `idea` with `generation_error` set; it never becomes a half-populated `ready` item (`NFR-3.2`).
- **News items without at least one source reference are rejected** at the schema level (`FR-3.5`, `US-12`). The product's credibility risk `R2` is enforced by a type, not by a prompt instruction.
- Source URLs are cross-checked against ingested `news_items`; a URL the model invented is stripped, and if nothing remains the item fails validation.

### 9.4 Cost and reliability controls

| Control | Mechanism |
|---|---|
| Timeouts | Configured at the Portkey gateway and again per request |
| Retries | Current owner-confirmed gateway has no retries; SDK retries disabled (API.md §8.1 refinement) |
| Per-user cap | `rate_limits` table, daily window (`DR-5`) |
| Global cap | Separate daily counter across all users |
| Cost visibility | Token counts recorded per call; owner-approved pricing deferral stores unknown estimated cost as NULL, not zero (API.md §8.1) |
| Batch economy | Skeleton generation is one call for the whole month; hydration is one call per item |
| No streaming | Responses must be validated whole before use — streaming would add complexity for no user benefit, since generation happens in the background |

---

## 10. Folder structure

```
apexoria-content-copilot/
├─ PRD.md
├─ DESIGN.md
├─ ARCHITECTURE.md
├─ .env.example                      # names and comments only, no values
├─ vercel.json                       # cron schedule
├─ next.config.ts                    # security headers, CSP, Serwist
│
├─ public/
│  ├─ icons/                         # PWA icons, maskable variants
│  └─ fonts/                         # self-hosted, subset
│
├─ supabase/
│  └─ migrations/                    # forward-only SQL
│
├─ scripts/
│  └─ check-client-bundle.mjs        # fails the build if a secret appears (NFR-2.1)
│
├─ tests/
│  ├─ unit/                          # Vitest
│  └─ e2e/                           # Playwright: J1, J2, J3
│
└─ src/
   ├─ middleware.ts
   │
   ├─ app/
   │  ├─ layout.tsx                  # fonts, theme, tokens
   │  ├─ global-error.tsx
   │  ├─ manifest.ts
   │  │
   │  ├─ (auth)/
   │  │  ├─ sign-in/page.tsx
   │  │  └─ no-access/page.tsx
   │  │
   │  ├─ (app)/
   │  │  ├─ layout.tsx               # session gate, AppShell, nav
   │  │  ├─ error.tsx
   │  │  ├─ page.tsx                 # S3 Today
   │  │  ├─ loading.tsx
   │  │  ├─ calendar/page.tsx        # S4
   │  │  ├─ create/page.tsx          # S5
   │  │  ├─ archive/page.tsx         # S7
   │  │  ├─ item/[id]/page.tsx       # S6
   │  │  ├─ settings/page.tsx        # S8
   │  │  └─ admin/                   # S9 — admin-gated layout + overview,
   │  │                              # users, prompts, filters, settings
   │  │
   │  ├─ auth/callback/route.ts
   │  └─ api/
   │     ├─ cron/daily/route.ts
   │     └─ health/route.ts
   │
   ├─ components/
   │  ├─ ui/                         # Button, Chip, Sheet, Toast, Skeleton,
   │  │                              # SegmentedControl, Input, StatusTick,
   │  │                              # ProgressRing  — DESIGN.md §6.4
   │  ├─ content/                    # ContentCard, CopyBlock, SlideList,
   │  │                              # ScriptList, BriefSection, SourceList,
   │  │                              # TipCard — DESIGN.md §6.3
   │  ├─ calendar/                   # CalendarGrid, DayCell, DaySheet
   │  ├─ shell/                      # AppShell, PageHeader, BottomNav, ActionBar
   │  └─ feedback/                   # EmptyState, ErrorState, Banner
   │
   ├─ features/                      # screen composition: data + layout
   │  ├─ today/  calendar/  create/  archive/  item/  settings/  admin/
   │
   ├─ server/
   │  ├─ auth/                       # session, allowlist, guards
   │  ├─ db/                         # supabase clients, typed queries
   │  ├─ services/                   # planning, hydration, status, tips
   │  ├─ ai/
   │  │  ├─ client.ts                # Portkey wrapper
   │  │  ├─ prompts/                 # versioned prompt builders
   │  │  ├─ schemas/                 # Zod output contracts
   │  │  └─ generators/              # skeleton, item, tip
   │  ├─ news/                       # fetch, parse, dedupe, prune
   │  ├─ security/                   # rate limit, cron auth
   │  └─ actions/                    # Server Actions (thin)
   │
   ├─ lib/                           # pure, shared, client-safe
   │  ├─ types/  schemas/  dates/  format/  constants/
   │
   └─ styles/
      ├─ tokens.css                  # DESIGN.md §3–5, single source
      └─ globals.css
```

**Organising rule:** `components/` is *what things look like* (reusable, no data access), `features/` is *what a screen does* (composition and data), `server/` is *what the system does* (privileged). A file in `components/` that imports from `server/` is a structural bug.

---

## 11. Environment configuration

| Variable | Scope | Secret | Used by | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | No | Both | Project endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | No | Both | RLS-constrained access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | **Yes** | Cron; scoped admin module (§6.3) | Bypasses RLS — the highest-value secret |
| `PORTKEY_API_KEY` | Server | **Yes** | `ai/client` | Gateway authentication; never stored in the database or shown in the panel |
| `PORTKEY_BASE_URL` | Server | No | `ai/client` | Owner-authorized HTTPS `/v1` endpoint; model-alias routing per API.md §8.1. Default; admin-overridable |
| `AI_MODEL` | Server | No | `ai/client` | Model identifier — config, not code. Default; admin-overridable |
| `ADMIN_EMAILS` | Server | No | `auth/` | Comma-separated owners: always admins, cannot be changed from the panel |
| `ALLOWED_EMAILS` | Server | No | `auth/` | Legacy comma-separated allowlist, honoured until imported into `app_users` from `/admin/users`. Empty admits no one |
| `NEWS_FEED_URLS` | Server | No | `news/` | Comma-separated feed list; approved Salesforce News/Ben defaults when unset; explicit empty disables feeds. Default; admin-overridable |
| `NEWS_RETENTION_DAYS` | Server | No | News ingestion service | Default `30` days from fetched_at, owner-approved |
| `PLAN_DAY_OF_MONTH` | Server | No | Cron | Default `25` (`DR-4`); admin-overridable |
| `REGEN_DAILY_LIMIT` | Server | No | `security/` | Default `20` (`DR-5`); admin-overridable |
| `GLOBAL_DAILY_AI_LIMIT` | Server | No | `security/` | Default `100` — backstop bounding total daily AI spend; admin-overridable |
| `PLANNING_HORIZON_MONTHS` | Server | No | Planning service | Default `2` (`DR-6`); admin-overridable |
| `AI_GENERATION_ENABLED` | Server | No | Generation actions and controls | Default `false`; owner enables after Group B validation and reviewed hosted migrations `0012`/`0013`; admin-overridable |
| `CRON_SECRET` | Server | **Yes** | Cron route | Bearer authentication |
| `NEXT_PUBLIC_APP_URL` | Client + server | No | OAuth redirect, manifest | Canonical origin |

Rules:
- **Only `NEXT_PUBLIC_*` variables may be referenced outside `server/`.** Enforced by an ESLint rule and by the bundle check in §14.
- `.env.example` is committed with names and explanatory comments and **no values**. Real values exist only in `.env.local` (git-ignored) and in Vercel's encrypted store.
- Environment variables are read once in a typed, Zod-validated config module that **fails fast at startup** if a required value is missing or malformed. A missing key becomes a clear boot error, never a confusing `undefined` at 3 a.m. during a cron run.
- Tunable behaviour (`PLAN_DAY_OF_MONTH`, `REGEN_DAILY_LIMIT`, `NEWS_FEED_URLS`) is configuration precisely because `PRD §19` leaves those decisions open. They change without a code review.
- Variables marked *admin-overridable* are defaults: an admin may override them at runtime in `app_settings` (`DATABASE.md` §5.10), read once per request through `server/db/settings.ts`. Clearing an override restores the environment value. Secrets are never overridable or stored in the database.

---

## 12. Error handling

### 12.1 Taxonomy

Every failure maps to one of six codes, each with a defined UI treatment drawn from `DESIGN.md §9.3`:

| Code | Cause | HTTP-ish | User sees | Recovery |
|---|---|---|---|---|
| `UNAUTHENTICATED` | No/expired session | 401 | Redirect to sign-in | Sign in |
| `FORBIDDEN` | Not on the access list; or a member calling an admin action | 403 | `/no-access` screen (admin actions: inline message, session kept) | Use another account |
| `VALIDATION` | Bad input | 400 | Inline field error | Correct and retry |
| `RATE_LIMITED` | Cap exceeded | 429 | **Sheet**, not a toast — includes reset time | Dismiss |
| `GENERATION_FAILED` | AI failure after retries | 502 | Banner: "Nothing was changed." | Try again |
| `UNEXPECTED` | Anything else | 500 | "Something went wrong on our side." | Reload |

### 12.2 Rules

- **Errors are values at the boundary.** Services throw typed domain errors; the action wrapper converts them into the discriminated result from §7.2. Nothing throws across the client boundary.
- **Messages state whether data changed.** "Nothing was changed" is not politeness, it is information the user needs before deciding to retry.
- **Nothing internal leaks.** No stack traces, model names, provider names, table names or IDs reach the UI (`PRD §15.3`). Full detail goes to server logs and `generation_runs`.
- **Failure is isolated to its surface.** A failed list leaves navigation working. A failed item leaves the header and back button working. A failed cron stage leaves later stages running.
- **Optimistic actions always have a defined rollback**, with the reverse animation and `Undo` affordance `DESIGN.md §10.3` specifies.
- **Retries are bounded and only for idempotent operations.** No retry storms.

### 12.3 Observability

v1 deliberately ships no third-party APM (`NFR-2.10`). Instead:

- `generation_runs` is the operational record — every AI and ingestion run, with status, duration, tokens, cost and error.
- Settings exposes a compact run log (`PRD §13`, S8) so a non-technical owner can see that last night's job worked.
- Vercel's built-in function logs cover request-level failures.
- A persistent `danger` Banner surfaces the last failed generation in-app, so silent failure is impossible (`FR-2.6`: failures are never silently swallowed).

---

## 13. Security boundaries

### 13.1 Trust zones

```
ZONE 0 — UNTRUSTED
  Browser, service worker, all client code, all user input,
  and **all model output**
  Holds: anon key only
        │
   ═════╪═══════ boundary: session cookie + Zod validation ═══════
        │
ZONE 1 — TRUSTED
  Vercel server runtime: middleware, Server Components,
  Server Actions, Route Handlers, server/
  Holds: every secret
        │
   ═════╪═══════ boundary: credentials + RLS ═════════════════════
        │
ZONE 2 — EXTERNAL
  Supabase · Portkey/Claude · RSS feeds
```

Two crossings, both explicitly defended. Model output sits in Zone 0 — that classification is the single most consequential security decision in this document.

### 13.2 Controls

| Requirement | Control |
|---|---|
| `NFR-2.1` No secrets client-side | Secrets referenced only in `server/`; `server-only` import guard; **build-time bundle scan that fails the build** if a secret value appears in client output |
| `NFR-2.2` Server-only AI | `ai/` imports `server-only`; no action exposes model parameters |
| `NFR-2.3` RLS everywhere | Enabled with deny-by-default on every table at creation; a new table without a policy blocks release |
| `NFR-2.4` Input validation | Zod at every Server Action and Route Handler |
| `NFR-2.5` Output treated as untrusted | Model output validated; rendered as text only; `dangerouslySetInnerHTML` banned by lint rule |
| `NFR-2.6` CSP and headers | Strict CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict `Referrer-Policy`, `Permissions-Policy` denying unused APIs, HSTS |
| `NFR-2.7` Rate limiting | Atomic Postgres counters, per-user and global, on every AI endpoint |
| `NFR-2.8` Cron auth | Constant-time bearer comparison; `401` with no body |
| `NFR-2.9` Secret hygiene | `.env.example` only; `.env*` git-ignored; secrets in Vercel's encrypted store |
| `NFR-2.10` No third-party trackers | No analytics SDK in v1 |

### 13.3 Specific risks and their mitigations

| Risk | Mitigation |
|---|---|
| **Prompt injection via RSS content** | Feed content is inserted as clearly delimited, labelled reference data, never as instructions. Output is schema-validated regardless, so an injected instruction cannot change the shape of what gets written. URLs are cross-checked against ingested rows |
| **Model-fabricated URLs reaching users** (`R2`) | Source URLs must match ingested `news_items`; unmatched URLs are stripped; News items with no surviving source fail validation |
| **Server Actions called directly** | Every action independently verifies session, validates input and checks rate limits — middleware is never the only gate |
| **Service-role key over-reach** | Used in exactly one route handler; constructed behind an explicitly named function; unreachable from any user-facing path |
| **Runaway AI spend** (`R4`) | Per-user daily cap, global daily cap, bounded batch sizes, cost recorded per run |
| **Preview deployments touching production data** | Preview environments normally point at a separate Supabase project; the temporary owner-approved exception and safeguards are in §15.1. **Cron is disabled outside production** |
| **Stale service worker serving old code** | Versioned precache with skip-waiting on activation and an in-app update prompt |
| **XSS via generated content** | Content rendered as React text nodes only; no HTML rendering path exists anywhere in the product |

---

## 14. Testing

Effort is spent where failure is both likely and expensive. Generated content is the product; everything else is plumbing.

### 14.1 Unit tests — Vitest (the priority)

| Target | Why it matters |
|---|---|
| **Zod output schemas** | The contract protecting the database from bad model output. Tested against valid, malformed, partial and adversarial payloads |
| **Planning rule validator** (§4.4) | Guarantees `FR-2.2`–`FR-2.5` and metric `M4`. Tested against deliberately violating skeletons |
| **Status transition logic** | Illegal transitions (editing a posted item, regenerating a posted item) must be impossible |
| **Rate limiter** | Boundary conditions, window rollover, concurrent increments |
| **Source-reference cross-check** | Fabricated URLs must be stripped; source-less News items must fail |
| **Date and month logic** | Timezone handling around month boundaries and IST offsets |
| **Prompt builders** | Deterministic given fixed inputs; brand profile is actually included |

AI calls are mocked at the `ai/client` boundary. Unit tests never make network calls.

### 14.2 Integration tests

Run against a local Supabase instance or an isolated PostgreSQL 15 service in
[database CI](./.github/workflows/database-tests.yml):
- RLS: the anon key returns zero rows for every table without a session (`L4`).
- Triggers: the third item on a date is rejected; posted items cannot be content-edited.
- Append-only: `activity_log` rows cannot be updated or deleted.
- Idempotency: running the cron handler twice produces no duplicate work.

Database integration tests reject non-loopback targets. Developers without a
local database can run the workflow; CI sets `REQUIRE_DATABASE_TESTS=true` so an
unreachable database fails rather than producing a skipped, success-shaped run.
The CLI generates database types from a separate throwaway migrated database,
checks committed type drift, and publishes the generated file as an artifact.

### 14.3 E2E tests — Playwright

The three journeys `NFR-7.4` names, on a mobile viewport with an authenticated storage state and a mocked AI layer:

- **J1 Morning check-in** — open → read today → copy → mark posted → ring advances → state survives reload.
- **J2 Designer queue** — open Create → groups and overdue ordering correct → open a carousel → copy slides.
- **J3 Regeneration** — open an item → regenerate with a steer → content updates → count increments → posted items cannot be regenerated.

Plus: unauthenticated access to every route redirects to sign-in.

### 14.4 Automated quality gates

| Gate | Tool | Blocks release |
|---|---|---|
| Type safety | `tsc --noEmit`, strict | Yes |
| Lint | ESLint, including the token and `NEXT_PUBLIC_` rules | Yes |
| Secret leak | `scripts/check-client-bundle.mjs` (`L3`) | Yes |
| Unit + integration | Vitest | Yes |
| E2E | Playwright | Yes |
| Accessibility | `axe` in Playwright on each screen | Yes |
| Lighthouse mobile | Thresholds from `NFR-1.5` | Yes |

### 14.5 Not tested automatically

Visual appearance, animation feel, and content quality. These are reviewed by a human against `DESIGN.md §14` and tracked through metric `M5` (regeneration rate) respectively. Automating them would cost more than it returns at this scale.

---

## 15. Deployment

### 15.1 Environments

| Environment | Hosting | Database | Cron | Google OAuth |
|---|---|---|---|---|
| Local | `next dev` | Local Supabase or a dev project | Manual invocation | Dev client, `localhost` redirect |
| Preview | Vercel preview | **Separate** Supabase dev project | **Disabled** | Dev client |
| Production | Vercel production | Production Supabase | Enabled | Production client, test users added |

Preview deployments never touch production data and never run scheduled jobs. This is a hard rule, not a convention.

**Temporary owner-approved exception (2026-11-01):** preview and production
currently share Supabase project `hkexglskvqaaeouvfdwm`. The owner has explicitly
deferred provisioning a separate project. Treat this hosted database as
production: never reset it, apply development fixtures to it, or run mutation
tests against it. Preview application writes can affect live data; sharing does
not provide isolation. Cron remains disabled outside production. Restore the
separate-project arrangement when the owner requests the environment split.
Synthetic fixtures and behavioral database tests run only in isolated GitHub
Actions PostgreSQL databases; no database or Docker installation is required on
the office laptop.

### 15.2 Pipeline

```
push → Vercel build
         ├─ typecheck
         ├─ lint
         ├─ unit + integration tests
         ├─ build
         ├─ client bundle secret scan      ← fails the build on any hit
         └─ deploy (preview or production)
              └─ post-deploy: Playwright + axe + Lighthouse against the URL
```

Database migrations are applied through the Supabase CLI as an explicit step before the deployment that depends on them. Migrations are forward-only and backward-compatible within a release, so a rollback of application code never leaves the schema ahead in a breaking way.

For the temporarily shared hosted database, the
[manual migration workflow](./.github/workflows/migrate-development.yml) runs
the CLI on GitHub's runner; developers do not need a local database. It is
restricted to the default branch and the legacy `supabase-development` GitHub
environment, previews changes by default, and applies only when explicitly
selected with acknowledgement that the target serves the live site.
See [DATABASE.md §9.2](./DATABASE.md) for secret setup and verification.
Production migration automation remains unconfigured.

### 15.3 Release checklist

Mapping directly to `PRD §17`:

- [ ] All migrations applied; RLS verified enabled on every table (`L4`)
- [ ] Brand profile seeded with real Apexoria content
- [ ] All environment variables set in Vercel production
- [ ] Google OAuth production client configured; redirect URIs exact; test users added
- [ ] `CRON_SECRET` set; cron schedule registered; a manual invocation succeeds
- [ ] Secret scan passes (`L3`)
- [ ] Full month generated end-to-end on production with valid output for every day (`L6`)
- [ ] Lighthouse mobile thresholds met (`L5`)
- [ ] PWA installs on both iOS and Android with correct icon and splash
- [ ] Journeys J1, J2, J3 pass against production (`L2`)
- [ ] No known high-severity bug or security finding (`L7`)

### 15.4 Operating the system

- **Daily:** the owner sees the run log in Settings; a failure is visible as an in-app banner.
- **Monthly:** planning runs automatically on `PLAN_DAY_OF_MONTH`; the manual trigger exists as a fallback.
- **Rollback:** Vercel instant rollback for application code. Data is never destructively migrated in v1, so a code rollback is always safe.
- **Adding a user:** grant access in `/admin/users` (role and AI permission included). If the Google consent screen is in testing mode, also add the account as a Cloud Console test user. No deployment required.
- **Changing feed sources, platforms, pillars, prompts or tuning limits:** `/admin/filters` (news), `/admin/platforms`, `/admin/pillars`, `/admin/prompts` and `/admin/settings`; changes apply to the next request. Environment variables remain the defaults.
- **Adding or retiring a platform:** `/admin/platforms`. No migration or deployment; a new custom glyph is the only part that needs code.

---

## 16. Future scalability — explicitly out of v1

These are recorded so v1 does not pre-build them. **None may influence v1 implementation.** Each is reachable from the architecture above without a rewrite.

| Future need | Change required | Why v1 is not blocked |
|---|---|---|
| **Auto-publishing** (`D11`) | A `publish/` service module, platform OAuth token storage, and a second cron stage | Publishing is a new service beside `ai/` and `news/`; the data model already records intent and timing |
| **AI image generation** (`D7`) | An image generator in `ai/`, Supabase Storage for assets, an `asset_url` column | The design brief already encodes everything an image generator would need as a prompt |
| **Analytics feedback loop** | A `post_metrics` table, platform API ingestion, metrics fed into the context prompt layer | The prompt's Context layer (§9.2) is the designed insertion point |
| **Read-only Designer role** (`DR-1`) | A `user_roles` table and tightened RLS policies on mutations | Attribution and authorization are already separate concepts (§6.3) |
| **Multiple brands** | A `brand_id` foreign key across content tables and RLS scoped to brand membership | Everything already hangs off a single `brand_profile`; the join column is additive |
| **Higher generation volume** | Vercel Pro allows sub-daily cron frequency and longer durations; raise the hydration batch budget | The bounded-batch design (§4.3) scales by changing one number |
| **Push notifications** | Web Push subscriptions plus a notification stage in the daily cron | The service worker already exists |
| **External designer share links** | Signed, expiring, read-only tokens on a separate public route | Content has no per-user ownership, so read-only exposure is a policy change, not a model change |

**The architectural bet:** every one of these is additive. None requires changing how content is generated, stored, validated or secured. That is the test this architecture was designed to pass, and the reason it refuses to add infrastructure the current product does not need.

---

**Preceded by:** `PRD.md` — product requirements · `DESIGN.md` — visual and interaction design.
