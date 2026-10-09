// Tests for the dashboard after the sidebar rework: no resume card, search lives in the
// page header, ES Planner / Action Register are coming-soon tiles.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from './Dashboard';

const mockNavigate = jest.fn();
const mockToast = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useOutletContext: () => ({ userName: 'Shivam Verma' }) }));
jest.mock('../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ allowedTools: null, profile: { signature: 'x' }, user: { id: 'u1' }, role: 'manager' }) }));
jest.mock('../services/reportsService', () => ({ listReports: jest.fn(), getReportUrl: jest.fn(), loadDraft: jest.fn() }));
import { listReports } from '../services/reportsService';

beforeEach(() => { mockNavigate.mockReset(); mockToast.mockReset(); listReports.mockResolvedValue([{ id: 1, title: 'A', meta: 'm', status: 'Draft' }]); });

test('no resume card; greeting, search and the tool grid render', async () => {
    render(<Dashboard />);
    expect(screen.getByRole('heading', { name: /Good (morning|afternoon|evening), Shivam/ })).toBeInTheDocument();
    expect(screen.queryByText(/CONTINUE WHERE YOU LEFT OFF/i)).toBeNull();
    expect(screen.queryByText(/START HERE/i)).toBeNull();
    expect(screen.getByPlaceholderText(/Search tools/i)).toBeInTheDocument();
    expect(screen.getByText('ES Planner')).toBeInTheDocument();
    expect(screen.getByText('ES Action Register')).toBeInTheDocument();
    expect(await screen.findByText(/1 draft in progress/)).toBeInTheDocument();
});

test('typing in the search filters the tiles', () => {
    render(<Dashboard />);
    fireEvent.change(screen.getByPlaceholderText(/Search tools/i), { target: { value: 'swms' } });
    expect(screen.getByText('SWMS Generator')).toBeInTheDocument();
    expect(screen.queryByText('Pothole Report Generator')).toBeNull();
    expect(screen.getByText(/1 of 6/)).toBeInTheDocument();
});

test('clicking a coming-soon tile toasts instead of navigating', () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByText('ES Planner'));
    expect(mockToast).toHaveBeenCalledWith('ES Planner is coming soon');
    expect(mockNavigate).not.toHaveBeenCalled();
});
