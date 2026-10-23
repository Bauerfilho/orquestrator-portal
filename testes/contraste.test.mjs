// Contraste dos tokens do Finanças (plano §6.2 e §8.8), letra mínima de 12px nas folhas novas e a direção dos imports
// da base das telas da rotina. Lê os --fin-* e --cat-* do livro.css nos dois temas e mede contra o cartão e o fundo da
// página: marca de gráfico ≥ 3:1 (WCAG 1.4.11) e texto ≥ 4,5:1 (1.4.3). Texto é todo token usado como `color:` nas
// folhas do livro, mais ok/aviso/perigo (que o plano reserva a selo e texto). Uso: node --test testes/*.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = arquivo => readFileSync(join(raiz, arquivo), 'utf8');
const NOVOS_CSS = ['assinaturas.css', 'acerto.css', 'caixa.css', 'conciliacao.css', 'fechamento.css', 'ajuda.css'];
const MODULOS_ROTINA = ['assinaturas.js', 'acerto.js', 'caixa.js', 'conciliacao.js', 'fechamento.js', 'ajuda.js'];

// ── medidas WCAG ───────────────────────────────────────────────────────────────────────────────────────────────────
function luminancia(hex) {
  const h = hex.replace('#', '');
  const cheio = h.length === 3 ? [...h].map(c => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(cheio.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ── leitura das folhas ───────────────────────────────────────────────────────────────────────────────────────────────
const semComentarios = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
// as declarações de um seletor exato (ex.: ":root"), na ordem do arquivo; a última vence, como no navegador
function variaveis(css, seletor) {
  const saida = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m; (m = re.exec(semComentarios(css)));) {
    if (m[1].trim() !== seletor) continue;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) saida[d[1]] = d[2].trim();
  }
  return saida;
}
const livro = ler('livro.css');
const escuro = variaveis(livro, ':root');
const claro = {...escuro, ...variaveis(livro, ':root[data-tema=claro]')};
const baseEscura = variaveis(ler('style.css'), ':root');
const baseClara = variaveis(ler('tema.css'), ':root[data-tema=claro]');
const TEMAS = {
  escuro: {tokens: escuro, fundos: {cartão: baseEscura['--panel'], página: baseEscura['--bg']}},
  claro: {tokens: claro, fundos: {cartão: baseClara['--panel'], página: baseClara['--bg']}},
};
const cores = tokens => Object.entries(tokens).filter(([k, v]) => /^--(fin|cat)-/.test(k) && /^#[0-9a-f]{3,6}$/i.test(v));
// tokens usados como cor de texto em qualquer folha do livro (background-color e border-color não contam)
const folhasDoLivro = ['livro.css', ...NOVOS_CSS].map(ler).map(semComentarios).join('\n');
const usadosComoTexto = new Set([...folhasDoLivro.matchAll(/(?<![-\w])color\s*:\s*var\((--(?:fin|cat)-[\w-]+)/g)].map(m => m[1]));

test('os fundos medidos são os do plano: cartão e página nos dois temas', () => {
  assert.deepEqual(TEMAS.escuro.fundos, {cartão: '#14271d', página: '#0c1913'});
  assert.deepEqual(TEMAS.claro.fundos, {cartão: '#ffffff', página: '#f4f3ee'});
});

test('as cores semânticas e de categoria existem nos dois temas', () => {
  for (const nome of ['--fin-entrada', '--fin-saida', '--fin-destaque', '--fin-contexto', '--fin-ok', '--fin-aviso', '--fin-perigo', '--fin-entrada-texto', '--fin-saida-texto', '--cat-0', '--cat-1', '--cat-2', '--cat-3', '--cat-4', '--cat-5', '--cat-6']) {
    for (const [tema, {tokens}] of Object.entries(TEMAS)) assert.match(tokens[nome] || '', /^#[0-9a-f]{6}$/i, `${nome} no tema ${tema}`);
  }
});

test('toda marca de gráfico tem pelo menos 3:1 sobre o cartão e sobre o fundo, nos dois temas', () => {
  const falhas = [];
  for (const [tema, {tokens, fundos}] of Object.entries(TEMAS)) {
    for (const [nome, cor] of cores(tokens)) for (const [onde, fundo] of Object.entries(fundos)) {
      const r = contraste(cor, fundo);
      if (r < 3) falhas.push(`${tema}: ${nome} ${cor} sobre o ${onde} ${fundo} = ${r.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(falhas, []);
});

test('todo token usado como texto tem pelo menos 4,5:1 sobre o cartão e sobre o fundo, nos dois temas', () => {
  const texto = new Set(['--fin-ok', '--fin-aviso', '--fin-perigo', ...usadosComoTexto]);
  assert.ok(usadosComoTexto.size >= 3, 'a leitura achou os usos de color: var(--fin-…)');
  const falhas = [];
  for (const [tema, {tokens, fundos}] of Object.entries(TEMAS)) {
    for (const nome of texto) for (const [onde, fundo] of Object.entries(fundos)) {
      const r = contraste(tokens[nome], fundo);
      if (r < 4.5) falhas.push(`${tema}: ${nome} ${tokens[nome]} sobre o ${onde} ${fundo} = ${r.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(falhas, []);
});

test('o ouro de destaque nunca é cor de texto e o perigo nunca preenche gráfico (§6.2)', () => {
  assert.ok(!usadosComoTexto.has('--fin-destaque'), '--fin-destaque só em marca de gráfico; no texto, --gold');
  assert.doesNotMatch(folhasDoLivro, /(?:fill|background(?:-color)?)\s*:\s*var\(--fin-perigo/, '--fin-perigo é só selo e texto');
});

test('as medições batem com as do plano (§6.2)', () => {
  const r = (t, k, f) => Number(contraste(TEMAS[t].tokens[k], TEMAS[t].fundos[f]).toFixed(2));
  assert.equal(r('claro', '--fin-entrada', 'cartão'), 5.34);
  assert.equal(r('claro', '--fin-destaque', 'página'), 3.29);
  assert.equal(r('claro', '--fin-contexto', 'página'), 3.17);
  assert.equal(r('escuro', '--fin-entrada', 'cartão'), 4.18);
  assert.equal(r('escuro', '--fin-saida', 'cartão'), 4.08);
});

// ── letra mínima ─────────────────────────────────────────────────────────────────────────────────────────────────────
function letrasPequenas(css, arquivo) {
  const achados = [];
  const limpo = semComentarios(css);
  for (const m of limpo.matchAll(/font-size\s*:\s*([\d.]+)px/g)) if (Number(m[1]) < 12) achados.push(`${arquivo}: font-size ${m[1]}px`);
  for (const m of limpo.matchAll(/(?<![-\w])font\s*:([^;}]*)/g)) {
    const tamanho = /([\d.]+)px/.exec(m[1]);
    if (tamanho && Number(tamanho[1]) < 12) achados.push(`${arquivo}: font ${m[1].trim()}`);
  }
  return achados;
}

test('nenhuma das 6 folhas novas declara letra abaixo de 12px', () => {
  const achados = NOVOS_CSS.flatMap(f => letrasPequenas(ler(f), f));
  assert.deepEqual(achados, []);
});

test('a parte nova do livro.css (base das telas da rotina) também não desce de 12px', () => {
  const marca = livro.indexOf('/* ── base das telas da rotina (F2-2)');
  assert.ok(marca > 0, 'o livro.css tem a marca da parte nova');
  assert.deepEqual(letrasPequenas(livro.slice(marca), 'livro.css (parte nova)'), []);
  // e o detector funciona
  assert.equal(letrasPequenas('.x{font-size:11px}.y{font:600 10px/1.2 var(--sans)}.z{font-size:12px}', 'teste').length, 2);
});

// ── direção dos imports: a base não conhece as telas (sem ciclo) ─────────────────────────────────────────────────────
const importsDe = arquivo => [...semComentarios(ler(arquivo)).replace(/\/\/[^\n]*/g, '').matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g)].map(m => m[1]);

test('livro.js importa só o razão e os gráficos: nenhum módulo da rotina (sem ciclo)', () => {
  assert.deepEqual(importsDe('livro.js').sort(), ['./graficos.js', './razao.js']);
  assert.doesNotMatch(semComentarios(ler('livro.js')), /import\(/, 'nem import dinâmico');
});

test('rotina.js carrega os seis esqueletos, e cada um importa só da base', () => {
  assert.deepEqual(importsDe('rotina.js'), MODULOS_ROTINA.map(f => './' + f));
  for (const f of MODULOS_ROTINA) {
    const imports = importsDe(f);
    assert.ok(imports.includes('./livro.js'), `${f} importa a base de './livro.js'`);
    // a base das páginas: livro, gráficos, razão e as contas puras (contas.js só importa razao.js e selo.js: sem ciclo)
    for (const i of imports) assert.ok(['./livro.js', './graficos.js', './razao.js', './contas.js'].includes(i), `${f} não importa ${i}`);
  }
});

test('o index.html liga as 6 folhas novas, o rotina.js e os contêineres das telas', () => {
  const html = ler('index.html');
  for (const f of NOVOS_CSS) assert.match(html, new RegExp(`<link rel="stylesheet" href="${f}">`));
  assert.match(html, /<script type="module" src="rotina\.js"><\/script>/);
  for (const id of ['acerto-resumo', 'assinaturas-topo', 'sociedade-acerto', 'caixa-calculado', 'fechamento-content']) assert.match(html, new RegExp(`id="${id}"`));
  const ordem = (a, b) => assert.ok(html.indexOf(`id="${a}"`) < html.indexOf(`id="${b}"`), `${a} vem antes de ${b}`);
  ordem('livro-resumo', 'acerto-resumo'); ordem('assinaturas-topo', 'subscriptions-content'); ordem('society-content', 'sociedade-acerto'); ordem('livro-content', 'fechamento-content');
  assert.match(html, /<details class="registro-importado" open><summary>Registro importado do pacote de 18\/10<\/summary><div id="cash-content"><\/div><\/details>/);
});
