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

function t(key, params) {
  return typeof ChodzaI18n !== "undefined" ? ChodzaI18n.t(key, params) : key;
}

function loc() {
  return typeof ChodzaI18n !== "undefined" ? ChodzaI18n.getLocale() : "sk-SK";
}

function subscriptionPriceFmt() {
  return typeof ChodzaI18n !== "undefined" ? ChodzaI18n.formatPrice() : "4,99 €";
}

let activePanel = "home";

/** Výpočet výhier (podiel na odmeny nie je v UI zobrazený) */
const PRIZE_CONFIG = {
  priceMonthly: typeof ChodzaI18n !== "undefined" ? ChodzaI18n.SUBSCRIPTION_PRICE : 4.99,
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
  subscriptionPlan: "free",
  winnersByMonth: {},
  selectedWinnerMonth: null,
};

const MEDALS = ["🥇", "🥈", "🥉"];

function formatDateSk(d) {
  return d.toLocaleDateString(loc(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatShortSk(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(loc(), { day: "numeric", month: "short" });
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
  return d.toLocaleDateString(loc(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function pluralUnit(n) {
  if (n === 1) return t("countdown.day");
  if (ChodzaI18n?.getLang() === "en") return t("countdown.days");
  if (n >= 2 && n <= 4) return t("countdown.days2");
  return t("countdown.days");
}

function updateDrawCountdown() {
  const deadline = getDrawDeadline();
  const now = new Date();
  let diff = deadline - now;

  const box = document.getElementById("draw-countdown");
  const whenEl = document.getElementById("draw-countdown-when");
  const labelEl = box?.querySelector(".draw-countdown__label");

  if (!box || !whenEl) return;

  whenEl.textContent = t("countdown.on", { date: formatDrawDate(deadline) });

  if (diff <= 0) {
    box.classList.add("draw-countdown--today");
    if (labelEl) labelEl.textContent = t("countdown.today");
    document.getElementById("cd-days").textContent = "0";
    document.getElementById("cd-hours").textContent = "0";
    document.getElementById("cd-mins").textContent = "0";
    document.getElementById("cd-secs").textContent = "0";
    return;
  }

  box.classList.remove("draw-countdown--today");
  if (labelEl) labelEl.textContent = t("countdown.until");

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
  if (daysName) daysName.textContent = pluralUnit(days);

  document.querySelectorAll("#draw-countdown .draw-countdown__name").forEach((el, i) => {
    if (i === 0) return;
    const keys = ["countdown.hour", "countdown.min", "countdown.sec"];
    if (keys[i - 1]) el.textContent = t(keys[i - 1]);
  });
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

function computeGoalStreakDays() {
  const sorted = getHistorySorted();
  if (!sorted.length) return 0;
  let streak = 0;
  // počítame od dneška dozadu, len po sebe idúce dni splneného cieľa
  let expected = todayIso();
  for (const h of sorted) {
    if (h.date !== expected) break;
    if (!qualifiesGreenDot(h.km)) break;
    streak += 1;
    expected = addDays(expected, -1);
  }
  return streak;
}

function updateHomeTopbar() {
  const user = typeof ChodzaAuth !== "undefined" ? ChodzaAuth.getCurrentUser() : null;
  const av = document.getElementById("home-avatar");
  const hello = document.getElementById("home-hello");
  const level = document.getElementById("home-level");
  const city = document.getElementById("home-city");
  const streak = document.getElementById("home-streak");

  if (av && user) {
    const url = user.avatarUrl || user.avatarDataUrl;
    if (url) {
      av.classList.add("has-photo");
      av.style.backgroundImage = `url("${url}")`;
      av.textContent = "";
    } else {
      av.classList.remove("has-photo");
      av.style.backgroundImage = "";
      av.textContent = ChodzaAuth.avatarLetter(user);
    }
  }
  if (hello && user) hello.textContent = ChodzaAuth.displayName(user);
  if (city && user) city.textContent = user.city || "—";

  // jednoduchý level: 1 + celkové body / 50 (z reálnej histórie, zhodné so sekciou Moje body)
  const totalPts = getTotalPointsAllTime();
  const lvl = 1 + Math.floor(totalPts / POINTS_PER_LEVEL);
  if (level) level.textContent = `Level ${lvl}`;
  if (av) av.dataset.level = String(lvl);

  if (streak) streak.textContent = String(computeGoalStreakDays());
}

function updateHomeHeroCards() {
  const streakHero = document.getElementById("home-streak-hero");
  if (streakHero) streakHero.textContent = String(computeGoalStreakDays());
}

function weekdayMonIndex(d = new Date()) {
  // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
  return (d.getDay() + 6) % 7;
}

function updateWeeklyBars() {
  const todayIdx = weekdayMonIndex(new Date());
  const cols = Array.from(document.querySelectorAll(".weekly-bars__col[data-weekday]"));

  // Star over the weekday with the most km (week-to-date)
  let starIdx = -1;
  try {
    const week = getPeriodHistory("week") || [];
    let bestKm = -1;
    for (const h of week) {
      const d = new Date(`${h.date}T12:00:00`);
      const idx = weekdayMonIndex(d);
      const km = Number(h.km || 0);
      if (km > bestKm) {
        bestKm = km;
        starIdx = idx;
      }
    }
  } catch (_) {}

  cols.forEach((col) => {
    const idx = Number(col.getAttribute("data-weekday"));
    col.classList.toggle("weekly-bars__col--on", idx <= todayIdx);
    col.classList.toggle("weekly-bars__col--today", idx === todayIdx);
    col.classList.toggle("weekly-bars__col--star", idx === starIdx);
  });
}

function dayLabel(iso) {
  const today = todayIso();
  const yesterday = addDays(today, -1);
  if (iso === today) return t("day.today");
  if (iso === yesterday) return t("day.yesterday");
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(loc(), { weekday: "long" });
}

function getUserPlan() {
  if (typeof ChodzaPlans !== "undefined") {
    return ChodzaPlans.normalizePlan(state.subscriptionPlan || (state.premium ? "plus" : "free"));
  }
  return state.subscriptionPlan || (state.premium ? "plus" : "free");
}

function getPointsForKm(km) {
  const step = state.goalKm;
  if (!step || step <= 0) return 0;
  if (typeof ChodzaPlans !== "undefined") {
    return ChodzaPlans.computePointsForKm(km, step, getMaxPointsPerDay(), getUserPlan());
  }
  return Math.min(getMaxPointsPerDay(), Math.floor(km / step));
}

function applyPlanTheme() {
  const plan = getUserPlan();
  document.documentElement.dataset.plan = plan;
}

function updatePlanNotice() {
  const freeNotice = document.getElementById("plan-free-notice");
  const plusNotice = document.getElementById("plan-plus-notice");
  const plan = getUserPlan();
  if (freeNotice) freeNotice.hidden = plan !== "free";
  if (plusNotice) plusNotice.hidden = plan !== "premium";
}

const PLAN_RANK = { free: 0, plus: 1, premium: 2 };

function requestPlanChange(planId) {
  const user = typeof ChodzaAuth !== "undefined" ? ChodzaAuth.getCurrentUser() : null;
  if (!user) return;

  const plan =
    typeof ChodzaPlans !== "undefined" ? ChodzaPlans.normalizePlan(planId) : planId;
  const current = getUserPlan();
  if (plan === current) return;

  const isEn = ChodzaI18n?.getLang() === "en";
  const next = getPlanDisplayInfo(plan);
  let msg;

  if (plan === "free") {
    msg = isEn
      ? `Switch to Free (0 €)? You will leave the monthly draw.\n\n(Demo – no payment.)`
      : `Prejsť na Free (0 €)? Ukončíš účasť v mesačnom žrebovaní.\n\n(Demo – bez platby.)`;
  } else if ((PLAN_RANK[plan] ?? 0) > (PLAN_RANK[current] ?? 0)) {
    msg = isEn
      ? `Upgrade to ${next.summary}?\n\n(Demo – plan changes immediately.)`
      : `Navýšiť na ${next.summary}?\n\n(Demo – balík sa zmení hneď.)`;
  } else {
    msg = isEn
      ? `Change plan to ${next.summary}?\n\n(Demo – plan changes immediately.)`
      : `Zmeniť balík na ${next.summary}?\n\n(Demo – balík sa zmení hneď.)`;
  }

  if (!confirm(msg)) return;

  const res = ChodzaAuth.updateProfile(user.email, { subscriptionPlan: plan });
  if (!res.ok) return;

  applyUserProfile();
  rebuildDailyPointsFromHistory();
  updateRing();
  renderTickets();
  updatePeriodStats();
  if (isCalendarOpen()) renderCalendar();
}

function formatPointsShort(n) {
  if (n === 0) return t("points.zero");
  if (n === 1) return t("points.one");
  if (ChodzaI18n?.getLang() === "en") return t("points.many", { n });
  if (n >= 2 && n <= 4) return t("points.few", { n });
  return t("points.many", { n });
}

function updateCalendarDayDetail(iso) {
  const box = document.getElementById("calendar-day-detail");
  if (!box || !iso) return;

  const km = getKmForDate(iso);
  const d = new Date(iso + "T12:00:00");
  const title = d.toLocaleDateString(loc(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (km == null) {
    box.innerHTML = `
      <p class="calendar-day-detail__title">${title}</p>
      <p class="calendar-day-detail__meta">${t("calendar.noData")}</p>`;
    return;
  }

  const pts = getPointsForKm(km);
  const dotNote = qualifiesGreenDot(km)
    ? t("calendar.goalMet")
    : t("calendar.kmToGreen", { km: Math.max(0, state.goalKm - km).toFixed(1) });

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
  const weekdays =
    typeof ChodzaI18n !== "undefined" ? ChodzaI18n.getWeekdays() : ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];

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
    const kmText = km != null && km > 0 ? `<span class="calendar-day__km" aria-hidden="true">${km.toFixed(1)}</span>` : "";
    cells += `<button type="button" class="calendar-day${selected ? " calendar-day--selected" : ""}${isToday ? " calendar-day--today" : ""}" data-date="${iso}"><span class="calendar-day__num">${d}</span>${kmText}${dot}</button>`;
  }

  document.getElementById("cal-nav-title").textContent = first.toLocaleDateString(loc(), {
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
    const name = new Date(y, mi, 1).toLocaleDateString(loc(), { month: "short" });
    const active = mi === state.calendarMonth ? " calendar-year-month--active" : "";
    return `<button type="button" class="calendar-year-month${active}" data-month="${mi}">
      <span class="calendar-year-month__name">${name}</span>
      <span class="calendar-year-month__meta">${t("calendar.yearMeta", { km: totalKm.toFixed(0), days: greenDays })}</span>
    </button>`;
  });

  document.getElementById("cal-nav-title").textContent = String(y);
  return `<div class="calendar-year-grid">${months.join("")}</div>`;
}

function renderDayCalendar() {
  const iso = state.selectedCalendarDay || todayIso();
  const km = getKmForDate(iso);
  const d = new Date(iso + "T12:00:00");

  document.getElementById("cal-nav-title").textContent = d.toLocaleDateString(loc(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (km == null) {
    return `<div class="calendar-day-view"><p class="calendar-day-view__sub">${t("calendar.noData")}</p></div>`;
  }

  return `
    <div class="calendar-day-view">
      <div class="calendar-day-view__km">${km.toFixed(1)} km</div>
      <p class="calendar-day-view__sub">${formatPointsShort(getPointsForKm(km))}${qualifiesGreenDot(km) ? t("calendar.greenDot") : ""}</p>
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
  const len = getTrackPathLength();

  const tier1Pct = step > 0 ? Math.min(km / step, 1) : 0;
  const tier2Pct = km > step && step > 0 ? Math.min((km - step) / step, 1) : 0;
  const tier3Pct = km > step * 2 && step > 0 ? Math.min((km - step * 2) / step, 1) : 0;

  setRingTier("ring-progress-1", tier1Pct, len);
  setRingTier("ring-progress-2", tier2Pct, len);
  setRingTier("ring-progress-3", tier3Pct, len);

  document.getElementById("km-today").textContent = km.toFixed(1);

  const goalKm = document.getElementById("goal-km");
  if (goalKm) goalKm.textContent = `${Number(step || 0).toFixed(0)} km`;

  const check = document.getElementById("ring-check");
  if (check) check.classList.toggle("ring__check--active", qualifiesGreenDot(km));
}

function pluralBody(n) {
  if (n === 1) return t("tickets.labelMonth");
  if (ChodzaI18n?.getLang() === "en") return t("tickets.labelMonthMany");
  if (n >= 2 && n <= 4) return t("tickets.labelMonths");
  return t("tickets.labelMonthMany");
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
  const abbr = d.toLocaleDateString(loc(), { weekday: "short" }).replace(".", "");
  return abbr.slice(0, 2).toUpperCase();
}

const POINTS_PER_LEVEL = 50;

function achLang(sk, en) {
  return typeof ChodzaI18n !== "undefined" && ChodzaI18n.getLang && ChodzaI18n.getLang() === "en"
    ? en
    : sk;
}

function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function getTotalPointsAllTime() {
  return state.history.reduce((s, h) => s + getPointsForKm(h.km), 0);
}

function computeLongestGoalStreak() {
  const days = state.history
    .filter((h) => qualifiesGreenDot(h.km))
    .map((h) => h.date)
    .sort();
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const date of days) {
    if (prev && addDays(prev, 1) === date) cur += 1;
    else cur = 1;
    if (cur > best) best = cur;
    prev = date;
  }
  return best;
}

function computeAchievementStats() {
  const totalKm = state.history.reduce((s, h) => s + Number(h.km || 0), 0);
  const activeDays = state.history.filter((h) => Number(h.km || 0) > 0).length;
  const goalDays = state.history.filter((h) => qualifiesGreenDot(h.km)).length;
  const bestDayKm = state.history.reduce((mx, h) => Math.max(mx, Number(h.km || 0)), 0);
  const totalPoints = getTotalPointsAllTime();
  const currentStreak = computeGoalStreakDays();
  const longestStreak = computeLongestGoalStreak();
  const week = getPeriodHistory("week");
  const weekKm = week.reduce((s, h) => s + Number(h.km || 0), 0);
  const weekendKm = week.reduce((sum, h) => {
    const wd = weekdayMonIndex(new Date(`${h.date}T12:00:00`));
    return wd >= 5 ? sum + Number(h.km || 0) : sum; // 5=sobota, 6=nedeľa
  }, 0);
  const month = getPeriodHistory("month");
  const monthKm = month.reduce((s, h) => s + Number(h.km || 0), 0);
  const monthGoalDays = month.filter((h) => qualifiesGreenDot(h.km)).length;
  return {
    totalKm,
    activeDays,
    goalDays,
    bestDayKm,
    totalPoints,
    currentStreak,
    longestStreak,
    weekKm,
    weekendKm,
    monthKm,
    monthGoalDays,
  };
}

function renderChallenges(s) {
  const host = document.getElementById("ach-challenges");
  if (!host) return;

  // Opakovateľné, časovo ohraničené výzvy – plnia sa automaticky (žiadne "Prijať").
  // Žiadne série (tie sú v odznakoch), len vzdialenosť/počet v okne týždeň/mesiac.
  const kmFmt = (v) => v.toFixed(1);
  const numFmt = (v) => String(v);
  const items = [
    {
      icon: "🏃",
      title: achLang("Týždenný nájazd", "Weekly distance"),
      note: achLang("tento týždeň", "this week"),
      cur: s.weekKm,
      max: 50,
      unit: "km",
      fmt: kmFmt,
    },
    {
      icon: "⛰️",
      title: achLang("Víkendový bojovník", "Weekend warrior"),
      note: achLang("sobota + nedeľa", "Sat + Sun"),
      cur: s.weekendKm,
      max: 30,
      unit: "km",
      fmt: kmFmt,
    },
    {
      icon: "🎯",
      title: achLang("Mesačné ciele", "Monthly goals"),
      note: achLang("splnené dni v mesiaci", "goal days this month"),
      cur: s.monthGoalDays,
      max: 20,
      unit: achLang("dní", "days"),
      fmt: numFmt,
    },
    {
      icon: "🥾",
      title: achLang("Mesačný nájazd", "Monthly distance"),
      note: achLang("tento mesiac", "this month"),
      cur: s.monthKm,
      max: 150,
      unit: "km",
      fmt: kmFmt,
    },
  ];

  // splnené navrch, potom podľa blízkosti k cieľu
  const withMeta = items.map((c) => {
    const pct = c.max > 0 ? Math.min(100, Math.round((c.cur / c.max) * 100)) : 0;
    return { ...c, pct, done: c.cur >= c.max };
  });
  withMeta.sort((a, b) => {
    if (a.done !== b.done) return a.done ? -1 : 1;
    return b.pct - a.pct;
  });

  host.innerHTML = withMeta
    .map(
      (c) => `
        <div class="challenge${c.done ? " challenge--done" : ""}">
          <div class="challenge__head">
            <span class="challenge__icon">${c.icon}</span>
            <span class="challenge__title">${c.title}<span class="challenge__note">${c.note}</span></span>
            <span class="challenge__val">${c.fmt(c.cur)} / ${c.max} ${c.unit}${c.done ? " ✓" : ""}</span>
          </div>
          <div class="challenge__bar"><span class="challenge__fill" style="width:${c.pct}%"></span></div>
        </div>`
    )
    .join("");

  const doneCount = withMeta.filter((c) => c.done).length;
  setTextById(
    "ach-challenges-sub",
    achLang(`${doneCount} / ${withMeta.length} splnených`, `${doneCount} / ${withMeta.length} done`)
  );
}

function renderBadges(s) {
  const host = document.getElementById("ach-badges");
  if (!host) return;

  const items = [
    {
      img: "step-shoe",
      title: achLang("Prvé kroky", "First steps"),
      desc: achLang("Zaznamenaj prvý deň", "Log your first day"),
      done: s.activeDays >= 1,
      fact: achLang(
        "Každá veľká cesta začína prvým krokom – a ty si ho práve spravil! Už len pravidelná chôdza dokáže zlepšiť náladu, spánok aj sústredenie. Väčšina ľudí to nikdy nezačne, ty áno. Drž sa, najťažší býva práve ten prvý deň.",
        "Every great journey begins with a single step – and you just took it! Regular walking alone can boost your mood, sleep and focus. Most people never even start; you did. Keep going – the first day is the hardest."
      ),
    },
    {
      img: "star",
      title: achLang("Stovkár", "Centurion"),
      desc: achLang("Získaj 100 bodov", "Earn 100 points"),
      done: s.totalPoints >= 100,
      fact: achLang(
        "100 bodov je veľká méta! Väčšina ľudí to s novým návykom vzdá už v prvom týždni, ty si vydržal a zbieraš ďalej. Každý bod znamená reálne prejdené kilometre, lepšiu kondíciu a silnejšie srdce. Si dôkaz, že disciplína sa vypláca.",
        "100 points is a big milestone! Most people drop a new habit within the first week – you stuck with it and keep collecting. Every point means real kilometres walked, better fitness and a stronger heart. You're proof that consistency pays off."
      ),
    },
    {
      img: "club100",
      title: achLang("Klub 100 km", "100 km club"),
      desc: achLang("Prejdi spolu 100 km", "Walk 100 km total"),
      done: s.totalKm >= 100,
      fact: achLang(
        "100 km pešo – to je ako prejsť z Bratislavy do Trnavy a späť, len pomocou vlastných nôh! Pri takomto objeme chôdze telo spáli tisíce kalórií a výrazne sa zlepší vytrvalosť. Tvoje srdce, kĺby aj hlava ti za to ďakujú. A toto je len začiatok – ďalšia méta je 500 km.",
        "100 km on foot – that's like walking from one city to the next and back, all on your own legs! That much walking burns thousands of calories and noticeably boosts stamina. Your heart, joints and mind all thank you. And this is just the start – the next milestone is 500 km."
      ),
    },
    {
      img: "club500",
      title: achLang("Klub 500 km", "500 km club"),
      desc: achLang("Prejdi spolu 500 km", "Walk 500 km total"),
      done: s.totalKm >= 500,
      fact: achLang(
        "500 km – to je vzdialenosť skoro cez celé Slovensko! Štúdie ukazujú, že pravidelná chôdza dokáže znížiť riziko ochorení srdca a cukrovky až o tretinu. Pri takomto nálete kilometrov si si vybudoval kondíciu, o akej väčšina ľudí len sníva. Polovica cesty do tisíckového klubu je za tebou.",
        "500 km – almost the length of an entire country! Studies show regular walking can cut the risk of heart disease and diabetes by up to a third. With this many kilometres you've built fitness most people only dream of. You're halfway to the 1000 km club."
      ),
    },
    {
      img: "club1000",
      title: achLang("Klub 1000 km", "1000 km club"),
      desc: achLang("Prejdi spolu 1000 km", "Walk 1000 km total"),
      done: s.totalKm >= 1000,
      fact: achLang(
        "1000 km! To je vzdialenosť z Bratislavy do Paríža – a ty si ju prešiel po vlastných! Patríš do chodeckej elity, ktorú dosiahne naozaj len málokto. Tvoje telo je teraz odolnejšie, srdce silnejšie a myseľ otužilejšia. Toto už nie je len návyk, toto je životný štýl šampióna.",
        "1000 km! That's the distance from Bratislava to Paris – and you walked it on your own two feet! You belong to a walking elite very few ever reach. Your body is now more resilient, your heart stronger and your mind tougher. This isn't just a habit anymore – it's a champion's lifestyle."
      ),
    },
    {
      img: "marathon",
      title: achLang("Maratónec", "Marathoner"),
      desc: achLang("42 km za jeden deň", "42 km in one day"),
      done: s.bestDayKm >= 42,
      fact: achLang(
        "42 km za jediný deň – to je dĺžka klasického maratónu, ktorý zvládne len malé percento ľudí na svete! Takýto výkon si vyžaduje pevnú vôľu a výbornú kondíciu. Telo pri ňom prekoná hranice, o ktorých väčšina ani nesníva. Buď na seba poriadne hrdý – toto je métla šampiónov.",
        "42 km in a single day – that's the length of a full marathon, something only a small percentage of people worldwide ever achieve! Such a feat takes real willpower and excellent fitness. Your body pushed past limits most people never imagine. Be truly proud – this is a champion's mark."
      ),
    },
    {
      img: "week",
      title: achLang("Týždeň v kuse", "Full week"),
      desc: achLang("7-dňová séria cieľov", "7-day goal streak"),
      done: s.longestStreak >= 7,
      fact: achLang(
        "7 dní v rade je presne ten moment, keď sa z odhodlania začína stávať návyk! Mozog si vytvára nové spojenia a pohyb sa pomaly mení na automatickú súčasť dňa. Hovorí sa, že vytrvalosť nakoniec poráža aj talent. Vydrž ďalej – ďalšou métou je celý mesiac.",
        "7 days in a row is exactly when determination starts turning into a habit! Your brain forms new connections and movement slowly becomes an automatic part of your day. They say consistency beats talent in the long run. Keep going – the next milestone is a full month."
      ),
    },
    {
      img: "endurance",
      title: achLang("Vytrvalec", "Endurance"),
      desc: achLang("30 aktívnych dní", "30 active days"),
      done: s.activeDays >= 30,
      fact: achLang(
        "30 aktívnych dní! Pohyb sa ti stal prirodzenou súčasťou života – a presne takto vznikajú zdravé návyky na celý život. Pravidelná aktivita znižuje stres, zlepšuje spánok a dodáva energiu na celý deň. Už nemusíš premýšľať, či ísť von – jednoducho ideš. To je obrovský posun, ktorý ti môže každý závidieť.",
        "30 active days! Movement has become a natural part of your life – and that's exactly how lifelong healthy habits are born. Regular activity lowers stress, improves sleep and gives you all‑day energy. You no longer debate whether to go out – you just go. That's a huge shift many people would envy."
      ),
    },
    {
      img: "month",
      title: achLang("Mesačný bojovník", "Month warrior"),
      desc: achLang("30-dňová séria cieľov", "30-day goal streak"),
      done: s.longestStreak >= 30,
      fact: achLang(
        "30 dní bez jediného prerušenia – takúto disciplínu udrží naozaj len hŕstka ľudí! Dokázal si, že máš železnú vôľu a že na sebe dokážeš pracovať aj vtedy, keď sa nechce. Tento návyk ti bude vracať energiu a zdravie ešte roky. Si v tom najlepšom 1 % vytrvalcov – klobúk dole!",
        "30 days without a single break – only a tiny handful of people can keep that up! You've proven you have an iron will and can work on yourself even when you don't feel like it. This habit will repay you with energy and health for years. You're in the top 1% of the persistent – hats off!"
      ),
    },
  ];

  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  // získané navrch, zamknuté dole
  const sorted = [...items].sort((a, b) => (a.done === b.done ? 0 : a.done ? -1 : 1));

  host.innerHTML = sorted
    .map(
      (b) => `
        <div class="badge${b.done ? " badge--done" : " badge--locked"}" data-fact="${esc(b.fact)}">
          <img class="badge__img" src="assets/badges/${b.img}.png?v=2" alt="" />
          <span class="badge__title">${b.title}</span>
          <span class="badge__desc">${b.desc}</span>
        </div>`
    )
    .join("");

  const doneCount = items.filter((b) => b.done).length;
  setTextById("ach-badges-sub", `${doneCount} / ${items.length}`);
}

function openBadgeOverlay(badgeEl) {
  const overlay = document.getElementById("badge-overlay");
  const card = document.getElementById("badge-overlay-card");
  if (!overlay || !card) return;

  const img = badgeEl.querySelector(".badge__img");
  const title = badgeEl.querySelector(".badge__title")?.textContent || "";
  const desc = badgeEl.querySelector(".badge__desc")?.textContent || "";
  const done = badgeEl.classList.contains("badge--done");

  const oImg = document.getElementById("badge-overlay-img");
  if (oImg && img) oImg.src = img.src;
  setTextById("badge-overlay-title", title);
  setTextById("badge-overlay-desc", desc);
  setTextById(
    "badge-overlay-status",
    done ? achLang("✅ Získané", "✅ Earned") : achLang("🔒 Ešte nezískané", "🔒 Not earned yet")
  );
  setTextById("badge-overlay-fact", badgeEl.dataset.fact || "");

  overlay.classList.toggle("badge-overlay--locked", !done);
  overlay.hidden = false;
  card.classList.remove("badge-overlay__card--in");
  void card.offsetWidth; // reštart animácie
  card.classList.add("badge-overlay__card--in");
}

function closeBadgeOverlay() {
  const overlay = document.getElementById("badge-overlay");
  const card = document.getElementById("badge-overlay-card");
  if (!overlay || overlay.hidden) return;
  if (overlay.classList.contains("badge-overlay--closing")) return;
  if (!card) {
    overlay.hidden = true;
    return;
  }

  card.classList.remove("badge-overlay__card--in");
  card.classList.add("badge-overlay__card--out");
  overlay.classList.add("badge-overlay--closing");

  const finish = () => {
    overlay.hidden = true;
    card.classList.remove("badge-overlay__card--out");
    overlay.classList.remove("badge-overlay--closing");
    card.removeEventListener("animationend", finish);
  };
  card.addEventListener("animationend", finish);
  setTimeout(finish, 600); // poistka, ak by animationend nezbehol
}

function renderTickets() {
  if (!document.getElementById("panel-tickets")) return;

  const s = computeAchievementStats();
  const level = 1 + Math.floor(s.totalPoints / POINTS_PER_LEVEL);
  const intoLevel = s.totalPoints % POINTS_PER_LEVEL;
  const toNext = POINTS_PER_LEVEL - intoLevel;

  setTextById("ach-level", String(level));
  setTextById("ach-level-title", achLang("Tvoj postup", "Your progress"));
  setTextById(
    "ach-level-sub",
    achLang(
      `${s.totalPoints} ${pluralBody(s.totalPoints)} · ${s.totalKm.toFixed(0)} km celkovo`,
      `${s.totalPoints} pts · ${s.totalKm.toFixed(0)} km total`
    )
  );
  const fill = document.getElementById("ach-level-fill");
  if (fill) fill.style.width = `${Math.round((intoLevel / POINTS_PER_LEVEL) * 100)}%`;
  setTextById(
    "ach-level-next",
    achLang(
      `Do levelu ${level + 1} ti chýba ${toNext} ${pluralBody(toNext)}`,
      `${toNext} points to level ${level + 1}`
    )
  );
  setTextById("ach-challenges-title", achLang("Výzvy", "Challenges"));
  setTextById("ach-badges-title", achLang("Odznaky", "Badges"));

  renderChallenges(s);
  renderBadges(s);
  renderHealthStats();
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return achLang("podváha", "underweight");
  if (bmi < 25) return achLang("norma", "normal");
  if (bmi < 30) return achLang("nadváha", "overweight");
  return achLang("obezita", "obese");
}

function renderHealthStats() {
  const host = document.getElementById("health-stats");
  if (!host) return;

  const user = typeof ChodzaAuth !== "undefined" ? ChodzaAuth.getCurrentUser() : null;
  const km = Number(state.kmToday || 0);
  const weight = Number(user?.weightKg || 0);
  const height = Number(user?.heightCm || 0);
  const gender = user?.gender || "";

  setTextById("ach-stats-title", achLang("Tvoje štatistiky", "Your stats"));
  setTextById("ach-stats-sub", achLang("dnes", "today"));
  setTextById("stat-steps-lbl", achLang("krokov dnes", "steps today"));
  setTextById("stat-cal-lbl", achLang("kcal dnes", "kcal today"));

  // Kroky – dĺžka kroku z výšky (a pohlavia), inak priemer 0,74 m
  let stepLenM = 0.74;
  if (height > 0) {
    const f = gender === "female" ? 0.413 : gender === "male" ? 0.415 : 0.414;
    stepLenM = (height * f) / 100;
  }
  const steps = km > 0 ? Math.round((km * 1000) / stepLenM) : 0;
  setTextById("stat-steps", steps > 0 ? steps.toLocaleString(loc()) : "—");

  // Kalórie – približne 0,5 kcal na kg na km
  if (weight > 0 && km > 0) {
    setTextById("stat-cal", String(Math.round(weight * km * 0.5)));
  } else {
    setTextById("stat-cal", "—");
  }

  // BMI – z výšky a váhy
  if (weight > 0 && height > 0) {
    const m = height / 100;
    const bmi = weight / (m * m);
    setTextById("stat-bmi", bmi.toFixed(1));
    setTextById("stat-bmi-lbl", bmiCategory(bmi));
  } else {
    setTextById("stat-bmi", "—");
    setTextById("stat-bmi-lbl", "BMI");
  }

  const hint = document.getElementById("stats-hint");
  if (hint) {
    const missing = !(weight > 0 && height > 0);
    hint.hidden = !missing;
    if (missing) {
      hint.textContent = achLang(
        "Doplň výšku a váhu v profile (ikona ceruzky) pre presné kalórie a BMI.",
        "Add your height and weight in the profile (pencil icon) for accurate calories and BMI."
      );
    }
  }
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
  const baseMax = getMaxPointsPerDay();
  const plan = getUserPlan();
  const maxPts =
    typeof ChodzaPlans !== "undefined"
      ? ChodzaPlans.getMaxPointsForPlan(baseMax, plan)
      : baseMax;
  const mult = typeof ChodzaPlans !== "undefined" ? ChodzaPlans.getPointsMultiplier(plan) : 1;

  const el = document.getElementById("display-goal");
  if (el) el.textContent = t("profile.goalFmt", { km });

  const maxEl = document.getElementById("display-goal-max");
  if (maxEl) {
    const key =
      maxPts === 1 ? "profile.goalMaxOne" : maxPts >= 2 && maxPts <= 4 ? "profile.goalMaxFew" : "profile.goalMaxMany";
    let text = t(key, { max: maxPts });
    if (mult > 1) text += ChodzaI18n?.getLang() === "en" ? " (Plus 2×)" : " (Plus 2×)";
    maxEl.textContent = text;
  }

  const ticketsHint = document.getElementById("tickets-points-hint");
  if (ticketsHint) {
    const multNote =
      mult > 1
        ? ChodzaI18n?.getLang() === "en"
          ? " Plus plan: <strong>2×</strong> points for the same km."
          : " Balík Plus: <strong>2×</strong> body za rovnaké km."
        : "";
    ticketsHint.innerHTML =
      ChodzaI18n?.getLang() === "en"
        ? `Every <strong>${km}</strong> km = 1 point, max <strong>${maxPts}</strong> points per day.${multNote} Total above is your monthly sum.`
        : `Za každých <strong>${km}</strong> km = 1 bod, maximum <strong>${maxPts}</strong> bodov za deň.${multNote} Hore je súčet všetkých bodov v mesiaci.`;
  }

  const calHint = document.getElementById("calendar-goal-hint");
  const hintText = t("calendar.hint", { km });
  if (calHint) calHint.textContent = hintText;
  const tip = document.getElementById("calendar-info-tip");
  if (tip) tip.textContent = hintText;
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
    kmLabel.textContent = t("stat.kmWeek");
    daysTotal.textContent = "/ 7";
  } else {
    kmLabel.textContent = t("stat.kmMonth");
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
  return d.toLocaleDateString(loc(), { month: "long", year: "numeric" });
}

function formatEur(amount) {
  return amount.toLocaleString(loc(), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDrawPrizes(draw) {
  if (draw?.prizes) return draw.prizes;
  if (typeof ChodzaDraw !== "undefined" && draw?.totalFundEur > 0) {
    return ChodzaDraw.calculatePrizesFromPercent(draw.totalFundEur);
  }
  return {
    drawFirst: 0,
    drawSecond: 0,
    drawThird: 0,
    smallEach: 0,
    walkerFirst: 0,
    walkerSecond: 0,
    walkerThird: 0,
  };
}

function renderMainWinnerRow(w, prizeEur) {
  const medal = MEDALS[w.place - 1];
  return `
    <li class="winner-row winner-row--top">
      <span class="winner-row__medal" aria-hidden="true">${medal}</span>
      <div class="winner-row__info">
        <span class="winner-row__nick">@${w.nick}</span>
        <span class="winner-row__sub">${t("winners.placeMain", { place: w.place })}</span>
      </div>
      <span class="winner-row__prize">${formatEur(prizeEur)}</span>
    </li>`;
}

function renderSmallWinnerRow(w, prizeEur) {
  const amount = w.prizeEur != null ? w.prizeEur : prizeEur;
  return `
    <li class="winner-row winner-row--small">
      <span class="winner-row__place">•</span>
      <div class="winner-row__info">
        <span class="winner-row__nick">@${w.nick}</span>
        <span class="winner-row__sub">${t("winners.placeSmall")}</span>
      </div>
      <span class="winner-row__prize">${formatEur(amount)}</span>
    </li>`;
}

function renderWalkerWinnerRow(w) {
  const medal = MEDALS[w.place - 1] || "🏅";
  const prizeHtml =
    w.prizeType === "premium_month"
      ? `<span class="winner-row__prize winner-row__prize--premium">PREMIUM mesiac zdarma</span>`
      : `<span class="winner-row__prize">${formatEur(w.prizeEur)}</span>`;
  return `
    <li class="winner-row winner-row--walker">
      <span class="winner-row__medal" aria-hidden="true">${medal}</span>
      <div class="winner-row__info">
        <span class="winner-row__nick">@${w.nick}</span>
        <span class="winner-row__sub">${w.km} km · ${w.place}. najväčší makač</span>
      </div>
      ${prizeHtml}
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

  const demoPrizes =
    typeof ChodzaDraw !== "undefined"
      ? ChodzaDraw.calculatePrizesFromPercent(500)
      : {
          drawFirst: 75,
          drawSecond: 50,
          drawThird: 30,
          smallEach: 500 * 0.2 / 97,
          walkerFirst: 10,
          walkerSecond: 6,
          walkerThird: 4,
        };

  state.winnersByMonth[prev] = {
    prizeMode: "percent",
    totalFundEur: 500,
    prizes: demoPrizes,
    lottery: {
      main: [
        { place: 1, nick: "ChodecPro_SK", prizeEur: demoPrizes.drawFirst },
        { place: 2, nick: "Krokomerista", prizeEur: demoPrizes.drawSecond },
        { place: 3, nick: "SynkoWalk", prizeEur: demoPrizes.drawThird },
      ],
      small: generateDemoSmallNicks(97, prevSeed).map((x) => ({
        ...x,
        prizeEur: demoPrizes.smallEach,
      })),
    },
    walkers: [
      { place: 1, nick: "12km_den", km: 312.4, prizeEur: demoPrizes.walkerFirst, prizeType: "cash" },
      { place: 2, nick: "BodMaster", km: 287.1, prizeEur: demoPrizes.walkerSecond, prizeType: "cash" },
      {
        place: 3,
        nick: "Nováčik2026",
        km: 245.8,
        prizeEur: 0,
        prizeType: "premium_month",
      },
    ],
  };

  const twoBack = (() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const demoPrizes2 =
    typeof ChodzaDraw !== "undefined"
      ? ChodzaDraw.calculatePrizesFromPercent(350)
      : {
          drawFirst: 52.5,
          drawSecond: 35,
          drawThird: 21,
          smallEach: 350 * 0.2 / 97,
          walkerFirst: 7,
          walkerSecond: 4.2,
          walkerThird: 2.8,
        };

  state.winnersByMonth[twoBack] = {
    prizeMode: "percent",
    totalFundEur: 350,
    prizes: demoPrizes2,
    lottery: {
      main: [
        { place: 1, nick: "FitJuraj", prizeEur: demoPrizes2.drawFirst },
        { place: 2, nick: "12km_den", prizeEur: demoPrizes2.drawSecond },
        { place: 3, nick: "ZochodMa", prizeEur: demoPrizes2.drawThird },
      ],
      small: generateDemoSmallNicks(97, twoBack.replace("-", "")).map((x) => ({
        ...x,
        prizeEur: demoPrizes2.smallEach,
      })),
    },
    walkers: [
      { place: 1, nick: "GreenWalker", km: 298.2, prizeEur: demoPrizes2.walkerFirst, prizeType: "cash" },
      { place: 2, nick: "PešiakSK", km: 276.5, prizeEur: demoPrizes2.walkerSecond, prizeType: "cash" },
      { place: 3, nick: "VečernáPrechádzka", km: 251.0, prizeEur: demoPrizes2.walkerThird, prizeType: "cash" },
    ],
  };

  state.selectedWinnerMonth = prev;
}

function getDefaultWinnersMonth() {
  const prev = getPreviousMonthKey();
  if (state.winnersByMonth[prev]?.lottery?.main?.length || state.winnersByMonth[prev]?.main?.length)
    return prev;
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

  const lottery = draw.lottery || {
    main: draw.main || [],
    small: draw.small || [],
  };
  const mainList = lottery.main || [];
  const smallList = lottery.small || [];
  const walkers = draw.walkers || [];
  const prizes = getDrawPrizes(draw);

  if (!mainList.length && !walkers.length) {
    container.innerHTML = `
      <div class="winners-status winners-status--pending">
        ${isCurrent ? t("winners.pendingCurrent") : t("winners.pendingPast")}
      </div>`;
    hint.hidden = false;
    return;
  }

  const mainPrizes = [prizes.drawFirst, prizes.drawSecond, prizes.drawThird];
  const collapsedClass = smallWinnersExpanded ? "" : " winners-list--collapsed";
  const toggleLabel = smallWinnersExpanded
    ? t("winners.collapse")
    : t("winners.expand", { n: smallList.length });

  const totalWinners = mainList.length + smallList.length;

  container.innerHTML = `
    <div class="winners-status">
      ${formatMonthKey(month)} – ${totalWinners} z osudia + TOP 3 makači
    </div>
    <div class="winners-dual">
      <section class="winners-neon winners-neon--walkers">
        <header class="winners-neon__head">
          <h3 class="winners-neon__title">Najväčší makači mesiaca</h3>
          <p class="winners-neon__sub">Výkon podľa km na Slovensku</p>
        </header>
        <ol class="winners-list">
          ${
            walkers.length
              ? walkers.map((w) => renderWalkerWinnerRow(w)).join("")
              : `<li class="winners-neon__empty">Zatiaľ bez údajov o km.</li>`
          }
        </ol>
      </section>
      <section class="winners-neon winners-neon--lottery">
        <header class="winners-neon__head">
          <h3 class="winners-neon__title">Vyžrebovaní z osudia</h3>
          <p class="winners-neon__sub">Náhodný výber · pity 1,5×</p>
        </header>
        <div class="winners-neon__block">
          <h4 class="winners-neon__label">Hlavné ceny</h4>
          <ol class="winners-list">
            ${mainList.map((w, i) => renderMainWinnerRow(w, w.prizeEur ?? mainPrizes[i])).join("")}
          </ol>
        </div>
        <div class="winners-neon__block">
          <div class="winners-neon__row-head">
            <h4 class="winners-neon__label">Zvyšných 97</h4>
            <button type="button" class="btn--tiny" id="toggle-small-winners">${toggleLabel}</button>
          </div>
          <ol class="winners-list${collapsedClass}" id="winners-small-list">
            ${smallList.map((w) => renderSmallWinnerRow(w, prizes.smallEach)).join("")}
          </ol>
        </div>
      </section>
    </div>`;

  document.getElementById("toggle-small-winners")?.addEventListener("click", () => {
    smallWinnersExpanded = !smallWinnersExpanded;
    renderWinners();
  });

  hint.hidden = true;
}

function getPlanDisplayInfo(plan) {
  const isEn = ChodzaI18n?.getLang() === "en";
  if (plan === "premium") {
    return {
      summary: isEn ? "Premium · 7.99 € / mo" : "Premium · 7,99 € / mes.",
      chip: isEn ? "Premium 7.99 €" : "Premium 7,99 €",
    };
  }
  if (plan === "plus") {
    return {
      summary: isEn ? "Plus · 4.99 € / mo" : "Plus · 4,99 € / mes.",
      chip: isEn ? "Plus 4.99 €" : "Plus 4,99 €",
    };
  }
  return {
    summary: isEn ? "Free · 0 €" : "Free · 0 €",
    chip: isEn ? "Free 0 €" : "Free 0 €",
  };
}

function updateProfilePlanDisplay() {
  const plan = getUserPlan();
  const info = getPlanDisplayInfo(plan);
  const isEn = ChodzaI18n?.getLang() === "en";

  const summary = document.getElementById("profile-plan-summary");
  if (summary) summary.textContent = info.summary;

  const changes = document.getElementById("profile-plan-changes");
  if (!changes) return;
  changes.innerHTML = "";

  const options = [];
  if (plan !== "plus") {
    options.push({
      id: "plus",
      label: getPlanDisplayInfo("plus").chip,
      muted: plan === "premium",
    });
  }
  if (plan !== "premium") {
    options.push({
      id: "premium",
      label: getPlanDisplayInfo("premium").chip,
      muted: false,
    });
  }
  if (plan !== "free") {
    options.push({ id: "free", label: getPlanDisplayInfo("free").chip, muted: true });
  }

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "plan-chip" + (opt.muted ? " plan-chip--muted" : "");
    btn.textContent = opt.label;
    btn.setAttribute("data-plan-change", opt.id);
    changes.appendChild(btn);
  }
}

function updateSubBadge() {
  updateProfilePlanDisplay();
}

function applyAppLanguage() {
  if (typeof ChodzaI18n !== "undefined") ChodzaI18n.applyStatic(document);
  const ring = document.querySelector(".ring--stadium");
  if (ring) ring.setAttribute("aria-label", t("ring.aria"));
  updateSubBadge();
  updateProfilePlanDisplay();
  updatePlanNotice();
  document.getElementById("page-title").textContent = t(`nav.${activePanel}`);
  const winnersHint = document.getElementById("winners-hint");
  if (winnersHint) winnersHint.textContent = t("winners.hint");
  if (typeof ChodzaHealthSync !== "undefined") ChodzaHealthSync.updateSyncStatusUi();
  updateHealthProfileUi();
  updateRing();
  updateDrawCountdown();
  updatePeriodStats();
  updateAdminGoalUi();
  renderTickets();
  if (activePanel === "winners") renderWinners();
  if (isCalendarOpen()) renderCalendar();
  updateAdminLinkHref();
}

function setLanguage(lang) {
  if (typeof ChodzaI18n !== "undefined") ChodzaI18n.setLang(lang, "app");
  const sel = document.getElementById("setting-language");
  if (sel) sel.value = lang;
  try {
    const raw = localStorage.getItem("chodza-settings");
    const s = raw ? JSON.parse(raw) : {};
    s.lang = lang;
    localStorage.setItem("chodza-settings", JSON.stringify(s));
  } catch (_) {}
  applyAppLanguage();
}

function showPanel(name) {
  activePanel = name;
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

  document.querySelector(".header")?.classList.toggle("header--tickets", name === "tickets");
  document.querySelector(".main")?.classList.toggle("main--tickets", name === "tickets");

  document.getElementById("page-title").textContent = t(`nav.${name}`);

  if (name === "home" || name === "tickets" || name === "profile") {
    refreshAfterAdminSettings();
  }

  if (name === "winners") {
    const sel = state.winnersByMonth[state.selectedWinnerMonth];
    if (
      !state.selectedWinnerMonth ||
      (!sel?.lottery?.main?.length && !sel?.main?.length && !sel?.walkers?.length)
    ) {
      state.selectedWinnerMonth = getDefaultWinnersMonth();
    }
    renderWinners();
  } else if (name === "home") {
    document.getElementById("today-date").textContent = formatDateSk(new Date());
    updateHomeTopbar();
    updateHomeHeroCards();
    updateWeeklyBars();
    updateDrawCountdown();
    updatePeriodStats();
  } else if (name === "tickets") {
    document.getElementById("today-date").textContent = "";
  } else {
    document.getElementById("today-date").textContent = "";
  }
}

function applyKmFromSync(km) {
  state.kmToday = km;
  syncTodayToHistory();
  updateRing();
  if (isCalendarOpen()) renderCalendar();
  updatePeriodStats();
  upsertDailyPoint(todayIso(), state.kmToday);
  renderTickets();
}

function flashSyncButton() {
  const btn = document.getElementById("sync-btn");
  if (!btn) return;
  btn.textContent = t("sync.done");
  setTimeout(() => {
    btn.textContent = t("ring.sync");
  }, 2000);
}

async function runKmSync(manual) {
  if (typeof ChodzaHealthSync !== "undefined") {
    const result = await ChodzaHealthSync.syncFromHealth({ manual: !!manual, silent: !manual });
    if (result?.ok) flashSyncButton();
    return result;
  }
  const extra = 2 + Math.random() * 4;
  state.kmToday = Math.round((state.kmToday + extra) * 10) / 10;
  applyKmFromSync(state.kmToday);
  flashSyncButton();
  return { ok: true };
}

function updateHealthProfileUi() {
  const user = typeof ChodzaAuth !== "undefined" ? ChodzaAuth.getCurrentUser() : null;
  const linked = !!user?.healthLinked;
  const status = document.getElementById("health-profile-status");
  const btn = document.getElementById("btn-health-connect");
  if (status) {
    status.textContent = linked ? t("health.connected") : t("health.notLinked");
    status.className = `health-sync-status health-sync-status--profile ${linked ? "health-sync-status--on" : "health-sync-status--off"}`;
  }
  if (btn) btn.hidden = linked;
  if (typeof ChodzaHealthSync !== "undefined") {
    ChodzaHealthSync.onHealthLinkedChanged(linked);
    ChodzaHealthSync.updateSyncStatusUi();
  }
}

function initHealthSync() {
  if (typeof ChodzaHealthSync === "undefined") return;
  ChodzaHealthSync.init({
    t,
    getState: () => state,
    getGoalKm: () => state.goalKm,
    getMaxPoints: getMaxPointsPerDay,
    getPointsForKm,
    isHealthLinked: () => !!ChodzaAuth?.getCurrentUser()?.healthLinked,
    isNotifyEnabled: () => document.getElementById("setting-notify")?.checked !== false,
    onKmUpdated: (km) => applyKmFromSync(km),
  });
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

  const key = currentMonthKey();
  const p = new URLSearchParams(location.search);
  let payload = null;

  if (location.hash && ChodzaSettings.decodeHash()) {
    payload = ChodzaSettings.applyHashToPage(key);
  } else {
    ChodzaSettings.importBridge(key);
    payload = ChodzaSettings.read(key);
  }

  if (p.has("goalKm") || p.has("maxPoints")) {
    const cur = payload || ChodzaSettings.read(key);
    const merged = { ...cur };
    if (p.has("goalKm")) {
      const g = Number(p.get("goalKm"));
      if (g >= 1 && g <= 50) merged.goalKmPerPoint = g;
    }
    if (p.has("maxPoints")) {
      const m = Number(p.get("maxPoints"));
      if (m >= 1 && m <= 10) merged.maxPointsPerDay = m;
    }
    payload = ChodzaSettings.write(key, merged);
  }

  const final = payload || ChodzaSettings.read(key);
  history.replaceState({}, "", `index.html${ChodzaSettings.encodeHash(final)}`);
}

function updateAdminLinkHref() {
  const adminLink = document.querySelector('a[href*="admin.html"]');
  if (!adminLink || typeof ChodzaSettings === "undefined") return;
  const s = ChodzaSettings.read(currentMonthKey());
  adminLink.href = `admin.html${ChodzaSettings.encodeHash(s)}`;
}

function applyUserProfile() {
  if (typeof ChodzaAuth === "undefined") return;
  const user = ChodzaAuth.getCurrentUser();
  if (!user) return;

  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");
  const nickEl = document.getElementById("user-nick");
  const cityEl = document.getElementById("user-city");
  const ibanEl = document.getElementById("profile-iban");

  if (nameEl) nameEl.textContent = ChodzaAuth.displayName(user);
  if (emailEl) emailEl.textContent = user.email;
  if (nickEl) nickEl.textContent = user.username ? `@${user.username}` : "";
  if (cityEl) {
    cityEl.textContent = user.city ? `📍 ${user.city}` : "";
    cityEl.hidden = !user.city;
  }
  if (ibanEl) {
    ibanEl.value =
      typeof ChodzaAuth.formatIbanDisplay === "function"
        ? ChodzaAuth.formatIbanDisplay(user.iban)
        : user.iban || "";
  }
  state.premium = !!user.premium;
  state.subscriptionPlan =
    user.subscriptionPlan || (user.premium ? "plus" : "free");
  if (typeof ChodzaPlans !== "undefined") {
    state.subscriptionPlan = ChodzaPlans.normalizePlan(state.subscriptionPlan);
  }
  applyPlanTheme();
  updateSubBadge();
  updatePlanNotice();
  updateHealthProfileUi();
  updateAdminGoalUi();
  updateHomeTopbar();
  updateHomeHeroCards();
}

function init() {
  if (typeof ChodzaAuth !== "undefined" && !ChodzaAuth.isLoggedIn()) {
    location.replace("welcome.html");
    return;
  }

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
        const darkEl = document.getElementById("setting-dark");
        if (darkEl) darkEl.checked = s.dark;
      }
      document.getElementById("setting-notify").checked = s.notify !== false;
      if (s.statsPeriod === "week" || s.statsPeriod === "month") {
        state.statsPeriod = s.statsPeriod;
      }
      if (s.lang === "en" || s.lang === "sk") {
        if (typeof ChodzaI18n !== "undefined") ChodzaI18n.setLang(s.lang, "app");
      }
    } catch (_) {}
  }

  const langSel = document.getElementById("setting-language");
  if (langSel) {
    langSel.value = typeof ChodzaI18n !== "undefined" ? ChodzaI18n.getLang() : "sk";
    langSel.addEventListener("change", () => setLanguage(langSel.value));
  }

  applyAppLanguage();
  applyUserProfile();
  applyPlanTheme();
  updatePlanNotice();
  initHealthSync();
  updateAdminLinkHref();
  updateWeeklyBars();

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
  window.addEventListener("chodza-settings-changed", () => {
    refreshAfterAdminSettings();
    updateAdminLinkHref();
  });
  window.addEventListener("hashchange", () => {
    if (typeof ChodzaSettings !== "undefined") ChodzaSettings.importBridge(currentMonthKey());
    refreshAfterAdminSettings();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (typeof ChodzaSettings !== "undefined") ChodzaSettings.importBridge(currentMonthKey());
      refreshAfterAdminSettings();
      if (typeof ChodzaHealthSync !== "undefined" && ChodzaHealthSync.isHealthLinked()) {
        ChodzaHealthSync.syncFromHealth({ silent: false });
      }
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

  // Calendar info tooltip
  const infoBtn = document.getElementById("calendar-info-btn");
  const infoTip = document.getElementById("calendar-info-tip");
  function hideInfoTip() {
    infoTip?.classList.add("tooltip--hidden");
  }
  infoBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    infoTip?.classList.toggle("tooltip--hidden");
  });
  document.addEventListener("click", () => hideInfoTip());

  document.getElementById("winners-month-select").addEventListener("change", (e) => {
    state.selectedWinnerMonth = e.target.value;
    renderWinners();
  });

  document.querySelectorAll(".nav__item").forEach((btn) => {
    btn.addEventListener("click", () => showPanel(btn.dataset.panel));
  });

  document.getElementById("ach-badges")?.addEventListener("click", (e) => {
    const badge = e.target.closest(".badge");
    if (badge) openBadgeOverlay(badge);
  });

  document.getElementById("badge-overlay-backdrop")?.addEventListener("click", closeBadgeOverlay);
  document.getElementById("badge-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "badge-overlay") closeBadgeOverlay();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBadgeOverlay();
  });

  document.getElementById("sync-btn").addEventListener("click", () => runKmSync(true));

  document.getElementById("period-week")?.addEventListener("click", () => {
    setStatsPeriod("week");
    persistSettings();
  });
  document.getElementById("period-month")?.addEventListener("click", () => {
    setStatsPeriod("month");
    persistSettings();
  });

  document.getElementById("setting-dark")?.addEventListener("change", (e) => {
    document.documentElement.dataset.theme = e.target.checked ? "dark" : "";
    persistSettings();
  });

  document.getElementById("setting-notify").addEventListener("change", async (e) => {
    persistSettings();
    if (e.target.checked && typeof ChodzaHealthSync !== "undefined") {
      await ChodzaHealthSync.requestNotifyPermission();
    }
  });

  document.getElementById("btn-health-connect")?.addEventListener("click", async () => {
    if (typeof ChodzaHealthSync === "undefined") return;
    await ChodzaHealthSync.connectHealth();
    updateHealthProfileUi();
    applyUserProfile();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-plan-change]");
    if (!btn) return;
    requestPlanChange(btn.getAttribute("data-plan-change"));
  });

  function saveProfileIban(showOk) {
    const user = ChodzaAuth?.getCurrentUser();
    const input = document.getElementById("profile-iban");
    const status = document.getElementById("iban-save-status");
    if (!user || !input) return;

    const normalized = ChodzaAuth.normalizeIban(input.value);
    const prev = ChodzaAuth.normalizeIban(user.iban || "");
    if (normalized === prev) return;

    if (normalized) {
      const ok =
        /^SK[0-9]{22}$/.test(normalized) ||
        (normalized.length >= 15 &&
          normalized.length <= 34 &&
          /^[A-Z]{2}[0-9A-Z]+$/.test(normalized));
      if (!ok) {
        if (status) {
          status.textContent = "Neplatný IBAN";
          status.className = "setting__iban-status setting__iban-status--err";
        }
        return;
      }
    }

    ChodzaAuth.updateProfile(user.email, { iban: normalized });
    input.value = ChodzaAuth.formatIbanDisplay(normalized);
    if (status && showOk) {
      status.textContent = "Uložené ✓";
      status.className = "setting__iban-status setting__iban-status--ok";
      clearTimeout(saveProfileIban._t);
      saveProfileIban._t = setTimeout(() => {
        status.textContent = "";
        status.className = "setting__iban-status";
      }, 2500);
    }
  }

  document.getElementById("profile-iban")?.addEventListener("blur", () => saveProfileIban(true));
  document.getElementById("profile-iban")?.addEventListener("change", () => saveProfileIban(true));

  document.getElementById("btn-logout")?.addEventListener("click", () => {
    if (typeof ChodzaAuth !== "undefined") ChodzaAuth.clearSession();
    location.href = "welcome.html";
  });

  // Profile edit modal
  const editBtn = document.getElementById("home-edit-profile");
  const editModal = document.getElementById("profile-edit-modal");
  const editBackdrop = document.getElementById("profile-edit-backdrop");
  const editClose = document.getElementById("profile-edit-close");
  const editCancel = document.getElementById("profile-edit-cancel");
  const editSave = document.getElementById("profile-edit-save");
  const editStatus = document.getElementById("profile-edit-status");

  function openProfileEditModal() {
    if (!editModal || typeof ChodzaAuth === "undefined") return;
    const user = ChodzaAuth.getCurrentUser();
    if (!user) return;
    document.getElementById("edit-firstName").value = user.firstName || "";
    document.getElementById("edit-lastName").value = user.lastName || "";
    document.getElementById("edit-email").value = user.email || "";
    document.getElementById("edit-username").value = user.username ? `@${user.username}` : "";
    document.getElementById("edit-city").value = user.city || "";
    document.getElementById("edit-phone").value = user.phone || "";
    const gEl = document.getElementById("edit-gender");
    if (gEl) gEl.value = user.gender || "";
    document.getElementById("edit-age").value = user.age || "";
    document.getElementById("edit-height").value = user.heightCm || "";
    document.getElementById("edit-weight").value = user.weightKg || "";
    if (editStatus) editStatus.textContent = "";
    editModal.hidden = false;
  }

  function closeProfileEditModal() {
    if (editModal) editModal.hidden = true;
  }

  editBtn?.addEventListener("click", () => {
    showPanel("profile");
    openProfileEditModal();
  });
  editBackdrop?.addEventListener("click", closeProfileEditModal);
  editClose?.addEventListener("click", closeProfileEditModal);
  editCancel?.addEventListener("click", closeProfileEditModal);

  editSave?.addEventListener("click", () => {
    if (typeof ChodzaAuth === "undefined") return;
    const user = ChodzaAuth.getCurrentUser();
    if (!user) return;
    const numOrNull = (id, min, max) => {
      const raw = String(document.getElementById(id)?.value || "").trim();
      if (raw === "") return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < min || n > max) return null;
      return n;
    };
    const patch = {
      firstName: String(document.getElementById("edit-firstName").value || "").trim(),
      lastName: String(document.getElementById("edit-lastName").value || "").trim(),
      city: String(document.getElementById("edit-city").value || "").trim(),
      phone: String(document.getElementById("edit-phone").value || "").trim(),
      gender: String(document.getElementById("edit-gender")?.value || ""),
      age: numOrNull("edit-age", 5, 120),
      heightCm: numOrNull("edit-height", 80, 250),
      weightKg: numOrNull("edit-weight", 20, 300),
    };
    const res = ChodzaAuth.updateProfile(user.email, patch);
    if (!res?.ok) {
      if (editStatus) editStatus.textContent = "Nepodarilo sa uložiť.";
      return;
    }
    applyUserProfile();
    updateHomeTopbar();
    renderHealthStats();
    if (editStatus) editStatus.textContent = "Uložené ✓";
    setTimeout(() => closeProfileEditModal(), 450);
  });

  // Avatar picker (tap avatar -> gallery/camera)
  const avatarInput = document.getElementById("avatar-file");
  function openAvatarPicker() {
    avatarInput?.click();
  }
  document.getElementById("home-avatar")?.addEventListener("click", openAvatarPicker);

  avatarInput?.addEventListener("change", () => {
    if (typeof ChodzaAuth === "undefined") return;
    const user = ChodzaAuth.getCurrentUser();
    const file = avatarInput.files?.[0];
    if (!user || !file) return;
    if (!file.type?.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image/")) return;
      // store in user record (localStorage via auth-store)
      ChodzaAuth.updateProfile(user.email, { avatarDataUrl: dataUrl });
      applyUserProfile();
      updateHomeTopbar();
      // allow selecting same file again
      avatarInput.value = "";
    };
    reader.readAsDataURL(file);
  });
}

function persistSettings() {
  let prev = {};
  try {
    const raw = localStorage.getItem("chodza-settings");
    if (raw) prev = JSON.parse(raw);
  } catch (_) {}
  localStorage.setItem(
    "chodza-settings",
    JSON.stringify({
      ...prev,
      dark: document.getElementById("setting-dark")?.checked === true,
      notify: document.getElementById("setting-notify").checked,
      statsPeriod: state.statsPeriod,
      lang: typeof ChodzaI18n !== "undefined" ? ChodzaI18n.getLang() : prev.lang,
    })
  );
}

init();
