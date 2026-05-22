# ResQFood — How It Works

A developer reference covering architecture, data flow, and every module in the project.

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Architecture](#architecture)
4. [Routing System](#routing-system)
5. [Authentication & Roles](#authentication--roles)
6. [Database Layer](#database-layer)
7. [Page Components](#page-components)
8. [Role-Specific Views](#role-specific-views)
9. [QR Code Flow](#qr-code-flow)
10. [Notifications & Toast](#notifications--toast)
11. [PWA & Service Worker](#pwa--service-worker)
12. [Design System](#design-system)
13. [Data Flow Diagrams](#data-flow-diagrams)
14. [Deployment](#deployment)
15. [Development Workflow](#development-workflow)

---

## Overview

ResQFood is a **Progressive Web App (PWA)** that connects food donors with volunteers and beneficiary organizations. Built with:

- **Frontend:** Vanilla HTML, CSS, ES6 modules (no framework)
- **Auth:** Firebase Email/Password
- **Database:** Cloud Firestore
- **Hosting:** Firebase Hosting
- **QR:** qrcode.js + jsQR (lazy-loaded from CDN)

No server-side code. All operations run directly against Firebase from the browser.

---

## File Structure

```
RESQFOOD_FINAL/
├── index.html                  SPA shell — loads app.js
├── service-worker.js           PWA caching strategy
├── manifest.json               PWA metadata
├── firebase.json               Hosting + Firestore config
├── firestore.rules             Firestore security rules
├── firestore.indexes.json      Required compound indexes
├── package.json                Tailwind dev deps only
│
├── css/
│   ├── styles.css              Design tokens + all component styles  ← primary
│   ├── tailwind.css            Compiled Tailwind output (do not edit)
│   ├── input.css               Tailwind directives + base overrides
│   ├── main.css                Deprecated — re-exports styles.css
│   └── variables.css           Deprecated — empty
│
├── js/
│   ├── app.js                  App init, route registration, header updates
│   ├── auth.js                 Auth state, profile, role mapping
│   ├── router.js               Hash-based SPA router with auth guards
│   ├── utils.js                Active Firestore helpers + formatting  ← use this
│   ├── db.js                   Older DB helpers (partial overlap with utils.js)
│   ├── donor.js                Donor dashboard view + QR generation
│   ├── volunteer.js            Volunteer mission board + QR scanner
│   ├── org-admin.js            Beneficiary verification scanner
│   ├── lgu-admin.js            LGU analytics + user management
│   ├── notifications.js        Toast system + push notifications
│   ├── qr-generator.js         QR rendering (qrcode.js)
│   ├── qr-generate.js          Alias for qr-generator.js
│   ├── qr-scanner.js           QR scanning (jsQR + getUserMedia)
│   ├── qr-scan.js              Alias for qr-scanner.js
│   ├── firebase-config.js      Firebase project credentials + SDK init
│   ├── firebase-init.js        Secondary init (imports firebase-config.js)
│   └── pages/
│       ├── home.js             Landing page hero + features
│       ├── get-involved.js     Login / register UI
│       ├── onboarding.js       Post-registration profile completion
│       ├── dashboard.js        Role-aware home after login
│       ├── donations.js        New donation form + donation detail
│       ├── scanner.js          Standalone QR scanner page
│       └── static-pages.js     Impact, How It Works, About, Contact
│
└── assets/icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Architecture

The app is a **Single Page Application (SPA)** with a single `index.html`. All navigation happens via URL hash changes (`#/`, `#/dashboard`, etc.). The `<main id="app">` element is replaced with new HTML by page renderers on each route change.

```
index.html
  └── <main id="app">         ← page renderers write here
  └── <script> app.js         ← registers routes + starts router
         ├── auth.js           ← Firebase auth wrapper
         ├── router.js         ← hash router
         └── pages/*.js        ← one renderer per view
```

---

## Routing System

**File:** `js/router.js`

Hash-based router with named URL parameters and auth guards.

### Key functions

| Function | Description |
|----------|-------------|
| `registerRoute(path, handler, options)` | Register a route. Path supports `:param` segments. Options: `{ requiresAuth: true }` |
| `navigate(rawPath)` | Programmatic navigation — updates `window.location.hash` |
| `startRouter()` | Initialise on page load; listens to `hashchange` and `[data-nav]` link clicks |

### Registered routes

| Path | Handler | Auth required |
|------|---------|---------------|
| `/` | `renderHome` | No |
| `/impact` | `renderImpact` | No |
| `/how-it-works` | `renderHowItWorks` | No |
| `/about` | `renderAbout` | No |
| `/contact` | `renderContact` | No |
| `/get-involved` | `renderGetInvolved` | No |
| `/onboarding` | `renderOnboarding` | Yes |
| `/dashboard` | `renderDashboard` | Yes |
| `/donations/new` | `renderNewDonation` | Yes |
| `/donations/:id` | `renderDonationDetail` | Yes |
| `/scanner` | `renderScanner` | Yes |
| `/404` | 404 page | No |

### Auth guard (`window.__resqRequireAuth`)

Routes with `requiresAuth: true` call this before rendering:
1. If no user → redirect to `/get-involved` (stores redirect target in query param)
2. If `onboardingComplete` is false → redirect to `/onboarding`
3. Otherwise → allow

---

## Authentication & Roles

**File:** `js/auth.js`

### State

| Variable | Type | Description |
|----------|------|-------------|
| `currentUser` | Firebase User | From `onAuthStateChanged` |
| `currentProfile` | Object | Firestore `/users/{uid}` document |
| `authReady` | Promise | Resolves after first auth state check |

### Exports

| Export | Description |
|--------|-------------|
| `register(name, email, password, role)` | Create Firebase user + Firestore profile |
| `login(email, password)` | Firebase sign-in |
| `logout()` | Firebase sign-out |
| `updateProfile(uid, data)` | Merge data into profile; sets `onboardingComplete: true` |
| `getCurrentUser()` | Returns current Firebase user |
| `getProfile()` | Returns current Firestore profile |
| `onAuthChange(callback)` | Subscribe to auth changes; returns unsubscribe function |
| `hasRole(...roles)` | Check if current user matches any role |
| `normalizeRole(role)` | Maps display role → internal view ID |
| `mapAuthError(err)` | Firebase error code → user-friendly message |

### Role mapping

| Display Role (stored in Firestore) | Internal View ID |
|------------------------------------|------------------|
| `Donor` | `donor` |
| `Volunteer` | `volunteer` |
| `Beneficiary` | `org-admin` |
| `LGU Personnel` | `lgu-admin` |
| `Admin` | `lgu-admin` |

### User profile document (`/users/{uid}`)

```js
{
  name:               string,
  email:              string,
  role:               "Donor" | "Volunteer" | "Beneficiary" | "LGU Personnel" | "Admin",
  onboardingComplete: boolean,
  phone?:             string,
  address?:           string,
  // Role-specific (set during onboarding)
  food_types?:        string,   // Donor
  vehicle_access?:    boolean,  // Volunteer
  organization_name?: string,   // Beneficiary, LGU, Admin
  people_served?:     number,   // Beneficiary
  createdAt:          Timestamp,
  updatedAt:          Timestamp,
}
```

---

## Database Layer

**File:** `js/utils.js` (active) — `js/db.js` has partial overlap; consolidate into `utils.js`.

### Collections

| Collection | Description |
|------------|-------------|
| `users` | One document per registered user, keyed by Firebase UID |
| `donations` | All donation records |

### Donation document (`/donations/{id}`)

```js
{
  donorId:      string,     // uid of donor
  food_type:    string,
  description:  string,
  quantity?:    number,
  unit?:        string,
  expires_at?:  Timestamp,
  pickup_address: string,
  status:       "open" | "claimed" | "completed" | "verified",
  volunteerId?: string,     // set when claimed
  claimedAt?:   Timestamp,
  completedAt?: Timestamp,
  verifiedBy?:  string,     // uid of verifying org admin
  verifiedAt?:  Timestamp,
  createdAt:    Timestamp,
  updatedAt:    Timestamp,
}
```

### Key functions

| Function | Description |
|----------|-------------|
| `createDonation(donorId, data)` | Create donation doc → returns ID |
| `getDonation(id)` | Fetch single donation or null |
| `listDonationsByDonor(donorId)` | Donor's donations, createdAt DESC |
| `listOpenDonations()` | All status=open, createdAt DESC |
| `listDonationsByStatus(status)` | Any status, createdAt DESC |
| `claimDonation(id, volunteerId)` | status → claimed, set volunteerId |
| `completeDonation(id)` | status → completed |
| `verifyDonationHandoff(id, verifiedBy)` | status → verified, set verifiedBy |
| `donationQrPayload(id)` | Returns JSON string for QR encoding |
| `parseDonationQr(text)` | Extracts donation ID from scanned QR text |
| `escapeHtml(str)` | XSS protection for template literals |
| `formatDate(value)` | Firestore Timestamp → locale string |

### Required Firestore indexes (`firestore.indexes.json`)

```
donations: donorId ASC + createdAt DESC
donations: status ASC + createdAt DESC
```

### Security rules summary (`firestore.rules`)

| Resource | Read | Write |
|----------|------|-------|
| `/users/{userId}` | Any signed-in user | Owner only |
| `/donations/{id}` | Any signed-in user | Create: donor + status=open; Update: donor OR volunteer/status fields only |

---

## Page Components

### `js/pages/home.js` — Landing page
`renderHome(root)` — Renders hero section with CTA buttons linking to `/get-involved`, plus a three-card features grid.

### `js/pages/get-involved.js` — Auth page
`renderGetInvolved(root)` — Toggleable Sign In / Register form.
- Register: role selector grid → name, email, password
- Sign in: email, password only
- Calls `register()` or `login()` from `auth.js`
- Error messages via `mapAuthError()`

### `js/pages/onboarding.js` — Profile completion
`renderOnboarding(root)` — Role-specific fields after first registration.

| Role | Extra fields |
|------|-------------|
| Donor | food_types |
| Volunteer | vehicle_access (checkbox) |
| Beneficiary | organization_name, people_served |
| LGU / Admin | organization_name |

Calls `updateProfile(uid, data)` then navigates to `/dashboard`.

### `js/pages/dashboard.js` — Home after login
`renderDashboard(root)` — Role-aware view:
- **Donor:** My donations list + "New donation" button
- **Volunteer:** Open donations + "Scan QR" button
- **Beneficiary / LGU / Admin:** Admin panel placeholder

### `js/pages/donations.js` — Donation forms
- `renderNewDonation(root)` — Donor-only form: food_type, description, quantity, unit, expires_at, pickup_address. Redirects non-donors to `/dashboard`.
- `renderDonationDetail(root, params)` — Shows donation card + QR code. Conditional action buttons:
  - Volunteer + status=open → "Claim pickup"
  - Claiming volunteer + status=claimed → "Mark completed"

### `js/pages/scanner.js` — QR scanner
`renderScanner(root)` → returns cleanup function.
- Volunteer and Admin only
- Camera feed via `getUserMedia`
- On successful scan → navigates to `/donations/:id`
- Cleanup passed to `app.js` to stop camera on route change

### `js/pages/static-pages.js` — Informational pages
`renderImpact`, `renderHowItWorks`, `renderAbout`, `renderContact` — Placeholder content pages.

---

## Role-Specific Views

These are legacy role views rendered into static `<div id="view-*">` containers in `index.html` (older pattern). Newer flows use the router + `pages/` system above.

### Donor (`js/donor.js`)
- `onDonorViewShown()` — Loads donor's donations, renders list with "Show QR" buttons
- `showDonorQr(id)` — Renders QR panel for a donation
- DOM: `#view-donor`, `#donor-form`, `#donor-donation-list`, `#donor-qr-panel`

### Volunteer (`js/volunteer.js`)
- `onVolunteerViewShown()` — Loads open donations as mission board
- `startVolunteerScanner()` / `stopVolunteerScanner()` — Camera controls
- On scan: calls `completeDonation(id)`, shows toast, refreshes board
- DOM: `#view-volunteer`, `#volunteer-missions`, `#volunteer-scanner-video`

### Org Admin (`js/org-admin.js`)
- `onOrgAdminViewShown()` — Loads claimed + completed donations pending verification
- Scanner calls `verifyDonationHandoff(id, userId)` → status = verified
- DOM: `#view-org-admin`, `#org-pending-list`, `#org-scanner-video`

### LGU Admin (`js/lgu-admin.js`)
- `onLguAdminViewShown()` → parallel refresh of stats, users, reports
- **Stats:** Count of open, claimed, completed donations
- **Users:** Full `/users` collection table (name, email, role, created date)
- **Reports:** Placeholder for Chart.js integration
- DOM: `#view-lgu-admin`, `#lgu-stats`, `#lgu-users-body`, `#lgu-chart`

---

## QR Code Flow

### Encoding

`js/qr-generator.js` (and alias `qr-generate.js`):
```js
renderQrCode(containerEl, text)
// text = donationQrPayload(id)
//      = JSON.stringify({ type: 'resqfood-donation', id })
```
Lazy-loads qrcode.js from cdnjs. Renders 256×256 canvas in the container.

### Scanning

`js/qr-scanner.js` (and alias `qr-scan.js`):
```js
startScanner(videoEl, canvasEl, onResult)  // starts camera + decode loop
stopScanner(videoEl)                        // stops camera stream
```
Lazy-loads jsQR from jsdelivr. Uses `requestAnimationFrame` loop: capture frame → jsQR decode → call `onResult(text)`.

`parseDonationQr(text)`:
1. Try `JSON.parse(text)` → extract `.id` if `type === 'resqfood-donation'`
2. Fallback: regex match for alphanumeric ID (≥10 chars)

### End-to-end QR sequence

```
Donor creates donation → renderQrCode() shows QR on detail page

Volunteer opens scanner → camera starts → jsQR decodes frame
  → parseDonationQr() → donation ID
  → claimDonation() or completeDonation()
  → navigate('/donations/:id')

Org Admin opens scanner → verifyDonationHandoff(id, orgUid)
  → status = 'verified'
```

---

## Notifications & Toast

**File:** `js/notifications.js`

| Function | Description |
|----------|-------------|
| `toast(message, type, durationMs)` | Show dismissible overlay toast. Types: `success`, `error`, `info` |
| `requestPushPermission()` | Request browser Notification permission |
| `notifyLocal(title, body)` | Fire native notification if permission granted |

Toast container is created on demand and appended to `<body>`.

---

## PWA & Service Worker

### Manifest (`manifest.json`)

```json
{
  "name": "ResQFood",
  "display": "standalone",
  "start_url": "/index.html",
  "theme_color": "#00193c",
  "background_color": "#f4f6f9"
}
```

Icons at 192×192 and 512×512 (with maskable variant).

### Service Worker (`service-worker.js`)

Cache name: `resqfood-v2`

| Event | Behaviour |
|-------|-----------|
| Install | Pre-cache HTML, CSS, JS, icons |
| Activate | Delete old caches, claim clients |
| Fetch (CDN) | Network-first → cache fallback |
| Fetch (same-origin GET) | Network-first → cache on success → fallback to `/index.html` |
| Fetch (non-GET) | Pass through, no caching |

Cache headers via `firebase.json`:
- `service-worker.js` → `Cache-Control: no-cache`
- `*.js`, `*.css` → `Cache-Control: public, max-age=3600`

Service worker registration is skipped on `localhost` (to avoid stale cache during development).

---

## Design System

**File:** `css/styles.css` — canonical implementation of `DESIGN.md`.

### Design tokens

```css
--color-primary:              #00193c   /* Deep navy */
--color-primary-container:    #0a2e5d
--color-secondary:            #705d00
--color-secondary-bright:     #fcd400   /* Jeepney yellow */
--color-surface:              #f4f6f9
--color-on-surface:           #1a2332
--color-error:                #ba1a1a

--font-display:               'Manrope', system-ui
--font-body:                  'Inter', system-ui

--text-display-lg:            clamp(2.5rem, 5vw, 3.25rem)
--text-headline-lg:           clamp(1.75rem, 3vw, 2.25rem)
--text-body:                  1rem
--text-label-sm:              0.7rem

--radius:                     1rem
--radius-xl:                  1.5rem
--radius-full:                9999px

--shadow-ambient:             0 8px 24px rgba(26, 35, 50, 0.05)
--shadow-float:               0 12px 32px rgba(26, 35, 50, 0.06)
--glass-bg:                   rgba(255, 255, 255, 0.8)
--glass-blur:                 16px
--ease-soft:                  300ms ease-in-out
```

### Key DESIGN.md rules
- **No 1px borders** — use background color shifts for separation
- **No pure black** — use `--color-on-surface` or `--color-primary`
- **Glassmorphism** for sticky/floating elements: `bg + backdrop-blur(16px)`
- **Soft transitions** — all state changes use `300ms ease-in-out`
- **Font roles** — Manrope for headlines/numbers, Inter for body/labels

### CSS build

```bash
npm run build:css   # compile css/input.css → css/tailwind.css (minified)
npm run watch:css   # rebuild on file save
```

`css/tailwind.css` is committed to the repo so Firebase Hosting serves it as a static file — no build step at deploy time.

---

## Data Flow Diagrams

### Registration → Onboarding → Dashboard

```
/get-involved
  → User fills role + name + email + password
  → register(name, email, password, role)
      Firebase createUserWithEmailAndPassword
      Firestore setDoc /users/{uid} { onboardingComplete: false }
  → navigate('/onboarding')

/onboarding
  → User fills role-specific fields
  → updateProfile(uid, data)
      Firestore merge /users/{uid} { onboardingComplete: true, ...data }
  → navigate('/dashboard')

/dashboard
  → renderDashboard checks normalizeRole(profile.role)
  → Renders donor / volunteer / org-admin / lgu-admin view
```

### Donation lifecycle

```
status:   open  →  claimed  →  completed  →  verified
          ↑         ↑            ↑              ↑
          Donor     Volunteer    Volunteer      Org Admin
          creates   claims       scans QR       scans QR
```

### QR scan handoff

```
Donor       → renderQrCode(container, JSON({type, id}))  → shows QR
Volunteer   → startScanner() → jsQR decode → parseDonationQr → ID
            → completeDonation(id) → status = 'completed'
Org Admin   → startScanner() → jsQR decode → parseDonationQr → ID
            → verifyDonationHandoff(id, orgUid) → status = 'verified'
```

---

## Deployment

```bash
# Deploy everything (hosting + Firestore rules + indexes)
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only Firestore rules
firebase deploy --only firestore
```

Live URL: `https://resqfood1-2c00f.web.app`

---

## Development Workflow

```bash
# Local preview (Firebase)
firebase serve

# Local preview (Python — no service worker)
python3 -m http.server 8080

# CSS rebuild
npm run build:css

# CSS watch mode
npm run watch:css
```

> **Note:** `firebase serve` only binds to `localhost`. To test with another person on the same Wi-Fi: `firebase serve --host 0.0.0.0` then share your LAN IP. For remote testers: use `firebase deploy` to get a public URL.

---

## Known Issues & Notes

| Issue | Location | Note |
|-------|----------|------|
| Duplicate DB helpers | `db.js` vs `utils.js` | Use `utils.js` for all new code |
| Duplicate QR files | `qr-generator.js` / `qr-generate.js` and `qr-scanner.js` / `qr-scan.js` | Both pairs are functional aliases; consolidate when convenient |
| `firebase-init.js` redundancy | Calls `initializeApp` again after `firebase-config.js` already did | Safe but unnecessary; remove if not imported anywhere |
| `main.css` / `variables.css` | Only re-export or are empty | Safe to delete |
| LGU reports section | `js/lgu-admin.js` | Placeholder — Chart.js integration not implemented |
