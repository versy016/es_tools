// toolsRegistry.js — single source of truth for the dashboard tool grid.
// Registry of tools shown on the Dashboard. Active tools navigate to their route;
// "coming soon" tools are placeholders (show a toast, don't navigate).
//
// Per-tool fields:
//   id       — stable key (also used for the favourites localStorage set)
//   name     — display title
//   desc     — one-line description
//   mono     — two-letter monogram for the badge
//   route    — destination path; required for live tools (omitted for soon tools)
//   live     — true => clickable, navigates to `route`
//   soon     — true => placeholder; openTool shows a "coming soon" toast instead
//   tag      — label shown in the live status pill
//   badgeBg/badgeFg — badge background/foreground colours (live = brand, soon = muted)
export const TOOLS = [
    {
        id: 'photo-report',
        name: 'Pothole Report Generator',
        desc: 'Annotate site photos, log potholes, and export & email a branded PDF.',
        mono: 'PR',
        route: '/tools/photo-report',
        live: true,
        tag: 'Field tool',
        badgeBg: '#1B2230',
        badgeFg: '#F5A623',
    },
    {
        id: 'service-location',
        name: 'Service Location Field Report',
        desc: 'Capture job details, asset checklist and photos, then generate the report.',
        mono: 'SL',
        route: '/tools/service-location',
        live: true,
        tag: 'Field tool',
        badgeBg: '#1B2230',
        badgeFg: '#F5A623',
    },
    {
        id: 'swms',
        name: 'SWMS Generator',
        desc: 'Build a Safe Work Method Statement from a template and export a branded Word doc.',
        mono: 'SW',
        route: '/tools/swms',
        live: true,
        tag: 'Field tool',
        badgeBg: '#1B2230',
        badgeFg: '#F5A623',
    },
    {
        id: 'shared-drive-manager',
        name: 'Shared Drive Manager',
        desc: 'Create Google shared drives and manage who has access, individually or in bulk.',
        mono: 'SD',
        route: '/tools/shared-drive-manager',
        live: true,
        managerOnly: true,       // managers ONLY (top role) — not admins/surveyors
        tag: 'Manager tool',
        badgeBg: '#1B2230',
        badgeFg: '#F5A623',
    },
    // The two existing standalone apps that will move into ES Tools (keeping their own
    // look). Placeholders until the migration lands.
    {
        id: 'es-planner',
        name: 'ES Planner',
        desc: 'Jobs, calendar and Gantt scheduling for the whole team.',
        mono: 'EP',
        soon: true,
        badgeBg: '#F3EFE7',
        badgeFg: '#9CA3AF',
    },
    {
        id: 'es-action-register',
        name: 'ES Action Register',
        desc: 'Track actions, owners and follow-ups to closure.',
        mono: 'AR',
        soon: true,
        badgeBg: '#F3EFE7',
        badgeFg: '#9CA3AF',
    },
];
