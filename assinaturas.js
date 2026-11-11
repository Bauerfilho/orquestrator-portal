// Assinaturas (fatia F2-5): Nova assinatura, Confirmar, Marcar como paga e Encerrar viram registros do diário, com
// autora e data. O topo da página (#assinaturas-topo, antes de #subscriptions-content) traz "Nova assinatura" e as três
// regras em uma linha cada; os cartões continuam desenhados pelo app.js, que chama estas folhas pelo id da assinatura
// (window.financeAssinaturas). Editar, Reativar e os passos de Vender primeiro vão pela ponte (financeRequest), que grava
// pelo mesmo gravar daqui. Toda conta e toda regra são do razao.js: a folha só junta os dados e mostra a recusa dele.
// Plano: docs/PLANO-FASES-2-3.md (F2-5) e PLANO-PORTAL.md §5 (Assinaturas P1, Controles honestos).
import {registrarPagina, el, botao, dados, abrirFolha, campoDinheiro, campoComRotulo, nomeDe, hojeDe, dataBR, toast} from './livro.js';
import * as R from './razao.js';
import {dinheiro, mesLongo} from './graficos.js';

const $ = id => document.getElementById(id);
const host = () => (window.financeHost && typeof window.financeHost === 'object') ? window.financeHost : {};
// a ponte diz, ação por ação, se dá para gravar agora; sem a pergunta (host antigo), nada grava daqui
function pode(acao, alvo) {
  const h = host();
  if (typeof h.pode !== 'function') return {ok: false, motivo: 'Esta versão do portal ainda não grava assinaturas.'};
  try {
    const r = h.pode(acao, alvo);
    return r && r.ok ? {ok: true, treino: !!r.treino} : {ok: false, motivo: (r && r.motivo) || 'Não dá para gravar agora.'};
  } catch { return {ok: false, motivo: 'Não foi possível conferir se dá para gravar agora.'}; }
}
// depois de gravar: Assinaturas e Vender primeiro (app.js) relêem o snapshot já, sem esperar o ciclo de 2 s
const avisar = () => document.dispatchEvent(new CustomEvent('financeiro:diario'));
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const tituloDe = p => [p.servico, p.plano].filter(Boolean).join(' · ') || 'Assinatura';
const planoDe = (D, id) => (D.aplicado.planos || []).find(p => p.id === id) || null;
const somaMes = (mes, k) => { const t = +mes.slice(0, 4) * 12 + (+mes.slice(5, 7) - 1) + k; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
const MOEDAS = {BRL: 'Real', USD: 'Dólar', EUR: 'Euro'};
const SIMBOLO = {BRL: 'R$', USD: 'US$', EUR: '€'};
// os períodos de cobrança e o fator do equivalente mensal (os mesmos do razão: vezes por ano ÷ 12)
const PERIODOS = [['mensal', 'Mensal', [1, 1]], ['trimestral', 'Trimestral', [1, 3]], ['semestral', 'Semestral', [1, 6]], ['anual', 'Anual', [1, 12]]];
const FATOR = Object.fromEntries(PERIODOS.map(([id, , f]) => [id, f]));
// cobrança sem período fixo ("por venda"): o razão não confirma, então não conta como "a confirmar" (os períodos do EQUIVALENTE)
const FIXOS = new Set(['mensal', 'mes', 'monthly', 'anual', 'ano', 'yearly', 'trimestral', 'semestral', 'semanal', 'quinzenal']);
const periodoVariavel = periodo => { const k = String(periodo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, ''); return !!k && !FIXOS.has(k); };

// "US$ 99" ou "US$ 8,25": o valor curto da explicação, sem ",00" quando é inteiro
function valorCurto(minor, moeda) {
  const int = String(Math.floor(minor / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), cent = minor % 100;
  return `${SIMBOLO[moeda] || moeda} ${int}${cent ? ',' + String(cent).padStart(2, '0') : ''}`;
}
// "Anual de US$ 99 ÷ 12 = US$ 8,25 por mês." — BigInt e um arredondamento só (meio para longe do zero), como o razão
export function explicarMensal(valorMinor, moeda, periodo) {
  const f = FATOR[periodo];
  if (!Number.isSafeInteger(valorMinor) || valorMinor <= 0 || !f) return '';
  if (f[0] === 1 && f[1] === 1) return `Mensal de ${valorCurto(valorMinor, moeda)}: entra assim no previsto de cada mês.`;
  const mensal = Number((BigInt(valorMinor) * BigInt(f[0]) * 2n + BigInt(f[1])) / (2n * BigInt(f[1])));
  const nome = PERIODOS.find(([id]) => id === periodo)[1];
  return `${nome} de ${valorCurto(valorMinor, moeda)} ÷ ${f[1]} = ${valorCurto(mensal, moeda)} por mês.`;
}

// ── peças das folhas ─────────────────────────────────────────────────────────────────────────────────────────────
function entrada({tipo = 'text', valor = '', limite = null, ...atributos} = {}) {
  const i = el('input');
  i.type = tipo;
  if (valor) i.value = valor;
  if (limite) i.maxLength = limite;
  for (const [k, v] of Object.entries(atributos)) i.setAttribute(k, v);
  return i;
}
function escolha(opcoes, atual) {
  const s = el('select', 'lv-select');
  for (const [valor, rotulo, desligada] of opcoes) { const o = el('option', null, rotulo); o.value = valor; if (desligada) o.disabled = true; s.append(o); }
  s.value = atual;
  return s;
}
// valor + moeda: trocar a moeda refaz o campo (o símbolo e a leitura mudam) e guarda o que foi digitado
function valorComMoeda(moeda, valorMinor, rotulo, aoMudar = () => {}) {
  const caixa = el('div', 'as-valor-moeda');
  const sel = escolha(R.MOEDAS.map(m => [m, MOEDAS[m] || m]), R.MOEDAS.includes(moeda) ? moeda : 'BRL');
  sel.setAttribute('aria-label', 'Moeda');
  let campo = campoDinheiro(sel.value, {valorMinor, rotulo});
  const ligar = () => campo.input.addEventListener('input', aoMudar);
  ligar();
  sel.addEventListener('change', () => {
    const texto = campo.input.value;
    const novo = campoDinheiro(sel.value, {rotulo});
    novo.input.value = texto;
    campo.replaceWith(novo); campo = novo; ligar(); aoMudar();
  });
  caixa.append(campo, sel);
  return {caixa, ler: () => campo.ler(), moeda: () => sel.value, digitado: () => campo.input.value.trim()};
}
// o campo de valor ocupa a linha inteira da grade: o número em serifa grande precisa de espaço
const largo = caixa => { caixa.classList.add('as-largo'); return caixa; };
function aviso(texto) { const p = el('p', 'lock-note as-aviso'); p.append(cadeado(), el('span', null, texto)); return p; }
function cadeado() {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of [['viewBox', '0 0 14 14'], ['width', '14'], ['height', '14'], ['aria-hidden', 'true'], ['class', 'lock-icon']]) svg.setAttribute(k, v);
  const corpo = document.createElementNS(ns, 'rect');
  for (const [k, v] of [['x', '2.5'], ['y', '6'], ['width', '9'], ['height', '7'], ['rx', '1.5']]) corpo.setAttribute(k, v);
  const arco = document.createElementNS(ns, 'path');
  arco.setAttribute('d', 'M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6');
  svg.append(corpo, arco);
  return svg;
}
// a ficha da assinatura, para conferir com a fatura: o que está gravado e quem mexeu por último
function ficha(D, p) {
  const dl = el('dl', 'as-ficha');
  const linha = (rotulo, valor) => { if (valor) dl.append(el('dt', null, rotulo), el('dd', null, valor)); };
  linha('Serviço', p.servico);
  linha('Plano', p.plano);
  linha('Valor', Number.isSafeInteger(p.valorMinor) && R.MOEDAS.includes(p.moeda) ? `${dinheiro(p.valorMinor, p.moeda)} · ${p.periodo || 'período não informado'}` : 'não informado: use “Editar”');
  linha('Equivalente mensal', FATOR[p.periodo] && FATOR[p.periodo][1] > 1 ? explicarMensal(p.valorMinor, p.moeda, p.periodo) : '');
  linha('Vencimento', Number.isInteger(p.diaVencimento) ? `todo dia ${p.diaVencimento}` : p.proximaData ? `próxima em ${dataBR(p.proximaData)}` : 'a confirmar');
  linha('Categoria', p.categoria ? R.rotuloCategoria(p.categoria) : `${R.rotuloCategoria(R.palpiteCategoria(p.servico))} (palpite pelo nome)`);
  if (p.criadoPor) linha('Criada por', `${nomeDe(D.c, p.criadoPor)} em ${dataBR(p.criadoEm)}`);
  if (p.alteradoPor) linha('Alterada por', `${nomeDe(D.c, p.alteradoPor)} em ${dataBR(p.alteradoEm)}`);
  if (!p.criadoPor && !p.alteradoPor) linha('Origem', 'arquivo de planos do pacote de 18/10');
  return dl;
}
function novoId(prefixo, texto = '') {
  const base = String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${prefixo}${base ? base + '-' : ''}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
function semDiario() { toast('Um instante: o diário ainda está abrindo.', 'erro'); }

// ── Nova assinatura ──────────────────────────────────────────────────────────────────────────────────────────────
export function nova() {
  const D = dados();
  if (!D) return semDiario();
  const p = pode('add_plan');
  if (!p.ok) return toast(p.motivo, 'erro');
  let categoriaEscolhida = false;
  const servico = entrada({limite: 80, placeholder: 'Ex.: Canva', autocomplete: 'off'});
  const plano = entrada({limite: 80, placeholder: 'Ex.: Pro · 1 pessoa', autocomplete: 'off'});
  const conta = el('p', 'as-conta');
  conta.setAttribute('aria-live', 'polite');
  const periodo = escolha(PERIODOS.map(([id, rotulo]) => [id, rotulo]), 'mensal');
  const valor = valorComMoeda('BRL', null, 'Valor da cobrança', () => contar());
  const dia = entrada({tipo: 'number', min: '1', max: '31', inputmode: 'numeric', placeholder: 'Ex.: 12'});
  const proxima = entrada({tipo: 'date'});
  const categoria = escolha([['', 'Escolha…'], ...R.CATEGORIAS.map(c => [c.id, c.rotulo])], '');
  const campoDia = campoComRotulo('Dia do vencimento (1 a 31)', dia), campoProxima = campoComRotulo('Próxima cobrança', proxima);
  const contar = () => { conta.textContent = explicarMensal(valor.ler(), valor.moeda(), periodo.value) || 'Digite o valor: o equivalente mensal aparece aqui.'; };
  const vencimento = () => { const mensal = periodo.value === 'mensal'; campoDia.hidden = !mensal; campoProxima.hidden = mensal; contar(); };
  periodo.addEventListener('change', vencimento);
  servico.addEventListener('input', () => { if (!categoriaEscolhida) categoria.value = servico.value.trim() ? R.palpiteCategoria(servico.value) : ''; });
  categoria.addEventListener('change', () => { categoriaEscolhida = true; });
  vencimento();
  const grade = el('div', 'as-grade');
  grade.append(campoComRotulo('Serviço', servico), campoComRotulo('Plano', plano), largo(campoComRotulo('Valor', valor.caixa)), campoComRotulo('Período', periodo), campoDia, campoProxima, campoComRotulo('Categoria', categoria));
  abrirFolha({eyebrow: 'Assinatura nova', titulo: 'Nova assinatura', rotulo: 'Nova assinatura', corpo: [
    grade, conta,
    el('p', 'as-nota', 'Uma assinatura nova só entra no previsto depois que outra sócia confirmar. Se não souber o vencimento, deixe em branco: aparece “data a confirmar”.'),
  ], acoes: [{rotulo: 'Criar assinatura', primaria: true, fn: async folha => {
    const nome = servico.value.trim(), v = valor.ler(), per = periodo.value;
    if (!nome) return {ok: false, erro: 'Informe o serviço.'};
    if (!v) return {ok: false, erro: valor.digitado() ? 'Valor não reconhecido: use vírgula para os centavos (ex.: 34,90).' : 'Informe o valor da cobrança.'};
    if (!categoria.value) return {ok: false, erro: 'Escolha a categoria.'};
    if (per === 'mensal' && dia.value && !(Number.isInteger(Number(dia.value)) && Number(dia.value) >= 1 && Number(dia.value) <= 31)) return {ok: false, erro: 'O dia do vencimento vai de 1 a 31.'};
    const dados_ = {servico: nome, plano: plano.value.trim(), valorMinor: v, moeda: valor.moeda(), periodo: per,
      diaVencimento: per === 'mensal' && dia.value ? Number(dia.value) : null, proximaData: per !== 'mensal' && proxima.value ? proxima.value : null, categoria: categoria.value, status: ''};
    const r = await folha.gravar({acao: 'add_plan', alvo: novoId('pl-', nome), dados: dados_}, `Assinatura criada: ${nome}. Falta outra sócia confirmar.`);
    if (r.ok) avisar();
    return r;
  }}]});
}

// ── Confirmar (quatro olhos) ─────────────────────────────────────────────────────────────────────────────────────
export function confirmar(id) {
  const D = dados();
  if (!D) return semDiario();
  const p = planoDe(D, id);
  if (!p) return toast('Esta assinatura não existe mais: recarregue o portal.', 'erro');
  const perm = pode('confirm_plan', id);
  abrirFolha({eyebrow: 'Quatro olhos nos dados da fatura', titulo: 'Confirmar ' + tituloDe(p), rotulo: 'Confirmar assinatura', corpo: [
    el('p', 'as-destaque', 'Confirmar = os dados batem com a fatura.'),
    ficha(D, p),
    el('p', 'as-nota', 'Confira com a fatura ou o e-mail de cobrança. Se algo não bater, feche e use “Editar”. Confirmada, ela entra no previsto do mês.'),
    ...(perm.ok ? [] : [aviso(perm.motivo)]),
  ], acoes: perm.ok ? [{rotulo: 'Os dados batem: confirmar', primaria: true, fn: async folha => {
    const r = await folha.gravar({acao: 'confirm_plan', alvo: id, versao: p.versao}, `Assinatura confirmada: ${tituloDe(p)} entra no previsto.`);
    if (r.ok) avisar();
    return r;
  }}] : []});
}

// ── Marcar como paga: um gasto ligado à assinatura e ao ciclo (record_payment), com valor e moeda já preenchidos ──────
export function pagar(id) {
  const D = dados();
  if (!D) return semDiario();
  const p = planoDe(D, id);
  if (!p) return toast('Esta assinatura não existe mais: recarregue o portal.', 'erro');
  const {c, aplicado} = D;
  const hoje = hojeDe(c), mesAtual = hoje.slice(0, 7), anterior = somaMes(mesAtual, -1);
  // o ciclo pago: este mês ou o anterior (se não estiver fechado); o que já foi pago aparece e fica desligado
  const pagos = new Set((aplicado.gastos || []).filter(g => g.estado !== 'anulado' && g.planoId === id).map(g => g.ciclo || g.competencia));
  const fechado = m => !!(aplicado.fechamentos && aplicado.fechamentos[m] && aplicado.fechamentos[m].fechado);
  const meses = [anterior, mesAtual].filter(m => !fechado(m));
  const livre = [...meses].reverse().find(m => !pagos.has(m)) || mesAtual;
  const ciclo = escolha(meses.map(m => [m, capital(mesLongo(m)) + (pagos.has(m) ? ' (já paga)' : ''), pagos.has(m)]), livre);
  const valor = valorComMoeda(p.moeda, Number.isSafeInteger(p.valorMinor) ? p.valorMinor : null, 'Valor pago');
  const data = entrada({tipo: 'date', valor: hoje});
  const forma = escolha(R.FORMAS.map(f => [f.id, f.rotulo]), 'cartao_pj');
  const pagoPor = escolha((c.estado.members || []).map(m => [m.id, m.id === c.membro.id ? m.displayName + ' (eu)' : m.displayName]), c.membro.id);
  if (c.membro.papel !== 'owner') pagoPor.disabled = true;   // como no + Lançar: só a responsável lança por outra sócia
  const destino = escolha(R.DESTINOS.map(d => [d.id, d.rotulo]), 'empresa_reembolsa');
  const campoDestino = campoComRotulo('Pago do próprio bolso. E agora?', destino);
  const mostrarDestino = () => { campoDestino.hidden = R.formaDaEmpresa(forma.value); };
  forma.addEventListener('change', mostrarDestino);
  mostrarDestino();
  const grade = el('div', 'as-grade');
  grade.append(largo(campoComRotulo('Valor', valor.caixa)), campoComRotulo('Ciclo pago', ciclo), campoComRotulo('Data do pagamento', data), campoComRotulo('Como foi pago', forma), campoComRotulo('Quem pagou', pagoPor), campoDestino);
  abrirFolha({eyebrow: tituloDe(p), titulo: 'Marcar como paga', rotulo: 'Marcar assinatura como paga', corpo: [
    grade,
    el('p', 'as-nota', 'Vira um gasto em Lançamentos, ligado a esta assinatura, e sai do previsto do mês do ciclo. A anotação de status (em Editar) continua a mesma.'),
  ], acoes: [{rotulo: 'Marcar como paga', primaria: true, fn: async folha => {
    const v = valor.ler();
    if (!v) return {ok: false, erro: valor.digitado() ? 'Valor não reconhecido: use vírgula para os centavos (ex.: 34,90).' : 'Informe o valor pago.'};
    if (!data.value) return {ok: false, erro: 'Informe a data do pagamento.'};
    const cic = ciclo.value;
    const g = {data: data.value, competencia: cic, ciclo: cic, descricao: tituloDe(p), categoria: p.categoria || R.palpiteCategoria(p.servico), valorMinor: v, moeda: valor.moeda(),
      forma: forma.value, pagoPor: pagoPor.value, destino: R.formaDaEmpresa(forma.value) ? 'nao_aplica' : destino.value, planoId: id, documento: '', nota: ''};
    const r = await folha.gravar({acao: 'record_payment', alvo: novoId('g-'), dados: g}, `Marcada como paga: ${tituloDe(p)} · ${mesLongo(cic)}.`);
    if (r.ok) avisar();
    return r;
  }}]});
}

// ── Encerrar: data e motivo; o serviço de verdade se cancela no site dele ─────────────────────────────────────────────
export function encerrar(id) {
  const D = dados();
  if (!D) return semDiario();
  const p = planoDe(D, id);
  if (!p) return toast('Esta assinatura não existe mais: recarregue o portal.', 'erro');
  // já encerrada, ou com o encerramento marcado para uma data futura: o cartão oferece Reativar ou Desfazer, não esta folha
  if (p.assinatura === 'inactive' || p.encerrado) return toast('Esta assinatura já está encerrada: use “Reativar” ou “Desfazer o encerramento” no cartão.', 'erro');
  const desde = entrada({tipo: 'date', valor: hojeDe(D.c)});
  const motivo = entrada({limite: 160, placeholder: 'Ex.: trocamos por outro serviço'});
  abrirFolha({eyebrow: tituloDe(p), titulo: 'Encerrar assinatura', rotulo: 'Encerrar assinatura', corpo: [
    el('p', 'as-destaque', 'Encerrar aqui não cancela o serviço: cancele também no site dele.'),
    el('p', 'as-nota', 'A partir dessa data ela sai do previsto e ninguém tem parte nela. O histórico fica guardado, e dá para reativar.'),
    campoComRotulo('Desde quando', desde), campoComRotulo('Motivo (fica no histórico)', motivo),
  ], acoes: [{rotulo: 'Encerrar', primaria: true, fn: async folha => {
    if (!desde.value) return {ok: false, erro: 'Informe desde quando a assinatura deixa de valer.'};
    if (!motivo.value.trim()) return {ok: false, erro: 'Diga o motivo: ele fica no histórico.'};
    const r = await folha.gravar({acao: 'archive_plan', alvo: id, versao: p.versao, dados: {desde: desde.value}, motivo: motivo.value.trim()}, `Assinatura encerrada: ${tituloDe(p)}. Cancele também no site do serviço.`);
    if (r.ok) avisar();
    return r;
  }}]});
}

// ── o topo da página: Nova assinatura e as regras, cada uma numa linha ────────────────────────────────────────────────
export function desenhar(D) { // D = dados() do livro.js: {c, d, aplicado, lista}
  const alvo = $('assinaturas-topo');
  if (!alvo || !D) return;
  const p = pode('add_plan');
  const caixa = el('div', 'as-topo');
  const linha = el('div', 'as-topo-linha');
  const botaoNova = botao('Nova assinatura', 'button-primary', () => nova());
  botaoNova.id = 'assinatura-nova';
  if (!p.ok) { botaoNova.disabled = true; botaoNova.title = p.motivo; }
  const aConfirmar = (D.aplicado.planos || []).filter(x => !x.confirmado && x.assinatura !== 'inactive' && !x.encerrado && !periodoVariavel(x.periodo));
  linha.append(botaoNova, el('span', 'as-contagem', aConfirmar.length ? `${aConfirmar.length} ${aConfirmar.length === 1 ? 'assinatura' : 'assinaturas'} a confirmar` : 'Nenhuma assinatura a confirmar'));
  const regras = el('ul', 'as-regras');
  for (const t of ['Uma assinatura nova só entra no previsto depois que outra sócia confirmar.', 'Confirmar = os dados batem com a fatura.', 'Encerrar aqui não cancela o serviço: cancele também no site dele.']) regras.append(el('li', null, t));
  caixa.append(linha, regras);
  if (!p.ok) caixa.append(aviso(p.motivo));
  alvo.replaceChildren(caixa);
}
window.financeAssinaturas = {nova, confirmar, pagar, encerrar};
registrarPagina(desenhar);
