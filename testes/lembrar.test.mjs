// node --test testes/ — "Lembrar deste aparelho" (lembrar.js), a parte pura: a chave mestra cifrada com a chave do aparelho
// (não extraível) e aberta de novo, a AAD presa ao membro (trocar o membro no registro não abre), registro de outra versão,
// outra chave do aparelho ou estragado recusados, nenhuma senha nem mestra em claro no registro, e o diário abrindo pela
// chave da senha guardada ({kek}) igual abre pela senha. O IndexedDB fica no fluxo do navegador (ferramentas/arnes/
// fluxos/lembrar.mjs); aqui o structuredClone faz o papel dele (é assim que ele guarda um CryptoKey). Dados fictícios.
import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSAO, AAD, novaChaveDoAparelho, montarRegistro, abrirRegistro} from '../lembrar.js';
import {abrirDiario, chaveDaSenhaDoDiario} from '../diario.js';
import {b64} from '../portal-crypto.js';
import {criarDiario, armazemEmMemoria} from '../servidor/nucleo.mjs';

const SENHA = 'senha de teste da ana';
const mestra = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 255);
const kekDaAna = chaveDaSenhaDoDiario(SENHA, 'm-ana');   // PBKDF2 de 600 mil: uma vez para o arquivo inteiro
const extraivel = () => globalThis.crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt']);
async function registroDaAna(chave) {
  return montarRegistro(chave, {memberId: 'p-ana', membroDiario: 'm-ana', masterRaw: mestra, diarioKek: await kekDaAna});
}

test('a mestra vai e volta pela chave do aparelho, também depois do structuredClone do IndexedDB', async () => {
  const chave = await novaChaveDoAparelho();
  assert.equal(chave.extractable, false, 'a chave do aparelho não pode ser extraível');
  assert.deepEqual(chave.usages.sort(), ['decrypt', 'encrypt']);
  const kek = await kekDaAna;
  assert.equal(kek.extractable, false, 'a chave do diário não pode ser extraível');
  const registro = await registroDaAna(chave);
  assert.deepEqual(Object.keys(registro).sort(), ['diarioKek', 'masterCifrada', 'memberId', 'membroDiario', 'versao']);
  assert.equal(registro.versao, VERSAO);
  assert.equal(registro.diarioKek, kek);
  // o IndexedDB guarda por structured clone: a chave e o registro voltam como cópias, e abrem
  const aberto = await abrirRegistro(structuredClone(chave), structuredClone(registro));
  assert.ok(aberto, 'o registro não abriu com a mesma chave do aparelho');
  assert.deepEqual([...aberto.masterRaw], [...mestra]);
  assert.equal(aberto.memberId, 'p-ana');
  assert.equal(aberto.membroDiario, 'm-ana');
  assert.equal(aberto.diarioKek.extractable, false);
  // a chave do diário guardada é a mesma: cifra com uma, decifra com a outra
  const iv = new Uint8Array(12);
  const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, kek, new TextEncoder().encode('ok'));
  assert.equal(new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv}, aberto.diarioKek, ct)), 'ok');
});

test('o registro não carrega a senha nem a mestra em claro, e cada gravação sai com outro IV', async () => {
  const chave = await novaChaveDoAparelho();
  const a = await registroDaAna(chave), b = await registroDaAna(chave);
  const texto = JSON.stringify({...a, diarioKek: undefined});
  assert.ok(!texto.includes(SENHA), 'a senha apareceu no registro');
  assert.ok(!texto.includes(b64.enc(mestra)), 'a mestra apareceu em claro no registro');
  assert.ok(!Object.values(a).some(v => typeof v === 'string' && v.includes('senha')), 'um campo de texto parece senha');
  assert.notEqual(a.masterCifrada.iv, b.masterCifrada.iv);
  assert.notEqual(a.masterCifrada.ct, b.masterCifrada.ct);
  assert.equal(b64.dec(a.masterCifrada.ct).length, mestra.length + 16, 'AES-GCM: a mestra mais a etiqueta de 16 bytes');
});

test('AAD com o membro: trocar o membro no registro não abre', async () => {
  const chave = await novaChaveDoAparelho();
  const registro = await registroDaAna(chave);
  assert.equal(await abrirRegistro(chave, {...registro, memberId: 'p-bia'}), null, 'abriu com o membro trocado');
  // a AAD é exatamente 'orquestrator-lembrar/v1|' + memberId
  assert.equal(AAD, 'orquestrator-lembrar/v1|');
  const {iv, ct} = registro.masterCifrada;
  const abre = aad => crypto.subtle.decrypt({name: 'AES-GCM', iv: b64.dec(iv), additionalData: new TextEncoder().encode(aad)}, chave, b64.dec(ct)).then(() => true, () => false);
  assert.equal(await abre('orquestrator-lembrar/v1|p-ana'), true);
  assert.equal(await abre('orquestrator-lembrar/v1|p-bia'), false);
  assert.equal(await abre('orquestrator-lembrar/v2|p-ana'), false);
});

test('registro de outra versão, outra chave do aparelho, cifra adulterada ou malformado: recusado', async () => {
  const chave = await novaChaveDoAparelho();
  const registro = await registroDaAna(chave);
  for (const versao of [0, 2, '1', null, undefined]) assert.equal(await abrirRegistro(chave, {...registro, versao}), null, `versão ${versao} abriu`);
  assert.equal(await abrirRegistro(await novaChaveDoAparelho(), registro), null, 'outra chave do aparelho abriu');
  const ct = b64.dec(registro.masterCifrada.ct); ct[3] ^= 1;
  assert.equal(await abrirRegistro(chave, {...registro, masterCifrada: {...registro.masterCifrada, ct: b64.enc(ct)}}), null, 'cifra adulterada abriu');
  assert.equal(await abrirRegistro(chave, {...registro, masterCifrada: {...registro.masterCifrada, iv: '***'}}), null, 'IV ilegível abriu');
  for (const ruim of [null, undefined, 'registro', 42, {}, {...registro, masterCifrada: null}, {...registro, memberId: '../x'}, {...registro, membroDiario: ''},
    {...registro, diarioKek: undefined}, {...registro, diarioKek: 'chave'}, {...registro, diarioKek: await extraivel()}]) {
    assert.equal(await abrirRegistro(chave, ruim), null, `abriu: ${JSON.stringify(ruim && {...ruim, diarioKek: typeof (ruim && ruim.diarioKek)})}`);
  }
  assert.equal(await abrirRegistro(null, registro), null, 'sem chave do aparelho abriu');
  assert.ok(await abrirRegistro(chave, registro), 'o registro bom deixou de abrir');
});

test('só chave não extraível: montarRegistro recusa chave do aparelho ou do diário extraível, membro ou mestra ruins', async () => {
  const chave = await novaChaveDoAparelho();
  const kek = await kekDaAna;
  const dados = {memberId: 'p-ana', membroDiario: 'm-ana', masterRaw: mestra, diarioKek: kek};
  await assert.rejects(montarRegistro(await extraivel(), dados), /não extraível/);
  await assert.rejects(montarRegistro(chave, {...dados, diarioKek: await extraivel()}), /não extraível/);
  await assert.rejects(montarRegistro(chave, {...dados, diarioKek: undefined}), /não extraível/);
  await assert.rejects(montarRegistro(chave, {...dados, memberId: 'p ana'}), /Membro inválido/);
  await assert.rejects(montarRegistro(chave, {...dados, masterRaw: b64.enc(mestra)}), /mestra inválida/);
  await assert.rejects(montarRegistro(chave, {...dados, masterRaw: new Uint8Array(0)}), /mestra inválida/);
  // sem membroDiario, vale o próprio memberId
  assert.equal((await montarRegistro(chave, {memberId: 'm-ana', masterRaw: mestra, diarioKek: kek})).membroDiario, 'm-ana');
  // id com ponto: a mesma regra do diário, que aceita 'ana.ribeiro'
  const comPonto = await montarRegistro(chave, {...dados, memberId: 'p.ana', membroDiario: 'ana.ribeiro'});
  assert.equal((await abrirRegistro(chave, structuredClone(comPonto))).membroDiario, 'ana.ribeiro');
});

test('abrirDiario com {kek} abre o mesmo diário que com {senha}, sem a senha (e depois do structuredClone)', async () => {
  const app = criarDiario(armazemEmMemoria(), {origens: []});
  const fetch = (url, init) => app(new Request(url, init));
  const URL_ = 'https://diario.test';
  const pelaSenha = await abrirDiario({url: URL_, membroId: 'm-ana', senha: SENHA, masterRaw: mestra, fetch});
  assert.equal(pelaSenha.modo, 'gravacao', pelaSenha.motivo);
  assert.ok((await pelaSenha.acrescentar({acao: 'add_expense', alvo: 'g1', dados: {descricao: 'Conta fictícia'}})).ok);
  const kek = structuredClone(await kekDaAna);
  const pelaChave = await abrirDiario({url: URL_, membroId: 'm-ana', kek, masterRaw: mestra, fetch});
  assert.equal(pelaChave.modo, 'gravacao', pelaChave.motivo);
  assert.deepEqual(pelaChave.eventos.map(e => e.conteudo.dados.descricao), ['Conta fictícia']);
  // grava com a assinatura aberta pela chave guardada, e quem entra pela senha confere a cadeia e a autoria
  assert.ok((await pelaChave.acrescentar({acao: 'add_expense', alvo: 'g2', dados: {descricao: 'Outra conta fictícia'}})).ok);
  const conferencia = await abrirDiario({url: URL_, membroId: 'm-ana', senha: SENHA, masterRaw: mestra, fetch});
  assert.ok(conferencia.verificacao.integro, JSON.stringify(conferencia.verificacao.problemas));
  assert.deepEqual(conferencia.eventos.map(e => [e.membro, e.conteudo.alvo]), [['m-ana', 'g1'], ['m-ana', 'g2']]);
});
