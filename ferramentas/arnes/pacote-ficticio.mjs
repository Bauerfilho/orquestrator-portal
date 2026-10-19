// PACOTE FICTÍCIO lacrado na hora, no formato do pacote publicado (manifest.json + bundle-*.bin + perfis.json), para provar
// a ponte REAL (static-bridge.js) sem tocar no pacote de verdade. Os dados são os do estado fictício do arnês; senhas, nomes
// e telefones são de mentira óbvia. Nada vai para o disco: quem usa entrega pelas rotas do Playwright (fluxos/lembrar.mjs).
// Cada chamada nasce com uma chave mestra nova: chamar de novo é "lacrar o pacote de novo".
import {deriveKek, wrapMaster, sealBundle, importMaster, random, b64} from '../../portal-crypto.js';
import {cifrarPerfis} from '../../perfis.js';
import {estadoFicticio} from './estado-ficticio.js';

export const SENHAS_FICTICIAS = Object.freeze({'m-bauer': 'senha-ficticia-bauer', 'm-ana': 'senha-ficticia-ana', 'm-bia': 'senha-ficticia-bia'});
export const NOMES_FICTICIOS = Object.freeze({'m-bauer': 'Bauer Exemplo', 'm-ana': 'Ana Ribeiro Exemplo', 'm-bia': 'Beatriz Lima Exemplo'});
const AAD = 'orquestrator-portal/v1';

/** {manifest, arquivo, bytes, perfis, roster, masterRaw}: o roster com os rótulos do pacote ("Sócio 1"…) e um portalId por
 *  sócia; masterRaw só para o teste conferir que ela nunca fica em claro no aparelho. */
export async function lacrarPacoteFicticio({iteracoes = 600000, rotulo = 'a'} = {}) {
  const masterRaw = random(32);
  const roster = estadoFicticio.members.map((m, i) => ({id: m.id, portalId: 'p-' + m.id.slice(2), displayName: i === 0 ? 'Sócio 1' : `Sócia ${i + 1}`, participationPct: m.participationPct, role: m.role}));
  const members = [];
  for (const r of roster) {
    const salt = random(16);
    const {iv, wrapped} = await wrapMaster(await deriveKek(SENHAS_FICTICIAS[r.id], salt, iteracoes), masterRaw, AAD + ':' + r.portalId);
    members.push({id: r.portalId, salt: b64.enc(salt), iv, wrapped});
  }
  const {iv, bytes} = await sealBundle(await importMaster(masterRaw), {finance: {roster, state: structuredClone(estadoFicticio), assets: []}}, AAD);
  const arquivo = `bundle-ficticio-${rotulo}.bin`;
  const manifest = {version: 1, aad: AAD, kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations: iteracoes}, members, bundle: {file: arquivo, iv, bytes: bytes.length}};
  const perfis = await cifrarPerfis(masterRaw, {membros: Object.fromEntries(Object.entries(NOMES_FICTICIOS).map(([id, nome], i) => [id, {nome, funcao: 'Função de exemplo', fone: '6490000000' + (i + 1)}]))});
  return {manifest, arquivo, bytes, perfis, roster, masterRaw};
}
