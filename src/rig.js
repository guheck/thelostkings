'use strict';

// Esqueleto dos bonecos: pose por ângulos (animação) ou por física (corpo mole), e a corda.
// Convenção: ângulos de membro medidos a partir de "para baixo", positivo = para a frente.
// Tronco: positivo = inclina para a frente. Pontos locais: origem na pelve, personagem olhando para a direita.
const NOMES_PONTOS = ['pelve', 'peito', 'cabeca', 'ombroE', 'cotoveloE', 'maoE', 'ombroD', 'cotoveloD', 'maoD',
  'quadrilE', 'joelhoE', 'peE', 'quadrilD', 'joelhoD', 'peD'];

const POSE_BASE = {
  tronco: 0, cabeca: 0, escalaY: 1,
  bracoE: 0.15, cotoveloE: 0.2, bracoD: -0.1, cotoveloD: 0.25,
  pernaE: -0.08, joelhoE: 0, pernaD: 0.1, joelhoD: 0,
};

const Rig = {
  pose(extra) { return Object.assign({}, POSE_BASE, extra); },

  // mistura duas poses (ângulos)
  misturaPose(a, b, t) {
    const r = {};
    for (const k in POSE_BASE) r[k] = U.lerp(a[k] ?? POSE_BASE[k], b[k] ?? POSE_BASE[k], t);
    return r;
  },

  // Pontos locais a partir dos ângulos
  fk(p, pose) {
    const P = {};
    const tr = pose.tronco, sy = pose.escalaY ?? 1;
    const up = { x: Math.sin(tr), y: -Math.cos(tr) };
    const fr = { x: Math.cos(tr), y: Math.sin(tr) };
    const membro = (a) => ({ x: Math.sin(a), y: Math.cos(a) });
    const noTronco = (o, x, y) => ({ x: o.x + fr.x * x - up.x * y, y: o.y + fr.y * x - up.y * y });
    P.pelve = { x: 0, y: 0 };
    P.peito = { x: up.x * p.tronco * sy, y: up.y * p.tronco * sy };
    const ac = tr + pose.cabeca;
    P.cabeca = { x: P.peito.x + Math.sin(ac) * p.pescoco, y: P.peito.y - Math.cos(ac) * p.pescoco };
    for (const l of ['E', 'D']) {
      const o = noTronco(P.peito, p.ombro[l][0], p.ombro[l][1]);
      const a1 = pose['braco' + l] - tr, a2 = a1 + pose['cotovelo' + l];
      const c = { x: o.x + membro(a1).x * p.braco, y: o.y + membro(a1).y * p.braco };
      P['ombro' + l] = o;
      P['cotovelo' + l] = c;
      P['mao' + l] = { x: c.x + membro(a2).x * p.antebraco, y: c.y + membro(a2).y * p.antebraco };
      const q = noTronco(P.pelve, p.quadril[l][0], p.quadril[l][1]);
      const b1 = pose['perna' + l], b2 = b1 + pose['joelho' + l];
      const j = { x: q.x + membro(b1).x * p.coxa, y: q.y + membro(b1).y * p.coxa };
      P['quadril' + l] = q;
      P['joelho' + l] = j;
      P['pe' + l] = { x: j.x + membro(b2).x * p.canela, y: j.y + membro(b2).y * p.canela };
    }
    return P;
  },

  // altura da pelve acima do pé mais baixo (para apoiar o boneco no chão)
  alturaPelve(p, pose) {
    const P = Rig.fk(p, pose);
    return Math.max(P.peE.y, P.peD.y) + p.sola;
  },

  mundo(P, x, y, f) {
    const r = {};
    for (const k in P) r[k] = { x: x + P[k].x * f, y: y + P[k].y };
    return r;
  },
  local(M, x, y, f) {
    const r = {};
    for (const k in M) r[k] = { x: (M[k].x - x) * f, y: M[k].y - y };
    return r;
  },
  misturaPontos(A, B, t) {
    const r = {};
    for (const k in A) r[k] = { x: U.lerp(A[k].x, B[k].x, t), y: U.lerp(A[k].y, B[k].y, t) };
    return r;
  },
};

// Chão: lista de retângulos sólidos { x, y, w, h }
function colideRetangulos(pt, raio, rets, atrito) {
  let tocou = false;
  for (const r of rets) {
    const x0 = r.x - raio, x1 = r.x + r.w + raio, y0 = r.y - raio, y1 = r.y + r.h + raio;
    if (pt.x <= x0 || pt.x >= x1 || pt.y <= y0 || pt.y >= y1) continue;
    const dTopo = pt.y - y0, dEsq = pt.x - x0, dDir = x1 - pt.x, dBase = y1 - pt.y;
    const m = Math.min(dTopo, dEsq, dDir, dBase);
    if (m === dTopo) {
      pt.y = y0;
      pt.px = pt.x - (pt.x - pt.px) * atrito; // atrito no chão
      tocou = true;
    } else if (m === dEsq) pt.x = x0;
    else if (m === dDir) pt.x = x1;
    else pt.y = y1;
  }
  return tocou;
}

// Corpo mole (verlet): pontos + vínculos de distância
class Boneco {
  constructor(p, M, vel = { x: 0, y: 0 }, giro = 0) {
    this.p = p;
    this.pts = {};
    const cx = M.pelve.x, cy = M.pelve.y;
    const dt = 1 / 240; // mesmo tamanho do subpasso de passo()
    for (const k of NOMES_PONTOS) {
      const q = M[k];
      const vx = vel.x - (q.y - cy) * giro, vy = vel.y + (q.x - cx) * giro;
      this.pts[k] = { x: q.x, y: q.y, px: q.x - vx * dt, py: q.y - vy * dt, r: k === 'cabeca' ? p.raioCabeca * 0.8 : 5 };
    }
    const pares = [
      ['pelve', 'peito'], ['peito', 'cabeca'], ['peito', 'ombroE'], ['peito', 'ombroD'], ['pelve', 'quadrilE'], ['pelve', 'quadrilD'],
      ['ombroE', 'cotoveloE'], ['cotoveloE', 'maoE'], ['ombroD', 'cotoveloD'], ['cotoveloD', 'maoD'],
      ['quadrilE', 'joelhoE'], ['joelhoE', 'peE'], ['quadrilD', 'joelhoD'], ['joelhoD', 'peD'],
      // travas para o tronco não amassar
      ['ombroE', 'pelve'], ['ombroD', 'pelve'], ['quadrilE', 'peito'], ['quadrilD', 'peito'],
      ['ombroE', 'ombroD'], ['quadrilE', 'quadrilD'], ['ombroE', 'quadrilD'], ['ombroD', 'quadrilE'],
    ];
    this.vinc = pares.map(([a, b]) => ({ a, b, L: U.dist(M[a].x, M[a].y, M[b].x, M[b].y) }));
    // a cabeça não dobra para dentro do corpo
    this.minimos = [{ a: 'cabeca', b: 'pelve', L: U.dist(M.cabeca.x, M.cabeca.y, M.pelve.x, M.pelve.y) * 0.85 }];
    this.noChao = false;
    this.parado = 0;
  }

  // pino (opcional): { x, y } onde a pelve fica presa — o corpo segue o caminho do jogo e só os membros balançam
  passo(dt, rets, g = 1500, pino = null) {
    const sub = 2, h = dt / sub;
    const P = this.pts.pelve;
    for (let s = 0; s < sub; s++) {
      for (const k in this.pts) {
        const q = this.pts[k];
        const vx = (q.x - q.px) * 0.998, vy = (q.y - q.py) * 0.998;
        q.px = q.x; q.py = q.y;
        q.x += vx;
        q.y += vy + g * h * h;
      }
      if (pino) {
        const a = (s + 1) / sub;
        P.x = U.lerp(P.px, pino.x, a); P.y = U.lerp(P.py, pino.y, a);
      }
      for (let it = 0; it < 8; it++) {
        for (const v of this.vinc) this._resolve(v, false);
        for (const v of this.minimos) this._resolve(v, true);
        if (pino) { P.x = U.lerp(P.px, pino.x, (s + 1) / sub); P.y = U.lerp(P.py, pino.y, (s + 1) / sub); }
        let tocou = false;
        for (const k in this.pts) if (colideRetangulos(this.pts[k], this.pts[k].r, rets, 0.55)) tocou = true;
        this.noChao = tocou;
      }
    }
    let vmax = 0;
    for (const k in this.pts) {
      const q = this.pts[k];
      vmax = Math.max(vmax, Math.hypot(q.x - q.px, q.y - q.py) / h);
    }
    this.parado = this.noChao && vmax < 25 ? this.parado + dt : 0;
  }

  _resolve(v, soMinimo) {
    const A = this.pts[v.a], B = this.pts[v.b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (soMinimo && d >= v.L) return;
    const k = ((d - v.L) / d) * 0.5;
    A.x += dx * k; A.y += dy * k;
    B.x -= dx * k; B.y -= dy * k;
  }

  mundo() {
    const r = {};
    for (const k in this.pts) r[k] = { x: this.pts[k].x, y: this.pts[k].y };
    return r;
  }
}

// Corda de barbante (verlet), com as duas pontas presas em algo
class Corda {
  constructor(ax, ay, bx, by, comprimento, n = 30) {
    this.n = n;
    this.comp = comprimento;
    this.pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = U.lerp(ax, bx, t), y = U.lerp(ay, by, t);
      this.pts.push({ x, y, px: x, py: y, r: 2.5 });
    }
  }
  prende(i, x, y) {
    const q = this.pts[i];
    q.x = x; q.y = y;
    q.fixo = true;
  }
  passo(dt, rets, g = 1500) {
    const L = this.comp / this.n;
    for (const q of this.pts) {
      if (q.fixo) { q.px = q.x; q.py = q.y; continue; }
      const vx = (q.x - q.px) * 0.985, vy = (q.y - q.py) * 0.985;
      q.px = q.x; q.py = q.y;
      q.x += vx;
      q.y += vy + g * dt * dt;
    }
    for (let it = 0; it < 30; it++) {
      for (let i = 0; i < this.n; i++) {
        const A = this.pts[i], B = this.pts[i + 1];
        const dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d <= L) continue; // barbante não empurra, só puxa
        const k = (d - L) / d;
        const wa = A.fixo ? 0 : B.fixo ? 1 : 0.5, wb = 1 - wa;
        if (A.fixo && B.fixo) continue;
        A.x += dx * k * wa; A.y += dy * k * wa;
        B.x -= dx * k * wb; B.y -= dy * k * wb;
      }
      for (const q of this.pts) if (!q.fixo) colideRetangulos(q, q.r, rets, 0.3);
    }
    for (const q of this.pts) q.fixo = false;
  }
}
