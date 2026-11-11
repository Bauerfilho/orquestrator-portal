import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import fsSync from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {b64, importMaster, deriveKek, wrapMaster, sealBundle, openBundle, unlock} from '../portal-crypto.js';
import {estadoComLivro} from './fixtures/livro-caixa.mjs';
import {abrirDiario, portaMemoria, portaHttp} from '../diario.js';

const carregar = async () => {
  const url = new URL('../ferramentas/atualizar-livro-caixa.mjs', import.meta.url);
  assert.equal(await fs.stat(url).then(() => true, () => false), true, 'falta o atualizador seguro do pacote');
  return import(url);
};
const hash = b => createHash('sha256').update(b).digest('hex');

async function cenario() {
  const raiz = await fs.mkdtemp(join(tmpdir(), 'portal-caixa-teste-'));
  const portal = join(raiz, 'site'), privado = join(raiz, 'privado'), backup = join(raiz, 'backup');
  await fs.mkdir(portal); await fs.mkdir(privado);
  const estado = estadoComLivro(), livro = estado.livroCaixa; delete estado.livroCaixa;
  const pacote = {built_at: '2031-10-01T12:00:00Z', gallery: {files: {'index.html': '<p>Fictício</p>'}}, finance: {
    state: estado, roster: estado.members.map((m, i) => ({...m, portalId: `p-${i}`})),
  }};
  const master = new Uint8Array(32).fill(7), aad = 'orquestrator-portal/v1';
  const senhas = {'m-dona': 'somente teste ficticio A', 'm-par': 'somente teste ficticio B'};
  const members = [];
  for (const [i, senha] of Object.values(senhas).entries()) {
    const salt = new Uint8Array(16).fill(i + 1), kek = await deriveKek(senha, salt, 1000);
    members.push({id: `p-${i}`, salt: b64.enc(salt), ...await wrapMaster(kek, master, aad + `:p-${i}`)});
  }
  const selado = await sealBundle(await importMaster(master), pacote, aad), sha = hash(selado.bytes);
  const manifesto = {version: 1, aad, kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations: 1000}, members,
    bundle: {file: `bundle-${sha.slice(0, 12)}.bin`, sha256: sha, iv: selado.iv, bytes: selado.bytes.length}};
  await fs.writeFile(join(portal, 'manifest.json'), JSON.stringify(manifesto));
  await fs.writeFile(join(portal, manifesto.bundle.file), selado.bytes);
  await fs.writeFile(join(portal, 'perfis.json'), 'envelope fictício preservado');
  await fs.writeFile(join(portal, 'index.html'), '<p>Interface não pode ser sobrescrita.</p>');
  const credenciais = join(privado, 'credenciais.json'), fonte = join(privado, 'livro.json'), diario = join(privado, 'diario.json');
  await fs.writeFile(credenciais, JSON.stringify(senhas)); await fs.writeFile(fonte, JSON.stringify(livro));
  await fs.writeFile(diario, JSON.stringify({cabeca: 0, verificacao: {integro: true, ate: 0, problemas: []}, eventos: []}));
  // Backend de memória REAL do projeto: cifra, assina e valida os envelopes com diario.js. Nenhuma rede externa.
  const porta = portaMemoria();
  const escritor = await abrirDiario({porta, membroId: 'm-dona', senha: senhas['m-dona'], masterRaw: master});
  assert.equal(escritor.modo, 'gravacao');
  const c = {raiz, portal, privado, backup, credenciais, fonte, diario, manifesto, master, pacote, livro, senhas, porta, escritor, chamadas: [], estadosLidos: 0};
  c.fetch = async (url, opcoes = {}) => {
    const u = new URL(url), metodo = opcoes.method || 'GET'; c.chamadas.push({metodo, caminho: u.pathname});
    assert.equal(metodo, 'GET', 'o atualizador nunca pode gravar remotamente');
    if(c.indisponivel)throw new Error('Servidor indisponível na prova fictícia.');
    let r;
    if (u.pathname === '/api/estado') {c.estadosLidos++; if (c.aoLerEstado) await c.aoLerEstado(c.estadosLidos); r = await porta.estado();}
    else if (u.pathname === '/api/chaves') {
      r = await porta.chaves({membro: u.searchParams.get('membro'), pub: u.searchParams.get('pub')});
      if(c.semAssinatura){r=structuredClone(r);r.assinaturas={};r.assinaturaPropria=null;}
    }
    else if (u.pathname === '/api/eventos') {
      r = await porta.lerEventos({token: (opcoes.headers?.authorization || '').replace(/^Bearer /, ''), depois: Number(u.searchParams.get('depois'))});
      if (c.adulterarEnvelope && r.eventos.length) {r = structuredClone(r); r.eventos[0].ct = (r.eventos[0].ct[0] === 'A' ? 'B' : 'A') + r.eventos[0].ct.slice(1);}
      if (c.adulterarAssinatura && r.eventos.length) {r=structuredClone(r);r.eventos[0].sig=(r.eventos[0].sig[0]==='A'?'B':'A')+r.eventos[0].sig.slice(1);}
    } else throw new Error('Rota não autorizada na prova: ' + u.pathname);
    return new Response(JSON.stringify(r), {status: r.ok ? 200 : 403, headers: {'content-type': 'application/json'}});
  };
  return c;
}

test('reempacotar mantém chave, senhas, perfis, interface e galeria; só o pacote de dados muda', async () => {
  const {reempacotar} = await carregar(), c = await cenario();
  try {
    const antes = await fs.readFile(join(c.portal, 'manifest.json'));
    const r = await reempacotar({portal: c.portal, livro: c.fonte, credenciais: c.credenciais, diario: c.diario, backup: c.backup, hoje: '2031-11-21', fetch: c.fetch});
    const novo = JSON.parse(await fs.readFile(join(c.portal, 'manifest.json')));
    assert.deepEqual(novo.members, c.manifesto.members);
    assert.deepEqual(novo.kdf, c.manifesto.kdf);
    assert.notEqual(novo.bundle.iv, c.manifesto.bundle.iv);
    assert.notEqual(novo.bundle.file, c.manifesto.bundle.file);
    for (const senha of Object.values(c.senhas)) {
      const sessao = await unlock(novo, senha);
      assert.deepEqual(sessao.masterRaw, c.master);
    }
    const dados = await openBundle(await importMaster(c.master), novo.bundle.iv, new Uint8Array(await fs.readFile(join(c.portal, novo.bundle.file))), novo.aad);
    assert.deepEqual(dados.gallery, c.pacote.gallery);
    assert.deepEqual(dados.finance.state.livroCaixa.meses, c.livro.meses);
    assert.equal(dados.finance.state.revision, 1);
    assert.equal(await fs.readFile(join(c.portal, 'perfis.json'), 'utf8'), 'envelope fictício preservado');
    assert.equal(await fs.readFile(join(c.portal, 'index.html'), 'utf8'), '<p>Interface não pode ser sobrescrita.</p>');
    assert.deepEqual(await fs.readFile(join(c.backup, 'manifest.json')), antes);
    assert.equal(r.movimentos, 3);
    assert.ok(c.estadosLidos >= 2, 'verifica o diário real e confere novamente a cabeça antes da troca');
    assert.ok(c.chamadas.length > 0 && c.chamadas.every(x => x.metodo === 'GET'), 'somente leitura remota');
    assert.equal(await unlock(novo, 'senha errada de teste'), null);
    assert.equal((await fs.readdir(c.portal)).some(n => /\.lock$|\.tmp$/.test(n)), false);
  } finally { await fs.rm(c.raiz, {recursive: true}); }
});

test('pacote adulterado falha antes de trocar o manifesto', async () => {
  const {reempacotar} = await carregar(), c = await cenario();
  try {
    const antes = await fs.readFile(join(c.portal, 'manifest.json'));
    await fs.appendFile(join(c.portal, c.manifesto.bundle.file), new Uint8Array([1]));
    await assert.rejects(() => reempacotar({portal: c.portal, livro: c.fonte, credenciais: c.credenciais, diario: c.diario, backup: c.backup, fetch: c.fetch}), /hash|integridade|confere/i);
    assert.deepEqual(await fs.readFile(join(c.portal, 'manifest.json')), antes);
  } finally { await fs.rm(c.raiz, {recursive: true}); }
});

test('não põe backup, extração ou credenciais no site; trava impede duas atualizações simultâneas', async () => {
  const {reempacotar} = await carregar(), c = await cenario();
  try {
    await assert.rejects(() => reempacotar({portal: c.portal, livro: c.fonte, credenciais: c.credenciais, diario: c.diario, backup: join(c.portal, 'backup')}), /públic|portal|fora/i);
    const trava = join(c.raiz, '.site.livro-caixa.lock');
    await fs.writeFile(trava, 'teste de concorrência');
    await assert.rejects(() => reempacotar({portal: c.portal, livro: c.fonte, credenciais: c.credenciais, diario: c.diario, backup: c.backup, fetch: c.fetch}), /EEXIST|atualiza|trava/i);
    assert.equal(await fs.readFile(trava, 'utf8'), 'teste de concorrência');
  } finally { await fs.rm(c.raiz, {recursive: true}); }
});

test('alias de assinatura exige correspondência única e pagamento único não ganha periodicidade mensal', async () => {
  const {prepararPacote} = await carregar();
  const estado = estadoComLivro();
  estado.plans.push({id: 'pl-preparo', servico: 'Correio', plano: 'Caixa postal (pagamento único)', currency: 'BRL', amountMinor: 2000,
    period: 'mensal', monthlyDay: 20, confirmed: true, subscriptionState: 'active'});
  const livro = structuredClone(estado.livroCaixa);
  livro.meses[1].linhas[0].descricao = 'Correio Caixa postal (pagamento único)';
  livro.meses[1].linhas[0].planoId = null;
  delete estado.livroCaixa;
  const pacote = {finance: {state: estado, roster: estado.members}, gallery: {files: {}}};
  const diario = {cabeca: 0, verificacao: {integro: true, ate: 0, problemas: []}, eventos: []};
  const pronto = prepararPacote(pacote, livro, diario, '2031-11-21');
  assert.equal(pronto.finance.state.livroCaixa.meses[1].linhas[0].planoId, 'pl-preparo');
  assert.equal(pronto.finance.state.plans.find(p => p.id === 'pl-preparo').period, 'unico');
  assert.equal(estado.plans.find(p => p.id === 'pl-preparo').period, 'mensal', 'não altera o objeto recebido');
  const ambiguo = structuredClone(pacote);
  ambiguo.finance.state.plans.push({...estado.plans[2], id: 'pl-duplicado'});
  assert.throws(() => prepararPacote(ambiguo, livro, diario, '2031-11-21'), /amb[ií]gu|mais de uma|correspond/i);
});

const incluirReceitaFicticia = c => c.escritor.acrescentar({acao: 'add_income', alvo: 'rc-relatorio', dados: {
  competencia: '2031-11', canal: 'outro', brutoMinor: 10000, moeda: 'BRL', transacoes: 1}});
const executar = (reempacotar, c) => reempacotar({portal: c.portal, livro: c.fonte, credenciais: c.credenciais,
  diario: c.diario, backup: c.backup, hoje: '2031-11-21', fetch: c.fetch});

test('JSON dizendo íntegro não substitui leitura autenticada: cópia antiga do diário é recusada', async () => {
  const {reempacotar} = await carregar(), c = await cenario();
  try {
    const antes = await fs.readFile(join(c.portal, 'manifest.json'));
    await incluirReceitaFicticia(c); // cópia privada continua no zero, diário cifrado verdadeiro já está no um.
    await assert.rejects(() => executar(reempacotar, c), /retrato|diário.*mudou|atualiz|cópia/i);
    assert.deepEqual(await fs.readFile(join(c.portal, 'manifest.json')), antes);
    assert.ok(c.chamadas.every(x => x.metodo === 'GET'));
  } finally {await fs.rm(c.raiz, {recursive: true});}
});

test('envelope adulterado é recusado criptograficamente, mesmo com JSON privado marcado íntegro', async () => {
  const {reempacotar} = await carregar(), c = await cenario();
  try {
    const antes = await fs.readFile(join(c.portal, 'manifest.json'));
    await incluirReceitaFicticia(c);
    await fs.writeFile(c.diario, JSON.stringify({cabeca: c.escritor.cabeca, eventos: c.escritor.eventos, verificacao: {integro: true, ate: c.escritor.cabeca, problemas: []}}));
    c.adulterarEnvelope = true;
    await assert.rejects(() => executar(reempacotar, c), /diário|verifica|integridade|assinatura/i);
    assert.deepEqual(await fs.readFile(join(c.portal, 'manifest.json')), antes);
  } finally {await fs.rm(c.raiz, {recursive: true});}
});

test('se o diário avança durante a preparação, o manifesto anterior fica preservado', async () => {
  const {reempacotar} = await carregar(), c = await cenario();
  try {
    const antes = await fs.readFile(join(c.portal, 'manifest.json'));
    const arquivosAntes = (await fs.readdir(c.portal)).sort();
    c.aoLerEstado = async n => {if (n === 2) await incluirReceitaFicticia(c);};
    await assert.rejects(() => executar(reempacotar, c), /diário|cabeça|prepara|mudou/i);
    assert.deepEqual(await fs.readFile(join(c.portal, 'manifest.json')), antes);
    assert.deepEqual((await fs.readdir(c.portal)).sort(), arquivosAntes, 'não deixa pacote órfão no site após a recusa');
  } finally {await fs.rm(c.raiz, {recursive: true});}
});

for(const [nome,flag] of [['ECDSA inválida sem alterar o hash da cifra','adulterarAssinatura'],['assinatura ausente sem permitir registro remoto','semAssinatura'],['servidor inacessível sem confiar no JSON antigo','indisponivel']]) {
  test('leitura autenticada recusa '+nome,async()=>{
    const {reempacotar}=await carregar(),c=await cenario();
    try {
      await incluirReceitaFicticia(c);
      await fs.writeFile(c.diario,JSON.stringify({cabeca:c.escritor.cabeca,eventos:c.escritor.eventos,verificacao:{integro:true,ate:c.escritor.cabeca,problemas:[]}}));
      const antes=await fs.readFile(join(c.portal,'manifest.json'));c[flag]=true;
      await assert.rejects(()=>executar(reempacotar,c),/diário|verifica|assinatura/i);
      assert.deepEqual(await fs.readFile(join(c.portal,'manifest.json')),antes);
      assert.ok(c.chamadas.every(x=>x.metodo==='GET'));
    }finally{await fs.rm(c.raiz,{recursive:true});}
  });
}

test('falha de rename limpa só o pacote novo não referenciado, sem perder a versão vigente',async()=>{
  const {reempacotar}=await carregar(),c=await cenario(),renomear=fsSync.renameSync;
  try {
    const antes=await fs.readFile(join(c.portal,'manifest.json')),arquivos=(await fs.readdir(c.portal)).sort();
    fsSync.renameSync=(de,para)=>{if(para===join(fsSync.realpathSync(c.portal),'manifest.json'))throw new Error('Falha simulada de rename');return renomear(de,para);};
    await assert.rejects(()=>executar(reempacotar,c),/Falha simulada/);
    assert.deepEqual(await fs.readFile(join(c.portal,'manifest.json')),antes);
    assert.deepEqual((await fs.readdir(c.portal)).sort(),arquivos);
  }finally{fsSync.renameSync=renomear;await fs.rm(c.raiz,{recursive:true});}
});

test('limpeza não apaga o pacote que outro manifesto passou a referenciar',async()=>{
  const {reempacotar}=await carregar(),c=await cenario(),renomear=fsSync.renameSync;
  try {
    fsSync.renameSync=(de,para)=>{
      if(para!==join(fsSync.realpathSync(c.portal),'manifest.json'))return renomear(de,para);
      const adotado=JSON.parse(fsSync.readFileSync(de,'utf8'));adotado.marcadorFicticio='outra execução';
      fsSync.writeFileSync(para,JSON.stringify(adotado));throw new Error('Troca simulada por outro publicador');
    };
    await assert.rejects(()=>executar(reempacotar,c),/outro publicador/);
    const final=JSON.parse(await fs.readFile(join(c.portal,'manifest.json')));
    assert.equal(final.marcadorFicticio,'outra execução');
    assert.equal(hash(await fs.readFile(join(c.portal,final.bundle.file))),final.bundle.sha256);
  }finally{fsSync.renameSync=renomear;await fs.rm(c.raiz,{recursive:true});}
});

test('porta HTTP limpa o prazo quando o transporte recusa sincronamente, sem rejeição solta depois',async()=>{
  const p=portaHttp('https://servidor.ficticio',()=>{throw new Error('Falha síncrona fictícia');},10);
  await assert.rejects(()=>p.estado(),/Falha síncrona fictícia/);
  await new Promise(ok=>setTimeout(ok,25));
});
