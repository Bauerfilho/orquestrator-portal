// O legado do Laboratório sob a ponte nativa (P1c, 11/11/2026). No AI Cask, os documentos da galeria anterior que só
// existem no app (as maquetes antigas) chegam pelo host que o app apresenta, em financeHost.galeriaLegado, na mesma forma
// do pacote cifrado ({files, titles}). Confere, pela static-bridge.js de verdade numa janela de mentira: (a1) o catálogo
// os lista como "Sem stand" e galeriaUrl entrega o HTML do app; (a2) o mesmo nome no repositório e no legado: vence o
// repositório; (a3) sem a ponte nativa, um galeriaLegado plantado é ignorado; (a4) forma estranha é ignorada sem exceção.
// Uso: node --test testes/*.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveObjectURL} from 'node:buffer';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://portal.exemplo/financas/';
const comPonte = extra => ({webkit: {messageHandlers: {finance: {postMessage() {}}}}, ...extra});
const json = dados => JSON.stringify(dados, null, 1).replace(/</g, '\\u003c');
const indice = itens => `<!doctype html><html><head><meta charset="utf-8"><title>Galeria de maquetes</title></head><body>
<script type="application/json" id="catalogo">
${json(itens)}
</script></body></html>`;
const CATALOGO = [{id: 'sinal', arquivo: 'apps/sinal.html', nome: 'Sinal', colecao: 'casa'}, {id: 'quadro', arquivo: 'apps/quadro.html', nome: 'Quadro', colecao: 'referencia'}];
const REPO = {
  'galeria/index.html': indice(CATALOGO),
  'galeria/apps/sinal.html': '<!doctype html><title>Sinal · do repositório</title><p>sinal do repositório</p>',
  'galeria/apps/quadro.html': '<!doctype html><title>Quadro</title><p>quadro</p>',
};
const FOLHETO = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Folheto Vivo — Catálogo</title></head><body><p>folheto do app</p></body></html>';
const LAMINA = '<!doctype html><title>Lâmina — Leitura</title><p>lâmina do app</p>';
const LEGADO = {
  files: {'apps/folheto.html': FOLHETO, 'apps/lamina.html': LAMINA, 'apps/sinal.html': '<p>sinal ANTIGO do app</p>'},
  titles: {'apps/folheto.html': 'Folheto Vivo — Catálogo', 'apps/lamina.html': 'Lâmina — Leitura', 'apps/sinal.html': 'Sinal (antigo)'},
};

// a static-bridge.js publicada, carregada numa janela de mentira (cada caso, uma instância nova do módulo). O fetch falso
// responde o que está em REPO (relativo à BASE) e 404 no resto; ele fica no lugar até `restaurar()`.
let caso = 0;
async function carregarPonte(janela) {
  const pedidos = [];
  const antes = {window: globalThis.window, document: globalThis.document, location: globalThis.location, fetch: globalThis.fetch};
  globalThis.window = janela;
  globalThis.document = {documentElement: {dataset: {}}, getElementById: () => null};
  globalThis.location = {href: BASE};
  globalThis.fetch = async url => {
    pedidos.push(String(url));
    const corpo = String(url).startsWith(BASE) ? REPO[String(url).slice(BASE.length)] : undefined;
    return corpo === undefined ? {status: 404, ok: false, text: async () => '404'} : {status: 200, ok: true, text: async () => corpo};
  };
  try { await import(pathToFileURL(join(raiz, 'static-bridge.js')).href + '?legado=' + (++caso)); }
  finally { for (const nome of ['window', 'document', 'location']) { if (antes[nome] === undefined) delete globalThis[nome]; else globalThis[nome] = antes[nome]; } }
  return {janela, pedidos, restaurar: () => { if (antes.fetch === undefined) delete globalThis.fetch; else globalThis.fetch = antes.fetch; }};
}
const ler = async url => { const blob = resolveObjectURL(url); assert.ok(blob, 'o blob: ' + url + ' não existe'); return blob.text(); };
const catalogoDe = html => JSON.parse(/<script type="application\/json" id="catalogo">([\s\S]*?)<\/script>/.exec(html)[1]);
const hostDoApp = galeriaLegado => ({kind: 'aicask', tema: 'claro', galeria: true, team: false, readOnly: false, decide: false, galeriaLegado});

test('a1 · ponte nativa + galeriaLegado: o catálogo lista cada documento do app como "Sem stand" e galeriaUrl entrega o HTML do app', async () => {
  const {janela, pedidos, restaurar} = await carregarPonte(comPonte({financeHost: hostDoApp(LEGADO)}));
  try {
    const host = janela.financeHost;
    const itens = catalogoDe(await ler(await host.galeriaUrl('index.html')));
    assert.deepEqual(itens.slice(0, 2), CATALOGO, 'o catálogo do repositório fica na frente, intacto');
    assert.deepEqual(itens.slice(2), [
      {id: 'folheto', arquivo: 'apps/folheto.html', nome: 'Folheto Vivo — Catálogo', legado: true},
      {id: 'lamina', arquivo: 'apps/lamina.html', nome: 'Lâmina — Leitura', legado: true},
    ], 'cada documento do app que o catálogo não lista entra como "Sem stand", com o nome que o app declarou');
    assert.equal(await ler(await host.galeriaUrl('apps/folheto.html')), FOLHETO, 'o HTML é o do app, byte a byte');
    assert.equal(await ler(await host.galeriaUrl('apps/lamina.html')), LAMINA);
    assert.equal(host.galeriaTitle('apps/folheto.html'), 'Folheto Vivo — Catálogo');
    assert.ok(!pedidos.some(url => /folheto|lamina/.test(url)), 'o que não está no catálogo do repositório não vira pedido ao repositório: ' + pedidos.join(' '));
  } finally { restaurar(); }
});

test('a2 · o mesmo nome no repositório e no legado do app: vence o repositório', async () => {
  const {janela, restaurar} = await carregarPonte(comPonte({financeHost: hostDoApp(LEGADO)}));
  try {
    const host = janela.financeHost;
    const itens = catalogoDe(await ler(await host.galeriaUrl('index.html')));
    assert.equal(itens.filter(item => item.arquivo === 'apps/sinal.html').length, 1, 'sinal aparece uma vez só');
    assert.deepEqual(itens.find(item => item.arquivo === 'apps/sinal.html'), CATALOGO[0], 'e é a ficha do repositório, sem "legado"');
    assert.equal(await ler(await host.galeriaUrl('apps/sinal.html')), REPO['galeria/apps/sinal.html']);
    assert.equal(host.galeriaTitle('apps/sinal.html'), 'Sinal');
  } finally { restaurar(); }
});

test('a3 · sem a ponte nativa, um galeriaLegado plantado na página é ignorado (no portal o legado é só o do pacote)', async () => {
  const plantado = {kind: 'portal', galeria: true, galeriaLegado: LEGADO};
  const {janela, pedidos, restaurar} = await carregarPonte({financeHost: plantado, galeriaLegado: LEGADO});
  try {
    const host = janela.financeHost;
    assert.notEqual(host, plantado, 'no portal o host é o da ponte estática, não o plantado');
    assert.ok(!('galeriaLegado' in host));
    assert.equal(host.galeriaTitle('apps/folheto.html'), null, 'nada do plantado vira título');
    await assert.rejects(() => host.galeriaUrl('apps/folheto.html'), erro => erro.code === 'unauthenticated', 'nem página: sem a senha, nada');
    assert.equal(pedidos.length, 0);
  } finally { restaurar(); }
  // e a função que lê o host do app não lê nada sem a ponte nativa
  const {legadoDoAnfitriao} = await import('../anfitriao.js');
  assert.equal(typeof legadoDoAnfitriao, 'function');
  assert.equal(legadoDoAnfitriao({financeHost: hostDoApp(LEGADO)}), null);
  assert.deepEqual(legadoDoAnfitriao(comPonte({financeHost: hostDoApp(LEGADO)})), LEGADO);
});

test('a4 · forma estranha no galeriaLegado é ignorada, sem exceção; o resto do Laboratório segue', async () => {
  const {legadoDoAnfitriao} = await import('../anfitriao.js');
  assert.equal(typeof legadoDoAnfitriao, 'function');
  const explode = {}; Object.defineProperty(explode, 'files', {get() { throw new Error('getter que explode'); }});
  const inteiros = [undefined, null, 'texto', 42, true, [], [['apps/folheto.html', FOLHETO]], {}, {files: null}, {files: 'apps/folheto.html'},
    {files: []}, {files: {}}, {titles: LEGADO.titles}, explode];
  for (const valor of inteiros) {
    assert.equal(legadoDoAnfitriao(comPonte({financeHost: hostDoApp(valor)})), null, 'inteiro inválido: ' + String(valor && JSON.stringify(valor)));
  }
  assert.equal(legadoDoAnfitriao(comPonte({financeHost: null})), null);
  assert.equal(legadoDoAnfitriao(comPonte({financeHost: 'aicask'})), null);
  assert.equal(legadoDoAnfitriao(comPonte()), null);
  // só passam páginas apps/<id>.html com conteúdo de texto, e só títulos de texto delas
  const misturado = {files: {'apps/folheto.html': FOLHETO, 'index.html': '<p>índice do app</p>', 'apps/../segredo.html': '<p>x</p>', 'apps/Maiuscula.html': '<p>x</p>',
    'apps/sub/pasta.html': '<p>x</p>', 'leia.txt': 'x', 'apps/numero.html': 42, 'apps/objeto.html': {html: '<p>x</p>'}, 'apps/nulo.html': null},
    titles: {'apps/folheto.html': 7, 'index.html': 'Índice do app', 'apps/numero.html': 'Número'}};
  assert.deepEqual(legadoDoAnfitriao(comPonte({financeHost: hostDoApp(misturado)})), {files: {'apps/folheto.html': FOLHETO}, titles: {}});
  // pela ponte de verdade: com qualquer dessas formas, o índice abre só com o catálogo do repositório
  for (const valor of [...inteiros, misturado]) {
    const {janela, restaurar} = await carregarPonte(comPonte({financeHost: hostDoApp(valor)}));
    try {
      const itens = catalogoDe(await ler(await janela.financeHost.galeriaUrl('index.html')));
      const extras = itens.slice(2).map(item => item.arquivo);
      assert.deepEqual(extras, valor === misturado ? ['apps/folheto.html'] : [], 'legado de ' + String(valor && JSON.stringify(valor)));
      assert.equal(itens.find(item => item.arquivo === 'apps/folheto.html')?.nome ?? 'folheto', 'folheto', 'título que não é texto: o nome é o id');
    } finally { restaurar(); }
  }
});
