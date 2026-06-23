import React, { Suspense, lazy, useState } from 'react';
import '../stylessheets/engines.css';

// Annotation engines, lazy-loaded so each library only downloads when selected.
const KonvaEngine = lazy(() => import('./PhotoAnnotator'));
const ExcalidrawEngine = lazy(() => import('./engines/ExcalidrawEditor'));

const ENGINES = [
    { id: 'konva', name: 'Custom', Comp: KonvaEngine },
    { id: 'excalidraw', name: 'Excalidraw', Comp: ExcalidrawEngine },
];

const STORE_KEY = 'es_tools_annot_engine';

// Wraps every annotation engine and lets the user switch between them live on the
// same photo. Each engine reports back via onSave({ flattenedDataUrl, ... }).
const AnnotatorSwitch = ({ photo, onSave, onClose }) => {
    const [engineId, setEngineId] = useState(() => {
        const saved = localStorage.getItem(STORE_KEY);
        return ENGINES.some((e) => e.id === saved) ? saved : 'konva';
    });
    const eng = ENGINES.find((e) => e.id === engineId) || ENGINES[0];
    const Comp = eng.Comp;

    const choose = (id) => { localStorage.setItem(STORE_KEY, id); setEngineId(id); };

    return (
        <>
            <Suspense fallback={<div className="eng-overlay"><div className="eng-loading">Loading {eng.name}…</div></div>}>
                {/* Konva uses onCancel; the others use onClose — pass both. */}
                <Comp key={engineId} photo={photo} onSave={onSave} onClose={onClose} onCancel={onClose} />
            </Suspense>

            <div className="engine-switch" role="tablist" aria-label="Annotation engine">
                <span className="engine-switch-label">Engine</span>
                {ENGINES.map((e) => (
                    <button key={e.id} type="button" className={`engine-chip ${e.id === engineId ? 'on' : ''}`}
                        onClick={() => choose(e.id)}>{e.name}</button>
                ))}
            </div>
        </>
    );
};

export default AnnotatorSwitch;
