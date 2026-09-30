'use strict';

// Os três reis perdidos (nomes provisórios). Cada um: proporções, cores, rosto e desenho das partes.
// Partes de membro são desenhadas de (0,0) até (0,len) no próprio referencial.

function coroa(ctx, x, y, w, h, rot, cor = '#f1bf3a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  Estilo.forma(ctx, (c) => {
    c.beginPath();
    c.moveTo(-w / 2, 0);
    c.lineTo(-w / 2, -h * 0.55);
    c.lineTo(-w / 4, -h * 0.2);
    c.lineTo(0, -h);
    c.lineTo(w / 4, -h * 0.2);
    c.lineTo(w / 2, -h * 0.55);
    c.lineTo(w / 2, 0);
    c.closePath();
  }, { cor, borda: true }, { elev: 2, bordaL: 2.6 });
  Estilo.forma(ctx, (c) => U.circulo(c, 0, -h * 0.28, Math.max(2, w * 0.09)), { cor: '#e0443a', textura: 'nada' }, { elev: 0.8, linha: 1.5, cel: false });
  Estilo.forma(ctx, (c) => U.circulo(c, -w * 0.3, -h * 0.16, Math.max(1.5, w * 0.06)), { cor: '#3b7be0', textura: 'nada' }, { elev: 0.8, linha: 1.2, cel: false });
  Estilo.forma(ctx, (c) => U.circulo(c, w * 0.3, -h * 0.16, Math.max(1.5, w * 0.06)), { cor: '#3fb56a', textura: 'nada' }, { elev: 0.8, linha: 1.2, cel: false });
  ctx.restore();
}

function membro(ctx, len, w0, w1, cor, op = {}) {
  Estilo.forma(ctx, (c) => U.capsula(c, len, w0, w1), { cor, borda: true }, Object.assign({ elev: 2.2 }, op));
}

// Barbante enrolado (usado no Fiapo e na cena)
function rolo(ctx, x, y, rx, ry, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let i = 0; i < 3; i++) {
    Estilo.traco(ctx, (c) => U.elipse(c, i * 1.6 - 1.6, i * 1.2 - 1.2, rx, ry), '#c89a5b', 5, { elev: 1.2, contorno: true });
    ctx.save();
    ctx.setLineDash([2.5, 3.5]);
    ctx.lineDashOffset = i * 2;
    Estilo.traco(ctx, (c) => U.elipse(c, i * 1.6 - 1.6, i * 1.2 - 1.2, rx, ry), '#8f6634', 2, { elev: 0 });
    ctx.restore();
  }
  ctx.restore();
}

const Cast = {
  // ---------------------------------------------------------------------------
  marreta: {
    id: 'marreta', nome: 'Marreta', papel: 'o boxeador',
    frase: 'Gancho arremessa amigo ou nocauteia. Soco quebra parede fraca.',
    exprBase: 'confia',
    p: {
      tronco: 46, pescoco: 31, raioCabeca: 29,
      ombro: { E: [-17, 7], D: [18, 7] }, quadril: { E: [-9, -3], D: [9, -3] },
      braco: 25, antebraco: 22, coxa: 21, canela: 21, sola: 6,
    },
    cor: { pele: '#8a5436', peleSombra: '#6e3f27', calcao: '#d63c2f', luva: '#e8402f', faixa: '#2f6fd6', cabelo: '#2a1c16', bota: '#f4efe6' },
    rosto: {
      olhos: [{ x: 2, y: -1, r: 6.3 }, { x: 19, y: -1, r: 6.8 }],
      sobr: { dy: 4, w: 15, h: 5.5, ang: 0.08 },
      boca: { x: 12, y: 18, w: 22, ang: -0.04 },
      bochechas: [{ x: -2, y: 10, r: 6 }, { x: 25, y: 9, r: 6 }],
      suor: { x: -14, y: -14 },
      corDentes: '#6fb6ff',
      escuro: '#1f1418',
    },
    bracoSup(ctx, len, lado) { membro(ctx, len, 21, 18, lado === 'E' ? this.cor.peleSombra : this.cor.pele); },
    antebraco(ctx, len, lado) { membro(ctx, len, 18, 15, lado === 'E' ? this.cor.peleSombra : this.cor.pele); },
    mao(ctx, lado) {
      const cor = lado === 'E' ? U.escurece(this.cor.luva, 0.12) : this.cor.luva;
      Estilo.forma(ctx, (c) => U.retRed(c, -10, -3, 20, 10, 3), { cor: '#f6f1e6', borda: true }, { elev: 2 });
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-10, 5);
        c.bezierCurveTo(-18, 12, -17, 30, -2, 32);
        c.bezierCurveTo(14, 33, 19, 18, 13, 8);
        c.bezierCurveTo(19, 8, 20, 16, 15, 20); // polegar
        c.bezierCurveTo(20, 12, 16, 4, 10, 5);
        c.closePath();
      }, { cor, borda: true }, { elev: 2.6, celK: 5 });
      Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(-6, 13); c.quadraticCurveTo(2, 17, 9, 12); }, 'rgba(90,15,15,0.45)', 1.6, { elev: 0 });
    },
    coxa(ctx, len, lado) { membro(ctx, len, 17, 15, lado === 'E' ? this.cor.peleSombra : this.cor.pele); },
    canela(ctx, len, lado) {
      membro(ctx, len, 15, 13, lado === 'E' ? this.cor.peleSombra : this.cor.pele);
      Estilo.forma(ctx, (c) => U.retRed(c, -8, len * 0.35, 16, len * 0.75, 4), { cor: lado === 'E' ? '#d9d2c4' : this.cor.bota, borda: true }, { elev: 2 });
      Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(-8, len * 0.38, 16, 3.5); }, { cor: '#d63c2f', luz: false }, { elev: 0.5, linha: 0, cel: false });
    },
    pe(ctx, lado) {
      Estilo.forma(ctx, (c) => U.retRed(c, -8, -8, 23, 10, 5), { cor: lado === 'E' ? '#d9d2c4' : this.cor.bota, borda: true }, { elev: 2 });
      Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(-9, -1, 25, 3.5); }, { cor: '#3a2f3a', luz: false }, { elev: 0.5, linha: 0, cel: false });
    },
    torso(ctx, st) {
      const L = this.p.tronco;
      // calção por baixo da cintura
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-23, -10); c.lineTo(23, -10); c.lineTo(25, 12); c.quadraticCurveTo(12, 16, 2, 9);
        c.quadraticCurveTo(-10, 16, -24, 12); c.closePath();
      }, { cor: this.cor.calcao, borda: true }, { elev: 2.4 });
      Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(14, -9, 5, 20); }, { cor: '#fff6ea', luz: false }, { elev: 0.5, linha: 0, cel: false });
      // peitoral
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-20, -8);
        c.bezierCurveTo(-26, -24, -34, -L + 2, -22, -L - 4);
        c.quadraticCurveTo(2, -L - 12, 26, -L - 4);
        c.bezierCurveTo(36, -L + 4, 28, -22, 22, -8);
        c.closePath();
      }, { cor: this.cor.pele, borda: true }, { elev: 2.6 });
      Estilo.traco(ctx, (c) => {
        c.beginPath();
        c.moveTo(-12, -L + 12); c.quadraticCurveTo(-4, -L + 20, 3, -L + 13);
        c.moveTo(5, -L + 13); c.quadraticCurveTo(14, -L + 21, 22, -L + 11);
        c.moveTo(3, -24); c.lineTo(3, -14);
      }, this.cor.peleSombra, 2.2, { elev: 0 });
      // cinturão de campeão
      Estilo.forma(ctx, (c) => U.retRed(c, -24, -14, 49, 10, 3), { cor: '#e6b83c', borda: true }, { elev: 2 });
      Estilo.forma(ctx, (c) => U.circulo(c, 5, -9, 8), { cor: '#f4d36a', borda: true }, { elev: 1.6 });
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.2 : 5;
          c.lineTo(5 + Math.cos(a) * r, -9 + Math.sin(a) * r);
        }
        c.closePath();
      }, { cor: '#d63c2f', textura: 'nada', luz: false }, { elev: 0.6, linha: 1, cel: false });
    },
    // Cabeça em camadas: trás (animada) -> base (carimbo) -> rosto (vivo) -> frente (carimbo)
    cabecaTras(ctx, st) {
      // fitas da faixa balançando atrás
      for (let i = 0; i < 2; i++) {
        const a = Math.sin(st.t * 5 + i * 1.3) * 0.25 + (st.vento || 0);
        ctx.save();
        ctx.translate(-26, -14 + i * 4);
        ctx.rotate(1.9 + i * 0.35 + a);
        Estilo.carimbo(ctx, 'marreta:fita' + i, [-2, -6, 25, 7], (g) => {
          Estilo.forma(g, (c) => { c.beginPath(); c.moveTo(0, -3); c.lineTo(20, -2 + i); c.lineTo(22, 4); c.lineTo(0, 3); c.closePath(); },
            { cor: U.escurece(this.cor.faixa, 0.1 * i), borda: true }, { elev: 1.6, bordaL: 2.4 });
        }, 1.6);
        ctx.restore();
      }
    },
    cabecaBase(ctx) {
      // orelha de lutador
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.arc(-22, 2, 8.5, 0, U.TAU);
      }, { cor: this.cor.peleSombra, borda: true }, { elev: 2 });
      Estilo.traco(ctx, (c) => { c.beginPath(); c.arc(-22, 2, 4, -1, 2.4); }, '#4e2a18', 1.8, { elev: 0 });
      // cabeça quadradona
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-20, -27);
        c.bezierCurveTo(-10, -35, 16, -35, 25, -26);
        c.bezierCurveTo(31, -16, 32, 4, 31, 14);
        c.bezierCurveTo(30, 28, 16, 33, 3, 33);
        c.bezierCurveTo(-13, 33, -27, 27, -28, 12);
        c.bezierCurveTo(-29, -2, -29, -18, -20, -27);
        c.closePath();
      }, { cor: this.cor.pele, borda: true }, { elev: 2.4 });
      // cabelo raspado
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-22, -20);
        c.bezierCurveTo(-12, -37, 16, -37, 26, -24);
        c.lineTo(26, -20);
        c.quadraticCurveTo(2, -26, -22, -16);
        c.closePath();
      }, { cor: this.cor.cabelo, luz: false }, { elev: 1, linha: 0, cel: false });
      // faixa na testa
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-28, -21); c.quadraticCurveTo(0, -27, 31, -19); c.lineTo(31, -12); c.quadraticCurveTo(0, -19, -28, -13); c.closePath();
      }, { cor: this.cor.faixa, borda: true }, { elev: 1.6, bordaL: 2.4 });
      // barba por fazer
      ctx.save();
      ctx.fillStyle = 'rgba(40,20,14,0.28)';
      for (let i = 0; i < 26; i++) {
        const a = U.hash(i * 3 + 11), b = U.hash(i * 5 + 7);
        U.circulo(ctx, -8 + a * 36, 18 + b * 12, 0.9);
        ctx.fill();
      }
      ctx.restore();
    },
    cabecaFrente(ctx) {
      // nariz com um esparadrapo
      Estilo.forma(ctx, (c) => U.elipse(c, 14, 8.5, 6.5, 5), { cor: U.escurece(this.cor.pele, 0.08), luz: false }, { elev: 1.2, linha: 2, cel: false });
      ctx.save();
      ctx.translate(13, 5.5);
      ctx.rotate(-0.55);
      Estilo.forma(ctx, (c) => U.retRed(c, -7, -2.2, 14, 4.4, 1.2), { cor: '#f6e7c8' }, { elev: 1, linha: 1.4, cel: false });
      ctx.fillStyle = 'rgba(150,110,70,0.5)';
      for (const dx of [-4, 0, 4]) { U.circulo(ctx, dx, 0, 0.7); ctx.fill(); }
      ctx.restore();
      coroa(ctx, 6, -31, 24, 17, -0.28);
    },
  },

  // ---------------------------------------------------------------------------
  fiapo: {
    id: 'fiapo', nome: 'Fiapo', papel: 'o levinho da corda',
    frase: 'Leva a corda e amarra na tachinha. Corre, pula alto, voa longe.',
    exprBase: 'neutro',
    p: {
      tronco: 42, pescoco: 36, raioCabeca: 25,
      ombro: { E: [-6, 5], D: [7, 5] }, quadril: { E: [-5, -2], D: [5, -2] },
      braco: 27, antebraco: 26, coxa: 28, canela: 28, sola: 8,
    },
    cor: { pele: '#f2c29b', peleSombra: '#dca47d', cabelo: '#e8672a', camisa: '#23a386', bermuda: '#c9a063', tenis: '#f7f3ea' },
    rosto: {
      olhos: [{ x: 1, y: -4, r: 9, alto: 1.15 }, { x: 19, y: -4, r: 9.8, alto: 1.15 }],
      sobr: { dy: 5, w: 12, h: 3.6 },
      boca: { x: 11, y: 16, w: 19 },
      bochechas: [{ x: -4, y: 9, r: 5 }, { x: 24, y: 9, r: 5 }],
      suor: { x: -13, y: -14 },
      ruborBase: 0.25,
    },
    bracoSup(ctx, len, lado) { membro(ctx, len, 11, 9, lado === 'E' ? U.escurece(this.cor.camisa, 0.15) : this.cor.camisa); },
    antebraco(ctx, len, lado) { membro(ctx, len, 8, 7, lado === 'E' ? this.cor.peleSombra : this.cor.pele); },
    mao(ctx, lado) {
      Estilo.forma(ctx, (c) => U.elipse(c, 0, 5, 6, 7), { cor: lado === 'E' ? this.cor.peleSombra : this.cor.pele, borda: true }, { elev: 1.8 });
    },
    coxa(ctx, len, lado) { membro(ctx, len, 13, 12, lado === 'E' ? U.escurece(this.cor.bermuda, 0.12) : this.cor.bermuda); },
    canela(ctx, len, lado) {
      membro(ctx, len, 8, 7, lado === 'E' ? this.cor.peleSombra : this.cor.pele);
      // meião listrado
      Estilo.forma(ctx, (c) => U.retRed(c, -5, len * 0.45, 10, len * 0.6, 3), { cor: '#fbf6ea', borda: true }, { elev: 1.4 });
      for (let i = 0; i < 3; i++) {
        Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(-5, len * 0.5 + i * 5.2, 10, 2.6); }, { cor: '#e0443a', luz: false }, { elev: 0, linha: 0, cel: false });
      }
    },
    pe(ctx, lado) { // tênis enorme
      const cor = lado === 'E' ? '#dcd6c8' : this.cor.tenis;
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-9, -12);
        c.bezierCurveTo(-2, -15, 6, -8, 16, -7);
        c.bezierCurveTo(30, -6, 31, 2, 27, 3);
        c.lineTo(-10, 3);
        c.quadraticCurveTo(-13, -6, -9, -12);
        c.closePath();
      }, { cor, borda: true }, { elev: 2.2 });
      Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(-2, -6); c.quadraticCurveTo(8, -3, 18, -4); c.lineTo(18, 0); c.quadraticCurveTo(8, 1, -3, -2); c.closePath(); },
        { cor: '#f08a24', luz: false }, { elev: 0.6, linha: 0, cel: false });
      Estilo.forma(ctx, (c) => U.retRed(c, -11, 0, 40, 5, 2.5), { cor: '#3d3a4a', luz: false }, { elev: 0.8, linha: 2, cel: false });
    },
    torso(ctx, st) {
      const L = this.p.tronco;
      // rolo de barbante nas costas (some quando a corda está em uso)
      if (!st.semRolo) rolo(ctx, -4, -L * 0.5, 17, 22, 0.35);
      Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(-10, -4); c.lineTo(10, -4); c.lineTo(12, 10); c.lineTo(-12, 10); c.closePath(); },
        { cor: this.cor.bermuda, borda: true }, { elev: 2 });
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-10, 2);
        c.lineTo(-13, -L + 4);
        c.quadraticCurveTo(-12, -L - 4, 0, -L - 4);
        c.quadraticCurveTo(13, -L - 4, 13, -L + 4);
        c.lineTo(11, 2);
        c.quadraticCurveTo(0, 5, -10, 2);
        c.closePath();
      }, { cor: this.cor.camisa, borda: true }, { elev: 2.4 });
      // raio na camiseta
      Estilo.forma(ctx, (c) => {
        c.beginPath(); c.moveTo(3, -L + 10); c.lineTo(-4, -L + 22); c.lineTo(1, -L + 22); c.lineTo(-3, -L + 32); c.lineTo(6, -L + 18);
        c.lineTo(1, -L + 18); c.closePath();
      }, { cor: '#f7d64a', luz: false }, { elev: 0.8, linha: 1.4, cel: false });
      // alça do rolo atravessando o peito
      if (!st.semRolo) {
        const alca = (c) => { c.beginPath(); c.moveTo(-11, -L + 2); c.quadraticCurveTo(0, -L * 0.5, 12, -6); };
        Estilo.traco(ctx, alca, '#c89a5b', 4.5, { elev: 1.2, contorno: true });
        ctx.save(); ctx.setLineDash([2.5, 3.5]);
        Estilo.traco(ctx, alca, '#8f6634', 1.8, { elev: 0 });
        ctx.restore();
      }
      // mosquetão no cinto (onde a corda amarra)
      Estilo.forma(ctx, (c) => U.retRed(c, -12, -3, 24, 5, 2), { cor: '#5b4a3c', luz: false }, { elev: 1, linha: 1.6, cel: false });
      Estilo.traco(ctx, (c) => U.elipse(c, 8, 4, 3.5, 5), '#9aa3ad', 2.2, { elev: 1, contorno: true });
      // coroa grande demais: virou colar
      coroa(ctx, 0, -L + 3, 34, 14, 0.08);
    },
    cabecaBase(ctx) {
      // orelha de abano
      Estilo.forma(ctx, (c) => U.elipse(c, -21, 2, 8, 11, -0.2), { cor: this.cor.pele, borda: true }, { elev: 2 });
      Estilo.traco(ctx, (c) => { c.beginPath(); c.arc(-21, 2, 4.5, -1.2, 1.8); }, this.cor.peleSombra, 2, { elev: 0 });
      // cabeça de ovo
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(0, -31);
        c.bezierCurveTo(19, -31, 29, -14, 28, 4);
        c.bezierCurveTo(27, 22, 16, 30, 6, 30);
        c.bezierCurveTo(-10, 30, -21, 20, -21, 2);
        c.bezierCurveTo(-21, -16, -14, -31, 0, -31);
        c.closePath();
      }, { cor: this.cor.pele, borda: true }, { elev: 2.4 });
      // sardas
      ctx.save();
      ctx.fillStyle = 'rgba(190,100,60,0.55)';
      for (const [x, y] of [[-6, 6], [-2, 9], [-8, 10], [21, 6], [25, 8], [22, 11]]) { U.circulo(ctx, x, y, 1.1); ctx.fill(); }
      ctx.restore();
    },
    cabecaMeio(ctx, st) {
      // cabelo espetado (balança)
      ctx.save();
      ctx.rotate(Math.sin(st.t * 4) * 0.05 + (st.vento || 0) * 0.5);
      Estilo.carimbo(ctx, 'fiapo:cabelo', [-30, -47, 27, -4], (g) => {
        Estilo.forma(g, (c) => {
          c.beginPath();
          c.moveTo(-20, -8);
          c.lineTo(-27, -16); c.lineTo(-18, -18);
          c.lineTo(-24, -30); c.lineTo(-10, -26);
          c.lineTo(-10, -42); c.lineTo(1, -30);
          c.lineTo(8, -44); c.lineTo(12, -30);
          c.lineTo(24, -36); c.lineTo(22, -24);
          c.quadraticCurveTo(14, -30, 2, -26);
          c.quadraticCurveTo(-12, -24, -16, -6);
          c.closePath();
        }, { cor: this.cor.cabelo, borda: true }, { elev: 2 });
      }, 2);
      ctx.restore();
    },
    cabecaFrente(ctx) {
      // narizinho
      Estilo.forma(ctx, (c) => U.elipse(c, 12, 7, 4, 3.2), { cor: this.cor.peleSombra, luz: false }, { elev: 1, linha: 1.8, cel: false });
    },
  },

  // ---------------------------------------------------------------------------
  pudim: {
    id: 'pudim', nome: 'Pudim', papel: 'o gordão',
    frase: 'É ponto de fixação que anda. Aperta botão pesado, barriga de cama elástica.',
    exprBase: 'segurando',
    p: {
      tronco: 54, pescoco: 19, raioCabeca: 30,
      ombro: { E: [-24, 16], D: [27, 16] }, quadril: { E: [-15, -4], D: [15, -4] },
      braco: 21, antebraco: 19, coxa: 15, canela: 15, sola: 7,
    },
    cor: { pele: '#e9a77f', peleSombra: '#cf8a63', camisa: '#f4c542', calca: '#35467a', suspensorio: '#d64a3a', sapato: '#6b4a33' },
    rosto: {
      olhos: [{ x: 3, y: -2, r: 6 }, { x: 19, y: -2, r: 6.4 }],
      sobr: { dy: 5, w: 11, h: 3.8 },
      boca: { x: 12, y: 14, w: 17 },
      bochechas: [{ x: -5, y: 9, r: 8 }, { x: 27, y: 8, r: 8 }],
      suor: { x: -16, y: -16 },
      ruborBase: 0.35,
    },
    bracoSup(ctx, len, lado) { membro(ctx, len, 18, 16, lado === 'E' ? U.escurece(this.cor.camisa, 0.14) : this.cor.camisa); },
    antebraco(ctx, len, lado) { membro(ctx, len, 15, 13, lado === 'E' ? this.cor.peleSombra : this.cor.pele); },
    mao(ctx, lado) {
      Estilo.forma(ctx, (c) => U.elipse(c, 0, 6, 8.5, 9), { cor: lado === 'E' ? this.cor.peleSombra : this.cor.pele, borda: true }, { elev: 2 });
    },
    coxa(ctx, len, lado) { membro(ctx, len, 21, 19, lado === 'E' ? U.escurece(this.cor.calca, 0.15) : this.cor.calca); },
    canela(ctx, len, lado) { membro(ctx, len, 19, 17, lado === 'E' ? U.escurece(this.cor.calca, 0.15) : this.cor.calca); },
    pe(ctx, lado) {
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-11, 0); c.lineTo(-11, -7); c.quadraticCurveTo(-8, -14, 4, -12); c.quadraticCurveTo(20, -10, 20, -2); c.lineTo(20, 0); c.closePath();
      }, { cor: lado === 'E' ? U.escurece(this.cor.sapato, 0.15) : this.cor.sapato, borda: true }, { elev: 2 });
    },
    torso(ctx, st) {
      const L = this.p.tronco;
      const jig = st.jiggle || 0;
      const barriga = (c) => U.elipse(c, 2, -L * 0.48, 49 + jig, 45 - jig * 0.5);
      Estilo.forma(ctx, barriga, { cor: this.cor.pele, borda: true }, { elev: 2.8, celK: 6 });
      ctx.save();
      barriga(ctx);
      ctx.clip();
      // calça
      Estilo.forma(ctx, (c) => { c.beginPath(); c.rect(-60, -8, 130, 40); }, { cor: this.cor.calca }, { elev: 1.5, linha: 0, cel: false });
      // camisa curta demais
      Estilo.forma(ctx, (c) => {
        c.beginPath();
        c.moveTo(-60, -L - 30);
        c.lineTo(70, -L - 30);
        c.lineTo(70, -22);
        for (let x = 60; x >= -60; x -= 10) c.quadraticCurveTo(x - 5, -18 + ((x / 10) % 2 ? 3 : -3), x - 10, -21);
        c.closePath();
      }, { cor: this.cor.camisa }, { elev: 2, linha: 0, cel: false });
      // umbigo
      Estilo.traco(ctx, (c) => { c.beginPath(); c.arc(8, -14, 2.6, 0.3, Math.PI * 1.7); }, this.cor.peleSombra, 2, { elev: 0 });
      ctx.restore();
      if (Estilo.atual === 'cartoon') {
        ctx.save(); barriga(ctx); ctx.lineWidth = 3; ctx.strokeStyle = Estilo.TINTA; ctx.stroke(); ctx.restore();
      }
      // suspensórios
      for (const [x0, x1] of [[-22, -16], [26, 22]]) {
        Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(x0, -L - 6); c.quadraticCurveTo((x0 + x1) / 2 + 3, -L * 0.5, x1, -6); }, this.cor.suspensorio, 6, { elev: 1.4, contorno: true });
        Estilo.forma(ctx, (c) => U.circulo(c, x1, -6, 3.2), { cor: '#f4e1a0', textura: 'nada' }, { elev: 1, linha: 1.4, cel: false });
      }
      // corda amarrada na barriga (quando é âncora)
      if (st.amarrado) {
        Estilo.traco(ctx, (c) => { c.beginPath(); c.ellipse(2, -16, 50, 7, 0, 0.05, Math.PI - 0.05); }, '#c89a5b', 5, { elev: 1.4, contorno: true });
        ctx.save(); ctx.setLineDash([2.5, 3.5]);
        Estilo.traco(ctx, (c) => { c.beginPath(); c.ellipse(2, -16, 50, 7, 0, 0.05, Math.PI - 0.05); }, '#8f6634', 2, { elev: 0 });
        ctx.restore();
        Estilo.forma(ctx, (c) => U.elipse(c, 40, -12, 6, 5), { cor: '#c89a5b', textura: 'papelao' }, { elev: 1.4, linha: 2, cel: false });
      }
    },
    cabecaBase(ctx) {
      // queixo duplo
      Estilo.forma(ctx, (c) => U.elipse(c, 7, 24, 22, 11), { cor: this.cor.peleSombra, borda: true }, { elev: 2 });
      Estilo.forma(ctx, (c) => U.circulo(c, 4, 0, 30), { cor: this.cor.pele, borda: true }, { elev: 2.4 });
      // orelhinha
      Estilo.forma(ctx, (c) => U.elipse(c, -24, 3, 6, 8), { cor: this.cor.peleSombra, borda: true }, { elev: 1.4 });
      // cachinho de cabelo
      Estilo.traco(ctx, (c) => {
        c.beginPath();
        for (let a = 0; a < 4 * Math.PI; a += 0.25) {
          const r = 1 + a * 0.75;
          const x = 2 + Math.cos(a) * r, y = -33 - a * 0.5 + Math.sin(a) * r;
          a === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
      }, '#4a2e22', 2.6, { elev: 1.2 });
    },
    cabecaFrente(ctx) {
      // nariz de batata
      Estilo.forma(ctx, (c) => U.elipse(c, 14, 6, 6, 4.8), { cor: this.cor.peleSombra, luz: false }, { elev: 1.2, linha: 1.8, cel: false });
      // coroinha de festa com elástico
      Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(-10, -25); c.quadraticCurveTo(-24, -4, -17, 16); c.quadraticCurveTo(-12, 28, 2, 33); }, 'rgba(250,250,250,0.9)', 1.3, { elev: 0.6 });
      coroa(ctx, -3, -26, 18, 13, -0.35);
    },
  },
};
