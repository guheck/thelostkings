'use strict';

// Os três no jogo: física de caixa (previsível, é ela que decide a sala), estados e habilidades.
// O corpo mole e as caretas são só visuais.
const GRAV = 2200, QUEDA_MAX = 1250, ESC = 0.72;
const CFG = {
  marreta: { w: 46, h: 118, vel: 205, pulo: 88, sobe: 110 },
  fiapo: { w: 32, h: 132, vel: 255, pulo: 132, sobe: 150 },
  pudim: { w: 72, h: 106, vel: 150, pulo: 46, sobe: 80 },
};
// Arremesso do Marreta: o gancho (↓ + E) manda o amigo para o alto (passa mureta); o soco reto (E) manda longe e
// baixo (passa por baixo de teto baixo). Fiapo: gancho sobe ~205 px e vai ~450 px; reto sobe ~87 px e vai ~510 px.
const ARREMESSO = { fiapo: { vx: 520, vy: -950 }, pudim: { vx: 320, vy: -720 } };
const ARREMESSO_RETO = { fiapo: { vx: 900, vy: -620 }, pudim: { vx: 640, vy: -500 } };
// Tempo dos golpes (s): quando acerta, quando acaba, quanto o mundo para no impacto e quanto a tela treme.
// O que dá peso: antecipação segurada (ele agacha e espera), golpe rapidíssimo, impacto parado (o mundo congela).
// luva = onde a luva DESENHADA chega (px do jogo a partir do pé, olhando para a direita; medido nos sprites, 28/09):
// soco reto = braço esticado na altura do peito (soco3: até 91 px à frente); gancho = luva subindo rente ao corpo
// até acima da cabeça (gancho3-4: até 47 px). Acerta o que ENCOSTA nessa área (parede rachada, inimigo, amigo),
// desde o meio do corpo. Abaixo da cintura a luva não passa: a borracha e o grampeador, baixinhos, escapam.
const GOLPES = {
  gancho: { acerta: 0.17, fim: 0.52, parada: 0.09, tremor: 10, luva: { x: 53, y0: -204, y1: -60 } },
  soco: { acerta: 0.11, fim: 0.42, parada: 0.06, tremor: 7, luva: { x: 97, y0: -112, y1: -60 } },
};
// Pudim rolando: bola rápida e baixinha (cabe no duto de 2 blocos)
const BOLA = { w: 62, h: 62, vel: 420, pulo: 46, sobe: 80, desce: 1100 };
// Corações de cada herói (como no Lost Vikings): cada dano tira um; sem coração ele cai e a fase recomeça
const VIDAS = 3;
// Poças no chão: cola (fração da velocidade; não pula) e corretivo (aceleração em px/s² — quase sem atrito)
const POCA = { cola: 0.3, colaInimigo: 0.2, arranca: 500, atrito: 60 };
// Correr: dois toques rápidos na direção (até 0,3 s entre eles) e segura. No chão anda 1,7x; no ar volta ao passo
// normal (senão os pulos ficavam mais longos e dava para pular os buracos que pedem corda).
const CORRIDA = { toques: 0.3, vezes: 1.7 };
const V_BARRIGA = Math.sqrt(2 * GRAV * 250);
const MAOS = 62; // altura das mãos acima dos pés quando escala
const NEUTRO = {};
const FALA_CORDA = {
  amarrou: 'Amarrado!', amarrouPudim: 'Segura aí, Pudim!', ponte: 'Ponte!', rampa: 'Rampa!', tirolesa: 'Tirolesa!', escalada: 'Pode subir!',
  descida: 'Pode subir!',
  soltou: 'Lá vai corda!', pegou: 'Peguei a ponta!',
  recolheu: 'Recolhi.', desamarrou: 'Desamarrei.',
  semTachinha: 'Chega perto de uma tachinha ou do Pudim.', semAncora: 'Amarro onde? Chega perto de uma tachinha ou do Pudim.',
  quase: 'Mais perto! Tenho que encostar.',
  naoPendura: 'Aqui não dá pra pendurar.', curta: 'A corda não chega!', longe: 'Chega perto do nó ou da ponta.', nada: '',
  semCorda: 'Acabou o barbante! Dá pra recolher uma que ficou pra trás.',
  esticou: 'A corda acabou! Não vai mais longe.', escapou: 'Desamarrou! Até aqui a corda não chega.',
};
const FALHA_CORDA = new Set(['semTachinha', 'semAncora', 'quase', 'naoPendura', 'curta', 'longe', 'nada', 'semCorda']);
const FALAS = {
  voa: { fiapo: ['AAAAAA!', 'Devagaaar!', 'De novo não!'], pudim: ['UOOOU!', 'Eu não voo!'] },
  machuca: ['AI!', 'Lápis não!', 'Ui, a ponta!'],
  troca: { marreta: ['Confia.', 'Bora.', 'Eu!'], fiapo: ['Oi!', 'Deixa comigo.', 'Hã?'], pudim: ['Segura...', 'Tô aqui.', 'Hmm?'] },
};
const sorteia = (lista, k) => lista[Math.abs(Math.floor(k)) % lista.length];

class Heroi {
  constructor(id, x, y) {
    this.id = id;
    this.ch = Cast[id];
    this.cfg = CFG[id];
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.f = id === 'pudim' ? 1 : 1;
    this.estado = 'chao'; this.tEst = 0;
    this.noChao = true; this.apoio = null;
    this.fase = 0; this.seguro = { x, y };
    this.fala = null; this.squash = 0; this.pisca = 0;
    this.boneco = null; this.soltos = null; this.hPelve = 50;
    this.sEsc = 0; this.linha = null; this.acertou = false;
    this.contaFalas = 0;
    this.vidas = VIDAS; this.empurrado = 0;
  }

  // antes/tAntes: de onde veio e quanto tempo ficou lá (as animações de sprite fazem a transição: pouso, freada...)
  muda(e) { this.antes = this.estado; this.tAntes = this.tEst; this.estado = e; this.tEst = 0; }
  diz(texto, dur = 1.3) { if (texto) this.fala = { texto, t: 0, dur }; this.contaFalas++; }
  caixa() { const c = this.cfg; return { x0: this.x - c.w / 2, y0: this.y - c.h, x1: this.x + c.w / 2, y1: this.y }; }

  // ---------------------------------------------------------------------------
  atualiza(dt, ent, M) {
    const E = ent || NEUTRO, cfg = this.cfg;
    this.seguraBaixo = !!E.baixo;
    this.tEst += dt;
    this.pisca = Math.max(0, this.pisca - dt);
    this.tSoltaEscada = Math.max(0, (this.tSoltaEscada || 0) - dt);
    this.empurrado = Math.max(0, this.empurrado - dt);
    this.squash = Math.max(0, this.squash - dt * 1.3);
    if (this.fala && (this.fala.t += dt) > this.fala.dur) this.fala = null;

    if (this.estado === 'caido') return; // sem coração: fica caído (a fase recomeça)
    if (this.estado === 'escalando') return this._escala(dt, E, M);
    if (this.estado === 'escada') return this._escada(dt, E);
    if (this.estado === 'rolando') return this._rola(dt, E, M);
    if (this.estado === 'machucado') {
      this.vy = Math.min(QUEDA_MAX, this.vy + GRAV * dt);
      this.y += this.vy * dt;
      if (this.tEst > 0.75) this._renasce();
      return;
    }
    if (this.estado === 'gancho' || this.estado === 'soco') this._golpe(M);
    if (this.estado === 'amarrando' && this.tEst > 0.35) this.muda('chao');
    if (this.estado === 'tonto' && this.tEst > 0.75) { this.muda(this.noChao ? 'chao' : 'ar'); this.soltos = null; }

    const controla = this.estado === 'chao' || this.estado === 'ar';
    const tiro = this.apoio && this.apoio.tipo === 'tirolesa';
    // poça no chão: cola (devagar, sem pulo) ou corretivo (escorrega)
    const piso = this.noChao && !this.apoio ? M.nivel.piso(this.x, this.y) : null;
    this.piso = piso;
    let alvo = 0, rumoCorda = false;
    if (controla && !tiro) {
      const dir = (E.dir ? 1 : 0) - (E.esq ? 1 : 0);
      // dois toques na mesma direção: corre enquanto segura
      for (const [b, d] of [[E.bDir, 1], [E.bEsq, -1]]) {
        if (!b) continue;
        this.correndo = this.ultToque && this.ultToque.d === d && M.t - this.ultToque.t < CORRIDA.toques;
        this.ultToque = { d, t: M.t };
      }
      if (!dir || (this.correndo && dir !== this.ultToque.d)) this.correndo = false;
      alvo = dir * cfg.vel * (piso === 'k' ? POCA.cola : 1) * (this.correndo && this.noChao ? CORRIDA.vezes : 1);
      if (dir && !(piso === 'w' && Math.abs(this.vx) > 40)) this.f = dir; // escorregando não vira
      // segurando ↑ perto de uma corda (ou amarrado nela): anda até ela para agarrar
      if (E.cima && this.noChao && !dir && !this._linhaAlcance(M)) {
        const L = this._linhaPerto(M);
        if (L) {
          rumoCorda = true;
          this.f = Math.sign(L.x0 - this.x) || this.f;
          alvo = this.f * cfg.vel;
        }
      }
    }
    if (tiro) {
      const s = this.apoio;
      const baixo = s.a.y > s.b.y ? s.a : s.b, alto = s.a.y > s.b.y ? s.b : s.a;
      const d = Math.sign(baixo.x - alto.x);
      this.vx = U.clamp(this.vx + d * GRAV * Math.sin(s.ang) * Math.cos(s.ang) * 0.9 * dt, -460, 460);
      this.f = d;
    } else if (this.estado !== 'arremessado' && this.estado !== 'bundada' && !(this.empurrado > 0)) { // empurrado: vai com o tranco
      // no corretivo quase não tem atrito: embalado, segue deslizando (parado, dá para começar a andar devagar)
      const acc = (!this.noChao ? 1700 : piso !== 'w' ? 2600 : Math.abs(this.vx) < 40 ? POCA.arranca : POCA.atrito) * dt;
      this.vx += U.clamp(alvo - this.vx, -acc, acc);
    }

    if (controla) {
      if (this.noChao && (E.cima || E.baixo) && this._pegaEscada(M, E.cima ? 1 : -1)) return;
      // no ar (pulando ou caindo) passando pela escada, ↑ ou ↓ agarra ali mesmo (29/09, usuário)
      if (!this.noChao && this.estado === 'ar' && (E.cima || E.baixo) && !this.tSoltaEscada && this._agarraEscada(M)) return;
      if (E.cima && this._agarra(M)) return;
      if (E.baixo && this.noChao && this._agarraTopo(M)) return;
      // ↑ também pula, menos quando está indo para uma corda ou está no pé de uma escada
      const pula = E.pulo || (E.pulaCima && !rumoCorda && !this._linhaPerto(M) && !M.nivel.escadaEm(this));
      if (pula && this.noChao && piso === 'k') this._grudou(M);
      else if (pula && this.noChao) {
        this.vy = -Math.sqrt(2 * GRAV * cfg.pulo);
        this.noChao = false; this.apoio = null;
        this.muda('ar');
        M.som && M.som('pulo', { id: this.id });
      }
      if (E.acao) this._acao(M, E);
    }
    this.trava = 0;
    this._fisica(dt, M);
    // empurrando: no chão, segurando para o lado em que travou alto (a pose do Marreta; "tenta" nos outros)
    const lado = (E.dir ? 1 : 0) - (E.esq ? 1 : 0);
    this.empurra = this.estado === 'chao' && this.noChao && !!lado && this.trava === lado;
    if (this.estado === 'arremessado' && this.boneco) {
      const pv = { x: this.x / ESC, y: (this.y - this.hPelve * ESC) / ESC };
      this.boneco.passo(dt, [], GRAV / ESC, pv);
    }
    if (this.noChao && Math.abs(this.vx) > 10) this.fase += Math.abs(this.vx) * dt * 0.055;
  }

  // ---------------------------------------------------------------------------
  _fisica(dt, M) {
    const n = M.nivel;
    const noArAntes = !this.noChao;
    const yAntes = this.y;
    if (this.apoio) {
      this.vy = 0;
      moveX(this, n, dt);
      const corda = this.apoio.corda, s = corda.segmento();
      const ok = s && s.tipo !== 'escalada' && !corda.usaHeroi(this) && !this.seguraBaixo
        && this.x >= Math.min(s.a.x, s.b.x) && this.x <= Math.max(s.a.x, s.b.x);
      if (ok) {
        s.corda = corda;
        this.apoio = s;
        this.y = U.lerp(s.a.y, s.b.y, (this.x - s.a.x) / (s.b.x - s.a.x));
        this.noChao = true;
      } else {
        this.apoio = null;
        this.noChao = n.solidoEm(this.x, this.y + 1);
      }
    } else {
      this.vy = Math.min(QUEDA_MAX, this.vy + GRAV * (this.estado === 'bundada' ? 1.8 : 1) * dt);
      if (!this._barriga(dt, M)) {
        moveX(this, n, dt);
        moveY(this, n, dt);
        this._pisaCorda(yAntes, M);
        this._pisaPlataforma(yAntes, !noArAntes, M);
      }
      if (this.estado === 'bundada' && this.vy > 0) this._amassa(yAntes, M);
    }
    if (this.noChao && noArAntes) this._pousou(M);
    else if (!this.noChao && this.estado === 'chao') this.muda('ar');

    const cx = this.caixa();
    if (n.perigo(cx.x0 + 4, cx.y0, cx.x1 - 4, cx.y1) || this.y > n.altura + 150) this._machuca(M);
    else if (this.estado === 'chao' && this.noChao && !this.apoio && !n.perigo(cx.x0 - 30, cx.y0, cx.x1 + 30, cx.y1 + 45) && !n.sobCarimbo(cx.x0 - 30, cx.x1 + 30, cx.y1)
      && !(M.inimigos || []).some((o) => o.vivo && Math.abs(o.x - this.x) < 170 && Math.abs(o.y - this.y) < 90)) {
      this.seguro = { x: this.x, y: this.y }; // ponto seguro para reaparecer (longe de lápis e de inimigo)
    }
  }

  // Tentou pular na cola: os pés não saem (um aviso de vez em quando)
  _grudou(M) {
    if (this.tGrudou != null && M.t - this.tGrudou < 0.8) return;
    this.tGrudou = M.t;
    this.squash = 0.2;
    M.fx('GRUDOU!', this.x, this.y - this.cfg.h - 10, '#f6e7a8', 0.8);
  }

  _pousou(M) {
    const vel = this.vyAntes || 0;
    if (this.estado === 'arremessado') {
      this.muda('tonto');
      this.squash = 0.4;
      this.vx *= 0.15;
      this.soltos = this.boneco ? this._pontosBoneco() : null;
      this.boneco = null;
      M.fx('POF!', this.x, this.y - 20, '#e8d6b4');
      return;
    }
    if (this.estado === 'bundada') {
      const n = M.nivel, l = Math.floor((this.y + 1) / TILE);
      const c0 = Math.floor((this.x - this.cfg.w / 2 + 2) / TILE), c1 = Math.floor((this.x + this.cfg.w / 2 - 2) / TILE);
      let rasgou = false;
      for (let c = c0; c <= c1; c++) if (n.tile(c, l) === 'F') rasgou = n.quebra(c, l) || rasgou;
      M.tremer(rasgou ? 10 : 7);
      if (rasgou) { this.noChao = false; this.muda('ar'); M.fx('RASG!', this.x, this.y - 10, '#9bd46a'); return; }
      this.squash = 0.5;
      M.fx('POF!', this.x, this.y - 10, '#f2c230');
      if (M.som) M.som('prrt');
      this.muda('chao');
      return;
    }
    if (this.estado === 'ar') {
      this.muda('chao');
      if (vel > 700) this.squash = 0.25;
      if (vel > 650 && M.som) M.som('pousa', { id: this.id });
    }
  }

  // Bundada: amassa só quem está EMBAIXO — o traseiro do Pudim passa pela cabeça do inimigo caindo. Pulando do chão
  // ele só sobe ~46 px: amassa a borracha (baixinha); guarda e escudeiro, só caindo de um lugar mais alto.
  // O grampeador é de metal.
  _amassa(yAntes, M) {
    for (const o of M.inimigos || []) {
      if (!o.vivo || o.especie === 'grampeador') continue;
      const topo = o.y - o.cfg.h, meio = (this.cfg.w + o.cfg.w) / 2 - 6;
      if (yAntes <= topo + 4 && this.y >= topo && Math.abs(o.x - this.x) < meio) {
        o.derrota(0, M, 'PLAFT!', 0, true); // achatado no lugar
        M.tremer(8);
      }
    }
  }

  // cama elástica: cair em cima do Pudim (em pé; a bola não quica). O Marreta (pulo de 88 px) não alcança a barriga
  // (94 px) pulando do chão, só caindo de cima: o pulo alto continua sendo do Fiapo (29/09, usuário)
  _barriga(dt, M) {
    if (this.id === 'pudim' || this.vy <= 100 || this.seguraBaixo) return false; // ↓ = não quica
    const p = M.herois.find((h) => h.id === 'pudim');
    if (!p || !p.noChao || ['arremessado', 'escalando', 'escada', 'machucado', 'rolando'].includes(p.estado)) return false;
    const topo = p.y - p.cfg.h + 12, ny = this.y + this.vy * dt;
    if (this.y <= topo && ny >= topo && Math.abs(this.x - p.x) < (p.cfg.w + this.cfg.w) * 0.42) {
      this.y = topo;
      this.vy = -V_BARRIGA;
      this.noChao = false; this.apoio = null;
      if (this.estado !== 'arremessado') this.muda('ar');
      p.squash = 0.5;
      M.fx('BOING!', p.x, topo - 16, '#f2553d');
      return true;
    }
    return false;
  }

  // corda deitada/inclinada funciona como plataforma (só de cima para baixo)
  _pisaCorda(yAntes, M) {
    if (this.seguraBaixo) return; // ↓ passa por baixo / desce da corda
    for (const s of M.cordas.segmentos()) {
      if (s.tipo === 'escalada' || s.corda.usaHeroi(this)) continue;
      if (this.x < Math.min(s.a.x, s.b.x) || this.x > Math.max(s.a.x, s.b.x)) continue;
      const yl = U.lerp(s.a.y, s.b.y, (this.x - s.a.x) / (s.b.x - s.a.x));
      const caindo = this.vy >= 0 && yAntes <= yl + 1 && this.y >= yl - 1;
      const degrau = this.noChao && yl < this.y && yl >= this.y - 10;
      if (caindo || degrau) {
        this.y = yl; this.vy = 0; this.noChao = true; this.apoio = s;
        return;
      }
    }
  }

  // Plataformas que se mexem (gangorra, post-it): pisa-se de cima (caindo nela, ou andando: a ponta de baixo da
  // gangorra é um degrau); em cima, vai junto quando ela se mexe. Pousar avisa a plataforma (a gangorra vira e lança
  // quem está na outra ponta; o post-it começa a descolar).
  _pisaPlataforma(yAntes, tinhaChao, M) {
    const gs = M.nivel.plataformas(), estava = this.plat;
    this.plat = null;
    if (!gs.length || this.vy < 0 || this.apoio) return;
    for (const g of gs) {
      const ys = g.superficie(this.x);
      if (ys == null) continue;
      const caindo = yAntes <= ys + 2 && this.y >= ys - 1;
      const junto = estava === g && Math.abs(this.y - ys) < 24;
      const degrau = tinhaChao && estava !== g && ys < this.y && ys >= this.y - GANGORRA.degrau;
      if (!caindo && !junto && !degrau) continue;
      const v = this.vyAntes || 0;
      this.y = ys; this.vy = 0; this.noChao = true; this.plat = g;
      if (!tinhaChao && estava !== g) g.pousa(this, v, M);
      return;
    }
  }

  // Cordas de escalar: a que dá para agarrar daqui, e a que está perto (para andar até ela)
  _linhaAlcance(M) { return M.cordas.linhas().find((L) => this.alcancaCorda(L, L.corda) != null) || null; }
  _linhaPerto(M) { return M.cordas.linhas().find((L) => this.pertoDaCorda(L, L.corda)) || null; }

  // Dá para agarrar a corda daqui? Retorna a posição na linha (0 = embaixo, 1 = em cima) ou null.
  // Quem está amarrado na ponta de baixo (o Pudim) alcança de mais longe: ele puxa a própria corda.
  alcancaCorda(L, corda) {
    if (!L) return null;
    const ancora = L.anc === this;
    if (!ancora && (corda.usaHeroi(this) || L.soAncora)) return null;
    const hx = this.x, hy = this.y - MAOS;
    const dx = L.x1 - L.x0, dy = L.y1 - L.y0;
    const s = U.clamp(((hx - L.x0) * dx + (hy - L.y0) * dy) / (dx * dx + dy * dy), 0, 1);
    if (s > 0.98) return null;
    const px = L.x0 + dx * s, py = L.y0 + dy * s;
    if (ancora ? Math.abs(hx - px) > 150 || Math.abs(hy - py) > 40 : U.dist(hx, hy, px, py) > 34) return null;
    return s;
  }
  _agarra(M) {
    const L = this._linhaAlcance(M);
    if (!L) return false;
    let s = this.alcancaCorda(L, L.corda);
    // não começa com os pés enfiados no chão
    s = U.clamp(Math.max(s, (L.y0 + MAOS - this.y) / ((L.y0 - L.y1) || 1)), 0, 0.97);
    this.muda('escalando');
    // quem está amarrado na ponta de baixo sobe numa linha fixa (a ponta vai junto com ele)
    this.linhaFixa = L.anc === this ? L : null;
    this.linha = L; this.sEsc = s; this.vx = this.vy = 0; this.apoio = null;
    // amarrado na própria corda, ele é um pêndulo pendurado na quina (29/09, usuário: a ponta dele não é ponto fixo —
    // a corda tem que balançar): puxando, é arrastado pelo chão até sair dele e aí balança até parar embaixo da quina
    this.pend = this.linhaFixa ? { th: Math.atan2(this.x - L.x1, this.y - MAOS - L.y1), w: 0, chao: this.y } : null;
    return true;
  }
  // Pêndulo (o Pudim na própria corda): pivô na quina (L.x1, L.y1), raio = o que falta subir. Chão e parede seguram.
  _pendulo(dt, L, len, M) {
    const P = this.pend, n = M.nivel, px = L.x1, py = L.y1, r = Math.max(12, (1 - this.sEsc) * len);
    const bate = (x, y) => [x - this.cfg.w / 2 + 2, x + this.cfg.w / 2 - 2].some((q) => n.solidoEm(q, y - 8) || n.solidoEm(q, y - this.cfg.h / 2));
    P.w = (P.w - (GRAV / r) * Math.sin(P.th) * dt) * (1 - 0.9 * dt);
    const th = P.th + P.w * dt;
    let hx = px + r * Math.sin(th), hy = py + r * Math.cos(th), noChao = false;
    if (hy + MAOS > P.chao && n.solidoEm(hx, P.chao + 2)) { // os pés no chão: arrastado por ele, na direção da quina
      hy = P.chao - MAOS;
      const dy = hy - py;
      hx = px + (Math.sign(th) || 1) * Math.sqrt(Math.max(0, r * r - dy * dy));
      P.w = 0; noChao = true;
    }
    // (perto da quina ele já está passando por cima da beirada: não bate mais)
    if (r > 40 && bate(hx, hy + MAOS)) { // bateu na parede (a que fica embaixo da quina): quica e sobe rente a ela
      P.w *= -0.3;
      hx = this.x;
      hy = Math.min(hy, py + Math.sqrt(Math.max(0, r * r - (hx - px) * (hx - px))));
      if (bate(hx, hy + MAOS)) return { x: this.x, y: this.y, noChao };
    }
    P.th = Math.atan2(hx - px, hy - py);
    return { x: hx, y: hy + MAOS, noChao };
  }
  // Corda de escalar por perto, com as mãos na altura dela (para andar até ela segurando ↑)
  pertoDaCorda(L, corda) {
    if (!L) return false;
    const ancora = L.anc === this;
    if (!ancora && (corda.usaHeroi(this) || L.soAncora)) return false;
    const hy = this.y - MAOS;
    if (hy < Math.min(L.y0, L.y1) - 10 || hy > Math.max(L.y0, L.y1) + 10) return false;
    const k = U.clamp((L.y0 - hy) / ((L.y0 - L.y1) || 1), 0, 1);
    return Math.abs(this.x - U.lerp(L.x0, L.x1, k)) < (ancora ? 480 : 170);
  }
  podeDescer(L) {
    return L && !(L.soAncora && L.anc !== this) && Math.abs(this.x - L.topo.x) <= 40 && Math.abs(this.y - L.topo.y) <= 12;
  }
  _agarraTopo(M) {
    const L = M.cordas.linhas().find((q) => !(q.anc !== this && q.corda.usaHeroi(this)) && this.podeDescer(q));
    if (!L) return false;
    const len = U.dist(L.x0, L.y0, L.x1, L.y1);
    this.muda('escalando');
    this.linhaFixa = null;
    this.linha = L; this.sEsc = 1 - (MAOS + 4) / len; this.vx = this.vy = 0; this.apoio = null;
    return true;
  }

  _escala(dt, E, M) {
    const corda = this.linha && this.linha.corda;
    let L = corda ? corda.linhaEscalada() : null;
    if (L) L.corda = corda;
    if (this.linhaFixa) {
      if (!corda || !corda.usaHeroi(this)) { this.linhaFixa = null; L = null; } else L = this.linhaFixa;
    }
    if (!L || !M.cordas.lista.includes(corda)) { this.noChao = false; this.muda('ar'); return; }
    this.linha = L;
    const len = U.dist(L.x0, L.y0, L.x1, L.y1);
    const dir = (E.cima ? 1 : 0) - (E.baixo ? 1 : 0);
    this.sEsc += dir * (dir > 0 ? this.cfg.sobe : this.cfg.sobe * 1.7) * dt / len;
    if (dir) this.fase += dt * 9;
    if (E.dir) this.f = 1;
    if (E.esq) this.f = -1;
    // chegou em cima: sobe na plataforma (o Pudim se desamarra e a corda fica pendurada para os outros)
    if (this.sEsc >= 1 - 2 / len) {
      this.x = L.topo.x; this.y = L.topo.y; this.vx = this.vy = 0; this.noChao = true;
      this.muda('chao');
      this.linhaFixa = null;
      if (L.anc === this && this.id === 'pudim') { L.corda.soltaHeroi(this); this.diz('Me soltei!'); }
      return;
    }
    this.sEsc = U.clamp(this.sEsc, 0, 1);
    const n = M.nivel;
    if (this.linhaFixa && this.pend) {
      const q = this._pendulo(dt, L, len, M);
      this.x = q.x; this.y = q.y;
      if (dir < 0 && q.noChao) { this.noChao = true; this.pend = null; this.muda('chao'); return; } // desceu até o chão
      if (E.pulo) { this.vy = -380; this.vx = this.f * 160; this.noChao = false; this.pend = null; this.muda('ar'); }
      return;
    }
    this.x = U.lerp(L.x0, L.x1, this.sEsc);
    this.y = U.lerp(L.y0, L.y1, this.sEsc) + MAOS;
    if (dir < 0 && n.solidoEm(this.x, this.y)) { // descendo, os pés encostaram no chão
      this.y = Math.floor(this.y / TILE) * TILE;
      this.noChao = true;
      this.muda('chao');
      return;
    }
    if (this.sEsc <= 0 && dir < 0) { this.noChao = false; this.muda('ar'); return; }
    if (E.pulo) { this.vy = -380; this.vx = this.f * 160; this.noChao = false; this.muda('ar'); }
  }

  // Escada de palitos: ↑ no pé dela sobe, ↓ em cima do topo desce. Na fresta (1 bloco) só o Fiapo cabe.
  _pegaEscada(M, dir) {
    const n = M.nivel;
    const L = dir > 0 ? n.escadaEm(this) : n.topoEscada(this);
    if (!L) return false;
    if (!n.cabeNaEscada(this, L)) {
      if (!this.fala || this.fala.texto !== 'Não caibo aí!') this.diz('Não caibo aí!');
      return false;
    }
    this.muda('escada');
    this.escada = L; this.x = L.x; this.vx = this.vy = 0; this.apoio = null; this.noChao = false;
    if (dir < 0) this.y = L.yTopo + 3;
    return true;
  }
  _agarraEscada(M) {
    const L = M.nivel.escadaEm(this);
    if (!L || !M.nivel.cabeNaEscada(this, L)) return false;
    this.muda('escada');
    this.escada = L; this.x = L.x; this.vx = this.vy = 0; this.apoio = null; this.noChao = false;
    M.registra(`${this.id}: agarrou a escada no ar`);
    return true;
  }
  _escada(dt, E) {
    const L = this.escada;
    const dir = (E.cima ? 1 : 0) - (E.baixo ? 1 : 0);
    this.y -= dir * this.cfg.sobe * (dir > 0 ? 1.5 : 2.2) * dt;
    this.x = L.x;
    if (dir) this.fase += dt * 9;
    if (E.dir) this.f = 1;
    if (E.esq) this.f = -1;
    if (this.y <= L.yTopo || this.y >= L.yBase) { // chegou em cima (fica no topo, que é piso) ou embaixo
      this.y = this.y <= L.yTopo ? L.yTopo : L.yBase;
      this.noChao = true; this.escada = null;
      this.muda('chao');
      return;
    }
    // pulo da escada: segurando um lado, pulo inteiro para ele; sem lado, solta com um pulinho para a frente
    const lado = (E.dir ? 1 : 0) - (E.esq ? 1 : 0);
    if (E.pulo || (E.pulaCima && lado)) { // (↑ sozinho sobe; ↑ com um lado é pulo)
      if (lado) { this.f = lado; this.vy = -Math.sqrt(2 * GRAV * this.cfg.pulo); this.vx = lado * this.cfg.vel; }
      else { this.vy = -380; this.vx = this.f * 160; }
      this.noChao = false; this.escada = null; this.tSoltaEscada = 0.3; this.muda('ar');
    }
  }

  _acao(M, E = NEUTRO) {
    // perto de uma alavanca, qualquer um puxa (o Marreta puxa no soco mesmo)
    const alav = this.noChao && M.nivel.alavancaPerto(this);
    if (alav) {
      alav.ligada = !alav.ligada;
      this.desliga = !alav.ligada; // desligando: a pose de puxar roda ao contrário (empurra o cabo de volta para cima)
      // vira para a alavanca e fica com as mãos na manopla (se couber: não entra em parede)
      const lado = Math.sign(this.x - alav.x) || -this.f, nx = alav.x + lado * 44;
      alav.lado = lado; this.f = -lado;
      if ([nx - this.cfg.w / 2 + 1, nx + this.cfg.w / 2 - 1].every((x) => !bloqueado(M.nivel, Math.floor(x / TILE), this.y - this.cfg.h + 1, this.y - 1))) this.x = nx;
      M.fx('CLAC!', alav.x, alav.y - 100, M.nivel.corCanal[alav.canal] || '#fffdf6');
      this.muda('amarrando'); this.vx = 0;
      this.puxou = true; // (sprites: 'amarrando' puxando a alavanca, não amarrando corda)
      return;
    }
    this.puxou = false;
    if (this.id === 'marreta') {
      if (!this.noChao) return;
      // como nos jogos de luta: agachado (↓ + E) é o gancho, de baixo para cima; só E é o soco reto
      this.muda(E.baixo ? 'gancho' : 'soco'); this.acertou = false; this.rebateu = false; this.vx = 0;
    } else if (this.id === 'fiapo') {
      if (!this.noChao) return;
      const r = M.cordas.acao(this, M.herois);
      // só faz a animação de amarrar quando algo aconteceu de verdade
      if (!FALHA_CORDA.has(r)) { this.muda('amarrando'); this.vx = 0; }
      this.diz(FALA_CORDA[r], FALHA_CORDA.has(r) ? 1.8 : 1.3);
    } else if (this.id === 'pudim') {
      // no ar (pulando): bundada; no chão: vira bola e sai rolando (parado, é só uma cambalhota)
      if (!this.noChao) { this.muda('bundada'); this.vx *= 0.4; } else this._enrola();
    }
  }

  // --- Pudim rolando ---------------------------------------------------------
  _enrola() {
    this.muda('rolando');
    this.cfg = BOLA;
    this.apoio = null;
    this.tParado = 0;
    this.giro = this.giro || 0;
    if (Math.abs(this.vx) < 150) this.vx = this.f * 150;
  }
  // Cabe em pé aqui? (no duto não cabe: continua bola)
  _cabeEmPe(n) {
    const c = CFG[this.id], x0 = this.x - c.w / 2 + 2, x1 = this.x + c.w / 2 - 2;
    for (let col = Math.floor(x0 / TILE); col <= Math.floor(x1 / TILE); col++) if (bloqueado(n, col, this.y - c.h + 4, this.y - 2)) return false;
    return true;
  }
  _desenrola(M) {
    if (!this._cabeEmPe(M.nivel)) return false;
    this.cfg = CFG[this.id];
    this.muda(this.noChao ? 'chao' : 'ar');
    this.vx *= 0.3;
    return true;
  }
  // Segurando a direção ele rola rápido; soltando, freia e levanta. E no chão levanta na hora; E no ar, bundada.
  _rola(dt, E, M) {
    const dir = (E.dir ? 1 : 0) - (E.esq ? 1 : 0);
    const piso = this.noChao && !this.apoio ? M.nivel.piso(this.x, this.y) : null;
    if (dir && piso !== 'w') this.f = dir;
    if (piso === 'k') this.vx *= Math.max(0, 1 - dt * 9); // a bola gruda: freia e desmancha
    else if (piso === 'w') this.vx += U.clamp(dir * BOLA.vel - this.vx, -POCA.atrito * dt, POCA.atrito * dt); // não freia
    else {
      const acc = (dir ? 1400 : 650) * dt;
      this.vx += U.clamp(dir * BOLA.vel - this.vx, -acc, acc);
    }
    const rampa = this.noChao ? M.nivel.inclinacao(this.x, this.y) : 0; // na rampa a bola desce sozinha, embalando
    if (rampa) this.vx -= rampa * BOLA.desce * dt;
    if (E.pulo && this.noChao) { this.vy = -Math.sqrt(2 * GRAV * BOLA.pulo); this.noChao = false; this.apoio = null; }
    if (E.acao && !this.noChao && this._cabeEmPe(M.nivel)) { // bola no ar vira bundada
      this.cfg = CFG[this.id];
      this.muda('bundada');
      this.vx *= 0.4;
      this._fisica(dt, M);
      return;
    }
    const parado = !dir && this.noChao && Math.abs(this.vx) < 30;
    this.tParado = parado ? this.tParado + dt : 0;
    if (this.noChao && (E.acao || this.tParado > 0.2) && this._desenrola(M)) { this._fisica(dt, M); return; }
    this._fisica(dt, M);
    this.giro += this.vx * dt / (BOLA.h / 2);
  }

  // Área da luva do golpe no mundo (GOLPES.luva), do meio do corpo até a ponta da luva
  zonaGolpe(golpe) {
    const L = GOLPES[golpe].luva, xb = this.x + this.f * L.x;
    return { x0: Math.min(this.x, xb), x1: Math.max(this.x, xb), y0: this.y + L.y0, y1: this.y + L.y1 };
  }
  // A luva do golpe (sem dizer qual: de qualquer um dos dois) encosta na caixa?
  encosta(c, golpe) {
    return (golpe ? [golpe] : ['soco', 'gancho']).some((g) => {
      const z = this.zonaGolpe(g);
      return c.x0 < z.x1 && c.x1 > z.x0 && c.y0 < z.y1 && c.y1 > z.y0;
    });
  }
  // Onde a luva encontra a caixa (x): a borda da caixa do lado dele, sem passar da ponta da luva
  contato(c, golpe) {
    const borda = this.f > 0 ? c.x0 : c.x1;
    return this.x + this.f * U.clamp(this.f * (borda - this.x), this.cfg.w / 2, GOLPES[golpe].luva.x);
  }
  // Amigo que a luva alcança (o mais perto): encostou, arremessa — mesmo um pouco acima ou abaixo dele (numa rampa, num
  // degrau). Antes pedia o pé na mesma altura (16 px) e o usuário via a luva passar pelo amigo na rampa sem fazer nada.
  alvoGancho(herois, golpe) {
    return herois.filter((o) => o !== this && ARREMESSO[o.id] && (o.estado === 'chao' || o.estado === 'tonto' || o.estado === 'amarrando')
      && this.encosta(o.caixa(), golpe)).sort((p, q) => Math.abs(p.x - this.x) - Math.abs(q.x - this.x))[0] || null;
  }
  // Bloco de papelão rachado que a luva alcança (o mais perto primeiro): [c, l] ou null
  rachadoNaFrente(n, golpe = 'soco') {
    const z = this.zonaGolpe(golpe), c0 = Math.floor(this.x / TILE), c1 = Math.floor((this.f > 0 ? z.x1 - 0.01 : z.x0) / TILE);
    for (let c = c0; this.f > 0 ? c <= c1 : c >= c1; c += this.f) {
      for (let l = Math.floor(z.y0 / TILE); l <= Math.floor((z.y1 - 0.01) / TILE); l++) if (n.tile(c, l) === 'C') return [c, l];
    }
    return null;
  }

  // Inimigo que a luva alcança (a borracha e o grampeador são baixos demais: a luva passa por cima)
  inimigoNaFrente(inimigos, golpe) {
    return (inimigos || []).filter((o) => o.vivo && this.encosta(o.caixa(), golpe))
      .sort((p, q) => Math.abs(p.x - this.x) - Math.abs(q.x - this.x))[0] || null;
  }

  // Gancho (de baixo para cima: o inimigo e o amigo voam para o alto) ou soco reto (voam longe, baixinho).
  // Acertando alguma coisa, o mundo para um instante (M.parada), a tela treme e sai a estrela de impacto.
  _golpe(M) {
    const golpe = this.estado, reto = golpe === 'soco', G = GOLPES[golpe];
    const yLuva = this.y + (reto ? -86 : -118); // altura da luva no impacto
    const bate = (x, texto, cor = '#ffd23f') => { // a estrela sai no ponto do contato
      M.fx(texto, x, yLuva, cor, 1.3, true);
      M.tremer(G.tremor);
      M.parada = Math.max(M.parada || 0, G.parada);
    };
    // bolinha de papel da lixeira na luva, perto do instante do golpe (uma folguinha antes e depois): volta reta para a
    // dona — CESTA!
    if (!this.rebateu && this.tEst >= G.acerta - 0.04 && this.tEst <= G.acerta + 0.1 && M.bolinhas) {
      const z = this.zonaGolpe(golpe), r = LIXEIRA.raio + 4;
      const b = M.bolinhas.find((q) => !q.rebatida && q.x > z.x0 - r && q.x < z.x1 + r && q.y > z.y0 - r && q.y < z.y1 + r);
      if (b) {
        this.rebateu = true; b.rebatida = true;
        const o = b.dono, ty = o.y - o.cfg.h + 8; // mira na boca do cesto
        const v = arcoBolinha(M, b.x, b.y, o.x, ty, U.clamp(Math.hypot(o.x - b.x, ty - b.y) / 500, ...LIXEIRA.volta));
        b.vx = v.vx; b.vy = v.vy; b.vida = 3;
        bate(b.x, 'PLAFT!', '#fffdf6');
      }
    }
    if (!this.acertou && this.tEst >= G.acerta) {
      this.acertou = true;
      // Acerta TUDO o que a luva encosta (29/09, usuário: "se encostou tinha que funcionar"): o amigo encostado na parede
      // fraca voa e a parede quebra junto. Só a régua do escudeiro segura o soco reto (e o que está atrás dela).
      const ini = this.inimigoNaFrente(M.inimigos, golpe);
      if (ini && ini.escudoPara(this.x) && reto) { // soco reto na régua: não adianta (o gancho vem de baixo e derruba)
        M.fx('TOC!', ini.x + ini.f * 40, ini.y - 60, '#e9c77a', 1.1); // na régua
        ini.tBloqueio = M.t;
        this.vx = -this.f * 260;
        this.diz('Ai, o escudo!');
        return;
      }
      if (ini) {
        if (reto) ini.derrota(this.f * 620, M, '', -380); else ini.derrota(this.f * 160, M, '', -980);
        bate(this.contato(ini.caixa(), golpe), reto ? 'POW!' : 'UPPER!');
      }
      const alvo = this.alvoGancho(M.herois, golpe);
      const rolo = (M.nivel.durex || []).find((r) => this.encosta(r.caixa(), golpe));
      const rach = this.rachadoNaFrente(M.nivel, golpe);
      if (alvo) {
        alvo.lanca(this.f, M, reto);
        bate(this.contato(alvo.caixa(), golpe), reto ? 'POW!' : 'UPPER!');
      }
      if (rolo) { // rolo de durex: o soco manda rolando (boliche); o gancho dá um pulinho
        rolo.vx = this.f * (reto ? DUREX.soco : DUREX.gancho.vx);
        if (!reto) { rolo.vy = DUREX.gancho.vy; rolo.noChao = false; }
        rolo.travado = 0;
        bate(this.contato(rolo.caixa(), golpe), 'TUM!', '#e8d6b4');
      }
      const quebrou = rach && M.nivel.quebra(rach[0], rach[1]);
      if (quebrou) { bate(this.contato({ x0: rach[0] * TILE, x1: (rach[0] + 1) * TILE }, golpe), 'CRAC!', '#dcaa70'); this.diz('Pow!'); }
      if (!ini && !alvo && !rolo && !quebrou && !this.rebateu) M.fx('fuu', this.x + this.f * G.luva.x, yLuva, '#fffdf6', 0.7);
    }
    if (this.tEst >= G.fim) this.muda('chao');
  }

  lanca(f, M, reto = false) {
    const A = (reto ? ARREMESSO_RETO : ARREMESSO)[this.id];
    this.muda('arremessado');
    this.vx = f * A.vx; this.vy = A.vy;
    this.noChao = false; this.apoio = null;
    this.diz(sorteia(FALAS.voa[this.id], this.contaFalas));
    if (M.rapido) return; // simulação escondida: sem corpo mole
    const V = this.visual(M.t);
    this.hPelve = V.hPelve;
    // corpo mole: simulado num espaço sem escala, com a pelve presa ao caminho do jogo
    const pv = { x: V.M.pelve.x / ESC, y: V.M.pelve.y / ESC };
    const Mv = {};
    for (const k in V.M) Mv[k] = { x: pv.x + (V.M[k].x - V.M.pelve.x), y: pv.y + (V.M[k].y - V.M.pelve.y) };
    this.boneco = new Boneco(this.ch.p, Mv, { x: this.vx / ESC, y: this.vy / ESC }, f * 7);
  }

  _pontosBoneco() { // deslocamentos (sem escala) em relação à pelve
    const P = this.boneco.pts, r = {};
    for (const k in P) r[k] = { x: P[k].x - P.pelve.x, y: P[k].y - P.pelve.y };
    return r;
  }

  // Dano: perde um coração, pula de dor e reaparece no último lugar seguro. Sem coração, fica caído lá.
  _machuca(M) {
    if (this.estado === 'machucado' || this.estado === 'caido') return;
    this.cfg = CFG[this.id]; // se estava rolando, volta em pé
    this.vidas = Math.max(0, this.vidas - 1);
    this.muda('machucado');
    this.vy = -720; this.vx = 0; this.apoio = null; this.boneco = null;
    this.diz(sorteia(FALAS.machuca, this.contaFalas));
    if (M) M.registra(`${this.id}: -1 coração (${this.vidas})`);
    if (M && M.som) M.som('dano', { id: this.id });
  }
  _renasce() {
    this.x = this.seguro.x; this.y = this.seguro.y;
    this.vx = this.vy = 0; this.noChao = true; this.apoio = null;
    if (this.vidas <= 0) { this.muda('caido'); this.diz('Não aguento mais...', 2.2); return; }
    this.muda('chao');
    this.pisca = 1;
  }

  // ---------------------------------------------------------------------------
  // Pose + rosto para desenhar
  visual(t, nivel) {
    const id = this.id, p = this.ch.p;
    let pose, dy = 0, extra = {}, rosto = Rosto.expr(this.ch.exprBase);
    const e = this.estado;
    // sprites: um desenho inteiro (quadro de animação) para o estado, quando tem; senão, as peças no esqueleto
    const quadro = Sprites.pronto(id) ? Sprites.escolhe(this, t, nivel) : null; // (com o nível: não entra na parede)
    if (e === 'arremessado' && this.boneco) {
      const off = this._pontosBoneco();
      const pel = { x: this.x, y: this.y - this.hPelve * ESC };
      const M = {};
      for (const k in off) M[k] = { x: pel.x + off[k].x, y: pel.y + off[k].y };
      return { M, rosto: Rosto.expr('grito'), mole: true, hPelve: this.hPelve, extra: { vento: 0.4, semRolo: true }, quadro };
    }
    if (e === 'chao' && this.apoio && this.apoio.tipo === 'tirolesa') { pose = Poses.surfa(id, t); rosto = Rosto.expr('feliz', { boca: 'grito', abre: 0.7 }); }
    else if (e === 'chao' && Math.abs(this.vx) > 20) ({ pose, dy } = Poses.anda(id, this.fase, t));
    else if (e === 'chao' || e === 'festa') {
      const I = Poses.idle[id](t);
      pose = I.pose; dy = I.dy; extra = I.extra || {};
      if (e === 'festa') { pose = Poses.comemora(t, id); dy = 0; rosto = Rosto.expr('feliz'); }
    } else if (e === 'ar') pose = this.vy < 0 ? Poses.pulo(id) : Poses.cai(id, t);
    else if (e === 'tonto' || e === 'caido') { pose = Poses.tonto(id, t); rosto = Rosto.expr('tonto'); }
    else if (e === 'escalando' || e === 'escada') { pose = Poses.escala(id, this.fase); rosto = Rosto.expr(id === 'pudim' ? 'esforco' : 'confia'); }
    else if (e === 'gancho' || e === 'soco') {
      const a = GOLPES[e].acerta, prepara = e === 'gancho' ? Poses.preparaGancho : Poses.preparaSoco;
      pose = this.tEst < a ? prepara(this.tEst / a) : e === 'gancho' ? Poses.gancho() : Poses.soco();
      rosto = Rosto.expr('confia', { abre: 1 });
    }
    else if (e === 'amarrando') { pose = Poses.amarra(t); rosto = Rosto.expr('feliz', { boca: 'sorrisinho', lingua: true, olhar: { x: 0.8, y: 0.8 } }); }
    else if (e === 'bundada') { pose = Poses.bundada(); rosto = Rosto.expr('grito'); }
    else if (e === 'rolando') { pose = Poses.bola(); rosto = Rosto.expr('feliz', { boca: 'grito', abre: 0.6 }); }
    else if (e === 'machucado') { pose = Poses.cai(id, t); rosto = Rosto.expr('grito'); }
    else pose = Poses.idle[id](t).pose;
    if (Sprites.pronto(id)) pose = Sprites.ajustaPose(id, e, pose, e === 'chao' && Math.abs(this.vx) > 20 ? this.fase : null);
    if (e === 'ar' && this.vy > 600) rosto = Rosto.expr('susto');
    if (rosto.olhos === 'normal' && rosto.palp < 0.5 && piscando(t, id.length)) rosto.palp = 1;

    const hp = Rig.alturaPelve(p, pose);
    const pel = { x: this.x, y: this.y - (hp - dy) * ESC };
    let M = Rig.mundo(Rig.fk(p, pose), pel.x, pel.y, this.f);
    if (quadro) return { M, rosto, mole: false, hPelve: hp, extra, quadro };
    if (e === 'rolando') { // encolhido e girando em volta do meio da bola
      const cx = this.x, cy = this.y - BOLA.h / 2, mx = (M.pelve.x + M.peito.x) / 2, my = (M.pelve.y + M.peito.y) / 2;
      const c = Math.cos(this.giro), s = Math.sin(this.giro);
      for (const k in M) { const x = M[k].x - mx, y = M[k].y - my; M[k] = { x: cx + x * c - y * s, y: cy + x * s + y * c }; }
      return { M, rosto, mole: false, giro: true, hPelve: hp, extra };
    }
    if (e === 'tonto' && this.soltos) { // remonta o boneco
      const k = U.ease.out(U.prog(this.tEst, 0, 0.3));
      for (const q in M) {
        const alvo = { x: (M[q].x - pel.x), y: M[q].y - pel.y };
        M[q] = { x: pel.x + U.lerp(this.soltos[q].x, alvo.x, k), y: pel.y + U.lerp(this.soltos[q].y, alvo.y, k) };
      }
    }
    return { M, rosto, mole: false, hPelve: hp, extra };
  }
}

// --- colisão de caixa com a grade ---------------------------------------------
function bloqueado(n, c, yTopo, yPe) {
  for (let l = Math.floor(yTopo / TILE); l <= Math.floor(yPe / TILE); l++) if (n.solido(c, l)) return true;
  return false;
}

// Rampa no caminho do corpo: o lado alto dela é parede (a parte cheia encosta no corpo). Subindo pela rampa (o lado
// baixo, na altura dos pés), não: quem manda é o meio dos pés, que anda na inclinação (moveY).
function paredeDeRampa(n, c, xb, s, yTopo, yPe) {
  const lPe = Math.floor(yPe / TILE);
  for (let l = Math.floor(yTopo / TILE); l <= lPe; l++) {
    const r = n.rampa(c, l);
    if (!r || (r === s && l === lPe)) continue;
    if (yPe > n.chaoRampa(c, l, xb) + 3 && yTopo < (l + 1) * TILE) return true;
  }
  return false;
}

// Pose de empurrar (30/09, usuário): só quando trava de frente num bloqueio que chega ACIMA das mãos daquele herói (a
// face do bloqueio cobre as luvas); degrau/bloco baixo (dá para pular ou subir) e rampa não contam. EMPURRA.maos = a
// altura do alto das mãos na pose de empurrar, medida nos quadros (Marreta: luvas de 57 a 87 px acima do pé).
const EMPURRA = { maos: { marreta: 87, fiapo: 95, pudim: 70 } }; // (Fiapo e Pudim: provisório, medir na animação deles)
function travaAlto(h, n, c) {
  const alto = EMPURRA.maos[h.id];
  return !!alto && n.solido(c, Math.floor((h.y - alto) / TILE)) && n.solido(c, Math.floor((h.y - 30) / TILE));
}

function moveX(h, n, dt) {
  if (h.vx === 0) return;
  const w = h.cfg.w, hh = h.cfg.h, s = Math.sign(h.vx);
  const nx = h.x + h.vx * dt, xb = nx + s * w / 2;
  const c = Math.floor(xb / TILE);
  if (bloqueado(n, c, h.y - hh + 4, h.y - 2) || paredeDeRampa(n, c, xb, s, h.y - hh + 4, h.y - 2)) {
    // degrau baixinho (ex.: saindo da ponte de corda para o chão): sobe em vez de parar
    const topo = Math.floor((h.y - 2) / TILE) * TILE;
    if (h.noChao && topo >= h.y - 14 && !bloqueado(n, c, topo - hh + 4, topo - 2)) { h.y = topo; h.x = nx; empurraDurex(h, n); return; }
    // subindo a rampa: o meio dos pés ainda está nela e a frente do corpo já passa por cima do bloco onde ela acaba
    if (h.noChao && n.inclinacao(h.x, h.y) === s && topo >= h.y - w / 2 - 4 && !bloqueado(n, c, topo - hh + 4, topo - 2)) { h.x = nx; empurraDurex(h, n); return; }
    h.x = s > 0 ? c * TILE - w / 2 - 0.01 : (c + 1) * TILE + w / 2 + 0.01;
    h.vx = 0;
    if (h instanceof Heroi && h.noChao && travaAlto(h, n, c)) h.trava = s;
    return;
  }
  h.x = nx;
  empurraDurex(h, n);
}

// Rolo de durex no caminho: herói no chão empurra (a bola do Pudim, com tudo: boliche); rolo travado desse lado (na
// parede, no buraco) segura quem empurra; inimigo e o que está no ar param nele. Em cima dele não conta (é piso).
function empurraDurex(h, n) {
  if (h.eDurex || !n.durex || !n.durex.length || !h.vx) return;
  const w = h.cfg.w, hh = h.cfg.h, s = Math.sign(h.vx), lim = DUREX.w / 2 + w / 2;
  for (const r of n.durex) {
    if (h.y <= r.y - 2 * DUREX.r + 4 || h.y - hh >= r.y) continue;
    const d = r.x - h.x;
    if (Math.abs(d) >= lim || Math.sign(d) !== s) continue;
    if (h instanceof Heroi && h.noChao && r.travado !== s) {
      const v = Math.abs(h.vx) * (h.estado === 'rolando' ? 1 : DUREX.empurra);
      if (s * r.vx < v) r.vx = s * v;
    } else { h.vx = 0; h.bateuDurex = true; }
    h.x = r.x - s * lim;
  }
}

function moveY(h, n, dt) {
  const w = h.cfg.w, hh = h.cfg.h;
  const yAntes = h.y, tinhaChao = h.noChao;
  let ny = h.y + h.vy * dt;
  h.vyAntes = h.vy;
  h.noChao = false;
  const c0 = Math.floor((h.x - w / 2 + 2) / TILE), c1 = Math.floor((h.x + w / 2 - 2) / TILE);
  if (h.vy >= 0) {
    // rampa: o meio dos pés anda na inclinação — sobe e desce colado nela (sem sair do chão a cada passo); caindo, pousa
    const yr = n.rampaEntre(h.x, yAntes - 16, ny + (tinhaChao ? 16 : 0));
    if (yr != null) { ny = yr; h.vy = 0; h.noChao = true; }
    const l = Math.floor(ny / TILE);
    // (quem estava no chão e ficou um pouco abaixo da quina de um bloco — o fim da rampa — sobe para o topo dele)
    for (let c = c0; c <= c1 && !h.noChao; c++) {
      if (n.solido(c, l) && yAntes <= l * TILE + (tinhaChao ? 16 : 0.5)) { ny = l * TILE; h.vy = 0; h.noChao = true; break; }
    }
    // em cima de um rolo de durex (é piso)
    if (!h.noChao && n.durex && n.durex.length) {
      for (const r of n.durex) {
        const topo = r.y - 2 * DUREX.r;
        if (r !== h && Math.abs(h.x - r.x) < (DUREX.w + w) / 2 - 8 && yAntes <= topo + 0.5 && ny >= topo) { ny = topo; h.vy = 0; h.noChao = true; break; }
      }
    }
    // topo de escada é piso (↓ passa, para descer por ela)
    if (!h.noChao && !h.seguraBaixo && n.escadas.length) {
      const yt = n.topoEntre(h.x - w / 2 + 2, h.x + w / 2 - 2, yAntes, ny);
      if (yt != null) { ny = yt; h.vy = 0; h.noChao = true; }
    }
  } else {
    const l = Math.floor((ny - hh) / TILE);
    for (let c = c0; c <= c1; c++) if (n.solido(c, l) || n.rampa(c, l)) { ny = (l + 1) * TILE + hh; h.vy = 0; break; }
  }
  h.y = ny;
}
