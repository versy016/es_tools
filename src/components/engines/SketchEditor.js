import React, { useRef, useState } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faEraser, faRotateLeft, faRotateRight, faTrash, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { UTILITIES } from '../../report/legendColors';

// Engine: react-sketch-canvas — simple, reliable freehand drawing over the photo.
const SketchEditor = ({ photo, onSave, onClose }) => {
    const ref = useRef(null);
    const [color, setColor] = useState('#0000FF');
    const [width, setWidth] = useState(5);
    const [erase, setErase] = useState(false);

    const setEraser = (on) => { setErase(on); if (ref.current) ref.current.eraseMode(on); };

    const done = async () => {
        try {
            const dataUrl = await ref.current.exportImage('png');
            onSave({ flattenedDataUrl: dataUrl });
        } catch (e) {
            console.error(e);
            onClose();
        }
    };

    return (
        <div className="eng-overlay">
            <div className="eng-modal">
                <div className="eng-toolbar">
                    <button className={`eng-btn ${!erase ? 'on' : ''}`} onClick={() => setEraser(false)} title="Draw"><FontAwesomeIcon icon={faPen} /></button>
                    <button className={`eng-btn ${erase ? 'on' : ''}`} onClick={() => setEraser(true)} title="Erase"><FontAwesomeIcon icon={faEraser} /></button>
                    <span className="eng-divider" />
                    <span className="eng-swatches">
                        {UTILITIES.map((u) => (
                            <button key={u.key} className={`eng-swatch ${color === u.color ? 'on' : ''}`} style={{ background: u.color }}
                                title={u.label} onClick={() => { setColor(u.color); setEraser(false); }} />
                        ))}
                        <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setEraser(false); }} title="Custom colour" />
                    </span>
                    <span className="eng-divider" />
                    <label className="eng-range">W<input type="range" min="1" max="30" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
                    <button className="eng-btn" onClick={() => ref.current && ref.current.undo()} title="Undo"><FontAwesomeIcon icon={faRotateLeft} /></button>
                    <button className="eng-btn" onClick={() => ref.current && ref.current.redo()} title="Redo"><FontAwesomeIcon icon={faRotateRight} /></button>
                    <button className="eng-btn danger" onClick={() => ref.current && ref.current.clearCanvas()} title="Clear"><FontAwesomeIcon icon={faTrash} /></button>
                    <span className="eng-spacer" />
                    <button className="eng-action cancel" onClick={onClose}><FontAwesomeIcon icon={faXmark} /> Cancel</button>
                    <button className="eng-action save" onClick={done}><FontAwesomeIcon icon={faCheck} /> Done</button>
                </div>
                <div className="eng-stage">
                    <ReactSketchCanvas
                        ref={ref}
                        width="100%"
                        height="100%"
                        style={{ border: 'none' }}
                        canvasColor="transparent"
                        backgroundImage={photo.src}
                        exportWithBackgroundImage
                        preserveBackgroundImageAspectRatio="xMidYMid meet"
                        strokeColor={color}
                        strokeWidth={width}
                        eraserWidth={width}
                    />
                </div>
            </div>
        </div>
    );
};

export default SketchEditor;
