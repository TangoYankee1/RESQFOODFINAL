// public/js/core/router.js
// URL routing with auth guards + intent preservation. Every protected page
// boots via requirePage(). Direct-URL access without session redirects to
// login with ?next= preserved. No exceptions, no skip paths.
import { requireRole, consumeIntent } from './auth.js';
import { installGlobalHandlers, handleError } from './errors.js';
import { initLocale } from './i18n.js';
import { initOfflineBanner } from './ui.js';

installGlobalHandlers();
initLocale();

export const ROUTES = {
  '/donor/': { roles: ['donor'] },
  '/volunteer/': { roles: ['volunteer'] },
  '/org-admin/': { roles: ['orgAdmin'] },
  '/admin/': { roles: ['lguAdmin', 'systemAdmin'] },
};

function matchRoute(pathname) {
  const path = String(pathname || location.pathname);
  const keys = Object.keys(ROUTES).sort((a, b) => b.length - a.length);
  for (const prefix of keys) if (path.includes(prefix)) return { prefix, ...ROUTES[prefix] };
  return null;
}

export async function requirePage(opts = {}) {
  initOfflineBanner();
  const route = matchRoute(opts.path || location.pathname);
  const roles = opts.roles || (route && route.roles);
  if (!roles) return { user: null, role: null, public: true };
  try {
    const session = await requireRole(roles, { next: location.pathname + location.search });
    try {
      const stored = sessionStorage.getItem('resqfood_post_login_redirect');
      if (stored && stored !== location.pathname + location.search) {
        const next = consumeIntent(route_home_fallback(roles));
        if (next && next !== location.pathname + location.search) { location.replace(next); const e = new Error('intent-redirect'); e.code = 'guard-redirect'; throw e; }
      }
    } catch (e) { if (e && e.code === 'guard-redirect') throw e; }
    document.documentElement.dataset.authReady = '1';
    return session;
  } catch (err) {
    if (err && err.code === 'guard-redirect') throw err;
    handleError(err, { scope: 'router.requirePage' });
    throw err;
  }
}

function route_home_fallback(roles) {
  if (roles.includes('donor')) return '/donor/index.html';
  if (roles.includes('volunteer')) return '/volunteer/index.html';
  if (roles.includes('orgAdmin')) return '/org-admin/index.html';
  return '/admin/index.html';
}

export function roleHomeFor(role) {
  switch (role) {
    case 'donor': return '/donor/index.html';
    case 'volunteer': return '/volunteer/index.html';
    case 'orgAdmin': return '/org-admin/index.html';
    case 'lguAdmin':
    case 'systemAdmin': return '/admin/index.html';
    default: return '/register/index.html';
  }
}

