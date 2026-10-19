// O diário cifrado do Finanças, do lado do navegador. Toda gravação de uma sócia (lançamento, correção, parâmetro) vira um
// evento cifrado aqui (AES-GCM), assinado por ela (ECDSA P-256) e acrescentado ao fim do log no armazenamento, que só
// guarda texto cifrado. Ler é o caminho inverso, conferindo a cadeia (cada evento aponta o hash do anterior) e a assinatura.
//
// As chaves nascem no navegador (decisão da noite de 19/10, docs/CHECKLIST.md), sem depender do Mac:
//   · chave do diário K (32 bytes aleatórios): criada pela primeira sócia que entra; guardada no servidor embrulhada
//     (1) pela chave da senha de cada sócia — PBKDF2-SHA256 de 600 mil iterações — e (2) pela chave da publicação atual
//     do pacote, para que quem ainda não entrou consiga abri-la no primeiro acesso;
//   · token de escrita = HKDF(K, "token"): prova ao servidor que quem escreve conhece K (ele guarda só o SHA-256);
//   · par ECDSA por sócia: a chave privada fica no servidor embrulhada pela senha dela; a pública é registrada no
//     primeiro uso e confere a autoria de cada evento em todos os navegadores.
// O diário fala com o armazenamento por uma PORTA (docs/PORTAS.md): um objeto com seis operações assíncronas que só
// levam e trazem dados cifrados. portaHttp é o servidor Netlify de hoje (servidor/nucleo.mjs); portaMemoria guarda tudo
// na aba (testes e treino). Trocar de armazenamento é escrever outra porta: o resto do portal não muda.
// Sem porta (nem url), o diário roda em MODO TREINO: tudo funciona sobre uma cópia em memória e a tela avisa que nada é
// salvo. Testes: testes/diario.test.mjs (contra o servidor de servidor/nucleo.mjs) e testes/portas.test.mjs (o contrato).

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

// A chave da senha de uma sócia no diário (PBKDF2-SHA256, 600 mil iterações, ~meio segundo), NÃO extraível. Abre os
// embrulhos dela no servidor (a chave do diário e a assinatura). O "Lembrar deste aparelho" (lembrar.js) guarda esta chave
// no próprio navegador, nunca a senha, e a devolve a abrirDiario({kek}).
export async function chaveDaSenhaDoDiario(senha, membroId) {
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

// ── as portas (docs/PORTAS.md) ──────────────────────────────────────────────────────────────────────────────────────
// Toda operação é assíncrona e responde {ok: true, ...} ou {ok: false, motivo, mensagem}; a porta só LANÇA erro quando
// não consegue falar com o armazenamento (rede, servidor fora do ar): aí o diário fica indisponível e cai no treino.
export const OPERACOES_DA_PORTA = Object.freeze(['estado', 'iniciar', 'chaves', 'registrarChaves', 'lerEventos', 'acrescentar']);
// Os comprovantes (F3-5) passam pela mesma porta com mais duas operações. Só a interface por ora: porta sem elas = o
// comprovante fica só na aba. guardarAnexo({token, ref, corpo}) → {ok, novo} · lerAnexo({token, ref}) → {ok, corpo}.
export const OPERACOES_DE_ANEXOS = Object.freeze(['guardarAnexo', 'lerAnexo']);
export const MOTIVOS_DA_PORTA = Object.freeze(['conflito', 'nao_autorizado', 'invalido', 'grande_demais', 'inexistente', 'recusado']);
export function faltasDaPorta(porta) {
  if (!porta || typeof porta !== 'object') return [...OPERACOES_DA_PORTA];
  return OPERACOES_DA_PORTA.filter(op => typeof porta[op] !== 'function');
}
export const portaTemAnexos = porta => !!porta && typeof porta === 'object' && OPERACOES_DE_ANEXOS.every(op => typeof porta[op] === 'function');

// portaHttp: o servidor do diário na Netlify (servidor/nucleo.mjs), com o protocolo de sempre (/api/estado, /api/chaves,
// /api/iniciar, /api/eventos). 4xx vira recusa com motivo; rede fora ou 5xx lança erro.
const MOTIVO_DO_STATUS = {400: 'invalido', 401: 'nao_autorizado', 403: 'nao_autorizado', 404: 'inexistente', 409: 'conflito', 413: 'grande_demais'};
// Cada pedido tem prazo (PRAZO_MS): ler e gravar passam pela mesma trava, então um pedido pendurado na rede prenderia
// todas as gravações; com o prazo ele vira erro ('Sem conexão…') e a trava solta.
const PRAZO_MS = 20000;
export function portaHttp(url, f = (...args) => globalThis.fetch(...args), prazoMs = PRAZO_MS) {
  const raiz = String(url || '').replace(/\/+$/, '');
  async function pedir(metodo, rota, corpo, token) {
    let relogio;
    const prazo = new Promise((_, falhar) => { relogio = setTimeout(() => falhar(new Error('o servidor não respondeu em ' + Math.round(prazoMs / 1000) + ' s')), prazoMs); });
    const ida = f(raiz + rota, {method: metodo, headers: {'content-type': 'application/json', ...(token ? {authorization: 'Bearer ' + token} : {})}, body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(prazoMs) : undefined});
    let r;
    try { r = await Promise.race([ida, prazo]); } finally { clearTimeout(relogio); }
    let j = null; try { j = await r.json(); } catch {}
    return {status: r.status, corpo: j && typeof j === 'object' ? j : {}};
  }
  function recusa(r) {
    if (!(r.status >= 400 && r.status < 500)) throw new Error('servidor respondeu ' + r.status);
    const saida = {ok: false, motivo: MOTIVO_DO_STATUS[r.status] || 'recusado', mensagem: typeof r.corpo.erro === 'string' ? r.corpo.erro : 'O servidor recusou (' + r.status + ').'};
    if (Number.isSafeInteger(r.corpo.cabeca)) saida.cabeca = r.corpo.cabeca;
    return saida;
  }
  return {
    nome: 'http', url: raiz, duravel: true, limitePagina: 500,
    async estado() {
      const r = await pedir('GET', '/api/estado');
      if (r.status !== 200) throw new Error('servidor respondeu ' + r.status);
      return {ok: true, iniciado: !!r.corpo.iniciado, cabeca: Number(r.corpo.cabeca) || 0, criadoEm: r.corpo.criadoEm ?? null};
    },
    async iniciar(pedido) {
      const r = await pedir('POST', '/api/iniciar', pedido);
      return r.status === 201 ? {ok: true, criados: r.corpo.criados || []} : recusa(r);
    },
    async chaves({membro, pub} = {}) {
      const q = [membro ? 'membro=' + encodeURIComponent(membro) : '', pub ? 'pub=' + encodeURIComponent(pub) : ''].filter(Boolean).join('&');
      const r = await pedir('GET', '/api/chaves' + (q ? '?' + q : ''));
      if (r.status !== 200) return recusa(r);
      return {ok: true, membro: r.corpo.membro ?? null, pub: r.corpo.pub ?? null, assinaturaPropria: r.corpo.assinaturaPropria ?? null, assinaturas: r.corpo.assinaturas || {}};
    },
    async registrarChaves({token, ...chaves} = {}) {
      const r = await pedir('POST', '/api/chaves', chaves, token);
      return r.status === 200 ? {ok: true, criados: r.corpo.criados || []} : recusa(r);
    },
    async lerEventos({token, depois = 0} = {}) {
      const r = await pedir('GET', '/api/eventos?depois=' + depois, undefined, token);
      if (r.status !== 200) return recusa(r);
      return {ok: true, eventos: Array.isArray(r.corpo.eventos) ? r.corpo.eventos : [], cabeca: Number(r.corpo.cabeca) || 0};
    },
    async acrescentar({token, seq, envelope} = {}) {
      const r = await pedir('POST', '/api/eventos', {seq, envelope}, token);
      return r.status === 201 ? {ok: true, seq: r.corpo.seq, ts: r.corpo.ts} : recusa(r);
    },
  };
}

// portaSobreChaveValor: uma porta inteira sobre qualquer armazém chave-valor que saiba três coisas — ler(chave),
// gravarSeNova(chave, valor) → true/false (sem nunca sobrescrever) e listar(prefixo). As regras são as do servidor
// (servidor/nucleo.mjs), com as mesmas chaves; testes/portas.test.mjs confere que as duas respondem igual. Atenção: se o
// armazém estiver do outro lado da rede, quem garante "só acréscimo" e "só escreve quem tem o token" é ele (docs/PORTAS.md).
const ID = /^[A-Za-z0-9._-]{1,80}$/;
const B64 = /^[A-Za-z0-9+/=_-]{1,20000}$/;
const MAX_EVENTO = 16 * 1024;
const LIMITE_PAGINA = 500, LOTE_DE_LEITURA = 25;
const chaveEvento = seq => 'ev/' + String(seq).padStart(9, '0');
const embrulhoValido = w => !!w && typeof w === 'object' && B64.test(w.iv || '') && B64.test(w.ct || '') && (!w.sal || B64.test(w.sal));
const assinaturaValida = a => !!a && typeof a === 'object' && !!a.pub && typeof a.pub === 'object' && a.pub.kty === 'EC' && a.pub.crv === 'P-256' && embrulhoValido(a.privada);
const recusada = (motivo, mensagem, extra) => ({ok: false, motivo, mensagem, ...extra});
function igual(a, b) { // comparação em tempo constante
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export function portaSobreChaveValor(kv, {nome = 'chave-valor', duravel = true, limitePagina = LIMITE_PAGINA} = {}) {
  const limite = Math.max(1, Math.floor(Number(limitePagina)) || LIMITE_PAGINA);
  const posicoes = async () => (await kv.listar('ev/')).map(k => parseInt(String(k).slice(3), 10)).filter(Number.isSafeInteger);
  const maior = ns => ns.reduce((a, b) => (b > a ? b : a), 0);
  async function autorizado(token) {
    const cfg = await kv.ler('config/token');
    return !!(cfg && typeof token === 'string' && /^\S{20,200}$/.test(token) && igual(await sha256hex(token), cfg.tokenHash));
  }
  async function guardarChaves(corpo) { // na mesma ordem do servidor: o que veio válido antes do erro fica gravado
    const criados = [];
    if (corpo.membro !== undefined) {
      if (!corpo.membro || !ID.test(corpo.membro.id || '') || !embrulhoValido(corpo.membro.embrulho)) return {criados, erro: 'chave de membro inválida'};
      if (await kv.gravarSeNova('chaves/membro/' + corpo.membro.id, corpo.membro.embrulho)) criados.push('membro');
    }
    if (corpo.pub !== undefined) {
      if (!corpo.pub || !ID.test(corpo.pub.id || '') || !embrulhoValido(corpo.pub.embrulho)) return {criados, erro: 'chave de publicação inválida'};
      if (await kv.gravarSeNova('chaves/pub/' + corpo.pub.id, corpo.pub.embrulho)) criados.push('pub');
    }
    if (corpo.assinatura !== undefined) {
      if (!corpo.assinatura || !ID.test(corpo.assinatura.membro || '') || !assinaturaValida(corpo.assinatura)) return {criados, erro: 'assinatura inválida'};
      // primeiro registro vale (trust on first use)
      if (await kv.gravarSeNova('assinaturas/' + corpo.assinatura.membro, {pub: corpo.assinatura.pub, privada: corpo.assinatura.privada, em: new Date().toISOString()})) criados.push('assinatura');
    }
    return {criados, erro: ''};
  }
  return {
    nome, duravel, limitePagina: limite,
    async estado() {
      const cfg = await kv.ler('config/token');
      return {ok: true, iniciado: !!cfg, cabeca: cfg ? maior(await posicoes()) : 0, criadoEm: cfg ? cfg.em : null};
    },
    async iniciar(pedido = {}) {
      pedido = pedido || {};
      if (!/^[0-9a-f]{64}$/.test(pedido.tokenHash || '')) return recusada('invalido', 'token inválido');
      if (!(await kv.gravarSeNova('config/token', {tokenHash: pedido.tokenHash, em: new Date().toISOString(), por: ID.test(pedido.por || '') ? pedido.por : null}))) return recusada('conflito', 'O diário já foi iniciado.');
      const {criados, erro} = await guardarChaves(pedido);
      return erro ? recusada('invalido', 'pedido inválido: ' + erro) : {ok: true, criados};
    },
    async chaves({membro = '', pub = ''} = {}) {
      if ((membro && !ID.test(membro)) || (pub && !ID.test(pub))) return recusada('invalido', 'identificador inválido');
      const assinaturas = {};
      for (const k of await kv.listar('assinaturas/')) { const a = await kv.ler(k); if (a) assinaturas[k.slice(12)] = a.pub; }
      const propria = membro ? await kv.ler('assinaturas/' + membro) : null;
      return {ok: true, membro: membro ? (await kv.ler('chaves/membro/' + membro)) ?? null : null, pub: pub ? (await kv.ler('chaves/pub/' + pub)) ?? null : null,
        assinaturaPropria: propria ? propria.privada : null, assinaturas};
    },
    async registrarChaves({token, ...corpo} = {}) {
      if (!(await autorizado(token))) return recusada('nao_autorizado', 'Chave do diário não reconhecida.');
      const {criados, erro} = await guardarChaves(corpo);
      return erro ? recusada('invalido', 'pedido inválido: ' + erro) : {ok: true, criados};
    },
    async lerEventos({token, depois = 0} = {}) {
      if (!(await autorizado(token))) return recusada('nao_autorizado', 'Chave do diário não reconhecida.');
      const apos = Math.max(0, Math.trunc(Number(depois)) || 0);
      const ns = await posicoes();
      const escolhidas = ns.filter(n => n > apos).sort((a, b) => a - b).slice(0, limite);
      const eventos = [];
      for (let i = 0; i < escolhidas.length; i += LOTE_DE_LEITURA) { // em lotes paralelos, mantendo a ordem
        const lote = await Promise.all(escolhidas.slice(i, i + LOTE_DE_LEITURA).map(n => kv.ler(chaveEvento(n))));
        for (const e of lote) if (e) eventos.push(e);
      }
      return {ok: true, eventos, cabeca: maior(ns)};
    },
    async acrescentar({token, seq, envelope} = {}) {
      if (!(await autorizado(token))) return recusada('nao_autorizado', 'Chave do diário não reconhecida.');
      if (JSON.stringify({seq, envelope}).length > MAX_EVENTO) return recusada('grande_demais', 'Evento grande demais.');
      const e = envelope || {};
      if (!Number.isSafeInteger(seq) || seq < 1) return recusada('invalido', 'posição inválida');
      if (!ID.test(e.id || '') || !ID.test(e.membro || '') || !B64.test(e.iv || '') || !B64.test(e.ct || '') || !B64.test(e.sig || '') || typeof e.anterior !== 'string' || typeof e.hash !== 'string') return recusada('invalido', 'envelope inválido');
      const atual = maior(await posicoes());
      if (seq !== atual + 1) return recusada('conflito', 'O diário andou: busque os eventos novos e tente de novo.', {cabeca: atual});
      const registro = {seq, id: e.id, membro: e.membro, iv: e.iv, ct: e.ct, sig: e.sig, anterior: e.anterior, hash: e.hash, ts: new Date().toISOString()};
      if (!(await kv.gravarSeNova(chaveEvento(seq), registro))) return recusada('conflito', 'Outra sócia gravou nesta posição primeiro.', {cabeca: maior(await posicoes())});
      return {ok: true, seq, ts: registro.ts};
    },
  };
}

// portaMemoria: tudo num Map desta aba, com as mesmas regras do servidor (testes e treino; some ao recarregar).
// limitePagina menor serve para testar a paginação.
export function portaMemoria({limitePagina} = {}) {
  const m = new Map();
  const kv = {
    async ler(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async gravarSeNova(k, v) { if (m.has(k)) return false; m.set(k, structuredClone(v)); return true; },
    async listar(prefixo = '') { return [...m.keys()].filter(k => k.startsWith(prefixo)); },
  };
  return Object.defineProperty(portaSobreChaveValor(kv, {nome: 'memoria', duravel: false, limitePagina}), '_mapa', {value: m}); // _mapa: só para os testes
}

// ── o diário ────────────────────────────────────────────────────────────────────────────────────────────────────
// opções: {porta | url, membroId, senha | kek, masterRaw (Uint8Array), fetch?}. {url} é o mesmo que {porta: portaHttp(url, fetch)}.
// {kek} é a chave da senha já derivada (chaveDaSenhaDoDiario): a mesma chave, sem a senha e sem a espera do PBKDF2; nada
// muda no servidor nem no formato. Sem porta nem url → modo treino.
export async function abrirDiario({url, porta, membroId, senha, kek: kekPronta, masterRaw, fetch: f}) {
  if (!porta && url) porta = portaHttp(url, f);
  const d = {modo: 'treino', motivo: porta ? '' : 'Servidor do diário ainda não configurado.', eventos: [], cabeca: 0, hashAnterior: '0',
    verificacao: {integro: true, ate: 0, problemas: []}, membroId, ultimaSincronia: null, fila: 0,
    url: porta && typeof porta.url === 'string' ? porta.url : null, porta: porta ? String(porta.nome || 'propria') : null};
  let K = null, cifra = null, token = null, assinar = null;
  const publicas = {}, verificadoras = new Map();
  // uma coisa de cada vez: ler e gravar mexem na cabeça e na cadeia; em paralelo, um veria o estado do outro pela metade
  let trava = Promise.resolve();
  const emOrdem = tarefa => { const p = trava.then(tarefa); trava = p.catch(() => {}); return p; };
  let sincroniaNaFila = null;

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

  // ── leitura: busca o que falta, página por página, até a cabeça; confere cadeia, assinatura e cifra; o que não confere
  // vira "problema" e fica fora. Chamadas que chegam durante uma leitura esperam e dividem a próxima.
  d.sincronizar = function () {
    if (d.modo !== 'gravacao' && d.modo !== 'leitura') return Promise.resolve(d);
    if (!sincroniaNaFila) sincroniaNaFila = emOrdem(() => { sincroniaNaFila = null; return sincronizarAgora(); });
    return sincroniaNaFila;
  };
  async function sincronizarAgora() {
    try {
      for (;;) {
        const antes = d.cabeca;
        const r = await porta.lerEventos({token, depois: d.cabeca});
        if (!r || !r.ok) throw new Error('leitura do diário: ' + (r && (r.mensagem || r.motivo)));
        const eventos = Array.isArray(r.eventos) ? r.eventos : [];
        if (eventos.some(e => !publicas[e.membro])) {
          const c = await porta.chaves({});
          if (c && c.ok) Object.assign(publicas, c.assinaturas || {});
        }
        for (const e of eventos) {
          // posição que este navegador já tinha (servidor que reenvia): vira problema, sem duplicar nem mexer na cadeia.
          // Um pulo (registro sumido no servidor) segue como antes: a conferência acusa a cadeia e a leitura não trava.
          if (!(e.seq > d.cabeca)) { d.verificacao.problemas.push({seq: e.seq, membro: e.membro, problema: 'O servidor reenviou uma posição que este navegador já tinha.'}); continue; }
          const problema = await conferir(e);
          if (problema) d.verificacao.problemas.push({seq: e.seq, membro: e.membro, problema});
          else d.eventos.push({seq: e.seq, id: e.id, membro: e.membro, ts: e.ts, conteudo: e.conteudo});
          d.cabeca = e.seq; d.hashAnterior = e.hash;
        }
        if (r.cabeca < d.cabeca) { d.verificacao.problemas.push({seq: r.cabeca, problema: 'O servidor voltou no tempo: a cabeça do diário está atrás do que este navegador já viu.'}); break; }
        // a página veio e a cabeça informada ainda está à frente: busca a próxima antes de devolver (sem avanço, para)
        if (!eventos.length || d.cabeca >= r.cabeca || d.cabeca <= antes) break;
      }
      d.ultimaSincronia = new Date().toISOString();
    } finally {
      d.verificacao.integro = d.verificacao.problemas.length === 0;
      d.verificacao.ate = d.cabeca;
    }
    return d;
  }
  function verificadora(membro) { // a chave pública importada uma vez por autora, não uma vez por evento
    const pub = publicas[membro];
    if (!pub) return null;
    const marca = `${membro}|${pub.x}|${pub.y}`;
    if (!verificadoras.has(marca)) verificadoras.set(marca, subtle().importKey('jwk', {...pub, ext: true}, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']));
    return verificadoras.get(marca);
  }
  async function conferir(e) {
    try {
      if (e.anterior !== d.hashAnterior) return 'A cadeia não fecha com o evento anterior.';
      const h = await sha256hex(`${e.anterior}|${e.id}|${e.membro}|${e.iv}|${e.ct}`);
      if (h !== e.hash) return 'O conteúdo não confere com o hash registrado.';
      const chave = verificadora(e.membro);
      if (!chave) return 'Autora sem assinatura registrada.';
      const ok = await subtle().verify({name: 'ECDSA', hash: 'SHA-256'}, await chave, b64.dec(e.sig), enc.encode(`v1|${e.id}|${e.membro}|${e.anterior}|${e.hash}`));
      if (!ok) return 'Assinatura inválida: o evento não foi escrito por quem diz.';
    } catch { return 'O registro está malformado: não foi possível conferir a assinatura.'; }
    try { e.conteudo = JSON.parse(dec.decode(await desembrulhar(cifra, e, `v1|${e.id}|${e.membro}|${e.anterior}`))); }
    catch { return 'Não foi possível decifrar o evento.'; }
    return null;
  }
  // ── escrita: cifra, assina e tenta a próxima posição; num conflito busca o que entrou antes e tenta de novo
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
      return await emOrdem(() => gravar(id, corpo));
    } catch (erro) {
      return {ok: false, erro: 'Sem conexão com o servidor do diário: nada foi gravado. ' + (erro && erro.message || '')};
    } finally { d.fila--; }
  };
  async function gravar(id, corpo) {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const anterior = d.hashAnterior;
      const w = await embrulhar(cifra, enc.encode(JSON.stringify(corpo)), `v1|${id}|${membroId}|${anterior}`);
      const hash = await sha256hex(`${anterior}|${id}|${membroId}|${w.iv}|${w.ct}`);
      const sig = b64.enc(await subtle().sign({name: 'ECDSA', hash: 'SHA-256'}, assinar, enc.encode(`v1|${id}|${membroId}|${anterior}|${hash}`)));
      const r = await porta.acrescentar({token, seq: d.cabeca + 1, envelope: {id, membro: membroId, iv: w.iv, ct: w.ct, sig, anterior, hash}});
      if (r && r.ok) {
        const ev = {seq: r.seq, id, membro: membroId, ts: r.ts, conteudo: corpo};
        d.eventos.push(ev); d.cabeca = r.seq; d.hashAnterior = hash; d.verificacao.ate = d.cabeca;
        return {ok: true, evento: ev};
      }
      if (r && r.motivo === 'conflito') { await sincronizarAgora(); continue; }
      return {ok: false, erro: (r && r.mensagem) || 'O servidor recusou.'};
    }
    return {ok: false, erro: 'O diário está muito movimentado agora. Tente de novo em instantes.'};
  }

  if (!porta) return d;
  const faltas = faltasDaPorta(porta);
  if (faltas.length) {
    d.modo = 'indisponivel';
    d.motivo = 'A porta do diário está incompleta (falta: ' + faltas.join(', ') + '; veja docs/PORTAS.md). Os lançamentos ficam em treino.';
    return d;
  }
  try {
    const kek = kekPronta || await chaveDaSenhaDoDiario(senha, membroId);
    const pubId = await identificadorDaPublicacao(masterRaw);
    const kpub = await hkdf(masterRaw, 'orquestrator-diario/pub/v1');
    const estado = await porta.estado();
    if (!estado || !estado.ok) throw new Error('servidor respondeu ' + (estado && (estado.mensagem || estado.motivo)));
    if (!estado.iniciado) {
      // primeira sócia a entrar: nasce a chave do diário
      const raw = aleatorio(32);
      await prepararChaves(raw);
      const r = await porta.iniciar({tokenHash: await sha256hex(token), por: membroId,
        membro: {id: membroId, embrulho: await embrulhar(kek, raw, 'membro|' + membroId)},
        pub: {id: pubId, embrulho: await embrulhar(kpub, raw, 'pub|' + pubId)}});
      if (!r || !r.ok) throw new Error('não foi possível iniciar o diário (' + (r && (r.mensagem || r.motivo)) + ')');
      await porta.registrarChaves({token, assinatura: await criarAssinatura(kek)});
    } else {
      const c = await porta.chaves({membro: membroId, pub: pubId});
      if (!c || !c.ok) throw new Error('chaves do diário: ' + (c && (c.mensagem || c.motivo)));
      Object.assign(publicas, c.assinaturas || {});
      let raw = null;
      if (c.membro) raw = await desembrulhar(kek, c.membro, 'membro|' + membroId).catch(() => null);
      if (!raw && c.pub) raw = await desembrulhar(kpub, c.pub, 'pub|' + pubId).catch(() => null);
      if (!raw) {
        d.modo = 'aguardando';
        d.motivo = c.membro ? 'A chave do diário guardada para você não abriu com esta senha (a senha mudou?). Peça para outra sócia entrar no portal: ela libera a sua chave de novo.'
          : 'O pacote foi republicado e ninguém entrou ainda nesta versão. Peça para outra sócia entrar no portal uma vez: a sua chave do diário é liberada.';
        return d;
      }
      await prepararChaves(raw);
      const faltam = {};
      if (!c.membro) faltam.membro = {id: membroId, embrulho: await embrulhar(kek, raw, 'membro|' + membroId)};
      if (!c.pub) faltam.pub = {id: pubId, embrulho: await embrulhar(kpub, raw, 'pub|' + pubId)};
      if (c.assinaturaPropria) {
        const jwk = JSON.parse(dec.decode(await desembrulhar(kek, c.assinaturaPropria, 'assinatura|' + membroId)));
        assinar = await subtle().importKey('jwk', jwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
      } else if (!publicas[membroId]) faltam.assinatura = await criarAssinatura(kek);
      if (Object.keys(faltam).length) await porta.registrarChaves({token, ...faltam});
    }
    d.modo = assinar ? 'gravacao' : 'leitura';
    if (!assinar) d.motivo = 'Sua assinatura não pôde ser aberta: você lê o diário, mas não grava. Fale com o Criador.';
    await d.sincronizar();
  } catch (erro) {
    d.modo = 'indisponivel';
    d.motivo = 'Servidor do diário fora do ar ou inacessível (' + (erro && erro.message || erro) + '). Os lançamentos ficam em treino até ele voltar.';
    d.eventos = [];
  }
  return d;
}
