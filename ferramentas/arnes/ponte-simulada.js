// PONTE SIMULADA (arnês local de fotos e testes). Substitui a ponte estática publicada (static-bridge.publicado.js):
// mesma interface (window.financeHost + window.financeWebRequest), mas os dados vêm de estado-ficticio.js e não há
// senha nem pacote cifrado. O domínio é o domain.js publicado, sem mudança: buildSnapshot faz toda a conta, sobre o
// estado fictício + o diário (razao.js estadoEfetivo), como na ponte publicada. As três mutações antigas (toggle_step,
// edit_plan, set_subscription) viram eventos do razão pelo id e pela versão, gravados pelo gravar do livro.js: em
// treino, na memória da aba; com ?diario=local, cifrados no servidor do arnês.
//
// Parâmetros de URL (todos opcionais):
//   ?login=1          mostra a tela de entrada (restore_session falha; qualquer senha entra)
//   ?data=AAAA-MM-DD  data civil do cálculo (padrão 2026-10-19, para as fotos serem reproduzíveis)
//   ?membro=m-ana     quem está vendo (m-bauer, m-ana, m-bia)
//   ?escrita=1        readOnly false (só as decisões do Portfólio ainda leem readOnly). Assinaturas e Vender primeiro
//                     gravam sempre pelo diário (financeHost.pode): em treino ou, com ?diario=local, no servidor do arnês
//   ?perfis=demo      perfis fictícios abertos (nome, função, contato), como se perfis.json tivesse decifrado;
//                     ?perfis=outra-chave simula o envelope de uma chave mestra antiga; sem o parâmetro, "ausente"
//   ?galeria=1        mostra o item Laboratório no menu, com a galeria de verdade: a pasta galeria/ do repositório
//                     (o publicador do ia-chat a preenche) lida pelo mesmo galeria.js da ponte publicada
//   ?legado=1         junta um pacote antigo fictício, como o do pacote cifrado: apps/antigo-exemplo.html entra no
//                     catálogo como "Sem stand" e um apps/sinal.html antigo, que tem de PERDER para o do repositório
import {buildSnapshot, validateState, civilDate} from './domain.js';
import {estadoFicticio} from './estado-ficticio.js';
import {abrirDiario} from './diario.js';
import {criarGaleria} from './galeria.js';
import {cifrarPerfis, lerColado, juntarPerfis, foneLegivel, foneDiscavel} from './perfis.js';
import {aplicar, estadoEfetivo, centavosBR, ACOES} from './razao.js';
import {fotoDoMes, seloDoMes} from './contas.js';
import {demonstracao} from './demonstracao.js';
//   ?demo=1           o diário em treino já vem com agosto a outubro de exemplo (demonstracao.js): o outubro do plano,
//                     receitas, saldos, acertos, setembro fechado com selo e um evento recusado, cada um com a autora
//                     certa (os eventos entram direto no diário em treino: d.acrescentar assinaria tudo como a sessão)
//   ?diario=local     grava de verdade, cifrado, no servidor do diário que o arnês roda em /api (memória)

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const HOJE = civilDate(params.get('data') || '2026-10-19');
const ESCRITA = params.get('escrita') === '1';
const fail = (message, code) => { const error = new Error(message); error.code = code; throw error; };
const temaAtual = () => document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';

// o estado do "pacote" não muda mais em memória: o que as sócias mudam vai para o diário (treino ou ?diario=local)
let state = structuredClone(estadoFicticio);
validateState(state);
// Perfis (perfis.js): os rótulos do pacote ficam guardados; com perfis abertos, o nome deles substitui o rótulo.
const ROTULOS = Object.fromEntries(state.members.map(m => [m.id, m.displayName]));
const PERFIS = params.get('perfis') === 'demo' ? {estado: 'ok', membros: {
  'm-bauer': {nome: 'Bauer Exemplo', funcao: 'Administrador e Programador (orquestrador)', fone: '64900000001', email: 'bauer@exemplo.com', estadoCivil: 'Solteiro'},
  'm-ana': {nome: 'Ana Ribeiro Exemplo', funcao: 'Administradora', fone: '64900000002', email: 'ana@exemplo.com', estadoCivil: 'Solteira'},
  'm-bia': {nome: 'Beatriz Lima Exemplo', funcao: 'Administradora', fone: '62900000003', estadoCivil: 'Solteira'},
}} : {estado: ['outra-chave', 'ilegivel', 'indisponivel'].includes(params.get('perfis')) ? params.get('perfis') : 'ausente', membros: {}};
if (PERFIS.estado === 'ok') state.members = state.members.map(m => PERFIS.membros[m.id] ? {...m, displayName: PERFIS.membros[m.id].nome} : m);
const membroId = params.get('membro') || 'm-bauer';
const membroDe = id => { const m = state.members.find(row => row.id === id); return m ? {id: m.id, displayName: m.displayName, participationPct: m.participationPct ?? null, role: m.role} : null; };
let sessao = params.get('login') === '1' ? null : membroDe(membroId);

// O "legado" de ?legado=1: o formato de bundle.gallery ({files, titles}) com dois documentos antigos, sem stand.
const docAntigo = (titulo, corpo) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title></head><body style="font:15px/1.6 system-ui,sans-serif;padding:24px;max-width:640px"><h1 style="font-size:24px">${titulo}</h1>${corpo}</body></html>`;
const LEGADO = params.get('legado') === '1' ? {
  files: {
    'index.html': docAntigo('Galeria antiga', '<p id="legado-indice">Índice da galeria anterior. Se aparecer, o legado venceu o repositório (erro).</p>'),
    'apps/antigo-exemplo.html': docAntigo('Antigo exemplo', '<p id="legado-antigo">Documento da galeria anterior: tem a descrição, ainda não tem o app montado.</p>'),
    'apps/sinal.html': docAntigo('Sinal (antigo)', '<p id="legado-sinal">Versão antiga do Sinal. Se aparecer, o legado venceu o repositório (erro).</p>'),
  },
  titles: {'index.html': 'Galeria antiga', 'apps/antigo-exemplo.html': 'Antigo exemplo', 'apps/sinal.html': 'Sinal (antigo)'},
} : null;
const galeria = criarGaleria({base: new URL('./', location.href), legado: () => LEGADO});

window.financeHost = {
  kind: 'portal', tema: temaAtual(), galeria: params.get('galeria') === '1', team: true, readOnly: !ESCRITA, decide: false,
  // a mesma pergunta da ponte publicada: dá para gravar esta ação agora? {ok: true, treino} ou {ok: false, motivo}
  pode(acao, alvo) { return podeNoDiario(acao, alvo); },
  // as mesmas três da ponte publicada, com a mesma exigência de entrada
  async galeriaUrl(file) { if (!sessao) fail('Entre com a senha do portal.', 'unauthenticated'); return galeria.url(file); },
  galeriaTitle(file) { return sessao ? galeria.titulo(file) : null; },
  async galeriaTelaCheia(file) { if (!sessao) fail('Entre com a senha do portal.', 'unauthenticated'); return galeria.telaCheia(file); },
  perfis: {
    ler() {
      if (!sessao) return null;
      return {estado: PERFIS.estado, membros: state.members.map(m => {
        const p = (PERFIS.estado === 'ok' && PERFIS.membros[m.id]) || {};
        return {id: m.id, rotulo: ROTULOS[m.id] || m.displayName, nome: p.nome || '', funcao: p.funcao || '', fone: p.fone ? foneLegivel(p.fone) : '', foneLink: p.fone ? foneDiscavel(p.fone) : '',
          email: p.email || '', estadoCivil: p.estadoCivil || '', participacao: m.participationPct ?? null, papel: m.role === 'owner' ? 'owner' : 'member'};
      })};
    },
    conferir(texto) { if (!sessao) fail('Entre com a senha do portal.', 'unauthenticated'); return lerColado(texto, state.members.map(m => ({id: m.id, rotulo: ROTULOS[m.id] || m.displayName}))); },
    // chave fictícia do arnês: o envelope sai marcado (arnes) e abrirPerfis o recusa, para nunca virar perfis de verdade
    async cifrar(membros, remover = []) {
      if (!sessao) fail('Entre com a senha do portal.', 'unauthenticated');
      if (PERFIS.estado === 'indisponivel') fail('Os perfis de hoje não carregaram. Recarregue a página antes de atualizar, para não apagar ninguém.', 'indisponivel');
      const envelope = await cifrarPerfis(new Uint8Array(32).fill(3), {membros: juntarPerfis(PERFIS.estado === 'ok' ? PERFIS.membros : {}, membros, remover)});
      return JSON.stringify({...envelope, arnes: true}, null, 1) + '\n';
    },
  },
  livro: {
    contexto() { return sessao ? {estado: state, membro: {id: sessao.id, nome: sessao.displayName, papel: sessao.role, pct: sessao.participationPct}, hoje: HOJE} : null; },
    diario() { return diario; },
  },
};
let diario = null;
// ── o diário nas páginas antigas (copiado da ponte publicada; aqui o diário é `diario` e a sócia, `sessao`) ─────────────
let dobra = {estado: null, chave: null, aplicado: null, efetivo: null};
function dobrar(hoje) {
  const eventos = diario ? diario.eventos : [];
  const ultimo = eventos.length ? eventos[eventos.length - 1] : null;
  const chaveDobra = `${hoje}|${eventos.length}|${ultimo ? ultimo.seq + ':' + ultimo.id : ''}`;
  if (dobra.estado !== state || dobra.chave !== chaveDobra) {
    const aplicado = aplicar(state, eventos);
    dobra = {estado: state, chave: chaveDobra, aplicado, efetivo: estadoEfetivo(state, aplicado, hoje)};
  }
  return dobra;
}
const PEDIDOS_ANTIGOS = {toggle_step: 'toggle_step', edit_plan: 'edit_plan', set_subscription: 'archive_plan'};
function podeNoDiario(acao, alvo) {
  if (acao === 'set_decision') return {ok: false, motivo: 'As decisões se registram na aba Finanças do AI Cask.'};
  if (!ACOES.includes(acao) && !Object.hasOwn(PEDIDOS_ANTIGOS, acao)) return {ok: false, motivo: 'Esta ação ainda não grava no portal.'};
  if (!sessao) return {ok: false, motivo: 'Entre com a senha do portal.'};
  const d = diario;
  if (!d) return {ok: false, motivo: 'O diário cifrado ainda está abrindo: um instante.'};
  if (d.modo !== 'gravacao' && d.modo !== 'treino' && d.modo !== 'indisponivel') return {ok: false, motivo: d.motivo || 'Você lê o diário, mas não grava.'};
  const resposta = {ok: true, treino: d.modo !== 'gravacao'};
  if (acao === 'confirm_plan' && typeof alvo === 'string') {
    const {aplicado} = dobrar(HOJE);
    const plano = aplicado.planos.find(p => p.id === alvo);
    if (plano) {
      const previa = aplicar(state, [...d.eventos, {seq: Infinity, id: 'previa-pode', membro: sessao.id, conteudo: {acao, alvo, versao: plano.versao, quando: new Date().toISOString()}}]);
      const recusa = previa.recusados.find(r => r.id === 'previa-pode');
      if (recusa) return {ok: false, motivo: recusa.motivo};
    }
  }
  return resposta;
}
function eventoDoPedido(action, payload, aplicado) {
  const id = typeof payload.id === 'string' && payload.id ? payload.id : null;
  if (!id) fail('Recarregue o portal: o pedido veio sem o identificador do registro.', 'invalid_request');
  const versao = Number.isSafeInteger(payload.version) && payload.version >= 1 ? payload.version : null;
  if (action === 'toggle_step') {
    if (typeof payload.checked !== 'boolean') fail('Passo inválido.', 'invalid_request');
    return {conteudo: {acao: 'toggle_step', alvo: id, versao, dados: {feito: payload.checked}}, ok: payload.checked ? 'Passo marcado.' : 'Marcação removida.'};
  }
  const plano = aplicado.planos.find(p => p.id === id);
  if (!plano) fail('Esta assinatura não existe mais: recarregue o portal.', 'stale_plan');
  if (action === 'set_subscription') {
    if (typeof payload.active !== 'boolean') fail('Informe a assinatura e o estado desejado.', 'invalid_request');
    if (payload.active) return {conteudo: {acao: 'reactivate_plan', alvo: id, versao}, ok: 'Assinatura reativada.'};
    return {conteudo: {acao: 'archive_plan', alvo: id, versao, dados: {desde: typeof payload.desde === 'string' ? payload.desde : ''}, motivo: typeof payload.motivo === 'string' ? payload.motivo.trim() : ''}, ok: 'Assinatura encerrada.'};
  }
  const valores = payload.values && typeof payload.values === 'object' ? payload.values : {};
  const dados = {};
  // o valor se lê na moeda nova, se ela também mudou; moeda e período o razão confere (MOEDAS, EQUIVALENTE)
  const moedaNova = typeof valores.moeda === 'string' && valores.moeda.trim() ? valores.moeda.trim() : null;
  for (const [campo, bruto] of Object.entries(valores)) {
    const v = String(bruto ?? '').trim();
    if (campo === 'valor') { const minor = centavosBR(v, moedaNova || plano.moeda || 'BRL'); if (minor === null) fail('Valor não reconhecido: use vírgula para os centavos (ex.: 59,90).', 'invalid_request'); dados.valorMinor = minor; }
    else if (campo === 'moeda') dados.moeda = v;
    else if (campo === 'periodo') dados.periodo = v;
    else if (campo === 'proxima_data') dados.proximaData = v || null;
    else if (campo === 'dia') dados.diaVencimento = v ? Number(v) : null;
    else if (campo === 'status') dados.status = v;
    else fail('Edite somente valor, moeda, período, vencimento, próxima data e status.', 'invalid_request');
  }
  if (!Object.keys(dados).length) fail('Diga o que mudou na assinatura.', 'invalid_request');
  return {conteudo: {acao: 'edit_plan', alvo: id, versao, dados}, ok: 'Assinatura alterada.'};
}
async function gravarPedido(action, payload) {
  const pode = podeNoDiario(action);
  if (!pode.ok) fail(pode.motivo, 'read_only');
  const livro = window.financeLivro;
  if (!livro || typeof livro.gravar !== 'function') fail('O portal ainda está carregando: tente de novo em instantes.', 'not_ready');
  const {conteudo, ok} = eventoDoPedido(action, payload || {}, dobrar(HOJE).aplicado);
  const r = await livro.gravar(conteudo, ok, {erroNoFormulario: true});
  if (!r || !r.ok) {
    const erro = new Error((r && r.erro) || 'Não foi possível gravar.');
    erro.code = r && r.codigo === 'versao' ? (action === 'toggle_step' ? 'stale_step' : 'stale_plan') : (r && r.codigo) || 'recusado';
    if (r && r.atual) erro.atual = r.atual;
    throw erro;
  }
  document.dispatchEvent(new CustomEvent('financeiro:diario'));
  return {saved: true, treino: !!r.treino, id: conteudo.alvo};
}
async function abrirDiarioDoArnes() {
  if (!sessao) return;
  const d = await abrirDiario({url: params.get('diario') === 'local' ? location.origin : null, membroId: sessao.id, senha: 'arnes-' + sessao.id, masterRaw: new Uint8Array(32).fill(3)});
  if (params.get('demo') === '1' && d.modo === 'treino') {
    const ultimo = d.eventos.length ? d.eventos[d.eventos.length - 1].seq : 0;
    for (const ev of demonstracao(state, {fotoDoMes, seloDoMes, aplicar}, {primeiroSeq: ultimo + 1})) d.eventos.push({...ev, treino: true});
  }
  diario = d;
  document.dispatchEvent(new CustomEvent('financeiro:diario'));
}
const usuario = m => ({user: {nome: m.displayName, participacao_pct: m.participationPct ?? null, decide: false}, must_change_password: false, decide: false});
window.financeWebRequest = async (action, payload = {}) => {
  if (action === 'restore_session') { if (!sessao) fail('Entre com a senha do portal.', 'unauthenticated'); if (!diario) abrirDiarioDoArnes(); return usuario(sessao); }
  if (action === 'login') { sessao = membroDe(membroId); if (!sessao) fail('Seu perfil não está neste pacote.', 'no_account'); abrirDiarioDoArnes(); return usuario(sessao); }
  if (action === 'logout') { sessao = null; galeria.esquecer(); return {logged_out: true}; }
  if (action === 'preferences') { window.financeHost.tema = payload.tema === 'escuro' ? 'escuro' : 'claro'; return {tema: window.financeHost.tema}; }
  if (action === 'change_password') fail('A senha do portal é definida pelo Criador, fora do painel.', 'identity_managed');
  if (!sessao) fail('Entre com a senha do portal.', 'unauthenticated');
  if (action === 'snapshot') {
    let result;
    try { result = buildSnapshot(dobrar(HOJE).efetivo, sessao, HOJE); }
    catch (erro) { console.error('O diário não coube no painel; mostrando só o pacote:', erro); result = buildSnapshot(state, sessao, HOJE); }
    return payload.if_revision === result.content_revision ? {unchanged: true, content_revision: result.content_revision} : result;
  }
  if (action === 'set_decision') fail('As decisões se registram na aba Finanças do AI Cask.', 'read_only');
  if (Object.hasOwn(PEDIDOS_ANTIGOS, action)) return gravarPedido(action, payload);
  fail('Esta ação ainda não existe na versão publicada.', 'read_only');
};

// "Minha equipe" (copiado da ponte publicada; o roster aqui é o cadastro fictício).
window.financeOpenTeam = async () => {
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  let dialog = $('cloud-team');
  if (!dialog) { dialog = node('dialog', undefined, 'asset-dialog cloud-team'); dialog.id = 'cloud-team'; dialog.setAttribute('aria-label', 'Equipe e participação'); document.body.append(dialog); }
  dialog.replaceChildren();
  const heading = node('div', undefined, 'asset-dialog-heading');
  const fechar = node('button', 'Fechar', 'button button-outline'); fechar.type = 'button'; fechar.addEventListener('click', () => dialog.close());
  heading.append(node('h2', 'Equipe e participação'), fechar); dialog.append(heading);
  dialog.append(node('p', 'Os perfis abaixo definem o rateio. Nesta versão publicada a lista é só de leitura; quem edita é o AI Cask.', 'section-intro'));
  for (const m of state.members) {
    const group = node('section', undefined, 'cloud-member');
    group.append(node('h3', m.displayName), node('p', (m.participationPct === null || m.participationPct === undefined ? 'Participação não informada' : `Participação: ${m.participationPct}%`) + (m.role === 'owner' ? ' · responsável' : ''), 'form-help'));
    dialog.append(group);
  }
  dialog.showModal();
};

// Mesma preparação da tela de entrada da ponte publicada (sem CPF, sem "lembrar", com o olho da senha).
function prepareForm() {
  const cpf = $('login-cpf');
  if (cpf) { cpf.required = false; ['pattern', 'minlength', 'maxlength'].forEach(a => cpf.removeAttribute(a)); const row = cpf.closest('.field') || cpf.parentElement; row.hidden = true; }
  const remember = $('login-remember'); if (remember) { const row = remember.closest('label'); if (row) row.hidden = true; }
  const help = $('login-help'); if (help) help.textContent = 'A senha é a do portal. Sem senha? Fale com o Criador.';
  const form = $('login-form'); if (form) { form.hidden = false; form.inert = false; form.removeAttribute('aria-hidden'); }
}
function olhoDaSenha() {
  const input = $('login-password'); if (!input || $('login-olho')) return;
  const caixa = document.createElement('div'); caixa.className = 'campo-senha'; input.parentNode.insertBefore(caixa, input); caixa.appendChild(input);
  const botao = document.createElement('button'); botao.type = 'button'; botao.id = 'login-olho'; botao.className = 'olho'; botao.textContent = 'Mostrar'; botao.setAttribute('aria-pressed', 'false'); botao.setAttribute('aria-controls', 'login-password'); caixa.appendChild(botao);
  botao.addEventListener('click', () => { const ver = input.type === 'password'; input.type = ver ? 'text' : 'password'; botao.textContent = ver ? 'Ocultar' : 'Mostrar'; botao.setAttribute('aria-pressed', String(ver)); input.focus(); });
}
prepareForm(); olhoDaSenha();
window.arnes = {hoje: HOJE, escrita: ESCRITA, estado: () => structuredClone(state), efetivo: () => structuredClone(dobrar(HOJE).efetivo)};
