// Component tests for PotholePanel — the auto-numbering (PH01, PH02…) that must
// hold even for camera shots, plus rename and remove. The camera and the image
// downscaler are mocked out (they need getUserMedia / canvas, which jsdom lacks);
// this test is purely about the panel's list logic and rendering.
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PotholePanel from './PotholePanel';

// downscaleImage -> identity so uploads resolve instantly with a predictable src.
// (Impl reapplied in beforeEach because CRA's Jest resetMocks:true clears it.)
jest.mock('../utils/image', () => ({ downscaleImage: jest.fn() }));
// CameraCapture pulls in getUserMedia; render nothing.
jest.mock('./CameraCapture', () => () => null);

const { downscaleImage } = require('../utils/image');
beforeEach(() => { downscaleImage.mockImplementation(async (src) => src); });

// A tiny stateful host so the controlled PotholePanel actually accumulates photos
// across adds (mirrors how the report tools own the potholes array).
function Harness({ initial = [] }) {
    const [potholes, setPotholes] = useState(initial);
    return <PotholePanel potholes={potholes} onChange={setPotholes} />;
}

const pngFile = (name) => new File(['fake-bytes'], name, { type: 'image/png' });
const fileInput = () => document.querySelector('input[type="file"]');

describe('PotholePanel', () => {
    test('shows the empty state when there are no potholes', () => {
        render(<Harness />);
        expect(screen.getByText(/No potholes added for this photo/i)).toBeInTheDocument();
        expect(screen.getByText('Potholes (0)')).toBeInTheDocument();
    });

    test('auto-numbers added photos PH01, PH02 in sequence', async () => {
        render(<Harness />);

        fireEvent.change(fileInput(), { target: { files: [pngFile('a.png')] } });
        expect(await screen.findByDisplayValue('PH01')).toBeInTheDocument();

        fireEvent.change(fileInput(), { target: { files: [pngFile('b.png')] } });
        expect(await screen.findByDisplayValue('PH02')).toBeInTheDocument();

        await waitFor(() => expect(screen.getByText('Potholes (2)')).toBeInTheDocument());
    });

    test('numbers a multi-file drop in order', async () => {
        render(<Harness />);
        fireEvent.change(fileInput(), { target: { files: [pngFile('a.png'), pngFile('b.png'), pngFile('c.png')] } });
        expect(await screen.findByDisplayValue('PH01')).toBeInTheDocument();
        expect(await screen.findByDisplayValue('PH02')).toBeInTheDocument();
        expect(await screen.findByDisplayValue('PH03')).toBeInTheDocument();
    });

    test('lets the user rename a pothole (edit is preserved, not auto-renumbered)', () => {
        render(<Harness initial={[{ id: 'p1', label: 'PH01', src: 'data:x' }]} />);
        const input = screen.getByDisplayValue('PH01');
        fireEvent.change(input, { target: { value: 'Driveway crack' } });
        expect(screen.getByDisplayValue('Driveway crack')).toBeInTheDocument();
    });

    test('removes a pothole', () => {
        render(<Harness initial={[{ id: 'p1', label: 'PH01', src: 'data:x' }]} />);
        expect(screen.getByText('Potholes (1)')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Remove pothole'));
        expect(screen.getByText('Potholes (0)')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('PH01')).not.toBeInTheDocument();
    });
});
