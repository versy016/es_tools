import React, { useEffect, useRef } from 'react';
import ImageEditor from 'tui-image-editor';
import 'tui-image-editor/dist/tui-image-editor.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';

// Engine: Toast UI Image Editor — draw, shapes, arrows/icons, text, crop, filters.
const TuiEditor = ({ photo, onSave, onClose }) => {
    const rootRef = useRef(null);
    const editorRef = useRef(null);

    useEffect(() => {
        const instance = new ImageEditor(rootRef.current, {
            includeUI: {
                loadImage: { path: photo.src, name: 'photo' },
                menu: ['draw', 'shape', 'text', 'icon', 'crop', 'flip', 'rotate', 'filter'],
                initMenu: 'draw',
                menuBarPosition: 'left',
                uiSize: { width: '100%', height: '100%' },
            },
            cssMaxWidth: 1400,
            cssMaxHeight: 900,
            usageStatistics: false,
        });
        editorRef.current = instance;
        return () => { try { instance.destroy(); } catch (e) { /* ignore */ } };
    }, [photo.src]);

    const done = () => {
        try {
            const dataUrl = editorRef.current.toDataURL();
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
                    <span className="eng-title">Toast UI — use the left tools, then Done</span>
                    <span className="eng-spacer" />
                    <button className="eng-action cancel" onClick={onClose}><FontAwesomeIcon icon={faXmark} /> Cancel</button>
                    <button className="eng-action save" onClick={done}><FontAwesomeIcon icon={faCheck} /> Done</button>
                </div>
                <div className="eng-stage tui-stage" style={{ padding: 0 }}>
                    <div ref={rootRef} style={{ width: '100%', height: '100%' }} />
                </div>
            </div>
        </div>
    );
};

export default TuiEditor;
