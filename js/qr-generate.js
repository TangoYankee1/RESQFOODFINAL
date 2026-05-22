const QRCODE_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

let loaded = false;

function loadQrcodeLib() {
  if (loaded && window.QRCode) return Promise.resolve();
  if (window.QRCode) {
    loaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = QRCODE_CDN;
    script.async = true;
    script.onload = () => {
      loaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load qrcode.js from CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Render a QR code into containerEl using qrcode.js (CDN).
 * @param {HTMLElement} containerEl
 * @param {string} text
 */
export async function renderQrCode(containerEl, text) {
  await loadQrcodeLib();
  containerEl.innerHTML = '';
  // eslint-disable-next-line no-undef
  new QRCode(containerEl, {
    text,
    width: 256,
    height: 256,
    colorDark: '#23501e',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}
