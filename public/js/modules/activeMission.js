import { bootGuardedPage } from '../core/guard-boot.js';
import { watchDocument } from '../core/data.js';
import { transitionDonationStatus, issueCredential, issuePin, volunteerMissionContact } from '../core/callables.js';
import { generateQR } from '../qr/generator.js';
import { handleError } from '../core/errors.js';
import { renderState, toast } from '../core/ui.js';
import { formatDateTime } from '../core/utils.js';

const $ = id => document.getElementById(id);
const text = (id, value) => { if ($(id)) $(id).textContent = value; };
let donation, busy = false, pinExpiry, qrExpiry, accessDenied = false;
let contactLoaded = false;
const donationId = new URLSearchParams(location.search).get('donationId');
bootGuardedPage({ roles: ['volunteer'] }, session => {
  if (!donationId || donationId.includes('/')) { renderState(document.querySelector('.mission-body'), { kind: 'error', message: 'Walang valid na mission ID.' }); return; }
  $('pickup-link').href = `scanner.html?donationId=${encodeURIComponent(donationId)}`;
  $('btn-cancel-mission').addEventListener('click', () => move('pending'));
  $('btn-enroute').addEventListener('click', () => move('enRoute'));
  $('btn-delivered').addEventListener('click', () => move('delivered'));
  $('btn-receipt-code').addEventListener('click', receiptCodes);
  const unsubscribe = watchDocument(`donations/${donationId}`, {
    next: (doc, metadata) => {
      if (accessDenied) return;
      if (!doc || doc.volunteerId !== session.user.uid) {
        // A cached pending record can precede the server's successful claim.
        // Do not tear down the mission UI until the server confirms ownership.
        if (metadata?.fromCache) { text('mission-action-status', 'Kinukuha ang pinakabagong assignment...'); return; }
        accessDenied = true;
        donation = null; clearCodes();
        renderState(document.querySelector('.mission-body'), { kind: 'error', message: 'Hindi na naka-assign sa iyo ang mission. Bumalik sa board.' }); return;
      }
      donation = doc;
      text('mission-action-status', '');
      text('m-food', doc.foodType); text('m-qty', `${doc.quantityKg} kg`);
      if (!contactLoaded) { contactLoaded = true; loadContacts(); }
      text('m-address', doc.pickupAddress);
      text('m-id', doc.id); text('m-window', formatDateTime(doc.pickupWindowEnd));
      text('status-badge-wrap', { scheduled: 'Scheduled', pickedUp: 'Picked Up', enRoute: 'En Route', delivered: 'Naghihintay ng pagtanggap', verified: 'Natanggap ng organization' }[doc.status] || doc.status);
      $('pickup-link').hidden = doc.status !== 'scheduled';
      $('btn-cancel-mission').hidden = doc.status !== 'scheduled';
      $('btn-enroute').hidden = doc.status !== 'pickedUp';
      $('btn-delivered').hidden = doc.status !== 'enRoute';
      $('receipt-credentials').hidden = doc.status !== 'delivered';
      if (doc.status !== 'delivered') clearCodes();
      tick();
    },
    error: error => { donation = null; clearCodes(); disableActions(true); $('pickup-link').hidden = true; handleError(error, { scope: 'volunteer.mission' }); text('mission-action-status', 'Hindi makuha ang update. Bumalik sa board at subukan muli.'); },
  });
  const timer = setInterval(tick, 1000);
  window.addEventListener('pagehide', () => { unsubscribe(); clearInterval(timer); }, { once: true });
});

async function loadContacts() {
  try {
    const result = await volunteerMissionContact(donationId);
    if (accessDenied || !donation) return;
    text('m-contact', result.donor.name);
    text('m-destination', result.destination.name);
    text('m-destination-address', result.destination.address || result.destination.barangay || 'Makipag-ugnayan sa organization para sa eksaktong address.');
    for (const [id, phone] of [['donor-phone', result.donor.phone], ['destination-phone', result.destination.phone]]) {
      $(id).hidden = !phone;
      if (phone) { $(id).href = `tel:${phone}`; $(id).textContent = phone; }
    }
    if (!result.destination.address) text('m-destination-note', 'Kumpirmahin sa organization ang eksaktong delivery address bago bumiyahe.');
  } catch (error) {
    contactLoaded = false;
    handleError(error, { scope: 'volunteer.contact' });
    text('m-destination', 'Hindi makuha ang contact details. I-refresh ang pahina.');
  }
}

async function move(nextStatus) {
  if (busy || !donation) return;
  busy = true; disableActions(true);
  try {
    const result = await transitionDonationStatus({ donationId, nextStatus });
    if (!result.success) throw new Error(result.reason);
    if (nextStatus === 'pending') location.href = 'index.html';
    else toast('Na-update ang mission.', 'success');
  } catch (error) {
    const failure = handleError(error, { scope: 'volunteer.transport' });
    text('mission-action-status', failure.message);
    toast(failure.message, 'error');
  }
  finally { busy = false; disableActions(false); }
}
function disableActions(disabled) {
  ['btn-enroute','btn-delivered','btn-cancel-mission','btn-receipt-code'].forEach(id => { if ($(id)) $(id).disabled = disabled; });
}
function clearCodes() { text('receipt-qr', ''); text('receipt-pin', ''); text('receipt-expiry', ''); pinExpiry = qrExpiry = null; }
async function receiptCodes() {
  if (busy || donation?.status !== 'delivered') return;
  busy = true; disableActions(true); clearCodes();
  try {
    const qr = await issueCredential({ donationId, purpose: 'verify' });
    if (donation?.status !== 'delivered') return;
    generateQR('receipt-qr', JSON.stringify(qr.payload)); qrExpiry = new Date(qr.payload.expiresAt);
    const pin = await issuePin({ donationId, purpose: 'verify' });
    if (donation?.status !== 'delivered') { clearCodes(); return; }
    text('receipt-pin', pin.pin); pinExpiry = new Date(pin.expiresAt); tick();
  } catch (error) { handleError(error, { scope: 'volunteer.receiptCode' }); text('receipt-expiry', 'Hindi makagawa ng code. Subukan muli.'); }
  finally { busy = false; disableActions(false); }
}
function tick() {
  if (!donation) return;
  const deadline = donation.pickupWindowEnd?.toDate ? donation.pickupWindowEnd.toDate() : new Date(donation.pickupWindowEnd);
  const minutes = Math.max(0, Math.ceil((deadline - new Date()) / 60000));
  $('pickup-countdown').hidden = donation.status !== 'scheduled';
  if (donation.status === 'scheduled' && deadline <= new Date()) {
    $('pickup-link').hidden = true;
    text('mission-action-status', 'Tapos na ang pickup window. Bitawan ang mission at makipag-ugnayan sa donor.');
  }
  text('countdown', minutes ? `${minutes} minuto sa pickup window` : 'Tapos na ang pickup window');
  if (pinExpiry) {
    const seconds = Math.max(0, Math.ceil((pinExpiry - new Date()) / 1000));
    text('receipt-expiry', seconds ? `Receipt PIN: ${seconds}s na lang. Bagong code ang papalit sa luma.` : 'Expired ang PIN. Gumawa ng bagong code.');
    if (!seconds) text('receipt-pin', '—');
  }
  if (qrExpiry && qrExpiry <= new Date()) text('receipt-qr', 'Expired ang receipt QR. Gumawa ng bago.');
}
