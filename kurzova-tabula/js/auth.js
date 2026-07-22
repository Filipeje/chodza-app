(function () {
  const user = window.KurzovaStore.getCurrentUser();
  if (user) {
    window.location.replace("admin.html");
    return;
  }

  const tabRegister = document.getElementById("tab-register");
  const tabLogin = document.getElementById("tab-login");
  const panelRegister = document.getElementById("panel-register");
  const panelLogin = document.getElementById("panel-login");

  function showTab(which) {
    const isRegister = which === "register";
    tabRegister.classList.toggle("is-active", isRegister);
    tabLogin.classList.toggle("is-active", !isRegister);
    tabRegister.setAttribute("aria-selected", String(isRegister));
    tabLogin.setAttribute("aria-selected", String(!isRegister));
    panelRegister.hidden = !isRegister;
    panelLogin.hidden = isRegister;
    panelRegister.classList.toggle("is-active", isRegister);
    panelLogin.classList.toggle("is-active", !isRegister);
  }

  tabRegister.addEventListener("click", () => showTab("register"));
  tabLogin.addEventListener("click", () => showTab("login"));

  document.getElementById("register-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = document.getElementById("register-error");
    err.hidden = true;
    const fd = new FormData(e.target);
    try {
      window.KurzovaStore.register({
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password"),
        companyName: fd.get("companyName"),
      });
      window.location.href = "admin.html";
    } catch (ex) {
      err.textContent = ex.message || "Registrácia zlyhala.";
      err.hidden = false;
    }
  });

  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = document.getElementById("login-error");
    err.hidden = true;
    const fd = new FormData(e.target);
    try {
      window.KurzovaStore.login(fd.get("email"), fd.get("password"));
      window.location.href = "admin.html";
    } catch (ex) {
      err.textContent = ex.message || "Prihlásenie zlyhalo.";
      err.hidden = false;
    }
  });
})();
