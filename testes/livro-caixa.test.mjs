import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../razao.js';
import {buildSnapshot} from '../domain.js';
import {acertoAcumulado, fotoDoMes} from '../contas.js';

import {estadoComLivro} from './fixtures/livro-caixa.mjs';
const evento = (acao, alvo, dados = {}, versao = undefined) => ({id: 'ev-teste', seq: 1, membro: 'm-dona',
  conteudo: {acao, alvo, dados, versao, motivo: 'Teste de correção', quando: '2031-11-21T12:00:00Z'}});

test('o livro importado semeia só despesas, mantém aportes separados e não inventa banco nem autoria', () => {
  const estado = estadoComLivro(), antes = structuredClone(estado);
  const a = R.aplicar(estado, []);
  assert.equal(a.gastos.length, 2);
  assert.equal(a.receitas.length, 0);
  assert.equal(a.saldos.length, 0);
  assert.equal(a.historico.length, 0, 'importação não se faz passar por assinatura de sócia');
  assert.equal(a.gastos[0].criadoPor, null);
  assert.equal(a.gastos[0].pagoPor, null);
  assert.equal(a.gastos[0].importado.aba, 'Outubro fictício');
  assert.equal(a.gastos[0].importado.linha, 8);
  assert.deepEqual(estado, antes);
  assert.deepEqual(R.aplicar(estado, []), a);
});

test('o mês não duplica uma assinatura já paga e pagamento único não vira custo recorrente', () => {
  const estado = estadoComLivro(), a = R.aplicar(estado, []);
  const outubro = R.livroDoMes(estado, a, '2031-10', '2031-11-21');
  const novembro = R.livroDoMes(estado, a, '2031-11', '2031-11-21');
  assert.equal(outubro.realizado, 1234);
  assert.equal(outubro.previsto, 0);
  assert.equal(outubro.incompletos.length, 0);
  assert.equal(novembro.realizado, 2000);
  assert.equal(novembro.previsto, 1234);
  const snapshot = buildSnapshot(estado, estado.members[0], '2031-11-21');
  assert.deepEqual(snapshot.blocks.user.summary.fixed_monthly.map(x => [x.moeda, x.amount_minor]), [['BRL', 1234]]);
  assert.equal(snapshot.blocks.user.summary.incomplete_costs, 0);
});

test('movimentos e CSV incluem entradas e saídas; nenhuma linha futura ou saldo inicial vira movimento', () => {
  const a = R.aplicar(estadoComLivro(), []);
  assert.equal(typeof R.movimentosLivro, 'function', 'falta a projeção única dos movimentos');
  const movimentos = R.movimentosLivro(a);
  assert.equal(movimentos.length, 3);
  assert.equal(movimentos.filter(m => m.tipo === 'entrada').length, 1);
  assert.equal(movimentos.filter(m => m.tipo === 'saida').length, 2);
  assert.equal(movimentos.some(m => m.competencia === '2031-12'), false);
  assert.equal(typeof R.csvMovimentos, 'function');
  const csv = R.csvMovimentos(movimentos.filter(m => m.competencia === '2031-10'), R.parametros(a), () => '');
  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv, /entrada_centavos/);
  assert.match(csv, /saida_centavos/);
  assert.equal(csv.trim().split('\r\n').length, 3, 'exporta o filtro, não o livro inteiro');
  assert.match(csv, /Outubro fictício/);
  assert.doesNotMatch(csv, /Configuração única/);
});

test('fonte importada é somente leitura; um evento não a reescreve e nem repete pagamento vinculado', () => {
  const estado = estadoComLivro(), id = 'lc-2031-10-8';
  for (const acao of ['edit_expense', 'void_expense', 'check_expense', 'mark_reimbursed', 'convert_to_contribution']) {
    const a = R.aplicar(estado, [evento(acao, id, {valorMinor: 999}, 1)]);
    assert.equal(a.recusados.length, 1, acao);
    assert.match(a.recusados[0].motivo, /planilha|importado/i, acao);
    assert.equal(a.gastos[0].valorMinor, 1234);
    assert.equal(a.gastos[0].versao, 1);
  }
  const dados = {data: '2031-10-20', competencia: '2031-10', descricao: 'Aurora outra vez', categoria: 'software_ia',
    valorMinor: 1234, moeda: 'BRL', forma: 'conta_pj', pagoPor: 'm-dona', destino: 'nao_aplica', planoId: 'pl-mensal'};
  const a = R.aplicar(estado, [evento('add_expense', 'g-duplicado', dados)]);
  assert.equal(a.recusados[0]?.codigo, 'repetido');
  assert.equal(a.gastos.length, 2);
});

test('livro inválido falha fechado: duplicação, calendário, totais, saldo por linha, limites e origem', () => {
  const casos = [
    b => { b.versao = 99; },
    b => { b.fonte.sha256 = 'não-é-hash'; },
    b => { b.meses[0].linhas[1].id = b.meses[0].linhas[0].id; },
    b => { b.meses[0].linhas[1].linha = 7; },
    b => { b.meses[0].linhas[1].data = '2031-10-32'; },
    b => { b.meses[0].linhas[1].data = '2031-11-02'; },
    b => { b.meses[0].linhas[1].saidaMinor = 1.5; },
    b => { b.meses[0].linhas[1].saidaMinor = Number.MAX_SAFE_INTEGER; },
    b => { b.meses[0].linhas[1].entradaMinor = 1; },
    b => { b.meses[0].linhas[1].saidaMinor = -1; },
    b => { b.meses[0].linhas[1].saldoMinor++; },
    b => { b.meses[0].saidasMinor++; },
    b => { b.meses[1].saldoInicialMinor++; },
    b => { b.meses.push(structuredClone(b.meses[0])); },
  ];
  for (const [i, mudar] of casos.entries()) {
    const estado = estadoComLivro(); mudar(estado.livroCaixa);
    assert.throws(() => R.aplicar(estado, []), /livro.caixa/i, `caso ${i}`);
  }
});

test('origem não cria HTML nem fórmula de CSV executável', () => {
  const estado = estadoComLivro();
  estado.livroCaixa.meses[0].linhas[1].descricao = '=1+1';
  estado.livroCaixa.meses[0].linhas[1].observacoes = '@SOMA(1;1)';
  const a = R.aplicar(estado, []);
  assert.equal(typeof R.csvMovimentos, 'function');
  const csv = R.csvMovimentos(R.movimentosLivro(a), R.parametros(a), () => '');
  assert.match(csv, /'=1\+1/);
  assert.match(csv, /'@SOMA/);
});

test('conciliação autorizada preserva o diário anterior como histórico e não soma os mesmos gastos duas vezes', () => {
  const estado = estadoComLivro();
  const antigo = evento('add_expense', 'g-antigo', {data: '2031-10-20', competencia: '2031-10', descricao: 'Pagamento anterior',
    categoria: 'software_ia', valorMinor: 1234, moeda: 'BRL', forma: 'cartao_pessoal', pagoPor: 'm-dona', destino: 'empresa_reembolsa', planoId: 'pl-mensal'});
  const reembolso = {...evento('mark_reimbursed', 'g-antigo', {}, 1), id: 'ev-reembolso', seq: 2};
  const prefixo = [antigo, reembolso];
  const semFonte = {...estado}; delete semFonte.livroCaixa;
  const antes = R.aplicar(semFonte, prefixo);
  estado.livroCaixa.conciliacao = {diarioAteSeq: 2, gastoIds: ['g-antigo'], autorizacao: 'Fonte fictícia aprovada como referência; diário anterior só histórico.', decididoEm: '2031-11-21T12:00:00Z'};
  const depois = R.aplicar(estado, prefixo);
  assert.equal(depois.recusados.length, 0, 'a importação não invalida eventos assinados já aceitos');
  assert.deepEqual(depois.historico, antes.historico, 'quem fez o quê e quando permanece idêntico');
  const preservado = {...depois.gastos.find(g => g.id === 'g-antigo')}; delete preservado.historicoFonte;
  assert.deepEqual(preservado, antes.gastos[0]);
  assert.equal(depois.gastos.find(g => g.id === 'g-antigo').historicoFonte, true);
  assert.equal(R.livroDoMes(estado, depois, '2031-10', '2031-11-21').realizado, 1234);
  const esperadoSemDivida = {'m-dona': 0, 'm-par': 0};
  assert.deepEqual(acertoAcumulado(estado, depois, R.parametros(depois), '2031-11-21').devido, esperadoSemDivida);
  const semReembolsoAntigo = R.aplicar(estado, [antigo]);
  assert.deepEqual(acertoAcumulado(estado, semReembolsoAntigo, R.parametros(semReembolsoAntigo), '2031-11-21').devido, {'m-dona': 1234, 'm-par': 0}, 'não repetir custo não pode perdoar uma obrigação anterior ainda pendente');
  assert.deepEqual(fotoDoMes(estado, depois, '2031-10', 2).gastos.map(g => g.id), ['lc-2031-10-8']);
  const novo = {...evento('add_expense', 'g-novo', {...antigo.conteudo.dados, descricao: 'Outro gasto legítimo', valorMinor: 100, planoId: null}), id: 'ev-novo', seq: 3};
  const atualizado = R.aplicar(estado, [...prefixo, novo]);
  assert.equal(atualizado.recusados.length, 0);
  assert.equal(R.livroDoMes(estado, atualizado, '2031-10', '2031-11-21').realizado, 1334, 'gasto novo posterior à decisão continua contando');
  const editar = {...evento('edit_expense', 'g-antigo', {valorMinor: 999}, 2), id: 'ev-edicao', seq: 3};
  assert.match(R.aplicar(estado, [...prefixo, editar]).recusados[0]?.motivo || '', /histórico|concilia/i);
});

test('fonte opcional malformada e conciliação sem autorização não são ignoradas', () => {
  for (const valor of [false, 0, '', [], {}]) assert.throws(() => R.aplicar({...estadoComLivro(), livroCaixa: valor}, []), /livro.caixa/i);
  for (const conciliacao of [{diarioAteSeq: 2, gastoIds: ['g-antigo']},
    {diarioAteSeq: 1.5, gastoIds: [], autorizacao: 'teste', decididoEm: '2031-11-21T12:00:00Z'}]) {
    const e = estadoComLivro(); e.livroCaixa.conciliacao = conciliacao;
    assert.throws(() => R.aplicar(e, []), /livro.caixa/i);
  }
});
