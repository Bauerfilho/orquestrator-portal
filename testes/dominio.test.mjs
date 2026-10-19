// node --test testes/ — o snapshot do domain.js com o diário (fase 2, fatia F2-5): Assinaturas e Vender primeiro passam a
// refletir o diário pelo estado efetivo (razao.js), sem reescrever as páginas antigas. Sem eventos, os blocos saem iguais
// aos de antes, exceto as mudanças combinadas (produtos sem o corte em 3; §8.1 plano inativo sem "sua parte" e sem
// próxima data; autoria e versão só quando há dado). Com eventos: plano novo, confirmado, encerrado e pago, com autora.
// Dados fictícios. Plano: docs/PLANO-FASES-2-3.md (F2-5) e PLANO-PORTAL.md §3.8, §3.10, §4.3 e §8.1.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildSnapshot, validateState, planSchedule, allocateMinor, applyMutation} from '../domain.js';
import * as R from '../razao.js';

const HOJE = '2026-10-19';
const BASE = {
  schemaVersion: 1, revision: 7, updatedAt: '2026-10-18T20:30:00.000Z', charges: null, benefits: [],
  staticBlocks: {cash: {text: 'Caixa de exemplo.', columns: [], rows: []}, society: {text: ''}},
  members: [
    {id: 'm-bauer', displayName: 'Bauer', participationPct: 40, role: 'owner'},
    {id: 'm-ana', displayName: 'Ana Ribeiro', participationPct: 30, role: 'member'},
    {id: 'm-bia', displayName: 'Beatriz Lima', participationPct: 30, role: 'member'},
  ],
  plans: [
    {id: 'claude-max', servico: 'Claude', plano: 'Max 20x', amountMinor: 20000, currency: 'USD', period: 'mensal', monthlyDay: 22, status: 'a vencer', paymentStatus: 'a_vencer', subscriptionState: 'active', confirmed: true},
    {id: 'vercel-pro', servico: 'Vercel', plano: 'Pro', amountMinor: 2000, currency: 'USD', period: 'mensal', nextDate: '2026-10-14', monthlyDay: 14, status: 'a pagar', paymentStatus: 'a_pagar', subscriptionState: 'active', confirmed: true},
    {id: 'workspace', servico: 'Google Workspace', plano: 'Business Starter', amountMinor: 8400, currency: 'BRL', period: 'mensal', monthlyDay: 1, status: 'pago', paymentStatus: 'pago', subscriptionState: 'active', confirmed: true},
    {id: 'apple-dev', servico: 'Apple Developer', plano: 'Programa anual', amountMinor: 9900, currency: 'USD', period: 'anual', nextDate: '2027-05-10', status: 'pago', paymentStatus: 'pago', subscriptionState: 'active', confirmed: true},
    {id: 'hotmart', servico: 'Hotmart', plano: 'Taxa por venda', amountMinor: null, currency: 'BRL', period: 'por venda', status: 'a confirmar', paymentStatus: '', subscriptionState: 'unconfirmed', confirmed: false},
    {id: 'figma', servico: 'Figma', plano: 'Professional', amountMinor: 1500, currency: 'USD', period: 'mensal', monthlyDay: 9, status: 'cancelado em setembro', paymentStatus: 'isento', subscriptionState: 'inactive', confirmed: true},
    {id: 'dominio', servico: 'Registro.br', plano: 'Domínio', amountMinor: 4000, currency: 'BRL', period: 'anual', nextDate: '2026-10-25', status: 'parado', paymentStatus: 'a_pagar', subscriptionState: 'inactive', confirmed: true},
  ],
  selling: {text: 'Cinco frentes.', columns: [], rows: [], steps: ['Med Painel', 'Bulário de bolso', 'Mentoria de prova', 'Curso de ECG', 'Atlas de imagem']
    .flatMap((produto, k) => [1, 2].map(j => ({id: `p${k + 1}-${j}`, product: produto, text: `Passo ${j} de ${produto}`, checked: j === 1 && k % 2 === 0})))},
};
const BASE_JSON = JSON.stringify(BASE);
const membro = id => BASE.members.find(m => m.id === id);
const snap = (estado, id = 'm-ana', hoje = HOJE) => buildSnapshot(estado, membro(id), hoje);
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');

// Impressão digital dos blocos de ANTES desta fatia (domain.js da onda 3, mesmo BASE, 19/10/2026). Para conferir à mão:
// git show 28bbae0:domain.js > /tmp/d.mjs e buildSnapshot(BASE, membro, '2026-10-19').blocks com ele.
const ANTES = {
  'm-bauer': '4cac60550fee081e9bc53711f523503f22a2dfd7ad7460bb65d1155ef2a8c511',
  'm-ana': '95b35a2d930e3baf650c4d9e67cb5cf458f378a9135ce6268089eff8c81f97f1',
  'm-bia': '707c3640c1f5ee518576322ce0b0f6f86700c389e7bdbc388109e13106326aed',
};
// Desfaz SÓ as mudanças combinadas, recalculando o que o domínio antigo publicava com as funções que ele exporta: a parte
// da sócia, a próxima data e o aviso de vencimento do plano inativo (e a contagem de "vence em 7 dias" que saía deles),
// a prévia de cobranças que saía da próxima data e o corte em 3 produtos.
function comoAntes(blocks, estado, id) {
  const b = structuredClone(blocks);
  const pcts = estado.members.map(m => m.participationPct), k = estado.members.findIndex(m => m.id === id);
  for (const p of b.user.plans) {
    if (p.subscription_state !== 'inactive') continue;
    const row = estado.plans[p.index], s = planSchedule(row, HOJE), casas = 10 ** p.minor_unit_digits;
    const parte = minor => minor === null ? null : allocateMinor(minor, pcts)[k];
    const pendente = ['due', 'overdue'].includes(p.payment_status), delta = s.due ? (Date.parse(s.due + 'T12:00:00Z') - Date.parse(HOJE + 'T12:00:00Z')) / 864e5 : null;
    Object.assign(p, {proxima_data: s.due, schedule_derived: s.derived, schedule_issue: s.issue, personal_amount_minor: parte(p.amount_minor),
      due_soon: !!(pendente && delta !== null && delta >= 0 && delta <= 7), overdue: !!(pendente && delta !== null && delta < 0)});
    p.personal_amount = p.personal_amount_minor === null ? null : p.personal_amount_minor / casas;
    p.personal_monthly_amount = p.monthly_amount_minor === null ? null : parte(p.monthly_amount_minor) / casas;
  }
  b.user.billing.charges = b.user.plans.filter(p => p.proxima_data).map(p => ({id: `previsao-${p.id}`, subscription_id: p.id, servico: p.servico, plano: p.plano, valor: p.valor, moeda: p.moeda, due_date: p.proxima_data, personal_amount: p.personal_amount, amount_minor: p.amount_minor, personal_amount_minor: p.personal_amount_minor, payment_status: p.payment_status, confirmed: p.confirmed, estimated_from_plan: true, schedule_derived: p.schedule_derived, monthly_day: p.monthly_day, due_soon: p.due_soon, overdue: p.overdue}));
  b.user.summary.due_soon = b.user.plans.filter(p => p.due_soon).length;
  b.user.summary.overdue = b.user.plans.filter(p => p.overdue).length;
  b.sell_first.products = b.sell_first.products.slice(0, 3);
  return b;
}
const NOVOS = ['version', 'created_at', 'created_by_nome', 'changed_at', 'changed_by_nome', 'confirmed_at', 'confirmed_by_nome', 'archived_since', 'archived_by_nome', 'archive_reason', 'paid_cycle', 'checked_at', 'checked_by_nome'];

let n = 0;
const QUANDO = '2026-10-19T12:00:00Z';
const ev = (membroId, acao, alvo, dados, extra = {}) => ({seq: ++n, id: 'e' + n, membro: membroId, conteudo: {acao, alvo, dados, quando: QUANDO, ...extra}});
const efetivo = (eventos, hoje = HOJE) => {
  const a = R.aplicar(BASE, eventos);
  assert.deepEqual(a.recusados, [], 'nenhum evento do teste deveria ser recusado');
  return R.estadoEfetivo(BASE, a, hoje);
};

test('sem eventos, os blocos saem iguais aos de antes, exceto as mudanças combinadas', () => {
  for (const id of Object.keys(ANTES)) {
    const atual = snap(BASE, id).blocks;
    assert.equal(sha(comoAntes(atual, BASE, id)), ANTES[id], `blocos de ${id} mudaram além do combinado`);
    // pelo estado efetivo de um diário vazio (o caminho das pontes) sai exatamente o mesmo
    assert.deepEqual(buildSnapshot(R.estadoEfetivo(BASE, R.aplicar(BASE, []), HOJE), membro(id), HOJE).blocks, atual);
  }
  assert.equal(JSON.stringify(BASE), BASE_JSON, 'o estado do pacote não é alterado');
});

test('sem eventos, nenhum campo novo de autoria ou versão aparece (só quando há dado)', () => {
  const {blocks} = snap(BASE);
  for (const p of blocks.user.plans) for (const k of NOVOS) assert.equal(Object.hasOwn(p, k), false, `${p.id}.${k}`);
  for (const s of blocks.sell_first.steps) for (const k of NOVOS) assert.equal(Object.hasOwn(s, k), false, `${s.id}.${k}`);
});

test('§8.1: plano inativo sai sem "sua parte" e sem próxima data, e some da prévia de cobranças', () => {
  const {blocks} = snap(BASE, 'm-bauer');
  for (const id of ['figma', 'dominio']) {
    const p = blocks.user.plans.find(x => x.id === id);
    assert.equal(p.subscription_state, 'inactive');
    assert.equal(p.personal_amount, null); assert.equal(p.personal_amount_minor, null); assert.equal(p.personal_monthly_amount, null);
    assert.equal(p.proxima_data, null); assert.equal(p.schedule_derived, false); assert.equal(p.due_soon, false); assert.equal(p.overdue, false);
    assert.ok(!blocks.user.billing.charges.some(c => c.subscription_id === id), `${id} ainda aparece nas cobranças previstas`);
  }
  // o valor da empresa e o dia mensal continuam: são dados do plano, não cobrança
  const figma = blocks.user.plans.find(x => x.id === 'figma');
  assert.equal(figma.amount_minor, 1500); assert.equal(figma.monthly_day, 9);
  // a ativa segue com a parte dela e a data prevista
  const claude = blocks.user.plans.find(x => x.id === 'claude-max');
  assert.equal(claude.personal_amount_minor, 8000); assert.equal(claude.proxima_data, '2026-10-22');
  assert.ok(blocks.user.billing.charges.some(c => c.subscription_id === 'claude-max'));
});

test('Vender primeiro: os 5 produtos, sem o corte em 3, na ordem em que aparecem', () => {
  const {products, steps} = snap(BASE).blocks.sell_first;
  assert.equal(products.length, 5);
  assert.deepEqual(products.map(p => p.name), ['Med Painel', 'Bulário de bolso', 'Mentoria de prova', 'Curso de ECG', 'Atlas de imagem']);
  assert.ok(products.every(p => p.steps.length === 2));
  assert.equal(steps.length, 10);
  assert.deepEqual(products.map(p => p.steps.filter(s => s.checked).length), [1, 0, 1, 0, 1]);
});

test('com eventos: plano novo, confirmado, encerrado e pago, cada um com a autora e a data', () => {
  const eventos = [
    ev('m-ana', 'add_plan', 'pl-canva', {servico: 'Canva', plano: 'Pro', valorMinor: 3490, moeda: 'BRL', periodo: 'mensal', diaVencimento: 12, proximaData: null, categoria: 'marketing', status: ''}, {quando: '2026-10-17T13:00:00Z'}),
    ev('m-bia', 'confirm_plan', 'pl-canva', null, {versao: 1, quando: '2026-10-18T14:00:00Z'}),
    ev('m-bauer', 'record_payment', 'g-canva', {data: '2026-10-19', competencia: '2026-10', descricao: 'Canva · Pro', categoria: 'marketing', valorMinor: 3490, moeda: 'BRL', forma: 'cartao_pj', pagoPor: 'm-bauer', planoId: 'pl-canva', ciclo: '2026-10'}),
    ev('m-bauer', 'reactivate_plan', 'figma', null, {versao: 1, quando: '2026-10-19T10:00:00Z'}),
    ev('m-ana', 'archive_plan', 'figma', {desde: '2026-10-19'}, {versao: 2, motivo: 'trocamos pelo Canva', quando: '2026-10-19T11:00:00Z'}),
    ev('m-ana', 'edit_plan', 'claude-max', {status: 'nota de outubro conferida'}, {versao: 1, quando: '2026-10-17T09:00:00Z'}),
    ev('m-bia', 'toggle_step', 'p2-1', {feito: true}, {versao: 1, quando: '2026-10-18T16:00:00Z'}),
  ];
  const ef = efetivo(eventos);
  assert.equal(validateState(ef), true);
  const antes = snap(BASE);
  const s = snap(ef);
  assert.notEqual(s.content_revision, antes.content_revision, 'o diário muda o content_revision (o ciclo de 2 s redesenha)');
  const p = id => s.blocks.user.plans.find(x => x.id === id);

  const canva = p('pl-canva');
  assert.equal(canva.servico, 'Canva'); assert.equal(canva.confirmed, true); assert.equal(canva.subscription_state, 'active');
  assert.equal(canva.created_by_nome, 'Ana Ribeiro'); assert.equal(canva.created_at, '2026-10-17T13:00:00Z');
  assert.equal(canva.confirmed_by_nome, 'Beatriz Lima'); assert.equal(canva.confirmed_at, '2026-10-18T14:00:00Z');
  assert.equal(canva.changed_by_nome, 'Beatriz Lima', 'a última alteração foi a confirmação');
  assert.equal(canva.version, 2);
  assert.equal(canva.payment_status, 'paid'); assert.equal(canva.paid_cycle, '2026-10'); assert.equal(canva.proxima_data, '2026-11-12');
  assert.equal(canva.personal_amount_minor, 1047, 'Ana: 30% de R$ 34,90 pelo maior resto');

  const figma = p('figma');
  assert.equal(figma.subscription_state, 'inactive'); assert.equal(figma.version, 3);
  assert.equal(figma.archived_since, '2026-10-19'); assert.equal(figma.archived_by_nome, 'Ana Ribeiro'); assert.equal(figma.archive_reason, 'trocamos pelo Canva');
  assert.equal(figma.changed_by_nome, 'Ana Ribeiro');
  assert.equal(figma.personal_amount, null); assert.equal(figma.proxima_data, null);

  const claude = p('claude-max');
  assert.equal(claude.status, 'nota de outubro conferida'); assert.equal(claude.changed_by_nome, 'Ana Ribeiro'); assert.equal(claude.changed_at, '2026-10-17T09:00:00Z');
  assert.equal(claude.confirmed, true, 'mudar só o status não tira a confirmação');

  const passo = s.blocks.sell_first.steps.find(x => x.id === 'p2-1');
  assert.equal(passo.checked, true); assert.equal(passo.checked_by_nome, 'Beatriz Lima'); assert.equal(passo.checked_at, '2026-10-18T16:00:00Z'); assert.equal(passo.version, 2);
  assert.equal(s.blocks.sell_first.products[1].steps.filter(x => x.checked).length, 1);
  // quem não teve evento segue sem autoria
  assert.equal(Object.hasOwn(p('workspace'), 'changed_by_nome'), false);
  assert.equal(Object.hasOwn(s.blocks.sell_first.steps.find(x => x.id === 'p1-1'), 'checked_by_nome'), false);
  // o previsto do mês (razão) conta a Canva só depois de confirmada, e a tira quando paga
  const prevista = evs => R.livroDoMes(BASE, R.aplicar(BASE, evs), '2026-10', HOJE).linhas.some(l => l.tipo === 'previsto' && l.id === 'pl-canva');
  assert.equal(prevista(eventos.slice(0, 1)), false, 'a confirmar: fora do previsto');
  assert.equal(prevista(eventos.slice(0, 2)), true, 'confirmada: entra no previsto');
  assert.equal(prevista(eventos.slice(0, 3)), false, 'paga: sai do previsto (vira gasto realizado)');
});

test('desmarcar um passo tira o "marcado por"; um encerramento futuro aparece com a assinatura ainda ativa', () => {
  const ef = efetivo([
    ev('m-bia', 'toggle_step', 'p1-1', {feito: false}, {versao: 1}),
    ev('m-ana', 'archive_plan', 'claude-max', {desde: '2026-12-01'}, {versao: 1, motivo: 'migrar para a API'}),
  ]);
  const s = snap(ef);
  const passo = s.blocks.sell_first.steps.find(x => x.id === 'p1-1');
  assert.equal(passo.checked, false); assert.equal(Object.hasOwn(passo, 'checked_by_nome'), false); assert.equal(passo.version, 2);
  const claude = s.blocks.user.plans.find(x => x.id === 'claude-max');
  assert.equal(claude.subscription_state, 'active'); assert.equal(claude.archived_since, '2026-12-01'); assert.equal(claude.personal_amount_minor, 6000);
  assert.equal(snap(R.estadoEfetivo(BASE, R.aplicar(BASE, [ev('m-ana', 'archive_plan', 'claude-max', {desde: '2026-12-01'}, {versao: 1, motivo: 'x'})]), '2026-12-02'), 'm-ana', '2026-12-02').blocks.user.plans.find(x => x.id === 'claude-max').subscription_state, 'inactive');
});

test('autoria gravada pelo caminho antigo (applyMutation) também aparece, com o nome do cadastro e nunca o id', () => {
  const pagina = membro('m-ana');
  let estado = applyMutation(BASE, 'edit_plan', {index: 0, values: {status: 'conferido'}, expected_revision: 'r7'}, pagina, HOJE).state;
  estado = applyMutation(estado, 'toggle_step', {index: 2, checked: true, expected_revision: 'r8'}, membro('m-bia'), HOJE).state;
  const s = buildSnapshot(estado, pagina, HOJE).blocks;
  assert.equal(s.user.plans[0].changed_by_nome, 'Ana Ribeiro');
  const passo = s.sell_first.steps[2];
  assert.equal(passo.checked, true); assert.equal(passo.checked_by_nome, 'Beatriz Lima'); assert.ok(passo.checked_at);
  // sócia que não está no cadastro: nada de id cru na tela
  const fantasma = structuredClone(BASE); fantasma.plans[0].changedBy = 'm-quem'; fantasma.plans[0].changedAt = QUANDO;
  const plano = buildSnapshot(fantasma, pagina, HOJE).blocks.user.plans[0];
  assert.equal(Object.hasOwn(plano, 'changed_by_nome'), false); assert.equal(plano.changed_at, QUANDO);
});

test('as pontes dobram o diário a cada 2 s: 1.000 eventos cabem folgados (fold + estado efetivo + snapshot)', () => {
  const quem = ['m-bauer', 'm-ana', 'm-bia'], versao = {}, eventos = [];
  for (let k = 0; k < 1000; k++) {
    const m = quem[k % 3], t = k % 10;
    if (t < 6) eventos.push(ev(m, 'add_expense', 'g-' + k, {data: '2026-10-' + String(1 + k % 18).padStart(2, '0'), competencia: '2026-10', descricao: 'Gasto ' + k, categoria: 'software_ia', valorMinor: 1000 + k, moeda: k % 4 ? 'BRL' : 'USD', forma: 'cartao_pj', pagoPor: m}));
    else if (t === 6) { const s = 'p' + (1 + k % 5) + '-1'; versao[s] = versao[s] || 1; eventos.push(ev(m, 'toggle_step', s, {feito: k % 20 < 10}, {versao: versao[s]++})); }
    else if (t === 7) eventos.push(ev(m, 'add_plan', 'pl-' + k, {servico: 'Serviço ' + k, plano: 'Plano', valorMinor: 1000, moeda: 'BRL', periodo: 'mensal', diaVencimento: 5, proximaData: null, categoria: 'software_ia', status: ''}));
    else if (t === 8) { versao.claude = versao.claude || 1; eventos.push(ev(m, 'edit_plan', 'claude-max', {status: 'nota ' + k}, {versao: versao.claude++})); }
    else eventos.push(ev(m, 'record_payment', 'rp-' + k, {data: '2026-10-05', competencia: '2026-10', descricao: 'Pagamento', categoria: 'software_ia', valorMinor: 1000, moeda: 'BRL', forma: 'cartao_pj', pagoPor: m, planoId: 'pl-' + (k - 2), ciclo: '2026-10'}));
  }
  const rodar = () => { const a = R.aplicar(BASE, eventos); return {a, s: buildSnapshot(R.estadoEfetivo(BASE, a, HOJE), membro('m-ana'), HOJE)}; };
  rodar();   // aquece o JIT
  const t0 = performance.now();
  const {a, s} = rodar();
  const ms = performance.now() - t0;
  assert.equal(a.recusados.length, 0);
  assert.equal(s.blocks.user.plans.length, BASE.plans.length + 100);
  assert.ok(ms < 250, `1.000 eventos levaram ${ms.toFixed(1)} ms (a ponte guarda o resultado e só refaz quando o diário muda)`);
});
