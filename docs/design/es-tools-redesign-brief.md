# Design brief: ES Tools redesign — 5 prototypes

Design five distinct, high-fidelity UI prototypes for **ES Tools**, the internal web app of
Engineering Surveys (a surveying and engineering firm in Adelaide, South Australia). Each
prototype must show the same three screens so they can be compared like for like. Pick a
clearly different visual direction for each one.

## What ES Tools is

A browser app used by field surveyors, office admins and managers. It is the single front
door to the company's internal tools. Today it hosts four live tools and will soon absorb
two existing apps, ES Planner and ES Action Register, which keep their own look inside it.
It is used on laptops in the office and on tablets and phones on site, often in bright
daylight with gloves on, so touch targets and contrast matter.

Users sign in with company accounts. Roles: Surveyor (field staff), Admin, Manager.
Managers see extra tools and a Users page.

## Brand

- Company: Engineering Surveys. Logo is a black total-station mark with amber.
- Brand colours today: amber `#F5A623`, navy ink `#1B2230`, warm paper `#F3EFE7`.
  You may keep these, mute them, or propose a new palette, but the amber must survive as
  at least an accent so the app still reads as Engineering Surveys.
- Typeface today: Plus Jakarta Sans. You may change it.
- Tone: professional, engineering, trustworthy, calm. Not playful, not startup-glossy.
  Think the quality of a good bank app or a modern council portal, not a marketing site.

## Screens to design (all five prototypes, all three screens)

### 1. Dashboard (home)
- Greeting with the user's first name and today's date.
- Global search field (searches tools, jobs and reports).
- Tool launcher: six tools as tiles or rows. Each has a two-letter monogram, a name, a
  one-line description, and a status pill ("Live", "Manager only", or "Coming soon").
  The six tools:
  1. Pothole Report Generator — capture photos, annotate, export a branded PDF. Live.
  2. Service Location Field Report — record located services on site, export PDF. Live.
  3. SWMS Generator — build Safe Work Method Statements from templates. Live.
  4. Shared Drive Manager — manage Google shared drive access and run audits. Manager only.
  5. ES Planner — jobs, calendar and Gantt scheduling. Coming soon.
  6. ES Action Register — track actions and follow-ups. Coming soon.
- A favourites mechanism (star a tool to pin it first).
- Recent reports list: up to four rows, each with title, meta line (date, job number) and a
  status pill (Draft / Sent / Final).
- Do NOT include a "continue where you left off" hero card. That is being removed.

### 2. Reports
- A filterable, searchable table or list of generated reports: title, tool, job, client,
  date, status, actions (open PDF, resend email, delete draft).
- Filters by tool and status. Empty state for no results.

### 3. One tool screen: Service Location Field Report
- A multi-section form: Job details (job number, client, site address, date), Services
  located (repeating rows with service type, depth, method, notes), Photos (grid of
  thumbnails with add/annotate), Sign-off (surveyor name and drawn signature).
- A sticky action bar: Save draft, Generate PDF, Send email.
- Must work at phone width with large touch targets.

## Shared shell (same on every screen)
- Top-level navigation: Dashboard, Reports, Users (managers only), plus the user's name,
  role and a sign-out control. Navigation may be a top bar or a left sidebar; show which
  you chose and why in a one-line note.
- Toast notifications (bottom centre) and a blocking "working" overlay for long tasks.

## The five directions
Make each prototype a genuinely different identity, not a recolour. Suggested, but you may
replace any of them:
1. Precision: light, high-contrast, grid-disciplined, engineering-drawing feel (thin rules,
   monospace numerals, exact alignment).
2. Field-first: large tap targets, bold type, high contrast for sunlight, minimal chrome.
3. Quiet enterprise: neutral greys, restrained amber, dense data tables, sidebar nav.
4. Warm paper: keeps the current warm palette but modernises spacing, cards and type.
5. Your own proposal: whatever you think suits a surveying firm best.

## Deliverables per prototype
- The three screens at desktop width (1440) and the dashboard and tool screen at phone
  width (390).
- A one-page token sheet: colour palette with hex values, type scale, spacing scale, corner
  radius, shadow/elevation rules, button and pill styles, status colours (Live, Coming soon,
  Draft, Sent, Final, Warning, Critical).
- Component states: button default/hover/disabled, input default/focus/error, tile
  default/hover/favourited, table row hover/selected.
- A short rationale (3 to 5 sentences) explaining the direction and who it suits.

## Constraints to respect
- Must be implementable in plain React with CSS variables. No design that depends on heavy
  motion or 3D.
- WCAG AA contrast for all text. Touch targets at least 44 px on the phone layouts.
- ES Planner and ES Action Register will live inside this shell with their own existing
  styling, so the shell must not fight with a white, Tailwind-style content area.
- Keep the Engineering Surveys logo mark; do not redraw it.
- Avoid: generic purple-gradient SaaS look, heavy drop shadows everywhere, decorative
  illustrations, low-contrast grey-on-grey text.
