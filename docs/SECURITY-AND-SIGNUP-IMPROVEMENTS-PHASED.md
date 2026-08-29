# Security & Signup Improvements — Phased Plan

Purpose: list identified flaws in the current workspace and provide a phased, minimal-first roadmap to harden auth, invite, QR, storage, and role workflows before adding real server logic.

SUMMARY
- High-risk findings: client-supplied `role` at account create, demo OTP that bypasses Auth, lack of server admin callables for invites/role assignment, missing `storage.rules` file, no server-side QR/invite verification.

HIGH-PRIORITY FIXES (apply immediately)
- Disallow client-supplied `role` on user create. Update `firestore.rules` to require `role` be absent or `pending` and only set via admin callable.
- Replace demo OTP flows with real Firebase Auth flow (use `public/js/core/auth.js` `signInWithPhoneNumber`) so `context.auth.uid` is always present before server writes.
- Prevent client from writing `role` from UI: change `public/js/register/shared.js` to stop sending `role` and call server callable `signupWithProfile` instead.
- Add a minimal `storage.rules` file referenced by `firebase.json` to prevent open uploads to sensitive paths.

PHASED ROADMAP

Phase 0 — Design & Spec (1–2 days)
- Deliverables: `docs/SIGNUP-SPEC.md`, finalize `users/{uid}` and `verificationRequests` schemas, decide invite lifetime and token format, identify admin accounts.
- Actions:
  - Choose roles: `donor`, `volunteer`, `orgAdmin`, `lguAdmin`, `systemAdmin`.
  - Define `users/{uid}` fields and `verificationRequests/{id}` model.

Phase 1 — Minimal-First Hardening (small, safe changes)
- Goal: stop client role injection and ensure server-authenticated profile writes.
- Deliverables and file changes:
  - `firestore.rules`: block client-supplied `role` at create; only allow owner writes to limited fields.
  - `functions/lib/authSignup.js`: callable `signupWithProfile(data, context)` to validate and write `users/{uid}` server-side (no `role`).
  - `functions/index.js`: export `signupWithProfile` callable.
  - `public/js/register/*`: after Auth sign-in, call `signupWithProfile` instead of writing `users` directly.
  - `tests/signup-minimal-test.js`: emulator test verifying `users/{uid}` written by callable and client cannot set `role`.

Phase 2 — Admin primitives & invite flow (medium)
- Goal: provide secure admin APIs for invite issuance and role assignment.
- Deliverables and file changes:
  - `functions/lib/invite.js` — `createInvite`, `validateInvite`, `consumeInvite`, `revokeInvite`. Store only `tokenHash`, single-use, expiry, and audit entry.
  - `functions/lib/assignRole.js` — admin callable `assignRole({uid, role}, context)` that calls `admin.auth().setCustomUserClaims(uid,{role})`, updates `users/{uid}`, writes `auditLogs`.
  - Admin UI wiring (optional): `public/admin/*` callables for invite creation and review.
  - `tests/invite-test.js`, `tests/assignRole-test.js` — emulator tests.

Phase 3 — QR tokens, verification & reconciliation (medium → advanced)
- Goal: implement signed, short-lived QR tokens + atomic consume semantics and audit trail.
- Deliverables and files:
  - `functions/lib/qr.js` — `createQr(donationId)`, `verifyAndConsumeQr(token, pin, meta)`, `verifyDelivery(token, meta)`; store hashed token, single-use flags, and `verifications` records.
  - Frontend: `public/js/qr/generator.js`, `public/js/qr/scanner.js` to handle QR+PIN UX.
  - Tests: `tests/qr-test.js` for race conditions and expiry.

Phase 4 — Storage rules, offline, CI, rollout (final)
- Implement `storage.rules` securing `authorization-letters/{uid}/...`, `donation-images/...`, `user-avatars/...`.
- Add offline reconciliation logic and conflict detection for queued scans.
- Add CI job to start emulators and run tests; deploy to staging for integration verification; add migration/runbook for existing users.

CONCRETE IMMEDIATE PATCHES (small PRs)
1. Patch `firestore.rules` to prevent client role at create (one-liner change).
2. Edit `public/js/register/shared.js` to remove any `role` being set and add TODO comment to call server callable.
3. Add `storage.rules` with minimal conservative rules.

COMMANDS TO RUN LOCALLY (emulator + tests)
```bash
npm install
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy
firebase emulators:start --only auth,firestore,functions --project resqfood-ec8f5
env FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=resqfood-ec8f5 node tests/signup-minimal-test.js
```

SECURITY CHECKLIST
- Never accept client-supplied `role` values.
- Store only hashed tokens/PINs in DB.
- Make invites and QR tokens single-use and short-lived.
- Restrict admin callables to `systemAdmin` custom claim only.
- Write immutable `auditLogs` for all sensitive actions.
- Rate-limit invite/QR validation endpoints.

NEXT RECOMMENDED ACTION
- I can implement the Phase 1 immediate patches now (update `firestore.rules`, update `public/js/register/shared.js`, add `functions/lib/authSignup.js` scaffold and `tests/signup-minimal-test.js`). Confirm and I'll create the PR-sized changes.
