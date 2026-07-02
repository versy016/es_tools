// Tests for the invite dialog (name + email + role).
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InviteDialog from './InviteDialog';

const send = () => fireEvent.click(screen.getByRole('button', { name: /Send invite/i }));

test('requires a name', () => {
    const onSubmit = jest.fn();
    render(<InviteDialog open roles={['Surveyor', 'Admin']} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('name@engsurveys.com.au'), { target: { value: 'a@b.com' } });
    send();
    expect(screen.getByText(/person’s name/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
});

test('requires a valid email', () => {
    const onSubmit = jest.fn();
    render(<InviteDialog open roles={['Surveyor', 'Admin']} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Dave Mitchell'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByPlaceholderText('name@engsurveys.com.au'), { target: { value: 'nope' } });
    send();
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
});

test('submits name, email and chosen role', () => {
    const onSubmit = jest.fn();
    render(<InviteDialog open roles={['Surveyor', 'Admin']} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Dave Mitchell'), { target: { value: '  Sam Field  ' } });
    fireEvent.change(screen.getByPlaceholderText('name@engsurveys.com.au'), { target: { value: '  sam@engsurveys.com.au  ' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Admin' } });
    send();
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Sam Field', email: 'sam@engsurveys.com.au', role: 'Admin' });
});

test('only offers the roles it is given', () => {
    render(<InviteDialog open roles={['Surveyor', 'Admin']} onSubmit={() => {}} onCancel={() => {}} />);
    const options = Array.from(screen.getByRole('combobox').querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['Surveyor', 'Admin']);
});
