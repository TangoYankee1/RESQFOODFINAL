import { bootGuardedPage } from '../core/guard-boot.js';
import { watchDocument } from '../core/data.js';
import { issueCredential, issuePin } from '../core/callables.js';
import { generateQR } from '../qr/generator.js';
import { handleError } from '../core/errors.js';
import { toast } from '../core/ui.js';
import { formatDateTime } from '../core/utils.js';

let donation, id, busy = false, initialized = false, pinExpiry, qrExpiry, timer;
const set = (name, value) => { const el = document.getElementById(name); if (el) el.textContent = value; };
const deadline = d => d.pickupWindowEnd?.toDate ? d.pickupWindowEnd.toDate() : new Date(d.pickupWindowEnd);
const canIssue = () => donation && ['pending','scheduled'].includes(donation.status) && deadline(donation) > new Date();

bootGuardedPage({ roles: ['donor'] }, session => {
  const params = new URLSearchParams(location.search);
  id = params.get('donationId') || params.get('donation'); // retain old bookmarks.
  if (!id || id.includes('/')) { set('qr-container', 'Walang valid na donation ID.'); return; }
  document.getElementById('btn-regenerate')?.addEventListener('click', regenerate);
  document.getElementById('btn-copy-link')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(id); toast('Na-copy ang donation ID.', 'success'); }
    catch { toast('Hindi makopya. Donation ID: ' + id, 'error'); }
  });
  document.getElementById('btn-share')?.addEventListener('click', async () => {
    if (!donation) return;
    // Share availability, never the PIN/QR handover secret.
    const data = { title: 'ResQFood', text: `${donation.foodType}, ${donation.quantityKg} kg · Pickup hanggang ${formatDateTime(donation.pickupWindowEnd)} · ID: ${id}` };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.text); toast('Na-copy ang impormasyon.', 'success'); }
    } catch (error) { if (error.name !== 'AbortError') toast('Hindi ma-share ngayon.', 'error'); }
  });
  const unsubscribe = watchDocument(`donations/${id}`, {
    next: doc => {
      if (!doc || doc.donorId !== session.user.uid) { donation = null; clearCredentials(); set('credential-status', 'Hindi mahanap ang donation o wala kang access.'); return; }
      donation = doc;
      set('food-display', `${doc.foodType} · ${doc.quantityKg} kg`);
      set('created-display', `Pickup hanggang ${formatDateTime(doc.pickupWindowEnd)} · ${doc.orgName || ''}`);
      set('credential-status', doc.status === 'pending' ? 'Naghihintay ng volunteer. Ipakita lamang ang code sa naka-assign na volunteer.'
        : doc.status === 'scheduled' ? 'May naka-assign na volunteer. Ipakita ang QR/PIN sa aktuwal na pickup.' : 'Sarado na ang pickup. Wala nang pickup code.');
      if (!canIssue()) clearCredentials();
      else if (!initialized) { initialized = true; regenerate(); }
      document.getElementById('btn-regenerate').disabled = !canIssue() || busy;
    },
    error: error => { clearCredentials(); handleError(error, { scope: 'donor.qr.read' }); set('credential-status', 'Hindi makuha ang donation. I-reload kapag may koneksyon.'); },
  });
  timer = setInterval(tick, 1000);
  window.addEventListener('pagehide', () => { unsubscribe(); clearInterval(timer); }, { once: true });
});

function clearCredentials() {
  set('qr-container', 'Walang aktibong pickup QR.'); set('pin-display', '—');
  set('pin-expiry', ''); set('qr-expiry', ''); pinExpiry = qrExpiry = null;
  const button = document.getElementById('btn-regenerate'); if (button) button.disabled = !canIssue();
}

async function regenerate() {
  if (busy || !canIssue()) return;
  if (!navigator.onLine) { toast('Kumonekta muna bago gumawa ng bagong code.', 'error'); return; }
  busy = true;
  document.getElementById('btn-regenerate').disabled = true;
  set('qr-container', 'Ginagawa ang QR...'); set('pin-display', '...');
  try {
    const credential = await issueCredential({ donationId: id, purpose: 'pickup' });
    if (!credential.success || !canIssue()) throw new Error('Pickup closed');
    qrExpiry = new Date(credential.payload.expiresAt);
    generateQR('qr-container', JSON.stringify(credential.payload));
  } catch (error) { qrExpiry = null; set('qr-container', 'Hindi makagawa ng QR. Subukan muli o gamitin ang PIN.'); handleError(error, { scope: 'donor.qr.issue' }); }
  try {
    const issued = await issuePin({ donationId: id, purpose: 'pickup' });
    if (!canIssue()) throw new Error('Pickup closed');
    pinExpiry = new Date(issued.expiresAt); set('pin-display', issued.pin);
  } catch (error) { pinExpiry = null; set('pin-display', '—'); handleError(error, { scope: 'donor.pin.issue' }); }
  finally { busy = false; document.getElementById('btn-regenerate').disabled = !canIssue(); tick(); }
}

function tick() {
  if (!canIssue()) { clearCredentials(); return; }
  if (pinExpiry) {
    const seconds = Math.max(0, Math.ceil((pinExpiry - new Date()) / 1000));
    set('pin-expiry', seconds ? `PIN: ${Math.floor(seconds/60)}m ${seconds%60}s na lang` : 'Expired ang PIN. Gumawa ng bagong code.');
    if (!seconds) set('pin-display', '—');
  }
  if (qrExpiry) {
    set('qr-expiry', `QR hanggang ${formatDateTime(qrExpiry)}`);
    if (qrExpiry <= new Date()) set('qr-container', 'Expired ang QR. Gumawa ng bagong code.');
  }
}
