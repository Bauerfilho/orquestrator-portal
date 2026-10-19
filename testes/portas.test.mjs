// A bateria de contrato das portas do diário (docs/PORTAS.md): as mesmas perguntas, feitas a cada porta, têm de receber
// as mesmas respostas. Roda contra a portaMemoria (tudo na aba), a portaHttp (o servidor de servidor/nucleo.mjs, com
// armazenamento em memória) e o molde de porta sobre um armazém chave-valor qualquer.
//
// PARA TESTAR UMA PORTA NOVA: acrescente no fim deste arquivo
//     bateria('a minha', () => minhaPorta({...}))
// com uma porta VAZIA a cada chamada (cada teste começa do zero) e rode  node --test testes/portas.test.mjs
// Se ela passar aqui, o diário (cifra, assinatura, cadeia, conflito, paginação) funciona sobre ela.
import test from 'node:test';
import assert from 'node:assert/strict';
import {abrirDiario, portaHttp, portaMemoria, portaSobreChaveValor, faltasDaPorta, portaTemAnexos, OPERACOES_DA_PORTA, MOTIVOS_DA_PORTA} from '../diario.js';
import {criarDiario, armazemEmMemoria} from '../servidor/nucleo.mjs';

const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const TOKEN = 'token-de-teste-com-mais-de-vinte-caracteres';
const OUTRO = 'outro-token-que-ninguem-registrou-aqui';
const emb = {iv: 'aXY=', ct: 'Y3Q='};
const pub = {kty: 'EC', crv: 'P-256', x: 'x', y: 'y'};
const envelope = (id, anterior = '0') => ({id, membro: 'bauer', iv: 'aXY=', ct: 'Y3Q=', sig: 'c2ln', anterior, hash: 'h-' + id});
const CAMPOS_DO_REGISTRO = ['anterior', 'ct', 'hash', 'id', 'iv', 'membro', 'seq', 'sig', 'ts'];
const sequencia = (de, n) => Array.from({length: n}, (_, i) => de + i);

function recusou(r, motivo) {
  assert.equal(r.ok, false, 'devia recusar com ' + motivo);
  assert.equal(r.motivo, motivo);
  assert.ok(MOTIVOS_DA_PORTA.includes(r.motivo), 'motivo fora da lista: ' + r.motivo);
  assert.equal(typeof r.mensagem, 'string');
}
async function iniciada(fabricar) {
  const p = fabricar();
  assert.ok((await p.iniciar({tokenHash: await hex(TOKEN), por: 'bauer', membro: {id: 'bauer', embrulho: emb}, pub: {id: 'pub1', embrulho: emb}})).ok);
  return p;
}
// uma porta que só observa: guarda tudo o que entra e sai da porta de verdade, como texto
function espiar(porta, registro) {
  const espiada = {nome: porta.nome};
  for (const op of OPERACOES_DA_PORTA) espiada[op] = async (...args) => { registro.push(JSON.stringify(args)); const r = await porta[op](...args); registro.push(JSON.stringify(r)); return r; };
  return espiada;
}

function bateria(nome, fabricar) {
  test(`${nome}: tem as seis operações e nenhuma que altere ou apague`, () => {
    const p = fabricar();
    assert.deepEqual(faltasDaPorta(p), []);
    const funcoes = Object.keys(p).filter(k => typeof p[k] === 'function');
    assert.deepEqual(funcoes.filter(k => /apag|remov|alter|edit|troc|reescrev|delet|updat|limp/i.test(k)), []);
  });

  test(`${nome}: estado, e iniciar uma vez só`, async () => {
    const p = fabricar();
    assert.deepEqual(await p.estado(), {ok: true, iniciado: false, cabeca: 0, criadoEm: null});
    recusou(await p.iniciar({tokenHash: 'não é hex'}), 'invalido');
    const r = await p.iniciar({tokenHash: await hex(TOKEN), por: 'bauer', membro: {id: 'bauer', embrulho: emb}, pub: {id: 'pub1', embrulho: emb}});
    assert.deepEqual(r, {ok: true, criados: ['membro', 'pub']});
    const e = await p.estado();
    assert.equal(e.ok, true); assert.equal(e.iniciado, true); assert.equal(e.cabeca, 0); assert.equal(typeof e.criadoEm, 'string');
    recusou(await p.iniciar({tokenHash: await hex(OUTRO)}), 'conflito');
  });

  test(`${nome}: chaves — ler é livre, escrever exige o token, e o primeiro registro vale`, async () => {
    const p = await iniciada(fabricar);
    assert.deepEqual(await p.chaves({membro: 'bauer', pub: 'pub1'}), {ok: true, membro: emb, pub: emb, assinaturaPropria: null, assinaturas: {}});
    assert.deepEqual(await p.chaves({membro: 'ninguem'}), {ok: true, membro: null, pub: null, assinaturaPropria: null, assinaturas: {}});
    recusou(await p.chaves({membro: '../../etc'}), 'invalido');
    recusou(await p.registrarChaves({membro: {id: 'ana', embrulho: emb}}), 'nao_autorizado');
    recusou(await p.registrarChaves({token: OUTRO, membro: {id: 'ana', embrulho: emb}}), 'nao_autorizado');
    assert.deepEqual(await p.registrarChaves({token: TOKEN, assinatura: {membro: 'ana', pub, privada: emb}, membro: {id: 'ana', embrulho: emb}}), {ok: true, criados: ['membro', 'assinatura']});
    assert.deepEqual(await p.registrarChaves({token: TOKEN, assinatura: {membro: 'ana', pub: {...pub, x: 'outro'}, privada: emb}, membro: {id: 'ana', embrulho: {iv: 'b3V0cm8=', ct: 'b3V0cm8='}}}), {ok: true, criados: []});
    const c = await p.chaves({membro: 'ana'});
    assert.deepEqual(c.membro, emb);
    assert.deepEqual(c.assinaturaPropria, emb);
    assert.deepEqual(c.assinaturas, {ana: pub});
    recusou(await p.registrarChaves({token: TOKEN, assinatura: {membro: 'bia', pub: {...pub, kty: 'RSA'}, privada: emb}}), 'invalido');
    recusou(await p.registrarChaves({token: TOKEN, pub: {id: 'pub 2', embrulho: emb}}), 'invalido');
  });

  test(`${nome}: acrescentar só na posição seguinte (compare-and-swap) e só com o token`, async () => {
    const p = await iniciada(fabricar);
    recusou(await p.lerEventos({depois: 0}), 'nao_autorizado');
    recusou(await p.acrescentar({seq: 1, envelope: envelope('a')}), 'nao_autorizado');
    recusou(await p.acrescentar({token: OUTRO, seq: 1, envelope: envelope('a')}), 'nao_autorizado');
    const a = await p.acrescentar({token: TOKEN, seq: 1, envelope: envelope('a')});
    assert.equal(a.ok, true); assert.equal(a.seq, 1); assert.equal(typeof a.ts, 'string');
    const repetido = await p.acrescentar({token: TOKEN, seq: 1, envelope: envelope('b')});
    recusou(repetido, 'conflito');
    assert.equal(repetido.cabeca, 1);
    const pulando = await p.acrescentar({token: TOKEN, seq: 3, envelope: envelope('c')});
    recusou(pulando, 'conflito');
    assert.equal(pulando.cabeca, 1, 'pular posição também é recusado');
    assert.equal((await p.acrescentar({token: TOKEN, seq: 2, envelope: envelope('b', 'h-a')})).seq, 2);
    assert.equal((await p.estado()).cabeca, 2);
    const lidos = await p.lerEventos({token: TOKEN, depois: 0});
    assert.equal(lidos.ok, true); assert.equal(lidos.cabeca, 2);
    assert.deepEqual(lidos.eventos.map(e => e.id), ['a', 'b'], 'o primeiro continua intacto');
    assert.deepEqual(Object.keys(lidos.eventos[1]).sort(), CAMPOS_DO_REGISTRO);
    assert.deepEqual({...lidos.eventos[1], ts: 'x'}, {seq: 2, ...envelope('b', 'h-a'), ts: 'x'}, 'o envelope volta exatamente como foi');
    assert.deepEqual((await p.lerEventos({token: TOKEN, depois: 1})).eventos.map(e => e.id), ['b']);
  });

  test(`${nome}: lerEventos em ordem, a partir de depois, em páginas, até a cabeça (1.200 registros)`, async () => {
    const p = await iniciada(fabricar);
    for (let s = 1; s <= 1200; s++) assert.ok((await p.acrescentar({token: TOKEN, seq: s, envelope: envelope('e' + s)})).ok);
    const primeira = await p.lerEventos({token: TOKEN, depois: 0});
    assert.equal(primeira.cabeca, 1200);
    assert.ok(primeira.eventos.length >= 1 && primeira.eventos.length <= (p.limitePagina || Infinity), 'página entre 1 e o limite declarado');
    assert.deepEqual(primeira.eventos.map(e => e.seq), sequencia(1, primeira.eventos.length));
    const meio = await p.lerEventos({token: TOKEN, depois: 600});
    assert.deepEqual(meio.eventos.map(e => e.seq), sequencia(601, meio.eventos.length), 'depois= no meio: começa no seguinte, sem buraco');
    assert.deepEqual((await p.lerEventos({token: TOKEN, depois: 1200})).eventos, []);
    const todos = [];
    for (let depois = 0, paginas = 0; paginas < 1300; paginas++) {
      const r = await p.lerEventos({token: TOKEN, depois});
      if (!r.eventos.length) break;
      todos.push(...r.eventos.map(e => e.id));
      depois = r.eventos.at(-1).seq;
    }
    assert.deepEqual(todos, sequencia(1, 1200).map(s => 'e' + s));
  });

  test(`${nome}: recusa pedido malformado ou grande demais, sem gravar nada`, async () => {
    const p = await iniciada(fabricar);
    recusou(await p.acrescentar({token: TOKEN, seq: 0, envelope: envelope('a')}), 'invalido');
    recusou(await p.acrescentar({token: TOKEN, seq: 1.5, envelope: envelope('a')}), 'invalido');
    recusou(await p.acrescentar({token: TOKEN, seq: 1, envelope: {...envelope('a'), id: '../x'}}), 'invalido');
    recusou(await p.acrescentar({token: TOKEN, seq: 1, envelope: {...envelope('a'), iv: 'não é base64'}}), 'invalido');
    recusou(await p.acrescentar({token: TOKEN, seq: 1, envelope: {...envelope('a'), anterior: undefined}}), 'invalido');
    recusou(await p.acrescentar({token: TOKEN, seq: 1, envelope: {...envelope('a'), ct: 'x'.repeat(17000)}}), 'grande_demais');
    assert.equal((await p.estado()).cabeca, 0);
  });

  test(`${nome}: devolve cópias — mexer no que voltou não muda o que está guardado`, async () => {
    const p = await iniciada(fabricar);
    await p.acrescentar({token: TOKEN, seq: 1, envelope: envelope('a')});
    const r = await p.lerEventos({token: TOKEN, depois: 0});
    r.eventos[0].ct = 'mexido'; r.eventos[0].conteudo = {segredo: 'em claro'};
    const c = await p.chaves({membro: 'bauer'});
    c.membro.ct = 'mexido';
    assert.deepEqual((await p.lerEventos({token: TOKEN, depois: 0})).eventos[0].ct, envelope('a').ct);
    assert.equal((await p.lerEventos({token: TOKEN, depois: 0})).eventos[0].conteudo, undefined);
    assert.deepEqual((await p.chaves({membro: 'bauer'})).membro, emb);
  });

  test(`${nome}: o diário inteiro funciona sobre ela, e ela só vê dados cifrados`, async () => {
    const registro = [];
    const p = espiar(fabricar(), registro);
    const master = new Uint8Array(32).fill(5);
    const bauer = await abrirDiario({porta: p, membroId: 'bauer', senha: 'senha secreta do bauer', masterRaw: master});
    assert.equal(bauer.modo, 'gravacao', bauer.motivo);
    assert.ok((await bauer.acrescentar({acao: 'add_expense', alvo: 'g1', dados: {descricao: 'Contador de teste', valorMinor: 45000}})).ok);
    const ana = await abrirDiario({porta: p, membroId: 'ana', senha: 'senha secreta da ana', masterRaw: master});
    assert.equal(ana.modo, 'gravacao', ana.motivo);
    assert.equal(ana.eventos[0].conteudo.dados.descricao, 'Contador de teste');
    assert.ok((await ana.acrescentar({acao: 'add_expense', alvo: 'g2', dados: {descricao: 'Domínio de teste'}})).ok);
    await bauer.sincronizar();
    assert.deepEqual(bauer.eventos.map(e => e.conteudo.alvo), ['g1', 'g2']);
    assert.ok(bauer.verificacao.integro && ana.verificacao.integro);
    const tudo = registro.join('\n');
    for (const claro of ['Contador de teste', 'Domínio de teste', '45000', 'add_expense', 'senha secreta']) assert.ok(!tudo.includes(claro), 'a porta viu em claro: ' + claro);
    assert.ok(!tudo.includes('"conteudo"'));
  });
}

bateria('portaMemoria', () => portaMemoria());
bateria('portaHttp (servidor em memória)', () => {
  const app = criarDiario(armazemEmMemoria(), {origens: []});
  return portaHttp('https://diario.test', (url, init) => app(new Request(url, init)));
});

// O molde do docs/PORTAS.md: uma porta nova sobre um armazém chave-valor qualquer. Troque as três funções pelo seu
// armazenamento (a ida e volta pela "rede" aqui é um setImmediate e um JSON, como num armazenamento remoto).
function armazemDeExemplo() {
  const guardado = new Map();
  const rede = () => new Promise(ok => setImmediate(ok));
  return {
    async ler(chave) { await rede(); return guardado.has(chave) ? JSON.parse(guardado.get(chave)) : null; },
    async gravarSeNova(chave, valor) { await rede(); if (guardado.has(chave)) return false; guardado.set(chave, JSON.stringify(valor)); return true; },
    async listar(prefixo) { await rede(); return [...guardado.keys()].filter(k => k.startsWith(prefixo)); },
  };
}
bateria('molde: porta sobre um armazém chave-valor', () => portaSobreChaveValor(armazemDeExemplo(), {nome: 'exemplo'}));

test('portas: o que falta numa porta incompleta, e o lugar dos anexos (F3-5) ainda vazio', () => {
  assert.deepEqual(faltasDaPorta(null), [...OPERACOES_DA_PORTA]);
  assert.deepEqual(faltasDaPorta({estado() {}, chaves() {}}), ['iniciar', 'registrarChaves', 'lerEventos', 'acrescentar']);
  assert.equal(portaTemAnexos(portaMemoria()), false);
  assert.equal(portaTemAnexos(portaHttp('https://diario.test')), false);
  assert.equal(portaTemAnexos({...portaMemoria(), async guardarAnexo() {}, async lerAnexo() {}}), true);
  assert.equal(portaMemoria().duravel, false);
  assert.equal(portaHttp('https://diario.test/').url, 'https://diario.test');
});

test('portaHttp: rede fora ou servidor com erro 5xx lança (o diário fica indisponível); 4xx vira recusa com motivo', async () => {
  const fora = portaHttp('https://diario.test', async () => { throw new Error('rede'); });
  await assert.rejects(fora.estado(), /rede/);
  const quebrado = portaHttp('https://diario.test', async () => new Response('{"erro":"falhou"}', {status: 502}));
  await assert.rejects(quebrado.acrescentar({token: TOKEN, seq: 1, envelope: envelope('a')}), /502/);
  await assert.rejects(quebrado.estado(), /502/);
  const recusando = portaHttp('https://diario.test', async () => new Response('{"erro":"Muitos pedidos."}', {status: 429}));
  const r = await recusando.lerEventos({token: TOKEN, depois: 0});
  recusou(r, 'recusado');
  assert.equal(r.mensagem, 'Muitos pedidos.');
});
