// Component tests for the end-of-report sign-off. Covers the two flows that were
// historically fiddly: getValue() shape + date formatting, and "Add my signature"
// pulling the saved profile signature. SignaturePad (canvas) and the profile
// service (network) are mocked.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignOffSection from './SignOffSection';

// Profile signature source — mocked so no backend is touched. (Implementation is
// (re)applied in beforeEach because CRA's Jest resetMocks:true clears it otherwise.)
jest.mock('../services/profileService', () => ({ getSignoff: jest.fn() }));
// SignaturePad needs a canvas; stub it with the imperative API the component calls.
jest.mock('./SignaturePad', () => {
    const React2 = require('react');
    return React2.forwardRef((props, ref) => {
        React2.useImperativeHandle(ref, () => ({
            isEmpty: () => true,
            toDataURL: () => 'data:image/png;base64,DRAWN',
            clear: () => {},
        }));
        return null;
    });
});

const { getSignoff } = require('../services/profileService');

describe('SignOffSection', () => {
    beforeEach(() => {
        getSignoff.mockReset();
        getSignoff.mockResolvedValue({ fullName: 'Jane Locator', signature: 'data:image/png;base64,PROFILESIG' });
    });

    test('defaults to no signature and formats the date dd/mm/yyyy', () => {
        const ref = React.createRef();
        render(<SignOffSection ref={ref} defaultLocator="Sam Field" />);
        const v = ref.current.getValue();
        expect(v.locatorName).toBe('Sam Field');
        expect(v.signature).toBe('');
        expect(v.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    test('"Add my signature" loads the profile signature and name', async () => {
        const ref = React.createRef();
        render(<SignOffSection ref={ref} />);

        fireEvent.click(screen.getByRole('button', { name: /Add my signature/i }));

        await waitFor(() => expect(ref.current.getValue().signature).toBe('data:image/png;base64,PROFILESIG'));
        expect(ref.current.getValue().locatorName).toBe('Jane Locator');
        // Preview image is shown.
        expect(await screen.findByAltText('signature')).toBeInTheDocument();
    });

    test('"Sign on someone else\'s behalf" reveals the draw/upload controls and clears any signature', async () => {
        const ref = React.createRef();
        render(<SignOffSection ref={ref} />);
        fireEvent.click(screen.getByRole('button', { name: /someone else/i }));
        expect(await screen.findByRole('button', { name: /Use drawing/i })).toBeInTheDocument();
        expect(ref.current.getValue().signature).toBe('');
    });

    test('Remove resets the sign-off back to none', async () => {
        const ref = React.createRef();
        render(<SignOffSection ref={ref} />);
        fireEvent.click(screen.getByRole('button', { name: /Add my signature/i }));
        await waitFor(() => expect(ref.current.getValue().signature).not.toBe(''));
        fireEvent.click(screen.getByRole('button', { name: /^Remove$/i }));
        expect(ref.current.getValue().signature).toBe('');
    });
});
