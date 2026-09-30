'use strict';

// A corda do Fiapo: estados, amarrar/desamarrar, linhas de jogo e o barbante desenhado.
// A inclinação decide o que a corda vira: até ~33° rampa/ponte (anda), até 60° tirolesa (escorrega), mais que isso escalada (↑).
const CORDA_MAX = 960; // 24 blocos (29/09: 640 o usuário achou curta; 1280, longa demais)
const PERTO_LARGA = 150; // largar a corda pendurada: só até essa distância da tachinha
const ANG_PONTE = 33 * Math.PI / 180, ANG_TIROLESA = 60 * Math.PI / 180;

class CordaJogo {
  constructor(nivel) {
    this.nivel = nivel;
    this.herois = [];            // preenchido pelo jogo
    this.estado = 'carregada';   // 'carregada' | 'presa1' (uma ponta presa, Fiapo leva a outra) | 'solta' | 'presa2'
    this.A = null;               // âncora: { pino } ou { heroi }
    this.B = null;
    this.pendurada = null;       // corda solta: { x, y0, y1, lado, beira }
    this.visual = null;          // barbante (verlet) quando está frouxo
  }

  // ponto de jogo da âncora (onde os pés andam) e ponto do nó (desenho)
  ponto(anc) {
    if (anc.pino) return { x: anc.pino.x, y: anc.pino.y - 6 };
    // no Pudim a corda sai da barriga pelo lado de onde vem a outra ponta
    const h = anc.heroi;
    const outra = this.A && this.A.heroi === h ? this.B : this.A;
    const ox = outra ? (outra.pino ? outra.pino.x : outra.heroi.x) : (this.fiapo() ? this.fiapo().x : h.x);
    const dir = Math.sign(ox - h.x) || h.f;
    return { x: h.x + dir * 18, y: h.y - 44 };
  }
  pontoNo(anc) {
    if (anc.pino) return { x: anc.pino.x + 1, y: anc.pino.y - 10 };
    return this.ponto(anc);
  }
  mesma(a, b) { return a && b && ((a.pino && a.pino === b.pino) || (a.heroi && a.heroi === b.heroi)); }
  // quem está preso na corda (âncora, ou o Fiapo carregando a ponta) não anda em cima dela
  usaHeroi(h) {
    return (this.A && this.A.heroi === h) || (this.B && this.B.heroi === h) || (this.estado === 'presa1' && h.id === 'fiapo');
  }
  fiapo() { return this.herois.find((h) => h.id === 'fiapo'); }

  ancoraPerto(fiapo, herois = this.herois) {
    let melhor = null, dm = Infinity;
    for (const p of this.nivel.pinos) {
      const d = Math.abs(p.x - fiapo.x);
      if (d < 46 && Math.abs(p.y - fiapo.y) < 24 && d < dm) { dm = d; melhor = { pino: p }; }
    }
    if (melhor) return melhor;
    const pudim = herois.find((h) => h.id === 'pudim');
    if (pudim && Math.abs(pudim.x - fiapo.x) < 95 && Math.abs(pudim.y - fiapo.y) < 40 && pudim.estado !== 'arremessado') return { heroi: pudim };
    return null;
  }

  // Quase dá para amarrar (tachinha ou Pudim um pouco longe demais): o Fiapo avisa para chegar mais perto
  quasePerto(fiapo, herois = this.herois) {
    if (this.nivel.pinos.some((p) => !(this.A && this.A.pino === p) && Math.abs(p.x - fiapo.x) < 160 && Math.abs(p.y - fiapo.y) < 40)) return true;
    const pudim = herois.find((h) => h.id === 'pudim');
    return !!pudim && Math.abs(pudim.x - fiapo.x) < 220 && Math.abs(pudim.y - fiapo.y) < 60;
  }

  // Fiapo perto da ponta de baixo da corda solta (dá para pegar de volta)
  pertoDaPonta(fiapo) {
    const q = this.pendurada;
    return this.estado === 'solta' && q && Math.abs(fiapo.x - q.x) < 50 && Math.abs(fiapo.y - q.y1) < 30;
  }

  // Fiapo apertou E. Retorna o que aconteceu (para a fala).
  acao(fiapo, herois = this.herois) {
    const anc = this.ancoraPerto(fiapo, herois);
    if (this.estado === 'carregada') {
      if (!anc) return 'semTachinha';
      this.A = anc; this.estado = 'presa1';
      return anc.heroi ? 'amarrouPudim' : 'amarrou';
    }
    if (this.estado === 'presa1') {
      if (anc && this.mesma(anc, this.A)) { this._recolhe(); return 'recolheu'; }
      if (anc) {
        const a = this.ponto(this.A), b = this.ponto(anc);
        if (U.dist(a.x, a.y, b.x, b.y) > CORDA_MAX) return 'curta';
        this.B = anc; this.estado = 'presa2'; this.visual = null;
        const s = this.segmento();
        if (!s) return 'amarrou';
        return s.tipo === 'ponte' && s.ang > 0.2 ? 'rampa' : s.tipo; // 'ponte' | 'rampa' | 'tirolesa' | 'escalada'
      }
      // largar a corda (fica pendurada pela tachinha) só perto dela, na mesma altura. Longe de tudo, E não faz nada:
      // senão a corda ia parar numa ponta que ele não alcança mais (ex.: do outro lado do fosso)
      const p = this.A.pino;
      if (!p || Math.abs(fiapo.y - p.y) > 20 || Math.abs(fiapo.x - p.x) > PERTO_LARGA) return this.quasePerto(fiapo, herois) ? 'quase' : 'semAncora';
      const pend = this._linhaPendurada();
      if (!pend) return 'naoPendura';
      this.pendurada = pend; this.estado = 'solta';
      this.visual = this._visualPendurada();
      return 'soltou';
    }
    if (this.estado === 'solta') {
      if (anc && this.mesma(anc, this.A)) { this._recolhe(); return 'recolheu'; }
      if (this.pertoDaPonta(fiapo)) { this.estado = 'presa1'; this.pendurada = null; return 'pegou'; }
      return 'longe';
    }
    if (this.estado === 'presa2') {
      if (anc && this.mesma(anc, this.A)) { this.A = this.B; this.B = null; this.estado = 'presa1'; this.visual = null; return 'desamarrou'; }
      if (anc && this.mesma(anc, this.B)) { this.B = null; this.estado = 'presa1'; this.visual = null; return 'desamarrou'; }
      return 'longe';
    }
    return 'nada';
  }

  _recolhe() {
    this.estado = 'carregada';
    this.A = this.B = null;
    this.pendurada = null;
    this.visual = null;
  }

  // O Pudim chegou lá em cima pela corda amarrada nele: desamarra e a corda fica pendurada
  soltaHeroi(h) {
    if (this.estado !== 'presa2' || !this.usaHeroi(h)) return;
    this.A = this.A.heroi === h ? this.B : this.A;
    this.B = null;
    const pend = this._linhaPendurada();
    if (pend) { this.pendurada = pend; this.estado = 'solta'; this.visual = this._visualPendurada(); }
    else { this.estado = 'presa1'; this.visual = null; }
  }

  // Beirada ao lado de uma tachinha (lado preferido primeiro): { beira, lado (lado da queda), x (linha da corda) }
  _beira(p, prefere = -1) {
    const n = this.nivel;
    const c = Math.floor(p.x / TILE), l = Math.floor(p.y / TILE); // l = linha do bloco embaixo da tachinha
    for (const lado of [prefere, -prefere]) {
      for (let k = 1; k <= 2; k++) {
        const cc = c + lado * k;
        if (n.solido(cc, l)) continue;
        const beira = lado < 0 ? (cc + 1) * TILE : cc * TILE;
        return { beira, lado, x: beira + lado * 12 };
      }
    }
    return null;
  }
  _chaoAbaixo(x, y0) {
    const n = this.nivel;
    let y = y0;
    while (y < y0 + CORDA_MAX && !n.solidoEm(x, y + 1) && y < n.altura) y += 4;
    return y;
  }

  // Corda solta a partir da tachinha: pendura pela beirada mais próxima
  _linhaPendurada() {
    if (!this.A || !this.A.pino) return null;
    const p = this.A.pino;
    const b = this._beira(p);
    if (!b) return null;
    const y1 = this._chaoAbaixo(b.x, p.y);
    if (y1 - p.y < 40) return null;
    return { x: b.x, y0: p.y, y1, lado: -b.lado, beira: b.beira };
  }

  // Barbante já começa pendurado: da tachinha até a beirada e depois para baixo
  _visualPendurada() {
    const a = this.pontoNo(this.A), q = this.pendurada;
    const linha = [a, { x: q.beira, y: q.y0 - 3 }, { x: q.x, y: q.y1 }];
    const comp = U.dist(a.x, a.y, q.beira, q.y0) + (q.y1 - q.y0) + 10;
    const c = new Corda(a.x, a.y, q.x, q.y1, comp, 26);
    const lens = [U.dist(linha[0].x, linha[0].y, linha[1].x, linha[1].y), U.dist(linha[1].x, linha[1].y, linha[2].x, linha[2].y)];
    const total = lens[0] + lens[1];
    c.pts.forEach((p, i) => {
      let d = (i / c.n) * total, k = 0;
      if (d > lens[0]) { d -= lens[0]; k = 1; }
      const A = linha[k], B = linha[k + 1], f = lens[k] ? d / lens[k] : 0;
      p.x = p.px = U.lerp(A.x, B.x, f);
      p.y = p.py = U.lerp(A.y, B.y, f);
    });
    return c;
  }

  // Corda amarrada numa tachinha lá em cima e no Pudim lá embaixo:
  // sai da tachinha, passa pela quina da beirada e vai esticada até a barriga dele.
  // (Com a ponta na mão do Fiapo a corda fica frouxa: ele é leve demais para segurar alguém.)
  caminho() {
    if (this.estado !== 'presa2') return null;
    let pino = null, baixo = null, anc = null;
    if (this.A.pino && this.B.heroi) { pino = this.A.pino; anc = this.B.heroi; baixo = this.ponto(this.B); }
    else if (this.B.pino && this.A.heroi) { pino = this.B.pino; anc = this.A.heroi; baixo = this.ponto(this.A); }
    // a ponta de baixo precisa estar abaixo da beirada (menos quando é ela mesma que está subindo)
    if (!pino || (baixo.y < pino.y + 50 && !(anc && anc.estado === 'escalando'))) return null;
    const b = this._beira(pino, Math.sign(baixo.x - pino.x) || -1);
    if (!b) return null;
    return { pino, anc, baixo, canto: { x: b.beira, y: pino.y }, beira: b.beira, lado: b.lado };
  }

  // Segmento de jogo (só entre duas pontas bem presas: tachinha-tachinha ou tachinha-Pudim) e o que ele é:
  // 'ponte' (anda nos dois sentidos), 'tirolesa' (escorrega) ou 'escalada' (↑/↓). A corda acaba nas pontas.
  segmento() {
    if (this.estado !== 'presa2') return null;
    let a, b, c = null;
    if (this.A.pino && this.B.pino) {
      a = this.ponto(this.A); b = this.ponto(this.B);
    } else {
      c = this.caminho();
      if (!c) return null;
      a = c.canto; b = c.baixo;
    }
    const ang = Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x) + 1e-6);
    const tipo = ang < ANG_PONTE ? 'ponte' : ang < ANG_TIROLESA ? 'tirolesa' : 'escalada';
    return { a, b, no: b, tipo, ang, anc: c ? c.anc : null, c };
  }

  // Linha em que dá para subir/descer segurando ↑/↓: corda solta pendurada ou corda quase em pé (rapel).
  // Amarrado nela, o Pudim também sobe — mas só no rapel, não em rampa nem tirolesa.
  linhaEscalada() {
    if (this.estado === 'solta' && this.pendurada) {
      const q = this.pendurada;
      return { x0: q.x, y0: q.y1, x1: q.x, y1: q.y0, topo: { x: q.beira + q.lado * 24, y: q.y0 }, anc: null };
    }
    const s = this.segmento();
    if (!s || s.tipo !== 'escalada') return null;
    const baixo = s.a.y > s.b.y ? s.a : s.b, alto = s.a.y > s.b.y ? s.b : s.a;
    const topo = s.c ? { x: s.c.beira - s.c.lado * 24, y: s.c.pino.y } : { x: alto.x, y: alto.y + 6 };
    return { x0: baixo.x, y0: baixo.y, x1: alto.x, y1: alto.y, topo, anc: s.anc };
  }

  // Ponta carregada pelo Fiapo (cintura)
  pontaFiapo(fiapo) { return { x: fiapo.x - fiapo.f * 6, y: fiapo.y - 50 }; }

  // Coleira: o Fiapo não se afasta mais que o comprimento da corda. Andando (ou no pulo), a corda estica e segura: ele
  // para e avisa, e volta quando quiser. Na escada, escalando ou longe demais na vertical (desceu, caiu), o nó escapa e
  // a corda volta para a mão dele. (29/09: antes só puxava o x para a tachinha — descendo a escada com a corda, a
  // distância era quase toda vertical e o Fiapo ficava grudado no x da tachinha, sem andar para os lados.)
  limita(herois) {
    if (this.estado !== 'presa1') { this.esticada = false; return; }
    const fiapo = herois.find((h) => h.id === 'fiapo');
    const a = this.ponto(this.A), f = this.pontaFiapo(fiapo);
    const dx = f.x - a.x, dy = f.y - a.y;
    if (dx * dx + dy * dy <= CORDA_MAX * CORDA_MAX) { this.esticada = false; return; }
    if (Math.abs(dy) >= CORDA_MAX - 8 || fiapo.estado === 'escada' || fiapo.estado === 'escalando') {
      this._recolhe();
      fiapo.diz(FALA_CORDA.escapou, 1.8);
      return;
    }
    const lado = Math.sign(dx) || 1, nx = fiapo.x + a.x + lado * Math.sqrt(CORDA_MAX * CORDA_MAX - dy * dy) - f.x;
    const w = fiapo.cfg.w / 2 - 1, n = this.nivel;
    if ([nx - w, nx + w].some((x) => n.solidoEm(x, fiapo.y - 8) || n.solidoEm(x, fiapo.y - fiapo.cfg.h / 2))) {
      this._recolhe(); fiapo.diz(FALA_CORDA.escapou, 1.8); return; // o puxão o jogaria dentro da parede: o nó escapa
    }
    fiapo.x = nx;
    if (Math.sign(fiapo.vx) === lado) fiapo.vx = 0;
    if (!this.esticada) fiapo.diz(FALA_CORDA.esticou, 1.4);
    this.esticada = true;
  }

  // Barbante frouxo (verlet): quando o Fiapo leva a ponta, quando a corda está pendurada solta, ou quando as duas
  // pontas estão presas mas não formam ponte nem descida (tachinha e Pudim no mesmo chão: a corda fica largada entre
  // eles — 29/09: antes não era desenhada e parecia sumir)
  atualiza(dt, herois) {
    this.herois = herois;
    this.limita(herois);
    const largada = this.estado === 'presa2' && !this.segmento();
    const frouxa = this.estado === 'solta' || this.estado === 'presa1' || largada;
    if (!frouxa || this.rapido) { this.visual = null; return; }
    const a = this.pontoNo(this.A);
    let b = null, comp;
    if (this.estado === 'solta') {
      const q = this.pendurada;
      comp = Math.abs(q.beira - a.x) + (q.y1 - q.y0) + 10;
    } else {
      b = largada ? this.pontoNo(this.B) : this.pontaFiapo(this.fiapo());
      comp = U.dist(a.x, a.y, b.x, b.y) * 1.08 + 24;
      // Fiapo lá embaixo: a corda passa pela quina da beirada, então precisa de mais comprimento
      const bq = this.A.pino && b.y > this.A.pino.y + 30 ? this._beira(this.A.pino, Math.sign(b.x - a.x) || -1) : null;
      if (bq) comp = Math.max(comp, U.dist(a.x, a.y, bq.beira, this.A.pino.y) + U.dist(bq.beira, this.A.pino.y, b.x, b.y) * 1.1 + 20);
    }
    if (!this.visual) this.visual = this.estado === 'solta' ? this._visualPendurada() : new Corda(a.x, a.y, b.x, b.y, comp, 26);
    this.visual.comp = comp;
    const rets = this.nivel.retsFisica();
    for (let i = 0; i < 2; i++) {
      this.visual.prende(0, a.x, a.y);
      if (b) this.visual.prende(this.visual.n, b.x, b.y);
      // quem está escalando segura a corda com as mãos
      for (const h of herois) {
        if (h.estado !== 'escalando') continue;
        let mi = 0, md = Infinity;
        this.visual.pts.forEach((q, j) => { const dd = Math.abs(q.y - (h.y - 70)); if (j > 0 && j < this.visual.n && dd < md) { md = dd; mi = j; } });
        if (mi) this.visual.prende(mi, h.x, h.y - 70);
      }
      this.visual.passo(dt / 2, rets, 1800);
    }
  }

  desenha(ctx) {
    if (this.estado === 'carregada') return;
    const s = this.segmento();
    if (s && s.c) {
      // tachinha -> quina da beirada -> ponta de baixo, esticada
      const p = this.pontoNo({ pino: s.c.pino }), k = s.c.canto, l = s.c.lado;
      Cenario.barbante(ctx, [p, { x: k.x - l * 6, y: k.y - 3 }, { x: k.x + l * 2, y: k.y + 2 }, s.no], 5);
    } else if (s) {
      const a = this.pontoNo(this.A), b = this.pontoNo(this.B);
      const pts = [a, { x: U.lerp(s.a.x, s.b.x, 0.04), y: U.lerp(s.a.y, s.b.y, 0.04) }, { x: U.lerp(s.a.x, s.b.x, 0.96), y: U.lerp(s.a.y, s.b.y, 0.96) }, b];
      Cenario.barbante(ctx, pts, 5);
    } else if (this.visual) {
      Cenario.barbante(ctx, this.visual.pts, 5);
    }
    for (const anc of [this.A, this.B]) {
      if (!anc || !anc.pino) continue;
      const p = this.pontoNo(anc);
      Estilo.forma(ctx, (c) => U.elipse(c, p.x, p.y, 7, 5.5), { cor: '#c89a5b' }, { elev: 1.4, linha: 2, cel: false });
    }
  }
}

// Todas as cordas da fase + o estoque de rolos do Fiapo (cada corda amarrada gasta um rolo; recolher devolve).
class Cordas {
  constructor(nivel, estoque = 1) {
    this.nivel = nivel;
    this.lista = [];
    this.estoque = estoque;
    this.herois = [];
    this.rapido = false;
  }

  carregada() { return this.lista.find((c) => c.estado === 'presa1') || null; }
  usaHeroi(h) { return this.lista.some((c) => c.usaHeroi(h)); }
  // segmentos em que dá para andar/escorregar/escalar (cada um sabe de que corda veio)
  segmentos() {
    const r = [];
    for (const c of this.lista) { const s = c.segmento(); if (s) { s.corda = c; r.push(s); } }
    return r;
  }
  linhas() {
    const r = [];
    for (const c of this.lista) { const L = c.linhaEscalada(); if (L) { L.corda = c; r.push(L); } }
    return r;
  }

  // Fiapo apertou E: mexe na corda que está carregando, ou numa ponta amarrada perto, ou amarra uma corda nova do estoque
  acao(fiapo, herois) {
    let alvo = this.carregada();
    if (!alvo) {
      alvo = this.lista.find((c) => {
        const anc = c.ancoraPerto(fiapo, herois);
        if (c.estado === 'solta') return c.pertoDaPonta(fiapo) || (anc && c.mesma(anc, c.A));
        return c.estado === 'presa2' && anc && (c.mesma(anc, c.A) || c.mesma(anc, c.B));
      }) || null;
    }
    if (alvo) {
      const r = alvo.acao(fiapo, herois);
      if (alvo.estado === 'carregada') { this.lista.splice(this.lista.indexOf(alvo), 1); this.estoque++; }
      return r;
    }
    if (this.estoque <= 0) return 'semCorda';
    const nova = new CordaJogo(this.nivel);
    nova.herois = herois;
    nova.rapido = this.rapido;
    const r = nova.acao(fiapo, herois);
    if (nova.estado !== 'carregada') { this.lista.push(nova); this.estoque--; }
    return r;
  }

  atualiza(dt, herois) {
    this.herois = herois;
    for (const c of this.lista) { c.herois = herois; c.rapido = this.rapido; c.atualiza(dt, herois); }
    for (const c of this.lista.filter((q) => q.estado === 'carregada')) { // o nó escapou: volta para o estoque
      this.lista.splice(this.lista.indexOf(c), 1); this.estoque++;
    }
  }
  desenha(ctx) { for (const c of this.lista) c.desenha(ctx); }
  resumo() { return `${this.estoque} no estoque; ` + (this.lista.map((c) => c.estado).join(', ') || 'nenhuma amarrada'); }
}
