import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Stage, Layer, Image as KImage, Line, Arrow, Rect, Ellipse,
    Text, Label, Tag, Circle, Transformer,
} from 'react-konva';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowPointer, faPen, faSlash, faArrowRightLong, faSquare, faCircle,
    faFont, faTag, faFillDrip, faTrash, faRotateLeft, faRotateRight,
    faCheck, faXmark, faClone, faEraser,
} from '@fortawesome/free-solid-svg-icons';
import { UTILITIES, getUtility } from '../report/legendColors';

let idCounter = 0;
const nextId = () => `ann_${Date.now()}_${idCounter++}`;

const POLY_TYPES = ['line', 'arrow', 'pen'];
const BOX_TYPES = ['rect', 'ellipse'];
const TEXT_TYPES = ['text', 'textbox'];
const DRAG_THRESHOLD = 6;

const withAlpha = (hex, a) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

const TOOLS = [
    { id: 'select', icon: faArrowPointer, label: 'Select / Move' },
    { id: 'pen', icon: faPen, label: 'Freehand' },
    { id: 'line', icon: faSlash, label: 'Line — drag for straight, or click points' },
    { id: 'arrow', icon: faArrowRightLong, label: 'Arrow — drag for straight, or click points' },
    { id: 'rect', icon: faSquare, label: 'Rectangle' },
    { id: 'ellipse', icon: faCircle, label: 'Circle / Ellipse' },
    { id: 'text', icon: faFont, label: 'Text' },
    { id: 'textbox', icon: faTag, label: 'Text box' },
];

// Advanced photo annotation editor.
// Lines / arrows support BOTH drag-to-draw (straight) and click-to-add multi-vertex
// polylines, with draggable / insertable / removable vertices. Also rectangles,
// ellipses, freehand pen, text and text-boxes with inline on-canvas editing.
// Exports a flattened PNG on save (UI handles live on a separate hidden layer).
const PhotoAnnotator = ({ photo, onSave, onCancel }) => {
    const [img, setImg] = useState(null);
    const [view, setView] = useState({ width: 0, height: 0, scale: 1 });
    const [tool, setTool] = useState('select');
    const [utility, setUtility] = useState(photo.lastUtility || 'water');
    const [strokeWidth, setStrokeWidth] = useState(5);
    const [fontSize, setFontSize] = useState(22);
    const [fillShapes, setFillShapes] = useState(false);
    const [labelEnds, setLabelEnds] = useState(false);

    const [annotations, setAnnotations] = useState(photo.annotations || []);
    const [selectedId, setSelectedId] = useState(null);
    const [history, setHistory] = useState([photo.annotations || []]);
    const [histIndex, setHistIndex] = useState(0);
    const [editing, setEditing] = useState(null);

    const stageRef = useRef(null);
    const trRef = useRef(null);
    const editRef = useRef(null);
    const drawingRef = useRef(null);
    const annotationsRef = useRef(annotations);
    const utilityRef = useRef(utility);
    const downPosRef = useRef(null);
    const movedRef = useRef(false);
    const justStartedRef = useRef(false);

    useEffect(() => { utilityRef.current = utility; }, [utility]);

    useEffect(() => {
        const image = new window.Image();
        image.src = photo.src;
        image.onload = () => {
            const natW = image.naturalWidth;
            const natH = image.naturalHeight;
            const maxW = window.innerWidth * 0.70;
            const maxH = window.innerHeight * 0.70;
            const scale = Math.max(0.1, Math.min(maxW / natW, maxH / natH, 3));
            setImg(image);
            setView({ width: Math.round(natW * scale), height: Math.round(natH * scale), scale });
        };
    }, [photo.src]);

    const applyAnnotations = useCallback((next) => {
        annotationsRef.current = next;
        setAnnotations(next);
    }, []);

    const pushHistory = useCallback((next) => {
        setHistory((prev) => [...prev.slice(0, histIndex + 1), next]);
        setHistIndex((i) => i + 1);
    }, [histIndex]);

    const commit = useCallback((next) => {
        applyAnnotations(next);
        pushHistory(next);
    }, [applyAnnotations, pushHistory]);

    const undo = () => {
        if (histIndex > 0) { const i = histIndex - 1; setHistIndex(i); applyAnnotations(history[i]); setSelectedId(null); setEditing(null); }
    };
    const redo = () => {
        if (histIndex < history.length - 1) { const i = histIndex + 1; setHistIndex(i); applyAnnotations(history[i]); setSelectedId(null); setEditing(null); }
    };

    const updateAnnotation = (id, patch, record = true) => {
        const next = annotationsRef.current.map((a) => (a.id === id ? { ...a, ...patch } : a));
        if (record) commit(next); else applyAnnotations(next);
    };

    const deleteSelected = () => {
        if (!selectedId) return;
        commit(annotationsRef.current.filter((a) => a.id !== selectedId));
        setSelectedId(null);
    };

    const duplicateSelected = () => {
        const sel = annotationsRef.current.find((a) => a.id === selectedId);
        if (!sel) return;
        const copy = JSON.parse(JSON.stringify(sel));
        copy.id = nextId();
        copy.x = (copy.x || 0) + 16;
        copy.y = (copy.y || 0) + 16;
        commit([...annotationsRef.current, copy]);
        setSelectedId(copy.id);
    };

    const clearAll = () => {
        if (annotationsRef.current.length && window.confirm('Remove all annotations from this photo?')) {
            commit([]); setSelectedId(null); setEditing(null);
        }
    };

    const pointer = () => {
        const p = stageRef.current.getPointerPosition();
        return p ? { x: p.x, y: p.y } : null;
    };

    const selected = annotations.find((a) => a.id === selectedId);

    // Transformer wiring (box + text shapes)
    useEffect(() => {
        const tr = trRef.current;
        if (!tr || !stageRef.current) return;
        const node = (tool === 'select' && selected && (BOX_TYPES.includes(selected.type) || TEXT_TYPES.includes(selected.type)))
            ? stageRef.current.findOne('#' + selected.id) : null;
        tr.nodes(node ? [node] : []);
        if (tr.getLayer()) tr.getLayer().batchDraw();
    }, [selectedId, tool, annotations, selected]);

    // Inline text editing
    const startEditing = (ann, isNew = false) => {
        const box = stageRef.current.container().getBoundingClientRect();
        const u = getUtility(ann.utility);
        setSelectedId(ann.id);
        setEditing({
            id: ann.id,
            left: box.left + ann.x,
            top: box.top + ann.y,
            value: ann.text || '',
            fontSize: ann.fontSize || fontSize,
            color: ann.type === 'textbox' ? u.text : u.color,
            bg: ann.type === 'textbox' ? u.color : 'rgba(255,255,255,0.9)',
            isNew,
        });
        setTimeout(() => editRef.current && editRef.current.focus(), 20);
    };

    const commitEditing = () => {
        if (!editing) return;
        const value = editing.value;
        if (!value.trim()) {
            applyAnnotations(annotationsRef.current.filter((a) => a.id !== editing.id));
            if (!editing.isNew) pushHistory(annotationsRef.current);
        } else {
            updateAnnotation(editing.id, { text: value });
        }
        setEditing(null);
    };

    const cancelEditing = () => {
        if (editing && editing.isNew) applyAnnotations(annotationsRef.current.filter((a) => a.id !== editing.id));
        setEditing(null);
    };

    // Polyline finishing. dropLast removes the trailing live preview vertex.
    const finishPolyline = (dropLast = true) => {
        const d = drawingRef.current;
        if (!d || !POLY_TYPES.includes(d.type)) return;
        drawingRef.current = null;
        const pts = dropLast ? d.points.slice(0, -2) : d.points;
        // discard degenerate (too few points, or a zero-length 2-point segment)
        const zeroLen = pts.length === 4 && dist(pts[0], pts[1], pts[2], pts[3]) < DRAG_THRESHOLD;
        if (pts.length < 4 || zeroLen) {
            applyAnnotations(annotationsRef.current.filter((a) => a.id !== d.id));
            return;
        }
        const finalShape = { ...d, points: pts };
        const next = annotationsRef.current.map((a) => (a.id === d.id ? finalShape : a));
        if (labelEnds) {
            const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
            const label = { id: nextId(), type: 'textbox', x: lx + 6, y: ly + 6, text: '', fontSize, utility: d.utility };
            applyAnnotations([...next, label]);
            pushHistory(annotationsRef.current);
            setTool('select');
            startEditing(label, true);
        } else {
            commit(next);
        }
    };

    const cancelDrawing = () => {
        const d = drawingRef.current;
        if (!d) return;
        drawingRef.current = null;
        applyAnnotations(annotationsRef.current.filter((a) => a.id !== d.id));
    };

    // Pointer handlers
    const handleMouseDown = (e) => {
        if (editing) return;
        const pos = pointer();
        if (!pos) return;
        const u = utilityRef.current;

        if (tool === 'select') {
            if (e.target === stageRef.current || e.target.name() === 'bg') setSelectedId(null);
            return;
        }
        if (tool === 'pen') {
            drawingRef.current = { id: nextId(), type: 'pen', utility: u, strokeWidth, points: [pos.x, pos.y], x: 0, y: 0 };
            applyAnnotations([...annotationsRef.current, drawingRef.current]);
        } else if (tool === 'rect') {
            drawingRef.current = { id: nextId(), type: 'rect', utility: u, strokeWidth, fill: fillShapes, x: pos.x, y: pos.y, width: 0, height: 0, _ox: pos.x, _oy: pos.y };
            applyAnnotations([...annotationsRef.current, drawingRef.current]);
        } else if (tool === 'ellipse') {
            drawingRef.current = { id: nextId(), type: 'ellipse', utility: u, strokeWidth, fill: fillShapes, x: pos.x, y: pos.y, radiusX: 0, radiusY: 0, _ox: pos.x, _oy: pos.y };
            applyAnnotations([...annotationsRef.current, drawingRef.current]);
        } else if (tool === 'line' || tool === 'arrow') {
            downPosRef.current = pos;
            movedRef.current = false;
            if (!drawingRef.current) {
                drawingRef.current = { id: nextId(), type: tool, utility: u, strokeWidth, points: [pos.x, pos.y, pos.x, pos.y], x: 0, y: 0 };
                applyAnnotations([...annotationsRef.current, drawingRef.current]);
                justStartedRef.current = true;
            } else {
                justStartedRef.current = false;
            }
        }
    };

    const handleMouseMove = () => {
        const d = drawingRef.current;
        if (!d) return;
        const pos = pointer();
        if (!pos) return;
        if (d.type === 'pen') {
            d.points = [...d.points, pos.x, pos.y];
        } else if (d.type === 'rect') {
            d.x = Math.min(d._ox, pos.x); d.y = Math.min(d._oy, pos.y);
            d.width = Math.abs(pos.x - d._ox); d.height = Math.abs(pos.y - d._oy);
        } else if (d.type === 'ellipse') {
            d.x = (d._ox + pos.x) / 2; d.y = (d._oy + pos.y) / 2;
            d.radiusX = Math.abs(pos.x - d._ox) / 2; d.radiusY = Math.abs(pos.y - d._oy) / 2;
        } else if (POLY_TYPES.includes(d.type)) {
            d.points = [...d.points.slice(0, -2), pos.x, pos.y];
            if (downPosRef.current && dist(pos.x, pos.y, downPosRef.current.x, downPosRef.current.y) > DRAG_THRESHOLD) movedRef.current = true;
        }
        applyAnnotations(annotationsRef.current.map((a) => (a.id === d.id ? { ...d } : a)));
    };

    const handleMouseUp = () => {
        const d = drawingRef.current;
        if (!d) return;
        if (d.type === 'pen') {
            drawingRef.current = null;
            if (d.points.length < 6) { applyAnnotations(annotationsRef.current.filter((a) => a.id !== d.id)); return; }
            pushHistory(annotationsRef.current);
        } else if (d.type === 'rect') {
            drawingRef.current = null;
            if (d.width < 5 || d.height < 5) { applyAnnotations(annotationsRef.current.filter((a) => a.id !== d.id)); return; }
            pushHistory(annotationsRef.current);
        } else if (d.type === 'ellipse') {
            drawingRef.current = null;
            if (d.radiusX < 4 || d.radiusY < 4) { applyAnnotations(annotationsRef.current.filter((a) => a.id !== d.id)); return; }
            pushHistory(annotationsRef.current);
        } else if (POLY_TYPES.includes(d.type)) {
            if (movedRef.current) {
                // a drag gesture → finish as straight stroke ending at release point
                finishPolyline(false);
            } else if (justStartedRef.current) {
                // first click only sets the start; keep drawing (preview will track the cursor)
                justStartedRef.current = false;
            } else {
                // subsequent click → fix a vertex and add a fresh preview
                const p = downPosRef.current;
                d.points = [...d.points.slice(0, -2), p.x, p.y, p.x, p.y];
                const fx = d.points[0], fy = d.points[1];
                if (d.points.length >= 8 && dist(p.x, p.y, fx, fy) < 12) { finishPolyline(true); return; }
                applyAnnotations(annotationsRef.current.map((a) => (a.id === d.id ? { ...d } : a)));
            }
        }
    };

    const handleClick = () => {
        if (editing) return;
        const pos = pointer();
        if (!pos) return;
        const u = utilityRef.current;
        if (tool === 'text' || tool === 'textbox') {
            const ann = { id: nextId(), type: tool, utility: u, x: pos.x, y: pos.y, text: '', fontSize };
            applyAnnotations([...annotationsRef.current, ann]);
            setTool('select');
            startEditing(ann, true);
        }
    };

    const handleDblClick = () => {
        if ((tool === 'line' || tool === 'arrow') && drawingRef.current) finishPolyline(true);
    };

    // Vertex editing for selected poly shapes
    const moveVertex = (ann, vi, absX, absY, record) => {
        const pts = [...ann.points];
        pts[vi * 2] = absX - ann.x;
        pts[vi * 2 + 1] = absY - ann.y;
        updateAnnotation(ann.id, { points: pts }, record);
    };

    const removeVertex = (ann, vi) => {
        if (ann.points.length <= 4) return;
        const pts = ann.points.filter((_, idx) => idx !== vi * 2 && idx !== vi * 2 + 1);
        updateAnnotation(ann.id, { points: pts }, true);
    };

    const insertVertexOnShape = (ann) => {
        const p = pointer();
        if (!p) return;
        const lx = p.x - ann.x, ly = p.y - ann.y;
        const pts = ann.points;
        let best = 2, bestD = Infinity;
        for (let i = 0; i < pts.length - 2; i += 2) {
            const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2;
            const d = dist(lx, ly, mx, my);
            if (d < bestD) { bestD = d; best = i + 2; }
        }
        updateAnnotation(ann.id, { points: [...pts.slice(0, best), lx, ly, ...pts.slice(best)] }, true);
    };

    // Keyboard
    useEffect(() => {
        const onKey = (e) => {
            if (editing) return;
            if (e.key === 'Enter') { if (drawingRef.current) { e.preventDefault(); finishPolyline(true); } }
            else if (e.key === 'Escape') { if (drawingRef.current) cancelDrawing(); else setSelectedId(null); }
            else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteSelected(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing, selectedId, labelEnds, fontSize]);

    // Save: flatten to PNG without UI handles
    const handleSave = () => {
        if (drawingRef.current) finishPolyline(true);
        setSelectedId(null);
        if (trRef.current) trRef.current.nodes([]);
        const stage = stageRef.current;
        const uiLayer = stage.findOne('.ui-layer');
        if (uiLayer) uiLayer.hide();
        const pixelRatio = view.scale ? 1 / view.scale : 1;
        const dataUrl = annotationsRef.current.length === 0
            ? photo.src
            : stage.toDataURL({ pixelRatio, mimeType: 'image/jpeg', quality: 0.92 });
        if (uiLayer) uiLayer.show();
        onSave({ annotations: annotationsRef.current, flattenedDataUrl: dataUrl, lastUtility: utility });
    };

    // Shape rendering
    const commonProps = (ann) => ({
        id: ann.id,
        name: 'annotation',
        draggable: tool === 'select',
        onClick: (e) => { if (tool === 'select') { e.cancelBubble = true; setSelectedId(ann.id); } },
        onTap: (e) => { if (tool === 'select') { e.cancelBubble = true; setSelectedId(ann.id); } },
        onDragEnd: (e) => updateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() }, true),
    });

    const renderShape = (ann) => {
        if (editing && editing.id === ann.id) return null;
        const u = getUtility(ann.utility);
        if (ann.type === 'pen' || ann.type === 'line') {
            return <Line key={ann.id} {...commonProps(ann)} x={ann.x} y={ann.y} points={ann.points}
                stroke={u.color} strokeWidth={ann.strokeWidth} lineCap="round" lineJoin="round"
                tension={ann.type === 'pen' ? 0.4 : 0} hitStrokeWidth={Math.max(14, ann.strokeWidth + 10)}
                onDblClick={() => tool === 'select' && insertVertexOnShape(ann)} />;
        }
        if (ann.type === 'arrow') {
            return <Arrow key={ann.id} {...commonProps(ann)} x={ann.x} y={ann.y} points={ann.points}
                stroke={u.color} fill={u.color} strokeWidth={ann.strokeWidth}
                pointerLength={Math.max(12, ann.strokeWidth * 2.4)} pointerWidth={Math.max(12, ann.strokeWidth * 2.4)}
                lineCap="round" lineJoin="round" hitStrokeWidth={Math.max(14, ann.strokeWidth + 10)}
                onDblClick={() => tool === 'select' && insertVertexOnShape(ann)} />;
        }
        if (ann.type === 'rect') {
            return <Rect key={ann.id} {...commonProps(ann)} x={ann.x} y={ann.y} width={ann.width} height={ann.height}
                rotation={ann.rotation || 0} stroke={u.color} strokeWidth={ann.strokeWidth}
                fill={ann.fill ? withAlpha(u.color, 0.28) : 'transparent'} cornerRadius={4}
                onTransformEnd={(e) => {
                    const n = e.target; const sx = n.scaleX(), sy = n.scaleY(); n.scaleX(1); n.scaleY(1);
                    updateAnnotation(ann.id, { x: n.x(), y: n.y(), width: Math.max(5, n.width() * sx), height: Math.max(5, n.height() * sy), rotation: n.rotation() }, true);
                }} />;
        }
        if (ann.type === 'ellipse') {
            return <Ellipse key={ann.id} {...commonProps(ann)} x={ann.x} y={ann.y} radiusX={ann.radiusX} radiusY={ann.radiusY}
                rotation={ann.rotation || 0} stroke={u.color} strokeWidth={ann.strokeWidth}
                fill={ann.fill ? withAlpha(u.color, 0.28) : 'transparent'}
                onTransformEnd={(e) => {
                    const n = e.target; const sx = n.scaleX(), sy = n.scaleY(); n.scaleX(1); n.scaleY(1);
                    updateAnnotation(ann.id, { x: n.x(), y: n.y(), radiusX: Math.max(4, n.radiusX() * sx), radiusY: Math.max(4, n.radiusY() * sy), rotation: n.rotation() }, true);
                }} />;
        }
        if (ann.type === 'text') {
            return <Text key={ann.id} {...commonProps(ann)} x={ann.x} y={ann.y} text={ann.text || ' '}
                fontSize={ann.fontSize} fontStyle="bold" fill={u.color} stroke="#000000" strokeWidth={0.5}
                onDblClick={() => startEditing(ann)} onDblTap={() => startEditing(ann)} />;
        }
        return <Label key={ann.id} {...commonProps(ann)} x={ann.x} y={ann.y}
            onDblClick={() => startEditing(ann)} onDblTap={() => startEditing(ann)}>
            <Tag fill={u.color} cornerRadius={4} stroke="#00000044" strokeWidth={1} />
            <Text text={ann.text || ' '} fontSize={ann.fontSize} fontStyle="bold" fill={u.text} padding={7} lineHeight={1.2} />
        </Label>;
    };

    const showVertices = tool === 'select' && selected && POLY_TYPES.includes(selected.type);
    const activeUtil = getUtility(utility);
    const swatchTextColor = activeUtil.color === '#FFFF00' ? '#b59b00' : activeUtil.color;
    const isPoly = tool === 'line' || tool === 'arrow';

    return (
        <div className="annotator-overlay" onMouseDown={(e) => { if (e.target.classList.contains('annotator-overlay')) onCancel(); }}>
            <div className="annotator-modal">
                <div className="annotator-toolbar">
                    <div className="tool-group">
                        {TOOLS.map((t) => (
                            <button key={t.id} type="button" title={t.label}
                                className={`tool-btn ${tool === t.id ? 'active' : ''}`}
                                onClick={() => { if (drawingRef.current) cancelDrawing(); setTool(t.id); setSelectedId(null); }}>
                                <FontAwesomeIcon icon={t.icon} />
                            </button>
                        ))}
                    </div>

                    <div className="tool-divider" />

                    <div className="tool-group swatches">
                        {UTILITIES.map((u) => (
                            <button key={u.key} type="button" title={`${u.label} (${u.code})`}
                                className={`swatch ${utility === u.key ? 'active' : ''}`}
                                style={{ background: u.color }} onClick={() => setUtility(u.key)} />
                        ))}
                    </div>

                    <div className="tool-divider" />

                    <div className="tool-group">
                        <label className="range-control" title="Stroke width">
                            <FontAwesomeIcon icon={faPen} />
                            <input type="range" min="1" max="20" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
                        </label>
                        <label className="range-control" title="Font size">
                            <FontAwesomeIcon icon={faFont} />
                            <input type="range" min="10" max="60" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
                        </label>
                        <button type="button" className={`toggle-btn ${fillShapes ? 'on' : ''}`} title="Fill shapes" onClick={() => setFillShapes((v) => !v)}>
                            <FontAwesomeIcon icon={faFillDrip} /> Fill
                        </button>
                        <button type="button" className={`toggle-btn ${labelEnds ? 'on' : ''}`} title="Add a text box at the end of each line/arrow" onClick={() => setLabelEnds((v) => !v)}>
                            <FontAwesomeIcon icon={faTag} /> End label
                        </button>
                    </div>

                    <div className="tool-divider" />

                    <div className="tool-group">
                        <button type="button" className="tool-btn" title="Undo" onClick={undo} disabled={histIndex === 0}><FontAwesomeIcon icon={faRotateLeft} /></button>
                        <button type="button" className="tool-btn" title="Redo" onClick={redo} disabled={histIndex >= history.length - 1}><FontAwesomeIcon icon={faRotateRight} /></button>
                        <button type="button" className="tool-btn" title="Duplicate selected" onClick={duplicateSelected} disabled={!selectedId}><FontAwesomeIcon icon={faClone} /></button>
                        <button type="button" className="tool-btn danger" title="Delete selected (Del)" onClick={deleteSelected} disabled={!selectedId}><FontAwesomeIcon icon={faTrash} /></button>
                        <button type="button" className="tool-btn danger" title="Clear all" onClick={clearAll} disabled={!annotations.length}><FontAwesomeIcon icon={faEraser} /></button>
                    </div>

                    <div className="tool-group right">
                        <button type="button" className="annotator-btn cancel" onClick={onCancel}><FontAwesomeIcon icon={faXmark} /> Cancel</button>
                        <button type="button" className="annotator-btn save" onClick={handleSave} disabled={!img}><FontAwesomeIcon icon={faCheck} /> Done</button>
                    </div>
                </div>

                <div className="annotator-hint">
                    <span>Active: <strong style={{ color: swatchTextColor }}>{activeUtil.label}</strong></span>
                    {isPoly
                        ? <span><strong>Drag</strong> for a straight line, or <strong>click</strong> multiple points and press <kbd>Enter</kbd> / double-click to finish. Select it later to drag, add (double-click) or remove (double-click handle) vertices.</span>
                        : <span>Pick a tool and draw. Double-click text to edit; drag the handles to resize/reshape.</span>}
                </div>

                <div className="annotator-canvas">
                    {img && (
                        <Stage ref={stageRef} width={view.width} height={view.height}
                            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
                            onClick={handleClick} onDblClick={handleDblClick}
                            onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
                            style={{ cursor: tool === 'select' ? 'default' : 'crosshair', background: '#000' }}>
                            <Layer>
                                <KImage image={img} width={view.width} height={view.height} name="bg" />
                                {annotations.map(renderShape)}
                            </Layer>
                            <Layer name="ui-layer">
                                <Transformer ref={trRef}
                                    rotateEnabled={!!(selected && BOX_TYPES.includes(selected.type))}
                                    resizeEnabled={!!(selected && BOX_TYPES.includes(selected.type))}
                                    anchorStroke="#2563eb" anchorFill="#fff" borderStroke="#2563eb" borderStrokeWidth={2} />
                                {showVertices && selected.points.map((_, idx) => {
                                    if (idx % 2 !== 0) return null;
                                    const vi = idx / 2;
                                    return (
                                        <Circle key={vi} x={selected.x + selected.points[idx]} y={selected.y + selected.points[idx + 1]}
                                            radius={7} fill="#ffffff" stroke="#2563eb" strokeWidth={2} draggable
                                            onDragMove={(e) => moveVertex(selected, vi, e.target.x(), e.target.y(), false)}
                                            onDragEnd={(e) => moveVertex(selected, vi, e.target.x(), e.target.y(), true)}
                                            onDblClick={() => removeVertex(selected, vi)}
                                            onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'move'; }}
                                            onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default'; }} />
                                    );
                                })}
                            </Layer>
                        </Stage>
                    )}
                </div>
            </div>

            {editing && (
                <textarea ref={editRef} className="inline-text-editor"
                    style={{ left: editing.left, top: editing.top, fontSize: editing.fontSize, color: editing.color, background: editing.bg }}
                    value={editing.value}
                    onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))}
                    onBlur={commitEditing}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditing(); }
                        else if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
                    }}
                    placeholder="Type…" />
            )}
        </div>
    );
};

export default PhotoAnnotator;
