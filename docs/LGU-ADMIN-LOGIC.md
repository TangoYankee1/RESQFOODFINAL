# LGU administrator review

LGU administration is project-wide in this capstone. Barangay metadata does not
provide tenant isolation. The UI now labels that scope and does not claim MFA:
returning administrators use phone OTP at `/admin/login.html`.

## Access and onboarding

- A system administrator issues the invitation. The application binds its token,
  official email, barangay, uploader and authorization request to one account.
- Signup consumes the invitation transactionally. Retrying a committed application
  preserves approval. Suspended/rejected applications cannot restart signup.
- Official email is declared and manually reviewed; `emailVerified` remains false.
- Only system administrators review authorization documents. LGU approval checks
  the user's canonical request and consumed invitation; duplicate requests cannot
  change an approved account.
- Pending and rejected applicants see an application status on every admin page,
  without subscribing to operational collections. Backend rules and callables
  independently enforce active account and role permissions.

## User administration

LGU administrators can suspend/reactivate donors, volunteers and organization
administrators, excluding themselves and privileged administrators. Activation of
reviewed roles requires prior approval. The UI exposes actions matching those
rules and requests an audit reason. Pending review is never an activation shortcut.

The status transaction rechecks the acting administrator's live profile and writes
the immutable audit atomically. Only the organization's primary contact changes
organization status; changing a secondary verifier does not suspend or reactivate
the organization. Missing organizations are not recreated as incomplete stubs.
Unchanged statuses do not create duplicate audit events. Sign-out clears Auth and
the saved redirect intent.

## Reports

Lists/counts do not silently stop at 50, 200 or 500 records. This uses uncapped
subscriptions for the small local demonstration dataset; pagination is future work
for larger datasets. Pending filters include training, orientation and review.
Canonical phone numbers and requested roles are shown for applicants.

Rescue totals include verified donations, selected by posting date. The current
month uses Manila time. Supported food categories all contribute to the chart;
unknown donor types have their own bucket. Missing donor metadata is not assumed
to mean an individual. Donation filters include pickup, delivery and expiry.

CSV exports apply the selected filters before the server limit, escape spreadsheet
formulas and audit the export. The UI states the 1,000-row export limit. Historical
and current audit schemas are normalized for display/export.

## Verification

`npm run test:lgu` exercises live actor permissions, approval requirements,
primary/secondary status propagation, idempotent auditing and duplicate LGU review.
`npm run test:admin` covers invite binding, expiry/concurrency and filtered exports.
Registration-review and cross-role workflow tests verify approval and separation
from assignment, transport and organization receipt.

`npm run test:browser:lgu` exercises invitation issuance, actual emulator OTP,
authorization upload/review, pending/rejected gates, sign-out, returning OTP login,
donation CSV filtering and historical audit export. Requires an isolated Chrome
debug session on port 9223 and Firebase emulators.

These focused backend and LGU browser checks passed during this review. Syntax
checks and scoped whitespace checks passed. A broader onboarding browser attempt
disconnected in the earlier volunteer portion; the focused LGU run completed.

No production deployment, real SMS or geographic tenancy is included.
