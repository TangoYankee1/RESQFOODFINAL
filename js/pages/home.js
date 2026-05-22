export function renderHome(root) {
  root.innerHTML = `
    <section class="hero container">
      <div class="hero__grid">
        <div>
          <span class="hero__badge">Community driven</span>
          <h1>Rescue food.<br><span>Feed communities.</span></h1>
          <p>Reduce food waste by connecting donors with volunteers and beneficiaries. No app install required — works in your browser.</p>
          <div class="hero__actions">
            <a href="#/get-involved" class="btn btn--primary" data-nav>Donate food</a>
            <a href="#/get-involved" class="btn btn--outline" data-nav>Find food</a>
          </div>
        </div>
        <div class="hero__visual">
          <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80" alt="Fresh produce at a community kitchen" width="800" height="500" loading="lazy" />
        </div>
      </div>
    </section>
    <section class="section section--muted">
      <div class="container">
        <h2>Empowering rescue operations</h2>
        <p style="color: var(--color-on-surface-variant); max-width: 36rem;">Digital infrastructure to turn surplus food into social impact.</p>
        <div class="features" style="margin-top: 2rem;">
          <article class="feature-card">
            <div class="feature-card__icon" aria-hidden="true">⏱</div>
            <h3>Real-time listings</h3>
            <p>Broadcast surplus food to local hubs and shelters instantly.</p>
          </article>
          <article class="feature-card">
            <div class="feature-card__icon" aria-hidden="true">📱</div>
            <h3>QR handoff</h3>
            <p>Generate and scan QR codes for secure donation pickup verification.</p>
          </article>
          <article class="feature-card">
            <div class="feature-card__icon" aria-hidden="true">🔒</div>
            <h3>Firebase secured</h3>
            <p>Email authentication and Firestore rules protect your community data.</p>
          </article>
        </div>
      </div>
    </section>
  `;
}
