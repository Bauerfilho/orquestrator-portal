// node --test testes/ — os perfis das sócias gravados direto pelo diário (19/10, noite): a ação set_profile do razão
// (permissão pelo estado, a limpeza do perfis.js, apagar, último vence, o Histórico sem telefone nem e-mail, fora do selo
// e da trava do mês), a mescla que as pontes mostram (diário > perfis.json > rótulo) e a ida e volta cifrada pelo diário.
// Dados fictícios óbvios (as três sócias do arnês, telefones 6490000000x).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../razao.js';
import {fotoDoMes, seloDoMes} from '../contas.js';
import {abrirDiario} from '../diario.js';
import {criarDiario, armazemEmMemoria} from '../servidor/nucleo.mjs';
import {normalizarPerfis, lerColado, mesclarPerfis, podeEditarPerfil, perfilParaTela, estadoDosPerfis, marcaDosPerfis, acompanharDiario} from '../perfis.js';

const {aplicar, ACOES, VERBOS, CAMPOS_PERFIL, limparPerfil} = R;
const base = {
  schemaVersion: 1, revision: 1, charges: null, benefits: [], staticBlocks: {}, plans: [], selling: {steps: []},
  members: [{id: 'bauer', displayName: 'Sócio 1', role: 'owner', participationPct: 40}, {id: 'ana', displayName: 'Sócio 2', role: 'member', participationPct: 30}, {id: 'bia', displayName: 'Sócio 3', role: 'member', participationPct: 30}],
};
const OUT = '2026-10-19T12:00:00Z', NOV = '2026-11-03T13:00:00Z';
let n = 0;
const ev = (membro, acao, alvo, dados, extra = {}) => ({seq: ++n, id: 'e' + n, membro, conteudo: {acao, alvo, dados, quando: OUT, ...extra}});
const perfil = (membro, alvo, dados, extra) => ev(membro, 'set_profile', alvo, dados, extra);
const ANA = {nome: 'Ana Ribeiro Exemplo', funcao: 'Administradora', fone: '64900000002', email: 'ana@exemplo.com', estadoCivil: 'Solteira'};
const BAU = {nome: 'Bauer Exemplo', funcao: 'Programador', fone: '64900000001', email: 'bauer@exemplo.com', estadoCivil: 'Solteiro'};

function ultimo(eventos, estado = base) { const a = aplicar(estado, eventos); return {a, r: a.recusados.find(r => r.id === eventos[eventos.length - 1].id) || null}; }
function aceito(eventos, estado) { const {a, r} = ultimo(eventos, estado); assert.equal(r, null, r ? `recusado: ${r.motivo}` : ''); return a; }
function recusado(eventos, codigo, re) {
  const {a, r} = ultimo(eventos);
  assert.ok(r, 'deveria ter sido recusado');
  assert.equal(r.codigo, codigo, `código ${r.codigo} (${r.motivo})`);
  if (re) assert.match(r.motivo, re);
  return a;
}

test('set_profile está em ACOES, com verbo em português', () => {
  assert.ok(ACOES.includes('set_profile'));
  assert.equal(VERBOS.set_profile, 'atualizou o perfil');
});

test('permissão pelo estado: a própria sócia sim, outra não, a responsável sim; o papel do evento não vale', () => {
  const a = aceito([perfil('ana', 'ana', ANA)]);
  assert.equal(a.perfis.ana.nome, 'Ana Ribeiro Exemplo');
  assert.equal(a.perfis.ana.alteradoPor, 'ana');
  recusado([perfil('ana', 'bia', {nome: 'Beatriz'})], 'permissao', /próprio perfil/);
  recusado([perfil('bia', 'bauer', {nome: 'Bauer'}, {papel: 'owner', role: 'owner'})], 'permissao');
  const b = aceito([perfil('bauer', 'bia', {nome: 'Beatriz Exemplo'})]);
  assert.equal(b.perfis.bia.nome, 'Beatriz Exemplo');
  assert.equal(b.perfis.bia.alteradoPor, 'bauer');
  // autora fora do estado e alvo fora do estado
  recusado([perfil('intrusa', 'intrusa', {nome: 'X'})], 'permissao', /Autora desconhecida/);
  recusado([perfil('bauer', 'fulana', {nome: 'X'})], 'invalido', /sócia deste painel/);
  recusado([perfil('bauer', null, {nome: 'X'})], 'invalido');
});

test('validação igual à do perfis.js: só texto, aparado, com limite; nome obrigatório; dados malformados recusados', () => {
  const a = aceito([perfil('ana', 'ana', {nome: '  Ana \n  Ribeiro  Exemplo ', funcao: 42, fone: ' 64 90000-0002 ', email: 'x'.repeat(300), extra: 'ignorado', estadoCivil: ['Solteira']})]);
  const {alteradoEm, ...resto} = a.perfis.ana;
  assert.equal(alteradoEm, OUT);
  assert.deepEqual(resto, {nome: 'Ana Ribeiro Exemplo', fone: '64 90000-0002', email: 'x'.repeat(160), alteradoPor: 'ana', versao: 1});
  // a mesma limpeza nos dois lugares
  const sujo = {nome: ' A\u0000na\tTeste ', funcao: 'Ad'.repeat(80), fone: 64900000002};
  assert.deepEqual(normalizarPerfis({membros: {ana: sujo}}).membros.ana, limparPerfil(sujo));
  assert.deepEqual(CAMPOS_PERFIL.map(c => c[0]), ['nome', 'funcao', 'fone', 'email', 'estadoCivil']);
  recusado([perfil('ana', 'ana', {funcao: 'Só função'})], 'invalido', /precisa de um nome/);
  recusado([perfil('ana', 'ana', {nome: '   '})], 'invalido', /precisa de um nome/);
  recusado([perfil('ana', 'ana', undefined)], 'invalido', /inválidos/);
  recusado([perfil('ana', 'ana', [ANA])], 'invalido', /inválidos/);
  recusado([perfil('ana', 'ana', 'Ana Ribeiro')], 'invalido', /inválidos/);
});

test('apagar (dados null), último vence na ordem do diário e versão que só cresce', () => {
  const eventos = [perfil('ana', 'ana', ANA), perfil('ana', 'ana', {...ANA, nome: 'Aninha Exemplo'}), perfil('bauer', 'ana', {...ANA, funcao: 'Diretora'})];
  let a = aceito(eventos);
  assert.equal(a.perfis.ana.nome, 'Ana Ribeiro Exemplo');   // o último (da responsável) vale inteiro
  assert.equal(a.perfis.ana.funcao, 'Diretora');
  assert.equal(a.perfis.ana.versao, 3);
  assert.equal(a.perfis.ana.alteradoPor, 'bauer');
  a = aceito([...eventos, perfil('ana', 'ana', null)]);
  assert.equal(a.perfis.ana, undefined);
  assert.deepEqual(a.perfisApagados, ['ana']);
  assert.equal(a.historico.at(-1).verbo, 'apagou o próprio perfil');
  a = aceito([...eventos, perfil('ana', 'ana', null), perfil('bauer', 'ana', {nome: 'Ana de Volta'})]);
  assert.equal(a.perfis.ana.nome, 'Ana de Volta');
  assert.equal(a.perfis.ana.versao, 5);
  assert.deepEqual(a.perfisApagados, []);
  // a responsável apaga o de outra; a outra não apaga o dela
  assert.equal(aceito([perfil('bia', 'bia', {nome: 'Bia'}), perfil('bauer', 'bia', null)]).historico.at(-1).verbo, 'apagou o perfil de Bia');
  recusado([perfil('bia', 'bia', {nome: 'Bia'}), perfil('ana', 'bia', null)], 'permissao');
  // determinismo: o mesmo diário dá o mesmo resultado
  assert.equal(JSON.stringify(aplicar(base, eventos)), JSON.stringify(aplicar(base, eventos)));
});

test('Histórico: "Bauer atualizou o perfil de Ana", só os nomes dos campos, nunca telefone nem e-mail', () => {
  const a = aceito([perfil('bauer', 'ana', ANA), perfil('ana', 'ana', {...ANA, fone: '64900000009', email: 'outro@exemplo.com'}), perfil('ana', 'ana', {...ANA, fone: '64900000009', email: 'outro@exemplo.com'})]);
  const [primeiro, segundo, terceiro] = a.historico;
  assert.equal(primeiro.verbo, 'atualizou o perfil de Ana Ribeiro Exemplo');
  assert.equal(primeiro.resumo, 'nome, função, telefone, e-mail e estado civil');
  assert.equal(primeiro.antes, null);
  assert.equal(primeiro.depois, null);
  assert.equal(segundo.verbo, 'atualizou o próprio perfil');
  assert.equal(segundo.resumo, 'telefone e e-mail');
  assert.deepEqual(segundo.campos, ['fone', 'email']);
  assert.equal(terceiro.resumo, 'nenhum campo mudou');
  const texto = JSON.stringify([a.historico, a.recusados]);
  for (const segredo of ['6490000000', 'exemplo.com', 'Solteira', 'Administradora']) assert.ok(!texto.includes(segredo), segredo + ' vazou no Histórico');
  // a recusa também não carrega os dados
  const r = aplicar(base, [perfil('ana', 'bia', ANA)]);
  assert.ok(!JSON.stringify(r.recusados).includes('6490000000'));
});

test('fora do selo e da trava do mês: perfil com outubro fechado entra, e não atrapalha um fechamento em curso', () => {
  const gasto = ev('bauer', 'add_expense', 'g1', {data: '2026-10-14', competencia: '2026-10', descricao: 'Contador', categoria: 'contabilidade_juridico', valorMinor: 45000, moeda: 'BRL', forma: 'conta_pj', pagoPor: 'bauer'});
  const cabeca = gasto.seq;
  const sem = aplicar(base, [gasto]);
  const selo = seloDoMes(fotoDoMes(base, sem, '2026-10', cabeca));
  // um perfil gravado DEPOIS da cabeça que o fechamento viu não faz o close_month recusar com "o diário andou"
  const mudou = perfil('ana', 'ana', ANA, {quando: NOV});
  const fechar = ev('bauer', 'close_month', '2026-10', {cabeca, selo, totais: {realizado: 45000, previsto: 0, total: 45000, resultado: -45000}}, {quando: NOV});
  const a = aceito([gasto, mudou, fechar]);
  assert.equal(a.fechamentos['2026-10'].fechado, true);
  // com o mês fechado, perfil continua entrando (a trava é só do que forma os números)
  const b = aceito([gasto, mudou, fechar, perfil('bauer', 'bia', {nome: 'Beatriz Exemplo'}, {quando: NOV})]);
  assert.equal(b.perfis.bia.nome, 'Beatriz Exemplo');
  // e o selo do mês é o mesmo com ou sem perfis no diário
  assert.equal(seloDoMes(fotoDoMes(base, b, '2026-10', cabeca)), selo);
  assert.equal(R.livroDoMes(base, b, '2026-10', '2026-10-31').total, R.livroDoMes(base, sem, '2026-10', '2026-10-31').total);
});

test('mescla: diário > perfis.json > rótulo; o que o diário apagou some também do arquivo', () => {
  const arquivo = {estado: 'ok', membros: {bauer: {nome: 'Bauer do Arquivo', fone: '64900000001'}, ana: {nome: 'Ana do Arquivo'}}};
  const aplicado = aplicar(base, [perfil('bia', 'bia', {nome: 'Beatriz do Diário', fone: '64900000003'}), perfil('bauer', 'ana', null)]);
  const m = mesclarPerfis(['bauer', 'ana', 'bia'], arquivo, aplicado);
  assert.equal(m.bauer.perfil.nome, 'Bauer do Arquivo'); assert.equal(m.bauer.fonte, 'arquivo');
  assert.equal(m.ana.perfil, null); assert.equal(m.ana.fonte, null);
  assert.equal(m.bia.perfil.nome, 'Beatriz do Diário'); assert.equal(m.bia.fonte, 'diario'); assert.equal(m.bia.alteradoPor, 'bia');
  assert.equal(estadoDosPerfis(m, arquivo), 'ok');
  assert.equal(estadoDosPerfis(mesclarPerfis(['ana'], {estado: 'outra-chave'}, null), {estado: 'outra-chave'}), 'outra-chave');
  assert.equal(estadoDosPerfis(mesclarPerfis(['ana'], null, null), null), 'ausente');
  // o que a ponte devolve para a tela
  const linha = perfilParaTela(base.members[2], 'Sócio 3', m.bia, true);
  assert.equal(linha.fone, '(64) 90000-0003'); assert.equal(linha.foneLink, '+5564900000003'); assert.equal(linha.fonte, 'diario'); assert.equal(linha.podeEditar, true);
  assert.equal(perfilParaTela(base.members[1], 'Sócio 2', m.ana, false).nome, '');
  // quem edita o quê (a mesma regra do razão)
  assert.equal(podeEditarPerfil({id: 'ana', role: 'member'}, 'ana'), true);
  assert.equal(podeEditarPerfil({id: 'ana', role: 'member'}, 'bia'), false);
  assert.equal(podeEditarPerfil({id: 'bauer', role: 'owner'}, 'bia'), true);
  assert.equal(podeEditarPerfil(null, 'bia'), false);
  // a marca muda quando qualquer campo muda (o snapshot redesenha a Sociedade)
  const outra = mesclarPerfis(['bauer', 'ana', 'bia'], arquivo, aplicar(base, [perfil('bia', 'bia', {nome: 'Beatriz do Diário', fone: '64900000004'}), perfil('bauer', 'ana', null)]));
  assert.notEqual(marcaDosPerfis(m), marcaDosPerfis(outra));
  assert.equal(marcaDosPerfis(m), marcaDosPerfis(mesclarPerfis(['bauer', 'ana', 'bia'], arquivo, aplicado)));
});

test('acompanharDiario: refaz só quando o diário muda (gravou, sincronizou, trocou de diário)', () => {
  const acompanhar = acompanharDiario();
  const d = {modo: 'treino', cabeca: 0, eventos: []};
  const a1 = acompanhar.sobre(base, d);
  assert.deepEqual(a1.perfis, {});
  assert.equal(acompanhar.sobre(base, d), a1, 'sem evento novo, o mesmo resultado');
  d.eventos.push(perfil('ana', 'ana', ANA));
  const a2 = acompanhar.sobre(base, d);
  assert.notEqual(a2, a1);
  assert.equal(a2.perfis.ana.nome, 'Ana Ribeiro Exemplo');
  assert.equal(acompanhar.sobre(base, {...d}).perfis.ana.nome, 'Ana Ribeiro Exemplo', 'outro diário: refaz');
  assert.deepEqual(acompanhar.sobre(base, null).perfis, {});
  acompanhar.esquecer();
  assert.deepEqual(acompanhar.sobre(null, d).perfis, {});
});

test('colagem: casa também pelo nome que a sócia já tem no portal, sem tomar o rótulo de ninguém', () => {
  const roster = [{id: 'bauer', rotulo: 'Sócio 1', nome: 'Bauer Exemplo'}, {id: 'ana', rotulo: 'Sócio 2', nome: 'Sócio 1'}, {id: 'bia', rotulo: 'Sócio 3', nome: ''}];
  const r = lerColado(JSON.stringify({'Bauer Exemplo': {nome: 'Bauer Novo'}, 'Sócio 1': {nome: 'Quem?'}}), roster);
  assert.deepEqual(Object.keys(r.membros), ['bauer']);
  assert.equal(r.avisos.length, 1, 'o segundo "Sócio 1" repete o Bauer (o rótulo vence o nome da Ana)');
  assert.deepEqual(lerColado(JSON.stringify({'sócio 3': null}), roster).remover, ['bia']);
});

test('ida e volta cifrada: Bauer grava os perfis pelo diário, Ana abre noutro navegador e vê; o servidor não vê nada', async () => {
  const store = armazemEmMemoria();
  const app = criarDiario(store, {origens: []});
  const fetch = (url, init) => app(new Request(url, init));
  const masterRaw = new Uint8Array(32).fill(5), url = 'https://diario.test';
  const bauer = await abrirDiario({url, membroId: 'bauer', senha: 'senha do bauer', masterRaw, fetch});
  assert.equal(bauer.modo, 'gravacao', bauer.motivo);
  for (const [alvo, dados] of [['bauer', BAU], ['ana', ANA], ['bia', {nome: 'Beatriz Exemplo', fone: '64900000003'}]]) assert.ok((await bauer.acrescentar({acao: 'set_profile', alvo, dados})).ok);
  const ana = await abrirDiario({url, membroId: 'ana', senha: 'senha da ana', masterRaw, fetch});
  assert.equal(ana.modo, 'gravacao', ana.motivo);
  const a = aplicar(base, ana.eventos);
  assert.deepEqual(Object.keys(a.perfis).sort(), ['ana', 'bauer', 'bia']);
  assert.equal(a.perfis.ana.email, 'ana@exemplo.com');
  assert.equal(a.recusados.length, 0);
  const bruto = JSON.stringify([...store._mapa.values()]);
  for (const segredo of ['Ana Ribeiro', 'Beatriz', '64900000003', 'exemplo.com']) assert.ok(!bruto.includes(segredo), segredo + ' em claro no servidor');
});
