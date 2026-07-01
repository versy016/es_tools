// Unit tests for the utility-legend single source of truth. Pure data/logic —
// no backend, no DOM. Guards against accidental palette/label regressions since
// these values must stay identical across the editor, the tables and the PDF.
import {
    UTILITIES,
    UTILITY_BY_KEY,
    getUtility,
    QUALITY_LEVELS,
    QUALITY_LEVEL_DEFINITIONS,
} from './legendColors';

describe('legendColors — utility palette', () => {
    test('has the 12 DBYD/AS 5488 utilities', () => {
        expect(UTILITIES).toHaveLength(12);
    });

    test('every utility has a stable key, label, code and a #RRGGBB colour', () => {
        for (const u of UTILITIES) {
            expect(u.key).toMatch(/^[a-z]+$/);
            expect(u.label).toBeTruthy();
            expect(u.code).toBeTruthy();
            expect(u.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            expect(u.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
    });

    test('keys are unique', () => {
        const keys = UTILITIES.map((u) => u.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    test('the standard DBYD colours are exactly as specified', () => {
        expect(UTILITY_BY_KEY.gas.color).toBe('#FFD500');
        expect(UTILITY_BY_KEY.water.color).toBe('#2E75B6');
        expect(UTILITY_BY_KEY.stormwater.color).toBe('#00B050');
        expect(UTILITY_BY_KEY.fire.color).toBe('#FF0000');
        expect(UTILITY_BY_KEY.electrical.color).toBe('#ED7D31');
    });

    test('UTILITY_BY_KEY indexes every utility by its key', () => {
        expect(Object.keys(UTILITY_BY_KEY)).toHaveLength(UTILITIES.length);
        expect(UTILITY_BY_KEY.water.label).toBe('Potable Water Supply');
    });
});

describe('legendColors — getUtility safe accessor', () => {
    test('returns the matching utility for a known key', () => {
        expect(getUtility('gas').code).toBe('G, GM, GS');
    });

    test('never returns undefined — falls back for unknown/empty keys', () => {
        expect(getUtility('does-not-exist')).toBe(UTILITIES[0]);
        expect(getUtility('')).toBe(UTILITIES[0]);
        expect(getUtility(undefined)).toBe(UTILITIES[0]);
        // The PDF renderer relies on .code/.color always being readable.
        expect(getUtility(null).color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
});

describe('legendColors — quality levels', () => {
    test('exposes the four AS 5488 quality levels', () => {
        expect(QUALITY_LEVELS).toEqual(['A', 'B', 'C', 'D']);
    });

    test('has a definition for each quality level', () => {
        expect(QUALITY_LEVEL_DEFINITIONS).toHaveLength(4);
        for (const d of QUALITY_LEVEL_DEFINITIONS) {
            expect(d.level).toMatch(/Quality Level [A-D]/);
            expect(d.text.length).toBeGreaterThan(20);
        }
    });
});
