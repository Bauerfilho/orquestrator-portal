// PONTE SIMULADA (arnês local de fotos e testes). Substitui a ponte estática publicada (static-bridge.publicado.js):
// mesma interface (window.financeHost + window.financeWebRequest), mas os dados vêm de estado-ficticio.js e não há
// senha nem pacote cifrado. O domínio é o domain.js publicado, sem mudança: buildSnapshot faz toda a conta.
//
// Parâmetros de URL (todos opcionais):
//   ?login=1          mostra a tela de entrada (restore_session falha; qualquer senha entra)
//   ?data=AAAA-MM-DD  data civil do cálculo (padrão 2026-10-19, para as fotos serem reproduzíveis)
//   ?membro=m-ana     quem está vendo (m-bauer, m-ana, m-bia)
//   ?escrita=1        readOnly false: toggle_step / edit_plan / set_subscription aplicam applyMutation em memória
//                     (guardado em sessionStorage; ?zerar=1 volta ao estado fictício)
//   ?galeria=1        mostra o item Laboratório no menu (a galeria real vive no pacote cifrado; aqui é um marcador)
import {buildSnapshot, validateState, applyMutation, civilDate} from './domain.js';
import {estadoFicticio} from './estado-ficticio.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const HOJE = civilDate(params.get('data') || '2026-10-19');
const ESCRITA = params.get('escrita') === '1';
const GUARDA = 'arnes-financas.estado';
const fail = (message, code) => { const error = new Error(message); error.code = code; throw error; };
const temaAtual = () => document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';

function estadoInicial() {
  if (ESCRITA && params.get('zerar') !== '1') {
    try { const salvo = JSON.parse(sessionStorage.getItem(GUARDA) || 'null'); if (salvo) { validateState(salvo); return salvo; } } catch {}
  }
  try { sessionStorage.removeItem(GUARDA); } catch {}
  return structuredClone(estadoFicticio);
}
let state = estadoInicial();
validateState(state);
const membroId = params.get('membro') || 'm-bauer';
const membroDe = id => { const m = state.members.find(row => row.id === id); return m ? {id: m.id, displayName: m.displayName, participationPct: m.participationPct ?? null, role: m.role} : null; };
let sessao = params.get('login') === '1' ? null : membroDe(membroId);

window.financeHost = {
  kind: 'portal', tema: temaAtual(), galeria: params.get('galeria') === '1', team: true, readOnly: !ESCRITA, decide: false,
  galeriaUrl() { return URL.createObjectURL(new Blob(['<!doctype html><meta charset="utf-8"><body style="font:15px system-ui;padding:24px">Galeria de maquetes: vive no pacote cifrado do portal; o arnês não a reproduz.</body>'], {type: 'text/html'})); },
  galeriaTitle() { return 'Galeria de maquetes (marcador do arnês)'; },
};

const usuario = m => ({user: {nome: m.displayName, participacao_pct: m.participationPct ?? null, decide: false}, must_change_password: false, decide: false});
window.financeWebRequest = async (action, payload = {}) => {
  if (action === 'restore_session') { if (!sessao) fail('Entre com a senha do portal.', 'unauthenticated'); return usuario(sessao); }
  if (action === 'login') { sessao = membroDe(membroId); if (!sessao) fail('Seu perfil não está neste pacote.', 'no_account'); return usuario(sessao); }
  if (action === 'logout') { sessao = null; return {logged_out: true}; }
  if (action === 'preferences') { window.financeHost.tema = payload.tema === 'escuro' ? 'escuro' : 'claro'; return {tema: window.financeHost.tema}; }
  if (action === 'change_password') fail('A senha do portal é definida pelo Criador, fora do painel.', 'identity_managed');
  if (!sessao) fail('Entre com a senha do portal.', 'unauthenticated');
  if (action === 'snapshot') {
    const result = buildSnapshot(state, sessao, HOJE);
    return payload.if_revision === result.content_revision ? {unchanged: true, content_revision: result.content_revision} : result;
  }
  if (action === 'set_decision') fail('As decisões se registram na aba Finanças do AI Cask.', 'read_only');
  if (ESCRITA && ['toggle_step', 'edit_plan', 'set_subscription'].includes(action)) {
    const {state: next, result} = applyMutation(state, action, payload, sessao, HOJE);
    state = next;
    try { sessionStorage.setItem(GUARDA, JSON.stringify(state)); } catch {}
    return result;
  }
  fail('Esta versão publicada é só de leitura. As mudanças se fazem na aba Finanças do AI Cask.', 'read_only');
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
window.arnes = {hoje: HOJE, escrita: ESCRITA, estado: () => structuredClone(state)};
