/**
 * Jedlo – odfotení + AI odhad kalórií (Google Gemini Flash, bezplatný kľúč).
 */
(function (root) {
  const KEY_STORAGE = "chodza-gemini-key";
  const LOG_STORAGE = "chodza-food-log";
  const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  const MAX_IMAGE_EDGE = 1280;
  const JPEG_QUALITY = 0.82;

  const el = (id) => document.getElementById(id);

  function t(key, params) {
    return typeof ChodzaI18n !== "undefined" ? ChodzaI18n.t(key, params) : key;
  }

  function loc() {
    return typeof ChodzaI18n !== "undefined" ? ChodzaI18n.getLocale() : "sk-SK";
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function loadKey() {
    return (localStorage.getItem(KEY_STORAGE) || "").trim();
  }

  function saveKey(key) {
    localStorage.setItem(KEY_STORAGE, (key || "").trim());
  }

  function loadLog() {
    try {
      const raw = localStorage.getItem(LOG_STORAGE);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function saveLog(log) {
    localStorage.setItem(LOG_STORAGE, JSON.stringify(log));
  }

  function mealsToday() {
    const log = loadLog();
    return Array.isArray(log[todayKey()]) ? log[todayKey()] : [];
  }

  function addMeal(meal) {
    const log = loadLog();
    const key = todayKey();
    if (!Array.isArray(log[key])) log[key] = [];
    log[key].unshift(meal);
    // keep last 14 days
    const keys = Object.keys(log).sort();
    while (keys.length > 14) {
      delete log[keys.shift()];
    }
    saveLog(log);
  }

  function deleteMeal(id) {
    const log = loadLog();
    const key = todayKey();
    if (!Array.isArray(log[key])) return;
    log[key] = log[key].filter((m) => m.id !== id);
    saveLog(log);
  }

  function sumTodayKcal() {
    return mealsToday().reduce((s, m) => s + (Number(m.total_kcal) || 0), 0);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image_load_failed"));
      img.src = dataUrl;
    });
  }

  async function compressImage(file) {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    const maxEdge = Math.max(img.width, img.height);
    const scale = maxEdge > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / maxEdge : 1;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = out.split(",")[1] || "";
    return { dataUrl: out, base64, mimeType: "image/jpeg" };
  }

  function extractJson(text) {
    if (!text) throw new Error("empty_response");
    const cleaned = String(text)
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error("bad_json");
    }
  }

  function normalizeResult(raw) {
    const items = Array.isArray(raw.items)
      ? raw.items.map((it) => ({
          name: String(it.name || it.food || "Jedlo").trim(),
          portion_g: Math.round(Number(it.portion_g ?? it.grams ?? 0) || 0),
          kcal: Math.round(Number(it.kcal ?? it.calories ?? 0) || 0),
          protein_g: Math.round((Number(it.protein_g ?? it.protein ?? 0) || 0) * 10) / 10,
          carbs_g: Math.round((Number(it.carbs_g ?? it.carbs ?? 0) || 0) * 10) / 10,
          fat_g: Math.round((Number(it.fat_g ?? it.fat ?? 0) || 0) * 10) / 10,
        }))
      : [];

    const total_kcal =
      Math.round(Number(raw.total_kcal ?? raw.calories ?? 0) || 0) ||
      items.reduce((s, i) => s + i.kcal, 0);
    const total_protein_g =
      Math.round((Number(raw.total_protein_g ?? 0) || 0) * 10) / 10 ||
      Math.round(items.reduce((s, i) => s + i.protein_g, 0) * 10) / 10;
    const total_carbs_g =
      Math.round((Number(raw.total_carbs_g ?? 0) || 0) * 10) / 10 ||
      Math.round(items.reduce((s, i) => s + i.carbs_g, 0) * 10) / 10;
    const total_fat_g =
      Math.round((Number(raw.total_fat_g ?? 0) || 0) * 10) / 10 ||
      Math.round(items.reduce((s, i) => s + i.fat_g, 0) * 10) / 10;

    return {
      dish_name: String(raw.dish_name || raw.name || items[0]?.name || "Jedlo").trim(),
      items,
      total_kcal,
      total_protein_g,
      total_carbs_g,
      total_fat_g,
      confidence: Math.min(1, Math.max(0, Number(raw.confidence ?? 0.7) || 0.7)),
      notes: String(raw.notes || "").trim(),
    };
  }

  async function analyzeWithGemini(base64, mimeType, apiKey) {
    const lang = typeof ChodzaI18n !== "undefined" && ChodzaI18n.getLang?.() === "en" ? "en" : "sk";
    const prompt =
      lang === "en"
        ? `You are a nutrition expert. Analyze this food photo.
Estimate the visible dish, portion sizes in grams, and calories.
Return ONLY valid JSON (no markdown) with this shape:
{"dish_name":"string","items":[{"name":"string","portion_g":number,"kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number}],"total_kcal":number,"total_protein_g":number,"total_carbs_g":number,"total_fat_g":number,"confidence":0.0-1.0,"notes":"short note about estimate uncertainty"}
If it is not food, still return JSON with dish_name "Not food", empty items, zeros, and notes explaining.`
        : `Si nutričný expert. Analyzuj túto fotku jedla.
Odhadni viditeľné jedlo, veľkosti porcií v gramoch a kalórie.
Vráť IBA platný JSON (bez markdown) v tvare:
{"dish_name":"string","items":[{"name":"string","portion_g":number,"kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number}],"total_kcal":number,"total_protein_g":number,"total_carbs_g":number,"total_fat_g":number,"confidence":0.0-1.0,"notes":"krátka poznámka o neistote odhadu"}
Názvy jedál a notes píš po slovensky.
Ak to nie je jedlo, vráť dish_name "Nie je jedlo", prázdne items, nuly a notes s vysvetlením.`;

    let lastErr = null;
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
            },
          }),
        });

        if (!res.ok) {
          let detail = "";
          try {
            const err = await res.json();
            detail = err?.error?.message || "";
          } catch {
            /* ignore */
          }
          if (res.status === 400 || res.status === 403) {
            throw new Error(detail || "api_key_invalid");
          }
          if (res.status === 429) throw new Error("rate_limited");
          if (res.status === 404) {
            lastErr = new Error(detail || `model_${model}_missing`);
            continue;
          }
          throw new Error(detail || `http_${res.status}`);
        }

        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
        return normalizeResult(extractJson(text));
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || err);
        if (msg === "api_key_invalid" || msg === "rate_limited" || msg.includes("API key")) {
          throw err;
        }
        if (!msg.includes("model_") && !msg.includes("404")) throw err;
      }
    }
    throw lastErr || new Error("analyze_failed");
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function setStatus(msg, kind) {
    const node = el("food-status");
    if (!node) return;
    node.textContent = msg || "";
    node.classList.toggle("food-status--error", kind === "error");
    node.classList.toggle("food-status--ok", kind === "ok");
    node.hidden = !msg;
  }

  function renderSetup() {
    const hasKey = !!loadKey();
    const setup = el("food-setup");
    const ready = el("food-ready-hint");
    const input = el("food-api-key");
    if (input && !input.value) input.value = loadKey();
    if (setup) setup.hidden = hasKey && !(setup.dataset.force === "1");
    if (ready) ready.hidden = !hasKey;
    const clearBtn = el("food-clear-key");
    if (clearBtn) clearBtn.hidden = !hasKey;
  }

  function renderSummary() {
    const kcalEl = el("food-today-kcal");
    const countEl = el("food-today-count");
    const meals = mealsToday();
    if (kcalEl) kcalEl.textContent = String(Math.round(sumTodayKcal()));
    if (countEl) {
      countEl.textContent = t("food.mealsCount", { n: meals.length });
    }
  }

  function renderHistory() {
    const list = el("food-history");
    if (!list) return;
    const meals = mealsToday();
    if (!meals.length) {
      list.innerHTML = `<p class="food-empty">${t("food.empty")}</p>`;
      return;
    }
    list.innerHTML = meals
      .map((m) => {
        const items = (m.items || [])
          .slice(0, 3)
          .map((i) => i.name)
          .join(" · ");
        return `<article class="food-meal" data-id="${m.id}">
          <div class="food-meal__media">
            ${m.thumb ? `<img src="${m.thumb}" alt="" />` : `<span class="food-meal__ph">🍽</span>`}
          </div>
          <div class="food-meal__body">
            <div class="food-meal__top">
              <strong class="food-meal__name">${escapeHtml(m.dish_name || t("food.meal"))}</strong>
              <span class="food-meal__kcal">${Math.round(m.total_kcal || 0)} kcal</span>
            </div>
            <p class="food-meal__meta">${formatTime(m.at)}${items ? ` · ${escapeHtml(items)}` : ""}</p>
            <p class="food-meal__macros">${Math.round(m.total_protein_g || 0)}g B · ${Math.round(m.total_carbs_g || 0)}g S · ${Math.round(m.total_fat_g || 0)}g T</p>
          </div>
          <button type="button" class="food-meal__del" data-del="${m.id}" aria-label="${t("food.delete")}">×</button>
        </article>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showResult(result, thumb) {
    const card = el("food-result");
    if (!card) return;
    card.hidden = false;
    el("food-result-name").textContent = result.dish_name;
    el("food-result-kcal").textContent = `${Math.round(result.total_kcal)} kcal`;
    el("food-result-macros").textContent = `${Math.round(result.total_protein_g)}g bielkoviny · ${Math.round(result.total_carbs_g)}g sacharidy · ${Math.round(result.total_fat_g)}g tuky`;
    const img = el("food-result-img");
    if (img) {
      img.src = thumb || "";
      img.hidden = !thumb;
    }
    const itemsEl = el("food-result-items");
    if (itemsEl) {
      itemsEl.innerHTML = (result.items || [])
        .map(
          (i) =>
            `<li><span>${escapeHtml(i.name)}${i.portion_g ? ` · ${i.portion_g} g` : ""}</span><strong>${i.kcal} kcal</strong></li>`
        )
        .join("");
    }
    const notes = el("food-result-notes");
    if (notes) {
      const conf = Math.round((result.confidence || 0) * 100);
      notes.textContent = result.notes
        ? `${result.notes} (${t("food.confidence")}: ${conf} %)`
        : `${t("food.confidence")}: ${conf} % · ${t("food.estimateNote")}`;
    }
  }

  function hideResult() {
    const card = el("food-result");
    if (card) card.hidden = true;
  }

  function setAnalyzing(on) {
    const btnShot = el("food-capture-btn");
    const btnGal = el("food-gallery-btn");
    const overlay = el("food-analyzing");
    if (btnShot) btnShot.disabled = on;
    if (btnGal) btnGal.disabled = on;
    if (overlay) overlay.hidden = !on;
  }

  async function processFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus(t("food.errImage"), "error");
      return;
    }
    const apiKey = loadKey();
    if (!apiKey) {
      const setup = el("food-setup");
      if (setup) {
        setup.hidden = false;
        setup.dataset.force = "1";
      }
      setStatus(t("food.needKey"), "error");
      el("food-api-key")?.focus();
      return;
    }

    hideResult();
    setAnalyzing(true);
    setStatus(t("food.analyzing"), null);
    try {
      const { dataUrl, base64, mimeType } = await compressImage(file);
      const preview = el("food-preview");
      if (preview) {
        preview.src = dataUrl;
        preview.hidden = false;
      }
      const result = await analyzeWithGemini(base64, mimeType, apiKey);
      showResult(result, dataUrl);
      const meal = {
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        thumb: dataUrl,
        ...result,
      };
      addMeal(meal);
      renderSummary();
      renderHistory();
      setStatus(t("food.done"), "ok");
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || err);
      if (msg.includes("api_key") || msg.includes("API key") || msg === "api_key_invalid") {
        setStatus(t("food.errKey"), "error");
        const setup = el("food-setup");
        if (setup) {
          setup.hidden = false;
          setup.dataset.force = "1";
        }
      } else if (msg === "rate_limited") {
        setStatus(t("food.errRate"), "error");
      } else {
        setStatus(t("food.errAnalyze"), "error");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  function bind() {
    const fileInput = el("food-file");
    const captureBtn = el("food-capture-btn");
    const galleryBtn = el("food-gallery-btn");
    const saveKeyBtn = el("food-save-key");
    const clearKeyBtn = el("food-clear-key");
    const toggleSetup = el("food-toggle-setup");
    const history = el("food-history");

    captureBtn?.addEventListener("click", () => {
      if (fileInput) {
        fileInput.setAttribute("capture", "environment");
        fileInput.click();
      }
    });

    galleryBtn?.addEventListener("click", () => {
      if (fileInput) {
        fileInput.removeAttribute("capture");
        fileInput.click();
      }
    });

    fileInput?.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (file) processFile(file);
    });

    saveKeyBtn?.addEventListener("click", () => {
      const input = el("food-api-key");
      const key = (input?.value || "").trim();
      if (!key) {
        setStatus(t("food.needKey"), "error");
        return;
      }
      saveKey(key);
      const setup = el("food-setup");
      if (setup) setup.dataset.force = "0";
      renderSetup();
      setStatus(t("food.keySaved"), "ok");
    });

    clearKeyBtn?.addEventListener("click", () => {
      saveKey("");
      const input = el("food-api-key");
      if (input) input.value = "";
      const setup = el("food-setup");
      if (setup) setup.dataset.force = "1";
      renderSetup();
      setStatus(t("food.keyCleared"), "ok");
    });

    toggleSetup?.addEventListener("click", () => {
      const setup = el("food-setup");
      if (!setup) return;
      const open = setup.hidden;
      setup.hidden = !open;
      setup.dataset.force = open ? "1" : "0";
    });

    history?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del]");
      if (!btn) return;
      deleteMeal(btn.getAttribute("data-del"));
      renderSummary();
      renderHistory();
      setStatus(t("food.deleted"), "ok");
    });
  }

  function refresh() {
    renderSetup();
    renderSummary();
    renderHistory();
  }

  function init() {
    if (!el("panel-food")) return;
    bind();
    refresh();
  }

  root.ChodzaFoodScan = { init, refresh };
})(typeof window !== "undefined" ? window : globalThis);
