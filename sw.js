// Service worker do The Lost Kings (app instalável que abre rápido e funciona sem internet).
// Cópia do padrão dos jogos (_ferramentas/pwa/sw.js) com duas mudanças, porque este jogo tem DUAS páginas (o jogo e o
// editor de fases):
// 1) cada página fica guardada com o próprio endereço (o padrão guardava toda página como index.html: sem internet,
//    o jogo abriria o editor);
// 2) já guarda na instalação as páginas, o código e as fases da demo (__ARQUIVOS__, a lista que o tools/monta_dist.js
//    põe aqui); as imagens entram quando o jogo as carrega (ele carrega todas ao abrir).
// O publicar.ps1 troca 2026.10.03-0155 pela versão: cada versão nova apaga o cache antigo.
const VERSAO = '2026.10.03-0155';
// vários jogos podem morar no mesmo site (ex.: guheck.github.io/jogo-a e /jogo-b): o nome do cache leva o endereço do jogo
const PREFIXO = `jogo:${self.registration.scope}:`;
const CACHE = PREFIXO + VERSAO;
const ARQUIVOS = ['./', './index.html'].concat(["./src/escolha.js","./src/app.js","./src/util.js","./src/minhas.js","./src/estilo.js","./src/rig.js","./src/rosto.js","./src/cast.js","./src/desenho.js","./src/poses.js","./src/sprites.js","./src/objetos.js","./src/cenario.js","./src/salas.js","./src/nivel.js","./src/cordas.js","./src/heroi.js","./src/inimigos.js","./src/som.js","./src/musica.js","./src/jogo.js","./src/bot.js","./src/gerador.js","./src/menu.js","./src/toque.js","./src/editor.js","./src/editor-sel.js","./fases/mesa.json","./fases/mesa3.json","./editor.html","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./icons/favicon-48.png"]);
// fontes do Google usadas pelos jogos: também ficam guardadas (senão, sem internet, o texto muda de fonte)
const FORA = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ARQUIVOS.map((a) => new Request(a, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIXO) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// a página pelo endereço sem o ?... (index.html?fase=~ é a mesma index.html); a raiz é a index.html
const chavePagina = (url) => {
  const u = new URL(url);
  u.search = ''; u.hash = '';
  if (u.pathname.endsWith('/')) u.pathname += 'index.html';
  return u.href;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const local = url.origin === self.location.origin;
  if (!local && !FORA.includes(url.origin)) return;

  // a página: tenta a internet primeiro (versão nova); sem internet, usa a guardada (a mesma página).
  // 'no-cache' confere com o servidor: sem isso o navegador pode entregar a página guardada há até 10 min
  // (o GitHub Pages manda max-age=600) e a versão nova demora a aparecer
  if (local && req.mode === 'navigate') {
    const chave = chavePagina(req.url);
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(chave, copia));
          }
          return res;
        })
        .catch(() => caches.match(chave).then((r) => r || caches.match(chavePagina(self.registration.scope)))),
    );
    return;
  }

  // o resto (código, imagens, sons, fontes, fases): se já está guardado, usa; senão baixa e guarda.
  // Ao baixar, confere com o servidor ('no-cache'): uma cópia velha do navegador nunca entra no cache da versão nova
  e.respondWith(
    caches.match(req, { ignoreSearch: local }).then(
      (guardado) =>
        guardado ||
        fetch(req, { cache: 'no-cache' }).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        }),
    ),
  );
});
