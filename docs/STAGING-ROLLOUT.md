# Phase 6 — Staging rollout, smoke test, monitoring, and rollback

Purpose: move the secure signup/admin/security stack to staging in a controlled way, verify critical migrations, and define a safe rollback path.

## 1) Review of recent phases

### Phase 0
- Confirmed repo prerequisites and local emulator path.
- Documented the signup/sign-in spec and role model.

### Phase 1
- Finalized role + schema definitions for users, verification requests, invites, and audit logs.
- Added the auth/role onboarding plan and server-side validation principles.

### Phase 2
- Implemented server-side primitives for signup, invite creation/consumption, and role assignment.
- Ensured `role` is not accepted from the client and is assigned only through admin logic.

### Phase 3
- Added QR verification server-side and callable wiring.
- Added frontend callable wrappers for secure admin/invite/verification operations.

### Phase 4
- Hardened Firestore rules and storage rules.
- Added rules-unit tests for signup and admin protections.

### Phase 5 (current focus)
- Add end-to-end emulator tests for signup, invite, role assignment, and QR validation.
- Standardize role naming and verification flows.

## 2) Staging rollout checklist

### Pre-flight
- [ ] Verify local emulator tests pass:
  - `node tests/rules/signup-rules-test.js`
  - `node tests/invite-test.js`
  - `node tests/assignRole-test.js`
  - `node tests/qr-test.js`
- [ ] Check Firebase project is prepared for staging.
- [ ] Ensure the target project has Auth, Firestore, Storage, and Functions enabled.
- [ ] Ensure the service account has permissions to assign custom claims and write audit logs.

### Deploy sequence
```bash
# 1) Review target project
firebase use <staging-project-id>

# 2) Deploy rules and functions together
firebase deploy --only firestore:rules,storage,functions --project <staging-project-id>

# 3) If hosting is part of the staging test, deploy hosting too
firebase deploy --only hosting --project <staging-project-id>
```

### Smoke checks after deploy
- [ ] Sign in with a test user account.
- [ ] Call `signupWithProfile` and confirm `users/{uid}` is created with expected fields.
- [ ] Attempt to set `role` from client-side write and confirm it is rejected by rules.
- [ ] Use `assignRole` as a system admin and confirm custom claims and `users/{uid}.role` update.
- [ ] Create and consume an invite token.
- [ ] Verify a QR code token once and then confirm the second check fails.
- [ ] Confirm the audit log contains `assign_role`, `consume_invite`, and `verify_qr` events.

## 3) Monitoring for staging

### Logs to watch
- `assignRole`
- `signupWithProfile`
- `createInvite`
- `consumeInvite`
- `verifyQr`
- permission-denied and failed-precondition errors

### Useful Firebase log queries
```bash
firebase functions:log --project <staging-project-id>
```

Also watch Cloud Logging for:
- repeated `permission-denied`
- `invalid_role`
- `not_found` on invite QR lookups
- retries or transaction errors during `verifyQr` and `assignRole`

## 4) Alerting / operational guardrails
- Alert if `assignRole` fails more than 3 times in 10 minutes.
- Alert if `verifyQr` rejects a valid artifact more than 5 times per hour.
- Alert if `signupWithProfile` starts returning validation failures above the baseline.
- Keep `auditLogs` as the single source of truth for admin operations.

## 5) Rollback plan

If staging shows blocking issues:

1. Revert the last deploy:
```bash
firebase deploy --only functions --project <staging-project-id>
```
2. Restore previous Firestore/Storage rules from git or backup.
3. Revoke custom claims for affected users via Admin SDK if needed.
4. Stop new registrations temporarily if the signup flow is broken.
5. Review logs and record root cause before retrying.

## 6) Exit criteria for Phase 6
- All smoke tests pass on staging.
- Firestore and Storage rules behave as intended.
- Admin operations are visible in `auditLogs`.
- No unexpected `permission-denied` spikes.
- Team approves the rollout to production or to a targeted pilot.

## 7) Recommended next action
- Complete Phase 5 emulator tests and fix any issues.
- Then use this checklist to execute a staged rollout and monitor for 24–48 hours before broader production deployment.
