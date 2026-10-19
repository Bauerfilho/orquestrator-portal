"use strict";

// O mapa do portal: a lista única das páginas (gaveta, rotas, títulos e "Como ler esta página") e as rotas por hash.
// Script clássico, carregado antes do app.js: o app.js monta a gaveta e os títulos a partir daqui. Uma página nova entra
// com uma linha aqui + a <section data-finance-page> no index.html, ou em tempo de execução por
// window.financeRegistrarPagina({chave, rota, grupo, titulo, descricao, ajuda, depoisDe}) (o app.js cria a seção, o botão
// e a rota; a numeração da gaveta é refeita).
//
// Rotas: #painel · #livro/2026-10 · #livro/2026-10/fechar · #lancamentos?mes=2026-10&socia=m-ana&id=… · #parametros/fx.USD_BRL
// · #lancar (abre a folha "+ Lançar"). O hash guarda só a página e filtros com formato conhecido (mês, id, chave de
// parâmetro): nunca valores, nomes ou textos. Qualquer coisa fora desses formatos é descartada ao ler e ao montar.
(() => {
  // a ordem dos grupos na gaveta; dentro de cada grupo, a ordem desta lista
  const GRUPOS = ["Dinheiro", "Planejar", "Empresa", "Ajuda"];
  // ajuda: as três linhas do "Como ler esta página" — o que é · de onde vem · o que não é
  const paginas = [
    {chave: "overview", rota: "painel", grupo: "Dinheiro", titulo: "Meu painel", descricao: "Seus compromissos, com a empresa em perspectiva.",
      ajuda: {oque: "A sua parte nos compromissos mensais da empresa e o total que ela paga, lado a lado.", deonde: "Dos planos de assinatura confirmados e da sua participação cadastrada. A fonte e a data de cada número ficam no botão ao lado dele.", naoe: "Não é uma cobrança nova nem um extrato bancário. É um rateio calculado para você se situar."}},
    {chave: "livro", rota: "livro", grupo: "Dinheiro", titulo: "Livro do mês", descricao: "O dinheiro do mês: o que já saiu, o que está previsto e a parte de cada sócia.", args: ["mes", "aba"],
      ajuda: {oque: "O custo do mês da empresa em reais: lançamentos das sócias (já pagos) + assinaturas ativas ainda sem lançamento (previstas). Gráficos por categoria e por item, a parte de cada sócia e o acerto dos gastos divididos.", deonde: "Das assinaturas do pacote da empresa e do diário cifrado onde as sócias lançam. Moeda estrangeira vira reais pelos Parâmetros vigentes na data de cada gasto; toque em “Ver a conta” para ver a fórmula com os números.", naoe: "Não é extrato bancário: um gasto só aparece aqui depois de lançado. Estimativas em dólar ficam marcadas como estimadas até alguém informar o valor da fatura."}},
    {chave: "cash", rota: "caixa", grupo: "Dinheiro", titulo: "Caixa", descricao: "Recursos, despesas e limites da empresa. Moedas sempre separadas.", args: ["mes"],
      ajuda: {oque: "O dinheiro da empresa: custo fixo mensal, gastos do mês, saldos registrados e teto de consumo.", deonde: "Dos registros financeiros e do documento de caixa, com a data de cada fonte indicada.", naoe: "Não é conta bancária ao vivo. Mostra o último registro entregue, moeda por moeda, sem somar moedas diferentes."}},
    {chave: "lancamentos", rota: "lancamentos", grupo: "Dinheiro", titulo: "Lançamentos", descricao: "Cada gasto da empresa, com quem pagou, como e para onde vai.", filtros: ["mes", "socia", "id"],
      ajuda: {oque: "A lista de tudo que as sócias lançaram: data, valor na moeda original, reais, categoria, quem pagou, se a empresa reembolsa, divide ou vira aporte.", deonde: "Do diário cifrado: cada lançamento é cifrado no seu navegador e assinado por quem lançou. O servidor só guarda texto cifrado.", naoe: "Nada se apaga: corrigir cria uma versão nova e anular deixa a linha riscada, com o motivo."}},
    {chave: "subscriptions", rota: "assinaturas", grupo: "Dinheiro", titulo: "Assinaturas", descricao: "Serviços, cobranças e a sua parte em cada compromisso.", filtros: ["id"],
      ajuda: {oque: "Cada serviço que a empresa assina, com valor, vencimento e a sua parte em cada cobrança.", deonde: "Do arquivo de planos da empresa e dos registros de benefícios e cobranças, lidos a cada abertura.", naoe: "Mudar o estado aqui não contrata nem cancela nada no serviço real. Só registra o que o painel considera."}},
    {chave: "parametros", rota: "parametros", grupo: "Dinheiro", titulo: "Parâmetros", descricao: "Câmbio, spread, IOF, impostos e taxas, com vigência e fonte.", args: ["parametro"],
      ajuda: {oque: "Os números que entram nas contas: dólar e euro (PTAX), spread do cartão, IOF, alíquota do Simples, ISS e taxas das plataformas de venda.", deonde: "Padrões pesquisados em 19/10/2026 (marcados “a confirmar”) e as vigências que as sócias registram. O botão “Atualizar pela PTAX” consulta o Banco Central.", naoe: "Não é aconselhamento fiscal: confirme impostos e alíquotas com o contador. Mudar um valor hoje não altera os gastos passados."}},
    {chave: "medpainel", rota: "medpainel", grupo: "Planejar", titulo: "Med Painel", descricao: "Como vender e o caminho até a meta de assinantes, com o dinheiro de cada mês.",
      ajuda: {oque: "Os canais de venda do Med Painel, a projeção mês a mês até 10 mil assinantes em três cenários, o resultado, a verba de marketing e a parte de cada sócio.", deonde: "Das estratégias, premissas e decisões do Bauer em mercado/MED-PAINEL-*, do custo fixo dos planos ativos e da sociedade. A conta é refeita na tela a cada leitura.", naoe: "Não é previsão: os números de aquisição são chutes até o piloto medir. Imposto e taxa de cobrança ainda passam pelo contador."}},
    {chave: "projection", rota: "projecao", grupo: "Planejar", titulo: "Projeção", descricao: "Possibilidades acompanhadas de suas fontes e premissas.",
      ajuda: {oque: "Cenários de receita possíveis, cada um com a fórmula que o sustenta.", deonde: "Do documento de projeção escrito pela equipe. A fórmula fica visível em cada cenário.", naoe: "Não é promessa nem meta. São possibilidades acompanhadas das suas premissas."}},
    {chave: "sell", rota: "vender", grupo: "Planejar", titulo: "Vender primeiro", descricao: "Prioridades e próximos passos registrados pela equipe.",
      ajuda: {oque: "As três prioridades de venda e os próximos passos que a equipe registrou para cada uma.", deonde: "Do documento de prioridades da equipe. Cada caixinha marcada é salva nele.", naoe: "Não é previsão de receita nem compromisso de prazo. É a lista do que vem primeiro."}},
    {chave: "society", rota: "sociedade", grupo: "Empresa", titulo: "Sociedade", descricao: "Participações registradas e responsabilidades compartilhadas.",
      ajuda: {oque: "Quem são os sócios e a participação registrada de cada um.", deonde: "Do registro societário da empresa. Nome, função e contato de cada sócia vêm de um arquivo cifrado: só quem entra com senha vê.", naoe: "Não substitui o contrato social nem registra alterações. É consulta."}},
    {chave: "portfolio", rota: "portfolio", grupo: "Empresa", titulo: "Portfólio", descricao: "O que já existe, o que foi conferido e o que ainda falta.",
      ajuda: {oque: "O catálogo do que já existe: cada ativo com estado documental, nota de prontidão e destino.", deonde: "Do inventário e do atlas de ativos, montados a partir dos arquivos e repositórios conferidos. A prontidão é uma nota documental de 0 a 100, somada de cinco critérios de até 20 pontos.", naoe: "Prontidão não mede funcionamento, mercado nem preço. Só o Criador decide o destino de cada ativo."}},
    // requer: a página só aparece (na gaveta e na rota) quando o host liga essa capacidade (financeHost.galeria)
    {chave: "lab", rota: "laboratorio", grupo: "Empresa", titulo: "Laboratório", descricao: "Protótipos visuais com dados fictícios. Nenhuma operação real.", requer: "galeria",
      ajuda: {oque: "Maquetes com dados fictícios: ideias de telas e produtos para olhar e discutir. Cada uma também abre em tela cheia, como um app no iPhone.", deonde: "Da galeria de maquetes publicada com o portal. Aqui cada maquete abre numa moldura isolada; a tela cheia é uma página à parte, aberta numa aba nova.", naoe: "Nenhuma operação real: nada aqui lê, grava ou envia dados da empresa. O link de tela cheia abre sem senha para quem o tiver, e por isso só mostra dados fictícios."}},
    // Como fazer e Estado do portal entram neste grupo na F2-10, já prontos (nenhuma página vazia vai ao ar)
    {chave: "historico", rota: "historico", grupo: "Ajuda", titulo: "Histórico", descricao: "Quem mudou o quê, quando e por quê.",
      ajuda: {oque: "A linha do tempo de todas as gravações: lançamentos, correções, anulações e parâmetros, com o antes e o depois.", deonde: "Do diário cifrado, conferido registro a registro: cadeia, assinatura e cifra.", naoe: "Registros recusados (que não passaram nas regras) aparecem à parte e não entram em nenhuma conta."}},
  ];
  paginas.forEach((p, k) => { p.numero = String(k + 1).padStart(2, "0"); });   // o app.js refaz pela ordem visível

  // ── rotas por hash ───────────────────────────────────────────────────────────────────────────────────────────────
  // Formatos aceitos nos argumentos (#livro/2026-10) e nos filtros (?mes=2026-10): só identificadores, nunca texto livre.
  const FORMATOS = {
    mes: /^\d{4}-(0[1-9]|1[0-2])$/,                       // 2026-10
    aba: /^fechar$/,                                       // #livro/2026-10/fechar
    // nos ids, 11 dígitos seguidos (cara de CPF) nunca entram, mesmo que um id venha assim de fora
    id: /^(?!.*\d{11})[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/,   // id de gasto ou de plano (g-…, pl-…), como o razao.js aceita
    socia: /^(?!.*\d{11})[a-z0-9][a-z0-9_-]{0,39}$/,        // id da sócia (m-ana), "eu" ou "todas"
    parametro: /^[a-z][a-z0-9_]*(\.[A-Za-z0-9_]+)+$/,      // fx.USD_BRL, cartao.spread_pct
  };
  const ACOES = ["lancar"];                                // rotas que fazem algo por cima da página atual
  const IGNORADOS = new Set(["main-content"]);             // âncoras da própria página (o "Ir para o conteúdo")
  const ROTA = /^[a-z][a-z0-9-]{1,39}$/;
  const lista = valor => Array.isArray(valor) ? valor.filter(nome => Object.hasOwn(FORMATOS, nome)) : [];
  const porRota = rota => paginas.find(p => p.rota === rota) || null;
  const porChave = chave => paginas.find(p => p.chave === chave) || null;

  // "#lancamentos?socia=m-ana&valor=9" → {chave: "lancamentos", rota, args: [], filtros: {socia: "m-ana"}, acao: null};
  // rota desconhecida → {chave: null, rota, …} (ex.: página de um módulo que ainda não se registrou); âncora ou hash
  // vazio → null. Argumento ou filtro fora do formato da página some.
  function ler(hash) {
    const bruto = String(hash || "").replace(/^#/, "");
    if (!bruto || IGNORADOS.has(bruto)) return null;
    const [caminho, consulta = ""] = bruto.split("?", 2);
    let partes;
    try { partes = caminho.split("/").map(decodeURIComponent); } catch (_) { return null; }
    const rota = partes.shift();
    if (!ROTA.test(rota)) return null;
    if (ACOES.includes(rota)) return {chave: null, rota, args: [], filtros: {}, acao: rota};
    const pagina = porRota(rota);
    if (!pagina) return {chave: null, rota, args: [], filtros: {}, acao: null};
    const args = [];
    for (const [k, nome] of lista(pagina.args).entries()) {
      if (k >= partes.length || !FORMATOS[nome].test(partes[k])) break;
      args.push(partes[k]);
    }
    const filtros = {};
    const aceitos = lista(pagina.filtros);
    for (const [nome, valor] of new URLSearchParams(consulta)) {
      if (aceitos.includes(nome) && !Object.hasOwn(filtros, nome) && FORMATOS[nome].test(valor)) filtros[nome] = valor;
    }
    return {chave: pagina.chave, rota, args, filtros, acao: null};
  }

  // montar("lancamentos", [], {mes: "2026-10", nota: "x"}) → "#lancamentos?mes=2026-10" (o que não tem formato some)
  function montar(chave, args = [], filtros = {}) {
    const pagina = porChave(chave);
    if (!pagina) return "";
    let hash = "#" + pagina.rota;
    for (const [k, nome] of lista(pagina.args).entries()) {
      const valor = Array.isArray(args) ? args[k] : undefined;
      if (typeof valor !== "string" || !FORMATOS[nome].test(valor)) break;
      hash += "/" + valor;
    }
    // os formatos não deixam passar & = # % nem espaço: o par vai como está (sem %3A no lugar do ":" de um id)
    const pares = [];
    for (const nome of lista(pagina.filtros)) {
      const valor = filtros && typeof filtros === "object" ? filtros[nome] : undefined;
      if (typeof valor === "string" && FORMATOS[nome].test(valor)) pares.push(nome + "=" + valor);
    }
    return pares.length ? hash + "?" + pares.join("&") : hash;
  }

  window.financePaginas = paginas;
  window.financeGrupos = GRUPOS;
  // âncora da própria página ("#main-content"): não é rota e não troca de página
  const ancora = hash => IGNORADOS.has(String(hash || "").replace(/^#/, ""));
  window.financeRotas = {ler, montar, ancora, formatos: FORMATOS, acoes: ACOES, rota: ROTA};
  // Até o app.js montar a gaveta, um registro em tempo de execução fica na fila (o app.js a processa e troca esta função
  // pela de verdade, que devolve {chave, rota, secao, conteudo}).
  const fila = [];
  const provisorio = definicao => { fila.push(definicao); return null; };
  provisorio.fila = fila;
  window.financeRegistrarPagina = provisorio;
})();
