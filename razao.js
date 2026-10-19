// O livro-razão do Finanças: lançamentos das sócias, parâmetros com vigência (câmbio, spread, IOF, impostos, taxas) e o
// mês calculado. Puro e determinístico, como o domain.js: recebe o estado canônico + os eventos do diário e devolve
// números em centavos inteiros (BigInt na conta, um arredondamento só, meio para longe do zero). Moedas nunca se somam
// sem uma conversão explícita, e toda conversão carrega a conta que a produziu ("Ver a conta").
// Plano: docs/PLANO-PORTAL.md §4 e docs/PLANO-FASES-2-3.md (F2-1). Testes: testes/razao.test.mjs e testes/razao-eventos.test.mjs.

export const RAZAO_VERSAO = 2;
// tabelas de consulta sem protótipo: "constructor" ou "__proto__" vindos de um evento nunca passam por moeda, categoria...
const semProto = obj => Object.assign(Object.create(null), obj);
const DIGITOS = semProto({BRL: 2, USD: 2, EUR: 2});
export const MOEDAS = Object.keys(DIGITOS);

// ── categorias: seis cores fixas + "Outros" (plano §6.2: mais que isso deixa de ser legível e de passar no daltonismo)
export const CATEGORIAS = [
  {id: 'software_ia', rotulo: 'Software e IA', slot: 1},
  {id: 'infraestrutura', rotulo: 'Infraestrutura', slot: 2},
  {id: 'impostos_taxas', rotulo: 'Impostos e taxas', slot: 3},
  {id: 'contabilidade_juridico', rotulo: 'Contabilidade e jurídico', slot: 4},
  {id: 'marketing', rotulo: 'Marketing', slot: 5},
  {id: 'banco_cambio', rotulo: 'Banco e câmbio', slot: 6},
  {id: 'pro_labore', rotulo: 'Pró-labore e folha', slot: 0},   // D15: base do fator R, sem cor própria (vai para "Outros" nos gráficos)
  {id: 'equipamento', rotulo: 'Equipamento', slot: 0},
  {id: 'outros', rotulo: 'Outros', slot: 0},
];
const CATEGORIA = semProto(Object.fromEntries(CATEGORIAS.map(c => [c.id, c])));
// palpite de categoria para as assinaturas do arquivo de planos (que não têm categoria): pelo nome do serviço
const PALPITE = [
  [/vercel|netlify|github|gitlab|dom[ií]nio|registro\.br|aws|cloudflare|render|supabase|hostinger|servidor/i, 'infraestrutura'],
  [/contador|contabil|jur[ií]dic|advoga|cart[óo]rio/i, 'contabilidade_juridico'],
  [/an[úu]ncio|ads|meta|instagram|marketing|canva/i, 'marketing'],
  [/banco|tarifa|c[âa]mbio|iof|wise|remessa/i, 'banco_cambio'],
  [/imposto|das|simples|iss|taxa/i, 'impostos_taxas'],
  [/claude|anthropic|openai|chatgpt|figma|google|workspace|notion|apple|cursor|ia\b/i, 'software_ia'],
];
export function palpiteCategoria(texto) { for (const [re, id] of PALPITE) if (re.test(String(texto || ''))) return id; return 'outros'; }

export const FORMAS = [
  {id: 'cartao_pj', rotulo: 'Cartão da empresa', empresa: true, cartao: true},
  {id: 'conta_pj', rotulo: 'Pix, boleto ou conta da empresa', empresa: true, cartao: false},
  {id: 'cartao_pessoal', rotulo: 'Meu cartão pessoal', empresa: false, cartao: true},
  {id: 'pix_pessoal', rotulo: 'Meu Pix ou conta pessoal', empresa: false, cartao: false},
];
const FORMA = semProto(Object.fromEntries(FORMAS.map(f => [f.id, f])));
// quem paga do próprio bolso escolhe o destino (decisão D5: o padrão é a empresa reembolsar)
export const DESTINOS = [
  {id: 'empresa_reembolsa', rotulo: 'A empresa me reembolsa', explica: 'O valor inteiro volta para quem pagou; até lá fica em "a receber da empresa".'},
  {id: 'dividir', rotulo: 'Dividir entre as sócias', explica: 'Cada sócia arca com a sua participação; quem pagou recebe das outras a parte delas.'},
  {id: 'aporte', rotulo: 'Conta como meu aporte', explica: 'Ninguém devolve: vira aporte de quem pagou na empresa.'},
];

// ── parâmetros: catálogo fechado (plano §4.2). Valor sempre em texto decimal ("5.0826", "3.5"): nada de float.
export const CATALOGO = [
  {chave: 'fx.USD_BRL', grupo: 'Câmbio', rotulo: 'Dólar (PTAX de venda)', unidade: 'R$ por US$', casas: 4, dura: [0.5, 50], macia: [3, 10],
    explica: 'Converte o que foi pago em dólar para reais, no dia de cada gasto. A PTAX do Banco Central é a referência; o banco cobra a PTAX + o spread do cartão.',
    semente: {valor: '5.0826', desde: '2026-10-16', fonte: 'PTAX venda BCB, 16/10/2026', estado: 'vigente'}},
  {chave: 'fx.EUR_BRL', grupo: 'Câmbio', rotulo: 'Euro (PTAX de venda)', unidade: 'R$ por €', casas: 4, dura: [0.5, 60], macia: [3, 12],
    explica: 'O mesmo que o dólar, para gastos em euro.', semente: null},
  {chave: 'cartao.spread_pct', grupo: 'Câmbio', rotulo: 'Spread do cartão', unidade: '%', casas: 2, dura: [0, 10], macia: [0, 6],
    explica: 'A margem que o emissor cobra sobre a PTAX numa compra internacional. Não vem separada na fatura: confira na primeira fatura e ajuste.',
    semente: {valor: '4.00', desde: '2026-01-01', fonte: 'estimativa a conferir na fatura', estado: 'a_confirmar'}},
  {chave: 'iof.cartao_internacional_pct', grupo: 'IOF', rotulo: 'IOF em compra internacional no cartão', unidade: '%', casas: 2, dura: [0, 10], macia: [0, 6],
    explica: 'Imposto federal sobre a compra em moeda estrangeira no cartão (de crédito ou débito), cobrado em reais na fatura.',
    semente: {valor: '3.50', desde: '2025-05-23', fonte: 'Decreto 12.499/2025 (sub judice: ADC 96 no STF)', estado: 'vigente'}},
  {chave: 'iof.cambio_servicos_pct', grupo: 'IOF', rotulo: 'IOF no câmbio para pagar serviço do exterior', unidade: '%', casas: 2, dura: [0, 10], macia: [0, 6],
    explica: 'Quando a empresa paga um serviço do exterior por remessa ou boleto de câmbio (não no cartão). Sem spread de cartão.',
    semente: {valor: '0.38', desde: '2025-05-23', fonte: 'Decreto 6.306/2007 (art. 15-B)', estado: 'vigente'}},
  {chave: 'imposto.simples_efetiva_pct', grupo: 'Impostos', rotulo: 'Alíquota efetiva do Simples', unidade: '%', casas: 2, dura: [0, 33], macia: [4, 20],
    explica: 'O percentual da receita que vai para o DAS. Depende do anexo (III ou V, pelo fator R) e da receita dos últimos 12 meses: o contador informa.',
    semente: {valor: '6.00', desde: '2026-01-01', fonte: 'piso do Anexo III, a confirmar com o contador', estado: 'a_confirmar'}},
  {chave: 'imposto.iss_pct', grupo: 'Impostos', rotulo: 'ISS do município', unidade: '%', casas: 2, dura: [2, 5], macia: [2, 5],
    explica: 'Só fora do Simples (no Simples o ISS já está dentro do DAS). Varia de 2% a 5% conforme o município.',
    semente: {valor: '2.00', desde: '2026-01-01', fonte: 'mínimo legal (LC 116/2003)', estado: 'a_confirmar'}},
  {chave: 'taxa.hotmart_pct', grupo: 'Taxas de venda', rotulo: 'Hotmart · percentual', unidade: '%', casas: 2, dura: [0, 30], macia: [3, 20],
    explica: 'O que a Hotmart fica de cada venda, além da parte fixa.', semente: {valor: '9.90', desde: '2026-09-21', fonte: 'tabela pública da Hotmart', estado: 'a_confirmar'}},
  {chave: 'taxa.hotmart_fixa', grupo: 'Taxas de venda', rotulo: 'Hotmart · por venda', unidade: 'R$', casas: 2, dura: [0, 20], macia: [0, 10],
    explica: 'Valor fixo por transação.', semente: {valor: '2.49', desde: '2026-09-21', fonte: 'tabela pública da Hotmart', estado: 'a_confirmar'}},
  {chave: 'taxa.stripe_pct', grupo: 'Taxas de venda', rotulo: 'Stripe · cartão nacional', unidade: '%', casas: 2, dura: [0, 30], macia: [1, 10],
    explica: 'Percentual por cobrança no cartão nacional.', semente: {valor: '3.99', desde: '2026-01-01', fonte: 'tabela pública da Stripe Brasil', estado: 'a_confirmar'}},
  {chave: 'taxa.stripe_fixa', grupo: 'Taxas de venda', rotulo: 'Stripe · por cobrança', unidade: 'R$', casas: 2, dura: [0, 20], macia: [0, 5],
    explica: 'Valor fixo por cobrança.', semente: {valor: '0.39', desde: '2026-01-01', fonte: 'tabela pública da Stripe Brasil', estado: 'a_confirmar'}},
  {chave: 'taxa.apple_pct', grupo: 'Taxas de venda', rotulo: 'Apple · comissão', unidade: '%', casas: 2, dura: [0, 35], macia: [10, 30],
    explica: 'Comissão da App Store sobre assinaturas (a reduzida vale para pequenos desenvolvedores).', semente: {valor: '15.00', desde: '2026-01-01', fonte: 'programa de pequenas empresas da Apple', estado: 'a_confirmar'}},
  {chave: 'taxa.google_pct', grupo: 'Taxas de venda', rotulo: 'Google Play · comissão', unidade: '%', casas: 2, dura: [0, 35], macia: [10, 30],
    explica: 'Comissão da Google Play sobre assinaturas (15% é a taxa reduzida de assinatura; confira no painel do Google).', semente: {valor: '15.00', desde: '2026-01-01', fonte: 'tabela pública da Google Play, a confirmar', estado: 'a_confirmar'}},
];
const ITEM = semProto(Object.fromEntries(CATALOGO.map(c => [c.chave, c])));
export const ESTADOS_PARAMETRO = {vigente: 'vigente', a_confirmar: 'a confirmar', substituido: 'substituído'};

// ── decimais exatos ───────────────────────────────────────────────────────────────────────────────────────────────
// "5.0826" → {n: 50826n, d: 10000n}. Recusa notação científica, sinal e mais casas que o catálogo permite.
export function decimal(texto, casasMax = 6) {
  const s = String(texto ?? '').trim().replace(',', '.');
  const m = /^(\d{1,9})(?:\.(\d{1,12}))?$/.exec(s);
  if (!m) return null;
  const frac = m[2] || '';
  if (frac.length > casasMax) return null;
  return {n: BigInt(m[1] + frac), d: 10n ** BigInt(frac.length)};
}
function arred(n, d) { // meio para longe do zero, como o roundedRatio do domain.js
  const sinal = n < 0n ? -1n : 1n, a = n * sinal;
  return sinal * ((a + d / 2n) / d);
}
const numero = big => { if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('valor fora do limite'); return Number(big); };

// dinheiro digitado à moda brasileira → centavos. "1.500" = mil e quinhentos; "1.50" em reais é recusado (use vírgula).
// Vírgula decimal vale em qualquer moeda ("100,00" dólares); o formato americano só quando não há dúvida ("1,000.50").
export function centavosBR(texto, moeda = 'BRL') {
  let s = String(texto ?? '').trim().replace(/\s|R\$|US\$|€|\$/g, '');
  if (!s) return null;
  const virgulaDecimal = /,\d{1,2}$/.test(s);
  if (virgulaDecimal || moeda !== 'USD') {
    if (!virgulaDecimal && /\.\d{1,2}$/.test(s)) return null;
    s = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  } else s = s.replace(/,(?=\d{3}(\D|$))/g, '');
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return numero(BigInt(m[1]) * 100n + BigInt(((m[2] || '') + '00').slice(0, 2)));
}

// ── conversão (F3): total = arred(A × c × (1+s) × (1+i)); os componentes sempre fecham com o total ────────────────────
export function converter(minor, cambio, spreadPct = '0', iofPct = '0') {
  const c = decimal(cambio), s = decimal(spreadPct), i = decimal(iofPct);
  if (!Number.isSafeInteger(minor) || minor < 0 || !c || !s || !i) return null;
  const A = BigInt(minor), cem = 100n;
  const total = arred(A * c.n * (s.d * cem + s.n) * (i.d * cem + i.n), c.d * s.d * cem * i.d * cem);
  const principal = arred(A * c.n, c.d);
  const spread = arred(A * c.n * s.n, c.d * s.d * cem);
  return {principal: numero(principal), spread: numero(spread), iof: numero(total - principal - spread), total: numero(total)};
}

// rateio pelo maior resto (desempate pelo índice); pesos em percentuais decimais — a soma sai exata
export function ratear(total, pcts) {
  const pesos = pcts.map(p => decimal(p, 8));
  if (!Number.isSafeInteger(total) || !pesos.length || pesos.some(p => !p)) return null;
  const D = 10n ** 8n * 100n;
  const w = pesos.map(p => p.n * (10n ** 8n / p.d));
  if (w.reduce((a, b) => a + b, 0n) !== D) return null;
  const T = BigInt(Math.abs(total)), sinal = total < 0 ? -1 : 1;
  const exato = w.map(x => T * x), inteiro = exato.map(x => x / D);
  let resto = T - inteiro.reduce((a, b) => a + b, 0n);
  exato.map((x, k) => ({k, r: x % D})).sort((a, b) => a.r === b.r ? a.k - b.k : a.r > b.r ? -1 : 1).forEach(({k}) => { if (resto > 0n) { inteiro[k]++; resto--; } });
  return inteiro.map(x => sinal * numero(x));
}

// ── parâmetros vigentes (F2) ──────────────────────────────────────────────────────────────────────────────────────
// semente do catálogo + eventos set_parameter; o vigente numa data é o de maior "desde" ≤ data (empate: o mais novo)
export function parametros(eventosAplicados) {
  const lista = [];
  for (const c of CATALOGO) if (c.semente) lista.push({id: 'semente:' + c.chave, chave: c.chave, valor: c.semente.valor, desde: c.semente.desde, fonte: c.semente.fonte, estado: c.semente.estado, nota: '', por: null, quando: null, semente: true, ordem: 0});
  let ordem = 1;
  for (const p of eventosAplicados.parametros) lista.push({...p, semente: false, ordem: ordem++});
  return lista;
}
export function vigente(lista, chave, data) {
  let melhor = null;
  for (const p of lista) if (p.chave === chave && p.desde <= data && p.estado !== 'substituido' && (!melhor || p.desde > melhor.desde || (p.desde === melhor.desde && p.ordem > melhor.ordem))) melhor = p;
  return melhor;
}

// ── diário: eventos → coleções. Um evento inválido é recusado com motivo (nunca entra numa conta nem some calado) ──────
// Conteúdo do evento: {acao, alvo, versao?, dados, motivo?, quando}. A autora é quem assinou (ev.membro) e o papel vem
// sempre do estado (members[].role), nunca do evento. Cada recusa leva um código: versao (outra sócia mexeu antes; vem
// com o registro atual para o diálogo de conflito), mes_fechado, permissao, invalido ou repetido.
const DIA = /^\d{4}-\d{2}-\d{2}$/, MES = /^\d{4}-\d{2}$/;
const texto = (v, max = 160) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
const diaValido = s => { if (typeof s !== 'string' || !DIA.test(s)) return false; const t = Date.parse(s + 'T12:00:00Z'); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s; };
const mesValido = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const inteiro = (v, min = 0) => Number.isSafeInteger(v) && v >= min;
const opcional = v => v === null || v === undefined || inteiro(v);
const moedaOk = m => typeof m === 'string' && DIGITOS[m] !== undefined;
const casa = (re, v) => typeof v === 'string' && re.test(v);
const ID_GASTO = /^[A-Za-z0-9][\w.:-]{0,99}$/, ID_PLANO = /^pl-[\w-]{1,80}$/, ID_ACERTO = /^ac-[\w-]{1,80}$/, ID_SALDO = /^sd-[\w-]{1,80}$/, ID_RECEITA = /^rc-[\w-]{1,80}$/;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function nomeDoMes(mes) { return mesValido(mes) ? `${MESES[+mes.slice(5, 7) - 1]} de ${mes.slice(0, 4)}` : String(mes); }
const Mes = mes => { const s = nomeDoMes(mes); return s.charAt(0).toUpperCase() + s.slice(1); };
const ultimoDiaDo = mes => new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).toISOString().slice(0, 10);
function somarMeses(mes, k) { const t = +mes.slice(0, 4) * 12 + (+mes.slice(5, 7) - 1) + k; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; }
// o dia do evento em São Paulo (UTC−3, sem horário de verão desde 2019): é por ele que se sabe se o mês já terminou
function diaDoEvento(quando) { const t = Date.parse(typeof quando === 'string' ? quando : ''); return Number.isFinite(t) ? new Date(t - 3 * 3600e3).toISOString().slice(0, 10) : null; }
const SIMBOLO = {BRL: 'R$', USD: 'US$', EUR: '€'};
function fmt(minor, moeda = 'BRL') { // "R$ 1.388,47" (só para os textos das recusas e do histórico)
  if (!Number.isSafeInteger(minor)) return '—';
  const a = Math.abs(minor), int = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${minor < 0 ? '−' : ''}${SIMBOLO[moeda] || moeda} ${int},${String(a % 100).padStart(2, '0')}`;
}
const comSinal = minor => Number.isSafeInteger(minor) ? (minor > 0 ? '+' : '') + fmt(minor) : 'sem estimativa';

function validarGasto(g, membros) {
  if (!DIA.test(g.data || '')) return 'Informe a data do gasto.';
  if (!MES.test(g.competencia || '')) return 'Competência inválida.';
  if (!texto(g.descricao)) return 'Descreva o gasto.';
  if (!Number.isSafeInteger(g.valorMinor) || g.valorMinor <= 0) return 'Informe um valor maior que zero.';
  if (!moedaOk(g.moeda)) return 'Moeda não suportada.';
  if (!CATEGORIA[g.categoria]) return 'Escolha uma categoria.';
  if (!FORMA[g.forma]) return 'Escolha como foi pago.';
  if (!membros.some(m => m.id === g.pagoPor)) return 'Quem pagou não é sócia deste painel.';
  if (!FORMA[g.forma].empresa && !DESTINOS.some(d => d.id === g.destino)) return 'Escolha o destino do gasto pago do próprio bolso.';
  if (g.faturaBrlMinor !== null && g.faturaBrlMinor !== undefined && (!Number.isSafeInteger(g.faturaBrlMinor) || g.faturaBrlMinor < 0)) return 'Valor da fatura inválido.';
  return null;
}
const CAMPOS_GASTO = ['data', 'competencia', 'descricao', 'categoria', 'valorMinor', 'moeda', 'forma', 'pagoPor', 'destino', 'planoId', 'documento', 'nota', 'faturaBrlMinor'];
function limparGasto(d) {
  const g = {};
  for (const k of CAMPOS_GASTO) if (d[k] !== undefined) g[k] = typeof d[k] === 'string' ? texto(d[k], k === 'nota' ? 400 : 160) : d[k];
  if (FORMA[g.forma] && FORMA[g.forma].empresa) g.destino = 'nao_aplica';
  if (!g.faturaBrlMinor && g.faturaBrlMinor !== 0) g.faturaBrlMinor = null;
  return g;
}
// situação do reembolso de um gasto pago do bolso: mark_reimbursed (legado) e o reembolso pelo acerto contam igual (F12)
const reembolso = g => g.destino !== 'empresa_reembolsa' && g.destino !== 'dividir' ? 'nao_aplica' : g.convertidoEm ? 'convertido' : (g.reembolsadoEm || g.reembolsoId) ? 'reembolsado' : 'pendente';
const pick = g => ({descricao: g.descricao, valorMinor: g.valorMinor, moeda: g.moeda, data: g.data, competencia: g.competencia, categoria: g.categoria, forma: g.forma, destino: g.destino, faturaBrlMinor: g.faturaBrlMinor, estado: g.estado, reembolso: reembolso(g)});
const resumoGasto = g => `${g.descricao} · ${fmt(g.valorMinor, g.moeda)}`;

export const ACOES = ['add_expense', 'edit_expense', 'void_expense', 'set_parameter', 'mark_reimbursed',
  'check_expense', 'reconcile_statement', 'record_payment', 'convert_to_contribution',
  'add_plan', 'edit_plan', 'confirm_plan', 'archive_plan', 'reactivate_plan', 'toggle_step',
  'record_settlement', 'confirm_settlement', 'set_balance', 'add_income', 'edit_income', 'void_income',
  'close_month', 'reopen_month'];
// o verbo de cada ação no Histórico ("Ana conferiu · Domínio")
export const VERBOS = {
  add_expense: 'lançou', edit_expense: 'corrigiu', void_expense: 'anulou', set_parameter: 'mudou o parâmetro', mark_reimbursed: 'marcou como reembolsado',
  check_expense: 'conferiu', reconcile_statement: 'conciliou a fatura', record_payment: 'marcou como paga', convert_to_contribution: 'converteu em aporte',
  add_plan: 'criou a assinatura', edit_plan: 'alterou a assinatura', confirm_plan: 'confirmou a assinatura', archive_plan: 'encerrou a assinatura', reactivate_plan: 'reativou a assinatura', toggle_step: 'marcou o passo',
  record_settlement: 'registrou o acerto', confirm_settlement: 'confirmou o recebimento', set_balance: 'informou o saldo',
  add_income: 'lançou a receita', edit_income: 'corrigiu a receita', void_income: 'anulou a receita',
  close_month: 'fechou o mês', reopen_month: 'reabriu o mês',
};
const GRUPO = {
  add_expense: aplicarGasto, edit_expense: aplicarGasto, void_expense: aplicarGasto, mark_reimbursed: aplicarGasto, check_expense: aplicarGasto,
  reconcile_statement: aplicarGasto, record_payment: aplicarGasto, convert_to_contribution: aplicarGasto, set_parameter: aplicarParametro,
  add_plan: aplicarPlano, edit_plan: aplicarPlano, confirm_plan: aplicarPlano, archive_plan: aplicarPlano, reactivate_plan: aplicarPlano, toggle_step: aplicarPlano,
  record_settlement: aplicarDinheiro, confirm_settlement: aplicarDinheiro, set_balance: aplicarDinheiro, add_income: aplicarDinheiro, edit_income: aplicarDinheiro, void_income: aplicarDinheiro,
  close_month: aplicarMes, reopen_month: aplicarMes,
};

// O fold: estado do pacote (plans e selling.steps entram como versão 1 sem autora) + eventos, em ordem. Puro e
// determinístico: o mesmo diário dá o mesmo resultado em qualquer navegador.
export function aplicar(estadoBase, eventos) {
  const membros = (estadoBase.members || []).map(m => ({id: m.id, nome: m.displayName, papel: m.role, pct: m.participationPct}));
  const S = {membros, dono: id => (membros.find(m => m.id === id) || {}).papel === 'owner', socia: id => membros.some(m => m.id === id),
    nome: id => id === 'empresa' ? 'a empresa' : (membros.find(m => m.id === id) || {}).nome || id,
    gastos: new Map(), params: [], planos: new Map(), passos: new Map(), acertos: new Map(), saldos: new Map(), receitas: new Map(), fechamentos: {},
    recusados: [], historico: [], mudancas: []};
  for (const p of estadoBase.plans || []) if (p && typeof p.id === 'string' && !S.planos.has(p.id)) S.planos.set(p.id, planoDoPacote(p));
  for (const s of (estadoBase.selling && estadoBase.selling.steps) || []) if (s && typeof s.id === 'string' && !S.passos.has(s.id)) S.passos.set(s.id, passoDoPacote(s));
  for (const ev of eventos) {
    if (!ev || typeof ev !== 'object') continue;
    const c = ev.conteudo && typeof ev.conteudo === 'object' ? ev.conteudo : {}, autora = ev.membro, quando = c.quando || ev.ts || null;
    const x = {ev, c, autora, quando, d: c.dados && typeof c.dados === 'object' ? c.dados : {}, motivo: texto(c.motivo)};
    x.recusa = (motivo, codigo = 'invalido', atual = null) => {
      S.recusados.push({id: ev.id, seq: ev.seq, autora, acao: c.acao, alvo: typeof c.alvo === 'string' ? c.alvo : null, motivo, codigo, quando, ...(atual ? {atual} : {})});
      return false;
    };
    // registra no Histórico; "alcance" diz que meses o evento mexe nos números (para a concorrência do close_month)
    x.registrar = (item, alcance = null) => {
      const h = {seq: ev.seq, id: ev.id, autora, quando, acao: c.acao, verbo: VERBOS[c.acao], alvo: c.alvo ?? null, resumo: '', antes: null, depois: null, motivo: null, ...item};
      S.historico.push(h);
      if (alcance) S.mudancas.push({seq: ev.seq, autora, quando, acao: c.acao, resumo: h.resumo, meses: [], desde: null, planos: false, ...alcance});
    };
    if (!S.socia(autora)) { x.recusa('Autora desconhecida neste painel.', 'permissao'); continue; }
    if (!Object.hasOwn(GRUPO, c.acao)) { x.recusa('Registro de um tipo que esta versão não entende: recarregue o portal.'); continue; }
    try { GRUPO[c.acao](S, x); } catch { x.recusa('Registro com dados que o portal não consegue processar.'); }
  }
  const saldos = [...S.saldos.values()], vigentes = new Map();
  for (const s of saldos) { const m = vigentes.get(s.conta); if (!m || s.data >= m.data) vigentes.set(s.conta, s); }   // em ordem do diário: no empate vale o mais novo
  for (const s of saldos) s.vigente = vigentes.get(s.conta) === s;
  return {membros, gastos: [...S.gastos.values()], parametros: S.params, recusados: S.recusados, historico: S.historico,
    planos: [...S.planos.values()], passos: [...S.passos.values()], acertos: [...S.acertos.values()], saldos, receitas: [...S.receitas.values()], fechamentos: S.fechamentos};
}

// ── ajudantes comuns às ações ────────────────────────────────────────────────────────────────────────────────────
const fechado = (S, mes) => mesValido(mes) && Object.hasOwn(S.fechamentos, mes) && S.fechamentos[mes].fechado === true;
// trava do mês fechado (D8, F16): só o que forma os números do mês. Recusa e devolve true se algum dos meses está fechado.
function travado(S, x, ...meses) {
  const m = meses.find(k => fechado(S, k));
  if (!m) return false;
  x.recusa(`${Mes(m)} está fechado. A responsável reabre, com motivo, se precisar mudar.`, 'mes_fechado');
  return true;
}
function versaoConfere(x, reg, oQue, resumo, dados, versao = x.c.versao) {
  if (versao === reg.versao) return true;
  x.recusa(`Outra pessoa mudou ${oQue} antes (versão ${reg.versao}).`, 'versao', {versao: reg.versao, alteradoPor: reg.alteradoPor || reg.criadoPor || null, alteradoEm: reg.alteradoEm || reg.criadoEm || null, resumo, dados});
  return false;
}
function versionar(r, x, antes) { // nada se apaga: a versão anterior fica guardada no próprio registro
  r.versoes.push({versao: r.versao, por: x.autora, quando: x.quando, acao: x.c.acao, motivo: x.motivo || null, antes});
  r.versao++; r.alteradoPor = x.autora; r.alteradoEm = x.quando;
}

// ── gastos: lançar, corrigir, anular, conferir, conciliar a fatura, marcar assinatura como paga, reembolso e aporte ────
function aplicarGasto(S, x) {
  const {c, autora, quando} = x;
  if (c.acao === 'add_expense' || c.acao === 'record_payment') return novoGasto(S, x);
  if (c.acao === 'reconcile_statement') return conciliarFatura(S, x);
  const g = S.gastos.get(c.alvo);
  if (!g) return x.recusa('O lançamento não existe.');
  if (g.estado === 'anulado') return x.recusa('O lançamento já foi anulado.');
  // corrigir (a competência antiga e a nova), anular e conferir travam no mês fechado; reembolsar e converter, não
  if (['edit_expense', 'void_expense', 'check_expense'].includes(c.acao) && travado(S, x, g.competencia, c.acao === 'edit_expense' ? x.d.competencia : null)) return;
  if (!versaoConfere(x, g, 'este lançamento', resumoGasto(g), pick(g))) return;
  const antes = {...g};
  if (c.acao === 'edit_expense' || c.acao === 'void_expense') {
    if (g.criadoPor !== autora && !S.dono(autora)) return x.recusa('Só quem lançou (ou a responsável) pode mudar este lançamento.', 'permissao');
    if (!x.motivo && g.criadoPor !== autora) return x.recusa('Mudar o lançamento de outra sócia pede um motivo.');
    if (c.acao === 'void_expense') {
      if (!x.motivo) return x.recusa('Anular pede um motivo.');
      g.estado = 'anulado'; g.anuladoPor = autora; g.anuladoEm = quando; g.motivoAnulacao = x.motivo;
    } else {
      const novo = limparGasto({...g, ...x.d});
      const erro = validarGasto(novo, S.membros);
      if (erro) return x.recusa(erro);
      Object.assign(g, novo);
      if (g.estado === 'conferido') { g.estado = 'lancado'; g.conferidoPor = null; g.conferidoEm = null; }   // os dados mudaram: confere-se de novo
    }
  } else if (c.acao === 'check_expense') {
    if (g.criadoPor === autora) return x.recusa('Quem confere é outra sócia: quem lançou não confere o próprio gasto.', 'permissao');
    if (g.estado === 'conferido') return x.recusa('Este lançamento já foi conferido.');
    g.estado = 'conferido'; g.conferidoPor = autora; g.conferidoEm = quando;
  } else if (c.acao === 'mark_reimbursed') { // legado do treino: qualquer sócia marca; conta como reembolso no F12
    if (g.destino !== 'empresa_reembolsa' && g.destino !== 'dividir') return x.recusa('Este gasto não tem reembolso a marcar.');
    const pendencia = semPendencia(g); if (pendencia) return x.recusa(pendencia);
    g.reembolsadoEm = quando; g.reembolsadoPor = autora;
  } else { // convert_to_contribution: o reembolso pendente passa a contar como aporte de quem pagou
    if (g.pagoPor !== autora) return x.recusa('Só quem pagou converte o gasto em aporte.', 'permissao');
    if (g.destino !== 'empresa_reembolsa') return x.recusa('Só um gasto que a empresa reembolsa vira aporte.');
    const pendencia = semPendencia(g); if (pendencia) return x.recusa(pendencia);
    g.convertidoEm = quando; g.convertidoPor = autora;
  }
  versionar(g, x, pick(antes));
  const alcance = c.acao === 'edit_expense' || c.acao === 'void_expense' ? {meses: [antes.competencia, g.competencia]} : null;
  x.registrar({resumo: g.descricao, antes: pick(antes), depois: pick(g), motivo: x.motivo || null}, alcance);
}
function semPendencia(g) {
  const r = reembolso(g);
  return r === 'convertido' ? 'Este gasto já virou aporte.' : r === 'reembolsado' ? 'Este gasto já foi reembolsado.' : null;
}
const encerradaEm = (p, dia) => p.assinatura === 'inactive' || !!(p.encerrado && p.encerrado.desde <= dia);
function novoGasto(S, x) { // add_expense e record_payment ("marcar como paga" = um gasto ligado à assinatura e ao ciclo)
  const {c, autora, quando} = x;
  const g = limparGasto(x.d);
  const erro = validarGasto(g, S.membros);
  if (erro) return x.recusa(erro);
  if (!casa(ID_GASTO, c.alvo)) return x.recusa('Identificador do lançamento inválido.');
  if (S.gastos.has(c.alvo)) return x.recusa('Lançamento repetido.', 'repetido');
  if (travado(S, x, g.competencia)) return;
  let ciclo = null, plano = null;
  if (c.acao === 'record_payment') {
    plano = S.planos.get(g.planoId);
    if (!plano) return x.recusa('Escolha a assinatura que foi paga.');
    ciclo = x.d.ciclo;
    if (!mesValido(ciclo)) return x.recusa('Informe o ciclo pago (mês e ano).');
    if (encerradaEm(plano, g.data)) return x.recusa('Esta assinatura está encerrada: reative antes de marcar como paga.');
    // um add_expense comum com planoId também paga o ciclo da competência dele: são dois caminhos para o mesmo fato
    if ([...S.gastos.values()].some(o => o.estado !== 'anulado' && o.planoId === plano.id && (o.ciclo || o.competencia) === ciclo)) return x.recusa(`Esta assinatura já foi marcada como paga em ${nomeDoMes(ciclo)}.`, 'repetido');
  }
  S.gastos.set(c.alvo, {id: c.alvo, versao: 1, ...g, ciclo, estado: 'lancado', criadoPor: autora, criadoEm: quando, alteradoPor: null, alteradoEm: null,
    reembolsadoEm: null, conferidoPor: null, conferidoEm: null, convertidoPor: null, convertidoEm: null, reembolsoId: null, versoes: []});
  x.registrar({resumo: plano ? `${plano.servico || g.descricao} · ${nomeDoMes(ciclo)} · ${fmt(g.valorMinor, g.moeda)}` : g.descricao, depois: g}, {meses: [g.competencia]});
}
// F4: a fatura substitui a estimativa. Cada item: gasto em moeda estrangeira, da mesma forma de pagamento e da competência.
function conciliarFatura(S, x) {
  const d = x.d;
  if (!mesValido(d.mes)) return x.recusa('Informe o mês da fatura.');
  if (!FORMA[d.forma]) return x.recusa('Escolha o cartão ou a conta da fatura.');
  if (travado(S, x, d.mes)) return;
  const itens = Array.isArray(d.itens) ? d.itens : [];
  if (!itens.length || itens.length > 500) return x.recusa('Escolha ao menos um gasto da fatura.');
  const total = d.totalFaturaMinor ?? null;
  if (total !== null && !inteiro(total, 1)) return x.recusa('Total da fatura inválido.');
  const vistos = new Set(), pares = [];
  for (const it of itens) {
    const g = it && typeof it === 'object' ? S.gastos.get(it.alvo) : null;
    if (!g) return x.recusa('Um dos gastos da fatura não existe.');
    if (vistos.has(g.id)) return x.recusa(`"${g.descricao}" aparece duas vezes na fatura.`, 'repetido');
    vistos.add(g.id);
    if (g.estado === 'anulado') return x.recusa(`"${g.descricao}" foi anulado: tire-o da fatura.`);
    if (g.moeda === 'BRL') return x.recusa(`"${g.descricao}" já está em reais: a fatura só corrige gasto em moeda estrangeira.`);
    if (g.forma !== d.forma) return x.recusa(`"${g.descricao}" foi pago de outra forma (${rotuloForma(g.forma)}).`);
    if (g.competencia !== d.mes) return x.recusa(`"${g.descricao}" é de outra competência (${nomeDoMes(g.competencia)}).`);
    if (!versaoConfere(x, g, `"${g.descricao}"`, resumoGasto(g), pick(g), it.versao)) return;
    if (!inteiro(it.faturaBrlMinor, 1)) return x.recusa(`Informe o valor cobrado na fatura para "${g.descricao}".`);
    pares.push([g, it.faturaBrlMinor]);
  }
  const fatura = pares.reduce((s, [, v]) => s + v, 0);
  if (total !== null && fatura !== total) return x.recusa(`Os itens somam ${fmt(fatura)}, mas a fatura diz ${fmt(total)}.`);
  const lista = parametros({parametros: S.params});
  let estimado = 0;
  for (const [g] of pares) { const r = reaisDoGasto({...g, faturaBrlMinor: null}, lista); estimado = r.brl === null || estimado === null ? null : estimado + r.brl; }
  const antes = pares.map(([g]) => ({id: g.id, faturaBrlMinor: g.faturaBrlMinor}));
  for (const [g, v] of pares) { const a = pick(g); g.faturaBrlMinor = v; versionar(g, x, a); }
  const delta = estimado === null ? null : fatura - estimado;
  x.registrar({alvo: `${d.mes}:${d.forma}`, resumo: `Fatura de ${nomeDoMes(d.mes)} (${rotuloForma(d.forma)}): estimado ${estimado === null ? 'sem câmbio' : fmt(estimado)} → fatura ${fmt(fatura)} · diferença ${comSinal(delta)}`,
    antes: {estimadoMinor: estimado, itens: antes}, depois: {faturaMinor: fatura, totalFaturaMinor: total, itens: pares.map(([g]) => ({id: g.id, faturaBrlMinor: g.faturaBrlMinor}))}, diferencaMinor: delta}, {meses: [d.mes]});
}

// ── parâmetros com vigência (F2) ─────────────────────────────────────────────────────────────────────────────────
function aplicarParametro(S, x) {
  const d = x.d, item = ITEM[d.chave];
  if (!item) return x.recusa('Parâmetro desconhecido.');
  const v = decimal(d.valor, item.casas);
  if (!v) return x.recusa(`Valor inválido para ${item.rotulo} (até ${item.casas} casas decimais).`);
  const num = Number(v.n) / Number(v.d);
  if (num < item.dura[0] || num > item.dura[1]) return x.recusa(`${item.rotulo} fora da faixa aceita (${item.dura[0]} a ${item.dura[1]} ${item.unidade}).`);
  if (!diaValido(d.desde)) return x.recusa('Informe a partir de quando o valor vale.');
  const anterior = vigente(parametros({parametros: S.params}), d.chave, d.desde);
  const p = {id: x.ev.id, seq: x.ev.seq, chave: d.chave, valor: String(d.valor).trim().replace(',', '.'), desde: d.desde, fonte: texto(d.fonte) || 'informado no portal', estado: d.estado === 'a_confirmar' ? 'a_confirmar' : 'vigente', nota: texto(d.nota, 400), por: x.autora, quando: x.quando};
  S.params.push(p);
  x.registrar({alvo: d.chave, resumo: `${item.rotulo}: ${p.valor} ${item.unidade} desde ${p.desde}`, antes: anterior ? {valor: anterior.valor, desde: anterior.desde, fonte: anterior.fonte} : null, depois: p}, {desde: d.desde});
}

// ── assinaturas e passos de venda: base do pacote + eventos por id e versão (§3.12) ─────────────────────────────────
// Por dentro, em português; estadoEfetivo devolve no formato do pacote (amountMinor, currency, period...) para o domain.js.
const CAMPOS_PLANO = ['servico', 'plano', 'valorMinor', 'moeda', 'periodo', 'diaVencimento', 'proximaData', 'categoria', 'status'];
const TEXTO_PLANO = {servico: 80, plano: 80, status: 240};
function planoDoPacote(p) {
  return {id: p.id, versao: 1, doPacote: true, servico: p.servico ?? '', plano: p.plano ?? '', valorMinor: p.amountMinor ?? null, moeda: p.currency ?? null, periodo: p.period ?? '',
    diaVencimento: p.monthlyDay ?? null, proximaData: p.nextDate ?? null, categoria: CATEGORIA[p.category] ? p.category : null, status: typeof p.status === 'string' ? p.status : '',
    confirmado: p.confirmed === true, assinatura: p.archivedAt != null ? 'inactive' : (p.subscriptionState || p.subscription_state || null), encerrado: null,
    criadoPor: null, criadoEm: null, alteradoPor: null, alteradoEm: null, dadosPor: null, confirmadoPor: null, confirmadoEm: null, versoes: []};
}
function passoDoPacote(s) {
  return {id: s.id, versao: 1, doPacote: true, texto: s.text ?? '', produto: s.product ?? '', feito: s.checked === true, marcadoPor: null, marcadoEm: null, criadoPor: null, criadoEm: null, alteradoPor: null, alteradoEm: null, versoes: []};
}
function limparPlano(d, campos) {
  const p = {};
  for (const k of campos) { const v = d[k]; p[k] = TEXTO_PLANO[k] ? (typeof v === 'string' ? texto(v, TEXTO_PLANO[k]) : v ?? '') : v ?? null; }
  return p;
}
function validarPlano(p, campos) {
  const tem = k => campos.includes(k);
  if (tem('servico') && (typeof p.servico !== 'string' || !p.servico)) return 'Informe o serviço.';
  if (tem('plano') && typeof p.plano !== 'string') return 'Nome do plano inválido.';
  if (tem('valorMinor') && !inteiro(p.valorMinor, 1)) return 'Informe um valor maior que zero.';
  if (tem('moeda') && !moedaOk(p.moeda)) return 'Moeda não suportada.';
  if (tem('periodo') && !(typeof p.periodo === 'string' && EQUIVALENTE[p.periodo])) return 'Escolha o período da cobrança (mensal, trimestral, semestral, anual…).';
  if (tem('diaVencimento') && p.diaVencimento !== null && !(Number.isInteger(p.diaVencimento) && p.diaVencimento >= 1 && p.diaVencimento <= 31)) return 'O dia do vencimento vai de 1 a 31.';
  if (tem('proximaData') && p.proximaData !== null && !diaValido(p.proximaData)) return 'Próxima data inválida.';
  if (tem('categoria') && !CATEGORIA[p.categoria]) return 'Escolha uma categoria.';
  if (tem('status') && typeof p.status !== 'string') return 'Status inválido.';
  return null;
}
const pickPlano = p => ({servico: p.servico, plano: p.plano, valorMinor: p.valorMinor, moeda: p.moeda, periodo: p.periodo, diaVencimento: p.diaVencimento, proximaData: p.proximaData,
  categoria: p.categoria, status: p.status, confirmado: p.confirmado, assinatura: p.assinatura, encerrado: p.encerrado ? {...p.encerrado} : null});
const resumoPlano = p => [p.servico, p.plano].filter(Boolean).join(' · ') + (Number.isSafeInteger(p.valorMinor) && moedaOk(p.moeda) ? ' · ' + fmt(p.valorMinor, p.moeda) : '');
const encerrada = p => p.assinatura === 'inactive' || !!p.encerrado;
function aplicarPlano(S, x) {
  const {c, autora, quando} = x;
  if (c.acao === 'toggle_step') return marcarPasso(S, x);
  if (c.acao === 'add_plan') { // qualquer sócia cria; nasce a confirmar (fora do previsto) e ativa
    if (!casa(ID_PLANO, c.alvo)) return x.recusa('Identificador da assinatura inválido.');
    const p = limparPlano(x.d, CAMPOS_PLANO);
    const erro = validarPlano(p, CAMPOS_PLANO);
    if (erro) return x.recusa(erro);
    if (S.planos.has(c.alvo)) return x.recusa('Assinatura repetida.', 'repetido');
    const novo = {id: c.alvo, versao: 1, doPacote: false, ...p, confirmado: false, assinatura: 'active', encerrado: null, criadoPor: autora, criadoEm: quando, alteradoPor: null, alteradoEm: null,
      dadosPor: autora, confirmadoPor: null, confirmadoEm: null, versoes: []};
    S.planos.set(c.alvo, novo);
    return x.registrar({resumo: resumoPlano(novo), depois: pickPlano(novo)}, {planos: true});
  }
  const p = S.planos.get(c.alvo);
  if (!p) return x.recusa('A assinatura não existe.');
  if (!versaoConfere(x, p, 'esta assinatura', resumoPlano(p), pickPlano(p))) return;
  const antes = pickPlano(p);
  if (c.acao === 'edit_plan') { // dados parciais, inclusive o status livre; mudar valor, moeda ou período tira a confirmação
    const campos = CAMPOS_PLANO.filter(k => x.d[k] !== undefined);
    if (!campos.length) return x.recusa('Diga o que mudou na assinatura.');
    const novo = limparPlano(x.d, campos);
    const erro = validarPlano(novo, campos);
    if (erro) return x.recusa(erro);
    const cobranca = ['valorMinor', 'moeda', 'periodo'].some(k => campos.includes(k) && novo[k] !== p[k]);
    Object.assign(p, novo);
    p.dadosPor = autora;
    if (cobranca && p.confirmado) { p.confirmado = false; p.confirmadoPor = null; p.confirmadoEm = null; }
  } else if (c.acao === 'confirm_plan') { // quatro olhos: outra sócia que não a última a criar/alterar os dados, ou a responsável
    if (p.confirmado) return x.recusa('Esta assinatura já está confirmada.');
    if (p.dadosPor === autora && !S.dono(autora)) return x.recusa('Quem confirma a assinatura é outra sócia: são quatro olhos nos dados da fatura.', 'permissao');
    if (!inteiro(p.valorMinor, 1) || !moedaOk(p.moeda) || !EQUIVALENTE[normal(p.periodo)]) return x.recusa('Complete valor, moeda e período antes de confirmar.');
    p.confirmado = true; p.confirmadoPor = autora; p.confirmadoEm = quando;
    if (p.assinatura === 'unconfirmed') p.assinatura = 'active';
  } else if (c.acao === 'archive_plan') {
    if (encerrada(p)) return x.recusa('Esta assinatura já está encerrada.');
    if (!diaValido(x.d.desde)) return x.recusa('Informe desde quando a assinatura deixa de valer.');
    if (!x.motivo) return x.recusa('Encerrar pede um motivo.');
    p.encerrado = {desde: x.d.desde, por: autora, em: quando, motivo: x.motivo};
  } else { // reactivate_plan
    if (!encerrada(p)) return x.recusa('Esta assinatura já está ativa.');
    p.assinatura = 'active'; p.encerrado = null;
  }
  versionar(p, x, antes);
  x.registrar({resumo: resumoPlano(p), antes, depois: pickPlano(p), motivo: x.motivo || null}, {planos: true});
}
function marcarPasso(S, x) { // qualquer sócia, pelo id do passo do pacote e pela versão
  const s = S.passos.get(x.c.alvo);
  if (!s) return x.recusa('O passo não existe.');
  if (typeof x.d.feito !== 'boolean') return x.recusa('Diga se o passo foi feito.');
  if (!versaoConfere(x, s, 'este passo', s.texto + (s.feito ? ' (feito)' : ''), {feito: s.feito})) return;
  const antes = {feito: s.feito};
  s.feito = x.d.feito; s.marcadoPor = s.feito ? x.autora : null; s.marcadoEm = s.feito ? x.quando : null;
  versionar(s, x, antes);
  x.registrar({verbo: s.feito ? 'marcou o passo' : 'desmarcou o passo', resumo: [s.produto, s.texto].filter(Boolean).join(' · '), antes, depois: {feito: s.feito}});
}

// ── dinheiro: acertos (reembolso, Pix entre sócias, aporte, retirada), saldos informados e receitas agregadas ──────────
export const TIPOS_ACERTO = [
  {id: 'reembolso_empresa', rotulo: 'Reembolso da empresa', verbo: 'registrou o reembolso'},
  {id: 'acerto_entre_socias', rotulo: 'Acerto entre sócias', verbo: 'registrou o acerto'},
  {id: 'aporte', rotulo: 'Aporte na empresa', verbo: 'registrou o aporte'},
  {id: 'retirada', rotulo: 'Retirada da empresa', verbo: 'registrou a retirada'},
];
export const FORMAS_ACERTO = [{id: 'pix', rotulo: 'Pix'}, {id: 'transferencia', rotulo: 'Transferência'}, {id: 'dinheiro', rotulo: 'Dinheiro'}, {id: 'outro', rotulo: 'Outro'}];
export const CANAIS = [{id: 'hotmart', rotulo: 'Hotmart'}, {id: 'stripe', rotulo: 'Stripe'}, {id: 'apple', rotulo: 'Apple'}, {id: 'google', rotulo: 'Google'}, {id: 'outro', rotulo: 'Outro'}];
const CAMPOS_RECEITA = ['competencia', 'canal', 'produto', 'brutoMinor', 'canceladosMinor', 'moeda', 'transacoes', 'taxasMinor', 'pagantesAtivos', 'pagantesNovos', 'pagantesPerdidos', 'testes', 'cadastros'];
const CONTAGENS = {pagantesAtivos: 'pagantes ativos', pagantesNovos: 'pagantes novos', pagantesPerdidos: 'pagantes perdidos', testes: 'testes', cadastros: 'cadastros'};
function limparReceita(d) {
  const r = {};
  for (const k of CAMPOS_RECEITA) r[k] = k === 'produto' ? texto(d[k], 60) : d[k] ?? null;
  return r;
}
function validarReceita(r) {
  if (!mesValido(r.competencia)) return 'Competência inválida.';
  if (!CANAIS.some(c => c.id === r.canal)) return 'Escolha o canal: Hotmart, Stripe, Apple, Google ou outro.';
  if (!inteiro(r.brutoMinor)) return 'Informe a receita bruta, já sem os cancelamentos (zero ou mais).';
  if (!opcional(r.canceladosMinor)) return 'Valor dos cancelamentos inválido.';
  if (r.moeda !== 'BRL' && r.moeda !== 'USD') return 'A receita é em reais ou em dólar.';
  if (!inteiro(r.transacoes)) return 'Informe o número de vendas (zero ou mais).';
  if (!opcional(r.taxasMinor)) return 'Valor das taxas inválido.';
  for (const [k, rotulo] of Object.entries(CONTAGENS)) if (!opcional(r[k])) return `Contagem inválida: ${rotulo}.`;
  return null;
}
const pickReceita = r => Object.fromEntries([...CAMPOS_RECEITA, 'estado'].map(k => [k, r[k]]));
const resumoReceita = r => [(CANAIS.find(c => c.id === r.canal) || {}).rotulo || r.canal, r.produto, nomeDoMes(r.competencia), fmt(r.brutoMinor, r.moeda)].filter(Boolean).join(' · ');
function aplicarDinheiro(S, x) {
  const {c} = x;
  if (c.acao === 'record_settlement') return registrarAcerto(S, x);
  if (c.acao === 'confirm_settlement') return confirmarAcerto(S, x);
  if (c.acao === 'set_balance') return informarSaldo(S, x);
  return aplicarReceita(S, x);
}
function registrarAcerto(S, x) {
  const {c, autora, quando} = x, d = x.d;
  if (!casa(ID_ACERTO, c.alvo)) return x.recusa('Identificador do acerto inválido.');
  const tipo = TIPOS_ACERTO.find(t => t.id === d.tipo);
  if (!tipo) return x.recusa('Escolha o tipo: reembolso, acerto entre sócias, aporte ou retirada.');
  const daEmpresa = tipo.id === 'reembolso_empresa' || tipo.id === 'retirada';
  if (daEmpresa && (d.de !== 'empresa' || !S.socia(d.para))) return x.recusa('No reembolso e na retirada, quem paga é a empresa e quem recebe é uma sócia.');
  if (tipo.id === 'acerto_entre_socias' && (!S.socia(d.de) || !S.socia(d.para) || d.de === d.para)) return x.recusa('O acerto é entre duas sócias diferentes.');
  if (tipo.id === 'aporte' && (!S.socia(d.de) || d.para !== 'empresa')) return x.recusa('No aporte, uma sócia põe dinheiro na empresa.');
  if (!inteiro(d.valorMinor, 1)) return x.recusa('Informe um valor maior que zero.');
  if ((d.moeda ?? 'BRL') !== 'BRL') return x.recusa('Acertos são em reais.');
  if (!diaValido(d.data)) return x.recusa('Informe a data do pagamento.');
  if (!FORMAS_ACERTO.some(f => f.id === d.forma)) return x.recusa('Escolha como foi pago: Pix, transferência, dinheiro ou outro.');
  const gastoIds = d.gastoIds ?? [];
  if (!Array.isArray(gastoIds) || gastoIds.length > 500) return x.recusa('Lista de gastos inválida.');
  if (gastoIds.length && tipo.id !== 'reembolso_empresa') return x.recusa('Só o reembolso aponta gastos.');
  // permissão pelo papel do estado: o que a empresa paga, só a responsável registra; acerto e aporte, quem pagou
  if (daEmpresa && !S.dono(autora)) return x.recusa('Só a responsável registra o que a empresa paga (reembolso ou retirada).', 'permissao');
  if (!daEmpresa && autora !== d.de) return x.recusa('Quem registra o pagamento é quem pagou.', 'permissao');
  if (S.acertos.has(c.alvo)) return x.recusa('Acerto repetido.', 'repetido');
  const gastos = [];
  if (gastoIds.length) { // cada gasto é um reembolso pendente de quem recebe, e o valor é a soma deles em reais
    const lista = parametros({parametros: S.params});
    let soma = 0;
    for (const id of gastoIds) {
      const g = S.gastos.get(id);
      if (!g) return x.recusa('Um dos gastos escolhidos não existe.');
      if (gastos.includes(g)) return x.recusa(`"${g.descricao}" foi escolhido duas vezes.`, 'repetido');
      if (g.estado === 'anulado' || g.destino !== 'empresa_reembolsa' || g.pagoPor !== d.para || reembolso(g) !== 'pendente') return x.recusa(`"${g.descricao}" não é um reembolso pendente de ${S.nome(d.para)}.`);
      const r = reaisDoGasto(g, lista);
      if (r.brl === null) return x.recusa(`Falta o câmbio de "${g.descricao}": concilie a fatura antes.`);
      soma += r.brl; gastos.push(g);
    }
    if (soma !== d.valorMinor) return x.recusa(`O valor não bate com os gastos escolhidos (${fmt(soma)}).`);
  }
  const a = {id: c.alvo, versao: 1, tipo: tipo.id, de: d.de, para: d.para, valorMinor: d.valorMinor, moeda: 'BRL', data: d.data, forma: d.forma, gastoIds: gastos.map(g => g.id), nota: texto(d.nota, 400),
    criadoPor: autora, criadoEm: quando, confirmadoPor: null, confirmadoEm: null};
  S.acertos.set(c.alvo, a);
  for (const g of gastos) { const antes = pick(g); g.reembolsoId = a.id; versionar(g, x, antes); }
  x.registrar({verbo: tipo.verbo, resumo: `${S.nome(a.de)} → ${S.nome(a.para)} · ${fmt(a.valorMinor)}`, depois: {...a}});
}
function confirmarAcerto(S, x) { // só quem recebe confirma (a responsável, quando quem recebe é a empresa)
  const a = S.acertos.get(x.c.alvo);
  if (!a) return x.recusa('O acerto não existe.');
  if (a.para === 'empresa' ? !S.dono(x.autora) : x.autora !== a.para) return x.recusa('Só quem recebe confirma o recebimento.', 'permissao');
  if (a.confirmadoPor) return x.recusa('Este recebimento já foi confirmado.');
  const antes = {confirmadoPor: null, confirmadoEm: null};
  a.confirmadoPor = x.autora; a.confirmadoEm = x.quando; a.versao++;
  x.registrar({resumo: `${S.nome(a.de)} → ${S.nome(a.para)} · ${fmt(a.valorMinor)}`, antes, depois: {confirmadoPor: a.confirmadoPor, confirmadoEm: a.confirmadoEm}});
}
function informarSaldo(S, x) { // qualquer sócia; vale o de maior data por conta (desempate: o mais novo no diário)
  const {c, autora, quando} = x, d = x.d;
  if (!casa(ID_SALDO, c.alvo)) return x.recusa('Identificador do saldo inválido.');
  const conta = texto(d.conta, 60);
  if (!conta) return x.recusa('Informe a conta.');
  if (!diaValido(d.data)) return x.recusa('Informe a data do saldo.');
  const hoje = diaDoEvento(quando);
  if (hoje && d.data > hoje) return x.recusa('O saldo é de uma data que ainda não chegou.');
  if (!inteiro(d.valorMinor)) return x.recusa('Informe um saldo de zero para cima.');
  if (!moedaOk(d.moeda)) return x.recusa('Moeda não suportada.');
  if (S.saldos.has(c.alvo)) return x.recusa('Saldo repetido.', 'repetido');
  const s = {id: c.alvo, seq: x.ev.seq, conta, data: d.data, valorMinor: d.valorMinor, moeda: d.moeda, fonte: texto(d.fonte) || 'informado no portal', nota: texto(d.nota, 400), criadoPor: autora, criadoEm: quando, vigente: false};
  S.saldos.set(c.alvo, s);
  x.registrar({resumo: `${conta} · ${fmt(s.valorMinor, s.moeda)} em ${s.data}`, depois: {conta, data: s.data, valorMinor: s.valorMinor, moeda: s.moeda, fonte: s.fonte}});
}
function aplicarReceita(S, x) { // qualquer sócia (interino, como os parâmetros: ver as decisões da F2-1)
  const {c, autora, quando} = x;
  if (c.acao === 'add_income') {
    if (!casa(ID_RECEITA, c.alvo)) return x.recusa('Identificador da receita inválido.');
    const r = limparReceita(x.d);
    const erro = validarReceita(r);
    if (erro) return x.recusa(erro);
    if (S.receitas.has(c.alvo)) return x.recusa('Receita repetida.', 'repetido');
    if (travado(S, x, r.competencia)) return;
    const nova = {id: c.alvo, versao: 1, ...r, estado: 'lancado', criadoPor: autora, criadoEm: quando, alteradoPor: null, alteradoEm: null, versoes: []};
    S.receitas.set(c.alvo, nova);
    return x.registrar({resumo: resumoReceita(nova), depois: pickReceita(nova)}, {meses: [r.competencia]});
  }
  const r = S.receitas.get(c.alvo);
  if (!r) return x.recusa('A receita não existe.');
  if (r.estado === 'anulado') return x.recusa('A receita já foi anulada.');
  if (travado(S, x, r.competencia, c.acao === 'edit_income' ? x.d.competencia : null)) return;
  if (!versaoConfere(x, r, 'esta receita', resumoReceita(r), pickReceita(r))) return;
  const antes = pickReceita(r);
  if (c.acao === 'void_income') {
    if (!x.motivo) return x.recusa('Anular pede um motivo.');
    r.estado = 'anulado'; r.anuladoPor = autora; r.anuladoEm = quando; r.motivoAnulacao = x.motivo;
  } else {
    if (!x.motivo && r.criadoPor !== autora) return x.recusa('Mudar a receita de outra sócia pede um motivo.');
    const nova = limparReceita({...r, ...x.d});
    const erro = validarReceita(nova);
    if (erro) return x.recusa(erro);
    Object.assign(r, nova);
  }
  versionar(r, x, antes);
  x.registrar({resumo: resumoReceita(r), antes, depois: pickReceita(r), motivo: x.motivo || null}, {meses: [antes.competencia, r.competencia]});
}

// ── o mês: fechar (congela os números com o selo) e reabrir (com motivo). Só a responsável (D3, D8). ────────────────
function aplicarMes(S, x) {
  const {c, autora, quando} = x, mes = c.alvo;
  if (!mesValido(mes)) return x.recusa('Mês inválido.');
  if (c.acao === 'reopen_month') {
    if (!S.dono(autora)) return x.recusa('Só a responsável reabre o mês.', 'permissao');
    if (!fechado(S, mes)) return x.recusa(`${Mes(mes)} não está fechado.`);
    if (!x.motivo) return x.recusa('Reabrir pede um motivo: ele fica no Histórico.');
    const f = S.fechamentos[mes];
    f.fechado = false;
    f.reaberturas.push({seq: x.ev.seq, por: autora, em: quando, motivo: x.motivo, selo: f.selo});
    return x.registrar({resumo: `${Mes(mes)} · selo ${f.selo.slice(0, 8)}`, antes: {fechado: true, selo: f.selo}, depois: {fechado: false}, motivo: x.motivo});
  }
  if (!S.dono(autora)) return x.recusa('Só a responsável fecha o mês.', 'permissao');
  const hoje = diaDoEvento(quando);
  if (!hoje || mes >= hoje.slice(0, 7)) return x.recusa('Só dá para fechar um mês que já terminou.');
  if (fechado(S, mes)) return x.recusa(`${Mes(mes)} já está fechado.`, 'mes_fechado');
  const d = x.d, t = d.totais && typeof d.totais === 'object' ? d.totais : {};
  if (!inteiro(d.cabeca) || (typeof x.ev.seq === 'number' && d.cabeca >= x.ev.seq)) return x.recusa('Posição do diário inválida: confira e feche de novo.');
  if (!casa(/^[0-9a-f]{64}$/, d.selo)) return x.recusa('Selo inválido.');
  if (!inteiro(t.realizado) || !inteiro(t.previsto) || !inteiro(t.total) || !Number.isSafeInteger(t.resultado)) return x.recusa('Totais inválidos.');
  if (t.realizado + t.previsto !== t.total) return x.recusa('Os totais não fecham: realizado + previsto tem de dar o total.');
  // concorrência: não se exige a cabeça exata (num 409 o diario.js reenvia o mesmo conteúdo numa posição seguinte);
  // recusa só se, depois da cabeça, entrou evento aceito que muda os números DESTE mês
  const ultimo = ultimoDiaDo(mes);
  const andou = S.mudancas.find(m => m.seq > d.cabeca && (m.meses.includes(mes) || (m.desde && m.desde <= ultimo) || m.planos));
  if (andou) return x.recusa('O diário andou enquanto você fechava. Confira e feche de novo.', 'versao', {versao: andou.seq, alteradoPor: andou.autora, alteradoEm: andou.quando, resumo: `${VERBOS[andou.acao]}: ${andou.resumo}`});
  const anterior = Object.hasOwn(S.fechamentos, mes) ? S.fechamentos[mes] : null;
  // o mês fechado passa a usar os parâmetros que existiam na cabeça e os planos desta hora (iguais aos da cabeça, pela regra acima)
  const f = {mes, fechado: true, seq: x.ev.seq, cabeca: d.cabeca, selo: d.selo, totais: {realizado: t.realizado, previsto: t.previsto, total: t.total, resultado: t.resultado},
    por: autora, em: quando, ordemParametros: 1 + S.params.filter(p => p.seq <= d.cabeca).length,
    planosNaHora: [...S.planos.values()].map(p => { const {versoes, ...resto} = p; return JSON.parse(JSON.stringify(resto)); }), reaberturas: anterior ? anterior.reaberturas : []};
  S.fechamentos[mes] = f;
  x.registrar({resumo: `${Mes(mes)} · custo ${fmt(t.total)} · selo ${d.selo.slice(0, 8)}`, depois: {selo: f.selo, totais: f.totais, cabeca: f.cabeca}});
}

// ── reais de um gasto (F4): fatura > estimativa > "sem câmbio" (nunca zero) ──────────────────────────────────────────
export function reaisDoGasto(g, lista) {
  if (g.moeda === 'BRL') return {brl: g.valorMinor, tipo: 'real', conta: null};
  if (Number.isSafeInteger(g.faturaBrlMinor) && g.faturaBrlMinor > 0) return {brl: g.faturaBrlMinor, tipo: 'efetivo', conta: {fatura: g.faturaBrlMinor}};
  // sem câmbio vigente na data (gasto anterior ao primeiro registro), usa o registro mais antigo e diz isso na conta
  const cambio = vigente(lista, `fx.${g.moeda}_BRL`, g.data) || maisAntigo(lista, `fx.${g.moeda}_BRL`);
  if (!cambio) return {brl: null, tipo: 'sem_cambio', conta: null};
  const cartao = FORMA[g.forma] && FORMA[g.forma].cartao;
  const spread = cartao ? vigente(lista, 'cartao.spread_pct', g.data) : null;
  const iof = vigente(lista, cartao ? 'iof.cartao_internacional_pct' : 'iof.cambio_servicos_pct', g.data);
  const r = converter(g.valorMinor, cambio.valor, spread ? spread.valor : '0', iof ? iof.valor : '0');
  if (!r) return {brl: null, tipo: 'sem_cambio', conta: null};
  return {brl: r.total, tipo: 'estimado', conta: {principal: r.principal, spreadMinor: r.spread, iofMinor: r.iof, total: r.total, cambio, spreadParam: spread, iofParam: iof, cartao, cambioPosterior: cambio.desde > g.data}};
}
function maisAntigo(lista, chave) {
  let m = null;
  for (const p of lista) if (p.chave === chave && p.estado !== 'substituido' && (!m || p.desde < m.desde)) m = p;
  return m;
}

const EQUIVALENTE = semProto({mensal: [1, 1], mes: [1, 1], monthly: [1, 1], anual: [1, 12], ano: [1, 12], yearly: [1, 12], trimestral: [1, 3], semestral: [1, 6], semanal: [52, 12], quinzenal: [26, 12]});
const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
// F6: entra no previsto do mês a assinatura ativa e confirmada que não foi encerrada até o último dia do mês
const prevista = (p, ultimoDia) => (p.assinatura || 'active') === 'active' && p.confirmado === true && !(p.encerrado && p.encerrado.desde <= ultimoDia);

// ── o mês calculado ───────────────────────────────────────────────────────────────────────────────────────────────
// realizado = gastos lançados com competência no mês; previsto = assinaturas ativas e confirmadas ainda sem gasto ligado
// no mês (convertidas pela estimativa de hoje); custo do mês = realizado + previsto (F5, F6). Mês fechado: usa só os
// parâmetros que existiam no fechamento e os planos daquela hora, então mudar o dólar hoje não mexe nele.
export function livroDoMes(estadoBase, aplicado, mes, hoje) {
  const f = aplicado.fechamentos && Object.hasOwn(aplicado.fechamentos, mes) && aplicado.fechamentos[mes].fechado ? aplicado.fechamentos[mes] : null;
  const lista = f ? parametros(aplicado).filter(p => p.semente || p.ordem < f.ordemParametros) : parametros(aplicado);
  const planos = f ? f.planosNaHora : aplicado.planos || (estadoBase.plans || []).map(planoDoPacote);
  const membros = aplicado.membros;
  const ultimoDia = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).toISOString().slice(0, 10);
  const dataRef = hoje && hoje.slice(0, 7) === mes ? hoje : ultimoDia;
  const linhas = [], incompletos = [];
  const doMes = aplicado.gastos.filter(g => g.competencia === mes);
  for (const g of doMes) {
    const r = reaisDoGasto(g, lista);
    const linha = {tipo: 'realizado', id: g.id, descricao: g.descricao, categoria: g.categoria, data: g.data, original: {minor: g.valorMinor, moeda: g.moeda},
      brl: r.brl, conversao: r.tipo, conta: r.conta, forma: g.forma, pagoPor: g.pagoPor, destino: g.destino, anulado: g.estado === 'anulado', gasto: g};
    if (linha.anulado) { linhas.push(linha); continue; }
    if (r.brl === null) incompletos.push({id: g.id, motivo: `Falta o câmbio de ${g.moeda} para ${g.data}.`, descricao: g.descricao});
    linhas.push(linha);
  }
  const ligados = new Set(doMes.filter(g => g.estado !== 'anulado' && g.planoId).map(g => g.planoId));
  for (const p of planos) {
    if (!prevista(p, ultimoDia) || ligados.has(p.id) || !DIGITOS[p.moeda] || !Number.isSafeInteger(p.valorMinor)) continue;
    const fator = EQUIVALENTE[normal(p.periodo)];
    if (!fator) { incompletos.push({id: p.id, motivo: `Período "${p.periodo}" não reconhecido para o equivalente mensal.`, descricao: p.servico}); continue; }
    const mensal = numero(arred(BigInt(p.valorMinor) * BigInt(fator[0]), BigInt(fator[1])));
    const g = {valorMinor: mensal, moeda: p.moeda, data: dataRef, forma: 'cartao_pj', faturaBrlMinor: null};
    const r = reaisDoGasto(g, lista);
    if (r.brl === null) incompletos.push({id: p.id, motivo: `Falta o câmbio de ${p.moeda} para a previsão.`, descricao: p.servico});
    linhas.push({tipo: 'previsto', id: p.id, descricao: [p.servico, p.plano].filter(Boolean).join(' · '), categoria: CATEGORIA[p.categoria] ? p.categoria : palpiteCategoria(p.servico), data: p.proximaData || null,
      original: {minor: mensal, moeda: p.moeda}, periodo: p.periodo, valorPlano: p.valorMinor, brl: r.brl, conversao: r.tipo === 'real' ? 'real' : 'estimado', conta: r.conta, pagoPor: null, destino: null, anulado: false});
  }
  const validas = linhas.filter(l => !l.anulado && l.brl !== null);
  const soma = arr => arr.reduce((a, l) => a + l.brl, 0);
  const realizado = soma(validas.filter(l => l.tipo === 'realizado'));
  const previsto = soma(validas.filter(l => l.tipo === 'previsto'));
  const total = realizado + previsto;
  const porMoeda = {};
  for (const l of linhas) if (!l.anulado && l.tipo === 'realizado') porMoeda[l.original.moeda] = (porMoeda[l.original.moeda] || 0) + l.original.minor;
  const porCategoria = CATEGORIAS.map(c => ({...c, brl: soma(validas.filter(l => (CATEGORIA[l.categoria] ? l.categoria : 'outros') === c.id))})).filter(c => c.brl > 0).sort((a, b) => b.brl - a.brl);
  const permil = total > 0 && porCategoria.length ? ratearPermil(porCategoria.map(c => c.brl)) : [];
  porCategoria.forEach((c, k) => { c.permil = permil[k] ?? 0; });
  // por sócia: parte do custo do mês pela participação; o que cada uma adiantou do bolso; o que a empresa deve a ela
  // (reembolso pendente: nem reembolsado, nem convertido em aporte)
  const pcts = membros.map(m => m.pct);
  const balanceado = pcts.every(p => typeof p === 'number') && pcts.reduce((a, b) => a + b, 0) === 100;
  const partes = balanceado ? ratear(total, pcts.map(String)) : null;
  const porSocia = membros.map((m, k) => {
    const doBolso = validas.filter(l => l.tipo === 'realizado' && l.pagoPor === m.id && FORMA[l.forma] && !FORMA[l.forma].empresa);
    const aReceber = doBolso.filter(l => l.destino === 'empresa_reembolsa' && reembolso(l.gasto) === 'pendente');
    return {id: m.id, nome: m.nome, pct: m.pct, parte: partes ? partes[k] : null, adiantou: soma(doBolso), aReceberDaEmpresa: soma(aReceber),
      aporte: soma(doBolso.filter(l => l.destino === 'aporte' || reembolso(l.gasto) === 'convertido'))};
  });
  const acerto = acertoEntreSocias(validas.filter(l => l.tipo === 'realizado' && l.destino === 'dividir' && !l.gasto.reembolsadoEm), membros);
  porSocia.forEach(s => { s.saldoAcerto = acerto.saldos[s.id] || 0; });
  return {mes, dataRef, linhas, realizado, previsto, total, porMoeda, porCategoria, porSocia, acerto, incompletos, balanceado,
    fechado: !!f, fechamento: f ? {seq: f.seq, cabeca: f.cabeca, selo: f.selo, totais: f.totais, por: f.por, em: f.em} : null,
    pagoPorEmpresa: soma(validas.filter(l => l.tipo === 'realizado' && FORMA[l.forma] && FORMA[l.forma].empresa)),
    explica: {
      realizado: termos('Realizado', validas.filter(l => l.tipo === 'realizado'), realizado),
      previsto: termos('Previsto', validas.filter(l => l.tipo === 'previsto'), previsto),
      total: {formula: 'Custo do mês = realizado + previsto', termos: [{rotulo: 'Realizado (já lançado)', brl: realizado, op: '+'}, {rotulo: 'Previsto (assinaturas sem lançamento no mês)', brl: previsto, op: '+'}], resultado: total,
        excluidos: [...linhas.filter(l => l.anulado).map(l => ({rotulo: l.descricao, motivo: 'anulado'})), ...incompletos.map(i => ({rotulo: i.descricao, motivo: i.motivo}))]},
    }};
}

// ── estado efetivo: o estado do pacote com as assinaturas e os passos de venda que o diário mudou ────────────────────
// No formato que o domain.js valida e projeta (buildSnapshot), para as páginas antigas refletirem o diário sem reescrita.
// O pacote não é alterado; plano ou passo sem evento sai igual ao do pacote.
export function estadoEfetivo(estadoBase, aplicado, hoje) {
  const dia = diaValido(hoje) ? hoje : null;
  const porId = new Map((aplicado.planos || []).map(p => [p.id, p]));
  const pagos = new Map();   // planoId → o pagamento do ciclo mais recente (record_payment ou add_expense com planoId)
  for (const g of aplicado.gastos || []) {
    if (g.estado === 'anulado' || !g.planoId) continue;
    const ciclo = g.ciclo || g.competencia, atual = pagos.get(g.planoId);
    if (!atual || ciclo >= atual.ciclo) pagos.set(g.planoId, {ciclo, gasto: g});
  }
  const plans = (estadoBase.plans || []).map(base => planoEfetivo(base, porId.get(base.id), pagos.get(base.id), dia));
  for (const p of aplicado.planos || []) if (!p.doPacote) plans.push(planoEfetivo(null, p, pagos.get(p.id), dia));
  const passos = new Map((aplicado.passos || []).map(s => [s.id, s]));
  const selling = estadoBase.selling && typeof estadoBase.selling === 'object' ? {...estadoBase.selling, steps: (estadoBase.selling.steps || []).map(row => {
    const s = passos.get(row.id);
    if (!s || s.versao === 1) return {...row};
    return {...row, checked: s.feito, checkedBy: s.marcadoPor, checkedAt: s.marcadoEm, changedBy: s.alteradoPor, changedAt: s.alteradoEm, version: s.versao};
  })} : estadoBase.selling;
  return {...estadoBase, plans, selling};
}
function planoEfetivo(base, p, pago, hoje) {
  const r = base ? {...base} : {id: p.id};
  const por = (chave, valor) => { if (!(valor === null && r[chave] === undefined)) r[chave] = valor; };   // null não cria campo que o pacote não tinha
  if (p && (!p.doPacote || p.versao > 1)) {
    por('servico', p.servico); por('plano', p.plano); por('amountMinor', p.valorMinor); por('currency', p.moeda); por('period', p.periodo);
    por('monthlyDay', p.diaVencimento); por('nextDate', p.proximaData); por('category', p.categoria); por('status', p.status);
    r.confirmed = p.confirmado; r.version = p.versao;
    const encerradoHoje = p.encerrado && (!hoje || p.encerrado.desde <= hoje);
    if (encerradoHoje) r.subscriptionState = 'inactive'; else por('subscriptionState', p.assinatura);
    por('archivedAt', p.encerrado ? p.encerrado.desde : null); por('archivedBy', p.encerrado ? p.encerrado.por : null); por('archiveReason', p.encerrado ? p.encerrado.motivo : null);
    if (!p.doPacote) { r.createdAt = p.criadoEm; r.createdBy = p.criadoPor; }
    por('changedAt', p.alteradoEm); por('changedBy', p.alteradoPor); por('confirmedAt', p.confirmadoEm); por('confirmedBy', p.confirmadoPor);
  }
  // pago: o ciclo do pagamento cobre hoje → "pago", com a próxima data no ciclo seguinte (no dia do vencimento)
  if (pago && hoje) {
    const fator = EQUIVALENTE[normal(r.period)], meses = fator && fator[0] === 1 ? fator[1] : null;
    const fim = somarMeses(pago.ciclo, meses || 1);
    if (hoje.slice(0, 7) < fim) {
      r.paymentStatus = 'pago'; r.paymentStatusExplicit = true; r.paidCycle = pago.ciclo; r.paidExpenseId = pago.gasto.id;
      if (meses) {
        const diaDoPlano = Number.isInteger(r.monthlyDay) && r.monthlyDay >= 1 && r.monthlyDay <= 31 ? r.monthlyDay : diaValido(r.nextDate) ? +r.nextDate.slice(8) : diaValido(pago.gasto.data) ? +pago.gasto.data.slice(8) : 1;
        r.nextDate = `${fim}-${String(Math.min(diaDoPlano, +ultimoDiaDo(fim).slice(8))).padStart(2, '0')}`;
      }
    }
  }
  return r;
}
function termos(rotulo, linhas, total) {
  return {formula: `${rotulo} = soma em reais de cada item (moeda estrangeira convertida no dia do gasto)`, resultado: total,
    termos: linhas.map(l => ({rotulo: l.descricao, brl: l.brl, op: '+', original: l.original, conversao: l.conversao, conta: l.conta, id: l.id}))};
}
function ratearPermil(valores) { // percentuais de composição que somam exatamente 1000‰ (F15)
  const T = valores.reduce((a, b) => a + b, 0);
  if (!T) return valores.map(() => 0);
  const exato = valores.map(v => BigInt(v) * 1000n), inteiro = exato.map(x => x / BigInt(T));
  let resto = 1000n - inteiro.reduce((a, b) => a + b, 0n);
  exato.map((x, k) => ({k, r: x % BigInt(T)})).sort((a, b) => a.r === b.r ? a.k - b.k : a.r > b.r ? -1 : 1).forEach(({k}) => { if (resto > 0n) { inteiro[k]++; resto--; } });
  return inteiro.map(Number);
}
// F11: saldo = pagou − parte; a soma dos saldos é zero; o maior devedor paga o maior credor até zerar
export function acertoEntreSocias(linhas, membros) {
  const saldos = Object.fromEntries(membros.map(m => [m.id, 0]));
  const pcts = membros.map(m => String(m.pct));
  for (const l of linhas) {
    const partes = ratear(l.brl, pcts);
    if (!partes) continue;
    saldos[l.pagoPor] += l.brl;
    membros.forEach((m, k) => { saldos[m.id] -= partes[k]; });
  }
  const credores = Object.entries(saldos).filter(([, v]) => v > 0).map(([id, v]) => ({id, v})).sort((a, b) => b.v - a.v);
  const devedores = Object.entries(saldos).filter(([, v]) => v < 0).map(([id, v]) => ({id, v: -v})).sort((a, b) => b.v - a.v);
  const transferencias = [];
  while (credores.length && devedores.length) {
    const c = credores[0], d = devedores[0], x = Math.min(c.v, d.v);
    transferencias.push({de: d.id, para: c.id, brl: x});
    c.v -= x; d.v -= x;
    if (!c.v) credores.shift();
    if (!d.v) devedores.shift();
  }
  return {saldos, transferencias};
}

// série dos últimos meses com o que já foi lançado (para o gráfico de tendência): realizado por mês, em reais
export function serieMensal(estadoBase, aplicado, ultimoMes, n = 6) {
  const meses = [];
  let [a, m] = ultimoMes.split('-').map(Number);
  for (let k = 0; k < n; k++) { meses.unshift(`${a}-${String(m).padStart(2, '0')}`); m--; if (!m) { m = 12; a--; } }
  return meses.map(mes => { const l = livroDoMes(estadoBase, aplicado, mes, null); return {mes, realizado: l.realizado, previsto: l.previsto, temLancamento: l.linhas.some(x => x.tipo === 'realizado' && !x.anulado)}; });
}

// ── exportar CSV para o contador: ";", vírgula decimal, UTF-8 com BOM, centavos inteiros ao lado do valor formatado ─────
export function csvLancamentos(aplicado, lista, nomes) {
  const esc = v => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const fmt = minor => (minor / 100).toFixed(2).replace('.', ',');
  const cab = ['data', 'competencia', 'descricao', 'categoria', 'moeda', 'valor', 'valor_centavos', 'reais', 'reais_centavos', 'conversao', 'forma', 'pago_por', 'destino', 'estado', 'lancado_por', 'documento'];
  const linhas = aplicado.gastos.map(g => {
    const r = reaisDoGasto(g, lista);
    return [g.data, g.competencia, g.descricao, (CATEGORIA[g.categoria] || {}).rotulo, g.moeda, fmt(g.valorMinor), g.valorMinor, r.brl === null ? '' : fmt(r.brl), r.brl ?? '', r.tipo,
      (FORMA[g.forma] || {}).rotulo, nomes(g.pagoPor), g.destino, g.estado, nomes(g.criadoPor), g.documento || ''].map(esc).join(';');
  });
  return '﻿' + [cab.join(';'), ...linhas].join('\r\n') + '\r\n';
}
export function rotuloCategoria(id) { return (CATEGORIA[id] || CATEGORIA.outros).rotulo; }
export function slotCategoria(id) { return (CATEGORIA[id] || CATEGORIA.outros).slot; }
export function rotuloForma(id) { return (FORMA[id] || {}).rotulo || id; }
export function formaDaEmpresa(id) { return !!(FORMA[id] && FORMA[id].empresa); }
export function itemCatalogo(chave) { return ITEM[chave] || null; }
