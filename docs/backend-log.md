# Backend Change Log

Purpose: Record every backend change, decision, and migration so backtracking and audits are simple.

Conventions:
- Each entry is one action / logical change and must include:
  - `id`: short incremental id (e.g., BK-0001)
  - `date`: YYYY-MM-DD
  - `author`: Name or handle of actor
  - `summary`: one-line summary
  - `details`: brief description of what changed and why
  - `files_changed`: paths modified
  - `rollback`: steps to revert the change
  - `notes`: links to PRs, commits, or tickets when available
- Append new entries to the top (most recent first).
- Keep entries concise but sufficient to reproduce or rollback.

---

## BK-0001 — 2026-08-22 — created
- author: maintainer + assistant
- summary: Create backend-log.md and add initial backend implementation plan to TODO list
- details: Added this change log file and updated project TODOs to include backend work items (Firestore schema, rules, functions, transactions, tests). Will use this file to record every subsequent backend change, schema migration, rules updates, Cloud Function additions, and emulator test runs.
- files_changed:
  - docs/backend-log.md (created)
  - docs/REALISTIC-BACKEND-SCOPE.md (referenced)
  - docs/EMULATOR-TEST-CHECKLIST.md (referenced)
- rollback:
  - remove `docs/backend-log.md` and revert TODO list update (commit or PR revert)
- notes:
  - Initial plan follows items from `docs/REALISTIC-BACKEND-SCOPE.md`.

---

### Next recommended entries (template)

- BK-0002: Implement Firestore `donations` collection schema
- BK-0003: Add Firestore security rules v0.1 (role-based read/write)
- BK-0004: Scaffold Cloud Functions and implement `claimDonation` transaction
 
---

## BK-0005 — 2026-08-22 — scaffolded claimDonation and emulator race test
- author: maintainer + assistant
- summary: Add `claimDonation` transaction helper, HTTP wrapper scaffold, and concurrent-emulator test; executed test against local Firestore emulator
- details: Implemented atomic claim logic in `functions/lib/claim.js` which performs a Firestore transaction to change `donations/{id}` from `pending` to `scheduled`, writes an `auditLogs` entry, and creates a `notifications` document. Added `functions/index.js` HTTP wrapper for later deployment. Added `tests/claim-test.js` which simulates two volunteers attempting to claim the same donation concurrently against the local emulator. Ran the test against the emulator; results are recorded below.
- files_changed:
  - functions/lib/claim.js (added)
  - functions/index.js (added)
  - tests/claim-test.js (added)
  - docs/backend-log.md (updated)
- rollback:
  - remove the added files and revert this log entry; restore previous `docs/backend-log.md` version
- notes:
  - Test command used locally: `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=resqfood-ec8f5 node tests/claim-test.js`
  - Test outcome: one caller succeeded and the other received `not_pending`; final `donations/don_0001` status is `scheduled` and a single `auditLogs` and `notifications` entry were recorded. See test output in terminal for exact result objects.

## BK-0006 — 2026-08-22 — made claimDonation callable + auth checks
- author: maintainer + assistant
- summary: Added `claimDonationCallable` Cloud Function (callable) with authentication and role checks; retained HTTP wrapper for manual testing.
- details: Updated `functions/index.js` to export `claimDonationCallable` that requires the caller to be authenticated and have `role: 'volunteer'` in their token. The callable uses `context.auth.uid` as the `volunteerId` to ensure callers cannot claim on behalf of others. The previous HTTP endpoint `claimDonation` was kept for manual testing. This change prepares the function for secure emulator testing and safer deployment.
- files_changed:
  - functions/index.js (updated)
  - docs/backend-log.md (updated)
- rollback:
  - revert `functions/index.js` to the previous version and remove this log entry
- notes:
  - To test the callable locally, start the functions + firestore emulators and call the function using the client SDK with a user that has `role: 'volunteer'` set in custom token or auth emulator configuration.
  - Example local test sequence is noted in the next steps.

## BK-0007 — 2026-08-22 — attempted functions emulator start; ran callable handler test
- author: maintainer + assistant
- summary: Attempted to start Functions emulator (failed in sandbox); executed direct callable-handler unit test simulating authenticated volunteers.
- details: Tried to start `firebase emulators:start --only functions` in the sandbox but the `firebase` CLI was not available in the sandbox PATH. As an alternative, exported the callable handler for direct unit testing (`claimDonationCallableHandler`) and executed `tests/claim-callable-test.js` with `FIRESTORE_EMULATOR_HOST` pointing to the running Firestore emulator. The test invoked the handler concurrently with two simulated volunteer auth contexts. Because the donation `don_0001` had already been claimed by a previous test run, both calls returned `failed-precondition` (not pending). The final state of `donations/don_0001` remains `scheduled` with a single `auditLogs` and `notifications` entry.
- files_changed:
  - functions/index.js (updated to export callable handler and shim `firebase-functions` for tests)
  - tests/claim-callable-test.js (added)
  - docs/backend-log.md (updated)
- rollback:
  - remove test file and revert `functions/index.js` changes; restore previous log
- notes:
  - Direct test command used:
    - `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=resqfood-ec8f5 node tests/claim-callable-test.js`
  - To run emulator-based callable tests later, install `firebase-tools` in the environment where the emulator will be launched and start `firebase emulators:start --only functions,firestore`.

## BK-0008 — 2026-08-22 — implemented donation lifecycle transition helper
- author: maintainer + assistant
- summary: Added `functions/lib/lifecycle.js` to enforce allowed state transitions and create audit + notification records server-side.
- details: Introduced a reusable `transitionDonationStatus` transaction helper that blocks invalid status changes, enforces volunteer/donor ownership rules, writes donation `statusHistory`, adds an `auditLogs` entry, and creates a `notifications` record for the relevant recipient. This follows the recommended backend order by moving the next critical business rule out of client-side JS and into a server-trusted function. This creates the foundation for real donation lifecycle enforcement without depending only on frontend code.
- files_changed:
  - functions/lib/lifecycle.js (created)
  - tests/lifecycle-test.js (created)
  - docs/backend-log.md (updated)
- rollback:
  - remove `functions/lib/lifecycle.js` and `tests/lifecycle-test.js`, then revert this log entry
- notes:
  - This helper is intentionally transaction-based and supports the next step: exposing a callable or HTTP wrapper for status transitions such as `scheduled -> pickedUp -> enRoute -> delivered -> verified`.

## BK-0009 — 2026-08-22 — added lifecycle transition test and verified invalid transition behavior
- author: maintainer + assistant
- summary: Added emulator test for lifecycle transitions and validated that invalid transitions are rejected while valid transitions succeed.
- details: Created `tests/lifecycle-test.js` to exercise a valid `scheduled -> pickedUp` transition and an invalid `pickedUp -> scheduled` transition. The test verifies that the transaction returns `invalid_transition` on illegal changes, while valid transitions update `status`, append to `statusHistory`, and create audit/notif records. This is the minimum realistic test coverage for server-enforced lifecycle integrity. It also documents the exact pattern for future tests around QR verification and donor cancellation flows.
- files_changed:
  - tests/lifecycle-test.js (created)
  - docs/backend-log.md (updated)
- rollback:
  - remove the lifecycle test and revert this log entry
- notes:
  - Test command used locally:
    - `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=resqfood-ec8f5 node tests/lifecycle-test.js`
  - The next recommended implementation step is to expose this helper via a callable function and add a donor-cancel and QR verification test suite.

## BK-0004 — 2026-08-22 — applied security rules v0.1 and backup

## BK-0010 — 2026-08-24 — added notification helper and test
- author: maintainer + assistant
- summary: Implemented `functions/lib/notify.js` helper and `tests/notification-test.js` to write notifications and audit entries for server-side sends.
- details: The notification helper `sendNotification` writes a `notifications` document and an associated `auditLogs` entry. Added a callable wrapper `sendNotificationCallable` in `functions/index.js` for testing and later use. Created `tests/notification-test.js` to run against the Firestore emulator to validate that notifications and audit entries are stored.
- files_changed:
  - functions/lib/notify.js (created)
  - functions/index.js (updated)
  - tests/notification-test.js (created)
  - docs/backend-log.md (updated)
- rollback:
  - remove the notification helper and test files and revert this log entry
- notes:
  - Local test command:
    - `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=resqfood-ec8f5 node tests/notification-test.js`
  - Next: wire `sendNotification` into functions triggers like `onDonationUpdate` and replace the stub with actual push/FCM sending if desired.

## BK-0011 — 2026-08-24 — scan auth and registration UI; plan real sign-in/sign-up implementation
- author: maintainer + assistant
- summary: Scanned frontend registration and auth scripts to prepare for implementing a production-ready sign-in/sign-up flow backed by Firebase Auth and Cloud Functions. Added this unfinished task to track implementing server-side account creation, role assignment, and secure onboarding flows.
- files_scanned:
  - public/js/core/firebaseConfig.js
  - public/js/core/auth.js
  - public/js/register/shared.js
  - public/js/register/donor.js
  - public/js/register/volunteer.js
  - public/register/index.html (UI entry)
  - functions/index.js (existing callables and auth checks)
- findings:
  - The frontend currently uses prototype/demo OTP flows and UI-only registration steps; there are UI helpers for normalization and atomic writes but no real Auth sign-up flow.
  - `public/js/core/auth.js` already contains a `sendOTP` wrapper and auth guards for future integration.
  - `functions/index.js` contains callable handlers that expect `context.auth.token.role` and therefore require server-assigned custom claims for role enforcement.
- next_steps (planned):
  1. Design server-side sign-up flows for each role (donor, volunteer, org-admin, lgu) including required profile fields and verification steps (phone, document upload for LGU/org).
  2. Implement Cloud Functions to perform secure account creation, email/phone verification handling, and assign/validate custom claims (`role`).
  3. Update frontend registration pages to call the new Signup callables and store profile records transactionally in `users/{uid}`.
  4. Add tests that run against the Firestore + Auth emulator covering role assignment and auth-protected callables.
  5. Update `firestore.rules` and re-run emulator tests.
- files_to_change (planned):
  - functions/lib/authSignup.js (new)
  - functions/index.js (export new callables)
  - public/js/register/* (hook to callables)
  - tests/signup-test.js (new)
- notes:
  - Because `functions/index.js` expects `context.auth.token.role`, we must implement secure custom claim assignment via an admin-only callable (or use Firebase Authentication triggers) to avoid role spoofing from the client.
  - This work is intentionally paused until the sign-up design is agreed; this log entry tracks the unfinished task.

  ## BK-0012 — 2026-08-24 — remaining todos (grouped)
  - author: assistant
  - summary: Consolidated outstanding work items and grouped them for prioritized follow-up.
  - remaining_by_group:
    - **Authentication & Onboarding**:
      - Design server-side sign-up flows per role (donor, volunteer, org-admin, LGU) including required verification and document upload.
      - Implement `functions/lib/authSignup.js` to create accounts securely and assign `role` via admin custom claims.
      - Hook frontend registration pages (`public/register/*` and `public/js/register/*`) to server Signup callables.
      - Add emulator tests for signup/signin and role assignment (Auth + Firestore emulator).
      - Update `firestore.rules` to enforce role-based access after signup.

    - **Emulator Tests & Reliability**:
      - Start full emulators (Firestore, Functions, Auth, Hosting) and standardize test env variables.
      - Finish emulator tests: claim race, lifecycle transitions, QR/PIN verification, donor-cancel flows.
      - Add offline/queued write tests and retry handling for client-side queued donations.

    - **Business Logic / Cloud Functions**:
      - Wire `sendNotification` into donation lifecycle triggers (e.g., `onDonationUpdate`) and add FCM or webhook senders.
      - Implement QR/PIN verification callable and server-side verification logic.
      - Implement donor-cancel callable and related lifecycle transitions with audit logging.

    - **Storage & Security**:
      - Implement Storage upload rules for `authorization-letters/`, donation images, and user avatars.
      - Add tests to validate storage rules with the emulator.

    - **CI, Deploy & Documentation**:
      - Create CI job to run emulator tests and fail on regressions.
      - Prepare staging deploy and run integration verification.
      - Update docs and presentation slides with verified results.
      - Open PR with changes and tests; include migration notes for rules/claims.

  - notes:
    - Items marked under **Authentication & Onboarding** are prerequisites for secure callable behavior because `context.auth.token.role` is relied upon across functions.
  
  ## BK-0013 — 2026-08-25 — Phase 0 spec added for signup/signin
  - author: assistant
  - summary: Added `docs/SIGNUP-SPEC.md` and updated `docs/firestore-schema.md` to include `verificationRequests` and `invites` collections as part of Phase 0 of BK-0011.
  - files_changed:
    - docs/SIGNUP-SPEC.md (created)
    - docs/firestore-schema.md (updated)
  - details: The spec defines roles (`donor`, `volunteer`, `orgAdmin`, `lguAdmin`, `systemAdmin`), required profile fields, invite policy, verification flows, and callable APIs (`signupWithProfile`, `createInvite`, `consumeInvite`, `assignRole`). The Firestore schema was expanded with `verificationRequests` and `invites` collections to support secure document verification and single-use invites.

## BK-0014 — 2026-08-25 — Phase 2 admin primitives implemented (invite + assignRole)
- author: assistant
- summary: Implemented server-side admin primitives for invite issuance and role assignment; added tests.
- files_changed:
  - functions/lib/assignRole.js (created)
  - functions/lib/invite.js (created)
  - functions/index.js (updated to export `assignRole`, `createInvite`, `validateInvite`, `consumeInvite` callables)
  - tests/invite-test.js (created)
  - tests/assignRole-test.js (created)
- details: `createInvite` generates a cryptographically-random token, stores only its SHA-256 hash in `invites/`, and writes an audit entry. `consumeInvite` atomically marks invites used and logs consumption. `assignRole` sets `customUserClaims` and updates `users/{uid}` inside a transaction and writes an audit log. Minimal emulator-friendly tests were added for both features.

## BK-0015 — 2026-08-25 — Phase 3: QR verification
- author: assistant
- summary: Implemented server-side QR verification helper and callable, plus smoke test.
- files_changed:
  - functions/lib/qr.js (created)
  - functions/index.js (updated to export `verifyQr` callable)
  - tests/qr-test.js (created)
- details: `verifyQr` locates `qrCodes` documents by a SHA-256 token hash, enforces single-use and expiry, marks codes used inside a transaction, and records an audit log. A simple smoke test `tests/qr-test.js` exercises verify + single-use semantics against the Firestore emulator.

## BK-0016 — 2026-08-25 — Phase 4: Firestore & Storage rules
- author: assistant
- summary: Hardened Firestore rules for signup, verification requests, audit/notification writes; added conservative Storage rules and unit tests for rules.
- files_changed:
  - firestore.rules (updated: restrict qrCodes updates, add verificationRequests, tighten audit/notification rules)
  - storage.rules (created: protect authorization-letters, avatars, donation images)
  - package.json (updated devDependencies)
  - tests/rules/signup-rules-test.js (created)
- details: `users/{uid}` protections were reinforced to disallow client-supplied `role`. `verificationRequests/{id}` is now creatable only by uploader and updatable only by admin roles. `qrCodes` must not be updated by client code. Storage rules were added to prevent open uploads to sensitive paths. A rules unit-test `tests/rules/signup-rules-test.js` was added using `@firebase/rules-unit-testing` to validate core protections.
- author: maintainer + assistant
- summary: Backed up existing `firestore.rules` and replaced with `firestore.rules.v1` draft to enforce role-based access per the schema.
- details: Created `firestore.rules.bak.2026-08-22` (backup of previous rules) and updated `firestore.rules` with the v0.1 draft. The new rules restrict donations creation to donors, allow volunteers to claim by transitioning `pending` -> `scheduled`, limit donor cancels to pending donations, and restrict notifications/audit logs to admin writes. This change prepares the project for emulator-based rule testing.
- files_changed:
  - firestore.rules.bak.2026-08-22 (created)
  - firestore.rules (updated)
  - docs/backend-log.md (updated)
- rollback:
  - restore `firestore.rules.bak.2026-08-22` to `firestore.rules`
- notes:
  - The rules assume custom claims (`request.auth.token.role` and `request.auth.token.admin`) are present. In emulator tests set these via the client SDK testing harness or use the Admin SDK to simulate privileged writes.
 
---

## BK-0003 — 2026-08-22 — draft security rules
- author: maintainer + assistant
- summary: Added `firestore.rules.v1` draft implementing role-based constraints for `users`, `donations`, `notifications`, and `auditLogs`.
- details: Created a draft rules file `firestore.rules.v1` capturing sensible client-side constraints: donors may create donations with `status: pending`; volunteers may claim a donation by moving `status` pending -> scheduled and setting `volunteerId` to themselves; donors can cancel pending donations; notifications and audit logs are writable only by trusted server/admin tokens (Cloud Functions). This is a draft for local emulator testing and will be iterated after tests.
- files_changed:
  - firestore.rules.v1 (created)
  - docs/backend-log.md (updated)
- rollback:
  - remove `firestore.rules.v1` and revert this log entry
- notes:
  - This draft assumes `request.auth.token.role` is populated by authentication token claims. In emulator tests you may need to set custom claims or use callable functions to simulate privileged writes.
  - Next step: run emulator tests and refine rules to close edge cases discovered in claim and verification flows.
 
---

## BK-0002 — 2026-08-22 — added schema doc and seed script
- author: maintainer + assistant
- summary: Add concrete Firestore schema doc and seed script skeleton for emulator testing
- details: Created `docs/firestore-schema.md` to define collection shapes, indexes, and example documents. Added `scripts/seed-firestore.js` as a runnable skeleton (requires service account or emulator credentials) to help populate test data in the local emulator. This prepares the codebase for schema-driven rules and transaction tests.
- files_changed:
  - docs/firestore-schema.md (created)
  - scripts/seed-firestore.js (created)
  - docs/backend-log.md (updated)
- rollback:
  - remove the two created files and revert this log entry
- notes:
  - The seed script is a template; run with `node scripts/seed-firestore.js` after installing dependencies and configuring credentials or when connected to the emulator via `FIRESTORE_EMULATOR_HOST`.


