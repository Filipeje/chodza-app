/**
 * Admin panel – mock dáta, pripravené na Supabase.
 * Po pripojení: nastavte ChodzaAdminAPI.useMock = false a doplňte supabase klienta.
 */

const STORAGE_KEY = "chodza-admin-data-v1";
const WINNERS_KEY = "chodza-winners-by-month";
const SEEN_REGISTRATIONS_KEY = "chodza-admin-seen-registrations-v1";
const SUBSCRIPTION_PRICE_EUR =
  typeof ChodzaI18n !== "undefined" ? ChodzaI18n.SUBSCRIPTION_PRICE : 4.99;

function ta(key, params) {
  return typeof ChodzaI18n !== "undefined" ? ChodzaI18n.t(key, params, "admin") : key;
}

function applyAdminLanguage() {
  if (typeof ChodzaI18n === "undefined") return;
  ChodzaI18n.applyStatic(document);
  document.title = ta("admin.title");
  const price = ChodzaI18n.formatPrice();
  document.querySelectorAll("[data-i18n-dynamic='prize-hint']").forEach((el) => {
    el.textContent = ta("admin.prizeHint", { price });
  });
  if (allUsers.length) {
    ChodzaAdminAPI.getMonthlySettings(monthKey).then((s) => {
      renderRevenuePreview(allUsers, s);
      renderAdminSummary(s);
    });
  }
}

function userPlan(u) {
  if (typeof ChodzaPlans !== "undefined") {
    return ChodzaPlans.normalizePlan(
      u.subscriptionPlan || (u.status_predplatneho === "premium" ? "basic" : u.status_predplatneho)
    );
  }
  if (u.subscriptionPlan === "plus") return "plus";
  if (u.subscriptionPlan === "basic" || u.status_predplatneho === "premium") return "basic";
  return "free";
}

function countPayingSubscribers(users) {
  if (typeof ChodzaPlans !== "undefined") {
    return ChodzaPlans.countPayingUsers(users).total;
  }
  return users.filter((u) => u.status_predplatneho === "premium").length;
}

function getSelectedPrizeMode() {
  const el = document.querySelector('input[name="prizeMode"]:checked');
  return el?.value === "manual" ? "manual" : "percent";
}

function collectPrizeSettingsFromForm() {
  const mp = {
    drawFirst: Number(document.getElementById("mp-draw-first")?.value) || 0,
    drawSecond: Number(document.getElementById("mp-draw-second")?.value) || 0,
    drawThird: Number(document.getElementById("mp-draw-third")?.value) || 0,
    smallEach: Number(document.getElementById("mp-small-each")?.value) || 0,
    walkerFirst: Number(document.getElementById("mp-walker-first")?.value) || 0,
    walkerSecond: Number(document.getElementById("mp-walker-second")?.value) || 0,
    walkerThird: Number(document.getElementById("mp-walker-third")?.value) || 0,
  };
  return {
    prizeMode: getSelectedPrizeMode(),
    totalFundEur: Number(document.getElementById("total-fund-eur")?.value) || 0,
    manualPrizes: mp,
  };
}

function collectSettingsFromForm() {
  return {
    ...collectPrizeSettingsFromForm(),
    goalType: document.getElementById("goal-type")?.value || "walk_km",
    goalKmPerPoint: Number(document.getElementById("goal-km")?.value) || 10,
    maxPointsPerDay: Number(document.getElementById("max-points")?.value) || 3,
  };
}

function applyPrizeModeUi() {
  const mode = getSelectedPrizeMode();
  const percentPanel = document.getElementById("prize-mode-percent");
  const manualPanel = document.getElementById("prize-mode-manual");
  if (percentPanel) percentPanel.hidden = mode !== "percent";
  if (manualPanel) manualPanel.hidden = mode !== "manual";
}

function resolvePrizeConfig(settings, users) {
  if (typeof ChodzaDraw === "undefined") return null;
  return ChodzaDraw.resolvePrizeConfig(settings, users, userPlan);
}

function formatPayingPlansSummary(users, isEn) {
  if (typeof ChodzaPlans === "undefined") return null;
  const { basic, plus } = ChodzaPlans.countPayingUsers(users);
  if (!basic && !plus) return isEn ? "no paying subscribers" : "žiadni platiaci";
  const parts = [];
  if (basic) parts.push(isEn ? `${basic}×4.99 €` : `${basic}×4,99 €`);
  if (plus) parts.push(isEn ? `${plus}×7.99 €` : `${plus}×7,99 €`);
  return parts.join(isEn ? " + " : " + ");
}

function renderRevenuePreview(users, settings) {
  const el = document.getElementById("revenue-preview");
  if (!el) return;

  const p = resolvePrizeConfig(settings, users);
  if (!p) {
    el.innerHTML = "<p class=\"admin-hint\">Načítava sa…</p>";
    return;
  }

  const isEn = ChodzaI18n?.getLang() === "en";
  const smallTotal = (p.smallEach || 0) * (p.smallCount || 97);
  const modeLabel =
    p.prizeMode === "manual"
      ? isEn
        ? "Manual amounts"
        : "Manuálne sumy"
      : isEn
        ? `Auto split from ${formatEur(p.totalFundEur)}`
        : `Automatické z ${formatEur(p.totalFundEur)}`;

  el.innerHTML = `
    <p class="revenue-preview__lead"><strong>${modeLabel}</strong></p>
    <div class="revenue-preview__table">
      <div class="revenue-preview__row revenue-preview__row--owner"><span>${isEn ? "For you (45 %)" : "Pre vás (45 %)"}</span><strong>${formatEur(p.ownerAmount)}</strong></div>
      <div class="revenue-preview__row"><span>${isEn ? "Draw 1st (15 %)" : "Osudie 1. (15 %)"}</span><strong>${formatEur(p.drawFirst)}</strong></div>
      <div class="revenue-preview__row"><span>${isEn ? "Draw 2nd (10 %)" : "Osudie 2. (10 %)"}</span><strong>${formatEur(p.drawSecond)}</strong></div>
      <div class="revenue-preview__row"><span>${isEn ? "Draw 3rd (6 %)" : "Osudie 3. (6 %)"}</span><strong>${formatEur(p.drawThird)}</strong></div>
      <div class="revenue-preview__row"><span>${isEn ? "97× draw (20 % total)" : "97× osudie (20 % celkom)"}</span><strong>${formatEur(p.smallEach)} / os.</strong></div>
      <div class="revenue-preview__row revenue-preview__row--sub"><span>${isEn ? "97× total" : "Súčet 97×"}</span><span>${formatEur(smallTotal)}</span></div>
      <div class="revenue-preview__row"><span>${isEn ? "Walker 1 (50 % of 4 %)" : "Makač 1 (50 % z 4 %)"}</span><strong>${formatEur(p.walkerFirst)}</strong></div>
      <div class="revenue-preview__row"><span>${isEn ? "Walker 2 (30 %)" : "Makač 2 (30 %)"}</span><strong>${formatEur(p.walkerSecond)}</strong></div>
      <div class="revenue-preview__row"><span>${isEn ? "Walker 3 (20 %)" : "Makač 3 (20 %)"}</span><strong>${formatEur(p.walkerThird)}</strong></div>
    </div>`;
}

/** @type {boolean} */
const ChodzaAdminAPI = {
  useMock: true,

  async getMonthlySettings(monthKey) {
    if (this.useMock) return MockStore.getSettings(monthKey);
    // return supabase.from('monthly_settings').select().eq('mesiac', monthKey + '-01').single();
    throw new Error("Supabase nie je pripojené");
  },

  async saveMonthlySettings(monthKey, payload) {
    if (this.useMock) return MockStore.saveSettings(monthKey, payload);
    throw new Error("Supabase nie je pripojené");
  },

  async getUsers() {
    if (this.useMock) return MockStore.getUsers();
    throw new Error("Supabase nie je pripojené");
  },

  async saveUsers(users) {
    if (this.useMock) return MockStore.saveUsers(users);
    throw new Error("Supabase nie je pripojené");
  },

  async closeMonth(monthKey, settings) {
    if (this.useMock) return MockStore.closeMonth(monthKey, settings);
    throw new Error("Supabase nie je pripojené");
  },
};

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("sk-SK", { month: "long", year: "numeric" });
}

function formatEur(n) {
  return Number(n).toLocaleString("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function shortId(id) {
  return id.length > 12 ? id.slice(0, 8) + "…" : id;
}

function subscriptionLabel(userOrStatus) {
  if (userOrStatus && typeof userOrStatus === "object") {
    const plan = userPlan(userOrStatus);
    if (plan === "plus") return "Plus 7,99 €";
    if (plan === "basic") return "Chôdza 4,99 €";
    return "Free";
  }
  if (userOrStatus === "plus") return "Plus 7,99 €";
  if (userOrStatus === "premium" || userOrStatus === "basic") return "Chôdza 4,99 €";
  if (userOrStatus === "cancelled") return "Zrušené";
  return "Free";
}

function formatWinHistory(history) {
  if (!history || !history.length) return "Ešte nevyhral";
  const n = history.length;
  const last = history[history.length - 1];
  if (last.type === "main") {
    const ord =
      last.place === 1 ? "1." : last.place === 2 ? "2." : last.place === 3 ? "3." : `${last.place}.`;
    return `Už vyhral ${n}× (${ord} cena)`;
  }
  return `Už vyhral ${n}× (${last.place}. menšia cena)`;
}

function pointsFromKm(km, goalKm, maxPerDay, planId) {
  if (typeof ChodzaPlans !== "undefined") {
    return ChodzaPlans.computePointsForKm(km, goalKm, maxPerDay, planId || "free");
  }
  return Math.min(maxPerDay, Math.floor(km / goalKm));
}

function registrationUserId(email) {
  const norm = String(email || "")
    .trim()
    .toLowerCase();
  return `reg-${norm.replace(/[^a-z0-9]/g, "").slice(0, 20)}`;
}

function getSeenRegistrationEmails() {
  try {
    const raw = localStorage.getItem(SEEN_REGISTRATIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map((e) => String(e).toLowerCase()) : []);
  } catch (_) {
    return new Set();
  }
}

function markAllRegistrationsSeen(emails) {
  try {
    const seen = getSeenRegistrationEmails();
    for (const e of emails) seen.add(String(e).toLowerCase());
    localStorage.setItem(SEEN_REGISTRATIONS_KEY, JSON.stringify([...seen]));
  } catch (err) {
    console.error("markAllRegistrationsSeen", err);
  }
}

function isRegisteredUser(user) {
  return user?.source === "registration" || String(user?.id || "").startsWith("reg-");
}

function isUnseenRegistration(user) {
  if (!isRegisteredUser(user) || !user.email) return false;
  return !getSeenRegistrationEmails().has(user.email.toLowerCase());
}

function registrationSortTime(user) {
  const iso = user.registeredAt || user.created_at;
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/** Registrovaní navrch, najnovší prvý; demo účty pod nimi */
function sortUsersForAdmin(users) {
  return [...users].sort((a, b) => {
    const aReg = isRegisteredUser(a);
    const bReg = isRegisteredUser(b);
    if (aReg && !bReg) return -1;
    if (!aReg && bReg) return 1;
    if (aReg && bReg) return registrationSortTime(b) - registrationSortTime(a);
    return String(a.meno || "").localeCompare(String(b.meno || ""), "sk");
  });
}

function authUserToAdminRecord(auth) {
  const fullName = `${auth.firstName || ""} ${auth.lastName || ""}`.trim();
  const displayNick = auth.username || fullName || auth.email;
  return {
    id: registrationUserId(auth.email),
    meno: displayNick,
    username: auth.username || "",
    firstName: auth.firstName || "",
    lastName: auth.lastName || "",
    email: auth.email,
    city: auth.city || "",
    iban: auth.iban || "",
    healthLinked: !!auth.healthLinked,
    gdprAccepted: !!auth.gdprAccepted,
    subscriptionPlan: userPlan(auth),
    status_predplatneho: userPlan(auth) === "free" ? "free" : userPlan(auth) === "plus" ? "plus" : "premium",
    mesacneBody: 0,
    celkoveBody: 0,
    streak_of_loss: 0,
    winHistory: [],
    dailyWalks: [],
    created_at: auth.registeredAt || new Date().toISOString(),
    registeredAt: auth.registeredAt || new Date().toISOString(),
    source: "registration",
  };
}

function mergeRegisteredUsers(existingUsers) {
  if (typeof ChodzaAuth === "undefined") return { users: existingUsers, added: 0 };

  const registered = ChodzaAuth.listRegisteredUsers();
  if (!registered.length) return { users: existingUsers, added: 0 };

  const byEmail = new Map(
    existingUsers.map((u) => [String(u.email || "").toLowerCase(), { ...u }])
  );
  let added = 0;

  for (const auth of registered) {
    const key = String(auth.email || "").toLowerCase();
    if (!key) continue;

    const patch = {
      username: auth.username,
      firstName: auth.firstName,
      lastName: auth.lastName,
      city: auth.city || "",
      iban: auth.iban || "",
      healthLinked: !!auth.healthLinked,
      gdprAccepted: !!auth.gdprAccepted,
      registeredAt: auth.registeredAt,
      source: "registration",
      subscriptionPlan: userPlan(auth),
      status_predplatneho: userPlan(auth) === "free" ? "free" : userPlan(auth) === "plus" ? "plus" : "premium",
    };

    if (byEmail.has(key)) {
      const ex = byEmail.get(key);
      Object.assign(ex, patch);
      if (!ex.meno || ex.meno === ex.email) ex.meno = auth.username || ex.meno;
      byEmail.set(key, ex);
    } else {
      byEmail.set(key, authUserToAdminRecord(auth));
      added += 1;
    }
  }

  return { users: [...byEmail.values()], added };
}

function formatRegistrationDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sk-SK", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}

function updateRegistrationsAlert() {
  const alert = document.getElementById("registrations-alert");
  const text = document.getElementById("registrations-alert-text");
  if (!alert || !text) return;

  const registered = allUsers.filter(isRegisteredUser);
  const unseen = registered.filter(isUnseenRegistration);
  const totalReg = registered.length;

  if (!unseen.length) {
    alert.hidden = true;
    alert.setAttribute("hidden", "");
    return;
  }

  alert.hidden = false;
  alert.removeAttribute("hidden");
  const isEn = ChodzaI18n?.getLang() === "en";
  const names = unseen
    .slice(0, 5)
    .map((u) => u.username || u.meno)
    .join(", ");
  const more = unseen.length > 5 ? ` (+${unseen.length - 5})` : "";

  text.innerHTML = isEn
    ? `<strong>${unseen.length} new registration${unseen.length > 1 ? "s" : ""}</strong> – ${escapeHtml(names)}${more}. Total registered: ${totalReg}.`
    : `<strong>${unseen.length} nová registrácia${unseen.length > 1 ? "e" : ""}</strong> – ${escapeHtml(names)}${more}. Spolu registrovaných: ${totalReg}.`;
}

function renderRegistrationsSummary() {
  updateRegistrationsAlert();
}

function getAdminScrollContainer() {
  return document.querySelector(".admin-main");
}

function setActiveAdminNav(sectionId) {
  document.querySelectorAll(".admin-nav__link").forEach((link) => {
    const target = (link.getAttribute("href") || "").replace("#", "");
    link.classList.toggle("admin-nav__link--active", target === sectionId);
  });
}

function scrollToAdminSection(sectionId, updateHash = true) {
  const main = getAdminScrollContainer();
  const el = document.getElementById(sectionId);
  if (!main || !el) return;

  const topbar = document.querySelector(".admin-topbar");
  const offset = (topbar?.offsetHeight || 72) + 20;
  const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - offset;

  main.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  setActiveAdminNav(sectionId);

  if (updateHash) {
    history.replaceState(null, "", `#${sectionId}`);
  }
}

function bindAdminNavigation() {
  const go = (e, sectionId) => {
    e.preventDefault();
    scrollToAdminSection(sectionId);
  };

  document.querySelectorAll(".admin-nav__link[href^='#']").forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = (link.getAttribute("href") || "").slice(1);
      if (id) go(e, id);
    });
  });

  document.querySelectorAll(".admin-summary-card[data-admin-section]").forEach((card) => {
    card.addEventListener("click", (e) => {
      go(e, card.getAttribute("data-admin-section"));
    });
  });

  const initial = (location.hash || "#settings").replace("#", "");
  if (document.getElementById(initial)) {
    requestAnimationFrame(() => scrollToAdminSection(initial, false));
  } else {
    setActiveAdminNav("settings");
  }

  window.addEventListener("hashchange", () => {
    const id = (location.hash || "").replace("#", "");
    if (id && document.getElementById(id)) scrollToAdminSection(id, false);
  });
}

function renderAdminSummary(settings) {
  const s = settings || { goalKmPerPoint: 10, maxPointsPerDay: 3, prizePoolEur: 0, prizeMode: "percent" };
  const registered = allUsers.filter(isRegisteredUser);
  const unseen = registered.filter(isUnseenRegistration);
  const paying = countPayingSubscribers(allUsers);
  const withPoints = allUsers.filter(
    (u) => u.mesacneBody > 0 && (typeof ChodzaPlans === "undefined" || ChodzaPlans.isDrawEligible(userPlan(u)))
  ).length;
  const isEn = ChodzaI18n?.getLang() === "en";
  const price = typeof ChodzaI18n !== "undefined" ? ChodzaI18n.formatPrice() : formatEur(SUBSCRIPTION_PRICE_EUR);
  const isManual = s.prizeMode === "manual";
  const setVal = document.getElementById("summary-settings-value");
  const setMeta = document.getElementById("summary-settings-meta");
  if (setVal) {
    setVal.textContent = isEn
      ? `${s.goalKmPerPoint} km / point · max ${s.maxPointsPerDay}/day`
      : `${s.goalKmPerPoint} km / bod · max ${s.maxPointsPerDay}/deň`;
  }
  if (setMeta) {
    const total = Number(s.totalFundEur ?? s.prizePoolEur) || 0;
    setMeta.textContent = isManual
      ? isEn
        ? `Manual prizes (${formatEur(total)} total)`
        : `Manuálne sumy (spolu ${formatEur(total)})`
      : total > 0
        ? isEn
          ? `Auto split from ${formatEur(total)}`
          : `Automaticky z ${formatEur(total)}`
        : isEn
          ? `${paying} paying × ${price} (auto)`
          : `${paying} platiacich × ${price} (auto)`;
  }

  const usrVal = document.getElementById("summary-users-value");
  const usrMeta = document.getElementById("summary-users-meta");
  if (usrVal) {
    usrVal.textContent = isEn
      ? `${allUsers.length} accounts`
      : `${allUsers.length} účtov v systéme`;
  }
  if (usrMeta) {
    const parts = [];
    if (registered.length) {
      parts.push(isEn ? `${registered.length} registered` : `${registered.length} registrovaných`);
    }
    if (unseen.length) {
      parts.push(isEn ? `${unseen.length} new` : `${unseen.length} nových`);
    }
    if (paying) parts.push(isEn ? `${paying} premium` : `${paying} premium`);
    usrMeta.textContent = parts.join(" · ") || (isEn ? "No registrations yet" : "Zatiaľ žiadne registrácie");
  }

  const drawVal = document.getElementById("summary-draw-value");
  const drawMeta = document.getElementById("summary-draw-meta");
  if (drawVal) {
    drawVal.textContent = isEn
      ? `${withPoints} in monthly draw`
      : `${withPoints} v mesačnom žrebovaní`;
  }
  if (drawMeta) {
    drawMeta.textContent = isEn
      ? "3 main + 97 smaller prizes"
      : "3 hlavné + 97 menších cien";
  }
}

function seedMockUsers() {
  const month = currentMonthKey();
  const goal = 10;
  const ids = [
    ["u-001", "ChodecPro_SK", "chodec@demo.sk", "plus"],
    ["u-002", "Krokomerista", "krok@demo.sk", "premium"],
    ["u-003", "SynkoWalk", "synko@demo.sk", "plus"],
    ["u-004", "MaratonMan", "maraton@demo.sk", "free"],
    ["u-005", "VečernáPrechádzka", "vecer@demo.sk", "premium"],
    ["u-006", "FitJuraj", "juraj@demo.sk", "cancelled"],
    ["u-007", "12km_den", "dvanast@demo.sk", "premium"],
    ["u-008", "ZochodMa", "zochod@demo.sk", "free"],
    ["u-009", "BodMaster", "body@demo.sk", "premium"],
    ["u-010", "PešiakSK", "pesiak@demo.sk", "premium"],
    ["u-011", "RannáMíľa", "ranna@demo.sk", "free"],
    ["u-012", "GreenWalker", "green@demo.sk", "premium"],
    ["u-013", "Limit10km", "limit@demo.sk", "premium"],
    ["u-014", "Nováčik2026", "novacik@demo.sk", "free"],
    ["u-015", "StredaChodec", "streda@demo.sk", "premium"],
  ];

  const winSamples = [
    [],
    [{ month: "2026-03", place: 2, type: "main" }],
    [{ month: "2026-02", place: 1, type: "main" }, { month: "2025-11", place: 12, type: "small" }],
    [{ month: "2026-01", place: 45, type: "small" }],
    [],
    [{ month: "2025-08", place: 3, type: "main" }],
  ];

  return ids.map(([id, meno, email, status], i) => {
    const plan =
      status === "plus"
        ? "plus"
        : status === "premium"
          ? "basic"
          : status === "free"
            ? "free"
            : "free";
    const dailyWalks = buildDemoWalks(i, goal, plan);
    const mesacneBody = dailyWalks.reduce((s, d) => s + d.body, 0);
    const celkoveBody = 40 + mesacneBody + i * 7;
    const streakSamples = [0, 0, 2, 1, 0, 3, 0, 1, 0, 2, 0, 0, 1, 0, 0];
    return {
      id,
      meno,
      email,
      subscriptionPlan: plan,
      status_predplatneho: plan === "free" ? "free" : plan === "plus" ? "plus" : status === "cancelled" ? "cancelled" : "premium",
      mesacneBody,
      celkoveBody,
      streak_of_loss: streakSamples[i % streakSamples.length],
      winHistory: winSamples[i % winSamples.length],
      dailyWalks,
      created_at: "2026-01-15T10:00:00Z",
    };
  });
}

function buildDemoWalks(seed, goalKm, planId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const days = now.getDate();
  const walks = [];
  for (let d = 1; d <= days; d++) {
    const km = Math.max(0, ((seed * 3 + d * 7) % 35) + (d % 5) * 2.3);
    const body = pointsFromKm(km, goalKm, 3, planId || "basic");
    walks.push({
      datum: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      kilometre: Math.round(km * 10) / 10,
      body,
      splnene: body >= 1,
    });
  }
  return walks;
}

const MockStore = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { users: seedMockUsers(), closedMonths: [] };
  },

  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  getSettings(monthKey) {
    if (typeof ChodzaSettings !== "undefined") {
      return ChodzaSettings.read(monthKey);
    }
    return {
      monthKey,
      prizePoolEur: 0,
      goalType: "walk_km",
      goalKmPerPoint: 10,
      maxPointsPerDay: 3,
    };
  },

  saveSettings(monthKey, payload) {
    if (typeof ChodzaSettings !== "undefined") {
      return ChodzaSettings.write(monthKey, payload);
    }
    return { monthKey, ...payload };
  },

  getUsers() {
    const data = this.load();
    const { users, added } = mergeRegisteredUsers(data.users);
    if (added > 0 || users.length !== data.users.length) {
      data.users = users;
      this.save(data);
    }
    return users;
  },

  saveUsers(users) {
    const data = this.load();
    data.users = users;
    this.save(data);
    return users;
  },

  closeMonth(monthKey, settings, drawOptions) {
    const data = this.load();
    const users = data.users;
    const participants = users
      .filter((u) => typeof ChodzaPlans === "undefined" || ChodzaPlans.isDrawEligible(userPlan(u)))
      .map((u) => ({
        userId: u.id,
        nick: u.meno,
        monthly_points: u.mesacneBody,
        streak_of_loss: u.streak_of_loss ?? 0,
      }));

    const result = window.ChodzaDraw.runMonthlyClose({
      participants,
      allUsers: users,
      monthKey,
      settings,
      getUserPlan: userPlan,
      options: drawOptions,
    });
    const { draw, walkers, prizes } = result;

    for (const u of users) {
      const streakUpd = draw.streakUpdates.find((s) => s.userId === u.id);
      if (streakUpd) u.streak_of_loss = streakUpd.streak_of_loss;
    }

    for (const w of walkers) {
      const user = users.find((u) => u.id === w.userId);
      if (!user) continue;
      if (w.prizeType === "premium_month") {
        user.subscriptionPlan = "basic";
        user.premium = true;
        user.premiumGrantedMonth = monthKey;
      }
      user.winHistory = user.winHistory || [];
      user.winHistory.push({
        month: monthKey,
        place: w.place,
        type: "walker",
        sumaEur: w.prizeEur,
        km: w.km,
        prizeType: w.prizeType,
      });
    }

    for (const w of [...draw.main, ...draw.small]) {
      const user = users.find((u) => u.id === w.userId);
      if (!user) continue;
      user.winHistory = user.winHistory || [];
      user.winHistory.push({
        month: monthKey,
        place: w.place,
        type: w.type,
        sumaEur: w.prizeEur,
      });
    }

    for (const u of users) {
      if (u.mesacneBody > 0) {
        u.celkoveBody = (u.celkoveBody || 0) + u.mesacneBody;
        u.mesacneBody = 0;
        u.dailyWalks = [];
      }
    }

    data.closedMonths = data.closedMonths || [];
    if (!data.closedMonths.includes(monthKey)) data.closedMonths.push(monthKey);
    this.save(data);

    syncWinnersToApp(monthKey, {
      monthKey,
      closedAt: new Date().toISOString(),
      prizeMode: result.prizeMode,
      prizes,
      lottery: {
        main: draw.main.map((w) => ({
          place: w.place,
          nick: w.nick,
          userId: w.userId,
          prizeEur: w.prizeEur,
        })),
        small: draw.small.map((w) => ({
          nick: w.nick,
          userId: w.userId,
          prizeEur: w.prizeEur,
        })),
      },
      walkers,
    });

    return { ...result, users };
  },
};

function syncWinnersToApp(monthKey, payload) {
  try {
    let map = {};
    const raw = localStorage.getItem(WINNERS_KEY);
    if (raw) map = JSON.parse(raw);
    map[monthKey] = payload;
    localStorage.setItem(WINNERS_KEY, JSON.stringify(map));
  } catch (_) {}
}

let allUsers = [];
let filteredUsers = [];
const monthKey = currentMonthKey();

async function init() {
  const langSel = document.getElementById("admin-language");
  if (langSel) {
    langSel.value = ChodzaI18n?.getLang() ?? "sk";
    langSel.addEventListener("change", () => {
      ChodzaI18n.setLang(langSel.value, "admin");
      applyAdminLanguage();
    });
  }
  applyAdminLanguage();
  document.getElementById("admin-month-label").textContent = ta("admin.currentMonth", {
    month: formatMonthLabel(monthKey),
  });
  await loadSettingsForm();
  bindAdminNavigation();
  await refreshUsersTable();
  bindEvents();
}

async function loadSettingsForm() {
  if (typeof ChodzaSettings !== "undefined" && location.hash) {
    const fromHash = ChodzaSettings.decodeHash();
    if (fromHash) {
      await ChodzaAdminAPI.saveMonthlySettings(monthKey, {
        goalType: "walk_km",
        goalKmPerPoint: fromHash.goalKmPerPoint,
        maxPointsPerDay: fromHash.maxPointsPerDay,
        prizeMode: "percent",
        totalFundEur: fromHash.prizePoolEur,
        prizePoolEur: fromHash.prizePoolEur,
        manualPrizes: {
          drawFirst: 0,
          drawSecond: 0,
          drawThird: 0,
          smallEach: 0,
          walkerFirst: 0,
          walkerSecond: 0,
          walkerThird: 0,
        },
      });
    }
  }

  const s = await ChodzaAdminAPI.getMonthlySettings(monthKey);
  const mode = s.prizeMode === "manual" ? "manual" : "percent";
  document.querySelectorAll('input[name="prizeMode"]').forEach((r) => {
    r.checked = r.value === mode;
  });
  document.getElementById("total-fund-eur").value =
    (s.totalFundEur ?? s.prizePoolEur) > 0 ? String(s.totalFundEur ?? s.prizePoolEur) : "";
  const mp = s.manualPrizes || {};
  document.getElementById("mp-draw-first").value = mp.drawFirst > 0 ? String(mp.drawFirst) : "";
  document.getElementById("mp-draw-second").value = mp.drawSecond > 0 ? String(mp.drawSecond) : "";
  document.getElementById("mp-draw-third").value = mp.drawThird > 0 ? String(mp.drawThird) : "";
  document.getElementById("mp-small-each").value = mp.smallEach > 0 ? String(mp.smallEach) : "";
  document.getElementById("mp-walker-first").value = mp.walkerFirst > 0 ? String(mp.walkerFirst) : "";
  document.getElementById("mp-walker-second").value = mp.walkerSecond > 0 ? String(mp.walkerSecond) : "";
  document.getElementById("mp-walker-third").value = mp.walkerThird > 0 ? String(mp.walkerThird) : "";
  applyPrizeModeUi();
  document.getElementById("goal-type").value = s.goalType || "walk_km";
  document.getElementById("goal-km").value = s.goalKmPerPoint ?? 10;
  document.getElementById("max-points").value = s.maxPointsPerDay ?? 3;
  updateBackToAppLink(s);
  renderRevenuePreview(allUsers, s);
  renderAdminSummary(s);
}

function bindEvents() {
  document.getElementById("month-settings-form").addEventListener("submit", onSaveSettings);
  document.querySelectorAll('input[name="prizeMode"]').forEach((r) => {
    r.addEventListener("change", () => {
      applyPrizeModeUi();
      renderRevenuePreview(allUsers, collectSettingsFromForm());
    });
  });
  const previewInputs = [
    "total-fund-eur",
    "mp-draw-first",
    "mp-draw-second",
    "mp-draw-third",
    "mp-small-each",
    "mp-walker-first",
    "mp-walker-second",
    "mp-walker-third",
  ];
  previewInputs.forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      renderRevenuePreview(allUsers, collectSettingsFromForm());
    });
  });
  document.getElementById("user-search").addEventListener("input", onSearch);
  document.getElementById("btn-mark-registrations-seen")?.addEventListener("click", (e) => {
    e.preventDefault();
    const emails = allUsers.filter(isUnseenRegistration).map((u) => u.email).filter(Boolean);
    if (!emails.length) {
      updateRegistrationsAlert();
      return;
    }
    markAllRegistrationsSeen(emails);
    renderUsersTable();
    updateRegistrationsAlert();
  });
  window.addEventListener("chodza-users-changed", () => {
    refreshUsersTable();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === ChodzaAuth?.USERS_KEY) refreshUsersTable();
  });
  document.getElementById("btn-close-month").addEventListener("click", onCloseMonth);
  document.getElementById("modal-close").addEventListener("click", () => {
    document.getElementById("user-modal").close();
  });
  document.getElementById("user-modal").addEventListener("click", (e) => {
    if (e.target.id === "user-modal") e.target.close();
  });

}

async function onSaveSettings(e) {
  e.preventDefault();
  const status = document.getElementById("settings-save-status");
  status.textContent = "";
  status.classList.remove("admin-form__status--error");

  const payload = collectSettingsFromForm();
  payload.prizePoolEur = payload.totalFundEur;

  if (!Number.isFinite(payload.totalFundEur) || payload.totalFundEur < 0) {
    status.textContent = "Celková suma fondu musí byť 0 alebo viac.";
    status.classList.add("admin-form__status--error");
    return;
  }
  if (!Number.isFinite(payload.goalKmPerPoint) || payload.goalKmPerPoint < 1) {
    status.textContent = "Km na bod musí byť aspoň 1.";
    status.classList.add("admin-form__status--error");
    return;
  }

  const saved = await ChodzaAdminAPI.saveMonthlySettings(monthKey, payload);
  updateBackToAppLink(saved);
  await refreshUsersTable();

  const appUrl =
    typeof ChodzaSettings !== "undefined" ? ChodzaSettings.indexUrlFor(saved) : "index.html";

  status.textContent =
    ChodzaI18n?.getLang() === "en"
      ? "Saved. Opening app…"
      : "Uložené. Otváram aplikáciu…";
  status.classList.remove("admin-form__status--error");

  window.setTimeout(() => {
    window.location.href = appUrl;
  }, 450);
}

function updateBackToAppLink(settings) {
  const a = document.querySelector(".admin-sidebar__back");
  if (!a || !settings) return;
  const url =
    typeof ChodzaSettings !== "undefined" ? ChodzaSettings.indexUrlFor(settings) : "index.html";
  a.href = url;
  a.onclick = (e) => {
    e.preventDefault();
    if (typeof ChodzaSettings !== "undefined") {
      ChodzaSettings.write(settings.monthKey || monthKey, settings);
    }
    window.location.href = url;
  };
}

function onSearch() {
  const q = document.getElementById("user-search").value.trim().toLowerCase();
  filteredUsers = sortUsersForAdmin(
    allUsers.filter(
      (u) =>
        !q ||
        u.meno.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.city && u.city.toLowerCase().includes(q))
    )
  );
  renderUsersTable();
}

async function refreshUsersTable() {
  const settings = await ChodzaAdminAPI.getMonthlySettings(monthKey);
  allUsers = await ChodzaAdminAPI.getUsers();
  allUsers = sortUsersForAdmin(recalcUsersFromWalks(allUsers, settings));
  await ChodzaAdminAPI.saveUsers(allUsers);
  filteredUsers = [...allUsers];
  renderRevenuePreview(allUsers, settings);
  renderAdminSummary(settings);
  onSearch();
  renderRegistrationsSummary();
}

function recalcUsersFromWalks(users, settings) {
  const goal = settings.goalKmPerPoint || 10;
  const max = settings.maxPointsPerDay || 3;
  return users.map((u) => {
    const walks = u.dailyWalks || [];
    const mesacneBody = walks.reduce((s, d) => {
      const b = d.body ?? pointsFromKm(d.kilometre, goal, max, userPlan(u));
      return s + b;
    }, 0);
    return { ...u, mesacneBody };
  });
}

function renderUsersTable() {
  const tbody = document.getElementById("users-tbody");
  const empty = document.getElementById("users-empty");
  tbody.innerHTML = "";

  if (!filteredUsers.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const u of filteredUsers) {
    const tr = document.createElement("tr");
    const plan = userPlan(u);
    const subClass =
      plan === "plus" ? "badge--plus" : plan === "basic" ? "badge--active" : "badge--inactive";
    const isNew = isUnseenRegistration(u);
    const isReg = isRegisteredUser(u);
    if (isNew) tr.classList.add("admin-table__row--new");

    const regCell = isReg
      ? `<span class="badge badge--new">Nový</span><br /><time datetime="${u.registeredAt || ""}">${formatRegistrationDate(u.registeredAt)}</time>`
      : `<span class="admin-muted">Demo</span>`;

    const nameCell =
      isRegisteredUser(u) && u.username
        ? `<strong>@${escapeHtml(u.username)}</strong><br /><span class="admin-muted">${escapeHtml(`${u.firstName || ""} ${u.lastName || ""}`.trim())}</span>`
        : escapeHtml(u.meno);

    tr.innerHTML = `
      <td title="${u.id}">${shortId(u.id)}</td>
      <td>${nameCell}</td>
      <td>${escapeHtml(u.email)}</td>
      <td class="reg-cell">${regCell}</td>
      <td><span class="badge ${subClass}">${subscriptionLabel(u)}</span></td>
      <td><strong>${u.mesacneBody}</strong></td>
      <td>${u.celkoveBody ?? 0}</td>
      <td class="win-history-cell">${escapeHtml(formatWinHistory(u.winHistory))}</td>
      <td><button type="button" class="btn btn--ghost" data-user-id="${u.id}">Zobraziť detail</button></td>
    `;
    tr.querySelector("button").addEventListener("click", () => openUserModal(u.id));
    tbody.appendChild(tr);
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function openUserModal(userId) {
  const u = allUsers.find((x) => x.id === userId);
  if (!u) return;
  const settings = await ChodzaAdminAPI.getMonthlySettings(monthKey);
  const modal = document.getElementById("user-modal");
  document.getElementById("modal-user-title").textContent = u.meno;

  const walks = (u.dailyWalks || [])
    .slice()
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const activityRows = walks.length
    ? walks
        .map(
          (d) => `
      <tr class="${d.splnene ? "is-ok" : ""}">
        <td>${d.datum}</td>
        <td>${d.kilometre} km</td>
        <td>${d.body ?? pointsFromKm(d.kilometre, settings.goalKmPerPoint, settings.maxPointsPerDay, userPlan(u))}</td>
        <td>${d.splnene ? "Áno" : "Nie"}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4">Žiadna aktivita v tomto mesiaci (po uzatvorení mesiaca sa začína od nuly).</td></tr>`;

  const wins =
    u.winHistory?.length
      ? `<ul>${u.winHistory
          .map(
            (w) =>
              `<li>${formatMonthLabel(w.month)} – ${
                w.type === "main" ? `${w.place}. hlavná cena` : `${w.place}. menšia cena`
              }</li>`
          )
          .join("")}</ul>`
      : "<p>Ešte nevyhral.</p>";

  const regBlock =
    isRegisteredUser(u)
      ? `
      <div><dt>Meno a priezvisko</dt><dd>${escapeHtml(`${u.firstName || ""} ${u.lastName || ""}`.trim() || "—")}</dd></div>
      <div><dt>Nick</dt><dd>@${escapeHtml(u.username || u.meno)}</dd></div>
      <div><dt>Mesto / obec</dt><dd>${escapeHtml(u.city || "—")}</dd></div>
      <div><dt>IBAN</dt><dd>${u.iban ? escapeHtml(u.iban) : "— (nedoplnené)"}</dd></div>
      <div><dt>Health Connect</dt><dd>${u.healthLinked ? "Prepojené" : "Neprepojené"}</dd></div>
      <div><dt>Registrácia</dt><dd>${formatRegistrationDate(u.registeredAt)}</dd></div>
      <div><dt>GDPR</dt><dd>${u.gdprAccepted ? "Súhlas udelený" : "—"}</dd></div>`
      : `<div><dt>Zdroj</dt><dd>Demo účet</dd></div>`;

  document.getElementById("modal-user-body").innerHTML = `
    <dl class="modal-grid">
      <div><dt>ID</dt><dd>${escapeHtml(u.id)}</dd></div>
      <div><dt>E-mail</dt><dd>${escapeHtml(u.email)}</dd></div>
      ${regBlock}
      <div><dt>Predplatné</dt><dd>${subscriptionLabel(u)}</dd></div>
      <div><dt>Body tento mesiac</dt><dd>${u.mesacneBody}</dd></div>
      <div><dt>Celkový level</dt><dd>${u.celkoveBody ?? 0} bodov</dd></div>
      <div><dt>Pravidlo bodov</dt><dd>1 bod = ${settings.goalKmPerPoint} km (max ${settings.maxPointsPerDay}/deň)</dd></div>
    </dl>
    <div class="modal-section">
      <h3>História výhier</h3>
      ${wins}
    </div>
    <div class="modal-section">
      <h3>Denná aktivita (${formatMonthLabel(monthKey)})</h3>
      <table class="activity-table">
        <thead><tr><th>Dátum</th><th>Km</th><th>Body</th><th>Splnený limit</th></tr></thead>
        <tbody>${activityRows}</tbody>
      </table>
    </div>
  `;
  modal.showModal();
}

async function onCloseMonth() {
  const settings = collectSettingsFromForm();
  const prizes = resolvePrizeConfig(settings, allUsers);
  const withPoints = allUsers.filter(
    (u) => u.mesacneBody > 0 && (typeof ChodzaPlans === "undefined" || ChodzaPlans.isDrawEligible(userPlan(u)))
  ).length;

  const fundText =
    `Režim: ${settings.prizeMode === "manual" ? "manuálne sumy" : "automaticky %"}\n` +
    `Fond / výplaty: ${formatEur(prizes?.totalFundEur ?? 0)}\n` +
    `Pre vás (+ rezerva FREE makačov): ${formatEur(prizes?.ownerAmount ?? 0)}\n` +
    `Osudie: ${formatEur(prizes?.drawFirst)} / ${formatEur(prizes?.drawSecond)} / ${formatEur(prizes?.drawThird)} + 97× ${formatEur(prizes?.smallEach)}\n` +
    `Makači: ${formatEur(prizes?.walkerFirst)} / ${formatEur(prizes?.walkerSecond)} / ${formatEur(prizes?.walkerThird)}`;

  const ok = confirm(
    `Uzatvoriť ${formatMonthLabel(monthKey)}?\n\n` +
      `${fundText}\n` +
      `Účastníci s bodmi v osudí: ${withPoints}\n\n` +
      `Všetkým sa vynulujú mesačné body. Pokračovať?`
  );
  if (!ok) return;

  const btn = document.getElementById("btn-close-month");
  btn.disabled = true;
  btn.textContent = "Žrebujem…";

  try {
    const result = await ChodzaAdminAPI.closeMonth(monthKey, settings, {});
    renderDrawResults(result);
    await refreshUsersTable();
    document.getElementById("settings-save-status").textContent =
      `Mesiac ${formatMonthLabel(monthKey)} uzatvorený. Mesačné body vynulované.`;
  } catch (err) {
    alert(err.message || "Chyba pri uzatváraní mesiaca.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Uzatvoriť mesiac a spustiť žrebovanie";
  }
}

function renderDrawResults(result) {
  const block = document.getElementById("draw-results");
  block.hidden = false;
  const draw = result.draw;
  const p = result.prizes || draw.prizes || {};
  const walkers = result.walkers || [];

  document.getElementById("draw-results-meta").textContent =
    `${formatMonthLabel(draw.monthKey)} · ${draw.participantCount} v osudí · ${draw.basketSize} lístkov` +
    (draw.warning ? ` · ${draw.warning}` : "");

  document.getElementById("draw-prize-summary").innerHTML = `
    <h4 class="draw-prize-summary__title">Rozdelenie odmien</h4>
    <div class="draw-prize-summary__table">
      <div class="draw-prize-summary__row draw-prize-summary__row--owner"><span>Pre vás (+ rezerva)</span><strong>${formatEur(p.ownerAmount)}</strong></div>
      <div class="draw-prize-summary__row"><span>Osudie 1. / 2. / 3.</span><strong>${formatEur(p.drawFirst)} / ${formatEur(p.drawSecond)} / ${formatEur(p.drawThird)}</strong></div>
      <div class="draw-prize-summary__row"><span>97× osudie</span><strong>${formatEur(p.smallEach)} / os.</strong></div>
      <div class="draw-prize-summary__row"><span>Makači TOP 3</span><strong>${formatEur(p.walkerFirst)} / ${formatEur(p.walkerSecond)} / ${formatEur(p.walkerThird)}</strong></div>
    </div>`;

  const fmtVirtual = (w) =>
    `vp ${w.virtual_points?.toFixed?.(1) ?? w.virtual_points} · ${w.basketTickets} lístkov`;

  document.getElementById("draw-main-list").innerHTML = draw.main
    .map(
      (w) =>
        `<li><strong>@${escapeHtml(w.nick)}</strong> — ${w.place}. ` +
        `<span class="draw-list__prize">${formatEur(w.prizeEur)}</span> ` +
        `<span class="admin-hint">(${fmtVirtual(w)})</span></li>`
    )
    .join("");

  document.getElementById("draw-small-list").innerHTML = draw.small
    .map(
      (w, i) =>
        `<li>${i + 1}. @${escapeHtml(w.nick)} <span class="draw-list__prize">${formatEur(w.prizeEur)}</span></li>`
    )
    .join("");

  const walkersList = document.getElementById("draw-walkers-list");
  if (walkersList) {
    walkersList.innerHTML = walkers.length
      ? walkers
          .map((w) => {
            const prize =
              w.prizeType === "premium_month"
                ? `<span class="draw-list__premium">PREMIUM mesiac zdarma</span> <span class="admin-hint">(hotovosť ${formatEur(w.forfeitedEur)} → rezerva)</span>`
                : `<span class="draw-list__prize">${formatEur(w.prizeEur)}</span>`;
            return `<li><strong>@${escapeHtml(w.nick)}</strong> — ${w.km} km · ${w.place}. makač ${prize}</li>`;
          })
          .join("")
      : "<li class=\"admin-hint\">Žiadna aktivita v km tento mesiac.</li>";
  }
}

init();
