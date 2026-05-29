/**
 * Demo auth – localStorage (Supabase Auth neskôr)
 */
(function (root) {
  const USERS_KEY = "chodza-users-v1";
  const SESSION_KEY = "chodza-session-v1";
  let memoryUsers = null;
  let memorySession = null;

  function getStorage() {
    try {
      const k = "__chodza_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return localStorage;
    } catch (_) {
      try {
        sessionStorage.setItem("__chodza_test__", "1");
        sessionStorage.removeItem("__chodza_test__");
        return sessionStorage;
      } catch (_) {
        return null;
      }
    }
  }

  const storage = getStorage();

  function readUsers() {
    if (memoryUsers) return { ...memoryUsers };
    if (!storage) return {};
    try {
      const raw = storage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeUsers(map) {
    if (storage) {
      try {
        storage.setItem(USERS_KEY, JSON.stringify(map));
        memoryUsers = null;
        return true;
      } catch (_) {}
    }
    memoryUsers = { ...map };
    return false;
  }

  function normalizeEmail(email) {
    return String(email || "")
      .trim()
      .toLowerCase();
  }

  function normalizeUsername(username) {
    return String(username || "")
      .trim()
      .toLowerCase();
  }

  /** Odstráni medzery, zmení na veľké písmená – SK00 0000 … → SK000000… */
  function normalizeIban(raw) {
    return String(raw || "")
      .replace(/\s/g, "")
      .toUpperCase();
  }

  function formatIbanDisplay(iban) {
    const n = normalizeIban(iban);
    if (!n) return "";
    return n.replace(/(.{4})/g, "$1 ").trim();
  }

  function getSession() {
    if (memorySession) return memorySession;
    if (!storage) return null;
    try {
      const raw = storage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function setSession(email) {
    const payload = { email: normalizeEmail(email), at: new Date().toISOString() };
    if (storage) {
      try {
        storage.setItem(SESSION_KEY, JSON.stringify(payload));
        memorySession = null;
        return;
      } catch (_) {}
    }
    memorySession = payload;
  }

  function clearSession() {
    if (storage) {
      try {
        storage.removeItem(SESSION_KEY);
      } catch (_) {}
    }
    memorySession = null;
  }

  function ensureSubscriptionPlan(user) {
    if (!user) return user;
    if (!user.subscriptionPlan) {
      user.subscriptionPlan =
        typeof ChodzaPlans !== "undefined"
          ? ChodzaPlans.normalizePlan(user.premium ? "plus" : "free")
          : user.premium
            ? "plus"
            : "free";
    }
    user.premium = user.subscriptionPlan !== "free";
    return user;
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session?.email) return null;
    const users = readUsers();
    const user = users[session.email];
    return user ? ensureSubscriptionPlan(user) : null;
  }

  function isLoggedIn() {
    return !!getCurrentUser();
  }

  function findByUsername(username) {
    const u = normalizeUsername(username);
    const users = readUsers();
    return Object.values(users).find((x) => normalizeUsername(x.username) === u) || null;
  }

  function register(payload) {
    const email = normalizeEmail(payload.email);
    const users = readUsers();
    if (users[email]) {
      return { ok: false, error: "email_taken" };
    }
    if (findByUsername(payload.username)) {
      return { ok: false, error: "username_taken" };
    }

    const plan =
      typeof ChodzaPlans !== "undefined"
        ? ChodzaPlans.normalizePlan(payload.subscriptionPlan || "plus")
        : payload.subscriptionPlan === "premium"
          ? "premium"
          : payload.subscriptionPlan === "plus"
            ? "plus"
            : "free";

    const user = {
      firstName: String(payload.firstName || "").trim(),
      lastName: String(payload.lastName || "").trim(),
      username: String(payload.username || "").trim(),
      email,
      password: String(payload.password || ""),
      city: String(payload.city || "").trim(),
      iban: normalizeIban(payload.iban),
      healthLinked: !!payload.healthLinked,
      gdprAccepted: !!payload.gdprAccepted,
      registeredAt: new Date().toISOString(),
      subscriptionPlan: plan,
      premium: plan !== "free",
    };

    users[email] = user;
    writeUsers(users);
    setSession(email);
    notifyUsersChanged("register", user);
    return { ok: true, user };
  }

  function login(email, password) {
    const key = normalizeEmail(email);
    const users = readUsers();
    const user = users[key];
    if (!user || user.password !== String(password)) {
      return { ok: false, error: "invalid_credentials" };
    }
    setSession(key);
    return { ok: true, user };
  }

  function updateProfile(email, patch) {
    const key = normalizeEmail(email);
    const users = readUsers();
    const user = users[key];
    if (!user) return { ok: false };
    if (patch.username && normalizeUsername(patch.username) !== normalizeUsername(user.username)) {
      const taken = findByUsername(patch.username);
      if (taken && normalizeEmail(taken.email) !== key) {
        return { ok: false, error: "username_taken" };
      }
    }
    Object.assign(user, patch);
    if (patch.subscriptionPlan != null) {
      ensureSubscriptionPlan(user);
    }
    users[key] = user;
    writeUsers(users);
    notifyUsersChanged("update", user);
    return { ok: true, user };
  }

  function listRegisteredUsers() {
    return Object.values(readUsers()).map(ensureSubscriptionPlan);
  }

  function notifyUsersChanged(reason, user) {
    try {
      window.dispatchEvent(
        new CustomEvent("chodza-users-changed", { detail: { reason, email: user?.email } })
      );
    } catch (_) {}
  }

  function displayName(user) {
    if (!user) return "";
    const full = `${user.firstName} ${user.lastName}`.trim();
    return full || user.username || user.email;
  }

  function avatarLetter(user) {
    if (!user) return "?";
    const n = displayName(user);
    return (n[0] || user.username?.[0] || "?").toUpperCase();
  }

  root.ChodzaAuth = {
    USERS_KEY,
    SESSION_KEY,
    getSession,
    setSession,
    clearSession,
    getCurrentUser,
    isLoggedIn,
    findByUsername,
    findUniqueUsername: findByUsername,
    register,
    login,
    updateProfile,
    listRegisteredUsers,
    readUsers,
    displayName,
    avatarLetter,
    normalizeEmail,
    normalizeUsername,
    normalizeIban,
    formatIbanDisplay,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
