# APPENDIX E - USER MANUAL

## 1. Introduction

### What is ResQFood?

ResQFood is a local community food-rescue and assistance platform for Barangay Lahug, Cebu City. It connects food donors with volunteers and verified receiving organizations, and it allows residents to request assistance through participating organizations.

The platform supports the following role-based journeys:

1. **Residents** browse verified organizations and submit phone-verified community assistance requests.
2. **Donors** post available food, track donations, and provide pickup proof.
3. **Volunteers** claim and transport donations, confirm pickup, and provide receipt proof.
4. **Organization Administrators** manage community requests, receive donations, and issue organization responses.
5. **LGU Administrators** monitor project-wide activity, manage eligible accounts, and export reports.
6. **System Administrators** manage the application, review onboarding documents, issue invitations, and maintain account records.

### Who is this manual for?

This manual is for participants, coordinators, LGU personnel, application administrators, testers, and community members using the ResQFood demonstration environment.

### System requirements

- A desktop or mobile web browser with JavaScript enabled
- A stable internet connection for browser Firebase libraries and page resources
- Chrome or another modern browser recommended for testing
- A phone-capable emulator or separate test phone number for OTP login
- Camera permission and HTTPS or a supported localhost environment for QR scanning
- Location services are not required for the core ResQFood workflow

ResQFood is currently maintained as a browser application using Firebase Emulators. It is not a published Android application, and no real SMS or public production service is used in this environment.

---

## 2. Getting Started

### Starting the local application

The facilitator or system operator should keep the emulator terminal running. Open:

- Application: **http://localhost:5000**
- Emulator UI: **http://localhost:4000**

Keep the emulator terminal visible because it prints the OTP codes issued for test phone numbers.

### Home page

At **http://localhost:5000**, the home page provides links to:

- **Mag-rehistro** - create a donor, volunteer, or organization account
- **Find Food** - submit a community assistance request
- Role sign-in pages

Do not use real personal data in the emulator environment.

### Creating an account

1. Open **http://localhost:5000/register/index.html**.
2. Select **Donor**, **Volunteer**, or **Organization**.
3. Choose **Magpadala ng Code** and enter a Filipino mobile number.
4. Retrieve the 6-digit OTP from the emulator terminal or verification endpoint.
5. Enter the OTP and complete the registration form.
6. Upload any required document using a clear fictional or test file.
7. Review and accept the consent statements.
8. Submit the application and wait for system-administrator approval.

Organization and volunteer applications remain pending until reviewed. Donor registration becomes usable after successful verification and profile creation.

LGU accounts are not created through ordinary public registration. They require an invitation issued by the system administrator.

### Signing in

Most operational accounts use phone OTP:

1. Open the role-specific login page.
2. Enter the registered mobile number.
3. Tap **Magpadala ng Code**.
4. Read the newest code for that number from the emulator terminal.
5. Enter the code and sign in.

Role-specific login pages:

| Role | Login page |
|---|---|
| Donor | `/donor/login.html` |
| Volunteer | `/volunteer/login.html` |
| Organization Administrator | `/org-admin/login.html` |
| LGU Administrator | `/admin/login.html` |
| System Administrator | `/app-admin/login.html` |

The system administrator uses email and password rather than phone OTP.

---

## 3. Resident Guide

Residents do not need to register as donors, volunteers, or organization users to submit a community assistance request.

### Finding food assistance

1. Open **http://localhost:5000/find-food.html**.
2. Choose a sitio, or select all sitios.
3. Review the organizations that serve the selected area.
4. Select an organization.
5. Tap **I-verify muna ang numero**.
6. Enter a Philippine mobile number and request an OTP.
7. Enter the emulator-issued code.

### Submitting a request

1. Enter the full name.
2. Select the applicable sitio.
3. Enter the number of people who need assistance.
4. Add an optional message for the organization.
5. Read and check the consent statement.
6. Tap **Ipadala ang Request**.

The request is a coordination request, not a reservation and not a confirmed food allocation.

### Tracking and cancelling a request

1. Open the **Mga request ko** section.
2. Verify or restore the verified mobile session.
3. Select **Lahat**, **Pending / Accepted**, or **Fulfilled / Declined / Cancelled**.
4. Tap **I-refresh ang Requests** to retrieve current status.
5. Pending or accepted requests can be cancelled with a reason.

An organization response may include the collection date, time, meeting point, or reason the request cannot be fulfilled.

---

## 4. Donor Guide

### Donor registration

1. Open `/register/donor.html`.
2. Verify the phone number with OTP.
3. Enter the name and optional email address.
4. Enter the barangay and exact pickup address.
5. Select individual or business donor type.
6. Add business details if applicable.
7. Accept the safety and privacy declarations.
8. Submit the registration.

### Signing in again

1. Open `/donor/login.html`.
2. Enter the registered phone number.
3. Request and enter a fresh OTP.
4. Open the Donor dashboard.

Only an active donor account can post or manage operational donations.

### Posting a donation

1. Tap **Mag-post ng Pagkain**.
2. Choose the food category.
3. Enter the quantity in kilograms.
4. Add a clear food description.
5. Enter the complete pickup address.
6. Select the pickup start and end times.
7. Choose an active receiving organization.
8. Upload a food photo if appropriate.
9. Review the safety declaration.
10. Submit and wait for confirmation.

Post only food that can be delivered within the displayed or configured pickup period.

### Tracking a donation

The Donor dashboard displays:

- Active and pending donations
- Claimed, scheduled, in-transit, and completed statuses
- Verified kilograms
- Earned and reliability points
- Cancellation and history actions

Use **Kasaysayan** to review older records.

### Pickup proof

1. Open the donation's QR/PIN page.
2. Use **Gumawa ng Bagong QR/PIN** only when a fresh code is needed.
3. Show the QR code or read the 4-digit PIN to the assigned volunteer.
4. Close or regenerate old credentials after pickup because a new credential replaces previous proof.

Pickup proof is not for public sharing. QR and PIN credentials expire and must be checked online.

### Cancelling a donation

Only donations that are still pending can be cancelled. Open the pending donation and choose Cancel. Add or confirm a cancellation reason where prompted.

---

## 5. Volunteer Guide

### Volunteer registration

1. Open `/register/volunteer.html`.
2. Verify the phone number using OTP.
3. Enter identity and profile information.
4. Select availability and transport information.
5. Upload the requested identification or supporting document.
6. Provide an emergency contact.
7. Accept the responsibility and privacy declarations.
8. Submit the application.

The account remains in a pending-orientation state until the system administrator approves it.

### Viewing available donations

1. Open `/volunteer/login.html`.
2. Sign in with OTP.
3. Open **Mga Mission**.
4. Review the pending donations and their deadlines.

Expired or unrouted donations are not available for claiming.

### Claiming a donation

1. Select an available donation.
2. Review the pickup address, deadline, food details, and destination organization.
3. Tap **Claim**.
4. Wait for confirmation.

Only one volunteer can successfully claim a donation. If a competing volunteer claims it first, refresh the board.

### Completing pickup

1. Open **Aking Missions** or the assigned mission.
2. Review donor and organization mission details.
3. Open the Pickup Scanner or enter the donor's PIN.
4. Preview the handover.
5. Confirm the pickup with the current QR or PIN.

Pickup changes the donation status from **Scheduled** to **Picked Up**.

### Updating transport

An assigned volunteer can update the mission through:

- Mark En Route
- Mark Delivered

Do not mark delivered until the food physically reaches the receiving organization.

### Receipt proof

1. On the active mission, issue a receipt QR or PIN.
2. Give the proof to an authorized member of the receiving organization.
3. Wait for the organization to confirm receipt.
4. Check the mission status and history after verification.

The receipt QR/PIN is separate from the donor pickup QR/PIN.

---

## 6. Organization Administrator Guide

### Organization registration

1. Open `/register/org-admin.html`.
2. Verify the coordinator's phone number.
3. Enter the coordinator and organization details.
4. Enter the exact organization address.
5. Upload authorization documents.
6. Complete the camera/PIN device check.
7. Accept training, verification, and privacy declarations.
8. Submit the application.

The organization remains pending until a system administrator approves the application.

### Returning sign-in

1. Open `/org-admin/login.html`.
2. Enter the registered phone number.
3. Request and enter the emulator OTP.

Both the account and the organization must be active for operational use.

### Community Requests

1. Open **Community Requests** on the Organization dashboard.
2. Review pending resident requests.
3. Accept or decline the request.
4. For accepted requests, enter the confirmed number of people, collection date and time, meeting point, and response.
5. Mark assistance as fulfilled or decline when unavailable.

A written response is required for status changes. Community request fulfillment is separate from donation delivery verification.

### Organization availability

The organization can set accepting, at capacity, or temporarily unavailable status. Closed availability prevents new submissions but does not remove existing request records.

### Delivery receipt

1. Open **Receipt** or the delivery verification section.
2. Select the saved QR or PIN verification mode.
3. Scan or enter the volunteer's receipt proof.
4. Preview the donation.
5. Confirm receipt.

Receipt confirmation changes **Delivered** to **Verified**.

### Organization dashboard

The dashboard includes:

- Pending and delivered donations
- Verified receipts
- Monthly and lifetime food quantities
- Community request inbox
- Organization settings
- Donation history

---

## 7. LGU Administrator Guide

LGU accounts are created through a system-administrator invitation and must be approved for access.

### LGU sign-in

1. Open `/admin/login.html`.
2. Enter the registered phone number.
3. Request and enter the OTP from the emulator terminal.

### Dashboard

The LGU dashboard provides project-wide data about:

- Active organization accounts
- Donations and verified rescue quantities
- Donor, volunteer, and organization status
- Audit records
- CSV reports

### Managing account status

1. Open the Users section.
2. Select a donor, volunteer, or organization administrator.
3. Review the current status.
4. Activate or suspend the account.
5. Provide an audit reason where required.

LGU administrators cannot suspend themselves or privileged system-administrator accounts.

### Exporting reports

1. Open the Donations or Reports section.
2. Select status, date, or barangay filters.
3. Review the matching result.
4. Tap Export CSV.
5. Retain the spreadsheet according to local UAT rules.

CSV exports include the applied filters and are limited by the configured row limit.

### Audit trail

Open Audit Trail to review relevant account, donation, status, export, and approval activities.

---

## 8. System Administrator Guide

### Signing in

1. Open `/app-admin/login.html`.
2. Enter `systemadmin@resqfood.local` or the locally configured administrator email.
3. Enter the password recorded in the private local credentials file:
   `.local-config/system-admin-credentials.json`
4. Sign in.

Do not photograph or share the password.

### Reviewing organization and volunteer applications

1. Open the application or verification list.
2. Select a pending record.
3. Preview the uploaded document.
4. Compare the applicant and document details.
5. Approve or reject the application.

Approval activates the account and assigns the applicable role claim.

### Issuing an LGU invitation

1. Open **Invites** or the LGU invitation section.
2. Enter the official contact email.
3. Select the barangay.
4. Set the invitation validity period.
5. Create the invitation.
6. Copy the generated link and give it to the intended LGU applicant.

No email or SMS is sent automatically. The LGU applicant must use the invitation and complete the phone-OTP process.

### Reviewing LGU applications

1. Open the pending LGU applications.
2. Review the submitted authorization document.
3. Compare the invitation, phone, email, and barangay.
4. Approve or reject the application.

LGU review is the system administrator's responsibility.

### Managing users

The system administrator can search accounts and review active, pending, suspended, or rejected statuses. Use role and status controls according to project policy and record an audit reason when prompted.

---

## 9. Logging Out and Returning

### Log out

1. Open the account navigation or sidebar.
2. Tap **Log Out** or **Sign Out**.
3. Close private or shared browser sessions after testing.

### Change the phone number for a resident request

In **Find Food**, use **Gumamit ng ibang numero** to sign out of the current resident phone session.

### Resetting local access

Password reset for the application administrator is not an email recovery feature. The facilitator must rotate or recover the local administrator password using:

```powershell
npm.cmd run reset:app-admin
```

Phone OTP users request a fresh code. Use only emulator-issued codes.

---

## 10. Troubleshooting

| Problem | Corrective action |
|---|---|
| Page cannot load | Confirm the emulator terminal is running and open `http://localhost:5000`. |
| OTP was not received | No SMS is sent locally. Read the code from the emulator terminal or verification endpoint. |
| Wrong OTP | Request a fresh code and enter the newest 6-digit code. |
| Account is pending | Wait for system-administrator review or correct an incomplete application. |
| Account is rejected or suspended | Contact the facilitator or system administrator. |
| Camera does not open | Allow camera permission and use a supported browser. Enter a fallback PIN if available. |
| QR preview fails | Confirm the code belongs to the current donation and has not expired or been replaced. |
| Pickup or receipt will not confirm | Confirm that the account, organization, mission state, proof purpose, and deadline are valid. |
| Organization cannot receive | Confirm the organization and account are active and the volunteer is assigned to that organization. |
| Different role redirected to login | Sign out and use the login page for the account's actual role. |
| Records disappeared after restart | Emulator records are temporary unless exported and restored with a snapshot. |

---

## 11. Local Demonstration Accounts

These identities are fictional and restricted to the Firebase Emulator.

### LGU administrators

| Account | Phone | Login |
|---|---|---|
| Maria Elena Santos (Demo) | `+639170009101` | `/admin/login.html` |
| Jose Miguel Reyes (Demo) | `+639170009102` | `/admin/login.html` |
| Ana Patricia Cruz (Demo) | `+639170009103` | `/admin/login.html` |
| Carlo Daniel Mendoza (Demo) | `+639170009104` | `/admin/login.html` |

### Organization administrators

| Organization | Phone | Login |
|---|---|---|
| DEMO - Lahug Community Kitchen | `+639170009201` | `/org-admin/login.html` |
| DEMO - Lahug Feeding Partners | `+639170009202` | `/org-admin/login.html` |
| DEMO - Lahug Food Support | `+639170009203` | `/org-admin/login.html` |

### Additional fixtures

| Role | Phone |
|---|---|
| Donor | `+639170001001` |
| Volunteer | `+639170001002` |
| Organization | `+639170001003` |

Use separate browser profiles or private sessions for different roles. Request a fresh OTP for each phone login.

---

## 12. Security and Testing Notes

- Do not use real personal, medical, government, or payment information.
- Do not represent a demo organization or LGU account as an official government account.
- Do not assume emulator OTP delivery represents real SMS delivery.
- Do not share system-administrator credentials.
- Do not bypass application approvals by editing emulator data.
- Log out after each session.
- Keep emulator snapshots and credential files out of Git and shared folders.
- Confirm QR scanning, camera access, mobile layouts, offline behavior, and SMS are out of scope unless separately tested on supported real devices.
