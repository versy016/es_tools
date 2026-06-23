import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Canvas signature pad. Parent drives Clear / Save / Upload via the ref:
//   ref.current.clear() / isEmpty() / toDataURL() / fromDataURL(url)
const SignaturePad = forwardRef(({ height = 180 }, ref) => {
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const dirty = useRef(false);
    const last = useRef({ x: 0, y: 0 });

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

    const pos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return { x: p.clientX - rect.left, y: p.clientY - rect.top };
    };

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
