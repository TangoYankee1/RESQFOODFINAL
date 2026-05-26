// QR payload builder and renderer
// Requires qrcode.js loaded globally: https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js

/**
 * Checksum: first 4 chars of base64( donationId + donorId + foodType + quantityKg + salt )
 */
function buildChecksum(donationId, donorId, foodType, quantityKg) {
  const raw = donationId + donorId + foodType + String(quantityKg) + 'RESQFOOD2026';
  return btoa(raw).slice(0, 4);
}

/**
 * Build the JSON string that gets encoded in the QR.
 * Schema v1: { v, d, o, t, f, q, c }
 */
export function buildPayload(donationId, donorId, foodType, quantityKg) {
  const payload = {
    v: 1,
    d: donationId,
    o: donorId,
    t: Math.floor(Date.now() / 1000),
    f: foodType,
    q: Number(quantityKg),
    c: buildChecksum(donationId, donorId, foodType, quantityKg),
  };
  return JSON.stringify(payload);
}

/**
 * Render a QR code into containerId using qrcode.js.
 * Clears the container first so it's idempotent.
 */
export function generateQR(containerId, payloadString) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`QR container #${containerId} not found`);
  container.innerHTML = '';

  if (typeof QRCode === 'undefined') {
    container.textContent = 'QR library hindi na-load. Subukan muli.';
    return;
  }

  new QRCode(container, {
    text:          payloadString,
    width:         256,
    height:        256,
    colorDark:     '#00193c',
    colorLight:    '#ffffff',
    correctLevel:  QRCode.CorrectLevel.M,
  });
}

/** Generate a random 4-digit numeric PIN */
export function generateFallbackPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Generate a UUID v4 (used as donation document ID) */
export function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
