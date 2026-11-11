// PONTE NATIVA DE PROVA (arnês): imita, no navegador sem janela, o que a aba Finanças do AI Cask faz de verdade:
// (1) apresenta o host antes de qualquer script da página (window.financeHost, como o roteiro que o app injeta) e
// (2) atende os pedidos em window.webkit.messageHandlers.finance, respondendo por window.financeReply.
// Os dados são o estado fictício do arnês, calculados pelo domain.js publicado. Parâmetros: ?login=1 (começa sem
// sessão) · ?tema=escuro. Só serve à prova (ferramentas/arnes/prova-nativa.mjs): nada daqui vai ao ar no portal.
(() => {
  if (window.top !== window) return;   // as molduras (maquetes) não têm ponte nem host
  const params = new URLSearchParams(location.search);
  const HOJE = '2026-10-19';
  window.financeHost = {kind: 'aicask', tema: params.get('tema') === 'escuro' ? 'escuro' : 'claro', galeria: true, team: false, readOnly: false, decide: false,
    // O legado (P1c, 11/11/2026): o app declara as maquetes antigas que só existem nele. Aqui, um documento fictício que só o
    // app tem e um que o repositório também tem (sinal: vence o do repositório).
    galeriaLegado: {
      files: {'apps/legado-de-prova.html': '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Maquete antiga de prova</title></head><body><main id="legado-de-prova">documento antigo, vindo do app</main></body></html>',
        'apps/sinal.html': '<!doctype html><title>Sinal ANTIGO do app</title><p>não pode aparecer</p>'},
      titles: {'apps/legado-de-prova.html': 'Maquete antiga de prova', 'apps/sinal.html': 'Sinal ANTIGO do app'}}};
  window.provaNativa = {pedidos: []};
  let base = null, estado = null, sessao = params.get('login') !== '1';
  const carregar = () => base ??= Promise.all([import('/domain.js'), import('/ferramentas/arnes/estado-ficticio.js')]).then(([dominio, ficticio]) => {
    estado = structuredClone(ficticio.estadoFicticio); dominio.validateState(estado); return dominio;
  });
  const falha = (mensagem, codigo) => { const erro = new Error(mensagem); erro.code = codigo; throw erro; };
  const membro = () => { const m = estado.members.find(linha => linha.id === 'm-bauer'); return {id: m.id, displayName: m.displayName, participationPct: m.participationPct ?? null, role: m.role}; };
  const usuario = () => ({user: {nome: membro().displayName, participacao_pct: membro().participationPct, decide: true}, must_change_password: false, decide: true});
  async function atender(action, payload) {
    const dominio = await carregar();
    if (action === 'restore_session') { if (!sessao) falha('Entre para continuar.', 'unauthenticated'); return usuario(); }
    if (action === 'login') { sessao = true; return usuario(); }
    if (action === 'logout') { sessao = false; return {logged_out: true}; }
    if (action === 'preferences') { window.financeHost.tema = payload.tema === 'escuro' ? 'escuro' : 'claro'; return {tema: window.financeHost.tema}; }
    if (!sessao) falha('Entre para continuar.', 'unauthenticated');
    if (action === 'snapshot') {
      const resultado = dominio.buildSnapshot(estado, membro(), dominio.civilDate(HOJE));
      return payload.if_revision === resultado.content_revision ? {unchanged: true, content_revision: resultado.content_revision} : resultado;
    }
    if (['toggle_step', 'edit_plan', 'set_subscription'].includes(action)) {
      const {state: proximo, result} = dominio.applyMutation(estado, action, payload, membro(), dominio.civilDate(HOJE));
      estado = proximo;
      return result;
    }
    falha('Operação indisponível na prova.', 'invalid_action');
  }
  window.webkit = {messageHandlers: {finance: {postMessage(mensagem) {
    const {id, action, payload} = mensagem || {};
    window.provaNativa.pedidos.push(action);
    atender(action, payload || {}).then(
      result => window.financeReply({id, ok: true, result}),
      erro => window.financeReply({id, ok: false, error: erro.message, code: erro.code || 'local_error'}));
  }}}};
})();
