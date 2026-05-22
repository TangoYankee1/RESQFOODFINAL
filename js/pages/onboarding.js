import { getCurrentUser, getProfile, updateProfile } from '../auth.js';
import { navigate } from '../router.js';

export function renderOnboarding(root) {
  const profile = getProfile();
  const user = getCurrentUser();

  if (!user || !profile) {
    navigate('/get-involved');
    return;
  }

  root.innerHTML = `
    <section class="container dashboard">
      <div class="form-card">
        <h1>Complete your profile</h1>
        <p>Role: <strong>${profile.role}</strong></p>
        <div id="onboard-error" class="alert alert--error hidden"></div>
        <form id="onboard-form">
          <div class="form-group">
            <label for="phone">Phone</label>
            <input id="phone" name="phone" type="tel" />
          </div>
          <div class="form-group">
            <label for="address">Address</label>
            <input id="address" name="address" type="text" />
          </div>
          ${roleFields(profile.role)}
          <button type="submit" class="btn btn--primary btn--block">Save & continue</button>
        </form>
      </div>
    </section>
  `;

  root.querySelector('#onboard-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = root.querySelector('#onboard-error');
    errEl.classList.add('hidden');

    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    try {
      await updateProfile(user.uid, data);
      navigate('/dashboard');
    } catch (err) {
      errEl.textContent = err.message || 'Could not save profile.';
      errEl.classList.remove('hidden');
    }
  });
}

function roleFields(role) {
  switch (role) {
    case 'Donor':
      return `
        <div class="form-group">
          <label for="food_types">Typical food types</label>
          <input id="food_types" name="food_types" placeholder="produce, baked goods, canned" />
        </div>`;
    case 'Volunteer':
      return `
        <div class="form-group">
          <label><input type="checkbox" name="vehicle_access" value="true" /> I have vehicle access</label>
        </div>`;
    case 'Beneficiary':
      return `
        <div class="form-group">
          <label for="organization_name">Organization name</label>
          <input id="organization_name" name="organization_name" required />
        </div>
        <div class="form-group">
          <label for="people_served">People served (estimate)</label>
          <input id="people_served" name="people_served" type="number" min="1" />
        </div>`;
    default:
      return `
        <div class="form-group">
          <label for="organization_name">Organization / office</label>
          <input id="organization_name" name="organization_name" />
        </div>`;
  }
}
