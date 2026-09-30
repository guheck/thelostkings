'use strict';

// Rostos: olhos, sobrancelhas, boca, rubor e suor. Cada expressão é só um conjunto de números.
const BOCA_ESCURA = '#5b1d2c';
const LINGUA = '#ef7b8a';
const DENTE = '#fffaf0';

const Rosto = {
  PADRAO: {
    olhos: 'normal', olhoEsc: 1, pupila: 1, palp: 0.12, olhar: { x: 0.25, y: 0 },
    sobrAng: 0, sobrAlt: 0, boca: 'sorrisinho', abre: 0.5, lingua: false,
    rubor: 0, suor: 0, bochecha: 0, tremor: 0,
  },
  EXPR: {
    neutro: {},
    feliz: { palp: 0, sobrAng: -0.12, sobrAlt: 3, boca: 'sorriso', abre: 0.7 },
    alivio: { olhos: 'feliz', sobrAng: -0.2, sobrAlt: 2, boca: 'sorriso', abre: 0.35 },
    susto: { olhoEsc: 1.45, pupila: 0.42, palp: 0, sobrAng: -0.35, sobrAlt: 9, boca: 'o', abre: 0.8, tremor: 0.6 },
    grito: { olhoEsc: 1.6, pupila: 0.34, palp: 0, sobrAng: -0.45, sobrAlt: 11, boca: 'grito', abre: 1, tremor: 1 },
    segurando: { olhoEsc: 1, pupila: 0.8, palp: 0.3, sobrAng: -0.3, sobrAlt: 4, boca: 'ondulada', rubor: 0.45, suor: 0.6, olhar: { x: 0.5, y: -0.3 } },
    esforco: { olhos: 'apertado', sobrAng: -0.3, sobrAlt: 4, boca: 'ondulada', rubor: 0.9, suor: 1, bochecha: 1, tremor: 0.8 },
    confia: { olhoEsc: 0.95, pupila: 1.1, palp: 0.38, sobrAng: 0.34, sobrAlt: -2, boca: 'dentes', abre: 0.55 },
    tonto: { olhos: 'espiral', sobrAng: 0.1, sobrAlt: 2, boca: 'torta', abre: 0.6, lingua: true },
    nojo: { olhoEsc: 0.9, palp: 0.55, sobrAng: 0.3, sobrAlt: -1, boca: 'nojo', lingua: true, olhar: { x: -0.7, y: 0.2 } },
    vergonha: { palp: 0.35, sobrAng: -0.32, sobrAlt: 3, boca: 'ondulada', rubor: 1, suor: 0.5, olhar: { x: -0.6, y: 0.6 } },
  },

  expr(nome, extra) {
    return Object.assign({ nome }, this.PADRAO, this.EXPR[nome] || {}, extra || {});
  },

  // Desenha o rosto no referencial da cabeça (origem no centro, +x = para onde olha)
  desenha(ctx, ch, e, t) {
    const R = ch.rosto;
    const trem = e.tremor ? Math.sin(t * 90) * 0.6 * e.tremor : 0;
    ctx.save();
    ctx.translate(trem, 0);
    // rubor e bochecha inflada
    const rub = Math.max(R.ruborBase || 0, e.rubor);
    for (const b of R.bochechas) {
      if (e.bochecha > 0.02) {
        Estilo.forma(ctx, (c) => U.circulo(c, b.x + 2, b.y + 1, b.r * (0.7 + 0.5 * e.bochecha)),
          { cor: ch.cor.pele, luz: false }, { elev: 1.2, linha: 2, cel: false });
      }
      if (rub > 0.02) {
        ctx.save();
        ctx.globalAlpha = U.clamp(rub, 0, 1) * 0.9;
        Estilo.forma(ctx, (c) => U.elipse(c, b.x, b.y, b.r * (0.8 + 0.2 * rub), b.r * 0.62 * (0.8 + 0.2 * rub)),
          { cor: '#f2708a', luz: false }, { elev: 0, linha: 0, cel: false });
        ctx.restore();
      }
    }
    for (let i = 0; i < R.olhos.length; i++) this.olho(ctx, ch, e, i, t);
    this.boca(ctx, ch, e, t);
    if (e.suor > 0.05) this.suor(ctx, ch, e, t);
    ctx.restore();
  },

  olho(ctx, ch, e, i, t) {
    const o = ch.rosto.olhos[i];
    const r = o.r * (e.olhos === 'normal' ? e.olhoEsc : 1);
    const esc = ch.rosto.escuro || '#2b1f2e';
    const fino = Estilo.atual === 'cartoon' ? 2 : 0;
    // sobrancelha
    const sb = ch.rosto.sobr;
    const lado = o.x < ch.rosto.olhos[1 - i]?.x ? 1 : -1; // 1 = olho de trás (canto interno para +x)
    const by = o.y - o.r * (e.olhos === 'normal' ? Math.max(1, e.olhoEsc) : 1) - sb.dy - e.sobrAlt;
    ctx.save();
    ctx.translate(o.x + (sb.dx || 0) * lado, by);
    ctx.rotate(e.sobrAng * lado + (sb.ang || 0) * lado);
    Estilo.forma(ctx, (c) => U.retRed(c, -sb.w / 2, -sb.h / 2, sb.w, sb.h, sb.h / 2),
      { cor: sb.cor || esc, luz: false }, { elev: 1, linha: fino, cel: false });
    ctx.restore();

    if (e.olhos === 'espiral') {
      Estilo.forma(ctx, (c) => U.circulo(c, o.x, o.y, o.r * 1.15), { cor: '#fffdf6', textura: 'nada' }, { elev: 1, linha: fino || 0, cel: false });
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(t * 9 * (i ? 1 : -1));
      Estilo.traco(ctx, (c) => {
        c.beginPath();
        for (let a = 0; a < 5.4 * Math.PI; a += 0.2) {
          const rr = (a / (5.4 * Math.PI)) * o.r * 0.95;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          a === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
      }, esc, 1.8, { elev: 0 });
      ctx.restore();
      return;
    }
    if (e.olhos === 'x' || e.olhos === 'apertado' || e.olhos === 'feliz') {
      ctx.save();
      ctx.translate(o.x, o.y);
      const w = o.r * 0.95;
      Estilo.traco(ctx, (c) => {
        c.beginPath();
        if (e.olhos === 'x') {
          c.moveTo(-w, -w); c.lineTo(w, w); c.moveTo(w, -w); c.lineTo(-w, w);
        } else if (e.olhos === 'feliz') {
          c.moveTo(-w, w * 0.35); c.quadraticCurveTo(0, -w * 1.1, w, w * 0.35);
        } else { // apertado: > <
          const s = lado; // aponta para o nariz
          c.moveTo(-w * s, -w * 0.7); c.lineTo(w * 0.7 * s, 0); c.lineTo(-w * s, w * 0.7);
        }
      }, esc, Math.max(2.4, o.r * 0.38), { elev: 1 });
      ctx.restore();
      return;
    }
    // olho normal
    const ry = r * (o.alto || 1.12);
    Estilo.forma(ctx, (c) => U.elipse(c, o.x, o.y, r, ry), { cor: '#fffdf6', textura: 'nada' }, { elev: 1.2, linha: fino || 0, cel: false });
    const pr = Math.min(r * 0.92, r * 0.55 * e.pupila);
    const olhar = e.olhar || { x: 0, y: 0 };
    const px = o.x + U.clamp(olhar.x, -1, 1) * (r - pr) * 0.8;
    const py = o.y + U.clamp(olhar.y, -1, 1) * (ry - pr) * 0.8;
    ctx.save();
    U.elipse(ctx, o.x, o.y, r, ry);
    ctx.clip();
    Estilo.forma(ctx, (c) => U.circulo(c, px, py, pr), { cor: '#1d1622', textura: 'nada', luz: false }, { elev: 0.6, linha: 0, cel: false });
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    U.circulo(ctx, px - pr * 0.35, py - pr * 0.38, Math.max(1, pr * 0.34));
    ctx.fill();
    // pálpebra (papel da cor da pele descendo)
    const palp = U.clamp(e.palp, 0, 1);
    if (palp > 0.02) {
      const topo = o.y - ry - 2, alt = (ry * 2 + 4) * palp;
      Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(o.x - r - 3, topo - 4, r * 2 + 6, alt + 4); },
        { cor: ch.cor.palpebra || ch.cor.pele, luz: false }, { elev: 1.2, linha: 0, cel: false });
      Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(o.x - r - 2, topo + alt); c.lineTo(o.x + r + 2, topo + alt); },
        esc, Estilo.atual === 'cartoon' ? 2.4 : 1.6, { elev: 0 });
    }
    ctx.restore();
    if (fino) { // contorno do olho no cartoon
      ctx.save();
      U.elipse(ctx, o.x, o.y, r, ry);
      ctx.lineWidth = 2;
      ctx.strokeStyle = Estilo.TINTA;
      ctx.stroke();
      ctx.restore();
    }
  },

  boca(ctx, ch, e, t) {
    const m = ch.rosto.boca;
    const w = m.w, esc = BOCA_ESCURA;
    const fino = Estilo.atual === 'cartoon' ? 2.2 : 0;
    const tipo = e.boca;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.ang || 0);
    const escuro = { cor: esc, textura: 'nada', luz: false };
    const op = { elev: 1, linha: fino, cel: false };
    if (tipo === 'sorrisinho' || tipo === 'ondulada' || tipo === 'nojo') {
      Estilo.traco(ctx, (c) => {
        c.beginPath();
        if (tipo === 'sorrisinho') {
          c.moveTo(-w * 0.35, -1); c.quadraticCurveTo(0, w * 0.22, w * 0.35, -2);
        } else {
          const n = tipo === 'nojo' ? 4 : 5, A = tipo === 'nojo' ? 3.2 : 2.2;
          for (let i = 0; i <= n * 4; i++) {
            const x = -w * 0.4 + (i / (n * 4)) * w * 0.8;
            const y = Math.sin(i / 4 * Math.PI + (tipo === 'ondulada' ? t * 14 : 0)) * A;
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
          }
        }
      }, esc, 3.2, { elev: 1, contorno: false });
      if (tipo === 'nojo' || e.lingua) {
        Estilo.forma(ctx, (c) => { c.beginPath(); c.ellipse(w * 0.22, 5, 5, 7, -0.3, 0, U.TAU); }, { cor: LINGUA, textura: 'nada', luz: false }, op);
      }
    } else if (tipo === 'o') {
      const a = 0.6 + e.abre * 0.6;
      Estilo.forma(ctx, (c) => U.elipse(c, 0, 2, w * 0.17 * a, w * 0.22 * a), escuro, op);
    } else if (tipo === 'sorriso' || tipo === 'grito' || tipo === 'torta') {
      const a = e.abre;
      const cam = (c) => {
        c.beginPath();
        if (tipo === 'sorriso') {
          c.moveTo(-w * 0.45, -2);
          c.quadraticCurveTo(0, -5, w * 0.45, -2);
          c.quadraticCurveTo(w * 0.35, 4 + w * 0.55 * a, 0, 4 + w * 0.6 * a);
          c.quadraticCurveTo(-w * 0.35, 4 + w * 0.55 * a, -w * 0.45, -2);
        } else if (tipo === 'grito') {
          c.ellipse(0, w * 0.28, w * 0.34, w * 0.5 * (0.6 + 0.4 * a), 0, 0, U.TAU);
        } else {
          c.ellipse(0, 4, w * 0.3, w * 0.2 * (0.6 + a), 0.35, 0, U.TAU);
        }
      };
      Estilo.forma(ctx, cam, escuro, op);
      ctx.save();
      cam(ctx);
      ctx.clip();
      if (tipo !== 'torta') {
        ctx.fillStyle = DENTE;
        ctx.fillRect(-w * 0.5, tipo === 'grito' ? w * 0.28 - w * 0.5 * (0.6 + 0.4 * a) - 1 : -8, w, tipo === 'grito' ? 6 : 6.5);
      }
      ctx.fillStyle = LINGUA;
      U.elipse(ctx, tipo === 'torta' ? 3 : 0, tipo === 'grito' ? w * 0.28 + w * 0.5 * (0.6 + 0.4 * a) : 6 + w * 0.6 * a, w * 0.26, w * 0.2);
      ctx.fill();
      ctx.restore();
      if (tipo === 'torta' && e.lingua) {
        Estilo.forma(ctx, (c) => { c.beginPath(); c.ellipse(6, 11, 5, 8, -0.4, 0, U.TAU); }, { cor: LINGUA, textura: 'nada', luz: false }, op);
      }
    } else if (tipo === 'dentes') {
      const h = 6 + w * 0.32 * e.abre;
      const cam = (c) => {
        c.beginPath();
        c.moveTo(-w * 0.48, -3);
        c.quadraticCurveTo(0, -1, w * 0.48, -5);
        c.quadraticCurveTo(w * 0.4, h + 2, 0, h + 3);
        c.quadraticCurveTo(-w * 0.42, h + 2, -w * 0.48, -3);
      };
      Estilo.forma(ctx, cam, escuro, op);
      ctx.save();
      cam(ctx);
      ctx.clip();
      ctx.fillStyle = ch.rosto.corDentes || DENTE;
      ctx.fillRect(-w * 0.5, -6, w, h * 0.62 + 4);
      ctx.strokeStyle = 'rgba(40,20,40,0.35)';
      ctx.lineWidth = 1;
      for (let x = -w * 0.3; x < w * 0.45; x += w * 0.19) {
        ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x, h * 0.62 - 2); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  suor(ctx, ch, e, t) {
    const s = ch.rosto.suor;
    const n = e.suor > 0.7 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const fase = (t * 0.9 + i * 0.5) % 1;
      const x = s.x + i * 9, y = s.y + fase * 16 + i * 6;
      const k = e.suor * (1 - fase * 0.4);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(0, -8);
        c.quadraticCurveTo(5, 0, 4, 3);
        c.arc(0, 3, 4, 0, Math.PI);
        c.quadraticCurveTo(-5, 0, 0, -8);
        c.closePath();
      }, { cor: '#8fd3f4', textura: 'nada' }, { elev: 1, linha: 1.6, cel: false });
      ctx.restore();
    }
  },
};
