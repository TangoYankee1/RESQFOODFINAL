import { login, register } from '../auth.js';
import { navigate } from '../router.js';

const ROLES = [
  { id: 'Donor', title: 'Donor', sub: 'I have surplus food to give' },
  { id: 'Volunteer', title: 'Volunteer', sub: 'I can help pick up & deliver' },
  { id: 'Beneficiary', title: 'Beneficiary', sub: 'My organization receives food' },
  { id: 'LGU Personnel', title: 'LGU Personnel', sub: 'I monitor analytics & reports' },
];

export function renderGetInvolved(root) {
  let isLogin = false;
  let selectedRole = 'Donor';

  function draw() {
    root.innerHTML = `
      <section class="container dashboard">
        <div class="form-card">
          <h1>${isLogin ? 'Sign in' : 'Create your account'}</h1>
          <p>${isLogin ? 'Welcome back to ResQFood.' : 'Choose your role to get started.'}</p>
          <div id="auth-error" class="alert alert--error hidden" role="alert"></div>
          <form id="auth-form">
            ${!isLogin ? `
              <p style="font-weight:700;margin-bottom:0.75rem;">I am a…</p>
              <div class="role-grid" id="role-grid">
                ${ROLES.map(
                  (r) => `
                  <button type="button" class="role-btn ${r.id === selectedRole ? 'is-selected' : ''}" data-role="${r.id}">
                    <div>
                      <p class="role-btn__title">${r.title}</p>
                      <p class="role-btn__sub">${r.sub}</p>
                    </div>
                  </button>`
                ).join('')}
              </div>
              <div class="form-group" style="margin-top:1.5rem;">
                <label for="name">Full name</label>
                <input id="name" name="name" type="text" required autocomplete="name" />
              </div>
            ` : ''}
            <div class="form-group">
              <label for="email">Email</label>
              <input id="email" name="email" type="email" required autocomplete="email" />
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" minlength="8" required autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
            </div>
            <button type="submit" class="btn btn--primary btn--block">${isLogin ? 'Sign in' : 'Create account'}</button>
          </form>
          <p style="margin-top:1.5rem;text-align:center;">
            <button type="button" class="btn btn--ghost" id="toggle-mode">
              ${isLogin ? 'Need an account? Register' : 'Already have an account? Sign in'}
            </button>
          </p>
        </div>
      </section>
    `;

    root.querySelector('#toggle-mode').addEventListener('click', () => {
      isLogin = !isLogin;
      draw();
    });

    root.querySelectorAll('[data-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRole = btn.dataset.role;
        draw();
      });
    });

    root.querySelector('#auth-form').addEventListener('submit', onSubmit);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errEl = root.querySelector('#auth-error');
    errEl.classList.add('hidden');

    const email = root.querySelector('#email').value.trim();
    const password = root.querySelector('#password').value;

    try {
      if (isLogin) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        const name = root.querySelector('#name').value.trim();
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        await register(name, email, password, selectedRole);
        navigate('/onboarding');
      }
    } catch (err) {
      errEl.textContent = mapAuthError(err);
      errEl.classList.remove('hidden');
    }
  }

  draw();
}

function mapAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists. Please sign in.',
    'auth/invalid-credential': 'Login failed. Check your email and password.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
  };
  return map[code] || err.message || 'Authentication failed. Please try again.';
}
