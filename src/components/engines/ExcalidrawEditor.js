import React, { useState, useCallback } from 'react';
import { Excalidraw, exportToBlob, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';

// Engine: Excalidraw — full whiteboard (shapes, arrows, text, freehand) over the photo.
const ExcalidrawEditor = ({ photo, onSave, onClose }) => {
    const [api, setApi] = useState(null);

    // Once Excalidraw hands us its imperative API, load the photo as the bottom
    // layer: register it as a scene "file", insert a single image element capped to
    // 900px, and mark it locked so the user can't move/resize/delete the background
    // while drawing on top. Then fit the viewport to it.
    const onApi = useCallback((a) => {
        setApi(a);
        const img = new window.Image();
        img.onload = () => {
            const max = 900;
            const scale = Math.min(max / img.width, max / img.height, 1);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const fileId = `photo_${Date.now()}`;
            try {
                a.addFiles([{ id: fileId, dataURL: photo.src, mimeType: 'image/jpeg', created: Date.now() }]);
                const els = convertToExcalidrawElements([{ type: 'image', fileId, x: 0, y: 0, width: w, height: h, locked: true }]);
                a.updateScene({ elements: els });
                a.scrollToContent(els, { fitToContent: true });
            } catch (e) { console.error('excalidraw load', e); }
        };
        img.src = photo.src;
    }, [photo.src]);

    // Save: flatten the whole scene (photo + annotations) to a PNG blob, then read it
    // as a data URL and report it up via onSave — the shape the rest of the app
    // expects. Any failure falls back to closing without saving.
    const done = async () => {
        if (!api) { onClose(); return; }
        try {
            const blob = await exportToBlob({
                elements: api.getSceneElements(),
                appState: { exportBackground: true, viewBackgroundColor: '#ffffff' },
                files: api.getFiles(),
                mimeType: 'image/png',
            });
            const reader = new FileReader();
            reader.onload = () => onSave({ flattenedDataUrl: reader.result });
            reader.readAsDataURL(blob);
        } catch (e) {
            console.error(e);
            onClose();
        }
    };

    return (
        <div className="eng-overlay">
            <div className="eng-modal">
                <div className="eng-toolbar">
                    <span className="eng-title">Excalidraw — draw on the photo, then Done</span>
                    <span className="eng-spacer" />
                    <button className="eng-action cancel" onClick={onClose}><FontAwesomeIcon icon={faXmark} /> Cancel</button>
                    <button className="eng-action save" onClick={done}><FontAwesomeIcon icon={faCheck} /> Done</button>
                </div>
                <div className="eng-stage" style={{ padding: 0 }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <Excalidraw excalidrawAPI={onApi} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExcalidrawEditor;
