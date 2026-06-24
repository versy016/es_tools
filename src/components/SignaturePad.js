import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Canvas signature pad. Parent drives Clear / Save / Upload via the ref:
//   ref.current.clear() / isEmpty() / toDataURL() / fromDataURL(url)
const SignaturePad = forwardRef(({ height = 180 }, ref) => {
    const canvasRef = useRef(null);
    const drawing = useRef(false);          // is a stroke in progress (pointer down)?
    const dirty = useRef(false);            // has anything been drawn? backs isEmpty()
    const last = useRef({ x: 0, y: 0 });    // previous point, for drawing line segments

    // Fresh 2D context with the pen style. Re-fetched per stroke so the style
    // survives the DPR scale applied in resize().
    const ctxOf = () => {
        const c = canvasRef.current;
        const ctx = c.getContext('2d');
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = '#1B2230';
        return ctx;
    };

    // Size the canvas backing store to its display box for crisp lines.
    const resize = () => {
        const c = canvasRef.current;
        if (!c) return;
        const rect = c.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        c.width = rect.width * ratio;
        c.height = rect.height * ratio;
        const ctx = c.getContext('2d');
        ctx.scale(ratio, ratio);
    };

    useEffect(() => {
        resize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Pointer position in CSS pixels relative to the canvas (unifies mouse + touch).
    // The context is DPR-scaled, so these CSS-px coords map correctly to the backing store.
    const pos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return { x: p.clientX - rect.left, y: p.clientY - rect.top };
    };

    // Draw by connecting successive pointer positions with short line segments.
    // preventDefault stops touch scrolling while signing. dirty flips true on first move.
    const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
    const move = (e) => {
        if (!drawing.current) return;
        e.preventDefault();
        const ctx = ctxOf();
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
        dirty.current = true;
    };
    const end = () => { drawing.current = false; };

    // Imperative API exposed to the parent via ref: clear the pad, query emptiness,
    // export the drawing as a PNG data URL, or load an existing signature image back
    // in (used for upload-image fallback and re-editing a saved signature).
    useImperativeHandle(ref, () => ({
        clear: () => {
            const c = canvasRef.current;
            c.getContext('2d').clearRect(0, 0, c.width, c.height);
            dirty.current = false;
        },
        isEmpty: () => !dirty.current,
        toDataURL: () => canvasRef.current.toDataURL('image/png'),
        fromDataURL: (url) => {
            const c = canvasRef.current;
            const ctx = c.getContext('2d');
            const img = new window.Image();
            img.onload = () => {
                const rect = c.getBoundingClientRect();
                ctx.clearRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
                dirty.current = true;
            };
            img.src = url;
        },
    }));

    return (
        <canvas ref={canvasRef} className="signature-canvas" style={{ height }}
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
    );
});

export default SignaturePad;
