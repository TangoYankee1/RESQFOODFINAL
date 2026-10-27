# Organization administrator review — October 20, 2026

Scope: local Firebase emulator capstone. This review covers registration, approval,
return login, queues, receipt verification, history and organization permissions.

## Findings and corrections

| Finding | Correction |
| --- | --- |
| No existing-account sign-in route | Organization OTP login, gateway/registration links, protected-route destination preservation and organization sign-out destination |
| Missing delivery address | Address required and validated at registration; saved on the organization record; primary coordinators can update older records through an audited command |
| Signup failed after authorization approval or could overwrite a pre-existing organization | Transaction checks request ownership/state, profile role/status and organization ownership; committed retries preserve approval/address; collisions and suspended/rejected accounts are rejected |
| Training/responsibility acknowledgments validated but not stored | Persist both acknowledgments and their timestamp on the application profile |
| Duplicate authorization request could activate/change an organization | Org review must match the profile's canonical authorization request and primary contact |
| Dashboard/history/receipt screen disagreed about inactive states | Shared account + organization + membership checks; accurate pending/rejected/disabled messages before querying deliveries or attaching receipt controls |
| Saved Basic/PIN mode ignored | Receipt screen selects the saved organization mode while retaining an explicit QR/PIN switch |
| Queue silently stopped at 20 records | Query all current enRoute/delivered records for the receiving organization |
| Verified-today panel showed all receipts; history sorted by donation creation | Today panel uses Manila receipt day; history orders by verifiedAt; labels distinguish monthly and lifetime totals |
| Receipt controls appeared before initialization and could accept stale preview results | Guard keeps the page hidden until initialization; reset invalidates in-flight previews; confirmation/mode changes are guarded while busy; completed confirmation is disabled |
| Review queue showed a storage path without document preview | Authenticated, size-limited blob preview with close/revoke cleanup before manual review |
| Authorization files accessible to broader/stale admin claims | File reads limited to uploader or active system administrator; request metadata restricted to owner/active system reviewer |

Explicit sign-out clears stale navigation intent. Login waits for handlers before
enabling OTP send; its destination stays within the organization area.

## Current contract

- Phone OTP, organization/coordinator details, exact address, uploaded authorization,
  camera/PIN check and acknowledgments create a pending profile + organization.
  Only system-admin review activates them; there is no separate attendance service.
- The profile's `orgId` identifies the receiving organization. Primary contact and
  `verifierUids` determine membership; organization ID is not treated as every staff UID.
- Both account and organization must be active for operational reads/receipts.
  A member can confirm only donations routed to their active organization.
- Receipt requires delivered status and the assigned volunteer's purpose-bound QR/PIN.
  Preview is read-only; confirmation atomically consumes proof, verifies the donation,
  records the receipt/history/audit/notifications and supports durable retries.
- Org users cannot claim/transport donations, approve accounts, change membership,
  self-activate, edit verified quantities or directly write organization details.
- Primary-only settings command accepts address and QR/PIN preference, validates
  them and writes an audit. It cannot change role, status, membership or verified phone.
- Current queue includes all enRoute and delivered donations. Verified receipts leave
  it. Today's receipts are a separate tab; complete history includes older receipts.
- Monthly kilograms, volunteer counts and average kilograms use verifiedAt in
  Asia/Manila. Lifetime delivery count includes all verified records. Undated legacy
  receipts count toward lifetime totals but are not guessed into a date period.

## Deliberate limits

- Older organizations are not silently assigned invented addresses. Their primary
  coordinator must add the exact address using the dashboard. Volunteers retain a
  visible fallback warning/contact route until it is supplied.
- Secondary-verifier enrollment and primary-contact/staff transfer have no self-service
  interface. Membership must be provisioned deliberately by an administrator.
- An organization disabled mid-mission cannot verify receipt. There is no automatic
  rerouting or refusal/spoiled-food incident command; coordinate manually rather than
  forcing a false successful receipt.
- Physical camera scanning and actual-device offline recovery remain manual checks.
  Critical confirmations require server access; no offline verification queue is claimed.
- Photo/avatar sharing policy and production deployment are outside this batch.

## Verification

Executed successfully: full backend suite (including org/storage additions), org-only
browser journey, full volunteer/org/LGU/admin onboarding browser regression, shared
QR/PIN handover browser journey, targeted canonical-review and storage/request-access
checks, syntax checks and scoped whitespace checks. No deployment was performed.

With emulators and an isolated Chrome at port 9223:

```powershell
npm.cmd run test:org
npm.cmd run test:browser:org
npm.cmd run test:backend
npm.cmd run test:browser:handover
npm.cmd run test:browser:onboarding
```

Org backend checks cover address/acknowledgments, committed retries, collision
protection, suspended/rejected accounts, primary-only updates, validation/audits,
and authorization-file access (including stale suspended reviewer claims).

Org browser checks use issued OTP and actual Storage uploads/document preview,
system-admin review, return OTP login and protected destination, address updates,
PIN preference, 25 waiting deliveries, creation-date vs receipt-date fixtures,
history order, and all three org screens for rejected/disabled organizations.

Shared handover checks cover QR/PIN in both directions, unrelated organizations,
secondary verifier membership, suspension, concurrent confirmations, single-use proof,
wrong purpose/nonce/signature, expiry, direct-status bypass and exactly-once effects.
