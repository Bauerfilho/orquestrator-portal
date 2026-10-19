// node --test testes/ — as ações novas do diário (fase 2, fatia F2-1): cada uma aceita e recusa com o motivo e o código
// esperados; a trava do mês fechado; o fechamento com concorrência; o mês fechado congelado; o estado efetivo que o
// domain.js valida. Dados fictícios (as três sócias do arnês). Plano: docs/PLANO-FASES-2-3.md (F2-1) e PLANO-PORTAL.md §4.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../razao.js';
import {validateState, buildSnapshot} from '../domain.js';

const {aplicar, livroDoMes, estadoEfetivo, ACOES, VERBOS} = R;

const base = {
  schemaVersion: 1, revision: 1, charges: null, benefits: [], staticBlocks: {},
  selling: {steps: [{id: 's1', product: 'Med Painel', text: 'Fechar o preço de lançamento', checked: false}, {id: 's2', product: 'Med Painel', text: 'Publicar a página de vendas', checked: true}]},
  members: [{id: 'bauer', displayName: 'Bauer', role: 'owner', participationPct: 40}, {id: 'ana', displayName: 'Ana', role: 'member', participationPct: 30}, {id: 'bia', displayName: 'Beatriz', role: 'member', participationPct: 30}],
  plans: [
    {id: 'p-vercel', servico: 'Vercel', plano: 'Pro', amountMinor: 2000, currency: 'USD', period: 'mensal', monthlyDay: 5, confirmed: true, subscriptionState: 'active'},
    {id: 'p-figma', servico: 'Figma', plano: 'Pro', amountMinor: 1500, currency: 'USD', period: 'mensal', confirmed: true, subscriptionState: 'active'},
    {id: 'p-google', servico: 'Google Workspace', plano: 'Business', amountMinor: 14000, currency: 'BRL', period: 'mensal', confirmed: true, subscriptionState: 'active'},
    {id: 'p-apple', servico: 'Apple Developer', plano: 'anual', amountMinor: 9900, currency: 'USD', period: 'anual', confirmed: true, subscriptionState: 'inactive'},
    {id: 'p-hotmart', servico: 'Hotmart', plano: 'Taxa por venda', amountMinor: null, currency: 'BRL', period: 'por venda', confirmed: false, subscriptionState: 'unconfirmed'},
  ],
};
const BASE_JSON = JSON.stringify(base);
const OUT = '2026-10-19T12:00:00Z', NOV = '2026-11-03T13:00:00Z';
let n = 0;
const ev = (membro, acao, alvo, dados, extra = {}) => ({seq: ++n, id: 'e' + n, membro, conteudo: {acao, alvo, dados, quando: OUT, ...extra}});
const gasto = d => ({data: '2026-10-14', competencia: '2026-10', descricao: 'Gasto', categoria: 'software_ia', valorMinor: 1000, moeda: 'BRL', forma: 'cartao_pj', pagoPor: 'bauer', ...d});
const novembro = d => gasto({data: '2026-11-02', competencia: '2026-11', ...d});
const receita = d => ({competencia: '2026-10', canal: 'hotmart', produto: 'Med Painel', brutoMinor: 239600, moeda: 'BRL', transacoes: 40, taxasMinor: null, canceladosMinor: null, pagantesAtivos: 40, pagantesNovos: 12, pagantesPerdidos: 2, testes: 5, cadastros: 85, ...d});
const plano = d => ({servico: 'Notion', plano: 'Plus', valorMinor: 1000, moeda: 'USD', periodo: 'mensal', diaVencimento: 12, proximaData: null, categoria: 'software_ia', status: 'a vencer', ...d});
const acerto = d => ({tipo: 'acerto_entre_socias', de: 'ana', para: 'bauer', valorMinor: 13500, data: '2026-10-20', forma: 'pix', gastoIds: [], nota: '', ...d});
const SELO = 'ab'.repeat(32);
const totais = (t = {}) => ({realizado: 0, previsto: 0, total: 0, resultado: 0, ...t});
const fechar = (cabeca, extra = {}, membro = 'bauer') => ev(membro, 'close_month', '2026-10', {cabeca, selo: SELO, totais: totais()}, {quando: NOV, ...extra});

// aplica a sequência e devolve a recusa do último evento (null se aceito)
function ultimo(eventos, estado = base) { const a = aplicar(estado, eventos); const id = eventos[eventos.length - 1].id; return {a, r: a.recusados.find(r => r.id === id) || null}; }
function aceito(eventos, estado) { const {a, r} = ultimo(eventos, estado); assert.equal(r, null, r ? `recusado: ${r.motivo}` : ''); return a; }
function recusado(eventos, codigo, re, estado) {
  const {a, r} = ultimo(eventos, estado);
  assert.ok(r, 'deveria ter sido recusado: ' + eventos[eventos.length - 1].conteudo.acao);
  assert.equal(r.codigo, codigo, `código ${r.codigo} (${r.motivo})`);
  if (re) assert.match(r.motivo, re);
  return {a, r};
}

test('ACOES lista as ações novas e cada uma tem verbo em português', () => {
  for (const acao of ['check_expense', 'reconcile_statement', 'record_payment', 'convert_to_contribution', 'add_plan', 'edit_plan', 'confirm_plan', 'archive_plan', 'reactivate_plan', 'toggle_step', 'record_settlement', 'confirm_settlement', 'set_balance', 'add_income', 'edit_income', 'void_income', 'close_month', 'reopen_month', 'add_expense', 'edit_expense', 'void_expense', 'set_parameter', 'mark_reimbursed'])
    assert.ok(ACOES.includes(acao), acao);
  for (const acao of ACOES) assert.equal(typeof VERBOS[acao], 'string', acao);
  assert.equal(VERBOS.record_payment, 'marcou como paga');
  assert.ok(!ACOES.includes('set_statement_value'), 'reconcile_statement substitui set_statement_value');
});

test('D15: categoria Pró-labore e folha (sem cor própria) e a taxa do Google no catálogo', () => {
  const pro = R.CATEGORIAS.find(c => c.id === 'pro_labore');
  assert.deepEqual(pro, {id: 'pro_labore', rotulo: 'Pró-labore e folha', slot: 0});
  assert.equal(R.rotuloCategoria('pro_labore'), 'Pró-labore e folha');
  const a = aceito([ev('bauer', 'add_expense', 'g-pl', gasto({descricao: 'Pró-labore de outubro', categoria: 'pro_labore', valorMinor: 151800, forma: 'conta_pj'}))]);
  const l = livroDoMes(base, a, '2026-10', '2026-10-19');
  assert.equal(l.porCategoria.find(c => c.id === 'pro_labore').slot, 0);
  const google = R.itemCatalogo('taxa.google_pct');
  assert.equal(google.semente.valor, '15.00');
  assert.equal(google.semente.estado, 'a_confirmar');
  assert.equal(R.vigente(R.parametros(a), 'taxa.google_pct', '2026-10-31').valor, '15.00');
});

test('check_expense: outra sócia confere; quem lançou não confere; versão e anulado recusados', () => {
  const g1 = ev('ana', 'add_expense', 'g1', gasto({descricao: 'Canva', pagoPor: 'ana'}));
  const a = aceito([g1, ev('bia', 'check_expense', 'g1', null, {versao: 1})]);
  const g = a.gastos[0];
  assert.equal(g.estado, 'conferido');
  assert.equal(g.conferidoPor, 'bia');
  assert.equal(g.versao, 2);
  assert.equal(a.historico.at(-1).verbo, 'conferiu');
  recusado([g1, ev('ana', 'check_expense', 'g1', null, {versao: 1})], 'permissao', /Quem confere é outra sócia/);
  recusado([g1, ev('bia', 'check_expense', 'g1', null, {versao: 7})], 'versao', /Outra pessoa mudou/);
  recusado([g1, ev('ana', 'void_expense', 'g1', null, {versao: 1, motivo: 'duplicado'}), ev('bia', 'check_expense', 'g1', null, {versao: 2})], 'invalido', /já foi anulado/);
  recusado([g1, ev('bia', 'check_expense', 'g1', null, {versao: 1}), ev('bauer', 'check_expense', 'g1', null, {versao: 2})], 'invalido', /já foi conferido/);
  // corrigir depois de conferido pede conferência de novo
  const b = aceito([g1, ev('bia', 'check_expense', 'g1', null, {versao: 1}), ev('ana', 'edit_expense', 'g1', {valorMinor: 1200}, {versao: 2})]);
  assert.equal(b.gastos[0].estado, 'lancado');
  assert.equal(b.gastos[0].conferidoPor, null);
});

test('reconcile_statement: grava a fatura de cada item, versão nova e um registro com estimado → fatura e a diferença', () => {
  const pre = [
    ev('ana', 'add_expense', 'u1', gasto({descricao: 'Anthropic API', valorMinor: 10000, moeda: 'USD'})),
    ev('bauer', 'add_expense', 'u2', gasto({descricao: 'Vercel Pro', valorMinor: 2000, moeda: 'USD', data: '2026-10-05'})),
    ev('ana', 'add_expense', 'b1', gasto({descricao: 'Contador', valorMinor: 45000})),
    ev('ana', 'add_expense', 'u3', gasto({descricao: 'Hospedagem', valorMinor: 500, moeda: 'USD', forma: 'cartao_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa'})),
    ev('ana', 'add_expense', 'u4', gasto({descricao: 'Créditos de setembro', valorMinor: 800, moeda: 'USD', competencia: '2026-09', data: '2026-09-28'})),
  ];
  const conc = (itens, extra = {}) => ev('bia', 'reconcile_statement', '2026-10:cartao_pj', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: null, itens, ...extra});
  const a = aceito([...pre, conc([{alvo: 'u1', versao: 1, faturaBrlMinor: 54980}, {alvo: 'u2', versao: 1, faturaBrlMinor: 11000}], {totalFaturaMinor: 65980})]);
  const u1 = a.gastos.find(g => g.id === 'u1'), u2 = a.gastos.find(g => g.id === 'u2');
  assert.equal(u1.faturaBrlMinor, 54980);
  assert.equal(u1.versao, 2);
  assert.equal(u2.faturaBrlMinor, 11000);
  const h = a.historico.at(-1);
  assert.equal(h.verbo, 'conciliou a fatura');
  assert.equal(h.antes.estimadoMinor, 54709 + 10942);
  assert.equal(h.depois.faturaMinor, 65980);
  assert.equal(h.diferencaMinor, 65980 - 65651);
  assert.match(h.resumo, /diferença \+R\$ 3,29/);
  assert.equal(a.historico.filter(x => x.acao === 'reconcile_statement').length, 1, 'um registro só para a fatura inteira');
  const l = livroDoMes(base, a, '2026-10', '2026-10-19');
  assert.equal(l.linhas.find(x => x.id === 'u1').conversao, 'efetivo');
  recusado([...pre, conc([{alvo: 'b1', versao: 1, faturaBrlMinor: 45000}])], 'invalido', /já está em reais/);
  recusado([...pre, conc([{alvo: 'u3', versao: 1, faturaBrlMinor: 2800}])], 'invalido', /outra forma/);
  recusado([...pre, conc([{alvo: 'u4', versao: 1, faturaBrlMinor: 4400}])], 'invalido', /outra competência/);
  recusado([...pre, conc([{alvo: 'u1', versao: 1, faturaBrlMinor: 54980}, {alvo: 'u2', versao: 1, faturaBrlMinor: 11000}], {totalFaturaMinor: 66000})], 'invalido', /somam R\$ 659,80/);
  recusado([...pre, conc([{alvo: 'u1', versao: 1, faturaBrlMinor: 54980}, {alvo: 'u2', versao: 3, faturaBrlMinor: 11000}])], 'versao');
  recusado([...pre, conc([{alvo: 'u1', versao: 1, faturaBrlMinor: 54980}, {alvo: 'u1', versao: 1, faturaBrlMinor: 54980}])], 'repetido');
  recusado([...pre, conc([{alvo: 'nada', versao: 1, faturaBrlMinor: 100}])], 'invalido', /não existe/);
  recusado([...pre, conc([])], 'invalido', /ao menos um gasto/);
  // a recusa não deixa meia fatura gravada
  const r = aplicar(base, [...pre, conc([{alvo: 'u1', versao: 1, faturaBrlMinor: 54980}, {alvo: 'u2', versao: 9, faturaBrlMinor: 11000}])]);
  assert.equal(r.gastos.find(g => g.id === 'u1').faturaBrlMinor, null);
});

test('record_payment: marca a assinatura como paga num ciclo; plano encerrado, ciclo pago e alvo repetidos recusados', () => {
  const pag = (alvo, d = {}, membro = 'bia') => ev(membro, 'record_payment', alvo, gasto({descricao: 'Google Workspace', valorMinor: 14000, data: '2026-10-02', planoId: 'p-google', ciclo: '2026-10', categoria: 'software_ia', ...d}));
  const a = aceito([pag('g-pay')]);
  const g = a.gastos[0];
  assert.equal(g.planoId, 'p-google');
  assert.equal(g.ciclo, '2026-10');
  assert.equal(a.historico[0].verbo, 'marcou como paga');
  const l = livroDoMes(base, a, '2026-10', '2026-10-19');
  assert.ok(!l.linhas.some(x => x.tipo === 'previsto' && x.id === 'p-google'), 'o pagamento substitui a previsão');
  recusado([pag('g-x', {planoId: 'nao-existe'})], 'invalido', /assinatura que foi paga/);
  recusado([pag('g-x', {ciclo: undefined})], 'invalido', /ciclo/);
  recusado([pag('g-x', {ciclo: '2026-13'})], 'invalido', /ciclo/);
  recusado([pag('g-x', {planoId: 'p-apple'})], 'invalido', /encerrada/);
  recusado([pag('g1'), pag('g2')], 'repetido', /já foi marcada como paga em outubro de 2026/);
  recusado([ev('bauer', 'add_expense', 'g1', gasto({planoId: 'p-google'})), pag('g2')], 'repetido', /já foi marcada como paga/);
  recusado([pag('g1'), pag('g1', {ciclo: '2026-11', competencia: '2026-11', data: '2026-11-02'})], 'repetido', /Lançamento repetido/);
  aceito([pag('g1'), ev('bia', 'void_expense', 'g1', null, {versao: 1, motivo: 'errei'}), pag('g2')]);
});

test('convert_to_contribution: só quem pagou; reembolso pendente vira aporte sem mudar valor nem competência', () => {
  const g4 = ev('ana', 'add_expense', 'g4', gasto({descricao: 'Domínio', valorMinor: 5990, forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa', categoria: 'infraestrutura'}));
  const a = aceito([g4, ev('ana', 'convert_to_contribution', 'g4', null, {versao: 1})]);
  const g = a.gastos[0];
  assert.equal(g.convertidoPor, 'ana');
  assert.equal(g.valorMinor, 5990);
  assert.equal(g.competencia, '2026-10');
  assert.equal(g.destino, 'empresa_reembolsa');
  const ana = livroDoMes(base, a, '2026-10', '2026-10-19').porSocia.find(s => s.id === 'ana');
  assert.equal(ana.aReceberDaEmpresa, 0);
  assert.equal(ana.aporte, 5990);
  recusado([g4, ev('bauer', 'convert_to_contribution', 'g4', null, {versao: 1})], 'permissao', /Só quem pagou/);
  recusado([ev('bauer', 'add_expense', 'g5', gasto({forma: 'pix_pessoal', destino: 'dividir'})), ev('bauer', 'convert_to_contribution', 'g5', null, {versao: 1})], 'invalido', /empresa reembolsa/);
  recusado([g4, ev('ana', 'convert_to_contribution', 'g4', null, {versao: 1}), ev('ana', 'convert_to_contribution', 'g4', null, {versao: 2})], 'invalido', /já virou aporte/);
  recusado([g4, ev('bauer', 'mark_reimbursed', 'g4', null, {versao: 1}), ev('ana', 'convert_to_contribution', 'g4', null, {versao: 2})], 'invalido', /já foi reembolsado/);
});

test('mark_reimbursed continua aceito (legado) e conta como reembolso', () => {
  const g4 = ev('ana', 'add_expense', 'g4', gasto({descricao: 'Domínio', valorMinor: 5990, forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa'}));
  const a = aceito([g4, ev('bia', 'mark_reimbursed', 'g4', null, {versao: 1})]);
  assert.equal(livroDoMes(base, a, '2026-10', '2026-10-19').porSocia.find(s => s.id === 'ana').aReceberDaEmpresa, 0);
  assert.equal(a.historico.at(-1).verbo, 'marcou como reembolsado');
  recusado([g4, ev('bia', 'mark_reimbursed', 'g4', null, {versao: 1}), ev('bia', 'mark_reimbursed', 'g4', null, {versao: 2})], 'invalido', /já foi reembolsado/);
});

test('add_plan: nasce a confirmar e ativa; dados inválidos e alvo repetido recusados', () => {
  const a = aceito([ev('ana', 'add_plan', 'pl-notion', plano())]);
  const p = a.planos.find(x => x.id === 'pl-notion');
  assert.equal(p.confirmado, false);
  assert.equal(p.assinatura, 'active');
  assert.equal(p.versao, 1);
  assert.equal(p.criadoPor, 'ana');
  assert.equal(a.historico[0].verbo, 'criou a assinatura');
  assert.ok(a.planos.find(x => x.id === 'p-vercel').doPacote, 'os planos do pacote continuam lá, versão 1 sem autora');
  assert.equal(a.planos.find(x => x.id === 'p-vercel').criadoPor, null);
  recusado([ev('ana', 'add_plan', 'pl-x', plano({periodo: 'por venda'}))], 'invalido', /período/);
  recusado([ev('ana', 'add_plan', 'pl-x', plano({valorMinor: 0}))], 'invalido', /maior que zero/);
  recusado([ev('ana', 'add_plan', 'pl-x', plano({servico: '  '}))], 'invalido', /serviço/);
  recusado([ev('ana', 'add_plan', 'pl-x', plano({diaVencimento: 32}))], 'invalido', /1 a 31/);
  recusado([ev('ana', 'add_plan', 'pl-x', plano({proximaData: '2026-02-30'}))], 'invalido', /Próxima data/);
  recusado([ev('ana', 'add_plan', 'pl-x', plano({categoria: 'toString'}))], 'invalido', /categoria/);
  recusado([ev('ana', 'add_plan', 'notion', plano())], 'invalido', /Identificador/);
  recusado([ev('ana', 'add_plan', 'pl-n', plano()), ev('bia', 'add_plan', 'pl-n', plano())], 'repetido');
});

test('edit_plan: o status livre não tira a confirmação; valor, moeda ou período tiram', () => {
  const base1 = [ev('bia', 'edit_plan', 'p-figma', {status: 'pago em 09/10'}, {versao: 1})];
  const a = aceito(base1);
  const f = a.planos.find(x => x.id === 'p-figma');
  assert.equal(f.status, 'pago em 09/10');
  assert.equal(f.confirmado, true);
  assert.equal(f.versao, 2);
  assert.equal(a.historico[0].antes.status, '');
  assert.equal(a.historico[0].depois.status, 'pago em 09/10');
  const b = aceito([...base1, ev('ana', 'edit_plan', 'p-figma', {valorMinor: 1600}, {versao: 2})]);
  assert.equal(b.planos.find(x => x.id === 'p-figma').confirmado, false);
  assert.equal(b.planos.find(x => x.id === 'p-figma').valorMinor, 1600);
  const c = aceito([ev('ana', 'edit_plan', 'p-figma', {valorMinor: 1500, status: 'igual'}, {versao: 1})]);
  assert.equal(c.planos.find(x => x.id === 'p-figma').confirmado, true, 'mesmo valor não é mudança');
  recusado([...base1, ev('ana', 'edit_plan', 'p-figma', {status: 'x'}, {versao: 1})], 'versao', /Outra pessoa mudou esta assinatura/);
  recusado([ev('ana', 'edit_plan', 'p-figma', {}, {versao: 1})], 'invalido', /o que mudou/);
  recusado([ev('ana', 'edit_plan', 'p-figma', {periodo: 'bianual'}, {versao: 1})], 'invalido', /período/);
  recusado([ev('ana', 'edit_plan', 'nada', {status: 'x'}, {versao: 1})], 'invalido', /não existe/);
});

test('confirm_plan: quatro olhos (outra sócia ou a responsável)', () => {
  const novo = ev('ana', 'add_plan', 'pl-notion', plano());
  recusado([novo, ev('ana', 'confirm_plan', 'pl-notion', null, {versao: 1})], 'permissao', /Quem confirma a assinatura é outra sócia: são quatro olhos nos dados da fatura/);
  const a = aceito([novo, ev('bia', 'confirm_plan', 'pl-notion', null, {versao: 1})]);
  const p = a.planos.find(x => x.id === 'pl-notion');
  assert.equal(p.confirmado, true);
  assert.equal(p.confirmadoPor, 'bia');
  aceito([ev('bauer', 'add_plan', 'pl-b', plano()), ev('bauer', 'confirm_plan', 'pl-b', null, {versao: 1})]);
  // quem alterou o valor também não confirma
  recusado([novo, ev('bia', 'confirm_plan', 'pl-notion', null, {versao: 1}), ev('bia', 'edit_plan', 'pl-notion', {valorMinor: 1200}, {versao: 2}), ev('bia', 'confirm_plan', 'pl-notion', null, {versao: 3})], 'permissao');
  recusado([novo, ev('bia', 'confirm_plan', 'pl-notion', null, {versao: 1}), ev('bauer', 'confirm_plan', 'pl-notion', null, {versao: 2})], 'invalido', /já está confirmada/);
  recusado([ev('bia', 'confirm_plan', 'p-hotmart', null, {versao: 1})], 'invalido', /Complete valor/);
});

test('archive_plan e reactivate_plan: data e motivo; não encerra duas vezes nem reativa o que está ativo', () => {
  const enc = ev('ana', 'archive_plan', 'p-figma', {desde: '2026-10-01'}, {versao: 1, motivo: 'cancelado no site'});
  const a = aceito([enc]);
  const f = a.planos.find(x => x.id === 'p-figma');
  assert.deepEqual(f.encerrado, {desde: '2026-10-01', por: 'ana', em: OUT, motivo: 'cancelado no site'});
  assert.equal(a.historico[0].verbo, 'encerrou a assinatura');
  recusado([ev('ana', 'archive_plan', 'p-figma', {desde: '2026-10-01'}, {versao: 1})], 'invalido', /motivo/);
  recusado([ev('ana', 'archive_plan', 'p-figma', {}, {versao: 1, motivo: 'x'})], 'invalido', /desde quando/);
  recusado([enc, ev('bia', 'archive_plan', 'p-figma', {desde: '2026-10-02'}, {versao: 2, motivo: 'x'})], 'invalido', /já está encerrada/);
  recusado([ev('bia', 'archive_plan', 'p-apple', {desde: '2026-10-02'}, {versao: 1, motivo: 'x'})], 'invalido', /já está encerrada/);
  recusado([ev('bia', 'reactivate_plan', 'p-figma', null, {versao: 1})], 'invalido', /já está ativa/);
  const b = aceito([enc, ev('bia', 'reactivate_plan', 'p-figma', null, {versao: 2})]);
  assert.equal(b.planos.find(x => x.id === 'p-figma').encerrado, null);
  const c = aceito([ev('bauer', 'reactivate_plan', 'p-apple', null, {versao: 1})]);
  assert.equal(c.planos.find(x => x.id === 'p-apple').assinatura, 'active');
});

test('toggle_step: qualquer sócia, pelo id e pela versão', () => {
  const a = aceito([ev('bia', 'toggle_step', 's1', {feito: true}, {versao: 1})]);
  const s = a.passos.find(x => x.id === 's1');
  assert.equal(s.feito, true);
  assert.equal(s.marcadoPor, 'bia');
  assert.equal(s.versao, 2);
  assert.equal(a.historico[0].verbo, 'marcou o passo');
  const b = aceito([ev('ana', 'toggle_step', 's2', {feito: false}, {versao: 1})]);
  assert.equal(b.historico[0].verbo, 'desmarcou o passo');
  recusado([ev('bia', 'toggle_step', 's1', {feito: true}, {versao: 1}), ev('ana', 'toggle_step', 's1', {feito: false}, {versao: 1})], 'versao', /passo/);
  recusado([ev('bia', 'toggle_step', 's9', {feito: true}, {versao: 1})], 'invalido', /não existe/);
  recusado([ev('bia', 'toggle_step', 's1', {feito: 'sim'}, {versao: 1})], 'invalido', /feito/);
});

test('record_settlement: reembolso e retirada pela responsável, acerto e aporte por quem paga, valor batendo com os gastos', () => {
  const g4 = ev('ana', 'add_expense', 'g4', gasto({descricao: 'Domínio', valorMinor: 5990, forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa'}));
  const reemb = (d = {}, membro = 'bauer', alvo = 'ac-r1') => ev(membro, 'record_settlement', alvo, acerto({tipo: 'reembolso_empresa', de: 'empresa', para: 'ana', valorMinor: 5990, gastoIds: ['g4'], ...d}));
  const a = aceito([g4, reemb()]);
  const ac = a.acertos[0];
  assert.equal(ac.tipo, 'reembolso_empresa');
  assert.equal(ac.moeda, 'BRL');
  assert.equal(ac.confirmadoPor, null);
  assert.equal(a.gastos[0].reembolsoId, 'ac-r1');
  assert.equal(livroDoMes(base, a, '2026-10', '2026-10-19').porSocia.find(s => s.id === 'ana').aReceberDaEmpresa, 0);
  assert.equal(a.historico.at(-1).verbo, 'registrou o reembolso');
  recusado([g4, reemb({valorMinor: 5000})], 'invalido', /O valor não bate com os gastos escolhidos \(R\$ 59,90\)\./);
  recusado([g4, reemb({}, 'ana')], 'permissao', /Só a responsável/);
  recusado([g4, reemb({para: 'bia'})], 'invalido', /não é um reembolso pendente de Beatriz/);
  recusado([g4, reemb(), reemb({}, 'bauer', 'ac-r2')], 'invalido', /não é um reembolso pendente/);
  recusado([g4, reemb({gastoIds: ['g4', 'g4'], valorMinor: 11980})], 'repetido');
  aceito([reemb({gastoIds: [], valorMinor: 20000})]);
  // acerto entre sócias e aporte: só quem paga registra
  aceito([ev('ana', 'record_settlement', 'ac-1', acerto())]);
  recusado([ev('bia', 'record_settlement', 'ac-1', acerto())], 'permissao', /quem pagou/);
  recusado([ev('ana', 'record_settlement', 'ac-1', acerto({para: 'ana'}))], 'invalido', /duas sócias diferentes/);
  recusado([ev('ana', 'record_settlement', 'ac-1', acerto({gastoIds: ['g4']}))], 'invalido', /Só o reembolso aponta gastos/);
  aceito([ev('bia', 'record_settlement', 'ac-2', acerto({tipo: 'aporte', de: 'bia', para: 'empresa', valorMinor: 100000}))]);
  recusado([ev('bia', 'record_settlement', 'ac-2', acerto({tipo: 'aporte', de: 'bia', para: 'ana'}))], 'invalido', /aporte/);
  aceito([ev('bauer', 'record_settlement', 'ac-3', acerto({tipo: 'retirada', de: 'empresa', para: 'bia', valorMinor: 50000}))]);
  recusado([ev('bia', 'record_settlement', 'ac-3', acerto({tipo: 'retirada', de: 'empresa', para: 'bia', valorMinor: 50000}))], 'permissao');
  recusado([ev('ana', 'record_settlement', 'ac-1', acerto({tipo: 'presente'}))], 'invalido', /Escolha o tipo/);
  recusado([ev('ana', 'record_settlement', 'ac-1', acerto({forma: 'cheque'}))], 'invalido', /Pix/);
  recusado([ev('ana', 'record_settlement', 'ac-1', acerto({data: '2026-10-32'}))], 'invalido', /data/);
  recusado([ev('ana', 'record_settlement', 'x-1', acerto())], 'invalido', /Identificador/);
  recusado([ev('ana', 'record_settlement', 'ac-1', acerto()), ev('ana', 'record_settlement', 'ac-1', acerto())], 'repetido');
});

test('confirm_settlement: só quem recebe (a responsável quando quem recebe é a empresa)', () => {
  const pix = ev('ana', 'record_settlement', 'ac-1', acerto());
  const a = aceito([pix, ev('bauer', 'confirm_settlement', 'ac-1')]);
  assert.equal(a.acertos[0].confirmadoPor, 'bauer');
  assert.equal(a.historico.at(-1).verbo, 'confirmou o recebimento');
  recusado([pix, ev('ana', 'confirm_settlement', 'ac-1')], 'permissao', /Só quem recebe confirma o recebimento\./);
  recusado([pix, ev('bauer', 'confirm_settlement', 'ac-1'), ev('bauer', 'confirm_settlement', 'ac-1')], 'invalido', /já foi confirmado/);
  recusado([ev('bauer', 'confirm_settlement', 'ac-9')], 'invalido', /não existe/);
  const aporte = ev('bia', 'record_settlement', 'ac-2', acerto({tipo: 'aporte', de: 'bia', para: 'empresa'}));
  recusado([aporte, ev('bia', 'confirm_settlement', 'ac-2')], 'permissao', /Só quem recebe/);
  aceito([aporte, ev('bauer', 'confirm_settlement', 'ac-2')]);
});

test('set_balance: qualquer sócia; vale o de maior data por conta, desempate pela ordem do diário', () => {
  const sd = (alvo, d, membro = 'ana', extra) => ev(membro, 'set_balance', alvo, {conta: 'Conta PJ', data: '2026-10-18', valorMinor: 2176500, moeda: 'BRL', fonte: 'extrato', nota: '', ...d}, extra);
  const a = aceito([sd('sd-1', {}), sd('sd-2', {data: '2026-10-15', valorMinor: 1}, 'bia'), sd('sd-3', {conta: 'Wise', valorMinor: 0, moeda: 'USD'})]);
  assert.deepEqual(a.saldos.filter(s => s.vigente).map(s => s.id), ['sd-1', 'sd-3']);
  assert.equal(a.historico[0].verbo, 'informou o saldo');
  const b = aceito([sd('sd-1', {}), sd('sd-2', {valorMinor: 2000000}, 'bauer')]);
  assert.deepEqual(b.saldos.filter(s => s.vigente).map(s => s.id), ['sd-2']);
  recusado([sd('sd-1', {data: '2026-10-20'})], 'invalido', /ainda não chegou/);
  aceito([sd('sd-1', {data: '2026-10-31'}, 'ana', {quando: '2026-11-04T12:00:00Z'})]);
  recusado([sd('sd-1', {valorMinor: -1})], 'invalido', /zero para cima/);
  recusado([sd('sd-1', {moeda: 'XYZ'})], 'invalido', /Moeda/);
  recusado([sd('sd-1', {conta: ''})], 'invalido', /conta/);
  recusado([sd('saldo', {})], 'invalido', /Identificador/);
  recusado([sd('sd-1', {}), sd('sd-1', {})], 'repetido');
});

test('add_income, edit_income e void_income: agregados por competência e canal, com testes e cancelados', () => {
  const rc = ev('ana', 'add_income', 'rc-1', receita({canceladosMinor: 5990}));
  const a = aceito([rc]);
  const r = a.receitas[0];
  assert.equal(r.brutoMinor, 239600);
  assert.equal(r.testes, 5);
  assert.equal(r.canceladosMinor, 5990);
  assert.equal(r.versao, 1);
  assert.equal(a.historico[0].verbo, 'lançou a receita');
  const b = aceito([rc, ev('ana', 'edit_income', 'rc-1', {brutoMinor: 245590, transacoes: 41}, {versao: 1})]);
  assert.equal(b.receitas[0].brutoMinor, 245590);
  assert.equal(b.receitas[0].versao, 2);
  assert.equal(b.historico.at(-1).antes.brutoMinor, 239600);
  recusado([rc, ev('bia', 'edit_income', 'rc-1', {brutoMinor: 1}, {versao: 1})], 'invalido', /outra sócia pede um motivo/);
  aceito([rc, ev('bia', 'edit_income', 'rc-1', {brutoMinor: 1}, {versao: 1, motivo: 'extrato da Hotmart'})]);
  recusado([rc, ev('ana', 'void_income', 'rc-1', null, {versao: 1})], 'invalido', /motivo/);
  const c = aceito([rc, ev('bia', 'void_income', 'rc-1', null, {versao: 1, motivo: 'lançada em dobro'})]);
  assert.equal(c.receitas[0].estado, 'anulado');
  recusado([rc, ev('bia', 'void_income', 'rc-1', null, {versao: 2, motivo: 'x'})], 'versao', /receita/);
  recusado([ev('ana', 'add_income', 'rc-1', receita({canal: 'mercado'}))], 'invalido', /canal/);
  recusado([ev('ana', 'add_income', 'rc-1', receita({moeda: 'EUR'}))], 'invalido', /reais ou em dólar/);
  recusado([ev('ana', 'add_income', 'rc-1', receita({transacoes: 1.5}))], 'invalido', /vendas/);
  recusado([ev('ana', 'add_income', 'rc-1', receita({pagantesNovos: -2}))], 'invalido', /pagantes novos/);
  recusado([ev('ana', 'add_income', 'rc-1', receita({competencia: '2026-13'}))], 'invalido', /Competência/);
  aceito([ev('ana', 'add_income', 'rc-1', receita({brutoMinor: 0, transacoes: 0, testes: null, cadastros: null}))]);
  recusado([rc, ev('ana', 'add_income', 'rc-1', receita())], 'repetido');
});

test('close_month: só a responsável, só mês terminado; concorrência só com evento que muda aquele mês', () => {
  const g1 = ev('ana', 'add_expense', 'g1', gasto({pagoPor: 'ana'}));
  const a = aceito([g1, ev('ana', 'add_expense', 'g-nov', novembro({pagoPor: 'ana'})), fechar(g1.seq)]);
  const f = a.fechamentos['2026-10'];
  assert.equal(f.fechado, true);
  assert.equal(f.cabeca, g1.seq);
  assert.equal(f.selo, SELO);
  assert.equal(f.por, 'bauer');
  assert.equal(f.em, NOV);
  assert.ok(Array.isArray(f.planosNaHora) && f.planosNaHora.some(p => p.id === 'p-vercel'));
  assert.deepEqual(f.reaberturas, []);
  assert.equal(a.historico.at(-1).verbo, 'fechou o mês');
  // um gasto de outubro entre a cabeça e o fechamento: o diário andou
  const {r} = recusado([g1, ev('ana', 'add_expense', 'g2', gasto({pagoPor: 'ana'})), fechar(g1.seq)], 'versao', /O diário andou enquanto você fechava\. Confira e feche de novo\./);
  assert.equal(r.atual.alteradoPor, 'ana');
  // parâmetro que vale em outubro muda o mês; um que só vale em novembro não
  recusado([g1, ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '5.30', desde: '2026-10-20'}), fechar(g1.seq)], 'versao', /andou/);
  aceito([g1, ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '5.30', desde: '2026-11-01'}), fechar(g1.seq)]);
  // plano criado ou alterado muda o previsto; conferir, acertar e informar saldo não
  recusado([g1, ev('ana', 'edit_plan', 'p-figma', {valorMinor: 1600}, {versao: 1}), fechar(g1.seq)], 'versao');
  recusado([g1, ev('ana', 'add_plan', 'pl-n', plano()), fechar(g1.seq)], 'versao');
  recusado([g1, ev('ana', 'add_income', 'rc-1', receita()), fechar(g1.seq)], 'versao');
  aceito([g1, ev('bia', 'check_expense', 'g1', null, {versao: 1}), ev('ana', 'record_settlement', 'ac-1', acerto()), ev('bia', 'set_balance', 'sd-1', {conta: 'PJ', data: '2026-10-18', valorMinor: 1, moeda: 'BRL'}), ev('bia', 'toggle_step', 's1', {feito: true}, {versao: 1}), fechar(g1.seq)]);
  // a recusa por posição repetida do diario.js (409): o mesmo conteúdo numa posição seguinte continua valendo
  aceito([g1, ev('ana', 'add_expense', 'g-nov', novembro({pagoPor: 'ana'})), ev('bia', 'add_expense', 'g-nov2', novembro({pagoPor: 'bia'})), fechar(g1.seq)]);
  recusado([g1, fechar(g1.seq, {quando: OUT})], 'invalido', /Só dá para fechar um mês que já terminou\./);
  recusado([g1, fechar(g1.seq, {quando: '2026-11-01T02:00:00Z'})], 'invalido', /já terminou/, undefined);
  recusado([g1, fechar(g1.seq, {}, 'ana')], 'permissao', /Só a responsável fecha/);
  recusado([g1, fechar(g1.seq), fechar(g1.seq)], 'mes_fechado', /já está fechado/);
  recusado([g1, ev('bauer', 'close_month', '2026-10', {cabeca: g1.seq, selo: 'xyz', totais: totais()}, {quando: NOV})], 'invalido', /Selo/);
  recusado([g1, ev('bauer', 'close_month', '2026-10', {cabeca: 999999, selo: SELO, totais: totais()}, {quando: NOV})], 'invalido', /Posição/);
  recusado([g1, ev('bauer', 'close_month', '2026-10', {cabeca: g1.seq, selo: SELO, totais: totais({realizado: 1000, total: 999})}, {quando: NOV})], 'invalido', /não fecham/);
  recusado([g1, ev('bauer', 'close_month', '2026-10', {cabeca: g1.seq, selo: SELO, totais: totais({realizado: -1})}, {quando: NOV})], 'invalido', /Totais/);
  recusado([g1, ev('bauer', 'close_month', '2026-1', {cabeca: g1.seq, selo: SELO, totais: totais()}, {quando: NOV})], 'invalido', /Mês/);
  aceito([g1, ev('bauer', 'close_month', '2026-10', {cabeca: g1.seq, selo: SELO, totais: totais({realizado: 1000, total: 1000, resultado: -1000})}, {quando: NOV})]);
});

test('reopen_month: só a responsável, com motivo; destrava o mês e fica no histórico do fechamento', () => {
  const g1 = ev('ana', 'add_expense', 'g1', gasto({pagoPor: 'ana'}));
  const fecha = fechar(g1.seq);
  const reabre = ev('bauer', 'reopen_month', '2026-10', null, {quando: NOV, motivo: 'a fatura chegou depois'});
  const a = aceito([g1, fecha, reabre]);
  const f = a.fechamentos['2026-10'];
  assert.equal(f.fechado, false);
  assert.equal(f.reaberturas.length, 1);
  assert.equal(f.reaberturas[0].motivo, 'a fatura chegou depois');
  assert.equal(a.historico.at(-1).verbo, 'reabriu o mês');
  aceito([g1, fecha, reabre, ev('ana', 'add_expense', 'g2', gasto({pagoPor: 'ana'}), {quando: NOV})]);
  const b = aceito([g1, fecha, reabre, ev('ana', 'add_expense', 'g2', gasto({pagoPor: 'ana'}), {quando: NOV}), fechar(n)]);
  assert.equal(b.fechamentos['2026-10'].reaberturas.length, 1, 'fechar de novo guarda as reaberturas');
  recusado([g1, fecha, ev('bauer', 'reopen_month', '2026-10', null, {quando: NOV})], 'invalido', /motivo/);
  recusado([g1, fecha, ev('ana', 'reopen_month', '2026-10', null, {quando: NOV, motivo: 'x'})], 'permissao', /Só a responsável reabre/);
  recusado([g1, ev('bauer', 'reopen_month', '2026-10', null, {quando: NOV, motivo: 'x'})], 'invalido', /não está fechado/);
});

test('trava do mês fechado: recusa o que forma os números de outubro; aceita acertos, saldos, conversões e reembolsos', () => {
  const pre = [
    ev('ana', 'add_expense', 'g-out', gasto({descricao: 'Domínio', valorMinor: 5990, forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa'})),
    ev('ana', 'add_expense', 'g-usd', gasto({descricao: 'Anthropic API', valorMinor: 10000, moeda: 'USD', pagoPor: 'ana'})),
    ev('ana', 'add_expense', 'g-nov', novembro({pagoPor: 'ana'})),
    ev('ana', 'add_income', 'rc-out', receita()),
    ev('ana', 'add_income', 'rc-nov', receita({competencia: '2026-11'})),
  ];
  const fecha = fechar(pre.at(-1).seq);
  const depois = (membro, acao, alvo, dados, extra = {}) => ev(membro, acao, alvo, dados, {quando: NOV, ...extra});
  const FECHADO = /Outubro de 2026 está fechado\. A responsável reabre, com motivo, se precisar mudar\./;
  const travado = e => recusado([...pre, fecha, e], 'mes_fechado', FECHADO);
  const livre = e => aceito([...pre, fecha, e]);
  travado(depois('ana', 'add_expense', 'g9', gasto({pagoPor: 'ana'})));
  livre(depois('ana', 'add_expense', 'g9', novembro({pagoPor: 'ana'})));
  travado(depois('ana', 'edit_expense', 'g-nov', {competencia: '2026-10'}, {versao: 1}));
  travado(depois('ana', 'edit_expense', 'g-out', {competencia: '2026-11'}, {versao: 1}));
  travado(depois('ana', 'edit_expense', 'g-out', {valorMinor: 6990}, {versao: 1}));
  travado(depois('ana', 'void_expense', 'g-out', null, {versao: 1, motivo: 'errado'}));
  travado(depois('bia', 'record_payment', 'g-pg', gasto({planoId: 'p-google', ciclo: '2026-10', valorMinor: 14000, pagoPor: 'bia'})));
  travado(depois('bia', 'check_expense', 'g-out', null, {versao: 1}));
  travado(depois('bia', 'reconcile_statement', 'f', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: null, itens: [{alvo: 'g-usd', versao: 1, faturaBrlMinor: 54980}]}));
  travado(depois('ana', 'add_income', 'rc-9', receita()));
  travado(depois('ana', 'edit_income', 'rc-nov', {competencia: '2026-10'}, {versao: 1}));
  travado(depois('ana', 'edit_income', 'rc-out', {transacoes: 41}, {versao: 1}));
  travado(depois('ana', 'void_income', 'rc-out', null, {versao: 1, motivo: 'x'}));
  // não travam: o Pix de outubro registrado em novembro, o saldo de 31/10 informado em 04/11, conversão e reembolso
  livre(depois('ana', 'record_settlement', 'ac-1', acerto({data: '2026-10-30'})));
  livre(depois('bia', 'set_balance', 'sd-1', {conta: 'PJ', data: '2026-10-31', valorMinor: 2176500, moeda: 'BRL', fonte: 'extrato'}, {quando: '2026-11-04T12:00:00Z'}));
  livre(depois('ana', 'convert_to_contribution', 'g-out', null, {versao: 1}));
  livre(depois('bauer', 'mark_reimbursed', 'g-out', null, {versao: 1}));
  livre(depois('bauer', 'record_settlement', 'ac-2', acerto({tipo: 'reembolso_empresa', de: 'empresa', para: 'ana', valorMinor: 5990, gastoIds: ['g-out']})));
  livre(depois('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '6.00', desde: '2026-10-01'}));
  livre(depois('ana', 'edit_plan', 'p-figma', {valorMinor: 3000}, {versao: 1}));
  livre(depois('ana', 'archive_plan', 'p-google', {desde: '2026-10-01'}, {versao: 1, motivo: 'cancelado'}));
  livre(depois('ana', 'toggle_step', 's1', {feito: true}, {versao: 1}));
  livre(depois('ana', 'edit_income', 'rc-nov', {transacoes: 3}, {versao: 1}));
});

test('livroDoMes de outubro fechado não muda com dólar, edit_plan nem archive_plan posteriores; novembro (aberto) muda', () => {
  const pre = [
    ev('ana', 'add_expense', 'g1', gasto({descricao: 'Anthropic API — créditos', valorMinor: 10000, moeda: 'USD', pagoPor: 'ana'})),
    ev('bauer', 'add_expense', 'g2', gasto({descricao: 'Vercel Pro', valorMinor: 2000, moeda: 'USD', data: '2026-10-05', categoria: 'infraestrutura', planoId: 'p-vercel'})),
    ev('bauer', 'add_expense', 'g3', gasto({descricao: 'Contador', valorMinor: 45000, categoria: 'contabilidade_juridico', forma: 'pix_pessoal', destino: 'dividir', data: '2026-10-10'})),
    ev('ana', 'add_expense', 'g4', gasto({descricao: 'Domínio', valorMinor: 5990, categoria: 'infraestrutura', forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa', data: '2026-10-12'})),
  ];
  const aberto = livroDoMes(base, aplicar(base, pre), '2026-10', '2026-11-03');
  assert.equal(aberto.total, 116641 + 22206, 'o exemplo de outubro do plano: R$ 1.388,47');
  const fecha = fechar(pre.at(-1).seq, {});
  fecha.conteudo.dados.totais = totais({realizado: aberto.realizado, previsto: aberto.previsto, total: aberto.total, resultado: -aberto.total});
  const a1 = aceito([...pre, fecha]);
  const l1 = livroDoMes(base, a1, '2026-10', '2026-11-03');
  assert.equal(l1.fechado, true);
  assert.equal(l1.fechamento.selo, SELO);
  assert.equal(l1.total, aberto.total);
  const nov1 = livroDoMes(base, a1, '2026-11', '2026-11-03');
  const mudancas = [
    ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '6.00', desde: '2026-10-01'}, {quando: NOV}),
    ev('ana', 'edit_plan', 'p-figma', {valorMinor: 3000}, {versao: 1, quando: NOV}),
    ev('bia', 'confirm_plan', 'p-figma', null, {versao: 2, quando: NOV}),
    ev('ana', 'archive_plan', 'p-google', {desde: '2026-10-01'}, {versao: 1, motivo: 'cancelado', quando: NOV}),
  ];
  const a2 = aceito([...pre, fecha, ...mudancas]);
  assert.equal(a2.recusados.length, 0);
  const l2 = livroDoMes(base, a2, '2026-10', '2026-11-03');
  assert.equal(JSON.stringify(l2), JSON.stringify(l1), 'o mês fechado usa os parâmetros e os planos da hora');
  const nov2 = livroDoMes(base, a2, '2026-11', '2026-11-03');
  assert.notEqual(nov2.previsto, nov1.previsto, 'o mês aberto acompanha as mudanças');
  assert.ok(!nov2.linhas.some(x => x.id === 'p-google'), 'encerrado desde outubro sai de novembro');
  // reaberto, outubro volta a usar o que vale hoje
  const a3 = aceito([...pre, fecha, ...mudancas, ev('bauer', 'reopen_month', '2026-10', null, {quando: NOV, motivo: 'revisar'})]);
  const l3 = livroDoMes(base, a3, '2026-10', '2026-11-03');
  assert.equal(l3.fechado, false);
  assert.notEqual(l3.total, l1.total);
});

test('previsto: só planos ativos e confirmados; categoria do plano antes do palpite; encerrado sai a partir do mês do encerramento', () => {
  const novo = ev('ana', 'add_plan', 'pl-notion', plano({servico: 'Notion', categoria: 'marketing', valorMinor: 5000, moeda: 'BRL'}));
  const prev = (eventos, mes = '2026-10') => livroDoMes(base, aceito(eventos), mes, '2026-10-19').linhas.filter(x => x.tipo === 'previsto');
  assert.ok(!prev([novo]).some(x => x.id === 'pl-notion'), 'a confirmar não entra');
  const conf = prev([novo, ev('bia', 'confirm_plan', 'pl-notion', null, {versao: 1})]).find(x => x.id === 'pl-notion');
  assert.equal(conf.brl, 5000);
  assert.equal(conf.categoria, 'marketing', 'palpite seria software_ia');
  assert.ok(!prev([ev('ana', 'archive_plan', 'p-google', {desde: '2026-10-15'}, {versao: 1, motivo: 'x'})]).some(x => x.id === 'p-google'));
  assert.ok(prev([ev('ana', 'archive_plan', 'p-google', {desde: '2026-11-10'}, {versao: 1, motivo: 'x'})]).some(x => x.id === 'p-google'), 'encerra só em novembro');
  assert.ok(!prev([ev('ana', 'archive_plan', 'p-google', {desde: '2026-11-10'}, {versao: 1, motivo: 'x'})], '2026-11').some(x => x.id === 'p-google'));
  assert.ok(!prev([ev('ana', 'edit_plan', 'p-figma', {valorMinor: 1800}, {versao: 1})]).some(x => x.id === 'p-figma'), 'valor alterado volta para a confirmar');
  assert.ok(prev([ev('bauer', 'reactivate_plan', 'p-apple', null, {versao: 1})]).some(x => x.id === 'p-apple'));
});

test('estadoEfetivo passa no validateState e o buildSnapshot mostra plano novo, confirmado, encerrado e pago', () => {
  const eventos = [
    ev('ana', 'add_plan', 'pl-canva', plano({servico: 'Canva', plano: 'Pro', valorMinor: 3490, moeda: 'BRL', categoria: 'marketing'})),
    ev('bia', 'add_plan', 'pl-notion', plano()),
    ev('ana', 'confirm_plan', 'pl-notion', null, {versao: 1}),
    ev('bauer', 'archive_plan', 'p-figma', {desde: '2026-10-01'}, {versao: 1, motivo: 'cancelado'}),
    ev('bia', 'record_payment', 'g-pay', gasto({descricao: 'Google Workspace', valorMinor: 14000, data: '2026-10-02', planoId: 'p-google', ciclo: '2026-10', pagoPor: 'bia'})),
    ev('bauer', 'add_expense', 'g-vercel', gasto({descricao: 'Vercel', valorMinor: 2000, moeda: 'USD', data: '2026-10-05', planoId: 'p-vercel'})),
    ev('bia', 'toggle_step', 's1', {feito: true}, {versao: 1}),
  ];
  const a = aceito(eventos);
  const ef = estadoEfetivo(base, a, '2026-10-19');
  assert.equal(JSON.stringify(base), BASE_JSON, 'o estado do pacote não é alterado');
  assert.equal(validateState(ef), true);
  const snap = buildSnapshot(ef, {id: 'bauer', role: 'owner'}, '2026-10-19');
  const p = id => snap.blocks.user.plans.find(x => x.id === id);
  assert.equal(p('pl-canva').confirmation, 'unconfirmed');
  assert.equal(p('pl-canva').subscription_state, 'active');
  assert.equal(p('pl-notion').confirmation, 'confirmed');
  assert.equal(p('p-figma').subscription_state, 'inactive');
  assert.equal(p('p-google').payment_status, 'paid');
  assert.equal(p('p-google').proxima_data, '2026-11-02');
  assert.equal(p('p-vercel').payment_status, 'paid', 'add_expense com planoId também paga o ciclo');
  assert.equal(p('p-vercel').proxima_data, '2026-11-05');
  assert.equal(snap.blocks.sell_first.steps.find(s => s.id === 's1').checked, true);
  const figma = ef.plans.find(x => x.id === 'p-figma');
  assert.equal(figma.archivedBy, 'bauer');
  assert.equal(figma.version, 2);
  const canva = ef.plans.find(x => x.id === 'pl-canva');
  assert.equal(canva.category, 'marketing');
  assert.equal(canva.createdBy, 'ana');
  assert.equal(ef.selling.steps.find(s => s.id === 's1').checkedBy, 'bia');
  assert.deepEqual(ef.plans.find(x => x.id === 'p-apple'), base.plans.find(x => x.id === 'p-apple'), 'plano sem evento sai igual ao do pacote');
  // sem eventos, o estado efetivo dá o mesmo snapshot que o pacote
  const ef0 = estadoEfetivo(base, aplicar(base, []), '2026-10-19');
  assert.deepEqual(buildSnapshot(ef0, {id: 'ana', role: 'member'}, '2026-10-19').blocks, buildSnapshot(base, {id: 'ana', role: 'member'}, '2026-10-19').blocks);
  // pago num ciclo antigo não marca o ciclo de hoje; o encerramento futuro ainda não desliga a assinatura
  const b = aceito([ev('bia', 'record_payment', 'g-set', gasto({planoId: 'p-google', ciclo: '2026-09', competencia: '2026-09', data: '2026-09-02', valorMinor: 14000})), ev('ana', 'archive_plan', 'p-vercel', {desde: '2026-12-01'}, {versao: 1, motivo: 'migrar'})]);
  const ef2 = estadoEfetivo(base, b, '2026-10-19');
  assert.notEqual(ef2.plans.find(x => x.id === 'p-google').paymentStatus, 'pago');
  assert.equal(ef2.plans.find(x => x.id === 'p-vercel').subscriptionState, 'active');
  assert.equal(estadoEfetivo(base, b, '2026-12-01').plans.find(x => x.id === 'p-vercel').subscriptionState, 'inactive');
});

test('recusa de versão traz o código e o registro atual (para o diálogo de conflito)', () => {
  const g1 = ev('ana', 'add_expense', 'g1', gasto({descricao: 'Canva', valorMinor: 3490, pagoPor: 'ana'}));
  const ed = ev('ana', 'edit_expense', 'g1', {valorMinor: 3990}, {versao: 1, quando: '2026-10-19T17:02:00Z'});
  const {r} = recusado([g1, ed, ev('bauer', 'edit_expense', 'g1', {valorMinor: 4800}, {versao: 1, motivo: 'nota'})], 'versao', /Outra pessoa mudou este lançamento antes \(versão 2\)/);
  assert.equal(r.atual.versao, 2);
  assert.equal(r.atual.alteradoPor, 'ana');
  assert.equal(r.atual.alteradoEm, '2026-10-19T17:02:00Z');
  assert.match(r.atual.resumo, /Canva · R\$ 39,90/);
  assert.equal(r.atual.dados.valorMinor, 3990);
  assert.equal(r.alvo, 'g1');
  const pl = recusado([ev('ana', 'edit_plan', 'p-figma', {status: 'x'}, {versao: 1}), ev('bia', 'edit_plan', 'p-figma', {status: 'y'}, {versao: 1})], 'versao').r;
  assert.deepEqual([pl.atual.versao, pl.atual.alteradoPor], [2, 'ana']);
  const base1 = recusado([ev('bia', 'confirm_plan', 'p-figma', null, {versao: 2})], 'versao').r;
  assert.deepEqual([base1.atual.versao, base1.atual.alteradoPor], [1, null], 'registro do pacote: versão 1 sem autora');
  const rc = recusado([ev('ana', 'add_income', 'rc-1', receita()), ev('ana', 'edit_income', 'rc-1', {transacoes: 41}, {versao: 1}), ev('bia', 'edit_income', 'rc-1', {transacoes: 42}, {versao: 1, motivo: 'x'})], 'versao').r;
  assert.equal(rc.atual.alteradoPor, 'ana');
});

test('alvo repetido é recusado em todas as inclusões', () => {
  recusado([ev('ana', 'add_expense', 'g1', gasto()), ev('bia', 'add_expense', 'g1', gasto())], 'repetido');
  recusado([ev('ana', 'add_expense', 'g1', gasto()), ev('bia', 'record_payment', 'g1', gasto({planoId: 'p-figma', ciclo: '2026-10'}))], 'repetido');
  recusado([ev('ana', 'add_plan', 'pl-1', plano()), ev('bia', 'add_plan', 'pl-1', plano())], 'repetido');
  recusado([ev('ana', 'record_settlement', 'ac-1', acerto()), ev('ana', 'record_settlement', 'ac-1', acerto())], 'repetido');
  recusado([ev('ana', 'set_balance', 'sd-1', {conta: 'PJ', data: '2026-10-18', valorMinor: 1, moeda: 'BRL'}), ev('bia', 'set_balance', 'sd-1', {conta: 'PJ', data: '2026-10-18', valorMinor: 2, moeda: 'BRL'})], 'repetido');
  recusado([ev('ana', 'add_income', 'rc-1', receita()), ev('bia', 'add_income', 'rc-1', receita())], 'repetido');
});

test('nenhuma ação aceita valor negativo, moeda desconhecida, autora fora do estado nem papel declarado no evento', () => {
  const pre = [ev('ana', 'add_expense', 'g1', gasto({pagoPor: 'ana', moeda: 'USD', valorMinor: 1000})), ev('ana', 'add_income', 'rc-1', receita())];
  const negativos = [
    ev('ana', 'add_expense', 'g9', gasto({valorMinor: -100})),
    ev('ana', 'edit_expense', 'g1', {valorMinor: -100}, {versao: 1}),
    ev('ana', 'record_payment', 'g9', gasto({valorMinor: -1, planoId: 'p-figma', ciclo: '2026-10'})),
    ev('ana', 'reconcile_statement', 'f', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: null, itens: [{alvo: 'g1', versao: 1, faturaBrlMinor: -5}]}),
    ev('ana', 'reconcile_statement', 'f', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: -5, itens: [{alvo: 'g1', versao: 1, faturaBrlMinor: 5}]}),
    ev('ana', 'add_plan', 'pl-9', plano({valorMinor: -1})),
    ev('ana', 'edit_plan', 'p-figma', {valorMinor: -1}, {versao: 1}),
    ev('ana', 'record_settlement', 'ac-9', acerto({valorMinor: -1})),
    ev('ana', 'set_balance', 'sd-9', {conta: 'PJ', data: '2026-10-18', valorMinor: -1, moeda: 'BRL'}),
    ev('ana', 'add_income', 'rc-9', receita({brutoMinor: -1})),
    ev('ana', 'add_income', 'rc-9', receita({canceladosMinor: -1})),
    ev('ana', 'add_income', 'rc-9', receita({taxasMinor: -1})),
    ev('ana', 'edit_income', 'rc-1', {brutoMinor: -1}, {versao: 1}),
    ev('bauer', 'close_month', '2026-10', {cabeca: 1, selo: SELO, totais: totais({previsto: -1, total: -1})}, {quando: NOV}),
  ];
  for (const e of negativos) recusado([...pre, e], 'invalido', null);
  const moedas = [
    ev('ana', 'add_expense', 'g9', gasto({moeda: 'XYZ'})),
    ev('ana', 'add_expense', 'g9', gasto({moeda: 'constructor'})),
    ev('ana', 'record_payment', 'g9', gasto({moeda: 'GBP', planoId: 'p-figma', ciclo: '2026-10'})),
    ev('ana', 'add_plan', 'pl-9', plano({moeda: 'XYZ'})),
    ev('ana', 'edit_plan', 'p-figma', {moeda: 'GBP'}, {versao: 1}),
    ev('ana', 'record_settlement', 'ac-9', acerto({moeda: 'USD'})),
    ev('ana', 'set_balance', 'sd-9', {conta: 'PJ', data: '2026-10-18', valorMinor: 1, moeda: '__proto__'}),
    ev('ana', 'add_income', 'rc-9', receita({moeda: 'EUR'})),
  ];
  for (const e of moedas) recusado([...pre, e], 'invalido', /[Mm]oeda|reais|dólar/);
  // autora fora do estado: nenhuma ação
  for (const acao of ACOES) recusado([...pre, ev('intrusa', acao, 'x', {}, {versao: 1})], 'permissao', /Autora desconhecida/);
  // papel declarado no evento não vale: o papel vem do estado
  const papel = {papel: 'owner', role: 'owner'};
  recusado([...pre, ev('ana', 'close_month', '2026-10', {cabeca: 2, selo: SELO, totais: totais(), ...papel}, {quando: NOV, ...papel})], 'permissao');
  recusado([...pre, ev('ana', 'record_settlement', 'ac-9', acerto({tipo: 'retirada', de: 'empresa', para: 'ana', ...papel}), papel)], 'permissao');
  recusado([...pre, ev('ana', 'add_plan', 'pl-9', plano()), ev('ana', 'confirm_plan', 'pl-9', papel, {versao: 1, ...papel})], 'permissao');
  recusado([...pre, ev('bia', 'edit_expense', 'g1', {valorMinor: 1, ...papel}, {versao: 1, motivo: 'x', ...papel})], 'permissao');
  // e as recusas antigas ganharam código
  recusado([ev('ana', 'apagar_tudo', 'x', {})], 'invalido', /não entende/);
  recusado([ev('ana', 'add_expense', 'g1', gasto()), ev('bia', 'edit_expense', 'g1', {valorMinor: 1}, {versao: 1})], 'permissao', /Só quem lançou/);
  recusado([ev('ana', 'add_expense', 'g1', gasto({descricao: ''}))], 'invalido', /Descreva/);
  recusado([ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: 5.3, desde: '2026-10-18'}), ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '500', desde: '2026-10-18'})], 'invalido', /fora da faixa/);
});

test('determinismo e histórico: aplicar três vezes dá o mesmo JSON; todo item do histórico tem verbo, antes e depois', () => {
  const eventos = [
    ev('ana', 'add_expense', 'g1', gasto({valorMinor: 10000, moeda: 'USD', pagoPor: 'ana'})),
    ev('ana', 'add_expense', 'g4', gasto({valorMinor: 5990, forma: 'pix_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa'})),
    ev('bia', 'check_expense', 'g1', null, {versao: 1}),
    ev('bia', 'reconcile_statement', 'f', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: 54980, itens: [{alvo: 'g1', versao: 2, faturaBrlMinor: 54980}]}),
    ev('bauer', 'record_settlement', 'ac-1', acerto({tipo: 'reembolso_empresa', de: 'empresa', para: 'ana', valorMinor: 5990, gastoIds: ['g4']})),
    ev('ana', 'confirm_settlement', 'ac-1'),
    ev('ana', 'add_plan', 'pl-1', plano()),
    ev('bia', 'confirm_plan', 'pl-1', null, {versao: 1}),
    ev('bia', 'record_payment', 'g-p', gasto({planoId: 'pl-1', ciclo: '2026-10', valorMinor: 1000, moeda: 'USD', pagoPor: 'bia'})),
    ev('ana', 'toggle_step', 's1', {feito: true}, {versao: 1}),
    ev('ana', 'set_balance', 'sd-1', {conta: 'PJ', data: '2026-10-18', valorMinor: 2176500, moeda: 'BRL', fonte: 'extrato'}),
    ev('ana', 'add_income', 'rc-1', receita()),
    ev('ana', 'set_parameter', 'fx', {chave: 'fx.USD_BRL', valor: '5.30', desde: '2026-10-18'}),
    ev('bauer', 'close_month', '2026-09', {cabeca: n, selo: SELO, totais: totais()}, {quando: NOV}),   // n: a posição do evento anterior
    ev('bauer', 'reopen_month', '2026-09', null, {quando: NOV, motivo: 'conferir'}),
    ev('ana', 'archive_plan', 'p-figma', {desde: '2026-10-01'}, {versao: 1, motivo: 'x'}),
    ev('ana', 'add_expense', 'g1', gasto()),
    {seq: Infinity, id: 'previa', membro: 'ana', conteudo: {acao: 'add_expense', alvo: 'g-prev', dados: gasto({pagoPor: 'ana'}), quando: OUT}},
  ];
  const um = JSON.stringify(aplicar(base, eventos));
  assert.equal(JSON.stringify(aplicar(base, eventos)), um);
  assert.equal(JSON.stringify(aplicar(base, eventos)), um);
  const a = aplicar(base, eventos);
  assert.equal(a.recusados.length, 1, JSON.stringify(a.recusados));
  for (const h of a.historico) {
    assert.equal(typeof h.verbo, 'string', h.acao);
    assert.ok('antes' in h && 'depois' in h, h.acao);
  }
  for (const chave of ['planos', 'passos', 'acertos', 'saldos', 'receitas', 'fechamentos']) assert.ok(chave in a, chave);
  // um registro malformado não derruba o fold: vira recusado
  const b = aplicar(base, [null, {seq: 1, id: 'z', membro: 'ana'}, ev('ana', 'add_expense', 'g1', 'texto'), ev('ana', 'reconcile_statement', 'f', {mes: '2026-10', forma: 'cartao_pj', itens: 'x'})]);
  assert.equal(b.recusados.length, 3);
});

// ── ajustes da revisão da F2-1 (um teste por achado do verificador) ───────────────────────────────────────────────────

test('ajuste 1 · record_payment: a competência é o mês do ciclo pago, então o custo não conta duas vezes', () => {
  const pag = (alvo, d = {}, extra) => ev('bia', 'record_payment', alvo, gasto({descricao: 'Google Workspace', valorMinor: 14000, data: '2026-11-02', planoId: 'p-google', ciclo: '2026-10', competencia: '2026-11', pagoPor: 'bia', ...d}), extra);
  const REGRA = /^A competência do pagamento é o mês do ciclo pago\.$/;
  // o ciclo de outubro pago com competência de novembro: outubro seguiria previsto e novembro contaria o mesmo custo
  const {a} = recusado([pag('g-x')], 'invalido', REGRA);
  assert.equal(a.gastos.length, 0);
  assert.ok(livroDoMes(base, a, '2026-10', '2026-10-19').linhas.some(x => x.tipo === 'previsto' && x.id === 'p-google'));
  assert.ok(!livroDoMes(base, a, '2026-11', '2026-11-03').linhas.some(x => x.tipo === 'realizado'));
  recusado([pag('g-x', {ciclo: '2026-11', competencia: '2026-10'})], 'invalido', REGRA);
  // com a competência no ciclo, o pagamento troca a previsão daquele mês (conta uma vez) e o mês seguinte segue previsto
  const b = aceito([pag('g-ok', {competencia: '2026-10', data: '2026-10-02'})]);
  const out = livroDoMes(base, b, '2026-10', '2026-10-19');
  assert.deepEqual(out.linhas.filter(x => x.id === 'g-ok' || x.id === 'p-google').map(x => x.tipo), ['realizado']);
  assert.equal(livroDoMes(base, b, '2026-11', '2026-11-03').linhas.find(x => x.id === 'p-google').tipo, 'previsto');
  // outubro fechado: pagar o ciclo de outubro cai na trava; com a competência em novembro, cai na regra nova
  const g1 = ev('ana', 'add_expense', 'g1', gasto({pagoPor: 'ana'}));
  const fecha = fechar(g1.seq);
  recusado([g1, fecha, pag('g-y', {competencia: '2026-10', data: '2026-10-02'}, {quando: NOV})], 'mes_fechado', /Outubro de 2026 está fechado/);
  recusado([g1, fecha, pag('g-y', {}, {quando: NOV})], 'invalido', REGRA);
  aceito([g1, fecha, pag('g-y', {ciclo: '2026-11'}, {quando: NOV})]);
});

test('ajuste 2 · registro sem versão é inválido (recarregar), não conflito com outra sócia', () => {
  const g1 = ev('ana', 'add_expense', 'g1', gasto({descricao: 'Canva', pagoPor: 'ana'}));
  const FALTA = /^Falta a versão do registro: recarregue o portal e tente de novo\.$/;
  for (const versao of [undefined, null, '1', 0, -1, 1.5, true, Infinity]) {
    const {r} = recusado([g1, ev('bia', 'check_expense', 'g1', null, {versao})], 'invalido', FALTA);
    assert.equal(r.atual, undefined, `sem registro atual: não abre o diálogo de conflito (${String(versao)})`);
  }
  // vale para toda coleção com versão: gasto, assinatura, passo, receita e cada item da fatura
  recusado([g1, ev('ana', 'edit_expense', 'g1', {valorMinor: 1200})], 'invalido', FALTA);
  recusado([g1, ev('ana', 'void_expense', 'g1', null, {motivo: 'duplicado'})], 'invalido', FALTA);
  recusado([g1, ev('bauer', 'mark_reimbursed', 'g1', null)], 'invalido', FALTA);
  recusado([ev('ana', 'edit_plan', 'p-figma', {status: 'pago'})], 'invalido', FALTA);
  recusado([ev('bia', 'confirm_plan', 'p-figma', null, {versao: '2'})], 'invalido', FALTA);
  recusado([ev('bia', 'toggle_step', 's1', {feito: true})], 'invalido', FALTA);
  recusado([ev('ana', 'add_income', 'rc-1', receita()), ev('ana', 'edit_income', 'rc-1', {transacoes: 41})], 'invalido', FALTA);
  recusado([ev('ana', 'add_expense', 'u1', gasto({valorMinor: 10000, moeda: 'USD'})),
    ev('bia', 'reconcile_statement', 'f', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: null, itens: [{alvo: 'u1', faturaBrlMinor: 54980}]})], 'invalido', FALTA);
  // 'versao' fica para a versão diferente de fato, com o registro atual
  const {r} = recusado([g1, ev('bia', 'check_expense', 'g1', null, {versao: 2})], 'versao', /Outra pessoa mudou este lançamento antes \(versão 1\)/);
  assert.equal(r.atual.versao, 1);
  aceito([g1, ev('bia', 'check_expense', 'g1', null, {versao: 1})]);
});

test('ajuste 3 · fechar o mês e informar saldo usam o menor entre o relógio do aparelho e o do servidor', () => {
  const g1 = ev('ana', 'add_expense', 'g1', gasto({pagoPor: 'ana'}));
  const comTs = (e, ts) => ({...e, ts});
  const AINDA = /^Só dá para fechar um mês que já terminou\.$/;
  // aparelho adiantado (diz 03/11) e servidor ainda em 31/10, 17h em São Paulo: outubro não terminou
  recusado([g1, comTs(fechar(g1.seq), '2026-10-31T20:00:00Z')], 'invalido', AINDA);
  // servidor em novembro e aparelho ainda em 31/10 (20h30 em São Paulo): vale o menor
  recusado([g1, comTs(fechar(g1.seq, {quando: '2026-10-31T23:30:00Z'}), NOV)], 'invalido', AINDA);
  // os dois em novembro (no treino o diário grava ts = quando); só o do servidor; só o do aparelho (a prévia)
  aceito([g1, comTs(fechar(g1.seq), NOV)]);
  aceito([g1, comTs(fechar(g1.seq), '2026-11-03T13:00:02Z')]);
  aceito([g1, comTs(fechar(g1.seq, {quando: undefined}), NOV)]);
  recusado([g1, comTs(fechar(g1.seq, {quando: undefined}), '2026-10-31T20:00:00Z')], 'invalido', AINDA);
  const a = aceito([g1, fechar(g1.seq)]);
  assert.equal(a.fechamentos['2026-10'].em, NOV, 'o horário guardado continua sendo o do registro');
  // saldo de 31/10: aparelho em 04/11 e servidor em 19/10 (ou o contrário) → a data ainda não chegou
  const sd = (extra, ts) => comTs(ev('bia', 'set_balance', 'sd-1', {conta: 'PJ', data: '2026-10-31', valorMinor: 2176500, moeda: 'BRL'}, extra), ts);
  const FUTURO = /^O saldo é de uma data que ainda não chegou\.$/;
  recusado([sd({quando: '2026-11-04T12:00:00Z'}, OUT)], 'invalido', FUTURO);
  recusado([sd({quando: OUT}, '2026-11-04T12:00:00Z')], 'invalido', FUTURO);
  aceito([sd({quando: '2026-11-04T12:00:00Z'}, '2026-11-04T12:00:01Z')]);
  aceito([sd({quando: undefined}, '2026-11-04T12:00:01Z')]);
  // um relógio ilegível não conta: vale o outro
  recusado([sd({quando: 'ontem'}, OUT)], 'invalido', FUTURO);
  aceito([sd({quando: 'ontem'}, '2026-11-04T12:00:01Z')]);
  recusado([g1, comTs(fechar(g1.seq, {quando: 'amanhã'}), '2026-10-31T20:00:00Z')], 'invalido', AINDA);
});

test('ajuste 4 · gasto com dia e mês de calendário; teto de 10^12 centavos em gastos, assinaturas e receitas', () => {
  const g = d => ev('ana', 'add_expense', 'g9', gasto({pagoPor: 'ana', ...d}));
  for (const data of ['2026-02-30', '2026-13-01', '2026-10-00', '2026-1-14', '14/10/2026', 20261014, null]) recusado([g({data})], 'invalido', /^Informe a data do gasto\.$/);
  for (const competencia of ['2026-13', '2026-00', '2026-1', '10/2026', 202610, null]) recusado([g({competencia})], 'invalido', /^Competência inválida\.$/);
  aceito([g({data: '2028-02-29', competencia: '2028-02'})]);
  const g1 = g({});
  recusado([g1, ev('ana', 'edit_expense', 'g9', {data: '2026-02-31'}, {versao: 1})], 'invalido', /data do gasto/);
  recusado([g1, ev('ana', 'edit_expense', 'g9', {competencia: '2026-13'}, {versao: 1})], 'invalido', /Competência inválida/);
  const TETO = 10 ** 12, ALTO = /^Valor alto demais: confira os zeros\.$/;
  // gastos (lançar, corrigir, marcar como paga; o valor e a fatura)
  aceito([g({valorMinor: TETO})]);
  recusado([g({valorMinor: TETO + 1})], 'invalido', ALTO);
  recusado([g({valorMinor: TETO + 1, moeda: 'USD'})], 'invalido', ALTO);
  recusado([g({moeda: 'USD', faturaBrlMinor: TETO + 1})], 'invalido', ALTO);
  recusado([g1, ev('ana', 'edit_expense', 'g9', {valorMinor: TETO + 1}, {versao: 1})], 'invalido', ALTO);
  recusado([ev('bia', 'record_payment', 'g-p', gasto({planoId: 'p-google', ciclo: '2026-10', valorMinor: TETO + 1, pagoPor: 'bia'}))], 'invalido', ALTO);
  // assinaturas
  aceito([ev('ana', 'add_plan', 'pl-9', plano({valorMinor: TETO}))]);
  recusado([ev('ana', 'add_plan', 'pl-9', plano({valorMinor: TETO + 1}))], 'invalido', ALTO);
  recusado([ev('ana', 'edit_plan', 'p-figma', {valorMinor: TETO + 1}, {versao: 1})], 'invalido', ALTO);
  // receitas: bruto, cancelados, taxas e as contagens
  aceito([ev('ana', 'add_income', 'rc-9', receita({brutoMinor: TETO, canceladosMinor: TETO, taxasMinor: TETO, transacoes: TETO}))]);
  for (const campo of ['brutoMinor', 'canceladosMinor', 'taxasMinor', 'transacoes', 'pagantesAtivos', 'pagantesNovos', 'pagantesPerdidos', 'testes', 'cadastros'])
    recusado([ev('ana', 'add_income', 'rc-9', receita({[campo]: TETO + 1}))], 'invalido', ALTO);
  recusado([ev('ana', 'add_income', 'rc-1', receita()), ev('ana', 'edit_income', 'rc-1', {brutoMinor: TETO + 1}, {versao: 1})], 'invalido', ALTO);
  // o mesmo teto nos outros valores do diário: acerto, saldo e fatura
  recusado([ev('ana', 'record_settlement', 'ac-9', acerto({valorMinor: TETO + 1}))], 'invalido', ALTO);
  recusado([ev('ana', 'set_balance', 'sd-9', {conta: 'PJ', data: '2026-10-18', valorMinor: TETO + 1, moeda: 'BRL'})], 'invalido', ALTO);
  const u1 = ev('ana', 'add_expense', 'u1', gasto({valorMinor: 10000, moeda: 'USD'}));
  recusado([u1, ev('bia', 'reconcile_statement', 'f', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: null, itens: [{alvo: 'u1', versao: 1, faturaBrlMinor: TETO + 1}]})], 'invalido', ALTO);
  recusado([u1, ev('bia', 'reconcile_statement', 'f', {mes: '2026-10', forma: 'cartao_pj', totalFaturaMinor: TETO + 1, itens: [{alvo: 'u1', versao: 1, faturaBrlMinor: 54980}]})], 'invalido', ALTO);
  // no teto, o livro do mês soma e converte sem sair dos inteiros seguros
  const a = aceito([g({valorMinor: TETO}), ev('ana', 'add_expense', 'g10', gasto({valorMinor: TETO, moeda: 'USD', pagoPor: 'ana'}))]);
  const l = livroDoMes(base, a, '2026-10', '2026-10-19');
  assert.ok(Number.isSafeInteger(l.total) && l.total > 2 * TETO, String(l.total));
});

test('"Lançar pagamento" (add_expense com planoId) segue as regras do record_payment: ciclo pago, encerrada, inexistente', () => {
  n = 0;
  const pag = (alvo, d = {}) => ev('bia', 'add_expense', alvo, gasto({descricao: 'Google Workspace', valorMinor: 14000, data: '2026-10-02', planoId: 'p-google', pagoPor: 'bia', ...d}));
  const primeiro = pag('g-pg1');
  aceito([primeiro]);
  recusado([primeiro, pag('g-pg2')], 'repetido', /já foi marcada como paga em outubro/);
  // o mesmo ciclo pelo outro caminho também conta
  recusado([ev('bia', 'record_payment', 'g-rp', gasto({valorMinor: 14000, data: '2026-10-02', planoId: 'p-google', ciclo: '2026-10', pagoPor: 'bia'})), pag('g-pg3')], 'repetido');
  // outro mês é outro ciclo
  aceito([primeiro, pag('g-pg4', {data: '2026-11-02', competencia: '2026-11'})]);
  recusado([pag('g-pg5', {planoId: 'p-apple', descricao: 'Apple Developer', moeda: 'USD', valorMinor: 9900})], 'invalido', /encerrada/);
  recusado([pag('g-pg6', {planoId: 'p-nao-existe'})], 'invalido', /Escolha a assinatura/);
  // anular o primeiro libera o ciclo
  aceito([primeiro, ev('bia', 'void_expense', 'g-pg1', {}, {versao: 1, motivo: 'lançado em dobro'}), pag('g-pg7')]);
});

test('reembolso de gasto de mês fechado vale pelo câmbio congelado no fechamento, não pelo dólar novo', () => {
  n = 0;
  const g = ev('ana', 'add_expense', 'g-usd', gasto({descricao: 'Anthropic API', valorMinor: 10000, moeda: 'USD', forma: 'cartao_pessoal', pagoPor: 'ana', destino: 'empresa_reembolsa'}));
  const fecha = fechar(g.seq);
  const dolarNovo = ev('bauer', 'set_parameter', 'fx.USD_BRL', {chave: 'fx.USD_BRL', valor: '6.0000', desde: '2026-10-01', fonte: 'PTAX corrigida', estado: 'vigente'}, {quando: NOV});
  const antes = aceito([g, fecha, dolarNovo]);
  assert.ok(antes.fechamentos['2026-10'].fechado);
  const congelada = R.parametros(antes).filter(p => p.semente || p.ordem < antes.fechamentos['2026-10'].ordemParametros);
  const gasto0 = antes.gastos.find(x => x.id === 'g-usd');
  const devido = R.reaisDoGasto(gasto0, congelada).brl, peloNovo = R.reaisDoGasto(gasto0, R.parametros(antes)).brl;
  assert.notEqual(devido, peloNovo, 'o dólar novo mudaria o valor');
  const reembolso = v => ev('bauer', 'record_settlement', 'ac-r1', acerto({tipo: 'reembolso_empresa', de: 'empresa', para: 'ana', valorMinor: v, gastoIds: ['g-usd']}), {quando: NOV});
  aceito([g, fecha, dolarNovo, reembolso(devido)]);
  recusado([g, fecha, dolarNovo, reembolso(peloNovo)], 'invalido', /não bate/);
});
