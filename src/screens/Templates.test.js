// Tests for the manager-only Templates screen (managed .docx templates in Supabase storage).
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Templates from './Templates';

const mockToast = jest.fn();
jest.mock('../components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../services/templatesService', () => ({
    MANAGED_TEMPLATES: [
        { name: 'photo-report.docx', label: 'Pothole report', tool: 'Pothole Report Generator' },
        { name: 'service-location.docx', label: 'Service location report', tool: 'Service Location Field Report' },
        { name: 'swms.docx', label: 'SWMS', tool: 'SWMS Generator' },
    ],
    listManagedTemplates: jest.fn(), uploadTemplate: jest.fn(), removeTemplate: jest.fn(),
}));
import { listManagedTemplates, uploadTemplate, removeTemplate } from '../services/templatesService';

const rows = (over = {}) => [
    { name: 'photo-report.docx', label: 'Pothole report', tool: 'Pothole Report Generator', managed: false, updatedAt: null, size: null },
    { name: 'service-location.docx', label: 'Service location report', tool: 'Service Location Field Report', managed: false, updatedAt: null, size: null },
    { name: 'swms.docx', label: 'SWMS', tool: 'SWMS Generator', managed: true, updatedAt: '2026-09-01T00:00:00Z', size: 45000, ...over },
];
const rowFor = (label) => screen.getByText(label).closest('tr');

beforeEach(() => {
    mockToast.mockReset();
    listManagedTemplates.mockResolvedValue(rows());
    uploadTemplate.mockResolvedValue(); removeTemplate.mockResolvedValue();
});

test('lists each managed template with its status', async () => {
    render(<Templates />);
    expect(screen.getByRole('heading', { name: /Templates/i })).toBeInTheDocument();
    expect(await screen.findByText('SWMS')).toBeInTheDocument();
    expect(within(rowFor('SWMS')).getByText(/Managed copy/)).toBeInTheDocument();
    expect(within(rowFor('Pothole report')).getByText(/Bundled default/)).toBeInTheDocument();
    expect(within(rowFor('SWMS')).getByRole('button', { name: /Revert to bundled/i })).toBeInTheDocument();
    expect(within(rowFor('Pothole report')).queryByRole('button', { name: /Revert/i })).toBeNull();
});

test('uploading a .docx replaces the managed copy and refreshes the list', async () => {
    render(<Templates />);
    await screen.findByText('SWMS');
    listManagedTemplates.mockResolvedValue(rows({}).map((r) => (r.name === 'photo-report.docx' ? { ...r, managed: true } : r)));
    const file = new File(['x'], 'anything.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const input = within(rowFor('Pothole report')).getByLabelText(/Upload/i);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadTemplate).toHaveBeenCalledWith('photo-report.docx', file));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/Pothole report template updated/), 'success'));
    await waitFor(() => expect(within(rowFor('Pothole report')).getByText(/Managed copy/)).toBeInTheDocument());
});

test('rejects a non-.docx file without uploading', async () => {
    render(<Templates />);
    await screen.findByText('SWMS');
    const input = within(rowFor('SWMS')).getByLabelText(/Upload/i);
    fireEvent.change(input, { target: { files: [new File(['x'], 'bad.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/\.docx/), 'error'));
    expect(uploadTemplate).not.toHaveBeenCalled();
});

test('Revert asks for confirmation, then removes the managed copy', async () => {
    render(<Templates />);
    await screen.findByText('SWMS');
    fireEvent.click(within(rowFor('SWMS')).getByRole('button', { name: /Revert to bundled/i }));
    const dialog = await screen.findByRole('dialog');
    listManagedTemplates.mockResolvedValue(rows({ managed: false, updatedAt: null, size: null }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Revert/i }));
    await waitFor(() => expect(removeTemplate).toHaveBeenCalledWith('swms.docx'));
    await waitFor(() => expect(within(rowFor('SWMS')).getByText(/Bundled default/)).toBeInTheDocument());
});

test('a failed listing shows an error row instead of crashing', async () => {
    listManagedTemplates.mockRejectedValue(new Error('bucket missing'));
    render(<Templates />);
    expect(await screen.findByText(/bucket missing/)).toBeInTheDocument();
});
