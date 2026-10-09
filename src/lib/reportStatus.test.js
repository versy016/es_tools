// One rule for "is this report a draft" / "does it match a status filter", shared by the
// sidebar badge, the dashboard count and the Reports filter so they can never disagree.
import { isDraft, matchesStatusFilter } from './reportStatus';

describe('isDraft', () => {
    test.each([['Draft'], ['draft'], ['DRAFT'], [' Draft '], [null], [undefined], ['']])('%j is a draft', (s) => expect(isDraft(s)).toBe(true));
    test.each([['Final'], ['Sent'], ['Approved'], ['drafted']])('%j is not a draft', (s) => expect(isDraft(s)).toBe(false));
});

describe('matchesStatusFilter', () => {
    test('All matches everything', () => expect(matchesStatusFilter('Final', 'All')).toBe(true));
    test('Drafts matches drafts regardless of case or a missing status', () => {
        expect(matchesStatusFilter('draft', 'Drafts')).toBe(true);
        expect(matchesStatusFilter(null, 'Drafts')).toBe(true);
        expect(matchesStatusFilter('Final', 'Drafts')).toBe(false);
    });
    test('singular filters match case-insensitively', () => {
        expect(matchesStatusFilter('final', 'Final')).toBe(true);
        expect(matchesStatusFilter('Sent', 'Sent')).toBe(true);
        expect(matchesStatusFilter('Sent', 'Approved')).toBe(false);
    });
});
