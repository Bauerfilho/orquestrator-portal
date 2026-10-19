// O servidor do diário: só acrescenta, recusa gravação concorrente (409), exige a chave e nunca deixa reescrever.
import test from 'node:test';
import assert from 'node:assert/strict';
import {criarDiario, armazemEmMemoria} from '../servidor/nucleo.mjs';

const ORIGEM = 'https://bauerfilho.github.io';
const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const TOKEN = 'token-de-teste-com-mais-de-vinte-caracteres';
const emb = {iv: 'aXY=', ct: 'Y3Q='};
function cliente() {
  const store = armazemEmMemoria();
  const app = criarDiario(store, {origens: [ORIGEM]});
  const chamar = async (metodo, rota, corpo, token) => {
    const r = await app(new Request('https://diario.test' + rota, {method: metodo, headers: {origin: ORIGEM, 'content-type': 'application/json', ...(token ? {authorization: 'Bearer ' + token} : {})}, body: corpo === undefined ? undefined : JSON.stringify(corpo)}));
    return {status: r.status, corpo: r.status === 204 ? null : await r.json(), cors: r.headers.get('access-control-allow-origin')};
  };
  return {store, chamar};
}
const envelope = (id, membro = 'bauer') => ({id, membro, iv: 'aXY=', ct: 'Y3Q=', sig: 'c2ln', anterior: '0', hash: 'h'});

test('iniciar uma vez só; a segunda tentativa é recusada', async () => {
  const {chamar} = cliente();
  assert.equal((await chamar('GET', '/api/estado')).corpo.iniciado, false);
  const r = await chamar('POST', '/api/iniciar', {tokenHash: await hex(TOKEN), por: 'bauer', membro: {id: 'bauer', embrulho: emb}, pub: {id: 'pub1', embrulho: emb}});
  assert.equal(r.status, 201);
  assert.deepEqual(r.corpo.criados, ['membro', 'pub']);
  assert.equal(r.cors, ORIGEM);
  assert.equal((await chamar('POST', '/api/iniciar', {tokenHash: await hex('outro')})).status, 409);
  const c = await chamar('GET', '/api/chaves?membro=bauer&pub=pub1');
  assert.deepEqual(c.corpo.membro, emb);
});

test('sem a chave do diário, nada se lê nem se escreve', async () => {
  const {chamar} = cliente();
  await chamar('POST', '/api/iniciar', {tokenHash: await hex(TOKEN)});
  assert.equal((await chamar('GET', '/api/eventos')).status, 401);
  assert.equal((await chamar('POST', '/api/eventos', {seq: 1, envelope: envelope('a')}, 'chave-errada-com-mais-de-vinte-letras')).status, 401);
});

test('log só-acréscimo com compare-and-swap', async () => {
  const {chamar, store} = cliente();
  await chamar('POST', '/api/iniciar', {tokenHash: await hex(TOKEN)});
  assert.equal((await chamar('POST', '/api/eventos', {seq: 1, envelope: envelope('a')}, TOKEN)).status, 201);
  const conflito = await chamar('POST', '/api/eventos', {seq: 1, envelope: envelope('b')}, TOKEN);
  assert.equal(conflito.status, 409);
  assert.equal(conflito.corpo.cabeca, 1);
  assert.equal((await chamar('POST', '/api/eventos', {seq: 3, envelope: envelope('c')}, TOKEN)).status, 409, 'pular posição também é recusado');
  assert.equal((await chamar('POST', '/api/eventos', {seq: 2, envelope: envelope('b')}, TOKEN)).status, 201);
  const lidos = await chamar('GET', '/api/eventos?depois=1', undefined, TOKEN);
  assert.deepEqual(lidos.corpo.eventos.map(e => e.id), ['b']);
  assert.equal(lidos.corpo.cabeca, 2);
  assert.equal((await store.get('ev/000000001')).id, 'a', 'o primeiro evento continua intacto');
});

test('chaves e assinaturas: o primeiro registro vale', async () => {
  const {chamar} = cliente();
  await chamar('POST', '/api/iniciar', {tokenHash: await hex(TOKEN)});
  const pub = {kty: 'EC', crv: 'P-256', x: 'x', y: 'y'};
  assert.deepEqual((await chamar('POST', '/api/chaves', {assinatura: {membro: 'ana', pub, privada: emb}, membro: {id: 'ana', embrulho: emb}}, TOKEN)).corpo.criados, ['membro', 'assinatura']);
  assert.deepEqual((await chamar('POST', '/api/chaves', {assinatura: {membro: 'ana', pub: {...pub, x: 'outro'}, privada: emb}}, TOKEN)).corpo.criados, []);
  const c = await chamar('GET', '/api/chaves?membro=ana');
  assert.equal(c.corpo.assinaturas.ana.x, 'x');
});

test('pedidos malformados, grandes ou de origem estranha', async () => {
  const {chamar} = cliente();
  await chamar('POST', '/api/iniciar', {tokenHash: await hex(TOKEN)});
  assert.equal((await chamar('POST', '/api/eventos', {seq: 1, envelope: {...envelope('a'), ct: 'x'.repeat(17000)}}, TOKEN)).status, 413);
  assert.equal((await chamar('POST', '/api/eventos', {seq: 1, envelope: {id: '../x'}}, TOKEN)).status, 400);
  assert.equal((await chamar('GET', '/api/chaves?membro=../../etc')).status, 400);
  assert.equal((await chamar('DELETE', '/api/eventos', undefined, TOKEN)).status, 404);
});

// ── F2-12: o diário paginado. GET /eventos devolve até 500 por pedido, na ordem, lendo os blobs em lotes paralelos ──────
async function comEventos(n, store, embaralhar = true) { // grava direto no armazém (o POST já tem os testes dele acima)
  const seqs = Array.from({length: n}, (_, i) => i + 1);
  if (embaralhar) for (let i = seqs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [seqs[i], seqs[j]] = [seqs[j], seqs[i]]; }
  for (const s of seqs) await store.setJSON('ev/' + String(s).padStart(9, '0'), {seq: s, ...envelope('e' + s), ts: '2026-10-19T12:00:00.000Z'});
}
function armazemComAtraso(atraso) { // cada get espera atraso() ms; desligado enquanto o teste prepara os dados
  const base = armazemEmMemoria();
  let ligado = false, listagens = 0;
  return {
    ...base,
    async get(k, o) { if (ligado) await new Promise(ok => setTimeout(ok, atraso())); return base.get(k, o); },
    async list(o) { listagens++; return base.list(o); },
    ligar() { ligado = true; listagens = 0; },
    get listagens() { return listagens; },
  };
}
function clienteSobre(store) {
  const app = criarDiario(store, {origens: [ORIGEM]});
  return async rota => { const r = await app(new Request('https://diario.test' + rota, {headers: {origin: ORIGEM, authorization: 'Bearer ' + TOKEN}})); return {status: r.status, corpo: await r.json()}; };
}

test('GET /eventos: em ordem, a partir de depois= no meio, em páginas de 500 (mesmo com leituras fora de ordem)', async () => {
  const store = armazemComAtraso(() => Math.floor(Math.random() * 4)); // as leituras terminam embaralhadas dentro de cada lote
  await store.setJSON('config/token', {tokenHash: await hex(TOKEN), em: '2026-10-19T00:00:00.000Z', por: 'bauer'});
  await comEventos(1200, store);
  store.ligar();
  const ler = clienteSobre(store);
  const meio = await ler('/api/eventos?depois=600');
  assert.equal(meio.status, 200);
  assert.deepEqual(meio.corpo.eventos.map(e => e.seq), Array.from({length: 500}, (_, i) => 601 + i));
  assert.deepEqual(meio.corpo.eventos.map(e => e.id).slice(0, 3), ['e601', 'e602', 'e603']);
  assert.equal(meio.corpo.cabeca, 1200);
  assert.equal(store.listagens, 1, 'a cabeça sai da mesma listagem: uma por pedido');
  const fim = await ler('/api/eventos?depois=1100');
  assert.deepEqual(fim.corpo.eventos.map(e => e.seq), Array.from({length: 100}, (_, i) => 1101 + i));
  assert.equal((await ler('/api/eventos?depois=1200')).corpo.eventos.length, 0);
  assert.deepEqual((await ler('/api/eventos?depois=0')).corpo.eventos.map(e => e.seq), Array.from({length: 500}, (_, i) => i + 1));
  // o cliente que pede página atrás de página recebe os 1.200, cada um uma vez, na ordem
  const todos = [];
  for (let depois = 0, r; (r = (await ler('/api/eventos?depois=' + depois)).corpo).eventos.length; depois = r.eventos.at(-1).seq) todos.push(...r.eventos.map(e => e.seq));
  assert.deepEqual(todos, Array.from({length: 1200}, (_, i) => i + 1));
});

test('GET /eventos com armazém lento (5 ms por leitura): 500 eventos em menos de 1 s', async () => {
  const store = armazemComAtraso(() => 5);
  await store.setJSON('config/token', {tokenHash: await hex(TOKEN), em: '2026-10-19T00:00:00.000Z', por: 'bauer'});
  await comEventos(500, store, false);
  store.ligar();
  const ler = clienteSobre(store);
  const t0 = performance.now();
  const r = await ler('/api/eventos?depois=0');
  const ms = performance.now() - t0;
  assert.equal(r.corpo.eventos.length, 500);
  assert.deepEqual(r.corpo.eventos.map(e => e.seq), Array.from({length: 500}, (_, i) => i + 1));
  assert.equal(r.corpo.cabeca, 500);
  assert.ok(ms < 1000, `levou ${Math.round(ms)} ms (um por um levaria mais de 2,5 s)`);
});
