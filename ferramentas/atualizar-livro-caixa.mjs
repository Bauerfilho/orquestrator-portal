#!/usr/bin/env node
// Atualização LOCAL do pacote cifrado, nunca da interface ou do diário remoto. A mesma chave mestra preserva senhas,
// perfis e o acesso ao diário. O JSON da fonte, o diário conferido, as credenciais e o backup ficam fora do site.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {unlock, importMaster, openBundle, sealBundle} from '../portal-crypto.js';
import {buildSnapshot, civilDate, validateState} from '../domain.js';
import * as R from '../razao.js';
import {conferirFechamentos, acertoAcumulado} from '../contas.js';
import {abrirDiario, portaHttp} from '../diario.js';
import {DIARIO_URL} from '../endereco-diario.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ler = arquivo => {
  const texto = fs.readFileSync(arquivo, 'utf8');
  try { return JSON.parse(texto); } catch { throw new Error('JSON inválido em ' + path.basename(arquivo) + '; o conteúdo privado não foi exibido.'); }
};
const normal = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const rotulo = texto => normal(texto).replace(/^renovacao\s+/, '').split(/[·(]/)[0].replace(/\s+\d{1,2}\/\d{1,2}$/, '').trim();
const runtime = pacote => ({...pacote.finance.state, members: pacote.finance.roster.map(({id, displayName, participationPct, role}) => ({id, displayName, participationPct, role}))});
const iguais = (a, b, mensagem) => { if (!isDeepStrictEqual(a, b)) throw new Error(mensagem); };
const assinaturaUnica = p => normal(p.period) === 'unico' || /pagamento unic[oa]/.test(normal(p.plano));
const comoUnica = (p, data) => ({...p, period: 'unico', monthlyDay: null, nextDate: data,
  paymentStatus: 'pago', paymentStatusExplicit: true, status: 'pagamento único registrado no livro-caixa'});

function ligarAssinaturas(livro, planos, originais) {
  const normalizacoes = new Map();
  for (const mes of livro.meses) for (const l of mes.linhas) {
    if (!l.saidaMinor) continue;
    const unico = /pagamento unic[oa]/.test(normal(l.descricao));
    let plano = l.planoId ? planos.find(p => p.id === l.planoId) : null;
    if (l.planoId && !plano) throw new Error('Assinatura vinculada não existe: ' + l.planoId);
    if (!plano) {
      const chave = rotulo(l.descricao);
      const candidatos = planos.filter(p => {
        if (!unico && assinaturaUnica(p)) return false;
        const aliases = [rotulo(p.servico), rotulo(p.plano), rotulo(p.servico + ' ' + rotulo(p.plano))];
        return aliases.includes(chave);
      });
      if (candidatos.length > 1) throw new Error(`Correspondência ambígua de assinatura em ${mes.aba}, linha ${l.linha}.`);
      plano = candidatos[0] || null;
      if (!plano && /^renovacao\s/.test(normal(l.descricao))) throw new Error(`Renovação sem assinatura correspondente em ${mes.aba}, linha ${l.linha}.`);
      l.planoId = plano?.id || null;
    }
    // O razão valida a fonte antes de o diário abrir e refaz prefixos para os selos. Não criar sementes fantasmas
    // para satisfazer uma referência a plano que só existirá no diário: esse caso exige conciliação separada.
    const base = plano ? originais.find(p => p.id === plano.id) : null;
    if (plano && !base) throw new Error('Vínculo da fonte PENDENTE: assinatura existe apenas no diário; a importação não copia projeções para a base.');
    if (base && unico) {
      if (!assinaturaUnica(base)) throw new Error('Vínculo PENDENTE: compra de pagamento único não pode converter uma assinatura recorrente do mesmo fornecedor.');
      Object.assign(base, comoUnica(base, l.data)); normalizacoes.set(base.id, l.data);
    }
  }
  return normalizacoes;
}

export function prepararPacote(original, fonte, diario, hoje = civilDate(new Date())) {
  const p = structuredClone(original), livro = structuredClone(fonte);
  if (!p?.finance?.state || !Array.isArray(p.finance.roster)) throw new Error('Pacote sem estado ou roster financeiro.');
  const anterior = runtime(original);
  validateState(anterior);
  if (!diario || !Number.isSafeInteger(diario.cabeca) || diario.cabeca < 0 || !Array.isArray(diario.eventos) ||
      diario.eventos.length !== diario.cabeca || diario.eventos.some((e, i) => e.seq !== i + 1) ||
      diario.verificacao?.integro !== true || diario.verificacao.ate !== diario.cabeca || !Array.isArray(diario.verificacao.problemas) || diario.verificacao.problemas.length) {
    throw new Error('É necessário um retrato completo e íntegro do diário, inclusive quando vazio.');
  }
  // Reimportar a fonte não desfaz a decisão contábil anterior nem reativa gastos históricos sem uma decisão nova.
  if (anterior.livroCaixa?.conciliacao && livro.conciliacao === undefined) livro.conciliacao = structuredClone(anterior.livroCaixa.conciliacao);
  if (anterior.livroCaixa?.conciliacao && !isDeepStrictEqual(livro.conciliacao, anterior.livroCaixa.conciliacao)) throw new Error('Mudar a conciliação exige decisão expressa e operação separada; a reimportação comum não a revoga.');
  R.validarLivroCaixa(livro);
  const antes = R.aplicar(anterior, diario.eventos);
  const acertoAntes = acertoAcumulado(anterior, antes, null, hoje);
  if (livro.conciliacao) {
    const c = livro.conciliacao;
    if (c.diarioAteSeq > diario.cabeca) throw new Error('A conciliação ultrapassa a cabeça verificada do diário.');
    for (const id of c.gastoIds) {
      const g = antes.gastos.find(x => x.id === id);
      const criado = diario.eventos.find(e => e.conteudo?.alvo === id && ['add_expense', 'record_payment'].includes(e.conteudo.acao));
      if (!g || !criado || criado.seq > c.diarioAteSeq || !livro.meses.some(m => m.mes === g.competencia && m.linhas.length)) {
        throw new Error('A conciliação aponta gasto inexistente, posterior ao limite ou fora dos meses da fonte: ' + id);
      }
      if (!g.historicoFonte && g.estado !== 'anulado') {
        const reembolso = antes.acertos.find(a => a.id === g.reembolsoId && a.data <= hoje);
        if (g.destino === 'empresa_reembolsa' && !g.reembolsadoEm && !g.convertidoEm && !reembolso) throw new Error('Há reembolso pendente: concilie a obrigação antes de tornar o gasto somente histórico.');
        if (g.destino === 'dividir' && !g.reembolsadoEm && acertoAntes.porSocia.some(s => s.saldo !== 0)) throw new Error('Há acerto entre sócias em aberto: uma decisão separada é necessária antes da conciliação histórica.');
      }
    }
  }
  const normalizacoes = ligarAssinaturas(livro, R.estadoEfetivo(anterior, antes, hoje).plans, p.finance.state.plans);
  for (const [mes, fechamento] of Object.entries(antes.fechamentos)) if (fechamento.fechado) {
    iguais(livro.meses.find(m => m.mes === mes), anterior.livroCaixa?.meses.find(m => m.mes === mes), 'A fonte de um mês fechado não pode ser alterada sem reabertura explícita.');
  }
  p.finance.state.livroCaixa = livro;
  const estado = runtime(p), aplicado = R.aplicar(estado, diario.eventos);
  const dono = estado.members.find(m => m.role === 'owner');
  if (!dono) throw new Error('O pacote não tem responsável.');
  // Projeção serve para exibir e resumir, nunca como nova semente: reaplicar o diário duplicaria seus eventos.
  const resumo = buildSnapshot(R.estadoEfetivo(estado, aplicado, hoje), dono, hoje).blocks.user.summary;
  const mp = p.finance.state.staticBlocks.medpainel;
  if (mp && typeof mp === 'object') { mp.fixed_monthly = structuredClone(resumo.fixed_monthly); mp.incomplete_costs = resumo.incomplete_costs; }
  if (!Number.isSafeInteger(p.finance.state.revision + 1)) throw new Error('Limite de revisão alcançado.');
  p.finance.state.revision++;
  p.finance.state.updatedAt = livro.fonte.importadoEm;
  p.finance.state.sourceInfo = {...p.finance.state.sourceInfo, updatedAt: livro.fonte.importadoEm};
  p.built_at = livro.fonte.importadoEm;
  // Conferir o estado FINAL, exatamente o que será cifrado, inclusive depois dos ajustes de metadados.
  const final = runtime(p), conferido = R.aplicar(final, diario.eventos);
  iguais(final.plans, anterior.plans.map(plano => normalizacoes.has(plano.id) ? comoUnica(plano, normalizacoes.get(plano.id)) : plano),
    'A base de assinaturas mudou fora da normalização documental de pagamento único.');
  iguais(conferido.recusados, antes.recusados, 'A importação não pode invalidar registros anteriores.');
  iguais(conferido.historico, antes.historico, 'O histórico assinado precisa continuar idêntico.');
  for (const g of antes.gastos.filter(g => !g.importado)) {
    const preservado = {...conferido.gastos.find(x => x.id === g.id)}, esperado = {...g};
    delete preservado.historicoFonte; delete esperado.historicoFonte;
    iguais(preservado, esperado, 'Um gasto do diário foi alterado durante a importação.');
  }
  iguais(conferirFechamentos(final, diario.eventos), conferirFechamentos(anterior, diario.eventos), 'Um mês já fechado seria alterado: reabrir é uma decisão separada.');
  iguais(acertoAcumulado(final, conferido, null, hoje), acertoAntes, 'A importação não pode mudar obrigações, acertos ou aportes já registrados.');
  return p;
}

// Resolve também o ancestral existente de um caminho ainda novo; uma ligação simbólica não burla a fronteira do site.
function caminhoReal(caminho) {
  let atual = path.resolve(caminho); const faltam = [];
  while (!fs.existsSync(atual)) { faltam.unshift(path.basename(atual)); atual = path.dirname(atual); }
  return path.join(fs.realpathSync(atual), ...faltam);
}
function foraDoSite(caminho, portal) {
  const real = caminhoReal(caminho), relativo = path.relative(portal, real);
  if (!relativo || (!relativo.startsWith('..' + path.sep) && relativo !== '..' && !path.isAbsolute(relativo))) throw new Error('Arquivo privado ou backup precisa ficar fora do portal público.');
  return real;
}

function gravarNovo(arquivo, conteudo, modo = 0o600) {
  const fd = fs.openSync(arquivo, 'wx', modo);
  try { fs.writeFileSync(fd, conteudo); fs.fsyncSync(fd); }
  catch (erro) { fs.unlinkSync(arquivo); throw erro; }
  finally { fs.closeSync(fd); }
}
function sincronizarPasta(pasta) {
  const fd = fs.openSync(pasta, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

export async function reempacotar({portal, livro, credenciais, diario, backup, hoje, fetch: f = globalThis.fetch}) {
  portal = fs.realpathSync(portal);
  livro = foraDoSite(livro, portal); credenciais = foraDoSite(credenciais, portal); diario = foraDoSite(diario, portal); backup = foraDoSite(backup, portal);
  const prefixoPrivado = path.join(path.dirname(portal), '.' + path.basename(portal));
  const trava = prefixoPrivado + '.livro-caixa.lock';
  const fd = fs.openSync(trava, 'wx', 0o600); // EEXIST é conflito real: nunca removemos a trava de outra execução.
  let temporario = null, manifestoTrocado = false, textoNovo = null, antes, pacoteNovo = null;
  try {
    fs.writeFileSync(fd, String(process.pid) + '\n');
    const arquivoManifesto = path.join(portal, 'manifest.json');
    antes = fs.readFileSync(arquivoManifesto);
    const manifest = JSON.parse(antes);
    if (manifest.version !== 1 || manifest.aad !== 'orquestrator-portal/v1' || !/^bundle-[a-f0-9]{12}\.bin$/.test(manifest.bundle?.file || '')) throw new Error('Manifesto do portal inválido.');
    const bytes = fs.readFileSync(path.join(portal, manifest.bundle.file));
    if (sha(bytes) !== manifest.bundle.sha256 || bytes.length !== manifest.bundle.bytes) throw new Error('A integridade do pacote não confere com o hash do manifesto.');
    const senhas = Object.values(ler(credenciais)), fonte = ler(livro), retrato = ler(diario);
    let sessao = null, senhaAtiva = null;
    for (const senha of senhas) { if (typeof senha !== 'string') throw new Error('Arquivo de credenciais inválido.'); sessao = await unlock(manifest, senha); if (sessao) {senhaAtiva = senha; break;} }
    if (!sessao) throw new Error('As credenciais fornecidas não abrem o pacote atual.');
    const key = await importMaster(sessao.masterRaw);
    const original = await openBundle(key, manifest.bundle.iv, new Uint8Array(bytes), manifest.aad);
    const membro = original.finance.roster.find(m => m.portalId === sessao.memberId);
    if (!membro) throw new Error('O acesso não corresponde ao roster financeiro.');
    const apenasGET = (url, opcoes = {}) => {
      if ((opcoes.method || 'GET') !== 'GET' || new URL(url).origin !== new URL(DIARIO_URL).origin) throw new Error('Gravação remota ou mudança de destino proibida durante a atualização.');
      return f(url, {...opcoes, method: 'GET', cache: 'no-store', redirect: 'error'});
    };
    // O booleano de um JSON não é prova. O cliente existente verifica cifra, cadeia e ECDSA novamente, só com GET.
    const remoto = await abrirDiario({url: DIARIO_URL, membroId: membro.id, senha: senhaAtiva, masterRaw: sessao.masterRaw, fetch: apenasGET});
    if (!['gravacao', 'leitura'].includes(remoto.modo) || !remoto.verificacao.integro || remoto.verificacao.ate !== remoto.cabeca || remoto.eventos.length !== remoto.cabeca) throw new Error('Não foi possível verificar o diário publicado; nada foi substituído.');
    iguais(retrato.eventos, remoto.eventos, 'O retrato privado difere do diário autenticado; atualize a cópia antes de importar.');
    if (retrato.cabeca !== remoto.cabeca) throw new Error('A cabeça do retrato não confere com o diário autenticado.');
    const diarioAutenticado = {cabeca: remoto.cabeca, eventos: remoto.eventos, verificacao: remoto.verificacao};
    const pronto = prepararPacote(original, fonte, diarioAutenticado, hoje);
    const selado = await sealBundle(key, pronto, manifest.aad), hash = sha(selado.bytes);
    const nome = `bundle-${hash.slice(0, 12)}.bin`;
    const novo = {...manifest, bundle: {file: nome, iv: selado.iv, bytes: selado.bytes.length, sha256: hash}};
    assert.deepEqual(novo.members, manifest.members); assert.deepEqual(novo.kdf, manifest.kdf);
    if (!isDeepStrictEqual(await openBundle(key, novo.bundle.iv, selado.bytes, novo.aad), pronto)) throw new Error('O pacote cifrado não reproduziu os dados preparados.');
    if (!fs.readFileSync(arquivoManifesto).equals(antes)) throw new Error('O manifesto mudou durante a preparação; nada foi substituído.');
    fs.mkdirSync(path.dirname(backup), {recursive: true, mode: 0o700});
    fs.mkdirSync(backup, {mode: 0o700});
    gravarNovo(path.join(backup, 'manifest.json'), antes);
    gravarNovo(path.join(backup, manifest.bundle.file), bytes);
    sincronizarPasta(backup);
    textoNovo = JSON.stringify(novo, null, 1) + '\n';
    const provisorio = prefixoPrivado + '.manifest-' + randomUUID() + '.tmp';
    gravarNovo(provisorio, textoNovo); temporario = provisorio;
    const cabecaFinal = await portaHttp(DIARIO_URL, apenasGET).estado();
    if (!cabecaFinal.iniciado || cabecaFinal.cabeca !== diarioAutenticado.cabeca) throw new Error('O diário avançou durante a preparação; confira a nova cabeça e importe novamente.');
    if (!fs.readFileSync(arquivoManifesto).equals(antes)) throw new Error('O manifesto mudou antes da troca; o backup foi preservado.');
    gravarNovo(path.join(portal, nome), selado.bytes, 0o644); pacoteNovo = {nome, hash}; sincronizarPasta(portal);
    if (!fs.readFileSync(arquivoManifesto).equals(antes)) throw new Error('O manifesto mudou antes da troca; o backup foi preservado.');
    fs.renameSync(temporario, arquivoManifesto); temporario = null; manifestoTrocado = true;
    sincronizarPasta(portal);
    const confirmado = ler(arquivoManifesto), lido = fs.readFileSync(path.join(portal, confirmado.bundle.file));
    if (sha(lido) !== hash) throw new Error('O pacote gravado não confere.');
    if (!isDeepStrictEqual(await openBundle(key, confirmado.bundle.iv, new Uint8Array(lido), confirmado.aad), pronto)) throw new Error('O pacote gravado não reproduziu os dados preparados.');
    return {portal, backup, pacote: nome, sha256: hash, mesmaChave: true, senhasPreservadas: true,
      movimentos: pronto.finance.state.livroCaixa.meses.reduce((n, m) => n + m.linhas.length, 0), diarioAte: diarioAutenticado.cabeca, diarioReverificado: true, gravacoesRemotas: 0, somenteLocal: true};
  } catch (erro) {
    // Só revertemos a nossa própria troca. Se outro processo mudou o alvo, não sobrescrevemos a versão dele.
    if (manifestoTrocado && fs.readFileSync(path.join(portal, 'manifest.json'), 'utf8') === textoNovo) {
      const reversao = prefixoPrivado + '.rollback-' + randomUUID() + '.tmp';
      gravarNovo(reversao, antes); temporario = reversao;
      fs.renameSync(temporario, path.join(portal, 'manifest.json')); temporario = null; sincronizarPasta(portal);
    }
    if (pacoteNovo) {
      const arquivo = path.join(portal, pacoteNovo.nome), atual = ler(path.join(portal, 'manifest.json'));
      if (atual.bundle?.file !== pacoteNovo.nome && fs.existsSync(arquivo) && sha(fs.readFileSync(arquivo)) === pacoteNovo.hash) fs.unlinkSync(arquivo);
    }
    throw erro;
  } finally {
    if (temporario && fs.existsSync(temporario)) fs.unlinkSync(temporario);
    fs.closeSync(fd); fs.unlinkSync(trava);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) { if (!/^--(portal|livro|credenciais|diario|backup)$/.test(process.argv[i]) || !process.argv[i + 1]) throw new Error('Uso: --portal DIR --livro JSON-PRIVADO --credenciais JSON-PRIVADO --diario JSON-PRIVADO --backup DIR-PRIVADO'); args[process.argv[i].slice(2)] = process.argv[i + 1]; }
  try { console.log(JSON.stringify(await reempacotar(args), null, 2)); }
  catch (e) { console.error('PARO: ' + e.message); process.exitCode = 1; }
}
