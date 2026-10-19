// Fluxo da fatia F2-4 (mapa do portal): a gaveta montada pelo registro (paginas.js), um endereço para cada página, o
// Voltar do navegador, o link direto depois da senha, o "Ver a conta" que chega ao lançamento e ao parâmetro em até 3
// cliques, o #lancar, uma página registrada em tempo de execução (na gaveta, na rota e nas fotos) e a faixa de treino em
// todas as páginas. Fotografa a gaveta aberta nos 4 cortes. Sai com código 1 em qualquer falha, erro de script ou
// violação de CSP (o registro fica em <saida>/registro.json).
// Uso: node ferramentas/arnes/fluxos/navegacao.mjs [--saida DIR] [--porta 8790] [--site DIR] [--sem-fotografar]
import {pathToFileURL, fileURLToPath} from 'node:url';
import {execSync, execFileSync} from 'node:child_process';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {servir} from '../servir.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'fluxo-navegacao')));
const PORTA = Number(arg('porta', 8790));
const FOTOGRAFAR = !process.argv.includes('--sem-fotografar');
const SITE = resolve(arg('site', join(aqui, '..', '..', '..')));
const raizGlobal = execSync('npm root -g').toString().trim();
const {chromium} = await import(pathToFileURL(join(raizGlobal, 'playwright', 'index.mjs')).href);

await mkdir(SAIDA, {recursive: true});
const servidor = await servir(PORTA, SITE);
const navegador = await chromium.launch();
const base = `http://127.0.0.1:${PORTA}/`;
const registro = {quando: new Date().toISOString(), passos: [], falhas: [], erros: [], enderecos: [], fotos: []};
const falha = (passo, texto) => { registro.falhas.push({passo, texto}); console.log(`  ✗ ${passo}: ${texto}`); };
const certo = (passo, condicao, texto) => { if (!condicao) falha(passo, texto); return Boolean(condicao); };

// o módulo de teste: uma página nova registrada em tempo de execução, sem tocar no app.js nem no index.html
const MODULO_URL = '/__teste/pagina-de-teste.js';
const MODULO = `import {registrarPagina, el} from '/livro.js';
const pagina = window.financeRegistrarPagina({chave: 'teste-nav', rota: 'teste-nav', grupo: 'Ajuda', titulo: 'Página de teste',
  descricao: 'Registrada em tempo de execução pelo arnês.', depoisDe: 'historico',
  ajuda: {oque: 'Uma página de mentira, para provar o registro.', deonde: 'Do módulo de teste do fluxo de navegação.', naoe: 'Não existe no portal publicado.'}});
registrarPagina(() => { pagina.conteudo.replaceChildren(el('p', 'section-intro', 'Conteúdo desenhado pelo módulo de teste.')); });
window.__paginaDeTeste = pagina.chave;
`;

const TELAS = {desktop: {width: 1280, height: 860}, celular: {width: 390, height: 844}};
async function abrir(rotulo, endereco, {tela = 'desktop', tema = 'claro', modulo = false} = {}) {
  const contexto = await navegador.newContext({viewport: TELAS[tela], deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: tema === 'escuro' ? 'dark' : 'light', isMobile: tela === 'celular', hasTouch: tela === 'celular'});
  await contexto.addInitScript(t => { try { localStorage.setItem('orquestrator-financas.tema', t); } catch {} }, tema);
  if (modulo) await contexto.route('**' + MODULO_URL, rota => rota.fulfill({status: 200, contentType: 'text/javascript; charset=utf-8', body: MODULO}));
  const pagina = await contexto.newPage();
  pagina.on('pageerror', e => registro.erros.push({rotulo, tipo: 'pageerror', texto: String(e)}));
  pagina.on('console', m => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) registro.erros.push({rotulo, tipo: 'console.' + m.type(), texto: m.text()}); });
  pagina.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === base.slice(0, -1)) registro.erros.push({rotulo, tipo: 'http.' + r.status(), texto: r.url()}); });
  pagina.on('framenavigated', f => { if (f === pagina.mainFrame()) registro.enderecos.push({rotulo, url: f.url()}); });
  await pagina.goto(base + endereco, {waitUntil: 'load'});
  return {contexto, pagina};
}
const pronto = pagina => pagina.waitForSelector('#dashboard:not([hidden])', {timeout: 15000});
const estado = pagina => pagina.evaluate(() => {
  const visivel = document.querySelector('[data-finance-page]:not([hidden])');
  const ativo = document.activeElement;
  return {hash: location.hash, pagina: visivel ? visivel.dataset.financePage : null, titulo: document.getElementById('dashboard-title').textContent,
    foco: ativo ? (ativo.id || ativo.className || ativo.tagName) : null, faixa: (document.querySelector('#faixa-global .lv-faixa') || {}).textContent || ''};
});
const esperarPagina = (pagina, chave) => pagina.waitForFunction(k => { const v = document.querySelector('[data-finance-page]:not([hidden])'); return v && v.dataset.financePage === k; }, chave, {timeout: 8000}).catch(() => null);
const naTela = (pagina, seletor) => pagina.evaluate(s => { const n = document.querySelector(s); if (!n) return false; const r = n.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < innerHeight; }, seletor);
async function pelaGaveta(pagina, chave) {
  await pagina.click('#menu-button');
  await pagina.waitForSelector('#navigation-drawer[open]');
  await pagina.click('#nav-' + chave);
  await esperarPagina(pagina, chave);
}
async function voltar(pagina, chave) {
  await pagina.goBack({waitUntil: 'commit'}).catch(() => null);
  await esperarPagina(pagina, chave);
}
function passo(nome) { registro.passos.push(nome); console.log('· ' + nome); return nome; }

// 1 · link direto já filtrado, a faixa de treino em três páginas e o Voltar três vezes, na ordem
{
  const p1 = passo('link direto #lancamentos?socia=m-ana, 3 páginas e Voltar 3 vezes');
  const {contexto, pagina} = await abrir(p1, '?demo=1#lancamentos?socia=m-ana');
  await pronto(pagina);
  await esperarPagina(pagina, 'lancamentos');
  await pagina.waitForFunction(() => document.querySelectorAll('#lancamentos-content .lv-gasto').length > 0, null, {timeout: 8000}).catch(() => null);
  let e = await estado(pagina);
  certo(p1, e.pagina === 'lancamentos' && e.titulo === 'Lançamentos', `abriu ${e.pagina} (“${e.titulo}”) em vez de Lançamentos`);
  certo(p1, e.hash === '#lancamentos?socia=m-ana', `o endereço virou ${e.hash}`);
  const filtro = await pagina.evaluate(() => { const s = document.querySelector('#lancamentos-content select'); return {valor: s && s.value, nome: s && s.selectedOptions[0].textContent, autorias: [...document.querySelectorAll('#lancamentos-content .lv-gasto .lv-autoria')].map(n => n.textContent)}; });
  certo(p1, filtro.valor === 'm-ana', `o filtro de sócia ficou em ${filtro.valor}`);
  certo(p1, filtro.autorias.length > 0 && filtro.autorias.every(t => t.includes(filtro.nome)), `há lançamento de outra sócia na lista filtrada: ${JSON.stringify(filtro.autorias)}`);
  const visitadas = [];
  for (const [chave, titulo, hash] of [['subscriptions', 'Assinaturas', '#assinaturas'], ['cash', 'Caixa', '#caixa'], ['society', 'Sociedade', '#sociedade']]) {
    await pelaGaveta(pagina, chave);
    e = await estado(pagina);
    visitadas.push(e);
    certo(p1, e.pagina === chave && e.titulo === titulo && e.hash === hash, `pela gaveta, ${titulo}: ficou ${JSON.stringify(e)}`);
    certo(p1, /treino/i.test(e.faixa) && await naTela(pagina, '#faixa-global .lv-faixa'), `a faixa de treino não aparece em ${titulo}`);
  }
  for (const [chave, hash] of [['cash', '#caixa'], ['subscriptions', '#assinaturas'], ['lancamentos', '#lancamentos?socia=m-ana']]) {
    await voltar(pagina, chave);
    e = await estado(pagina);
    certo(p1, e.pagina === chave && e.hash === hash, `Voltar devia ir a ${hash}: ficou ${e.pagina} ${e.hash}`);
  }
  certo(p1, await pagina.evaluate(() => document.querySelector('#lancamentos-content select').value) === 'm-ana', 'voltando a Lançamentos, o filtro de sócia se perdeu');
  await pagina.goForward({waitUntil: 'commit'}).catch(() => null);
  await esperarPagina(pagina, 'subscriptions');
  e = await estado(pagina);
  certo(p1, e.pagina === 'subscriptions' && e.hash === '#assinaturas', `Avançar devia ir a Assinaturas: ficou ${e.pagina} ${e.hash}`);

  // 2 · "Ir para o conteúdo" leva o foco ao título e não troca de página nem de endereço
  const p2 = passo('“Ir para o conteúdo” não troca de página');
  const antes = await estado(pagina);
  await pagina.focus('.skip-link');
  await pagina.keyboard.press('Enter');
  await pagina.waitForTimeout(250);
  e = await estado(pagina);
  certo(p2, e.pagina === antes.pagina && e.hash === antes.hash, `o pulo trocou a página ou o endereço: ${antes.pagina} ${antes.hash} → ${e.pagina} ${e.hash}`);
  certo(p2, e.foco === 'dashboard-title', `o foco foi para ${e.foco}, não para o título`);

  // 3 · "Ver a conta" do Custo do mês → Realizado → o gasto, destacado, em 3 cliques; Voltar volta ao Livro
  const p3 = passo('Ver a conta → termo → lançamento destacado em 3 cliques');
  await pelaGaveta(pagina, 'livro');
  let cliques = 0;
  await pagina.click('#livro-content .lv-kpi.is-total .lv-ver-conta'); cliques++;
  await pagina.waitForSelector('dialog.lv-conta[open]');
  await pagina.locator('dialog.lv-conta button.lv-termo-rotulo', {hasText: 'Realizado'}).click(); cliques++;
  await pagina.waitForSelector('dialog.lv-conta[open] a.lv-termo-rotulo[href^="#lancamentos"]');
  const gasto = await pagina.evaluate(() => { const a = document.querySelector('dialog.lv-conta a.lv-termo-rotulo[href^="#lancamentos"]'); return {texto: a.textContent, href: a.getAttribute('href')}; });
  await pagina.click('dialog.lv-conta a.lv-termo-rotulo[href^="#lancamentos"]'); cliques++;
  await esperarPagina(pagina, 'lancamentos');
  await pagina.waitForTimeout(300);
  e = await estado(pagina);
  const destaque = await pagina.evaluate(() => { const n = document.getElementById('lv-gasto-destacado'); return n ? {texto: n.textContent, foco: document.activeElement === n} : null; });
  certo(p3, cliques <= 3, `foram ${cliques} cliques`);
  certo(p3, e.pagina === 'lancamentos' && e.hash === gasto.href && /^#lancamentos\?mes=\d{4}-\d{2}&id=[A-Za-z0-9_.:-]+$/.test(e.hash), `o link do gasto levou a ${e.pagina} ${e.hash} (esperado ${gasto.href})`);
  certo(p3, destaque && destaque.texto.includes(gasto.texto) && destaque.texto.includes('Você veio do Ver a conta'), `o lançamento não ficou destacado com “Você veio do Ver a conta”: ${JSON.stringify(destaque)}`);
  certo(p3, destaque && destaque.foco && await naTela(pagina, '#lv-gasto-destacado'), 'o lançamento destacado não está na tela com o foco');
  certo(p3, !(await pagina.$('dialog.lv-conta[open]')), 'a conta continuou aberta por cima de Lançamentos');
  await voltar(pagina, 'livro');
  e = await estado(pagina);
  certo(p3, e.pagina === 'livro', `Voltar depois do Ver a conta devia ir ao Livro: ficou ${e.pagina}`);

  // 3b · o câmbio e o spread do mesmo "Ver a conta" abrem o parâmetro, também em 3 cliques
  const p3b = passo('Ver a conta → termo → parâmetro (dólar e spread) em 3 cliques');
  for (const chave of ['fx.USD_BRL', 'cartao.spread_pct']) {
    await pagina.click('#livro-content .lv-kpi.is-total .lv-ver-conta');
    await pagina.locator('dialog.lv-conta button.lv-termo-rotulo', {hasText: 'Realizado'}).click();
    const seletor = `dialog.lv-conta .lv-termo-conta a[href="#parametros/${chave}"]`;
    if (!certo(p3b, await pagina.waitForSelector(seletor, {timeout: 4000}).catch(() => null), `a conta não tem link para ${chave}`)) { await pagina.keyboard.press('Escape'); continue; }
    await pagina.click(seletor);
    await esperarPagina(pagina, 'parametros');
    await pagina.waitForTimeout(300);
    e = await estado(pagina);
    const linha = await pagina.evaluate(k => { const n = document.getElementById('lv-param-destacado'); return n ? {param: n.dataset.param, texto: n.textContent, aberto: !!(n.querySelector('details') || {}).open} : null; }, chave);
    certo(p3b, e.hash === '#parametros/' + chave && linha && linha.param === chave && linha.texto.includes('Você veio do Ver a conta') && linha.aberto, `${chave}: ${e.hash} ${JSON.stringify(linha && {param: linha.param, aberto: linha.aberto})}`);
    certo(p3b, await naTela(pagina, '#lv-param-destacado'), `${chave}: o parâmetro aberto não está na tela`);
    await voltar(pagina, 'livro');
  }

  // 4 · #lancar com o painel aberto abre a folha por cima da página e devolve o endereço da página
  const p4 = passo('#lancar abre a folha');
  await pelaGaveta(pagina, 'cash');
  await pagina.evaluate(() => { location.hash = '#lancar'; });
  const folha = await pagina.waitForSelector('dialog.lv-folha[open]', {timeout: 5000}).catch(() => null);
  e = await estado(pagina);
  certo(p4, folha, '#lancar não abriu a folha “+ Lançar”');
  certo(p4, e.pagina === 'cash' && e.hash === '#caixa', `a página de baixo devia continuar Caixa (#caixa): ${e.pagina} ${e.hash}`);
  await pagina.keyboard.press('Escape');
  await contexto.close();
}

// 4b · #lancar na entrada (o atalho "Lançar gasto" do PWA)
{
  const p = passo('atalho do PWA: ./#lancar abre a folha na entrada');
  const {contexto, pagina} = await abrir(p, '?demo=1#lancar');
  await pronto(pagina);
  const folha = await pagina.waitForSelector('dialog.lv-folha[open]', {timeout: 8000}).catch(() => null);
  const e = await estado(pagina);
  certo(p, folha, 'a folha não abriu');
  certo(p, e.hash === '#painel' && e.pagina === 'overview', `por baixo devia estar o Meu painel (#painel): ${e.pagina} ${e.hash}`);
  const foco = await pagina.evaluate(() => document.activeElement && document.activeElement.closest('dialog.lv-folha') !== null);
  certo(p, foco, 'o foco não está dentro da folha');
  await contexto.close();
  // no portal publicado o atalho sempre passa pela senha: a rota espera a entrada e só então abre a folha
  const comSenha = await abrir(p, '?login=1&demo=1#lancar');
  await comSenha.pagina.waitForSelector('#login-view:not([hidden])');
  certo(p, !(await comSenha.pagina.$('dialog.lv-folha[open]')), 'a folha abriu antes da senha');
  await comSenha.pagina.fill('#login-password', 'qualquer');
  await comSenha.pagina.click('#login-submit');
  await pronto(comSenha.pagina);
  const depois = await comSenha.pagina.waitForSelector('dialog.lv-folha[open]', {timeout: 8000}).catch(() => null);
  certo(p, depois && await comSenha.pagina.evaluate(() => location.hash) === '#painel', 'depois da senha, #lancar não abriu a folha sobre o Meu painel');
  await comSenha.contexto.close();
}

// 5 · link direto antes da senha: guarda a rota e a aplica depois de entrar
{
  const p = passo('?login=1#parametros/fx.USD_BRL abre o dólar depois da senha');
  const {contexto, pagina} = await abrir(p, '?login=1&demo=1#parametros/fx.USD_BRL');
  await pagina.waitForSelector('#login-view:not([hidden])');
  certo(p, await pagina.evaluate(() => location.hash) === '#parametros/fx.USD_BRL', 'a rota se perdeu na tela de entrada');
  await pagina.fill('#login-password', 'qualquer');
  await pagina.click('#login-submit');
  await pronto(pagina);
  await esperarPagina(pagina, 'parametros');
  await pagina.waitForSelector('#lv-param-destacado', {timeout: 8000}).catch(() => null);
  await pagina.waitForTimeout(300);
  const e = await estado(pagina);
  const linha = await pagina.evaluate(() => { const n = document.getElementById('lv-param-destacado'); return n ? {param: n.dataset.param, aberto: !!(n.querySelector('details') || {}).open, foco: document.activeElement === n} : null; });
  certo(p, e.pagina === 'parametros' && e.hash === '#parametros/fx.USD_BRL', `depois da senha: ${e.pagina} ${e.hash}`);
  certo(p, linha && linha.param === 'fx.USD_BRL' && linha.aberto && linha.foco, `o dólar não ficou aberto e com o foco: ${JSON.stringify(linha)}`);
  certo(p, await naTela(pagina, '#lv-param-destacado'), 'o dólar não está na tela');
  // sair limpa o endereço: a próxima entrada começa no Meu painel
  await pagina.click('#logout-button');
  await pagina.waitForSelector('#login-view:not([hidden])');
  certo(p, await pagina.evaluate(() => location.hash) === '', 'sair não limpou o endereço');
  await contexto.close();
}

// 6 · página registrada em tempo de execução: na gaveta (numeração refeita), na rota, na ajuda e depois de recarregar
{
  const p = passo('página registrada por um módulo de teste: gaveta, rota e recarga');
  let {contexto, pagina} = await abrir(p, '?demo=1', {modulo: true});
  await pronto(pagina);
  await pagina.addScriptTag({type: 'module', url: MODULO_URL});
  await pagina.waitForFunction(() => window.__paginaDeTeste === 'teste-nav', null, {timeout: 5000}).catch(() => null);
  const gaveta = await pagina.evaluate(() => [...document.querySelectorAll('#drawer-nav > *')].map(n => n.matches('.nav-grupo') ? '[' + n.textContent + ']' : n.querySelector('.nav-index').textContent + ' ' + n.children[1].textContent));
  const ultimo = gaveta.slice(-3).join(' · ');
  certo(p, ultimo === '[Ajuda] · 12 Histórico · 13 Página de teste', `a gaveta terminou em “${ultimo}”`);
  await pelaGaveta(pagina, 'teste-nav');
  let e = await estado(pagina);
  certo(p, e.pagina === 'teste-nav' && e.hash === '#teste-nav' && e.titulo === 'Página de teste', `pela gaveta: ${JSON.stringify(e)}`);
  certo(p, await pagina.evaluate(() => (document.getElementById('teste-nav-content') || {}).textContent) === 'Conteúdo desenhado pelo módulo de teste.', 'o módulo não desenhou na página');
  await pagina.click('#page-help');
  const ajuda = await pagina.evaluate(() => [document.getElementById('page-help-title').textContent, document.getElementById('page-help-what').textContent]);
  certo(p, ajuda[0] === 'Página de teste' && ajuda[1].startsWith('Uma página de mentira'), `“Como ler esta página” não veio do registro: ${ajuda}`);
  await pagina.keyboard.press('Escape');
  const repetida = await pagina.evaluate(() => { try { window.financeRegistrarPagina({chave: 'teste-nav', rota: 'outra', grupo: 'Ajuda', titulo: 'x'}); return 'aceitou'; } catch (erro) { return erro.message; } });
  certo(p, /já existe/.test(repetida), `registrar a mesma chave de novo devia recusar: ${repetida}`);
  const grupoRuim = await pagina.evaluate(() => { try { window.financeRegistrarPagina({chave: 'teste-x', grupo: 'Outros', titulo: 'x'}); return 'aceitou'; } catch (erro) { return erro.message; } });
  certo(p, /grupo desconhecido/.test(grupoRuim), `grupo fora dos 4 devia recusar: ${grupoRuim}`);
  await contexto.close();
  // recarregar em #teste-nav: a rota fica pendente até o módulo registrar a página, e então ela abre
  ({contexto, pagina} = await abrir(p, '?demo=1#teste-nav', {modulo: true}));
  await pronto(pagina);
  await pagina.addScriptTag({type: 'module', url: MODULO_URL});
  await esperarPagina(pagina, 'teste-nav');
  e = await estado(pagina);
  certo(p, e.pagina === 'teste-nav' && e.hash === '#teste-nav', `a rota pendente não abriu a página registrada depois: ${e.pagina} ${e.hash}`);
  await contexto.close();
}

// 7 · Laboratório: moldura com #tema= e o link de tela cheia continuam, agora em #laboratorio
{
  const p = passo('Laboratório em #laboratorio: moldura com #tema= e tela cheia');
  const {contexto, pagina} = await abrir(p, '?demo=1&galeria=1#laboratorio');
  await pronto(pagina);
  await esperarPagina(pagina, 'lab');
  const moldura = await pagina.waitForSelector('#lab-frame', {timeout: 8000}).catch(() => null);
  if (certo(p, moldura, 'o Laboratório não abriu a moldura')) {
    await pagina.waitForFunction(() => /#tema=claro$/.test(document.getElementById('lab-frame').src), null, {timeout: 8000}).catch(() => null);
    certo(p, /#tema=claro$/.test(await moldura.getAttribute('src')), 'a moldura não leva #tema=claro');
    await pagina.locator('#app-header [data-tema-toggle]').click();
    await pagina.waitForFunction(() => /#tema=escuro$/.test(document.getElementById('lab-frame').src), null, {timeout: 5000}).catch(() => null);
    certo(p, /#tema=escuro$/.test(await moldura.getAttribute('src')), 'trocar o tema não chegou à moldura');
    certo(p, await pagina.evaluate(() => location.hash) === '#laboratorio', 'o tema da moldura mexeu no endereço do portal');
    const quadro = await moldura.contentFrame();
    await quadro.waitForLoadState('load').catch(() => null);
    await quadro.evaluate(() => window.parent.postMessage({portal: 'abrir', file: 'apps/sinal.html'}, '*')).catch(() => null);
    const link = await pagina.waitForSelector('#lab-tela-cheia[href*="apps/sinal/"]', {timeout: 8000}).catch(() => null);
    certo(p, link, 'a maquete aberta na moldura não ganhou o link de tela cheia');
  }
  const gaveta = await pagina.evaluate(() => [...document.querySelectorAll('#drawer-nav button')].map(b => b.querySelector('.nav-index').textContent + ' ' + b.children[1].textContent).slice(-2).join(' · '));
  certo(p, gaveta === '12 Laboratório · 13 Histórico', `com a galeria, a gaveta devia terminar em “12 Laboratório · 13 Histórico”: ${gaveta}`);
  await contexto.close();
}

// 7b · com o servidor do diário (?diario=local): a gravação liga, a faixa de treino some e as rotas seguem iguais
{
  const p = passo('com servidor (?diario=local): sem faixa de treino, rota e Voltar iguais');
  const {contexto, pagina} = await abrir(p, '?diario=local#caixa');
  await pronto(pagina);
  await esperarPagina(pagina, 'cash');
  const ligou = await pagina.waitForFunction(() => /Gravação ligada/.test(document.getElementById('lv-modo').textContent), null, {timeout: 15000}).catch(() => null);
  certo(p, ligou, 'a gravação não ligou com o servidor do arnês');
  let e = await estado(pagina);
  certo(p, e.pagina === 'cash' && e.hash === '#caixa', `link direto com servidor: ${e.pagina} ${e.hash}`);
  certo(p, e.faixa === '' && await pagina.evaluate(() => document.getElementById('faixa-global').childElementCount === 0), `a faixa de treino continuou com a gravação ligada: “${e.faixa}”`);
  await pelaGaveta(pagina, 'parametros');
  await voltar(pagina, 'cash');
  e = await estado(pagina);
  certo(p, e.pagina === 'cash' && e.hash === '#caixa', `Voltar com servidor: ${e.pagina} ${e.hash}`);
  await contexto.close();
}

// 8 · a gaveta aberta nos 4 cortes: grupos na ordem, "+ Lançar" no topo, página atual marcada, sem rolagem lateral
{
  for (const tela of ['desktop', 'celular']) for (const tema of ['claro', 'escuro']) {
    const combo = `${tela}-${tema}`;
    const p = passo(`gaveta aberta · ${combo}`);
    const {contexto, pagina} = await abrir(p, '?demo=1#caixa', {tela, tema});
    await pronto(pagina);
    await esperarPagina(pagina, 'cash');
    await pagina.click('#menu-button');
    await pagina.waitForSelector('#navigation-drawer[open]');
    await pagina.evaluate(() => { const a = document.activeElement; if (a) a.blur(); });
    await pagina.waitForTimeout(400);
    const g = await pagina.evaluate(() => ({grupos: [...document.querySelectorAll('#drawer-nav .nav-grupo')].map(n => n.textContent), lancar: (() => { const b = document.getElementById('drawer-lancar'); const r = b.getBoundingClientRect(); return !b.hidden && r.height > 0 ? r.top : null; })(),
      primeiro: document.querySelector('#drawer-nav button').getBoundingClientRect().top, atual: (document.querySelector('#drawer-nav [aria-current="page"]') || {}).id, largura: document.documentElement.scrollWidth, janela: innerWidth}));
    certo(p, g.grupos.join(' · ') === 'Dinheiro · Planejar · Empresa · Ajuda', `grupos: ${g.grupos.join(' · ')}`);
    certo(p, g.lancar !== null && g.lancar < g.primeiro, '“+ Lançar” não está no topo da gaveta');
    certo(p, g.atual === 'nav-cash', `a página atual marcada na gaveta é ${g.atual}`);
    certo(p, g.largura <= g.janela, `rolagem horizontal: ${g.largura}px numa janela de ${g.janela}px`);
    const arquivo = join(SAIDA, `${combo}-gaveta-aberta.png`);
    await pagina.screenshot({path: arquivo});
    registro.fotos.push(arquivo);
    if (combo === 'celular-claro') {
      // "+ Lançar" da gaveta fecha a gaveta e abre a folha
      await pagina.click('#drawer-lancar');
      const folha = await pagina.waitForSelector('dialog.lv-folha[open]', {timeout: 5000}).catch(() => null);
      certo(p, folha && !(await pagina.$('#navigation-drawer[open]')), '“+ Lançar” da gaveta não abriu a folha (ou a gaveta ficou aberta)');
    }
    await contexto.close();
  }
}

// 9 · fotografar lê as páginas do registro: com o módulo de teste, a página nova sai nas fotos
if (FOTOGRAFAR) {
  const p = passo('fotografar com o módulo de teste: a página registrada sai nas fotos');
  const arquivoModulo = join(SAIDA, 'pagina-de-teste.js');
  await writeFile(arquivoModulo, MODULO);
  const saidaFotos = join(SAIDA, 'fotos-modulo');
  try {
    execFileSync(process.execPath, [join(aqui, '..', 'fotografar.mjs'), '--saida', saidaFotos, '--porta', String(PORTA + 1), '--so', 'desktop-claro', '--sem-extras', '--query', 'demo=1', '--site', SITE, '--modulo', arquivoModulo, '--paginas', 'teste-nav,historico'], {stdio: 'pipe'});
  } catch (erro) { falha(p, 'fotografar saiu com erro: ' + String(erro.stdout || erro.message).slice(-600)); }
  const fotos = JSON.parse(await readFile(join(saidaFotos, 'registro.json'), 'utf8').catch(() => '{"fotos": []}')).fotos.map(f => f.split('/').pop());
  certo(p, fotos.includes('desktop-claro-13-pagina-de-teste.png') && fotos.includes('desktop-claro-12-historico.png'), `as fotos foram: ${fotos.join(', ')}`);
}

// o hash só guarda página e filtros com formato conhecido: nenhum valor, nome ou texto
{
  const p = passo('nenhum dado sensível no endereço');
  const GRAMATICA = /^(#[a-z][a-z0-9-]*(\/[A-Za-z0-9._:-]+)*(\?[a-z]+=[A-Za-z0-9._:-]+(&[a-z]+=[A-Za-z0-9._:-]+)*)?)?$/;
  const hashes = [...new Set(registro.enderecos.map(e => new URL(e.url).hash))];
  for (const h of hashes) certo(p, GRAMATICA.test(h), `endereço fora do formato: ${h}`);
  certo(p, hashes.length >= 10, `poucos endereços vistos (${hashes.length}): o registro de navegação falhou?`);
  registro.hashes = hashes;
}

await navegador.close();
servidor.close();
for (const e of registro.erros) falha('erros da página', `${e.rotulo} · ${e.tipo} · ${e.texto}`);
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`\n${registro.passos.length} passos · ${registro.fotos.length} fotos da gaveta em ${SAIDA} · ${registro.falhas.length} falha(s)`);
if (registro.falhas.length) process.exitCode = 1;
