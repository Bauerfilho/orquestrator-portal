// O núcleo fiscal do Finanças: Simples Nacional (receita dos 12 meses, fator R, faixa, alíquota efetiva e DAS estimado),
// uma estimativa do Lucro Presumido para comparar e o calendário dos prazos, com o .ics para o celular. Puro e
// determinístico, como o razao.js: sem DOM, rede nem armazenamento, sem import, igual no navegador e no Node. Dinheiro em
// centavos inteiros (BigInt na conta, um arredondamento só, meio para longe do zero); percentuais em texto decimal
// ("11.20"), nunca float. Tudo aqui é estimativa para conversar com o contador: o portal informa, não aconselha.
// Plano: docs/PLANO-PORTAL.md §4.6 (F8) e §5 (Impostos); docs/PLANO-FASES-2-3.md (F3-1). Testes: testes/fiscal.test.mjs.

export const FISCAL_VERSAO = 1;
const congelar = v => { if (v && typeof v === 'object') { Object.values(v).forEach(congelar); Object.freeze(v); } return v; };

// ── decimais exatos, datas e textos ───────────────────────────────────────────────────────────────────────────────
// "11.20" → {n: 1120n, d: 100n}. Aceita vírgula; recusa sinal, notação científica e mais casas que o permitido.
function decimal(valor, casasMax = 2) {
  const s = String(valor ?? '').trim().replace(',', '.');
  const m = /^(\d{1,9})(?:\.(\d{1,12}))?$/.exec(s);
  if (!m || (m[2] || '').length > casasMax) return null;
  return {n: BigInt(m[1] + (m[2] || '')), d: 10n ** BigInt((m[2] || '').length)};
}
function arred(n, d) { // meio para longe do zero, como o roundedRatio do domain.js e o arred do razao.js
  const sinal = n < 0n ? -1n : 1n, a = n * sinal;
  return sinal * ((a + d / 2n) / d);
}
const numero = big => { if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('valor fora do limite'); return Number(big); };
const mdc = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
const inteiro = (v, min = 0) => Number.isSafeInteger(v) && v >= min;
const limpo = (v, max = 240) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
const pad = n => String(n).padStart(2, '0');

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const diaValido = s => { if (typeof s !== 'string' || !DIA.test(s)) return false; const t = Date.parse(s + 'T12:00:00Z'); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s; };
const mesValido = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const somarDias = (d, n) => new Date(utc(d) + n * 864e5).toISOString().slice(0, 10);
const diaDaSemana = d => new Date(utc(d)).getUTCDay();   // 0 = domingo
const ultimoDia = mes => new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate();
function somarMeses(mes, k) { const t = +mes.slice(0, 4) * 12 + (+mes.slice(5, 7) - 1) + k; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}`; }
const mesesEntre = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = mes => MESES[+mes.slice(5, 7) - 1];                                   // "outubro"
const mesAno = mes => `${nomeMes(mes)} de ${mes.slice(0, 4)}`;                        // "outubro de 2026"
const mesCurto = mes => `${nomeMes(mes).slice(0, 3)}/${mes.slice(0, 4)}`;             // "out/2026"
const dataBR = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`;                             // "23/11"
const dataCompleta = d => `${dataBR(d)}/${d.slice(0, 4)}`;                             // "23/11/2026"
const maiuscula = s => s.charAt(0).toUpperCase() + s.slice(1);

const milhar = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// "R$ 1.388,47"
export function reais(minor) {
  if (!Number.isSafeInteger(minor)) return '—';
  const a = Math.abs(minor);
  return `${minor < 0 ? '−' : ''}R$ ${milhar(String(Math.floor(a / 100)))},${pad(a % 100)}`;
}
// "R$ 180 mil", "R$ 1,8 milhão", "R$ 4,8 milhões" (só quando o valor é redondo; senão, o valor inteiro)
export function reaisCurtos(minor) {
  if (!inteiro(minor) || minor % 100) return reais(minor);
  const r = minor / 100;
  const escala = (unidade, sing, plur) => {
    const int = Math.floor(r / unidade), frac = r % unidade;
    if (frac % (unidade / 100)) return null;
    const dec = pad(frac / (unidade / 100)).replace(/0+$/, '');
    return `R$ ${milhar(String(int))}${dec ? ',' + dec : ''} ${int < 2 ? sing : plur}`;
  };
  return (r >= 1e6 && escala(1e6, 'milhão', 'milhões')) || (r >= 1e3 && escala(1e3, 'mil', 'mil')) || reais(minor);
}
// pontos-base → "8,08%" (casas fixas) ou, enxuto, "30%" e "27,5%"
export function porcento(bp, enxuto = false) {
  if (!Number.isSafeInteger(bp)) return '—';
  const a = Math.abs(bp), dec = pad(a % 100), s = enxuto ? dec.replace(/0+$/, '') : dec;
  return `${bp < 0 ? '−' : ''}${milhar(String(Math.floor(a / 100)))}${s ? ',' + s : ''}%`;
}
const decimalTexto = t => { const [i, f = ''] = String(t).replace(',', '.').split('.'); const g = f.replace(/0+$/, ''); return `${i}${g ? ',' + g : ''}%`; };   // "11.20" → "11,2%"

export const TEXTOS = congelar({
  informa: 'Estimativa para conversar com o contador. O portal informa, não aconselha.',
  sextaFaixa: 'Na 6ª faixa a alíquota efetiva pode cair: é a regra da lei.',
  semTabela2027: 'Ainda não há tabela do Simples para 2027 com fonte: a estimativa para em dezembro até alguém cadastrar a tabela nova.',
  municipais: 'Feriados municipais não entram na conta: confira os do município da sede.',
  exportacao: 'Receitas de exportação não são separadas aqui: com venda para o exterior, o DAS estimado sai maior que o devido.',
  confirmar: 'Prazo calculado pelo portal Finanças: confirmar com o contador.',
});

// ── tabelas do Simples (Anexos III e V) ───────────────────────────────────────────────────────────────────────────
// Semente: docs/premissas-padrao-pesquisa.json (simples.anexo_iii e simples.anexo_v, marcadas "conferir"). Teto e
// parcela a deduzir em centavos; alíquota nominal em texto, com as 2 casas da lei. Vigência inclusiva nas duas pontas.
// Em 2027 os anexos mudam (LC 214/2025, art. 519): sem tabela cadastrada a estimativa para em 31/12/2026, de propósito.
const FONTE_TABELAS = 'LC 123/2006, Anexos III e V (redação da LC 155/2016), desde 01/01/2018; de 2027 em diante valem os anexos da LC 214/2025 (art. 519)';
export const TABELAS_SIMPLES = congelar([
  {id: 'lc155-anexo-iii', anexo: 'III', desde: '2018-01-01', ate: '2026-12-31', estado: 'a_confirmar', fonte: FONTE_TABELAS, faixas: [
    {tetoMinor: 18000000, nominal: '6.00', deduzirMinor: 0},
    {tetoMinor: 36000000, nominal: '11.20', deduzirMinor: 936000},
    {tetoMinor: 72000000, nominal: '13.50', deduzirMinor: 1764000},
    {tetoMinor: 180000000, nominal: '16.00', deduzirMinor: 3564000},
    {tetoMinor: 360000000, nominal: '21.00', deduzirMinor: 12564000},
    {tetoMinor: 480000000, nominal: '33.00', deduzirMinor: 64800000},
  ]},
  {id: 'lc155-anexo-v', anexo: 'V', desde: '2018-01-01', ate: '2026-12-31', estado: 'a_confirmar', fonte: FONTE_TABELAS, faixas: [
    {tetoMinor: 18000000, nominal: '15.50', deduzirMinor: 0},
    {tetoMinor: 36000000, nominal: '18.00', deduzirMinor: 450000},
    {tetoMinor: 72000000, nominal: '19.50', deduzirMinor: 990000},
    {tetoMinor: 180000000, nominal: '20.50', deduzirMinor: 1710000},
    {tetoMinor: 360000000, nominal: '23.00', deduzirMinor: 6210000},
    {tetoMinor: 480000000, nominal: '30.50', deduzirMinor: 54000000},
  ]},
]);
export const ANEXOS = ['III', 'V'];
export const LIMITE_FATOR_R = 28;   // % (LC 123/2006, art. 18, §§ 5º-J e 5º-M, redação da LC 155/2016)
const TETO_MAXIMO = 1e11;          // R$ 1 bilhão em centavos: guarda das contas exatas (o Simples para em R$ 4,8 milhões)

// nominal × teto − dedução de uma faixa, como fração exata em centavos ({n, d}); comparar duas é multiplicar em cruz
function noTeto(faixa, tetoMinor) {
  const nom = decimal(faixa.nominal);
  return {n: BigInt(tetoMinor) * nom.n - BigInt(faixa.deduzirMinor) * nom.d * 100n, d: nom.d * 100n};
}
const iguais = (a, b) => a.n * b.d === b.n * a.d;

// As viradas de faixa: no teto da faixa k, a conta da faixa k e a da faixa k+1. Nas viradas 1→2 até 4→5 a lei é contínua
// (a alíquota efetiva não salta); na 5→6 os dois anexos saltam para baixo (III: R$ 630.360 contra R$ 540.000 em
// R$ 3,6 milhões; V: R$ 765.900 contra R$ 558.000). Para a tela e para os testes.
export function viradas(tabela) {
  const fx = tabela.faixas;
  return fx.slice(0, -1).map((f, k) => {
    const antes = noTeto(f, f.tetoMinor), depois = noTeto(fx[k + 1], f.tetoMinor);
    return {de: k + 1, para: k + 2, tetoMinor: f.tetoMinor, antesMinor: numero(arred(antes.n, antes.d)), depoisMinor: numero(arred(depois.n, depois.d)), continua: iguais(antes, depois)};
  });
}

// Confere uma tabela (a do código ou uma cadastrada pelo diário, F3-3): 6 faixas, tetos crescentes, nominal de 0% a 40%
// com até 2 casas, dedução inteira ≥ 0 (zero na 1ª faixa), continuidade exata nas viradas 1→5 e a 6ª faixa igual à da
// semente do mesmo anexo (teto da 5ª, teto, alíquota e dedução da 6ª) ou contínua com a 5ª. Exigir continuidade na 6ª
// recusaria a tabela oficial; conferir contra a semente pega o dígito trocado ali também.
export function validarTabela(t, sementes = TABELAS_SIMPLES) {
  const nao = (motivo, faixa) => ({ok: false, motivo, ...(faixa ? {faixa} : {})});
  if (!t || typeof t !== 'object') return nao('Tabela vazia.');
  if (typeof t.anexo !== 'string' || !/^[IVXL]{1,6}$/.test(t.anexo)) return nao('Anexo inválido (ex.: "III").');
  if (!diaValido(t.desde)) return nao('Informe o início da vigência (AAAA-MM-DD).');
  if (t.ate !== null && t.ate !== undefined && (!diaValido(t.ate) || t.ate < t.desde)) return nao('O fim da vigência precisa ser uma data depois do início.');
  if (!limpo(t.fonte)) return nao('Informe a fonte da tabela (a norma).');
  const fx = t.faixas;
  if (!Array.isArray(fx) || fx.length !== 6) return nao('A tabela precisa de exatamente 6 faixas.');
  for (let k = 0; k < 6; k++) {
    const f = fx[k] || {}, nom = decimal(f.nominal);
    if (!inteiro(f.tetoMinor, 1) || f.tetoMinor > TETO_MAXIMO) return nao(`Faixa ${k + 1}: o teto precisa ser um valor em centavos maior que zero.`, k + 1);
    if (k && f.tetoMinor <= fx[k - 1].tetoMinor) return nao(`Faixa ${k + 1}: o teto precisa ser maior que o da faixa ${k}.`, k + 1);
    if (!nom || typeof f.nominal !== 'string' || nom.n > 40n * nom.d) return nao(`Faixa ${k + 1}: a alíquota nominal precisa ser um texto de 0 a 40, com até 2 casas (ex.: "11.20").`, k + 1);
    if (!inteiro(f.deduzirMinor) || f.deduzirMinor > TETO_MAXIMO) return nao(`Faixa ${k + 1}: a parcela a deduzir precisa ser um valor inteiro em centavos, sem sinal.`, k + 1);
  }
  if (fx[0].deduzirMinor !== 0) return nao('Faixa 1: a primeira faixa não tem parcela a deduzir.', 1);
  for (let k = 0; k < 4; k++)
    if (!iguais(noTeto(fx[k], fx[k].tetoMinor), noTeto(fx[k + 1], fx[k].tetoMinor)))
      return nao(`A faixa ${k + 2} não continua a faixa ${k + 1} em ${reaisCurtos(fx[k].tetoMinor)}: confira a alíquota e a parcela a deduzir.`, k + 2);
  const sexta = fx[5], quinta = fx[4];
  const continua = iguais(noTeto(quinta, quinta.tetoMinor), noTeto(sexta, quinta.tetoMinor));
  const daLei = (sementes || []).some(s => s.anexo === t.anexo && s.faixas[4].tetoMinor === quinta.tetoMinor && s.faixas[5].tetoMinor === sexta.tetoMinor
    && s.faixas[5].deduzirMinor === sexta.deduzirMinor && iguais(decimal(s.faixas[5].nominal), decimal(sexta.nominal)));
  if (!continua && !daLei) return nao('A 6ª faixa não confere com a da lei (LC 155/2016) nem continua a 5ª: confira os números.', 6);
  return {ok: true};
}

// A tabela do anexo vigente no 1º dia da competência. extras = tabelas cadastradas pelo diário (F3-3): valem por cima
// das do código; entre as vigentes ganha a de início mais recente e, no empate, a cadastrada depois. Tabela inválida é
// ignorada. Sem tabela vigente → {erro}: nunca se estima com a tabela de outro período.
export function tabelaVigente(anexo, competencia, extras = []) {
  if (!mesValido(competencia)) return {erro: 'Competência inválida (use AAAA-MM).', codigo: 'invalido'};
  const dia = competencia + '-01';
  let melhor = null;
  for (const t of [...TABELAS_SIMPLES, ...(Array.isArray(extras) ? extras : [])]) {
    if (!t || t.anexo !== anexo || !(t.desde <= dia && (t.ate === null || t.ate === undefined || t.ate >= dia)) || !validarTabela(t).ok) continue;
    if (!melhor || t.desde >= melhor.desde) melhor = t;
  }
  return melhor || {erro: `Ainda não há tabela do Simples (Anexo ${String(anexo)}) para ${mesAno(competencia)} com fonte: a estimativa para até alguém cadastrar a tabela nova.`, codigo: 'a_cadastrar'};
}

// ── receita e folha dos 12 meses (RBT12) ─────────────────────────────────────────────────────────────────────────
// Soma dos 12 meses anteriores à competência (o próprio mês não entra). Início de atividade (Res. CGSN 140/2018,
// art. 22, §§ 2º a 4º; para a folha, art. 26, § 4º): no 1º mês, o valor do próprio mês × 12; do 2º ao 12º, a média dos
// meses desde o início (anteriores à competência) × 12, com um arredondamento só. Mês sem lançamento conta zero e vai
// para "faltando" (nunca se inventa). É a regra de 2026; a Res. CGSN 190/2026 muda as janelas a partir de 01/01/2027.
function acumulado12(lista, campo, competencia, inicioAtividade, nome) {
  if (!mesValido(competencia)) return {erro: 'Competência inválida (use AAAA-MM).', codigo: 'invalido'};
  const inicio = inicioAtividade || null;
  if (inicio !== null && !mesValido(inicio)) return {erro: 'Início de atividade inválido (use AAAA-MM).', codigo: 'invalido'};
  if (inicio && competencia < inicio) return {erro: `${maiuscula(mesAno(competencia))} é antes do início da atividade (${mesAno(inicio)}).`, codigo: 'invalido'};
  const porMes = new Map();
  for (const r of Array.isArray(lista) ? lista : []) {
    if (!r || !mesValido(r.competencia) || !inteiro(r[campo])) return {erro: `Valor inválido na lista de ${nome} (${r && typeof r.competencia === 'string' ? r.competencia : 'sem competência'}).`, codigo: 'invalido'};
    porMes.set(r.competencia, (porMes.get(r.competencia) || 0n) + BigInt(r[campo]));
  }
  const soma = (de, n) => { let s = 0n; const faltando = []; for (let k = 0; k < n; k++) { const m = somarMeses(de, k); if (porMes.has(m)) s += porMes.get(m); else faltando.push(m); } return {s, faltando}; };
  const Nome = maiuscula(nome);
  const decorridos = inicio ? mesesEntre(inicio, competencia) : Infinity;
  if (decorridos === 0) {
    const {s, faltando} = soma(competencia, 1), v = s * 12n;
    return {valorMinor: numero(v), meses: 1, proporcional: true, faltando, de: competencia, ate: competencia,
      regra: 'Primeiro mês de atividade: o valor do próprio mês × 12 (Res. CGSN 140/2018, art. 22, § 2º).',
      texto: `${Nome} de ${mesCurto(competencia)} ${reais(numero(s))} × 12 = ${reais(numero(v))}`};
  }
  if (decorridos < 12) {
    const {s, faltando} = soma(inicio, decorridos), v = arred(s * 12n, BigInt(decorridos));
    return {valorMinor: numero(v), meses: decorridos, proporcional: true, faltando, de: inicio, ate: somarMeses(competencia, -1),
      regra: `Início de atividade: média dos ${decorridos} ${decorridos === 1 ? 'mês' : 'meses'} desde ${mesCurto(inicio)} × 12 (Res. CGSN 140/2018, art. 22, § 3º).`,
      texto: `${Nome} de ${mesCurto(inicio)} a ${mesCurto(somarMeses(competencia, -1))} ${reais(numero(s))} ÷ ${decorridos} × 12 = ${reais(numero(v))}`};
  }
  const de = somarMeses(competencia, -12), {s, faltando} = soma(de, 12);
  return {valorMinor: numero(s), meses: 12, proporcional: false, faltando, de, ate: somarMeses(competencia, -1),
    regra: 'Soma dos 12 meses anteriores à competência (LC 123/2006, art. 18, § 1º).',
    texto: `${Nome} de ${mesCurto(de)} a ${mesCurto(somarMeses(competencia, -1))} = ${reais(numero(s))}`};
}
// receitas = [{competencia, brutoMinor}] (bruto já sem cancelamentos; vários canais no mesmo mês se somam)
export function rbt12(receitas, competencia, inicioAtividade = null) {
  const r = acumulado12(receitas, 'brutoMinor', competencia, inicioAtividade, 'receita');
  if (r.erro) return r;
  const {valorMinor, ...resto} = r;
  return {rbt12Minor: valorMinor, ...resto};
}
// folhas = [{competencia, valorMinor}] (folha do art. 26, § 1º: remunerações e pró-labore com encargos; mesma regra de início)
export function folha12(folhas, competencia, inicioAtividade = null) {
  const r = acumulado12(folhas, 'valorMinor', competencia, inicioAtividade, 'folha');
  if (r.erro) return r;
  const {valorMinor, ...resto} = r;
  return {folha12Minor: valorMinor, ...resto};
}

// ── fator R ──────────────────────────────────────────────────────────────────────────────────────────────────────
// fator R = folha ÷ receita dos 12 meses (Res. CGSN 140/2018, art. 26). Anexo III se folha × 100 ≥ receita × 28 (conta
// exata, sem arredondar); senão, Anexo V. Com zero vale o art. 26, §§ 6º e 7º: sem folha, 0,01 (Anexo V, com ou sem
// receita); com folha e sem receita, 0,28 (Anexo III). O bp é só para mostrar e nunca diz 28% para quem não chegou lá
// (27,996% aparece como 27,99%). A folha é a do art. 26, § 1º (remunerações e pró-labore, com encargos): quem soma é a F3-3.
export function fatorR(folha12Minor, rbt12Minor) {
  if (!inteiro(folha12Minor) || !inteiro(rbt12Minor)) return {erro: 'Folha ou receita dos 12 meses inválida.', codigo: 'invalido'};
  const F = BigInt(folha12Minor), R = BigInt(rbt12Minor), L = LIMITE_FATOR_R * 100;
  let bp, atinge;
  if (F === 0n) { bp = 100; atinge = false; }          // art. 26, § 6º, II e § 7º, I e IV: 0,01
  else if (R === 0n) { bp = L; atinge = true; }        // art. 26, § 6º, I e § 7º, II: 0,28
  else {
    atinge = F * 100n >= R * BigInt(LIMITE_FATOR_R);
    const b = arred(F * 10000n, R);
    bp = numero(b > 10000000n ? 10000000n : b);
    if (!atinge && bp >= L) bp = L - 1;
  }
  const anexo = atinge ? 'III' : 'V';
  return {bp, atinge, anexo, limiteBp: L, porRegra: F === 0n || R === 0n,
    texto: F === 0n ? 'Sem folha nos 12 meses, o fator R é 1% pela regra (Res. CGSN 140/2018, art. 26): Anexo V'
      : R === 0n ? 'Com folha e sem receita nos 12 meses, o fator R é 28% pela regra (Res. CGSN 140/2018, art. 26): Anexo III'
      : `Fator R = folha dos 12 meses ${reais(folha12Minor)} ÷ receita dos 12 meses ${reais(rbt12Minor)} = ${porcento(bp, true)}: Anexo ${anexo}`};
}
export function anexoPeloFatorR(folha12Minor, rbt12Minor) { const f = fatorR(folha12Minor, rbt12Minor); return f.erro ? null : f.anexo; }

// A menor folha de 12 meses que chega a 28%: arredonda para cima, porque é um piso (com 1 centavo a menos não chega).
// Sem receita, qualquer folha acima de zero já dá 0,28 (art. 26, § 7º, II): o piso é 1 centavo.
export function folhaPara28(rbt12Minor, folha12Minor = null) {
  if (!inteiro(rbt12Minor) || (folha12Minor !== null && !inteiro(folha12Minor))) return {erro: 'Folha ou receita dos 12 meses inválida.', codigo: 'invalido'};
  const R = BigInt(rbt12Minor), L = BigInt(LIMITE_FATOR_R);
  const folhaMinor = R === 0n ? 1 : numero((R * L + 99n) / 100n);
  if (folha12Minor === null) return {folhaMinor, faltaMinor: null, texto: `Para chegar a 28%, a folha dos 12 meses precisaria somar ${reais(folhaMinor)}.`};
  const faltaMinor = Math.max(0, folhaMinor - folha12Minor);
  return {folhaMinor, faltaMinor, texto: faltaMinor > 0
    ? `Para chegar a 28%, a folha dos 12 meses precisaria somar ${reais(folhaMinor)}; hoje soma ${reais(folha12Minor)}.`
    : `A folha dos 12 meses (${reais(folha12Minor)}) já chega a 28% da receita (o mínimo é ${reais(folhaMinor)}).`};
}

// ── faixa, alíquota efetiva e DAS (F8) ───────────────────────────────────────────────────────────────────────────
// "Faixa 2: de R$ 180 mil a R$ 360 mil de receita em 12 meses"
export function textoFaixa(tabela, faixa) {
  const fx = tabela && tabela.faixas, k = faixa - 1;
  if (!Array.isArray(fx) || !fx[k]) return '';
  return k === 0 ? `Faixa 1: até ${reaisCurtos(fx[0].tetoMinor)} de receita em 12 meses`
    : `Faixa ${faixa}: de ${reaisCurtos(fx[k - 1].tetoMinor)} a ${reaisCurtos(fx[k].tetoMinor)} de receita em 12 meses`;
}

// efetiva = (RBT12 × nominal − dedução) ÷ RBT12, como fração exata num/den (reduzida); bp só para mostrar.
// RBT12 = 0 → a nominal da 1ª faixa; acima do teto da 6ª → fora do Simples.
export function efetiva(tabela, rbt12Minor) {
  const v = validarTabela(tabela);
  if (!v.ok) return {erro: 'Tabela do Simples inválida: ' + v.motivo, codigo: 'invalido'};
  if (!inteiro(rbt12Minor)) return {erro: 'Receita dos 12 meses inválida.', codigo: 'invalido'};
  const fx = tabela.faixas, R = BigInt(rbt12Minor);
  const k = fx.findIndex(f => rbt12Minor <= f.tetoMinor);
  if (k < 0) return {erro: `Receita dos últimos 12 meses acima de ${reaisCurtos(fx[5].tetoMinor)}: fora do Simples.`, codigo: 'fora_do_simples', foraDoSimples: true};
  const f = fx[k], nom = decimal(f.nominal), D = BigInt(f.deduzirMinor);
  let num = R === 0n ? nom.n : R * nom.n - D * nom.d * 100n, den = R === 0n ? nom.d * 100n : R * nom.d * 100n;
  const g = mdc(num, den); num /= g; den /= g;
  const bp = numero(arred(num * 10000n, den));
  const intermediario = R === 0n ? null : numero(arred(R * nom.n - D * nom.d * 100n, nom.d * 100n));   // só para o texto
  return {anexo: tabela.anexo, tabelaId: tabela.id || null, estado: tabela.estado || null, fonte: tabela.fonte, rbt12Minor,
    faixa: k + 1, nominal: f.nominal, nominalTexto: decimalTexto(f.nominal), deduzirMinor: f.deduzirMinor,
    pisoMinor: k ? fx[k - 1].tetoMinor : 0, tetoMinor: f.tetoMinor, num: numero(num), den: numero(den), bp,
    texto: R === 0n ? `Sem receita nos últimos 12 meses: vale a alíquota nominal da faixa 1, ${decimalTexto(f.nominal)}.`
      : `Receita dos últimos 12 meses ${reais(rbt12Minor)} × ${decimalTexto(f.nominal)} − ${reais(f.deduzirMinor)} = ${reais(intermediario)}; ÷ ${reais(rbt12Minor)} = ${porcento(bp)}`,
    textoFaixa: textoFaixa(tabela, k + 1), aviso: k === 5 ? TEXTOS.sextaFaixa : null};
}

// DAS = arred(base × efetiva exata): o arredondamento é um só, no fim (nunca sobre a alíquota de 2 casas).
// explica segue o "Ver a conta" ({formula, termos, resultado}); aqui um termo é multiplicação (op '×') e traz pct e conta.
export function dasEstimado(baseMinor, tabela, rbt12Minor) {
  if (!inteiro(baseMinor)) return {erro: 'Receita do mês inválida.', codigo: 'invalido'};
  const e = efetiva(tabela, rbt12Minor);
  if (e.erro) return e;
  const dasMinor = numero(arred(BigInt(baseMinor) * BigInt(e.num), BigInt(e.den)));
  const texto = `${reais(baseMinor)} × ${porcento(e.bp)} = ${reais(dasMinor)}`;
  return {dasMinor, baseMinor, efetiva: e, texto, explica: {
    formula: 'DAS = receita do mês × alíquota efetiva',
    termos: [
      {rotulo: 'Receita do mês (base do DAS)', brl: baseMinor, op: '+'},
      {rotulo: `Alíquota efetiva (Anexo ${e.anexo}, faixa ${e.faixa})`, brl: null, pct: porcento(e.bp), bp: e.bp, op: '×', conta: e.texto},
    ],
    resultado: dasMinor, texto,
    nota: 'A alíquota aparece com 2 casas; o DAS usa a conta exata e arredonda uma vez só, no fim.'}};
}

// ── Lucro Presumido (estimativa anual para comparar; vale até 31/12/2026) ─────────────────────────────────────────
export const PRESUMIDO = congelar({
  presuncao: '32', irpj: '15', adicional: '10', adicionalLimiteAnualMinor: 24000000, csll: '9', pis: '0.65', cofins: '3', cpp: '20',
  issMin: '2', issMax: '5', ate: '2026-12', estado: 'a_confirmar',
  fonte: 'Lei 9.249/1995, arts. 15 e 20 (presunção de 32% em serviços); Lei 9.430/1996 (adicional de 10% do IRPJ); Lei 7.689/1988 (CSLL 9%); Lei 9.718/1998 (PIS 0,65% e Cofins 3% cumulativos, extintos em 2027 pela LC 214/2025); Lei 8.212/1991, art. 22 (INSS patronal de 20% sobre o pró-labore); LC 116/2003 (ISS de 2% a 5%)',
});
// receita anual = RBT12; folha anual = pró-labore dos 12 meses; issPct em texto ("2" ou "2.00"). Cada tributo é um valor
// arredondado uma vez a partir da conta exata; o total é a soma deles (as partes fecham com o total).
export function presumidoAnual({rbt12: receita, folha12: folha, issPct, competencia = null} = {}) {
  if (!inteiro(receita) || !inteiro(folha)) return {erro: 'Receita ou folha dos 12 meses inválida.', codigo: 'invalido'};
  if (competencia !== null && !mesValido(competencia)) return {erro: 'Competência inválida (use AAAA-MM).', codigo: 'invalido'};
  if (competencia !== null && competencia > PRESUMIDO.ate) return {erro: 'Em 2027 o Presumido muda com a reforma (CBS no lugar de PIS e Cofins): a estimativa para em dezembro de 2026.', codigo: 'a_cadastrar'};
  const iss = decimal(issPct), P = k => decimal(PRESUMIDO[k]);
  if (!iss || iss.n * P('issMin').d < P('issMin').n * iss.d || iss.n * P('issMax').d > P('issMax').n * iss.d) return {erro: 'ISS do município precisa ficar entre 2% e 5%.', codigo: 'invalido'};
  const R = BigInt(receita), F = BigInt(folha), pr = P('presuncao'), cem = 100n;
  const sobre = (base, p) => numero(arred(base * p.n, p.d * cem));                            // p% × base
  const sobrePresumido = p => numero(arred(R * pr.n * p.n, pr.d * cem * p.d * cem));          // p% × 32% × receita
  const excesso = R * pr.n - BigInt(PRESUMIDO.adicionalLimiteAnualMinor) * pr.d * cem;       // (32% × receita − R$ 240 mil) × pr.d × 100
  const ad = P('adicional'), presumidoMinor = numero(arred(R * pr.n, pr.d * cem));
  const txt = k => decimalTexto(PRESUMIDO[k]);
  const itens = [
    {id: 'irpj', rotulo: 'IRPJ', valorMinor: sobrePresumido(P('irpj')), conta: `${txt('irpj')} × ${txt('presuncao')} × ${reais(receita)}`},
    {id: 'irpj_adicional', rotulo: 'Adicional do IRPJ', valorMinor: excesso > 0n ? numero(arred(excesso * ad.n, pr.d * cem * ad.d * cem)) : 0,
      conta: excesso > 0n ? `${txt('adicional')} × (lucro presumido ${reais(presumidoMinor)} − ${reais(PRESUMIDO.adicionalLimiteAnualMinor)})`
        : `Lucro presumido de ${reais(presumidoMinor)} não passa de ${reaisCurtos(PRESUMIDO.adicionalLimiteAnualMinor)} no ano: sem adicional`},
    {id: 'csll', rotulo: 'CSLL', valorMinor: sobrePresumido(P('csll')), conta: `${txt('csll')} × ${txt('presuncao')} × ${reais(receita)}`},
    {id: 'pis', rotulo: 'PIS', valorMinor: sobre(R, P('pis')), conta: `${txt('pis')} × ${reais(receita)}`},
    {id: 'cofins', rotulo: 'Cofins', valorMinor: sobre(R, P('cofins')), conta: `${txt('cofins')} × ${reais(receita)}`},
    {id: 'iss', rotulo: 'ISS', valorMinor: sobre(R, iss), conta: `${decimalTexto(String(issPct).trim().replace(',', '.'))} × ${reais(receita)}`},
    {id: 'cpp', rotulo: 'INSS patronal sobre o pró-labore', valorMinor: sobre(F, P('cpp')), conta: `${txt('cpp')} × ${reais(folha)}`},
  ];
  const totalMinor = itens.reduce((a, i) => a + i.valorMinor, 0);
  return {totalMinor, rbt12Minor: receita, folha12Minor: folha, presumidoMinor, itens, estado: PRESUMIDO.estado, fonte: PRESUMIDO.fonte,
    cargaBp: receita > 0 ? numero(arred(BigInt(totalMinor) * 10000n, R)) : null,
    aviso: receita > 500000000 ? 'Acima de R$ 5 milhões no ano a presunção sobe (LC 224/2025, em discussão no STF): esta estimativa não cobre.' : null,
    explica: {formula: 'Lucro Presumido no ano = IRPJ + adicional + CSLL + PIS + Cofins + ISS + INSS patronal', resultado: totalMinor,
      termos: itens.map(i => ({rotulo: i.rotulo, brl: i.valorMinor, op: '+', conta: i.conta}))}};
}

// Simples Anexo III × Anexo V × Presumido, no ano, com a mesma receita e a mesma folha. "aplicavel" marca o anexo que o
// fator R dá hoje; o outro é hipótese. Nenhum texto recomenda regime.
export function comparar({rbt12: receita, folha12: folha, issPct, competencia, extras = []} = {}) {
  if (!inteiro(receita) || !inteiro(folha)) return {erro: 'Receita ou folha dos 12 meses inválida.', codigo: 'invalido'};
  if (!mesValido(competencia)) return {erro: 'Informe a competência (AAAA-MM) para escolher a tabela vigente.', codigo: 'invalido'};
  const fr = fatorR(folha, receita), para28 = folhaPara28(receita, folha);
  const simples = anexo => {
    const base = {id: 'simples_' + anexo.toLowerCase(), regime: 'simples', anexo, rotulo: `Simples · Anexo ${anexo}`, aplicavel: fr.anexo === anexo};
    const t = tabelaVigente(anexo, competencia, extras);
    if (t.erro) return {...base, erro: t.erro, codigo: t.codigo};
    const d = dasEstimado(receita, t, receita);
    if (d.erro) return {...base, erro: d.erro, codigo: d.codigo};
    return {...base, totalMinor: d.dasMinor, cargaBp: d.efetiva.bp, efetiva: d.efetiva,
      nota: base.aplicavel ? `É o anexo de hoje (fator R ${porcento(fr.bp, true)}).` : anexo === 'III' ? `Valeria com fator R de 28% ou mais. ${para28.texto}` : 'Valeria com fator R abaixo de 28%.',
      explica: {formula: 'Simples no ano = receita dos 12 meses × alíquota efetiva', resultado: d.dasMinor,
        termos: [{rotulo: 'Receita dos 12 meses', brl: receita, op: '+'}, {rotulo: `Alíquota efetiva (Anexo ${anexo}, faixa ${d.efetiva.faixa})`, brl: null, pct: porcento(d.efetiva.bp), bp: d.efetiva.bp, op: '×', conta: d.efetiva.texto}]}};
  };
  const p = presumidoAnual({rbt12: receita, folha12: folha, issPct, competencia});
  const presumido = p.erro ? {id: 'presumido', regime: 'presumido', rotulo: 'Lucro Presumido', aplicavel: null, erro: p.erro, codigo: p.codigo}
    : {id: 'presumido', regime: 'presumido', rotulo: 'Lucro Presumido', aplicavel: null, totalMinor: p.totalMinor, cargaBp: p.cargaBp, itens: p.itens, explica: p.explica, aviso: p.aviso};
  return {competencia, rbt12Minor: receita, folha12Minor: folha, fatorR: fr, folhaPara28: para28, itens: [simples('III'), simples('V'), presumido], aviso: TEXTOS.informa};
}

// ── calendário: feriados bancários nacionais, obrigações e ocorrências ────────────────────────────────────────────
// Páscoa pelo algoritmo anônimo gregoriano (Meeus/Jones/Butcher).
export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), x = h + l - 7 * m + 114;
  return `${ano}-${pad(Math.floor(x / 31))}-${pad(x % 31 + 1)}`;
}
// Fixos nacionais (Leis 662/1949, 6.802/1980 e 14.759/2023, que criou o 20/11 a partir de 2024) e, pela Páscoa, a
// Sexta-feira Santa; Carnaval (segunda e terça), Corpus Christi e 31/12 não são feriados nacionais, mas não têm
// expediente bancário. Municipais ficam de fora (a tela avisa: TEXTOS.municipais).
const FIXOS = [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência'],
  ['10-12', 'Nossa Senhora Aparecida', 1980], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Dia da Consciência Negra', 2024], ['12-25', 'Natal']];
const memoFeriados = new Map();
function feriadosDoAno(ano) {
  if (!memoFeriados.has(ano)) {
    const p = pascoa(ano), lista = [];
    for (const [md, nome, desde] of FIXOS) if (!desde || ano >= desde) lista.push({data: `${ano}-${md}`, nome, tipo: 'nacional'});
    lista.push({data: somarDias(p, -48), nome: 'Carnaval', tipo: 'bancario'}, {data: somarDias(p, -47), nome: 'Carnaval', tipo: 'bancario'},
      {data: somarDias(p, -2), nome: 'Sexta-feira Santa', tipo: 'nacional'}, {data: somarDias(p, 60), nome: 'Corpus Christi', tipo: 'bancario'},
      {data: `${ano}-12-31`, nome: 'fim de ano', tipo: 'bancario'});
    lista.sort((x, y) => x.data < y.data ? -1 : x.data > y.data ? 1 : 0);
    memoFeriados.set(ano, {lista: congelar(lista), porData: new Map(lista.map(f => [f.data, f]))});
  }
  return memoFeriados.get(ano);
}
export function feriadosBancarios(ano) {
  if (!Number.isInteger(ano) || ano < 1900 || ano > 2199) return [];
  return feriadosDoAno(ano).lista.map(f => ({...f}));
}
const feriadoNoDia = data => feriadosDoAno(+data.slice(0, 4)).porData.get(data) || null;
export function diaUtil(data) {
  if (!diaValido(data)) return false;
  const s = diaDaSemana(data);
  return s !== 0 && s !== 6 && !feriadoNoDia(data);
}
// "20/11 é feriado nacional" · "16/02 não tem expediente bancário (Carnaval)" · "20/12 é domingo"
export function motivoNaoUtil(data) {
  if (!diaValido(data) || diaUtil(data)) return null;
  const f = feriadoNoDia(data);
  if (f) return f.tipo === 'nacional' ? `${dataBR(data)} é feriado nacional` : `${dataBR(data)} não tem expediente bancário (${f.nome})`;
  return `${dataBR(data)} é ${diaDaSemana(data) === 0 ? 'domingo' : 'sábado'}`;
}
export const MODOS_DIA_NAO_UTIL = ['prorroga', 'antecipa', 'nenhum'];
// prorroga: o dia útil seguinte; antecipa: o dia útil anterior; nenhum: fica no dia
export function ajustarDia(data, modo) {
  if (!diaValido(data) || modo === 'nenhum' || !MODOS_DIA_NAO_UTIL.includes(modo)) return data;
  let d = data;
  for (let guarda = 0; !diaUtil(d) && guarda < 20; guarda++) d = somarDias(d, modo === 'antecipa' ? -1 : 1);
  return d;
}

// Obrigações padrão (semente em código do §4.2 obligations; a F3-3 acrescenta outras pelo diário). regra: 'mensal:D',
// 'anual:MM-DD' ou 'data:AAAA-MM-DD'; referente: a que a ocorrência se refere (o DAS de 20/11 é o de outubro).
// Prazos e regras de dia não útil vieram da pesquisa de 19/10/2026: aConfirmar até o contador confirmar.
export const OBRIGACOES_PADRAO = congelar([
  {id: 'das', titulo: 'DAS', nota: 'Pagar o DAS do Simples: a guia única dos impostos sobre a receita do mês anterior.',
    regra: 'mensal:20', referente: 'mes_anterior', diaNaoUtil: 'prorroga', aConfirmar: true,
    fonte: 'Res. CGSN 140/2018, art. 40, caput e § 3º (dia 20 do mês seguinte; sem expediente bancário, no dia útil seguinte)'},
  {id: 'pgdas-d', titulo: 'PGDAS-D', nota: 'Declarar no PGDAS-D a receita do mês anterior: é dele que sai o DAS.',
    regra: 'mensal:20', referente: 'mes_anterior', diaNaoUtil: 'prorroga', aConfirmar: true,
    fonte: 'Res. CGSN 140/2018, art. 38, § 2º, II (até o vencimento do DAS)'},
  {id: 'defis', titulo: 'DEFIS', nota: 'Entregar a DEFIS, a declaração anual do Simples, do ano anterior. A Res. CGSN 190/2026 revoga esta regra a partir de 2027: confirme com o contador se ela ainda vale.',
    regra: 'anual:03-31', referente: 'ano_anterior', diaNaoUtil: 'nenhum', aConfirmar: true,
    fonte: 'Res. CGSN 140/2018, art. 72, § 1º (até 31 de março do ano seguinte)'},
  {id: 'fechamento', titulo: 'Fechamento', nota: 'Fechar no portal o mês que terminou: conferir, fechar e mandar o pacote ao contador.',
    regra: 'mensal:5', referente: 'mes_anterior', diaNaoUtil: 'nenhum', aConfirmar: true,
    fonte: 'Combinado das sócias (D8 do plano do portal: fechar até o dia 5)'},
  {id: 'opcao-ibs-cbs', titulo: 'Último dia para optar por IBS e CBS fora do DAS', nota: 'Opção para o 1º semestre de 2027; a desistência vai de 03/11 a 20/12/2026.',
    regra: 'data:2026-10-30', referente: null, diaNaoUtil: 'nenhum', aConfirmar: true,
    fonte: 'Res. CGSN 194/2026, que alterou a Res. CGSN 186/2026'},
  {id: 'nfse-nacional', titulo: 'NFS-e nacional obrigatória', nota: 'A nota fiscal de serviço do Simples passa a sair pelo emissor nacional (NFS-e).',
    regra: 'data:2026-11-01', referente: null, diaNaoUtil: 'nenhum', aConfirmar: true,
    fonte: 'Res. CGSN 191/2026'},
  {id: 'reforma-2027', titulo: 'Reforma tributária: CBS cheia e novos anexos do Simples', nota: 'PIS e Cofins acabam; o Simples passa a usar os anexos novos (a tabela de 2027 precisa ser cadastrada).',
    regra: 'data:2027-01-01', referente: null, diaNaoUtil: 'nenhum', aConfirmar: false,
    fonte: 'LC 214/2025, art. 519'},
]);

export function validarRegra(regra) {
  if (typeof regra !== 'string') return false;
  let m = /^mensal:(\d{1,2})$/.exec(regra);
  if (m) return +m[1] >= 1 && +m[1] <= 31;
  m = /^anual:(\d{2})-(\d{2})$/.exec(regra);
  if (m) return diaValido(`2024-${m[1]}-${m[2]}`);   // 2024 é bissexto: 02-29 vale (cai em 28/02 nos outros anos)
  m = /^data:(\d{4}-\d{2}-\d{2})$/.exec(regra);
  return !!m && diaValido(m[1]);
}
// null quando a obrigação serve; senão, o motivo (curto, para a recusa do add_obligation da F3-3)
export function validarObrigacao(o) {
  if (!o || typeof o !== 'object') return 'Obrigação vazia.';
  if (typeof o.id !== 'string' || !/^[A-Za-z0-9][\w.-]{0,79}$/.test(o.id)) return 'Identificador da obrigação inválido.';
  if (!limpo(o.titulo, 121) || limpo(o.titulo, 121).length > 120) return 'Dê um título de até 120 letras.';
  if (!validarRegra(o.regra)) return 'Regra inválida: use mensal:20, anual:03-31 ou data:2026-10-30.';
  if (!MODOS_DIA_NAO_UTIL.includes(o.diaNaoUtil)) return 'Diga o que acontece em dia não útil: prorroga, antecipa ou nenhum.';
  if (!limpo(o.fonte)) return 'Informe a fonte do prazo (a norma ou quem combinou).';
  const tipo = o.regra.split(':')[0];
  if (o.referente !== undefined && o.referente !== null && !((o.referente === 'mes_anterior' && tipo === 'mensal') || (o.referente === 'ano_anterior' && tipo === 'anual')))
    return 'Referente inválido: mes_anterior (regra mensal) ou ano_anterior (regra anual).';
  return null;
}

function ocorrencia(o, nominal) {
  const tipo = o.regra.split(':')[0], data = ajustarDia(nominal, o.diaNaoUtil), motivo = motivoNaoUtil(nominal);
  const referente = o.referente === 'mes_anterior' ? somarMeses(nominal.slice(0, 7), -1) : o.referente === 'ano_anterior' ? String(+nominal.slice(0, 4) - 1) : null;
  const titulo = limpo(o.titulo, 120);
  const resumo = !referente ? titulo : o.referente === 'mes_anterior' ? `${titulo} de ${nomeMes(referente)}` : `${titulo} de ${referente}`;
  const ajustada = data !== nominal;
  const texto = (tipo === 'data' ? `${resumo} · ${dataCompleta(data)}` : `${resumo} · vence ${dataBR(data)}`) + (ajustada ? ` (${motivo})` : '');
  return {uid: `${o.id}-${nominal}@orquestrator-financas`, id: o.id, tipo, titulo, resumo, data, nominal, ajustada, naoUtil: !!motivo, motivo,
    diaNaoUtil: o.diaNaoUtil, referente, nota: limpo(o.nota || '', 240), fonte: limpo(o.fonte), aConfirmar: o.aConfirmar !== false, texto};
}
// As ocorrências de uma obrigação com vencimento (já ajustado ao dia útil) entre de e ate, inclusive. O uid usa a data
// nominal da regra: muda a regra de dia não útil e o evento do calendário é o mesmo (atualiza em vez de duplicar).
export function ocorrencias(obrigacao, de, ate) {
  if (validarObrigacao(obrigacao) || !diaValido(de) || !diaValido(ate) || de > ate) return [];
  const [tipo, arg] = obrigacao.regra.split(':');
  const ini = somarDias(de, -20), fim = somarDias(ate, 20);   // folga: um prazo nominal fora da janela pode cair nela depois do ajuste
  const nominais = [];
  if (tipo === 'data') nominais.push(arg);
  if (tipo === 'mensal') for (let m = ini.slice(0, 7); m <= fim.slice(0, 7); m = somarMeses(m, 1)) nominais.push(`${m}-${pad(Math.min(+arg, ultimoDia(m)))}`);
  if (tipo === 'anual') for (let a = +ini.slice(0, 4); a <= +fim.slice(0, 4); a++) {
    const [mm, dd] = arg.split('-'), mes = `${a}-${mm}`;
    nominais.push(`${mes}-${pad(Math.min(+dd, ultimoDia(mes)))}`);
  }
  return nominais.map(n => ocorrencia(obrigacao, n)).filter(x => x.data >= de && x.data <= ate);
}
// A ocorrência que vence pela competência (mensal: 'AAAA-MM') ou pelo ano (anual: 'AAAA'); ex.: o DAS de 2026-10.
export function vencimento(obrigacao, referente) {
  if (validarObrigacao(obrigacao)) return null;
  const [tipo, arg] = obrigacao.regra.split(':');
  if (tipo === 'mensal' && mesValido(referente)) {
    const mes = obrigacao.referente === 'mes_anterior' ? somarMeses(referente, 1) : referente;
    return ocorrencia(obrigacao, `${mes}-${pad(Math.min(+arg, ultimoDia(mes)))}`);
  }
  if (tipo === 'anual' && /^\d{4}$/.test(String(referente))) {
    const mes = `${obrigacao.referente === 'ano_anterior' ? +referente + 1 : +referente}-${arg.slice(0, 2)}`;
    return ocorrencia(obrigacao, `${mes}-${pad(Math.min(+arg.slice(3), ultimoDia(mes)))}`);
  }
  return null;
}
// Os próximos N meses (12 por padrão) de todas as obrigações, a partir de "de", em ordem de data (e de id no empate).
export function calendario(de, {obrigacoes = OBRIGACOES_PADRAO, meses = 12} = {}) {
  if (!diaValido(de) || !inteiro(meses, 1)) return [];
  const alvo = somarMeses(de.slice(0, 7), meses), ate = somarDias(`${alvo}-${pad(Math.min(+de.slice(8), ultimoDia(alvo)))}`, -1);
  return (Array.isArray(obrigacoes) ? obrigacoes : []).flatMap(o => ocorrencias(o, de, ate))
    .sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// ── .ics (RFC 5545) ──────────────────────────────────────────────────────────────────────────────────────────────
// Eventos de dia inteiro, um por ocorrência (já expandidas: sem RRULE, que o ajuste de dia útil quebraria), UID estável,
// DTSTAMP do parâmetro agora (texto idêntico a cada geração), alarme 2 dias antes às 9h, textos escapados, CRLF e linhas
// dobradas em 75 octetos UTF-8 sem partir um caractere nem um escape.
const escapar = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n').replace(/[\u0000-\u001f\u007f]/g, ' ');
const octetos = u => u.length === 2 && u[0] === '\\' ? 2 : (c => c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4)(u.codePointAt(0));
function dobrar(linha) {
  const partes = [];
  let atual = '', bytes = 0;
  for (const u of linha.match(/\\[\s\S]|[\s\S]/gu) || []) {
    const b = octetos(u);
    if (bytes + b > 75) { partes.push(atual); atual = ' '; bytes = 1; }
    atual += u; bytes += b;
  }
  partes.push(atual);
  return partes.join('\r\n');
}
function carimbo(agora) {
  const t = agora instanceof Date ? agora.getTime() : typeof agora === 'string' ? Date.parse(agora) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') : null;   // 20261019T120000Z
}
function descricao(o) {
  const linhas = [];
  if (o.nota) linhas.push(o.nota);
  linhas.push(o.tipo === 'data' ? `Data: ${dataCompleta(o.data)}.` : `Vence em ${dataCompleta(o.data)}.`);
  if (o.ajustada) linhas.push(`${o.motivo}: a regra é ${o.diaNaoUtil === 'antecipa' ? 'antecipar para o dia útil anterior' : 'passar para o dia útil seguinte'}.`);
  linhas.push(`Fonte: ${o.fonte.replace(/\.$/, '')}.`, TEXTOS.confirmar);
  return linhas.join('\n');
}
export function ics(lista, {agora, nome = 'Prazos fiscais · Finanças'} = {}) {
  const stamp = carimbo(agora);
  if (!stamp) throw new TypeError('ics: informe agora (data e hora) para o DTSTAMP');
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Orquestrator//Financas//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + escapar(nome)];
  const vistos = new Set();
  for (const o of Array.isArray(lista) ? lista : []) {
    if (!o || typeof o.uid !== 'string' || !diaValido(o.data) || !o.resumo) throw new TypeError('ics: ocorrência inválida (use as de ocorrencias ou calendario)');
    if (vistos.has(o.uid)) continue;
    vistos.add(o.uid);
    linhas.push('BEGIN:VEVENT', 'UID:' + escapar(o.uid), 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + o.data.replace(/-/g, ''),
      'DTEND;VALUE=DATE:' + somarDias(o.data, 1).replace(/-/g, ''), 'SUMMARY:' + escapar(o.resumo), 'DESCRIPTION:' + escapar(descricao(o)),
      'TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapar(`${o.resumo}: faltam 2 dias`),
      'TRIGGER:-P1DT15H', 'END:VALARM', 'END:VEVENT');   // −39 h da meia-noite do dia: 2 dias antes, às 9h
  }
  linhas.push('END:VCALENDAR');
  return linhas.map(dobrar).join('\r\n') + '\r\n';
}
