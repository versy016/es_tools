// Component tests for the left sidebar (the app's only navigation). Auth, the nav guard,
// reports and toasts are mocked; the router is real (MemoryRouter) so active links work.
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const mockToast = jest.fn();
const mockSignOut = jest.fn();
let mockAuth = {};
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('./Toast', () => ({ useToast: () => mockToast }));
jest.mock('./NavGuard', () => ({ useNavGuard: () => ({ runGuarded: (fn) => fn() }) }));
jest.mock('../services/reportsService', () => ({ listReports: jest.fn() }));
import { listReports } from '../services/reportsService';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
const renderAt = (path = '/dashboard') => render(
    <MemoryRouter initialEntries={[path]}>
        <Sidebar />
        <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>,
);
const section = (label) => screen.getByText(label).closest('div.sb-group') || screen.getByText(label).parentElement;

beforeEach(() => {
    mockToast.mockReset(); mockSignOut.mockReset();
    listReports.mockResolvedValue([{ id: 1, status: 'Draft' }, { id: 2, status: 'Final' }, { id: 3, status: 'Draft' }]);
    mockAuth = { userName: 'Shivam Verma', role: 'surveyor', allowedTools: null, signOut: mockSignOut };
});

test('a surveyor sees Home + footer, no Tools group, no Manage section', async () => {
    renderAt();
    expect(screen.getByRole('link', { name: /^Dashboard$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Reports$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My drafts/ })).toBeInTheDocument();
    // Tools live on the dashboard only — the sidebar never lists them.
    expect(screen.queryByText('Tools')).toBeNull();
    expect(screen.queryByText('Pothole Report Generator')).toBeNull();
    expect(screen.queryByText('SWMS Generator')).toBeNull();
    expect(screen.queryByText('ES Planner')).toBeNull();
    expect(screen.queryByText('Shared Drive Manager')).toBeNull();
    expect(screen.queryByText('Manage')).toBeNull();
    expect(screen.queryByRole('link', { name: /^Users$/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Templates$/ })).toBeNull();
    expect(screen.getByRole('link', { name: /My signature/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shivam Verma/ })).toBeInTheDocument();
    expect(screen.getByText('Surveyor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
});

test('a manager also sees Manage (Users, Templates)', () => {
    mockAuth.role = 'manager';
    renderAt();
    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Users$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Templates$/ })).toBeInTheDocument();
    expect(screen.queryByText('Shared Drive Manager')).toBeNull();
});

test('an admin sees Manage too', () => {
    mockAuth.role = 'admin';
    renderAt();
    expect(screen.getByRole('link', { name: /^Users$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Templates$/ })).toBeInTheDocument();
});

test('My drafts shows the draft count and opens Reports pre-filtered to Drafts', async () => {
    renderAt();
    const drafts = await screen.findByRole('link', { name: /My drafts/ });
    expect(await within(drafts).findByText('2')).toBeInTheDocument();
    fireEvent.click(drafts);
    expect(screen.getByTestId('where')).toHaveTextContent('/reports?status=Drafts');
});

test('links navigate through the router and mark the active entry', () => {
    renderAt('/reports');
    expect(screen.getByRole('link', { name: /^Reports$/ })).toHaveClass('active');
    fireEvent.click(screen.getByRole('link', { name: /My signature/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/signature');
    fireEvent.click(screen.getByRole('button', { name: /Shivam Verma/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/profile');
});

test('only one of Reports / My drafts is active at a time', () => {
    const { unmount } = renderAt('/reports?status=Drafts');
    expect(screen.getByRole('link', { name: /My drafts/ })).toHaveClass('active');
    expect(screen.getByRole('link', { name: /^Reports$/ })).not.toHaveClass('active');
    unmount();
    renderAt('/reports');
    expect(screen.getByRole('link', { name: /^Reports$/ })).toHaveClass('active');
    expect(screen.getByRole('link', { name: /My drafts/ })).not.toHaveClass('active');
});

test('the drafts badge refreshes on navigation so it never goes stale', async () => {
    renderAt('/dashboard');
    const drafts = await screen.findByRole('link', { name: /My drafts/ });
    expect(await within(drafts).findByText('2')).toBeInTheDocument();
    // Both drafts get finalised elsewhere; the next navigation must pick that up.
    listReports.mockResolvedValue([{ id: 1, status: 'Final' }, { id: 3, status: 'Final' }]);
    fireEvent.click(screen.getByRole('link', { name: /^Reports$/ }));
    await waitFor(() => expect(within(screen.getByRole('link', { name: /My drafts/ })).queryByText('2')).toBeNull());
});

test('Sign out calls the auth sign-out', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /Sign out/ }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
});

test('the mobile menu button toggles the drawer and a link click closes it', () => {
    renderAt();
    const burger = screen.getByRole('button', { name: /Open menu/i });
    const aside = screen.getByRole('navigation');
    expect(aside).not.toHaveClass('open');
    fireEvent.click(burger);
    expect(aside).toHaveClass('open');
    fireEvent.click(screen.getByRole('link', { name: /^Reports$/ }));
    expect(aside).not.toHaveClass('open');
});

test('tolerates a reports fetch failure (no badge, no crash)', async () => {
    listReports.mockRejectedValue(new Error('offline'));
    renderAt();
    await waitFor(() => expect(listReports).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /My drafts/ })).toBeInTheDocument();
});
