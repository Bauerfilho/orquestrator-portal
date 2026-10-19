// A galeria do Laboratório (galeria.js): o repositório vence o pacote antigo, o legado entra no índice como "Sem stand",
// nomes fora do padrão são recusados sem ir à rede, a tela cheia só existe para maquetes do repositório e sair revoga os blob:.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveObjectURL} from 'node:buffer';
import {criarGaleria, nomeDaPagina} from '../galeria.js';

const BASE = 'https://exemplo.test/portal/';
const RE_CATALOGO = /<script type="application\/json" id="catalogo">([\s\S]*?)<\/script>/;
const json = dados => JSON.stringify(dados, null, 1).replace(/</g, '\\u003c');
const indice = itens => `<!doctype html><html><head><meta charset="utf-8"><title>Galeria de maquetes</title></head><body>
<!-- catalogo:inicio -->
<script type="application/json" id="catalogo">
${json(itens)}
</script>
<!-- catalogo:fim -->
<script>var c = JSON.parse(document.getElementById("catalogo").textContent);</script></body></html>`;
const CATALOGO = [
  {id: 'sinal', arquivo: 'apps/sinal.html', nome: 'Sinal', colecao: 'casa', miniatura: '<svg viewBox="0 0 320 180"></svg>'},
  {id: 'quadro', arquivo: 'apps/quadro.html', nome: 'Quadro', colecao: 'referencia'},
  {id: 'velho', arquivo: 'apps/velho.html', nome: 'Velho', legado: true},
];
const REPO = {
  'galeria/index.html': indice(CATALOGO),
  'galeria/apps/sinal.html': '<!doctype html><title>Sinal · Maquete</title><main id="app">sinal novo</main>',
  'galeria/apps/quadro.html': '<!doctype html><title>Quadro · Maquete</title><main id="app">quadro</main>',
  'galeria/apps/velho.html': '<!doctype html><title>Velho</title><p>sem stand, mas no repositório</p>',
  'apps/sinal/': '<!doctype html><title>Sinal</title>',
  'apps/velho/': '<!doctype html><title>pasta que sobrou: um legado nunca ganha tela cheia</title>',
};
const LEGADO = {
  files: {
    'index.html': '<!doctype html><title>Galeria antiga</title><p>índice antigo</p>',
    'apps/sinal.html': '<p>sinal ANTIGO</p>',
    'apps/antigo.html': '<p>documento antigo</p>',
    'apps/preco.html': '<p>outro antigo</p>',
    'apps/zeta.html': '<p>e mais um</p>',
    'apps/../segredo.html': '<p>nome fora do padrão: não entra</p>',
    'leia.txt': 'não é página',
  },
  titles: {'index.html': 'Galeria antiga', 'apps/sinal.html': 'Sinal (antigo)', 'apps/antigo.html': 'Antigo <b>x</b> </script><!--', 'apps/preco.html': 'Preço $& $1 $<n> total'},
};

// fetch falso: responde o que está em `arquivos` (caminho relativo à BASE), 404 no resto; guarda cada pedido
function falso(arquivos, {quebrado = false} = {}) {
  const pedidos = [];
  const fetch = async (url, opcoes = {}) => {
    pedidos.push({url: String(url), metodo: opcoes.method || 'GET'});
    if (quebrado) throw new TypeError('Failed to fetch');
    const rel = String(url).startsWith(BASE) ? String(url).slice(BASE.length) : null;
    const corpo = rel === null ? undefined : arquivos[rel];
    if (corpo === undefined) return {status: 404, ok: false, text: async () => '404'};
    return {status: 200, ok: true, text: async () => corpo};
  };
  return {fetch, pedidos};
}
const ler = async url => { const blob = resolveObjectURL(url); assert.ok(blob, 'o blob: ' + url + ' não existe'); return blob.text(); };
const catalogoDe = html => { const m = RE_CATALOGO.exec(html); assert.ok(m, 'sem bloco catalogo'); return {bloco: m[1], itens: JSON.parse(m[1])}; };
const nova = (arquivos = REPO, legado = LEGADO, opcoes) => { const f = falso(arquivos, opcoes); return {g: criarGaleria({base: BASE, legado: () => legado, fetch: f.fetch}), pedidos: f.pedidos}; };

test('o índice do repositório ganha uma entrada "Sem stand" para cada documento antigo que o catálogo não lista', async () => {
  const {g} = nova();
  const url = await g.url('index.html');
  assert.match(url, /^blob:/);
  const html = await ler(url);
  const {itens} = catalogoDe(html);
  assert.deepEqual(itens.slice(0, 3), CATALOGO, 'o catálogo do repositório fica na frente, intacto');
  assert.deepEqual(itens.slice(3), [
    {id: 'antigo', arquivo: 'apps/antigo.html', nome: 'Antigo <b>x</b> </script><!--', legado: true},
    {id: 'preco', arquivo: 'apps/preco.html', nome: 'Preço $& $1 $<n> total', legado: true},
    {id: 'zeta', arquivo: 'apps/zeta.html', nome: 'zeta', legado: true},
  ], 'sem título no pacote, o nome é o id; sinal (já no catálogo), nomes fora do padrão e não-páginas ficam de fora');
  assert.ok(html.includes('<!-- catalogo:inicio -->') && html.includes('<!-- catalogo:fim -->') && html.includes('JSON.parse(document.getElementById("catalogo")'), 'o resto do índice continua igual');
  assert.equal(html.match(/id="catalogo"/g).length, 1);
});

test('"<" escapado no JSON do catálogo, e a troca não interpreta $& nem $1', async () => {
  const {g} = nova();
  const {bloco} = catalogoDe(await ler(await g.url('index.html')));
  assert.ok(!bloco.includes('<'), 'nenhum "<" cru dentro do bloco: nem </script> nem comentário HTML escapam');
  assert.ok(bloco.includes('\\u003c/script>\\u003c!--'));
  assert.ok(bloco.includes('Preço $& $1 $\\u003cn> total'), 'o título entra à letra');
});

test('sem documento antigo a mesclar, o índice do repositório vai como veio', async () => {
  const {g} = nova(REPO, {files: {'apps/sinal.html': '<p>antigo</p>'}, titles: {}});
  assert.equal(await ler(await g.url('index.html')), REPO['galeria/index.html']);
  const {g: semLegado} = nova(REPO, null);
  assert.equal(await ler(await semLegado.url('index.html')), REPO['galeria/index.html']);
});

test('a maquete do repositório vence a do pacote antigo; o que só existe no pacote vem dele', async () => {
  const {g, pedidos} = nova();
  assert.equal(await ler(await g.url('apps/sinal.html')), REPO['galeria/apps/sinal.html']);
  assert.equal(await ler(await g.url('apps/antigo.html')), LEGADO.files['apps/antigo.html']);
  assert.ok(!pedidos.some(p => p.url.endsWith('/galeria/apps/antigo.html')), 'fora do catálogo do repositório: nem pergunta (seria um 404)');
  const {g: semCatalogo, pedidos: perguntas} = nova({'galeria/apps/sinal.html': REPO['galeria/apps/sinal.html']});
  assert.equal(await ler(await semCatalogo.url('apps/sinal.html')), REPO['galeria/apps/sinal.html'], 'sem índice no repositório, ainda pergunta a ele primeiro');
  assert.equal(await ler(await semCatalogo.url('apps/antigo.html')), LEGADO.files['apps/antigo.html']);
  assert.ok(perguntas.some(p => p.url.endsWith('/galeria/apps/antigo.html')));
  assert.equal(await ler(await g.url('apps/sinal.html#tema=escuro')), REPO['galeria/apps/sinal.html'], 'o fragmento sai antes de buscar');
  assert.equal(await g.url('../apps/sinal.html'), await g.url('apps/sinal.html'), 'o ../ da frente sai; mesmo arquivo, mesmo blob');
});

test('nomes fora do padrão são recusados sem ir à rede; página ausente nos dois lados = not_found', async () => {
  const {g, pedidos} = nova();
  for (const ruim of ['../../etc/passwd', 'apps/../segredo.html', 'apps/Sinal.html', 'outra.html', 'apps/a/b.html', 'apps/a.htm', 'apps/.html', 'https://fora.test/x.html', 'apps/a.html?x=1', ' index.html']) {
    await assert.rejects(g.url(ruim), e => e.code === 'not_found', ruim);
    assert.throws(() => nomeDaPagina(ruim), e => e.code === 'not_found', ruim);
  }
  assert.equal(pedidos.length, 0, 'nenhum pedido para nome recusado');
  await assert.rejects(g.url('apps/nao-existe.html'), e => e.code === 'not_found' && /apps\/nao-existe\.html/.test(e.message));
  assert.equal(nomeDaPagina(), 'index.html');
  assert.equal(nomeDaPagina('apps/sinal.html#tema=claro'), 'apps/sinal.html');
});

test('titulo: o nome da ficha pelo catálogo, senão o título do pacote antigo; null se não souber', async () => {
  const {g} = nova();
  await g.url('index.html');
  assert.equal(g.titulo('index.html'), 'Galeria de maquetes', 'o <title> do índice do repositório');
  assert.equal(g.titulo('apps/sinal.html'), 'Sinal', 'o do repositório vence o "Sinal (antigo)"');
  assert.equal(g.titulo('apps/quadro.html#tema=escuro'), 'Quadro');
  assert.equal(g.titulo('apps/antigo.html'), 'Antigo <b>x</b> </script><!--');
  assert.equal(g.titulo('apps/zeta.html'), null);
  assert.equal(g.titulo('apps/nada.html'), null);
  assert.equal(g.titulo('../../x'), null);
  const {g: fria} = nova();
  await fria.url('apps/quadro.html');
  assert.equal(fria.titulo('apps/quadro.html'), 'Quadro', 'abrir uma maquete direto já deixa o catálogo lido');
});

test('telaCheia: só para maquetes do catálogo do repositório, e só se a pasta apps/<id>/ responde', async () => {
  const {g, pedidos} = nova();
  assert.equal(await g.telaCheia('apps/sinal.html'), BASE + 'apps/sinal/');
  assert.equal(await g.telaCheia('apps/sinal.html#tema=escuro'), BASE + 'apps/sinal/');
  assert.equal(pedidos.filter(p => p.metodo === 'HEAD').length, 1, 'a conferência da pasta é feita uma vez');
  assert.equal(await g.telaCheia('apps/quadro.html'), null, 'no catálogo, mas a pasta apps/quadro/ não existe (404)');
  assert.equal(await g.telaCheia('apps/velho.html'), null, 'legado no catálogo do repositório');
  assert.equal(await g.telaCheia('apps/antigo.html'), null, 'só no pacote antigo');
  assert.equal(await g.telaCheia('index.html'), null);
  assert.equal(await g.telaCheia('apps/../x.html'), null);
  // a rede caiu só na conferência da pasta: o catálogo diz que ela existe, então o link fica
  const {fetch} = falso(REPO);
  const semRede = criarGaleria({base: BASE, legado: () => null, fetch: async (url, opcoes = {}) => { if (opcoes.method === 'HEAD') throw new TypeError('Failed to fetch'); return fetch(url, opcoes); }});
  assert.equal(await semRede.telaCheia('apps/sinal.html'), BASE + 'apps/sinal/');
});

test('sem índice no repositório, tudo cai no pacote antigo (e não há tela cheia)', async () => {
  const {g} = nova({});
  assert.equal(await ler(await g.url('index.html')), LEGADO.files['index.html']);
  assert.equal(await ler(await g.url('apps/sinal.html')), LEGADO.files['apps/sinal.html']);
  assert.equal(g.titulo('index.html'), 'Galeria antiga');
  assert.equal(g.titulo('apps/sinal.html'), 'Sinal (antigo)');
  assert.equal(await g.telaCheia('apps/sinal.html'), null);
  const {g: nada} = nova({}, null);
  await assert.rejects(nada.url('index.html'), e => e.code === 'not_found');
});

test('esquecer revoga todos os blob: e a próxima abertura busca de novo', async () => {
  const {g, pedidos} = nova();
  const urls = [await g.url('index.html'), await g.url('apps/sinal.html'), await g.url('apps/antigo.html')];
  for (const u of urls) assert.ok(resolveObjectURL(u), 'vivo antes de esquecer');
  const antes = pedidos.length;
  assert.equal(await g.url('apps/sinal.html'), urls[1], 'em memória: mesmo blob, sem pedido novo');
  assert.equal(pedidos.length, antes);
  g.esquecer();
  for (const u of urls) assert.equal(resolveObjectURL(u), undefined, 'revogado: ' + u);
  assert.equal(g.titulo('apps/sinal.html'), 'Sinal (antigo)', 'o catálogo lido também foi esquecido');
  const outra = await g.url('apps/sinal.html');
  assert.notEqual(outra, urls[1]);
  assert.ok(pedidos.length > antes, 'buscou de novo');
});

test('a mesma página pedida duas vezes ao mesmo tempo vira um blob só; a rede fora não fica guardada', async () => {
  const {g} = nova();
  const [a, b] = await Promise.all([g.url('apps/quadro.html'), g.url('apps/quadro.html')]);
  assert.equal(a, b);
  let fora = true;
  const pedidos = [];
  const instavel = criarGaleria({base: BASE, legado: () => null, fetch: async url => {
    pedidos.push(url);
    if (fora) throw new TypeError('Failed to fetch');
    return {status: 200, ok: true, text: async () => REPO[String(url).slice(BASE.length)] ?? ''};
  }});
  await assert.rejects(instavel.url('index.html'), e => e.code === 'unavailable');
  fora = false;
  assert.match(await instavel.url('index.html'), /^blob:/, 'tentou de novo e abriu');
  const quebrada = criarGaleria({base: BASE, legado: () => null, fetch: async () => ({status: 500, ok: false, text: async () => ''})});
  await assert.rejects(quebrada.url('apps/sinal.html'), e => e.code === 'unavailable' && /500/.test(e.message));
});

test('uma abertura que termina depois de esquecer não deixa blob vivo', async () => {
  let soltar;
  const segura = new Promise(ok => { soltar = ok; });
  const g = criarGaleria({base: BASE, legado: () => null, fetch: async url => { await segura; const corpo = REPO[String(url).slice(BASE.length)]; return corpo === undefined ? {status: 404, ok: false, text: async () => ''} : {status: 200, ok: true, text: async () => corpo}; }});
  const pendente = g.url('apps/sinal.html');
  g.esquecer();
  soltar();
  await assert.rejects(pendente, e => e.code === 'cancelled');
});
