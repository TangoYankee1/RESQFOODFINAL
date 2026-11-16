# Local setup and user acceptance testing

Final decision: November 13, 2026. ResQFood stays local using Firebase emulators. Phone OTP remains part of the app. Public backend migration and the proposed email/password replacement are cancelled.

## Start the application

Prerequisites: Node.js 22, npm, Firebase CLI, and a Java runtime compatible with the installed Firebase emulators. First-time dependency/emulator downloads require internet. Browser CDN dependencies may also require internet; local hosting does not mean the entire app is certified for offline use.

In PowerShell:

~~~powershell
Set-Location 'C:\Users\Joshua\OneDrive\Desktop\resqfood\RESQFOODFINAL'
npm ci
npm --prefix functions ci
npm run emulators
~~~

For later sessions, run only npm run emulators after opening the project directory. The pre-start hook synchronizes all 48 sitios. The start script launches Auth, Firestore, Functions, Storage, and Hosting and prepares the local QR signing key without printing it.

- Application: http://localhost:5000
- Emulator UI: http://localhost:4000
- Auth: 9099; Firestore: 8080; Functions: 5001; Storage: 9199.

Keep the emulator terminal running. Use a second terminal for scripts. Do not run firebase deploy for this setup.

## Phone OTP during UAT

1. The participant enters a designated test phone number and clicks Magpadala ng code.
2. The facilitator reads that request's code from the Auth emulator terminal output.
3. The facilitator gives the code to the participant, who enters it into the app.
4. Record success, incorrect-code behavior, resend behavior, errors, and usability feedback.

Codes are generated for the local flow; no actual SMS is sent. Never describe this as successful real-phone ownership verification or carrier delivery. Do not put a fixed universal OTP in application code. Application-admin email/password sign-in remains unchanged.

## Test data and persistence

Use designated fictional identities and documents. Optional organization fixtures: npm run seed:demo-orgs; see scripts/DEMO-ORGANIZATIONS.md. Seeding these fixtures does not seed every role or workflow.

The current npm run emulators command does not configure automatic import/export. Do not assume records survive an emulator restart. While emulators are running, a facilitator can export a snapshot into the ignored local configuration folder:

~~~powershell
firebase emulators:export .local-config/uat-snapshot --project resqfood-ec8f5
~~~

To restore that snapshot, stop the current emulators first, then run:

~~~powershell
npm run sync:sitios
node scripts/setup-emulator.js
firebase emulators:start --only auth,firestore,functions,storage,hosting --project resqfood-ec8f5 --import .local-config/uat-snapshot
~~~

These snapshot commands are documented procedures, not commands executed by this documentation update. Export again after sessions when retention is needed. Preserve functions/.env.local alongside local data so retained QR credentials continue to use the same signing key. Do not commit snapshots, test participant data, or signing keys.

## UAT scope and equipment

On the host computer, use separate browser profiles or private sessions for different role identities. Test registration/login, donation posting, volunteer claiming, pickup/receipt confirmation, organization requests and responses, and administrative review with the existing permissions.

Suggested record per task: participant code, role, expected outcome, observed outcome, pass/fail, usability feedback, and defect reference. Explicitly mark real SMS delivery, production anti-abuse controls, and public hosting performance as outside this local UAT scope. Confirm that scope with the thesis adviser.

The current app detects localhost/127.0.0.1 and uses localhost emulator endpoints. Do not simply give participants a laptop LAN address: other-device access needs deliberate emulator host binding, frontend configuration, firewall restrictions, and HTTPS for camera-based QR scanning. This update does not enable LAN access or expose emulator administration to other devices.

## Automated checks

With emulators running:

~~~powershell
npm run test:community
npm run test:workspace
npm run test:stats
npm run test:backend
~~~

Run test suites sequentially in a separate test session because scripts create/remove fixtures. Do not run them during participant UAT. Existing migration tests cover unused preparation code only and are not required for local UAT acceptance.
# Administrator access during UAT

Follow [SYSTEM-ADMIN.md](SYSTEM-ADMIN.md) for the single system-admin identity and snapshot recovery. Two application-admin/IT participants can test sequentially without creating two accounts. LGU Admin / Personnel remains a separate participant group and application role.

