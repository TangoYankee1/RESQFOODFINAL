# Role onboarding and admin refinements — October 20, 2026

Scope: local Firebase emulator capstone; no paid SMS or deployment.

## Registration and activation

- Volunteer: phone OTP, profile, ID upload, availability/transport, emergency contact
  and terms; creates a `pending_orientation` profile and volunteer claim.
- Organization: phone OTP, coordinator/organization profile, authorization upload,
  camera check with PIN fallback, training/responsibility acknowledgments; creates
  the organization and a `pending_training` profile with an orgAdmin claim.
- Pending accounts see waiting states on dashboards/history and cannot query
  operational donations or perform mission/receipt commands. Refresh after approval.
- System administrators review documents/training on `/admin/index.html`. Approval
  activates the profile and receiving organization. LGU administrators cannot review
  documents. Approval is one manual gate, not a separate attendance service.
- An approved-review retry repairs a missing Auth claim, preserves other claims,
  and does not duplicate the audit or reactivate a suspended account.

## LGU invitations

Active system administrators create invites on `/app-admin/index.html`, with a
barangay, contact email and 1–168-hour expiry. Copy the generated link; no email is
sent. Only the token hash is stored.

The LGU wizard uses phone OTP and an authorization upload. The server checks the
phone identity, request ownership/type, invite kind/expiry, invited email, optional
domain and barangay. One Firestore transaction binds the request, saves the pending
application, consumes the invite and records the audit. Competing applicants cannot
both consume it. Retries preserve committed application/activation state. Direct
client user-profile creation is denied.

Email is a declared contact field (`emailVerified: false`), not proof of email
ownership. Manual identity/authorization review remains required before assigning
the LGU role. No email verification provider was added.

## Reports

Donation CSV applies barangay/status/date filters before the row limit (up to 2,000).
The dashboard passes its selected period and the donation list its selected status.
Month boundaries use Asia/Manila. Exports record filters and row counts in audit logs.
Spreadsheet formula prefixes, quotes and newlines are escaped.

Historical audit fields (`type`, `at`, `uid`, `donationId`) are normalized for display
and export. For this small dataset, audit reads load records before normalization,
sorting/filtering/limiting to include records without `createdAt`. This is a capstone
simplification, not a scalable production reporting pipeline.

Dashboard sample comparisons were removed. Benefiting organizations count distinct
organizations with verified donations in the selected creation-date period. Weekly
trend buckets include all donations within each week. Report periods use donation
creation; role receipt metrics use `verifiedAt`.

## Verification commands

```powershell
npm.cmd run emulators
```

The launcher uses workspace-local CLI configuration and a 60-second Functions
discovery timeout. Existing environment overrides are preserved. On a cold Windows
start, wait for function definitions to load as well as the service ports.

In another terminal:

```powershell
npm.cmd run test:backend
```

This includes OTP, roles, registration/review, rules, donor/photo, atomic handover,
receipt metrics and admin refinements. Tests cover denial of direct LGU profile writes,
claim-repair retries, formula escaping, filtered limits, legacy audit fields, invite
restrictions/expiry and competing applications.

Browser tests need Node 22+ and an isolated Chrome profile at debug port 9223:

```powershell
$browserProfile = Join-Path (Get-Location) '.browser-metrics'
Start-Process -FilePath 'C:/Program Files/Google/Chrome/Application/chrome.exe' -ArgumentList '--headless=new','--disable-gpu','--remote-debugging-port=9223',('--user-data-dir="' + $browserProfile + '"'),'--no-first-run','--no-default-browser-check','about:blank' -WindowStyle Hidden
npm.cmd run test:browser:handover
npm.cmd run test:browser:onboarding
```

Run browser tests sequentially: they use one isolated tab. Do not connect a personal
profile. Chrome needed an approved launch outside Codex's Windows process sandbox;
disabling GPU alone did not resolve the child-process crash. Application authorization
checks were preserved.

The handover browser test covers QR/PIN in both directions and volunteer/org
dashboards/history. The onboarding test covers all three application flows, actual
Storage uploads, admin review buttons, pending/active screens, camera-denied PIN
fallback, invite issuance, donation filters/CSV and historical audit display/CSV.
Downloads are disabled; the test inspects CSV returned to the browser.

Physical camera scanning and offline recovery still require actual-device checks.
