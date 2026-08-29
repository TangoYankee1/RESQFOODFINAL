# RESQFOOD Onboarding and Registration Guide

This document is the official source-of-truth guide for the project onboarding flow. It is based on the live donor registration page at https://resqfood-ec8f5.web.app/register/donor.html and the secure backend model already implemented in this repo.

This guide defines the onboarding standard we will follow for the rest of the app. It makes clear:

1. the actual donor registration flow we are using as the main blueprint
2. the current prototype state of the browser flow
3. the final trusted production flow that the app must implement

## 1. Project standard

The donor registration flow is the main onboarding blueprint for the product.

The flow is:

1. register with a mobile number
2. verify the phone number with OTP
3. provide personal information such as name, address, and optional email
4. choose donor type: individual or establishment
5. accept the waiver
6. complete registration

This is the expected onboarding sequence for the app and should be used as the reference implementation for the rest of the user registration flows.

This document is the authority for how onboarding is designed and implemented.

---

## 2. Purpose of this guide

This guide exists to answer three questions clearly:

1. What the current donor registration flow does in the browser
2. Why the current flow is still a prototype in parts
3. What the final trusted onboarding system must do in production

---

## 2. The actual live donor registration flow

I checked the live page and the current donor flow is structured as a 5-step onboarding flow.

### Step 1 — Phone number

- The page asks for a mobile number using a Philippines prefix of +63.
- It validates the value as a 10-digit mobile number similar to `9XXXXXXXXX`.
- The user presses “Magpadala ng Code” to proceed.
- The page then reveals the OTP section and shows the phone number used.
- The page explicitly shows a demo message: “Demo mode: gamitin ang anumang 6-digit code.”

Important detail:

- This is not a real Firebase phone-auth flow yet.
- The code is accepted without verifying with Firebase or a backend service.
- The OTP logic is UI-only and cosmetic.

### Step 2 — Identity and location

After OTP verification, the user fills in:

- full name
- optional email
- barangay
- street / address

Validation in the page includes:

- name must be at least 3 characters and at most 100
- email is validated if provided
- barangay is required

### Step 3 — Donor type

The donor is categorized as:

- individual
- business / establishment

When the business option is selected:

- business name becomes required
- a business name preview is shown
- the display label changes to show the chosen business name

### Step 4 — Waiver

The user must read a waiver section and scroll to reveal the checkbox area.

The page then requires both checkboxes to be checked before submit:

- safety confirmation
- privacy confirmation

This is a staged consent flow and functions as a real onboarding gate.

### Step 5 — Completion

Once the user checks the waiver boxes, the button is enabled and a brief save simulation runs. Then the page advances to the final “done” screen.

In the current UI, this is a simulated end state and not a real backend-backed account creation.

---

## 3. What the page currently does well

The donor registration page already provides a strong UX blueprint:

- clear 5-step onboarding progression
- complete phone-first flow
- location + donor category choices
- waiver gating before completion
- visual progress states and feedback
- opportunity to split onboarding into real technical phases

This is a good foundation for the real onboarding logic because the user journey is already understandable and structured.

---

## 4. Important reality check: this is still a prototype flow

The current donor page is not yet a production-trusted registration flow.

The page behavior currently indicates:

- OTP is accepted without verifying against Firebase Auth
- the form advances without creating a real user profile
- no backend call is made to `signupWithProfile`
- no server-side role assignment occurs
- no record is written to Firestore in a trusted way
- the save step is a simulated UI delay and not a secure backend transaction

This is fine as a UX prototype, but it must not be treated as the final production onboarding mechanism.

---

## 5. Production-safe onboarding model

The actual onboarding logic must follow the trusted backend pattern used in this repo.

The correct flow is:

1. User enters phone number
2. Firebase phone auth sends and verifies OTP securely
3. User fills in profile and donor details
4. Client sends a user profile payload to the server
5. The backend creates the user record in Firestore via `signupWithProfile`
6. The backend writes the user profile without accepting a client-controlled role
7. Optional donor verification or review happens later if required
8. The donor is redirected to the donor dashboard or onboarding completion page

### Critical rule

The browser must never be allowed to set privileged state such as `role`.

That state belongs to the trusted backend, not the browser.

---

## 6. Role and backend contract

The secure onboarding flow must match the backend logic already created in the project:

- [functions/lib/authSignup.js](../functions/lib/authSignup.js)
- [functions/lib/assignRole.js](../functions/lib/assignRole.js)
- [functions/lib/invite.js](../functions/lib/invite.js)
- [functions/lib/qr.js](../functions/lib/qr.js)
- [functions/index.js](../functions/index.js)

These are the canonical backend pieces that should drive onboarding.

### Trusted actions

- `signupWithProfile()` creates the user profile in Firestore securely
- `assignRole()` is the only legitimate role-assignment path
- invite validation and QR verification remain server-side and single-use
- audit records are written for sensitive actions

---

## 7. What the donor page should become

The donor page should preserve the same user experience but become a real server-backed sequence.

### Target donor flow

1. Enter phone number
2. Verify number via Firebase OTP
3. Collect donor profile information
4. Choose individual or business donor type
5. Confirm waiver and consent
6. Submit to backend
7. Create Firestore user record via `signupWithProfile`
8. Redirect to donor dashboard or onboarding completion

### Required data fields

At minimum, the donor registration payload should include:

- `phoneNumber`
- `fullName`
- `email` (optional)
- `barangay`
- `address` / `street`
- `donorType` (`individual` or `business`)
- `businessName` if applicable
- `verificationStatus` or equivalent onboarding state
- no client-controlled `role`

---

## 8. Implementation phases for the onboarding work

The following phases are the implementation order for bringing the donor onboarding flow into a real server-backed production flow.

## Phase 0 — Define the onboarding contract

### Objective

Define the donor registration contract and secure client-to-server boundary for the onboarding flow, without implementing any approval or review logic.

### Tasks

- Standardize role names and donor profile fields for the main donor onboarding flow
- Confirm the data model for donor registration: phone, full name, address, optional email, and donor type
- Align the browser state to the backend contract used by `signupWithProfile`
- Clearly separate the client-side onboarding flow from privileged backend actions
- Confirm that no additional approval or review logic is included in this phase
- Wait for explicit approval before starting any later phase that adds review, verification, or approval workflows

### Out of scope for Phase 0

- no approval queue
- no review dashboard
- no admin verification flow
- no extra trust layer beyond the core donor signup contract

### Files

- [functions/lib/authSignup.js](../functions/lib/authSignup.js)
- [functions/index.js](../functions/index.js)
- [public/js/register/shared.js](../public/js/register/shared.js)
- [public/js/core/callables.js](../public/js/core/callables.js)

---

## Phase 1 — Shared registration foundation

### Tasks

- Create one registration state model for all pages
- Add shared validation helpers
- Turn the UI into a real browser wrapper for backend callables
- Ensure no role data is sent by client during profile creation

### Files

- [public/js/core/auth.js](../public/js/core/auth.js)
- [public/js/register/shared.js](../public/js/register/shared.js)

---

## Phase 2 — Real donor registration flow

### Tasks

- Replace prototype OTP acceptance with Firebase auth
- Submit donor profile to `signupWithProfile`
- Validate required donor fields before submit
- Redirect to donor dashboard after success

### Files

- [public/register/donor.html](../public/register/donor.html)
- [public/js/register/donor.js](../public/js/register/donor.js)

---

## Phase 3 — Volunteer flow

### Tasks

- Mirror the same user journey on the volunteer onboarding page
- Keep the same server-trusted principles
- Add availability and emergency information where required

### Files

- [public/register/volunteer.html](../public/register/volunteer.html)
- [public/js/register/volunteer.js](../public/js/register/volunteer.js)

---

## Phase 4 — Org admin and LGU onboarding

### Tasks

- Wire org-admin and LGU invite flows to real validation logic
- Require proof uploads and verification steps where needed
- Use invite validation and `assignRole` through server-side approval

### Files

- [public/register/org-admin.html](../public/register/org-admin.html)
- [public/register/lgu-invite.html](../public/register/lgu-invite.html)
- [firestore.rules](../firestore.rules)
- [storage.rules](../storage.rules)

---

## Phase 5 — Security hardening

### Tasks

- Restrict client writes to user-owned fields only
- Lock role updates to admin-only functions
- Prevent unauthorized changes to verification docs, invite state, QR state, and private fields
- Extend tests around signup and rules enforcement

### Files

- [firestore.rules](../firestore.rules)
- [storage.rules](../storage.rules)
- [tests/rules/signup-rules-test.js](../tests/rules/signup-rules-test.js)

---

## 9. Recommended rule for all registration pages

All registration pages should obey this standard:

- UI handles presentation and validation
- backend handles trust and privileged state
- no client writes `role`
- no client bypasses OTP or invite validation
- every sensitive step is auditable and server-enforced

This is the core principle that should guide onboarding logic across the whole app.

---

## 10. Final onboarding principle

The donor registration page is the primary UX guide for onboarding, but it is not the final trust model. It shows the right sequence and the correct user journey, but the production system must replace the mock steps with trusted backend enforcement.

The final system must:

- keep the same donor onboarding sequence
- replace the mock OTP with real Firebase Auth verification
- replace the simulated save with a real backend `signupWithProfile` call
- keep donor type as profile metadata, not as a client-controlled authority signal
- ensure role assignment remains server-owned and admin-controlled
- treat the donor onboarding sequence as the standard pattern for the rest of the registration flows

This is the operational foundation for the app’s onboarding logic.

---

## 11. Final directive

This file is the guide for onboarding implementation going forward.

The donor flow on the live page is the project’s reference onboarding logic:

- mobile number registration
- profile information
- donor type selection
- waiver acceptance
- completion

All future registration pages and onboarding logic should align to this structure, while the trusted backend must enforce the secure production rules.

This guide should be treated as the canonical onboarding standard for implementation work.
