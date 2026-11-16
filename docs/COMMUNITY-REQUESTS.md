## Shared Lahug sitio loading

All sitio selectors use `public/js/core/lahug-locations.js`, fetching a validated list of exactly 48 unique sitios independently of organization API calls. `functions/lib/lahug-sitios.json` is canonical; `npm run sync:sitios` generates the public JSON and runs before emulator startup and Hosting deployment. Donor registration and Find Food share this loader. Search can be cleared, load failures have retries, and organization coverage is displayed/validated separately without hiding sitios from the request form. Barangay fields remain distinct from sitio fields.

## Request management update — November 2026

- One pending or accepted request per verified resident, across all organizations. The server checks existing records inside the submission transaction; the shared submission guard serializes concurrent requests. Existing legacy duplicates remain visible and can be closed/cancelled.
- Coordinators set accepting, at capacity, or temporarily unavailable. Missing availability defaults to accepting for existing active organizations. Closed availability prevents new submissions; existing requests remain reviewable.
- Acceptance requires a confirmed number of people (not above the original request), future collection date/time, and meeting point. Schedule entry and display use Philippine time.
- Residents may cancel pending/accepted requests with a reason. Every new status change records actor UID and timestamp; organization availability and review actions are audited. Legacy records may have no prior history.
- Mga request ko has independent OTP verification, change-number sign-out, active/closed filters, coordinator details, cancellation, and history. Use Refresh to retrieve updates; no automatic SMS or live subscription is implied.
- Sitios are fetched from the shared backend list of 48 Lahug sitios, searchable in the directory. The request form restricts selection to organization coverage. Unknown or uncovered sitios are rejected on the server.
- New callables: cancelCommunityRequest and setCommunityAvailability.

Syntax checks completed; no automated workflow tests were run, as requested.

# Find Food and community requests

Implemented November 2026. This flow extends the organization dashboard; it does not introduce a resident operational role or let residents claim donations.

## Resident journey

1. The landing page **Find Food** link opens `/find-food.html`.
2. Browse active Lahug organizations and filter by the 48 configured sitios. Explicit `serviceSitios` restrict coverage; an empty list means coverage must be confirmed with the coordinator.
3. Choose an organization. Verify a Philippine mobile number using Firebase Phone Auth, or use the current phone-authenticated session. No donor/volunteer signup is required.
4. Submit a name, sitio, number of people (1–50), optional note, and consent to share these details with the chosen organization.
5. Return using the same verified number and refresh **Mga request ko** to see the coordinator's response.

This first version is an organization assistance directory, not a public live-food inventory. Food quantities, collection times, and availability are confirmed by the organization. Requests do not reserve donations, expose donor contact details, or change delivery/QR/PIN states. There is no automatic status SMS, allocation engine, map, or resident delivery tracking.

## Organization workflow

Active organization coordinators see **Community Requests** in their dashboard. They can accept or decline a pending request. Accepted requests can be marked fulfilled or declined if assistance becomes unavailable. Residents can cancel pending or accepted requests with a reason. Every change requires a written response (5–500 characters), displayed to the resident. A fulfilled request records the coordinator's confirmation; it is not a donor-to-organization handover receipt.

## Data and access

- `communityRequests`: requester UID, selected organization ID/name, demo flag, name, verified phone, sitio, people, optional note, consent timestamp, status, response, reviewer UID, timestamps.
- `communityRequestLimits`: per-UID submission cooldown and daily count. Maximum five submissions per UTC day, at least one minute apart.
- Writes go through callable functions; direct Firestore client reads/writes are denied. Requesters can retrieve only their own records. Organization coordinators must have a matching live active profile, claim, and active organization membership.
- Public organization responses include only name, barangay, sitio coverage, and demo indicator. Private addresses, phone numbers, and coordinator identities are not exposed by the directory.
- Creation validates current organization activation and coverage. A stable request key prevents retry duplicates. Reviews use transactions and reject stale status transitions. Review actions create audit entries without copying resident notes or phone numbers.
- Callable endpoints: `listCommunityOrganizations`, `submitCommunityRequest`, `listMyCommunityRequests`, `listOrganizationCommunityRequests`, `reviewCommunityRequest`.
- Residents authenticate through Phone Auth but receive no privileged role or automatic `users` profile. Existing role registration remains separate.

## Thesis demonstration

Start `npm run emulators`, then `npm run seed:demo-orgs`. Seed again after emulator data is cleared; rerunning preserves existing demo review state. See [demo identities](../scripts/DEMO-ORGANIZATIONS.md).

Use two browser sessions for a presentation: a resident session at `/find-food.html` and an organization session at `/org-admin/login.html`. Send a resident request, refresh the matching organization's inbox, respond, then refresh the resident's request list. OTP codes are printed in the Auth emulator terminal. No real SMS is sent locally.

All seeded organizations are fictional, labeled DEMO, and use simulated approved state. The seed refuses non-local emulator hosts. Public directory and coordinator commands exclude demo organizations outside emulator mode.

## Verification and limitations

Automated tests were not run, per the project owner's request. Manually check phone verification, coverage filtering, duplicate retries, each review transition, and isolation between organizations before the defense. Before a live rollout, define retention/deletion handling for resident contact details and operational ownership of pending requests. Current cooldowns limit one authenticated account; they are not a comprehensive abuse-control system.
