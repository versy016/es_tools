// Rendering test for the reusable empty-state placeholder.
import React from 'react';
import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
    test('renders the title', () => {
        render(<EmptyState title="Nothing here yet" />);
        expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    });

    test('renders optional subtitle and action when provided', () => {
        render(<EmptyState title="No reports" sub="Create one to get started" action={<button>New</button>} />);
        expect(screen.getByText('Create one to get started')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    });

    test('omits subtitle/action nodes when not provided', () => {
        const { container } = render(<EmptyState title="Empty" />);
        expect(container.querySelector('.empty-state-sub')).toBeNull();
        expect(container.querySelector('.empty-state-action')).toBeNull();
    });
});
