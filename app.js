(() => {
  "use strict";

  const data = Array.isArray(window.MOTOS) ? window.MOTOS : [];

  const els = {
    statModels: document.querySelector("#statModels"),
    statMakes: document.querySelector("#statMakes"),
    makeChips: document.querySelector("#makeChips"),
    ccChips: document.querySelector("#ccChips"),
    modelsGrid: document.querySelector("#modelsGrid"),
    makeCount: document.querySelector("#makeCount"),
    ccHint: document.querySelector("#ccHint"),
    modelCount: document.querySelector("#modelCount"),
    selectionStatus: document.querySelector("#selectionStatus"),
    searchInput: document.querySelector("#searchInput"),
    clearSearchBtn: document.querySelector("#clearSearchBtn"),
    clearAllBtn: document.querySelector("#clearAllBtn"),
    suggestions: document.querySelector("#suggestions"),
    resultMeta: document.querySelector("#resultMeta"),
    simpleBtn: document.querySelector("#simpleBtn"),
    detailedBtn: document.querySelector("#detailedBtn"),
    outputText: document.querySelector("#outputText"),
    copyBtn: document.querySelector("#copyBtn"),
    yearsPreview: document.querySelector("#yearsPreview"),
    yearBadges: document.querySelector("#yearBadges"),
    toast: document.querySelector("#toast"),
    resultHeaderActions: document.querySelector("#resultHeaderActions"),
    clearSelectedBtn: document.querySelector("#clearSelectedBtn"),
    previewTitle: document.querySelector("#previewTitle"),
  };


  const MAKE_ORDER = ["HONDA", "YAMAHA", "SUZUKI", "SHINERAY", "DAFRA", "HAOJUE", "TRAXX"];

  const MAKE_LOGOS = {
    HONDA: "assets/logos/honda.png",
    YAMAHA: "assets/logos/yamaha.png",
    SUZUKI: "assets/logos/suzuki.png",
    SHINERAY: "assets/logos/shineray.png",
    DAFRA: "assets/logos/dafra.png",
    HAOJUE: "assets/logos/haojue.png",
    TRAXX: "assets/logos/traxx.png",
  };

  const state = {
    montadora: null,
    cilindrada: null,
    selectedKeys: [],
    activeKey: null,
    format: "simple",
  };

  const normalized = data.map((item, index) => ({
    ...item,
    index,
    key: [item.montadora, item.cilindrada, item.modelo, item.de, item.ate].join("|"),
    search: normalize([
      item.montadora,
      item.cilindrada,
      item.modelo,
      item.nome,
      `${item.cilindrada}cc`
    ].join(" "))
  }));

  function normalize(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9+.-]+/g, " ")
      .trim();
  }

  function titleCaseName(name) {
    return String(name)
      .toLowerCase()
      .replace(/(^|[\s-])([a-zà-ÿ])/g, (_, separator, letter) => separator + letter.toUpperCase());
  }

  function displayName(item) {
    return titleCaseName(item.nome || item.modelo);
  }

  function yearsFor(item) {
    const start = Number(item.de);
    const fallbackEnd = item.ate ?? item.de;
    const end = Number(fallbackEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }

  function rangeLabel(item) {
    const start = Number(item.de);
    const end = Number(item.ate ?? item.de);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
    return start === end ? String(start) : `${start} a ${end}`;
  }

  function formatOutput(item) {
    const name = displayName(item);
    const years = yearsFor(item);
    if (!years.length) return name;
    if (state.format === "detailed") return `${name} ${years.join(" ")}`;
    return years.length === 1
      ? `${name} ${years[0]}`
      : `${name} ${years[0]} a ${years[years.length - 1]}`;
  }

  function findItemByKey(key) {
    return normalized.find(x => x.key === key) || null;
  }

  function selectedItems() {
    return state.selectedKeys.map(findItemByKey).filter(Boolean);
  }

  function activeItem() {
    return findItemByKey(state.activeKey) || selectedItems().at(-1) || null;
  }

  function isSelected(key) {
    return state.selectedKeys.includes(key);
  }

  function renderStats() {
    if (els.statModels) els.statModels.textContent = new Set(normalized.map(x => `${x.montadora}|${x.cilindrada}|${x.modelo}`)).size;
    if (els.statMakes) els.statMakes.textContent = new Set(normalized.map(x => x.montadora)).size;
  }

  function renderMakes() {
    const available = new Set(normalized.map(x => x.montadora));
    const makes = [
      ...MAKE_ORDER.filter(make => available.has(make)),
      ...[...available].filter(make => !MAKE_ORDER.includes(make)).sort((a, b) => a.localeCompare(b, "pt-BR"))
    ];

    els.makeCount.textContent = "";
    els.makeChips.classList.add("make-grid");
    els.makeChips.innerHTML = "";

    makes.forEach(make => {
      const btn = document.createElement("button");
      btn.type = "button";
      const makeSlug = normalize(make).replace(/[^a-z0-9]+/g, "-");
      btn.className = "make-card make-card--" + makeSlug + (state.montadora === make ? " is-active" : "");
      btn.setAttribute("aria-pressed", String(state.montadora === make));

      const logo = MAKE_LOGOS[make];
      btn.innerHTML = `
        <span class="make-card__logo-wrap make-card__logo-wrap--${makeSlug}">
          ${logo ? `<img class="make-card__logo make-card__logo--${makeSlug}" src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(titleCaseName(make))}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="make-card__fallback">${escapeHtml(make.slice(0, 2))}</span>`}
        </span>
        <strong>${escapeHtml(titleCaseName(make))}</strong>`;

      const img = btn.querySelector("img");
      if (img) {
        img.addEventListener("error", () => {
          img.parentElement.innerHTML = `<span class="make-card__fallback">${escapeHtml(make.slice(0, 2))}</span>`;
        }, { once: true });
      }

      btn.addEventListener("click", () => {
        const isSame = state.montadora === make;
        state.montadora = isSame ? null : make;
        state.cilindrada = null;
        renderAll();
      });
      els.makeChips.appendChild(btn);
    });
  }

  function renderCcs() {
    els.ccChips.innerHTML = "";
    if (!state.montadora) {
      els.ccHint.textContent = "Selecione uma montadora primeiro";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = "Aguardando montadora";
      btn.disabled = true;
      els.ccChips.appendChild(btn);
      return;
    }

    const ccs = [...new Set(normalized.filter(x => x.montadora === state.montadora).map(x => Number(x.cilindrada)))].sort((a, b) => a - b);
    els.ccHint.textContent = `${ccs.length} cilindradas em ${state.montadora}`;

    ccs.forEach(cc => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (state.cilindrada === cc ? " is-active" : "");
      btn.textContent = `${cc} cc`;
      btn.addEventListener("click", () => {
        const isSame = state.cilindrada === cc;
        state.cilindrada = isSame ? null : cc;
        renderAll();
      });
      els.ccChips.appendChild(btn);
    });
  }

  function currentModels() {
    if (!state.montadora || !state.cilindrada) return [];
    return normalized
      .filter(x => x.montadora === state.montadora && Number(x.cilindrada) === Number(state.cilindrada))
      .sort((a, b) => displayName(a).localeCompare(displayName(b), "pt-BR") || a.de - b.de);
  }

  function renderModels() {
    const models = currentModels();
    els.modelsGrid.innerHTML = "";

    if (!state.montadora || !state.cilindrada) {
      els.modelCount.textContent = "Aguardando filtros";
      els.modelsGrid.innerHTML = `
        <div class="empty-state">
          <strong>Escolha uma montadora e uma cilindrada.</strong>
          <span>Os modelos disponíveis aparecerão aqui.</span>
        </div>`;
      return;
    }

    els.modelCount.textContent = `${models.length} ${models.length === 1 ? "modelo" : "modelos"}`;

    if (!models.length) {
      els.modelsGrid.innerHTML = `
        <div class="empty-state">
          <strong>Nenhum modelo encontrado.</strong>
          <span>Tente outra cilindrada.</span>
        </div>`;
      return;
    }

    models.forEach(item => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "model-card" + (isSelected(item.key) ? " is-selected" : "");
      btn.innerHTML = `
        <span class="model-card__top">
          <span class="model-card__make">${escapeHtml(item.montadora)}</span>
          <span class="model-card__cc">${item.cilindrada} cc</span>
        </span>
        <strong>${escapeHtml(displayName(item))}</strong>
        <span class="model-card__years">${escapeHtml(rangeLabel(item))}</span>`;
      btn.addEventListener("click", () => addItem(item));
      els.modelsGrid.appendChild(btn);
    });
  }

  function renderResult() {
    const items = selectedItems();
    const lastItem = activeItem();

    els.simpleBtn.classList.toggle("is-active", state.format === "simple");
    els.detailedBtn.classList.toggle("is-active", state.format === "detailed");
    els.simpleBtn.setAttribute("aria-pressed", String(state.format === "simple"));
    els.detailedBtn.setAttribute("aria-pressed", String(state.format === "detailed"));

    if (!items.length) {
      els.outputText.value = "";
      els.outputText.placeholder = "O texto aparecerá aqui após selecionar uma ou mais motos.";
      els.copyBtn.disabled = true;
      els.resultMeta.textContent = "Selecione uma ou mais motos";
      els.selectionStatus.textContent = "Nenhuma moto selecionada";
      els.selectionStatus.classList.remove("is-selected");
      if (els.clearSelectedBtn) els.clearSelectedBtn.disabled = true;
      if (els.previewTitle) els.previewTitle.textContent = "Anos:";
      els.yearsPreview.hidden = true;
      els.yearBadges.innerHTML = "";
      return;
    }

    els.outputText.value = items.map(formatOutput).join("\n");
    els.copyBtn.disabled = false;
    els.resultMeta.textContent = items.length === 1
      ? `${items[0].montadora} • ${items[0].cilindrada} cc`
      : `${items.length} modelos selecionados`;

    if (items.length === 1) {
      els.selectionStatus.textContent = displayName(items[0]);
    } else {
      els.selectionStatus.textContent = `${items.length} motos selecionadas`;
    }
    els.selectionStatus.classList.add("is-selected");
    if (els.clearSelectedBtn) els.clearSelectedBtn.disabled = false;

    if (!lastItem) {
      els.yearsPreview.hidden = true;
      els.yearBadges.innerHTML = "";
      return;
    }

    const years = yearsFor(lastItem);
    els.yearsPreview.hidden = false;
    if (els.previewTitle) {
      els.previewTitle.textContent = items.length === 1
        ? "Anos:"
        : `Anos do último selecionado: ${displayName(lastItem)}`;
    }
    els.yearBadges.innerHTML = years.map(y => `<span class="year-badge">${y}</span>`).join("");
  }

  function renderAll() {
    renderMakes();
    renderCcs();
    renderModels();
    renderResult();
  }

  function addItem(item) {
    state.montadora = item.montadora;
    state.cilindrada = Number(item.cilindrada);
    if (!isSelected(item.key)) state.selectedKeys.push(item.key);
    state.activeKey = item.key;
    els.searchInput.value = "";
    els.clearSearchBtn.hidden = true;
    hideSuggestions();
    renderAll();
  }

  function clearSelection(render = true) {
    state.selectedKeys = [];
    state.activeKey = null;
    if (render) renderResult();
  }

  function clearAll() {
    state.montadora = null;
    state.cilindrada = null;
    clearSelection(false);
    state.format = "simple";
    els.searchInput.value = "";
    els.clearSearchBtn.hidden = true;
    hideSuggestions();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function searchItems(query) {
    const q = normalize(query);
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return normalized
      .map(item => {
        const all = tokens.every(t => item.search.includes(t));
        if (!all) return null;
        let score = 0;
        const name = normalize(displayName(item));
        const model = normalize(item.modelo);
        if (name === q || model === q) score += 100;
        if (name.startsWith(q) || model.startsWith(q)) score += 50;
        if (name.includes(q) || model.includes(q)) score += 25;
        if (normalize(item.montadora).includes(q)) score += 10;
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || displayName(a.item).localeCompare(displayName(b.item), "pt-BR"))
      .map(x => x.item);
  }

  function renderSuggestions() {
    const query = els.searchInput.value.trim();
    els.clearSearchBtn.hidden = !query;
    if (!query) {
      hideSuggestions();
      return;
    }

    const results = searchItems(query).slice(0, 9);
    if (!results.length) {
      els.suggestions.innerHTML = `<div class="suggestion" aria-disabled="true"><div><strong>Nenhum resultado</strong><small>Tente outro nome ou cilindrada.</small></div></div>`;
      els.suggestions.hidden = false;
      return;
    }

    els.suggestions.innerHTML = "";
    results.forEach(item => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "suggestion";
      btn.innerHTML = `
        <span>
          <strong>${escapeHtml(displayName(item))}</strong>
          <small>${escapeHtml(item.montadora)} • ${item.cilindrada} cc</small>
        </span>
        <span class="suggestion__years">${escapeHtml(rangeLabel(item))}</span>`;
      btn.addEventListener("click", () => addItem(item));
      els.suggestions.appendChild(btn);
    });
    els.suggestions.hidden = false;
  }

  function hideSuggestions() {
    els.suggestions.hidden = true;
    els.suggestions.innerHTML = "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function copyOutput() {
    const value = els.outputText.value.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      els.outputText.focus();
      els.outputText.select();
      document.execCommand("copy");
      window.getSelection()?.removeAllRanges();
    }
    showToast();
  }

  let toastTimer;
  function showToast() {
    clearTimeout(toastTimer);
    els.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 1600);
  }

  els.searchInput.addEventListener("input", renderSuggestions);
  els.searchInput.addEventListener("focus", renderSuggestions);
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideSuggestions();
      els.searchInput.blur();
    }
    if (event.key === "Enter") {
      const first = searchItems(els.searchInput.value)[0];
      if (first) {
        event.preventDefault();
        addItem(first);
      }
    }
  });

  els.clearSearchBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    els.clearSearchBtn.hidden = true;
    hideSuggestions();
    els.searchInput.focus();
  });

  els.clearAllBtn.addEventListener("click", clearAll);
  if (els.clearSelectedBtn) {
    els.clearSelectedBtn.addEventListener("click", () => {
      clearSelection(false);
      renderAll();
    });
  }

  els.simpleBtn.addEventListener("click", () => {
    state.format = "simple";
    renderResult();
  });

  els.detailedBtn.addEventListener("click", () => {
    state.format = "detailed";
    renderResult();
  });

  els.copyBtn.addEventListener("click", copyOutput);

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) hideSuggestions();
  });

  renderStats();
  renderAll();
})();
