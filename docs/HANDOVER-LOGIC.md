# Pickup and receipt handover — 2026-10-15

This batch closes the atomic handover and receipt-code UI items recorded on
2026-10-14 in BACKEND-PROGRESS.md and DONOR-LOGIC.md. The older PHASE_CD/STAGE files
are page-wiring snapshots; they do not prove that verification changes database state.

## Exact flow

1. Donor posts to an active organization and displays a pickup QR/PIN.
2. An active volunteer claims the donation. Scanning requires that assigned volunteer.
3. QR scanning is a read-only preview. The donation remains scheduled and the nonce unused.
4. Confirm Pickup consumes the QR nonce or PIN and changes scheduled -> pickedUp in
   the same transaction, including status history, audit, notification, and retry receipt.
5. Assigned volunteer marks enRoute, then delivered through the existing transport command.
6. On active-mission.html, the volunteer creates a separate receipt QR/PIN with purpose verify.
7. An active member of the receiving organization confirms receipt. One transaction
   consumes the receipt credential and changes delivered -> verified. Donor and volunteer
   receive notifications; donor statistics update from the verified donation.

Both handovers accept QR or PIN. Camera decoding and pasted QR text share the same
preview and confirmation path. PIN entry confirms directly; it has no consume-first step.
Network access is required. Actions are not queued offline.

## Commands and responsibilities

| Entry point | Purpose | Writes |
| --- | --- | --- |
| previewHandover | Validate QR signature, assignment/membership, state, expiry, current nonce | None |
| confirmHandover | Confirm pickup or receipt using proof and requestId | Credential, donation, handoverReceipts, auditLogs, notifications atomically |
| verifyQr | Compatibility alias for read-only QR preview | None |
| verifyPin | Compatibility alias for atomic PIN confirmation; requestId required | Same atomic confirmation |
| transitionDonationStatusCallable | Release a scheduled mission; advance pickedUp -> enRoute -> delivered; donor cancellation routes to donor command | Cannot mark pickedUp or verified |
| issueCredential / issuePin | Donor issues own pickup proof; assigned volunteer issues own delivered receipt proof | New purpose-specific credential; prior QR/PIN replaced |

functions/lib/handover.js is the single consuming implementation. signQr.js only
issues credentials and checks signature/shape; pin.js only issues PINs. The old
consume-only helpers were removed to avoid maintaining competing verification paths.
The two scanner modules are small wrappers over core/handoverScreen.js.

## Transaction rules

- Recheck live actor status/role inside the transaction, not only at the callable guard.
- Pickup: actor is assigned volunteer, donation scheduled, pickup deadline open.
- Receipt: actor is primary contact or verifier of the active receiving organization,
  donation delivered. Pickup deadline does not prevent receipt of an already transported donation.
- Credential must have the correct donation, purpose, issuer, expiry, and current QR nonce.
- A wrong PIN increments attempts in the transaction. Three wrong attempts lock it;
  no donation/history/success audit/notification is written on failure.
- A successful transaction creates handoverReceipts/{donationId}_{purpose}, containing
  actor, requestId, proof fingerprint, resulting status, and time. Clients cannot read/write it.
- Same actor + same requestId + same proof returns the saved success without repeating
  writes, even after the credential expires or transport advances. A different request,
  actor, or proof does not reuse that success. Current authorization still applies.
- Client keeps a requestId in memory/sessionStorage using a hash of the request; raw
  credentials are not stored there. Success audit/notifications do not contain PINs or QR text.

## Browser corrections from verification

- Cached pending data can arrive before the server's successful claim snapshot. The
  mission page now waits for authoritative assignment metadata before denying access.
- Receipt PIN selects only the four inputs in .pin-inputs; the donation-ID field also
  had class pin-digit and previously got included in the PIN value.
- The mission page now subscribes to status, exposes transport controls, and displays
  expiring receipt QR/PIN. It clears codes after verification or loss of access.
- Scanners disable duplicate confirms and retain the request ID for retry. Success
  returns the volunteer to the mission and the organization to its queue.

## Verification performed

```powershell
npm.cmd test
npm.cmd run test:backend
npm.cmd run test:handover
```

Emulator tests cover read-only preview, atomic pickup/receipt, blocked generic
transitions, wrong actor/role/organization, suspension, signature/purpose/nonce/expiry,
concurrent PIN lock, competing verifiers, duplicate confirmation, retry after expiry,
and exactly-once status history/audits/notifications. Rules tests reject client access
to handoverReceipts, including writes with an admin claim.

tests/handover-browser-test.cjs passed two journeys using active fixture accounts:
QR pickup + PIN receipt, then PIN pickup + QR receipt, including transport buttons,
receipt-code display, and donor realtime verified totals, with no unhandled errors.
It authenticates fixtures through the Firebase SDK and exercises real protected pages.
It does not test actual camera hardware or volunteer/org registration and orientation UI.
Donor registration/posting/photo coverage remains in donor-browser-test.cjs.

Optional browser test requires Node 22+ and an isolated Chrome debugging instance at
port 9223 (override BROWSER_DEBUG_PORT). Do not attach it to a personal browser profile.

## Local fixtures

```powershell
npm.cmd run seed:local
```

The old seed used invalid phone numbers, organizationId, hardcoded fallbackPin/qrPayload,
and Firestore profiles without Auth accounts. The replacement is loopback-emulator-only:
it creates matching Auth claims/profiles, active organization membership, and a donation
through createDonorDonation. Existing fixture profiles/approval states and missions are
preserved; each run adds one fresh pending donation. QR/PIN must be issued through the app.
It does not create LGU/system administrators or rewrite old user/donation records.

## Remaining scope

The handover is complete; overall backend work still includes volunteer/org onboarding
browser coverage, their dashboard/history metrics, and the previously documented admin
report/invite refinements. Actual-device camera/offline recovery checks remain manual.
Existing local records from old scripts should be reseeded or explicitly migrated;
the implementation does not silently rewrite an ongoing mission.
