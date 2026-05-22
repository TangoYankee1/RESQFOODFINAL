The Four User Roles (Plus One System Role)

ResQFood has four human user roles and one system-only role. Each role has a distinct purpose, dashboard, and permission set.

1. FOOD DONOR
   Attribute Detail
   Who they are Restaurant owners, bakery managers, wet market vendors, catering businesses, or even households with surplus cooked/raw food
   Their problem They throw away edible food daily because there's no easy, organized way to donate it quickly
   What they need A way to post surplus food in under 60 seconds and receive confirmation it was picked up and delivered

What they can do in the app:

    Register with email/password and select role "Donor"

    Post a food donation with: food type, quantity (kg), description, pickup address, pickup window (date/time range), optional photo

    View a list of all their donations with live status badges

    View the QR code generated for each donation

    Cancel a donation (only if no volunteer has claimed it yet)

    Receive notifications when their donation is claimed, picked up, and delivered

What they CANNOT do:

    See other donors' donations

    See volunteer or admin dashboards

    Accept missions or scan QR codes

    View system-wide reports

Dashboard name in screenshots: Donor Dashboard (Dashboard 1) 2. VOLUNTEER / FOOD RESCUER
Attribute Detail
Who they are Community volunteers, students earning service hours, NGO field workers, concerned citizens
Their problem Currently coordinate via chaotic group chats — messages get buried, missions overlap, no proof of completed rescues
What they need A clear mission board, one-tap claim, guided pickup/delivery steps, and a verifiable service record

What they can do in the app:

    Register with email/password and select role "Volunteer"

    Browse the Mission Board (all unclaimed donations, sorted by pickup time)

    Tap a mission to see full details (food type, quantity, address, pickup window)

    Accept a mission (locks it to them, prevents double-claiming)

    Access an in-app camera QR scanner

    Scan the QR code at three stages:

        Scan at Pickup → status becomes "Picked Up"

        Scan En-Route → status becomes "En-Route" (notifies org admin)

        Scan at Delivery → status becomes "Delivered"

    View their active missions and mission history

    See their personal stats (total missions completed, total kg rescued)

What they CANNOT do:

    Post food donations

    See other volunteers' missions

    Access the admin dashboard

    Modify donation details

Dashboard name in screenshots: Volunteer/NGO Dashboard (Dashboard 3) 3. ORGANIZATION ADMIN (BENEFICIARY REPRESENTATIVE)
Attribute Detail
Who they are Coordinators of community feeding programs, shelter managers, food bank operators, church feeding ministry leads
Their problem Donations arrive unannounced or not at all; no way to plan distribution schedules or track what was received
What they need Advance notice of incoming deliveries, ability to verify receipt, and a record of all food received for their own reporting

What they can do in the app:

    Register with email/password and select role "Organization Admin"

    View incoming deliveries (donations with status "En-Route" or "Delivered" assigned to their organization)

    Receive notifications when a delivery is on the way (when volunteer scans "En-Route")

    Perform a final "Verify Delivery" scan — this is the official confirmation that food was received, changing status to "Verified"

    View history of all donations received by their organization

What they CANNOT do:

    Post food donations

    Accept missions or scan pickup/delivery QR codes (only the verify scan)

    View donor or volunteer personal data

    Access the LGU admin dashboard

Dashboard name in screenshots: Receiver Dashboard (Dashboard 4)

Important distinction: The Organization Admin is NOT the same as the System Admin. They only see donations destined for their own organization. They are a beneficiary role, not a management role. 4. SYSTEM ADMIN (LGU / BARANGAY OFFICIAL)
Attribute Detail
Who they are Barangay captain, LGU social welfare officer, city nutrition program coordinator
Their problem No centralized data on food waste diversion or feeding program impact; decisions made on anecdotal evidence; can't report metrics to council or national agencies
What they need Real-time dashboard with KPIs, ability to drill down into any donation, export reports for meetings and budgeting

What they can do in the app:

    View the LGU Admin Dashboard (summary cards + detailed tables + charts)

    See aggregate metrics:

        Total food rescued (kg) for any date range

        Total missions completed

        Active volunteer count

        Total beneficiaries served

    Filter all data by date range

    View a table of all donations with status, donor, volunteer

    Click any donation to see its full lifecycle (every status change with timestamps)

    View charts (food rescued by week, food by type)

    Manage user accounts (view all users, change roles, deactivate accounts)

What they CANNOT do:

    Post food donations

    Accept missions or scan QR codes

    Modify donation details

    Delete donation records (data integrity)

Account creation: System Admin accounts are NOT self-registered. They are pre-seeded manually in the Firebase Console or created by another System Admin. This prevents anyone from signing up as an admin.

Real-World Workflow Example

    Maria (bakery owner) has 10 kg of unsold bread. She opens ResQFood on her phone, posts a donation with pickup address and a 2-hour window. The system generates a QR code. Status: Pending.

    Juan (college volunteer) opens the Mission Board, sees Maria's bread donation 0.5 km away. He taps "Accept Mission." Status: Scheduled. Maria gets notified.

    Juan arrives at the bakery. He opens the app, taps "Scan at Pickup," and scans the QR code Maria shows him. Status: Picked Up.

    Juan is halfway to the beneficiary. He taps "Scan En-Route." Status: En-Route. The feeding program coordinator gets notified that food is coming.

    Juan arrives at the feeding program center. He scans the QR code one final time at delivery. Status: Delivered.

    Ana (feeding program coordinator) verifies the delivery by doing the final verify scan. Status: Verified. The donation lifecycle is complete.

    Kapitan Reyes (barangay captain) opens the LGU dashboard later that week. He sees that 150 kg of food was rescued, 12 missions were completed, and 3 feeding programs were served. He exports the report for the monthly council meeting.

Verification
For each fix, verify by:

Register as each affected role and confirm access is correctly granted/denied
BUG 1: Registration page should not show "Admin" role option
BUG 2: Signed-in LGU Personnel: dashboard has no "Scan QR" button; navigating to #/scanner redirects to dashboard
BUG 3: Signed-in LGU Personnel: visiting a claimed donation detail shows no "Mark completed" button
BUG 4: Signed-in Beneficiary: dashboard shows completed/delivered donations, not open ones
BUG 5: Signed-in Volunteer with a claimed mission: scan UI shows 3 buttons in sequence; each updates status correctly in Firestore
BUG 6: Signed-in Volunteer visiting a donation: QR canvas is not rendered; message shown instead
BUG 7: Signed-in LGU Personnel: dashboard renders analytics content from lgu-admin.js, not placeholder text
