// node --test testes/ — as contas da rotina (contas.js) centavo a centavo com o plano (docs/PLANO-PORTAL.md §4.6):
// receitas, taxa e imposto do outubro do plano, resultado e partes, acerto acumulado, a receber da empresa, fôlego,
// fluxo de 12 meses, o selo do mês fechado (e o que NÃO muda o selo), o roteiro do fechamento, a conciliação da fatura,
// a demonstração do arnês e o relógio do servidor do arnês. Dados fictícios (as três sócias do arnês).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../razao.js';
import * as C from '../contas.js';
import {demonstracao, QUEIMA_DE_SETEMBRO} from '../ferramentas/arnes/demonstracao.js';
import {estadoFicticio} from '../ferramentas/arnes/estado-ficticio.js';

const base = {
  schemaVersion: 1, revision: 1, charges: null, benefits: [], selling: {steps: []}, staticBlocks: {},
  members: [{id: 'bauer', displayName: 'Bauer', role: 'owner', participationPct: 40}, {id: 'ana', displayName: 'Ana', role: 'member', participationPct: 30}, {id: 'bia', displayName: 'Beatriz', role: 'member', participationPct: 30}],
  plans: [
    {id: 'p-vercel', servico: 'Vercel', plano: 'Pro', amountMinor: 2000, currency: 'USD', period: 'mensal', confirmed: true, subscriptionState: 'active'},
    {id: 'p-figma', servico: 'Figma', plano: 'Pro', amountMinor: 1500, currency: 'USD', period: 'mensal', confirmed: true, subscriptionState: 'active'},
    {id: 'p-google', servico: 'Google Workspace', plano: 'Business', amountMinor: 14000, currency: 'BRL', period: 'mensal', confirmed: true, subscriptionState: 'active'},
    {id: 'p-apple', servico: 'Apple Developer', plano: 'anual', amountMinor: 9900, currency: 'USD', period: 'anual', confirmed: true, subscriptionState: 'inactive'},
  ],
};
const semPlanos = {...base, plans: []};
const OUT = '2026-10-19T12:00:00Z', NOV = '2026-11-03T13:00:00Z';
let n = 0;
const ev = (membro, acao, alvo, dados, extra = {}) => ({seq: ++n, id: 'e' + n, membro, conteudo: {acao, alvo, dados, quando: OUT, ...extra}});
const gasto = d => ({data: '2026-10-14', competencia: '2026-10', categoria: 'software_ia', moeda: 'BRL', forma: 'cartao_pj', pagoPor: 'bauer', ...d});
const receita = d => ({competencia: '2026-10', canal: 'hotmart', produto: 'Med Painel', brutoMinor: 239600, moeda: 'BRL', transacoes: 40, taxasMinor: null, canceladosMinor: null, ...d});
// o outubro do plano (§4.6): Anthropic, Vercel ligado ao plano, contador dividido, domínio a reembolsar, Figma anulado e a receita
function outubro() {
  n = 0;
  return [
    ev('ana', 'add_expense', 'g1', gasto({descricao: 'Anthropic API — créditos', valorMinor: 10000, moeda: 'USD'})),
    ev('bauer', 'add_expense', 'g2', gasto({descricao: 'Vercel Pro', valorMinor: 2000, moeda: 'USD', data: '2026-10-05', categoria: 'infraestrutura', planoId: 'p-vercel'})),
    ev('bauer', 'add_expense', 'g3', gasto({descricao: 'Contador', valorMinor: 45000, categoria: 'contabilidade_juridico', forma: 'pix_pessoal', destino: 'dividir', data: '2026-10-10'})),
    ev('ana', 'add_expense', 'g4', gasto({descricao: 'Domínio', valorMinor: 5990, categoria: 'infraestrutura', forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa', data: '2026-10-12'})),
    ev('ana', 'add_expense', 'g5', gasto({descricao: 'Figma duplicado', valorMinor: 1500, moeda: 'USD'})),
    ev('ana', 'void_expense', 'g5', null, {versao: 1, motivo: 'lançado em duplicidade'}),
    ev('bauer', 'add_income', 'rc-out', receita({})),
  ];
}
function aceitos(estado, eventos) { const a = R.aplicar(estado, eventos); assert.deepEqual(a.recusados, [], JSON.stringify(a.recusados)); return a; }
// gerador determinístico (mulberry32)
function sorteio(semente) { let a = semente >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inteiro = (rnd, max) => Math.floor(rnd() * max);

test('outubro do plano: receita, taxa, Simples, líquido, custo, resultado e partes centavo a centavo', () => {
  const a = aceitos(base, outubro());
  const lista = R.parametros(a);
  const rec = C.receitasDoMes(a, lista, '2026-10');
  assert.equal(rec.bruto, 239600);
  assert.equal(rec.taxas, 33680);
  assert.equal(rec.imposto, 14376);
  assert.equal(rec.liquido, 191544);
  assert.equal(rec.linhas[0].explica.taxas.formula, 'Taxa Hotmart = 9,9% × R$ 2.396,00 + 40 × R$ 2,49 = R$ 336,80');
  assert.equal(rec.linhas[0].explica.imposto.formula, 'Simples = 6% × R$ 2.396,00 = R$ 143,76');
  assert.equal(rec.linhas[0].origemTaxas, 'parametros');
  const r = C.resultadoDoMes(base, a, lista, '2026-10', '2026-10-19');
  assert.equal(r.custo, 138847);
  assert.equal(r.realizado, 116641);
  assert.equal(r.previsto, 22206);
  assert.equal(r.resultado, 52697);
  assert.equal(r.explica.resultado.texto, 'R$ 1.915,44 − R$ 1.388,47 = R$ 526,97');
  assert.deepEqual(r.partes.map(p => p.valor), [21079, 15809, 15809]);
  assert.equal(r.partes.reduce((s, p) => s + p.valor, 0), r.resultado);
  assert.equal(r.provisorio, true);
  // a cascata fecha como o graficos.cascata confere: cada total é a soma dos passos anteriores e as partes zeram
  const cas = C.cascataDoMes(base, a, lista, '2026-10', '2026-10-19', 'bauer');
  let nivel = null;
  for (const p of cas.passos) {
    assert.ok(Number.isSafeInteger(p.valor));
    if (p.tipo === 'total') { if (nivel !== null) assert.equal(p.valor, nivel, p.rotulo); nivel = p.valor; } else if (p.tipo === 'delta') nivel += p.valor; else nivel -= p.valor;
  }
  assert.equal(nivel, 0);
  assert.deepEqual(cas.passos.map(p => p.rotulo), ['Receita bruta', 'Taxas das plataformas', 'Imposto (Simples)', 'Custos lançados', 'Previsto (assinaturas sem lançamento)', 'Resultado de outubro', 'Bauer · sua parte', 'Ana', 'Beatriz']);
  assert.equal(cas.passos[1].nota, '9,9% × R$ 2.396,00 + 40 × R$ 2,49');
  assert.equal(cas.rotulo, 'Para onde vão os R$ 2.396,00 de outubro');
});

test('receitas: taxa do extrato vale; receita em dólar pela PTAX do último dia, sem spread nem IOF; canal sem tabela', () => {
  n = 0;
  const a = aceitos(base, [
    ev('bauer', 'add_income', 'rc-1', receita({taxasMinor: 34000})),
    ev('bauer', 'add_income', 'rc-2', receita({canal: 'stripe', moeda: 'USD', brutoMinor: 10000, transacoes: 5})),
    ev('bauer', 'add_income', 'rc-3', receita({canal: 'outro', brutoMinor: 5000, transacoes: 1})),
    ev('bauer', 'add_income', 'rc-4', receita({brutoMinor: 999999, transacoes: 1})),
    ev('bauer', 'void_income', 'rc-4', null, {versao: 1, motivo: 'repetida'}),
  ]);
  const rec = C.receitasDoMes(a, R.parametros(a), '2026-10');
  assert.equal(rec.linhas.length, 3, 'anulada fica fora');
  const [hot, usd, outro] = rec.linhas;
  assert.equal(hot.taxas, 34000);
  assert.equal(hot.origemTaxas, 'extrato');
  assert.equal(usd.brl, 50826, 'US$ 100,00 × 5,0826, só o principal');
  assert.equal(usd.conversao, 'ptax');
  assert.match(usd.explica.bruto.formula, /PTAX de 16\/10, sem spread nem IOF: US\$ 100,00 × 5,0826 = R\$ 508,26/);
  assert.equal(usd.taxas, 2028 + 5 * 39, '3,99% × R$ 508,26 = 20,2796 → R$ 20,28; + 5 × R$ 0,39');
  assert.equal(outro.taxas, 0);
  assert.equal(outro.origemTaxas, 'sem_parametro');
  assert.equal(rec.bruto, 239600 + 50826 + 5000);
  assert.equal(rec.liquido, rec.bruto - rec.taxas - rec.imposto);
});

test('acerto acumulado (F11): Bauer +270 / Ana −135 / Beatriz −135 e, depois do Pix da Ana, +135 / 0 / −135', () => {
  const eventos = outubro();
  let a = aceitos(base, eventos);
  let ac = C.acertoAcumulado(base, a, R.parametros(a), '2026-10-31');
  assert.deepEqual(ac.saldos, {bauer: 27000, ana: -13500, bia: -13500});
  assert.deepEqual(ac.transferencias.map(t => [t.de, t.para, t.brl]), [['ana', 'bauer', 13500], ['bia', 'bauer', 13500]]);
  assert.equal(ac.transferencias[0].texto, 'Ana → Bauer · R$ 135,00');
  assert.equal(ac.porSocia[0].explica.saldo.formula, 'Saldo no acerto = o que você pagou nos gastos divididos − a sua parte neles ± os Pix entre vocês');
  // F12: a empresa deve o domínio à Ana
  assert.deepEqual(ac.devido, {bauer: 0, ana: 5990, bia: 0});
  assert.deepEqual(ac.reembolsosPendentes.map(g => [g.id, g.brl]), [['g4', 5990]]);
  // o Pix da Ana (ainda sem a confirmação do Bauer) já conta no saldo e aparece como "aguardando confirmação"
  eventos.push(ev('ana', 'record_settlement', 'ac-1', {tipo: 'acerto_entre_socias', de: 'ana', para: 'bauer', valorMinor: 13500, data: '2026-10-20', forma: 'pix', gastoIds: []}));
  a = aceitos(base, eventos);
  ac = C.acertoAcumulado(base, a, R.parametros(a), '2026-10-31');
  assert.deepEqual(ac.saldos, {bauer: 13500, ana: 0, bia: -13500});
  assert.deepEqual(ac.transferencias.map(t => [t.de, t.para, t.brl]), [['bia', 'bauer', 13500]]);
  assert.deepEqual(ac.aguardandoConfirmacao.map(x => [x.id, x.quemConfirma]), [['ac-1', 'Bauer']]);
  // até antes do Pix, o Pix não conta
  assert.deepEqual(C.acertoAcumulado(base, a, R.parametros(a), '2026-10-19').saldos, {bauer: 27000, ana: -13500, bia: -13500});
  // a responsável reembolsa o domínio: some do "a receber"; o gasto continua no livro do mês
  eventos.push(ev('bauer', 'confirm_settlement', 'ac-1', {}));
  eventos.push(ev('bauer', 'record_settlement', 'ac-2', {tipo: 'reembolso_empresa', de: 'empresa', para: 'ana', valorMinor: 5990, data: '2026-10-21', forma: 'pix', gastoIds: ['g4']}));
  a = aceitos(base, eventos);
  ac = C.acertoAcumulado(base, a, R.parametros(a), '2026-10-31');
  assert.deepEqual(ac.devido, {bauer: 0, ana: 0, bia: 0});
  assert.deepEqual(ac.reembolsosPendentes, []);
  assert.equal(ac.porSocia[1].reembolsosRecebidos, 5990);
});

test('aportes: gasto como aporte, reembolso convertido e aporte em dinheiro; mark_reimbursed conta como reembolso', () => {
  n = 0;
  const a = aceitos(base, [
    ev('bia', 'add_expense', 'g1', gasto({descricao: 'Anúncios', valorMinor: 30000, forma: 'cartao_pessoal', pagoPor: 'bia', destino: 'aporte', categoria: 'marketing'})),
    ev('ana', 'add_expense', 'g2', gasto({descricao: 'Canva', valorMinor: 3490, forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa'})),
    ev('ana', 'convert_to_contribution', 'g2', null, {versao: 1}),
    ev('bia', 'record_settlement', 'ac-1', {tipo: 'aporte', de: 'bia', para: 'empresa', valorMinor: 100000, data: '2026-10-15', forma: 'transferencia', gastoIds: []}),
    ev('bauer', 'add_expense', 'g3', gasto({descricao: 'Cartório', valorMinor: 12000, forma: 'pix_pessoal', destino: 'empresa_reembolsa'})),
    ev('ana', 'mark_reimbursed', 'g3', null, {versao: 1}),
  ]);
  const ac = C.acertoAcumulado(base, a, R.parametros(a), null);
  assert.deepEqual(ac.aportes, {bauer: 0, ana: 3490, bia: 130000});
  assert.deepEqual(ac.devido, {bauer: 0, ana: 0, bia: 0}, 'convertido e marcado como reembolsado saem do "a receber"');
  assert.deepEqual(ac.saldos, {bauer: 0, ana: 0, bia: 0});
});

test('saldos do acerto sempre somam zero e as transferências zeram (2.000 casos)', () => {
  const rnd = sorteio(4242);
  const divisoes = [[40, 30, 30], [33.33, 33.33, 33.34], [50, 50], [25, 25, 25, 25], [70, 20, 10], [100]];
  const lista = R.parametros({parametros: []});
  for (let caso = 0; caso < 2000; caso++) {
    const pcts = divisoes[caso % divisoes.length];
    const membros = pcts.map((pct, k) => ({id: 'm' + k, nome: 'Sócia ' + k, papel: k ? 'member' : 'owner', pct}));
    const gastos = [], acertos = [];
    for (let k = 0, q = 1 + inteiro(rnd, 6); k < q; k++) gastos.push({id: `g${k}`, estado: rnd() < 0.1 ? 'anulado' : 'lancado', data: '2026-10-1' + inteiro(rnd, 10), competencia: '2026-10',
      moeda: 'BRL', valorMinor: 1 + inteiro(rnd, 500000), forma: 'pix_pessoal', destino: 'dividir', pagoPor: membros[inteiro(rnd, membros.length)].id});
    for (let k = 0, q = inteiro(rnd, 4); k < q && membros.length > 1; k++) {
      const de = inteiro(rnd, membros.length), para = (de + 1 + inteiro(rnd, membros.length - 1)) % membros.length;
      acertos.push({id: `ac${k}`, tipo: 'acerto_entre_socias', de: membros[de].id, para: membros[para].id, valorMinor: 1 + inteiro(rnd, 200000), data: '2026-10-20', confirmadoPor: null});
    }
    const ac = C.acertoAcumulado({}, {membros, gastos, acertos, fechamentos: {}}, lista, null);
    assert.equal(Object.values(ac.saldos).reduce((s, v) => s + v, 0), 0, `caso ${caso}`);
    assert.ok(ac.transferencias.length <= membros.length - 1, `caso ${caso}: no máximo n−1 transferências`);
    const resto = {...ac.saldos};
    for (const t of ac.transferencias) { assert.ok(t.brl > 0); resto[t.de] += t.brl; resto[t.para] -= t.brl; }
    assert.ok(Object.values(resto).every(v => v === 0), `caso ${caso}: as transferências zeram`);
  }
});

// setembro fechado com a queima de R$ 2.366,00 e o saldo de R$ 21.765,00 em 18/10 (o exemplo do F13). O gasto de
// setembro completa o previsto das assinaturas do estado até a queima dar R$ 2.366,00.
function setembroFechado(estado = semPlanos) {
  n = 0;
  const previsto = C.fotoDoMes(estado, R.aplicar(estado, []), '2026-09', 0).totais.previsto;
  const eventos = [ev('bauer', 'add_expense', 's1', gasto({data: '2026-09-10', competencia: '2026-09', descricao: 'Contador e registro da marca', categoria: 'contabilidade_juridico', valorMinor: 236600 - previsto, forma: 'conta_pj'}), {quando: '2026-09-10T12:00:00Z'})];
  const fechar = (estado, eventosAteAqui, mes, quando) => {
    const cabeca = eventosAteAqui[eventosAteAqui.length - 1].seq;
    const foto = C.fotoDoMes(estado, R.aplicar(estado, eventosAteAqui), mes, cabeca);
    return ev('bauer', 'close_month', mes, {cabeca, selo: C.seloDoMes(foto), totais: {realizado: foto.totais.realizado, previsto: foto.totais.previsto, total: foto.totais.total, resultado: foto.totais.resultado}}, {quando});
  };
  eventos.push(fechar(estado, eventos, '2026-09', '2026-10-03T13:00:00Z'));
  eventos.push(ev('ana', 'set_balance', 'sd-1', {conta: 'Conta PJ principal', data: '2026-10-18', valorMinor: 2176500, moeda: 'BRL', fonte: 'extrato'}, {quando: '2026-10-18T21:00:00Z'}));
  return {eventos, fechar};
}

test('fôlego (F13): R$ 21.765,00 ÷ R$ 2.366,00 = 92 décimos; sem mês fechado, sem queima e sem saldo', () => {
  const {eventos, fechar} = setembroFechado();
  const a = aceitos(semPlanos, eventos);
  const f = C.folego(semPlanos, a, '2026-10-19');
  assert.equal(f.estado, 'ok');
  assert.equal(f.caixa, 2176500);
  assert.equal(f.queimaMedia, 236600);
  assert.equal(f.decimos, 92);
  assert.equal(f.texto, '≈ 9,2 meses');
  assert.equal(f.rotuloBase, 'média de 1 mês fechado');
  assert.equal(f.explica.formula, 'Fôlego = caixa ÷ queima média de 1 mês fechado');
  assert.equal(f.explica.texto, 'R$ 21.765,00 ÷ R$ 2.366,00 por mês = 9,2 meses (média de 1 mês fechado)');
  assert.equal(f.frase, 'Caixa de R$ 21.765,00 em 18/10: dá ≈ 9,2 meses na queima média de 1 mês fechado.');
  // sem mês fechado
  const aberto = aceitos(semPlanos, eventos.filter(e => e.conteudo.acao !== 'close_month'));
  const s = C.folego(semPlanos, aberto, '2026-10-19');
  assert.equal(s.estado, 'sem_mes_fechado');
  assert.equal(s.decimos, null);
  assert.equal(s.texto, 'precisa de 1 mês fechado');
  assert.equal(s.frase, 'Caixa de R$ 21.765,00 em 18/10: o fôlego precisa de 1 mês fechado.');
  // sem saldo informado
  assert.equal(C.folego(semPlanos, aceitos(semPlanos, eventos.slice(0, 2)), '2026-10-19').estado, 'sem_saldo');
  // sem queima: entrou mais do que saiu no mês fechado
  n = 10;
  const comVenda = [eventos[0], ev('bauer', 'add_income', 'rc-9', receita({competencia: '2026-09', brutoMinor: 900000, transacoes: 150}), {quando: '2026-09-30T12:00:00Z'})];
  comVenda.push(fechar(semPlanos, comVenda, '2026-09', '2026-10-03T13:00:00Z'));
  assert.equal(C.folego(semPlanos, aceitos(semPlanos, comVenda), '2026-10-19').estado, 'sem_queima');
});

test('fôlego: média dos 3 últimos meses fechados, com um arredondamento só', () => {
  n = 0;
  const eventos = [];
  const valores = {'2026-06': 500000, '2026-07': 100000, '2026-08': 200000, '2026-09': 100001};
  for (const [mes, v] of Object.entries(valores)) {
    eventos.push(ev('bauer', 'add_expense', 'x' + mes, gasto({data: mes + '-10', competencia: mes, descricao: 'Custo', valorMinor: v}), {quando: mes + '-10T12:00:00Z'}));
    const cabeca = eventos[eventos.length - 1].seq;
    const foto = C.fotoDoMes(semPlanos, R.aplicar(semPlanos, eventos), mes, cabeca);
    eventos.push(ev('bauer', 'close_month', mes, {cabeca, selo: C.seloDoMes(foto), totais: {realizado: v, previsto: 0, total: v, resultado: -v}}, {quando: C.somarMeses(mes, 1) + '-02T12:00:00Z'}));
  }
  eventos.push(ev('ana', 'set_balance', 'sd-1', {conta: 'Conta PJ', data: '2026-10-18', valorMinor: 1000000, moeda: 'BRL', fonte: 'extrato'}));
  const f = C.folego(semPlanos, aceitos(semPlanos, eventos), '2026-10-19');
  assert.deepEqual(f.meses.map(m => m.mes), ['2026-07', '2026-08', '2026-09']);
  assert.equal(f.base, 3);
  assert.equal(f.queimaMedia, 133334, '(100000 + 200000 + 100001) ÷ 3 = 133333,67');
  assert.equal(f.decimos, 75, '10.000,00 × 10 × 3 ÷ 4.000,01 = 74,9998 → 75 (direto, sem arredondar a média antes)');
  assert.equal(f.rotuloBase, 'média de 3 meses fechados');
});

test('caixa informado: último saldo de cada conta; dólar pela PTAX do dia do saldo, sem spread', () => {
  n = 0;
  const a = aceitos(base, [
    ev('ana', 'set_balance', 'sd-1', {conta: 'Conta PJ', data: '2026-10-10', valorMinor: 1000000, moeda: 'BRL', fonte: 'extrato'}),
    ev('ana', 'set_balance', 'sd-2', {conta: 'Conta PJ', data: '2026-10-18', valorMinor: 2176500, moeda: 'BRL', fonte: 'extrato'}),
    ev('bauer', 'set_balance', 'sd-3', {conta: 'Conta global', data: '2026-10-17', valorMinor: 61240, moeda: 'USD', fonte: 'app do banco'}),
    ev('bia', 'set_balance', 'sd-4', {conta: 'Conta PJ', data: '2026-10-15', valorMinor: 5, moeda: 'BRL', fonte: 'extrato'}),
  ]);
  const cx = C.caixaInformado(a, R.parametros(a), '2026-10-19');
  assert.deepEqual(cx.contas.map(c => [c.conta, c.valorMinor, c.brl, c.idadeDias]), [['Conta PJ', 2176500, 2176500, 1], ['Conta global', 61240, 311258, 2]]);
  assert.equal(cx.total, 2176500 + 311258);
  assert.equal(cx.contas[1].conversao, 'ptax');
  assert.match(cx.contas[1].explica.formula, /^Saldo em dólar convertido pela PTAX do dia, sem spread: US\$ 612,40 × 5,0826 = R\$ 3\.112,58$/);
  assert.equal(C.caixaInformado(a, R.parametros(a), '2026-10-12').total, 1000000, 'na data pedida, vale o último saldo até ela');
});

test('todo valor em reais traz a conta ou o tipo de conversão (§8.2)', () => {
  const eventos = [...outubro(),
    ev('bauer', 'add_income', 'rc-usd', receita({canal: 'stripe', moeda: 'USD', brutoMinor: 10000, transacoes: 5})),
    ev('bauer', 'set_balance', 'sd-usd', {conta: 'Conta global', data: '2026-10-17', valorMinor: 61240, moeda: 'USD', fonte: 'app do banco'}),
    ev('ana', 'set_balance', 'sd-brl', {conta: 'Conta PJ', data: '2026-10-18', valorMinor: 2176500, moeda: 'BRL', fonte: 'extrato'})];
  const a = aceitos(base, eventos);
  const lista = R.parametros(a);
  const saidas = {
    receitas: C.receitasDoMes(a, lista, '2026-10'), resultado: C.resultadoDoMes(base, a, lista, '2026-10', '2026-10-19'), caixa: C.caixaInformado(a, lista, '2026-10-19'),
    acerto: C.acertoAcumulado(base, a, lista, '2026-10-31'), serie: C.serie12m(base, a, '2026-10', '2026-10-19'), folego: C.folego(base, a, '2026-10-19'),
    roteiro: C.roteiroDoFechamento(base, a, lista, '2026-10', '2026-11-03'), manchete: C.manchetePainel(base, a, '2026-10-19', 'bauer'), cascata: C.cascataDoMes(base, a, lista, '2026-10', '2026-10-19'),
  };
  let conferidos = 0;
  const andar = (x, caminho, emConta) => {
    if (Array.isArray(x)) return x.forEach((v, k) => andar(v, `${caminho}[${k}]`, emConta));
    if (!x || typeof x !== 'object') return;
    if (!emConta && typeof x.brl === 'number') { assert.equal(typeof x.conversao, 'string', `${caminho} tem reais sem o tipo de conversão`); conferidos++; }
    for (const [k, v] of Object.entries(x)) andar(v, `${caminho}.${k}`, emConta || ['explica', 'termos', 'conta', 'gasto', 'livro'].includes(k));
  };
  andar(saidas, 'saidas', false);
  assert.ok(conferidos > 10, `conferiu ${conferidos} valores`);
  // cada total em reais tem a conta, feita pela mesma função (o resultado da conta é o próprio número)
  const rec = saidas.receitas;
  for (const k of ['bruto', 'taxas', 'imposto', 'liquido']) assert.equal(rec.explica[k].resultado, rec[k], k);
  for (const l of rec.linhas) for (const k of ['bruto', 'taxas', 'imposto', 'liquido']) assert.ok(l.explica[k].formula, `${l.id}.${k}`);
  assert.equal(saidas.resultado.explica.resultado.resultado, saidas.resultado.resultado);
  assert.equal(saidas.caixa.explica.resultado, saidas.caixa.total);
  for (const s of saidas.acerto.porSocia) { assert.equal(s.explica.saldo.resultado, s.saldo); assert.equal(s.explica.devido.resultado, s.devido); assert.equal(s.explica.aportes.resultado, s.aportes); }
  for (const p of saidas.serie) { assert.ok(p.explica.saiu.formula); if (!p.futuro) assert.equal(p.explica.saiu.resultado, p.saiu); }
  for (const p of saidas.cascata.passos) assert.ok(p.explica && p.explica.formula, p.rotulo);
  for (const x of saidas.manchete.numeros) assert.ok(x.explica && x.explica.formula, x.chave);
  assert.ok(saidas.folego.explica.formula.startsWith('Fôlego = caixa ÷ queima média de'));
});

test('composição: os pct_permil somam 1000 (F15) e a soma por categoria fecha com o total', () => {
  const rnd = sorteio(1015);
  const cats = R.CATEGORIAS.map(c => c.id);
  const membros = [{id: 'bauer', nome: 'Bauer', papel: 'owner', pct: 40}, {id: 'ana', nome: 'Ana', papel: 'member', pct: 30}, {id: 'bia', nome: 'Beatriz', papel: 'member', pct: 30}];
  for (let caso = 0; caso < 300; caso++) {
    const gastos = [];
    for (let k = 0, q = 1 + inteiro(rnd, 12); k < q; k++) gastos.push({id: 'g' + k, estado: 'lancado', data: '2026-10-10', competencia: '2026-10', descricao: 'x', moeda: 'BRL', valorMinor: 1 + inteiro(rnd, 10 ** (1 + inteiro(rnd, 6))), categoria: cats[inteiro(rnd, cats.length)], forma: 'cartao_pj', pagoPor: 'bauer', destino: 'nao_aplica'});
    const l = R.livroDoMes(semPlanos, {membros, gastos, parametros: [], planos: [], fechamentos: {}, saldos: [], receitas: [], acertos: []}, '2026-10', '2026-10-19');
    assert.equal(l.porCategoria.reduce((s, c) => s + c.permil, 0), 1000, `caso ${caso}`);
    assert.equal(l.porCategoria.reduce((s, c) => s + c.brl, 0), l.total);
  }
});

test('selo de outubro: igual com as chaves embaralhadas, diferente se 1 centavo muda; determinístico', () => {
  const eventos = outubro();
  const a = aceitos(base, eventos);
  const foto = C.fotoDoMes(base, a, '2026-10', 7);
  assert.deepEqual(foto.totais, {realizado: 116641, previsto: 22206, total: 138847, por_moeda: {USD: 12000, BRL: 50990}, por_categoria: {software_ia: 76915, contabilidade_juridico: 45000, infraestrutura: 16932},
    receita_bruta: 239600, taxas: 33680, imposto: 14376, receita_liquida: 191544, resultado: 52697, variacao_cambial: 0});
  assert.deepEqual(foto.partes, {custo: {bauer: 55539, ana: 41654, bia: 41654}, resultado: {bauer: 21079, ana: 15809, bia: 15809}});
  assert.deepEqual(foto.pesos, {bauer: 4000000000, ana: 3000000000, bia: 3000000000});
  assert.ok(foto.gastos.some(g => g.id === 'g5' && g.estado === 'anulado' && g.brl === null), 'o anulado aparece, fora das contas');
  const selo = C.seloDoMes(foto);
  assert.match(selo, /^[0-9a-f]{64}$/);
  const embaralhar = x => Array.isArray(x) ? x.map(embaralhar) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, embaralhar(v)])) : x;
  assert.equal(C.seloDoMes(embaralhar(foto)), selo);
  assert.notEqual(C.seloDoMes({...foto, totais: {...foto.totais, taxas: foto.totais.taxas + 1}}), selo);
  // 1 centavo a mais num gasto muda o selo; o mesmo diário dá o mesmo selo em 3 execuções
  const editado = aceitos(base, [...eventos, ev('bauer', 'edit_expense', 'g3', {valorMinor: 45001}, {versao: 1})]);
  assert.notEqual(C.seloDoMes(C.fotoDoMes(base, editado, '2026-10', 7)), selo);
  const tres = [0, 1, 2].map(() => C.seloDoMes(C.fotoDoMes(base, R.aplicar(base, eventos), '2026-10', 7)));
  assert.deepEqual(tres, [selo, selo, selo]);
  assert.equal(JSON.stringify(C.serie12m(base, a, '2026-10', '2026-10-19')), JSON.stringify(C.serie12m(base, R.aplicar(base, eventos), '2026-10', '2026-10-19')));
  // a fatura muda o número (F4) e aparece a variação cambial
  const conciliado = aceitos(base, [...eventos, ev('ana', 'reconcile_statement', '2026-10:cartao_pj', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: null, itens: [{alvo: 'g1', versao: 1, faturaBrlMinor: 54980}]})]);
  const f2 = C.fotoDoMes(base, conciliado, '2026-10', 8);
  assert.equal(f2.totais.variacao_cambial, 271, 'R$ 549,80 − R$ 547,09 = +R$ 2,71');
  assert.notEqual(C.seloDoMes(f2), selo);
});

test('selo de setembro igual depois de um acerto, um reembolso, um saldo e um dólar novo registrados em novembro', () => {
  n = 0;
  const eventos = [
    ev('bauer', 'add_expense', 's1', gasto({data: '2026-09-10', competencia: '2026-09', descricao: 'Contador', valorMinor: 45000, forma: 'pix_pessoal', destino: 'dividir'}), {quando: '2026-09-10T12:00:00Z'}),
    ev('ana', 'add_expense', 's2', gasto({data: '2026-09-12', competencia: '2026-09', descricao: 'Domínio', valorMinor: 5990, forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa'}), {quando: '2026-09-12T12:00:00Z'}),
    ev('ana', 'add_expense', 's3', gasto({data: '2026-09-18', competencia: '2026-09', descricao: 'Anthropic API', valorMinor: 8000, moeda: 'USD', pagoPor: 'ana'}), {quando: '2026-09-18T12:00:00Z'}),
    ev('bauer', 'add_income', 'rc-set', receita({competencia: '2026-09', brutoMinor: 167720, transacoes: 28}), {quando: '2026-10-01T12:00:00Z'}),
  ];
  const cabeca = eventos[eventos.length - 1].seq;
  const foto = C.fotoDoMes(base, R.aplicar(base, eventos), '2026-09', cabeca);
  const selo = C.seloDoMes(foto);
  eventos.push(ev('bauer', 'close_month', '2026-09', {cabeca, selo, totais: {realizado: foto.totais.realizado, previsto: foto.totais.previsto, total: foto.totais.total, resultado: foto.totais.resultado}}, {quando: '2026-10-03T13:00:00Z'}));
  eventos.push(
    ev('ana', 'record_settlement', 'ac-1', {tipo: 'acerto_entre_socias', de: 'ana', para: 'bauer', valorMinor: 13500, data: '2026-11-02', forma: 'pix', gastoIds: []}, {quando: NOV}),
    ev('bauer', 'record_settlement', 'ac-2', {tipo: 'reembolso_empresa', de: 'empresa', para: 'ana', valorMinor: 5990, data: '2026-11-02', forma: 'pix', gastoIds: ['s2']}, {quando: NOV}),
    ev('bia', 'set_balance', 'sd-1', {conta: 'Conta PJ', data: '2026-11-02', valorMinor: 2100000, moeda: 'BRL', fonte: 'extrato'}, {quando: NOV}),
    ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '5.9000', desde: '2026-09-01', fonte: 'teste'}, {quando: NOV}),
    ev('bauer', 'confirm_settlement', 'ac-1', {}, {quando: NOV}),
  );
  const a = aceitos(base, eventos);
  assert.equal(a.gastos.find(g => g.id === 's2').reembolsoId, 'ac-2', 'o reembolso mexeu no gasto (nova versão)…');
  assert.equal(C.seloDoMes(C.fotoDoMes(base, a, '2026-09', cabeca)), selo, '…e o selo de setembro não mudou');
  const conf = C.conferirFechamentos(base, eventos);
  assert.deepEqual(conf.map(c => [c.mes, c.situacao, c.confere]), [['2026-09', 'confere', true]]);
  assert.equal(conf[0].seloCurto, selo.slice(0, 8));
  assert.equal(conf[0].porNome, 'Bauer');
  // o acerto acumulado vê o Pix e o reembolso de novembro
  assert.deepEqual(C.acertoAcumulado(base, a, R.parametros(a), '2026-11-03').saldos, {bauer: 13500, ana: 0, bia: -13500});
});

test('conferirFechamentos: "não confere" com selo forjado; o aplicar é injetável', () => {
  n = 0;
  const eventos = [ev('bauer', 'add_expense', 'g1', gasto({data: '2026-09-10', competencia: '2026-09', descricao: 'Contador', valorMinor: 45000}), {quando: '2026-09-10T12:00:00Z'})];
  eventos.push(ev('bauer', 'close_month', '2026-09', {cabeca: 1, selo: 'ab'.repeat(32), totais: {realizado: 45000, previsto: 0, total: 45000, resultado: -45000}}, {quando: '2026-10-03T13:00:00Z'}));
  const conf = C.conferirFechamentos(semPlanos, eventos);
  assert.equal(conf.length, 1);
  assert.equal(conf[0].situacao, 'não confere');
  assert.equal(conf[0].confere, false);
  let chamadas = 0;
  const contado = (estado, evs) => { chamadas++; return R.aplicar(estado, evs); };
  C.conferirFechamentos(semPlanos, eventos, {aplicar: contado});
  assert.equal(chamadas, 2, 'um fold do diário inteiro + um por cabeça de fechamento');
});

test('roteiro do fechamento: 6 passos com pronto, falta e atenção', () => {
  const eventos = outubro();
  let a = aceitos(base, eventos);
  let rot = C.roteiroDoFechamento(base, a, R.parametros(a), '2026-10', '2026-11-03');
  assert.deepEqual(rot.passos.map(p => p.numero), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(rot.passos.map(p => p.estado), ['atencao', 'falta', 'falta', 'atencao', 'atencao', 'falta']);
  const p1 = rot.passos[0];
  assert.match(p1.resumo, /^Bauer: 2 lançamentos · Ana: 2 lançamentos · Beatriz: nenhum · 2 assinaturas sem pagamento$/, 'o Figma anulado não conta');
  assert.equal(p1.itens.find(i => i.id === 'bia').lembrete, 'Oi, Beatriz! Faltam seus gastos de outubro no portal: + Lançar, leva 10 segundos.');
  assert.deepEqual(p1.itens.filter(i => i.tipo === 'assinatura').map(i => i.id).sort(), ['p-figma', 'p-google'], 'assinaturas sem pagamento no mês');
  assert.deepEqual(rot.passos[1].itens.map(i => i.id), ['g1', 'g2']);
  assert.deepEqual(rot.passos[1].formas, ['cartao_pj']);
  assert.equal(rot.passos[2].itens.length, 4);
  assert.ok(rot.passos[3].itens.some(i => i.tipo === 'reembolso' && i.id === 'g4'));
  assert.ok(rot.passos[4].itens.some(i => i.chave === 'imposto.simples_efetiva_pct'), 'alíquota a confirmar');
  assert.ok(rot.passos[4].itens.some(i => i.tipo === 'dolar'), 'dólar de 16/10 tem mais de 7 dias no fim do mês');
  assert.equal(rot.podeFechar, true);
  assert.equal(C.roteiroDoFechamento(base, a, R.parametros(a), '2026-10', '2026-10-19').passos[5].resumo, 'Só dá para fechar um mês que já terminou.');
  // concilia a fatura, confere tudo e acerta: os passos 2, 3 e 4 ficam prontos; depois de fechar, o 6 também
  eventos.push(ev('ana', 'reconcile_statement', '2026-10:cartao_pj', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: 54980 + 11010, itens: [{alvo: 'g1', versao: 1, faturaBrlMinor: 54980}, {alvo: 'g2', versao: 1, faturaBrlMinor: 11010}]}));
  eventos.push(ev('bia', 'check_expense', 'g1', null, {versao: 2}), ev('bia', 'check_expense', 'g2', null, {versao: 2}), ev('bia', 'check_expense', 'g3', null, {versao: 1}), ev('bia', 'check_expense', 'g4', null, {versao: 1}));
  eventos.push(ev('ana', 'record_settlement', 'ac-1', {tipo: 'acerto_entre_socias', de: 'ana', para: 'bauer', valorMinor: 13500, data: '2026-10-20', forma: 'pix', gastoIds: []}),
    ev('bia', 'record_settlement', 'ac-2', {tipo: 'acerto_entre_socias', de: 'bia', para: 'bauer', valorMinor: 13500, data: '2026-10-20', forma: 'pix', gastoIds: []}),
    ev('bauer', 'confirm_settlement', 'ac-1', {}), ev('bauer', 'confirm_settlement', 'ac-2', {}),
    ev('bauer', 'record_settlement', 'ac-3', {tipo: 'reembolso_empresa', de: 'empresa', para: 'ana', valorMinor: 5990, data: '2026-10-21', forma: 'pix', gastoIds: ['g4']}), ev('ana', 'confirm_settlement', 'ac-3', {}));
  a = aceitos(base, eventos);
  rot = C.roteiroDoFechamento(base, a, R.parametros(a), '2026-10', '2026-11-03');
  assert.deepEqual(rot.passos.slice(1, 4).map(p => p.estado), ['pronto', 'pronto', 'pronto']);
  const cabeca = eventos[eventos.length - 1].seq;
  const foto = C.fotoDoMes(base, a, '2026-10', cabeca);
  eventos.push(ev('bauer', 'close_month', '2026-10', {cabeca, selo: C.seloDoMes(foto), totais: {realizado: foto.totais.realizado, previsto: foto.totais.previsto, total: foto.totais.total, resultado: foto.totais.resultado}}, {quando: NOV}));
  a = aceitos(base, eventos);
  rot = C.roteiroDoFechamento(base, a, R.parametros(a), '2026-10', '2026-11-03');
  assert.equal(rot.passos[5].estado, 'pronto');
  assert.match(rot.passos[5].resumo, /^Outubro fechado por Bauer em 03\/11 · [0-9a-f]{8}$/);
  assert.equal(rot.podeFechar, false);
  assert.equal(C.conferirFechamentos(base, eventos)[0].situacao, 'confere');
});

test('conciliação: ratearFatura pelo maior resto fecha ao centavo; spread implícito; PTAX do boletim de fechamento', () => {
  const rnd = sorteio(918);
  for (let caso = 0; caso < 1000; caso++) {
    const itens = Array.from({length: 1 + inteiro(rnd, 8)}, (_, k) => ({id: 'g' + k, moeda: 'USD', valorMinor: inteiro(rnd, 100000) + (k === 0 ? 1 : 0)}));
    const total = inteiro(rnd, 10 ** 7);
    const r = C.ratearFatura(total, itens);
    assert.equal(r.reduce((s, it) => s + it.faturaBrlMinor, 0), total, `caso ${caso}`);
    assert.ok(r.every(it => Number.isSafeInteger(it.faturaBrlMinor) && it.faturaBrlMinor >= 0));
  }
  assert.deepEqual(C.ratearFatura(100, [{id: 'a', valorMinor: 1}, {id: 'b', valorMinor: 1}, {id: 'c', valorMinor: 1}]).map(i => i.faturaBrlMinor), [34, 33, 33], 'desempate pelo índice');
  assert.deepEqual(C.ratearFatura(66000, [{id: 'a', moeda: 'USD', valorMinor: 10000, peso: 54709}, {id: 'b', moeda: 'EUR', valorMinor: 2000, peso: 11291}]).map(i => i.faturaBrlMinor), [54709, 11291]);
  assert.equal(C.ratearFatura(100, [{id: 'a', moeda: 'USD', valorMinor: 1}, {id: 'b', moeda: 'EUR', valorMinor: 1}]), null, 'moedas diferentes pedem peso em reais');
  assert.equal(C.ratearFatura(100, [{id: 'a', valorMinor: 0}]), null);
  assert.equal(C.ratearFatura(-1, [{id: 'a', valorMinor: 1}]), null);
  // F3: US$ 100,00 a 5,41 com spread 4% e IOF 3,5% dá R$ 582,33 → o spread implícito volta a 4,00%
  assert.equal(C.spreadImplicito(58233, 10000, '5.41', '3.5'), '4.00');
  assert.equal(C.spreadImplicito(54980, 10000, '5.0826', '3.50'), '4.51', 'a fatura de R$ 549,80 da Anthropic');
  assert.equal(C.spreadImplicito(52000, 10000, '5.0826', '3.5'), '-1.15', 'abaixo da PTAX: spread negativo, dito com sinal');
  assert.equal(C.spreadImplicito(0, 10000, '5.0826', '3.5'), null);
  assert.equal(C.textoPct('4.51'), '4,51%');
  // Olinda: vários boletins por dia; vale o de fechamento do último dia útil até a data (sábado → sexta)
  const olinda = {value: [
    {paridadeCompra: 1, paridadeVenda: 1, cotacaoCompra: 5.0731, cotacaoVenda: 5.0737, dataHoraCotacao: '2026-10-15 13:06:30.000', tipoBoletim: 'Fechamento PTAX'},
    {cotacaoCompra: 5.0812, cotacaoVenda: 5.0818, dataHoraCotacao: '2026-10-16 10:08:00.000', tipoBoletim: 'Abertura'},
    {cotacaoCompra: 5.0820, cotacaoVenda: 5.0826, dataHoraCotacao: '2026-10-16 13:04:24.123', tipoBoletim: 'Fechamento PTAX'},
    {cotacaoCompra: 5.0901, cotacaoVenda: 5.0907, dataHoraCotacao: '2026-10-16 12:02:00.000', tipoBoletim: 'Intermediário'},
    {cotacaoCompra: 5.1, cotacaoVenda: 5.1006, dataHoraCotacao: '2026-10-19 13:03:00.000', tipoBoletim: 'Fechamento PTAX'},
  ]};
  const sab = C.cotacaoDoBoletim(olinda, '2026-10-17');
  assert.deepEqual({valor: sab.valor, compra: sab.compra, data: sab.data, tipo: sab.tipoBoletim, fonte: sab.fonte}, {valor: '5.0826', compra: '5.0820', data: '2026-10-16', tipo: 'Fechamento PTAX', fonte: 'PTAX venda BCB, 16/10/2026'});
  assert.equal(C.cotacaoDoBoletim(JSON.stringify(olinda), '2026-10-19').compra, '5.1000', 'aceita o texto da API');
  assert.equal(C.cotacaoDoBoletim(olinda, '2026-10-14'), null);
  // CotacaoDolarPeriodo não traz o tipo do boletim: é o de fechamento
  assert.equal(C.cotacaoDoBoletim({value: [{cotacaoCompra: 5.4123, cotacaoVenda: 5.41234, dataHoraCotacao: '2026-10-09 13:02:11.000'}]}, '2026-10-12').valor, '5.4123');
});

test('fluxo de 12 meses: começa no primeiro mês com dado, 3 futuros só com o previsto; entrou − saiu = resultado', () => {
  const {eventos} = setembroFechado(base);
  const a = aceitos(base, [...eventos, ...outubro().map(e => ({...e, seq: e.seq + 100, id: 'o' + e.id}))]);
  const s = C.serie12m(base, a, '2026-10', '2026-10-19');
  assert.deepEqual(s.map(p => p.mes), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
  const [set, out, ...futuros] = s;
  assert.equal(set.fechado, true);
  assert.match(set.selo, /^[0-9a-f]{64}$/);
  assert.equal(set.saldo, null, 'sem saldo informado em setembro');
  assert.equal(out.aberto, true);
  assert.equal(out.saldo, 2176500);
  assert.equal(out.entrou, 239600);
  assert.equal(out.saiu, 138847 + 33680 + 14376);
  assert.equal(out.entrou - out.saiu, out.resultado);
  assert.equal(out.resultado, 52697);
  for (const f of futuros) { assert.equal(f.futuro, true); assert.equal(f.entrou, null); assert.equal(f.saiu, f.previsto); assert.ok(f.previsto > 0); }
  assert.deepEqual(C.serie12m(base, R.aplicar(base, []), '2026-10', '2026-10-19').map(p => p.mes), ['2026-10', '2026-11', '2026-12', '2027-01'], 'sem dado nenhum: só o mês pedido');
});

test('serie12m com 1.200 eventos em menos de 200 ms (e o custo de conferir os selos)', t => {
  n = 0;
  const rnd = sorteio(1200);
  const eventos = [];
  const meses = Array.from({length: 12}, (_, k) => C.somarMeses('2025-11', k));
  for (const mes of meses) {
    for (let k = 0; k < 92; k++) {
      const dia = mes + '-' + String(1 + inteiro(rnd, 28)).padStart(2, '0');
      eventos.push(ev(['bauer', 'ana', 'bia'][k % 3], 'add_expense', `g-${mes}-${k}`, gasto({data: dia, competencia: mes, descricao: 'Gasto ' + k, valorMinor: 100 + inteiro(rnd, 90000), moeda: k % 4 ? 'BRL' : 'USD',
        forma: k % 5 ? 'cartao_pj' : 'pix_pessoal', destino: k % 5 ? undefined : 'dividir', pagoPor: ['bauer', 'ana', 'bia'][k % 3]}), {quando: dia + 'T12:00:00Z'}));
    }
    eventos.push(ev('bauer', 'add_income', 'rc-' + mes, receita({competencia: mes, brutoMinor: 100000 + inteiro(rnd, 300000), transacoes: 20 + inteiro(rnd, 40)}), {quando: mes + '-28T12:00:00Z'}));
    eventos.push(ev('ana', 'set_balance', 'sd-' + mes, {conta: 'Conta PJ', data: mes + '-28', valorMinor: 2000000 + inteiro(rnd, 500000), moeda: 'BRL', fonte: 'extrato'}, {quando: mes + '-28T13:00:00Z'}));
    eventos.push(ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: (5 + inteiro(rnd, 9000) / 10000).toFixed(4), desde: mes + '-01', fonte: 'teste'}, {quando: mes + '-01T12:00:00Z'}));
    for (let k = 0; k < 5; k++) eventos.push(ev('bia', 'set_balance', `sd-g-${mes}-${k}`, {conta: 'Conta global', data: mes + '-1' + k, valorMinor: 10000 + k, moeda: 'USD', fonte: 'app'}, {quando: mes + '-1' + k + 'T12:00:00Z'}));
  }
  // fecha os 3 meses anteriores a outubro, cada um com o selo verdadeiro
  for (const mes of ['2026-07', '2026-08', '2026-09']) {
    const cabeca = eventos[eventos.length - 1].seq;
    const foto = C.fotoDoMes(base, R.aplicar(base, eventos), mes, cabeca);
    eventos.push(ev('bauer', 'close_month', mes, {cabeca, selo: C.seloDoMes(foto), totais: {realizado: foto.totais.realizado, previsto: foto.totais.previsto, total: foto.totais.total, resultado: foto.totais.resultado}}, {quando: '2026-10-05T12:00:00Z'}));
  }
  assert.ok(eventos.length >= 1200, `${eventos.length} eventos`);
  const a = aceitos(base, eventos);
  C.serie12m(base, a, '2026-10', '2026-10-19');   // aquece o JIT
  const t0 = performance.now();
  const s = C.serie12m(base, a, '2026-10', '2026-10-19');
  const ms = performance.now() - t0;
  assert.equal(s.length, 15);
  assert.ok(ms < 200, `serie12m levou ${ms.toFixed(1)} ms`);
  const t1 = performance.now();
  const conf = C.conferirFechamentos(base, eventos);
  const msConf = performance.now() - t1;
  assert.deepEqual(conf.map(c => c.situacao), ['confere', 'confere', 'confere']);
  assert.ok(msConf < 2000, `conferir 3 selos com ${eventos.length} eventos levou ${msConf.toFixed(0)} ms`);
  t.diagnostic(`serie12m: ${ms.toFixed(1)} ms · conferirFechamentos (3 meses, ${eventos.length} eventos): ${msConf.toFixed(0)} ms`);
});

test('Meu painel: manchete de modelo fixo e mudanças recentes das outras sócias', () => {
  const {eventos} = setembroFechado(base);
  const a = aceitos(base, [...eventos, ...outubro().map(e => ({...e, seq: e.seq + 100, id: 'o' + e.id}))]);
  const m = C.manchetePainel(base, a, '2026-10-19', 'bauer');
  assert.equal(m.frase, 'Outubro: saiu R$ 1.166,41; R$ 1.388,47 comprometidos por mês; o caixa dá ≈ 9,2 meses; nada atrasado.');
  assert.deepEqual(m.trechos.map(t => t.alvo), ['saiu', 'comprometido', 'folego', 'atrasadas']);
  assert.deepEqual(m.numeros.map(x => [x.chave, x.valor]), [['saiu', 116641], ['comprometido', 138847], ['caixa', 2176500], ['folego', 92]]);
  assert.equal(m.minhaParte, 55539);
  assert.equal(m.saldoAcerto, 27000);
  const mud = C.mudancasRecentes(a, 'bauer', 3);
  assert.equal(mud.length, 3);
  assert.ok(mud.every(x => x.autora !== 'bauer'));
  assert.deepEqual(mud.map(x => x.seq), [...mud.map(x => x.seq)].sort((p, q) => q - p), 'a mais nova primeiro');
  assert.equal(mud[0].verbo, 'anulou');
  // sem mês fechado a manchete não inventa o fôlego
  assert.match(C.manchetePainel(base, aceitos(base, outubro()), '2026-10-19', 'ana').frase, /o fôlego precisa de 1 mês fechado/);
});

test('demonstração do arnês: só o recusado esperado, setembro confere, cada evento na autora certa, fôlego de 9,2 meses', () => {
  const funcoes = {fotoDoMes: C.fotoDoMes, seloDoMes: C.seloDoMes, aplicar: R.aplicar};
  const eventos = demonstracao(estadoFicticio, funcoes);
  assert.deepEqual(eventos.map(e => e.seq), eventos.map((_, k) => k + 1));
  assert.equal(new Set(eventos.map(e => e.id)).size, eventos.length);
  const a = R.aplicar(estadoFicticio, eventos);
  assert.equal(a.recusados.length, 1, JSON.stringify(a.recusados));
  assert.deepEqual([a.recusados[0].autora, a.recusados[0].acao, a.recusados[0].codigo], ['m-ana', 'edit_expense', 'mes_fechado']);
  assert.match(a.recusados[0].motivo, /^Setembro de 2026 está fechado/);
  const conf = C.conferirFechamentos(estadoFicticio, eventos);
  assert.deepEqual(conf.map(c => [c.mes, c.situacao, c.por]), [['2026-09', 'confere', 'm-bauer']]);
  // autoria: as três sócias aparecem no Histórico, cada uma no que fez
  const autoras = new Set(a.historico.map(h => h.autora));
  assert.deepEqual([...autoras].sort(), ['m-ana', 'm-bauer', 'm-bia']);
  const porAcao = acao => a.historico.filter(h => h.acao === acao).map(h => h.autora);
  assert.deepEqual(porAcao('close_month'), ['m-bauer']);
  assert.deepEqual(porAcao('add_plan'), ['m-bia']);
  assert.deepEqual(porAcao('record_settlement'), ['m-ana']);
  assert.deepEqual(porAcao('confirm_settlement'), ['m-bauer']);
  assert.deepEqual(porAcao('reconcile_statement'), ['m-ana']);
  assert.ok(eventos.every(e => e.membro === e.membro && ['m-bauer', 'm-ana', 'm-bia'].includes(e.membro)));
  // os números: queima de setembro calibrada, fôlego do exemplo, receitas de outubro, acerto e reembolso pendentes
  const lista = R.parametros(a);
  const set = C.resultadoDoMes(estadoFicticio, a, lista, '2026-09', '2026-10-19');
  assert.equal(-set.resultado, QUEIMA_DE_SETEMBRO);
  const f = C.folego(estadoFicticio, a, '2026-10-19');
  assert.deepEqual([f.estado, f.caixa, f.queimaMedia, f.decimos], ['ok', 2176500, 236600, 92]);
  const out = C.receitasDoMes(a, lista, '2026-10');
  assert.deepEqual([out.bruto, out.taxas, out.imposto, out.liquido], [239600, 33680, 14376, 191544]);
  const l = R.livroDoMes(estadoFicticio, a, '2026-10', '2026-10-19');
  assert.equal(l.realizado, 116641, 'os gastos de outubro do exemplo do plano');
  assert.ok(l.linhas.some(x => x.id === 'demo-api-2026-10' && x.conversao === 'estimado'), 'Anthropic de outubro sem fatura');
  const ac = C.acertoAcumulado(estadoFicticio, a, lista, '2026-10-19');
  assert.deepEqual(ac.saldos, {'m-bauer': 13500, 'm-ana': 0, 'm-bia': -13500}, 'o Pix da Ana veio; o da Beatriz não');
  assert.deepEqual(ac.reembolsosPendentes.map(g => [g.descricao, g.brl]), [['Domínio orquestrator.com.br', 5990]]);
  assert.equal(a.planos.find(p => p.id === 'pl-demo-notion').confirmado, false, 'assinatura nova a confirmar');
  assert.deepEqual(a.passos.filter(s => s.versao > 1).map(s => [s.id, s.marcadoPor]), [['s3', 'm-ana'], ['s6', 'm-bia']]);
  // a mesma demonstração dá os mesmos eventos (o selo é determinístico) e respeita o primeiro seq pedido
  assert.equal(JSON.stringify(demonstracao(estadoFicticio, funcoes)), JSON.stringify(eventos));
  const deslocada = demonstracao(estadoFicticio, funcoes, {primeiroSeq: 5});
  assert.equal(deslocada[0].seq, 5);
  assert.equal(R.aplicar(estadoFicticio, deslocada).recusados.length, 1);
  assert.equal(C.conferirFechamentos(estadoFicticio, deslocada)[0].situacao, 'confere');
});

test('relógio do servidor do arnês: o diário grava a hora que o teste definiu (fechar outubro em 03/11)', async () => {
  const {servir} = await import('../ferramentas/arnes/servir.mjs');
  const {abrirDiario} = await import('../diario.js');
  const servidor = await servir(0, {agora: NOV});
  try {
    const url = 'http://127.0.0.1:' + servidor.address().port;
    assert.match(servidor.agora(), /^2026-11-03T13:00/);
    const d = await abrirDiario({url, membroId: 'm-bauer', senha: 'arnes-m-bauer', masterRaw: new Uint8Array(32).fill(3)});
    assert.equal(d.modo, 'gravacao', d.motivo);
    const r = await d.acrescentar({acao: 'set_balance', alvo: 'sd-1', dados: {conta: 'Conta PJ', data: '2026-11-02', valorMinor: 100, moeda: 'BRL', fonte: 'teste'}, quando: NOV});
    assert.ok(r.ok, r.erro);
    assert.match(r.evento.ts, /^2026-11-03T13:00/, 'a resposta traz a hora do relógio do arnês');
    const outra = await abrirDiario({url, membroId: 'm-ana', senha: 'arnes-m-ana', masterRaw: new Uint8Array(32).fill(3)});
    assert.match(outra.eventos[0].ts, /^2026-11-03T13:00/, 'e é a mesma hora que ficou gravada');
    // com essa hora, o razão aceita o saldo de 02/11 (com a hora real de hoje, 19/10, seria "data que ainda não chegou")
    assert.equal(R.aplicar(estadoFicticio, outra.eventos).recusados.length, 0);
    assert.equal(servidor.definirAgora(null).slice(0, 4), new Date().toISOString().slice(0, 4), 'null volta à hora real');
  } finally { servidor.close(); }
});

test('caixa com conta sem câmbio (euro sem PTAX): não vira saldo zero; o fôlego avisa que é parcial', () => {
  const {eventos} = setembroFechado();
  const eur = () => ev('ana', 'set_balance', 'sd-eur', {conta: 'Conta em euro', data: '2026-10-18', valorMinor: 50000, moeda: 'EUR', fonte: 'extrato'}, {quando: '2026-10-18T21:30:00Z'});
  const soEuro = aceitos(semPlanos, [...eventos.filter(e => e.conteudo.acao !== 'set_balance'), eur()]);
  const cx = C.caixaInformado(soEuro, R.parametros(soEuro), '2026-10-19');
  assert.equal(cx.temSaldo, false, 'nenhuma conta virou reais');
  assert.equal(cx.completo, false);
  assert.equal(C.folego(semPlanos, soEuro, '2026-10-19').estado, 'sem_saldo', 'nada de "≈ 0 meses"');
  const misto = aceitos(semPlanos, [...eventos, eur()]);
  const f = C.folego(semPlanos, misto, '2026-10-19');
  assert.equal(f.estado, 'ok');
  assert.equal(f.decimos, 92, 'conta só o que tem câmbio');
  assert.equal(f.parcial, true);
  assert.match(f.frase, /Sem contar Conta em euro: falta o câmbio\.$/);
  assert.equal(C.folego(semPlanos, aceitos(semPlanos, eventos), '2026-10-19').parcial, false);
});
