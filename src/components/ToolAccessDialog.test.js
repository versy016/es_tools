// Tests for the per-user tool-access dialog (manager/admin restriction editor).
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolAccessDialog from './ToolAccessDialog';

const allowAll = () => screen.getByRole('checkbox', { name: /Allow all tools/i });
const saveBtn = () => screen.getByRole('button', { name: /Save access/i });

test('an unrestricted user shows "allow all" checked and saves null', () => {
    const onSave = jest.fn();
    render(<ToolAccessDialog open user={{ name: 'Sam', tools: null }} onSave={onSave} onCancel={() => {}} />);
    expect(allowAll()).toBeChecked();
    fireEvent.click(saveBtn());
    expect(onSave).toHaveBeenCalledWith(null);
});

test('restricting: uncheck "allow all", pick one tool, saves that id', () => {
    const onSave = jest.fn();
    render(<ToolAccessDialog open user={{ name: 'Sam', tools: null }} onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(allowAll()); // now restricted, nothing selected
    fireEvent.click(screen.getByRole('checkbox', { name: /Service Location Field Report/i }));
    fireEvent.click(saveBtn());
    expect(onSave).toHaveBeenCalledWith(['service-location']);
});

test('seeds from an existing restriction and preserves it', () => {
    const onSave = jest.fn();
    render(<ToolAccessDialog open user={{ name: 'Sam', tools: ['photo-report'] }} onSave={onSave} onCancel={() => {}} />);
    expect(allowAll()).not.toBeChecked();
    fireEvent.click(saveBtn());
    expect(onSave).toHaveBeenCalledWith(['photo-report']);
});

test('renders nothing when closed', () => {
    const { container } = render(<ToolAccessDialog open={false} user={null} onSave={() => {}} onCancel={() => {}} />);
    expect(container).toBeEmptyDOMElement();
});
