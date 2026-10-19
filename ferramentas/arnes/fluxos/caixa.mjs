// Fluxo da fatia F2-7 (Caixa: receitas, saldos, fluxo de 12 meses, cascata, fôlego e a manchete do Meu painel). Partes:
//  1. ?demo=1 nos 4 cortes (claro/escuro, 1280×860/390×844): Caixa e Meu painel fotografados; cada número da tela
//     bate com o contas.js calculado na própria página (mesmo estado, mesmo diário) e com uma conta à mão sobre os dados
//     do demo (40 × R$ 59,90 = R$ 2.396,00; taxa 9,9% + 40 × R$ 2,49 = R$ 336,80; Simples 6% = R$ 143,76; líquido
//     R$ 1.915,44; fôlego R$ 21.765,00 ÷ R$ 2.366,00 ≈ 9,2 meses); o mesmo valor aparece igual no Caixa, no Meu painel
//     e no "Ver a conta"; o registro importado de 18/10 fica recolhido e acessível; nada rola de lado a 390px.
//  2. ?diario=local (servidor do diário de verdade, em memória), trocando de sócia por ?membro=: o Caixa vazio diz o que
//     falta; setembro fechado; o Bauer informa um saldo (o fôlego muda) e lança uma receita pelo teclado, com a prévia
//     do plano (a cascata e o resultado mudam); corrige a receita; a Ana corrige a dele (pede motivo); o Bauer anula;
//     receita em mês fechado é recusada com o motivo; saldo em dólar de 42 dias atrás pede o de hoje; o Histórico mostra
//     tudo com autora; o Meu painel da Ana mostra as mudanças do Bauer.
//  3. O roteiro do teste de 10 segundos (§8.8) sobre a foto do Meu painel, com as respostas lidas da tela, em
//     <saida>/teste-10-segundos.txt, para aplicar com as sócias.
// Sai com código 1 em qualquer falha, erro de script ou violação de CSP (o registro fica em <saida>/registro.json).
// Uso: node ferramentas/arnes/fluxos/caixa.mjs [--saida DIR] [--porta 8797] [--site DIR] [--sem-fotos]
import {pathToFileURL, fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'fluxo-caixa')));
const PORTA = Number(arg('porta', 8797));
const SITE = resolve(arg('site', join(aqui, '..', '..', '..')));
const FOTOS = !process.argv.includes('--sem-fotos');
const {servir} = await import(pathToFileURL(join(SITE, 'ferramentas', 'arnes', 'servir.mjs')).href);
const raizGlobal = execSync('npm root -g').toString().trim();
const {chromium} = await import(pathToFileURL(join(raizGlobal, 'playwright', 'index.mjs')).href);

await mkdir(SAIDA, {recursive: true});
const servidor = await servir(PORTA, SITE);
const navegador = await chromium.launch();
const base = `http://127.0.0.1:${PORTA}/`;
const registro = {quando: new Date().toISOString(), site: SITE, passos: [], falhas: [], erros: [], fotos: [], conferencias: []};
const falha = (passo, texto) => { registro.falhas.push({passo, texto}); console.log(`  ✗ ${passo}: ${texto}`); };
const certo = (passo, condicao, texto) => { if (!condicao) falha(passo, texto); return Boolean(condicao); };
function passo(nome) { registro.passos.push(nome); console.log('· ' + nome); return nome; }
const limpo = t => String(t || '').replace(/\s+/g, ' ').trim();   // \s inclui o espaço fino do Intl (U+00A0)

// ── a conta à mão (BigInt, um arredondamento só, meio para longe do zero), independente do contas.js ─────────────────
const arred = (n, d) => { const s = n < 0n ? -1n : 1n, a = n * s; return Number(s * ((a + d / 2n) / d)); };
const pctDe = (minor, centesimos) => arred(BigInt(minor) * BigInt(centesimos), 10000n);   // 990 = 9,90%
// Hotmart pela tabela dos Parâmetros (9,9% + R$ 2,49 por venda) e Simples de 6%
const contaHotmart = (bruto, vendas) => { const taxa = pctDe(bruto, 990) + vendas * 249, imposto = pctDe(bruto, 600); return {bruto, taxa, imposto, liquido: bruto - taxa - imposto}; };
const real = minor => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(minor / 100).replace(/\s/g, ' ').replace('-', '−');
const decimosDe = (caixa, queima) => arred(BigInt(caixa) * 10n, BigInt(queima));
const textoMeses = d => `≈ ${Math.trunc(d / 10)},${d % 10} ${d === 10 ? 'mês' : 'meses'}`;
const PREVIA = (c, vendas) => `taxa 9,9% + ${vendas} × R$ 2,49 = ${real(c.taxa)} · Simples 6% = ${real(c.imposto)} · líquido ${real(c.liquido)}`;
const DEMO = {receita: contaHotmart(40 * 5990, 40), caixa: 2176500, queima: 236600};

const TELAS = {desktop: {width: 1280, height: 860}, celular: {width: 390, height: 844}};
async function abrir(rotulo, endereco, {tela = 'desktop', tema = 'claro'} = {}) {
  const contexto = await navegador.newContext({viewport: TELAS[tela], deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: tema === 'escuro' ? 'dark' : 'light', isMobile: tela === 'celular', hasTouch: tela === 'celular'});
  await contexto.addInitScript(t => { try { localStorage.setItem('orquestrator-financas.tema', t); } catch {} }, tema);
  const pagina = await contexto.newPage();
  pagina.on('pageerror', e => registro.erros.push({rotulo, tipo: 'pageerror', texto: String(e)}));
  pagina.on('console', m => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) registro.erros.push({rotulo, tipo: 'console.' + m.type(), texto: m.text()}); });
  pagina.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === base.slice(0, -1)) registro.erros.push({rotulo, tipo: 'http.' + r.status(), texto: r.url()}); });
  await pagina.goto(base + endereco, {waitUntil: 'load'});
  await pagina.waitForSelector('#dashboard:not([hidden])', {timeout: 15000});
  await pagina.waitForSelector('#caixa-calculado .cx-raiz', {state: 'attached', timeout: 15000});
  await pagina.waitForSelector('#livro-resumo .cx-painel', {state: 'attached', timeout: 15000});
  return {contexto, pagina};
}
const irPara = async (pagina, chave) => { await pagina.evaluate(k => window.financeNavigate(k, false), chave); await pagina.evaluate(() => window.scrollTo(0, 0)); await pagina.waitForTimeout(300); };
async function foto(pagina, nome, inteira = true) {
  if (!FOTOS) return null;
  await pagina.evaluate(() => { const a = document.activeElement; if (a && a.id === 'dashboard-title') a.blur(); window.scrollTo(0, 0); });
  await pagina.waitForTimeout(350);
  const arquivo = join(SAIDA, nome + '.png');
  await pagina.screenshot({path: arquivo, fullPage: inteira});
  registro.fotos.push(arquivo);
  return arquivo;
}
async function gravacaoLigada(pagina) {
  return pagina.waitForFunction(() => /Gravação ligada/.test((document.getElementById('lv-modo') || {}).textContent || ''), null, {timeout: 20000}).then(() => true).catch(() => false);
}
const esperarToast = (pagina, re) => pagina.waitForFunction(r => { const t = document.getElementById('lv-toast'); return t && t.getAttribute('role') === 'status' && t.classList.contains('is-visivel') && new RegExp(r).test(t.textContent); }, re.source, {timeout: 10000}).then(() => true).catch(() => false);
const semRolagem = async (pagina, p, onde) => { const l = await pagina.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); certo(p, l[0] <= l[1], `rolagem horizontal em ${onde}: ${l[0]}px numa janela de ${l[1]}px`); };
const numeroDaTela = (pagina, chave) => pagina.evaluate(k => { const n = document.querySelector(`[data-numero="${k}"]`); return n ? {minor: n.dataset.minor === undefined ? null : Number(n.dataset.minor), texto: n.querySelector('.lv-kpi-valor').textContent.replace(/\s+/g, ' ').trim(), estado: n.dataset.estado || null, decimos: n.dataset.decimos === undefined ? null : Number(n.dataset.decimos)} : null; }, chave);
const focoAtual = pagina => pagina.evaluate(() => { const a = document.activeElement; return a ? {tag: a.tagName, chave: a.dataset.chave || null, id: a.id || null, texto: (a.textContent || '').trim().slice(0, 60)} : null; });
const ultimoEvento = pagina => pagina.evaluate(async () => { const L = await import('/livro.js'); const d = L.dados().d; const ev = d.eventos[d.eventos.length - 1]; return {modo: d.modo, membro: ev.membro, treino: !!ev.treino, seq: ev.seq, cabeca: d.cabeca, c: ev.conteudo}; });

// ── a tela contra a conta: contas.js calculado na página, com o mesmo estado e o mesmo diário (dados() do livro.js) ────
async function conferirCaixa(pagina, rotulo, {registroAberto = false} = {}) {
  const r = await pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const C = await import('/contas.js');
    const D = L.dados(), hoje = L.hojeDe(D.c), mes = hoje.slice(0, 7);
    const mesBloco = (document.querySelector('#caixa-calculado .cx-mes') || {dataset: {}}).dataset.mes || mes;
    const f = C.folego(D.c.estado, D.aplicado, hoje);
    const res = C.resultadoDoMes(D.c.estado, D.aplicado, D.lista, mes, hoje);
    const rec = C.receitasDoMes(D.aplicado, D.lista, mesBloco);
    const cx = C.cascataDoMes(D.c.estado, D.aplicado, D.lista, mesBloco, hoje, D.c.membro.id);
    const q = s => document.querySelector(s);
    const num = k => { const n = q(`#caixa-calculado [data-numero="${k}"]`); return n ? {minor: n.dataset.minor === undefined ? null : Number(n.dataset.minor), texto: n.querySelector('.lv-kpi-valor').textContent.replace(/\s+/g, ' ').trim(), estado: n.dataset.estado || null, decimos: n.dataset.decimos === undefined ? null : Number(n.dataset.decimos)} : null; };
    const linhas = rec.linhas.map(l => {
      const art = q(`#caixa-calculado .cx-receita[data-receita="${l.id}"]`);
      const tela = art ? Object.fromEntries([...art.querySelectorAll('[data-campo]')].map(d => [d.dataset.campo, Number(d.dataset.minor)])) : null;
      return {id: l.id, tela, conta: l.brl === null ? {} : {bruto: l.brl, taxas: l.taxas, imposto: l.imposto, liquido: l.liquido}};
    });
    const saldos = f.caixaInformado.contas.map(c => { const li = q(`#caixa-calculado .cx-saldo[data-saldo="${c.id}"]`); return {id: c.id, conta: c.brl, tela: li && li.dataset.minor !== undefined ? Number(li.dataset.minor) : null}; });
    const det = q('#block-cash details.registro-importado');
    const cascata = q('#caixa-calculado .cx-cascata');
    return {frase: f.frase, estado: f.estado, decimos: f.decimos, texto: f.texto, caixa: f.caixaInformado.temSaldo ? f.caixa : null, queima: f.queimaMedia, resultado: res.resultado, rotuloCascata: cx.rotulo, bruto: rec.bruto,
      manchete: (q('#caixa-calculado .cx-manchete') || {}).textContent, banco: num('banco'), queimaTela: num('queima'), folego: num('folego'), resultadoTela: num('resultado'),
      linhas, saldos, tituloCascata: cascata ? cascata.querySelector('.lv-cartao-titulo').textContent : null, linhasCascata: cascata ? cascata.querySelectorAll('.gf-tabela tbody tr').length : 0, passos: rec.bruto ? cx.passos.length : 0,
      recusaGrafico: [...document.querySelectorAll('#caixa-calculado .gf-recusa')].map(n => n.dataset.recusa),
      registro: det ? {aberto: det.open, conteudo: (q('#cash-content') || {childElementCount: 0}).childElementCount} : null};
  });
  certo(rotulo, limpo(r.manchete) === limpo(r.frase), `manchete do Caixa “${limpo(r.manchete)}” ≠ contas.folego “${r.frase}”`);
  certo(rotulo, r.banco && r.banco.minor === r.caixa, `No banco: tela ${r.banco && r.banco.minor}, conta ${r.caixa}`);
  certo(rotulo, r.queimaTela && r.queimaTela.minor === r.queima, `Queima média: tela ${r.queimaTela && r.queimaTela.minor}, conta ${r.queima}`);
  certo(rotulo, r.folego && r.folego.estado === r.estado && r.folego.decimos === r.decimos && (r.estado !== 'ok' || r.folego.texto === r.texto), `Fôlego: tela ${JSON.stringify(r.folego)}, conta ${r.estado} ${r.decimos} ${r.texto}`);
  certo(rotulo, r.resultadoTela && r.resultadoTela.minor === r.resultado, `Resultado: tela ${r.resultadoTela && r.resultadoTela.minor}, conta ${r.resultado}`);
  for (const l of r.linhas) certo(rotulo, JSON.stringify(l.tela) === JSON.stringify(l.conta), `receita ${l.id}: tela ${JSON.stringify(l.tela)} · conta ${JSON.stringify(l.conta)}`);
  for (const s of r.saldos) certo(rotulo, s.tela === s.conta, `saldo ${s.id}: tela ${s.tela}, conta ${s.conta}`);
  if (r.bruto) certo(rotulo, r.tituloCascata === r.rotuloCascata && r.linhasCascata === r.passos, `cascata: “${r.tituloCascata}” com ${r.linhasCascata} linhas; a conta diz “${r.rotuloCascata}” com ${r.passos} passos`);
  certo(rotulo, !r.recusaGrafico.length, `gráfico recusado: ${r.recusaGrafico.join(' | ')}`);
  certo(rotulo, r.registro && r.registro.aberto === registroAberto && r.registro.conteudo > 0, `o registro importado de 18/10 devia estar ${registroAberto ? 'aberto (a sócia abriu)' : 'recolhido'} e com conteúdo: ${JSON.stringify(r.registro)}`);
  registro.conferencias.push({rotulo, pagina: 'caixa', ...r});
  return r;
}
async function conferirPainel(pagina, rotulo) {
  const r = await pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const C = await import('/contas.js');
    const D = L.dados(), hoje = L.hojeDe(D.c);
    const m = C.manchetePainel(D.c.estado, D.aplicado, hoje, D.c.membro.id);
    const mud = C.mudancasRecentes(D.aplicado, D.c.membro.id, 3);
    const q = s => document.querySelector(s);
    const num = k => { const n = q(`#livro-resumo [data-numero="${k}"]`); return n ? {minor: n.dataset.minor === undefined ? null : Number(n.dataset.minor), texto: n.querySelector('.lv-kpi-valor').textContent.replace(/\s+/g, ' ').trim(), decimos: n.dataset.decimos === undefined ? null : Number(n.dataset.decimos)} : null; };
    const parte = q('#livro-resumo .cx-sua-parte');
    return {eu: D.c.membro.id, frase: m.frase, numeros: m.numeros.map(x => x.valor), minhaParte: m.minhaParte, mudancas: mud.map(x => x.seq), autoras: mud.map(x => x.autora),
      tela: (q('#livro-resumo .cx-painel-manchete') || {}).textContent, links: [...document.querySelectorAll('#livro-resumo .cx-painel-manchete a.cx-trecho')].length,
      nums: ['painel-saiu', 'painel-comprometido', 'painel-caixa', 'painel-folego'].map(num), parteTela: parte && parte.dataset.minor !== undefined ? Number(parte.dataset.minor) : null,
      mudancasTela: [...document.querySelectorAll('#livro-resumo .cx-mudancas-lista li')].map(li => Number(li.dataset.seq)), mini: !!q('#livro-resumo .gf-mini'), recusa: [...document.querySelectorAll('#livro-resumo .gf-recusa')].map(n => n.dataset.recusa)};
  });
  certo(rotulo, limpo(r.tela) === limpo(r.frase), `manchete do Meu painel “${limpo(r.tela)}” ≠ contas.manchetePainel “${r.frase}”`);
  certo(rotulo, r.links === 4, `cada trecho da manchete devia ser um link (vieram ${r.links})`);
  const [saiu, comp, caixa, fol] = r.nums;
  certo(rotulo, saiu && saiu.minor === r.numeros[0] && comp && comp.minor === r.numeros[1] && caixa && caixa.minor === r.numeros[2] && fol && fol.decimos === r.numeros[3],
    `os 4 números do Meu painel ${JSON.stringify(r.nums)} ≠ conta ${JSON.stringify(r.numeros)}`);
  certo(rotulo, r.parteTela === r.minhaParte, `sua parte: tela ${r.parteTela}, conta ${r.minhaParte}`);
  certo(rotulo, JSON.stringify(r.mudancasTela) === JSON.stringify(r.mudancas) && !r.autoras.includes(r.eu), `mudanças recentes: tela ${JSON.stringify(r.mudancasTela)}, conta ${JSON.stringify(r.mudancas)} (${r.autoras.join(', ')})`);
  certo(rotulo, r.mini && !r.recusa.length, `minigráfico ausente ou recusado: ${r.recusa.join(' | ')}`);
  registro.conferencias.push({rotulo, pagina: 'painel', ...r});
  return r;
}
// abre o "Ver a conta" de um botão e lê o total, a fórmula e os termos (depois fecha, se pedido)
async function lerConta(pagina, botao, {fechar = true, seletor = 'dialog.lv-conta:not(.cx-conta-folego)[open]'} = {}) {
  await botao.click();
  const dialogo = pagina.locator(seletor);
  await dialogo.waitFor({timeout: 5000}).catch(() => null);
  const total = limpo(await dialogo.locator('.lv-termo-total strong').textContent().catch(() => ''));
  const formula = limpo(await dialogo.locator('.lv-formula').first().textContent().catch(() => ''));
  const valores = (await dialogo.locator('.lv-termo-valor').allTextContents().catch(() => [])).map(limpo);
  const rotulos = (await dialogo.locator('.lv-termo-rotulo').allTextContents().catch(() => [])).map(limpo);
  if (fechar) await dialogo.locator('.lv-dialogo-topo button', {hasText: 'Fechar'}).click();
  return {total, formula, valores, rotulos, dialogo};
}

// ══ 1 · ?demo=1 nos 4 cortes ═════════════════════════════════════════════════════════════════════════════════════════
const telaDoPainel = {};
for (const tela of ['desktop', 'celular']) for (const tema of ['claro', 'escuro']) {
  const combo = `${tela}-${tema}`;
  const p = passo(`?demo=1 · ${combo}: Caixa e Meu painel contra o contas.js e a conta à mão`);
  const {contexto, pagina} = await abrir(p, '?demo=1&membro=m-bauer#caixa', {tela, tema});
  await pagina.waitForTimeout(400);
  const cx = await conferirCaixa(pagina, p + ' · Caixa');
  // a conta à mão sobre os dados do demo
  certo(p, limpo(cx.manchete) === 'Caixa de R$ 21.765,00 em 18/10: dá ≈ 9,2 meses na queima média de 1 mês fechado.', `manchete do demo: “${limpo(cx.manchete)}”`);
  certo(p, cx.caixa === DEMO.caixa && cx.queima === DEMO.queima && cx.decimos === decimosDe(DEMO.caixa, DEMO.queima) && cx.decimos === 92, `fôlego do demo: ${cx.caixa} ÷ ${cx.queima} = ${cx.decimos} décimos (à mão: ${decimosDe(DEMO.caixa, DEMO.queima)})`);
  const hot = cx.linhas.find(l => /hotmart/.test(l.id));
  certo(p, hot && JSON.stringify(hot.tela) === JSON.stringify({bruto: DEMO.receita.bruto, taxas: DEMO.receita.taxa, imposto: DEMO.receita.imposto, liquido: DEMO.receita.liquido}), `receita de outubro na tela ${JSON.stringify(hot && hot.tela)} ≠ à mão ${JSON.stringify(DEMO.receita)}`);
  certo(p, cx.tituloCascata === 'Para onde vão os R$ 2.396,00 de outubro', `título da cascata: “${cx.tituloCascata}”`);
  const linha = limpo(await pagina.locator('#caixa-calculado .cx-receita .cx-receita-conta').first().textContent());
  certo(p, linha === PREVIA(DEMO.receita, 40), `conta da linha: “${linha}” (à mão: “${PREVIA(DEMO.receita, 40)}”)`);
  await semRolagem(pagina, p, 'Caixa');
  await foto(pagina, `${combo}-caixa`);
  await irPara(pagina, 'overview');
  const pn = await conferirPainel(pagina, p + ' · Meu painel');
  certo(p, limpo(pn.tela) === limpo(pn.frase) && /^Outubro: saiu R\$ 1\.166,41; R\$ [\d.]+,\d\d comprometidos por mês; o caixa dá ≈ 9,2 meses; nada atrasado\.$/.test(limpo(pn.tela)), `manchete do Meu painel no demo: “${limpo(pn.tela)}”`);
  // o mesmo valor no Caixa e no Meu painel
  const [, , caixaPainel, folegoPainel] = pn.nums;
  certo(p, caixaPainel.minor === cx.banco.minor && caixaPainel.texto === cx.banco.texto && folegoPainel.texto === cx.folego.texto, `Caixa (${cx.banco.texto} / ${cx.folego.texto}) ≠ Meu painel (${caixaPainel.texto} / ${folegoPainel.texto})`);
  await semRolagem(pagina, p, 'Meu painel');
  const arquivo = await foto(pagina, `${combo}-meu-painel`);
  if (tema === 'claro') telaDoPainel[tela] = {arquivo, frase: limpo(pn.tela), nums: pn.nums, parte: limpo(await pagina.locator('#livro-resumo .cx-sua-parte').textContent())};
  if (combo === 'desktop-claro') {
    // "Ver a conta" no Meu painel: o caixa e o fôlego dão os mesmos números do Caixa
    const contaCaixa = await lerConta(pagina, pagina.locator('#livro-resumo [data-numero="painel-caixa"] button'));
    certo(p, contaCaixa.total === limpo(caixaPainel.texto), `Ver a conta do Caixa no Meu painel: ${contaCaixa.total} ≠ ${caixaPainel.texto}`);
    const contaFol = await lerConta(pagina, pagina.locator('#livro-resumo [data-numero="painel-folego"] button'), {seletor: 'dialog.cx-conta-folego[open]'});
    certo(p, contaFol.total === '9,2 meses' && contaFol.valores[0] === real(DEMO.caixa) && contaFol.valores[1] === real(DEMO.queima) + ' por mês' && /média de 1 mês fechado/.test(contaFol.formula), `Ver a conta do fôlego: ${JSON.stringify(contaFol)}`);
    // cada trecho é link: "o caixa dá ≈ 9,2 meses" leva ao Caixa, com o foco no título da parte calculada
    await pagina.locator('#livro-resumo a.cx-trecho', {hasText: 'o caixa dá'}).click();
    await pagina.waitForTimeout(500);
    const lugar = await pagina.evaluate(() => ({pagina: document.querySelector('[data-finance-page]:not([hidden])').dataset.financePage, foco: document.activeElement && document.activeElement.id, hash: location.hash}));
    certo(p, lugar.pagina === 'cash' && lugar.foco === 'caixa-calculado-titulo' && lugar.hash === '#caixa', `o trecho do fôlego foi para ${JSON.stringify(lugar)}`);
    // "Ver a conta" no Caixa: No banco, Queima média, Fôlego, Resultado e a receita (com a taxa e o Simples)
    const banco = await lerConta(pagina, pagina.locator('#caixa-calculado [data-numero="banco"] button'));
    certo(p, banco.total === real(DEMO.caixa) && banco.valores.includes(real(DEMO.caixa)), `Ver a conta de No banco: ${JSON.stringify(banco)}`);
    const queima = await lerConta(pagina, pagina.locator('#caixa-calculado [data-numero="queima"] button'), {fechar: false});
    certo(p, queima.total === real(DEMO.queima) && /Setembro/.test(queima.rotulos.join(' ')), `Ver a conta da queima: ${JSON.stringify({total: queima.total, rotulos: queima.rotulos})}`);
    // a queima de setembro abre "saiu − entrou" do mesmo mês do fluxo
    await queima.dialogo.locator('button.lv-termo-rotulo').first().click();
    const sub = limpo(await queima.dialogo.locator('.lv-termo-total strong').textContent());
    certo(p, sub === real(DEMO.queima) && /Queima do mês = o que saiu − o que entrou/.test(limpo(await queima.dialogo.locator('.lv-formula').textContent())), `queima de setembro: ${sub}`);
    await queima.dialogo.locator('.lv-dialogo-topo button', {hasText: 'Fechar'}).click();
    const fol = await lerConta(pagina, pagina.locator('#caixa-calculado [data-numero="folego"] button'), {fechar: false, seletor: 'dialog.cx-conta-folego[open]'});
    certo(p, fol.total === contaFol.total, `Ver a conta do fôlego: Caixa ${fol.total}, Meu painel ${contaFol.total}`);
    // o termo "Caixa" do fôlego abre a conta dele por cima; ao fechar, volta ao fôlego
    await fol.dialogo.locator('button.lv-termo-rotulo').first().click();
    const porCima = pagina.locator('dialog.lv-conta:not(.cx-conta-folego)[open]');
    await porCima.waitFor({timeout: 3000}).catch(() => null);
    certo(p, limpo(await porCima.locator('.lv-termo-total strong').textContent().catch(() => '')) === real(DEMO.caixa), 'o termo Caixa do fôlego não abriu a conta do caixa');
    await porCima.locator('.lv-dialogo-topo button', {hasText: 'Fechar'}).click();
    certo(p, await pagina.locator('dialog.cx-conta-folego[open]').count() === 1, 'fechar a conta do caixa fechou também o fôlego');
    await fol.dialogo.locator('.lv-dialogo-topo button', {hasText: 'Fechar'}).click();
    const res = await lerConta(pagina, pagina.locator('#caixa-calculado [data-numero="resultado"] button'));
    certo(p, res.total === cx.resultadoTela.texto && res.valores.slice(0, 3).join(' | ') === [real(DEMO.receita.bruto), real(DEMO.receita.taxa), real(DEMO.receita.imposto)].join(' | '), `Ver a conta do resultado: ${JSON.stringify(res)}`);
    // à mão: resultado = líquido − custo do mês (o custo é o 4º termo da conta)
    const custo = Number(res.valores[3].replace(/[^\d]/g, ''));
    certo(p, cx.resultado === DEMO.receita.liquido - custo, `resultado ${cx.resultado} ≠ líquido ${DEMO.receita.liquido} − custo ${custo}`);
    const rec = await lerConta(pagina, pagina.locator('#caixa-calculado .cx-receita button', {hasText: 'Ver a conta'}), {fechar: false});
    certo(p, rec.total === real(DEMO.receita.liquido) && rec.valores.join(' | ') === [real(DEMO.receita.bruto), real(DEMO.receita.taxa), real(DEMO.receita.imposto)].join(' | '), `Ver a conta da receita: ${JSON.stringify({total: rec.total, valores: rec.valores})}`);
    await rec.dialogo.locator('button.lv-termo-rotulo', {hasText: 'Taxa'}).click();
    const taxa = limpo(await rec.dialogo.locator('.lv-formula').textContent());
    certo(p, taxa === 'Taxa Hotmart = 9,9% × R$ 2.396,00 + 40 × R$ 2,49 = R$ 336,80' && limpo(await rec.dialogo.locator('.lv-termo-total strong').textContent()) === real(DEMO.receita.taxa), `fórmula da taxa: “${taxa}”`);
    await rec.dialogo.locator('button', {hasText: '‹ Voltar'}).click();
    await rec.dialogo.locator('button.lv-termo-rotulo', {hasText: 'Imposto'}).click();
    const imp = limpo(await rec.dialogo.locator('.lv-formula').textContent());
    certo(p, imp === 'Simples = 6% × R$ 2.396,00 = R$ 143,76', `fórmula do Simples: “${imp}”`);
    await rec.dialogo.locator('.lv-dialogo-topo button', {hasText: 'Fechar'}).click();
    // o registro importado continua a um toque
    await pagina.locator('#block-cash details.registro-importado > summary').click();
    certo(p, await pagina.evaluate(() => document.querySelector('#block-cash details.registro-importado').open && document.querySelector('#cash-content').offsetHeight > 0), 'o registro importado de 18/10 não abriu');
    await pagina.evaluate(() => window.financeLivro.renderTudo(true));
    certo(p, await pagina.evaluate(() => document.querySelector('#block-cash details.registro-importado').open), 'um redesenho fechou o registro que a sócia abriu');
    // teclado: um tab stop por gráfico, e a dica do fluxo anda com as setas
    const area = pagina.locator('#caixa-calculado .cx-fluxo .gf-area');
    await area.focus();
    await pagina.keyboard.press('Home');
    const dica1 = limpo(await pagina.locator('#caixa-calculado .cx-fluxo .gf-dica').textContent());
    await pagina.keyboard.press('ArrowRight');
    const dica2 = limpo(await pagina.locator('#caixa-calculado .cx-fluxo .gf-dica').textContent());
    certo(p, /^Agosto/.test(dica1) && /^Setembro/.test(dica2) && /fechado/.test(dica2), `a dica do fluxo não andou: “${dica1}” → “${dica2}”`);
    const tabStops = await pagina.evaluate(() => [...document.querySelectorAll('#caixa-calculado .gf-novo')].map(f => f.querySelectorAll('[tabindex="0"]').length));
    certo(p, tabStops.length === 2 && tabStops.every(n => n === 1), `tab stops por gráfico: ${JSON.stringify(tabStops)}`);
    // um redesenho com o foco no gráfico devolve o foco ao gráfico
    await pagina.evaluate(() => window.financeLivro.renderTudo(true));
    certo(p, (await focoAtual(pagina)).chave === 'grafico:fluxo', 'o redesenho tirou o foco do gráfico');
    // o mês anterior pelo ‹: setembro fechado, sem "+ Receita", e o endereço acompanha
    await pagina.locator('#caixa-calculado button[data-chave="mes-anterior"]').click();
    await pagina.waitForTimeout(300);
    const set = await pagina.evaluate(() => ({hash: location.hash, mes: document.querySelector('#caixa-calculado .cx-mes').dataset.mes, situacao: document.querySelector('#caixa-calculado .cx-mes-situacao').textContent, nova: !!document.querySelector('#caixa-calculado [data-chave="receita:nova"]'), foco: document.activeElement && document.activeElement.dataset.chave}));
    certo(p, set.hash === '#caixa/2026-09' && set.mes === '2026-09' && /^Setembro fechado por Bauer em 03\/10\/2026 · selo [0-9a-f]{8}/.test(set.situacao) && !set.nova && set.foco === 'mes-anterior', `setembro pelo ‹: ${JSON.stringify(set)}`);
    await conferirCaixa(pagina, p + ' · setembro', {registroAberto: true});
    await foto(pagina, 'desktop-claro-caixa-setembro');
    await pagina.locator('#caixa-calculado button', {hasText: 'Voltar ao mês atual'}).click();
    await pagina.waitForTimeout(300);
    certo(p, await pagina.evaluate(() => location.hash) === '#caixa', 'voltar ao mês atual não voltou o endereço para #caixa');
  }
  await contexto.close();
}
{
  const p = passo('?demo=1 como m-ana: as mudanças recentes são do Bauer e da Beatriz, nunca dela');
  const {contexto, pagina} = await abrir(p, '?demo=1&membro=m-ana');
  await pagina.waitForTimeout(300);
  const pn = await conferirPainel(pagina, p);
  certo(p, pn.mudancas.length === 3, `a Ana devia ver 3 mudanças (viu ${pn.mudancas.length})`);
  await contexto.close();
}

// ══ 2 · ?diario=local: gravação de verdade, trocando de sócia ═════════════════════════════════════════════════════
const local = membro => `?diario=local&membro=${membro}`;
let alvoReceita = null;
{
  const p = passo('?diario=local · Caixa vazio: diz o que falta, sem inventar número');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const cx = await conferirCaixa(pagina, p);
  certo(p, limpo(cx.manchete) === 'Sem saldo do banco informado: o fôlego precisa de 1 mês fechado.', `manchete vazia: “${limpo(cx.manchete)}”`);
  certo(p, cx.folego.texto === 'precisa de 1 mês fechado' && cx.queimaTela.texto === '—' && cx.banco.texto === '—', `números vazios: ${JSON.stringify([cx.banco, cx.queimaTela, cx.folego])}`);
  const textos = await pagina.evaluate(() => ({receitas: document.querySelector('#caixa-calculado .cx-receitas').textContent, saldos: document.querySelector('#caixa-calculado .cx-saldos').textContent, cascata: document.querySelector('#caixa-calculado .cx-cascata').textContent}));
  certo(p, /Nenhuma receita lançada em outubro/.test(textos.receitas) && /Nenhum saldo informado ainda/.test(textos.saldos) && /Nenhuma receita lançada em outubro/.test(textos.cascata), 'faltam os textos de vazio');
  await foto(pagina, 'local-caixa-vazio');
  await irPara(pagina, 'overview');
  const pn = await conferirPainel(pagina, p + ' · Meu painel');
  certo(p, /o fôlego precisa de 1 mês fechado/.test(limpo(pn.tela)) && pn.nums[2].texto === '—', `Meu painel vazio: “${limpo(pn.tela)}”`);
  // preparo (sem a tela): um gasto de setembro e setembro fechado pelo Bauer, com o selo da foto do mês
  const preparo = await pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const C = await import('/contas.js');
    const r1 = await L.gravar({acao: 'add_expense', alvo: 'g-fluxo-caixa-set', dados: {data: '2026-09-10', competencia: '2026-09', descricao: 'Contador · setembro', categoria: 'contabilidade_juridico', valorMinor: 45000, moeda: 'BRL', forma: 'conta_pj', pagoPor: L.dados().c.membro.id}}, 'Lançado.');
    if (!r1.ok) return 'gasto: ' + r1.erro;
    const D = L.dados(), cabeca = D.d.cabeca, foto = C.fotoDoMes(D.c.estado, D.aplicado, '2026-09', cabeca), t = foto.totais;
    const r2 = await L.gravar({acao: 'close_month', alvo: '2026-09', dados: {cabeca, selo: C.seloDoMes(foto), totais: {realizado: t.realizado, previsto: t.previsto, total: t.total, resultado: t.resultado}}}, 'Setembro fechado.');
    return r2.ok ? null : 'fechamento: ' + r2.erro;
  });
  certo(p, !preparo, `o preparo falhou: ${preparo}`);
  await irPara(pagina, 'cash');
  const sem = await numeroDaTela(pagina, 'folego');
  certo(p, sem && sem.estado === 'sem_saldo' && sem.texto === 'falta o saldo do banco', `com setembro fechado e sem saldo, o fôlego devia pedir o saldo: ${JSON.stringify(sem)}`);
  certo(p, limpo(await pagina.locator('#caixa-calculado .cx-manchete').textContent()) === 'Informe o saldo do banco para ver quanto tempo o caixa dura.', 'a manchete não pede o saldo');
  await contexto.close();
}
{
  const p = passo('o Bauer informa o saldo da conta PJ → o fôlego aparece');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  await pagina.locator('#caixa-calculado button[data-chave="saldo:novo"]').click();
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  certo(p, await pagina.evaluate(() => document.activeElement && document.activeElement.getAttribute('list') && document.activeElement.value === 'Conta PJ principal'), 'o foco não foi para a conta (com “Conta PJ principal”)');
  await folha.locator('.lv-dinheiro-valor').fill('10.000,00');
  const previa = limpo(await folha.locator('.cx-previa').textContent());
  certo(p, /^Com ele, o caixa fica R\$ 10\.000,00 e o fôlego, ≈ \d+,\d meses \(média de 1 mês fechado\)\.$/.test(previa), `prévia do saldo: “${previa}”`);
  await foto(pagina, 'local-folha-saldo', false);
  await folha.locator('button', {hasText: 'Salvar o saldo'}).click();
  certo(p, await esperarToast(pagina, /Saldo informado: Conta PJ principal/), 'o toast não anunciou o saldo');
  await pagina.waitForTimeout(300);
  const ev = await ultimoEvento(pagina);
  certo(p, ev.modo === 'gravacao' && !ev.treino && ev.membro === 'm-bauer' && ev.c.acao === 'set_balance' && ev.c.dados.valorMinor === 1000000 && ev.c.dados.moeda === 'BRL', `o saldo não chegou ao diário: ${JSON.stringify(ev)}`);
  const cx = await conferirCaixa(pagina, p);
  // à mão: fôlego = caixa ÷ queima média (1 mês fechado), em décimos, um arredondamento só
  certo(p, cx.estado === 'ok' && cx.caixa === 1000000 && cx.decimos === decimosDe(1000000, cx.queima) && cx.folego.texto === textoMeses(cx.decimos), `fôlego depois do saldo: ${JSON.stringify(cx.folego)} (à mão ${decimosDe(1000000, cx.queima)} décimos de ${cx.queima})`);
  certo(p, previa.includes(cx.folego.texto), `a prévia (“${previa}”) não deu o fôlego que a tela mostra (${cx.folego.texto})`);
  certo(p, (await focoAtual(pagina)).chave === 'saldo:novo', `depois do saldo o foco devia voltar ao “+ Saldo” (foi ${JSON.stringify(await focoAtual(pagina))})`);
  await contexto.close();
}
{
  const p = passo('o Bauer lança a receita de outubro pelo teclado, com a prévia do plano → a cascata e o resultado mudam; o fôlego não (só meses fechados)');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const antes = await conferirCaixa(pagina, p + ' (antes)');
  const nova = pagina.locator('#caixa-calculado button[data-chave="receita:nova"]');
  certo(p, /Lançar uma receita de outubro de 2026/.test(await nova.getAttribute('aria-label') || ''), `nome acessível do “+ Receita”: ${await nova.getAttribute('aria-label')}`);
  await nova.focus();
  await pagina.keyboard.press('Enter');
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  await folha.locator('input[list]').fill('Med Painel');
  await folha.locator('.lv-dinheiro-valor').first().fill('2.396,00');
  await folha.locator('.cx-contagem').first().fill('40');
  const previa = limpo(await folha.locator('.cx-previa').textContent());
  certo(p, previa === PREVIA(DEMO.receita, 40), `prévia da receita: “${previa}” (à mão: “${PREVIA(DEMO.receita, 40)}”)`);
  await foto(pagina, 'local-folha-receita', false);
  await folha.locator('.cx-contagem').first().press('Enter');   // Enter envia a folha (o botão principal é o submit)
  certo(p, await esperarToast(pagina, /Receita lançada: Hotmart · Med Painel · R\$\s2\.396,00/), 'o toast (role=status) não anunciou a receita');
  certo(p, await pagina.locator('#lv-toast button', {hasText: 'Desfazer'}).count() === 1, 'o toast da receita não oferece “Desfazer”');
  await pagina.waitForFunction(() => !document.querySelector('dialog.sheet[open]'), null, {timeout: 5000}).catch(() => null);
  await pagina.waitForTimeout(300);
  const ev = await ultimoEvento(pagina);
  alvoReceita = ev.c.alvo;
  certo(p, ev.modo === 'gravacao' && !ev.treino && ev.membro === 'm-bauer' && ev.c.acao === 'add_income' && ev.c.dados.brutoMinor === 239600 && ev.c.dados.transacoes === 40 && ev.c.dados.canal === 'hotmart', `a receita não chegou ao diário: ${JSON.stringify(ev)}`);
  const depois = await conferirCaixa(pagina, p + ' (depois)');
  certo(p, depois.resultado - antes.resultado === DEMO.receita.liquido, `o resultado devia subir ${real(DEMO.receita.liquido)} (subiu ${depois.resultado - antes.resultado})`);
  certo(p, depois.tituloCascata === 'Para onde vão os R$ 2.396,00 de outubro', `a cascata não mudou: “${depois.tituloCascata}”`);
  certo(p, depois.decimos === antes.decimos, 'o fôlego mudou com uma receita de mês aberto');
  const hot = depois.linhas.find(l => l.id === alvoReceita);
  certo(p, hot && JSON.stringify(hot.tela) === JSON.stringify({bruto: 239600, taxas: DEMO.receita.taxa, imposto: DEMO.receita.imposto, liquido: DEMO.receita.liquido}), `linha da receita: ${JSON.stringify(hot && hot.tela)}`);
  certo(p, (await focoAtual(pagina)).chave === 'receita:nova', `depois da receita o foco devia voltar ao “+ Receita” (foi ${JSON.stringify(await focoAtual(pagina))})`);
  await foto(pagina, 'local-caixa-com-receita');
  await contexto.close();
}
{
  const p = passo('o Bauer corrige a receita (41 vendas) → taxa, Simples e líquido refeitos');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  await pagina.locator(`#caixa-calculado .cx-receita[data-receita="${alvoReceita}"] button`, {hasText: 'Corrigir'}).click();
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  certo(p, await folha.locator('.lv-dinheiro-valor').first().inputValue() === '2.396,00' && await folha.locator('.cx-contagem').first().inputValue() === '40', 'a correção não veio preenchida');
  certo(p, await folha.locator('.lv-rotulo', {hasText: /^Motivo da correção \(opcional\)$/}).count() === 1, 'para a própria receita, o motivo é opcional');
  const c41 = contaHotmart(41 * 5990, 41);
  await folha.locator('.lv-dinheiro-valor').first().fill('2.455,90');
  await folha.locator('.cx-contagem').first().fill('41');
  const previa = limpo(await folha.locator('.cx-previa').textContent());
  certo(p, previa === PREVIA(c41, 41), `prévia da correção: “${previa}” (à mão: “${PREVIA(c41, 41)}”)`);
  await folha.locator('button', {hasText: 'Salvar a correção'}).click();
  certo(p, await esperarToast(pagina, /Receita corrigida/), 'o toast não anunciou a correção');
  await pagina.waitForTimeout(300);
  const cx = await conferirCaixa(pagina, p);
  const hot = cx.linhas.find(l => l.id === alvoReceita);
  certo(p, hot && hot.tela.bruto === c41.bruto && hot.tela.taxas === c41.taxa && hot.tela.imposto === c41.imposto && hot.tela.liquido === c41.liquido, `linha corrigida: ${JSON.stringify(hot && hot.tela)} (à mão ${JSON.stringify(c41)})`);
  certo(p, cx.tituloCascata === 'Para onde vão os R$ 2.455,90 de outubro', `cascata depois da correção: “${cx.tituloCascata}”`);
  certo(p, (await focoAtual(pagina)).chave === 'corrigir:' + alvoReceita, `depois da correção o foco devia voltar ao “Corrigir” (foi ${JSON.stringify(await focoAtual(pagina))})`);
  await contexto.close();
}
{
  const p = passo('a Ana corrige a receita do Bauer: sem motivo é recusado; com motivo, grava');
  const {contexto, pagina} = await abrir(p, local('m-ana') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  await pagina.locator(`#caixa-calculado .cx-receita[data-receita="${alvoReceita}"] button`, {hasText: 'Corrigir'}).click();
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  certo(p, await folha.locator('.lv-rotulo', {hasText: /^Motivo da correção$/}).count() === 1 && /lançada por Bauer: corrigir pede um motivo/.test(await folha.textContent()), 'a folha da Ana não explica que corrigir a receita de outra sócia pede motivo');
  await folha.locator('.lv-dinheiro-valor').nth(2).fill('59,90');   // cancelados
  await folha.locator('button', {hasText: 'Salvar a correção'}).click();
  await pagina.waitForTimeout(200);
  const erro = limpo(await folha.locator('.lv-erro').textContent().catch(() => ''));
  certo(p, erro === 'Mudar a receita de outra sócia pede um motivo.' && await folha.isVisible(), `sem motivo: “${erro}”`);
  await folha.locator('input[placeholder^="Obrigatório"]').fill('o extrato trouxe um cancelamento');
  await folha.locator('button', {hasText: 'Salvar a correção'}).click();
  certo(p, await esperarToast(pagina, /Receita corrigida/), 'o toast não anunciou a correção da Ana');
  await pagina.waitForTimeout(300);
  certo(p, /R\$\s59,90 cancelados/.test(await pagina.locator(`#caixa-calculado .cx-receita[data-receita="${alvoReceita}"]`).textContent()), 'os cancelados não aparecem na linha');
  const ev = await ultimoEvento(pagina);
  certo(p, ev.membro === 'm-ana' && ev.c.acao === 'edit_income' && ev.c.motivo === 'o extrato trouxe um cancelamento' && ev.c.dados.canceladosMinor === 5990, `a correção da Ana não chegou ao diário: ${JSON.stringify(ev)}`);
  await conferirCaixa(pagina, p);
  await contexto.close();
}
{
  const p = passo('o Bauer anula a receita com motivo → sai das contas, fica riscada; o resultado volta');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  await pagina.locator(`#caixa-calculado .cx-receita[data-receita="${alvoReceita}"] button`, {hasText: 'Anular'}).click();
  const pergunta = pagina.locator('dialog.lv-pergunta[open]');
  await pergunta.waitFor({timeout: 5000});
  await pergunta.locator('input').fill('teste do fluxo: receita lançada para conferir');
  await pergunta.locator('button', {hasText: 'Confirmar'}).click();
  certo(p, await esperarToast(pagina, /Receita anulada/), 'o toast não anunciou a anulação');
  await pagina.waitForTimeout(300);
  const cx = await conferirCaixa(pagina, p);
  const anulada = pagina.locator(`#caixa-calculado .cx-receita.is-anulada[data-receita="${alvoReceita}"]`);
  certo(p, await anulada.count() === 1 && /anulada por Bauer .*: teste do fluxo/.test(limpo(await anulada.textContent())), 'a receita anulada não ficou visível, riscada, com o motivo');
  certo(p, !cx.linhas.length && /Nenhuma receita lançada em outubro/.test(await pagina.locator('#caixa-calculado .cx-cascata').textContent()), 'a cascata ainda conta a receita anulada');
  certo(p, (await focoAtual(pagina)).chave === 'titulo:receitas', `depois de anular, o foco devia ir ao título das receitas (foi ${JSON.stringify(await focoAtual(pagina))})`);
  await contexto.close();
}
{
  const p = passo('receita em mês fechado: a prévia e a folha dizem o motivo; nada grava');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const cabeca = (await ultimoEvento(pagina)).seq;
  await pagina.locator('#caixa-calculado button[data-chave="receita:nova"]').click();
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  await folha.locator('select[aria-label="Competência"]').selectOption('2026-09');
  await folha.locator('.lv-dinheiro-valor').first().fill('500,00');
  await folha.locator('.cx-contagem').first().fill('10');
  const previa = folha.locator('.cx-previa');
  certo(p, /is-erro/.test(await previa.getAttribute('class')) && /^Setembro de 2026 está fechado/.test(limpo(await previa.textContent())), `prévia em mês fechado: “${limpo(await previa.textContent())}”`);
  await folha.locator('button', {hasText: 'Salvar a receita'}).click();
  await pagina.waitForTimeout(300);
  certo(p, /^Setembro de 2026 está fechado/.test(limpo(await folha.locator('.lv-erro').textContent().catch(() => ''))) && await folha.isVisible(), 'a folha não mostrou a recusa do mês fechado');
  await foto(pagina, 'local-folha-receita-mes-fechado', false);
  await folha.locator('button', {hasText: 'Cancelar'}).click();
  certo(p, (await ultimoEvento(pagina)).seq === cabeca, 'algo foi gravado no mês fechado');
  await contexto.close();
}
{
  const p = passo('saldo em dólar de 42 dias atrás: entra pela PTAX sem spread e pede o de hoje');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  await pagina.locator('#caixa-calculado button[data-chave="saldo:novo"]').click();
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  await folha.locator('input[list]').fill('Conta em dólar');
  await folha.locator('input[type=date]').fill('2026-09-07');
  await folha.locator('select[aria-label="Moeda do saldo"]').selectOption('USD');
  await folha.locator('.lv-dinheiro-valor').fill('1.000,00');
  const previa = limpo(await folha.locator('.cx-previa').textContent());
  certo(p, /US\$ 1\.000,00 × 5,0826 = R\$ 5\.082,60/.test(previa) && /sem spread/.test(previa), `prévia do saldo em dólar: “${previa}”`);
  await folha.locator('button', {hasText: 'Salvar o saldo'}).click();
  certo(p, await esperarToast(pagina, /Saldo informado: Conta em dólar/), 'o toast não anunciou o saldo em dólar');
  await pagina.waitForTimeout(300);
  const cx = await conferirCaixa(pagina, p);
  const usd = arred(100000n * 50826n, 10000n);   // à mão: US$ 1.000,00 × 5,0826, só o principal
  certo(p, usd === 508260 && cx.caixa === 1000000 + usd, `caixa com o dólar: ${cx.caixa} (à mão ${1000000 + usd})`);
  const li = pagina.locator('#caixa-calculado .cx-saldo[data-conta="Conta em dólar"]');
  const texto = limpo(await li.textContent());
  certo(p, /saldo de 42 dias atrás/.test(texto) && /informe o de hoje/.test(texto) && /pela PTAX de 16\/10 \(posterior ao saldo\), sem spread/.test(texto), `aviso do saldo antigo: “${texto}”`);
  certo(p, await li.locator('button', {hasText: 'Informar o de hoje'}).count() === 1, 'falta “Informar o de hoje”');
  certo(p, /há 42 dias/.test(await pagina.locator('#caixa-calculado [data-numero="banco"]').textContent()), 'o número “No banco” não avisa a idade do saldo');
  certo(p, (await focoAtual(pagina)).chave === 'saldo:novo', `depois do saldo em dólar o foco devia voltar ao “+ Saldo” (foi ${JSON.stringify(await focoAtual(pagina))})`);
  await foto(pagina, 'local-caixa-final');
  await irPara(pagina, 'historico');
  const hist = await pagina.locator('#historico-content').textContent();
  for (const t of ['Bauer lançou a receita', 'Bauer corrigiu a receita', 'Ana Ribeiro corrigiu a receita', 'Bauer anulou a receita', 'Bauer informou o saldo']) certo(p, hist.includes(t), `o Histórico não mostra “${t}”`);
  await contexto.close();
}
{
  const p = passo('Meu painel da Ana: a manchete e as mudanças recentes do Bauer, iguais à conta');
  const {contexto, pagina} = await abrir(p, local('m-ana'));
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const pn = await conferirPainel(pagina, p);
  certo(p, pn.mudancas.length === 3 && pn.autoras.every(a => a === 'm-bauer'), `as mudanças da Ana deviam ser as 3 últimas do Bauer: ${JSON.stringify(pn.autoras)}`);
  await semRolagem(pagina, p, 'Meu painel');
  await foto(pagina, 'local-ana-meu-painel');
  await contexto.close();
}

{
  const p = passo('agosto fechado com uma receita maior que os gastos: “sem queima de caixa”, com a média de 2 meses fechados');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#caixa');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const preparo = await pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const C = await import('/contas.js');
    const r1 = await L.gravar({acao: 'add_income', alvo: 'rc-fluxo-agosto', dados: {competencia: '2026-08', canal: 'hotmart', produto: 'Med Painel', brutoMinor: 10000000, canceladosMinor: null, moeda: 'BRL', transacoes: 1000, taxasMinor: null}}, 'Receita lançada.');
    if (!r1.ok) return 'receita: ' + r1.erro;
    const D = L.dados(), cabeca = D.d.cabeca, foto = C.fotoDoMes(D.c.estado, D.aplicado, '2026-08', cabeca), t = foto.totais;
    const r2 = await L.gravar({acao: 'close_month', alvo: '2026-08', dados: {cabeca, selo: C.seloDoMes(foto), totais: {realizado: t.realizado, previsto: t.previsto, total: t.total, resultado: t.resultado}}}, 'Agosto fechado.');
    return r2.ok ? null : 'fechamento: ' + r2.erro;
  });
  certo(p, !preparo, `o preparo falhou: ${preparo}`);
  await pagina.waitForTimeout(300);
  const cx = await conferirCaixa(pagina, p);
  certo(p, cx.estado === 'sem_queima' && cx.folego.texto === 'sem queima de caixa' && cx.queimaTela.texto === 'sem queima', `fôlego sem queima: ${JSON.stringify([cx.folego, cx.queimaTela])}`);
  certo(p, /: sem queima de caixa \(média de 2 meses fechados\)\.$/.test(limpo(cx.manchete)), `manchete sem queima: “${limpo(cx.manchete)}”`);
  await irPara(pagina, 'overview');
  const pn = await conferirPainel(pagina, p + ' · Meu painel');
  certo(p, /; sem queima de caixa;/.test(limpo(pn.tela)), `Meu painel sem queima: “${limpo(pn.tela)}”`);
  await contexto.close();
}

// ══ 3 · o roteiro do teste de 10 segundos (§8.8), sobre a foto do Meu painel ══════════════════════════════════════
{
  const p = passo('roteiro do teste de 10 segundos sobre a foto do Meu painel');
  const d = telaDoPainel.desktop, c = telaDoPainel.celular;
  certo(p, d && c, 'faltam as fotos do Meu painel para o roteiro');
  if (d && c) {
    const [saiu, comprometido, caixa, folego] = d.nums;
    const roteiro = [
      'TESTE DE 10 SEGUNDOS · MEU PAINEL (plano §8.8)',
      'Para aplicar com as três sócias, uma de cada vez, de preferência no celular dela e depois de publicar o servidor.',
      '',
      `Fotos (dados fictícios do arnês, ?demo=1): ${c.arquivo || 'celular-claro-meu-painel.png'} e ${d.arquivo || 'desktop-claro-meu-painel.png'}`,
      `Manchete na tela: "${d.frase}"`,
      `Números na tela: ${saiu.texto} saiu · ${comprometido.texto} comprometido por mês · ${caixa.texto} no caixa · ${folego.texto} de fôlego`,
      `Linha da sua parte: "${d.parte}"`,
      '',
      'Como aplicar (sem explicar nada antes):',
      '1. Abra o Meu painel (ou mostre a foto) e diga só: "vou fazer quatro perguntas; responda olhando a tela".',
      '2. Faça uma pergunta por vez e conte o tempo até a resposta. Não aponte nem dê dica.',
      '3. Anote a resposta exata e o tempo. Passa quando as quatro respostas vêm certas, cada uma em até 10 segundos.',
      '',
      'As quatro perguntas e a resposta certa (lida da tela do arnês):',
      `P1. Quanto a empresa gasta por mês?            → ${comprometido.texto} ("Comprometido por mês"; na manchete: "${comprometido.texto} comprometidos por mês")`,
      `P2. Qual é a sua parte?                         → ${d.parte.replace(/^.*?: /, '').replace(/\.$/, '')} (linha em ouro abaixo dos números)`,
      `P3. Quanto tempo o caixa dura?                  → ${folego.texto} ("Fôlego"; na manchete: "o caixa dá ${folego.texto}"). Vale "uns 9 meses".`,
      `P4. Tem algo atrasado?                          → ${/nada atrasado/.test(d.frase) ? 'Não ("nada atrasado", no fim da manchete)' : 'Sim (o trecho em vermelho da manchete)'}`,
      '',
      'Folha de registro (uma linha por sócia e pergunta):',
      'sócia | aparelho | pergunta | tempo (s) | resposta dada | certa? | onde olhou primeiro',
      '',
      'Se alguém passar de 10 s ou errar: anote onde olhou primeiro e o que entendeu. Com os dados reais os números',
      'mudam, mas as respostas saem dos mesmos lugares: a manchete e os quatro números do topo do Meu painel.',
    ].join('\n');
    await writeFile(join(SAIDA, 'teste-10-segundos.txt'), roteiro + '\n');
    registro.roteiro = join(SAIDA, 'teste-10-segundos.txt');
    console.log('\n' + roteiro + '\n');
  }
}

await navegador.close();
servidor.close();
for (const e of registro.erros) falha('erros da página', `${e.rotulo} · ${e.tipo} · ${e.texto}`);
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`\n${registro.passos.length} passos · ${registro.conferencias.length} conferências com a conta · ${registro.fotos.length} fotos em ${SAIDA} · ${registro.falhas.length} falha(s)`);
if (registro.falhas.length) process.exitCode = 1;
