'use strict';

// Música de fundo feita na hora (Web Audio), sem arquivo: um loop de 16 compassos (~33 s) que emenda sem corte.
// Dó maior, 116 bpm, jeitinho de desenho animado "na ponta dos pés" (os três aprontando na papelaria):
// marimba na melodia, baixo "pum-pá" com acorde curtinho no contratempo, e percussão de papelaria (lápis, papel).
// Tocada por um agendador que marca as notas um pouco à frente do relógio do áudio (não depende do quadro do jogo).
// Serve também para gravar em arquivo (Musica.grava), num contexto offline.
const MUSICA = {
  bpm: 116,
  // acordes por compasso (dois no mesmo compasso: meio a meio)
  acordes: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm G', 'C', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'G7'],
  // melodia em colcheias (8 por compasso); '.' = pausa, a nota anterior não segura (marimba)
  melodia: [
    'E5 . G5 . C6 . B5 G5', 'A5 . E5 . C5 . . .', 'F5 . A5 . C6 . A5 F5', 'G5 . . D5 G5 . B5 .',
    'C6 . G5 . E5 . G5 .', 'A5 . C6 . E6 . C6 .', 'D6 . C6 . B5 . G5 .', 'C6 . . . . . . .',
    'A4 C5 A4 C5 F5 . C5 .', 'B4 D5 B4 D5 G5 . D5 .', 'G4 B4 G4 B4 E5 . B4 .', 'A4 C5 A4 C5 E5 . A5 .',
    'F5 . E5 . D5 . F5 .', 'G5 . F5 . D5 . B4 .', 'C5 E5 G5 C6 . . G5 .', 'F5 . D5 . B4 . G4 .',
  ],
  // percussão em semicolcheias (16 por compasso): b = bumbo (lápis na mesa), p = papel (caixa), c = chimbal (clique)
  bateria: { b: 'x.......x.......', p: '....x.......x...', c: '..x...x...x...xx' },
  volume: 0.26,
};
const ACORDE = {
  C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Dm: ['D', 'F', 'A'], Em: ['E', 'G', 'B'],
  G7: ['G', 'B', 'F'],
};
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const freq = (nome, oit) => 440 * Math.pow(2, (SEMI[nome] + (oit + 1) * 12 - 69) / 12); // freq('A', 4) = 440
const freqDe = (nota) => freq(nota[0], +nota.slice(1));

const Musica = {
  tocando: false, passo: 0, tProx: 0, relogio: null, saida: null,

  // duração de uma semicolcheia e do loop inteiro
  get semi() { return 60 / MUSICA.bpm / 4; },
  get duracao() { return MUSICA.acordes.length * 16 * this.semi; },

  liga() {
    if (this.relogio) return; // um agendador só
    this.tocando = true;
    this.relogio = setInterval(() => this._agenda(), 40);
  },
  desliga() {
    this.tocando = false;
    clearInterval(this.relogio); this.relogio = null;
    if (this.saida) { this.saida.disconnect(); this.saida = null; } // o que já estava marcado cala
  },
  // marca as notas até 0,25 s à frente; parado (mudo, sem áudio, aba escondida), só espera
  _agenda() {
    const ctx = Som.ctx;
    if (!ctx || ctx.state !== 'running' || Som.mudo || Som.semMusica) { if (this.saida) { this.saida.disconnect(); this.saida = null; } return; }
    if (!this.saida) {
      this.saida = ctx.createGain(); this.saida.gain.value = MUSICA.volume; this.saida.connect(Som.saida);
      this.tProx = ctx.currentTime + 0.1; this.passo = 0; // (re)começa do início
    }
    if (this.tProx < ctx.currentTime - 0.2) this.tProx = ctx.currentTime + 0.05; // a aba ficou parada: não despeja atrasadas
    while (this.tProx < ctx.currentTime + 0.25) {
      this.toca(ctx, this.saida, this.passo, this.tProx);
      this.passo = (this.passo + 1) % (MUSICA.acordes.length * 16);
      this.tProx += this.semi;
    }
  },

  // uma semicolcheia (passo 0..255) no instante t
  toca(ctx, dest, passo, t) {
    const c = Math.floor(passo / 16), s = passo % 16, T = new Toca(ctx, dest, t), semi = this.semi;
    const ac = MUSICA.acordes[c].split(' '), acorde = ac[s < 8 || ac.length === 1 ? 0 : 1];
    const [raiz, , quinta] = ACORDE[acorde];
    // melodia (colcheias): marimba — seno com um brilho de 4x que some rápido
    if (s % 2 === 0) {
      const n = MUSICA.melodia[c].split(' ')[s / 2];
      if (n && n !== '.') {
        const f = freqDe(n);
        T.tom({ tipo: 'sine', f, dur: 0.42, vol: 0.34, ataque: 0.004 });
        T.tom({ tipo: 'sine', f: f * 4, dur: 0.07, vol: 0.06, ataque: 0.002 });
        T.tom({ tipo: 'triangle', f: f * 2, dur: 0.12, vol: 0.05, ataque: 0.003 });
      }
    }
    // baixo pum-pá: raiz no 1 e no 3, quinta no 2 e no 4 (pizzicato)
    if (s % 4 === 0) {
      const nota = s % 8 === 0 ? raiz : quinta;
      T.tom({ tipo: 'triangle', f: freq(nota, 2), dur: semi * 2.6, vol: 0.42, ataque: 0.006, passa: 700 });
    }
    // acorde curtinho no contratempo (o "pá"), abafado
    if (s % 8 === 4) for (const n of ACORDE[acorde]) T.tom({ tipo: 'square', f: freq(n, 4), dur: 0.09, vol: 0.022, ataque: 0.003, passa: 1600 });
    // percussão
    const B = MUSICA.bateria;
    if (B.b[s] === 'x') T.tom({ tipo: 'sine', f: 150, f1: 48, dur: 0.14, vol: 0.3, ataque: 0.002 });
    if (B.p[s] === 'x') T.ruido({ dur: 0.09, vol: 0.14, tipo: 'bandpass', f: 1900, q: 0.8 });
    if (B.c[s] === 'x') T.ruido({ dur: 0.028, vol: s % 4 === 2 ? 0.05 : 0.03, tipo: 'highpass', f: 7000 });
  },

  // Grava n voltas do loop (contexto offline) e devolve o WAV em base64 — para mandar a música sem abrir o jogo
  async grava(voltas = 1) {
    const sr = 44100, dur = this.duracao * voltas + 0.6;
    const ctx = new OfflineAudioContext(1, Math.ceil(dur * sr), sr);
    const saida = Som.mesa(ctx, ctx.destination), g = ctx.createGain();
    g.gain.value = MUSICA.volume; g.connect(saida);
    const n = MUSICA.acordes.length * 16;
    for (let i = 0; i < n * voltas; i++) this.toca(ctx, g, i % n, 0.05 + i * this.semi);
    const d = (await ctx.startRendering()).getChannelData(0);
    const buf = new ArrayBuffer(44 + d.length * 2), v = new DataView(buf);
    const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    txt(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    let bin = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return btoa(bin);
  },
};
