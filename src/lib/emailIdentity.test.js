// Unit tests for the email-alias identity rule. Pure logic — no backend, no DOM. This is
// the single source of truth for "are these two addresses the same person", so aliases
// (shivam.verma@ ↔ sverma@) must never yield two accounts.
import {
    ORG_DOMAIN,
    normalizeEmail,
    canonicalEmail,
    sameIdentity,
    isOrgEmail,
    findIdentityMatch,
} from './emailIdentity';

describe('normalizeEmail', () => {
    test('trims and lower-cases', () => {
        expect(normalizeEmail('  Shivam.Verma@EngSurveys.com.au ')).toBe('shivam.verma@engsurveys.com.au');
    });
    test('falsy input → empty string', () => {
        expect(normalizeEmail(undefined)).toBe('');
        expect(normalizeEmail(null)).toBe('');
    });
});

describe('canonicalEmail', () => {
    test('firstname.lastname collapses to finitiallastname', () => {
        expect(canonicalEmail('shivam.verma@engsurveys.com.au')).toBe('sverma@engsurveys.com.au');
        expect(canonicalEmail('john.smith@engsurveys.com.au')).toBe('jsmith@engsurveys.com.au');
    });
    test('already-primary form is unchanged', () => {
        expect(canonicalEmail('sverma@engsurveys.com.au')).toBe('sverma@engsurveys.com.au');
    });
    test('middle names reduce to first-initial + last-name', () => {
        expect(canonicalEmail('shivam.kumar.verma@engsurveys.com.au')).toBe('sverma@engsurveys.com.au');
    });
    test('strips +tags', () => {
        expect(canonicalEmail('sverma+reports@engsurveys.com.au')).toBe('sverma@engsurveys.com.au');
    });
    test('preserves the domain (identity never crosses domains)', () => {
        expect(canonicalEmail('john.smith@example.com')).toBe('jsmith@example.com');
    });
    test('malformed input is returned normalised', () => {
        expect(canonicalEmail('not-an-email')).toBe('not-an-email');
    });
});

describe('sameIdentity', () => {
    test('primary and alias are the same person', () => {
        expect(sameIdentity('sverma@engsurveys.com.au', 'shivam.verma@engsurveys.com.au')).toBe(true);
        expect(sameIdentity('shivam.verma@engsurveys.com.au', 'sverma@engsurveys.com.au')).toBe(true);
    });
    test('case and whitespace do not matter', () => {
        expect(sameIdentity('SVERMA@engsurveys.com.au', '  sverma@engsurveys.com.au ')).toBe(true);
    });
    test('different people are not matched', () => {
        expect(sameIdentity('sverma@engsurveys.com.au', 'bgosling@engsurveys.com.au')).toBe(false);
        expect(sameIdentity('john.smith@engsurveys.com.au', 'bob.jones@engsurveys.com.au')).toBe(false);
    });
    test('KNOWN LIMITATION: distinct people who share first-initial + surname collide', () => {
        // john.smith and jane.smith both reduce to jsmith — an inherent ambiguity of the
        // finitiallastname alias scheme. Workspace avoids it by issuing distinct primaries;
        // if it ever surfaces, an admin resolves the duplicate manually. Documented, not a bug.
        expect(sameIdentity('john.smith@engsurveys.com.au', 'jane.smith@engsurveys.com.au')).toBe(true);
    });
    test('same local part on different domains is not a match', () => {
        expect(sameIdentity('sverma@engsurveys.com.au', 'sverma@gmail.com')).toBe(false);
    });
    test('empty inputs are never a match', () => {
        expect(sameIdentity('', 'sverma@engsurveys.com.au')).toBe(false);
        expect(sameIdentity('sverma@engsurveys.com.au', '')).toBe(false);
    });
});

describe('isOrgEmail', () => {
    test('recognises the org domain', () => {
        expect(isOrgEmail('sverma@engsurveys.com.au')).toBe(true);
        expect(ORG_DOMAIN).toBe('engsurveys.com.au');
    });
    test('rejects other domains', () => {
        expect(isOrgEmail('someone@gmail.com')).toBe(false);
    });
});

describe('findIdentityMatch', () => {
    const dir = [
        { id: 1, email: 'sverma@engsurveys.com.au' },
        { id: 2, email: 'bgosling@engsurveys.com.au' },
    ];
    test('finds an existing person by an alias', () => {
        expect(findIdentityMatch('shivam.verma@engsurveys.com.au', dir)).toEqual({ id: 1, email: 'sverma@engsurveys.com.au' });
    });
    test('returns null when nobody matches', () => {
        expect(findIdentityMatch('new.person@engsurveys.com.au', dir)).toBeNull();
    });
});
