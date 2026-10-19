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
//   ?perfis=demo      perfis fictícios abertos (nome, função, contato), como se perfis.json tivesse decifrado;
//                     ?perfis=outra-chave simula o envelope de uma chave mestra antiga; sem o parâmetro, "ausente"
//   ?galeria=1        mostra o item Laboratório no menu, com a galeria de verdade: a pasta galeria/ do repositório
//                     (o publicador do ia-chat a preenche) lida pelo mesmo galeria.js da ponte publicada
//   ?legado=1         junta um pacote antigo fictício, como o do pacote cifrado: apps/antigo-exemplo.html entra no
//                     catálogo como "Sem stand" e um apps/sinal.html antigo, que tem de PERDER para o do repositório
import {buildSnapshot, validateState, applyMutation, civilDate} from './domain.js';
import {estadoFicticio} from './estado-ficticio.js';
import {abrirDiario} from './diario.js';
import {criarGaleria} from './galeria.js';
import {cifrarPerfis, lerColado, juntarPerfis, foneLegivel, foneDiscavel} from './perfis.js';
import {aplicar} from './razao.js';
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
