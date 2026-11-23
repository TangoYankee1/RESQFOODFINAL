# Sample Source Code

## Selected Implementation Parts

The following five source-code portions are worth presenting in the thesis because they demonstrate the project's major architectural choices, security controls, and operational correctness:

1. **Firebase Emulator Configuration** - shows how the browser connects Auth, Firestore, Storage, and Functions to local emulator services.
2. **Philippine Mobile OTP and Route Protection** - shows phone-number validation, OTP confirmation, role resolution, and protected-route redirection.
3. **Server-Validated Donation Posting** - shows server-derived identity, input validation, active-destination checks, and idempotent retry handling.
4. **Atomic Pickup and Receipt Handover** - shows purpose-bound QR/PIN verification and atomic state, audit, receipt, and notification updates.
5. **Transactional Community Request Handling** - shows caller validation, organization availability and coverage checks, one-active-request limits, and cooldown enforcement.

These excerpts are representative portions of the implemented source code. Complete implementations also include imports, error handling, registration of callable functions, and additional tests.

---

## 1. Firebase Emulator Configuration

**Purpose:** Determine whether the application is running locally and route Firebase services to the emulator ports.

**Source:** [`public/js/core/firebaseConfig.js`](../public/js/core/firebaseConfig.js)

```javascript
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

const isLocalDev =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

if (isLocalDev) {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
  connectFunctionsEmulator(functions, "localhost", 5001);
  console.log("Using Firebase emulators for local development.");
}

enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Firestore persistence warning:", err.code);
});
```

**Significance:** The application uses separate emulator endpoints during local thesis demonstration while preserving a production Firebase configuration in the codebase.

---

## 2. Philippine Mobile OTP and Route Protection

**Purpose:** Normalize Philippine mobile numbers, verify the Firebase-issued OTP, resolve the account role, and prevent unauthorized role access.

**Source:** [`public/js/core/auth.js`](../public/js/core/auth.js)

```javascript
export function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    return "+" + digits;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return "+63" + digits.slice(1);
  }
  if (digits.length === 10) {
    return "+63" + digits;
  }
  return "+" + digits;
}

export function isValidPHPhone(raw) {
  return /^\+639\d{9}$/.test(normalizePhone(raw));
}

export async function sendOTP(rawPhone, containerId) {
  const phone = normalizePhone(rawPhone);
  if (!isValidPHPhone(phone)) {
    throw new Error("Invalid Philippine phone number");
  }

  const verifier = initRecaptcha(containerId);
  const confirmation = await signInWithPhoneNumber(
    auth,
    phone,
    verifier
  );
  return { confirmation, phone, sentAt: Date.now() };
}
```

```javascript
export async function requireRole(roles, opts = {}) {
  const user = await getCurrentUser();
  if (!user) {
    saveIntent(opts.next || location.pathname);
    throw new Error("Unauthenticated");
  }

  const role = await getSessionRole(user);
  const allowed = Array.isArray(roles) ? roles : [roles];

  if (!role || !allowed.includes(role)) {
    throw new Error("The account does not have the required role");
  }

  return { user, role };
}
```

**Significance:** The system validates the mobile number format and uses authenticated custom claims or the server-created profile to enforce role access. Client-side safeguards do not replace server authorization.

---

## 3. Server-Validated Donation Posting

**Purpose:** Prevent duplicate or changed retry submissions, validate pickup policy, and ensure that donations target an active organization.

**Source:** [`functions/lib/donor.js`](../functions/lib/donor.js)

```javascript
async function createDonorDonation(db, uid, input) {
  const ref = db
    .collection("donations")
    .doc(`${uid}_${input.requestId}`);

  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify([
      input.foodType,
      input.quantityKg,
      input.description,
      input.pickupAddress,
      input.orgId,
      input.pickupWindowStart,
      input.pickupWindowEnd,
      input.safetyDeclared,
      input.postingConfirmed,
    ]))
    .digest("hex");

  return db.runTransaction(async (tx) => {
    const user = await tx.get(
      db.collection("users").doc(uid)
    );

    if (
      !user.exists ||
      user.data().role !== "donor" ||
      user.data().status !== "active"
    ) {
      return { success: false, reason: "permission-denied" };
    }

    const existing = await tx.get(ref);
    if (existing.exists) {
      return existing.data().requestFingerprint === fingerprint
        ? { success: true, donationId: ref.id, reused: true }
        : { success: false, reason: "request_conflict" };
    }

    const invalid = validateDonation(input, new Date());
    if (invalid) {
      return { success: false, reason: invalid };
    }

    const org = await tx.get(
      db.collection("organizations").doc(input.orgId)
    );
    if (!org.exists || org.data().status !== "active") {
      return {
        success: false,
        reason: "destination_inactive",
      };
    }

    tx.create(ref, {
      donationId: ref.id,
      donorId: uid,
      orgId: org.id,
      orgName: org.data().orgName,
      foodType: input.foodType,
      quantityKg: input.quantityKg,
      pickupAddress: input.pickupAddress.trim(),
      pickupWindowStart: asDate(input.pickupWindowStart),
      pickupWindowEnd: asDate(input.pickupWindowEnd),
      status: "pending",
      requestFingerprint: fingerprint,
      createdAt: new Date(),
    });

    return { success: true, donationId: ref.id, reused: false };
  });
}
```

**Significance:** The same stable request ID can safely retry a lost response without creating a duplicate donation. A changed payload is rejected rather than silently creating another record.

---

## 4. Atomic Pickup and Receipt Handover

**Purpose:** Consume purpose-bound QR or PIN proof once and atomically update the donation status, handover receipt, audit log, and recipient notifications.

**Source:** [`functions/lib/handover.js`](../functions/lib/handover.js)

```javascript
return db.runTransaction(async (tx) => {
  const actor = await tx.get(
    db.collection("users").doc(uid)
  );
  const donation = await tx.get(donationRef);

  if (
    !actor.exists ||
    actor.data().status !== "active" ||
    actor.data().role !== role
  ) {
    return { success: false, reason: "permission-denied" };
  }

  if (!donation.exists) {
    return { success: false, reason: "not_found" };
  }

  const d = donation.data();
  const expected =
    purpose === "pickup" ? "scheduled" : "delivered";
  const next =
    purpose === "pickup" ? "pickedUp" : "verified";

  if (d.status !== expected) {
    return { success: false, reason: "invalid_state" };
  }

  if (!commit) {
    return {
      success: true,
      donationId,
      purpose,
      preview: true,
    };
  }

  tx.update(credentialRef, {
    used: true,
    usedAt: now,
    usedBy: uid,
    usedReason: "confirmed",
  });

  tx.update(donationRef, {
    status: next,
    updatedAt: now,
  });

  tx.create(receiptRef, {
    donationId,
    purpose,
    requestId,
    actorUid: uid,
    fingerprint,
    newStatus: next,
    createdAt: now,
  });

  tx.set(db.collection("auditLogs").doc(), {
    action: "handover_confirmed",
    donationId,
    actorUid: uid,
    actorRole: role,
    fromStatus: expected,
    toStatus: next,
    createdAt: now,
  });

  return { success: true, donationId, newStatus: next };
});
```

**Significance:** Credential validation and business-state changes occur inside one transaction. If any dependent update fails, Firestore restores the transaction instead of allowing a partial handover.

---

## 5. Transactional Community Request Handling

**Purpose:** Restrict requests to verified residents, active organizations, supported sitios, availability rules, cooldown limits, and one active request per resident.

**Source:** [`functions/lib/communityRequests.js`](../functions/lib/communityRequests.js)

```javascript
exports.submitCommunityRequest =
  functions.https.onCall(async (data, context) => {
    const account = await resident(context);

    if (
      !validId(data.orgId) ||
      !validId(data.requestKey) ||
      !sitios.includes(data.sitio) ||
      !Number.isInteger(data.people) ||
      data.people < 1 ||
      data.people > 50 ||
      data.consent !== true
    ) {
      fail(
        "invalid-argument",
        "Check the name, sitio, and people count."
      );
    }

    const requestRef =
      db.collection("communityRequests").doc(
        crypto
          .createHash("sha256")
          .update(account.uid + ":" + data.requestKey)
          .digest("hex")
      );

    return db.runTransaction(async (tx) => {
      const existing = await tx.get(requestRef);
      if (existing.exists) {
        return {
          id: requestRef.id,
          status: existing.data().status,
        };
      }

      const orgSnap = await tx.get(
        db.collection("organizations").doc(data.orgId)
      );
      const org = orgSnap.data();

      if (
        !org ||
        org.status !== "active" ||
        availability(org) !== "accepting"
      ) {
        fail(
          "failed-precondition",
          "Organization is not accepting requests."
        );
      }

      if (
        Array.isArray(org.serviceSitios) &&
        org.serviceSitios.length > 0 &&
        !org.serviceSitios.includes(data.sitio)
      ) {
        fail(
          "failed-precondition",
          "The organization does not cover this sitio."
        );
      }

      tx.create(requestRef, {
        requesterUid: account.uid,
        orgId: data.orgId,
        orgName: org.orgName,
        name: data.name.trim(),
        phone: account.phoneNumber,
        sitio: data.sitio,
        people: data.people,
        note: data.note.trim(),
        consentAt: new Date(),
        status: "pending",
        createdAt: new Date(),
      });

      return { id: requestRef.id, status: "pending" };
    });
  });
```

**Significance:** Community request creation is centralized in a callable function instead of direct client writes. Transactional validation prevents duplicate submissions and invalid organization, sitio, or availability combinations.

