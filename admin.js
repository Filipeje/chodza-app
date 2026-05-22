/**
 * Admin panel – mock dáta, pripravené na Supabase.
 * Po pripojení: nastavte ChodzaAdminAPI.useMock = false a doplňte supabase klienta.
 */

const STORAGE_KEY = "chodza-admin-data-v1";
const WINNERS_KEY = "chodza-winners-by-month";
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
  const poolInput = document.getElementById("prize-pool-eur");
  if (poolInput) poolInput.placeholder = ta("admin.prizePlaceholder");
  if (allUsers.length) {
    ChodzaAdminAPI.getMonthlySettings(monthKey).then((s) => renderRevenuePreview(allUsers, s));
  }
}

function countPayingSubscribers(users) {
  return users.filter((u) => u.status_predplatneho === "premium").length;
}

/** Manuálny kôš len ak je zadaná kladná suma; inak tržby z predplatiteľov */
function resolvePrizeSource(settings, users) {
  const manual = Number(settings.prizePoolEur);
  const payingUsers = countPayingSubscribers(users);
  if (Number.isFinite(manual) && manual > 0) {
    return { mode: "manual", manualPool: manual, payingUsers };
  }
  const revenue = payingUsers * SUBSCRIPTION_PRICE_EUR;
  return { mode: "revenue", manualPool: null, payingUsers, revenue };
}

function getPrizeBreakdown(payingUsers, manualPool) {
  if (typeof ChodzaDraw === "undefined") return null;
  if (manualPool != null && manualPool > 0) {
    return ChodzaDraw.calculatePrizeAmounts({ manualPrizePool: manualPool });
  }
  return ChodzaDraw.calculatePrizeAmounts({
    payingUsers,
    priceMonthly: SUBSCRIPTION_PRICE_EUR,
  });
}

function renderRevenuePreview(users, settings) {
  const el = document.getElementById("revenue-preview");
  const fieldset = document.getElementById("revenue-fieldset");
  if (!el) return;

  const source = resolvePrizeSource(settings, users);
  const breakdown = getPrizeBreakdown(source.payingUsers, source.manualPool);
  if (!breakdown) {
    el.innerHTML = "<p class=\"admin-hint\">Načítava sa…</p>";
    return;
  }

  const price = typeof ChodzaI18n !== "undefined" ? ChodzaI18n.formatPrice() : formatEur(SUBSCRIPTION_PRICE_EUR);
  const isEn = ChodzaI18n?.getLang() === "en";

  if (source.mode === "manual") {
    fieldset?.classList.add("revenue-preview--manual-active");
    el.innerHTML = isEn
      ? `<p class="revenue-preview__lead"><strong>Manual pool ${formatEur(source.manualPool)}</strong> – subscription revenue is not used for the draw.</p>
         <p class="admin-hint">Active subscribers: ${source.payingUsers} × ${price} = ${formatEur(source.payingUsers * SUBSCRIPTION_PRICE_EUR)} (info only)</p>`
      : `<p class="revenue-preview__lead"><strong>Manuálny kôš ${formatEur(source.manualPool)}</strong> – tržby z predplatiteľov sa pri žrebovaní nepoužijú.</p>
         <p class="admin-hint">Aktívnych predplatiteľov: ${source.payingUsers} × ${price} = ${formatEur(source.payingUsers * SUBSCRIPTION_PRICE_EUR)} (informačne)</p>`;
    return;
  }

  fieldset?.classList.remove("revenue-preview--manual-active");
  const rev = breakdown.revenue ?? source.revenue ?? 0;
  const smallSlots = breakdown.smallCount ?? 97;
  const smallTotal = (breakdown.smallPrizeEach ?? 0) * smallSlots;

  if (isEn) {
    el.innerHTML = `
    <p class="revenue-preview__lead"><strong>${source.payingUsers}</strong> paying × <strong>${price}</strong>
      = <strong class="revenue-preview__total">${formatEur(rev)}</strong> monthly revenue</p>
    <div class="revenue-preview__table">
      <div class="revenue-preview__row revenue-preview__row--owner"><span>For you (45 %)</span><strong>${formatEur(breakdown.ownerAmount)}</strong></div>
      <div class="revenue-preview__row"><span>1st prize (15 %)</span><strong>${formatEur(breakdown.firstPrize)}</strong></div>
      <div class="revenue-preview__row"><span>2nd prize (10 %)</span><strong>${formatEur(breakdown.secondPrize)}</strong></div>
      <div class="revenue-preview__row"><span>3rd prize (6 %)</span><strong>${formatEur(breakdown.thirdPrize)}</strong></div>
      <div class="revenue-preview__row"><span>97× smaller prize (24 % total)</span><strong>${formatEur(breakdown.smallPrizeEach)} each</strong></div>
      <div class="revenue-preview__row revenue-preview__row--sub"><span>Total 97 smaller prizes</span><span>${formatEur(smallTotal)}</span></div>
      <div class="revenue-preview__row revenue-preview__row--sum"><span>Prizes total (55 %)</span><strong>${formatEur(rev - breakdown.ownerAmount)}</strong></div>
    </div>
    <p class="admin-hint">Used when closing the month if the prize fund field is empty.</p>`;
  } else {
    el.innerHTML = `
    <p class="revenue-preview__lead"><strong>${source.payingUsers}</strong> platiacich × <strong>${price}</strong>
      = <strong class="revenue-preview__total">${formatEur(rev)}</strong> tržby za mesiac</p>
    <div class="revenue-preview__table">
      <div class="revenue-preview__row revenue-preview__row--owner"><span>Pre vás (45 %)</span><strong>${formatEur(breakdown.ownerAmount)}</strong></div>
      <div class="revenue-preview__row"><span>1. cena (15 %)</span><strong>${formatEur(breakdown.firstPrize)}</strong></div>
      <div class="revenue-preview__row"><span>2. cena (10 %)</span><strong>${formatEur(breakdown.secondPrize)}</strong></div>
      <div class="revenue-preview__row"><span>3. cena (6 %)</span><strong>${formatEur(breakdown.thirdPrize)}</strong></div>
      <div class="revenue-preview__row"><span>97× menšia cena (24 % celkom)</span><strong>${formatEur(breakdown.smallPrizeEach)} / osoba</strong></div>
      <div class="revenue-preview__row revenue-preview__row--sub"><span>Súčet 97 menších cien</span><span>${formatEur(smallTotal)}</span></div>
      <div class="revenue-preview__row revenue-preview__row--sum"><span>Výhry spolu (55 %)</span><strong>${formatEur(rev - breakdown.ownerAmount)}</strong></div>
    </div>
    <p class="admin-hint">Toto sa použije pri uzatvorení mesiaca, ak pole výšky výhry necháš prázdne.</p>`;
  }
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

  async closeMonth(monthKey, poolEur) {
    if (this.useMock) return MockStore.closeMonth(monthKey, poolEur);
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

function subscriptionLabel(status) {
  return status === "premium" ? "Aktívne" : "Neaktívne";
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

function pointsFromKm(km, goalKm, maxPerDay) {
  return Math.min(maxPerDay, Math.floor(km / goalKm));
}

function seedMockUsers() {
  const month = currentMonthKey();
  const goal = 10;
  const ids = [
    ["u-001", "ChodecPro_SK", "chodec@demo.sk", "premium"],
    ["u-002", "Krokomerista", "krok@demo.sk", "premium"],
    ["u-003", "SynkoWalk", "synko@demo.sk", "premium"],
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
    const dailyWalks = buildDemoWalks(i, goal);
    const mesacneBody = dailyWalks.reduce((s, d) => s + d.body, 0);
    const celkoveBody = 40 + mesacneBody + i * 7;
    const streakSamples = [0, 0, 2, 1, 0, 3, 0, 1, 0, 2, 0, 0, 1, 0, 0];
    return {
      id,
      meno,
      email,
      status_predplatneho: status,
      mesacneBody,
      celkoveBody,
      streak_of_loss: streakSamples[i % streakSamples.length],
      winHistory: winSamples[i % winSamples.length],
      dailyWalks,
      created_at: "2026-01-15T10:00:00Z",
    };
  });
}

function buildDemoWalks(seed, goalKm) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const days = now.getDate();
  const walks = [];
  for (let d = 1; d <= days; d++) {
    const km = Math.max(0, ((seed * 3 + d * 7) % 35) + (d % 5) * 2.3);
    const body = pointsFromKm(km, goalKm, 3);
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
    return data.users;
  },

  saveUsers(users) {
    const data = this.load();
    data.users = users;
    this.save(data);
    return users;
  },

  closeMonth(monthKey, poolEur, drawOptions) {
    const data = this.load();
    const users = data.users;
    const participants = users.map((u) => ({
      userId: u.id,
      nick: u.meno,
      monthly_points: u.mesacneBody,
      streak_of_loss: u.streak_of_loss ?? 0,
    }));

    const manualPool = poolEur > 0 ? poolEur : null;
    const draw = window.ChodzaDraw.runMonthlyDraw(participants, monthKey, manualPool, drawOptions);

    for (const u of users) {
      const streakUpd = draw.streakUpdates.find((s) => s.userId === u.id);
      if (streakUpd) u.streak_of_loss = streakUpd.streak_of_loss;
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
      user.celkoveBody = (user.celkoveBody || 0) + user.mesacneBody;
      user.mesacneBody = 0;
      user.dailyWalks = [];
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

    const winnersPayload = {
      monthKey,
      poolEur,
      closedAt: new Date().toISOString(),
      main: draw.main.map((w) => ({ place: w.place, nick: w.nick, userId: w.userId })),
      small: draw.small.map((w) => ({ nick: w.nick, userId: w.userId })),
      prizes: draw.prizes,
    };
    syncWinnersToApp(monthKey, winnersPayload, poolEur);

    return { draw, users };
  },
};

function syncWinnersToApp(monthKey, payload, poolEur) {
  try {
    let map = {};
    const raw = localStorage.getItem(WINNERS_KEY);
    if (raw) map = JSON.parse(raw);
    map[monthKey] = {
      payingUsers: 0,
      manualPoolEur: poolEur,
      main: payload.main.map((w) => ({ place: w.place, nick: w.nick })),
      small: payload.small.map((w) => ({ nick: w.nick })),
    };
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
      ChodzaI18n.setLang(langSel.value);
      applyAdminLanguage();
    });
  }
  applyAdminLanguage();
  document.getElementById("admin-month-label").textContent = ta("admin.currentMonth", {
    month: formatMonthLabel(monthKey),
  });
  await loadSettingsForm();
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
        prizePoolEur: fromHash.prizePoolEur,
      });
    }
  }

  const s = await ChodzaAdminAPI.getMonthlySettings(monthKey);
  document.getElementById("prize-pool-eur").value =
    s.prizePoolEur > 0 ? String(s.prizePoolEur) : "";
  document.getElementById("goal-type").value = s.goalType || "walk_km";
  document.getElementById("goal-km").value = s.goalKmPerPoint ?? 10;
  document.getElementById("max-points").value = s.maxPointsPerDay ?? 3;
  updateBackToAppLink(s);
}

function bindEvents() {
  document.getElementById("month-settings-form").addEventListener("submit", onSaveSettings);
  document.getElementById("prize-pool-eur")?.addEventListener("input", () => {
    const settings = {
      prizePoolEur: Number(document.getElementById("prize-pool-eur").value) || 0,
      goalKmPerPoint: Number(document.getElementById("goal-km").value) || 10,
      maxPointsPerDay: Number(document.getElementById("max-points").value) || 3,
    };
    renderRevenuePreview(allUsers, settings);
  });
  document.getElementById("user-search").addEventListener("input", onSearch);
  document.getElementById("btn-close-month").addEventListener("click", onCloseMonth);
  document.getElementById("modal-close").addEventListener("click", () => {
    document.getElementById("user-modal").close();
  });
  document.getElementById("user-modal").addEventListener("click", (e) => {
    if (e.target.id === "user-modal") e.target.close();
  });

  document.querySelectorAll(".admin-nav__link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".admin-nav__link").forEach((l) => l.classList.remove("admin-nav__link--active"));
      link.classList.add("admin-nav__link--active");
    });
  });
}

async function onSaveSettings(e) {
  e.preventDefault();
  const status = document.getElementById("settings-save-status");
  status.textContent = "";
  status.classList.remove("admin-form__status--error");

  const poolRaw = document.getElementById("prize-pool-eur").value.trim();
  const payload = {
    prizePoolEur: poolRaw === "" ? 0 : Number(poolRaw),
    goalType: document.getElementById("goal-type").value,
    goalKmPerPoint: Number(document.getElementById("goal-km").value),
    maxPointsPerDay: Number(document.getElementById("max-points").value),
  };

  if (!Number.isFinite(payload.prizePoolEur) || payload.prizePoolEur < 0) {
    status.textContent = "Suma koša musí byť 0 alebo viac (prázdne = z predplatiteľov).";
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
  filteredUsers = allUsers.filter(
    (u) =>
      !q ||
      u.meno.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
  );
  renderUsersTable();
}

async function refreshUsersTable() {
  const settings = await ChodzaAdminAPI.getMonthlySettings(monthKey);
  allUsers = await ChodzaAdminAPI.getUsers();
  allUsers = recalcUsersFromWalks(allUsers, settings);
  await ChodzaAdminAPI.saveUsers(allUsers);
  filteredUsers = [...allUsers];
  renderRevenuePreview(allUsers, settings);
  onSearch();
}

function recalcUsersFromWalks(users, settings) {
  const goal = settings.goalKmPerPoint || 10;
  const max = settings.maxPointsPerDay || 3;
  return users.map((u) => {
    const walks = u.dailyWalks || [];
    const mesacneBody = walks.reduce((s, d) => {
      const b = d.body ?? pointsFromKm(d.kilometre, goal, max);
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
    const subClass = u.status_predplatneho === "premium" ? "badge--active" : "badge--inactive";
    tr.innerHTML = `
      <td title="${u.id}">${shortId(u.id)}</td>
      <td>${escapeHtml(u.meno)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="badge ${subClass}">${subscriptionLabel(u.status_predplatneho)}</span></td>
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
        <td>${d.body ?? pointsFromKm(d.kilometre, settings.goalKmPerPoint, settings.maxPointsPerDay)}</td>
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

  document.getElementById("modal-user-body").innerHTML = `
    <dl class="modal-grid">
      <div><dt>ID</dt><dd>${escapeHtml(u.id)}</dd></div>
      <div><dt>E-mail</dt><dd>${escapeHtml(u.email)}</dd></div>
      <div><dt>Predplatné</dt><dd>${subscriptionLabel(u.status_predplatneho)}</dd></div>
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
  const settings = await ChodzaAdminAPI.getMonthlySettings(monthKey);
  const source = resolvePrizeSource(settings, allUsers);
  const breakdown = getPrizeBreakdown(source.payingUsers, source.manualPool);
  const withPoints = allUsers.filter((u) => u.mesacneBody > 0).length;

  let fundText;
  if (source.mode === "manual") {
    fundText = `Manuálny kôš: ${formatEur(source.manualPool)}`;
  } else {
    fundText =
      `Tržby: ${source.payingUsers} × ${formatEur(SUBSCRIPTION_PRICE_EUR)} = ${formatEur(source.revenue)}\n` +
      `Pre vás 45 %: ${formatEur(breakdown?.ownerAmount ?? 0)}\n` +
      `Výhry: 1. ${formatEur(breakdown?.firstPrize)} / 2. ${formatEur(breakdown?.secondPrize)} / 3. ${formatEur(breakdown?.thirdPrize)} / 97× ${formatEur(breakdown?.smallPrizeEach)}`;
  }

  const ok = confirm(
    `Uzatvoriť ${formatMonthLabel(monthKey)}?\n\n` +
      `${fundText}\n` +
      `Účastníci s bodmi v koši: ${withPoints}\n\n` +
      `Všetkým sa vynulujú mesačné body. Pokračovať?`
  );
  if (!ok) return;

  const btn = document.getElementById("btn-close-month");
  btn.disabled = true;
  btn.textContent = "Žrebujem…";

  try {
    const poolForStore = source.manualPool ?? 0;
    const { draw } = await ChodzaAdminAPI.closeMonth(monthKey, poolForStore, {
      payingUsers: source.payingUsers,
      priceMonthly: SUBSCRIPTION_PRICE_EUR,
    });
    renderDrawResults(draw, source);
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

function renderDrawResults(draw, prizeSource) {
  const block = document.getElementById("draw-results");
  block.hidden = false;
  const p = draw.prizes || {};
  const smallSlots = p.smallCount ?? 97;
  const smallDrawn = draw.small?.length ?? 0;
  const smallEach = p.smallPrizeEach ?? 0;
  const smallTotal = smallEach * smallSlots;
  const prizesTotal =
    (p.firstPrize ?? 0) + (p.secondPrize ?? 0) + (p.thirdPrize ?? 0) + smallTotal;

  const fundLabel =
    prizeSource.mode === "revenue"
      ? `tržby ${formatEur(p.revenue ?? prizeSource.revenue)} (${prizeSource.payingUsers} × ${formatEur(SUBSCRIPTION_PRICE_EUR)})`
      : `manuálny kôš ${formatEur(prizeSource.manualPool)}`;

  document.getElementById("draw-results-meta").textContent =
    `${formatMonthLabel(draw.monthKey)} · ${fundLabel} · ` +
    `${draw.participantCount} hráčov · ${draw.basketSize ?? draw.poolTicketCount} lístkov v osudí` +
    (draw.warning ? ` · ${draw.warning}` : "");

  const revenueHeader =
    prizeSource.mode === "revenue"
      ? `
    <div class="draw-prize-summary__revenue">
      <p><strong>${prizeSource.payingUsers}</strong> predplatiteľov × <strong>${formatEur(SUBSCRIPTION_PRICE_EUR)}</strong>
        = <strong>${formatEur(p.revenue ?? prizeSource.revenue)}</strong></p>
    </div>
    <div class="draw-prize-summary__row draw-prize-summary__row--owner">
      <span>Pre vás (45 % tržieb)</span>
      <strong>${formatEur(p.ownerAmount)}</strong>
    </div>`
      : `
    <p class="admin-hint draw-prize-summary__manual-note">Manuálny kôš – suma rozdelená len medzi výhercov (15/55, 10/55, 6/55, 24/55).</p>`;

  const ownerLine =
    prizeSource.mode === "revenue" && p.ownerAmount > 0
      ? ""
      : p.ownerAmount > 0
        ? `<div class="draw-prize-summary__row draw-prize-summary__row--owner">
             <span>Pre vás</span>
             <strong>${formatEur(p.ownerAmount)}</strong>
           </div>`
        : "";

  const pctLabel = (pct) =>
    prizeSource.mode === "revenue" ? ` <span class="draw-prize-summary__pct">(${pct} % tržieb)</span>` : "";

  document.getElementById("draw-prize-summary").innerHTML = `
    <h4 class="draw-prize-summary__title">Rozdelenie peňazí podľa miest</h4>
    ${revenueHeader}
    <div class="draw-prize-summary__table">
      <div class="draw-prize-summary__row draw-prize-summary__row--highlight">
        <span>1. miesto – hlavná cena${pctLabel(15)}</span>
        <strong>${formatEur(p.firstPrize ?? 0)}</strong>
      </div>
      <div class="draw-prize-summary__row draw-prize-summary__row--highlight">
        <span>2. miesto – hlavná cena${pctLabel(10)}</span>
        <strong>${formatEur(p.secondPrize ?? 0)}</strong>
      </div>
      <div class="draw-prize-summary__row draw-prize-summary__row--highlight">
        <span>3. miesto – hlavná cena${pctLabel(6)}</span>
        <strong>${formatEur(p.thirdPrize ?? 0)}</strong>
      </div>
      <div class="draw-prize-summary__row">
        <span>97× menšia cena (na osobu)${pctLabel(24)}</span>
        <strong>${formatEur(smallEach)}</strong>
      </div>
      <div class="draw-prize-summary__row draw-prize-summary__row--sub">
        <span>Celkom za 97 menších cien</span>
        <span>${formatEur(smallTotal)}</span>
      </div>
      <div class="draw-prize-summary__row draw-prize-summary__row--total">
        <span>Spolu výhry z fondu (3 + ${smallSlots} miest)</span>
        <strong>${formatEur(prizesTotal)}</strong>
      </div>
      ${ownerLine}
    </div>
    <p class="admin-hint draw-prize-summary__hint">Nižšie je zoznam konkrétnych výhercov s priradenou sumou.</p>
  `;

  const fmtVirtual = (w) =>
    `virtual ${w.virtual_points?.toFixed?.(1) ?? w.virtual_points} → ${w.basketTickets} lístkov`;

  const mainHead = document.querySelector("#draw .draw-panel h4");
  if (mainHead) {
    mainHead.textContent =
      `Hlavné ceny (3) — 1.: ${formatEur(p.firstPrize)}, 2.: ${formatEur(p.secondPrize)}, 3.: ${formatEur(p.thirdPrize)}`;
  }
  const smallHead = document.querySelectorAll("#draw .draw-panel h4")[1];
  if (smallHead) {
    smallHead.textContent = `Menšie ceny (${smallDrawn} vyžrebovaných / ${smallSlots}) — po ${formatEur(smallEach)}`;
  }

  document.getElementById("draw-main-list").innerHTML = draw.main
    .map(
      (w) =>
        `<li><strong>@${escapeHtml(w.nick)}</strong> — ${w.place}. miesto ` +
        `<span class="draw-list__prize">${formatEur(w.prizeEur)}</span> ` +
        `<span class="admin-hint">(${fmtVirtual(w)}, streak ${w.streak_of_loss})</span></li>`
    )
    .join("");

  document.getElementById("draw-small-list").innerHTML = draw.small
    .map(
      (w, i) =>
        `<li>${i + 1}. @${escapeHtml(w.nick)} ` +
        `<span class="draw-list__prize">${formatEur(w.prizeEur)}</span> ` +
        `<span class="admin-hint">(${fmtVirtual(w)})</span></li>`
    )
    .join("");
}

init();
