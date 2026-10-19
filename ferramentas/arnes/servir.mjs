// Servidor do arnês: serve a raiz do repositório como o GitHub Pages serviria, com trocas para dispensar senha e
// pacote cifrado: /static-bridge.js vira a ponte simulada (ponte-simulada.js), /estado-ficticio.js é o estado de
// mentira e /demonstracao.js são os eventos de exemplo do ?demo=1. Em /api/* roda o servidor do diário de verdade
// (servidor/nucleo.mjs) com armazenamento em memória, para testar a gravação cifrada ponta a ponta (?diario=local).
// Uso: node servir.mjs [porta=8765] [raiz=../..] [--agora 2026-11-03T13:00:00Z]
//
// Relógio do servidor: o diário grava a hora de cada evento (ts), e o razão usa a MENOR entre ela e a do aparelho para
// saber se um mês já terminou. Para um teste fechar outubro "em 03/11" (com page.clock no navegador), o servidor
// precisa da mesma hora: servir(porta, {agora}) ou servir(porta, raiz, {agora}), ARNES_AGORA=... ou --agora. "agora" é
// um instante (texto ISO, número em ms ou Date: o relógio parte dele e anda junto com o real) ou uma função que devolve
// a hora. servidor.definirAgora(valor) troca o relógio com o servidor no ar (null volta à hora real).
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize, resolve, sep, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {criarDiario, armazemEmMemoria} from '../../servidor/nucleo.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const TIPOS = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.bin': 'application/octet-stream'};
const TROCAS = {'/static-bridge.js': join(aqui, 'ponte-simulada.js'), '/estado-ficticio.js': join(aqui, 'estado-ficticio.js'), '/demonstracao.js': join(aqui, 'demonstracao.js')};

// instante → função que devolve a hora em ISO (o relógio parte do instante e anda com o real); null = hora real
export function criarRelogio(agora) {
  if (agora === undefined || agora === null || agora === '') return null;
  if (typeof agora === 'function') return () => { const t = new Date(agora()); if (Number.isNaN(t.getTime())) throw new Error('o relógio do arnês devolveu uma hora inválida'); return t.toISOString(); };
  const inicio = agora instanceof Date ? agora.getTime() : typeof agora === 'number' ? agora : Date.parse(String(agora));
  if (!Number.isFinite(inicio)) throw new Error(`hora inválida para o relógio do arnês: ${agora}`);
  const partida = Date.now();
  return () => new Date(inicio + (Date.now() - partida)).toISOString();
}
// o armazenamento grava a hora do relógio do arnês no lugar da hora real (ts dos eventos, em das chaves)
function comRelogio(store, relogio) {
  return {...store, async setJSON(k, v, opcoes) {
    const r = relogio();
    if (r && v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof v.ts === 'string') v = {...v, ts: r};
      if (typeof v.em === 'string') v = {...v, em: r};
    }
    return store.setJSON(k, v, opcoes);
  }};
}

export function servir(porta = 8765, raiz = join(aqui, '..', '..'), opcoes = {}) {
  if (raiz && typeof raiz === 'object') { opcoes = raiz; raiz = opcoes.raiz; }
  const base = resolve(raiz || join(aqui, '..', '..'));
  let relogio = criarRelogio(opcoes.agora !== undefined ? opcoes.agora : process.env.ARNES_AGORA);
  const armazem = comRelogio(armazemEmMemoria(), () => (relogio ? relogio() : null));
  const diario = criarDiario(armazem, {origens: []});
  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        const corpo = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await new Promise(ok => { const p = []; req.on('data', c => p.push(c)); req.on('end', () => ok(Buffer.concat(p))); });
        const r = await diario(new Request('http://127.0.0.1' + req.url, {method: req.method, headers: req.headers, body: corpo}));
        let saida = Buffer.from(await r.arrayBuffer());
        if (relogio && req.method === 'POST' && url.pathname === '/api/eventos' && r.status === 201) {
          // a resposta leva a mesma hora que ficou gravada (o navegador guarda o ts da resposta no evento que acabou de gravar)
          const resposta = JSON.parse(saida.toString('utf8'));
          const gravado = await armazem.get('ev/' + String(resposta.seq).padStart(9, '0'));
          if (gravado && gravado.ts) saida = Buffer.from(JSON.stringify({...resposta, ts: gravado.ts}));
        }
        const cabecalhos = Object.fromEntries(r.headers); delete cabecalhos['content-length'];
        res.writeHead(r.status, cabecalhos); res.end(saida); return;
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
  servidor.agora = () => (relogio ? relogio() : new Date().toISOString());
  servidor.definirAgora = valor => { relogio = criarRelogio(valor); return servidor.agora(); };
  return new Promise(ok => servidor.listen(porta, '127.0.0.1', () => ok(servidor)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), soltos = [];
  let agora;
  for (let k = 0; k < args.length; k++) {
    if (args[k] === '--agora') agora = args[++k];
    else if (args[k].startsWith('--agora=')) agora = args[k].slice(8);
    else soltos.push(args[k]);
  }
  const porta = Number(soltos[0] || 8765);
  const servidor = await servir(porta, soltos[1] ? resolve(soltos[1]) : undefined, agora !== undefined ? {agora} : {});
  console.log(`Arnês em http://127.0.0.1:${porta}/  ·  ?demo=1 traz agosto a outubro de exemplo  ·  ?diario=local grava cifrado no servidor em memória  ·  relógio do servidor: ${servidor.agora()}`);
}
