/**
 * Compresses and resizes an image file to a JPEG of max `maxDim` pixels
 * on the longest side and target quality. Returns a base64 data URL.
 * Keeps SVGs untouched (returned as-is).
 */
export function compressImage(
  file: File,
  maxDim = 400,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // SVG: pass through unchanged
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);

        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas 2d context unavailable")); return; }
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
