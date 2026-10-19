// Kit de gráficos do Finanças, sem dependência externa (o CSP proíbe CDN). Regras do plano (§6): valores chegam em
// centavos inteiros e nenhuma soma acontece dentro do gráfico; cor nunca trabalha sozinha (rótulo e valor sempre
// escritos); previsto = hachura, realizado = sólido; cada gráfico traz a frase que ele conclui (aria-label).

export function dinheiro(minor, moeda = 'BRL') {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return '—';
  return new Intl.NumberFormat('pt-BR', {style: 'currency', currency: moeda}).format(minor / 100);
}
export function compacto(minor) {
  const v = minor / 100;
  if (Math.abs(v) >= 1000) return 'R$ ' + new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 1}).format(v / 1000) + ' mil';
  return 'R$ ' + new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0}).format(v);
}
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined && txt !== null) n.textContent = txt; return n; };
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const pct = permil => (permil / 10).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%';

// composição: uma barra 100% em segmentos na ordem fixa das categorias, e a legenda com valor e percentual
export function barra100(itens, {rotulo}) {
  const fig = el('figure', 'gf-composicao');
  fig.setAttribute('aria-label', rotulo);
  const barra = el('div', 'gf-barra100');
  barra.setAttribute('aria-hidden', 'true');
  for (const it of itens) {
    const seg = el('span', 'gf-seg');
    seg.style.flexGrow = String(Math.max(it.permil, 4));
    seg.dataset.slot = String(it.slot);
    seg.title = `${it.rotulo}: ${dinheiro(it.valor)} (${pct(it.permil)})`;
    barra.append(seg);
  }
  const lista = el('ul', 'gf-legenda');
  for (const it of itens) {
    const li = el('li');
    const cor = el('i', 'gf-cor'); cor.dataset.slot = String(it.slot);
    li.append(cor, el('span', 'gf-leg-rotulo', it.rotulo), el('span', 'gf-leg-valor', dinheiro(it.valor)), el('span', 'gf-leg-pct', pct(it.permil)));
    lista.append(li);
  }
  fig.append(barra, lista);
  return fig;
}

// ranking em barras horizontais: o maior item define 100%; previsto hachurado; o valor sempre escrito na ponta
export function ranking(itens, {rotulo, aoClicar} = {}) {
  const fig = el('figure', 'gf-ranking');
  fig.setAttribute('aria-label', rotulo);
  const max = Math.max(1, ...itens.map(i => i.valor || 0));
  const lista = el('ol', 'gf-ranking-lista');
  for (const it of itens) {
    const li = el('li', 'gf-linha' + (it.tipo === 'previsto' ? ' is-previsto' : ''));
    const topo = el('div', 'gf-linha-topo');
    const nome = el(aoClicar ? 'button' : 'span', 'gf-linha-nome', it.rotulo);
    if (aoClicar) { nome.type = 'button'; nome.addEventListener('click', () => aoClicar(it)); }
    topo.append(nome, el('span', 'gf-linha-valor', dinheiro(it.valor)));
    const trilho = el('div', 'gf-trilho');
    const barra = el('span', 'gf-barra');
    barra.dataset.slot = String(it.slot ?? 0);
    barra.style.width = Math.max(1.5, (it.valor / max) * 100) + '%';
    trilho.append(barra);
    li.append(topo, trilho);
    if (it.nota) li.append(el('span', 'gf-linha-nota', it.nota));
    lista.append(li);
  }
  fig.append(lista);
  return fig;
}

// colunas por mês: realizado sólido + previsto hachurado empilhado; mês sem lançamento fica com contorno
export function colunas(serie, {rotulo, destaque}) {
  const fig = el('figure', 'gf-colunas');
  fig.setAttribute('aria-label', rotulo);
  // largura do desenho acompanha a tela: no celular o texto do SVG não encolhe até ficar ilegível
  const estreito = typeof matchMedia === 'function' && matchMedia('(max-width: 620px)').matches;
  const L = estreito ? 360 : 640, A = 210, base = 176, topo = 26, larg = L / serie.length;
  const max = Math.max(1, ...serie.map(s => s.realizado + s.previsto));
  const passo = passoBonito(max / 100);
  const svg = svgEl('svg', {viewBox: `0 0 ${L} ${A}`, role: 'img', 'aria-label': rotulo});
  const defs = svgEl('defs');
  const pat = svgEl('pattern', {id: 'gf-hachura', width: '6', height: '6', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'});
  pat.append(svgEl('rect', {width: '6', height: '6', class: 'gf-hachura-fundo'}), svgEl('line', {x1: '0', y1: '0', x2: '0', y2: '6', class: 'gf-hachura-traco'}));
  defs.append(pat); svg.append(defs);
  const escala = v => (v / (Math.ceil(max / (passo * 100)) * passo * 100 || 1)) * (base - topo);
  for (let g = 0; g <= Math.ceil(max / (passo * 100)); g++) {
    const y = base - escala(g * passo * 100);
    svg.append(svgEl('line', {x1: '0', x2: String(L), y1: String(y), y2: String(y), class: g ? 'gf-grade' : 'gf-base'}));
  }
  serie.forEach((s, k) => {
    const x = k * larg + larg * 0.22, w = larg * 0.56;
    const hr = escala(s.realizado), hp = escala(s.previsto);
    if (!s.temLancamento && !s.previsto) svg.append(svgEl('rect', {x: String(x), y: String(base - 3), width: String(w), height: '3', class: 'gf-vazio'}));
    if (hr > 0) svg.append(svgEl('rect', {x: String(x), y: String(base - hr), width: String(w), height: String(hr), rx: '3', class: 'gf-col' + (s.mes === destaque ? ' is-destaque' : '')}));
    if (hp > 0) svg.append(svgEl('rect', {x: String(x), y: String(base - hr - hp), width: String(w), height: String(hp), rx: '3', fill: 'url(#gf-hachura)', class: 'gf-col-prev'}));
    const total = s.realizado + s.previsto;
    if (total > 0) { const t = svgEl('text', {x: String(x + w / 2), y: String(base - hr - hp - 7), 'text-anchor': 'middle', class: 'gf-col-valor'}); t.textContent = compacto(total); svg.append(t); }
    const m = svgEl('text', {x: String(x + w / 2), y: String(A - 12), 'text-anchor': 'middle', class: 'gf-col-mes' + (s.mes === destaque ? ' is-destaque' : '')});
    m.textContent = mesCurto(s.mes); svg.append(m);
  });
  fig.append(svg);
  const leg = el('p', 'gf-como-ler');
  leg.append(el('span', 'gf-amostra'), ' lançado  ', el('span', 'gf-amostra is-previsto'), ' previsto (assinaturas ainda sem lançamento)');
  fig.append(leg);
  return fig;
}
function passoBonito(bruto) {
  const p = 10 ** Math.floor(Math.log10(bruto || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (bruto / (p * m) <= 4) return p * m;
  return p * 10;
}
export function mesCurto(mes) {
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return nomes[+mes.slice(5, 7) - 1] + '/' + mes.slice(2, 4);
}
export function mesLongo(mes) {
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return nomes[+mes.slice(5, 7) - 1] + ' de ' + mes.slice(0, 4);
}

// barras divergentes do acerto: a receber à direita (entrada), a pagar à esquerda (saída), sempre com sinal
export function divergentes(itens, {rotulo}) {
  const fig = el('figure', 'gf-divergentes');
  fig.setAttribute('aria-label', rotulo);
  const max = Math.max(1, ...itens.map(i => Math.abs(i.valor)));
  for (const it of itens) {
    const linha = el('div', 'gf-div-linha');
    const esq = el('div', 'gf-div-lado is-esq'), dir = el('div', 'gf-div-lado is-dir');
    const b = el('span', 'gf-div-barra ' + (it.valor < 0 ? 'is-saida' : 'is-entrada'));
    b.style.width = Math.max(2, Math.abs(it.valor) / max * 100) + '%';
    (it.valor < 0 ? esq : dir).append(b);
    const sinal = it.valor > 0 ? '+' : it.valor < 0 ? '−' : '';
    linha.append(el('span', 'gf-div-nome', it.rotulo), esq, dir, el('span', 'gf-div-valor ' + (it.valor < 0 ? 'is-saida' : it.valor > 0 ? 'is-entrada' : ''), sinal + dinheiro(Math.abs(it.valor)).replace('-', '')));
    fig.append(linha);
  }
  return fig;
}
