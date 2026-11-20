Here is the **complete LGU (System Admin) side** of ResQFood — architectural logic and the Claude-ready prompt.

---

## 1. Core Philosophy: "Monitor, Don't Operate"

The LGU does not rescue food. They **witness, measure, and report** community impact. The dashboard is designed for a **barangay captain or secretary** who needs to stand in front of the Sanggunian and say, _"This month, our barangay rescued 1,247 kg of surplus food via 63 volunteer missions."_ The app must generate that sentence automatically.

**Premortem failures this answers:**

- _"System Admin accounts were a security disaster"_ → Invitation-only, gov domain lock, mandatory MFA, no public registration.
- _"The LGU never actually agreed to maintain it"_ → Signed authorization letter upload creates institutional memory and prevents disowning.
- _"We violated the Data Privacy Act"_ → Every admin action is logged to an immutable `adminAudit` collection. The admin is told this upfront.
- _"No handover plan"_ → Auto-lock after 14 days of inactivity. Audit trail is read-only even to admins.
- _"The 'working system' was just a simulation"_ → Dashboard aggregates real Firestore data; reports are exportable PDF/CSV for barangay filing.

---

## 2. Entry Point: Invitation-Only Fortress

The LGU pipeline is **completely absent** from the public role gateway. There is no _"System Admin"_ card on `register/index.html`. Access is only via a cryptographically random, time-bound invitation URL:

```
https://resqfood.app/register/lgu?token=XYZ123ABC789
```

**Why this matters:** The premortem found that random users selected "System Admin" from a radio button, demo accounts leaked, and the LGU later disowned the platform. Removing the role from public navigation eliminates all of these attack vectors.

### Invitation Document (`invitations/{token}`)

```javascript
{
  token: "XYZ123ABC789",
  intendedBarangay: "Lahug",
  intendedEmailDomain: "lahug.barangay.gov.ph",
  issuedBy: "dev-team-uid",
  issuedAt: serverTimestamp(),
  used: false,
  expiresAt: serverTimestamp() + (7 * 24 * 60 * 60 * 1000) // 7 days
}
```

**Validation on page load:**

1. Query `invitations/{token}`.
2. If `used === true` or `expiresAt < now`: show _"Ang link na ito ay expired o nagamit na. Makipag-ugnayan sa ResQFood team."_
3. If valid: render the acceptance form.

---

## 3. The LGU Registration Pipeline: Institutional Proof

### Step 1: Government Email Verification

**Field:** `officialEmail` — must pass regex for the invited domain (e.g., `*@lahug.barangay.gov.ph` or `*@cebucity.gov.ph`).

**Firebase Action:** `sendEmailVerification()` to this address. The user must click the link before proceeding.

**Why:** Proves institutional affiliation, not personal Gmail ownership.

### Step 2: Authorization Letter Upload

**Upload:** PDF or JPG of a **signed letter from the Barangay Captain** authorizing this person as the ResQFood liaison.

**Storage Path:** `authorization-letters/{token}/{filename}` in Firebase Storage.

**Firestore Link:** The download URL is stored in the invitation doc and later in the user's profile.

**Why:** This creates the legal paper trail that prevents the "LGU distanced itself" failure. The captain signed a letter. The letter is in Firebase Storage. It is retrievable during audits or thesis defense.

### Step 3: Identity & Strict Password

**Fields:**

- `fullName`
- `designation` (e.g., "Barangay Secretary", "SK Chairman")
- `employeeId` (optional but encouraged)

**Password Policy:** 12+ characters, uppercase, lowercase, number, symbol. Enforced via Firebase Identity Platform password policy.

**UX:** No "Confirm Password" field. Use a "Show Password" toggle instead. Research shows confirm-password fields increase abandonment without improving accuracy.

### Step 4: Mandatory MFA Enrollment (Non-Negotiable)

This is a **hard gate**. The UI literally blocks progression until SMS MFA is enrolled via `multiFactor().enroll()`.

- The **"Skip" button is absent**.
- The MFA phone number **must not** match any volunteer or donor number in the `users` collection (cross-reference check via client-side query or Cloud Function validation).
- `mfaEnrolled` is set to `true` before the dashboard is accessible.

**Why:** The premortem found that the barangay secretary used `12345678` and a student leaked admin creds. MFA is the only viable defense for a client-side app with high-privilege users.

### Step 5: Audit Policy Acknowledgment

**Screen:** Plain-language statement:

> _"Ang lahat ng iyong aksyon sa dashboard — pagtingin ng data, pag-export ng report, at pag-suspend ng user — ay nare-record at hindi mabubura. Ito ay para sa transparency ng barangay."_

**Mandatory checkbox:** `auditAcknowledged: true`.

**Why:** This satisfies DPA transparency requirements and psychologically commits the admin to accountable behavior.

### Step 6: Firebase Write

```javascript
// Collection: users/{uid}
{
  uid: <auth_uid>,
  fullName: "Hon. Maria Santos",
  designation: "Barangay Secretary",
  officialEmail: "maria.santos@lahug.barangay.gov.ph",
  contactNumber: "+639173333333",
  role: "systemAdmin",
  barangay: "Lahug",
  authorizationLetterUrl: "https://storage.../auth-letter.pdf",
  invitationToken: "XYZ123ABC789",
  mfaEnrolled: true,
  auditAcknowledged: true,
  status: "active",
  lastPasswordChange: serverTimestamp(),
  createdAt: serverTimestamp()
}

// Collection: adminAudit/{autoId} (first entry auto-created)
{
  adminId: <auth_uid>,
  action: "account_activated",
  details: "Initial registration via invitation token XYZ123",
  ipAddress: "...", // captured if available via Cloud Function or client header
  userAgent: navigator.userAgent,
  timestamp: serverTimestamp()
}
```

**Post-Registration:** Redirect to `admin/index.html` with a **mandatory 15-minute guided tour overlay**. The account **auto-locks** if not used within 14 days, requiring re-verification via MFA + email link.

---

## 4. The Dashboard: Command Center (`admin/index.html`)

### Layout Concept

```
┌─────────────────────────────────────────┐
│  Barangay Lahug — ResQFood Dashboard    │
│  Admin: Maria Santos | 🔒 MFA Active    │
├─────────────────────────────────────────┤
│  METRICS (Date Range: [Last 30 Days ▼]) │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ 1,247kg │ │ 63      │ │ 12      │  │
│  │ Rescued │ │ Missions│ │ Orgs    │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                         │
│  CHARTS                                 │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │ Bar: Food   │  │ Pie: Donor Type │  │
│  │ by Type     │  │ (Biz/Indiv)     │  │
│  └─────────────┘  └─────────────────┘  │
│                                         │
│  ACTIVE MISSIONS                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  • Juan D. — 5kg Kanin → Lahug Kitchen  │
│    Status: En Route | ETA: 3:45 PM      │
│                                         │
│  QUICK ACTIONS                          │
│  [Manage Users] [Export Report] [Audit] │
└─────────────────────────────────────────┘
```

### Data Aggregation Strategy

**The Problem:** Loading all donations into the browser to calculate sums is slow and expensive (Firestore reads).

**The Solution:** A **Cloud Function** (or a scheduled job) writes pre-aggregated metrics to a `dashboardStats/{barangay}` document daily. The LGU dashboard reads **one document**, not 500+.

```javascript
// Collection: dashboardStats/{barangay}
{
  barangay: "Lahug",
  dateRange: { start: Timestamp, end: Timestamp },
  totalKgRescued: 1247,
  totalMissionsCompleted: 63,
  totalBeneficiariesServed: 12, // unique orgs
  activeMissionsCount: 4,
  foodTypeBreakdown: { "Kanin": 450, "Gulay": 320, "Tinapa": 180 },
  donorTypeBreakdown: { "business": 38, "individual": 25 },
  lastUpdated: serverTimestamp()
}
```

**For the prototype:** If Cloud Functions are out of scope, use a **client-side aggregation with pagination**:

- Query `donations` with `limit(100)` and date filters.
- Aggregate in JS.
- Show a loading state: _"Kinakalkula ang datos..."_

### Chart Implementation

Use **Chart.js** (CDN) for the prototype:

- **Bar Chart:** `foodTypeBreakdown` keys vs. kg values.
- **Pie Chart:** `donorTypeBreakdown` (Business vs. Individual).
- **Line Chart:** Weekly trend of `totalKgRescued` over the last 8 weeks.

### Real-Time Active Missions

A separate `onSnapshot` listener on `donations` where:

- `barangay == admin.barangay`
- `status` in `["scheduled", "pickedUp", "enRoute", "delivered"]`

Displayed as a scrollable list with color-coded status badges.

---

## 5. User Management (`admin/users.html`)

### Table Columns

| Name     | Role      | Barangay | Status              | Actions                      |
| -------- | --------- | -------- | ------------------- | ---------------------------- |
| Maria S. | Donor     | Lahug    | Active              | [View] [Suspend]             |
| Juan D.  | Volunteer | Lahug    | Active              | [View] [Suspend] [Reset MFA] |
| Ana R.   | Org Admin | Lahug    | Pending Orientation | [Activate] [View]            |
| Boyet C. | Org Admin | Lahug    | Active              | [View] [Suspend]             |

### Actions

**Suspend User:**

- Sets `users/{uid}.status` to `"suspended"`.
- Suspended users cannot log in (enforced by Firestore rule: `allow read if status == 'active'`).
- Log entry: `adminAudit` — `{ action: "user_suspended", targetUserId: uid, reason: input }`.

**Activate Org Admin:**

- For orgs stuck in `pending_orientation`, a button flips `organizations/{orgId}.status` to `"active"`.
- Triggers a notification to the org's primary contact.

**Role Change:**

- Only allowed between peer roles (e.g., `volunteer` ↔ `volunteer_backup`).
- **Never** allow elevation to `systemAdmin` via this UI. That requires a new invitation token.

---

## 6. Audit Trail (`admin/audit.html`)

### Immutable Log

The `adminAudit` collection is **append-only**. Even the LGU admin cannot delete or edit entries.

```javascript
// Collection: adminAudit/{autoId}
{
  adminId: <uid>,
  action: "user_suspended", // or "report_exported", "org_activated", etc.
  targetUserId: "target-uid", // nullable
  targetOrgId: "org-id", // nullable
  details: "Suspended Juan D. for 3 no-shows.",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  timestamp: serverTimestamp()
}
```

### UI

- Filterable table: by date range, by admin, by action type.
- Exportable to CSV.
- **Read-only.** No delete buttons. No edit buttons.

**Why:** This is the DPA compliance layer and the anti-corruption layer. If a barangay official is accused of favoring one org over another, the audit trail proves what they did and when.

---

## 7. Report Generation (`admin/index.html` or dedicated `admin/reports.html`)

### Export Options

| Format  | Content                                                     | Use Case                    |
| ------- | ----------------------------------------------------------- | --------------------------- |
| **PDF** | Summary metrics + charts + active mission list              | Sanggunian presentation     |
| **CSV** | Raw donation rows (date, donor, volunteer, org, kg, status) | Excel analysis, DILG filing |

**Implementation:**

- **PDF:** Use `html2canvas` + `jspdf` (CDN). Capture the dashboard div as an image, embed in PDF.
- **CSV:** Client-side JS array → CSV string → `Blob` → download link.

**Log Entry:** Every export triggers an `adminAudit` entry: `{ action: "report_exported", details: "PDF, date range: May 1-31" }`.

---

## 8. Auto-Lock & Session Security

| Rule                | Implementation                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Session timeout** | Auto-logout after 4 hours of inactivity. `setTimeout` on interaction events; clear on `beforeunload`.                                                  |
| **Idle lock**       | If no mouse/touch/keyboard for 30 minutes, show lock screen: _"Nag-lock ang dashboard para sa seguridad. I-verify ang MFA muli."_                      |
| **14-day dormancy** | Cloud Function (or client-side check on login) sets `status: "locked"` if `lastLogin < now - 14 days`. Requires email re-verification + MFA to unlock. |
| **Password expiry** | Force change every 90 days. Store `lastPasswordChange`. If `> 90 days`, block dashboard with password reset overlay.                                   |

---

## 9. Firestore Security Rules for LGU

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: LGU can read all, but only update status/role of non-systemAdmins
    match /users/{userId} {
      allow read: if request.auth != null
                   && request.auth.token.role == 'systemAdmin'
                   && request.auth.token.aal == 'aal2';
      allow update: if request.auth != null
                    && request.auth.token.role == 'systemAdmin'
                    && request.auth.token.aal == 'aal2'
                    && resource.data.role != 'systemAdmin' // Cannot modify other admins
                    && request.resource.data.role != 'systemAdmin'; // Cannot elevate to admin
    }

    // Organizations: LGU can read all in their barangay, update status
    match /organizations/{orgId} {
      allow read: if request.auth != null
                   && request.auth.token.role == 'systemAdmin';
      allow update: if request.auth != null
                    && request.auth.token.role == 'systemAdmin'
                    && request.resource.data.keys().hasOnly(['status', 'updatedAt']); // Only status changes allowed
    }

    // Donations: LGU can read all in their barangay
    match /donations/{donationId} {
      allow read: if request.auth != null
                   && request.auth.token.role == 'systemAdmin';
      allow create, update: if false; // LGU does not create or modify donations
    }

    // Admin Audit: Append-only. No one can delete or update.
    match /adminAudit/{docId} {
      allow read: if request.auth != null
                   && request.auth.token.role == 'systemAdmin';
      allow create: if request.auth != null
                    && request.auth.token.role == 'systemAdmin';
      allow update, delete: if false;
    }

    // Invitations: LGU can read their own invitation (during acceptance)
    match /invitations/{token} {
      allow read: if request.auth != null; // Tighten in production to token-only
      allow update: if request.auth != null
                    && resource.data.used == false
                    && request.resource.data.used == true;
    }
  }
}
```

**Note:** `request.auth.token.aal` requires Firebase Identity Platform or custom claims to expose the Authenticator Assurance Level. If using standard Firebase Auth without Identity Platform, enforce MFA via client-side gating and document it as a known limitation for the prototype.

---

## 10. Summary: Premortem → Architecture

| Premortem Failure                    | LGU Architectural Fix                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Weak passwords, leaked demo accounts | Invitation-only + gov domain + mandatory MFA + 12-char password policy                        |
| LGU distanced itself after liability | Signed authorization letter upload in Storage; institutional proof                            |
| No handover plan                     | Auto-lock after 14 days; audit trail immutable; docs/HANDOVER.md                              |
| DPA violation                        | Read-only audit log; explicit audit acknowledgment at registration; no GPS storage            |
| "Working system" was just simulation | Real-time dashboard aggregating live Firestore data; exportable PDF/CSV for Sanggunian        |
| Scope too big                        | LGU module does 3 things: monitor (dashboard), manage (users), report (export). Nothing else. |

---

## Claude-Ready, Token-Optimized Prompt

```
You are an expert Firebase PWA developer. Build the LGU (System Admin) side for "ResQFood," a surplus food redistribution PWA. Vanilla HTML5/CSS3/JS (ES6+), Firebase v9 modular SDK, Chart.js for charts, html2canvas + jspdf for PDF export. No frameworks. Mobile-first but optimized for tablet/desktop admin use.

TECH STACK
- Firebase Auth (Email/Password + mandatory SMS MFA via multiFactor API)
- Firestore
- Firebase Storage (authorization letter uploads)
- No Cloud Functions (client-side aggregation acceptable for prototype)

DATABASE SCHEMA
Collection: invitations/{token}
{ token, intendedBarangay, intendedEmailDomain, issuedBy, used:false, expiresAt:timestamp, createdAt:timestamp }

Collection: users/{uid} (LGU admin)
{ uid, fullName, designation, officialEmail, contactNumber, role:"systemAdmin", barangay, authorizationLetterUrl, invitationToken, mfaEnrolled:true, auditAcknowledged:true, status:"active", lastPasswordChange:timestamp, lastLogin:timestamp, createdAt:timestamp }

Collection: dashboardStats/{barangay}
{ barangay, dateRange:{start,end}, totalKgRescued, totalMissionsCompleted, totalBeneficiariesServed, activeMissionsCount, foodTypeBreakdown:{}, donorTypeBreakdown:{}, lastUpdated:timestamp }

Collection: adminAudit/{autoId}
{ adminId, action:"account_activated"|"user_suspended"|"org_activated"|"report_exported"|"user_viewed", targetUserId(nullable), targetOrgId(nullable), details, ipAddress(nullable), userAgent, timestamp }

Collection: organizations/{orgId}
{ orgId, orgName, orgType, barangay, status:"pending_training"|"active", primaryContactUid, verifiers:[], mode, createdAt }

Collection: donations/{id}
{ donationId, donorId, volunteerId, orgAdminId, foodType, quantityKg, status, pickupAddress:{barangay}, statusHistory, createdAt }

FILES TO GENERATE
1. public/register/lgu-invite.html — Invitation-only acceptance. Flow:
   - Parse URL param ?token=XXX. Validate against Firestore invitations/{token}. If used or expired, show error.
   - Government Email: input must match intendedEmailDomain regex. Firebase sendEmailVerification. Block until verified.
   - Authorization Letter Upload: file input (PDF/JPG) → Firebase Storage path authorization-letters/{token}/{filename}. Store download URL.
   - Identity: fullName, designation, employeeId(optional).
   - Password: 12+ chars with policy enforcement. Show/hide toggle. No confirm field.
   - Mandatory MFA: enroll SMS via multiFactor().enroll(). No skip button. Block progression until enrolled.
   - Audit Acknowledgment: scrollable text + mandatory checkbox.
   - Submit: write users/{uid} with mfaEnrolled:true, auditAcknowledged:true, status:"active", lastPasswordChange:now. Write first adminAudit entry {action:"account_activated"}. Mark invitation used.
   - Redirect to admin/index.html with guided tour overlay.

2. public/js/register/lgu.js — Handler for above. Token validation, email domain check, MFA enrollment flow with recaptcha, atomic writes with recovery screen.

3. public/admin/index.html — Main Dashboard. Layout:
   - Header: barangay name, admin name, MFA status badge, logout.
   - Date Range Picker: [Last 7 Days | Last 30 Days | This Month | Custom]. On change, re-query dashboardStats.
   - Metrics Cards: totalKgRescued, totalMissionsCompleted, totalBeneficiariesServed (count unique orgAdminIds with status verified), activeMissionsCount.
   - Charts (Chart.js CDN):
     * Bar chart: foodTypeBreakdown (Kanin, Gulay, Tinapa, etc. vs kg)
     * Pie chart: donorTypeBreakdown (business vs individual count)
     * Line chart: 8-week trend of totalKgRescued (query donations with date filter, aggregate client-side if no dashboardStats doc exists)
   - Active Missions Table: onSnapshot on donations where barangay == admin.barangay and status in ["scheduled","pickedUp","enRoute","delivered"]. Columns: volunteer name, foodType, quantity, beneficiary org, status badge, last updated.
   - Quick Actions: [Manage Users] → users.html, [Export Report] → triggers PDF/CSV, [View Audit] → audit.html.

4. public/admin/users.html — User Management. Layout:
   - Filter tabs: All | Donors | Volunteers | Org Admins | Pending Orientation.
   - Table: name, role, barangay, status, reliabilityScore(for donors)|missions(for volunteers)|orgName(for orgs).
   - Actions per row:
     * [View] → modal with full profile.
     * [Suspend/Activate] → toggle users.status. Append adminAudit log.
     * [Reset MFA] → for volunteers only (sets mfaEnrolled:false, forces re-enroll on next login).
   - For Org Admins with status "pending_training": [Activate] button flips organizations.status to "active". Log to adminAudit.

5. public/admin/audit.html — Audit Trail. Layout:
   - Filter: date range, admin name dropdown, action type dropdown.
   - Table: timestamp, admin name, action, target, details.
   - [Export CSV] button. Client-side CSV generation.
   - No delete or edit buttons. Read-only UI enforced by absence of mutation buttons.

6. public/admin/reports.html — Report Generator (or modal overlay on index.html):
   - PDF Export: use html2canvas to capture dashboard metrics div + charts, then jspdf to embed image in A4 PDF. Filename: ResQFood_Lahug_May2026.pdf.
   - CSV Export: query donations in date range, convert to CSV string, download Blob. Columns: date, donorName, foodType, quantityKg, volunteerName, beneficiaryOrg, status, verifiedDate.
   - Log both exports to adminAudit.

7. public/js/modules/systemAdmin.js — Core logic:
   - renderDashboard(barangay, dateRange): fetch dashboardStats/{barangay} doc. If missing, fallback to client-side aggregation from donations query with limit(500).
   - renderActiveMissions(barangay): onSnapshot query, real-time table updates.
   - toggleUserStatus(uid, newStatus): update users/{uid}, write adminAudit.
   - activateOrganization(orgId): update organizations/{orgId}, write adminAudit.
   - exportPDF(): html2canvas + jspdf flow.
   - exportCSV(donationDocs): array to CSV conversion.
   - renderAuditTrail(filters): query adminAudit with orderBy timestamp desc, limit(100).

8. public/js/core/auth.js — Add LGU-specific session logic:
   - After login, check users.lastPasswordChange. If > 90 days, force password reset overlay.
   - Idle detection: 30 minutes no interaction → lock screen requiring MFA re-verify.
   - 4-hour absolute session timeout → Firebase signOut + redirect.

FIRESTORE SECURITY RULES (snippet)
- users: systemAdmin can read all. Update allowed only if target role != 'systemAdmin' and request.auth.token.role == 'systemAdmin'. No role elevation to systemAdmin.
- organizations: systemAdmin can read all; update only status field.
- donations: systemAdmin can read all. No create/update.
- adminAudit: systemAdmin can read and create. No update/delete.
- invitations: read during registration; update to mark used.

ACCEPTANCE CRITERIA
1. LGU registration accessible only via valid invitation token; public role gateway has no System Admin option.
2. Gov email domain validated against invitation's intendedEmailDomain.
3. Authorization letter uploaded to Storage before account activation.
4. MFA enrollment blocks dashboard access until completed.
5. Dashboard shows real-time metrics and active missions for the admin's barangay.
6. Charts render food type breakdown and donor type distribution.
7. User management allows suspend/activate for non-admin users and activate for pending orgs.
8. Audit trail is read-only with filterable table and CSV export.
9. PDF report captures dashboard snapshot for Sanggunian presentation.
10. Idle lock and session timeout enforce security without server code.

CONSTRAINTS
- No React, Vue, CSS frameworks. CSS variables. Responsive (320px mobile up to 1200px tablet/desktop).
- All user-facing text in Tagalog/Filipino (except "PDF", "CSV", "MFA", "QR").
- Do not generate Donor, Volunteer, or Org Admin modules.
- Do not generate Cloud Functions. Use client-side aggregation with loading states.
- Output as a file tree with complete working code for each file listed above.
```
