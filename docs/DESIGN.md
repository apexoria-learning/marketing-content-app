# DESIGN.md — Trailhead Simplified Content Co-pilot

**Source of truth for:** visual design, interaction design and UX rules.
**Derived from:** `PRD.md` v1.0.
**Scope:** MVP (v1). Every rule here is reusable — if something can only be used once, it does not belong in this document.

---

## 1. Design principles

These resolve disputes. When two options are defensible, the earlier principle wins.

**P1 — The content is the interface.**
The thing the user came for is a caption, a slide list, a brief. It must be the most prominent element on every screen, rendered at reading size with real line breaks and real emoji. Chrome, labels and controls recede. Never shrink content to make room for UI.

**P2 — Two minutes, one hand, zero typing.**
The primary loop (open → read → copy → mark posted) must be completable with a thumb, without typing, without scrolling past the fold more than once. Typing exists only in Settings and the optional regeneration steer.

**P3 — Earn attention, don't decorate.**
Every colour, border, shadow and animation must encode information: which platform, what format, posted or pending, loading or settled. Ornament that encodes nothing is removed.

**P4 — A tool, not a brochure.**
This is a professional instrument used daily by a handful of people. It should feel like a well-built studio app: dense where density helps, quiet, fast, confident. No hero illustrations, no mascots, no marketing copy inside the product.

**P5 — Never show nothing.**
Every surface has a defined loading, empty and error state. A blank region is a bug.

**P6 — Confidence through consistency.**
A platform is always the same colour and the same icon. A pillar is always the same chip. A posted item always looks posted. Users should be able to read the calendar at a glance after one day of use.

### Explicit anti-patterns

Do not produce the default AI-SaaS look. The following are banned:

- Purple/indigo → pink gradients, and gradient text.
- Glassmorphism, frosted blur panels, "aurora" background blobs.
- Generic 3D illustrations, mascots, or stock people.
- Drop shadows on everything; floating cards on a light grey page.
- Emoji used as UI icons in chrome (emoji inside *generated content* is fine and expected).
- Full-width rainbow accent bars, neon glows, animated gradient borders.
- Centre-aligned body copy.
- A generic elevated circular FAB in the middle of the tab bar.
- More than one accent colour competing for "primary action".

---

## 2. Visual direction

**Concept: "Morning Briefing".**
The product is a dark, editorial desk. Think a well-set newspaper column or a professional writing tool, not a dashboard. Typographic hierarchy does the heavy lifting; surfaces are near-black navy and separated by hairlines and small lightness steps rather than shadows. One accent — **Trailhead Blue** — marks what is actionable and what is achieved.

**Why dark-first:** the app is used on a phone early in the morning and late at night; the content being previewed (Instagram reels, YouTube Shorts) reads as light text on dark surfaces the same way the target apps do in dark mode; and a near-black canvas lets the platform colours act as unambiguous data encoding.

**Texture and form language**
- Rectilinear, generously rounded (16–24px on cards), no circles except avatars, dots and the progress ring.
- Hairline borders at 8% white are the primary separator. Shadows appear only on genuinely floating layers (bottom nav, sheets, toasts).
- A single, subtle vertical gradient on the page background (top slightly lighter) gives depth without becoming a "blob".
- Content blocks use a recessed surface, not a raised one — captions sit *in* the page like a quote, not *on top* of it.

**Brand expression**
Trailhead Simplified teaches real Salesforce skills from real projects, simply and in Hinglish (tagline: *Salesforce Simplified. Career Amplified.*). Blue carries trust and the Trailhead association; **Mint** is the single keyword highlight. The accent is a deep blue, deliberately darker than the sky-blue platform slot, and platform colours are always paired with a glyph, so brand and data never fight.

### 2.1 Brand kit

The source mockup is [brand-kit/](./brand-kit/Main.dc.html) — a visual reference, not production code. Its values are implemented in `src/styles/tokens.css`, `public/icons/` and the layout fonts; where the two disagree, this document and the tokens win and the kit is updated. The creator's production rules (script lanes, signature lines, pacing, screen-share settings) live in [content/CONTENT-RULES.md](../content/CONTENT-RULES.md) and reach the generator through the brand profile and platform guidance.

| Rule | Value |
|---|---|
| Logo | Blue circle, white hexagon outline, white check mark (`public/icons/icon.svg`). Avatar variant: Deep Navy `#00386B` circle with `#8FB3DA` strokes, for profile pictures |
| Logo spacing | Clear space of half the logo width on every side; minimum size 48px |
| Logo never | Stretched, rotated, recoloured or given shadows |
| Colour balance | About 60% Night or White, 30% Blue and Navy, 10% Green and Mint |
| Brand colours | Trailhead Blue `#0070D2`, Deep Navy `#00386B`, Night `#0B111D`, Pill Green `#1E6B4B`, Mint `#A8E6C4`, White `#FFFFFF` |
| Reel / Short template | 9:16, captions on, text kept clear of the top and bottom safe zones; hook in the first 2 seconds, then the concept, then a 2-second end card with the logo, "Follow for tomorrow's tip" and `@TrailheadSimplified`; same low-volume music style every time |
| Reel type sizes | Hooks in Poppins Bold, 64–72px; captions in Inter Medium, 40–44px; labels 28px; highlight one keyword in Mint |

**Series tags** (reel and thumbnail design only — not UI colours, and not pillars; the planner's pillars are in `PRD.md` §6.1 and stay uncoloured, §6.2). The designer or editor picks the series that fits each piece:

| Series | Colour |
|---|---|
| Tutorials | `#4ADE9B` |
| Certifications | `#5BB5FF` |
| Career Tips | `#F5A524` |
| Deep Dives | `#B79CFF` |

**Check before posting:** brand colours and fonts only · hook visible in the first 2 seconds · captions readable on a small phone · logo and end card present · facts checked against Salesforce documentation · series tag and call to action added.

---

## 3. Colour

### 3.1 Principles
- Colour is a data channel first, decoration never.
- **Never encode meaning in colour alone** (NFR-5.3). Colour always pairs with an icon, a label or a shape.
- Exactly one accent for "primary action". Platform colours are reserved for platform identity and must never be used for buttons.
- Posted state is **not** a colour. It is a treatment: reduced surface contrast + an accent tick + an eyebrow label.

### 3.2 Palette — dark theme (default)

**Neutrals (Night-based, blue-tinted)**

| Token | Value | Use |
|---|---|---|
| `canvas` | `#0B111D` | Page background (base of the subtle gradient) |
| `canvas-raised` | `#0F1727` | Top of the page gradient |
| `surface-1` | `#131C2E` | Cards, sheets, nav |
| `surface-2` | `#18243A` | Nested surfaces, hovered rows |
| `surface-sunken` | `#080D17` | Copy blocks, code/hashtag blocks, inputs |
| `border` | `rgba(255,255,255,0.08)` | Default hairline |
| `border-strong` | `rgba(255,255,255,0.16)` | Focused/selected edges |
| `text-primary` | `#F5F8FC` | Headings, captions, body |
| `text-secondary` | `#A9B6C9` | Supporting copy, metadata |
| `text-tertiary` | `#76849A` | Eyebrows, timestamps, disabled |

**Accent — Trailhead Blue**

| Token | Value | Use |
|---|---|---|
| `accent` | `#0070D2` | Primary buttons, progress ring, posted tick, focus ring |
| `accent-hover` | `#005FB2` | Pressed/hover |
| `accent-muted` | `rgba(0,112,210,0.18)` | Accent-tinted backgrounds, selected chips |
| `accent-on` | `#FFFFFF` | Text/icon on top of a solid accent fill (4.9:1) |
| `highlight` | `#A8E6C4` (Mint) | The single keyword highlight and success confirmation |

On the dark theme `accent` holds 3.1–3.8:1 against the surfaces: enough for glyphs, rings and focus indicators (§3.4), **not** for body-size text.

**Platform encoding** — each pairs with a mandatory icon. Platforms are admin-managed catalogue rows (`DATABASE.md` §5.12); each picks one of eight contrast-tested **colour slots** and one glyph from the icon set. Admins cannot enter arbitrary colours or upload logos.

| Token | Dark value | Slot name | Seeded for |
|---|---|---|---|
| `platform-1` | `#FF4D8D` | Pink | Instagram (camera glyph) |
| `platform-2` | `#3B9BFF` | Blue | LinkedIn ("in" glyph) — retired by migration `0020` |
| `platform-3` | `#2BD97C` | Green | WhatsApp Status (chat-bubble glyph) — retired by migration `0020` |
| `platform-4` | `#FF9640` | Orange | YouTube (`video` glyph) |
| `platform-5` | `#B28CFF` | Violet | — |
| `platform-6` | `#2FD0E0` | Cyan | — |
| `platform-7` | `#A6E33B` | Lime | — |
| `platform-8` | `#9AA8BD` | Slate | — |

Each slot has a `-muted` variant (14% dark, 12% light) for chip backgrounds and a light-theme value darkened to keep ≥ 3:1 on every surface; `token-contrast.test.ts` checks all eight in both themes. Platform glyphs: `instagram`, `linkedin`, `whatsapp` (custom-drawn marks) plus generic `platform`, `globe`, `video`, `chat`, `briefcase`, `megaphone`. A new custom mark is a code change to the icon set; it is never an uploaded image.

**Semantic**

| Token | Value | Use |
|---|---|---|
| `danger` | `#FF5B52` | Overdue items, destructive confirm, error states |
| `danger-muted` | `rgba(255,91,82,0.14)` | Error banner background |
| `success` | `highlight` (alias) | Success is expressed in Mint (Pill Green in the light theme), not the platform green |
| `skeleton` | `rgba(255,255,255,0.06)` | Shimmer base |

### 3.3 Light theme
Light mode is available from Settings but is **not** the default. It is a token remap only — no component may branch on theme.

| Token | Light value |
|---|---|
| `canvas` | `#F5F8FC` |
| `canvas-raised` | `#FFFFFF` |
| `surface-1` | `#FFFFFF` |
| `surface-2` | `#EEF3F9` |
| `surface-sunken` | `#E8EEF6` |
| `border` | `rgba(11,17,29,0.10)` |
| `text-primary` | `#0B111D` |
| `text-secondary` | `#3A4658` |
| `text-tertiary` | `#66748A` |
| `accent` | `#0070D2` (4.9:1 with `accent-on`) |
| `accent-on` | `#FFFFFF` |
| `highlight` | `#1E6B4B` (Pill Green; Mint is too light on white) |
| Platform colours | darkened ~12% to hold 3:1 against the light surfaces (WhatsApp `#1A9453`, which needed more) |

### 3.4 Contrast requirements
- Body and caption text: ≥ 4.5:1 against its surface.
- Headings ≥ 24px: ≥ 3:1 permitted, but aim for 4.5:1.
- Icons, borders of interactive controls, platform dots: ≥ 3:1.
- `text-tertiary` may only be used at 13px+ and never for essential information.
- The accent is never used as a text colour on `surface-1` below 16px semibold.

---

## 4. Typography

### 4.1 Families

| Role | Family | Rationale |
|---|---|---|
| Display / headings | **Poppins** (600, 700) | The brand kit's heading face: friendly and geometric, strong at reel-hook sizes |
| UI / body / content | **Inter Variable** (400, 500, 600) | Highest-legibility workhorse at small sizes on mobile; renders generated captions neutrally |
| Numerals (calendar, counts) | Inter with `font-variant-numeric: tabular-nums` | Calendar columns must not jitter |
| Mono | **JetBrains Mono** (400, 500) | Hashtag blocks, dimensions, technical specs — signals "machine-exact, copy me verbatim" |

All fonts self-hosted and subset; `font-display: swap`; no layout shift (metric-compatible fallbacks declared).

### 4.2 Scale

Mobile-first. One scale; do not invent intermediate sizes.

| Token | Size / line-height | Weight | Tracking | Family | Use |
|---|---|---|---|---|---|
| `display` | 32 / 36 | 700 | -0.02em | Poppins | Today's date, big empty-state statements |
| `h1` | 24 / 30 | 600 | -0.015em | Poppins | Screen titles, item hook |
| `h2` | 20 / 26 | 600 | -0.01em | Poppins | Section headings, slide headlines |
| `h3` | 17 / 24 | 600 | 0 | Inter | Card titles, sheet headers |
| `body` | 16 / 26 | 400 | 0 | Inter | **Generated captions and all reading content** |
| `body-strong` | 16 / 26 | 500 | 0 | Inter | Emphasis within body |
| `sm` | 14 / 20 | 400 | 0 | Inter | Secondary UI text, list metadata |
| `caption` | 13 / 18 | 400 | 0 | Inter | Timestamps, helper text |
| `eyebrow` | 11 / 14 | 600 | 0.09em, uppercase | Inter | Section labels, status labels, format labels |
| `mono` | 13 / 20 | 400 | 0 | JetBrains Mono | Hashtags, dimensions |

### 4.3 Rules
- Generated content is **always** `body` at 16px minimum. It is never truncated in the detail view, never rendered in a smaller size to "fit", and always preserves authored line breaks.
- In list and card previews, content may be clamped by line count (`-webkit-line-clamp`), never by character count with an ellipsis inserted mid-word.
- Maximum measure for reading content: **68 characters**. On wide viewports the column is constrained, not stretched.
- One `display` or `h1` per screen. Never stack two headings without content between them.
- `eyebrow` is the only uppercase style in the product.
- No italics anywhere except quoted viewer testimonials inside generated content.
- Headings never wrap to more than three lines; hooks clamp to three lines in previews.

---

## 5. Spacing and layout

### 5.1 Spacing scale
Base unit **4px**. Permitted values only:

`0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

Mapping rules:
- `4` — icon-to-label inside a chip
- `8` — between tightly related elements (label above a value)
- `12` — between rows in a list; internal card gaps
- `16` — standard gap between distinct elements
- `20` — page horizontal padding (fixed, all breakpoints)
- `24` — between cards; card internal padding
- `32` — between major sections
- `48` — above a section that begins a new mental context
- `64` — bottom spacer reserving room for nav + action bar

### 5.2 Layout model
- **Single column everywhere.** There is no multi-column dashboard in v1.
- Content column max-width **560px**, horizontally centred at all viewports above that width.
- Page padding: `20px` left/right, constant from 320px upward.
- Vertical rhythm: sections separated by `32`, cards by `24`, list rows by `12`.
- Bottom of every scrollable page reserves `96px` (nav height + action bar + safe area) so the last item is never obscured.
- `env(safe-area-inset-*)` respected on all fixed elements.

### 5.3 Radius

| Token | Value | Use |
|---|---|---|
| `r-sm` | 8px | Chips, small buttons, dots-as-squares |
| `r-md` | 12px | Inputs, list rows, copy blocks |
| `r-lg` | 16px | Secondary cards, sheets' inner blocks |
| `r-xl` | 24px | Primary content cards, bottom sheets (top corners) |
| `r-pill` | 999px | Nav pill, filter chips, primary buttons |

Rule: nested radii step **down** by one token. A `r-xl` card contains `r-md` blocks, never another `r-xl`.

### 5.4 Elevation
Dark UI separates by lightness and hairline, not shadow.

| Level | Treatment | Use |
|---|---|---|
| `e0` | `canvas`, no border | Page |
| `e1` | `surface-1` + `border` | Cards, rows |
| `e2` | `surface-2` + `border` | Nested blocks, selected rows |
| `e3` | `surface-1` + `border-strong` + `shadow-float` | Bottom nav, action bar |
| `e4` | `surface-1` + `shadow-overlay` + scrim | Bottom sheets, dialogs, toasts |

`shadow-float`: `0 8px 24px rgba(0,0,0,0.45)`
`shadow-overlay`: `0 -12px 48px rgba(0,0,0,0.6)`
Scrim: `rgba(0,0,0,0.6)` with a 4px backdrop blur — the **only** permitted use of blur.

### 5.5 Iconography
- Single set, outline style, 1.75px stroke, 24px default (20px in chips, 28px in nav).
- Icons are monochrome and inherit `currentColor`, except platform glyphs which carry their platform colour.
- Every icon-only control has an accessible label.
- Platform glyphs are custom-drawn marks matching the stroke weight of the rest of the set — never pasted brand logos.

---

## 6. Component library

Every component below is reusable and token-driven. Components never hard-code colour, size or spacing values.

### 6.1 Structural

**AppShell**
Fixed page gradient background, scroll container, safe-area padding, mounts `PageHeader`, content slot, `ActionBar` and `BottomNav`.

**PageHeader**
Height 56px, sticky, becomes `surface-1` with a bottom hairline after 8px of scroll (never on first paint).
Layout: title left (`h1`, shrinks to `h3` once collapsed), up to two icon actions right. Back navigation uses a left chevron that replaces the title's left padding on detail routes.
No search in v1.

**BottomNav — floating pill**
A `r-pill` bar, `e3`, 64px tall, inset 20px from each side, floating 16px above the safe-area inset. Four destinations: **Today, Calendar, Create, Archive**.
Each item: icon above an 11px label. Active item shows the label in `text-primary`, icon in `accent`, and a 4px accent dot beneath. Inactive: `text-tertiary`.
Rationale: the pill keeps the reachable thumb arc clear of screen edges, and the absence of a centre FAB is deliberate (P3) — the primary action is contextual, not global.

**ActionBar — contextual primary action**
A full-width-minus-padding bar that sits directly above `BottomNav` (12px gap) and changes per screen:

| Screen | Action |
|---|---|
| Today (unposted item in view) | **Mark as posted** |
| Today (all posted) | Hidden; progress summary shown inline instead |
| Item detail | **Copy everything** (primary) + posted toggle (secondary, icon) |
| Create | Hidden |
| Calendar / Archive | Hidden |

The bar slides out of view on scroll-down and returns on scroll-up. It never covers the final content element because of the `64` bottom spacer.

**BottomSheet**
Drag-to-dismiss, `r-xl` top corners, `e4`, grab handle, max height 85vh, internal scroll. Used for day detail, filters, regeneration steer and confirmations. There are **no centre modal dialogs** in the product — every overlay is a bottom sheet (thumb reachability, P2).

### 6.2 Identity and metadata

**PlatformBadge**
Icon + label. Variants: `dot` (8px coloured dot, calendar only), `compact` (icon only, 20px), `full` (icon + text in a `platform-<slot>-muted` pill).
Always colour **and** icon **and** — in `full` — text. Label, colour slot and glyph come from the platform catalogue via `PlatformCatalogueProvider`; an unknown key renders its humanised key in neutral `surface-2` with the generic glyph. `PlatformName` renders the label as plain text (queue rows, legends).

**PillarChip**
`r-pill`, `surface-2`, `border`, `eyebrow` text, no colour coding (up to fourteen pillars cannot be colour-coded legibly). The short label comes from the pillar catalogue via `PillarCatalogueProvider` (seeded: *Tips, News, Meme, Interview, Success, Promo, Career, BTS, Myths, Poll*); an unknown key renders its humanised key. `PillarName` renders the label as plain text (queue rows).

**FormatChip**
`r-sm`, icon + `eyebrow` label: Carousel, Reel, Post, Story, Meme, Poll, Short, Video. Carries a format glyph; no colour.

**StatusPill**
`eyebrow` text in a muted pill. States: `Planned` (neutral), `Ready` (neutral, border-strong), `Posted` (accent-muted + tick glyph), `Skipped` (strikethrough label, `text-tertiary`), `Overdue` (danger-muted + alert glyph).

### 6.3 Content components

**ContentCard** — the signature component
Used on Today (full) and inside the day sheet (condensed).
Structure, top to bottom:
1. Meta row — `PlatformBadge full` · `FormatChip` · `PillarChip`, right-aligned `StatusPill`
2. **Hook** — `h2`, clamped to 3 lines
3. Caption preview — `body`, clamped to 4 lines, `text-secondary`
4. Footer row — scheduled date (`caption`), and a `StatusTick` on the right

Surface `e1`, `r-xl`, padding `24`. Whole card is tappable to the detail route; the `StatusTick` stops propagation.
**Posted treatment (approved accessibility refinement):** use the sunken surface and a subdued accent border, retaining readable text and platform glyphs at full contrast. The Posted label and accent tick remain explicit. Do not apply 55% opacity to reading content: it fails the 4.5:1 body-text requirement, particularly in light mode. No strikethrough on content.

**TipCard**
Visually distinct from `ContentCard` so it is never mistaken for postable content: `surface-sunken`, a 2px left accent rule, `eyebrow` label "Tip of the day", tip in `body-strong`. No status, no copy-all, no tick.

**CopyBlock** — the workhorse
A recessed `surface-sunken`, `r-md` block that renders generated text verbatim with preserved line breaks.
- Header row: `eyebrow` label (e.g. CAPTION) on the left; a text button **Copy** on the right.
- Long-press anywhere in the block also copies, with haptic feedback.
- On copy: the button label swaps to **Copied** with a tick for 1.5s; only that control changes; no toast (toasts are reserved for state that persists off-screen).
- Hashtag variant renders in `mono` and wraps.
- If the Clipboard API is unavailable, the block becomes user-selectable and the button becomes a "Select all" helper.

**SlideList**
Ordered list for carousels. Each slide: a 28px `r-sm` numbered square (slide index, `mono`), slide headline (`h3`), slide body (`body`), optional visual note (`caption`, `text-tertiary`, prefixed with a small image glyph). Slides are separated by hairlines, not cards. A single **Copy all slides** action sits in the section header and produces numbered plain text.

**ScriptList**
Reel, Short and video scripts. Each scene: timestamp range (`mono`, fixed-width gutter), action/direction (`body`), on-screen text (nested `CopyBlock`-styled inline chip so the designer can see exactly what goes on screen). Header shows total duration and a **Copy script** action.

**BriefSection**
Design brief rendering. Fixed subsection order so designers learn the shape: **Objective → Visual direction → Layout notes → Typography → Must include → Must avoid → Specs**.
`Must include` / `Must avoid` render as icon-prefixed lists (plus/minus glyphs, never colour alone). `Specs` renders in `mono` as `key: value` rows (dimensions, aspect ratio, safe areas, slide count).

**SourceList**
Only rendered when sources exist (never an empty heading). Each source: favicon-less domain label (`caption`, `text-tertiary`), title (`sm`, `text-primary`), external-link glyph. Opens in a new context. A `News` item with zero sources renders a `danger`-tinted inline warning — it must not silently look verified.

### 6.4 Controls

**Button**

| Variant | Appearance | Use |
|---|---|---|
| `primary` | Solid `accent`, `accent-on` text, `r-pill`, height 52 (action bar) / 44 (inline) | One per screen maximum |
| `secondary` | `surface-2`, `border`, `text-primary` | Supporting actions |
| `ghost` | Transparent, `text-secondary` | Tertiary/inline actions |
| `danger` | `danger-muted` background, `danger` text | Destructive confirmation only |
| `icon` | 44×44 touch target, 24px glyph | Header and row actions |

States for all: default, hover (desktop only), pressed (scale 0.97, 100ms), focus-visible (2px `accent` ring, 2px offset), disabled (40% opacity, no pointer events), loading (label replaced by a 16px spinner; width preserved to prevent layout shift).

**StatusTick** — the posted checkbox
A 28px rounded square (`r-sm`), `border-strong` when unchecked, solid `accent` with a drawn tick when checked.
Interaction: tap → optimistic fill, tick path draws over 240ms, 0.9→1.06→1 scale spring, light haptic, and the month `ProgressRing` advances simultaneously. Failure rolls the state back and shows an error toast.
Accessible as a real checkbox with the label "Mark *[hook]* as posted".
This is the most-used control in the product; it is deliberately over-sized relative to its visual weight.

**ProgressRing**
A 56px ring showing `posted / planned` for the current month. Accent arc on a `border` track, count in `h3` tabular numerals at the centre, `eyebrow` label beneath. Animates the arc when a tick lands. Tapping it navigates to Calendar — the number is also a destination.

**SegmentedControl**
`r-pill` track on `surface-2` with a sliding `surface-1` thumb. Maximum four segments. Used for Archive month scope and Create format filter. Labels stay on one line (tight horizontal padding) so a four-segment control still fits at 320px without breaking a word.

**FilterBar**
Horizontally scrollable row of `r-pill` toggle chips, 12px gap, fading edge mask. Selected chips use `accent-muted` with `border-strong` and a leading tick glyph. A trailing **Clear** ghost button appears only when filters are active. Active filter count is mirrored in the header so state is visible after scrolling.

**QueueRow** (Create screen)
Compact row: 40px `r-sm` format glyph tile on the left; title/hook (`sm`, 2-line clamp) and a meta line (`caption`: date · platform · pillar); `StatusTick` on the right. Overdue rows show a 2px `danger` left rule and a date in `danger`.

**Inputs** (Settings, the admin panel and the regeneration steer only)
`surface-sunken`, `r-md`, `border`, 48px min height, 16px text (prevents iOS zoom), label above in `eyebrow`, helper/error text below in `caption`. Errors use `danger` text **plus** an alert glyph. Textareas auto-grow to a max of 8 lines then scroll.

**Checkbox** (admin panel)
Native checkbox tinted `accent`, with the whole label row as a 44px target and optional `caption` helper beneath. Used for on/off settings (AI generation, per-person AI permission). Distinct from `StatusTick`, which remains the posting control.

**Toast**
Bottom-anchored above the nav, `e4`, `r-lg`, max 2 lines, auto-dismiss 4s, swipe to dismiss, one optional action (usually **Undo**). Only one toast at a time; a new toast replaces the current one.

**Banner**
Full-width inline strip at the top of the content area for persistent background state (month generation running, offline, last generation failed). Variants: neutral, accent, danger. Dismissible only when the state is informational.

### 6.5 Calendar components

**CalendarGrid**
7 columns, Monday-first, fixed cell aspect 1:1.15, weekday header in `eyebrow`. Month label and chevrons sit in a sticky sub-header below `PageHeader`. Horizontal swipe changes month.

**Approved narrow-phone refinement:** below 400px use a full-width, dated agenda instead of squeezing seven columns below the 44px target minimum. At 400px and above the grid uses an 8px gap and cells at least 44px wide. Both views open the same day sheet, retain the permanent legend, and provide month chevrons as the non-gesture equivalent.

**DayCell**
- Date numeral top-left, `sm`, tabular.
- Up to two indicators bottom-centre: 8px platform dots. Pending = hollow ring in the platform colour; posted = filled dot with a 6px accent tick overlay.
- Today: `accent` 1.5px ring around the cell.
- Selected: `surface-2` fill.
- Outside current month: 35% opacity, non-interactive.
- Unplanned days within a generated month: a single 4px `text-tertiary` dash — visibly different from "no data".
- Minimum 44×44 touch target enforced regardless of visual size.

**DaySheet**
Bottom sheet showing the full date, one condensed `ContentCard` per item, and a **Generate for this day** action when the day is empty.

### 6.6 Feedback and state components

**Skeleton**
Shape-accurate placeholders built from the real component's geometry (same height, radius and spacing) so nothing shifts when data lands. A single left-to-right shimmer at 1.4s, paused under `prefers-reduced-motion` (static `skeleton` fill instead).

**EmptyState**
Vertically centred in its container. Structure: 32px outline glyph (`text-tertiary`) → `h2` statement → one line of `sm` `text-secondary` guidance → one `secondary` button. Never more than one action. No illustrations.

**ErrorState**
Same structure as `EmptyState` but the glyph is `danger`, the statement is plain language, and the button is **Try again**. Technical detail is never rendered.

---

## 7. Navigation

### 7.1 Model
Flat, four-destination tab architecture with one detail layer.

```
Today ─┐
Calendar ─┼─→ Item detail ─→ (regeneration sheet)
Create ─┤
Archive ─┘
Settings (from header, modal-style route)
Admin (from the Today header, admins only; sections as sibling links)
```

- Tabs preserve independent scroll positions.
- Item detail is a pushed route with a back chevron; it returns to the originating tab.
- Settings pushes from the Today header and dismisses back to it.
- Admin pushes from the Today header with a back chevron. Its six sections (Overview, Users, Platforms, Prompts, Filters, Settings) are siblings in a chip-style link row, so depth stays at two.
- Maximum depth is two. Nothing in v1 goes three levels deep.

### 7.2 Transitions
- Tab switch: cross-fade of content (160ms), no horizontal slide — tabs are siblings, not a sequence.
- Push to detail: content slides up 16px with a fade (240ms); back reverses.
- Sheet: slide from bottom (280ms, emphasised easing) with scrim fade.
- Month change: horizontal slide matching swipe direction (240ms).
- Today deck: horizontal paging with the next card peeking 16px.

### 7.3 Deep behaviours
- Opening the app always lands on Today, regardless of last tab, if the app was backgrounded for more than four hours (P2 — the morning ritual is the point).
- Android hardware back and iOS edge-swipe both unwind the same stack.
- Every route is directly linkable; a shared link to an item opens that item after sign-in.

---

## 8. Forms

Forms also include the approved Phase 7 note/skip sheets (280-character limit) and native GET filter controls. Settings brand-profile and regeneration-steer forms arrive in their owning later phases.

Rules:
- One field per row, full width, label always visible above the field (never placeholder-as-label).
- Placeholders show example *content*, not instructions.
- Helper text explains consequence, not mechanics: "Used in every piece of content we generate."
- Validation on blur, never on keystroke. Submission revalidates everything.
- Errors appear beneath the field in `danger` with an alert glyph, and the field border becomes `danger`.
- The business profile is edited on Admin → Business (S9) with an explicit **Save business profile** button, like every admin form; the save is disabled until something changes.
- Long lists (courses, do/don't items) are edited as removable chips with an "Add" affordance — not as comma-separated text.
- The regeneration steer is a single auto-growing textarea with three tappable example chips ("Make it funnier", "Focus on Flow", "Shorter caption") that insert text; typing remains optional (P2).

---

## 9. Loading, empty and error states

Specification per surface. These are requirements, not suggestions (P5).

### 9.1 Loading

| Surface | Treatment |
|---|---|
| App boot | Static brand mark on `canvas` for a maximum of 600ms, then the Today skeleton. No spinner. |
| Today | Skeleton `ProgressRing`, skeleton `TipCard`, two skeleton `ContentCard`s at true height |
| Calendar | Grid and date numerals render immediately from the local date; indicators fade in over 160ms as data arrives |
| Create | Format group headings render; three skeleton `QueueRow`s per group |
| Item detail | Meta row and section headings render from the list data already in hand; only the body blocks shimmer |
| Archive | Counts shimmer; list shows five skeleton rows |
| Regeneration | Inline on the item: content blocks dim to 40%, a progress strip animates at the top of the card, and staged labels advance — *Researching… → Writing… → Briefing…*. The action is disabled; the rest of the app stays interactive |
| Month generation | Persistent accent `Banner` with an indeterminate strip; the user may navigate freely |
| Button-level | Spinner replaces the label, width preserved |

Rules: no full-screen spinners anywhere; no layout shift when content replaces a skeleton; anything under 300ms shows no loading state at all (avoids flicker).

### 9.2 Empty

**Phases 4–7 staging:** generation is deferred to its approved later phases. Empty states explain this explicitly and link to existing Calendar/Today where useful; no generation CTA invokes an unavailable action or pretends content was generated.

Skip is disabled for unfinished ideas during this batch, with an explanation that the idea stays in Create. This avoids removing content without a working return-to-Ready path before hydration exists. Hydrated ready items retain reversible Skip.

| Surface | Glyph | Statement | Guidance | Action |
|---|---|---|---|---|
| Today — nothing planned | calendar-plus | "No content planned for today." | "Generate a plan and you'll have something to post in under a minute." | Generate today's content |
| Today — all posted | check-circle | "All done for today." | Shows month progress inline. | See tomorrow |
| Calendar — month not planned | sparkle | "This month isn't planned yet." | "We'll map out every day across your enabled platforms." | Plan this month |
| Day sheet — empty day | plus-circle | "Nothing scheduled." | — | Generate for this day |
| Create — queue empty | layers | "Nothing waiting to be designed." | "Everything planned has been posted or skipped." | See the calendar |
| Archive — nothing posted | archive | "Nothing posted yet." | "Mark your first post and it'll show up here." | Go to Today |
| Filters return nothing | filter | "No items match these filters." | — | Clear filters |
| Offline, no cache | cloud-off | "You're offline." | "This hasn't been downloaded yet." | Retry |

The "all posted" state is the only moment the product is allowed to be warm: the tick animation plays once on the progress ring and the statement sits in `display` type. One reward, not a confetti habit.

### 9.3 Error

Rules: name what failed in the user's language; state whether data changed; offer exactly one recovery action; never surface stack traces, model names, provider names or IDs.

| Surface | Treatment |
|---|---|
| Sign-in failure | Inline message under the Google button + retry |
| Access denied | Dedicated screen, `h1` statement, one line of guidance, **Sign out and use another account** |
| List load failure | `ErrorState` replacing the list; tabs remain usable |
| Item load failure | `ErrorState` in place of the body; header and back navigation stay |
| Generation failure | `danger` `Banner`: "Generation didn't complete. Nothing was changed." + **Try again** |
| Rate limited | Sheet, not a toast — it needs reading: "You've hit today's regeneration limit." with the reset time. Dismiss only |
| Mark-posted failure | Tick rolls back with a reverse animation + toast "Couldn't save that — we've put it back." + **Retry** |
| Copy unsupported | Block becomes selectable; button becomes **Select all** |
| Offline write | Toast: "You're offline. This needs a connection." |
| Unhandled | Route-level boundary: "Something went wrong on our side." + **Reload**. Nav remains functional |

### 9.4 Success feedback hierarchy
1. **Local, visible result** (tick fills, ring advances) — preferred; no toast.
2. **Inline label change** (Copy → Copied) — for actions with no visible result.
3. **Toast** — only when the result is off-screen or reversible (Undo).
4. Never all three for one action.

---

## 10. Interaction and motion

### 10.1 Motion tokens

| Token | Duration | Easing | Use |
|---|---|---|---|
| `instant` | 100ms | `linear` | Press feedback |
| `fast` | 160ms | `cubic-bezier(0.2,0,0,1)` | Fades, colour changes, chip toggles |
| `base` | 240ms | `cubic-bezier(0.2,0,0,1)` | Route transitions, tick draw, ring advance |
| `slow` | 320ms | `cubic-bezier(0.2,0,0,1)` | Sheet open, banner entry |
| `spring` | ~400ms | spring(1, 90, 14) | Tick scale overshoot, deck settle |

### 10.2 Principles
- Motion reports a state change or a spatial relationship. If it does neither, remove it.
- Nothing loops indefinitely except genuine progress indicators.
- Nothing animates on first paint except skeleton shimmer.
- Animate only `transform` and `opacity`; never width, height, top or left.
- Simultaneous related changes are choreographed together (tick fill and ring advance share one 240ms timeline).

### 10.3 Signature interactions

**Today deck**
Horizontally paged cards with a 16px peek of the next card and a 12px gap. Page dots sit beneath. Swipe is the primary gesture; the deck is also keyboard- and screen-reader-navigable as a labelled list. With only one item for the day, the deck renders as a single static card with no dots.

**Mark as posted**
Tap → `instant` press scale → tick path draws over `base` → card settles into the posted treatment → ring arc advances on the same timeline → light haptic. If it is the last unposted item of the day, the Today screen transitions to the "All done" state after a 400ms beat.

**Copy**
Press → `instant` scale on the control → label swaps to "Copied" with a tick → reverts after 1.5s. Long-press on a `CopyBlock` body triggers the same with a medium haptic. No toast.

**Regenerate**
Opens a steer sheet → on confirm the sheet dismisses and the item enters its inline loading state → on success the new content cross-fades in over `base` with a brief accent "Updated" eyebrow that fades after 2s.

**Pull to refresh**
Available on Today, Calendar, Create and Archive. Custom indicator: the `ProgressRing` geometry reused as a rotating arc. Haptic at the trigger threshold.

**Scroll behaviour**
`PageHeader` collapses its title from `h1` to `h3` between 0 and 56px of scroll. `ActionBar` hides on scroll-down beyond 24px and returns immediately on scroll-up.

### 10.4 Haptics
Light impact: tick, copy, filter toggle, pull-to-refresh trigger.
Medium impact: long-press copy, sheet snap.
Error notification: failed save.
All haptics are feature-detected, silently skipped where unsupported, and disabled entirely under `prefers-reduced-motion`.

### 10.5 Reduced motion
Under `prefers-reduced-motion: reduce`: all transforms become opacity-only cross-fades at `fast`; the tick appears without drawing; the shimmer becomes a static fill; the deck becomes a vertical stack with no paging animation; pull-to-refresh shows a static indicator. No functionality is lost.

---

## 11. Responsive behaviour

The product is a phone app that tolerates larger screens. There is no desktop-specific layout.

| Range | Behaviour |
|---|---|
| 320–359px | Base layout holds. `display` drops to 28px. Deck peek reduces to 8px. No horizontal scrolling anywhere. |
| 360–480px | Design baseline (390×844 reference). |
| 481–768px | Column fixed at 560px and centred. Page padding grows to 32px. Bottom nav pill stops expanding and centres at 480px wide. |
| 769–1023px | Identical to above; generous `canvas` margins. Hover states activate. |
| ≥1024px | Same centred column. **Optional enhancement:** Item detail may split into two columns — content left (360px), design brief right (280px) — only if both columns exceed their minimums; otherwise it stacks. No other screen splits. |

Additional rules:
- Touch targets never shrink below 44×44px at any breakpoint.
- Landscape phone: `PageHeader` collapses to 48px; the deck becomes a vertical list; the nav pill remains bottom-anchored.
- The bottom nav is retained on desktop rather than converting to a sidebar — one navigation pattern, one set of bugs, and it keeps the product honest about being a phone-first tool.
- Font sizes do not scale with viewport; only the column width and page padding respond.

---

## 12. Accessibility

Target: **WCAG 2.2 Level AA** (NFR-5).

**Colour and contrast**
- Body text ≥ 4.5:1; large text and non-text UI ≥ 3:1; verified for both themes.
- Every colour-encoded meaning carries a redundant icon, shape or label: platform (colour + glyph + text), posted (opacity + tick + status label), overdue (colour + rule + alert glyph + date emphasis).
- The product must remain fully usable in greyscale. This is a release check, not an aspiration.

**Targets and input**
- Minimum 44×44px interactive area, including calendar day cells and nav items.
- Minimum 8px between adjacent targets.
- Everything operable by keyboard in a logical DOM order; visible 2px `accent` focus ring with 2px offset, never removed.
- "Skip to content" link before the header.
- Gestures always have a non-gesture equivalent: deck swipe → page dots and arrow keys; month swipe → chevrons; sheet drag-dismiss → close button; long-press copy → explicit Copy button.

**Semantics**
- One `h1` per screen; heading levels never skip.
- Bottom nav is a navigation landmark with current-page state exposed.
- `StatusTick` is a genuine checkbox with a descriptive label, not a styled div.
- The deck is a labelled list, not an opaque carousel widget.
- Copy confirmations, generation completion and errors are announced politely; errors assertively.
- Sheets trap focus, close on Escape, and restore focus to the trigger.
- Icon-only controls always carry accessible names.
- Decorative glyphs are hidden from assistive technology.

**Content**
- Generated content is rendered as plain text, never as HTML (also NFR-2.5).
- Emoji inside generated captions are allowed; emoji are never used to convey UI meaning.
- Text respects user font-size settings; layouts must not break at 200% zoom.
- No text is embedded in images anywhere in the UI.

---

## 13. Page-level layout guidance

### S1 — Sign in (`/sign-in`)
Single-screen, vertically centred, no scroll. Wordmark (`display`), one line of positioning in `sm` `text-secondary` ("Your daily content, already written."), a single full-width `primary` **Continue with Google** button, and a `caption` line noting access is invite-only. No bottom nav, no header, no marketing copy, no illustration.

### S2 — Access denied (`/no-access`)
Same geometry as S1. Lock glyph, `h1` "This account doesn't have access yet.", one line of guidance naming who to contact, and a `secondary` **Sign out and use another account**.

### S3 — Today (`/`)
Top-to-bottom:
1. Header: date in `h1` ("Friday, 31 October"), `ProgressRing` on the right.
2. `TipCard`.
3. Section eyebrow "TODAY'S CONTENT" with an item count.
4. `ContentCard` deck with page dots.
5. `ActionBar`: **Mark as posted** for the visible card.

The densest and most-used screen. Everything above the fold on a 390×844 device: date, ring, tip and the first card's meta + hook. The user should know what to post without scrolling.

### S4 — Calendar (`/calendar`)
1. Header "Calendar" + filter icon (badged with active filter count).
2. Sticky month sub-header with chevrons.
3. `FilterBar` (platform · pillar · status), only when filters are active or opened.
4. `CalendarGrid`.
5. A compact legend row beneath the grid in `caption` — three platform dots with labels, plus pending vs. posted. The legend is permanent, not a dismissible tooltip.

Tapping a day opens `DaySheet`. Swipe left/right changes month.

### S5 — Create (`/create`)
1. Header "Create" + filter icon.
2. `SegmentedControl` for format scope (All · Carousel · Reel · Post).
3. **Overdue** group first, if any, with a `danger` eyebrow and count.
4. Format groups in fixed order, each with an eyebrow heading and count: Carousels → Reels → Posts → Stories → Memes → Polls → Shorts → Videos. Empty groups are omitted entirely.
5. `QueueRow`s, ordered by scheduled date ascending.

Optimised for scanning: a designer should see their whole workload in one screen without opening anything.

### S6 — Item detail (`/item/[id]`)
1. Back chevron + `StatusPill` in the header; overflow menu (Regenerate, Skip, Share).
2. Meta row: `PlatformBadge full` · `FormatChip` · `PillarChip` · scheduled date.
3. **Hook** in `h1`.
4. `CopyBlock` — CAPTION.
5. Format-specific body: `SlideList` (carousel), `ScriptList` (reel, short and video), frame copy (story/meme), or question + options (poll).
6. `CopyBlock` — HASHTAGS (mono).
7. CTA block — single line, `body-strong`, accent left rule.
8. `BriefSection` — the designer's section, visually separated by a `48` gap and a section eyebrow "DESIGN BRIEF".
9. `SourceList` — only when sources exist; a `danger` warning if the pillar is News and sources are absent.
10. `ActionBar`: **Copy everything** (primary) + `StatusTick` (secondary).

Section order is fixed across all formats so returning users navigate by muscle memory.

### S7 — Archive (`/archive`)
1. Header "Archive" + filter icon.
2. Month `SegmentedControl` (This month · Last month · All).
3. Summary strip: three tabular counts — total posted, by platform, pillars covered. Compact, one row, no charts in v1.
4. Reverse-chronological `QueueRow` list grouped by date, each showing posted time, actor and any note.

### S8 — Settings (`/settings`)
Grouped sections separated by `32`, each with an eyebrow heading:
1. **Brand** — superseded: the business profile moved to Admin → Business (S9), and per-platform tone to Admin → Platforms.
2. **Content** — manual **Plan this month**, last generation timestamp, and a compact run log (status + time only).
3. **App** — theme control, install hint, version.
4. **Account** — signed-in email and **Sign out** (`ghost`, `danger` text).

No destructive action outside this screen and the admin panel (S9). Sign out requires a confirmation sheet.

### S9 — Admin (`/admin`)
Admins only (members get the not-found screen). `PageHeader` with back chevron, then a single horizontally swipeable row of section links (`scrollbar-hidden` utility, no visible track) styled like selected/unselected `FilterBar` chips (`aria-current="page"` on the active one). Links never shrink or break mid-word; the active link is scrolled into view on load so it is visible even when it starts off-screen. Catalogue and user rows keep their text at least `min-w-48` wide; when the row's buttons do not fit beside it they wrap to their own line, right-aligned, instead of squeezing the name. Sections separated by `32`, each with an eyebrow heading.
1. **Overview** — two-column stat tiles (`surface-1`, `r-lg`, `h2` tabular numerals) for people (with access, active 7/30 days, signed in without access) and 30-day AI usage; then usage by person, by day and by type as compact rows. No charts. A neutral banner when AI generation is off. Empty usage uses `EmptyState`.
2. **Users** — grant form (email `Input`, Member/Admin `SegmentedControl`, AI `Checkbox`, the screen's one `primary` button), an accent banner offering to import `ALLOWED_EMAILS`, then groups: *Signed in without access*, *With access*, *Revoked*. Each row shows name, email, badges and last activity, with a `secondary` **Manage**/**Grant access** button opening a `BottomSheet`. Revoking needs an inline danger confirmation inside the sheet. Owners and the signed-in admin show a note instead of a button.
3. **Business** (`/admin/business`) — three eyebrow-headed groups. *Business*: name, industry, what the business does, audience. *What you offer*: the name for offerings (*Courses*, *Services*…), the offerings `Textarea` (one per line, labelled with that name) and optional current offers. *Guidance*: daily-tip topic, *Always* and *Never* `Textarea`s (one rule per line) and links (`Name: https://…` per line). One `primary` **Save business profile**, disabled until something changes; field errors inline. Copy states that changes apply to new generations only.
4. **Prompts** — scope `SegmentedControl` (Content · Planning · Daily tip), a `Textarea` with a character counter, the active version line, and an immutable history list with **Use this text**. Copy states that built-in rules always apply first.
5. **News** (`/admin/filters`) — a news-feed `Textarea` (one URL per line), **Save news feeds** and **Reset to defaults**. Platforms and pillars are managed on their own sections.
6. **Platforms** — a primary **Add platform** button, then the catalogue in display order: a slot-coloured glyph tile, label (· *Retired* when disabled), formats and hashtag/caption rule, up/down `icon` buttons to reorder and a `secondary` **Edit**. Add/Edit open a `BottomSheet` form: name, permanent key (create only, suggested from the name), *Use in new plans* `Checkbox`, colour-slot and glyph `Chip`s, format `Chip`s, hashtag `Checkbox` + maximum, optional caption limit, tone and AI-guidance `Textarea`s. Platforms are retired, never deleted.
7. **Pillars** — same layout as Platforms without the glyph tile: label (· *Needs news*, · *Retired*), purpose as the caption line, reorder buttons and **Edit**. The form has name, permanent key (create only), purpose `Textarea`, *Needs verified news* and *Use in new plans* `Checkbox`es and an AI-guidance `Textarea`. Pillars are retired, never deleted.
8. **Settings** — AI generation `Checkbox`, limit/planning/provider `Input`s with "Custom value · Use default" helpers. Changing the model or gateway asks for confirmation in a `BottomSheet`. The API key is never shown.

Loading uses the shape-accurate `ScreenLoading surface="Admin"` skeleton; failures use `ErrorState` inside the admin segment so navigation keeps working.

---

## 14. Design review checklist

A screen is not done until all of these pass.

- [ ] Content is rendered at 16px minimum with authored line breaks intact.
- [ ] Loading, empty and error states exist and match §9.
- [ ] No layout shift when skeletons are replaced by real content.
- [ ] Entirely usable in greyscale.
- [ ] All targets ≥ 44×44px with ≥ 8px separation.
- [ ] Keyboard reachable with a visible focus ring; sheets trap and restore focus.
- [ ] Works at 320px wide with no horizontal scroll, and at 200% zoom.
- [ ] `prefers-reduced-motion` honoured; no functionality lost.
- [ ] Exactly one `primary` button on screen.
- [ ] Only tokens used — no literal colours, sizes or spacing values.
- [ ] Radii step down when nested; no nested `r-xl`.
- [ ] Nothing is hidden behind the nav pill or action bar at the end of scroll.
- [ ] Every animation encodes a state change.
- [ ] None of the §1 anti-patterns are present.

---

**Preceded by:** `PRD.md` — product requirements.
**Followed by:** `ARCHITECTURE.md` — stack, data model, API contracts, security model, deployment.
