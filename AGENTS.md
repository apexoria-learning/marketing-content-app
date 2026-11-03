# Apexoria Content Co-pilot — Agent Guidelines

A mobile-first PWA that generates, schedules and tracks social content for Apexoria Learning (Salesforce training). Next.js on Vercel, Supabase Postgres, Claude Sonnet via Portkey.

**This file is loaded on every request. It contains only the rules that apply to all work.** Depth lives in the six specification documents — read the relevant one before you touch the area it owns.

---

## 1. Prime directive

**Inspect before you change. Follow the specs. Reuse what exists. Change nothing else.**

Concretely, before any edit:

1. **Read the owning spec section** (§2) for the area you are touching.
2. **Read the existing code** in that area — never edit a file you have not read in full.
3. **Find the established pattern** and follow it. A near-identical problem is almost always already solved somewhere in `src/`.
4. **Change only what the task requires.** No opportunistic refactors, renames, reformatting, dependency bumps or "while I'm here" fixes.

If you believe something outside the task is broken, **say so in your response** and leave it alone.

### Never rewrite working code
Prefer the smallest correct change. Do not restructure a module, swap an approach or "modernise" anything unless the task explicitly asks. If a rewrite seems genuinely necessary, stop and explain why before doing it.

---

## 2. Source of truth

| Document | Owns |
|---|---|
| [PRD.md](./PRD.md) | Scope, user stories, acceptance criteria, state specs, what is out of scope |
| [DESIGN.md](./DESIGN.md) | Design tokens, component inventory, layout, motion, accessibility |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, folder structure, data flow, generation pipeline, security boundaries |
| [DATABASE.md](./DATABASE.md) | Schema, constraints, indexes, RLS, migrations |
| [API.md](./API.md) | Route handlers, Server Actions, validation, errors, rate limits, integrations |
| [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) | Phase order, task breakdown, completion criteria |

**Rules:**

- **The specs win over habit.** If a familiar pattern contradicts a spec, follow the spec.
- **If code and spec disagree, stop and flag it.** Do not silently pick a side.
- **If a task requires deviating from a spec, update that spec in the same change** and call the deviation out explicitly. Undocumented drift is the failure mode these documents exist to prevent.
- Do not restate spec content in code comments. Reference it: `// see DATABASE.md §7.7`.

---

## 3. Build and test

```bash
npm install
npm run dev           # local dev server
npm run typecheck     # tsc --noEmit, strict
npm run lint          # ESLint
npm run test          # Vitest unit + integration
npm run test:integration  # integration only; needs a local Postgres, else skips
npm run test:e2e      # Playwright
npm run build         # production build + client bundle secret scan
npx supabase db reset # apply migrations + seed locally
npx supabase gen types typescript --local  # regenerate DB types
```

**Before declaring any task done:** `npm run typecheck && npm run lint && npm run test`. Run `test:e2e` when you touched a journey in `PRD §7`.

Never mark work complete on code you have not executed.

---

## 4. Structure

Full tree in [ARCHITECTURE.md §10](./ARCHITECTURE.md). The rules that matter on every change:

```
components/   what things look like   — reusable, zero data access
features/     what a screen does      — composition + data
server/       what the system does    — privileged, secrets live here
lib/          pure, shared, client-safe
```

**Dependencies flow one way only:**

```
actions/ ─┬──▶ services/ ──▶ db/
handlers/ ┘        ├──▶ ai/
                   ├──▶ news/
                   └──▶ security/
```

- A lower layer must **never** import from a higher one.
- A file in `components/` importing from `server/` is a structural bug — fix the design, not the import.
- Put a new file where its *responsibility* belongs, not where it is convenient.

---

## 5. Code quality and naming

| Thing | Convention |
|---|---|
| Component files | `PascalCase.tsx`, one component per file, named export |
| Everything else | `kebab-case.ts` |
| Functions, variables | `camelCase` |
| Types, interfaces, enums | `PascalCase` — no `I` prefix |
| Constants | `SCREAMING_SNAKE_CASE` |
| Database columns, JSON payloads | `snake_case` |
| Server Actions | verb-first: `markPosted`, `planMonth` |
| Booleans | `is` / `has` / `can` prefix |
| Zod schemas | `ThingSchema`, inferred type `Thing` |

**Writing style:**

- Name things after **domain concepts** (`hydrateItem`, `pillarRotation`), never mechanics (`processData`, `handleStuff`).
- Functions do one thing. If you need "and" to describe it, split it.
- Guard clauses over nested conditionals. Return early.
- **Comment only non-obvious *why*** — a constraint, a workaround, a spec reference. Never narrate *what* the code does.
- No dead code, no commented-out blocks, no `console.log` left behind, no placeholder `TODO` without an explanation of what and why.

---

## 6. Type safety

- `strict: true`. **No `any`.** No `@ts-ignore` or `@ts-expect-error` without a comment justifying it.
- **No non-null assertions (`!`)** on external data. Narrow it properly.
- **Zod schemas are the single definition.** Derive TypeScript types from schemas with `z.infer` — never hand-write a type that parallels a schema. They will drift.
- **Supabase generated types are the database truth.** Regenerate after every migration; never hand-edit them.
- **Never type-assert external data into shape.** Parse it. This applies to request input, search params, RSS feeds and — especially — model output.
- Prefer discriminated unions over optional-field soup. The result envelope in [API.md §4.1](./API.md) is the house pattern.

---

## 7. Component reuse

**Check before you create.** Search `components/ui`, `components/content`, `components/calendar`, `components/shell`, `components/feedback` first. [DESIGN.md §6](./DESIGN.md) is the authoritative inventory of ~26 components — if what you need is listed there, it exists or belongs there, not inlined into a screen.

- **Extend, don't fork.** Need a variant? Add a prop to the existing component. Never copy a component to tweak it.
- **Tokens only.** No literal colours, pixel values or durations. [DESIGN.md §3–5](./DESIGN.md). Arbitrary Tailwind values containing raw colours or px are lint errors.
- **`"use client"` on the smallest possible component**, never on a page or layout. The permitted client components are enumerated in [ARCHITECTURE.md §3.2](./ARCHITECTURE.md); adding one outside that list needs justification.
- Client components receive plain serialisable props — never a database client or a server utility.
- **Every surface needs loading, empty and error states.** A blank region is a bug. [DESIGN.md §9](./DESIGN.md) specifies each one.
- Match the design review checklist in [DESIGN.md §14](./DESIGN.md) before considering UI work done.

---

## 8. Dependencies

The production dependency list in [ARCHITECTURE.md §2.1](./ARCHITECTURE.md) is **closed at thirteen packages**. [§2.3](./ARCHITECTURE.md) records what was rejected and why.

Before adding anything:

1. Can the platform do it? (Server Components, native `fetch`, Postgres, Web APIs.)
2. Is it already solved in `lib/`?
3. Is it on the rejected list? If so, the bar is a written argument against that entry.
4. Would writing it yourself be ~30 lines? Then write it.

**Never** add a dependency without saying so explicitly in your response. Never bump versions as a side effect of unrelated work. Never introduce a second library that overlaps one already present.

---

## 9. Error handling

Full spec: [API.md §4](./API.md), [ARCHITECTURE.md §12](./ARCHITECTURE.md).

- **Server Actions never throw across the client boundary.** Return the result envelope. Thrown production errors become an opaque digest and the UI cannot render the right recovery.
- Use the six codes — `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `RATE_LIMITED`, `GENERATION_FAILED`, `UNEXPECTED`. Do not invent new ones.
- **Never leak internals** to the client: no stack traces, model names, provider names, table names, SQL or IDs.
- **State whether data changed.** "Nothing was changed" is information the user needs.
- **Fail closed.** A missing secret or unverifiable token denies access — never degrades into permitting.
- **Fail isolated.** One bad feed, stage, item or list must not take down anything else.
- Never swallow an error. Never `catch {}`. If you handle it, log it and surface it.

---

## 10. Security and secrets

These are non-negotiable. Violating any one is a release blocker.

- **Never commit a secret.** Not in code, tests, fixtures, comments, commit messages or `.env.example`. Real values go in `.env.local` (git-ignored) and Vercel only.
- **Secrets are referenced only inside `server/`.** Only `NEXT_PUBLIC_*` may appear elsewhere. Server modules import `server-only`.
- **Every Server Action re-verifies session and allowlist in its own body.** Middleware is never sufficient — actions are independently addressable HTTP endpoints. This is the most common critical vulnerability in App Router apps.
- **Model output is untrusted input**, exactly like a request body. Parse, validate, cross-check sources, render as text.
- **No `dangerouslySetInnerHTML`.** There is no HTML rendering path in this product.
- `service_role` is used in the cron route handler and the scoped admin module (`server/db/admin.ts`, reachable only with a verified `AdminActor` — ARCHITECTURE.md §6.3) **only**.
- Never log a credential, a token, or a full request body containing one.
- Never weaken a constraint, an RLS policy or a validation rule to make something pass. Fix the caller.

If a task appears to require breaking one of these, **stop and ask**.

---

## 11. Database and API access

- **Only `server/db/` constructs a Supabase client or writes queries.** Everything else goes through it.
- **Migrations are forward-only**, in `supabase/migrations/`, applied via the Supabase CLI. No down-migrations, no destructive DDL.
- **A new table ships with its RLS policies in the same change.** RLS enabled with no policy returns nothing; RLS disabled returns everything. The second is a breach.
- Enum value additions get their own migration file, alone — `ALTER TYPE ... ADD VALUE` cannot share a transaction.
- **Constraints are the invariant layer.** Never work around one in application code. If a constraint blocks legitimate behaviour, the schema or the understanding is wrong — flag it.
- Validate every input and every search param with Zod. Invalid search params fall back to defaults, never echo.
- Respect the rate limiter. Never add an AI-calling path without consuming the budget.
- Adding a route handler requires justification — [API.md §1.1](./API.md) deliberately keeps the surface at three.

---

## 12. Testing

Priorities, per [ARCHITECTURE.md §14](./ARCHITECTURE.md):

| Always test | Why |
|---|---|
| Zod output schemas | The contract protecting the database from bad model output |
| Planning rule validator | Guarantees pillar rotation and anti-repetition |
| Status transitions | Illegal transitions must be impossible |
| Rate limiter | Boundaries, window rollover, concurrency |
| Source cross-check | Fabricated URLs stripped; sourceless news rejected |
| Date logic | IST/UTC handling around month boundaries |

- **Test behaviour, not implementation.** No snapshot tests of components.
- Mock AI at the `ai/client` boundary. Unit tests make no network calls.
- A bug fix starts with a failing test that reproduces it.
- **Never weaken or delete a test to make a build pass.** If a test is wrong, say so and explain.
- E2E covers journeys J1, J2, J3 from `PRD §7` only.

---

## 13. Documentation

- **Update the owning spec in the same change** when behaviour, schema, API surface or design rules change. The specs are the contract.
- **Do not create new markdown files.** No summary docs, no notes, no plans, no migration guides — unless explicitly asked. The six documents in §2 plus this file are the complete set.
- Do not duplicate spec content into code comments or READMEs. Link instead.
- Keep `.env.example` current when adding configuration — names and comments, never values.

---

## 14. Git and change discipline

### Repository and work-laptop credential gate

- The intended repository is [apexoria-learning/marketing-content-app](https://github.com/apexoria-learning/marketing-content-app). Use `https://github.com/apexoria-learning/marketing-content-app.git` as `origin` only after the checks below pass.
- **Before initializing Git, committing, or any fetch, pull or push**, inspect Windows Credential Manager metadata (`cmdkey /list`), the configured credential helper, and Git author identity. If available, use `gh auth status` to identify the active GitHub account. Never retrieve or display passwords or tokens.
- **Stop if the relevant GitHub account or Git identity is work-related**, including `cat.com`, `ujawan_cat`, or similar corporate identifiers. Missing or ambiguous GitHub account metadata also blocks proceeding. Ask the user to authenticate an authorized non-work GitHub account and confirm a non-work commit name and email; never assume an unrelated Windows credential is GitHub authentication.
- This is a shared work laptop: never delete or replace stored work credentials, change global Git configuration, or reuse corporate credentials for this repository. Once confirmed, set author identity at repository scope only. Never store credentials in this file, repository files, or remote URLs.
- After the gate passes, inspect local Git state and verify `origin` matches the intended repository. If Git is not initialized, initialize only this project directory. Ask before replacing a different existing remote.
- Inspect remote branches and history before choosing a branch or integrating changes. Preserve local files and remote history; do not blindly pull into this populated workspace, overwrite files, or force-push. Ask how to reconcile conflicting or unrelated histories.
- Before staging, review the intended file list and diff, exclude secrets and ignored artifacts, and run the applicable checks in §3. Stage only reviewed project files. Commit and push when requested by the user; verify the pushed branch points to the local commit before reporting success.

### Commit conventions

- **One logical change per commit.** Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Subject in imperative mood, under 72 characters. Body explains *why* when non-obvious.
- **Never commit** `.env*`, secrets, build output, `node_modules`, or generated types that belong in `.gitignore`.
- Never mix a refactor with a behaviour change. Never bundle unrelated fixes.
- Never force-push, rewrite history, amend someone else's commit, or revert work you did not author.
- Include the trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

---

## 15. Definition of done

Before reporting a task complete:

- [ ] The owning spec was read, and updated if behaviour changed
- [ ] Existing patterns reused; nothing rewritten unnecessarily
- [ ] No unrelated files touched
- [ ] `typecheck`, `lint` and `test` pass — actually run, not assumed
- [ ] No `any`, no `!` on external data, no `@ts-ignore` without justification
- [ ] No secret in code, tests, fixtures or commit message
- [ ] Server Actions verify session + allowlist independently
- [ ] Loading, empty and error states exist for any new surface
- [ ] New tables carry RLS policies; new inputs carry Zod validation
- [ ] No new dependency added silently
- [ ] Anything uncertain, deviating or out of scope is stated plainly in the response

**When in doubt, ask rather than assume.** A clarifying question costs minutes; a wrong assumption propagated through a production codebase costs days.
