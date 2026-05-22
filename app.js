/**
 * Denný cieľ nastavuje administrátor (neskôr admin panel / Supabase).
 * Dočasne v konzole prehliadača: localStorage.setItem("chodza-admin-goal", "10")
 */
const ADMIN_GOAL_KM = 10;
const DEFAULT_MAX_POINTS_PER_DAY = 3;
let trackPathLength = 0;

function getMaxPointsPerDay() {
  return state.maxPointsPerDay ?? DEFAULT_MAX_POINTS_PER_DAY;
}

function getTrackPathLength() {
  const el = document.getElementById("ring-progress-1");
  if (!el) return 500;
  if (!trackPathLength) trackPathLength = el.getTotalLength();
  return trackPathLength;
}

function setRingTier(id, pct, len) {
  const el = document.getElementById(id);
  if (!el) return;
  const clamped = Math.min(1, Math.max(0, pct));
  el.style.strokeDasharray = `${len}`;
  el.style.strokeDashoffset = String(len * (1 - clamped));
}

/** Výpočet výhier (podiel na odmeny nie je v UI zobrazený) */
const PRIZE_CONFIG = {
  priceMonthly: 3.99,
  ownerShare: 0.45,
  mainCount: 3,
  smallCount: 97,
  /** Podiely z tržby: 45 % prevádzka, 15+10+6+24 % výhry */
  revenueSplit: { first: 0.15, second: 0.1, third: 0.06, small: 0.24 },
  /** Manuálny kôš – 100 % na výhry podľa 15/55, 10/55, 6/55, 24/55 */
  manualPoolSplit: { first: 15 / 55, second: 10 / 55, third: 6 / 55, small: 24 / 55 },
};

const state = {
  goalKm: ADMIN_GOAL_KM,
  maxPointsPerDay: DEFAULT_MAX_POINTS_PER_DAY,
  kmToday: 7.4,
  statsPeriod: "week",
  history: [],
  dailyPoints: [],
  calendarView: "month",
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedCalendarDay: null,
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

  whenEl.textContent = `Odmeňovanie: ${formatDrawDate(deadline)}`;

  if (diff <= 0) {
    box.classList.add("draw-countdown--today");
    if (labelEl) labelEl.textContent = "Odmeňovanie dnes!";
    document.getElementById("cd-days").textContent = "0";
    document.getElementById("cd-hours").textContent = "0";
    document.getElementById("cd-mins").textContent = "0";
    document.getElementById("cd-secs").textContent = "0";
    return;
  }

  box.classList.remove("draw-countdown--today");
  if (labelEl) labelEl.textContent = "Do ďalšieho odmeňovania";

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

function isoFromParts(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getKmForDate(iso) {
  const entry = state.history.find((h) => h.date === iso);
  return entry ? entry.km : null;
}

function qualifiesGreenDot(km) {
  return km != null && km >= state.goalKm;
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
  return Math.min(getMaxPointsPerDay(), Math.floor(km / step));
}

function formatPointsShort(n) {
  if (n === 1) return "1 bod";
  if (n >= 2 && n <= 4) return `${n} body`;
  if (n === 0) return "0 bodov";
  return `${n} bodov`;
}

function updateCalendarDayDetail(iso) {
  const box = document.getElementById("calendar-day-detail");
  if (!box || !iso) return;

  const km = getKmForDate(iso);
  const d = new Date(iso + "T12:00:00");
  const title = d.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (km == null) {
    box.innerHTML = `
      <p class="calendar-day-detail__title">${title}</p>
      <p class="calendar-day-detail__meta">Žiadne údaje o chôdzi.</p>`;
    return;
  }

  const pts = getPointsForKm(km);
  const dotNote = qualifiesGreenDot(km)
    ? " · splnený cieľ (zelená bodka)"
    : ` · ešte ${Math.max(0, state.goalKm - km).toFixed(1)} km do zelenej bodky`;

  box.innerHTML = `
    <p class="calendar-day-detail__title">${title}</p>
    <p class="calendar-day-detail__km">${km.toFixed(1)} km</p>
    <p class="calendar-day-detail__meta">${formatPointsShort(pts)}${dotNote}</p>`;
}

function setCalendarView(view) {
  state.calendarView = view;
  document.querySelectorAll(".calendar-view-toggle__btn").forEach((btn) => {
    btn.classList.toggle("calendar-view-toggle__btn--active", btn.dataset.calView === view);
  });
  renderCalendar();
}

function calendarNavigate(delta) {
  if (state.calendarView === "year") {
    state.calendarYear += delta;
  } else if (state.calendarView === "month") {
    state.calendarMonth += delta;
    if (state.calendarMonth > 11) {
      state.calendarMonth = 0;
      state.calendarYear++;
    } else if (state.calendarMonth < 0) {
      state.calendarMonth = 11;
      state.calendarYear--;
    }
  } else {
    const base = state.selectedCalendarDay || todayIso();
    const d = new Date(base + "T12:00:00");
    d.setDate(d.getDate() + delta);
    state.selectedCalendarDay = isoFromParts(d.getFullYear(), d.getMonth(), d.getDate());
    state.calendarYear = d.getFullYear();
    state.calendarMonth = d.getMonth();
  }
  renderCalendar();
}

function renderMonthCalendar() {
  const y = state.calendarYear;
  const m = state.calendarMonth;
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;
  const today = todayIso();
  const weekdays = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];

  let cells = "";
  for (let i = 0; i < startPad; i++) {
    cells += '<span class="calendar-day calendar-day--empty"></span>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoFromParts(y, m, d);
    const km = getKmForDate(iso);
    const selected = iso === state.selectedCalendarDay;
    const isToday = iso === today;
    const dot = qualifiesGreenDot(km) ? '<span class="calendar-day__dot" aria-hidden="true"></span>' : "";
    cells += `<button type="button" class="calendar-day${selected ? " calendar-day--selected" : ""}${isToday ? " calendar-day--today" : ""}" data-date="${iso}">${d}${dot}</button>`;
  }

  document.getElementById("cal-nav-title").textContent = first.toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });

  return `
    <div class="calendar-weekdays">${weekdays.map((w) => `<span>${w}</span>`).join("")}</div>
    <div class="calendar-grid">${cells}</div>`;
}

function renderYearCalendar() {
  const y = state.calendarYear;
  const months = Array.from({ length: 12 }, (_, mi) => {
    const prefix = isoFromParts(y, mi, 1).slice(0, 7);
    const entries = state.history.filter((h) => h.date.startsWith(prefix));
    const totalKm = entries.reduce((s, h) => s + h.km, 0);
    const greenDays = entries.filter((h) => qualifiesGreenDot(h.km)).length;
    const name = new Date(y, mi, 1).toLocaleDateString("sk-SK", { month: "short" });
    const active = mi === state.calendarMonth ? " calendar-year-month--active" : "";
    return `<button type="button" class="calendar-year-month${active}" data-month="${mi}">
      <span class="calendar-year-month__name">${name}</span>
      <span class="calendar-year-month__meta">${totalKm.toFixed(0)} km · ${greenDays} dní ●</span>
    </button>`;
  });

  document.getElementById("cal-nav-title").textContent = String(y);
  return `<div class="calendar-year-grid">${months.join("")}</div>`;
}

function renderDayCalendar() {
  const iso = state.selectedCalendarDay || todayIso();
  const km = getKmForDate(iso);
  const d = new Date(iso + "T12:00:00");

  document.getElementById("cal-nav-title").textContent = d.toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (km == null) {
    return `<div class="calendar-day-view"><p class="calendar-day-view__sub">Žiadne údaje o chôdzi.</p></div>`;
  }

  return `
    <div class="calendar-day-view">
      <div class="calendar-day-view__km">${km.toFixed(1)} km</div>
      <p class="calendar-day-view__sub">${formatPointsShort(getPointsForKm(km))}${qualifiesGreenDot(km) ? " · zelená bodka" : ""}</p>
    </div>`;
}

function renderCalendar() {
  syncTodayToHistory();
  if (!state.selectedCalendarDay) state.selectedCalendarDay = todayIso();

  const body = document.getElementById("calendar-body");
  if (!body) return;

  if (state.calendarView === "year") {
    body.innerHTML = renderYearCalendar();
  } else if (state.calendarView === "day") {
    body.innerHTML = renderDayCalendar();
  } else {
    body.innerHTML = renderMonthCalendar();
  }

  updateCalendarDayDetail(state.selectedCalendarDay);
}

function onCalendarBodyClick(e) {
  const dayBtn = e.target.closest("[data-date]");
  if (dayBtn) {
    state.selectedCalendarDay = dayBtn.dataset.date;
    renderCalendar();
    return;
  }
  const monthBtn = e.target.closest("[data-month]");
  if (monthBtn) {
    state.calendarMonth = Number(monthBtn.dataset.month);
    state.calendarView = "month";
    setCalendarView("month");
  }
}

function openCalendarModal() {
  syncTodayToHistory();
  if (!state.selectedCalendarDay) state.selectedCalendarDay = todayIso();
  renderCalendar();
  const modal = document.getElementById("calendar-modal");
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCalendarModal() {
  document.getElementById("calendar-modal").hidden = true;
  document.body.style.overflow = "";
}

function isCalendarOpen() {
  const modal = document.getElementById("calendar-modal");
  return modal && !modal.hidden;
}

function updateRing() {
  const step = state.goalKm;
  const km = state.kmToday;
  const pointsToday = getPointsForKm(km);
  const len = getTrackPathLength();

  const tier1Pct = step > 0 ? Math.min(km / step, 1) : 0;
  const tier2Pct = km > step && step > 0 ? Math.min((km - step) / step, 1) : 0;
  const tier3Pct = km > step * 2 && step > 0 ? Math.min((km - step * 2) / step, 1) : 0;

  setRingTier("ring-progress-1", tier1Pct, len);
  setRingTier("ring-progress-2", tier2Pct, len);
  setRingTier("ring-progress-3", tier3Pct, len);

  document.getElementById("km-today").textContent = km.toFixed(1);

  const status = document.getElementById("goal-status");

  const maxPts = getMaxPointsPerDay();
  if (pointsToday >= maxPts) {
    status.textContent = `Maximum ${maxPts} body za dnes!`;
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

function dayAbbrSk(iso) {
  const d = new Date(iso + "T12:00:00");
  const abbr = d.toLocaleDateString("sk-SK", { weekday: "short" }).replace(".", "");
  return abbr.slice(0, 2).toUpperCase();
}

function renderTickets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayIso();

  const totalPoints = getMonthDailyPoints().reduce((s, d) => s + d.points, 0);

  document.getElementById("tickets-month").textContent = now.toLocaleDateString(
    "sk-SK",
    { month: "long", year: "numeric" }
  );
  document.getElementById("tickets-count").textContent = String(totalPoints);
  document.getElementById("tickets-count-label").textContent = pluralBody(totalPoints);

  let cells = "";
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoFromParts(y, m, d);
    const km = getKmForDate(iso);
    const pts = km != null ? getPointsForKm(km) : 0;
    const ptsTier = pts >= 3 ? 3 : pts >= 2 ? 2 : pts >= 1 ? 1 : 0;
    const ptsClass = ptsTier ? ` points-cell--p${ptsTier}` : "";
    const todayClass = iso === today ? " points-cell--today" : "";
    const kmText = km != null ? `${km.toFixed(1)} km` : "— km";

    cells += `
      <div class="points-cell${ptsClass}${todayClass}" title="${d}. ${formatShortSk(iso)}">
        <span class="points-cell__wd">${dayAbbrSk(iso)}</span>
        <span class="points-cell__pts-big">${pts}</span>
        <span class="points-cell__km-sm">${kmText}</span>
      </div>`;
  }

  document.getElementById("ticket-list").innerHTML = `<div class="points-month-grid">${cells}</div>`;
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
  const s =
    typeof ChodzaSettings !== "undefined"
      ? ChodzaSettings.read(currentMonthKey())
      : { goalKmPerPoint: ADMIN_GOAL_KM, maxPointsPerDay: DEFAULT_MAX_POINTS_PER_DAY };

  if (s.goalKmPerPoint >= 1 && s.goalKmPerPoint <= 50) state.goalKm = s.goalKmPerPoint;
  else state.goalKm = ADMIN_GOAL_KM;

  if (s.maxPointsPerDay >= 1 && s.maxPointsPerDay <= 10) state.maxPointsPerDay = s.maxPointsPerDay;
  else state.maxPointsPerDay = DEFAULT_MAX_POINTS_PER_DAY;

  updateAdminGoalUi();
}

function updateAdminGoalUi() {
  const km = state.goalKm;
  const maxPts = getMaxPointsPerDay();

  const el = document.getElementById("display-goal");
  if (el) el.textContent = `${km} km = 1 bod`;

  const maxEl = document.getElementById("display-goal-max");
  if (maxEl) maxEl.textContent = `max ${maxPts} ${maxPts === 1 ? "bod" : maxPts < 5 ? "body" : "bodov"} / deň`;

  const hint = document.getElementById("hint-km-per-point");
  if (hint) hint.textContent = String(km);

  const hintMax = document.getElementById("hint-max-points");
  if (hintMax) hintMax.textContent = String(maxPts);

  const calHint = document.getElementById("calendar-goal-hint");
  if (calHint) {
    calHint.textContent = `Klikni a pozri si km po dňoch · zelená bodka = aspoň ${km} km`;
  }
}

function refreshAfterAdminSettings() {
  loadAdminGoal();
  rebuildDailyPointsFromHistory();
  syncTodayToHistory();
  updateRing();
  renderTickets();
  if (state.calendarView) renderCalendar();
}

function loadWinnersFromAdmin() {
  try {
    const raw = localStorage.getItem("chodza-winners-by-month");
    if (!raw) return;
    const map = JSON.parse(raw);
    Object.assign(state.winnersByMonth, map);
  } catch (_) {}
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
  const { revenueSplit } = PRIZE_CONFIG;
  const smallTotal = revenue * revenueSplit.small;
  return {
    payingUsers,
    priceMonthly,
    revenue,
    ownerAmount: revenue * PRIZE_CONFIG.ownerShare,
    poolAmount: revenue * (1 - PRIZE_CONFIG.ownerShare),
    firstPrize: revenue * revenueSplit.first,
    secondPrize: revenue * revenueSplit.second,
    thirdPrize: revenue * revenueSplit.third,
    smallPrizeEach: smallTotal / PRIZE_CONFIG.smallCount,
    totalWinners: PRIZE_CONFIG.mainCount + PRIZE_CONFIG.smallCount,
  };
}

/** Admin nastaví mesačný kôš priamo v € (100 % sumy na výhry) */
function calculatePrizeFromManualPool(poolEur) {
  const pool = Number(poolEur) || 0;
  const { manualPoolSplit, smallCount } = PRIZE_CONFIG;
  const smallTotal = pool * manualPoolSplit.small;
  return {
    manualPoolEur: pool,
    poolAmount: pool,
    ownerAmount: 0,
    firstPrize: pool * manualPoolSplit.first,
    secondPrize: pool * manualPoolSplit.second,
    thirdPrize: pool * manualPoolSplit.third,
    smallPrizeEach: smallTotal / smallCount,
    totalWinners: PRIZE_CONFIG.mainCount + smallCount,
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

function generateDemoSmallNicks(count, seed) {
  const bases = ["Chodec", "Krok", "Walk", "Fit", "Syn", "Bod", "Km", "Pešiak"];
  return Array.from({ length: count }, (_, i) => ({
    nick: `${bases[i % bases.length]}_${seed}_${String(i + 1).padStart(2, "0")}`,
  }));
}

function seedDemoWinners() {
  loadWinnersFromAdmin();
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
    small: generateDemoSmallNicks(97, prevSeed),
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
    small: generateDemoSmallNicks(97, twoBack.replace("-", "")),
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
          ? "Žrebovanie pre tento mesiac ešte neprebehlo. Po skončení mesiaca sa vyžrebujú 3 hlavné a 97 menších cien."
          : "Pre tento mesiac zatiaľ nie sú zverejnení výhercovia."}
      </div>`;
    hint.hidden = false;
    return;
  }

  const b =
    draw.manualPoolEur != null
      ? calculatePrizeFromManualPool(draw.manualPoolEur)
      : calculatePrizeBreakdown(draw.payingUsers, draw.priceMonthly ?? PRIZE_CONFIG.priceMonthly);
  const mainPrizes = [b.firstPrize, b.secondPrize, b.thirdPrize];
  const collapsedClass = smallWinnersExpanded ? "" : " winners-list--collapsed";
  const toggleLabel = smallWinnersExpanded ? "Zbaliť zoznam" : `Zobraziť všetkých (${draw.small.length})`;

  container.innerHTML = `
    <div class="winners-status">
      ${formatMonthKey(month)} – ${b.totalWinners} výhercov (3 hlavné + ${PRIZE_CONFIG.smallCount} menších)
    </div>
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

  if (name === "home" || name === "tickets" || name === "profile") {
    refreshAfterAdminSettings();
  }

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
  if (isCalendarOpen()) renderCalendar();
  updatePeriodStats();

  const today = todayIso();
  upsertDailyPoint(today, state.kmToday);
  renderTickets();

  const btn = document.getElementById("sync-btn");
  btn.textContent = "Aktualizované ✓";
  setTimeout(() => {
    btn.textContent = "Aktualizovať km";
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

function applySettingsFromUrl() {
  if (typeof ChodzaSettings === "undefined") return;

  ChodzaSettings.importBridge(currentMonthKey());

  const p = new URLSearchParams(location.search);
  if (p.has("goalKm") || p.has("maxPoints")) {
    const cur = ChodzaSettings.read(currentMonthKey());
    const payload = { ...cur };
    if (p.has("goalKm")) {
      const g = Number(p.get("goalKm"));
      if (g >= 1 && g <= 50) payload.goalKmPerPoint = g;
    }
    if (p.has("maxPoints")) {
      const m = Number(p.get("maxPoints"));
      if (m >= 1 && m <= 10) payload.maxPointsPerDay = m;
    }
    ChodzaSettings.write(currentMonthKey(), payload);
  }

  const hash = ChodzaSettings.encodeHash(ChodzaSettings.read(currentMonthKey()));
  history.replaceState({}, "", `index.html${hash}`);
}

function init() {
  applySettingsFromUrl();
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
  state.selectedCalendarDay = todayIso();
  updatePeriodStats();
  startDrawCountdown();

  window.addEventListener("storage", (e) => {
    if (
      e.key === "chodza-admin-goal" ||
      e.key === "chodza-active-settings" ||
      (e.key && e.key.startsWith("chodza-month-settings-"))
    ) {
      refreshAfterAdminSettings();
    }
  });
  window.addEventListener("chodza-settings-changed", () => refreshAfterAdminSettings());
  window.addEventListener("hashchange", () => {
    if (typeof ChodzaSettings !== "undefined") ChodzaSettings.importBridge(currentMonthKey());
    refreshAfterAdminSettings();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (typeof ChodzaSettings !== "undefined") ChodzaSettings.importBridge(currentMonthKey());
      refreshAfterAdminSettings();
    }
  });
  window.addEventListener("focus", () => {
    if (typeof ChodzaSettings !== "undefined") ChodzaSettings.importBridge(currentMonthKey());
    refreshAfterAdminSettings();
  });
  window.addEventListener("pageshow", () => refreshAfterAdminSettings());

  document.getElementById("calendar-open-btn")?.addEventListener("click", openCalendarModal);
  document.getElementById("calendar-close-btn")?.addEventListener("click", closeCalendarModal);
  document.getElementById("calendar-backdrop")?.addEventListener("click", closeCalendarModal);
  document.getElementById("calendar-body")?.addEventListener("click", onCalendarBodyClick);
  document.getElementById("cal-prev")?.addEventListener("click", () => calendarNavigate(-1));
  document.getElementById("cal-next")?.addEventListener("click", () => calendarNavigate(1));
  document.getElementById("cal-view-year")?.addEventListener("click", () => setCalendarView("year"));
  document.getElementById("cal-view-month")?.addEventListener("click", () => setCalendarView("month"));
  document.getElementById("cal-view-day")?.addEventListener("click", () => setCalendarView("day"));

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
