// Tema claro/escuro do Finanças (AI Cask, PWA e portal). Carrega no <head>, antes do primeiro desenho, para a página não piscar.
// Ordem da escolha: o host nativo (window.financeHost.tema, injetado pelo AI Cask) > localStorage > claro.
// Ao alternar, grava sempre em localStorage e, quando a ponte existe, manda a ação "preferences" ao host (UserDefaults).
// Também acompanha <meta name="theme-color">: claro #f4f3ee (fundo do tema claro), escuro #0c1913 (a cor do manifesto PWA).
(function () {
  var CHAVE = 'orquestrator-financas.tema', raiz = document.documentElement;
  function valido(v) { return v === 'escuro' || v === 'claro' ? v : null; }
  function guardado() {
    var host = window.financeHost && valido(window.financeHost.tema);
    if (host) return host;
    try { return valido(localStorage.getItem(CHAVE)) || 'claro'; } catch (e) { return 'claro'; }
  }
  function aplicar(tema) {
    raiz.setAttribute('data-tema', tema);
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', tema === 'claro' ? 'light dark' : 'dark light');
    var cor = document.querySelector('meta[name="theme-color"]');
    if (cor) cor.setAttribute('content', tema === 'claro' ? '#f4f3ee' : '#0c1913');
    var botoes = document.querySelectorAll('[data-tema-toggle]'), rotulo = tema === 'claro' ? 'Mudar para o modo escuro' : 'Mudar para o modo claro';
    for (var i = 0; i < botoes.length; i++) { botoes[i].setAttribute('aria-pressed', tema === 'escuro' ? 'true' : 'false'); botoes[i].setAttribute('aria-label', rotulo); botoes[i].setAttribute('title', rotulo); }
  }
  function alternar() {
    var novo = raiz.getAttribute('data-tema') === 'claro' ? 'escuro' : 'claro';
    try { localStorage.setItem(CHAVE, novo); } catch (e) {}
    if (window.financeHost) window.financeHost.tema = novo;
    aplicar(novo);
    if (typeof window.financeRequest === 'function') window.financeRequest('preferences', {tema: novo}).catch(function () {});
  }
  aplicar(guardado());
  document.addEventListener('click', function (e) { var alvo = e.target && e.target.closest ? e.target.closest('[data-tema-toggle]') : null; if (alvo) { e.preventDefault(); alternar(); } });
  document.addEventListener('DOMContentLoaded', function () { aplicar(raiz.getAttribute('data-tema') || guardado()); });
  addEventListener('storage', function (e) { if (e.key === CHAVE) aplicar(guardado()); });
})();
