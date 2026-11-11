// Prova de Lançamentos com fonte inteiramente fictícia. O Excel real nunca é servido por este arnês.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {chromium, webkit} from 'playwright';
import {servir} from '../servir.mjs';
import {estadoComLivro} from '../../../testes/fixtures/livro-caixa.mjs';

const argumento = (nome, padrao) => { const i = process.argv.indexOf('--' + nome); return i >= 0 ? process.argv[i + 1] : padrao; };
const saida = resolve(argumento('saida', join(process.env.TMPDIR, 'portal-caixa-lancamentos')));
const motores = argumento('motores', 'chromium,webkit').split(',');
await mkdir(saida, {recursive: true});
const servidor = await servir(0);
const base = `http://127.0.0.1:${servidor.address().port}`;
const registro = {provas: [], erros: [], falhas: [], fotos: []};
const estado = estadoComLivro();
try {
  for (const motor of motores) {
    const browser = await ({chromium, webkit})[motor].launch({headless: true});
    try {
      for (const width of [1280, 390]) for (const tema of ['claro', 'escuro']) {
        const nome = `${motor}-${width}-${tema}`;
        const contexto = await browser.newContext({viewport: {width, height: 900}, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo'});
        await contexto.addInitScript(t => localStorage.setItem('orquestrator-financas.tema', t), tema);
        await contexto.route('**/estado-ficticio.js', r => r.fulfill({contentType: 'text/javascript', body: 'export const estadoFicticio = ' + JSON.stringify(estado) + ';'}));
        const page = await contexto.newPage();
        page.on('pageerror', e => registro.erros.push({nome, erro: String(e)}));
        page.on('console', m => { if (m.type() === 'error') registro.erros.push({nome, erro: m.text()}); });
        try {
          await page.goto(base + '/?data=2031-11-21&membro=m-dona#lancamentos', {waitUntil: 'networkidle'});
          await page.waitForSelector('#dashboard:not([hidden])');
          const cards = page.locator('#lancamentos-content .lv-gasto');
          assert.equal(await cards.count(), 3, 'entradas do livro também precisam aparecer; não só despesas');
          assert.match(await page.locator('#lancamentos-content').innerText(), /Aporte fictício/);
          assert.equal(await page.locator('#lancamentos-content .lv-importado .lv-autoria').count(), 3);
          assert.doesNotMatch(await page.locator('#lancamentos-content').innerText(), /lançado por —|pago por —/);
          assert.equal(await page.locator('#lancamentos-content .lv-importado button').filter({hasText: /^Editar$|^Anular$/}).count(), 0);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'sem overflow lateral');
          const foto = join(saida, nome + '-lancamentos.png');
          await page.screenshot({path: foto, fullPage: true}); registro.fotos.push(foto);
          await page.getByRole('button', {name: 'Ver origem', exact: true}).first().click();
          await page.waitForSelector('dialog[open]');
          assert.match(await page.locator('dialog[open]').innerText(), /Livro fictício.xlsx/);
          assert.match(await page.locator('dialog[open]').innerText(), /linha|Linha/);
          await page.keyboard.press('Escape');
          await page.getByLabel('Filtrar por tipo').selectOption('entrada');
          assert.equal(await cards.count(), 1);
          assert.match(await page.locator('#lancamentos-content').innerText(), /Aporte fictício/);
          assert.match(new URL(page.url()).hash, /tipo=entrada/);
          const downloadPromise = page.waitForEvent('download');
          await page.getByRole('button', {name: 'Baixar CSV', exact: true}).click();
          const arquivo = await (await downloadPromise).path();
          const csv = await readFile(arquivo, 'utf8');
          assert.equal(csv.trim().split('\r\n').length, 2, 'CSV respeita o tipo filtrado');
          assert.match(csv, /Aporte fictício/);
          assert.doesNotMatch(csv, /Renovação Aurora/);
          await page.reload({waitUntil: 'networkidle'});
          assert.equal(await page.getByLabel('Filtrar por tipo').inputValue(), 'entrada', 'filtro sobrevive ao recarregamento pela rota');
          assert.equal(await cards.count(), 1);
          await page.getByLabel('Filtrar por tipo').selectOption('todos');
          await page.getByLabel('Filtrar por mês').selectOption('2031-10');
          assert.equal(await cards.count(), 2);
          await page.getByLabel('Filtrar por mês').selectOption('2031-12');
          assert.equal(await cards.count(), 0, 'aba futura não cria lançamento');
          await page.getByLabel('Filtrar por mês').selectOption('');
          await page.getByLabel('Filtrar por sócia').selectOption('eu');
          assert.equal(await cards.count(), 0, 'planilha sem autoria não é atribuída à sessão');
          await page.getByLabel('Filtrar por sócia').selectOption('todas');
          const gravado = await page.evaluate(() => window.financeLivro.gravar({acao: 'add_expense', alvo: 'g-ui-ficticio', dados: {
            data: '2031-11-21', competencia: '2031-11', descricao: 'Despesa nova no diário', categoria: 'outros', valorMinor: 345,
            moeda: 'BRL', forma: 'conta_pj', pagoPor: 'm-dona', destino: 'nao_aplica', documento: '', nota: '', planoId: null,
          }}));
          assert.equal(gravado.ok, true);
          assert.equal(await cards.count(), 4);
          await page.getByLabel('Filtrar por origem').selectOption('diario');
          assert.equal(await cards.count(), 1);
          assert.match(await cards.innerText(), /Despesa nova no diário/);
          await page.evaluate(() => {
            const h = window.financeHost.livro, c = h.contexto(), d = h.diario();
            c.estado.livroCaixa.conciliacao = {diarioAteSeq: 2, gastoIds: ['g-historico-ficticio'], autorizacao: 'Decisão fictícia: planilha como referência, anterior só histórico.', decididoEm: '2031-11-21T12:00:00Z'};
            d.eventos.push({seq: 2, id: 'ev-historico-ficticio', membro: 'm-dona', conteudo: {acao: 'add_expense', alvo: 'g-historico-ficticio', quando: '2031-10-20T12:00:00Z', dados: {
              data: '2031-10-20', competencia: '2031-10', descricao: 'Pagamento anterior preservado', categoria: 'software_ia', valorMinor: 1234,
              moeda: 'BRL', forma: 'cartao_pessoal', pagoPor: 'm-dona', destino: 'empresa_reembolsa', planoId: 'pl-mensal',
            }}});
            window.financeLivro.renderTudo(true);
          });
          assert.equal(await page.getByLabel('Filtrar por origem').locator('option[value="historico"]').count(), 1, 'histórico conciliado tem filtro próprio');
          await page.getByLabel('Filtrar por origem').selectOption('todas');
          assert.match(await page.locator('#lancamentos-content .lv-totais').innerText(), /4 movimentos/);
          assert.match(await page.locator('#lancamentos-content .lv-totais').innerText(), /não somado/);
          assert.equal(await page.locator('#lancamentos-content .lv-historico-fonte').count(), 1);
          assert.equal(await page.locator('#lancamentos-content .lv-historico-fonte button').filter({hasText: /^Editar$|^Anular$/}).count(), 0);
          await page.getByLabel('Filtrar por origem').selectOption('historico');
          assert.equal(await cards.count(), 1);
          assert.match(await cards.innerText(), /Pagamento anterior preservado/);
          registro.provas.push({nome, ok: true, movimentosImportados: 3, misturaDiario: true, filtros: true, csv: true, origem: true, historicoNaoSomado: true});
        } catch (e) {
          registro.falhas.push({nome, erro: e.stack || String(e)});
        } finally { await contexto.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(ok => servidor.close(ok)); }
await writeFile(join(saida, 'resultado.json'), JSON.stringify(registro, null, 2));
console.log(JSON.stringify({provas: registro.provas.length, falhas: registro.falhas, erros: registro.erros, fotos: registro.fotos.length, saida}, null, 2));
if (registro.falhas.length || registro.erros.length) process.exitCode = 1;
