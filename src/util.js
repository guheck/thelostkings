'use strict';

// Utilidades gerais (matemática, sorteio com semente, ruído)
const U = {
  // Parâmetros de teste (?sprite, ?fase=...): da URL, ou de window.PARAMETROS_JOGO na página (a página publicada
  // não recebe a parte ?... do link)
  params() { return new URLSearchParams(window.PARAMETROS_JOGO ?? location.search); },
  // Desenhos da IA (personagens, inimigos, cenário, fundo): o padrão desde 29/09; ?codigo volta o desenho por código
  arteIA() { return !U.params().has('codigo'); },
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
