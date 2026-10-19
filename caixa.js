// Caixa (fatia F2-7): o que entrou, o que saiu, quanto há no banco e quanto tempo o caixa dura. Em #caixa-calculado,
// nos três níveis de leitura do plano (§6.4): a manchete ("Caixa de R$ 21.765,00 em 18/10: dá ≈ 9,2 meses na queima
// média de 1 mês fechado.") com quatro números (No banco · Queima média · Fôlego · Resultado do mês) e o "Ver a conta"
// de cada um; dois gráficos (o fluxo de 12 meses e a cascata "Para onde vão os R$ 2.396,00 de outubro"); e o livro: as
// receitas do mês por canal ("+ Receita", corrigir, anular) e os saldos por conta ("+ Saldo", com o aviso do saldo
// antigo). Quando esta parte aparece, o <details> do registro importado de 18/10 fecha (continua ali, a um toque).
// No Meu painel (#livro-resumo, pelo registrarResumo do livro.js, que não importa o contas.js): a manchete do mês
// ("Outubro: saiu R$ 1.166,41; R$ 1.388,47 comprometidos por mês; o caixa dá ≈ 9,2 meses; nada atrasado."), cada trecho
// um link, a sua parte, os quatro números (Saiu este mês · Comprometido por mês · Caixa · Fôlego), o minigráfico de 12
// meses e as mudanças recentes das outras sócias.
//
// Todo número sai do contas.js (receitasDoMes, resultadoDoMes, cascataDoMes, caixaInformado, folego, serie12m,
// manchetePainel, mudancasRecentes) e o "Ver a conta" é a explicação da mesma função: nada aqui soma dinheiro. Sem
// dado, a tela diz o que falta ("precisa de 1 mês fechado", "sem queima de caixa", "falta informar o saldo do banco");
// nunca um número inventado, e o fôlego sempre com "≈" e "média de N meses". Toda gravação passa pelo diário (folha e
// gravar do livro.js, com a prévia do razão): add_income, edit_income, void_income e set_balance. Plano: PLANO-PORTAL §5
// Caixa, Receitas e Meu painel, §4.6 F7–F9 e F13, §6.4 e §8.8; PLANO-FASES-2-3 F2-7. Fluxo: ferramentas/arnes/fluxos/caixa.mjs.
import {registrarPagina, registrarResumo, dados, el, botao, cartao, dado, pilula, nomeDe, hojeDe, dataBR, horaBR, verConta, abrirFolha, campoDinheiro, campoComRotulo, gravar, pedirTexto, irPara, rotaAtual, renderTudo} from './livro.js';
import * as R from './razao.js';
import * as C from './contas.js';
import {dinheiro, fluxo, cascata, minigrafico, mesLongo, mesCurto} from './graficos.js';

const $ = id => document.getElementById(id);
const host = () => (window.financeHost && typeof window.financeHost === 'object') ? window.financeHost : {};
const MENOS = '−';
const comMenos = minor => dinheiro(minor).replace('-', MENOS);   // negativo com o sinal de menos de verdade (U+2212)
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const Mes = mes => capital(mesLongo(mes).replace(/ de \d{4}$/, ''));
const mesMinusculo = mes => mesLongo(mes).replace(/ de \d{4}$/, '');
const somarMeses = C.somarMeses;
const novoAlvo = prefixo => prefixo + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const SIMBOLO = {BRL: 'R$', USD: 'US$', EUR: '€'};
const NOMES_MOEDA = {BRL: 'Reais (R$)', USD: 'Dólar (US$)', EUR: 'Euro (€)'};
// saldo com mais de uma semana pede o de hoje (a mesma régua do dólar "mais de 7 dias" no roteiro do fechamento)
const IDADE_MAXIMA = 7;
// "… em 2026-10-18" (o resumo do razão) → "… em 18/10/2026"
const dataComum = texto => String(texto || '').replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1');
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// a ponte diz, ação por ação, se dá para gravar agora (gravação ligada ou treino); sem a pergunta, nada grava daqui
function pode(acao) {
  const h = host();
  if (typeof h.pode !== 'function') return {ok: false, motivo: 'Esta versão do portal ainda não grava receitas e saldos.'};
  try {
    const r = h.pode(acao);
    return r && r.ok ? {ok: true, treino: !!r.treino} : {ok: false, motivo: (r && r.motivo) || 'Não dá para gravar agora.'};
  } catch { return {ok: false, motivo: 'Não foi possível conferir se dá para gravar agora.'}; }
}

// ── as contas, uma vez por redesenho (o Caixa e o Meu painel recebem o mesmo D) ───────────────────────────────────────
const memo = new WeakMap();
function lembrar(D, chave, fn) {
  let m = memo.get(D.aplicado);
  if (!m) { m = new Map(); memo.set(D.aplicado, m); }
  if (!m.has(chave)) m.set(chave, fn());
  return m.get(chave);
}
const hojeD = D => hojeDe(D.c);
const mesHojeD = D => hojeD(D).slice(0, 7);
const folegoDe = D => lembrar(D, 'folego', () => C.folego(D.c.estado, D.aplicado, hojeD(D)));
const serieDe = D => lembrar(D, 'serie', () => C.serie12m(D.c.estado, D.aplicado, mesHojeD(D), hojeD(D)));
const resultadoDe = (D, mes) => lembrar(D, 'resultado:' + mes, () => C.resultadoDoMes(D.c.estado, D.aplicado, D.lista, mes, hojeD(D)));
const cascataDe = (D, mes) => lembrar(D, 'cascata:' + mes, () => C.cascataDoMes(D.c.estado, D.aplicado, D.lista, mes, hojeD(D), D.c.membro.id));
const mancheteDe = D => lembrar(D, 'manchete', () => C.manchetePainel(D.c.estado, D.aplicado, hojeD(D), D.c.membro.id));
const livroDe = (D, mes) => lembrar(D, 'livro:' + mes, () => R.livroDoMes(D.c.estado, D.aplicado, mes, hojeD(D)));
const fechamentoDe = (D, mes) => { const f = D.aplicado.fechamentos && Object.hasOwn(D.aplicado.fechamentos, mes) ? D.aplicado.fechamentos[mes] : null; return f && f.fechado ? f : null; };

// ── "Ver a conta": as explicações do contas.js, com cada termo levando à conta dele (‹ Voltar no próprio diálogo) ─────
const detalhe = (titulo, explica) => explica ? {titulo, explica} : null;
const comDetalhes = (explica, porRotulo) => ({...explica, excluidos: explica.excluidos || [],
  termos: explica.termos.map(t => { const d = porRotulo(t); return d ? {...t, detalhe: d} : t; })});
// custo do mês = realizado + previsto, cada um abrindo a lista de itens (o mesmo do Livro do mês)
function contaDoCusto(l) {
  return comDetalhes(l.explica.total, t => /^realizado/i.test(t.rotulo) ? detalhe('Já lançado em ' + mesLongo(l.mes), l.explica.realizado)
    : /^previsto/i.test(t.rotulo) ? detalhe('Previsto em ' + mesLongo(l.mes), l.explica.previsto) : null);
}
// resultado = receita bruta − taxas − imposto − custo do mês, cada termo com a conta dele
function contaDoResultado(r) {
  const m = mesMinusculo(r.mes);
  const e = r.explica.resultado;
  return comDetalhes({...e, formula: `${e.formula}: ${e.texto}`}, t => /^receita bruta/i.test(t.rotulo) ? detalhe(`Receita bruta de ${m}`, r.receitas.explica.bruto)
    : /^taxas/i.test(t.rotulo) ? detalhe(`Taxas das plataformas em ${m}`, r.receitas.explica.taxas)
    : /^imposto/i.test(t.rotulo) ? detalhe(`Imposto (Simples) de ${m}`, r.receitas.explica.imposto)
    : /^custo/i.test(t.rotulo) ? detalhe(`Custo de ${m}`, contaDoCusto(r.livro)) : null);
}
// líquido de uma linha de receita: bruto − taxa − imposto, cada um com a fórmula ("Taxa Hotmart = 9,9% × …")
function contaDaLinha(l) {
  return comDetalhes(l.explica.liquido, t => /^receita bruta/i.test(t.rotulo) ? detalhe(`Receita bruta · ${l.rotulo}`, l.explica.bruto)
    : /^taxa/i.test(t.rotulo) ? detalhe(`Taxa · ${l.rotulo}`, l.explica.taxas)
    : /^imposto/i.test(t.rotulo) ? detalhe(`Imposto · ${l.rotulo}`, l.explica.imposto) : null);
}
function contaDoLiquido(rec) {
  const m = mesMinusculo(rec.mes);
  return comDetalhes(rec.explica.liquido, t => /^receita bruta/i.test(t.rotulo) ? detalhe(`Receita bruta de ${m}`, rec.explica.bruto)
    : /^taxas/i.test(t.rotulo) ? detalhe(`Taxas das plataformas em ${m}`, rec.explica.taxas)
    : /^imposto/i.test(t.rotulo) ? detalhe(`Imposto (Simples) de ${m}`, rec.explica.imposto) : null);
}
// queima média: cada mês fechado abre "saiu − entrou" daquele mês (os mesmos números do fluxo de 12 meses)
function contaDaQueima(D, f) {
  const e = f.explica.queima;
  return comDetalhes(e, t => {
    const mes = t.ref && t.ref.tipo === 'mes' ? t.ref.id : null;
    const p = mes ? serieDe(D).find(x => x.mes === mes && !x.futuro) : null;
    if (!p || p.saiu - p.entrou !== t.brl) return null;
    return detalhe(`Queima de ${mesLongo(mes)}`, {formula: 'Queima do mês = o que saiu − o que entrou', resultado: t.brl, excluidos: [],
      termos: [{rotulo: 'Saiu (custos, taxas e imposto)', brl: p.saiu, op: '+', detalhe: detalhe(`O que saiu em ${mesLongo(mes)}`, p.explica.saiu)},
        {rotulo: 'Entrou (receita bruta)', brl: p.entrou, op: '−', detalhe: detalhe(`O que entrou em ${mesLongo(mes)}`, p.explica.entrou)}]});
  });
}
// O fôlego é em meses, não em reais: o diálogo é este, com o mesmo visual do "Ver a conta". Caixa e queima abrem a
// conta deles (em reais) por cima; ao fechar, volta-se a este.
let dialogoFolego = null;
function verFolego(D, f) {
  if (!dialogoFolego) {
    dialogoFolego = el('dialog', 'lv-dialogo lv-conta cx-conta-folego');
    dialogoFolego.setAttribute('aria-label', 'A conta do fôlego');
    dialogoFolego.addEventListener('click', e => { if (e.target === dialogoFolego) dialogoFolego.close(); });
    document.body.append(dialogoFolego);
  }
  const d = dialogoFolego;
  d.replaceChildren();
  const topo = el('div', 'lv-dialogo-topo'), tt = el('div');
  const h2 = el('h2', null, 'Fôlego do caixa'); h2.tabIndex = -1;
  tt.append(el('p', 'eyebrow', 'De onde vem este número'), h2);
  topo.append(tt, botao('Fechar', 'button-outline', () => d.close()));
  // o fôlego é aproximado: "… por mês = 9,2 meses" vira "… por mês ≈ 9,2 meses", como no total logo abaixo
  const contaEmTexto = f.estado === 'ok' && f.explica.texto ? f.explica.texto.replace(/ = (?=[^=]*$)/, ' ≈ ') : f.explica.texto;
  d.append(topo, el('p', 'lv-formula', f.explica.formula + (contaEmTexto ? '. ' + contaEmTexto : '')));
  const ol = el('ol', 'lv-termos');
  const termo = (op, rotulo, valor, abrir) => {
    const li = el('li'), cab = el('div', 'lv-termo-cab');
    const b = botao(rotulo + '  ›', 'button-quiet lv-ver-conta lv-termo-rotulo', abrir);
    b.style.justifySelf = 'start'; b.style.marginTop = '0'; b.style.textAlign = 'left';
    cab.append(el('span', 'lv-termo-op', op), b, el('span', 'lv-termo-valor', valor));
    li.append(cab); ol.append(li);
  };
  termo('=', f.explica.termos[0].rotulo, f.caixaInformado.temSaldo ? dinheiro(f.caixa) : 'não informado', () => verConta('Caixa: o último saldo de cada conta', f.caixaInformado.explica, D.c));
  if (f.queimaMedia !== null) termo('÷', f.explica.termos[1] ? f.explica.termos[1].rotulo : `Queima média (${f.rotuloBase})`, comMenos(f.queimaMedia) + ' por mês', () => verConta(`Queima média (${f.rotuloBase})`, contaDaQueima(D, f), D.c));
  d.append(ol);
  const tot = el('div', 'lv-termo-total');
  tot.append(el('span', null, f.estado === 'ok' ? '≈' : '='), el('strong', null, f.estado === 'ok' ? f.texto.replace(/^≈\s*/, '') : f.texto));
  d.append(tot);
  if (f.estado === 'ok' && f.parcial) d.append(el('p', 'lv-nota', 'Uma conta ficou fora do caixa por falta de câmbio: o fôlego é parcial.'));
  d.append(el('p', 'lv-nota', 'Fôlego é por quantos meses o dinheiro no banco dura, se a empresa continuar gastando como nos meses fechados. Usa só meses fechados (os números deles não mudam mais), no máximo os 3 últimos, e diz sempre de quantos meses é a média. Sem mês fechado ou sem saldo, o portal não inventa o número.'));
  if (!d.open) d.showModal(); else h2.focus();
}

// ── o foco depois de redesenhar: volta ao mesmo controle (data-chave), sem rolar ─────────────────────────────────────
const chaveEmFoco = alvo => { const a = document.activeElement; return a && alvo.contains(a) && a.dataset ? a.dataset.chave || null : null; };
function devolverFoco(alvo, chave) {
  if (!chave) return false;
  const n = alvo.querySelector(`[data-chave="${CSS.escape(chave)}"]`);
  if (!n || n.disabled || n.closest('[hidden]')) return false;
  n.focus({preventScroll: true});
  return true;
}
// depois de uma folha (gravou ou não), o foco vai ao controle equivalente ou ao título da parte que mudou
let focoPendente = null;
function aplicarFoco() {
  const p = focoPendente;
  focoPendente = null;
  const alvo = $('caixa-calculado');
  if (!p || !alvo) return;
  if (!devolverFoco(alvo, p.chave) && p.titulo) devolverFoco(alvo, p.titulo);
}
const marcar = (n, chave) => { n.dataset.chave = chave; return n; };

// um número da manchete: rótulo, valor (já em texto), nota e o "Ver a conta"
function numero({chave, rotulo, texto, nota, tom = '', abrir = null, minor = null, falta = false}) {
  const k = el('div', 'lv-kpi cx-kpi' + (tom ? ' is-' + tom : '') + (falta ? ' is-falta' : ''));
  k.dataset.numero = chave;
  if (minor !== null && minor !== undefined) k.dataset.minor = String(minor);
  // espaço comum depois do "R$": numa coluna estreita a cifra desce inteira para a linha de baixo, nunca partida no meio
  k.append(el('span', 'lv-kpi-rotulo', rotulo), el('strong', 'lv-kpi-valor', texto.replace(/(R\$|US\$|€)\u00a0/, '$1 ')), el('span', 'lv-kpi-nota', nota));
  if (abrir) {
    const b = marcar(botao('Ver a conta', 'button-quiet lv-ver-conta', abrir), 'conta:' + chave);
    b.setAttribute('aria-label', `Ver a conta: ${rotulo}, ${texto}`);
    k.append(b);
  }
  return k;
}
// os textos do fôlego em cada estado (o portal nunca inventa o número)
function textosDoFolego(f) {
  if (f.estado === 'ok') return {texto: f.texto, nota: `na queima ${f.rotuloBase}`, falta: false};
  if (f.estado === 'sem_mes_fechado') return {texto: 'precisa de 1 mês fechado', nota: 'o fôlego usa só meses fechados', falta: true};
  if (f.estado === 'sem_queima') return {texto: 'sem queima de caixa', nota: `entrou mais do que saiu (${f.rotuloBase})`, falta: true};
  return {texto: 'falta o saldo do banco', nota: 'informe o saldo da conta da empresa', falta: true};
}
function numeroDoFolego(D, f, chave = 'folego') {
  const t = textosDoFolego(f);
  const k = numero({chave, rotulo: 'Fôlego', texto: t.texto, nota: t.nota, tom: f.estado === 'ok' ? 'destaque' : '', falta: t.falta, abrir: () => verFolego(D, f)});
  k.dataset.estado = f.estado;
  if (f.decimos !== null) k.dataset.decimos = String(f.decimos);
  return k;
}
// a nota do caixa: a data e as contas; com saldo antigo, a data é a do saldo mais antigo ("em 19/10 · há 42 dias"
// faria parecer que o saldo de 19/10 tem 42 dias)
function notaDoCaixa(f) {
  const cx = f.caixaInformado;
  if (!cx.temSaldo) return 'falta informar o saldo do banco';
  const contas = plural(cx.contas.filter(c => c.brl !== null).length, 'conta', 'contas');
  if (!(cx.idadeMaxDias > IDADE_MAXIMA)) return `em ${dataBR(f.dataDoCaixa)} · ${contas}`;
  const antigo = cx.contas.find(c => c.idadeDias === cx.idadeMaxDias);
  return antigo.data === f.dataDoCaixa ? `em ${dataBR(antigo.data)} · ${contas} · há ${cx.idadeMaxDias} dias`
    : `${contas} · o saldo mais antigo é de ${dataBR(antigo.data).slice(0, 5)} (há ${cx.idadeMaxDias} dias)`;
}
function numeroDoCaixa(D, f, chave, rotulo) {
  const cx = f.caixaInformado;
  const nota = notaDoCaixa(f);
  return numero({chave, rotulo, texto: cx.temSaldo ? dinheiro(f.caixa) : '—', nota, minor: cx.temSaldo ? f.caixa : null, falta: !cx.temSaldo,
    abrir: () => verConta('Caixa: o último saldo de cada conta', cx.explica, D.c)});
}

// ══ Caixa ═════════════════════════════════════════════════════════════════════════════════════════════════════════
let mesCaixa = null;           // o mês do bloco "o mês" (cascata e receitas); null = o mês corrente
let registroFechado = false;   // o <details> do registro importado fecha uma vez; se a sócia abrir, fica aberto
let anterioresAbertos = new Set();
// o bloco vai de 12 meses atrás (o mesmo limite da competência na folha de receita) ao mês de hoje; um endereço fora
// disso (#caixa/2024-01, #caixa/2027-05) mostra o mês de hoje e o endereço é corrigido
const mesNoAlcance = (D, mes) => mes >= somarMeses(mesHojeD(D), -12) && mes <= mesHojeD(D);
const mesDoBloco = D => mesCaixa && mesNoAlcance(D, mesCaixa) ? mesCaixa : mesHojeD(D);
function irAoMes(D, mes) {
  mesCaixa = mes === mesHojeD(D) ? null : mes;
  if (typeof window.financeAtualizarRota === 'function') window.financeAtualizarRota({pagina: 'cash', args: mesCaixa ? [mesCaixa] : [], filtros: {}});
  renderTudo(true);
}
// #caixa/2026-09 (link, Voltar, gaveta): o mês do bloco acompanha o endereço
document.addEventListener('financeiro:rota', e => {
  const r = e.detail || {};
  if (r.pagina !== 'cash' || r.origem === 'pagina') return;
  const m = (r.args || [])[0];
  const novo = /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '') ? m : null;
  if (novo !== mesCaixa) { mesCaixa = novo; renderTudo(true); }
});
{ const r = rotaAtual(); if (r.pagina === 'cash' && /^\d{4}-(0[1-9]|1[0-2])$/.test(r.args[0] || '')) mesCaixa = r.args[0]; }

function desenharCaixa(D) {
  const alvo = $('caixa-calculado');
  if (!alvo) return;
  if (mesCaixa && !mesNoAlcance(D, mesCaixa)) {
    mesCaixa = null;
    if (typeof window.financeAtualizarRota === 'function') window.financeAtualizarRota({pagina: 'cash', args: [], filtros: {}});
  }
  const chave = chaveEmFoco(alvo);
  const f = folegoDe(D), mesHoje = mesHojeD(D), r = resultadoDe(D, mesHoje);
  const raiz = el('section', 'cx-raiz');
  raiz.setAttribute('aria-labelledby', 'caixa-calculado-titulo');
  const cab = el('div', 'section-heading cx-cabeca'), tt = el('div');
  const h2 = el('h2', 'cx-titulo', 'Quanto entra, quanto sai e quanto tempo dura'); h2.id = 'caixa-calculado-titulo'; h2.tabIndex = -1;
  tt.append(el('p', 'section-number', 'O CAIXA CALCULADO'), h2);
  cab.append(tt);
  raiz.append(cab);
  // nível 1: a manchete em 10 segundos e quatro números
  const manchete = el('p', 'lv-manchete cx-manchete', f.frase);
  manchete.dataset.estado = f.estado;
  raiz.append(manchete);
  const nums = el('div', 'lv-kpis cx-kpis');
  const queima = f.queimaMedia === null ? {texto: '—', nota: 'precisa de 1 mês fechado', falta: true}
    : f.estado === 'sem_queima' ? {texto: 'sem queima', nota: `entrou mais do que saiu (${f.rotuloBase})`, falta: true}
    : {texto: comMenos(f.queimaMedia), nota: `por mês · ${f.rotuloBase}`, falta: false};
  nums.append(
    numeroDoCaixa(D, f, 'banco', 'No banco'),
    numero({chave: 'queima', rotulo: 'Queima média', texto: queima.texto, nota: queima.nota, falta: queima.falta, minor: f.queimaMedia,
      abrir: f.queimaMedia === null ? null : () => verConta(`Queima média (${f.rotuloBase})`, contaDaQueima(D, f), D.c)}),
    numeroDoFolego(D, f),
    numero({chave: 'resultado', rotulo: `Resultado de ${mesMinusculo(mesHoje)}`, texto: comMenos(r.resultado), minor: r.resultado, tom: 'total',
      nota: r.fechado ? 'mês fechado' : !r.receitas.linhas.length ? 'provisório · sem receita lançada' : 'provisório: o mês está aberto',
      abrir: () => verConta(`Resultado de ${mesLongo(mesHoje)}`, contaDoResultado(r), D.c)}),
  );
  raiz.append(nums);
  if (r.incompletos.length) {
    const av = el('div', 'notice lv-aviso cx-aviso');
    av.append(el('strong', null, `${plural(r.incompletos.length, 'item ficou', 'itens ficaram')} fora das contas de ${mesMinusculo(mesHoje)}: `), el('span', null, r.incompletos.map(i => `${i.descricao} (${i.motivo})`).join('; ')));
    raiz.append(av);
  }
  // nível 2: o fluxo de 12 meses
  raiz.append(cartaoFluxo(D));
  // o mês: cascata e receitas (‹ mês ›)
  raiz.append(blocoDoMes(D, mesDoBloco(D)));
  // nível 3: os saldos por conta
  raiz.append(cartaoSaldos(D, f));
  const p = pode('set_balance');
  if (!p.ok) raiz.append(el('p', 'lv-nota cx-so-leitura', `Para lançar receitas e saldos: ${p.motivo}`));
  alvo.replaceChildren(raiz);
  // a parte calculada apareceu: o registro importado de 18/10 recolhe (uma vez), e continua a um toque
  if (!registroFechado) {
    const det = document.querySelector('#block-cash details.registro-importado');
    if (det) { det.open = false; registroFechado = true; }
  }
  // a seta que levou ao primeiro (ou ao último) mês desliga e o "Voltar ao mês atual" some: o foco vai ao nome do mês
  if (!devolverFoco(alvo, chave) && chave && chave.startsWith('mes-')) devolverFoco(alvo, 'titulo:mes');
}

// ── fluxo de 12 meses ────────────────────────────────────────────────────────────────────────────────────────────
function conclusaoDoFluxo(serie) {
  const reais = serie.filter(p => !p.futuro), futuros = serie.filter(p => p.futuro);
  const maisSaiu = reais.filter(p => p.saiu > p.entrou).length;
  const primeiro = reais[0].mes, ultimo = reais[reais.length - 1].mes;
  let f = reais.length === 1 ? `Em ${mesLongo(ultimo)}, ${reais[0].saiu > reais[0].entrou ? 'saiu mais do que entrou' : 'entrou pelo menos o que saiu'}.`
    : `De ${mesLongo(primeiro)} a ${mesLongo(ultimo)}, saiu mais do que entrou em ${maisSaiu} de ${reais.length} meses.`;
  const saldos = reais.filter(p => p.saldo !== null);
  if (saldos.length >= 2) f += ` O saldo informado foi de ${dinheiro(saldos[0].saldo)} (${mesCurto(saldos[0].mes)}) para ${dinheiro(saldos[saldos.length - 1].saldo)} (${mesCurto(saldos[saldos.length - 1].mes)}).`;
  else if (saldos.length === 1) f += ` Saldo informado em ${mesCurto(saldos[0].mes)}: ${dinheiro(saldos[0].saldo)}.`;
  if (futuros.length) f += ` Nos ${futuros.length} meses seguintes, só as assinaturas previstas (sem receita: o portal não inventa vendas).`;
  return f;
}
function cartaoFluxo(D) {
  const serie = serieDe(D);
  const box = cartao('Fluxo de 12 meses', 'O que entrou (receita bruta) e o que saiu em cada mês, e o saldo do banco no fim do mês, quando foi informado. Aqui, “saiu” é tudo o que pesa no caixa: gastos lançados, assinaturas previstas, taxas e imposto (no Meu painel, “Saiu este mês” é só o lançado). A série começa no primeiro mês com dado; os 3 meses depois de hoje mostram só as assinaturas previstas.');
  box.classList.add('cx-fluxo');
  const reais = serie.filter(p => !p.futuro);
  if (!reais.length) { box.append(el('p', 'lv-vazio', 'O fluxo começa no primeiro mês com um gasto, uma receita ou um saldo.')); return box; }
  const fig = fluxo(serie, {rotulo: conclusaoDoFluxo(serie)});
  const area = fig.querySelector('.gf-area');
  if (area) marcar(area, 'grafico:fluxo');
  box.append(fig);
  const aberto = reais.find(p => p.aberto);
  if (aberto) box.append(el('p', 'lv-nota cx-nota-grafico', `${Mes(aberto.mes)} está aberto: o que saiu inclui o previsto das assinaturas ainda sem lançamento, e muda até o mês fechar.`));
  return box;
}

// ── o mês: navegação, cascata e receitas ───────────────────────────────────────────────────────────────────────────
function blocoDoMes(D, mes) {
  const mesHoje = mesHojeD(D), f = fechamentoDe(D, mes);
  const sec = el('section', 'cx-mes');
  sec.setAttribute('aria-labelledby', 'cx-mes-titulo');
  sec.dataset.mes = mes;
  const nav = el('div', 'lv-mesnav cx-mesnav');
  const ant = marcar(botao('‹', 'button-outline lv-mes-seta', () => irAoMes(D, somarMeses(mes, -1))), 'mes-anterior'); ant.setAttribute('aria-label', 'Mês anterior');
  const prox = marcar(botao('›', 'button-outline lv-mes-seta', () => irAoMes(D, somarMeses(mes, 1))), 'mes-seguinte'); prox.setAttribute('aria-label', 'Próximo mês');
  if (mes >= mesHoje) { prox.disabled = true; prox.title = 'Os meses depois deste ainda não começaram.'; }
  // para trás, até o primeiro mês do fluxo de 12 meses (o primeiro com dado, no máximo 11 meses antes de hoje)
  if (mes <= serieDe(D)[0].mes) { ant.disabled = true; ant.title = 'O fluxo de 12 meses começa neste mês.'; }
  const titulo = marcar(el('h3', 'lv-mes-titulo cx-mes-titulo', capital(mesLongo(mes))), 'titulo:mes'); titulo.id = 'cx-mes-titulo'; titulo.tabIndex = -1; titulo.setAttribute('aria-live', 'polite');
  nav.append(ant, titulo, prox);
  if (mes !== mesHoje) nav.append(marcar(botao('Voltar ao mês atual', 'button-quiet', () => irAoMes(D, mesHoje)), 'mes-atual'));
  sec.append(nav);
  sec.append(f ? el('p', 'cx-mes-situacao', `${Mes(mes)} fechado por ${nomeDe(D.c, f.por)} em ${dataBR(String(f.em || '').slice(0, 10))} · selo ${C.seloCurto(f.selo)}: os números deste mês não mudam mais.`)
    : el('p', 'cx-mes-situacao', mes === mesHoje ? `${Mes(mes)} está aberto: o resultado é provisório até o mês fechar.` : `${Mes(mes)} ainda não foi fechado: o resultado pode mudar.`));
  const grade = el('div', 'cx-grade');
  grade.append(cartaoCascata(D, mes), cartaoReceitas(D, mes));
  sec.append(grade);
  return sec;
}
function cartaoCascata(D, mes) {
  const cx = cascataDe(D, mes), r = resultadoDe(D, mes);
  if (!r.receitaBruta) {
    const box = cartao(`Para onde vai a receita de ${mesMinusculo(mes)}`, 'Receita → taxas das plataformas → imposto → custos → resultado → a parte de cada sócia.');
    box.classList.add('cx-cascata');
    box.append(el('p', 'lv-vazio', `Nenhuma receita lançada em ${mesMinusculo(mes)}. Quando houver, a cascata mostra quanto fica com as plataformas, com o imposto e com os custos, e o resultado que sobra para cada sócia.`));
    box.append(numeroResumo(`Resultado de ${mesMinusculo(mes)}`, comMenos(r.resultado), r.resultado, () => verConta(`Resultado de ${mesLongo(mes)}`, contaDoResultado(r), D.c), 'resultado-' + mes));
    return box;
  }
  const box = cartao(cx.rotulo, 'Cada barra começa onde a anterior terminou: da receita bruta saem as taxas, o imposto e os custos; o que sobra é o resultado, repartido pela participação.');
  box.classList.add('cx-cascata');
  const rotulo = `${Mes(mes)}: de ${dinheiro(r.receitaBruta)} de receita, ${dinheiro(r.taxas)} ficaram com as plataformas e ${dinheiro(r.imposto)} com o imposto; com ${dinheiro(r.custo)} de custos, o resultado é ${comMenos(r.resultado)}${r.provisorio ? ' (provisório: o mês não foi fechado)' : ''}.`;
  const fig = cascata(cx.passos, {rotulo});
  const area = fig.querySelector('.gf-area');
  if (area) marcar(area, 'grafico:cascata');
  box.append(fig);
  box.append(numeroResumo(`Resultado de ${mesMinusculo(mes)}`, comMenos(r.resultado), r.resultado, () => verConta(`Resultado de ${mesLongo(mes)}`, contaDoResultado(r), D.c), 'resultado-' + mes));
  return box;
}
// uma linha "Resultado de outubro −R$ 543,27 · Ver a conta" embaixo da cascata
function numeroResumo(rotulo, texto, minor, abrir, chave) {
  const p = el('div', 'cx-linha-total');
  p.dataset.minor = String(minor);
  const b = marcar(botao('Ver a conta', 'button-quiet lv-ver-conta', abrir), 'conta:' + chave);
  b.setAttribute('aria-label', `Ver a conta: ${rotulo}, ${texto}`);
  p.append(el('span', null, rotulo), el('strong', null, texto), b);
  return p;
}

// ── receitas do mês ────────────────────────────────────────────────────────────────────────────────────────────────
const rotuloCanal = id => (R.CANAIS.find(c => c.id === id) || {}).rotulo || id;
// "taxa 9,9% + 40 × R$ 2,49 = R$ 336,80 · Simples 6% = R$ 143,76 · líquido R$ 1.915,44": tudo da linha do contas.js
function textoDaLinha(l) {
  if (l.brl === null) return l.motivo;
  const partes = [];
  if (l.moeda !== 'BRL') {
    const t = l.explica.bruto.termos[0], ref = t && t.ref;
    partes.push(ref ? `${dinheiro(l.brutoMinor, l.moeda)} × ${String(ref.valor).replace('.', ',')} (PTAX de ${dataBR(ref.desde).slice(0, 5)}, sem spread) = ${dinheiro(l.brl)}` : `${dinheiro(l.brutoMinor, l.moeda)} = ${dinheiro(l.brl)}`);
  }
  if (l.origemTaxas === 'extrato') partes.push(`taxa do extrato ${dinheiro(l.taxas)}`);
  else if (l.origemTaxas === 'sem_parametro') partes.push('sem taxa na tabela deste canal (se a plataforma cobrou, informe o extrato)');
  else {
    const pedacos = l.explica.taxas.termos.map(t => t.ref && /_pct$/.test(t.ref.chave || '') ? C.textoPct(t.ref.valor) : t.rotulo.replace(/ por venda$/, ''));
    partes.push(`taxa ${pedacos.join(' + ')} = ${dinheiro(l.taxas)}`);
  }
  const imp = l.explica.imposto.termos[0];
  partes.push(imp && imp.ref ? `Simples ${C.textoPct(imp.ref.valor)} = ${dinheiro(l.imposto)}` : 'Simples: falta a alíquota nos Parâmetros');
  partes.push(`líquido ${comMenos(l.liquido)}`);
  return partes.join(' · ');
}
function cartaoReceitas(D, mes) {
  const rec = C.receitasDoMes(D.aplicado, D.lista, mes);
  const fechado = fechamentoDe(D, mes);
  const p = pode('add_income');
  const box = cartao(`Receitas de ${mesMinusculo(mes)}`, 'As vendas do mês por canal e produto, já sem os cancelamentos (só os totais, nunca quem comprou). A taxa sai da tabela do canal na página Parâmetros, ou do extrato quando você informa; o imposto, da alíquota efetiva do Simples.');
  box.classList.add('cx-receitas');
  const titulo = box.querySelector('.lv-cartao-titulo'); titulo.tabIndex = -1; marcar(titulo, 'titulo:receitas');
  if (p.ok && !fechado) {
    const b = marcar(botao('+ Receita', 'button-primary cx-acao', () => folhaReceita(null, mes, {chave: 'receita:nova', titulo: 'titulo:receitas'})), 'receita:nova');
    b.setAttribute('aria-label', `Lançar uma receita de ${mesLongo(mes)}`);
    box.append(b);
  } else if (fechado) box.append(el('p', 'lv-nota', `${Mes(mes)} está fechado: a responsável reabre, com motivo, se precisar lançar ou corrigir uma receita.`));
  const lista = el('div', 'cx-receitas-lista');
  for (const l of rec.linhas) lista.append(linhaDeReceita(D, l, p.ok && !fechado));
  const anuladas = (D.aplicado.receitas || []).filter(x => x.competencia === mes && x.estado === 'anulado');
  for (const x of anuladas) {
    const art = el('article', 'cx-receita is-anulada');
    art.dataset.receita = x.id;
    art.append(el('strong', 'cx-receita-nome', [rotuloCanal(x.canal), x.produto].filter(Boolean).join(' · ')),
      el('span', 'cx-receita-meta', `${dinheiro(x.brutoMinor, x.moeda)} · anulada por ${nomeDe(D.c, x.anuladoPor)} em ${horaBR(x.anuladoEm)}: ${x.motivoAnulacao || ''}`), pilula('anulada', 'anulado'));
    lista.append(art);
  }
  if (!rec.linhas.length && !anuladas.length) lista.append(el('p', 'lv-vazio', `Nenhuma receita lançada em ${mesMinusculo(mes)}. Lance as vendas do mês de cada canal (Hotmart, Stripe, Apple, Google): o portal calcula a taxa, o imposto e o líquido.`));
  box.append(lista);
  if (rec.linhas.length > 1) {
    const tot = el('div', 'cx-receitas-total');
    tot.dataset.minor = String(rec.liquido);
    tot.append(el('span', null, `Total do mês: bruto ${dinheiro(rec.bruto)} − taxas ${dinheiro(rec.taxas)} − imposto ${dinheiro(rec.imposto)} = `), el('strong', null, `líquido ${comMenos(rec.liquido)}`));
    const b = marcar(botao('Ver a conta', 'button-quiet lv-ver-conta', () => verConta(`Receita líquida de ${mesLongo(mes)}`, contaDoLiquido(rec), D.c)), 'conta:liquido-' + mes);
    b.setAttribute('aria-label', `Ver a conta: receita líquida de ${mesLongo(mes)}`);
    tot.append(b);
    box.append(tot);
  }
  if (rec.incompletos.length) box.append(el('p', 'notice lv-aviso', `${plural(rec.incompletos.length, 'receita ficou', 'receitas ficaram')} fora das contas: ${rec.incompletos.map(i => `${i.descricao} (${i.motivo})`).join('; ')}`));
  return box;
}
function linhaDeReceita(D, l, podeGravar) {
  const r = (D.aplicado.receitas || []).find(x => x.id === l.id);
  const art = el('article', 'cx-receita');
  art.dataset.receita = l.id;
  const cab = el('div', 'cx-receita-cab');
  cab.append(el('strong', 'cx-receita-nome', l.rotulo || rotuloCanal(l.canal)));
  const contagem = [plural(l.transacoes || 0, 'venda', 'vendas')];
  if (r && Number.isSafeInteger(r.pagantesAtivos)) contagem.push(`${plural(r.pagantesAtivos, 'pagante ativo', 'pagantes ativos')}${Number.isSafeInteger(r.pagantesNovos) || Number.isSafeInteger(r.pagantesPerdidos) ? ` (${[Number.isSafeInteger(r.pagantesNovos) ? '+' + r.pagantesNovos : null, Number.isSafeInteger(r.pagantesPerdidos) ? MENOS + r.pagantesPerdidos : null].filter(Boolean).join(' ')})` : ''}`);
  if (r && Number.isSafeInteger(r.canceladosMinor) && r.canceladosMinor > 0) contagem.push(`${dinheiro(r.canceladosMinor, r.moeda)} cancelados`);
  cab.append(el('span', 'cx-receita-meta', contagem.join(' · ')));
  art.append(cab);
  if (l.brl === null) {
    art.append(el('p', 'notice lv-aviso', `${dinheiro(l.brutoMinor, l.moeda)}: ${l.motivo} A receita fica fora das contas até o câmbio ser informado na página Parâmetros.`));
  } else {
    const nums = el('div', 'cx-receita-nums');
    const cel = (rotulo, campo, minor, texto, tom) => { const d = dado(rotulo, texto, tom); d.dataset.campo = campo; d.dataset.minor = String(minor); return d; };
    nums.append(cel('Bruto', 'bruto', l.brl, dinheiro(l.brl)), cel(l.origemTaxas === 'extrato' ? 'Taxa (extrato)' : 'Taxa', 'taxas', l.taxas, dinheiro(l.taxas)),
      cel('Simples', 'imposto', l.imposto, dinheiro(l.imposto)), cel('Líquido', 'liquido', l.liquido, comMenos(l.liquido), 'destaque'));
    art.append(nums, el('p', 'cx-receita-conta', textoDaLinha(l)));
    if (l.explica.imposto && l.explica.imposto.aConfirmar) art.append(el('p', 'cx-receita-conta', 'A alíquota do Simples ainda está “a confirmar” nos Parâmetros: confira com o contador.'));
  }
  if (r) art.append(el('span', 'lv-autoria', `lançada por ${nomeDe(D.c, r.criadoPor)} em ${horaBR(r.criadoEm)}${r.alteradoEm ? ` · corrigida por ${nomeDe(D.c, r.alteradoPor)} em ${horaBR(r.alteradoEm)}` : ''}`));
  const acoes = el('div', 'cx-receita-acoes');
  if (l.brl !== null) {
    const b = marcar(botao('Ver a conta', 'button-quiet', () => verConta(`Receita líquida · ${l.rotulo}`, contaDaLinha(l), D.c)), 'conta:receita:' + l.id);
    b.setAttribute('aria-label', `Ver a conta: ${l.rotulo}, líquido ${comMenos(l.liquido)}`);
    acoes.append(b);
  }
  if (podeGravar && r) {
    const corrigir = marcar(botao('Corrigir', 'button-quiet', () => folhaReceita(r, r.competencia, {chave: 'corrigir:' + r.id, titulo: 'titulo:receitas'})), 'corrigir:' + r.id);
    corrigir.setAttribute('aria-label', `Corrigir a receita ${l.rotulo}`);
    const anular = marcar(botao('Anular', 'button-quiet', () => anularReceita(r, l.rotulo)), 'anular:' + r.id);
    anular.setAttribute('aria-label', `Anular a receita ${l.rotulo}`);
    acoes.append(corrigir, anular);
  }
  if (acoes.childElementCount) art.append(acoes);
  return art;
}
async function anularReceita(r, rotulo) {
  const motivo = await pedirTexto('Anular a receita', `“${rotulo} · ${mesLongo(r.competencia)}” sai das contas e continua visível, riscada, com o motivo. Por que anular?`, 'Ex.: lançada em duplicidade');
  if (!motivo) { focoPendente = {chave: 'anular:' + r.id}; aplicarFoco(); return; }
  focoPendente = {titulo: 'titulo:receitas'};
  const res = await gravar({acao: 'void_income', alvo: r.id, versao: r.versao, motivo}, 'Receita anulada: sai das contas e fica no histórico.');
  if (!res || !res.ok) focoPendente = null;
  else aplicarFoco();
}

// ── folhas: + Receita (e Corrigir) e + Saldo ───────────────────────────────────────────────────────────────────────
const lerContagem = input => { const s = String(input.value || '').trim(); if (!s) return null; return /^\d{1,9}$/.test(s) ? Number(s) : NaN; };
function campoContagem(valor, exemplo) {
  const i = el('input', 'cx-contagem');
  i.inputMode = 'numeric'; i.autocomplete = 'off'; i.placeholder = exemplo || ''; i.maxLength = 9;
  if (Number.isSafeInteger(valor)) i.value = String(valor);
  return i;
}
function selecao(opcoes, atual, rotulo) {
  const s = el('select', 'lv-select');
  s.setAttribute('aria-label', rotulo);
  for (const [v, t] of opcoes) { const o = el('option', null, t); o.value = v; o.selected = v === atual; s.append(o); }
  return s;
}
// troca a moeda de um campo de dinheiro sem perder o que foi digitado (o símbolo e a leitura acompanham)
function moedaDoCampo(campo, moeda, rotulo) {
  campo.moeda = moeda;
  const s = campo.querySelector('.lv-dinheiro-moeda'); if (s) s.textContent = SIMBOLO[moeda] || moeda;
  campo.ler = () => R.centavosBR(campo.input.value, moeda);
  campo.input.setAttribute('aria-label', `${rotulo} em ${moeda === 'USD' ? 'dólares' : moeda === 'EUR' ? 'euros' : 'reais'}`);
}
const ajuda = texto => el('small', 'cx-ajuda', texto);
// dois campos lado a lado na folha (um embaixo do outro no celular)
const grade = (...nos) => { const g = el('div', 'cx-campos-grade'); g.append(...nos); return g; };
function comAjuda(caixa, texto) { caixa.append(ajuda(texto)); return caixa; }

function folhaReceita(existente = null, mesPadrao = null, volta = null) {
  const D = dados(); if (!D) return;
  const eu = D.c.membro.id, mesHoje = mesHojeD(D), r = existente;
  const daOutra = !!r && r.criadoPor !== eu;
  // competência: os 12 meses até hoje (e o da receita, se for mais antigo); mês fechado aparece e o razão recusa com motivo
  const meses = []; for (let k = 0; k <= 12; k++) meses.push(somarMeses(mesHoje, -k));
  const competenciaAtual = r ? r.competencia : (mesPadrao || mesHoje);
  if (!meses.includes(competenciaAtual)) meses.push(competenciaAtual);
  const selMes = selecao(meses.map(m => [m, capital(mesLongo(m)) + (fechamentoDe(D, m) ? ' (fechado)' : '')]), competenciaAtual, 'Competência');
  const canais = R.CANAIS.map(c => [c.id, c.rotulo]);
  const ultimoCanal = ((D.aplicado.receitas || []).filter(x => x.estado !== 'anulado').slice(-1)[0] || {}).canal || 'hotmart';
  const selCanal = selecao(canais, r ? r.canal : ultimoCanal, 'Canal');
  const produto = el('input'); produto.maxLength = 60; produto.placeholder = 'Ex.: Med Painel'; produto.autocomplete = 'off';
  const produtos = [...new Set((D.aplicado.receitas || []).map(x => x.produto).filter(Boolean))];
  produto.value = r ? r.produto || '' : (produtos[produtos.length - 1] || '');
  const lista = el('datalist'); lista.id = novoAlvo('cx-produtos-'); for (const p of produtos) { const o = el('option'); o.value = p; lista.append(o); }
  produto.setAttribute('list', lista.id);
  const moeda0 = r ? r.moeda : 'BRL';
  const selMoeda = selecao([['BRL', NOMES_MOEDA.BRL], ['USD', NOMES_MOEDA.USD]], moeda0, 'Moeda da receita');
  const bruto = campoDinheiro(moeda0, {valorMinor: r ? r.brutoMinor : null, rotulo: 'Receita bruta'});
  const vendas = campoContagem(r ? r.transacoes : null, 'Ex.: 40');
  const taxas = campoDinheiro(moeda0, {valorMinor: r ? r.taxasMinor : null, rotulo: 'Taxas do extrato', placeholder: 'opcional'});
  const cancelados = campoDinheiro(moeda0, {valorMinor: r ? r.canceladosMinor : null, rotulo: 'Cancelados', placeholder: 'opcional'});
  const contagens = [['pagantesAtivos', 'Pagantes ativos', 'Ex.: 40'], ['pagantesNovos', 'Pagantes novos', 'Ex.: 12'], ['pagantesPerdidos', 'Pagantes perdidos', 'Ex.: 2'], ['testes', 'Testes grátis', 'opcional'], ['cadastros', 'Cadastros', 'opcional']]
    .map(([campo, rotulo, ex]) => ({campo, rotulo, input: campoContagem(r ? r[campo] : null, ex)}));
  const mais = el('details', 'cx-mais');
  mais.open = !!r && contagens.some(c => Number.isSafeInteger(r[c.campo]));
  mais.append(el('summary', null, 'Pagantes, testes e cadastros (opcional)'));
  const gradeMais = el('div', 'cx-campos-grade');
  for (const c of contagens) { c.input.setAttribute('aria-label', c.rotulo); gradeMais.append(campoComRotulo(c.rotulo, c.input)); }
  mais.append(gradeMais, el('p', 'lv-nota', 'Servem ao funil e à receita recorrente (página futura de pagantes). Só números, nunca nomes.'));
  const motivo = el('input'); motivo.maxLength = 300; motivo.placeholder = daOutra ? 'Obrigatório: por que corrigir a receita de outra sócia?' : 'Opcional. Ex.: o extrato fechado trouxe mais 2 vendas';
  const previa = el('p', 'cx-previa'); previa.setAttribute('aria-live', 'polite');
  const alvo = r ? r.id : novoAlvo('rc-');
  const trocarMoeda = () => { const m = selMoeda.value; moedaDoCampo(bruto, m, 'Receita bruta'); moedaDoCampo(taxas, m, 'Taxas do extrato'); moedaDoCampo(cancelados, m, 'Cancelados'); atualizar(); };
  // o que a folha vai gravar (ou o erro de preenchimento)
  function ler() {
    const brutoMinor = bruto.ler();
    if (brutoMinor === null) return {erro: 'Informe a receita bruta do mês, já sem os cancelamentos (use vírgula para os centavos).'};
    const transacoes = lerContagem(vendas);
    if (transacoes === null || Number.isNaN(transacoes)) return {erro: 'Informe o número de vendas do mês (zero ou mais, só números).'};
    const opcionalDinheiro = (campo, nomeCampo) => { const t = campo.input.value.trim(); if (!t) return {v: null}; const v = campo.ler(); return v === null ? {erro: `${nomeCampo}: use vírgula para os centavos.`} : {v}; };
    const tx = opcionalDinheiro(taxas, 'Taxas do extrato'); if (tx.erro) return tx;
    const cn = opcionalDinheiro(cancelados, 'Cancelados'); if (cn.erro) return cn;
    const extras = {};
    for (const c of contagens) { const v = lerContagem(c.input); if (Number.isNaN(v)) return {erro: `${c.rotulo}: só números inteiros.`}; extras[c.campo] = v; }
    return {dados: {competencia: selMes.value, canal: selCanal.value, produto: produto.value.trim(), brutoMinor, canceladosMinor: cn.v, moeda: selMoeda.value, transacoes, taxasMinor: tx.v, ...extras}};
  }
  const conteudoDe = l => r ? {acao: 'edit_income', alvo, versao: r.versao, dados: l.dados, ...(motivo.value.trim() ? {motivo: motivo.value.trim()} : {})} : {acao: 'add_income', alvo, dados: l.dados};
  // a prévia é a mesma conta da tela: o razão aplica o diário + esta receita e o contas.js calcula a linha dela
  function atualizar() {
    const l = ler();
    previa.classList.remove('is-erro');
    if (l.erro) { previa.textContent = 'Prévia: preencha a receita bruta e o número de vendas.'; return; }
    const atual = dados(); if (!atual) return;
    const c = conteudoDe(l);
    const simulado = R.aplicar(atual.c.estado, [...(atual.d ? atual.d.eventos : []), {seq: Infinity, id: 'previa-receita', membro: atual.c.membro.id, conteudo: {...c, motivo: c.motivo || (daOutra ? 'prévia' : undefined), quando: new Date().toISOString()}}]);
    const recusa = simulado.recusados.find(x => x.id === 'previa-receita');
    if (recusa) { previa.textContent = recusa.motivo; previa.classList.add('is-erro'); return; }
    const linha = C.receitasDoMes(simulado, R.parametros(simulado), l.dados.competencia).linhas.find(x => x.id === alvo);
    previa.textContent = linha ? textoDaLinha(linha) : '';
  }
  for (const n of [selMes, selCanal, produto, bruto.input, vendas, taxas.input, cancelados.input]) n.addEventListener('input', atualizar);
  selMoeda.addEventListener('change', trocarMoeda);
  for (const n of [selMes, selCanal]) n.addEventListener('change', atualizar);
  const corpo = [
    el('p', null, r ? (daOutra ? `Esta receita foi lançada por ${nomeDe(D.c, r.criadoPor)}: corrigir pede um motivo. A versão de antes fica no Histórico.` : 'Corrigir não apaga: a versão de antes fica no Histórico.')
      : 'Some as vendas do mês num canal: só os totais, nunca o nome de quem comprou. O portal calcula a taxa e o imposto com os Parâmetros.'),
    grade(campoComRotulo('Competência (mês das vendas)', selMes), campoComRotulo('Canal', selCanal)),
    grade(campoComRotulo('Produto', produto), campoComRotulo('Moeda', selMoeda)), lista,
    comAjuda(campoComRotulo('Receita bruta, já sem os cancelamentos', bruto), 'O que entrou de vendas no mês, já descontados os cancelamentos e reembolsos.'),
    campoComRotulo('Número de vendas', vendas),
    previa,
    grade(comAjuda(campoComRotulo('Taxas do extrato (se tiver)', taxas), 'Em branco, vale a tabela do canal (Parâmetros).'), campoComRotulo('Cancelados no mês (se tiver)', cancelados)),
    mais,
  ];
  if (r) corpo.push(campoComRotulo(daOutra ? 'Motivo da correção' : 'Motivo da correção (opcional)', motivo));
  abrirFolha({eyebrow: 'Receitas', titulo: r ? 'Corrigir a receita' : 'Lançar uma receita', rotulo: r ? 'Corrigir a receita' : 'Lançar uma receita', corpo,
    acoes: [{rotulo: r ? 'Salvar a correção' : 'Salvar a receita', primaria: true, fn: folha => {
      const l = ler();
      if (l.erro) return {ok: false, erro: l.erro};
      if (daOutra && !motivo.value.trim()) return {ok: false, erro: 'Mudar a receita de outra sócia pede um motivo.'};
      const nome = [rotuloCanal(l.dados.canal), l.dados.produto].filter(Boolean).join(' · ');
      return folha.gravar(conteudoDe(l), r ? `Receita corrigida: ${nome}.` : `Receita lançada: ${nome} · ${dinheiro(l.dados.brutoMinor, l.dados.moeda)}.`);
    }}],
    aoFechar: () => { focoPendente = volta; }});
  atualizar();
}

function folhaSaldo({conta = null, data = null, moeda = null} = {}, volta = null) {
  const D = dados(); if (!D) return;
  const hoje = hojeD(D);
  const saldos = D.aplicado.saldos || [];
  const contas = [...new Set(saldos.map(s => s.conta))];
  const campoConta = el('input'); campoConta.maxLength = 60; campoConta.autocomplete = 'off'; campoConta.placeholder = 'Ex.: Conta PJ principal';
  campoConta.value = conta || contas[contas.length - 1] || 'Conta PJ principal';
  const lista = el('datalist'); lista.id = novoAlvo('cx-contas-'); for (const c of contas) { const o = el('option'); o.value = c; lista.append(o); }
  campoConta.setAttribute('list', lista.id);
  const campoData = el('input'); campoData.type = 'date'; campoData.value = data || hoje; campoData.max = hoje; campoData.required = true;
  const ultimoDaConta = nome => saldos.filter(s => s.conta === nome).slice(-1)[0] || null;
  const moeda0 = moeda || (ultimoDaConta(campoConta.value) || {}).moeda || 'BRL';
  const selMoeda = selecao(R.MOEDAS.map(m => [m, NOMES_MOEDA[m] || m]), moeda0, 'Moeda do saldo');
  const valor = campoDinheiro(moeda0, {rotulo: 'Saldo'});
  const fonte = el('input'); fonte.maxLength = 160; fonte.value = 'extrato do banco'; fonte.placeholder = 'Ex.: extrato do banco';
  const nota = el('input'); nota.maxLength = 300; nota.placeholder = 'Opcional';
  const previa = el('p', 'cx-previa'); previa.setAttribute('aria-live', 'polite');
  const alvo = novoAlvo('sd-');
  const conteudo = v => ({acao: 'set_balance', alvo, dados: {conta: campoConta.value.trim(), data: campoData.value, valorMinor: v, moeda: selMoeda.value, fonte: fonte.value.trim(), nota: nota.value.trim()}});
  // a prévia: o razão aplica o diário + este saldo e o contas.js refaz o caixa e o fôlego
  function atualizar() {
    previa.classList.remove('is-erro');
    const v = valor.ler();
    if (v === null) { previa.textContent = 'Prévia: digite o saldo para ver o caixa e o fôlego com ele.'; return; }
    const atual = dados(); if (!atual) return;
    const simulado = R.aplicar(atual.c.estado, [...(atual.d ? atual.d.eventos : []), {seq: Infinity, id: 'previa-saldo', membro: atual.c.membro.id, conteudo: {...conteudo(v), quando: new Date().toISOString()}}]);
    const recusa = simulado.recusados.find(x => x.id === 'previa-saldo');
    if (recusa) { previa.textContent = recusa.motivo; previa.classList.add('is-erro'); return; }
    const f = C.folego(atual.c.estado, simulado, hoje);
    const minha = f.caixaInformado.contas.find(c => c.id === alvo);
    const partes = [];
    if (!minha) {
      const vale = f.caixaInformado.contas.find(c => c.conta === campoConta.value.trim());
      partes.push(vale ? `Há um saldo mais novo desta conta (${dataBR(vale.data)}): este fica só no histórico.` : 'Este saldo é de depois de hoje.');
    } else if (minha.moeda !== 'BRL') partes.push(minha.explica ? minha.explica.formula + '.' : `Falta o câmbio de ${minha.moeda}: o saldo fica fora do caixa até ele ser informado.`);
    partes.push(f.caixaInformado.temSaldo ? `Com ele, o caixa fica ${dinheiro(f.caixa)} e o fôlego, ${f.estado === 'ok' ? `${f.texto} (${f.rotuloBase})` : textosDoFolego(f).texto}.` : '');
    previa.textContent = partes.filter(Boolean).join(' ');
  }
  for (const n of [campoConta, campoData, valor.input, fonte]) n.addEventListener('input', atualizar);
  selMoeda.addEventListener('change', () => { moedaDoCampo(valor, selMoeda.value, 'Saldo'); atualizar(); });
  campoData.addEventListener('change', atualizar);
  abrirFolha({eyebrow: 'Saldos', titulo: 'Informar um saldo', rotulo: 'Informar o saldo de uma conta',
    corpo: [el('p', null, 'O saldo da conta da empresa num dia, como está no extrato do banco. Vale o mais recente de cada conta; os anteriores ficam no histórico. Saldo em dólar vira reais pela PTAX do dia, sem spread.'),
      campoComRotulo('Conta', campoConta), lista, grade(campoComRotulo('Data do saldo', campoData), campoComRotulo('Moeda', selMoeda)), campoComRotulo('Saldo', valor), previa,
      grade(campoComRotulo('De onde veio', fonte), campoComRotulo('Nota', nota))],
    acoes: [{rotulo: 'Salvar o saldo', primaria: true, fn: folha => {
      const v = valor.ler();
      if (v === null) return {ok: false, erro: 'Informe o saldo (use vírgula para os centavos).'};
      if (!campoConta.value.trim()) return {ok: false, erro: 'Informe a conta.'};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(campoData.value)) return {ok: false, erro: 'Informe a data do saldo.'};
      if (campoData.value > hoje) return {ok: false, erro: 'O saldo é de uma data que ainda não chegou.'};
      return folha.gravar(conteudo(v), `Saldo informado: ${campoConta.value.trim()} · ${dinheiro(v, selMoeda.value)} em ${dataBR(campoData.value)}.`);
    }}],
    aoFechar: () => { focoPendente = volta; }});
  atualizar();
}

// ── saldos por conta ───────────────────────────────────────────────────────────────────────────────────────────────
function cartaoSaldos(D, f) {
  const cx = f.caixaInformado;
  const p = pode('set_balance');
  const box = cartao('Saldos por conta', 'O último saldo informado de cada conta da empresa: é dele que saem o “No banco” e o fôlego. Saldo em dólar vira reais pela PTAX do dia do saldo, sem spread (não é compra no cartão).');
  box.classList.add('cx-saldos');
  const titulo = box.querySelector('.lv-cartao-titulo'); titulo.tabIndex = -1; marcar(titulo, 'titulo:saldos');
  if (p.ok) box.append(marcar(botao('+ Saldo', 'button-primary cx-acao', () => folhaSaldo({}, {chave: 'saldo:novo', titulo: 'titulo:saldos'})), 'saldo:novo'));
  if (!cx.contas.length) {
    box.append(el('p', 'lv-vazio', 'Nenhum saldo informado ainda. Informe o saldo da conta da empresa (o extrato do banco mostra): com ele e um mês fechado, o portal diz quanto tempo o caixa dura.'));
    return box;
  }
  const ul = el('ul', 'cx-saldos-lista');
  for (const c of [...cx.contas].sort((a, b) => a.conta.localeCompare(b.conta, 'pt-BR'))) {
    const li = el('li', 'cx-saldo');
    li.dataset.saldo = c.id; li.dataset.conta = c.conta;
    if (c.brl !== null) li.dataset.minor = String(c.brl);
    const corpo = el('div', 'cx-saldo-corpo');
    corpo.append(el('strong', 'cx-saldo-conta', c.conta), el('span', 'lv-autoria', `em ${dataBR(c.data)} · informado por ${nomeDe(D.c, c.criadoPor)} · ${c.fonte || 'informado no portal'}`));
    const valor = el('div', 'cx-saldo-valor');
    valor.append(el('strong', null, dinheiro(c.valorMinor, c.moeda)));
    if (c.moeda !== 'BRL') {
      const ref = c.explica && c.explica.termos[0] ? c.explica.termos[0].ref : null;
      valor.append(el('span', null, c.brl === null ? 'falta o câmbio: fora do caixa'
        : `≈ ${dinheiro(c.brl)} pela PTAX${ref ? ` de ${dataBR(ref.desde).slice(0, 5)}` : ''}${c.explica.cambioPosterior ? ' (posterior ao saldo)' : ''}, sem spread`));
    }
    li.append(corpo, valor);
    if (Number.isSafeInteger(c.idadeDias) && c.idadeDias > IDADE_MAXIMA) {
      const av = el('p', 'cx-saldo-antigo');
      av.append(pilula(`saldo de ${c.idadeDias} dias atrás`, 'pendente'), el('span', null, ' informe o de hoje: o fôlego usa este número.'));
      if (p.ok) av.append(marcar(botao('Informar o de hoje', 'button-quiet', () => folhaSaldo({conta: c.conta, moeda: c.moeda}, {chave: 'hoje:' + c.conta, titulo: 'titulo:saldos'})), 'hoje:' + c.conta));
      li.append(av);
    } else if (p.ok) {
      const b = marcar(botao('Corrigir', 'button-quiet', () => folhaSaldo({conta: c.conta, data: c.data, moeda: c.moeda}, {chave: 'corrigir-saldo:' + c.conta, titulo: 'titulo:saldos'})), 'corrigir-saldo:' + c.conta);
      b.setAttribute('aria-label', `Corrigir o saldo de ${c.conta} (informar de novo para ${dataBR(c.data)})`);
      li.append(b);
    }
    // os anteriores desta conta (nada some: corrigir é informar de novo)
    const anteriores = (D.aplicado.saldos || []).filter(s => s.conta === c.conta && s.id !== c.id).sort((a, b) => b.data.localeCompare(a.data) || b.seq - a.seq);
    if (anteriores.length) {
      const det = el('details', 'cx-anteriores');
      det.open = anterioresAbertos.has(c.conta);
      det.addEventListener('toggle', () => { if (det.open) anterioresAbertos.add(c.conta); else anterioresAbertos.delete(c.conta); });
      det.append(el('summary', null, `Saldos anteriores (${anteriores.length})`));
      const ol = el('ol', 'cx-anteriores-lista');
      for (const s of anteriores) ol.append(el('li', null, `${dataBR(s.data)} · ${dinheiro(s.valorMinor, s.moeda)} · informado por ${nomeDe(D.c, s.criadoPor)} em ${horaBR(s.criadoEm)}`));
      det.append(ol);
      li.append(det);
    }
    ul.append(li);
  }
  box.append(ul);
  box.append(el('p', 'lv-nota', 'Corrigir um saldo é informar de novo para a mesma data: vale o mais novo, e o anterior fica no histórico.'));
  return box;
}

// ══ Meu painel: a manchete do mês (desenhada pelo livro.js em #livro-resumo, por registrarResumo) ═══════════════════
// cada trecho da manchete leva ao lugar dele: o que saiu e o comprometido ao Livro do mês, o fôlego ao Caixa e as
// cobranças atrasadas às Assinaturas
const DESTINO_DO_TRECHO = {saiu: ['livro', null], comprometido: ['livro', null], folego: ['cash', 'caixa-calculado-titulo'], atrasadas: ['subscriptions', null]};
function linkPara(texto, pagina, alvoId, cls, chave) {
  const a = el('a', cls, texto);
  a.href = window.financeRotas ? window.financeRotas.montar(pagina) : '#';
  if (chave) a.dataset.chave = chave;
  a.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || typeof window.financeNavigate !== 'function') return;
    e.preventDefault();
    irPara(pagina, alvoId, 'painel');
  });
  return a;
}
function desenharPainel(D, alvo) {
  const m = mancheteDe(D), f = m.folego, mes = m.mes;
  const chave = chaveEmFoco(alvo);
  const box = el('section', 'lv-resumo cx-painel');
  box.setAttribute('aria-labelledby', 'cx-painel-titulo');
  const cab = el('div', 'lv-resumo-cab');
  const eyebrow = el('p', 'eyebrow', 'O mês em curso · ' + mesLongo(mes)); eyebrow.id = 'cx-painel-titulo';
  const botoes = el('div', 'cx-painel-botoes');
  botoes.append(marcar(botao('Abrir o caixa  ↗', 'button-outline', () => irPara('cash', 'caixa-calculado-titulo', 'painel')), 'abrir:caixa'), marcar(botao('Abrir o livro do mês  ↗', 'button-quiet', () => irPara('livro', null, 'painel')), 'abrir:livro'));
  cab.append(eyebrow, botoes);
  box.append(cab);
  // nível 1: a frase de modelo fixo do contas.js, cada trecho um link
  const frase = el('p', 'lv-manchete cx-manchete cx-painel-manchete');
  frase.dataset.frase = m.frase;
  m.trechos.forEach((t, k) => {
    if (k) frase.append('; ');
    const [pagina, alvoId] = DESTINO_DO_TRECHO[t.alvo] || ['livro', null];
    frase.append(linkPara(t.texto, pagina, alvoId, 'cx-trecho' + (t.alvo === 'atrasadas' && m.atrasadas.length ? ' is-atrasado' : ''), 'trecho:' + t.alvo));
  });
  frase.append('.');
  box.append(frase);
  const l = livroDe(D, mes);
  // a sua parte (a segunda pergunta do teste de 10 segundos), logo abaixo da manchete: no celular fica no alto da
  // primeira tela, longe do "+ Lançar" flutuante
  const eu = l.porSocia.find(s => s.id === D.c.membro.id);
  if (eu && eu.parte !== null && m.minhaParte !== null) {
    const p = el('p', 'cx-sua-parte');
    p.dataset.minor = String(m.minhaParte);
    p.append('Sua parte no comprometido de ' + mesMinusculo(mes) + ': ', el('strong', null, dinheiro(m.minhaParte)), ` (${eu.pct}% de participação).`);
    box.append(p);
  } else box.append(el('p', 'cx-sua-parte', 'Sua parte fica suspensa: a participação cadastrada não fecha 100%.'));
  const [saiu, comprometido] = m.numeros;
  const nums = el('div', 'lv-kpis is-compacto cx-kpis');
  nums.append(
    numero({chave: 'painel-saiu', rotulo: saiu.rotulo, texto: dinheiro(saiu.valor), minor: saiu.valor, nota: `lançado em ${mesMinusculo(mes)} até hoje`, abrir: () => verConta('Saiu em ' + mesLongo(mes), saiu.explica, D.c)}),
    numero({chave: 'painel-comprometido', rotulo: comprometido.rotulo, texto: dinheiro(comprometido.valor), minor: comprometido.valor, tom: 'total', nota: comprometido.estimado ? 'lançado + previsto (estimado)' : 'tudo já lançado', abrir: () => verConta('Comprometido em ' + mesLongo(mes), contaDoCusto(l), D.c)}),
    numeroDoCaixa(D, f, 'painel-caixa', 'Caixa'),
    numeroDoFolego(D, f, 'painel-folego'),
  );
  box.append(nums);
  // nível 2: o minigráfico de 12 meses e as mudanças recentes
  const baixo = el('div', 'cx-painel-baixo');
  const mini = el('div', 'cx-painel-mini');
  const serie = serieDe(D).filter(p => !p.futuro).map(p => ({mes: p.mes, valor: p.realizado, aberto: p.aberto, moeda: 'BRL'}));
  // "saiu" aqui é só o lançado (no fluxo do Caixa, "saiu" soma também o previsto, as taxas e o imposto)
  mini.append(el('h3', 'lv-sub cx-painel-sub', 'Saiu por mês (só o lançado)'));
  if (serie.length) {
    const u = serie[serie.length - 1];
    const fig = minigrafico(serie, {cor: 'saida', nome: 'saiu (lançado)', rotulo: `O que saiu (lançado) por mês, de ${mesLongo(serie[0].mes)} a ${mesLongo(u.mes)}; em ${mesLongo(u.mes)}${u.aberto ? ', mês aberto,' : ''} ${dinheiro(u.valor)} até agora.`});
    const area = fig.querySelector('.gf-area'); if (area) marcar(area, 'grafico:mini');
    mini.append(fig);
  }
  const mud = el('div', 'cx-mudancas');
  mud.append(el('h3', 'lv-sub cx-painel-sub', 'Mudanças recentes das outras sócias'));
  const lista = C.mudancasRecentes(D.aplicado, D.c.membro.id, 3);
  if (lista.length) {
    const ul = el('ul', 'cx-mudancas-lista');
    for (const x of lista) {
      const li = el('li');
      li.dataset.seq = String(x.seq);
      const linha = el('p', 'cx-mudanca');
      linha.append(el('strong', null, nomeDe(D.c, x.autora)), ` ${x.verbo}${x.resumo ? ': ' : ''}`, dataComum(x.resumo || ''));
      li.append(linha, el('span', 'lv-autoria', horaBR(x.quando)));
      ul.append(li);
    }
    mud.append(ul);
  } else mud.append(el('p', 'lv-vazio', 'Nenhuma mudança das outras sócias ainda.'));
  mud.append(linkPara('Ver tudo no Histórico ›', 'historico', null, 'lv-termo-link cx-link-historico', 'abrir:historico'));
  baixo.append(mini, mud);
  box.append(baixo);
  alvo.replaceChildren(box);
  devolverFoco(alvo, chave);
}

export function desenhar(D) { // D = dados() do livro.js: {c, d, aplicado, lista}; roda depois das páginas do livro.js
  desenharCaixa(D);
  aplicarFoco();
}
registrarPagina(desenhar);
registrarResumo(desenharPainel);
