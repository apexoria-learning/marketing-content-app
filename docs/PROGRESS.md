# PROGRESS.md — Trailhead Simplified Content Co-pilot

**Status date:** 2026-11-22 · **Base commit:** `6a2965b` from `apexoria-learning/marketing-content-app`; the rebrand and repository move to `wishvesh-ujawane/Trailhead-Simplified` follow it
**Sources:** [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) (authoritative phase gates) · [PRD.md](./PRD.md) · codebase inspection · local test run.

> This document summarises what is built and what is not. Phase completion
> criteria and owner decisions remain authoritative in `IMPLEMENTATION-PLAN.md`.
> "Owner-confirmed" means reported by the owner, not independently measured.

---

## 1. Summary

| Area | State |
|---|---|
| Core product (sign-in, Today, Calendar, Create, Item, Archive, posting/skip/notes, PWA) | ✅ Built and signed off (Phases 0–7) |
| AI generation triggered by users (month/day planning, item hydration, regeneration) | ✅ Built; owner-confirmed working live (Group B, Phases 10–11) |
| AI client and news ingestion modules (Group A, Phases 8–9) | 🟡 Code complete; formal gates still open |
| In-app admin panel and universal catalogues (`US-16`–`US-19`) | ✅ Built (migrations `0015`–`0018`) |
| Scheduled daily job (cron), live news ingestion and daily-tip generation | ❌ Not started (Phase 12) |
| Settings screen `/settings` (S8) | ❌ Not built (some of it now lives in Admin) |
| Security hardening, test completion, production deployment, backups | ❌ Not started (Phases 14–16) |
| Industry templates and first-run setup wizard (universal roadmap step 4) | ❌ Not started |
| Trailhead Simplified rebrand (name, brand-kit tokens, YouTube platform, `short`/`video` formats, channel-plan profile and pillars, migrations `0019`–`0020`) | 🟡 Built and locally validated; migrations not yet applied to the hosted database; generated types and the seeded browser suite await CI |
| Weekly cadence from `content/PLAN.md` (1 video + 2–3 reels a week, reels repurposed from videos) | ❌ Not started — the planner still fills every day (PRD FR-2.4) |

**Latest local test run (2026-11-22):** 49 files and 685 tests, all passed and none skipped, including
every database suite against a throwaway local PostgreSQL 15.20 (the CI
version) with `REQUIRE_DATABASE_TESTS=true`. Typecheck, lint, the production
build with its client-bundle secret scan, and the 23 non-seeded browser checks
(axe in both themes) also pass.

---

## 2. Phase-by-phase status

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Project foundation | ✅ Done | Strict TS, custom ESLint rules, Zod env config, client-bundle secret scan, security headers |
| 1 | Design system | ✅ Done | Tokens, primitives, `StatusTick`, `ProgressRing`, reduced-motion, icons |
| 2 | Database and seed | ✅ Done | Migrations `0001`–`0009`, RLS, deterministic rolling seed; CI-validated |
| 3 | Authentication | ✅ Done | Google OAuth, fail-closed access list, action wrapper; owner confirmed live |
| 4 | App shell and PWA | ✅ Done | Owner confirmed install, update prompt and Lighthouse on devices |
| 5 | Domain model and content components | ✅ Done | All eight formats render (`short` and `video` reuse the reel script renderer) |
| 6 | Read screens | ✅ Done | Today, Calendar, Create, Item detail, Archive |
| 7 | Status tracking | ✅ Done | J1 passes; post/undo, skip, notes, history |
| 8 | AI client and prompts | 🟡 Code complete, not signed off | Real smoke-call gate open; cost recorded as unknown (`NULL`) by owner decision |
| 9 | News ingestion | 🟡 Code complete, not wired | Fetch/parse/dedupe built and tested; no route or cron calls it |
| 10 | Generation services | ✅ Signed off (owner evidence) | Month/day planning, validator, hydration batch, daily-tip service |
| 11 | Generation actions and rate limiting | ✅ Signed off (owner evidence) | Four actions, atomic quotas, UI states |
| 12 | Scheduled job | ❌ Not started | No `/api/cron/daily`, no `vercel.json` |
| 13 | Settings and brand profile | 🟡 Partly superseded | Business profile editing moved to Admin; `/settings` screen not built |
| 14 | Security hardening | ❌ Not started | |
| 15 | Test completion and accessibility | ❌ Not started | Partial coverage exists from earlier phases |
| 16 | Deployment | ❌ Not started formally | App runs live on a shared Supabase project; backups and restore not built |

---

## 3. Implemented

### 3.1 Foundation and quality gates
- Next.js 15 App Router, React 19, TypeScript `strict`, Tailwind v4 ([package.json](../package.json)).
- Custom ESLint rules (raw values in Tailwind classes and server environment variables in client code) in [eslint-rules/](../eslint-rules/index.mjs).
- Zod-validated, fail-fast environment config ([src/server/config/](../src/server/config/env-schema.ts)); runtime overrides from the database ([runtime.ts](../src/server/config/runtime.ts)).
- Client-bundle secret scan wired into `npm run build` ([check-client-bundle.mjs](../scripts/check-client-bundle.mjs)).
- Strict security headers and CSP in [next.config.ts](../next.config.ts).
- CI workflows: isolated database tests and type drift, seeded browser journeys, and manual reviewed migrations ([.github/workflows/](../.github/workflows)).

### 3.2 Database (20 forward-only migrations)
| Migration | Purpose |
|---|---|
| `0001`–`0008` | Extensions, enums, tables, indexes, functions, triggers, RLS, grants |
| `0009` | Seeded brand profile (originally Apexoria; rebranded by `0020`) |
| `0010`–`0011` | Status change function; anonymous function execution revoked |
| `0012`–`0013` | Atomic month-plan commit; generation transactions, day slots, combined quotas |
| `0014` | Google display names for attribution |
| `0015` | Admin access list, roles, app settings, editorial instructions |
| `0016` | Admin-managed platform catalogue (`US-18`) |
| `0017` | Admin-managed pillar catalogue (`US-19`) |
| `0018` | Industry-neutral business profile (`US-16`) |
| `0019` | `short` and `video` values for `content_format` (YouTube) |
| `0020` | Trailhead Simplified rebrand: Hinglish creator profile, `youtube` platform, LinkedIn and WhatsApp retired, channel-plan pillars added and eight originals retired |

Development seed: [supabase/seed.sql](../supabase/seed.sql) (a rolling 31-day fixture month that covers every edge case).

### 3.3 Authentication and access (`US-1`, `US-2`, FR-1)
- Google sign-in, PKCE callback with an open-redirect defence, and session destruction on denial ([auth/callback](../src/app/auth/callback/route.ts)).
- Middleware refresh plus independent layout re-verification ([middleware.ts](../src/middleware.ts)).
- Fail-closed access list: `ADMIN_EMAILS` owners, database grants, then legacy `ALLOWED_EMAILS` until imported.
- Server Action pipeline ([run-action.ts](../src/server/actions/run-action.ts)) with authorized and admin variants.
- `/sign-in` and `/no-access` screens.

### 3.4 Screens and content (`US-3`–`US-9`, `US-13`–`US-15`, FR-6, FR-7)
- **Today** (`/`): progress ring, tip card, swipeable deck ([TodayDeck.tsx](../src/features/content/TodayDeck.tsx)).
- **Calendar** (`/calendar`): agenda below 400px and a month grid on wider screens, filters, day sheet, and month/day planning controls ([CalendarView.tsx](../src/features/calendar/CalendarView.tsx)).
- **Create** (`/create`): format groups, overdue items first, filters.
- **Item detail** (`/item/[id]`): copy blocks, slides/script, brief, sources, generation control, post/skip/note.
- **Archive** (`/archive`): posted items only (approved refinement), scope and filters, counts, keyset pagination.
- Actions: `markPosted` (optimistic, Undo), `skipItem`, `addNote` ([server/actions/index.ts](../src/server/actions/index.ts)).
- Loading, empty and error states; the activity log and history.

### 3.5 PWA (`US-17` platform, FR-9)
- Manifest, maskable icons, Serwist service worker, update prompt, offline banner, offline page.
- Seven-day offline reads of the last verified session, with a cache purge on sign-out ([PwaControls.tsx](../src/features/shell/PwaControls.tsx)).
- Install banner (Android) and iOS "Add to Home Screen" hint.

### 3.6 AI and generation (`US-10`–`US-12`, FR-2, FR-4)
- Portkey client: non-streamed JSON, strict OpenAI compliance, no SDK retries, abort deadlines, incomplete/refused output rejected ([client.ts](../src/server/ai/client.ts)).
- Versioned prompts (`content-v3`, `month-plan-v3`, `day-plan-v3`, `daily-tip-v2`), generated-output schemas, one repair per stage, and source URL cross-checks.
- Per-call `generation_runs` logging that fails closed; tokens are recorded and cost is `NULL` (unknown).
- Deterministic planning validator: pillar rotation, format variety, 60-day near-duplicate check (Jaccard ≥ 0.70) ([planning-rules.ts](../src/lib/utils/planning-rules.ts)).
- Services: month and day planning, item hydration and regeneration, hydration batch (240s / 30 items), daily tip with 30-day anti-repetition ([server/services/](../src/server/services/index.ts)).
- User actions: `planMonth`, `generateForDay`, `hydrateItem`, `regenerateItem`, with atomic per-user, global and monthly quotas, and a per-person AI permission.
- UI: staged loading, an "Updated" marker, a rate-limit sheet, and reload-required handling for unknown outcomes.
- `AI_GENERATION_ENABLED` kill switch (environment variable or admin override).

### 3.7 News ingestion modules (FR-3, not yet scheduled)
- HTTPS-only fetch with DNS pinning, private IPv4 rejection, 2 MB cap, three redirects, one retry and conditional validators ([fetch-feed.ts](../src/server/news/fetch-feed.ts)).
- RSS/Atom parsing with declarations rejected, URL normalisation and hashing, deduplication, per-feed isolation and retention pruning.
- Default feeds: Salesforce News and Salesforce Ben; 30-day retention.

### 3.8 Admin panel (`/admin`, S9, `US-16`–`US-19`)
| Page | Capability |
|---|---|
| Overview | User base and 30-day token usage by person, day and type |
| Users | Grant, revoke and restore access, set roles, per-person AI permission, import `ALLOWED_EMAILS` |
| Business | Edit the whole industry-neutral business profile |
| Platforms | Add, edit, reorder and retire platforms (colour slot, glyph, formats, limits, tone, guidance) |
| Pillars | Add, edit, reorder and retire pillars (purpose, guidance, "needs news") with plannability guards |
| Prompts | Versioned editorial instructions that sit beneath the built-in rules |
| Filters (News) | News feed list |
| Settings | Runtime overrides: AI on/off, limits, planning day/horizon, model alias, gateway URL |

---

## 4. Not implemented / open

### 4.1 Features not built
| Item | Reference | Impact |
|---|---|---|
| **Daily cron job** `/api/cron/daily` with constant-time bearer auth, four isolated stages and IST dates | Phase 12, FR-5.1–5.4, `US-10` AC1 | Nothing runs automatically. News is never ingested in production, daily tips are never generated, and next month's plan is not created automatically |
| `vercel.json` cron schedule | Phase 12.5 | No schedule registered |
| Wiring of `ingestNews` and `hydrateBatch` to any route | Phases 9, 12 | Modules exist but are unused. News-pillar slots are omitted while no news exists |
| Daily-tip generation in production | FR-4, `US-4` | Service exists, but writes need `service_role` (the cron). Today shows the most recent stored tip or none |
| **Settings screen** `/settings` (S8) | Phase 13, FR-1.4, FR-5.5 | Folder is empty. Brand editing and runtime controls moved to Admin; manual planning lives on Calendar |
| Readable generation run log UI | Phase 13.4, `US-10` AC4 | `getRecentRuns()` query exists but no screen uses it |
| Theme control (light/dark toggle) | Phase 13.5 | App is fixed to `data-theme="dark"`; the light theme is shown only in the dev gallery |
| Sign-out confirmation sheet | Phase 13.6 | Sign-out is on Today and No-access and runs without a confirmation step |
| Persistent "dismiss forever" for the install hint | `US-17` AC2, FR-9.3 | Dismissal lasts only for the current session |
| Native share sheet for combined content | FR-6.6 | `navigator.share` not used |
| External Firebase admin bridge | Group C scope change | Superseded by the in-app admin panel; intentionally not built |
| Industry templates, first-run setup wizard, configurable app name/accent, new-company runbook | Universal roadmap step 4 | Not started; `0009` seeds the original profile and `0020` rebrands it |
| Apply `0019`/`0020` to the hosted database | Trailhead Simplified rebrand | Manual reviewed-migration workflow (dry run first), **before** deploying; then regenerate `database.types.ts` with the Supabase CLI (the `content_format` entry is hand-written) |
| Personal Vercel project, own AI gateway, real YouTube/Instagram profile URLs | Trailhead Simplified rebrand | New Vercel project on the creator's account with its own `NEXT_PUBLIC_APP_URL`; the new `/auth/callback` added to Supabase Auth redirect URLs; the creator's own Portkey account (`PORTKEY_BASE_URL` is now required, API.md §8.1) and any corporate `ai_base_url` override cleared in Admin → Settings; profile links derived from `@TrailheadSimplified` confirmed |
| Reconnect hosting and CI to the new repository | Repository move | Import `wishvesh-ujawane/Trailhead-Simplified` into the new personal Vercel project; add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as Actions secrets there; set the default branch the migration workflow requires |

### 4.2 Open gates on built work
| Gate | Phase | Status |
|---|---|---|
| Owner-approved real smoke call returning valid output | 8 | Open. The owner has since confirmed live generation works, but the formal Phase 8 checkboxes are unticked |
| Verified gateway pricing / monetary spend enforcement | 8 | Deferred by owner; cost stored as `NULL` |
| Ingestion idempotency proven against a database | 9 | Not wired, so not proven live |
| CI drift check of hand-written generated types for `0016`–`0019` | — | Pending CI confirmation |
| `0015`–`0020` SQL validated on PostgreSQL 15 | — | Validated locally on PostgreSQL 15.20 (2026-11-22); CI run is the confirmation |
| Real item/month latency and token counts from gateway logs | 10–11 | Not recorded by the agent |
| Live non-allowlisted denial check after each auth change | 3 | Manual owner check |

### 4.3 Release work not started (Phases 14–16)
- **Security hardening:** final CSP tightening checked over the wire, a secret scan against the production bundle, cross-origin Server Action block, error-leakage audit, a check that prompts contain no personal data, and `npm audit` with a dependency review. The admin service-role module (an approved deviation) should be included in this audit.
- **Test completion:** e2e J3 (regenerate with a steer) seeded journey, axe on all eight screens (Settings does not exist yet), a final manual sweep, and every gate made release-blocking.
- **Deployment:** separate production Supabase project (currently one shared project, by approved exception), production OAuth client, production/preview environment split with cron disabled on preview.
- **Weekly encrypted `pg_dump` backup workflow** and a **scratch restore rehearsal** that includes RLS verification. These are required: Supabase Free has no automated backups or PITR.
- Generating a full month end to end on production, and walking the `PRD.md` §17 release checklist.

---

## 5. Requirement coverage snapshot

| Requirement | Status |
|---|---|
| `US-1`, `US-2`, FR-1 (auth) | ✅ (FR-1.4 sign-out exists but not in Settings) |
| `US-3`, `US-5`, `US-6`, `US-7`, `US-8`, `US-9` (screens, copy) | ✅ |
| `US-4`, FR-4 (daily tip) | 🟡 Display and fallback built; nothing generates tips in production |
| `US-10`, FR-2, FR-5 (planning, scheduling) | 🟡 Manual planning works; scheduled planning not built |
| `US-11` (regenerate with steer) | ✅ Built; seeded J3 e2e still open |
| `US-12`, FR-3 (news grounding) | 🟡 Enforcement and modules built; no live ingestion |
| `US-13`, `US-14`, `US-15`, FR-7 (tracking, archive, skip) | ✅ |
| `US-16`, FR-8 (business profile) | ✅ Via Admin → Business |
| `US-17` admin panel, `US-18`, `US-19` | ✅ |
| `US-17` PWA, FR-9 | 🟡 Install hint dismissal not persistent |
| FR-6.6 native share | ❌ |

---

## 6. Suggested next steps
1. **Phase 12 cron:** `/api/cron/daily` with ingest news → daily tip → hydration batch → month planning on `PLAN_DAY_OF_MONTH`, plus `vercel.json`. The owner must approve live activation and spend.
2. **Run log and Settings decision:** either build `/settings` (theme, install hint, version, confirmed sign-out, run log) or formally retire S8 in favour of Admin, and update PRD/DESIGN.
3. **Close the Group A gates:** record the smoke-call result and tick the Phase 8/9 criteria.
4. **Backups (Phase 16.5–16.6):** highest data-loss risk while production runs on Supabase Free.
5. **Phases 14–15:** hardening and test completion, then a production project split.
6. **Universal roadmap step 4:** templates and setup wizard.
