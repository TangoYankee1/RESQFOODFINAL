# Org Admin (Beneficiary) Demo Guide — ResQFood Prototype Presentation

## Role Overview
The **Org Admin** is the soup kitchen coordinator, barangay feeding program staffer, or church volunteer who **receives** the food.
Their job is simple: confirm that the food arrived. The MVP feature is the **verify screen** — they scan the volunteer's QR code (or enter a PIN) to officially close the delivery loop.

---

## Pre-Demo Checklist
- [ ] Have `public/volunteer/active-mission.html` open on a second device to show the volunteer's QR (or simulate it)
- [ ] Open browser to `public/register/org-admin.html` or jump to `public/org-admin/index.html`
- [ ] Know the demo PINs: **`7834`** (DON-2026-0041) and **`1234`** (always valid)
- [ ] Camera permission should be pre-approved in the browser
- [ ] Have `public/org-admin/verify.html` ready as a direct fallback

---

## Demo Flow (Step-by-Step)

### 1. Context Setting — Before You Click Anything
**What to say:**
> "The beneficiary in ResQFood is typically a soup kitchen coordinator or barangay feeding program staff. They're often elderly, rotating, or not tech-savvy. The system is designed around that reality — it has to work even for someone who has never used an app before."

---

### 2. Registration — `register/org-admin.html`
This registration is **org-first, not person-first** — the most distinctive design decision.

| Step | What to highlight | Time |
|------|-------------------|------|
| Step 1 — Org Profile | "Notice: we're registering the *organization* first, not the person. If staff rotates, the account survives." Fill in org name, type (Soup Kitchen), barangay. | ~30s |
| Step 2 — Primary Contact + OTP | Name, phone OTP. Same flow as other roles. | ~25s |
| Step 3 — Device Check | **This is unique.** Click "Buksan ang Camera." If camera is detected → Standard Mode (QR). If not → Basic Mode (PIN). "The system auto-selects based on hardware capability — no technical decision required from the staff." | ~25s |
| Step 4 — Training Acknowledgment | "Before receiving any deliveries, the org must attend a 30-minute orientation. The account stays 'pending_training' until LGU marks them active." | ~20s |
| Success | Dashboard | ~5s |

**Skip shortcut:** Navigate to `public/org-admin/index.html`

---

### 3. Org Admin Dashboard — `org-admin/index.html`
**What to show:**
- The org name and mode badge (Standard or Basic)
- The stats strip: kg this month, total deliveries, verified today
- The **Paparating** tab — incoming deliveries

**Point out the two delivery types:**
- **"✅ Nakarating na"** (green border) — food has arrived, needs verification
- **"🛵 En Route"** (orange border) — still in transit, button is disabled

**What to say:**
> "The coordinator sees exactly what's coming. They don't need to call anyone — the status updates automatically as the volunteer moves through their mission."

**Click:** "✅ I-verify ang Pagtanggap" on the delivered card → goes to `org-admin/verify.html`

---

### 4. Verify Screen — `org-admin/verify.html` ⭐ MVP FEATURE
This is the **most important screen** for this role.

#### Mode Toggle at the top:
Show the audience the two tabs — **QR Scanner** and **PIN (Basic)**.

**What to say:**
> "The verify screen has two modes. Standard Mode uses the QR code — same technology as the volunteer scanner, but from the receiving end. Basic Mode uses a 4-digit PIN for organizations with old devices or elderly staff."

---

#### QR Scanner Mode Demo:
1. Make sure you're on the **QR Scanner** tab
2. Tap **"📷 Buksan ang Camera"**
3. Point camera at the volunteer's QR code (from `active-mission.html` on another device)
4. Scan completes → green **"✓ Valid na Delivery"** badge appears
5. Show the result rows: food type, quantity, Donor ID, scan timestamp
6. Tap **"✅ I-verify ang Pagtanggap"**
7. Show success: "Na-verify na ang Delivery!"

**What to say:**
> "Once verified, the donor and volunteer both receive a notification. The loop is closed — food reached its destination and it's documented."

---

#### PIN Mode Demo (switch tabs):
1. Click the **"🔢 PIN (Basic)"** tab
2. Show the 4 large digit boxes — easy to tap on any phone
3. Type: **`1234`** (the always-valid demo PIN)
4. Tap **"✅ I-verify gamit ang PIN"**
5. Show success screen

**What to say:**
> "This mode was designed specifically for elderly staff. No camera, no QR — just a number the volunteer reads aloud. The large digit boxes work with any touchscreen, old or new."

---

### 5. Verified Today Tab — `org-admin/index.html`
Go back to the dashboard, click the **"Na-verify"** tab.

**What to say:**
> "Everything verified today appears here as a clean receipt list. At the end of the day, the coordinator can cross-reference this with their paper logbook."

---

### 6. History — `org-admin/history.html`
**What to show:**
- The 4 summary stats (kg this month, total deliveries, volunteers, average per delivery)
- The scrollable list of verified deliveries

**What to say:**
> "This is the org's impact record. A soup kitchen coordinator can show this to their barangay captain: 42.5 kg of rescued food this month, 15 deliveries, from 4 different volunteers."

---

## Key Talking Points
1. **Org-first registration** — account survives staff turnover; no lost access
2. **Auto device check** — system decides Standard vs Basic; no technical judgment needed
3. **Dual verification modes** — QR for modern devices, PIN for elderly/basic phones
4. **Pending training gate** — org can't receive deliveries until orientation is confirmed
5. **Paper logbook compatible** — PIN column explicitly bridges digital and physical records

## Things to Avoid During Demo
- Don't try to scan an invalid or random QR — the red badge will appear but the confirm button is disabled. It's correct behavior, but it may confuse the audience if unexpected.
- Don't demo PIN with a wrong PIN first (unless intentional to show error handling)
- If camera is unavailable in demo environment, **go straight to PIN mode** — it's cleaner

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Camera won't start | Switch to PIN mode tab; demo PIN flow instead |
| QR scan shows "Hindi Valid" | Expected if using a non-ResQFood QR — switch to PIN tab |
| Delivery card "Verify" button is disabled | That delivery is "enRoute" not "delivered" — click the first card (green border) |
| Dashboard shows empty | Navigate directly to `org-admin/index.html` — mock data always loads |

## Demo Duration
| Segment | Time |
|---------|------|
| Context setting | 30s |
| Registration (highlights only) | 1.5 min |
| Dashboard incoming deliveries | 1 min |
| **QR verify demo** | **1.5 min** |
| **PIN verify demo** | **1 min** |
| History summary | 30s |
| **Total** | **~6 min** |
