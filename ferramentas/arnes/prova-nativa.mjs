// Prova do anfitrião nativo (10/11/2026): a MESMA interface publicada, servida como está (com a static-bridge.js de
// verdade, sem trocas), dentro de um navegador sem janela que imita a aba Finanças do AI Cask
// (ponte-nativa-de-prova.js). Confere que a ponte estática cede, que as páginas do diário não aparecem, que o
// Laboratório e os produtos abrem em molduras blob:, que a escrita passa pela ponte nativa, que nenhum link pede aba
// nova, que nada tenta sair para a rede e que não há erro de script nem violação da CSP. Fotografa o que conferiu.
// Uso: node ferramentas/arnes/prova-nativa.mjs [--saida DIR] [--porta 8791] [--site DIR]   (--site: outra árvore do portal)
//   (o Playwright vem de PLAYWRIGHT_RAIZ, do primeiro NODE_PATH que o tiver, ou de `npm root -g`)
// Sai com 1 se alguma conferência falhar; o relatório vai para <saida>/prova-nativa.txt e as fotos para <saida>/.
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {extname, join, resolve, sep, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const RAIZ = resolve(arg('site', join(aqui, '..', '..')));
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'prova-nativa')));
const PORTA = Number(arg('porta', 8791));
const TIPOS = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream'};

const candidatos = [process.env.PLAYWRIGHT_RAIZ, ...(process.env.NODE_PATH || '').split(':')].filter(Boolean);
const raizDoPlaywright = candidatos.find(pasta => existsSync(join(pasta, 'playwright', 'index.mjs'))) || execSync('npm root -g', {encoding: 'utf8'}).trim();
const {chromium} = await import(pathToFileURL(join(raizDoPlaywright, 'playwright', 'index.mjs')).href);

// a raiz do repositório como ela é: nenhuma troca de arquivo (a ponte publicada de verdade)
const servidor = createServer(async (req, res) => {
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const arquivo = resolve(join(RAIZ, caminho.endsWith('/') ? caminho + 'index.html' : caminho));
    if (arquivo !== RAIZ && !arquivo.startsWith(RAIZ + sep)) { res.writeHead(403).end(); return; }
    res.writeHead(200, {'content-type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'cache-control': 'no-store'}).end(await readFile(arquivo));
  } catch { res.writeHead(404).end(); }
});
await new Promise(ok => servidor.listen(PORTA, '127.0.0.1', ok));
await mkdir(SAIDA, {recursive: true});

const linhas = [], falhas = [];
const confere = (nome, ok, detalhe = '') => { linhas.push(`${ok ? 'ok   ' : 'FALHA'}  ${nome}${detalhe ? ' · ' + detalhe : ''}`); if (!ok) falhas.push(nome); };
const navegador = await chromium.launch();

async function abrir(query = '') {
  const contexto = await navegador.newContext({viewport: {width: 1280, height: 860}});
  const registro = {erros: [], csp: [], fora: []};
  await contexto.route('**/*', rota => {
    const endereco = new URL(rota.request().url());
    if (endereco.hostname === '127.0.0.1') return rota.continue();
    registro.fora.push(endereco.href); return rota.abort();
  });
  await contexto.exposeFunction('provaCsp', violacao => { registro.csp.push(violacao); });
  await contexto.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { if (window.top === window) window.provaCsp(e.violatedDirective + ' → ' + e.blockedURI); }));
  await contexto.addInitScript({path: join(aqui, 'ponte-nativa-de-prova.js')});
  const pagina = await contexto.newPage();
  pagina.on('pageerror', erro => registro.erros.push('erro: ' + erro.message));
  pagina.on('console', mensagem => { if (mensagem.type() === 'error' && !/favicon/.test(mensagem.text())) registro.erros.push('console: ' + mensagem.text()); });
  await pagina.goto(`http://127.0.0.1:${PORTA}/index.html${query ? '?' + query : ''}`);
  await pagina.waitForFunction(() => window.financeReady === true, null, {timeout: 15000});
  return {contexto, pagina, registro};
}
const foto = (pagina, nome) => pagina.screenshot({path: join(SAIDA, nome + '.png'), fullPage: true});
const ir = async (pagina, chave) => { await pagina.evaluate(c => window.financeNavigate(c), chave); await pagina.waitForTimeout(350); };
const fechar = registro => {
  confere('nenhum erro de script', registro.erros.length === 0, registro.erros.slice(0, 4).join(' | '));
  confere('nenhuma violação da CSP', registro.csp.length === 0, registro.csp.slice(0, 4).join(' | '));
  confere('nada tentou sair para a rede', registro.fora.length === 0, registro.fora.slice(0, 4).join(' | '));
};

try {
  // ── com sessão: o painel aberto pela ponte nativa ──────────────────────────────────────────────────────────────
  linhas.push('Com sessão (restore_session pela ponte nativa)');
  const {contexto, pagina, registro} = await abrir();
  await pagina.waitForFunction(() => !document.getElementById('dashboard').hidden && window.financeState, null, {timeout: 15000});
  const host = await pagina.evaluate(() => ({kind: window.financeHost.kind, readOnly: window.financeHost.readOnly, team: window.financeHost.team, galeriaUrl: typeof window.financeHost.galeriaUrl,
    doPortal: ['livro', 'perfis', 'painelUrl', 'painelLink', 'galeriaTelaCheia'].filter(chave => chave in window.financeHost), web: typeof window.financeWebRequest, equipe: typeof window.financeOpenTeam,
    pedidos: window.provaNativa.pedidos.slice()}));
  confere('o host continua o do app (kind aicask, com escrita, sem equipe)', host.kind === 'aicask' && host.readOnly === false && host.team === false, JSON.stringify({kind: host.kind, readOnly: host.readOnly, team: host.team}));
  confere('a ponte estática cedeu (sem ponte da web, sem equipe, nada do portal no host)', host.web === 'undefined' && host.equipe === 'undefined' && host.doPortal.length === 0, host.doPortal.join(','));
  confere('os pedidos foram pela ponte nativa', host.pedidos.includes('restore_session') && host.pedidos.includes('snapshot'), host.pedidos.join(','));
  confere('o Laboratório vem do repositório (galeriaUrl)', host.galeriaUrl === 'function');

  const gaveta = await pagina.evaluate(() => [...document.querySelectorAll('#drawer-nav [data-navigate]')].map(botao => botao.dataset.navigate));
  const doDiario = ['livro', 'lancamentos', 'parametros', 'historico'];
  confere('as páginas do diário não estão na gaveta', doDiario.every(chave => !gaveta.includes(chave)), gaveta.join(' '));
  const daEmpresa = ['overview', 'cash', 'subscriptions', 'medpainel', 'projection', 'sell', 'society', 'portfolio', 'lab'];
  confere('as páginas da empresa e o Laboratório estão na gaveta', daEmpresa.every(chave => gaveta.includes(chave)), daEmpresa.filter(chave => !gaveta.includes(chave)).join(' '));
  const produtos = gaveta.filter(chave => !daEmpresa.includes(chave));
  confere('as páginas de produto se registraram', produtos.length >= 5, produtos.join(' '));

  const cabecalho = await pagina.evaluate(() => ({modo: document.getElementById('lv-modo').hidden, separador: document.getElementById('lv-modo').previousElementSibling.hidden,
    lancar: document.getElementById('lancar-button').hidden, gavetaLancar: document.getElementById('drawer-lancar').hidden, fab: Boolean(document.getElementById('lancar-fab')),
    lendo: document.querySelector('[data-host-text="reading"]').textContent, conta: document.getElementById('change-password-button').textContent, faixa: document.getElementById('faixa-global').childElementCount}));
  confere('sem modo do diário, sem faixa de treino e sem «+ Lançar»', cabecalho.modo && cabecalho.separador && cabecalho.lancar && cabecalho.gavetaLancar && !cabecalho.fab && cabecalho.faixa === 0, JSON.stringify(cabecalho));
  confere('os rótulos são os do host local', cabecalho.lendo === 'Arquivos locais' && cabecalho.conta === 'Trocar senha', cabecalho.lendo + ' / ' + cabecalho.conta);
  await foto(pagina, 'nativo-01-painel');

  await pagina.evaluate(() => { location.hash = '#livro/2026-10'; });
  await pagina.waitForTimeout(350);
  confere('a rota #livro não abre página do diário', await pagina.evaluate(() => window.financePaginaAtiva() !== 'livro' && document.getElementById('block-livro').hidden));

  await ir(pagina, 'subscriptions');
  const assinaturas = await pagina.evaluate(() => { const seletores = [...document.querySelectorAll('#subscriptions-content select')]; return {seletores: seletores.length, travados: seletores.filter(s => s.disabled).length}; });
  confere('em Assinaturas o estado pode ser mudado (não é só leitura)', assinaturas.seletores > 0 && assinaturas.travados === 0, JSON.stringify(assinaturas));
  await foto(pagina, 'nativo-02-assinaturas');
  await pagina.evaluate(() => { const s = document.querySelector('#subscriptions-content select'); s.selectedIndex = s.selectedIndex === 0 ? 1 : 0; s.dispatchEvent(new Event('change', {bubbles: true})); });
  const mudou = await pagina.waitForFunction(() => window.provaNativa.pedidos.includes('set_subscription'), null, {timeout: 5000}).then(() => true, () => false);
  confere('mudar o estado de uma assinatura manda set_subscription pela ponte nativa', mudou);
  await pagina.waitForTimeout(600);
  confere('a mudança não deixou erro na tela', await pagina.evaluate(() => document.getElementById('dashboard-error').hidden), await pagina.evaluate(() => document.getElementById('dashboard-error').textContent));

  await ir(pagina, 'cash');
  confere('o registro do Caixa diz que é local', await pagina.evaluate(() => document.querySelector('#block-cash summary').textContent) === 'Registros locais da empresa');
  await foto(pagina, 'nativo-03-caixa');

  await ir(pagina, 'lab');
  await pagina.waitForFunction(() => { const moldura = document.getElementById('lab-frame'); return moldura && moldura.src.startsWith('blob:'); }, null, {timeout: 15000});
  const quadroDoLab = pagina.frames().find(quadro => quadro.url().startsWith('blob:'));
  await quadroDoLab.waitForLoadState('load');
  const tituloDoLab = await quadroDoLab.title();
  confere('o Laboratório abre numa moldura blob:, com a galeria do repositório', Boolean(tituloDoLab), tituloDoLab);
  confere('sem «Abrir em tela cheia» (o app não abre aba)', await pagina.evaluate(() => document.getElementById('lab-acoes').hidden));
  await pagina.waitForTimeout(500);
  await foto(pagina, 'nativo-04-laboratorio');

  // o legado que o app declarou (P1c): entra no catálogo como «Sem stand», abre na moldura com o HTML do app, e o
  // mesmo nome do repositório (sinal) continua sendo o do repositório
  const catalogo = await quadroDoLab.evaluate(() => { const itens = JSON.parse(document.getElementById('catalogo').textContent);
    return {legado: itens.filter(i => i.legado).map(i => i.arquivo + '=' + i.nome), sinal: itens.filter(i => i.arquivo === 'apps/sinal.html').map(i => Boolean(i.legado)),
      selos: [...document.querySelectorAll('article.cartao.legado .selo')].map(n => n.textContent)}; });
  confere('o legado do app entra no catálogo como «Sem stand»', JSON.stringify(catalogo.legado) === JSON.stringify(['apps/legado-de-prova.html=Maquete antiga de prova'])
    && JSON.stringify(catalogo.selos) === JSON.stringify(['Sem stand']), JSON.stringify(catalogo));
  confere('o mesmo nome no repositório e no legado: fica o do repositório', JSON.stringify(catalogo.sinal) === JSON.stringify([false]), JSON.stringify(catalogo.sinal));
  const srcDoIndice = await pagina.evaluate(() => document.getElementById('lab-frame').src);
  await quadroDoLab.evaluate(() => { const b = [...document.querySelectorAll('article.cartao.legado button.abrir')][0]; if (!b) throw new Error('sem botão do legado'); b.click(); });
  await pagina.waitForFunction(antes => document.getElementById('lab-frame').src !== antes && document.getElementById('lab-current').textContent === 'Maquete antiga de prova', srcDoIndice, {timeout: 10000});
  await pagina.waitForTimeout(300);
  const doLegado = pagina.frames().find(quadro => quadro.url().startsWith('blob:') && quadro !== pagina.mainFrame() && quadro.parentFrame() === pagina.mainFrame());
  const aberto = doLegado ? await doLegado.evaluate(() => ({titulo: document.title, marca: (document.getElementById('legado-de-prova') || {}).textContent || ''})) : null;
  confere('o documento do legado abre na moldura blob: com o HTML do app', Boolean(aberto) && aberto.titulo === 'Maquete antiga de prova' && aberto.marca === 'documento antigo, vindo do app', JSON.stringify(aberto));
  await foto(pagina, 'nativo-04b-laboratorio-legado');
  await pagina.evaluate(() => document.getElementById('lab-back').click());
  await pagina.waitForFunction(() => document.getElementById('lab-current').textContent && !document.getElementById('lab-current').textContent.includes('antiga'), null, {timeout: 10000});

  const primeiro = produtos[0];
  await ir(pagina, primeiro);
  await pagina.waitForFunction(() => { const moldura = document.querySelector('iframe.product-frame'); return moldura && moldura.src.startsWith('blob:'); }, null, {timeout: 15000});
  confere(`a página de produto (${primeiro}) abre a maquete numa moldura blob:`, true);
  await pagina.waitForTimeout(800);
  await foto(pagina, 'nativo-05-produto');

  // todas as páginas visíveis, uma a uma: nenhum link visível que peça aba nova
  const comAba = [];
  for (const chave of gaveta) {
    await ir(pagina, chave);
    const n = await pagina.evaluate(() => [...document.querySelectorAll('#dashboard a[target="_blank"]')].filter(a => a.getClientRects().length > 0).length);
    if (n) comAba.push(`${chave}:${n}`);
  }
  confere('nenhuma página mostra link que pede aba nova', comAba.length === 0, comAba.join(' '));
  fechar(registro);
  await contexto.close();

  // ── sem sessão: a entrada é a do app (CPF + senha + lembrar), e entra pela ponte nativa ─────────────────────────────
  linhas.push('', 'Sem sessão (?login=1)');
  const entrada = await abrir('login=1');
  const formulario = await entrada.pagina.evaluate(() => { const cpf = document.getElementById('login-cpf'); return {painel: document.getElementById('dashboard').hidden, cpf: !cpf.closest('.field').hidden && cpf.required,
    lembrar: !document.getElementById('login-remember').closest('label').hidden, olho: Boolean(document.getElementById('login-olho')), ajuda: document.getElementById('login-help').textContent}; });
  confere('a entrada mostra CPF e «Lembrar neste Mac» (a do app, não a do portal)', formulario.painel && formulario.cpf && formulario.lembrar, formulario.ajuda);
  confere('o olho da senha existe', formulario.olho);
  await foto(entrada.pagina, 'nativo-06-entrada');
  await entrada.pagina.fill('#login-cpf', '00000000000');
  await entrada.pagina.fill('#login-password', 'senha-de-prova');
  await entrada.pagina.click('#login-submit');
  const entrou = await entrada.pagina.waitForFunction(() => !document.getElementById('dashboard').hidden, null, {timeout: 8000}).then(() => true, () => false);
  confere('entrar manda login pela ponte nativa e abre o painel', entrou && await entrada.pagina.evaluate(() => window.provaNativa.pedidos.includes('login')));
  fechar(entrada.registro);
  await entrada.contexto.close();

  // ── tema escuro: o tema que o app declara vale ──────────────────────────────────────────────────────────────────
  linhas.push('', 'Tema escuro (?tema=escuro)');
  const escuro = await abrir('tema=escuro');
  await escuro.pagina.waitForFunction(() => !document.getElementById('dashboard').hidden && window.financeState, null, {timeout: 15000});
  confere('o tema do host vale', await escuro.pagina.evaluate(() => document.documentElement.dataset.tema) === 'escuro');
  await foto(escuro.pagina, 'nativo-07-painel-escuro');
  await ir(escuro.pagina, 'subscriptions');
  await foto(escuro.pagina, 'nativo-08-assinaturas-escuro');
  fechar(escuro.registro);
  await escuro.contexto.close();
} catch (erro) {
  confere('a prova rodou até o fim', false, erro && erro.message ? erro.message.split('\n')[0] : String(erro));
} finally {
  await navegador.close();
  await new Promise(ok => servidor.close(ok));
}
const relatorio = [`Prova do anfitrião nativo · ${new Date().toISOString()} · ${falhas.length ? falhas.length + ' FALHA(S)' : 'tudo conferido'}`, '', ...linhas, ''].join('\n');
await writeFile(join(SAIDA, 'prova-nativa.txt'), relatorio);
console.log(relatorio);
process.exit(falhas.length ? 1 : 0);
