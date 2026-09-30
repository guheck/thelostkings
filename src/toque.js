'use strict';

// Controles de toque (celular e tablet): botões desenhados no próprio canvas, vários dedos ao mesmo tempo.
// Aparecem quando alguém toca na tela e somem quando usa o teclado; no computador nada muda.
// Tocar no rosto de um personagem (no alto, à esquerda) escolhe ele. ?toque na URL força os botões (para screenshot).
const Toque = {
  ativo: false,
  dedos: new Map(),      // toque -> botão que ele está apertando (ou { menu: true } quando é um toque no menu)
  apertadas: new Set(),  // teclas que os dedos estão segurando agora
  // cruz de setas: a direção sai do ângulo do dedo em volta do centro (as de lado pegam uma faixa maior,
  // para quem está andando não pular ou subir escada sem querer)
  CRUZ: { x: 178, y: 562, s: 96, alcance: 200, morto: 20 },
  BOTOES: [
    { id: 'pulo', tecla: 'pulo', tipo: 'redondo', x: 1166, y: 604, r: 72, txt: 'PULA' },
    { id: 'acao', tecla: 'acao', tipo: 'redondo', x: 1010, y: 636, r: 62, txt: 'E' },
    { id: 'troca', tecla: 'troca', tipo: 'redondo', x: 1186, y: 452, r: 44, txt: 'TROCA' },
    { id: 'tela', tipo: 'topo', x: 1016, y: 14, w: 84, h: 50, txt: 'TELA' },
    { id: 'mapa', tecla: 'mapa', tipo: 'topo', x: 1110, y: 14, w: 84, h: 50, txt: 'MAPA' },
    { id: 'menu', tecla: 'menu', tipo: 'topo', x: 1204, y: 14, w: 62, h: 50, txt: '≡' },
  ],
  HAB: { marreta: 'soco', fiapo: 'corda', pudim: 'bundada' },

  init(J) {
    const cv = J.cv;
    const pos = (t) => { const r = cv.getBoundingClientRect(); return { x: (t.clientX - r.left) / r.width * J.W, y: (t.clientY - r.top) / r.height * J.H }; };
    const inicio = (e) => {
      e.preventDefault();
      this.ativo = true;
      for (const t of e.changedTouches) {
        const p = pos(t);
        if (J.modo === 'menu') { this.dedos.set(t.identifier, { menu: true }); continue; }
        const i = this.cartao(p);
        if (i != null) { J.bordas[`s${i + 1}`] = true; continue; }
        const b = this._botaoEm(p, J);
        if (b) this.dedos.set(t.identifier, b);
      }
      this._aplica(J);
    };
    const move = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const d = this.dedos.get(t.identifier);
        if (!d || d.menu || d.id === 'tela') continue;
        const b = this._botaoEm(pos(t), J); // escorregar o dedo de uma seta para outra troca a direção
        if (b) this.dedos.set(t.identifier, b); else this.dedos.delete(t.identifier);
      }
      this._aplica(J);
    };
    const fim = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const d = this.dedos.get(t.identifier);
        this.dedos.delete(t.identifier);
        if (!d || e.type !== 'touchend') continue;
        if (d.menu && J.modo === 'menu') Menu.mouse(pos(t), J, true);
        if (d.id === 'tela') this._telaCheia();
      }
      this._aplica(J);
    };
    cv.addEventListener('touchstart', inicio, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    cv.addEventListener('touchend', fim, { passive: false });
    cv.addEventListener('touchcancel', fim, { passive: false });
    window.addEventListener('keydown', () => { this.ativo = false; });
    if (U.params().has('toque')) this.ativo = true;
  },

  // Dedos -> teclas (as mesmas do teclado: segurar = teclas, apertar agora = bordas)
  _aplica(J) {
    const agora = new Set();
    for (const d of this.dedos.values()) if (d.tecla) agora.add(d.tecla);
    for (const k of agora) if (!this.apertadas.has(k)) { if (!J.teclas[k]) J.bordas[k] = true; J.teclas[k] = true; }
    for (const k of this.apertadas) if (!agora.has(k)) J.teclas[k] = false;
    this.apertadas = agora;
  },

  // Rosto do personagem no HUD (i = 0, 1, 2) debaixo do ponto
  cartao(p) {
    for (let i = 0; i < 3; i++) if (p.x >= 14 + i * 182 && p.x <= 186 + i * 182 && p.y >= 4 && p.y <= 84) return i;
    return null;
  },

  _botaoEm(p, J) {
    const C = this.CRUZ, dx = p.x - C.x, dy = p.y - C.y, dist = Math.hypot(dx, dy);
    if (!J.mapa && dist < C.alcance) {
      if (dist < C.morto) return null;
      const a = Math.atan2(dy, dx) * 180 / Math.PI; // 0 = direita, 90 = baixo
      const id = Math.abs(a) <= 55 ? 'dir' : Math.abs(a) >= 125 ? 'esq' : a > 0 ? 'baixo' : 'cima';
      return { id, tecla: id };
    }
    let melhor = null, md = 1;
    for (const b of this.BOTOES) {
      if (b.tipo === 'topo') {
        if (this._visivel(b) && p.x >= b.x - 8 && p.x <= b.x + b.w + 8 && p.y >= b.y - 8 && p.y <= b.y + b.h + 12) return b;
      } else if (!J.mapa) {
        const d = Math.hypot(p.x - b.x, p.y - b.y) / (b.r + 18);
        if (d < md) { md = d; melhor = b; }
      }
    }
    return melhor;
  },

  _visivel(b) {
    if (b.id !== 'tela') return true;
    const pode = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    return !!pode && !(document.fullscreenElement || document.webkitFullscreenElement);
  },

  // Tela cheia (e deitada, onde o navegador deixa)
  _telaCheia() {
    const el = document.documentElement, pede = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!pede) return;
    Promise.resolve(pede.call(el))
      .then(() => screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null)
      .catch(() => {});
  },

  // ---------------------------------------------------------------------------
  desenha(ctx, J) {
    if (!this.ativo || J.modo !== 'jogo') return;
    const ap = this.apertadas;
    ctx.save();
    ctx.lineJoin = 'round';
    if (!J.mapa) {
      const C = this.CRUZ, s = C.s;
      for (const [id, dx, dy, rot] of [['esq', -1, 0, Math.PI], ['dir', 1, 0, 0], ['cima', 0, -1, -Math.PI / 2], ['baixo', 0, 1, Math.PI / 2]]) {
        const x = C.x + dx * s - s / 2 + dx * 4, y = C.y + dy * s - s / 2 + dy * 4, on = ap.has(id);
        this._fundo(ctx, on, () => { ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); });
        ctx.save();
        ctx.translate(x + s / 2, y + s / 2);
        ctx.rotate(rot);
        ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-12, -24); ctx.lineTo(-12, 24); ctx.closePath();
        ctx.fillStyle = on ? '#2b1f2e' : 'rgba(43,31,46,0.75)';
        ctx.fill();
        ctx.restore();
      }
    }
    for (const b of this.BOTOES) {
      if (b.tipo === 'redondo' && J.mapa) continue;
      if (b.tipo === 'topo' && !this._visivel(b)) continue;
      const on = b.tecla ? ap.has(b.tecla) : [...this.dedos.values()].includes(b);
      if (b.tipo === 'redondo') this._fundo(ctx, on, () => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, U.TAU); });
      else this._fundo(ctx, on, () => { ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); });
      const cx = b.tipo === 'redondo' ? b.x : b.x + b.w / 2, cy = b.tipo === 'redondo' ? b.y : b.y + b.h / 2;
      ctx.fillStyle = '#2b1f2e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (b.id === 'acao') {
        ctx.font = `44px ${FONTE_TITULO}`;
        ctx.fillText('E', cx, cy - 8);
        ctx.font = `18px ${FONTE_FALA}`;
        const h = J.m.heroi;
        // Marreta: com a seta ↓ apertada o E vira gancho; Pudim: rola / levanta / bundada
        const hab = h.id === 'marreta' ? (ap.has('baixo') ? 'gancho' : 'soco')
          : h.id !== 'pudim' ? this.HAB[h.id] : !h.noChao ? 'bundada' : h.estado === 'rolando' ? 'levanta' : 'rola';
        ctx.fillText(hab, cx, cy + 26);
      } else {
        ctx.font = `${b.id === 'menu' ? 34 : b.id === 'pulo' ? 30 : 20}px ${FONTE_TITULO}`;
        ctx.fillText(b.txt, cx, cy + 2);
      }
    }
    ctx.restore();
  },

  _fundo(ctx, on, caminho) {
    caminho();
    ctx.fillStyle = on ? 'rgba(255,228,131,0.9)' : 'rgba(255,253,246,0.55)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = on ? '#2b1f2e' : 'rgba(43,31,46,0.6)';
    ctx.stroke();
  },
};
