> CANCELLED / HISTORICAL — November 13, 2026: the owner made the final decision to keep the project local. Do not execute the public deployment or migration instructions below. Phone OTP is retained through the Auth emulator. Follow [LOCAL-UAT.md](LOCAL-UAT.md) and the root README instead.

# Firebase deployment — ResQFood

Target project: `resqfood-ec8f5`. Deployment has not completed. The Firebase CLI confirmed project access but reported that enabling Secret Manager requires a Blaze upgrade.

## Account-owner steps

1. Open https://console.firebase.google.com/project/resqfood-ec8f5/usage/details. Review and accept the Blaze usage-based billing upgrade. Set a budget alert; alerts are not a hard spending cap.
2. In Authentication → Sign-in method, enable Phone and Email/Password (the latter is used by App Admin).
3. In Authentication → Settings → Authorized domains, ensure `resqfood-ec8f5.web.app` and `resqfood-ec8f5.firebaseapp.com` are present. Configure the SMS region policy to allow the Philippines for the intended audience.
4. Ensure Firestore's default database and the Storage bucket exist. If prompted to create them, choose the intended location carefully before confirming. The browser configuration currently expects `resqfood-ec8f5.firebasestorage.app`.
5. For the first App Admin, create an Email/Password user in Authentication with your own strong password. Do not use the local seed credentials. Record the UID; it needs both the `systemAdmin` custom claim and an active `users/{uid}` profile set through a trusted Admin SDK setup. Creating an Auth user alone does not grant administrative access. Never share the password or a service-account key in chat.

## Prepared code changes

- Functions runtime is Node.js 22, replacing the retired Node.js 18 runtime.
- QR issuance and handover verification callables bind the `QR_HMAC_SECRET` Secret Manager secret in production.
- Emulator `.env.local` and `.secret.local` files are excluded from Functions uploads.
- Hosting predeploy regenerates and validates the complete 48-sitio JSON asset.
- App Admin login no longer displays local seed credentials.

## Deployment order after setup

Run from the project folder in PowerShell:

```powershell
Set-Location 'C:\Users\Joshua\OneDrive\Desktop\resqfood\RESQFOODFINAL'
firebase login
firebase use resqfood-ec8f5
npm run sync:sitios
```

Provision a new cryptographically random `QR_HMAC_SECRET` through Secret Manager before Functions deployment. Use `firebase functions:secrets:set QR_HMAC_SECRET --project resqfood-ec8f5` and enter the secret privately, or have the deployment script generate it without printing it. Do not reuse the emulator secret. If a production secret already exists, preserve it unless rotation is deliberately planned.

With emulators running, complete `npm run test:backend`, `npm run test:community`, and `npm run test:workspace`. These tests use local fixtures. An earlier backend run produced several passing results but its final completion was not captured, so it must not be reported as a full-suite pass. The browser keyboard test was corrected to focus the control. After restarting localhost, the test identified a volunteer summary-grid overflow at 390px; the width constraint was fixed. All six dashboard routes then passed the 1440px/390px layout, menu, sign-out, and dropdown checks with no unhandled browser exceptions.

Deploy backend and rules first, then Hosting only after success:

```powershell
firebase deploy --only "firestore:rules,firestore:indexes,storage,functions" --project resqfood-ec8f5
firebase deploy --only hosting --project resqfood-ec8f5
```

Do not use `--force` to suppress unexpected function deletion prompts. Review the list if Firebase reports existing cloud functions absent from this source. Indexes can take time to finish building.

Expected URL after a successful release: https://resqfood-ec8f5.web.app (not confirmation of deployment).

## Hosted behavior

Local emulator users, demo organizations, and OTP logs are not deployed. Production QR signing uses Secret Manager. Hosted phone sign-in uses real SMS unless a Firebase test phone number was explicitly configured. For a thesis demo, configure fictional test numbers and private test codes in Authentication; do not import live personal data or rely on localhost OTP logs.

The directory excludes `isDemo` organizations outside emulator mode. A separate hosted demo dataset/policy would need to be configured before those three fictional organizations can appear online. No production accounts, administrator permissions, or demo records have been created by this preparation.

## Official references

- https://firebase.google.com/docs/functions/manage-functions
- https://firebase.google.com/docs/functions/1st-gen/config-env-1st
- https://firebase.google.com/docs/auth/web/phone-auth
- https://firebase.google.com/docs/storage/web/start

