Here is the **in-depth architectural guide** for the beneficiary (Organization Admin) side of ResQFood, followed by the **Claude-ready, token-optimized prompt**.

---

## 1. Core Philosophy: "Verify Receipt, Not Technology"

The beneficiary is typically a **soup kitchen coordinator, church volunteer, or barangay feeding program staffer** — often elderly, rotating duty, or technically hesitant. They do not "use an app." They **confirm that food arrived**. The flow must treat them as a **paper-logbook person who happens to have a phone**, not a digital native.

**Premortem failures this answers:**

- _"Elderly staff could not use smartphones or QR"_ → Basic Mode with PIN fallback, no mandatory QR scanning.
- _"Org admins never verified deliveries"_ → Dual verifier setup, training gate, and explicit paper-logbook integration.
- _"Rotating staff broke the verification chain"_ → Org-first account with two verifiers, not person-first.
- _"The LGU distanced itself after liability issues"_ → Verification creates legal receipt trail; org acknowledges role in writing.

---

## 2. Entry Point: Invitation or Self-Registration

Unlike volunteers and donors, org admins can register through **two paths**:

**Path A: Self-Registration** (for established orgs)

- From the role gateway: _"My organization receives donations"_
- Redirects to `register/org-admin.html`

**Path B: LGU Invitation** (for barangay-accredited orgs)

- LGU admin sends an invitation link with pre-filled `barangay` and `orgType`
- Streamlines onboarding for barangay feeding programs

---

## 3. The Org Admin Registration Pipeline: Org-First, Not Person-First

This is the **only pipeline where the organization registers before the individual**. The account belongs to the org; people rotate.

### Step 1: Organization Profile

**Fields:**

- `orgName` (2–150 chars)
- `orgType` (dropdown): Soup Kitchen, Shelter, Church, School, Barangay Hall, NGO, Other
- `barangay` (dropdown, Cebu City barangays)
- `orgAddress` (free text)
- `orgPhone` (normalized +63)

**Logic:** The individual registering is the **Primary Contact**, but they are creating an org account, not a personal profile. This prevents the "staff rotated and no one can log in" failure.

### Step 2: Dual Verifier Setup (Mandatory)

The premortem found that rotating staff broke verification. This fixes it.

**Required:**

- `verifierA`: `name`, `phone`, `designation` (e.g., "Kitchen Manager")
- `verifierB`: `name`, `phone`, `designation` (e.g., "Barangay Secretary")

**Firebase Phone OTP** is sent to **both numbers**. Both must verify before the org account is activated.

**Why two verifiers:** If Verifier A is absent (sick leave, day off), Verifier B can confirm deliveries. This eliminates single points of failure.

### Step 3: Device Capability Check

Client-side detection:

- `navigator.userAgent` parsing for old Android
- Camera API availability test

**If camera fails or device is old:**

- Offer **Basic Mode**: _"Hindi kailangan ng QR scanner. Gagamitin mo lang ang 4-digit PIN na ibibigay ng volunteer."_
- Set `orgProfile.mode: "basic"`
- If camera works: `orgProfile.mode: "standard"`

**Why this matters:** The premortem explicitly identified elderly staff with old phones. Basic Mode removes QR anxiety entirely.

### Step 4: Training Acknowledgment

Mandatory checkbox:

> _"Naiintindihan naming kailangan naming dumalo sa 30-minutong orientation bago kami makatanggap ng deliveries."_

**Status:** `pending_training`. The org cannot receive deliveries until an LGU admin marks them `active`.

### Step 5: Firebase Write (Two Documents)

```javascript
// Collection: organizations/{orgId}
{
  orgId: <auto_uuid>,
  orgName: "Lahug Soup Kitchen",
  orgType: "soup_kitchen",
  barangay: "Lahug",
  address: "123 Gorordo Ave",
  phone: "+639123456789",
  primaryContactUid: <auth_uid>,
  verifiers: [
    { name: "Ana Reyes", phone: "+639171111111", verified: true, uid: "auth-uid-ana" },
    { name: "Boyet Cruz", phone: "+639172222222", verified: true, uid: "auth-uid-boyet" }
  ],
  mode: "basic", // or "standard"
  status: "pending_training",
  createdAt: serverTimestamp()
}

// Collection: users/{uid} (for the registering person)
{
  uid: <auth_uid>,
  fullName: "Ana Reyes",
  contactNumber: "+639171111111",
  role: "orgAdmin",
  orgId: "org-id-from-above",
  isPrimaryContact: true,
  status: "active",
  createdAt: serverTimestamp()
}
```

---

## 4. The Verification Dashboard: Simple, Binary, Paper-Compatible

### Layout Concept (`org-admin/index.html`)

```
┌─────────────────────────────────────────┐
│  Lahug Soup Kitchen                     │
│  Status: ACTIVE  |  Mode: BASIC         │
├─────────────────────────────────────────┤
│  PARATING (Incoming)                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  • 5kg Kanin — En Route                 │
│    Volunteer: Juan Dela Cruz            │
│    ETA: 3:45 PM                         │
│    [  CONFIRM RECEIPT  ]                │
│                                         │
│  NAKUMPLETO (Verified Today)            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  • 3kg Tinapa — Verified 2:30 PM        │
│    Volunteer: Maria Santos              │
│                                         │
│  [📋 Open Paper Logbook]                │
│  (Shows today's PINs for manual entry)  │
└─────────────────────────────────────────┘
```

### Incoming Deliveries Query

```javascript
const q = query(
  collection(db, "donations"),
  where("orgAdminId", "==", currentOrgId),
  where("status", "in", ["enRoute", "delivered"]),
);
```

### Verification Flow

**Standard Mode (QR):**

1. Volunteer arrives, shows QR on their phone.
2. Org admin opens `org-admin/verify.html`, camera scans.
3. App validates: `donationId` matches, `status === 'delivered'`, `orgAdminId` matches current org.
4. On success: status → `verified`. Log entry appended. Volunteer and donor notified.

**Basic Mode (PIN):**

1. Volunteer states the 4-digit PIN from their active mission screen.
2. Org admin types PIN into a large, high-contrast input: `[ _ ] [ _ ] [ _ ] [ _ ]`
3. App validates `fallbackPin` against the donation document.
4. On match: same status update as QR scan.

**Paper Logbook Integration:**
A button _"Buksan ang Paper Logbook"_ shows a printable table:

```
| Oras | Volunteer | Food | Kg | PIN | Signature |
|------|-----------|------|----|-----|-----------|
```

This explicitly acknowledges that the org may prefer paper. The PIN column bridges digital and physical records.

---

## 5. Notification & Alert Logic

| Trigger                                     | Notification                                             | Recipient                                    |
| ------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `enRoute` → `delivered`                     | _"May delivery na nakarating. I-verify ang pagtanggap."_ | Org admin (in-app toast + push if permitted) |
| `delivered` → `verified`                    | _"Na-verify ang delivery. Salamat!"_                     | Volunteer + Donor                            |
| 30 min after `delivered` with no `verified` | _"Paalala: May hindi pa na-verify na delivery."_         | Org admin (escalating reminder)              |

---

## 6. Offline Behavior

Org admins often operate in barangay halls with spotty WiFi. Firestore offline persistence caches:

- The incoming deliveries list
- Verification actions (queued if offline, synced when reconnected)

Banner: _"Offline mode. Ang verification ay mase-save pagbalik ng signal."_

---

## 7. Firestore Security Rules

```javascript
match /organizations/{orgId} {
  allow create: if request.auth != null
                && request.resource.data.status == 'pending_training';
  allow read: if request.auth != null
               && (resource.data.primaryContactUid == request.auth.uid
                   || request.auth.token.role == 'systemAdmin');
  allow update: if request.auth != null
                  && (resource.data.primaryContactUid == request.auth.uid
                      || request.auth.token.role == 'systemAdmin');
}

match /donations/{donationId} {
  // Org admin can verify: delivered → verified
  allow update: if request.auth != null
                && resource.data.orgAdminId == request.auth.uid
                && resource.data.status == 'delivered'
                && request.resource.data.status == 'verified';
}
```

---

## 8. Claude-Ready Prompt

```
You are an expert Firebase PWA developer. Build the beneficiary (Organization Admin) side for "ResQFood," a surplus food redistribution PWA. Vanilla HTML5/CSS3/JS (ES6+), Firebase v9 modular SDK, qrcode.js, jsQR. No frameworks. Mobile-first.

TECH STACK
- Firebase Auth (Phone OTP)
- Firestore (offline persistence)
- No Cloud Functions

DATABASE SCHEMA
Collection: organizations/{orgId}
{ orgId, orgName, orgType, barangay, address, phone, primaryContactUid, verifiers:[{name,phone,verified,uid}], mode:"standard"|"basic", status:"pending_training"|"active", createdAt:timestamp }

Collection: users/{uid} (org admin person)
{ uid, fullName, contactNumber, role:"orgAdmin", orgId, isPrimaryContact, status:"active", createdAt:timestamp }

Collection: donations/{id}
{ donationId, donorId, volunteerId, orgAdminId, foodType, quantityKg, description, pickupAddress, pickupWindowStart, pickupWindowEnd, photoUrl, qrCodeData, fallbackPin, status:"pending"|"scheduled"|"pickedUp"|"enRoute"|"delivered"|"verified"|"cancelled", statusHistory:[{status,timestamp,volunteerId,gpsLat,gpsLng}], createdAt:timestamp }

FILES TO GENERATE
1. public/register/org-admin.html — Org-first registration wizard. Steps:
   - Org Profile: orgName, orgType(dropdown), barangay(dropdown), address, phone(normalize +63)
   - Primary Contact: fullName, phone OTP (Firebase signInWithPhoneNumber)
   - Dual Verifier: verifierA(name,phone,designation) and verifierB(name,phone,designation). Send OTP to both. Both must verify.
   - Device Check: test camera API. If fails or user declines, auto-select Basic Mode with explanation: "Hindi kailangan ng QR scanner. Gagamitin mo lang ang 4-digit PIN."
   - Training Acknowledgment: mandatory checkbox. status set to "pending_training".
   - Submit: write organizations/{orgId} then users/{uid} with orgId reference. If Firestore fails, recovery screen.

2. public/js/register/orgAdmin.js — Handler for above. Validation: orgName 2-150, both verifiers required, phone normalization, OTP coordination for two verifiers.

3. public/org-admin/index.html — Verification Dashboard. Layout:
   - Header: orgName, mode badge (Standard/Basic), status badge.
   - Incoming Deliveries: onSnapshot query where orgAdminId == currentOrgId and status in ["enRoute","delivered"]. Cards show foodType, quantity, volunteer name, ETA.
   - "Confirm Receipt" button per card. Opens verify.html?donationId=xxx.
   - Verified Today: collapsed list of today's verified deliveries.
   - "Paper Logbook" button: opens modal with printable table (Time, Volunteer, Food, Kg, PIN, Signature).

4. public/org-admin/verify.html — Verification screen. Two paths:
   - Standard Mode: full-screen QR scanner (jsQR + camera). On decode: validate donationId matches URL param, status === "delivered", orgAdminId matches current user. Confirmation modal: "I-verify ang pagtanggap ng [quantityKg]kg [foodType]?" On confirm: update status to "verified", append statusHistory with timestamp and verifierId. Redirect to index.html.
   - Basic Mode: large 4-digit PIN input. Validate against donation.fallbackPin. Same confirm flow.
   - If offline: Firestore queues write. Toast: "Queued. Mag-si-sync pag may signal."

5. public/org-admin/history.html — Org delivery history. Table: date, foodType, quantity, volunteer name, verification time. Summary stats: total kg this month, total deliveries.

6. public/js/modules/orgAdmin.js — Core logic:
   - renderIncomingDeliveries(orgId): onSnapshot query, real-time updates.
   - verifyDelivery(donationId, verifierId, mode): update status to "verified", append statusHistory.
   - validatePIN(donationId, pin): fetch donation, compare fallbackPin.
   - renderPaperLogbook(): generate printable HTML table for today's deliveries.

7. public/js/qr/scanner.js — Reuse from volunteer module (or include copy). startScanner(), stopScanner(), parseQRPayload().

FIRESTORE SECURITY RULES (snippet)
- organizations: create if auth != null. Read if primaryContactUid == auth.uid or systemAdmin. Update by primaryContact or systemAdmin.
- donations: orgAdmin can update only if orgAdminId == auth.uid and status transition is delivered→verified.

ACCEPTANCE CRITERIA
1. Org registers with org profile first, person profile second.
2. Both verifiers must complete phone OTP before activation.
3. Device check auto-selects Basic Mode if camera unavailable.
4. status is "pending_training" until LGU marks "active".
5. Incoming deliveries query filters by orgAdminId and status.
6. Standard Mode: QR scan validates donationId, status, orgAdminId before allowing verify.
7. Basic Mode: PIN entry validates against fallbackPin.
8. Verification updates status to "verified" and appends statusHistory with verifierId.
9. Paper Logbook modal shows today's deliveries with PIN column for manual entry.
10. Offline verifications queue via Firestore and sync automatically.

CONSTRAINTS
- No React, Vue, CSS frameworks. CSS variables. Mobile-first (320px).
- All user-facing text in Tagalog/Filipino (except "QR", "PIN", "kg").
- Do not generate Donor, Volunteer, or LGU modules.
- Do not generate Cloud Functions.
- Output as file tree with complete working code.
```
