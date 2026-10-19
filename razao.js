// O livro-razão do Finanças: lançamentos das sócias, parâmetros com vigência (câmbio, spread, IOF, impostos, taxas) e o
// mês calculado. Puro e determinístico, como o domain.js: recebe o estado canônico + os eventos do diário e devolve
// números em centavos inteiros (BigInt na conta, um arredondamento só, meio para longe do zero). Moedas nunca se somam
// sem uma conversão explícita, e toda conversão carrega a conta que a produziu ("Ver a conta").
// Plano: docs/PLANO-PORTAL.md §4. Testes: testes/razao.test.mjs (node --test).

export const RAZAO_VERSAO = 1;
const DIGITOS = {BRL: 2, USD: 2, EUR: 2};
export const MOEDAS = Object.keys(DIGITOS);

// ── categorias: seis cores fixas + "Outros" (plano §6.2: mais que isso deixa de ser legível e de passar no daltonismo)
export const CATEGORIAS = [
  {id: 'software_ia', rotulo: 'Software e IA', slot: 1},
  {id: 'infraestrutura', rotulo: 'Infraestrutura', slot: 2},
  {id: 'impostos_taxas', rotulo: 'Impostos e taxas', slot: 3},
  {id: 'contabilidade_juridico', rotulo: 'Contabilidade e jurídico', slot: 4},
  {id: 'marketing', rotulo: 'Marketing', slot: 5},
  {id: 'banco_cambio', rotulo: 'Banco e câmbio', slot: 6},
  {id: 'equipamento', rotulo: 'Equipamento', slot: 0},
  {id: 'outros', rotulo: 'Outros', slot: 0},
];
const CATEGORIA = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));
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
const FORMA = Object.fromEntries(FORMAS.map(f => [f.id, f]));
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
];
const ITEM = Object.fromEntries(CATALOGO.map(c => [c.chave, c]));
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
const DIA = /^\d{4}-\d{2}-\d{2}$/, MES = /^\d{4}-\d{2}$/;
const texto = (v, max = 160) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';

function validarGasto(g, membros) {
  if (!DIA.test(g.data || '')) return 'Informe a data do gasto.';
  if (!MES.test(g.competencia || '')) return 'Competência inválida.';
  if (!texto(g.descricao)) return 'Descreva o gasto.';
  if (!Number.isSafeInteger(g.valorMinor) || g.valorMinor <= 0) return 'Informe um valor maior que zero.';
  if (!DIGITOS[g.moeda]) return 'Moeda não suportada.';
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

export const ACOES = ['add_expense', 'edit_expense', 'void_expense', 'set_parameter', 'mark_reimbursed'];
export function aplicar(estadoBase, eventos) {
  const membros = (estadoBase.members || []).map(m => ({id: m.id, nome: m.displayName, papel: m.role, pct: m.participationPct}));
  const dono = id => (membros.find(m => m.id === id) || {}).papel === 'owner';
  const gastos = new Map(), params = [], recusados = [], historico = [];
  for (const ev of eventos) {
    const c = ev.conteudo || {}, autora = ev.membro, quando = c.quando || ev.ts || null;
    const recusa = motivo => { recusados.push({id: ev.id, seq: ev.seq, autora, acao: c.acao, motivo, quando}); };
    if (!membros.some(m => m.id === autora)) { recusa('Autora desconhecida neste painel.'); continue; }
    if (!ACOES.includes(c.acao)) { recusa('Registro de um tipo que esta versão não entende: recarregue o portal.'); continue; }
    if (c.acao === 'add_expense') {
      const g = limparGasto(c.dados || {});
      const erro = validarGasto(g, membros);
      if (erro) { recusa(erro); continue; }
      if (gastos.has(c.alvo)) { recusa('Lançamento repetido.'); continue; }
      gastos.set(c.alvo, {id: c.alvo, versao: 1, ...g, estado: 'lancado', criadoPor: autora, criadoEm: quando, alteradoPor: null, alteradoEm: null, reembolsadoEm: null, versoes: []});
      historico.push({seq: ev.seq, id: ev.id, autora, quando, acao: c.acao, alvo: c.alvo, resumo: g.descricao, depois: g});
    } else if (c.acao === 'edit_expense' || c.acao === 'void_expense' || c.acao === 'mark_reimbursed') {
      const g = gastos.get(c.alvo);
      if (!g) { recusa('O lançamento não existe.'); continue; }
      if (g.estado === 'anulado') { recusa('O lançamento já foi anulado.'); continue; }
      if (c.versao !== g.versao) { recusa(`Outra pessoa mudou este lançamento antes (versão ${g.versao}).`); continue; }
      if (g.criadoPor !== autora && !dono(autora) && c.acao !== 'mark_reimbursed') { recusa('Só quem lançou (ou a responsável) pode mudar este lançamento.'); continue; }
      if (c.acao !== 'mark_reimbursed' && !texto(c.motivo) && g.criadoPor !== autora) { recusa('Mudar o lançamento de outra sócia pede um motivo.'); continue; }
      const antes = {...g};
      if (c.acao === 'void_expense') {
        if (!texto(c.motivo)) { recusa('Anular pede um motivo.'); continue; }
        g.estado = 'anulado'; g.anuladoPor = autora; g.anuladoEm = quando; g.motivoAnulacao = texto(c.motivo);
      } else if (c.acao === 'mark_reimbursed') {
        if (g.destino !== 'empresa_reembolsa' && g.destino !== 'dividir') { recusa('Este gasto não tem reembolso a marcar.'); continue; }
        g.reembolsadoEm = quando; g.reembolsadoPor = autora;
      } else {
        const novo = limparGasto({...g, ...(c.dados || {})});
        const erro = validarGasto(novo, membros);
        if (erro) { recusa(erro); continue; }
        Object.assign(g, novo);
      }
      g.versoes.push({versao: g.versao, por: autora, quando, acao: c.acao, motivo: texto(c.motivo) || null, antes: pick(antes)});
      g.versao++; g.alteradoPor = autora; g.alteradoEm = quando;
      historico.push({seq: ev.seq, id: ev.id, autora, quando, acao: c.acao, alvo: c.alvo, resumo: g.descricao, antes: pick(antes), depois: pick(g), motivo: texto(c.motivo) || null});
    } else if (c.acao === 'set_parameter') {
      const d = c.dados || {}, item = ITEM[d.chave];
      if (!item) { recusa('Parâmetro desconhecido.'); continue; }
      const v = decimal(d.valor, item.casas);
      if (!v) { recusa(`Valor inválido para ${item.rotulo} (até ${item.casas} casas decimais).`); continue; }
      const num = Number(v.n) / Number(v.d);
      if (num < item.dura[0] || num > item.dura[1]) { recusa(`${item.rotulo} fora da faixa aceita (${item.dura[0]} a ${item.dura[1]} ${item.unidade}).`); continue; }
      if (!DIA.test(d.desde || '')) { recusa('Informe a partir de quando o valor vale.'); continue; }
      const p = {id: ev.id, chave: d.chave, valor: d.valor.replace(',', '.'), desde: d.desde, fonte: texto(d.fonte) || 'informado no portal', estado: d.estado === 'a_confirmar' ? 'a_confirmar' : 'vigente', nota: texto(d.nota, 400), por: autora, quando};
      params.push(p);
      historico.push({seq: ev.seq, id: ev.id, autora, quando, acao: c.acao, alvo: d.chave, resumo: `${item.rotulo}: ${p.valor} ${item.unidade} desde ${p.desde}`, depois: p});
    }
  }
  return {membros, gastos: [...gastos.values()], parametros: params, recusados, historico};
}
const pick = g => ({descricao: g.descricao, valorMinor: g.valorMinor, moeda: g.moeda, data: g.data, competencia: g.competencia, categoria: g.categoria, forma: g.forma, destino: g.destino, faturaBrlMinor: g.faturaBrlMinor, estado: g.estado});

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

const EQUIVALENTE = {mensal: [1, 1], mes: [1, 1], monthly: [1, 1], anual: [1, 12], ano: [1, 12], yearly: [1, 12], trimestral: [1, 3], semestral: [1, 6], semanal: [52, 12], quinzenal: [26, 12]};
const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const ativa = p => (p.subscriptionState || p.subscription_state || 'active') === 'active' && p.archivedAt == null;

// ── o mês calculado ───────────────────────────────────────────────────────────────────────────────────────────────
// realizado = gastos lançados com competência no mês; previsto = assinaturas ativas e confirmadas ainda sem gasto ligado
// no mês (convertidas pela estimativa de hoje); custo do mês = realizado + previsto (F5, F6).
export function livroDoMes(estadoBase, aplicado, mes, hoje) {
  const lista = parametros(aplicado);
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
  for (const p of estadoBase.plans || []) {
    if (!ativa(p) || p.confirmed !== true || ligados.has(p.id) || !DIGITOS[p.currency] || !Number.isSafeInteger(p.amountMinor)) continue;
    const fator = EQUIVALENTE[normal(p.period)];
    if (!fator) { incompletos.push({id: p.id, motivo: `Período "${p.period}" não reconhecido para o equivalente mensal.`, descricao: p.servico}); continue; }
    const mensal = numero(arred(BigInt(p.amountMinor) * BigInt(fator[0]), BigInt(fator[1])));
    const g = {valorMinor: mensal, moeda: p.currency, data: dataRef, forma: 'cartao_pj', faturaBrlMinor: null};
    const r = reaisDoGasto(g, lista);
    if (r.brl === null) incompletos.push({id: p.id, motivo: `Falta o câmbio de ${p.currency} para a previsão.`, descricao: p.servico});
    linhas.push({tipo: 'previsto', id: p.id, descricao: [p.servico, p.plano].filter(Boolean).join(' · '), categoria: palpiteCategoria(p.servico), data: p.nextDate || null,
      original: {minor: mensal, moeda: p.currency}, periodo: p.period, valorPlano: p.amountMinor, brl: r.brl, conversao: r.tipo === 'real' ? 'real' : 'estimado', conta: r.conta, pagoPor: null, destino: null, anulado: false});
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
  const pcts = membros.map(m => m.pct);
  const balanceado = pcts.every(p => typeof p === 'number') && pcts.reduce((a, b) => a + b, 0) === 100;
  const partes = balanceado ? ratear(total, pcts.map(String)) : null;
  const porSocia = membros.map((m, k) => {
    const doBolso = validas.filter(l => l.tipo === 'realizado' && l.pagoPor === m.id && FORMA[l.forma] && !FORMA[l.forma].empresa);
    const aReceber = doBolso.filter(l => l.destino === 'empresa_reembolsa' && !l.gasto.reembolsadoEm);
    return {id: m.id, nome: m.nome, pct: m.pct, parte: partes ? partes[k] : null, adiantou: soma(doBolso), aReceberDaEmpresa: soma(aReceber),
      aporte: soma(doBolso.filter(l => l.destino === 'aporte'))};
  });
  const acerto = acertoEntreSocias(validas.filter(l => l.tipo === 'realizado' && l.destino === 'dividir' && !l.gasto.reembolsadoEm), membros);
  porSocia.forEach(s => { s.saldoAcerto = acerto.saldos[s.id] || 0; });
  return {mes, dataRef, linhas, realizado, previsto, total, porMoeda, porCategoria, porSocia, acerto, incompletos, balanceado,
    pagoPorEmpresa: soma(validas.filter(l => l.tipo === 'realizado' && FORMA[l.forma] && FORMA[l.forma].empresa)),
    explica: {
      realizado: termos('Realizado', validas.filter(l => l.tipo === 'realizado'), realizado),
      previsto: termos('Previsto', validas.filter(l => l.tipo === 'previsto'), previsto),
      total: {formula: 'Custo do mês = realizado + previsto', termos: [{rotulo: 'Realizado (já lançado)', brl: realizado, op: '+'}, {rotulo: 'Previsto (assinaturas sem lançamento no mês)', brl: previsto, op: '+'}], resultado: total,
        excluidos: [...linhas.filter(l => l.anulado).map(l => ({rotulo: l.descricao, motivo: 'anulado'})), ...incompletos.map(i => ({rotulo: i.descricao, motivo: i.motivo}))]},
    }};
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
