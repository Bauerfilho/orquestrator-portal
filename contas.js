// As contas da rotina do mês: receitas (taxa e imposto), resultado e partes, cascata, acerto acumulado entre as sócias,
// o que a empresa deve a cada uma, caixa informado, fôlego, fluxo de 12 meses, o selo do mês fechado e o roteiro do
// fechamento. Tudo puro e síncrono, em cima do razao.js: centavos inteiros (BigInt na conta, um arredondamento só, meio
// para longe do zero) e toda conta em reais carrega a explicação que a produziu ("Ver a conta"), feita pela mesma função
// que calcula o número, para os dois nunca divergirem. Nenhuma tela aqui: as páginas da fase 2 só leem.
// Plano: docs/PLANO-PORTAL.md §4.3, §4.6 (F7 a F13, F15, F16) e §5; docs/PLANO-FASES-2-3.md (F2-3).
// Testes: testes/contas.test.mjs (o outubro do plano centavo a centavo) e testes/selo.test.mjs.
import * as R from './razao.js';
import {sha256Hex, canonico, seloCurto} from './selo.js';

export {seloCurto};

// ── ajudantes ────────────────────────────────────────────────────────────────────────────────────────────────────
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const num = big => { if (big > MAX || big < -MAX) throw new Error('valor fora do limite'); return Number(big); };
function arred(n, d) { // meio para longe do zero, como o arred do razao.js
  const s = n < 0n ? -1n : 1n, a = n * s;
  return s * ((a + d / 2n) / d);
}
const soma = valores => num(valores.reduce((a, v) => a + BigInt(v), 0n));
const ehInteiro = v => Number.isSafeInteger(v);
const diaValido = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
const mesValido = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export function ultimoDiaDo(mes) { return new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).toISOString().slice(0, 10); }
export function somarMeses(mes, k) { const t = +mes.slice(0, 4) * 12 + (+mes.slice(5, 7) - 1) + k; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; }
const diasEntre = (de, ate) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 86400000);
const Mes = mes => { const s = R.nomeDoMes(mes).replace(/ de \d{4}$/, ''); return s.charAt(0).toUpperCase() + s.slice(1); };
const mesMinusculo = mes => R.nomeDoMes(mes).replace(/ de \d{4}$/, '');

const SIMBOLO = {BRL: 'R$', USD: 'US$', EUR: '€'};
// "R$ 2.396,00" a partir dos centavos (só texto: a conta já foi feita em inteiros)
export function textoDinheiro(minor, moeda = 'BRL') {
  if (!ehInteiro(minor)) return '—';
  const a = BigInt(minor < 0 ? -minor : minor), int = String(a / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${minor < 0 ? '−' : ''}${SIMBOLO[moeda] || moeda} ${int},${String(a % 100n).padStart(2, '0')}`;
}
const fmt = textoDinheiro;
// "9.90" → "9,9%" · "6.00" → "6%" · "0.38" → "0,38%"
export function textoPct(valor) {
  const s = String(valor ?? '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return s;
  const [i, f = ''] = s.split('.');
  const frac = f.replace(/0+$/, '');
  return (i.startsWith('-') ? '−' + i.slice(1) : i) + (frac ? ',' + frac : '') + '%';
}
const textoCambio = valor => String(valor).replace('.', ',');
const dataBR = dia => diaValido(dia) ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : String(dia || '');
// décimos de mês → "9,2"
export function textoDecimos(decimos) { if (!ehInteiro(decimos)) return '—'; const a = BigInt(decimos < 0 ? -decimos : decimos); return `${decimos < 0 ? '−' : ''}${a / 10n},${a % 10n}`; }
// centavos de um valor decimal em reais com até 2 casas ("2.49" → 249); null se tiver mais casas
function centavosDe(valor) {
  const d = R.decimal(valor, 2);
  return d ? num(d.n * 100n / d.d) : null;
}
// valor × percentual decimal ("9.90"), arredondado uma vez
function vezesPct(minor, pct) {
  const d = R.decimal(pct, 6);
  if (!d || !ehInteiro(minor)) return null;
  return num(arred(BigInt(minor) * d.n, d.d * 100n));
}
const nomeDe = (aplicado, id) => id === 'empresa' ? 'a empresa' : ((aplicado.membros || []).find(m => m.id === id) || {}).nome || id;
const rotuloCanal = id => (R.CANAIS.find(c => c.id === id) || {}).rotulo || id;
function maisAntigo(lista, chave) {
  let m = null;
  for (const p of lista) if (p.chave === chave && p.estado !== 'substituido' && (!m || p.desde < m.desde)) m = p;
  return m;
}
const refParam = p => p ? {tipo: 'parametro', id: p.id, chave: p.chave, valor: p.valor, desde: p.desde, por: p.por || null, fonte: p.fonte || null} : null;

// pesos de rateio em inteiros, na escala do plano (§4.1: 100% = 10 000 000 000), para o selo não ter número quebrado
function pesoInteiro(pct) {
  const d = typeof pct === 'number' || typeof pct === 'string' ? R.decimal(String(pct), 8) : null;
  return d ? num(d.n * 10n ** 8n / d.d) : null;
}
// F10: rateio pelo maior resto com a participação de cada sócia; null se a participação não fecha 100%
function partesDe(total, membros) {
  if (!ehInteiro(total) || !membros || !membros.length || membros.some(m => typeof m.pct !== 'number')) return null;
  return R.ratear(total, membros.map(m => String(m.pct)));
}

// Mês fechado usa só os parâmetros que existiam no fechamento (como o livroDoMes): mudar o dólar hoje não mexe nele.
export function listaDoMes(aplicado, lista, mes) {
  const f = aplicado.fechamentos && Object.hasOwn(aplicado.fechamentos, mes) && aplicado.fechamentos[mes].fechado ? aplicado.fechamentos[mes] : null;
  return f ? lista.filter(p => p.semente || p.ordem < f.ordemParametros) : lista;
}
const fechamentoDe = (aplicado, mes) => aplicado.fechamentos && Object.hasOwn(aplicado.fechamentos, mes) && aplicado.fechamentos[mes].fechado ? aplicado.fechamentos[mes] : null;

// ── receitas do mês: F7 (taxa da plataforma), F8 (imposto pela alíquota efetiva informada) ────────────────────────────
// Receita em dólar entra pela PTAX do último dia do mês, sem spread nem IOF (é dinheiro que entra, não compra no cartão).
export function receitasDoMes(aplicado, lista, mes) {
  const listaToda = lista || R.parametros(aplicado);
  const params = listaDoMes(aplicado, listaToda, mes);
  const ultimo = ultimoDiaDo(mes);
  const linhas = [], incompletos = [], usados = new Set();
  for (const r of aplicado.receitas || []) {
    if (r.competencia !== mes || r.estado === 'anulado') continue;
    const l = linhaDeReceita(r, params, ultimo);
    l.parametros.forEach(id => usados.add(id));
    if (l.brl === null) incompletos.push({id: r.id, motivo: l.motivo, descricao: l.rotulo});
    linhas.push(l);
  }
  const validas = linhas.filter(l => l.brl !== null);
  const bruto = soma(validas.map(l => l.brl)), taxas = soma(validas.map(l => l.taxas)), imposto = soma(validas.map(l => l.imposto));
  const liquido = bruto - taxas - imposto;
  const termo = (campo, op = '+') => validas.map(l => ({rotulo: l.rotulo, brl: l[campo], op, ref: {tipo: 'receita', id: l.id}, formula: l.explica[campo === 'brl' ? 'bruto' : campo].formula}));
  return {mes, linhas, bruto, taxas, imposto, liquido, incompletos, parametros: [...usados].sort(),
    transacoes: soma(validas.map(l => l.transacoes || 0)),
    explica: {
      bruto: {formula: 'Receita bruta = soma das vendas do mês, já sem os cancelamentos', termos: termo('brl'), resultado: bruto},
      taxas: {formula: 'Taxas = o que cada plataforma fica (o valor do extrato, quando informado; senão, a tabela do canal)', termos: termo('taxas'), resultado: taxas},
      imposto: {formula: 'Imposto = receita bruta × alíquota efetiva do Simples (informada pelo contador)', termos: termo('imposto'), resultado: imposto},
      liquido: {formula: 'Receita líquida = receita bruta − taxas − imposto', resultado: liquido,
        termos: [{rotulo: 'Receita bruta', brl: bruto, op: '+'}, {rotulo: 'Taxas das plataformas', brl: taxas, op: '−'}, {rotulo: 'Imposto (Simples)', brl: imposto, op: '−'}]},
    }};
}
function linhaDeReceita(r, params, ultimo) {
  const canal = rotuloCanal(r.canal);
  const rotulo = [canal, r.produto].filter(Boolean).join(' · ');
  const usados = [];
  const base = {id: r.id, canal: r.canal, rotuloCanal: canal, produto: r.produto || '', rotulo, moeda: r.moeda, brutoMinor: r.brutoMinor, transacoes: r.transacoes, taxasMinor: r.taxasMinor ?? null, parametros: usados};
  // bruto em reais
  let brl = null, conversao = 'real', ptax = null, explicaBruto;
  if (r.moeda === 'BRL') {
    brl = r.brutoMinor;
    explicaBruto = {formula: `${rotulo}: ${fmt(brl)} (já sem os cancelamentos)`, termos: [{rotulo, brl, op: '+', original: {minor: r.brutoMinor, moeda: 'BRL'}}], resultado: brl};
  } else {
    ptax = R.vigente(params, `fx.${r.moeda}_BRL`, ultimo) || maisAntigo(params, `fx.${r.moeda}_BRL`);
    if (!ptax) return {...base, brl: null, conversao: 'sem_cambio', taxas: null, imposto: null, liquido: null, origemTaxas: null, motivo: `Falta o câmbio de ${r.moeda} para ${dataBR(ultimo)}.`, explica: {}};
    brl = R.converter(r.brutoMinor, ptax.valor, '0', '0').principal;
    conversao = 'ptax';
    usados.push(ptax.id);
    explicaBruto = {formula: `Receita em ${r.moeda === 'USD' ? 'dólar' : r.moeda} convertida pela PTAX de ${dataBR(ptax.desde)}, sem spread nem IOF: ${fmt(r.brutoMinor, r.moeda)} × ${textoCambio(ptax.valor)} = ${fmt(brl)}`,
      termos: [{rotulo, brl, op: '+', original: {minor: r.brutoMinor, moeda: r.moeda}, ref: refParam(ptax)}], resultado: brl, cambioPosterior: ptax.desde > ultimo};
  }
  // F7: taxa da plataforma
  let taxas, origemTaxas, explicaTaxas;
  if (ehInteiro(r.taxasMinor)) {
    taxas = r.moeda === 'BRL' ? r.taxasMinor : R.converter(r.taxasMinor, ptax.valor, '0', '0').principal;
    origemTaxas = 'extrato';
    explicaTaxas = {formula: `Taxa ${canal} = valor do extrato${r.moeda === 'BRL' ? '' : ` (${fmt(r.taxasMinor, r.moeda)} × ${textoCambio(ptax.valor)})`} = ${fmt(taxas)}`, curto: 'valor do extrato', termos: [{rotulo: `Extrato ${canal}`, brl: taxas, op: '+'}], resultado: taxas};
  } else {
    const pct = R.vigente(params, `taxa.${r.canal}_pct`, ultimo), fixa = R.vigente(params, `taxa.${r.canal}_fixa`, ultimo);
    if (!pct && !fixa) {
      taxas = 0; origemTaxas = 'sem_parametro';
      explicaTaxas = {formula: `Taxa ${canal} = R$ 0,00: este canal não tem taxa na tabela. Se a plataforma cobrou, informe o valor do extrato.`, curto: 'sem taxa na tabela', termos: [], resultado: 0};
    } else {
      const parte = pct ? vezesPct(brl, pct.valor) : 0;
      const fixaMinor = fixa ? centavosDe(fixa.valor) : 0;
      const n = ehInteiro(r.transacoes) ? r.transacoes : 0;
      taxas = num(BigInt(parte) + BigInt(n) * BigInt(fixaMinor));
      origemTaxas = 'parametros';
      if (pct) usados.push(pct.id);
      if (fixa) usados.push(fixa.id);
      const pedacos = [pct ? `${textoPct(pct.valor)} × ${fmt(brl)}` : null, fixa ? `${n} × ${fmt(fixaMinor)}` : null].filter(Boolean).join(' + ');
      explicaTaxas = {formula: `Taxa ${canal} = ${pedacos} = ${fmt(taxas)}`, curto: pedacos, resultado: taxas,
        termos: [pct ? {rotulo: `${textoPct(pct.valor)} das vendas`, brl: parte, op: '+', ref: refParam(pct)} : null, fixa ? {rotulo: `${n} × ${fmt(fixaMinor)} por venda`, brl: num(BigInt(n) * BigInt(fixaMinor)), op: '+', ref: refParam(fixa)} : null].filter(Boolean)};
    }
  }
  // F8: imposto = receita bruta × alíquota efetiva (informada à mão até o cálculo do fator R entrar)
  const efetiva = R.vigente(params, 'imposto.simples_efetiva_pct', ultimo);
  let imposto = 0, explicaImposto = {formula: 'Imposto = R$ 0,00: falta a alíquota efetiva do Simples nos Parâmetros.', termos: [], resultado: 0};
  if (efetiva) {
    imposto = vezesPct(brl, efetiva.valor);
    usados.push(efetiva.id);
    explicaImposto = {formula: `Simples = ${textoPct(efetiva.valor)} × ${fmt(brl)} = ${fmt(imposto)}`, curto: `${textoPct(efetiva.valor)} da receita`, termos: [{rotulo: `Alíquota efetiva ${textoPct(efetiva.valor)}`, brl: imposto, op: '+', ref: refParam(efetiva)}], resultado: imposto, aConfirmar: efetiva.estado === 'a_confirmar'};
  }
  const liquido = brl - taxas - imposto;
  return {...base, brl, conversao, taxas, imposto, liquido, origemTaxas, explica: {bruto: explicaBruto, taxas: explicaTaxas, imposto: explicaImposto,
    liquido: {formula: `Líquido = ${fmt(brl)} − ${fmt(taxas)} − ${fmt(imposto)} = ${fmt(liquido)}`, termos: [{rotulo: 'Receita bruta', brl, op: '+'}, {rotulo: 'Taxa', brl: taxas, op: '−'}, {rotulo: 'Imposto', brl: imposto, op: '−'}], resultado: liquido}}};
}

// ── resultado do mês (F9), partes das sócias (F10) e a cascata ─────────────────────────────────────────────────────
export function resultadoDoMes(estadoBase, aplicado, lista, mes, hoje = null) {
  const listaToda = lista || R.parametros(aplicado);
  const livro = R.livroDoMes(estadoBase, aplicado, mes, hoje);
  const receitas = receitasDoMes(aplicado, listaToda, mes);
  const resultado = receitas.liquido - livro.total;
  const membros = aplicado.membros || [];
  const p = partesDe(resultado, membros);
  const partes = p ? membros.map((m, k) => ({id: m.id, nome: m.nome, pct: m.pct, valor: p[k]})) : null;
  const provisorio = !livro.fechado;
  return {mes, livro, receitas, receitaBruta: receitas.bruto, taxas: receitas.taxas, imposto: receitas.imposto, receitaLiquida: receitas.liquido,
    realizado: livro.realizado, previsto: livro.previsto, custo: livro.total, resultado, partes, fechado: livro.fechado, provisorio,
    incompletos: [...receitas.incompletos, ...livro.incompletos],
    explica: {
      resultado: {formula: 'Resultado = receita líquida − custo do mês', resultado,
        texto: `${fmt(receitas.liquido)} − ${fmt(livro.total)} = ${fmt(resultado)}`,
        termos: [{rotulo: 'Receita bruta', brl: receitas.bruto, op: '+'}, {rotulo: 'Taxas das plataformas', brl: receitas.taxas, op: '−'}, {rotulo: 'Imposto (Simples)', brl: receitas.imposto, op: '−'},
          {rotulo: 'Custo do mês (realizado + previsto)', brl: livro.total, op: '−'}]},
      partes: partes ? {formula: 'Parte de cada sócia = resultado × participação (maior resto: as partes somam o resultado ao centavo)', resultado,
        termos: partes.map(x => ({rotulo: `${x.nome} (${textoPct(String(x.pct))})`, brl: x.valor, op: '+', ref: {tipo: 'socia', id: x.id}}))} : null,
    }};
}
// Cascata "para onde vão as receitas": receita → taxas → imposto → custos → resultado → partes, no formato do
// graficos.cascata (centavos inteiros; os totais conferem com os passos e as partes repartem o resultado até o zero).
export function cascataDoMes(estadoBase, aplicado, lista, mes, hoje = null, membroId = null) {
  const r = resultadoDoMes(estadoBase, aplicado, lista, mes, hoje);
  const vendas = r.receitas.transacoes;
  const passos = [
    {rotulo: 'Receita bruta', valor: r.receitaBruta, tipo: 'total', moeda: 'BRL', nota: vendas ? `${vendas} ${vendas === 1 ? 'venda' : 'vendas'}` : '', explica: r.receitas.explica.bruto},
    {rotulo: 'Taxas das plataformas', valor: -r.taxas, tipo: 'delta', moeda: 'BRL', nota: r.receitas.linhas.length === 1 && r.receitas.linhas[0].explica.taxas ? r.receitas.linhas[0].explica.taxas.curto || '' : '', explica: r.receitas.explica.taxas},
    {rotulo: 'Imposto (Simples)', valor: -r.imposto, tipo: 'delta', moeda: 'BRL', nota: r.receitas.linhas.length === 1 && r.receitas.linhas[0].explica.imposto ? r.receitas.linhas[0].explica.imposto.curto || '' : '', explica: r.receitas.explica.imposto},
    {rotulo: 'Custos lançados', valor: -r.realizado, tipo: 'delta', moeda: 'BRL', explica: r.livro.explica.realizado},
  ];
  if (r.previsto) passos.push({rotulo: 'Previsto (assinaturas sem lançamento)', valor: -r.previsto, tipo: 'delta', moeda: 'BRL', previsto: true, explica: r.livro.explica.previsto});
  passos.push({rotulo: `Resultado de ${mesMinusculo(mes)}`, valor: r.resultado, tipo: 'total', moeda: 'BRL', estimado: r.provisorio, explica: r.explica.resultado});
  if (r.partes && r.resultado !== 0) for (const x of r.partes) passos.push({rotulo: x.id === membroId ? `${x.nome} · sua parte` : x.nome, valor: x.valor, tipo: 'parte', moeda: 'BRL', destaque: x.id === membroId, nota: textoPct(String(x.pct)), explica: r.explica.partes});
  return {mes, passos, resultado: r.resultado, provisorio: r.provisorio, rotulo: `Para onde vão os ${fmt(r.receitaBruta)} de ${mesMinusculo(mes)}`};
}

// ── acerto acumulado entre as sócias (F11), a receber da empresa (F12) e aportes ───────────────────────────────────
// Independe de fechamento: soma tudo até a data "ate" (inclusive). Gasto de mês fechado entra com os parâmetros
// daquele fechamento, para o acerto bater com o livro do mês.
export function acertoAcumulado(estadoBase, aplicado, lista, ate) {
  const listaToda = lista || R.parametros(aplicado);
  const membros = aplicado.membros || [];
  const listas = new Map();
  const listaDe = mes => { if (!listas.has(mes)) listas.set(mes, listaDoMes(aplicado, listaToda, mes)); return listas.get(mes); };
  const reaisDe = g => R.reaisDoGasto(g, listaDe(g.competencia));
  const zero = () => Object.fromEntries(membros.map(m => [m.id, 0n]));
  const pagou = zero(), parte = zero(), enviou = zero(), recebeu = zero(), devidoGastos = zero(), reembolsado = zero(), aporteGastos = zero(), aporteConvertido = zero(), aporteDinheiro = zero(), retiradas = zero();
  const pcts = membros.map(m => String(m.pct));
  const incompletos = [], reembolsosPendentes = [], aguardandoConfirmacao = [];
  const ate_ = d => !ate || d <= ate;
  for (const g of aplicado.gastos || []) {
    if (g.estado === 'anulado' || !ate_(g.data) || !Object.hasOwn(pagou, g.pagoPor) || R.formaDaEmpresa(g.forma)) continue;
    const r = reaisDe(g);
    if (r.brl === null) { incompletos.push({id: g.id, descricao: g.descricao, motivo: `Falta o câmbio de ${g.moeda} para ${dataBR(g.data)}.`}); continue; }
    if (g.destino === 'dividir') {
      if (g.reembolsadoEm) continue;   // legado do treino: marcado como reembolsado = já acertado entre elas
      const partes = R.ratear(r.brl, pcts);
      if (!partes) { incompletos.push({id: g.id, descricao: g.descricao, motivo: 'A participação das sócias não fecha 100%: não dá para dividir.'}); continue; }
      pagou[g.pagoPor] += BigInt(r.brl);
      membros.forEach((m, k) => { parte[m.id] += BigInt(partes[k]); });
    } else if (g.destino === 'empresa_reembolsa') {
      if (g.convertidoEm) { aporteConvertido[g.pagoPor] += BigInt(r.brl); continue; }
      if (g.reembolsadoEm) continue;   // mark_reimbursed (legado): já reembolsado, sem registro de acerto
      devidoGastos[g.pagoPor] += BigInt(r.brl);
      if (!g.reembolsoId) reembolsosPendentes.push({id: g.id, descricao: g.descricao, pagoPor: g.pagoPor, nome: nomeDe(aplicado, g.pagoPor), data: g.data, competencia: g.competencia,
        valorMinor: g.valorMinor, moeda: g.moeda, brl: r.brl, conversao: r.tipo});
    } else if (g.destino === 'aporte') aporteGastos[g.pagoPor] += BigInt(r.brl);
  }
  for (const a of aplicado.acertos || []) {
    if (!ate_(a.data)) continue;
    const v = BigInt(a.valorMinor);
    if (a.tipo === 'acerto_entre_socias' && Object.hasOwn(enviou, a.de) && Object.hasOwn(recebeu, a.para)) { enviou[a.de] += v; recebeu[a.para] += v; }
    else if (a.tipo === 'reembolso_empresa' && Object.hasOwn(reembolsado, a.para)) reembolsado[a.para] += v;
    else if (a.tipo === 'aporte' && Object.hasOwn(aporteDinheiro, a.de)) aporteDinheiro[a.de] += v;
    else if (a.tipo === 'retirada' && Object.hasOwn(retiradas, a.para)) retiradas[a.para] += v;
    if (!a.confirmadoPor) aguardandoConfirmacao.push({id: a.id, tipo: a.tipo, de: a.de, para: a.para, deNome: nomeDe(aplicado, a.de), paraNome: nomeDe(aplicado, a.para), valorMinor: a.valorMinor, data: a.data,
      quemConfirma: a.para === 'empresa' ? 'a responsável' : nomeDe(aplicado, a.para)});
  }
  const porSocia = membros.map(m => {
    const id = m.id;
    const saldo = num(pagou[id] - parte[id] + enviou[id] - recebeu[id]);
    const devido = num(devidoGastos[id] - reembolsado[id]);
    const aportes = num(aporteGastos[id] + aporteConvertido[id] + aporteDinheiro[id]);
    return {id, nome: m.nome, pct: m.pct, pagouDividido: num(pagou[id]), parteDividido: num(parte[id]), pixEnviados: num(enviou[id]), pixRecebidos: num(recebeu[id]), saldo,
      devidoGastos: num(devidoGastos[id]), reembolsosRecebidos: num(reembolsado[id]), devido, aportes, retiradas: num(retiradas[id]),
      explica: {
        saldo: {formula: 'Saldo no acerto = o que você pagou nos gastos divididos − a sua parte neles ± os Pix entre vocês', resultado: saldo,
          termos: [{rotulo: 'Pagou nos gastos divididos', brl: num(pagou[id]), op: '+'}, {rotulo: `A sua parte neles (${textoPct(String(m.pct))})`, brl: num(parte[id]), op: '−'},
            {rotulo: 'Pix que você mandou às outras', brl: num(enviou[id]), op: '+'}, {rotulo: 'Pix que você recebeu delas', brl: num(recebeu[id]), op: '−'}]},
        devido: {formula: 'A receber da empresa = gastos pagos do seu bolso que a empresa reembolsa − reembolsos que você já recebeu', resultado: devido,
          termos: [{rotulo: 'Gastos a reembolsar', brl: num(devidoGastos[id]), op: '+'}, {rotulo: 'Reembolsos recebidos', brl: num(reembolsado[id]), op: '−'}]},
        aportes: {formula: 'Aportes = gastos que você pagou como aporte + reembolsos convertidos em aporte + dinheiro que você pôs na empresa', resultado: aportes,
          termos: [{rotulo: 'Gastos como aporte', brl: num(aporteGastos[id]), op: '+'}, {rotulo: 'Reembolsos convertidos', brl: num(aporteConvertido[id]), op: '+'}, {rotulo: 'Aportes em dinheiro', brl: num(aporteDinheiro[id]), op: '+'}]},
      }};
  });
  const saldos = Object.fromEntries(porSocia.map(s => [s.id, s.saldo]));
  const transferencias = transferenciasDe(saldos, membros).map(t => ({...t, conversao: 'real', deNome: nomeDe(aplicado, t.de), paraNome: nomeDe(aplicado, t.para), texto: `${nomeDe(aplicado, t.de)} → ${nomeDe(aplicado, t.para)} · ${fmt(t.brl)}`}));
  return {ate: ate || null, porSocia, saldos, transferencias, devido: Object.fromEntries(porSocia.map(s => [s.id, s.devido])), aportes: Object.fromEntries(porSocia.map(s => [s.id, s.aportes])),
    reembolsosPendentes, aguardandoConfirmacao, incompletos,
    explica: {formula: 'Saldo no acerto = o que você pagou nos gastos divididos − a sua parte neles ± os Pix entre vocês. Os saldos somam zero: quem está devendo paga quem tem a receber, do maior para o maior.'}};
}
// F11: o maior devedor paga o maior credor até zerar (no máximo n−1 transferências); empate pela ordem das sócias
export function transferenciasDe(saldos, membros) {
  const ordem = new Map(membros.map((m, k) => [m.id, k]));
  const fila = sinal => Object.entries(saldos).filter(([, v]) => sinal * v > 0).map(([id, v]) => ({id, v: sinal * v})).sort((a, b) => b.v - a.v || ordem.get(a.id) - ordem.get(b.id));
  const credores = fila(1), devedores = fila(-1), saida = [];
  while (credores.length && devedores.length) {
    const c = credores[0], d = devedores[0], x = Math.min(c.v, d.v);
    saida.push({de: d.id, para: c.id, brl: x});
    c.v -= x; d.v -= x;
    if (!c.v) credores.shift();
    if (!d.v) devedores.shift();
  }
  return saida;
}

// ── caixa informado: o último saldo de cada conta até a data ───────────────────────────────────────────────────────
// Saldo em moeda estrangeira vira reais pela PTAX do dia do saldo, só o principal (sem spread nem IOF: não é compra).
export function caixaInformado(aplicado, lista, data) {
  const params = lista || R.parametros(aplicado);
  const ultimos = new Map();
  for (const s of aplicado.saldos || []) { if (data && s.data > data) continue; const m = ultimos.get(s.conta); if (!m || s.data >= m.data) ultimos.set(s.conta, s); }
  const contas = [], incompletos = [];
  for (const s of ultimos.values()) {
    const base = {id: s.id, conta: s.conta, data: s.data, valorMinor: s.valorMinor, moeda: s.moeda, fonte: s.fonte, criadoPor: s.criadoPor, idadeDias: data ? diasEntre(s.data, data) : null};
    if (s.moeda === 'BRL') { contas.push({...base, brl: s.valorMinor, conversao: 'real', explica: {formula: `${s.conta}: ${fmt(s.valorMinor)} em ${dataBR(s.data)}`, termos: [], resultado: s.valorMinor}}); continue; }
    const fx = R.vigente(params, `fx.${s.moeda}_BRL`, s.data) || maisAntigo(params, `fx.${s.moeda}_BRL`);
    if (!fx) { contas.push({...base, brl: null, conversao: 'sem_cambio', explica: null}); incompletos.push({id: s.id, descricao: s.conta, motivo: `Falta o câmbio de ${s.moeda} para ${dataBR(s.data)}.`}); continue; }
    const brl = R.converter(s.valorMinor, fx.valor, '0', '0').principal;
    contas.push({...base, brl, conversao: 'ptax', explica: {formula: `Saldo em ${s.moeda === 'USD' ? 'dólar' : s.moeda} convertido pela PTAX do dia, sem spread: ${fmt(s.valorMinor, s.moeda)} × ${textoCambio(fx.valor)} = ${fmt(brl)}`,
      termos: [{rotulo: s.conta, brl, op: '+', original: {minor: s.valorMinor, moeda: s.moeda}, ref: refParam(fx)}], resultado: brl, cambioPosterior: fx.desde > s.data}});
  }
  const validas = contas.filter(c => c.brl !== null);
  const total = soma(validas.map(c => c.brl));
  const idades = contas.map(c => c.idadeDias).filter(ehInteiro);
  // temSaldo: há ao menos uma conta que vira reais; completo: nenhuma conta ficou de fora por falta de câmbio
  return {data: data || null, contas, total, temSaldo: validas.length > 0, completo: incompletos.length === 0, idadeMaxDias: idades.length ? Math.max(...idades) : null, incompletos,
    explica: {formula: 'Caixa = soma do último saldo informado de cada conta (moeda estrangeira pela PTAX do dia do saldo, sem spread)', resultado: total,
      termos: validas.map(c => ({rotulo: `${c.conta} (${dataBR(c.data)})`, brl: c.brl, op: '+', ref: {tipo: 'saldo', id: c.id}})), excluidos: incompletos.map(i => ({rotulo: i.descricao, motivo: i.motivo}))}};
}

// ── fluxo de 12 meses (+ 3 futuros só com o previsto das assinaturas) ───────────────────────────────────────────────
// entrou = receita bruta; saiu = custo do mês (realizado + previsto) + taxas + imposto; então saiu − entrou é a queima
// (F13) e entrou − saiu é o resultado (F9). saldo = caixa informado no fim do mês, só se houve saldo informado nele.
// A série começa no primeiro mês com dado: nada é inventado para trás.
function primeiroMesComDado(aplicado) {
  const meses = [];
  for (const g of aplicado.gastos || []) if (g.estado !== 'anulado' && mesValido(g.competencia)) meses.push(g.competencia);
  for (const r of aplicado.receitas || []) if (r.estado !== 'anulado' && mesValido(r.competencia)) meses.push(r.competencia);
  for (const s of aplicado.saldos || []) if (diaValido(s.data)) meses.push(s.data.slice(0, 7));
  for (const m of Object.keys(aplicado.fechamentos || {})) if (mesValido(m)) meses.push(m);
  return meses.length ? meses.reduce((a, b) => (b < a ? b : a)) : null;
}
export function serie12m(estadoBase, aplicado, mesFinal, hoje = null) {
  const lista = R.parametros(aplicado);
  const primeiro = primeiroMesComDado(aplicado);
  let inicio = somarMeses(mesFinal, -11);
  if (!primeiro || primeiro > mesFinal) inicio = mesFinal;
  else if (primeiro > inicio) inicio = primeiro;
  const mesHoje = diaValido(hoje) ? hoje.slice(0, 7) : null;
  const mesesComSaldo = new Set((aplicado.saldos || []).map(s => s.data.slice(0, 7)));
  const pontos = [];
  for (let m = inicio; m <= mesFinal; m = somarMeses(m, 1)) {
    const r = resultadoDoMes(estadoBase, aplicado, lista, m, hoje);
    const f = fechamentoDe(aplicado, m);
    const fim = mesHoje === m ? hoje : ultimoDiaDo(m);
    const caixa = mesesComSaldo.has(m) ? caixaInformado(aplicado, lista, fim) : null;
    const saiu = r.custo + r.taxas + r.imposto;
    pontos.push({mes: m, moeda: 'BRL', entrou: r.receitaBruta, saiu, saldo: caixa && caixa.temSaldo ? caixa.total : null, fechado: !!f, selo: f ? f.selo : null,
      aberto: !f && mesHoje === m, futuro: false, realizado: r.realizado, previsto: r.previsto, taxas: r.taxas, imposto: r.imposto, resultado: r.resultado, provisorio: r.provisorio,
      explica: {entrou: r.receitas.explica.bruto,
        saiu: {formula: 'Saiu = custo do mês (realizado + previsto) + taxas das plataformas + imposto', resultado: saiu,
          termos: [{rotulo: 'Custos lançados', brl: r.realizado, op: '+'}, {rotulo: 'Previsto (assinaturas sem lançamento)', brl: r.previsto, op: '+'}, {rotulo: 'Taxas', brl: r.taxas, op: '+'}, {rotulo: 'Imposto', brl: r.imposto, op: '+'}]},
        saldo: caixa && caixa.temSaldo ? caixa.explica : null}});
  }
  for (let k = 1; k <= 3; k++) {
    const m = somarMeses(mesFinal, k);
    const l = R.livroDoMes(estadoBase, aplicado, m, hoje);
    pontos.push({mes: m, moeda: 'BRL', entrou: null, saiu: l.previsto, saldo: null, fechado: false, selo: null, aberto: false, futuro: true, realizado: 0, previsto: l.previsto, taxas: null, imposto: null, resultado: null, provisorio: true,
      explica: {saiu: {...l.explica.previsto, formula: 'Previsto = assinaturas ativas e confirmadas, pelo equivalente mensal (sem receitas: o portal não inventa vendas)'}}});
  }
  return pontos;
}

// ── fôlego (F13): caixa ÷ queima média dos últimos min(3, N) meses fechados ────────────────────────────────────────
export function folego(estadoBase, aplicado, hoje) {
  const lista = R.parametros(aplicado);
  const mesHoje = diaValido(hoje) ? hoje.slice(0, 7) : '9999-12';
  const fechados = Object.keys(aplicado.fechamentos || {}).filter(m => mesValido(m) && aplicado.fechamentos[m].fechado && m <= mesHoje).sort();
  const base = fechados.slice(-3);
  const meses = base.map(m => {
    const r = resultadoDoMes(estadoBase, aplicado, lista, m, hoje);
    const saiu = r.custo + r.taxas + r.imposto;
    return {mes: m, entrou: r.receitaBruta, saiu, queima: saiu - r.receitaBruta, selo: aplicado.fechamentos[m].selo};
  });
  const caixa = caixaInformado(aplicado, lista, diaValido(hoje) ? hoje : null);
  const N = base.length;
  const somaQueima = soma(meses.map(m => m.queima));
  const queimaMedia = N ? num(arred(BigInt(somaQueima), BigInt(N))) : null;
  const rotuloBase = N ? `média de ${N} ${N === 1 ? 'mês fechado' : 'meses fechados'}` : 'nenhum mês fechado';
  const explicaQueima = {formula: 'Queima = o que saiu − o que entrou, em cada mês fechado; a queima média divide pelo número de meses', resultado: queimaMedia,
    termos: meses.map(m => ({rotulo: `${Mes(m.mes)}: ${fmt(m.saiu)} − ${fmt(m.entrou)}`, brl: m.queima, op: '+', ref: {tipo: 'mes', id: m.mes}}))};
  const ultimaData = caixa.contas.reduce((a, c) => (!a || c.data > a ? c.data : a), null);
  // a data dos saldos que entram no caixa: um dia só, ou de qual a qual quando são de dias diferentes (datar pelo mais
  // novo esconderia um saldo antigo dentro do total)
  const datas = caixa.contas.filter(c => c.brl !== null).map(c => c.data).sort();
  const quando = datas.length && datas[0] !== datas[datas.length - 1] ? `com saldos de ${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}` : `em ${dataBR(datas[0])}`;
  const abre = caixa.temSaldo ? `Caixa de ${fmt(caixa.total)} ${quando}` : 'Sem saldo do banco informado';
  const comum = {caixa: caixa.total, caixaInformado: caixa, dataDoCaixa: ultimaData, queimaMedia, base: N, meses, rotuloBase};
  const explica = (texto, resultado = null) => ({formula: `Fôlego = caixa ÷ queima média de ${N || 'N'} ${N === 1 ? 'mês fechado' : 'meses fechados'}`, texto, resultado, unidade: 'décimos de mês',
    termos: [{rotulo: 'Caixa (último saldo de cada conta)', brl: caixa.total, op: '='}, ...(queimaMedia !== null ? [{rotulo: `Queima média (${rotuloBase})`, brl: queimaMedia, op: '÷'}] : [])],
    caixa: caixa.explica, queima: explicaQueima});
  if (!N) return {...comum, estado: 'sem_mes_fechado', decimos: null, texto: 'precisa de 1 mês fechado', frase: `${abre}: o fôlego precisa de 1 mês fechado.`, explica: explica('O portal nunca inventa o fôlego: ele aparece quando houver 1 mês fechado.')};
  if (somaQueima <= 0) return {...comum, estado: 'sem_queima', decimos: null, texto: 'sem queima de caixa', frase: `${abre}: sem queima de caixa (${rotuloBase}).`, explica: explica(`Nos meses fechados entrou mais do que saiu (${rotuloBase}): o caixa não está diminuindo.`)};
  if (!caixa.temSaldo) return {...comum, estado: 'sem_saldo', decimos: null, texto: 'falta informar o saldo do banco', frase: 'Informe o saldo do banco para ver quanto tempo o caixa dura.', explica: explica('Informe o saldo da conta da empresa para calcular o fôlego.')};
  const decimos = num(arred(BigInt(caixa.total) * 10n * BigInt(N), BigInt(somaQueima)));   // um arredondamento só
  const texto = `≈ ${textoDecimos(decimos)} ${decimos === 10 ? 'mês' : 'meses'}`;
  // conta sem câmbio fica fora da soma: o fôlego sai, mas avisa que é parcial (nunca finge que o caixa é só aquilo)
  const fora = caixa.completo === false ? ` Sem contar ${caixa.incompletos.map(i => i.descricao).join(', ')}: falta o câmbio.` : '';
  return {...comum, estado: 'ok', parcial: !!fora, decimos, texto, frase: `${abre}: dá ${texto} na queima ${rotuloBase}.${fora}`, explica: explica(`${fmt(caixa.total)} ÷ ${fmt(queimaMedia)} por mês = ${textoDecimos(decimos)} meses (${rotuloBase})`, decimos)};
}

// ── o selo do mês (F16) ──────────────────────────────────────────────────────────────────────────────────────────
// A foto leva SÓ o que forma os números do mês: gastos e receitas da competência, previsto das assinaturas, parâmetros
// usados, totais e partes. Ficam de fora acertos, reembolsos, conversões em aporte, conferências, saldos e versões:
// conferir ou reembolsar não muda o selo (e eles não travam no mês fechado; ver a F2-1). O previsto usa o último dia do
// mês como data de câmbio, então a foto não depende de "hoje".
export function fotoDoMes(estadoBase, aplicado, mes, cabeca) {
  const listaToda = R.parametros(aplicado);
  const lista = listaDoMes(aplicado, listaToda, mes);
  const l = R.livroDoMes(estadoBase, aplicado, mes, null);
  const rec = receitasDoMes(aplicado, listaToda, mes);
  const usados = new Set(rec.parametros);
  const usar = conta => { if (!conta) return; for (const p of [conta.cambio, conta.spreadParam, conta.iofParam]) if (p && p.id) usados.add(p.id); };
  let variacao = 0n;
  for (const ln of l.linhas) {
    if (ln.anulado || ln.brl === null) continue;
    usar(ln.conta);
    if (ln.tipo === 'realizado' && ln.conversao === 'efetivo') {   // F4: variação cambial = fatura − estimativa
      const est = R.reaisDoGasto({...ln.gasto, faturaBrlMinor: null}, lista);
      if (est.brl !== null) { variacao += BigInt(ln.brl - est.brl); usar(est.conta); }
    }
  }
  const resultado = rec.liquido - l.total;
  const membros = aplicado.membros || [];
  const porSocia = valores => valores ? Object.fromEntries(membros.map((m, k) => [m.id, valores[k]])) : null;
  const linhaDe = new Map(l.linhas.filter(x => x.tipo === 'realizado').map(x => [x.id, x]));
  const porId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    mes, cabeca: ehInteiro(cabeca) ? cabeca : null,
    totais: {realizado: l.realizado, previsto: l.previsto, total: l.total, por_moeda: {...l.porMoeda}, por_categoria: Object.fromEntries(l.porCategoria.map(c => [c.id, c.brl])),
      receita_bruta: rec.bruto, taxas: rec.taxas, imposto: rec.imposto, receita_liquida: rec.liquido, resultado, variacao_cambial: num(variacao)},
    partes: {custo: porSocia(partesDe(l.total, membros)), resultado: porSocia(partesDe(resultado, membros))},
    pesos: Object.fromEntries(membros.map(m => [m.id, pesoInteiro(m.pct)])),
    parametros: [...usados].sort(),
    gastos: (aplicado.gastos || []).filter(g => g.competencia === mes).map(g => {
      const ln = linhaDe.get(g.id);
      return {id: g.id, valorMinor: g.valorMinor, moeda: g.moeda, brl: g.estado === 'anulado' || !ln ? null : ln.brl, categoria: g.categoria, estado: g.estado === 'anulado' ? 'anulado' : 'valido'};
    }).sort(porId),
    previstos: l.linhas.filter(x => x.tipo === 'previsto').map(x => ({id: x.id, valorMinor: x.original.minor, moeda: x.original.moeda, brl: x.brl})).sort(porId),
    receitas: rec.linhas.map(r => ({id: r.id, brutoMinor: r.brutoMinor, moeda: r.moeda, brl: r.brl, taxas: r.taxas, imposto: r.imposto})).sort(porId),
  };
}
export function seloDoMes(foto) { return sha256Hex(canonico(foto)); }
// Refaz cada mês fechado com o diário até a cabeça do fechamento e compara com o selo gravado. O aplicar é injetável
// (a F3-2 passa a versão com as extensões). O prefixo custa um fold por cabeça distinta (medido no teste).
export function conferirFechamentos(estadoBase, eventos, {aplicar = R.aplicar} = {}) {
  const lista = Array.isArray(eventos) ? eventos : [];
  const tudo = aplicar(estadoBase, lista);
  const prefixos = new Map();
  const prefixo = cabeca => { if (!prefixos.has(cabeca)) prefixos.set(cabeca, aplicar(estadoBase, lista.filter(e => e && typeof e.seq === 'number' && e.seq <= cabeca))); return prefixos.get(cabeca); };
  return Object.keys(tudo.fechamentos || {}).filter(m => tudo.fechamentos[m].fechado).sort().map(mes => {
    const f = tudo.fechamentos[mes];
    const seloRefeito = seloDoMes(fotoDoMes(estadoBase, prefixo(f.cabeca), mes, f.cabeca));
    const confere = seloRefeito === f.selo;
    return {mes, situacao: confere ? 'confere' : 'não confere', confere, selo: f.selo, seloCurto: seloCurto(f.selo), seloRefeito, cabeca: f.cabeca, seq: f.seq, por: f.por, porNome: nomeDe(tudo, f.por), em: f.em, totais: f.totais};
  });
}

// ── roteiro do fechamento: 6 passos, cada um pronto, falta ou atenção, com os itens ────────────────────────────────
// "falta" = há o que fazer antes de fechar; "atencao" = vale olhar, mas não impede; "pronto" = nada pendente.
export function roteiroDoFechamento(estadoBase, aplicado, lista, mes, hoje) {
  const listaToda = lista || R.parametros(aplicado);
  const params = listaDoMes(aplicado, listaToda, mes);
  const l = R.livroDoMes(estadoBase, aplicado, mes, hoje);
  const doMes = (aplicado.gastos || []).filter(g => g.competencia === mes && g.estado !== 'anulado');
  const nome = id => nomeDe(aplicado, id);
  const linhaDe = new Map(l.linhas.filter(x => x.tipo === 'realizado').map(x => [x.id, x]));
  const passos = [];
  // 01 Todas lançaram?
  const socias = (aplicado.membros || []).map(m => {
    const n = doMes.filter(g => g.criadoPor === m.id).length;
    const primeiro = String(m.nome || '').split(' ')[0];
    return {tipo: 'socia', id: m.id, nome: m.nome, lancamentos: n, texto: `${primeiro}: ${n ? `${n} ${n === 1 ? 'lançamento' : 'lançamentos'}` : 'nenhum'}`,
      lembrete: n ? null : `Oi, ${primeiro}! Faltam seus gastos de ${mesMinusculo(mes)} no portal: + Lançar, leva 10 segundos.`};
  });
  const semPagamento = l.linhas.filter(x => x.tipo === 'previsto').map(x => ({tipo: 'assinatura', id: x.id, descricao: x.descricao, brl: x.brl, conversao: x.conversao,
    texto: `${x.descricao}: sem pagamento lançado em ${mesMinusculo(mes)} (entra como previsto${x.brl === null ? '' : `, ${fmt(x.brl)}`})`}));
  const faltaAlguem = socias.some(s => !s.lancamentos);
  passos.push({numero: 1, chave: 'lancamentos', titulo: 'Todas lançaram?', estado: faltaAlguem || semPagamento.length ? 'atencao' : 'pronto',
    resumo: socias.map(s => s.texto).join(' · ') + (semPagamento.length ? ` · ${semPagamento.length} ${semPagamento.length === 1 ? 'assinatura sem pagamento' : 'assinaturas sem pagamento'}` : ''),
    itens: [...socias, ...semPagamento]});
  // 02 Faturas em moeda estrangeira conciliadas?
  const semFatura = doMes.filter(g => g.moeda !== 'BRL' && !(ehInteiro(g.faturaBrlMinor) && g.faturaBrlMinor > 0)).map(g => {
    const ln = linhaDe.get(g.id);
    return {tipo: 'gasto', id: g.id, descricao: g.descricao, forma: g.forma, valorMinor: g.valorMinor, moeda: g.moeda, brl: ln ? ln.brl : null, conversao: ln ? ln.conversao : 'sem_cambio',
      texto: `${g.descricao} · ${fmt(g.valorMinor, g.moeda)} · ${R.rotuloForma(g.forma)}: sem fatura${ln && ln.brl !== null ? ` (≈ ${fmt(ln.brl)} estimado)` : ''}`};
  });
  const estrangeiros = doMes.filter(g => g.moeda !== 'BRL').length;
  passos.push({numero: 2, chave: 'faturas', titulo: 'Faturas em moeda estrangeira conciliadas?', estado: semFatura.length ? 'falta' : 'pronto',
    resumo: !estrangeiros ? 'Nenhum gasto em moeda estrangeira.' : semFatura.length ? `${semFatura.length} de ${estrangeiros} ${estrangeiros === 1 ? 'gasto' : 'gastos'} sem o valor da fatura.` : 'Todas as faturas conciliadas.',
    formas: [...new Set(semFatura.map(i => i.forma))], itens: semFatura});
  // 03 Conferidos por outra sócia?
  const naoConferidos = doMes.filter(g => g.estado !== 'conferido').map(g => ({tipo: 'gasto', id: g.id, descricao: g.descricao, criadoPor: g.criadoPor, valorMinor: g.valorMinor, moeda: g.moeda,
    texto: `${g.descricao} · ${fmt(g.valorMinor, g.moeda)} · lançado por ${nome(g.criadoPor)}`}));
  passos.push({numero: 3, chave: 'conferencia', titulo: 'Conferidos por outra sócia?', estado: naoConferidos.length ? 'falta' : 'pronto',
    resumo: !doMes.length ? 'Nenhum lançamento no mês.' : naoConferidos.length ? `${naoConferidos.length} de ${doMes.length} sem conferência.` : 'Todos conferidos.', itens: naoConferidos});
  // 04 Reembolsos e acertos (lembrete: não trava o fechamento)
  const acerto = acertoAcumulado(estadoBase, aplicado, listaToda, hoje);
  const reembolsos = acerto.reembolsosPendentes.filter(g => g.competencia <= mes).map(g => ({tipo: 'reembolso', ...g, texto: `${g.descricao}: a empresa deve ${fmt(g.brl)} a ${g.nome}`}));
  const confirmar = acerto.aguardandoConfirmacao.map(a => ({tipo: 'confirmacao', ...a, texto: `${a.deNome} → ${a.paraNome} · ${fmt(a.valorMinor)}: falta ${a.quemConfirma} confirmar`}));
  const transferir = acerto.transferencias.map(t => ({tipo: 'transferencia', ...t}));
  const pend4 = reembolsos.length + confirmar.length + transferir.length;
  passos.push({numero: 4, chave: 'acertos', titulo: 'Reembolsos e acertos', estado: pend4 ? 'atencao' : 'pronto',
    resumo: pend4 ? 'Há acertos em aberto. Não impedem o fechamento: acertos e reembolsos não mudam os números do mês.' : 'Nada a acertar.', itens: [...reembolsos, ...confirmar, ...transferir]});
  // 05 Parâmetros usados ("a confirmar" e dólar com mais de 7 dias)
  const foto = fotoDoMes(estadoBase, aplicado, mes, null);
  const porIdP = new Map(params.map(p => [p.id, p]));
  const usados = foto.parametros.map(id => porIdP.get(id)).filter(Boolean).map(p => {
    const item = R.itemCatalogo(p.chave) || {rotulo: p.chave, unidade: ''};
    return {tipo: 'parametro', id: p.id, chave: p.chave, rotulo: item.rotulo, valor: p.valor, unidade: item.unidade, desde: p.desde, estado: p.estado, fonte: p.fonte, por: p.por || null};
  });
  const atencao5 = usados.filter(p => p.estado === 'a_confirmar').map(p => ({...p, texto: `${p.rotulo}: ${p.unidade === '%' ? textoPct(p.valor) : p.unidade === 'R$' ? fmt(centavosDe(p.valor)) : textoCambio(p.valor)} (a confirmar)`}));
  const temDolar = foto.gastos.some(g => g.moeda === 'USD' && g.estado !== 'anulado') || foto.previstos.some(p => p.moeda === 'USD') || foto.receitas.some(r => r.moeda === 'USD');
  if (temDolar) {
    const ref = diaValido(hoje) && hoje < ultimoDiaDo(mes) ? hoje : ultimoDiaDo(mes);
    const fx = R.vigente(params, 'fx.USD_BRL', ref);
    if (fx && diasEntre(fx.desde, ref) > 7) atencao5.push({tipo: 'dolar', id: fx.id, chave: fx.chave, desde: fx.desde, texto: `O dólar mais recente é de ${dataBR(fx.desde)} (${diasEntre(fx.desde, ref)} dias antes de ${dataBR(ref)}): atualize pela PTAX se ainda houver estimativa.`});
  }
  passos.push({numero: 5, chave: 'parametros', titulo: 'Parâmetros usados', estado: atencao5.length ? 'atencao' : 'pronto',
    resumo: atencao5.length ? `${atencao5.length} ${atencao5.length === 1 ? 'ponto' : 'pontos'} a olhar nos parâmetros.` : `${usados.length} ${usados.length === 1 ? 'parâmetro usado' : 'parâmetros usados'}, todos confirmados.`, itens: atencao5, usados});
  // 06 Fechar e exportar (só a responsável, só mês terminado)
  const f = fechamentoDe(aplicado, mes);
  const mesHoje = diaValido(hoje) ? hoje.slice(0, 7) : null;
  const terminou = !!mesHoje && mes < mesHoje;
  passos.push({numero: 6, chave: 'fechar', titulo: 'Fechar e exportar', estado: f ? 'pronto' : 'falta',
    resumo: f ? `${Mes(mes)} fechado por ${nome(f.por)} em ${dataBR(String(f.em || '').slice(0, 10))} · ${seloCurto(f.selo)}` : terminou ? 'Fechar é assinar o livro do mês: os números não mudam mais, nem se o dólar mudar.' : 'Só dá para fechar um mês que já terminou.',
    itens: []});
  return {mes, passos, prontos: passos.filter(p => p.estado === 'pronto').length, total: passos.length, terminou, fechado: !!f, podeFechar: terminou && !f,
    fechamento: f ? {selo: f.selo, seloCurto: seloCurto(f.selo), por: f.por, porNome: nome(f.por), em: f.em, cabeca: f.cabeca, totais: f.totais} : null};
}

// ── conciliação da fatura ────────────────────────────────────────────────────────────────────────────────────────
// Rateia o total da fatura entre os itens pelo maior resto (desempate pelo índice): a soma fecha ao centavo. O peso é
// item.peso, se houver (por exemplo, a estimativa em reais), ou o valor na moeda original (então todos na mesma moeda).
export function ratearFatura(totalMinor, itens) {
  if (!ehInteiro(totalMinor) || totalMinor < 0 || !Array.isArray(itens) || !itens.length || itens.some(it => !it || typeof it !== 'object')) return null;
  const temPeso = itens.every(it => it.peso !== undefined && it.peso !== null);
  if (!temPeso && new Set(itens.map(it => it.moeda || '')).size > 1) return null;   // moedas diferentes não se comparam sem câmbio
  const pesos = itens.map(it => (temPeso ? it.peso : it.valorMinor));
  if (pesos.some(p => !ehInteiro(p) || p < 0)) return null;
  const S = pesos.reduce((a, p) => a + BigInt(p), 0n);
  if (S === 0n) return null;
  const T = BigInt(totalMinor);
  const exato = pesos.map(p => T * BigInt(p)), inteiros = exato.map(x => x / S);
  let resto = T - inteiros.reduce((a, b) => a + b, 0n);
  exato.map((x, k) => ({k, r: x % S})).sort((a, b) => (a.r === b.r ? a.k - b.k : a.r > b.r ? -1 : 1)).forEach(({k}) => { if (resto > 0n) { inteiros[k]++; resto--; } });
  return itens.map((it, k) => ({...it, faturaBrlMinor: num(inteiros[k])}));
}
// Spread que o emissor cobrou de fato: fatura = valor × PTAX × (1 + spread) × (1 + IOF). Devolve o percentual em texto
// de 2 casas, com ponto ("4.21"), pronto para um set_parameter de cartao.spread_pct; null se faltar dado.
export function spreadImplicito(faturaBrl, valorMinor, ptax, iofPct = '0') {
  const c = R.decimal(ptax, 6), i = R.decimal(iofPct, 6);
  if (!ehInteiro(faturaBrl) || faturaBrl <= 0 || !ehInteiro(valorMinor) || valorMinor <= 0 || !c || c.n === 0n || !i) return null;
  // em pontos-base: fatura × cd × 100·id × 10000 ÷ (valor × cn × (100·id + in)) − 10000, arredondado uma vez
  const bp = arred(BigInt(faturaBrl) * c.d * 100n * i.d * 10000n, BigInt(valorMinor) * c.n * (100n * i.d + i.n)) - 10000n;
  const a = bp < 0n ? -bp : bp;
  return `${bp < 0n ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
}
// PTAX do Banco Central (API Olinda, CotacaoMoedaPeriodo ou CotacaoDolarPeriodo): o boletim de FECHAMENTO do último dia
// útil até a data (a API só traz dias úteis, então o mais recente ≤ data já é o último dia útil). Aceita o JSON já lido
// ou o texto. O número da API vira texto decimal exato na hora (nenhuma conta com ele em ponto flutuante).
export function cotacaoDoBoletim(jsonOlinda, data) {
  let obj = jsonOlinda;
  if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch { return null; } }
  const boletins = obj && Array.isArray(obj.value) ? obj.value : Array.isArray(obj) ? obj : [];
  let melhor = null;
  for (const b of boletins) {
    if (!b || typeof b !== 'object') continue;
    if (b.tipoBoletim !== undefined && b.tipoBoletim !== null && !/fechamento/i.test(String(b.tipoBoletim))) continue;
    const dataHora = String(b.dataHoraCotacao || '');
    const dia = dataHora.slice(0, 10);
    if (!diaValido(dia) || (diaValido(data) && dia > data)) continue;
    const venda = decimalDaApi(b.cotacaoVenda), compra = decimalDaApi(b.cotacaoCompra);
    if (!venda) continue;
    if (!melhor || dia > melhor.data || (dia === melhor.data && dataHora > melhor.dataHora)) melhor = {valor: venda, compra, data: dia, dataHora, tipoBoletim: b.tipoBoletim ?? 'Fechamento', fonte: `PTAX venda BCB, ${dataBR(dia)}/${dia.slice(0, 4)}`};
  }
  return melhor;
}
function decimalDaApi(v, casas = 4) { // 5.0826 → "5.0826" (o número curto do JSON é exatamente o texto da API)
  const s = typeof v === 'number' && Number.isFinite(v) && v > 0 ? String(v) : typeof v === 'string' ? v.trim() : '';
  const m = /^(\d{1,6})(?:\.(\d{1,12}))?$/.exec(s);
  if (!m) return null;
  let frac = m[2] || '';
  if (frac.length > casas) { // arredonda uma vez, meio para longe do zero
    const big = arred(BigInt(m[1] + frac), 10n ** BigInt(frac.length - casas));
    const t = big.toString().padStart(casas + 1, '0');
    return `${t.slice(0, -casas)}.${t.slice(-casas)}`;
  }
  frac = frac.padEnd(casas, '0');
  return `${m[1]}.${frac}`;
}

// ── Meu painel: a manchete do mês e as mudanças recentes das outras sócias ──────────────────────────────────────────
// Frase de modelo fixo (sem IA): "Outubro: saiu R$ 1.166,41; R$ 1.388,47 comprometidos por mês; o caixa dá ≈ 9,2 meses;
// nada atrasado." Cada trecho tem um alvo, para a página fazer dele um link.
export function manchetePainel(estadoBase, aplicado, hoje, membroId) {
  const mes = hoje.slice(0, 7);
  const lista = R.parametros(aplicado);
  const l = R.livroDoMes(estadoBase, aplicado, mes, hoje);
  const f = folego(estadoBase, aplicado, hoje);
  const atrasadas = assinaturasAtrasadas(estadoBase, aplicado, hoje);
  const minha = l.porSocia.find(s => s.id === membroId) || null;
  const acerto = acertoAcumulado(estadoBase, aplicado, lista, hoje);
  const meu = acerto.porSocia.find(s => s.id === membroId) || null;
  const trechos = [
    {alvo: 'saiu', texto: `${Mes(mes)}: saiu ${fmt(l.realizado)}`},
    {alvo: 'comprometido', texto: `${fmt(l.total)} comprometidos por mês`},
    {alvo: 'folego', texto: f.estado === 'ok' ? `o caixa dá ${f.texto}` : f.estado === 'sem_mes_fechado' ? 'o fôlego precisa de 1 mês fechado' : f.estado === 'sem_queima' ? 'sem queima de caixa' : 'falta informar o saldo do banco'},
    {alvo: 'atrasadas', texto: atrasadas.length ? `${atrasadas.length} ${atrasadas.length === 1 ? 'cobrança atrasada' : 'cobranças atrasadas'}` : 'nada atrasado'},
  ];
  return {mes, frase: trechos.map(t => t.texto).join('; ') + '.', trechos,
    numeros: [
      {chave: 'saiu', rotulo: 'Saiu este mês', valor: l.realizado, explica: l.explica.realizado},
      {chave: 'comprometido', rotulo: 'Comprometido por mês', valor: l.total, estimado: l.previsto > 0, explica: l.explica.total},
      {chave: 'caixa', rotulo: 'Caixa', valor: f.caixaInformado.temSaldo ? f.caixa : null, data: f.dataDoCaixa, explica: f.caixaInformado.explica},
      {chave: 'folego', rotulo: 'Fôlego', valor: f.decimos, unidade: 'décimos de mês', estado: f.estado, texto: f.texto, rotuloBase: f.rotuloBase, explica: f.explica},
    ],
    minhaParte: minha && minha.parte !== null ? minha.parte : null, saldoAcerto: meu ? meu.saldo : null, aReceberDaEmpresa: meu ? meu.devido : null,
    atrasadas, folego: f};
}
// assinatura ativa e confirmada, com vencimento antes de hoje, sem pagamento no ciclo (pelo estado efetivo do pacote +
// diário, o mesmo que as páginas antigas mostram)
function assinaturasAtrasadas(estadoBase, aplicado, hoje) {
  const efetivo = R.estadoEfetivo(estadoBase, aplicado, hoje);
  const saida = [];
  for (const p of efetivo.plans || []) {
    if (p.subscriptionState !== 'active' || p.confirmed !== true || ['pago', 'isento'].includes(p.paymentStatus)) continue;
    const venc = diaValido(p.nextDate) ? p.nextDate : Number.isInteger(p.monthlyDay) ? `${hoje.slice(0, 7)}-${String(Math.min(p.monthlyDay, +ultimoDiaDo(hoje.slice(0, 7)).slice(8))).padStart(2, '0')}` : null;
    if (venc && venc < hoje && venc.slice(0, 7) === hoje.slice(0, 7)) saida.push({id: p.id, servico: p.servico, vencimento: venc});
  }
  return saida;
}
// as n mudanças mais recentes feitas pelas OUTRAS sócias (a mais nova primeiro)
export function mudancasRecentes(aplicado, membroId, n = 3) {
  return (aplicado.historico || []).filter(h => h.autora !== membroId).slice(-n).reverse()
    .map(h => ({seq: h.seq, id: h.id, autora: h.autora, nome: nomeDe(aplicado, h.autora), acao: h.acao, verbo: h.verbo || R.VERBOS[h.acao] || h.acao, resumo: h.resumo, quando: h.quando, alvo: h.alvo}));
}
