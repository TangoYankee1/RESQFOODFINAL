# Local system administrator

ResQFood has one system administrator identity. LGU admins are separate from this limit. Multiple UAT testers can test this role in supervised sequential sessions with the same account; participant counts are not account counts.

## Create and sign in

Start `npm.cmd run emulators` and keep it running. In a second terminal at the project root, run `npm.cmd run seed:app-admin`.

The default email is `systemadmin@resqfood.local`. To choose another email before initial creation, set `$env:APP_ADMIN_EMAIL = 'your-admin@example.local'`. An existing administrator is reused; changing the email cannot create a second one. Setup checks Auth claims and Firestore profiles, including legacy administrators.

Open http://localhost:5000/app-admin/login.html and use the email and generated password from `.local-config/system-admin-credentials.json`. This plaintext local file is excluded from Git; keep it private and out of screenshots, reports and shared folders. No email or SMS is sent. Passwords are never printed. Rerunning creation does not change the password, reactivate an account or reset its creation date.

Setup runs only against loopback emulators, not production Firebase. Stop application use during provisioning or recovery.

## Recovery

Run `npm.cmd run reset:app-admin` to explicitly rotate the existing administrator's password, re-enable its Auth account, restore its claim and active profile, and revoke refresh tokens. Unrelated claims and the profile creation date are preserved. The local credentials file is replaced. Sign out and sign in again. Existing ID tokens can remain valid until expiry.

After an interruption, preserve `system-admin-credentials.pending.json`. Retry creation if Auth creation has not finished; if the account exists, run explicit reset. If a terminated process left `.local-config/system-admin.lock`, confirm no setup/reset process is running before deleting that lock and retrying. Never delete the singleton registry to bypass conflicts. Multiple legacy admins cause setup to stop without deleting or demoting anyone; inspect the identities and restore consistent data.

## Snapshot persistence and restoration

While emulators run, export:

```powershell
firebase emulators:export .local-config/uat-snapshot --project resqfood-ec8f5
```

Stop the emulators, then restore:

```powershell
npm.cmd run sync:sitios
node scripts/setup-emulator.js
firebase emulators:start --only auth,firestore,functions,storage,hosting --project resqfood-ec8f5 --import .local-config/uat-snapshot
```

Securely preserve the snapshot, credential file and private `functions/.env.local` QR signing configuration. A snapshot restores the password at export time; a newer credential file may not match. Use explicit reset if needed. Restore Auth and Firestore together so claims, profile and `systemConfig/systemAdministrator` UID agree. Starting without an import creates a fresh data set, which requires creation again.

## Safeguards and verification

Ordinary role assignment cannot grant systemAdmin or change an existing system admin. Status controls cannot modify the administrator, including a damaged profile still identified by the registry. The management UI hides those controls. Client rules do not grant registry writes. A transaction reserves one UID; a local file lock prevents simultaneous credential operations in the checkout.

The trusted host operator can bypass application rules using emulator UI or Admin SDK tools. Do not use those tools to add administrators. Run `npm.cmd run test:single-admin` for regression coverage using an isolated emulator project, separate from UAT data.
