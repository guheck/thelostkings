'use strict';

// Estilo visual: toda forma do jogo passa por Estilo.forma(), que decide como ela vira "papel" ou "cartoon".
const Estilo = {
  atual: 'cartoon',        // 'cartoon' (escolhido) | 'papel' (só para comparar)
  TINTA: '#2b1f2e',        // contorno do estilo cartoon
  BORDA: '#fbf6ea',        // borda branca do recorte de papel
  SOMBRA: 'rgba(52,30,24,0.32)',
  texturas: {},
  _padroes: new WeakMap(),
  _sprites: new Map(),
  _semSombra: false,   // ligado enquanto desenha a silhueta de um carimbo

  init() {
    this.texturas.papel = this._textura(256, 7000, 260, [120, 110, 100], 0.05);
    this.texturas.papelao = this._textura(256, 9000, 420, [110, 80, 50], 0.09);
  },

  // Textura repetível de fibras de papel (multiplicada por cima da cor)
  _textura(n, pontos, fibras, rgb, forca) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    const r = U.rng(n * 7 + pontos);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, n, n);
    const [R, G, B] = rgb;
    for (let i = 0; i < 26; i++) { // manchas grandes e suaves
      const x = r() * n, y = r() * n, rad = 20 + r() * 50;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(${R},${G},${B},${forca * 0.5})`);
      grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
        g.save(); g.translate(ox, oy); g.fillStyle = grad; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore();
      }
    }
    for (let i = 0; i < pontos; i++) { // pontinhos
      g.fillStyle = `rgba(${R},${G},${B},${(0.04 + r() * 0.1).toFixed(3)})`;
      g.fillRect(r() * n, r() * n, 1 + r() * 1.2, 1 + r() * 1.2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < fibras; i++) { // fibras curtas
      const x = r() * n, y = r() * n, a = r() * U.TAU, L = 3 + r() * 12, cv = (r() - 0.5) * 6;
      const claro = r() < 0.35;
      g.strokeStyle = claro ? 'rgba(255,255,255,0.7)' : `rgba(${R},${G},${B},${(0.05 + r() * 0.1).toFixed(3)})`;
      g.lineWidth = 0.5 + r() * 0.8;
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + Math.cos(a) * L / 2 - Math.sin(a) * cv, y + oy + Math.sin(a) * L / 2 + Math.cos(a) * cv,
          x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
        g.stroke();
      }
    }
    return c;
  },

  padrao(ctx, nome) {
    let m = this._padroes.get(ctx);
    if (!m) { m = {}; this._padroes.set(ctx, m); }
    if (!m[nome]) m[nome] = ctx.createPattern(this.texturas[nome], 'repeat');
    return m[nome];
  },

  // escala efetiva do contexto (sombras do canvas ignoram a transformação)
  escala(ctx) {
    const m = ctx.getTransform();
    return Math.hypot(m.a, m.b);
  },

  // Carimbo: no estilo papel, a peça é desenhada uma vez num canvas (com as sombras internas) e depois só colada.
  // A sombra de fora vira um borrão da silhueta, colado deslocado sempre para baixo/direita da tela.
  // caixa = [x0, y0, x1, y1] no referencial da peça (precisa conter o desenho todo).
  carimbo(ctx, chave, caixa, desenhar, elev = 2.2) {
    if (this.atual !== 'papel') { desenhar(ctx); return; }
    const m = ctx.getTransform();
    const esc = Math.hypot(m.a, m.b);
    const s = Math.ceil(esc * 4) / 4;
    const k = chave + '@' + s;
    let sp = this._sprites.get(k);
    if (!sp) { sp = this._criaSprite(caixa, s, desenhar, elev); this._sprites.set(k, sp); }
    if (elev > 0) {
      const det = m.a * m.d - m.b * m.c;
      const dx = elev * 0.45 * esc, dy = elev * 0.85 * esc;
      const lx = (m.d * dx - m.c * dy) / det, ly = (-m.b * dx + m.a * dy) / det;
      ctx.drawImage(sp.sombra, sp.x + lx, sp.y + ly, sp.w, sp.h);
    }
    ctx.drawImage(sp.cor, sp.x, sp.y, sp.w, sp.h);
  },

  _criaSprite(caixa, s, desenhar, elev) {
    const pad = 6 + elev * 3;
    const x0 = caixa[0] - pad, y0 = caixa[1] - pad, x1 = caixa[2] + pad, y1 = caixa[3] + pad;
    const w = Math.max(1, Math.ceil((x1 - x0) * s)), h = Math.max(1, Math.ceil((y1 - y0) * s));
    const novo = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
      return [c, g];
    };
    const [cor, gc] = novo();
    desenhar(gc);
    const [sil, gs] = novo();
    this._semSombra = true;
    try { desenhar(gs); } finally { this._semSombra = false; }
    // tira a sombra que vazou para fora da silhueta
    gc.setTransform(1, 0, 0, 1, 0, 0);
    gc.globalCompositeOperation = 'destination-in';
    gc.drawImage(sil, 0, 0);
    gc.globalCompositeOperation = 'source-over';
    const sombra = document.createElement('canvas');
    sombra.width = w; sombra.height = h;
    if (elev > 0) {
      const gb = sombra.getContext('2d');
      gb.shadowColor = this.SOMBRA;
      gb.shadowBlur = elev * 1.7 * s;
      gb.shadowOffsetX = w + 40;
      gb.drawImage(sil, -w - 40, 0);
    }
    return { cor, sombra, x: x0, y: y0, w: w / s, h: h / s };
  },

  // Desenha uma forma. caminho(ctx) monta o path; mat = { cor, textura, borda, sombra, luz }; op = { elev, linha, cel, bordaL }
  forma(ctx, caminho, mat, op = {}) {
    if (this.atual === 'cartoon') return this._formaCartoon(ctx, caminho, mat, op);
    return this._formaPapel(ctx, caminho, mat, op);
  },

  _formaPapel(ctx, caminho, mat, op) {
    const elev = this._semSombra ? 0 : op.elev ?? 2;
    const s = this.escala(ctx);
    ctx.save();
    caminho(ctx);
    if (elev > 0) {
      ctx.shadowColor = this.SOMBRA;
      ctx.shadowBlur = elev * 1.7 * s;
      ctx.shadowOffsetX = elev * 0.45 * s;
      ctx.shadowOffsetY = elev * 0.85 * s;
    }
    if (mat.borda) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = op.bordaL ?? 3.4;
      ctx.strokeStyle = this.BORDA;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = mat.cor;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    const tex = mat.textura ?? 'papel';
    if (tex !== 'nada' || mat.luz !== false) {
      ctx.clip();
      if (tex !== 'nada') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = op.texForca ?? 0.8;
        ctx.fillStyle = this.padrao(ctx, tex);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      if (mat.luz !== false) { // quina do papel pegando luz
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  _formaCartoon(ctx, caminho, mat, op) {
    const k = op.celK ?? 4;
    ctx.save();
    caminho(ctx);
    ctx.fillStyle = mat.cor;
    ctx.fill();
    if (op.cel !== false) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = mat.sombra || U.escurece(mat.cor, 0.22);
      ctx.fill();
      ctx.translate(-k * 0.55, -k);
      caminho(ctx);
      ctx.fillStyle = mat.cor;
      ctx.fill();
      ctx.restore();
      ctx.save();
      caminho(ctx);
      ctx.clip();
      ctx.translate(k * 0.35, k * 0.5);
      caminho(ctx);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
      ctx.restore();
      caminho(ctx);
    }
    if ((op.linha ?? 3) > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = op.linha ?? 3;
      ctx.strokeStyle = this.TINTA;
      ctx.stroke();
    }
    ctx.restore();
  },

  // Traço (fio, sobrancelha fina, boca em linha): no papel vira tira recortada com sombra
  traco(ctx, caminho, cor, largura, op = {}) {
    const s = this.escala(ctx);
    ctx.save();
    caminho(ctx);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (this.atual === 'papel' && !this._semSombra && (op.elev ?? 1) > 0) {
      const elev = op.elev ?? 1;
      ctx.shadowColor = this.SOMBRA;
      ctx.shadowBlur = elev * 1.5 * s;
      ctx.shadowOffsetX = elev * 0.45 * s;
      ctx.shadowOffsetY = elev * 0.85 * s;
    }
    if (this.atual === 'cartoon' && op.contorno) {
      ctx.lineWidth = largura + 3;
      ctx.strokeStyle = this.TINTA;
      ctx.stroke();
    }
    ctx.lineWidth = largura;
    ctx.strokeStyle = cor;
    ctx.stroke();
    ctx.restore();
  },

  // Colchete bailarina (junta dos bonecos de papel)
  colchete(ctx, x, y, r = 3.4) {
    if (this.atual !== 'papel') return;
    ctx.save();
    ctx.translate(x, y);
    this.carimbo(ctx, 'colchete' + r.toFixed(2), [-r, -r, r, r], (c) => {
      const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#fff6c8');
      g.addColorStop(0.45, '#e2b64a');
      g.addColorStop(1, '#9a6b1c');
      c.fillStyle = g;
      U.circulo(c, 0, 0, r);
      c.fill();
    }, 0.9);
    ctx.restore();
  },

  // Texto de efeito (POW!, rótulos): letras recortadas com borda branca
  texto(ctx, str, x, y, op = {}) {
    const tam = op.tam ?? 40;
    const s = this.escala(ctx);
    ctx.save();
    ctx.translate(x, y);
    if (op.rot) ctx.rotate(op.rot);
    ctx.font = `${op.peso ?? ''} ${tam}px ${op.fonte ?? '"Luckiest Guy", "Arial Black", sans-serif'}`;
    ctx.textAlign = op.alinha ?? 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const papel = this.atual === 'papel';
    if (papel) {
      ctx.shadowColor = this.SOMBRA;
      ctx.shadowBlur = 4 * s;
      ctx.shadowOffsetX = 1.5 * s;
      ctx.shadowOffsetY = 2.5 * s;
    }
    ctx.lineWidth = op.borda ?? tam * 0.22;
    ctx.strokeStyle = op.corBorda ?? (papel ? this.BORDA : this.TINTA);
    ctx.strokeText(str, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = op.cor ?? '#2b1f2e';
    ctx.fillText(str, 0, 0);
    ctx.restore();
  },
};
