/**
 * Slovenčina / English – app a admin majú oddelený jazyk v localStorage
 */
(function (root) {
  const LANG_KEY_APP = "chodza-lang-app";
  const LANG_KEY_ADMIN = "chodza-lang-admin";
  /** @deprecated spoločný kľúč – len migrácia */
  const LANG_KEY_LEGACY = "chodza-lang";
  const SUBSCRIPTION_PRICE = 4.99;

  const messages = {
    sk: {
      "app.title": "Chôdza",
      "nav.home": "Dnes",
      "nav.tickets": "Moje body",
      "nav.winners": "Výhercovia",
      "nav.profile": "Profil",
      "nav.aria": "Hlavná navigácia",
      "ring.aria": "Prejdené kilometre dnes",
      "ring.sync": "Aktualizovať km",
      "ring.maxToday": "Maximum {max} body za dnes!",
      "ring.todayPoints": "Dnes {points} · ešte {km} km do ďalšieho",
      "ring.toFirst": "Ešte {km} km do 1. bodu ({step} km = 1 bod)",
      "countdown.until": "Do ďalšieho odmeňovania",
      "countdown.on": "Odmeňovanie: {date}",
      "countdown.today": "Odmeňovanie dnes!",
      "countdown.day": "deň",
      "countdown.days2": "dni",
      "countdown.days": "dní",
      "countdown.hour": "hod",
      "countdown.min": "min",
      "countdown.sec": "sek",
      "period.week": "Týždeň",
      "period.month": "Mesiac",
      "period.aria": "Obdobie štatistiky",
      "stat.kmWeek": "Km tento týždeň",
      "stat.kmMonth": "Km tento mesiac",
      "stat.daysDone": "Splnené dni",
      "calendar.title": "Kalendár chôdze",
      "calendar.open": "Kalendár",
      "calendar.openAria": "Otvoriť kalendár chôdze",
      "calendar.hint": "Klikni a pozri si km po dňoch · zelená bodka = aspoň {km} km",
      "calendar.modalTitle": "Kalendár chôdze",
      "calendar.close": "Zavrieť",
      "calendar.viewAria": "Zobrazenie kalendára",
      "calendar.year": "Ročný",
      "calendar.month": "Mesačný",
      "calendar.day": "Denný",
      "calendar.prev": "Predchádzajúce",
      "calendar.next": "Ďalšie",
      "calendar.noData": "Žiadne údaje o chôdzi.",
      "calendar.goalMet": " · splnený cieľ (zelená bodka)",
      "calendar.kmToGreen": " · ešte {km} km do zelenej bodky",
      "calendar.greenDot": " · zelená bodka",
      "calendar.yearMeta": "{km} km · {days} dní ●",
      "tickets.labelMonth": "bodov tento mesiac",
      "tickets.labelMonths": "body tento mesiac",
      "tickets.labelMonthMany": "bodov tento mesiac",
      "tickets.hint": "Za každých {km} km = 1 bod, maximum {max} body za deň. Hore je súčet všetkých bodov v mesiaci.",
      "winners.monthLabel": "Mesiac žrebovania",
      "winners.hint": "Na konci mesiaca sa žrebuje 3× hlavná cena a 97× menšia cena. Výška výhier závisí od počtu platiacich predplatiteľov.",
      "winners.pendingCurrent": "Žrebovanie pre tento mesiac ešte neprebehlo. Po skončení mesiaca sa vyžrebujú 3 hlavné a 97 menších cien.",
      "winners.pendingPast": "Pre tento mesiac zatiaľ nie sú zverejnení výhercovia.",
      "winners.summary": "{month} – {total} výhercov (3 hlavné + {small} menších)",
      "winners.mainTitle": "Hlavné ceny",
      "winners.mainMeta": "3 výhercov",
      "winners.smallTitle": "Menšie ceny",
      "winners.collapse": "Zbaliť zoznam",
      "winners.expand": "Zobraziť všetkých ({n})",
      "winners.placeMain": "{place}. miesto – hlavná cena",
      "winners.placeSmall": "menšia výhra",
      "profile.dailyGoal": "Denný cieľ",
      "profile.goalFmt": "{km} km = 1 bod",
      "profile.goalMaxOne": "max {max} bod / deň",
      "profile.goalMaxFew": "max {max} body / deň",
      "profile.goalMaxMany": "max {max} bodov / deň",
      "profile.notify": "Notifikácie",
      "profile.dark": "Tmavý režim",
      "profile.language": "Jazyk",
      "profile.langSk": "Slovenčina",
      "profile.langEn": "English",
      "profile.premium": "Premium – {price} / mesiac",
      "profile.subActive": "Predplatné aktívne",
      "profile.subInactive": "Bez predplatného",
      "profile.hint": "Denný cieľ nastavuje administrátor. Stripe + Supabase pripojíme v kroku 3.",
      "profile.admin": "Administrácia",
      "day.today": "Dnes",
      "day.yesterday": "Včera",
      "points.zero": "0 bodov",
      "points.one": "1 bod",
      "points.few": "{n} body",
      "points.many": "{n} bodov",
      "weekdays": ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"],
      "sync.done": "Aktualizované ✓",
      "health.notLinked": "Health nie je prepojený – stlač „Aktualizovať km“ alebo prepoj v Profile.",
      "health.lastSync": "Auto-sync z Health · naposledy {time}",
      "health.neverSynced": "ešte nesynchronizované",
      "health.connect": "Prepojiť Apple / Google Health",
      "health.connected": "Health prepojený · sync každú hodinu",
      "profile.health": "Zdravie (kroky / km)",
      "profile.notifyHint": "Povolením dostaneš povzbudenie, keď ti chýba málo km do bodu.",
      "notify.title": "Chôdza",
      "notify.almostPoint": "Ešte to stihneš! Chýba ti len {km} km do prvého bodu dnes.",
      "notify.almostNext": "Skoro ďalší bod! Ešte {km} km a máš ho.",
      "notify.eveningPush": "Večer v hre – do ďalšieho bodu ti chýba len {km} km.",
      "notify.maxPoints": "Super! Dnes už máš maximum {max} bodov. Pokračuj v chôdzi!",
      "meta.description": "Športová chôdza – denný cieľ, mesačný kôš, profil",
    },
    en: {
      "app.title": "Walk",
      "nav.home": "Today",
      "nav.tickets": "My points",
      "nav.winners": "Winners",
      "nav.profile": "Profile",
      "nav.aria": "Main navigation",
      "ring.aria": "Kilometres walked today",
      "ring.sync": "Update km",
      "ring.maxToday": "Maximum {max} points today!",
      "ring.todayPoints": "Today {points} · {km} km to next",
      "ring.toFirst": "{km} km to 1st point ({step} km = 1 point)",
      "countdown.until": "Until next rewards",
      "countdown.on": "Rewards: {date}",
      "countdown.today": "Rewards today!",
      "countdown.day": "day",
      "countdown.days2": "days",
      "countdown.days": "days",
      "countdown.hour": "hr",
      "countdown.min": "min",
      "countdown.sec": "sec",
      "period.week": "Week",
      "period.month": "Month",
      "period.aria": "Statistics period",
      "stat.kmWeek": "Km this week",
      "stat.kmMonth": "Km this month",
      "stat.daysDone": "Days completed",
      "calendar.title": "Walk calendar",
      "calendar.open": "Calendar",
      "calendar.openAria": "Open walk calendar",
      "calendar.hint": "Tap to see km per day · green dot = at least {km} km",
      "calendar.modalTitle": "Walk calendar",
      "calendar.close": "Close",
      "calendar.viewAria": "Calendar view",
      "calendar.year": "Year",
      "calendar.month": "Month",
      "calendar.day": "Day",
      "calendar.prev": "Previous",
      "calendar.next": "Next",
      "calendar.noData": "No walk data.",
      "calendar.goalMet": " · goal met (green dot)",
      "calendar.kmToGreen": " · {km} km to green dot",
      "calendar.greenDot": " · green dot",
      "calendar.yearMeta": "{km} km · {days} days ●",
      "tickets.labelMonth": "point this month",
      "tickets.labelMonths": "points this month",
      "tickets.labelMonthMany": "points this month",
      "tickets.hint": "Every {km} km = 1 point, max {max} points per day. Total above is your monthly sum.",
      "winners.monthLabel": "Draw month",
      "winners.hint": "At month end, 3 main prizes and 97 smaller prizes are drawn. Prize amounts depend on paying subscribers.",
      "winners.pendingCurrent": "Draw for this month has not run yet. After month end, 3 main and 97 smaller prizes are drawn.",
      "winners.pendingPast": "No winners published for this month yet.",
      "winners.summary": "{month} – {total} winners (3 main + {small} smaller)",
      "winners.mainTitle": "Main prizes",
      "winners.mainMeta": "3 winners",
      "winners.smallTitle": "Smaller prizes",
      "winners.collapse": "Collapse list",
      "winners.expand": "Show all ({n})",
      "winners.placeMain": "{place} place – main prize",
      "winners.placeSmall": "smaller prize",
      "profile.dailyGoal": "Daily goal",
      "profile.goalFmt": "{km} km = 1 point",
      "profile.goalMaxOne": "max {max} point / day",
      "profile.goalMaxFew": "max {max} points / day",
      "profile.goalMaxMany": "max {max} points / day",
      "profile.notify": "Notifications",
      "profile.dark": "Dark mode",
      "profile.language": "Language",
      "profile.langSk": "Slovenčina",
      "profile.langEn": "English",
      "profile.premium": "Premium – {price} / month",
      "profile.subActive": "Subscription active",
      "profile.subInactive": "No subscription",
      "profile.hint": "Daily goal is set by admin. Stripe + Supabase coming in step 3.",
      "profile.admin": "Administration",
      "day.today": "Today",
      "day.yesterday": "Yesterday",
      "points.zero": "0 points",
      "points.one": "1 point",
      "points.few": "{n} points",
      "points.many": "{n} points",
      "weekdays": ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
      "sync.done": "Updated ✓",
      "health.notLinked": "Health not linked – tap Update km or link in Profile.",
      "health.lastSync": "Health auto-sync · last {time}",
      "health.neverSynced": "not synced yet",
      "health.connect": "Link Apple / Google Health",
      "health.connected": "Health linked · sync every hour",
      "profile.health": "Health (steps / km)",
      "profile.notifyHint": "Get a nudge when you are close to your next point.",
      "notify.title": "Walk",
      "notify.almostPoint": "You can still make it! Only {km} km to your first point today.",
      "notify.almostNext": "Almost there! {km} km to your next point.",
      "notify.eveningPush": "Evening push – just {km} km to your next point.",
      "notify.maxPoints": "Great! You already have max {max} points today.",
      "meta.description": "Sport walking – daily goal, monthly pool, profile",
    },
  };

  const adminMessages = {
    sk: {
      "admin.title": "Chôdza – Admin",
      "admin.brand": "Administrácia",
      "admin.nav.settings": "Mesačné nastavenia",
      "admin.nav.users": "Používatelia",
      "admin.nav.draw": "Uzatvorenie mesiaca",
      "admin.demo": "Demo dáta",
      "admin.ready": "Pripravené na Supabase",
      "admin.back": "← Späť do aplikácie",
      "admin.platform": "Správa platformy",
      "admin.currentMonth": "Aktuálny mesiac: {month}",
      "admin.mockApi": "Mock API",
      "admin.monthSettings": "Správa aktuálneho mesiaca",
      "admin.monthDesc": "Globálne nastavenia platné pre všetkých používateľov v tomto mesiaci.",
      "admin.prizeLegend": "Finančný mesačný kôš",
      "admin.prizeLabel": "Výška finančnej výhry (€)",
      "admin.prizePlaceholder": "Prázdne = z predplatiteľov",
      "admin.prizeHint": "Nechaj prázdne alebo 0 – sumy sa dopočítajú z aktívnych predplatiteľov ({price} / mesiac). Ak zadáš sumu, celý kôš ide len výhercom.",
      "admin.revenueLegend": "Tržby z predplatného (náhľad)",
      "admin.goalLegend": "Obtiažnosť bodu",
      "admin.goalType": "Typ cieľa",
      "admin.goalWalk": "Chôdza v km",
      "admin.kmPerPoint": "Km na 1 bod",
      "admin.maxPerDay": "Max. bodov za deň",
      "admin.save": "Uložiť nastavenia pre tento mesiac",
      "admin.users": "Používatelia",
      "admin.usersDesc": "Prehľad registrovaných účtov a bodov v aktuálnom mesiaci.",
      "admin.search": "Meno alebo e-mail…",
      "admin.drawTitle": "Simulácia uzatvorenia mesiaca",
      "admin.drawDesc": "Spustí žrebovanie (3 hlavné + 97 menších), pity timer 1.5^n a vynuluje mesačné body.",
      "admin.drawBtn": "Uzatvoriť mesiac a spustiť žrebovanie",
      "admin.drawWarn": "Testovacia akcia – v produkcii len po skutočnom konci mesiaca.",
      "admin.drawResult": "Výsledok žrebovania",
      "admin.language": "Jazyk",
      "admin.langSk": "Slovenčina",
      "admin.langEn": "English",
    },
    en: {
      "admin.title": "Walk – Admin",
      "admin.brand": "Administration",
      "admin.nav.settings": "Monthly settings",
      "admin.nav.users": "Users",
      "admin.nav.draw": "Close month",
      "admin.demo": "Demo data",
      "admin.ready": "Ready for Supabase",
      "admin.back": "← Back to app",
      "admin.platform": "Platform management",
      "admin.currentMonth": "Current month: {month}",
      "admin.mockApi": "Mock API",
      "admin.monthSettings": "Current month settings",
      "admin.monthDesc": "Global settings for all users this month.",
      "admin.prizeLegend": "Monthly prize fund",
      "admin.prizeLabel": "Prize fund amount (€)",
      "admin.prizePlaceholder": "Empty = from subscribers",
      "admin.prizeHint": "Leave empty or 0 – amounts from active subscribers ({price} / month). If you enter a sum, the full pool goes to winners only.",
      "admin.revenueLegend": "Subscription revenue (preview)",
      "admin.goalLegend": "Point difficulty",
      "admin.goalType": "Goal type",
      "admin.goalWalk": "Walking (km)",
      "admin.kmPerPoint": "Km per 1 point",
      "admin.maxPerDay": "Max points per day",
      "admin.save": "Save settings for this month",
      "admin.users": "Users",
      "admin.usersDesc": "Registered accounts and points this month.",
      "admin.search": "Name or email…",
      "admin.drawTitle": "Month close simulation",
      "admin.drawDesc": "Runs draw (3 main + 97 smaller), pity 1.5^n, resets monthly points.",
      "admin.drawBtn": "Close month and run draw",
      "admin.drawWarn": "Test action – use only after month end in production.",
      "admin.drawResult": "Draw results",
      "admin.language": "Language",
      "admin.langSk": "Slovenčina",
      "admin.langEn": "English",
    },
  };

  let currentLang = "sk";

  function getScope() {
    if (typeof document !== "undefined") {
      const scope = document.documentElement?.dataset?.i18nScope;
      if (scope === "admin" || scope === "app") return scope;
      const path = location.pathname || location.href || "";
      if (/admin\.html/i.test(path)) return "admin";
    }
    return "app";
  }

  function langStorageKey(scope) {
    return scope === "admin" ? LANG_KEY_ADMIN : LANG_KEY_APP;
  }

  function readStoredLang(scope) {
    try {
      const key = langStorageKey(scope);
      let saved = localStorage.getItem(key);
      if (saved !== "en" && saved !== "sk") {
        const legacy = localStorage.getItem(LANG_KEY_LEGACY);
        if (legacy === "en" || legacy === "sk") saved = legacy;
      }
      if ((saved !== "en" && saved !== "sk") && scope === "app") {
        const settings = localStorage.getItem("chodza-settings");
        if (settings) {
          const s = JSON.parse(settings);
          if (s.lang === "en" || s.lang === "sk") saved = s.lang;
        }
      }
      return saved === "en" || saved === "sk" ? saved : null;
    } catch (_) {
      return null;
    }
  }

  function getLang(scope) {
    if (scope === "admin" || scope === "app") {
      return readStoredLang(scope) || "sk";
    }
    return currentLang;
  }

  function getLocale() {
    return currentLang === "en" ? "en-GB" : "sk-SK";
  }

  function setLang(lang, scope) {
    if (lang !== "sk" && lang !== "en") return;
    const target = scope === "admin" || scope === "app" ? scope : getScope();
    if (target === getScope()) currentLang = lang;
    try {
      localStorage.setItem(langStorageKey(target), lang);
    } catch (_) {}
    if (target === getScope()) document.documentElement.lang = lang;
  }

  function initLang() {
    const scope = getScope();
    currentLang = readStoredLang(scope) || "sk";
    document.documentElement.lang = currentLang;
  }

  function t(key, params, ns) {
    const table = ns === "admin" ? adminMessages[currentLang] : messages[currentLang];
    const fallbackTable = ns === "admin" ? adminMessages.sk : messages.sk;
    let str = table?.[key] ?? fallbackTable?.[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  }

  function formatPrice() {
    return SUBSCRIPTION_PRICE.toLocaleString(getLocale(), {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    });
  }

  function applyStatic(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const ns = el.getAttribute("data-i18n-ns");
      const val = t(key, null, ns === "admin" ? "admin" : null);
      if (el.tagName === "INPUT" && el.type !== "hidden") return;
      if (el.tagName === "TITLE") {
        document.title = val;
        return;
      }
      el.textContent = val;
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"), null, el.getAttribute("data-i18n-ns") === "admin" ? "admin" : null);
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"), null, el.getAttribute("data-i18n-ns") === "admin" ? "admin" : null));
    });
    const titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) {
      const titleNs = titleEl.getAttribute("data-i18n-ns") === "admin" || getScope() === "admin" ? "admin" : null;
      document.title = t(titleEl.getAttribute("data-i18n"), null, titleNs);
    }
    const meta = document.querySelector('meta[name="description"][data-i18n]');
    if (meta) meta.content = t(meta.getAttribute("data-i18n"));
  }

  function getWeekdays() {
    return messages[currentLang]?.weekdays || messages.sk.weekdays;
  }

  root.ChodzaI18n = {
    LANG_KEY_APP,
    LANG_KEY_ADMIN,
    LANG_KEY_LEGACY,
    SUBSCRIPTION_PRICE,
    getScope,
    getLang,
    getLocale,
    setLang,
    initLang,
    t,
    formatPrice,
    applyStatic,
    getWeekdays,
    messages,
    adminMessages,
  };

  initLang();
})(typeof globalThis !== "undefined" ? globalThis : window);
