# RoleBrief — Full Product Shell Build Plan

## Context

Two attached specs (`RoleBrief_Figma_Make_Master_Prompt.md` and the Brand + Product Design
Specification `.docx`) define **RoleBrief**, a premium editorial AI career-intelligence platform
for fresh graduates and technology professionals (Pakistan, UAE, worldwide-remote). The current
project is an empty Vite + React 19 + Tailwind v4 scaffold (`src/App.tsx` renders an empty div).

The user has chosen: **a routed multi-screen app shell covering every screen area, built out
evenly** — not a single landing page. The goal is a cohesive, high-fidelity MVP that reads like a
trusted technology publication turned into a precise career workspace: editorial hierarchy,
product-led behavior, evidence-led trust in every data state.

The aesthetic is **fully pinned by the brief** (no free axes to invent): warm Editorial Paper
canvas for marketing, white task surfaces for product, indigo action accent, semantic status
colors, and the exact type system below. This aligns with the `editorial` stance from
`create_make_theme`, so there is no stance ambiguity to resolve — the work is faithful execution.

## Design system (authoritative from the spec — do not improvise)

**Fonts** (public Google Fonts → `@import` at top of `src/index.css`, in this order):
- `Newsreader` — display/editorial headlines & pull quotes only (never controls or job body).
- `Inter` — all product UI, nav, forms, job content, cards.
- `IBM Plex Mono` — timestamps, salary ranges, source/provider metadata, rare data labels only.
Sentence case throughout; uppercase only for short kickers/metadata labels.

**Type scale** (Tailwind utilities / CSS vars): Display XL 64/68 (mobile 42/46), Display L 48/54,
Page title 32/40 (Inter 650), Section 24/32, Card title 18/25, Body L 18/29, Body 16/24,
Label 14/20 (600), Metadata 13/18 (450, mono where data).

**Colors** (CSS variables in `src/index.css` `@theme`, semantic names, never raw hex in JSX):
ink `#151A23`, navy `#172554`, paper `#F7F4EE`, surface `#FFFFFF`, indigo `#4F46E5`,
cyan `#0E7490`, emerald `#047857`, amber `#B45309`, red `#B91C1C`, slate `#667085`,
line `#D8DEE8`, soft `#F5F7FB`. Rules: indigo = action/selection (never success); red never = low
match; **status always icon + text + color**, never color alone; paper for editorial regions, white
for task surfaces (do not make the whole app beige).

**Spacing/shape**: 4px base (8/12/16/20/24/32/40/48/64/80/96); radius control 10px, card 16px,
feature 24px; hairline 1px rules; shadow only for menus/sheets/overlays. Control height 44px,
mobile prominent 48–52px, touch target ≥44px. Grid: 12-col desktop (1248 max, 96 margin),
tablet 8-col, mobile 4-col.

**Card containment rule**: a card is justified only when an item is independently actionable/
selectable. Prefer section rules, background shifts, whitespace over nested cards.

## Architecture

Adapt the react-router Data-mode pattern to this scaffold's documented entrypoint (`src/App.tsx`
stays the entry per AGENTS.md; do not create a parallel root):

- Install deps: `pnpm add react-router lucide-react recharts` (recharts is required by
  CompanyMomentum).
- `src/App.tsx` → `<RouterProvider router={router} />`.
- `src/app/routes.tsx` → `createBrowserRouter` with two layout branches:
  - **Marketing layout** (paper canvas, editorial nav/footer): `/`, auth routes.
  - **App shell layout** (white surfaces, desktop top nav + mobile bottom nav, command/search,
    notifications, avatar): all product routes. Render `<ScrollRestoration />` inside the app-shell
    layout element so navigation scroll behaves correctly.
- **Route-level lazy loading** for every screen so the shell isn't one oversized bundle:
  `{ path: "jobs", lazy: () => import("../screens/jobs/JobsScreen") }` (each screen module exports
  a `Component`). Keep layout wrappers eager; lazy the leaf screens.
- Jobs search/filter state stays encoded in `useSearchParams` (source of truth for filters, sort,
  density, pagination); preserve scroll/filter state on back navigation.

### Prototype scope (fixture-driven frontend only)
This build is a **fixture-driven frontend prototype**. Do NOT invent backend endpoints,
authentication persistence, real résumé parsing/processing, or live API/provider integrations.
Simulate every such interaction with realistic local React state + fixtures (e.g. fake async with
timeouts for loading/refresh states, in-memory save/follow/track/dismiss toggles, mock résumé
"extraction" returning editable fields). Keep component/data interfaces clean so a real backend can
be dropped in later.

### Routes (all created; built out evenly to a consistent, solid fidelity)
`/` landing · `/login` `/signup` `/forgot-password` `/reset-password` `/verify-email` (auth
states, editorial brand, no marketing panel on mobile) · `/onboarding` (Goal→Reach→Fit→Review,
autosave/skip/résumé-optional) · `/radar` · `/jobs` · `/jobs/:slug` · `/news` (Market Pulse) ·
`/news/:slug` · `/companies/:slug` · `/saved` · `/alerts` (+ Alert Builder) · `/tracker` ·
`/profile` · `/settings` · `/admin` `/admin/sources` `/admin/moderation` · `*` not-found.

## Component system

`src/components/ui/` primitives (bespoke, token-bound — no external UI kit in this scaffold):
Button (primary/secondary/tertiary/destructive + states), IconButton, Input, Textarea, Select,
Checkbox, Radio, Switch, Tabs, SegmentedControl, Badge, FilterChip (default/active/excluded),
Tooltip, Menu, Dialog, Sheet, Toast, Pagination, Skeleton (content-shaped), EmptyState/ErrorPanel,
CompanyLogo (fallback initials), SourceBadge.

`src/components/rolebrief/` **signature** components (consistent positions across Radar/Jobs/Saved/
Detail):
- **EligibilityShield** — shield icon + explicit label (Eligible/Check required/Conflict/Unknown)
  + evidence trigger; compact + detail. Never claims guaranteed qualification.
- **MatchBrief** — numeric summary + dimension bars (required/preferred skills, experience, role,
  location, education, freshness) + matching evidence / missing / ambiguous / suggestions. Never an
  unexplained percentage. Textual equivalent for the bars.
- **FreshnessTimeline** — published/discovered/verified/updated/rechecked/expired; compact stamp +
  expanded 4-event timeline.
- **CompanyMomentum** — quiet sparkline/columns + written interpretation; labels evidence vs
  inference; declares period/coverage/incomplete data (use `recharts`).
- **JobCard** (radar/compact/comfortable/preview/saved/expired) and **NewsCard** (feature/standard/
  compact/no-image/caution) — news visually distinct from jobs (cyan editorial rhythm), 80:20 mix.
- **JobMetaRow**, **ReasonChips** ("Why this?"), **ScoreDimension**.

## Content

`src/lib/fixtures.ts` — realistic fixtures (no lorem): jobs (full-stack/frontend/backend/mobile/
DevOps/QA/UI-UX/data/AI-ML) across Karachi/Lahore/Islamabad, Dubai/Abu Dhabi, worldwide-remote;
include an 80-char title, multi-location role, employer-provided / no-salary / ambiguous-salary
cases, and worldwide / country-limited / ambiguous / unknown remote eligibility. Career news items
(hiring, funding, layoffs, offices, remote-policy, visa) with publisher/date/labeled AI summary.
Companies with momentum signals. Tracker rows, saved items, alerts. Copy follows the brand voice:
lead with information, state uncertainty plainly, label generated/inferred/unknown data.

## Key screen notes
- **Landing**: editorial hero H1 "The right opportunity shouldn't arrive late.", CTAs "Build my
  opportunity brief" / "Explore fresh jobs", believable live opportunity preview above the fold,
  sections for the 5 signature systems, jobs+news story, regional coverage, source/freshness trust,
  workflow, alert value, FAQ, final CTA, premium footer. No fabricated logos/testimonials/stats.
- **Radar**: briefing greeting, new-match summary, followed-company changes, deadlines, preference
  lens, 80:20 job/news stream, company signals, "Worth exploring"; states: new user, incomplete
  profile, personalized, refreshing, partial outage, no strong matches, all caught up.
- **Jobs**: sticky search + quick filters, left filter rail (full filter set from spec), results,
  optional preview rail; URL-synced filters, active/excluded chips, clear-per-group/all, result
  count, save search, zero-results recovery, compact/comfortable density, sort, pagination.
- **Job detail**: reading column + sticky decision rail (desktop) / anchored sections + safe-area
  apply bar (mobile); Shield + MatchBrief + structured description + FreshnessTimeline + source
  disclosure + related news + similar jobs; external "Apply on company site" shows destination
  domain; variants eligible/check/conflict/unknown/expired/suspicious/missing-data.
- Market Pulse, News detail (sourced facts vs interpretation), Company, Saved (3 segments), Alerts
  (Builder: NL → editable chips → 3-match preview → volume → cadence → delivery), Tracker (list +
  optional board toggle + mobile grouped list), Profile, Settings (marketing consent separate from
  alerts, reduced-motion control), Admin (provider health, queues, moderation) — built per spec.

## Accessibility & motion floor
WCAG 2.2 AA: visible 2px focus ring, logical order, persistent labels, error summaries,
≥44px targets, 200%/320px reflow. Status = icon+text+color. Skeletons match final geometry.
Motion tokens: 120–160ms hover/press, 180–220ms chips/save/follow, 260–320ms sheets; honor
`prefers-reduced-motion` (opacity/instant swap). Never animate scores for entertainment; don't
shift the item being read.

## Files to create/modify
- Modify: `src/index.css` (font `@import`s first, `@theme` tokens, base styles, reduced-motion),
  `src/App.tsx` (RouterProvider).
- Create: `src/app/routes.tsx`; `src/components/ui/*`; `src/components/rolebrief/*`;
  `src/components/shell/{AppShell,MarketingLayout,TopNav,BottomNav,Footer}.tsx`;
  `src/screens/**/*` (one folder/file per route area); `src/lib/fixtures.ts`; `src/lib/format.ts`.

## Verification
- `pnpm build` (or the project's build script) to typecheck + bundle; confirm per-route lazy
  chunks are emitted (no single oversized bundle); fix any errors.
- Load the preview on `$PORT`; click through the shell: landing → signup → onboarding → Radar →
  job detail → apply flow → tracker; Jobs filters update the URL and survive back navigation;
  bottom nav active state on mobile widths (390/360). Spot-check reduced-motion and keyboard focus.
- Confirm no unlayered global CSS reset was introduced and Tailwind v4 `@theme` tokens resolve.
