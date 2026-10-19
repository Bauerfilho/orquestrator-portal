// Perfis da sociedade (perfis.js): cifra só com a chave mestra, outra chave não abre, colagem casa com o roster.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cifrarPerfis, abrirPerfis, carregarPerfis, lerColado, normalizarPerfis, foneLegivel, foneDiscavel} from '../perfis.js';

const mestra = new Uint8Array(32).fill(7);
const outra = new Uint8Array(32).fill(8);
const roster = [{id: 'm1', rotulo: 'Sócio 1'}, {id: 'm2', rotulo: 'Sócia 2'}, {id: 'm3', rotulo: 'Sócio 3'}];
const dados = {membros: {m1: {nome: 'Ana Teste', funcao: 'Administradora', fone: '64999990000', email: 'ana@exemplo.com', estadoCivil: 'Solteira'}}};

test('cifra e abre com a mesma chave mestra; o envelope não carrega nada legível', async () => {
  const envelope = await cifrarPerfis(mestra, dados);
  const texto = JSON.stringify(envelope);
  for (const pedaco of ['Ana', 'Administradora', '64999990000', 'exemplo.com', 'Solteira']) assert.ok(!texto.includes(pedaco), pedaco + ' vazou');
  const aberto = await abrirPerfis(mestra, envelope);
  assert.equal(aberto.estado, 'ok');
  assert.deepEqual(aberto.membros, dados.membros);
});

test('outra chave mestra (pacote lacrado de novo) e envelope adulterado não abrem', async () => {
  const envelope = await cifrarPerfis(mestra, dados);
  assert.equal((await abrirPerfis(outra, envelope)).estado, 'outra-chave');
  const ct = Buffer.from(envelope.ct, 'base64'); ct[0] ^= 1;
  assert.equal((await abrirPerfis(mestra, {...envelope, ct: ct.toString('base64')})).estado, 'ilegivel');
  assert.equal((await abrirPerfis(mestra, null)).estado, 'ilegivel');
  await assert.rejects(cifrarPerfis(mestra, {membros: {m1: {funcao: 'sem nome'}}}), /Nenhum perfil/);
});

test('carregarPerfis: 404 = ausente, rede fora = indisponível, arquivo bom abre', async () => {
  const envelope = await cifrarPerfis(mestra, dados);
  const resposta = (status, corpo) => async () => ({status, ok: status >= 200 && status < 300, json: async () => corpo});
  assert.equal((await carregarPerfis('https://x.test/', mestra, resposta(404))).estado, 'ausente');
  assert.equal((await carregarPerfis('https://x.test/', mestra, async () => { throw new Error('fora'); })).estado, 'indisponivel');
  assert.equal((await carregarPerfis('https://x.test/', mestra, resposta(200, envelope))).estado, 'ok');
});

test('normalizar: só texto, aparado, com limite; id estranho e membro sem nome ficam de fora', () => {
  const r = normalizarPerfis({membros: {'m1': {nome: '  Ana   Teste ', fone: 64999, extra: 'x'}, '../x': {nome: 'Y'}, m2: {funcao: 'Só função'}}});
  assert.deepEqual(r, {membros: {m1: {nome: 'Ana Teste'}}});
});

test('colagem: pelo rótulo do pacote (com e sem acento), pelo número de "Sócio N", pelo id e pela ordem', () => {
  const porRotulo = lerColado(JSON.stringify({'Sócio 1': {nome: 'A'}, 'socia 2': {nome: 'B'}, 'Sócio 3': {nome: 'C'}}), roster);
  assert.deepEqual(Object.fromEntries(Object.entries(porRotulo.membros).map(([k, v]) => [k, v.nome])), {m1: 'A', m2: 'B', m3: 'C'});
  assert.deepEqual(porRotulo.avisos, []);
  const outrosRotulos = [{id: 'x', rotulo: 'Bauer'}, {id: 'y', rotulo: 'Bella'}];
  assert.deepEqual(Object.keys(lerColado(JSON.stringify({'Sócio 2': {nome: 'B'}}), outrosRotulos).membros), ['y']);
  assert.deepEqual(Object.keys(lerColado(JSON.stringify({m3: {nome: 'C'}}), roster).membros), ['m3']);
  assert.deepEqual(Object.keys(lerColado(JSON.stringify([{nome: 'A'}, {nome: 'B'}]), roster).membros), ['m1', 'm2']);
  const ruim = lerColado(JSON.stringify({'Sócio 9': {nome: 'Z'}, 'Sócio 1': {nome: 'A'}, 'socio 1': {nome: 'A2'}}), roster);
  assert.equal(ruim.avisos.length, 2);
  assert.equal(lerColado('não é json', roster).avisos[0], 'O texto colado não é um JSON válido.');
});

test('telefone: legível e discável', () => {
  assert.equal(foneLegivel('64900000001'), '(64) 90000-0001');
  assert.equal(foneLegivel('64 90000-0002'), '(64) 90000-0002');
  assert.equal(foneLegivel('6232221111'), '(62) 3222-1111');
  assert.equal(foneDiscavel('62 90000-0003'), '+5562900000003');
  assert.equal(foneDiscavel('+55 64 90000-0001'), '+5564900000001');
  assert.equal(foneDiscavel('123'), '');
});
