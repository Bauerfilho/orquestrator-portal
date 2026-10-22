// O painel "Produtos" (produtos.js, 22/10/2026): as páginas de produto nascem em tempo de execução pelo
// window.financeRegistrarPagina, as maquetes moram em produtos/ como arquivos únicos (sem rede, sem srcdoc, já que a
// CSP só deixa molduras blob:) e o script entra no index.html entre o paginas.js e o app.js. Uso: node --test testes/*.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = arquivo => readFileSync(join(raiz, arquivo), 'utf8');
const GRUPOS = ['Dinheiro', 'Planejar', 'Empresa', 'Ajuda'];

// o produtos.js roda numa janela de mentira: só o que ele pendura na fila de registro interessa aqui
function registrar() {
  const fila = [];
  const window = {financeRegistrarPagina: (d) => fila.push(d)};
  const nada = () => {};
  const document = {readyState: 'loading', addEventListener: nada, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: {getAttribute: () => null}, baseURI: 'https://exemplo.test/'};
  vm.runInNewContext(ler('produtos.js'), {window, document, console, Map, Object, Array, MutationObserver: class { observe() {} }, URL, Blob: class {}, fetch: nada, matchMedia: () => ({matches: false})});
  return fila;
}

test('produtos.js registra os produtos em grupos conhecidos, com rota, título e ajuda inteira', () => {
  const fila = registrar();
  assert.deepEqual(fila.map(p => p.chave), ['aiswarm', 'aichat', 'obstetrica', 'rcog', 'orquestrator']);
  for (const p of fila) {
    assert.ok(GRUPOS.includes(p.grupo), p.chave + ': grupo ' + p.grupo);
    assert.match(p.rota, /^[a-z][a-z0-9-]{1,39}$/);
    assert.ok(p.titulo && p.titulo.length <= 60, p.chave + ': título');
    for (const campo of ['oque', 'deonde', 'naoe']) assert.ok(p.ajuda[campo], p.chave + ': ajuda.' + campo);
  }
});

test('as maquetes existem em produtos/, como arquivo único, sem rede nem srcdoc', () => {
  const js = ler('produtos.js');
  const arquivos = [...js.matchAll(/maquete: "([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(arquivos, ['produto-ai-swarm.html', 'produto-ai-chat.html', 'produto-calc-obstetrica.html', 'produto-rcog-tev.html']);
  for (const arquivo of arquivos) {
    const caminho = join(raiz, 'produtos', arquivo);
    assert.ok(existsSync(caminho), arquivo + ' não está em produtos/');
    const html = readFileSync(caminho, 'utf8');
    assert.doesNotMatch(html, /\s(src|href)=["']https?:\/\//, arquivo + ': carrega algo da rede');
    assert.doesNotMatch(html, /srcdoc=/, arquivo + ': srcdoc não abre sob a CSP (frame-src blob:)');
  }
});

test('o index.html carrega o produtos.js depois do paginas.js e antes do app.js', () => {
  const html = ler('index.html');
  const pos = s => html.indexOf(s);
  assert.ok(pos('<script src="produtos.js" defer></script>') > 0, 'falta o produtos.js');
  assert.ok(pos('<script src="paginas.js" defer></script>') < pos('<script src="produtos.js" defer></script>'));
  assert.ok(pos('<script src="produtos.js" defer></script>') < pos('<script src="app.js" defer></script>'));
  assert.doesNotMatch(html, /products-drawer|products-button/, 'o painel Produtos nasce em tempo de execução, não no index.html');
});
