export function renderImpact(root) {
  root.innerHTML = `
    <section class="container dashboard">
      <h1>Our impact</h1>
      <p>Track rescued meals, diverted waste, and community reach. Impact metrics sync from Firestore as your network grows.</p>
      <div class="stats" style="margin-top: 2rem;">
        <div class="stat-card"><strong>—</strong><span>Meals rescued</span></div>
        <div class="stat-card"><strong>—</strong><span>kg diverted</span></div>
        <div class="stat-card"><strong>—</strong><span>Active partners</span></div>
      </div>
    </section>
  `;
}

export function renderHowItWorks(root) {
  root.innerHTML = `
    <section class="container dashboard">
      <h1>How it works</h1>
      <ol style="line-height: 2; max-width: 40rem;">
        <li><strong>Sign up</strong> — Choose your role: Donor, Volunteer, Beneficiary, LGU, or Admin.</li>
        <li><strong>List or claim</strong> — Donors post surplus food; volunteers claim pickups.</li>
        <li><strong>Scan QR</strong> — Verify handoff at pickup using the built-in scanner.</li>
        <li><strong>Complete</strong> — Mark donations complete; data stays in Firestore for reporting.</li>
      </ol>
      <p><a href="#/get-involved" class="btn btn--primary" data-nav>Get started</a></p>
    </section>
  `;
}

export function renderAbout(root) {
  root.innerHTML = `
    <section class="container dashboard">
      <h1>About ResQFood</h1>
      <p>ResQFood connects surplus food with people who need it. Built with vanilla web technologies and Firebase — no build step, deploy with <code>firebase deploy</code>.</p>
    </section>
  `;
}

export function renderContact(root) {
  root.innerHTML = `
    <section class="container dashboard">
      <h1>Contact</h1>
      <p>Reach your LGU coordinator or platform admin for support.</p>
      <form class="form-card" onsubmit="event.preventDefault(); alert('Connect a contact form to Firestore or email extension as needed.');">
        <div class="form-group">
          <label for="contact-name">Name</label>
          <input id="contact-name" type="text" required />
        </div>
        <div class="form-group">
          <label for="contact-email">Email</label>
          <input id="contact-email" type="email" required />
        </div>
        <div class="form-group">
          <label for="contact-msg">Message</label>
          <textarea id="contact-msg" rows="4" required></textarea>
        </div>
        <button type="submit" class="btn btn--primary btn--block">Send message</button>
      </form>
    </section>
  `;
}
