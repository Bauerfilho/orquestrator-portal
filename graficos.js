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

// composição: uma barra 100% em segmentos na ordem fixa das categorias, e a legenda com valor e percentual.
// {neutro: true} é a barra da participação (Sociedade): sem cores de categoria, cinza de contexto com 2px de folga entre
// os segmentos e ouro só no item com destaque (você); valor em dinheiro é opcional (participação não é dinheiro).
export function barra100(itens, {rotulo, neutro = false}) {
  const fig = el('figure', 'gf-composicao' + (neutro ? ' is-neutro' : ''));
  fig.setAttribute('aria-label', rotulo);
  const barra = el('div', 'gf-barra100');
  barra.setAttribute('aria-hidden', 'true');
  const temValor = it => it.valor !== null && it.valor !== undefined;
  for (const it of itens) {
    const seg = el('span', 'gf-seg' + (neutro ? (it.destaque ? ' is-destaque' : ' is-neutro') : ''));
    seg.style.flexGrow = String(Math.max(it.permil, 4));
    if (!neutro) seg.dataset.slot = String(it.slot);
    seg.title = neutro && !temValor(it) ? `${it.rotulo}: ${pct(it.permil)}` : `${it.rotulo}: ${dinheiro(it.valor)} (${pct(it.permil)})`;
    barra.append(seg);
  }
  const lista = el('ul', 'gf-legenda');
  for (const it of itens) {
    const li = el('li');
    const cor = el('i', 'gf-cor' + (neutro ? (it.destaque ? ' is-destaque' : ' is-neutro') : ''));
    if (!neutro) cor.dataset.slot = String(it.slot);
    li.append(cor, el('span', 'gf-leg-rotulo', it.rotulo), el('span', 'gf-leg-valor', neutro && !temValor(it) ? '' : dinheiro(it.valor)), el('span', 'gf-leg-pct', pct(it.permil)));
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

// ══ Gráficos novos da rotina (plano §6.3 e §6.6): fluxo de 12 meses, cascata e minigráfico ══════════════════════════
// Contrato comum: centavos inteiros de UMA moeda (o que não for isso vira uma recusa escrita, nunca um desenho errado);
// o gráfico não soma nada para mostrar (todo número escrito vem pronto de quem chama); um único tab stop por gráfico,
// com ←/→, Home e End movendo a dica; aria-label com a conclusão; "Ver tabela" com a tabela equivalente; uma linha
// "Como ler". Gramática dos traços: sólido = realizado, contorno = estimado, hachura = previsto ou mês aberto,
// cadeado = mês fechado. Em forced-colors as cores viram as do sistema e a hachura passa a ser o canal principal.
let sequencia = 0;
const novoId = prefixo => `${prefixo}-${++sequencia}`;
const MENOS = '−';
const temNumero = v => v !== null && v !== undefined;
const comSinal = (minor, moeda) => (minor > 0 ? '+' : minor < 0 ? MENOS : '') + dinheiro(Math.abs(minor), moeda);
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const SIMBOLO = {BRL: 'R$', USD: 'US$', EUR: '€'};
// abreviação só nos eixos (§6.5): "R$ 2 mil", "−US$ 500"; o valor inteiro fica na dica e na tabela
function compactoEixo(minor, moeda) {
  const v = Math.abs(minor) / 100, s = SIMBOLO[moeda] || moeda, sinal = minor < 0 ? MENOS : '';
  if (v >= 1000) return `${sinal}${s} ${new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 1}).format(v / 1000)} mil`;
  return `${sinal}${s} ${new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0}).format(v)}`;
}
// largura de um texto na fonte do portal (para margens e para não sobrepor rótulos)
let regua = null;
function larguraTexto(texto, px = 12, peso = 500) {
  if (!regua) regua = document.createElement('canvas').getContext('2d');
  regua.font = `${peso} ${px}px ${getComputedStyle(document.body).fontFamily || 'sans-serif'}`;
  return regua.measureText(texto).width;
}
// passo "bonito" (1, 2, 2,5, 5 × 10ⁿ, em centavos) com no máximo `intervalos` divisões entre −baixo e +alto
function passoEixo(alto, baixo, intervalos) {
  const maior = Math.max(alto, baixo, 1);
  let p = Math.max(1, 10 ** Math.floor(Math.log10(maior / intervalos)));
  for (let volta = 0; volta < 40; volta++) {
    for (const m of [1, 2, 2.5, 5]) { const passo = p * m; if (Number.isInteger(passo) && Math.ceil(alto / passo) + Math.ceil(baixo / passo) <= intervalos) return passo; }
    p *= 10;
  }
  return maior;
}

// Recebe centavos inteiros de uma moeda só; devolve o motivo da recusa (ou null)
function conferir(itens, campos, moeda, {negativos = [], nome = it => it.mes ? mesCurto(it.mes) : (it.rotulo || 'um item')} = {}) {
  const moedas = [...new Set(itens.map(it => it.moeda || moeda))];
  if (moedas.length > 1 || moedas[0] !== moeda) return `a série mistura moedas (${[...new Set([moeda, ...moedas])].join(' e ')}). Moedas diferentes não se comparam sem câmbio: faça um gráfico por moeda ou converta tudo para reais antes.`;
  for (const it of itens) for (const c of campos) {
    const v = it[c];
    if (!temNumero(v)) continue;
    if (!Number.isSafeInteger(v)) return `o valor “${c}” de ${nome(it)} não está em centavos inteiros.`;
    if (v < 0 && !negativos.includes(c)) return `o valor “${c}” de ${nome(it)} veio negativo; o gráfico já desenha a direção.`;
  }
  return null;
}
function recusa(classe, motivo) {
  const fig = el('figure', 'gf-novo gf-recusa ' + classe);
  fig.dataset.recusa = motivo;
  const p = el('p', 'gf-recusa-texto');
  p.append(el('strong', null, 'Gráfico não desenhado: '), motivo);
  fig.append(p);
  return fig;
}
function tabelaDe(legenda, cabecalho, linhas, numericas = []) {
  const t = el('table', 'gf-tabela');
  t.append(el('caption', null, legenda));
  const cab = el('tr');
  cabecalho.forEach((c, k) => { const th = el('th', numericas.includes(k) ? 'is-num' : null, c); th.scope = 'col'; cab.append(th); });
  const thead = el('thead'); thead.append(cab);
  const tbody = el('tbody');
  for (const linha of linhas) {
    const tr = el('tr');
    linha.forEach((v, k) => { const td = el(k === 0 ? 'th' : 'td', numericas.includes(k) ? 'is-num' : null, v); if (k === 0) td.scope = 'row'; tr.append(td); });
    tbody.append(tr);
  }
  t.append(thead, tbody);
  return t;
}
// padrões de hachura de 45° na cor de cada série, num <svg> de definições da própria figura (ids únicos na página)
const SERIES = ['entrada', 'saida', 'destaque', 'contexto'];
function definicoes() {
  const svg = svgEl('svg', {class: 'gf-defs', width: '0', height: '0', 'aria-hidden': 'true', focusable: 'false'});
  const defs = svgEl('defs');
  const ids = {};
  for (const s of SERIES) {
    ids[s] = novoId('gf-hx-' + s);
    const pat = svgEl('pattern', {id: ids[s], width: '6', height: '6', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'});
    pat.append(svgEl('line', {x1: '1', y1: '0', x2: '1', y2: '6', class: 'gf-hx-traco is-' + s}));
    defs.append(pat);
  }
  svg.append(defs);
  return {svg, ids};
}
// amostras da linha "Como ler" em SVG (fundo de CSS some em forced-colors; SVG com as cores do sistema não)
function amostra(tipo, ids) {
  const svg = svgEl('svg', {class: 'gf-amostra-svg', viewBox: '0 0 14 10', width: '14', height: '10', 'aria-hidden': 'true', focusable: 'false'});
  const [serie, traco] = tipo.split(':');
  if (traco === 'linha') svg.append(svgEl('line', {x1: '1', y1: '5', x2: '13', y2: '5', class: 'gf-amostra-linha is-' + serie}));
  else if (traco === 'cadeado') desenharCadeado(svg, 7, 1);
  else {
    const r = svgEl('rect', {x: '1', y: '1', width: '12', height: '8', rx: '2', class: 'gf-m is-' + serie + (traco === 'hachura' ? ' is-hachura' : traco === 'estimado' ? ' is-estimado' : '')});
    if (traco === 'hachura') r.style.fill = `url(#${ids.ids[serie]})`;
    svg.append(r);
  }
  return svg;
}
function desenharCadeado(svg, cx, y) {
  const g = svgEl('g', {class: 'gf-cadeado'});
  g.append(svgEl('path', {d: `M${cx - 2.4} ${y + 4.2}v-1.6a2.4 2.4 0 0 1 4.8 0v1.6`, class: 'gf-cadeado-arco'}), svgEl('rect', {x: String(cx - 3.6), y: String(y + 4), width: '7.2', height: '5.4', rx: '1.2', class: 'gf-cadeado-corpo'}));
  svg.append(g);
}
// A moldura comum: área com um tab stop, dica que anda com as setas, anúncio para leitor de tela, "Como ler",
// "Ver tabela" (alternância com aria-pressed, §6.7) e a tabela equivalente.
function moldura(classe, {rotulo, comoLer, tabela, ids}) {
  const fig = el('figure', 'gf-novo ' + classe);
  const area = el('div', 'gf-area');
  area.tabIndex = 0;
  area.setAttribute('role', 'img');
  area.setAttribute('aria-label', rotulo);
  const dica = el('div', 'gf-dica');
  dica.setAttribute('aria-hidden', 'true');
  dica.hidden = true;
  const anuncio = el('p', 'gf-anuncio');
  anuncio.setAttribute('aria-live', 'polite');
  const como = el('p', 'gf-como-ler');
  como.id = novoId('gf-como');
  como.append(el('strong', null, 'Como ler:'));
  // comoLer: frases soltas ou pares [amostra, texto]; cada amostra fica junto do seu texto na quebra de linha
  for (const item of comoLer) {
    const chave = el('span', 'gf-chave');
    if (Array.isArray(item)) chave.append(item[0], item[1]); else chave.append(item);
    como.append(chave);
  }
  como.append(el('span', 'gf-anuncio', ' Com o teclado: as setas andam ponto a ponto; Home e End vão às pontas.'));
  area.setAttribute('aria-describedby', como.id);
  const caixa = el('div', 'gf-tabela-caixa');
  caixa.id = novoId('gf-tabela');
  caixa.hidden = true;
  caixa.append(tabela);
  const ver = el('button', 'button button-quiet gf-ver-tabela', 'Ver tabela');
  ver.type = 'button';
  ver.setAttribute('aria-pressed', 'false');
  ver.setAttribute('aria-controls', caixa.id);
  ver.addEventListener('click', () => { const abrir = caixa.hidden; caixa.hidden = !abrir; ver.setAttribute('aria-pressed', String(abrir)); ver.textContent = abrir ? 'Esconder tabela' : 'Ver tabela'; });
  const rodape = el('div', 'gf-rodape');
  rodape.append(como, ver);
  fig.append(ids.svg, area, anuncio, rodape, caixa);
  return {fig, area, dica, anuncio};
}
// navegação de um tab stop: ←/→ (e ↑/↓ quando vertical), Home, End, Esc; o ponteiro escolhe o ponto mais perto
function navegavel({area, dica, anuncio}, {total, inicial, mostrar, indiceEm, vertical = false}) {
  let atual = -1;
  const ir = (k, anunciar = true) => {
    atual = k < 0 ? -1 : Math.max(0, Math.min(total - 1, k));
    const texto = mostrar(atual);
    if (anunciar && texto) anuncio.textContent = texto;
  };
  area.addEventListener('keydown', e => {
    const proximo = e.key === 'ArrowRight' || (vertical && e.key === 'ArrowDown');
    const anterior = e.key === 'ArrowLeft' || (vertical && e.key === 'ArrowUp');
    if (proximo || anterior) { e.preventDefault(); ir(atual < 0 ? (proximo ? 0 : total - 1) : atual + (proximo ? 1 : -1)); }
    else if (e.key === 'Home') { e.preventDefault(); ir(0); }
    else if (e.key === 'End') { e.preventDefault(); ir(total - 1); }
    else if (e.key === 'Escape' && atual >= 0) { ir(-1, false); }
  });
  area.addEventListener('focus', () => { if (atual < 0) ir(inicial); });
  area.addEventListener('blur', () => ir(-1, false));
  area.addEventListener('pointermove', e => { const k = indiceEm(e); if (k >= 0 && k !== atual) ir(k, false); });
  area.addEventListener('pointerleave', () => { if (document.activeElement !== area) ir(-1, false); });
  area.addEventListener('pointerdown', e => { const k = indiceEm(e); if (k >= 0) ir(k); });
  return {ir, get atual() { return atual; }};
}
function preencherDica(dica, titulo, linhas) {
  dica.replaceChildren(el('strong', null, titulo));
  for (const l of linhas) dica.append(el('span', null, l));
  dica.hidden = false;
}
// põe a dica ao lado do ponto (sem cobrir a barra escolhida) e sempre dentro da área: nada vaza a 390px
function posicionarDica(dica, area, x, y, folga) {
  const L = area.clientWidth, w = dica.offsetWidth;
  let esq = x + folga + 6 + w <= L ? x + folga + 6 : x - folga - 6 - w;
  esq = Math.max(0, Math.min(L - w, esq));
  dica.style.left = esq + 'px';
  dica.style.top = Math.max(0, y) + 'px';
}
// desenha na largura real da área (1 unidade = 1 px: o texto do SVG não encolhe abaixo de 12px no celular)
function responsivo(area, desenhar) {
  let largura = 0, pedido = 0;
  const obs = new ResizeObserver(entradas => {
    if (!area.isConnected) { obs.disconnect(); return; }
    const w = Math.round(entradas[0].contentRect.width);
    if (w <= 0 || w === largura) return;
    cancelAnimationFrame(pedido);
    pedido = requestAnimationFrame(() => { largura = w; desenhar(w); });
  });
  obs.observe(area);
}

// ── fluxo de 12 meses: entrou para cima (azul), saiu para baixo (vinho), saldo no fim do mês em ouro numa faixa
// própria acima (escala dele, sem eixo duplo), mês fechado com cadeado no eixo, mês aberto e futuros hachurados.
// serie: [{mes 'AAAA-MM', entrou, saiu, saldo|null, fechado, aberto, futuro, moeda?}] em centavos.
export function fluxo(serie, opcoes = {}) {
  const lista = Array.isArray(serie) ? serie : [];
  const moeda = opcoes.moeda || (lista.find(s => s.moeda) || {}).moeda || 'BRL';
  const erro = !lista.length ? 'a série está vazia.' : lista.some(s => !/^\d{4}-\d{2}$/.test(String(s.mes || ''))) ? 'cada ponto precisa do mês (AAAA-MM).' : conferir(lista, ['entrou', 'saiu', 'saldo'], moeda, {negativos: ['saldo']});
  if (erro) return recusa('gf-fluxo', erro);
  const ids = definicoes();
  const temSaldo = lista.some(s => temNumero(s.saldo));
  const hachurado = s => !!(s.aberto || s.futuro);
  const situacao = s => s.futuro ? 'previsão' : s.aberto ? 'mês aberto' : s.fechado ? 'fechado' : 'realizado';
  const rotulo = opcoes.rotulo || conclusaoFluxo(lista, moeda);
  const comoLer = [[amostra('entrada:solido', ids), 'entrou (para cima)'], [amostra('saida:solido', ids), 'saiu (para baixo)']];
  if (temSaldo) comoLer.push([amostra('destaque:linha', ids), 'saldo no fim do mês (faixa de cima, escala própria)']);
  if (lista.some(hachurado)) comoLer.push([amostra('entrada:hachura', ids), 'hachura: mês aberto ou previsão']);
  if (lista.some(s => s.fechado)) comoLer.push([amostra('contexto:cadeado', ids), 'mês fechado']);
  const tabela = tabelaDe(rotulo, ['Mês', 'Entrou', 'Saiu', 'Saldo no fim', 'Situação'], lista.map(s => [mesCurto(s.mes), dinheiro(s.entrou, moeda), dinheiro(s.saiu, moeda), temNumero(s.saldo) ? dinheiro(s.saldo, moeda) : '—', situacao(s)]), [1, 2, 3]);
  const m = moldura('gf-fluxo', {rotulo, comoLer, tabela, ids});
  const n = lista.length;
  let geo = null, faixaSel = null;
  const inicial = Math.max(0, lista.map(s => !s.futuro).lastIndexOf(true));
  const nav = navegavel(m, {total: n, inicial, vertical: false,
    indiceEm: e => { if (!geo) return -1; const x = e.clientX - m.area.getBoundingClientRect().left - geo.esq; return x < 0 || x > geo.plotW ? -1 : Math.min(n - 1, Math.floor(x / geo.slot)); },
    mostrar: k => {
      if (!geo) return '';
      if (k < 0) { m.dica.hidden = true; faixaSel.setAttribute('visibility', 'hidden'); return ''; }
      const s = lista[k];
      faixaSel.setAttribute('x', String(geo.esq + geo.slot * k)); faixaSel.setAttribute('visibility', 'visible');
      const linhas = [`Entrou ${dinheiro(s.entrou, moeda)}`, `Saiu ${dinheiro(s.saiu, moeda)}`];
      if (temSaldo) linhas.push(temNumero(s.saldo) ? `Saldo no fim ${dinheiro(s.saldo, moeda)}` : 'Saldo não informado');
      const titulo = `${capital(mesLongo(s.mes))} · ${situacao(s)}`;
      preencherDica(m.dica, titulo, linhas);
      posicionarDica(m.dica, m.area, geo.esq + geo.slot * (k + 0.5), geo.y0f, geo.slot / 2);
      return `${titulo}. ${linhas.join('. ')}.`;
    }});
  m.area.style.minHeight = (temSaldo ? 70 + 10 : 6) + 156 + 40 + 'px';
  responsivo(m.area, W => {
    const estreito = W < 520;
    const maxE = Math.max(0, ...lista.map(s => s.entrou || 0)), maxS = Math.max(0, ...lista.map(s => s.saiu || 0));
    const passo = passoEixo(maxE, maxS, estreito ? 4 : 6);
    const topoE = Math.ceil(maxE / passo) * passo, topoS = Math.ceil(maxS / passo) * passo;
    const marcas = [];
    for (let v = -topoS; v <= topoE; v += passo) marcas.push(v);
    // a margem esquerda é a do rótulo mais largo do eixo: o sinal de menos nunca fica cortado
    const esq = Math.ceil(Math.max(28, ...marcas.map(v => larguraTexto(compactoEixo(v, moeda))))) + 10;
    const dir = 6, plotW = Math.max(40, W - esq - dir), slot = plotW / n, larg = Math.max(4, Math.min(28, slot * 0.62));
    const altSaldo = temSaldo ? 70 : 0, y0f = altSaldo + (temSaldo ? 10 : 6), altFluxo = estreito ? 132 : 156, y1f = y0f + altFluxo;
    const yMes = y1f + 17, yCad = yMes + 5, H = yCad + 13;
    const faixa = topoE + topoS || 2, zeroY = y0f + altFluxo * (topoE + topoS ? topoE / faixa : 0.5), escala = altFluxo / faixa;
    const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, width: String(W), height: String(H), 'aria-hidden': 'true', focusable: 'false'});
    faixaSel = svgEl('rect', {x: '0', y: String(y0f - 4), width: String(slot), height: String(altFluxo + 8), rx: '6', class: 'gf-faixa-sel', visibility: 'hidden'});
    svg.append(faixaSel);
    // grade e eixo (abreviado; o valor inteiro está na dica e na tabela)
    for (const v of marcas) {
      const y = zeroY - v * escala;
      svg.append(svgEl('line', {x1: String(esq), x2: String(W - dir), y1: String(y), y2: String(y), class: v === 0 ? 'gf-zero' : 'gf-grade'}));
      const t = svgEl('text', {x: String(esq - 6), y: String(y), dy: '0.35em', 'text-anchor': 'end', class: 'gf-eixo-rotulo'});
      t.textContent = compactoEixo(v, moeda);
      svg.append(t);
    }
    // barras: base na linha do zero, cantos arredondados só na ponta
    const barra = (x, base, h, paraCima) => { const r = Math.min(3, larg / 2, h); const y = paraCima ? base - h : base + h; return paraCima ? `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + larg - r}Q${x + larg} ${y} ${x + larg} ${y + r}V${base}Z` : `M${x} ${base}V${y - r}Q${x} ${y} ${x + r} ${y}H${x + larg - r}Q${x + larg} ${y} ${x + larg} ${y - r}V${base}Z`; };
    const largMes = Math.max(...lista.map(s => larguraTexto(mesCurto(s.mes), 12, 700)));
    const passoRotulo = Math.max(1, Math.ceil((largMes + 10) / slot));
    const iAberto = lista.findIndex(s => s.aberto), ancoraRotulo = iAberto >= 0 ? iAberto : n - 1;   // o mês aberto sempre tem rótulo
    lista.forEach((s, k) => {
      const cx = esq + slot * (k + 0.5), x = cx - larg / 2;
      for (const [campo, serieNome, paraCima] of [['entrou', 'entrada', true], ['saiu', 'saida', false]]) {
        const v = s[campo] || 0;
        if (v <= 0) continue;
        const p = svgEl('path', {d: barra(x, zeroY, Math.max(1, v * escala), paraCima), class: `gf-m is-${serieNome}${hachurado(s) ? ' is-hachura' : ''}`});
        if (hachurado(s)) p.style.fill = `url(#${ids.ids[serieNome]})`;
        svg.append(p);
      }
      if (!(s.entrou > 0) && !(s.saiu > 0)) svg.append(svgEl('rect', {x: String(x), y: String(zeroY - 1), width: String(larg), height: '2', class: 'gf-vazio'}));
      if (Math.abs(ancoraRotulo - k) % passoRotulo === 0) {
        let ancora = 'middle', tx = cx;
        if (cx + largMes / 2 > W) { ancora = 'end'; tx = W; }
        const t = svgEl('text', {x: String(tx), y: String(yMes), 'text-anchor': ancora, class: 'gf-mes-rotulo' + (s.aberto ? ' is-destaque' : '')});
        t.textContent = mesCurto(s.mes);
        svg.append(t);
      }
      if (s.fechado) desenharCadeado(svg, cx, yCad);
    });
    // saldo: faixa própria, linha de 2,5px em ouro, marcadores de 8px com anel da superfície, rótulo direto no fim
    if (temSaldo) {
      const vals = lista.filter(s => temNumero(s.saldo)).map(s => s.saldo);
      const lo = Math.min(...vals), hi = Math.max(...vals), yTopo = 26, yBase = altSaldo - 8;
      const ys = v => hi === lo ? (yTopo + yBase) / 2 : yBase - (v - lo) / (hi - lo) * (yBase - yTopo);
      const ultimoSaldo = lista.map(s => temNumero(s.saldo)).lastIndexOf(true);
      const textoFim = `${dinheiro(lista[ultimoSaldo].saldo, moeda)} em ${mesCurto(lista[ultimoSaldo].mes)}`;
      const cabe = larguraTexto('Saldo no fim do mês', 12, 600) + larguraTexto(textoFim, 12, 600) + 16 <= W;   // tela estreita: título curto
      const titulo = svgEl('text', {x: '0', y: '13', class: 'gf-saldo-titulo'}); titulo.textContent = cabe ? 'Saldo no fim do mês' : 'Saldo'; svg.append(titulo);
      for (let k = 1; k < n; k++) {
        const a = lista[k - 1], b = lista[k];
        if (!temNumero(a.saldo) || !temNumero(b.saldo)) continue;
        svg.append(svgEl('line', {x1: String(esq + slot * (k - 0.5)), y1: String(ys(a.saldo)), x2: String(esq + slot * (k + 0.5)), y2: String(ys(b.saldo)), class: 'gf-saldo-linha' + (b.futuro ? ' is-previsao' : '')}));
      }
      lista.forEach((s, k) => { if (temNumero(s.saldo)) svg.append(svgEl('circle', {cx: String(esq + slot * (k + 0.5)), cy: String(ys(s.saldo)), r: '4', class: 'gf-saldo-ponto' + (s.futuro ? ' is-previsao' : '')})); });
      const fim = svgEl('text', {x: String(W - dir), y: '13', 'text-anchor': 'end', class: 'gf-saldo-fim'});
      fim.textContent = textoFim;
      svg.append(fim);
    }
    geo = {esq, plotW, slot, y0f};
    const antigo = m.area.querySelector('svg');
    if (antigo) antigo.replaceWith(svg); else m.area.prepend(svg);
    m.area.style.minHeight = '';
    if (nav.atual >= 0) nav.ir(nav.atual, false);
  });
  m.area.append(m.dica);
  return m.fig;
}
// conclusão de reserva (quem chama deve mandar a sua): só comparações, nenhuma soma
function conclusaoFluxo(lista, moeda) {
  const reais = lista.filter(s => !s.futuro && temNumero(s.entrou) && temNumero(s.saiu));
  const maisEntrou = reais.filter(s => s.entrou > s.saiu).length;
  const comSaldo = lista.filter(s => temNumero(s.saldo) && !s.futuro);
  let f = `Fluxo de ${mesCurto(lista[0].mes)} a ${mesCurto(lista[lista.length - 1].mes)}: entrou mais do que saiu em ${maisEntrou} de ${reais.length} ${reais.length === 1 ? 'mês' : 'meses'}.`;
  if (comSaldo.length >= 2) f += ` O saldo foi de ${dinheiro(comSaldo[0].saldo, moeda)} (${mesCurto(comSaldo[0].mes)}) para ${dinheiro(comSaldo[comSaldo.length - 1].saldo, moeda)} (${mesCurto(comSaldo[comSaldo.length - 1].mes)}).`;
  return f;
}

// ── cascata do mês, deitada para caber no celular: receita → taxas → imposto → custos → resultado → partes.
// passos: [{rotulo, valor, tipo: 'total'|'delta'|'parte', cor?, destaque?, estimado?, previsto?, nota?, moeda?}].
// 'total' é uma barra do zero (o primeiro abre a cascata; os seguintes precisam bater com os passos anteriores);
// 'delta' anda a partir do nível anterior (negativo tira); 'parte' reparte o total anterior até voltar ao zero.
// A conferência é em BigInt e só recusa: nenhum número escrito sai de uma soma feita aqui.
export function cascata(passos, opcoes = {}) {
  const lista = Array.isArray(passos) ? passos : [];
  const moeda = opcoes.moeda || (lista.find(p => p.moeda) || {}).moeda || 'BRL';
  let erro = !lista.length ? 'não há passos.' : lista.some(p => !['total', 'delta', 'parte'].includes(p.tipo)) ? 'cada passo precisa do tipo total, delta ou parte.' : lista[0].tipo !== 'total' ? 'a cascata começa por um total (a receita).' : conferir(lista, ['valor'], moeda, {negativos: ['valor']});
  if (!erro && lista.some(p => !temNumero(p.valor))) erro = 'todo passo precisa do valor.';
  const barras = [];
  if (!erro) {
    let nivel = null;
    for (const p of lista) {
      const v = BigInt(p.valor);
      if (p.tipo === 'total') {
        if (nivel !== null && v !== nivel) { erro = `a cascata não fecha: “${p.rotulo}” não é o resultado dos passos anteriores. Confira a conta antes de desenhar.`; break; }
        barras.push([0n, v]); nivel = v;
      } else if (p.tipo === 'delta') { barras.push([nivel, nivel + v]); nivel += v; }
      else { barras.push([nivel, nivel - v]); nivel -= v; }
    }
    if (!erro && lista.some(p => p.tipo === 'parte') && nivel !== 0n) erro = 'as partes não somam o total que repartem: confira o rateio.';
  }
  if (erro) return recusa('gf-cascata', erro);
  const ids = definicoes();
  const corDe = (p, k) => p.cor || (p.tipo === 'total' ? (k === 0 ? 'entrada' : 'destaque') : p.tipo === 'parte' ? (p.destaque ? 'destaque' : 'contexto') : p.valor < 0 ? 'saida' : 'entrada');
  const valorTexto = p => p.tipo === 'delta' ? comSinal(p.valor, moeda) : dinheiro(p.valor, moeda);
  const rotulo = opcoes.rotulo || `${lista[0].rotulo}: ${dinheiro(lista[0].valor, moeda)}; ${lista.filter(p => p.tipo === 'total').slice(1).map(p => `${p.rotulo}: ${dinheiro(p.valor, moeda)}`).join('; ') || 'sem total final'}.`;
  const cores = new Set(lista.map(corDe));
  const comoLer = ['cada barra começa onde a anterior terminou.'];
  if (cores.has('entrada')) comoLer.push([amostra('entrada:solido', ids), 'entra']);
  if (cores.has('saida')) comoLer.push([amostra('saida:solido', ids), 'sai']);
  if (cores.has('destaque')) comoLer.push([amostra('destaque:solido', ids), 'resultado e a sua parte']);
  if (cores.has('contexto')) comoLer.push([amostra('contexto:solido', ids), 'parte das outras sócias']);
  if (lista.some(p => p.estimado)) comoLer.push([amostra('contexto:estimado', ids), 'contorno: estimado']);
  if (lista.some(p => p.previsto)) comoLer.push([amostra('contexto:hachura', ids), 'hachura: previsto']);
  const tabela = tabelaDe(rotulo, ['Passo', 'Valor', 'Observação'], lista.map(p => [p.rotulo, valorTexto(p), [p.nota, p.estimado ? 'estimado' : '', p.previsto ? 'previsto' : ''].filter(Boolean).join(' · ') || '—']), [1]);
  const m = moldura('gf-cascata', {rotulo, comoLer, tabela, ids});
  const nums = barras.flat().map(Number);
  const lo = Math.min(0, ...nums), hi = Math.max(0, ...nums), span = hi - lo || 1;
  const pos = v => (Number(v) - lo) / span * 100;
  const linhas = el('div', 'gf-cascata-linhas');
  const nos = lista.map((p, k) => {
    const [de, ate] = barras[k], cor = corDe(p, k);
    const linha = el('div', `gf-cascata-linha is-${p.tipo}${p.estimado ? ' is-estimado' : ''}${p.destaque ? ' is-destaque' : ''}`);
    const rot = el('span', 'gf-cascata-rotulo', p.rotulo);
    if (p.nota) rot.append(el('small', null, p.nota));
    const trilho = svgEl('svg', {class: 'gf-cascata-trilho', 'aria-hidden': 'true', focusable: 'false'});
    trilho.append(svgEl('line', {x1: pos(0) + '%', x2: pos(0) + '%', y1: '0', y2: '100%', class: 'gf-zero'}));
    if (p.tipo !== 'total') trilho.append(svgEl('line', {x1: pos(de) + '%', x2: pos(de) + '%', y1: '0', y2: '100%', class: 'gf-ligacao'}));
    const x0 = Math.min(pos(de), pos(ate)), largura = Math.max(0.8, Math.abs(pos(ate) - pos(de)));
    const r = svgEl('rect', {x: x0 + '%', y: '2', width: largura + '%', height: '14', rx: '3', class: `gf-m is-${cor}${p.previsto ? ' is-hachura' : p.estimado ? ' is-estimado' : ''}`});
    if (p.previsto) r.style.fill = `url(#${ids.ids[cor]})`;
    trilho.append(r);
    linha.append(rot, trilho, el('span', 'gf-cascata-valor', valorTexto(p)));
    linhas.append(linha);
    return {linha, fim: Math.max(pos(de), pos(ate))};
  });
  m.area.append(linhas, m.dica);
  navegavel(m, {total: lista.length, inicial: lista.length - 1, vertical: true,
    indiceEm: e => nos.findIndex(({linha}) => { const b = linha.getBoundingClientRect(); return e.clientY >= b.top && e.clientY <= b.bottom; }),
    mostrar: k => {
      nos.forEach(({linha}, j) => linha.classList.toggle('is-sel', j === k));
      if (k < 0) { m.dica.hidden = true; return ''; }
      const p = lista[k];
      const extra = [p.nota, p.estimado ? 'estimado' : '', p.previsto ? 'previsto' : ''].filter(Boolean).join(' · ');
      preencherDica(m.dica, p.rotulo, [valorTexto(p) + (extra ? ' · ' + extra : '')]);
      const {linha} = nos[k], a = m.area.getBoundingClientRect(), t = linha.children[1].getBoundingClientRect(), b = linha.getBoundingClientRect();
      const embaixo = b.top - a.top < a.height / 2;   // na metade de baixo a dica sobe, para não cobrir o rodapé
      posicionarDica(m.dica, m.area, t.left - a.left + t.width * nos[k].fim / 100, embaixo ? b.bottom - a.top + 2 : b.top - a.top - m.dica.offsetHeight - 2, 0);
      return `${p.rotulo}: ${valorTexto(p)}${extra ? ', ' + extra : ''}.`;
    }});
  return m.fig;
}

// ── minigráfico de 12 meses (Meu painel): uma linha, o último ponto marcado e o valor dele escrito ao lado.
// serie: [{mes, valor|null, aberto?, futuro?, moeda?}]; opcoes.cor: entrada | saida | destaque | contexto.
export function minigrafico(serie, opcoes = {}) {
  const lista = Array.isArray(serie) ? serie : [];
  const moeda = opcoes.moeda || (lista.find(s => s.moeda) || {}).moeda || 'BRL';
  const erro = !lista.length ? 'a série está vazia.' : !lista.some(s => temNumero(s.valor)) ? 'nenhum mês tem valor ainda.' : conferir(lista, ['valor'], moeda, {negativos: ['valor']});
  if (erro) return recusa('gf-mini', erro);
  const ids = definicoes();
  const cor = SERIES.includes(opcoes.cor) ? opcoes.cor : 'contexto';
  const n = lista.length;
  const ultimo = lista.map(s => temNumero(s.valor)).lastIndexOf(true);
  const situacao = s => s.futuro ? 'previsão' : s.aberto ? 'mês aberto' : '';
  const rotulo = opcoes.rotulo || `${opcoes.nome || 'Valor'} de ${mesCurto(lista[0].mes)} a ${mesCurto(lista[n - 1].mes)}; em ${mesCurto(lista[ultimo].mes)}: ${dinheiro(lista[ultimo].valor, moeda)}.`;
  const comoLer = [[amostra(cor + ':linha', ids), `${opcoes.nome || 'valor'} de cada mês`]];
  if (lista.some(s => s.aberto || s.futuro)) comoLer.push('tracejado e ponto vazio: mês aberto ou previsão');
  const tabela = tabelaDe(rotulo, ['Mês', opcoes.nome ? capital(opcoes.nome) : 'Valor', 'Situação'], lista.map(s => [mesCurto(s.mes), temNumero(s.valor) ? dinheiro(s.valor, moeda) : '—', situacao(s) || '—']), [1]);
  const m = moldura('gf-mini is-' + cor, {rotulo, comoLer, tabela, ids});
  const linha = el('div', 'gf-mini-linha');
  const fim = el('span', 'gf-mini-fim');
  fim.append(el('strong', null, dinheiro(lista[ultimo].valor, moeda)), el('span', null, mesCurto(lista[ultimo].mes) + (situacao(lista[ultimo]) ? ' · ' + situacao(lista[ultimo]) : '')));
  m.area.replaceWith(linha);
  linha.append(m.area, fim);
  let geo = null, marca = null;
  const H = 46, pad = 7;
  const nav = navegavel(m, {total: n, inicial: ultimo,
    indiceEm: e => { if (!geo) return -1; const x = e.clientX - m.area.getBoundingClientRect().left; return Math.max(0, Math.min(n - 1, Math.round((x - pad) / (geo.passo || 1)))); },
    mostrar: k => {
      if (!geo) return '';
      if (k < 0) { m.dica.hidden = true; marca.setAttribute('visibility', 'hidden'); return ''; }
      const s = lista[k];
      if (temNumero(s.valor)) { marca.setAttribute('cx', String(geo.x(k))); marca.setAttribute('cy', String(geo.y(s.valor))); marca.setAttribute('visibility', 'visible'); }
      else marca.setAttribute('visibility', 'hidden');
      const titulo = capital(mesLongo(s.mes)) + (situacao(s) ? ' · ' + situacao(s) : '');
      const texto = temNumero(s.valor) ? dinheiro(s.valor, moeda) : 'sem valor';
      preencherDica(m.dica, titulo, [texto]);
      posicionarDica(m.dica, m.area, geo.x(k), H + 4, 4);
      return `${titulo}: ${texto}.`;
    }});
  m.area.style.minHeight = H + 'px';
  responsivo(m.area, W => {
    const vals = lista.filter(s => temNumero(s.valor)).map(s => s.valor);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const passo = n > 1 ? (W - 2 * pad) / (n - 1) : 0;
    const x = k => n > 1 ? pad + k * passo : W / 2;
    const y = v => hi === lo ? H / 2 : H - pad - (v - lo) / (hi - lo) * (H - 2 * pad);
    const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, width: String(W), height: String(H), 'aria-hidden': 'true', focusable: 'false'});
    for (let k = 1; k < n; k++) {
      const a = lista[k - 1], b = lista[k];
      if (!temNumero(a.valor) || !temNumero(b.valor)) continue;
      svg.append(svgEl('line', {x1: String(x(k - 1)), y1: String(y(a.valor)), x2: String(x(k)), y2: String(y(b.valor)), class: `gf-mini-traco is-${cor}${b.aberto || b.futuro ? ' is-previsao' : ''}`}));
    }
    const u = lista[ultimo];
    svg.append(svgEl('circle', {cx: String(x(ultimo)), cy: String(y(u.valor)), r: '4', class: `gf-mini-ponto is-${cor}${u.aberto || u.futuro ? ' is-vazio' : ''}`}));
    marca = svgEl('circle', {cx: '0', cy: '0', r: '5.5', class: 'gf-mini-marca', visibility: 'hidden'});
    svg.append(marca);
    geo = {x, y, passo};
    const antigo = m.area.querySelector('svg');
    if (antigo) antigo.replaceWith(svg); else m.area.prepend(svg);
    m.area.style.minHeight = '';
    if (nav.atual >= 0) nav.ir(nav.atual, false);
  });
  m.area.append(m.dica);
  return m.fig;
}
