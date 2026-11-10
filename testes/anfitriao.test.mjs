// Os dois anfitriões da mesma interface (anfitriao.js + static-bridge.js): no portal publicado atende a ponte estática
// (só leitura, com diário e perfis); na aba Finanças do AI Cask atende a ponte nativa, e a estática CEDE: não troca o
// host que o app apresentou, não instala a ponte da web, não esconde o CPF do formulário, e só completa o host com o
// Laboratório do repositório. Confere também a regra de visibilidade das páginas (requer) e os rótulos por host.
// Uso: node --test testes/*.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {ponteNativa, completarHostNativo} from '../anfitriao.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = arquivo => readFileSync(join(raiz, arquivo), 'utf8');
const comPonte = extra => ({webkit: {messageHandlers: {finance: {postMessage() {}}}}, ...extra});

test('ponteNativa: só com messageHandlers.finance.postMessage de verdade', () => {
  assert.equal(ponteNativa(comPonte()), true);
  for (const janela of [undefined, null, {}, {webkit: {}}, {webkit: {messageHandlers: {}}}, {webkit: {messageHandlers: {finance: {}}}},
    {webkit: {messageHandlers: {finance: {postMessage: 'sim'}}}}, {webkit: {messageHandlers: {outra: {postMessage() {}}}}}]) {
    assert.equal(ponteNativa(janela), false, JSON.stringify(janela));
  }
});

test('completarHostNativo: mantém o que o app declarou e só acrescenta o Laboratório', async () => {
  const pedidos = [];
  const galeria = {url: async file => { pedidos.push(file); return 'blob:prova/' + file; }, titulo: file => 'Título de ' + file};
  const injetado = {kind: 'aicask', tema: 'escuro', galeria: true, team: false, readOnly: false, decide: true};
  const janela = comPonte({financeHost: injetado});
  const host = completarHostNativo(janela, galeria);
  assert.equal(host, injetado, 'o host é o mesmo objeto que o app apresentou');
  assert.deepEqual({kind: host.kind, tema: host.tema, galeria: host.galeria, team: host.team, readOnly: host.readOnly, decide: host.decide},
    {kind: 'aicask', tema: 'escuro', galeria: true, team: false, readOnly: false, decide: true});
  assert.equal(await host.galeriaUrl('apps/sinal.html'), 'blob:prova/apps/sinal.html');
  assert.equal(host.galeriaTitle('index.html'), 'Título de index.html');
  assert.deepEqual(pedidos, ['apps/sinal.html']);
  // nada do portal vaza para o host do app
  for (const chave of ['livro', 'perfis', 'painelUrl', 'painelLink', 'galeriaTelaCheia']) assert.ok(!(chave in host), chave);

  // o app decide se há Laboratório: com galeria desligada, nada é acrescentado
  const semLab = completarHostNativo(comPonte({financeHost: {kind: 'aicask', galeria: false}}), galeria);
  assert.deepEqual(Object.keys(semLab).sort(), ['galeria', 'kind']);
  // ponte nativa sem host apresentado (não deve acontecer): nasce um host mínimo, sem Laboratório e sem nada do portal
  const vazia = comPonte();
  assert.deepEqual(completarHostNativo(vazia, galeria), {kind: 'aicask'});
  assert.deepEqual(vazia.financeHost, {kind: 'aicask'});
});

// A ponte publicada, executada de verdade numa janela de mentira: ao carregar, o módulo só toca window, document e
// location. Cada caso carrega uma instância nova do módulo (o ?caso= no endereço).
let caso = 0;
async function carregarPonte(janela) {
  const linhaCpf = {hidden: false}, linhaLembrar = {hidden: false};
  const cpf = {required: true, removidos: [], removeAttribute(nome) { this.removidos.push(nome); }, closest: () => linhaCpf, parentElement: linhaCpf};
  const lembrar = {closest: () => linhaLembrar};
  const ajuda = {textContent: 'Sem conta cadastrada? Fale com o Criador.'};
  const nos = {'login-cpf': cpf, 'login-remember': lembrar, 'login-help': ajuda};
  const antes = {window: globalThis.window, document: globalThis.document, location: globalThis.location};
  globalThis.window = janela;
  globalThis.document = {documentElement: {dataset: {}}, getElementById: id => nos[id] || null};
  globalThis.location = {href: 'https://portal.exemplo/financas/'};
  try { await import(pathToFileURL(join(raiz, 'static-bridge.js')).href + '?caso=' + (++caso)); }
  finally { for (const [nome, valor] of Object.entries(antes)) { if (valor === undefined) delete globalThis[nome]; else globalThis[nome] = valor; } }
  return {janela, linhaCpf, linhaLembrar, cpf, ajuda};
}

test('static-bridge.js sob a ponte nativa: cede (host do app intacto, sem ponte da web, formulário com CPF)', async () => {
  const injetado = {kind: 'aicask', tema: 'claro', galeria: true, team: false, readOnly: false, decide: false};
  const {janela, linhaCpf, linhaLembrar, cpf, ajuda} = await carregarPonte(comPonte({financeHost: injetado}));
  assert.equal(janela.financeHost, injetado);
  assert.equal(janela.financeHost.kind, 'aicask');
  assert.equal(janela.financeHost.readOnly, false);
  assert.equal(janela.financeHost.team, false);
  assert.equal(typeof janela.financeHost.galeriaUrl, 'function');
  assert.equal(typeof janela.financeHost.galeriaTitle, 'function');
  for (const chave of ['livro', 'perfis', 'painelUrl', 'painelLink', 'galeriaTelaCheia']) assert.ok(!(chave in janela.financeHost), chave);
  assert.equal(janela.financeWebRequest, undefined, 'a ponte da web não é instalada');
  assert.equal(janela.financeOpenTeam, undefined, '«Minha equipe» é do portal');
  assert.deepEqual({cpf: linhaCpf.hidden, lembrar: linhaLembrar.hidden, exigido: cpf.required, removidos: cpf.removidos, ajuda: ajuda.textContent},
    {cpf: false, lembrar: false, exigido: true, removidos: [], ajuda: 'Sem conta cadastrada? Fale com o Criador.'});
});

test('static-bridge.js sem a ponte nativa: é o portal (só leitura, com diário e perfis, entrada só com a senha)', async () => {
  const {janela, linhaCpf, linhaLembrar, cpf, ajuda} = await carregarPonte({});
  const host = janela.financeHost;
  assert.deepEqual({kind: host.kind, galeria: host.galeria, team: host.team, readOnly: host.readOnly, decide: host.decide},
    {kind: 'portal', galeria: true, team: true, readOnly: true, decide: false});
  for (const chave of ['galeriaUrl', 'galeriaTitle', 'galeriaTelaCheia', 'painelUrl', 'painelLink']) assert.equal(typeof host[chave], 'function', chave);
  assert.equal(typeof host.livro.contexto, 'function');
  assert.equal(typeof host.perfis.ler, 'function');
  assert.equal(host.livro.contexto(), null, 'sem sessão, não há contexto do livro');
  assert.equal(typeof janela.financeWebRequest, 'function');
  assert.equal(typeof janela.financeOpenTeam, 'function');
  await assert.rejects(() => janela.financeWebRequest('restore_session'), erro => erro.code === 'unauthenticated');
  await assert.rejects(() => janela.financeWebRequest('snapshot'), erro => erro.code === 'unauthenticated');
  assert.deepEqual(await janela.financeWebRequest('preferences', {tema: 'escuro'}), {tema: 'escuro'});
  assert.equal(host.tema, 'escuro');
  assert.deepEqual({cpf: linhaCpf.hidden, lembrar: linhaLembrar.hidden, exigido: cpf.required, removidos: cpf.removidos},
    {cpf: true, lembrar: true, exigido: false, removidos: ['pattern', 'minlength', 'maxlength']});
  assert.match(ajuda.textContent, /senha é a do portal/);
});

test('app.js: a página que pede uma capacidade só aparece quando o host a traz (ligada ou como objeto)', () => {
  const fonte = ler('app.js');
  const trecho = fonte.match(/function capacidade\(nome\) \{[^\n]*\}\n\s*function paginaVisivel\(entrada\) \{[^\n]*\}/);
  assert.ok(trecho, 'as duas funções continuam juntas no app.js');
  const visivelCom = hostAtual => vm.runInNewContext(`(() => { const host = () => hostAtual; ${trecho[0]}; return paginaVisivel; })()`, {hostAtual});
  const lab = {chave: 'lab', requer: 'galeria'}, livro = {chave: 'livro', requer: 'livro'}, caixa = {chave: 'cash'};
  const portal = visivelCom({galeria: true, livro: {contexto() {}, diario() {}}});
  assert.deepEqual([portal(lab), portal(livro), portal(caixa), portal(null)], [true, true, true, false]);
  const aicask = visivelCom({kind: 'aicask', galeria: true});
  assert.deepEqual([aicask(lab), aicask(livro), aicask(caixa)], [true, false, true]);
  for (const valor of [false, null, undefined, 0, '', 'sim', 1]) assert.equal(visivelCom({livro: valor, galeria: valor})(livro), false, String(valor));
  // nenhuma lista fixa das páginas do diário no app.js: quem decide é o registro (paginas.js) com o host
  assert.ok(!/requer === ["']livro["']/.test(fonte));
});

test('os rótulos por host: o registro do Caixa diz de onde vem em cada anfitrião', () => {
  const fonte = ler('app.js'), html = ler('index.html');
  const local = fonte.match(/local: \{([^}]*)\}/)[1], portal = fonte.match(/portal: \{([^}]*)\}/)[1];
  assert.match(local, /imported: "Registros locais da empresa"/);
  assert.match(portal, /imported: "Registro importado do pacote de 18\/10"/);
  // toda chave pedida no index.html existe nos dois hosts (senão o rótulo sairia vazio num deles)
  const pedidas = [...html.matchAll(/data-host-text="([a-z]+)"/g)].map(m => m[1]);
  assert.ok(pedidas.includes('imported'));
  for (const chave of new Set(pedidas)) { assert.match(local, new RegExp('\\b' + chave + ': "'), 'local.' + chave); assert.match(portal, new RegExp('\\b' + chave + ': "'), 'portal.' + chave); }
});

test('produtos.js: sob a ponte nativa nenhum link pede aba nova', () => {
  const fonte = ler('produtos.js');
  assert.match(fonte, /const semAbas = Boolean\(window\.webkit && window\.webkit\.messageHandlers && window\.webkit\.messageHandlers\.finance\);/);
  // cada target="_blank" do arquivo fica num ramo que só roda sem a ponte nativa
  const linhas = fonte.split('\n');
  const comAba = linhas.map((linha, k) => [k, linha]).filter(([, linha]) => /target = "_blank"/.test(linha));
  assert.equal(comAba.length, 3);
  assert.match(fonte, /if \(semAbas\) fig\.append\(img\); else \{ a\.append\(img\); fig\.append\(a\); \}/);
  assert.match(fonte, /if \(p\.telaCheia && !semAbas\) \{/);
  assert.match(fonte, /if \(p\.app && semAbas\) acoes\.append\(el\("span", "mp-secao-texto", "Página publicada: " \+ p\.app\.url\)\);\n\s*else if \(p\.app\) \{/);
});
