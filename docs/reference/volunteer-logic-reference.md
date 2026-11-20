Here is the **in-depth architectural guide** for the volunteer side of ResQFood. This covers the registration pipeline, mission board mechanics, QR-tracked delivery lifecycle, and the specific logic that prevents the volunteer-related premortem failures.

---

## 1. Core Philosophy: "Join a Barangay Run, Not a Tech Platform"

The volunteer flow is designed for **SK members, church youth, jeepney drivers, and barangay tanods** — people who already do community work but coordinate via group chat or verbal assignment. The app does not try to recruit strangers. It tries to **digitize an existing runner** who is already trusted by their barangay.

**Premortem failures this answers:**

- _"Nobody wanted to be a volunteer"_ → Team-based registration mirrors existing social structures.
- _"Volunteers found the app intimidating"_ → No MFA at signup, action-oriented language ("Maghatid"), no email required.
- _"Race conditions on the mission board"_ → Atomic Firestore transactions with strict status transition rules.
- _"QR scanner failed outdoors"_ → Fallback PIN system + manual status override for broken cameras.
- _"They used Facebook instead"_ → The mission board filters by preferred barangays and shows reliability badges, making it faster than scrolling through a chaotic group chat.

---

## 2. Entry Point: The Role Gateway

The volunteer selects the card labeled:

> **"Maghatid ng Pagkain"**
> _"Maghatid ng sobrang pagkain mula sa donor patungo sa nangangailangan."_

**Logic:** This sets `intendedRole = 'volunteer'` in `sessionStorage` and redirects to `register/volunteer.html`. The language is **action-oriented** ("Deliver Food") rather than identity-oriented ("Become a Volunteer"), reducing psychological commitment friction.

---

## 3. The Volunteer Registration Pipeline: 6 Steps

### Step 1: Phone Verification (Identity Anchor)

Same infrastructure as the donor side: Firebase `signInWithPhoneNumber()` with E.164 normalization. No email, no password. The volunteer's phone is their identity.

**Edge case:** If the phone number is already registered as a donor, the app blocks registration and advises: _"Ang numerong ito ay nakarehistro na bilang Donor. Gumamit ng ibang numero para sa Volunteer account."_ This prevents role collision and keeps liability trails clean.

### Step 2: Identity & Commitment Pledge

**Fields:**

- `fullName` (3–100 chars).
- `nickname` (2–50 chars) — how they appear on the leaderboard and mission cards.

**The Commitment Pledge:**
A single question with two paths:

> _"Kaya mo bang maghatid ng pagkain 1-2 beses sa isang linggo?"_

- **"Oo, kaya ko"** → `role: "volunteer"`, `commitmentLevel: "regular"`. Full mission board access.
- **"Hindi sigurado / Paminsan-minsan lang"** → `role: "volunteer_backup"`, `commitmentLevel: "backup"`. Limited access.

**Why this matters:** This filters ghost volunteers without rejecting them. Backup volunteers see only urgent missions (unclaimed within 1 hour of pickup window), acting as a safety net rather than a primary workforce. This prevents the mission board from being full of inactive accounts.

### Step 3: Availability & Territory

**Availability Grid:**
Checkboxes for days (Mon–Sun) and time blocks:

- Morning: 6:00 AM – 12:00 PM
- Afternoon: 12:00 PM – 6:00 PM
- Evening: 6:00 PM – 10:00 PM

Stored as an array of strings: `["mon-morning", "wed-afternoon", "sat-morning"]`.

**Preferred Barangays:**
Multi-select dropdown of Cebu City barangays (max 10). This is the **territory filter** for the mission board. The app does **not** track GPS in real-time. It uses declared preference to respect privacy and reduce battery drain.

**Logic:** When the volunteer opens the mission board, the query uses Firestore's `in` operator on `pickupAddress.barangay` (or a top-level `barangay` field in the donation doc). This ensures the volunteer only sees missions they are realistically willing to travel to.

### Step 4: Emergency Contact

**Fields:** `emergencyContactName` and `emergencyContactNumber` (normalized to +63).

**Why this matters:** This signals legitimacy to the volunteer's family and creates a safety net. If a volunteer is injured during a pickup, the barangay has a contact. It also psychologically commits the volunteer — they are less likely to ghost if they provided an emergency contact.

### Step 5: Team Association (The Critical Social Layer)

**Field:** _"May team code ba ang iyong grupo?"_ (e.g., `SK-LAHUG-2026`, `SVD-YOUTH-2026`).

**Logic:**

- If the user enters a code, the app queries `teams/{teamCode}` in Firestore.
- If valid: `teamId` is set. The `teamCoordinatorId` receives a notification (via Firestore listener or in-app).
- If invalid: error message, but the user can clear the field and proceed as an **individual volunteer**.
- If blank: individual registration.

**Why this matters:** This mirrors how barangay mobilization actually works. An SK chairman or church coordinator registers the team first, then distributes codes. The app digitizes existing social structures rather than forcing atomized individualism. This is the primary reason volunteers will use the app instead of Facebook — their existing group is already inside it.

### Step 6: Certificate Preview & Registration

**Screen:** Shows a sample barangay certificate image:

> _"Barangay Lahug recognizes Juan Dela Cruz for rescuing 500kg of surplus food — March 2027."_

**Text:** _"Makukuha mo ang certificate na ito pagkatapos ng 10 missions. Puwede itong gamitin para sa school requirements o barangay record."_

**Firebase Write:**

```javascript
// Collection: users/{uid}
{
  uid: <auth_uid>,
  fullName: "Juan Dela Cruz",
  nickname: "Juan",
  contactNumber: "+639189876543",
  role: "volunteer", // or "volunteer_backup"
  commitmentLevel: "regular", // or "backup"
  availability: ["mon-morning", "wed-afternoon", "sat-morning"],
  preferredBarangays: ["Lahug", "Cebu Business Park", "Mabolo"],
  emergencyContact: {
    name: "Maria Dela Cruz",
    number: "+639171111111"
  },
  teamId: "SK-LAHUG-2026", // nullable
  mfaEnrolled: false, // Enforced only after 3rd mission or for high-privilege actions
  status: "pending_orientation", // CRITICAL: cannot accept missions until activated
  totalMissionsCompleted: 0,
  totalRescuedKg: 0,
  points: 0,
  badges: [],
  createdAt: serverTimestamp()
}
```

**Post-Registration:** Redirect to `volunteer/index.html` (Mission Board), but the board is **read-only** with a banner:

> _"Kailangan mong dumalo sa barangay orientation bago makatanggap ng missions. Makikipag-ugnayan sa iyo ang iyong team coordinator o LGU."_

The `status` field remains `pending_orientation` until an LGU admin or team coordinator flips it to `active`. This prevents untrained volunteers from accepting missions, failing, and uninstalling the app.

---

## 4. The Mission Board: Real-Time, Atomic, Filtered

### Layout Concept

```
┌─────────────────────────────────────────┐
│  Mission Board — Magandang araw, Juan!  │
│  [Filter ▼]  [My Stats]                 │
├─────────────────────────────────────────┤
│  🔴 URGENT — 2:00 PM pickup window      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  3kg Kanin • Lahug                      │
│  Maria's Eatery 🟢 Maaasahan            │
│  Pickup: Today, 2:00–4:00 PM            │
│  [ Accept Mission ]                     │
│                                         │
│  5kg Gulay • Mabolo                     │
│  Tindahan ni Aling Nena ⚪              │
│  Pickup: Tomorrow, 8:00–10:00 AM        │
│  [ Accept Mission ]                     │
│                                         │
│  ── BACKUP MISSIONS ONLY ──             │
│  (Only visible if role = volunteer_backup)│
└─────────────────────────────────────────┘
```

### Firestore Query Logic

```javascript
// For regular volunteers
const q = query(
  collection(db, "donations"),
  where("status", "==", "pending"),
  where("pickupAddress.barangay", "in", volunteer.preferredBarangays), // Max 10
  orderBy("pickupWindowStart", "asc"),
);

// Real-time listener
onSnapshot(q, (snapshot) => {
  renderMissionCards(snapshot.docs);
});
```

**Why `in` and not `array-contains`:** The donation document stores a single `barangay` string (from the donor's dropdown). The volunteer has an array of preferred barangays. Firestore's `in` operator allows up to 10 equality filters, which fits the max 10 barangay selection.

### The Atomic Claim Transaction

When the volunteer taps **"Accept Mission"**, the app runs a Firestore transaction. This is the single most critical piece of volunteer-side logic.

```javascript
await runTransaction(db, async (transaction) => {
  // 1. Read the donation document
  const donationRef = doc(db, "donations", donationId);
  const donationSnap = await transaction.get(donationRef);

  // 2. Verify it is still pending
  if (!donationSnap.exists() || donationSnap.data().status !== "pending") {
    throw new Error("Mission no longer available");
  }

  // 3. Atomically update
  transaction.update(donationRef, {
    status: "scheduled",
    volunteerId: auth.currentUser.uid,
    statusHistory: arrayUnion({
      status: "scheduled",
      timestamp: serverTimestamp(),
      volunteerId: auth.currentUser.uid,
    }),
  });
});
```

**Why this matters:** If two volunteers tap simultaneously, Firestore guarantees only one transaction succeeds. The other receives an error and sees a toast: _"Na-claim na ng ibang volunteer."_ This prevents the premortem scenario where two volunteers drive to the same pickup and one is turned away.

### Reliability Badge Display

Each mission card shows the donor's reliability score (from the `users` collection):

| Badge            | Condition                    | Volunteer Interpretation                        |
| ---------------- | ---------------------------- | ----------------------------------------------- |
| 🟢 **Maaasahan** | `reliabilityScore >= 30`     | Fast claim. Donor shows up, food is ready.      |
| ⚪ _(none)_      | Neutral                      | Standard risk.                                  |
| 🔴 **Baguhan**   | `< 3 donations` or score < 0 | Might cancel or be disorganized. Pick up early. |

**Logic:** This is fetched via a client-side join (get donorId from donation → fetch `users/{donorId}`). It is cached for the session to reduce Firestore reads.

---

## 5. Active Mission Lifecycle: The Three-Stage QR Flow

Once a mission is accepted, the volunteer is redirected to `volunteer/active-mission.html`.

### Screen Layout

```
┌─────────────────────────────────────────┐
│  ← Back to Mission Board                │
│                                         │
│  STATUS: SCHEDULED                      │
│  (Green badge, large)                   │
│                                         │
│  5kg Kanin                              │
│  Maria's Eatery, Lahug                  │
│  🟢 Maaasahan                            │
│                                         │
│  📞 Maria Santos: +639171234567          │
│  📍 Corner Gorordo Ave, Lahug            │
│  ⏰ Pickup: Today, 2:00–4:00 PM         │
│  ⏳ Window ends in 45 minutes            │
│                                         │
│  [  SCAN AT PICKUP  ]                   │
│  (Full-width, prominent)                │
│                                         │
│  [ Cancel Mission ]                     │
│  (Only if status === scheduled)         │
└─────────────────────────────────────────┘
```

### Status Transition Buttons

| Current Status | Button Label       | Next Status | Action                                                           |
| -------------- | ------------------ | ----------- | ---------------------------------------------------------------- |
| `scheduled`    | "Scan at Pickup"   | `pickedUp`  | Volunteer arrives at donor, scans QR. Donor notified.            |
| `pickedUp`     | "Scan En-Route"    | `enRoute`   | Volunteer leaves donor location. Org admin notified.             |
| `enRoute`      | "Scan at Delivery" | `delivered` | Volunteer arrives at beneficiary. Awaits org admin verification. |

**Cancellation Rule:** If the volunteer taps "Cancel Mission" while `scheduled`, the donation reverts to `pending` and `volunteerId` is cleared. If the status is `pickedUp` or beyond, cancellation is blocked. The volunteer must contact the donor or org admin directly.

---

## 6. The QR Scanner: Robust, Fallback-Ready

The scanner lives in `volunteer/scanner.html`. It runs full-screen with no navigation chrome to maximize camera viewport.

### Scanner Architecture

1. **Camera Stream:** `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` targets the rear camera.
2. **Frame Capture:** Every animation frame, draw the video frame to a hidden `<canvas>`.
3. **Decode:** `jsQR(canvasImageData, width, height)` scans for QR codes.
4. **Validation:** On decode, parse the JSON payload and verify:
   - `payload.d` (donationId) matches the active mission's ID.
   - The current user's `uid` matches the donation's `volunteerId`.
   - The requested stage transition is legal (e.g., cannot scan "Delivered" if current status is "Scheduled").

### Fallback: The 4-Digit PIN

If the camera fails (low light, cracked lens, permission denied), the volunteer taps **"Hindi gumagana ang camera"** and a PIN entry modal appears:

```
┌─────────────────────────────────────────┐
│  Manu-manong PIN Entry                    │
│                                         │
│  Hingin sa donor ang 4-digit PIN:       │
│  [ _ ] [ _ ] [ _ ] [ _ ]                 │
│                                         │
│  [ Confirm ]                            │
└─────────────────────────────────────────┘
```

**Logic:** The volunteer asks the donor or org admin for the PIN displayed on the donor's QR screen. They enter it manually. The app validates `fallbackPin` against the donation document. If matched, the status transition proceeds identically to a QR scan.

**Why this matters:** This directly addresses the premortem finding that `jsQR` fails in real-world barangay conditions (glare, low light, old phones). The PIN fallback ensures the delivery lifecycle can complete even with broken camera hardware.

### GPS Logging

On each successful scan or PIN entry:

```javascript
navigator.geolocation.getCurrentPosition(
  (pos) => {
    const gpsLat = pos.coords.latitude;
    const gpsLng = pos.coords.longitude;
    // Append to statusHistory entry
  },
  (err) => {
    // GPS denied or unavailable. Log null. Do not block the scan.
    const gpsLat = null;
    const gpsLng = null;
  },
  { enableHighAccuracy: true, timeout: 5000 },
);
```

**Privacy note:** GPS is logged only for the volunteer's own audit trail. It is not displayed to donors or admins in the prototype. The field exists for future accountability if a dispute arises ("Did you actually go to the soup kitchen?").

---

## 7. Offline Behavior for Volunteers

Volunteers operate in the field where connectivity is spotty. Firestore's offline persistence handles most cases automatically.

### Firestore Offline Persistence

Enabled via `enableIndexedDbPersistence()`. This allows:

- **Mission board browsing:** Cached data is visible even offline. A banner shows: _"Offline mode. Huling update: 2:00 PM."_
- **Status updates:** When a volunteer scans a QR offline, the Firestore write is queued. The app immediately shows a success toast: _"Status queued. Mag-si-sync pag may signal."_
- **Automatic sync:** When the device reconnects, Firestore flushes the queue. The status updates on the donor and admin dashboards in real-time.

### Non-Firestore Actions

If the volunteer needs to upload a photo proof (future feature), the app stores the blob in IndexedDB and flushes when online. For the Phase 1 prototype, this is not required.

---

## 8. Volunteer History & Reputation

### History Page (`volunteer/history.html`)

**Stats Cards:**

- _"Kabuuang nailigtas: 47 kg"_
- _"Nakumpletong misyon: 8"_
- _"Kasalukuyang puntos: 240"_

**Certificate Progress:**

- Progress bar: _"3/10 missions para sa barangay certificate"_
- On reaching 10 verified missions, a button appears: _"I-download ang Certificate"_ (generates a client-side PDF using `jspdf` or simple HTML print-to-PDF).

**Mission List:**
Each past mission shows:

- Food type, quantity, date.
- Beneficiary org name (resolved from `orgAdminId`).
- Status badge (`verified`, `cancelled`, etc.).

**Badges:**
Rendered as pills from the `badges` array:

- `First Rescuer` (1st mission)
- `Regular Runner` (5 missions)
- `Community Hero` (20 missions)
- `Punctual Pal` (on-time pickup bonus)

---

## 9. Firestore Security Rules for Volunteer Operations

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: Volunteers can create own profile
    match /users/{userId} {
      allow create: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.role in ['volunteer', 'volunteer_backup']
                    && request.resource.data.keys().hasAll([
                         'fullName', 'contactNumber', 'role',
                         'availability', 'preferredBarangays', 'emergencyContact'
                       ]);
      allow read: if request.auth != null;
      allow update: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.role == resource.data.role; // No role escalation
    }

    // Donations: Volunteer lifecycle rules
    match /donations/{donationId} {
      // Anyone authenticated can read pending missions (for mission board)
      allow read: if request.auth != null;

      // Volunteer can claim: must be pending → scheduled, and set volunteerId
      allow update: if request.auth != null
                    && (
                      // Claim mission
                      (resource.data.status == 'pending'
                       && request.resource.data.status == 'scheduled'
                       && request.resource.data.volunteerId == request.auth.uid)
                      ||
                      // Progress mission: pickedUp, enRoute, delivered
                      (resource.data.volunteerId == request.auth.uid
                       && resource.data.status in ['scheduled', 'pickedUp', 'enRoute']
                       && request.resource.data.status in ['pickedUp', 'enRoute', 'delivered']
                       && isValidTransition(resource.data.status, request.resource.data.status))
                      ||
                      // Cancel mission: revert to pending
                      (resource.data.volunteerId == request.auth.uid
                       && resource.data.status == 'scheduled'
                       && request.resource.data.status == 'pending'
                       && !request.resource.data.keys().hasAny(['volunteerId'])) // Clears volunteerId
                    );
    }

    // Helper function for status transitions
    function isValidTransition(from, to) {
      return (from == 'scheduled' && to == 'pickedUp')
          || (from == 'pickedUp' && to == 'enRoute')
          || (from == 'enRoute' && to == 'delivered');
    }
  }
}
```

**Logic:** These rules enforce the business logic at the database layer. Even if a malicious client tries to skip from `scheduled` directly to `delivered`, Firestore rejects the write. Even if they try to claim a mission already assigned to another volunteer, the transaction fails because the status is no longer `pending`.

---

## 10. Summary: What Makes This Flow Solid

| Premortem Risk                     | Architectural Response                                               |
| ---------------------------------- | -------------------------------------------------------------------- |
| Nobody wanted to volunteer         | Team code registration mirrors existing SK/church groups             |
| App felt intimidating vs. Facebook | Phone-first, no MFA, no email, Tagalog labels, action-oriented       |
| Race conditions (double claim)     | `runTransaction` with pending→scheduled atomic check                 |
| QR scanner failed outdoors         | jsQR + full-screen viewfinder + 4-digit PIN manual fallback          |
| Volunteer got lost / no-showed     | Active mission screen shows donor contact, pickup countdown, address |
| Offline in the field               | Firestore offline persistence queues status updates automatically    |
| Ghost volunteers                   | `pending_orientation` gate + commitment pledge filters serious users |
| No accountability                  | GPS logging per scan, statusHistory audit trail, reliability badges  |

The volunteer is never treated as a gig worker or app user. They are treated as a **barangay runner** who already exists in the community, and the app simply gives them a faster, more accountable way to find missions than scrolling through a Facebook group chat.
