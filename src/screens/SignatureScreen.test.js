// Tests for the standalone My signature screen (lifted out of Profile). The canvas pad
// and the profile service are mocked.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignatureScreen from './SignatureScreen';

const mockToast = jest.fn();
const mockPad = { isEmpty: jest.fn(), toDataURL: jest.fn(), fromDataURL: jest.fn(), clear: jest.fn() };
jest.mock('../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ userName: 'Shivam Verma', reloadProfile: jest.fn() }) }));
jest.mock('../services/profileService', () => ({ loadSignature: jest.fn(), saveSignature: jest.fn(), loadProfile: jest.fn() }));
jest.mock('../components/SignaturePad', () => {
    const React2 = require('react');
    return React2.forwardRef((props, ref) => { React2.useImperativeHandle(ref, () => mockPad); return <div data-testid="pad" />; });
});
import { loadSignature, saveSignature, loadProfile } from '../services/profileService';

beforeEach(() => {
    mockToast.mockReset();
    mockPad.isEmpty.mockReturnValue(false); mockPad.toDataURL.mockReturnValue('data:image/png;base64,NEW');
    loadSignature.mockResolvedValue(''); saveSignature.mockResolvedValue(true);
    loadProfile.mockResolvedValue({ fullName: 'Shivam Verma', role: 'Manager', accreditation: 'Lic 123', mobile: '0400 000 000', email: 'sverma@engsurveys.com.au' });
});

test('renders the heading, the pad and the report preview with profile details', async () => {
    render(<SignatureScreen />);
    expect(screen.getByRole('heading', { name: /My signature/i })).toBeInTheDocument();
    expect(screen.getByTestId('pad')).toBeInTheDocument();
    expect(await screen.findByText(/Manager · Lic 123/)).toBeInTheDocument();
    expect(screen.getByText('Shivam Verma')).toBeInTheDocument();
    expect(screen.getByText(/No signature saved yet/)).toBeInTheDocument();
});

test('a saved signature is loaded into the pad and shown in the preview', async () => {
    loadSignature.mockResolvedValue('data:image/png;base64,SAVED');
    render(<SignatureScreen />);
    expect(await screen.findByAltText('Signature')).toHaveAttribute('src', 'data:image/png;base64,SAVED');
    await waitFor(() => expect(mockPad.fromDataURL).toHaveBeenCalledWith('data:image/png;base64,SAVED'));
});

test('saving an empty pad toasts an error and does not save', async () => {
    mockPad.isEmpty.mockReturnValue(true);
    render(<SignatureScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Save signature/i }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/Draw or upload/), 'error'));
    expect(saveSignature).not.toHaveBeenCalled();
});

test('saving a drawn signature stores it and updates the preview', async () => {
    render(<SignatureScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Save signature/i }));
    await waitFor(() => expect(saveSignature).toHaveBeenCalledWith('data:image/png;base64,NEW'));
    expect(await screen.findByAltText('Signature')).toHaveAttribute('src', 'data:image/png;base64,NEW');
    expect(mockToast).toHaveBeenCalledWith('Signature saved', 'success');
});

test('Clear empties the pad', () => {
    render(<SignatureScreen />);
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }));
    expect(mockPad.clear).toHaveBeenCalled();
});
