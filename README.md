# ResQFood

Vanilla HTML/CSS/JS food rescue PWA — no bundler, no framework. Deploy with `firebase deploy` only.

## Project layout

```text
resqfood/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .firebaserc
├── .gitignore
│
├── public/                         # Firebase Hosting root
│   ├── index.html                  # Landing page + role gateway
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service Worker: cache + offline fallback
│   ├── offline.html                # Static offline fallback page
│   │
│   ├── register/                   # Role-specific registration pipelines
│   │   ├── index.html              # Role selection gateway (4 cards)
│   │   ├── donor.html
│   │   ├── volunteer.html
│   │   ├── org-admin.html
│   │   └── lgu-invite.html
│   │
│   ├── donor/
│   │   ├── index.html              # Kitchen Status Board (dashboard)
│   │   ├── post.html               # 3-step donation wizard
│   │   ├── history.html
│   │   └── qr-display.html
│   │
│   ├── volunteer/
│   │   ├── index.html              # Mission Board
│   │   ├── active-mission.html
│   │   ├── scanner.html            # jsQR camera viewfinder
│   │   └── history.html
│   │
│   ├── org-admin/
│   │   ├── index.html              # Incoming deliveries + verification queue
│   │   ├── verify.html
│   │   └── history.html
│   │
│   ├── admin/
│   │   ├── index.html              # LGU dashboard (metrics + charts)
│   │   ├── donations.html
│   │   ├── users.html
│   │   └── audit.html
│   │
│   ├── css/
│   │   ├── base.css                # Variables, reset, typography, mobile-first grid
│   │   ├── layout.css              # Shared shell: header, nav, bottom bar, toasts
│   │   ├── auth.css
│   │   ├── register-flow.css       # Step wizard (progress bar, cards)
│   │   ├── donor.css
│   │   ├── volunteer.css
│   │   ├── org-admin.css
│   │   ├── admin.css
│   │   └── offline.css
│   │
│   ├── js/
│   │   ├── core/
│   │   │   ├── firebaseConfig.js   # Firebase init (Auth, Firestore, Storage, Analytics)
│   │   │   ├── auth.js             # Auth state router, session guard
│   │   │   ├── router.js           # Role-based navigation + activation gate
│   │   │   ├── utils.js            # Formatters, validators, toasts
│   │   │   ├── offline.js          # IndexedDB queue + sync banner
│   │   │   └── notifications.js    # In-app toasts + Push API
│   │   │
│   │   ├── qr/
│   │   │   ├── generator.js        # qrcode.js wrapper + payload builder
│   │   │   └── scanner.js          # jsQR wrapper: camera stream + frame capture
│   │   │
│   │   ├── register/
│   │   │   ├── shared.js           # OTP flow, Firestore atomic write, recovery
│   │   │   ├── donor.js
│   │   │   ├── volunteer.js
│   │   │   ├── orgAdmin.js
│   │   │   └── lgu.js              # Token validation, gov email check, MFA
│   │   │
│   │   └── modules/
│   │       ├── donor.js            # Kitchen board, post wizard, cancellation rules
│   │       ├── volunteer.js        # Mission board, atomic claim transaction
│   │       ├── orgAdmin.js         # Delivery queue, verify flow (QR/PIN)
│   │       ├── systemAdmin.js      # Dashboard RPC, chart data, user table
│   │       └── rewards.js          # Points, badges, toast triggers
│   │
│   └── assets/
│       ├── icons/
│       │   ├── icon-72x72.png
│       │   ├── icon-96x96.png
│       │   ├── icon-128x128.png
│       │   ├── icon-192x192.png
│       │   ├── icon-384x384.png
│       │   ├── icon-512x512.png
│       │   └── maskable-icon.png
│       ├── images/
│       │   ├── logo.svg
│       │   ├── empty-state-donor.svg
│       │   ├── empty-state-volunteer.svg
│       │   └── certificate-preview.jpg
│       └── offline/
│           └── offline-illustration.svg
│
├── functions/                      # Firebase Cloud Functions (Node.js)
│   └── index.js                    # Triggers: onCreate donation, onUpdate status
│
├── scripts/
│   ├── seed.js                     # Seed test data: users, donations, orgs
│   └── backup-rules.js
│
└── docs/
    ├── README.md                   # Quick start, env setup, deploy commands
    ├── SETUP.md                    # Firebase project creation, indexes, rules
    ├── ARCHITECTURE.md             # System design, data flow, role matrix
    ├── HANDOVER.md                 # Barangay staff handover guide
    ├── PRIVACY.md                  # DPA compliance, data retention policy
    └── premortem.md                # Risk document (reference for defense Q&A)
```

## Styling

Each page links only the CSS files it needs:

| File | Covers |
| --- | --- |
| `css/base.css` | Variables, reset, typography, grid |
| `css/layout.css` | Header, nav, bottom bar, toasts |
| `css/auth.css` | Login / sign-up forms |
| `css/register-flow.css` | Step wizard, progress bar |
| `css/donor.css` | Kitchen board, donation cards |
| `css/volunteer.css` | Mission board, scanner overlay |
| `css/org-admin.css` | Verification queue, PIN entry |
| `css/admin.css` | Dashboard grid, charts, data tables |
| `css/offline.css` | Offline fallback page |

Design tokens and rules live in [DESIGN.md](DESIGN.md) ("The Kinetic Path").

## Stack

- Frontend: HTML, CSS, ES6 modules
- Backend: Firebase Firestore + Storage
- Auth: Firebase Email/Password
- Functions: Firebase Cloud Functions (Node.js)
- QR: qrcode.js + jsQR (CDN)
- Hosting: Firebase Hosting (static)
- PWA: `manifest.json` + `sw.js`

## Role pages

| Module | Path | Who sees it |
| --- | --- | --- |
| Landing | `/` | Signed out |
| Register gateway | `/register/` | New users |
| Donor dashboard | `/donor/` | Donor role |
| Volunteer board | `/volunteer/` | Volunteer role |
| Org verification | `/org-admin/` | Beneficiary org |
| LGU admin | `/admin/` | LGU Personnel / System Admin |

## Setup

1. Create a Firebase project; enable **Email/Password** auth, **Firestore**, and **Storage**.
2. Copy web config into `public/js/core/firebaseConfig.js`.
3. Set your project ID in `.firebaserc`.
4. Install CLI: `npm install -g firebase-tools` then `firebase login`.
5. Local preview: `firebase serve` (must be HTTP, not `file://`).
6. Deploy: `firebase deploy`.
