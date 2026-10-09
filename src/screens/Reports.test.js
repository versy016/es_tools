// Tests for the Reports screen's status filtering (incl. the sidebar's ?status=Drafts link).
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reports from './Reports';

jest.mock('../components/Toast', () => ({ useToast: () => () => {} }));
jest.mock('../services/reportsService', () => ({
    listReports: jest.fn(), getReportUrl: jest.fn(), getReportBlob: jest.fn(), loadDraft: jest.fn(), removeReport: jest.fn(),
}));
jest.mock('../services/emailService', () => ({ sendReportEmail: jest.fn(), isEmailConfigured: () => false, blobToBase64: jest.fn() }));
import { listReports } from '../services/reportsService';

const at = (path) => render(<MemoryRouter initialEntries={[path]}><Reports /></MemoryRouter>);

beforeEach(() => {
    listReports.mockResolvedValue([
        { id: 1, title: 'Lower-case draft', meta: 'm', status: 'draft' },
        { id: 2, title: 'Proper draft', meta: 'm', status: 'Draft' },
        { id: 3, title: 'A final one', meta: 'm', status: 'Final' },
    ]);
});

test('?status=Drafts preselects Drafts and lists every draft, whatever its casing', async () => {
    at('/reports?status=Drafts');
    expect(await screen.findByText('Proper draft')).toBeInTheDocument();
    expect(screen.getByText('Lower-case draft')).toBeInTheDocument();
    expect(screen.queryByText('A final one')).toBeNull();
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveClass('on');
});

test('without a status param every report is listed', async () => {
    at('/reports');
    expect(await screen.findByText('A final one')).toBeInTheDocument();
    expect(screen.getByText('Proper draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toHaveClass('on');
});
