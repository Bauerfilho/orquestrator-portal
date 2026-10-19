// As páginas novas do Finanças: Livro do mês (o dinheiro do mês, com gráficos e a conta de cada número), Lançamentos (o
// que cada sócia gastou pela empresa), Parâmetros (câmbio, spread, IOF, impostos e taxas, com vigência) e Histórico (quem
// mudou o quê). Mais o botão "+ Lançar" do cabeçalho, o resumo do mês no Meu painel, a faixa de treino de todas as páginas
// (#faixa-global) e o que a rota pede a estas páginas (rotaAtual: mês, filtros, destaque). Os dados vêm da ponte (estado
// canônico do pacote) + o diário cifrado (diario.js); toda conta é do razao.js. Três níveis de leitura por página:
// manchete em 10 segundos, gráficos em 1 minuto, livro até o centavo (plano §6.4).
//
// É também a base das telas da rotina (fase 2 e 3): os módulos novos importam daqui ('./livro.js', a mesma instância)
// os ajudantes de tela, o gravar, a folha comum e os ganchos registrarPagina/registrarExtra. Este arquivo não importa
// nenhum deles (sem ciclo): só o razao.js e o graficos.js.
import * as R from './razao.js';
import {dinheiro, barra100, ranking, colunas, divergentes, mesLongo} from './graficos.js';

const $ = id => document.getElementById(id);
export function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined && txt !== null) n.textContent = String(txt); return n; }
export function botao(rotulo, cls, fn) { const b = el('button', 'button ' + cls, rotulo); b.type = 'button'; b.addEventListener('click', fn); return b; }
const host = () => (window.financeHost && typeof window.financeHost === 'object') ? window.financeHost : {};
const livroHost = () => host().livro || null;
let mesAtual = null;
const filtro = {socia: 'todas', mes: null};
let paramAberto = null;
// da rota (#livro/2026-10/fechar, #lancamentos?…&id=…, #parametros/fx.USD_BRL): a aba do Livro, o lançamento e o
// parâmetro destacados, e de onde se chegou a eles
let abaLivro = null;
let destacado = null;
let paramDestacado = null;
let rotuloDestaque = 'Aberto pelo link';
let ultimoDesenho = '';
let ultimoLancamento = null;

export function dados() {
  const h = livroHost();
  const c = h && h.contexto ? h.contexto() : null;
  if (!c || !c.estado) return null;
  const d = h.diario ? h.diario() : null;
  const aplicado = R.aplicar(c.estado, d ? d.eventos : []);
  return {c, d, aplicado, lista: R.parametros(aplicado)};
}
export const nomeDe = (c, id) => { const m = (c.estado.members || []).find(x => x.id === id); return m ? m.displayName : (id || '—'); };
export const hojeDe = c => c.hoje || new Date().toISOString().slice(0, 10);
export const dataBR = d => d ? new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short'}).format(new Date(d.length === 10 ? d + 'T12:00:00' : d)) : '—';
export const horaBR = d => d ? new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(d)) : '—';
const permilTexto = p => (p / 10).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 1}) + '%';
const somaMes = (mes, k) => { let [a, m] = mes.split('-').map(Number); m += k; while (m > 12) { m -= 12; a++; } while (m < 1) { m += 12; a--; } return `${a}-${String(m).padStart(2, '0')}`; };
const original = o => dinheiro(o.minor, o.moeda);

// ── estado da gravação: dito por extenso, sempre ─────────────────────────────────────────────────────────────────
const MODOS = {
  gravacao: ['ok', 'Gravação ligada'], leitura: ['aviso', 'Só leitura'], treino: ['aviso', 'Modo treino'],
  indisponivel: ['aviso', 'Modo treino · servidor fora do ar'], aguardando: ['aviso', 'Aguardando chave'], abrindo: ['neutro', 'Abrindo o diário…'],
};
function modo(d) { return d ? d.modo : 'abrindo'; }
export function faixaModo(d) {
  const m = modo(d);
  if (m === 'gravacao') return null;
  const box = el('div', 'lv-faixa' + (m === 'abrindo' ? '' : ' is-treino'));
  const titulo = m === 'treino' || m === 'indisponivel' ? 'Modo treino: nada do que você fizer aqui é salvo' : m === 'aguardando' ? 'Sua chave do diário ainda não foi liberada' : m === 'leitura' ? 'Você lê, mas não grava' : 'Abrindo o diário cifrado…';
  box.append(el('strong', null, titulo), el('span', null, d && d.motivo ? d.motivo : 'Um instante: a chave é derivada da sua senha no próprio navegador.'));
  return box;
}
// a faixa no topo de todas as páginas (#faixa-global); some com a gravação ligada. Enquanto o diário abre (1 a 2 s), o
// cabeçalho já diz "Abrindo o diário…": a faixa só entra quando o modo é conhecido, para a página não pular à toa.
// Só troca quando o texto muda.
let ultimaFaixa = null;
function desenharFaixaGlobal(D) {
  const alvo = $('faixa-global');
  if (!alvo) return;
  const fx = D && D.d ? faixaModo(D.d) : null;
  const texto = fx ? fx.textContent : '';
  if (texto === ultimaFaixa) return;
  ultimaFaixa = texto;
  alvo.replaceChildren(...(fx ? [fx] : []));
}
function desenharModo() {
  const d = livroHost() && livroHost().diario ? livroHost().diario() : null;
  const alvo = $('lv-modo');
  if (!alvo) return;
  const [tom, texto] = MODOS[modo(d)] || MODOS.abrindo;
  alvo.replaceChildren();
  alvo.className = 'lv-modo is-' + tom;
  const ponto = el('span', 'lv-modo-ponto'); ponto.setAttribute('aria-hidden', 'true');
  let detalhe = '';
  if (d && d.modo === 'gravacao') detalhe = d.fila ? ` · ${d.fila} enviando` : d.ultimaSincronia ? ' · ' + new Intl.DateTimeFormat('pt-BR', {hour: '2-digit', minute: '2-digit'}).format(new Date(d.ultimaSincronia)) : '';
  if (d && d.verificacao && !d.verificacao.integro) detalhe += ' · há registros que não conferem';
  alvo.append(ponto, el('span', null, texto + detalhe));
  alvo.title = d && d.motivo ? d.motivo : texto;
}

// ── "Ver a conta": a fórmula com os valores reais, produzida pela mesma função que calcula o total ───────────────────
// Cada termo leva à origem dele (plano §5 Ver a conta): um gasto abre em Lançamentos, destacado; uma assinatura, em
// Assinaturas; câmbio, spread e IOF abrem o parâmetro. Um termo com {detalhe: {titulo, explica}} (Realizado, Previsto)
// abre a conta dele aqui mesmo, com "‹ Voltar". Assim "de onde vem este número" chega ao lançamento em até 3 toques.
let dialogoConta = null;
export function verConta(titulo, explica, c, voltar = null) {
  if (!dialogoConta) { dialogoConta = el('dialog', 'lv-dialogo lv-conta'); dialogoConta.setAttribute('aria-label', 'A conta'); document.body.append(dialogoConta); dialogoConta.addEventListener('click', e => { if (e.target === dialogoConta) dialogoConta.close(); }); }
  const jaAberto = dialogoConta.open;
  dialogoConta.replaceChildren();
  const topo = el('div', 'lv-dialogo-topo');
  topo.append(el('div', null), botao('Fechar', 'button-outline', () => dialogoConta.close()));
  const h2 = el('h2', null, titulo); h2.tabIndex = -1;
  topo.firstChild.append(el('p', 'eyebrow', 'De onde vem este número'), h2);
  dialogoConta.append(topo);
  if (voltar) { const v = botao('‹ Voltar para ' + voltar.titulo, 'button-quiet lv-ver-conta', () => verConta(voltar.titulo, voltar.explica, c, voltar.voltar)); v.style.marginTop = '0'; dialogoConta.append(v); }
  dialogoConta.append(el('p', 'lv-formula', explica.formula));
  const aqui = {titulo, explica, voltar};
  const lista = el('ol', 'lv-termos');
  for (const t of explica.termos) {
    const li = el('li');
    const cab = el('div', 'lv-termo-cab');
    cab.append(el('span', 'lv-termo-op', t.op === '-' ? '−' : '+'), rotuloDoTermo(t, c, aqui), el('span', 'lv-termo-valor', dinheiro(t.brl)));
    li.append(cab);
    if (t.original && t.original.moeda !== 'BRL') li.append(contaComLinks(t.original, t.conta, t.conversao));
    lista.append(li);
  }
  if (!explica.termos.length) lista.append(el('li', 'lv-vazio', 'Nenhum item entra nesta conta ainda.'));
  dialogoConta.append(lista);
  const tot = el('div', 'lv-termo-total');
  tot.append(el('span', null, '='), el('strong', null, dinheiro(explica.resultado)));
  dialogoConta.append(tot);
  if (explica.excluidos && explica.excluidos.length) {
    dialogoConta.append(el('h3', 'lv-sub', 'Ficaram de fora'));
    const ul = el('ul', 'lv-excluidos');
    for (const x of explica.excluidos) ul.append(el('li', null, `${x.rotulo}: ${x.motivo}`));
    dialogoConta.append(ul);
  }
  dialogoConta.append(el('p', 'lv-nota', 'Moedas diferentes nunca se somam sem conversão: cada valor em moeda estrangeira vira reais com os parâmetros vigentes na data dele (página Parâmetros). Toque num item sublinhado para ver de onde ele vem.'));
  if (!jaAberto) dialogoConta.showModal();
  else h2.focus();
}
// o rótulo do termo: botão que abre a conta dele, link para o gasto, a assinatura ou nada (texto)
function rotuloDoTermo(t, c, aqui) {
  if (t.detalhe && t.detalhe.explica) {
    const b = botao(t.rotulo + '  ›', 'button-quiet lv-ver-conta lv-termo-rotulo', () => verConta(t.detalhe.titulo, t.detalhe.explica, c, aqui));
    b.style.justifySelf = 'start'; b.style.marginTop = '0'; b.style.textAlign = 'left';
    return b;
  }
  const D = t.id ? dados() : null;
  const gasto = D ? D.aplicado.gastos.find(g => g.id === t.id) : null;
  if (gasto) return linkDaConta(t.rotulo, 'lancamentos', [], {mes: gasto.competencia, id: gasto.id}, 'lv-termo-rotulo');
  const plano = D ? (D.aplicado.planos || []).find(p => p.id === t.id) : null;
  if (plano) return linkDaConta(t.rotulo, 'subscriptions', [], {id: plano.id}, 'lv-termo-rotulo');
  return el('span', 'lv-termo-rotulo', t.rotulo);
}
// link de verdade (abre em outra aba com o meio do mouse ou Ctrl/⌘; ali a página certa abre depois da senha); o clique
// comum fecha a conta e navega pelo app, empilhando no histórico (o Voltar do navegador volta para cá)
function linkDaConta(texto, pagina, args, filtros, cls = 'lv-termo-link') {
  const a = el('a', cls, texto);
  a.href = window.financeRotas ? window.financeRotas.montar(pagina, args, filtros) : '#';
  a.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || typeof window.financeNavigate !== 'function') return;
    e.preventDefault();
    if (dialogoConta && dialogoConta.open) dialogoConta.close();
    window.financeNavigate(pagina, true, {args, filtros, origem: 'ver-a-conta'});
  });
  return a;
}
// a mesma frase do explicarConversao, com o câmbio, o spread e o IOF como links para o parâmetro de cada um
function contaComLinks(orig, k, tipo) {
  const p = el('p', 'lv-termo-conta');
  if (tipo === 'efetivo' || !k || !k.cambio) { p.textContent = contaTexto(orig, k, tipo); return p; }
  const param = (q, texto) => q && q.chave ? linkDaConta(texto, 'parametros', [q.chave], {}) : document.createTextNode(texto);
  p.append(`${original(orig)} × `, param(k.cambio, k.cambio.valor.replace('.', ',')), ` (${k.cambio.fonte}${k.cambioPosterior ? '; câmbio posterior ao gasto' : ''}) = ${dinheiro(k.principal)}`);
  if (k.spreadParam && k.spreadMinor) p.append(' + ', param(k.spreadParam, `spread ${k.spreadParam.valor.replace('.', ',')}%`), ` ${dinheiro(k.spreadMinor)}`);
  if (k.iofParam && k.iofMinor) p.append(' + ', param(k.iofParam, `IOF ${k.iofParam.valor.replace('.', ',')}%`), ` ${dinheiro(k.iofMinor)}`);
  p.append(` = ${dinheiro(k.total)}`);
  return p;
}
function contaTexto(orig, conta, tipo) {
  if (tipo === 'efetivo') return `${original(orig)} → ${dinheiro(conta.fatura)} pela fatura (valor efetivo)`;
  if (!conta) return `${original(orig)}: sem câmbio para converter`;
  return explicarConversao(orig, conta);
}
// "US$ 100,00 × 5,0826 (PTAX venda BCB, 16/10/2026) = R$ 508,26 + spread 4% R$ 20,33 + IOF 3,5% R$ 18,50 = R$ 547,09"
function explicarConversao(orig, k) {
  let t = `${original(orig)} × ${k.cambio.valor.replace('.', ',')} (${k.cambio.fonte}${k.cambioPosterior ? '; câmbio posterior ao gasto' : ''}) = ${dinheiro(k.principal)}`;
  if (k.spreadParam && k.spreadMinor) t += ` + spread ${k.spreadParam.valor.replace('.', ',')}% ${dinheiro(k.spreadMinor)}`;
  if (k.iofParam && k.iofMinor) t += ` + IOF ${k.iofParam.valor.replace('.', ',')}% ${dinheiro(k.iofMinor)}`;
  return t + ` = ${dinheiro(k.total)}`;
}

// ── manchete do mês: frase de modelo fixo, sem IA ─────────────────────────────────────────────────────────────────
function manchete(l, c) {
  if (!l.total) return `${capital(mesLongo(l.mes))}: nada lançado nem previsto ainda.`;
  const pctLancado = Math.round(l.realizado * 100 / l.total);
  const maior = l.porCategoria[0];
  const eu = l.porSocia.find(s => s.id === c.membro.id);
  let f = `${capital(mesLongo(l.mes))}: ${dinheiro(l.total)} de custo, ${pctLancado}% já lançado.`;
  if (maior) f += ` ${maior.rotulo} é ${permilTexto(maior.permil)} do mês.`;
  if (eu && eu.parte !== null) f += ` Sua parte: ${dinheiro(eu.parte)}.`;
  return f;
}
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

// ── Livro do mês ───────────────────────────────────────────────────────────────────────────────────────────────
function renderLivro(D) {
  const alvo = $('livro-content');
  if (!alvo) return;
  const {c, aplicado} = D;
  const l = R.livroDoMes(c.estado, aplicado, mesAtual, hojeDe(c));
  alvo.replaceChildren();
  // seletor de mês (o endereço acompanha: #livro/2026-09)
  const irAoMes = mes => { mesAtual = mes; trocarRota('livro', argsDoLivro(c)); renderTudo(true); };
  const nav = el('div', 'lv-mesnav');
  const ant = botao('‹', 'button-outline lv-mes-seta', () => irAoMes(somaMes(mesAtual, -1))); ant.setAttribute('aria-label', 'Mês anterior');
  const prox = botao('›', 'button-outline lv-mes-seta', () => irAoMes(somaMes(mesAtual, 1))); prox.setAttribute('aria-label', 'Próximo mês');
  const titulo = el('h3', 'lv-mes-titulo', capital(mesLongo(mesAtual)));
  titulo.setAttribute('aria-live', 'polite');
  nav.append(ant, titulo, prox);
  if (mesAtual !== hojeDe(c).slice(0, 7)) nav.append(botao('Voltar ao mês atual', 'button-quiet', () => irAoMes(hojeDe(c).slice(0, 7))));
  alvo.append(nav);
  anexarExtras(alvo, 'livro-topo', D, {mes: mesAtual}, 'lv-extras');
  // nível 1: manchete e números
  alvo.append(el('p', 'lv-manchete', manchete(l, c)));
  const eu = l.porSocia.find(s => s.id === c.membro.id);
  const kpis = el('div', 'lv-kpis');
  kpis.append(
    kpi('Já lançado', l.realizado, `${l.linhas.filter(x => x.tipo === 'realizado' && !x.anulado).length} lançamentos no mês`, () => verConta('Já lançado em ' + mesLongo(l.mes), l.explica.realizado, c)),
    kpi('Previsto até o fim do mês', l.previsto, 'assinaturas ativas ainda sem lançamento', () => verConta('Previsto em ' + mesLongo(l.mes), l.explica.previsto, c), 'previsto'),
    kpi('Custo do mês', l.total, 'lançado + previsto', () => verConta('Custo de ' + mesLongo(l.mes), contaDoTotal(l), c), 'total'),
    kpi('Sua parte', eu && eu.parte !== null ? eu.parte : null, eu && eu.parte !== null ? `${eu.pct}% de participação` : 'participação não fecha 100%', eu && eu.parte !== null ? () => verConta('Sua parte em ' + mesLongo(l.mes), {formula: `Sua parte = custo do mês × ${eu.pct}% (rateio pelo maior resto: a soma das partes dá o total exato)`, termos: [{rotulo: 'Custo do mês', brl: l.total, op: '+', detalhe: {titulo: 'Custo de ' + mesLongo(l.mes), explica: contaDoTotal(l)}}], resultado: eu.parte, excluidos: []}, c) : null, 'destaque'),
  );
  alvo.append(kpis);
  if (l.incompletos.length) {
    const av = el('div', 'notice lv-aviso');
    av.append(el('strong', null, `${l.incompletos.length} ${l.incompletos.length === 1 ? 'item ficou' : 'itens ficaram'} fora das contas: `), el('span', null, l.incompletos.map(i => `${i.descricao} (${i.motivo})`).join('; ')));
    alvo.append(av);
  }
  // nível 2: gráficos
  const grade = el('div', 'lv-grade');
  const cartaoComp = cartao('Para onde vai o dinheiro', 'Por categoria, em reais. Lançado e previsto juntos.');
  if (l.porCategoria.length) cartaoComp.append(barra100(l.porCategoria.map(x => ({rotulo: x.rotulo, valor: x.brl, permil: x.permil, slot: x.slot})), {rotulo: `Composição do custo de ${mesLongo(l.mes)}: ${l.porCategoria.map(x => `${x.rotulo} ${permilTexto(x.permil)}`).join(', ')}.`}));
  else cartaoComp.append(el('p', 'lv-vazio', 'Nada lançado nem previsto neste mês.'));
  const cartaoRank = cartao('Os maiores itens do mês', 'Hachurado = previsto pela assinatura, ainda sem lançamento.');
  const itens = l.linhas.filter(x => !x.anulado && x.brl !== null).sort((a, b) => b.brl - a.brl).slice(0, 8)
    .map(x => ({rotulo: x.descricao, valor: x.brl, tipo: x.tipo, slot: R.slotCategoria(x.categoria), nota: x.original.moeda !== 'BRL' ? `${original(x.original)} · ${x.conversao === 'efetivo' ? 'fatura' : 'estimado'}` : (x.tipo === 'previsto' ? 'previsto' : '')}));
  if (itens.length) cartaoRank.append(ranking(itens, {rotulo: `Maiores itens de ${mesLongo(l.mes)}.`}));
  else cartaoRank.append(el('p', 'lv-vazio', 'Sem itens.'));
  grade.append(cartaoComp, cartaoRank);
  alvo.append(grade);
  const serie = R.serieMensal(c.estado, aplicado, mesAtual, 6);
  const cartaoSerie = cartao('Últimos seis meses', 'O que foi lançado em cada mês; no mês aberto, o previsto aparece hachurado por cima.');
  cartaoSerie.append(colunas(serie.map((s, k) => k === serie.length - 1 ? s : {...s, previsto: 0}), {rotulo: 'Custo lançado por mês nos últimos seis meses.', destaque: mesAtual}));
  alvo.append(cartaoSerie);
  // sócias: parte, adiantou, a receber, acerto
  const cartaoSoc = cartao('Entre as sócias', l.balanceado ? 'A parte de cada uma no custo do mês, o que adiantou do bolso e o acerto sugerido.' : 'A participação cadastrada não fecha 100%: o rateio fica suspenso até o cadastro ser corrigido.');
  const tab = el('div', 'lv-socias');
  for (const s of l.porSocia) {
    const linha = el('div', 'lv-socia' + (s.id === c.membro.id ? ' is-eu' : ''));
    linha.append(el('strong', 'lv-socia-nome', s.nome + (s.id === c.membro.id ? ' (você)' : '')), dado('Participação', s.pct === null || s.pct === undefined ? 'a confirmar' : s.pct + '%'),
      dado('Parte no mês', s.parte === null ? '—' : dinheiro(s.parte), 'destaque'), dado('Adiantou do bolso', dinheiro(s.adiantou)), dado('A receber da empresa', dinheiro(s.aReceberDaEmpresa)));
    tab.append(linha);
  }
  cartaoSoc.append(tab);
  const saldos = l.porSocia.filter(s => s.saldoAcerto);
  if (saldos.length) {
    cartaoSoc.append(el('h4', 'lv-sub', 'Acerto dos gastos divididos'));
    cartaoSoc.append(divergentes(l.porSocia.map(s => ({rotulo: s.nome, valor: s.saldoAcerto})), {rotulo: 'Saldo de cada sócia nos gastos divididos: positivo recebe, negativo paga.'}));
    const ul = el('ul', 'lv-transferencias');
    for (const t of l.acerto.transferencias) ul.append(el('li', null, `${nomeDe(c, t.de)} paga ${dinheiro(t.brl)} a ${nomeDe(c, t.para)}`));
    cartaoSoc.append(ul);
  }
  alvo.append(cartaoSoc);
  // nível 3: o livro
  const cartaoLivro = cartao('O livro do mês, até o centavo', 'Cada linha com a moeda original, os reais e de onde veio a conversão. Toque numa linha para ver a conta.');
  cartaoLivro.append(tabelaLivro(l, c));
  alvo.append(cartaoLivro);
}
// a conta do custo do mês com "Realizado" e "Previsto" abrindo a lista de itens de cada um (e cada item, a origem dele)
function contaDoTotal(l) {
  const detalhe = t => /^realizado/i.test(t.rotulo) ? {titulo: 'Já lançado em ' + mesLongo(l.mes), explica: l.explica.realizado}
    : /^previsto/i.test(t.rotulo) ? {titulo: 'Previsto em ' + mesLongo(l.mes), explica: l.explica.previsto} : null;
  return {...l.explica.total, termos: l.explica.total.termos.map(t => detalhe(t) ? {...t, detalhe: detalhe(t)} : t)};
}
// os argumentos do Livro no endereço: o mês (fora o mês corrente) e a aba (#livro/2026-10/fechar)
function argsDoLivro(c) {
  const corrente = hojeDe(c).slice(0, 7);
  return abaLivro ? [mesAtual, abaLivro] : mesAtual && mesAtual !== corrente ? [mesAtual] : [];
}
export function kpi(rotulo, valor, nota, fn, tom = '') {
  const k = el('div', 'lv-kpi' + (tom ? ' is-' + tom : ''));
  k.append(el('span', 'lv-kpi-rotulo', rotulo), el('strong', 'lv-kpi-valor', valor === null ? '—' : dinheiro(valor)), el('span', 'lv-kpi-nota', nota));
  if (fn) { const b = botao('Ver a conta', 'button-quiet lv-ver-conta', fn); k.append(b); }
  return k;
}
export function cartao(titulo, sub) { const c = el('section', 'lv-cartao'); c.append(el('h3', 'lv-cartao-titulo', titulo)); if (sub) c.append(el('p', 'lv-cartao-sub', sub)); return c; }
export function dado(rotulo, valor, tom) { const d = el('div', 'lv-dado' + (tom ? ' is-' + tom : '')); d.append(el('span', null, rotulo), el('strong', null, valor)); return d; }
export function pilula(texto, tipo) { return el('span', 'lv-pilula is-' + tipo, texto); }
function tabelaLivro(l, c) {
  const lista = el('div', 'lv-livro');
  const linhas = [...l.linhas].sort((a, b) => (a.tipo === b.tipo ? (b.data || '').localeCompare(a.data || '') : a.tipo === 'realizado' ? -1 : 1));
  if (!linhas.length) { lista.append(el('p', 'lv-vazio', 'Nada neste mês ainda. Use “+ Lançar” para registrar um gasto da empresa.')); return lista; }
  for (const x of linhas) {
    const item = el('button', 'lv-livro-linha' + (x.anulado ? ' is-anulado' : '') + (x.tipo === 'previsto' ? ' is-previsto' : ''));
    item.type = 'button';
    const cor = el('i', 'gf-cor'); cor.dataset.slot = String(R.slotCategoria(x.categoria));
    const meio = el('span', 'lv-livro-meio');
    meio.append(el('span', 'lv-livro-desc', x.descricao), el('span', 'lv-livro-meta', [x.tipo === 'previsto' ? 'previsto' : dataBR(x.data), R.rotuloCategoria(x.categoria), x.pagoPor ? 'pago por ' + nomeDe(c, x.pagoPor) : null].filter(Boolean).join(' · ')));
    const fim = el('span', 'lv-livro-fim');
    fim.append(el('strong', null, x.brl === null ? 'sem câmbio' : dinheiro(x.brl)));
    if (x.original.moeda !== 'BRL') fim.append(el('span', 'lv-livro-orig', original(x.original)));
    fim.append(x.anulado ? pilula('anulado', 'anulado') : x.conversao === 'estimado' ? pilula('estimado', 'estimado') : x.conversao === 'efetivo' ? pilula('fatura', 'ok') : x.tipo === 'previsto' ? pilula('previsto', 'previsto') : pilula('em reais', 'neutro'));
    item.append(cor, meio, fim);
    item.addEventListener('click', () => verConta(x.descricao, {formula: x.tipo === 'previsto' ? `Equivalente mensal da assinatura (${x.periodo})${x.original.moeda !== 'BRL' ? ', convertido pela estimativa de hoje' : ''}` : 'Valor do lançamento em reais',
      termos: [{rotulo: x.descricao, brl: x.brl ?? 0, op: '+', original: x.original, conta: x.conta, conversao: x.conversao, id: x.id}], resultado: x.brl ?? 0, excluidos: x.anulado ? [{rotulo: x.descricao, motivo: 'anulado: ' + (x.gasto.motivoAnulacao || '')}] : []}, c));
    lista.append(item);
  }
  return lista;
}

// ── resumo no Meu painel ─────────────────────────────────────────────────────────────────────────────────────────
function renderResumo(D) {
  const alvo = $('livro-resumo');
  if (!alvo) return;
  const {c, aplicado} = D;
  const mes = hojeDe(c).slice(0, 7);
  const l = R.livroDoMes(c.estado, aplicado, mes, hojeDe(c));
  const eu = l.porSocia.find(s => s.id === c.membro.id);
  alvo.replaceChildren();
  const box = el('section', 'lv-resumo');
  const cab = el('div', 'lv-resumo-cab');
  cab.append(el('p', 'eyebrow', 'O mês em curso · ' + mesLongo(mes)), botao('Abrir o livro do mês  ↗', 'button-outline', () => window.financeNavigate && window.financeNavigate('livro')));
  box.append(cab, el('p', 'lv-manchete', manchete(l, c)));
  const nums = el('div', 'lv-kpis is-compacto');
  nums.append(kpi('Já lançado', l.realizado, 'no mês'), kpi('Custo do mês', l.total, 'lançado + previsto', null, 'total'), kpi('Sua parte', eu ? eu.parte : null, eu && eu.pct !== null ? eu.pct + '%' : '', null, 'destaque'),
    kpi('A receber da empresa', eu ? eu.aReceberDaEmpresa : 0, 'reembolsos pendentes'));
  box.append(nums);
  if (l.porCategoria.length) box.append(barra100(l.porCategoria.map(x => ({rotulo: x.rotulo, valor: x.brl, permil: x.permil, slot: x.slot})), {rotulo: 'Composição do custo do mês.'}));
  alvo.append(box);
}

// ── Lançamentos ─────────────────────────────────────────────────────────────────────────────────────────────────
function renderLancamentos(D) {
  const alvo = $('lancamentos-content');
  if (!alvo) return;
  const {c, aplicado, lista} = D;
  const comFoco = document.activeElement && document.activeElement.id === 'lv-gasto-destacado';
  alvo.replaceChildren();
  // filtro de sócia vindo do endereço que não é de ninguém daqui: volta a "todas"
  if (!['todas', 'eu'].includes(filtro.socia) && !(c.estado.members || []).some(m => m.id === filtro.socia)) filtro.socia = 'todas';
  // trocar um filtro tira o destaque e atualiza o endereço (#lancamentos?mes=2026-10&socia=m-ana), sem empilhar
  const filtrar = () => { destacado = null; trocarRota('lancamentos', [], filtrosDeLancamentos()); renderTudo(true); };
  const barra = el('div', 'lv-filtros');
  const selSocia = el('select', 'lv-select'); selSocia.setAttribute('aria-label', 'Filtrar por sócia');
  [['todas', 'Todas as sócias'], ['eu', 'Só os meus'], ...(c.estado.members || []).map(m => [m.id, m.displayName])].forEach(([v, t]) => { const o = el('option', null, t); o.value = v; if (filtro.socia === v) o.selected = true; selSocia.append(o); });
  selSocia.addEventListener('change', () => { filtro.socia = selSocia.value; filtrar(); });
  const meses = [...new Set(aplicado.gastos.map(g => g.competencia))].sort().reverse();
  if (filtro.mes && !meses.includes(filtro.mes)) meses.unshift(filtro.mes);
  const selMes = el('select', 'lv-select'); selMes.setAttribute('aria-label', 'Filtrar por mês');
  [['', 'Todos os meses'], ...meses.map(m => [m, capital(mesLongo(m))])].forEach(([v, t]) => { const o = el('option', null, t); o.value = v; if ((filtro.mes || '') === v) o.selected = true; selMes.append(o); });
  selMes.addEventListener('change', () => { filtro.mes = selMes.value || null; filtrar(); });
  barra.append(selSocia, selMes, el('span', 'lv-espaco'), ...desenharExtras('lancamentos-barra', D, {filtro: {...filtro}}), botao('Baixar CSV', 'button-outline', () => baixarCSV(D)), botao('+ Lançar', 'button-primary', () => abrirLancar()));
  alvo.append(barra);
  let gastos = [...aplicado.gastos].sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  if (filtro.socia === 'eu') gastos = gastos.filter(g => g.criadoPor === c.membro.id || g.pagoPor === c.membro.id);
  else if (filtro.socia !== 'todas') gastos = gastos.filter(g => g.pagoPor === filtro.socia || g.criadoPor === filtro.socia);
  if (filtro.mes) gastos = gastos.filter(g => g.competencia === filtro.mes);
  const totais = {};
  for (const g of gastos) if (g.estado !== 'anulado') totais[g.moeda] = (totais[g.moeda] || 0) + g.valorMinor;
  const resumo = el('p', 'lv-totais');
  resumo.append(el('span', null, `${gastos.filter(g => g.estado !== 'anulado').length} lançamentos · `), el('strong', null, Object.entries(totais).map(([m, v]) => dinheiro(v, m)).join(' + ') || 'nada'), el('span', 'lv-nota-inline', ' (cada moeda separada)'));
  alvo.append(resumo);
  // o lançamento do link ficou fora dos filtros (ou não existe mais): diz isso, em vez de sumir calado
  if (destacado && !gastos.some(g => g.id === destacado)) {
    const alvoDoLink = aplicado.gastos.find(g => g.id === destacado);
    const av = el('div', 'notice lv-aviso');
    av.append(el('strong', null, alvoDoLink ? `${rotuloDestaque}: “${alvoDoLink.descricao}” está fora destes filtros. ` : `${rotuloDestaque}: o lançamento não foi encontrado neste diário. `));
    if (alvoDoLink) av.append(botao('Mostrar o lançamento', 'button-quiet', () => { filtro.socia = 'todas'; filtro.mes = alvoDoLink.competencia; trocarRota('lancamentos', [], filtrosDeLancamentos()); renderTudo(true); requestAnimationFrame(() => focarDestaque('lv-gasto-destacado')); }));
    alvo.append(av);
  }
  if (!gastos.length) {
    const vazio = el('div', 'lv-vazio-grande');
    vazio.append(el('strong', null, 'Nenhum lançamento por aqui.'), el('span', null, 'Pagou algo pela empresa, no cartão dela ou do seu bolso? Registre em uns 10 segundos: entra no mês, no rateio e no acerto.'), botao('+ Lançar o primeiro gasto', 'button-primary', () => abrirLancar()));
    alvo.append(vazio);
    return;
  }
  const ul = el('div', 'lv-lancamentos');
  for (const g of gastos) ul.append(cartaoGasto(g, D));
  alvo.append(ul);
  if (comFoco && $('lv-gasto-destacado')) $('lv-gasto-destacado').focus({preventScroll: true});
}
const filtrosDeLancamentos = () => ({...(filtro.mes ? {mes: filtro.mes} : {}), ...(filtro.socia !== 'todas' ? {socia: filtro.socia} : {}), ...(destacado ? {id: destacado} : {})});
function cartaoGasto(g, D) {
  const {c, lista} = D;
  const r = R.reaisDoGasto(g, lista);
  const art = el('article', 'lv-gasto' + (g.estado === 'anulado' ? ' is-anulado' : ''));
  const cor = el('i', 'gf-cor'); cor.dataset.slot = String(R.slotCategoria(g.categoria));
  const corpo = el('div', 'lv-gasto-corpo');
  corpo.append(el('strong', 'lv-gasto-desc', g.descricao), el('span', 'lv-gasto-meta', `${dataBR(g.data)} · ${R.rotuloCategoria(g.categoria)} · ${R.rotuloForma(g.forma)}${R.formaDaEmpresa(g.forma) ? '' : ' · ' + ((R.DESTINOS.find(x => x.id === g.destino) || {}).rotulo || '')}`));
  const autoria = el('span', 'lv-autoria', `pago por ${nomeDe(c, g.pagoPor)} · lançado por ${nomeDe(c, g.criadoPor)} em ${horaBR(g.criadoEm)}${g.alteradoEm ? ' · alterado por ' + nomeDe(c, g.alteradoPor) + ' em ' + horaBR(g.alteradoEm) : ''}`);
  corpo.append(autoria);
  if (g.estado === 'anulado') corpo.append(el('span', 'lv-motivo', `Anulado por ${nomeDe(c, g.anuladoPor)}: ${g.motivoAnulacao}`));
  if (destacado && g.id === destacado) destacar(art, corpo, 'lv-gasto-destacado');
  if (g.destino === 'empresa_reembolsa' && g.estado !== 'anulado') corpo.append(pilula(g.reembolsadoEm ? 'reembolsado' : 'reembolso pendente', g.reembolsadoEm ? 'ok' : 'pendente'));
  const valor = el('div', 'lv-gasto-valor');
  valor.append(el('strong', null, dinheiro(g.valorMinor, g.moeda)));
  if (g.moeda !== 'BRL') valor.append(el('span', null, r.brl === null ? 'sem câmbio' : `≈ ${dinheiro(r.brl)} · ${r.tipo === 'efetivo' ? 'fatura' : 'estimado'}`));
  const acoes = el('div', 'lv-gasto-acoes');
  const pode = g.estado !== 'anulado' && (g.criadoPor === c.membro.id || c.membro.papel === 'owner');
  if (pode) {
    acoes.append(botao('Editar', 'button-quiet', () => abrirLancar(g)));
    acoes.append(botao('Anular', 'button-quiet', () => anular(g)));
  }
  if (g.estado !== 'anulado' && g.destino === 'empresa_reembolsa' && !g.reembolsadoEm) acoes.append(botao('Marcar reembolsado', 'button-quiet', () => gravar({acao: 'mark_reimbursed', alvo: g.id, versao: g.versao}, 'Reembolso marcado.')));
  if (g.versoes.length) acoes.append(botao(`Histórico (${g.versoes.length})`, 'button-quiet', () => window.financeNavigate && window.financeNavigate('historico')));
  art.append(cor, corpo, valor, acoes);
  return art;
}
function baixarCSV(D) {
  const csv = R.csvLancamentos(D.aplicado, D.lista, id => nomeDe(D.c, id));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = `lancamentos-${hojeDe(D.c)}.csv`;
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function anular(g) {
  const motivo = await pedirTexto('Anular lançamento', `“${g.descricao}” sai das contas e continua visível, riscado, com o motivo. Por que anular?`, 'Ex.: lançado em duplicidade');
  if (motivo) gravar({acao: 'void_expense', alvo: g.id, versao: g.versao, motivo}, 'Lançamento anulado.');
}
export function pedirTexto(titulo, texto, exemplo) {
  return new Promise(ok => {
    const d = el('dialog', 'lv-dialogo lv-pergunta');
    const f = el('form');
    f.method = 'dialog';
    const campo = el('input'); campo.required = true; campo.placeholder = exemplo; campo.maxLength = 300;
    const lbl = el('label', 'field'); lbl.append(el('span', null, 'Motivo'), campo);
    const acoes = el('div', 'lv-dialogo-acoes');
    const cancelar = botao('Cancelar', 'button-outline', () => { d.close(); ok(null); });
    const confirmar = el('button', 'button button-primary', 'Confirmar'); confirmar.type = 'submit';
    acoes.append(cancelar, confirmar);
    f.append(el('h2', null, titulo), el('p', null, texto), lbl, acoes);
    f.addEventListener('submit', e => { e.preventDefault(); const v = campo.value.trim(); if (!v) return; d.close(); ok(v); });
    d.append(f); document.body.append(d);
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0));
    d.showModal(); campo.focus();
  });
}

// ── gravar: tudo passa pelo diário; o domínio confere antes, para o erro aparecer no formulário ───────────────────────
// Aceita qualquer ação do razão: a prévia roda o mesmo R.aplicar sobre o diário + este evento, e a recusa volta com o
// motivo antes de enviar. {erroNoFormulario: true} não abre aviso: quem chamou mostra o erro dentro do formulário
// (a folha comum faz isso sozinha). Depois de gravar, a página se redesenha (a não ser que haja folha aberta).
export async function gravar(conteudo, ok = 'Salvo.', opcoes = {}) {
  const falhar = erro => { if (!opcoes.erroNoFormulario) toast(erro, 'erro'); return {ok: false, erro}; };
  const D = dados();
  if (!D || !D.d) return falhar('O diário ainda está abrindo. Tente de novo em instantes.');
  const simulado = R.aplicar(D.c.estado, [...D.d.eventos, {seq: Infinity, id: 'previa', membro: D.c.membro.id, conteudo: {...conteudo, quando: new Date().toISOString()}}]);
  const recusa = simulado.recusados.find(x => x.id === 'previa');
  if (recusa) return {...falhar(recusa.motivo), codigo: recusa.codigo || null, atual: recusa.atual || null};
  const r = await D.d.acrescentar(conteudo);
  if (!r.ok) { if (!opcoes.erroNoFormulario) toast(r.erro, 'erro'); return r; }
  if (conteudo.acao === 'add_expense') ultimoLancamento = {id: conteudo.alvo, ate: Date.now() + 8000};
  toast(ok + (r.treino ? ' (modo treino: some ao recarregar)' : ''), 'ok', DESFAZ[conteudo.acao] ? () => desfazer(conteudo.acao, conteudo.alvo) : null);
  renderTudo(true);
  return r;
}
// "Desfazer" (8 s) de uma inclusão é a anulação dela, com motivo: nada some do diário
const DESFAZ = {
  add_expense: {colecao: 'gastos', acao: 'void_expense', ok: 'Lançamento desfeito.'},
  add_income: {colecao: 'receitas', acao: 'void_income', ok: 'Receita desfeita.'},
};
function desfazer(acao, id) {
  const regra = DESFAZ[acao], D = dados();
  const item = D && (D.aplicado[regra.colecao] || []).find(x => x.id === id);
  if (item && item.estado !== 'anulado' && item.estado !== 'anulada') gravar({acao: regra.acao, alvo: id, versao: item.versao, motivo: 'desfeito logo após lançar'}, regra.ok);
}
let toastTimer = null;
export function toast(texto, tom = 'ok', desfazerFn = null) {
  let t = $('lv-toast');
  if (!t) { t = el('div', 'lv-toast'); t.id = 'lv-toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.replaceChildren(el('span', null, texto));
  t.className = 'lv-toast is-' + tom + ' is-visivel';
  if (desfazerFn) t.append(botao('Desfazer', 'button-outline', () => { t.classList.remove('is-visivel'); desfazerFn(); }));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visivel'), desfazerFn ? 8000 : 5000);
}

// ── + Lançar: valor primeiro, descrição com autocompletar das assinaturas, prévia da conversão e da sua parte ─────────
let folha = null;
function abrirLancar(existente = null, sugestao = null) {
  if (existente && !existente.id) { sugestao = existente; existente = null; }
  const D = dados();
  if (!D) return;
  const {c, lista} = D;
  if (folha) folha.remove();
  folha = el('dialog', 'lv-dialogo lv-folha');
  folha.setAttribute('aria-label', existente ? 'Editar lançamento' : 'Lançar gasto');
  const f = el('form', 'lv-form');
  f.noValidate = true;
  const hoje = hojeDe(c), ontem = new Date(new Date(hoje + 'T12:00:00').getTime() - 864e5).toISOString().slice(0, 10);
  const g = existente || {data: hoje, competencia: hoje.slice(0, 7), moeda: 'BRL', forma: 'cartao_pj', pagoPor: c.membro.id, destino: 'empresa_reembolsa', categoria: '', descricao: '', valorMinor: null, documento: '', nota: '', faturaBrlMinor: null, planoId: null};
  if (sugestao) { // "Lançar pagamento" de uma assinatura: descrição, moeda, valor e categoria já vêm preenchidos
    const plano = (c.estado.plans || []).find(p => p.id === sugestao.planoId);
    Object.assign(g, {descricao: sugestao.descricao || '', planoId: sugestao.planoId || null});
    if (plano) Object.assign(g, {moeda: R.MOEDAS.includes(plano.currency) ? plano.currency : 'BRL', valorMinor: Number.isSafeInteger(plano.amountMinor) ? plano.amountMinor : null, categoria: R.palpiteCategoria(plano.servico)});
  }
  const topo = el('div', 'lv-dialogo-topo');
  const tt = el('div'); tt.append(el('p', 'eyebrow', existente ? 'Corrigir é criar uma versão nova: a anterior fica no histórico' : 'Gasto da empresa'), el('h2', null, existente ? 'Editar lançamento' : 'Lançar gasto'));
  topo.append(tt, botao('Fechar', 'button-outline', () => folha.close()));
  f.append(topo);
  const faixa = faixaModo(D.d); if (faixa) f.append(faixa);
  // valor + moeda
  const linhaValor = el('div', 'lv-valor-linha');
  const moeda = el('select', 'lv-moeda'); moeda.setAttribute('aria-label', 'Moeda');
  R.MOEDAS.forEach(m => { const o = el('option', null, m === 'BRL' ? 'R$' : m === 'USD' ? 'US$' : '€'); o.value = m; if (g.moeda === m) o.selected = true; moeda.append(o); });
  const valor = el('input', 'lv-valor'); valor.inputMode = 'decimal'; valor.autocomplete = 'off'; valor.placeholder = '0,00'; valor.setAttribute('aria-label', 'Valor');
  if (g.valorMinor) valor.value = (g.valorMinor / 100).toFixed(2).replace('.', ',');
  linhaValor.append(moeda, valor);
  f.append(campoComRotulo('Quanto', linhaValor));
  // descrição com sugestões das assinaturas
  const desc = el('input'); desc.maxLength = 160; desc.value = g.descricao; desc.placeholder = 'Ex.: Anthropic API, contador, domínio…'; desc.setAttribute('list', 'lv-sugestoes');
  const dl = el('datalist'); dl.id = 'lv-sugestoes';
  const planos = (c.estado.plans || []).filter(p => p.servico);
  planos.forEach(p => { const o = el('option'); o.value = [p.servico, p.plano].filter(Boolean).join(' · '); dl.append(o); });
  f.append(campoComRotulo('O quê', desc), dl);
  // categoria em chips
  const chips = el('div', 'lv-chips'); chips.setAttribute('role', 'radiogroup'); chips.setAttribute('aria-label', 'Categoria');
  let categoria = g.categoria;
  const desenharChips = () => { chips.replaceChildren(); for (const cat of R.CATEGORIAS) { const b = el('button', 'lv-chip' + (categoria === cat.id ? ' is-ativo' : '')); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(categoria === cat.id)); const i = el('i', 'gf-cor'); i.dataset.slot = String(cat.slot); b.append(i, el('span', null, cat.rotulo)); b.addEventListener('click', () => { categoria = cat.id; desenharChips(); previa(); }); chips.append(b); } };
  desenharChips();
  f.append(campoComRotulo('Categoria', chips));
  // data
  const dataLinha = el('div', 'lv-chips');
  const dataIn = el('input'); dataIn.type = 'date'; dataIn.value = g.data; dataIn.max = '2099-12-31'; dataIn.setAttribute('aria-label', 'Data');
  const atalho = (rot, v) => { const b = el('button', 'lv-chip', rot); b.type = 'button'; b.addEventListener('click', () => { dataIn.value = v; previa(); }); return b; };
  dataLinha.append(atalho('Hoje', hoje), atalho('Ontem', ontem), dataIn);
  f.append(campoComRotulo('Quando', dataLinha));
  // quem pagou e como
  const pagoPor = el('select', 'lv-select'); pagoPor.setAttribute('aria-label', 'Quem pagou');
  (c.estado.members || []).forEach(m => { const o = el('option', null, m.id === c.membro.id ? m.displayName + ' (eu)' : m.displayName); o.value = m.id; if (g.pagoPor === m.id) o.selected = true; pagoPor.append(o); });
  if (c.membro.papel !== 'owner' && !existente) pagoPor.disabled = true;
  f.append(campoComRotulo('Quem pagou', pagoPor));
  const formas = el('div', 'lv-chips'); formas.setAttribute('role', 'radiogroup'); formas.setAttribute('aria-label', 'Como foi pago');
  let forma = g.forma;
  const destinoBox = el('div', 'lv-destino');
  let destino = g.destino && g.destino !== 'nao_aplica' ? g.destino : 'empresa_reembolsa';
  const desenharFormas = () => {
    formas.replaceChildren();
    for (const fo of R.FORMAS) { const b = el('button', 'lv-chip' + (forma === fo.id ? ' is-ativo' : ''), fo.rotulo); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(forma === fo.id)); b.addEventListener('click', () => { forma = fo.id; desenharFormas(); previa(); }); formas.append(b); }
    destinoBox.replaceChildren();
    destinoBox.hidden = R.formaDaEmpresa(forma);
    if (!destinoBox.hidden) {
      destinoBox.append(el('span', 'lv-rotulo', 'Pago do próprio bolso. E agora?'));
      for (const de of R.DESTINOS) {
        const lbl = el('label', 'lv-radio' + (destino === de.id ? ' is-ativo' : ''));
        const r = el('input'); r.type = 'radio'; r.name = 'lv-destino'; r.value = de.id; r.checked = destino === de.id;
        r.addEventListener('change', () => { destino = de.id; desenharFormas(); previa(); });
        const txt = el('span'); txt.append(el('strong', null, de.rotulo), el('small', null, de.explica));
        lbl.append(r, txt); destinoBox.append(lbl);
      }
    }
  };
  desenharFormas();
  f.append(campoComRotulo('Como foi pago', formas), destinoBox);
  // mais opções
  const mais = el('details', 'lv-mais');
  mais.append(el('summary', null, 'Mais opções: competência, documento, valor da fatura, nota'));
  const comp = el('input'); comp.type = 'month'; comp.value = g.competencia; comp.setAttribute('aria-label', 'Competência');
  const doc = el('input'); doc.maxLength = 40; doc.value = g.documento || ''; doc.placeholder = 'Nº da nota, recibo, fatura';
  const fatura = el('input'); fatura.inputMode = 'decimal'; fatura.placeholder = 'Quanto veio na fatura, em R$'; if (g.faturaBrlMinor) fatura.value = (g.faturaBrlMinor / 100).toFixed(2).replace('.', ',');
  const nota = el('textarea'); nota.maxLength = 400; nota.rows = 2; nota.value = g.nota || '';
  mais.append(campoComRotulo('Competência (mês em que o gasto conta)', comp), campoComRotulo('Documento', doc), campoComRotulo('Valor efetivo da fatura (gastos em moeda estrangeira)', fatura), campoComRotulo('Nota', nota));
  if (existente) mais.open = true;
  f.append(mais);
  let motivoIn = null;
  if (existente && existente.criadoPor !== c.membro.id) { motivoIn = el('input'); motivoIn.maxLength = 300; motivoIn.placeholder = 'Obrigatório ao mudar o lançamento de outra sócia'; f.append(campoComRotulo('Motivo da mudança', motivoIn)); }
  // prévia ao vivo
  const prev = el('div', 'lv-previa'); prev.setAttribute('aria-live', 'polite');
  const erro = el('p', 'form-error lv-erro'); erro.hidden = true;
  f.append(prev, erro);
  const acoes = el('div', 'lv-dialogo-acoes');
  const salvar = el('button', 'button button-primary', existente ? 'Salvar a correção' : 'Salvar'); salvar.type = 'submit';
  acoes.append(botao('Cancelar', 'button-outline', () => folha.close()));
  if (!existente) acoes.append(botao('Salvar e lançar outro', 'button-outline', () => enviar(true)));
  acoes.append(salvar);
  f.append(acoes);

  const ler = () => {
    const m = moeda.value;
    const minor = R.centavosBR(valor.value, m);
    const fat = fatura.value.trim() ? R.centavosBR(fatura.value, 'BRL') : null;
    let compet = comp.value || (dataIn.value || '').slice(0, 7);
    if (!existente && comp.value === g.competencia && dataIn.value && dataIn.value.slice(0, 7) !== g.competencia) { compet = dataIn.value.slice(0, 7); comp.value = compet; }
    const plano = planos.find(p => [p.servico, p.plano].filter(Boolean).join(' · ') === desc.value.trim());
    return {data: dataIn.value, competencia: compet, descricao: desc.value.trim(), categoria, valorMinor: minor, moeda: m, forma, pagoPor: pagoPor.value, destino: R.formaDaEmpresa(forma) ? 'nao_aplica' : destino,
      planoId: plano ? plano.id : (existente ? existente.planoId : null), documento: doc.value.trim(), nota: nota.value.trim(), faturaBrlMinor: fat};
  };
  function previa() {
    const v = ler();
    prev.replaceChildren();
    if (!v.valorMinor) { prev.append(el('span', 'lv-previa-dica', valor.value.trim() ? (v.moeda === 'BRL' ? 'Use vírgula para os centavos: 1.500,00 é mil e quinhentos.' : 'Valor não reconhecido.') : 'Digite o valor: a conta aparece aqui.')); return; }
    const r = R.reaisDoGasto({...v}, lista);
    const linha1 = el('p', 'lv-previa-conta');
    if (v.moeda === 'BRL') linha1.append(el('strong', null, dinheiro(v.valorMinor)));
    else if (r.tipo === 'efetivo') linha1.append(`${dinheiro(v.valorMinor, v.moeda)} → `, el('strong', null, dinheiro(r.brl)), ' pela fatura');
    else if (r.brl === null) linha1.append(`Sem câmbio de ${v.moeda} cadastrado: cadastre em Parâmetros, ou informe o valor da fatura.`);
    else linha1.append(explicarConversao({minor: v.valorMinor, moeda: v.moeda}, r.conta), ' · ', el('strong', null, 'estimado'));
    prev.append(linha1);
    const membros = c.estado.members || [];
    const pcts = membros.map(m => m.participationPct);
    if (r.brl !== null && pcts.every(p => typeof p === 'number') && pcts.reduce((a, b) => a + b, 0) === 100) {
      const partes = R.ratear(r.brl, pcts.map(String));
      const k = membros.findIndex(m => m.id === c.membro.id);
      const txt = `Sua parte ${dinheiro(partes[k])} · entra em ${mesLongo(v.competencia || hoje.slice(0, 7))}${v.categoria ? ' · ' + R.rotuloCategoria(v.categoria) : ''}`;
      prev.append(el('p', 'lv-previa-parte', txt));
    }
    const dup = D.aplicado.gastos.find(x => x.estado !== 'anulado' && x.id !== (existente && existente.id) && x.valorMinor === v.valorMinor && x.moeda === v.moeda && x.descricao.toLowerCase() === v.descricao.toLowerCase() && Math.abs(new Date(x.data) - new Date(v.data)) < 4 * 864e5);
    if (dup) prev.append(el('p', 'lv-previa-alerta', `Atenção: ${nomeDe(c, dup.criadoPor)} lançou algo igual em ${dataBR(dup.data)}. Confira se não é duplicidade.`));
  }
  desc.addEventListener('change', () => {
    const plano = planos.find(p => [p.servico, p.plano].filter(Boolean).join(' · ') === desc.value.trim());
    if (plano) { moeda.value = plano.currency in {BRL: 1, USD: 1, EUR: 1} ? plano.currency : moeda.value; if (!valor.value) valor.value = (plano.amountMinor / 100).toFixed(2).replace('.', ','); }
    if (!categoria) { categoria = R.palpiteCategoria(desc.value); desenharChips(); }
    previa();
  });
  [valor, moeda, desc, dataIn, comp, fatura, pagoPor].forEach(n => n.addEventListener('input', previa));
  async function enviar(outro) {
    const v = ler();
    erro.hidden = true;
    const falta = !v.valorMinor ? 'Informe o valor (use vírgula para os centavos).' : !v.descricao ? 'Descreva o gasto.' : !v.categoria ? 'Escolha uma categoria.' : !v.data ? 'Informe a data.' : (motivoIn && !motivoIn.value.trim()) ? 'Diga o motivo da mudança.' : null;
    if (falta) { erro.textContent = falta; erro.hidden = false; return; }
    salvar.disabled = true;
    const conteudo = existente ? {acao: 'edit_expense', alvo: existente.id, versao: existente.versao, dados: v, motivo: motivoIn ? motivoIn.value.trim() : ''} : {acao: 'add_expense', alvo: novoAlvo(), dados: v};
    const r = await gravar(conteudo, existente ? 'Correção salva.' : `Lançado: ${dinheiro(v.valorMinor, v.moeda)} · ${v.descricao}`);
    salvar.disabled = false;
    if (!r.ok) { erro.textContent = r.erro || 'Não foi possível salvar.'; erro.hidden = false; return; }
    if (outro) { valor.value = ''; desc.value = ''; doc.value = ''; nota.value = ''; fatura.value = ''; categoria = ''; desenharChips(); previa(); valor.focus(); }
    else folha.close();
  }
  f.addEventListener('submit', e => { e.preventDefault(); enviar(false); });
  folha.append(f);
  document.body.append(folha);
  folha.addEventListener('close', () => { const ff = folha; setTimeout(() => ff && ff.remove(), 0); if (folha === ff) folha = null; renderTudo(true); });
  folha.showModal();
  previa();
  valor.focus();
}
export function campoComRotulo(rotulo, controle) { const box = el('div', 'field lv-campo'); box.append(el('span', 'lv-rotulo', rotulo), controle); return box; }
function novoAlvo() { return 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

// ── Parâmetros ───────────────────────────────────────────────────────────────────────────────────────────────────
function renderParametros(D) {
  const alvo = $('parametros-content');
  if (!alvo || paramAberto) return; // não redesenha com um formulário aberto
  const {c, lista, aplicado} = D;
  const hoje = hojeDe(c);
  const comFoco = document.activeElement && document.activeElement.id === 'lv-param-destacado';
  alvo.replaceChildren();
  anexarExtras(alvo, 'parametros-barra', D, {}, 'lv-filtros lv-extras');
  alvo.append(el('p', 'section-intro lv-intro', 'Parâmetro é um fato com fonte (o dólar de hoje, a alíquota vigente); premissa é uma aposta de cenário e continua no Med Painel. Mudar um parâmetro cria uma vigência nova a partir de uma data: os gastos anteriores continuam com o valor da época deles.'));
  const grupos = [...new Set(R.CATALOGO.map(x => x.grupo))];
  for (const grupo of grupos) {
    const sec = cartao(grupo, null);
    for (const item of R.CATALOGO.filter(x => x.grupo === grupo)) sec.append(linhaParametro(item, lista, hoje, D));
    alvo.append(sec);
  }
  if (paramDestacado && !R.CATALOGO.some(x => x.chave === paramDestacado)) {
    const av = el('div', 'notice lv-aviso');
    av.append(el('strong', null, `${rotuloDestaque}: este parâmetro não existe mais no portal.`));
    alvo.prepend(av);
  }
  if (comFoco && $('lv-param-destacado')) $('lv-param-destacado').focus({preventScroll: true});
}
function linhaParametro(item, lista, hoje, D) {
  const atual = R.vigente(lista, item.chave, hoje);
  const historico = lista.filter(p => p.chave === item.chave).sort((a, b) => b.desde.localeCompare(a.desde) || b.ordem - a.ordem);
  const linha = el('div', 'lv-param');
  linha.dataset.param = item.chave;
  const aberto = paramDestacado === item.chave;
  const info = el('div', 'lv-param-info');
  info.append(el('strong', 'lv-param-rotulo', item.rotulo), el('p', 'lv-param-explica', item.explica));
  const meta = el('p', 'lv-param-meta');
  if (atual) meta.append(`vale desde ${dataBR(atual.desde)} · ${atual.fonte}${atual.por ? ' · por ' + nomeDe(D.c, atual.por) : ' · padrão do portal'}`);
  else meta.append('sem valor cadastrado: os gastos nesta moeda ficam "sem câmbio" até alguém informar');
  info.append(meta);
  const valor = el('div', 'lv-param-valor');
  valor.append(el('strong', null, atual ? formatarParam(atual.valor, item) : '—'));
  if (atual) valor.append(pilula(atual.semente ? (atual.estado === 'a_confirmar' ? 'a confirmar' : 'padrão do portal') : R.ESTADOS_PARAMETRO[atual.estado] || atual.estado, atual.estado === 'a_confirmar' ? 'pendente' : atual.semente ? 'neutro' : 'ok'));
  const acoes = el('div', 'lv-param-acoes');
  acoes.append(botao('Nova vigência', 'button-outline', () => formParametro(item, atual, linha, D)));
  if (item.chave.startsWith('fx.')) acoes.append(botao('Atualizar pela PTAX', 'button-quiet', () => formParametro(item, atual, linha, D, true)));
  // o parâmetro aberto pelo endereço (#parametros/fx.USD_BRL) mostra o histórico mesmo com uma vigência só
  if (historico.length > 1 || (aberto && historico.length)) {
    const det = el('details', 'lv-param-hist');
    det.open = aberto;
    det.append(el('summary', null, `Histórico (${historico.length})`));
    const ul = el('ol', 'lv-degraus');
    for (const p of historico) ul.append(el('li', null, `${dataBR(p.desde)} · ${formatarParam(p.valor, item)} · ${p.fonte}${p.por ? ' · ' + nomeDe(D.c, p.por) + ' em ' + horaBR(p.quando) : ''}${p.nota ? ' · ' + p.nota : ''}`));
    det.append(ul); info.append(det);
  }
  linha.append(info, valor, acoes);
  if (aberto) destacar(linha, info, 'lv-param-destacado');
  return linha;
}
function formatarParam(v, item) {
  const n = String(v).replace('.', ',');
  return item.unidade === '%' ? n + '%' : item.unidade === 'R$' ? 'R$ ' + n : n + ' ' + item.unidade;
}
async function ptax(moeda) {
  const fim = new Date(), ini = new Date(fim.getTime() - 10 * 864e5);
  const mdy = d => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='${moeda}'&@dataInicial='${mdy(ini)}'&@dataFinalCotacao='${mdy(fim)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao,tipoBoletim`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('o Banco Central respondeu ' + r.status);
  const j = await r.json();
  const fech = (j.value || []).filter(x => x.tipoBoletim === 'Fechamento');
  const ult = (fech.length ? fech : j.value || []).slice(-1)[0];
  if (!ult) throw new Error('sem cotação nos últimos 10 dias');
  return {valor: ult.cotacaoVenda.toFixed(4), data: ult.dataHoraCotacao.slice(0, 10), fonte: `PTAX venda BCB ${dataBR(ult.dataHoraCotacao.slice(0, 10))} (${ult.tipoBoletim.toLowerCase()})`};
}
function formParametro(item, atual, linha, D, comPtax = false) {
  paramAberto = item.chave;
  const hoje = hojeDe(D.c);
  const f = el('form', 'lv-param-form');
  const valor = el('input'); valor.inputMode = 'decimal'; valor.value = atual ? atual.valor.replace('.', ',') : ''; valor.setAttribute('aria-label', 'Novo valor');
  const desde = el('input'); desde.type = 'date'; desde.value = hoje;
  const fonte = el('input'); fonte.maxLength = 160; fonte.placeholder = 'De onde veio: fatura, contador, site oficial…';
  const nota = el('input'); nota.maxLength = 300; nota.placeholder = 'Opcional';
  const estado = el('select'); [['vigente', 'Vigente'], ['a_confirmar', 'A confirmar']].forEach(([v, t]) => { const o = el('option', null, t); o.value = v; estado.append(o); });
  const impacto = el('div', 'lv-impacto'); impacto.setAttribute('aria-live', 'polite');
  const erro = el('p', 'form-error'); erro.hidden = true;
  const grade = el('div', 'lv-param-grade');
  grade.append(campoComRotulo(`Novo valor (${item.unidade})`, valor), campoComRotulo('Vale a partir de', desde), campoComRotulo('Fonte', fonte), campoComRotulo('Situação', estado), campoComRotulo('Nota', nota));
  const acoes = el('div', 'lv-dialogo-acoes');
  const fechar = () => { paramAberto = null; renderTudo(true); };
  const salvar = el('button', 'button button-primary', 'Salvar a nova vigência'); salvar.type = 'submit';
  acoes.append(botao('Cancelar', 'button-outline', fechar), salvar);
  f.append(el('p', 'lv-param-form-titulo', 'Nova vigência: o valor anterior continua valendo para as datas anteriores.'), grade, impacto, erro, acoes);
  const calcular = () => {
    impacto.replaceChildren();
    const v = R.decimal(valor.value, item.casas);
    if (!v) { impacto.append(el('span', null, `Até ${item.casas} casas decimais, com vírgula.`)); return; }
    const num = Number(v.n) / Number(v.d);
    if (num < item.dura[0] || num > item.dura[1]) { impacto.append(el('span', 'lv-previa-alerta', `Fora da faixa aceita (${item.dura[0]} a ${item.dura[1]} ${item.unidade}).`)); return; }
    if (num < item.macia[0] || num > item.macia[1]) impacto.append(el('p', 'lv-previa-alerta', `Valor incomum para ${item.rotulo}: confira antes de salvar.`));
    const mes = (desde.value || hoje).slice(0, 7);
    const antes = R.livroDoMes(D.c.estado, D.aplicado, mes, hoje).total;
    const sim = R.aplicar(D.c.estado, [...(D.d ? D.d.eventos : []), {seq: Infinity, id: 'sim', membro: D.c.membro.id, conteudo: {acao: 'set_parameter', dados: {chave: item.chave, valor: valor.value.replace(',', '.'), desde: desde.value || hoje, fonte: 'simulação'}}}]);
    const depois = R.livroDoMes(D.c.estado, sim, mes, hoje).total;
    const delta = depois - antes;
    impacto.append(el('p', null, `Testar sem salvar: o custo de ${mesLongo(mes)} ${delta === 0 ? 'não muda' : (delta > 0 ? 'sobe ' : 'cai ') + dinheiro(Math.abs(delta))} (${dinheiro(antes)} → ${dinheiro(depois)}). Meses anteriores não mudam.`));
  };
  [valor, desde].forEach(n => n.addEventListener('input', calcular));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    erro.hidden = true;
    if (!R.decimal(valor.value, item.casas)) { erro.textContent = 'Valor inválido.'; erro.hidden = false; return; }
    if (!fonte.value.trim()) { erro.textContent = 'Diga de onde veio o valor: é o que permite conferir depois.'; erro.hidden = false; return; }
    salvar.disabled = true;
    const r = await gravar({acao: 'set_parameter', alvo: item.chave, dados: {chave: item.chave, valor: valor.value.replace(',', '.'), desde: desde.value || hoje, fonte: fonte.value.trim(), nota: nota.value.trim(), estado: estado.value}}, `${item.rotulo}: nova vigência salva.`);
    salvar.disabled = false;
    if (r.ok) fechar();
    else { erro.textContent = r.erro || 'Não foi possível salvar.'; erro.hidden = false; }
  });
  linha.append(f);
  calcular();
  if (comPtax) {
    impacto.replaceChildren(el('span', null, 'Buscando a PTAX no Banco Central…'));
    ptax(item.chave.slice(3, 6)).then(p => { valor.value = p.valor.replace('.', ','); desde.value = p.data; fonte.value = p.fonte; calcular(); })
      .catch(err => { impacto.replaceChildren(el('span', 'lv-previa-alerta', 'Não foi possível consultar o Banco Central agora (' + err.message + '). Digite o valor à mão.')); });
  }
  valor.focus();
}

// ── Histórico ───────────────────────────────────────────────────────────────────────────────────────────────────
function renderHistorico(D) {
  const alvo = $('historico-content');
  if (!alvo) return;
  const {c, aplicado, d} = D;
  alvo.replaceChildren();
  const integ = el('div', 'lv-integridade' + (d && d.verificacao && !d.verificacao.integro ? ' is-problema' : ''));
  if (d && d.modo === 'gravacao') {
    integ.append(el('strong', null, d.verificacao.integro ? `Íntegro até o registro ${d.verificacao.ate.toLocaleString('pt-BR')}` : `${d.verificacao.problemas.length} registro(s) não conferem`),
      el('span', null, d.verificacao.integro ? 'Cada registro aponta o anterior, foi assinado por quem o escreveu e só abre com a chave do diário: o servidor não consegue alterar, reordenar nem forjar nada.' : d.verificacao.problemas.map(p => `#${p.seq}: ${p.problema}`).join(' · ')));
  } else integ.append(el('strong', null, 'Diário em treino'), el('span', null, 'Os registros desta sessão vivem só neste navegador.'));
  alvo.append(integ);
  anexarExtras(alvo, 'historico-barra', D, {}, 'lv-filtros lv-extras');
  alvo.append(el('p', 'lv-intro', 'Corrigir nunca apaga: cria um registro novo. Aqui está quem mudou o quê, quando e por quê.'));
  const eventos = [...aplicado.historico].reverse();
  if (!eventos.length) { alvo.append(el('p', 'lv-vazio', 'Nenhum registro ainda.')); }
  let diaAtual = '';
  const lista = el('ol', 'lv-historico');
  for (const h of eventos) {
    const dia = (h.quando || '').slice(0, 10);
    if (dia !== diaAtual) { diaAtual = dia; lista.append(el('li', 'lv-hist-dia', dataBR(dia))); }
    const li = el('li', 'lv-hist-item');
    const ini = el('span', 'lv-inicial', (nomeDe(c, h.autora) || '?').charAt(0));
    const corpo = el('div');
    corpo.append(el('p', null, [`${nomeDe(c, h.autora)} ${verbo(h) || 'fez um registro'}`, resumoDe(h)].filter(Boolean).join(' · ')));
    for (const [k, antes, depois] of camposMudados(h)) {
      const p = el('p', 'lv-diff');
      p.append(el('span', 'lv-campo-nome', nomeCampo(k) + ': '), el('del', null, fmtCampo(k, antes, h.antes, h, c)), ' → ', el('ins', null, fmtCampo(k, depois, h.depois, h, c)));
      corpo.append(p);
    }
    if (h.motivo) corpo.append(el('p', 'lv-motivo', 'Motivo: ' + h.motivo));
    corpo.append(el('span', 'lv-autoria', horaBR(h.quando) + (h.seq && Number.isFinite(h.seq) ? ` · registro ${h.seq}` : '')));
    li.append(ini, corpo);
    lista.append(li);
  }
  alvo.append(lista);
  if (aplicado.recusados.length) {
    const sec = cartao('Recusados', 'Registros que chegaram ao diário mas não passaram nas regras: não entram em nenhuma conta.');
    const ul = el('ul', 'lv-excluidos');
    for (const r of aplicado.recusados) ul.append(el('li', null, `${nomeDe(c, r.autora)} · ${verbo(r) || 'registro de tipo desconhecido'} · ${horaBR(r.quando)}: ${r.motivo}`));
    sec.append(ul); alvo.append(sec);
  }
}
// o verbo vem do razão: h.verbo, ou a tabela VERBOS que ele exporta. Ação que esta versão não conhece não mostra o
// nome técnico (quem chama escreve "fez um registro").
const verbo = h => h.verbo || R.VERBOS[h.acao] || null;
// o resumo do razão; o do parâmetro e o do saldo são refeitos aqui a partir dos dados, porque o razão os escreve com a
// data ISO e o decimal com ponto ("5.1234 R$ por US$ desde 2026-10-18")
function resumoDe(h) {
  const d = h.depois && typeof h.depois === 'object' ? h.depois : null;
  if (h.acao === 'set_parameter' && d) { const item = R.itemCatalogo(d.chave); if (item) return `${item.rotulo}: ${formatarParam(d.valor, item)} desde ${dataBR(d.desde)}`; }
  if (h.acao === 'set_balance' && d && Number.isSafeInteger(d.valorMinor)) return `${d.conta} · ${dinheiro(d.valorMinor, R.MOEDAS.includes(d.moeda) ? d.moeda : 'BRL')} em ${dataBR(d.data)}`;
  return h.resumo || '';
}
// antes → depois de qualquer ação: os campos simples que existem dos dois lados e mudaram (vazio, null e ausente são o
// mesmo "—"). Ficam de fora os de controle (ids, versões, selo) e os de autoria e hora (…Por, …Em), porque a linha já
// diz quem fez e quando; só "quem pagou" (pagoPor) é dado do gasto e aparece, com o nome da sócia. Cada campo sai com o
// nome em português e o valor como a sócia lê: dinheiro, dd/mm/aaaa, mês por extenso, rótulo do enumerado.
const CAMPOS_DE_CONTROLE = new Set(['id', 'versao', 'versoes', 'seq', 'quando', 'por', 'em', 'chave', 'alvo', 'ordem', 'semente', 'doPacote', 'planoId', 'reembolsoId', 'gastoIds', 'selo', 'cabeca', 'totais', 'itens']);
const DE_AUTORIA = /(Por|Em)$/;
const NOMES_CAMPO = {
  // gastos
  descricao: 'descrição', valorMinor: 'valor', moeda: 'moeda', data: 'data', competencia: 'competência', categoria: 'categoria', forma: 'forma de pagamento',
  destino: 'destino', faturaBrlMinor: 'valor da fatura', estado: 'situação', reembolso: 'reembolso', pagoPor: 'quem pagou', documento: 'documento', nota: 'nota', ciclo: 'ciclo pago',
  // parâmetros
  valor: 'valor', desde: 'vale desde', fonte: 'fonte',
  // assinaturas e passos de venda
  servico: 'serviço', plano: 'plano', periodo: 'período', diaVencimento: 'vencimento', proximaData: 'próxima cobrança', status: 'situação',
  confirmado: 'confirmada', assinatura: 'assinatura', encerrado: 'encerrada a partir de', feito: 'feito',
  // receitas
  canal: 'canal', produto: 'produto', brutoMinor: 'receita bruta', canceladosMinor: 'cancelamentos', transacoes: 'vendas', taxasMinor: 'taxas',
  pagantesAtivos: 'pagantes ativos', pagantesNovos: 'pagantes novos', pagantesPerdidos: 'pagantes perdidos', testes: 'testes', cadastros: 'cadastros',
  // acertos, saldos, fatura e mês
  tipo: 'tipo', de: 'de', para: 'para', conta: 'conta', estimadoMinor: 'estimado', faturaMinor: 'fatura', totalFaturaMinor: 'total da fatura',
  diferencaMinor: 'diferença', fechado: 'mês fechado',
};
// campo novo, sem nome na tabela: nunca o camelCase cru ("algumCampoMinor" → "algum campo")
const nomeCampo = k => NOMES_CAMPO[k] || k.replace(/Minor$/, '').replace(/_/g, ' ').replace(/([a-zà-ú])([A-Z])/g, '$1 $2').toLowerCase();
const escondido = k => CAMPOS_DE_CONTROLE.has(k) || (DE_AUTORIA.test(k) && !NOMES_CAMPO[k]);
// o encerramento da assinatura é um objeto {desde, por, em, motivo}: no antes → depois, vale a data
const normalizar = (k, v) => k === 'encerrado' ? (v && typeof v === 'object' ? v.desde || null : v ?? null) : v;
const vazio = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
const simples = v => v === null || v === undefined || typeof v !== 'object' || (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object'));
function camposMudados(h) {
  if (!h.antes || !h.depois || typeof h.antes !== 'object' || typeof h.depois !== 'object') return [];
  const chaves = [...new Set([...Object.keys(h.antes), ...Object.keys(h.depois)])];
  return chaves.filter(k => !escondido(k) && k in h.antes && k in h.depois)
    .map(k => [k, normalizar(k, h.antes[k]), normalizar(k, h.depois[k])])
    .filter(([, a, b]) => simples(a) && simples(b) && !(vazio(a) && vazio(b)) && JSON.stringify(a) !== JSON.stringify(b));
}
// valores enumerados sempre pelo rótulo em português (nunca "nao_aplica" nem "inactive")
const ROTULOS_VALOR = {
  estado: {lancado: 'lançado', anulado: 'anulado', anulada: 'anulada', conferido: 'conferido', vigente: 'vigente', a_confirmar: 'a confirmar', substituido: 'substituído'},
  reembolso: {nao_aplica: 'não se aplica', pendente: 'pendente', reembolsado: 'reembolsado', convertido: 'virou aporte'},
  destino: {nao_aplica: 'não se aplica (pago pela empresa)'},
  assinatura: {active: 'ativa', inactive: 'encerrada', unconfirmed: 'a confirmar', not_applicable: 'não se aplica'},
  periodo: {monthly: 'mensal', mes: 'mensal', yearly: 'anual', ano: 'anual'},
};
const ROTULOS_GERAIS = {nao_aplica: 'não se aplica', a_confirmar: 'a confirmar', nao_informado: 'não informado'};
// textos livres das sócias: aparecem como foram escritos
const TEXTO_LIVRE = new Set(['descricao', 'nota', 'fonte', 'documento', 'servico', 'plano', 'produto', 'status', 'conta']);
const rotuloDe = (lista, id) => (lista.find(x => x.id === id) || {}).rotulo || null;
function enumerado(k, v) {
  const s = String(v);
  if (TEXTO_LIVRE.has(k)) return s;
  const t = (ROTULOS_VALOR[k] && ROTULOS_VALOR[k][s]) || ROTULOS_GERAIS[s];
  if (t) return t;
  return /^[a-z]+(_[a-z]+)+$/.test(s) ? s.replace(/_/g, ' ') : s;   // código desconhecido: ao menos sem o "_"
}
// lado = o objeto (antes ou depois) do qual o valor saiu: dá a moeda do dinheiro; h e c dão o parâmetro e os nomes
function fmtCampo(k, v, lado, h, c) {
  if (vazio(v)) return '—';
  if (/Minor$/.test(k) && Number.isSafeInteger(v)) return dinheiro(v, k !== 'faturaBrlMinor' && lado && R.MOEDAS.includes(lado.moeda) ? lado.moeda : 'BRL');
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (Array.isArray(v)) return v.map(x => fmtCampo(k, x, lado, h, c)).join(', ');
  if (k === 'categoria') return R.rotuloCategoria(v);
  if (k === 'forma') return rotuloDe(R.FORMAS, v) || rotuloDe(R.FORMAS_ACERTO, v) || enumerado(k, v);
  if (k === 'destino') return rotuloDe(R.DESTINOS, v) || enumerado(k, v);
  if (k === 'canal') return rotuloDe(R.CANAIS, v) || enumerado(k, v);
  if (k === 'tipo') return rotuloDe(R.TIPOS_ACERTO, v) || enumerado(k, v);
  if (k === 'moeda') return SIMBOLOS[v] || String(v);
  if (k === 'pagoPor' || k === 'de' || k === 'para' || /Por$/.test(k)) return v === 'empresa' ? 'a empresa' : nomeDe(c, v);
  if (/Em$/.test(k)) return horaBR(v);
  if (k === 'diaVencimento' && Number.isInteger(v)) return 'dia ' + v;
  if (k === 'valor' && h && h.acao === 'set_parameter') { const item = R.itemCatalogo((h.depois && h.depois.chave) || h.alvo); if (item) return formatarParam(v, item); }
  if (typeof v === 'number') return v.toLocaleString('pt-BR');
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return dataBR(v);
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return horaBR(v);
    if (/^\d{4}-\d{2}$/.test(v)) return mesLongo(v);
    if (/^\d+\.\d+$/.test(v)) return v.replace('.', ',');   // decimal: 4.20 → 4,20
    return enumerado(k, v);
  }
  return String(v);
}

// ── a rota (o endereço depois do #) ──────────────────────────────────────────────────────────────────────────────
// rotaAtual() → {pagina, rota, args, filtros}, lida pelo registro do paginas.js: #lancamentos?mes=2026-10&socia=m-ana →
// {pagina: 'lancamentos', rota: 'lancamentos', args: [], filtros: {mes: '2026-10', socia: 'm-ana'}}; #livro/2026-10/fechar
// → {pagina: 'livro', args: ['2026-10', 'fechar'], …}. O app.js dispara 'financeiro:rota' (detail igual, mais origem) a
// cada troca de página, de Voltar ou de filtro: as páginas da rotina leem daqui e ouvem esse evento.
export function rotaAtual() {
  const rotas = window.financeRotas;
  const lida = rotas && typeof rotas.ler === 'function' ? rotas.ler(location.hash) : null;
  if (lida && lida.chave) return {pagina: lida.chave, rota: lida.rota, args: [...lida.args], filtros: {...lida.filtros}};
  const ativa = typeof window.financePaginaAtiva === 'function' ? window.financePaginaAtiva() : 'overview';
  return {pagina: ativa, rota: null, args: [], filtros: {}};
}
// troca os filtros da página no endereço, sem empilhar (o app.js é o dono do histórico)
function trocarRota(pagina, args = [], filtros = {}) {
  if (typeof window.financeAtualizarRota === 'function') window.financeAtualizarRota({pagina, args, filtros});
}
// o lançamento ou o parâmetro que o endereço aponta: contorno ouro, a etiqueta de onde se veio e foco (sem rolar)
function destacar(caixa, onde, id) {
  caixa.classList.add('is-destacado');
  caixa.id = id;
  caixa.tabIndex = -1;
  caixa.style.outline = '2px solid var(--gold)';
  caixa.style.outlineOffset = '4px';
  caixa.style.borderRadius = '12px';
  onde.prepend(pilula(rotuloDestaque, 'neutro'));
}
function focarDestaque(id) {
  const n = $(id);
  if (!n || n.closest('[hidden]')) return;
  try { n.scrollIntoView({block: 'center', behavior: 'instant'}); } catch { n.scrollIntoView({block: 'center'}); }
  n.focus({preventScroll: true});
}
const PAGINAS_COM_ROTA = new Set(['livro', 'lancamentos', 'parametros']);
function aplicarRota(r, origem) {
  if (!r || !PAGINAS_COM_ROTA.has(r.pagina)) return;
  const veio = origem === 'ver-a-conta' ? 'Você veio do Ver a conta' : 'Aberto pelo link';
  if (r.pagina === 'livro') { mesAtual = r.args[0] || null; abaLivro = r.args[1] || null; }
  if (r.pagina === 'lancamentos') { filtro.socia = r.filtros.socia || 'todas'; filtro.mes = r.filtros.mes || null; destacado = r.filtros.id || null; if (destacado) rotuloDestaque = veio; }
  // um link para um parâmetro fecha a "Nova vigência" que estivesse aberta (ela impede o redesenho); sem parâmetro, fica
  if (r.pagina === 'parametros') { paramDestacado = r.args[0] || null; if (paramDestacado) { paramAberto = null; rotuloDestaque = veio; } }
  renderTudo(true);
  const alvo = r.pagina === 'lancamentos' && destacado ? 'lv-gasto-destacado' : r.pagina === 'parametros' && paramDestacado ? 'lv-param-destacado' : null;
  // depois do app.js restaurar a rolagem e focar o título da página (o rAF dele vem antes deste)
  if (alvo) requestAnimationFrame(() => requestAnimationFrame(() => focarDestaque(alvo)));
}
document.addEventListener('financeiro:rota', e => { const r = e.detail || {}; if (r.origem !== 'pagina') aplicarRota({pagina: r.pagina, args: r.args || [], filtros: r.filtros || {}}, r.origem); });

// ── ganchos das telas da rotina: páginas e extras registrados pelos módulos novos ─────────────────────────────────────
// registrarPagina(fn): fn(D) roda a cada redesenho (o mesmo de renderTudo), depois das páginas daqui.
// registrarExtra(lugar, fn): fn(D, contexto) devolve um nó (ou lista de nós, ou nada) para um lugar fixo de uma página
// daqui. Nenhum dos dois roda com uma folha aberta. Um módulo que falha não derruba os outros (o erro vai ao console).
const paginas = [];
const LUGARES = ['livro-topo', 'lancamentos-barra', 'parametros-barra', 'historico-barra'];
const extras = Object.fromEntries(LUGARES.map(l => [l, []]));
let redesenhoMarcado = false;
function marcarRedesenho() { if (redesenhoMarcado) return; redesenhoMarcado = true; queueMicrotask(() => { redesenhoMarcado = false; renderTudo(true); }); }
const tirar = (lista, fn) => () => { const k = lista.indexOf(fn); if (k >= 0) { lista.splice(k, 1); marcarRedesenho(); } };
export function registrarPagina(fn) {
  if (typeof fn !== 'function') throw new TypeError('registrarPagina espera uma função (D) => void.');
  paginas.push(fn); marcarRedesenho();
  return tirar(paginas, fn);
}
export function registrarExtra(lugar, fn) {
  if (!extras[lugar]) throw new Error(`Lugar desconhecido para extra: “${lugar}”. Os lugares são ${LUGARES.join(', ')}.`);
  if (typeof fn !== 'function') throw new TypeError('registrarExtra espera uma função (D, contexto) => nó.');
  extras[lugar].push(fn); marcarRedesenho();
  return tirar(extras[lugar], fn);
}
function desenharExtras(lugar, D, contexto) {
  const nos = [];
  for (const fn of extras[lugar]) {
    try { for (const n of [].concat(fn(D, contexto) ?? [])) if (n && typeof n === 'object' && n.nodeType) nos.push(n); }
    catch (erro) { console.error(`Um extra de ${lugar} falhou ao desenhar:`, erro); }
  }
  return nos;
}
// sem extra registrado, a página fica exatamente como era (nenhum contêiner vazio)
function anexarExtras(alvo, lugar, D, contexto, cls) {
  const nos = desenharExtras(lugar, D, contexto);
  if (!nos.length) return;
  const caixa = el('div', cls);
  caixa.dataset.lugar = lugar;
  caixa.append(...nos);
  alvo.append(caixa);
}

// ── folha comum (.sheet, plano §6.7): diálogo de 520px no desktop, folha de baixo no celular ───────────────────────────
// abrirFolha({eyebrow, titulo, corpo, acoes}) devolve {dialogo, corpo, form, fechar, erro(texto), gravar(conteudo, ok)}.
// corpo: nó, lista de nós, texto ou função (folha) => nó(s). acoes: nós prontos ou {rotulo, primaria?, fn(folha)}; a
// primária é o submit (Enter). fn pode devolver o resultado do folha.gravar: {ok: false, erro} mostra o erro dentro da
// folha e a mantém aberta, false a mantém aberta sem erro, qualquer outra coisa fecha. "Cancelar" entra sozinho.
// Enquanto ela está aberta, nem renderTudo nem as páginas registradas redesenham (§3.7); ao fechar, a página atualiza.
let folhaComum = null;
export const folhaAberta = () => !!((folha && folha.open) || (folhaComum && folhaComum.open));
export function abrirFolha({eyebrow = '', titulo = '', corpo = null, acoes = [], rotulo = null, faixa = true, cancelar = true, aoFechar = null} = {}) {
  if (folhaComum) folhaComum.close();
  const D = dados();
  const dialogo = el('dialog', 'lv-dialogo sheet');
  dialogo.setAttribute('aria-label', rotulo || titulo || 'Folha');
  const form = el('form', 'lv-form lv-folha-form');
  form.noValidate = true;
  const topo = el('div', 'lv-dialogo-topo');
  const tt = el('div');
  if (eyebrow) tt.append(el('p', 'eyebrow', eyebrow));
  tt.append(el('h2', null, titulo));
  topo.append(tt, botao('Fechar', 'button-outline', () => dialogo.close()));
  form.append(topo);
  if (faixa && D) { const fx = faixaModo(D.d); if (fx) form.append(fx); }
  const conteudo = el('div', 'lv-folha-corpo');
  const erro = el('p', 'form-error lv-erro');
  erro.setAttribute('role', 'alert');
  erro.hidden = true;
  const caixaAcoes = el('div', 'lv-dialogo-acoes');
  form.append(conteudo, erro, caixaAcoes);
  const api = {
    dialogo, corpo: conteudo, form,
    fechar: () => dialogo.close(),
    erro: texto => { erro.textContent = texto || ''; erro.hidden = !texto; },
    gravar: (c, ok) => gravar(c, ok, {erroNoFormulario: true}),
  };
  const nos = typeof corpo === 'function' ? corpo(api) : corpo;
  for (const n of [].concat(nos ?? [])) conteudo.append(typeof n === 'string' ? el('p', null, n) : n);
  let primaria = null;
  async function executar(acao) {
    api.erro(null);
    const botoes = [...caixaAcoes.querySelectorAll('button')];
    botoes.forEach(b => { b.disabled = true; });
    let r;
    try { r = await acao.fn(api); }
    catch (e) { r = {ok: false, erro: (e && e.message) || 'Não foi possível concluir.'}; }
    finally { botoes.forEach(b => { b.disabled = false; }); }
    if (r === false || !dialogo.open) return;
    if (r && r.ok === false) { api.erro(r.erro || 'Não foi possível salvar.'); return; }
    dialogo.close();
  }
  if (cancelar) caixaAcoes.append(botao('Cancelar', 'button-outline', () => dialogo.close()));
  for (const a of acoes) {
    if (a && a.nodeType) { caixaAcoes.append(a); continue; }
    const b = el('button', 'button ' + (a.primaria ? 'button-primary' : 'button-outline'), a.rotulo);
    b.type = a.primaria && !primaria ? 'submit' : 'button';
    if (b.type === 'submit') primaria = a;
    else b.addEventListener('click', () => executar(a));
    caixaAcoes.append(b);
  }
  form.addEventListener('submit', e => { e.preventDefault(); if (primaria) executar(primaria); });
  dialogo.append(form);
  document.body.append(dialogo);
  dialogo.addEventListener('close', () => {
    setTimeout(() => dialogo.remove(), 0);
    if (folhaComum === dialogo) folhaComum = null;
    if (aoFechar) { try { aoFechar(); } catch (e) { console.error(e); } }
    renderTudo(true);
  });
  folhaComum = dialogo;
  dialogo.showModal();
  const primeiro = conteudo.querySelector('input:not([type=hidden]),select,textarea');
  if (primeiro) primeiro.focus();
  return api;
}

// ── campo de dinheiro: digitado à moda brasileira, lido em centavos inteiros pelo R.centavosBR ─────────────────────────
// campoDinheiro('BRL', {valorMinor, rotulo}) devolve a caixa (para o campoComRotulo) com .input, .ler() → centavos ou
// null, e .definir(centavos). O texto do valor inicial sai dos centavos sem passar por número com vírgula flutuante.
const SIMBOLOS = {BRL: 'R$', USD: 'US$', EUR: '€'};
const NOMES_MOEDA = {BRL: 'reais', USD: 'dólares', EUR: 'euros'};
function textoDeCentavos(minor) {
  const s = String(Math.abs(minor)).padStart(3, '0');
  return (minor < 0 ? '-' : '') + s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s.slice(-2);
}
export function campoDinheiro(moeda = 'BRL', {valorMinor = null, rotulo = 'Valor', placeholder = '0,00'} = {}) {
  const caixa = el('div', 'lv-dinheiro');
  const simbolo = el('span', 'lv-dinheiro-moeda', SIMBOLOS[moeda] || moeda);
  simbolo.setAttribute('aria-hidden', 'true');
  const input = el('input', 'lv-dinheiro-valor');
  input.inputMode = 'decimal'; input.autocomplete = 'off'; input.placeholder = placeholder;
  input.setAttribute('aria-label', `${rotulo} em ${NOMES_MOEDA[moeda] || moeda}`);
  caixa.append(simbolo, input);
  caixa.input = input;
  caixa.moeda = moeda;
  caixa.ler = () => R.centavosBR(input.value, moeda);
  caixa.definir = minor => { input.value = Number.isSafeInteger(minor) ? textoDeCentavos(minor) : ''; };
  caixa.definir(valorMinor);
  return caixa;
}

// ── ciclo ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function renderTudo(forcar = false) {
  desenharModo();
  const D = dados();
  desenharFaixaGlobal(D);
  const lancar = $('lancar-button');
  if (lancar) lancar.hidden = !D;
  const lancarGaveta = $('drawer-lancar');
  if (lancarGaveta) lancarGaveta.hidden = !D;
  // no celular o botão do cabeçalho espremia o título: vira um botão flutuante, fora do cabeçalho (que tem
  // backdrop-filter e por isso prenderia um position:fixed dentro dele)
  let fab = $('lancar-fab');
  if (!fab && D) { fab = el('button', 'lv-fab', '+ Lançar'); fab.id = 'lancar-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Lançar um gasto da empresa'); fab.addEventListener('click', () => abrirLancar()); document.body.append(fab); }
  if (fab) fab.hidden = !D || !document.getElementById('dashboard') || document.getElementById('dashboard').hidden;
  if (!D) return;
  if (!mesAtual) mesAtual = hojeDe(D.c).slice(0, 7);
  const assinatura = [D.d ? D.d.modo + ':' + D.d.cabeca + ':' + D.d.eventos.length + ':' + D.d.verificacao.problemas.length : 'x', D.c.estado.revision, mesAtual, abaLivro, filtro.socia, filtro.mes, destacado, paramDestacado].join('|');
  if (!forcar && assinatura === ultimoDesenho) return;
  ultimoDesenho = assinatura;
  if (folhaComum && folhaComum.open) return; // nunca redesenhar com a folha aberta (§3.7): ao fechar, redesenha
  if (folha && folha.open) { renderResumo(D); return; }
  renderResumo(D); renderLivro(D); renderLancamentos(D); renderParametros(D); renderHistorico(D);
  for (const fn of paginas) { try { fn(D); } catch (erro) { console.error('Uma página da rotina falhou ao desenhar:', erro); } }
}
window.financeLivroRender = () => renderTudo(false);
window.financeLivro = {abrirLancar: (sugestao) => abrirLancar(null, sugestao || null), renderTudo, gravar, abrirFolha, folhaAberta: () => folhaAberta()};
const painel = $('dashboard');
if (painel) new MutationObserver(() => renderTudo(true)).observe(painel, {attributes: true, attributeFilter: ['hidden']});
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#lancar-button')) abrirLancar(); });
document.addEventListener('financeiro:diario', () => renderTudo(true));
async function sincronizarDeTempoEmTempo() {
  const d = livroHost() && livroHost().diario ? livroHost().diario() : null;
  if (!d || d.modo !== 'gravacao' || document.visibilityState !== 'visible') return;
  const antes = d.cabeca;
  try { await d.sincronizar(); } catch {}
  if (d.cabeca !== antes) renderTudo(true); else desenharModo();
}
setInterval(sincronizarDeTempoEmTempo, 60000);
window.addEventListener('focus', sincronizarDeTempoEmTempo);
document.addEventListener('visibilitychange', sincronizarDeTempoEmTempo);
window.addEventListener('beforeunload', e => { const d = livroHost() && livroHost().diario && livroHost().diario(); if (d && d.fila > 0) { e.preventDefault(); e.returnValue = ''; } });
// ao carregar: o endereço que já está aí (o app.js pode ter aplicado a rota de entrada antes deste módulo chegar) e a
// folha "+ Lançar" pedida por #lancar nesse meio-tempo
aplicarRota(rotaAtual(), 'entrada');
renderTudo(true);
if (window.financeLancarPendente) { window.financeLancarPendente = false; abrirLancar(); }
