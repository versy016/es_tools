import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowPointer, faPen, faSlash, faSquare, faCircle, faFont,
    faRotateLeft, faRotateRight, faTrash, faCheck, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { UTILITIES } from '../../report/legendColors';

const MAX_W = 1000;
const MAX_H = 640;

// Engine: Fabric.js — shapes, text and freehand with selectable objects + undo.
const FabricEditor = ({ photo, onSave, onClose }) => {
    const canvasElRef = useRef(null);
    const fcRef = useRef(null);
    const scaleRef = useRef(1);
    const [tool, setTool] = useState('select');
    const [color, setColor] = useState('#0000FF');
    const [width, setWidth] = useState(5);

    const toolRef = useRef(tool);
    const colorRef = useRef(color);
    const widthRef = useRef(width);
    useEffect(() => { toolRef.current = tool; }, [tool]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { widthRef.current = width; }, [width]);

    // history
    const histRef = useRef([]);
    const idxRef = useRef(-1);
    const restoringRef = useRef(false);

    const push = () => {
        const canvas = fcRef.current;
        if (!canvas || restoringRef.current) return;
        const json = JSON.stringify(canvas.toJSON());
        histRef.current = histRef.current.slice(0, idxRef.current + 1);
        histRef.current.push(json);
        idxRef.current = histRef.current.length - 1;
    };
    const restore = () => {
        const canvas = fcRef.current;
        restoringRef.current = true;
        canvas.loadFromJSON(histRef.current[idxRef.current], () => { canvas.renderAll(); restoringRef.current = false; });
    };
    const undo = () => { if (idxRef.current > 0) { idxRef.current--; restore(); } };
    const redo = () => { if (idxRef.current < histRef.current.length - 1) { idxRef.current++; restore(); } };

    useEffect(() => {
        const canvas = new fabric.Canvas(canvasElRef.current, { selection: true, preserveObjectStacking: true });
        fcRef.current = canvas;

        fabric.Image.fromURL(photo.src, (img) => {
            const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
            scaleRef.current = scale;
            canvas.setWidth(img.width * scale);
            canvas.setHeight(img.height * scale);
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), { scaleX: scale, scaleY: scale });
            push();
        }, { crossOrigin: 'anonymous' });

        let drawing = false, shape = null, sx = 0, sy = 0;
        canvas.on('mouse:down', (o) => {
            const t = toolRef.current;
            if (t === 'select' || t === 'pen') return;
            const p = canvas.getPointer(o.e);
            if (t === 'text') {
                const it = new fabric.IText('Text', { left: p.x, top: p.y, fill: colorRef.current, fontSize: 26, fontWeight: 'bold' });
                canvas.add(it); canvas.setActiveObject(it); it.enterEditing(); push();
                return;
            }
            drawing = true; sx = p.x; sy = p.y;
            const common = { fill: 'transparent', stroke: colorRef.current, strokeWidth: widthRef.current };
            if (t === 'rect') shape = new fabric.Rect({ left: p.x, top: p.y, width: 0, height: 0, ...common });
            else if (t === 'ellipse') shape = new fabric.Ellipse({ left: p.x, top: p.y, rx: 0, ry: 0, originX: 'left', originY: 'top', ...common });
            else if (t === 'line') shape = new fabric.Line([p.x, p.y, p.x, p.y], { stroke: colorRef.current, strokeWidth: widthRef.current });
            if (shape) canvas.add(shape);
        });
        canvas.on('mouse:move', (o) => {
            if (!drawing || !shape) return;
            const p = canvas.getPointer(o.e);
            if (shape.type === 'rect') shape.set({ width: Math.abs(p.x - sx), height: Math.abs(p.y - sy), left: Math.min(p.x, sx), top: Math.min(p.y, sy) });
            else if (shape.type === 'ellipse') shape.set({ rx: Math.abs(p.x - sx) / 2, ry: Math.abs(p.y - sy) / 2, left: Math.min(p.x, sx), top: Math.min(p.y, sy) });
            else if (shape.type === 'line') shape.set({ x2: p.x, y2: p.y });
            canvas.renderAll();
        });
        canvas.on('mouse:up', () => { if (drawing) { drawing = false; shape = null; push(); } });
        canvas.on('path:created', push);
        canvas.on('object:modified', push);

        return () => canvas.dispose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photo.src]);

    // Apply tool/brush settings to the live canvas.
    useEffect(() => {
        const canvas = fcRef.current;
        if (!canvas) return;
        canvas.isDrawingMode = tool === 'pen';
        if (canvas.isDrawingMode) {
            canvas.freeDrawingBrush.color = color;
            canvas.freeDrawingBrush.width = width;
        }
        canvas.selection = tool === 'select';
        canvas.defaultCursor = tool === 'select' ? 'default' : 'crosshair';
    }, [tool, color, width]);

    const del = () => {
        const canvas = fcRef.current;
        canvas.getActiveObjects().forEach((o) => canvas.remove(o));
        canvas.discardActiveObject();
        canvas.renderAll();
        push();
    };

    const done = () => {
        const canvas = fcRef.current;
        canvas.discardActiveObject();
        canvas.renderAll();
        const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.9, multiplier: scaleRef.current ? 1 / scaleRef.current : 1 });
        onSave({ flattenedDataUrl: dataUrl });
    };

    const TOOLS = [
        { id: 'select', icon: faArrowPointer }, { id: 'pen', icon: faPen }, { id: 'line', icon: faSlash },
        { id: 'rect', icon: faSquare }, { id: 'ellipse', icon: faCircle }, { id: 'text', icon: faFont },
    ];

    return (
        <div className="eng-overlay">
            <div className="eng-modal">
                <div className="eng-toolbar">
                    {TOOLS.map((t) => (
                        <button key={t.id} className={`eng-btn ${tool === t.id ? 'on' : ''}`} onClick={() => setTool(t.id)}><FontAwesomeIcon icon={t.icon} /></button>
                    ))}
                    <span className="eng-divider" />
                    <span className="eng-swatches">
                        {UTILITIES.map((u) => (
                            <button key={u.key} className={`eng-swatch ${color === u.color ? 'on' : ''}`} style={{ background: u.color }} title={u.label} onClick={() => setColor(u.color)} />
                        ))}
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Custom colour" />
                    </span>
                    <span className="eng-divider" />
                    <label className="eng-range">W<input type="range" min="1" max="30" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
                    <button className="eng-btn" onClick={undo} title="Undo"><FontAwesomeIcon icon={faRotateLeft} /></button>
                    <button className="eng-btn" onClick={redo} title="Redo"><FontAwesomeIcon icon={faRotateRight} /></button>
                    <button className="eng-btn danger" onClick={del} title="Delete selected"><FontAwesomeIcon icon={faTrash} /></button>
                    <span className="eng-spacer" />
                    <button className="eng-action cancel" onClick={onClose}><FontAwesomeIcon icon={faXmark} /> Cancel</button>
                    <button className="eng-action save" onClick={done}><FontAwesomeIcon icon={faCheck} /> Done</button>
                </div>
                <div className="eng-stage"><canvas ref={canvasElRef} /></div>
            </div>
        </div>
    );
};

export default FabricEditor;
