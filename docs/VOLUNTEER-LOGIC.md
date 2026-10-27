# Volunteer review — October 20, 2026

Scope: current local emulator capstone. Source review found defects beyond the
previous successful onboarding/handover journeys; this batch corrected them.

## Findings and corrections

| Finding | Correction |
| --- | --- |
| No return login after sign-out; protected routes sent volunteers to registration | Dedicated volunteer OTP login, links from registration/gateway, role-aware login redirect and preserved safe volunteer destination |
| Expired pending records could occupy the entire 50-record board query | Filter `pickupWindowEnd > now` before ordering/limiting; refresh the board query every 30 seconds; server still checks the exact deadline |
| Missing orgId accepted at claim, then pickup failed with destination_required | Claim requires a valid active receiving organization; unrouted records hidden from the board |
| Account status checked outside claim/transport transactions | Claim/transport also read live role/status inside their transaction |
| Mission page had sample values, no destination, and donor name without contact | Loading placeholders; assigned-only contact callable returns minimal donor phone/name and organization name/phone/address/barangay; missing exact address is explicitly flagged |
| Claim/transport errors could be logged without visible feedback | Visible claim-race/expiry/destination errors and transport error messages |
| Active-mission count silently capped at 20; unused profile points presented as a statistic | Count all assigned active missions; replace points with real delivered missions awaiting receipt |
| Signup terms enforced only in the browser; approved retry rejected before claim repair | Server requires/stores terms acceptance, validates barangay/preferences, normalizes availability, checks request ownership/state transactionally, preserves committed retry and other claims |
| Rejected accounts displayed a pending-review message | Accurate rejected dashboard/history states; suspended sessions sign out and server operations remain denied |

Signup OTP controls prevent duplicate sends/confirms, validate Philippine mobile
numbers and label the resend cooldown accurately. These UI controls are not a
production SMS abuse-prevention system.

## Current workflow

1. Phone OTP, profile, ID upload, availability/transport, emergency contact and
   terms create a `pending_orientation` profile/volunteer claim. Signup does not activate it.
2. System-admin review is the single manual identity/training approval gate. There
   is no separate attendance service. Pending/rejected accounts see status screens.
3. Active volunteers see up to 50 unexpired pending donations, ordered by pickup
   deadline. An atomic claim assigns exactly one competing claimant to a donation.
4. Only the assigned volunteer may read mission contacts, release a scheduled
   mission, confirm pickup, or advance transport. Release returns the donation to
   pending and clears assignment; it is not donation cancellation.
5. Pickup requires the donor's purpose-bound QR/PIN. Preview does not consume proof.
   Confirmation atomically consumes proof and changes scheduled to pickedUp.
6. Assigned volunteer advances pickedUp → enRoute → delivered, then displays receipt
   QR/PIN. The receiving organization alone confirms delivered → verified.
7. Completed missions and kilograms count verified records. Delivered missions remain
   active/awaiting receipt. History lists verified receipts with latest receipt first.

Pickup after its deadline is rejected. The expired mission screen offers release.
After pickup, the pickup countdown is hidden. Receipt retry/idempotency and exactly-once
audit/history/notifications remain covered by the shared handover transaction tests.

## Deliberate limits and next checks

- Multiple simultaneous missions are allowed. No one-mission limit or probation
  quantity cap has been established or added.
- Availability, preferred barangays, transport, team/referral fields are profile
  information, not automatic assignment or matching restrictions.
- Rewards, reliability scoring, badges and certificates have no implemented policy;
  the UI does not present invented volunteer rewards/progress.
- Organization review now requires an exact address for new registrations and lets
  existing primary coordinators add/update it. Where legacy records still lack it,
  volunteers see the contact/barangay fallback until the coordinator supplies it.
  See ORG-ADMIN-LOGIC.md.
- If a receiving organization is disabled during a mission, receipt/pickup checks
  reject it. There is no incident/rerouting command; manual coordination is needed.
- Physical camera scanning and actual-device offline/recovery checks remain unverified.
  Critical mutations require server access; no offline mission mutation queue is claimed.

## Executed checks

- `node tests/volunteer-signup-test.js`: initial pending registration, terms, required
  barangay, invalid transport, approved retry with preserved claims, suspension denial.
- `npm.cmd run test:backend`: roles/concurrent claims, unexpired destination requirement,
  contact ownership/minimal disclosure, live suspension, transport boundaries, OTP,
  rules, donor workflow/storage, atomic QR/PIN handover, metrics and admin regressions.
- `node tests/handover-browser-test.cjs`: release/reclaim through board controls,
  mission destination, pickup QR/PIN, transport, receipt QR/PIN, dashboard/history totals.
- `node tests/onboarding-browser-test.cjs`: actual volunteer OTP/upload/approval,
  returning OTP login preserving history destination, 51 expired records not crowding
  out an available listing, and the broader organization/LGU/admin regressions.
- `node tests/onboarding-browser-test.cjs --volunteer-only`: focused volunteer journey
  additionally checks accurate rejected states and suspended-session sign-out.

Tests use fictional local identities and only loopback emulators. Camera hardware
and production readiness are not inferred from these results.
