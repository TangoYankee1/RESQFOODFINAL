# ResQFood

Vanilla HTML/CSS/JS food rescue app — **no npm, no build step**. Deploy with `firebase deploy` only.

## Project layout

```
resqfood/
├── index.html              # Main entry point (SPA shell)
├── manifest.json           # PWA installability
├── service-worker.js       # Offline cache
├── firebase.json           # Hosting config
├── .firebaserc             # Project alias
│
├── DESIGN.md               # Styling reference (design system spec)
├── css/
│   └── styles.css          # Single stylesheet — implements DESIGN.md
│
├── js/
│   ├── firebase-config.js  # Firebase keys + app init
│   ├── auth.js             # Login, register, logout, role check
│   ├── router.js           # Shows/hides sections by role
│   ├── donor.js            # Donor dashboard + posting
│   ├── volunteer.js        # Mission board + QR scanner
│   ├── org-admin.js        # Org verify scan
│   ├── lgu-admin.js        # LGU dashboard + users
│   ├── qr-generator.js     # qrcode.js (CDN)
│   ├── qr-scanner.js       # jsQR + getUserMedia
│   ├── notifications.js    # Toasts + push
│   └── utils.js            # Firestore helpers + formatting
│
├── assets/
│   └── icons/              # PWA icons (192, 512)
│
├── firestore.rules
├── firestore.indexes.json
└── README.md
```

## Styling

1. Read **`DESIGN.md`** for tokens, rules, and component patterns (“The Kinetic Path”).
2. Implement changes only in **`css/styles.css`** — one file, no build step.
3. `index.html` links only `css/styles.css`.

## Stack

- Frontend: HTML, CSS, ES6 modules
- Backend: Firebase Firestore
- Auth: Firebase Email/Password
- QR: qrcode.js + jsQR (CDN)
- Hosting: Firebase Hosting (static)
- PWA: `manifest.json` + `service-worker.js`

## Setup

1. Create a Firebase project; enable **Email/Password** auth and **Firestore**.
2. Copy web config into `js/firebase-config.js`.
3. Set `YOUR_PROJECT_ID` in `.firebaserc`.
4. Install CLI globally: `npm install -g firebase-tools` then `firebase login`.
5. Local preview: `firebase serve` or `python3 -m http.server 8080` (needs HTTP, not `file://`).
6. Deploy: `firebase deploy`.

## Views (SPA)

| Section ID | Who sees it |
|------------|-------------|
| `view-landing` | Signed out |
| `view-auth` | Login / register |
| `view-onboarding` | New users |
| `view-donor` | Donor role |
| `view-volunteer` | Volunteer |
| `view-org-admin` | Beneficiary |
| `view-lgu-admin` | LGU Personnel / Admin |

`router.js` toggles `.hidden` on these sections based on auth state and role.
