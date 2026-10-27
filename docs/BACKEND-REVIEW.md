# Backend review — 2026-10-14

Follow-up: the donor batch now implements destination selection, server-only canonical
posting, audited cancellation/lazy expiry, purpose-bound pickup codes, returning OTP
login, photo handling, real history/statistics, and a verified donor browser journey.
See [DONOR-LOGIC.md](DONOR-LOGIC.md) for current behavior. The gap table below records
the earlier review snapshot. Do not treat resolved findings as current blockers.

Current follow-up: October 20 onboarding, dashboard/history, admin invitation and
report refinements are implemented and tested. See ROLE-ONBOARDING-ADMIN.md and
BACKEND-PROGRESS.md. The gap table below is a historical review snapshot.

Scope: local Firebase emulator capstone. Reviewed all 17 original functions/lib modules,
callable/HTTP entry points, Firestore/Storage rules, query/index definitions,
registration and scanner integrations, test scripts, and CI configuration.
This is a source and emulator review, not a production certification or a
completed browser walkthrough.

## Role contract

| Role | Registration and activation | Own operational logic | Explicit boundary |
| --- | --- | --- | --- |
| donor | Verified phone; server creates active donor profile/claim | Post own donation, attach image while pending, cancel own pending donation, view own records | Cannot claim, transport, confirm receipt, approve accounts, or assign roles |
| volunteer | Verified phone, valid volunteer profile, uploaded verification request; pending until review | Read pending board, atomically claim, release own scheduled mission, advance own transport stages | Cannot transport another volunteer's mission or confirm organization receipt |
| orgAdmin | Verified phone, authorization request, training/responsibility acknowledgments; server creates organization and pending profile; review activates both | Read receiving organization's deliveries; confirm delivered donation for active organization membership | Cannot self-approve, alter membership, transport donations, or verify another organization's delivery |
| lguAdmin | Invited applicant, authorization review, matching consumed LGU invite | Read reports/users/audit and suspend/activate ordinary accounts | Cannot assign roles, review authorization documents, suspend privileged admins, or impersonate a delivery participant |
| systemAdmin | Local bootstrap script; never public signup | Review documents, manage users, issue invites, assign roles, export reports, send manual notifications | Does not bypass donation transport/receipt responsibilities; database audit writes remain server-only |

Shared backend services are intentional. A separate database or duplicated auth
implementation per role would make the capstone harder to maintain. Roles have
different policies and commands while sharing validation and persistence helpers.

## Account and organization model

- users/{uid}: role, status, trustStatus, profile fields, optional orgId.
- Auth custom claim role must match the live user profile for operational callables.
- Only status active permits operations. Pending applicants can complete onboarding;
  suspended/rejected accounts cannot restart onboarding to reset their status.
- organizations/{orgId}: primaryContactUid, verifierUids, status, display/contact fields.
- Capstone simplification: primary registration uses orgId = primary contact UID.
  The fields remain distinct concepts. Secondary verifiers use membership, not an
  orgId-to-user-UID equality check. Secondary verifier enrollment UI is not implemented.
- Approval is one manual review covering documents and training acknowledgment;
  no separate orientation attendance service is implemented.
- LGU reporting/user administration is currently project-wide. Barangay is a filter,
  not a security tenant. Territorial isolation is not implemented or claimed.

## Donation state machine

```text
pending --volunteer claim--> scheduled --assigned volunteer--> pickedUp
   |                             |                                 |
donor cancel                volunteer release                enRoute
   |                             |                                 |
cancelled                     pending                          delivered
                                                                  |
                                                      receiving orgAdmin
                                                                  |
                                                               verified
```

Claim sets volunteerId atomically and rejects expired/missing pickup deadlines.
Release clears volunteerId. Receipt sets verifiedAt/verifiedBy. Admin roles have
no transport transitions. Direct client transport/receipt writes are denied.

## Corrections made in this review

- Retired unauthenticated HTTP claim endpoint (410); authenticated callable remains.
- Added one operational callable guard checking live activation and current role.
- Removed org transport privileges and admin receipt/transport overrides.
- Added receiving-organization membership checks for receipt and credential checks.
- Added real volunteer release logic and wired the existing cancel-mission button.
- Created organization/profile together at org signup, with server-controlled role.
- Required verified submitted phone for volunteer/org signup; preserved custom claims.
- Signup retries preserve existing approval/status rather than resetting activation.
- Authorization review rechecks pending state transactionally; activates org/profile
  together and assigns approved roles; LGU activation requires a consumed matching invite.
- LGU cannot manage admin accounts; activation of reviewed roles requires approval.
- PIN attempts and single-use consumption now read/write in one transaction.
- Invite consumption rechecks usage/expiry inside the transaction.
- Added recipientUid and normalized audit fields to donation claim/transition records.
- Rules restrict posting to active donors, validate quantity/pickup windows, block
  client organization approval/membership changes, and permit the existing photo patch.
- Removed legacy boolean admin-claim access from Firestore/Storage rules.
- Corrected org history to use the profile's orgId; centralized verification SDK connection.
- Aligned indexes to donor/volunteer/org, status/history, users, and notification queries.
- Added backend role/rules/registration/concurrency tests and CI coverage.

## Remaining gaps, in priority order

| Priority | Finding | Next change |
| --- | --- | --- |
| High | Posting does not choose orgId, and no backend command assigns a receiving organization. Unrouted donations cannot reach an org queue. | Add explicit destination selection/assignment with active-org validation and frontend wiring. Never guess an organization. |
| High | QR/PIN checks and status transitions remain separate. Assigned handlers can call transition directly; scanning consumes the credential before the final confirmation. | Make pickup/receipt confirmation consume purpose-bound proof and change state atomically, with safe retries. |
| High | Signed QR has one nonce for multiple workflow stages; consumed pickup QR cannot also verify receipt. QR_HMAC_SECRET must be configured. | Issue separate pickup/receipt credentials and document an emulator-only key. |
| Medium | Rules validate key donation fields but do not fully whitelist metadata or enforce food-category expiry calculations server-side. | Establish a small canonical create command/schema; record actual safety acknowledgment rather than hardcoded flags in data.js. |
| Medium | Expired donations remain pending; claim is rejected but no expiry worker updates the board. | Add a simple emulator-friendly expiry command and test boundary times. |
| Medium | Direct donor cancellation has status history but no server audit entry. | Route cancellation through the existing donor transition command. |
| Medium | Invite domain/email metadata is not server-bound to a verified email; LGU applicant profile still starts with a client write. | Add a dedicated LGU submission command; keep manual review as the activation gate. |
| Medium | Auth claims and Firestore profile writes are separate operations. | Document/retest retries after partial failure; avoid implying cross-service atomicity. |
| Medium | Donation images/avatars remain readable by any signed-in account; Storage admin reads do not check live suspension. | Decide the capstone sharing policy and align Storage rules/tests. |
| Medium | Export filtering happens after a result limit; audit CSV only understands the current normalized audit shape; formula escaping is absent. | Filter before limiting where possible; normalize historical records; escape spreadsheet formulas. |
| Low | OTP send ledger is optional and not an enforced provider gateway; browser attempt locks reset on reload. | Label as emulator/UI safeguards; do not claim production SMS abuse prevention. |
| Low | qr.js and qr-test.js exercise a legacy token flow, not the deployed signed-QR callable. | Archive/rename legacy tests; add signed credential integration tests with the atomic confirmation work. |
| Low | Some older standalone claim/lifecycle tests use incomplete historical fixtures and logging instead of assertions. | Modernize or retire them; use test:backend for current role checks. |

The browser wizard, camera flow, offline/retry screens, secondary verifier enrollment,
and full donor-to-organization journey are not yet verified. Existing emulator data
created before this review may need reseeding: active status, current claim role,
organization membership, and pickupWindowEnd are now meaningful checks.

## Verification

With emulators running: npm.cmd test and npm.cmd run test:backend.

- Existing npm test suite passed during review.
- New workflow test passed: five roles, competing claims, assignment/release,
  transport/receipt separation, suspension, privileged target restrictions,
  retired HTTP endpoint, concurrent PIN single use.
- New registration test passed: organization creation/approval, ignored role injection,
  preserved activation on retry, LGU invite requirement, concurrent invite single use.
- New rules test passed: role/activation checks, receiving-org reads, protected fields,
  server-only transport, owner photo patch.
- OTP/signup integration passed. No paid SMS or deployment was used.
- Emulator query execution does not prove production composite indexes; index JSON
  was aligned by source inspection.

Progress trail: [BACKEND-PROGRESS.md](BACKEND-PROGRESS.md).

## October 15 follow-up

The handover findings above are historical. Atomic pickup/receipt confirmation,
read-only QR preview, durable retry receipts, and volunteer receipt-code controls
are now implemented. Signed credential integration checks and two browser journeys
cover QR/PIN pickup and receipt through updated donor totals. Browser coverage used
active fixture accounts and pasted QR text; physical camera, onboarding/orientation,
and offline UI coverage remain open. See [HANDOVER-LOGIC.md](HANDOVER-LOGIC.md)
for the current contract and [BACKEND-PROGRESS.md](BACKEND-PROGRESS.md) for checks.
