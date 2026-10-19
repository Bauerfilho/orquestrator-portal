// A ponte estática do Finanças (GitHub Pages): a mesma interface da ponte nativa do AI Cask (financeRequest), com os dados
// vindos do pacote cifrado e o domínio (domain.js) rodando no navegador. As mutações antigas do pacote respondem read_only;
// o que as sócias gravam (lançamentos, parâmetros, perfis…) vai pelo diário cifrado (diario.js). A chave mestra vive em
// memória; recarregar = entrar de novo, a não ser que a sócia tenha marcado "Lembrar deste aparelho" (lembrar.js): aí a
// mestra fica no IndexedDB, cifrada com uma chave do aparelho que não se copia, e a entrada é direta. A senha nunca fica.
import {unlock, fetchManifest, loadBundle, b64} from './portal-crypto.js';
import {buildSnapshot, civilDate, validateState} from './domain.js';
import {abrirDiario, chaveDaSenhaDoDiario} from './diario.js';
import {lembrarAparelho, esquecerAparelho, lembrado, mostrarCaixaLembrar} from './lembrar.js';
import {criarGaleria} from './galeria.js';
import {carregarPerfis, lerColado, mesclarPerfis, podeEditarPerfil, perfilParaTela, estadoDosPerfis, marcaDosPerfis, acompanharDiario} from './perfis.js';
import {aplicar, limparPerfil} from './razao.js';
// O servidor do diário cifrado (servidor/LEIA.md). Sem ele publicado, o diário roda em modo treino e a tela diz isso.
const DIARIO_URL = 'https://orquestrator-diario.netlify.app';
const $ = id => document.getElementById(id);
const base = new URL('./', location.href);
let manifest = null, bundle = null, member = null, state = null, chave = null;
let painelBlob = null;
let diarioAtual = null, diarioPromessa = null;
// Perfis da sociedade (perfis.js): nome, função e contato de cada sócia. Desde 19/10 (noite) gravam pelo diário cifrado
// (set_profile, razao.js); o perfis.json antigo, cifrado com a chave mestra, ainda é lido. O nome que o portal mostra é o
// do perfil do diário > o do perfis.json > o rótulo do pacote ("Sócio 1"…), em todo o portal. Quando o diário abre ou
// muda (financeiro:diario, sincronizar, acrescentar), atualizarPerfis() refaz a mescla e os nomes de state.members: as
// leituras (snapshot, livro, perfis, Minha equipe) chamam antes de responder, e só custa quando há evento novo.
const SEM_PERFIS = {estado: 'ausente', membros: {}};
let perfisArquivo = SEM_PERFIS;
const acompanhar = acompanharDiario();
let mescla = {}, mesclaBase = null;
const nomeVisivel = m => (mescla[m.id] && mescla[m.id].perfil && mescla[m.id].perfil.nome) || m.displayName;
function atualizarPerfis() {
  if (!bundle || !state) return;
  const aplicado = acompanhar.sobre(state, diarioAtual);
  if (mesclaBase && mesclaBase.aplicado === aplicado && mesclaBase.arquivo === perfisArquivo) return;
  const roster = bundle.finance.roster;
  mescla = mesclarPerfis(roster.map(m => m.id), perfisArquivo, aplicado);
  mesclaBase = {aplicado, arquivo: perfisArquivo};
  state.members = roster.map(m => domainMember({...m, displayName: nomeVisivel(m)}));
}
const fail = (message, code) => { const error = new Error(message); error.code = code; throw error; };
const temaAtual = () => document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
const domainMember = m => ({id: m.id, displayName: m.displayName, participationPct: m.participationPct ?? null, role: m.role === 'owner' ? 'owner' : 'member'});
// O Laboratório (galeria.js): o catálogo e as maquetes vêm de galeria/ deste repositório; os documentos antigos do
// pacote cifrado entram como "Sem stand" (o do repositório vence). Só com o portal aberto pela senha.
const galeria = criarGaleria({base, legado: () => bundle && bundle.gallery});
// O host, para a interface saber onde está: portal = só leitura, com Laboratório, com "Minha equipe", sem decisão.
window.financeHost = {
  kind: 'portal', tema: temaAtual(), galeria: true, team: true, readOnly: true, decide: false,
  // URL (sem fragmento) de uma página da galeria, servida de blob: nesta aba; o app acrescenta o fragmento #tema=.
  // Assíncrona: a página vem do repositório (fetch na mesma origem) e só cai no pacote se o repositório não a tiver.
  async galeriaUrl(file) {
    if (!bundle) fail('Entre com a senha do portal.', 'unauthenticated');
    return galeria.url(file);
  },
  galeriaTitle(file) { return bundle ? galeria.titulo(file) : null; },
  // A página de tela cheia da maquete (apps/<id>/, pública, para a Tela de Início do iPhone), ou null se não houver.
  async galeriaTelaCheia(file) {
    if (!bundle) fail('Entre com a senha do portal.', 'unauthenticated');
    return galeria.telaCheia(file);
  },
  // A mesa de teste do Med Painel (18/10/2026): selada à parte em painel/<slug>/, com a chave mestra dentro deste pacote.
  // Quem entrou no Finanças abre sem segunda senha; o mesmo endereço, com a senha própria, é o link para quem não é do portal.
  // Livro do mês, Lançamentos, Parâmetros e Histórico (livro.js): o estado canônico do pacote + o diário das sócias
  livro: {
    contexto() {
      if (!state || !member) return null;
      atualizarPerfis();
      return {estado: state, membro: {id: member.id, nome: nomeVisivel(member), papel: member.role === 'owner' ? 'owner' : 'member', pct: member.participationPct ?? null}, hoje: civilDate(new Date())};
    },
    diario() { return diarioAtual; },
  },
  // Sociedade: a mescla dos perfis (ler, com a fonte de cada um e se quem vê pode editar), a colagem conferida contra o
  // roster (conferir, que só preenche o formulário) e a gravação pelo diário (salvar = evento set_profile). Sem senha, nada.
  perfis: {
    ler() {
      if (!bundle || !member) return null;
      atualizarPerfis();
      const d = diarioAtual;
      return {estado: estadoDosPerfis(mescla, perfisArquivo), arquivo: perfisArquivo.estado, eu: member.id, responsavel: member.role === 'owner',
        diario: {modo: d ? d.modo : 'abrindo', motivo: d ? d.motivo || '' : ''},
        membros: bundle.finance.roster.map(m => perfilParaTela(m, m.displayName, mescla[m.id], podeEditarPerfil(member, m.id)))};
    },
    podeEditar(id) { return podeEditarPerfil(member, id); },
    conferir(texto) {
      if (!bundle) fail('Entre com a senha do portal.', 'unauthenticated');
      atualizarPerfis();
      return lerColado(texto, bundle.finance.roster.map(m => ({id: m.id, rotulo: m.displayName, nome: (mescla[m.id] && mescla[m.id].perfil && mescla[m.id].perfil.nome) || ''})));
    },
    // grava pelo diário, conferindo antes pelo mesmo razão (a recusa volta com o motivo e o código, sem enviar nada).
    // Com o diário em treino (servidor fora, chave aguardando), fica só na memória desta página e some ao recarregar
    // (diario.js não guarda nem reenvia o treino): o resultado diz {treino: true} e a tela avisa.
    async salvar(id, perfil) {
      if (!bundle || !member || !state) fail('Entre com a senha do portal.', 'unauthenticated');
      if (!bundle.finance.roster.some(m => m.id === id)) fail('Esta sócia não está no pacote.', 'invalido');
      if (!podeEditarPerfil(member, id)) fail('Você só edita o seu perfil. A responsável edita o de todas.', 'permissao');
      const d = diarioAtual;
      if (!d || typeof d.acrescentar !== 'function') fail('O diário ainda está abrindo. Tente de novo em instantes.', 'indisponivel');
      const conteudo = {acao: 'set_profile', alvo: id, dados: perfil === null ? null : limparPerfil(perfil)};
      const previa = aplicar(state, [...d.eventos, {seq: Infinity, id: 'previa', membro: member.id, conteudo: {...conteudo, quando: new Date().toISOString()}}]);
      const recusa = previa.recusados.find(r => r.id === 'previa');
      if (recusa) fail(recusa.motivo, recusa.codigo || 'invalido');
      const r = await d.acrescentar(conteudo);
      if (!r || !r.ok) fail((r && r.erro) || 'Não deu para gravar agora. Tente de novo.', 'indisponivel');
      atualizarPerfis();
      document.dispatchEvent(new CustomEvent('financeiro:diario'));
      return {ok: true, treino: !!r.treino, modo: d.modo, nome: perfil === null ? '' : nomeVisivel(bundle.finance.roster.find(m => m.id === id))};
    },
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
function esquecer() { chave = bundle = state = member = null; perfisArquivo = SEM_PERFIS; mescla = {}; mesclaBase = null; acompanhar.esquecer(); diarioAtual = null; diarioPromessa = null; galeria.esquecer(); if (painelBlob) { try { URL.revokeObjectURL(painelBlob); } catch {} painelBlob = null; } }
async function activate(sess) {
  bundle = await loadBundle(base, await getManifest(), sess.masterRaw);
  const roster = bundle.finance.roster;
  member = roster.find(r => r.portalId === sess.memberId) || null;
  if (!member) { esquecer(); fail('Seu perfil não está neste pacote.', 'no_account'); }
  state = structuredClone(bundle.finance.state);
  perfisArquivo = await carregarPerfis(base, sess.masterRaw);
  state.members = roster.map(m => domainMember(m));
  state.staticBlocks ??= {}; state.staticBlocks.atlas ??= {};
  if (!Array.isArray(state.staticBlocks.atlas.assets) || !state.staticBlocks.atlas.assets.length) state.staticBlocks.atlas.assets = bundle.finance.assets || [];
  validateState(state);
  // os nomes: o diário (se já aberto, num restore_session) > perfis.json > rótulo do pacote
  mesclaBase = null; acompanhar.esquecer();
  atualizarPerfis();
  chave = sess;
  return {user: {nome: nomeVisivel(member), participacao_pct: member.participationPct ?? null, decide: false}, must_change_password: false, decide: false};
}
// A sessão de um diário que abre em segundo plano (a chave da senha, já derivada ou a caminho, e a mestra do pacote).
function abrirDiarioDaSessao(memberId, kek, masterRaw) {
  diarioPromessa = Promise.resolve(kek).then(k => abrirDiario({url: DIARIO_URL, membroId: memberId, kek: k, masterRaw}))
    .then(d => { if (member && member.id === memberId) { diarioAtual = d; atualizarPerfis(); document.dispatchEvent(new CustomEvent('financeiro:diario')); } })
    .catch(() => {});
}
// "Lembrar deste aparelho": a entrada sem senha. Lê o que o aparelho lembra, confere que a sócia ainda está no manifesto,
// abre o pacote e o perfis.json de novo (activate, frescos) e o diário com a chave guardada. O que não fecha (pacote
// lacrado de novo, chave que não abre, no_account, IndexedDB limpo ou indisponível) apaga o registro e devolve null: a
// tela de entrada aparece, sem erro. Sem rede, o registro fica para a próxima vez.
const semRede = erro => erro instanceof TypeError || /baixar o pacote|manifesto/.test(String(erro && erro.message));
async function entrarPeloAparelho() {
  let aberto;
  try { aberto = await lembrado(); } catch { return null; }
  if (!aberto) return null;
  const desistir = async () => { esquecer(); await esquecerAparelho().catch(() => {}); return null; };
  let lista;
  try { lista = await getManifest(); } catch { return null; }
  if (!Array.isArray(lista.members) || !lista.members.some(m => m && m.id === aberto.memberId)) return desistir();
  let entrada;
  try { entrada = await activate({memberId: aberto.memberId, masterRaw: aberto.masterRaw}); }
  catch (erro) { if (semRede(erro)) { esquecer(); return null; } return desistir(); }
  if (!member || member.id !== aberto.membroDiario) return desistir();
  abrirDiarioDaSessao(member.id, aberto.diarioKek, aberto.masterRaw);
  return entrada;
}
function prepareForm() {
  // No portal a senha identifica o membro: sem CPF. "Lembrar deste aparelho" (lembrar.js) deixa entrar direto depois.
  const cpf = $('login-cpf');
  if (cpf) { cpf.required = false; ['pattern', 'minlength', 'maxlength'].forEach(a => cpf.removeAttribute(a)); const row = cpf.closest('.field') || cpf.parentElement; row.hidden = true; }
  mostrarCaixaLembrar(document);
  const help = $('login-help'); if (help) help.textContent = 'A senha é a do portal. Sem senha? Fale com o Criador.';
  const access = $('cloud-access'); if (access) access.hidden = true;
  const form = $('login-form'); if (form) { form.hidden = false; form.inert = false; form.removeAttribute('aria-hidden'); }
}
window.financeWebRequest = async (action, payload = {}) => {
  if (action === 'restore_session') {
    if (chave) {
      try { return await activate(chave); }
      catch (error) { if (error.code === 'no_account') throw error; esquecer(); fail('A sessão acabou. Entre de novo.', 'unauthenticated'); }
    }
    const entrada = await entrarPeloAparelho();
    if (entrada) return entrada;
    fail('Entre com a senha do portal.', 'unauthenticated');
  }
  if (action === 'login') {
    const senha = String(payload.password || '');
    const got = await unlock(await getManifest(), senha);
    if (!got) fail('Senha não reconhecida.', 'unauthenticated');
    const entrada = await activate(got);
    const memberId = member.id, masterRaw = got.masterRaw instanceof Uint8Array ? got.masterRaw : b64.dec(got.masterRaw);
    // a chave do diário vem da senha (PBKDF2, ~meio segundo), uma vez só: abre o diário em segundo plano e, com
    // "Lembrar deste aparelho", vai para o IndexedDB no lugar da senha (que não fica em lugar nenhum)
    const kek = chaveDaSenhaDoDiario(senha, memberId);
    abrirDiarioDaSessao(memberId, kek, masterRaw);
    if (payload.remember) {
      try { await lembrarAparelho({memberId: got.memberId, membroDiario: memberId, masterRaw, diarioKek: await kek}); }
      catch { entrada.remember_error = true; esquecerAparelho().catch(() => {}); }
    } else esquecerAparelho().catch(() => {});   // entrar sem marcar esquece um registro antigo deste aparelho (sem esperar: um IndexedDB travado não segura a entrada)
    return entrada;
  }
  if (action === 'logout') { esquecer(); await esquecerAparelho().catch(() => {}); return {logged_out: true}; }
  if (action === 'preferences') { window.financeHost.tema = payload.tema === 'escuro' ? 'escuro' : 'claro'; return {tema: window.financeHost.tema}; }
  if (action === 'change_password') fail('A senha do portal é definida pelo Criador, fora do painel.', 'identity_managed');
  if (!state) fail('Entre com a senha do portal.', 'unauthenticated');
  if (action === 'snapshot') {
    atualizarPerfis();
    const result = buildSnapshot(state, domainMember({...member, displayName: nomeVisivel(member)}), civilDate(new Date()));
    // o snapshot não carrega telefone nem função: a marca dos perfis faz a Sociedade redesenhar quando eles mudam
    result.content_revision += ':p' + marcaDosPerfis(mescla);
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
  dialog.append(node('p', 'A participação de cada sócia define o rateio. Nome, função e contato ficam na página Sociedade.', 'section-intro'));
  atualizarPerfis();
  const roster = (bundle && bundle.finance.roster) || [];
  if (!roster.length) dialog.append(node('p', 'Nenhum perfil disponível.'));
  for (const m of roster) {
    const group = node('section', undefined, 'cloud-member');
    const p = (mescla[m.id] && mescla[m.id].perfil) || {};
    group.append(node('h3', nomeVisivel(m)), node('p', [p.funcao, m.participationPct === null || m.participationPct === undefined ? 'Participação não informada' : `Participação: ${m.participationPct}%`, m.role === 'owner' ? 'responsável' : ''].filter(Boolean).join(' · '), 'form-help'));
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
