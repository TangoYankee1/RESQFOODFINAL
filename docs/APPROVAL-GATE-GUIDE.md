# RESQFOOD Approval Gate Guide

This document captures the implementation and validation checklist required before broader rollout. It is intentionally strict and aligned to the security model: server authority is required for privileged actions.

## Core principle

The browser is never trusted for privileged decisions.

The app may validate user input in the UI, but all authority-changing actions must be enforced on the backend through Firebase callable functions and Firestore/Storage rules.

---

## 1) Local emulator registration flow must succeed

### Required implementation
- Donor registration page is the canonical onboarding path.
- OTP is sent through Firebase Auth emulator in local development.
- OTP verification succeeds using the emulator verification code.
- A user can complete donor registration with valid profile data.
- The frontend submits only user-facing data and does not attempt to assign roles or privileges.
- The backend signup callable creates the canonical user profile.

### Required tests
- Start the Firebase emulator suite.
- Open the donor registration page.
- Submit a valid phone number.
- Confirm OTP succeeds.
- Submit donor onboarding data.
- Verify the user is created in Auth emulator.
- Verify the user profile is written to the correct Firestore collection.
- Verify the user is not assigned a privileged role from the browser.

### Exit criteria
- Local donor registration completes successfully without real billing.
- No mock or demo registration path is required.

---

## 2) Admin/invite/QR logic must work under server authority

### Required implementation
- Admin-only role assignment is enforced in the backend callable.
- Invite creation is restricted to authorized admin roles only.
- Invite validation is server-driven and must not trust browser supplied values.
- Invite consumption is performed securely against the backend and user identity.
- QR verification is server-validated and bound to the authenticated actor.
- The browser must not decide whether a user is allowed to become admin, consume an invite, or validate a QR token.

### Required tests
- Attempt role assignment as a non-admin user and verify rejection.
- Attempt role assignment as a system admin and verify success.
- Create an invite as an authorized actor.
- Validate a valid invite token and verify success.
- Validate an invalid or expired token and verify rejection.
- Consume a valid invite as the intended user and verify success.
- Consume an invite without permission or with a bad token and verify rejection.
- Attempt QR verification without valid role permissions and verify rejection.
- Attempt QR verification with valid role permissions and verify success.
- Confirm a forged or modified token cannot pass backend verification.

### Exit criteria
- All privileged operations are enforced by server-side logic.
- The client is not trusted for access control.

---

## 3) Firestore and storage rules must block unauthorized writes

### Required implementation
- Firestore security rules reject unauthorized writes to protected collections.
- Storage rules prevent unauthorized upload or modification of protected files.
- Public write access is not permitted for privileged collections.
- Role-based restrictions are enforced through authenticated user identity and backend authorization.

### Required tests
- Attempt to write to a protected collection as an unauthenticated user and verify rejection.
- Attempt to write to a protected collection as a normal authenticated user and verify rejection.
- Attempt to write as a valid privileged actor and verify success.
- Attempt to upload to a restricted storage path without permission and verify rejection.
- Attempt to update or overwrite protected data with tampered payloads and verify rejection.

### Exit criteria
- No unauthorized client-side writes are permitted by rules.
- Sensitive writes are only possible through controlled server-authorized flows.

---

## 4) Mock registration routes must be removed or inactive

### Required implementation
- Only the real donor path remains as the active onboarding flow.
- Old mock registration pages or demo role choices are removed or redirected.
- No registration page should permit fake OTP demo logic or arbitrary role injection.
- The app must not expose demo login/registration behavior that bypasses the real flow.

### Required tests
- Visit the registration landing page and confirm only the real donor route is active.
- Check mock org-admin, volunteer, and LGU registration entry points are absent or redirecting away.
- Confirm there is no fake OTP success message or demo bypass in the browser.
- Confirm no client-side code sets privileged role values during registration.

### Exit criteria
- The application exposes only the legitimate onboarding path.
- No mock registration path remains active in production or local dev.

---

## 5) Live SMS remains gated behind proper Firebase billing in production

### Required implementation
- Local development uses the Auth emulator, not real SMS.
- Production SMS must only be enabled when the project has the required billing configuration.
- The app must clearly distinguish local emulator mode from production mode.
- The production project must not rely on fake OTP or demo SMS behavior.

### Required tests
- Confirm local runtime points to the emulator when running on localhost.
- Confirm production mode is only used when running against the live Firebase project.
- Confirm live SMS is not attempted without billing.
- Verify the app does not silently fall back to fake OTP in production.

### Exit criteria
- Real SMS remains a controlled production feature.
- Local testing does not trigger production billing.

---

## Final rollout gate

The project may move to broader rollout only when all five sections above are satisfied.

Broad rollout is not allowed until:
- the emulator registration flow passes,
- admin/invite/QR logic is server-authorized,
- Firestore and storage rules are secure,
- mock registration routes are removed,
- and live SMS remains gated behind valid Firebase billing.

---

## Suggested review checklist

Before approval, confirm each item below:

- [ ] Local donor onboarding works in emulator mode.
- [ ] OTP verification works in the Auth emulator.
- [ ] Signup is sent to the backend and not client-trusted.
- [ ] Role assignment is backend-only and admin-restricted.
- [ ] Invite creation and consumption are server-controlled.
- [ ] QR verification is server-authorized and role-checked.
- [ ] Firestore rules block unauthorized writes.
- [ ] Storage rules block unauthorized file access.
- [ ] No mock registration or fake OTP flow remains active.
- [ ] Production SMS is billing-gated and not implicitly used in dev.

This document should be used as the sign-off checklist before enabling broader release or access.
