# Volunteer Demo Guide — ResQFood Prototype Presentation

## Role Overview
The **Volunteer** is the physical connector — they pick up food from donors and deliver it to beneficiary organizations.
Their MVP feature is the **QR Scanner**: they scan the donor's QR code at pickup to confirm they took the right donation.

---

## Pre-Demo Checklist
- [ ] Have `public/donor/qr-display.html` open on a **second device** (phone or tablet) — you'll scan this
- [ ] OR have the donor QR page open on the same screen to show side-by-side
- [ ] Open browser to `public/register/index.html` or jump to `public/volunteer/index.html`
- [ ] Ensure camera permission is allowed in the browser
- [ ] Test the scanner beforehand — verify `html5-qrcode` loads (`public/volunteer/scanner.html`)
- [ ] Know the fallback: if camera fails, explain the PIN fallback verbally

---

## Demo Flow (Step-by-Step)

### 1. Role Gateway — `register/index.html`
**What to say:**
> "The volunteer is the hero of the chain. They move the food from donor to beneficiary. Let's walk through how they join."

**Click:** Volunteer card → `register/volunteer.html`

---

### 2. Registration Wizard — `register/volunteer.html`
Keep this brisk. Highlight the unique volunteer elements.

| Step | What to highlight | Time |
|------|-------------------|------|
| Step 1 — Phone OTP | Same as donor — password-free. | ~20s |
| Step 2 — Identity | Name, barangay, age range. | ~15s |
| Step 3 — Availability | "This is unique to volunteers — they set when they're free. Reduces ghost pickups." | ~20s |
| Step 4 — Transport | Show the options (paa, bisikleta, motor, sasakyan). | ~15s |
| Step 5 — Commitment | Scroll and check. "No ghost pickups — they agree to show up or cancel in advance." | ~20s |
| Success | Click through to dashboard | ~5s |

**Skip shortcut:** Navigate directly to `public/volunteer/index.html`

---

### 3. Mission Board — `volunteer/index.html`
This is the volunteer's main screen.

**What to show:**
- The stats strip at the top (kg saved, missions, points)
- The **Available** tab — show the URGENT mission (red border, pulsing dot) vs regular missions
- The **Aking Missions** tab — show an in-progress mission

**What to say:**
> "Urgent missions are food that expires soon. Volunteers can see the donor's reliability score before committing — they won't take a mission from a donor with a pattern of cancellations."

Point out the reliability chips: "🟢 Maaasahan", "⚪ Baguhan donor".

**Click:** "Tanggapin ang Mission" on the urgent mission.

---

### 4. Active Mission — `volunteer/active-mission.html`
After accepting a mission, this screen tracks the live delivery.

**What to show:**
- The donor name, address, food type, quantity
- The pickup window countdown
- The action buttons: "Nakarating na ako" → "Na-pickup" → "Nai-deliver na"

**What to say:**
> "One tap to update status at each stage. This feeds the donor's and org admin's screens in real time. The volunteer never has to call anyone."

Show the status progression: Scheduled → Picked Up → En Route → Delivered.

---

### 5. QR Scanner — `volunteer/scanner.html` ⭐ MVP FEATURE
This is the **centerpiece of the demo**. Give this the most time.

**Setup:** Have the donor's QR code visible on another screen (`donor/qr-display.html`).

**What to say before scanning:**
> "When the volunteer arrives at the donor's location, the donor shows their QR code. The volunteer scans it to confirm they're taking the right donation. This prevents mix-ups and creates an audit trail."

**Steps to demo:**
1. Open `volunteer/scanner.html`
2. Tap **"📷 Buksan ang Camera"**
3. Allow camera permission when prompted
4. Point the camera at the donor's QR code on the other screen
5. The scan result appears: green "✓ Valid na Donation" badge
6. Show the donation details (food type, quantity, donation ID)
7. Tap **"✅ Kumpirmahin ang Pickup"**
8. Show the success screen

**What to say after scanning:**
> "The QR contains a checksum — it can't be forged. If someone presents a fake QR, it shows a red 'Hindi Valid' badge and blocks the confirmation."

**If camera is unavailable (demo environment, no permission):**
> "In environments without camera access, volunteers can use the 4-digit PIN that appears below the donor's QR code. The org admin side has the same fallback — it's designed for low-tech scenarios."

---

### 6. History — `volunteer/history.html`
Brief visit.

**What to say:**
> "Every completed mission is logged here — date, food type, kg, which organization received it. This builds toward a community service certificate."

---

## Key Talking Points
1. **Urgency system** — urgent missions surface automatically; volunteers see what matters first
2. **Reliability score** — both donors and volunteers build reputations; bad actors are visible
3. **QR checksum** — cannot be forged or screenshot-replayed from a different donation
4. **One-tap status updates** — eliminates phone calls; everyone knows where the food is
5. **PIN fallback** — the system works even without a smartphone camera

## Things to Avoid During Demo
- Don't demonstrate scanning on a low-quality screen — the QR won't decode. Use a phone showing `qr-display.html` directly.
- Don't scan a screenshot of the QR from a PDF or blurry source
- If the camera permission dialog appears and you accidentally deny it, refresh the page and allow it

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Camera permission denied | Refresh page, click 📷 again, approve permission |
| QR not scanning | Move phone closer / adjust angle / increase screen brightness on QR display |
| html5-qrcode fails to load | Check internet connection (CDN dependency); as fallback, describe the flow verbally |
| Scanner shows "Hindi Valid" | The QR is valid — the result card still appears, just with a red badge. Explain this is the anti-fraud check working. |

## Demo Duration
| Segment | Time |
|---------|------|
| Registration | 1.5 min |
| Mission board | 1 min |
| Active mission status | 1 min |
| **QR Scanner demo** | **2 min** |
| History | 30s |
| **Total** | **~6 min** |
