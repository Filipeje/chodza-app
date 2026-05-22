/**
 * Spoločné ukladanie admin nastavení (index.html + admin.html).
 * Pri file:// prehliadač nezdieľa localStorage medzi súbormi – preto aj #cfg= v URL.
 */
(function (root) {
  const GOAL_KEY = "chodza-admin-goal";
  const ACTIVE_KEY = "chodza-active-settings";
  const MONTH_PREFIX = "chodza-month-settings-";
  const WINDOW_BRIDGE = "chodza-settings:";

  function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function decodeHash() {
    const m = (root.location?.hash || "").match(/^#cfg=([^,]+),([^,]+),([^,]+)$/);
    if (!m) return null;
    const goalKmPerPoint = Number(m[1]);
    const maxPointsPerDay = Number(m[2]);
    const prizePoolEur = Number(m[3]);
    if (!Number.isFinite(goalKmPerPoint) || goalKmPerPoint < 1) return null;
    return {
      goalKmPerPoint,
      maxPointsPerDay: Number.isFinite(maxPointsPerDay) ? maxPointsPerDay : 3,
      prizePoolEur: Number.isFinite(prizePoolEur) ? prizePoolEur : 0,
    };
  }

  function encodeHash(data) {
    const g = data.goalKmPerPoint;
    const m = data.maxPointsPerDay ?? 3;
    const p = data.prizePoolEur ?? 0;
    return `#cfg=${g},${m},${p}`;
  }

  function pushWindowBridge(data) {
    try {
      root.name = WINDOW_BRIDGE + JSON.stringify(data);
    } catch (_) {}
  }

  function pullWindowBridge() {
    const name = root.name || "";
    if (!name.startsWith(WINDOW_BRIDGE)) return null;
    try {
      return JSON.parse(name.slice(WINDOW_BRIDGE.length));
    } catch (_) {
      return null;
    }
  }

  function clearWindowBridge() {
    if ((root.name || "").startsWith(WINDOW_BRIDGE)) root.name = "";
  }

  function pickNumber(...vals) {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  function read(monthKey) {
    const key = monthKey || currentMonthKey();
    let month = null;
    let active = null;
    const fromHash = decodeHash();
    const fromBridge = pullWindowBridge();

    try {
      const rawMonth = localStorage.getItem(MONTH_PREFIX + key);
      if (rawMonth) month = JSON.parse(rawMonth);
    } catch (_) {}

    try {
      const rawActive = localStorage.getItem(ACTIVE_KEY);
      if (rawActive) active = JSON.parse(rawActive);
    } catch (_) {}

    const goalFromShortcut = Number(localStorage.getItem(GOAL_KEY));

    const goalKmPerPoint =
      pickNumber(
        fromHash?.goalKmPerPoint,
        fromBridge?.goalKmPerPoint,
        active?.goalKmPerPoint,
        month?.goalKmPerPoint,
        goalFromShortcut
      ) ?? 10;

    const maxPointsPerDay =
      pickNumber(fromHash?.maxPointsPerDay, fromBridge?.maxPointsPerDay, active?.maxPointsPerDay, month?.maxPointsPerDay) ??
      3;

    const prizePoolEur =
      pickNumber(fromHash?.prizePoolEur, fromBridge?.prizePoolEur, active?.prizePoolEur, month?.prizePoolEur) ?? 1500;

    return {
      monthKey: key,
      goalType: fromBridge?.goalType || active?.goalType || month?.goalType || "walk_km",
      goalKmPerPoint,
      maxPointsPerDay,
      prizePoolEur,
      updatedAt: fromBridge?.updatedAt || active?.updatedAt || month?.updatedAt || null,
    };
  }

  function write(monthKey, payload) {
    const key = monthKey || currentMonthKey();
    const data = {
      monthKey: key,
      goalType: payload.goalType || "walk_km",
      goalKmPerPoint: Number(payload.goalKmPerPoint),
      maxPointsPerDay: Number(payload.maxPointsPerDay) || 3,
      prizePoolEur: Number(payload.prizePoolEur) || 0,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(MONTH_PREFIX + key, JSON.stringify(data));
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(data));
      localStorage.setItem(GOAL_KEY, String(data.goalKmPerPoint));
    } catch (_) {}

    pushWindowBridge(data);

    try {
      root.dispatchEvent(new CustomEvent("chodza-settings-changed", { detail: data }));
    } catch (_) {}

    return data;
  }

  /** Zapíše nastavenia z hash / window.name do localStorage (index po návrate z adminu). */
  function importBridge(monthKey) {
    const key = monthKey || currentMonthKey();
    const merged = read(key);
    write(key, merged);
    clearWindowBridge();
    return merged;
  }

  function indexUrlFor(data) {
    const base = "index.html";
    const q = new URLSearchParams({
      goalKm: String(data.goalKmPerPoint),
      maxPoints: String(data.maxPointsPerDay),
    });
    return `${base}?${q.toString()}${encodeHash(data)}`;
  }

  root.ChodzaSettings = {
    read,
    write,
    importBridge,
    indexUrlFor,
    encodeHash,
    decodeHash,
    currentMonthKey,
    GOAL_KEY,
    ACTIVE_KEY,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
