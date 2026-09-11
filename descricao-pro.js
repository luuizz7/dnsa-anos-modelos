(() => {
  "use strict";

  const data = Array.isArray(window.MOTOS) ? window.MOTOS : [];

  const els = {
    tabs: [...document.querySelectorAll("[data-page-target]")],
    pages: [...document.querySelectorAll("[data-page]")],
    title: document.querySelector("#adTitleInput"),
    products: document.querySelector("#kitProductsInput"),
    generate: document.querySelector("#generateDescriptionBtn"),
    variant: document.querySelector("#generateVariantBtn"),
    clear: document.querySelector("#clearDescriptionBtn"),
    output: document.querySelector("#descriptionOutput"),
    copy: document.querySelector("#copyDescriptionBtn"),
    status: document.querySelector("#descriptionStatus"),
    meta: document.querySelector("#applicationMatchMeta"),
    toast: document.querySelector("#toast"),
  };

  function setPage(pageName) {
    els.pages.forEach(page => {
      const active = page.dataset.page === pageName;
      page.hidden = !active;
      page.classList.toggle("is-active", active);
    });

    els.tabs.forEach(tab => {
      const active = tab.dataset.pageTarget === pageName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });

    try {
      history.replaceState(
        null,
        "",
        pageName === "description"
          ? "#descricao-pro"
          : "#anos-modelos"
      );
    } catch {}

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  els.tabs.forEach(tab =>
    tab.addEventListener("click", () =>
      setPage(tab.dataset.pageTarget)
    )
  );

  if (location.hash === "#descricao-pro") {
    setPage("description");
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9+.-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactItem(item) {
    return {
      montadora: item.montadora,
      cilindrada: Number(item.cilindrada),
      modelo: item.modelo,
      nome: item.nome || item.modelo,
      de: Number(item.de),
      ate: Number(item.ate ?? item.de),
    };
  }

  function getRelevantApplications(title, products) {
    const input = normalize(`${title} ${products}`);

    if (!input) {
      return [];
    }

    const inputTokens = new Set(
      input.split(" ").filter(Boolean)
    );

    const alphaFrequency = new Map();

    data.forEach(item => {
      const alias = normalize(
        `${item.nome || ""} ${item.modelo || ""}`
      );

      const alpha = new Set(
        alias
          .split(" ")
          .filter(
            token =>
              /^[a-z][a-z-]*$/.test(token) &&
              token.length >= 3
          )
      );

      alpha.forEach(token =>
        alphaFrequency.set(
          token,
          (alphaFrequency.get(token) || 0) + 1
        )
      );
    });

    const scored = data
      .map(item => {
        const nome = normalize(
          item.nome || item.modelo
        );

        const modelo = normalize(item.modelo);
        const cc = String(item.cilindrada);

        let score = 0;

        if (nome && input.includes(nome)) {
          score += 120;
        }

        if (modelo && input.includes(modelo)) {
          score += 120;
        }

        const aliases = new Set(
          `${nome} ${modelo}`
            .split(" ")
            .filter(Boolean)
        );

        const alphaMatches = [...aliases].filter(
          token =>
            /^[a-z][a-z-]*$/.test(token) &&
            token.length >= 3 &&
            inputTokens.has(token)
        );

        if (alphaMatches.length) {
          score += alphaMatches.length * 12;
        }

        if (inputTokens.has(cc)) {
          score += 28;
        }

        const rareFamily = alphaMatches.some(
          token =>
            (alphaFrequency.get(token) || 999) <= 2
        );

        if (rareFamily) {
          score += 24;
        }

        if (
          alphaMatches.length > 0 &&
          inputTokens.has(cc)
        ) {
          score += 35;
        }

        return {
          item,
          score
        };
      })
      .filter(x => x.score >= 35)
      .sort((a, b) => b.score - a.score);

    const unique = [];
    const seen = new Set();

    for (const { item } of scored) {
      const key = [
        item.montadora,
        item.cilindrada,
        item.modelo,
        item.de,
        item.ate
      ].join("|");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      unique.push(compactItem(item));

      if (unique.length >= 40) {
        break;
      }
    }

    if (unique.length) {
      return unique;
    }

    return data
      .slice(0, 250)
      .map(compactItem);
  }

  function setStatus(message, isError = false) {
    els.status.textContent = message || "";

    els.status.classList.toggle(
      "is-error",
      isError
    );
  }

  function apiUrl() {
    return (
      window.DNSA_AI_ENDPOINT ||
      "/api/descricao"
    );
  }

  function setButtonsAfterResult(hasResult) {
    if (els.copy) {
      els.copy.disabled = !hasResult;
    }

    if (els.variant) {
      els.variant.disabled = !hasResult;
    }
  }

  async function generateDescription() {
    const titulo = els.title.value.trim();
    const produtos = els.products.value.trim();

    if (!titulo) {
      setStatus(
        "Informe o título do anúncio.",
        true
      );

      els.title.focus();
      return;
    }

    if (!produtos) {
      setStatus(
        "Cole os produtos do kit.",
        true
      );

      els.products.focus();
      return;
    }

    const aplicacoes =
      getRelevantApplications(
        titulo,
        produtos
      );

    els.generate.disabled = true;

    if (els.variant) {
      els.variant.disabled = true;
    }

    setButtonsAfterResult(false);

    els.output.value = "";

    els.meta.textContent =
      `${aplicacoes.length} aplicações candidatas da base`;

    setStatus(
      "Gerando descrição e cruzando as aplicações com a base..."
    );

    try {
      const response = await fetch(
        apiUrl(),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            modo: "normal",
            titulo,
            produtos,
            aplicacoes,
            plataforma:
              "Mercado Livre e Shopee"
          }),
        }
      );

      const payload =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
          `Erro ${response.status} ao gerar a descrição.`
        );
      }

      const description =
        String(
          payload.description || ""
        ).trim();

      if (!description) {
        throw new Error(
          "A IA não retornou uma descrição."
        );
      }

      els.output.value = description;

      setButtonsAfterResult(true);

      els.meta.textContent =
        payload.applicationCount != null
          ? `${payload.applicationCount} aplicações usadas`
          : `${aplicacoes.length} aplicações consultadas`;

      setStatus(
        "Descrição gerada."
      );

    } catch (error) {
      console.error(error);

      if (
        location.hostname.includes(
          "github.io"
        ) &&
        apiUrl().startsWith("/")
      ) {
        setStatus(
          "O front-end está no GitHub Pages, mas a IA precisa de um backend. Configure o endpoint do backend antes de usar.",
          true
        );
      } else {
        setStatus(
          String(
            error?.message || error
          ),
          true
        );
      }

    } finally {
      els.generate.disabled = false;
    }
  }

  async function generateVariant() {
    const titulo =
      els.title.value.trim();

    const produtos =
      els.products.value.trim();

    const textoAtual =
      els.output.value.trim();

    if (!textoAtual) {
      setStatus(
        "Gere uma descrição primeiro.",
        true
      );

      return;
    }

    const marcadorInicio =
      "Descrição do Produto:";

    const marcadorFim =
      "Antes da compra";

    const inicio =
      textoAtual.indexOf(
        marcadorInicio
      );

    if (inicio === -1) {
      setStatus(
        'Não foi possível localizar "Descrição do Produto:".',
        true
      );

      return;
    }

    const inicioConteudo =
      inicio +
      marcadorInicio.length;

    const fim =
      textoAtual.indexOf(
        marcadorFim,
        inicioConteudo
      );

    if (fim === -1) {
      setStatus(
        'Não foi possível localizar "Antes da compra".',
        true
      );

      return;
    }

    const descricaoAtual =
      textoAtual
        .slice(
          inicioConteudo,
          fim
        )
        .trim();

    if (!descricaoAtual) {
      setStatus(
        "A descrição comercial está vazia.",
        true
      );

      return;
    }

    const parteAntes =
      textoAtual
        .slice(
          0,
          inicioConteudo
        )
        .trimEnd();

    const parteDepois =
      textoAtual
        .slice(fim)
        .trimStart();

    els.variant.disabled = true;
    els.generate.disabled = true;
    els.copy.disabled = true;

    const textoOriginalBotao =
      els.variant.textContent;

    els.variant.textContent =
      "Gerando variante...";

    setStatus(
      "Gerando uma nova versão somente da Descrição do Produto..."
    );

    try {
      const response = await fetch(
        apiUrl(),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            modo: "variante",
            titulo,
            produtos,
            descricaoAtual
          }),
        }
      );

      const payload =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
          `Erro ${response.status} ao gerar variante.`
        );
      }

      const novaDescricao =
        String(
          payload.description || ""
        ).trim();

      if (!novaDescricao) {
        throw new Error(
          "A IA não retornou uma variante."
        );
      }

      els.output.value =
        parteAntes +
        "\n\n" +
        novaDescricao +
        "\n\n" +
        parteDepois;

      setStatus(
        "Variante gerada. Somente a Descrição do Produto foi alterada."
      );

      els.copy.disabled = false;

    } catch (error) {
      console.error(error);

      setStatus(
        String(
          error?.message || error
        ),
        true
      );

      els.copy.disabled =
        !els.output.value.trim();

    } finally {
      els.generate.disabled = false;

      els.variant.disabled =
        !els.output.value.trim();

      els.variant.textContent =
        textoOriginalBotao;
    }
  }

  function clearDescription() {
    els.title.value = "";
    els.products.value = "";
    els.output.value = "";

    setButtonsAfterResult(false);

    els.meta.textContent =
      "Aguardando geração";

    setStatus("");

    els.title.focus();
  }

  async function copyDescription() {
    const value =
      els.output.value.trim();

    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        value
      );

    } catch {
      els.output.focus();
      els.output.select();

      document.execCommand(
        "copy"
      );

      window
        .getSelection()
        ?.removeAllRanges();
    }

    if (els.toast) {
      els.toast.textContent =
        "Descrição copiada!";

      els.toast.classList.add(
        "is-visible"
      );

      setTimeout(() => {
        els.toast.classList.remove(
          "is-visible"
        );

        els.toast.textContent =
          "Texto copiado!";
      }, 1600);
    }
  }

  els.generate?.addEventListener(
    "click",
    generateDescription
  );

  els.variant?.addEventListener(
    "click",
    generateVariant
  );

  els.clear?.addEventListener(
    "click",
    clearDescription
  );

  els.copy?.addEventListener(
    "click",
    copyDescription
  );

  [
    els.title,
    els.products
  ].forEach(field => {
    field?.addEventListener(
      "keydown",
      event => {
        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key === "Enter"
        ) {
          event.preventDefault();
          generateDescription();
        }
      }
    );
  });

  if (els.variant) {
    els.variant.disabled = true;
  }

  if (els.copy) {
    els.copy.disabled = true;
  }
})();