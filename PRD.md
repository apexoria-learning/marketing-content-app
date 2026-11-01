# PRD — Apexoria Content Co-pilot

**Product:** Apexoria Content Co-pilot
**Owner:** Apexoria Learning (https://www.apexorialearning.in)
**Document status:** Draft v1.0 — source of truth for implementation
**Scope:** MVP (v1)

---

## 1. Problem

Apexoria Learning sells live, cohort-based Salesforce training with placement support. Its growth depends almost entirely on organic social reach on Instagram and LinkedIn, but today content happens by accident:

1. **No plan.** There is no monthly calendar, so posting is reactive and inconsistent. Gaps of several days are common, which is fatal for algorithmic reach.
2. **Ideation is the bottleneck.** Deciding *what* to post each day costs more time than producing it. The topic space (Salesforce tips, releases, interview prep, placement stories, memes) is known, but nobody is systematically rotating through it.
3. **Designers receive vague briefs.** A designer is handed "make a carousel on Apex triggers" with no hook, no slide text, no CTA, no dimensions. Round trips follow.
4. **"Latest news" content is risky.** Salesforce ships three releases a year plus constant product changes. Posting stale or wrong information damages credibility with a technical audience.
5. **No memory.** Nobody can answer "what did we post last month?", "have we already used this idea?", or "which pillars are we neglecting?"

The net effect: inconsistent posting, slow follower growth, and expensive designer time spent on thinking rather than designing.

## 2. Value proposition

> **A pocket marketing partner that shows up every morning with the day's content already written, researched, and briefed — so the only job left is to design it and hit post.**

The product compresses the ideate → write → brief → track loop into a single screen. It is deliberately *not* a social media management suite. It does one thing: it removes the blank page and the memory problem.

Measured value:

| Today | With Content Co-pilot |
|---|---|
| ~30–45 min/day deciding and writing a post | ~2 min: open, read, copy, design |
| Designer gets a one-line brief | Designer gets hook, slide-by-slide copy, CTA, dimensions, visual direction |
| Posting cadence is irregular | Every day of the month has a planned slot |
| News claims unverified | Every news claim carries a source link |
| No history | Permanent, searchable archive of everything posted |

## 3. Target users

The app is an **internal team tool**, accessed by a small, known group.

### Persona A — Rohit, the Founder/Owner (primary)
Runs the business and the brand voice. Checks the app in the morning, approves or regenerates the day's plan, posts to LinkedIn himself. Cares about: credibility, consistency, not sounding like a bot.
**Needs:** fast overview, trust in accuracy, ability to override anything.

### Persona B — Priya, the Designer / Marketing Partner (primary)
Freelance or part-time. Opens the app, picks up what is due, designs it in Canva/Figma. Does not know Salesforce deeply.
**Needs:** unambiguous briefs, copy she can paste without editing, clarity on format and dimensions, a list of what is still pending.

### Persona C — Social Handler (secondary, may be the same person as A or B)
Publishes and marks things as posted.
**Needs:** one-tap "posted" confirmation, nothing to fill in.

> **Assumption A1:** Total user base is under 10 people and all are trusted. There is no need for granular per-user permissions in v1. *(Flagged for approval — see §16.)*

## 4. Goals and non-goals

### Goals
- G1 — Guarantee a planned piece of content exists for every day of the month.
- G2 — Reduce time from "open app" to "content ready to design" to under 2 minutes.
- G3 — Make every Salesforce-news item verifiable against a real source.
- G4 — Maintain a permanent record of what was posted, when, and by whom.
- G5 — Grow Instagram and LinkedIn followers through consistency and pillar variety.

### Non-goals (v1)
- Not a publishing tool — the app never posts on your behalf in v1.
- Not an analytics platform — no follower/engagement data is ingested in v1.
- Not a design tool — it produces briefs and copy, not finished graphics.
- Not a multi-tenant SaaS — it serves exactly one brand, Apexoria Learning.

## 5. Confirmed product decisions

These were agreed during discovery and are **fixed** for v1.

| # | Decision | Choice |
|---|---|---|
| D1 | App type | Mobile-first installable **PWA**, hosted on Vercel |
| D2 | Database | **Supabase** free tier (Postgres + Auth) |
| D3 | Authentication | **Google Sign-In**, one tap, no signup forms, no user profiles. Access granted by adding users as test users in Google Cloud Console |
| D4 | AI model | **Claude Sonnet**, routed through the **Portkey AI Gateway** |
| D5 | Generation strategy | **Scheduled pre-generation** (cron) + **on-demand regeneration** of individual items |
| D6 | News grounding | **Live Salesforce RSS/Atom feeds** are ingested and used as factual grounding |
| D7 | Visual assets | **Text + detailed design brief only.** AI image generation deferred |
| D8 | Platforms | **Instagram, LinkedIn, WhatsApp Status** |
| D9 | Cadence | AI plans the month; **maximum 2 pieces per day**, varying by day |
| D10 | Tip of the Day | **Marketing tips for the internal team** (not audience-facing content) |
| D11 | Auto-publishing | **Out of scope for v1**, designed for as a future phase |
| D12 | Tone | **Mixed** — playful and meme-literate for Instagram/WhatsApp, credible and professional for LinkedIn |

## 6. Content model concepts

### 6.1 Content pillars
Every piece of content belongs to exactly one pillar. The planner rotates across all ten and avoids repeating a pillar on consecutive days.

| Pillar | Intent | Typical formats |
|---|---|---|
| `salesforce_tips` | Teach something small and useful | Carousel, Reel, Post |
| `salesforce_news` | Releases, features, deprecations | Post, Carousel |
| `memes` | Relatable humour, reach driver | Meme, Reel |
| `interview_questions` | Interview prep value | Carousel, Post, Reel |
| `success_stories` | Placement and student wins | Post, Carousel, Reel |
| `course_promos` | Batch launches, offers | Post, Story, Reel |
| `career_guidance` | Advice for freshers/switchers | Carousel, Post |
| `behind_the_scenes` | Trainer POV, classroom moments | Reel, Story |
| `myth_busting` | Correct common misconceptions | Carousel, Reel |
| `polls_engagement` | Deliberate engagement bait | Poll, Story |

### 6.2 Formats

| Format | Platforms | Required payload |
|---|---|---|
| `carousel` | Instagram, LinkedIn | 5–10 slides, each with headline + body + optional visual note; cover slide hook |
| `reel` | Instagram | Hook (first 3s), scene-by-scene script, on-screen text per scene, audio/pacing suggestion, duration |
| `post` | Instagram, LinkedIn | Single-image visual concept + caption |
| `story` | Instagram, WhatsApp Status | Single frame copy + interaction prompt |
| `meme` | Instagram, WhatsApp Status | Meme template reference, top/bottom text, caption |
| `poll` | Instagram, LinkedIn | Question + 2–4 options + follow-up caption |

### 6.3 Anatomy of a generated content item
Every item, regardless of format, carries:

- **Hook** — the scroll-stopping first line
- **Caption** — full platform-appropriate caption, ready to paste
- **Body payload** — slides / script / frame, depending on format
- **Hashtags** — platform-appropriate set (Instagram: 8–15; LinkedIn: 3–5; WhatsApp: none)
- **CTA** — the specific action the viewer should take
- **Design brief** — objective, visual direction, colour/mood guidance, typography emphasis, layout notes, asset dimensions, text-safe areas, and explicit "must include" / "must avoid" notes
- **Source references** — URLs backing any factual claim (required for `salesforce_news`)
- **Metadata** — date, platform, pillar, format, status

## 7. Core user journeys

### J1 — Morning check-in (Founder) ★ primary
1. Opens the installed PWA from the home screen; Google session is already active.
2. Lands on **Today**. Sees the date, a month-progress ring, and the **Marketing Tip of the Day**.
3. Swipes through today's 1–2 content cards.
4. Taps a card to read the full caption and design brief.
5. Taps **Copy everything**, pastes into LinkedIn, posts.
6. Taps the **Posted** checkbox. Animation confirms; the month ring advances.

**Success:** under 2 minutes, zero typing.

### J2 — Designer picks up the queue (Designer) ★ primary
1. Opens the app, taps **Create**.
2. Sees pending items grouped by format: 3 carousels, 2 reels, 1 meme.
3. Opens a carousel. Reads the slide-by-slide copy and design brief.
4. Taps **Copy slides** → pastes into Canva, designs, exports.
5. Hands off; the social handler marks it posted.

**Success:** no clarifying questions needed.

### J3 — "This idea is wrong for us" (Founder)
1. Opens an item that misses the mark.
2. Taps **Regenerate**, optionally types a one-line steer ("make it about Flow, not Apex").
3. A new version replaces it in the same date/platform slot within seconds.
4. The previous version is retained in the activity log.

### J4 — Planning the month ahead (Founder)
1. Opens **Calendar**.
2. Sees the month at a glance: dots for platform, filled for posted, hollow for pending.
3. Spots a 3-day gap caused by a holiday and taps those days to review.
4. Notices `memes` has not appeared in 10 days via pillar filter.

### J5 — Reviewing what we posted (Founder)
1. Opens **Archive**.
2. Filters to last month, Instagram, `success_stories`.
3. Reviews what was posted, when, and the note the handler left.

### J6 — First-time access (any user)
1. Receives the app URL.
2. Taps **Continue with Google**, picks an account.
3. If allowed → straight into **Today**. If not → a clear "Access not granted" screen with a contact line.
4. Prompted once to **Add to Home Screen**.

## 8. User stories and acceptance criteria

> Format: **US-n** — As a *persona*, I want *capability*, so that *outcome*.

### Authentication and access

**US-1** — As a team member, I want to sign in with one Google tap, so that I never fill a signup form.
- AC1: The sign-in screen offers exactly one action: *Continue with Google*.
- AC2: On success the user lands on **Today**; the session persists across app restarts.
- AC3: No username, password, profile, or onboarding form exists anywhere in the product.

**US-2** — As the owner, I want only approved people to access the app, so that my calendar and AI credits are protected.
- AC1: Users not permitted by Google OAuth cannot complete sign-in.
- AC2: An optional server-side email allowlist blocks any non-listed email even if Google authentication succeeds.
- AC3: Every page and API route rejects unauthenticated requests; no content is visible pre-login.

### Today's Plan

**US-3** — As a founder, I want to see today's content immediately on open, so that I start posting without navigating.
- AC1: **Today** is the default route after sign-in.
- AC2: It shows today's items (0, 1 or 2) ordered by platform priority.
- AC3: Each card shows platform, format, pillar, hook, and posted state at a glance.
- AC4: Cards are navigable by swipe and by tap.

**US-4** — As a team member, I want a marketing tip each day, so that the team keeps improving.
- AC1: Exactly one tip is shown per calendar day.
- AC2: The tip is internal marketing advice, not audience-facing content.
- AC3: If today's tip has not generated, a recent tip is shown rather than an empty space.

**US-5** — As a founder, I want to see monthly progress, so that I stay accountable.
- AC1: A progress indicator shows posted vs. planned for the current month.
- AC2: It updates immediately when an item is marked posted.

### Calendar

**US-6** — As a founder, I want a monthly calendar view, so that I can see the whole plan.
- AC1: A month grid shows every day with an indicator per planned item.
- AC2: Indicators encode platform (by colour **and** icon) and posted state (by fill **and** a tick).
- AC3: Previous and next months are navigable; future months beyond the generated horizon show an explicit "not yet planned" state.
- AC4: Tapping a day opens a detail sheet listing that day's items.
- AC5: The calendar can be filtered by platform, pillar and status.

### Content to Create

**US-7** — As a designer, I want a queue of what still needs designing, so that I know exactly what to work on.
- AC1: The screen lists items with status `idea` or `ready` that are not yet posted.
- AC2: Items are grouped by format and ordered by scheduled date ascending.
- AC3: Overdue items (scheduled date in the past, not posted) are visually distinguished and sorted first.
- AC4: Filters by format and platform are available.

**US-8** — As a designer, I want a complete brief, so that I do not have to ask questions.
- AC1: Every item exposes objective, visual direction, layout notes, dimensions, and must-include/must-avoid lists.
- AC2: Carousels expose numbered slides with headline and body text per slide.
- AC3: Reels expose a scene-by-scene script with on-screen text and duration.

**US-9** — As a designer, I want one-tap copy, so that I never retype content.
- AC1: Separate copy actions exist for caption, hashtags, slides/script, and everything combined.
- AC2: Each copy action gives immediate visual confirmation.
- AC3: Copied text preserves line breaks and emoji exactly as intended for the target platform.

### Generation

**US-10** — As a founder, I want the month planned automatically, so that I never face a blank calendar.
- AC1: A scheduled job generates the next month's plan before the month begins.
- AC2: The plan covers every day of the month with 1–2 items per day.
- AC3: Generation is idempotent — rerunning does not duplicate or overwrite posted items.
- AC4: Generation failures are logged and surfaced in the app, never silently swallowed.

**US-11** — As a founder, I want to regenerate a single item with a steer, so that I can fix off-brand output.
- AC1: Regeneration preserves the item's date, platform and pillar slot unless I change them.
- AC2: An optional free-text instruction influences the new output.
- AC3: Regeneration is blocked on items already marked posted.
- AC4: Regeneration count is tracked and rate-limited per user per day.

**US-12** — As a founder, I want news-based content to be factual, so that I keep credibility with a technical audience.
- AC1: `salesforce_news` items must carry at least one source URL.
- AC2: Source URLs are drawn from ingested feed items, not invented by the model.
- AC3: Source links are visible and tappable in the item detail view.

### Tracking

**US-13** — As a social handler, I want to tick off what I posted, so that the team knows the status.
- AC1: A single tap toggles posted state with optimistic UI and confirmation feedback.
- AC2: The posted timestamp and the acting user's email are recorded.
- AC3: Un-ticking is possible and is also recorded.
- AC4: An optional short note can be attached when marking posted.

**US-14** — As a founder, I want a permanent archive, so that I can review history.
- AC1: Posted items remain accessible indefinitely.
- AC2: The archive is filterable by month, platform, pillar and format.
- AC3: Simple counts are shown: items posted this month, breakdown by platform and by pillar.

**US-15** — As a founder, I want items I chose not to post to be marked as skipped, so that the backlog stays clean.
- AC1: An item can be set to `skipped` with an optional reason.
- AC2: Skipped items leave the Create queue but remain accessible in Calendar and item detail. Archive contains posted items only (approved Phase 6 refinement).

### Brand configuration

**US-16** — As a founder, I want to edit the brand profile, so that generated content stays accurate as the business evolves.
- AC1: Business description, course list, current offers, audience description, tone rules per platform, and do/don't lists are editable.
- AC2: Changes affect all subsequent generations.
- AC3: Changes do not retroactively alter already-generated items.

### Platform behaviour

**US-17** — As a user, I want to install the app to my home screen, so that it feels like a native app.
- AC1: The app is installable with a name, icon and splash screen.
- AC2: An install hint appears once and is dismissible permanently.
- AC3: Previously loaded content is readable offline; write actions queue or fail with a clear message.

## 9. Functional requirements

### FR-1 Authentication and access control
- FR-1.1 Google OAuth sign-in via Supabase Auth; single-action sign-in screen.
- FR-1.2 Server-side session verification on every page and API route.
- FR-1.3 Optional environment-configured email allowlist enforced server-side.
- FR-1.4 Sign-out available from Settings.
- FR-1.5 Denied users see an explicit, non-technical "access not granted" screen.

### FR-2 Content planning engine
- FR-2.1 Generate a full-month plan: every date populated with 1–2 items.
- FR-2.2 Rotate pillars; no pillar repeats on consecutive days; every pillar appears at least twice per month.
- FR-2.3 Distribute platforms with an Instagram-weighted mix; WhatsApp Status used for lightweight formats only.
- FR-2.4 Vary formats; avoid the same format two days running on the same platform.
- FR-2.5 Exclude ideas substantially similar to items posted in the previous 60 days.
- FR-2.6 Validate all AI output against a strict schema; retry once on invalid output, then fail the run with a logged error.
- FR-2.7 Never modify or delete items with status `posted`.

### FR-3 News ingestion and grounding
- FR-3.1 Fetch configured Salesforce RSS/Atom feeds on a schedule.
- FR-3.2 Normalise and deduplicate entries by URL hash.
- FR-3.3 Retain a rolling window of recent items; prune older entries.
- FR-3.4 Supply recent items as grounding context for `salesforce_news` generation.
- FR-3.5 Require and persist source URLs on generated news items.
- FR-3.6 Feed failures must not block the rest of a generation run.

### FR-4 Daily tip
- FR-4.1 Generate exactly one marketing tip per calendar day.
- FR-4.2 Avoid repeating a tip topic within 30 days.
- FR-4.3 Fall back to the most recent available tip if today's is missing.

### FR-5 Scheduling
- FR-5.1 Scheduled jobs run via Vercel Cron.
- FR-5.2 Cron endpoints require a shared secret and reject unauthenticated calls.
- FR-5.3 Jobs are idempotent and safe to rerun.
- FR-5.4 Every run records status, duration, token usage and errors.
- FR-5.5 A manual trigger for month generation exists in Settings, rate-limited.

### FR-6 Content consumption
- FR-6.1 Today view listing today's items plus the daily tip and month progress.
- FR-6.2 Monthly calendar with per-day indicators, filters, and a day detail sheet.
- FR-6.3 Create queue grouped by format with overdue prioritisation.
- FR-6.4 Item detail exposing the full payload, design brief and sources.
- FR-6.5 Copy actions: caption, hashtags, slides/script, everything.
- FR-6.6 Native share sheet for the combined content.

### FR-7 Status tracking
- FR-7.1 Statuses: `idea`, `ready`, `posted`, `skipped`.
- FR-7.2 Toggle posted with optimistic UI and rollback on failure.
- FR-7.3 Record actor email and timestamp for every status change.
- FR-7.4 Append-only activity log capturing status changes, regenerations and notes.
- FR-7.5 Archive view with filters and monthly counts.

### FR-8 Brand profile
- FR-8.1 Single editable brand profile record.
- FR-8.2 Fields: business description, courses, offers, audience, tone rules per platform, do list, don't list, links.
- FR-8.3 Used as context in every generation prompt.

### FR-9 PWA
- FR-9.1 Web app manifest with icons, theme colour and standalone display.
- FR-9.2 Service worker caching the shell and recently viewed content for offline reads.
- FR-9.3 Dismissible install prompt.
- FR-9.4 Safe-area-aware layout on notched devices.

## 10. Non-functional requirements

### NFR-1 Performance
- NFR-1.1 Today screen interactive within 2.0s on 4G, mid-range Android.
- NFR-1.2 Navigation between primary tabs feels instant (<150ms perceived) using cached data.
- NFR-1.3 Single-item regeneration completes within 20s; a determinate-feeling progress state is shown throughout.
- NFR-1.4 Monthly generation runs in the background and never blocks the UI.
- NFR-1.5 Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA installable.

### NFR-2 Security
- NFR-2.1 No secret (Portkey key, Supabase service role key, cron secret, OAuth client secret) may appear in the client bundle. Enforced by an automated build-time check.
- NFR-2.2 All AI calls originate server-side only.
- NFR-2.3 Row Level Security enabled and deny-by-default on every database table.
- NFR-2.4 All request input validated against a schema before use.
- NFR-2.5 All AI output validated and treated as untrusted; rendered as text only, never as HTML.
- NFR-2.6 Strict Content Security Policy plus standard security headers.
- NFR-2.7 Rate limiting on all AI-invoking endpoints, per user and global.
- NFR-2.8 Cron routes authenticated by bearer secret.
- NFR-2.9 Secrets live only in environment variables; the repository contains an example file with no real values.
- NFR-2.10 No third-party analytics or trackers that receive content data.

### NFR-3 Reliability
- NFR-3.1 AI calls use timeouts and bounded retries with backoff.
- NFR-3.2 A failed generation never leaves partial or corrupt items in the database.
- NFR-3.3 Feed outages degrade gracefully — generation proceeds without news grounding, and news items are not fabricated.
- NFR-3.4 All generation runs are observable through a persisted run log.

### NFR-4 Usability
- NFR-4.1 Every primary action reachable within the thumb zone, one-handed.
- NFR-4.2 Minimum interactive target 44×44 px.
- NFR-4.3 No action requires more than two taps from the Today screen.
- NFR-4.4 Destructive or irreversible actions require confirmation; everything else is immediate.
- NFR-4.5 No horizontal scrolling at 320px width.

### NFR-5 Accessibility
- NFR-5.1 WCAG 2.2 Level AA.
- NFR-5.2 Text contrast ≥ 4.5:1; non-text UI ≥ 3:1.
- NFR-5.3 Information never conveyed by colour alone.
- NFR-5.4 Full keyboard operability and visible focus indicators.
- NFR-5.5 `prefers-reduced-motion` respected.

### NFR-6 Cost
- NFR-6.1 Entire stack runs within free tiers except AI inference.
- NFR-6.2 Monthly planning consumes a bounded number of AI calls.
- NFR-6.3 Per-user daily regeneration cap prevents runaway spend.
- NFR-6.4 Token usage and estimated cost recorded per run.

### NFR-7 Maintainability
- NFR-7.1 TypeScript strict mode, no implicit `any`.
- NFR-7.2 Prompts are versioned and stored alongside generated output for reproducibility.
- NFR-7.3 Unit tests for schema validation, planning rules, rate limiting and status transitions.
- NFR-7.4 End-to-end tests for the critical journeys J1, J2, J3.

### NFR-8 Compatibility
- NFR-8.1 Target: iOS Safari 16+, Android Chrome 110+.
- NFR-8.2 Design baseline 390×844; must work from 320px to desktop.
- NFR-8.3 Desktop renders as a centred mobile-width column — no separate desktop layout.

## 11. Pages and screens

| # | Screen | Route | Purpose | Key elements |
|---|---|---|---|---|
| S1 | Sign in | `/sign-in` | Single-tap access | Brand mark, one Google button, one line of context |
| S2 | Access denied | `/no-access` | Clear dead-end for unapproved users | Explanation, contact line, sign out |
| S3 | **Today** | `/` | Daily launchpad (default) | Date header, month progress ring, Tip of the Day, swipeable deck of today's items, contextual action bar |
| S4 | **Calendar** | `/calendar` | Month overview | Month switcher, day grid with platform/status indicators, filters, day detail sheet |
| S5 | **Create** | `/create` | Designer work queue | Format groups, overdue section, filters, compact item rows |
| S6 | Item detail | `/item/[id]` | Everything about one piece | Hook, caption block, slides/script, hashtags, CTA, design brief, sources, copy actions, regenerate, posted toggle |
| S7 | **Archive** | `/archive` | History and review | Month filter, platform/pillar/format filters, counts, posted list with notes |
| S8 | Settings | `/settings` | Configuration | Brand profile editor, manual month generation, generation run log, install hint, theme, sign out |

Bottom navigation exposes S3, S4, S5, S7. Settings is reached from the header. Item detail is reached from S3, S4, S5 and S7.

> **Assumption A2:** Four bottom-nav destinations plus a header entry to Settings is the right information architecture. Adding a fifth tab would crowd the thumb zone.

## 12. Roles and permissions

v1 has a single role.

| Capability | Authenticated team member | Unauthenticated |
|---|---|---|
| View Today / Calendar / Create / Archive / Item detail | ✅ | ❌ |
| Mark posted / skipped, add notes | ✅ | ❌ |
| Regenerate a single item (rate-limited) | ✅ | ❌ |
| Trigger month generation (rate-limited) | ✅ | ❌ |
| Edit brand profile | ✅ | ❌ |
| Access any data or API | ✅ | ❌ |

- Access is granted by adding a Google account as an approved user in Google Cloud Console (D3), optionally reinforced by a server-side email allowlist.
- Access is revoked by removing the account from the Google Console list and/or the allowlist. Revocation takes effect on next session validation.
- Scheduled jobs act as a system actor and authenticate with a shared secret, not a user session.

> **Decision requiring approval — DR-1:** Should a read-only "Designer" role be introduced that can view and copy but cannot regenerate or edit the brand profile? This protects AI spend if an external freelancer is given access. *Recommendation: defer to v1.1 unless an external designer is onboarded immediately.*

## 13. Data requirements

Conceptual model only — physical schema is defined in the architecture document.

### Entities

**BrandProfile** (singleton)
Business description, course catalogue summary, current offers, audience description, per-platform tone rules, do list, don't list, website and social links, updated timestamp.

**ContentPlan**
One per month. Month, generation status, model used, prompt version, generated-at timestamp, item count.

**ContentItem** (core entity)
Scheduled date, platform, format, pillar, title, hook, caption, body payload (slides or script or frame), hashtags, CTA, design brief, source references, status, posted-at, posted-by, skip reason, regeneration count, prompt version, created/updated timestamps.

**DailyTip**
Date (unique), tip text, category.

**NewsItem**
Source name, title, URL, URL hash (unique), published date, summary, fetched-at.

**ActivityLog** (append-only)
Content item reference, action type, previous value, new value, actor email, note, timestamp.

**GenerationRun**
Kind (month plan / daily tip / news ingest / single regenerate), status, started/finished timestamps, token usage, estimated cost, error detail.

**RateLimit**
Actor key, action key, window start, count.

### Rules and constraints
- A content item belongs to exactly one date, one platform, one format and one pillar.
- At most 2 content items per calendar date (FR-2.1, D9).
- At most one daily tip per date.
- Status transitions: `idea → ready → posted`, `idea|ready → skipped`, `posted → ready` (un-tick), `skipped → ready`.
- `posted` items are immutable with respect to content fields; only notes may be added.
- News items are deduplicated by URL.
- News-pillar content items must reference at least one news item URL.

### Retention
- Content items, activity log and daily tips: retained indefinitely (US-14 AC1).
- News items: rolling window, pruned beyond the retention period.
- Generation runs: retained for operational review, pruned beyond a rolling window.

### Privacy
- The only personal data stored is the signed-in user's email address, used for attribution of status changes.
- No audience or student personal data is stored.
- Success-story content must not include real student names unless explicitly entered by the team into the brand profile.

> **Decision requiring approval — DR-2:** Should `success_stories` content use placeholder names ("a recent learner from Pune") by default rather than real names? *Recommendation: yes — real names only when the team types them in manually.*

## 14. Integrations

| # | Integration | Purpose | Direction | Failure behaviour |
|---|---|---|---|---|
| I1 | **Portkey AI Gateway → Claude Sonnet** | All content, brief and tip generation | Outbound, server-only | Retry with backoff; on persistent failure mark the run failed and surface a clear, actionable error. Never show a half-generated item. |
| I2 | **Supabase (Postgres + Auth)** | Data persistence and Google authentication | Bidirectional | Read failure → cached/offline state with retry; write failure → optimistic update rolled back with a toast. |
| I3 | **Google OAuth** (via Supabase) | Sign-in and access gating | Outbound | Sign-in error shown plainly with a retry action. |
| I4 | **Salesforce news feeds** (RSS/Atom) | Factual grounding for news content | Inbound, scheduled | Individual feed failure logged and skipped; generation proceeds without that source and does not invent news. |
| I5 | **Vercel Cron** | Scheduled generation | Inbound, secret-authenticated | Missed run detected on next run and backfilled; manual trigger available in Settings. |
| I6 | **Clipboard & Web Share APIs** | Copy and share actions | Client | Fall back to a selectable text block if the API is unavailable. |

Feed sources are configuration, not code, so they can be changed without a release.

> **Assumption A3:** Suitable public Salesforce feeds exist and permit programmatic reading for internal use. Feeds that block automated access will be dropped from the configured list.

## 15. State specifications

Every screen must define four states. Blank screens and raw error text are not acceptable.

### 15.1 Loading

| Context | Behaviour |
|---|---|
| App shell / first paint | Skeleton placeholders matching final layout; no spinners on full pages |
| Today cards | Card-shaped shimmer, correct height, so layout does not shift |
| Calendar | Grid renders immediately; day indicators fade in as data arrives |
| Create queue | Three skeleton rows per format group |
| Item detail | Header and section scaffolding visible with shimmering content blocks |
| Regeneration | Inline progress on the item with stage text ("Researching…", "Writing…", "Briefing…"); the rest of the screen stays usable; action disabled to prevent double submission |
| Month generation | Non-blocking banner with progress; the user can keep using the app |

### 15.2 Empty

| Context | Message and action |
|---|---|
| Today, nothing planned | "No content planned for today." + *Generate today's content* |
| Today, everything posted | Celebratory confirmation: "All done for today." + month progress + *See tomorrow* |
| Calendar month not generated | "This month isn't planned yet." + *Plan this month* |
| Create queue empty | "Nothing waiting to be designed." + *See the calendar* |
| Archive empty | "Nothing posted yet. Start with today's plan." + *Go to Today* |
| No sources for a news item | Hide the sources section entirely rather than show an empty heading |
| Offline with no cache | "You're offline and this hasn't been downloaded yet." + *Retry* |

### 15.3 Error

Principles: plain language, name what failed, offer one clear recovery action, never expose stack traces, model names or internal identifiers.

| Context | Message | Recovery |
|---|---|---|
| Sign-in failed | "We couldn't sign you in. Please try again." | Retry |
| Access not granted | "This account doesn't have access yet. Ask the Apexoria team to add you." | Sign out and try another account |
| Content failed to load | "Couldn't load your content." | Retry |
| Generation failed | "Generation didn't complete. Nothing was changed." | Try again |
| Rate limit hit | "You've hit today's regeneration limit. It resets at midnight." | Dismiss only |
| Mark-posted failed | "Couldn't save that. We've put it back." (optimistic rollback) | Automatic retry then manual |
| Copy unsupported | Text becomes selectable with a "Select and copy" hint | Manual copy |
| Offline write attempt | "You're offline. This will need an internet connection." | Dismiss |
| Unexpected error | "Something went wrong on our side." | Reload |

### 15.4 Success and feedback
- Mark as posted: immediate tick animation, haptic pulse, progress ring advance, brief toast with **Undo**.
- Copy: inline label switches to "Copied" for ~1.5s on the pressed control only.
- Regeneration complete: the card content cross-fades to the new version with a short "Updated" marker.
- Month generated: toast with a link to the calendar.

## 16. MVP scope

### In scope for v1
1. Google sign-in with access gating; no signup, no profiles.
2. Installable mobile-first PWA.
3. Automated monthly content planning, max 2 items/day, across Instagram, LinkedIn and WhatsApp Status.
4. All six formats with complete, paste-ready payloads and design briefs.
5. Salesforce news ingestion with mandatory source attribution on news content.
6. Daily internal marketing tip.
7. Today, Calendar, Create, Item detail, Archive, Settings screens.
8. Posted/skipped tracking with actor, timestamp, notes and an append-only activity log.
9. Single-item regeneration with optional steer, rate-limited.
10. Editable brand profile driving all generation.
11. Copy and share actions throughout.
12. Production security hardening and automated tests.

### Out of scope for v1
- Auto-publishing to Instagram, LinkedIn or WhatsApp (planned as a future phase, D11).
- AI image, carousel or meme image generation (D7).
- Engagement and follower analytics ingestion.
- Multi-brand or multi-tenant support.
- Comment and DM management.
- Granular roles and per-user permissions (DR-1).
- Team collaboration features: assignment, approval workflows, commenting.
- Content versioning UI (version history is logged but not browsable in v1).
- Push notifications.
- Native App Store / Play Store distribution.
- Hashtag performance research and competitor tracking.
- Export to PDF/CSV.

### Explicit anti-scope
The product must not become a generic "social media manager". Every v1 feature must serve the single loop: **plan → brief → post → record**.

## 17. Success criteria

### Launch criteria (v1 is done when)
- L1 — All functional requirements in §9 are implemented and demonstrable.
- L2 — Journeys J1, J2, J3 pass automated end-to-end tests.
- L3 — No secret is present in the client bundle (automated check passes).
- L4 — RLS is enabled and verified on every table; unauthenticated access returns nothing.
- L5 — Lighthouse mobile thresholds in NFR-1.5 are met on production.
- L6 — A full month plan generates end-to-end on production with valid, schema-conforming output for every day.
- L7 — Zero known high-severity bugs or security findings.

### Product success metrics (first 90 days post-launch)

| Metric | Baseline | Target |
|---|---|---|
| M1 — Posting consistency: days in the month with ≥1 item posted | Ad-hoc | ≥ 90% |
| M2 — Plan completion: planned items actually posted | n/a | ≥ 70% |
| M3 — Time from app open to content copied | ~30–45 min | < 2 min (median) |
| M4 — Pillar coverage: distinct pillars used per month | ~3 | ≥ 8 |
| M5 — Regeneration rate (proxy for AI quality; lower is better) | n/a | < 25% of items |
| M6 — Instagram follower growth | current | +30% over 90 days |
| M7 — LinkedIn follower growth | current | +30% over 90 days |
| M8 — Designer clarification questions per item | several | ~0 |

M1, M2, M4 and M5 are measurable from the app's own data. M6 and M7 are read manually from the platforms. M3 and M8 are qualitative check-ins with the team.

> **Decision requiring approval — DR-3:** Are the +30% follower targets right, and what are the current baselines? Targets are a placeholder until actual follower counts are supplied.

## 18. Assumptions

| # | Assumption | Impact if wrong |
|---|---|---|
| A1 | Fewer than 10 trusted users; no granular permissions needed | Would require the role model in DR-1 |
| A2 | Four bottom-nav destinations is the right IA | Navigation rework |
| A3 | Public Salesforce feeds are available and readable | News grounding weakens; news pillar would rely on manual input |
| A4 | The team posts manually and reliably marks items posted | Tracking metrics M1/M2 become unreliable |
| A5 | Claude Sonnet via Portkey produces schema-valid JSON reliably with retries | Higher failure rate; stricter repair logic needed |
| A6 | Supabase and Vercel free tiers are sufficient at this usage level | Minor hosting cost |
| A7 | Content is authored in English | Localisation work |
| A8 | One brand only, now and for the foreseeable future | Multi-tenant rework |
| A9 | Google OAuth in test-user mode (≤100 users, "unverified app" notice) is acceptable | Consent screen verification required |

## 19. Decisions requiring approval

| # | Decision | Recommendation |
|---|---|---|
| DR-1 | Introduce a read-only Designer role to protect AI spend? | Defer to v1.1 unless an external designer is onboarded at launch |
| DR-2 | Use placeholder names in success stories by default? | Yes — real names only when manually entered |
| DR-3 | Confirm follower-growth targets and current baselines | Supply current Instagram and LinkedIn follower counts |
| DR-4 | Day of month and time for automatic next-month planning | Suggest the 25th, early morning IST |
| DR-5 | Daily per-user regeneration cap | Suggest 20 regenerations per user per day |
| DR-6 | How far ahead the calendar should be planned | Suggest current month + next month only |
| DR-7 | Confirm the Salesforce feed source list | Supply preferred sources, or accept a default set |

## 20. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | AI produces generic or off-brand content, eroding trust in the tool | High | Rich brand profile, pillar rotation, anti-repetition rules, easy regeneration with steer, track M5 |
| R2 | Factually wrong Salesforce claims damage credibility | High | Mandatory source grounding and visible source links on news content |
| R3 | Team stops marking items posted, making the archive useless | Medium | One-tap, zero-friction marking; visible progress ring creates a completion pull |
| R4 | AI costs grow unexpectedly | Medium | Batch monthly generation, per-user caps, token logging per run |
| R5 | Google test-user mode blocks a needed user | Low | Documented process to add users; clear access-denied screen |
| R6 | Feed sources change or disappear | Low | Feeds are configuration; failures degrade gracefully |
| R7 | Scope creep toward a full social suite | Medium | Explicit anti-scope in §16 |

---

**Next document:** `DESIGN.md` — visual and interaction design system derived from this PRD.
**Then:** `ARCHITECTURE.md` — stack, schema, API contracts, security model, deployment.
