import { bootGuardedPage } from './guard-boot.js';
import { verifyScannedPayload, confirmHandover, verifyFailureMessage } from './verification.js';
import { fetchDoc } from './data.js';
import { toast } from './ui.js';
import { esc } from './utils.js';
import { loadOrganizationSession } from './organization.js';

// Same screen behavior for volunteer pickup and organization receipt.
export function initHandoverScreen(purpose) {
  const pickup = purpose === 'pickup';
  const $ = id => document.getElementById(id);
  const visible = (id, show) => $(id)?.classList.toggle('hidden', !show);
  const successId = pickup ? 'scan-success' : 'verify-success';
  const confirmId = pickup ? 'btn-confirm-pickup' : 'btn-confirm-verify';
  const urlId = new URLSearchParams(location.search).get('donationId');
  let camera, pending, busy = false, decoding = false, revision = 0, completed = false;

  bootGuardedPage({ roles: [pickup ? 'volunteer' : 'orgAdmin'] }, async session => {
    let deviceMode = 'standard';
    if (!pickup) {
      const access = await loadOrganizationSession(session);
      if (!access.active) {
        document.querySelector('main').textContent = access.message;
        return;
      }
      deviceMode = access.org.mode;
    } else {
      const profile = await fetchDoc(`users/${session.user.uid}`);
      if (profile?.status !== 'active') {
        document.querySelector('main').textContent = 'Kailangan ang aktibong volunteer account para sa pickup.';
        return;
      }
    }
    $('btn-start-scan')?.addEventListener('click', startCamera);
    $('btn-cancel-scan')?.addEventListener('click', reset);
    $('btn-scan-again')?.addEventListener('click', startCamera);
    $(confirmId)?.addEventListener('click', () => commit(pending));
    $('btn-confirm-pin')?.addEventListener('click', () => {
      const donationId = urlId || $('pin-donation-id')?.value.trim();
      const proof = Array.from(document.querySelectorAll('.pin-inputs .pin-digit'), el => el.value).join('');
      commit({ donationId, purpose, mode: 'pin', proof });
    });
    document.querySelectorAll('.pin-inputs .pin-digit').forEach((input, index, inputs) => input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(-1);
      if (input.value) inputs[index+1]?.focus();
      $('btn-confirm-pin').disabled = busy || !Array.from(inputs).every(el => el.value);
    }));
    if (urlId && $('pin-donation-id')) { $('pin-donation-id').value = urlId; $('pin-donation-id').readOnly = true; }
    $('btn-mode-qr')?.addEventListener('click', () => mode(true));
    $('btn-mode-pin')?.addEventListener('click', () => mode(false));
    $('btn-back')?.addEventListener('click', () => history.back());
    $('btn-scan-next')?.addEventListener('click', () => { location.href = urlId ? `active-mission.html?donationId=${encodeURIComponent(urlId)}` : 'index.html'; });
    $('btn-verify-next')?.addEventListener('click', () => { location.href = 'index.html'; });
    $('btn-preview-qr')?.addEventListener('click', () => preview($('qr-proof-text')?.value || ''));
    window.addEventListener('pagehide', stopCamera, { once: true });
    $(confirmId).disabled = true;
    if (!pickup && deviceMode === 'basic') await mode(false);
  });

  async function stopCamera() { if (camera) { try { await camera.stop(); } catch (_) {} camera = null; } }
  async function reset() {
    if (busy) return;
    revision++; completed = false;
    await stopCamera(); pending = null; decoding = false;
    $(confirmId).disabled = true;
    if ($('pin-error')) $('pin-error').textContent = '';
    visible('scan-result', false); visible('qr-reader-wrap', false); visible(successId, false); visible('camera-prompt', true);
    visible('qr-mode', true); visible('pin-mode', false);
    visible('pickup-pin-mode', true);
  }
  async function mode(qr) {
    if (busy) return;
    await reset(); visible('qr-mode', qr); visible('pin-mode', !qr);
    $('btn-mode-qr')?.classList.toggle('active', qr); $('btn-mode-pin')?.classList.toggle('active', !qr);
  }
  async function startCamera() {
    if (busy) return;
    await reset();
    if (typeof Html5Qrcode === 'undefined') { toast('Hindi na-load ang camera library. Gamitin ang PIN.', 'error'); return; }
    visible('camera-prompt', false); visible('qr-reader-wrap', true);
    camera = new Html5Qrcode('qr-reader');
    try { await camera.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, preview, () => {}); }
    catch { await reset(); toast('Hindi mabuksan ang camera. Gamitin ang PIN.', 'error'); }
  }
  async function preview(raw) {
    if (decoding || busy) return;
    const currentRevision = revision;
    decoding = true; await stopCamera(); pending = null; $(confirmId).disabled = true;
    visible('qr-reader-wrap', false); visible('scan-result', true);
    const result = await verifyScannedPayload(raw, { purpose });
    if (currentRevision !== revision) return;
    if (!result.ok || (urlId && result.donationId !== urlId)) {
      $('validity-badge').textContent = verifyFailureMessage(result.reason || 'wrong_purpose_or_donation');
      decoding = false; return;
    }
    try {
      const doc = await fetchDoc(`donations/${result.donationId}`);
      if (currentRevision !== revision) return;
      if (!doc) throw new Error('missing');
      $('result-rows').innerHTML = `<p>${esc(doc.foodType)} · ${esc(doc.quantityKg)} kg</p><p>Donation: ${esc(doc.id)}</p>`;
      $('validity-badge').textContent = 'Valid ang QR. Hindi pa na-confirm ang handover.';
      pending = { donationId: doc.id, purpose, mode: 'qr', proof: raw };
      $(confirmId).disabled = false;
    } catch { $('validity-badge').textContent = 'Hindi makuha ang donation. Subukan muli.'; }
    decoding = false;
  }
  async function commit(input) {
    if (completed || busy || !input?.donationId || !input.proof) { if (!busy && !completed) toast('Ilagay ang donation ID at code.', 'error'); return; }
    busy = true; $(confirmId).disabled = true; if ($('btn-confirm-pin')) $('btn-confirm-pin').disabled = true;
    try {
      const result = await confirmHandover(input);
      if (!result.ok) {
        const message = verifyFailureMessage(result.reason);
        if ($('pin-error')) $('pin-error').textContent = message;
        toast(message, 'error'); return;
      }
      completed = true; pending = null;
      visible('scan-result', false); visible('pin-mode', false); visible('qr-mode', false); visible(successId, true);
      visible('pickup-pin-mode', false);
      if ($('success-summary')) $('success-summary').textContent = `Donation ${result.donationId}: natanggap na.`;
      toast(pickup ? 'Na-confirm ang pickup.' : 'Na-confirm ang pagtanggap.', 'success');
    } catch {
      toast('Hindi ma-confirm ang handover. Suriin ang koneksyon at subukan muli.', 'error');
    } finally {
      busy = false; $(confirmId).disabled = completed || !pending;
      if ($('btn-confirm-pin')) $('btn-confirm-pin').disabled = completed || !Array.from(document.querySelectorAll('.pin-inputs .pin-digit')).every(el => /^\d$/.test(el.value));
    }
  }
}
