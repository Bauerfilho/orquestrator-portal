"use strict";

// Produtos (22/10/2026, pedido do Criador): o painel lateral direito "Produtos", espelho do menu da esquerda, e a página
// de cada produto — o que é, o modelo (gratuito, pago, em construção), a maquete numa moldura isolada e, quando há, o
// app funcionando. Script clássico, carregado entre o paginas.js e o app.js: registra as páginas em tempo de execução
// (window.financeRegistrarPagina, grupo Empresa, depois do Portfólio) e o app.js cria a seção, o botão da gaveta e a
// rota (#ai-swarm, #ai-chat, #calculadora-obstetrica, #calculadora-rcog, #orquestrator). As maquetes moram em produtos/
// (arquivos comuns do site, públicos, só com dados fictícios) e abrem como blob: nesta aba, numa moldura isolada
// (sandbox só com scripts), do mesmo jeito que as páginas da galeria. O Med Painel continua com a página que já tinha.
(() => {
  const PRODUTOS = [
    {chave: "aiswarm", rota: "ai-swarm", titulo: "AI Swarm", eyebrow: "Produto · a frota de IAs trabalhando", estado: "em construção",
      descricao: "A frota de IAs trabalhando ao mesmo tempo, vista de um painel só.",
      ajuda: {oque: "A maquete do painel azul que acompanha a frota: quantos enxames, quantas IAs, quem entregou, quem está em curso e quem falhou.",
        deonde: "Do painel do AI Swarm, repetindo em laço um enxame real de 22/10/2026 capturado do próprio servidor.",
        naoe: "Nenhuma IA real está trabalhando aqui: a maquete repete o que já aconteceu, e nada do que ela mostra pode ser parado ou redisparado."},
      texto: "Quando várias IAs trabalham ao mesmo tempo, o AI Swarm mostra a frota inteira num painel: cada enxame, cada IA com a sua cor, o que está em curso, o que foi entregue e o que falhou. Esta maquete repete em laço um enxame real de 22/10/2026 (quatro IAs escrevendo fichas de vitaminas); clique no nome de uma IA para ver o contrato, as etapas e o terminal dela.",
      modelo: ["Modelo ainda não decidido: se será gratuito ou se terá um componente pago.", "Nome novo: AI Swarm (era ia-swarm).", "Em construção."],
      maquete: "produto-ai-swarm.html", dica: "A frota anda sozinha. Clique no nome de uma IA para abrir o mini painel dela; os botões no alto filtram em curso, falhas e entregues.",
      app: null, nota: "Ainda sem página publicada: por enquanto, só a maquete."},
    {chave: "aichat", rota: "ai-chat", titulo: "AI Chat", eyebrow: "Produto · as IAs conversando numa sala só", estado: "em construção",
      descricao: "As IAs conversando entre si numa sala só, com você no comando.",
      ajuda: {oque: "A maquete do AI Chat: a sala onde Claude, Codex, Kimi, Grok e Qwen trocam mensagens, com os comandos de barra do dono, o enxame e a telemetria de cada IA.",
        deonde: "Da interface real do app, aberta no modo de cópia congelada, com uma conversa fictícia; o enxame da aba “enxame” é real, de 22/10/2026.",
        naoe: "Nada é enviado: o botão de envio fica desligado e nenhuma IA recebe mensagem."},
      texto: "A sala onde as IAs conversam entre si: cada mensagem diz quem fala e para quem, a sala avisa só quem foi chamado, e o dono comanda com os comandos de barra. Nesta maquete, Claude, Codex, Kimi, Grok e Qwen montam juntos uma página.",
      modelo: ["Hoje: a sala, sem modelo de cobrança definido.", "Depois: uma versão paga com mais funções na mesma sala, como o AI Painel, os navegadores e os terminais.", "Em construção."],
      maquete: "produto-ai-chat.html", dica: "Role a conversa para cima para ver o começo. Clique em “/ comandos”, embaixo, para ver os comandos de barra. As abas “enxame” e “groupchat”, no alto, mostram a frota trabalhando (um enxame real de 22/10, em laço: clique no nome de uma IA) e a telemetria de cada IA.",
      app: null, nota: "Ainda sem página publicada: por enquanto, só a maquete."},
    {chave: "obstetrica", rota: "calculadora-obstetrica", titulo: "Calculadora obstétrica", eyebrow: "Produto · app de iPhone", estado: "a caminho da App Store",
      descricao: "Idade gestacional e DPP pela DUM, pelo ultrassom ou comparando os dois.",
      ajuda: {oque: "A recriação, em página, da tela do app de iPhone: escolha DUM, USG ou Comparar e veja a idade gestacional, a DPP e o texto para o prontuário.",
        deonde: "Das cores e dos textos do próprio app (CalculatorView); a conta é a mesma regra: DPP = DUM + 280 dias.",
        naoe: "Não é o app instalado nem orientação clínica; os campos já vêm com dados fictícios."},
      texto: "A calculadora do iPhone, recriada aqui em página, inteira e sem rolar: idade gestacional e DPP pela DUM, pelo ultrassom ou comparando os dois, e o texto pronto para o prontuário. Mude a data ou as semanas e veja a conta refazer.",
      modelo: ["Pagamento único pela Apple (R$ 6,90), decisão de 11/10/2026.", "Quem não compra usa com anúncios; a compra tira os anúncios.", "Inscrição no Apple Developer como empresa ainda pendente."],
      maquete: "produto-calc-obstetrica.html", telefone: true, dica: "Funciona aqui dentro, numa moldura isolada, com dados fictícios.",
      app: null, nota: "App de iPhone a caminho da App Store: a maquete recria a tela dele."},
    {chave: "rcog", rota: "calculadora-rcog", titulo: "Calculadora RCOG · TEV", eyebrow: "Produto · no ar no GitHub", estado: "no ar",
      descricao: "O escore de risco de tromboembolismo venoso na gestação e no puerpério.",
      ajuda: {oque: "A calculadora do escore do RCOG para TEV, a mesma que está no ar no GitHub, dentro de um iPhone desenhado.",
        deonde: "Da página publicada em bauerfilho.github.io/score-tev-rcog, copiada para a maquete.",
        naoe: "É ferramenta educacional: não substitui a avaliação clínica nem a diretriz completa."},
      texto: "O escore do RCOG para tromboembolismo venoso na gestação e no puerpério, a calculadora publicada rodando dentro de um iPhone: marque os fatores de risco e o escore soma sozinho.",
      modelo: ["No iPhone: pagamento único pela Apple (R$ 5,90), decisão de 11/10/2026, com anúncios para quem não compra.", "A página publicada hoje continua aberta."],
      maquete: "produto-rcog-tev.html", telefone: true, dica: "A lista de fatores rola dentro do telefone.",
      app: {url: "https://bauerfilho.github.io/score-tev-rcog/", rotulo: "Abrir a calculadora funcionando"}},
    {chave: "orquestrator", rota: "orquestrator", titulo: "Orquestrator", eyebrow: "Produto · o app da casa", estado: "em discussão",
      descricao: "O app que reúne as IAs numa mesa só: conversa, enxame, navegadores e terminais.",
      ajuda: {oque: "O lugar reservado ao app Orquestrator: o que ele é e o que ainda está em discussão.",
        deonde: "Das decisões do Bauer registradas na conversa de 22/10/2026.",
        naoe: "Ainda não há maquete nem modelo de venda: nada aqui está decidido."},
      texto: "O app da casa: a mesa onde as IAs conversam, trabalham em enxame e usam navegadores e terminais, com a pessoa no comando. Ainda em discussão se será o app com o nome da casa.",
      modelo: ["Em discussão: se o app vai levar o nome Orquestrator.", "Modelo de venda ainda não decidido."],
      maquete: null, app: null, nota: "Maquete em preparo."},
  ];
  const ORDEM_PAINEL = [{chave: "medpainel", sigla: "MP", nome: "Med Painel", linha: "O painel lateral do médico · plano de venda"},
    {chave: "aiswarm", sigla: "AS", nome: "AI Swarm", linha: "A frota de IAs trabalhando, ao vivo"},
    {chave: "aichat", sigla: "AC", nome: "AI Chat", linha: "As IAs conversando numa sala só"},
    {chave: "obstetrica", sigla: "OB", nome: "Calculadora obstétrica", linha: "IG e DPP pela DUM e pelo ultrassom"},
    {chave: "rcog", sigla: "TEV", nome: "Calculadora RCOG", linha: "Risco de TEV na gestação e no puerpério"},
    {chave: "orquestrator", sigla: "OR", nome: "Orquestrator", linha: "O app da casa · em discussão"}];
  const porChave = Object.fromEntries(PRODUTOS.map((p) => [p.chave, p]));
  const el = (tag, cls, texto) => { const node = document.createElement(tag); if (cls) node.className = cls; if (texto !== undefined) node.textContent = texto; return node; };
  const tema = () => document.documentElement.getAttribute("data-tema") === "escuro" ? "escuro" : "claro";

  // ── as páginas, registradas em tempo de execução (o app.js processa a fila ao iniciar) ─────────────────────────
  let anterior = "portfolio";
  for (const p of PRODUTOS) {
    try {
      window.financeRegistrarPagina({chave: p.chave, rota: p.rota, grupo: "Empresa", titulo: p.titulo, descricao: p.descricao, ajuda: p.ajuda, eyebrow: p.eyebrow, depoisDe: anterior});
      anterior = p.chave;
    } catch (erro) { console.error(erro); }
  }

  // ── a maquete: o arquivo em produtos/ vira blob: nesta aba (a moldura herda a CSP do portal); #tema= acompanha o tema ──
  const bases = new Map();
  async function baseDaMaquete(arquivo) {
    if (!bases.has(arquivo)) {
      bases.set(arquivo, (async () => {
        const resposta = await fetch(new URL("produtos/" + arquivo, document.baseURI), {cache: "no-store"});
        if (!resposta.ok) throw new Error("A maquete não está publicada neste site (" + resposta.status + ").");
        const html = await resposta.text();
        return URL.createObjectURL(new Blob([html], {type: "text/html"}));
      })().catch((erro) => { bases.delete(arquivo); throw erro; }));
    }
    return bases.get(arquivo);
  }
  function secao(titulo, descricao) {
    const s = el("section", "mp-secao");
    s.append(el("h3", "mp-secao-titulo", titulo));
    if (descricao) s.append(el("p", "mp-secao-texto", descricao));
    return s;
  }
  async function desenhar(chave) {
    const p = porChave[chave], alvo = document.getElementById(chave + "-content");
    if (!p || !alvo || alvo.dataset.montado === "1") return;
    alvo.dataset.montado = "1";
    alvo.className = "product-content";
    const cabecalho = alvo.parentElement && alvo.parentElement.querySelector(".section-heading");
    if (cabecalho && !cabecalho.querySelector(".source-status")) {
      const estado = el("div", "source-status");
      estado.append(el("p", "", p.maquete ? "Maquete com dados fictícios · nenhuma operação real" : "Sem maquete ainda"));
      cabecalho.append(estado);
    }
    const sobre = secao("O que é", p.texto);
    const acoes = el("p", "product-actions");
    if (p.app) {
      const a = el("a", "button button-primary", p.app.rotulo + " ↗");
      a.href = p.app.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      acoes.append(a, el("span", "mp-secao-texto", "Abre a página publicada no GitHub, numa aba nova."));
    } else acoes.append(el("span", "product-pending", p.nota));
    sobre.append(acoes);
    alvo.append(sobre);
    const modelo = secao("Modelo e caminho");
    const pilula = el("span", "product-estado", p.estado);
    pilula.dataset.estado = p.estado;
    const lista = el("ul", "product-modelo");
    p.modelo.forEach((linha) => lista.append(el("li", "", linha)));
    modelo.append(pilula, lista);
    alvo.append(modelo);
    if (!p.maquete) return;
    const mesa = secao("Veja a maquete", p.dica || "Funciona aqui dentro, numa moldura isolada, com dados fictícios.");
    const aviso = el("p", "mp-secao-texto mp-mesa-aviso", "Abrindo a maquete…");
    mesa.append(aviso);
    alvo.append(mesa);
    try {
      const base = await baseDaMaquete(p.maquete);
      const moldura = el("iframe", "product-frame" + (p.telefone ? " product-frame--telefone" : ""));
      moldura.setAttribute("sandbox", "allow-scripts");
      moldura.setAttribute("referrerpolicy", "no-referrer");
      moldura.title = p.titulo + ", maquete";
      moldura.dataset.base = base;
      moldura.src = base + "#tema=" + tema();
      aviso.replaceWith(moldura);
    } catch (erro) { aviso.textContent = erro && erro.message ? erro.message : "A maquete não veio neste site."; }
  }
  // Só o produto aberto fica com a maquete viva: ao sair da página, a moldura é desmontada (o AI Swarm e o AI Chat
  // repetem o enxame em laço e gastariam CPU escondidos); ao voltar, redesenha a partir do blob: já guardado.
  function desmontar(chave) {
    const alvo = document.getElementById(chave + "-content");
    if (!alvo || alvo.dataset.montado !== "1") return;
    alvo.replaceChildren();
    delete alvo.dataset.montado;
  }
  document.addEventListener("financeiro:rota", (evento) => {
    const chave = evento.detail && evento.detail.pagina;
    PRODUTOS.forEach((p) => { if (p.chave !== chave) desmontar(p.chave); });
    if (porChave[chave]) desenhar(chave);
  });
  new MutationObserver(() => {
    document.querySelectorAll(".product-frame[data-base]").forEach((moldura) => { const url = moldura.dataset.base + "#tema=" + tema(); if (moldura.src !== url) moldura.src = url; });
  }).observe(document.documentElement, {attributes: true, attributeFilter: ["data-tema"]});

  // ── o painel lateral direito "Produtos" ─────────────────────────────────────────────────────────────────────────
  function montarPainel() {
    const acoes = document.querySelector("#app-header .header-actions"), ref = document.getElementById("change-password-button");
    if (!acoes || document.getElementById("products-button")) return;
    const botao = el("button", "button button-outline products-button");
    botao.id = "products-button"; botao.type = "button";
    botao.setAttribute("aria-haspopup", "dialog"); botao.setAttribute("aria-controls", "products-drawer"); botao.setAttribute("aria-expanded", "false"); botao.setAttribute("aria-label", "Produtos");
    const glifo = el("span", "products-button-glyph", "◫"); glifo.setAttribute("aria-hidden", "true");
    botao.append(glifo, el("span", "products-button-text", "Produtos"));
    acoes.insertBefore(botao, ref || acoes.firstChild);
    const painel = el("dialog", "navigation-drawer products-drawer");
    painel.id = "products-drawer"; painel.setAttribute("aria-labelledby", "products-title");
    const cabecalho = el("div", "drawer-heading"), bloco = el("div");
    const h2 = el("h2", "", "Produtos"); h2.id = "products-title";
    bloco.append(el("p", "eyebrow", "ORQUESTRATOR"), h2);
    const fechar = el("button", "icon-button"); fechar.id = "products-close"; fechar.type = "button"; fechar.setAttribute("aria-label", "Fechar produtos");
    const x = el("span", "", "×"); x.setAttribute("aria-hidden", "true"); fechar.append(x);
    cabecalho.append(bloco, fechar);
    const nav = el("nav", "drawer-nav products-nav"); nav.setAttribute("aria-label", "Produtos");
    for (const item of ORDEM_PAINEL) {
      const b = el("button"); b.type = "button"; b.dataset.navigate = item.chave;
      const marca = el("span", "product-mark", item.sigla); marca.setAttribute("aria-hidden", "true");
      const texto = el("span", "product-text"); texto.append(el("b", "", item.nome), el("small", "", item.linha));
      const seta = el("span", "nav-arrow", "↗"); seta.setAttribute("aria-hidden", "true");
      b.append(marca, texto, seta);
      nav.append(b);
    }
    const rodape = el("div", "drawer-footer"); rodape.append(el("p", "", "As maquetes usam dados fictícios. Nada aqui opera de verdade."));
    painel.append(cabecalho, el("p", "drawer-caption", "Cada produto com a maquete aqui dentro e, quando houver, o app funcionando."), nav, rodape);
    document.body.append(painel);
    let devolverFoco = null;
    const abrir = () => {
      if (!window.financeReady || document.getElementById("dashboard").hidden) return;
      devolverFoco = botao;
      if (!painel.open) painel.showModal();
      botao.setAttribute("aria-expanded", "true");
      document.documentElement.classList.add("drawer-open");
      const atual = window.financePaginaAtiva ? window.financePaginaAtiva() : "";
      nav.querySelectorAll("[data-navigate]").forEach((b) => { if (b.dataset.navigate === atual) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
      (nav.querySelector('[aria-current="page"]') || fechar).focus();
    };
    const fecharPainel = (devolver = true) => {
      if (painel.open) painel.close();
      const esquerda = document.getElementById("navigation-drawer");
      if (!esquerda || !esquerda.open) document.documentElement.classList.remove("drawer-open");
      botao.setAttribute("aria-expanded", "false");
      if (devolver && devolverFoco && devolverFoco.isConnected) devolverFoco.focus({preventScroll: true});
    };
    botao.addEventListener("click", abrir);
    fechar.addEventListener("click", () => fecharPainel());
    painel.addEventListener("cancel", (evento) => { evento.preventDefault(); fecharPainel(); });
    painel.addEventListener("click", (evento) => {
      const caixa = painel.getBoundingClientRect();
      if (evento.target === painel && (evento.clientX < caixa.left || evento.clientX > caixa.right || evento.clientY < caixa.top || evento.clientY > caixa.bottom)) fecharPainel();
    });
    painel.addEventListener("keydown", (evento) => {
      if (evento.key !== "Tab") return;
      const controles = [...painel.querySelectorAll("button:not([disabled]),a[href]")].filter((n) => n.getClientRects().length);
      if (!controles.length) return;
      const primeiro = controles[0], ultimo = controles[controles.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    });
    document.addEventListener("financeiro:rota", () => fecharPainel(false));
    const painelDoApp = document.getElementById("dashboard");
    if (painelDoApp) new MutationObserver(() => { if (painelDoApp.hidden) fecharPainel(false); }).observe(painelDoApp, {attributes: true, attributeFilter: ["hidden"]});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarPainel); else montarPainel();
})();
