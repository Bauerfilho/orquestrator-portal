// O cliente do diário contra o servidor de verdade (servidor/nucleo.mjs com armazenamento em memória): duas sócias,
// chave criada no navegador, primeiro acesso pela chave da publicação, cadeia íntegra, conflito resolvido e adulteração
// detectada. PBKDF2 de 600 mil iterações deixa cada abertura em ~0,5 s: são poucas, de propósito.
import test from 'node:test';
import assert from 'node:assert/strict';
import {abrirDiario} from '../diario.js';
import {criarDiario, armazemEmMemoria} from '../servidor/nucleo.mjs';

function servidor() {
  const store = armazemEmMemoria();
  const app = criarDiario(store, {origens: []});
  const fetch = (url, init) => app(new Request(url, init));
  return {store, fetch};
}
const master1 = new Uint8Array(32).fill(7), master2 = new Uint8Array(32).fill(9);

test('sem servidor: modo treino, nada sai do navegador', async () => {
  const d = await abrirDiario({url: null, membroId: 'bauer', senha: 'x', masterRaw: master1});
  assert.equal(d.modo, 'treino');
  const r = await d.acrescentar({acao: 'add_expense', alvo: 'g1', dados: {}});
  assert.equal(r.treino, true);
  assert.equal(d.eventos.length, 1);
});

test('duas sócias, a chave nasce no navegador e a cadeia confere', async () => {
  const {store, fetch} = servidor();
  const URL_ = 'https://diario.test';
  const bauer = await abrirDiario({url: URL_, membroId: 'bauer', senha: 'senha do bauer', masterRaw: master1, fetch});
  assert.equal(bauer.modo, 'gravacao', bauer.motivo);
  assert.ok((await bauer.acrescentar({acao: 'add_expense', alvo: 'g1', dados: {descricao: 'Contador'}})).ok);
  // Ana entra pela primeira vez: abre a chave pela publicação e registra a dela
  const ana = await abrirDiario({url: URL_, membroId: 'ana', senha: 'senha da ana', masterRaw: master1, fetch});
  assert.equal(ana.modo, 'gravacao', ana.motivo);
  assert.equal(ana.eventos[0].conteudo.dados.descricao, 'Contador');
  assert.ok((await ana.acrescentar({acao: 'add_expense', alvo: 'g2', dados: {descricao: 'Domínio'}})).ok);
  // Bauer ainda está na posição 1: a gravação dele encontra 409, busca o evento da Ana e entra na posição 3
  const r = await bauer.acrescentar({acao: 'add_expense', alvo: 'g3', dados: {descricao: 'Figma'}});
  assert.ok(r.ok);
  assert.equal(r.evento.seq, 3);
  assert.deepEqual(bauer.eventos.map(e => e.conteudo.alvo), ['g1', 'g2', 'g3']);
  assert.ok(bauer.verificacao.integro);
  // republicação do pacote (master nova): Ana abre pela chave da senha dela, sem depender de ninguém
  const ana2 = await abrirDiario({url: URL_, membroId: 'ana', senha: 'senha da ana', masterRaw: master2, fetch});
  assert.equal(ana2.modo, 'gravacao', ana2.motivo);
  assert.equal(ana2.eventos.length, 3);
  // senha errada: não abre e diz por quê
  const errada = await abrirDiario({url: URL_, membroId: 'ana', senha: 'outra', masterRaw: new Uint8Array(32).fill(1), fetch});
  assert.equal(errada.modo, 'aguardando');
  // o servidor não vê nada em claro
  const bruto = JSON.stringify([...store._mapa.values()]);
  assert.ok(!bruto.includes('Contador') && !bruto.includes('Domínio'));
  // adulterar um evento no servidor é detectado por quem lê do zero
  const ev = store._mapa.get('ev/000000002');
  store._mapa.set('ev/000000002', {...ev, ct: ev.ct.slice(0, -4) + 'AAAA'});
  const bia = await abrirDiario({url: URL_, membroId: 'bia', senha: 'senha da bia', masterRaw: master2, fetch});
  assert.equal(bia.verificacao.integro, false);
  assert.equal(bia.verificacao.problemas[0].seq, 2);
  assert.deepEqual(bia.eventos.map(e => e.conteudo.alvo), ['g1', 'g3']);
});

test('servidor fora do ar: indisponível, com motivo, e cai no treino', async () => {
  const d = await abrirDiario({url: 'https://nao-existe.test', membroId: 'bauer', senha: 'x', masterRaw: master1, fetch: async () => { throw new Error('rede'); }});
  assert.equal(d.modo, 'indisponivel');
  assert.match(d.motivo, /fora do ar/);
  assert.ok((await d.acrescentar({acao: 'x'})).treino);
});
