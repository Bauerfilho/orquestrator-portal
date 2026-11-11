// Quem atende esta aba (10/11/2026): a mesma interface roda no portal publicado (GitHub Pages) e na aba Finanças do
// AI Cask. No AI Cask a ponte nativa (window.webkit.messageHandlers.finance) traz os dados e a sessão, e o app se
// apresenta em window.financeHost antes de qualquer script da página; no portal quem atende é a ponte estática
// (static-bridge.js), só de leitura. Módulo ES sem dependências: a ponte publicada e os testes usam este código.

// Há ponte nativa nesta janela? A mesma pergunta que o app.js faz antes de mandar um pedido (financeRequest).
export function ponteNativa(janela) {
  const ponte = janela && janela.webkit && janela.webkit.messageHandlers && janela.webkit.messageHandlers.finance;
  return Boolean(ponte && typeof ponte.postMessage === 'function');
}

// Sob a ponte nativa, o que o app declarou (kind, tema, readOnly, decide…) fica como está. Daqui só entra o que mora
// neste repositório e o app não tem como saber: o Laboratório (galeria.js), servido de blob: como no portal, porque a
// CSP do index.html só aceita molduras blob:. Nada do portal (kind, só leitura, equipe, diário, perfis) vai para o host.
// O app decide se há Laboratório (financeHost.galeria): sem isso, nada é acrescentado.
export function completarHostNativo(janela, galeria) {
  const host = janela.financeHost && typeof janela.financeHost === 'object' ? janela.financeHost : (janela.financeHost = {kind: 'aicask'});
  if (host.galeria === true) {
    host.galeriaUrl = async file => galeria.url(file);
    host.galeriaTitle = file => galeria.titulo(file);
  }
  return host;
}

// O legado do Laboratório no app (P1c, 11/11/2026). Os documentos da galeria anterior (o «legado» do galeria.js) que só
// existem no AI Cask, as maquetes antigas, chegam pelo host que o app apresenta: financeHost.galeriaLegado, na mesma forma
// do pacote cifrado, {files: {"apps/<id>.html": "<html…>"}, titles: {"apps/<id>.html": "nome"}}. Sem a ponte nativa, nada
// (no portal o legado é só o do pacote). Forma estranha é ignorada, sem exceção: só entram páginas apps/<id>.html com
// conteúdo de texto, e só os títulos de texto dessas mesmas páginas. O galeria.js faz o resto, como com o pacote.
const PAGINA_LEGADA = /^apps\/[a-z0-9-]+\.html$/;
const objeto = valor => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
export function legadoDoAnfitriao(janela) {
  try {
    if (!ponteNativa(janela) || !objeto(janela.financeHost)) return null;
    const dado = janela.financeHost.galeriaLegado;
    if (!objeto(dado) || !objeto(dado.files)) return null;
    const titulos = objeto(dado.titles) ? dado.titles : {};
    const legado = {files: {}, titles: {}};
    for (const nome of Object.keys(dado.files)) {
      if (!PAGINA_LEGADA.test(nome) || typeof dado.files[nome] !== 'string') continue;
      legado.files[nome] = dado.files[nome];
      if (typeof titulos[nome] === 'string') legado.titles[nome] = titulos[nome];
    }
    return Object.keys(legado.files).length ? legado : null;
  } catch { return null; }
}
