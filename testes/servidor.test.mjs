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
