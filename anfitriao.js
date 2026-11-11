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
