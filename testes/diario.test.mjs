// O cliente do diário contra o servidor de verdade (servidor/nucleo.mjs com armazenamento em memória): duas sócias,
// chave criada no navegador, primeiro acesso pela chave da publicação, cadeia íntegra, conflito resolvido e adulteração
// detectada. PBKDF2 de 600 mil iterações deixa cada abertura em ~0,5 s: são poucas, de propósito.
import test from 'node:test';
import assert from 'node:assert/strict';
import {abrirDiario, portaMemoria, portaHttp} from '../diario.js';
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

// ── F2-12: o diário inteiro em qualquer tamanho, e a mesma coisa por qualquer porta (docs/PORTAS.md) ────────────────────
const gasto = i => ({acao: 'add_expense', alvo: 'g' + i, dados: {descricao: 'Gasto ' + i}});

test('diário com 1.200 eventos no servidor abre inteiro numa sincronização e diz "íntegro até o registro 1.200"', async () => {
  const {fetch} = servidor();
  const URL_ = 'https://diario.test';
  const bauer = await abrirDiario({url: URL_, membroId: 'bauer', senha: 'senha do bauer', masterRaw: master1, fetch});
  for (let i = 1; i <= 1200; i++) assert.ok((await bauer.acrescentar(gasto(i))).ok);
  // a Ana chega depois: o servidor devolve 500 por pedido, e a abertura só termina com o diário inteiro
  const leituras = [];
  const contando = (url, init) => { if (url.includes('/api/eventos?')) leituras.push(new URL(url).searchParams.get('depois')); return fetch(url, init); };
  const ana = await abrirDiario({url: URL_, membroId: 'ana', senha: 'senha da ana', masterRaw: master1, fetch: contando});
  assert.equal(ana.modo, 'gravacao', ana.motivo);
  assert.equal(ana.eventos.length, 1200);
  assert.deepEqual(ana.eventos.map(e => e.seq), Array.from({length: 1200}, (_, i) => i + 1));
  assert.equal(ana.eventos[1199].conteudo.dados.descricao, 'Gasto 1200');
  assert.equal(ana.cabeca, 1200);
  assert.deepEqual(ana.verificacao, {integro: true, ate: 1200, problemas: []});
  assert.equal(`Íntegro até o registro ${ana.verificacao.ate.toLocaleString('pt-BR')}`, 'Íntegro até o registro 1.200');
  assert.deepEqual(leituras, ['0', '500', '1000'], 'três páginas na mesma sincronização, e nenhuma a mais');
  // e a gravação seguinte entra no 1.201, sem conflito
  const r = await ana.acrescentar(gasto(1201));
  assert.equal(r.evento.seq, 1201);
});

// o roteiro de duas sócias do teste acima, por uma porta qualquer; devolve o que se vê de fora para comparar portas
async function roteiroDuasSocias(abrir, mapa) {
  const visto = {};
  const bauer = await abrir({membroId: 'bauer', senha: 'senha do bauer', masterRaw: master1});
  visto.bauer = bauer.modo;
  visto.primeira = (await bauer.acrescentar({acao: 'add_expense', alvo: 'g1', dados: {descricao: 'Contador'}})).ok;
  const ana = await abrir({membroId: 'ana', senha: 'senha da ana', masterRaw: master1});
  visto.ana = [ana.modo, ana.eventos[0] && ana.eventos[0].conteudo.dados.descricao];
  await ana.acrescentar({acao: 'add_expense', alvo: 'g2', dados: {descricao: 'Domínio'}});
  const r = await bauer.acrescentar({acao: 'add_expense', alvo: 'g3', dados: {descricao: 'Figma'}});
  visto.conflito = [r.ok, r.evento && r.evento.seq, bauer.eventos.map(e => e.conteudo.alvo), bauer.verificacao.integro];
  const ana2 = await abrir({membroId: 'ana', senha: 'senha da ana', masterRaw: master2});
  visto.republicado = [ana2.modo, ana2.eventos.length];
  visto.senhaErrada = (await abrir({membroId: 'ana', senha: 'outra', masterRaw: new Uint8Array(32).fill(1)})).modo;
  const bruto = JSON.stringify([...mapa.values()]);
  visto.emClaro = bruto.includes('Contador') || bruto.includes('Domínio') || bruto.includes('Figma');
  const ev = mapa.get('ev/000000002');
  mapa.set('ev/000000002', {...ev, ct: ev.ct.slice(0, -4) + 'AAAA'});
  const bia = await abrir({membroId: 'bia', senha: 'senha da bia', masterRaw: master2});
  visto.adulterado = [bia.verificacao.integro, bia.verificacao.problemas.map(p => p.seq), bia.eventos.map(e => e.conteudo.alvo)];
  return visto;
}
const ESPERADO = {bauer: 'gravacao', primeira: true, ana: ['gravacao', 'Contador'], conflito: [true, 3, ['g1', 'g2', 'g3'], true],
  republicado: ['gravacao', 3], senhaErrada: 'aguardando', emClaro: false, adulterado: [false, [2], ['g1', 'g3']]};

test('abrirDiario funciona igual com {url} e com {porta: portaMemoria()} (e com portaHttp explícita)', async () => {
  const s1 = servidor();
  const porUrl = await roteiroDuasSocias(o => abrirDiario({...o, url: 'https://diario.test', fetch: s1.fetch}), s1.store._mapa);
  const porta = portaMemoria();
  const porMemoria = await roteiroDuasSocias(o => abrirDiario({...o, porta}), porta._mapa);
  const s2 = servidor();
  const http = portaHttp('https://diario.test', s2.fetch);
  const porHttp = await roteiroDuasSocias(o => abrirDiario({...o, porta: http}), s2.store._mapa);
  assert.deepEqual(porUrl, ESPERADO);
  assert.deepEqual(porMemoria, ESPERADO);
  assert.deepEqual(porHttp, ESPERADO);
  const d = await abrirDiario({porta: portaMemoria(), membroId: 'bauer', senha: 'x', masterRaw: master1});
  assert.equal(d.porta, 'memoria');
  assert.equal(d.url, null);
});

test('página pequena: a porta devolve 7 por vez e o diário busca até a cabeça antes de devolver', async () => {
  const porta = portaMemoria({limitePagina: 7});
  const bauer = await abrirDiario({porta, membroId: 'bauer', senha: 'senha do bauer', masterRaw: master1});
  for (let i = 1; i <= 50; i++) await bauer.acrescentar(gasto(i));
  const paginas = [];
  const espiada = {...porta, async lerEventos(p) { const r = await porta.lerEventos(p); paginas.push(r.eventos.length); return r; }};
  const ana = await abrirDiario({porta: espiada, membroId: 'ana', senha: 'senha da ana', masterRaw: master1});
  assert.equal(ana.eventos.length, 50);
  assert.equal(ana.verificacao.ate, 50);
  assert.deepEqual(paginas, [7, 7, 7, 7, 7, 7, 7, 1]);
});

test('ler e gravar ao mesmo tempo: nada duplica e a cadeia continua fechando', async () => {
  const porta = portaMemoria({limitePagina: 5});
  const bauer = await abrirDiario({porta, membroId: 'bauer', senha: 'senha do bauer', masterRaw: master1});
  const ana = await abrirDiario({porta, membroId: 'ana', senha: 'senha da ana', masterRaw: master1});
  for (let i = 1; i <= 30; i++) await ana.acrescentar(gasto(i));
  // o relógio de 60 s, a volta do foco e duas gravações caem juntos, com o Bauer 30 registros atrás
  const rs = await Promise.all([bauer.sincronizar(), bauer.acrescentar(gasto(31)), bauer.sincronizar(), bauer.acrescentar(gasto(32)), bauer.sincronizar()]);
  assert.ok(rs[1].ok && rs[3].ok);
  await bauer.sincronizar();
  assert.deepEqual(bauer.eventos.map(e => e.seq), Array.from({length: 32}, (_, i) => i + 1));
  assert.deepEqual(bauer.verificacao, {integro: true, ate: 32, problemas: []});
  assert.equal(bauer.fila, 0);
  await ana.sincronizar();
  assert.deepEqual(ana.eventos.map(e => e.conteudo.alvo).slice(-2).sort(), ['g31', 'g32']);
  assert.ok(ana.verificacao.integro);
});

test('registro malformado no armazenamento vira problema e não derruba a leitura do resto', async () => {
  const porta = portaMemoria();
  const bauer = await abrirDiario({porta, membroId: 'bauer', senha: 'senha do bauer', masterRaw: master1});
  for (let i = 1; i <= 3; i++) await bauer.acrescentar(gasto(i));
  const ev = porta._mapa.get('ev/000000002');
  porta._mapa.set('ev/000000002', {...ev, sig: '-_-_'}); // base64url: o atob do navegador recusa
  const ana = await abrirDiario({porta, membroId: 'ana', senha: 'senha da ana', masterRaw: master1});
  assert.equal(ana.modo, 'gravacao', ana.motivo);
  assert.deepEqual(ana.verificacao.problemas.map(p => p.seq), [2]);
  assert.match(ana.verificacao.problemas[0].problema, /malformado/);
  assert.deepEqual(ana.eventos.map(e => e.conteudo.alvo), ['g1', 'g3'], 'o 3 aponta o hash registrado do 2: a cadeia segue');
});

test('porta incompleta: indisponível, dizendo o que falta, e cai no treino', async () => {
  const d = await abrirDiario({porta: {nome: 'pela-metade', async estado() { return {ok: true, iniciado: false, cabeca: 0}; }}, membroId: 'bauer', senha: 'x', masterRaw: master1});
  assert.equal(d.modo, 'indisponivel');
  assert.match(d.motivo, /iniciar, chaves, registrarChaves, lerEventos, acrescentar/);
  assert.ok((await d.acrescentar({acao: 'x'})).treino);
});

test('pedido pendurado na rede tem prazo: a trava solta e a gravação seguinte responde', async () => {
  const {fetch: fetchBom} = (() => { const store = armazemEmMemoria(); const tratar = criarDiario(store, {origens: ['*']}); return {fetch: async (u, o = {}) => tratar(new Request(u, o))}; })();
  let pendurar = false;
  const fetch = async (u, o = {}) => pendurar && String(u).includes('/api/eventos') && (o.method || 'GET') === 'GET' ? new Promise(() => {}) : fetchBom(u, o);
  const d = await abrirDiario({porta: portaHttp('https://diario.test', fetch, 150), membroId: 'bauer', senha: 'senha do bauer', masterRaw: new Uint8Array(32).fill(9)});
  assert.equal(d.modo, 'gravacao');
  pendurar = true;
  const t0 = Date.now();
  await assert.rejects(d.sincronizar(), /não respondeu/);
  pendurar = false;
  const r = await d.acrescentar({acao: 'add_expense', alvo: 'g-prazo', dados: {}});
  assert.ok(Date.now() - t0 < 3000, 'a gravação não ficou presa atrás da leitura pendurada');
  assert.equal(r.ok, true, r.erro);
  assert.equal(r.evento.seq, 1);
});

test('servidor que reenvia uma página: nada duplica e o reenvio vira problema', async () => {
  const porta = portaMemoria();
  const bauer = await abrirDiario({porta, membroId: 'bauer', senha: 'senha do bauer', masterRaw: new Uint8Array(32).fill(4)});
  for (let i = 0; i < 3; i++) await bauer.acrescentar({acao: 'add_expense', alvo: 'g' + i, dados: {}});
  const ler = porta.lerEventos.bind(porta);
  const reenvia = {...porta, lerEventos: async q => ler({...q, depois: Math.max(0, q.depois - 2)})};
  const ana = await abrirDiario({porta: reenvia, membroId: 'ana', senha: 'senha da ana', masterRaw: new Uint8Array(32).fill(4)});
  await ana.sincronizar();
  assert.equal(ana.eventos.length, 3, 'cada registro uma vez só');
  assert.equal(new Set(ana.eventos.map(e => e.seq)).size, 3);
  assert.equal(ana.cabeca, 3);
});
