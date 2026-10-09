// reportStatus.js — the single rule for report statuses, shared by the sidebar's My drafts
// badge, the dashboard draft count and the Reports filter tabs so they can never disagree.
// A missing status counts as Draft (the database default); comparisons ignore case and
// surrounding whitespace.
const norm = (s) => String(s == null || s === '' ? 'Draft' : s).trim().toLowerCase();

export const isDraft = (status) => norm(status) === 'draft';

// Filter tabs are plural ("Drafts") or singular ("Final"); 'All' matches everything.
export const matchesStatusFilter = (status, filter) =>
    filter === 'All' || norm(status) === String(filter || '').trim().toLowerCase().replace(/s$/, '');
