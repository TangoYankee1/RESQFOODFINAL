# Thesis demo organizations

All three organizations are fictional and labeled DEMO. Their active/approved state simulates verification for the presentation; it is not real-world verification. Seed data is restricted to local Auth and Firestore emulators.

Start the app with npm run emulators, then run npm run seed:demo-orgs in another terminal. Run the seed again after an emulator reset. Existing demo profiles and organization review states are preserved.

Use /org-admin/login.html with these local-only phone identities:

| Organization | Phone input (after +63) | Base sitio |
| --- | --- | --- |
| DEMO — Lahug Community Kitchen | 9170009201 | ACACIA |
| DEMO — Lahug Feeding Partners | 9170009202 | LOWER PEACE VALLEY |
| DEMO — Lahug Food Support | 9170009203 | SUDLON |

Click Magpadala ng Code and use the latest OTP from the Auth emulator terminal. Phone numbers and addresses are demonstration fixtures, not contact details to use outside the emulator.

These organizations appear in the existing active donation destination list. Service sitio coverage is used by /find-food.html. Residents submit phone-verified assistance requests; matching coordinators respond in Community Requests on their dashboard. Use separate browser sessions for the two identities. See ../docs/COMMUNITY-REQUESTS.md.
