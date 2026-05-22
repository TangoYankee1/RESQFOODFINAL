# Role Logic Bug Fix — Changelog / Log Content

> Copy-paste ready. Use this as a commit message body, PR description, changelog entry, or dev log.

---

## [Fix] Role Logic Audit — 7 Bugs Corrected Against user_roles_logic.md

### BUG 1 — Admin role removed from self-registration

- **File:** `js/pages/get-involved.js`
- **Issue:** The registration screen listed "Admin" as a selectable role, allowing anyone to self-register as a System Admin.
- **Spec:** System Admin accounts must be pre-seeded manually in the Firebase Console. Self-registration is not allowed.
- **Fix:** Removed `{ id: 'Admin', title: 'Admin' }` from the `ROLES` array. Registration now offers only: Donor, Volunteer, Beneficiary, LGU Personnel.

---

### BUG 2 — LGU Admin (Admin role) could access the QR scanner

- **Files:** `js/pages/scanner.js`, `js/pages/dashboard.js`
- **Issue:** The `/scanner` route guard allowed both `Volunteer` and `Admin` roles. The dashboard also showed a "Scan QR" button for `Admin`. LGU/Barangay officials have no business scanning QR codes.
- **Spec:** LGU Personnel CANNOT scan QR codes.
- **Fix:**
  - `scanner.js`: Changed role check from `['Volunteer', 'Admin']` to `role !== 'Volunteer'` — only Volunteers can access `/scanner`.
  - `dashboard.js`: Removed `|| role === 'Admin'` from the Scan QR button condition.

---

### BUG 3 — LGU Admin could mark donations as "completed"

- **File:** `js/pages/donations.js`
- **Issue:** The `canComplete` flag was true for any user with `role === 'Admin'`, letting LGU Personnel click "Mark completed" on any donation detail page.
- **Spec:** LGU Personnel CANNOT accept missions or complete donations.
- **Fix:** Removed `|| profile?.role === 'Admin'` from `canComplete`. Only the Volunteer who originally claimed the donation can mark it complete.

---

### BUG 4 — Beneficiary dashboard showed open donation listings (same as Volunteer)

- **Files:** `js/pages/dashboard.js`, `js/db.js`
- **Issue:** The Beneficiary role fell into the same `listOpenDonations()` branch as Volunteer, showing all unclaimed food listings — not the incoming deliveries they're waiting to receive.
- **Spec:** Org Admin (Beneficiary) should see incoming deliveries with status En-Route, Delivered, or Completed.
- **Fix:**
  - Added `listDonationsByStatuses(statuses[])` to `db.js` (queries by multiple statuses using Firestore `in` operator).
  - Added a dedicated `Beneficiary` branch in `renderDashboard()` querying `['completed', 'verified', 'delivered', 'en-route']` with heading "Incoming deliveries".

---

### BUG 5 — Volunteer QR scanner had no 3-stage progression

- **Files:** `js/utils.js`, `js/db.js`, `js/volunteer.js`
- **Issue:** The volunteer scanner called a single `completeDonation()` on any scan, jumping straight to `status: 'completed'`. The spec defines three distinct scan stages with separate statuses.
- **Spec:** Volunteer scans at three stages — Scan at Pickup → `picked-up`, Scan En-Route → `en-route`, Scan at Delivery → `delivered`.
- **Fix:**
  - Added three new Firestore update functions to both `utils.js` and `db.js`: `pickupDonation()`, `enRouteDonation()`, `deliveredDonation()`.
  - Rewrote the volunteer scanner handler in `volunteer.js` to use a `SCAN_STAGES` array. Each successful scan advances `activeScanStage` and calls the corresponding db function. After the final delivery scan the stage resets and the mission board refreshes.

---

### BUG 6 — Donation QR code was visible to all roles

- **File:** `js/pages/donations.js`
- **Issue:** `renderQrCode()` was called unconditionally on the donation detail page, so Volunteers, LGU Personnel, and Beneficiaries all saw the QR canvas — which is the donor's job to show.
- **Spec:** Donors view and display the QR code. Volunteers scan the code shown to them by the donor.
- **Fix:** Wrapped the QR render in `if (profile?.role === 'Donor')`. Non-donors now see the message: "Ask the donor to show you the QR code at pickup." The `#qrcode` div is not rendered at all for other roles.

---

### BUG 7 — LGU Admin dashboard showed placeholder text instead of real analytics

- **Files:** `js/pages/dashboard.js`, `js/lgu-admin.js`
- **Issue:** `lgu-admin.js` (with stats cards, user table, and reports section) existed but was never imported or called anywhere. LGU Personnel landed on a dashboard showing: "Extend dashboard.js with reporting queries."
- **Spec:** LGU Personnel should see aggregate metrics, a user table, and report charts.
- **Fix:**
  - Replaced `adminPanel()` with `lguAdminHtml()` which renders the correct DOM structure: `#view-lgu-admin`, `#lgu-stats`, `#lgu-users-body`, `#lgu-admin-tools`, `#lgu-chart`.
  - Imported `initLguAdmin` from `../lgu-admin.js` in `dashboard.js`.
  - After the dashboard HTML is injected, calls `initLguAdmin()` when role is `Admin` or `LGU Personnel`.

---

### Noted (Out of Scope — Data Model Change Required)

- **BUG 8 — Org Admin sees all claimed donations system-wide, not filtered to their organization.** `org-admin.js` queries all `claimed` and `completed` donations. Proper filtering requires a `beneficiaryOrgId` field on each donation document (set at claim time when a volunteer selects a destination org). This is a data model design decision deferred to a future sprint.

---

# Plan: Role Logic Audit & Fixes
