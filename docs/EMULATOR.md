# Local capstone setup

Run commands from RESQFOODFINAL in PowerShell. Node, Java 21, and Firebase CLI
must be installed. Use .cmd commands if PowerShell blocks npm/firebase scripts.

```powershell
npm.cmd ci
npm.cmd --prefix functions install
npm.cmd run emulators
```

Open http://localhost:5000 and the Emulator UI address printed by the CLI.
Keep the terminal running. Localhost connects all four SDK services to emulators.
The launcher uses workspace-local CLI configuration and a 60-second Functions
discovery timeout. Wait for function definitions to load, not just open service ports.
Startup now runs scripts/setup-emulator.js to create the ignored local QR signing
configuration in functions/.env.local. It does not overwrite an existing key.
Use fictional Philippine numbers such as +639171234567; sending a code prints it
in the emulator terminal. Enter that issued code in the normal signup form.
No SMS is sent and no SMS subscription is required. Codes are not hardcoded.

Firebase browser SDK files still require internet on first load. Emulator records
are temporary unless explicitly exported/imported; do not use real personal data.
Access through a LAN IP is not wired for emulators in this setup.

For scripted code retrieval (local testing only):

```powershell
Invoke-RestMethod http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes
```

Reference: https://firebase.google.com/docs/emulator-suite/connect_auth

With the emulators running, verify the backend OTP/signup path:

```powershell
npm.cmd run test:otp
```

This checks an emulator-issued code, wrong-code rejection, anonymous callable
rejection, phone mismatch rejection, and donor role/profile creation. It does not
automate the browser signup wizard.

For the complete current backend role checks, run npm.cmd run test:backend.
It covers OTP, role workflows, registration/review, and Firestore rules.
See BACKEND-REVIEW.md for remaining workflow gaps and seed-data requirements.
Donor implementation and browser verification details: DONOR-LOGIC.md.
Use npm.cmd run test:donor for donor-specific API/storage checks.
Use npm.cmd run test:handover for atomic pickup/receipt checks, and npm.cmd run
seed:local for matching local Auth/profile/org/donation fixtures. No PIN is hardcoded.
See HANDOVER-LOGIC.md for exact role steps, retry behavior, and browser coverage.

Donor signup checks the verified phone and assigns the donor role server-side.
Existing roles are preserved. Volunteer/org/LGU onboarding and admin browser checks
are documented in ROLE-ONBOARDING-ADMIN.md.
