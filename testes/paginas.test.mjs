// O mapa do portal (paginas.js, fatia F2-4): o registro único das páginas (gaveta, rotas e "Como ler esta página") e as
// rotas por hash. Confere a ordem dos grupos, que cada página tem a seção no index.html e a ajuda inteira, que o hash
// só guarda página e filtros com formato conhecido (nunca valores, nomes ou textos), os atalhos do PWA e que nenhuma
// lista fixa de páginas sobrou no app.js nem no fotografar.mjs. Uso: node --test testes/*.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = arquivo => readFileSync(join(raiz, arquivo), 'utf8');

// o paginas.js é script clássico: roda numa janela de mentira e devolve o que ele pendura nela
function carregar() {
  const window = {};
  vm.runInNewContext(ler('paginas.js'), {window, URLSearchParams, decodeURIComponent});
  return window;
}
// os objetos e listas nascem em outro reino (vm): passam por JSON para o deepEqual comparar só o conteúdo
const puro = valor => JSON.parse(JSON.stringify(valor));
const W = carregar();
const {montar, ancora} = W.financeRotas;
const lerRota = hash => puro(W.financeRotas.ler(hash));
const GRAMATICA = /^#[a-z][a-z0-9-]*(\/[A-Za-z0-9._:-]+)*(\?[a-z]+=[A-Za-z0-9._:-]+(&[a-z]+=[A-Za-z0-9._:-]+)*)?$/;

test('a gaveta: Dinheiro · Planejar · Empresa · Ajuda, na ordem do plano, numerada em sequência', () => {
  assert.deepEqual(puro(W.financeGrupos), ['Dinheiro', 'Planejar', 'Empresa', 'Ajuda']);
  const porGrupo = Object.fromEntries(W.financeGrupos.map(g => [g, W.financePaginas.filter(p => p.grupo === g).map(p => p.titulo)]));
  assert.deepEqual(puro(porGrupo), {
    Dinheiro: ['Meu painel', 'Livro do mês', 'Caixa', 'Lançamentos', 'Assinaturas', 'Parâmetros'],
    Planejar: ['Med Painel', 'Projeção', 'Vender primeiro'],
    Empresa: ['Sociedade', 'Portfólio', 'Laboratório'],
    Ajuda: ['Histórico'],   // Como fazer e Estado do portal entram prontos na F2-10 (nenhuma página vazia no ar)
  });
  assert.deepEqual(W.financePaginas.map(p => p.numero), W.financePaginas.map((_, k) => String(k + 1).padStart(2, '0')));
  assert.ok(W.financePaginas.every(p => W.financeGrupos.includes(p.grupo)), 'toda página está num dos 4 grupos');
});

test('cada página tem chave e rota únicas, título, descrição, as três linhas de ajuda e a seção no index.html', () => {
  const html = ler('index.html');
  const chaves = W.financePaginas.map(p => p.chave), rotas = W.financePaginas.map(p => p.rota);
  assert.equal(new Set(chaves).size, chaves.length);
  assert.equal(new Set(rotas).size, rotas.length);
  for (const p of W.financePaginas) {
    assert.match(p.rota, /^[a-z][a-z0-9-]{1,39}$/, p.chave);
    assert.ok(p.titulo && p.descricao, p.chave + ': título e descrição');
    for (const linha of ['oque', 'deonde', 'naoe']) assert.ok(typeof p.ajuda[linha] === 'string' && p.ajuda[linha].length > 20, `${p.chave}: ajuda.${linha}`);
    assert.ok(html.includes(`data-finance-page="${p.chave}"`), `${p.chave}: falta a <section data-finance-page> no index.html`);
  }
  // o texto do Laboratório é o que o PR dos perfis reescreveu (tela cheia, dados fictícios)
  assert.match(W.financePaginas.find(p => p.chave === 'lab').ajuda.oque, /tela cheia/);
  assert.equal(W.financePaginas.find(p => p.chave === 'lab').requer, 'galeria');
});

test('a ajuda da Sociedade diz o que a página faz hoje: os perfis gravam pelo diário (não é mais só consulta)', () => {
  const {ajuda} = W.financePaginas.find(p => p.chave === 'society');
  assert.match(ajuda.deonde, /diário cifrado/);
  assert.match(ajuda.deonde, /Atualizar perfis/);
  assert.doesNotMatch(ajuda.naoe, /É consulta|nem registra alterações/);
  assert.match(ajuda.naoe, /contrato social/);
  assert.match(ajuda.naoe, /próprio perfil/);
});

test('o index.html: gaveta vazia montada pelo registro, "+ Lançar" no topo, faixa global e paginas.js antes do app.js', () => {
  const html = ler('index.html');
  assert.ok(!/data-navigate=/.test(html), 'nenhum botão de página fixo no index.html: a gaveta vem do registro');
  assert.match(html, /<button id="drawer-lancar"[^>]*>\+ Lançar/);
  assert.match(html, /<nav id="drawer-nav" class="drawer-nav" aria-label="Páginas de Finanças"><\/nav>/);
  assert.ok(html.indexOf('id="drawer-lancar"') < html.indexOf('id="drawer-nav"'), '"+ Lançar" vem antes das páginas');
  assert.match(html, /<div class="page-stage">\s*<div id="faixa-global"><\/div>/, 'a faixa de treino é o primeiro item do page-stage');
  const paginas = html.indexOf('<script src="paginas.js" defer></script>'), app = html.indexOf('<script src="app.js" defer></script>');
  assert.ok(paginas > 0 && app > paginas, 'paginas.js (defer) carrega antes do app.js (defer)');
});

test('as rotas do plano: ler e montar vão e voltam iguais', () => {
  const casos = {
    '#painel': ['overview', [], {}], '#livro/2026-10': ['livro', ['2026-10'], {}], '#livro/2026-10/fechar': ['livro', ['2026-10', 'fechar'], {}],
    '#lancamentos?mes=2026-10&socia=m-ana&id=g-mf3k2-a1b2c3': ['lancamentos', [], {mes: '2026-10', socia: 'm-ana', id: 'g-mf3k2-a1b2c3'}],
    '#assinaturas': ['subscriptions', [], {}], '#caixa': ['cash', [], {}], '#caixa/2026-09': ['cash', ['2026-09'], {}], '#parametros/fx.USD_BRL': ['parametros', ['fx.USD_BRL'], {}],
    '#parametros/cartao.spread_pct': ['parametros', ['cartao.spread_pct'], {}], '#lancamentos?id=pix:2026.10_a': ['lancamentos', [], {id: 'pix:2026.10_a'}], '#historico': ['historico', [], {}], '#sociedade': ['society', [], {}],
    '#vender': ['sell', [], {}], '#medpainel': ['medpainel', [], {}], '#projecao': ['projection', [], {}], '#portfolio': ['portfolio', [], {}], '#laboratorio': ['lab', [], {}],
  };
  for (const [hash, [chave, args, filtros]] of Object.entries(casos)) {
    const r = lerRota(hash);
    assert.equal(r.chave, chave, hash);
    assert.deepEqual(r.args, args, hash);
    assert.deepEqual(r.filtros, filtros, hash);
    assert.equal(montar(r.chave, r.args, r.filtros), hash, 'ida e volta: ' + hash);
  }
  assert.deepEqual(lerRota('#lancar'), {chave: null, rota: 'lancar', args: [], filtros: {}, acao: 'lancar'});
  assert.equal(lerRota('#impostos').chave, null, 'rota de um módulo que ainda não se registrou: conhecida só pelo nome');
  assert.equal(lerRota('#impostos').rota, 'impostos');
});

test('o hash nunca guarda valores, nomes ou textos: o que foge do formato some ao ler e ao montar', () => {
  assert.equal(montar('lancamentos', [], {socia: 'Ana Ribeiro', nota: 'pagar o contador', valor: '450,00', mes: '2026-13'}), '#lancamentos');
  assert.equal(montar('lancamentos', [], {id: '<script>', mes: '2026-10', descricao: 'Anthropic'}), '#lancamentos?mes=2026-10');
  assert.equal(montar('parametros', ['5,0826'], {}), '#parametros', 'valor no lugar da chave do parâmetro');
  assert.equal(montar('lancamentos', [], {socia: '12345678909', id: 'g-12345678909'}), '#lancamentos', '11 dígitos seguidos (cara de CPF) nunca vão ao endereço');
  assert.deepEqual(lerRota('#lancamentos?socia=12345678909').filtros, {});
  assert.equal(montar('livro', ['outubro', 'fechar'], {}), '#livro', 'argumento fora de ordem não entra');
  assert.equal(montar('desconhecida', [], {}), '');
  assert.deepEqual(lerRota('#lancamentos?socia=Ana%20Ribeiro&valor=450&mes=2026-10').filtros, {mes: '2026-10'});
  assert.deepEqual(lerRota('#lancamentos?socia=m-ana&socia=m-bia').filtros, {socia: 'm-ana'}, 'filtro repetido: vale o primeiro');
  assert.deepEqual(lerRota('#livro/2026-13/fechar').args, []);
  assert.deepEqual(lerRota('#livro/fechar').args, [], 'a aba sem o mês não entra');
  assert.deepEqual(lerRota('#assinaturas?socia=m-ana').filtros, {}, 'filtro que a página não declara some');
  for (const h of ['', '#', '#main-content', '#Painel', '#1abc', '#tema=escuro', '#%E0%A4%A', '#painel/../../etc']) {
    const r = lerRota(h);
    assert.ok(r === null || r.chave === 'overview' && !r.args.length, `${h} → ${JSON.stringify(r)}`);
  }
  assert.equal(ancora('#main-content'), true);
  assert.equal(ancora('#painel'), false);
  // propriedade: 3.000 filtros e argumentos aleatórios, com acento, espaço, R$ e símbolos: o hash montado sempre cabe
  // na gramática (só página, mês, id, sócia e chave de parâmetro)
  const pedacos = ['2026-10', 'm-ana', 'Ana Ribeiro', 'R$ 450,00', 'fx.USD_BRL', 'g-abc', 'fechar', 'ção', '<b>', 'a&b=c', '?x', '#y', '', ' ', '9'.repeat(90), 'cartao.spread_pct'];
  const sorteio = semente => { let s = semente; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s; }; };
  const r = sorteio(42), um = () => pedacos[r() % pedacos.length];
  for (let k = 0; k < 3000; k++) {
    const pagina = W.financePaginas[r() % W.financePaginas.length].chave;
    const hash = montar(pagina, [um(), um()], {mes: um(), socia: um(), id: um(), nota: um(), [um()]: um()});
    assert.match(hash, GRAMATICA, `${pagina}: ${hash}`);
    assert.ok(!/R\$|\s|,|%|ç|</.test(hash), hash);
    const volta = lerRota(hash);
    assert.equal(montar(volta.chave, volta.args, volta.filtros), hash, 'ler(montar(x)) é estável');
  }
});

test('os atalhos do PWA: "Lançar gasto" (./#lancar) e "Lançamentos" (./#lancamentos), abertos depois da senha', () => {
  const manifesto = JSON.parse(ler('manifest.webmanifest'));
  const atalhos = Object.fromEntries((manifesto.shortcuts || []).map(a => [a.name, a.url]));
  assert.deepEqual(atalhos, {'Lançar gasto': './#lancar', 'Lançamentos': './#lancamentos'});
  assert.equal(lerRota(atalhos['Lançar gasto'].slice(2)).acao, 'lancar');
  assert.equal(lerRota(atalhos['Lançamentos'].slice(2)).chave, 'lancamentos');
  for (const a of manifesto.shortcuts) assert.ok(a.short_name && a.description && a.icons.length, a.name);
});

test('nenhuma lista fixa de páginas sobrou: o app.js e o fotografar.mjs leem o registro', () => {
  const app = ler('app.js'), foto = ler('ferramentas/arnes/fotografar.mjs');
  for (const p of W.financePaginas) assert.ok(!app.includes(p.ajuda.oque), `${p.chave}: a ajuda ainda está copiada no app.js`);
  assert.ok(!/const pages = \{\s*overview/.test(app), 'o objeto pages do app.js sai do registro');
  assert.match(app, /window\.financePaginas/);
  assert.ok(!/'01-meu-painel'|\['overview', '/.test(foto), 'o fotografar.mjs não tem mais a lista PAGINAS');
  assert.match(foto, /window\.financePaginas/);
});

test('registrar antes do app.js: a página fica na fila, que o app.js processa ao montar a gaveta', () => {
  const w = carregar();
  assert.equal(w.financeRegistrarPagina({chave: 'teste', rota: 'teste', grupo: 'Ajuda', titulo: 'Teste'}), null);
  assert.equal(w.financeRegistrarPagina.fila.length, 1);
  assert.match(ler('app.js'), /financeRegistrarPagina\.fila/);
});
