// Fotografa o portal no arnês: cada página do menu, tema claro e escuro, 1280×860 e 390×844, página inteira,
// mais as telas de apoio (entrada, menu aberto, "Como ler esta página", Minha equipe, ficha do ativo).
// Uso: node fotografar.mjs [--saida DIR] [--porta 8765] [--so desktop-claro,celular-escuro] [--paginas overview,cash]
//                          [--sem-extras] [--query "escrita=1&membro=m-ana"] [--site DIR]
// Sai com código 1 se a página registrar erro de script ou violação de CSP (o log fica em <saida>/registro.json).
import {pathToFileURL, fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {servir} from './servir.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'fotos-portal')));
const PORTA = Number(arg('porta', 8765));
const SITE = resolve(arg('site', join(aqui, '..', '..')));
const SO = arg('so', '') ? arg('so', '').split(',') : null;
const SO_PAGINAS = arg('paginas', '') ? arg('paginas', '').split(',') : null;
const EXTRAS = !process.argv.includes('--sem-extras');
const QUERY = arg('query', '');

const raizGlobal = execSync('npm root -g').toString().trim();
const {chromium} = await import(pathToFileURL(join(raizGlobal, 'playwright', 'index.mjs')).href);

const PAGINAS = [['overview', '01-meu-painel'], ['livro', '02-livro-do-mes'], ['lancamentos', '03-lancamentos'], ['subscriptions', '04-assinaturas'], ['cash', '05-caixa'], ['parametros', '06-parametros'], ['medpainel', '07-med-painel'], ['projection', '08-projecao'], ['sell', '09-vender-primeiro'], ['society', '10-sociedade'], ['portfolio', '11-portfolio'], ['historico', '13-historico'], ['lab', '12-laboratorio']];
const TELAS = [['desktop', {width: 1280, height: 860}], ['celular', {width: 390, height: 844}]];
const TEMAS = ['claro', 'escuro'];

await mkdir(SAIDA, {recursive: true});
const servidor = await servir(PORTA, SITE);
const navegador = await chromium.launch();
const registro = {quando: new Date().toISOString(), site: SITE, query: QUERY, fotos: [], erros: [], alturas: {}};
const url = (extra = '') => `http://127.0.0.1:${PORTA}/?${[QUERY, extra].filter(Boolean).join('&')}`;

async function abrir(tela, tema, extra = '') {
  const contexto = await navegador.newContext({viewport: TELAS.find(([n]) => n === tela)[1], deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: tema === 'escuro' ? 'dark' : 'light', isMobile: tela === 'celular', hasTouch: tela === 'celular'});
  await contexto.addInitScript(t => { try { localStorage.setItem('orquestrator-financas.tema', t); } catch {} }, tema);
  const pagina = await contexto.newPage();
  const rotulo = `${tela}-${tema}${extra ? '-' + extra : ''}`;
  pagina.on('pageerror', e => registro.erros.push({rotulo, tipo: 'pageerror', texto: String(e)}));
  pagina.on('console', m => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) registro.erros.push({rotulo, tipo: 'console.' + m.type(), texto: m.text()}); });
  return {contexto, pagina};
}
async function assentar(pagina, manterFoco = false) {
  // O título recebe foco programático ao entrar (moldura dourada de :focus-visible); fora das fotos de diálogo, solta o foco.
  if (!manterFoco) await pagina.evaluate(() => { const a = document.activeElement; if (a && a.id === 'dashboard-title') a.blur(); });
  await pagina.evaluate(() => document.fonts && document.fonts.ready);
  await pagina.waitForTimeout(450);
}
async function foto(pagina, nome, opcoes = {fullPage: true}) {
  const arquivo = join(SAIDA, nome + '.png');
  await pagina.screenshot({path: arquivo, ...opcoes});
  registro.fotos.push(arquivo);
  return arquivo;
}

for (const [tela] of TELAS) for (const tema of TEMAS) {
  const combo = `${tela}-${tema}`;
  if (SO && !SO.includes(combo)) continue;
  const {contexto, pagina} = await abrir(tela, tema);
  await pagina.goto(url(), {waitUntil: 'load'});
  await pagina.waitForSelector('#dashboard:not([hidden])', {timeout: 15000});
  await pagina.waitForFunction(() => document.querySelector('#user-content') && document.querySelector('#user-content').childElementCount > 0, null, {timeout: 15000});
  for (const [chave, nome] of PAGINAS) {
    if (SO_PAGINAS && !SO_PAGINAS.includes(chave)) continue;
    const foi = await pagina.evaluate(k => window.financeNavigate(k, false), chave);
    if (!foi) continue;   // ex.: Laboratório escondido quando galeria=false
    await pagina.evaluate(() => window.scrollTo(0, 0));
    await assentar(pagina);
    registro.alturas[`${combo}-${nome}`] = await pagina.evaluate(() => document.documentElement.scrollHeight);
    await foto(pagina, `${combo}-${nome}`);
  }
  if (EXTRAS) {
    await pagina.evaluate(() => window.financeNavigate('overview', false)); await assentar(pagina);
    await pagina.click('#menu-button'); await assentar(pagina);
    await foto(pagina, `${combo}-extra-menu-aberto`, {fullPage: false});
    await pagina.keyboard.press('Escape'); await assentar(pagina);
    await pagina.click('#page-help'); await assentar(pagina);
    await foto(pagina, `${combo}-extra-como-ler`, {fullPage: false});
    await pagina.keyboard.press('Escape'); await assentar(pagina);
    await pagina.evaluate(() => window.financeOpenTeam()); await assentar(pagina);
    await foto(pagina, `${combo}-extra-minha-equipe`, {fullPage: false});
    await pagina.evaluate(() => document.getElementById('cloud-team').close()); await assentar(pagina);
    await pagina.evaluate(() => window.financeNavigate('portfolio', false)); await assentar(pagina);
    await pagina.click('[data-open-asset="med-painel"]'); await assentar(pagina);
    await foto(pagina, `${combo}-extra-ficha-ativo`, {fullPage: false});
    await pagina.keyboard.press('Escape'); await assentar(pagina);
    // A dica do gráfico de assinantes (passar o mouse / foco no mês 12)
    await pagina.evaluate(() => window.financeNavigate('medpainel', false)); await assentar(pagina);
    const grafico = await pagina.$('#medpainel-content svg.mp-svg');
    if (grafico) { await grafico.scrollIntoViewIfNeeded(); await grafico.focus(); await assentar(pagina, true); await foto(pagina, `${combo}-extra-grafico-dica`, {fullPage: false}); }
    // Controles que o portal oferece mas recusa (somente leitura): editar cobrança e marcar passo.
    if (!/escrita=1/.test(QUERY)) {
      await pagina.evaluate(() => window.financeNavigate('subscriptions', false)); await assentar(pagina);
      await pagina.locator('.plan-card button', {hasText: 'Editar cobrança'}).first().click(); await assentar(pagina);
      await pagina.fill('#plan-value-0', '210'); await pagina.locator('[data-plan-form="0"] button[type=submit]').click(); await assentar(pagina);
      await pagina.locator('[data-plan-form="0"]').scrollIntoViewIfNeeded(); await assentar(pagina, true);
      await foto(pagina, `${combo}-extra-editar-recusado`, {fullPage: false});
      await pagina.locator('[data-plan-form="0"] button', {hasText: 'Cancelar'}).click();
      await pagina.evaluate(() => window.financeNavigate('sell', false)); await assentar(pagina);
      await pagina.locator('#sell-content input[type=checkbox]:not(:checked)').first().click(); await assentar(pagina);
      await pagina.evaluate(() => window.scrollTo(0, 0)); await assentar(pagina, true);
      await foto(pagina, `${combo}-extra-passo-recusado`, {fullPage: false});
    }
  }
  await contexto.close();
  if (EXTRAS) {
    const entrada = await abrir(tela, tema, 'entrada');
    await entrada.pagina.goto(url('login=1'), {waitUntil: 'load'});
    await entrada.pagina.waitForSelector('#login-view:not([hidden])');
    await assentar(entrada.pagina);
    await foto(entrada.pagina, `${combo}-00-entrada`);
    await entrada.contexto.close();
  }
}

await navegador.close();
servidor.close();
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`${registro.fotos.length} fotos em ${SAIDA}`);
if (registro.erros.length) { console.log('ERROS:', JSON.stringify(registro.erros, null, 2)); process.exitCode = 1; }
