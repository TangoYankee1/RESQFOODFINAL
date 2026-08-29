# Realistic backend scope for ResQFood

## Goal

This project has a strong product and UX design for donor, volunteer, organization, and LGU flows, but the backend is not yet fully implemented in a realistic production-ready way. Based on the project documentation and the current codebase, the most realistic backend implementation is a Firebase-first backend with Firestore, Firebase Auth, Firebase Storage, and a small set of Cloud Functions for state transitions and notifications.

Key evidence:
- [firebase.json](../firebase.json) configures Hosting + Firestore + Storage + Functions.
- [functions/index.js](../functions/index.js) is empty.
- The logic docs describe many role flows and data rules, but those are not yet backed by full server-side enforcement.

---

## 1. What is already present in the project

The project already includes:

- Frontend pages for donor, volunteer, org admin, and LGU admin flows
- Firebase web config and browser-side logic in [public/js/core/firebaseConfig.js](../public/js/core/firebaseConfig.js)
- Role-based UI flows described in the logic references and demo docs
- Firestore rule design ideas in the project docs
- Tailwind + static hosting structure for a Firebase PWA

These are good for a prototype and demo, but they are not a complete backend by themselves.

---

## 2. What is not realistically implemented yet

The project currently has a lot of frontend logic and strong product expectations, but the realistic backend requires a server-side layer for the following:

### A. Core business state transitions
The app expects donation lifecycle changes such as:
- pending -> scheduled
- scheduled -> pickedUp
- pickedUp -> enRoute
- enRoute -> delivered
- delivered -> verified
- canceled / expired / rejected states

These should be enforced server-side, not only by browser code. A browser alone is not reliable for business integrity.

### B. Atomic claim and race-condition protection
The volunteer flow requires an atomic transaction when one volunteer claims a donation. Without a backend transaction, two volunteers can claim the same mission in parallel.

This is one of the most critical pieces of logic in the project and is realistic only if implemented server-side using Firestore transactions or Cloud Functions.

### C. QR validation and verification integrity
The QR scanner and verification flow needs trusted validation of:
- donation existence
- correct donor / volunteer / org assignment
- allowed status transitions
- tamper checks
- audit history

These checks should exist in server-backed validation, not only in client-side JS.

### D. Security rules for role access
The project defines a rich set of role policies, but these need to be enforced in Firestore security rules and Cloud Functions. If not, the browser can bypass logic and tamper with data.

### E. Notifications and audit trail
The app expects notifications for:
- donor updates
- volunteer progress
- org admin verification
- LGU admin actions
- escalation reminders

A realistic backend should trigger these via Cloud Functions or a notification service, with records stored in Firestore.

### F. Reporting and dashboard aggregation
The LGU/admin flows talk about metrics, exports, and report aggregation. Running these directly from the browser is not scalable or safe. Real aggregation should happen on the backend or imported into a reporting layer.

---

## 3. Realistic MVP backend scope

The realistic MVP should focus on the minimum backend features that make the product trustworthy.

### Must-have backend features

1. Firebase Auth + role mapping
   - donor
   - volunteer
   - org-admin
   - lgu-admin
   - systemAdmin
   - map to Firestore user profile and permissions

2. Firestore collections
   - users
   - donations
   - organizations
   - teams
   - notifications
   - auditLogs
   - invitations or tokens

3. Donation lifecycle logic
   - create donation
   - accept mission
   - pickup and route transitions
   - delivery verification
   - cancellation and expiry handling

4. Cloud Functions
   - onDonationCreate
   - onDonationUpdate
   - notify donor / volunteer / org admin
   - recalc metrics
   - expire stale donations
   - log audit trail

5. Firestore rules
   - donors can create only their own profile and their own donation records
   - volunteers can only claim pending donations under valid conditions
   - org admins can verify only deliveries associated with their organization
   - LGU admins can read aggregate data but not alter everything arbitrarily

6. Storage rules
   - donor-uploaded images only for their own donation photos
   - org or admin uploads only if relevant

7. Offline-safe queue handling
   - queued writes while offline
   - retry when network returns
   - identify conflict states when syncing

### Nice-to-have but not core MVP

- full analytics warehouse
- PDF report generation
- advanced machine-learning scoring
- complex push subscriptions
- production-grade queueing beyond Firebase-native patterns

---

## 4. Recommended realistic data model

### users
```json
{
  "uid": "string",
  "role": "donor|volunteer|orgAdmin|lguAdmin|systemAdmin",
  "fullName": "string",
  "phoneNumber": "string",
  "barangay": "string",
  "status": "active|pending_orientation|suspended|locked",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### donations
```json
{
  "donationId": "string",
  "donorId": "string",
  "volunteerId": "string|null",
  "organizationId": "string|null",
  "status": "pending|scheduled|pickedUp|enRoute|delivered|verified|cancelled|expired",
  "foodType": "string",
  "quantityKg": "number",
  "pickupWindowStart": "timestamp",
  "pickupWindowEnd": "timestamp",
  "pickupAddress": "string",
  "barangay": "string",
  "safetyDeclared": true,
  "fallbackPin": "string",
  "qrPayload": "string",
  "statusHistory": ["array of events"],
  "createdAt": "timestamp"
}
```

### notifications
```json
{
  "notificationId": "string",
  "recipientUid": "string",
  "type": "donation_update|mission_claim|delivery_verified|reminder",
  "message": "string",
  "read": false,
  "createdAt": "timestamp"
}
```

### auditLogs
```json
{
  "logId": "string",
  "entityType": "donation|user|organization",
  "entityId": "string",
  "action": "status_changed|claim_added|verification_confirmed",
  "actorUid": "string",
  "details": "map",
  "createdAt": "timestamp"
}
```

---

## 5. Realistic backend implementation flow

### Phase 1: Define the true source of truth
- Confirm which user roles exist
- Decide which data is stored in Firestore
- Decide which actions are truly server-enforced
- Eliminate client-only logic that cannot be trusted

### Phase 2: Build the core collections and indexes
- users
- donations
- organizations
- notifications
- auditLogs
- teams
- create necessary Firestore indexes for status and barangay queries

### Phase 3: Implement Auth and role checks
- create user profiles on sign-up
- validate role permissions
- check active status before mission acceptance or verification

### Phase 4: Implement the top-priority transactions
- volunteer mission claim transaction
- donation status updates with allowed transitions
- verification flow with QR/PIN validation

### Phase 5: Add Cloud Functions
- donation lifecycle updates
- notification triggers
- stale donation expiry reminders
- metrics aggregation for admin dashboards

### Phase 6: Add Firestore security rules
- allow only required operations per role
- prevent changing status outside allowed transitions
- restrict uploads and reads by ownership or organization

### Phase 7: Test with Firebase emulator
- run local Firestore emulator
- test race conditions and invalid transitions
- simulate offline writes and retries
- validate notifications and audit logs

### Phase 8: Deploy and monitor
- deploy functions and rules
- monitor logs
- verify admin dashboards and data consistency

---

## 6. Recommended priority order for this project

### Priority 1: Core trusted flows
1. donation creation and validation
2. volunteer claim transaction
3. QR/PIN verification flow
4. donation status transition rules
5. role-based Firestore rules

### Priority 2: Operational safety
6. notifications
7. audit logs
8. retry/offline handling
9. stale mission expiry and cancellation logic

### Priority 3: Admin and reporting
10. dashboard metrics
11. exports
12. organization status management
13. advanced analytics and filtering

---

## 7. Bottom line

The project is strong from a UX and product design standpoint, but the realistic backend implementation is not “build everything at once.” The right MVP is:

- Firebase Auth + Firestore
- clear role permissions
- trusted donation lifecycle transitions
- atomic claim logic
- QR and PIN verification with backend validation
- notifications + audit logs
- Firestore rules and Cloud Functions to enforce the business logic

Anything beyond that should be treated as phase 2 or phase 3 work.

---

## 8. Suggested next step

Proceed with a backend-first implementation plan based on these priorities, starting with:

1. Firestore schema
2. Security rules
3. claim transaction
4. status transition enforcement
5. Cloud Functions for notifications and audit
6. emulator testing

This is the most realistic and maintainable path for this project.
