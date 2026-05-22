import {
  authReady,
  getCurrentUser,
  getProfile,
  logout,
  onAuthChange,
} from "./auth.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderDonationDetail, renderNewDonation } from "./pages/donations.js";
import { renderGetInvolved } from "./pages/get-involved.js";
import { renderHome } from "./pages/home.js";
import { renderOnboarding } from "./pages/onboarding.js";
import { renderScanner } from "./pages/scanner.js";
import {
  renderAbout,
  renderContact,
  renderHowItWorks,
  renderImpact,
} from "./pages/static-pages.js";
import { navigate, registerRoute, startRouter } from "./router.js";

const app = document.getElementById("app");
const headerActions = document.getElementById("header-actions");

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let cleanupScanner = null;

function mount(handler) {
  return async (params, pathname) => {
    if (cleanupScanner) {
      cleanupScanner();
      cleanupScanner = null;
    }
    await handler(app, params, pathname);
  };
}

window.__resqRequireAuth = async (pathname) => {
  await authReady;
  const user = getCurrentUser();
  const profile = getProfile();

  if (!user) {
    navigate(`/get-involved?redirect=${encodeURIComponent(pathname)}`);
    return false;
  }

  if (pathname !== "/onboarding" && profile && !profile.onboardingComplete) {
    navigate("/onboarding");
    return false;
  }

  return true;
};

function updateHeader(user, profile) {
  if (!headerActions) return;

  const nav = document.getElementById("main-nav");
  if (nav) nav.classList.remove("hidden");

  if (user && profile) {
    headerActions.innerHTML = `
      <a href="#/dashboard" class="header-role" data-nav>${escapeHtml(profile.name || '')} &middot; ${escapeHtml(profile.role || '')}</a>
      <button type="button" class="btn btn--outline" id="header-logout">Sign out</button>
    `;
    document
      .getElementById("header-logout")
      ?.addEventListener("click", async () => {
        await logout();
        navigate("/");
      });
  } else {
    headerActions.innerHTML =
      '<a href="#/get-involved" class="btn btn--primary" data-nav>Get involved</a>';
  }
}

registerRoute(
  "/",
  mount((root) => renderHome(root)),
);
registerRoute(
  "/impact",
  mount((root) => renderImpact(root)),
);
registerRoute(
  "/how-it-works",
  mount((root) => renderHowItWorks(root)),
);
registerRoute(
  "/about",
  mount((root) => renderAbout(root)),
);
registerRoute(
  "/contact",
  mount((root) => renderContact(root)),
);
registerRoute(
  "/get-involved",
  mount((root) => renderGetInvolved(root)),
);
registerRoute(
  "/onboarding",
  mount((root) => renderOnboarding(root)),
  { requiresAuth: true },
);
registerRoute(
  "/dashboard",
  mount((root) => renderDashboard(root)),
  { requiresAuth: true },
);
registerRoute(
  "/donations/new",
  mount((root) => renderNewDonation(root)),
  { requiresAuth: true },
);
registerRoute(
  "/donations/:id",
  mount((root, params) => renderDonationDetail(root, params)),
  {
    requiresAuth: true,
  },
);
registerRoute(
  "/scanner",
  mount(async (root) => {
    cleanupScanner = await renderScanner(root);
  }),
  { requiresAuth: true },
);
registerRoute(
  "/404",
  mount((root) => {
    root.innerHTML =
      '<section class="container dashboard"><h1>404</h1></section>';
  }),
);

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

if (
  "serviceWorker" in navigator &&
  !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
} else {
  console.debug("Skipping service worker registration in local development.");
}

onAuthChange(updateHeader);
startRouter();
