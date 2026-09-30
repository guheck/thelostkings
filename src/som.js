'use strict';

// Sons sintetizados na hora (Web Audio), como no SEGURA!: nenhum arquivo. Cada efeito é uma receita curta de
// osciladores e ruído com envelope. O jogo toca pelo texto do efeito (Mundo.fx: 'POW!' → soco) e por alguns eventos
// (pulo, dano, fala, vitória). V liga/desliga (lembra no navegador). O navegador só deixa tocar depois de uma tecla
// ou clique: até lá, fica mudo.
const SOM_TEXTO = {
  'POW!': 'soco', 'UPPER!': 'gancho', fuu: 'vento', 'CRAC!': 'crac', BOING: 'boing', 'BOING!': 'boing',
  'PLAFT!': 'plaft', 'CESTA!': 'cesta', 'TSC!': 'tesourada', 'SNIP!': 'snip', 'CRAVOU!': 'cravou', 'TÓIN!': 'toin',
  'GRUDOU!': 'grudou', 'PAF!': 'paf', puf: 'puf', 'TOC!': 'toc', 'TUM!': 'tum', 'STRIKE!': 'strike', 'PLEC!': 'plec',
  'PLOC!': 'ploc', 'PLIM!': 'chave', 'PLIN!': 'plin', 'CLAC!': 'alavanca', 'CLIC!': 'porta', 'CLIQUE!': 'botao',
  clic: 'placa', '+1 CORDA': 'pega', 'RASG!': 'rasga', 'POF!': 'tombo', 'TUC!': 'tuc', 'CRÁS!': 'cras',
};
// Volume de cada receita, medido (janela de 100 ms mais forte) e levado a três níveis: impacto, médio (avisos,
// cenário) e suave (pulo, fala, vento). Os de ruído filtrado saem baixos de fábrica, daí os ganhos grandes.
const GANHO = {
  soco: 1.2, gancho: 0.6, crac: 2, tum: 0.95, tombo: 0.75, prrt: 1.6, strike: 0.95, cravou: 1.25, cras: 1.4, tesourada: 1.35,
  cesta: 1.1, vitoria: 0.85, boing: 0.95,
  plaft: 4.3, rasga: 2, tuc: 2.5, plec: 2.5, toc: 1.8, paf: 2.3, snip: 1.3, toin: 0.7, grudou: 1, ploc: 1.4, chave: 0.7,
  porta: 1.25, pega: 1.1, botao: 1.9, alavanca: 3.1, derrota: 1.25, dano: 1.1, tesoura: 1.5, grampo: 2.9, pousa: 1.05,
  vento: 6, estoca: 7, arremesso: 4, corrida: 4, puf: 5, placa: 12, pulo: 2.5, troca: 1.5, voz: 1.6, chegou: 2.5, plin: 2.1,
};
// timbre de cada herói (pulo, dor, fala): nota base e forma da onda
const VOZ = { marreta: { f: 150, tipo: 'square' }, fiapo: { f: 300, tipo: 'sawtooth' }, pudim: { f: 105, tipo: 'triangle' } };

const Som = {
  ctx: null, saida: null, mudo: false, semMusica: false, ultimo: {},

  init() {
    try {
      this.mudo = localStorage.getItem('lostkings-mudo') === '1';
      this.semMusica = localStorage.getItem('lostkings-sem-musica') === '1';
    } catch (e) { /* sem armazenamento: toca */ }
    const acorda = () => this._abre();
    window.addEventListener('keydown', acorda);
    window.addEventListener('pointerdown', acorda);
  },
  _abre() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.saida = this.mesa(this.ctx, this.ctx.destination);
  },
  // volume geral e um compressor (vários sons juntos não estouram)
  mesa(ctx, dest) {
    const g = ctx.createGain(), comp = ctx.createDynamicsCompressor();
    g.gain.value = 0.55;
    comp.threshold.value = -14; comp.ratio.value = 4;
    g.connect(comp).connect(dest);
    return g;
  },
  // V: som e música → só os efeitos → nada → ... Devolve o texto do aviso.
  alterna() {
    if (this.mudo) { this.mudo = false; this.semMusica = false; } else if (!this.semMusica) this.semMusica = true; else this.mudo = true;
    try {
      localStorage.setItem('lostkings-mudo', this.mudo ? '1' : '0');
      localStorage.setItem('lostkings-sem-musica', this.semMusica ? '1' : '0');
    } catch (e) { /* ok */ }
    return this.mudo ? 'Sem som (V liga)' : this.semMusica ? 'Só os efeitos (sem música)' : 'Som e música';
  },

  // o = { id: herói, n: tamanho da fala, forca: 0-1 }
  toca(nome, o = {}) {
    if (this.mudo || !this.ctx || this.ctx.state !== 'running' || !RECEITAS[nome]) return;
    const agora = this.ctx.currentTime, chave = nome + (o.id || '');
    if (agora - (this.ultimo[chave] ?? -1) < 0.045) return; // o mesmo som duas vezes no mesmo instante: um só
    this.ultimo[chave] = agora;
    this.receita(this.ctx, this.saida, nome, agora + 0.004, o);
  },
  // toca a receita em qualquer contexto (o do jogo, ou um offline para gravar em arquivo), com o volume dela
  receita(ctx, dest, nome, t0, o = {}) {
    const g = ctx.createGain();
    g.gain.value = GANHO[nome] || 1;
    g.connect(dest);
    RECEITAS[nome](new Toca(ctx, g, t0), o);
  },
  porTexto(texto) { return SOM_TEXTO[texto] || null; },
};

// ruído branco (1 s), um por contexto
const RUIDO = new WeakMap();
function ruidoDe(ctx) {
  if (!RUIDO.has(ctx)) {
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    RUIDO.set(ctx, b);
  }
  return RUIDO.get(ctx);
}

// Monta as vozes de um som a partir de t0 (serve para o jogo e para gravar em arquivo, num contexto offline)
class Toca {
  constructor(ctx, dest, t0) { this.c = ctx; this.d = dest; this.t0 = t0; }
  _env(g, t0, vol, ataque, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  // oscilador: f → f1 (glissando), vibrato (vib Hz de largura, vibF por segundo), filtro opcional
  tom({ tipo = 'sine', f = 440, f1 = null, t = 0, dur = 0.15, vol = 0.3, ataque = 0.004, vib = 0, vibF = 0, passa = null }) {
    const c = this.c, t0 = this.t0 + t, o = c.createOscillator(), g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vibF; lg.gain.value = vib;
      l.connect(lg).connect(o.frequency);
      l.start(t0); l.stop(t0 + dur + 0.05);
    }
    this._env(g, t0, vol, ataque, dur);
    let no = o;
    if (passa) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = passa; no.connect(fl); no = fl; }
    no.connect(g).connect(this.d);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // ruído filtrado (tipo do filtro, frequência f → f1)
  ruido({ t = 0, dur = 0.1, vol = 0.3, tipo = 'bandpass', f = 1000, f1 = null, q = 1, ataque = 0.002 }) {
    const c = this.c, t0 = this.t0 + t, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = ruidoDe(c);
    fl.type = tipo; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t0);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    this._env(g, t0, vol, ataque, dur);
    s.connect(fl).connect(g).connect(this.d);
    s.start(t0, Math.random() * 0.4); s.stop(t0 + dur + 0.05);
  }
  notas(lista, { tipo = 'triangle', dur = 0.14, vol = 0.22, passo = 0.09, t = 0 } = {}) {
    lista.forEach((f, i) => this.tom({ tipo, f, t: t + i * passo, dur, vol }));
  }
}

// sorteio repetível (a mesma fala faz o mesmo "blá-blá")
function sorteiaDe(txt) {
  let h = 2166136261;
  for (const ch of String(txt)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h >>> 0) % 1000) / 1000; };
}

const RECEITAS = {
  // --- Marreta
  soco: (s) => {
    s.tom({ f: 150, f1: 55, dur: 0.14, vol: 0.8 });
    s.ruido({ tipo: 'lowpass', f: 1800, dur: 0.06, vol: 0.5 });
    s.tom({ tipo: 'square', f: 90, f1: 40, dur: 0.08, vol: 0.12 });
  },
  gancho: (s) => {
    s.ruido({ f: 500, f1: 2600, q: 0.8, dur: 0.1, vol: 0.22 });
    s.tom({ f: 180, f1: 60, t: 0.03, dur: 0.2, vol: 0.85 });
    s.ruido({ tipo: 'lowpass', f: 2000, t: 0.03, dur: 0.07, vol: 0.5 });
  },
  vento: (s) => s.ruido({ f: 450, f1: 1500, q: 0.8, dur: 0.2, vol: 0.16 }),
  crac: (s) => {
    s.ruido({ tipo: 'highpass', f: 1200, dur: 0.05, vol: 0.55 });
    s.ruido({ f: 700, q: 2, t: 0.02, dur: 0.2, vol: 0.45 });
    s.tom({ tipo: 'square', f: 120, f1: 50, dur: 0.1, vol: 0.1 });
    for (const t of [0.05, 0.09, 0.14, 0.2]) s.ruido({ tipo: 'highpass', f: 2500, t, dur: 0.02, vol: 0.3 });
  },
  plaft: (s) => {
    s.ruido({ f: 2600, q: 0.7, dur: 0.06, vol: 0.6 });
    s.ruido({ tipo: 'lowpass', f: 900, t: 0.01, dur: 0.1, vol: 0.4 });
  },
  tum: (s) => { s.tom({ f: 110, f1: 50, dur: 0.2, vol: 0.7 }); s.ruido({ tipo: 'lowpass', f: 400, dur: 0.1, vol: 0.3 }); },
  // --- Pudim
  boing: (s) => {
    s.tom({ f: 170, f1: 430, dur: 0.34, vol: 0.45, vib: 30, vibF: 18 });
    s.tom({ tipo: 'triangle', f: 85, f1: 210, dur: 0.26, vol: 0.2 });
  },
  // tombo (bundada no chão, amigo arremessado caindo); na bundada vem junto um "prrrt" de leve (tom de zoeira)
  tombo: (s) => {
    s.tom({ f: 120, f1: 45, dur: 0.25, vol: 0.9 });
    s.ruido({ tipo: 'lowpass', f: 600, dur: 0.15, vol: 0.4 });
  },
  prrt: (s) => s.tom({ tipo: 'sawtooth', f: 72, f1: 60, t: 0.07, dur: 0.3, vol: 0.13, vib: 18, vibF: 34, passa: 700 }),
  rasga: (s) => { for (let i = 0; i < 7; i++) s.ruido({ f: 2200 + i * 150, q: 0.6, t: i * 0.035, dur: 0.04, vol: 0.35 }); },
  strike: (s) => {
    s.tom({ f: 80, f1: 40, dur: 0.3, vol: 0.5 });
    s.ruido({ f: 1200, q: 0.5, dur: 0.45, vol: 0.35 });
    for (const [t, f] of [[0.02, 900], [0.06, 1150], [0.1, 800], [0.15, 1300], [0.21, 1000]]) s.tom({ f, f1: f * 0.8, t, dur: 0.05, vol: 0.3 });
  },
  // --- inimigos e armas
  estoca: (s) => s.ruido({ f: 800, f1: 2200, q: 0.9, dur: 0.12, vol: 0.2 }),
  tuc: (s) => { s.tom({ f: 520, f1: 300, dur: 0.06, vol: 0.35 }); s.ruido({ f: 1500, dur: 0.03, vol: 0.3 }); },
  plec: (s) => { s.ruido({ tipo: 'highpass', f: 3000, dur: 0.03, vol: 0.6 }); s.tom({ tipo: 'square', f: 1500, f1: 800, dur: 0.05, vol: 0.1 }); },
  toc: (s) => { s.tom({ f: 900, f1: 700, dur: 0.06, vol: 0.45 }); s.tom({ f: 1400, dur: 0.03, vol: 0.2 }); },
  paf: (s) => { s.ruido({ f: 1800, q: 0.8, dur: 0.07, vol: 0.5 }); s.tom({ f: 200, f1: 90, dur: 0.08, vol: 0.3 }); },
  puf: (s) => s.ruido({ tipo: 'lowpass', f: 800, f1: 200, dur: 0.15, vol: 0.25 }),
  ploc: (s) => s.tom({ f: 620, f1: 150, dur: 0.12, vol: 0.4 }),
  grampo: (s) => {
    s.tom({ tipo: 'square', f: 1800, f1: 900, dur: 0.03, vol: 0.1 });
    s.ruido({ tipo: 'highpass', f: 3000, dur: 0.03, vol: 0.3 });
    s.tom({ tipo: 'square', f: 600, t: 0.04, dur: 0.03, vol: 0.08 });
  },
  plin: (s) => s.tom({ tipo: 'triangle', f: 2500, f1: 2000, dur: 0.15, vol: 0.15 }),
  cras: (s) => {
    s.ruido({ tipo: 'highpass', f: 2500, dur: 0.3, vol: 0.4 });
    s.tom({ tipo: 'square', f: 700, f1: 300, dur: 0.2, vol: 0.1 });
    s.tom({ tipo: 'triangle', f: 2200, dur: 0.3, vol: 0.1, vib: 40, vibF: 25 });
  },
  arremesso: (s) => { s.ruido({ f: 1200, f1: 600, q: 0.8, dur: 0.15, vol: 0.15 }); s.tom({ tipo: 'triangle', f: 400, f1: 700, dur: 0.08, vol: 0.06 }); },
  cesta: (s) => {
    s.ruido({ f: 3000, f1: 800, q: 0.7, dur: 0.25, vol: 0.2 });
    s.notas([523, 659, 784, 1047], { t: 0.15, passo: 0.08, dur: 0.18, vol: 0.24 });
  },
  // tesoureiro: abre e fecha a tesoura (aviso), arranca, corta, crava
  tesoura: (s) => { for (const t of [0, 0.13, 0.26]) { s.ruido({ tipo: 'highpass', f: 4500, t, dur: 0.04, vol: 0.3 }); s.tom({ tipo: 'triangle', f: 3000, t, dur: 0.03, vol: 0.12 }); } },
  corrida: (s) => { s.ruido({ f: 300, f1: 1300, q: 0.7, dur: 0.3, vol: 0.25 }); s.tom({ tipo: 'sawtooth', f: 110, f1: 230, dur: 0.25, vol: 0.06, passa: 900 }); },
  tesourada: (s) => { for (const t of [0, 0.06]) { s.ruido({ tipo: 'highpass', f: 4000, t, dur: 0.07, vol: 0.45 }); s.tom({ tipo: 'square', f: 2200, f1: 1800, t, dur: 0.04, vol: 0.07 }); } },
  snip: (s) => { for (const t of [0, 0.07]) { s.tom({ tipo: 'triangle', f: 3200, t, dur: 0.03, vol: 0.2 }); s.ruido({ tipo: 'highpass', f: 5000, t, dur: 0.05, vol: 0.35 }); } },
  cravou: (s) => {
    s.tom({ f: 95, f1: 60, dur: 0.15, vol: 0.6 });
    s.ruido({ f: 1500, q: 3, dur: 0.1, vol: 0.3 });
    s.tom({ tipo: 'triangle', f: 1800, dur: 0.45, vol: 0.12, vib: 25, vibF: 32 });
  },
  toin: (s) => s.tom({ f: 300, f1: 120, dur: 0.25, vol: 0.5, vib: 25, vibF: 25 }),
  grudou: (s) => { s.tom({ f: 400, f1: 120, dur: 0.3, vol: 0.3, vib: 20, vibF: 14 }); s.ruido({ tipo: 'lowpass', f: 500, dur: 0.25, vol: 0.3 }); },
  // --- cenário
  alavanca: (s) => { s.tom({ tipo: 'square', f: 300, f1: 150, dur: 0.05, vol: 0.14 }); s.ruido({ f: 2000, q: 2, dur: 0.04, vol: 0.35 }); s.tom({ tipo: 'square', f: 200, t: 0.07, dur: 0.04, vol: 0.1 }); },
  porta: (s) => { s.ruido({ f: 3000, q: 4, dur: 0.03, vol: 0.4 }); s.notas([784, 1047], { t: 0.05, passo: 0.07, dur: 0.12, vol: 0.18 }); },
  botao: (s) => { s.tom({ f: 220, f1: 150, dur: 0.08, vol: 0.4 }); s.ruido({ f: 1800, q: 2, dur: 0.03, vol: 0.3 }); },
  placa: (s) => s.ruido({ f: 2400, q: 3, dur: 0.025, vol: 0.3 }),
  chave: (s) => { s.tom({ f: 1318, dur: 0.5, vol: 0.22 }); s.tom({ f: 1976, t: 0.06, dur: 0.5, vol: 0.16 }); },
  pega: (s) => s.notas([660, 880, 1175], { passo: 0.06, dur: 0.12, vol: 0.2 }),
  // --- heróis (o = { id })
  pulo: (s, o) => { const v = VOZ[o.id] || VOZ.marreta; s.tom({ tipo: 'square', f: v.f * 1.7, f1: v.f * 3.4, dur: o.id === 'pudim' ? 0.16 : 0.11, vol: 0.07, passa: 2200 }); },
  pousa: (s, o) => s.tom({ f: o.id === 'pudim' ? 90 : 130, f1: 50, dur: 0.1, vol: o.id === 'pudim' ? 0.5 : 0.25 }),
  dano: (s, o) => {
    const v = VOZ[o.id] || VOZ.marreta;
    s.tom({ tipo: 'square', f: v.f * 2.2, f1: v.f * 1.2, dur: 0.16, vol: 0.12, passa: 2500 });
    s.tom({ tipo: 'square', f: v.f * 2.6, f1: v.f * 1.1, t: 0.12, dur: 0.22, vol: 0.12, passa: 2500 });
  },
  troca: (s) => s.notas([880, 1175], { passo: 0.05, dur: 0.07, vol: 0.14 }),
  // fala: "blá-blá" no timbre de cada um, uma sílaba a cada ~4 letras
  voz: (s, o) => {
    const v = VOZ[o.id] || VOZ.marreta, r = sorteiaDe(o.txt || ''), n = U.clamp(Math.round((o.n || 8) / 4), 2, 6);
    for (let i = 0; i < n; i++) s.tom({ tipo: v.tipo, f: v.f * (0.9 + r() * 0.6), f1: v.f * (0.8 + r() * 0.5), t: i * 0.075, dur: 0.065, vol: 0.07, passa: 1300 });
  },
  chegou: (s) => s.tom({ tipo: 'triangle', f: 660, f1: 990, dur: 0.1, vol: 0.18 }),
  vitoria: (s) => {
    s.notas([523, 659, 784, 1047], { tipo: 'square', passo: 0.12, dur: 0.14, vol: 0.09 });
    for (const f of [523, 659, 784]) s.tom({ tipo: 'triangle', f, t: 0.52, dur: 0.7, vol: 0.14 });
  },
  derrota: (s) => {
    [[392, 370], [370, 349], [349, 330]].forEach(([a, b], i) => s.tom({ tipo: 'sawtooth', f: a, f1: b, t: i * 0.3, dur: 0.28, vol: 0.12, passa: 1100 }));
    s.tom({ tipo: 'sawtooth', f: 330, f1: 300, t: 0.9, dur: 0.8, vol: 0.12, vib: 8, vibF: 6, passa: 1100 });
  },
};
