// Perfis da sociedade (19/10/2026, pedido do Bauer): nome, função, telefone, e-mail e estado civil de cada sócia.
// Este repositório é público, então os perfis viajam CIFRADOS em perfis.json: AES-GCM com uma chave tirada da chave
// mestra do pacote (HKDF, info "orquestrator-perfis/v1"). Só quem entrou com senha abre. Quem cifra é o próprio portal,
// no navegador de uma sócia que entrou (Sociedade → Perfis da sociedade); o texto cifrado volta para o repositório.
// Se o pacote for lacrado de novo com outra chave mestra, o envelope antigo não abre: o portal volta aos nomes do pacote
// e avisa que os perfis precisam ser cifrados de novo. Serve no navegador e no Node (testes/perfis.test.mjs).
import {b64, random} from './portal-crypto.js';

const AAD = 'orquestrator-perfis/v1';
const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
export const CAMPOS = [['nome', 'Nome', 120], ['funcao', 'Função', 120], ['fone', 'Telefone', 40], ['email', 'E-mail', 160], ['estadoCivil', 'Estado civil', 40]];

async function chave(masterRaw) {
  const base = await subtle().importKey('raw', masterRaw, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(AAD)}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
// a publicação (a chave mestra em uso) sem revelar nada dela: só para dizer "este envelope é de outra chave"
async function publicacao(masterRaw) {
  const bytes = new Uint8Array(await subtle().digest('SHA-256', enc.encode(AAD + '|pub|' + b64.enc(masterRaw))));
  return [...bytes.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Só texto, aparado e com limite; membro sem nome não entra. Devolve {membros: {id: {nome, funcao, …}}}. */
export function normalizarPerfis(dados) {
  const membros = {};
  const entrada = dados && typeof dados === 'object' && dados.membros && typeof dados.membros === 'object' ? dados.membros : {};
  for (const [id, perfil] of Object.entries(entrada)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !perfil || typeof perfil !== 'object') continue;
    const limpo = {};
    for (const [campo, , limite] of CAMPOS) {
      const valor = typeof perfil[campo] === 'string' ? perfil[campo].replace(/\s+/g, ' ').trim().slice(0, limite) : '';
      if (valor) limpo[campo] = valor;
    }
    if (limpo.nome) membros[id] = limpo;
  }
  return {membros};
}

export async function cifrarPerfis(masterRaw, dados) {
  const limpo = normalizarPerfis(dados);
  if (!Object.keys(limpo.membros).length) throw new Error('Nenhum perfil com nome para cifrar.');
  const iv = random(12);
  const ct = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv, additionalData: enc.encode(AAD)}, await chave(masterRaw), enc.encode(JSON.stringify(limpo))));
  return {v: 1, publicacao: await publicacao(masterRaw), iv: b64.enc(iv), ct: b64.enc(ct)};
}

/** {estado: 'ok', membros} · {estado: 'outra-chave'} (lacrado de novo) · {estado: 'ilegivel'} (envelope estragado). */
export async function abrirPerfis(masterRaw, envelope) {
  if (!envelope || envelope.v !== 1 || typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') return {estado: 'ilegivel'};
  if (envelope.publicacao !== await publicacao(masterRaw)) return {estado: 'outra-chave'};
  try {
    const plano = await subtle().decrypt({name: 'AES-GCM', iv: b64.dec(envelope.iv), additionalData: enc.encode(AAD)}, await chave(masterRaw), b64.dec(envelope.ct));
    return {estado: 'ok', membros: normalizarPerfis(JSON.parse(dec.decode(plano))).membros};
  } catch { return {estado: 'ilegivel'}; }
}

/** Busca perfis.json ao lado do portal. Sem arquivo = {estado: 'ausente'}; rede fora = {estado: 'indisponivel'}. */
export async function carregarPerfis(base, masterRaw, f = globalThis.fetch.bind(globalThis)) {
  let r;
  try { r = await f(new URL('perfis.json', base), {cache: 'no-cache'}); } catch { return {estado: 'indisponivel'}; }
  if (r.status === 404) return {estado: 'ausente'};
  if (!r.ok) return {estado: 'indisponivel'};
  let envelope;
  try { envelope = await r.json(); } catch { return {estado: 'ilegivel'}; }
  return abrirPerfis(masterRaw, envelope);
}

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const numeroDoRotulo = s => { const m = /^s[oó]ci[oa]s?\s*(\d+)$/.exec(semAcento(s)); return m ? Number(m[1]) : null; };

/**
 * O texto colado na ferramenta (JSON) vira {membros: {id: perfil}} casado com o roster do pacote:
 *   · {"Sócio 1": {...}, "Sócio 2": {...}}  → pelo nome que o pacote mostra; "Sócio N" sem par vira o N-ésimo do roster;
 *   · {"m53cd…": {...}}                     → direto pelo id;
 *   · [{...}, {...}]                        → na ordem do roster.
 * Devolve {membros, avisos}: avisos explica o que não casou.
 */
export function lerColado(texto, roster) {
  let dados;
  try { dados = JSON.parse(String(texto || '')); } catch { return {membros: {}, avisos: ['O texto colado não é um JSON válido.']}; }
  const lista = Array.isArray(roster) ? roster : [];
  const porId = new Map(lista.map(m => [m.id, m]));
  const porNome = new Map(lista.map(m => [semAcento(m.rotulo || m.displayName), m]));
  const membros = {}, avisos = [];
  const pares = Array.isArray(dados) ? dados.map((p, i) => [String(i + 1), p, i]) : Object.entries(dados && typeof dados === 'object' ? dados : {}).map(([k, p]) => [k, p, null]);
  for (const [chaveColada, perfil, indice] of pares) {
    let alvo = porId.get(chaveColada) || porNome.get(semAcento(chaveColada)) || null;
    if (!alvo && indice !== null) alvo = lista[indice] || null;
    if (!alvo) { const n = numeroDoRotulo(chaveColada); if (n) alvo = lista[n - 1] || null; }
    if (!alvo) { avisos.push(`"${chaveColada}" não corresponde a ninguém do pacote.`); continue; }
    if (membros[alvo.id]) { avisos.push(`"${chaveColada}" repete ${alvo.rotulo || alvo.displayName}.`); continue; }
    membros[alvo.id] = perfil;
  }
  return {membros: normalizarPerfis({membros}).membros, avisos};
}

/** Telefone brasileiro legível: 64900000001 → (64) 90000-0001. Outro formato volta como veio. */
export function foneLegivel(fone) {
  const d = String(fone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(fone || '').trim();
}
/** O mesmo número para o link tel: (+55 na frente quando é um número nacional). */
export function foneDiscavel(fone) {
  const d = String(fone || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '+55' + d;
  if (d.length === 12 || d.length === 13) return '+' + d;
  return '';
}
