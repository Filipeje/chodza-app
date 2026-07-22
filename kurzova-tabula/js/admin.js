(function () {
  const Store = window.KurzovaStore;
  const user = Store.requireAuth("index.html");
  if (!user) return;

  let board = Store.getBoardForUser(user.id);
  if (!board) {
    alert("Tabuľa sa nenašla. Zaregistrujte sa znova.");
    Store.logout();
    window.location.href = "index.html";
    return;
  }

  const userLabel = document.getElementById("user-label");
  const companyName = document.getElementById("companyName");
  const showDate = document.getElementById("showDate");
  const showTime = document.getElementById("showTime");
  const footerText = document.getElementById("footerText");
  const currencyRows = document.getElementById("currency-rows");
  const displayUrlEl = document.getElementById("display-url");
  const openDisplay = document.getElementById("open-display");
  const saveStatus = document.getElementById("save-status");
  const saveError = document.getElementById("save-error");
  const addBox = document.getElementById("add-currency-box");
  const addForm = document.getElementById("add-currency-form");

  let saveTimer = null;

  function displayHref() {
    return new URL("display.html?board=" + encodeURIComponent(board.slug), window.location.href)
      .href;
  }

  function refreshLink() {
    const href = displayHref();
    displayUrlEl.textContent = href;
    openDisplay.href = href;
  }

  function flashSaved() {
    saveError.hidden = true;
    saveStatus.hidden = false;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveStatus.hidden = true;
    }, 1600);
  }

  function showError(msg) {
    saveStatus.hidden = true;
    saveError.textContent = msg;
    saveError.hidden = false;
  }

  function readCurrenciesFromDom() {
    return Array.from(currencyRows.querySelectorAll("tr")).map((tr, i) => ({
      id: tr.dataset.id,
      code: tr.querySelector('[data-field="code"]').value,
      name: tr.querySelector('[data-field="name"]').value,
      buy: tr.querySelector('[data-field="buy"]').value,
      sell: tr.querySelector('[data-field="sell"]').value,
      order: i,
    }));
  }

  function persist(extra) {
    try {
      board = Store.updateBoard(board.id, {
        companyName: companyName.value.trim(),
        showDate: showDate.checked,
        showTime: showTime.checked,
        footerText: footerText.value,
        currencies: readCurrenciesFromDom(),
        ...(extra || {}),
      });
      refreshLink();
      flashSaved();
      return true;
    } catch (ex) {
      showError(ex.message || "Uloženie zlyhalo.");
      return false;
    }
  }

  function renderRows() {
    const sorted = [...board.currencies].sort((a, b) => a.order - b.order);
    currencyRows.innerHTML = sorted
      .map(
        (c) => `
      <tr data-id="${c.id}">
        <td>
          <input class="code-input" data-field="code" value="${escapeAttr(c.code)}" maxlength="6" />
        </td>
        <td>
          <input data-field="name" value="${escapeAttr(c.name)}" />
        </td>
        <td>
          <input class="rate-input" data-field="buy" value="${escapeAttr(c.buy)}" />
        </td>
        <td>
          <input class="rate-input" data-field="sell" value="${escapeAttr(c.sell)}" />
        </td>
        <td>
          <button type="button" class="btn btn-danger btn-remove" data-id="${c.id}">Odstrániť</button>
        </td>
      </tr>`
      )
      .join("");
  }

  function escapeAttr(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function fillForm() {
    userLabel.textContent = user.email;
    companyName.value = board.companyName || "";
    showDate.checked = !!board.showDate;
    showTime.checked = !!board.showTime;
    footerText.value = board.footerText || "";
    renderRows();
    refreshLink();
  }

  function renderPresets() {
    const row = document.getElementById("preset-row");
    const existing = new Set(board.currencies.map((c) => c.code.toUpperCase()));
    row.innerHTML = Store.DEFAULT_CURRENCIES.filter((c) => !existing.has(c.code))
      .map(
        (c) =>
          `<button type="button" class="preset-chip" data-code="${c.code}">${c.code}</button>`
      )
      .join("");
  }

  document.getElementById("logout-btn").addEventListener("click", () => {
    Store.logout();
    window.location.href = "index.html";
  });

  document.getElementById("copy-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(displayHref());
      flashSaved();
      saveStatus.textContent = "Link skopírovaný.";
    } catch {
      showError("Nepodarilo sa skopírovať link.");
    }
  });

  ["companyName", "footerText"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => persist());
    document.getElementById(id).addEventListener("blur", () => persist());
  });
  showDate.addEventListener("change", () => persist());
  showTime.addEventListener("change", () => persist());

  currencyRows.addEventListener("change", (e) => {
    if (e.target.matches("input")) persist();
  });

  currencyRows.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-remove");
    if (!btn) return;
    const id = btn.dataset.id;
    board.currencies = board.currencies.filter((c) => c.id !== id);
    renderRows();
    persist({ currencies: board.currencies });
    renderPresets();
  });

  document.getElementById("add-currency").addEventListener("click", () => {
    addBox.hidden = false;
    renderPresets();
  });

  document.getElementById("cancel-add").addEventListener("click", () => {
    addBox.hidden = true;
    addForm.reset();
  });

  document.getElementById("preset-row").addEventListener("click", (e) => {
    const chip = e.target.closest(".preset-chip");
    if (!chip) return;
    const preset = Store.DEFAULT_CURRENCIES.find((c) => c.code === chip.dataset.code);
    if (!preset) return;
    addForm.code.value = preset.code;
    addForm.name.value = preset.name;
    addForm.buy.value = preset.buy;
    addForm.sell.value = preset.sell;
  });

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const code = String(fd.get("code") || "").toUpperCase().trim();
    if (!code) return;
    if (board.currencies.some((c) => c.code.toUpperCase() === code)) {
      showError("Táto mena už na tabuli je.");
      return;
    }
    board.currencies.push({
      id: Store.uid("cur"),
      code,
      name: String(fd.get("name") || code).trim(),
      buy: String(fd.get("buy") || "").trim(),
      sell: String(fd.get("sell") || "").trim(),
      order: board.currencies.length,
    });
    renderRows();
    persist({ currencies: board.currencies });
    addForm.reset();
    addBox.hidden = true;
    renderPresets();
  });

  fillForm();
})();
