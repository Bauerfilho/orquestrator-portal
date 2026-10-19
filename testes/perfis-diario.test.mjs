// node --test testes/ — os perfis das sócias gravados direto pelo diário (19/10, noite): a ação set_profile do razão
// (permissão pelo estado, a limpeza do perfis.js, apagar, último vence, o Histórico sem telefone nem e-mail, fora do selo
// e da trava do mês), a mescla que as pontes mostram (diário > perfis.json > rótulo) e a ida e volta cifrada pelo diário.
// Dados fictícios óbvios (as três sócias do arnês, telefones 6490000000x).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as R from '../razao.js';
import {fotoDoMes, seloDoMes} from '../contas.js';
import {abrirDiario} from '../diario.js';
import {criarDiario, armazemEmMemoria} from '../servidor/nucleo.mjs';
import {normalizarPerfis, lerColado, mesclarPerfis, podeEditarPerfil, perfilParaTela, travaDoPerfil, estadoDosPerfis, marcaDosPerfis, acompanharDiario} from '../perfis.js';

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

test('versão do perfil: a que a tela viu entra; a de antes de outra pessoa salvar é recusada (versao), sem dados; sem versão vale o último', () => {
  // 0 = ainda sem registro no diário (perfil só no arquivo, ou ninguém)
  let a = aceito([perfil('bauer', 'ana', {...ANA, funcao: 'Diretora'}, {versao: 0})]);
  assert.equal(a.perfis.ana.versao, 1);
  // a Ana salvou com a versão que o aparelho dela mostrava (0), mas a responsável já tinha salvo (1): recusado, nada perdido
  const corrida = [perfil('bauer', 'ana', {...ANA, funcao: 'Diretora'}, {versao: 0}), perfil('ana', 'ana', {...ANA, fone: '64911112222'}, {versao: 0})];
  a = recusado(corrida, 'versao', /Outra pessoa mudou este perfil antes \(versão 1\)/);
  assert.equal(a.perfis.ana.funcao, 'Diretora', 'a função que a responsável salvou sumiu');
  assert.equal(a.perfis.ana.fone, '64900000002');
  const r = a.recusados.at(-1);
  assert.deepEqual(r.atual, {versao: 1, alteradoPor: 'bauer', alteradoEm: OUT});
  assert.ok(!JSON.stringify(a.recusados).includes('6491111'), 'a recusa carregou o telefone');
  // com a versão certa (depois de juntar), entra
  a = aceito([...corrida, perfil('ana', 'ana', {...ANA, funcao: 'Diretora', fone: '64911112222'}, {versao: 1})]);
  assert.deepEqual([a.perfis.ana.funcao, a.perfis.ana.fone, a.perfis.ana.versao], ['Diretora', '64911112222', 2]);
  // apagado também tem versão: quem viu o perfil apagado (versão 2) grava; quem ainda via o de antes (1), não
  const apagado = [perfil('ana', 'ana', ANA, {versao: 0}), perfil('bauer', 'ana', null, {versao: 1})];
  a = aceito([...apagado, perfil('ana', 'ana', {nome: 'Ana de Volta'}, {versao: 2})]);
  assert.equal(a.perfis.ana.nome, 'Ana de Volta');
  recusado([...apagado, perfil('ana', 'ana', {nome: 'Ana de Volta'}, {versao: 1})], 'versao');
  recusado([...apagado, perfil('ana', 'ana', {nome: 'Ana de Volta'}, {versao: 0})], 'versao');
  // os eventos de antes (sem versão) continuam valendo o último
  a = aceito([perfil('bauer', 'ana', {...ANA, funcao: 'Diretora'}), perfil('ana', 'ana', ANA)]);
  assert.equal(a.perfis.ana.funcao, 'Administradora');
  // versão que não é inteiro >= 0: inválido (não é conflito com ninguém)
  for (const versao of [-1, 1.5, '0', null, true]) recusado([perfil('ana', 'ana', ANA, {versao})], 'invalido', /Versão do perfil inválida/);
});

test('mescla e tela levam a versão (0 sem registro, a do diário também para quem foi apagado)', () => {
  const arquivo = {estado: 'ok', membros: {bauer: {nome: 'Bauer do Arquivo'}, ana: {nome: 'Ana do Arquivo'}}};
  const aplicado = aplicar(base, [perfil('ana', 'ana', ANA), perfil('ana', 'ana', ANA), perfil('bauer', 'bia', {nome: 'Bia'}), perfil('bauer', 'bia', null), perfil('bauer', 'bia', null)]);
  const m = mesclarPerfis(['bauer', 'ana', 'bia'], arquivo, aplicado);
  assert.deepEqual([m.bauer.fonte, m.bauer.versao], ['arquivo', 0]);
  assert.deepEqual([m.ana.fonte, m.ana.versao], ['diario', 2]);
  assert.deepEqual([m.bia.fonte, m.bia.perfil, m.bia.versao], [null, null, 3]);
  assert.equal(mesclarPerfis(['ana'], null, null).ana.versao, 0);
  assert.equal(perfilParaTela(base.members[1], 'Sócio 2', m.ana, true).versao, 2);
  assert.equal(perfilParaTela(base.members[0], 'Sócio 1', m.bauer, true).versao, 0);
});

test('perfis.json fora (rede): quem ainda não tem registro no diário não salva; quem já tem, salva', () => {
  const fora = {estado: 'indisponivel', membros: {}};
  const aplicado = aplicar(base, [perfil('bauer', 'bauer', BAU), perfil('bia', 'bia', {nome: 'Bia'}), perfil('bauer', 'bia', null)]);
  const m = mesclarPerfis(['bauer', 'ana', 'bia'], fora, aplicado);
  // a Ana não tem registro no diário: o perfil dela pode estar no arquivo que não veio (e a tela mostraria "não preenchido")
  assert.equal(estadoDosPerfis(m, fora), 'ok', 'o caso perigoso: há perfil pelo diário, então a tela mostra os cartões');
  assert.match(travaDoPerfil(m.ana, fora), /Recarregue a página/);
  assert.equal(travaDoPerfil(m.bauer, fora), '', 'quem já tem perfil no diário salva (o diário já vence o arquivo)');
  assert.equal(travaDoPerfil(m.bia, fora), '', 'quem o diário apagou também (o arquivo já não vale para ela)');
  for (const estado of ['ok', 'ausente', 'outra-chave', 'ilegivel']) assert.equal(travaDoPerfil(m.ana, {estado, membros: {}}), '', estado);
  assert.equal(travaDoPerfil(m.ana, null), '');
  // a tela recebe a trava só no bloco que quem vê edita
  assert.match(perfilParaTela(base.members[1], 'Sócio 2', m.ana, true, fora).trava, /Recarregue/);
  assert.equal(perfilParaTela(base.members[1], 'Sócio 2', m.ana, false, fora).trava, '');
  assert.equal(perfilParaTela(base.members[0], 'Sócio 1', m.bauer, true, fora).trava, '');
});

test('a caixa "Colar vários de uma vez" e os campos dos blocos a 16px ou mais (no iPhone, menos que isso dá zoom ao tocar)', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const tamanhos = seletor => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel]) => sel.split(',').some(x => x.trim() === seletor))
    .flatMap(([, , corpo]) => [...corpo.matchAll(/(?:^|;)\s*font(?:-size)?\s*:\s*(?:[a-z-]+\s+)*?(\d+(?:\.\d+)?)px/g)].map(x => Number(x[1])));
  for (const seletor of ['.perfis-entrada', '.perfil-bloco-campo input']) {
    const lista = tamanhos(seletor);
    assert.ok(lista.length, `sem fonte para ${seletor}`);
    for (const px of lista) assert.ok(px >= 16, `${seletor} com ${px}px`);
  }
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

test('corrida pelo diário de verdade: o aparelho da Ana não viu o que a responsável salvou; o 409 reenvia e o razão recusa', async () => {
  const app = criarDiario(armazemEmMemoria(), {origens: []});
  const fetch = (url, init) => app(new Request(url, init));
  const masterRaw = new Uint8Array(32).fill(6), url = 'https://diario.test';
  const bauer = await abrirDiario({url, membroId: 'bauer', senha: 'senha do bauer', masterRaw, fetch});
  const ana = await abrirDiario({url, membroId: 'ana', senha: 'senha da ana', masterRaw, fetch});   // aberto antes: não sincroniza sozinho
  assert.equal(ana.modo, 'gravacao', ana.motivo);
  assert.ok((await bauer.acrescentar({acao: 'set_profile', alvo: 'ana', dados: {...ANA, funcao: 'Diretora financeira'}, versao: 0})).ok);
  // a Ana ainda vê a versão 0 (o diário dela não tem o evento da responsável) e salva o telefone
  assert.equal(aplicar(base, ana.eventos).perfis.ana, undefined);
  const r = await ana.acrescentar({acao: 'set_profile', alvo: 'ana', dados: {...ANA, fone: '64911112222'}, versao: 0});
  assert.ok(r.ok, 'o diário aceita (o servidor não lê o conteúdo)');
  assert.deepEqual(ana.eventos.map(e => e.membro), ['bauer', 'ana'], 'o 409 sincronizou e reenviou');
  const a = aplicar(base, ana.eventos);
  const recusa = a.recusados.find(x => x.id === r.evento.id);
  assert.equal(recusa && recusa.codigo, 'versao', 'o evento reenviado tinha de ser recusado pela versão (é o que as pontes conferem depois de gravar)');
  assert.equal(a.perfis.ana.funcao, 'Diretora financeira', 'a função que a responsável salvou foi apagada');
  // e quem abre depois vê o mesmo
  const outro = await abrirDiario({url, membroId: 'bauer', senha: 'senha do bauer', masterRaw, fetch});
  assert.equal(aplicar(base, outro.eventos).perfis.ana.funcao, 'Diretora financeira');
});
