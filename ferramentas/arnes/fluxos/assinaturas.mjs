// Fluxo da fatia F2-5 (Assinaturas e Vender primeiro sem arquivo). Em ?diario=local, cada sócia num aparelho próprio
// (?membro=): Ana cria "Canva Pro", Beatriz confirma (entra no previsto), Bauer marca como paga (o gasto aparece em
// Lançamentos e sai do previsto), Bauer reativa o Figma (no estado fictício ele já vem encerrado), Ana encerra o Figma
// com motivo e Beatriz marca um passo; o Histórico mostra cada registro com a autora. Em treino (?demo=1): controles
// desligados com o motivo quando o diário não grava, uma folha aberta sobrevive a 3 ciclos de 2 s (e a página só se
// redesenha ao fechar), o formulário de edição também, Editar tira a confirmação, e a ponte converte as mutações antigas
// (set_subscription, edit_plan com versão velha). Bordas: encerrar com data futura oferece “Desfazer o encerramento”;
// Editar sem anotação de status grava só o valor, o dia do vencimento e o período; a Hotmart (por venda) traz uma nota
// no lugar do Confirmar. Fotografa Assinaturas e Vender primeiro nos 4 cortes (e as folhas).
// Sai com código 1 em qualquer falha, erro de script ou violação de CSP (o registro fica em <saida>/registro.json).
// Uso: node ferramentas/arnes/fluxos/assinaturas.mjs [--saida DIR] [--porta 8852] [--site DIR] [--sem-fotos]
import {pathToFileURL, fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {servir} from '../servir.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : padrao; };
const SAIDA = resolve(arg('saida', join(process.env.TMPDIR || '/tmp', 'fluxo-assinaturas')));
const PORTA = Number(arg('porta', 8852));
const SITE = resolve(arg('site', join(aqui, '..', '..', '..')));
const FOTOS = !process.argv.includes('--sem-fotos');
const raizGlobal = execSync('npm root -g').toString().trim();
const {chromium} = await import(pathToFileURL(join(raizGlobal, 'playwright', 'index.mjs')).href);

await mkdir(SAIDA, {recursive: true});
const servidor = await servir(PORTA, SITE);
const navegador = await chromium.launch();
const base = `http://127.0.0.1:${PORTA}/`;
const registro = {quando: new Date().toISOString(), passos: [], falhas: [], erros: [], fotos: [], tempos: {}};
const falha = (passo, texto) => { registro.falhas.push({passo, texto}); console.log(`  ✗ ${passo}: ${texto}`); };
const certo = (passo, condicao, texto) => { if (!condicao) falha(passo, texto); return Boolean(condicao); };
function passo(nome) { registro.passos.push(nome); console.log('· ' + nome); return nome; }

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
  return {contexto, pagina};
}
// o diário aberto no modo pedido e os cartões já desenhados com ele (os botões dependem do modo)
async function diarioPronto(pagina, modo) {
  await pagina.waitForFunction(m => { const d = window.financeHost.livro.diario(); return d && d.modo === m; }, modo, {timeout: 15000});
  await pagina.waitForFunction(() => document.querySelectorAll('#subscriptions-content .plan-card').length > 0 && !!document.querySelector('#assinatura-nova'), null, {timeout: 8000});
  await pagina.waitForTimeout(150);
}
const cartao = id => id.endsWith('*') ? `#subscriptions-content .plan-card[data-plan-id^="${id.slice(0, -1)}"]` : `#subscriptions-content .plan-card[data-plan-id="${id}"]`;
const textoDe = (pagina, seletor) => pagina.evaluate(s => { const n = document.querySelector(s); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; }, seletor);
const FOLHA = 'dialog.sheet[open]';
const campo = (rotulo, controle = 'input') => `${FOLHA} .lv-campo:has(> .lv-rotulo:text-is("${rotulo}")) ${controle}`;
async function enviarFolha(pagina) { await pagina.click(`${FOLHA} button[type=submit]`); }
// tempo do envio até a página mostrar o resultado: tem de vir antes do ciclo de 2 s (a página atualiza logo depois de gravar)
async function cronometrar(pagina, nome, acao, condicao, arg) {
  const t0 = Date.now();
  await acao();
  const ok = await pagina.waitForFunction(condicao, arg, {timeout: 6000}).then(() => true, () => false);
  registro.tempos[nome] = Date.now() - t0;
  return ok;
}
const semSoLeitura = pagina => pagina.evaluate(() => !document.body.textContent.includes('Esta versão publicada é só de leitura'));
const previstos = pagina => pagina.evaluate(() => [...document.querySelectorAll('#livro-content .lv-livro-linha.is-previsto .lv-livro-desc')].map(n => n.textContent));
async function irPara(pagina, chave) {
  await pagina.evaluate(k => window.financeNavigate(k), chave);
  await pagina.waitForFunction(k => { const v = document.querySelector('[data-finance-page]:not([hidden])'); return v && v.dataset.financePage === k; }, chave, {timeout: 8000});
  await pagina.waitForTimeout(200);
}

// ── 1 · com gravação (?diario=local), cada sócia no seu aparelho ────────────────────────────────────────────────────
const LOCAL = m => `?diario=local&membro=${m}#assinaturas`;
{
  const p = passo('Ana cria a assinatura “Canva Pro”: nasce a confirmar, com autora, e ela mesma não confirma');
  const {contexto, pagina} = await abrir(p, LOCAL('m-ana'));
  await diarioPronto(pagina, 'gravacao');
  certo(p, await semSoLeitura(pagina), 'a página ainda diz “só de leitura”');
  certo(p, !(await pagina.$('#assinaturas-topo .lock-note')), 'com gravação ligada, o topo não devia mostrar cadeado');
  await pagina.click('#assinatura-nova');
  await pagina.waitForSelector(FOLHA);
  await pagina.fill(campo('Serviço'), 'Canva');
  await pagina.fill(campo('Plano'), 'Pro');
  await pagina.fill(campo('Valor', 'input.lv-dinheiro-valor'), '34,90');
  await pagina.fill(campo('Dia do vencimento (1 a 31)'), '12');
  certo(p, await pagina.$eval(campo('Categoria', 'select'), s => s.value) === 'marketing', 'a categoria não veio do palpite pelo nome (Canva → Marketing)');
  certo(p, /34,90/.test(await textoDe(pagina, `${FOLHA} .as-conta`) || ''), 'a folha não mostrou a conta do equivalente mensal');
  const ok = await cronometrar(pagina, 'criar', () => enviarFolha(pagina), s => { const c = document.querySelector(s); return c && !document.querySelector('dialog.sheet[open]') && c.querySelector('.pilula-confirmar'); }, cartao('pl-canva*'));
  certo(p, ok, 'o cartão da Canva não apareceu com a pílula “a confirmar”');
  const texto = await textoDe(pagina, cartao('pl-canva*')) || '';
  certo(p, /Criado por Ana Ribeiro em \d\d\/\d\d/.test(texto), `sem a autoria no cartão: ${texto.slice(0, 200)}`);
  certo(p, /R\$\s*34,90/.test(texto), 'o valor da Canva não aparece no cartão');
  const confirmar = await pagina.$(`${cartao('pl-canva*')} [data-plan-action="confirmar"]`);
  certo(p, confirmar && await confirmar.isDisabled(), 'Ana (quem criou) não devia poder confirmar: o botão devia vir desligado');
  certo(p, /outra sócia/.test(await textoDe(pagina, `${cartao('pl-canva*')} .plan-action-note`) || ''), 'o motivo dos quatro olhos não aparece no cartão');
  await contexto.close();
}
{
  const p = passo('Beatriz confirma: a Canva entra no previsto do mês');
  const {contexto, pagina} = await abrir(p, LOCAL('m-bia'));
  await diarioPronto(pagina, 'gravacao');
  await irPara(pagina, 'livro');
  certo(p, !(await previstos(pagina)).some(t => /Canva/.test(t)), 'a Canva, a confirmar, já estava no previsto');
  await irPara(pagina, 'subscriptions');
  const botaoConfirmar = `${cartao('pl-canva*')} [data-plan-action="confirmar"]`;
  certo(p, !(await pagina.$eval(botaoConfirmar, b => b.disabled)), 'para Beatriz o Confirmar devia vir ligado');
  await pagina.click(botaoConfirmar);
  await pagina.waitForSelector(FOLHA);
  certo(p, /Confirmar = os dados batem com a fatura\./.test(await textoDe(pagina, FOLHA) || ''), 'a folha não explica o que é confirmar');
  certo(p, /Criada por\s*Ana Ribeiro/.test(await textoDe(pagina, `${FOLHA} .as-ficha`) || ''), 'a ficha não diz quem criou');
  const ok = await cronometrar(pagina, 'confirmar', () => enviarFolha(pagina), s => { const c = document.querySelector(s); return c && !document.querySelector('dialog.sheet[open]') && !c.querySelector('.pilula-confirmar') && /confirmado por Beatriz Lima/.test(c.textContent); }, cartao('pl-canva*'));
  certo(p, ok, 'o cartão não passou a confirmado por Beatriz');
  await irPara(pagina, 'livro');
  certo(p, (await previstos(pagina)).some(t => /Canva/.test(t)), 'confirmada, a Canva devia entrar no previsto do Livro do mês');
  await contexto.close();
}
{
  const p = passo('Bauer marca a Canva como paga (vira gasto em Lançamentos e sai do previsto) e reativa o Figma');
  const {contexto, pagina} = await abrir(p, LOCAL('m-bauer'));
  await diarioPronto(pagina, 'gravacao');
  await pagina.click(`${cartao('pl-canva*')} [data-plan-action="pagar"]`);
  await pagina.waitForSelector(FOLHA);
  certo(p, await pagina.$eval(campo('Valor', 'input.lv-dinheiro-valor'), i => i.value) === '34,90', 'o valor da assinatura não veio preenchido');
  certo(p, await pagina.$eval(`${FOLHA} .as-valor-moeda select`, s => s.value) === 'BRL', 'a moeda da assinatura não veio preenchida');
  const ok = await cronometrar(pagina, 'pagar', () => enviarFolha(pagina), s => { const c = document.querySelector(s); return c && !document.querySelector('dialog.sheet[open]') && /Paga · ciclo de outubro de 2026/.test(c.textContent) && !c.querySelector('[data-plan-action="pagar"]'); }, cartao('pl-canva*'));
  certo(p, ok, 'o cartão não mostrou “Paga · ciclo de outubro de 2026” (ou ainda oferece Marcar como paga)');
  await irPara(pagina, 'lancamentos');
  certo(p, /Canva · Pro/.test(await textoDe(pagina, '#lancamentos-content') || ''), 'o pagamento não aparece em Lançamentos');
  await irPara(pagina, 'livro');
  certo(p, !(await previstos(pagina)).some(t => /Canva/.test(t)), 'paga, a Canva devia sair do previsto');
  await irPara(pagina, 'subscriptions');
  const reativou = await cronometrar(pagina, 'reativar', () => pagina.click(`${cartao('figma')} [data-plan-action="reativar"]`), s => { const c = document.querySelector(s); return c && c.querySelector('[data-plan-action="encerrar"]') && !c.classList.contains('inactive'); }, cartao('figma'));
  certo(p, reativou, 'o Figma não voltou a ativo depois de Reativar');
  await contexto.close();
}
{
  const p = passo('Ana encerra o Figma com data e motivo');
  const {contexto, pagina} = await abrir(p, LOCAL('m-ana'));
  await diarioPronto(pagina, 'gravacao');
  await pagina.click(`${cartao('figma')} [data-plan-action="encerrar"]`);
  await pagina.waitForSelector(FOLHA);
  certo(p, /Encerrar aqui não cancela o serviço: cancele também no site dele\./.test(await textoDe(pagina, FOLHA) || ''), 'a folha não avisa que o serviço continua contratado');
  await enviarFolha(pagina);   // sem motivo: o erro aparece na folha, que continua aberta
  await pagina.waitForTimeout(300);
  certo(p, /motivo/i.test(await textoDe(pagina, `${FOLHA} .lv-erro`) || ''), 'sem motivo, a folha devia pedir o motivo sem fechar');
  await pagina.fill(campo('Motivo (fica no histórico)'), 'Trocamos pelo Canva');
  const ok = await cronometrar(pagina, 'encerrar', () => enviarFolha(pagina), s => { const c = document.querySelector(s); return c && !document.querySelector('dialog.sheet[open]') && c.classList.contains('inactive') && /por Ana Ribeiro/.test(c.textContent) && /Motivo: Trocamos pelo Canva/.test(c.textContent); }, cartao('figma'));
  certo(p, ok, 'o Figma não ficou encerrado com a autora e o motivo');
  const texto = await textoDe(pagina, cartao('figma')) || '';
  certo(p, /Encerrada: sem cobrança, sem parte\./.test(texto) && !/Próxima data/.test(texto), `encerrado não devia ter sua parte nem próxima data: ${texto.slice(0, 220)}`);
  await contexto.close();
}
{
  const p = passo('Beatriz marca um passo de Vender primeiro; o Histórico mostra cada registro com a autora');
  const {contexto, pagina} = await abrir(p, LOCAL('m-bia').replace('#assinaturas', '#vender'));
  await pagina.waitForFunction(() => { const d = window.financeHost.livro.diario(); return d && d.modo === 'gravacao'; }, null, {timeout: 15000});
  await pagina.waitForFunction(() => document.querySelectorAll('#sell-content input[type=checkbox]:not(:disabled)').length > 0, null, {timeout: 8000});
  const produtos = await pagina.$$eval('#sell-content .product-card', cs => cs.length);
  certo(p, produtos === 3, `Vender primeiro devia mostrar os 3 produtos do estado fictício: ${produtos}`);
  const antes = await textoDe(pagina, '#sell-content .product-card:first-child .product-progress-label');
  const ok = await cronometrar(pagina, 'passo', () => pagina.click('#sell-content input[data-step-id="s4"]'), () => { const c = document.querySelector('#sell-content input[data-step-id="s4"]'); return c && c.checked && /marcado por Beatriz Lima em \d\d\/\d\d/.test(c.closest('li').textContent); });
  certo(p, ok, 'o passo não ficou marcado por Beatriz');
  const depois = await textoDe(pagina, '#sell-content .product-card:first-child .product-progress-label');
  certo(p, antes === '2 de 4 passos' && depois === '3 de 4 passos', `a barra do produto não andou: ${antes} → ${depois}`);
  await irPara(pagina, 'historico');
  const itens = await pagina.$$eval('#historico-content .lv-hist-item', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ')));
  const esperados = [/Ana Ribeiro criou a assinatura · Canva · Pro/, /Beatriz Lima confirmou a assinatura · Canva/, /Bauer marcou como paga · Canva/, /Bauer reativou a assinatura · Figma/, /Ana Ribeiro encerrou a assinatura · Figma/, /Beatriz Lima marcou o passo · Med Painel/];
  for (const re of esperados) certo(p, itens.some(t => re.test(t)), `o Histórico não mostra ${re}`);
  certo(p, itens.length === esperados.length, `o Histórico devia ter ${esperados.length} registros: tem ${itens.length}`);
  certo(p, /Motivo: Trocamos pelo Canva/.test(itens.join(' ')), 'o motivo do encerramento não aparece no Histórico');
  registro.historico = itens;
  await contexto.close();
}
for (const [nome, ms] of Object.entries(registro.tempos)) certo('a página atualiza logo depois de gravar', ms < 1800, `${nome} levou ${ms} ms para aparecer (o ciclo de 2 s não pode ser quem atualiza)`);

// ── 2 · em treino (?demo=1): controles honestos, folha que sobrevive ao ciclo, edição e a ponte ─────────────────────
{
  const p = passo('treino: a faixa nas duas páginas; sem gravação, os controles vêm desligados com o motivo');
  const {contexto, pagina} = await abrir(p, '?demo=1#assinaturas');
  await diarioPronto(pagina, 'treino');
  certo(p, /treino/i.test(await textoDe(pagina, '#faixa-global .lv-faixa') || ''), 'a faixa de treino não aparece em Assinaturas');
  certo(p, await pagina.$eval('#assinatura-nova', b => !b.disabled), 'em treino, Nova assinatura devia estar ligada');
  const motivo = 'Sua chave do diário ainda não foi liberada (teste do arnês).';
  await pagina.evaluate(m => { const d = window.financeHost.livro.diario(); d.modo = 'aguardando'; d.motivo = m; document.dispatchEvent(new CustomEvent('financeiro:diario')); }, motivo);
  await pagina.waitForFunction(m => (document.querySelector('#assinaturas-topo .lock-note') || {}).textContent === m, motivo, {timeout: 4000}).catch(() => null);
  certo(p, (await textoDe(pagina, '#assinaturas-topo .lock-note')) === motivo, 'aguardando a chave, o topo devia mostrar o cadeado com o motivo');
  certo(p, await pagina.$eval('#assinatura-nova', b => b.disabled), 'aguardando a chave, Nova assinatura devia vir desligada');
  const ligados = await pagina.$$eval('#subscriptions-content .plan-actions button', bs => bs.filter(b => !b.disabled).map(b => b.textContent));
  certo(p, ligados.length === 0, `aguardando a chave, nenhum botão dos cartões devia estar ligado: ${ligados.join(', ')}`);
  await irPara(pagina, 'sell');
  certo(p, /chave do diário ainda não foi liberada/i.test(await textoDe(pagina, '#faixa-global .lv-faixa') || ''), 'aguardando a chave, a faixa global devia dizer isso em Vender primeiro');
  certo(p, (await textoDe(pagina, '#sell-content .lock-note')) === motivo, 'Vender primeiro devia mostrar o cadeado com o motivo');
  certo(p, await pagina.$$eval('#sell-content input[type=checkbox]', cs => cs.every(c => c.disabled)), 'as caixinhas deviam vir desligadas');
  await pagina.evaluate(() => { const d = window.financeHost.livro.diario(); d.modo = 'treino'; d.motivo = ''; document.dispatchEvent(new CustomEvent('financeiro:diario')); });
  await pagina.waitForFunction(() => !document.querySelector('#sell-content .lock-note') && [...document.querySelectorAll('#sell-content input[type=checkbox]')].every(c => !c.disabled), null, {timeout: 4000}).catch(() => null);
  certo(p, await pagina.$$eval('#sell-content input[type=checkbox]', cs => cs.every(c => !c.disabled)), 'de volta ao treino, as caixinhas deviam religar');
  await pagina.waitForFunction(() => /treino/i.test((document.querySelector('#faixa-global .lv-faixa') || {}).textContent || ''), null, {timeout: 3000}).catch(() => null);
  certo(p, /treino/i.test(await textoDe(pagina, '#faixa-global .lv-faixa') || ''), 'a faixa de treino não aparece em Vender primeiro');
  certo(p, await semSoLeitura(pagina), 'a página ainda diz “só de leitura”');
  await contexto.close();
}
{
  const p = passo('treino: uma folha aberta sobrevive a 3 ciclos de 2 s, mesmo com o diário mudando; fechar redesenha');
  const {contexto, pagina} = await abrir(p, '?demo=1#assinaturas');
  await diarioPronto(pagina, 'treino');
  await pagina.evaluate(() => { document.querySelector('#subscriptions-content .plan-card').__marca = 'antes'; });
  await pagina.click('#assinatura-nova');
  await pagina.waitForSelector(FOLHA);
  await pagina.fill(campo('Serviço'), 'Serviço digitado');
  await pagina.fill(campo('Valor', 'input.lv-dinheiro-valor'), '12,34');
  // outra gravação entra no diário com a folha aberta (o Figma é reativado): o snapshot muda, a página espera
  await pagina.evaluate(() => {
    const d = window.financeHost.livro.diario();
    const seq = d.eventos[d.eventos.length - 1].seq + 1, quando = new Date().toISOString();
    d.eventos.push({seq, id: 'teste-ciclo', membro: 'm-bia', ts: quando, treino: true, conteudo: {v: 1, acao: 'reactivate_plan', alvo: 'figma', versao: 1, quando}});
  });
  await pagina.waitForTimeout(6500);
  const durante = await pagina.evaluate(() => ({aberta: !!document.querySelector('dialog.sheet[open]'), servico: document.querySelector('dialog.sheet[open] input') && document.querySelector('dialog.sheet[open] input').value,
    valor: (document.querySelector('dialog.sheet[open] .lv-dinheiro-valor') || {}).value, mesmo: (document.querySelector('#subscriptions-content .plan-card') || {}).__marca === 'antes',
    figmaAtivo: !!document.querySelector('#subscriptions-content .plan-card[data-plan-id="figma"] [data-plan-action="encerrar"]')}));
  certo(p, durante.aberta && durante.servico === 'Serviço digitado' && durante.valor === '12,34', `a folha não sobreviveu aos ciclos: ${JSON.stringify(durante)}`);
  certo(p, durante.mesmo && !durante.figmaAtivo, 'os cartões foram redesenhados com a folha aberta');
  await pagina.click(`${FOLHA} button:text-is("Cancelar")`);
  const redesenhou = await pagina.waitForFunction(() => { const c = document.querySelector('#subscriptions-content .plan-card'); return c && c.__marca !== 'antes' && document.querySelector('#subscriptions-content .plan-card[data-plan-id="figma"] [data-plan-action="encerrar"]'); }, null, {timeout: 1500}).then(() => true, () => false);
  certo(p, redesenhou, 'ao fechar a folha, Assinaturas não se redesenhou com o que mudou (Figma reativado)');

  const p2 = passo('treino: o formulário de Editar sobrevive aos ciclos; mudar o valor tira a confirmação');
  await pagina.click(`${cartao('claude-max')} [data-plan-action="editar"]`);
  const valor = `${cartao('claude-max')} form.plan-edit-form input[inputmode=decimal]`;
  certo(p2, await pagina.$eval(valor, i => i.value) === '200,00', 'o valor de hoje devia vir à moda brasileira (200,00)');
  await pagina.fill(valor, '210,00');
  await pagina.waitForTimeout(4500);
  certo(p2, await pagina.$eval(valor, i => i.value).catch(() => null) === '210,00', 'o formulário de edição não sobreviveu aos ciclos');
  await pagina.click(`${cartao('claude-max')} form.plan-edit-form button[type=submit]`);
  await pagina.waitForFunction(s => { const c = document.querySelector(s); return c && !c.querySelector('form') && /US\$\s*210,00/.test(c.textContent) && c.querySelector('.pilula-confirmar') && /Alterado por Bauer/.test(c.textContent); }, cartao('claude-max'), {timeout: 4000}).catch(() => null);
  const claude = await textoDe(pagina, cartao('claude-max')) || '';
  certo(p2, /US\$\s*210,00/.test(claude) && /a confirmar/.test(claude) && /Alterado por Bauer em \d\d\/\d\d/.test(claude), `depois de Editar: ${claude.slice(0, 240)}`);

  const p3 = passo('treino: a ponte converte as mutações antigas pelo id e pela versão');
  const semMotivo = await pagina.evaluate(() => window.financeRequest('set_subscription', {id: 'github-team', version: 1, active: false, desde: '2026-10-19'}).then(() => 'gravou', e => e.message));
  certo(p3, /motivo/i.test(semMotivo), `set_subscription sem motivo devia ser recusado pelo razão: ${semMotivo}`);
  const comMotivo = await pagina.evaluate(() => window.financeRequest('set_subscription', {id: 'github-team', version: 1, active: false, desde: '2026-10-19', motivo: 'teste da ponte'}));
  certo(p3, comMotivo && comMotivo.saved === true, `set_subscription com data e motivo devia gravar: ${JSON.stringify(comMotivo)}`);
  await pagina.waitForFunction(s => { const c = document.querySelector(s); return c && c.classList.contains('inactive'); }, cartao('github-team'), {timeout: 3000}).catch(() => null);
  certo(p3, await pagina.$eval(cartao('github-team'), c => c.classList.contains('inactive')), 'o GitHub não ficou encerrado pela ponte');
  const velha = await pagina.evaluate(() => window.financeRequest('edit_plan', {id: 'claude-max', version: 1, values: {status: 'versão velha'}}).then(() => ({code: 'gravou'}), e => ({code: e.code, message: e.message})));
  certo(p3, velha.code === 'stale_plan' && /Outra pessoa mudou esta assinatura antes/.test(velha.message), `edição com versão velha devia voltar como conflito: ${JSON.stringify(velha)}`);
  const ruim = await pagina.evaluate(() => window.financeRequest('edit_plan', {id: 'workspace', version: 1, values: {valor: '84.5'}}).then(() => 'gravou', e => e.message));
  certo(p3, /vírgula/.test(ruim), `“84.5” em reais devia pedir vírgula: ${ruim}`);
  const passoAntigo = await pagina.evaluate(() => window.financeRequest('toggle_step', {id: 's9', version: 1, checked: true}));
  certo(p3, passoAntigo && passoAntigo.saved === true, 'toggle_step pela ponte devia gravar');
  certo(p3, await semSoLeitura(pagina), 'a página ainda diz “só de leitura”');
  await contexto.close();
}

{
  const p = passo('treino: encerrar com data futura troca Encerrar por “Desfazer o encerramento”, que desfaz sem recusa');
  const {contexto, pagina} = await abrir(p, '?demo=1#assinaturas');
  await diarioPronto(pagina, 'treino');
  const botoesDe = id => pagina.$$eval(`${cartao(id)} [data-plan-action]`, bs => bs.map(b => b.textContent + (b.disabled ? ' (desligado)' : '')));
  await pagina.click(`${cartao('claude-max')} [data-plan-action="encerrar"]`);
  await pagina.waitForSelector(FOLHA);
  await pagina.fill(campo('Desde quando'), '2026-12-01');
  await pagina.fill(campo('Motivo (fica no histórico)'), 'migrar para a API');
  await enviarFolha(pagina);
  const marcado = await pagina.waitForFunction(s => { const c = document.querySelector(s); return c && !document.querySelector('dialog.sheet[open]') && /Encerra em 01\/12\/2026 · por Bauer: migrar para a API/.test(c.textContent) && c.querySelector('[data-plan-action="reativar"]'); }, cartao('claude-max'), {timeout: 4000}).then(() => true, () => false);
  const botoes = await botoesDe('claude-max');
  certo(p, marcado && !botoes.includes('Encerrar') && botoes.includes('Desfazer o encerramento'), `com o encerramento marcado para 01/12, o cartão devia oferecer Desfazer no lugar de Encerrar: ${botoes.join(', ')}`);
  certo(p, !(await pagina.$eval(cartao('claude-max'), c => c.classList.contains('inactive'))) && botoes.includes('Marcar como paga'), 'até 01/12 a assinatura segue ativa (e pode ser marcada como paga)');
  const desfez = await cronometrar(pagina, 'desfazer', () => pagina.click(`${cartao('claude-max')} [data-plan-action="reativar"]`), s => { const c = document.querySelector(s); return c && !/Encerra em/.test(c.textContent) && c.querySelector('[data-plan-action="encerrar"]'); }, cartao('claude-max'));
  certo(p, desfez, 'Desfazer o encerramento não devolveu o cartão ao normal (com Encerrar e sem “Encerra em”)');
  certo(p, !(await textoDe(pagina, '#dashboard-error') || '').trim(), `desfazer mostrou erro: ${await textoDe(pagina, '#dashboard-error')}`);

  const p2 = passo('treino: Editar uma assinatura criada no portal, sem anotação de status: só o valor, depois o dia do vencimento');
  await pagina.click('#assinatura-nova');
  await pagina.waitForSelector(FOLHA);
  await pagina.fill(campo('Serviço'), 'Canva');
  await pagina.fill(campo('Valor', 'input.lv-dinheiro-valor'), '34,90');
  await enviarFolha(pagina);
  await pagina.waitForFunction(s => !document.querySelector('dialog.sheet[open]') && document.querySelector(s), cartao('pl-canva*'), {timeout: 4000}).catch(() => null);
  certo(p2, /Dia mensal de vencimento não informado/.test(await textoDe(pagina, cartao('pl-canva*')) || ''), 'a Canva sem dia devia pedir o dia do vencimento no cartão');
  await pagina.click(`${cartao('pl-canva*')} [data-plan-action="editar"]`);
  const form = `${cartao('pl-canva*')} form.plan-edit-form`;
  const visiveis = await pagina.$$eval(`${form} .field:not([hidden]) label`, ls => ls.map(l => l.textContent));
  certo(p2, visiveis.join('|') === 'Valor|Moeda|Período|Dia do vencimento (1 a 31)|Anotação de status', `campos do Editar de uma mensal: ${visiveis.join(', ')}`);
  certo(p2, await pagina.$eval(`${form} input[id^=plan-status]`, i => !i.required && i.value === ''), 'a anotação de status não pode ser obrigatória');
  await pagina.fill(`${form} input[inputmode=decimal]`, '39,90');
  await pagina.click(`${form} button[type=submit]`);
  const valorOk = await pagina.waitForFunction(s => { const c = document.querySelector(s); return c && !c.querySelector('form') && /R\$\s*39,90/.test(c.textContent); }, cartao('pl-canva*'), {timeout: 4000}).then(() => true, () => false);
  certo(p2, valorOk, `mudar só o valor devia gravar: ${(await textoDe(pagina, cartao('pl-canva*')) || '').slice(0, 200)}`);
  await pagina.click(`${cartao('pl-canva*')} [data-plan-action="editar"]`);
  await pagina.fill(`${form} input[id^=plan-day]`, '12');
  await pagina.click(`${form} button[type=submit]`);
  const diaOk = await pagina.waitForFunction(s => { const c = document.querySelector(s); return c && !c.querySelector('form') && /Vencimento mensal: dia 12/.test(c.textContent) && /Próxima data prevista: 12\/11\/2026/.test(c.textContent) && !/Dia mensal de vencimento não informado/.test(c.textContent); }, cartao('pl-canva*'), {timeout: 4000}).then(() => true, () => false);
  certo(p2, diaOk, `o dia do vencimento devia gravar e dar a próxima data: ${(await textoDe(pagina, cartao('pl-canva*')) || '').slice(0, 260)}`);

  const p3 = passo('treino: Editar muda o período (mensal → anual): aparece a próxima data, some o dia, e a confirmação volta a valer');
  await pagina.click(`${cartao('workspace')} [data-plan-action="editar"]`);
  const formW = `${cartao('workspace')} form.plan-edit-form`;
  await pagina.selectOption(`${formW} select[id^=plan-period]`, 'anual');
  const depois = await pagina.$$eval(`${formW} .field:not([hidden]) label`, ls => ls.map(l => l.textContent));
  certo(p3, depois.includes('Próxima data') && !depois.includes('Dia do vencimento (1 a 31)'), `anual devia pedir a próxima data, não o dia: ${depois.join(', ')}`);
  await pagina.fill(`${formW} input[id^=plan-date]`, '2027-01-01');
  await pagina.click(`${formW} button[type=submit]`);
  const anualOk = await pagina.waitForFunction(s => { const c = document.querySelector(s); return c && !c.querySelector('form') && /Cobrança da empresa · anual/.test(c.textContent) && /Próxima data: 01\/01\/2027/.test(c.textContent) && !/Vencimento mensal/.test(c.textContent) && c.querySelector('.pilula-confirmar'); }, cartao('workspace'), {timeout: 4000}).then(() => true, () => false);
  certo(p3, anualOk, `depois de mudar para anual: ${(await textoDe(pagina, cartao('workspace')) || '').slice(0, 300)}`);

  const p4 = passo('treino: Hotmart (por venda) traz uma nota no lugar do Confirmar; as notas de “Marcar como paga” sem jargão');
  certo(p4, !(await pagina.$(`${cartao('hotmart')} [data-plan-action="confirmar"]`)), 'a Hotmart não devia oferecer Confirmar (sem valor fixo não há o que conferir)');
  certo(p4, /Cobrança por venda: sem valor fixo, não entra no previsto\./.test(await textoDe(pagina, `${cartao('hotmart')} .plan-management`) || ''), 'a nota da cobrança por venda não aparece');
  certo(p4, !/hotmart|por venda/i.test(await textoDe(pagina, '#assinaturas-topo .as-contagem') || ''), 'a contagem do topo não devia citar a Hotmart');
  await pagina.click(`${cartao('hotmart')} [data-plan-action="editar"]`);
  certo(p4, await pagina.$eval(`${cartao('hotmart')} select[id^=plan-period]`, s => s.value === 'por venda' && [...s.options].some(o => o.value === 'anual')), 'o Editar da Hotmart devia manter “por venda” e oferecer os períodos fixos');
  await pagina.click(`${cartao('hotmart')} form.plan-edit-form button:text-is("Cancelar")`);
  certo(p4, /Paga segundo o pacote( de \d\d\/\d\d)?: marque só se o gasto ainda não está em Lançamentos\./.test(await textoDe(pagina, `${cartao('github-team')} .plan-management`) || ''), 'o GitHub (pago pelo pacote) devia explicar quando usar Marcar como paga');
  await pagina.click(`${cartao('claude-max')} [data-plan-action="pagar"]`);
  await pagina.waitForSelector(FOLHA);
  const folha = await textoDe(pagina, FOLHA) || '';
  certo(p4, /A anotação de status \(em Editar\) continua a mesma\./.test(folha) && !/Status livre/.test(folha), 'a folha Marcar como paga ainda fala em “Status livre”');
  await pagina.click(`${FOLHA} button:text-is("Cancelar")`);
  await contexto.close();
}

// ── 3 · fotos: Assinaturas e Vender primeiro nos 4 cortes, mais as folhas; nada de rolagem lateral a 390px ─────────────
if (FOTOS) for (const tela of ['desktop', 'celular']) for (const tema of ['claro', 'escuro']) {
  const combo = `${tela}-${tema}`;
  const p = passo(`fotos ${combo}`);
  const {contexto, pagina} = await abrir(p, '?demo=1#assinaturas', {tela, tema});
  await diarioPronto(pagina, 'treino');
  for (const [chave, nome] of [['subscriptions', 'assinaturas'], ['sell', 'vender-primeiro']]) {
    await irPara(pagina, chave);
    await pagina.evaluate(() => { const a = document.activeElement; if (a && a.id === 'dashboard-title') a.blur(); });
    await pagina.evaluate(() => document.fonts && document.fonts.ready);
    await pagina.waitForTimeout(350);
    const lateral = await pagina.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    certo(p, lateral <= 0, `${nome} rola para o lado (${lateral}px a mais)`);
    const arquivo = join(SAIDA, `${combo}-${nome}.png`);
    await pagina.screenshot({path: arquivo, fullPage: true});
    registro.fotos.push(arquivo);
  }
  await irPara(pagina, 'subscriptions');
  for (const [nome, abrirFolha] of [['folha-nova', () => pagina.click('#assinatura-nova')], ['folha-confirmar', () => pagina.click(`${cartao('pl-demo-notion')} [data-plan-action="confirmar"]`)], ['folha-pagar', () => pagina.click(`${cartao('claude-max')} [data-plan-action="pagar"]`)]]) {
    if (tela === 'desktop' && tema === 'escuro' && nome !== 'folha-nova') continue;
    await abrirFolha();
    await pagina.waitForSelector(FOLHA);
    await pagina.waitForTimeout(300);
    const lateral = await pagina.evaluate(() => { const d = document.querySelector('dialog.sheet[open]'); return d.scrollWidth - d.clientWidth; });
    certo(p, lateral <= 0, `${nome} rola para o lado (${lateral}px)`);
    const arquivo = join(SAIDA, `${combo}-${nome}.png`);
    await pagina.screenshot({path: arquivo});
    registro.fotos.push(arquivo);
    await pagina.click(`${FOLHA} button:text-is("Cancelar")`);
    await pagina.waitForTimeout(200);
  }
  await contexto.close();
}

await navegador.close();
servidor.close();
for (const e of registro.erros) falha('erros da página', `${e.rotulo} · ${e.tipo} · ${e.texto}`);
await writeFile(join(SAIDA, 'registro.json'), JSON.stringify(registro, null, 2));
console.log(`\n${registro.passos.length} passos · ${registro.fotos.length} fotos em ${SAIDA} · tempos ${JSON.stringify(registro.tempos)} · ${registro.falhas.length} falha(s)`);
if (registro.falhas.length) process.exitCode = 1;
