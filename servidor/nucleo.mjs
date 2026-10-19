// O servidor do diário do Finanças: guarda envelopes CIFRADOS num log só-acréscimo. Não lê conteúdo nenhum: a cifra, a
// assinatura e a regra de negócio vivem no navegador das sócias (diario.js + razao.js). Aqui só se garante que:
//   · cada evento ocupa a posição seguinte à cabeça (compare-and-swap: duas gravações ao mesmo tempo, uma recebe 409);
//   · nada é alterado nem apagado (não existe rota de UPDATE nem de DELETE; gravação condicional onlyIfNew);
//   · só escreve quem prova conhecer a chave do diário (token derivado dela; o servidor guarda só o SHA-256).
// O armazenamento é injetado (Netlify Blobs em produção, um Map nos testes): testes/servidor.test.mjs. Do lado do
// navegador, quem fala com este servidor é a portaHttp do diario.js (o contrato das portas: docs/PORTAS.md).
// O diário é paginado: GET /eventos devolve até LIMITE_PAGINA registros por pedido (o cliente pede a próxima página até
// chegar à cabeça) e lê os blobs em lotes paralelos, para o pedido continuar curto mesmo com o Blobs lento.

const ID = /^[A-Za-z0-9._-]{1,80}$/;
const B64 = /^[A-Za-z0-9+/=_-]{1,20000}$/;
const MAX_EVENTO = 16 * 1024;
export const LIMITE_PAGINA = 500;
export const LOTE_DE_LEITURA = 25; // leituras simultâneas no Blobs: rápido sem estourar o limite de pedidos por segundo
const enc = new TextEncoder();
const chaveEvento = seq => 'ev/' + String(seq).padStart(9, '0');

async function sha256hex(texto) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)));
  return [...d].map(b => b.toString(16).padStart(2, '0')).join('');
}
function igual(a, b) { // comparação em tempo constante
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const embrulhoValido = w => w && typeof w === 'object' && B64.test(w.iv || '') && B64.test(w.ct || '') && (!w.sal || B64.test(w.sal));
const assinaturaValida = a => a && typeof a === 'object' && a.pub && typeof a.pub === 'object' && a.pub.kty === 'EC' && a.pub.crv === 'P-256' && embrulhoValido(a.privada);

export function criarDiario(store, {origens = []} = {}) {
  const cors = req => {
    const origem = req.headers.get('origin') || '';
    const h = {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'vary': 'Origin', 'x-content-type-options': 'nosniff'};
    if (origens.includes(origem)) Object.assign(h, {'access-control-allow-origin': origem, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '600'});
    return h;
  };
  const responder = (req, status, corpo) => new Response(corpo === null ? null : JSON.stringify(corpo), {status, headers: cors(req)});

  async function posicoes() { // as posições ocupadas do log, numa listagem só
    const {blobs} = await store.list({prefix: 'ev/'});
    return blobs.map(b => parseInt(b.key.slice(3), 10)).filter(Number.isSafeInteger);
  }
  const maior = ns => ns.reduce((a, b) => (b > a ? b : a), 0);
  async function cabeca() { return maior(await posicoes()); }
  async function lerEmLotes(chaves) { // LOTE_DE_LEITURA de cada vez, em paralelo; a ordem das chaves se mantém
    const eventos = [];
    for (let i = 0; i < chaves.length; i += LOTE_DE_LEITURA) {
      const lote = await Promise.all(chaves.slice(i, i + LOTE_DE_LEITURA).map(k => store.get(k, {type: 'json'})));
      for (const e of lote) if (e) eventos.push(e);
    }
    return eventos;
  }
  async function autorizado(req) {
    const cfg = await store.get('config/token', {type: 'json'});
    const m = /^Bearer\s+(\S{20,200})$/.exec(req.headers.get('authorization') || '');
    return !!(cfg && m && igual(await sha256hex(m[1]), cfg.tokenHash));
  }
  async function guardarChaves(corpo, criados) {
    if (corpo.membro !== undefined) {
      if (!corpo.membro || !ID.test(corpo.membro.id || '') || !embrulhoValido(corpo.membro.embrulho)) throw new Error('chave de membro inválida');
      const r = await store.setJSON('chaves/membro/' + corpo.membro.id, corpo.membro.embrulho, {onlyIfNew: true});
      if (r.modified) criados.push('membro');
    }
    if (corpo.pub !== undefined) {
      if (!corpo.pub || !ID.test(corpo.pub.id || '') || !embrulhoValido(corpo.pub.embrulho)) throw new Error('chave de publicação inválida');
      const r = await store.setJSON('chaves/pub/' + corpo.pub.id, corpo.pub.embrulho, {onlyIfNew: true});
      if (r.modified) criados.push('pub');
    }
    if (corpo.assinatura !== undefined) {
      if (!corpo.assinatura || !ID.test(corpo.assinatura.membro || '') || !assinaturaValida(corpo.assinatura)) throw new Error('assinatura inválida');
      // primeiro registro vale (trust on first use); trocar exige o Criador apagar à mão no painel da Netlify
      const r = await store.setJSON('assinaturas/' + corpo.assinatura.membro, {pub: corpo.assinatura.pub, privada: corpo.assinatura.privada, em: new Date().toISOString()}, {onlyIfNew: true});
      if (r.modified) criados.push('assinatura');
    }
  }

  return async function diario(req) {
    if (req.method === 'OPTIONS') return responder(req, 204, null);
    const url = new URL(req.url);
    const rota = url.pathname.replace(/^\/api\/diario|^\/api/, '').replace(/\/+$/, '') || '/';
    try {
      if (req.method === 'GET' && rota === '/estado') {
        const cfg = await store.get('config/token', {type: 'json'});
        return responder(req, 200, {iniciado: !!cfg, cabeca: cfg ? await cabeca() : 0, criadoEm: cfg ? cfg.em : null});
      }
      if (req.method === 'GET' && rota === '/chaves') {
        const membro = url.searchParams.get('membro') || '', pub = url.searchParams.get('pub') || '';
        if ((membro && !ID.test(membro)) || (pub && !ID.test(pub))) return responder(req, 400, {erro: 'identificador inválido'});
        const {blobs} = await store.list({prefix: 'assinaturas/'});
        const assinaturas = {};
        for (const b of blobs) { const a = await store.get(b.key, {type: 'json'}); if (a) assinaturas[b.key.slice(12)] = a.pub; }
        const propria = membro ? await store.get('assinaturas/' + membro, {type: 'json'}) : null;
        return responder(req, 200, {
          membro: membro ? await store.get('chaves/membro/' + membro, {type: 'json'}) : null,
          pub: pub ? await store.get('chaves/pub/' + pub, {type: 'json'}) : null,
          assinaturaPropria: propria ? propria.privada : null, assinaturas});
      }
      if (req.method === 'POST' && rota === '/iniciar') {
        const corpo = await req.json();
        if (!/^[0-9a-f]{64}$/.test(corpo.tokenHash || '')) return responder(req, 400, {erro: 'token inválido'});
        const r = await store.setJSON('config/token', {tokenHash: corpo.tokenHash, em: new Date().toISOString(), por: ID.test(corpo.por || '') ? corpo.por : null}, {onlyIfNew: true});
        if (!r.modified) return responder(req, 409, {erro: 'O diário já foi iniciado.'});
        const criados = [];
        await guardarChaves(corpo, criados);
        return responder(req, 201, {iniciado: true, criados});
      }
      if (!(await autorizado(req))) return responder(req, 401, {erro: 'Chave do diário não reconhecida.'});
      if (req.method === 'POST' && rota === '/chaves') {
        const criados = [];
        await guardarChaves(await req.json(), criados);
        return responder(req, 200, {criados});
      }
      if (req.method === 'GET' && rota === '/eventos') {
        const depois = Math.max(0, parseInt(url.searchParams.get('depois') || '0', 10) || 0);
        const ns = await posicoes(); // a cabeça sai desta mesma listagem: uma por pedido
        const chaves = ns.filter(n => n > depois).sort((a, b) => a - b).slice(0, LIMITE_PAGINA).map(chaveEvento);
        return responder(req, 200, {eventos: await lerEmLotes(chaves), cabeca: maior(ns)});
      }
      if (req.method === 'POST' && rota === '/eventos') {
        const bruto = await req.text();
        if (bruto.length > MAX_EVENTO) return responder(req, 413, {erro: 'Evento grande demais.'});
        const corpo = JSON.parse(bruto);
        const e = corpo.envelope || {};
        if (!Number.isSafeInteger(corpo.seq) || corpo.seq < 1) return responder(req, 400, {erro: 'posição inválida'});
        if (!ID.test(e.id || '') || !ID.test(e.membro || '') || !B64.test(e.iv || '') || !B64.test(e.ct || '') || !B64.test(e.sig || '') || typeof e.anterior !== 'string' || typeof e.hash !== 'string') return responder(req, 400, {erro: 'envelope inválido'});
        const atual = await cabeca();
        if (corpo.seq !== atual + 1) return responder(req, 409, {erro: 'O diário andou: busque os eventos novos e tente de novo.', cabeca: atual});
        const registro = {seq: corpo.seq, id: e.id, membro: e.membro, iv: e.iv, ct: e.ct, sig: e.sig, anterior: e.anterior, hash: e.hash, ts: new Date().toISOString()};
        const r = await store.setJSON(chaveEvento(corpo.seq), registro, {onlyIfNew: true});
        if (!r.modified) return responder(req, 409, {erro: 'Outra sócia gravou nesta posição primeiro.', cabeca: await cabeca()});
        return responder(req, 201, {seq: corpo.seq, ts: registro.ts});
      }
      return responder(req, 404, {erro: 'rota inexistente'});
    } catch (erro) {
      return responder(req, 400, {erro: 'pedido inválido: ' + String(erro && erro.message || erro).slice(0, 120)});
    }
  };
}

// armazenamento em memória com a mesma semântica do Netlify Blobs (testes e arnês local)
export function armazemEmMemoria() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async setJSON(k, v, {onlyIfNew} = {}) { if (onlyIfNew && m.has(k)) return {modified: false}; m.set(k, structuredClone(v)); return {modified: true}; },
    async list({prefix = ''} = {}) { return {blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({key}))}; },
    _mapa: m,
  };
}
