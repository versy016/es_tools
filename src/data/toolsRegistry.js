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
        name: 'Photo & pothole report',
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
        id: 'site-survey',
        name: 'Site survey',
        desc: 'Record site measurements and produce a survey summary.',
        mono: 'SS',
        soon: true,
        badgeBg: '#F3EFE7',
        badgeFg: '#9CA3AF',
    },
    {
        id: 'as-built',
        name: 'As-built',
        desc: 'Compile as-built documentation from captured field data.',
        mono: 'AB',
        soon: true,
        badgeBg: '#F3EFE7',
        badgeFg: '#9CA3AF',
    },
];
