# Firebase Emulator Test Checklist for ResQFood

## Environment status

Confirmed working in the current terminal:

- Node: v20.20.2
- npm: 10.8.2
- Firebase CLI: 15.28.1

This means the project is now ready for a local emulator smoke test and backend validation.

---

## 1. Pre-flight checks

Run these from the project root:

```bash
cd /home/lynch/Desktop/RESQFOOD/RESQFOODFINAL
node -v
npm -v
firebase --version
ls -la
cat .firebaserc
cat firebase.json
```

Expected result:
- Node and npm versions display successfully
- Firebase CLI version displays successfully
- Firebase config files exist
- Firebase project id is present in `.firebaserc`

---

## 2. Install project dependencies

```bash
cd /home/lynch/Desktop/RESQFOOD/RESQFOODFINAL
npm install
```

Expected result:
- Dependencies install without fatal errors
- `node_modules` is created

If any dependency error occurs, stop here and fix dependency/install issues before continuing.

---

## 3. Start the Firebase emulators

Start the local services needed for frontend and backend validation:

```bash
cd /home/lynch/Desktop/RESQFOOD/RESQFOODFINAL
firebase emulators:start --only hosting,firestore,functions --project resqfood-ec8f5
```

Expected result:
- Hosting emulator starts
- Firestore emulator starts
- Functions emulator starts
- Local URLs appear in the terminal output

Typical local endpoints:
- Hosting: http://localhost:5000
- Firestore: http://localhost:8080
- Functions: http://localhost:5001

---

## 4. Confirm hosting is serving the app

In a separate terminal:

```bash
curl -I http://localhost:5000
curl -L http://localhost:5000 | head -n 20
```

Expected result:
- HTTP 200 response
- HTML loads from the app root
- Page contains the landing page markup

If the app does not respond, verify:
- emulator is still running
- project folder is correct
- Firebase config is valid
- hosting public folder in `firebase.json` is `public`

---

## 5. Confirm app boot flow is reachable

Open the project entry points manually in a browser or via curl:

```bash
curl -I http://localhost:5000/
curl -I http://localhost:5000/register/
curl -I http://localhost:5000/donor/
curl -I http://localhost:5000/volunteer/
curl -I http://localhost:5000/org-admin/
curl -I http://localhost:5000/admin/
```

Expected result:
- Each path returns a valid HTTP response or redirect behavior
- The rewrites in `firebase.json` are working

---

## 6. Validate the Firebase backend contract

This project is mostly frontend logic plus Firebase-backed data flows. The critical backend validation should confirm the following:

### A. Authentication
- user can sign up by phone or email depending on flow
- role is assigned correctly
- auth state loads after refresh

### B. Firestore CRUD logic
- donor creates profile
- donor posts donation
- volunteer claims donation
- donation status transitions happen in valid order
- org admin verifies delivery
- LGU admin can view aggregate data

### C. Function-triggered behavior
- donation created triggers expected actions
- donation update triggers status alerts
- notifications are created
- audit logs update

### D. Validation rules
- donors cannot edit other users’ records
- volunteers cannot claim already claimed donations
- org admins cannot verify unrelated deliveries
- invalid transitions are rejected

---

## 7. Critical real-world test cases

### Donation flow

1. Create donor account
2. Post donation with valid fields
3. Verify donation record exists in Firestore
4. Confirm status is `pending`
5. Confirm QR payload and fallback PIN are generated
6. Confirm donation appears in the donor dashboard

### Volunteer flow

1. Create volunteer profile
2. Confirm volunteer cannot accept missions before activation if the design requires it
3. Claim pending donation
4. Ensure only one volunteer can claim the same donation
5. Update donation status to `scheduled`, then `pickedUp`, then `enRoute`, then `delivered`
6. Confirm state history updates correctly

### Organization verification flow

1. Mark donation as delivered
2. Org admin verifies using QR or PIN
3. Donation state becomes `verified`
4. Notifications appear to donor and volunteer
5. Audit log captures verification event

### Admin / LGU metrics flow

1. Query aggregated donation records
2. Confirm filtering by barangay/date/status works
3. Confirm admin dashboards render from live Firestore data
4. Confirm export or metric generation does not fail

---

## 8. Emulator failure checks

If something fails, check the following in order:

### Failure: app does not load
- run `firebase emulators:start --only hosting --project resqfood-ec8f5`
- check if port 5000 is busy
- verify public folder in `firebase.json`
- verify `.firebaserc` project id matches the target project

### Failure: Firestore not updating
- confirm Firestore emulator is running
- check the browser console for Firebase config errors
- ensure Firestore rules are not too restrictive
- ensure user auth/role is present before write attempts

### Failure: Cloud Functions not firing
- confirm functions emulator is running
- check function logs in the terminal output
- test the exact named trigger path
- inspect Firestore update flow for status transitions

### Failure: auth issues
- confirm Firebase auth is enabled in project settings
- test with a real phone or email flow
- verify web config values in `public/js/core/firebaseConfig.js`

---

## 9. Acceptance criteria for project readiness

The backend can be considered realistically tested if all of the following pass:

- hosting loads locally
- Firestore emulator is active
- donation create → claim → verify flow works end-to-end
- invalid transitions are blocked
- notifications and audit logs are created
- role access follows Firestore rules
- multiple volunteers cannot claim the same donation

---

## 10. Recommended next step

After this emulator checklist passes, the next task should be to implement the first backend priority item:

1. donation lifecycle enforcement
2. volunteer claim atomic transaction
3. role-aware Firestore rules
4. audit log generation
5. notification triggers

This is the minimal realistic backend scope for the project.
