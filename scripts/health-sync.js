/**
 * Synchronizácia km z Apple Health / Google Health Connect.
 * Web: demo simulácia + hodinový interval. Natívna app: doplní window.ChodzaHealthBridge.getTodayWalkingKm().
 */
(function (root) {
  const SYNC_INTERVAL_MS = 60 * 60 * 1000;
  const STORAGE_PREFIX = "chodza-health-km-";
  const LAST_SYNC_KEY = "chodza-health-last-sync";
  const NOTIFY_LOG_KEY = "chodza-notify-log";

  let config = null;
  let timerId = null;

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function t(key, params) {
    return config?.t ? config.t(key, params) : key;
  }

  function isHealthLinked() {
    if (config?.isHealthLinked) return !!config.isHealthLinked();
    return false;
  }

  function isNotifyOn() {
    if (config?.isNotifyEnabled) return !!config.isNotifyEnabled();
    return false;
  }

  function getLastSyncIso() {
    try {
      return localStorage.getItem(LAST_SYNC_KEY);
    } catch (_) {
      return null;
    }
  }

  function setLastSyncNow() {
    try {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch (_) {}
    updateSyncStatusUi();
  }

  function formatLastSync() {
    const iso = getLastSyncIso();
    if (!iso) return t("health.neverSynced");
    try {
      return new Date(iso).toLocaleString(
        typeof ChodzaI18n !== "undefined" ? ChodzaI18n.getLocale() : "sk-SK",
        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
      );
    } catch (_) {
      return iso;
    }
  }

  function updateSyncStatusUi() {
    const el = document.getElementById("health-sync-status");
    const syncBtn = document.getElementById("sync-btn");
    const linked = isHealthLinked();

    if (syncBtn) syncBtn.hidden = linked;

    if (!el) return;
    if (!linked) {
      el.textContent = t("health.notLinked");
      el.className = "health-sync-status health-sync-status--off";
      return;
    }
    el.textContent = t("health.lastSync", { time: formatLastSync() });
    el.className = "health-sync-status health-sync-status--on";
  }

  /** Demo: realistický nárast km počas dňa (do natívneho bridge) */
  function fetchDemoHealthKm() {
    const day = todayIso();
    const key = STORAGE_PREFIX + day;
    let km = 0;
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) km = Number(raw);
    } catch (_) {}

    const hour = new Date().getHours();
    const dayCap = 6 + (hour / 24) * 12;
    const increment = 0.15 + Math.random() * 0.85;
    km = Math.min(dayCap, Math.max(0, km + increment));
    km = Math.round(km * 10) / 10;

    try {
      localStorage.setItem(key, String(km));
    } catch (_) {}

    return km;
  }

  async function fetchKmFromHealth() {
    const bridge = root.ChodzaHealthBridge;
    if (bridge?.getTodayWalkingKm) {
      try {
        const km = await bridge.getTodayWalkingKm();
        if (typeof km === "number" && km >= 0) return Math.round(km * 10) / 10;
      } catch (err) {
        console.warn("ChodzaHealthBridge", err);
      }
    }
    if (isHealthLinked()) return fetchDemoHealthKm();
    return null;
  }

  function getMotivationMessage(km, goalKm, maxPts) {
    const pointsFn = config?.getPointsForKm;
    const pts = pointsFn ? pointsFn(km) : Math.floor(km / goalKm);

    if (pts >= maxPts) return { type: "max", text: t("notify.maxPoints", { max: maxPts }) };

    const nextAt = (pts + 1) * goalKm;
    const leftToPoint = Math.max(0, nextAt - km);

    if (pts === 0 && leftToPoint > 0 && leftToPoint <= 2.5) {
      return { type: "almost_point", text: t("notify.almostPoint", { km: leftToPoint.toFixed(1) }) };
    }

    if (pts > 0 && leftToPoint > 0 && leftToPoint <= 2) {
      return { type: "almost_next", text: t("notify.almostNext", { km: leftToPoint.toFixed(1) }) };
    }

    const hour = new Date().getHours();
    if (hour >= 16 && hour <= 21 && pts < maxPts && leftToPoint > 0 && leftToPoint <= 4) {
      return { type: "evening", text: t("notify.eveningPush", { km: leftToPoint.toFixed(1) }) };
    }

    return null;
  }

  function wasNotifiedToday(type) {
    try {
      const log = JSON.parse(localStorage.getItem(NOTIFY_LOG_KEY) || "{}");
      return log[todayIso()]?.[type] === true;
    } catch (_) {
      return false;
    }
  }

  function markNotified(type) {
    try {
      const log = JSON.parse(localStorage.getItem(NOTIFY_LOG_KEY) || "{}");
      const day = todayIso();
      log[day] = log[day] || {};
      log[day][type] = true;
      localStorage.setItem(NOTIFY_LOG_KEY, JSON.stringify(log));
    } catch (_) {}
  }

  async function requestNotifyPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      const p = await Notification.requestPermission();
      return p === "granted";
    } catch (_) {
      return false;
    }
  }

  async function showMotivationNotification(msg, type) {
    if (!msg || !isNotifyOn() || wasNotifiedToday(type)) return;

    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") {
      const ok = await requestNotifyPermission();
      if (!ok) return;
    }

    try {
      const n = new Notification(t("notify.title"), {
        body: msg,
        tag: `chodza-${type}-${todayIso()}`,
        renotify: false,
      });
      markNotified(type);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (_) {}
  }

  async function syncFromHealth(options = {}) {
    if (!config) return { ok: false, reason: "no_config" };

    const silent = !!options.silent;
    const forceManual = !!options.manual;

    if (!forceManual && !isHealthLinked()) {
      return { ok: false, reason: "not_linked" };
    }

    let km = await fetchKmFromHealth();

    if (km == null && forceManual) {
      const extra = 0.5 + Math.random() * 2.5;
      const cur = config.getState?.().kmToday ?? 0;
      km = Math.round((cur + extra) * 10) / 10;
    }

    if (km == null) return { ok: false, reason: "no_data" };

    const prev = config.getState?.().kmToday ?? 0;
    if (config.onKmUpdated) config.onKmUpdated(km, { prev, source: forceManual ? "manual" : "health" });

    setLastSyncNow();

    if (!silent && isNotifyOn()) {
      const goalKm = config.getGoalKm?.() ?? 10;
      const maxPts = config.getMaxPoints?.() ?? 3;
      const motivation = getMotivationMessage(km, goalKm, maxPts);
      if (motivation) await showMotivationNotification(motivation.text, motivation.type);
    }

    return { ok: true, km, prev };
  }

  function startAutoSync() {
    stopAutoSync();
    if (!isHealthLinked()) {
      updateSyncStatusUi();
      return;
    }

    syncFromHealth({ silent: false });

    timerId = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncFromHealth({ silent: false });
      }
    }, SYNC_INTERVAL_MS);

    updateSyncStatusUi();
  }

  function stopAutoSync() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function init(cfg) {
    config = cfg;
    updateSyncStatusUi();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isHealthLinked()) {
        syncFromHealth({ silent: false });
      }
    });

    if (isHealthLinked()) startAutoSync();
  }

  function onHealthLinkedChanged(linked) {
    if (linked) startAutoSync();
    else {
      stopAutoSync();
      updateSyncStatusUi();
    }
  }

  async function connectHealth() {
    const bridge = root.ChodzaHealthBridge;
    if (bridge?.requestPermissions) {
      try {
        await bridge.requestPermissions();
      } catch (_) {}
    }

    const user = typeof ChodzaAuth !== "undefined" ? ChodzaAuth.getCurrentUser() : null;
    if (user && typeof ChodzaAuth.updateProfile === "function") {
      ChodzaAuth.updateProfile(user.email, { healthLinked: true });
    }

    if (isNotifyOn()) await requestNotifyPermission();

    onHealthLinkedChanged(true);
    await syncFromHealth({ silent: false });
    return true;
  }

  root.ChodzaHealthSync = {
    init,
    syncFromHealth,
    startAutoSync,
    stopAutoSync,
    onHealthLinkedChanged,
    connectHealth,
    requestNotifyPermission,
    updateSyncStatusUi,
    formatLastSync,
    isHealthLinked,
    SYNC_INTERVAL_MS,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
