// Reproduções FICTÍCIAS dos riscos encontrados pela revisão independente. Nenhum acesso à rede ou dado da empresa.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../razao.js';
import * as C from '../contas.js';
import {estadoComLivro} from './fixtures/livro-caixa.mjs';
import {prepararPacote} from '../ferramentas/atualizar-livro-caixa.mjs';

const ev = (seq, acao, alvo, dados = {}, extra = {}) => {
  const {membro = 'm-dona', ...resto} = extra;
  return {seq, id: `ev-regressao-${seq}`, membro, conteudo: {acao, alvo, dados, quando: '2031-11-21T12:00:00Z', ...resto}};
};
const semFonte = estado => {const base = structuredClone(estado); delete base.livroCaixa; return base;};
const pacote = estado => ({finance: {state: estado, roster: estado.members}, gallery: {files: {}}});
const retrato = eventos => ({cabeca: eventos.length, eventos, verificacao: {integro: true, ate: eventos.length, problemas: []}});
const gasto = extra => ({data: '2031-10-20', competencia: '2031-10', descricao: 'Gasto fictício anterior', categoria: 'software_ia',
  valorMinor: 1234, moeda: 'BRL', forma: 'cartao_pessoal', pagoPor: 'm-dona', destino: 'empresa_reembolsa', ...extra});
const autorizar = (estado, ids, limite) => {estado.livroCaixa.conciliacao = {diarioAteSeq: limite, gastoIds: ids,
  autorizacao: 'Decisão fictícia: referência documental sem repetir custo; obrigações não são perdoadas.', decididoEm: '2031-11-21T12:00:00Z'}; return estado;};
const saldos = acerto => acerto.porSocia.map(s => ({id: s.id, saldo: s.saldo, devido: s.devido, aportes: s.aportes, retiradas: s.retiradas}));

test('conciliar o custo não transforma reembolso já pago em dívida negativa', () => {
  const estado = autorizar(estadoComLivro(), ['g-anterior'], 2), base = semFonte(estado);
  const eventos = [ev(1, 'add_expense', 'g-anterior', gasto()), ev(2, 'record_settlement', 'ac-reembolso', {
    tipo: 'reembolso_empresa', de: 'empresa', para: 'm-dona', valorMinor: 1234, moeda: 'BRL', data: '2031-11-20', forma: 'pix', gastoIds: ['g-anterior']})];
  const antes = R.aplicar(base, eventos), depois = R.aplicar(estado, eventos);
  assert.deepEqual(antes.recusados, []); assert.deepEqual(depois.recusados, []);
  assert.deepEqual(saldos(C.acertoAcumulado(estado, depois, null, '2031-11-21')), saldos(C.acertoAcumulado(base, antes, null, '2031-11-21')));
  assert.equal(C.acertoAcumulado(estado, depois, null, '2031-11-21').devido['m-dona'], 0);
});

test('gasto dividido e Pix que o quitou continuam zerados, sem sugerir devolução do Pix', () => {
  const estado = autorizar(estadoComLivro(), ['g-dividido'], 2), base = semFonte(estado);
  const parte = R.ratear(10000, ['60', '40'])[1];
  const eventos = [ev(1, 'add_expense', 'g-dividido', gasto({valorMinor: 10000, destino: 'dividir'})),
    ev(2, 'record_settlement', 'ac-quita', {tipo: 'acerto_entre_socias', de: 'm-par', para: 'm-dona', valorMinor: parte, moeda: 'BRL', data: '2031-11-20', forma: 'pix'}, {membro: 'm-par'})];
  const antes = R.aplicar(base, eventos), depois = R.aplicar(estado, eventos);
  assert.deepEqual(antes.recusados, []); assert.deepEqual(depois.recusados, []);
  assert.deepEqual(saldos(C.acertoAcumulado(estado, depois, null, '2031-11-21')), saldos(C.acertoAcumulado(base, antes, null, '2031-11-21')));
  assert.deepEqual(C.acertoAcumulado(estado, depois, null, '2031-11-21').transferencias, []);
});

test('importação para histórico recusa reembolso pendente em vez de perdoá-lo ou torná-lo impossível de pagar', () => {
  const estado = autorizar(estadoComLivro(), ['g-pendente'], 1), base = semFonte(estado);
  const eventos = [ev(1, 'add_expense', 'g-pendente', gasto())];
  assert.throws(() => prepararPacote(pacote(base), estado.livroCaixa, retrato(eventos), '2031-11-21'), /reembolso|obrigaç|pendente/i);
  // Mesmo num estado construído fora do atualizador, obrigação assinada continua visível, não é zerada pelo marcador.
  assert.equal(C.acertoAcumulado(estado, R.aplicar(estado, eventos), null, '2031-11-21').devido['m-dona'], 1234);
});

test('base persistida não recebe planos criados/confirmados/arquivados pelo diário, nem altera selo de mês fechado', () => {
  const estado = estadoComLivro(), base = semFonte(estado);
  const eventos = [ev(1, 'add_plan', 'pl-nova', {servico: 'Nuvem fictícia', plano: 'Essencial', valorMinor: 500, moeda: 'BRL', periodo: 'mensal', diaVencimento: 20, categoria: 'software_ia'}),
    ev(2, 'confirm_plan', 'pl-nova', {}, {versao: 1})];
  const a = R.aplicar(base, eventos); assert.deepEqual(a.recusados, []);
  const foto = C.fotoDoMes(base, a, '2031-09', 2);
  eventos.push(ev(3, 'close_month', '2031-09', {cabeca: 2, selo: C.seloDoMes(foto), totais: {
    realizado: foto.totais.realizado, previsto: foto.totais.previsto, total: foto.totais.total, resultado: foto.totais.resultado}}));
  eventos.push(ev(4, 'archive_plan', 'pl-nova', {desde: '2031-11-21'}, {versao: 2, motivo: 'Encerramento inteiramente fictício.'}));
  const antes = R.aplicar(base, eventos); assert.deepEqual(antes.recusados, []);
  assert.equal(C.conferirFechamentos(base, eventos)[0].confere, true);
  const pronto = prepararPacote(pacote(base), estado.livroCaixa, retrato(eventos), '2031-11-21');
  assert.equal(pronto.finance.state.plans.some(p => p.id === 'pl-nova'), false, 'plano é evento, não semente duplicada');
  const depois = R.aplicar(pronto.finance.state, eventos);
  assert.deepEqual(depois.recusados, antes.recusados); assert.deepEqual(depois.historico, antes.historico);
  assert.deepEqual(C.conferirFechamentos(pronto.finance.state, eventos), C.conferirFechamentos(base, eventos));
});

test('projeção de pagamento do mês não fica colada na base dos meses seguintes', () => {
  const estado = estadoComLivro(), base = semFonte(estado);
  const pronto = prepararPacote(pacote(base), estado.livroCaixa, retrato([]), '2031-10-21');
  assert.deepEqual(pronto.finance.state.plans.find(p => p.id === 'pl-mensal'), base.plans.find(p => p.id === 'pl-mensal'));
  const depois = R.aplicar(pronto.finance.state, []), emDezembro = R.estadoEfetivo(pronto.finance.state, depois, '2031-12-21');
  assert.notEqual(emDezembro.plans.find(p => p.id === 'pl-mensal').paymentStatus, 'pago');
});

test('fonte reimportável: corrigir observação em mês aberto não reescreve nem invalida o diário', () => {
  const estado = estadoComLivro(), nova = structuredClone(estado.livroCaixa);
  nova.meses[0].linhas[1].observacoes = 'Correção fictícia da observação documental.';
  const pronto = prepararPacote(pacote(estado), nova, retrato([]), '2031-11-21');
  assert.equal(pronto.finance.state.livroCaixa.meses[0].linhas[1].observacoes, nova.meses[0].linhas[1].observacoes);
  assert.deepEqual(R.aplicar(pronto.finance.state, []).historico, []);
});

test('reimportação comum não pode revogar a conciliação e ressomar silenciosamente um custo antigo', () => {
  const estado = autorizar(estadoComLivro(), ['g-anterior'], 2);
  const eventos = [ev(1, 'add_expense', 'g-anterior', gasto()), ev(2, 'mark_reimbursed', 'g-anterior', {}, {versao: 1})];
  const alterada = structuredClone(estado.livroCaixa); alterada.conciliacao.gastoIds = [];
  assert.throws(() => prepararPacote(pacote(estado), alterada, retrato(eventos), '2031-11-21'), /conciliaç|decisão/i);
});

test('roteiro não cobra assinatura impossível das linhas somente leitura da planilha', () => {
  const estado = estadoComLivro(), a = R.aplicar(estado, []);
  const passo = C.roteiroDoFechamento(estado, a, null, '2031-11', '2031-11-21').passos.find(p => p.chave === 'conferencia');
  assert.deepEqual(passo.itens, []);
  assert.doesNotMatch(passo.resumo, /lançado por null|sem conferência/);
});

test('vínculo só no diário falha fechado: não cria semente fantasma nem quebra a abertura e os prefixos dos selos', () => {
  const estado = estadoComLivro(), base = semFonte(estado), livro = structuredClone(estado.livroCaixa);
  const eventos = [ev(1, 'add_plan', 'pl-nova', {servico: 'Nuvem fictícia', plano: 'Essencial', valorMinor: 500, moeda: 'BRL', periodo: 'mensal', diaVencimento: 20, categoria: 'software_ia'}), ev(2, 'confirm_plan', 'pl-nova', {}, {versao: 1})];
  livro.meses[1].linhas[0].descricao = 'Renovação Nuvem fictícia'; livro.meses[1].linhas[0].planoId = null;
  const antes = structuredClone(base);
  assert.throws(() => prepararPacote(pacote(base), livro, retrato(eventos), '2031-11-21'), /PENDENTE.*apenas no diário/);
  assert.deepEqual(base, antes, 'a falha não muda a base nem tenta copiar a projeção');
  assert.equal(livro.meses[1].linhas[0].planoId, null, 'não inventa vínculo no objeto recebido');
});

test('importar fonte que muda a fotografia de mês já fechado é recusado, mesmo sem alterar evento', () => {
  const estado = estadoComLivro(), base = semFonte(estado), foto = C.fotoDoMes(base, R.aplicar(base, []), '2031-10', 0);
  const eventos = [ev(1, 'close_month', '2031-10', {cabeca: 0, selo: C.seloDoMes(foto), totais: {
    realizado: foto.totais.realizado, previsto: foto.totais.previsto, total: foto.totais.total, resultado: foto.totais.resultado}})];
  assert.deepEqual(R.aplicar(base, eventos).recusados, []);
  assert.equal(C.conferirFechamentos(base, eventos)[0].confere, true);
  assert.throws(() => prepararPacote(pacote(base), estado.livroCaixa, retrato(eventos), '2031-11-21'), /fechado|selo/i);
});

test('compra avulsa não transforma assinatura mensal do mesmo fornecedor em única ou paga para sempre', () => {
  for (const planoId of [null, 'pl-mensal']) {
    const estado = estadoComLivro(), base = semFonte(estado), livro = structuredClone(estado.livroCaixa), antes = structuredClone(base);
    livro.meses[1].linhas[0].descricao = 'Aurora (pagamento único)'; livro.meses[1].linhas[0].planoId = planoId;
    assert.throws(() => prepararPacote(pacote(base), livro, retrato([]), '2031-11-21'), /PENDENTE|recorrente|pagamento único/i);
    assert.deepEqual(base, antes, 'não muda recorrência, valor ou status da base recebida');
  }
});

function comOutubroFechado() {
  const estado = estadoComLivro(), foto = C.fotoDoMes(estado, R.aplicar(estado, []), '2031-10', 0);
  const eventos = [ev(1, 'close_month', '2031-10', {cabeca: 0, selo: C.seloDoMes(foto), totais: {
    realizado: foto.totais.realizado, previsto: foto.totais.previsto, total: foto.totais.total, resultado: foto.totais.resultado}})];
  assert.deepEqual(R.aplicar(estado, eventos).recusados, []); return {estado,eventos};
}

test('mês fechado protege também descrição e observação documental, não só o que o selo de custos calcula', () => {
  const {estado,eventos} = comOutubroFechado(), livro = structuredClone(estado.livroCaixa);
  livro.meses[0].linhas[1].observacoes = 'Alteração documental posterior ao fechamento.';
  assert.throws(() => prepararPacote(pacote(estado), livro, retrato(eventos), '2031-11-21'), /fonte.*fechado|fechado.*fonte/i);
});

test('aporte e saldo escriturado de mês fechado não mudam por fora do selo de custos', () => {
  const {estado,eventos} = comOutubroFechado(), livro = structuredClone(estado.livroCaixa);
  livro.meses[0].linhas[0].entradaMinor++; livro.meses[0].entradasMinor++;
  for (const [i,mes] of livro.meses.entries()) {
    if(i)mes.saldoInicialMinor++; mes.saldoFinalMinor++; for(const l of mes.linhas)l.saldoMinor++;
  }
  R.validarLivroCaixa(livro); // muda só entrada e transporte do saldo; custos continuam iguais e o selo antigo ainda confere.
  assert.equal(C.conferirFechamentos({...estado,livroCaixa:livro},eventos)[0].confere,true);
  assert.throws(() => prepararPacote(pacote(estado), livro, retrato(eventos), '2031-11-21'), /fonte.*fechado|fechado.*fonte/i);
});
