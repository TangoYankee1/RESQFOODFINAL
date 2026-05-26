Here is the stated and explained architecture for the **new donor-side registration and operational logic**, designed to prevent the specific failure modes identified in the premortem.

---

## 1. Core Philosophy: "Post Food, Not Data"

The donor flow is built on the premise that the person donating is busy, possibly elderly, possibly a restaurant worker with greasy hands, and definitely not interested in "joining a platform." The registration must feel like **filling out a barangay form at the health center**—familiar, quick, and verbally intuitive—rather than signing up for a social network.

**Premortem failures this directly answers:**

- _"They posted too late and gave up"_ → Time-guarded posting wizard.
- _"The app felt intimidating"_ → Phone-first, no MFA, no email required, Tagalog-first labels.
- _"Liability after food poisoning"_ → Mandatory safety declaration with digital timestamp.
- _"They used Facebook instead"_ → The flow proves value immediately by generating a trackable QR code and sending real-time status updates.

---

## 2. Entry Point: The Role Gateway

The donor does not encounter a generic signup page. They arrive at `register/index.html`, which presents four visual cards. The **Food Donor** card is labeled:

> **"May sobrang pagkain?"**
> _I-post ang sobrang ulam o paninda para maihatid sa nangangailangan._

This is the first psychological filter. The language is **need-oriented**, not **technology-oriented**. It assumes the user already has surplus food in front of them and needs a solution _now_.

**Logic:** If the user clicks this card, the app stores `intendedRole = 'donor'` in `sessionStorage` and redirects to `register/donor.html`. No other role fields are visible, removing decision fatigue.

---

## 3. The Donor Registration Pipeline: 5 Steps

### Step 1: Phone Verification (Identity Anchor)

**Why phone-first:** The target demographic (tindera, karinderya staff, household helpers) lives on SMS and Facebook Messenger. They do not monitor email inboxes. Requiring email verification creates a drop-off point where the user never returns to click the verification link.

**Flow:**

1. User enters a Philippine mobile number (`09XXXXXXXXX` or `+63XXXXXXXXXX`).
2. Client-side normalization converts any `09` prefix to `+63` E.164 format.
3. Firebase `signInWithPhoneNumber()` sends a 6-digit OTP via SMS.
4. User enters the OTP. Firebase returns an authenticated `UserCredential` with a `uid`.

**Edge case handling:** If the SMS fails to arrive within 60 seconds, a "Resend Code" button appears. If the phone number is already tied to an existing account with a different role, the app blocks registration and advises: _"Ang numerong ito ay nakarehistro na bilang Volunteer. Gumamit ng ibang numero para sa Donor account, o mag-sign in."_ This prevents role collision.

### Step 2: Identity & Location (No GPS, No Email Required)

**Fields collected:**

- `fullName` (text, 3–100 characters). Validated for alphanumeric and spaces only.
- `email` (optional, validated if provided). Used only for receipt notifications. The label explicitly states: _"Opsyonal. Para sa resibo ng donation."_
- `barangay` (mandatory dropdown, pre-seeded with Cebu City barangays). This replaces GPS pinning.
- `streetAddress` (free text, e.g., _"Harap ng 7-Eleven, Gorordo Ave"_).

**Logic:** The address is **not** geocoded. Storing raw GPS coordinates at registration violates the Data Privacy Act and is unnecessary for a barangay-level operation where volunteers know the streets. The dropdown ensures the LGU dashboard can aggregate by barangay later.

**Firebase write at this stage:** None yet. The data is held in a temporary JavaScript object. The actual Firestore document is only written after the final step to prevent orphaned profiles if the user abandons mid-flow.

### Step 3: Business vs. Individual Toggle (Trust Signaling)

**Logic:** The donor must declare whether they are an individual household or a business/establishment. This is a single toggle, not a complex form.

- **Individual:** No additional fields. The donor's name appears on the mission board as "Maria S."
- **Business:** Reveals `businessName` and an optional `businessPermitNumber`. The label explains: _"Puwedeng ilagay ang permit number para sa kumpiyansa ng volunteer."_ This is optional but strongly encouraged.

**Why this matters:** Volunteers on the mission board see a `isBusiness` flag. A donation from "Mang Inasal Cebu" with a permit number is claimed faster than an anonymous post because volunteers trust institutional consistency. This creates a reputation layer without explicit ratings.

### Step 4: Safety & Liability Declaration (The Legal Shield)

This is the **non-negotiable, hold-to-proceed** step. The user cannot skip it.

**Content:** A scrollable plain-language statement in Tagalog:

> _"Bago ko i-post ang donation, kumpirmado kong:_
>
> - _Ang pagkaing ito ay hindi pa nauulit o kinain ng iba._
> - _Ito ay nailagay sa malinis na lalagyan at hindi naiwan sa init ng araw._
> - _Kaya kong maghintay sa pickup window na aking itatakda._
> - _Naiintindihan kong ako ang may pananagutan sa kalidad ng pagkain, at ang ResQFood ay tagapagkoordinate lamang."_

**Interaction:** The user must scroll to the bottom. Two mandatory checkboxes appear:

1. _"Kumpirmado kong ligtas ang pagkain."_ (`safetyDeclared: true`)
2. _"Puwede naming gamitin ang aking pangalan at numero para sa pagkoordinate. Hindi ito ibebenta."_ (`privacyConsent: true`)

**Logic:** This creates a digital timestamped record of informed consent. In the event of a food safety incident, the `donations` document contains `safetyDeclared: true` and `donorId`, creating a clear separation of liability: the donor attested to safety; the platform merely connected parties.

### Step 5: Account Creation (Atomic Write)

Upon tapping _"Gawin ang Account"_:

**Firebase Auth:**

- `updateProfile()` sets `displayName` to `fullName`.
- No password is set. The account is secured by phone OTP + Firebase's built-in token refresh. If the user logs out, they log back in via OTP. This removes password fatigue.

**Firestore Write (single `setDoc`):**

```javascript
// Collection: users/{uid}
{
  uid: <firebase_auth_uid>,
  fullName: "Maria Santos",
  contactNumber: "+639171234567",
  email: null, // or provided value
  role: "donor",
  isBusiness: true,
  businessName: "Maria's Eatery",
  businessPermitNumber: "BP-2026-00123",
  barangay: "Lahug",
  streetAddress: "Corner Gorordo Ave",
  status: "active", // Donors are immediately active; no orientation gate
  onboardingComplete: false, // Critical activation gate
  safetyWaiverVersion: "v1-2026",
  liabilityWaiverSigned: true,
  privacyConsentSigned: true,
  totalDonatedKg: 0,
  points: 0,
  badges: [],
  reliabilityScore: 0,
  createdAt: serverTimestamp()
}
```

**Failure recovery:** If Firestore write fails (network error), the user is redirected to a recovery screen: _"Nagkaroon ng problema. Pindutin para subukan muli."_ The app retries `setDoc` on tap. The user cannot proceed to the dashboard until this succeeds, preventing an orphaned Auth user.

---

## 4. Post-Registration: The Activation Gate

The donor is not fully onboarded until they **complete one micro-action**: posting their first donation.

**Dashboard state before activation:**

- The donor lands on `donor/index.html`, but the sidebar shows only one active button: _"Mag-post ng Donation."_
- The _History_ and _Settings_ tabs are visible but grayed out with tooltips: _"Mag-post muna ng isang donation para ma-unlock."_
- A persistent banner reads: _"Simulan ang iyong unang donation para ma-activate ang account. Ito ay magtatagal ng 2 minuto."_

**Why this matters:** It proves the app works immediately. The donor experiences value creation within 120 seconds of registration. This prevents the "I signed up and nothing happened" abandonment pattern.

---

## 5. The Donation Posting Logic: Kitchen-First Wizard

Once activated, the donor uses a **3-step wizard** designed for a kitchen environment (potentially messy, distracted, time-pressured).

### Step A: Food Identity & Spoilage Math

**Fields:**

- `foodType`: Dropdown (Kanin, Tinapa, Gulay, Manok, Baboy, Tinapay, Processed/Packaged, Other). This drives the Time Guardrail.
- `quantityKg`: Numeric input with a visual reference (_"1 kg = isang kilong bigas"_).
- `description`: Guided free text with placeholder: _"Halimbawa: 'Natirang adobo mula sa tanghalian, nilagay sa ref ng 1PM.'"_

**The Time Guardrail (Core Logic):**
The app calculates a `maxHoldHours` based on `foodType`:

- Kanin / Tinapay: 6 hours
- Gulay / Tinapa: 4 hours
- Manok / Baboy / Processed: 3 hours
- Other: 2 hours

`latestSafePickup = now + maxHoldHours`

When the donor sets `pickupWindowEnd`:

- If `pickupWindowEnd <= latestSafePickup`: green checkmark. Message: _"Ligtas ang oras na ito para sa uri ng pagkain."_
- If `pickupWindowEnd > latestSafePickup`: red warning. The _Next_ button is disabled. Message: _"Masyadong late ang pickup window. Maaaring masira ang pagkain. Ibahin ang oras o itapon na lamang para sa kaligtasan."_

**Logic:** This prevents the 9:00 PM posting for perishable food. It forces the donor to confront spoilage math at the point of posting, protecting both beneficiaries and the platform's reputation.

### Step B: Pickup Logistics

**Fields:**

- `pickupAddress`: Pre-filled from profile, editable per donation.
- `pickupWindowStart` and `pickupWindowEnd`: Time pickers constrained by the Time Guardrail.
- `photoUrl`: Optional file upload. Client-side image compression to max 800px width before Firebase Storage upload.

**Logic:** The address is decoupled from the profile address. A restaurant might post from their commissary, not their registered business address.

### Step C: Review & Safety Re-confirmation

A summary card displays:

- Food, quantity, pickup address, window.
- The calculated safe expiry time.
- A reminder: _"Kung walang mag-claim hanggang [window end], maaari mong kanselahin."_

**Final checkbox:** _"Kumpirmado kong ang impormasyon ay tama at ang pagkain ay ligtas para kainin."_ (`postingConfirmed: true`).

**Firebase Write on Submit:**

```javascript
// Collection: donations/{donationId}
{
  donationId: <auto_uuid>,
  donorId: <auth_uid>,
  foodType: "Kanin",
  quantityKg: 5,
  description: "Natirang adobo...",
  pickupAddress: "Maria's Eatery, Lahug",
  pickupWindowStart: Timestamp,
  pickupWindowEnd: Timestamp,
  photoUrl: "https://storage.../photo.jpg", // nullable
  qrCodeData: "<json_payload_string>",
  fallbackPin: "7392", // 4-digit numeric
  status: "pending",
  safetyDeclared: true,
  postingConfirmed: true,
  statusHistory: [
    {
      status: "pending",
      timestamp: serverTimestamp(),
      actorId: <auth_uid>,
      actorRole: "donor"
    }
  ],
  createdAt: serverTimestamp()
}
```

**QR Payload Structure:**

```json
{
  "v": 1,
  "d": "donationId-uuid",
  "o": "donor-uid",
  "t": 1716729600,
  "f": "Kanin",
  "q": 5,
  "c": "a3f9"
}
```

- `v`: Schema version for future evolution.
- `d`, `o`, `t`, `f`, `q`: Required per SRS.
- `c`: 4-char checksum (hash of other fields + client secret) to detect tampered QRs.

**Immediate Post-Submit Screen:**

- Full-screen QR code (SVG via `qrcode.js`).
- Large text: `PIN: 7392`.
- Instruction: _"I-screenshot ang QR na ito. Ipakita sa volunteer tuwing pickup."_
- Buttons: _"I-share sa Facebook"_, _"Kopyahin ang link"_, _"Balik sa Dashboard"_.

---

## 6. Real-Time Status Tracking & Cancellation

### Status Visualization

The donor dashboard uses a Firestore `onSnapshot` listener on `donations` where `donorId == currentUser.uid`. Each active donation displays a **horizontal stepper**:

```
[Posted] → [Claimed] → [Picked Up] → [En Route] → [Delivered] → [Verified]
```

- Current step: green highlight.
- Completed: checkmark.
- Future: gray.
- `cancelled`: red stepper with _"Na-cancel"_.

### Notification Triggers

When `status` changes, the app fires an in-app toast. If the PWA has push permission, it fires a browser push notification.

| Transition               | Toast Message                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `pending` → `scheduled`  | _"Si [Volunteer Name] ang kukuha ng iyong [foodType]. Inaasahan siya ng [window]."_              |
| `scheduled` → `pickedUp` | _"Nakuha na ang donation. Salamat, [Donor Name]!"_                                               |
| `delivered` → `verified` | _"Verified! Ang [quantityKg]kg [foodType] ay nakarating sa [Org Name]. +[points] points sa'yo."_ |

**Logic:** This answers the donor's core psychological need: _"Did my donation matter?"_ Real-time visibility prevents the "I posted and never heard back" abandonment that drives users back to Facebook.

### Cancellation Rules

- **Cancel button** appears only when `status == 'pending'`.
- If `status` is `scheduled` or beyond, the button is replaced by: _"Hindi na maaaring kanselahin. Tumawag sa volunteer: [contactNumber]."_
- On cancellation, `status` updates to `cancelled` and a log entry is appended to `statusHistory`.

**Reliability Score Impact:**

- `+10` per verified donation.
- `-20` per cancellation after `scheduled` (no-show).
- `-5` per expired donation (failed window).

Volunteers see this as a badge on the mission board: 🟢 _"Maaasahan"_ (score ≥ 30), ⚪ neutral, or 🔴 _"Baguhan"_ (< 3 donations).

---

## 7. Offline Behavior for Donors

Since donors often post from kitchens with spotty WiFi:

**Firestore Offline Persistence:** Enabled via `enableIndexedDbPersistence()`. This allows:

- **Posting while offline:** The `donations` write is queued. The QR code is generated locally using the locally-generated UUID, so the donor can screenshot it immediately even before sync.
- **Status viewing while offline:** The dashboard shows the last known status with a timestamp: _"Huling update: 2:00 PM (offline mode)."_

**Non-Firestore Actions:** If the donor attempts to upload a photo while offline, the app stores the compressed image blob in IndexedDB and shows a sync banner: _"May 1 aksyon na naghihintay ng koneksyon."_ When `navigator.onLine` fires, the app flushes the queue to Firebase Storage and updates the `photoUrl`.

---

## 8. Firestore Security Rules for Donor Operations

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: Donors can create their own profile
    match /users/{userId} {
      allow create: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.role == 'donor'
                    && request.resource.data.keys().hasAll([
                         'fullName', 'contactNumber', 'role',
                         'liabilityWaiverSigned', 'privacyConsentSigned'
                       ]);
      allow read: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.role == resource.data.role; // No role escalation
    }

    // Donations: Donor lifecycle rules
    match /donations/{donationId} {
      // Create: Must be donor's own doc, status pending, safety declared
      allow create: if request.auth != null
                    && request.resource.data.donorId == request.auth.uid
                    && request.resource.data.status == 'pending'
                    && request.resource.data.safetyDeclared == true
                    && request.resource.data.postingConfirmed == true;

      // Read: Donor can read their own donations
      allow read: if request.auth != null
                   && resource.data.donorId == request.auth.uid;

      // Update: Donor can only cancel their own pending donations
      allow update: if request.auth != null
                    && resource.data.donorId == request.auth.uid
                    && resource.data.status == 'pending'
                    && request.resource.data.status == 'cancelled';
    }
  }
}
```

**Logic:** The rules enforce the business logic at the database layer. Even if a malicious client attempts to post a donation without `safetyDeclared: true`, Firestore rejects it. Even if they attempt to cancel a mission already in transit, the rule blocks the write.

---

## 9. Summary: What Makes This Flow Solid

| Premortem Risk                    | Architectural Response                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| Late postings, spoiled food       | Time Guardrail with `foodType`-based `maxHoldHours`                 |
| App feels intimidating            | Phone-first, no password, no MFA, Tagalog labels                    |
| Food poisoning liability          | Mandatory safety declaration + `liabilityWaiverSigned` timestamp    |
| Donor never knows if food arrived | Real-time stepper + push notifications at every status change       |
| DPA violation                     | No GPS storage; barangay dropdown only; explicit privacy consent    |
| Facebook is easier                | Immediate QR generation + trackable lifecycle proves superior value |
| Orphaned accounts / failed writes | Atomic write pattern with recovery screen                           |
| Ghost donors / no-shows           | Reliability score visible to volunteers; cancellation penalties     |

The donor is never treated as a "user" of an app. They are treated as a **barangay resident with surplus food who needs a trustworthy, low-friction way to ensure it reaches a beneficiary instead of a trash bin.**
