// Acerto, reembolso e aporte (fatia F2-6). Na Sociedade (#sociedade-acerto, abaixo dos cartões de perfis): a barra de
// participação, o quadro de cada sócia (adiantou · parte nos divididos · saldo no acerto · a empresa deve · aportes),
// as barras do saldo, "quem paga quem" com "Registrar o Pix" e "Recebi", os reembolsos pendentes com "Reembolsar" e
// "Converter em aporte", o aporte em dinheiro e o histórico de acertos. No Meu painel (#acerto-resumo): "Você adiantou
// R$ 509,90 · a empresa te deve R$ 59,90 · no acerto você tem +R$ 135,00 a receber". No Livro do mês (extra
// 'livro-acerto'): o mesmo acerto acumulado, para as duas telas dizerem a mesma coisa. Em Lançamentos (extra
// 'gasto-acoes'): "Reembolsar" e "Converter em aporte" no lugar do antigo "Marcar reembolsado".
//
// Todo número sai de contas.acertoAcumulado (até hoje), com o "Ver a conta" feito pela mesma função; nada aqui soma o
// que a conta já somou, a não ser o "Adiantou" (dois termos da própria conta, em BigInt) e o "Ver a conta" da parte nos
// divididos (um termo por gasto, com o mesmo filtro e o mesmo rateio da conta; o fluxo confere que fecha). Toda gravação passa pelo
// diário (gravar / folha.gravar do livro.js, com a prévia do razão): record_settlement, confirm_settlement e
// convert_to_contribution. Cada sócia só vê os botões que o razão aceitaria dela. Plano: PLANO-PORTAL §5 Sociedade e
// Meu painel, §4.6 F11 e F12, D5; PLANO-FASES-2-3 F2-6. Fluxo no arnês: ferramentas/arnes/fluxos/acerto.mjs.
import {registrarPagina, registrarExtra, dados, el, botao, cartao, pilula, nomeDe, hojeDe, dataBR, horaBR, verConta, abrirFolha, campoDinheiro, campoComRotulo, gravar, irPara} from './livro.js';
import * as R from './razao.js';
import {acertoAcumulado, listaDoMes, textoPct} from './contas.js';
import {dinheiro, barra100, divergentes} from './graficos.js';

const $ = id => document.getElementById(id);
const MENOS = '−';
const comSinal = minor => (minor > 0 ? '+' : minor < 0 ? MENOS : '') + dinheiro(Math.abs(minor));
const somar = (...valores) => { const s = valores.reduce((a, v) => a + BigInt(v), 0n); if (s > BigInt(Number.MAX_SAFE_INTEGER) || s < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('valor fora do limite'); return Number(s); };
const ehResponsavel = D => ((D.c.estado.members || []).find(m => m.id === D.c.membro.id) || {}).role === 'owner';
const novoAlvo = () => 'ac-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const nome = (D, id) => id === 'empresa' ? 'a empresa' : nomeDe(D.c, id);
const listaDeNomes = nomes => nomes.length <= 1 ? (nomes[0] || '') : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];

// a conta do acerto, uma vez por redesenho (todas as partes desta tela recebem o mesmo D)
const memo = new WeakMap();
function contaDe(D) {
  let a = memo.get(D.aplicado);
  if (!a) { a = acertoAcumulado(D.c.estado, D.aplicado, D.lista, hojeDe(D.c)); memo.set(D.aplicado, a); }
  return a;
}
// "Adiantou" = o que voltou ou vai voltar para a sócia: os gastos divididos que ela pagou + os que a empresa reembolsa
// (aporte não é adiantamento: ninguém devolve, e aparece na coluna Aportes)
const adiantou = s => somar(s.pagouDividido, s.devidoGastos);
function explicaAdiantou(s) {
  return {formula: 'Adiantou = o que a sócia pagou do próprio bolso em gastos que voltam para ela: os divididos entre as sócias e os que a empresa reembolsa (aporte fica de fora: ninguém devolve)',
    termos: [{rotulo: 'Pagou nos gastos divididos', brl: s.pagouDividido, op: '+'}, {rotulo: 'Pagou em gastos que a empresa reembolsa', brl: s.devidoGastos, op: '+'}], resultado: adiantou(s), excluidos: []};
}

// ── participação: barra neutra e o aviso quando não fecha 100% ─────────────────────────────────────────────────────
const ESCALA = 10n ** 8n;
function participacao(D) {
  const membros = D.c.estado.members || [];
  const pesos = membros.map(m => typeof m.participationPct === 'number' ? R.decimal(String(m.participationPct), 8) : null);
  const emEscala = p => p.n * (ESCALA / p.d);
  const faltam = membros.filter((m, k) => !pesos[k]);
  const soma = faltam.length ? null : pesos.reduce((a, p) => a + emEscala(p), 0n);
  const fecha = soma === 100n * ESCALA;
  // milésimos para a barra: rateio exato pelo maior resto quando fecha; senão o próprio percentual (só desenho)
  const permil = fecha ? R.ratear(1000, membros.map(m => String(m.participationPct))) : pesos.map(p => p ? Number(emEscala(p) * 10n / ESCALA) : 0);
  const textoSoma = soma === null ? null : (() => { const i = soma / ESCALA, f = String(soma % ESCALA).padStart(8, '0').replace(/0+$/, ''); return String(i) + (f ? ',' + f : ''); })();
  return {membros, fecha, faltam, permil, textoSoma};
}
function cartaoParticipacao(D) {
  const P = participacao(D), eu = D.c.membro.id;
  const box = cartao('Participação', 'É ela que divide os gastos entre vocês: cada uma arca com a sua parte. Vem do cadastro da empresa.');
  box.classList.add('ac-participacao');
  if (P.membros.length) {
    const semPct = new Set(P.faltam.map(m => m.id));
    const itens = P.membros.map((m, k) => ({rotulo: m.displayName + (m.id === eu ? ' (você)' : ''), valor: null, permil: P.permil[k], destaque: m.id === eu}));
    const fig = barra100(itens, {rotulo: 'Participação: ' + P.membros.map(m => `${m.displayName} ${semPct.has(m.id) ? 'não informada' : textoPct(String(m.participationPct))}`).join(', ') + '.', neutro: true});
    // quem não informou a participação aparece como "não informada", não como 0,0% (zero seria um número que ninguém cadastrou)
    const segs = fig.querySelectorAll('.gf-seg'), linhas = fig.querySelectorAll('.gf-legenda li');
    P.membros.forEach((m, k) => {
      if (!semPct.has(m.id)) return;
      if (segs[k]) segs[k].title = `${itens[k].rotulo}: participação não informada`;
      const pct = linhas[k] && linhas[k].querySelector('.gf-leg-pct');
      if (pct) { pct.textContent = 'não informada'; linhas[k].classList.add('ac-sem-pct'); }
    });
    box.append(fig);
  }
  if (!P.fecha) {
    const av = el('p', 'notice lv-aviso ac-aviso-participacao');
    av.setAttribute('role', 'note');
    av.textContent = P.faltam.length
      ? `A participação de ${listaDeNomes(P.faltam.map(m => m.displayName))} não foi informada: o rateio fica suspenso até corrigir.`
      : `A participação cadastrada soma ${P.textoSoma}%: o rateio fica suspenso até corrigir.`;
    box.append(av, el('p', 'lv-nota', 'Enquanto isso, os gastos divididos ficam fora do acerto. A correção é feita no cadastro da empresa, fora do portal.'));
  }
  return box;
}

// ── o quadro: uma linha por sócia, cada número abre a conta dele ─────────────────────────────────────────────────────
// os gastos divididos que entram no acerto, com o mesmo filtro e o mesmo rateio do contas.acertoAcumulado (maior resto,
// parâmetros do mês fechado); os que ficam de fora vêm com o motivo. Servem ao "Ver a conta" da parte e ao "Como chegamos".
function divididos(D) {
  const {aplicado} = D, hoje = hojeDe(D.c);
  const membros = aplicado.membros || [];
  const pcts = membros.map(m => String(m.pct));
  const itens = [], fora = [];
  for (const g of aplicado.gastos || []) {
    if (g.estado === 'anulado' || g.data > hoje || g.destino !== 'dividir' || g.reembolsadoEm || R.formaDaEmpresa(g.forma) || !membros.some(m => m.id === g.pagoPor)) continue;
    const brl = R.reaisDoGasto(g, listaDoMes(aplicado, D.lista, g.competencia)).brl;
    if (brl === null) { fora.push({rotulo: g.descricao, motivo: `falta o câmbio de ${g.moeda} para ${dataBR(g.data)}`}); continue; }
    const partes = R.ratear(brl, pcts);
    if (!partes) { fora.push({rotulo: g.descricao, motivo: 'a participação das sócias não fecha 100%, então não dá para dividir'}); continue; }
    itens.push({g, brl, partes, k: membros.findIndex(m => m.id === g.pagoPor)});
  }
  return {membros, itens, fora};
}
// "Parte nos divididos" = a participação da sócia em cada gasto dividido; o total é o parteDividido da conta
function explicaParte(D, s) {
  const {membros, itens, fora} = divididos(D);
  const j = membros.findIndex(m => m.id === s.id);
  const termos = j < 0 ? [] : itens.map(({g, brl, partes, k}) => ({rotulo: `${g.descricao} (${dinheiro(brl)}, pago por ${membros[k].nome} em ${dataBR(g.data)})`, brl: partes[j], op: '+', id: g.id}));
  const pct = typeof s.pct === 'number' ? textoPct(String(s.pct)) : 'não informada';
  return {formula: `Parte nos divididos = a participação de ${s.nome} (${pct}) em cada gasto dividido entre vocês, até hoje. Cada gasto é repartido pelo maior resto, para os centavos fecharem o total.`,
    termos, resultado: somar(0, ...termos.map(t => t.brl)), excluidos: fora};
}

const COLUNAS = [
  {campo: 'adiantou', rotulo: 'Adiantou', valor: s => adiantou(s), explica: s => explicaAdiantou(s), titulo: n => `O que ${n} adiantou`},
  {campo: 'parte', rotulo: 'Parte nos divididos', valor: s => s.parteDividido, explica: (s, D) => explicaParte(D, s), titulo: n => `A parte de ${n} nos gastos divididos`},
  {campo: 'saldo', rotulo: 'Saldo no acerto', valor: s => s.saldo, explica: s => s.explica.saldo, titulo: n => `Saldo no acerto de ${n}`, sinal: true},
  {campo: 'devido', rotulo: 'A empresa deve', valor: s => s.devido, explica: s => s.explica.devido, titulo: n => `O que a empresa deve a ${n}`},
  {campo: 'aportes', rotulo: 'Aportes', valor: s => s.aportes, explica: s => s.explica.aportes, titulo: n => `Aportes de ${n}`},
];
function quadro(D, A) {
  const eu = D.c.membro.id;
  const box = cartao('O acerto de cada sócia', 'Acumulado até hoje, em todos os meses. Toque num número para ver a conta.');
  const rolagem = el('div', 'ac-quadro-caixa');
  const tab = el('table', 'ac-quadro');
  tab.append(el('caption', 'ac-sr', 'O acerto de cada sócia, acumulado até hoje'));
  const cab = el('tr');
  cab.append(el('th', null, 'Sócia'));
  for (const col of COLUNAS) { const th = el('th', null, col.rotulo); th.scope = 'col'; cab.append(th); }
  cab.firstChild.scope = 'col';
  const thead = el('thead'); thead.append(cab);
  const tbody = el('tbody');
  for (const s of A.porSocia) {
    const tr = el('tr', s.id === eu ? 'is-eu' : null);
    tr.dataset.socia = s.id;
    const th = el('th', 'ac-quadro-nome', s.nome + (s.id === eu ? ' (você)' : '')); th.scope = 'row';
    tr.append(th);
    for (const col of COLUNAS) {
      const v = col.valor(s);
      const td = el('td');
      td.dataset.campo = col.campo; td.dataset.rotulo = col.rotulo; td.dataset.minor = String(v);
      const texto = col.sinal ? comSinal(v) : dinheiro(v);
      const b = botao(texto, 'ac-num' + (col.sinal ? (v > 0 ? ' is-pos' : v < 0 ? ' is-neg' : '') : ''), () => verConta(col.titulo(s.nome), col.explica(s, D), D.c));
      b.dataset.chave = `conta:${s.id}:${col.campo}`;
      b.setAttribute('aria-label', `${col.rotulo} de ${s.nome}: ${texto}. Ver a conta`);
      td.append(b);
      tr.append(td);
    }
    tbody.append(tr);
  }
  tab.append(thead, tbody);
  rolagem.append(tab);
  box.append(rolagem);
  box.append(el('p', 'lv-nota ac-como-ler', 'Saldo positivo (+) = tem a receber das outras sócias; negativo (−) = tem a pagar. Os saldos somam zero. “A empresa deve” é o reembolso dos gastos pagos do bolso; aporte é dinheiro posto na empresa, que ninguém devolve.'));
  const como = comoChegamos(D, A);
  if (como) box.append(como);
  if (A.incompletos.length) {
    const av = el('div', 'notice lv-aviso');
    av.append(el('strong', null, `${A.incompletos.length === 1 ? 'Um gasto ficou' : A.incompletos.length + ' gastos ficaram'} fora do acerto: `), el('span', null, A.incompletos.map(i => `${i.descricao} (${i.motivo})`).join('; ')));
    box.append(av);
  }
  return box;
}
// "Bauer pagou “Contador · outubro” (R$ 450,00). A parte de Bauer é 40% (R$ 180,00); Ana e Beatriz devem R$ 135,00
// cada." Um por gasto dividido, com o mesmo rateio do contas.js (maior resto, parâmetros do mês fechado), e os Pix.
let comoAberto = false;
function comoChegamos(D, A) {
  const {aplicado} = D, hoje = hojeDe(D.c);
  const {membros, itens} = divididos(D);
  const frases = [];
  for (const {g, brl, partes, k} of itens) {
    const outras = membros.map((m, j) => ({nome: m.nome, v: partes[j]})).filter((x, j) => j !== k && x.v > 0);
    let f = `${membros[k].nome} pagou “${g.descricao}” (${dinheiro(brl)}) em ${dataBR(g.data)}. A parte de ${membros[k].nome} é ${textoPct(String(membros[k].pct))} (${dinheiro(partes[k])})`;
    if (outras.length) {
      const iguais = outras.every(x => x.v === outras[0].v);
      f += iguais ? `; ${listaDeNomes(outras.map(x => x.nome))} ${outras.length > 1 ? 'devem' : 'deve'} ${dinheiro(outras[0].v)}${outras.length > 1 ? ' cada' : ''}.`
        : '; ' + listaDeNomes(outras.map((x, j) => j === 0 ? `${x.nome} deve ${dinheiro(x.v)}` : `${x.nome}, ${dinheiro(x.v)}`)) + '.';
    } else f += '.';
    frases.push({data: g.data, texto: f});
  }
  for (const a of aplicado.acertos || []) {
    if (a.tipo !== 'acerto_entre_socias' || a.data > hoje) continue;
    frases.push({data: a.data, texto: `${nome(D, a.de)} mandou ${dinheiro(a.valorMinor)} a ${nome(D, a.para)} em ${dataBR(a.data)} (${rotuloForma(a.forma)})${a.confirmadoPor ? '' : ', ainda sem a confirmação de quem recebeu'}.`});
  }
  if (!frases.length) return null;
  frases.sort((x, y) => x.data.localeCompare(y.data));
  const det = el('details', 'ac-como');
  det.open = comoAberto;   // um redesenho (o diário sincronizou) não fecha o que a sócia abriu
  det.addEventListener('toggle', () => { comoAberto = det.open; });
  det.append(el('summary', null, `Como chegamos a estes saldos (${frases.length} ${frases.length === 1 ? 'passo' : 'passos'})`));
  const ol = el('ol', 'ac-como-lista');
  for (const x of frases) ol.append(el('li', null, x.texto));
  det.append(ol, el('p', 'lv-nota', A.explica.formula));
  return det;
}
const rotuloForma = id => ((R.FORMAS_ACERTO.find(f => f.id === id) || {}).rotulo || 'outro').toLowerCase().replace(/^pix$/, 'Pix');

// ── barras do saldo e "quem paga quem" ───────────────────────────────────────────────────────────────────────────
function graficoSaldos(A) {
  const fig = divergentes(A.porSocia.map(s => ({rotulo: s.nome, valor: s.saldo})), {rotulo: 'Saldo de cada sócia no acerto: ' + A.porSocia.map(s => `${s.nome} ${comSinal(s.saldo)}`).join(', ') + '. Os saldos somam zero.'});
  fig.classList.add('ac-saldos');
  return fig;
}
const COMO_LER = 'Como ler: à direita, em azul (+), quem tem a receber; à esquerda, em vinho (−), quem tem a pagar. A soma dá zero.';
function textoDoAcerto(D, a) {
  const valor = dinheiro(a.valorMinor), quem = nome(D, a.criadoPor);
  if (a.tipo === 'acerto_entre_socias') return `${nome(D, a.de)} registrou ${a.forma === 'pix' ? 'um Pix' : 'um pagamento'} de ${valor} para ${nome(D, a.para)} em ${dataBR(a.data)}`;
  if (a.tipo === 'reembolso_empresa') return `${quem} registrou o reembolso da empresa de ${valor} para ${nome(D, a.para)} em ${dataBR(a.data)}`;
  if (a.tipo === 'aporte') return `${nome(D, a.de)} registrou um aporte de ${valor} na empresa em ${dataBR(a.data)}`;
  return `${quem} registrou uma retirada de ${valor} da empresa para ${nome(D, a.para)} em ${dataBR(a.data)}`;
}
const podeConfirmar = (D, a) => a.para === 'empresa' ? ehResponsavel(D) : a.para === D.c.membro.id;
const SUSPENSO = 'Com a participação suspensa, o portal não sugere pagamentos entre vocês: o saldo acima ainda não conta os gastos divididos. Corrija o cadastro antes de acertar.';
function cartaoQuemPaga(D, A, podeGravar, suspenso) {
  const eu = D.c.membro.id;
  const box = cartao('Quem paga quem', 'O jeito mais curto de zerar: quem deve mais paga primeiro quem tem mais a receber.');
  box.classList.add('ac-quem-paga');
  const titulo = box.querySelector('.lv-cartao-titulo'); titulo.tabIndex = -1; titulo.dataset.foco = 'quem-paga';
  box.append(graficoSaldos(A), el('p', 'lv-nota ac-como-ler', COMO_LER));
  if (suspenso) box.append(el('p', 'notice lv-aviso ac-suspenso', SUSPENSO));
  else if (A.transferencias.length) {
    const ul = el('ul', 'ac-transferencias');
    for (const t of A.transferencias) {
      const li = el('li', 'ac-transferencia' + (t.de === eu || t.para === eu ? ' is-minha' : ''));
      li.dataset.de = t.de; li.dataset.para = t.para; li.dataset.minor = String(t.brl);
      const frase = el('p', 'ac-transferencia-frase');
      frase.append(el('strong', null, t.de === eu ? 'Você' : t.deNome), ' paga ', el('strong', 'ac-valor is-neg', dinheiro(t.brl)), ' a ', el('strong', null, t.para === eu ? 'você' : t.paraNome));
      li.append(frase);
      if (podeGravar && t.de === eu) {
        const chave = `pix:${t.de}:${t.para}`;
        const b = botao('Registrar o Pix', 'button-primary ac-acao', () => folhaPix(t, {chave, foco: 'quem-paga'}));
        b.dataset.chave = chave;
        b.setAttribute('aria-label', `Registrar o Pix de ${dinheiro(t.brl)} para ${t.paraNome}`);
        li.append(b);
      } else if (t.para === eu) li.append(el('span', 'ac-dica', `Quando ${t.deNome} registrar o Pix, você confirma aqui com “Recebi”.`));
      ul.append(li);
    }
    box.append(ul);
  } else box.append(el('p', 'ac-zerado', A.porSocia.some(s => s.pagouDividido || s.pixEnviados) ? 'Ninguém deve nada a ninguém: os saldos estão zerados.' : 'Ainda não há gastos divididos entre vocês.'));
  // registrados e ainda sem confirmação de quem recebe
  const pendentes = A.aguardandoConfirmacao.map(x => (D.aplicado.acertos || []).find(a => a.id === x.id)).filter(Boolean);
  if (pendentes.length) {
    box.append(el('h4', 'lv-sub', 'Aguardando confirmação'));
    const ul = el('ul', 'ac-aguardando');
    for (const a of pendentes) {
      const li = el('li', 'ac-pendente');
      li.dataset.acerto = a.id;
      li.append(el('p', null, textoDoAcerto(D, a) + '.'));
      if (podeGravar && podeConfirmar(D, a)) {
        const b = botao('Recebi', 'button-primary ac-acao', () => confirmar(a));
        b.dataset.chave = 'recebi:' + a.id;
        b.setAttribute('aria-label', a.para === 'empresa' ? `Recebi: confirmar que a empresa recebeu ${dinheiro(a.valorMinor)} de ${nome(D, a.de)}` : `Recebi: confirmar que você recebeu ${dinheiro(a.valorMinor)} de ${nome(D, a.de)}`);
        li.append(b);
      } else li.append(pilula(`aguardando ${a.para === 'empresa' ? 'a responsável' : nome(D, a.para)} confirmar`, 'pendente'));
      ul.append(li);
    }
    box.append(ul);
    if (D.d && D.d.modo !== 'gravacao') box.append(el('p', 'lv-nota', 'Em treino só você está neste navegador: o “Recebi” de quem recebe vale de verdade quando o servidor do diário estiver publicado.'));
  }
  return box;
}

// ── reembolsos pendentes: "Reembolsar" (a responsável) e "Converter em aporte" (quem pagou) ───────────────────────────
function cartaoReembolsos(D, A, podeGravar) {
  const eu = D.c.membro.id, resp = ehResponsavel(D);
  const box = cartao('Reembolsos pendentes', 'Gastos pagos do bolso que a empresa devolve. Quem reembolsa é a responsável; quem pagou pode, em vez disso, deixar o valor como aporte.');
  box.classList.add('ac-reembolsos');
  const titulo = box.querySelector('.lv-cartao-titulo'); titulo.tabIndex = -1; titulo.dataset.foco = 'reembolsos';
  if (!A.reembolsosPendentes.length) { box.append(el('p', 'ac-zerado', 'Nenhum reembolso pendente: a empresa não deve nada a ninguém por gastos do bolso.')); return box; }
  const ordem = (D.aplicado.membros || []).map(m => m.id);
  const grupos = ordem.map(id => ({id, itens: A.reembolsosPendentes.filter(r => r.pagoPor === id)})).filter(g => g.itens.length);
  for (const g of grupos) {
    const total = somar(...g.itens.map(i => i.brl));
    const sec = el('section', 'ac-grupo');
    sec.dataset.socia = g.id;
    const cab = el('div', 'ac-grupo-cab');
    cab.append(el('h4', 'ac-grupo-titulo', `${g.id === eu ? 'Você' : nome(D, g.id)} · ${dinheiro(total)} em ${g.itens.length} ${g.itens.length === 1 ? 'gasto' : 'gastos'}`));
    if (podeGravar && resp) {
      const chave = 'reembolsar:' + g.id;
      const b = botao('Reembolsar', 'button-primary ac-acao', () => folhaReembolso(g.id, null, {chave, foco: 'reembolsos'}));
      b.dataset.chave = chave;
      b.setAttribute('aria-label', `Reembolsar ${nome(D, g.id)}: ${dinheiro(total)}`);
      cab.append(b);
    }
    sec.append(cab);
    const ul = el('ul', 'ac-gastos');
    for (const i of g.itens) {
      const li = el('li', 'ac-gasto');
      li.dataset.gasto = i.id;
      const desc = el('a', 'ac-gasto-desc', i.descricao);
      desc.href = window.financeRotas ? window.financeRotas.montar('lancamentos', [], {mes: i.competencia, id: i.id}) : '#lancamentos';
      desc.addEventListener('click', e => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || typeof window.financeNavigate !== 'function') return;
        e.preventDefault();
        window.financeNavigate('lancamentos', true, {filtros: {mes: i.competencia, id: i.id}, origem: 'acerto'});
      });
      const meta = el('span', 'ac-gasto-meta', `${dataBR(i.data)}${i.moeda !== 'BRL' ? ' · ' + dinheiro(i.valorMinor, i.moeda) + (i.conversao === 'efetivo' ? ' pela fatura' : ' · estimado') : ''}`);
      const corpo = el('div', 'ac-gasto-corpo'); corpo.append(desc, meta);
      li.append(corpo, el('strong', 'ac-gasto-valor', dinheiro(i.brl)));
      if (podeGravar && i.pagoPor === eu) {
        const gasto = (D.aplicado.gastos || []).find(x => x.id === i.id);
        if (gasto) {
          const chave = 'aporte:' + i.id;
          const b = botao('Converter em aporte', 'button-outline ac-acao', () => folhaConverter(gasto, {chave, foco: 'reembolsos'}));
          b.dataset.chave = chave;
          b.setAttribute('aria-label', `Converter em aporte: ${i.descricao}, ${dinheiro(i.brl)}`);
          li.append(b);
        }
      }
      ul.append(li);
    }
    sec.append(ul);
    box.append(sec);
  }
  return box;
}

// ── aportes e histórico ─────────────────────────────────────────────────────────────────────────────────────────
function cartaoAportes(D, A, podeGravar) {
  const box = cartao('Aportes', 'Dinheiro que uma sócia pôs na empresa sem esperar devolução: gastos lançados como aporte, reembolsos convertidos e depósitos na conta da empresa.');
  box.classList.add('ac-aportes');
  const ul = el('ul', 'ac-aportes-lista');
  for (const s of A.porSocia) {
    const li = el('li'); li.dataset.socia = s.id;
    li.append(el('span', null, s.nome + (s.id === D.c.membro.id ? ' (você)' : '')), el('strong', 'ac-valor', dinheiro(s.aportes)));
    ul.append(li);
  }
  box.append(ul);
  if (podeGravar) {
    const b = botao('Registrar um aporte em dinheiro', 'button-outline ac-acao', () => folhaAporte({chave: 'aporte-dinheiro', foco: 'aportes'}));
    b.dataset.chave = 'aporte-dinheiro';
    box.append(b);
  }
  return box;
}
const VISIVEIS = 8;
let historicoAberto = false;
function cartaoHistorico(D) {
  const box = cartao('Histórico de acertos', 'Pix entre vocês, reembolsos, aportes e reembolsos convertidos, do mais novo ao mais antigo. Nada se apaga.');
  box.classList.add('ac-historico-cartao');
  const itens = [];
  for (const a of D.aplicado.acertos || []) {
    const tipo = (R.TIPOS_ACERTO.find(t => t.id === a.tipo) || {}).rotulo || a.tipo;
    const situacao = a.confirmadoPor ? pilula(`recebido · confirmado por ${nome(D, a.confirmadoPor)} em ${dataBR(a.confirmadoEm)}`, 'ok') : pilula(`aguardando ${a.para === 'empresa' ? 'a responsável' : nome(D, a.para)} confirmar`, 'pendente');
    itens.push({quando: a.data + (a.criadoEm || ''), id: a.id, linhas: [`${dataBR(a.data)} · ${tipo} · ${nome(D, a.de)} → ${nome(D, a.para)} · ${dinheiro(a.valorMinor)} · ${rotuloForma(a.forma)}`, a.nota ? '“' + a.nota + '”' : null, `registrado por ${nome(D, a.criadoPor)} em ${horaBR(a.criadoEm)}`], situacao});
  }
  for (const g of D.aplicado.gastos || []) {
    if (!g.convertidoEm || g.estado === 'anulado') continue;
    const r = R.reaisDoGasto(g, listaDoMes(D.aplicado, D.lista, g.competencia));
    itens.push({quando: g.convertidoEm.slice(0, 10) + g.convertidoEm, gasto: g.id, linhas: [`${dataBR(g.convertidoEm)} · Reembolso convertido em aporte · ${nome(D, g.pagoPor)} · “${g.descricao}” · ${r.brl === null ? dinheiro(g.valorMinor, g.moeda) : dinheiro(r.brl)}`, `por ${nome(D, g.convertidoPor)} em ${horaBR(g.convertidoEm)}`], situacao: pilula('virou aporte', 'neutro')});
  }
  if (!itens.length) { box.append(el('p', 'ac-zerado', 'Nenhum acerto registrado ainda.')); return box; }
  itens.sort((x, y) => y.quando.localeCompare(x.quando));
  const ol = el('ol', 'ac-historico');
  itens.forEach((x, k) => {
    const li = el('li', 'ac-hist-item');
    li.hidden = !historicoAberto && k >= VISIVEIS;
    if (x.id) li.dataset.acerto = x.id; else li.dataset.gasto = x.gasto;
    const corpo = el('div');
    x.linhas.filter(Boolean).forEach((t, j) => corpo.append(el(j === 0 ? 'p' : 'span', j === 0 ? 'ac-hist-linha' : 'lv-autoria', t)));
    li.append(corpo, x.situacao);
    ol.append(li);
  });
  box.append(ol);
  if (itens.length > VISIVEIS) {
    const b = botao(historicoAberto ? 'Mostrar só os mais recentes' : `Mostrar todos (${itens.length})`, 'button-quiet ac-mais', () => {
      historicoAberto = !historicoAberto;
      ol.querySelectorAll('li').forEach((li, k) => { li.hidden = !historicoAberto && k >= VISIVEIS; });
      b.textContent = historicoAberto ? 'Mostrar só os mais recentes' : `Mostrar todos (${itens.length})`;
      b.setAttribute('aria-expanded', String(historicoAberto));
    });
    b.setAttribute('aria-expanded', String(historicoAberto));
    box.append(b);
  }
  return box;
}

// ── as folhas: tudo passa pela folha comum do livro.js e grava pelo diário ───────────────────────────────────────────
// Ao fechar uma folha (ou depois do "Recebi"), a página se redesenha e o botão que abriu é outro nó (ou sumiu, se a
// gravação deu certo): o foco volta ao botão equivalente ({chave}); se ele sumiu, ao cartão do lançamento ({gasto}) ou
// ao título da parte que mudou na Sociedade ({foco}). Assim o teclado e o leitor de tela não caem no começo da página.
let focoPendente = null;
function aplicarFoco() {
  const p = focoPendente;
  focoPendente = null;
  if (!p) return;
  const visivel = n => n && !n.closest('[hidden]');
  let n = p.chave ? document.querySelector(`[data-chave="${CSS.escape(p.chave)}"]`) : null;
  if (!visivel(n) && p.gasto) { n = document.querySelector(`#lancamentos-content [data-gasto="${CSS.escape(p.gasto)}"]`); if (n) n.tabIndex = -1; }
  if (!visivel(n) && p.foco) n = document.querySelector(`#sociedade-acerto [data-foco="${p.foco}"]`);
  if (visivel(n)) n.focus();
}
function campoData(valor) { const i = el('input'); i.type = 'date'; i.value = valor; i.max = '2099-12-31'; i.required = true; return i; }
function campoForma(padrao = 'pix') {
  const s = el('select', 'lv-select');
  for (const f of R.FORMAS_ACERTO) { const o = el('option', null, f.rotulo); o.value = f.id; o.selected = f.id === padrao; s.append(o); }
  return s;
}
function campoNota(exemplo) { const i = el('input'); i.maxLength = 300; i.placeholder = exemplo; return i; }
const diaOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

// Pix entre sócias: "Você paga R$ 135,00 a Bauer"; o valor vem da transferência sugerida (pode ser menor, nunca maior)
function folhaPix(t, volta = {foco: 'quem-paga'}) {
  const D = dados(); if (!D) return;
  const valor = campoDinheiro('BRL', {valorMinor: t.brl, rotulo: 'Valor do Pix'});
  const data = campoData(hojeDe(D.c)), forma = campoForma('pix'), nota = campoNota('Opcional. Ex.: minha parte do contador de outubro');
  abrirFolha({eyebrow: 'Acerto entre sócias', titulo: `Pix para ${t.paraNome}`, rotulo: `Registrar o Pix para ${t.paraNome}`,
    corpo: [el('p', null, `Você paga ${dinheiro(t.brl)} a ${t.paraNome}: é o que zera o seu saldo no acerto com ${t.paraNome}. Registre depois de fazer o Pix no banco; ${t.paraNome} confirma aqui quando receber.`),
      campoComRotulo('Quanto você mandou', valor), campoComRotulo('Quando', data), campoComRotulo('Como', forma), campoComRotulo('Nota', nota)],
    acoes: [{rotulo: 'Registrar o Pix', primaria: true, fn: folha => {
      const v = valor.ler();
      if (!v || v <= 0) return {ok: false, erro: 'Informe o valor (use vírgula para os centavos).'};
      if (v > t.brl) return {ok: false, erro: `O valor passa do que você deve a ${t.paraNome} (${dinheiro(t.brl)}). Confira.`};
      if (!diaOk(data.value)) return {ok: false, erro: 'Informe a data do Pix.'};
      return folha.gravar({acao: 'record_settlement', alvo: novoAlvo(), dados: {tipo: 'acerto_entre_socias', de: D.c.membro.id, para: t.para, valorMinor: v, moeda: 'BRL', data: data.value, forma: forma.value, gastoIds: [], nota: nota.value.trim()}},
        `Pix registrado: ${dinheiro(v)} para ${t.paraNome}. Agora ${t.paraNome} confirma o recebimento.`);
    }}],
    aoFechar: () => { focoPendente = volta; }});
}
// O valor em reais de um reembolso pendente: o mesmo da Sociedade (contas.acertoAcumulado) e o que o razão confere ao
// gravar. Gasto de mês fechado vale pelos parâmetros congelados no fechamento: uma vigência nova do dólar não o muda.
function reaisDoReembolso(D, g) {
  const r = contaDe(D).reembolsosPendentes.find(x => x.id === g.id);
  return r ? r.brl : R.reaisDoGasto(g, listaDoMes(D.aplicado, D.lista, g.competencia)).brl;
}
// Reembolso da empresa (só a responsável): marca os gastos pendentes de uma sócia; o valor é a soma deles em reais
function folhaReembolso(para, marcados = null, volta = {foco: 'reembolsos'}) {
  const D = dados(); if (!D) return;
  const nomePara = nome(D, para);
  const pendentes = (D.aplicado.gastos || []).filter(g => g.pagoPor === para && g.estado !== 'anulado' && g.destino === 'empresa_reembolsa' && !g.convertidoEm && !g.reembolsadoEm && !g.reembolsoId)
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
    .map(g => ({g, brl: reaisDoReembolso(D, g)}));
  const escolha = el('fieldset', 'ac-escolha');
  escolha.append(el('legend', null, 'Gastos que este reembolso cobre'));
  const caixas = [];
  const total = el('p', 'ac-total'); total.setAttribute('aria-live', 'polite');
  const somaEscolhida = () => somar(0, ...caixas.filter(c => c.checked).map(c => c.brl));
  const atualizar = () => { total.replaceChildren(el('span', null, 'Total do reembolso'), el('strong', null, dinheiro(somaEscolhida()))); };
  for (const {g, brl} of pendentes) {
    const rot = el('label', 'ac-opcao');
    const cx = el('input'); cx.type = 'checkbox'; cx.value = g.id; cx.brl = brl;
    cx.checked = brl !== null && (!marcados || marcados.includes(g.id));
    cx.disabled = brl === null;
    cx.addEventListener('change', atualizar);
    caixas.push(cx);
    const txt = el('span', 'ac-opcao-texto');
    txt.append(el('span', null, g.descricao), el('small', null, `${dataBR(g.data)}${g.moeda !== 'BRL' ? ' · ' + dinheiro(g.valorMinor, g.moeda) : ''}${brl === null ? ' · falta o câmbio: concilie a fatura antes' : ''}`));
    rot.append(cx, txt, el('strong', 'ac-opcao-valor', brl === null ? '—' : dinheiro(brl)));
    escolha.append(rot);
  }
  atualizar();
  const data = campoData(hojeDe(D.c)), forma = campoForma('pix'), nota = campoNota('Opcional. Ex.: Pix da conta da empresa');
  abrirFolha({eyebrow: 'Reembolso da empresa', titulo: `Reembolsar ${nomePara}`,
    corpo: [el('p', null, `A empresa devolve a ${nomePara} o que foi pago do próprio bolso. Marque os gastos que este pagamento cobre: o valor é a soma deles. Registre depois de pagar pela conta da empresa.`),
      escolha, total, campoComRotulo('Quando', data), campoComRotulo('Como', forma), campoComRotulo('Nota', nota)],
    acoes: [{rotulo: 'Registrar o reembolso', primaria: true, fn: folha => {
      const ids = caixas.filter(c => c.checked).map(c => c.value);
      if (!ids.length) return {ok: false, erro: 'Marque pelo menos um gasto.'};
      if (!diaOk(data.value)) return {ok: false, erro: 'Informe a data do pagamento.'};
      const v = somaEscolhida();
      return folha.gravar({acao: 'record_settlement', alvo: novoAlvo(), dados: {tipo: 'reembolso_empresa', de: 'empresa', para, valorMinor: v, moeda: 'BRL', data: data.value, forma: forma.value, gastoIds: ids, nota: nota.value.trim()}},
        `Reembolso registrado: ${dinheiro(v)} para ${nomePara}.`);
    }}],
    aoFechar: () => { focoPendente = volta; }});
}
// Converter em aporte (só quem pagou): o reembolso pendente passa a contar como aporte, e a empresa não devolve mais
function folhaConverter(g, volta = {foco: 'reembolsos'}) {
  const D = dados(); if (!D) return;
  const r = R.reaisDoGasto(g, listaDoMes(D.aplicado, D.lista, g.competencia));
  const valor = r.brl === null ? dinheiro(g.valorMinor, g.moeda) : dinheiro(r.brl);
  abrirFolha({eyebrow: 'Reembolso pendente', titulo: 'Converter em aporte',
    corpo: [el('p', null, `“${g.descricao}” (${valor}) deixa de ser reembolso pendente e passa a contar como aporte seu na empresa. A empresa não vai mais devolver esse valor, e ele aparece nos seus aportes.`),
      el('p', 'lv-nota', 'Use quando você prefere deixar o dinheiro na empresa. Fica no histórico, com o seu nome e a data.')],
    acoes: [{rotulo: 'Converter em aporte', primaria: true, fn: folha => folha.gravar({acao: 'convert_to_contribution', alvo: g.id, versao: g.versao}, `Convertido em aporte: ${g.descricao} (${valor}).`)}],
    aoFechar: () => { focoPendente = volta; }});
}
// Aporte em dinheiro (qualquer sócia, em nome próprio); a responsável confirma que a empresa recebeu
function folhaAporte(volta = {foco: 'aportes'}) {
  const D = dados(); if (!D) return;
  const valor = campoDinheiro('BRL', {rotulo: 'Valor do aporte'});
  const data = campoData(hojeDe(D.c)), forma = campoForma('pix'), nota = campoNota('Opcional. Ex.: reforço de caixa para o lançamento');
  abrirFolha({eyebrow: 'Aporte em dinheiro', titulo: 'Registrar um aporte',
    corpo: [el('p', null, 'Dinheiro que você pôs na empresa, como um Pix para a conta dela. Conta como aporte seu, não como reembolso: a empresa não devolve. A responsável confirma quando o dinheiro chegar.'),
      campoComRotulo('Quanto', valor), campoComRotulo('Quando', data), campoComRotulo('Como', forma), campoComRotulo('Nota', nota)],
    acoes: [{rotulo: 'Registrar o aporte', primaria: true, fn: folha => {
      const v = valor.ler();
      if (!v || v <= 0) return {ok: false, erro: 'Informe o valor (use vírgula para os centavos).'};
      if (!diaOk(data.value)) return {ok: false, erro: 'Informe a data do aporte.'};
      return folha.gravar({acao: 'record_settlement', alvo: novoAlvo(), dados: {tipo: 'aporte', de: D.c.membro.id, para: 'empresa', valorMinor: v, moeda: 'BRL', data: data.value, forma: forma.value, gastoIds: [], nota: nota.value.trim()}},
        `Aporte registrado: ${dinheiro(v)}.`);
    }}],
    aoFechar: () => { focoPendente = volta; }});
}
// "Recebi": quem recebe confirma (a responsável, quando quem recebe é a empresa)
async function confirmar(a) {
  focoPendente = {chave: 'recebi:' + a.id, foco: 'quem-paga'};
  const r = await gravar({acao: 'confirm_settlement', alvo: a.id}, `Recebimento confirmado: ${dinheiro(a.valorMinor)}.`);
  if (!r || !r.ok) focoPendente = null;
}

// ── Sociedade ───────────────────────────────────────────────────────────────────────────────────────────────────
function desenharSociedade(D) {
  const alvo = $('sociedade-acerto');
  if (!alvo) return;
  const A = contaDe(D), podeGravar = !!D.d;
  const chave = alvo.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.chave : null;
  const raiz = el('section', 'ac-raiz');
  raiz.setAttribute('aria-labelledby', 'sociedade-acerto-titulo');
  const cab = el('div', 'section-heading ac-cabeca');
  const tt = el('div');
  const h2 = el('h2', 'ac-titulo', 'Quem adiantou, quem deve e quem paga quem'); h2.id = 'sociedade-acerto-titulo'; h2.tabIndex = -1;
  tt.append(el('p', 'section-number', 'ACERTO ENTRE AS SÓCIAS'), h2);
  cab.append(tt);
  raiz.append(cab, el('p', 'lv-intro ac-intro', 'Acumulado até hoje: todos os meses, com os Pix, reembolsos e aportes já registrados. O Livro do mês mostra a parte de cada uma só no mês.'));
  raiz.append(cartaoParticipacao(D), quadro(D, A));
  const grade = el('div', 'ac-grade');
  grade.append(cartaoQuemPaga(D, A, podeGravar, !participacao(D).fecha), cartaoReembolsos(D, A, podeGravar));
  raiz.append(grade);
  const aportes = cartaoAportes(D, A, podeGravar);
  const tituloAportes = aportes.querySelector('.lv-cartao-titulo'); tituloAportes.tabIndex = -1; tituloAportes.dataset.foco = 'aportes';
  raiz.append(aportes, cartaoHistorico(D));
  alvo.replaceChildren(raiz);
  // um redesenho (o diário sincronizou) com o foco num botão desta parte: o foco volta ao mesmo botão, sem rolar
  const voltar = chave ? alvo.querySelector(`[data-chave="${CSS.escape(chave)}"]`) : null;
  if (voltar && !voltar.closest('[hidden]')) voltar.focus({preventScroll: true});
}

// ── Meu painel: "Você adiantou R$ 509,90 · a empresa te deve R$ 59,90 · no acerto você tem +R$ 135,00 a receber" ─────
function desenharResumo(D) {
  const alvo = $('acerto-resumo');
  if (!alvo) return;
  const A = contaDe(D), eu = D.c.membro.id;
  const s = A.porSocia.find(x => x.id === eu);
  alvo.replaceChildren();
  if (!s) return;
  const box = el('section', 'ac-resumo');
  box.setAttribute('aria-label', 'O que você adiantou e o seu saldo no acerto');
  const cab = el('div', 'ac-resumo-cab');
  const ver = botao('Ver o acerto  ↗', 'button-outline', () => irPara('society', 'sociedade-acerto-titulo', 'painel'));
  cab.append(el('p', 'eyebrow', 'O que você adiantou · acumulado até hoje'), ver);
  box.append(cab);
  const valorBotao = (texto, campo, minor, titulo, explica, cls = '') => {
    const b = botao(texto, 'ac-valor-botao' + cls, () => verConta(titulo, explica, D.c));
    b.dataset.campo = campo; b.dataset.minor = String(minor);
    b.setAttribute('aria-label', `${texto}. Ver a conta`);
    return b;
  };
  const frase = el('p', 'ac-resumo-frase');
  const ad = adiantou(s), fecha = participacao(D).fecha;
  if (ad) frase.append('Você adiantou ', valorBotao(dinheiro(ad), 'adiantou', ad, 'O que você adiantou', explicaAdiantou(s)));
  // aporte não volta, então quem só fez aporte "não adiantou nada que volte": o aporte vem citado logo abaixo
  else frase.append(el('span', null, s.aportes ? 'Você não adiantou nada que volte para você' : 'Você não adiantou nada do bolso'));
  frase.append(' · ');
  if (s.devido > 0) frase.append('a empresa te deve ', valorBotao(dinheiro(s.devido), 'devido', s.devido, 'O que a empresa te deve', s.explica.devido));
  else if (s.devido < 0) frase.append('a empresa te pagou ', valorBotao(dinheiro(-s.devido), 'devido', s.devido, 'O que a empresa te deve', s.explica.devido), ' a mais');
  else frase.append(el('span', null, 'a empresa não te deve nada'));
  frase.append(' · ');
  // participação que não fecha 100%: o saldo só teria os Pix (os divididos ficam de fora), então não aparece com sinal
  if (!fecha) frase.append(el('span', 'ac-resumo-suspenso', 'o acerto entre vocês está suspenso até corrigir a participação'));
  else if (s.saldo) frase.append('no acerto você tem ', valorBotao(comSinal(s.saldo), 'saldo', s.saldo, 'Seu saldo no acerto', s.explica.saldo, s.saldo > 0 ? ' is-pos' : ' is-neg'), s.saldo > 0 ? ' a receber' : ' a pagar');
  else frase.append(el('span', null, 'no acerto você está quite'));
  box.append(frase);
  if (!fecha) {
    const aviso = el('a', 'lv-link-acerto ac-resumo-aviso', 'Ver o aviso da participação na Sociedade ›');
    aviso.href = window.financeRotas ? window.financeRotas.montar('society') : '#sociedade';
    aviso.addEventListener('click', e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || typeof window.financeNavigate !== 'function') return;
      e.preventDefault();
      irPara('society', 'sociedade-acerto-titulo', 'painel');
    });
    box.append(aviso);
  }
  // o que pede uma ação sua, em uma linha
  const pede = [];
  if (fecha) for (const t of A.transferencias) if (t.de === eu) pede.push(`você paga ${dinheiro(t.brl)} a ${t.paraNome}`);
  const aConfirmar = A.aguardandoConfirmacao.filter(x => { const a = (D.aplicado.acertos || []).find(y => y.id === x.id); return a && podeConfirmar(D, a); }).length;
  if (aConfirmar) pede.push(`${aConfirmar} ${aConfirmar === 1 ? 'recebimento' : 'recebimentos'} para confirmar`);
  if (ehResponsavel(D) && A.reembolsosPendentes.length) pede.push(`${A.reembolsosPendentes.length} ${A.reembolsosPendentes.length === 1 ? 'reembolso pendente' : 'reembolsos pendentes'} para pagar`);
  if (s.aportes) pede.push(`seus aportes somam ${dinheiro(s.aportes)}`);
  if (pede.length) box.append(el('p', 'ac-resumo-pede', pede.map((t, k) => k ? t : t.charAt(0).toUpperCase() + t.slice(1)).join(' · ') + '.'));
  alvo.append(box);
}

// ── Livro do mês: o mesmo acerto acumulado, no cartão "Entre as sócias" ──────────────────────────────────────────────
registrarExtra('livro-acerto', D => {
  const A = contaDe(D), eu = D.c.membro.id;
  const nos = [el('h4', 'lv-sub', 'Acerto entre vocês · acumulado até hoje'), el('p', 'lv-cartao-sub ac-livro-sub', 'Todos os meses, com os Pix e reembolsos já registrados: é o mesmo número da Sociedade.')];
  nos.push(graficoSaldos(A), el('p', 'lv-nota ac-como-ler', COMO_LER));
  if (!participacao(D).fecha) { nos.push(el('p', 'lv-nota', SUSPENSO)); return nos; }
  const ul = el('ul', 'lv-transferencias ac-livro-transferencias');
  for (const t of A.transferencias) ul.append(el('li', null, `${t.de === eu ? 'Você' : t.deNome} paga ${dinheiro(t.brl)} a ${t.para === eu ? 'você' : t.paraNome}`));
  if (!A.transferencias.length) ul.append(el('li', 'ac-zerado', 'Ninguém deve nada a ninguém agora.'));
  nos.push(ul);
  return nos;
});

// ── Lançamentos: "Reembolsar" (a responsável) e "Converter em aporte" (quem pagou) num reembolso pendente ────────────
registrarExtra('gasto-acoes', (D, {gasto: g} = {}) => {
  if (!g || !D.d || g.estado === 'anulado' || g.destino !== 'empresa_reembolsa' || g.convertidoEm || g.reembolsadoEm || g.reembolsoId) return null;
  const nos = [];
  if (ehResponsavel(D) && reaisDoReembolso(D, g) !== null) {
    const b = botao('Reembolsar', 'button-quiet', () => folhaReembolso(g.pagoPor, [g.id], {chave: 'reembolsar-gasto:' + g.id, gasto: g.id}));
    b.dataset.chave = 'reembolsar-gasto:' + g.id;
    b.setAttribute('aria-label', `Reembolsar ${nome(D, g.pagoPor)}: ${g.descricao}`);
    nos.push(b);
  }
  if (g.pagoPor === D.c.membro.id) {
    const b = botao('Converter em aporte', 'button-quiet', () => folhaConverter(g, {chave: 'converter-gasto:' + g.id, gasto: g.id}));
    b.dataset.chave = 'converter-gasto:' + g.id;
    b.setAttribute('aria-label', `Converter em aporte: ${g.descricao}`);
    nos.push(b);
  }
  return nos;
});

export function desenhar(D) { // D = dados() do livro.js: {c, d, aplicado, lista}; roda depois das páginas do livro.js
  desenharSociedade(D);
  desenharResumo(D);
  aplicarFoco();
}
registrarPagina(desenhar);
