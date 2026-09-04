# RoleBrief — Figma Make Master Prompt

## How to use this prompt

Attach these two documents before running the prompt:

1. `Career_Intelligence_UIUX_Product_Specification.docx`
2. `RoleBrief_Brand_and_Figma_Design_Specification.docx`

Then paste everything below into Figma Make.

---

Create a complete, high-fidelity, responsive web application UI/UX for **RoleBrief**, an AI-powered career intelligence platform. RoleBrief helps fresh graduates and technology professionals discover fresh jobs, understand whether they are eligible, see why an opportunity matches them, follow company hiring activity, read career-relevant news, receive smart alerts, and track applications.

Treat the two attached RoleBrief specification documents as the authoritative product and visual source of truth. This prompt defines the implementation task and required output. If a detail conflicts, prioritize: (1) explicit product behavior and accessibility requirements, (2) the Brand and Figma Design Specification, (3) this prompt, and then (4) your own design judgment. Do not omit a required screen or signature feature merely to simplify the output.

## Product positioning

Brand: **RoleBrief**  
Tagline: **Your daily brief for better opportunities.**  
Primary message: **The right opportunity shouldn’t arrive late.**  
Supporting message: **Discover fresh technology roles, understand your eligibility, and follow the companies shaping your next move.**

The initial audience is fresh graduates and junior-to-mid-level technology professionals seeking jobs in Pakistan, the UAE, and worldwide-remote markets. Initial disciplines include full-stack, frontend, backend, mobile, DevOps/cloud, QA/testing, UI/UX, data, and AI/ML.

## Experience direction

Create a premium editorial career experience, not a generic SaaS dashboard or ordinary job board. It should feel like a trusted technology/business publication transformed into a precise, useful career workspace.

The interface must be:

- Light-first, premium, editorial, intelligent, calm, and highly polished.
- Distinctive without sacrificing usability.
- Spacious on decision and reading pages, but efficient on job-search pages.
- Responsive across 1440 px desktop, 1280 px laptop, 834 px tablet, 390 px mobile, and 360 px mobile.
- Accessible to WCAG 2.2 AA standards.
- Built from reusable components, variables, responsive auto layout, and realistic content.

Avoid generic dashboard templates, excessive rounded cards, nested card-on-card layouts, neon AI gradients, glassmorphism, cartoon illustrations, 3D blobs, rockets, trophies, AI brains, fake analytics, and decorative animation. Use whitespace, fine rules, typography, background shifts, and selective imagery to produce hierarchy. A card is appropriate only for an independently actionable or selectable item.

## Brand and visual system

Use a wordmark-led RoleBrief identity. Explore a restrained monogram combining **RB**, an editorial briefing page/fold, and a subtle forward opportunity signal. Do not use a résumé page, magnifying glass, briefcase, robot, or AI sparkle as the primary logo idea. Create horizontal wordmark, stacked lockup, monogram, favicon, one-color, and reversed variants.

Typography:

- **Newsreader** for major editorial/marketing headlines and selected feature introductions.
- **Inter** for navigation, controls, job content, forms, cards, and product UI.
- **IBM Plex Mono** only for timestamps, salary ranges, provider/source metadata, and rare data labels.
- Use sentence case. Use uppercase only for short kickers and compact metadata labels.
- Never use serif type for job descriptions, controls, form fields, or dense product content.

Core colors and Figma variables:

- Ink `#151A23`: primary text and dark surfaces.
- Deep Navy `#172554`: brand anchor and display emphasis.
- Editorial Paper `#F7F4EE`: marketing/editorial canvas.
- Surface `#FFFFFF`: interactive and task-focused surfaces.
- Signal Indigo `#4F46E5`: primary actions, selection, and matching.
- Insight Cyan `#0E7490`: career news and intelligence.
- Eligible Emerald `#047857`: verified positive eligibility.
- Review Amber `#B45309`: check-required states.
- Conflict Red `#B91C1C`: eligibility conflicts, errors, and destructive actions.
- Slate `#667085`: secondary text.
- Line `#D8DEE8`: dividers and boundaries.
- Soft `#F5F7FB`: secondary panels and alternating rows.

Indigo means action or selection, never success. Red must not represent a low match score. Status cannot depend on color alone; always include an icon and text label. Use Paper primarily for editorial/marketing regions and white for task surfaces. Do not make the entire application beige.

Use a 4 px spacing foundation with primary values 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, and 96 px. Controls use approximately 10 px radius, interactive cards 16 px, and rare feature panels 24 px. Default control height is 44 px; prominent mobile actions are 48–52 px. Minimum touch target is 44×44 px. Use restrained shadows only for menus, sheets, overlays, and raised previews.

## Signature RoleBrief experiences

These five experiences must be visually distinctive, consistent, and fully designed:

1. **RoleBrief Radar** — a personalized ranked stream combining jobs, hiring news, and followed-company activity. Maintain an approximately 80:20 jobs-to-news balance. Every recommendation displays concise “Why this?” reason chips and offers dismiss/refinement controls.

2. **Eligibility Shield** — clearly indicates **Eligible**, **Check required**, **Conflict**, or **Unknown** based on location restrictions, remote eligibility, experience, work authorization, and available job data. It must show evidence and uncertainty. Never claim guaranteed qualification.

3. **Match Brief** — an explainable compatibility view covering required skills, preferred skills, experience, role similarity, location, education, and freshness. Show matching evidence, missing requirements, ambiguous information, and improvement suggestions. Never show an unexplained percentage.

4. **Freshness Timeline** — shows when a role was published, discovered, last verified, updated, rechecked, or marked expired. Design compact and expanded versions.

5. **Company Momentum** — connects active jobs with source-linked hiring, expansion, funding, remote-policy, office-opening, and layoff news. Clearly label signals as evidence or inference; never present them as guaranteed future hiring.

Keep Match Brief, Eligibility Shield, and Freshness Timeline in consistent positions across Radar, Jobs, Saved, and Job Detail screens.

## Global application shell

Desktop navigation: RoleBrief wordmark; Radar; Jobs; Market Pulse; Tracker; Saved; search/command access; notifications; profile. Use a centered 1200–1280 px content region with contextual rails where valuable.

Mobile navigation: compact branded top bar and a five-item bottom navigation for Radar, Jobs, Pulse, Tracker, and Saved. Make the active item unmistakable. Secondary profile/settings access can live behind the top-right avatar. Use safe-area-aware sticky actions.

Preserve search/filter state and scroll position when users return from a detail page. Reflect search filters in the URL. Use skeletons that match final content geometry rather than spinner-only pages.

## Required screens and flows

Create polished desktop and mobile designs for every screen below. Use realistic product copy and job/news data, not lorem ipsum.

### 1. Marketing landing page `/`

Build an editorial hero using the headline **“The right opportunity shouldn’t arrive late.”** Add supporting copy and the primary CTA **“Build my opportunity brief”** plus secondary CTA **“Explore fresh jobs.”** Show a believable live opportunity preview above the fold. Include sections explaining RoleBrief Radar, Eligibility Shield, Match Brief, Freshness Timeline, and Company Momentum; a jobs-plus-hiring-news story; regional coverage for Pakistan, UAE, and worldwide remote; source/freshness trust; candidate workflow; alert value; FAQ; final CTA; and premium footer. Avoid fabricated client logos, testimonials, ratings, or unsupported statistics.

### 2. Authentication

Design sign-up, login, forgot-password, reset-password, email-verification, and Google authentication states. Keep authentication visually connected to the editorial brand without adding distracting marketing panels on mobile.

### 3. Onboarding `/onboarding`

Create a four-part flow: Goal, Reach, Fit, Review. Capture target roles, seniority, employment type, skills, country/cities, remote scope, relocation, visa needs, and optional résumé upload. Show meaningful progress labels, autosave, skip paths, upload/processing/error states, editable extracted data, and confidence indicators for inferred fields. A résumé must remain optional. Finish by transitioning to a populated Radar and offering to create the first alert.

### 4. RoleBrief Radar `/radar`

Include a personalized greeting/briefing, new-match summary, followed-company changes, saved-job deadlines, inline preference lens, top opportunities, company signals, focused news, and a small “Worth exploring” area. Job cards must show title, company, location, working model, seniority, employment type, salary when employer-provided, freshness, source, Match Brief summary, Eligibility Shield, reason chips, Save, View, Dismiss, Hide company, and Report controls. Clearly distinguish news cards from job cards.

Design Radar states for new user, incomplete profile, fully personalized user, refreshing, partial provider outage, no strong matches, and all caught up.

### 5. Job discovery `/jobs`

Desktop: sticky search and quick filters; left filter rail; central results; optional right-side quick preview. Mobile: sticky search, active-filter chips, Sort and Filter actions, full-height filter sheet, one-column cards, and restored scroll position.

Filters: keyword/title, skills, country/city, worldwide remote, country-eligible remote, region-limited remote, unknown remote eligibility, on-site, hybrid, experience level, employment type, employer-provided salary, freshness, company, source, and Eligibility Shield state. Include active/excluded chip states, clear-per-group, clear-all, result count preview, save search, zero-results recovery, compact/comfortable density, newest/best-match sorting, loading, error, and pagination/infinite-loading behavior.

### 6. Job detail `/jobs/:slug`

Create a readable evidence-led page with title, company, location, work mode, salary, seniority, employment type, source, publication/verification times, Save, Track, Report, and a clear external **“Apply on company site”** CTA displaying the destination domain. Include an Eligibility Shield summary, Match Brief, full description organized into overview/responsibilities/required/preferred/benefits/work authorization, Freshness Timeline, source disclosure, related company news, and similar eligible jobs. Desktop uses a restrained sticky decision rail; mobile uses anchored sections and a safe-area bottom apply bar.

Design eligible, check-required, conflict, unknown, expired, suspicious-link, and missing-data variations.

### 7. Market Pulse `/news`

Create an editorial career-news experience limited to company hiring, expansion, funding, new offices, layoffs, remote-work policy, visa/employment policy, graduate programs, and technology labor trends. Use a lead story, signal-category navigation, latest feed, followed-company updates, region filters, and related open jobs. Every card shows publisher, date, category, short labeled AI-generated summary, companies/locations affected, hiring-impact label with rationale, source link, follow-company action, and related roles. Do not reproduce full copyrighted articles.

### 8. News detail `/news/:slug`

Show headline, source, author/date if available, generated summary label, key facts, affected roles/locations, hiring-impact rationale, related company, related active jobs, and direct source link. Separate sourced facts from RoleBrief’s interpretation.

### 9. Company intelligence `/companies/:slug`

Show company identity, website, sector, size band, locations, follow state, active jobs, job categories, location distribution, Company Momentum, a source-linked signal timeline, relevant news, and candidate-specific eligible/matching-role count. Include insufficient-data and conflicting-news states. Do not invent employee ratings or private company metrics.

### 10. Saved hub `/saved`

Provide Jobs, Searches, and Companies segments. Saved jobs show freshness/status changes and recommended next actions. Saved searches show criteria, frequency, expected volume, last match, pause/refine/delete. Followed companies show current openings and latest signal. Include selection mode and bulk actions only after explicit selection.

### 11. Smart Alerts `/alerts`

Create an alert list and a guided Alert Builder. Users may start with natural language or current search criteria. Parse the request into editable structured chips, preview three representative matches, show expected alert volume, choose Instant/Daily/Weekly, configure in-app/email and quiet hours, then confirm. Include edit, pause, resume, duplicate, delete, no-match, too-noisy, and delivery-error states.

### 12. Application tracker `/tracker`

Default to a clean list/table and timeline rather than forcing a Kanban board. Statuses: Saved, Applied, Interview, Offer, Rejected, Withdrawn. Show company, role, date, source, submitted résumé version, next action, reminder, interview details, contacts, private notes, and status history. Design desktop list plus optional board toggle, and a mobile grouped status list. Include add-manually, update-status, schedule-reminder, empty, archived, and expired-source states.

### 13. Candidate profile `/profile`

Show preferred roles, skills, experience, education, location, remote scope, work authorization, relocation, salary preference, résumé management, extracted-data review, and profile completeness based only on fields that materially improve matching. Include edit, validation, résumé replacement, reprocessing, download, and deletion confirmation states. Profiles remain private in the MVP.

### 14. Settings `/settings`

Include account, notifications, quiet hours, email frequency, privacy, data export, résumé/data deletion, hidden companies, blocked sources, accessibility preferences, and reduced-motion controls. Marketing consent must be separate from job alerts.

### 15. Admin `/admin`, `/admin/sources`, `/admin/moderation`

Design an operational, desktop-first admin workspace showing provider health, last sync, job/news ingestion counts, failed records, duplicate review, expiration checks, source enable/disable, user reports, suspicious jobs, moderation actions, and audit context. Avoid decorative vanity analytics. Create appropriate loading, partial failure, empty, warning, and confirmation states.

## Component system

Build reusable Figma components and meaningful variants for buttons, icon buttons, navigation, bottom navigation, breadcrumbs, inputs, textarea, select, combobox, autocomplete, checkbox, radio, switch, tabs, segmented controls, badges, filter chips, tooltips, menus, dialogs, sheets, drawers, toast, pagination, skeletons, empty/error panels, company logo fallback, source badge, job metadata row, job cards, news cards, Eligibility Shield, Match Brief, score dimensions, Freshness Timeline, Company Momentum, Alert Builder, tracker status, and admin tables.

Use auto layout throughout. Avoid fixed component heights when content may wrap. Include long-title, missing-logo, missing-salary, multi-location, 30–50% text expansion, keyboard focus, loading, disabled, error, partial-data, and mobile test instances. Build components using primitive, semantic, and component variables—not raw, disconnected values.

## Figma organization

Organize the file into these pages:

- `00_Cover + Index`
- `01_Brand`
- `02_Foundations`
- `03_Variables`
- `04_Components`
- `05_Marketing`
- `06_Product_Desktop`
- `07_Product_Mobile`
- `08_Prototype`
- `09_Content + States`
- `10_Handoff`
- `99_Archive`

Use frame naming: `Area / Screen / State / Breakpoint / v1`. Mark work as Exploring, Review, Approved, or Deprecated. Keep explorations separate from approved screens. Add local indexes and concise annotations.

## Prototype requirements

Create connected prototypes for:

1. Landing → Sign up → Onboarding → first personalized Radar.
2. Radar recommendation → Job detail → Match Brief → Apply externally → mark Applied.
3. Jobs → filters → Save search → Smart Alert confirmation.
4. Market Pulse → Company Momentum → active job → Follow company.
5. Saved job expired → explanation → similar eligible job.

Use 120–220 ms micro-interactions and 260–320 ms sheets/drawers. Motion should communicate causality and freshness. Do not animate scores for entertainment or reorder content while it is being read. Include reduced-motion behavior.

## Accessibility and trust requirements

Target WCAG 2.2 AA. Use visible 2 px focus indicators, logical focus order, persistent form labels, error summaries, semantic annotations, 44×44 px touch targets, 200% zoom and 320 CSS px reflow behavior. Announce asynchronous search, save, filter, and error changes. Charts and scores require textual equivalents.

Never use misleading “perfect match,” “guaranteed eligible,” fake scarcity, fabricated deadlines, hidden sponsored ranking, or salary estimates presented as employer-provided. Clearly label generated summaries, inferred data, unknown data, external destinations, providers, publication time, discovery time, verification time, and expired status.

## Final quality bar

Do not produce only a landing page or a collection of disconnected dashboards. Produce a cohesive, responsive, high-fidelity MVP design system and complete application experience. Every core screen must have desktop and mobile compositions plus realistic loading, empty, error, partial, and success states. The visual result should feel original and premium while remaining implementable.

The final RoleBrief experience should feel like a premium technology publication that has become an exceptionally useful career workspace: editorial in hierarchy, product-led in behavior, fast in discovery, and trustworthy in every data state.
