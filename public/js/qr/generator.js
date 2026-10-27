// public/js/qr/generator.js
// QR rendering ONLY. Signing happens server-side (functions/lib/signQr.js via
// the issueCredential callable); PINs are issued server-side (issuePin).
// There is no client-side checksum, payload builder, or PIN generator here —
// they would all be forgeable secrets in the browser.

/**
 * Render a QR code into containerId using qrcode.js.
 * `payloadString` MUST come from the server (issueCredential → { payload }).
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

/** Generate a UUID v4 (used as local correlation id before server write) */
export function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
