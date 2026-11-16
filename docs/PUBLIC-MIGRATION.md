> CANCELLED / HISTORICAL — November 13, 2026: the owner made the final decision to keep the project local. Do not execute the public deployment or migration instructions below. Phone OTP is retained through the Auth emulator. Follow [LOCAL-UAT.md](LOCAL-UAT.md) and the root README instead.

# Public backend migration

Historical status before cancellation: preparation was in progress on November 13, 2026. No public deployment has occurred. The owner selected migration instead of Firebase Blaze. README was updated before code changes.

## Completed preparation

- Reviewed existing Firebase callable, identity, database, and upload dependencies.
- Added public/js/core/backend-transport.mjs, an injectable HTTP transport preserving callable-style error codes, timeouts, bearer-token delivery, and the local adapter. It is not yet imported by the application.
- Added backend/gateway.mjs, a Fetch API gateway with an explicit operation registry, origin allowlist, bounded JSON bodies, server-derived auth context, and sanitized unexpected errors. It requires a real token verifier and guarded domain handlers; neither is wired yet. This is not a deployable backend by itself.
- Ran npm run test:migration: 10/10 tests passed. These use injected identities/handlers and test only transport boundaries, not real JWT verification, Firestore transactions, Workers runtime compatibility, or end-to-end role workflows.

## Inventory: 36 callable operations

- assignRole
- cancelCommunityRequest
- cancelDonorDonation
- claimDonationCallable
- confirmHandover
- consumeInvite
- createDonorDonation
- createInvite
- donorMissionContact
- exportCsv
- issueCredential
- issuePin
- listCommunityOrganizations
- listDonationDestinations
- listMyCommunityRequests
- listOrganizationCommunityRequests
- previewHandover
- recordConsent
- recordOtpSend
- refreshDonorExpiry
- reviewCommunityRequest
- reviewVerificationRequest
- sendNotificationCallable
- setCommunityAvailability
- setUserStatus
- signupLguWithProfile
- signupOrgAdminWithProfile
- signupVolunteerWithProfile
- signupWithProfile
- submitCommunityRequest
- transitionDonationStatusCallable
- updateOrganizationDetails
- validateInvite
- verifyPin
- verifyQr
- volunteerMissionContact

The retired claimDonation HTTP endpoint and exported *Handler helpers must not become public routes. Register guarded callables only. The current functions/index.js wrapper enforces live account status and role consistency; community callables enforce their own resident/coordinator gates. Preserve those checks.

## Remaining migration work

1. Supply cryptographic Firebase ID-token verification, project/issuer/expiry checks, disabled-account/revocation checks, and explicit anonymous access only where the original workflow allows it.
2. Adapt Firebase Admin SDK usage to the Worker runtime. Preserve atomic database transactions, create/update preconditions, conflict retries, timestamps, query results, and custom role claims. Validate against real emulators before choosing between compatible SDK use and a REST adapter.
3. Bind QR_HMAC_SECRET through Worker Secrets. Preserve version 2 purpose-bound QR payloads, expiry, active nonce replacement, single-use confirmation, and durable retry receipts. Never proxy to localhost or expose a signing endpoint without existing role checks.
4. After owner confirmation, replace public phone OTP with verified email/password consistently across registration, login, Find Food tracking, server identity checks, and explanatory UI. Contact phone numbers must not be described as verified. Existing phone accounts require an explicit linking/migration path; never merge identities by matching an unverified contact number.
5. Select private upload storage. Preserve authorization-letter owner/reviewer restrictions, donation image ownership, avatar access, MIME/size limits, and immutable uploads. Adapt data.js, role registration upload modules, verificationReview.js, and backend proof metadata validation. Cloudflare R2 requires an R2 billing subscription even with its included free allowance; do not activate it without the owner's acceptance. A strict no-billing upload provider remains unresolved.
6. Route callables.js, verification.js, and registration.js consent recording through the shared transport. Configure an actual verified backend URL only after backend readiness.
7. Re-run all role, concurrent claim, handover, community, security-rule, upload, and browser regression suites. Test actual Worker CPU/runtime limits and deployed service integration before publishing the frontend.

## Human setup

- Create/sign into a Cloudflare account at https://dash.cloudflare.com/ and use the Workers Free plan. No paid plan or R2 subscription is authorized by the migration choice.
- Authentication choice is pending: verified email/password versus retaining paid SMS. Enable the chosen Firebase sign-in provider and authorized hosting domains only after the flow is implemented.
- Backend Firebase access will need a dedicated service identity with scoped Firestore/Auth permissions. Provision credentials in a local private file or directly as Worker Secrets, never in chat or public/. Exact setup commands will be supplied with the completed adapter.
- Choose upload storage before release; additional account setup may be needed.
- Initial production administrators and verified organizations must be provisioned deliberately. Local demo organizations are not automatically approved production organizations.

## Release gate

Do not publish the application until identity, private uploads, all registered operations, and deployment tests are complete. There is intentionally no Workers deployment command/configuration yet: a gateway without real handlers must not be presented as a working backend. Existing Firebase emulators remain available while migration is pending.

References: https://firebase.google.com/docs/auth/admin/verify-id-tokens and https://developers.cloudflare.com/r2/get-started/
