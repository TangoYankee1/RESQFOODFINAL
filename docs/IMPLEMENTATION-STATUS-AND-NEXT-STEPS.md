# ResQFood Implementation Status and Next Steps

## Checkpoint

This document records the current implementation checkpoint before beginning the LGU-admin side.

The project is still an MVP/capstone implementation. The main role flows are now represented, but some dashboards and delivery operations remain mock-driven and need backend integration before production use.

## Recent Work Completed

### Shared registration behavior

- Standardized donor and volunteer OTP entry behavior.
- OTP digits automatically advance to the next input.
- Six complete digits automatically trigger verification.
- Backspace and paste behavior are supported.
- Local development connects Auth and Firestore to Firebase emulators.
- Storage emulator support was added for document uploads.

### Donor registration

- Donor registration continues to use the shared OTP-first pattern.
- Donor flow includes identity, barangay, donor type, waiver, review, and success states.
- OTP resend and auto-advance behavior were aligned with the other registration flows.
- Existing donor safety guardrails include food-type holding limits, pickup deadline validation, pickup address, description, and review-before-submit.

### Volunteer registration

- Volunteer registration was aligned with the donor visual language.
- Added a clearer availability v2 interface with selectable time cards.
- Added preferred-barangay selection chips and live selection counts.
- Added a required trust-layer step for coordinator ID upload.
- Accepted ID formats are JPG, PNG, and PDF.
- Maximum ID upload size is 10 MB.
- Optional referral code support was added.
- Volunteer verification requests are stored with `pending` status.
- Volunteer profiles are stored with `pending_review` trust status and `pending_orientation` account status.
- Successful volunteer registration redirects to the mission board.

### Organization-admin registration

- Replaced the inactive donor redirect with a seven-stage organization-first wizard:
  1. Phone OTP
  2. Organization profile
  3. Primary coordinator details
  4. Authorization document
  5. Device capability check
  6. Training and responsibility acknowledgment
  7. Pending-review success state
- Added the organization role to the registration gateway.
- Added authorization document upload support with a 10 MB limit.
- Accepted authorization document formats are JPG, PNG, and PDF.
- Added QR-capable Standard Mode and PIN-capable Basic Mode detection.
- Added pending-review and pending-training states.
- Organization registration does not directly grant the privileged `orgAdmin` role.
- Added organization signup callable and server-side profile validation.
- Updated the organization demo guide to match the implemented flow.
- Added OTP resend and expiry behavior to the organization wizard.
- Pending organization accounts do not see active delivery cards in the dashboard.

### Security and data model work

- Added organization signup backend logic in `functions/lib/orgAdminSignup.js`.
- Added volunteer signup backend logic in `functions/lib/volunteerSignup.js`.
- Added organization signup callable wiring.
- Expanded `verificationRequests` to support volunteer IDs and organization authorization documents.
- Added Storage rules for owner uploads, file type restrictions, and the 10 MB file-size limit.
- Restricted verification-request updates to authorized admin roles.
- Documented the new verification request fields in the Firestore schema.

### Local testing status

The Firebase emulators remain running for local development:

- Hosting: `5000`
- Functions: `5001`
- Firestore: `8080`
- Auth: `9099`
- Storage: `9199`

The registration routes and edited JavaScript files have been checked for diagnostics and syntax errors. Multiple open browser tabs may produce Firestore persistence warnings because IndexedDB persistence is single-tab by default.

## Remaining Work Before LGU-admin

These items should be addressed or explicitly accepted as capstone limitations before moving into the LGU-admin workflow:

### Donor-side next implementations

1. Replace the browser-only donation post with an authenticated Firestore or callable-backed donation create flow.
2. Persist donor profile and donation ownership using the authenticated UID instead of `DEMO_DONOR`.
3. Connect donation photos to Firebase Storage instead of keeping them only as local previews.
4. Add a structured food-safety disclosure checklist to the posting flow.
5. Add explicit donation states for `expired`, `no_show`, and `quality_flagged`.
6. Add volunteer or organization reporting for donor no-shows and food-quality mismatches.
7. Replace the client-only QR checksum with server-authoritative token validation before presenting it as a security guarantee.
8. Document that the current QR/PIN behavior is prototype-level until the server verification callable is connected.

### Volunteer-side next implementations

1. Connect the mission board to authenticated volunteer data instead of mock data.
2. Connect available missions to Firestore donations with server-side claim validation.
3. Add volunteer status updates for arrived, picked up, en route, and delivered.
4. Connect QR pickup confirmation to a backend callable and prevent token replay.
5. Add donor no-show reporting from the active mission screen.
6. Add post-mission feedback for food quality and quantity accuracy.
7. Restrict mission claiming based on volunteer approval, orientation status, and probation rules.
8. Replace hardcoded dashboard statistics with verified delivery aggregates.

### Organization-admin next implementations

1. Connect the organization dashboard to the authenticated organization profile.
2. Replace mock incoming deliveries with Firestore queries scoped to the organization.
3. Replace demo PINs with server-created, short-lived verification tokens.
4. Connect QR and PIN verification to a trusted callable.
5. Record verification events in donation status history and audit logs.
6. Add organization-specific delivery history and monthly aggregates.
7. Add a visible review/training state that prevents receiving actions until approval.
8. Add notifications for incoming deliveries, successful verification, and rejected verification attempts.

### Shared backend next implementations

1. Add a single server-authoritative donation lifecycle model.
2. Centralize role assignment through the admin callable only.
3. Add audit logs for registration review, approval, rejection, QR verification, and status changes.
4. Add emulator integration tests for volunteer and organization registration.
5. Add Storage rules tests for file type, size, ownership, and admin review access.
6. Resolve the existing emulator test setup issue involving Admin SDK credentials and timestamp serialization before claiming full integration-test coverage.

## LGU-admin Starting Scope

### Initial LGU implementation completed

- Replaced the inactive LGU invite redirect with an invitation-based registration wizard.
- Added server-side invite validation and single-use invite consumption.
- Added coordinator phone OTP with auto-advance, expiry, and resend behavior.
- Added identity, designation, barangay, official email, and authorization-document capture.
- Added a 10 MB authorization upload limit for PDF, JPG, and PNG files.
- Added audit responsibility acknowledgment and a pending-review result state.
- Added a pending verification queue to the admin dashboard.
- Added a server-authorized review callable requiring a review note.
- Approval updates the request and user state, writes an audit entry, and assigns `lguAdmin` only through the server.

The current review queue is an MVP reviewer surface. It still needs protected document preview/download, stronger admin session enforcement, appeal handling, multiple-admin succession, and production email/MFA integration.

### Admin route separation

- `/admin/index.html` is the barangay-level LGU Admin dashboard.
- `/app-admin/index.html` is the global App/System Admin dashboard.
- `/app-admin/users.html` and `/app-admin/audit.html` are dedicated App Admin routes; they no longer reuse LGU `/admin/*` pages.
- The App Admin surface is currently a capstone control room and still needs a mandatory authenticated `systemAdmin` guard before production use.

Once the above checkpoint is accepted, the LGU-admin side should begin with the review queue because it is the authority boundary for the new trust layers.

### LGU-admin Phase 1: Review queue

- Show pending volunteer ID requests.
- Show pending organization authorization requests.
- Display uploader, target account, document type, submission date, and current status.
- Allow authorized LGU admins to open the protected document.
- Provide Approve and Reject actions with a required review note.
- Write reviewer UID, review timestamp, decision, and note to the request.
- Update the related user trust status only through a trusted backend operation.
- Write an audit log for every decision.

### LGU-admin Phase 2: Account activation

- Approve organization training status after orientation.
- Approve volunteer orientation status.
- Set the appropriate custom claim through the admin callable.
- Prevent client-side role or approval escalation.
- Notify the affected volunteer or organization coordinator.

### LGU-admin Phase 3: Operations oversight

- View pending, active, expired, cancelled, and flagged donations.
- Review no-show and food-quality reports.
- Monitor organizations, volunteers, and donor reliability signals.
- Provide filters by barangay, status, role, and date.
- Preserve a complete audit trail for administrative actions.

## Capstone Position

The current donor, volunteer, and organization registration flows are sufficient to continue development. They should be presented as an MVP with explicit trust and backend-hardening limitations.

The LGU-admin role is the next logical area because it supplies the review authority required by the volunteer and organization trust layers already implemented.
