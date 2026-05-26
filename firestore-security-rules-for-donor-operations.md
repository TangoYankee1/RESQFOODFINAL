rules_version = '2';
service cloud.firestore {
match /databases/{database}/documents {

    // Users: Donors can create their own profile
    match /users/{userId} {
      allow create: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.role == 'donor'
                    && request.resource.data.keys().hasAll([
                         'fullName', 'contactNumber', 'role',
                         'liabilityWaiverSigned', 'privacyConsentSigned'
                       ]);
      allow read: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null
                    && request.auth.uid == userId
                    && request.resource.data.role == resource.data.role; // No role escalation
    }

    // Donations: Donor lifecycle rules
    match /donations/{donationId} {
      // Create: Must be donor's own doc, status pending, safety declared
      allow create: if request.auth != null
                    && request.resource.data.donorId == request.auth.uid
                    && request.resource.data.status == 'pending'
                    && request.resource.data.safetyDeclared == true
                    && request.resource.data.postingConfirmed == true;

      // Read: Donor can read their own donations
      allow read: if request.auth != null
                   && resource.data.donorId == request.auth.uid;

      // Update: Donor can only cancel their own pending donations
      allow update: if request.auth != null
                    && resource.data.donorId == request.auth.uid
                    && resource.data.status == 'pending'
                    && request.resource.data.status == 'cancelled';
    }

}
}
