// A galeria do Laboratório no portal (19/10/2026). O catálogo e as maquetes com stand moram neste repositório, em
// galeria/, copiados do ia-chat pelo publicador (python3 laboratorio/publicar.py <portal>); a versão tela cheia de
// cada maquete mora em apps/<id>/, pública. Os documentos da galeria anterior, que vinham no pacote cifrado (o
// "legado"), continuam no catálogo como "Sem stand", mesclados aqui; quando o mesmo arquivo existe no repositório,
// o do repositório vence. Cada página vira um blob: nesta aba, para a moldura herdar a CSP do portal.
// Módulo ES sem dependências: a ponte publicada (static-bridge.js), a ponte do arnês e os testes usam este código.
const PAGINA = /^(index\.html|apps\/[a-z0-9-]+\.html)$/;
const APP = /^apps\/([a-z0-9-]+)\.html$/;
const RE_CATALOGO = /(<script type="application\/json" id="catalogo">)([\s\S]*?)(<\/script>)/;
const RE_TITULO = /<title>([\s\S]*?)<\/title>/i;
const ENTIDADES = {amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'"};

const falha = (message, code) => { const error = new Error(message); error.code = code; return error; };
const textoOuNulo = valor => typeof valor === 'string' && valor.trim() ? valor.trim() : null;

// O nome da página como o portal aceita: sem ../ na frente nem fragmento. Fora do padrão = não encontrada.
export function nomeDaPagina(file) {
  const nome = String(file || 'index.html').replace(/^\.\.\//, '').replace(/#.*$/, '');
  if (!PAGINA.test(nome)) throw falha('Página não encontrada: ' + nome, 'not_found');
  return nome;
}

// base: a raiz do site (a pasta do index.html do portal); legado(): {files, titles} do pacote cifrado, ou nada;
// fetch: injetável para os testes. Nada vai para storage: tudo vive em memória até esquecer().
export function criarGaleria({base, legado = () => null, fetch: buscar = (...args) => globalThis.fetch(...args)} = {}) {
  let geracao = 0;
  let textos = new Map();     // nome → Promise<texto do repositório | null (404)>
  let paginas = new Map();    // nome → Promise<blob: URL>
  let telas = new Map();      // id → Promise<a pasta apps/<id>/ responde?>
  let catalogos = new Map();  // 'indice' → Promise<{html, itens} | null>
  let itensConhecidos = null, tituloDoIndice = null;   // a leitura síncrona do catálogo, para titulo()
  const criados = new Set();  // blob: URLs vivos, para revogar no esquecer()

  // promessa guardada por chave; se falhar, sai do cache (a próxima chamada tenta de novo)
  function lembrar(mapa, chave, fazer) {
    if (!mapa.has(chave)) {
      const promessa = Promise.resolve().then(fazer);
      promessa.catch(() => { if (mapa.get(chave) === promessa) mapa.delete(chave); });
      mapa.set(chave, promessa);
    }
    return mapa.get(chave);
  }
  const doLegado = () => { try { const g = legado(); return g && typeof g === 'object' ? g : null; } catch { return null; } };
  const arquivosLegados = () => { const g = doLegado(); return g && g.files && typeof g.files === 'object' ? g.files : {}; };
  const titulosLegados = () => { const g = doLegado(); return g && g.titles && typeof g.titles === 'object' ? g.titles : {}; };

  // o texto de galeria/<nome> deste site (mesma origem); 404 = o repositório não tem esse arquivo
  function doRepositorio(nome) {
    return lembrar(textos, nome, () => Promise.resolve().then(() => buscar(new URL('galeria/' + nome, base).href)).then(resposta => {
      if (resposta.status === 404) return null;
      if (!resposta.ok) throw falha('A galeria não respondeu agora (' + resposta.status + '). Tente de novo.', 'unavailable');
      return resposta.text();
    }, () => { throw falha('A galeria não abriu agora. Confira a conexão e tente de novo.', 'unavailable'); }));
  }

  // o índice do repositório com o catálogo lido do bloco <script id="catalogo">; null se o repositório não tem índice
  function lerCatalogo() {
    const minha = geracao;
    return lembrar(catalogos, 'indice', () => doRepositorio('index.html').then(html => {
      if (typeof html !== 'string') return null;
      const m = RE_CATALOGO.exec(html);
      let itens = null;
      try { itens = m ? JSON.parse(m[2]) : null; } catch { itens = null; }
      itens = Array.isArray(itens) ? itens.filter(item => item && typeof item === 'object' && typeof item.arquivo === 'string') : null;
      if (minha === geracao) {
        itensConhecidos = itens;
        const t = RE_TITULO.exec(html);
        tituloDoIndice = t ? textoOuNulo(t[1].replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENTIDADES[e]).replace(/\s+/g, ' ')) : null;
      }
      return {html, itens};
    }));
  }

  // o índice do repositório + uma entrada "Sem stand" para cada documento do legado que o catálogo não lista
  function indiceMesclado({html, itens}) {
    if (!itens) return html;   // sem catálogo legível: o índice como veio
    const presentes = new Set(itens.map(item => item.arquivo));
    const arquivos = arquivosLegados(), titulos = titulosLegados();
    const extras = Object.keys(arquivos).filter(f => APP.test(f) && typeof arquivos[f] === 'string' && !presentes.has(f)).sort()
      .map(f => { const id = APP.exec(f)[1]; return {id, arquivo: f, nome: textoOuNulo(titulos[f]) || id, legado: true}; });
    if (!extras.length) return html;
    // dentro de <script> o texto acaba no primeiro "</script": escapar "<" fecha essa porta e a do comentário HTML
    const json = JSON.stringify([...itens, ...extras], null, 1).replace(/</g, '\\u003c');
    return html.replace(RE_CATALOGO, (_, abre, _antigo, fecha) => abre + '\n' + json + '\n' + fecha);
  }

  return {
    // blob: URL (text/html, sem fragmento) da página; o app acrescenta o #tema=
    url(file) {
      let nome;
      try { nome = nomeDaPagina(file); } catch (error) { return Promise.reject(error); }
      const minha = geracao;
      return lembrar(paginas, nome, async () => {
        let html;
        if (nome === 'index.html') {
          const dados = await lerCatalogo();
          html = dados ? indiceMesclado(dados) : arquivosLegados()['index.html'];
        } else {
          // o catálogo do repositório lista todo galeria/apps/*.html dele: o que não está lá vem direto do legado, sem um
          // pedido que só daria 404 (e erro no console); sem catálogo legível, pergunta ao repositório primeiro.
          // Lido aqui, ele também deixa pronto o título da maquete (titulo()).
          const dados = await lerCatalogo().catch(() => null);
          const listado = !(dados && dados.itens) || dados.itens.some(item => item.arquivo === nome);
          html = listado ? await doRepositorio(nome) : null;
          if (typeof html !== 'string') html = arquivosLegados()[nome];
        }
        if (typeof html !== 'string') throw falha('Página não encontrada: ' + nome, 'not_found');
        if (minha !== geracao) throw falha('A galeria foi fechada.', 'cancelled');
        const url = URL.createObjectURL(new Blob([html], {type: 'text/html'}));
        criados.add(url);
        return url;
      });
    },
    // o nome da maquete (o da ficha, pelo catálogo) ou o título do legado; null se ainda não souber
    titulo(file) {
      let nome;
      try { nome = nomeDaPagina(file); } catch { return null; }
      if (nome === 'index.html') return tituloDoIndice || textoOuNulo(titulosLegados()[nome]);
      const item = itensConhecidos && itensConhecidos.find(i => i.arquivo === nome);
      return (item && textoOuNulo(item.nome)) || textoOuNulo(titulosLegados()[nome]);
    },
    // a página de tela cheia (apps/<id>/, pública): só para maquetes do catálogo do repositório, nunca do legado
    async telaCheia(file) {
      let nome;
      try { nome = nomeDaPagina(file); } catch { return null; }
      const m = APP.exec(nome);
      if (!m) return null;
      const dados = await lerCatalogo().catch(() => null);
      const item = dados && dados.itens && dados.itens.find(i => i.arquivo === nome);
      if (!item || item.legado) return null;
      const pasta = new URL('apps/' + m[1] + '/', base).href;
      // o publicador deixa de fora a maquete sem ícone: um 404 aqui esconde o link em vez de mandar a um erro
      const responde = await lembrar(telas, m[1], () => Promise.resolve().then(() => buscar(pasta, {method: 'HEAD'}))
        .then(resposta => resposta.status !== 404, () => true));
      return responde ? pasta : null;
    },
    // ao sair: revoga os blob: e limpa os caches (a próxima entrada lê tudo de novo)
    esquecer() {
      geracao += 1;
      for (const url of criados) { try { URL.revokeObjectURL(url); } catch {} }
      criados.clear();
      textos = new Map(); paginas = new Map(); telas = new Map(); catalogos = new Map();
      itensConhecidos = null; tituloDoIndice = null;
    },
  };
}
