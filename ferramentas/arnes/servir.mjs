// Servidor do arnês: serve a raiz do repositório como o GitHub Pages serviria, com duas trocas para dispensar senha e
// pacote cifrado: /static-bridge.js vira a ponte simulada (ponte-simulada.js) e /estado-ficticio.js é o estado de
// mentira. Em /api/* roda o servidor do diário de verdade (servidor/nucleo.mjs) com armazenamento em memória, para
// testar a gravação cifrada ponta a ponta (?diario=local). Uso: node servir.mjs [porta=8765] [raiz=../..]
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize, resolve, sep, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {criarDiario, armazemEmMemoria} from '../../servidor/nucleo.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const TIPOS = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.bin': 'application/octet-stream'};
const TROCAS = {'/static-bridge.js': join(aqui, 'ponte-simulada.js'), '/estado-ficticio.js': join(aqui, 'estado-ficticio.js')};

export function servir(porta = 8765, raiz = join(aqui, '..', '..')) {
  const base = resolve(raiz);
  const diario = criarDiario(armazemEmMemoria(), {origens: []});
  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        const corpo = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await new Promise(ok => { const p = []; req.on('data', c => p.push(c)); req.on('end', () => ok(Buffer.concat(p))); });
        const r = await diario(new Request('http://127.0.0.1' + req.url, {method: req.method, headers: req.headers, body: corpo}));
        res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
      }
      let caminho = decodeURIComponent(url.pathname);
      if (caminho.endsWith('/')) caminho += 'index.html';
      const arquivo = TROCAS[caminho] || resolve(base, '.' + normalize(caminho));
      if (!TROCAS[caminho] && arquivo !== base && !arquivo.startsWith(base + sep)) { res.writeHead(403).end(); return; }
      const info = await stat(arquivo).catch(() => null);
      if (!info || !info.isFile()) { res.writeHead(404, {'content-type': 'text/plain'}).end('404'); return; }
      res.writeHead(200, {'content-type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'cache-control': 'no-store'});
      res.end(await readFile(arquivo));
    } catch (erro) { res.writeHead(500).end(String(erro)); }
  });
  return new Promise(ok => servidor.listen(porta, '127.0.0.1', () => ok(servidor)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = Number(process.argv[2] || 8765);
  await servir(porta, process.argv[3] ? resolve(process.argv[3]) : undefined);
  console.log(`Arnês em http://127.0.0.1:${porta}/  ·  ?demo=1 traz lançamentos de exemplo  ·  ?diario=local grava cifrado no servidor em memória`);
}
