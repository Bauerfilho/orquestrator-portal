// A tela cheia do Laboratório: cada maquete do catálogo (galeria/index.html) tem a maquete com stand
// (galeria/apps/<id>.html) e a página para o iPhone em apps/<id>/ (index.html, manifesto e três ícones), escritas pelo
// publicador do ia-chat. A página é pública: confere as metas de app da Tela de Início, a CSP, o noindex e que nada
// aponta para fora do site. PORTAL_RAIZ=<pasta> confere outra raiz (por exemplo, uma publicação de teste).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const RAIZ = resolve(process.env.PORTAL_RAIZ || join(dirname(fileURLToPath(import.meta.url)), '..'));
const PUBLICAR = 'rode o publicador no ia-chat: python3 laboratorio/publicar.py <pasta do portal>';
const RE_CATALOGO = /<script type="application\/json" id="catalogo">([\s\S]*?)<\/script>/;
const ARQUIVOS = ['index.html', 'manifest.webmanifest', 'icone-180.png', 'icone-192.png', 'icone-512.png'];
// os espaços de nome do SVG/XML são identificadores, nunca baixados; qualquer outro http(s):// é URL externa
const ESPACO_DE_NOME = /^http:\/\/www\.w3\.org\/(2000\/svg|1999\/xlink|1999\/xhtml|XML\/1998\/namespace)$/;

const indice = join(RAIZ, 'galeria', 'index.html');
const ler = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');
// as tags <meta>/<link> com os atributos num objeto (a ordem dos atributos não importa)
function tags(html, nome) {
  return [...html.matchAll(new RegExp('<' + nome + '\\b([^>]*)>', 'gi'))].map(m => Object.fromEntries(
    [...m[1].matchAll(/([a-z-:]+)\s*=\s*("([^"]*)"|'([^']*)')/gi)].map(a => [a[1].toLowerCase(), a[3] ?? a[4]])));
}
// largura e altura do cabeçalho IHDR de um PNG
function dimensoesPng(caminho) {
  const b = readFileSync(caminho);
  assert.ok(b.length > 24 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && b.toString('latin1', 12, 16) === 'IHDR', caminho + ' não é PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

if (!existsSync(indice)) {
  test('galeria/index.html existe', () => assert.fail(`Falta ${indice}: o Laboratório não foi publicado neste portal; ${PUBLICAR}`));
} else {
  const html = readFileSync(indice, 'utf8');
  const m = RE_CATALOGO.exec(html);
  let catalogo = null;
  try { catalogo = m ? JSON.parse(m[1]) : null; } catch { catalogo = null; }
  const maquetes = Array.isArray(catalogo) ? catalogo.filter(item => item && !item.legado) : [];

  test('o catálogo de galeria/index.html é legível e tem maquetes com stand', () => {
    assert.ok(m, 'galeria/index.html sem o bloco <script type="application/json" id="catalogo">; ' + PUBLICAR);
    assert.ok(Array.isArray(catalogo), 'o bloco catalogo não é uma lista JSON; ' + PUBLICAR);
    assert.ok(maquetes.length > 0, 'nenhuma maquete com stand no catálogo');
    assert.equal(new Set(maquetes.map(i => i.id)).size, maquetes.length, 'id repetido no catálogo');
  });

  for (const item of maquetes) {
    test(`${item.id}: maquete com stand e tela cheia para iPhone`, () => {
      assert.match(String(item.id), /^[a-z0-9-]+$/, 'id fora da regra do portal');
      assert.equal(item.arquivo, `apps/${item.id}.html`);
      assert.ok(existsSync(join(RAIZ, 'galeria', 'apps', item.id + '.html')), `falta galeria/apps/${item.id}.html; ${PUBLICAR}`);
      const pasta = join(RAIZ, 'apps', item.id);
      const faltam = ARQUIVOS.filter(a => !existsSync(join(pasta, a)));
      assert.deepEqual(faltam, [], `falta em apps/${item.id}/: ${faltam.join(', ')}; ${PUBLICAR}`);

      const pagina = ler('apps', item.id, 'index.html');
      const metas = tags(pagina, 'meta'), links = tags(pagina, 'link');
      const meta = nome => metas.find(t => (t.name || '').toLowerCase() === nome);
      assert.equal((meta('apple-mobile-web-app-capable') || {}).content, 'yes', 'falta <meta name="apple-mobile-web-app-capable" content="yes">');
      assert.match((meta('viewport') || {}).content || '', /width=device-width/, 'falta o viewport de celular');
      assert.match((meta('robots') || {}).content || '', /noindex/, 'a página é pública: precisa do robots noindex');
      const csp = metas.find(t => (t['http-equiv'] || '').toLowerCase() === 'content-security-policy');
      assert.ok(csp && /default-src 'none'/.test(csp.content || ''), 'falta a CSP (default-src \'none\')');
      const icone = links.find(t => (t.rel || '').toLowerCase() === 'apple-touch-icon');
      assert.ok(icone && icone.href && existsSync(join(pasta, icone.href)), 'falta o apple-touch-icon (ou o arquivo dele)');
      const manifesto = links.find(t => (t.rel || '').toLowerCase() === 'manifest');
      assert.ok(manifesto && manifesto.href === 'manifest.webmanifest', 'falta <link rel="manifest" href="manifest.webmanifest">');
      const externas = [...pagina.matchAll(/https?:\/\/[^\s"'`<>()\\]+/gi)].map(u => u[0]).filter(u => !ESPACO_DE_NOME.test(u));
      assert.deepEqual(externas, [], 'URL externa na página de tela cheia');

      let dados;
      assert.doesNotThrow(() => { dados = JSON.parse(ler('apps', item.id, 'manifest.webmanifest')); }, 'manifest.webmanifest não é JSON');
      assert.equal(dados.display, 'standalone');
      assert.ok(typeof dados.name === 'string' && dados.name.trim(), 'manifesto sem name');
      assert.ok(typeof dados.start_url === 'string' && dados.start_url.trim(), 'manifesto sem start_url');
      assert.ok(Array.isArray(dados.icons) && dados.icons.length, 'manifesto sem ícones');
      for (const i of dados.icons) {
        assert.ok(typeof i.src === 'string' && !/^[a-z]+:|^\/|\.\./i.test(i.src), 'ícone fora da pasta: ' + i.src);
        assert.ok(existsSync(join(pasta, i.src)), `o manifesto aponta ${i.src}, que não existe`);
        const [l, a] = dimensoesPng(join(pasta, i.src));
        assert.equal(i.sizes, `${l}x${a}`, `${i.src}: o manifesto diz ${i.sizes}, o PNG tem ${l}x${a}`);
      }
      for (const t of [180, 192, 512]) assert.deepEqual(dimensoesPng(join(pasta, `icone-${t}.png`)), [t, t], `icone-${t}.png com tamanho errado`);
    });
  }
}
