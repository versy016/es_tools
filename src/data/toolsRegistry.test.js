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

    test('ES Planner and ES Action Register are the coming-soon placeholders (site-survey / as-built are gone)', () => {
        const ids = TOOLS.map((t) => t.id);
        expect(ids).toEqual(expect.arrayContaining(['es-planner', 'es-action-register']));
        expect(ids).not.toContain('site-survey');
        expect(ids).not.toContain('as-built');
        const planner = TOOLS.find((t) => t.id === 'es-planner');
        const register = TOOLS.find((t) => t.id === 'es-action-register');
        expect(planner).toMatchObject({ name: 'ES Planner', soon: true, mono: 'EP' });
        expect(register).toMatchObject({ name: 'ES Action Register', soon: true, mono: 'AR' });
    });

    test('every tool has display essentials (name, desc, mono badge)', () => {
        for (const t of TOOLS) {
            expect(t.name).toBeTruthy();
            expect(t.desc).toBeTruthy();
            expect(t.mono).toMatch(/^[A-Z]{2}$/);
        }
    });
});
