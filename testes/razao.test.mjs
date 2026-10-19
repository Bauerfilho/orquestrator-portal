// node --test testes/ — o livro-razão confere centavo a centavo com os vetores do plano (docs/PLANO-PORTAL.md §4.6).
import test from 'node:test';
import assert from 'node:assert/strict';
import {converter, ratear, centavosBR, decimal, aplicar, livroDoMes, parametros, vigente, acertoEntreSocias, csvLancamentos, reaisDoGasto} from '../razao.js';

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
let n = 0;
const ev = (membro, acao, alvo, dados, extra = {}) => ({seq: ++n, id: 'e' + n, membro, conteudo: {acao, alvo, dados, quando: '2026-10-19T12:00:00Z', ...extra}});
const gasto = (d) => ({data: '2026-10-14', competencia: '2026-10', categoria: 'software_ia', moeda: 'BRL', forma: 'cartao_pj', pagoPor: 'bauer', ...d});

test('F3: conversão fecha com os vetores do plano', () => {
  assert.deepEqual(converter(10000, '5.4123', '0', '3.5'), {principal: 54123, spread: 0, iof: 1894, total: 56017});
  assert.deepEqual(converter(10000, '5.41', '4', '3.5'), {principal: 54100, spread: 2164, iof: 1969, total: 58233});
  assert.equal(converter(100000, '5.41', '0', '0.38').total, 543056);
  assert.deepEqual(converter(10000, '5.0826', '4', '3.5'), {principal: 50826, spread: 2033, iof: 1850, total: 54709});
  for (let a = 1; a < 3000; a += 7) { const r = converter(a, '5.0826', '4', '3.5'); assert.equal(r.principal + r.spread + r.iof, r.total); }
  assert.equal(converter(-1, '5', '0', '0'), null);
  assert.equal(converter(100, '5e2', '0', '0'), null);
});

test('rateio pelo maior resto: soma exata e recusa participação que não fecha 100%', () => {
  assert.deepEqual(ratear(100000, ['40', '30', '30']), [40000, 30000, 30000]);
  assert.deepEqual(ratear(1, ['33.33333333', '33.33333333', '33.33333334']), [0, 0, 1]);
  for (let t = 0; t < 5000; t += 13) assert.equal(ratear(t, ['40', '30', '30']).reduce((a, b) => a + b, 0), t);
  assert.equal(ratear(100, ['40', '30']), null);
});

test('dinheiro à moda brasileira', () => {
  assert.equal(centavosBR('1.500'), 150000);
  assert.equal(centavosBR('1.500,25'), 150025);
  assert.equal(centavosBR('R$ 59,90'), 5990);
  assert.equal(centavosBR('1.50'), null, '"1.50" é ambíguo em reais: pede vírgula');
  assert.equal(centavosBR('12,345'), null);
  assert.equal(centavosBR('100.00', 'USD'), 10000);
  assert.equal(centavosBR('1,000.50', 'USD'), 100050);
  assert.equal(decimal('5,0826').n, 50826n);
});

test('parâmetro vigente: o de maior "desde" que não passa da data; mudar hoje não muda o passado', () => {
  n = 0;
  const a = aplicar(base, [ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '5.50', desde: '2026-10-18'})]);
  const lista = parametros(a);
  assert.equal(vigente(lista, 'fx.USD_BRL', '2026-10-17').valor, '5.0826');
  assert.equal(vigente(lista, 'fx.USD_BRL', '2026-10-18').valor, '5.50');
  const r = aplicar(base, [ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '500', desde: '2026-10-18'})]);
  assert.equal(r.recusados.length, 1, 'fora da faixa dura é recusado');
  assert.match(r.recusados[0].motivo, /fora da faixa/);
});

test('o exemplo de outubro do plano bate centavo a centavo', () => {
  n = 0;
  const eventos = [
    ev('ana', 'add_expense', 'g1', gasto({descricao: 'Anthropic API — créditos', valorMinor: 10000, moeda: 'USD'})),
    ev('bauer', 'add_expense', 'g2', gasto({descricao: 'Vercel Pro', valorMinor: 2000, moeda: 'USD', data: '2026-10-05', categoria: 'infraestrutura', planoId: 'p-vercel'})),
    ev('bauer', 'add_expense', 'g3', gasto({descricao: 'Contador', valorMinor: 45000, categoria: 'contabilidade_juridico', forma: 'pix_pessoal', destino: 'dividir', data: '2026-10-10'})),
    ev('ana', 'add_expense', 'g4', gasto({descricao: 'Domínio', valorMinor: 5990, categoria: 'infraestrutura', forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa', data: '2026-10-12'})),
    ev('ana', 'add_expense', 'g5', gasto({descricao: 'Figma duplicado', valorMinor: 1500, moeda: 'USD'})),
    ev('ana', 'void_expense', 'g5', null, {versao: 1, motivo: 'lançado em duplicidade'}),
  ];
  const a = aplicar(base, eventos);
  assert.equal(a.recusados.length, 0, JSON.stringify(a.recusados));
  const l = livroDoMes(base, a, '2026-10', '2026-10-19');
  const vercel = l.linhas.find(x => x.id === 'g2');
  assert.equal(vercel.brl, 10942);
  assert.equal(l.realizado, 54709 + 10942 + 45000 + 5990);
  assert.ok(!l.linhas.some(x => x.tipo === 'previsto' && x.id === 'p-vercel'), 'o gasto ligado substitui a previsão');
  assert.ok(!l.linhas.some(x => x.id === 'p-apple'), 'assinatura inativa não entra');
  const figma = l.linhas.find(x => x.id === 'p-figma'), google = l.linhas.find(x => x.id === 'p-google');
  assert.equal(google.brl, 14000);
  assert.equal(figma.brl, converter(1500, '5.0826', '4', '3.5').total);
  assert.equal(l.total, l.realizado + l.previsto);
  assert.equal(l.porCategoria.reduce((s, c) => s + c.permil, 0), 1000);
  assert.equal(l.porSocia.reduce((s, x) => s + x.parte, 0), l.total);
  const ana = l.porSocia.find(s => s.id === 'ana');
  assert.equal(ana.aReceberDaEmpresa, 5990);
  assert.deepEqual(l.acerto.saldos, {bauer: 27000, ana: -13500, bia: -13500});
  assert.deepEqual(l.acerto.transferencias, [{de: 'ana', para: 'bauer', brl: 13500}, {de: 'bia', para: 'bauer', brl: 13500}]);
  assert.ok(l.explica.total.excluidos.some(e => e.motivo === 'anulado'));
});

test('fatura substitui a estimativa; sem câmbio vira incompleto, nunca zero', () => {
  n = 0;
  const a = aplicar(base, [ev('ana', 'add_expense', 'g1', gasto({descricao: 'API', valorMinor: 10000, moeda: 'USD', faturaBrlMinor: 54980})),
    ev('ana', 'add_expense', 'g2', gasto({descricao: 'Hospedagem europeia', valorMinor: 1000, moeda: 'EUR'}))]);
  const lista = parametros(a);
  assert.equal(reaisDoGasto(a.gastos[0], lista).tipo, 'efetivo');
  const l = livroDoMes(base, a, '2026-10', '2026-10-19');
  assert.equal(l.linhas.find(x => x.id === 'g2').brl, null);
  assert.equal(l.incompletos.length, 1);
  assert.equal(l.porMoeda.EUR, 1000);
});

test('recusas: autoria, versão, motivo e tipo desconhecido', () => {
  n = 0;
  const a = aplicar(base, [
    ev('ana', 'add_expense', 'g1', gasto({descricao: 'Canva', valorMinor: 3490, pagoPor: 'ana'})),
    ev('bia', 'edit_expense', 'g1', {valorMinor: 1}, {versao: 1}),
    ev('ana', 'edit_expense', 'g1', {valorMinor: 3990}, {versao: 1}),
    ev('ana', 'edit_expense', 'g1', {valorMinor: 4990}, {versao: 1}),
    ev('bauer', 'edit_expense', 'g1', {valorMinor: 3000}, {versao: 2}),
    ev('ana', 'apagar_tudo', 'x', {}),
    ev('estranho', 'add_expense', 'g9', gasto({descricao: 'x', valorMinor: 1})),
    ev('ana', 'add_expense', 'g2', gasto({descricao: '', valorMinor: 100})),
  ]);
  const motivos = a.recusados.map(r => r.motivo);
  assert.match(motivos[0], /Só quem lançou/);
  assert.match(motivos[1], /Outra pessoa mudou/);
  assert.match(motivos[2], /pede um motivo/);
  assert.match(motivos[3], /não entende/);
  assert.match(motivos[4], /Autora desconhecida/);
  assert.match(motivos[5], /Descreva/);
  assert.equal(a.gastos[0].valorMinor, 3990);
  assert.equal(a.gastos[0].versoes.length, 1);
});

test('CSV para o contador: BOM, ponto e vírgula, centavos e proteção contra fórmula', () => {
  n = 0;
  const a = aplicar(base, [ev('ana', 'add_expense', 'g1', gasto({descricao: '=SOMA(A1)', valorMinor: 123456}))]);
  const csv = csvLancamentos(a, parametros(a), id => id);
  assert.ok(csv.startsWith('﻿data;competencia'));
  assert.match(csv, /'=SOMA\(A1\);/);
  assert.match(csv, /;1234,56;123456;/);
});

test('acerto entre sócias zera', () => {
  const m = base.members.map(x => ({id: x.id, pct: x.participationPct}));
  const r = acertoEntreSocias([{brl: 10001, pagoPor: 'ana'}, {brl: 3333, pagoPor: 'bia'}], m);
  assert.equal(Object.values(r.saldos).reduce((a, b) => a + b, 0), 0);
});
