// "Lembrar deste aparelho" (pedido do Bauer, 19/10/2026): entrar no portal sem digitar a senha toda vez, só nos aparelhos
// das sócias. A SENHA NUNCA É GUARDADA (nem em localStorage, nem em sessionStorage, nem aqui). Ao entrar com a caixa marcada,
// o navegador guarda no IndexedDB desta origem (banco "orquestrator-lembrar"):
//   · a chave do aparelho: AES-GCM 256 gerada aqui, NÃO extraível (nenhum script lê os bytes dela; o IndexedDB guarda o
//     CryptoKey por structured clone). Nasce uma vez por navegador e vai embora no Sair;
//   · o registro {versao, memberId, membroDiario, masterCifrada, diarioKek}: a chave mestra do pacote cifrada com a chave do
//     aparelho (AAD 'orquestrator-lembrar/v1|' + memberId: trocar o membro no registro não abre) e a chave da senha do
//     diário (chaveDaSenhaDoDiario, PBKDF2, também não extraível), para o diário abrir sem a senha.
// Ao abrir o portal, a ponte decifra a mestra, lê o pacote e o perfis.json de novo (frescos) e abre o diário com a chave
// guardada. Se algo não fecha (pacote lacrado de novo, registro de outra versão, membro trocado, aparelho limpo, navegação
// privada), o registro é apagado e a tela de entrada aparece, sem erro. Sair apaga tudo; entrar sem marcar também.
// SÓ NUMA ORIGEM QUE SEJA DO PORTAL (lembrarPermitido). "Não extraível" quer dizer que nenhum script copia os bytes da
// chave do aparelho, não que nenhum script a USE: o IndexedDB é por origem, e qualquer página da mesma origem decifraria a
// mestra com ela, sem senha e a qualquer hora. No GitHub Pages (<dono>.github.io) a origem é a mesma de todo repositório
// Pages do dono e das telas cheias públicas das maquetes (apps/<id>/): lá a caixa não aparece, nada vai para o aparelho e
// um registro que tenha ficado é apagado. Liga sozinho na origem própria do portal (F3-8 do plano).
// As duas pontes (static-bridge.js e ferramentas/arnes/ponte-simulada.js) usam este módulo. A parte pura (montarRegistro,
// abrirRegistro) roda no Node: testes/lembrar.test.mjs; a do IndexedDB, no navegador: ferramentas/arnes/fluxos/lembrar.mjs.
import {b64, random} from './portal-crypto.js';

export const VERSAO = 1;
export const AAD = 'orquestrator-lembrar/v1|';
const BANCO = 'orquestrator-lembrar', LOJA = 'aparelho', PRAZO_MS = 4000;
const ID = /^[A-Za-z0-9._-]{1,80}$/;   // a mesma regra do diário (diario.js e servidor/nucleo.mjs)
const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
const chaveAes = k => !!k && typeof k === 'object' && k.type === 'secret' && !!k.algorithm && k.algorithm.name === 'AES-GCM';
const naoExtraivel = k => chaveAes(k) && k.extractable === false;

/** Este endereço pode lembrar o aparelho? Não numa origem compartilhada (*.github.io): veja o começo do arquivo. */
export const ORIGEM_COMPARTILHADA = /(^|\.)github\.io$/i;
export const lembrarPermitido = (loc = globalThis.location) => !!loc && typeof loc.hostname === 'string' && !!loc.hostname && !ORIGEM_COMPARTILHADA.test(loc.hostname);

/** A chave do aparelho: AES-GCM 256, não extraível, só cifra e decifra. */
export const novaChaveDoAparelho = () => subtle().generateKey({name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);

/**
 * O registro que fica no aparelho. memberId é o do manifesto (quem a senha abriu); membroDiario, o id da sócia no pacote
 * (o sal da chave do diário). Recusa chave extraível: a mestra só sai daqui cifrada com uma chave que ninguém copia.
 */
export async function montarRegistro(chaveDoAparelho, {memberId, membroDiario = memberId, masterRaw, diarioKek} = {}) {
  if (!naoExtraivel(chaveDoAparelho)) throw new Error('A chave do aparelho precisa ser AES-GCM e não extraível.');
  if (!naoExtraivel(diarioKek)) throw new Error('A chave do diário precisa ser AES-GCM e não extraível.');
  if (!ID.test(memberId || '') || !ID.test(membroDiario || '')) throw new Error('Membro inválido para lembrar.');
  if (!(masterRaw instanceof Uint8Array) || !masterRaw.length) throw new Error('Chave mestra inválida para lembrar.');
  const iv = random(12);
  const ct = await subtle().encrypt({name: 'AES-GCM', iv, additionalData: enc.encode(AAD + memberId)}, chaveDoAparelho, masterRaw);
  return {versao: VERSAO, memberId, membroDiario, masterCifrada: {iv: b64.enc(iv), ct: b64.enc(new Uint8Array(ct))}, diarioKek};
}

/** {memberId, membroDiario, masterRaw, diarioKek} ou null (outra versão, membro trocado, outra chave, estragado). */
export async function abrirRegistro(chaveDoAparelho, registro) {
  if (!chaveAes(chaveDoAparelho) || !registro || typeof registro !== 'object' || registro.versao !== VERSAO) return null;
  const {memberId, membroDiario, masterCifrada: m, diarioKek} = registro;
  if (!ID.test(memberId || '') || !ID.test(membroDiario || '') || !m || typeof m.iv !== 'string' || typeof m.ct !== 'string' || !naoExtraivel(diarioKek)) return null;
  try {
    const masterRaw = new Uint8Array(await subtle().decrypt({name: 'AES-GCM', iv: b64.dec(m.iv), additionalData: enc.encode(AAD + memberId)}, chaveDoAparelho, b64.dec(m.ct)));
    return {memberId, membroDiario, masterRaw, diarioKek};
  } catch { return null; }
}

// ── o IndexedDB (só no navegador) ───────────────────────────────────────────────────────────────────────────────────
// Cada operação abre o banco, faz uma transação e fecha (nenhuma conexão fica aberta prendendo outra aba). Tudo com prazo:
// um navegador que não responde vira erro, e a ponte cai na tela de entrada em vez de ficar esperando.
function comPrazo(promessa, ms = PRAZO_MS) {
  let relogio;
  const prazo = new Promise((_, falhar) => { relogio = setTimeout(() => falhar(new Error('O navegador não respondeu a tempo.')), ms); });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(relogio));
}
function abrirBanco(idb) {
  return new Promise((ok, falhar) => {
    if (!idb || typeof idb.open !== 'function') { falhar(new Error('Este navegador não guarda dados (IndexedDB indisponível).')); return; }
    const pedido = idb.open(BANCO, 1);
    pedido.onupgradeneeded = () => { const banco = pedido.result; if (!banco.objectStoreNames.contains(LOJA)) banco.createObjectStore(LOJA); };
    pedido.onsuccess = () => { const banco = pedido.result; banco.onversionchange = () => banco.close(); ok(banco); };
    pedido.onerror = () => falhar(pedido.error || new Error('O IndexedDB recusou.'));
    pedido.onblocked = () => falhar(new Error('O IndexedDB está ocupado.'));
  });
}
async function naLoja(modo, operar, idb = globalThis.indexedDB) {
  let banco = null, desistiu = false;
  const abrindo = abrirBanco(idb).then(b => { if (desistiu) b.close(); else banco = b; return b; });
  abrindo.catch(() => {});
  try {
    await comPrazo(abrindo);
    return await comPrazo(new Promise((ok, falhar) => {
      const tx = banco.transaction(LOJA, modo);
      const pedidos = operar(tx.objectStore(LOJA)) || [];
      tx.oncomplete = () => ok(pedidos.map(p => p.result));
      tx.onerror = tx.onabort = () => falhar(tx.error || new Error('O IndexedDB recusou.'));
    }));
  } finally {
    desistiu = true;
    if (banco) banco.close();
  }
}

/** O que está guardado, cru: {chave, registro} (null quando não há). Lança se o navegador não tem IndexedDB. */
export async function lerAparelho(idb) {
  const [chave, registro] = await naLoja('readonly', loja => [loja.get('chave'), loja.get('registro')], idb);
  return {chave: chave ?? null, registro: registro ?? null};
}

/** Lembra este aparelho: guarda a chave do aparelho (a que já existe, ou uma nova) e o registro, e confere a volta. */
export async function lembrarAparelho(dados, idb) {
  let {chave} = await lerAparelho(idb);
  if (!naoExtraivel(chave)) chave = await novaChaveDoAparelho();
  const registro = await montarRegistro(chave, dados);
  await naLoja('readwrite', loja => { loja.put(chave, 'chave'); loja.put(registro, 'registro'); }, idb);
  // confere: há navegador que aceita gravar e não guarda (navegação privada); sem conferir, "lembrar" prometeria em vão
  const volta = await lerAparelho(idb);
  const aberto = await abrirRegistro(volta.chave, volta.registro);
  if (!aberto || aberto.memberId !== registro.memberId) throw new Error('Este navegador não guardou o aparelho.');
  return true;
}

/** Esquece este aparelho: apaga o registro e a chave do aparelho (Sair, entrar sem marcar, registro que não abre). */
export const esquecerAparelho = idb => naLoja('readwrite', loja => { loja.clear(); }, idb).then(() => true);

/**
 * O que este aparelho lembra, já aberto ({memberId, membroDiario, masterRaw, diarioKek}), ou null quando não há nada.
 * Um registro que não abre é apagado aqui mesmo. Lança só quando o navegador não tem IndexedDB (aí não há o que apagar).
 */
export async function lembrado(idb) {
  const {chave, registro} = await lerAparelho(idb);
  if (!registro && !chave) return null;
  const aberto = registro ? await abrirRegistro(chave, registro) : null;
  if (!aberto) { await esquecerAparelho(idb).catch(() => {}); return null; }
  return aberto;
}

/**
 * A caixa "Lembrar deste aparelho" na tela de entrada, com a linha de ajuda (as duas pontes chamam no prepareForm). Numa
 * origem compartilhada (lembrarPermitido), a caixa fica escondida e desmarcada.
 */
export function mostrarCaixaLembrar(doc = globalThis.document, loc = globalThis.location) {
  const caixa = doc && doc.getElementById('login-remember');
  const linha = caixa && caixa.closest('label');
  if (!linha) return;
  if (!lembrarPermitido(loc)) {
    linha.hidden = true; caixa.checked = false;
    const ajuda = doc.getElementById('login-remember-help'); if (ajuda) ajuda.remove();
    return;
  }
  linha.hidden = false;
  const texto = linha.querySelector('span');
  if (texto) texto.textContent = 'Lembrar deste aparelho';
  let ajuda = doc.getElementById('login-remember-help');
  if (!ajuda) { ajuda = doc.createElement('p'); ajuda.id = 'login-remember-help'; ajuda.className = 'form-help lembrar-ajuda'; linha.after(ajuda); }
  ajuda.textContent = 'Só nos seus aparelhos. Sair esquece.';
  caixa.setAttribute('aria-describedby', 'login-remember-help');
}
