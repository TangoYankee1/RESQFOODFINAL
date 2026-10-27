# ResQFood — Production Gap Analysis

Each prototype shortcut found in the codebase (file:line references are from the
pre-refactor scan) is mapped to its production replacement. Final pass/fail per
item lives in `PRODUCTION-READINESS.md`.

## 1. Direct-URL auth bypasses / missing route guards

| # | Prototype shortcut | Location | Production replacement |
|---|---|---|---|
| 1.1 | No page calls `requireAuth`; every dashboard renders for anonymous visitors | `public/donor/*`, `public/volunteer/*`, `public/org-admin/*`, `public/admin/*` (no guard script) | `public/js/core/router.js` route table + `public/js/core/guard-boot.js` loaded in `<head>` of every protected page. Redirects to login **preserving intent** (`?next=`), verifies role from ID-token claims with fallback to `users/{uid}.role`, blocks render until resolved (no flash of unauthorized content). |
| 1.2 | `requireAuth()` exists but is dead code; `requireGuest()` accepts a caller-supplied role | `public/js/core/auth.js:51-66` | Replaced by `requireRole(roles, { next })` in rewritten `auth.js`; role is never caller-supplied — it comes from the server-set claim/profile. |
| 1.3 | Demo docs instruct "navigate directly to `donor/index.html` to skip" | `DEMO-*.md` ("Skip shortcut" sections) | Demo guides deleted (demo-only artifacts). Skipping is impossible: guards redirect unauthenticated direct URLs to login with `next` preserved. |

## 2. Demo PINs and "any 6 digits" OTP

| # | Prototype shortcut | Location | Production replacement |
|---|---|---|---|
| 2.1 | `DEMO_PINS` map + `FALLBACK_VALID_PIN = '1234'` always-valid PIN | `public/js/qr/orgAdminScanner.js:11-12` | Server-issued PINs: Cloud Function `issuePin` (per-donation, per-purpose, single-use, **15-minute TTL**, stored only as SHA-256 hash in `pins/{donationId}_{purpose}`), verified by `verifyPin` callable which invalidates on success/expiry and writes an audit entry. Client uses shared `core/verification.js`. |
| 2.2 | Hardcoded display fallback PIN `'4829'` | `public/donor/qr-display.html:244` | QR/PIN rendered only from the signed donation document fetched via `core/data.js`; missing data shows an explicit Tagalog error + retry. |
| 2.3 | Client-side `Math.random()` PIN generation | `public/js/qr/generator.js:54-56` | Removed. PIN generation is server-only (`functions/lib/pin.js`); the client receives the plaintext PIN exactly once, at issue time. |
| 2.4 | Demo docs: "Type any 6 digits" | `DEMO-DONOR.md:35,111` | Deleted with the demo guides. OTP uses Firebase Phone Auth (a real SMS provider in production); `core/auth.js` enforces **6-digit format, 3-attempt lockout, 5-minute client expiry display**, and `functions/lib/otpGuard.js` enforces **per-phone and per-IP send rate limits** server-side. Never accepts arbitrary codes. |


## 3. "Works without Firebase" / mock-data branches

| # | Prototype shortcut | Location | Production replacement |
|---|---|---|---|
| 3.1 | Donor dashboard renders `MOCK_USER/MOCK_ACTIVE/MOCK_HISTORY/MOCK_STATS` | `public/js/modules/donor.js:4-16` | Rewritten onto `core/data.js` Firestore subscriptions with explicit **loading / empty / error+retry / offline** states. |
| 3.2 | Volunteer board renders `MOCK_VOL/MOCK_AVAILABLE/MOCK_MY_MISSIONS` | `public/js/modules/volunteer.js:3-60` | Real queries (`status == 'pending'`, own missions), atomic claim through the `claimDonationCallable` server function. |
| 3.3 | Org-admin dashboard renders `MOCK_ORG/MOCK_INCOMING` | `public/js/modules/orgAdmin.js:4-31` | Real `organizations` + `donations` queries via `core/data.js`. |
| 3.4 | LGU dashboard renders `MOCK_ADMIN`, `WEEK_DATA`, `FOOD_KG`, `MOCK_DONATIONS_CSV` | `public/js/modules/systemAdmin.js:3-31` | Real aggregation over `donations` with date-range filters; CSV export moved server-side (`exportCsv` callable) so exports are audit-logged. |
| 3.5 | Admin users/audit/donations pages use inline `MOCK_*` arrays; audit "log" written to `sessionStorage` | `public/admin/users.html:92+`, `audit.html:85+`, `donations.html:82+` | Rewritten as module scripts on `core/data.js`; status changes go through `setUserStatus` callable (server writes `users` + immutable `auditLogs`). sessionStorage audit removed entirely. |
| 3.6 | Org-admin history + volunteer active-mission use `MOCK_HISTORY` / demo defaults + fake accelerated countdown | `public/org-admin/history.html:168`, `public/volunteer/active-mission.html:226-256` | Real queries; countdown computed from the actual `pickupWindowEnd` timestamp. |
| 3.7 | Donation post never touches Firestore — writes only `sessionStorage`, `DONOR_ID = 'DEMO_DONOR'` | `public/js/post.js:10,271-287` | Writes the donation document to Firestore (donorId = authenticated uid), then calls the `issueCredential` callable for the HMAC-signed QR payload + server PIN; failure shows recovery screen with retry. |
| 3.8 | CSV export works "without Firebase" from mock arrays | `DEMO-LGU-ADMIN.md:16`, `admin/donations.html` exportCSV | Server-side `exportCsv` callable; every export writes an audit record (`report_exported`). |

## 4. QR / verification security

| # | Prototype shortcut | Location | Production replacement |
|---|---|---|---|
| 4.1 | QR "checksum" = `btoa(fields + 'RESQFOOD2026').slice(0,4)` — reversible, no secret, forgeable | `public/js/qr/generator.js:7-10`, mirrored in both scanners | Versioned, **HMAC-SHA256-signed payload** issued by `functions/lib/signQr.js` (`v, donationId, donorId, issuedAt, expiresAt, nonce, sig`). Secret stays server-side. |
| 4.2 | Two divergent verification implementations each with their own copy of the checksum | `public/js/qr/scanner.js:4-7`, `orgAdminScanner.js:4-8` | **One shared module** `public/js/core/verification.js` used by both scanners: schema parse, structural validation, server signature verification (`verifyQr` callable), PIN verification (`verifyPin` callable), replay rejection. Unit + emulator-tested. |

## 5. Registration architecture

| # | Prototype shortcut | Location | Production replacement |
|---|---|---|---|
| 5.1 | Four hand-rolled wizards with duplicated OTP timers, stepper logic, validation, toast, offline handling | `public/js/register/donor.js` (266 ln), `volunteer.js` (336 ln), `orgAdmin.js` (224 ln), `lgu.js` (179 ln) | **One engine** `public/js/core/registration.js` (step machine, OTP lifecycle, validation framework, consent recording, recovery screen) driven by **four configs** in `public/js/roles/*.js`. Adding a role = adding a config file. |
| 5.2 | Role written by client paths; no consent record captured | `functions/lib/authSignup.js` | Signup functions set the initial **non-privileged** role + custom claim server-side (`donor`/`volunteer`/`orgAdmin` only — `lguAdmin`/`systemAdmin` remain invite/approval-gated) and record a **versioned consent record** (`consentRecords`) with text hash + IP + user agent via `recordConsent`. |

## 6. i18n / data access / errors / analytics (architecture)

| # | Prototype shortcut | Production replacement |
|---|---|---|
| 6.1 | Strings hardcoded inline across every file | `public/js/core/i18n.js` — Tagalog default locale; all new/refactored modules draw from it. Remaining page-level extraction is tracked as FAIL/owner in PRODUCTION-READINESS until completed. |
| 6.2 | Components import `gstatic` Firestore modules directly (20+ call sites) | `public/js/core/data.js` is the only module that touches Firestore for app data. Direct SDK imports confined to `core/` during migration. |
| 6.3 | Ad-hoc `console.error` + `showToast` copies in every file | `public/js/core/errors.js` — centralized classifier → Tagalog user message + retry affordance; global handler wired in `guard-boot.js`. |
| 6.4 | No analytics/telemetry | `public/js/core/analytics.js` — privacy-respecting (no PII, no phone numbers), consent-gated event logging. |

## 7. CDN runtime dependencies

| # | Prototype shortcut | Production replacement |
|---|---|---|
| 7.1 | `fonts.googleapis.com` on every page | Self-hosted **Plus Jakarta Sans + Inter** (woff2) under `public/vendor/fonts/`, single `fonts.css`. |
| 7.2 | `unpkg.com/html5-qrcode` (2 pages) | Vendored to `public/vendor/html5-qrcode.min.js`. |

## 8. Data & privacy (RA 10173)

| # | Requirement | Production replacement |
|---|---|---|
| 8.1 | Versioned, timestamped, immutable consent (text hash + IP + UA) | `functions/lib/consent.js` `recordConsent`; `consentRecords` collection — server-write-only, client read-own, no update/delete (rules). |
| 8.2 | Right to erasure without destroying audit integrity | `docs/PRIVACY.md` deletion flow: PII fields in `users` anonymized (name→`[Removed]`, phone→null), audit rows keep only a stable pseudonymous uid; `scripts/anonymize-user.js` executes it. |
| 8.3 | Retention policy | `docs/PRIVACY.md` (table: collection → retained → why → disposal). |
| 8.4 | PII minimization | Registration configs collect only fields needed for the workflow; GPS never stored; barangay-level location only. |
| 8.5 | Breach response plan | `docs/SECURITY.md` §Incident Response (one-pager + contacts + steps). |

## 9. Rules weaknesses closed

| # | Prototype rule | Replacement |
|---|---|---|
| 9.1 | `users` readable by *any* signed-in user (PII exposure) | Read scoped: self, admins, and coordination-limited reads for parties to shared donations. |
| 9.2 | `donations` readable wholesale by any signed-in user | Scoped list rules: pending (mission board) + own + assigned + admin. |
| 9.3 | `qrCodes` creatable by any signed-in client | Server-only (`create: false`); clients verify through callables. |
| 9.4 | `auditLogs` client-creatable when admin claim present | **Server-only writes** (`create: false`); read restricted to LGU/system admin; `update/delete: false` for everyone. |
| 9.5 | `verificationRequests` readable by any signed-in user | Scoped to uploader/target + reviewer roles. |
| 9.6 | `storage`: `donation-images` writable by any signed-in user, no size/MIME limits | Path-scoped to owner, MIME + size limits on every bucket, deny-by-default retained. |
| 9.7 | New collections ungoverned | Rules added for `pins`, `consentRecords`, `invites` (create server-only, read scoped). |

## 10. Backend functions added

| # | Missing capability | Added |
|---|---|---|
| 10.1 | PIN lifecycle | `functions/lib/pin.js` → `issuePin`, `verifyPin` callables (hash-at-rest, 15-min TTL, single-use, audit on verify). |
| 10.2 | HMAC QR signing | `functions/lib/signQr.js` → `issueCredential` (sign) + hardened `verifyQr` (signature + nonce replay + state checks). |
| 10.3 | OTP send rate limiting | `functions/lib/otpGuard.js` → `recordOtpSend` callable (per-phone 3/10 min, per-IP 20/hour). |
| 10.4 | Consent capture | `functions/lib/consent.js` → `recordConsent`. |
| 10.5 | Audited CSV export | `functions/lib/csvExport.js` → `exportCsv` (role-gated, writes `report_exported` audit). |
| 10.6 | Audited admin status changes | `functions/lib/adminActions.js` → `setUserStatus` (writes user + audit atomically). |

## 11. Tests & CI

| # | Prototype | Replacement |
|---|---|---|
| 11.1 | CI ran 3 of 13 tests, no lint | `.github/workflows/ci.yml` runs lint + full emulator suite (`npm run test:ci`). |
| 11.2 | No tests for OTP/PIN/QR-sign/guards/audit/CSV/consent | Added: `tests/pin-test.js`, `tests/signQr-test.js`, `tests/otp-guard-test.js`, `tests/consent-test.js`, `tests/csv-export-test.js`, `tests/admin-actions-test.js`, `tests/rules/guard-scoping-rules-test.js` (+ existing suite retained). |
| 11.3 | No linter | ESLint scoped to `functions/`, `tests/`, `scripts/`, `public/js/core/`, `public/js/roles/` (`npm run lint`). |

## 12. Documentation

Prototype had `docs/` deleted (visible in git status) and no operations
material. Re-created: `docs/ARCHITECTURE.md`, `docs/SECURITY.md`,
`docs/PRIVACY.md`, `docs/OPERATIONS.md` (deploy/runbook/backup/rollback),
`docs/API.md`, `docs/CONTRIBUTING.md`, `docs/MIGRATION.md`, and root
`PRODUCTION-READINESS.md` checklist (pass/fail + owner per item).

| 7.3 | `cdnjs .../qrcodejs` | Vendored to `public/vendor/qrcode.min.js`. |
| 7.4 | `cdn.jsdelivr.net/npm/chart.js` | Vendored to `public/vendor/chart.umd.min.js`. |
| 7.5 | Firebase SDK from `gstatic.com` | Accepted dependency (official SDK endpoint; no bundler in this project) — documented in `docs/ARCHITECTURE.md`; offline fallback page + service-worker cache. |

| 4.3 | Client-only verification — scanner trusts local checksum; no server validation, no replay protection | `scanner.js:93-120` | Server validates signature + nonce (replay cache) + donation state before any status transition; client shows result only after server response, with offline error + retry. |
