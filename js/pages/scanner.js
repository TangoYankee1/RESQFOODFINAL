import { getProfile } from '../auth.js';
import { parseDonationQr } from '../db.js';
import { startScanner, stopScanner } from '../qr-scanner.js';
import { navigate } from '../router.js';

export function renderScanner(root) {
  const profile = getProfile();
  if (!profile || profile.role !== 'Volunteer') {
    navigate('/dashboard');
    return;
  }

  root.innerHTML = `
    <section class="container dashboard">
      <h1>Scan QR code</h1>
      <p>Point your camera at a ResQFood donation QR. Uses <strong>jsQR</strong> and <strong>getUserMedia</strong>.</p>
      <div id="scan-error" class="alert alert--error hidden"></div>
      <div class="scanner-wrap">
        <video id="scanner-video" playsinline muted aria-label="Camera preview"></video>
        <canvas id="scanner-canvas"></canvas>
      </div>
      <div id="scan-result" class="scan-result hidden"></div>
      <p style="margin-top:1.5rem;">
        <button type="button" class="btn btn--ghost" id="btn-stop-scan">Stop camera</button>
        <a href="#/dashboard" class="btn btn--outline" data-nav style="margin-left:0.5rem;">Dashboard</a>
      </p>
    </section>
  `;

  const video = root.querySelector('#scanner-video');
  const canvas = root.querySelector('#scanner-canvas');
  const resultEl = root.querySelector('#scan-result');
  const errEl = root.querySelector('#scan-error');
  let handled = false;

  startScanner(video, canvas, (data) => {
    if (handled) return;
    const donationId = parseDonationQr(data);
    resultEl.classList.remove('hidden');
    resultEl.textContent = donationId
      ? `Donation detected: ${donationId}`
      : `Scanned: ${data}`;

    if (donationId) {
      handled = true;
      stopScanner(video);
      setTimeout(() => navigate(`/donations/${donationId}`), 800);
    }
  }).catch((err) => {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  });

  root.querySelector('#btn-stop-scan').addEventListener('click', () => {
    stopScanner(video);
  });

  return () => {
    stopScanner(video);
  };
}
