const JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';

let jsqrLoaded = false;
let activeStream = null;
let scanFrame = null;
let lastScanTime = 0;
const SCAN_COOLDOWN_MS = 2000;

function loadJsQr() {
  if (jsqrLoaded && window.jsQR) return Promise.resolve();
  if (window.jsQR) {
    jsqrLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = JSQR_CDN;
    script.async = true;
    script.onload = () => {
      jsqrLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load jsQR from CDN'));
    document.head.appendChild(script);
  });
}

export async function startScanner(videoEl, canvasEl, onResult) {
  await loadJsQr();

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });

  activeStream = stream;
  videoEl.srcObject = stream;
  await videoEl.play();

  const ctx = canvasEl.getContext('2d', { willReadFrequently: true });

  const tick = () => {
    if (!activeStream) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code?.data) {
        const now = Date.now();
        if (now - lastScanTime >= SCAN_COOLDOWN_MS) {
          lastScanTime = now;
          onResult(code.data);
        }
      }
    }
    scanFrame = requestAnimationFrame(tick);
  };

  scanFrame = requestAnimationFrame(tick);
}

export function stopScanner(videoEl) {
  if (scanFrame) {
    cancelAnimationFrame(scanFrame);
    scanFrame = null;
  }
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }
  if (videoEl) videoEl.srcObject = null;
}

export function scanFromFile(file, onResult) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height);
      onResult(code?.data || null);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
