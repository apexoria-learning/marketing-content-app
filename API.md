# API.md — Apexoria Content Co-pilot

**Source of truth for:** every communication surface — internal (browser ↔ server) and external (server ↔ third parties).
**Derived from:** `PRD.md` v1.0, `ARCHITECTURE.md` v1.0, `DATABASE.md` v1.0.
**Scope:** MVP (v1).

---

## 1. API philosophy

### 1.1 There is almost no API

The instinct on reading "API documentation" is to expect a REST surface. This product deliberately has nearly none, and that is the most important thing to understand before implementing anything here.

`ARCHITECTURE.md` §3.3 establishes that reads happen inside React Server Components, which query Postgres directly during render. **A read never crosses a network boundary as JSON.** There is no `GET /api/content` because there is no client that needs one — the content arrives already rendered.

Writes are Server Actions: typed function calls that Next.js transports over HTTP without the developer authoring an endpoint. They are *not* a public API, and nothing outside the application may call them.

The result is a deliberately tiny public surface:

| Surface | Count | Public? |
|---|---|---|
| HTTP route handlers | **3** | Yes — but two are authenticated and one returns nothing useful |
| Server Actions | **9** | No — internal RPC, session-bound |
| Outbound integrations | **4** | N/A |
| Inbound webhooks | **0** | — |

Every endpoint that does not exist is an endpoint that cannot be enumerated, fuzzed, rate-limit-bypassed or left unauthenticated. For a product whose primary risks are AI spend (`R4`) and unauthorised access (`NFR-2`), minimising the surface *is* the security control.

### 1.2 The read API is the URL

Because Server Components read from `searchParams`, **the URL query string is the read contract.** This is easy to miss and is where RSC applications usually go wrong: search params are untrusted user input that reaches a database query, exactly like a request body.

Therefore every search param in §6 is parsed through Zod with an explicit allowlist and a safe fallback. An unrecognised or malformed parameter is **ignored and replaced with its default**, never echoed back and never passed through to a query. A filter value is never interpolated into SQL — it is validated against an enum and passed as a bound parameter.

### 1.3 Conventions

| Convention | Rule |
|---|---|
| Transport | HTTPS only; HSTS enforced |
| Encoding | UTF-8; `application/json` for route handler responses |
| Dates | `date` as `YYYY-MM-DD`; timestamps as RFC 3339 UTC |
| Timezone | All user-facing date logic is **IST (UTC+05:30)**; storage and transport are UTC |
| Casing | `snake_case` in database and JSON payloads; `camelCase` in TypeScript |
| Identifiers | `uuid` for content entities; opaque to clients |
| Idempotency | Every scheduled and generation operation is idempotent (`FR-5.3`) |
| Secrets | Never in a URL, never in a response body, never in a client bundle (`NFR-2.1`) |

---

## 2. Authentication and authorization

### 2.1 Three callers, three mechanisms

| Caller | Identity | Mechanism | Privilege |
|---|---|---|---|
| **Team member** | Google account | Supabase session in `httpOnly` cookies | `authenticated` — full product capability, RLS applies |
| **Vercel Cron** | System | `Authorization: Bearer <CRON_SECRET>` | `service_role` — bypasses RLS |
| **Anyone else** | None | — | Nothing. `anon` returns zero rows from every table (`DATABASE.md` §7.2) |

### 2.2 The authorization rule

`PRD §12` defines one role with full capability. Consequently:

> **Authorization checks answer "is this a valid, allowlisted team member?" — never "does this person own this row?"**

There are no ownership predicates because content belongs to the business. `posted_by` and `actor_email` are attribution, not authorization (`DATABASE.md` §7.1).

### 2.3 Enforcement, per surface

Three independent layers (`ARCHITECTURE.md` §6.2), and **every mutating surface re-verifies independently**:

| Surface | Layer 1 | Layer 2 | Layer 3 |
|---|---|---|---|
| Protected pages | `middleware.ts` redirect | `(app)/layout` session + allowlist check | RLS |
| Server Actions | — | **Own session + allowlist check** | RLS |
| `/api/cron/daily` | — | Bearer secret, constant-time compare | — (uses `service_role`) |
| `/auth/callback` | — | OAuth code exchange + allowlist | RLS |

**Server Actions must never rely on middleware.** They are independently addressable HTTP endpoints identified by an action ID; a request can reach one without traversing a page route. Treating middleware as sufficient protection for Server Actions is the single most common critical vulnerability in Next.js App Router applications. Every action therefore begins with its own session verification (§5.2).

### 2.4 Server Action transport hardening

- `serverActions.allowedOrigins` is configured to the production host. Next.js compares `Origin` against `Host` to block cross-site invocation; behind Vercel's proxy this must be set explicitly or the check can be bypassed.
- Action IDs are build-generated and unguessable, but are treated as **obscurity, not security** — authorization is always re-checked in the action body.
- Actions accept only serialisable primitives and plain objects. No client-supplied object is ever spread into a database write; fields are picked explicitly after validation.

---

## 3. HTTP route handlers

Three endpoints. Each is listed with its complete contract.

### 3.1 `GET /auth/callback`

OAuth redirect target. Completes Google sign-in and enforces the allowlist.

| Property | Value |
|---|---|
| Auth | OAuth authorization code + PKCE verifier cookie |
| Rate limited | No (Supabase Auth applies its own limits) |
| Idempotent | No — a code is single-use |

**Query parameters**

| Param | Type | Required | Notes |
|---|---|---|---|
| `code` | string | Yes | Single-use authorization code |
| `error` | string | No | Present when the user cancels or Google rejects |
| `next` | string | No | Post-login destination |

**Behaviour**

1. If `error` is present → redirect to `/sign-in?error=oauth`. Log the failure without recording raw provider messages, codes from query strings, tokens, or credentials.
2. Exchange `code` for a session using the PKCE verifier held in an `httpOnly` cookie. Failure → `/sign-in?error=exchange`.
3. Read the email from the established session.
4. **Allowlist check** (`FR-1.3`): if `ALLOWED_EMAILS` is non-empty and the email is absent from it → sign out server-side, clear cookies, redirect to `/no-access`. The session must be destroyed, not merely redirected away from.
5. Set session cookies: `httpOnly`, `secure` in production, `sameSite=lax`, host-only, with a seven-day lifetime. Middleware refreshes the session and cookie as needed; Supabase Auth's refresh-token lifetime remains the upper bound.
6. Redirect to the validated `next` destination, else `/`.

Denied callbacks and authenticated actions clear the project's token chunks and
PKCE verifier cookies even if remote sign-out returns an error. Middleware applies
the same local-cookie cleanup to denied page requests. Layouts remain read-only
and independently reject denied sessions. Missing or invalid sessions map to
`UNAUTHENTICATED`; upstream auth outages map to `UNEXPECTED`.

**Responses**

| Outcome | Status | Location |
|---|---|---|
| Success | 302 | `next` or `/` |
| Provider error / exchange failure | 302 | `/sign-in?error=…` |
| Not allowlisted | 302 | `/no-access` (session destroyed) |

> **Open-redirect defence.** `next` is attacker-controllable. It is accepted **only** if it begins with a single `/` and not `//` or `/\`. Anything else is discarded in favour of `/`. Absolute URLs are never honoured, and the value is never reflected into the response body.

### 3.2 `GET /api/cron/daily`

The scheduled job (`ARCHITECTURE.md` §4.5). The only endpoint that runs with `service_role`.

| Property | Value |
|---|---|
| Auth | `Authorization: Bearer <CRON_SECRET>` |
| Invoked by | Vercel Cron (once daily, UTC, best-effort within the hour) |
| `maxDuration` | 300 seconds; self-limits to a ~240s work budget |
| Idempotent | **Yes** — safe to re-run any number of times |
| Rate limited | No (bearer-gated, single caller) |

**Authentication rules**

- The header is compared in **constant time**. A naive `===` leaks secret length and prefix through timing.
- Failure returns `401` with an **empty body** — no `WWW-Authenticate`, no hint, no error object. The endpoint reveals nothing about itself to an unauthenticated caller.
- `CRON_SECRET` is read from the environment and validated at boot (`ARCHITECTURE.md` §11); a missing value fails closed, never open.
- The endpoint does not trust `x-vercel-*` headers for authentication — those are not a security boundary.

**Stages** — executed in dependency order, each failure-isolated:

| # | Stage | Idempotency key | On failure |
|---|---|---|---|
| 1 | Ingest news | `news_items.url_hash` unique | Per-feed isolation; log and continue (`FR-3.6`) |
| 2 | Daily tip | `daily_tips.tip_date` unique | Log; continue to stage 3 |
| 3 | Month planning (only when IST day-of-month = `PLAN_DAY_OF_MONTH` and the target month has no plan) | `content_plans.plan_month` unique | Log; continue to stage 4 |
| 4 | Hydrate batch | `status = 'idea'` query | Per-item isolation; item stays `idea` with `generation_error` set |

All date logic derives from the **actual run timestamp converted to IST**, never from the cron expression, because Hobby schedules are UTC and drift within the hour.

**Response shape**

```json
{
  "ok": true,
  "ran_at": "2026-10-31T01:12:44Z",
  "stages": [
    { "stage": "news_ingest",    "status": "success", "processed": 12, "duration_ms": 3180 },
    { "stage": "daily_tip",      "status": "success", "processed": 1,  "duration_ms": 2410 },
    { "stage": "month_planning", "status": "skipped", "reason": "not_plan_day" },
    { "stage": "hydration",      "status": "partial", "processed": 23, "failed": 1, "duration_ms": 198400 }
  ]
}
```

| Outcome | Status |
|---|---|
| At least one stage succeeded | `200` |
| Every stage failed | `500` — so Vercel's retry signal reflects genuine failure |
| Bad or missing bearer | `401`, empty body |

The response contains **only counts and durations** — never generated content, never error detail beyond a stage status. A `generation_runs` row is written per stage regardless of outcome (`DATABASE.md` §5.7).

### 3.3 `GET /api/health`

| Property | Value |
|---|---|
| Auth | None |
| Response | `200` with `{ "status": "ok" }` |

Deliberately static. It performs **no database query**, reports **no version, commit, dependency status or environment name**, and never returns `503`. A health endpoint that queries the database on every unauthenticated request is a free amplification vector and a free availability oracle. Real health signal comes from `generation_runs` and the in-app failure banner (`ARCHITECTURE.md` §12.3).

---

## 4. Server Actions — conventions

### 4.1 The result envelope

Every action returns a discriminated union. **Actions never throw across the client boundary**, because React reduces production errors to an opaque digest, which makes the specific recovery guidance in `DESIGN.md §9.3` impossible to render.

**Success**

| Field | Type | Notes |
|---|---|---|
| `ok` | `true` | Discriminant |
| `data` | object | Action-specific, may be omitted |

**Failure**

| Field | Type | Notes |
|---|---|---|
| `ok` | `false` | Discriminant |
| `code` | error code | From the fixed set in §4.4 |
| `message` | string | **User-safe**, already matching `DESIGN.md` copy |
| `fields` | object | Only for `VALIDATION` — field name → message |
| `retry_after` | string | Only for `RATE_LIMITED` — RFC 3339 reset time |
| `saved` | `true`, optional | Service succeeded but revalidation failed; reload, never retry the mutation |

`message` is written for display, not for developers. It never contains a stack trace, model name, provider name, table name, SQL fragment or internal identifier (`PRD §15.3`).

### 4.2 The mandatory pipeline

Every action, without exception, runs these six steps via a shared wrapper so none can be accidentally omitted:

```
1. Verify session        → UNAUTHENTICATED
2. Verify allowlist      → FORBIDDEN
3. Validate input (Zod)  → VALIDATION
4. Consume rate limit    → RATE_LIMITED        (where applicable)
5. Delegate to a service → GENERATION_FAILED | UNEXPECTED
6. Revalidate paths, return typed result
```

Steps 1 and 2 are repeated inside the action even though middleware and the layout already performed them (§2.3).

The shared wrapper lives in `server/actions/run-action.ts`; the generic result
contract is client-safe in `lib/schemas/action-result.ts`. Its optional quota step
is supplied by AI actions when they land in Phase 11. Existing zero-cost actions
omit that step (§7.5). If revalidation fails after the service succeeds, the
failure message explicitly says the changes were saved and asks for a reload.
The `saved: true` discriminator makes this recovery machine-readable. Transport failures with no result also ask for reload because the client cannot know whether the write committed.

OAuth initiation and sign-out are redirecting authentication operations, not
authenticated business mutations: requiring a session or allowlist would prevent
login or prevent a denied account from signing out. They use the documented
sign-in/no-access redirects rather than the business-action result envelope.
Sign-out always clears local auth cookies; an unsuccessful remote revocation is
reported on sign-in without claiming the remote session was revoked.

### 4.3 Validation conventions

| Rule | Detail |
|---|---|
| Parse, don't validate | Zod `.parse()` produces the typed value used downstream; the raw input is discarded |
| Strict objects | Unknown keys are **rejected**, not stripped — an unexpected field signals a client/server mismatch worth surfacing in development |
| Explicit field picking | Validated objects are never spread into a database write |
| Trim and bound | All free text is trimmed; every string field has a maximum length |
| Enum coercion | `platform`, `format`, `pillar`, `status` validate against the enums in `DATABASE.md` §4 |
| Date validation | Dates parse as calendar dates in IST, then convert to UTC for storage |
| Null vs absent | Absent means "do not change"; explicit `null` means "clear" |

**Field limits**

| Field | Max |
|---|---|
| `note` | 280 characters |
| `skip_reason` | 280 characters |
| `steer` (regeneration instruction) | 500 characters |
| Brand profile text fields | 2,000 characters |
| Brand profile array entries | 40 entries × 200 characters |

Limits exist because `steer` and brand profile fields are **interpolated into AI prompts**. An unbounded field is both a cost vector and a prompt-injection surface (§8.5).

### 4.4 Error codes

Identical to `ARCHITECTURE.md` §12.1 — this is the canonical mapping.

| Code | Cause | UI treatment (`DESIGN.md §9.3`) |
|---|---|---|
| `UNAUTHENTICATED` | Missing or expired session | Redirect to `/sign-in` |
| `FORBIDDEN` | Valid session, not allowlisted | Redirect to `/no-access` |
| `VALIDATION` | Input failed schema or business rule | Inline field error |
| `RATE_LIMITED` | Per-user or global cap reached | **Bottom sheet**, not a toast — includes reset time |
| `GENERATION_FAILED` | AI failed after retries and repair | Banner: "Generation didn't complete. Nothing was changed." |
| `UNEXPECTED` | Anything else | "Something went wrong on our side." |

Database constraint violations (`DATABASE.md` §5.3) surface as `VALIDATION` with a mapped, user-safe message — for example, a slot collision becomes "This day already has two pieces planned," never a raw constraint name.

### 4.5 Revalidation

Actions call `revalidatePath` for every affected route so Server Components re-render with fresh data.

| Action | Revalidates |
|---|---|
| `markPosted`, `skipItem` | `/`, `/calendar`, `/create`, `/archive`, `/item/[id]` |
| `regenerateItem`, `hydrateItem` | `/item/[id]`, `/`, `/create` |
| `planMonth`, `generateForDay` | `/`, `/calendar`, `/create` |
| `updateBrandProfile` | `/settings` |

---

## 5. Server Actions — catalogue

Nine actions. Eight carried over from `ARCHITECTURE.md` §7.2, plus `addNote`, with one signature refinement — both noted inline below.

### 5.1 Content status

**`markPosted`** — `US-13`

| | |
|---|---|
| Input | `item_id` (uuid), `posted` (boolean), `note` (string ≤280, optional) |
| Returns | `{ posted_at, month_progress: { posted, planned } }` |
| Rate limited | No — zero AI cost, and friction here directly harms metric `M1` |
| Side effects | Sets `status`, `posted_at`, `posted_by`; appends `activity_log` atomically |

Business rules: the status transition must be legal (`ready → posted`, `posted → ready`); an `idea` must first be hydrated to `ready` (`PRD §13`, `DATABASE.md §7.7`). Illegal transitions are rejected by trigger and mapped to `VALIDATION`. `posted_by` is taken **from the session**, never from input. The action returns updated month progress so the ring in `DESIGN.md §6.4` advances without a second round trip.

**`skipItem`** — `US-15`

| | |
|---|---|
| Input | `item_id`, `skipped` (boolean), `reason` (string ≤280, optional) |
| Returns | `{ status }` |
| Rate limited | No |

> **Refinement over `ARCHITECTURE.md` §7.2**, which listed a one-way `skipItem`. `DATABASE.md` §7.7 permits `skipped → ready`, and `US-15` implies reversibility. A boolean toggle matches `markPosted`, keeping the two status actions symmetrical rather than inventing a separate `unskipItem`.

**Approved Phase 7 staging:** `skipItem` currently rejects unfinished ideas before calling the RPC, because restoring them to Ready requires AI hydration that is not enabled yet. The UI explains the restriction and disables Skip. Ready/hydrated items remain reversibly skippable. This is an application-layer staging rule; the database's documented lifecycle is unchanged.

**`addNote`**

| | |
|---|---|
| Input | `item_id`, `note` (string ≤280) |
| Returns | `{ ok }` |
| Rate limited | No |

> **Addition to `ARCHITECTURE.md` §7.2.** `US-13 AC4` and `US-14 AC2` require notes to be attachable and readable in the archive, but no action carried that capability. Folding it into `markPosted` alone would make it impossible to annotate an item after posting.

Appends a `note_added` row to `activity_log`. Notes are **never written onto `content_items`** — posted items are content-immutable (`DATABASE.md` §7.7), and the archive reads notes from the log (`US-14 AC2`).

`markPosted` and `skipItem` use the atomic `change_content_status` database
function; a failed audit insert rolls back the status change. The optional
`markPosted` note is included in that same transaction.

### 5.2 Generation

All four consume the shared AI rate-limit budget (§7).

**`regenerateItem`** — `US-11`

| | |
|---|---|
| Input | `item_id`, `steer` (string ≤500, optional) |
| Returns | The refreshed item payload |
| Rate limited | **Yes** — per user per day (`REGEN_DAILY_LIMIT`, default 20) |
| Typical duration | 10–20s (`NFR-1.3`) |

Rules: **blocked when `status = 'posted'`** (`US-11 AC3`) — enforced in the service *and* by the `protect_posted_content` trigger. Preserves `scheduled_date`, `slot`, `platform` and `pillar`. Increments `regenerated_count`, which feeds metric `M5`. The previous version is recorded in `activity_log` (`US-11 AC4` / `PRD §16` — history is logged but not browsable in v1). On failure, **the existing item is unchanged** (`NFR-3.2`).

**`hydrateItem`**

| | |
|---|---|
| Input | `item_id` |
| Returns | The hydrated item payload |
| Rate limited | Yes — shares the regeneration budget |

Just-in-time hydration (`ARCHITECTURE.md` §4.3) when a user opens an item still in `idea`. A no-op returning success if the item is already hydrated, so a double-tap or a race with the cron is harmless.

**`planMonth`** — `FR-5.5`

| | |
|---|---|
| Input | `month` (`YYYY-MM`) |
| Returns | `{ plan_id, item_count }` |
| Rate limited | **Yes** — low global daily cap |

Generates the skeleton only (phase 1); hydration follows via cron or on demand. Idempotent through the `content_plans.plan_month` unique constraint — a second call for an existing month returns `VALIDATION` with "This month is already planned." Bounded by `PLANNING_HORIZON_MONTHS` (default 2); a request beyond the horizon is rejected. Runs the deterministic planning-rule validator (`ARCHITECTURE.md` §4.4) before any insert; a plan that cannot be repaired is **rejected whole, writing nothing**.

**`generateForDay`**

| | |
|---|---|
| Input | `date` (`YYYY-MM-DD`), `count` (1 or 2, default 1) |
| Returns | `{ item_ids }` |
| Rate limited | Yes |

Fills an empty day (`DESIGN.md §9.2`). Rejects with `VALIDATION` if the day already holds two items — the `(scheduled_date, slot)` unique constraint is the backstop.

### 5.3 Configuration

**`updateBrandProfile`** — `US-16`

| | |
|---|---|
| Input | Partial brand profile; absent fields unchanged |
| Returns | `{ updated_at }` |
| Rate limited | No |

Autosaves on blur (`DESIGN.md §8`). Sets `updated_by` from the session. Affects only **subsequent** generations — never rewrites existing items (`US-16 AC3`).

**`setTheme`**

| | |
|---|---|
| Input | `theme` (`dark` \| `light` \| `system`) |
| Returns | `{ ok }` |

Writes a cookie only. No database access, no AI, no rate limit.

### 5.4 Capability matrix

| Action | Session | Allowlist | Rate limited | AI | Writes |
|---|---|---|---|---|---|
| `markPosted` | ✅ | ✅ | — | — | items, log |
| `skipItem` | ✅ | ✅ | — | — | items, log |
| `addNote` | ✅ | ✅ | — | — | log |
| `regenerateItem` | ✅ | ✅ | ✅ | ✅ | items, log, runs |
| `hydrateItem` | ✅ | ✅ | ✅ | ✅ | items, log, runs |
| `planMonth` | ✅ | ✅ | ✅ | ✅ | plans, items, runs |
| `generateForDay` | ✅ | ✅ | ✅ | ✅ | items, runs |
| `updateBrandProfile` | ✅ | ✅ | — | — | brand_profile |
| `setTheme` | ✅ | ✅ | — | — | cookie only |

---

## 6. Read contracts — filtering and pagination

Reads happen in Server Components (§1.2). The contract is the URL.

### 6.1 Search parameters

| Route | Param | Values | Default |
|---|---|---|---|
| `/calendar` | `month` | `YYYY-MM` | current month (IST) |
| | `platform` | `instagram` \| `linkedin` \| `whatsapp` | all |
| | `pillar` | one of ten (`DATABASE.md` §4) | all |
| | `status` | `idea` \| `ready` \| `posted` \| `skipped` | all |
| `/create` | `format` | `carousel` \| `reel` \| `post` \| `story` \| `meme` \| `poll` | all |
| | `platform` | as above | all |
| `/archive` | `scope` | `this_month` \| `last_month` \| `all` | `this_month` |
| | `platform`, `pillar`, `format` | as above | all |
| | `cursor` | opaque keyset cursor | none |

Every value is parsed against an enum allowlist. **Invalid input is silently replaced with the default** — never echoed, never passed to a query. This closes reflected-XSS and injection vectors at the only point where untrusted input reaches a read path.

### 6.2 Pagination — exactly one place

Activity history is fetched internally in 500-row keyset batches ordered by `created_at DESC, id DESC`, so item detail and Archive do not silently truncate notes at the PostgREST response cap. This does not introduce a second user-facing pagination control.

`PRD` states nothing about pagination because at planned volume most screens do not need it (`DATABASE.md` §6.1):

| Screen | Max rows | Paginated |
|---|---|---|
| Today | 2 | No |
| Calendar | ~62 (one month) | No |
| Create | bounded by pending work, ~60 | No |
| Settings run log | fixed last 20 | No |
| **Archive — `scope=all`** | ~720/year, growing indefinitely | **Yes** |

Archive uses **keyset (cursor) pagination**, not offset:

- Page size **30**, ordered by `posted_at DESC, id DESC`.
- The cursor is a base64url encoding of the last row's `(posted_at, id)`.
- Response includes `next_cursor`, omitted on the final page.
- A malformed or tampered cursor is **discarded and treated as page one**, never surfaced as an error.

Archive contains posted items only. Scope dates use `posted_at` and IST month boundaries, not scheduled dates. Counts cover the complete filtered scope rather than the current cursor page; head-only exact counts avoid PostgREST's row-return cap.

Keyset is chosen over `OFFSET` because it maps exactly onto `idx_content_items_posted` (`DATABASE.md` §6.3), has stable performance as the archive grows, and — more importantly — cannot skip or duplicate rows when an item is marked posted mid-scroll, which `OFFSET` does.

---

## 7. Rate limiting

### 7.1 Purpose

Rate limiting exists to protect **AI spend** (`R4`, `NFR-6.3`), not to protect capacity. The app has fewer than ten users; there is no traffic to shed. A single accidental loop in a regeneration button could otherwise cost real money.

### 7.2 Design

Enforced by `consume_rate_limit`, a `SECURITY DEFINER` Postgres function (`DATABASE.md` §7.6).

| Property | Value |
|---|---|
| Storage | `rate_limits` table — **no RLS policies**, unreachable except via the function |
| Atomicity | Read, compare and increment in one statement; concurrent calls cannot both pass a limit of one |
| Window | Fixed daily window, **IST midnight boundary**, so "resets at midnight" means the user's midnight |
| Identity | `actor_key` = session email, or the literal `global` |

A user can neither read nor modify their own quota. That is the point of routing it through a definer function rather than a normal table.

### 7.3 Limits

| Scope | Key | Limit | Config |
|---|---|---|---|
| Per user, per day | `<email>:ai_generate` | 20 | `REGEN_DAILY_LIMIT` |
| Global, per day | `global:ai_generate` | 100 | `GLOBAL_DAILY_AI_LIMIT` |
| Global, per day | `global:plan_month` | 5 | — |

`regenerateItem`, `hydrateItem`, `planMonth` and `generateForDay` all consume the same per-user `ai_generate` budget. A single shared budget is correct: the user's mental model is "how much AI can I use today", not a per-feature allowance, and it prevents working around a limit by switching actions.

The global cap is the backstop. It bounds total daily spend even if every user exhausts their individual allowance, and even if the allowlist were compromised.

### 7.4 Behaviour at the limit

- Returns `RATE_LIMITED` with `retry_after` set to the next IST midnight.
- `DESIGN.md §9.3` renders this as a **bottom sheet, not a toast** — it is information the user must read, and the reset time matters.
- **No AI call is made**, so a limited request costs nothing.
- The cron path is **not** rate limited: it is bearer-gated, single-caller, and self-bounded by its ~240s work budget.

### 7.5 What is not rate limited

`markPosted`, `skipItem`, `addNote`, `updateBrandProfile` and `setTheme` are unlimited. They cost nothing, and friction on `markPosted` would directly damage metrics `M1` and `M2` — the opposite of what the product is for. Abuse potential is nil behind an allowlisted Google login.

---

## 8. External integrations

Four outbound integrations. None is in the critical path for reading content.

### 8.1 Portkey AI Gateway → Claude Sonnet

| Property | Value |
|---|---|
| Direction | Outbound only |
| Caller | `server/ai/client` — **the only module that knows Portkey exists** |
| Credentials | `PORTKEY_API_KEY`, `PORTKEY_VIRTUAL_KEY` — server-only (`NFR-2.2`) |
| Model | `AI_MODEL` — configuration, not code |
| Timeout | 60s per request |
| Retries | 2, exponential backoff, at the gateway |
| Streaming | **No** — output must be validated whole before use |

**Why a gateway rather than calling the provider directly:** retries, timeouts, fallbacks and per-request token/cost accounting live at the gateway instead of in application code, and the provider credential is held by Portkey rather than in the application's environment. Switching models becomes a configuration change.

**Request composition** (`ARCHITECTURE.md` §9.2): system layer (role, brand profile, tone rules, hard constraints) → context layer (recent `news_items`, pillar history, 60-day posted ideas) → task layer (instruction plus output schema) → optional steer layer. Structured output is requested via JSON/tool schema.

**Response handling** — model output is **Zone 0, untrusted** (`ARCHITECTURE.md` §13.1):

```
parse  → fail → one repair attempt echoing the parse error
validate (Zod) → fail → one repair attempt naming invalid fields
business rules (§4.4 of ARCHITECTURE) → fail → repair, then reject
persist
```

Invariants: nothing partial is ever written; a failed item remains `idea` with `generation_error` set; **source URLs are cross-checked against ingested `news_items` and fabricated URLs are stripped** — if none survives on a news item, the item fails validation (`DATABASE.md` §5.3).

**Cost accounting:** `input_tokens`, `output_tokens` and `estimated_cost_usd` are written to `generation_runs` per call (`NFR-6.4`).

**Failure:** timeout, 429 or persistent error → `GENERATION_FAILED`, **nothing changed**. The failure is recorded and surfaced as an in-app banner so it is never silent (`FR-2.6`).

### 8.2 Supabase — Postgres and Auth

| Property | Value |
|---|---|
| Client credentials | `NEXT_PUBLIC_SUPABASE_ANON_KEY` — powerless without a session (RLS) |
| Privileged credential | `SUPABASE_SERVICE_ROLE_KEY` — **used in `/api/cron/daily` only** |
| Access | Server runtime only; the browser never queries the database directly |

The service-role key bypasses RLS and is the highest-value secret in the system. It is constructed behind an explicitly named function in `server/db/` and is unreachable from any Server Action or Server Component (`ARCHITECTURE.md` §5.3).

**Failure:** read failure → service-worker cached view plus retry (`DESIGN.md §9.2`); write failure → optimistic state rolled back with an `Undo` toast.

### 8.3 Google OAuth — via Supabase Auth

| Property | Value |
|---|---|
| Flow | Authorization code with PKCE |
| Credentials | Client ID and secret held by **Supabase**, not by the application |
| Scopes | `openid`, `email`, `profile` — the minimum needed to identify an allowlisted user |
| Access control | Google Cloud Console test users (`D3`) + server-side `ALLOWED_EMAILS` |

Only the email address is retained; no Google profile data is stored (`DATABASE.md` §8.1). Tokens are never read by application code.

**Failure:** inline error on the sign-in screen with a retry action; the provider error is logged, never displayed.

### 8.4 Salesforce news feeds — RSS/Atom

| Property | Value |
|---|---|
| Direction | Inbound, scheduled, read-only |
| Source | `NEWS_FEED_URLS` — **configuration, so sources change without a deploy** |
| Credentials | None (public feeds) |
| Timeout | 10s per feed |
| Retries | 1 |
| Isolation | **Per-feed** — one failure never blocks the others (`FR-3.6`) |

**Fetch conventions**

- Conditional requests using stored `ETag` / `If-Modified-Since`; `304` short-circuits parsing.
- Descriptive `User-Agent` identifying the application.
- Response body capped at **2 MB**; oversized responses are abandoned, not buffered.
- Redirects followed to a maximum of 3, and **only to `https://` on public hosts**.

**Parsing safety**

- XML is parsed with external entity resolution **disabled** — XXE in an RSS feed is a real and well-exercised attack path.
- Entry count capped per feed per run.
- URLs validated as `http(s)` before storage, matching the `CHECK` in `DATABASE.md` §5.5, so a `javascript:` URL can never become a tappable source link.
- Titles and summaries are stored as plain text; any HTML is stripped, never rendered.

**SSRF posture:** feed URLs are operator-configured, not user-supplied, which removes the usual SSRF surface. The scheme allowlist, public-host requirement and redirect cap exist so that a compromised or hijacked feed domain still cannot pivot into internal network space.

**Failure:** generation proceeds **without** news grounding and **never invents news** (`FR-3.3`, risk `R2`). A pillar that cannot be grounded is planned around rather than fabricated.

---

## 9. Webhooks

**There are no inbound webhooks in v1.**

This is worth stating explicitly, because it is a common assumption and because it is a deliberate choice. Nothing in `PRD §16`'s MVP scope requires a third party to push data in:

| Candidate | Status |
|---|---|
| Social platform engagement callbacks | Out of scope — no analytics in v1 (`PRD §16`) |
| Publishing confirmations | Out of scope — no auto-publishing (`D11`) |
| Supabase database webhooks | Not used — all writes already flow through the application |
| Supabase auth hooks | Not used — the allowlist is enforced in `/auth/callback` |

`/api/cron/daily` is a **scheduled GET with a shared secret**, not a webhook: there is no third-party payload, no signature to verify, and no replay surface beyond an idempotent re-run.

### 9.1 Posture for future webhooks

When auto-publishing arrives (`ARCHITECTURE.md` §16), inbound webhooks from Meta and LinkedIn will require controls this version does not need. Recording them now prevents them being improvised later:

1. **Verify the signature before parsing the body**, using the raw bytes and a constant-time comparison. Parsing first is how signature verification gets silently bypassed.
2. **Reject stale timestamps** (±5 minutes) to bound replay.
3. **Deduplicate on the provider's event ID**, persisted, because every provider delivers at-least-once.
4. **Respond `2xx` quickly**, then process asynchronously; providers disable endpoints that time out.
5. **Treat the payload as untrusted input** — Zone 0, same as model output.
6. **One endpoint per provider**, never a shared multiplexer.

---

## 10. Environment variables

Canonical list (`ARCHITECTURE.md` §11), annotated with the integration each serves.

| Variable | Scope | Secret | Consumer | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | No | Supabase clients | Project endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | No | Supabase clients | RLS-constrained access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | **Yes** | `/api/cron/daily` only | Bypasses RLS |
| `PORTKEY_API_KEY` | Server | **Yes** | `server/ai/client` | Gateway auth |
| `PORTKEY_VIRTUAL_KEY` | Server | **Yes** | `server/ai/client` | Provider credential held at Portkey |
| `AI_MODEL` | Server | No | `server/ai/client` | Model identifier |
| `CRON_SECRET` | Server | **Yes** | `/api/cron/daily` | Bearer authentication |
| `ALLOWED_EMAILS` | Server | No | `/auth/callback`, action wrapper | Allowlist; empty disables layer 2 |
| `NEWS_FEED_URLS` | Server | No | `server/news` | Comma-separated feed list |
| `PLAN_DAY_OF_MONTH` | Server | No | Cron stage 3 | Default `25` (`DR-4`) |
| `REGEN_DAILY_LIMIT` | Server | No | Rate limiter | Default `20` (`DR-5`) |
| `GLOBAL_DAILY_AI_LIMIT` | Server | No | Rate limiter | Default `100` |
| `PLANNING_HORIZON_MONTHS` | Server | No | `planMonth` | Default `2` (`DR-6`) |
| `NEXT_PUBLIC_APP_URL` | Client + server | No | OAuth redirect, manifest | Canonical origin |

### 10.1 Rules

- **Only `NEXT_PUBLIC_*` may be referenced outside `server/`.** Enforced by an ESLint rule and by the build-time bundle scan that fails the build on any secret match (`NFR-2.1`, `L3`).
- All variables are read once through a **Zod-validated config module that fails fast at boot**. A missing `CRON_SECRET` must be a clear startup error, never an `undefined` that makes the comparison pass.
- `.env.example` is committed with names and comments and **no values**. Real values live only in `.env.local` (git-ignored) and Vercel's encrypted store.
- Secrets never appear in a URL, a log line, a response body or an error message.
- Rotation: `CRON_SECRET` and `PORTKEY_API_KEY` can be rotated with a redeploy and no code change. `SUPABASE_SERVICE_ROLE_KEY` rotation requires regenerating it in Supabase first.

---

## 11. Data privacy in transit

| Concern | Control |
|---|---|
| Personal data in API payloads | Only the session email, and only in attribution fields (`DATABASE.md` §8.2) |
| Email exposure to third parties | **Never sent to Portkey, Claude, or any feed.** Prompts contain brand and content context only |
| Content sent to the AI provider | Brand profile, pillar history, public news items — all business content, no personal data |
| Secrets in responses | Never. Route handler responses carry counts, statuses and durations only |
| Secrets in logs | Redacted; errors log codes and messages, never credentials |
| Third-party analytics | None in v1 (`NFR-2.10`) — no SDK receives content or user data |
| Transport | HTTPS with HSTS; session cookies `httpOnly`, `secure`, `sameSite=lax` |
| Client-visible state | The anon key is the only credential reaching the browser, and it returns nothing without a session |

> **The clearest privacy boundary in the system:** the AI provider receives marketing context and never receives user identity. `actor_email` and `posted_by` exist purely for internal attribution and never leave the database.

---

## 12. Failure handling

### 12.1 Principles

| Principle | Application |
|---|---|
| **Fail closed** | A missing secret, an unverifiable bearer token or an unparseable session denies access. Never degrade into permitting |
| **Fail isolated** | A failed feed does not stop ingestion; a failed stage does not stop the cron; a failed item does not stop the batch; a failed list leaves navigation working |
| **Fail visibly** | Every failure writes a `generation_runs` row; the last failure surfaces as an in-app banner (`FR-2.6`) |
| **Fail without corruption** | Generation either produces valid rows or changes nothing (`NFR-3.2`) |
| **Fail informatively** | The user is told whether data changed — "Nothing was changed" is information, not politeness |
| **Fail quietly outward** | No stack trace, model name, provider name, table name or ID reaches the client (`PRD §15.3`) |

### 12.2 Per-integration matrix

| Integration | Failure | Detection | Response | User experience |
|---|---|---|---|---|
| Portkey / Claude | Timeout, 429, invalid output | Gateway timeout, Zod failure | Retry ×2 → repair → abort | Banner: "Nothing was changed." + retry |
| Supabase read | Unavailable | Query error | Serve cached shell | Offline/error state + retry |
| Supabase write | Unavailable | Mutation error | Roll back optimistic state | Reverse animation + `Undo` toast |
| Google OAuth | Provider error | `error` param | Redirect with a safe code | Inline sign-in error + retry |
| RSS feed | Down, malformed, blocked | Timeout, parse error | Skip that feed, log, continue | Invisible — content is planned around it |
| Vercel Cron | Missed run | None required | **Self-heals next run** | Invisible |

### 12.3 Idempotency and retries

Every scheduled operation is idempotent, backed by database constraints rather than application bookkeeping (`DATABASE.md`):

| Operation | Idempotency key |
|---|---|
| News ingest | `news_items.url_hash` unique |
| Daily tip | `daily_tips.tip_date` unique |
| Month planning | `content_plans.plan_month` unique |
| Hydration | driven by `status = 'idea'` |
| Item insert | `(scheduled_date, slot)` unique |

Retries are bounded, backed off, and applied **only** to idempotent operations. There is no retry on `markPosted` beyond the user's own tap, because the optimistic UI already makes the state visible and the action is cheap to repeat.

**Catch-up is implicit.** Because every stage is driven by *current database state* rather than by "what should have happened on which date", a missed cron day needs no backfill logic. This is `ARCHITECTURE.md` A5 paying for itself, and it is why the system has no scheduling state to corrupt.

---

## 13. Verification checklist

API-layer release gates.

- [ ] Every Server Action independently verifies session and allowlist — not just middleware
- [ ] `serverActions.allowedOrigins` configured for the production host
- [ ] Unauthenticated request to every protected route redirects to `/sign-in`
- [ ] `/api/cron/daily` without a bearer returns `401` with an empty body
- [ ] Bearer comparison is constant time
- [ ] `/api/cron/daily` run twice produces no duplicate tips, plans or news rows
- [ ] `/api/health` performs no database query and leaks no version or environment detail
- [ ] `next` parameter on `/auth/callback` rejects `//evil.com`, `/\evil.com` and absolute URLs
- [ ] Non-allowlisted sign-in **destroys the session** before redirecting
- [ ] Every action returns the result envelope; none throws across the client boundary
- [ ] No error message contains a stack trace, model name, provider name, table name or ID
- [ ] Rate limit is atomic under concurrency and returns `retry_after`
- [ ] A rate-limited request makes **no** AI call
- [ ] `rate_limits` is unreachable as `authenticated` except via `consume_rate_limit`
- [ ] Invalid search params fall back to defaults and are never echoed
- [ ] Archive cursor pagination is stable while rows are marked posted mid-scroll
- [ ] Tampered cursor is treated as page one, not an error
- [ ] RSS parsing has external entities disabled; oversized bodies abandoned
- [ ] Fabricated source URLs are stripped; sourceless news items fail validation
- [ ] Build-time bundle scan confirms no secret reaches the client (`L3`)
- [ ] No personal data appears in any AI prompt

---

**Preceded by:** `PRD.md` · `DESIGN.md` · `ARCHITECTURE.md` · `DATABASE.md`.
