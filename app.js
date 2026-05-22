/**
 * Denný cieľ nastavuje administrátor (neskôr admin panel / Supabase).
 * Dočasne v konzole prehliadača: localStorage.setItem("chodza-admin-goal", "10")
 */
const ADMIN_GOAL_KM = 10;
const MAX_POINTS_PER_DAY = 3;
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

/** Rozdelenie výhier za mesiac (70 % tržieb) – súčet = 100 % */
const PRIZE_CONFIG = {
  priceMonthly: 3.99,
  ownerShare: 0.3,
  prizePoolShare: 0.7,
  mainCount: 3,
  smallCount: 70,
  poolSplit: { first: 0.25, second: 0.15, third: 0.1, small: 0.5 },
};

const state = {
  goalKm: ADMIN_GOAL_KM,
  kmToday: 7.4,
  statsPeriod: "week",
  history: [],
  dailyPoints: [],
  premium: false,
  winnersByMonth: {},
  selectedWinnerMonth: null,
};

const titles = {
  home: "Dnes",
  tickets: "Moje body",
  winners: "Výhercovia",
  profile: "Profil",
};

const MEDALS = ["🥇", "🥈", "🥉"];

function formatDateSk(d) {
  return d.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatShortSk(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Posledný deň aktuálneho mesiaca o 23:59:59 (lokálny čas) */
function getDrawDeadline() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatDrawDate(d) {
  return d.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function pluralUnit(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function updateDrawCountdown() {
  const deadline = getDrawDeadline();
  const now = new Date();
  let diff = deadline - now;

  const box = document.getElementById("draw-countdown");
  const whenEl = document.getElementById("draw-countdown-when");
  const labelEl = box?.querySelector(".draw-countdown__label");

  if (!box || !whenEl) return;

  whenEl.textContent = `Žrebovanie: ${formatDrawDate(deadline)}`;

  if (diff <= 0) {
    box.classList.add("draw-countdown--today");
    if (labelEl) labelEl.textContent = "Žrebovanie dnes!";
    document.getElementById("cd-days").textContent = "0";
    document.getElementById("cd-hours").textContent = "0";
    document.getElementById("cd-mins").textContent = "0";
    document.getElementById("cd-secs").textContent = "0";
    return;
  }

  box.classList.remove("draw-countdown--today");
  if (labelEl) labelEl.textContent = "Do ďalšieho žrebovania";

  const days = Math.floor(diff / 86400000);
  diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const mins = Math.floor(diff / 60000);
  diff -= mins * 60000;
  const secs = Math.floor(diff / 1000);

  document.getElementById("cd-days").textContent = String(days);
  document.getElementById("cd-hours").textContent = String(hours).padStart(2, "0");
  document.getElementById("cd-mins").textContent = String(mins).padStart(2, "0");
  document.getElementById("cd-secs").textContent = String(secs).padStart(2, "0");

  const daysName = document.querySelector("#draw-countdown .draw-countdown__unit:first-child .draw-countdown__name");
  if (daysName) {
    daysName.textContent = pluralUnit(days, "deň", "dni", "dní");
  }
}

let drawCountdownTimer = null;

function startDrawCountdown() {
  updateDrawCountdown();
  if (drawCountdownTimer) clearInterval(drawCountdownTimer);
  drawCountdownTimer = setInterval(updateDrawCountdown, 1000);
}

function addDays(iso, delta) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function syncTodayToHistory() {
  const today = todayIso();
  const entry = state.history.find((h) => h.date === today);
  if (entry) entry.km = state.kmToday;
  else state.history.unshift({ date: today, km: state.kmToday });
}

function getHistorySorted() {
  return [...state.history].sort((a, b) => b.date.localeCompare(a.date));
}

function getRecentDaysBeforeToday(count = 3) {
  const today = todayIso();
  return getHistorySorted()
    .filter((h) => h.date < today)
    .slice(0, count);
}

function dayLabel(iso) {
  const today = todayIso();
  const yesterday = addDays(today, -1);
  if (iso === today) return "Dnes";
  if (iso === yesterday) return "Včera";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("sk-SK", { weekday: "long" });
}

function getPointsForKm(km) {
  const step = state.goalKm;
  if (!step || step <= 0) return 0;
  return Math.min(MAX_POINTS_PER_DAY, Math.floor(km / step));
}

function formatPointsShort(n) {
  if (n === 1) return "1 bod";
  if (n >= 2 && n <= 4) return `${n} body`;
  if (n === 0) return "0 bodov";
  return `${n} bodov`;
}

function renderDayRow(entry) {
  const pts = getPointsForKm(entry.km);
  const badge =
    pts > 0 ? `<span class="day-row__badge">${formatPointsShort(pts)}</span>` : "";
  return `
    <li class="day-row">
      <div class="day-row__left">
        <span class="day-row__label">${dayLabel(entry.date)}${badge}</span>
        <span class="day-row__sub">${formatShortSk(entry.date)}</span>
      </div>
      <span class="day-row__km${pts > 0 ? " day-row__km--done" : ""}">${entry.km.toFixed(1)} km</span>
    </li>`;
}

function renderRecentDays() {
  const list = document.getElementById("recent-days-list");
  const days = getRecentDaysBeforeToday(3);
  if (days.length === 0) {
    list.innerHTML =
      '<li class="day-row"><span class="day-row__sub">Zatiaľ žiadna história.</span></li>';
    return;
  }
  list.innerHTML = days.map(renderDayRow).join("");
}

function renderFullHistory() {
  const list = document.getElementById("history-full-list");
  const all = getHistorySorted();
  list.innerHTML = all.map(renderDayRow).join("");
}

function openHistoryModal() {
  syncTodayToHistory();
  renderFullHistory();
  const modal = document.getElementById("history-modal");
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeHistoryModal() {
  document.getElementById("history-modal").hidden = true;
  document.body.style.overflow = "";
}

function updateRing() {
  const step = state.goalKm;
  const km = state.kmToday;
  const pointsToday = getPointsForKm(km);
  const maxKm = step * MAX_POINTS_PER_DAY;
  const pct = maxKm > 0 ? Math.min(km / maxKm, 1) : 0;
  const offset = RING_CIRCUMFERENCE * (1 - pct);

  const ring = document.getElementById("ring-progress");
  ring.style.strokeDashoffset = String(offset);
  ring.classList.toggle("ring__progress--done", pointsToday >= MAX_POINTS_PER_DAY);

  document.getElementById("km-today").textContent = km.toFixed(1);
  const goalEl = document.getElementById("km-goal");
  if (goalEl) goalEl.textContent = String(step);

  const status = document.getElementById("goal-status");

  if (pointsToday >= MAX_POINTS_PER_DAY) {
    status.textContent = `Maximum ${MAX_POINTS_PER_DAY} body za dnes!`;
    status.style.color = "var(--success)";
  } else if (pointsToday > 0) {
    const nextAt = (pointsToday + 1) * step;
    const left = Math.max(0, nextAt - km).toFixed(1);
    status.innerHTML = `Dnes <strong>${formatPointsShort(pointsToday)}</strong> · ešte <span id="km-remaining">${left}</span> km do ďalšieho`;
    status.style.color = "var(--success)";
  } else {
    const left = Math.max(0, step - km).toFixed(1);
    status.innerHTML = `Ešte <span id="km-remaining">${left}</span> km do 1. bodu (${step} km = 1 bod)`;
    status.style.color = "";
  }
}

function pluralBody(n) {
  if (n === 1) return "bod tento mesiac";
  if (n >= 2 && n <= 4) return "body tento mesiac";
  return "bodov tento mesiac";
}

function getMonthDailyPoints() {
  const month = currentMonthKey();
  return state.dailyPoints
    .filter((d) => d.date.startsWith(month) && d.points > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function upsertDailyPoint(date, km) {
  const points = getPointsForKm(km);
  const idx = state.dailyPoints.findIndex((d) => d.date === date);
  if (points === 0) {
    if (idx >= 0) state.dailyPoints.splice(idx, 1);
    return;
  }
  const row = { date, points, km };
  if (idx >= 0) state.dailyPoints[idx] = row;
  else state.dailyPoints.push(row);
}

function rebuildDailyPointsFromHistory() {
  const month = currentMonthKey();
  const rows = state.history
    .filter((h) => h.date.startsWith(month))
    .map((h) => ({
      date: h.date,
      points: getPointsForKm(h.km),
      km: h.km,
    }))
    .filter((r) => r.points > 0);

  const otherMonths = state.dailyPoints.filter((d) => !d.date.startsWith(month));
  state.dailyPoints = [...otherMonths, ...rows].sort((a, b) => b.date.localeCompare(a.date));
}

function renderTickets() {
  const now = new Date();
  const monthRows = getMonthDailyPoints();
  const totalPoints = monthRows.reduce((s, d) => s + d.points, 0);

  document.getElementById("tickets-month").textContent = now.toLocaleDateString(
    "sk-SK",
    { month: "long", year: "numeric" }
  );
  document.getElementById("tickets-count").textContent = String(totalPoints);
  document.getElementById("tickets-count-label").textContent = pluralBody(totalPoints);

  const list = document.getElementById("ticket-list");
  if (monthRows.length === 0) {
    list.innerHTML =
      '<li class="ticket-list__item"><span class="day-row__sub">Zatiaľ žiadne body tento mesiac.</span></li>';
    return;
  }

  list.innerHTML = monthRows
    .map(
      (t) => `
    <li class="ticket-list__item">
      <span class="ticket-list__date">${formatShortSk(t.date)}</span>
      <span class="ticket-list__tag ticket-list__tag--pts">${formatPointsShort(t.points)} · ${t.km.toFixed(1)} km</span>
    </li>`
    )
    .join("");
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonthKey() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function loadAdminGoal() {
  const saved = localStorage.getItem("chodza-admin-goal");
  if (saved) {
    const n = Number(saved);
    if (n >= 1 && n <= 50) state.goalKm = n;
  } else {
    state.goalKm = ADMIN_GOAL_KM;
  }
  const el = document.getElementById("display-goal");
  if (el) el.textContent = `${state.goalKm} km = 1 bod`;
  const hint = document.getElementById("hint-km-per-point");
  if (hint) hint.textContent = String(state.goalKm);
}

function getPeriodHistory(period) {
  const today = todayIso();
  const sorted = getHistorySorted();

  if (period === "week") {
    const from = addDays(today, -6);
    return sorted.filter((h) => h.date >= from && h.date <= today);
  }

  const monthKey = currentMonthKey();
  return sorted.filter((h) => h.date.startsWith(monthKey));
}

function updatePeriodStats() {
  const period = state.statsPeriod;
  const entries = getPeriodHistory(period);
  const totalKm = entries.reduce((s, h) => s + h.km, 0);
  const done = entries.filter((h) => getPointsForKm(h.km) > 0).length;

  const kmLabel = document.getElementById("stat-km-label");
  const kmVal = document.getElementById("km-period");
  const daysDone = document.getElementById("days-done");
  const daysTotal = document.getElementById("days-done-total");

  if (period === "week") {
    kmLabel.textContent = "Km tento týždeň";
    daysTotal.textContent = "/ 7";
  } else {
    kmLabel.textContent = "Km tento mesiac";
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    daysTotal.textContent = `/ ${daysInMonth}`;
  }

  kmVal.textContent = totalKm.toFixed(1);
  daysDone.textContent = String(done);

  document.getElementById("period-week")?.classList.toggle(
    "period-toggle__btn--active",
    period === "week"
  );
  document.getElementById("period-month")?.classList.toggle(
    "period-toggle__btn--active",
    period === "month"
  );
}

function setStatsPeriod(period) {
  state.statsPeriod = period;
  updatePeriodStats();
}

function formatMonthKey(key) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("sk-SK", { month: "long", year: "numeric" });
}

function formatEur(amount) {
  return amount.toLocaleString("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function calculatePrizeBreakdown(payingUsers, priceMonthly = PRIZE_CONFIG.priceMonthly) {
  const revenue = payingUsers * priceMonthly;
  const ownerAmount = revenue * PRIZE_CONFIG.ownerShare;
  const poolAmount = revenue * PRIZE_CONFIG.prizePoolShare;
  const { first, second, third, small } = PRIZE_CONFIG.poolSplit;
  const firstPrize = poolAmount * first;
  const secondPrize = poolAmount * second;
  const thirdPrize = poolAmount * third;
  const smallTotal = poolAmount * small;
  const smallPrizeEach = smallTotal / PRIZE_CONFIG.smallCount;

  return {
    payingUsers,
    priceMonthly,
    revenue,
    ownerAmount,
    poolAmount,
    firstPrize,
    secondPrize,
    thirdPrize,
    smallPrizeEach,
    totalWinners: PRIZE_CONFIG.mainCount + PRIZE_CONFIG.smallCount,
  };
}

function renderMainWinnerRow(w, prizeEur) {
  const medal = MEDALS[w.place - 1];
  return `
    <li class="winner-row winner-row--top">
      <span class="winner-row__medal" aria-hidden="true">${medal}</span>
      <div class="winner-row__info">
        <span class="winner-row__nick">@${w.nick}</span>
        <span class="winner-row__sub">${w.place}. miesto – hlavná cena</span>
      </div>
      <span class="winner-row__prize">${formatEur(prizeEur)}</span>
    </li>`;
}

function renderSmallWinnerRow(w, prizeEur) {
  return `
    <li class="winner-row winner-row--small">
      <span class="winner-row__place">•</span>
      <div class="winner-row__info">
        <span class="winner-row__nick">@${w.nick}</span>
        <span class="winner-row__sub">menšia výhra</span>
      </div>
      <span class="winner-row__prize">${formatEur(prizeEur)}</span>
    </li>`;
}

function renderPrizePoolCard(b) {
  return `
    <div class="prize-pool">
      <h3 class="prize-pool__title">Výhry za mesiac</h3>
      <dl class="prize-pool__grid">
        <dt>Platiaci predplatitelia</dt>
        <dd>${b.payingUsers.toLocaleString("sk-SK")} × ${formatEur(b.priceMonthly)}</dd>
        <dt>Tržby spolu</dt>
        <dd>${formatEur(b.revenue)}</dd>
        <dt>Pre vás (30 %)</dt>
        <dd class="prize-pool__owner">${formatEur(b.ownerAmount)}</dd>
        <dt>Výhry spolu (70 %)</dt>
        <dd class="prize-pool__highlight">${formatEur(b.poolAmount)}</dd>
        <dt>1. cena (25 % výhier)</dt>
        <dd>${formatEur(b.firstPrize)}</dd>
        <dt>2. cena (15 % výhier)</dt>
        <dd>${formatEur(b.secondPrize)}</dd>
        <dt>3. cena (10 % výhier)</dt>
        <dd>${formatEur(b.thirdPrize)}</dd>
        <dt>70× menšia cena (50 % výhier)</dt>
        <dd>${formatEur(b.smallPrizeEach)} / osoba</dd>
      </dl>
      <p class="prize-pool__note">
        Rozdelenie 70 % výhier: 25 % + 15 % + 10 % pre prvé tri miesta, zvyšných 50 % rovnomerne medzi 70 výhercov.
        Počet platiacich sa počíta k poslednému dňu mesiaca.
      </p>
    </div>`;
}

function generateDemoSmallNicks(count, seed) {
  const bases = ["Chodec", "Krok", "Walk", "Fit", "Syn", "Bod", "Km", "Pešiak"];
  return Array.from({ length: count }, (_, i) => ({
    nick: `${bases[i % bases.length]}_${seed}_${String(i + 1).padStart(2, "0")}`,
  }));
}

function seedDemoWinners() {
  if (Object.keys(state.winnersByMonth).length > 0) return;

  const prev = getPreviousMonthKey();
  const prevSeed = prev.replace("-", "");

  state.winnersByMonth[prev] = {
    payingUsers: 1000,
    priceMonthly: 3.99,
    main: [
      { place: 1, nick: "ChodecPro_SK" },
      { place: 2, nick: "Krokomerista" },
      { place: 3, nick: "SynkoWalk" },
    ],
    small: generateDemoSmallNicks(70, prevSeed),
  };

  const twoBack = (() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  state.winnersByMonth[twoBack] = {
    payingUsers: 650,
    priceMonthly: 3.99,
    main: [
      { place: 1, nick: "FitJuraj" },
      { place: 2, nick: "12km_den" },
      { place: 3, nick: "ZochodMa" },
    ],
    small: generateDemoSmallNicks(70, twoBack.replace("-", "")),
  };

  state.selectedWinnerMonth = prev;
}

function getDefaultWinnersMonth() {
  const prev = getPreviousMonthKey();
  if (state.winnersByMonth[prev]?.main?.length) return prev;
  const keys = Object.keys(state.winnersByMonth).sort((a, b) => b.localeCompare(a));
  return keys[0] || prev;
}

function getWinnerMonthOptions() {
  const months = new Set([...Object.keys(state.winnersByMonth), currentMonthKey()]);
  return [...months].sort((a, b) => b.localeCompare(a));
}

let smallWinnersExpanded = false;

function renderWinners() {
  const select = document.getElementById("winners-month-select");
  const months = getWinnerMonthOptions();
  if (!state.selectedWinnerMonth) state.selectedWinnerMonth = getDefaultWinnersMonth();

  select.innerHTML = months
    .map(
      (key) =>
        `<option value="${key}"${key === state.selectedWinnerMonth ? " selected" : ""}>${formatMonthKey(key)}</option>`
    )
    .join("");

  const month = select.value;
  state.selectedWinnerMonth = month;
  const draw = state.winnersByMonth[month];
  const isCurrent = month === currentMonthKey();
  const container = document.getElementById("winners-content");
  const hint = document.getElementById("winners-hint");

  document.getElementById("today-date").textContent = formatMonthKey(month);

  if (!draw || !draw.main?.length) {
    container.innerHTML = `
      <div class="winners-status winners-status--pending">
        ${isCurrent
          ? "Žrebovanie pre tento mesiac ešte neprebehlo. Po skončení mesiaca sa vyžrebujú 3 hlavné a 70 menších cien podľa počtu platiacich."
          : "Pre tento mesiac zatiaľ nie sú zverejnení výhercovia."}
      </div>`;
    hint.hidden = false;
    return;
  }

  const b = calculatePrizeBreakdown(draw.payingUsers, draw.priceMonthly ?? PRIZE_CONFIG.priceMonthly);
  const mainPrizes = [b.firstPrize, b.secondPrize, b.thirdPrize];
  const collapsedClass = smallWinnersExpanded ? "" : " winners-list--collapsed";
  const toggleLabel = smallWinnersExpanded ? "Zbaliť zoznam" : `Zobraziť všetkých (${draw.small.length})`;

  container.innerHTML = `
    <div class="winners-status">
      ${formatMonthKey(month)} – ${b.totalWinners} výhercov (3 hlavné + ${PRIZE_CONFIG.smallCount} menších)
    </div>
    ${renderPrizePoolCard(b)}
    <section class="winners-section">
      <div class="winners-section__head">
        <h3 class="winners-section__title">Hlavné ceny</h3>
        <span class="winners-section__meta">3 výhercov</span>
      </div>
      <ol class="winners-list">
        ${draw.main.map((w, i) => renderMainWinnerRow(w, mainPrizes[i])).join("")}
      </ol>
    </section>
    <section class="winners-section">
      <div class="winners-section__head">
        <h3 class="winners-section__title">Menšie ceny</h3>
        <button type="button" class="btn--tiny" id="toggle-small-winners">${toggleLabel}</button>
      </div>
      <ol class="winners-list${collapsedClass}" id="winners-small-list">
        ${draw.small.map((w) => renderSmallWinnerRow(w, b.smallPrizeEach)).join("")}
      </ol>
    </section>`;

  document.getElementById("toggle-small-winners")?.addEventListener("click", () => {
    smallWinnersExpanded = !smallWinnersExpanded;
    renderWinners();
  });

  hint.hidden = true;
}

function showPanel(name) {
  document.querySelectorAll(".panel").forEach((p) => {
    p.hidden = true;
    p.classList.remove("panel--active");
  });
  const panel = document.getElementById(`panel-${name}`);
  panel.hidden = false;
  panel.classList.add("panel--active");

  document.querySelectorAll(".nav__item").forEach((n) => {
    n.classList.toggle("nav__item--active", n.dataset.panel === name);
  });

  document.getElementById("page-title").textContent = titles[name] || name;

  if (name === "winners") {
    if (!state.selectedWinnerMonth || !state.winnersByMonth[state.selectedWinnerMonth]?.main?.length) {
      state.selectedWinnerMonth = getDefaultWinnersMonth();
    }
    renderWinners();
  } else if (name === "home") {
    document.getElementById("today-date").textContent = formatDateSk(new Date());
    updateDrawCountdown();
    updatePeriodStats();
  } else if (name === "tickets") {
    const now = new Date();
    document.getElementById("today-date").textContent = now.toLocaleDateString("sk-SK", {
      month: "long",
      year: "numeric",
    });
  } else {
    document.getElementById("today-date").textContent = "";
  }
}

function simulateSync() {
  const extra = 2 + Math.random() * 4;
  state.kmToday = Math.round((state.kmToday + extra) * 10) / 10;
  syncTodayToHistory();
  updateRing();
  renderRecentDays();
  updatePeriodStats();

  const today = todayIso();
  upsertDailyPoint(today, state.kmToday);
  renderTickets();

  const btn = document.getElementById("sync-btn");
  btn.textContent = "Synchronizované ✓";
  setTimeout(() => {
    btn.textContent = "Synchronizovať zdravie (demo)";
  }, 2000);
}

function seedDemoHistory() {
  if (state.history.length > 0) return;
  const kms = [7.4, 13.1, 12.4, 8.2, 14.0, 6.5, 12.8, 9.0, 15.2, 11.1, 4.3, 12.0, 7.7, 13.5];
  const today = todayIso();
  state.history = kms.map((km, i) => ({
    date: addDays(today, -i),
    km,
  }));
  state.kmToday = state.history[0].km;
}

function init() {
  seedDemoHistory();
  seedDemoWinners();
  loadAdminGoal();
  rebuildDailyPointsFromHistory();
  document.getElementById("today-date").textContent = formatDateSk(new Date());

  const saved = localStorage.getItem("chodza-settings");
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (typeof s.dark === "boolean") {
        document.documentElement.dataset.theme = s.dark ? "dark" : "";
        document.getElementById("setting-dark").checked = s.dark;
      }
      document.getElementById("setting-notify").checked = s.notify !== false;
      if (s.statsPeriod === "week" || s.statsPeriod === "month") {
        state.statsPeriod = s.statsPeriod;
      }
    } catch (_) {}
  }

  syncTodayToHistory();
  updateRing();
  renderTickets();
  renderRecentDays();
  updatePeriodStats();
  startDrawCountdown();

  document.getElementById("history-open-btn").addEventListener("click", openHistoryModal);
  document.getElementById("history-close-btn").addEventListener("click", closeHistoryModal);
  document.getElementById("history-backdrop").addEventListener("click", closeHistoryModal);

  document.getElementById("winners-month-select").addEventListener("change", (e) => {
    state.selectedWinnerMonth = e.target.value;
    renderWinners();
  });

  document.querySelectorAll(".nav__item").forEach((btn) => {
    btn.addEventListener("click", () => showPanel(btn.dataset.panel));
  });

  document.getElementById("sync-btn").addEventListener("click", simulateSync);

  document.getElementById("period-week")?.addEventListener("click", () => {
    setStatsPeriod("week");
    persistSettings();
  });
  document.getElementById("period-month")?.addEventListener("click", () => {
    setStatsPeriod("month");
    persistSettings();
  });

  document.getElementById("setting-dark").addEventListener("change", (e) => {
    document.documentElement.dataset.theme = e.target.checked ? "dark" : "";
    persistSettings();
  });

  document.getElementById("setting-notify").addEventListener("change", persistSettings);

  document.getElementById("upgrade-btn").addEventListener("click", () => {
    alert("Krok 3: Stripe checkout + webhook do Supabase (users.status_predplatneho = premium).");
  });
}

function persistSettings() {
  localStorage.setItem(
    "chodza-settings",
    JSON.stringify({
      dark: document.getElementById("setting-dark").checked,
      notify: document.getElementById("setting-notify").checked,
      statsPeriod: state.statsPeriod,
    })
  );
}

init();
