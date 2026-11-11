// Caixa: a escrituração da planilha fica separada de receitas de vendas e de saldos bancários informados.
// UI e gravação reutilizam livro.js; todas as contas operacionais pertencem ao núcleo puro contas.js/razao.js.
import {registrarPagina, el, botao, cartao, kpi, dado, pilula, hojeDe, nomeDe, dataBR, verConta,
  abrirFolha, campoComRotulo, campoDinheiro, rotaAtual, renderTudo} from './livro.js';
import * as R from './razao.js';
import * as C from './contas.js';
import {dinheiro, fluxo, cascata} from './graficos.js';

let mesAtual = null;
let registroRecolhido = false;
const ir = (pagina, args = [], filtros = {}) => window.financeNavigate?.(pagina, true, {args, filtros});
const nota = texto => el('p', 'cx-nota', texto);
const campo = (rotulo, tipo = 'text', valor = '', limite = null) => {
  const input = el('input'); input.type = tipo; input.value = valor ?? ''; input.setAttribute('aria-label', rotulo);
  if (limite !== null) input.maxLength = limite;
  return input;
};
function escolha(rotulo, opcoes, valor) {
  const select = el('select', 'lv-select'); select.setAttribute('aria-label', rotulo);
  for (const [id, nome] of opcoes) { const o = el('option', null, nome); o.value = id; o.selected = id === valor; select.append(o); }
  return select;
}
function monetario(moedas, moedaInicial, valorMinor, rotulo) {
  const box = el('div', 'cx-moeda');
  const moeda = escolha(`Moeda ${rotulo === 'Saldo' ? 'do saldo' : 'da receita'}`, moedas.map(m => [m, m]), moedaInicial);
  let valor = campoDinheiro(moedaInicial, {valorMinor, rotulo});
  moeda.addEventListener('change', () => {
    const novo = campoDinheiro(moeda.value, {rotulo}); novo.input.value = valor.input.value;
    valor.replaceWith(novo); valor = novo;
  });
  box.append(moeda, valor);
  return {box, moeda, ler: () => valor.ler()};
}
function cabecalho(titulo, acao) {
  const h = el('div', 'cx-cabecalho'); h.append(el('h3', 'lv-cartao-titulo', titulo)); if (acao) h.append(acao); return h;
}
function navegacao(D, mes) {
  const meses = [...new Set([mes, hojeDe(D.c).slice(0, 7), ...(D.aplicado.livroCaixa?.meses || []).map(m => m.mes),
    ...D.aplicado.gastos.map(g => g.competencia), ...D.aplicado.receitas.map(r => r.competencia), ...D.aplicado.saldos.map(s => s.data.slice(0, 7))])].sort();
  const nav = el('div', 'lv-mesnav');
  const label = el('label', 'lv-rotulo', 'Mês do Caixa'); label.htmlFor = 'cx-mes';
  const select = escolha('Mês do Caixa', meses.map(m => [m, R.nomeDoMes(m)]), mes); select.id = 'cx-mes';
  select.addEventListener('change', () => {mesAtual = select.value; ir('cash', [mesAtual]); renderTudo(true); document.getElementById('cx-mes')?.focus();});
  const lancar = botao('+ Lançar gasto', 'button-primary lv-lancar-contexto', () => window.financeLivro.abrirLancar());
  lancar.id = 'cx-lancar'; lancar.setAttribute('aria-label', 'Lançar um gasto da empresa');
  nav.append(label, select, lancar);
  return nav;
}
function explicaFonte(m, tipo) {
  const entradas = m.linhas.filter(l => l.entradaMinor > 0).map(l => ({rotulo: `${l.descricao} · linha ${l.linha}`, brl: l.entradaMinor, op: '+'}));
  const saidas = m.linhas.filter(l => l.saidaMinor > 0).map(l => ({rotulo: `${l.descricao} · linha ${l.linha}`, brl: l.saidaMinor, op: '-'}));
  if (tipo === 'entradas') return {formula: 'Entradas = soma das entradas escrituradas nesta aba (aportes não são receita de vendas)', termos: entradas, resultado: m.entradasMinor};
  if (tipo === 'saidas') return {formula: 'Saídas = soma das saídas escrituradas nesta aba', termos: saidas.map(l => ({...l, op: '+'})), resultado: m.saidasMinor};
  return {formula: 'Saldo escriturado = saldo inicial + entradas − saídas, na ordem física das linhas; não é conciliação bancária',
    termos: [{rotulo: 'Saldo inicial da aba', brl: m.saldoInicialMinor, op: '+'}, ...entradas, ...saidas], resultado: m.saldoFinalMinor};
}
function fonteDoMes(D, mes) {
  const livro = D.aplicado.livroCaixa;
  if (!livro) return null;
  const m = livro.meses.find(m => m.mes === mes);
  const box = cartao(`Livro-caixa · ${R.nomeDoMes(mes)}`, 'Foto da planilha importada. Os lançamentos novos do diário são mostrados na rotina abaixo; não reescrevem esta fonte.');
  box.id = 'cx-fonte';
  if (!m) {box.append(nota('Não há aba importada para este mês. Isso não significa saldo zero.')); return box;}
  const metas = el('p', 'cx-origem'); metas.append(el('strong', null, livro.fonte.arquivo), ` · ${m.aba} · importado em ${dataBR(livro.fonte.importadoEm)}`); box.append(metas);
  const ks = el('div', 'lv-kpis is-compacto'), pagamentos = m.linhas.filter(l => l.saidaMinor > 0).length;
  ks.append(kpi('Saldo inicial escriturado', m.saldoInicialMinor, 'Transportado da própria aba'),
    kpi('Entradas na planilha', m.entradasMinor, 'Aporte não é receita de vendas', () => verConta('Entradas escrituradas', explicaFonte(m, 'entradas'), D.c)),
    kpi('Saídas na planilha', m.saidasMinor, `${pagamentos} ${pagamentos === 1 ? 'pagamento registrado' : 'pagamentos registrados'}`, () => verConta('Saídas escrituradas', explicaFonte(m, 'saidas'), D.c)),
    kpi('Saldo escriturado', m.saldoFinalMinor, 'Não é saldo bancário conciliado', () => verConta('Saldo escriturado', explicaFonte(m, 'saldo'), D.c), 'total'));
  box.append(ks);
  if (!m.linhas.length) box.append(nota('Aba preparada, sem movimentos preenchidos. O saldo transportado da planilha não é previsão de receita nem saldo bancário confirmado.'));
  const lista = el('ol', 'cx-movimentos');
  for (const l of m.linhas) {
    const item = el('li', 'cx-movimento');
    const topo = el('div', 'cx-movimento-cab');
    topo.append(el('span', 'cx-data', dataBR(l.data)), el('h4', null, l.descricao),
      el('strong', l.entradaMinor ? 'cx-entrada' : 'cx-saida', `${l.entradaMinor ? 'Entrada' : 'Saída'} ${dinheiro(l.entradaMinor || l.saidaMinor)}`));
    const detalhe = el('div', 'cx-movimento-dados');
    detalhe.append(dado('Categoria da fonte', l.categoria || 'Não informada'), dado('Forma', l.forma || 'Não informada'),
      dado('Documento', l.documento || 'Não informado'), dado('Saldo após a linha', dinheiro(l.saldoMinor)));
    item.append(topo, detalhe);
    if (l.observacoes) item.append(nota(l.observacoes));
    const rodape = el('div', 'cx-movimento-rodape');
    rodape.append(el('span', 'cx-origem', `${m.aba} · linha ${l.linha}`), botao('Ver em Lançamentos', 'button-quiet lv-ver-conta', () => ir('lancamentos', [], {mes, origem: 'planilha', id: l.id})));
    item.append(rodape); lista.append(item);
  }
  box.append(lista);
  const avisos = el('details', 'cx-conferencia'); avisos.append(el('summary', null, 'Conferência e limites da fonte'));
  avisos.append(nota('As linhas mantêm a ordem da planilha, inclusive quando as datas estão fora de ordem. Não há pagador, autoria ou comprovante presumido.'));
  const ul = el('ul'); for (const aviso of livro.avisos || []) ul.append(el('li', null, aviso)); avisos.append(ul);
  avisos.append(nota(`SHA-256 da fonte: ${livro.fonte.sha256}`)); box.append(avisos);
  return box;
}
function banco(D, hoje) {
  const info = C.caixaInformado(D.aplicado, D.lista, hoje), f = C.folego(D.c.estado, D.aplicado, hoje);
  const box = cartao('Banco e fôlego', 'Somente saldos informados no diário. A planilha não confirma dinheiro disponível em conta.'); box.id = 'cx-banco';
  const ks = el('div', 'cx-banco-kpis');
  ks.append(kpi('Saldos bancários informados', info.temSaldo ? info.total : null,
    info.temSaldo ? `Último registro de cada conta${info.completo ? '' : ' · soma parcial'}` : 'Saldo não informado', info.temSaldo ? () => verConta('Caixa informado', info.explica, D.c) : null));
  const folego = el('div', 'lv-kpi'); folego.id = 'cx-folego';
  folego.append(el('span', 'lv-kpi-rotulo', 'Fôlego atual'), el('strong', 'cx-folego-valor', f.texto), nota(f.frase)); ks.append(folego); box.append(ks);
  for (const conta of info.contas) {
    const item = el('div', 'cx-conta');
    item.append(dado(conta.conta, dinheiro(conta.valorMinor, conta.moeda)), nota(`${dataBR(conta.data)} · ${conta.fonte} · informado por ${nomeDe(D.c, conta.criadoPor)}${conta.idadeDias !== null ? ` · há ${conta.idadeDias} dias` : ''}`));
    if (conta.brl === null) item.append(nota('Falta o câmbio: esta conta não entra no total em reais.'));
    else if (conta.moeda !== 'BRL') item.append(nota(`${dinheiro(conta.brl)} pela PTAX, sem spread nem IOF${conta.explica?.cambioPosterior ? ' · câmbio posterior à data do saldo' : ''}.`));
    box.append(item);
  }
  if (!info.contas.length) box.append(nota('Nenhum saldo bancário informado. Não se presume zero.'));
  const b = botao('Informar saldo bancário', 'button-outline', () => formSaldo(D)); b.id = 'cx-informar-saldo'; box.append(b);
  return box;
}
function receitas(D, mes) {
  const fechado = !!D.aplicado.fechamentos[mes]?.fechado;
  const adicionar = botao('Registrar receita', 'button-primary', () => formReceita(D, mes)); adicionar.id = 'cx-nova-receita'; adicionar.disabled = fechado;
  const box = el('section', 'lv-cartao'); box.id = 'cx-receitas'; box.append(cabecalho('Receitas de vendas', adicionar));
  box.append(nota('Aportes da planilha não entram como faturamento. Informe aqui o relatório do canal; bruto já sem cancelamentos. Taxas e impostos estimados são identificados como estimativa.'));
  if (fechado) box.append(nota('Mês fechado: a responsável precisa reabri-lo no Livro do mês antes de alterar receitas.'));
  const itens = D.aplicado.receitas.filter(r => r.competencia === mes);
  if (!itens.length) box.append(nota('Nenhuma receita de vendas registrada para este mês.'));
  const calculadas = C.receitasDoMes(D.aplicado, D.lista, mes);
  for (const r of itens) {
    const item = el('article', 'cx-receita' + (r.estado === 'anulado' ? ' is-anulado' : ''));
    const canal = R.CANAIS.find(c => c.id === r.canal)?.rotulo || r.canal;
    item.append(el('h4', null, [canal, r.produto].filter(Boolean).join(' · ')), dado('Receita bruta (original)', dinheiro(r.brutoMinor, r.moeda)),
      nota(`${r.transacoes} vendas · ${nomeDe(D.c, r.criadoPor)} · versão ${r.versao}`));
    const calculada = calculadas.linhas.find(l => l.id === r.id);
    if (calculada) item.append(nota(calculada.liquido === null ? calculada.motivo : `Líquido calculado: ${dinheiro(calculada.liquido)} · ${r.taxasMinor === null ? 'taxa estimada' : 'taxa informada'} · imposto estimado.`));
    if (r.estado === 'anulado') item.append(pilula('Anulada · não somada', 'anulado'), nota(r.motivoAnulacao));
    else if (!fechado) {
      const acoes = el('div', 'cx-acoes');
      acoes.append(botao('Editar', 'button-outline', () => formReceita(D, mes, r)), botao('Anular', 'button-quiet', () => anularReceita(r))); item.append(acoes);
    }
    box.append(item);
  }
  return box;
}
export function desenhar(D) {
  const alvo = document.getElementById('caixa-calculado'); if (!alvo || !D) return;
  const rota = rotaAtual(), hoje = hojeDe(D.c);
  if (rota.pagina === 'cash') mesAtual = rota.args[0] || hoje.slice(0, 7);
  const mes = mesAtual || hoje.slice(0, 7);
  const resultado = C.resultadoDoMes(D.c.estado, D.aplicado, D.lista, mes, hoje);
  const nos = [navegacao(D, mes)];
  const fonte = fonteDoMes(D, mes); if (fonte) nos.push(fonte);
  const resumo = cartao('Rotina do portal', 'Despesas da planilha e eventos novos do diário, sem somar o histórico conciliado. Previsto não é pagamento; resultado não é saldo bancário.');
  const ks = el('div', 'lv-kpis is-compacto');
  ks.append(kpi('Despesas registradas', resultado.realizado, 'Da planilha e do diário', () => verConta('Despesas registradas', resultado.livro.explica.realizado, D.c)),
    kpi('Ainda previsto', resultado.previsto, 'Assinaturas sem pagamento no mês', () => verConta('Previsto', resultado.livro.explica.previsto, D.c), 'previsto'),
    kpi('Receita líquida de vendas', resultado.receitaLiquida, `${resultado.receitas.transacoes} vendas · não inclui aportes`, () => verConta('Receita líquida', resultado.receitas.explica.liquido, D.c)),
    kpi('Resultado do mês', resultado.resultado, resultado.provisorio ? 'Provisório: inclui previsão ou estimativa' : 'Receita líquida − custo', () => verConta('Resultado do mês', resultado.explica.resultado, D.c), 'total'));
  resumo.append(ks); nos.push(resumo, banco(D, hoje), receitas(D, mes));
  const serieFonte = (D.aplicado.livroCaixa?.meses || []).filter(m => m.linhas.length && m.mes <= mes).slice(-12);
  if (serieFonte.length) {
    const grafico = cartao('Fluxo escriturado', 'Somente abas com movimentos preenchidos. Aporte entra nesta escrituração, não no faturamento de vendas.'); grafico.id = 'cx-fluxo-fonte';
    grafico.append(fluxo(serieFonte.map(m => ({mes: m.mes, entrou: m.entradasMinor, saiu: m.saidasMinor, saldo: m.saldoFinalMinor})), {rotulo: 'Entradas, saídas e saldo escriturado da planilha'})); nos.push(grafico);
  } else if (!D.aplicado.livroCaixa) {
    const grafico = cartao('Fluxo do portal', 'Receitas de vendas e custos (inclui previsão). Não representa o extrato bancário.');
    grafico.append(fluxo(C.serie12m(D.c.estado, D.aplicado, mes, hoje))); nos.push(grafico);
  }
  if (resultado.receitas.linhas.length) {
    const conta = C.cascataDoMes(D.c.estado, D.aplicado, D.lista, mes, hoje, D.c.membro.id);
    const grafico = cartao('Para onde vai a receita', 'Taxas, imposto estimado, custos e resultado de vendas. Não inclui os aportes da planilha.');
    grafico.append(cascata(conta.passos, {rotulo: conta.rotulo})); nos.push(grafico);
  }
  alvo.replaceChildren(...nos);
  if (!registroRecolhido) {
    const antigo = alvo.parentElement.querySelector('.registro-importado'), origemAntiga = document.getElementById('cash-source');
    if (antigo) {antigo.open = false; if (origemAntiga) antigo.insertBefore(origemAntiga, document.getElementById('cash-content')); antigo.insertBefore(nota('Documento histórico: não compõe os números calculados acima.'), document.getElementById('cash-content'));}
    registroRecolhido = true;
  }
}

// A versão é a que foi aberta, não a mais nova buscada na hora de salvar: edição velha precisa ser recusada.
function formReceita(D, mes, existente = null) {
  const corpo = el('div', 'cx-form');
  const comp = campo('Competência da receita', 'month', existente?.competencia || mes);
  const canal = escolha('Canal da receita', R.CANAIS.map(c => [c.id, c.rotulo]), existente?.canal || 'outro');
  const produto = campo('Produto', 'text', existente?.produto, 60);
  const valor = monetario(['BRL', 'USD'], existente?.moeda || 'BRL', existente?.brutoMinor, 'Receita bruta');
  const vendas = campo('Número de vendas', 'number', existente?.transacoes); vendas.min = '0'; vendas.step = '1';
  const taxas = campoDinheiro(existente?.moeda || 'BRL', {valorMinor: existente?.taxasMinor, rotulo: 'Taxas informadas'});
  const cancelados = campoDinheiro(existente?.moeda || 'BRL', {valorMinor: existente?.canceladosMinor, rotulo: 'Cancelamentos informados'});
  const taxasBox = campoComRotulo('Taxas reais (opcional)', taxas), canceladosBox = campoComRotulo('Cancelamentos (só informativo, opcional)', cancelados);
  let campoTaxas = taxas, campoCancelados = cancelados;
  valor.moeda.addEventListener('change', () => {
    for (const [nome, box, antigo] of [['taxas', taxasBox, campoTaxas], ['cancelados', canceladosBox, campoCancelados]]) {
      const novo = campoDinheiro(valor.moeda.value, {rotulo: nome === 'taxas' ? 'Taxas informadas' : 'Cancelamentos informados'}); novo.input.value = antigo.input.value; antigo.replaceWith(novo);
      if (nome === 'taxas') campoTaxas = novo; else campoCancelados = novo;
    }
  });
  corpo.append(campoComRotulo('Competência', comp), campoComRotulo('Canal', canal), campoComRotulo('Produto (opcional)', produto),
    campoComRotulo('Receita bruta, já sem cancelamentos', valor.box), campoComRotulo('Número de vendas', vendas), taxasBox, canceladosBox,
    nota('Taxas em branco usam a estimativa das premissas; zero digitado significa taxa real zero. Cancelamentos não são descontados duas vezes. Impostos são estimados, não comprovados.'));
  const adicionais = el('details', 'cx-conferencia'); adicionais.append(el('summary', null, 'Contagens do relatório (opcionais)'));
  const contagens = {};
  for (const [chave, rotulo] of [['pagantesAtivos', 'Pagantes ativos'], ['pagantesNovos', 'Pagantes novos'], ['pagantesPerdidos', 'Pagantes perdidos'], ['testes', 'Testes'], ['cadastros', 'Cadastros']]) {
    const input = campo(rotulo, 'number', existente?.[chave]); input.min = '0'; input.step = '1'; contagens[chave] = input; adicionais.append(campoComRotulo(rotulo, input));
  }
  corpo.append(adicionais);
  const motivo = campo('Motivo da alteração', 'text', '', 400);
  if (existente && existente.criadoPor !== D.c.membro.id) corpo.append(campoComRotulo('Motivo da alteração (obrigatório)', motivo));
  const alvo = existente?.id || `rc-${crypto.randomUUID()}`;
  function coletar() {
    const contagem = input => input.value.trim() === '' ? null : /^\d+$/.test(input.value) && Number.isSafeInteger(Number(input.value)) ? Number(input.value) : NaN;
    return {competencia: comp.value, canal: canal.value, produto: produto.value, brutoMinor: valor.ler(), moeda: valor.moeda.value, transacoes: contagem(vendas),
      taxasMinor: campoTaxas.ler(), canceladosMinor: campoCancelados.ler(), ...Object.fromEntries(Object.entries(contagens).map(([k, input]) => [k, contagem(input)]))};
  }
  const primaria = existente ? 'Salvar alteração' : 'Registrar receita';
  abrirFolha({eyebrow: 'Receita de vendas · diário cifrado', titulo: existente ? 'Editar receita' : 'Registrar receita', corpo,
    acoes: [{rotulo: primaria, primaria: true, fn: f => {
      const dados = coletar();
      if (dados.brutoMinor === null || dados.transacoes === null || !Number.isSafeInteger(dados.transacoes)) return {ok: false, erro: 'Informe a receita bruta e o número de vendas (zero ou mais).'};
      if ([campoTaxas, campoCancelados].some(c => c.input.value.trim() && c.ler() === null)) return {ok: false, erro: 'Confira os valores opcionais: use a vírgula e no máximo duas casas decimais.'};
      if (Object.values(contagens).some(input => input.value.trim() && !/^\d+$/.test(input.value))) return {ok: false, erro: 'As contagens são números inteiros de zero para cima.'};
      if (existente && existente.criadoPor !== D.c.membro.id && !motivo.value.trim()) return {ok: false, erro: 'Mudar a receita de outra sócia pede um motivo.'};
      return f.gravar({acao: existente ? 'edit_income' : 'add_income', alvo, ...(existente ? {versao: existente.versao, motivo: motivo.value.trim()} : {}), dados}, existente ? 'Receita corrigida.' : 'Receita registrada.');
    }}]});
}
function anularReceita(r) {
  const motivo = el('textarea'); motivo.setAttribute('aria-label', 'Motivo da anulação'); motivo.maxLength = 400;
  abrirFolha({eyebrow: 'Nada é apagado do diário', titulo: 'Anular receita', corpo: [nota('A receita deixa os totais, mas permanece no Histórico, com o motivo e a assinatura de quem anulou.'), campoComRotulo('Motivo da anulação', motivo)],
    acoes: [{rotulo: 'Anular receita', primaria: true, fn: f => motivo.value.trim() ? f.gravar({acao: 'void_income', alvo: r.id, versao: r.versao, motivo: motivo.value.trim()}, 'Receita anulada.') : {ok: false, erro: 'Informe o motivo da anulação.'}}]});
}
function formSaldo(D) {
  const conta = campo('Conta', 'text', '', 60), data = campo('Data do saldo', 'date', hojeDe(D.c)); data.max = hojeDe(D.c);
  const valor = monetario(R.MOEDAS, 'BRL', null, 'Saldo');
  const fonte = campo('Fonte do saldo', 'text', '', 160), observacao = campo('Observação do saldo', 'text', '', 400);
  const corpo = el('div', 'cx-form'); corpo.append(campoComRotulo('Conta', conta), campoComRotulo('Data do saldo', data),
    campoComRotulo('Saldo', valor.box), campoComRotulo('Fonte (por exemplo, o extrato)', fonte), campoComRotulo('Observação (opcional)', observacao),
    nota('O novo registro não apaga o anterior. Vale o último saldo de cada conta; não é feita soma de várias fotografias da mesma conta.'));
  const alvo = `sd-${crypto.randomUUID()}`;
  abrirFolha({eyebrow: 'Saldo informado · não é conciliação automática', titulo: 'Informar saldo bancário', corpo,
    acoes: [{rotulo: 'Registrar saldo', primaria: true, fn: f => {
      if (!conta.value.trim() || !data.value || !fonte.value.trim() || valor.ler() === null) return {ok: false, erro: 'Informe conta, data, saldo e a fonte do saldo.'};
      if (data.value > hojeDe(D.c)) return {ok: false, erro: 'A data do saldo ainda não chegou.'};
      return f.gravar({acao: 'set_balance', alvo, dados: {conta: conta.value.trim(), data: data.value, valorMinor: valor.ler(), moeda: valor.moeda.value, fonte: fonte.value.trim(), nota: observacao.value.trim()}}, 'Saldo bancário registrado.');
    }}]});
}
registrarPagina(desenhar);
