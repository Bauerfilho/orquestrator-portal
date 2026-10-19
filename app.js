"use strict";

(() => {
  // o portal grava agora: dentro da moldura de outro site, não se desenha (meta CSP não aceita frame-ancestors)
  if (window.top !== window.self) { document.documentElement.replaceChildren(); return; }
  const byId = (id) => document.getElementById(id);
  const requests = new Map();
  const actions = new Set(["login", "logout", "snapshot", "toggle_step", "edit_plan", "change_password", "restore_session", "set_subscription", "preferences", "set_decision"]);
  let requestNumber = 0;
  let authenticated = false;
  let mustChangePassword = false;
  let snapshotBusy = false;
  let snapshotQueued = false;
  let nativeVisible = true;
  let mutationBusy = false;
  let sessionGeneration = 0;
  let currentSnapshot = null;
  let revision = null;
  let sessionNotice = "";
  let editingPlan = null;
  let inventorySort = "ready-desc";
  let inventoryBarrier = "";
  let cooldownTimer = null;
  let activePage = "overview";
  let drawerReturnFocus = null;
  let inventorySearch = "";
  let atlasCurrent = null;
  let atlasSelectedId = null;
  let atlasRenderedDetail = null;
  let atlasReturnFocus = null;
  let atlasReturnAssetId = null;
  let atlasView = null;
  let atlasSignature = null;
  const atlasFilter = {query: "", kind: "", category: "", distribution: "", destino: "", tab: "all", page: 1};
  const atlasPageSize = 40;
  const comparisonIds = new Set();
  let atlasOrder = "name";
  let comparisonDialog = null;
  let comparisonReturnFocus = null;
  let comparisonSignature = null;
  const detailListPages = new Map();
  let renderGeneration = 0;
  let focusGeneration = 0;
  document.addEventListener("focusin", () => { focusGeneration += 1; }, true);
  const pagePositions = new Map();
  const headerScrollThreshold = 12;
  const headerTopThreshold = 24;
  let headerScrollFrame = 0;
  let headerResumeFrame = 0;
  let headerScrollSuspended = false;
  let headerLastY = 0;
  let headerTravel = 0;
  let headerDirection = 0;
  let keyboardNavigation = false;
  // O mapa do portal vem do registro (paginas.js): título, descrição e "Como ler esta página" (A1, três linhas em
  // português claro — o que é · de onde vem · o que não é) de cada página, na ordem da gaveta. Sem o registro (um host
  // antigo que não carrega o paginas.js), as seções do index.html viram páginas sem ajuda, para nada quebrar.
  const registro = Array.isArray(window.financePaginas) ? window.financePaginas : [...document.querySelectorAll("[data-finance-page]")].map((secao) => {
    const titulo = secao.querySelector("h2");
    return {chave: secao.dataset.financePage, rota: secao.dataset.financePage, grupo: "Dinheiro", titulo: titulo ? titulo.textContent : secao.dataset.financePage, descricao: "", ajuda: {}, ...(secao.dataset.financePage === "lab" ? {requer: "galeria"} : {})};
  });
  const grupos = Array.isArray(window.financeGrupos) ? window.financeGrupos : ["Dinheiro"];
  const rotas = window.financeRotas && typeof window.financeRotas.ler === "function" ? window.financeRotas : {ler: () => null, montar: () => "", acoes: []};
  const pages = {};
  function paginaDoRegistro(entrada) {
    const ajuda = entrada.ajuda && typeof entrada.ajuda === "object" ? entrada.ajuda : {};
    pages[entrada.chave] = {title: String(entrada.titulo), description: String(entrada.descricao || ""), help: {what: ajuda.oque || "", from: ajuda.deonde || "", not: ajuda.naoe || ""}};
  }
  registro.forEach(paginaDoRegistro);
  // O host (AI Cask, PWA ou portal) se apresenta em window.financeHost antes deste script; sem ele, vale o modo local.
  const host = () => (window.financeHost && typeof window.financeHost === "object") ? window.financeHost : {};
  const hostLabels = {
    local: {indicator: "Arquivos locais", reading: "Arquivos locais", footer: "Dados da empresa · leitura local", drawer: "Leitura local", record: "Arquivo local"},
    portal: {indicator: "Dados compartilhados", reading: "Dados compartilhados", footer: "Dados da empresa · versão online", drawer: "Acesso privado", record: "Registro compartilhado"}
  };
  function hostLabel(key) { return (host().kind === "portal" ? hostLabels.portal : hostLabels.local)[key] || ""; }
  function applyHostLabels() {
    document.querySelectorAll("[data-host-text]").forEach((node) => { node.textContent = hostLabel(node.dataset.hostText); });
    const team = host().team === true;
    byId("change-password-button").textContent = team ? "Minha equipe" : "Trocar senha";
    byId("drawer-password").textContent = team ? "Minha equipe" : "Trocar minha senha";
    montarGaveta();
  }
  function hasSourceLocator(ref) {
    return Boolean(ref) && typeof ref === "object" && ["url", "label", "path"].some((key) => typeof ref[key] === "string");
  }
  function sourceName(source) {
    const name = source && (source.label || source.path);
    return name ? String(name).split("/").pop() : "";
  }
  window.financeState = null;
  window.financeReady = false;

  function bridgeError(message, code, retryAfter) {
    const error = new Error(message || "Não foi possível concluir a operação local.");
    error.code = code || "local_error";
    error.retry_after = retryAfter;
    return error;
  }

  window.financeReply = (reply) => {
    if (!reply || !requests.has(reply.id)) return;
    const pending = requests.get(reply.id);
    requests.delete(reply.id);
    clearTimeout(pending.timer);
    if (reply.ok === true) pending.resolve(reply.result);
    else pending.reject(bridgeError(reply.error, reply.code, reply.retry_after));
  };

  window.financeRequest = (action, payload = {}) => new Promise((resolve, reject) => {
    const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.finance;
    if (!actions.has(action)) {
      reject(bridgeError("Operação indisponível.", "invalid_action"));
      return;
    }
    if ((!bridge || typeof bridge.postMessage !== "function") && typeof window.financeWebRequest === "function") {
      Promise.resolve().then(() => window.financeWebRequest(action, payload)).then(resolve, reject);
      return;
    }
    if (!bridge || typeof bridge.postMessage !== "function") {
      reject(bridgeError("Abra o painel pela aba Finanças do AI Cask.", "bridge_unavailable"));
      return;
    }
    const id = "finance-" + (++requestNumber);
    const timer = setTimeout(() => {
      requests.delete(id);
      reject(bridgeError("A leitura local demorou. Tente novamente.", "timeout"));
    }, 40000);
    requests.set(id, {resolve, reject, timer});
    try {
      bridge.postMessage({id, action, payload});
    } catch (_) {
      clearTimeout(timer);
      requests.delete(id);
      reject(bridgeError("Não foi possível acessar os arquivos locais.", "bridge_unavailable"));
    }
  });

  function text(value) {
    if (value === undefined || value === null || value === "") return "—";
    return String(value)
      .replace(/<!--[^]*?-->/g, "")
      .replace(/scrypt\$[^\s]+/gi, "[dado reservado]")
      .replace(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g, "[dado reservado]")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trim();
  }

  function normalized(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  }

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = text(value);
    return node;
  }

  function button(label, className, handler) {
    const node = element("button", "button " + className, label);
    node.type = "button";
    node.addEventListener("click", handler);
    return node;
  }

  function array(value) { return Array.isArray(value) ? value : []; }
  function clear(node) { node.replaceChildren(); }
  function empty(node, message = "sem entrega ainda") { node.append(element("p", "empty-state", message)); }
  function announce(message) { byId("live-status").textContent = message; }
  function message(id, value) {
    const node = byId(id);
    node.textContent = value ? text(value) : "";
    node.hidden = !value;
  }

  function dateLabel(value, includeTime = false) {
    if (!value) return "sem data informada";
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value);
    if (!Number.isFinite(date.getTime())) return text(value);
    return new Intl.DateTimeFormat("pt-BR", includeTime ? {dateStyle: "short", timeStyle: "short"} : {dateStyle: "short"}).format(date);
  }

  function money(value, currency) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "não informado";
    const coin = String(currency || "").toUpperCase();
    try {
      if (!/^[A-Z]{3}$/.test(coin)) throw new Error();
      return new Intl.NumberFormat("pt-BR", {style: "currency", currency: coin}).format(value);
    } catch (_) {
      return new Intl.NumberFormat("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value) + " (" + text(currency || "moeda não informada") + ")";
    }
  }

  function renderSource(node, source) {
    clear(node);
    node.className = "source-status";
    if (!source || !source.exists) {
      node.classList.add("missing");
      node.append(element("p", "", "sem entrega ainda"));
      return;
    }
    node.title = text(source.label || source.path || hostLabel("record"));
    if (source.stale) node.classList.add("stale");
    const line = element("p", "", source.stale ? "Entrega antiga · há mais de 8 dias" : "Última entrega");
    line.append(element("span", "source-date", dateLabel(source.updated_at, true)));
    node.append(line);
  }

  // "De onde vem este número" (A3): um botão discreto ao lado da cifra abre uma nota com a fonte, a data da última entrega e o cálculo.
  let sourceNoteCounter = 0;
  function sourceWhy(source, explanation, fonte) {
    const wrap = element("span", "source-why-wrap");
    const id = "source-note-" + (++sourceNoteCounter);
    const trigger = element("button", "source-why"); trigger.type = "button";
    trigger.setAttribute("aria-label", "De onde vem este número"); trigger.setAttribute("aria-expanded", "false"); trigger.setAttribute("aria-controls", id);
    trigger.dataset.fonteBotao = fonte;
    const glyph = element("span", "", "i"); glyph.setAttribute("aria-hidden", "true"); trigger.append(glyph);
    const note = element("div", "source-popover"); note.id = id; note.hidden = true; note.setAttribute("role", "note");
    const name = source && (source.label || source.path) ? sourceName(source) : "";
    note.append(element("p", "source-popover-title", "Fonte: " + (name || hostLabel("record"))));
    note.append(element("p", "", !source || !source.exists ? "Sem entrega ainda" : (source.stale ? "Entrega antiga · há mais de 8 dias · " : "Última entrega · ") + dateLabel(source.updated_at, true)));
    if (explanation) note.append(element("p", "", explanation));
    const toggle = (open) => { note.hidden = !open; trigger.setAttribute("aria-expanded", String(open)); };
    trigger.addEventListener("click", () => toggle(note.hidden));
    wrap.addEventListener("keydown", (event) => { if (event.key === "Escape" && !note.hidden) { event.preventDefault(); event.stopPropagation(); toggle(false); trigger.focus(); } });
    wrap.addEventListener("focusout", (event) => { if (!wrap.contains(event.relatedTarget)) toggle(false); });
    wrap.append(trigger, note);
    return wrap;
  }
  function headingWithSource(title, source, explanation, fonte, rowClass = "hero-heading-row") {
    const row = element("div", rowClass);
    row.append(element("h3", "", title), sourceWhy(source, explanation, fonte));
    return row;
  }

  function publicColumns(columns, rows) {
    const list = array(columns).length ? columns : Object.keys(array(rows)[0] || {});
    return list.filter((column) => !/(^|_)(cpf|senha|password|hash)(_|$)/.test(normalized(column)));
  }

  function table(columns, rows, label, className = "") {
    const visible = publicColumns(columns, rows);
    const container = element("div", "table-scroll");
    container.tabIndex = 0;
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", label + "; tabela com rolagem horizontal");
    if (!visible.length || !array(rows).length) { empty(container); return container; }
    const node = element("table", className);
    const caption = element("caption", "sr-only", label);
    node.append(caption);
    const header = element("tr");
    visible.forEach((column) => {
      const cell = element("th", "", column);
      cell.scope = "col";
      header.append(cell);
    });
    const head = element("thead");
    head.append(header);
    node.append(head);
    const body = element("tbody");
    rows.forEach((row) => {
      const line = element("tr");
      visible.forEach((column) => line.append(element("td", "", row[column])));
      body.append(line);
    });
    node.append(body);
    container.append(node);
    return container;
  }

  function prose(value) {
    return String(value || "").split("\n").filter((line) => !/^\s*\|/.test(line) && !/^\s*[-=]{3,}\s*$/.test(line))
      .map((line) => line.replace(/^\s*#{1,6}\s+/, "").replace(/^\s*[-*]\s+/, "• ")).join("\n").trim();
  }

  function documentDetails(label, block) {
    const detail = element("details", "document-details");
    detail.append(element("summary", "", label));
    const status = element("div");
    renderSource(status, block && block.source);
    detail.append(status);
    if (block && array(block.rows).length) detail.append(table(block.columns, block.rows, label));
    const copy = prose(block && block.text);
    if (copy) detail.append(element("p", "document-text", copy));
    else if (!array(block && block.rows).length) empty(detail);
    return detail;
  }

  function personalMoney(value, coin) {
    return typeof value === "number" && Number.isFinite(value) ? money(value, coin) : "a confirmar";
  }

  function subscriptionState(plan) {
    return ["active", "inactive", "unconfirmed"].includes(plan.subscription_state) ? plan.subscription_state : "unconfirmed";
  }

  function paymentLabel(item) {
    const labels = {paid: "Paga", overdue: "Vencida", due: "A vencer", unconfirmed: "A confirmar", exempt: "Sem cobrança"};
    return labels[item.payment_status] || "A confirmar";
  }

  function stateBadge(plan) {
    const state = subscriptionState(plan);
    const badge = element("span", "subscription-state");
    badge.dataset.state = state;
    badge.append(element("span", "subscription-light"), element("span", "", {active: "Ativa", inactive: "Inativa", unconfirmed: "A confirmar"}[state]));
    badge.firstChild.setAttribute("aria-hidden", "true");
    return badge;
  }

  function renderMoneyStack(target, entries, fonte) {
    const stack = element("div", "money-stack");
    if (fonte) stack.dataset.fonte = fonte;
    if (!array(entries).length) {
      stack.append(element("span", "amount-leading", "a confirmar"));
    } else array(entries).forEach((entry) => {
      const row = element("div", "money-stack-row");
      row.append(element("span", "amount-leading", money(entry.valor, entry.moeda)), element("span", "coin-label", entry.moeda || "moeda não informada"));
      stack.append(row);
    });
    target.append(stack);
  }

  function benefitEntries(block) {
    return array(block.benefits && block.benefits.entries).filter((entry) => entry && typeof entry === "object");
  }

  function benefitExpiry(entry) {
    const expired = entry.expiry_state === "expired";
    if (/^\d{4}-\d{2}-\d{2}$/.test(entry.expires_on || "")) return (expired ? "Vencido em " : "Vence em ") + dateLabel(entry.expires_on);
    const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(entry.expires_month || "");
    if (month) {
      const label = new Intl.DateTimeFormat("pt-BR", {month: "long", year: "numeric"}).format(new Date(Number(month[1]), Number(month[2]) - 1, 1));
      return (expired ? "Vencido em " : "Vence em ") + label + "; dia a confirmar";
    }
    return expired ? "Vencido; data a confirmar" : "Vencimento: a confirmar";
  }

  function benefitSource(entry, block) {
    const metadata = block.benefits && block.benefits.source || {};
    const origin = entry.source && typeof entry.source === "object" ? entry.source : {};
    const label = typeof entry.source === "string" && entry.source.trim() ? entry.source : origin.path || metadata.path;
    const note = element("p", "benefit-source", "Fonte: " + (label ? text(label) : "a confirmar"));
    const updated = origin.updated_at || metadata.updated_at;
    note.append(element("span", "", updated ? "Entrega atualizada em " + dateLabel(updated, true) : "Data da entrega: a confirmar"));
    return note;
  }

  function benefitWarnings(entry) {
    const inactive = "Assinatura vinculada inativa; confirme a validade do benefício na fonte.";
    const ambiguous = "Vínculo com a assinatura ambíguo; confira a fonte.";
    const labels = {
      assinatura_ambigua: ambiguous, servico_com_multiplas_assinaturas: ambiguous,
      assinatura_id_nao_encontrado: "Identificador da assinatura não encontrado; confira o vínculo.",
      servico_diverge_da_assinatura: "O serviço informado difere do serviço da assinatura vinculada.",
      disponibilidade_nao_confirmada_pelo_estado_da_assinatura: entry.subscription_state === "inactive" ? inactive : "Uso do benefício depende de confirmar o estado da assinatura.",
      tipo_de_beneficio_invalido: "Tipo de benefício a confirmar.",
      valor_nominal_invalido_ou_ausente: "Valor nominal ausente ou inválido; confirme na fonte.",
      saldo_invalido: "Saldo ausente ou inválido; confirme na fonte.",
      moeda_nao_suportada_ou_ausente: "Moeda ausente ou não reconhecida; confirme na fonte.",
      ambiente_nao_informado: "Ambiente do benefício não informado.", servico_nao_informado: "Serviço não informado.",
      periodicidade_nao_informada: "Recorrência do benefício não informada.", beneficio_nao_confirmado: "Benefício ainda não confirmado na fonte.",
      vencimento_ambiguo: "Há datas de vencimento conflitantes; confirme na fonte.",
      data_de_vencimento_invalida: "Data de vencimento inválida; confirme na fonte.",
      mes_de_vencimento_invalido: "Mês de vencimento inválido; confirme na fonte.",
      data_exata_de_vencimento_desconhecida: "Dia do vencimento a confirmar.", vencimento_nao_informado: "Vencimento não informado.",
      data_de_observacao_invalida: "Data do saldo informado inválida; confirme na fonte.",
      data_de_observacao_nao_informada: "Data do saldo informado não registrada.",
      id_de_beneficio_nao_informado: "Identificador do benefício não informado na fonte.",
      id_de_beneficio_duplicado: "Identificador de benefício duplicado; valor a confirmar."
    };
    const messages = new Set(array(entry.issues).map((issue) => typeof labels[issue] === "string" ? labels[issue] : "Há informações que precisam de confirmação na fonte."));
    if (entry.subscription_state === "inactive") messages.add(inactive);
    if (entry.match_state === "ambiguous") messages.add(ambiguous);
    return [...messages];
  }

  function benefitCard(entry, block, showService = false) {
    const card = element("article", "benefit-card");
    card.dataset.benefitId = String(entry.id || "");
    card.dataset.expiryState = String(entry.expiry_state || "unknown");
    const top = element("div", "benefit-heading");
    const types = {bonus_recorrente: "Bônus recorrente", franquia_incluida: "Franquia incluída", credito_extra: "Crédito extra", saldo_api: "Saldo de API"};
    top.append(element(showService ? "h4" : "h5", "", showService ? entry.servico || "Serviço a confirmar" : types[entry.tipo] || "Benefício a confirmar"));
    if (entry.confirmed !== true) top.append(element("span", "badge badge-gold", "A confirmar"));
    card.append(top);
    if (showService) card.append(element("p", "benefit-type", types[entry.tipo] || "Benefício a confirmar"));
    card.append(element("p", "benefit-context", "Ambiente do benefício: " + (entry.ambiente || "a confirmar")));
    if (entry.match_state === "standalone") card.append(element("p", "benefit-context", "Conta de API independente de assinatura."));
    const amounts = element("dl", "benefit-amounts");
    const nominal = element("div");
    nominal.append(element("dt", "", entry.tipo === "saldo_api" ? "Valor nominal informado" : entry.tipo === "credito_extra" ? "Crédito extra nominal" : "Franquia/bônus nominal"), element("dd", "", personalMoney(entry.valor, entry.moeda)));
    const balance = element("div");
    balance.append(element("dt", "", "Saldo informado"), element("dd", "", personalMoney(entry.saldo_disponivel, entry.moeda)));
    if (entry.tipo !== "saldo_api" || typeof entry.valor === "number" && Number.isFinite(entry.valor)) amounts.append(nominal);
    amounts.append(balance);
    card.append(amounts);
    const recurrence = entry.periodicidade && String(entry.periodicidade).trim();
    if (entry.tipo !== "saldo_api" || recurrence) card.append(element("p", "benefit-recurrence", recurrence ? "Recorrência: " + recurrence : "Recorrência: a confirmar (não informada)"));
    if (typeof entry.saldo_disponivel === "number" && Number.isFinite(entry.saldo_disponivel)) {
      card.append(element("p", "benefit-observed", entry.observed_at ? "Saldo informado em " + dateLabel(entry.observed_at) : "Data do saldo informado: a confirmar"));
    }
    card.append(element("p", "benefit-expiry", benefitExpiry(entry)));
    if (entry.usage_condition) card.append(element("p", "benefit-condition", "Condição de uso informada: " + text(entry.usage_condition)));
    if (entry.notes) card.append(element("p", "benefit-notes", entry.notes));
    const warnings = benefitWarnings(entry);
    if (warnings.length) {
      const list = element("ul", "benefit-issues");
      list.setAttribute("aria-label", "Pontos a conferir");
      warnings.forEach((warning) => list.append(element("li", "", warning)));
      card.append(list);
    }
    card.append(benefitSource(entry, block));
    return card;
  }

  function renderExpiringBenefits(target, block) {
    const expiring = benefitEntries(block).filter((entry) => ["expired", "this_month", "soon"].includes(entry.expiry_state));
    if (!expiring.length) return;
    const section = element("section", "benefit-alert-section");
    section.setAttribute("aria-label", "Créditos a vencer e vencidos");
    const heading = element("div", "subsection-heading");
    heading.append(element("h3", "", "Créditos a vencer e vencidos"), button("Ver benefícios", "button-outline", () => navigate("subscriptions")));
    section.append(heading, element("p", "section-intro", "Potencial perda de benefício. Confira o saldo e o prazo na fonte; esses valores não são contas a pagar nem reduzem a cobrança do serviço."));
    const list = element("div", "benefit-alert-list");
    expiring.forEach((entry) => list.append(benefitCard(entry, block, true)));
    section.append(list);
    target.append(section);
  }

  function renderOverview(block, user) {
    renderSource(byId("user-source"), block.source);
    const target = byId("user-content");
    clear(target);
    const summary = block.summary || user.quota || {};
    const identity = element("div", "overview-identity");
    identity.append(element("p", "user-name", user.nome || "Sócio"));
    const share = element("p", "participation", "Participação usada no rateio: ");
    share.append(document.createTextNode(" "));
    const percentage = summary.current_share !== undefined ? summary.current_share : user.participacao_pct;
    share.append(element("strong", "", percentage === undefined || percentage === null || percentage === "" ? "a confirmar" : text(percentage).replace(/%$/, "") + "%"));
    identity.append(share);
    target.append(identity);
    const hero = element("div", "overview-hero");
    const own = element("div");
    own.append(element("p", "eyebrow", "SÓ AS ASSINATURAS"), headingWithSource("Sua parte nas assinaturas", block.source, "O equivalente mensal das assinaturas confirmadas, dividido pela sua participação cadastrada, cada moeda à parte. Nada aqui é cobrança nova.", "sua-parte"));
    renderMoneyStack(own, summary.personal_fixed_monthly, "sua-parte");
    own.append(element("p", "hero-footnote", "Cada moeda à parte, sem converter. A sua parte no gasto do mês, em reais, está no topo da página."));
    const company = element("div", "hero-comparison");
    company.append(element("p", "eyebrow", "SÓ AS ASSINATURAS"), headingWithSource("Assinaturas da empresa", block.source, "Soma do equivalente mensal das assinaturas ativas com dados completos, moeda por moeda.", "total-empresa"));
    renderMoneyStack(company, summary.fixed_monthly, "total-empresa");
    company.append(element("p", "hero-footnote", "Cada moeda à parte, sem converter. O gasto do mês inteiro, em reais, está no topo da página."));
    hero.append(own, company);
    target.append(hero);
    const billing = block.billing || {};
    const charges = array(billing.charges);
    const stats = element("div", "overview-stats");
    const plansKnown = block.source && block.source.exists;
    const chargesKnown = billing.mode === "plans_preview" ? plansKnown : billing.source && billing.source.exists;
    [[plansKnown ? array(block.plans).filter((plan) => subscriptionState(plan) === "active").length : "—", "assinaturas ativas"], [chargesKnown ? charges.filter((charge) => charge.due_soon).length : "—", "cobranças em até 7 dias"], [chargesKnown ? charges.filter((charge) => charge.overdue).length : "—", "cobranças vencidas"]].forEach(([number, label]) => {
      const item = element("div", "overview-stat"); item.append(element("strong", "", number), element("span", "", label)); stats.append(item);
    });
    target.append(stats);
    if (summary.incomplete_costs > 0 || summary.incomplete_personal_costs > 0) target.append(element("p", "notice", "Há compromissos com dados incompletos. Valores sem confirmação, moeda ou participação suficiente permanecem a confirmar."));
    renderExpiringBenefits(target, block);
    const heading = element("div", "subsection-heading");
    heading.append(element("h3", "", "Próximos compromissos"), button("Ver assinaturas", "button-outline", () => navigate("subscriptions")));
    target.append(heading);
    if (billing.mode === "plans_preview") target.append(element("p", "section-intro", "Previsões dos planos cadastrados. Um registro separado de cobranças ainda não foi entregue."));
    const near = charges.filter((charge) => charge.due_soon || charge.overdue);
    if (!near.length) { empty(target, billing.source && !billing.source.exists && billing.mode !== "plans_preview" ? "sem entrega de cobranças ainda" : "Nenhuma cobrança vencida ou prevista para os próximos 7 dias nesta entrega."); return; }
    const list = element("div", "upcoming-list");
    near.forEach((charge) => {
      const row = element("article", "upcoming-item");
      const name = element("div"); name.append(element("h4", "", charge.servico || "Serviço não informado"), element("p", "plan-name", charge.plano || paymentLabel(charge)));
      const due = element("div"); due.append(element("span", "upcoming-label", paymentLabel(charge) + (billing.mode === "plans_preview" && charge.schedule_derived === true ? " · Data prevista" : "")), element("span", "upcoming-value", dateLabel(charge.due_date)));
      const total = element("div"); total.append(element("span", "upcoming-label", "Empresa"), element("span", "upcoming-value", money(charge.valor, charge.moeda)));
      const personal = element("div"); personal.append(element("span", "upcoming-label", "Sua parte"), element("span", "upcoming-value personal", personalMoney(charge.personal_amount, charge.moeda)));
      row.append(name, due, total, personal); list.append(row);
    });
    target.append(list);
  }

  // ── Assinaturas e Vender primeiro pelo diário (F2-5): controles honestos, liberados ação por ação ────────────────────
  // host().pode(acao, alvo) diz se dá para gravar agora (diário gravando ou em treino) e, se não, por quê. Um host sem
  // pode() (o AI Cask nativo) segue o readOnly antigo. Confirmar, Marcar como paga, Encerrar e Nova assinatura abrem as
  // folhas do assinaturas.js (window.financeAssinaturas); Editar, Reativar e as caixinhas vão pela ponte (financeRequest),
  // pelo id e pela versão que a sócia viu.
  function podeFazer(acao, alvo) {
    const atual = host();
    if (typeof atual.pode === "function") {
      try {
        const resposta = atual.pode(acao, alvo);
        return resposta && resposta.ok === true ? {ok: true, treino: resposta.treino === true} : {ok: false, motivo: text(resposta && resposta.motivo ? resposta.motivo : "Não dá para gravar agora.")};
      } catch (_) { return {ok: false, motivo: "Não foi possível conferir se dá para gravar agora."}; }
    }
    return atual.readOnly === true ? {ok: false, motivo: "Esta versão não grava assinaturas nem passos."} : {ok: true, treino: false};
  }
  // nota de cadeado (14px, sem vermelho: não é erro), com o motivo por extenso
  function lockNote(motivo) {
    const note = element("p", "lock-note");
    const ns = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(ns, "svg");
    [["viewBox", "0 0 14 14"], ["width", "14"], ["height", "14"], ["aria-hidden", "true"], ["class", "lock-icon"]].forEach(([k, v]) => icon.setAttribute(k, v));
    const body = document.createElementNS(ns, "rect");
    [["x", "2.5"], ["y", "6"], ["width", "9"], ["height", "7"], ["rx", "1.5"]].forEach(([k, v]) => body.setAttribute(k, v));
    const arc = document.createElementNS(ns, "path");
    arc.setAttribute("d", "M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6");
    icon.append(body, arc);
    note.append(icon, element("span", "", motivo));
    return note;
  }
  function dayMonth(value) {
    if (!value) return "";
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("pt-BR", {day: "2-digit", month: "2-digit"}).format(date) : "";
  }
  function cycleLabel(cycle) {
    const date = new Date(cycle + "-15T12:00:00");
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("pt-BR", {month: "long", year: "numeric"}).format(date) : text(cycle);
  }
  // "Criado por Ana em 17/10 · confirmado por Beatriz em 18/10" ou "Alterado por Ana em 17/10" (só com dado do diário)
  function planAuthorship(plan) {
    const parts = [];
    const add = (verb, who, when) => parts.push((parts.length ? verb : verb.charAt(0).toUpperCase() + verb.slice(1)) + " por " + who + (when ? " em " + dayMonth(when) : ""));
    const confirmer = plan.confirmed === true && plan.confirmed_by_nome ? plan.confirmed_by_nome : "";
    if (plan.created_by_nome) add("criado", plan.created_by_nome, plan.created_at);
    if (plan.changed_by_nome && plan.changed_at !== plan.created_at && !(confirmer && plan.changed_at === plan.confirmed_at)) add("alterado", plan.changed_by_nome, plan.changed_at);
    if (confirmer) add("confirmado", confirmer, plan.confirmed_at);
    return parts.join(" · ");
  }
  // "Anual de US$ 99,00 ÷ 12 = US$ 8,25 por mês." (o equivalente mensal vem do domínio, em centavos)
  const periodMath = {anual: "÷ 12", ano: "÷ 12", yearly: "÷ 12", semestral: "÷ 6", trimestral: "÷ 3", semanal: "× 52 ÷ 12", quinzenal: "× 26 ÷ 12"};
  function monthlyExplanation(plan) {
    const op = periodMath[normalized(plan.periodo).replace(/_/g, "")];
    if (!op || typeof plan.monthly_amount !== "number" || typeof plan.valor !== "number") return "";
    const label = String(plan.periodo || "").trim();
    return label.charAt(0).toUpperCase() + label.slice(1) + " de " + money(plan.valor, plan.moeda) + " " + op + " = " + money(plan.monthly_amount, plan.moeda) + " por mês.";
  }
  function callSubscriptions(name, plan) {
    const api = window.financeAssinaturas;
    if (!api || typeof api[name] !== "function") { message("dashboard-error", "Um instante: o portal ainda está carregando."); return; }
    message("dashboard-error", "");
    api[name](plan.id);
  }
  // os períodos que o razão aceita para confirmar (EQUIVALENTE do razao.js); fora deles ("por venda") não há valor fixo
  const fixedPeriods = ["mensal", "mes", "monthly", "anual", "ano", "yearly", "trimestral", "semestral", "semanal", "quinzenal"];
  const periodKey = (value) => normalized(value).replace(/[^a-z]/g, "");
  const monthlyPeriod = (value) => ["mensal", "mes", "monthly"].includes(periodKey(value));
  async function setSubscription(plan, block, active) {
    if (mutationBusy) return;
    mutationBusy = true;
    // reativar uma encerrada ou desfazer um encerramento marcado para o futuro: a mesma ação (reactivate_plan)
    const undo = active && subscriptionState(plan) !== "inactive";
    try {
      await window.financeRequest("set_subscription", {index: plan.index, id: plan.id, version: plan.version || 1, active, expected_revision: block.source && block.source.revision});
      announce(undo ? "Encerramento desfeito: a assinatura continua ativa." : active ? "Assinatura reativada no portal. O serviço externo não foi alterado." : "Assinatura encerrada no portal. Cancele também no site do serviço.");
      await loadSnapshot(true);
    } catch (failure) {
      if (["stale_source", "stale_plan"].includes(failure.code)) await loadSnapshot(true);
      message("dashboard-error", failure.message);
    } finally { mutationBusy = false; }
  }

  function renderSubscriptions(block, user) {
    pendingRender.subscriptions = false;
    renderSource(byId("subscriptions-source"), block.source);
    const target = byId("subscriptions-content");
    clear(target);
    const plans = array(block.plans);
    const benefits = benefitEntries(block);
    if (benefits.length) target.append(element("p", "benefit-explanation", "Franquias e créditos são benefícios do serviço. O valor nominal não é o saldo disponível, não reduz a cobrança e não é rateado pela sua participação."));
    else target.append(element("p", "benefit-explanation", "Benefícios e créditos: a confirmar. " + (block.benefits && block.benefits.source && block.benefits.source.exists ? "Nenhum benefício registrado nesta entrega." : "Fonte ainda não entregue.")));
    if (!plans.length) empty(target, block.source && block.source.exists ? "Nenhuma assinatura informada nesta entrega." : "sem entrega ainda");
    const planIdCounts = new Map();
    plans.forEach((plan) => { if (plan.id) planIdCounts.set(String(plan.id), (planIdCounts.get(String(plan.id)) || 0) + 1); });
    const linkedBenefits = new Map();
    const orphanBenefits = [];
    benefits.forEach((entry) => {
      const id = entry.subscription_id ? String(entry.subscription_id) : "";
      if (id && planIdCounts.get(id) === 1 && entry.match_state !== "ambiguous") {
        if (!linkedBenefits.has(id)) linkedBenefits.set(id, []);
        linkedBenefits.get(id).push(entry);
      } else orphanBenefits.push(entry);
    });
    // com o diário (pode() na ponte): Confirmar, Marcar como paga e a folha de Encerrar; sem ele, só Editar e o estado
    const journal = typeof host().pode === "function";
    const general = podeFazer("edit_plan");
    const list = element("div", "plans-list");
    plans.forEach((plan) => {
      const state = subscriptionState(plan);
      const inactive = state === "inactive";
      const card = element("article", "plan-card" + (plan.due_soon ? " due-soon" : "") + (plan.overdue ? " overdue" : "") + (!plan.confirmed ? " unconfirmed" : "") + (inactive ? " inactive" : ""));
      card.dataset.planIndex = String(plan.index);
      card.dataset.planId = String(plan.id || "");
      const top = element("div", "plan-top");
      const heading = element("div"); heading.append(element("h3", "plan-title", plan.servico || "Serviço não informado"), element("p", "plan-name", plan.plano || "Plano não informado"));
      const badges = element("div", "plan-badges");
      badges.append(stateBadge(plan));
      // a confirmar (quatro olhos nos dados da fatura): contorno tracejado, sem vermelho
      if (!plan.confirmed && !inactive && state !== "unconfirmed") badges.append(element("span", "pilula-confirmar", "a confirmar"));
      top.append(heading, badges);
      const amounts = element("div", "amount-pair");
      const company = element("div"); company.append(element("span", "amount-pair-label", "Custo da assinatura"), element("div", "plan-amount", money(plan.valor, plan.moeda)), element("p", "monthly-note", "Cobrança da empresa · " + (plan.periodo || "Período não informado")));
      const explanation = monthlyExplanation(plan);
      if (explanation) company.append(element("p", "monthly-note plan-math", explanation));
      const personal = element("div");
      if (inactive) personal.append(element("span", "amount-pair-label", "Sua parte"), element("div", "plan-amount personal-amount is-none", "—"), element("p", "monthly-note", "Encerrada: sem cobrança, sem parte."));
      else {
        personal.append(element("span", "amount-pair-label", "Sua parte nesta cobrança"), element("div", "plan-amount personal-amount", personalMoney(plan.personal_amount, plan.moeda)));
        if (plan.personal_monthly_amount !== undefined && plan.personal_monthly_amount !== null) personal.append(element("p", "monthly-note", "Equivalente mensal: " + money(plan.personal_monthly_amount, plan.moeda)));
      }
      amounts.append(company, personal);
      const bottom = element("div", "plan-bottom");
      const details = element("div", "plan-details");
      if (inactive) {
        details.append(element("span", "plan-archived", plan.archived_since ? "Encerrada desde " + dateLabel(plan.archived_since) + (plan.archived_by_nome ? " · por " + plan.archived_by_nome : "") : "Encerrada"));
        if (plan.archive_reason) details.append(element("span", "plan-archive-reason", "Motivo: " + plan.archive_reason));
      } else {
        if (Number.isInteger(plan.monthly_day) && plan.monthly_day >= 1 && plan.monthly_day <= 31) details.append(element("span", "plan-monthly-day", "Vencimento mensal: dia " + plan.monthly_day));
        details.append(element("span", "plan-next-date", (plan.schedule_derived === true ? "Próxima data prevista: " : "Próxima data: ") + dateLabel(plan.proxima_data)));
        if (typeof plan.schedule_issue === "string" && plan.schedule_issue.trim()) details.append(element("span", "plan-schedule-issue", plan.schedule_issue));
        details.append(element("span", "badge" + (plan.overdue ? " badge-danger" : plan.due_soon ? " badge-gold" : ""), "Cobrança: " + paymentLabel(plan)));
        if (plan.payment_status === "paid" && plan.paid_cycle) details.append(element("span", "plan-paid", "Paga · ciclo de " + cycleLabel(plan.paid_cycle)));
        if (plan.archived_since) details.append(element("span", "plan-archived", "Encerra em " + dateLabel(plan.archived_since) + (plan.archived_by_nome ? " · por " + plan.archived_by_nome : "") + (plan.archive_reason ? ": " + plan.archive_reason : "")));
      }
      const authorship = planAuthorship(plan);
      if (authorship) details.append(element("span", "plan-autoria", authorship));
      bottom.append(details);
      // ações: cada uma pergunta à ponte se pode; desligada, mostra o motivo (nunca um formulário que depois recusa)
      const actions = element("div", "plan-actions");
      const notes = [];
      const action = (label, className, name, handler, permission = general) => {
        const node = button(label, className, handler);
        node.dataset.planAction = name;
        if (!permission.ok) {
          node.disabled = true; node.title = permission.motivo;
          if (general.ok && !notes.includes(permission.motivo)) notes.push(permission.motivo);   // sem gravação, o aviso fica no topo da página
        }
        actions.append(node);
        return node;
      };
      // cobrança sem período fixo ("por venda"): não há o que confirmar com a fatura, então no lugar do botão vai a nota
      const variable = Boolean(String(plan.periodo || "").trim()) && !fixedPeriods.includes(periodKey(plan.periodo));
      if (journal && !plan.confirmed && !inactive && variable) notes.push("Cobrança " + String(plan.periodo).trim() + ": sem valor fixo, não entra no previsto.");
      else if (journal && !plan.confirmed && !inactive) action("Confirmar", "button-primary", "confirmar", () => callSubscriptions("confirmar", plan), podeFazer("confirm_plan", plan.id));
      const payable = journal && !inactive && !(plan.payment_status === "paid" && plan.paid_cycle);
      if (payable) {
        const pay = action("Marcar como paga", "button-outline", "pagar", () => callSubscriptions("pagar", plan), podeFazer("record_payment"));
        // "Cobrança: Paga" que veio do pacote (sem gasto ligado no diário): o botão não duplica, mas diz quando usar
        if (!pay.disabled && plan.payment_status === "paid") {
          const when = block.source && block.source.updated_at ? dayMonth(block.source.updated_at) : "";
          notes.push("Paga segundo o pacote" + (when ? " de " + when : "") + ": marque só se o gasto ainda não está em Lançamentos.");
        }
      }
      action("Editar", "button-quiet", "editar", () => {
        editingPlan = plan.id; renderSubscriptions(block, user);
        const field = byId("plan-value-" + plan.index); if (field) field.focus();
      });
      // encerrada: Reativar; encerramento marcado para uma data futura (ainda ativa): Desfazer o encerramento
      if (inactive || plan.archived_since) action(inactive ? "Reativar" : "Desfazer o encerramento", "button-quiet", "reativar", () => setSubscription(plan, block, true), podeFazer("reactivate_plan"));
      else action("Encerrar", "button-quiet", "encerrar", () => (journal ? callSubscriptions("encerrar", plan) : setSubscription(plan, block, false)), podeFazer("archive_plan"));
      const management = element("div", "plan-management");
      management.append(actions);
      notes.forEach((note) => management.append(element("p", "plan-action-note", note)));
      card.append(top, amounts, bottom, management);
      const attached = linkedBenefits.get(String(plan.id)) || [];
      if (attached.length) {
        const section = element("section", "plan-benefits");
        section.append(element("h4", "", "Franquias e créditos desta assinatura"));
        attached.forEach((entry) => section.append(benefitCard(entry, block)));
        card.append(section);
      }
      if (editingPlan === plan.id) card.append(planForm(plan, block.source && block.source.revision));
      list.append(card);
    });
    if (plans.length) target.append(list);
    if (orphanBenefits.length) {
      const section = element("section", "orphan-benefits");
      section.append(element("div", "subsection-heading"));
      section.firstChild.append(element("h3", "", "Créditos e benefícios avulsos"));
      section.append(element("p", "section-intro", "Contas de API independentes aparecem aqui sem exigir assinatura. Quando o vínculo ainda precisa de confirmação, o aviso acompanha o registro. Serviço, ambiente e fonte permanecem visíveis."));
      const cards = element("div", "benefit-alert-list");
      orphanBenefits.forEach((entry) => cards.append(benefitCard(entry, block, true)));
      section.append(cards);
      target.append(section);
    }
  }

  function inputField(label, id, type, value) {
    const holder = element("div", "field");
    const caption = element("label", "", label);
    caption.htmlFor = id;
    const input = element("input");
    input.id = id;
    input.type = type;
    input.value = value === undefined || value === null ? "" : String(value);
    holder.append(caption, input);
    return {holder, input};
  }

  function selectField(label, id, options, value) {
    const holder = element("div", "field");
    const caption = element("label", "", label);
    caption.htmlFor = id;
    const select = element("select");
    select.id = id;
    options.forEach(([optionValue, optionLabel]) => { const option = element("option", "", optionLabel); option.value = optionValue; select.append(option); });
    select.value = value;
    holder.append(caption, select);
    return {holder, input: select};
  }
  // as moedas e os períodos que o razão aceita (MOEDAS e EQUIVALENTE do razao.js), nos rótulos da folha Nova assinatura
  const planCoins = [["BRL", "Real (BRL)"], ["USD", "Dólar (USD)"], ["EUR", "Euro (EUR)"]];
  const planPeriods = [["mensal", "Mensal"], ["trimestral", "Trimestral"], ["semestral", "Semestral"], ["anual", "Anual"]];

  // Editar: valor, moeda, período, dia do vencimento (mensal) ou próxima data (os outros) e a anotação de status, enviados
  // pelo id e pela versão que a sócia viu (edit_plan no diário). Só vai o que ela mudou; nenhum campo é obrigatório.
  // Host antigo (sem pode(): o AI Cask nativo, que aplica o applyMutation do domain.js): só valor, próxima data e status,
  // os três que ele aceita, para o formulário nunca mandar o que vai ser recusado.
  function planForm(plan, sourceRevision) {
    const legacy = typeof host().pode !== "function";
    const form = element("form", "plan-edit-form");
    form.dataset.planForm = String(plan.index);
    form.dataset.planId = String(plan.id || "");
    form.append(element("p", "edit-explanation", legacy ? "Mudar o valor tira a confirmação: outra sócia confere de novo com a fatura. A moeda e o período continuam os mesmos." : "Mudar valor, moeda ou período tira a confirmação: outra sócia confere de novo com a fatura."));
    const grid = element("div", "plan-edit-grid");
    // o valor de hoje à moda brasileira (34,90): é o que a ponte lê com centavosBR se a sócia mudar
    const digits = Number.isInteger(plan.minor_unit_digits) ? plan.minor_unit_digits : 2;
    const initialValue = typeof plan.valor === "number" && Number.isFinite(plan.valor) ? plan.valor.toFixed(digits).replace(".", ",") : "";
    const amount = inputField(legacy ? "Valor (" + text(plan.moeda || "moeda não informada") + ")" : "Valor", "plan-value-" + plan.index, "text", initialValue);
    amount.input.inputMode = "decimal";
    amount.input.maxLength = 80;
    amount.input.placeholder = "Ex.: 34,90";
    // moeda ou período fora da lista (moeda não informada, "por venda") fica como está até a sócia escolher outro
    const initialCoin = planCoins.some(([coin]) => coin === plan.moeda) ? plan.moeda : "";
    const coin = selectField("Moeda", "plan-coin-" + plan.index, initialCoin ? planCoins : [["", "Não informada"], ...planCoins], initialCoin);
    const rawPeriod = String(plan.periodo || "").trim();
    const initialPeriod = planPeriods.find(([key]) => key === periodKey(rawPeriod)) ? periodKey(rawPeriod) : rawPeriod;
    const period = selectField("Período", "plan-period-" + plan.index, planPeriods.some(([key]) => key === initialPeriod) ? planPeriods : [[rawPeriod, rawPeriod || "Não informado"], ...planPeriods], initialPeriod);
    const initialDay = Number.isInteger(plan.monthly_day) ? String(plan.monthly_day) : "";
    const day = inputField("Dia do vencimento (1 a 31)", "plan-day-" + plan.index, "number", initialDay);
    Object.assign(day.input, {min: "1", max: "31", step: "1", inputMode: "numeric", placeholder: "Ex.: 12"});
    // a próxima data guardada: a que o domínio calcula pelo dia (schedule_derived) não está gravada no plano
    const storedDate = plan.schedule_derived === true && !legacy ? "" : plan.proxima_data || "";
    const due = inputField("Próxima data", "plan-date-" + plan.index, "date", plan.proxima_data || "");
    // mensal: o vencimento é o dia do mês; os outros períodos: a próxima data (como na folha Nova assinatura)
    const schedule = () => {
      const monthly = !legacy && monthlyPeriod(period.input.value);
      day.holder.hidden = !monthly; day.input.disabled = !monthly;
      due.holder.hidden = monthly; due.input.disabled = monthly;
    };
    period.input.addEventListener("change", schedule);
    schedule();
    const status = inputField("Anotação de status", "plan-status-" + plan.index, "text", plan.status || "");
    status.input.placeholder = "Ex.: nota de outubro conferida (opcional)";
    status.input.maxLength = 240;
    if (legacy && plan.status) status.input.required = true;   // o applyMutation recusa status vazio: avisa antes de enviar
    if (legacy) grid.append(amount.holder, due.holder, status.holder);
    else grid.append(amount.holder, coin.holder, period.holder, day.holder, due.holder, status.holder);
    const error = element("p", "form-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    const footer = element("div", "form-actions");
    footer.append(button("Cancelar", "button-quiet", () => {
      editingPlan = null;
      renderSubscriptions(currentSnapshot.blocks.user, currentSnapshot.user);
    }));
    const save = element("button", "button button-primary", "Salvar alterações");
    save.type = "submit";
    footer.append(save);
    form.append(grid, error, footer);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || mutationBusy) return;
      const values = {};
      if (amount.input.value.trim() !== initialValue) {
        if (!amount.input.value.trim()) { error.textContent = "Informe o valor da cobrança (ex.: 34,90)."; error.hidden = false; amount.input.focus(); return; }
        values.valor = amount.input.value;
      }
      if (!legacy && coin.input.value !== initialCoin) values.moeda = coin.input.value;
      if (!legacy && period.input.value !== initialPeriod) values.periodo = period.input.value;
      if (!legacy && monthlyPeriod(period.input.value)) {
        const dayValue = day.input.value.trim();
        if (dayValue !== initialDay) {
          values.dia = dayValue;
          if (storedDate) values.proxima_data = "";   // a próxima data passa a sair do dia novo
        }
      } else {
        if (due.input.value !== storedDate) values.proxima_data = due.input.value;
        if (!legacy && initialDay && monthlyPeriod(rawPeriod)) values.dia = "";   // deixou de ser mensal: o dia do mês não vale mais
      }
      if (status.input.value !== (plan.status || "")) values.status = status.input.value;
      if (!Object.keys(values).length) { editingPlan = null; renderSubscriptions(currentSnapshot.blocks.user, currentSnapshot.user); return; }
      mutationBusy = true;
      save.disabled = true;
      error.hidden = true;
      try {
        await window.financeRequest("edit_plan", {index: plan.index, id: plan.id, version: plan.version || 1, values, expected_revision: sourceRevision});
        editingPlan = null;
        announce("Assinatura alterada.");
        await loadSnapshot(true);
      } catch (failure) {
        if (failure.code === "stale_source" || failure.code === "stale_plan") {
          editingPlan = null;
          await loadSnapshot(true);
          message("dashboard-error", text(failure.message) + " O painel foi atualizado; confira os dados antes de editar de novo.");
        } else {
          error.textContent = text(failure.message);
          error.hidden = false;
        }
      } finally { mutationBusy = false; save.disabled = false; }
    });
    return form;
  }

  // Vender primeiro: todos os produtos (o corte em 3 acabou), a barra "3 de 4 passos" e quem marcou cada passo.
  function renderSelling(block) {
    pendingRender.selling = false;
    renderSource(byId("sell-source"), block.source);
    const target = byId("sell-content");
    clear(target);
    const products = array(block.products);
    if (!products.length) {
      if (array(block.rows).length) target.append(table(block.columns, block.rows, "Produtos a vender primeiro"));
      else empty(target, block.source && block.source.exists ? "Nenhuma prioridade com próximos passos foi entregue." : "sem entrega ainda");
      return;
    }
    const permission = podeFazer("toggle_step");
    if (!permission.ok) target.append(lockNote(permission.motivo));
    const grid = element("div", "products-grid");
    products.forEach((product, index) => {
      const card = element("article", "product-card");
      const name = product.name || product.nome || "Produto";
      card.append(element("div", "product-order", String(index + 1).padStart(2, "0")), element("h3", "", name));
      const steps = array(product.steps);
      const done = steps.filter((step) => step.checked).length;
      if (steps.length) {
        const bar = element("progress", "budget-progress product-progress");
        bar.max = steps.length; bar.value = done;
        bar.setAttribute("aria-label", done + " de " + steps.length + " passos de " + text(name));
        card.append(bar, element("p", "product-progress-label", done + " de " + steps.length + " passos"));
      }
      const list = element("ul", "steps");
      steps.forEach((step) => {
        const item = element("li");
        const label = element("label", "check-label step-label");
        const checkbox = element("input");
        checkbox.type = "checkbox";
        checkbox.checked = step.checked === true;
        checkbox.dataset.stepIndex = String(step.index);
        checkbox.dataset.stepId = String(step.id || "");
        if (!permission.ok) { checkbox.disabled = true; label.title = permission.motivo; }
        const copy = element("span", "", step.text);
        label.append(checkbox, copy);
        item.append(label);
        if (step.checked && step.checked_by_nome) item.append(element("span", "step-autoria", "marcado por " + step.checked_by_nome + (step.checked_at ? " em " + dayMonth(step.checked_at) : "")));
        list.append(item);
        checkbox.addEventListener("change", async () => {
          if (mutationBusy) { checkbox.checked = !checkbox.checked; return; }
          const checked = checkbox.checked;
          checkbox.disabled = true;
          mutationBusy = true;
          try {
            await window.financeRequest("toggle_step", {index: step.index, id: step.id, version: step.version || 1, checked, expected_revision: block.source && block.source.revision});
            announce(checked ? "Passo marcado." : "Marcação removida.");
            await loadSnapshot(true);
          } catch (failure) {
            checkbox.checked = !checked;
            if (failure.code === "stale_source" || failure.code === "stale_step") {
              await loadSnapshot(true);
              message("dashboard-error", text(failure.message) + " O painel foi atualizado; confira o passo antes de marcar de novo.");
            } else message("dashboard-error", failure.message);
          } finally { mutationBusy = false; checkbox.disabled = !podeFazer("toggle_step").ok; }
        });
      });
      if (!steps.length) empty(card, "Próximos passos ainda não entregues.");
      card.append(list);
      grid.append(card);
    });
    target.append(grid);
  }

  function columnMatching(columns, pattern) { return array(columns).find((column) => pattern.test(normalized(column))); }
  function firstNumber(value) {
    const match = String(value || "").match(/-?\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(",", ".")) : null;
  }

  const kindLabels = {project: "Projeto", repository: "Repositório", platform: "Plataforma", component: "Componente", skill: "Skill", material: "Material", collection: "Coleção", archive: "Acervo", reference: "Referência"};
  const distributionLabels = {internal: "Uso interno", open_source_candidate: "Candidato a código aberto", free_candidate: "Candidato gratuito", commercial_candidate: "Candidato comercial", reference: "Referência", a_definir: "A definir"};
  // Prontidão (F2): o core manda {rotulo, auto, ajuste, final, criterios[5]{chave,nome,pontos,evidencia}, faltas[]{texto,proximo_passo}}
  // (nota documental 0–100) ou nulo; o número 0–5 é o formato antigo do inventário. Nada é calculado aqui: a tela só mostra.
  // Destino: asset.decisao = {id, destino, ajuste, justificativa, proximo_passo, autor, em} ou nulo; sem decisão, "A decidir".
  const destinoLabels = {produto: "Produto", open_source: "Código aberto", interno: "Uso interno", segredo: "Segredo", decidir: "A decidir"};
  const destinoOrder = ["produto", "open_source", "interno", "segredo", "decidir"];
  function readinessObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : null; }
  function readinessFinal(value) {
    const readiness = readinessObject(value);
    return readiness && typeof readiness.final === "number" && Number.isFinite(readiness.final) ? readiness.final : null;
  }
  function readinessAdjust(value) {
    const readiness = readinessObject(value);
    return readiness && typeof readiness.ajuste === "number" && Number.isFinite(readiness.ajuste) ? readiness.ajuste : 0;
  }
  function signed(number) { return (number > 0 ? "+" : "") + number; }
  function readinessLabel(value) {
    const readiness = readinessObject(value);
    if (readiness) {
      const final = readinessFinal(value);
      return final === null ? "Prontidão não calculada" : "Prontidão " + final + " · " + (typeof readiness.rotulo === "string" && readiness.rotulo ? readiness.rotulo : "documental");
    }
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 5) return "Prontidão registrada: " + value + "/5";
    return "Prontidão não calculada";
  }
  function readinessBadge(asset) {
    const node = element("p", "asset-readiness");
    const final = readinessFinal(asset.readiness);
    if (final !== null) node.dataset.readiness = String(final);
    node.append(element("span", "readiness-pill", readinessLabel(asset.readiness)));
    const adjust = readinessAdjust(asset.readiness);
    if (adjust) node.append(document.createTextNode(" · "), element("span", "readiness-adjust", "ajuste " + signed(adjust)));
    return node;
  }
  function assetDecision(asset) {
    const decision = asset && asset.decisao;
    return decision && typeof decision === "object" && !Array.isArray(decision) ? decision : null;
  }
  function assetDestino(asset) {
    const decision = assetDecision(asset);
    return decision && destinoLabels[decision.destino] ? decision.destino : "decidir";
  }
  function destinoChip(asset) {
    const key = assetDestino(asset);
    const chip = element("span", "asset-destino");
    chip.dataset.destino = key;
    const light = element("span", "destino-light"); light.setAttribute("aria-hidden", "true");
    const prefix = element("span", "sr-only"); prefix.textContent = "Destino: ";
    chip.append(light, prefix, element("span", "", destinoLabels[key]));
    return chip;
  }
  function decisionRow(asset) {
    const row = element("div", "asset-decision-row");
    row.append(readinessBadge(asset), destinoChip(asset));
    return row;
  }
  // Quem decide: o host nativo marca financeHost.decide depois do login; o snapshot também traz user.decide (PWA). Portal é só leitura.
  function canDecide() {
    if (host().readOnly === true) return false;
    if (host().decide === true) return true;
    const user = currentSnapshot && currentSnapshot.user;
    return Boolean(user && typeof user === "object" && user.decide === true);
  }
  function renderReadiness(target, asset) {
    const readiness = readinessObject(asset.readiness);
    const section = element("section", "asset-detail-section readiness-section");
    section.append(element("h3", "", "Prontidão"));
    if (!readiness) {
      section.append(element("p", "document-text", readinessLabel(asset.readiness)), element("p", "form-help", "A nota documental é calculada no catálogo conferido. Esta ficha ainda não a recebeu."));
      target.append(section);
      renderDecision(target, asset);
      return;
    }
    section.append(element("p", "form-help", "Nota documental de 0 a 100: cinco critérios de até 20 pontos, lidos do catálogo. Não mede funcionamento, mercado nem preço."));
    const criteria = element("ul", "readiness-criteria");
    array(readiness.criterios).filter(item => item && typeof item === "object" && !Array.isArray(item)).forEach(item => {
      const row = element("li", "readiness-criterion");
      if (typeof item.chave === "string" && item.chave) row.dataset.criterio = item.chave;
      const points = typeof item.pontos === "number" && Number.isFinite(item.pontos) ? Math.max(0, Math.min(20, item.pontos)) : null;
      const head = element("div", "readiness-criterion-head");
      head.append(element("span", "readiness-criterion-name", item.nome || item.chave || "Critério"), element("span", "readiness-criterion-points", (points === null ? "—" : points) + "/20"));
      const bar = element("progress", "budget-progress readiness-bar"); bar.max = 20; bar.value = points === null ? 0 : points; bar.setAttribute("aria-hidden", "true");
      row.append(head, bar, element("p", "readiness-evidence", item.evidencia || "Sem evidência registrada."));
      criteria.append(row);
    });
    section.append(criteria.childElementCount ? criteria : element("p", "document-text", "Critérios ainda não detalhados nesta ficha."));
    const total = element("p", "readiness-total");
    const auto = typeof readiness.auto === "number" && Number.isFinite(readiness.auto) ? readiness.auto : null;
    const adjust = readinessAdjust(asset.readiness);
    const final = readinessFinal(asset.readiness);
    total.append(element("span", "", "Automática " + (auto === null ? "não informada" : auto)));
    if (adjust) total.append(element("span", "", "ajuste " + signed(adjust) + " do Criador"));
    total.append(element("strong", "", final === null ? "Final não calculada" : "Final " + final + " · " + (typeof readiness.rotulo === "string" && readiness.rotulo ? readiness.rotulo : "documental")));
    section.append(total);
    target.append(section);
    const gaps = element("section", "asset-detail-section readiness-gaps");
    gaps.append(element("h3", "", "O que falta"));
    const faltas = array(readiness.faltas).filter(item => item && typeof item === "object" && !Array.isArray(item) && (typeof item.texto === "string" || typeof item.proximo_passo === "string"));
    if (!faltas.length) gaps.append(element("p", "document-text", "Nada em aberto pela régua documental. Isso não equivale a validação completa."));
    else {
      const decision = assetDecision(asset);
      const list = element("ul", "readiness-faltas");
      faltas.forEach((item, index) => {
        const row = element("li");
        const fromDecision = index === 0 && decision && typeof decision.proximo_passo === "string" && decision.proximo_passo && item.proximo_passo === decision.proximo_passo;
        if (fromDecision) {
          // O passo dele vem em primeiro: a frase fixa do core ("Próximo passo definido na decisão") vira rótulo e o passo é o texto.
          row.dataset.origem = "decisao";
          row.append(element("span", "falta-origem", "Passo definido pelo Criador"), element("span", "falta-texto", item.proximo_passo));
        } else {
          row.append(element("span", "falta-texto", item.texto || "Próximo passo"));
          if (typeof item.proximo_passo === "string" && item.proximo_passo) row.append(element("span", "falta-passo", "Próximo passo: " + item.proximo_passo));
        }
        list.append(row);
      });
      gaps.append(list);
    }
    target.append(gaps);
    renderDecision(target, asset);
  }
  function renderDecision(target, asset) {
    const section = element("section", "asset-detail-section decision-section");
    section.append(element("h3", "", "Decisão do Criador"));
    const decision = assetDecision(asset);
    if (decision) {
      const current = element("div", "decision-current");
      const headline = element("p", "decision-headline");
      const adjust = typeof decision.ajuste === "number" && Number.isFinite(decision.ajuste) ? decision.ajuste : 0;
      headline.append(destinoChip(asset), element("span", "", (adjust ? "ajuste " + signed(adjust) + " · " : "") + "por " + (decision.autor || "autor não informado") + (decision.em ? " em " + dateLabel(decision.em, true) : "")));
      current.append(headline);
      if (typeof decision.justificativa === "string" && decision.justificativa) current.append(element("p", "document-text", decision.justificativa));
      if (typeof decision.proximo_passo === "string" && decision.proximo_passo) current.append(element("p", "decision-step", "Próximo passo: " + decision.proximo_passo));
      section.append(current);
    } else section.append(element("p", "document-text", "Nenhuma decisão registrada: o destino deste ativo está a decidir."));
    if (host().readOnly === true) section.append(element("p", "form-help decision-note", "As decisões se registram na aba Finanças do AI Cask."));
    else if (!canDecide()) section.append(element("p", "form-help decision-note", "Só o Criador decide o destino."));
    else section.append(decisionForm(asset, decision));
    target.append(section);
  }
  function decisionForm(asset, decision) {
    const form = element("form", "decision-form"); form.id = "decision-form"; form.dataset.assetId = String(asset.id);
    form.append(element("p", "edit-explanation", "Escolha o destino, ajuste a nota se a régua documental não contar tudo e anote o porquê. A decisão fica registrada com o seu nome e a data; a história não se apaga."));
    const grid = element("div", "decision-grid");
    const destinoField = element("div", "field");
    const destinoLabel = element("label", "", "Destino"); destinoLabel.htmlFor = "decision-destino";
    const select = element("select"); select.id = "decision-destino";
    destinoOrder.forEach(key => { const option = element("option", "", destinoLabels[key]); option.value = key; select.append(option); });
    select.value = decision && destinoLabels[decision.destino] ? decision.destino : "decidir";
    destinoField.append(destinoLabel, select);
    const adjust = inputField("Ajuste da nota (−100 a 100)", "decision-ajuste", "number", decision && Number.isFinite(decision.ajuste) ? decision.ajuste : 0);
    adjust.input.min = "-100"; adjust.input.max = "100"; adjust.input.step = "1"; adjust.input.inputMode = "numeric"; adjust.input.required = true;
    const reason = inputField("Justificativa", "decision-justificativa", "text", decision && typeof decision.justificativa === "string" ? decision.justificativa : "");
    reason.input.maxLength = 500;
    const step = inputField("Próximo passo", "decision-proximo-passo", "text", decision && typeof decision.proximo_passo === "string" ? decision.proximo_passo : "");
    step.input.maxLength = 500;
    grid.append(destinoField, adjust.holder, reason.holder, step.holder);
    const error = element("p", "form-error"); error.id = "decision-error"; error.setAttribute("role", "alert"); error.hidden = true;
    const footer = element("div", "form-actions");
    const save = element("button", "button button-primary", "Guardar decisão"); save.type = "submit"; save.id = "decision-save";
    footer.append(save);
    form.append(grid, error, footer);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || mutationBusy) return;
      const value = Number(adjust.input.value);
      if (!Number.isInteger(value) || value < -100 || value > 100) {
        error.textContent = "O ajuste precisa ser um número inteiro entre −100 e 100."; error.hidden = false; adjust.input.focus(); return;
      }
      mutationBusy = true; save.disabled = true; error.hidden = true;
      try {
        await window.financeRequest("set_decision", {id: asset.id, destino: select.value, ajuste: value, justificativa: reason.input.value.trim(), proximo_passo: step.input.value.trim()});
        announce("Decisão guardada.");
        await loadSnapshot(true);
        message("asset-detail-message", "Decisão guardada com o seu nome e a data.");
      } catch (failure) {
        error.textContent = text(failure.message); error.hidden = false;
      } finally { mutationBusy = false; save.disabled = false; }
    });
    return form;
  }
  function countValue(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
  function assetName(asset) { return asset.name || asset.id || "Ativo sem nome"; }
  function pilotProposal(asset) {
    const value = asset && asset.release_proposal;
    if (!value || typeof value !== "object" || Array.isArray(value) || value.status !== "proposta") return null;
    return {
      priority: Number.isSafeInteger(value.priority) && value.priority > 0 ? value.priority : null,
      firstDelivery: typeof value.first_delivery === "string" ? value.first_delivery : "",
      reason: typeof value.reason === "string" ? value.reason : "",
      blockers: array(value.blockers).filter(item => typeof item === "string"),
      distribution: array(value.distribution).filter(item => typeof item === "string")
    };
  }
  function renderPilotProposal(asset) {
    const proposal = pilotProposal(asset);
    if (!proposal) return null;
    const section = element("section", "asset-detail-section pilot-proposal");
    section.append(element("h3", "", "Proposta de piloto"), element("p", "form-help", "Proposta editorial para avaliação. Não é uma decisão comercial aprovada nem uma estimativa de esforço, prazo ou preço."));
    if (proposal.priority !== null) section.append(element("p", "pilot-priority", "Ordem editorial sugerida: " + proposal.priority));
    section.append(element("h4", "", "Primeira entrega sugerida"), element("p", "document-text", proposal.firstDelivery || "Ainda não informada."));
    section.append(element("h4", "", "Por que avaliar este recorte"), element("p", "document-text", proposal.reason || "Fundamento ainda não informado."));
    if (proposal.blockers.length) {
      section.append(element("h4", "", "O que falta conferir"));
      const list = element("ul"); proposal.blockers.forEach(item => list.append(element("li", "", item))); section.append(list);
    }
    if (proposal.distribution.length) {
      section.append(element("h4", "", "Caminhos propostos"));
      const list = element("ul"); proposal.distribution.forEach(item => list.append(element("li", "", distributionLabels[item] || item))); section.append(list);
    }
    return section;
  }
  function comparisonAssets() {
    return array(atlasCurrent && atlasCurrent.assets).filter(asset => asset && comparisonIds.has(String(asset.id)));
  }
  function updateComparisonControls() {
    document.querySelectorAll("[data-compare-asset]").forEach(input => {
      input.checked = comparisonIds.has(input.dataset.compareAsset);
      input.disabled = !input.checked && comparisonIds.size >= 3;
    });
    const count = byId("atlas-comparison-selection");
    if (count) count.textContent = comparisonIds.size + " de 3 selecionados";
    const open = byId("atlas-compare-open");
    if (open) open.disabled = comparisonIds.size < 2;
    const clear = byId("atlas-compare-clear");
    if (clear) clear.disabled = comparisonIds.size === 0;
    const names = byId("atlas-comparison-names");
    if (names) names.textContent = comparisonAssets().map(assetName).join(" · ");
  }
  function comparisonPicker(asset) {
    const label = element("label", "check-label compare-picker");
    const input = element("input"); input.type = "checkbox"; input.dataset.compareAsset = String(asset.id);
    input.setAttribute("aria-label", "Comparar este ativo: " + text(assetName(asset)));
    input.addEventListener("change", () => {
      if (input.checked && comparisonIds.size < 3) comparisonIds.add(String(asset.id));
      else comparisonIds.delete(String(asset.id));
      updateComparisonControls();
    });
    label.append(input, element("span", "", "Comparar este ativo"));
    return label;
  }
  function closeComparison(restoreFocus = true) {
    if (comparisonDialog && comparisonDialog.open) comparisonDialog.close();
    comparisonSignature = null;
    if (restoreFocus) {
      const opener = byId("atlas-compare-open");
      const fallback = byId("inventory-title"); if (fallback) fallback.tabIndex = -1;
      const candidates = [comparisonReturnFocus, opener, fallback];
      for (const target of candidates) {
        if (!target || !target.isConnected || target.disabled || target === document.body) continue;
        target.focus({preventScroll: true});
        if (document.activeElement === target) break;
      }
    }
  }
  function renderComparison(open = false, opener = null) {
    const selected = comparisonAssets();
    if (selected.length < 2) {
      if (comparisonDialog && comparisonDialog.open) { closeComparison(); announce("A comparação foi fechada porque restaram menos de dois ativos disponíveis."); }
      return;
    }
    if (!comparisonDialog) {
      comparisonDialog = element("dialog", "asset-compare-dialog"); comparisonDialog.id = "atlas-comparison-dialog";
      comparisonDialog.setAttribute("aria-labelledby", "atlas-comparison-title");
      const heading = element("div", "asset-dialog-heading");
      const title = element("h2", "", "Comparar ativos"); title.id = "atlas-comparison-title"; title.tabIndex = -1;
      const close = button("×", "icon-button", () => closeComparison()); close.setAttribute("aria-label", "Fechar comparação");
      heading.append(title, close);
      const body = element("div"); body.id = "atlas-comparison-content";
      comparisonDialog.append(heading, body); document.body.append(comparisonDialog);
      comparisonDialog.addEventListener("cancel", event => { event.preventDefault(); closeComparison(); });
    }
    const signature = JSON.stringify(selected);
    if (signature !== comparisonSignature) {
      const oldTop = comparisonDialog.scrollTop;
      const oldRegion = comparisonDialog.querySelector(".comparison-table-scroll");
      const oldLeft = oldRegion ? oldRegion.scrollLeft : 0;
      const regionFocused = oldRegion && document.activeElement === oldRegion;
      const oldFocus = document.activeElement && document.activeElement.dataset.comparisonFocus;
      const target = byId("atlas-comparison-content"); clear(target);
      target.append(element("p", "section-intro", "Comparação documental. Proposta de piloto não é decisão comercial; dados ausentes não representam esforço, preço ou prontidão zero."));
      target.append(element("p", "comparison-table-hint", "A tabela continua para os lados. Use a rolagem horizontal para ler os outros ativos."));
      const scroll = element("div", "table-scroll comparison-table-scroll");
      scroll.tabIndex = 0; scroll.setAttribute("role", "region"); scroll.setAttribute("aria-label", "Tabela comparativa dos ativos; rolagem horizontal disponível");
      scroll.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End");
      scroll.addEventListener("keydown", event => {
        if (event.target !== scroll || event.altKey || event.ctrlKey || event.metaKey) return;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const maximum = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
        if (maximum === 0) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? maximum : scroll.scrollLeft + (event.key === "ArrowRight" ? 80 : -80);
        scroll.scrollLeft = Math.max(0, Math.min(maximum, next));
      });
      const table = element("table", "comparison-table");
      const caption = element("caption", "sr-only", "Fatos registrados dos ativos selecionados");
      const head = element("thead"); const headings = element("tr"); headings.append(element("th", "", "Informação"));
      selected.forEach(asset => { const th = element("th", "", assetName(asset)); th.scope = "col"; headings.append(th); }); head.append(headings);
      const body = element("tbody");
      const fact = (asset, path, fallback = "Não informado.") => {
        let value = asset; for (const key of path) value = value && typeof value === "object" ? value[key] : null;
        return typeof value === "string" && value.trim() ? value : fallback;
      };
      const rows = [
        ["Para que serve", asset => fact(asset, ["summary"])],
        ["Estado documentado", asset => fact(asset, ["documented_state"])],
        ["Recorte mínimo sugerido", asset => fact(asset, ["dossier", "minimum_deliverable"])],
        ["O que foi testado", asset => fact(asset, ["dossier", "validation", "summary"], "Validação não informada nesta ficha.")],
        ["Autoria e licença", asset => fact(asset, ["dossier", "license", "text"], "Autoria/licença ainda não informadas.")],
        ["Lacunas registradas", asset => array(asset.gaps).map(gap => typeof gap === "string" ? gap : gap && typeof gap.text === "string" ? gap.text : "").filter(Boolean)],
        ["Caminhos documentados", asset => array(asset.distribution).filter(item => typeof item === "string").map(item => distributionLabels[item] || item)],
        ["Proposta de piloto", asset => { const proposal = pilotProposal(asset); return proposal ? [proposal.priority === null ? "Ordem editorial não informada." : "Ordem editorial sugerida: " + proposal.priority, proposal.firstDelivery || "Entrega não informada.", proposal.reason || "Fundamento não informado.", ...proposal.blockers] : "Nenhuma proposta registrada."; }]
      ];
      rows.forEach(([label, read]) => {
        const tr = element("tr"); const th = element("th", "", label); th.scope = "row"; tr.append(th);
        selected.forEach(asset => {
          const td = element("td"); const value = read(asset);
          if (Array.isArray(value) && value.length) { const list = element("ul"); value.forEach(item => list.append(element("li", "", item))); td.append(list); }
          else td.append(element("p", "", typeof value === "string" ? value : "Não informado."));
          tr.append(td);
        });
        body.append(tr);
      });
      const actions = element("tr"); const actionHeading = element("th", "", "Fontes e detalhes"); actionHeading.scope = "row"; actions.append(actionHeading);
      selected.forEach(asset => {
        const td = element("td"); const control = button("Abrir ficha completa", "button-outline", event => { closeComparison(false); renderAssetDetail(asset.id, true, event.currentTarget); });
        control.setAttribute("aria-label", "Abrir ficha completa de " + text(assetName(asset)));
        control.dataset.comparisonFocus = String(asset.id); td.append(control); actions.append(td);
      }); body.append(actions);
      table.append(caption, head, body); scroll.append(table); target.append(scroll); comparisonSignature = signature;
      if (!open) {
        const focus = [...target.querySelectorAll("[data-comparison-focus]")].find(node => node.dataset.comparisonFocus === oldFocus);
        if (regionFocused) scroll.focus({preventScroll: true});
        else if (focus) focus.focus({preventScroll: true});
        else if (!comparisonDialog.contains(document.activeElement)) byId("atlas-comparison-title").focus({preventScroll: true});
        scroll.scrollLeft = oldLeft;
        comparisonDialog.scrollTop = oldTop;
      }
    }
    if (open) {
      comparisonReturnFocus = opener || byId("atlas-compare-open"); revealHeader();
      if (!comparisonDialog.open) comparisonDialog.showModal();
      comparisonDialog.scrollTop = 0; byId("atlas-comparison-title").focus({preventScroll: true});
    }
  }
  function reconcileComparison() {
    const available = new Set(array(atlasCurrent && atlasCurrent.assets).filter(Boolean).map(asset => String(asset.id)));
    let removed = false;
    comparisonIds.forEach(id => { if (!available.has(id)) { comparisonIds.delete(id); removed = true; } });
    if (removed) announce("A seleção foi atualizada porque um ativo não está mais disponível.");
    updateComparisonControls();
    if (comparisonDialog && comparisonDialog.open) renderComparison();
  }
  function displayMetric(value) {
    if (value === null || value === undefined || value === "") return "Não informado";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  }

  function sourceReference(ref) {
    const row = element("div", "source-ref");
    const path = String(ref.url || ref.label || ref.path || "Fonte não informada");
    const pathname = element("p", "source-ref-path");
    let target;
    try { target = new URL(path); } catch (_) { target = null; }
    const isNative = Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.finance);
    if (!isNative && target && target.protocol === "https:" && target.hostname === "github.com" && !target.username && !target.password) {
      const link = element("a", "", path); link.href = target.href; link.target = "_blank"; link.rel = "noopener noreferrer"; pathname.append(link);
    } else pathname.textContent = text(path);
    row.append(pathname);
    const descriptions = [];
    if (ref.kind) descriptions.push(text(ref.kind));
    if (ref.line !== null && ref.line !== undefined) descriptions.push("linha " + text(ref.line));
    if (ref.date || ref.updated_at) descriptions.push(dateLabel(ref.date || ref.updated_at));
    if (descriptions.length) row.append(element("p", "", descriptions.join(" · ")));
    const revisionLabel = ref.source_revision || ref.revision;
    if (revisionLabel) row.append(element("p", "", "Revisão: " + text(revisionLabel)));
    row.append(button("Copiar referência", "button-quiet", async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error();
        await navigator.clipboard.writeText(path + (ref.line ? ":" + ref.line : ""));
        message("asset-detail-message", "Referência copiada.");
      } catch (_) { message("asset-detail-message", "Não foi possível copiar. A referência completa está visível acima."); }
    }));
    return row;
  }

  function pagedDetailItems(target, items, scope, label, renderItem, pageSize = 12) {
    const group = element("div", "detail-paged-list"); group.dataset.detailList = scope;
    const body = element("div", "detail-page-items");
    if (items.length <= pageSize) {
      items.forEach((item, index) => body.append(renderItem(item, index)));
      group.append(body); target.append(group); return;
    }
    const key = String(atlasSelectedId) + ":" + scope;
    const pages = Math.ceil(items.length / pageSize);
    let page = Math.max(0, Math.min(detailListPages.get(key) || 0, pages - 1));
    const controls = element("nav", "detail-pagination"); controls.setAttribute("aria-label", "Páginas de " + label);
    const count = element("p"); count.tabIndex = -1; count.setAttribute("role", "status");
    const previous = button("← Anteriores", "button-outline", () => { page -= 1; draw(true); });
    const next = button("Próximos →", "button-outline", () => { page += 1; draw(true); });
    function draw(focus = false) {
      detailListPages.set(key, page); body.replaceChildren();
      const offset = page * pageSize;
      items.slice(offset, offset + pageSize).forEach((item, index) => body.append(renderItem(item, offset + index)));
      count.textContent = "Mostrando " + (offset + 1) + "–" + Math.min(offset + pageSize, items.length) + " de " + items.length + " · " + label;
      previous.disabled = page === 0; next.disabled = page === pages - 1;
      if (focus) count.focus({preventScroll: true});
    }
    controls.append(previous, count, next); group.append(controls, body); target.append(group); draw();
  }

  function renderDossier(target, dossier) {
    if (!dossier || typeof dossier !== "object" || Array.isArray(dossier)) return;
    const section = (title) => {
      const node = element("section", "asset-detail-section");
      node.append(element("h3", "", title));
      target.append(node);
      return node;
    };
    const evidence = (node, refs, scope) => {
      const sources = array(refs).filter(hasSourceLocator);
      if (!sources.length) return;
      const details = element("details");
      details.dataset.detailDisclosure = scope;
      details.append(element("summary", "", "Conferir fontes desta observação"));
      pagedDetailItems(details, sources, scope, "fontes desta observação", sourceReference, 6);
      node.append(details);
    };
    if (typeof dossier.scope === "string" && dossier.scope) {
      section("Alcance desta revisão").append(element("p", "document-text", dossier.scope));
    }
    if (array(dossier.capabilities).length) {
      const node = section(dossier.group === "triagem automatizada" ? "O que a documentação descreve" : "Capacidades observadas");
      const capabilities = dossier.capabilities.filter(item => typeof item === "string" || (item && typeof item.text === "string"));
      pagedDetailItems(node, capabilities, "capabilities", "capacidades documentadas", (item, index) => {
        const row = element("div", "source-ref");
        row.append(element("p", "document-text", typeof item === "string" ? item : item.text));
        if (item && typeof item === "object") evidence(row, item.evidence, "capability-sources-" + index);
        return row;
      });
    }
    if (typeof dossier.minimum_deliverable === "string" && dossier.minimum_deliverable) {
      const node = section("Primeiro recorte para um piloto");
      node.append(element("p", "document-text", dossier.minimum_deliverable), element("p", "form-help", "Escopo sugerido para avaliação. Ainda não é uma oferta aprovada."));
    }
    if (array(dossier.routes).length) {
      const node = section("Caminhos a avaliar");
      dossier.routes.filter(route => route && typeof route === "object").forEach(route => {
        const row = element("div", "source-ref");
        const routeName = typeof route.route === "string" ? route.route : "Proposta";
        row.append(element("h4", "", distributionLabels[routeName] || routeName));
        if (typeof route.why === "string") row.append(element("p", "document-text", route.why));
        if (array(route.gates).length) {
          const list = element("ul");
          route.gates.filter(gate => typeof gate === "string").forEach(gate => list.append(element("li", "", gate)));
          row.append(list);
        }
        node.append(row);
      });
      node.append(element("p", "form-help", "São propostas de aproveitamento. Publicação, oferta e preço dependem de decisão registrada."));
    }
    if (array(dossier.dependencies).length) {
      const node = section("Requisitos para uso e distribuição");
      const list = element("ul");
      dossier.dependencies.filter(item => typeof item === "string").forEach(item => list.append(element("li", "", item)));
      node.append(list);
    }
    if (dossier.license && typeof dossier.license.text === "string" && dossier.license.text) {
      const node = section("Autoria e licença");
      node.append(element("p", "document-text", dossier.license.text));
      evidence(node, dossier.license.evidence, "license-sources");
    }
    if (dossier.validation && typeof dossier.validation.summary === "string" && dossier.validation.summary) {
      const node = section("O que foi testado");
      node.append(element("p", "document-text", dossier.validation.summary));
      evidence(node, dossier.validation.evidence, "validation-sources");
    }
  }

  function renderAssetDetail(identifier, rememberFocus = true, opener = null) {
    const asset = atlasCurrent && array(atlasCurrent.assets).find((item) => item.id === identifier);
    if (!asset) {
      if (byId("asset-dialog").open && atlasSelectedId === identifier) {
        closeAssetDetail();
        announce("A ficha não está mais no catálogo atualizado.");
      }
      return false;
    }
    const relatedState = array(asset.relations).filter(relation => relation && typeof relation === "object").map(relation => {
      const target = relation.target || relation.target_id;
      const related = array(atlasCurrent.assets).find(item => item.id === target);
      return [target, related ? assetName(related) : null];
    });
    const signature = JSON.stringify([asset, relatedState]);
    if (!rememberFocus && byId("asset-dialog").open && atlasSelectedId === identifier && atlasRenderedDetail && atlasRenderedDetail.signature === signature) return true;
    const preserve = !rememberFocus && byId("asset-dialog").open && atlasSelectedId === identifier;
    const previousTop = preserve ? byId("asset-dialog").scrollTop : 0;
    const expanded = preserve ? new Set([...byId("asset-detail-content").querySelectorAll("details[open][data-detail-disclosure]")].map(node => node.dataset.detailDisclosure)) : new Set();
    const focused = preserve && byId("asset-detail-content").contains(document.activeElement) ? document.activeElement : null;
    const focusedPath = focused && focused.closest("[data-detail-list]");
    const focusScope = focusedPath && focusedPath.dataset.detailList;
    const focusIndex = focusedPath ? [...focusedPath.querySelectorAll("button,summary,[tabindex]")].indexOf(focused) : -1;
    if (rememberFocus && !byId("asset-dialog").open) {
      const card = [...document.querySelectorAll(".asset-card")].find(node => node.dataset.assetId === String(identifier));
      atlasReturnFocus = opener || (card && card.querySelector("[data-open-asset]"));
      atlasReturnAssetId = identifier;
    }
    atlasSelectedId = identifier;
    byId("asset-detail-title").textContent = text(assetName(asset));
    byId("asset-detail-kind").textContent = text((kindLabels[asset.kind] || asset.kind || "Ativo") + " · " + (asset.category || "Categoria não informada"));
    const target = byId("asset-detail-content"); clear(target);
    message("asset-detail-message", "");
    target.append(element("p", "asset-detail-summary", asset.summary || "Descrição ainda não entregue."));
    const distributions = element("div", "asset-chips");
    array(asset.distribution).forEach((item) => distributions.append(element("span", "asset-chip", distributionLabels[item] || item)));
    target.append(distributions, decisionRow(asset));
    renderReadiness(target, asset);
    const state = element("section", "asset-detail-section");
    state.append(element("h3", "", "O que a fonte permite afirmar"), element("p", "document-text", asset.documented_state || "Estado documental não informado."));
    state.append(element("p", "form-help", "Documentação, funcionamento testado e avaliação comercial são verificações diferentes."));
    target.append(state);
    const proposal = renderPilotProposal(asset);
    if (proposal) target.append(proposal);
    renderDossier(target, asset.dossier);
    const metrics = asset.metrics || {};
    const metricsSection = element("section", "asset-detail-section");
    metricsSection.append(element("h3", "", "Evidências do levantamento"));
    if (countValue(metrics.routes_declared) && metrics.routes_declared > 0 && countValue(metrics.routes_present)) {
      const coverage = element("div", "route-evidence");
      const coverageLabel = metrics.route_coverage_label || "Arquivos das rotas presentes";
      const caption = element("p"); caption.append(element("strong", "", coverageLabel + ": " + metrics.routes_present + " de " + metrics.routes_declared));
      const bar = element("progress", "budget-progress"); bar.max = metrics.routes_declared; bar.value = Math.min(metrics.routes_present, metrics.routes_declared);
      bar.setAttribute("aria-label", coverageLabel); bar.setAttribute("aria-valuetext", metrics.routes_present + " de " + metrics.routes_declared);
      coverage.append(caption, bar, element("p", "", "Artefatos ou ligações identificados não comprovam conteúdo completo, funcionamento ou validação clínica."));
      if (metrics.routes_present > metrics.routes_declared) coverage.append(element("p", "", "Contagens divergentes: conferir o escopo declarado."));
      metricsSection.append(coverage);
    }
    const curriculum = countValue(metrics.curriculum_total) ? "Escopo curricular declarado: " + metrics.curriculum_total + "." : "Escopo curricular ainda não definido.";
    metricsSection.append(element("p", "form-help", curriculum + (countValue(metrics.validated_topics) ? " Temas com validação registrada: " + metrics.validated_topics + "." : " Validação temática não informada.")));
    const labels = {source_files: "Arquivos de fonte", files_observed: "Arquivos observados", documents_read: "Documentos lidos", documents_pending: "Documentos pendentes", github_files: "Arquivos no GitHub", github_documents_read: "Documentos GitHub lidos", tree_available: "Árvore disponível", tree_truncated: "Árvore truncada", private_repository: "Repositório privado", fork: "Fork", archived: "Arquivado", license: "Licença registrada", review_depth: "Profundidade da revisão", page_files_observed: "Arquivos de página observados", module_entries_observed: "Entradas de módulos observadas", declared_units: "Unidades identificadas", unit_label: "Critério das unidades"};
    const list = element("dl", "asset-metrics");
    Object.entries(metrics).filter(([key]) => !["routes_declared", "routes_present", "route_coverage_label", "curriculum_total", "validated_topics"].includes(key) && !/(^|_)(cpf|senha|password|hash)(_|$)/.test(normalized(key))).forEach(([key, value]) => {
      const entry = element("div"); entry.append(element("dt", "", labels[key] || key.replace(/_/g, " ")), element("dd", "", displayMetric(value))); list.append(entry);
    });
    if (list.childElementCount) metricsSection.append(list);
    target.append(metricsSection);
    const topics = element("section", "asset-detail-section"); topics.append(element("h3", "", "Temas identificados"));
    if (!array(asset.topics).length) topics.append(element("p", "document-text", "Nenhum tema foi registrado nesta ficha."));
    pagedDetailItems(topics, array(asset.topics).filter(topic => typeof topic === "string" || (topic && typeof topic === "object")), "topics", "temas identificados", (topic, index) => {
      const item = element("div");
      const row = element("div", "topic-row"); row.append(element("span", "", typeof topic === "string" ? topic : topic.name || topic.title || "Tema"), element("span", "", typeof topic === "string" ? "Estado não informado" : topic.status || "Estado não informado")); item.append(row);
      if (topic && typeof topic === "object" && array(topic.source_refs).length) {
        const details = element("details");
        details.dataset.detailDisclosure = "topic-sources-" + index;
        details.append(element("summary", "", "Fontes deste item"));
        pagedDetailItems(details, topic.source_refs.filter(hasSourceLocator), "topic-sources-" + index, "fontes do tema", sourceReference, 6);
        item.append(details);
      }
      return item;
    });
    target.append(topics);
    const gaps = element("section", "asset-detail-section"); gaps.append(element("h3", "", "Lacunas e próximos cuidados"));
    if (!array(asset.gaps).length) gaps.append(element("p", "document-text", "Lacunas não registradas. Isso não equivale a validação completa."));
    else { const list = element("ul"); asset.gaps.filter(gap => gap != null).forEach((gap) => list.append(element("li", "", typeof gap === "string" ? gap : gap.text || JSON.stringify(gap)))); gaps.append(list); }
    target.append(gaps);
    const relations = element("section", "asset-detail-section"); relations.append(element("h3", "", "Relações com outros ativos"));
    if (!array(asset.relations).length) relations.append(element("p", "document-text", "Nenhuma relação registrada nesta ficha."));
    array(asset.relations).filter(relation => relation && typeof relation === "object").forEach((relation) => {
      const related = array(atlasCurrent.assets).find((item) => item.id === (relation.target || relation.target_id));
      const control = button(related ? assetName(related) : "Ativo relacionado não localizado", "relation-button", () => renderAssetDetail(related.id, false));
      control.append(element("small", "", (relation.type || "Relação") + (relation.note ? " · " + relation.note : "")));
      control.disabled = !related; relations.append(control);
    });
    target.append(relations);
    const sources = element("section", "asset-detail-section"); sources.append(element("h3", "", "Fontes e revisões"));
    if (!array(asset.source_refs).length) sources.append(element("p", "document-text", "Referência ainda não informada."));
    pagedDetailItems(sources, array(asset.source_refs).filter(hasSourceLocator), "sources", "fontes e revisões", sourceReference);
    target.append(sources);
    atlasRenderedDetail = {id: identifier, signature};
    revealHeader();
    if (!byId("asset-dialog").open) byId("asset-dialog").showModal();
    target.querySelectorAll("details[data-detail-disclosure]").forEach(node => { node.open = expanded.has(node.dataset.detailDisclosure); });
    if (preserve) {
      const group = [...target.querySelectorAll("[data-detail-list]")].find(node => node.dataset.detailList === focusScope);
      const replacement = group && group.querySelectorAll("button,summary,[tabindex]")[focusIndex];
      if (replacement) replacement.focus({preventScroll: true});
      else if (focused) byId("asset-detail-title").focus({preventScroll: true});
    } else byId("asset-detail-title").focus({preventScroll: true});
    byId("asset-dialog").scrollTop = previousTop;
    return true;
  }

  function closeAssetDetail() {
    if (byId("asset-dialog").open) byId("asset-dialog").close();
    atlasSelectedId = null;
    atlasRenderedDetail = null;
    const fallback = byId("inventory-title"); fallback.tabIndex = -1;
    const currentCard = [...document.querySelectorAll(".asset-card")].find(card => card.dataset.assetId === String(atlasReturnAssetId));
    const currentOpener = currentCard && currentCard.querySelector("[data-open-asset]");
    for (const target of [atlasReturnFocus, currentOpener, fallback]) {
      if (!target || !target.isConnected || target.disabled || target === document.body) continue;
      target.focus({preventScroll: true});
      if (document.activeElement === target) break;
    }
    atlasReturnFocus = null;
    atlasReturnAssetId = null;
  }

  function renderAtlasCoverage(target, block) {
    clear(target);
    const coverage = block.coverage || {};
    const intro = element("div", "atlas-coverage-heading");
    intro.append(element("h3", "", "Cobertura do levantamento"), element("p", "", coverage.coverage_note || "O catálogo registra o que foi encontrado e conferido. Contagem de ativos não representa validação técnica ou comercial."));
    target.append(intro);
    const coverageGrid = element("div", "atlas-coverage");
    const depthKey = Object.prototype.hasOwnProperty.call(coverage, "deep_dossiers_written") ? "deep_dossiers_written" : "deep_source_reviews";
    [["assets_catalogued", "Itens mapeados"], [depthKey, "Fichas aprofundadas"], ["automatic_triage_dossiers", "Triagens automáticas · aprofundamento pendente"], ["metadata_only_private_dossiers", "Acervos privados · somente metadados"], ["inventory_only_dossiers", "Inventários sem produto qualificado"], ["unavailable_dossiers", "Fontes indisponíveis para revisão"], ["local_files_observed", "Ocorrências locais de arquivos"], ["github_owned", "Repositórios próprios"], ["github_unavailable", "Fontes GitHub indisponíveis"], ["local_documents_read", "Documentos com leitura registrada"], ["automatic_document_reads", "Documentos com leitura automatizada neste lote"], ["local_documents_not_read", "Documentos locais ainda não lidos"]].forEach(([key, label]) => {
      if (!Object.prototype.hasOwnProperty.call(coverage, key)) return;
      const tile = element("div", "coverage-tile");
      tile.append(element("strong", "", countValue(coverage[key]) ? new Intl.NumberFormat("pt-BR").format(coverage[key]) : "Não informado"), element("span", "", label)); coverageGrid.append(tile);
    });
    target.append(coverageGrid);
    const caution = [coverage.runtime_validation, coverage.commercial_validation].filter(Boolean).join(" · ");
    if (caution) target.append(element("p", "portfolio-note", caution));
  }

  function renderAtlas(block) {
    atlasCurrent = block;
    const signature = JSON.stringify(block);
    if (atlasView && atlasSignature === signature) return;
    reconcileComparison();
    if (atlasView) { atlasView.update(block); atlasSignature = signature; return; }
    const target = byId("inventory-content"); clear(target);
    renderSource(byId("inventory-source"), block.source);
    let assets = array(block.assets);
    const coverage = element("div", "atlas-coverage-group"); renderAtlasCoverage(coverage, block); target.append(coverage);
    const tabs = element("div", "atlas-tabs"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Visões do Atlas");
    const tabNames = [["all", "Todos"], ["education", "Ensino"], ["components", "Skills e componentes"], ["free", "Candidatos gratuitos"], ["relations", "Relações"]];
    const filters = element("div", "atlas-filters");
    const search = inputField("Buscar no Atlas", "atlas-query", "search", atlasFilter.query); search.input.placeholder = "Nome, tema ou descrição"; filters.append(search.holder);
    const selectors = {};
    const selectorConfigs = [];
    [["category", "Categoria", "atlas-category", (asset) => [asset.category].filter(Boolean), (value) => value], ["kind", "Tipo", "atlas-kind", (asset) => [asset.kind].filter(Boolean), (value) => kindLabels[value] || value], ["distribution", "Distribuição", "atlas-distribution", (asset) => array(asset.distribution), (value) => distributionLabels[value] || value], ["destino", "Destino", "atlas-destino", (asset) => [assetDestino(asset)], (value) => destinoLabels[value] || value]].forEach(([key, label, id, valuesFor, labelFor]) => {
      const holder = element("div", "field"); const caption = element("label", "", label); caption.htmlFor = id;
      const select = element("select"); select.id = id;
      const all = element("option", "", key === "category" ? "Todas as categorias" : key === "kind" ? "Todos os tipos" : key === "distribution" ? "Todas as distribuições" : "Todos os destinos"); all.value = ""; select.append(all);
      const values = [...new Set(assets.flatMap(valuesFor))].sort((a,b) => String(a).localeCompare(String(b), "pt-BR"));
      if (!values.includes(atlasFilter[key])) atlasFilter[key] = "";
      values.forEach((value) => { const option = element("option", "", labelFor(value)); option.value = value; select.append(option); });
      select.value = atlasFilter[key]; selectors[key] = select; holder.append(caption, select); filters.append(holder);
      selectorConfigs.push({key, select, valuesFor, labelFor, allLabel: all.textContent, values: JSON.stringify(values)});
    });
    const review = element("div", "atlas-review-toolbar");
    const order = inputField("Ordenar o catálogo", "atlas-order", "text", "");
    const sort = element("select"); sort.id = "atlas-order";
    [["name", "Nome"], ["readiness", "Prontidão (maior primeiro)"], ["proposal", "Ordem editorial proposta para pilotos"]].forEach(([value,label]) => { const option = element("option", "", label); option.value = value; sort.append(option); });
    sort.value = atlasOrder; order.holder.replaceChild(sort, order.input);
    const sortingNote = element("p", "form-help", "A prontidão é uma nota documental; a ordem editorial é uma proposta. Nenhuma mede esforço, prazo, preço ou mercado.");
    order.holder.append(sortingNote); review.append(order.holder);
    const selection = element("div", "atlas-comparison-controls"); const selectionCount = element("p"); selectionCount.id = "atlas-comparison-selection"; selectionCount.setAttribute("role", "status");
    const selectionNames = element("p", "form-help"); selectionNames.id = "atlas-comparison-names";
    const compare = button("Comparar selecionados", "button-outline", event => renderComparison(true, event.currentTarget)); compare.id = "atlas-compare-open";
    const clearSelection = button("Limpar seleção", "button-quiet", () => { comparisonIds.clear(); updateComparisonControls(); }); clearSelection.id = "atlas-compare-clear";
    selection.append(selectionCount, compare, clearSelection, selectionNames); review.append(selection);
    const results = element("div"); results.id = "atlas-results"; results.setAttribute("role", "tabpanel");
    const summary = element("div", "atlas-results-heading");
    const count = element("p"); count.id = "atlas-results-count"; count.tabIndex = -1; count.setAttribute("role", "status");
    const pageCount = element("p"); summary.append(count, pageCount);
    const cards = element("div", "atlas-cards"); cards.id = "atlas-cards";
    const pagination = element("nav", "asset-pagination"); pagination.setAttribute("aria-label", "Páginas do catálogo");
    const previous = button("← Anteriores", "button-outline", () => { atlasFilter.page -= 1; draw(true); });
    const next = button("Próximos →", "button-outline", () => { atlasFilter.page += 1; draw(true); });
    const number = element("p"); pagination.append(previous, number, next);
    const buildIndex = () => assets.map((asset) => ({asset, search: normalized([asset.name, asset.summary, asset.category, asset.kind, ...array(asset.topics).filter(topic => topic != null).map((topic) => typeof topic === "string" ? topic : topic.name || topic.title)].filter(Boolean).join(" "))}));
    let indexed = buildIndex();
    function draw(focus = false) {
      const query = normalized(atlasFilter.query);
      const selected = indexed.filter(({asset, search}) => {
        if (query && !search.includes(query)) return false;
        if (atlasFilter.category && asset.category !== atlasFilter.category) return false;
        if (atlasFilter.kind && asset.kind !== atlasFilter.kind) return false;
        if (atlasFilter.distribution && !array(asset.distribution).includes(atlasFilter.distribution)) return false;
        if (atlasFilter.destino && assetDestino(asset) !== atlasFilter.destino) return false;
        if (atlasFilter.tab === "education" && asset.kind !== "platform" && !normalized(asset.category).includes("ensino") && !array(asset.topics).length) return false;
        if (atlasFilter.tab === "components" && !["skill", "component"].includes(asset.kind) && !normalized(asset.category).includes("componente")) return false;
        if (atlasFilter.tab === "free" && !array(asset.distribution).includes("free_candidate") && !normalized(asset.category).includes("gratuit")) return false;
        if (atlasFilter.tab === "relations" && !array(asset.relations).length) return false;
        return true;
      }).map(({asset}) => asset).sort((a,b) => {
        if (atlasOrder === "readiness") {
          const left = readinessFinal(a.readiness), right = readinessFinal(b.readiness);
          if (left !== right) { if (left === null) return 1; if (right === null) return -1; return right - left; }
        }
        if (atlasOrder === "proposal") {
          const left = pilotProposal(a), right = pilotProposal(b);
          const rank = (left && left.priority !== null ? left.priority : Infinity) - (right && right.priority !== null ? right.priority : Infinity);
          if (Number.isFinite(rank) && rank !== 0) return rank;
          if (left && left.priority !== null && (!right || right.priority === null)) return -1;
          if (right && right.priority !== null && (!left || left.priority === null)) return 1;
        }
        return String(assetName(a)).localeCompare(String(assetName(b)), "pt-BR", {numeric:true});
      });
      const pages = Math.max(1, Math.ceil(selected.length / atlasPageSize)); atlasFilter.page = Math.max(1, Math.min(atlasFilter.page, pages));
      const offset = (atlasFilter.page - 1) * atlasPageSize, visible = selected.slice(offset, offset + atlasPageSize);
      count.textContent = selected.length + (selected.length === 1 ? " item mapeado" : " itens mapeados");
      pageCount.textContent = visible.length ? "Mostrando " + (offset + 1) + "–" + (offset + visible.length) + " de " + selected.length : "Nenhum ativo corresponde ao filtro";
      number.textContent = "Página " + atlasFilter.page + " de " + pages; previous.disabled = atlasFilter.page === 1; next.disabled = atlasFilter.page === pages;
      cards.replaceChildren();
      visible.forEach((asset) => {
        const card = element("article", "asset-card"); card.dataset.assetId = String(asset.id);
        card.append(element("p", "asset-category", (kindLabels[asset.kind] || asset.kind || "Ativo") + " · " + (asset.category || "Sem categoria")), element("h3", "", assetName(asset)), element("p", "asset-summary", asset.summary || "Descrição pendente."), element("p", "asset-state", asset.documented_state || "Estado documental não informado."));
        const chips = element("div", "asset-chips"); array(asset.distribution).forEach((item) => chips.append(element("span", "asset-chip", distributionLabels[item] || item))); card.append(chips);
        card.append(decisionRow(asset));
        const proposal = pilotProposal(asset);
        if (proposal) card.append(element("p", "pilot-card-note", "Proposta de piloto" + (proposal.priority !== null ? " · ordem editorial " + proposal.priority : "")));
        card.append(comparisonPicker(asset));
        const open = button("Abrir ficha completa", "button-outline", event => renderAssetDetail(asset.id, true, event.currentTarget)); open.dataset.openAsset = String(asset.id); open.setAttribute("aria-label", "Abrir ficha de " + text(assetName(asset))); card.append(open); cards.append(card);
      });
      if (!visible.length) empty(cards, "Nenhum ativo corresponde aos filtros. Ajuste a busca ou escolha outra visão.");
      tabs.querySelectorAll("button").forEach((tab) => { const selected = tab.dataset.atlasTab === atlasFilter.tab; tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1; });
      results.setAttribute("aria-labelledby", "atlas-tab-" + atlasFilter.tab);
      if (focus) count.focus();
      updateComparisonControls();
    }
    tabNames.forEach(([key,label]) => {
      const tab = button(label, "", () => { atlasFilter.tab = key; atlasFilter.page = 1; draw(); }); tab.id = "atlas-tab-" + key; tab.dataset.atlasTab = key; tab.setAttribute("role", "tab"); tab.setAttribute("aria-controls", results.id);
      tab.addEventListener("keydown", (event) => {
        const keys = ["ArrowLeft", "ArrowRight", "Home", "End"]; if (!keys.includes(event.key)) return; event.preventDefault();
        const current = tabNames.findIndex(([name]) => name === atlasFilter.tab); const next = event.key === "Home" ? 0 : event.key === "End" ? tabNames.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabNames.length) % tabNames.length;
        const key = tabNames[next][0]; atlasFilter.tab = key; atlasFilter.page = 1; draw(); byId("atlas-tab-" + key).focus();
      });
      tabs.append(tab);
    });
    search.input.addEventListener("input", () => { atlasFilter.query = search.input.value; atlasFilter.page = 1; draw(); });
    Object.entries(selectors).forEach(([key, select]) => select.addEventListener("change", () => { atlasFilter[key] = select.value; atlasFilter.page = 1; draw(); }));
    sort.addEventListener("change", () => { atlasOrder = sort.value; atlasFilter.page = 1; draw(); });
    results.append(summary, cards, pagination); target.append(tabs, filters, review, results); draw();
    if (byId("asset-dialog").open && atlasSelectedId) renderAssetDetail(atlasSelectedId, false);
    atlasView = {update(next) {
      assets = array(next.assets); indexed = buildIndex();
      renderSource(byId("inventory-source"), next.source);
      renderAtlasCoverage(coverage, next);
      selectorConfigs.forEach(config => {
        const values = [...new Set(assets.flatMap(config.valuesFor))].sort((a,b) => String(a).localeCompare(String(b), "pt-BR"));
        const encoded = JSON.stringify(values);
        if (encoded === config.values) return;
        config.values = encoded;
        if (!values.includes(atlasFilter[config.key])) atlasFilter[config.key] = "";
        config.select.replaceChildren();
        const all = element("option", "", config.allLabel); all.value = ""; config.select.append(all);
        values.forEach(value => { const option = element("option", "", config.labelFor(value)); option.value = value; config.select.append(option); });
        config.select.value = atlasFilter[config.key];
      });
      draw();
      if (byId("asset-dialog").open && atlasSelectedId) renderAssetDetail(atlasSelectedId, false);
    }};
    atlasSignature = signature;
  }

  function renderInventory(block, atlas) {
    if (atlas && array(atlas.assets).length) { renderAtlas(atlas); return; }
    if (byId("asset-dialog").open) {
      closeAssetDetail();
      announce("A ficha não está mais no catálogo atualizado.");
    }
    atlasCurrent = null;
    atlasView = null; atlasSignature = null;
    reconcileComparison();
    renderSource(byId("inventory-source"), block.source);
    const target = byId("inventory-content");
    clear(target);
    if (!array(block.rows).length) { empty(target); return; }
    const columns = publicColumns(block.columns, block.rows);
    const barrierColumn = columnMatching(columns, /barreira/);
    const readiness = columnMatching(columns, /prontidao/);
    const distance = columnMatching(columns, /distancia/);
    const toolbar = element("div", "inventory-toolbar");
    const count = element("p", "inventory-count");
    const filters = element("div", "inventory-filters");
    const searchField = inputField("Buscar no portfólio", "inventory-search", "search", inventorySearch);
    searchField.holder.classList.add("inventory-search");
    searchField.input.placeholder = "Produto, finalidade ou fonte";
    filters.append(searchField.holder);
    const sort = element("select");
    sort.id = "inventory-sort";
    [["ready-desc", "Mais prontos primeiro"], ["ready-asc", "Menos prontos primeiro"], ["distance-asc", "Menor distância do dinheiro"], ["distance-desc", "Maior distância do dinheiro"]].forEach(([value, label]) => {
      const option = element("option", "", label); option.value = value; sort.append(option);
    });
    sort.value = inventorySort;
    const sortField = element("div", "field");
    const sortLabel = element("label", "", "Ordenar por"); sortLabel.htmlFor = sort.id;
    sortField.append(sortLabel, sort);
    const filter = element("select");
    filter.id = "inventory-barrier";
    const all = element("option", "", "Todas as barreiras"); all.value = ""; filter.append(all);
    const barriers = [...new Set(block.rows.map((row) => barrierColumn ? String(row[barrierColumn] || "") : "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (!barriers.includes(inventoryBarrier)) inventoryBarrier = "";
    barriers.forEach((value) => { const option = element("option", "", value); option.value = value; filter.append(option); });
    filter.value = inventoryBarrier;
    filter.disabled = !barrierColumn;
    const filterField = element("div", "field");
    const filterLabel = element("label", "", "Filtrar por barreira"); filterLabel.htmlFor = filter.id;
    filterField.append(filterLabel, filter);
    filters.append(sortField, filterField);
    toolbar.append(count, filters);
    const results = element("div");
    function update() {
      const query = normalized(inventorySearch);
      const chosen = array(block.rows).filter((row) => (!inventoryBarrier || row[barrierColumn] === inventoryBarrier) && (!query || normalized(Object.values(row).join(" ")).includes(query)));
      const sortColumn = inventorySort.startsWith("distance") ? distance : readiness;
      const direction = inventorySort.endsWith("asc") ? 1 : -1;
      chosen.sort((a, b) => {
        const left = sortColumn ? firstNumber(a[sortColumn]) : null;
        const right = sortColumn ? firstNumber(b[sortColumn]) : null;
        if (left === null && right === null) return 0;
        if (left === null) return 1;
        if (right === null) return -1;
        return (left - right) * direction;
      });
      count.textContent = chosen.length + (chosen.length === 1 ? " produto" : " produtos") + (inventoryBarrier ? " neste filtro" : " no inventário");
      results.replaceChildren(table(columns, chosen, "Inventário de produtos", "inventory-table"));
    }
    searchField.input.addEventListener("input", () => { inventorySearch = searchField.input.value; update(); });
    sort.addEventListener("change", () => { inventorySort = sort.value; update(); });
    filter.addEventListener("change", () => { inventoryBarrier = filter.value; update(); });
    target.append(element("p", "portfolio-note", "Inventário inicial e parcial. As fontes documentam os ativos; não comprovam, sozinhas, funcionamento atual ou prontidão comercial."), toolbar, results);
    update();
  }

  function metricPanel(title, rows, kind, source, fonte) {
    const card = element("article", "metric-panel");
    if (fonte) card.dataset.fonte = fonte;
    card.append(source ? headingWithSource(title, source, kind === "fixed" ? "Planos confirmados convertidos para custo mensal." : "Valores copiados do registro de caixa. Nada é calculado aqui.", fonte, "metric-heading") : element("h3", "", title));
    if (!array(rows).length) { empty(card, "sem entrega ainda"); return card; }
    rows.forEach((row) => {
      const line = element("div", "metric-row");
      const label = element("div", "metric-label", row.servico || row.moeda || "Valor");
      if (row.data) label.append(element("span", "metric-meta", dateLabel(row.data)));
      if (row.status) label.append(element("span", "metric-meta", row.status));
      line.append(label, element("div", "metric-money", money(row.valor, row.moeda)));
      card.append(line);
    });
    if (kind === "fixed") card.append(element("p", "form-help", "Somente planos confirmados, convertidos para custo mensal. Moedas separadas."));
    return card;
  }

  function renderCash(block) {
    renderSource(byId("cash-source"), block.source);
    const target = byId("cash-content");
    clear(target);
    const alerts = block.alerts || {};
    if (alerts.source && alerts.source.exists) {
      const notice = element("div", "notice");
      notice.append(element("h3", "", "Alertas financeiros"));
      const metadata = element("div"); renderSource(metadata, alerts.source); notice.append(metadata);
      const copy = prose(alerts.text);
      if (copy) notice.append(element("p", "document-text", copy));
      if (array(alerts.rows).length) notice.append(table(alerts.columns, alerts.rows, "Alertas financeiros"));
      if (!copy && !array(alerts.rows).length) notice.append(element("p", "", "Nenhum alerta informado nesta entrega."));
      target.append(notice);
    }
    const grid = element("div", "cash-grid");
    grid.append(metricPanel("Custo fixo mensal", block.fixed_monthly, "fixed", block.source, "caixa-custo-fixo"), metricPanel("Gasto do mês por serviço", block.expenses_month, "", block.source, "caixa-gasto-mes"), metricPanel("Saldos registrados", block.balances, "", block.source, "caixa-saldos"), metricPanel("Pagamentos previstos", block.forecast, "", block.source, "caixa-previstos"));
    target.append(grid);
    if (block.incomplete_costs > 0) {
      target.append(element("p", "notice cash-notes", "Custo fixo parcial: " + block.incomplete_costs + " plano(s) confirmado(s) com dados incompletos. Confira os planos antes de usar o total."));
    }
    if (array(block.unclassified_expenses).length) {
      target.append(metricPanel("Gastos com moeda ainda não informada", block.unclassified_expenses));
    }
    const budget = element("div", "budget-list");
    budget.append(element("h3", "", "Teto e consumo"));
    if (!array(block.budget).length) empty(budget, "Teto ainda não informado.");
    array(block.budget).forEach((row) => {
      const card = element("div", "budget-row");
      const top = element("div", "budget-top");
      top.append(element("span", "", row.servico || "Total"), element("span", "budget-amount", money(row.consumo, row.moeda) + " de " + money(row.teto, row.moeda)));
      card.append(top);
      if (typeof row.percentual === "number" && Number.isFinite(row.percentual)) {
        const meter = element("progress", "budget-progress" + (row.percentual > 100 ? " over-budget" : ""));
        meter.max = 100; meter.value = Math.max(0, Math.min(100, row.percentual));
        meter.setAttribute("aria-label", "Consumo do teto de " + text(row.servico || "Total"));
        meter.setAttribute("aria-valuetext", text(row.percentual) + "% do teto");
        card.append(meter, element("p", "budget-note", text(row.percentual) + "% do teto registrado"));
      } else card.append(element("p", "budget-note", "Percentual não calculado: teto sem valor positivo."));
      budget.append(card);
    });
    target.append(budget, documentDetails("Entrega de caixa", block));
    array(block.records).forEach((record) => {
      const file = sourceName(record.source) || "Registro financeiro";
      target.append(documentDetails(file, record));
    });
    const sources = element("details", "document-details");
    sources.append(element("summary", "", "Datas das fontes financeiras"));
    array(block.sources).forEach((source) => {
      const line = element("div");
      line.append(element("p", "source-path", sourceName(source) || hostLabel("record")));
      const status = element("div"); renderSource(status, source); line.append(status); sources.append(line);
    });
    target.append(sources);
  }

  function renderProjection(block) {
    renderSource(byId("projection-source"), block.source);
    const target = byId("projection-content");
    clear(target);
    const scenarios = array(block.scenarios).slice(0, 3);
    if (!scenarios.length) { empty(target); return; }
    const grid = element("div", "scenarios-grid");
    scenarios.forEach((scenario) => {
      const card = element("article", "scenario-card");
      const title = scenario.nome || scenario.name || "Cenário";
      card.dataset.fonte = "projecao-" + normalized(title);
      card.append(headingWithSource(title, block.source, "Copiado do documento de projeção. A fórmula declarada fica em “Ver fórmula”.", card.dataset.fonte, "metric-heading"));
      const fields = element("dl", "scenario-fields");
      Object.entries(scenario).filter(([name]) => !/(^|_)(nome|name|cenario|formula|calculo|cpf|senha|hash)(_|$)/.test(normalized(name))).forEach(([label, value]) => {
        const item = element("div"); item.append(element("dt", "", label), element("dd", "", value)); fields.append(item);
      });
      card.append(fields);
      const formula = element("details", "formula");
      const explanation = text(scenario.formula || "Fórmula não informada nesta entrega.");
      const summary = element("summary", "", "Ver fórmula");
      summary.title = explanation;
      summary.setAttribute("aria-label", "Fórmula de " + text(scenario.nome || "cenário") + ": " + explanation);
      formula.append(summary, element("p", "", explanation));
      card.append(formula);
      grid.append(card);
    });
    target.append(grid);
    const notes = prose(block.text);
    if (notes) target.append(documentDetails("Notas da projeção", {...block, rows: []}));
  }

  function renderSociety(block) {
    renderSource(byId("society-source"), block.source);
    const target = byId("society-content");
    clear(target);
    renderPerfis(target);
    if (array(block.rows).length) target.append(table(block.columns, block.rows, "Sócios e participação"));
    else if (block.text) target.append(element("p", "document-text", prose(block.text)));
    else empty(target);
  }

  // Perfis da sociedade (19/10/2026): cartões com nome, função, telefone, e-mail e estado civil, abertos de perfis.json
  // (cifrado com a chave mestra; ver perfis.js). "Atualizar perfis" confere um texto colado contra o roster e devolve o
  // envelope cifrado para publicar; o portal não grava no repositório. Telefone e e-mail vão por textContent: text()
  // mascara sequências de 11 dígitos como CPF.
  const perfisAvisos = {
    ausente: "Nome, função e contato de cada sócia ainda não foram cadastrados. Use Atualizar perfis, logo abaixo.",
    "outra-chave": "Os perfis foram cifrados com a chave anterior do portal e não abrem mais. Cifre de novo em Atualizar perfis.",
    ilegivel: "O arquivo de perfis está ilegível. Cifre de novo em Atualizar perfis.",
    indisponivel: "Não deu para buscar os perfis agora. Recarregue a página para tentar de novo."
  };
  function campoPerfil(rotulo, valor, href) {
    const linha = element("p", "perfil-campo");
    linha.append(element("span", "perfil-rotulo", rotulo));
    const conteudo = document.createElement(href ? "a" : "span");
    conteudo.className = "perfil-valor";
    conteudo.textContent = valor;
    if (href) conteudo.href = href;
    linha.append(conteudo);
    return linha;
  }
  function cartaoPerfil(m) {
    const cartao = element("article", "perfil-cartao");
    const cabeca = element("div", "perfil-cabeca");
    const nome = element("h3", "perfil-nome"); nome.textContent = m.nome || m.rotulo;
    cabeca.append(nome);
    if (m.funcao) { const funcao = element("p", "perfil-funcao"); funcao.textContent = m.funcao; cabeca.append(funcao); }
    cartao.append(cabeca);
    if (m.participacao !== null && m.participacao !== undefined) cartao.append(campoPerfil("Participação", m.participacao + "%"));
    if (m.fone) cartao.append(campoPerfil("Telefone", m.fone, m.foneLink ? "tel:" + m.foneLink : ""));
    if (m.email) cartao.append(campoPerfil("E-mail", m.email, "mailto:" + m.email));
    if (m.estadoCivil) cartao.append(campoPerfil("Estado civil", m.estadoCivil));
    return cartao;
  }
  function renderPerfis(target) {
    const api = host().perfis;
    const dados = api && typeof api.ler === "function" ? api.ler() : null;
    if (!dados) return;
    const secao = element("section", "perfis");
    secao.setAttribute("aria-label", "Quem é quem na sociedade");
    if (dados.estado === "ok") {
      const grade = element("div", "perfis-grade");
      array(dados.membros).forEach((m) => grade.append(cartaoPerfil(m)));
      secao.append(grade);
    } else {
      secao.append(element("p", "perfis-aviso", perfisAvisos[dados.estado] || perfisAvisos.ausente));
    }
    // rede fora: sem os perfis de hoje, atualizar apagaria quem não fosse colado; a ferramenta só volta depois de recarregar
    if (dados.estado !== "indisponivel" && typeof api.conferir === "function" && typeof api.cifrar === "function") secao.append(ferramentaPerfis(api, dados));
    target.append(secao);
  }
  function ferramentaPerfis(api, dados) {
    const caixa = element("details", "perfis-ferramenta");
    if (dados.estado !== "ok") caixa.open = true;
    caixa.append(element("summary", "", "Atualizar perfis"));
    caixa.append(element("p", "form-help", dados.estado === "ok"
      ? "A caixa já vem com os perfis de hoje: mude o que precisar e toque em Conferir. Quem você tirar do texto fica como está; para apagar alguém, troque os dados dela por null. Depois, Cifrar gera um texto que só abre com a senha do portal: mande esse texto ao Claude para publicar."
      : (dados.estado === "ausente" ? "" : "Atenção: o arquivo de perfis atual não abre, então o texto novo substitui todos. Cole as três sócias. ")
        + "Cole os dados das sócias no formato abaixo e toque em Conferir. Depois, Cifrar gera um texto que só abre com a senha do portal: mande esse texto ao Claude para publicar."));
    const area = element("textarea", "perfis-entrada");
    area.rows = 7; area.spellcheck = false; area.setAttribute("aria-label", "Dados das sócias");
    area.placeholder = '{"' + array(dados.membros).map((m) => m.rotulo).filter(Boolean).slice(0, 1).concat(["Sócio 1"])[0] + '": {"nome": "…", "funcao": "…", "fone": "…", "email": "…", "estadoCivil": "…"}}';
    if (dados.estado === "ok") {
      const atuais = {};
      array(dados.membros).filter((m) => m.nome).forEach((m) => {
        const p = {nome: m.nome};
        ["funcao", "fone", "email", "estadoCivil"].forEach((campo) => { if (m[campo]) p[campo] = m[campo]; });
        atuais[m.rotulo] = p;
      });
      area.value = JSON.stringify(atuais, null, 1);
    }
    const previa = element("div", "perfis-previa");
    previa.setAttribute("aria-live", "polite");
    const saida = element("div", "perfis-saida"); saida.hidden = true;
    let conferidos = null;
    const cifrar = button("Cifrar para publicar", "button-primary", async () => {
      if (!conferidos) return;
      cifrar.disabled = true;
      try {
        const envelope = await api.cifrar(conferidos.membros, conferidos.remover);
        clear(saida); saida.hidden = false;
        const texto = element("textarea", "perfis-envelope"); texto.readOnly = true; texto.rows = 6; texto.value = envelope; texto.setAttribute("aria-label", "Texto cifrado dos perfis");
        const copiar = button("Copiar", "button-outline", async () => {
          try { await navigator.clipboard.writeText(envelope); copiar.textContent = "Copiado"; }
          catch { texto.select(); copiar.textContent = "Selecionado: copie com o menu"; }
        });
        saida.append(element("p", "form-help", "Pronto. Este texto está cifrado: sem a senha do portal ninguém lê. Mande ao Claude, que publica como perfis.json; depois de entrar de novo, as três veem os perfis."), texto, copiar);
      } catch (error) {
        clear(saida); saida.hidden = false; saida.append(element("p", "form-error", error && error.message ? error.message : "Não deu para cifrar."));
      } finally { cifrar.disabled = false; }
    });
    cifrar.disabled = true;
    const conferir = button("Conferir", "button-outline", () => {
      clear(previa); saida.hidden = true; conferidos = null; cifrar.disabled = true;
      let resultado;
      try { resultado = api.conferir(area.value); }
      catch (error) { previa.append(element("p", "form-error", error && error.message ? error.message : "Não deu para conferir.")); return; }
      const rotulos = Object.fromEntries(array(dados.membros).map((m) => [m.id, m.rotulo]));
      const ids = Object.keys(resultado.membros || {});
      const remover = array(resultado.remover);
      ids.forEach((id) => {
        const p = resultado.membros[id];
        const linha = element("p", "perfis-linha");
        linha.textContent = (rotulos[id] || id) + " → " + [p.nome, p.funcao, p.fone, p.email, p.estadoCivil].filter(Boolean).join(" · ");
        previa.append(linha);
      });
      remover.forEach((id) => { const linha = element("p", "perfis-linha"); linha.textContent = (rotulos[id] || id) + " → perfil apagado"; previa.append(linha); });
      if (dados.estado === "ok") {
        const ficam = array(dados.membros).filter((m) => m.nome && !ids.includes(m.id) && !remover.includes(m.id)).map((m) => m.nome);
        if (ficam.length) { const linha = element("p", "perfis-linha"); linha.textContent = "Ficam como estão: " + ficam.join(", "); previa.append(linha); }
      }
      array(resultado.avisos).forEach((aviso) => previa.append(element("p", "form-error", aviso)));
      if (!ids.length && !remover.length) { previa.append(element("p", "form-error", "Nenhum perfil com nome no texto colado.")); return; }
      conferidos = {membros: resultado.membros, remover}; cifrar.disabled = false;
    });
    // mexer no texto depois de conferir obriga a conferir de novo: Cifrar nunca cifra o que a tela não mostrou
    area.addEventListener("input", () => { conferidos = null; cifrar.disabled = true; saida.hidden = true; clear(previa); });
    const botoes = element("div", "perfis-botoes"); botoes.append(conferir, cifrar);
    caixa.append(area, botoes, previa, saida);
    return caixa;
  }

  // Med Painel (17/10/2026, pedido do Criador): estratégias de venda e o caminho até a meta de assinantes.
  // A conta é uma função pura (projetarMedPainel) sobre as premissas de mercado/MED-PAINEL-PREMISSAS.csv; os números
  // de aquisição são chutes rotulados até o piloto medir. Gráficos pela skill dataviz: ênfase (o cenário escolhido no
  // acento, os outros em cinza de contexto com rótulo na ponta), cores validadas contra as superfícies clara e escura.
  const mpCenarios = [["pessimista", "Pessimista"], ["base", "Base"], ["otimista", "Otimista"]];
  const mpMarcos = [100, 500, 1000, 2500, 5000, 10000];
  let mpCenario = "base";
  let mpUltimoBloco = null;
  // Tela estreita: o gráfico é desenhado na largura dela (texto em tamanho real), não encolhido de 760 para 350.
  const mpEstreita = window.matchMedia ? window.matchMedia("(max-width: 620px)") : null;
  const mpEhEstreita = () => Boolean(mpEstreita && mpEstreita.matches);
  if (mpEstreita && mpEstreita.addEventListener) mpEstreita.addEventListener("change", () => { if (mpUltimoBloco) renderMedPainel(mpUltimoBloco); });
  const mpInteiro = new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 0});
  const mpReais = new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL", maximumFractionDigits: 0});
  const mpCentavos = new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"});
  const mpCompacto = (valor) => Math.abs(valor) >= 1000 ? mpInteiro.format(Math.round(valor / 100) / 10).replace(/,0$/, "") + " mil" : mpInteiro.format(Math.round(valor));
  const mpReaisCompacto = (valor) => (valor < 0 ? "−" : "") + "R$ " + mpCompacto(Math.abs(valor));

  function mpPremissa(block, chave, cenario, padrao) {
    const item = (block.premissas || {})[chave];
    const valor = item && typeof item[cenario] === "number" && isFinite(item[cenario]) ? item[cenario] : null;
    return valor === null ? padrao : valor;
  }

  function mpCustoFixoEmpresa(block, cambio) {
    let total = 0;
    const semConversao = [];
    array(block.fixed_monthly).forEach((item) => {
      const valor = Number(item && item.valor) || 0;
      if (item.moeda === "BRL") total += valor;
      else if (item.moeda === "USD") total += valor * cambio;
      else if (valor) semConversao.push(item.moeda);
    });
    return {total, semConversao};
  }

  // Maior resto em centavos, como allocate_minor do core.py: a soma das partes bate o lucro ao centavo.
  function mpRepartir(totalReais, socios) {
    const partes = array(socios).filter((socio) => typeof socio.participacao === "number");
    if (!partes.length || partes.reduce((soma, socio) => soma + socio.participacao, 0) !== 100) return [];
    const centavos = Math.round(Math.max(0, totalReais) * 100);
    const exatas = partes.map((socio) => centavos * socio.participacao / 100);
    const inteiras = exatas.map(Math.floor);
    const resto = centavos - inteiras.reduce((soma, valor) => soma + valor, 0);
    exatas.map((valor, indice) => [valor - inteiras[indice], indice]).sort((x, y) => y[0] - x[0] || x[1] - y[1])
      .slice(0, resto).forEach(([, indice]) => { inteiras[indice] += 1; });
    return partes.map((socio, indice) => ({nome: socio.nome, participacao: socio.participacao, valor: inteiras[indice] / 100}));
  }

  function projetarMedPainel(block, cenario) {
    const P = (chave, padrao) => mpPremissa(block, chave, cenario, padrao);
    const preco = P("preco", 59.9), churn = P("churn_pct", 5) / 100, indicacao = P("indicacao_pct", 2) / 100;
    const cambio = P("cambio", 5.3), meta = P("meta", 10000), parteVerba = P("verba_pct", 50) / 100;
    const meses = Math.min(120, Math.max(1, Math.round(P("meses", 48))));
    const fixoEmpresa = mpCustoFixoEmpresa(block, cambio).total * P("empresa_fixo_pct", 100) / 100;
    const fixoProduto = P("servidor_usd", 11) * cambio + P("apple_usd_ano", 99) * cambio / 12 + P("contador", 0);
    const comissaoPct = P("comissao_pct", 20) / 100, comissaoMeses = Math.max(0, Math.round(P("comissao_meses", 12)));
    const promotores = P("promotores", 0) * P("conv_promotor", 0);
    const influenciadores = P("acoes_influencer", 0) * P("conv_acao", 0);
    const ecossistema = P("eco_usuarios", 0) * P("eco_convite_pct", 0) / 100 * P("conv_teste_pct", 15) / 100;
    const afiliados = [];
    let assinantes = Math.max(0, P("inicio_assinantes", 0)), verba = Math.max(0, P("verba_inicial", 0));
    const linhas = [];
    for (let mes = 1; mes <= meses; mes++) {
      const boca = assinantes * indicacao;
      const pago = verba > 0 ? verba / Math.max(1, P("cac_pago", 150)) : 0;
      const perdas = assinantes * churn;
      const entradas = boca + promotores + influenciadores + ecossistema + pago;
      const novo = Math.max(0, assinantes + entradas - perdas);
      afiliados.push(influenciadores);
      let ativosAfiliados = 0;
      for (let idade = 0; idade < Math.min(comissaoMeses, afiliados.length); idade++) ativosAfiliados += afiliados[afiliados.length - 1 - idade] * Math.pow(1 - churn, idade);
      const bruta = novo * preco, mesesGratis = boca * preco;
      const taxas = novo * (preco * P("taxa_pct", 4.69) / 100 + P("taxa_fixa", 0.5));
      const impostos = Math.max(0, bruta - mesesGratis) * P("imposto_pct", 6) / 100;
      const comissao = ativosAfiliados * preco * comissaoPct;
      const resultado = bruta - mesesGratis - taxas - impostos - fixoEmpresa - fixoProduto - comissao - verba;
      const proximaVerba = resultado > 0 ? resultado * parteVerba : 0;
      const lucro = resultado > 0 ? resultado - proximaVerba : 0;
      linhas.push({mes, assinantes: novo, entradas, perdas, canais: {boca, promotores, influenciadores, ecossistema, pago},
        bruta, mesesGratis, taxas, impostos, fixo: fixoEmpresa + fixoProduto, comissao, verba, resultado, proximaVerba, lucro,
        aporte: resultado < 0 ? -resultado : 0, socios: mpRepartir(lucro, block.socios)});
      assinantes = novo;
      verba = proximaVerba;
      if (assinantes >= meta) break;
    }
    const marcos = mpMarcos.map((marco) => { const linha = linhas.find((item) => item.assinantes >= marco); return linha ? linha.mes : null; });
    const ultimo = linhas[linhas.length - 1];
    const fixasFim = promotores + influenciadores + ecossistema + (ultimo ? ultimo.canais.pago : 0);
    return {cenario, linhas, marcos, meta, fixoEmpresa, fixoProduto, churn, indicacao, fixasFim,
      teto: churn > indicacao ? fixasFim / (churn - indicacao) : Infinity, chegou: Boolean(ultimo && ultimo.assinantes >= meta)};
  }

  function mpSvg(tag, atributos, conteudo) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(atributos || {}).forEach(([nome, valor]) => node.setAttribute(nome, String(valor)));
    if (conteudo !== undefined) node.textContent = text(conteudo);
    return node;
  }

  function mpPassoBonito(maximo, alvo = 4) {
    const bruto = Math.max(1e-9, maximo / alvo), potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
    return [1, 2, 2.5, 5, 10].map((fator) => fator * potencia).find((passo) => passo >= bruto) || 10 * potencia;
  }

  function mpDica(container) {
    const dica = element("div", "mp-dica");
    dica.setAttribute("role", "status");
    dica.hidden = true;
    container.append(dica);
    return dica;
  }

  function mpMostrarDica(dica, x, y, largura, linhas) {
    dica.replaceChildren();
    linhas.forEach(([valor, rotulo, classeChave]) => {
      const linha = element("div", "mp-dica-linha");
      if (classeChave) linha.append(element("span", "mp-chave " + classeChave));
      linha.append(element("strong", "", valor), element("span", "", rotulo));
      dica.append(linha);
    });
    dica.hidden = false;
    dica.style.left = Math.min(Math.max(8, x + 14), largura - 190) + "px";
    dica.style.top = Math.max(4, y - 10) + "px";
  }

  function mpGraficoAssinantes(projecoes, escolhido) {
    const caixa = element("div", "mp-grafico");
    const estreita = mpEhEstreita();
    const W = estreita ? 380 : 760, H = estreita ? 270 : 300, M = estreita ? {t: 14, r: 74, b: 30, l: 40} : {t: 16, r: 104, b: 34, l: 54};
    const meta = escolhido.meta;
    const maxMes = Math.max(2, ...projecoes.map((projecao) => projecao.linhas.length));
    const passo = mpPassoBonito(Math.max(meta, ...projecoes.flatMap((projecao) => projecao.linhas.map((linha) => linha.assinantes))));
    const topo = Math.ceil(Math.max(meta, ...projecoes.flatMap((projecao) => projecao.linhas.map((linha) => linha.assinantes))) / passo) * passo;
    const X = (mes) => M.l + (mes - 1) / (maxMes - 1) * (W - M.l - M.r);
    const Y = (valor) => H - M.b - valor / topo * (H - M.t - M.b);
    const svg = mpSvg("svg", {viewBox: "0 0 " + W + " " + H, class: "mp-svg", role: "img", tabindex: "0",
      "aria-label": "Assinantes por mês nos três cenários. Cenário " + escolhido.cenario + ": " + (escolhido.chegou ? "chega a " + mpInteiro.format(meta) + " no mês " + escolhido.linhas.length : "não chega a " + mpInteiro.format(meta) + " em " + escolhido.linhas.length + " meses") + ". Valores na tabela mês a mês."});
    for (let valor = 0; valor <= topo + 1e-9; valor += passo) {
      svg.append(mpSvg("line", {x1: M.l, x2: W - M.r, y1: Y(valor), y2: Y(valor), class: "mp-grade"}));
      svg.append(mpSvg("text", {x: M.l - 8, y: Y(valor) + 4, class: "mp-eixo", "text-anchor": "end"}, mpCompacto(valor)));
    }
    [1, 12, 24, 36, 48].filter((mes) => mes <= maxMes).forEach((mes) => svg.append(mpSvg("text", {x: X(mes), y: H - 10, class: "mp-eixo", "text-anchor": "middle"}, (estreita ? "" : "mês ") + mes)));
    svg.append(mpSvg("line", {x1: M.l, x2: W - M.r, y1: Y(meta), y2: Y(meta), class: "mp-meta"}));
    svg.append(mpSvg("text", {x: M.l + 6, y: Y(meta) - 6, class: "mp-eixo mp-meta-texto"}, "Meta: " + mpCompacto(meta) + " assinantes"));
    const ordem = projecoes.slice().sort((a, b) => (a.cenario === escolhido.cenario) - (b.cenario === escolhido.cenario));
    ordem.forEach((projecao) => {
      if (!projecao.linhas.length) return;
      const acento = projecao.cenario === escolhido.cenario;
      const caminho = projecao.linhas.map((linha, indice) => (indice ? "L" : "M") + X(linha.mes).toFixed(1) + " " + Y(linha.assinantes).toFixed(1)).join(" ");
      svg.append(mpSvg("path", {d: caminho, class: "mp-linha " + (acento ? "mp-linha-acento" : "mp-linha-contexto") + (projecao.cenario === "pessimista" ? " mp-tracejada" : "")}));
      const fim = projecao.linhas[projecao.linhas.length - 1];
      svg.append(mpSvg("circle", {cx: X(fim.mes), cy: Y(fim.assinantes), r: 4, class: acento ? "mp-ponto-acento" : "mp-ponto-contexto"}));
      const nomeCenario = mpCenarios.find(([chave]) => chave === projecao.cenario)[1];
      const rotulo = (estreita && nomeCenario.length > 5 ? nomeCenario.slice(0, 4) + "." : nomeCenario) + " " + (estreita ? "" : "· ") + mpCompacto(fim.assinantes);
      svg.append(mpSvg("text", {x: X(fim.mes) + 8, y: Y(fim.assinantes) + 4, class: "mp-rotulo" + (acento ? " mp-rotulo-acento" : "")}, rotulo));
    });
    const cruz = mpSvg("line", {y1: M.t, y2: H - M.b, class: "mp-cruz", visibility: "hidden"});
    svg.append(cruz);
    const alvo = mpSvg("rect", {x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: "transparent"});
    svg.append(alvo);
    caixa.append(svg);
    const dica = mpDica(caixa);
    let mesAtivo = null;
    const mostrar = (mes) => {
      mesAtivo = Math.min(maxMes, Math.max(1, mes));
      cruz.setAttribute("x1", X(mesAtivo)); cruz.setAttribute("x2", X(mesAtivo)); cruz.setAttribute("visibility", "visible");
      const linhas = [["Mês " + mesAtivo, "", ""]].concat(projecoes.map((projecao) => {
        const linha = projecao.linhas.find((item) => item.mes === mesAtivo);
        const nome = mpCenarios.find(([chave]) => chave === projecao.cenario)[1];
        return [linha ? mpInteiro.format(Math.round(linha.assinantes)) : "meta atingida antes", nome, projecao.cenario === escolhido.cenario ? "mp-chave-acento" : "mp-chave-contexto" + (projecao.cenario === "pessimista" ? " mp-chave-tracejada" : "")];
      }));
      const caixaSvg = svg.getBoundingClientRect(), escala = caixaSvg.width / W || 1;
      mpMostrarDica(dica, X(mesAtivo) * escala, M.t * escala, caixaSvg.width, linhas);
    };
    const esconder = () => { cruz.setAttribute("visibility", "hidden"); dica.hidden = true; mesAtivo = null; };
    alvo.addEventListener("pointermove", (evento) => {
      const caixaSvg = svg.getBoundingClientRect(), escala = W / (caixaSvg.width || W);
      mostrar(Math.round(((evento.clientX - caixaSvg.left) * escala - M.l) / (W - M.l - M.r) * (maxMes - 1)) + 1);
    });
    alvo.addEventListener("pointerleave", esconder);
    svg.addEventListener("focus", () => mostrar(Math.min(12, maxMes)));
    svg.addEventListener("blur", esconder);
    svg.addEventListener("keydown", (evento) => {
      if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;
      evento.preventDefault();
      mostrar((mesAtivo || 1) + (evento.key === "ArrowRight" ? 1 : -1));
    });
    return caixa;
  }

  function mpGraficoResultado(projecao) {
    const caixa = element("div", "mp-grafico mp-grafico-baixo");
    const estreita = mpEhEstreita();
    const W = estreita ? 380 : 760, H = estreita ? 210 : 220, M = estreita ? {t: 12, r: 10, b: 28, l: 62} : {t: 14, r: 24, b: 30, l: 64};
    const linhas = projecao.linhas;
    if (!linhas.length) { empty(caixa); return caixa; }
    const maximo = Math.max(0, ...linhas.map((linha) => linha.resultado)), minimo = Math.min(0, ...linhas.map((linha) => linha.resultado));
    const passo = mpPassoBonito(Math.max(1, maximo - minimo));
    const topo = Math.ceil(maximo / passo) * passo || passo, fundo = Math.floor(minimo / passo) * passo;
    const banda = (W - M.l - M.r) / linhas.length, largura = Math.max(2, Math.min(24, banda * 0.62)), raio = Math.min(4, largura / 2);
    const Y = (valor) => M.t + (topo - valor) / (topo - fundo) * (H - M.t - M.b);
    const svg = mpSvg("svg", {viewBox: "0 0 " + W + " " + H, class: "mp-svg", role: "img",
      "aria-label": "Resultado do Med Painel por mês no cenário escolhido: barras acima de zero são resultado positivo, abaixo de zero é aporte necessário. Valores na tabela mês a mês."});
    for (let valor = fundo; valor <= topo + 1e-9; valor += passo) {
      svg.append(mpSvg("line", {x1: M.l, x2: W - M.r, y1: Y(valor), y2: Y(valor), class: valor === 0 ? "mp-base" : "mp-grade"}));
      svg.append(mpSvg("text", {x: M.l - 8, y: Y(valor) + 4, class: "mp-eixo", "text-anchor": "end"}, mpReaisCompacto(valor)));
    }
    [1, 12, 24, 36, 48].filter((mes) => mes <= linhas.length).forEach((mes) => svg.append(mpSvg("text", {x: M.l + (mes - 0.5) * banda, y: H - 10, class: "mp-eixo", "text-anchor": "middle"}, (estreita ? "" : "mês ") + mes)));
    const dica = mpDica(caixa);
    linhas.forEach((linha, indice) => {
      const x = M.l + indice * banda + (banda - largura) / 2, zero = Y(0), y = Y(linha.resultado), positivo = linha.resultado >= 0;
      const altura = Math.abs(zero - y);
      if (altura >= 0.5) {
        const r = Math.min(raio, altura);
        const d = positivo
          ? "M" + x + " " + zero + " V" + (y + r) + " Q" + x + " " + y + " " + (x + r) + " " + y + " H" + (x + largura - r) + " Q" + (x + largura) + " " + y + " " + (x + largura) + " " + (y + r) + " V" + zero + " Z"
          : "M" + x + " " + zero + " V" + (y - r) + " Q" + x + " " + y + " " + (x + r) + " " + y + " H" + (x + largura - r) + " Q" + (x + largura) + " " + y + " " + (x + largura) + " " + (y - r) + " V" + zero + " Z";
        svg.append(mpSvg("path", {d, class: positivo ? "mp-barra-positiva" : "mp-barra-negativa"}));
      }
      const alvo = mpSvg("rect", {x: M.l + indice * banda, y: M.t, width: banda, height: H - M.t - M.b, fill: "transparent", tabindex: "0", "aria-label": "Mês " + linha.mes + ": " + (positivo ? "resultado " + mpCentavos.format(linha.resultado) : "aporte necessário " + mpCentavos.format(linha.aporte))});
      const mostrar = () => {
        const linhasDica = [[positivo ? mpCentavos.format(linha.resultado) : mpCentavos.format(linha.aporte), "mês " + linha.mes + (positivo ? " · resultado" : " · aporte necessário"), positivo ? "mp-chave-positiva" : "mp-chave-negativa"]];
        if (positivo) {
          linhasDica.push([mpCentavos.format(linha.proximaVerba), "verba de marketing do mês seguinte", ""]);
          linha.socios.forEach((socio) => linhasDica.push([mpCentavos.format(socio.valor), socio.nome + " (" + socio.participacao + "%)", ""]));
        }
        const caixaSvg = svg.getBoundingClientRect(), escala = caixaSvg.width / W || 1;
        mpMostrarDica(dica, (x + largura) * escala, M.t * escala, caixaSvg.width, linhasDica);
      };
      alvo.addEventListener("pointerenter", mostrar);
      alvo.addEventListener("focus", mostrar);
      alvo.addEventListener("pointerleave", () => { dica.hidden = true; });
      alvo.addEventListener("blur", () => { dica.hidden = true; });
      svg.append(alvo);
    });
    caixa.append(svg);
    return caixa;
  }

  function mpLegenda(itens) {
    const lista = element("ul", "mp-legenda");
    itens.forEach(([rotulo, classeChave]) => {
      const item = element("li");
      item.append(element("span", "mp-chave " + classeChave), element("span", "", rotulo));
      lista.append(item);
    });
    return lista;
  }

  function mpBlocoNumero(rotulo, valor, nota) {
    const painel = element("div", "metric-panel mp-numero");
    painel.append(element("h3", "", rotulo), element("p", "mp-numero-valor", valor));
    if (nota) painel.append(element("p", "mp-numero-nota", nota));
    return painel;
  }

  function mpSecao(titulo, descricao) {
    const secao = element("section", "mp-secao");
    secao.append(element("h3", "mp-secao-titulo", titulo));
    if (descricao) secao.append(element("p", "mp-secao-texto", descricao));
    return secao;
  }

  // A mesa de teste do Med Painel (só no portal): chamada no fim do bloco e também quando o bloco vem vazio.
  function mpMesaDeTeste(target) {
  // A mesa de teste (18/10/2026, pedido do Criador): o painel de verdade ao lado de um documento fictício, só no portal.
  // Vem selada à parte (painel/<slug>/) e só é baixada quando esta página aparece; o link abre a mesma mesa em tela cheia.
  if (typeof host().painelUrl === "function") {
    const mesa = mpSecao("Veja o painel funcionando", "Este é o Med Painel de verdade, rodando aqui dentro. O documento da esquerda faz as vezes do prontuário: busque um CID no painel e clique em Colar; no Bulário, abra um remédio e as gavetas (Copiar trecho e fonte copia para o ⌘V); depois escreva /plano no documento e aperte Tab. No Mac, o painel cola em qualquer app; aqui, cola no documento de teste. Nada é real.");
    const aviso = element("p", "mp-secao-texto mp-mesa-aviso", "Abrindo a mesa de teste…");
    mesa.append(aviso);
    let abrindo = false;
    const abrir = () => {
      if (abrindo) return;
      abrindo = true;
      Promise.resolve().then(() => host().painelUrl()).then((url) => {
        const frame = element("iframe", "mp-mesa-frame");
        frame.setAttribute("sandbox", "allow-scripts allow-popups allow-modals allow-forms");
        frame.setAttribute("allow", "clipboard-write");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.title = "Med Painel, mesa de teste";
        frame.src = String(url);
        aviso.replaceWith(frame);
      }).catch((error) => { aviso.textContent = error && error.message ? error.message : "A mesa de teste não veio neste pacote."; });
    };
    if (typeof IntersectionObserver === "function") {
      const observador = new IntersectionObserver((entradas) => { if (entradas.some((entrada) => entrada.isIntersecting)) { observador.disconnect(); abrir(); } });
      observador.observe(target);
    } else {
      abrir();
    }
    const link = typeof host().painelLink === "function" ? String(host().painelLink() || "").trim() : "";
    if (link) {
      const rodape = element("p", "mp-mesa-link");
      const a = element("a", "", "Abrir a mesa de teste em tela cheia");
      a.href = link; a.target = "_blank"; a.rel = "noopener noreferrer";
      rodape.append(a, element("span", "mp-secao-texto", " · link privado, com senha própria: só quem tem o link e a senha vê a página."));
      mesa.append(rodape);
    }
    target.append(mesa);
  }
  }
  function renderMedPainel(block) {
    mpUltimoBloco = block;
    renderSource(byId("medpainel-source"), block.source);
    const target = byId("medpainel-content");
    clear(target);
    const estrategias = array(block.estrategias && block.estrategias.rows);
    const premissas = block.premissas || {};
    if (!estrategias.length && !Object.keys(premissas).length) { empty(target); mpMesaDeTeste(target); return; }

    const vender = mpSecao("Como vamos vender", "Cada canal tem cupom ou código próprio, para saber de onde veio cada assinante. Metas são propostas; quem decide é o Bauer.");
    const grade = element("div", "products-grid mp-canais");
    estrategias.forEach((linha) => {
      const cartao = element("article", "product-card mp-canal");
      cartao.append(element("h4", "mp-canal-nome", linha["Canal"] || ""));
      const campos = element("dl", "mp-canal-campos");
      [["Como funciona", "Como funciona"], ["O que custa", "O que custa"], ["Como medir", "Como medir"], ["Meta do canal", "Meta"]].forEach(([coluna, rotulo]) => {
        if (!linha[coluna]) return;
        const item = element("div");
        item.append(element("dt", "", rotulo), element("dd", "", linha[coluna]));
        campos.append(item);
      });
      cartao.append(campos);
      grade.append(cartao);
    });
    vender.append(grade);
    target.append(vender);

    const projecoes = mpCenarios.map(([chave]) => projetarMedPainel(block, chave));
    const escolhido = projecoes.find((projecao) => projecao.cenario === mpCenario) || projecoes[1];
    const caminho = mpSecao("O caminho até " + mpCompacto(escolhido.meta) + " assinantes", "Projeção mês a mês com as premissas abaixo. Os números de aquisição ainda são chutes: viram previsão depois do piloto. O custo por assinante (CAC) fica constante na conta; na vida real ele sobe quando a verba cresce, então a reta final do cenário é otimista.");
    const seletor = element("div", "mp-cenarios");
    seletor.setAttribute("role", "group");
    seletor.setAttribute("aria-label", "Cenário da projeção");
    mpCenarios.forEach(([chave, rotulo]) => {
      const botao = element("button", "mp-cenario", rotulo);
      botao.type = "button";
      botao.setAttribute("aria-pressed", String(chave === escolhido.cenario));
      botao.addEventListener("click", () => { mpCenario = chave; renderMedPainel(mpUltimoBloco || block); const novo = byId("medpainel-content").querySelector('.mp-cenario[aria-pressed="true"]'); if (novo) novo.focus(); });
      seletor.append(botao);
    });
    caminho.append(seletor);

    const linhaDoze = escolhido.linhas.find((linha) => linha.mes === 12) || escolhido.linhas[escolhido.linhas.length - 1];
    const indice500 = mpMarcos.indexOf(500), indiceMeta = mpMarcos.indexOf(escolhido.meta);
    const numeros = element("div", "mp-numeros");
    numeros.append(
      mpBlocoNumero("Assinantes no mês " + (linhaDoze ? linhaDoze.mes : 12), linhaDoze ? mpInteiro.format(Math.round(linhaDoze.assinantes)) : "—"),
      mpBlocoNumero("Chega a 500 no", escolhido.marcos[indice500] ? "mês " + escolhido.marcos[indice500] : "não chega", "primeira meta"),
      mpBlocoNumero("Chega a " + mpCompacto(escolhido.meta) + " no", escolhido.chegou ? "mês " + escolhido.linhas.length : "não chega em " + escolhido.linhas.length + " meses", "o objetivo"),
      mpBlocoNumero("Lucro do mês " + (linhaDoze ? linhaDoze.mes : 12), linhaDoze ? mpReais.format(linhaDoze.lucro) : "—", linhaDoze && linhaDoze.socios.length ? linhaDoze.socios.map((socio) => (socio.nome.length > 12 ? socio.nome.split(" ")[0] : socio.nome) + " " + mpReais.format(socio.valor)).join(" · ") : "a sociedade não soma 100%")
    );
    caminho.append(numeros);
    caminho.append(mpLegenda(mpCenarios.map(([chave, rotulo]) => [rotulo + (chave === escolhido.cenario ? " (escolhido)" : ""), chave === escolhido.cenario ? "mp-chave-acento" : "mp-chave-contexto" + (chave === "pessimista" ? " mp-chave-tracejada" : "")])));
    caminho.append(mpGraficoAssinantes(projecoes, escolhido));
    const teto = Number.isFinite(escolhido.teto)
      ? "Com perda de " + mpInteiro.format(escolhido.churn * 100) + "% ao mês e indicação de " + mpInteiro.format(escolhido.indicacao * 100) + "%, as entradas que não dependem da base (" + mpInteiro.format(Math.round(escolhido.fixasFim)) + " por mês no fim da projeção) sustentam no máximo cerca de " + mpInteiro.format(Math.round(escolhido.teto)) + " assinantes. Para sustentar " + mpCompacto(escolhido.meta) + ", elas precisam chegar a " + mpInteiro.format(Math.ceil(escolhido.meta * (escolhido.churn - escolhido.indicacao))) + " por mês."
      : "Neste cenário a indicação boca a boca supera a perda: a base cresce sem teto enquanto as premissas valerem.";
    caminho.append(element("p", "mp-teto", teto));
    target.append(caminho);

    const dinheiro = mpSecao("Dinheiro mês a mês (cenário " + mpCenarios.find(([chave]) => chave === escolhido.cenario)[1].toLowerCase() + ")", "Resultado = receita − meses grátis − taxas − impostos − custo fixo da empresa e do produto − comissões − verba do mês. Metade do resultado positivo vira verba do mês seguinte; a outra metade é o lucro dos sócios. Abaixo de zero, é aporte.");
    const fixo = mpCustoFixoEmpresa(block, mpPremissa(block, "cambio", escolhido.cenario, 5.3));
    dinheiro.append(element("p", "mp-secao-texto", "Custo fixo carregado: empresa " + mpReais.format(escolhido.fixoEmpresa) + " por mês (planos ativos" + (fixo.semConversao.length ? "; sem conversão: " + fixo.semConversao.join(", ") : "") + (block.incomplete_costs ? "; " + block.incomplete_costs + " plano(s) sem valor confirmado ficaram de fora" : "") + ") + produto " + mpReais.format(escolhido.fixoProduto) + " por mês."));
    dinheiro.append(mpLegenda([["Resultado positivo", "mp-chave-positiva mp-chave-barra"], ["Aporte necessário", "mp-chave-negativa mp-chave-barra"]]));
    dinheiro.append(mpGraficoResultado(escolhido));
    const nomes = array(block.socios).map((socio) => socio.nome);
    const colunas = ["Mês", "Assinantes", "Entradas", "Perdas", "Receita", "Taxas e impostos", "Custo fixo", "Aquisição", "Resultado", "Verba do mês seguinte", "Lucro"].concat(nomes, ["Aporte"]);
    const linhasTabela = escolhido.linhas.map((linha) => {
      const registro = {"Mês": String(linha.mes), "Assinantes": mpInteiro.format(Math.round(linha.assinantes)), "Entradas": mpInteiro.format(Math.round(linha.entradas)), "Perdas": mpInteiro.format(Math.round(linha.perdas)),
        "Receita": mpReais.format(linha.bruta - linha.mesesGratis), "Taxas e impostos": mpReais.format(linha.taxas + linha.impostos), "Custo fixo": mpReais.format(linha.fixo),
        "Aquisição": mpReais.format(linha.comissao + linha.verba), "Resultado": mpReais.format(linha.resultado), "Verba do mês seguinte": mpReais.format(linha.proximaVerba), "Lucro": mpReais.format(linha.lucro), "Aporte": linha.aporte ? mpReais.format(linha.aporte) : "—"};
      nomes.forEach((nome) => { const socio = linha.socios.find((item) => item.nome === nome); registro[nome] = socio ? mpCentavos.format(socio.valor) : "—"; });
      return registro;
    });
    const detalhes = element("details", "mp-detalhes");
    detalhes.append(element("summary", "", "Ver a projeção mês a mês"), table(colunas, linhasTabela, "Projeção do Med Painel mês a mês"));
    dinheiro.append(detalhes);
    target.append(dinheiro);

    const marcos = mpSecao("Metas", "Em que mês cada cenário passa por cada marco.");
    marcos.append(table(["Marco"].concat(mpCenarios.map(([, rotulo]) => rotulo)), mpMarcos.map((marco, indice) => {
      const registro = {"Marco": mpInteiro.format(marco) + " assinantes"};
      mpCenarios.forEach(([chave, rotulo], posicao) => { const mes = projecoes[posicao].marcos[indice]; registro[rotulo] = mes ? "mês " + mes : "não chega"; });
      return registro;
    }), "Metas por cenário"));
    target.append(marcos);

    const base = mpSecao("Premissas", "Do arquivo MED-PAINEL-PREMISSAS.csv. Troque um número ali e a projeção inteira se refaz. \"Chute\" quer dizer que ainda não foi medido.");
    base.append(table(["Premissa", "Pessimista", "Base", "Otimista", "Unidade", "Fonte"], Object.values(premissas).map((item) => ({
      "Premissa": item.nome || "", "Pessimista": item.pessimista === null || item.pessimista === undefined ? "—" : String(item.pessimista).replace(".", ","),
      "Base": item.base === null || item.base === undefined ? "—" : String(item.base).replace(".", ","), "Otimista": item.otimista === null || item.otimista === undefined ? "—" : String(item.otimista).replace(".", ","),
      "Unidade": item.unidade || "", "Fonte": typeof item.origem === "string" ? item.origem : ""})), "Premissas da projeção"));
    target.append(base);

    const decisoes = array(block.decisoes && block.decisoes.rows);
    if (decisoes.length) {
      const registro = mpSecao("Decisões do Bauer", "Registro só de acréscimo, em MED-PAINEL-DECISOES.md.");
      registro.append(table(block.decisoes.columns, decisoes, "Decisões do Bauer sobre o Med Painel"));
      target.append(registro);
    }

    mpMesaDeTeste(target);
  }

  // Exposto para a prova automática da conta (sem efeito na tela).
  window.financeMedPainel = {projetar: projetarMedPainel, repartir: mpRepartir};

  // Laboratório: a galeria de maquetes vive num iframe isolado (sandbox só com scripts), carregado na primeira visita.
  // O tema viaja no fragmento (#tema=claro|escuro): trocar só o fragmento dispara hashchange dentro do iframe, sem recarregar.
  // A URL de cada página pode chegar na hora ou numa Promise (no portal ela vem do repositório): a última abertura pedida
  // vence, e a URL resolvida fica guardada por arquivo, para a troca de tema só mexer no fragmento.
  // Cada maquete do catálogo tem também a página de tela cheia (apps/<id>/, pública): o link fica na barra, e a mensagem
  // {portal: "tela-cheia"} da moldura (que não pode abrir abas) pede ao portal para abri-la numa aba nova.
  let labFile = "index.html";
  let labPedido = 0;
  const labBases = new Map();
  const labFilePattern = /^(index\.html|apps\/[a-z0-9-]+\.html)$/;
  const labDicas = {
    indice: "Cada maquete abre em tela cheia a partir do stand: é o jeito de vê-la como app no iPhone.",
    iphone: "No iPhone: abra o link, toque em Compartilhar e em Adicionar à Tela de Início para usar como app.",
    semTelaCheia: "Esta página ainda não tem versão em tela cheia."
  };
  function currentTheme() { return document.documentElement.getAttribute("data-tema") === "escuro" ? "escuro" : "claro"; }
  async function labBase(file) {
    if (labBases.has(file)) return labBases.get(file);
    const base = typeof host().galeriaUrl === "function" ? String(await host().galeriaUrl(file)) : new URL("galeria/" + file, location.href).href;
    labBases.set(file, base);
    return base;
  }
  function labUrl(base) { return base + "#tema=" + currentTheme(); }
  async function labTitle(file) {
    const fallback = file === "index.html" ? "Galeria de maquetes" : "Maquete: " + file.replace(/^apps\//, "").replace(/\.html$/, "");
    if (typeof host().galeriaTitle !== "function") return fallback;
    try { const title = await host().galeriaTitle(file); return title ? text(title) : fallback; } catch (_) { return fallback; }
  }
  async function labTelaCheia(file) {
    if (file === "index.html" || typeof host().galeriaTelaCheia !== "function") return "";
    try {
      const valor = await host().galeriaTelaCheia(file);
      if (!valor) return "";
      const url = new URL(String(valor), location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (_) { return ""; }
  }
  // a linha de aviso da barra: erro (padrão) ou informação (informativo = true); vazio esconde
  function labAviso(value, informativo = false) {
    const aviso = byId("lab-aviso");
    if (!aviso) return;
    aviso.textContent = value ? text(value) : "";
    aviso.hidden = !value;
    aviso.classList.toggle("lab-aviso-erro", Boolean(value) && !informativo);
  }
  // a barra conforme a página aberta: índice (dica da tela cheia), maquete com tela cheia (link, copiar, iPhone) ou sem
  function labBarra(file, title, telaCheia) {
    byId("lab-back").hidden = file === "index.html";
    byId("lab-current").textContent = title;
    const link = byId("lab-tela-cheia");
    link.classList.remove("lab-destaque");
    if (telaCheia) link.href = telaCheia; else link.removeAttribute("href");
    link.title = telaCheia ? "Abre numa aba nova, sem senha (dados fictícios): " + telaCheia : "";
    byId("lab-acoes").hidden = !telaCheia;
    const copiar = byId("lab-copiar");
    copiar.textContent = "Copiar link";
    const dica = byId("lab-dica");
    dica.textContent = file === "index.html" ? labDicas.indice : telaCheia ? labDicas.iphone : labDicas.semTelaCheia;
  }
  async function openLab(file) {
    const frame = byId("lab-frame");
    if (!frame || !labFilePattern.test(file)) return false;
    const pedido = ++labPedido;
    let base, title, telaCheia;
    try {
      base = await labBase(file);
      [title, telaCheia] = await Promise.all([labTitle(file), labTelaCheia(file)]);
    } catch (error) {
      if (pedido === labPedido && frame === byId("lab-frame")) labAviso(error && error.message ? error.message : "Não foi possível abrir esta página do Laboratório.");
      return false;
    }
    // outra abertura passou na frente, ou o Laboratório foi fechado (saída) enquanto esta esperava
    if (pedido !== labPedido || frame !== byId("lab-frame")) return false;
    labFile = file;
    frame.src = labUrl(base);
    labBarra(file, title, telaCheia);
    labAviso("");
    return true;
  }
  async function copyLabLink() {
    const link = byId("lab-tela-cheia"), copiar = byId("lab-copiar");
    if (!link || !link.href) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error();
      const copiado = link.href;
      await navigator.clipboard.writeText(copiado);
      copiar.textContent = "Link copiado";
      labAviso("");
      announce("Link copiado. Ele abre sem senha; os dados são fictícios.");
      setTimeout(() => { if (byId("lab-copiar") === copiar && link.href === copiado) copiar.textContent = "Copiar link"; }, 2500);
    } catch (_) { labAviso("Não deu para copiar aqui. Toque e segure em Abrir em tela cheia para copiar o link.", true); }
  }
  // a moldura pediu a tela cheia: abre uma aba agora (ainda dentro do toque) e só depois aponta para a página;
  // se o navegador bloquear a aba, mostra a maquete no stand com o link da barra em destaque
  async function openLabFullScreen(file) {
    let aba = null;
    // host sem tela cheia (o AI Cask): nem abre a aba, vai direto ao stand
    if (typeof host().galeriaTelaCheia === "function") { try { aba = window.open("", "_blank"); } catch (_) { aba = null; } }
    if (aba) { try { aba.opener = null; } catch (_) {} }
    const url = await labTelaCheia(file);
    if (url && aba) { aba.location.replace(url); return; }
    if (aba) { try { aba.close(); } catch (_) {} }
    if (labFile !== file) await openLab(file);
    if (labFile !== file) return;
    const link = byId("lab-tela-cheia");
    if (!url || !link || !link.href) { labAviso(labDicas.semTelaCheia, true); return; }
    link.classList.add("lab-destaque");
    link.closest(".lab-bar").scrollIntoView({block: "nearest"});
    link.focus({preventScroll: true});
    labAviso("O navegador não abriu a aba nova. Toque em Abrir em tela cheia, aqui em cima.", true);
  }
  function renderLab() {
    if (byId("lab-frame") || host().galeria !== true) return;
    const target = byId("lab-content");
    clear(target);
    const bar = element("div", "lab-bar");
    const linha = element("div", "lab-linha");
    const back = button("← Índice", "button-outline", () => openLab("index.html"));
    back.id = "lab-back";
    const current = element("span", "lab-title");
    current.id = "lab-current";
    const acoes = element("div", "lab-acoes");
    acoes.id = "lab-acoes";
    acoes.hidden = true;
    const link = element("a", "button button-primary lab-tela-cheia", "Abrir em tela cheia ↗");
    link.id = "lab-tela-cheia";
    link.target = "_blank";
    link.rel = "noopener";
    link.addEventListener("click", () => { link.classList.remove("lab-destaque"); labAviso(""); });
    const copiar = button("Copiar link", "button-outline", copyLabLink);
    copiar.id = "lab-copiar";
    acoes.append(link, copiar);
    linha.append(back, current, acoes);
    const dica = element("p", "lab-dica");
    dica.id = "lab-dica";
    const aviso = element("p", "lab-aviso");
    aviso.id = "lab-aviso";
    aviso.setAttribute("role", "status");
    aviso.hidden = true;
    bar.append(linha, dica, aviso);
    const frame = element("iframe", "lab-frame");
    frame.id = "lab-frame";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.title = "Galeria de maquetes";
    target.append(bar, frame);
    openLab("index.html");
  }
  function clearLab() {
    const frame = byId("lab-frame");
    if (frame) frame.remove();
    if (byId("lab-content")) clear(byId("lab-content"));
    labFile = "index.html";
    labPedido += 1;
    labBases.clear();
  }
  window.addEventListener("message", (event) => {
    const frame = byId("lab-frame");
    if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return;
    const file = String(event.data.file || "");
    if (event.data.portal === "abrir") openLab(file);
    else if (event.data.portal === "tela-cheia" && labFilePattern.test(file)) openLabFullScreen(file);
  });
  new MutationObserver(() => {
    const frame = byId("lab-frame");
    const base = labBases.get(labFile);
    if (frame && base && frame.src !== labUrl(base)) frame.src = labUrl(base);
  }).observe(document.documentElement, {attributes: true, attributeFilter: ["data-tema"]});

  function capturePagePosition(key) {
    const page = document.querySelector('[data-finance-page="' + key + '"]');
    const position = {top: window.scrollY, tables: page ? [...page.querySelectorAll(".table-scroll")].map((node) => ({left: node.scrollLeft, top: node.scrollTop})) : []};
    pagePositions.set(key, position);
    return position;
  }

  function resetHeaderScroll() {
    headerLastY = Math.max(0, window.scrollY);
    headerTravel = 0;
    headerDirection = 0;
  }

  function holdHeaderScroll(reveal = false) {
    headerScrollSuspended = true;
    if (headerScrollFrame) cancelAnimationFrame(headerScrollFrame);
    if (headerResumeFrame) cancelAnimationFrame(headerResumeFrame);
    headerScrollFrame = 0;
    headerResumeFrame = 0;
    if (reveal) {
      byId("app-header").classList.add("is-scroll-resetting");
      byId("app-header").classList.remove("is-scroll-hidden");
    }
    resetHeaderScroll();
  }

  function resumeHeaderScroll() {
    if (headerResumeFrame) cancelAnimationFrame(headerResumeFrame);
    // Let layout restoration and its scroll event settle before tracking direction.
    headerResumeFrame = requestAnimationFrame(() => {
      headerResumeFrame = requestAnimationFrame(() => {
        headerResumeFrame = 0;
        headerScrollSuspended = false;
        byId("app-header").classList.remove("is-scroll-resetting");
        resetHeaderScroll();
      });
    });
  }

  function revealHeader() {
    holdHeaderScroll(true);
    resumeHeaderScroll();
  }

  function updateHeaderFromScroll() {
    headerScrollFrame = 0;
    const y = Math.max(0, window.scrollY);
    const header = byId("app-header");
    const delta = y - headerLastY;
    headerLastY = y;
    if (headerScrollSuspended) return;
    const pinned = !authenticated || mustChangePassword || byId("dashboard").hidden ||
      document.querySelector("dialog[open]") ||
      (keyboardNavigation && header.contains(document.activeElement));
    if (pinned || y <= headerTopThreshold) {
      header.classList.remove("is-scroll-hidden");
      resetHeaderScroll();
      return;
    }
    if (!delta) return;
    const direction = Math.sign(delta);
    if (direction !== headerDirection) headerTravel = 0;
    headerDirection = direction;
    headerTravel += Math.abs(delta);
    if (headerTravel >= headerScrollThreshold) {
      header.classList.toggle("is-scroll-hidden", direction > 0);
      headerTravel = 0;
    }
  }

  function onHeaderScroll() {
    if (!headerScrollFrame) headerScrollFrame = requestAnimationFrame(updateHeaderFromScroll);
  }

  function restorePagePosition(key, position) {
    if (key !== activePage) return;
    const page = document.querySelector('[data-finance-page="' + key + '"]');
    array(position && position.tables).forEach((saved, index) => {
      const table = page && page.querySelectorAll(".table-scroll")[index];
      if (table) { table.scrollLeft = saved.left; table.scrollTop = saved.top; }
    });
    window.scrollTo({top: position ? position.top : 0, behavior: "auto"});
    resumeHeaderScroll();
  }

  function updateNavigation() {
    const page = pages[activePage] || pages.overview || {title: "", description: ""};
    byId("dashboard-title").textContent = page.title;
    byId("page-description").textContent = page.description;
    document.querySelectorAll("[data-navigate]").forEach((button) => {
      if (button.dataset.navigate === activePage) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  // ── o mapa: a gaveta montada pelo registro, as rotas por hash e as páginas registradas em tempo de execução ─────────
  // Visível: a página está no registro e, se pede uma capacidade do host (requer: "galeria"), o host a liga.
  function entradaDe(key) { return registro.find((entrada) => entrada.chave === key) || null; }
  function paginaVisivel(entrada) { return Boolean(entrada) && (!entrada.requer || host()[entrada.requer] === true); }
  // Um rótulo por grupo (Dinheiro · Planejar · Empresa · Ajuda) e os botões na ordem do registro, numerados pela ordem
  // visível (01, 02…). Os cliques chegam por delegação (data-navigate), então remontar não exige religar nada.
  function montarGaveta() {
    const nav = byId("drawer-nav");
    if (!nav) return;
    clear(nav);
    let numero = 0;
    const ordem = new Set([...grupos, ...registro.map((entrada) => entrada.grupo)]);
    for (const grupo of ordem) {
      const doGrupo = registro.filter((entrada) => entrada.grupo === grupo && paginaVisivel(entrada));
      if (!doGrupo.length) continue;
      nav.append(element("p", "nav-grupo", grupo));
      for (const entrada of doGrupo) {
        entrada.numero = String(++numero).padStart(2, "0");
        const botao = document.createElement("button");
        botao.type = "button";
        botao.id = "nav-" + entrada.chave;
        botao.dataset.navigate = entrada.chave;
        const indice = element("span", "nav-index", entrada.numero);
        const seta = element("span", "nav-arrow", "↗");
        indice.setAttribute("aria-hidden", "true");
        seta.setAttribute("aria-hidden", "true");
        botao.append(indice, element("span", "", entrada.titulo), seta);
        nav.append(botao);
      }
    }
    registro.forEach((entrada) => { if (!paginaVisivel(entrada)) entrada.numero = null; });
    updateNavigation();
  }

  // A rota da página ativa; o hash sai sempre do registro (rotas.montar), nunca do que está na tela.
  let rotaAtiva = {chave: "overview", args: [], filtros: {}, hash: ""};
  let hashPendente = "";   // rota pedida na entrada que nenhuma página registrou ainda (um módulo que chega depois)
  function escreverHistorico(hash, historia) {
    if (!hash || historia === "nenhum") return;
    try {
      if (historia === "push") { if (location.hash !== hash) history.pushState({financeRota: hash}, "", hash); }
      else history.replaceState({financeRota: hash}, "", hash);
    } catch (_) { /* host sem histórico (arquivo local num WebView): a página troca do mesmo jeito, só sem endereço */ }
  }
  function definirRota(key, args, filtros, historia, origem) {
    const hash = rotas.montar(key, args, filtros);
    const lida = rotas.ler(hash) || {args: [], filtros: {}};
    rotaAtiva = {chave: key, args: lida.args, filtros: lida.filtros, hash};
    escreverHistorico(hash, historia);
    const entrada = entradaDe(key);
    document.dispatchEvent(new CustomEvent("financeiro:rota", {detail: {pagina: key, rota: entrada ? entrada.rota : key, args: [...lida.args], filtros: {...lida.filtros}, origem}}));
  }

  // navigate(chave, foco, {args, filtros, historia, origem}) mostra a página e escreve o endereço: "push" empilha (o
  // Voltar do navegador volta para cá), "replace" troca (entrada e filtros), "nenhum" não mexe. Avisa as páginas por
  // "financeiro:rota". Devolve false se a página não existe ou não está visível (ex.: Laboratório sem galeria).
  function navigate(key, focus = true, opcoes = {}) {
    if (!authenticated || !Object.prototype.hasOwnProperty.call(pages, key) || !paginaVisivel(entradaDe(key))) return false;
    const {args = [], filtros = {}, historia = "push", origem = "navegacao"} = opcoes && typeof opcoes === "object" ? opcoes : {};
    hashPendente = "";
    holdHeaderScroll(true);
    capturePagePosition(activePage);
    activePage = key;
    if (key === "lab") renderLab();
    document.querySelectorAll("[data-finance-page]").forEach((page) => { page.hidden = page.dataset.financePage !== key; });
    updateNavigation();
    closeNavigation(false);
    requestAnimationFrame(() => {
      restorePagePosition(key, pagePositions.get(key));
      if (focus) byId("dashboard-title").focus({preventScroll: true});
    });
    definirRota(key, args, filtros, historia, origem);
    return true;
  }

  // #lancar (atalho "Lançar gasto" do PWA, ou um link): a folha "+ Lançar" abre por cima da página atual e o endereço
  // volta a ser o da página, para recarregar não reabrir a folha. Se o livro.js ainda não carregou, ele abre ao carregar.
  function abrirLancarSobre() {
    escreverHistorico(rotaAtiva.hash || rotas.montar(activePage), "replace");
    if (window.financeLivro && typeof window.financeLivro.abrirLancar === "function") window.financeLivro.abrirLancar();
    else window.financeLancarPendente = true;
  }

  // Depois da senha: a página do endereço com que se chegou (link direto ou atalho do PWA), trocando a entrada.
  function aplicarRotaDeEntrada() {
    if (!authenticated || mustChangePassword) return;
    const hash = location.hash;
    const lida = rotas.ancora && rotas.ancora(hash) ? null : rotas.ler(hash);
    if (lida && lida.chave && navigate(lida.chave, false, {args: lida.args, filtros: lida.filtros, historia: "replace", origem: "entrada"})) return;
    navigate("overview", false, {historia: "replace", origem: "entrada"});
    if (lida && lida.acao === "lancar") abrirLancarSobre();
    else if (lida && !lida.chave) hashPendente = hash;
  }

  // O endereço mudou fora do app (Voltar, Avançar, um link #… ou o endereço editado à mão): mostra a página dele sem
  // empilhar. O popstate e o hashchange do mesmo passo chegam os dois: o segundo encontra a rota já aplicada.
  function aplicarEndereco() {
    if (!authenticated || mustChangePassword || (rotas.ancora && rotas.ancora(location.hash))) return;
    const lida = rotas.ler(location.hash);
    if (lida && lida.acao === "lancar") { abrirLancarSobre(); return; }
    if (lida && lida.chave && paginaVisivel(entradaDe(lida.chave))) {
      if (lida.chave === activePage && rotas.montar(lida.chave, lida.args, lida.filtros) === rotaAtiva.hash) return;
      navigate(lida.chave, true, {args: lida.args, filtros: lida.filtros, historia: "replace", origem: "endereco"});
      return;
    }
    navigate("overview", true, {historia: "replace", origem: "endereco"});
  }

  // Uma página troca os próprios filtros (mês, sócia, parâmetro aberto): o endereço acompanha, sem empilhar.
  function atualizarRota({pagina = activePage, args = [], filtros = {}} = {}) {
    if (!authenticated || pagina !== activePage) return false;
    definirRota(activePage, args, filtros, "replace", "pagina");
    return true;
  }

  // Página nova em tempo de execução (a fase 3 não edita app.js nem index.html): cria a <section> (ou usa a do
  // index.html com o mesmo data-finance-page), o botão na gaveta (numeração refeita), a rota e o "Como ler esta página".
  // Devolve {chave, rota, secao, conteudo}; o desenho fica com o módulo (por exemplo, registrarPagina do livro.js).
  function registrarPaginaNova(definicao) {
    const d = definicao && typeof definicao === "object" ? definicao : {};
    const chave = String(d.chave || ""), rota = String(d.rota || d.chave || "");
    const formato = /^[a-z][a-z0-9-]{1,39}$/;
    if (!formato.test(chave)) throw new Error("financeRegistrarPagina: chave inválida (“" + chave + "”): use letras minúsculas, números e hífen.");
    if (!formato.test(rota) || array(rotas.acoes).includes(rota)) throw new Error("financeRegistrarPagina: rota inválida (“" + rota + "”).");
    if (entradaDe(chave) || Object.prototype.hasOwnProperty.call(pages, chave)) throw new Error("financeRegistrarPagina: já existe uma página com a chave “" + chave + "”.");
    if (registro.some((entrada) => entrada.rota === rota)) throw new Error("financeRegistrarPagina: a rota “#" + rota + "” já é de outra página.");
    const grupo = grupos.find((nome) => nome.toLowerCase() === String(d.grupo || "").toLowerCase());
    if (!grupo) throw new Error("financeRegistrarPagina: grupo desconhecido (“" + d.grupo + "”). Os grupos são " + grupos.join(", ") + ".");
    const titulo = typeof d.titulo === "string" ? d.titulo.trim() : "";
    if (!titulo || titulo.length > 60) throw new Error("financeRegistrarPagina: o título é obrigatório e tem até 60 letras.");
    const ajuda = d.ajuda && typeof d.ajuda === "object" ? d.ajuda : {};
    const entrada = {chave, rota, grupo, numero: null, titulo, descricao: typeof d.descricao === "string" ? d.descricao : "",
      ajuda: {oque: String(ajuda.oque || ""), deonde: String(ajuda.deonde || ""), naoe: String(ajuda.naoe || "")},
      args: array(d.args).map(String), filtros: array(d.filtros).map(String), ...(typeof d.requer === "string" && d.requer ? {requer: d.requer} : {})};
    const depoisDe = typeof d.depoisDe === "string" && formato.test(d.depoisDe) ? d.depoisDe : "";
    let posicao = depoisDe ? registro.findIndex((item) => item.chave === depoisDe) + 1 : 0;
    if (posicao <= 0) {
      const doGrupo = registro.map((item, k) => (item.grupo === grupo ? k : -1)).filter((k) => k >= 0);
      posicao = doGrupo.length ? doGrupo[doGrupo.length - 1] + 1 : registro.length;
    }
    registro.splice(posicao, 0, entrada);
    paginaDoRegistro(entrada);
    let secao = document.querySelector('[data-finance-page="' + chave + '"]');
    if (!secao) {
      secao = element("section", "finance-page");
      secao.id = "block-" + chave;
      secao.dataset.financePage = chave;
      secao.setAttribute("aria-labelledby", chave + "-title");
      const cabecalho = element("div", "section-heading"), bloco = element("div");
      const h2 = element("h2", "", titulo);
      h2.id = chave + "-title";
      bloco.append(element("p", "section-number", String(d.eyebrow || grupo).toLocaleUpperCase("pt-BR")), h2);
      cabecalho.append(bloco);
      const conteudo = element("div");
      conteudo.id = chave + "-content";
      secao.append(cabecalho, conteudo);
      const vizinha = depoisDe && document.querySelector('[data-finance-page="' + depoisDe + '"]');
      if (vizinha) vizinha.after(secao); else byId("dashboard").querySelector(".page-footer").before(secao);
    }
    secao.hidden = activePage !== chave;
    montarGaveta();
    const pendente = hashPendente && rotas.ler(hashPendente);
    if (pendente && pendente.chave === chave && activePage === "overview") navigate(chave, true, {args: pendente.args, filtros: pendente.filtros, historia: "replace", origem: "entrada"});
    return {chave, rota, secao, conteudo: byId(chave + "-content") || secao};
  }

  function openNavigation() {
    if (!authenticated) return;
    revealHeader();
    drawerReturnFocus = byId("menu-button");
    const drawer = byId("navigation-drawer");
    if (!drawer.open) drawer.showModal();
    byId("menu-button").setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("drawer-open");
    const active = drawer.querySelector('[aria-current="page"]');
    (active || byId("menu-close")).focus();
  }

  function closeNavigation(restoreFocus = true) {
    revealHeader();
    const drawer = byId("navigation-drawer");
    if (drawer.open) drawer.close();
    document.documentElement.classList.remove("drawer-open");
    byId("menu-button").setAttribute("aria-expanded", "false");
    if (restoreFocus) (drawerReturnFocus && drawerReturnFocus.isConnected ? drawerReturnFocus : byId("menu-button")).focus({preventScroll: true});
  }

  function renderSnapshot(snapshot, force) {
    if (!snapshot || typeof snapshot !== "object" || !snapshot.blocks) return;
    currentSnapshot = snapshot;
    window.financeState = snapshot;
    if (!force && snapshot.content_revision === revision) return;
    const generation = ++renderGeneration;
    revision = snapshot.content_revision;
    holdHeaderScroll();
    const renderingPage = activePage;
    const position = capturePagePosition(renderingPage);
    const focusedId = document.activeElement && document.activeElement.id;
    const blocks = snapshot.blocks;
    renderOverview(blocks.user || {}, snapshot.user || {});
    // com folha ou formulário aberto, Assinaturas e Vender primeiro esperam: desenham ao fechar (flushPendingRender)
    if (subscriptionsBusy()) pendingRender.subscriptions = true; else renderSubscriptions(blocks.user || {}, snapshot.user || {});
    if (sellingBusy()) pendingRender.selling = true; else renderSelling(blocks.sell_first || {});
    renderInventory(blocks.inventory || {}, blocks.atlas || snapshot.atlas);
    renderCash(blocks.cash || {});
    renderProjection(blocks.projection || {});
    renderSociety(blocks.society || {});
    renderMedPainel(blocks.medpainel || {});
    if (typeof window.financeLivroRender === "function") window.financeLivroRender(snapshot);
    byId("reading-state").textContent = "Leitura às " + new Intl.DateTimeFormat("pt-BR", {hour: "2-digit", minute: "2-digit"}).format(new Date());
    const scheduledFocusGeneration = focusGeneration;
    const scheduledFocus = document.activeElement;
    requestAnimationFrame(() => {
      if (generation !== renderGeneration) return;
      restorePagePosition(renderingPage, position);
      if (focusGeneration !== scheduledFocusGeneration || document.activeElement !== scheduledFocus) return;
      const focused = focusedId && byId(focusedId);
      if (focused && focused.closest('[data-finance-page]') && !focused.closest('[data-finance-page]').hidden) focused.focus({preventScroll: true});
    });
  }

  async function loadSnapshot(force = false) {
    if (!authenticated || mustChangePassword) return;
    if (snapshotBusy) { if (force) snapshotQueued = true; return; }
    snapshotBusy = true;
    const generation = sessionGeneration;
    try {
      const snapshot = await window.financeRequest("snapshot", !force && revision ? {if_revision: revision} : {});
      if (!authenticated || generation !== sessionGeneration) return;
      if (snapshot && snapshot.unchanged === true) {
        byId("reading-state").textContent = "Leitura às " + new Intl.DateTimeFormat("pt-BR", {hour: "2-digit", minute: "2-digit"}).format(new Date());
        return;
      }
      if (snapshot.must_change_password) { showPassword(true); return; }
      renderSnapshot(snapshot, force);
      message("dashboard-error", sessionNotice);
    } catch (failure) {
      if (generation !== sessionGeneration) return;
      if (failure.code === "password_change_required") showPassword(true);
      else if (failure.code === "unauthenticated" || failure.code === "no_account") {
        resetSession(); message("login-error", failure.message);
      } else message("dashboard-error", failure.message);
    } finally {
      snapshotBusy = false;
      if (snapshotQueued && authenticated && !mustChangePassword) {
        snapshotQueued = false;
        queueMicrotask(() => loadSnapshot(true));
      }
    }
  }

  // "Como ler esta página" (A1): diálogo leve com as três linhas da página ativa; ao fechar, o foco volta ao botão "?".
  function openPageHelp() {
    const page = pages[activePage] || pages.overview;
    const help = page.help || {};
    byId("page-help-title").textContent = page.title;
    byId("page-help-what").textContent = help.what || "—";
    byId("page-help-from").textContent = help.from || "—";
    byId("page-help-not").textContent = help.not || "—";
    revealHeader();
    if (!byId("page-help-dialog").open) byId("page-help-dialog").showModal();
    byId("page-help-title").focus();
  }
  function closePageHelp() {
    if (byId("page-help-dialog").open) byId("page-help-dialog").close();
    byId("page-help").focus({preventScroll: true});
  }

  function showPassword(required) {
    revealHeader();
    mustChangePassword = required;
    byId("password-title").textContent = required ? "Defina sua senha" : "Trocar senha";
    byId("password-description").textContent = required ? "Para o primeiro acesso, crie uma senha pessoal de pelo menos 8 caracteres. Informe também a senha atual." : "Escolha uma senha diferente da atual, com pelo menos 8 caracteres.";
    byId("password-cancel").textContent = required ? "Sair" : "Cancelar";
    message("password-error", "");
    byId("change-form").reset();
    if (!byId("password-dialog").open) byId("password-dialog").showModal();
    byId("change-current").focus();
  }

  async function enterSession(result) {
    if (!result || !result.user) return;
    sessionGeneration += 1;
    authenticated = true;
    sessionNotice = result.remember_error ? "Você entrou, mas não foi possível lembrar a sessão neste Mac. Ao reabrir, entre novamente." : "";
    byId("login-form").reset();
    message("login-error", "");
    if (result.must_change_password) {
      showPassword(true);
      if (sessionNotice) message("password-error", sessionNotice);
      return;
    }
    mustChangePassword = false;
    byId("login-view").hidden = true;
    byId("entry-masthead").hidden = true;
    byId("dashboard").hidden = false;
    await loadSnapshot(true);
    aplicarRotaDeEntrada();
    byId("dashboard-title").focus();
  }

  function resetSession() {
    renderGeneration += 1;
    revealHeader();
    sessionGeneration += 1;
    authenticated = false;
    mustChangePassword = false;
    editingPlan = null;
    currentSnapshot = null;
    sessionNotice = "";
    snapshotQueued = false;
    window.financeState = null;
    revision = null;
    inventoryBarrier = "";
    inventorySort = "ready-desc";
    inventorySearch = "";
    atlasCurrent = null;
    atlasView = null; atlasSignature = null;
    atlasSelectedId = null;
    atlasRenderedDetail = null;
    atlasReturnFocus = null;
    atlasReturnAssetId = null;
    comparisonIds.clear(); atlasOrder = "name"; closeComparison(false);
    detailListPages.clear();
    if (comparisonDialog) { comparisonDialog.remove(); comparisonDialog = null; }
    comparisonReturnFocus = null;
    Object.assign(atlasFilter, {query:"",kind:"",category:"",distribution:"",destino:"",tab:"all",page:1});
    if (byId("asset-dialog").open) byId("asset-dialog").close();
    if (byId("page-help-dialog").open) byId("page-help-dialog").close();
    clear(byId("asset-detail-content"));
    if (byId("password-dialog").open) byId("password-dialog").close();
    byId("change-form").reset();
    byId("login-form").reset();
    byId("dashboard").hidden = true;
    byId("login-view").hidden = false;
    byId("entry-masthead").hidden = false;
    activePage = "overview";
    rotaAtiva = {chave: "overview", args: [], filtros: {}, hash: ""};
    hashPendente = "";
    pagePositions.clear();
    updateNavigation();
    document.querySelectorAll("[data-finance-page]").forEach((page) => { page.hidden = page.dataset.financePage !== "overview"; });
    if (byId("navigation-drawer").open) closeNavigation(false);
    ["user", "subscriptions", "sell", "inventory", "cash", "projection", "society", "medpainel"].forEach((name) => {
      clear(byId(name + "-content")); clear(byId(name + "-source"));
    });
    clearLab();
    message("dashboard-error", ""); message("password-error", "");
  }

  async function logout() {
    resetSession();
    try { history.replaceState(null, "", location.pathname + location.search); } catch (_) {}
    try { await window.financeRequest("logout"); announce("Você saiu. A sessão lembrada foi removida deste Mac."); }
    catch (failure) { message("login-error", failure.message); }
    byId("login-cpf").focus();
  }

  function startCooldown(seconds) {
    if (cooldownTimer) clearInterval(cooldownTimer);
    const end = Date.now() + Math.max(1, Number(seconds) || 1) * 1000;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      byId("login-submit").disabled = remaining > 0;
      if (remaining > 0) message("login-error", "Aguarde " + remaining + " s antes de tentar novamente.");
      else { clearInterval(cooldownTimer); cooldownTimer = null; message("login-error", "Você pode tentar novamente."); }
    };
    update(); cooldownTimer = setInterval(update, 1000);
  }

  byId("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!byId("login-form").reportValidity() || byId("login-submit").disabled) return;
    const payload = {cpf: byId("login-cpf").value, password: byId("login-password").value, remember: byId("login-remember").checked};
    byId("login-password").value = "";
    byId("login-submit").disabled = true;
    message("login-error", "");
    try { await enterSession(await window.financeRequest("login", payload)); }
    catch (failure) {
      if (failure.retry_after) startCooldown(failure.retry_after);
      else { message("login-error", failure.message); byId("login-password").focus(); }
    } finally {
      payload.password = ""; payload.cpf = "";
      if (!cooldownTimer) byId("login-submit").disabled = false;
    }
  });

  byId("change-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!byId("change-form").reportValidity() || mutationBusy) return;
    if (byId("change-new").value !== byId("change-confirm").value) {
      message("password-error", "A confirmação precisa ser igual à nova senha."); byId("change-confirm").focus(); return;
    }
    const payload = {current_password: byId("change-current").value, new_password: byId("change-new").value};
    const generation = sessionGeneration;
    byId("change-form").reset();
    byId("password-submit").disabled = true;
    mutationBusy = true;
    message("password-error", "");
    try {
      const result = await window.financeRequest("change_password", payload);
      if (!authenticated || generation !== sessionGeneration) return;
      if (result && result.remember_error) sessionNotice = "Sua senha foi alterada, mas não foi possível atualizar a sessão lembrada neste Mac. Ao reabrir, entre novamente.";
      mustChangePassword = false;
      byId("password-dialog").close();
      byId("login-view").hidden = true;
      byId("entry-masthead").hidden = true;
      byId("dashboard").hidden = false;
      await loadSnapshot(true);
      if (generation === sessionGeneration && authenticated && activePage === "overview" && !rotaAtiva.hash) aplicarRotaDeEntrada();
      announce("Senha atualizada.");
      byId("dashboard-title").focus();
    } catch (failure) {
      message("password-error", failure.message); byId("change-current").focus();
    } finally {
      payload.current_password = ""; payload.new_password = "";
      mutationBusy = false; byId("password-submit").disabled = false;
    }
  });

  byId("password-cancel").addEventListener("click", () => {
    if (mustChangePassword) logout();
    else { byId("change-form").reset(); byId("password-dialog").close(); byId("change-password-button").focus(); }
  });
  byId("password-dialog").addEventListener("cancel", (event) => {
    if (mustChangePassword) event.preventDefault();
    else byId("change-form").reset();
  });
  // No portal, o botão da conta abre a equipe (ponte estática); nos demais hosts, a troca de senha.
  const openAccount = () => (host().team === true && typeof window.financeOpenTeam === "function" ? window.financeOpenTeam() : showPassword(false));
  byId("change-password-button").addEventListener("click", openAccount);
  byId("logout-button").addEventListener("click", logout);
  byId("asset-detail-close").addEventListener("click", closeAssetDetail);
  byId("asset-dialog").addEventListener("cancel", (event) => { event.preventDefault(); closeAssetDetail(); });
  byId("page-help").addEventListener("click", openPageHelp);
  byId("page-help-close").addEventListener("click", closePageHelp);
  byId("page-help-dialog").addEventListener("cancel", (event) => { event.preventDefault(); closePageHelp(); });
  byId("menu-button").addEventListener("click", openNavigation);
  byId("menu-close").addEventListener("click", () => closeNavigation());
  byId("navigation-drawer").addEventListener("cancel", (event) => { event.preventDefault(); closeNavigation(); });
  byId("navigation-drawer").addEventListener("click", (event) => {
    const box = byId("navigation-drawer").getBoundingClientRect();
    if (event.target === byId("navigation-drawer") && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) closeNavigation();
  });
  byId("navigation-drawer").addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...byId("navigation-drawer").querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter((node) => node.getClientRects().length);
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener("click", (event) => {
    const alvo = event.target.closest && event.target.closest("[data-navigate]");
    if (alvo && !alvo.disabled) navigate(alvo.dataset.navigate);
  });
  // "+ Lançar" no topo da gaveta: fecha a gaveta e abre a folha
  if (byId("drawer-lancar")) byId("drawer-lancar").addEventListener("click", () => {
    closeNavigation(false);
    if (window.financeLivro && typeof window.financeLivro.abrirLancar === "function") window.financeLivro.abrirLancar();
  });
  // "Ir para o conteúdo": com o painel aberto, o foco vai ao título da página, sem trocar o endereço nem a página
  const pularParaConteudo = document.querySelector(".skip-link");
  if (pularParaConteudo) pularParaConteudo.addEventListener("click", (event) => {
    if (byId("dashboard").hidden) return;
    event.preventDefault();
    revealHeader();
    byId("dashboard-title").focus();
  });
  window.addEventListener("popstate", aplicarEndereco);
  window.addEventListener("hashchange", aplicarEndereco);
  try { history.scrollRestoration = "manual"; } catch (_) {}
  byId("drawer-password").addEventListener("click", () => { closeNavigation(false); openAccount(); });
  byId("header-toggle").addEventListener("click", () => {
    holdHeaderScroll(true);
    const expanded = byId("header-toggle").getAttribute("aria-expanded") === "true";
    byId("header-toggle").setAttribute("aria-expanded", String(!expanded));
    byId("header-toggle").setAttribute("aria-label", expanded ? "Expandir cabeçalho" : "Recolher cabeçalho");
    byId("header-toggle").firstElementChild.textContent = expanded ? "⌄" : "⌃";
    byId("header-details").hidden = expanded;
    byId("app-header").classList.toggle("is-collapsed", expanded);
    resumeHeaderScroll();
  });
  window.addEventListener("scroll", onHeaderScroll, {passive: true});
  window.addEventListener("resize", revealHeader, {passive: true});
  document.addEventListener("keydown", (event) => {
    keyboardNavigation = true;
    if (event.key === "Tab") revealHeader();
  }, true);
  document.addEventListener("pointerdown", () => { keyboardNavigation = false; }, {passive: true, capture: true});
  document.addEventListener("focusin", (event) => {
    if (byId("app-header").contains(event.target)) revealHeader();
  });
  window.financeNavigate = navigate;
  window.financeAtualizarRota = atualizarRota;
  window.financePaginaAtiva = () => activePage;
  // o registro de verdade troca o provisório do paginas.js e processa o que chegou antes do app.js
  const registrosNaFila = window.financeRegistrarPagina && Array.isArray(window.financeRegistrarPagina.fila) ? window.financeRegistrarPagina.fila : [];
  window.financeRegistrarPagina = registrarPaginaNova;
  window.financeSetVisible = (visible) => {
    nativeVisible = visible === true;
    if (nativeVisible && authenticated && !mustChangePassword && !mutationBusy) loadSnapshot();
  };
  // O ciclo de 2 s: relê o snapshot (o pacote + o diário) e nunca redesenha Assinaturas nem Vender primeiro com uma folha
  // ou o formulário de edição aberto (§3.7): o que mudou nesse meio-tempo se desenha quando ela fecha.
  const pendingRender = {subscriptions: false, selling: false};
  function sheetOpen() {
    const livro = window.financeLivro;
    try { return Boolean(livro && typeof livro.folhaAberta === "function" && livro.folhaAberta()); } catch (_) { return false; }
  }
  function subscriptionsBusy() { return editingPlan !== null || sheetOpen(); }
  function sellingBusy() { return sheetOpen(); }
  function flushPendingRender() {
    if (!authenticated || !currentSnapshot || !currentSnapshot.blocks) return;
    const blocks = currentSnapshot.blocks;
    if (pendingRender.subscriptions && !subscriptionsBusy()) renderSubscriptions(blocks.user || {}, currentSnapshot.user || {});
    if (pendingRender.selling && !sellingBusy()) renderSelling(blocks.sell_first || {});
  }
  setInterval(() => {
    if (authenticated && !mustChangePassword && !mutationBusy && nativeVisible) loadSnapshot();
    flushPendingRender();
  }, 2000);
  // depois de cada gravação (a ponte e as folhas avisam com "financeiro:diario") e quando o diário abre, relê já
  document.addEventListener("financeiro:diario", () => { if (authenticated && !mustChangePassword) loadSnapshot(true); });
  // ao fechar uma folha (o evento close não sobe, mas passa pela captura), desenha o que ficou esperando
  document.addEventListener("close", () => setTimeout(flushPendingRender, 0), true);

  applyHostLabels();
  registrosNaFila.splice(0).forEach((definicao) => {
    try { registrarPaginaNova(definicao); } catch (erro) { console.error(erro); }
  });
  window.financeReady = true;
  window.financeRequest("restore_session").then(enterSession).catch((failure) => {
    if (failure.code === "bridge_unavailable") message("login-error", failure.message);
  });
})();
