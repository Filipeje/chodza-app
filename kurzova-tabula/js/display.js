(function () {
  const Store = window.KurzovaStore;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("board");

  const boardEl = document.getElementById("board");
  const emptyEl = document.getElementById("empty");
  const companyEl = document.getElementById("company-name");
  const clockWrap = document.getElementById("clock-wrap");
  const dateEl = document.getElementById("board-date");
  const timeEl = document.getElementById("board-time");
  const ratesEl = document.getElementById("rates");
  const footerEl = document.getElementById("footer");

  let board = slug ? Store.getBoardBySlug(slug) : null;

  // Fallback: ak je používateľ prihlásený a nemá slug, ukáž jeho tabuľu
  if (!board) {
    const user = Store.getCurrentUser();
    if (user) board = Store.getBoardForUser(user.id);
  }

  if (!board) {
    emptyEl.hidden = false;
    boardEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  boardEl.hidden = false;
  document.title = (board.companyName || "Kurzový lístok") + " – kurzy";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderRates() {
    const sorted = [...board.currencies].sort((a, b) => a.order - b.order);
    ratesEl.innerHTML = sorted
      .map(
        (c, i) => `
      <div class="rate-row" role="row" style="animation-delay:${i * 40}ms">
        <div class="rate-row__name" role="cell">
          <span class="rate-row__code">${escapeHtml(c.code)}</span>
          <span class="rate-row__label">${escapeHtml(c.name)}</span>
        </div>
        <div class="rate-row__buy" role="cell">${escapeHtml(c.buy)}</div>
        <div class="rate-row__sell" role="cell">${escapeHtml(c.sell)}</div>
      </div>`
      )
      .join("");
  }

  function renderMeta() {
    companyEl.textContent = board.companyName || "Zmenáreň";
    const showClock = board.showDate || board.showTime;
    clockWrap.hidden = !showClock;
    dateEl.hidden = !board.showDate;
    timeEl.hidden = !board.showTime;

    const footer = String(board.footerText || "").trim();
    if (footer) {
      footerEl.hidden = false;
      footerEl.textContent = footer;
    } else {
      footerEl.hidden = true;
      footerEl.textContent = "";
    }
  }

  function tickClock() {
    const now = new Date();
    if (board.showDate) {
      dateEl.textContent = now.toLocaleDateString("sk-SK", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (board.showTime) {
      timeEl.textContent = now.toLocaleTimeString("sk-SK", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
  }

  function refreshFromStorage() {
    const fresh = Store.getBoardBySlug(board.slug) || Store.getBoardById(board.id);
    if (!fresh) return;
    board = fresh;
    renderMeta();
    renderRates();
    tickClock();
  }

  renderMeta();
  renderRates();
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(refreshFromStorage, 3000);

  // Kiosk tip: F11 fullscreen. Escape / myš môže zrušiť – neskôr Electron/kiosk.
})();
