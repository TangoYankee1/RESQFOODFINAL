# Sign-up Specification (Phase 0 deliverable)

Purpose: formalize roles, required profile fields, invite policy, and verification gates to guide safe implementation of sign-up/sign-in (BK-0011 Phase 0).

1) Roles
- `donor` — can create donations, manage own profile, view donation history.
- `volunteer` — can claim missions, update mission status while assigned, view volunteer dashboard.
- `orgAdmin` — manages organization-level donations and volunteer assignments for their organization.
- `lguAdmin` — LGU-level admin for verification and local governance; approves LGU registrations and monitors local operations.
- `systemAdmin` — project-level admin (limited number), can assign roles, revoke invites, and run audits.

2) Required profile fields (minimal)
- `displayName` (string, 3–100 chars)
- `phone` (E.164 string, validated)
- `email` (optional, validated email)
- `barangay` (optional, selected from canonical list)
- `role` — server-assigned; client may select desired role but must not write this field.

3) Verification artifacts & flows
- LGU / Org Admin:
  - Upload `authorizationLetter` (PDF/JPG) to `authorization-letters/{token}/{filename}`.
  - Admin issues single-use invite token (server-side) and sends to LGU contact.
  - LGU uses invite link + OTP to create account; server creates `verificationRequest` referencing uploaded docs.
  - `lguAdmin` role is only granted after manual review and `assignRole` admin callable.

- Volunteer / Donor:
  - Use phone OTP for sign-in (`signInWithPhoneNumber`).
  - After authentication, client calls `signupWithProfile` callable to write canonical profile.
  - Volunteers optionally submit training acknowledgement; LGU or org may approve and set status.

4) Invite policy
- Creator: `systemAdmin` or delegated `orgAdmin` (only via server callable `createInvite`).
- Token: cryptographically random, single-use, stored only hashed (`tokenHash`), expiry (configurable, default 72h).
- Delivery: server-side email or admin portal; QR for physical handoff allowed.
- Consumption: callable `consumeInvite(token)` verifies hash, marks used, creates `users/{uid}` entry (without final role), and creates `verificationRequest` if docs were uploaded.

5) Role assignment
- Only `assignRole` admin callable may set `role` (calls `admin.auth().setCustomUserClaims(uid,{role})` and updates `users/{uid}` inside a transaction).
- All `assignRole` operations must write an `auditLogs` record describing actor, target uid, role, and timestamp.

6) Edge cases & security
- Prevent client role assignment by rules and server validations.
- Rate-limit `validateInvite` & `consumeInvite` to limit brute force.
- Always hash tokens/PINs in storage.
- Keep tokens short-lived and single-use.

7) Test plan (Phase 0 outputs)
- Unit tests for token generation, hashing and validation.
- Emulator integration tests for callable `signupWithProfile`, `createInvite`, `consumeInvite`, and `assignRole`.

8) API surface (callables)
- `signupWithProfile(data, context)` — authenticated callable to save profile server-side (no `role`).
- `createInvite({kind, meta}, context)` — admin-only callable to create invite tokens.
- `validateInvite({token})` — callable to check invite validity and prefill metadata.
- `consumeInvite({token}, context)` — callable to atomically consume token and create `verificationRequest` / `users/{uid}`.
- `assignRole({uid, role}, context)` — admin-only callable to set claims and update `users/{uid}`.

Record of this spec: add BK log entries after implementation milestones.
