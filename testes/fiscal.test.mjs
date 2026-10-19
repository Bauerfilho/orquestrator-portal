// node --test testes/ — o núcleo fiscal confere centavo a centavo com os vetores do plano (docs/PLANO-PORTAL.md §4.6 F8 e
// docs/PLANO-FASES-2-3.md F3-1): Simples (RBT12, fator R, faixa, efetiva, DAS), Presumido, feriados, prazos e o .ics.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  TABELAS_SIMPLES, LIMITE_FATOR_R, PRESUMIDO, OBRIGACOES_PADRAO, TEXTOS, validarTabela, viradas, tabelaVigente, rbt12, folha12, fatorR,
  anexoPeloFatorR, folhaPara28, efetiva, textoFaixa, dasEstimado, presumidoAnual, comparar, pascoa, feriadosBancarios, diaUtil, motivoNaoUtil,
  ajustarDia, validarRegra, validarObrigacao, ocorrencias, vencimento, calendario, ics, reais, reaisCurtos, porcento,
} from '../fiscal.js';

const semente = JSON.parse(readFileSync(new URL('../docs/premissas-padrao-pesquisa.json', import.meta.url), 'utf8'));
const premissa = chave => semente.premissas.find(p => p.chave === chave);
const III = tabelaVigente('III', '2026-10'), V = tabelaVigente('V', '2026-10');
const copia = t => JSON.parse(JSON.stringify(t));
const arred = (n, d) => { const s = n < 0n ? -1n : 1n, a = n * s; return s * ((a + d / 2n) / d); };
const DAS = OBRIGACOES_PADRAO.find(o => o.id === 'das');
const diaDaSemana = d => new Date(d + 'T12:00:00Z').getUTCDay();

test('F8: os vetores do plano (RBT12 R$ 300.000) do fator R à alíquota efetiva', () => {
  // folha de R$ 90.000: fator R 30%, Anexo III faixa 2 (11,2% − R$ 9.360), efetiva 8,08%
  const a = fatorR(9000000, 30000000);
  assert.equal(a.bp, 3000); assert.equal(a.atinge, true); assert.equal(a.anexo, 'III');
  const eIII = efetiva(tabelaVigente(a.anexo, '2026-10'), 30000000);
  assert.equal(eIII.faixa, 2); assert.equal(eIII.nominal, '11.20'); assert.equal(eIII.deduzirMinor, 936000); assert.equal(eIII.bp, 808);
  assert.equal(eIII.num * 10000, eIII.den * 808);   // 8,08% exato, não só arredondado
  assert.equal(eIII.texto, 'Receita dos últimos 12 meses R$ 300.000,00 × 11,2% − R$ 9.360,00 = R$ 24.240,00; ÷ R$ 300.000,00 = 8,08%');
  assert.equal(eIII.textoFaixa, 'Faixa 2: de R$ 180 mil a R$ 360 mil de receita em 12 meses');
  assert.equal(porcento(eIII.bp), '8,08%');
  // folha de R$ 60.000: fator R 20%, Anexo V faixa 2 (18% − R$ 4.500), efetiva 16,50%
  const b = fatorR(6000000, 30000000);
  assert.equal(b.bp, 2000); assert.equal(b.atinge, false); assert.equal(b.anexo, 'V');
  const eV = efetiva(tabelaVigente(b.anexo, '2026-10'), 30000000);
  assert.equal(eV.faixa, 2); assert.equal(eV.deduzirMinor, 450000); assert.equal(eV.bp, 1650); assert.equal(porcento(eV.bp), '16,50%');
  assert.equal(anexoPeloFatorR(9000000, 30000000), 'III');
  assert.equal(anexoPeloFatorR(6000000, 30000000), 'V');
});

test('DAS de R$ 25.000,00 a 8,08% = R$ 2.020,00, com a conta no formato do "Ver a conta"', () => {
  const d = dasEstimado(2500000, III, 30000000);
  assert.equal(d.dasMinor, 202000);
  assert.equal(d.texto, 'R$ 25.000,00 × 8,08% = R$ 2.020,00');
  assert.equal(d.explica.resultado, 202000);
  assert.match(d.explica.formula, /DAS = receita do mês × alíquota efetiva/);
  assert.deepEqual(d.explica.termos.map(t => t.op), ['+', '×']);
  assert.equal(d.explica.termos[0].brl, 2500000);
  assert.equal(d.explica.termos[1].conta, d.efetiva.texto);
  assert.equal(dasEstimado(-1, III, 30000000).codigo, 'invalido');
  assert.equal(dasEstimado(1.5, III, 30000000).codigo, 'invalido');
});

test('fator R de exatamente 28% vai ao Anexo III; um centavo a menos vai ao V e nunca aparece como 28%', () => {
  const r = fatorR(8400000, 30000000);
  assert.equal(r.atinge, true); assert.equal(r.anexo, 'III'); assert.equal(r.bp, 2800);
  const s = fatorR(8399999, 30000000);
  assert.equal(s.atinge, false); assert.equal(s.anexo, 'V'); assert.equal(s.bp, 2799);
  assert.equal(LIMITE_FATOR_R, premissa('simples.fator_r_limite').valor);
  // com zero vale a regra do art. 26, §§ 6º e 7º: sem folha 0,01 (Anexo V); com folha e sem receita 0,28 (Anexo III)
  assert.deepEqual([fatorR(0, 0).bp, fatorR(0, 0).anexo, fatorR(0, 0).porRegra], [100, 'V', true]);
  assert.deepEqual([fatorR(0, 30000000).bp, fatorR(0, 30000000).anexo], [100, 'V']);
  assert.deepEqual([fatorR(500000, 0).bp, fatorR(500000, 0).anexo, fatorR(500000, 0).atinge], [2800, 'III', true]);
  assert.match(fatorR(0, 0).texto, /fator R é 1% pela regra/);
  assert.equal(fatorR(9000000, 30000000).porRegra, false);
  assert.equal(fatorR(-1, 100).codigo, 'invalido');
  assert.match(fatorR(9000000, 30000000).texto, /= 30%: Anexo III$/);
});

test('continuidade nas 8 viradas das faixas 1→5 e a descontinuidade da lei na 6ª', () => {
  for (const t of [III, V]) {
    const v = viradas(t);
    assert.equal(v.length, 5);
    assert.ok(v.slice(0, 4).every(x => x.continua && x.antesMinor === x.depoisMinor), `${t.anexo}: faixas 1→5 contínuas`);
    assert.equal(v[4].continua, false);
    assert.equal(v[4].tetoMinor, 360000000);
  }
  // III em R$ 3,6 mi: 21% − 125.640 = 630.360 contra 33% − 648.000 = 540.000
  assert.deepEqual([viradas(III)[4].antesMinor, viradas(III)[4].depoisMinor], [63036000, 54000000]);
  // V em R$ 3,6 mi: 23% − 62.100 = 765.900 contra 30,5% − 540.000 = 558.000 (o plano escreveu 207.000 por engano; a conclusão é a mesma)
  assert.deepEqual([viradas(V)[4].antesMinor, viradas(V)[4].depoisMinor], [76590000, 55800000]);
  assert.deepEqual(validarTabela(III), {ok: true});
  assert.deepEqual(validarTabela(V), {ok: true});
  // a mesma tabela oficial exigindo continuidade na 6ª seria recusada: sem a semente, a 6ª não passa
  assert.equal(validarTabela(III, []).ok, false);
  assert.equal(validarTabela(III, []).faixa, 6);
  // uma 6ª faixa contínua passa mesmo sem semente (tabela futura hipotética)
  const continua = copia(III); continua.faixas[5].nominal = '23.00'; continua.faixas[5].deduzirMinor = 19764000;   // 21%×3,6mi−125.640 = 23%×3,6mi−197.640
  assert.deepEqual(validarTabela(continua, []), {ok: true});
  assert.equal(efetiva(III, 360000001).aviso, TEXTOS.sextaFaixa);
  assert.ok(efetiva(III, 360000001).bp < efetiva(III, 360000000).bp, 'na 6ª faixa a efetiva cai');
});

test('tabela com um dígito trocado é recusada (todas as posições das faixas 1–5, e a 6ª pela semente)', () => {
  let casos = 0;
  for (const base of [III, V]) for (let k = 0; k < 6; k++) for (const campo of ['tetoMinor', 'nominal', 'deduzirMinor']) {
    const original = String(base.faixas[k][campo]);
    for (let pos = 0; pos < original.length; pos++) {
      if (!/\d/.test(original[pos])) continue;
      for (const dig of '0123456789') {
        if (dig === original[pos]) continue;
        const trocado = original.slice(0, pos) + dig + original.slice(pos + 1);
        const t = copia(base);
        t.faixas[k][campo] = campo === 'nominal' ? trocado : Number(trocado);
        const r = validarTabela(t);
        assert.equal(r.ok, false, `${base.anexo} faixa ${k + 1} ${campo} ${original} → ${trocado} passou`);
        assert.equal(typeof r.motivo, 'string');
        casos++;
      }
    }
  }
  assert.ok(casos > 900, `${casos} trocas conferidas`);
  // o exemplo do plano: dedução da faixa 3 do III com dois dígitos trocados de lugar
  const t = copia(III); t.faixas[2].deduzirMinor = 1746000;
  assert.match(validarTabela(t).motivo, /A faixa 3 não continua a faixa 2 em R\$ 360 mil/);
  // e as recusas de forma
  const curta = copia(III); curta.faixas.pop();
  assert.match(validarTabela(curta).motivo, /6 faixas/);
  const fora = copia(III); fora.faixas[5].nominal = '41.00';
  assert.match(validarTabela(fora).motivo, /0 a 40/);
  const float = copia(III); float.faixas[1].nominal = 11.2;
  assert.equal(validarTabela(float).ok, false, 'nominal em número (float) é recusado: só texto');
  const casas = copia(III); casas.faixas[1].nominal = '11.200';
  assert.equal(validarTabela(casas).ok, false);
  const desordem = copia(III); [desordem.faixas[1].tetoMinor, desordem.faixas[2].tetoMinor] = [desordem.faixas[2].tetoMinor, desordem.faixas[1].tetoMinor];
  assert.match(validarTabela(desordem).motivo, /maior que o da faixa/);
  const semFonte = copia(III); semFonte.fonte = ' ';
  assert.match(validarTabela(semFonte).motivo, /fonte/);
  const deducao = copia(III); deducao.faixas[0].deduzirMinor = 1;
  assert.equal(validarTabela(deducao).ok, false);
});

test('as tabelas do código são as da semente (docs/premissas-padrao-pesquisa.json) e não se alteram', () => {
  const normal = s => String(s).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  for (const [anexo, chave] of [['III', 'simples.anexo_iii'], ['V', 'simples.anexo_v']]) {
    const s = premissa(chave), t = TABELAS_SIMPLES.find(x => x.anexo === anexo);
    assert.equal(t.desde, s.vigenteDesde); assert.equal(t.ate, s.vigenteAte); assert.equal(t.estado, 'a_confirmar');
    assert.match(t.fonte, /LC 155\/2016/);
    assert.deepEqual(t.faixas.map(f => [f.tetoMinor, normal(f.nominal), f.deduzirMinor]), s.faixas.map(([teto, nom, ded]) => [teto, normal(nom), ded]));
    assert.ok(t.faixas.every(f => typeof f.nominal === 'string'), 'nominal em texto decimal');
  }
  assert.throws(() => { TABELAS_SIMPLES[0].faixas[0].nominal = '1.00'; }, TypeError);
  assert.equal(TABELAS_SIMPLES[0].faixas[0].nominal, '6.00');
  // Presumido e prazos também batem com a semente
  assert.equal(PRESUMIDO.presuncao, String(premissa('presumido.presuncao_servicos').valor));
  assert.equal(PRESUMIDO.irpj, String(premissa('presumido.irpj').valor));
  assert.equal(PRESUMIDO.adicional, String(premissa('presumido.irpj').adicional.valor));
  assert.equal(PRESUMIDO.adicionalLimiteAnualMinor, 12 * 2000000);   // R$ 20 mil por mês
  assert.equal(PRESUMIDO.csll, String(premissa('presumido.csll').valor));
  assert.equal(PRESUMIDO.pis, String(premissa('presumido.pis_cumulativo').valor));
  assert.equal(PRESUMIDO.cofins, String(premissa('presumido.cofins_cumulativo').valor));
  for (const p of semente.prazos_proximos) assert.ok(OBRIGACOES_PADRAO.some(o => o.regra === 'data:' + p.data), `prazo ${p.data} na lista`);
});

test('tabela vigente: só no período dela; 2027 fica "a cadastrar"; as do diário valem por cima', () => {
  assert.equal(tabelaVigente('III', '2018-01').id, 'lc155-anexo-iii');
  assert.equal(tabelaVigente('V', '2026-12').id, 'lc155-anexo-v');
  const jan = tabelaVigente('III', '2027-01');
  assert.equal(jan.codigo, 'a_cadastrar');
  assert.match(jan.erro, /Ainda não há tabela do Simples \(Anexo III\) para janeiro de 2027 com fonte/);
  assert.equal(tabelaVigente('III', '2017-12').codigo, 'a_cadastrar');
  assert.equal(tabelaVigente('IV', '2026-10').codigo, 'a_cadastrar');
  assert.equal(tabelaVigente('III', '2026-13').codigo, 'invalido');
  const nova = {...copia(III), id: 'diario-2027', desde: '2027-01-01', ate: '2027-12-31', fonte: 'tabela fictícia de teste'};
  assert.equal(tabelaVigente('III', '2027-03', [nova]).id, 'diario-2027');
  assert.equal(tabelaVigente('III', '2026-10', [nova]).id, 'lc155-anexo-iii');
  const correcao = {...copia(III), id: 'diario-correcao'};
  assert.equal(tabelaVigente('III', '2026-10', [correcao]).id, 'diario-correcao', 'no empate de início, a cadastrada depois');
  const errada = {...copia(III), id: 'diario-errada', desde: '2027-01-01', ate: null, fonte: 'x'}; errada.faixas[1].deduzirMinor = 963000;
  assert.equal(tabelaVigente('III', '2027-03', [errada]).codigo, 'a_cadastrar', 'tabela inválida do diário é ignorada');
  assert.equal(tabelaVigente('III', '2030-01', [{...nova, ate: null}]).id, 'diario-2027');
});

test('alíquota efetiva: RBT12 zero, bordas das faixas e fora do Simples', () => {
  const zero = efetiva(III, 0);
  assert.equal(zero.faixa, 1); assert.equal(zero.bp, 600); assert.equal(zero.num * 100, zero.den * 6);
  assert.match(zero.texto, /vale a alíquota nominal da faixa 1, 6%/);
  assert.equal(efetiva(V, 0).bp, 1550);
  assert.equal(efetiva(III, 18000000).faixa, 1);
  assert.equal(efetiva(III, 18000001).faixa, 2);
  assert.equal(efetiva(III, 480000000).faixa, 6);
  const fora = efetiva(III, 480000001);
  assert.equal(fora.codigo, 'fora_do_simples'); assert.equal(fora.foraDoSimples, true);
  assert.match(fora.erro, /acima de R\$ 4,8 milhões: fora do Simples/);
  assert.equal(efetiva(III, -1).codigo, 'invalido');
  assert.equal(efetiva({...copia(III), faixas: []}, 100).codigo, 'invalido');
  assert.deepEqual([1, 2, 5, 6].map(k => textoFaixa(III, k)), [
    'Faixa 1: até R$ 180 mil de receita em 12 meses', 'Faixa 2: de R$ 180 mil a R$ 360 mil de receita em 12 meses',
    'Faixa 5: de R$ 1,8 milhão a R$ 3,6 milhões de receita em 12 meses', 'Faixa 6: de R$ 3,6 milhões a R$ 4,8 milhões de receita em 12 meses']);
  assert.deepEqual([reaisCurtos(24000000), reaisCurtos(18050000), reaisCurtos(12345), reais(-5990), reais(138847)], ['R$ 240 mil', 'R$ 180,5 mil', 'R$ 123,45', '−R$ 59,90', 'R$ 1.388,47']);
  // a efetiva nunca é negativa nem passa da nominal, em qualquer receita do Simples
  for (let r = 0; r <= 480000000; r += 1234567) for (const t of [III, V]) {
    const e = efetiva(t, r), nom = BigInt(e.nominal.replace('.', ''));
    assert.ok(e.num >= 0 && BigInt(e.num) * 10000n <= nom * BigInt(e.den), `${t.anexo} ${r}`);
  }
});

test('2.000 bases: o DAS é o arredondamento único do valor exato (nunca da alíquota de 2 casas)', () => {
  let x = 20261019, diferentesDoAtalho = 0;
  const proximo = () => (x = (x * 1103515245 + 12345) % 2147483648);
  for (const [t, R] of [[III, 31234567], [V, 98765433], [III, 412345678], [V, 17999999]]) {
    const f = t.faixas.find(fx => R <= fx.tetoMinor), n = BigInt(f.nominal.replace('.', '')), D = BigInt(f.deduzirMinor), B = BigInt(R);
    for (let k = 0; k < 500; k++) {
      const base = proximo() % 500000000;
      const exato = arred(BigInt(base) * (B * n - D * 100n * 100n), B * 100n * 100n);   // nominal com 2 casas: d = 100
      const d = dasEstimado(base, t, R);
      assert.equal(d.dasMinor, Number(exato), `${t.anexo} RBT12 ${R} base ${base}`);
      if (d.dasMinor !== Number(arred(BigInt(base) * BigInt(d.efetiva.bp), 10000n))) diferentesDoAtalho++;
    }
  }
  assert.ok(diferentesDoAtalho > 100, `arredondar a alíquota antes mudaria ${diferentesDoAtalho} de 2.000 DAS`);
});

test('RBT12 com a regra de início de atividade (Res. CGSN 140/2018, art. 22): 1º e 6º mês, média e meses faltando', () => {
  const mensal = (de, valores) => valores.map((v, k) => ({competencia: `2026-${String(+de.slice(5) + k).padStart(2, '0')}`, brutoMinor: v}));
  // 1º mês: a receita do próprio mês × 12
  const p1 = rbt12([{competencia: '2026-03', brutoMinor: 1000000}], '2026-03', '2026-03');
  assert.deepEqual([p1.rbt12Minor, p1.meses, p1.proporcional, p1.faltando], [12000000, 1, true, []]);
  assert.equal(p1.texto, 'Receita de mar/2026 R$ 10.000,00 × 12 = R$ 120.000,00');
  // 6º mês: média dos 5 meses anteriores × 12 = (10+20+30+40+50 mil) ÷ 5 × 12
  const receitas = mensal('2026-03', [1000000, 2000000, 3000000, 4000000, 5000000]);
  const p6 = rbt12(receitas, '2026-08', '2026-03');
  assert.deepEqual([p6.rbt12Minor, p6.meses, p6.proporcional, p6.faltando], [36000000, 5, true, []]);
  assert.match(p6.regra, /média dos 5 meses desde mar\/2026 × 12/);
  assert.equal(p6.texto, 'Receita de mar/2026 a jul/2026 R$ 150.000,00 ÷ 5 × 12 = R$ 360.000,00');
  // um arredondamento só: 7 meses somando R$ 10.000,01 → × 12 ÷ 7
  const torto = rbt12([{competencia: '2026-03', brutoMinor: 1000001}], '2026-10', '2026-03');
  assert.equal(torto.rbt12Minor, Number(arred(1000001n * 12n, 7n)));
  assert.deepEqual(torto.faltando, ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  // vários canais no mesmo mês se somam
  assert.equal(rbt12([{competencia: '2026-03', brutoMinor: 600000}, {competencia: '2026-03', brutoMinor: 400000}], '2026-03', '2026-03').rbt12Minor, 12000000);
  // do 13º mês em diante: a soma dos 12 meses anteriores (o próprio mês não entra)
  const ano = Array.from({length: 13}, (_, k) => ({competencia: `${2025 + Math.floor((k + 9) / 12)}-${String((k + 9) % 12 + 1).padStart(2, '0')}`, brutoMinor: 2500000}));
  const cheio = rbt12(ano, '2026-10', '2025-01');
  assert.deepEqual([cheio.rbt12Minor, cheio.meses, cheio.proporcional, cheio.de, cheio.ate], [30000000, 12, false, '2025-10', '2026-09']);
  assert.equal(rbt12(ano, '2026-10').rbt12Minor, 30000000, 'sem início informado: a soma dos 12 meses');
  const buraco = rbt12(ano.filter(r => r.competencia !== '2026-02'), '2026-10');
  assert.deepEqual([buraco.rbt12Minor, buraco.faltando], [27500000, ['2026-02']]);
  assert.match(rbt12([], '2026-02', '2026-03').erro, /antes do início da atividade/);
  assert.equal(rbt12([{competencia: '2026-03', brutoMinor: -1}], '2026-04').codigo, 'invalido');
  assert.equal(rbt12([{competencia: '2026-03', brutoMinor: 1.5}], '2026-04').codigo, 'invalido');
  assert.equal(rbt12([], '2026-4').codigo, 'invalido');
  // a folha segue a mesma regra
  const f6 = folha12(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map(competencia => ({competencia, valorMinor: 300000})), '2026-08', '2026-03');
  assert.deepEqual([f6.folha12Minor, f6.meses, f6.proporcional], [3600000, 5, true]);
  assert.match(f6.texto, /^Folha de mar\/2026/);
  const f1 = folha12([{competencia: '2026-03', valorMinor: 750000}], '2026-03', '2026-03');
  assert.equal(f1.folha12Minor, 9000000);
  assert.deepEqual(folha12([], '2026-10', '2026-03').faltando.length, 7);
});

test('Presumido com RBT12 R$ 300 mil, folha R$ 90 mil e ISS 2% = R$ 57.990,00; o adicional e os limites', () => {
  const p = presumidoAnual({rbt12: 30000000, folha12: 9000000, issPct: '2'});
  assert.equal(p.totalMinor, 5799000);
  assert.deepEqual(Object.fromEntries(p.itens.map(i => [i.id, i.valorMinor])), {irpj: 1440000, irpj_adicional: 0, csll: 864000, pis: 195000, cofins: 900000, iss: 600000, cpp: 1800000});
  assert.equal(p.itens.reduce((a, i) => a + i.valorMinor, 0), p.totalMinor, 'as partes fecham com o total');
  assert.equal(p.explica.resultado, 5799000);
  assert.ok(p.explica.termos.every(t => t.op === '+' && Number.isSafeInteger(t.brl)));
  assert.equal(p.itens[0].conta, '15% × 32% × R$ 300.000,00');
  assert.equal(p.cargaBp, 1933);
  // adicional: R$ 1 milhão → presumido R$ 320 mil → 10% × R$ 80 mil = R$ 8.000
  const grande = presumidoAnual({rbt12: 100000000, folha12: 0, issPct: '2,5'});
  assert.equal(grande.itens.find(i => i.id === 'irpj_adicional').valorMinor, 800000);
  assert.match(grande.itens.find(i => i.id === 'irpj_adicional').conta, /10% × \(lucro presumido R\$ 320\.000,00 − R\$ 240\.000,00\)/);
  assert.equal(grande.itens.find(i => i.id === 'iss').valorMinor, 2500000);
  assert.equal(grande.itens.find(i => i.id === 'iss').conta, '2,5% × R$ 1.000.000,00');
  // cada tributo arredonda uma vez a partir do exato
  const torto = presumidoAnual({rbt12: 12345679, folha12: 333, issPct: '3.75'});
  assert.equal(torto.itens.find(i => i.id === 'irpj').valorMinor, Number(arred(12345679n * 32n * 15n, 10000n)));
  assert.equal(torto.itens.find(i => i.id === 'pis').valorMinor, Number(arred(12345679n * 65n, 10000n)));
  assert.equal(torto.itens.find(i => i.id === 'iss').valorMinor, Number(arred(12345679n * 375n, 10000n)));
  assert.equal(torto.itens.find(i => i.id === 'cpp').valorMinor, 67);
  assert.equal(presumidoAnual({rbt12: 30000000, folha12: 9000000, issPct: '2', competencia: '2026-12'}).totalMinor, 5799000);
  assert.equal(presumidoAnual({rbt12: 30000000, folha12: 9000000, issPct: '2', competencia: '2027-01'}).codigo, 'a_cadastrar');
  assert.equal(presumidoAnual({rbt12: 30000000, folha12: 9000000, issPct: '1.99'}).codigo, 'invalido');
  assert.equal(presumidoAnual({rbt12: 30000000, folha12: 9000000, issPct: '5.01'}).codigo, 'invalido');
  assert.equal(presumidoAnual({rbt12: 30000000, folha12: 9000000, issPct: '5'}).itens.find(i => i.id === 'iss').valorMinor, 1500000);
  assert.equal(presumidoAnual({rbt12: 30000000, folha12: 9000000, issPct: 'dois'}).codigo, 'invalido');
  assert.match(presumidoAnual({rbt12: 600000000, folha12: 0, issPct: '2'}).aviso, /R\$ 5 milhões/);
});

test('folha para 28% = R$ 84.000,00 e o comparador Simples III × V × Presumido, sem recomendar regime', () => {
  const f = folhaPara28(30000000, 6000000);
  assert.deepEqual([f.folhaMinor, f.faltaMinor], [8400000, 2400000]);
  assert.equal(f.texto, 'Para chegar a 28%, a folha dos 12 meses precisaria somar R$ 84.000,00; hoje soma R$ 60.000,00.');
  assert.equal(folhaPara28(30000000).folhaMinor, 8400000);
  assert.equal(folhaPara28(30000000, 9000000).faltaMinor, 0);
  assert.equal(folhaPara28(1).folhaMinor, 1, 'arredonda para cima: 28% de 1 centavo pede 1 centavo');
  for (let r = 0; r < 100000; r += 37) {   // é o piso exato: com 1 centavo a menos não chega
    const m = folhaPara28(r).folhaMinor;
    assert.equal(fatorR(m, r).atinge, true);
    if (m > 0) assert.equal(fatorR(m - 1, r).atinge, false);
  }
  const c = comparar({rbt12: 30000000, folha12: 9000000, issPct: '2', competencia: '2026-10'});
  assert.deepEqual(c.itens.map(i => [i.id, i.totalMinor, i.cargaBp, i.aplicavel]), [['simples_iii', 2424000, 808, true], ['simples_v', 4950000, 1650, false], ['presumido', 5799000, 1933, null]]);
  assert.equal(c.aviso, TEXTOS.informa);
  assert.equal(c.folhaPara28.folhaMinor, 8400000);
  const d = comparar({rbt12: 30000000, folha12: 6000000, issPct: '2', competencia: '2026-10'});
  assert.deepEqual(d.itens.map(i => i.aplicavel), [false, true, null]);
  assert.match(d.itens[0].nota, /Para chegar a 28%, a folha dos 12 meses precisaria somar R\$ 84\.000,00; hoje soma R\$ 60\.000,00\./);
  assert.equal(d.itens[2].totalMinor, 5799000 - 600000, 'INSS patronal sobre a folha menor');
  for (const r of [c, d]) assert.doesNotMatch(JSON.stringify(r), /recomend|melhor|deveri|compensa|vale a pena/i);
  const em2027 = comparar({rbt12: 30000000, folha12: 9000000, issPct: '2', competencia: '2027-01'});
  assert.ok(em2027.itens.every(i => i.erro && i.totalMinor === undefined), 'em 2027 nada é estimado sem tabela');
  assert.equal(comparar({rbt12: 30000000, folha12: 9000000, issPct: '2'}).codigo, 'invalido');
});

test('feriados bancários: Páscoa, Carnaval, Sexta-feira Santa, Corpus Christi, 20/11 desde 2024 e 31/12', () => {
  assert.equal(pascoa(2026), '2026-04-05');
  assert.equal(pascoa(2027), '2027-03-28');
  for (const [ano, dia] of [[2019, '04-21'], [2024, '03-31'], [2025, '04-20'], [2028, '04-16'], [2029, '04-01'], [2030, '04-21'], [2038, '04-25'], [2049, '04-18']]) assert.equal(pascoa(ano), `${ano}-${dia}`);
  const f27 = feriadosBancarios(2027), datas = f27.map(f => f.data);
  assert.ok(datas.includes('2027-02-08') && datas.includes('2027-02-09'), 'Carnaval 08–09/02/2027');
  assert.ok(datas.includes('2027-03-26'), 'Sexta-feira Santa 26/03/2027');
  assert.ok(datas.includes('2027-05-27'), 'Corpus Christi 27/05/2027');
  assert.ok(datas.includes('2027-11-20') && datas.includes('2027-12-31'));
  assert.deepEqual(datas, [...datas].sort());
  assert.equal(f27.find(f => f.data === '2027-02-08').tipo, 'bancario');
  assert.equal(f27.find(f => f.data === '2027-11-20').tipo, 'nacional');
  assert.ok(!feriadosBancarios(2023).some(f => f.data === '2023-11-20'), '20/11 só a partir de 2024 (Lei 14.759/2023)');
  assert.ok(feriadosBancarios(2024).some(f => f.data === '2024-11-20'));
  assert.equal(feriadosBancarios(2026).length, 14);
  assert.deepEqual(feriadosBancarios(1800), []);
  f27[0].data = 'mexido';
  assert.equal(feriadosBancarios(2027)[0].data, '2027-01-01', 'a lista devolvida é cópia');
  assert.equal(diaUtil('2026-11-20'), false); assert.equal(diaUtil('2026-11-23'), true);
  assert.equal(diaUtil('2026-12-20'), false); assert.equal(diaUtil('2026-02-17'), false);
  assert.equal(motivoNaoUtil('2026-11-20'), '20/11 é feriado nacional');
  assert.equal(motivoNaoUtil('2026-02-16'), '16/02 não tem expediente bancário (Carnaval)');
  assert.equal(motivoNaoUtil('2026-12-20'), '20/12 é domingo');
  assert.equal(motivoNaoUtil('2026-11-23'), null);
});

test('DAS da competência 10/2026: 20/11 (sexta, feriado) → 23/11 com "prorroga"; 20/12 (domingo) → 21/12', () => {
  assert.equal(diaDaSemana('2026-11-20'), 5);
  assert.equal(diaDaSemana('2026-12-20'), 0);
  const out = vencimento(DAS, '2026-10');
  assert.equal(DAS.diaNaoUtil, 'prorroga');
  assert.deepEqual([out.nominal, out.data, out.ajustada, out.referente], ['2026-11-20', '2026-11-23', true, '2026-10']);
  assert.equal(out.texto, 'DAS de outubro · vence 23/11 (20/11 é feriado nacional)');
  assert.equal(out.uid, 'das-2026-11-20@orquestrator-financas');
  const nov = vencimento(DAS, '2026-11');
  assert.deepEqual([nov.data, nov.texto], ['2026-12-21', 'DAS de novembro · vence 21/12 (20/12 é domingo)']);
  assert.equal(vencimento({...DAS, diaNaoUtil: 'antecipa'}, '2026-10').data, '2026-11-19');
  assert.equal(vencimento({...DAS, diaNaoUtil: 'nenhum'}, '2026-10').data, '2026-11-20');
  assert.equal(vencimento({...DAS, diaNaoUtil: 'antecipa'}, '2026-10').uid, out.uid, 'o uid não muda com a regra de dia não útil');
  assert.equal(vencimento(DAS, '2026-12').data, '2027-01-20');
  const defis = vencimento(OBRIGACOES_PADRAO.find(o => o.id === 'defis'), '2026');
  assert.deepEqual([defis.data, defis.texto], ['2027-03-31', 'DEFIS de 2026 · vence 31/03']);
  assert.equal(ajustarDia('2026-12-31', 'prorroga'), '2027-01-04', '31/12, 01/01 e o fim de semana');
  assert.equal(ajustarDia('2027-02-09', 'antecipa'), '2027-02-05', 'Carnaval: sexta antes');
});

test('obrigações padrão, regras e ocorrências numa janela (inclusive o ajuste que cruza o ano)', () => {
  assert.deepEqual(OBRIGACOES_PADRAO.map(o => o.id), ['das', 'pgdas-d', 'defis', 'fechamento', 'opcao-ibs-cbs', 'nfse-nacional', 'reforma-2027']);
  for (const o of OBRIGACOES_PADRAO) {
    assert.equal(validarObrigacao(o), null, o.id);
    assert.ok(o.fonte.length > 5 && typeof o.aConfirmar === 'boolean');
  }
  assert.deepEqual(['mensal:20', 'mensal:5', 'anual:03-31', 'anual:02-29', 'data:2026-10-30'].map(validarRegra), [true, true, true, true, true]);
  assert.deepEqual(['mensal:0', 'mensal:32', 'anual:02-30', 'anual:13-01', 'data:2026-02-30', 'semanal:1', '', null].map(validarRegra), Array(8).fill(false));
  assert.match(validarObrigacao({...DAS, fonte: ''}), /fonte/);
  assert.match(validarObrigacao({...DAS, regra: 'mensal:40'}), /Regra inválida/);
  assert.match(validarObrigacao({...DAS, diaNaoUtil: 'talvez'}), /dia não útil/);
  assert.match(validarObrigacao({...DAS, titulo: 'x'.repeat(121)}), /120/);
  assert.match(validarObrigacao({...DAS, referente: 'ano_anterior'}), /Referente/);
  // 31/12/2026 (quinta, sem expediente) → 04/01/2027: a janela de janeiro pega o prazo nominal de dezembro
  const fimDoMes = {id: 'teste', titulo: 'Teste', regra: 'mensal:31', diaNaoUtil: 'prorroga', fonte: 'fictícia'};
  const jan = ocorrencias(fimDoMes, '2027-01-01', '2027-01-10');
  assert.deepEqual(jan.map(o => [o.nominal, o.data]), [['2026-12-31', '2027-01-04']]);
  assert.match(jan[0].texto, /\(31\/12 não tem expediente bancário \(fim de ano\)\)$/);
  assert.deepEqual(ocorrencias({...fimDoMes, diaNaoUtil: 'nenhum'}, '2027-02-01', '2027-02-28').map(o => o.nominal), ['2027-02-28'], 'dia 31 em fevereiro cai no último dia');
  // com prorroga, 31/01/2027 (domingo) vence em 01/02 e 28/02/2027 (domingo) em 01/03
  assert.deepEqual(ocorrencias(fimDoMes, '2027-02-01', '2027-02-28').map(o => [o.nominal, o.data]), [['2027-01-31', '2027-02-01']]);
  const bissexto = {id: 'b', titulo: 'B', regra: 'anual:02-29', diaNaoUtil: 'nenhum', fonte: 'fictícia'};
  assert.deepEqual(ocorrencias(bissexto, '2027-01-01', '2028-12-31').map(o => o.nominal), ['2027-02-28', '2028-02-29']);
  assert.deepEqual(ocorrencias({...DAS, regra: 'mensal:99'}, '2026-01-01', '2026-12-31'), []);
  assert.deepEqual(ocorrencias(DAS, '2026-12-01', '2026-11-01'), []);
  const nfse = ocorrencias(OBRIGACOES_PADRAO.find(o => o.id === 'nfse-nacional'), '2026-10-01', '2026-12-31');
  assert.deepEqual(nfse.map(o => [o.data, o.texto]), [['2026-11-01', 'NFS-e nacional obrigatória · 01/11/2026']]);
  // os próximos 12 meses, em ordem
  const cal = calendario('2026-10-19');
  assert.equal(cal.length, 40);
  assert.ok(cal.every((o, k) => o.data >= '2026-10-19' && o.data <= '2027-10-18' && (!k || cal[k - 1].data <= o.data)));
  assert.equal(cal[0].texto, 'DAS de setembro · vence 20/10');
  assert.ok(cal.some(o => o.texto === 'DAS de outubro · vence 23/11 (20/11 é feriado nacional)'));
  assert.ok(cal.some(o => o.texto === 'Último dia para optar por IBS e CBS fora do DAS · 30/10/2026'));
  assert.ok(cal.some(o => o.id === 'reforma-2027' && o.data === '2027-01-01'));
  assert.equal(new Set(cal.map(o => o.uid)).size, cal.length);
  assert.deepEqual(calendario('2026-10-19', {meses: 1}).map(o => o.id), ['das', 'pgdas-d', 'opcao-ibs-cbs', 'nfse-nacional', 'fechamento'], 'até 18/11: o DAS de outubro (23/11) fica fora');
  assert.deepEqual(calendario('2026-10-19', {obrigacoes: [DAS], meses: 3}).map(o => o.referente), ['2026-09', '2026-10', '2026-11']);
});

test('.ics (RFC 5545): CRLF, linhas ≤ 75 octetos com acentos, escapes, UID estável e texto idêntico em 3 execuções', () => {
  const agora = '2026-10-19T12:00:00Z';
  const estranha = {id: 'estranha', titulo: 'Taxa; teste, com \\ barra', regra: 'data:2026-12-15', diaNaoUtil: 'nenhum', aConfirmar: true,
    nota: 'Ação de verificação 🧾 com acentuação: ção, ã, é, ü, ñ, “aspas”, travessão — e mais um pouco de texto para passar de 75 octetos várias vezes.',
    fonte: 'Fonte fictícia; com vírgula, ponto e vírgula e barra \\ invertida'};
  const lista = [...calendario('2026-10-19'), ...ocorrencias(estranha, '2026-12-01', '2026-12-31')];
  const textos = [1, 2, 3].map(() => ics(lista, {agora, nome: 'Prazos · Finanças'}));
  assert.equal(textos[0], textos[1]); assert.equal(textos[1], textos[2]);
  const t = textos[0];
  assert.ok(t.endsWith('END:VCALENDAR\r\n'));
  assert.doesNotMatch(t.replace(/\r\n/g, ''), /[\r\n]/, 'só CRLF como fim de linha');
  const fisicas = t.slice(0, -2).split('\r\n');
  for (const l of fisicas) {
    assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `linha com ${Buffer.byteLength(l, 'utf8')} octetos: ${l}`);
    assert.doesNotMatch(l, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/, 'caractere partido');
  }
  // dobra não parte um escape: nenhum pedaço dobrado termina com um número ímpar de barras
  for (let k = 0; k < fisicas.length - 1; k++) if (fisicas[k + 1].startsWith(' ')) assert.equal((/\\*$/.exec(fisicas[k])[0].length) % 2, 0);
  assert.ok(fisicas.some(l => l.startsWith(' ')), 'houve dobra');
  const logicas = t.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
  assert.deepEqual(logicas.slice(0, 6), ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Orquestrator//Financas//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Prazos · Finanças']);
  const eventos = t.replace(/\r\n /g, '').split('BEGIN:VEVENT\r\n').slice(1).map(b => b.split('\r\n').filter(l => l.includes(':') && !/^(BEGIN|END):/.test(l))
    .reduce((ev, l) => { const k = l.slice(0, l.indexOf(':')); if (!(k in ev)) ev[k] = l.slice(l.indexOf(':') + 1); return ev; }, {}));   // a 1ª ocorrência (a DESCRIPTION do alarme vem depois)
  assert.equal(eventos.length, lista.length);
  const das = eventos.find(e => e.UID === 'das-2026-11-20@orquestrator-financas');
  assert.equal(das['DTSTART;VALUE=DATE'], '20261123');
  assert.equal(das['DTEND;VALUE=DATE'], '20261124');
  assert.equal(das.DTSTAMP, '20261019T120000Z');
  assert.equal(das.SUMMARY, 'DAS de outubro');
  assert.equal(das.TRIGGER, '-P1DT15H');
  assert.match(das.DESCRIPTION, /Vence em 23\/11\/2026\.\\n20\/11 é feriado nacional: a regra é passar para o dia útil seguinte\.\\nFonte: Res\. CGSN 140\/2018\\, art\. 40/);
  assert.match(das.DESCRIPTION, /confirmar com o contador\.$/);
  assert.ok(eventos.every(e => /Fonte: /.test(e.DESCRIPTION) && /confirmar com o contador/.test(e.DESCRIPTION) && !('RRULE' in e)));
  const e = eventos.find(x => x.UID === 'estranha-2026-12-15@orquestrator-financas');
  assert.equal(e.SUMMARY, 'Taxa\\; teste\\, com \\\\ barra');
  assert.match(e.DESCRIPTION, /🧾 com acentuação: ção\\, ã/);
  assert.match(e.DESCRIPTION, /Fonte: Fonte fictícia\\; com vírgula\\, ponto e vírgula e barra \\\\ invertida\./);
  // desfazendo os escapes volta o texto original
  const desescapar = s => s.replace(/\\(.)/g, (_, c) => c === 'n' ? '\n' : c);
  assert.equal(desescapar(e.SUMMARY), estranha.titulo);
  assert.equal(desescapar(e.DESCRIPTION).split('\n')[0], estranha.nota);
  // UID estável: outro "agora" só muda o DTSTAMP; outra regra de dia não útil muda a data, não o UID
  const outro = ics(lista, {agora: '2026-11-02T08:30:00Z', nome: 'Prazos · Finanças'});
  assert.equal(outro.replace(/DTSTAMP:\d{8}T\d{6}Z/g, ''), t.replace(/DTSTAMP:\d{8}T\d{6}Z/g, ''));
  const antecipa = ics([vencimento({...DAS, diaNaoUtil: 'antecipa'}, '2026-10')], {agora});
  assert.match(antecipa, /UID:das-2026-11-20@orquestrator-financas\r\n/);
  assert.match(antecipa, /DTSTART;VALUE=DATE:20261119\r\n/);
  assert.match(antecipa.replace(/\r\n /g, ''), /a regra é antecipar para o dia útil anterior/);
  // repetida não duplica; sem "agora" não gera (o DTSTAMP precisa ser o do parâmetro)
  assert.equal(ics([out(), out()], {agora}).split('BEGIN:VEVENT').length - 1, 1);
  assert.throws(() => ics(lista, {}), TypeError);
  assert.throws(() => ics([{uid: 'x'}], {agora}), TypeError);
  assert.equal(ics([], {agora}), 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Orquestrator//Financas//PT-BR\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Prazos fiscais · Finanças\r\nEND:VCALENDAR\r\n');
  function out() { return vencimento(DAS, '2026-10'); }
});

test('fiscal.js é puro: sem import, DOM, rede, armazenamento, relógio ou acaso; resultado igual em 3 execuções', () => {
  const fonte = readFileSync(new URL('../fiscal.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte, /^\s*import\b|\bimport\s*\(|\brequire\s*\(/m);
  assert.doesNotMatch(fonte, /\b(document|window|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|navigator|process|globalThis)\b/);
  assert.doesNotMatch(fonte, /Date\.now|new Date\(\)|Math\.random|performance\./);
  assert.doesNotMatch(fonte, /parseFloat|toFixed|toLocaleString|Intl\./, 'nada de float nem de formatação que muda com o aparelho');
  const rodar = () => JSON.stringify([comparar({rbt12: 31234567, folha12: 9000000, issPct: '2.5', competencia: '2026-10'}), rbt12([{competencia: '2026-03', brutoMinor: 1000001}], '2026-10', '2026-03'),
    calendario('2026-10-19'), dasEstimado(2500000, III, 31234567)]);
  const r = rodar();
  assert.equal(rodar(), r); assert.equal(rodar(), r);
});
