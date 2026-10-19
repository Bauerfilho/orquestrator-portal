// DEMONSTRAÇÃO do arnês (?demo=1): agosto a outubro de 2026 lançados pelas três sócias do estado fictício, cada evento
// com a AUTORA PRÓPRIA (não a sessão: d.acrescentar assinaria tudo como quem está vendo). Dados fictícios.
// Traz o exemplo de outubro do plano (docs/PLANO-PORTAL.md §4.6), a Anthropic de outubro sem fatura, uma assinatura nova
// "a confirmar", passos de venda marcados, receitas da Hotmart de agosto a outubro (outubro: 40 × R$ 59,90), o saldo da
// conta PJ de R$ 21.765,00 em 18/10, o Pix da Ana para o Bauer (o da Beatriz ainda não veio), o reembolso do domínio
// pendente, setembro fechado pelo Bauer com o selo verdadeiro (a queima de setembro é R$ 2.366,00, então o fôlego dá
// 9,2 meses) e um evento recusado (a Ana tenta corrigir um gasto de setembro depois do fechamento).
//
// SEM imports: o arquivo é servido em /demonstracao.js pelo servir.mjs (como o estado-ficticio.js) e lido também pelo
// Node nos testes; caminhos de import diferentes nos dois lados quebrariam. Quem chama entrega as funções do contas.js
// e do razao.js. Uso: demonstracao(estadoBase, {fotoDoMes, seloDoMes, aplicar}, {primeiroSeq}) → eventos do diário
// {seq, id, membro, ts, conteudo}, prontos para entrar em d.eventos do diário em treino.

export const QUEIMA_DE_SETEMBRO = 236600;   // R$ 2.366,00: o exemplo do fôlego (F13) — R$ 21.765,00 ÷ R$ 2.366,00 = 9,2 meses

export function demonstracao(estadoBase, {fotoDoMes, seloDoMes, aplicar}, {primeiroSeq = 1} = {}) {
  const membros = (estadoBase && estadoBase.members) || [];
  const porId = (id, k) => (membros.find(m => m.id === id) || membros[k] || {}).id;
  const BAUER = (membros.find(m => m.role === 'owner') || {}).id || porId('m-bauer', 0);
  const ANA = porId('m-ana', 1), BIA = porId('m-bia', 2);
  const plano = re => ((estadoBase.plans || []).find(p => re.test(String(p.servico || ''))) || {}).id || null;
  const VERCEL = plano(/vercel/i), CLAUDE = plano(/^claude$/i), API = plano(/anthropic/i);

  const eventos = [];
  const evento = (membro, quando, acao, alvo, dados, extra = {}) => {
    const seq = primeiroSeq + eventos.length;
    const ev = {seq, id: 'demo-' + String(seq).padStart(3, '0'), membro, ts: quando, conteudo: {v: 1, acao, alvo, dados, quando, ...extra}};
    eventos.push(ev);
    return ev;
  };
  const gasto = (membro, quando, alvo, d) => evento(membro, quando, 'add_expense', alvo, {competencia: d.data.slice(0, 7), moeda: 'BRL', forma: 'cartao_pj', pagoPor: membro, ...d});
  const parametro = (membro, quando, chave, valor, desde, fonte) => evento(membro, quando, 'set_parameter', chave, {chave, valor, desde, fonte, estado: 'vigente'});
  const receita = (membro, quando, mes, d) => evento(membro, quando, 'add_income', 'rc-hotmart-' + mes, {competencia: mes, canal: 'hotmart', produto: 'Med Painel', moeda: 'BRL', taxasMinor: null, canceladosMinor: null, ...d});
  const saldo = (membro, quando, data, valorMinor) => evento(membro, quando, 'set_balance', 'sd-pj-' + data, {conta: 'Conta PJ principal', data, valorMinor, moeda: 'BRL', fonte: 'extrato do banco'});

  // ── agosto ─────────────────────────────────────────────────────────────────────────────────────────────────────
  parametro(ANA, '2026-08-03T13:00:00Z', 'fx.USD_BRL', '5.4310', '2026-08-03', 'PTAX venda BCB, 31/07/2026 (exemplo)');
  gasto(BAUER, '2026-08-10T15:00:00Z', 'demo-contador-2026-08', {data: '2026-08-10', descricao: 'Contador · agosto', categoria: 'contabilidade_juridico', valorMinor: 45000, forma: 'conta_pj'});
  gasto(ANA, '2026-08-18T14:00:00Z', 'demo-api-2026-08', {data: '2026-08-18', descricao: 'Anthropic API · créditos', categoria: 'software_ia', valorMinor: 8000, moeda: 'USD', planoId: API});
  saldo(ANA, '2026-09-01T12:00:00Z', '2026-08-31', 2448000);
  receita(BAUER, '2026-09-02T12:00:00Z', '2026-08', {brutoMinor: 119800, transacoes: 20, taxasMinor: 16912, pagantesAtivos: 20, pagantesNovos: 20, pagantesPerdidos: 0, testes: 12, cadastros: 60});

  // ── setembro ───────────────────────────────────────────────────────────────────────────────────────────────────
  gasto(BAUER, '2026-09-10T15:00:00Z', 'demo-contador-2026-09', {data: '2026-09-10', descricao: 'Contador · setembro', categoria: 'contabilidade_juridico', valorMinor: 45000, forma: 'conta_pj'});
  parametro(ANA, '2026-09-15T13:00:00Z', 'fx.USD_BRL', '5.3530', '2026-09-15', 'PTAX venda BCB, 12/09/2026 (exemplo)');
  parametro(ANA, '2026-09-15T13:10:00Z', 'fx.USD_BRL', '5.3503', '2026-09-15', 'correção: dígitos trocados no valor anterior');
  const apiSetembro = gasto(ANA, '2026-09-18T14:00:00Z', 'demo-api-2026-09', {data: '2026-09-18', descricao: 'Anthropic API · créditos', categoria: 'software_ia', valorMinor: 8000, moeda: 'USD', planoId: API});
  const claudeSetembro = evento(BAUER, '2026-09-22T12:00:00Z', 'record_payment', 'demo-claude-2026-09', {data: '2026-09-22', competencia: '2026-09', descricao: 'Claude · Max 20x', categoria: 'software_ia',
    valorMinor: 20000, moeda: 'USD', forma: 'cartao_pj', pagoPor: BAUER, planoId: CLAUDE, ciclo: '2026-09'});
  gasto(BIA, '2026-09-22T20:00:00Z', 'demo-instagram-2026-09', {data: '2026-09-22', descricao: 'Anúncios Instagram · pré-lançamento do Med Painel', categoria: 'marketing', valorMinor: 30000, forma: 'cartao_pessoal', destino: 'aporte'});
  saldo(BAUER, '2026-10-01T12:00:00Z', '2026-09-30', 2211400);
  parametro(BAUER, '2026-10-01T12:05:00Z', 'fx.USD_BRL', '5.0826', '2026-10-01', 'PTAX venda BCB, 30/09/2026 (exemplo)');
  // a fatura de setembro chegou: substitui a estimativa dos dois gastos em dólar (a variação cambial aparece no mês)
  evento(ANA, '2026-10-02T12:00:00Z', 'reconcile_statement', '2026-09:cartao_pj', {mes: '2026-09', forma: 'cartao_pj', totalFaturaMinor: 46340 + 115820,
    itens: [{alvo: apiSetembro.conteudo.alvo, versao: 1, faturaBrlMinor: 46340}, {alvo: claudeSetembro.conteudo.alvo, versao: 1, faturaBrlMinor: 115820}]});
  receita(BAUER, '2026-10-02T13:00:00Z', '2026-09', {brutoMinor: 167720, transacoes: 28, pagantesAtivos: 28, pagantesNovos: 10, pagantesPerdidos: 2, testes: 9, cadastros: 72});
  // o último gasto de setembro (a nota chegou em outubro), calibrado para a queima de setembro dar R$ 2.366,00 exatos
  const antes = fotoDoMes(estadoBase, aplicar(estadoBase, eventos), '2026-09', eventos[eventos.length - 1].seq).totais;
  const calibre = QUEIMA_DE_SETEMBRO - (antes.total + antes.taxas + antes.imposto - antes.receita_bruta);
  if (calibre > 0) gasto(BIA, '2026-10-02T18:00:00Z', 'demo-marca-2026-09', {data: '2026-09-24', competencia: '2026-09', descricao: 'Registro da marca Med Painel · INPI e honorários', categoria: 'contabilidade_juridico', valorMinor: calibre, forma: 'conta_pj'});
  // o Bauer fecha setembro em 03/10 com o selo dos números até aqui
  const cabeca = eventos[eventos.length - 1].seq;
  const foto = fotoDoMes(estadoBase, aplicar(estadoBase, eventos), '2026-09', cabeca);
  evento(BAUER, '2026-10-03T13:00:00Z', 'close_month', '2026-09', {cabeca, selo: seloDoMes(foto),
    totais: {realizado: foto.totais.realizado, previsto: foto.totais.previsto, total: foto.totais.total, resultado: foto.totais.resultado}});
  // recusado: setembro já está fechado
  evento(ANA, '2026-10-04T14:00:00Z', 'edit_expense', apiSetembro.conteudo.alvo, {valorMinor: 8200}, {versao: 2, motivo: 'valor da nota corrigido'});

  // ── outubro: o exemplo do plano ────────────────────────────────────────────────────────────────────────────────
  gasto(BAUER, '2026-10-05T15:00:00Z', 'demo-vercel-2026-10', {data: '2026-10-05', descricao: 'Vercel · Pro', categoria: 'infraestrutura', valorMinor: 2000, moeda: 'USD', planoId: VERCEL});
  gasto(BAUER, '2026-10-05T15:01:00Z', 'demo-vercel-repetido', {data: '2026-10-05', descricao: 'Vercel · Pro', categoria: 'infraestrutura', valorMinor: 2000, moeda: 'USD'});
  evento(BAUER, '2026-10-05T15:03:00Z', 'void_expense', 'demo-vercel-repetido', null, {versao: 1, motivo: 'lançado em duplicidade'});
  gasto(BAUER, '2026-10-10T15:00:00Z', 'demo-contador-2026-10', {data: '2026-10-10', descricao: 'Contador · outubro', categoria: 'contabilidade_juridico', valorMinor: 45000, forma: 'pix_pessoal', destino: 'dividir'});
  gasto(ANA, '2026-10-12T14:00:00Z', 'demo-dominio-2026-10', {data: '2026-10-12', descricao: 'Domínio orquestrator.com.br', categoria: 'infraestrutura', valorMinor: 5990, forma: 'pix_pessoal', destino: 'empresa_reembolsa'});
  gasto(ANA, '2026-10-14T14:00:00Z', 'demo-api-2026-10', {data: '2026-10-14', descricao: 'Anthropic API · créditos', categoria: 'software_ia', valorMinor: 10000, moeda: 'USD', planoId: API});
  evento(BIA, '2026-10-15T12:00:00Z', 'add_plan', 'pl-demo-notion', {servico: 'Notion', plano: 'Plus · 3 pessoas', valorMinor: 3000, moeda: 'USD', periodo: 'mensal', diaVencimento: 12, proximaData: null, categoria: 'software_ia', status: 'a confirmar'});
  evento(ANA, '2026-10-15T12:30:00Z', 'toggle_step', 's3', {feito: true}, {versao: 1});
  evento(BIA, '2026-10-16T12:00:00Z', 'toggle_step', 's6', {feito: true}, {versao: 1});
  evento(ANA, '2026-10-18T19:00:00Z', 'record_settlement', 'ac-demo-ana-contador', {tipo: 'acerto_entre_socias', de: ANA, para: BAUER, valorMinor: 13500, moeda: 'BRL', data: '2026-10-18', forma: 'pix', gastoIds: [], nota: 'minha parte do contador de outubro'});
  evento(BAUER, '2026-10-18T21:00:00Z', 'confirm_settlement', 'ac-demo-ana-contador', {});
  saldo(ANA, '2026-10-18T21:30:00Z', '2026-10-18', 2176500);
  receita(BAUER, '2026-10-19T11:00:00Z', '2026-10', {brutoMinor: 239600, transacoes: 40, pagantesAtivos: 40, pagantesNovos: 12, pagantesPerdidos: 2, testes: 5, cadastros: 85});
  return eventos;
}
