// Fluxo dos perfis das sócias (Sociedade → Atualizar perfis) num navegador de verdade (Chromium):
//  A · arnês (ponte simulada, ?diario=local: o servidor do diário em memória, com os 409 de verdade):
//      · corrida: a responsável (desktop) muda a função da Ana e salva; a Ana (iPhone), com o formulário aberto e o
//        telefone digitado, salva segundos depois, ANTES da sincronia de 60 s. O Salvar dela não apaga a função nova: junta
//        e pede para conferir; o segundo Salvar grava as duas coisas, e quem recarrega vê as duas;
//      · a 390 px (iPhone): os campos dos blocos e a caixa "Colar vários de uma vez" a 16 px ou mais (menos dá zoom ao tocar);
//      · "Como ler esta página" da Sociedade diz que os perfis gravam pelo diário (não "É consulta").
//  B · ponte REAL (static-bridge.js) com o pacote fictício (pacote-ficticio.mjs) pelas rotas do Playwright e o diário em
//      memória no lugar do Netlify: a responsável salva o próprio perfil; noutra entrada o perfis.json não chega (rede):
//      o aviso fica mesmo com os cartões na tela, o bloco da Ana (ainda só no arquivo) diz por que não salva e o Salvar
//      não grava nada; o da responsável (já no diário) salva. Com o perfis.json de volta, a função da Ana continua lá.
// Sai com código 1 em qualquer falha, erro de script ou violação de CSP (o registro fica em <saida>/registro.json).
// Uso: node ferramentas/arnes/fluxos/perfis.mjs [--saida DIR] [--porta 8951] [--site DIR] [--sem-ponte-real]
import {pathToFileURL, fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {servir} from '../servir.mjs';
import {lacrarPacoteFicticio, SENHAS_FICTICIAS, NOMES_FICTICIOS} from '../pacote-ficticio.mjs';
import {criarDiario, armazemEmMemoria} from '../../../servidor/nucleo.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'fluxo-perfis')));
const PORTA = Number(arg('porta', 8951));
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
async function novoContexto(rotulo, base, {tela = 'desktop'} = {}) {
  const contexto = await navegador.newContext({viewport: TELAS[tela], deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: tela === 'celular', hasTouch: tela === 'celular'});
  const origem = new URL(base).origin;
  contexto.on('page', pagina => {
    pagina.on('pageerror', e => registro.erros.push({rotulo, tipo: 'pageerror', texto: String(e)}));
    pagina.on('console', m => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) registro.erros.push({rotulo, tipo: 'console.' + m.type(), texto: m.text()}); });
    pagina.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === origem) registro.erros.push({rotulo, tipo: 'http.' + r.status(), texto: r.url()}); });
  });
  return contexto;
}
const noPainel = pagina => pagina.waitForSelector('#dashboard:not([hidden])', {timeout: 30000}).then(() => true, () => false);
const gravando = pagina => pagina.waitForFunction(() => /Gravação ligada/.test((document.getElementById('lv-modo') || {}).textContent || ''), null, {timeout: 30000}).then(() => true, () => false);
// a Sociedade com "Atualizar perfis" aberto (o detalhe começa fechado quando alguém já tem perfil)
async function naSociedade(pagina) {
  await pagina.evaluate(() => { if (location.hash !== '#sociedade') location.hash = '#sociedade'; });
  const ok = await pagina.waitForSelector('.perfis-ferramenta', {timeout: 15000}).then(() => true, () => false);
  if (ok && !(await pagina.evaluate(() => document.querySelector('.perfis-ferramenta').open))) await pagina.click('.perfis-ferramenta > summary');
  return ok;
}
const statusDo = (pagina, id) => pagina.evaluate(i => { const s = document.querySelector(`#perfil-${i} .perfil-bloco-status`); return s ? s.textContent : null; }, id);
// espera o Salvar responder (o status sai de "Salvando…")
const respondeu = (pagina, id) => pagina.waitForFunction(i => { const s = document.querySelector(`#perfil-${i} .perfil-bloco-status`); return s && s.textContent && !/Salvando/.test(s.textContent); }, id, {timeout: 20000}).then(() => true, () => false);
const camposDo = (pagina, id) => pagina.evaluate(i => Object.fromEntries([...document.querySelectorAll(`#perfil-${i} input`)].map(n => [n.name, n.value])), id);
const lido = (pagina, id) => pagina.evaluate(i => { const d = window.financeHost.perfis.ler(); return d && d.membros.find(m => m.id === i); }, id);

// ───────────────────────────────── A · arnês (ponte simulada) ─────────────────────────────────
{
  const servidor = await servir(PORTA, SITE);
  const base = `http://127.0.0.1:${PORTA}/`;

  // A1 · a corrida: a Ana salva antes de o aparelho dela ver o que a responsável acabou de salvar
  {
    const p = passo('corrida: a responsável muda a função da Ana; a Ana, sem sincronizar, salva o telefone; nada se perde');
    const cA = await novoContexto(p, base), cB = await novoContexto(p, base, {tela: 'celular'});
    const A = await cA.newPage(), B = await cB.newPage();
    await A.goto(base + '?membro=m-bauer&diario=local&perfis=demo#sociedade', {waitUntil: 'load'});
    await B.goto(base + '?membro=m-ana&diario=local&perfis=demo#sociedade', {waitUntil: 'load'});
    for (const [rotulo, pg] of [['responsável', A], ['Ana', B]]) {
      certo(p, await noPainel(pg) && await gravando(pg), `${rotulo}: o portal não abriu com a gravação ligada`);
      certo(p, await naSociedade(pg), `${rotulo}: Atualizar perfis não apareceu`);
    }
    // a Ana começa a mexer no telefone dela (rascunho); a responsável muda a função da Ana e salva
    await B.fill('#perfil-m-ana-fone', '64911112222');
    await A.fill('#perfil-m-ana-funcao', 'Diretora financeira');
    await A.click('#perfil-m-ana button[type=submit]');
    certo(p, await respondeu(A, 'm-ana') && /Salvo/.test(await statusDo(A, 'm-ana')), `a responsável não salvou: ${await statusDo(A, 'm-ana')}`);
    certo(p, (await B.evaluate(() => window.financeHost.livro.diario().cabeca)) === 0, 'o aparelho da Ana já tinha sincronizado (a corrida não aconteceria)');
    // a Ana salva logo depois, sem a sincronia de 60 s
    await B.click('#perfil-m-ana button[type=submit]');
    certo(p, await respondeu(B, 'm-ana'), 'o Salvar da Ana não respondeu');
    // o único erro esperado: o 409 do servidor do diário (a corrida em si; o diario.js sincroniza e reenvia)
    const conflitos = registro.erros.filter(x => x.rotulo === p && (/^http\.409$/.test(x.tipo) && /\/api\/eventos$/.test(x.texto) || /status of 409 \(Conflict\)/.test(x.texto)));
    certo(p, conflitos.length >= 1, 'o servidor não respondeu 409 ao Salvar da Ana (a corrida não aconteceu)');
    registro.erros = registro.erros.filter(x => !conflitos.includes(x));
    const st = await statusDo(B, 'm-ana');
    certo(p, /mudou enquanto você editava/.test(st), `o Salvar da Ana não pediu para conferir: “${st}”`);
    const juntos = await camposDo(B, 'm-ana');
    certo(p, juntos.funcao === 'Diretora financeira' && juntos.fone === '64911112222', `os campos da Ana não juntaram as duas mudanças: ${JSON.stringify(juntos)}`);
    certo(p, (await lido(B, 'm-ana')).funcao === 'Diretora financeira', 'no aparelho da Ana, a função nova sumiu do que está salvo');
    const cartao = await B.waitForFunction(() => /Diretora financeira/.test((document.querySelector('.perfil-cartao[data-socia="m-ana"]') || {}).textContent || ''), null, {timeout: 8000}).then(() => true, () => false);
    certo(p, cartao, 'o cartão da Ana não mostrou a função que a responsável salvou');
    // conferido, o segundo Salvar grava as duas coisas
    await B.click('#perfil-m-ana button[type=submit]');
    certo(p, await respondeu(B, 'm-ana') && /Salvo/.test(await statusDo(B, 'm-ana')), `o segundo Salvar da Ana não gravou: “${await statusDo(B, 'm-ana')}”`);
    await A.reload({waitUntil: 'load'});
    certo(p, await noPainel(A) && await gravando(A), 'a responsável não voltou com a gravação ligada');
    const final = await lido(A, 'm-ana');
    certo(p, final && final.funcao === 'Diretora financeira' && final.fone === '(64) 91111-2222', `depois de recarregar: ${JSON.stringify(final && {funcao: final.funcao, fone: final.fone})}`);
    const recusas = await A.evaluate(() => window.financeHost.livro.diario().eventos.filter(e => e.conteudo.acao === 'set_profile').map(e => [e.membro, e.conteudo.versao]));
    certo(p, JSON.stringify(recusas) === JSON.stringify([['m-bauer', 0], ['m-ana', 0], ['m-ana', 1]]), `os set_profile no diário: ${JSON.stringify(recusas)}`);
    const arquivo = join(SAIDA, 'corrida-ana-390.png');
    await B.screenshot({path: arquivo, fullPage: false});
    registro.fotos.push(arquivo);
    await cA.close(); await cB.close();
  }

  // A2 · a 390 px (iPhone): campos e a caixa de colar a 16 px ou mais
  {
    const p = passo('a 390 px: os campos dos blocos e a caixa “Colar vários de uma vez” a 16 px ou mais (sem zoom no iPhone)');
    const contexto = await novoContexto(p, base, {tela: 'celular'});
    const pagina = await contexto.newPage();
    await pagina.goto(base + '?membro=m-bauer&diario=local&perfis=demo#sociedade', {waitUntil: 'load'});
    certo(p, await noPainel(pagina) && await naSociedade(pagina), 'a Sociedade não abriu');
    await pagina.click('.perfis-colar > summary');
    await pagina.tap('.perfis-entrada');
    const fontes = await pagina.evaluate(() => [...document.querySelectorAll('.perfis-ferramenta input, .perfis-ferramenta textarea')].map(n => [n.id || n.className, parseFloat(getComputedStyle(n).fontSize)]));
    certo(p, fontes.some(([id]) => id === 'perfis-entrada'), 'a caixa de colar não apareceu');
    const pequenas = fontes.filter(([, px]) => px < 16);
    certo(p, !pequenas.length, `campos abaixo de 16 px: ${JSON.stringify(pequenas)}`);
    certo(p, await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'rolagem lateral a 390 px');
    await contexto.close();
  }

  // A3 · "Como ler esta página" da Sociedade
  {
    const p = passo('“Como ler esta página” da Sociedade: perfis gravados pelo diário, não “É consulta”');
    const contexto = await novoContexto(p, base, {tela: 'celular'});
    const pagina = await contexto.newPage();
    await pagina.goto(base + '?perfis=demo#sociedade', {waitUntil: 'load'});
    certo(p, await noPainel(pagina) && await naSociedade(pagina), 'a Sociedade não abriu');
    await pagina.click('#page-help');
    await pagina.waitForSelector('#page-help-dialog[open]');
    const ajuda = await pagina.evaluate(() => ({de: document.getElementById('page-help-from').textContent, nao: document.getElementById('page-help-not').textContent}));
    certo(p, /diário cifrado/.test(ajuda.de) && /Atualizar perfis/.test(ajuda.de), `de onde vem: “${ajuda.de}”`);
    certo(p, !/É consulta|nem registra alterações/.test(ajuda.nao) && /próprio perfil/.test(ajuda.nao), `o que não é: “${ajuda.nao}”`);
    await contexto.close();
  }
  servidor.close();
}

// ───────────────────── B · a ponte REAL (static-bridge.js): o perfis.json não chega numa entrada ─────────────────────
if (PONTE_REAL) {
  const porta = PORTA + 1;
  const servidor = await servir(porta, SITE, {ponteReal: true});
  const base = `http://127.0.0.1:${porta}/`;
  const DIARIO = 'https://orquestrator-diario.netlify.app';
  const appDiario = criarDiario(armazemEmMemoria(), {origens: [new URL(base).origin]});
  const pacote = await lacrarPacoteFicticio({iteracoes: 2000});
  async function entrar(rotulo, {perfisFora = false} = {}) {
    const contexto = await novoContexto(rotulo, base);
    await contexto.route('**/manifest.json', rota => rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(pacote.manifest)}));
    await contexto.route('**/bundle-*.bin', rota => rota.fulfill({status: 200, contentType: 'application/octet-stream', body: Buffer.from(pacote.bytes)}));
    await contexto.route('**/perfis.json', rota => (perfisFora ? rota.abort('internetdisconnected') : rota.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(pacote.perfis)})));
    await contexto.route(DIARIO + '/**', async rota => {
      const pedido = rota.request();
      const corpo = ['GET', 'HEAD'].includes(pedido.method()) ? undefined : pedido.postDataBuffer() || undefined;
      const r = await appDiario(new Request(pedido.url(), {method: pedido.method(), headers: await pedido.allHeaders(), body: corpo}));
      await rota.fulfill({status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer())});
    });
    await contexto.route('https://olinda.bcb.gov.br/**', rota => rota.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: '{"value":[]}'}));
    const pagina = await contexto.newPage();
    await pagina.goto(base + '#sociedade', {waitUntil: 'load'});
    await pagina.waitForSelector('#login-password', {state: 'visible', timeout: 15000});
    await pagina.fill('#login-password', SENHAS_FICTICIAS['m-bauer']);
    await pagina.click('#login-submit');
    const ok = await noPainel(pagina) && await gravando(pagina);
    if (perfisFora) registro.erros = registro.erros.filter(x => !(x.rotulo === rotulo && /ERR_INTERNET_DISCONNECTED/.test(x.texto)));   // o único erro esperado: o perfis.json que não chegou
    return {contexto, pagina, ok};
  }
  const p = passo('ponte real: o perfis.json não chega; o aviso fica, a Ana (só no arquivo) não salva, a responsável salva; nada se perde');
  // X · entrada normal: a responsável salva o próprio perfil (passa a estar no diário)
  {
    const {contexto, pagina, ok} = await entrar(p);
    certo(p, ok && await naSociedade(pagina), 'X: não entrou na Sociedade com a gravação ligada');
    certo(p, (await lido(pagina, 'm-ana')).funcao === 'Função de exemplo', 'X: a função da Ana (perfis.json) não apareceu');
    await pagina.fill('#perfil-m-bauer-funcao', 'Responsável');
    await pagina.click('#perfil-m-bauer button[type=submit]');
    certo(p, await respondeu(pagina, 'm-bauer') && /Salvo/.test(await statusDo(pagina, 'm-bauer')), `X: a responsável não salvou: “${await statusDo(pagina, 'm-bauer')}”`);
    await contexto.close();
  }
  // Y · o perfis.json não chega nesta entrada
  {
    const {contexto, pagina, ok} = await entrar(p, {perfisFora: true});
    certo(p, ok, 'Y: não entrou com a gravação ligada');
    await pagina.evaluate(() => { location.hash = '#sociedade'; });
    await pagina.waitForSelector('.perfis-ferramenta', {timeout: 15000});
    await pagina.waitForSelector('.perfil-cartao', {timeout: 10000}).catch(() => null);   // os cartões vêm quando o diário abre
    const tela = await pagina.evaluate(() => ({aberto: document.querySelector('.perfis-ferramenta').open, cartoes: document.querySelectorAll('.perfil-cartao').length,
      aviso: [...document.querySelectorAll('.perfis-aviso')].map(n => n.textContent).join(' | ')}));
    certo(p, tela.cartoes > 0, 'Y: os cartões não apareceram (o caso perigoso é com eles na tela)');
    certo(p, /Recarregue a página/.test(tela.aviso), `Y: o aviso de recarregar não apareceu: “${tela.aviso}”`);
    certo(p, !tela.aberto, 'Y: Atualizar perfis abriu sozinho sem o perfis.json');
    await naSociedade(pagina);
    certo(p, /Recarregue a página/.test(await statusDo(pagina, 'm-ana') || ''), `Y: o bloco da Ana não disse por que não salva: “${await statusDo(pagina, 'm-ana')}”`);
    certo(p, !(await statusDo(pagina, 'm-bauer')), `Y: o bloco da responsável (já no diário) veio travado: “${await statusDo(pagina, 'm-bauer')}”`);
    const antes = await pagina.evaluate(() => window.financeHost.livro.diario().eventos.length);
    await pagina.fill('#perfil-m-ana-nome', NOMES_FICTICIOS['m-ana']);
    await pagina.fill('#perfil-m-ana-fone', '64900000002');
    certo(p, /Recarregue a página/.test(await statusDo(pagina, 'm-ana') || ''), 'Y: o porquê sumiu ao digitar');
    await pagina.click('#perfil-m-ana button[type=submit]');
    await pagina.waitForTimeout(400);
    certo(p, /Recarregue a página/.test(await statusDo(pagina, 'm-ana') || ''), `Y: o Salvar da Ana não disse por que não salva: “${await statusDo(pagina, 'm-ana')}”`);
    certo(p, (await pagina.evaluate(() => window.financeHost.livro.diario().eventos.length)) === antes, 'Y: o Salvar da Ana gravou no diário sem o perfis.json');
    // pela ponte direto (um app.js antigo no cache): recusa também
    const pelaPonte = await pagina.evaluate(n => window.financeHost.perfis.salvar('m-ana', {nome: n}).then(() => 'gravou', e => e.code + ': ' + e.message), NOMES_FICTICIOS['m-ana']);
    certo(p, /^indisponivel: .*Recarregue/.test(pelaPonte), `Y: a ponte aceitou salvar a Ana sem o perfis.json: ${pelaPonte}`);
    // a responsável, que já está no diário, salva normalmente
    await pagina.fill('#perfil-m-bauer-fone', '64900000009');
    await pagina.click('#perfil-m-bauer button[type=submit]');
    certo(p, await respondeu(pagina, 'm-bauer') && /Salvo/.test(await statusDo(pagina, 'm-bauer')), `Y: a responsável não salvou o próprio perfil: “${await statusDo(pagina, 'm-bauer')}”`);
    const arquivo = join(SAIDA, 'perfis-fora.png');
    await pagina.screenshot({path: arquivo, fullPage: true});
    registro.fotos.push(arquivo);
    await contexto.close();
  }
  // Z · com o perfis.json de volta, a Ana continua com a função do arquivo
  {
    const {contexto, pagina, ok} = await entrar(p);
    certo(p, ok, 'Z: não entrou com a gravação ligada');
    const ana = await lido(pagina, 'm-ana');
    certo(p, ana && ana.funcao === 'Função de exemplo' && ana.fonte === 'arquivo', `Z: a Ana perdeu o que estava no perfis.json: ${JSON.stringify(ana && {funcao: ana.funcao, fonte: ana.fonte})}`);
    certo(p, (await lido(pagina, 'm-bauer')).fone === '(64) 90000-0009', 'Z: o que a responsável salvou sem o perfis.json não ficou');
    await contexto.close();
  }
  servidor.close();
}

await navegador.close();
for (const e of registro.erros) falha('erros da página', `${e.rotulo} · ${e.tipo} · ${e.texto}`);
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`\n${registro.passos.length} passos · ${registro.fotos.length} fotos em ${SAIDA} · ${registro.falhas.length} falha(s)`);
if (registro.falhas.length) process.exitCode = 1;
