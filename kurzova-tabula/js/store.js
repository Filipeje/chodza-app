/**
 * Kurzová tabuľa – lokálne úložisko (MVP bez backendu).
 * Neskôr nahradíme Supabase / API.
 */
(function (global) {
  const STORAGE_KEY = "kurzova-tabula-v1";
  const SESSION_KEY = "kurzova-tabula-session";

  const DEFAULT_CURRENCIES = [
    { code: "EUR", name: "Euro", buy: "1.000", sell: "1.000" },
    { code: "USD", name: "Americký dolár", buy: "0.920", sell: "0.950" },
    { code: "GBP", name: "Britská libra", buy: "1.150", sell: "1.190" },
    { code: "CZK", name: "Česká koruna", buy: "0.038", sell: "0.042" },
    { code: "HUF", name: "Maďarský forint", buy: "0.0024", sell: "0.0027" },
    { code: "CHF", name: "Švajčiarsky frank", buy: "1.020", sell: "1.060" },
    { code: "PLN", name: "Poľský zlotý", buy: "0.220", sell: "0.240" },
  ];

  function uid(prefix) {
    return (
      (prefix || "id") +
      "-" +
      Math.random().toString(36).slice(2, 8) +
      Date.now().toString(36).slice(-4)
    );
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { users: [], boards: [] };
      const data = JSON.parse(raw);
      return {
        users: Array.isArray(data.users) ? data.users : [],
        boards: Array.isArray(data.boards) ? data.boards : [],
      };
    } catch {
      return { users: [], boards: [] };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function slugify(text) {
    return String(text || "tabula")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "tabula";
  }

  function uniqueSlug(base, boards, excludeId) {
    let slug = slugify(base);
    let n = 0;
    while (
      boards.some((b) => b.slug === slug && b.id !== excludeId)
    ) {
      n += 1;
      slug = slugify(base) + "-" + n;
    }
    return slug;
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(userId) {
    if (!userId) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const data = load();
    return data.users.find((u) => u.id === session.userId) || null;
  }

  function register({ name, email, password, companyName }) {
    const data = load();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !password || password.length < 4) {
      throw new Error("Vyplňte e-mail a heslo (min. 4 znaky).");
    }
    if (data.users.some((u) => u.email === cleanEmail)) {
      throw new Error("Účet s týmto e-mailom už existuje.");
    }

    const user = {
      id: uid("user"),
      name: String(name || "").trim() || "Zmenárnik",
      email: cleanEmail,
      password: String(password),
      createdAt: new Date().toISOString(),
    };

    const boardName = String(companyName || "").trim() || "Moja zmenáreň";
    const board = {
      id: uid("board"),
      userId: user.id,
      slug: uniqueSlug(boardName, data.boards),
      companyName: boardName,
      showTime: true,
      showDate: true,
      footerText: "Kurzy sú orientačné a môžu sa meniť počas dňa.",
      currencies: DEFAULT_CURRENCIES.slice(0, 4).map((c, i) => ({
        ...c,
        id: uid("cur"),
        order: i,
      })),
      updatedAt: new Date().toISOString(),
    };

    data.users.push(user);
    data.boards.push(board);
    save(data);
    setSession(user.id);
    return { user, board };
  }

  function login(email, password) {
    const data = load();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const user = data.users.find(
      (u) => u.email === cleanEmail && u.password === String(password)
    );
    if (!user) throw new Error("Nesprávny e-mail alebo heslo.");
    setSession(user.id);
    return user;
  }

  function logout() {
    setSession(null);
  }

  function getBoardForUser(userId) {
    const data = load();
    return data.boards.find((b) => b.userId === userId) || null;
  }

  function getBoardBySlug(slug) {
    const data = load();
    return data.boards.find((b) => b.slug === slug) || null;
  }

  function getBoardById(id) {
    const data = load();
    return data.boards.find((b) => b.id === id) || null;
  }

  function updateBoard(boardId, patch) {
    const data = load();
    const idx = data.boards.findIndex((b) => b.id === boardId);
    if (idx < 0) throw new Error("Tabuľa neexistuje.");

    const current = data.boards[idx];
    const next = {
      ...current,
      ...patch,
      id: current.id,
      userId: current.userId,
      updatedAt: new Date().toISOString(),
    };

    if (patch.companyName && patch.companyName !== current.companyName) {
      next.slug = uniqueSlug(patch.companyName, data.boards, current.id);
    }

    if (Array.isArray(patch.currencies)) {
      next.currencies = patch.currencies.map((c, i) => ({
        id: c.id || uid("cur"),
        code: String(c.code || "").toUpperCase().slice(0, 6),
        name: String(c.name || c.code || "").trim(),
        buy: String(c.buy ?? "").trim(),
        sell: String(c.sell ?? "").trim(),
        order: typeof c.order === "number" ? c.order : i,
      }));
    }

    data.boards[idx] = next;
    save(data);
    return next;
  }

  function requireAuth(redirectTo) {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = redirectTo || "index.html";
      return null;
    }
    return user;
  }

  global.KurzovaStore = {
    DEFAULT_CURRENCIES,
    register,
    login,
    logout,
    getCurrentUser,
    getBoardForUser,
    getBoardBySlug,
    getBoardById,
    updateBoard,
    requireAuth,
    uid,
  };
})(window);
