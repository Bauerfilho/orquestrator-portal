// Perfis da sociedade (19/10/2026, pedido do Bauer): nome, função, telefone, e-mail e estado civil de cada sócia.
// Desde a noite de 19/10 os perfis GRAVAM DIRETO PELO DIÁRIO CIFRADO: a ação set_profile do razao.js (a própria sócia
// edita o seu; a responsável, o de todas), sem ninguém publicar nada. Este módulo guarda o resto:
//   · a mescla que o portal mostra (mesclarPerfis): o perfil do diário vence o do perfis.json antigo, que vence o rótulo
//     do pacote ("Sócio 1"…); o que as duas pontes devolvem em financeHost.perfis.ler() (perfilParaTela);
//   · a leitura compatível do perfis.json: AES-GCM com uma chave tirada da chave mestra do pacote (HKDF, info
//     "orquestrator-perfis/v1"), porque este repositório é público. Se o pacote for lacrado de novo com outra chave
//     mestra, o envelope antigo não abre e o portal segue com o diário e os rótulos. cifrarPerfis fica como cópia de
//     segurança (a tela não gera mais envelope para publicar);
//   · a colagem "Colar vários de uma vez" (lerColado), que só preenche os blocos do formulário para revisar e salvar.
// A limpeza dos campos é uma só, a do razão (limparPerfil). Serve no navegador e no Node (testes/perfis*.test.mjs).
import {b64, random} from './portal-crypto.js';
import {CAMPOS_PERFIL, limparPerfil, aplicar} from './razao.js';

const AAD = 'orquestrator-perfis/v1';
const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
export const CAMPOS = CAMPOS_PERFIL;

async function chave(masterRaw) {
  const base = await subtle().importKey('raw', masterRaw, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(AAD)}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
// a publicação (a chave mestra em uso) sem revelar nada dela: só para dizer "este envelope é de outra chave"
async function publicacao(masterRaw) {
  const bytes = new Uint8Array(await subtle().digest('SHA-256', enc.encode(AAD + '|pub|' + b64.enc(masterRaw))));
  return [...bytes.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Só texto, aparado e com limite (limparPerfil, a mesma do set_profile); membro sem nome não entra. Devolve {membros: {id: {nome, funcao, …}}}. */
export function normalizarPerfis(dados) {
  const membros = {};
  const entrada = dados && typeof dados === 'object' && dados.membros && typeof dados.membros === 'object' ? dados.membros : {};
  for (const [id, perfil] of Object.entries(entrada)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !perfil || typeof perfil !== 'object') continue;
    const limpo = limparPerfil(perfil);
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
  // envelope.arnes: cifrado com a chave fictícia do arnês; nunca vale como perfis de verdade
  if (!envelope || envelope.v !== 1 || envelope.arnes || typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') return {estado: 'ilegivel'};
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
 *   · {"Sócio 1": {...}, "Sócio 2": {...}}  → pelo nome que o pacote mostra (ou pelo que a sócia já tem no portal, roster
 *                                             com {nome}); "Sócio N" sem par vira o N-ésimo do roster;
 *   · {"m53cd…": {...}}                     → direto pelo id;
 *   · [{...}, {...}]                        → na ordem do roster.
 * Uma sócia com null ({"Sócio 3": null}) é para REMOVER o perfil dela. Quem não aparece no texto fica como está.
 * Devolve {membros, remover, avisos}: avisos explica o que não casou. A tela só PREENCHE os blocos com isso.
 */
export function lerColado(texto, roster) {
  let dados;
  try { dados = JSON.parse(String(texto || '')); } catch { return {membros: {}, remover: [], avisos: ['O texto colado não é um JSON válido.']}; }
  const lista = Array.isArray(roster) ? roster : [];
  const porId = new Map(lista.map(m => [m.id, m]));
  // pelo rótulo do pacote e, sem tomar o rótulo de ninguém, pelo nome que a sócia já tem no portal (m.nome)
  const porNome = new Map(lista.map(m => [semAcento(m.rotulo || m.displayName), m]));
  for (const m of lista) if (m.nome && !porNome.has(semAcento(m.nome))) porNome.set(semAcento(m.nome), m);
  const membros = {}, avisos = [], remover = [];
  const pares = Array.isArray(dados) ? dados.map((p, i) => [String(i + 1), p, i]) : Object.entries(dados && typeof dados === 'object' ? dados : {}).map(([k, p]) => [k, p, null]);
  for (const [chaveColada, perfil, indice] of pares) {
    let alvo = porId.get(chaveColada) || porNome.get(semAcento(chaveColada)) || null;
    if (!alvo && indice !== null) alvo = lista[indice] || null;
    if (!alvo) { const n = numeroDoRotulo(chaveColada); if (n) alvo = lista[n - 1] || null; }
    if (!alvo) { avisos.push(`"${chaveColada}" não corresponde a ninguém do pacote.`); continue; }
    if (membros[alvo.id] || remover.includes(alvo.id)) { avisos.push(`"${chaveColada}" repete ${alvo.rotulo || alvo.displayName}.`); continue; }
    if (perfil === null) { remover.push(alvo.id); continue; }
    membros[alvo.id] = perfil;
  }
  const limpos = normalizarPerfis({membros}).membros;
  for (const id of Object.keys(membros)) if (!limpos[id]) avisos.push(`${(porId.get(id) || {}).rotulo || id}: sem nome, o perfil não entra.`);
  return {membros: limpos, remover, avisos};
}

/** O que iria para um envelope (cópia de segurança): os perfis já abertos, com os colados por cima e os removidos fora. */
export function juntarPerfis(atuais, colados, remover = []) {
  const todos = {...(atuais || {}), ...(colados || {})};
  for (const id of remover || []) delete todos[id];
  return todos;
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

// ── a mescla que o portal mostra (as duas pontes usam estas, para dizerem o mesmo) ───────────────────────────────────
/**
 * ids na ordem do roster; arquivo = o perfis.json aberto ({estado, membros}); aplicado = o razão sobre o diário
 * ({perfis, perfisApagados}). O perfil do diário vence o do arquivo; quem o diário apagou fica sem perfil mesmo que o
 * arquivo ainda o tenha. Devolve {id: {perfil | null, fonte: 'diario' | 'arquivo' | null, alteradoPor, alteradoEm, versao}}.
 */
export function mesclarPerfis(ids, arquivo, aplicado) {
  const doArquivo = arquivo && arquivo.estado === 'ok' && arquivo.membros && typeof arquivo.membros === 'object' ? arquivo.membros : {};
  const doDiario = aplicado && aplicado.perfis && typeof aplicado.perfis === 'object' ? aplicado.perfis : {};
  const apagados = new Set(aplicado && Array.isArray(aplicado.perfisApagados) ? aplicado.perfisApagados : []);
  const saida = {};
  for (const id of ids) {
    if (Object.hasOwn(doDiario, id)) {
      const {alteradoPor = null, alteradoEm = null, versao = null, ...resto} = doDiario[id];
      saida[id] = {perfil: limparPerfil(resto), fonte: 'diario', alteradoPor, alteradoEm, versao};
    } else if (!apagados.has(id) && Object.hasOwn(doArquivo, id)) saida[id] = {perfil: limparPerfil(doArquivo[id]), fonte: 'arquivo', alteradoPor: null, alteradoEm: null, versao: null};
    else saida[id] = {perfil: null, fonte: null, alteradoPor: null, alteradoEm: null, versao: null};
  }
  return saida;
}
/** A própria sócia edita o seu perfil; a responsável (role owner), o de todas: a mesma regra do set_profile no razão. */
export const podeEditarPerfil = (membro, id) => !!membro && typeof id === 'string' && (membro.id === id || membro.role === 'owner');

/** Uma sócia em financeHost.perfis.ler(): o perfil para a tela (telefone legível e discável), a fonte e se quem vê edita. */
export function perfilParaTela(m, rotulo, entrada, podeEditar) {
  const p = (entrada && entrada.perfil) || {};
  return {id: m.id, rotulo, nome: p.nome || '', funcao: p.funcao || '', fone: p.fone ? foneLegivel(p.fone) : '', foneLink: p.fone ? foneDiscavel(p.fone) : '',
    email: p.email || '', estadoCivil: p.estadoCivil || '', participacao: m.participationPct ?? null, papel: m.role === 'owner' ? 'owner' : 'member',
    fonte: entrada ? entrada.fonte : null, alteradoPor: entrada ? entrada.alteradoPor : null, alteradoEm: entrada ? entrada.alteradoEm : null, podeEditar: !!podeEditar};
}
/** 'ok' quando alguma sócia tem perfil (de qualquer fonte); senão, o estado do perfis.json ('ausente', 'outra-chave'…). */
export function estadoDosPerfis(mescla, arquivo) {
  if (Object.values(mescla || {}).some(e => e && e.perfil && e.perfil.nome)) return 'ok';
  return arquivo && arquivo.estado && arquivo.estado !== 'ok' ? arquivo.estado : 'ausente';
}
/** Uma marca curta da mescla: o content_revision do snapshot muda quando qualquer campo de um perfil muda. */
export function marcaDosPerfis(mescla) {
  const texto = JSON.stringify(Object.entries(mescla || {}).map(([id, e]) => [id, e.fonte, e.perfil]));
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
/**
 * O razão sobre o diário, só refeito quando o diário muda (abriu, sincronizou, gravou): as pontes chamam a cada leitura
 * (snapshot, livro, perfis, Minha equipe) e o custo só aparece quando há evento novo. sobre(estado, diario) devolve o
 * aplicado (com perfis e perfisApagados); esquecer() zera ao sair.
 */
export function acompanharDiario() {
  const vazio = {perfis: {}, perfisApagados: []};
  let marca = null, ultimo = vazio, diarioVisto = null;
  return {
    sobre(estado, diario) {
      if (!estado) return vazio;
      const eventos = diario && Array.isArray(diario.eventos) ? diario.eventos : [];
      const nova = [eventos.length, diario ? diario.cabeca : 0, diario ? diario.modo : '-', eventos.length ? eventos[eventos.length - 1].id : ''].join('|');
      if (diario === diarioVisto && nova === marca) return ultimo;
      try { ultimo = aplicar(estado, eventos); } catch { ultimo = vazio; }
      marca = nova; diarioVisto = diario;
      return ultimo;
    },
    esquecer() { marca = null; ultimo = vazio; diarioVisto = null; },
  };
}
