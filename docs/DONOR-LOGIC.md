# Donor logic — 2026-10-14

The donor flow is implemented for the local capstone emulator setup. One small
backend module, functions/lib/donor.js, owns posting, cancellation, expiry, and
limited mission-contact lookup. Shared auth/rules enforce donor role and activation.

## User journey

| Action | Behavior |
| --- | --- |
| Register | Verify an emulator-issued phone OTP; save name, optional email, barangay/address, individual/business type, business name/optional permit, and safety/privacy consent. Server assigns donor role. |
| Sign in again | /donor/login.html verifies OTP and allows only an active donor profile. Protected donor pages preserve their intended destination. |
| Post | Select food/amount, pickup address/window, active receiving organization, optional compressed photo, and explicit safety confirmation. Hold to submit using touch, mouse, or keyboard. |
| Retry posting | One requestId identifies a posting attempt. A lost response/retry returns the existing donation; altered content under the same ID is rejected. No critical mutation is queued offline. |
| Show pickup code | QR page reads the owner's donation, issues server-signed pickup QR and hashed single-use PIN, displays expiry/countdowns, and allows regeneration. New codes replace old codes. Public sharing excludes credentials. |
| Track | One subscription to the donor's own records drives board, history, statistics, and status-change toasts. Assigned volunteer contact is fetched on demand through an owner-scoped command. |
| Cancel | Only own pending posts may be cancelled. Status/history and audit are atomic; retries do not add duplicate audit entries. A competing claim and cancellation cannot both win. |
| Expire | Refreshing the donor board, returning online, and its one-minute refresh expire overdue pending posts. Claims reject overdue windows independently. No paid scheduler is required. |
| History/statistics | Both the tab and /donor/history.html show real own records. Empty/error/retry states are explicit. Metrics are derived from donation records instead of stale profile counters. |

## Commands and data

- listDonationDestinations: minimal active-organization choices; no verifier/private contact data.
- createDonorDonation: server-derived donor identity, canonical fields, pickup policy,
  destination validation, idempotent creation, declaration timestamp, initial history/audit.
- cancelDonorDonation: ownership, pending state, idempotency, expiry precedence, history/audit.
- refreshDonorExpiry: refresh only the current donor's overdue pending posts.
- donorMissionContact: only the owner can retrieve the assigned volunteer's name/phone
  for a live mission; pending and finished posts expose no contact through this command.
- issueCredential / issuePin: donor may issue pickup credentials for own pending/scheduled
  posts while the pickup window is open. Donors cannot issue receipt credentials.

Donation creation/status changes are server-only. The owner may attach imageUrl while
pending. Storage requires the same active donor, a permitted image MIME type, and a
maximum 5 MB upload after compression. The browser accepts up to 10 MB before compression.
Phone-number edits through direct profile writes are denied; phone verification belongs
to Auth/signup. Another role cannot overwrite its profile through donor signup.

An initial consent record is stored once at consentRecords/{uid}_donor_v1-2026-10.
It records accepted kinds, version, and server time. This is a compact capstone record,
not a claim of comprehensive legal compliance or verified business licensing.

## Explicit capstone policies

- Pickup limits from posting: Kanin/Tinapay 6h, Gulay/Tinapa 4h,
  Manok/Baboy/Processed 3h, Other 2h. These are configured project limits,
  not a determination of food safety; the donor provides the declaration.
- Amount: 0.1–500 kg. Description: at most 300 characters. Address: 5–200 characters.
  Pickup start must precede deadline; immediate starts have a five-minute form-entry grace.
- PIN lifetime: 15 minutes, capped by pickup deadline. QR lifetime is also capped
  by pickup deadline. Codes are hidden after pickup/cancellation/expiry and must be
  checked online. Regenerating QR invalidates the previous nonce; PIN overwrites its hash.
- Earned points: 10 per verified donation. Reliability: +10 verified, -5 expired.
  Pending cancellation has no penalty. These are display metrics, not redeemable balances.
  Donated kg counts only verified receipts.
- Own-donation subscriptions read the full small capstone dataset for accurate totals.
  Large-scale pagination/aggregation is outside this capstone implementation.
- Expiry is lazy, not a background service. Scheduled missions are not auto-released
  after deadline; coordination is required once a volunteer has accepted.

## Run and verify

```powershell
npm.cmd run emulators
npm.cmd run test:donor
npm.cmd run test:backend
```

Startup generates functions/.env.local with a random local QR signing key when missing.
The file is ignored by Git and must remain local. Use existing admin approval/seed
tools to have at least one active organization; posting explains when none exists.

Verified in the real browser against emulators: registration/consent, returning OTP
sign-in, profile prefill, active destination, photo compression/upload, posting,
QR/PIN/countdown, realtime board, cancellation/statistics, and standalone history.
Browser test: tests/donor-browser-test.cjs (Node 22+, isolated Chrome DevTools endpoint;
BROWSER_DEBUG_PORT defaults to 9222). It is optional and not run in headless CI by default.
Backend/storage/role tests run through test:backend and CI.

Firebase's real RecaptchaVerifier is retained; connectAuthEmulator disables the
challenge. A hand-built verifier failed in the actual browser despite REST tests passing.
Reference: https://firebase.google.com/docs/emulator-suite/connect_auth

## Boundary with the next role

2026-10-15 update: the atomic handover and volunteer receipt-code UI described below
as pending are now implemented and tested. See HANDOVER-LOGIC.md for the current flow.

Donor actions do not impersonate volunteer transport or org receipt. Pickup/receipt
proof consumption is still separate from the shared status transition API; completing
that atomic handover and the volunteer receipt-code UI belongs to the next workflow
batch. New credentials have a signed purpose; old QR screenshots should be regenerated.
No production deployment or real SMS subscription was used.
