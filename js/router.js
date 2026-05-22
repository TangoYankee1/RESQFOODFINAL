import {
  getCurrentUser,
  getProfile,
  getRoleViewId,
  login,
  logout,
  mapAuthError,
  normalizeRole,
  register,
  updateProfile,
} from "./auth.js";
import { onDonorViewShown } from "./donor.js";
import { onLguAdminViewShown } from "./lgu-admin.js";
import { requestPushPermission, toast } from "./notifications.js";
import { onOrgAdminViewHidden, onOrgAdminViewShown } from "./org-admin.js";
import { onVolunteerViewHidden, onVolunteerViewShown } from "./volunteer.js";

const VIEWS = [
  "view-landing",
  "view-auth",
  "view-onboarding",
  "view-donor",
  "view-volunteer",
  "view-org-admin",
  "view-lgu-admin",
];

const ROLES = [
  { id: "Donor", title: "Donor", sub: "I have surplus food to give" },
  { id: "Volunteer", title: "Volunteer", sub: "I can help pick up & deliver" },
  {
    id: "Beneficiary",
    title: "Beneficiary",
    sub: "My organization receives food",
  },
  {
    id: "LGU Personnel",
    title: "LGU Personnel",
    sub: "I monitor analytics & reports",
  },
];

let currentView = null;
let authMode = "register";
let selectedRole = "Donor";

export function showView(viewId) {
  if (currentView === "view-volunteer") onVolunteerViewHidden();
  if (currentView === "view-org-admin") onOrgAdminViewHidden();

  VIEWS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", id !== viewId);
  });

  currentView = viewId;
  document.body.dataset.view = viewId;

  if (viewId === "view-donor") onDonorViewShown();
  if (viewId === "view-volunteer") onVolunteerViewShown();
  if (viewId === "view-org-admin") onOrgAdminViewShown();
  if (viewId === "view-lgu-admin") onLguAdminViewShown();
}

function routeByAuth() {
  const user = getCurrentUser();
  const profile = getProfile();

  if (!user) {
    showView("view-landing");
    updateHeader(false);
    return;
  }

  if (!profile?.onboardingComplete) {
    showView("view-onboarding");
    updateHeader(true);
    return;
  }

  const roleView = getRoleViewId(profile.role);
  const viewMap = {
    donor: "view-donor",
    volunteer: "view-volunteer",
    "org-admin": "view-org-admin",
    "lgu-admin": "view-lgu-admin",
  };

  showView(viewMap[roleView] || "view-landing");
  updateHeader(true);
}

function updateHeader(signedIn) {
  const actions = document.getElementById("header-actions");
  const nav = document.getElementById("main-nav");
  if (!actions) return;

  if (signedIn) {
    const profile = getProfile();
    actions.innerHTML = `
      <a href="#/dashboard" class="header-role" data-nav>${profile?.name || ""} &middot; ${profile?.role || ""}</a>
      <button type="button" class="btn btn--ghost" id="btn-notifications">Alerts</button>
      <button type="button" class="btn btn--outline" id="btn-logout">Sign out</button>
    `;
    if (nav) nav.classList.remove("hidden");
    document
      .getElementById("btn-logout")
      ?.addEventListener("click", async () => {
        await logout();
        toast("Signed out.", "info");
        routeByAuth();
      });
    document
      .getElementById("btn-notifications")
      ?.addEventListener("click", () => {
        requestPushPermission();
      });
  } else {
    if (nav) nav.classList.remove("hidden");
    actions.innerHTML = `
      <button type="button" class="btn btn--ghost" id="btn-show-login">Sign in</button>
      <button type="button" class="btn btn--primary" id="btn-show-register">Get involved</button>
    `;
    document
      .getElementById("btn-show-login")
      ?.addEventListener("click", () => openAuth("login"));
    document
      .getElementById("btn-show-register")
      ?.addEventListener("click", () => openAuth("register"));
  }
}

function openAuth(mode) {
  authMode = mode;
  renderAuthForm();
  showView("view-auth");
}

function renderAuthForm() {
  const root = document.getElementById("view-auth");
  if (!root) return;

  root.innerHTML = `
    <section class="dashboard container auth-page">
      <div class="auth-panel">
        <div class="auth-intro">
          <span class="hero__badge">Join the rescue</span>
          <h1>${authMode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p class="auth-lead">Sign in or register with ResQFood to donate surplus food, accept missions, or manage community pickups.</p>
          <div class="auth-benefits">
            <div>
              <strong>Role-based access</strong>
              <span>Volunteer, donor, beneficiary, and LGU views tuned to your workflow.</span>
            </div>
            <div>
              <strong>Fast onboarding</strong>
              <span>Complete a quick profile and jump straight into the right dashboard.</span>
            </div>
            <div>
              <strong>Firebase security</strong>
              <span>Built with Firebase Auth and Firestore for safe, reliable login.</span>
            </div>
          </div>
        </div>
        <div class="form-card auth-form-card">
          <h1>${authMode === "login" ? "Sign in" : "Create your account"}</h1>
          <div id="auth-error" class="alert alert--error hidden"></div>
          <form id="auth-form">
            ${
              authMode === "register"
                ? `
              <p style="font-weight:700">I am a…</p>
              <div class="role-grid" id="role-grid">
                ${ROLES.map(
                  (r) => `
                  <button type="button" class="role-btn ${r.id === selectedRole ? "is-selected" : ""}" data-role="${r.id}">
                    <div>
                      <p class="role-btn__title">${r.title}</p>
                      <p class="role-btn__sub">${r.sub}</p>
                    </div>
                  </button>`,
                ).join("")}
              </div>
              <div class="form-group" style="margin-top:1rem">
                <label for="auth-name">Full name</label>
                <input id="auth-name" name="name" required />
              </div>
            `
                : ""
            }
            <div class="form-group">
              <label for="auth-email">Email</label>
              <input id="auth-email" name="email" type="email" required autocomplete="email" />
            </div>
            <div class="form-group">
              <label for="auth-password">Password</label>
              <input id="auth-password" name="password" type="password" minlength="8" required />
            </div>
            <button type="submit" class="btn btn--primary btn--block">${authMode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <p style="text-align:center;margin-top:1rem">
            <button type="button" class="btn btn--ghost" id="toggle-auth-mode">
              ${authMode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
            </button>
          </p>
          <p style="text-align:center"><button type="button" class="btn btn--ghost" id="auth-back">← Back</button></p>
        </div>
      </div>
    </section>
  `;

  root.querySelector("#toggle-auth-mode")?.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    renderAuthForm();
  });
  root
    .querySelector("#auth-back")
    ?.addEventListener("click", () => routeByAuth());
  root.querySelectorAll("[data-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedRole = btn.dataset.role;
      renderAuthForm();
    });
  });
  root
    .querySelector("#auth-form")
    ?.addEventListener("submit", handleAuthSubmit);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById("auth-error");
  errEl?.classList.add("hidden");

  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  try {
    if (authMode === "login") {
      await login(email, password);
      toast("Welcome back!", "success");
    } else {
      const name = document.getElementById("auth-name").value.trim();
      if (password.length < 8)
        throw new Error("Password must be at least 8 characters.");
      await register(name, email, password, selectedRole);
      toast("Account created.", "success");
    }
    routeByAuth();
  } catch (err) {
    errEl.textContent = mapAuthError(err);
    errEl.classList.remove("hidden");
  }
}

function bindOnboarding() {
  const form = document.getElementById("onboard-form");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    const errEl = document.getElementById("onboard-error");
    errEl?.classList.add("hidden");
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      await updateProfile(user.uid, data);
      toast("Profile saved.", "success");
      routeByAuth();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  });
}

function bindLanding() {
  document
    .getElementById("landing-cta-donate")
    ?.addEventListener("click", () => openAuth("register"));
  document
    .getElementById("landing-cta-find")
    ?.addEventListener("click", () => openAuth("register"));
}

function updateOnboardingFields() {
  const profile = getProfile();
  const fields = document.getElementById("onboard-role-fields");
  if (!fields || !profile) return;

  const role = normalizeRole(profile.role);
  if (role === "donor") {
    fields.innerHTML = `
      <div class="form-group"><label for="food_types">Typical food types</label>
      <input id="food_types" name="food_types" placeholder="produce, baked goods" /></div>`;
  } else if (role === "volunteer") {
    fields.innerHTML = `<div class="form-group"><label><input type="checkbox" name="vehicle_access" value="true" /> Vehicle access</label></div>`;
  } else if (role === "org-admin") {
    fields.innerHTML = `
      <div class="form-group"><label for="organization_name">Organization</label>
      <input id="organization_name" name="organization_name" required /></div>`;
  } else {
    fields.innerHTML = `
      <div class="form-group"><label for="organization_name">Office / organization</label>
      <input id="organization_name" name="organization_name" /></div>`;
  }
}

const routes = [];

function normalizePathname(pathname) {
  if (!pathname.startsWith("/")) pathname = "/" + pathname;
  pathname = pathname.replace(/\/+/g, "/");
  pathname = pathname.replace(/\/$/, "");
  return pathname || "/";
}

function splitPath(rawPath) {
  if (rawPath.startsWith("#")) rawPath = rawPath.slice(1);
  const [pathname = "/", search = ""] = rawPath.split("?");
  return {
    pathname: pathname || "/",
    search,
  };
}

function compileRoute(path) {
  const paramNames = [];
  const pattern = path
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return {
    regex: new RegExp(`^${pattern}$`),
    paramNames,
  };
}

export function registerRoute(path, handler, options = {}) {
  const { pathname } = splitPath(path);
  const normalized = normalizePathname(pathname);
  const compiled = compileRoute(normalized);
  routes.push({
    ...options,
    path: normalized,
    handler,
    regex: compiled.regex,
    paramNames: compiled.paramNames,
  });
}

function findRoute(pathname) {
  const normalized = normalizePathname(pathname);
  return routes.reduce((match, route) => {
    if (match) return match;
    const result = route.regex.exec(normalized);
    if (!result) return null;
    const params = {};
    route.paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(result[index + 1] || "");
    });
    return { route, params };
  }, null);
}

async function loadRoute(pathname) {
  const routeMatch = findRoute(pathname);
  if (!routeMatch) {
    const fallback = routes.find((route) => route.path === "/404");
    if (fallback) {
      await fallback.handler({}, pathname);
    }
    return;
  }

  if (
    routeMatch.route.requiresAuth &&
    typeof window.__resqRequireAuth === "function"
  ) {
    const allowed = await window.__resqRequireAuth(pathname);
    if (!allowed) return;
  }

  await routeMatch.route.handler(routeMatch.params, pathname);
}

export async function navigate(rawPath) {
  const { pathname, search } = splitPath(rawPath);
  const normalized = normalizePathname(pathname);
  const targetHash = `#${normalized}${search ? `?${search}` : ""}`;
  if (window.location.hash === targetHash) {
    await loadRoute(normalized);
    return;
  }
  window.location.hash = targetHash;
}

export function startRouter() {
  document.addEventListener("click", (event) => {
    // Normalize click target: if user clicked text node, use its parent element
    let el = event.target;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    const anchor = el?.closest ? el.closest("a[data-nav]") : null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    event.preventDefault();
    navigate(href.slice(1));
  });

  window.addEventListener("hashchange", () => {
    const { pathname } = splitPath(window.location.hash);
    loadRoute(pathname);
  });

  const { pathname } = splitPath(window.location.hash || "#/");
  navigate(pathname);
}
