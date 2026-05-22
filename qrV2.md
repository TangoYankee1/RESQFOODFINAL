# QR System — Version 2.0 Plan

## Current State (V1) — What Exists

### Files
| File | Role | Problem |
|---|---|---|
| `js/qr-generate.js` | Renders QR code into a DOM element | Duplicate of `qr-generator.js` |
| `js/qr-generator.js` | Identical to above | Dead — only `qr-generate.js` is imported |
| `js/qr-scanner.js` | Camera stream + jsQR decode loop | Duplicate of `qr-scan.js` |
| `js/qr-scan.js` | Identical to above | Dead — only `qr-scanner.js` is imported |
| `js/pages/scanner.js` | Standalone `/scanner` route | Just detects ID and navigates — no stage logic |
| `js/volunteer.js` | 3-stage scan flow | Embedded inside volunteer module |
| `js/org-admin.js` | Verify scan | Single-stage, no status pre-check |

### QR Payload (V1)
```json
{ "type": "resqfood-donation", "id": "abc123" }
```
Plain donation ID — no stage, no expiry, no auth.

---

## Problems with V1

### 1. No stage validation
The volunteer scanner advances whatever donation ID it reads, regardless of:
- Whether the donation belongs to this volunteer
- Whether the donation is actually at the expected status for this stage
- Scanning a different mission's QR at stage 1 would corrupt that mission's state

### 2. No status pre-check (org-admin)
`verifyDonationHandoff()` is called before checking if the donation is actually `completed`. An org admin could scan a `claimed` donation and skip the entire delivery phase.

### 3. Duplicate files
`qr-generator.js` and `qr-scan.js` are dead code — exact copies of the active files with no callers.

### 4. Scan fires on every animation frame
`onResult` is called every frame a QR is visible. The `scannerHandled` flag prevents duplicate processing but the camera loop keeps running. There is no debounce — fast scanning or a jittery flag reset can trigger double-updates.

### 5. QR payload carries no context
No version field, no donor ID, no expiry. A QR generated today will still be a valid payload in 5 years, providing no audit signal about when it was generated.

### 6. No wrong-QR feedback
If a volunteer scans the wrong donation (e.g., a QR from a different mission), the app silently updates the wrong Firestore document. The volunteer gets a success toast for a donation they didn't claim.

### 7. No camera fallback
If `getUserMedia` fails (permissions denied, old browser), the scanner shows a generic error with no alternative.

### 8. Single QR can be faked at delivery
The donor's QR is used for all 4 scans including org admin verification. A volunteer could scan Stage 2 and the org-verify scan from their pocket without physically visiting the org. There is no proof of presence at the delivery location.

---

## Version 2.0 — Proposed Changes

### Change 1 — Remove duplicate files

Delete `js/qr-generator.js` and `js/qr-scan.js`. All callers already use `qr-generate.js` and `qr-scanner.js`.

**Files to delete:**
- `js/qr-generator.js`
- `js/qr-scan.js`

---

### Change 2 — Versioned QR payload

Add a `v` field and `createdAt` timestamp to the payload so scans can be validated and audited.

**New payload format (V2):**
```json
{
  "type": "resqfood-donation",
  "v": 2,
  "id": "abc123",
  "donorId": "maria-uid",
  "createdAt": 1716345600000
}
```

**Update `donationQrPayload(id, donorId)` in `db.js` and `utils.js`:**
```javascript
export function donationQrPayload(id, donorId) {
  return JSON.stringify({
    type: 'resqfood-donation',
    v: 2,
    id,
    donorId,
    createdAt: Date.now(),
  });
}
```

**Update `parseDonationQr(text)` to accept both V1 and V2:**
```javascript
export function parseDonationQr(text) {
  try {
    const data = JSON.parse(text);
    if (data?.type === 'resqfood-donation' && data.id) return data.id;
  } catch { /* plain id fallback */ }
  if (/^[a-zA-Z0-9]{10,}$/.test(text.trim())) return text.trim();
  return null;
}
// V2 also returns donorId for cross-validation (new function):
export function parseDonationQrFull(text) {
  try {
    const data = JSON.parse(text);
    if (data?.type === 'resqfood-donation' && data.id) return data;
  } catch {}
  return null;
}
```

---

### Change 3 — Stage validation in volunteer scanner

Before calling `stage.fn(id)`, fetch the donation and validate:
1. `donation.volunteerId === currentUser.uid` — this volunteer owns this mission
2. The donation's current status matches the expected pre-stage status

```
Stage 0 (Scan at Pickup)  → expects donation.status === 'claimed'
Stage 1 (Scan En-Route)   → expects donation.status === 'picked-up'
Stage 2 (Scan at Delivery)→ expects donation.status === 'en-route'
```

If validation fails, show a clear error instead of silently updating the wrong document.

**Add `PRE_STATUS` to `SCAN_STAGES` in `volunteer.js`:**
```javascript
const SCAN_STAGES = [
  { key: 'picked-up', label: 'Scan at Pickup',   preStatus: 'claimed',   fn: pickupDonation,   next: true  },
  { key: 'en-route',  label: 'Scan En-Route',     preStatus: 'picked-up', fn: enRouteDonation,  next: true  },
  { key: 'delivered', label: 'Scan at Delivery',  preStatus: 'en-route',  fn: deliveredDonation, next: false },
];
```

**Validation block before `stage.fn(id)`:**
```javascript
const donation = await getDonation(id);
if (!donation) throw new Error('Donation not found.');
if (donation.volunteerId !== user.uid) throw new Error('This QR belongs to a different volunteer\'s mission.');
if (donation.status !== stage.preStatus) throw new Error(`Expected status "${stage.preStatus}" but donation is "${donation.status}".`);
await stage.fn(id);
```

---

### Change 4 — Status pre-check in org-admin verify

Before calling `verifyDonationHandoff()`, check that the donation is `completed`:

```javascript
const donation = await getDonation(id);
if (!donation) throw new Error('Donation not found.');
if (donation.status !== 'completed') {
  throw new Error(`Cannot verify: donation status is "${donation.status}", expected "completed".`);
}
if (donation.beneficiaryOrgId !== user.uid) {
  throw new Error('This donation is not assigned to your organization.');
}
await verifyDonationHandoff(id, user.uid);
```

**File:** `js/org-admin.js` inside `startVerifyScanner()`

---

### Change 5 — Scan debounce (scanner cooldown)

After a successful scan, disable the `onResult` callback for 2 seconds before allowing another scan. This prevents the same QR being re-processed if it stays in frame.

**Add to `qr-scanner.js`:**
```javascript
let lastScanTime = 0;
const SCAN_COOLDOWN_MS = 2000;

// inside tick():
if (code?.data) {
  const now = Date.now();
  if (now - lastScanTime >= SCAN_COOLDOWN_MS) {
    lastScanTime = now;
    onResult(code.data);
  }
}
```

---

### Change 6 — Image upload fallback for scanner

Add a file input below the camera scanner as a fallback for users who cannot grant camera access. The uploaded image is decoded by jsQR via canvas.

**UI addition in volunteer dashboard and org-admin view:**
```html
<p class="donation-card__meta">No camera? 
  <label for="qr-upload" style="cursor:pointer;text-decoration:underline;">Upload a QR image</label>
</p>
<input type="file" id="qr-upload" accept="image/*" class="hidden" />
```

**Handler in `qr-scanner.js` (new export):**
```javascript
export function scanFromFile(file, onResult) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) onResult(code.data);
      else onResult(null);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
```

---

### Change 7 — Delivery QR (beneficiary-side QR)

Introduces a second QR type owned by the beneficiary org. The org admin shows this per-delivery QR when the volunteer arrives, proving physical presence at the org.

**New payload: `resqfood-delivery`**

```json
{ "type": "resqfood-delivery", "v": 2, "id": "donationId", "orgId": "ana-uid" }
```

**New functions in `db.js` and `utils.js`:**

```javascript
export function deliveryQrPayload(donationId, orgId) {
  return JSON.stringify({ type: 'resqfood-delivery', v: 2, id: donationId, orgId });
}

export function parseDeliveryQr(text) {
  try {
    const data = JSON.parse(text);
    if (data?.type === 'resqfood-delivery' && data.id && data.orgId) return data;
  } catch {}
  return null;
}
```

**Updated scan flow:**

```text
Stage 0 — Volunteer scans DONOR QR at pickup
          → parseDonationQr() → donationId
          → validates volunteerId + status === 'claimed'
          → pickupDonation(donationId)

Stage 1 — Volunteer scans DONOR QR en-route
          → parseDonationQr() → donationId
          → validates status === 'picked-up'
          → enRouteDonation(donationId)

Stage 2 — Volunteer scans DELIVERY QR at org location
          → parseDeliveryQr() → { id, orgId }
          → validates orgId === donation.beneficiaryOrgId, status === 'en-route'
          → deliveredDonation(id)
          ← volunteer must be physically at org to see this QR

Org verify — Org admin scans DELIVERY QR to confirm receipt
           → parseDeliveryQr() → { id, orgId }
           → validates orgId === user.uid, status === 'completed'
           → verifyDonationHandoff(id, user.uid)
```

**`SCAN_STAGES` update in `volunteer.js` — add `qrType` field:**

```javascript
const SCAN_STAGES = [
  { key: 'picked-up', label: 'Scan at Pickup',   qrType: 'donation', preStatus: 'claimed',   fn: pickupDonation,    next: true  },
  { key: 'en-route',  label: 'Scan En-Route',     qrType: 'donation', preStatus: 'picked-up', fn: enRouteDonation,   next: true  },
  { key: 'delivered', label: 'Scan Delivery QR',  qrType: 'delivery', preStatus: 'en-route',  fn: deliveredDonation, next: false },
];
```

Scanner callback uses `stage.qrType` to pick the right parser. For `delivery` type it calls `parseDeliveryQr()` and validates `orgId === donation.beneficiaryOrgId`.

**Org admin dashboard update in `org-admin.js`:**

- `en-route` donations in the pending list show a **"Show QR"** button
- Clicking renders the `resqfood-delivery` QR fullscreen so the volunteer can scan on arrival
- Verify scanner updated to call `parseDeliveryQr()` instead of `parseDonationQr()`

---

## Files Modified in V2

| File | Change |
|---|---|
| `js/qr-generator.js` | **Delete** (duplicate) |
| `js/qr-scan.js` | **Delete** (duplicate) |
| `js/qr-scanner.js` | Add scan cooldown; add `scanFromFile()` export |
| `js/qr-generate.js` | No change needed |
| `js/db.js` | Update `donationQrPayload()` to V2; add `parseDonationQrFull()`, `deliveryQrPayload()`, `parseDeliveryQr()` |
| `js/utils.js` | Same updates as `db.js` (parallel layer) |
| `js/volunteer.js` | Add `qrType` + `preStatus` to `SCAN_STAGES`; Stage 2 uses `parseDeliveryQr()`; validation block before `stage.fn()` |
| `js/org-admin.js` | Show QR button per en-route delivery; verify scanner reads delivery QR; status + org ownership check |
| `js/pages/donations.js` | Pass `donorId` to `donationQrPayload()` |
| `js/donor.js` | Pass `donorId` to `donationQrPayload()` |

---

## What V2 Does NOT Change

- QR library (qrcode.js + jsQR) — no reason to swap
- Firestore rules — no new fields or indexes needed
- `parseDonationQr()` return value — still returns just the ID for all existing callers
- Donor QR payload is backward compatible with V1 readers

---

## Verification

1. **Stage validation:** Volunteer scans the wrong donation's QR → sees error "This QR belongs to a different volunteer's mission"
2. **Status pre-check:** Volunteer at Stage 0 scans a QR for a donation already `en-route` → sees status mismatch error
3. **Two-QR delivery:** Volunteer at Stage 2 scans donor QR → error "Wrong QR type — show the org's delivery QR"; scans delivery QR → success
4. **Org ownership:** Volunteer scans delivery QR whose `orgId` doesn't match `donation.beneficiaryOrgId` → error
5. **Org-admin verify guard:** Org admin scans delivery QR for a donation still `claimed` → error "Cannot verify: status is claimed"
6. **Org ownership verify:** Org admin scans delivery QR for a different org → error
7. **Cooldown:** Hold phone steady on QR → `onResult` fires once, then waits 2 s
8. **Image upload:** No camera → upload QR screenshot → donation detected and stage advances
9. **V1 backward compat:** Old plain-ID donor QR codes still parse correctly via `parseDonationQr()`
