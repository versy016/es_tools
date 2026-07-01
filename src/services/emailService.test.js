// Tests for the single email send path. fetch is mocked, so NO real request is
// ever made — the email backend is never actually hit and no report is sent.
// We control config (EMAIL_ENDPOINT / archive) per-test via isolateModules.

// Load emailService with a specific config, in isolation, so EMAIL_ENDPOINT is
// whatever the test wants (the module reads it at import time).
const loadWith = (endpoint) => {
    let mod;
    jest.isolateModules(() => {
        jest.doMock('../config', () => ({
            EMAIL_ENDPOINT: endpoint,
            REPORT_ARCHIVE_EMAIL: 'archive@engsurveys.com.au',
        }));
        mod = require('./emailService');
    });
    return mod;
};

const okResponse = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });

describe('emailService.isEmailConfigured', () => {
    test('false when the endpoint is unset', () => {
        expect(loadWith('').isEmailConfigured()).toBe(false);
    });
    test('true when the endpoint is set', () => {
        expect(loadWith('https://fn/send-report').isEmailConfigured()).toBe(true);
    });
});

describe('emailService.sendReportEmail', () => {
    beforeEach(() => { global.fetch = jest.fn(() => Promise.resolve(okResponse())); });

    test('throws (and never calls fetch) when email is not configured', async () => {
        const { sendReportEmail } = loadWith('');
        await expect(sendReportEmail({ to: 'a@x.com' })).rejects.toThrow(/not configured/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('POSTs to the endpoint and appends + de-dupes the archive recipient', async () => {
        const { sendReportEmail } = loadWith('https://fn/send-report');
        await sendReportEmail({ to: ['a@x.com', 'a@x.com'], subject: 'Hi', filename: 'r.pdf', contentBase64: 'AAA' });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toBe('https://fn/send-report');
        expect(opts.method).toBe('POST');
        const body = JSON.parse(opts.body);
        // duplicate 'a@x.com' collapsed, archive appended once.
        expect(body.to).toEqual(['a@x.com', 'archive@engsurveys.com.au']);
        expect(body.subject).toBe('Hi');
        // pdfBase64 kept as a backwards-compatible alias of contentBase64.
        expect(body.contentBase64).toBe('AAA');
        expect(body.pdfBase64).toBe('AAA');
    });

    test('omits the archive recipient when archive:false', async () => {
        const { sendReportEmail } = loadWith('https://fn/send-report');
        await sendReportEmail({ to: 'only@x.com', archive: false });
        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.to).toEqual(['only@x.com']);
    });

    test('surfaces the backend JSON error on a non-2xx response', async () => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false, status: 502, json: async () => ({ error: 'Email send failed: bad App Password' }),
        }));
        const { sendReportEmail } = loadWith('https://fn/send-report');
        await expect(sendReportEmail({ to: 'a@x.com' })).rejects.toThrow(/bad App Password/);
    });

    test('reports a clear network/CORS error when fetch itself rejects', async () => {
        global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
        const { sendReportEmail } = loadWith('https://fn/send-report');
        await expect(sendReportEmail({ to: 'a@x.com' })).rejects.toThrow(/network\/CORS/i);
    });
});
