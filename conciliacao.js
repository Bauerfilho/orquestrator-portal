// Conciliar a fatura (fatia F2-8). Quando a fatura do cartão chega, a sócia digita o que o banco cobrou de cada gasto em
// moeda estrangeira (somando o IOF quando ele vem numa linha separada) ou só o total, e o "≈ estimado" vira o valor
// efetivo da fatura, com a diferença explicada. O botão "Conciliar fatura" fica na barra de Lançamentos (extra 'lancamentos-barra'); o
// Fechamento abre a mesma folha por window.financeConciliacao.abrir(mes, forma).
//
// As contas: a estimativa de cada gasto é a do razão (R.reaisDoGasto sem a fatura, com os parâmetros da data dele, os
// mesmos que o reconcile_statement usa para registrar o "antes"); o total da fatura é dividido entre os gastos pelo
// maior resto, com a estimativa em reais como peso (contas.ratearFatura: a soma fecha ao centavo); a PTAX de fechamento
// do último dia útil até a data de cada compra vem do Banco Central (API Olinda, CotacaoMoedaPeriodo: uma consulta por
// moeda e período) e é escolhida por contas.cotacaoDoBoletim; o spread que o banco cobrou de fato sai de
// contas.spreadImplicito. Grava reconcile_statement {mes, forma, totalFaturaMinor|null, itens[{alvo, versao,
// faturaBrlMinor}]} pelo diário (folha.gravar do livro.js, com a prévia do razão) e, se a sócia quiser, um set_parameter
// de cartao.spread_pct com a fonte "fatura de <mês>". Nada se apaga: a estimativa de antes fica no Histórico e na versão
// anterior de cada gasto. Sem a PTAX (Banco Central fora do ar, sem rede), a conciliação funciona igual: só a
// explicação com números fica de fora. Mês fechado não concilia: a folha diz quem reabre e por quê.
// Plano: PLANO-PORTAL §5 Conciliação e PTAX, D6, F4; PLANO-FASES-2-3 F2-8. Fluxo no arnês: ferramentas/arnes/fluxos/conciliacao.mjs.
import {registrarExtra, dados, el, botao, nomeDe, hojeDe, abrirFolha, campoDinheiro} from './livro.js';
import * as R from './razao.js';
import {ratearFatura, spreadImplicito, cotacaoDoBoletim, listaDoMes, textoPct} from './contas.js';
import {dinheiro, mesLongo} from './graficos.js';

const MENOS = '−';
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const somar = valores => { const s = valores.reduce((a, v) => a + BigInt(v), 0n); if (s > MAX || s < -MAX) throw new Error('valor fora do limite'); return Number(s); };
const comSinal = minor => (minor > 0 ? '+' : minor < 0 ? MENOS : '') + dinheiro(Math.abs(minor));
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const nomeDoMes = mes => mesLongo(mes).replace(/ de \d{4}$/, '');   // "outubro"
const ddmm = dia => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const textoCambio = v => String(v).replace('.', ',');
const mesOk = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const somarDias = (dia, k) => new Date(Date.parse(dia + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
const mesSeguinte = mes => { const [a, m] = mes.split('-').map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`; };
const mesAnterior = mes => { const [a, m] = mes.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`; };
// o spread que a fatura revelou, em texto decimal: além do limite dos Parâmetros (10%), para mais ou para menos, é engano
// de digitação e não câmbio; abaixo de 2% quase sempre é o IOF que ficou de fora (sem ele, um spread de 4% vira uns 0,5%)
const LIMITE_SPREAD = R.decimal(String((R.itemCatalogo('cartao.spread_pct') || {dura: [0, 10]}).dura[1])) || {n: 10n, d: 1n};
const SPREAD_BAIXO = {n: 2n, d: 1n};
const maiorQue = (a, b) => a.n * b.d > b.n * a.d;
const NOME_MOEDA = {USD: 'dólar', EUR: 'euro'};
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const estrangeiro = g => g.moeda !== 'BRL' && g.estado !== 'anulado';
const temFatura = g => Number.isSafeInteger(g.faturaBrlMinor) && g.faturaBrlMinor > 0;
const daEmpresa = forma => R.formaDaEmpresa(forma);
const deCartao = forma => !!(R.FORMAS.find(f => f.id === forma) || {}).cartao;
const ordemDaForma = forma => R.FORMAS.findIndex(f => f.id === forma);
const fechado = (D, mes) => !!(D.aplicado.fechamentos && Object.hasOwn(D.aplicado.fechamentos, mes) && D.aplicado.fechamentos[mes].fechado);
const nome = (D, id) => nomeDe(D.c, id);

// os gastos desta fatura: em moeda estrangeira, não anulados, da competência e da forma de pagamento; no cartão (ou na
// conta) pessoal, só os de quem pagou, porque cada sócia tem o próprio cartão e a própria fatura
function gastosDa(D, {mes, forma, pagador}) {
  return D.aplicado.gastos.filter(g => estrangeiro(g) && g.competencia === mes && g.forma === forma && (daEmpresa(forma) || g.pagoPor === pagador))
    .sort((a, b) => a.data.localeCompare(b.data) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
// quem tem gasto em moeda estrangeira na forma pessoal do mês (e a sócia que está vendo, sempre)
function pagadoresDe(D, mes, forma) {
  const eu = D.c.membro.id;
  const ids = new Set(D.aplicado.gastos.filter(g => estrangeiro(g) && g.competencia === mes && g.forma === forma).map(g => g.pagoPor));
  ids.add(eu);
  return (D.c.estado.members || []).map(m => m.id).filter(id => ids.has(id));
}
// o que abrir quando ninguém disse: o mês anterior ao de hoje, se ele está aberto e tem gasto estrangeiro sem fatura (a
// fatura chega no começo do mês seguinte); senão o mês mais recente com gasto estrangeiro sem fatura; a forma com mais
// pendências nele (empate: a ordem das formas, cartão da empresa primeiro) e, na forma pessoal, quem está vendo
function escolher(D, pedido = {}) {
  const eu = D.c.membro.id;
  const todos = D.aplicado.gastos.filter(estrangeiro);
  const recente = lista => lista.reduce((m, g) => (!m || g.competencia > m ? g.competencia : m), null);
  const anterior = mesAnterior(hojeDe(D.c).slice(0, 7));
  const chegou = !fechado(D, anterior) && todos.some(g => g.competencia === anterior && !temFatura(g)) ? anterior : null;
  const mes = mesOk(pedido.mes) ? pedido.mes : chegou || recente(todos.filter(g => !temFatura(g))) || recente(todos) || hojeDe(D.c).slice(0, 7);
  let forma = R.FORMAS.some(f => f.id === pedido.forma) ? pedido.forma : null;
  if (!forma) {
    const doMes = todos.filter(g => g.competencia === mes);
    const contagem = R.FORMAS.map(f => ({id: f.id, pend: doMes.filter(g => g.forma === f.id && !temFatura(g)).length, todos: doMes.filter(g => g.forma === f.id).length}));
    const melhor = [...contagem].sort((a, b) => b.pend - a.pend || b.todos - a.todos || ordemDaForma(a.id) - ordemDaForma(b.id))[0];
    forma = melhor && melhor.todos ? melhor.id : 'cartao_pj';
  }
  return {mes, forma, pagador: escolherPagador(D, mes, forma, pedido.pagador || eu)};
}
// na forma pessoal: a preferida (quem está vendo, ou a sócia do filtro de Lançamentos) se ela tem gasto ali; senão
// quem está vendo, se tem; senão a primeira que tem; sem ninguém, quem está vendo (a folha diz que não há nada)
function escolherPagador(D, mes, forma, preferido) {
  if (daEmpresa(forma)) return null;
  const eu = D.c.membro.id;
  const com = id => D.aplicado.gastos.some(g => estrangeiro(g) && g.competencia === mes && g.forma === forma && g.pagoPor === id);
  if (preferido && com(preferido)) return preferido;
  if (com(eu)) return eu;
  return pagadoresDe(D, mes, forma).find(com) || eu;
}
// "no cartão da empresa" · "no seu cartão pessoal" · "no cartão pessoal de Ana"
function ondeFoiPago(D, forma, pagador) {
  const eu = pagador === D.c.membro.id;
  if (forma === 'cartao_pj') return 'no cartão da empresa';
  if (forma === 'conta_pj') return 'na conta da empresa';
  if (forma === 'cartao_pessoal') return eu ? 'no seu cartão pessoal' : `no cartão pessoal de ${nome(D, pagador)}`;
  return eu ? 'na sua conta pessoal' : `na conta pessoal de ${nome(D, pagador)}`;
}

// ── PTAX do Banco Central: uma consulta por moeda e período, guardada enquanto a página está aberta ──────────────────
const OLINDA = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)';
const consultas = new Map();
function consultarPtax(moeda, inicio, fim) {
  const chave = `${moeda}|${inicio}|${fim}`;
  if (!consultas.has(chave)) consultas.set(chave, buscarPtax(moeda, inicio, fim).catch(erro => { consultas.delete(chave); throw erro; }));
  return consultas.get(chave);
}
async function buscarPtax(moeda, inicio, fim) {
  if (!R.MOEDAS.includes(moeda) || moeda === 'BRL') throw new Error('moeda sem PTAX');
  const mdy = d => `${d.slice(5, 7)}-${d.slice(8, 10)}-${d.slice(0, 4)}`;
  const url = `${OLINDA}?@moeda='${moeda}'&@dataInicial='${mdy(inicio)}'&@dataFinalCotacao='${mdy(fim)}'&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao,tipoBoletim`;
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), 10000);
  try {
    const r = await fetch(url, {signal: parar.signal});
    if (!r.ok) throw new Error('o Banco Central respondeu ' + r.status);
    return await r.text();   // o texto vai inteiro para o cotacaoDoBoletim, que lê o número sem ponto flutuante
  } finally { clearTimeout(relogio); }
}

// ── a folha ────────────────────────────────────────────────────────────────────────────────────────────────────────
let sequencia = 0;
export function abrir(mes = null, forma = null, opcoes = {}) {
  const D0 = dados();
  if (!D0) return null;
  const id = ++sequencia;
  const st = {...escolher(D0, {mes, forma, pagador: opcoes.pagador}), modo: 'itens', digitado: new Map(), marcado: new Map(), total: '',
    ptaxDe: new Map(), ptaxFalhou: false, itens: [], salvo: null, spreadSalvo: null, travado: false, campoTotal: null, nos: {}, D: D0};
  const raiz = el('div', 'cc-raiz');
  const folha = abrirFolha({eyebrow: 'Conciliar fatura', titulo: 'A fatura chegou', rotulo: 'Conciliar a fatura', corpo: raiz,
    acoes: [{rotulo: 'Conciliar a fatura', primaria: true, fn: f => (st.salvo ? true : conciliar(f))}],
    aoFechar: () => { if (opcoes.devolverFoco) requestAnimationFrame(() => { const b = document.querySelector(opcoes.devolverFoco); if (b) b.focus(); }); }});

  function botoes(estado) { // 'conciliar' | 'pronto' | 'nenhum'
    const caixa = folha.form.querySelector('.lv-dialogo-acoes');
    if (!caixa) return;
    const enviar = caixa.querySelector('button[type=submit]');
    const outros = [...caixa.querySelectorAll('button')].filter(b => b !== enviar);
    if (enviar) { enviar.hidden = estado === 'nenhum'; enviar.textContent = estado === 'pronto' ? 'Pronto' : 'Conciliar a fatura'; }
    for (const b of outros) { b.hidden = estado === 'pronto'; b.textContent = estado === 'nenhum' ? 'Fechar' : 'Cancelar'; }
  }

  function desenhar() {
    const D = dados();
    if (!D) return;
    st.D = D;
    raiz.replaceChildren();
    folha.erro(null);
    st.nos = {};
    if (st.salvo) { desenharSalvo(D); botoes('pronto'); return; }
    raiz.append(seletores(D));
    const lista = listaDoMes(D.aplicado, D.lista, st.mes);
    st.itens = gastosDa(D, st).map(g => {
      const e = R.reaisDoGasto({...g, faturaBrlMinor: null}, lista);
      return {g, est: e.brl, conta: e.conta, campo: null, no: {}};
    });
    st.travado = fechado(D, st.mes);
    if (st.travado) { raiz.append(...desenharTravado(D)); botoes('nenhum'); return; }
    if (!st.itens.length) {
      const vazio = el('div', 'cc-vazio');
      vazio.append(el('strong', null, `Nenhum gasto em moeda estrangeira em ${nomeDoMes(st.mes)} ${ondeFoiPago(D, st.forma, st.pagador)}.`),
        el('span', null, 'Os gastos em dólar ou euro lançados com esta forma de pagamento aparecem aqui para receber o valor da fatura. Troque o mês ou o cartão acima.'));
      raiz.append(vazio);
      botoes('nenhum');
      return;
    }
    raiz.append(el('p', 'cc-intro', 'Digite quanto o banco cobrou por cada gasto, somando o IOF quando ele vem numa linha separada. Se o IOF vem numa linha só para todos, use “Só tenho o total”. O valor da fatura substitui a estimativa, que continua guardada no Histórico.'));
    raiz.append(escolhaDoModo());
    // só o total: um campo, e cada gasto mostra a parte dele pelo rateio
    const campoTotal = campoDinheiro('BRL', {rotulo: 'Total da fatura destes gastos'});
    if (st.total) campoTotal.input.value = st.total;
    campoTotal.input.addEventListener('input', () => { st.total = campoTotal.input.value; atualizar(); });
    st.campoTotal = campoTotal;
    const caixaTotal = rotulado('Total cobrado por estes gastos, com o IOF', campoTotal, 'cc-total');
    caixaTotal.append(el('span', 'cc-dica', 'O portal divide o total entre os gastos marcados, na proporção da estimativa de cada um; a soma fecha ao centavo.'));
    st.nos.caixaTotal = caixaTotal;
    raiz.append(caixaTotal);
    const ptax = el('p', 'cc-ptax-estado');
    ptax.setAttribute('role', 'status');
    st.nos.ptax = ptax;
    const ul = el('ul', 'cc-itens');
    ul.setAttribute('aria-label', `Gastos em moeda estrangeira de ${nomeDoMes(st.mes)} ${ondeFoiPago(D, st.forma, st.pagador)}`);
    for (const it of st.itens) ul.append(linhaItem(D, it));
    raiz.append(ul, ptax);
    const resumo = el('p', 'cc-resumo');
    resumo.setAttribute('aria-live', 'polite');
    st.nos.resumo = resumo;
    const porque = el('section', 'cc-porque');   // sem aria-live: o resumo já anuncia a diferença a cada tecla
    st.nos.porque = porque;
    raiz.append(resumo, porque);
    botoes('conciliar');
    carregarPtax();
    atualizar();
  }

  function seletores(D) {
    const caixa = el('div', 'cc-seletores');
    const meses = [...new Set([...D.aplicado.gastos.filter(estrangeiro).map(g => g.competencia), st.mes])].filter(mesOk).sort().reverse();
    const selMes = el('select', 'lv-select cc-select');
    for (const m of meses) { const o = el('option', null, capital(mesLongo(m)) + (fechado(D, m) ? ' (fechado)' : '')); o.value = m; o.selected = m === st.mes; selMes.append(o); }
    // trocar o mês, o cartão ou a dona do cartão é outra fatura: o total digitado era da anterior e sai do campo
    selMes.addEventListener('change', () => { st.mes = selMes.value; st.total = ''; st.pagador = escolherPagador(D, st.mes, st.forma, st.pagador || D.c.membro.id); desenhar(); focarSeletor(0); });
    const formas = R.FORMAS.filter(f => f.cartao || f.id === st.forma || D.aplicado.gastos.some(g => estrangeiro(g) && g.competencia === st.mes && g.forma === f.id));
    const selForma = el('select', 'lv-select cc-select');
    for (const f of formas) { const o = el('option', null, f.rotulo); o.value = f.id; o.selected = f.id === st.forma; selForma.append(o); }
    selForma.addEventListener('change', () => { st.forma = selForma.value; st.total = ''; st.pagador = escolherPagador(D, st.mes, st.forma, st.pagador || D.c.membro.id); desenhar(); focarSeletor(1); });
    caixa.append(rotulado('Mês da fatura', selMes), rotulado(formas.every(f => f.cartao) ? 'Cartão' : 'Cartão ou conta', selForma));
    if (!daEmpresa(st.forma)) {
      const ids = pagadoresDe(D, st.mes, st.forma);
      if (ids.length > 1) {
        const selPag = el('select', 'lv-select cc-select');
        for (const pid of ids) { const o = el('option', null, nome(D, pid) + (pid === D.c.membro.id ? ' (você)' : '')); o.value = pid; o.selected = pid === st.pagador; selPag.append(o); }
        selPag.addEventListener('change', () => { st.pagador = selPag.value; st.total = ''; desenhar(); focarSeletor(2); });
        caixa.append(rotulado('De quem é o cartão', selPag));
      }
    }
    return caixa;
  }
  // depois de redesenhar pela troca de um seletor, o foco volta ao mesmo seletor (o nó antigo saiu da página)
  function focarSeletor(k) { const s = raiz.querySelectorAll('.cc-seletores select')[k]; if (s) s.focus(); }

  function escolhaDoModo() {
    const grupo = el('fieldset', 'cc-modo');
    grupo.append(el('legend', null, 'Como você vai informar'));
    for (const [valor, texto] of [['itens', 'Item a item'], ['total', 'Só tenho o total']]) {
      const rot = el('label', 'cc-chip');
      const r = el('input');
      r.type = 'radio'; r.name = `cc-modo-${id}`; r.value = valor; r.checked = st.modo === valor;
      r.addEventListener('change', () => { if (!r.checked) return; st.modo = valor; atualizar(); });
      rot.append(r, el('span', null, texto));
      grupo.append(rot);
    }
    return grupo;
  }

  function linhaItem(D, it) {
    const {g} = it;
    const li = el('li', 'cc-item');
    li.dataset.gasto = g.id;
    const marca = el('input');
    marca.type = 'checkbox';
    marca.checked = st.marcado.has(g.id) ? st.marcado.get(g.id) : !temFatura(g);
    marca.setAttribute('aria-label', `${g.descricao}: veio nesta fatura`);
    marca.addEventListener('change', () => { st.marcado.set(g.id, marca.checked); atualizar(); });
    const titulo = el('label', 'cc-item-titulo');
    titulo.append(marca, el('span', 'cc-desc', g.descricao));
    const meta = el('p', 'cc-meta', [ddmm(g.data), dinheiro(g.valorMinor, g.moeda), daEmpresa(g.forma) ? `lançado por ${nome(D, g.criadoPor)}` : null].filter(Boolean).join(' · '));
    const valores = el('p', 'cc-valores');
    valores.append(it.est === null ? el('span', 'cc-estimado is-sem', 'sem câmbio para estimar') : el('span', 'cc-estimado', `≈ ${dinheiro(it.est)} estimado`));
    const ja = temFatura(g) ? el('span', 'cc-ja') : null;
    if (ja) valores.append(el('span', 'cc-efetivo', `fatura ${dinheiro(g.faturaBrlMinor)}`), ja);
    const conta = contaDaEstimativa(it);
    const ptax = el('p', 'cc-ptax');
    const campo = campoDinheiro('BRL', {valorMinor: temFatura(g) ? g.faturaBrlMinor : null, rotulo: `Cobrado na fatura por ${g.descricao}`});
    if (st.digitado.has(g.id)) campo.input.value = st.digitado.get(g.id);
    campo.input.addEventListener('input', () => { st.digitado.set(g.id, campo.input.value); atualizar(); });
    const caixaCampo = rotulado('Cobrado na fatura', campo, 'cc-campo');
    const rateio = el('p', 'cc-rateio');
    const delta = el('p', 'cc-delta');
    li.append(titulo, meta, valores, ...(conta ? [conta] : []), ptax, caixaCampo, rateio, delta);
    it.campo = campo;
    it.no = {li, marca, ptax, caixaCampo, rateio, delta, ja};
    mostrarPtaxDe(it);
    return li;
  }

  // ── PTAX: dita em cada gasto, com a data do boletim; falhou, a folha avisa e segue ─────────────────────────────────
  function carregarPtax() {
    const faltam = st.itens.filter(it => !st.ptaxDe.has(it.g.id));
    if (!faltam.length) { mostrarPtax(); return; }
    st.ptaxFalhou = false;   // tenta de novo o que faltou (uma consulta que falhou não fica guardada)
    const porMoeda = new Map();
    for (const it of faltam) { if (!porMoeda.has(it.g.moeda)) porMoeda.set(it.g.moeda, []); porMoeda.get(it.g.moeda).push(it); }
    mostrarPtax();
    Promise.allSettled([...porMoeda].map(([moeda, its]) => {
      const datas = its.map(it => it.g.data).sort();
      return consultarPtax(moeda, somarDias(datas[0], -10), datas[datas.length - 1]).then(texto => { for (const it of its) st.ptaxDe.set(it.g.id, cotacaoDoBoletim(texto, it.g.data)); });
    })).then(resultados => {
      if (!folha.dialogo.open) return;
      if (resultados.some(r => r.status === 'rejected')) st.ptaxFalhou = true;
      if (st.salvo) { desenhar(); return; }
      mostrarPtax();
      atualizar();
    });
  }
  function mostrarPtax() {
    for (const it of st.itens) mostrarPtaxDe(it);
    const aviso = st.nos.ptax;
    if (!aviso) return;
    const consultando = st.itens.some(it => !st.ptaxDe.has(it.g.id)) && !st.ptaxFalhou;
    aviso.classList.toggle('is-falha', st.ptaxFalhou);
    aviso.textContent = st.ptaxFalhou ? 'Não foi possível consultar o Banco Central agora; a conciliação funciona sem ela.'
      : consultando ? 'Consultando a PTAX do Banco Central…' : 'PTAX de fechamento do Banco Central: a do dia da compra ou, em fim de semana e feriado, a do último dia útil antes dela.';
  }
  function mostrarPtaxDe(it) {
    const no = it.no && it.no.ptax;
    if (!no) return;
    const p = st.ptaxDe.has(it.g.id) ? st.ptaxDe.get(it.g.id) : undefined;
    if (p) no.textContent = textoDaPtax(it.g, p);
    else no.textContent = p === null ? `Sem PTAX do Banco Central até ${ddmm(it.g.data)}.` : st.ptaxFalhou ? 'PTAX indisponível agora.' : 'PTAX: consultando…';
  }

  // ── a cada tecla: rateio, diferença de cada gasto, resumo e a explicação ──────────────────────────────────────────
  function valoresDaFatura(marcados) {
    if (st.modo === 'itens') {
      const faturas = new Map();
      for (const it of marcados) { const v = it.campo.ler(); if (Number.isSafeInteger(v) && v > 0) faturas.set(it.g.id, v); }
      return {faturas, erro: null};
    }
    const total = st.campoTotal ? st.campoTotal.ler() : null;
    return ratear(marcados, total);
  }
  function atualizar() {
    if (!st.itens.length || st.salvo || st.travado || !st.nos.resumo) return;
    const marcados = st.itens.filter(it => it.no.marca && it.no.marca.checked);
    const {faturas, erro} = valoresDaFatura(marcados);
    if (st.nos.caixaTotal) st.nos.caixaTotal.hidden = st.modo !== 'total';
    for (const it of st.itens) {
      const m = it.no.marca.checked, v = faturas.get(it.g.id);
      it.no.li.classList.toggle('is-fora', !m);
      if (it.no.ja) it.no.ja.textContent = m ? 'digite o valor certo para corrigir' : 'já conciliado: marque para corrigir';
      it.no.caixaCampo.hidden = !m || st.modo !== 'itens';
      it.no.rateio.hidden = !m || st.modo !== 'total';
      it.no.rateio.replaceChildren();
      if (m && st.modo === 'total') it.no.rateio.append(v ? el('span', 'cc-efetivo', `fatura ${dinheiro(v)} pelo rateio`) : el('span', null, 'A parte dele aparece quando você digitar o total.'));
      const d = m && v && it.est !== null ? v - it.est : null;
      it.no.delta.hidden = d === null;
      it.no.delta.className = 'cc-delta' + (d > 0 ? ' is-mais' : d < 0 ? ' is-menos' : '');
      it.no.delta.textContent = d === null ? '' : `diferença ${comSinal(d)}`;
    }
    const resumo = st.nos.resumo;
    const completo = marcados.length > 0 && marcados.every(it => faturas.has(it.g.id));
    resumo.replaceChildren();
    if (!marcados.length) resumo.append(st.itens.every(it => temFatura(it.g)) ? 'Todos estes gastos já têm o valor da fatura. Para corrigir um, marque-o e digite o valor certo.' : 'Marque os gastos que vieram nesta fatura.');
    else {
      const semCambio = marcados.filter(it => it.est === null).length;
      const est = semCambio ? null : somar(marcados.map(it => it.est));
      const fat = completo ? somar(marcados.map(it => faturas.get(it.g.id))) : null;
      resumo.append(est === null ? `Estimado: falta o câmbio de ${plural(semCambio, 'gasto', 'gastos')}` : `Estimado ${dinheiro(est)}`, ' → ');
      if (fat !== null) {
        resumo.append(`fatura ${dinheiro(fat)}`);
        if (est !== null) resumo.append(' · ', el('strong', 'cc-dif' + (fat > est ? ' is-mais' : fat < est ? ' is-menos' : ''), `diferença ${comSinal(fat - est)}`));
      } else if (erro) resumo.append(erro);
      else resumo.append(st.modo === 'total' ? 'digite o total da fatura' : `falta o valor de ${plural(marcados.filter(it => !faturas.has(it.g.id)).length, 'gasto', 'gastos')}`);
    }
    const porque = st.nos.porque;
    porque.replaceChildren();
    if (completo) {
      const x = explicacao(st.D, marcados.map(it => ({...it, ptax: st.ptaxDe.get(it.g.id), fatura: faturas.get(it.g.id)})));
      if (x) porque.append(...blocoDaExplicacao(x));
      if (x && x.spreadNormal && st.forma === 'cartao_pj') porque.append(el('p', 'cc-dica', 'Depois de conciliar, você pode usar este spread nas próximas estimativas.'));
    }
  }
  const ratear = (marcados, total) => dividirTotal(total, marcados.map(it => ({id: it.g.id, moeda: it.g.moeda, valorMinor: it.g.valorMinor, est: it.est})));

  // ── gravar ────────────────────────────────────────────────────────────────────────────────────────────────────────
  async function conciliar(f) {
    const marcados = st.itens.filter(it => it.no.marca && it.no.marca.checked);
    if (!marcados.length) return {ok: false, erro: 'Marque ao menos um gasto que veio nesta fatura.'};
    let faturas, total = null;
    if (st.modo === 'itens') {
      faturas = new Map();
      for (const it of marcados) {
        const v = it.campo.ler();
        if (!Number.isSafeInteger(v) || v <= 0) { it.campo.input.focus(); return {ok: false, erro: `Informe quanto veio na fatura por “${it.g.descricao}” (use vírgula para os centavos).`}; }
        faturas.set(it.g.id, v);
      }
    } else {
      total = st.campoTotal.ler();
      if (!Number.isSafeInteger(total) || total <= 0) { st.campoTotal.input.focus(); return {ok: false, erro: 'Informe o total da fatura (use vírgula para os centavos).'}; }
      const r = ratear(marcados, total);
      if (r.erro) return {ok: false, erro: r.erro};
      faturas = r.faturas;
    }
    const itens = marcados.map(it => ({alvo: it.g.id, versao: it.g.versao, faturaBrlMinor: faturas.get(it.g.id)}));
    const soma = somar(itens.map(i => i.faturaBrlMinor));
    if (total !== null && soma !== total) return {ok: false, erro: 'A divisão do total não fechou ao centavo. Recarregue o portal e tente de novo.'};
    const r = await f.gravar({acao: 'reconcile_statement', alvo: `${st.mes}:${st.forma}`, dados: {mes: st.mes, forma: st.forma, totalFaturaMinor: total, itens}},
      `Fatura de ${nomeDoMes(st.mes)} conciliada: ${dinheiro(soma)}.`);
    if (!r || !r.ok) return r || {ok: false, erro: 'Não foi possível salvar.'};
    const semCambio = marcados.some(it => it.est === null);
    st.salvo = {itens: marcados.map(it => ({g: it.g, est: it.est, conta: it.conta, fatura: faturas.get(it.g.id)})), total, soma,
      est: semCambio ? null : somar(marcados.map(it => it.est)), treino: !!r.treino};
    desenhar();
    const titulo = raiz.querySelector('.cc-salvo-titulo');
    if (titulo) titulo.focus();
    return false;   // a folha fica aberta: o resumo do que entrou, a explicação e a oferta do spread
  }

  // ── depois de gravar: o que entrou, por que o banco cobrou diferente e "Usar X% como spread" ───────────────────────
  function desenharSalvo(D) {
    const s = st.salvo;
    const box = el('section', 'cc-salvo');
    const titulo = el('h3', 'cc-salvo-titulo', s.treino ? 'Fatura conciliada (modo treino)' : 'Fatura conciliada');
    titulo.tabIndex = -1;
    box.append(titulo, el('p', 'cc-resumo', s.est === null ? `Fatura ${dinheiro(s.soma)} (sem estimativa para comparar)` : `Estimado ${dinheiro(s.est)} → fatura ${dinheiro(s.soma)} · diferença ${comSinal(s.soma - s.est)}`));
    const ul = el('ul', 'cc-salvo-itens');
    for (const it of s.itens) {
      const li = el('li');
      li.dataset.gasto = it.g.id;
      li.append(el('span', 'cc-desc', it.g.descricao), el('span', 'cc-salvo-conta'));
      const conta = li.lastChild;
      if (it.est !== null) conta.append(el('span', 'cc-estimado', `≈ ${dinheiro(it.est)}`), ' → ');
      conta.append(el('span', 'cc-efetivo', dinheiro(it.fatura)));
      if (it.est !== null) conta.append(' ', el('span', 'cc-delta' + (it.fatura > it.est ? ' is-mais' : it.fatura < it.est ? ' is-menos' : ''), `(${comSinal(it.fatura - it.est)})`));
      ul.append(li);
    }
    box.append(ul, el('p', 'cc-nota', 'Nada se apagou: a estimativa de antes fica no Histórico. No Livro do mês, estes gastos passam de “estimado” para “fatura”.'));
    raiz.append(box);
    const x = explicacao(D, s.itens.map(it => ({...it, ptax: st.ptaxDe.get(it.g.id)})));
    const porque = el('section', 'cc-porque');
    if (x) porque.append(...blocoDaExplicacao(x));
    if (st.ptaxFalhou) porque.append(el('p', 'cc-ptax-estado is-falha', 'Não foi possível consultar o Banco Central agora; a conciliação funciona sem ela.'));
    if (x && x.spread !== null && st.forma === 'cartao_pj') porque.append(ofertaDoSpread(D, x.spread));
    else if (x && x.spread !== null && st.forma === 'cartao_pessoal') porque.append(el('p', 'cc-nota', 'O spread dos Parâmetros é o do cartão da empresa: o do cartão pessoal fica só nesta explicação.'));
    raiz.append(porque);
  }
  // o spread que a fatura revelou vira parâmetro, a partir do mês seguinte ao da fatura (os meses fechados não mudam)
  function ofertaDoSpread(D, spread) {
    const caixa = el('div', 'cc-spread');
    const desde = `${mesSeguinte(st.mes)}-01`;
    const quando = ddmm(desde) + (desde.slice(0, 4) !== hojeDe(D.c).slice(0, 4) ? '/' + desde.slice(0, 4) : '');
    if (st.spreadSalvo) {
      caixa.append(el('p', 'cc-spread-ok', `Spread de ${textoPct(st.spreadSalvo.valor)} salvo a partir de ${quando}: as estimativas dali em diante usam esse valor. Os meses fechados não mudam.`));
      return caixa;
    }
    const item = R.itemCatalogo('cartao.spread_pct');
    const d = R.decimal(spread, item ? item.casas : 2);
    const atual = R.vigente(D.lista, 'cartao.spread_pct', desde);
    const a = atual ? R.decimal(atual.valor, 6) : null;
    if (!d || !item) {
      caixa.append(el('p', 'cc-nota', 'O spread desta fatura saiu negativo: o banco cobrou menos que a PTAX + o IOF. Confira se o valor de cada gasto inclui o IOF antes de mudar o parâmetro.'));
      return caixa;
    }
    const valor = Number(d.n) / Number(d.d);
    if (valor < item.dura[0] || valor > item.dura[1]) {
      caixa.append(el('p', 'cc-nota', `O spread desta fatura (${textoPct(spread)}) está fora do que o portal aceita (${item.dura[0]}% a ${item.dura[1]}%): confira os valores digitados.`));
      return caixa;
    }
    if (a && a.n * d.d === d.n * a.d) {
      caixa.append(el('p', 'cc-nota', `O spread desta fatura é o mesmo do parâmetro (${textoPct(atual.valor)}): nada a mudar.`));
      return caixa;
    }
    const b = botao(`Usar ${textoPct(spread)} como spread a partir de ${quando}`, 'button-outline cc-usar-spread', async () => {
      b.disabled = true;
      const r = await folha.gravar({acao: 'set_parameter', alvo: 'cartao.spread_pct', dados: {chave: 'cartao.spread_pct', valor: spread, desde, fonte: `fatura de ${mesLongo(st.mes)}`, estado: 'vigente',
        nota: `spread que o banco cobrou na fatura de ${mesLongo(st.mes)} (${R.rotuloForma(st.forma)}): fatura ÷ (valor × PTAX × (1 + IOF)) − 1`}}, `Spread do cartão: ${textoPct(spread)} a partir de ${quando}.`);
      if (!r || !r.ok) { b.disabled = false; folha.erro((r && r.erro) || 'Não foi possível salvar o spread.'); return; }
      st.spreadSalvo = {valor: spread, desde};
      desenhar();
      const ok = raiz.querySelector('.cc-spread-ok');
      if (ok) { ok.tabIndex = -1; ok.focus(); }
    });
    caixa.append(b, el('p', 'cc-dica', `Hoje o parâmetro é ${atual ? textoPct(atual.valor) : 'nenhum'}${atual && atual.estado === 'a_confirmar' ? ' (a confirmar)' : ''}. Mudar vale para as compras a partir de ${quando}; os gastos anteriores continuam com o valor da época deles.`));
    return caixa;
  }

  // ── mês fechado: só leitura, com quem reabre e por quê ─────────────────────────────────────────────────────────────
  function desenharTravado(D) {
    const trava = el('p', 'cc-trava');
    trava.setAttribute('role', 'note');
    trava.append(cadeado(), el('span', null, `${capital(nomeDoMes(st.mes))} está fechado: a responsável reabre, com motivo, se a fatura chegou depois.`));
    if (!st.itens.length) return [trava];
    const ul = el('ul', 'cc-salvo-itens is-travado');
    ul.setAttribute('aria-label', `Gastos em moeda estrangeira de ${nomeDoMes(st.mes)} (mês fechado)`);
    for (const it of st.itens) {
      const li = el('li');
      li.dataset.gasto = it.g.id;
      const conta = el('span', 'cc-salvo-conta');
      conta.append(el('span', null, dinheiro(it.g.valorMinor, it.g.moeda) + ' → '), temFatura(it.g) ? el('span', 'cc-efetivo', `fatura ${dinheiro(it.g.faturaBrlMinor)}`) : it.est !== null ? el('span', 'cc-estimado', `≈ ${dinheiro(it.est)} estimado`) : el('span', 'cc-estimado is-sem', 'sem câmbio'));
      li.append(el('span', 'cc-desc', it.g.descricao), conta);
      ul.append(li);
    }
    return [trava, ul];
  }

  folha.form.classList.add('cc-folha');
  desenhar();
  const primeiro = raiz.querySelector('.cc-item:not(.is-fora) .lv-dinheiro-valor') || raiz.querySelector('.cc-seletores select');
  if (primeiro) primeiro.focus();
  return folha;
}

// "Só tenho o total": divide o total entre os gastos pelo maior resto, com a estimativa em reais de cada um como peso
// (a parte de cada gasto acompanha o que se esperava dele); sem estimativa para algum, pelo valor na moeda original
// (só se for a mesma moeda). A soma das partes é sempre o total, ao centavo. itens: [{id, moeda, valorMinor, est}].
// Devolve {faturas: Map id → centavos, erro}; total vazio ou nenhum item: Map vazio e erro null (ainda incompleto).
export function dividirTotal(total, itens) {
  const vazio = erro => ({faturas: new Map(), erro});
  if (!Array.isArray(itens) || !itens.length || !Number.isSafeInteger(total) || total <= 0) return vazio(null);
  const comPeso = itens.every(it => Number.isSafeInteger(it.est) && it.est > 0);
  const r = ratearFatura(total, itens.map(it => ({id: it.id, moeda: it.moeda, valorMinor: it.valorMinor, ...(comPeso ? {peso: it.est} : {})})));
  if (!r) return vazio('Há gastos em moedas diferentes sem câmbio para estimar: informe o valor de cada um.');
  if (r.some(x => x.faturaBrlMinor < 1)) return vazio('O total é pequeno demais para dividir entre os gastos marcados: confira o valor.');
  return {faturas: new Map(r.map(x => [x.id, x.faturaBrlMinor])), erro: null};
}

// ── "Por que o banco cobrou diferente?" ─────────────────────────────────────────────────────────────────────────────
// itens: [{g, est, conta, ptax, fatura}]. Com a PTAX de todos: a PTAX de cada dia (com a data do boletim), o mecanismo
// (PTAX + spread do cartão + IOF) e o spread que saiu nesta fatura. Sem a PTAX, só o mecanismo, sem número inventado.
function explicacao(D, itens) {
  if (!D || !itens.length || itens.some(it => !Number.isSafeInteger(it.fatura) || it.fatura <= 0)) return null;
  const forma = itens[0].g.forma, cartao = deCartao(forma);
  const iofs = itens.map(it => R.vigente(D.lista, cartao ? 'iof.cartao_internacional_pct' : 'iof.cambio_servicos_pct', it.g.data));
  const iof = iofs[0] ? iofs[0].valor : '0';
  const mesmoIof = iofs.every(p => (p ? p.valor : '0') === iof);
  const textoIof = mesmoIof ? `o IOF de ${textoPct(iof)}` : 'o IOF da data de cada compra';
  const mecanismo = cartao ? `o banco cobra a PTAX + o spread do cartão + ${textoIof}` : `o banco cobra o câmbio dele (a PTAX + a margem do banco) + ${textoIof}`;
  const fat = somar(itens.map(it => it.fatura));
  const est = itens.every(it => it.est !== null) ? somar(itens.map(it => it.est)) : null;
  const titulo = est !== null && est === fat ? 'A fatura bateu com a estimativa' : 'Por que o banco cobrou diferente?';
  const estimativa = fraseDaEstimativa(itens, cartao);
  if (!itens.every(it => it.ptax)) return {titulo, texto: `${capital(mecanismo)}. ${estimativa}`.trim(), spread: null, comPtax: false};
  // a PTAX de cada dia de compra (sem repetir o mesmo boletim), em ordem de data
  const vistos = new Map();
  for (const it of [...itens].sort((a, b) => a.g.data.localeCompare(b.g.data))) {
    const chave = it.g.moeda + '|' + it.ptax.data;
    if (!vistos.has(chave)) vistos.set(chave, {moeda: it.g.moeda, ptax: it.ptax, compras: []});
    vistos.get(chave).compras.push(it.g.data);
  }
  const dias = [...vistos.values()];
  const soDolar = dias.every(x => x.moeda === 'USD');
  const daMoeda = x => (soDolar ? '' : ` do ${NOME_MOEDA[x.moeda] || x.moeda}`);
  const deDia = x => `de ${ddmm(x.ptax.data)}${x.compras.every(c => c !== x.ptax.data) ? ` (último dia útil antes da compra de ${ddmm(x.compras[0])})` : ''}`;
  let frasePtax;
  if (dias.length === 1) frasePtax = `A PTAX${daMoeda(dias[0])} ${deDia(dias[0])} era ${textoCambio(dias[0].ptax.valor)}`;
  else if (dias.length <= 3) frasePtax = 'A PTAX' + dias.map((x, k) => `${k === 0 ? '' : k === dias.length - 1 ? ' e a' : ', a'}${daMoeda(x)} ${deDia(x)} era ${textoCambio(x.ptax.valor)}`).join('');
  else {
    const ord = [...dias].sort((a, b) => (R.decimal(a.ptax.valor).n < R.decimal(b.ptax.valor).n ? -1 : 1));
    frasePtax = `A PTAX dos dias das compras foi de ${textoCambio(ord[0].ptax.valor)} (${ddmm(ord[0].ptax.data)}) a ${textoCambio(ord[ord.length - 1].ptax.valor)} (${ddmm(ord[ord.length - 1].ptax.data)})`;
  }
  // o spread que o banco cobrou: fatura = valor × PTAX × (1 + spread) × (1 + IOF). Com a mesma PTAX, moeda e IOF em
  // todos, a conta é direta; senão, a base em reais (valor × PTAX × (1 + IOF) de cada um, um arredondamento por gasto)
  const igual = itens.every(it => it.g.moeda === itens[0].g.moeda && it.ptax.valor === itens[0].ptax.valor) && mesmoIof;
  let spread;
  if (igual) spread = spreadImplicito(fat, somar(itens.map(it => it.g.valorMinor)), itens[0].ptax.valor, iof);
  else {
    const bases = itens.map((it, k) => R.converter(it.g.valorMinor, it.ptax.valor, '0', iofs[k] ? iofs[k].valor : '0'));
    spread = bases.some(b => !b) ? null : spreadImplicito(fat, somar(bases.map(b => b.total)), '1', '0');
  }
  let fraseSpread = '', spreadNormal = false;
  if (spread !== null) {
    const negativo = spread.startsWith('-');
    const tamanho = R.decimal(negativo ? spread.slice(1) : spread, 2);
    if (!tamanho || maiorQue(tamanho, LIMITE_SPREAD)) fraseSpread = ' O valor parece fora do normal: confira o que foi digitado.';
    else {
      fraseSpread = cartao ? ` Nesta fatura o spread saiu ${textoPct(spread)}.` : ` Aqui o câmbio do banco saiu ${textoPct(negativo ? spread.slice(1) : spread)} ${negativo ? 'abaixo' : 'acima'} da PTAX.`;
      if (negativo && cartao) fraseSpread += ' O banco cobrou menos que a PTAX + o IOF: confira se o valor de cada gasto inclui o IOF.';
      else if (cartao && maiorQue(SPREAD_BAIXO, tamanho)) fraseSpread += ' Confira se você somou o IOF de cada gasto.';
      spreadNormal = !negativo;
    }
  }
  // spreadNormal: entre 0% e o limite dos Parâmetros, o que a oferta "Usar X% como spread" aceita
  return {titulo, texto: `${frasePtax}; ${mecanismo}.${fraseSpread}`, estimativa, spread, spreadNormal, comPtax: true};
}
// "A estimativa usava o dólar de 5,0826 dos Parâmetros (de 01/10) e um spread de 4%."
function fraseDaEstimativa(itens, cartao) {
  const contas = itens.map(it => it.conta).filter(c => c && c.cambio);
  if (!contas.length) return '';
  const cambios = [...new Map(contas.map(c => [c.cambio.id, c.cambio])).values()];
  const spreads = [...new Set(contas.map(c => (c.spreadParam ? c.spreadParam.valor : null)).filter(Boolean))];
  const moeda = NOME_MOEDA[itens[0].g.moeda] || itens[0].g.moeda;
  const cambio = cambios.length === 1 ? `o ${moeda} de ${textoCambio(cambios[0].valor)} dos Parâmetros (de ${ddmm(cambios[0].desde)})` : 'o câmbio dos Parâmetros na data de cada compra';
  const spread = cartao && spreads.length === 1 ? ` e um spread de ${textoPct(spreads[0])}` : '';
  return `A estimativa usava ${cambio}${spread}.`;
}
function blocoDaExplicacao(x) {
  const nos = [el('h3', 'cc-porque-titulo', x.titulo), el('p', 'cc-porque-texto', x.texto)];
  if (x.estimativa && x.comPtax) nos.push(el('p', 'cc-nota', x.estimativa));
  return nos;
}
// "PTAX de 14/10: 5,0441" · "PTAX de 09/10 (último dia útil antes da compra): 4,9892"
function textoDaPtax(g, p) {
  const moeda = g.moeda === 'USD' ? '' : ` do ${NOME_MOEDA[g.moeda] || g.moeda}`;
  return `PTAX${moeda} de ${ddmm(p.data)}${p.data !== g.data ? ' (último dia útil antes da compra)' : ''}: ${textoCambio(p.valor)}`;
}

// a conta da estimativa, à mostra dentro da folha (sem abrir outro diálogo por cima dela):
// "US$ 100,00 × 5,0826 (PTAX venda BCB, 16/10/2026) = R$ 508,26 + spread 4% R$ 20,33 + IOF 3,5% R$ 18,50 = R$ 547,09"
function contaDaEstimativa(it) {
  const k = it.conta;
  if (!k || !k.cambio) return null;
  let t = `${dinheiro(it.g.valorMinor, it.g.moeda)} × ${textoCambio(k.cambio.valor)} (${k.cambio.fonte}${k.cambioPosterior ? '; câmbio posterior à compra' : ''}) = ${dinheiro(k.principal)}`;
  if (k.spreadParam && k.spreadMinor) t += ` + spread ${textoPct(k.spreadParam.valor)} ${dinheiro(k.spreadMinor)}`;
  if (k.iofParam && k.iofMinor) t += ` + IOF ${textoPct(k.iofParam.valor)} ${dinheiro(k.iofMinor)}`;
  t += ` = ${dinheiro(k.total)}`;
  const det = el('details', 'cc-conta');
  det.append(el('summary', null, 'Ver a conta da estimativa'), el('p', null, t));
  return det;
}

// ── ajudantes de tela ─────────────────────────────────────────────────────────────────────────────────────────────
// rótulo de verdade (<label> em volta do controle): o leitor de tela lê o nome do campo
function rotulado(texto, controle, cls = '') {
  const caixa = el('label', 'field lv-campo cc-campo-rotulado' + (cls ? ' ' + cls : ''));
  caixa.append(el('span', 'lv-rotulo', texto), controle);
  return caixa;
}
function cadeado() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('class', 'cc-cadeado'); svg.setAttribute('aria-hidden', 'true');
  const corpo = document.createElementNS(ns, 'rect');
  corpo.setAttribute('x', '2.5'); corpo.setAttribute('y', '6'); corpo.setAttribute('width', '9'); corpo.setAttribute('height', '6.5'); corpo.setAttribute('rx', '1.2');
  const arco = document.createElementNS(ns, 'path');
  arco.setAttribute('d', 'M4.5 6V4.2a2.5 2.5 0 0 1 5 0V6');
  svg.append(corpo, arco);
  return svg;
}

// ── o botão na barra de Lançamentos e a porta para o Fechamento ───────────────────────────────────────────────────────
registrarExtra('lancamentos-barra', (D, {filtro} = {}) => {
  const f = filtro || {};
  const eu = D.c.membro.id;
  const pagador = f.socia === 'eu' ? eu : (D.c.estado.members || []).some(m => m.id === f.socia) ? f.socia : null;
  const pendentes = D.aplicado.gastos.filter(g => estrangeiro(g) && !temFatura(g) && (!f.mes || g.competencia === f.mes)).length;
  const b = botao('Conciliar fatura', 'button-outline cc-abrir', () => abrir(f.mes || null, null, {pagador, devolverFoco: '#lancamentos-content .cc-abrir'}));
  b.title = pendentes ? `${plural(pendentes, 'gasto', 'gastos')} em moeda estrangeira sem o valor da fatura` : 'Digite o que o banco cobrou dos gastos em moeda estrangeira';
  return b;
});
// abrir(mes 'AAAA-MM', forma, {pagador, devolverFoco}) → a folha (a API do abrirFolha) ou null se o portal não abriu
window.financeConciliacao = {abrir: (mes, forma, opcoes) => abrir(mes || null, forma || null, opcoes || {})};
