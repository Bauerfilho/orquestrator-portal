// Vitrine dos gráficos (arnês): desenha cada forma do graficos.js com dados FICTÍCIOS, já em centavos inteiros, e
// confere as recusas do contrato (moedas misturadas, centavos quebrados, cascata que não fecha). O resultado das
// conferências fica em window.vitrine, que o fotografar.mjs --vitrine lê junto com as fotos, o teclado e o forced-colors.
import {fluxo, cascata, minigrafico, barra100, ranking, colunas, divergentes, dinheiro} from '../../graficos.js';

const raiz = document.getElementById('vitrine');
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
function grupo(titulo) { const g = el('div', 'vitrine-grade'); raiz.append(el('h2', 'vitrine-grupo', titulo), g); return g; }
function cartao(onde, titulo, sub, grafico, largo = false) {
  const c = el('section', 'lv-cartao');
  if (largo) c.style.gridColumn = '1 / -1';
  c.append(el('h3', 'lv-cartao-titulo', titulo), el('p', 'lv-cartao-sub', sub), grafico);
  onde.append(c);
  return grafico;
}

// ── dados fictícios ──────────────────────────────────────────────────────────────────────────────────────────────
const meses = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const entrou = [0, 0, 0, 0, 0, 29950, 59900, 89850, 119800, 179700, 209650, 239600];
const saiu = [98000, 101200, 99500, 102300, 110000, 108700, 112400, 115900, 121000, 126400, 236600, 116641];
const saldo = [2650000, 2551000, 2452300, 2351000, 2241000, 2162250, 2109750, 2083700, 2082500, 2135800, 2108850, 2176500];
const serie12 = [
  ...meses.map((mes, k) => ({mes, entrou: entrou[k], saiu: saiu[k], saldo: saldo[k], fechado: k >= 8 && k <= 10, aberto: k === 11})),
  {mes: '2026-11', entrou: null, saiu: 138847, saldo: null, futuro: true},
  {mes: '2026-12', entrou: null, saiu: 138847, saldo: null, futuro: true},
  {mes: '2027-01', entrou: null, saiu: 138847, saldo: null, futuro: true},
];
const serieCurta = [
  {mes: '2026-08', entrou: 179640, saiu: 98200, saldo: null, fechado: false},
  {mes: '2026-09', entrou: 209580, saiu: 236600, saldo: null, fechado: true},
  {mes: '2026-10', entrou: 239600, saiu: 116641, saldo: 2176500, aberto: true},
  {mes: '2026-11', entrou: null, saiu: 138847, saldo: null, futuro: true},
  {mes: '2026-12', entrou: null, saiu: 138847, saldo: null, futuro: true},
  {mes: '2027-01', entrou: null, saiu: 138847, saldo: null, futuro: true},
];
// outubro do plano (§4.6): receita 2.396,00 · taxa 336,80 · Simples 143,76 · custo 1.388,47 · resultado 526,97
const cascataOutubro = [
  {rotulo: 'Receita bruta (Hotmart)', valor: 239600, tipo: 'total', nota: '40 vendas de R$ 59,90'},
  {rotulo: 'Taxas da plataforma', valor: -33680, tipo: 'delta', nota: '9,9% + 40 × R$ 2,49'},
  {rotulo: 'Simples Nacional', valor: -14376, tipo: 'delta', nota: '6% da receita'},
  {rotulo: 'Custos do mês', valor: -138847, tipo: 'delta'},
  {rotulo: 'Resultado de outubro', valor: 52697, tipo: 'total'},
  {rotulo: 'Bauer · sua parte', valor: 21079, tipo: 'parte', destaque: true, nota: '40%'},
  {rotulo: 'Ana Ribeiro', valor: 15809, tipo: 'parte', nota: '30%'},
  {rotulo: 'Beatriz Lima', valor: 15809, tipo: 'parte', nota: '30%'},
];
const cascataAberta = [
  {rotulo: 'Receita bruta', valor: 239600, tipo: 'total'},
  {rotulo: 'Taxas', valor: -33680, tipo: 'delta'},
  {rotulo: 'Imposto', valor: -14376, tipo: 'delta'},
  {rotulo: 'Custos lançados', valor: -116641, tipo: 'delta'},
  {rotulo: 'Previsto até o fim do mês', valor: -22206, tipo: 'delta', previsto: true, nota: 'assinaturas sem lançamento'},
  {rotulo: 'Resultado estimado', valor: 52697, tipo: 'total', estimado: true},
];

// ── os gráficos novos ────────────────────────────────────────────────────────────────────────────────────────────
const novos = grupo('Gráficos novos da rotina');
cartao(novos, 'Fluxo de 12 meses', 'Entrou para cima, saiu para baixo; o saldo no fim de cada mês na faixa de cima. Mês aberto e previsão hachurados; cadeado = mês fechado.',
  fluxo(serie12, {rotulo: 'Em 12 meses o caixa caiu de R$ 26.500,00 para R$ 21.765,00; desde julho a receita cresce e em outubro entrou mais do que saiu.'}), true);
cartao(novos, 'Fluxo desde o primeiro mês com dado', 'A série começa em agosto; os três meses seguintes só têm o previsto das assinaturas.',
  fluxo(serieCurta, {rotulo: 'De agosto a outubro, entrou mais do que saiu em 2 de 3 meses; em setembro saiu mais.'}));
cartao(novos, 'Para onde vão os R$ 2.396,00 de outubro', 'Cascata do mês fechado: da receita ao resultado e à parte de cada sócia.',
  cascata(cascataOutubro, {rotulo: 'Dos R$ 2.396,00 de receita em outubro sobraram R$ 526,97 de resultado; a sua parte é R$ 210,79.'}));
cartao(novos, 'Mês aberto, com estimativa', 'O previsto entra hachurado e o resultado estimado com contorno.',
  cascata(cascataAberta, {rotulo: 'Se o previsto se confirmar, outubro fecha com R$ 526,97 de resultado (estimado).'}));
cartao(novos, 'Minigráfico: saiu por mês', 'Para o Meu painel: 12 meses numa linha, o último valor escrito ao lado.',
  minigrafico(meses.map((mes, k) => ({mes, valor: saiu[k], aberto: k === 11})), {cor: 'saida', nome: 'saiu', rotulo: 'Em outubro (mês aberto) saíram R$ 1.166,41; setembro foi o mês mais caro, com R$ 2.366,00.'}));
cartao(novos, 'Minigráfico: caixa', 'Saldo no fim do mês, com meses sem saldo informado.',
  minigrafico(meses.map((mes, k) => ({mes, valor: k === 3 || k === 4 ? null : saldo[k]})), {cor: 'destaque', nome: 'caixa', rotulo: 'O caixa foi de R$ 26.500,00 para R$ 21.765,00 em 12 meses.'}));
cartao(novos, 'Participação (barra neutra)', 'Sem cores de categoria: cinza de contexto e ouro só na sua parte.',
  barra100([{rotulo: 'Bauer (você)', permil: 400, destaque: true}, {rotulo: 'Ana Ribeiro', permil: 300}, {rotulo: 'Beatriz Lima', permil: 300}], {rotulo: 'Participação: Bauer 40%, Ana 30%, Beatriz 30%.', neutro: true}));

// ── recusas do contrato: o gráfico diz por que não desenhou ──────────────────────────────────────────────────────────
const recusas = grupo('Recusas do contrato');
const recMoedas = cartao(recusas, 'Moedas misturadas', 'Um ponto em dólar numa série em reais.',
  fluxo([{mes: '2026-09', entrou: 10000, saiu: 5000, moeda: 'BRL'}, {mes: '2026-10', entrou: 2000, saiu: 1000, moeda: 'USD'}], {rotulo: 'teste'}));
const recQuebrado = cartao(recusas, 'Centavos quebrados', 'Valor que não é inteiro em centavos.',
  minigrafico([{mes: '2026-09', valor: 1250.5}, {mes: '2026-10', valor: 1300}], {rotulo: 'teste'}));
const recNaoFecha = cartao(recusas, 'Cascata que não fecha', 'O total informado não bate com os passos.',
  cascata([{rotulo: 'Receita', valor: 10000, tipo: 'total'}, {rotulo: 'Custos', valor: -4000, tipo: 'delta'}, {rotulo: 'Resultado', valor: 7000, tipo: 'total'}], {rotulo: 'teste'}));
const recPartes = cartao(recusas, 'Partes que não somam', 'O rateio deixa sobra.',
  cascata([{rotulo: 'Resultado', valor: 10000, tipo: 'total'}, {rotulo: 'Ana', valor: 5000, tipo: 'parte'}, {rotulo: 'Bia', valor: 4000, tipo: 'parte'}], {rotulo: 'teste'}));
const recVazio = minigrafico([{mes: '2026-10', valor: null}], {rotulo: 'teste'});

// ── o kit que já existia (para conferir que nada mudou) ─────────────────────────────────────────────────────────────
const kit = grupo('Kit que já existia');
const cats = [{rotulo: 'Software e IA', valor: 50826, permil: 366, slot: 1}, {rotulo: 'Infraestrutura', valor: 16159, permil: 116, slot: 2}, {rotulo: 'Contabilidade', valor: 45000, permil: 324, slot: 3}, {rotulo: 'Marketing', valor: 26862, permil: 194, slot: 4}];
cartao(kit, 'Composição (barra 100%)', 'Categorias vizinhas, em ordem fixa.', barra100(cats, {rotulo: 'Composição do custo de outubro.'}));
cartao(kit, 'Ranking', 'Hachurado = previsto.', ranking([{rotulo: 'Anthropic API', valor: 54709, slot: 1}, {rotulo: 'Contador', valor: 45000, slot: 3}, {rotulo: 'Anúncios', valor: 30000, slot: 4}, {rotulo: 'Vercel · Pro', valor: 10942, slot: 2, tipo: 'previsto', nota: 'previsto'}], {rotulo: 'Maiores itens.'}));
cartao(kit, 'Colunas por mês', 'Realizado sólido, previsto hachurado.', colunas([
  {mes: '2026-05', realizado: 112400, previsto: 0, temLancamento: true}, {mes: '2026-06', realizado: 115900, previsto: 0, temLancamento: true},
  {mes: '2026-07', realizado: 121000, previsto: 0, temLancamento: true}, {mes: '2026-08', realizado: 126400, previsto: 0, temLancamento: true},
  {mes: '2026-09', realizado: 236600, previsto: 0, temLancamento: true}, {mes: '2026-10', realizado: 116641, previsto: 22206, temLancamento: true}], {rotulo: 'Custo por mês.', destaque: '2026-10'}));
cartao(kit, 'Divergentes (acerto)', 'A receber em azul, a pagar em vinho, sempre com sinal.', divergentes([{rotulo: 'Bauer', valor: 27000}, {rotulo: 'Ana Ribeiro', valor: -13500}, {rotulo: 'Beatriz Lima', valor: -13500}], {rotulo: 'Saldo de cada sócia.'}));

// ── conferências ───────────────────────────────────────────────────────────────────────────────────────────────────
const recusou = (fig, trecho) => !!(fig.dataset.recusa && fig.dataset.recusa.includes(trecho));
const linhaResultado = [...document.querySelectorAll('.gf-cascata .gf-cascata-linha')].find(l => l.textContent.startsWith('Resultado de outubro'));
const verificacoes = [
  {nome: 'recusa moedas misturadas numa série', ok: recusou(recMoedas, 'mistura moedas')},
  {nome: 'recusa valor que não é centavo inteiro', ok: recusou(recQuebrado, 'centavos inteiros')},
  {nome: 'recusa cascata cujo total não bate com os passos', ok: recusou(recNaoFecha, 'não fecha')},
  {nome: 'recusa partes que não somam o total', ok: recusou(recPartes, 'partes não somam')},
  {nome: 'recusa minigráfico sem nenhum valor', ok: recusou(recVazio, 'nenhum mês tem valor')},
  {nome: 'o valor escrito do resultado é o recebido (o gráfico não soma)', ok: !!linhaResultado && linhaResultado.querySelector('.gf-cascata-valor').textContent === dinheiro(52697)},
  {nome: 'os seis gráficos novos válidos desenharam e só as quatro recusas recusaram', ok: document.querySelectorAll('.gf-novo:not(.gf-recusa)').length === 6 && document.querySelectorAll('.gf-novo.gf-recusa').length === 4},
];
window.vitrine = {pronta: true, verificacoes};
