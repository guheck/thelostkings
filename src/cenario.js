'use strict';

// Mundo de papelaria: céu de papel, colinas em camadas, papelão, lápis, tachinha, barbante e efeitos.
const FONTE_TITULO = '"Luckiest Guy", "Arial Black", sans-serif';
const FONTE_FALA = '"Patrick Hand", "Comic Sans MS", sans-serif';
// Objetos do cenário desenhados pela IA (src/objetos.js, o padrão); com ?codigo, tudo sai no desenho por código
const comObjetos = () => typeof Objetos !== 'undefined' && Objetos.pronto();

// faixa do tampo do chão: altura, recuo das pontas, cores (do papelão da laje)
const FAIXA_CHAO = { h: 28, recuo: 10, quina: 4, fundo: '#d9954f', frente: '#f6bb74', linha: '#2b1a12', veio: 'rgba(120,70,30,0.35)' };

const Cenario = {
  // Folha de papel lisa ocupando a área
  folha(ctx, x, y, w, h, cor) {
    Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(x, y, w, h); }, { cor, luz: false }, { elev: 0, linha: 0, cel: false });
  },

  ceu(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, comObjetos() ? '#92d3f6' : '#9fd6df'); // com a arte da IA, o azul do fundo dela (mockup 29/09)
    g.addColorStop(1, comObjetos() ? '#e4f2e2' : '#eaf3dc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (Estilo.atual === 'papel') {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = Estilo.padrao(ctx, 'papel');
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },

  sol(ctx, x, y, r, t) {
    if (comObjetos() && Objetos.fundo(ctx, 'sol', x, y, r * 3.3, true)) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.15);
    Estilo.forma(ctx, (c) => {
      c.beginPath();
      const n = 28;
      for (let i = 0; i <= n * 2; i++) {
        const a = (i / (n * 2)) * U.TAU, rr = i % 2 ? r * 1.18 : r * 1.02;
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
    }, { cor: '#ffd35a' }, { elev: 3, linha: 3 });
    Estilo.forma(ctx, (c) => U.circulo(c, 0, 0, r * 0.82), { cor: '#ffe483', luz: false }, { elev: 1.5, linha: 0, cel: false });
    ctx.restore();
  },

  // Colina ondulada de uma camada (colinaY: a altura da crista em x)
  colinaY(x, base, amp, freq, fase) { return base - amp * (0.6 * Math.sin(x * freq + fase) + 0.4 * Math.sin(x * freq * 2.3 + fase * 1.7)); },
  colina(ctx, W, H, base, amp, freq, fase, cor, elev) {
    Estilo.forma(ctx, (c) => {
      c.beginPath();
      c.moveTo(-20, H + 20);
      for (let x = -20; x <= W + 20; x += 16) c.lineTo(x, this.colinaY(x, base, amp, freq, fase));
      c.lineTo(W + 20, H + 20);
      c.closePath();
    }, { cor }, { elev, linha: 3 });
  },

  // Cores das três camadas de colina (longe, meio, perto): com a arte da IA, as do fundo dela (mockup de 29/09)
  coresColina() { return comObjetos() ? ['#b3d2a6', '#9cc27e', '#86b656'] : ['#bcdcaa', '#96c586', '#73ad6e']; },

  // Árvores e arbustos da IA espalhados na crista de uma colina (sem a arte da IA, nada): posições pelo hash (fixas)
  enfeites(ctx, W, base, amp, freq, fase, semente, alt, pecas, passo = 260) {
    if (!comObjetos()) return;
    for (let i = 0, x = 40 + U.hash(semente) * passo; x < W + 60; i++, x += passo * (0.55 + U.hash(semente + i * 7) * 0.9)) {
      const nome = pecas[Math.floor(U.hash(semente + i * 13) * pecas.length)], k = 0.8 + U.hash(semente + i * 3) * 0.4;
      Objetos.fundo(ctx, nome, x, this.colinaY(x, base, amp, freq, fase) + alt * 0.12, alt * k);
    }
  },

  castelo(ctx, x, y, s) {
    if (comObjetos() && Objetos.fundo(ctx, 'castelo', x, y, 175 * s)) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const cor = '#c6b3dc', escura = '#a894c4';
    // bandeira
    Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(0, -128); c.lineTo(0, -160); }, '#6d5a86', 2.5, { elev: 1 });
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(0, -160); c.lineTo(26, -152); c.lineTo(0, -144); c.closePath(); }, { cor: '#e0443a' }, { elev: 1.5, linha: 2 });
    const torre = (tx, tw, th, cor) => {
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(tx - tw / 2, 0);
        c.lineTo(tx - tw / 2, -th);
        const n = 4, d = tw / (n * 2 - 1);
        for (let i = 0; i < n * 2 - 1; i++) {
          const xx = tx - tw / 2 + i * d;
          if (i % 2 === 0) { c.lineTo(xx, -th - 8); c.lineTo(xx + d, -th - 8); } else c.lineTo(xx + d, -th);
        }
        c.lineTo(tx + tw / 2, 0);
        c.closePath();
      }, { cor }, { elev: 2, linha: 2.5 });
    };
    torre(-46, 30, 70, escura);
    torre(46, 30, 70, escura);
    torre(0, 46, 120, cor);
    Estilo.forma(ctx, (c) => U.retRed(c, -30, -60, 60, 60, 2), { cor }, { elev: 2, linha: 2.5 });
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(-10, 0); c.lineTo(-10, -22); c.arc(0, -22, 10, Math.PI, 0); c.lineTo(10, 0); c.closePath(); },
      { cor: '#6d5a86', luz: false }, { elev: 1, linha: 2, cel: false });
    for (const [wx, wy] of [[0, -96], [-46, -52], [46, -52]]) {
      Estilo.forma(ctx, (c) => U.retRed(c, wx - 4, wy - 8, 8, 14, 4), { cor: '#6d5a86', luz: false }, { elev: 0.6, linha: 1.5, cel: false });
    }
    ctx.restore();
  },

  // Nuvem pendurada por um fio (teatrinho de papel); topo = onde o fio está preso (o alto da tela: a ponta nunca
  // aparece); tipo = qual das três nuvens da IA (sem ele, sai da fase)
  nuvem(ctx, x, y, s, t, fase, topo = -10, tipo = null) {
    const dy = Math.sin(t * 0.9 + fase) * 4, rot = Math.sin(t * 0.7 + fase) * 0.03;
    Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(x + 6 * s, topo); c.lineTo(x + 6 * s, y + dy - 26 * s); }, 'rgba(90,80,70,0.55)', 1.2 + s * 0.15, { elev: 0.5 });
    ctx.save();
    ctx.translate(x, y + dy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    const k = tipo ?? Math.abs(Math.round(fase * 10)) % 3; // qual das três nuvens da IA
    if (comObjetos() && Objetos.fundo(ctx, `nuvem${k + 1}`, 4, -4, [62, 52, 40][k], true)) { ctx.restore(); return; }
    Estilo.carimbo(ctx, 'nuvem', [-56, -40, 62, 24], (g) => {
      Estilo.forma(g, (c) => {
        c.beginPath();
        c.moveTo(-52, 14);
        c.arc(-34, 2, 18, Math.PI * 0.75, Math.PI * 1.55);
        c.arc(-8, -12, 24, Math.PI * 1.1, Math.PI * 1.85);
        c.arc(24, -6, 20, Math.PI * 1.25, Math.PI * 1.95);
        c.arc(44, 6, 14, Math.PI * 1.4, Math.PI * 0.4);
        c.lineTo(-52, 20);
        c.closePath();
      }, { cor: '#fdfbf4', borda: false }, { elev: 3.2, linha: 3 });
    }, 3.2);
    ctx.restore();
  },

  // Faixa do tampo do chão (29/09, ideia do usuário): um pedacinho do chão visto de cima, logo acima da linha em que os
  // pés pisam — os desenhos têm um pé um pouco mais alto que o outro (vista de 3/4), e com a faixa os dois pisam no
  // chão. Vai em cima de todo chão: fases (Nivel._faixas), menu e cenas. e0/e1: recuo das pontas no fundo (perspectiva;
  // 0 encostada numa parede; null = emenda na faixa de uma rampa: reta e sem o risco da ponta; 'emenda' = encosta
  // no chão de papel, que cobre a altura da faixa). F: as cores.
  faixa(g, x0, x1, y, e0 = FAIXA_CHAO.recuo, e1 = FAIXA_CHAO.recuo, F = FAIXA_CHAO) {
    // ponta livre: a base começa depois da quina arredondada do papelão (senão a faixa passa da quina e sobra uma bordinha)
    const gr = g.createLinearGradient(0, y - F.h, 0, y), jun = (e) => e === null || e === 'emenda';
    const q0 = e0 > 0 ? F.quina : 0, q1 = e1 > 0 ? F.quina : 0, a = q0 + (jun(e0) ? 0 : e0), b = q1 + (jun(e1) ? 0 : e1);
    gr.addColorStop(0, F.fundo); gr.addColorStop(1, F.frente);
    g.beginPath();
    g.moveTo(x0 + q0, y + 1); g.lineTo(x0 + a, y - F.h); g.lineTo(x1 - b, y - F.h); g.lineTo(x1 - q1, y + 1); g.closePath();
    g.fillStyle = gr; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = F.linha; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    if (jun(e0)) g.moveTo(x0, y - F.h); else { g.moveTo(x0 + q0, y); g.lineTo(x0 + a, y - F.h); }
    g.lineTo(x1 - b, y - F.h);
    if (!jun(e1)) g.lineTo(x1 - q1, y);
    g.stroke();
    // emenda com a rampa: tapa a quina arredondada do bloco (sobrava um pedacinho de contorno); a linha da frente vem
    // depois, inteira (Nivel._faixas, modo 'linha')
    for (const [e, x, d] of [[e0, x0, 1], [e1, x1, -1]]) {
      if (e !== null) continue;
      g.fillStyle = F.frente; g.fillRect(Math.min(x, x + d * 7) - 0.5, y, 8, 6);
    }
    g.lineCap = 'butt';
    g.strokeStyle = F.veio; g.lineWidth = 1; // veio do papelão, bem de leve
    for (let x = x0 + 18; x < x1 - 10; x += 37) { g.beginPath(); g.moveTo(x, y - F.h * 0.62); g.lineTo(x + 14, y - F.h * 0.62); g.stroke(); }
  },

  // Laje de papelão (plataforma)
  plataforma(ctx, x, y, w, h) {
    if (comObjetos() && Objetos.laje(ctx, x, y, w, h)) return; // desenho da IA: laje em 9 fatias
    Estilo.forma(ctx, (c) => U.retRed(c, x, y, w, h, 5), { cor: '#c48b52', textura: 'papelao' }, { elev: 5, linha: 3.5, celK: 7 });
    ctx.save();
    U.retRed(ctx, x, y, w, h, 5);
    ctx.clip();
    Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(x - 5, y - 5, w + 10, 15); }, { cor: '#dcaa70', textura: 'papelao', luz: false }, { elev: 1.2, linha: 0, cel: false });
    // miolo ondulado do papelão
    const y0 = y + 14, y1 = y + 30;
    Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(x - 5, y0, w + 10, y1 - y0); }, { cor: '#b17a44', textura: 'papelao', luz: false }, { elev: 0.8, linha: 0, cel: false });
    Estilo.traco(ctx, (c) => {
      c.beginPath();
      for (let xx = x - 5; xx <= x + w + 5; xx += 2) {
        const yy = (y0 + y1) / 2 + Math.sin((xx - x) * 0.42) * (y1 - y0) * 0.42;
        xx === x - 5 ? c.moveTo(xx, yy) : c.lineTo(xx, yy);
      }
    }, '#e3b884', 2.6, { elev: 0.6 });
    Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(x - 5, y1, w + 10, 4); }, { cor: '#d6a36a', textura: 'papelao', luz: false }, { elev: 0.6, linha: 0, cel: false });
    ctx.restore();
  },

  // Rampa de papelão de 45° (r = 1 sobe para a direita, -1 para a esquerda): a face da laje num triângulo e a borda
  // clara de cima na inclinação. lado: o lado alto está livre (sem bloco encostado): contorno nele também
  rampa(ctx, x, y, r, lado) {
    const T = TILE, xa = r > 0 ? x : x + T, xb = r > 0 ? x + T : x; // xa: pé da rampa; xb: lado alto
    const tri = (c) => { c.beginPath(); c.moveTo(xa, y + T); c.lineTo(xb, y); c.lineTo(xb, y + T); c.closePath(); };
    Estilo.forma(ctx, tri, { cor: '#c48b52', textura: 'papelao' }, { elev: 2, linha: 0, cel: false });
    ctx.save();
    tri(ctx); ctx.clip();
    Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(xa - (xb - xa) * 0.2, y + T * 1.2); c.lineTo(xb + (xb - xa) * 0.2, y - T * 0.2); }, '#dcaa70', 16, { elev: 0 });
    Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(xa - (xb - xa) * 0.2 + (xb > xa ? 12 : -12), y + T * 1.2 + 12); c.lineTo(xb + (xb - xa) * 0.2 + (xb > xa ? 12 : -12), y - T * 0.2 + 12); }, '#b17a44', 4, { elev: 0 });
    ctx.restore();
    // a linha da inclinação é a linha da frente do chão (Nivel._faixas, inteira por blocos e rampas); aqui só o lado alto
    if (lado) Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(xb, y); c.lineTo(xb, y + T); }, '#2b1f2e', 3.5, { elev: 0 });
  },

  lapis(ctx, x, yBase, h, rot, cor) {
    if (comObjetos() && Objetos.lapis(ctx, x, yBase, h, rot, cor)) return; // desenho da IA
    ctx.save();
    ctx.translate(x, yBase);
    ctx.rotate(rot);
    const w = 18;
    Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(-w / 2, -h + 30, w, h - 30); }, { cor }, { elev: 2.5, linha: 2.5 });
    Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(-w / 2 + 6, -h + 30, 6, h - 30); }, { cor: U.clareia(cor, 0.35), luz: false }, { elev: 0, linha: 0, cel: false });
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(-w / 2, -h + 30); c.lineTo(0, -h); c.lineTo(w / 2, -h + 30); c.closePath(); },
      { cor: '#efcf9c', textura: 'papelao' }, { elev: 2, linha: 2.5 });
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(-3.6, -h + 11); c.lineTo(0, -h); c.lineTo(3.6, -h + 11); c.closePath(); },
      { cor: '#3a3440', textura: 'nada' }, { elev: 0.5, linha: 1.5, cel: false });
    ctx.restore();
  },

  tachinha(ctx, x, y) {
    if (comObjetos() && Objetos.tachinha(ctx, x, y)) return;
    ctx.save();
    ctx.translate(x, y);
    const cor = '#e2433a';
    Estilo.forma(ctx, (c) => U.retRed(c, -15, -7, 30, 7, 3), { cor, borda: true }, { elev: 2.5 });
    Estilo.forma(ctx, (c) => U.retRed(c, -6, -26, 12, 21, 3), { cor: U.escurece(cor, 0.1), borda: true }, { elev: 2 });
    Estilo.forma(ctx, (c) => U.elipse(c, 0, -30, 16, 8), { cor, borda: true }, { elev: 3 });
    Estilo.forma(ctx, (c) => U.elipse(c, -5, -33, 5, 2.2), { cor: 'rgba(255,255,255,0.6)', textura: 'nada', luz: false }, { elev: 0, linha: 0, cel: false });
    ctx.restore();
  },

  // Barbante passando pelos pontos (curva suave)
  barbante(ctx, pts, largura = 5) {
    const cam = (c) => {
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const u = pts[pts.length - 1];
      c.lineTo(u.x, u.y);
    };
    Estilo.traco(ctx, cam, '#c89a5b', largura, { elev: 1.8, contorno: true });
    ctx.save();
    ctx.setLineDash([2.5, 3.5]);
    Estilo.traco(ctx, cam, '#8f6634', largura * 0.4, { elev: 0 });
    ctx.restore();
  },

  // Balão de fala de papel
  balao(ctx, x, y, texto, op = {}) {
    const k = op.k ?? 1;
    if (k <= 0.01) return;
    ctx.save();
    ctx.font = `${op.tam ?? 26}px ${FONTE_FALA}`;
    const w = ctx.measureText(texto).width + 28, h = (op.tam ?? 26) + 18;
    const lado = op.lado ?? 1; // de que lado sai o rabinho
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.rotate(op.rot ?? 0);
    Estilo.forma(ctx, (c) => {
      c.beginPath();
      const x0 = -w / 2, y0 = -h, r = 12;
      c.moveTo(x0 + r, y0);
      c.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
      c.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
      c.lineTo(lado * 4 + 8, y0 + h);
      c.lineTo(-lado * 10, 16);
      c.lineTo(lado * 4 - 8, y0 + h);
      c.arcTo(x0, y0 + h, x0, y0, r);
      c.arcTo(x0, y0, x0 + w, y0, r);
      c.closePath();
    }, { cor: op.cor ?? '#fffdf6', borda: false }, { elev: 3, linha: 3 });
    ctx.fillStyle = '#2b1f2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, 0, -h / 2 + 1);
    ctx.restore();
  },

  // Estrela de papel (para o POW e para o "tonto")
  estrela(ctx, x, y, r, rot, cor, pontas = 5, interno = 0.45) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    Estilo.forma(ctx, (c) => {
      c.beginPath();
      for (let i = 0; i < pontas * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / pontas, rr = i % 2 ? r * interno : r;
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
    }, { cor, borda: true }, { elev: 2, bordaL: 2.4, linha: 2.2 });
    ctx.restore();
  },

  pow(ctx, x, y, k, texto = 'POW!') {
    if (k <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    Cenario.estrela(ctx, 0, 0, 70, 0.2, '#ffd23f', 11, 0.62);
    Cenario.estrela(ctx, 0, 0, 48, -0.1, '#f2553d', 9, 0.6);
    Estilo.texto(ctx, texto, 0, 4, { tam: 38, cor: '#fffdf6', corBorda: '#2b1f2e', rot: -0.12 });
    ctx.restore();
  },

  // Nuvenzinha verde do "prrt"
  pum(ctx, x, y, k) {
    if (k <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = U.clamp(1.6 - k, 0, 1);
    const s = 0.6 + k * 0.8;
    for (const [dx, dy, r] of [[0, 0, 16], [-16, 6, 12], [15, 5, 13], [-4, -12, 11]]) {
      Estilo.forma(ctx, (c) => U.circulo(c, dx * s, dy * s - k * 20, r * s), { cor: '#9bd46a' }, { elev: 1.5, linha: 2.2, cel: false });
    }
    ctx.restore();
  },

  // Etiqueta com fita adesiva (nome dos personagens)
  etiqueta(ctx, x, y, titulo, sub, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = `20px ${FONTE_FALA}`;
    const wSub = ctx.measureText(sub).width;
    ctx.font = `30px ${FONTE_TITULO}`;
    const w = Math.max(ctx.measureText(titulo).width + 40, wSub + 36, 150);
    Estilo.forma(ctx, (c) => U.retRed(c, -w / 2, -28, w, 62, 4), { cor: '#fffaf0' }, { elev: 3, linha: 2.6 });
    ctx.save();
    ctx.globalAlpha = 0.75;
    Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(-22, -38, 44, 18); }, { cor: '#f3a7b5', luz: false }, { elev: 0.5, linha: 0, cel: false });
    ctx.restore();
    ctx.fillStyle = '#2b1f2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titulo, 0, -4);
    ctx.font = `20px ${FONTE_FALA}`;
    ctx.fillStyle = '#6b5a60';
    ctx.fillText(sub, 0, 22);
    ctx.restore();
  },
};
