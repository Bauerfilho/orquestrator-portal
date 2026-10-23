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
  assert.deepEqual(fila.map(p => p.chave), ['aiswarm', 'aichat', 'obstetrica', 'rcog', 'specialist', 'orquestrator']);
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
  assert.deepEqual(arquivos, ['produto-ai-swarm.html', 'produto-ai-chat.html', 'produto-calc-obstetrica.html', 'produto-rcog-tev.html', 'produto-specialist-ai.html', 'produto-specialist-ai-celular.html', 'produto-orquestrator.html', 'produto-med-painel-celular.html']);
  for (const arquivo of arquivos) {
    const caminho = join(raiz, 'produtos', arquivo);
    assert.ok(existsSync(caminho), arquivo + ' não está em produtos/');
    const html = readFileSync(caminho, 'utf8');
    assert.doesNotMatch(html, /\s(src|href)=["']https?:\/\//, arquivo + ': carrega algo da rede');
    assert.doesNotMatch(html, /srcdoc=/, arquivo + ': srcdoc não abre sob a CSP (frame-src blob:)');
  }
});

test('as maquetes com tema trocam ao vivo: o portal só muda o #tema da moldura, e isso não recarrega a página', () => {
  // Defeito de 22/10: a moldura recebia #tema=escuro, mas a maquete só lia o tema ao carregar e ficava clara.
  for (const arquivo of ['produto-ai-chat.html', 'produto-orquestrator.html']) {
    const html = readFileSync(join(raiz, 'produtos', arquivo), 'utf8');
    assert.match(html, /addEventListener\('hashchange'/, arquivo + ': não escuta a troca de #tema');
  }
});

test('o Specialist AI: as fotos da página existem em produtos/ e a maquete é só escura', () => {
  const js = ler('produtos.js');
  const fotos = [...js.matchAll(/src: "(specialist-ai\/[^"]+\.jpg)"/g)].map(m => m[1]);
  assert.ok(fotos.length >= 5, 'faltam fotos: ' + fotos.length);
  for (const foto of fotos) assert.ok(existsSync(join(raiz, 'produtos', foto)), foto + ' não está em produtos/');
  const maquete = readFileSync(join(raiz, 'produtos', 'produto-specialist-ai.html'), 'utf8');
  assert.doesNotMatch(maquete, /tema=claro|prefers-color-scheme: light/, 'a maquete do Specialist AI é só escura (decisão dele)');
  assert.match(maquete, /respostas reais do app|resposta real/i, 'a maquete tem de dizer que as respostas são reais');
});

test('o Med Painel no celular: bloco no fim da página do Med Painel (não é página à parte), o núcleo real com a casca de iPhone simulada, as fotos do app e do teclado', () => {
  const js = ler('produtos.js');
  assert.doesNotMatch(js, /rota: "med-painel-celular"/, 'o celular não é mais página à parte: vive na página do Med Painel');
  assert.match(js, /window\.financeMedPainelCelular = function/, 'o bloco entra pelo gancho que o app.js chama no fim de renderMedPainel');
  assert.match(ler('app.js'), /window\.financeMedPainelCelular\(target\)/, 'o app.js tem de chamar o gancho');
  const bloco = js.slice(js.indexOf('const CELULAR = {'));
  const fotos = [...bloco.matchAll(/src: "(med-painel-celular\/[^"]+\.jpg)"/g)].map(m => m[1]);
  assert.ok(fotos.length >= 6, 'faltam fotos: ' + fotos.length);
  for (const foto of fotos) assert.ok(existsSync(join(raiz, 'produtos', foto)), foto + ' não está em produtos/');
  const maquete = readFileSync(join(raiz, 'produtos', 'produto-med-painel-celular.html'), 'utf8');
  assert.match(maquete, /plataforma: 'iphone'/, 'a casca simulada tem de se apresentar como iPhone (é o que liga as faces)');
  assert.match(maquete, /med-painel-arquivo-unico/, 'o núcleo tem de estar empacotado num arquivo único');
  assert.match(maquete, /registrarFace/, 'o núcleo empacotado tem de ter as faces (Note e Teclado)');
  assert.doesNotMatch(maquete, /nome-de-terceiro|nome-de-terceiro/, 'nada de terceiro no núcleo publicado');
  assert.match(js, /const CELULAR = \{[\s\S]*?maquete: "produto-med-painel-celular\.html", telefone: true/);
  assert.match(maquete, /background:transparent/, 'o telefone flutua sobre o fundo do portal: a página da maquete é transparente');
  assert.match(maquete, /addEventListener\(\x27hashchange\x27/, 'as legendas seguem o tema do portal (#tema=)');
});

test('o Orquestrator tem maquete e o link de tela cheia', () => {
  const js = ler('produtos.js');
  assert.match(js, /chave: "orquestrator"[\s\S]*?maquete: "produto-orquestrator\.html", telaCheia: true/);
  assert.match(js, /a\.dataset\.telaCheia = new URL\("produtos\/" \+ p\.maquete, document\.baseURI\)\.href/);
});

test('o index.html carrega o produtos.js depois do paginas.js e antes do app.js', () => {
  const html = ler('index.html');
  const pos = s => html.indexOf(s);
  assert.ok(pos('<script src="produtos.js" defer></script>') > 0, 'falta o produtos.js');
  assert.ok(pos('<script src="paginas.js" defer></script>') < pos('<script src="produtos.js" defer></script>'));
  assert.ok(pos('<script src="produtos.js" defer></script>') < pos('<script src="app.js" defer></script>'));
  assert.doesNotMatch(html, /products-drawer|products-button/, 'o painel Produtos nasce em tempo de execução, não no index.html');
});
