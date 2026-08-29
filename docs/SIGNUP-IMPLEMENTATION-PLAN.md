# Sign-up / Sign-in Implementation Plan (BK-0011)

Purpose: provide a phased, error-minimizing, step-by-step implementation for secure sign-up and sign-in across roles (`donor`, `volunteer`, `org-admin`, `lgu`, `systemAdmin`). Follow phases in order; do not skip phases.

---

## Phase 0 — Prerequisites (safe checks)
- Ensure Node, npm, and `firebase-tools` are installed and on PATH.
- Ensure the repo `package.json` dependencies are installed (`npm install`).
- Ensure Firestore, Auth, and Functions emulators are available locally for tests.

Commands (local):
```
# install deps
npm install

# start emulators for iterative development
firebase emulators:start --only auth,firestore,functions --project resqfood-ec8f5
```

---

## Phase 1 — Design & Schema (1–2 days)
Goal: finalize roles, profile fields, verification gates, and user schema before coding.

1. Define roles and privileges
   - Roles: `donor`, `volunteer`, `org-admin`, `lgu`, `systemAdmin`.
   - Privileges: who can call sensitive callables (`assignRole`, `transitionDonationStatus`, `createPromotion`, etc.).

2. Define `users/{uid}` schema (minimal):
   - `role` (string | null)
   - `displayName` (string)
   - `phone` (string, E.164)
   - `email` (string|null)
   - `barangay` (string|null)
   - `profileComplete` (bool)
   - `verified: { phone: bool, email: bool, docs: bool }`
   - `createdAt`, `updatedAt`

3. Define `verificationRequests/{id}` schema (for LGU/org docs):
   - `uploaderUid`, `type`, `storagePath`, `status` (pending/approved/rejected), `createdAt`, `reviewerUid`.

4. Document flow for each role (in a short table): required fields, verification steps, who approves.

Record these decisions in `docs/SIGNUP-IMPLEMENTATION-PLAN.md` and `docs/backend-log.md` as BK entries.

---

## Phase 2 — Server primitives (2–3 days)
Goal: implement secure server-side callables and helpers. Keep each callable small and well-tested.

Files to add (implement one-by-one and test each):

1. `functions/lib/authSignup.js` — core callable(s)
   - `signupWithProfile(data, context)` — callable for authenticated users to save their profile.
     - Preconditions: `context.auth.uid` exists.
     - Validate fields server-side (sanity checks: name length, barangay exists, phone regex).
     - Use Firestore transaction to create/update `users/{uid}` WITHOUT setting `role` (role assignment is separate).
     - Return `{ success: true }` or structured validation errors.
   - `createAuthUserForAdmin(data, context)` — admin-only helper to create an Auth user if needed (email/password flows).

2. `functions/lib/assignRole.js` — admin-only role assignment
   - `assignRole({ uid, role }, context)` callable.
   - Verify caller: `context.auth.token.role === 'systemAdmin'` (or list of admin UIDs).
     - Validate `role` allowed list.
     - Call `admin.auth().setCustomUserClaims(uid, { role })`.
     - In a Firestore transaction, set `users/{uid}.role = role` and write an audit log `auditLogs/{id}`.
     - Return `{ success: true }`.

3. `functions/lib/verification.js` (optional helper)
   - `createVerificationRequest(uploaderUid, type, storagePath)` helper to centralize validation and audit.

Export these callables from `functions/index.js` (use existing shim if `firebase-functions` not present). Keep handlers small.

Security notes for server code:
- Never accept `role` from client except via `assignRole`.
- Validate all inputs server-side and fail fast with `HttpsError` codes.

---

## Phase 3 — Frontend integration (1–2 days)
Goal: wire registration pages to callables, keep client logic minimal, and rely on server validations.

1. Authentication flow (client side)
   - Use existing `public/js/core/auth.js` for phone OTP sign-in (`signInWithPhoneNumber`). After successful phone auth, user has `auth.currentUser.uid`.
   - Immediately call server callable `signupWithProfile({ profileFields })` to create `users/{uid}` document.
   - Do not let client set `role` — the UI shows role the user selected but server will store it only after admin assignment or predefined rules.

2. LGU / Org registration
   - Upload documents to Storage path `authorization-letters/{uid}/{filename}`.
   - Call `createVerificationRequest({ type: 'lgu_letter', storagePath })` callable to queue review.
   - Show pending screen; do not grant elevated access until `assignRole` is called by admin.

3. Admin UI (basic)
   - Add `admin/verify.html` with list of `verificationRequests` and buttons Approve/Reject.
   - On Approve, call `assignRole({ uid, role: 'lgu' })`.

UX notes:
- Show clear feedback: "Awaiting verification" screens and email/SMS confirmations.

---

## Phase 4 — Firestore & Storage rules (small, critical change)
Goal: enforce role-based access via security rules carefully and iteratively.

1. Rules to enforce (incremental rollout):
   - `users/{uid}`: allow user to write own profile fields except `role`.
   - `users/{uid}/role` update: deny client writes; allow only server-side admin callables or trusted service account to write.
   - `verificationRequests/{id}`: create by owner; update by admin roles only.
   - Storage: allow upload to `authorization-letters/{auth.uid}/...` by owner; admin read as required.

2. Testing rules:
   - Write unit tests using the Firestore & Storage emulator to validate each rule change before deploy.

---

## Phase 5 — Tests & emulators (2–3 days)
Goal: create deterministic tests that run in CI and catch regressions.

1. Add `tests/signup-test.js`:
   - Start Auth + Firestore emulator locally (CI will start them too).
   - Create a test Auth user (simulate phone sign-in by creating user in Auth emulator – no SMS needed in emulator).
   - Invoke `signupWithProfile` handler (callable shim or functions emulator) and assert `users/{uid}` created with expected fields.
   - Use admin context to call `assignRole` and assert custom claims and `users/{uid}.role` set.

2. Add negative tests:
   - Client attempts to write `role` directly to `users/{uid}` — should be denied by rules.
   - Non-admin tries to call `assignRole` — should be denied.

3. CI integration:
   - Add job step that starts emulators, runs `npm test` or `node tests/signup-test.js`, then tears down.

---

## Phase 6 — Rollout & monitoring
Goal: deploy to staging, monitor, and then deploy to production.

1. Deploy to a staging Firebase project with functions and rules updated.
2. Run full integration tests against staging (manual QA + automated tests).
3. Add audit logs and alerts (Cloud Logging) for `assignRole` events.
4. Once stable, deploy to production with migration notes (if existing users require a `role` field default or mapping).

---

## Phase 7 — Documentation & cleanup
Goal: finalize docs, create migration instructions, and open PR.

1. Update `docs/backend-log.md` with BK entries for each implemented phase (`BK-0013`, `BK-0014`, ...).
2. Add `README` section: How to run sign-up tests locally and in CI.
3. Open PR referencing tests and include reviewers for security and LGU workflows.

---

## Minimal-first implementation (safe subset) — recommended initial iteration
1. Implement `signupWithProfile` callable that writes `users/{uid}` (no role assignment).
2. Wire client registration for `donor` and `volunteer` to call it after OTP sign-in.
3. Implement `assignRole` but keep it callable only via console (admin UIDs list) until review UI exists.
4. Add basic tests for steps above and update rules to prevent client role writes.

---

## Security and rollback checklist
- Ensure `assignRole` requires admin claim and logs every assignment in `auditLogs`.
- Test security rules thoroughly on emulator before deploying functions.
- Provide rollback steps: revert rules, revoke custom claims (via admin SDK), and pause new registrations if needed.

---

If you want, I will now implement the minimal-first subset: `functions/lib/authSignup.js` (callable `signupWithProfile`), export in `functions/index.js`, and add `tests/signup-test.js` to validate `users/{uid}` creation. Confirm and I will start coding.
