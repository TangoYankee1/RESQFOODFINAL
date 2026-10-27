import { bootGuardedPage } from '../core/guard-boot.js';
import { createInvite } from '../core/callables.js';
import { handleError } from '../core/errors.js';

bootGuardedPage({ roles: ['systemAdmin'] }, () => {
  const form = document.getElementById('invite-form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const result = document.getElementById('invite-result');
    button.disabled = true;
    result.textContent = '';
    try {
      const invite = await createInvite({ kind: 'lgu', expiresHours: Number(form.elements.hours.value),
        meta: { barangay: form.elements.barangay.value.trim(), email: form.elements.email.value.trim() } });
      const link = document.createElement('a');
      link.href = `${location.origin}/register/lgu-invite.html?token=${encodeURIComponent(invite.token)}`;
      link.textContent = link.href;
      result.replaceChildren(document.createTextNode('Copy this invitation link: '), link);
    } catch (error) { result.textContent = handleError(error, { scope: 'admin.invite' }).message; }
    finally { button.disabled = false; }
  });
});
