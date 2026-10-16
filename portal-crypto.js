// Criptografia do portal (serve no navegador e no Node): a senha de cada membro vira uma chave (PBKDF2-SHA256), que
// desembrulha a chave mestra; a chave mestra abre o pacote (gzip + AES-GCM). Sem a senha, o que está no servidor é ilegível.
const te = new TextEncoder(), td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
export const random = n => globalThis.crypto.getRandomValues(new Uint8Array(n));
export const b64 = {
  enc(bytes) { const b = new Uint8Array(bytes); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); },
  dec(text) { const s = atob(text); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; },
};
export async function deriveKek(password, salt, iterations) {
  const base = await subtle().importKey('raw', te.encode(String(password).normalize('NFKC').trim().replace(/\s+/g, ' ')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
export const importMaster = raw => subtle().importKey('raw', raw, {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
export async function wrapMaster(kek, masterRaw, aad) {
  const iv = random(12);
  const wrapped = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv, additionalData: te.encode(aad)}, kek, masterRaw));
  return {iv: b64.enc(iv), wrapped: b64.enc(wrapped)};
}
export async function unwrapMaster(kek, entry, aad) {
  try { return new Uint8Array(await subtle().decrypt({name: 'AES-GCM', iv: b64.dec(entry.iv), additionalData: te.encode(aad)}, kek, b64.dec(entry.wrapped))); }
  catch { return null; }
}
async function pipe(bytes, stream) {
  const out = new Response(stream.readable).arrayBuffer();
  const w = stream.writable.getWriter(); await w.write(bytes); await w.close();
  return new Uint8Array(await out);
}
export const gzip = bytes => pipe(bytes, new CompressionStream('gzip'));
export const gunzip = bytes => pipe(bytes, new DecompressionStream('gzip'));
export async function sealBundle(masterKey, object, aad) {
  const plain = await gzip(te.encode(JSON.stringify(object)));
  const iv = random(12);
  const bytes = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv, additionalData: te.encode(aad)}, masterKey, plain));
  return {iv: b64.enc(iv), bytes};
}
export async function openBundle(masterKey, ivText, bytes, aad) {
  const plain = await subtle().decrypt({name: 'AES-GCM', iv: b64.dec(ivText), additionalData: te.encode(aad)}, masterKey, bytes);
  return JSON.parse(td.decode(await gunzip(new Uint8Array(plain))));
}
/** Tenta a senha contra cada membro do manifesto; devolve {memberId, masterRaw} ou null. */
export async function unlock(manifest, password) {
  for (const m of manifest.members) {
    const kek = await deriveKek(password, b64.dec(m.salt), manifest.kdf.iterations);
    const raw = await unwrapMaster(kek, m, manifest.aad + ':' + m.id);
    if (raw) return {memberId: m.id, masterRaw: raw};
  }
  return null;
}
// (a sessão não vai mais para sessionStorage: a chave mestra fica só em memória, na ponte; brain 16/10/2026)
export async function fetchManifest(baseUrl) {
  const r = await fetch(new URL('manifest.json', baseUrl), {cache: 'no-cache'});
  if (!r.ok) throw new Error('O portal não encontrou o manifesto.');
  return r.json();
}
export async function loadBundle(baseUrl, manifest, masterRaw) {
  const r = await fetch(new URL(manifest.bundle.file, baseUrl));
  if (!r.ok) throw new Error('Não foi possível baixar o pacote.');
  return openBundle(await importMaster(masterRaw), manifest.bundle.iv, new Uint8Array(await r.arrayBuffer()), manifest.aad);
}
