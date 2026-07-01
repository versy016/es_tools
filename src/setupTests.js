// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// --------------------------------------------------------------------------
// Test-environment hardening. Two goals:
//  1. Polyfill the browser APIs jsdom omits, so components render without crashing.
//  2. GUARANTEE tests never touch the real backend: any unmocked network call
//     throws loudly. Combined with the Supabase client being mocked in service
//     tests, this means the suite can NOT create/read/delete real reports —
//     so it can never leave test records in the database. (No cleanup needed.)
// --------------------------------------------------------------------------

// Block real network by default. Tests that exercise fetch (e.g. emailService)
// assign their own jest.fn() to global.fetch and are fully in control.
global.fetch = jest.fn(() =>
    Promise.reject(new Error(
        'Unmocked network call blocked in tests. Mock fetch (or the service) so ' +
        'tests never reach a real server — this is what keeps them from writing test data.',
    )));

// jsdom has no matchMedia — several components/libraries read it on mount.
if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
}

// jsdom has no object-URL support — used when previewing generated blobs.
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock';
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};

// Quieter, deterministic scroll no-ops.
if (!window.scrollTo) window.scrollTo = () => {};
