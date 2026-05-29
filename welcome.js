(function () {
  const form = document.getElementById("register-form");
  const healthBtn = document.getElementById("btn-health");
  const toast = document.getElementById("toast");
  let healthLinked = false;

  function showToast(msg, isError) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.toggle("welcome-toast--error", !!isError);
    toast.classList.add("welcome-toast--show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.classList.remove("welcome-toast--show");
      toast.hidden = true;
    }, isError ? 6000 : 4000);
  }

  function showFileProtocolHint() {
    if (location.protocol !== "file:") return;
    const hero = document.querySelector(".welcome-hero");
    if (!hero || document.getElementById("file-protocol-hint")) return;
    const hint = document.createElement("p");
    hint.id = "file-protocol-hint";
    hint.className = "welcome-file-hint";
    hint.innerHTML =
      "Stránku otváraš ako súbor (<code>file://</code>). Pre spoľahlivú registráciu spusti v priečinku projektu príkaz <code>npx serve .</code> a otvor <code>http://localhost:3000/welcome.html</code>.";
    hero.appendChild(hint);
  }

  function bootError(msg) {
    showFileProtocolHint();
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        showToast(msg, true);
      });
    } else {
      document.body.insertAdjacentHTML(
        "afterbegin",
        `<p class="welcome-file-hint" style="margin:1rem">${msg}</p>`
      );
    }
  }

  if (typeof ChodzaAuth === "undefined") {
    bootError("Chýba auth-store.js – skontroluj, či existuje priečinok scripts/ a obnov stránku.");
    return;
  }

  if (ChodzaAuth.isLoggedIn()) {
    location.replace("index.html");
    return;
  }

  if (!form || !healthBtn) {
    bootError("Formulár sa nenačítal správne. Obnov stránku (F5).");
    return;
  }

  showFileProtocolHint();

  function setFieldError(fieldId, msg) {
    const errEl = document.getElementById(`err-${fieldId}`);
    const field = document.getElementById(fieldId);
    if (errEl) errEl.textContent = msg || "";
    if (field) field.classList.toggle("field__input--error", !!msg);
  }

  function clearErrors() {
    ["first-name", "last-name", "username", "email", "password", "password-confirm", "iban"].forEach((id) =>
      setFieldError(id, "")
    );
    const gdprErr = document.getElementById("err-gdpr");
    if (gdprErr) gdprErr.textContent = "";
  }

  function scrollToFirstError() {
    const first = form.querySelector(".field__input--error, #err-gdpr:not(:empty)");
    const target =
      first?.classList?.contains("field__input")
        ? first
        : form.querySelector(".field__input--error") || document.getElementById("gdpr");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target.focus) target.focus();
    }
  }

  document.querySelectorAll("[data-pw-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.getAttribute("data-pw-toggle"));
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-label", show ? "Skryť heslo" : "Zobraziť heslo");
    });
  });

  function updateHealthButtonUi() {
    const done = document.getElementById("btn-health-done");
    healthBtn.classList.toggle("btn-health-connect--linked", healthLinked);
    healthBtn.setAttribute("aria-pressed", String(healthLinked));
    healthBtn.textContent = healthLinked
      ? "✓ Health prepojený"
      : "🍎 Prepojiť Apple Health / Google Health Connect";
    if (done) done.hidden = !healthLinked;
  }

  updateHealthButtonUi();

  healthBtn.addEventListener("click", () => {
    healthLinked = !healthLinked;
    updateHealthButtonUi();
    if (healthLinked) {
      showToast(
        "Health prepojené. Po registrácii sa km budú aktualizovať automaticky (každú hodinu)."
      );
    } else {
      showToast("Prepojenie Health zrušené. Môžeš ho zapnúť znova kliknutím.");
    }
  });

  document.getElementById("link-vop")?.addEventListener("click", (e) => {
    e.preventDefault();
    showToast("VOP budú dostupné pred spustením produkcie.");
  });
  document.getElementById("link-gdpr")?.addEventListener("click", (e) => {
    e.preventDefault();
    showToast("GDPR dokument bude dostupný pred spustením produkcie.");
  });

  function validateIban(raw) {
    const iban = String(raw || "")
      .replace(/\s/g, "")
      .toUpperCase();
    if (!iban) return { ok: true, value: "" };
    if (/^SK[0-9]{22}$/.test(iban)) return { ok: true, value: iban };
    if (iban.length >= 15 && iban.length <= 34 && /^[A-Z]{2}[0-9A-Z]+$/.test(iban)) {
      return { ok: true, value: iban };
    }
    return {
      ok: false,
      msg: "IBAN nie je platný (SK + 22 číslic) alebo pole nechaj prázdne.",
    };
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors();

    const submitBtn = document.getElementById("btn-register");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const firstName = document.getElementById("first-name").value.trim();
      const lastName = document.getElementById("last-name").value.trim();
      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const passwordConfirm = document.getElementById("password-confirm").value;
      const city = document.getElementById("city").value.trim();
      const ibanRaw = document.getElementById("iban").value;
      const gdpr = document.getElementById("gdpr").checked;

      let valid = true;

      if (!firstName) {
        setFieldError("first-name", "Zadaj meno.");
        valid = false;
      }
      if (!lastName) {
        setFieldError("last-name", "Zadaj priezvisko.");
        valid = false;
      }
      if (!/^[a-zA-Z0-9_.\-]{3,24}$/.test(username)) {
        setFieldError("username", "Nick: 3–24 znakov (písmená, čísla, _ . -).");
        valid = false;
      } else if (ChodzaAuth.findByUsername(username)) {
        setFieldError("username", "Toto používateľské meno je už obsadené.");
        valid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError("email", "Zadaj platný e-mail.");
        valid = false;
      }
      if (password.length < 8) {
        setFieldError("password", "Heslo musí mať aspoň 8 znakov.");
        valid = false;
      }
      if (password !== passwordConfirm) {
        setFieldError("password-confirm", "Heslá sa nezhodujú.");
        valid = false;
      }

      const ibanCheck = validateIban(ibanRaw);
      if (!ibanCheck.ok) {
        setFieldError("iban", ibanCheck.msg);
        valid = false;
      }

      if (!gdpr) {
        document.getElementById("err-gdpr").textContent = "Bez súhlasu sa nemôžeš zaregistrovať.";
        valid = false;
      }

      if (!valid) {
        showToast("Skontroluj červené polia vo formulári.", true);
        scrollToFirstError();
        return;
      }

      const planInput = document.querySelector('input[name="subscriptionPlan"]:checked');
      const subscriptionPlan = planInput ? planInput.value : "plus";

      const result = ChodzaAuth.register({
        firstName,
        lastName,
        username,
        email,
        password,
        city,
        iban: ibanCheck.value,
        healthLinked,
        gdprAccepted: gdpr,
        subscriptionPlan,
      });

      if (!result.ok) {
        if (result.error === "email_taken") setFieldError("email", "Tento e-mail je už registrovaný.");
        else if (result.error === "username_taken") setFieldError("username", "Nick je už obsadený.");
        else showToast("Registrácia zlyhala. Skús to znova.", true);
        scrollToFirstError();
        return;
      }

      showToast("Vitaj v Chôdzi! Presmerovávam…");
      setTimeout(() => {
        location.href = "index.html";
      }, 600);
    } catch (err) {
      console.error(err);
      showToast(
        "Registrácia zlyhala: " + (err?.message || "neznáma chyba") + ". Skús otvoriť stránku cez http://localhost:3000/welcome.html",
        true
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
