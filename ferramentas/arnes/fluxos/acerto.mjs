// Fluxo da fatia F2-6 (acerto, reembolso e aporte). Duas partes:
//  1. ?demo=1, como m-bauer e como m-ana nos 4 cortes (claro/escuro, 1280×860/390×844): Sociedade e Meu painel
//     fotografados; os números da tela batem com contas.acertoAcumulado (calculado na própria página, com o mesmo diário)
//     e com o "Ver a conta"; os saldos somam zero; cada sócia só vê os botões que pode usar; o Livro do mês mostra o
//     mesmo acerto da Sociedade; Lançamentos não oferece mais "Marcar reembolsado"; nada rola de lado a 390px.
//  2. ?diario=local (servidor do diário de verdade, em memória), trocando de sócia por ?membro=: Ana registra o Pix de
//     R$ 135,00 para o Bauer (pelo teclado) → o saldo dela vai a zero e o Bauer vê "Recebi"; o Bauer confirma; o Bauer
//     reembolsa o domínio da Ana a partir de Lançamentos → "a empresa te deve" dela zera; a Beatriz converte um
//     reembolso em aporte. O toast é anunciado (role=status) e o foco volta a um lugar útil depois de cada ação. Por
//     fim, um gasto em dólar de setembro (mês fechado) com uma vigência nova do dólar depois do fechamento: a folha do
//     reembolso propõe o mesmo valor da Sociedade (parâmetros do fechamento) e o razão aceita.
// Sai com código 1 em qualquer falha, erro de script ou violação de CSP (o registro fica em <saida>/registro.json).
// Uso: node ferramentas/arnes/fluxos/acerto.mjs [--saida DIR] [--porta 8794] [--site DIR] [--sem-fotos]
import {pathToFileURL, fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'fluxo-acerto')));
const PORTA = Number(arg('porta', 8794));
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
  await pagina.waitForSelector('#sociedade-acerto .ac-raiz', {state: 'attached', timeout: 15000});
  return {contexto, pagina};
}
const irPara = async (pagina, chave) => { await pagina.evaluate(k => window.financeNavigate(k, false), chave); await pagina.evaluate(() => window.scrollTo(0, 0)); await pagina.waitForTimeout(250); };
async function foto(pagina, nome, inteira = true) {
  if (!FOTOS) return;
  await pagina.evaluate(() => { const a = document.activeElement; if (a && a.id === 'dashboard-title') a.blur(); });
  await pagina.waitForTimeout(300);
  const arquivo = join(SAIDA, nome + '.png');
  await pagina.screenshot({path: arquivo, fullPage: inteira});
  registro.fotos.push(arquivo);
}
async function gravacaoLigada(pagina) {
  return pagina.waitForFunction(() => /Gravação ligada/.test((document.getElementById('lv-modo') || {}).textContent || ''), null, {timeout: 20000}).then(() => true).catch(() => false);
}
const esperarToast = (pagina, re) => pagina.waitForFunction(r => { const t = document.getElementById('lv-toast'); return t && t.getAttribute('role') === 'status' && t.classList.contains('is-visivel') && new RegExp(r).test(t.textContent); }, re.source, {timeout: 10000}).then(() => true).catch(() => false);

// a tela contra a conta: contas.acertoAcumulado calculado na página, com o mesmo estado e o mesmo diário (dados() do
// livro.js, a mesma instância), comparado com o quadro (data-minor de cada número), o Meu painel e o "Livro do mês"
async function conferirNumeros(pagina, rotulo) {
  const r = await pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const C = await import('/contas.js');
    const D = L.dados();
    const A = C.acertoAcumulado(D.c.estado, D.aplicado, D.lista, L.hojeDe(D.c));
    const esperado = Object.fromEntries(A.porSocia.map(s => [s.id, {adiantou: s.pagouDividido + s.devidoGastos, parte: s.parteDividido, saldo: s.saldo, devido: s.devido, aportes: s.aportes}]));
    const tela = {};
    for (const tr of document.querySelectorAll('#sociedade-acerto .ac-quadro tbody tr')) {
      tela[tr.dataset.socia] = Object.fromEntries([...tr.querySelectorAll('td[data-campo]')].map(td => [td.dataset.campo, Number(td.dataset.minor)]));
    }
    const resumo = Object.fromEntries([...document.querySelectorAll('#acerto-resumo [data-campo]')].map(n => [n.dataset.campo, Number(n.dataset.minor)]));
    const transferencias = [...document.querySelectorAll('#sociedade-acerto .ac-transferencia')].map(li => ({de: li.dataset.de, para: li.dataset.para, brl: Number(li.dataset.minor)}));
    const livro = [...document.querySelectorAll('#livro-content .lv-acerto-livro .gf-div-valor')].map(n => n.textContent);
    // participação que não fecha 100%: o portal não sugere pagamento nenhum (o rateio está suspenso)
    const suspenso = !!document.querySelector('#sociedade-acerto .ac-aviso-participacao');
    return {eu: D.c.membro.id, esperado, tela, resumo, transferencias, suspenso, esperadas: suspenso ? [] : A.transferencias.map(t => ({de: t.de, para: t.para, brl: t.brl})),
      livro, livroEsperado: A.porSocia.map(s => (s.saldo > 0 ? '+' : s.saldo < 0 ? '−' : '') + new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(Math.abs(s.saldo) / 100)),
      soma: Object.values(A.saldos).reduce((a, b) => a + b, 0), somaTela: Object.values(tela).reduce((a, s) => a + s.saldo, 0)};
  });
  certo(rotulo, JSON.stringify(r.tela) === JSON.stringify(r.esperado), `quadro ≠ contas.acertoAcumulado: tela ${JSON.stringify(r.tela)} · conta ${JSON.stringify(r.esperado)}`);
  certo(rotulo, r.soma === 0 && r.somaTela === 0, `os saldos não somam zero (conta ${r.soma}, tela ${r.somaTela})`);
  certo(rotulo, JSON.stringify(r.transferencias) === JSON.stringify(r.esperadas), `quem paga quem ≠ conta: ${JSON.stringify(r.transferencias)} · ${JSON.stringify(r.esperadas)}`);
  const meu = r.esperado[r.eu];
  for (const [campo, v] of Object.entries(r.resumo)) certo(rotulo, meu && meu[campo] === v, `Meu painel: ${campo} = ${v}, a conta diz ${meu && meu[campo]}`);
  if (r.livro.length) certo(rotulo, JSON.stringify(r.livro.map(limpo)) === JSON.stringify(r.livroEsperado.map(limpo)), `Livro do mês ≠ Sociedade: ${r.livro.join(' / ')} · ${r.livroEsperado.join(' / ')}`);
  registro.conferencias.push({rotulo, ...r});
  return r;
}
// o "Ver a conta" de um número do quadro dá o mesmo total do número
async function conferirVerConta(pagina, rotulo, socia, campo) {
  const celula = pagina.locator(`#sociedade-acerto tr[data-socia="${socia}"] td[data-campo="${campo}"] button`);
  const texto = limpo(await celula.textContent());
  await celula.click();
  const dialogo = pagina.locator('dialog.lv-conta[open]');
  await dialogo.waitFor({timeout: 5000}).catch(() => null);
  const total = limpo(await dialogo.locator('.lv-termo-total strong').textContent().catch(() => ''));
  const formula = limpo(await dialogo.locator('.lv-formula').textContent().catch(() => ''));
  const ops = (await dialogo.locator('.lv-termo-op').allTextContents().catch(() => [])).join('');
  certo(rotulo, total && total === texto.replace(/^\+/, ''), `Ver a conta de ${campo} (${socia}): a tela diz ${texto}, a conta ${total}`);
  if (campo === 'saldo') certo(rotulo, /^\+−\+−$/.test(ops), `os sinais do "Ver a conta" do saldo deviam ser + − + −, foram ${ops}`);
  certo(rotulo, formula.length > 20, 'o "Ver a conta" abriu sem fórmula');
  await dialogo.locator('button', {hasText: 'Fechar'}).click();
}
// os botões de ação visíveis na Sociedade e em Lançamentos
const botoesDe = pagina => pagina.evaluate(() => {
  const visivel = b => !b.closest('[hidden]');
  const textos = sel => [...document.querySelectorAll(sel)].filter(visivel).map(b => b.textContent.trim());
  return {sociedade: textos('#sociedade-acerto button.ac-acao'), lancamentos: textos('#lancamentos-content .lv-gasto-acoes button'),
    marcar: document.body.innerText.includes('Marcar reembolsado'), semNome: [...document.querySelectorAll('#sociedade-acerto button, #acerto-resumo button')].filter(b => !(b.getAttribute('aria-label') || b.textContent).trim()).length};
});

// ══ 1 · ?demo=1 ═════════════════════════════════════════════════════════════════════════════════════════════════
const ESPERADO_DEMO = {
  'm-bauer': {tem: ['Reembolsar', 'Registrar um aporte em dinheiro'], nao: ['Registrar o Pix', 'Recebi', 'Converter em aporte'], lancamentos: ['Reembolsar'], frase: /Você adiantou R\$ 450,00 · a empresa não te deve nada · no acerto você tem \+R\$ 135,00 a receber/},
  'm-ana': {tem: ['Converter em aporte', 'Registrar um aporte em dinheiro'], nao: ['Reembolsar', 'Registrar o Pix', 'Recebi'], lancamentos: ['Converter em aporte'], frase: /Você adiantou R\$ 59,90 · a empresa te deve R\$ 59,90 · no acerto você está quite/},
  'm-bia': {tem: ['Registrar o Pix', 'Registrar um aporte em dinheiro'], nao: ['Reembolsar', 'Recebi', 'Converter em aporte'], lancamentos: [], frase: /^Você não adiantou nada que volte para você · a empresa não te deve nada · no acerto você tem −R\$ 135,00 a pagar$/},
};
for (const membro of ['m-bauer', 'm-ana']) for (const tela of ['desktop', 'celular']) for (const tema of ['claro', 'escuro']) {
  const combo = `${tela}-${tema}`;
  const p = passo(`?demo=1 como ${membro} · ${combo}: Sociedade e Meu painel`);
  const {contexto, pagina} = await abrir(p, `?demo=1&membro=${membro}#sociedade`, {tela, tema});
  await pagina.waitForTimeout(300);
  await conferirNumeros(pagina, p);
  const e = ESPERADO_DEMO[membro];
  const b = await botoesDe(pagina);
  for (const t of e.tem) certo(p, b.sociedade.includes(t), `${membro} devia ver “${t}” na Sociedade (viu: ${b.sociedade.join(', ')})`);
  for (const t of e.nao) certo(p, !b.sociedade.includes(t), `${membro} não devia ver “${t}” na Sociedade`);
  certo(p, b.semNome === 0, `${b.semNome} botão(ões) sem nome acessível`);
  const largura = await pagina.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  certo(p, largura[0] <= largura[1], `rolagem horizontal na Sociedade: ${largura[0]}px numa janela de ${largura[1]}px`);
  await foto(pagina, `${combo}-${membro}-sociedade`);
  await irPara(pagina, 'overview');
  const frase = limpo(await pagina.locator('#acerto-resumo .ac-resumo-frase').textContent());
  certo(p, e.frase.test(frase), `Meu painel: “${frase}”`);
  const largura2 = await pagina.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  certo(p, largura2[0] <= largura2[1], `rolagem horizontal no Meu painel: ${largura2[0]}px numa janela de ${largura2[1]}px`);
  await foto(pagina, `${combo}-${membro}-meu-painel`);
  if (combo === 'desktop-claro') {
    await irPara(pagina, 'society');
    await conferirVerConta(pagina, p, 'm-bia', 'saldo');
    await conferirVerConta(pagina, p, 'm-ana', 'devido');
    await conferirVerConta(pagina, p, 'm-bauer', 'adiantou');
    await conferirVerConta(pagina, p, 'm-bauer', 'parte');
    await conferirVerConta(pagina, p, 'm-ana', 'parte');
    await conferirVerConta(pagina, p, 'm-bia', 'aportes');
    await irPara(pagina, 'livro');
    const livro = await conferirNumeros(pagina, p + ' · Livro do mês');
    certo(p, livro.livro.length === 3, 'o Livro do mês não mostrou o acerto acumulado');
    certo(p, await pagina.locator('#livro-content .lv-link-acerto').count() === 1, 'falta o link do Livro para o acerto acumulado');
    await pagina.locator('#livro-content .lv-link-acerto').click();
    await pagina.waitForTimeout(400);
    const lugar = await pagina.evaluate(() => ({pagina: document.querySelector('[data-finance-page]:not([hidden])').dataset.financePage, foco: document.activeElement && document.activeElement.id, hash: location.hash}));
    certo(p, lugar.pagina === 'society' && lugar.foco === 'sociedade-acerto-titulo' && lugar.hash === '#sociedade', `o link do Livro foi para ${JSON.stringify(lugar)}`);
    await irPara(pagina, 'lancamentos');
    const bl = await botoesDe(pagina);
    certo(p, !bl.marcar, 'Lançamentos ainda oferece “Marcar reembolsado”');
    for (const t of e.lancamentos) certo(p, bl.lancamentos.includes(t), `${membro} devia ver “${t}” em Lançamentos (viu: ${bl.lancamentos.join(', ')})`);
    for (const t of ['Reembolsar', 'Converter em aporte'].filter(x => !e.lancamentos.includes(x))) certo(p, !bl.lancamentos.includes(t), `${membro} não devia ver “${t}” em Lançamentos`);
    // "Ver o acerto" do Meu painel leva ao acerto da Sociedade
    await irPara(pagina, 'overview');
    await pagina.locator('#acerto-resumo button', {hasText: 'Ver o acerto'}).click();
    await pagina.waitForTimeout(400);
    const lugar2 = await pagina.evaluate(() => ({pagina: document.querySelector('[data-finance-page]:not([hidden])').dataset.financePage, foco: document.activeElement && document.activeElement.id}));
    certo(p, lugar2.pagina === 'society' && lugar2.foco === 'sociedade-acerto-titulo', `“Ver o acerto” foi para ${JSON.stringify(lugar2)}`);
  }
  await contexto.close();
}
{
  const p = passo('?demo=1 como m-bia: “Registrar o Pix” para quem deve, e nada de “Marcar reembolsado”');
  const {contexto, pagina} = await abrir(p, '?demo=1&membro=m-bia#sociedade');
  await conferirNumeros(pagina, p);
  const b = await botoesDe(pagina);
  for (const t of ESPERADO_DEMO['m-bia'].tem) certo(p, b.sociedade.includes(t), `m-bia devia ver “${t}” (viu: ${b.sociedade.join(', ')})`);
  for (const t of ESPERADO_DEMO['m-bia'].nao) certo(p, !b.sociedade.includes(t), `m-bia não devia ver “${t}”`);
  await irPara(pagina, 'lancamentos');
  const bl = await botoesDe(pagina);
  certo(p, !bl.marcar && !bl.lancamentos.includes('Reembolsar') && !bl.lancamentos.includes('Converter em aporte'), `Lançamentos da Beatriz: ${bl.lancamentos.join(', ')}`);
  // quem só fez aporte não "deixou de adiantar do bolso": o aporte saiu do bolso, só não volta
  await irPara(pagina, 'overview');
  const fraseBia = limpo(await pagina.locator('#acerto-resumo .ac-resumo-frase').textContent());
  certo(p, ESPERADO_DEMO['m-bia'].frase.test(fraseBia), `Meu painel da Beatriz: “${fraseBia}”`);
  certo(p, /seus aportes somam R\$\s300,00/.test(await pagina.locator('#acerto-resumo .ac-resumo-pede').textContent()), 'o Meu painel da Beatriz não cita os aportes');
  // participação que não fecha 100% (cadastro errado, simulado na página): o aviso aparece e o rateio fica suspenso
  await irPara(pagina, 'society');
  await pagina.evaluate(() => { window.financeHost.livro.contexto().estado.members[2].participationPct = 20; window.financeLivro.renderTudo(true); });
  await pagina.waitForTimeout(200);
  const aviso = limpo(await pagina.locator('#sociedade-acerto .ac-aviso-participacao').textContent().catch(() => ''));
  certo(p, aviso === 'A participação cadastrada soma 90%: o rateio fica suspenso até corrigir.', `aviso da participação: “${aviso}”`);
  const r = await conferirNumeros(pagina, p + ' (participação 90%)');
  certo(p, r.esperado['m-bauer'].parte === 0 && r.esperado['m-bia'].parte === 0, 'com a participação suspensa, os gastos divididos deviam sair do acerto');
  certo(p, r.suspenso && await pagina.locator('#sociedade-acerto .ac-suspenso').count() === 1 && await pagina.locator('#sociedade-acerto button', {hasText: 'Registrar o Pix'}).count() === 0, 'com a participação suspensa, o portal ainda sugere pagamentos');
  await foto(pagina, 'desktop-claro-m-bia-participacao-90');
  await contexto.close();
}
{
  const p = passo('?demo=1 como m-ana: participação a 90% (o Meu painel não mostra saldo com sinal) e participação não informada (a legenda diz “não informada”)');
  const {contexto, pagina} = await abrir(p, '?demo=1&membro=m-ana#sociedade');
  await pagina.evaluate(() => { window.financeHost.livro.contexto().estado.members[2].participationPct = 20; window.financeLivro.renderTudo(true); });
  await pagina.waitForTimeout(200);
  await conferirNumeros(pagina, p + ' (participação 90%)');
  await irPara(pagina, 'overview');
  const frase = limpo(await pagina.locator('#acerto-resumo .ac-resumo-frase').textContent());
  certo(p, /^Você adiantou R\$\s59,90 · a empresa te deve R\$\s59,90 · o acerto entre vocês está suspenso até corrigir a participação$/.test(frase), `Meu painel da Ana com a participação a 90%: “${frase}”`);
  certo(p, await pagina.locator('#acerto-resumo [data-campo="saldo"]').count() === 0 && !/[+−]R\$/.test(frase), 'com a participação suspensa, o Meu painel ainda mostra um saldo com sinal');
  certo(p, !/você paga/i.test(await pagina.locator('#acerto-resumo').textContent()), 'com a participação suspensa, o Meu painel ainda sugere um pagamento');
  const aviso = pagina.locator('#acerto-resumo .ac-resumo-aviso');
  certo(p, await aviso.count() === 1, 'falta o link do Meu painel para o aviso da participação');
  await foto(pagina, 'desktop-claro-m-ana-participacao-90-meu-painel', false);
  await aviso.click();
  await pagina.waitForTimeout(400);
  const lugar = await pagina.evaluate(() => ({pagina: document.querySelector('[data-finance-page]:not([hidden])').dataset.financePage, foco: document.activeElement && document.activeElement.id}));
  certo(p, lugar.pagina === 'society' && lugar.foco === 'sociedade-acerto-titulo', `o link do aviso foi para ${JSON.stringify(lugar)}`);
  // participação da Ana não informada: o aviso e a legenda dizem “não informada”, nunca 0,0%
  await pagina.evaluate(() => { const e = window.financeHost.livro.contexto().estado; e.members[2].participationPct = 30; delete e.members[1].participationPct; window.financeLivro.renderTudo(true); });
  await pagina.waitForTimeout(200);
  const avisoPct = limpo(await pagina.locator('#sociedade-acerto .ac-aviso-participacao').textContent().catch(() => ''));
  certo(p, avisoPct === 'A participação de Ana Ribeiro não foi informada: o rateio fica suspenso até corrigir.', `aviso da participação não informada: “${avisoPct}”`);
  const legenda = await pagina.locator('#sociedade-acerto .ac-participacao .gf-legenda li').evaluateAll(lis => lis.map(li => li.innerText.replace(/\s+/g, ' ').trim()));
  certo(p, legenda.some(t => /^Ana Ribeiro \(você\) não informada$/.test(t)) && !legenda.some(t => /Ana Ribeiro.*0,0%/.test(t)), `legenda da participação: ${JSON.stringify(legenda)}`);
  const rotuloBarra = await pagina.locator('#sociedade-acerto .ac-participacao figure').getAttribute('aria-label');
  certo(p, /Ana Ribeiro não informada/.test(rotuloBarra || ''), `nome acessível da barra: ${rotuloBarra}`);
  await conferirVerConta(pagina, p, 'm-bauer', 'parte');
  await foto(pagina, 'desktop-claro-m-ana-participacao-nao-informada', false);
  await contexto.close();
}

// ══ 2 · ?diario=local: gravação de verdade, trocando de sócia ═════════════════════════════════════════════════════
const local = membro => `?diario=local&membro=${membro}`;
async function lancar(pagina, alvo, dados) {
  return pagina.evaluate(async ([alvo, dados]) => {
    const L = await import('/livro.js');
    const r = await L.gravar({acao: 'add_expense', alvo, dados: {competencia: dados.data.slice(0, 7), moeda: 'BRL', pagoPor: L.dados().c.membro.id, ...dados}}, 'Lançado.');
    return r.ok ? null : r.erro;
  }, [alvo, dados]);
}
const quadroDe = (pagina, socia, campo) => pagina.evaluate(([s, c]) => { const td = document.querySelector(`#sociedade-acerto tr[data-socia="${s}"] td[data-campo="${c}"]`); return td ? Number(td.dataset.minor) : null; }, [socia, campo]);
const focoAtual = pagina => pagina.evaluate(() => { const a = document.activeElement; return a ? {tag: a.tagName, foco: a.dataset.foco || null, gasto: a.dataset.gasto || null, chave: a.dataset.chave || null, texto: (a.textContent || '').trim().slice(0, 60)} : null; });

{
  const p = passo('?diario=local · preparo: o contador do Bauer (dividir), o domínio da Ana e o Canva da Beatriz (a empresa reembolsa)');
  for (const [membro, alvo, dados] of [
    ['m-bauer', 'g-fluxo-contador', {data: '2026-10-10', descricao: 'Contador · outubro', categoria: 'contabilidade_juridico', valorMinor: 45000, forma: 'pix_pessoal', destino: 'dividir'}],
    ['m-ana', 'g-fluxo-dominio', {data: '2026-10-12', descricao: 'Domínio exemplo.com.br', categoria: 'infraestrutura', valorMinor: 5990, forma: 'pix_pessoal', destino: 'empresa_reembolsa'}],
    ['m-bia', 'g-fluxo-canva', {data: '2026-10-15', descricao: 'Canva Pro · outubro', categoria: 'software_ia', valorMinor: 4500, forma: 'cartao_pessoal', destino: 'empresa_reembolsa'}],
  ]) {
    const {contexto, pagina} = await abrir(p, local(membro) + '#lancamentos');
    certo(p, await gravacaoLigada(pagina), `a gravação não ligou para ${membro}`);
    const erro = await lancar(pagina, alvo, dados);
    certo(p, !erro, `${membro} não conseguiu lançar: ${erro}`);
    await contexto.close();
  }
}
{
  const p = passo('Ana registra o Pix de R$ 135,00 para o Bauer, pelo teclado → o saldo dela vai a zero');
  const {contexto, pagina} = await abrir(p, local('m-ana') + '#sociedade');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  await conferirNumeros(pagina, p + ' (antes)');
  certo(p, await quadroDe(pagina, 'm-ana', 'saldo') === -13500, `o saldo da Ana antes do Pix devia ser −135,00 (veio ${await quadroDe(pagina, 'm-ana', 'saldo')})`);
  const botao = pagina.locator('#sociedade-acerto li.ac-transferencia[data-de="m-ana"] button', {hasText: 'Registrar o Pix'});
  certo(p, await botao.count() === 1, 'a Ana não viu “Registrar o Pix”');
  certo(p, /Registrar o Pix de R\$\s135,00 para Bauer/.test(await botao.getAttribute('aria-label') || ''), `nome acessível do botão: ${await botao.getAttribute('aria-label')}`);
  await botao.focus();
  await pagina.keyboard.press('Enter');
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  const valor = await folha.locator('.lv-dinheiro-valor').inputValue();
  certo(p, valor === '135,00', `o valor do Pix devia vir preenchido com 135,00 (veio “${valor}”)`);
  certo(p, await pagina.evaluate(() => document.activeElement && document.activeElement.classList.contains('lv-dinheiro-valor')), 'o foco não foi para o valor ao abrir a folha');
  await foto(pagina, 'local-ana-folha-pix', false);
  await pagina.keyboard.press('Enter');   // Enter no campo envia a folha (o botão principal é o submit)
  certo(p, await esperarToast(pagina, /Pix registrado/), 'o toast (role=status) não anunciou o Pix');
  await pagina.waitForFunction(() => !document.querySelector('dialog.sheet[open]'), null, {timeout: 5000}).catch(() => null);
  await pagina.waitForTimeout(300);
  // passou pelo diário: o último registro é o acerto da Ana, gravado no servidor (com seq e sem a marca de treino)
  const ultimo = await pagina.evaluate(async () => { const L = await import('/livro.js'); const d = L.dados().d; const ev = d.eventos[d.eventos.length - 1]; return {modo: d.modo, membro: ev.membro, treino: !!ev.treino, seq: ev.seq, cabeca: d.cabeca, c: ev.conteudo}; });
  certo(p, ultimo.modo === 'gravacao' && !ultimo.treino && ultimo.seq === ultimo.cabeca && ultimo.membro === 'm-ana' && ultimo.c.acao === 'record_settlement' && ultimo.c.dados.tipo === 'acerto_entre_socias' && ultimo.c.dados.de === 'm-ana' && ultimo.c.dados.para === 'm-bauer' && ultimo.c.dados.valorMinor === 13500,
    `o Pix não chegou ao diário como esperado: ${JSON.stringify(ultimo)}`);
  certo(p, await quadroDe(pagina, 'm-ana', 'saldo') === 0, `o saldo da Ana depois do Pix devia ser zero (veio ${await quadroDe(pagina, 'm-ana', 'saldo')})`);
  certo(p, await pagina.locator('#sociedade-acerto li.ac-transferencia[data-de="m-ana"]').count() === 0, 'a Ana continua em “quem paga quem”');
  const pendente = pagina.locator('#sociedade-acerto .ac-aguardando li');
  certo(p, await pendente.count() === 1 && /aguardando Bauer confirmar/.test(await pendente.textContent()), 'o Pix não apareceu como “aguardando Bauer confirmar”');
  certo(p, await pendente.locator('button', {hasText: 'Recebi'}).count() === 0, 'a Ana (quem pagou) não devia ver “Recebi”');
  const f = await focoAtual(pagina);
  certo(p, f && f.foco === 'quem-paga', `depois do Pix o foco devia ir para “Quem paga quem” (foi ${JSON.stringify(f)})`);
  await conferirNumeros(pagina, p + ' (depois)');
  await irPara(pagina, 'overview');
  certo(p, /no acerto você está quite/.test(limpo(await pagina.locator('#acerto-resumo .ac-resumo-frase').textContent())), 'o Meu painel da Ana não diz “quite”');
  await contexto.close();
}
{
  const p = passo('o Bauer vê “Recebi” e confirma');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#sociedade');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const pendente = pagina.locator('#sociedade-acerto .ac-aguardando li');
  const recebi = pendente.locator('button', {hasText: 'Recebi'});
  certo(p, await recebi.count() === 1, 'o Bauer não viu “Recebi”');
  certo(p, /^Recebi: confirmar que você recebeu R\$\s135,00 de Ana Ribeiro$/.test(await recebi.getAttribute('aria-label') || ''), `nome acessível do “Recebi”: ${await recebi.getAttribute('aria-label')}`);
  await foto(pagina, 'local-bauer-recebi');
  await recebi.focus();
  await pagina.keyboard.press('Enter');
  certo(p, await esperarToast(pagina, /Recebimento confirmado/), 'o toast não anunciou a confirmação');
  await pagina.waitForTimeout(300);
  certo(p, await pagina.locator('#sociedade-acerto .ac-aguardando li').count() === 0, 'o Pix continua aguardando confirmação');
  certo(p, /confirmado por Bauer/.test(await pagina.locator('#sociedade-acerto .ac-historico').textContent()), 'o histórico não mostra “confirmado por Bauer”');
  const f = await focoAtual(pagina);
  certo(p, f && f.foco === 'quem-paga', `depois do “Recebi” o foco devia ir para “Quem paga quem” (foi ${JSON.stringify(f)})`);
  const b = await botoesDe(pagina);
  certo(p, !b.sociedade.includes('Converter em aporte') && !b.sociedade.includes('Registrar o Pix'), `o Bauer vê botões que não pode usar: ${b.sociedade.join(', ')}`);
  await conferirNumeros(pagina, p);
  await contexto.close();
}
{
  const p = passo('o Bauer reembolsa o domínio da Ana a partir de Lançamentos → “a empresa te deve” zera');
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#lancamentos');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const b = await botoesDe(pagina);
  certo(p, !b.marcar, 'Lançamentos ainda oferece “Marcar reembolsado”');
  const cartao = pagina.locator('#lancamentos-content article[data-gasto="g-fluxo-dominio"]');
  const reembolsar = cartao.locator('button', {hasText: 'Reembolsar'});
  certo(p, await reembolsar.count() === 1, 'o Bauer não viu “Reembolsar” no domínio da Ana');
  certo(p, await cartao.locator('button', {hasText: 'Converter em aporte'}).count() === 0, 'o Bauer não devia ver “Converter em aporte” no gasto da Ana');
  certo(p, await pagina.locator('#lancamentos-content article[data-gasto="g-fluxo-contador"] button', {hasText: /Reembolsar|Converter/}).count() === 0, 'gasto dividido não tem reembolso');
  await reembolsar.click();
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  const marcados = await folha.locator('.ac-escolha input:checked').evaluateAll(xs => xs.map(x => x.value));
  certo(p, JSON.stringify(marcados) === '["g-fluxo-dominio"]', `a folha devia vir com o domínio marcado (veio ${JSON.stringify(marcados)})`);
  certo(p, /R\$\s59,90/.test(await folha.locator('.ac-total').textContent()), 'o total do reembolso não é R$ 59,90');
  await foto(pagina, 'local-bauer-folha-reembolso', false);
  await folha.locator('button', {hasText: 'Registrar o reembolso'}).click();
  certo(p, await esperarToast(pagina, /Reembolso registrado: R\$\s59,90 para Ana Ribeiro/), 'o toast não anunciou o reembolso');
  await pagina.waitForTimeout(300);
  certo(p, /reembolsado/.test(await cartao.textContent()) && await cartao.locator('button', {hasText: 'Reembolsar'}).count() === 0, 'o domínio não ficou “reembolsado”');
  const f = await focoAtual(pagina);
  certo(p, f && f.gasto === 'g-fluxo-dominio', `depois do reembolso o foco devia voltar ao cartão do domínio (foi ${JSON.stringify(f)})`);
  await irPara(pagina, 'society');
  certo(p, await quadroDe(pagina, 'm-ana', 'devido') === 0, `“a empresa deve” da Ana devia ser zero (veio ${await quadroDe(pagina, 'm-ana', 'devido')})`);
  await conferirNumeros(pagina, p);
  await contexto.close();
}
{
  const p = passo('a Ana vê no Meu painel que a empresa não deve nada e confirma o reembolso');
  const {contexto, pagina} = await abrir(p, local('m-ana'));
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const frase = limpo(await pagina.locator('#acerto-resumo .ac-resumo-frase').textContent());
  certo(p, /Você adiantou R\$\s59,90 · a empresa não te deve nada · no acerto você está quite/.test(frase), `Meu painel da Ana: “${frase}”`);
  certo(p, /1 recebimento para confirmar/.test(await pagina.locator('#acerto-resumo').textContent()), 'o Meu painel não avisa do recebimento para confirmar');
  await irPara(pagina, 'society');
  const recebi = pagina.locator('#sociedade-acerto .ac-aguardando li button', {hasText: 'Recebi'});
  certo(p, await recebi.count() === 1, 'a Ana não viu “Recebi” no reembolso');
  await recebi.click();
  certo(p, await esperarToast(pagina, /Recebimento confirmado/), 'o toast não anunciou a confirmação do reembolso');
  const b = await botoesDe(pagina);
  certo(p, !b.sociedade.includes('Reembolsar'), 'a Ana não devia ver “Reembolsar”');
  await conferirNumeros(pagina, p);
  await contexto.close();
}
{
  const p = passo('a Beatriz converte o reembolso do Canva em aporte');
  const {contexto, pagina} = await abrir(p, local('m-bia') + '#sociedade');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou');
  await pagina.waitForTimeout(300);
  const b = await botoesDe(pagina);
  certo(p, b.sociedade.includes('Registrar o Pix'), 'a Beatriz deve R$ 135,00 ao Bauer e não viu “Registrar o Pix”');
  certo(p, !b.sociedade.includes('Reembolsar'), 'a Beatriz não devia ver “Reembolsar”');
  const item = pagina.locator('#sociedade-acerto .ac-gasto[data-gasto="g-fluxo-canva"]');
  const converter = item.locator('button', {hasText: 'Converter em aporte'});
  certo(p, await converter.count() === 1, 'a Beatriz não viu “Converter em aporte” no Canva');
  await converter.click();
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  await foto(pagina, 'local-bia-folha-aporte', false);
  await folha.locator('button', {hasText: 'Converter em aporte'}).click();
  certo(p, await esperarToast(pagina, /Convertido em aporte/), 'o toast não anunciou a conversão');
  await pagina.waitForTimeout(300);
  certo(p, await quadroDe(pagina, 'm-bia', 'aportes') === 4500 && await quadroDe(pagina, 'm-bia', 'devido') === 0, `aportes ${await quadroDe(pagina, 'm-bia', 'aportes')} e “a empresa deve” ${await quadroDe(pagina, 'm-bia', 'devido')} da Beatriz`);
  certo(p, await pagina.locator('#sociedade-acerto .ac-gasto[data-gasto="g-fluxo-canva"]').count() === 0, 'o Canva continua nos reembolsos pendentes');
  certo(p, /Reembolso convertido em aporte/.test(await pagina.locator('#sociedade-acerto .ac-historico').textContent()), 'o histórico não mostra a conversão');
  const f = await focoAtual(pagina);
  certo(p, f && f.foco === 'reembolsos', `depois da conversão o foco devia ir para “Reembolsos pendentes” (foi ${JSON.stringify(f)})`);
  await conferirNumeros(pagina, p);
  await foto(pagina, 'local-bia-sociedade-final');
  await irPara(pagina, 'historico');
  const hist = await pagina.locator('#historico-content .lv-historico').textContent();
  for (const t of ['Ana Ribeiro registrou o acerto', 'Bauer confirmou o recebimento', 'Bauer registrou o reembolso', 'Beatriz Lima converteu em aporte']) certo(p, hist.includes(t), `o Histórico não mostra “${t}”`);
  await contexto.close();
}
{
  const p = passo('gasto em dólar de setembro (mês fechado), dólar novo depois do fechamento: a folha do reembolso propõe o valor da Sociedade e o razão aceita');
  // a Ana lança um gasto em dólar de setembro, pago do bolso (a empresa reembolsa), com o dólar vigente em setembro
  {
    const {contexto, pagina} = await abrir(p, local('m-ana') + '#lancamentos');
    certo(p, await gravacaoLigada(pagina), 'a gravação não ligou para a Ana');
    const erro = await pagina.evaluate(async () => {
      const L = await import('/livro.js');
      const r1 = await L.gravar({acao: 'set_parameter', alvo: 'fx.USD_BRL', dados: {chave: 'fx.USD_BRL', valor: '5.3530', desde: '2026-09-01', fonte: 'PTAX de exemplo do fluxo', estado: 'vigente'}}, 'Parâmetro gravado.');
      if (!r1.ok) return 'parâmetro: ' + r1.erro;
      const r2 = await L.gravar({acao: 'add_expense', alvo: 'g-fluxo-ferramenta', dados: {data: '2026-09-20', competencia: '2026-09', descricao: 'Ferramenta de exemplo', categoria: 'software_ia', valorMinor: 1000, moeda: 'USD', forma: 'cartao_pessoal', pagoPor: L.dados().c.membro.id, destino: 'empresa_reembolsa'}}, 'Lançado.');
      return r2.ok ? null : 'gasto: ' + r2.erro;
    });
    certo(p, !erro, `a Ana não conseguiu preparar o gasto: ${erro}`);
    await contexto.close();
  }
  // o Bauer fecha setembro (com o selo da foto do mês) e, depois, grava um dólar novo com vigência dentro de setembro
  const {contexto, pagina} = await abrir(p, local('m-bauer') + '#sociedade');
  certo(p, await gravacaoLigada(pagina), 'a gravação não ligou para o Bauer');
  const preparo = await pagina.evaluate(async () => {
    const L = await import('/livro.js');
    const C = await import('/contas.js');
    const D = L.dados();
    const cabeca = D.d.cabeca;
    const foto = C.fotoDoMes(D.c.estado, D.aplicado, '2026-09', cabeca);
    const t = foto.totais;
    const r1 = await L.gravar({acao: 'close_month', alvo: '2026-09', dados: {cabeca, selo: C.seloDoMes(foto), totais: {realizado: t.realizado, previsto: t.previsto, total: t.total, resultado: t.resultado}}}, 'Setembro fechado.');
    if (!r1.ok) return {erro: 'fechamento: ' + r1.erro};
    const r2 = await L.gravar({acao: 'set_parameter', alvo: 'fx.USD_BRL', dados: {chave: 'fx.USD_BRL', valor: '5.0000', desde: '2026-09-15', fonte: 'vigência nova do fluxo', estado: 'vigente'}}, 'Parâmetro gravado.');
    if (!r2.ok) return {erro: 'parâmetro novo: ' + r2.erro};
    const R = await import('/razao.js');
    const D2 = L.dados();
    const g = D2.aplicado.gastos.find(x => x.id === 'g-fluxo-ferramenta');
    const A = C.acertoAcumulado(D2.c.estado, D2.aplicado, D2.lista, L.hojeDe(D2.c));
    const pendente = A.reembolsosPendentes.find(x => x.id === g.id);
    return {fechado: !!(D2.aplicado.fechamentos['2026-09'] || {}).fechado, conta: pendente ? pendente.brl : null, hoje: R.reaisDoGasto(g, D2.lista).brl};
  });
  certo(p, !preparo.erro, `o Bauer não conseguiu fechar setembro e mudar o dólar: ${preparo.erro}`);
  certo(p, preparo.fechado && preparo.conta !== null && preparo.conta !== preparo.hoje, `o cenário não separa os parâmetros do fechamento dos de hoje: ${JSON.stringify(preparo)}`);
  await pagina.waitForTimeout(300);
  const grupo = pagina.locator('#sociedade-acerto .ac-grupo[data-socia="m-ana"]');
  const real = v => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(v / 100).replace(/\s/g, ' ');
  certo(p, limpo(await grupo.locator('.ac-gasto[data-gasto="g-fluxo-ferramenta"] .ac-gasto-valor').textContent()).replace(/\s/g, ' ') === real(preparo.conta), 'a Sociedade não mostra o valor da conta no gasto de setembro');
  await grupo.locator('button', {hasText: 'Reembolsar'}).click();
  const folha = pagina.locator('dialog.sheet[open]');
  await folha.waitFor({timeout: 5000});
  const marcados = await folha.locator('.ac-escolha input:checked').evaluateAll(xs => xs.map(x => x.value));
  certo(p, JSON.stringify(marcados) === '["g-fluxo-ferramenta"]', `a folha devia vir com o gasto de setembro marcado (veio ${JSON.stringify(marcados)})`);
  const totalFolha = limpo(await folha.locator('.ac-total strong').textContent()).replace(/\s/g, ' ');
  certo(p, totalFolha === real(preparo.conta), `a folha propõe ${totalFolha}; a Sociedade e o razão contam ${real(preparo.conta)} (com o dólar de hoje seria ${real(preparo.hoje)})`);
  await foto(pagina, 'local-bauer-folha-reembolso-mes-fechado', false);
  await folha.locator('button', {hasText: 'Registrar o reembolso'}).click();
  certo(p, await esperarToast(pagina, new RegExp('Reembolso registrado: R\\$\\s' + real(preparo.conta).replace('R$ ', '').replace('.', '\\.'))), 'o razão recusou o reembolso do gasto de mês fechado (ou o toast não anunciou)');
  await pagina.waitForTimeout(300);
  certo(p, await quadroDe(pagina, 'm-ana', 'devido') === 0, `“a empresa deve” da Ana devia voltar a zero (veio ${await quadroDe(pagina, 'm-ana', 'devido')})`);
  certo(p, await pagina.locator('#sociedade-acerto .ac-gasto[data-gasto="g-fluxo-ferramenta"]').count() === 0, 'o gasto de setembro continua nos reembolsos pendentes');
  await conferirNumeros(pagina, p);
  await contexto.close();
}

await navegador.close();
servidor.close();
for (const e of registro.erros) falha('erros da página', `${e.rotulo} · ${e.tipo} · ${e.texto}`);
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`\n${registro.passos.length} passos · ${registro.conferencias.length} conferências com a conta · ${registro.fotos.length} fotos em ${SAIDA} · ${registro.falhas.length} falha(s)`);
if (registro.falhas.length) process.exitCode = 1;
