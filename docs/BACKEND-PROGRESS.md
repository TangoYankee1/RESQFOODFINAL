# Backend progress

LGU-admin review: see [LGU-ADMIN-LOGIC.md](LGU-ADMIN-LOGIC.md) for onboarding,
status management, project-wide reporting scope, fixes and regression checks.

## Current scope

ResQFood is a capstone project demonstrated with Firebase emulators. Keep the
backend small, readable, and explainable during the defense. This scope supersedes
the production deployment roadmap in PROD.MD for current work.

- Use Auth, Firestore, Functions, Storage, and Hosting emulators locally.
- Use Auth emulator phone verification; no paid SMS provider is required for the demo.
- Keep meaningful authorization, ownership, state transitions, and validation.
- Prefer the existing functions/lib structure and shared frontend data layer.
- Add abstractions only when they remove real duplication or clarify a workflow.
- Defer production deployment, paid services, monitoring integrations, and formal
  compliance deliverables. Do not describe emulator behavior as production readiness.

## How to read this trail

This file is the compact backend handover. Update it after each backend work batch.
Keep the current status and next step accurate; summarize older details rather than
copying terminal output. Record changes as: date | change | checks | next step.
Distinguish source review, executed tests, and manual emulator verification.

## Current status

- 2026-10-20 organization review: fixed return login, required/editable delivery
  address, signup retry/collision guards, canonical request binding, inactive/member
  gates, full queues, saved PIN mode, receipt-date history/today tab and reviewer
  document access. Current contract, tests and remaining limits: ORG-ADMIN-LOGIC.md.

- 2026-10-20 volunteer review: corrected return login, expired board filtering,
  unrouted claims, live transaction account checks, mission contact/destination UI,
  server terms/retry validation, visible errors and real receipt-waiting statistics.
  Full findings, policy limits and checks: VOLUNTEER-LOGIC.md. Organization behavior
  is not claimed fully reviewed by this volunteer-specific audit.

- 2026-10-20 follow-up: completed local startup recovery, dashboard/history browser
  checks, volunteer/org/LGU onboarding and system-admin review/activation, plus
  invitation and report refinements. Full test:backend and both browser suites pass.
  Current role/admin contract and reproducible commands: ROLE-ONBOARDING-ADMIN.md.

- 2026-10-20: replaced volunteer sample history with a guarded realtime list and
  verified-donation totals. Organization dashboard now uses explicit membership;
  its actual stat elements show monthly kilograms, all completed deliveries, and
  today's receipts. Monthly/day boundaries use Asia/Manila and verifiedAt.
  Initial metric tests passed; the startup blockers recorded in that batch were
  subsequently resolved and the updated browser assertions now pass.

- 2026-10-15: atomic pickup/receipt implemented and tested. QR preview no longer
  consumes proof; generic pickedUp/verified transitions are blocked. The volunteer
  mission displays receipt QR/PIN and realtime transport state. Two cross-role browser
  journeys passed (QR pickup/PIN receipt and PIN pickup/QR receipt). See HANDOVER-LOGIC.md.

- 2026-10-14: donor flow implemented and verified in the browser/emulators, including
  registration, returning OTP login, destination, posting/photo, pickup codes,
  cancellation, expiry, contact, history, and derived statistics. See DONOR-LOGIC.md.

- 2026-10-14: full backend source review and five-role permission cleanup completed.
  Current role contract, fixes, tests, and remaining gaps are in BACKEND-REVIEW.md.
- Existing npm test and the new test:backend suite passed in running emulators.
  Syntax checks passed for 24 backend/frontend/test modules.

- Emulator startup and backend OTP-to-donor-signup integration verified.
- SDK connections centralized in firebaseConfig.js for Auth, Firestore, Storage,
  and Functions. Missing shared OTP helpers restored; issued codes are verified.
- Donor signup now checks the authenticated phone and sets donor profile/claim;
  existing roles and custom claims are preserved.
- Existing gap analysis and STATE/STAGE/PHASE notes contain conflicting historical
  results. Treat them as references, not a current pass/fail checklist.
- Donor, handover, role onboarding/activation and admin refinements are verified in
  local emulators/browser. Physical camera/offline checks remain outstanding;
  full production readiness is not claimed.

## Work order

| Step | Work | Done when | Status |
| --- | --- | --- | --- |
| 1 | Reproducible emulator setup and OTP instructions | One documented local command starts required services; registration works without real SMS | Donor browser/backend verified |
| 2 | Small schema and permission contract | User UID, organization ID, membership, statuses, and timestamps have consistent meanings | Role contract and donor destination selection implemented |
| 3 | Authorization cleanup | Claim endpoints require identity; unrelated users cannot change missions; organization contacts cannot approve themselves | Core role/rules checks passed |
| 4 | Complete donation workflow | Post, claim, pickup, delivery, receipt, cancellation, and expiry have clear server checks | Core journey verified; remaining role onboarding/metrics tracked |
| 5 | QR/PIN correctness | Credentials are purpose-bound, single-use under concurrency, and tied to authorized transitions | Atomic handover and retry/concurrency checks passed |
| 6 | Query, index, and test alignment | Role screens load expected records; critical allowed/denied paths pass emulator tests | Backend, donor, and handover browser tests passed; remaining role/admin UI pending |

Implement each step in a small batch with the necessary frontend wiring. Avoid a
whole-project rewrite. Keep direct permitted reads; use server commands for critical
business mutations. Document deliberate simplifications.

## Open work

- Physical camera and offline recovery require actual-device checks.
- Secondary verifier enrollment UI, production email ownership verification and
  scalable reporting remain outside this local capstone batch.
- Perform actual-device camera/offline recovery checks. New seed script is aligned;
  old local records require deliberate reseeding/migration rather than silent rewrites.
- See BACKEND-REVIEW.md for the complete prioritized gap list and deliberate simplifications.

## Change trail

### 2026-10-20 | Organization-specific review

- Added org OTP login and validated primary-only address/mode command with audit;
  denied direct client organization edits. New registration stores address and
  training/responsibility acknowledgments. Existing records require deliberate edits.
- Hardened signup retry/collision/status checks and org review request/primary binding.
  Added authenticated document preview and restricted authorization-file access.
- Unified org account/membership/status gates for dashboard/history/receipt; removed
  20-record queue cap; honor saved PIN mode; sort/count by receipt date.
- Fixed async receipt initialization, stale preview reset, completed-confirm state and
  stale navigation intent after explicit sign-out. Shared handover regressions checked.
- Checks: org backend/storage tests, org browser flow and shared receipt journey;
  full backend/cross-role regressions passed. Canonical-review, storage/request access,
  syntax and scoped whitespace checks passed. See ORG-ADMIN-LOGIC.md.
- Limits: hardware/offline checks, incident/refusal/rerouting and self-service staff
  enrollment/transfer remain explicit; no deployment or paid services.

### 2026-10-20 | Volunteer-specific review before organization review

- Found and fixed additional source/edge-case defects beyond prior happy paths.
  Added a volunteer OTP login and assigned-only minimal mission-contact command.
- Tests: signup terms/retry/suspension; full backend; browser release/reclaim,
  destination, QR/PIN handover; returning OTP login and a board with 51 expired records.
- Preserved policy: multiple missions allowed, preferences informational, no invented
  rewards/certificates. Exact org address collection and incident rerouting remain
  explicit gaps; physical camera/offline testing remains manual.
- Detailed review and limits: VOLUNTEER-LOGIC.md. Next: organization-specific audit.

### 2026-10-20 | Startup, role onboarding and admin refinements (steps 1–4)

- Startup: isolated Chrome works outside the Windows process sandbox; saved
  emulator launcher sets local CLI configuration and 60-second Functions discovery.
- Browser fixes: module script tags on volunteer/org/LGU dashboards; one canonical
  Firebase import URL; pending/rejected accounts do not query operational donations;
  volunteer registration completion screen and organization verified tab work.
- Onboarding: browser coverage for issued OTP, Storage uploads, required fields,
  pending screens, system-admin review buttons, activation and camera-denied PIN mode.
  Physical camera and separate attendance tracking were not added.
- Admin: invite issuance form; validated invite options; server-owned LGU submission
  transaction checks identity, metadata and document ownership, consumes one invite,
  writes profile/audit, preserves committed retries. Direct client profile create denied.
  Email remains declared/unverified and requires manual identity/authorization review.
- Reports: filter donation queries/exports before row limits, pass selected period/status,
  normalize legacy audit shape, escape spreadsheet formulas, log actual export filters.
  Corrected dashboard beneficiaries/weekly buckets and removed sample comparisons.
- Retry: approved review can repair Auth claims without repeating audits or reactivation.
- Checks passed: full test:backend (including stats/admin additions); updated handover
  browser journey; onboarding/admin browser journey; targeted registration/rules retry
  checks; syntax checks. Browser CSV assertions inspect returned data without downloads.
- Saved launcher verified by a clean npm run emulators restart and a loaded LGU
  callable rejecting anonymous submission. Local emulators left running; isolated
  test browser closed after verification.
- Next: actual-device camera/offline verification. No deployment or paid providers.
  Details and deliberate capstone simplifications: ROLE-ONBOARDING-ADMIN.md.

### 2026-10-20 | Resume role history and metrics

- Changed: real volunteer history instead of sample missions, badges, reliability,
  and certificate progress; live completed-mission and kilogram dashboard totals.
- Fixed: organization dashboard UID fallback, mismatched stat element IDs, capped
  totals (30/500 records), and all-time values displayed as monthly/daily metrics.
  Organization history now uses receipt time rather than mutable updatedAt.
- Added: shared receiptStats and npm run test:stats. Verified records without a
  receipt date count toward lifetime totals but are not guessed into a date period.
  Points retain the existing profile value; no new reward/certificate policy.
- Checks passed: test:stats (verified-only, empty history, timestamp types, Manila
  month/day boundary); syntax checks for five changed modules and browser test;
  npm test with FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 and
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080. Initial npm test without Auth emulator
  environment failed trying to obtain credentials; the explicit local rerun passed.
- Limits: browser journey assertions added for both role dashboards/history but
  not run: isolated Chrome exits with GPU initialization errors. Emulator services
  started, but Functions discovery exceeded its 10-second timeout. Existing unrelated
  whitespace warnings remain in core files; no deployment occurred.
- Next: run updated handover-browser-test.cjs in a working isolated browser, then
  complete volunteer/org onboarding/orientation browser coverage and admin refinements.

### 2026-10-13 | Scope and baseline

- Decision: emulator-first capstone; prioritize understandable code and correct core
  workflows. Paid OTP and production operations are outside current scope.
- Added: docs/BACKEND-PROGRESS.md as the compact ongoing progress trail.
- Checks: read project docs and relevant source/configuration; no runtime tests.
- Next: verify emulator startup and phone OTP flow, document exact local steps,
  then agree the minimal schema through implementation evidence.

### 2026-10-13 | Emulator and donor signup baseline

- Changed: one SDK emulator connection location; restored sendOTP/confirmOTP;
  fixed undefined role redirect helper; donor signup checks verified phone and
  assigns the server-controlled donor role, preserving existing roles/claims.
- Added: docs/EMULATOR.md, npm run emulators, npm run test:otp, and the OTP/signup
  integration test. No paid OTP provider or hardcoded accepted code.
- Checks passed: all five emulators started; issued OTP accepted, wrong OTP denied,
  anonymous signup denied, mismatched phone denied, donor claim/profile created.
  Syntax checks passed for changed auth/config/callables/functions/test modules.
- Environment: CLI needed a workspace-local XDG_CONFIG_HOME because the sandbox
  cannot access the user's CLI config. Existing dependencies were used; no installs.
  CLI network/credential warnings did not prevent local services or the test.
- Limits: browser UI not automated; three-attempt/expiry safeguards are client-side;
  profile and Auth claim writes are separate, retryable operations.
- Next: verify browser wizard, define minimal org membership/schema, then close
  claim and organization authorization gaps. Production roadmap remains deferred.

### 2026-10-14 | Complete review and role separation

- Added: BACKEND-REVIEW.md with five-role contract, lifecycle, review coverage,
  capstone simplifications, and unresolved findings. Kept shared helpers small.
- Fixed: unsafe HTTP claim, live account checks, transport/receipt role overlap,
  organization membership/creation/approval, privileged admin targets, signup
  phone checks and retry behavior, PIN/invite concurrency, claim notifications,
  audit shape, photo update permission, org history lookup, and query indexes.
- Wired: volunteer mission release; shared verification SDK; test:backend and CI.
- Checks: npm test passed; test:backend passed (OTP, roles, registration/review,
  rules); 24 module syntax checks passed. Expected permission denials are test successes.
- Environment: reused existing local emulators after a second startup reported
  occupied ports. No deployment, paid SMS, or existing process termination.
- Limits: review complete; full backend journey is not complete. Destination routing
  and atomic credential confirmation remain the highest-priority implementation work.

### 2026-10-14 | Donor flow completed for the capstone

- Added: small donor command module; active destination picker; real returning OTP
  login; canonical/idempotent posting; on-demand volunteer contact; lazy expiry;
  functional history page/tab and statistics from own donation records.
- Fixed: missing donor profile fields/optional permit/consent; QR parameter mismatch;
  owner-only purpose-bound pickup credentials, expiration/regeneration, local signing
  setup; audited cancellation and claim race; verified-phone edit restrictions;
  donor photo role/status rules; useful form errors and submit/OTP busy states.
- Browser finding: replaced the incomplete fake verifier with the SDK's actual
  RecaptchaVerifier; emulator mode bypasses the challenge itself. Disabled browser
  test caches to verify current modules; added no-cache app-script/HTML headers.
- Checks passed: donor API/storage tests; browser registration/consent, OTP login,
  profile prefill, destination, photo compression/upload, post, QR/PIN/countdown,
  realtime board, cancellation/stats, standalone history; broader role/registration/rules
  regressions. Repeated-run test fixtures now reset only their own records/use unique phones.
- Added test:donor to test:backend/CI. Production deployment and paid services remain excluded.
- Next: atomic volunteer pickup/organization receipt and their browser journeys.
  Donor scope/policies/test details are in DONOR-LOGIC.md.

### 2026-10-15 | Atomic handover and usable receipt flow

- Read: latest progress/donor logs and PHASE_CD/STAGE snapshots. Continued the
  explicitly unfinished handover instead of repeating completed donor work.
- Added: one handover transaction, server-only durable receipts, read-only QR preview,
  shared scanner screen, volunteer pickup PIN and receipt QR/PIN/transport controls.
- Closed: consume-before-confirm failure, generic transition bypass, duplicate success
  writes, missing receipt UI, stale cached assignment teardown, and PIN selector including
  the donation-ID input. Removed competing consume-only helpers.
- Seed: replaced legacy hardcoded PIN/QR/organizationId data with emulator-only Auth
  identities, current claims/membership, and canonical donation creation. seed:local passed.
- Checks passed: npm test; test:backend (including new test:handover); rules marker
  denial checks; two actual browser role journeys using QR/PIN in both directions.
  Cold worker timeout in the OTP test was raised from 15s to 45s; no auth checks bypassed.
- Limits: browser used active fixture accounts and QR text through the shared decoded
  path, not physical camera hardware or registration/orientation UI.
- Next: volunteer/org onboarding browser coverage and their dashboard/history metrics.
  Detailed transaction and test contract: HANDOVER-LOGIC.md.
