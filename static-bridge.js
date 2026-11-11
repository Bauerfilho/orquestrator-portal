// A ponte estática do Finanças (GitHub Pages): a mesma interface da ponte nativa do AI Cask (financeRequest), com os dados
// vindos do pacote cifrado e o domínio (domain.js) rodando no navegador. O snapshot é o pacote + o diário cifrado
// (razao.js estadoEfetivo): assinaturas e passos de venda mudam pelo diário, com autora e versão. As três mutações antigas
// (toggle_step, edit_plan, set_subscription) viram eventos do razão pelo id e pela versão, gravados pelo mesmo gravar do
// livro.js (window.financeLivro.gravar, chamado na hora do pedido: sem import, para não mudar a ordem de carga).
// financeHost.pode(acao) diz, ação por ação, se dá para gravar agora e, se não, por quê. A chave mestra vive SÓ em
// memória (nunca em storage): recarregar = entrar de novo.
import {unlock, fetchManifest, loadBundle, b64} from './portal-crypto.js';
import {buildSnapshot, civilDate, validateState} from './domain.js';
import {aplicar, estadoEfetivo, centavosBR, ACOES} from './razao.js';
import {abrirDiario} from './diario.js';
import {criarGaleria} from './galeria.js';
import {carregarPerfis, cifrarPerfis, lerColado, juntarPerfis, foneLegivel, foneDiscavel} from './perfis.js';
// O servidor do diário cifrado (servidor/LEIA.md). Sem ele publicado, o diário roda em modo treino e a tela diz isso.
const DIARIO_URL = 'https://orquestrator-diario.netlify.app';
const $ = id => document.getElementById(id);
const base = new URL('./', location.href);
let manifest = null, bundle = null, member = null, state = null, chave = null;
let painelBlob = null;
let diarioAtual = null, diarioPromessa = null;
// Perfis da sociedade (perfis.js): nome, função e contato de cada sócia, cifrados em perfis.json com a chave mestra.
// Abertos, os nomes deles substituem os rótulos do pacote ("Sócio 1"…) em todo o portal.
const SEM_PERFIS = {estado: 'ausente', membros: {}};
let perfis = SEM_PERFIS;
const nomeVisivel = m => (perfis.estado === 'ok' && perfis.membros[m.id] && perfis.membros[m.id].nome) || m.displayName;
const fail = (message, code) => { const error = new Error(message); error.code = code; throw error; };
const temaAtual = () => document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
const domainMember = m => ({id: m.id, displayName: m.displayName, participationPct: m.participationPct ?? null, role: m.role === 'owner' ? 'owner' : 'member'});
// O Laboratório (galeria.js): o catálogo e as maquetes vêm de galeria/ deste repositório; os documentos antigos do
// pacote cifrado entram como "Sem stand" (o do repositório vence). Só com o portal aberto pela senha.
const galeria = criarGaleria({base, legado: () => bundle && bundle.gallery});
// O host, para a interface saber onde está: portal com Laboratório, com "Minha equipe", sem decisão. readOnly continua
// valendo para as decisões do Portfólio; Assinaturas e Vender primeiro perguntam pode(acao).
window.financeHost = {
  kind: 'portal', tema: temaAtual(), galeria: true, team: true, readOnly: true, decide: false,
  // pode('confirm_plan', 'pl-…') → {ok: true, treino} ou {ok: false, motivo}: liberado com o diário gravando ou em treino;
  // desligado, com o motivo por extenso, só lendo ou aguardando a chave. set_decision segue desligado (F3-2/F3-7).
  pode(acao, alvo) { return podeNoDiario(acao, alvo); },
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
      return {estado: state, membro: {id: member.id, nome: nomeVisivel(member), papel: member.role === 'owner' ? 'owner' : 'member', pct: member.participationPct ?? null}, hoje: civilDate(new Date())};
    },
    diario() { return diarioAtual; },
  },
  // Sociedade: os perfis abertos (ler), a colagem conferida contra o roster (conferir) e o envelope cifrado (cifrar),
  // que volta para o repositório como perfis.json. Nada disso existe sem a senha.
  perfis: {
    ler() {
      if (!bundle) return null;
      return {estado: perfis.estado, membros: bundle.finance.roster.map(m => {
        const p = (perfis.estado === 'ok' && perfis.membros[m.id]) || {};
        return {id: m.id, rotulo: m.displayName, nome: p.nome || '', funcao: p.funcao || '', fone: p.fone ? foneLegivel(p.fone) : '', foneLink: p.fone ? foneDiscavel(p.fone) : '',
          email: p.email || '', estadoCivil: p.estadoCivil || '', participacao: m.participationPct ?? null, papel: m.role === 'owner' ? 'owner' : 'member'};
      })};
    },
    conferir(texto) {
      if (!bundle) fail('Entre com a senha do portal.', 'unauthenticated');
      return lerColado(texto, bundle.finance.roster.map(m => ({id: m.id, rotulo: m.displayName})));
    },
    // junta com os perfis já abertos: colar só a própria sócia não apaga as outras (null no texto remove alguém)
    async cifrar(membros, remover = []) {
      if (!chave) fail('Entre com a senha do portal.', 'unauthenticated');
      // sem ler os perfis de hoje (rede fora), juntar seria juntar com nada: o envelope apagaria quem não foi colado
      if (perfis.estado === 'indisponivel') fail('Os perfis de hoje não carregaram. Recarregue a página antes de atualizar, para não apagar ninguém.', 'indisponivel');
      const base = perfis.estado === 'ok' ? perfis.membros : {};
      return JSON.stringify(await cifrarPerfis(chave.masterRaw, {membros: juntarPerfis(base, membros, remover)}), null, 1) + '\n';
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
// ── o diário nas páginas antigas: o fold guardado (refeito só quando o diário ou o dia mudam) ─────────────────────────
let dobra = {estado: null, chave: null, aplicado: null, efetivo: null};
function dobrar(hoje) {
  const eventos = diarioAtual ? diarioAtual.eventos : [];
  const ultimo = eventos.length ? eventos[eventos.length - 1] : null;
  const chaveDobra = `${hoje}|${eventos.length}|${ultimo ? ultimo.seq + ':' + ultimo.id : ''}`;
  if (dobra.estado !== state || dobra.chave !== chaveDobra) {
    const aplicado = aplicar(state, eventos);
    dobra = {estado: state, chave: chaveDobra, aplicado, efetivo: estadoEfetivo(state, aplicado, hoje)};
  }
  return dobra;
}
// as três mutações antigas e a ação do razão que cada uma vira (set_subscription: encerrar ou reativar)
const PEDIDOS_ANTIGOS = {toggle_step: 'toggle_step', edit_plan: 'edit_plan', set_subscription: 'archive_plan'};
function podeNoDiario(acao, alvo) {
  if (acao === 'set_decision') return {ok: false, motivo: 'As decisões se registram na aba Finanças do AI Cask.'};
  if (!ACOES.includes(acao) && !Object.hasOwn(PEDIDOS_ANTIGOS, acao)) return {ok: false, motivo: 'Esta ação ainda não grava no portal.'};
  if (!state || !member) return {ok: false, motivo: 'Entre com a senha do portal.'};
  const d = diarioAtual;
  if (!d) return {ok: false, motivo: 'O diário cifrado ainda está abrindo: um instante.'};
  if (d.modo !== 'gravacao' && d.modo !== 'treino' && d.modo !== 'indisponivel') return {ok: false, motivo: d.motivo || 'Você lê o diário, mas não grava.'};
  const resposta = {ok: true, treino: d.modo !== 'gravacao'};
  // confirmar tem regra de pessoa (quatro olhos): a prévia do razão diz se esta sócia pode, antes do clique
  if (acao === 'confirm_plan' && typeof alvo === 'string') {
    const {aplicado} = dobrar(civilDate(new Date()));
    const plano = aplicado.planos.find(p => p.id === alvo);
    if (plano) {
      const previa = aplicar(state, [...d.eventos, {seq: Infinity, id: 'previa-pode', membro: member.id, conteudo: {acao, alvo, versao: plano.versao, quando: new Date().toISOString()}}]);
      const recusa = previa.recusados.find(r => r.id === 'previa-pode');
      if (recusa) return {ok: false, motivo: recusa.motivo};
    }
  }
  return resposta;
}
// pedido antigo (id + versão que a sócia viu) → evento do razão. O valor digitado passa por centavosBR (1.500 é mil e
// quinhentos); o razão confere o resto (data, motivo, versão) e a recusa volta com o motivo dele.
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
  const {conteudo, ok} = eventoDoPedido(action, payload || {}, dobrar(civilDate(new Date())).aplicado);
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
async function getManifest() { return manifest ??= await fetchManifest(base); }
function esquecer() { chave = bundle = state = member = null; perfis = SEM_PERFIS; diarioAtual = null; diarioPromessa = null; dobra = {estado: null, chave: null, aplicado: null, efetivo: null}; galeria.esquecer(); if (painelBlob) { try { URL.revokeObjectURL(painelBlob); } catch {} painelBlob = null; } }
async function activate(sess) {
  bundle = await loadBundle(base, await getManifest(), sess.masterRaw);
  const roster = bundle.finance.roster;
  member = roster.find(r => r.portalId === sess.memberId) || null;
  if (!member) { esquecer(); fail('Seu perfil não está neste pacote.', 'no_account'); }
  state = structuredClone(bundle.finance.state);
  perfis = await carregarPerfis(base, sess.masterRaw);
  state.members = roster.map(m => domainMember({...m, displayName: nomeVisivel(m)}));
  state.staticBlocks ??= {}; state.staticBlocks.atlas ??= {};
  if (!Array.isArray(state.staticBlocks.atlas.assets) || !state.staticBlocks.atlas.assets.length) state.staticBlocks.atlas.assets = bundle.finance.assets || [];
  validateState(state);
  chave = sess;
  return {user: {nome: nomeVisivel(member), participacao_pct: member.participationPct ?? null, decide: false}, must_change_password: false, decide: false};
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
    const hoje = civilDate(new Date()), quem = domainMember({...member, displayName: nomeVisivel(member)});
    let result;
    // o pacote + o diário; se o diário não couber no painel (limite de soma, registro estranho), o pacote sozinho, com aviso no console
    try { result = buildSnapshot(dobrar(hoje).efetivo, quem, hoje); }
    catch (erro) { console.error('O diário não coube no painel; mostrando só o pacote:', erro); result = buildSnapshot(state, quem, hoje); }
    return payload.if_revision === result.content_revision ? {unchanged: true, content_revision: result.content_revision} : result;
  }
  if (action === 'set_decision') fail('As decisões se registram na aba Finanças do AI Cask.', 'read_only');
  if (Object.hasOwn(PEDIDOS_ANTIGOS, action)) return gravarPedido(action, payload);
  fail('Esta ação ainda não existe na versão publicada.', 'read_only');
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
  const roster = (bundle && bundle.finance.roster) || [];
  if (!roster.length) dialog.append(node('p', 'Nenhum perfil disponível.'));
  for (const m of roster) {
    const group = node('section', undefined, 'cloud-member');
    const p = (perfis.estado === 'ok' && perfis.membros[m.id]) || {};
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
