# Four local LGU demonstration accounts

Run `node scripts/seed-demo-lgu.cjs` while the local Auth, Firestore, Functions, Storage and Hosting emulators are running and the system administrator exists. The script creates four fictional identities using the invitation, profile submission and review helpers. It uploads clearly labeled demonstration PDFs, records consumed invitations and review audit entries, and verifies active profiles and LGU claims. It does not send email or SMS. Reruns preserve approved fixtures and refuse conflicting identities or suspended accounts.

| Name (fictional) | Phone login | Email (non-deliverable demo) | Assigned sitio |
| --- | --- | --- | --- |
| Maria Elena Santos (Demo) | +639170009101 | lgu.demo01@resqfood.example | ACACIA |
| Jose Miguel Reyes (Demo) | +639170009102 | lgu.demo02@resqfood.example | ANAPOG |
| Ana Patricia Cruz (Demo) | +639170009103 | lgu.demo03@resqfood.example | SAN JOSE |
| Carlo Daniel Mendoza (Demo) | +639170009104 | lgu.demo04@resqfood.example | SUDLON |

Sign in at http://localhost:5000/admin/login.html with the phone number. Request a fresh OTP and retrieve it from the running emulator terminal. No password or fixed OTP is assigned. These numbers are emulator fixtures only; never send real SMS to them.

Full profiles include name, designation, contact email, phone, demo address, barangay, city, sitio, coveredSitios, audit acknowledgment, invitation and reviewed authorization references. `.local-config/demo-lgu-accounts.json` contains the roster. All four are LGU admins, not system admins.

Sitio coverage is descriptive demo metadata. Current LGU authorization remains barangay-wide and does not enforce assigned-sitio filtering. The fictional addresses and assignments do not represent real government offices or appointments. These preapproved fixtures demonstrate active LGU workflows; they are not evidence that a participant completed onboarding or UAT. Use fresh invited identities to test registration.

Export emulator data before shutting down to retain these accounts; see [SYSTEM-ADMIN.md](SYSTEM-ADMIN.md) for snapshot export and restoration. No production data is created.
