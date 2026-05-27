(function () {
  if (typeof ChodzaAuth !== "undefined" && ChodzaAuth.isLoggedIn()) {
    location.replace("index.html");
    return;
  }

  const form = document.getElementById("login-form");
  const toast = document.getElementById("toast");

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

  document.querySelectorAll("[data-pw-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.getAttribute("data-pw-toggle"));
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    document.getElementById("err-login-email").textContent = "";
    document.getElementById("err-login-password").textContent = "";

    const result = ChodzaAuth.login(email, password);
    if (!result.ok) {
      document.getElementById("err-login-password").textContent = "Nesprávny e-mail alebo heslo.";
      return;
    }
    location.href = "index.html";
  });
})();
