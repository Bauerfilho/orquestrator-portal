// O diário cifrado do Finanças, do lado do navegador. Toda gravação de uma sócia (lançamento, correção, parâmetro) vira um
// evento cifrado aqui (AES-GCM), assinado por ela (ECDSA P-256) e acrescentado ao fim do log no servidor, que só guarda
// texto cifrado. Ler é o caminho inverso, conferindo a cadeia (cada evento aponta o hash do anterior) e a assinatura.
//
// As chaves nascem no navegador (decisão da noite de 19/10, docs/CHECKLIST.md), sem depender do Mac:
//   · chave do diário K (32 bytes aleatórios): criada pela primeira sócia que entra; guardada no servidor embrulhada
//     (1) pela chave da senha de cada sócia — PBKDF2-SHA256 de 600 mil iterações — e (2) pela chave da publicação atual
//     do pacote, para que quem ainda não entrou consiga abri-la no primeiro acesso;
//   · token de escrita = HKDF(K, "token"): prova ao servidor que quem escreve conhece K (ele guarda só o SHA-256);
//   · par ECDSA por sócia: a chave privada fica no servidor embrulhada pela senha dela; a pública é registrada no
//     primeiro uso e confere a autoria de cada evento em todos os navegadores.
// Sem servidor configurado (ou fora do ar), o diário roda em MODO TREINO: tudo funciona sobre uma cópia em memória e a
// tela avisa que nada é salvo. Testes: testes/diario.test.mjs (contra o servidor de servidor/nucleo.mjs).

const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
const ITERACOES = 600000;

export const b64 = {
  enc: bytes => { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); },
  dec: texto => Uint8Array.from(atob(texto), c => c.charCodeAt(0)),
};
const b64url = bytes => b64.enc(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256hex = async texto => hex(await subtle().digest('SHA-256', enc.encode(texto)));
const aleatorio = n => globalThis.crypto.getRandomValues(new Uint8Array(n));

async function chaveDaSenha(senha, membroId) {
  const base = await subtle().importKey('raw', enc.encode(String(senha).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('orquestrator-diario/v1|' + membroId), iterations: ITERACOES}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
async function hkdf(raw, info, usos) {
  const base = await subtle().importKey('raw', raw, 'HKDF', false, ['deriveKey', 'deriveBits']);
  if (usos === 'bits') return new Uint8Array(await subtle().deriveBits({name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info)}, base, 256));
  return subtle().deriveKey({name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info)}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
async function embrulhar(chave, bytes, aad) {
  const iv = aleatorio(12);
  const ct = await subtle().encrypt({name: 'AES-GCM', iv, additionalData: enc.encode(aad)}, chave, bytes);
  return {iv: b64.enc(iv), ct: b64.enc(ct)};
}
async function desembrulhar(chave, w, aad) {
  return new Uint8Array(await subtle().decrypt({name: 'AES-GCM', iv: b64.dec(w.iv), additionalData: enc.encode(aad)}, chave, b64.dec(w.ct)));
}
export function novoId() { // ordenável no tempo + aleatório (estilo ULID), gerado no cliente: inclusões não colidem
  return Date.now().toString(36).padStart(9, '0') + '-' + b64url(aleatorio(9));
}
export async function identificadorDaPublicacao(masterRaw) {
  return (await sha256hex('orquestrator-diario/pub|' + b64.enc(masterRaw))).slice(0, 32);
}

// ── o diário ────────────────────────────────────────────────────────────────────────────────────────────────────
// opções: {url, membroId, senha, masterRaw (Uint8Array), fetch?}. Sem url → modo treino.
export async function abrirDiario({url, membroId, senha, masterRaw, fetch: f = globalThis.fetch.bind(globalThis)}) {
  const d = {modo: 'treino', motivo: url ? '' : 'Servidor do diário ainda não configurado.', eventos: [], cabeca: 0, hashAnterior: '0',
    verificacao: {integro: true, ate: 0, problemas: []}, membroId, ultimaSincronia: null, fila: 0, url: url || null};
  let K = null, cifra = null, token = null, assinar = null;
  const publicas = {};

  async function api(metodo, rota, corpo, autenticado) {
    const r = await f(url.replace(/\/+$/, '') + rota, {method: metodo, headers: {'content-type': 'application/json', ...(autenticado ? {authorization: 'Bearer ' + token} : {})}, body: corpo === undefined ? undefined : JSON.stringify(corpo)});
    let j = null; try { j = await r.json(); } catch {}
    return {status: r.status, corpo: j || {}};
  }
  async function prepararChaves(raw) {
    K = raw; cifra = await hkdf(raw, 'orquestrator-diario/cifra/v1');
    token = b64url(await hkdf(raw, 'orquestrator-diario/token/v1', 'bits'));
  }
  async function criarAssinatura(kek) {
    const par = await subtle().generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
    const pub = await subtle().exportKey('jwk', par.publicKey);
    const priv = await subtle().exportKey('jwk', par.privateKey);
    const privada = await embrulhar(kek, enc.encode(JSON.stringify(priv)), 'assinatura|' + membroId);
    assinar = par.privateKey; publicas[membroId] = pub;
    return {membro: membroId, pub: {kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y}, privada};
  }

  pronto(); // prende sincronizar/acrescentar ao objeto antes do primeiro uso
  if (!url) return d;
  try {
    const kek = await chaveDaSenha(senha, membroId);
    const pubId = await identificadorDaPublicacao(masterRaw);
    const kpub = await hkdf(masterRaw, 'orquestrator-diario/pub/v1');
    const estado = await api('GET', '/api/estado');
    if (estado.status !== 200) throw new Error('servidor respondeu ' + estado.status);
    if (!estado.corpo.iniciado) {
      // primeira sócia a entrar: nasce a chave do diário
      const raw = aleatorio(32);
      await prepararChaves(raw);
      const r = await api('POST', '/api/iniciar', {tokenHash: await sha256hex(token), por: membroId,
        membro: {id: membroId, embrulho: await embrulhar(kek, raw, 'membro|' + membroId)},
        pub: {id: pubId, embrulho: await embrulhar(kpub, raw, 'pub|' + pubId)}});
      if (r.status !== 201) throw new Error('não foi possível iniciar o diário (' + r.status + ')');
      await api('POST', '/api/chaves', {assinatura: await criarAssinatura(kek)}, true);
    } else {
      const c = await api('GET', `/api/chaves?membro=${encodeURIComponent(membroId)}&pub=${pubId}`);
      Object.assign(publicas, c.corpo.assinaturas || {});
      let raw = null;
      if (c.corpo.membro) raw = await desembrulhar(kek, c.corpo.membro, 'membro|' + membroId).catch(() => null);
      if (!raw && c.corpo.pub) raw = await desembrulhar(kpub, c.corpo.pub, 'pub|' + pubId).catch(() => null);
      if (!raw) {
        d.modo = 'aguardando';
        d.motivo = c.corpo.membro ? 'A chave do diário guardada para você não abriu com esta senha (a senha mudou?). Peça para outra sócia entrar no portal: ela libera a sua chave de novo.'
          : 'O pacote foi republicado e ninguém entrou ainda nesta versão. Peça para outra sócia entrar no portal uma vez: a sua chave do diário é liberada.';
        return pronto();
      }
      await prepararChaves(raw);
      const faltam = {};
      if (!c.corpo.membro) faltam.membro = {id: membroId, embrulho: await embrulhar(kek, raw, 'membro|' + membroId)};
      if (!c.corpo.pub) faltam.pub = {id: pubId, embrulho: await embrulhar(kpub, raw, 'pub|' + pubId)};
      if (c.corpo.assinaturaPropria) {
        const jwk = JSON.parse(dec.decode(await desembrulhar(kek, c.corpo.assinaturaPropria, 'assinatura|' + membroId)));
        assinar = await subtle().importKey('jwk', jwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
      } else if (!publicas[membroId]) faltam.assinatura = await criarAssinatura(kek);
      if (Object.keys(faltam).length) await api('POST', '/api/chaves', faltam, true);
    }
    d.modo = assinar ? 'gravacao' : 'leitura';
    if (!assinar) d.motivo = 'Sua assinatura não pôde ser aberta: você lê o diário, mas não grava. Fale com o Criador.';
    await d.sincronizar();
  } catch (erro) {
    d.modo = 'indisponivel';
    d.motivo = 'Servidor do diário fora do ar ou inacessível (' + (erro && erro.message || erro) + '). Os lançamentos ficam em treino até ele voltar.';
    d.eventos = [];
  }
  return pronto();

  function pronto() {
    // ── leitura: busca o que falta, confere cadeia, assinatura e cifra; o que não confere vira "problema" e fica fora
    d.sincronizar = async function () {
      if (d.modo !== 'gravacao' && d.modo !== 'leitura') return d;
      const r = await api('GET', '/api/eventos?depois=' + d.cabeca, undefined, true);
      if (r.status !== 200) throw new Error('leitura do diário: ' + r.status);
      if (r.corpo.eventos.some(e => !publicas[e.membro])) {
        const c = await api('GET', '/api/chaves');
        Object.assign(publicas, c.corpo.assinaturas || {});
      }
      for (const e of r.corpo.eventos) {
        const problema = await conferir(e);
        if (problema) d.verificacao.problemas.push({seq: e.seq, membro: e.membro, problema});
        else d.eventos.push({seq: e.seq, id: e.id, membro: e.membro, ts: e.ts, conteudo: e.conteudo});
        d.cabeca = e.seq; d.hashAnterior = e.hash;
      }
      if (r.corpo.cabeca < d.cabeca) d.verificacao.problemas.push({seq: r.corpo.cabeca, problema: 'O servidor voltou no tempo: a cabeça do diário está atrás do que este navegador já viu.'});
      d.verificacao.integro = d.verificacao.problemas.length === 0;
      d.verificacao.ate = d.cabeca;
      d.ultimaSincronia = new Date().toISOString();
      return d;
    };
    async function conferir(e) {
      if (e.anterior !== d.hashAnterior) return 'A cadeia não fecha com o evento anterior.';
      const h = await sha256hex(`${e.anterior}|${e.id}|${e.membro}|${e.iv}|${e.ct}`);
      if (h !== e.hash) return 'O conteúdo não confere com o hash registrado.';
      const pub = publicas[e.membro];
      if (!pub) return 'Autora sem assinatura registrada.';
      const chave = await subtle().importKey('jwk', {...pub, ext: true}, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
      const ok = await subtle().verify({name: 'ECDSA', hash: 'SHA-256'}, chave, b64.dec(e.sig), enc.encode(`v1|${e.id}|${e.membro}|${e.anterior}|${e.hash}`));
      if (!ok) return 'Assinatura inválida: o evento não foi escrito por quem diz.';
      try { e.conteudo = JSON.parse(dec.decode(await desembrulhar(cifra, e, `v1|${e.id}|${e.membro}|${e.anterior}`))); }
      catch { return 'Não foi possível decifrar o evento.'; }
      return null;
    }
    // ── escrita: cifra, assina e tenta a próxima posição; num 409 busca o que entrou antes e tenta de novo
    d.acrescentar = async function (conteudo) {
      const id = novoId();
      const corpo = {v: 1, ...conteudo, quando: conteudo.quando || new Date().toISOString()};
      if (d.modo !== 'gravacao') {
        const ev = {seq: (d.eventos.length ? d.eventos[d.eventos.length - 1].seq : 0) + 1, id, membro: membroId, ts: corpo.quando, conteudo: corpo, treino: true};
        d.eventos.push(ev);
        return {ok: true, evento: ev, treino: true};
      }
      d.fila++;
      try {
        for (let tentativa = 0; tentativa < 4; tentativa++) {
          const anterior = d.hashAnterior;
          const w = await embrulhar(cifra, enc.encode(JSON.stringify(corpo)), `v1|${id}|${membroId}|${anterior}`);
          const hash = await sha256hex(`${anterior}|${id}|${membroId}|${w.iv}|${w.ct}`);
          const sig = b64.enc(await subtle().sign({name: 'ECDSA', hash: 'SHA-256'}, assinar, enc.encode(`v1|${id}|${membroId}|${anterior}|${hash}`)));
          const r = await api('POST', '/api/eventos', {seq: d.cabeca + 1, envelope: {id, membro: membroId, iv: w.iv, ct: w.ct, sig, anterior, hash}}, true);
          if (r.status === 201) {
            const ev = {seq: r.corpo.seq, id, membro: membroId, ts: r.corpo.ts, conteudo: corpo};
            d.eventos.push(ev); d.cabeca = r.corpo.seq; d.hashAnterior = hash; d.verificacao.ate = d.cabeca;
            return {ok: true, evento: ev};
          }
          if (r.status === 409) { await d.sincronizar(); continue; }
          return {ok: false, erro: r.corpo.erro || 'O servidor recusou (' + r.status + ').'};
        }
        return {ok: false, erro: 'O diário está muito movimentado agora. Tente de novo em instantes.'};
      } catch (erro) {
        return {ok: false, erro: 'Sem conexão com o servidor do diário: nada foi gravado. ' + (erro && erro.message || '')};
      } finally { d.fila--; }
    };
    return d;
  }
}
