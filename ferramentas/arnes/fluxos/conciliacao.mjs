// Fluxo da fatia F2-8 (conciliar a fatura e a PTAX do dia). Três partes:
//  1. ?demo=1 nos 4 cortes (claro/escuro, 1280×860/390×844): a folha "Conciliar fatura" abre de Lançamentos em outubro,
//     no cartão da empresa, com os dois gastos em dólar sem fatura; as estimativas batem com o razão e com a conta à mão
//     (US$ 20,00 × 5,0826 × 1,04 × 1,035 = R$ 109,42; US$ 100,00 → R$ 547,09); cada gasto mostra a PTAX real do dia da
//     compra (uma consulta só ao Banco Central); digitada a fatura (R$ 109,42 + R$ 549,80), o resumo diz "Estimado
//     R$ 656,51 → fatura R$ 659,22 · diferença +R$ 2,71" e a explicação usa a PTAX real com a data dela e o spread de
//     contas.spreadImplicito; nada rola de lado a 390px. No desktop claro, grava (treino): os gastos ganham a fatura e
//     guardam o antes, o spread vira parâmetro a partir de 01/11, o Livro do mês troca "estimado" por "fatura" e o
//     Histórico tem 1 registro de outubro com o Δ. Setembro (fechado) mostra o cadeado e o razão recusa com o motivo.
//  2. ?diario=local (servidor do diário de verdade, em memória): três gastos em dólar de outubro no cartão da empresa
//     (um num domingo: vale a PTAX do último dia útil antes), um no cartão pessoal do Bauer e um no da Ana; setembro
//     fechado. Concilia pelo total: cada gasto ganha a parte do contas.ratearFatura e a soma fecha ao centavo; depois de
//     recarregar, o Livro do mês diz "fatura", o Histórico tem 1 registro com o Δ e o spread salvo continua lá; o
//     cartão pessoal só mostra os gastos de quem pagou; setembro recusa com o motivo.
//  3. PTAX indisponível (rede para o Banco Central bloqueada): a folha avisa "Não foi possível consultar o Banco Central
//     agora; a conciliação funciona sem ela" e concilia mesmo assim, sem oferecer spread.
// A API Olinda (CotacaoMoedaPeriodo) é servida por um dublê com os boletins reais do BCB de 15/09 a 16/10/2026
// (abertura e fechamento, filtrados pelo período pedido), para o teste não depender da rede. Sai com código 1 em
// qualquer falha, erro de script ou violação de CSP (o registro fica em <saida>/registro.json).
// Uso: node ferramentas/arnes/fluxos/conciliacao.mjs [--saida DIR] [--porta 8796] [--site DIR] [--sem-fotos]
import {pathToFileURL, fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'fluxo-conciliacao')));
const PORTA = Number(arg('porta', 8796));
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
const limpo = t => String(t || '').replace(/\s+/g, ' ').trim();
const real = minor => limpo(new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(minor / 100));
const comSinal = minor => (minor > 0 ? '+' : minor < 0 ? '−' : '') + real(Math.abs(minor));

// ── o dublê da API Olinda: boletins reais (abertura e fechamento) de 15/09 a 16/10/2026, só dólar ─────────────────────
// [dia, abertura compra, abertura venda, hora, fechamento compra, fechamento venda, hora]
const BOLETINS = [
  ['2026-09-15', 5.141, 5.1416, '10:10:12', 5.1484, 5.149, '13:09:19'], ['2026-09-16', 5.1597, 5.1604, '10:05:14', 5.152, 5.1527, '13:05:30'],
  ['2026-09-17', 5.1336, 5.1342, '10:06:11', 5.1515, 5.1521, '13:03:21'], ['2026-09-18', 5.1441, 5.1447, '10:02:17', 5.1569, 5.1575, '13:03:34'],
  ['2026-09-21', 5.1105, 5.1111, '10:08:10', 5.1111, 5.1117, '13:06:51'], ['2026-09-22', 5.1233, 5.1239, '10:09:16', 5.1155, 5.1161, '13:03:30'],
  ['2026-09-23', 5.1316, 5.1322, '10:09:12', 5.1408, 5.1414, '13:04:22'], ['2026-09-24', 5.1676, 5.1682, '10:05:12', 5.1789, 5.1795, '13:03:18'],
  ['2026-09-25', 5.198, 5.1986, '10:09:12', 5.1985, 5.1991, '13:10:17'], ['2026-09-28', 5.2061, 5.2067, '10:11:15', 5.2126, 5.2132, '13:03:11'],
  ['2026-09-29', 5.2081, 5.2087, '10:09:19', 5.2198, 5.2204, '13:06:06'], ['2026-09-30', 5.1794, 5.18, '10:09:11', 5.1803, 5.1809, '13:11:44'],
  ['2026-10-01', 5.1857, 5.1863, '10:10:11', 5.2073, 5.2079, '13:10:35'], ['2026-10-02', 5.2078, 5.2084, '10:09:10', 5.2232, 5.2238, '13:03:16'],
  ['2026-10-05', 4.9888, 4.9894, '10:04:11', 4.9853, 4.9859, '13:07:36'], ['2026-10-06', 4.9573, 4.9579, '10:07:13', 4.9692, 4.9698, '13:03:21'],
  ['2026-10-07', 4.985, 4.9856, '10:07:14', 4.9929, 4.9935, '13:05:23'], ['2026-10-08', 5.0197, 5.0203, '10:03:11', 5.0113, 5.0119, '13:08:16'],
  ['2026-10-09', 5.0012, 5.0018, '10:10:14', 4.9886, 4.9892, '13:07:30'], ['2026-10-13', 5.0213, 5.0219, '10:07:12', 5.009, 5.0096, '13:04:26'],
  ['2026-10-14', 5.0456, 5.0462, '10:08:09', 5.0435, 5.0441, '13:05:17'], ['2026-10-15', 5.0595, 5.0601, '10:03:45', 5.0515, 5.0521, '13:05:33'],
  ['2026-10-16', 5.0764, 5.077, '10:08:09', 5.082, 5.0826, '13:04:14'],
];
function respostaOlinda(endereco) {
  const u = decodeURIComponent(endereco);
  const iso = m => (m ? `${m[3]}-${m[1]}-${m[2]}` : null);
  const ini = iso(/@dataInicial='(\d\d)-(\d\d)-(\d{4})'/.exec(u)), fim = iso(/@dataFinalCotacao='(\d\d)-(\d\d)-(\d{4})'/.exec(u));
  const moeda = (/@moeda='([A-Z]{3})'/.exec(u) || [])[1];
  const value = moeda !== 'USD' || !ini || !fim ? [] : BOLETINS.filter(([d]) => d >= ini && d <= fim).flatMap(([d, ac, av, ah, fc, fv, fh]) => [
    {cotacaoCompra: ac, cotacaoVenda: av, dataHoraCotacao: `${d} ${ah}.000`, tipoBoletim: 'Abertura'},
    {cotacaoCompra: fc, cotacaoVenda: fv, dataHoraCotacao: `${d} ${fh}.000`, tipoBoletim: 'Fechamento'}]);
  return JSON.stringify({'@odata.context': 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata$metadata#_CotacaoMoedaPeriodo', value});
}

const TELAS = {desktop: {width: 1280, height: 860}, celular: {width: 390, height: 844}};
async function abrir(rotulo, endereco, {tela = 'desktop', tema = 'claro', ptax = 'dubla'} = {}) {
  const contexto = await navegador.newContext({viewport: TELAS[tela], deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: tema === 'escuro' ? 'dark' : 'light', isMobile: tela === 'celular', hasTouch: tela === 'celular'});
  await contexto.addInitScript(t => { try { localStorage.setItem('orquestrator-financas.tema', t); } catch {} }, tema);
  const pedidos = [];
  await contexto.route('https://olinda.bcb.gov.br/**', rota => {
    pedidos.push(rota.request().url());
    if (ptax === 'bloqueada') return rota.abort('internetdisconnected');
    return rota.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: respostaOlinda(rota.request().url())});
  });
  const pagina = await contexto.newPage();
  pagina.on('pageerror', e => registro.erros.push({rotulo, tipo: 'pageerror', texto: String(e)}));
  pagina.on('console', m => {
    // com a rede bloqueada de propósito, o navegador anota a falha de rede do pedido ao BCB: não é erro de script
    if (ptax === 'bloqueada' && /^Failed to load resource/.test(m.text()) && /^https:\/\/olinda\.bcb\.gov\.br\//.test((m.location() || {}).url || '')) return;
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) registro.erros.push({rotulo, tipo: 'console.' + m.type(), texto: m.text()});
  });
  pagina.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === base.slice(0, -1)) registro.erros.push({rotulo, tipo: 'http.' + r.status(), texto: r.url()}); });
  await pagina.goto(base + endereco, {waitUntil: 'load'});
  await pagina.waitForSelector('#dashboard:not([hidden])', {timeout: 15000});
  return {contexto, pagina, pedidos};
}
async function foto(pagina, nome) {
  if (!FOTOS) return;
  await pagina.waitForTimeout(250);
  const arquivo = join(SAIDA, nome + '.png');
  await pagina.screenshot({path: arquivo, fullPage: false});
  registro.fotos.push(arquivo);
}
async function gravacaoLigada(pagina) {
  return pagina.waitForFunction(() => /Gravação ligada/.test((document.getElementById('lv-modo') || {}).textContent || ''), null, {timeout: 20000}).then(() => true).catch(() => false);
}
const irPara = async (pagina, chave) => { await pagina.evaluate(k => window.financeNavigate(k, false), chave); await pagina.evaluate(() => window.scrollTo(0, 0)); await pagina.waitForTimeout(250); };
// abre a folha pelo botão da barra de Lançamentos e espera a PTAX chegar (ou o aviso de que não veio)
async function abrirFolhaPelaBarra(pagina) {
  await irPara(pagina, 'lancamentos');
  await pagina.waitForSelector('#lancamentos-content .cc-abrir', {timeout: 10000});
  await pagina.click('#lancamentos-content .cc-abrir');
  await pagina.waitForSelector('dialog.sheet[open] .cc-raiz', {timeout: 5000});
  await esperarPtax(pagina);
}
const esperarPtax = pagina => pagina.waitForFunction(() => { const s = document.querySelector('dialog.sheet[open]'); return !s || !/consultando/i.test((s.querySelector('.cc-ptax-estado') || {}).textContent || ''); }, null, {timeout: 10000}).catch(() => null);
// o que a folha mostra, lido do DOM
const lerFolha = pagina => pagina.evaluate(() => {
  const s = document.querySelector('dialog.sheet[open]');
  if (!s) return null;
  const sel = [...s.querySelectorAll('.cc-seletores select')];
  const txt = n => (n ? n.textContent.replace(/\s+/g, ' ').trim() : null);
  const enviar = s.querySelector('.lv-dialogo-acoes button[type=submit]');
  return {mes: sel[0] ? sel[0].value : null, forma: sel[1] ? sel[1].value : null, pagador: sel[2] ? sel[2].value : null, pagadores: sel[2] ? [...sel[2].options].map(o => o.value) : [],
    itens: [...s.querySelectorAll('.cc-item')].map(li => ({id: li.dataset.gasto, marcado: li.querySelector('.cc-item-titulo input').checked, estimado: txt(li.querySelector('.cc-estimado')), ptax: txt(li.querySelector('.cc-ptax')),
      rateio: li.querySelector('.cc-rateio').hidden ? null : txt(li.querySelector('.cc-rateio')), delta: li.querySelector('.cc-delta').hidden ? null : txt(li.querySelector('.cc-delta')), conta: txt(li.querySelector('.cc-conta p'))})),
    resumo: txt(s.querySelector('.cc-resumo')), porque: txt(s.querySelector('.cc-porque-texto')), nota: [...s.querySelectorAll('.cc-porque .cc-nota')].map(txt), ptaxEstado: txt(s.querySelector('.cc-ptax-estado')),
    trava: txt(s.querySelector('.cc-trava')), vazio: txt(s.querySelector('.cc-vazio strong')), salvo: txt(s.querySelector('.cc-salvo-titulo')), spread: txt(s.querySelector('.cc-usar-spread')), spreadOk: txt(s.querySelector('.cc-spread-ok')),
    erro: s.querySelector('.lv-erro') && !s.querySelector('.lv-erro').hidden ? txt(s.querySelector('.lv-erro')) : null,
    enviar: enviar && !enviar.hidden ? txt(enviar) : null, larguras: {folha: s.scrollWidth, caixa: s.clientWidth, doc: document.documentElement.scrollWidth, janela: window.innerWidth}};
});
const rolarFolha = (pagina, onde) => pagina.evaluate(o => { const s = document.querySelector('dialog.sheet[open]'); if (s) s.scrollTop = o === 'fim' ? s.scrollHeight : 0; }, onde);
// a conta da página: as estimativas do razão e o spread do contas.js, com a PTAX do dublê (a mesma que a folha leu)
const contaNaPagina = (pagina, ids, faturas) => pagina.evaluate(async ({ids, faturas}) => {
  const L = await import('/livro.js'), R = await import('/razao.js'), C = await import('/contas.js');
  const D = L.dados();
  const gastos = ids.map(id => D.aplicado.gastos.find(g => g.id === id));
  const est = gastos.map(g => R.reaisDoGasto({...g, faturaBrlMinor: null}, C.listaDoMes(D.aplicado, D.lista, g.competencia)).brl);
  return {est, versoes: gastos.map(g => g.versao), faturas: gastos.map(g => g.faturaBrlMinor), antes: gastos.map(g => (g.versoes.length ? g.versoes[g.versoes.length - 1].antes.faturaBrlMinor : 'sem versão'))};
}, {ids, faturas});

// ══ 1 · ?demo=1 ═════════════════════════════════════════════════════════════════════════════════════════════════
const DEMO = ['demo-vercel-2026-10', 'demo-api-2026-10'];
for (const tela of ['desktop', 'celular']) for (const tema of ['claro', 'escuro']) {
  const corte = `${tela}-${tema}`;
  const p = passo(`?demo=1 · ${corte}: a folha de outubro, a PTAX do dia e a conta`);
  const {contexto, pagina, pedidos} = await abrir(p, '?demo=1#lancamentos', {tela, tema});
  await abrirFolhaPelaBarra(pagina);
  let f = await lerFolha(pagina);
  certo(p, f && f.mes === '2026-10' && f.forma === 'cartao_pj', `a folha devia abrir em outubro, no cartão da empresa (abriu ${f && f.mes} · ${f && f.forma})`);
  certo(p, JSON.stringify(f.itens.map(i => i.id)) === JSON.stringify(DEMO), `os gastos em dólar de outubro deviam ser ${DEMO.join(', ')} (vieram ${f.itens.map(i => i.id).join(', ')})`);
  certo(p, f.itens.every(i => i.marcado), 'os gastos sem fatura deviam vir marcados');
  const conta = await contaNaPagina(pagina, DEMO);
  // à mão: US$ 20,00 × 5,0826 = 101,652 → × 1,04 × 1,035 = 109,4185 → R$ 109,42; US$ 100,00 → 547,0921 → R$ 547,09
  certo(p, JSON.stringify(conta.est) === '[10942,54709]', `a estimativa do razão devia ser R$ 109,42 e R$ 547,09 (deu ${conta.est})`);
  f.itens.forEach((it, k) => certo(p, it.estimado === `≈ ${real(conta.est[k])} estimado`, `${it.id}: a folha diz “${it.estimado}”, o razão ${real(conta.est[k])}`));
  certo(p, f.itens[1].conta === 'US$ 100,00 × 5,0826 (PTAX venda BCB, 30/09/2026 (exemplo)) = R$ 508,26 + spread 4% R$ 20,33 + IOF 3,5% R$ 18,50 = R$ 547,09', `a conta da estimativa da Anthropic: ${f.itens[1].conta}`);
  certo(p, f.itens[0].ptax === 'PTAX de 05/10: 4,9859' && f.itens[1].ptax === 'PTAX de 14/10: 5,0441', `a PTAX do dia de cada compra (boletim de fechamento): ${f.itens.map(i => i.ptax).join(' · ')}`);
  certo(p, pedidos.length === 1, `uma consulta só ao Banco Central para o período (foram ${pedidos.length})`);
  certo(p, f.resumo === 'Estimado R$ 656,51 → falta o valor de 2 gastos', `resumo antes de digitar: ${f.resumo}`);
  certo(p, f.enviar === 'Conciliar a fatura', `o botão de gravar devia ser “Conciliar a fatura” (é ${f.enviar})`);
  await foto(pagina, `demo-${corte}-folha-aberta`);
  // a fatura chegou: R$ 109,42 (bateu) e R$ 549,80 (+R$ 2,71)
  await pagina.fill('dialog.sheet .cc-item[data-gasto="demo-vercel-2026-10"] .lv-dinheiro-valor', '109,42');
  await pagina.fill('dialog.sheet .cc-item[data-gasto="demo-api-2026-10"] .lv-dinheiro-valor', '549,80');
  f = await lerFolha(pagina);
  certo(p, f.resumo === 'Estimado R$ 656,51 → fatura R$ 659,22 · diferença +R$ 2,71', `resumo com a fatura: ${f.resumo}`);
  certo(p, f.itens[0].delta === 'diferença R$ 0,00' && f.itens[1].delta === 'diferença +R$ 2,71', `a diferença de cada gasto: ${f.itens.map(i => i.delta).join(' · ')}`);
  // o spread que saiu: fatura ÷ Σ(valor × PTAX do dia × 1,035) − 1, com a conta do contas.js; à mão: 65922 ÷ (10321 + 52206) − 1 = 5,43%
  const spread = await pagina.evaluate(async () => {
    const R = await import('/razao.js'), C = await import('/contas.js');
    const base = R.converter(2000, '4.9859', '0', '3.50').total + R.converter(10000, '5.0441', '0', '3.50').total;
    return {base, spread: C.spreadImplicito(10942 + 54980, base, '1', '0')};
  });
  certo(p, spread.base === 62527 && spread.spread === '5.43', `a conta do spread à mão (62.527 e 5,43%) não bate com o contas.js: ${JSON.stringify(spread)}`);
  certo(p, f.porque === 'A PTAX de 05/10 era 4,9859 e a de 14/10 era 5,0441; o banco cobra a PTAX + o spread do cartão + o IOF de 3,5%. Nesta fatura o spread saiu 5,43%.', `explicação: ${f.porque}`);
  certo(p, f.nota.includes('A estimativa usava o dólar de 5,0826 dos Parâmetros (de 01/10) e um spread de 4%.'), `a nota da estimativa: ${f.nota.join(' | ')}`);
  certo(p, f.larguras.folha <= f.larguras.caixa + 1 && f.larguras.doc <= f.larguras.janela, `rolagem horizontal: ${JSON.stringify(f.larguras)}`);
  await rolarFolha(pagina, 'fim');
  await foto(pagina, `demo-${corte}-folha-preenchida`);
  // só o total: o mesmo R$ 659,22 dividido pela estimativa (maior resto): R$ 109,87 + R$ 549,35
  await pagina.check('dialog.sheet .cc-modo input[value="total"]');
  await pagina.fill('dialog.sheet .cc-total .lv-dinheiro-valor', '659,22');
  f = await lerFolha(pagina);
  const rateio = await pagina.evaluate(async () => (await import('/contas.js')).ratearFatura(65922, [{id: 'v', peso: 10942}, {id: 'a', peso: 54709}]).map(x => x.faturaBrlMinor));
  certo(p, JSON.stringify(rateio) === '[10987,54935]' && rateio[0] + rateio[1] === 65922, `rateio à mão (10.987 + 54.935 = 65.922) ≠ contas.ratearFatura: ${rateio}`);
  certo(p, f.itens[0].rateio === `fatura ${real(rateio[0])} pelo rateio` && f.itens[1].rateio === `fatura ${real(rateio[1])} pelo rateio`, `o rateio na folha: ${f.itens.map(i => i.rateio).join(' · ')}`);
  certo(p, f.resumo === 'Estimado R$ 656,51 → fatura R$ 659,22 · diferença +R$ 2,71', `resumo pelo total: ${f.resumo}`);
  await pagina.check('dialog.sheet .cc-modo input[value="itens"]');
  f = await lerFolha(pagina);
  certo(p, f.itens[1].rateio === null && f.resumo.endsWith('diferença +R$ 2,71'), 'voltar a "Item a item" devia manter os valores digitados');
  if (corte === 'desktop-claro') {
    // a soma dos itens é sempre o total digitado: 3.000 casos sorteados no mesmo dividirTotal que a folha usa
    const prop = await pagina.evaluate(async () => {
      const {dividirTotal} = await import('/conciliacao.js');
      let semente = 20261019;
      const sorte = n => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente % n; };
      let casos = 0, ruins = [];
      for (let k = 0; k < 3000; k++) {
        const n = 1 + sorte(8), itens = [];
        for (let j = 0; j < n; j++) itens.push({id: 'g' + j, moeda: sorte(4) ? 'USD' : 'USD', valorMinor: 1 + sorte(5000000), est: sorte(10) ? 1 + sorte(30000000) : null});
        const total = n + sorte(40000000);
        const r = dividirTotal(total, itens);
        if (r.erro) continue;
        casos++;
        const soma = [...r.faturas.values()].reduce((a, b) => a + b, 0);
        if (soma !== total || r.faturas.size !== n || [...r.faturas.values()].some(v => !Number.isSafeInteger(v) || v < 1)) ruins.push({total, soma, n});
      }
      return {casos, ruins: ruins.slice(0, 3)};
    });
    certo(p, prop.casos > 2500 && !prop.ruins.length, `a soma das partes devia ser sempre o total: ${JSON.stringify(prop)}`);
    registro.conferencias.push({passo: p, propriedade: prop});
  }

  if (corte === 'desktop-claro' || corte === 'celular-escuro') {
    const q = passo(`?demo=1 · ${corte}: conciliar (treino), o spread a partir de 01/11, o Livro e o Histórico`);
    await pagina.click('dialog.sheet .lv-dialogo-acoes button[type=submit]');
    await pagina.waitForSelector('dialog.sheet[open] .cc-salvo', {timeout: 5000}).catch(() => null);
    f = await lerFolha(pagina);
    certo(q, f.salvo === 'Fatura conciliada (modo treino)', `depois de gravar, a folha devia dizer que conciliou (diz ${f.salvo}; erro ${f.erro})`);
    certo(q, f.resumo === 'Estimado R$ 656,51 → fatura R$ 659,22 · diferença +R$ 2,71', `resumo do que entrou: ${f.resumo}`);
    certo(q, f.spread === 'Usar 5,43% como spread a partir de 01/11', `a oferta do spread: ${f.spread}`);
    certo(q, f.enviar === 'Pronto', `o botão devia virar “Pronto” (é ${f.enviar})`);
    const depois = await contaNaPagina(pagina, DEMO);
    certo(q, JSON.stringify(depois.faturas) === '[10942,54980]', `as faturas gravadas: ${depois.faturas}`);
    certo(q, JSON.stringify(depois.versoes) === '[2,2]' && JSON.stringify(depois.antes) === '[null,null]', `conciliar não apaga a estimativa: a versão anterior fica guardada (versões ${depois.versoes}, antes ${depois.antes})`);
    certo(q, JSON.stringify(depois.est) === '[10942,54709]', 'a estimativa continua calculável depois de conciliar');
    await rolarFolha(pagina, 'fim');
    await foto(pagina, `demo-${corte}-folha-conciliada`);
    await pagina.click('dialog.sheet .cc-usar-spread');
    await pagina.waitForSelector('dialog.sheet .cc-spread-ok', {timeout: 5000}).catch(() => null);
    f = await lerFolha(pagina);
    certo(q, f.spreadOk && f.spreadOk.startsWith('Spread de 5,43% salvo a partir de 01/11'), `o spread devia ter sido salvo (veio ${f.spreadOk}; erro ${f.erro})`);
    const param = await pagina.evaluate(async () => { const L = await import('/livro.js'); const p = L.dados().lista.filter(x => x.chave === 'cartao.spread_pct').pop(); return {valor: p.valor, desde: p.desde, fonte: p.fonte, estado: p.estado}; });
    certo(q, JSON.stringify(param) === JSON.stringify({valor: '5.43', desde: '2026-11-01', fonte: 'fatura de outubro de 2026', estado: 'vigente'}), `o parâmetro do spread: ${JSON.stringify(param)}`);
    await pagina.click('dialog.sheet .lv-dialogo-acoes button[type=submit]');   // Pronto
    await pagina.waitForTimeout(250);
    const fechou = await pagina.evaluate(() => ({aberta: !!document.querySelector('dialog.sheet[open]'), foco: document.activeElement && document.activeElement.matches('.cc-abrir'),
      cartao: [...document.querySelectorAll('#lancamentos-content .lv-gasto')].filter(a => a.dataset.gasto === 'demo-api-2026-10').map(a => a.querySelector('.lv-gasto-valor').textContent.replace(/\s+/g, ' ').trim())[0]}));
    certo(q, !fechou.aberta, 'o Pronto devia fechar a folha');
    if (tela === 'desktop') certo(q, fechou.foco, 'o foco devia voltar ao botão “Conciliar fatura”');
    certo(q, fechou.cartao === 'US$ 100,00≈ R$ 549,80 · fatura', `Lançamentos devia mostrar a fatura no cartão da Anthropic (mostra ${fechou.cartao})`);
    // o Livro do mês de outubro troca "estimado" por "fatura" nos dois gastos
    await irPara(pagina, 'livro');
    const livro = await pagina.evaluate(() => {
      return [...document.querySelectorAll('#livro-content .lv-livro-linha:not(.is-anulado)')].map(b => ({desc: b.querySelector('.lv-livro-desc').textContent, pilula: b.querySelector('.lv-pilula').textContent, valor: b.querySelector('.lv-livro-fim strong').textContent.replace(/\s+/g, ' ')}))
        .filter(x => /Vercel · Pro|Anthropic API/.test(x.desc));
    });
    certo(q, livro.length === 2 && livro.every(x => x.pilula === 'fatura'), `o Livro do mês devia dizer “fatura” nos dois gastos: ${JSON.stringify(livro)}`);
    certo(q, livro.some(x => x.valor === 'R$ 549,80'), 'o Livro do mês devia somar o valor da fatura da Anthropic');
    // o Histórico: 1 registro de outubro, com o Δ e com quem conciliou
    await irPara(pagina, 'historico');
    const hist = await pagina.evaluate(() => [...document.querySelectorAll('#historico-content .lv-hist-item')].map(li => li.textContent.replace(/\s+/g, ' ')).filter(t => /Fatura de outubro de 2026/.test(t)));
    certo(q, hist.length === 1, `o Histórico devia ter 1 registro da fatura de outubro (tem ${hist.length})`);
    certo(q, hist[0] && hist[0].includes('conciliou a fatura') && hist[0].includes('estimado R$ 656,51 → fatura R$ 659,22 · diferença +R$ 2,71'), `o registro do Histórico: ${hist[0]}`);
    await foto(pagina, `demo-${corte}-historico`);
    await irPara(pagina, 'lancamentos');
  }

  // setembro está fechado: a folha mostra o cadeado e não oferece gravar; o razão recusa com o motivo
  const r = passo(`?demo=1 · ${corte}: setembro fechado`);
  await pagina.evaluate(() => window.financeConciliacao.abrir('2026-09', 'cartao_pj'));
  await pagina.waitForSelector('dialog.sheet[open] .cc-trava', {timeout: 5000}).catch(() => null);
  f = await lerFolha(pagina);
  certo(r, f && f.trava === 'Setembro está fechado: a responsável reabre, com motivo, se a fatura chegou depois.', `a nota do mês fechado: ${f && f.trava}`);
  certo(r, f && f.enviar === null, 'mês fechado não devia oferecer “Conciliar a fatura”');
  const recusa = await pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const g = L.dados().aplicado.gastos.find(x => x.id === 'demo-api-2026-09');
    return L.gravar({acao: 'reconcile_statement', alvo: '2026-09:cartao_pj', dados: {mes: '2026-09', forma: 'cartao_pj', totalFaturaMinor: null, itens: [{alvo: g.id, versao: g.versao, faturaBrlMinor: 46000}]}}, 'x', {erroNoFormulario: true});
  });
  certo(r, !recusa.ok && recusa.codigo === 'mes_fechado' && recusa.erro === 'Setembro de 2026 está fechado. A responsável reabre, com motivo, se precisar mudar.', `o razão devia recusar setembro com o motivo: ${JSON.stringify(recusa)}`);
  await foto(pagina, `demo-${corte}-folha-mes-fechado`);
  await contexto.close();
}

// ══ 2 · ?diario=local: gravação de verdade ═════════════════════════════════════════════════════════════════════════
const local = membro => `?diario=local&membro=${membro}`;
const lancar = (pagina, lista) => pagina.evaluate(async lista => {
  const L = await import('/livro.js');
  for (const [alvo, d] of lista) {
    const r = await L.gravar(alvo.startsWith('fx:') ? {acao: 'set_parameter', alvo: 'fx.USD_BRL', dados: d} : {acao: 'add_expense', alvo, dados: {competencia: d.data.slice(0, 7), moeda: 'USD', pagoPor: L.dados().c.membro.id, ...d}}, 'Gravado.');
    if (!r.ok) return `${alvo}: ${r.erro}`;
  }
  return null;
}, lista);
const LOCAL = ['g-cc-vercel', 'g-cc-fonte', 'g-cc-api'];   // na ordem da data: 05/10, 11/10 (domingo), 14/10
{
  const p = passo('?diario=local · preparo: o dólar de setembro e de outubro, cinco gastos em dólar e setembro fechado');
  {
    const {contexto, pagina} = await abrir(p, local('m-ana') + '#lancamentos');
    certo(p, await gravacaoLigada(pagina), 'a gravação não ligou para a Ana');
    const erro = await lancar(pagina, [['g-cc-ana-pessoal', {data: '2026-10-09', descricao: 'Notion · Plus', categoria: 'software_ia', valorMinor: 1000, forma: 'cartao_pessoal', destino: 'empresa_reembolsa'}]]);
    certo(p, !erro, `a Ana não conseguiu lançar: ${erro}`);
    await contexto.close();
  }
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#lancamentos');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou para o Bauer');
  const erro = await lancar(pagina, [
    ['fx:1', {chave: 'fx.USD_BRL', valor: '5.1575', desde: '2026-09-18', fonte: 'PTAX venda BCB, 18/09/2026', estado: 'vigente'}],
    ['fx:2', {chave: 'fx.USD_BRL', valor: '5.2079', desde: '2026-10-01', fonte: 'PTAX venda BCB, 01/10/2026', estado: 'vigente'}],
    ['g-cc-setembro', {data: '2026-09-21', descricao: 'Anthropic API · créditos', categoria: 'software_ia', valorMinor: 5000, forma: 'cartao_pj'}],
    ['g-cc-api', {data: '2026-10-14', descricao: 'Anthropic API · créditos', categoria: 'software_ia', valorMinor: 10000, forma: 'cartao_pj'}],
    ['g-cc-vercel', {data: '2026-10-05', descricao: 'Vercel · Pro', categoria: 'infraestrutura', valorMinor: 2000, forma: 'cartao_pj'}],
    ['g-cc-fonte', {data: '2026-10-11', descricao: 'Fonte tipográfica · licença', categoria: 'software_ia', valorMinor: 1234, forma: 'cartao_pj'}],
    ['g-cc-bauer-pessoal', {data: '2026-10-08', descricao: 'Figma · Professional', categoria: 'software_ia', valorMinor: 1500, forma: 'cartao_pessoal', destino: 'empresa_reembolsa'}],
  ]);
  certo(p, !erro, `o Bauer não conseguiu preparar: ${erro}`);
  const fechou = await pagina.evaluate(async () => {
    const L = await import('/livro.js'), C = await import('/contas.js');
    const D = L.dados();
    const foto = C.fotoDoMes(D.c.estado, D.aplicado, '2026-09', D.d.cabeca), t = foto.totais;
    const r = await L.gravar({acao: 'close_month', alvo: '2026-09', dados: {cabeca: D.d.cabeca, selo: C.seloDoMes(foto), totais: {realizado: t.realizado, previsto: t.previsto, total: t.total, resultado: t.resultado}}}, 'Setembro fechado.');
    return r.ok ? null : r.erro;
  });
  certo(p, !fechou, `o Bauer não conseguiu fechar setembro: ${fechou}`);

  const q = passo('?diario=local · conciliar outubro pelo total: cada gasto ganha a parte do rateio e a soma fecha ao centavo');
  await abrirFolhaPelaBarra(pagina);
  let f = await lerFolha(pagina);
  certo(q, f.mes === '2026-10' && f.forma === 'cartao_pj' && JSON.stringify(f.itens.map(i => i.id)) === JSON.stringify(LOCAL), `a folha devia abrir em outubro no cartão da empresa com ${LOCAL.join(', ')} (abriu ${f.mes} · ${f.forma} · ${f.itens.map(i => i.id).join(', ')})`);
  certo(q, f.itens[1].ptax === 'PTAX de 09/10 (último dia útil antes da compra): 4,9892', `compra num domingo usa a PTAX do último dia útil antes: ${f.itens[1].ptax}`);
  const conta = await contaNaPagina(pagina, LOCAL);
  // à mão, com o dólar de 5,2079, spread 4% e IOF 3,5%: 2000 → 11.211,57 → 11.212; 1234 → 6.917,54 → 6.918; 10000 → 56.057,84 → 56.058
  certo(q, JSON.stringify(conta.est) === '[11212,6918,56058]', `estimativas à mão ≠ razão: ${conta.est}`);
  const TOTAL = 74567;   // R$ 745,67 na fatura; Σ estimado = 74.188
  await pagina.check('dialog.sheet .cc-modo input[value="total"]');
  await pagina.fill('dialog.sheet .cc-total .lv-dinheiro-valor', '745,67');
  const esperado = await pagina.evaluate(async ({est, total}) => (await import('/contas.js')).ratearFatura(total, est.map((peso, k) => ({id: String(k), peso}))).map(x => x.faturaBrlMinor), {est: conta.est, total: TOTAL});
  f = await lerFolha(pagina);
  certo(q, esperado.reduce((a, b) => a + b, 0) === TOTAL, `o rateio do contas.js não fecha: ${esperado}`);
  f.itens.forEach((it, k) => certo(q, it.rateio === `fatura ${real(esperado[k])} pelo rateio`, `${it.id}: rateio na folha ${it.rateio}, contas.ratearFatura ${real(esperado[k])}`));
  const delta = TOTAL - conta.est.reduce((a, b) => a + b, 0);
  certo(q, f.resumo === `Estimado ${real(74188)} → fatura ${real(TOTAL)} · diferença ${comSinal(delta)}`, `resumo: ${f.resumo}`);
  certo(q, /^A PTAX de 05\/10 era 4,9859, a de 09\/10 \(último dia útil antes da compra de 11\/10\) era 4,9892 e a de 14\/10 era 5,0441; o banco cobra a PTAX \+ o spread do cartão \+ o IOF de 3,5%\. Nesta fatura o spread saiu \d+,\d+%\.$/.test(f.porque), `explicação com a PTAX real de cada dia: ${f.porque}`);
  await pagina.click('dialog.sheet .lv-dialogo-acoes button[type=submit]');
  await pagina.waitForSelector('dialog.sheet[open] .cc-salvo', {timeout: 8000}).catch(() => null);
  f = await lerFolha(pagina);
  certo(q, f.salvo === 'Fatura conciliada', `a folha devia dizer “Fatura conciliada” (diz ${f.salvo}; erro ${f.erro})`);
  const gravado = await pagina.evaluate(async ids => {
    const L = await import('/livro.js');
    const D = L.dados(), ev = D.d.eventos[D.d.eventos.length - 1];
    return {modo: D.d.modo, treino: !!ev.treino, acao: ev.conteudo.acao, total: ev.conteudo.dados.totalFaturaMinor, itens: ev.conteudo.dados.itens.map(i => [i.alvo, i.faturaBrlMinor]), faturas: ids.map(id => D.aplicado.gastos.find(g => g.id === id).faturaBrlMinor)};
  }, LOCAL);
  certo(q, gravado.modo === 'gravacao' && !gravado.treino && gravado.acao === 'reconcile_statement', `o evento devia ir ao servidor do diário: ${JSON.stringify(gravado)}`);
  certo(q, gravado.total === TOTAL && JSON.stringify(gravado.faturas) === JSON.stringify(esperado) && gravado.faturas.reduce((a, b) => a + b, 0) === TOTAL, `cada item ganha a parte do rateio e a soma fecha ao centavo: ${JSON.stringify(gravado)}`);
  const ofertado = f.spread;
  certo(q, /^Usar \d+,\d+% como spread a partir de 01\/11$/.test(ofertado || ''), `a oferta do spread: ${ofertado}`);
  await pagina.click('dialog.sheet .cc-usar-spread');
  await pagina.waitForSelector('dialog.sheet .cc-spread-ok', {timeout: 8000}).catch(() => null);
  await foto(pagina, 'local-desktop-claro-conciliada');
  await pagina.click('dialog.sheet .lv-dialogo-acoes button[type=submit]');
  await contexto.close();

  const r = passo('?diario=local · depois de recarregar: a fatura, o Livro do mês, o Histórico e o spread vieram do servidor');
  const outra = await abrir(r, local('m-bauer') + '#livro/2026-10');
  certo(r, await gravacaoLigada(outra.pagina), 'a gravação não ligou ao recarregar');
  await outra.pagina.waitForTimeout(300);
  const volta = await outra.pagina.evaluate(async ids => {
    const L = await import('/livro.js');
    const D = L.dados();
    const C = await import('/contas.js');
    const sp = D.lista.filter(x => x.chave === 'cartao.spread_pct').pop();
    const linhas = [...document.querySelectorAll('#livro-content .lv-livro-linha:not(.is-previsto):not(.is-anulado)')].map(b => ({desc: b.querySelector('.lv-livro-desc').textContent, pilula: b.querySelector('.lv-pilula').textContent}));
    return {faturas: ids.map(id => D.aplicado.gastos.find(g => g.id === id).faturaBrlMinor), spread: {valor: sp.valor, desde: sp.desde, fonte: sp.fonte, texto: C.textoPct(sp.valor)}, linhas};
  }, LOCAL);
  certo(r, JSON.stringify(volta.faturas) === JSON.stringify(esperado), `as faturas não voltaram do servidor: ${volta.faturas}`);
  certo(r, volta.spread.desde === '2026-11-01' && volta.spread.fonte === 'fatura de outubro de 2026' && ofertado === `Usar ${volta.spread.texto} como spread a partir de 01/11`, `o spread salvo: ${JSON.stringify(volta.spread)}`);
  const doLivro = volta.linhas.filter(x => /Vercel|Fonte|Anthropic/.test(x.desc));
  certo(r, doLivro.length === 3 && doLivro.every(x => x.pilula === 'fatura'), `o Livro do mês devia dizer “fatura” nos três: ${JSON.stringify(doLivro)}`);
  certo(r, volta.linhas.some(x => /Figma/.test(x.desc) && x.pilula === 'estimado'), 'o gasto do cartão pessoal (outra fatura) continua estimado');
  await irPara(outra.pagina, 'historico');
  const hist = await outra.pagina.evaluate(() => [...document.querySelectorAll('#historico-content .lv-hist-item')].map(li => li.textContent.replace(/\s+/g, ' ')).filter(t => /conciliou a fatura/.test(t)));
  certo(r, hist.length === 1 && hist[0].includes(`Fatura de outubro de 2026 (Cartão da empresa): estimado ${real(74188)} → fatura ${real(TOTAL)} · diferença ${comSinal(delta)}`), `o Histórico devia ter 1 registro com o Δ: ${JSON.stringify(hist)}`);

  const s = passo('?diario=local · cartão pessoal: só os gastos de quem pagou; setembro fechado recusa com o motivo');
  await abrirFolhaPelaBarra(outra.pagina);
  await outra.pagina.selectOption('dialog.sheet .cc-seletores select >> nth=1', 'cartao_pessoal');
  await esperarPtax(outra.pagina);
  f = await lerFolha(outra.pagina);
  certo(s, f.forma === 'cartao_pessoal' && f.pagador === 'm-bauer' && JSON.stringify(f.itens.map(i => i.id)) === '["g-cc-bauer-pessoal"]', `o cartão pessoal do Bauer devia ter só o Figma: ${f.pagador} · ${f.itens.map(i => i.id)}`);
  certo(s, JSON.stringify(f.pagadores) === '["m-bauer","m-ana"]', `“De quem é o cartão” devia listar o Bauer e a Ana: ${f.pagadores}`);
  await outra.pagina.selectOption('dialog.sheet .cc-seletores select >> nth=2', 'm-ana');
  f = await lerFolha(outra.pagina);
  certo(s, JSON.stringify(f.itens.map(i => i.id)) === '["g-cc-ana-pessoal"]', `o cartão pessoal da Ana devia ter só o Notion: ${f.itens.map(i => i.id)}`);
  await foto(outra.pagina, 'local-desktop-claro-cartao-pessoal');
  // de volta ao cartão da empresa: os três já conciliados vêm desmarcados, com a estimativa e a fatura lado a lado
  await outra.pagina.selectOption('dialog.sheet .cc-seletores select >> nth=1', 'cartao_pj');
  f = await lerFolha(outra.pagina);
  certo(s, f.itens.length === 3 && f.itens.every(i => !i.marcado) && f.resumo === 'Todos estes gastos já têm o valor da fatura. Para corrigir um, marque-o e digite o valor certo.', `reabrir a fatura conciliada: ${JSON.stringify(f.itens.map(i => [i.id, i.marcado]))} · ${f.resumo}`);
  certo(s, f.itens.every((i, k) => i.estimado === `≈ ${real(conta.est[k])} estimado`), 'a estimativa de antes continua à mostra ao lado da fatura');
  await outra.pagina.evaluate(() => window.financeConciliacao.abrir('2026-09', 'cartao_pj'));
  await outra.pagina.waitForSelector('dialog.sheet[open] .cc-trava', {timeout: 5000}).catch(() => null);
  f = await lerFolha(outra.pagina);
  certo(s, f.trava === 'Setembro está fechado: a responsável reabre, com motivo, se a fatura chegou depois.' && f.enviar === null, `setembro fechado: ${f.trava} · botão ${f.enviar}`);
  const recusa = await outra.pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const g = L.dados().aplicado.gastos.find(x => x.id === 'g-cc-setembro');
    return L.gravar({acao: 'reconcile_statement', alvo: '2026-09:cartao_pj', dados: {mes: '2026-09', forma: 'cartao_pj', totalFaturaMinor: 27000, itens: [{alvo: g.id, versao: g.versao, faturaBrlMinor: 27000}]}}, 'x', {erroNoFormulario: true});
  });
  certo(s, !recusa.ok && recusa.codigo === 'mes_fechado' && recusa.erro === 'Setembro de 2026 está fechado. A responsável reabre, com motivo, se precisar mudar.', `o razão devia recusar setembro: ${JSON.stringify(recusa)}`);
  await outra.contexto.close();
}

// ══ 3 · PTAX indisponível: a rede para o Banco Central bloqueada ═══════════════════════════════════════════════════════
{
  // no desktop: a 390px com a gravação ligada, o cabeçalho ("Gravação ligada · hh:mm") passa da largura e o celular
  // reduz o zoom da página inteira (problema do cabeçalho, anotado para o livro.js); o celular sem PTAX vai em 3b
  const p = passo('PTAX indisponível (?diario=local): a folha avisa e concilia mesmo assim, sem oferecer spread');
  const {contexto, pagina, pedidos} = await abrir(p, local('m-bauer') + '#lancamentos', {tela: 'desktop', tema: 'escuro', ptax: 'bloqueada'});
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.evaluate(() => window.financeConciliacao.abrir('2026-10', 'cartao_pessoal'));
  await pagina.waitForSelector('dialog.sheet[open] .cc-raiz', {timeout: 5000});
  await esperarPtax(pagina);
  let f = await lerFolha(pagina);
  certo(p, pedidos.length >= 1, 'a folha devia ter tentado o Banco Central');
  certo(p, f.ptaxEstado === 'Não foi possível consultar o Banco Central agora; a conciliação funciona sem ela.', `o aviso sem a PTAX: ${f.ptaxEstado}`);
  certo(p, f.itens.length === 1 && f.itens[0].ptax === 'PTAX indisponível agora.', `o gasto sem PTAX: ${JSON.stringify(f.itens)}`);
  await pagina.fill('dialog.sheet .cc-item[data-gasto="g-cc-bauer-pessoal"] .lv-dinheiro-valor', '82,10');
  f = await lerFolha(pagina);
  certo(p, f.porque && !/PTAX[^.]*\d,\d{4}/.test(f.porque) && f.porque.startsWith('O banco cobra a PTAX + o spread do cartão + o IOF de 3,5%.'), `sem a PTAX, a explicação não inventa número de PTAX: ${f.porque}`);
  await foto(pagina, 'ptax-indisponivel-desktop-escuro-folha');
  await pagina.click('dialog.sheet .lv-dialogo-acoes button[type=submit]');
  await pagina.waitForSelector('dialog.sheet[open] .cc-salvo', {timeout: 8000}).catch(() => null);
  f = await lerFolha(pagina);
  certo(p, f.salvo === 'Fatura conciliada' && f.spread === null, `conciliou sem a PTAX e sem oferta de spread: ${f.salvo} · ${f.spread} · erro ${f.erro}`);
  const fat = await pagina.evaluate(async () => { const L = await import('/livro.js'); return L.dados().aplicado.gastos.find(g => g.id === 'g-cc-bauer-pessoal').faturaBrlMinor; });
  certo(p, fat === 8210, `a fatura do cartão pessoal devia ser R$ 82,10 (é ${fat})`);
  await rolarFolha(pagina, 'fim');
  await foto(pagina, 'ptax-indisponivel-desktop-escuro-conciliada');
  await contexto.close();
}
{
  const p = passo('PTAX indisponível (?demo=1, celular claro): o aviso, o gasto sem PTAX e a explicação sem número de PTAX');
  const {contexto, pagina} = await abrir(p, '?demo=1#lancamentos', {tela: 'celular', tema: 'claro', ptax: 'bloqueada'});
  await abrirFolhaPelaBarra(pagina);
  let f = await lerFolha(pagina);
  certo(p, f.ptaxEstado === 'Não foi possível consultar o Banco Central agora; a conciliação funciona sem ela.' && f.itens.every(i => i.ptax === 'PTAX indisponível agora.'), `o aviso sem a PTAX: ${f.ptaxEstado} · ${f.itens.map(i => i.ptax)}`);
  await pagina.fill('dialog.sheet .cc-item[data-gasto="demo-vercel-2026-10"] .lv-dinheiro-valor', '109,42');
  await pagina.fill('dialog.sheet .cc-item[data-gasto="demo-api-2026-10"] .lv-dinheiro-valor', '549,80');
  f = await lerFolha(pagina);
  certo(p, f.resumo === 'Estimado R$ 656,51 → fatura R$ 659,22 · diferença +R$ 2,71' && f.porque && f.porque.startsWith('O banco cobra a PTAX + o spread do cartão + o IOF de 3,5%.'), `sem a PTAX o resto continua: ${f.resumo} · ${f.porque}`);
  certo(p, f.larguras.folha <= f.larguras.caixa + 1 && f.larguras.doc <= f.larguras.janela, `rolagem horizontal: ${JSON.stringify(f.larguras)}`);
  await rolarFolha(pagina, 'fim');
  await foto(pagina, 'ptax-indisponivel-celular-claro-folha');
  await contexto.close();
}

await navegador.close();
servidor.close();
for (const e of registro.erros) falha('erros da página', `${e.rotulo} · ${e.tipo} · ${e.texto}`);
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`\n${registro.passos.length} passos · ${registro.fotos.length} fotos em ${SAIDA} · ${registro.falhas.length} falha(s)`);
if (registro.falhas.length) process.exitCode = 1;
