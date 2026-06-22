import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KImage, Line, Arrow, Text, Label, Tag, Transformer } from 'react-konva';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSlash, faLongArrowAltRight, faFont, faSquare,
    faMousePointer, faTrash, faRotateLeft, faRotateRight, faCheck, faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { UTILITIES, getUtility } from '../report/legendColors';

const MAX_DISPLAY_WIDTH = 820;
let idCounter = 0;
const nextId = () => `ann_${Date.now()}_${idCounter++}`;

// Interactive annotation editor for a single photo.
// Renders a Konva stage over the image; draws lines / arrows / text / text-boxes
// in the fixed utility-legend colours and exports a flattened PNG on save.
const PhotoAnnotator = ({ photo, onSave, onCancel }) => {
    const [img, setImg] = useState(null);
    const [view, setView] = useState({ width: 0, height: 0, scale: 1 });
    const [tool, setTool] = useState('select'); // select | line | arrow | text | textbox
    const [utility, setUtility] = useState(photo.lastUtility || 'water');
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [annotations, setAnnotations] = useState(photo.annotations || []);
    const [selectedId, setSelectedId] = useState(null);
    const [history, setHistory] = useState([photo.annotations || []]);
    const [histIndex, setHistIndex] = useState(0);

    const stageRef = useRef(null);
    const trRef = useRef(null);
    const drawingRef = useRef(null); // in-progress shape
    const annotationsRef = useRef(annotations); // synchronous mirror for event handlers

    // Load the image and compute a display size that fits the editor width.
    useEffect(() => {
        const image = new window.Image();
        image.src = photo.src;
        image.onload = () => {
            const natW = image.naturalWidth;
            const natH = image.naturalHeight;
            const scale = Math.min(1, MAX_DISPLAY_WIDTH / natW);
            setImg(image);
            setView({ width: Math.round(natW * scale), height: Math.round(natH * scale), scale });
        };
    }, [photo.src]);

    // Update annotations state + the synchronous ref mirror (no history entry).
    const applyAnnotations = useCallback((next) => {
        annotationsRef.current = next;
        setAnnotations(next);
    }, []);

    // Record the current annotations onto the undo history.
    const pushHistory = useCallback((next) => {
        setHistory((prev) => [...prev.slice(0, histIndex + 1), next]);
        setHistIndex((i) => i + 1);
    }, [histIndex]);

    // Apply a change and record it (used for discrete edits: text, delete, move...).
    const commit = useCallback((next) => {
        applyAnnotations(next);
        pushHistory(next);
    }, [applyAnnotations, pushHistory]);

    const undo = () => {
        if (histIndex > 0) {
            const i = histIndex - 1;
            setHistIndex(i);
            applyAnnotations(history[i]);
            setSelectedId(null);
        }
    };
    const redo = () => {
        if (histIndex < history.length - 1) {
            const i = histIndex + 1;
            setHistIndex(i);
            applyAnnotations(history[i]);
            setSelectedId(null);
        }
    };

    // Attach the transformer to the selected node.
    useEffect(() => {
        const tr = trRef.current;
        if (!tr || !stageRef.current) return;
        if (tool === 'select' && selectedId) {
            const node = stageRef.current.findOne('#' + selectedId);
            tr.nodes(node ? [node] : []);
        } else {
            tr.nodes([]);
        }
        tr.getLayer() && tr.getLayer().batchDraw();
    }, [selectedId, tool, annotations]);

    const pointer = () => {
        const pos = stageRef.current.getPointerPosition();
        return pos ? { x: pos.x, y: pos.y } : null;
    };

    const handleStageMouseDown = (e) => {
        const pos = pointer();
        if (!pos) return;

        if (tool === 'select') {
            // Clicking empty space (the stage or background image) clears selection.
            if (e.target === stageRef.current || e.target.name() === 'bg') {
                setSelectedId(null);
            }
            return;
        }

        const u = getUtility(utility);
        if (tool === 'line') {
            drawingRef.current = {
                id: nextId(), type: 'line', utility, strokeWidth,
                points: [pos.x, pos.y], x: 0, y: 0,
            };
            applyAnnotations([...annotationsRef.current, drawingRef.current]);
        } else if (tool === 'arrow') {
            drawingRef.current = {
                id: nextId(), type: 'arrow', utility, strokeWidth,
                points: [pos.x, pos.y, pos.x, pos.y], x: 0, y: 0,
            };
            applyAnnotations([...annotationsRef.current, drawingRef.current]);
        } else if (tool === 'text') {
            const text = window.prompt('Label text:', '');
            if (text && text.trim()) {
                commit([...annotationsRef.current, {
                    id: nextId(), type: 'text', utility, text: text.trim(),
                    x: pos.x, y: pos.y, fontSize: 22, color: u.color,
                }]);
            }
        } else if (tool === 'textbox') {
            const text = window.prompt('Text box content (e.g. WATER QLB 0.6,0.8d):', `${u.code} `);
            if (text && text.trim()) {
                commit([...annotationsRef.current, {
                    id: nextId(), type: 'textbox', utility, text: text.trim(),
                    x: pos.x, y: pos.y, fontSize: 18,
                }]);
            }
        }
    };

    const handleStageMouseMove = () => {
        const d = drawingRef.current;
        if (!d) return;
        const pos = pointer();
        if (!pos) return;
        if (d.type === 'line') {
            d.points = [...d.points, pos.x, pos.y];
        } else if (d.type === 'arrow') {
            d.points = [d.points[0], d.points[1], pos.x, pos.y];
        }
        applyAnnotations(annotationsRef.current.map((a) => (a.id === d.id ? { ...d } : a)));
    };

    const handleStageMouseUp = () => {
        const d = drawingRef.current;
        if (!d) return;
        drawingRef.current = null;
        // Drop degenerate shapes (a click with no drag).
        const tooSmall = d.type === 'arrow'
            ? Math.hypot(d.points[2] - d.points[0], d.points[3] - d.points[1]) < 5
            : d.points.length < 4;
        if (tooSmall) {
            applyAnnotations(annotationsRef.current.filter((a) => a.id !== d.id));
            return;
        }
        // Shape is already present in state; just record it on the history.
        pushHistory(annotationsRef.current);
    };

    const updateAnnotation = (id, patch) => {
        commit(annotationsRef.current.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    };

    const deleteSelected = () => {
        if (!selectedId) return;
        commit(annotationsRef.current.filter((a) => a.id !== selectedId));
        setSelectedId(null);
    };

    const editText = (ann) => {
        const text = window.prompt('Edit text:', ann.text);
        if (text !== null) updateAnnotation(ann.id, { text: text.trim() });
    };

    const selectShape = (e, id) => {
        if (tool !== 'select') return;
        e.cancelBubble = true;
        setSelectedId(id);
    };

    // Flatten the stage (without the selection transformer) to a full-resolution PNG.
    const handleSave = () => {
        if (trRef.current) {
            trRef.current.nodes([]);
            trRef.current.getLayer() && trRef.current.getLayer().batchDraw();
        }
        const pixelRatio = view.scale ? 1 / view.scale : 1;
        const dataUrl = annotations.length === 0
            ? photo.src
            : stageRef.current.toDataURL({ pixelRatio, mimeType: 'image/jpeg', quality: 0.9 });
        onSave({ annotations, flattenedDataUrl: dataUrl, lastUtility: utility });
    };

    const renderShape = (ann) => {
        const u = getUtility(ann.utility);
        const common = {
            key: ann.id,
            id: ann.id,
            name: 'annotation',
            draggable: tool === 'select',
            onClick: (e) => selectShape(e, ann.id),
            onTap: (e) => selectShape(e, ann.id),
            onDragEnd: (e) => updateAnnotation(ann.id, { x: e.target.x(), y: e.target.y() }),
        };
        if (ann.type === 'line') {
            return (
                <Line {...common} x={ann.x} y={ann.y} points={ann.points}
                    stroke={u.color} strokeWidth={ann.strokeWidth}
                    lineCap="round" lineJoin="round" tension={0.3}
                    hitStrokeWidth={Math.max(12, ann.strokeWidth + 8)} />
            );
        }
        if (ann.type === 'arrow') {
            return (
                <Arrow {...common} x={ann.x} y={ann.y} points={ann.points}
                    stroke={u.color} fill={u.color} strokeWidth={ann.strokeWidth}
                    pointerLength={Math.max(10, ann.strokeWidth * 2.5)}
                    pointerWidth={Math.max(10, ann.strokeWidth * 2.5)}
                    hitStrokeWidth={Math.max(12, ann.strokeWidth + 8)} />
            );
        }
        if (ann.type === 'text') {
            return (
                <Text {...common} x={ann.x} y={ann.y} text={ann.text}
                    fontSize={ann.fontSize} fontStyle="bold" fill={u.color}
                    stroke="#000000" strokeWidth={0.6}
                    onDblClick={() => editText(ann)} onDblTap={() => editText(ann)} />
            );
        }
        // textbox
        return (
            <Label {...common} x={ann.x} y={ann.y}
                onDblClick={() => editText(ann)} onDblTap={() => editText(ann)}>
                <Tag fill={u.color} cornerRadius={3} stroke="#00000055" strokeWidth={1} />
                <Text text={ann.text} fontSize={ann.fontSize} fontStyle="bold"
                    fill={u.text} padding={6} lineHeight={1.2} />
            </Label>
        );
    };

    return (
        <div className="annotator-overlay" onClick={(e) => { if (e.target.classList.contains('annotator-overlay')) onCancel(); }}>
            <div className="annotator-modal">
                <div className="annotator-toolbar">
                    <div className="tool-group">
                        {[
                            { id: 'select', icon: faMousePointer, label: 'Select / Move' },
                            { id: 'line', icon: faSlash, label: 'Line' },
                            { id: 'arrow', icon: faLongArrowAltRight, label: 'Arrow' },
                            { id: 'text', icon: faFont, label: 'Text' },
                            { id: 'textbox', icon: faSquare, label: 'Text box' },
                        ].map((t) => (
                            <button key={t.id} type="button" title={t.label}
                                className={`tool-btn ${tool === t.id ? 'active' : ''}`}
                                onClick={() => { setTool(t.id); setSelectedId(null); }}>
                                <FontAwesomeIcon icon={t.icon} />
                            </button>
                        ))}
                    </div>

                    <div className="tool-group swatches">
                        {UTILITIES.map((u) => (
                            <button key={u.key} type="button" title={`${u.label} (${u.code})`}
                                className={`swatch ${utility === u.key ? 'active' : ''}`}
                                style={{ background: u.color }}
                                onClick={() => setUtility(u.key)} />
                        ))}
                    </div>

                    <div className="tool-group">
                        <label className="width-control" title="Line width">
                            W
                            <input type="range" min="1" max="14" value={strokeWidth}
                                onChange={(e) => setStrokeWidth(Number(e.target.value))} />
                        </label>
                        <button type="button" className="tool-btn" title="Undo" onClick={undo} disabled={histIndex === 0}>
                            <FontAwesomeIcon icon={faRotateLeft} />
                        </button>
                        <button type="button" className="tool-btn" title="Redo" onClick={redo} disabled={histIndex >= history.length - 1}>
                            <FontAwesomeIcon icon={faRotateRight} />
                        </button>
                        <button type="button" className="tool-btn danger" title="Delete selected" onClick={deleteSelected} disabled={!selectedId}>
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    </div>

                    <div className="tool-group right">
                        <button type="button" className="annotator-btn cancel" onClick={onCancel}>
                            <FontAwesomeIcon icon={faTimes} /> Cancel
                        </button>
                        <button type="button" className="annotator-btn save" onClick={handleSave} disabled={!img}>
                            <FontAwesomeIcon icon={faCheck} /> Done
                        </button>
                    </div>
                </div>

                <div className="annotator-hint">
                    Active utility: <strong style={{ color: getUtility(utility).color === '#FFFF00' ? '#b8a700' : getUtility(utility).color }}>
                        {getUtility(utility).label}</strong>. Pick a tool, then draw on the photo. Double-click text to edit.
                </div>

                <div className="annotator-canvas">
                    {img && (
                        <Stage
                            ref={stageRef}
                            width={view.width}
                            height={view.height}
                            onMouseDown={handleStageMouseDown}
                            onMouseMove={handleStageMouseMove}
                            onMouseUp={handleStageMouseUp}
                            onTouchStart={handleStageMouseDown}
                            onTouchMove={handleStageMouseMove}
                            onTouchEnd={handleStageMouseUp}
                            style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
                        >
                            <Layer>
                                <KImage image={img} width={view.width} height={view.height} name="bg" listening={true} />
                                {annotations.map(renderShape)}
                                <Transformer ref={trRef} rotateEnabled={false} resizeEnabled={false}
                                    borderStroke="#007bff" borderStrokeWidth={2} />
                            </Layer>
                        </Stage>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PhotoAnnotator;
