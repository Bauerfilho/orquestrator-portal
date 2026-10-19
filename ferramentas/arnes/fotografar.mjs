// Fotografa o portal no arnês: cada página do menu, tema claro e escuro, 1280×860 e 390×844, página inteira,
// mais as telas de apoio (entrada, menu aberto, "Como ler esta página", Minha equipe, ficha do ativo).
// Uso: node fotografar.mjs [--saida DIR] [--porta 8765] [--so desktop-claro,celular-escuro] [--paginas overview,cash]
//                          [--sem-extras] [--query "escrita=1&membro=m-ana"] [--site DIR] [--vitrine]
// Sai com código 1 se a página registrar erro de script ou violação de CSP (o log fica em <saida>/registro.json).
// --vitrine fotografa só a vitrine dos gráficos (ferramentas/arnes/vitrine-graficos.html) nos 4 cortes e confere: as
// recusas do contrato, nenhuma rolagem horizontal, nenhum rótulo sobreposto, um tab stop por gráfico com a dica andando
// pelas setas, e a hachura mantida em forced-colors.
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
const VITRINE = process.argv.includes('--vitrine');

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

async function abrir(tela, tema, extra = '', opcoes = {}) {
  const contexto = await navegador.newContext({viewport: TELAS.find(([n]) => n === tela)[1], deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: tema === 'escuro' ? 'dark' : 'light', isMobile: tela === 'celular', hasTouch: tela === 'celular', ...opcoes});
  await contexto.addInitScript(t => { try { localStorage.setItem('orquestrator-financas.tema', t); } catch {} }, tema);
  const pagina = await contexto.newPage();
  const rotulo = `${tela}-${tema}${extra ? '-' + extra : ''}`;
  pagina.on('pageerror', e => registro.erros.push({rotulo, tipo: 'pageerror', texto: String(e)}));
  pagina.on('console', m => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) registro.erros.push({rotulo, tipo: 'console.' + m.type(), texto: m.text()}); });
  // um módulo ou folha de estilo que não carrega (404) também é erro: os esqueletos da rotina precisam existir
  pagina.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === `http://127.0.0.1:${PORTA}`) registro.erros.push({rotulo, tipo: 'http.' + r.status(), texto: r.url()}); });
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

if (VITRINE) await fotografarVitrine();
else for (const [tela] of TELAS) for (const tema of TEMAS) {
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
    await folhaSobrevive(pagina, combo);
    // Controles que o portal oferece mas recusa (somente leitura): editar cobrança e marcar passo.
    // (os controles que antes recusavam depois de preenchidos agora vêm desabilitados com o motivo: nada a fotografar)
    if (false) {
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

// A folha comum (.sheet) sobrevive ao ciclo de 2 s, a uma gravação no diário e ao renderTudo: nada se redesenha com
// ela aberta (plano §3.7); ao fechar, a página se redesenha e mostra o que entrou. Fica por último: grava um gasto.
async function folhaSobrevive(pagina, combo) {
  const rotulo = `${combo}-folha`;
  const falha = texto => registro.erros.push({rotulo, tipo: 'folha', texto});
  await pagina.evaluate(() => window.financeNavigate('livro', false)); await assentar(pagina);
  await pagina.evaluate(async () => {
    const L = await import('/livro.js');   // a mesma instância do módulo que a página carregou
    document.querySelector('#livro-content .lv-manchete').dataset.marcaFolha = 'antes';
    const valor = L.campoDinheiro('BRL', {rotulo: 'Quanto'});
    window.__folha = L.abrirFolha({eyebrow: 'Arnês · folha comum', titulo: 'Folha de teste', corpo: [L.el('p', null, 'Digite um valor: ele precisa continuar aqui depois do ciclo de 2 s e de uma gravação no diário.'), L.campoComRotulo('Quanto', valor)],
      acoes: [{rotulo: 'Salvar', primaria: true, fn: () => false}]});
    window.__folhaValor = valor;
  });
  await pagina.fill('.sheet .lv-dinheiro-valor', '1.234,56');
  await pagina.waitForTimeout(2600);                                   // o ciclo de 2 s do app.js passa por cima
  const r = await pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const g = await L.gravar({acao: 'add_expense', alvo: 'arnes-folha', dados: {data: '2026-10-18', competencia: '2026-10', descricao: 'Gasto gravado com a folha aberta', categoria: 'outros', valorMinor: 1000, moeda: 'BRL', forma: 'cartao_pj', pagoPor: L.dados().c.membro.id}}, 'Gravado com a folha aberta.');
    L.renderTudo(true); window.financeLivroRender(); document.dispatchEvent(new CustomEvent('financeiro:diario'));
    await new Promise(ok => setTimeout(ok, 300));
    return {gravou: g.ok, aberta: window.__folha.dialogo.open, mesma: document.querySelector('dialog.sheet[open]') === window.__folha.dialogo, centavos: window.__folhaValor.ler(), marca: (document.querySelector('#livro-content .lv-manchete') || {dataset: {}}).dataset.marcaFolha || null, aberta2: L.folhaAberta()};
  });
  if (!r.gravou) falha('a gravação de teste não entrou no diário');
  if (!r.aberta || !r.mesma || !r.aberta2) falha('a folha fechou ou foi trocada com o ciclo/renderTudo');
  if (r.centavos !== 123456) falha(`o valor digitado se perdeu (lido: ${r.centavos})`);
  if (r.marca !== 'antes') falha('a página se redesenhou com a folha aberta');
  await assentar(pagina, true);
  await foto(pagina, `${combo}-extra-folha`, {fullPage: false});
  await pagina.locator('.sheet button', {hasText: 'Cancelar'}).click();
  await pagina.waitForTimeout(200);
  const depois = await pagina.evaluate(() => ({fechada: !document.querySelector('dialog.sheet'), marca: (document.querySelector('#livro-content .lv-manchete') || {dataset: {}}).dataset.marcaFolha || null, novo: document.querySelector('#livro-content').textContent.includes('Gasto gravado com a folha aberta')}));
  if (!depois.fechada) falha('a folha não fechou no Cancelar');
  if (depois.marca === 'antes' || !depois.novo) falha('ao fechar a folha, a página não se redesenhou com o gasto novo');
  await pagina.keyboard.press('Escape').catch(() => {});
}

// ── vitrine dos gráficos ──────────────────────────────────────────────────────────────────────────────────────────
// roda dentro da página: rótulos (texto de SVG e de HTML) que se cruzam dentro da mesma figura
function rotulosSobrepostos() {
  const problemas = [];
  const visivel = n => { const e = n.nodeType === 1 ? n : n.parentElement; return e && !e.closest('[hidden], .gf-dica, .gf-anuncio, .gf-tabela-caixa, .sr-only') && getComputedStyle(e).visibility !== 'hidden'; };
  for (const fig of document.querySelectorAll('figure')) {
    const caixas = [];
    for (const t of fig.querySelectorAll('svg text')) if (visivel(t)) { const r = t.getBoundingClientRect(); if (r.width && r.height) caixas.push({texto: t.textContent, r}); }
    const andar = document.createTreeWalker(fig, NodeFilter.SHOW_TEXT);
    for (let n = andar.nextNode(); n; n = andar.nextNode()) {
      if (!n.textContent.trim() || n.parentElement.closest('svg') || !visivel(n)) continue;
      const faixa = document.createRange(); faixa.selectNodeContents(n);
      for (const r of faixa.getClientRects()) if (r.width && r.height) caixas.push({texto: n.textContent.trim().slice(0, 40), r});
    }
    for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
      const a = caixas[i].r, b = caixas[j].r;
      const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left), dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (dx > 2 && dy > 2) problemas.push(`“${caixas[i].texto}” × “${caixas[j].texto}”`);
    }
  }
  return problemas;
}
async function tecladoDaVitrine(pagina, falha) {
  // a ordem do Tab, do topo: cada gráfico novo é UMA parada e a próxima é o "Ver tabela" da mesma figura
  await pagina.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  const ordem = [];
  for (let i = 0; i < 60; i++) {
    await pagina.keyboard.press('Tab');
    const p = await pagina.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const fig = a.closest('figure'); const k = fig ? [...document.querySelectorAll('figure')].indexOf(fig) : -1; return {tipo: a.matches('.gf-area') ? 'area' : a.matches('.gf-ver-tabela') ? 'tabela' : 'outro', fig: k}; });
    if (!p) break;
    ordem.push(p);
  }
  const areas = ordem.map((p, k) => [p, k]).filter(([p]) => p.tipo === 'area');
  const esperadas = await pagina.evaluate(() => document.querySelectorAll('.gf-novo .gf-area').length);
  if (areas.length !== esperadas) falha(`o Tab parou em ${areas.length} gráficos; eram ${esperadas}`);
  if (new Set(areas.map(([p]) => p.fig)).size !== areas.length) falha('algum gráfico recebeu mais de uma parada de Tab');
  for (const [p, k] of areas) if (!ordem[k + 1] || ordem[k + 1].tipo !== 'tabela' || ordem[k + 1].fig !== p.fig) falha(`depois do gráfico da figura ${p.fig + 1} o Tab devia ir ao “Ver tabela” dela`);
  // as setas andam a dica: fluxo na horizontal, cascata na vertical, minigráfico na horizontal
  const ler = () => pagina.evaluate(() => { const a = document.activeElement, d = a && a.querySelector('.gf-dica'); return {texto: d && !d.hidden ? d.textContent : '', esq: d ? d.style.left : '', topo: d ? d.style.top : '', anuncio: a ? a.closest('figure').querySelector('.gf-anuncio[aria-live]').textContent : ''}; });
  for (const [seletor, nome, eixo] of [['.gf-fluxo .gf-area', 'fluxo', 'esq'], ['.gf-cascata .gf-area', 'cascata', 'topo'], ['.gf-mini .gf-area', 'minigráfico', 'esq']]) {
    await pagina.focus(seletor);
    const foco = await ler();
    if (!foco.texto) { falha(`${nome}: a dica não apareceu com o foco`); continue; }
    await pagina.keyboard.press('Home'); const a = await ler();
    await pagina.keyboard.press(eixo === 'topo' ? 'ArrowDown' : 'ArrowRight'); const b = await ler();
    await pagina.keyboard.press('End'); const c = await ler();
    await pagina.keyboard.press('ArrowLeft'); const d = await ler();
    if (!a.texto || a.texto === b.texto || a[eixo] === b[eixo]) falha(`${nome}: a seta não andou a dica (${a.texto} → ${b.texto})`);
    if (!c.texto || c.texto === d.texto) falha(`${nome}: End e ← não andaram a dica`);
    if (!b.anuncio || b.anuncio === a.anuncio) falha(`${nome}: o anúncio para leitor de tela não acompanhou a seta`);
  }
  // para a foto: o fluxo com a dica num mês do meio
  await pagina.focus('.gf-fluxo .gf-area');
  await pagina.keyboard.press('Home');
  for (let i = 0; i < 9; i++) await pagina.keyboard.press('ArrowRight');
  await pagina.evaluate(() => document.activeElement.scrollIntoView({block: 'center'}));
}
async function fotografarVitrine() {
  const endereco = `http://127.0.0.1:${PORTA}/ferramentas/arnes/vitrine-graficos.html`;
  const pronta = async pagina => {
    await pagina.goto(endereco, {waitUntil: 'load'});
    await pagina.waitForFunction(() => window.vitrine && window.vitrine.pronta && document.querySelectorAll('.gf-fluxo .gf-area > svg, .gf-mini .gf-area > svg').length === 4, null, {timeout: 15000});
    await assentar(pagina);
  };
  for (const [tela] of TELAS) for (const tema of TEMAS) {
    const combo = `${tela}-${tema}`;
    if (SO && !SO.includes(combo)) continue;
    const rotulo = `vitrine-${combo}`;
    const falha = texto => registro.erros.push({rotulo, tipo: 'vitrine', texto});
    const {contexto, pagina} = await abrir(tela, tema, 'vitrine');
    await pronta(pagina);
    for (const c of await pagina.evaluate(() => window.vitrine.verificacoes)) if (!c.ok) falha('conferência falhou: ' + c.nome);
    const larguras = await pagina.evaluate(() => ({doc: document.documentElement.scrollWidth, janela: window.innerWidth}));
    if (larguras.doc > larguras.janela) falha(`rolagem horizontal: ${larguras.doc}px numa janela de ${larguras.janela}px`);
    for (const s of await pagina.evaluate(rotulosSobrepostos)) falha('rótulos sobrepostos: ' + s);
    const paradas = await pagina.evaluate(() => [...document.querySelectorAll('.gf-novo .gf-area')].map(a => ({tab: a.tabIndex, dentro: a.querySelectorAll('a, button, input, select, textarea, [tabindex]').length})));
    paradas.forEach((p, k) => { if (p.tab !== 0 || p.dentro) falha(`gráfico ${k + 1}: a área devia ser a única parada (tabindex ${p.tab}, ${p.dentro} dentro)`); });
    registro.alturas[rotulo] = await pagina.evaluate(() => document.documentElement.scrollHeight);
    await foto(pagina, rotulo);
    await tecladoDaVitrine(pagina, falha);
    await assentar(pagina, true);
    await foto(pagina, `${rotulo}-dica`, {fullPage: false});
    await contexto.close();
  }
  // forced-colors: as cores viram as do sistema e a hachura continua desenhada
  for (const tema of TEMAS) {
    if (SO && !SO.some(c => c.endsWith(tema))) continue;
    const rotulo = `vitrine-forced-colors-${tema}`;
    const {contexto, pagina} = await abrir('desktop', tema, 'forced-colors', {forcedColors: 'active'});
    await pronta(pagina);
    const h = await pagina.evaluate(() => {
      const p = document.querySelector('.gf-fluxo path.gf-m.is-hachura');
      if (!p) return {ok: false, motivo: 'nenhuma barra hachurada no fluxo'};
      const fill = getComputedStyle(p).fill;
      const id = (fill.match(/url\("?#([^")]+)"?\)/) || [])[1];
      const traco = id ? document.querySelector(`[id="${id}"] line`) : null;
      const stroke = traco ? getComputedStyle(traco).stroke : 'none';
      const ativo = matchMedia('(forced-colors: active)').matches;
      return {ok: ativo && !!traco && stroke !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(stroke), ativo, fill, stroke};
    });
    if (!h.ok) registro.erros.push({rotulo, tipo: 'vitrine', texto: 'a hachura sumiu em forced-colors: ' + JSON.stringify(h)});
    await foto(pagina, rotulo);
    await contexto.close();
  }
}

await navegador.close();
servidor.close();
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`${registro.fotos.length} fotos em ${SAIDA}`);
if (registro.erros.length) { console.log('ERROS:', JSON.stringify(registro.erros, null, 2)); process.exitCode = 1; }
