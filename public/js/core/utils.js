// public/js/core/utils.js
// Pure helpers shared across roles. No DOM, no network — unit-testable.
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatKg(kg) { return `${Number(kg || 0)} kg`; }

export function formatDateTime(value) {
  try {
    const d = value && value.toDate ? value.toDate() : new Date(value);
    return d.toLocaleString('fil-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return String(value ?? '—'); }
}

/** Compress an image file client-side (max 800px, JPEG 0.8) before upload. */
export function compressImage(file, maxDim = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('compress_failed'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode_failed')); };
    img.src = url;
  });
}

export function debounce(fn, ms = 250) {
  let h = null;
  return (...args) => { clearTimeout(h); h = setTimeout(() => fn(...args), ms); };
}

