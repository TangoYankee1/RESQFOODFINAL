# LGU Admin (System Admin) Demo Guide — ResQFood Prototype Presentation

## Role Overview
The **LGU Admin** is the barangay secretary or captain-designated liaison who **oversees** the entire operation.
They don't rescue food — they **monitor, manage, and report**. Their audience is the Sanggunian, DILG, or thesis panel.
This role answers the question: *"How do we prove this actually worked?"*

---

## Pre-Demo Checklist
- [ ] Open browser to `public/register/lgu-invite.html` (or jump to `public/admin/index.html`)
- [ ] Use a **wider screen** if possible — this dashboard is optimized for tablet/desktop
- [ ] Chart.js loads from CDN — confirm internet connection before the demo
- [ ] Know the demo token: any string of **6+ characters** (e.g., `LAHUG-2026-DEMO`)
- [ ] Have `public/admin/users.html` and `public/admin/audit.html` ready as tabs
- [ ] CSV export works without Firebase — test it once before presenting

---

## Demo Flow (Step-by-Step)

### 1. Context Setting — Before You Click Anything
**What to say:**
> "Every system needs someone accountable. For ResQFood, that's the LGU — specifically a designated barangay official. They don't touch the food. They watch the data, manage the users, and produce the reports that justify the program to the Sanggunian."

---

### 2. Registration — `register/lgu-invite.html`
This registration is **invitation-only** — no public access.

**What to say before opening:**
> "Notice there's no 'System Admin' option on the role gateway. You can only reach this page via a unique invitation link sent by the ResQFood team. This prevents demo accounts, leaked credentials, and the LGU later claiming they never signed up."

Type in the URL bar: `register/lgu-invite.html` (or append `?token=LAHUG-2026-DEMO`)

| Step | What to highlight | Time |
|------|-------------------|------|
| Step 1 — Token | Type `LAHUG-2026-DEMO`, select Lahug. "Token is validated against Firestore. In production, expired or used tokens show an error." | ~20s |
| Step 2 — Government Email | Type any email. "In production, this must match the barangay's official domain — e.g., @lahug.barangay.gov.ph. Click send, then 'Email Verified'." | ~25s |
| Step 3 — Authorization Letter | Click the upload area, select any file. "The actual signed letter from the Barangay Captain goes here. This is the legal paper trail that prevents the LGU from later disowning the program." Fill in name and password. | ~30s |
| Step 4 — MFA + Audit | Type a phone number, send code, type any 6 digits. Then scroll the audit policy — checkbox unlocks at the bottom. "They literally can't check the box without reading it." | ~35s |
| Success | Click "Pumunta sa Dashboard" | ~5s |

**Skip shortcut:** Navigate directly to `public/admin/index.html`

---

### 3. Main Dashboard — `admin/index.html` ⭐ PRIMARY FEATURE
This is the showpiece of the LGU role. Spend the most time here.

#### Metrics Cards
**What to say:**
> "At a glance: 1,247 kg of food rescued, 63 completed missions, 12 beneficiary organizations, 4 active missions right now. This is the sentence the barangay captain needs to stand up in front of the Sanggunian."

Point to the trend delta on each card: "↑ 12% vs last month."

#### Date Range Switcher
Click each button: **7 Araw → 30 Araw → Buwang Ito**. Watch the numbers update.

**What to say:**
> "They can cut the data any way they need — for a weekly briefing, a monthly report, or a Sanggunian session. The numbers update instantly."

#### Charts (Chart.js)
Walk through all three:

1. **Bar chart — Food Types**
   > "Kanin and gulay are the most rescued. This tells the LGU what types of donors to recruit more of."

2. **Doughnut chart — Donor Types**
   > "63% of donations come from businesses, 37% from individuals. This informs the fundraising strategy."

3. **Line chart — 8-week trend**
   > "The program is growing. Week-over-week, more food is being rescued. This is the evidence of momentum."

#### Active Missions Table
**What to say:**
> "This updates in real time. The LGU can see exactly where every active mission is at this moment — who is carrying food, to which organization, what their ETA is."

---

### 4. User Management — `admin/users.html`
Click "Pamahalaan ang mga User" in the Quick Actions, or the sidebar.

**What to show:**
- The full table of 8 mock users
- Filter by **"Pending Training"** — show Boyet Cruz
- Click **"Activate"** → row changes to Active badge
- Filter by **"Mga Volunteer"** — show Pedro Diaz (suspended)
- Click **"I-activate"** → restores him

**What to say:**
> "The LGU can suspend any user who violates the program rules — a volunteer with repeated no-shows, a donor who posted spoiled food. They can also activate org admins once their orientation is confirmed. Every action is logged."

**View a profile:** Click "Tingnan" on any row to open the profile modal.

---

### 5. Audit Trail — `admin/audit.html`
Navigate to Audit Trail. The suspension from the previous step will appear at the top.

**What to say:**
> "This log is immutable — no delete button, no edit button, not even for the admin. Every action is timestamped: who did it, what they did, who was affected. This is the Data Privacy Act compliance layer. If a barangay official is ever accused of favoritism, this record proves what they actually did."

**Filter demonstration:**
- Click **"Suspended"** — shows only suspension events
- Click **"Exports"** — shows report export events
- Click **"Lahat"** — reset

**Export the CSV:**
Click **"📥 I-export CSV"**. File downloads immediately.

**What to say:**
> "The audit trail is exportable. For a thesis defense or a DILG audit, you hand them this CSV."

---

### 6. Donations View — `admin/donations.html`
Brief visit.

**What to show:**
- Filter to **"Verified"** — the completed, closed donations
- Filter to **"En Route"** — currently in progress
- Click **"📥 I-export CSV"** — downloads immediately

**What to say:**
> "This is the raw data — every donation, who donated it, who delivered it, which organization received it, and the final status. This is what goes to DILG for filing."

---

### 7. CSV Export from Dashboard
Go back to `admin/index.html` and click **"📥 I-export ang CSV"** in Quick Actions.

**What to say:**
> "One click. The report is in their Downloads folder. No printing, no manual encoding. Ready for Excel or DILG submission."

---

## Key Talking Points
1. **Invitation-only access** — eliminates the "anyone can be admin" security failure
2. **Authorization letter upload** — creates institutional accountability; the captain signed it
3. **MFA enrollment** — mandatory, no skip button; protects high-privilege access
4. **Scroll-gated audit acknowledgment** — DPA compliance; admin cannot claim ignorance
5. **Immutable audit trail** — anti-corruption layer; every action is on record
6. **One-click CSV/PDF export** — Sanggunian presentation is built into the dashboard
7. **Real-time active missions** — LGU always knows where the food is

## Things to Avoid During Demo
- Don't try to show PDF export (requires html2canvas/jspdf which may need installation) — use CSV instead
- Don't navigate to the dashboard before loading Chart.js from CDN — check internet first
- Don't demo on a mobile phone — the sidebar nav hides on small screens; use tablet or laptop

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Charts don't render | Check internet (CDN). Say: "In production these use live Firestore data. The charts will render once CDN loads." |
| CSV downloads but is blank | Try a different browser; Blob/URL.createObjectURL works in Chrome/Firefox |
| Sidebar not visible | Screen is too narrow; zoom out or use a wider window |
| User table doesn't update after suspend | Refresh the page — mock data resets; explain the action is logged in the audit trail |

## Suggested Presentation Script (60-second version)
> "ResQFood's LGU dashboard answers the accountability question. [Show metrics.] This month, Barangay Lahug rescued 1,247 kg of food through 63 volunteer missions, serving 12 organizations. [Show chart.] The breakdown shows which food types dominate and whether the program is growing week-over-week. [Switch to users.html] The LGU can manage all users — suspend bad actors, activate new organizations. [Switch to audit.html] Every action is logged permanently. This is the Data Privacy Act layer. [Export CSV] One click for a DILG-ready report."

---

## Demo Duration
| Segment | Time |
|---------|------|
| Context + invitation-only explanation | 30s |
| Registration highlights | 2 min |
| **Dashboard — metrics + charts** | **2 min** |
| User management + suspend/activate | 1.5 min |
| Audit trail + CSV export | 1 min |
| Donations view | 30s |
| **Total** | **~7.5 min** |
