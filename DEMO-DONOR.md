# Donor Demo Guide — ResQFood Prototype Presentation

## Role Overview
The **Donor** posts surplus food — leftover rice, bread, vegetables — from their home or business.
Their core contribution is creating a donation post, which generates a QR code that volunteers scan at pickup.

---

## Pre-Demo Checklist
- [ ] Open browser in a **clean tab** (no leftover state)
- [ ] Start at `public/register/index.html`
- [ ] Keep `public/donor/qr-display.html` ready to open as a second tab
- [ ] Have screen brightness high — QR codes must be visible
- [ ] Know the shortcut: `public/donor/index.html` to jump straight to dashboard if registration demo is skipped

---

## Demo Flow (Step-by-Step)

### 1. Role Gateway — `register/index.html`
**What to show:** The 3-role selection screen.

**What to say:**
> "ResQFood has three frontline roles. Right now we'll log in as a Donor — someone with surplus food to share."

**Click:** The Donor card → goes to `register/donor.html`

---

### 2. Registration Wizard — `register/donor.html`
Walk through the 5 steps quickly. Don't get stuck — the audience wants to see the app, not every form field.

| Step | What to highlight | Time |
|------|-------------------|------|
| Step 1 — Phone OTP | "OTP replaces passwords. No one forgets their phone number." Type any 10-digit number, click Send. Type any 6 digits. | ~30s |
| Step 2 — Identity | Fill name and barangay. Show the dropdown has all Cebu City barangays. | ~20s |
| Step 3 — Donor Type | Select "Negosyo" or "Indibidwal". Note the reliability score system. | ~15s |
| Step 4 — Waiver | **Scroll slowly.** The checkbox only unlocks after scrolling. Say: "This is intentional — we want donors to actually read it." | ~20s |
| Step 5 — Success | Click "Pumunta sa Dashboard" | ~5s |

**If you need to skip registration:** Navigate directly to `public/donor/index.html`.

---

### 3. Donor Dashboard — `donor/index.html`
This is where donors spend most of their time.

**What to show:**
- The greeting ("Magandang umaga / hapon / gabi" changes based on time of day)
- The `📋 Board` tab — active donations with status indicators
- Click the `📊 Stats` tab — reliability score and totals
- Point out the orange **"Mag-post ng Surplus"** button — the most important action

**What to say:**
> "The board shows all their donations in real time. The reliability score motivates donors to follow through — if they cancel too often, their score drops and volunteers deprioritize them."

---

### 4. Posting a Donation — `donor/post.html`
Click the "Mag-post ng Surplus" button.

**What to show:**
- Food type dropdown
- Quantity input
- Pickup window (date + time)
- Address field
- Optional photo upload area
- Submit button

**What to say:**
> "This takes under 2 minutes. The pickup window tells volunteers when they can come. The photo helps the volunteer identify the food."

Fill in: **Kanin at Ulam**, **5 kg**, set a pickup window, add an address. Click submit.

---

### 5. QR Code — `donor/qr-display.html`
After posting, this screen appears (or navigate directly).

**What to show:**
- The generated QR code
- The donation details beneath it
- The fallback PIN below the QR (for low-tech scenarios)

**What to say:**
> "This QR code is the handshake between donor and volunteer. The volunteer scans this at pickup to confirm they took the right donation. The PIN is a fallback in case the scanner fails."

**Key point to emphasize:** The QR encodes a checksum — it can't be faked. Show the small PIN number beneath it.

---

### 6. History Tab — `donor/history.html`
**What to say:**
> "Every donation has a full status trail — posted, scheduled, picked up, delivered, verified. Donors can see exactly where their food went and who received it."

---

## Key Talking Points
1. **No password** — OTP-only auth eliminates the most common support problem
2. **Reliability score** — creates accountability without punishment; rewards consistency
3. **QR + PIN dual system** — works even on old phones without cameras
4. **Waiver scroll-gate** — proves the donor acknowledged the food safety terms
5. **Filipino language** — designed for the actual user, not the developer

## Things to Avoid During Demo
- Don't try to upload a photo (no real Firebase Storage in prototype)
- Don't submit the post form if Firebase is not connected — show the form, then navigate directly to `qr-display.html`
- Don't open two accounts in the same browser tab without incognito

## If Something Goes Wrong
- **OTP doesn't advance:** Type any 6 digits one at a time, click Verify
- **Form validation blocks you:** Use the browser address bar to navigate directly to `donor/index.html`
- **QR code doesn't appear:** Navigate to `donor/qr-display.html` directly

---

## Demo Duration
| Segment | Time |
|---------|------|
| Registration walkthrough | 1.5 min |
| Dashboard + Stats | 1 min |
| Post a donation | 1 min |
| QR code display | 1 min |
| **Total** | **~4.5 min** |
