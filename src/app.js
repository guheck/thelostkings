'use strict';

// App instalável (tela inicial do celular, funciona sem internet): registra o service worker (sw.js) só no jogo
// publicado — em https e fora de quadro (no itch o jogo roda dentro de um quadro e lá não deve registrar: o cache do
// app ficaria preso na página do itch; no link do claude.ai também é um quadro) — e no teste do app no PC
// (tools/serve.js servindo o dist em /thelostkings/). No PC, rodando da pasta do projeto, não registra nada.
(() => {
  const teste = location.hostname === 'localhost' && location.pathname.startsWith('/thelostkings/');
  if ((location.protocol === 'https:' || teste) && 'serviceWorker' in navigator && window.self === window.top) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
  }
})();
