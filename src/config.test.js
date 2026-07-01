// Unit tests for the env-driven config. Verifies the archive-email default and
// that env overrides are honoured. Uses jest.isolateModules so each case re-reads
// process.env at import time (the module captures env values on load).

describe('config', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });

    afterAll(() => { process.env = OLD_ENV; });

    test('REPORT_ARCHIVE_EMAIL defaults to the ES address when unset', () => {
        delete process.env.REACT_APP_REPORT_ARCHIVE_EMAIL;
        let config;
        jest.isolateModules(() => { config = require('./config'); });
        expect(config.REPORT_ARCHIVE_EMAIL).toBe('sverma@engsurveys.com.au');
    });

    test('REPORT_ARCHIVE_EMAIL honours the env override (e.g. flip to bgosling@)', () => {
        process.env.REACT_APP_REPORT_ARCHIVE_EMAIL = 'bgosling@engsurveys.com.au';
        let config;
        jest.isolateModules(() => { config = require('./config'); });
        expect(config.REPORT_ARCHIVE_EMAIL).toBe('bgosling@engsurveys.com.au');
    });

    test('EMAIL_ENDPOINT is empty (email disabled) when unset', () => {
        delete process.env.REACT_APP_EMAIL_ENDPOINT;
        let config;
        jest.isolateModules(() => { config = require('./config'); });
        expect(config.EMAIL_ENDPOINT).toBe('');
    });

    test('EMAIL_ENDPOINT reflects the configured function URL', () => {
        process.env.REACT_APP_EMAIL_ENDPOINT = 'https://proj.supabase.co/functions/v1/send-report';
        let config;
        jest.isolateModules(() => { config = require('./config'); });
        expect(config.EMAIL_ENDPOINT).toContain('/send-report');
    });
});
