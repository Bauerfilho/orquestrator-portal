// Fluxo do "Lembrar deste aparelho" (lembrar.js) num navegador de verdade (Chromium):
//  A · arnês (ponte simulada): a tela de entrada com a caixa e a ajuda a 390 px, claro e escuro, sem rolagem lateral;
//      entrar com "Lembrar" → recarregar entra direto (a tela de entrada não aparece nem por um quadro) e o diário abre
//      pela chave guardada (?diario=local); Sair → recarregar pede a senha; sem marcar → pede; uma aba que entra sem
//      marcar esquece o aparelho; IndexedDB apagado, registro adulterado, de outra versão ou de um pacote lacrado de novo →
//      pede a senha, sem erro; IndexedDB indisponível → entra com o aviso e depois pede; nenhuma senha em localStorage,
//      sessionStorage nem IndexedDB; as duas chaves guardadas não são extraíveis.
//  B · ponte REAL (static-bridge.js) com um pacote fictício lacrado na hora (pacote-ficticio.mjs), entregue pelas rotas do
//      Playwright no lugar do manifest.json (o pacote de verdade não é tocado), e o servidor do diário em memória no lugar
//      do Netlify: senha errada, entrar com "Lembrar", recarregar entra direto com o diário gravando, pacote lacrado de
//      novo → pede a senha e esquece, sem rede → pede a senha e GUARDA (volta a entrar direto com a rede), sócia tirada
//      do manifesto → esquece, Sair → pede a senha, sem marcar → pede. E em https://bauerfilho.github.io (o site servido
//      daqui pelas rotas, no endereço do GitHub Pages): a caixa não aparece, entrar com ela marcada à força não guarda nada,
//      um registro que tenha ficado é apagado sem entrar direto e uma página irmã da mesma origem não acha nada.
// Sai com código 1 em qualquer falha, erro de script ou violação de CSP (o registro fica em <saida>/registro.json).
// Uso: node ferramentas/arnes/fluxos/lembrar.mjs [--saida DIR] [--porta 8931] [--site DIR] [--sem-ponte-real]
import {pathToFileURL, fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {servir} from '../servir.mjs';
import {lacrarPacoteFicticio, SENHAS_FICTICIAS, NOMES_FICTICIOS} from '../pacote-ficticio.mjs';
import {criarDiario, armazemEmMemoria} from '../../../servidor/nucleo.mjs';
import {b64} from '../../../portal-crypto.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'fluxo-lembrar')));
const PORTA = Number(arg('porta', 8931));
const SITE = resolve(arg('site', join(aqui, '..', '..', '..')));
const PONTE_REAL = !process.argv.includes('--sem-ponte-real');
const raizGlobal = execSync('npm root -g').toString().trim();
const {chromium} = await import(pathToFileURL(join(raizGlobal, 'playwright', 'index.mjs')).href);

await mkdir(SAIDA, {recursive: true});
const navegador = await chromium.launch();
const registro = {quando: new Date().toISOString(), passos: [], falhas: [], erros: [], fotos: []};
const falha = (passo, texto) => { registro.falhas.push({passo, texto}); console.log(`  ✗ ${passo}: ${texto}`); };
const certo = (passo, condicao, texto) => { if (!condicao) falha(passo, texto); return Boolean(condicao); };
function passo(nome) { registro.passos.push(nome); console.log('· ' + nome); return nome; }

const TELAS = {desktop: {width: 1280, height: 860}, celular: {width: 390, height: 844}};
// Um contexto = um navegador com o seu IndexedDB: recarregar e abrir outra aba no mesmo contexto é "o mesmo aparelho".
// lento: o lembrar.js demora 400 ms para chegar (rede lenta). No arnês local tudo cabe antes da primeira pintura, e aí o
// "sem piscar" passaria mesmo sem a marca data-entrada; com a demora, sem a marca a tela de entrada aparece (conferido).
async function novoContexto(rotulo, base, {tela = 'desktop', tema = 'claro', semIndexedDB = false, lento = false} = {}) {
  const contexto = await navegador.newContext({viewport: TELAS[tela], deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: tema === 'escuro' ? 'dark' : 'light', isMobile: tela === 'celular', hasTouch: tela === 'celular'});
  await contexto.addInitScript(t => { try { localStorage.setItem('orquestrator-financas.tema', t); } catch {} }, tema);
  // a tela de entrada apareceu em algum quadro? (rAF roda antes de cada pintura; para quando o painel abre)
  await contexto.addInitScript(() => {
    window.__entradaApareceu = false;
    const olhar = () => {
      const v = document.getElementById('login-view'), d = document.getElementById('dashboard');
      if (v && !v.hidden && getComputedStyle(v).visibility === 'visible' && v.getClientRects().length) window.__entradaApareceu = true;
      if (!window.__entradaApareceu && !(d && !d.hidden)) requestAnimationFrame(olhar);
    };
    requestAnimationFrame(olhar);
  });
  if (semIndexedDB) await contexto.addInitScript(() => { Object.defineProperty(window, 'indexedDB', {configurable: true, get: () => undefined}); });
  if (lento) await contexto.route('**/lembrar.js', async rota => { await new Promise(ok => setTimeout(ok, 400)); return rota.continue(); });
  const origem = new URL(base).origin;
  contexto.on('page', pagina => vigiar(pagina, rotulo, origem));
  return contexto;
}
function vigiar(pagina, rotulo, origem) {
  pagina.on('pageerror', e => registro.erros.push({rotulo, tipo: 'pageerror', texto: String(e)}));
  pagina.on('console', m => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) registro.erros.push({rotulo, tipo: 'console.' + m.type(), texto: m.text()}); });
  pagina.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === origem) registro.erros.push({rotulo, tipo: 'http.' + r.status(), texto: r.url()}); });
}
async function abrir(contexto, endereco) {
  const pagina = await contexto.newPage();
  await pagina.goto(endereco, {waitUntil: 'load'});
  return pagina;
}
const noPainel = pagina => pagina.waitForSelector('#dashboard:not([hidden])', {timeout: 30000}).then(() => true, () => false);
// a tela de entrada visível (visibility e hidden), o painel escondido e nenhuma mensagem de erro
async function naEntrada(pagina) {
  const ok = await pagina.waitForSelector('#login-password', {state: 'visible', timeout: 15000}).then(() => true, () => false);
  const e = await pagina.evaluate(() => ({painel: !document.getElementById('dashboard').hidden, erro: document.getElementById('login-error').hidden ? '' : document.getElementById('login-error').textContent}));
  return {ok: ok && !e.painel && !e.erro, ...e};
}
async function entrar(pagina, {senha, lembrar}) {
  await pagina.waitForSelector('#login-password', {state: 'visible', timeout: 15000});
  await pagina.fill('#login-password', senha);
  if (lembrar) await pagina.check('#login-remember'); else await pagina.uncheck('#login-remember');
  await pagina.click('#login-submit');
  return noPainel(pagina);
}
async function recarregar(pagina) {
  await pagina.reload({waitUntil: 'load'});
}
// Sair: espera o aviso "Você saiu…", que só vem depois de a ponte esquecer o aparelho
const sair = async pagina => {
  await pagina.click('#logout-button');
  await pagina.waitForFunction(() => /Você saiu/.test(document.getElementById('live-status').textContent), null, {timeout: 15000}).catch(() => null);
};
const gravando = pagina => pagina.waitForFunction(() => /Gravação ligada/.test((document.getElementById('lv-modo') || {}).textContent || ''), null, {timeout: 30000}).then(() => true, () => false);
const apareceuEntrada = pagina => pagina.evaluate(() => window.__entradaApareceu === true);
// o que o aparelho guarda, sem criar o banco quando ele não existe (indexedDB.databases)
const guardado = pagina => pagina.evaluate(async () => {
  const vazio = {banco: false, chaves: [], chave: null, registro: null, texto: ''};
  if (!window.indexedDB) return vazio;
  if (!(await indexedDB.databases()).some(b => b.name === 'orquestrator-lembrar')) return vazio;
  const banco = await new Promise((ok, falhar) => { const p = indexedDB.open('orquestrator-lembrar'); p.onsuccess = () => ok(p.result); p.onerror = () => falhar(p.error); });
  try {
    if (!banco.objectStoreNames.contains('aparelho')) return {...vazio, banco: true};
    const ler = k => new Promise((ok, falhar) => { const loja = banco.transaction('aparelho').objectStore('aparelho'); const p = k === undefined ? loja.getAllKeys() : loja.get(k); p.onsuccess = () => ok(p.result); p.onerror = () => falhar(p.error); });
    const [chaves, chave, reg] = [await ler(), await ler('chave'), await ler('registro')];
    const desc = k => k ? {cryptoKey: k instanceof CryptoKey, extraivel: k.extractable, algoritmo: k.algorithm && k.algorithm.name, usos: [...k.usages].sort()} : null;
    return {banco: true, chaves, chave: desc(chave), registro: reg ? {campos: Object.keys(reg).sort(), versao: reg.versao, memberId: reg.memberId, membroDiario: reg.membroDiario, kek: desc(reg.diarioKek)} : null,
      texto: JSON.stringify([chave, reg], (c, v) => (v instanceof CryptoKey ? '[CryptoKey]' : v))};
  } finally { banco.close(); }
});
// mexe no registro guardado (para provar que o adulterado não entra)
const mexerNoRegistro = (pagina, campos) => pagina.evaluate(async c => {
  const banco = await new Promise((ok, falhar) => { const p = indexedDB.open('orquestrator-lembrar'); p.onsuccess = () => ok(p.result); p.onerror = () => falhar(p.error); });
  try {
    await new Promise((ok, falhar) => {
      const tx = banco.transaction('aparelho', 'readwrite'), loja = tx.objectStore('aparelho');
      const p = loja.get('registro');
      p.onsuccess = () => loja.put({...p.result, ...c}, 'registro');
      tx.oncomplete = ok; tx.onerror = () => falhar(tx.error);
    });
  } finally { banco.close(); }
}, campos);
const apagarBanco = pagina => pagina.evaluate(() => new Promise((ok, falhar) => { const p = indexedDB.deleteDatabase('orquestrator-lembrar'); p.onsuccess = () => ok('apagado'); p.onerror = () => falhar(p.error); p.onblocked = () => ok('bloqueado'); }));
// nenhuma senha em lugar nenhum do aparelho: localStorage, sessionStorage e o IndexedDB inteiro (o único banco que pode
// existir é o do "Lembrar", conferido por dentro; outro banco qualquer já é achado)
async function semSenhaGuardada(pagina, segredos) {
  const g = await guardado(pagina);
  const {areas, outros} = await pagina.evaluate(async () => {
    const t = [];
    for (const a of [localStorage, sessionStorage]) for (let i = 0; i < a.length; i++) { const k = a.key(i); t.push(k + '=' + a.getItem(k)); }
    return {areas: t.join('\n'), outros: (await indexedDB.databases()).map(b => b.name).filter(n => n !== 'orquestrator-lembrar')};
  });
  const tudo = areas + '\n' + g.texto;
  return [...segredos.filter(s => s && tudo.includes(s)), ...outros.map(n => 'banco ' + n)];
}
const REGISTRO_CAMPOS = ['diarioKek', 'masterCifrada', 'memberId', 'membroDiario', 'versao'].join(',');
function conferirGuardado(p, g, {memberId, membroDiario}) {
  certo(p, g.registro && g.registro.campos.join(',') === REGISTRO_CAMPOS, `o registro guardado tem os campos ${g.registro && g.registro.campos}`);
  certo(p, g.registro && g.registro.versao === 1 && g.registro.memberId === memberId && g.registro.membroDiario === membroDiario, `registro: ${JSON.stringify(g.registro)}`);
  certo(p, g.chave && g.chave.cryptoKey && g.chave.extraivel === false && g.chave.algoritmo === 'AES-GCM', `a chave do aparelho guardada: ${JSON.stringify(g.chave)}`);
  certo(p, g.registro && g.registro.kek && g.registro.kek.cryptoKey && g.registro.kek.extraivel === false && g.registro.kek.algoritmo === 'AES-GCM', `a chave do diário guardada: ${JSON.stringify(g.registro && g.registro.kek)}`);
  certo(p, g.chaves.length === 2, `o banco tem ${JSON.stringify(g.chaves)} (esperado só chave e registro)`);
}
const vazioNoAparelho = g => !g.registro && !g.chave;

// ───────────────────────────────── A · arnês (ponte simulada) ─────────────────────────────────
{
  const servidor = await servir(PORTA, SITE);
  const base = `http://127.0.0.1:${PORTA}/`;
  const SENHA = 'senha-do-teste-lembrar-7';

  // A0 · a tela de entrada a 390 px, claro e escuro (e no computador): caixa, ajuda, nada vazando para o lado
  for (const [tela, tema] of [['celular', 'claro'], ['celular', 'escuro'], ['desktop', 'claro']]) {
    const p = passo(`tela de entrada com "Lembrar deste aparelho" · ${tela} ${tema}`);
    const contexto = await novoContexto(p, base, {tela, tema});
    const pagina = await abrir(contexto, base + '?login=1');
    const e = await naEntrada(pagina);
    certo(p, e.ok, `a tela de entrada não ficou pronta: ${JSON.stringify(e)}`);
    await pagina.evaluate(() => { const a = document.activeElement; if (a) a.blur(); });
    const t = await pagina.evaluate(() => {
      const caixa = document.getElementById('login-remember'), linha = caixa.closest('label'), ajuda = document.getElementById('login-remember-help');
      const cartao = document.querySelector('.login-card').getBoundingClientRect(), r = n => n.getBoundingClientRect();
      const visivel = n => !!n && n.getClientRects().length > 0 && getComputedStyle(n).visibility === 'visible' && !n.closest('[hidden]');
      return {caixa: visivel(caixa), marcada: caixa.checked, texto: linha.textContent.trim(), ajuda: ajuda && ajuda.textContent, ajudaVisivel: visivel(ajuda), descrita: caixa.getAttribute('aria-describedby'),
        ordem: !!ajuda && !!(linha.compareDocumentPosition(ajuda) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(ajuda.compareDocumentPosition(document.getElementById('login-submit')) & Node.DOCUMENT_POSITION_FOLLOWING),
        dentro: !!ajuda && r(ajuda).right <= cartao.right + 0.5 && r(linha).right <= cartao.right + 0.5 && r(ajuda).left >= cartao.left, largura: document.documentElement.scrollWidth, janela: innerWidth,
        cpfEscondido: !!document.getElementById('login-cpf').closest('[hidden]')};
    });
    certo(p, t.caixa && t.texto === 'Lembrar deste aparelho', `a caixa: ${JSON.stringify({caixa: t.caixa, texto: t.texto})}`);
    certo(p, t.marcada === false, 'a caixa já veio marcada (lembrar é escolha de quem entra)');
    certo(p, t.ajudaVisivel && t.ajuda === 'Só nos seus aparelhos. Sair esquece.' && t.descrita === 'login-remember-help', `a ajuda: ${JSON.stringify({visivel: t.ajudaVisivel, texto: t.ajuda, descrita: t.descrita})}`);
    certo(p, t.ordem, 'a ajuda não está entre a caixa e o botão Entrar');
    certo(p, t.dentro, 'a caixa ou a ajuda passam da borda do cartão');
    certo(p, t.largura <= t.janela, `rolagem lateral: ${t.largura}px numa janela de ${t.janela}px`);
    certo(p, t.cpfEscondido, 'o campo de CPF apareceu');
    const arquivo = join(SAIDA, `${tela}-${tema}-entrada.png`);
    await pagina.screenshot({path: arquivo, fullPage: true});
    registro.fotos.push(arquivo);
    await contexto.close();
  }

  // A1 · entrar com "Lembrar" → recarregar entra direto, com o diário abrindo pela chave guardada; Sair esquece
  {
    const p = passo('entrar com “Lembrar” → recarregar entra direto (diário gravando) → Sair → pede a senha');
    const contexto = await novoContexto(p, base, {lento: true});
    const pagina = await abrir(contexto, base + '?login=1&diario=local');
    certo(p, (await naEntrada(pagina)).ok, 'a primeira visita não mostrou a tela de entrada');
    certo(p, await apareceuEntrada(pagina), 'o detector não viu a tela de entrada que estava na tela (o “sem piscar” abaixo não provaria nada)');
    certo(p, vazioNoAparelho(await guardado(pagina)), 'só abrir a tela de entrada já guardou algo no aparelho');
    certo(p, await entrar(pagina, {senha: SENHA, lembrar: true}), 'não entrou com “Lembrar” marcado');
    certo(p, await gravando(pagina), 'o diário não ligou a gravação depois de entrar');
    conferirGuardado(p, await guardado(pagina), {memberId: 'm-bauer', membroDiario: 'm-bauer'});
    const vazou = await semSenhaGuardada(pagina, [SENHA, 'arnes-m-bauer', b64.enc(new Uint8Array(32).fill(3))]);
    certo(p, !vazou.length, `achado guardado no aparelho: ${vazou.join(', ')}`);
    await recarregar(pagina);
    certo(p, await noPainel(pagina), 'recarregar não entrou direto');
    certo(p, !(await apareceuEntrada(pagina)), 'a tela de entrada piscou antes de entrar direto');
    certo(p, await gravando(pagina), 'na entrada direta o diário não abriu pela chave guardada');
    // abrir outra aba (o mesmo aparelho) também entra direto
    const outra = await abrir(contexto, base + '?login=1&diario=local#caixa');
    certo(p, await noPainel(outra) && !(await apareceuEntrada(outra)), 'uma aba nova no mesmo aparelho não entrou direto');
    certo(p, await outra.evaluate(() => location.hash) === '#caixa', 'a entrada direta perdeu o link para a página');
    await outra.close();
    await sair(pagina);
    certo(p, vazioNoAparelho(await guardado(pagina)), 'Sair não esqueceu o aparelho');
    await recarregar(pagina);
    const e = await naEntrada(pagina);
    certo(p, e.ok, `depois de Sair, recarregar devia pedir a senha: ${JSON.stringify(e)}`);
    await contexto.close();
  }

  // A2 · entrar sem marcar → recarregar pede a senha
  {
    const p = passo('entrar sem marcar → recarregar pede a senha');
    const contexto = await novoContexto(p, base);
    const pagina = await abrir(contexto, base + '?login=1');
    certo(p, await entrar(pagina, {senha: SENHA, lembrar: false}), 'não entrou sem marcar');
    certo(p, vazioNoAparelho(await guardado(pagina)), 'sem marcar, algo ficou no aparelho');
    await recarregar(pagina);
    const e = await naEntrada(pagina);
    certo(p, e.ok, `sem marcar, recarregar devia pedir a senha: ${JSON.stringify(e)}`);
    await contexto.close();
  }

  // A3 · uma aba entra com "Lembrar"; outra, que já estava na tela de entrada, entra sem marcar e esquece o aparelho
  {
    const p = passo('entrar de novo sem marcar esquece o registro antigo deste aparelho');
    const contexto = await novoContexto(p, base);
    const b = await abrir(contexto, base + '?login=1');
    certo(p, (await naEntrada(b)).ok, 'a aba B não mostrou a tela de entrada');
    const a = await abrir(contexto, base + '?login=1');
    certo(p, await entrar(a, {senha: SENHA, lembrar: true}), 'a aba A não entrou');
    certo(p, !!(await guardado(a)).registro, 'a aba A não lembrou o aparelho');
    certo(p, await entrar(b, {senha: SENHA, lembrar: false}), 'a aba B não entrou');
    certo(p, vazioNoAparelho(await guardado(b)), 'entrar sem marcar não apagou o registro antigo');
    await recarregar(a);
    certo(p, (await naEntrada(a)).ok, 'depois do esquecimento, a aba A ainda entrou direto');
    await contexto.close();
  }

  // A4 · IndexedDB apagado (o navegador limpou os dados do site) → pede a senha, sem erro
  {
    const p = passo('IndexedDB apagado → pede a senha, sem erro');
    const contexto = await novoContexto(p, base);
    const pagina = await abrir(contexto, base + '?login=1');
    certo(p, await entrar(pagina, {senha: SENHA, lembrar: true}), 'não entrou');
    certo(p, await apagarBanco(pagina) === 'apagado', 'o banco não foi apagado (conexão presa?)');
    await recarregar(pagina);
    const e = await naEntrada(pagina);
    certo(p, e.ok, `sem o banco, recarregar devia pedir a senha sem erro: ${JSON.stringify(e)}`);
    await contexto.close();
  }

  // A5 · registro adulterado (outra sócia, outra versão) e pacote lacrado de novo → pede a senha e o registro some
  {
    const p = passo('registro adulterado, de outra versão ou de um pacote lacrado de novo → pede a senha e esquece');
    const contexto = await novoContexto(p, base);
    const pagina = await abrir(contexto, base + '?login=1');
    for (const [rotulo, campos] of [['outra sócia', {memberId: 'm-ana'}], ['outra versão', {versao: 2}], ['outra sócia no diário', {membroDiario: 'm-ana'}]]) {
      if (!(await pagina.evaluate(() => !document.getElementById('dashboard').hidden))) certo(p, await entrar(pagina, {senha: SENHA, lembrar: true}), `${rotulo}: não entrou`);
      await mexerNoRegistro(pagina, campos);
      await recarregar(pagina);
      const e = await naEntrada(pagina);
      certo(p, e.ok, `${rotulo}: devia pedir a senha sem erro: ${JSON.stringify(e)}`);
      certo(p, vazioNoAparelho(await guardado(pagina)), `${rotulo}: o registro que não abre não foi apagado`);
    }
    certo(p, await entrar(pagina, {senha: SENHA, lembrar: true}), 'não entrou para o teste do pacote novo');
    await pagina.goto(base + '?login=1&pacote=novo', {waitUntil: 'load'});
    const e = await naEntrada(pagina);
    certo(p, e.ok, `pacote lacrado de novo: devia pedir a senha sem erro: ${JSON.stringify(e)}`);
    certo(p, vazioNoAparelho(await guardado(pagina)), 'pacote lacrado de novo: o registro antigo não foi apagado');
    await contexto.close();
  }

  // A6 · IndexedDB indisponível (navegação privada estrita): entra, avisa que não lembrou, e recarregar pede a senha
  {
    const p = passo('IndexedDB indisponível → entra com o aviso “não foi possível lembrar” e recarregar pede a senha');
    const contexto = await novoContexto(p, base, {semIndexedDB: true});
    const pagina = await abrir(contexto, base + '?login=1');
    certo(p, (await naEntrada(pagina)).ok, 'sem IndexedDB, a tela de entrada não apareceu');
    certo(p, await entrar(pagina, {senha: SENHA, lembrar: true}), 'sem IndexedDB, não entrou');
    const aviso = await pagina.waitForFunction(() => { const n = document.getElementById('dashboard-error'); return !n.hidden && n.textContent; }, null, {timeout: 8000}).then(h => h.jsonValue(), () => '');
    certo(p, aviso === 'Você entrou, mas não foi possível lembrar a sessão neste aparelho. Ao reabrir, entre novamente.', `o aviso foi “${aviso}”`);
    await recarregar(pagina);
    certo(p, (await naEntrada(pagina)).ok, 'sem IndexedDB, recarregar devia pedir a senha');
    await contexto.close();
  }
  servidor.close();
}

// ───────────────────── B · a ponte REAL (static-bridge.js) com um pacote fictício ─────────────────────
if (PONTE_REAL) {
  const porta = PORTA + 1;
  const servidor = await servir(porta, SITE, {ponteReal: true});
  const base = `http://127.0.0.1:${porta}/`;
  const DIARIO = 'https://orquestrator-diario.netlify.app';
  // a origem do GitHub Pages: todo repositório Pages do dono e as telas cheias públicas das maquetes dividem esta origem
  const PAGES = 'https://bauerfilho.github.io', PAGES_BASE = PAGES + '/orquestrator-portal/';
  const appDiario = criarDiario(armazemEmMemoria(), {origens: [new URL(base).origin, PAGES]});
  let pacote = await lacrarPacoteFicticio({rotulo: 'a'});
  let foraDoAr = false;   // o manifesto não chega (sem rede)
  const mestrasVistas = [b64.enc(pacote.masterRaw)];
  // uma página de outro repositório Pages do mesmo dono (mesma origem): o próprio script dela procura o "Lembrar"
  const PAGINA_IRMA = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Outro repositório</title></head><body><script>
    window.__achado = (async () => {
      if (!(await indexedDB.databases()).some(b => b.name === 'orquestrator-lembrar')) return {banco: false, chave: false, registro: false};
      const banco = await new Promise((ok, falhar) => { const p = indexedDB.open('orquestrator-lembrar'); p.onsuccess = () => ok(p.result); p.onerror = () => falhar(p.error); });
      try {
        if (!banco.objectStoreNames.contains('aparelho')) return {banco: true, chave: false, registro: false};
        const ler = k => new Promise(ok => { const r = banco.transaction('aparelho').objectStore('aparelho').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
        return {banco: true, chave: !!(await ler('chave')), registro: !!(await ler('registro'))};
      } finally { banco.close(); }
    })();
  </script></body></html>`;
  // o site servido daqui como se fosse o GitHub Pages; registrada antes das outras rotas, que vencem (pacote, diário)
  async function comoPages(rota) {
    const u = new URL(rota.request().url());
    if (u.pathname === '/outro-repo/') return rota.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: PAGINA_IRMA});
    if (!u.pathname.startsWith('/orquestrator-portal/')) return rota.fulfill({status: 204, body: ''});
    const r = await fetch(base + u.pathname.slice('/orquestrator-portal/'.length) + u.search);
    return rota.fulfill({status: r.status, contentType: r.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await r.arrayBuffer())});
  }
  async function contextoReal(rotulo, {pages = false} = {}) {
    const contexto = await novoContexto(rotulo, pages ? PAGES_BASE : base, {lento: !pages});
    if (pages) await contexto.route(PAGES + '/**', comoPages);
    // o pacote fictício no lugar do de verdade (nada no disco muda) e o diário em memória no lugar do Netlify
    await contexto.route('**/manifest.json', rota => (foraDoAr ? rota.abort('internetdisconnected') : rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(pacote.manifest)})));
    await contexto.route('**/bundle-*.bin', rota => (new URL(rota.request().url()).pathname.endsWith('/' + pacote.arquivo) ? rota.fulfill({status: 200, contentType: 'application/octet-stream', body: Buffer.from(pacote.bytes)}) : rota.fulfill({status: 404, body: ''})));
    await contexto.route('**/perfis.json', rota => rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(pacote.perfis)}));
    await contexto.route(DIARIO + '/**', async rota => {
      const pedido = rota.request();
      const corpo = ['GET', 'HEAD'].includes(pedido.method()) ? undefined : pedido.postDataBuffer() || undefined;
      const r = await appDiario(new Request(pedido.url(), {method: pedido.method(), headers: await pedido.allHeaders(), body: corpo}));
      await rota.fulfill({status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer())});
    });
    await contexto.route('https://olinda.bcb.gov.br/**', rota => rota.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: '{"value":[]}'}));
    return contexto;
  }
  const nomeNaTela = (pagina, nome) => pagina.waitForFunction(n => document.body.innerText.includes(n), nome, {timeout: 15000}).then(() => true, () => false);

  {
    const p = passo('ponte real: senha errada, entrar com “Lembrar”, recarregar entra direto com o diário gravando');
    const contexto = await contextoReal(p);
    const pagina = await abrir(contexto, base);
    certo(p, (await naEntrada(pagina)).ok, 'a ponte real não mostrou a tela de entrada');
    certo(p, await pagina.evaluate(() => document.getElementById('login-remember').closest('label').textContent.trim()) === 'Lembrar deste aparelho', 'a ponte real não mostrou a caixa “Lembrar deste aparelho”');
    await pagina.fill('#login-password', 'senha-errada-de-teste');
    await pagina.click('#login-submit');
    const erro = await pagina.waitForFunction(() => { const n = document.getElementById('login-error'); return !n.hidden && n.textContent; }, null, {timeout: 20000}).then(h => h.jsonValue(), () => '');
    certo(p, erro === 'Senha não reconhecida.', `senha errada: “${erro}”`);
    certo(p, vazioNoAparelho(await guardado(pagina)), 'a senha errada guardou algo no aparelho');
    certo(p, await entrar(pagina, {senha: SENHAS_FICTICIAS['m-ana'], lembrar: true}), 'a ponte real não entrou com a senha fictícia da Ana');
    certo(p, await nomeNaTela(pagina, NOMES_FICTICIOS['m-ana']), 'o nome do perfis.json fictício não apareceu');
    certo(p, await gravando(pagina), 'o diário (servidor em memória) não ligou a gravação');
    conferirGuardado(p, await guardado(pagina), {memberId: 'p-ana', membroDiario: 'm-ana'});
    const vazou = await semSenhaGuardada(pagina, [SENHAS_FICTICIAS['m-ana'], ...mestrasVistas]);
    certo(p, !vazou.length, `achado guardado no aparelho: ${vazou.map(v => v.slice(0, 12) + '…').join(', ')}`);
    await recarregar(pagina);
    certo(p, await noPainel(pagina), 'a ponte real não entrou direto ao recarregar');
    certo(p, !(await apareceuEntrada(pagina)), 'a tela de entrada piscou na ponte real');
    certo(p, await nomeNaTela(pagina, NOMES_FICTICIOS['m-ana']), 'na entrada direta, o perfis.json não foi lido de novo');
    certo(p, await gravando(pagina), 'na entrada direta, o diário não abriu pela chave guardada');
    const arquivo = join(SAIDA, 'ponte-real-entrada-direta.png');
    await pagina.screenshot({path: arquivo});
    registro.fotos.push(arquivo);

    const p2 = passo('ponte real: pacote lacrado de novo e sócia fora do manifesto esquecem; sem rede guarda; Sair → pede a senha');
    pacote = await lacrarPacoteFicticio({rotulo: 'b'});
    mestrasVistas.push(b64.enc(pacote.masterRaw));
    await recarregar(pagina);
    let e = await naEntrada(pagina);
    certo(p2, e.ok, `pacote lacrado de novo: devia pedir a senha sem erro: ${JSON.stringify(e)}`);
    certo(p2, vazioNoAparelho(await guardado(pagina)), 'pacote lacrado de novo: o registro antigo não foi apagado');
    certo(p2, await entrar(pagina, {senha: SENHAS_FICTICIAS['m-ana'], lembrar: true}), 'não entrou no pacote novo');
    certo(p2, await gravando(pagina), 'no pacote novo, o diário não ligou a gravação');
    await recarregar(pagina);
    certo(p2, await noPainel(pagina) && !(await apareceuEntrada(pagina)), 'no pacote novo, recarregar não entrou direto');
    certo(p2, await gravando(pagina), 'no pacote novo, a entrada direta não abriu o diário');
    // sem rede: o manifesto não chega → a tela de entrada aparece sem erro e o registro FICA; com a rede, entra direto
    foraDoAr = true;
    const errosAntes = registro.erros.length;
    await recarregar(pagina);
    e = await naEntrada(pagina);
    certo(p2, e.ok, `sem rede: devia mostrar a tela de entrada sem erro: ${JSON.stringify(e)}`);
    certo(p2, !!(await guardado(pagina)).registro, 'sem rede, o registro foi apagado (devia ficar para a próxima vez)');
    // o único erro esperado aqui é o do próprio navegador, o manifesto que não carregou
    registro.erros.splice(errosAntes, registro.erros.length - errosAntes, ...registro.erros.slice(errosAntes).filter(x => !/Failed to load resource: net::ERR_INTERNET_DISCONNECTED/.test(x.texto)));
    foraDoAr = false;
    await recarregar(pagina);
    certo(p2, await noPainel(pagina) && !(await apareceuEntrada(pagina)), 'com a rede de volta, não entrou direto');
    // a sócia tirada do manifesto (mesma chave mestra): esquece e pede a senha
    const completo = pacote;
    pacote = {...completo, manifest: {...completo.manifest, members: completo.manifest.members.filter(m => m.id !== 'p-ana')}};
    await recarregar(pagina);
    e = await naEntrada(pagina);
    certo(p2, e.ok, `sócia fora do manifesto: devia pedir a senha sem erro: ${JSON.stringify(e)}`);
    certo(p2, vazioNoAparelho(await guardado(pagina)), 'sócia fora do manifesto: o registro não foi apagado');
    pacote = completo;
    await recarregar(pagina);   // a ponte guarda o manifesto enquanto a página vive: o completo só vem numa página nova
    certo(p2, (await naEntrada(pagina)).ok, 'com o manifesto completo de novo, a tela de entrada não apareceu');
    certo(p2, await entrar(pagina, {senha: SENHAS_FICTICIAS['m-ana'], lembrar: true}), 'não entrou de novo depois da volta ao manifesto');
    await sair(pagina);
    certo(p2, vazioNoAparelho(await guardado(pagina)), 'Sair (ponte real) não esqueceu o aparelho');
    await recarregar(pagina);
    e = await naEntrada(pagina);
    certo(p2, e.ok, `depois de Sair (ponte real), recarregar devia pedir a senha: ${JSON.stringify(e)}`);

    const p3 = passo('ponte real: entrar sem marcar → recarregar pede a senha');
    certo(p3, await entrar(pagina, {senha: SENHAS_FICTICIAS['m-bia'], lembrar: false}), 'não entrou sem marcar');
    certo(p3, vazioNoAparelho(await guardado(pagina)), 'sem marcar, algo ficou no aparelho');
    await recarregar(pagina);
    e = await naEntrada(pagina);
    certo(p3, e.ok, `sem marcar (ponte real), recarregar devia pedir a senha: ${JSON.stringify(e)}`);
    const vazou2 = await semSenhaGuardada(pagina, [...Object.values(SENHAS_FICTICIAS), ...mestrasVistas]);
    certo(p3, !vazou2.length, 'sobrou senha ou mestra no aparelho');
    await contexto.close();
  }

  // B4 · no endereço do GitHub Pages a origem é dividida (outros repositórios do dono, as telas cheias públicas): o
  // IndexedDB é por origem e a chave do aparelho, mesmo não extraível, decifraria a mestra para qualquer script dali
  {
    const p4 = passo('ponte real em bauerfilho.github.io: sem a caixa, nada no aparelho, registro antigo apagado, página irmã não acha nada');
    const contexto = await contextoReal(p4, {pages: true});
    const pagina = await abrir(contexto, PAGES_BASE);
    certo(p4, (await naEntrada(pagina)).ok, 'no github.io, a tela de entrada não apareceu');
    const caixa = await pagina.evaluate(() => { const c = document.getElementById('login-remember'), l = c.closest('label'); return {escondida: l.hidden || !l.getClientRects().length, marcada: c.checked, ajuda: !!document.getElementById('login-remember-help')}; });
    certo(p4, caixa.escondida && !caixa.marcada && !caixa.ajuda, `no github.io a caixa “Lembrar” apareceu: ${JSON.stringify(caixa)}`);
    // entrar com a caixa marcada à força (um app.js antigo no cache, por exemplo): entra, e nada vai para o aparelho
    await pagina.fill('#login-password', SENHAS_FICTICIAS['m-ana']);
    await pagina.evaluate(() => { document.getElementById('login-remember').checked = true; });
    await pagina.click('#login-submit');
    certo(p4, await noPainel(pagina), 'no github.io, não entrou');
    certo(p4, await gravando(pagina), 'no github.io, o diário não ligou a gravação');
    await pagina.waitForTimeout(300);
    certo(p4, vazioNoAparelho(await guardado(pagina)), 'no github.io, entrar com a caixa marcada guardou algo no aparelho');
    // a página irmã (outro repositório Pages, mesma origem) não acha nada
    const irma = await abrir(contexto, PAGES + '/outro-repo/');
    const achado = await irma.evaluate(() => window.__achado);
    certo(p4, !achado.chave && !achado.registro, `a página irmã achou o “Lembrar”: ${JSON.stringify(achado)}`);
    await irma.close();
    // um registro que tenha ficado (de antes desta correção): não entra direto e é apagado
    await pagina.evaluate(async ({mestra, senha}) => {
      const L = await import(new URL('lembrar.js', location.href).href), D = await import(new URL('diario.js', location.href).href);
      const masterRaw = Uint8Array.from(atob(mestra), c => c.charCodeAt(0));
      await L.lembrarAparelho({memberId: 'p-ana', membroDiario: 'm-ana', masterRaw, diarioKek: await D.chaveDaSenhaDoDiario(senha, 'm-ana')});
    }, {mestra: b64.enc(pacote.masterRaw), senha: SENHAS_FICTICIAS['m-ana']});
    certo(p4, !!(await guardado(pagina)).registro, 'o registro antigo não foi plantado (o teste abaixo não provaria nada)');
    await recarregar(pagina);
    const e = await naEntrada(pagina);
    certo(p4, e.ok, `no github.io, um registro antigo entrou direto: ${JSON.stringify(e)}`);
    // a ponte apaga sem esperar (um IndexedDB travado não segura a tela de entrada): confere por até 8 s
    let apagado = false;
    for (let i = 0; i < 40 && !apagado; i++) { apagado = vazioNoAparelho(await guardado(pagina)); if (!apagado) await pagina.waitForTimeout(200); }
    certo(p4, apagado, 'no github.io, o registro antigo não foi apagado');
    await contexto.close();
  }
  servidor.close();
}

await navegador.close();
for (const e of registro.erros) falha('erros da página', `${e.rotulo} · ${e.tipo} · ${e.texto}`);
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`\n${registro.passos.length} passos · ${registro.fotos.length} fotos em ${SAIDA} · ${registro.falhas.length} falha(s)`);
if (registro.falhas.length) process.exitCode = 1;
