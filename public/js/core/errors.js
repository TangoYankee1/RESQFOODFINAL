// public/js/core/errors.js
// Centralized error handling: classify once, show a Tagalog message with a
// retry affordance. No silent failures — every caught error routes here.

import { t } from './i18n.js';

/** Canonical error codes used across client modules. */
export const ErrorCodes = {
  NETWORK: 'network',
  PERMISSION: 'permission',
  NOT_FOUND: 'notFound',
  RATE_LIMITED: 'rateLimited',
  AUTH: 'auth',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown',
};

const I18N_BY_CODE = {
  [ErrorCodes.NETWORK]: 'error.network',
  [ErrorCodes.PERMISSION]: 'error.permission',
  [ErrorCodes.NOT_FOUND]: 'error.notFound',
  [ErrorCodes.RATE_LIMITED]: 'error.rateLimited',
  [ErrorCodes.AUTH]: 'auth.loginRequired',
  [ErrorCodes.VALIDATION]: 'common.required',
  [ErrorCodes.UNKNOWN]: 'error.unknown',
};

/** Map any thrown value (Error, FirebaseError, plain string) → AppError. */
export function classify(error) {
  if (error instanceof AppError) return error;
  const code = error && error.code ? String(error.code) : '';
  let mapped = ErrorCodes.UNKNOWN;

  if (/unavailable|network|offline|ECONN/i.test(code + (error && error.message)))
    mapped = ErrorCodes.NETWORK;
  else if (/permission-denied|unauthenticated|forbidden/i.test(code))
    mapped = ErrorCodes.PERMISSION;
  else if (/not-found/i.test(code)) mapped = ErrorCodes.NOT_FOUND;
  else if (/resource-exhausted|too-many-requests|quota/i.test(code))
    mapped = ErrorCodes.RATE_LIMITED;
  else if (/invalid-argument|failed-precondition/i.test(code))
    mapped = ErrorCodes.VALIDATION;

  return new AppError(mapped, (error && error.message) || String(error), error);
}

export class AppError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }

  /** Tagalog user-facing message. */
  get userMessage() {
    return t(I18N_BY_CODE[this.code] || 'error.unknown');
  }
}

/**
 * Handle an error for a UI surface: logs it (console + analytics sink) and
 * returns { message, code, retryable } so callers can render state.
 * `retryable` tells the UI whether to show a retry button.
 */
export function handleError(error, context = {}) {
  const appErr = classify(error);
  // Keep the raw error visible for debugging, but never rely on it alone.
  console.error(`[resqfood] ${context.scope || 'app'}:`, appErr.message, appErr.cause || '');
  if (typeof window !== 'undefined' && window.__RESQFOOD_ANALYTICS__) {
    window.__RESQFOOD_ANALYTICS__.track('error', {
      scope: context.scope || 'app',
      code: appErr.code,
    });
  }
  return {
    code: appErr.code,
    message: appErr.userMessage,
    retryable: ![ErrorCodes.PERMISSION].includes(appErr.code),
    raw: appErr,
  };
}

/** Wrap an async function so rejections always surface via handleError. */
export function withErrorHandling(fn, scope) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const handled = handleError(error, { scope });
      return { ok: false, error: handled };
    }
  };
}

/**
 * Attach loading/success/error/retry state to an async action and bind it to
 * DOM elements. This is the standard pattern every async UI action must use:
 *   await runWithState({ btn, loadingEl, errorEl }, async () => { ... });
 */
export async function runWithState(els, action, scope = 'ui') {
  const { btn, loadingEl, errorEl } = els;
  const originalBtnText = btn ? btn.textContent : null;
  try {
    if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
    if (loadingEl) loadingEl.hidden = false;
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    const result = await action();
    return { ok: true, result };
  } catch (error) {
    const handled = handleError(error, { scope });
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = handled.message;
      errorEl.setAttribute('role', 'alert');
      if (handled.retryable && !errorEl.dataset.retryBound) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-ghost btn-retry';
        retry.textContent = t('common.retry');
        retry.addEventListener('click', () => runWithState(els, action, scope));
        errorEl.dataset.retryBound = '1';
        errorEl.append(' ', retry);
      }
    }
    return { ok: false, error: handled };
  } finally {
    if (btn) { btn.disabled = false; delete btn.dataset.busy; if (originalBtnText) btn.textContent = originalBtnText; }
    if (loadingEl) loadingEl.hidden = true;
  }
}

/** Global guards: nothing may fail silently. */
export function installGlobalHandlers() {
  if (typeof window === 'undefined' || window.__RESQFOOD_ERRORS_INSTALLED__) return;
  window.__RESQFOOD_ERRORS_INSTALLED__ = true;
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, { scope: 'unhandledrejection' });
  });
  window.addEventListener('error', (event) => {
    handleError(event.error || event.message, { scope: 'window.error' });
  });
}
