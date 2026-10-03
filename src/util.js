'use strict';

// RESOLUÇÃO NATIVA (03/10, usuário: "a gente precisa definir no projeto de forma bem clara qual que é a resolução nativa
// do jogo e realizar todos os assets já com isso em mente, sem isso de redimensionar"): a tela do jogo tem sempre
// 1920 x 1080 px (NATIVA); o mundo é 1280 x 720 px do jogo (Jogo.W x Jogo.H), então 1 px do jogo = ARTE_RES = 1,5 px da
// tela. A janela só estica a tela pronta, por igual. Toda arte é preparada para aparecer em 1:1 na tela nativa (1 px da
// imagem = 1 px da tela): nunca ampliada (fica mole) e, se possível, sem redução no jogo. Conferência:
// Jogo.confereResolucao() lista o que aparece ampliado.
const NATIVA = { w: 1920, h: 1080 }, ARTE_RES = 1.5;
// Peça em alta (tools/recorta_nativo.py): a imagem tem mais pixels que o tamanho LÓGICO (o px das medidas do código, o do
// recorte antigo). U.altaRes marca a imagem com o tamanho lógico (width/height passam a dizer ele) e o drawImage
// desenha a grande no lugar dela: o recorte (sx, sy, sw, sh) vai em px lógicos e sem tamanho vai o lógico. Canvas
// montado de uma peça em alta: U.tela(lw, lh, rx, ry) (desenhe em px lógicos).
const _desenhaImg = CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage = function (img, a, b, c, d, e, f, g, h) {
  const rx = img && img._rx;
  if (U.medeArte) U.medeArte(this, img, arguments);
  if (!rx) return _desenhaImg.apply(this, arguments);
  const n = arguments.length;
  if (n === 3) return _desenhaImg.call(this, img, a, b, img._lw, img._lh);
  if (n === 5) return _desenhaImg.call(this, img, a, b, c, d);
  return _desenhaImg.call(this, img, a * rx, b * img._ry, c * rx, d * img._ry, e, f, g, h);
};

// Utilidades gerais (matemática, sorteio com semente, ruído)
const U = {
  // imagem img (carregada) com tamanho lógico lw x lh: width/height dizem o lógico; a grande vai no drawImage
  altaRes(img, lw, lh) {
    const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
    Object.assign(img, { _rx: nw / lw, _ry: nh / lh, _lw: lw, _lh: lh });
    if (img instanceof HTMLImageElement) { img.width = lw; img.height = lh; }
    return img;
  },
  // canvas para montar peça em alta: rx x ry px por px lógico; o contexto já vem escalado (desenhe em px lógicos)
  tela(lw, lh, rx = ARTE_RES, ry = rx) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(lw * rx)); c.height = Math.max(1, Math.ceil(lh * ry));
    Object.assign(c, { _rx: c.width / lw, _ry: c.height / lh, _lw: lw, _lh: lh });
    const g = c.getContext('2d'); g.scale(c._rx, c._ry);
    return { c, g };
  },
  // tamanho lógico de uma imagem ou de um canvas montado (U.tela): para medir em px do jogo
  lw: (img) => img._lw || img.width,
  lh: (img) => img._lh || img.height,
  // Parâmetros de teste (?sprite, ?fase=...): da URL, ou de window.PARAMETROS_JOGO na página (a página publicada
  // não recebe a parte ?... do link)
  params() { return new URLSearchParams(window.PARAMETROS_JOGO ?? location.search); },
  // Desenhos da IA (personagens, inimigos, cenário, fundo): sempre (02/10, usuário: "quero tirar completamente essa
  // arte vetorial antiga"; até então ?codigo voltava o desenho por código)
  arteIA() { return true; },
  TAU: Math.PI * 2,
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  // t de 0 a 1 dentro do intervalo [a, b]
  prog: (t, a, b) => U.clamp((t - a) / (b - a), 0, 1),
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  ang: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
  ease: {
    in: (t) => t * t,
    out: (t) => 1 - (1 - t) * (1 - t),
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outBack: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (U.TAU / 3)) + 1),
  },

  // gerador com semente (mulberry32)
  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash(n) {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  },
  // ruído suave 1D (valor interpolado), retorna -1..1
  ruido(x, semente = 0) {
    const i = Math.floor(x), f = x - i;
    const a = U.hash(i * 7 + semente * 131), b = U.hash((i + 1) * 7 + semente * 131);
    const s = f * f * (3 - 2 * f);
    return (a + (b - a) * s) * 2 - 1;
  },

  circulo(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, U.TAU); },
  elipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, U.TAU); },
  retRed(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  // cápsula de (0,0) até (0,len) com largura w0 -> w1 (membros)
  capsula(ctx, len, w0, w1) {
    const r0 = w0 / 2, r1 = w1 / 2;
    ctx.beginPath();
    ctx.arc(0, 0, r0, Math.PI, 0);
    ctx.lineTo(r1, len);
    ctx.arc(0, len, r1, 0, Math.PI);
    ctx.closePath();
  },
  // mistura duas cores hex (t=0 -> a, t=1 -> b)
  mistura(a, b, t) {
    const pa = U.hexRgb(a), pb = U.hexRgb(b);
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  },
  hexRgb(h) {
    if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number);
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  escurece: (c, t) => U.mistura(c, '#1c1020', t),
  clareia: (c, t) => U.mistura(c, '#fffaf0', t),
};
