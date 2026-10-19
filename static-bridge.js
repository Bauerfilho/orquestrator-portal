// A ponte estática do Finanças (GitHub Pages): a mesma interface da ponte nativa do AI Cask (financeRequest), com os dados
// vindos do pacote cifrado e o domínio (domain.js) rodando no navegador. Só leitura: as mutações respondem read_only; as
// mudanças se fazem na aba Finanças do AI Cask. A chave mestra vive SÓ em memória (nunca em storage): recarregar = entrar de novo.
import {unlock, fetchManifest, loadBundle, b64} from './portal-crypto.js';
import {buildSnapshot, civilDate, validateState} from './domain.js';
import {abrirDiario} from './diario.js';
// O servidor do diário cifrado (servidor/LEIA.md). Sem ele publicado, o diário roda em modo treino e a tela diz isso.
const DIARIO_URL = 'https://orquestrator-diario.netlify.app';
const $ = id => document.getElementById(id);
const base = new URL('./', location.href);
let manifest = null, bundle = null, member = null, state = null, chave = null;
const blobs = new Map();
let painelBlob = null;
let diarioAtual = null, diarioPromessa = null;
const fail = (message, code) => { const error = new Error(message); error.code = code; throw error; };
const temaAtual = () => document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
const domainMember = m => ({id: m.id, displayName: m.displayName, participationPct: m.participationPct ?? null, role: m.role === 'owner' ? 'owner' : 'member'});
// O host, para a interface saber onde está: portal = só leitura, com Laboratório, com "Minha equipe", sem decisão.
window.financeHost = {
  kind: 'portal', tema: temaAtual(), galeria: true, team: true, readOnly: true, decide: false,
  // URL (sem fragmento) de uma página da galeria, servida de blob: nesta aba; o app acrescenta o fragmento #tema=.
  galeriaUrl(file) {
    if (!bundle) fail('Entre com a senha do portal.', 'unauthenticated');
    const nome = String(file || 'index.html').replace(/^\.\.\//, '').replace(/#.*$/, '');
    if (!/^(index\.html|apps\/[a-z0-9-]+\.html)$/.test(nome)) fail('Página não encontrada: ' + nome, 'not_found');
    if (!blobs.has(nome)) {
      const html = bundle.gallery.files[nome];
      if (typeof html !== 'string') fail('Página não encontrada: ' + nome, 'not_found');
      blobs.set(nome, URL.createObjectURL(new Blob([html], {type: 'text/html'})));
    }
    return blobs.get(nome);
  },
  galeriaTitle(file) { const nome = String(file || '').replace(/^\.\.\//, '').replace(/#.*$/, ''); return (bundle && bundle.gallery.titles[nome]) || null; },
  // A mesa de teste do Med Painel (18/10/2026): selada à parte em painel/<slug>/, com a chave mestra dentro deste pacote.
  // Quem entrou no Finanças abre sem segunda senha; o mesmo endereço, com a senha própria, é o link para quem não é do portal.
  // Livro do mês, Lançamentos, Parâmetros e Histórico (livro.js): o estado canônico do pacote + o diário das sócias
  livro: {
    contexto() {
      if (!state || !member) return null;
      return {estado: state, membro: {id: member.id, nome: member.displayName, papel: member.role === 'owner' ? 'owner' : 'member', pct: member.participationPct ?? null}, hoje: civilDate(new Date())};
    },
    diario() { return diarioAtual; },
  },
  painelLink() { return bundle && bundle.painel && /^[a-f0-9]{16}$/.test(bundle.painel.slug || '') ? new URL('painel/' + bundle.painel.slug + '/', base).href : ''; },
  async painelUrl() {
    if (!bundle) fail('Entre com a senha do portal.', 'unauthenticated');
    const p = bundle.painel;
    if (!p || !/^[a-f0-9]{16}$/.test(p.slug || '') || typeof p.masterRaw !== 'string') fail('A mesa de teste não veio neste pacote.', 'not_found');
    if (!painelBlob) {
      const raiz = new URL('painel/' + p.slug + '/', base);
      const conteudo = await loadBundle(raiz, await fetchManifest(raiz), b64.dec(p.masterRaw));
      if (!conteudo || typeof conteudo.html !== 'string') fail('A mesa de teste veio incompleta.', 'not_found');
      painelBlob = URL.createObjectURL(new Blob([conteudo.html], {type: 'text/html'}));
    }
    return painelBlob;
  },
};
async function getManifest() { return manifest ??= await fetchManifest(base); }
function esquecer() { chave = bundle = state = member = null; diarioAtual = null; diarioPromessa = null; for (const u of blobs.values()) { try { URL.revokeObjectURL(u); } catch {} } blobs.clear(); if (painelBlob) { try { URL.revokeObjectURL(painelBlob); } catch {} painelBlob = null; } }
async function activate(sess) {
  bundle = await loadBundle(base, await getManifest(), sess.masterRaw);
  const roster = bundle.finance.roster;
  member = roster.find(r => r.portalId === sess.memberId) || null;
  if (!member) { esquecer(); fail('Seu perfil não está neste pacote.', 'no_account'); }
  state = structuredClone(bundle.finance.state);
  state.members = roster.map(domainMember);
  state.staticBlocks ??= {}; state.staticBlocks.atlas ??= {};
  if (!Array.isArray(state.staticBlocks.atlas.assets) || !state.staticBlocks.atlas.assets.length) state.staticBlocks.atlas.assets = bundle.finance.assets || [];
  validateState(state);
  chave = sess;
  return {user: {nome: member.displayName, participacao_pct: member.participationPct ?? null, decide: false}, must_change_password: false, decide: false};
}
function prepareForm() {
  // No portal a senha identifica o membro: sem CPF e sem "lembrar" (a sessão dura enquanto a página estiver aberta).
  const cpf = $('login-cpf');
  if (cpf) { cpf.required = false; ['pattern', 'minlength', 'maxlength'].forEach(a => cpf.removeAttribute(a)); const row = cpf.closest('.field') || cpf.parentElement; row.hidden = true; }
  const remember = $('login-remember'); if (remember) { const row = remember.closest('label'); if (row) row.hidden = true; }
  const help = $('login-help'); if (help) help.textContent = 'A senha é a do portal. Sem senha? Fale com o Criador.';
  const access = $('cloud-access'); if (access) access.hidden = true;
  const form = $('login-form'); if (form) { form.hidden = false; form.inert = false; form.removeAttribute('aria-hidden'); }
}
window.financeWebRequest = async (action, payload = {}) => {
  if (action === 'restore_session') {
    if (!chave) fail('Entre com a senha do portal.', 'unauthenticated');
    try { return await activate(chave); }
    catch (error) { if (error.code === 'no_account') throw error; esquecer(); fail('A sessão acabou. Entre de novo.', 'unauthenticated'); }
  }
  if (action === 'login') {
    const got = await unlock(await getManifest(), String(payload.password || ''));
    if (!got) fail('Senha não reconhecida.', 'unauthenticated');
    const entrada = await activate(got);
    // a chave do diário vem da senha (PBKDF2, ~meio segundo): abre em segundo plano, sem atrasar a entrada
    const memberId = member.id, senha = String(payload.password || '');
    diarioPromessa = abrirDiario({url: DIARIO_URL, membroId: memberId, senha, masterRaw: got.masterRaw instanceof Uint8Array ? got.masterRaw : b64.dec(got.masterRaw)})
      .then(d => { if (member && member.id === memberId) { diarioAtual = d; document.dispatchEvent(new CustomEvent('financeiro:diario')); } })
      .catch(() => {});
    return entrada;
  }
  if (action === 'logout') { esquecer(); return {logged_out: true}; }
  if (action === 'preferences') { window.financeHost.tema = payload.tema === 'escuro' ? 'escuro' : 'claro'; return {tema: window.financeHost.tema}; }
  if (action === 'change_password') fail('A senha do portal é definida pelo Criador, fora do painel.', 'identity_managed');
  if (!state) fail('Entre com a senha do portal.', 'unauthenticated');
  if (action === 'snapshot') {
    const result = buildSnapshot(state, domainMember(member), civilDate(new Date()));
    return payload.if_revision === result.content_revision ? {unchanged: true, content_revision: result.content_revision} : result;
  }
  if (action === 'set_decision') fail('As decisões se registram na aba Finanças do AI Cask.', 'read_only');
  fail('Esta versão publicada é só de leitura. As mudanças se fazem na aba Finanças do AI Cask.', 'read_only');
};
window.financeOpenTeam = async () => {
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  let dialog = $('cloud-team');
  if (!dialog) { dialog = node('dialog', undefined, 'asset-dialog cloud-team'); dialog.id = 'cloud-team'; dialog.setAttribute('aria-label', 'Equipe e participação'); document.body.append(dialog); }
  dialog.replaceChildren();
  const heading = node('div', undefined, 'asset-dialog-heading');
  const fechar = node('button', 'Fechar', 'button button-outline'); fechar.type = 'button'; fechar.addEventListener('click', () => dialog.close());
  heading.append(node('h2', 'Equipe e participação'), fechar); dialog.append(heading);
  dialog.append(node('p', 'Os perfis abaixo definem o rateio. Nesta versão publicada a lista é só de leitura; quem edita é o AI Cask.', 'section-intro'));
  const roster = (bundle && bundle.finance.roster) || [];
  if (!roster.length) dialog.append(node('p', 'Nenhum perfil disponível.'));
  for (const m of roster) {
    const group = node('section', undefined, 'cloud-member');
    group.append(node('h3', m.displayName), node('p', (m.participationPct === null || m.participationPct === undefined ? 'Participação não informada' : `Participação: ${m.participationPct}%`) + (m.role === 'owner' ? ' · responsável' : ''), 'form-help'));
    dialog.append(group);
  }
  dialog.showModal();
};
// O olho da senha: mostra o que foi digitado (o erro mais comum é um caractere trocado numa senha longa).
function olhoDaSenha() {
  const input = $('login-password'); if (!input || $('login-olho')) return;
  const caixa = document.createElement('div'); caixa.className = 'campo-senha'; input.parentNode.insertBefore(caixa, input); caixa.appendChild(input);
  const botao = document.createElement('button'); botao.type = 'button'; botao.id = 'login-olho'; botao.className = 'olho'; botao.textContent = 'Mostrar'; botao.setAttribute('aria-pressed', 'false'); botao.setAttribute('aria-controls', 'login-password'); caixa.appendChild(botao);
  botao.addEventListener('click', () => { const ver = input.type === 'password'; input.type = ver ? 'text' : 'password'; botao.textContent = ver ? 'Ocultar' : 'Mostrar'; botao.setAttribute('aria-pressed', String(ver)); input.focus(); });
}
prepareForm(); olhoDaSenha();
