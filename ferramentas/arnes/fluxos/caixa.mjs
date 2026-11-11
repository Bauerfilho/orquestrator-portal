// Prova HEADLESS do Caixa. Todas as pessoas, senhas, movimentos e valores são fictícios.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {servir} from '../servir.mjs';
import {estadoComLivro} from '../../../testes/fixtures/livro-caixa.mjs';
const args=process.argv.slice(2), opcao=(nome,padrao)=>args.includes(nome)?args[args.indexOf(nome)+1]:padrao;
const saida=path.resolve(opcao('--saida',process.env.BH_AGENT_WORKSPACE||process.env.TMPDIR||'.'));
fs.mkdirSync(saida,{recursive:true});
const motores=opcao('--motores','chromium,webkit').split(',');
const server=await servir(0), base='http://127.0.0.1:'+server.address().port;
const resultado={provas:[],falhas:[],erros:[],fotos:[]};
try {
  for(const nomeMotor of motores) {
    const browser=await ({chromium,webkit}[nomeMotor]).launch({headless:true});
    try {
      for(const largura of [1280,390])for(const tema of ['claro','escuro']) {
        const nome=`${nomeMotor}-${largura}-${tema}`;
        const context=await browser.newContext({viewport:{width:largura,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
        await context.addInitScript(t=>localStorage.setItem('orquestrator-financas.tema',t),tema);
        await context.route('**/estado-ficticio.js',r=>r.fulfill({contentType:'text/javascript',body:'export const estadoFicticio='+JSON.stringify(estadoComLivro())+';'}));
        const page=await context.newPage();page.setDefaultTimeout(12000);
        await page.clock.setFixedTime(new Date('2031-11-21T15:00:00Z'));
        page.on('pageerror',e=>resultado.erros.push({nome,erro:String(e)}));
        page.on('console',m=>{if(m.type()==='error')resultado.erros.push({nome,erro:m.text()});});
        try {
          await page.goto(base+'/?data=2031-11-21&membro=m-dona#caixa/2031-11',{waitUntil:'networkidle'});
          await page.waitForSelector('#dashboard:not([hidden])');
          await page.waitForSelector('#cx-fonte .lv-kpi');
          assert.equal(await page.locator('#cx-fonte .cx-movimento').count(),1);
          assert.match(await page.locator('#cx-fonte').innerText(),/267,66/);
          assert.match(await page.locator('#cx-fonte').innerText(),/Novembro fictício.*linha 4/s);
          assert.match(await page.locator('#cx-banco').innerText(),/não informado|nenhum saldo/i);
          assert.doesNotMatch(await page.locator('#cx-banco .lv-kpi-valor').innerText(),/0,00|267,66/);
          assert.match(await page.locator('#cx-folego').innerText(),/precisa de 1 mês fechado/);
          assert.equal(await page.locator('#cx-fluxo-fonte .gf-fluxo').count(),1);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'sem rolagem lateral');
          assert.equal(await page.locator('#cx-lancar').isVisible(),true,'ação de gasto continua disponível no fluxo');
          if(largura===390)assert.equal(await page.locator('.lv-fab').isVisible(),false,'FAB não pode cobrir o saldo escriturado');
          await page.locator('#cx-lancar').click();
          const gasto=page.getByRole('dialog',{name:'Lançar gasto',exact:true});await gasto.waitFor();
          await gasto.getByRole('button',{name:'Cancelar',exact:true}).click();await gasto.waitFor({state:'hidden'});
          const foto=path.join(saida,nome+'-caixa.png');await page.screenshot({path:foto,fullPage:true});resultado.fotos.push(foto);
          await page.getByLabel('Mês do Caixa').selectOption('2031-10');
          assert.equal(await page.locator('#cx-fonte .cx-movimento').count(),2);
          assert.match(await page.locator('#cx-fonte').innerText(),/300,00/);
          const descricoes=await page.locator('#cx-fonte .cx-movimento h4').allTextContents();
          assert.deepEqual(descricoes,['Aporte fictício','Renovação Aurora']);
          await page.getByLabel('Mês do Caixa').selectOption('2031-12');
          assert.equal(await page.locator('#cx-fonte .cx-movimento').count(),0);
          assert.match(await page.locator('#cx-fonte').innerText(),/sem movimentos preenchidos/i);
          await page.getByLabel('Mês do Caixa').selectOption('2031-11');
          await page.locator('#cx-fonte').getByRole('button',{name:'Ver em Lançamentos'}).click();
          await page.waitForSelector('#block-lancamentos:not([hidden])');
          assert.equal(await page.getByLabel('Filtrar por mês').inputValue(),'2031-11');
          assert.equal(await page.getByLabel('Filtrar por origem').inputValue(),'planilha');
          await page.evaluate(()=>window.financeNavigate('cash',true,{args:['2031-11']}));
          if(largura===390&&tema==='claro') {
            // O mesmo formulário e o mesmo gravar do portal, em treino isolado: nada alcança o diário remoto.
            await page.locator('#cx-nova-receita').click();
            let dialogo=page.getByRole('dialog',{name:'Registrar receita'});
            await dialogo.getByLabel('Produto').fill('Produto inteiramente fictício');
            await dialogo.getByLabel('Receita bruta em reais').fill('100,00');
            await dialogo.getByLabel('Número de vendas').fill('1');
            await dialogo.getByRole('button',{name:'Registrar receita',exact:true}).click();
            await dialogo.waitFor({state:'hidden'});
            await page.locator('#cx-receitas .cx-receita').waitFor();
            assert.equal(await page.locator('#cx-receitas .cx-receita').count(),1);
            let estado=await page.evaluate(()=>window.financeHost.livro.diario().eventos.map(e=>e.conteudo));
            assert.equal(estado.at(-1).acao,'add_income');assert.equal(estado.at(-1).dados.brutoMinor,10000);
            await page.locator('#cx-receitas').getByRole('button',{name:'Editar'}).click();
            dialogo=page.getByRole('dialog',{name:'Editar receita'});
            await page.evaluate(async()=>{const d=window.financeHost.livro.diario(),r=d.eventos.find(e=>e.conteudo.acao==='add_income').conteudo;await d.acrescentar({acao:'edit_income',alvo:r.alvo,versao:1,dados:{...r.dados,brutoMinor:9000}});window.financeLivro.renderTudo(true);});
            await dialogo.getByLabel('Receita bruta em reais').fill('200,00');
            await dialogo.getByRole('button',{name:'Salvar alteração',exact:true}).click();
            await page.waitForFunction(()=>document.querySelector('dialog[open] [role=alert]')?.textContent.match(/mudou|versão|atualiz/i));
            assert.equal(await page.evaluate(()=>window.financeHost.livro.diario().eventos.length),2,'versão antiga não pode sobrescrever a nova');
            await dialogo.getByRole('button',{name:'Cancelar',exact:true}).click();
            await page.locator('#cx-informar-saldo').click();
            dialogo=page.getByRole('dialog',{name:'Informar saldo bancário'});
            await dialogo.getByLabel('Conta').fill('Banco fictício');
            await dialogo.getByLabel('Data do saldo').fill('2031-11-22');
            await dialogo.getByLabel('Saldo em reais').fill('905,25');
            await dialogo.getByLabel('Fonte do saldo').fill('Extrato fictício');
            await dialogo.getByRole('button',{name:'Registrar saldo',exact:true}).click();
            await page.waitForFunction(()=>document.querySelector('dialog[open] [role=alert]')?.textContent.match(/data|chegou/i));
            assert.equal(await page.evaluate(()=>window.financeHost.livro.diario().eventos.length),2,'saldo futuro não foi registrado');
            await dialogo.getByLabel('Data do saldo').fill('2031-11-21');
            await dialogo.getByRole('button',{name:'Registrar saldo',exact:true}).click();
            await dialogo.waitFor({state:'hidden'});
            await page.waitForFunction(()=>document.querySelector('#cx-banco .lv-kpi-valor')?.textContent.includes('905,25'));
            assert.match(await page.locator('#cx-banco .lv-kpi-valor').innerText(),/905,25/);
            assert.match(await page.locator('#cx-fonte').innerText(),/267,66/,'banco não altera saldo da planilha');
            assert.match(await page.locator('#cx-banco').innerText(),/Banco fictício.*Extrato fictício/s);
            await page.locator('#cx-receitas').getByRole('button',{name:'Anular',exact:true}).click();
            dialogo=page.getByRole('dialog',{name:'Anular receita'});
            await dialogo.getByLabel('Motivo da anulação').fill('Demonstração fictícia de anulação.');
            await dialogo.getByRole('button',{name:'Anular receita',exact:true}).click();await dialogo.waitFor({state:'hidden'});
            estado=await page.evaluate(()=>window.financeHost.livro.diario().eventos.map(e=>e.conteudo));
            assert.equal(estado.at(-1).acao,'void_income');assert.ok(estado.at(-1).motivo);
          }
          resultado.provas.push({nome,ok:true});
        }catch(e){
          const estado=await page.evaluate(async()=>{const c=window.financeHost?.livro?.contexto(),d=window.financeHost?.livro?.diario();if(!c||!d)return null;const R=await import('/razao.js'),a=R.aplicar(c.estado,d.eventos);return {href:location.href,mes:document.getElementById('cx-mes')?.value,eventos:d.eventos,receitas:a.receitas,saldos:a.saldos,recusados:a.recusados,texto:document.getElementById('cx-receitas')?.textContent};}).catch(()=>null);
          resultado.falhas.push({nome,erro:e.stack||String(e),estado});
        }
        finally{await context.close();}
      }
    }finally{await browser.close();}
  }
}finally{await new Promise(ok=>server.close(ok));}
fs.writeFileSync(path.join(saida,'resultado.json'),JSON.stringify(resultado,null,2));
console.log(JSON.stringify({provas:resultado.provas.length,falhas:resultado.falhas,erros:resultado.erros,fotos:resultado.fotos.length,saida},null,2));
if(resultado.falhas.length||resultado.erros.length)process.exitCode=1;
