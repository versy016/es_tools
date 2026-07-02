// Pure data test for the dashboard tool registry.
import { TOOLS } from './toolsRegistry';

describe('toolsRegistry', () => {
    test('exposes the dashboard tools with unique ids', () => {
        expect(TOOLS.length).toBeGreaterThanOrEqual(4);
        const ids = TOOLS.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain('shared-drive-manager');
    });

    test('live tools have a route; "coming soon" tools do not', () => {
        for (const t of TOOLS) {
            if (t.live) {
                expect(t.route).toMatch(/^\/tools\//);
                expect(t.soon).toBeFalsy();
            }
            if (t.soon) {
                expect(t.route).toBeUndefined();
                expect(t.live).toBeFalsy();
            }
        }
    });

    test('the two field tools (photo-report, service-location) are live', () => {
        const live = TOOLS.filter((t) => t.live).map((t) => t.id);
        expect(live).toEqual(expect.arrayContaining(['photo-report', 'service-location']));
    });

    test('every tool has display essentials (name, desc, mono badge)', () => {
        for (const t of TOOLS) {
            expect(t.name).toBeTruthy();
            expect(t.desc).toBeTruthy();
            expect(t.mono).toMatch(/^[A-Z]{2}$/);
        }
    });
});
