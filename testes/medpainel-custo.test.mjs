// O custo fixo do Med Painel tem uma fonte só: o resumo das assinaturas (blocks.user.summary), lido na hora em que a
// tela desenha. Uma cópia dentro do bloco do Med Painel viaja congelada no pacote e fica velha quando as assinaturas
// mudam (11/11/2026). Aqui: o domínio não entrega cópia, e o app.js não lê o custo do bloco.
// Uso: node --test testes/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSnapshot, applyMutation} from '../domain.js';
import {estadoFicticio} from '../ferramentas/arnes/estado-ficticio.js';

const MEMBRO = {id: 'm-bauer', role: 'owner'}, HOJE = '2026-10-19';
// o pacote de um exportador antigo: o custo copiado no dia da exportação (um número que nenhuma assinatura soma)
const pacoteComCopia = () => {
  const estado = structuredClone(estadoFicticio);
  estado.staticBlocks.medpainel.fixed_monthly = [{moeda: 'BRL', valor: 1234.56}];
  estado.staticBlocks.medpainel.incomplete_costs = 7;
  return estado;
};

test('o bloco do Med Painel sai sem cópia do custo fixo, mesmo que o pacote traga uma', () => {
  const blocos = buildSnapshot(pacoteComCopia(), MEMBRO, HOJE).blocks;
  assert.equal(Object.hasOwn(blocos.medpainel, 'fixed_monthly'), false);
  assert.equal(Object.hasOwn(blocos.medpainel, 'incomplete_costs'), false);
  assert.ok(blocos.medpainel.premissas.preco, 'o resto do bloco continua');
  assert.ok(blocos.user.summary.fixed_monthly.some(item => item.moeda === 'USD' && item.valor > 0), 'a fonte é o resumo das assinaturas');
});

test('mudou uma assinatura: o resumo acompanha e nenhum número velho sobra no Med Painel', () => {
  const antes = pacoteComCopia();
  const usd = estado => buildSnapshot(estado, MEMBRO, HOJE).blocks.user.summary.fixed_monthly.find(item => item.moeda === 'USD').valor;
  const {state: depois} = applyMutation(antes, 'set_subscription', {index: 0, active: false, expected_revision: `r${antes.revision}`}, MEMBRO, HOJE);
  assert.equal(antes.plans[0].amountMinor, 20000, 'a primeira assinatura fictícia custa US$ 200 por mês');
  assert.equal(Math.round((usd(antes) - usd(depois)) * 100), 20000, 'o custo mensal cai exatamente o valor da assinatura desligada');
  assert.equal(JSON.stringify(buildSnapshot(depois, MEMBRO, HOJE).blocks.medpainel).includes('1234.56'), false);
});

test('app.js: a tela do Med Painel recebe o custo do resumo das assinaturas e não lê o do próprio bloco', () => {
  const fonte = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(fonte, /renderMedPainel\(blocks\.medpainel \|\| \{\}, \(blocks\.user \|\| \{\}\)\.summary\)/, 'quem desenha passa o resumo das assinaturas');
  const inicio = fonte.indexOf('function mpPremissa('), fim = fonte.indexOf('window.financeMedPainel = ');
  assert.ok(inicio > 0 && fim > inicio, 'as funções do Med Painel continuam juntas no app.js');
  const trecho = fonte.slice(inicio, fim);
  assert.equal(/block\.fixed_monthly|block\.incomplete_costs/.test(trecho), false, 'nenhuma leitura do custo dentro do bloco do Med Painel');
  assert.match(trecho, /function projetarMedPainel\(block, cenario, fixos\)/, 'a conta recebe o custo de fora');
});
