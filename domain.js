/** Finance domain, independent of Sites/D1/HTTP. All persistent money is integer minor units. */
export class DomainError extends Error {
  constructor(message, code = 'invalid_request') { super(message); this.name = 'DomainError'; this.code = code; }
}

export const MINOR_DIGITS = Object.freeze({BRL: 2, USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, CHF: 2, JPY: 0, KRW: 0, CLP: 0, BHD: 3, KWD: 3});
const PERIODS = {mensal: [1, 1], mes: [1, 1], monthly: [1, 1], anual: [1, 12], ano: [1, 12], yearly: [1, 12], trimestral: [1, 3], semestral: [1, 6], semanal: [52, 12], quinzenal: [26, 12], diario: [365, 12]};
const FORBIDDEN_KEYS = new Set(['cpf', 'senha', 'password', 'hash', 'token', 'secret', 'api_key', 'apikey', 'access_token', 'refresh_token', 'auth_token', 'credential', 'credentials', 'path', 'file_path', 'local_path', 'root', 'users_path', 'records_path']);
const MUTATIONS = new Set(['toggle_step', 'edit_plan', 'set_subscription']);
const STATICS = ['inventory', 'cash', 'projection', 'society', 'atlas'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => Array.isArray(value) ? value : [];
const normalized = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const safeInteger = value => Number.isSafeInteger(value);
const amount = value => value === null || value === undefined ? null : safeInteger(value) ? value : null;
const display = (minor, coin) => minor === null || minor === undefined || MINOR_DIGITS[coin] === undefined ? null : minor / 10 ** MINOR_DIGITS[coin];
const fail = (message, code) => { throw new DomainError(message, code); };
const knownCurrency = coin => Object.hasOwn(MINOR_DIGITS, coin);

export function safeText(value) {
  let text = String(value ?? '');
  text = text.replace(/\s*<!-- painel-passo-\d+:.*? -->/g, '');
  text = text.replace(/scrypt\$[0-9a-f]+\$[0-9a-f]+/gi, '[verificador privado omitido]');
  text = text.replace(/(?<!\d)(?:\d{3}[. -]?\d{3}[. -]?\d{3}[- ]?\d{2})(?!\d)/g, '[dado pessoal omitido]');
  text = text.replace(/(?:file:\/\/)?\/(?:Users|home|private|var|tmp|Volumes)\/[^\s<>"']+/g, '[caminho local omitido]');
  text = text.replace(/~\/[^\s<>"']+/g, '[caminho local omitido]');
  if (/^https?:\/\//i.test(text)) {
    try { const url = new URL(text); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; text = url.toString(); }
    catch { return '[endereço inválido omitido]'; }
  }
  return text;
}

/** Defense in depth for already curated static data; not a substitute for export review. */
export function sanitizePublic(value, depth = 0) {
  if (depth > 40) return fail('Dados excedem a profundidade suportada; revise a exportação.', 'invalid_state');
  if (typeof value === 'string') return safeText(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length > 10000) return fail('Lista excede o tamanho suportado; revise a exportação.', 'invalid_state');
    return value.map(item => sanitizePublic(item, depth + 1));
  }
  if (record(value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(normalized(key)) || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      result[safeText(key)] = sanitizePublic(item, depth + 1);
    }
    return result;
  }
  return null;
}

function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(value + 'T12:00:00.000Z');
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function civilDate(today) {
  if (typeof today === 'string' && isoDate(today)) return today;
  if (today instanceof Date && Number.isFinite(today.valueOf())) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(today).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  return fail('Informe uma data civil válida para calcular o painel.', 'invalid_date');
}

const daysBetween = (a, b) => (Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000;
const stamp = today => today instanceof Date ? today.toISOString() : civilDate(today) + 'T12:00:00.000Z';

function percent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return null;
  // Eight fractional decimal places allow fractional shares without binary-float allocation.
  const scaled = Math.round(value * 100000000);
  if (Math.abs(scaled / 100000000 - value) > 1e-10) return null;
  return BigInt(scaled);
}

const PERCENT_DENOMINATOR = 10000000000n;
function roundedRatio(numerator, denominator) {
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator * sign;
  const result = sign * ((absolute + denominator / 2n) / denominator);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) return null;
  return Number(result);
}

export function allocateMinor(total, shares) {
  if (!safeInteger(total) || !Array.isArray(shares) || !shares.length) return null;
  const weights = shares.map(percent);
  if (weights.includes(null) || weights.reduce((sum, value) => sum + value, 0n) !== PERCENT_DENOMINATOR) return null;
  const sign = total < 0 ? -1 : 1;
  const magnitude = BigInt(Math.abs(total));
  const exact = weights.map(value => magnitude * value);
  const whole = exact.map(value => value / PERCENT_DENOMINATOR);
  let remaining = magnitude - whole.reduce((sum, value) => sum + value, 0n);
  const order = exact.map((value, index) => ({index, remainder: value % PERCENT_DENOMINATOR})).sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const {index} of order) { if (!remaining) break; whole[index]++; remaining--; }
  return whole.map(value => sign * Number(value));
}

function identity(state, member) {
  if (!record(member) || typeof member.id !== 'string' || !member.id || !['owner', 'member'].includes(member.role)) return fail('Entre com uma conta autorizada.', 'unauthenticated');
  const matches = list(state.members).filter(row => row.id === member.id);
  if (matches.length !== 1 || !['owner', 'member'].includes(matches[0].role)) return fail('A conta não pertence a este painel.', 'forbidden');
  // Caller supplies authenticated membership; canonical state supplies the allocation.
  const selected = matches[0];
  const shares = state.members.map(row => row.participationPct);
  const share = percent(selected.participationPct) === null ? null : selected.participationPct;
  const balanced = new Set(state.members.map(row => row.id)).size === state.members.length && shares.length > 0 && shares.map(percent).every(value => value !== null) && shares.map(percent).reduce((sum, value) => sum + value, 0n) === PERCENT_DENOMINATOR;
  return {selected, shares, share, balanced, index: state.members.findIndex(row => row.id === member.id)};
}

function personalMinor(value, context) {
  if (value === null || context.share === null || !context.balanced) return null;
  return allocateMinor(value, context.shares)[context.index];
}

function assertState(state) {
  if (!record(state) || state.schemaVersion !== 1 || !safeInteger(state.revision) || state.revision < 0) return fail('Estado financeiro inválido.', 'invalid_state');
  for (const name of ['members', 'plans', 'benefits']) if (!Array.isArray(state[name]) || state[name].length > 10000) return fail('Estado financeiro inválido.', 'invalid_state');
  if (state.charges !== null && !Array.isArray(state.charges)) return fail('Registros de cobranças inválidos.', 'invalid_state');
  if (!record(state.selling) || !Array.isArray(state.selling.steps) || !record(state.staticBlocks)) return fail('Blocos do painel inválidos.', 'invalid_state');
  for (const rows of [state.plans, state.charges ?? [], state.benefits, state.members, state.selling.steps]) {
    if (rows.length > 10000 || rows.some(row => !record(row) || typeof row.id !== 'string' || !row.id)) return fail('Registro financeiro inválido.', 'invalid_state');
  }
  for (const row of [...state.plans, ...(state.charges ?? []), ...state.benefits]) {
    for (const key of ['amountMinor', 'balanceMinor']) if (row[key] !== undefined && row[key] !== null && !safeInteger(row[key])) return fail('Valor monetário inválido: use inteiros em centavos.', 'invalid_state');
  }
  for (const plan of state.plans) if (plan.paymentStatusExplicit !== undefined && typeof plan.paymentStatusExplicit !== 'boolean') return fail('Origem do estado da cobrança inválida.', 'invalid_state');
  return state;
}

export function validateState(state) { assertState(state); return true; }

function contentTag(text) {
  // Two independent 32-bit accumulators: a cache validator, never an auth token.
  let first = 2166136261, second = 5381;
  for (let i = 0; i < text.length; i++) { first = Math.imul(first ^ text.charCodeAt(i), 16777619); second = Math.imul(second, 33) ^ text.charCodeAt(i); }
  return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0');
}

function source(state, exists = true) {
  const candidate = state.sourceInfo?.updatedAt ?? state.updatedAt;
  const updated = typeof candidate === 'string' && Number.isFinite(Date.parse(candidate)) ? candidate : null;
  return {exists, updated_at: updated, stale: false, status: exists ? 'estado compartilhado' : 'sem entrega ainda', revision: `r${state.revision}`};
}

export function planSchedule(plan, today) {
  const day = Number.isInteger(plan.monthlyDay) && plan.monthlyDay >= 1 && plan.monthlyDay <= 31 ? plan.monthlyDay : null;
  if (plan.nextDate !== undefined && plan.nextDate !== null && plan.nextDate !== '') {
    const due = isoDate(plan.nextDate);
    return {due, derived: false, day, issue: due ? '' : 'Próxima data preenchida é inválida; data a confirmar.'};
  }
  if (!['mensal', 'mes', 'monthly'].includes(normalized(plan.period))) return {due: null, derived: false, day, issue: 'Próxima data não informada; data a confirmar.'};
  if (day === null) return {due: null, derived: false, day, issue: 'Dia mensal de vencimento não informado ou inválido; informe um inteiro de 1 a 31.'};
  let [year, month, current] = today.split('-').map(Number);
  if (day < current) { month++; if (month > 12) { month = 1; year++; } }
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const due = isoDate(date);
  return {due, derived: !!due, day, issue: due ? '' : `O dia ${day} não existe em ${String(month).padStart(2, '0')}/${year}; data a confirmar.`};
}

function paymentStatus(value, due, today) {
  const state = normalized(value);
  if (['paid', 'pago', 'paga'].includes(state)) return 'paid';
  if (['exempt', 'isento', 'isenta'].includes(state)) return 'exempt';
  if (['overdue', 'vencido', 'vencida'].includes(state)) return 'overdue';
  if (['due', 'a_pagar', 'a_vencer', 'pendente', 'unpaid'].includes(state)) return due && due < today ? 'overdue' : 'due';
  return 'unconfirmed';
}
function legacyPaymentStatus(value, due, today) {
  const legacy = normalized(value);
  return ['pago', 'paga', 'paid', 'isento', 'isenta', 'exempt', 'vencida', 'vencido', 'overdue', 'a_pagar', 'a_vencer', 'due'].includes(legacy) ? paymentStatus(legacy, due, today) : 'unconfirmed';
}
const activity = plan => ['active', 'inactive'].includes(plan.subscriptionState) ? plan.subscriptionState : 'unconfirmed';
const add = (target, key, value) => { const next = (target[key] ?? 0) + value; if (!safeInteger(next)) fail('Total monetário excede o limite seguro.', 'invalid_state'); target[key] = next; };
const moneyGroups = groups => Object.keys(groups).sort().map(coin => ({moeda: coin, valor: display(groups[coin], coin), amount_minor: groups[coin]}));

function plansBlock(state, context, today) {
  const totals = {}, personalTotals = {};
  const count = new Map(); state.plans.forEach(plan => count.set(plan.id, (count.get(plan.id) ?? 0) + 1));
  const plans = state.plans.map((row, index) => {
    const schedule = planSchedule(row, today);
    const confirmed = row.confirmed === true;
    const coin = knownCurrency(row.currency) ? row.currency : safeText(row.currency) || 'não informada';
    const whole = confirmed && knownCurrency(coin) ? amount(row.amountMinor) : null;
    const own = personalMinor(whole, context);
    const factor = PERIODS[normalized(row.period)];
    const monthly = whole !== null && factor ? roundedRatio(BigInt(whole) * BigInt(factor[0]), BigInt(factor[1])) : null;
    const personalMonthly = personalMinor(monthly, context);
    const status = row.paymentStatusExplicit === false ? legacyPaymentStatus(row.status, schedule.due, today) : paymentStatus(row.paymentStatus, schedule.due, today);
    const sub = activity(row);
    const pending = ['due', 'overdue'].includes(status) || (status === 'unconfirmed' && sub === 'active');
    const delta = schedule.due ? daysBetween(schedule.due, today) : null;
    if (sub === 'active' && monthly !== null) { add(totals, coin, monthly); if (personalMonthly !== null) add(personalTotals, coin, personalMonthly); }
    return {index, id: safeText(row.id), servico: safeText(row.servico), plano: safeText(row.plano), valor: display(amount(row.amountMinor), coin), valor_texto: display(amount(row.amountMinor), coin)?.toString() ?? '', moeda: coin, periodo: safeText(row.period), proxima_data: schedule.due, schedule_derived: schedule.derived, monthly_day: schedule.day, schedule_issue: schedule.issue, status: safeText(row.status), confirmed, subscription_state: sub, payment_status: status, confirmation: confirmed ? 'confirmed' : 'unconfirmed', due_soon: !!(pending && delta !== null && delta >= 0 && delta <= 7), overdue: !!(pending && delta !== null && delta < 0), revision: `r${state.revision}`, minor_unit_digits: MINOR_DIGITS[coin] ?? null, amount_minor: whole, personal_amount_minor: own, personal_amount: display(own, coin), monthly_amount: display(monthly, coin), monthly_amount_minor: monthly, personal_monthly_amount: display(personalMonthly, coin), id_duplicated: count.get(row.id) > 1};
  });
  return {source: source(state), user_source: source(state), plans, summary: {fixed_monthly: moneyGroups(totals), personal_fixed_monthly: moneyGroups(personalTotals), current_share: context.share, allocation_balanced: context.balanced, incomplete_costs: plans.filter(plan => plan.subscription_state === 'active' && plan.monthly_amount === null).length, incomplete_personal_costs: plans.filter(plan => plan.subscription_state === 'active' && plan.personal_monthly_amount === null).length, unconfirmed_subscriptions: plans.filter(plan => plan.subscription_state === 'unconfirmed').length, due_soon: plans.filter(plan => plan.due_soon).length, overdue: plans.filter(plan => plan.overdue).length}};
}

function billingBlock(state, block, context, today) {
  if (state.charges === null) {
    return {source: source(state, false), fallback_source: block.source, mode: 'plans_preview', charges: block.plans.filter(plan => plan.proxima_data).map(plan => ({id: `previsao-${plan.id}`, subscription_id: plan.id, servico: plan.servico, plano: plan.plano, valor: plan.valor, moeda: plan.moeda, due_date: plan.proxima_data, personal_amount: plan.personal_amount, amount_minor: plan.amount_minor, personal_amount_minor: plan.personal_amount_minor, payment_status: plan.payment_status, confirmed: plan.confirmed, estimated_from_plan: true, schedule_derived: plan.schedule_derived, monthly_day: plan.monthly_day, due_soon: plan.due_soon, overdue: plan.overdue}))};
  }
  return {source: source(state), mode: 'ledger', charges: state.charges.map(row => {
    const due = isoDate(row.dueDate), coin = knownCurrency(row.currency) ? row.currency : safeText(row.currency) || 'não informada';
    const whole = row.confirmed === true && knownCurrency(coin) ? amount(row.amountMinor) : null;
    const own = personalMinor(whole, context), status = paymentStatus(row.paymentStatus, due, today), delta = due ? daysBetween(due, today) : null;
    const pending = ['due', 'overdue'].includes(status);
    return {id: safeText(row.id), subscription_id: safeText(row.subscriptionId), servico: safeText(row.servico), plano: safeText(row.plano), valor: display(amount(row.amountMinor), coin), moeda: coin, due_date: due, personal_amount: display(own, coin), amount_minor: whole, personal_amount_minor: own, payment_status: status, confirmed: row.confirmed === true, estimated_from_plan: false, due_soon: !!(pending && delta !== null && delta >= 0 && delta <= 7), overdue: !!(pending && delta !== null && delta < 0)};
  })};
}

function benefitExpiry(row, today) {
  if (row.expiresOn && row.expiresMonth) return {expires_on: null, expires_month: null, days_until_expiry: null, expiry_state: 'unknown', issues: ['vencimento_ambiguo']};
  if (row.expiresOn) {
    const due = isoDate(row.expiresOn);
    if (!due) return {expires_on: null, expires_month: null, days_until_expiry: null, expiry_state: 'unknown', issues: ['data_de_vencimento_invalida']};
    const delta = daysBetween(due, today);
    return {expires_on: due, expires_month: null, days_until_expiry: delta, expiry_state: delta < 0 ? 'expired' : delta <= 30 ? 'soon' : 'future', issues: []};
  }
  if (row.expiresMonth) {
    if (typeof row.expiresMonth !== 'string' || !/^\d{4}-\d{2}$/.test(row.expiresMonth) || !isoDate(row.expiresMonth + '-01')) return {expires_on: null, expires_month: null, days_until_expiry: null, expiry_state: 'unknown', issues: ['mes_de_vencimento_invalido']};
    const month = today.slice(0, 7), state = row.expiresMonth < month ? 'expired' : row.expiresMonth === month ? 'this_month' : 'future';
    return {expires_on: null, expires_month: row.expiresMonth, days_until_expiry: null, expiry_state: state, issues: state === 'this_month' ? ['data_exata_de_vencimento_desconhecida'] : []};
  }
  return {expires_on: null, expires_month: null, days_until_expiry: null, expiry_state: 'unknown', issues: ['vencimento_nao_informado']};
}

function benefitSource(value) {
  if (!record(value)) return safeText(value);
  const label = safeText(value.label).trim(), url = safeText(value.url).trim();
  return [label, url].filter(Boolean).join(' — ');
}

function benefitsBlock(state, plans, today) {
  const counts = new Map(); state.benefits.forEach(row => counts.set(row.id, (counts.get(row.id) ?? 0) + 1));
  const recurring = new Map(), balances = new Map();
  const entries = state.benefits.map(row => {
    const issues = [], kind = ['bonus_recorrente', 'franquia_incluida', 'credito_extra', 'saldo_api'].includes(row.kind) ? row.kind : 'unknown';
    let candidates = row.subscriptionId ? plans.filter(plan => plan.id === row.subscriptionId) : [];
    let match = null, matchState = 'unmatched';
    if (kind === 'saldo_api' && !row.subscriptionId) matchState = 'standalone';
    else if (candidates.length === 1) { match = candidates[0]; matchState = 'id'; }
    else if (candidates.length > 1) { matchState = 'ambiguous'; issues.push('assinatura_ambigua'); }
    else {
      if (row.subscriptionId) issues.push('assinatura_id_nao_encontrado');
      candidates = row.service && kind !== 'saldo_api' ? plans.filter(plan => plan.servico === row.service) : [];
      if (candidates.length === 1) { match = candidates[0]; matchState = 'service'; }
      else if (candidates.length > 1) { matchState = 'ambiguous'; issues.push('servico_com_multiplas_assinaturas'); }
    }
    if (match && row.service && row.service !== match.servico) issues.push('servico_diverge_da_assinatura');
    const sub = match?.subscription_state ?? (matchState === 'standalone' ? 'not_applicable' : 'unconfirmed');
    if (!['active', 'not_applicable'].includes(sub)) issues.push('disponibilidade_nao_confirmada_pelo_estado_da_assinatura');
    const coin = knownCurrency(row.currency) ? row.currency : safeText(row.currency) || 'não informada';
    const nominal = amount(row.amountMinor), balance = amount(row.balanceMinor);
    const validNominal = (nominal !== null && nominal >= 0) || (kind === 'saldo_api' && row.amountMinor == null);
    const validBalance = balance !== null && balance >= 0;
    if (kind === 'unknown') issues.push('tipo_de_beneficio_invalido');
    if (!validNominal) issues.push('valor_nominal_invalido_ou_ausente');
    if ((row.balanceMinor != null || kind === 'saldo_api') && !validBalance) issues.push('saldo_invalido');
    if (!knownCurrency(coin)) issues.push('moeda_nao_suportada_ou_ausente');
    if (!row.environment) issues.push('ambiente_nao_informado');
    if (!row.service && !match?.servico) issues.push('servico_nao_informado');
    if (['bonus_recorrente', 'franquia_incluida'].includes(kind) && !row.period) issues.push('periodicidade_nao_informada');
    if (row.confirmed !== true) issues.push('beneficio_nao_confirmado');
    const expiry = benefitExpiry(row, today); issues.push(...expiry.issues);
    let observed = row.observedAt ? isoDate(row.observedAt) : null;
    if (row.observedAt && !observed) issues.push('data_de_observacao_invalida');
    else if (!row.observedAt && row.balanceMinor != null) issues.push('data_de_observacao_nao_informada');
    const duplicate = counts.get(row.id) > 1;
    if (duplicate) issues.push('id_de_beneficio_duplicado');
    const confirmed = row.confirmed === true && kind !== 'unknown' && validNominal && knownCurrency(coin) && !!(row.environment && (row.service || match?.servico)) && !(row.balanceMinor != null && !validBalance) && (kind !== 'saldo_api' || validBalance) && !duplicate;
    const entry = {id: safeText(row.id), subscription_id: safeText(match?.id || row.subscriptionId), servico: safeText(row.service || match?.servico), ambiente: safeText(row.environment), tipo: kind, moeda: coin, valor: display(nominal, coin), valor_texto: display(nominal, coin)?.toString() ?? '', periodicidade: safeText(row.period), saldo_disponivel: validBalance ? display(balance, coin) : null, confirmed, ...expiry, observed_at: observed, usage_condition: safeText(row.usageCondition) || 'não informada', source: benefitSource(row.source), notes: safeText(row.notes), subscription_state: sub, match_state: matchState, issues};
    if (confirmed) {
      const parts = [entry.servico, entry.ambiente, coin, entry.periodicidade];
      const invalidExpiry = issues.some(issue => ['vencimento_ambiguo', 'data_de_vencimento_invalida', 'mes_de_vencimento_invalido'].includes(issue));
      const append = (target, keys, value) => { const key = JSON.stringify(keys), group = target.get(key) ?? {parts: keys, amount: 0, ids: []}; if (!safeInteger(group.amount + value)) fail('Total monetário excede o limite seguro.', 'invalid_state'); group.amount += value; group.ids.push(entry.id); target.set(key, group); };
      if (['bonus_recorrente', 'franquia_incluida'].includes(kind) && row.period && sub === 'active' && expiry.expiry_state !== 'expired' && !invalidExpiry) append(recurring, parts, nominal);
      if (validBalance && ['soon', 'future'].includes(expiry.expiry_state)) append(balances, [...parts, entry.usage_condition], balance);
    }
    return entry;
  });
  const grouped = target => [...target.values()].sort((a, b) => JSON.stringify(a.parts).localeCompare(JSON.stringify(b.parts))).map(group => ({servico: group.parts[0], ambiente: group.parts[1], moeda: group.parts[2], periodicidade: group.parts[3], valor: display(group.amount, group.parts[2]), amount_minor: group.amount, benefit_ids: group.ids, ...(group.parts.length > 4 ? {usage_condition: group.parts[4]} : {})}));
  return {source: source(state), entries, summary: {recurring: grouped(recurring), balances: grouped(balances), expiring: entries.filter(entry => ['soon', 'this_month'].includes(entry.expiry_state)).map(entry => ({id: entry.id, servico: entry.servico, ambiente: entry.ambiente, expiry_state: entry.expiry_state, expires_on: entry.expires_on, expires_month: entry.expires_month, days_until_expiry: entry.days_until_expiry}))}};
}

const WITHHELD = 'aicask_only';
/** A curated block the exporter kept on the Mac (null or {availability:'aicask_only'}) is unavailable here, never "missing data". */
function staticBlock(state, name) {
  const raw = state.staticBlocks[name];
  if (raw === null || (record(raw) && raw.availability === WITHHELD)) return {source: {...source(state, false), status: 'indisponível neste ambiente'}, columns: [], rows: [], text: '', availability: WITHHELD};
  return {source: source(state, record(raw)), columns: [], rows: [], text: '', ...sanitizePublic(record(raw) ? raw : {})};
}

/** Public UI projection. Never exports the members array or the canonical state. */
export function buildSnapshot(state, member, today) {
  assertState(state);
  const context = identity(state, member), date = civilDate(today);
  const userBlock = plansBlock(state, context, date);
  userBlock.billing = billingBlock(state, userBlock, context, date);
  userBlock.benefits = benefitsBlock(state, userBlock.plans, date);
  const products = [];
  const steps = state.selling.steps.map((row, index) => ({index, id: safeText(row.id), text: safeText(row.text), product: safeText(row.product) || 'Prioridades', checked: row.checked === true, revision: `r${state.revision}`}));
  for (const step of steps) { let product = products.find(item => item.name === step.product); if (!product) { product = {name: step.product, steps: []}; products.push(product); } product.steps.push(step); }
  const sell = {source: source(state), products: products.slice(0, 3), steps, text: safeText(state.selling.text), columns: sanitizePublic(list(state.selling.columns)), rows: sanitizePublic(list(state.selling.rows))};
  const blocks = {user: userBlock, sell_first: sell};
  for (const name of STATICS) blocks[name] = staticBlock(state, name);
  const societyHistory = blocks.society;
  blocks.society = {
    source: source(state),
    columns: ['Sócio', 'Participação'],
    rows: state.members.map(row => ({Sócio: safeText(row.displayName) || 'Sócio', Participação: percent(row.participationPct) === null ? 'a confirmar' : `${row.participationPct}%`})),
    text: societyHistory.text ? `## Histórico importado\n\nO quadro acima reflete o cadastro atual. O texto abaixo foi preservado da fonte importada e pode descrever uma composição anterior.\n\n${societyHistory.text}` : '',
    current_members: state.members.map(row => ({nome: safeText(row.displayName) || 'Sócio', participacao_pct: percent(row.participationPct) === null ? null : row.participationPct})),
    allocation_balanced: context.balanced,
  };
  blocks.cash.fixed_monthly = userBlock.summary.fixed_monthly;
  blocks.cash.incomplete_costs = userBlock.summary.incomplete_costs;
  blocks.atlas = {schema_version: 1, assets: [], sources: [], coverage: {}, ...blocks.atlas};
  const user = {nome: safeText(context.selected.displayName) || 'Sócio', participacao_pct: context.share, quota: userBlock.summary};
  const contentRevision = `r${state.revision}:${date}:${encodeURIComponent(member.id)}:${contentTag(JSON.stringify({user, blocks}))}`;
  return {user, must_change_password: false, content_revision: contentRevision, blocks};
}

/** Parse a UI edit without binary-floating arithmetic. Unsupported currency is rejected. */
export function parseAmountMinor(value, coin) {
  if (!knownCurrency(coin) || !['string', 'number'].includes(typeof value)) return null;
  let text = String(value).trim();
  const prefix = text.match(/^(R\$|US\$|[$€£])\s*/)?.[1];
  if (prefix) {
    if ({'R$': 'BRL', 'US$': 'USD', '$': 'USD', '€': 'EUR', '£': 'GBP'}[prefix] !== coin) return null;
    text = text.slice(prefix.length).trim();
  }
  if (!/^[+]?\d[\d.,]*$/.test(text)) return null;
  text = text.replace(/^\+/, '');
  if (text.includes('.') && text.includes(',')) {
    if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) text = text.replace(/,/g, '');
    else return null;
  } else if ((text.match(/[.,]/g) ?? []).length > 1) {
    const separator = text.includes('.') ? '.' : ',';
    if (!new RegExp('^\\d{1,3}(?:\\' + separator + '\\d{3})+$').test(text)) return null;
    text = text.split(separator).join('');
  } else text = text.replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const [integer, fraction = ''] = text.split('.'), digits = MINOR_DIGITS[coin];
  const scaled = BigInt(integer) * 10n ** BigInt(digits) + BigInt((fraction.slice(0, digits) + '0'.repeat(digits)).slice(0, digits) || '0');
  const rounded = scaled + (fraction.length > digits && fraction[digits] >= '5' ? 1n : 0n);
  return rounded > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(rounded);
}

/** Pure mutation. Persist with a compare-and-swap against the OLD state.revision. */
export function applyMutation(state, action, payload, member, today) {
  assertState(state); const context = identity(state, member); civilDate(today);
  if (!MUTATIONS.has(action)) return fail('Ação desconhecida.', 'unknown_action');
  if (!record(payload)) return fail('Solicitação inválida.');
  if (payload.expected_revision !== `r${state.revision}`) return fail('O estado mudou. Atualize o painel e tente novamente.', 'stale_source');
  if (!safeInteger(payload.index) || payload.index < 0) return fail('Registro inválido.');
  if (state.revision === Number.MAX_SAFE_INTEGER) return fail('Limite de revisão alcançado.', 'invalid_state');
  const next = structuredClone(state), index = payload.index;
  let result;
  if (action === 'toggle_step') {
    if (typeof payload.checked !== 'boolean') return fail('Passo inválido.');
    if (!next.selling.steps[index]) return fail('O passo mudou. Atualize o painel.', 'stale_step');
    const target = next.selling.steps[index];
    target.checked = payload.checked; target.changedAt = stamp(today); target.changedBy = context.selected.id;
    result = {saved: true, index, checked: payload.checked};
  } else {
    const target = next.plans[index];
    if (!target) return fail('O plano mudou. Atualize o painel.', 'stale_plan');
    if (action === 'set_subscription') {
      if (typeof payload.active !== 'boolean') return fail('Informe a assinatura e o estado desejado.');
      target.subscriptionState = payload.active ? 'active' : 'inactive';
      target.subscriptionChangedAt = stamp(today); target.subscriptionChangedBy = context.selected.id;
      result = {saved: true, index, subscription_state: target.subscriptionState};
    } else {
      const updates = payload.values;
      if (!record(updates) || !Object.keys(updates).length || Object.keys(updates).some(key => !['valor', 'proxima_data', 'status'].includes(key))) return fail('Edite somente valor, próxima data e status.');
      for (const [key, raw] of Object.entries(updates)) {
        if (typeof raw !== 'string' && typeof raw !== 'number') return fail('Valor de edição inválido.');
        const value = String(raw).trim();
        if (value.length > 240 || /[\r\n]/.test(value)) return fail('Valor de edição inválido.');
        if (key === 'valor') { const parsed = parseAmountMinor(value, target.currency); if (parsed === null) return fail('Informe um valor não negativo e uma moeda válida.'); target.amountMinor = parsed; }
        if (key === 'proxima_data') { if (value && !isoDate(value)) return fail('Informe uma data válida.'); target.nextDate = value || null; }
        if (key === 'status') { if (!value || safeText(value) !== value) return fail('Informe um status válido.'); target.status = value; if (target.paymentStatusExplicit === false) target.paymentStatus = legacyPaymentStatus(value, null, civilDate(today)); }
      }
      target.changedAt = stamp(today); target.changedBy = context.selected.id;
      result = {saved: true, index};
    }
  }
  next.revision++; next.updatedAt = stamp(today);
  // Validate the complete proposed projection before any storage adapter can commit it.
  // An individually valid cent amount can still overflow an aggregate.
  try { buildSnapshot(next, member, today); }
  catch (error) {
    if (error instanceof DomainError && error.code === 'invalid_state') return fail('A edição excede os limites suportados pelo painel. O estado anterior foi preservado.');
    throw error;
  }
  return {state: next, result};
}
