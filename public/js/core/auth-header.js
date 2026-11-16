// One header component for role selection, registration, and sign-in.
// Independent of Firebase so account navigation is always available.
(() => {
  class ResqfoodAuthHeader extends HTMLElement {
    connectedCallback() {
      const inner = document.createElement('div');
      inner.className = 'auth-header-inner';
      inner.innerHTML = '<a class="resqfood-brand" href="/" aria-label="ResQFood home"><img class="resqfood-logo" src="/assets/resqfood-logo.png" alt="RESQFOOD" width="266" height="84" decoding="async"></a><nav aria-label="Account"></nav>';
      const action = document.createElement('a');
      action.setAttribute('href', this.getAttribute('action-href') || '/register/index.html');
      action.textContent = this.getAttribute('action-label') || 'Magrehistro';
      inner.querySelector('nav').append(action);
      this.replaceChildren(inner);
    }
  }
  if (!customElements.get('resqfood-auth-header')) customElements.define('resqfood-auth-header', ResqfoodAuthHeader);
})();
