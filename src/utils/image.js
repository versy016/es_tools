// Downscale an image (data URL) so its longest side is at most maxDim, returning a
// JPEG data URL. Falls back to the original on any error or if it's already small.
// Used for pothole thumbnails: full-resolution phone photos (10–12 MP) are slow to
// decode/render and bloat state + the report, yet potholes render tiny — so a ~1000px
// copy is plenty and decodes several times faster.
export const downscaleImage = (src, maxDim = 1000, quality = 0.82) => new Promise((resolve) => {
    try {
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth, h = img.naturalHeight;
            if (!w || !h) { resolve(src); return; }
            const scale = Math.min(1, maxDim / Math.max(w, h));
            if (scale === 1) { resolve(src); return; }   // already within bounds
            const cw = Math.round(w * scale), ch = Math.round(h * scale);
            const canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    } catch (e) {
        resolve(src);
    }
});
