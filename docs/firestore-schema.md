# Firestore Schema (v0.1)

Purpose: definitive reference of collection shapes, sample documents, and required indexes for emulator and production.

Collections overview:

- `users` (document id = uid)
  - `uid` (string)
  - `role` ("donor"|"volunteer"|"orgAdmin"|"lguAdmin"|"systemAdmin")
  - `fullName` (string)
  - `phoneNumber` (string)
  - `barangay` (string)
  - `status` ("active"|"pending_orientation"|"suspended"|"locked")
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)

- `donations` (document id = donationId)
  - `donationId` (string)
  - `donorId` (string)
  - `volunteerId` (string|null)
  - `organizationId` (string|null)
  - `status` ("pending"|"scheduled"|"pickedUp"|"enRoute"|"delivered"|"verified"|"cancelled"|"expired")
  - `foodType` (string)
  - `quantityKg` (number)
  - `pickupWindowStart` (timestamp)
  - `pickupWindowEnd` (timestamp)
  - `pickupAddress` (string)
  - `barangay` (string)
  - `safetyDeclared` (boolean)
  - `fallbackPin` (string)
  - `qrPayload` (string)
  - `statusHistory` (array of map {status, actorUid, at})
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)

- `notifications`
  - `notificationId` (string)
  - `recipientUid` (string)
  - `type` ("donation_update"|"mission_claim"|"delivery_verified"|"reminder")
  - `message` (string)
  - `read` (boolean)
  - `createdAt` (timestamp)

- `verificationRequests` (document id = req_XXXX)
  - `requestId` (string)
  - `uploaderUid` (string)
  - `targetUid` (string|null) // who the verification is for (may be null until linked)
  - `type` ("volunteer_id"|"org_authorization"|"lgu_authorization"|"lgu_letter"|"org_doc"|"training_cert")
  - `storagePath` (string)
    - `referralCode` (string|null)
    - `inviteId` (string|null)
  - `status` ("pending"|"approved"|"rejected")
  - `reviewerUid` (string|null)
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)

- `invites` (document id = invite_XXXX)
  - `inviteId` (string)
  - `tokenHash` (string) // sha256 hex of the invite token
  - `kind` ("lgu"|"org-admin"|"other")
  - `meta` (map) // optional metadata used to prefill forms
  - `createdBy` (string)
  - `createdAt` (timestamp)
  - `expiresAt` (timestamp)
  - `used` (boolean)
  - `usedBy` (string|null)
  - `usedAt` (timestamp|null)

- `auditLogs`
  - `logId` (string)
  - `entityType` ("donation"|"user"|"organization")
  - `entityId` (string)
  - `action` ("status_changed"|"claim_added"|"verification_confirmed"|...)
  - `actorUid` (string)
  - `details` (map)
  - `createdAt` (timestamp)

Indexes (add to `firestore.indexes.json` as needed):
- `donations.status` + `pickupWindowStart` (fast mission board queries)
- `donations.donorId` + `createdAt` (donor history)
- `donations.organizationId` + `status` (org admin filters)

Example `donations` document:

```
{
  "donationId": "don_0001",
  "donorId": "uid_donor_1",
  "volunteerId": null,
  "organizationId": null,
  "status": "pending",
  "foodType": "cooked",
  "quantityKg": 3.5,
  "pickupWindowStart": "2026-08-22T09:00:00Z",
  "pickupWindowEnd": "2026-08-22T11:00:00Z",
  "pickupAddress": "123 Barangay St.",
  "barangay": "Barangay 1",
  "safetyDeclared": true,
  "fallbackPin": "4921",
  "qrPayload": "don_0001|4921",
  "statusHistory": [
    {"status":"pending","actorUid":"uid_donor_1","at":"2026-08-22T08:30:00Z"}
  ],
  "createdAt": "2026-08-22T08:30:00Z",
  "updatedAt": "2026-08-22T08:30:00Z"
}
```

Notes:
- Keep the `donations.status` transitions enforced by server code or security rules (clients should not be trusted to perform arbitrary transitions).
- Use Firestore transactions or callable Cloud Functions to implement atomic claim logic.
- For emulator testing, set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and run the seed script.

Migration tips:
- If changing a required field, write a migration Cloud Function or a one-off script to backfill existing documents before updating rules.
- Avoid renaming fields without coordinated client-side releases.

