// Tests for the set-new-password screen (invite / password-reset landing).
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResetPassword from './ResetPassword';

const mockUpdate = jest.fn();
const mockNavigate = jest.fn();
const mockToast = jest.fn();

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ updatePassword: mockUpdate }) }));
jest.mock('../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const fill = (label, value) => fireEvent.change(screen.getByLabelText(new RegExp(label, 'i')), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: /Save password/i }));

beforeEach(() => {
    mockUpdate.mockReset(); mockNavigate.mockReset(); mockToast.mockReset();
    mockUpdate.mockResolvedValue({ error: null });
});

test('rejects mismatched passwords and does not call the backend', async () => {
    render(<ResetPassword />);
    fill('New password', 'password123');
    fill('Confirm password', 'different123');
    save();
    expect(await screen.findByText(/match/i)).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
});

test('rejects passwords shorter than 8 characters', async () => {
    render(<ResetPassword />);
    fill('New password', 'short');
    fill('Confirm password', 'short');
    save();
    expect(await screen.findByText(/at least 8/i)).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
});

test('updates the password and routes to the dashboard on success', async () => {
    render(<ResetPassword />);
    fill('New password', 'password123');
    fill('Confirm password', 'password123');
    save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('password123'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
});

test('surfaces a backend error without navigating', async () => {
    mockUpdate.mockResolvedValue({ error: { message: 'Password is too weak' } });
    render(<ResetPassword />);
    fill('New password', 'password123');
    fill('Confirm password', 'password123');
    save();
    expect(await screen.findByText(/too weak/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
});
