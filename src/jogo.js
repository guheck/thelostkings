'use strict';

// Mundo = a simulação de uma fase (sem tela). Jogo = entrada, câmera, desenho, HUD, menu e a sequência de fases.
const ORDEM = ['marreta', 'fiapo', 'pudim'];
const HABIL = { marreta: 'E: soco · ↓+E: gancho', fiapo: 'E: corda', pudim: 'E: rola · no ar: bundada' };
// Acabamento (02/10, usuário: "falta alguma polida... pra as coisas se casarem"): poeira dos pés (Mundo.poeira),
// sombra no chão de todo mundo — também no ar, mais fraca e menor quanto mais alto — e o clima da tela (névoa leve na
// paisagem, que fica para trás, e vinheta nos cantos). ?crua desliga tudo (para comparar antes e depois).
// A sombra fica na faixa, logo atrás dos pés (recua): é ali que os pés pisam (na linha da frente ela sumia na madeira).
const POEIRA = { max: 90, cor: '#f6ecd6', linha: '#b49e7e' };
const SOMBRA = { alfa: 0.5, alto: 320, achata: 0.24, recua: 3 };
// (no quarto: a paisagem lá fora atrás do vidro, mais clara; a parede com névoa quente, de luz de dentro de casa)
const CLIMA = { nevoa: 'rgba(226, 242, 244, 0.22)', vidro: 'rgba(232, 244, 248, 0.2)', quarto: 'rgba(250, 242, 228, 0.24)', vinheta: 0.22 };
const TECLAS = {
  ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir', ArrowUp: 'cima', KeyW: 'cima', ArrowDown: 'baixo', KeyS: 'baixo',
  Space: 'pulo', KeyE: 'acao', Enter: 'acao', NumpadEnter: 'acao', Tab: 'troca', KeyQ: 'troca', KeyR: 'reinicia', KeyN: 'nova',
  Escape: 'menu', KeyM: 'mapa',
  Digit1: 's1', Digit2: 's2', Digit3: 's3', Numpad1: 's1', Numpad2: 's2', Numpad3: 's3',
};

// Nuvens do plano da frente (Jogo._nuvens): s = escala do desenho (a grande, nuvem1 de 255 px, sai com ~300 px; a média,
// nuvem2, ~210: no máximo 1,2x o tamanho da imagem, senão borra). Caixa em blocos a partir do meio: meiaLarg para cada
// lado (a nuvem tem ~4; o resto é a folga da paralaxe, até 77 px na beira da tela), cima/baixo; vao = blocos livres
// embaixo dela; passo = um trecho de fase por nuvem; andar = distância na vertical entre duas do mesmo trecho.
const NUVEM = { grande: 2.4, media: 2.1, meiaLarg: 6, cima: 2, baixo: 2, vao: 5, passo: 1100, andar: 640, topo: 200 };

// Coração do HUD (cheio = vida que ainda tem)
function desenhaCoracao(ctx, x, y, r, cheio) {
  Estilo.forma(ctx, (c) => {
    c.beginPath();
    c.moveTo(x, y + r * 0.95);
    c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.75, y - r * 1.25, x, y - r * 0.45);
    c.bezierCurveTo(x + r * 0.75, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.95);
    c.closePath();
  }, { cor: cheio ? '#e8413a' : '#e3d8c6' }, { elev: 0, linha: 2, cel: false });
}

class Mundo {
  // opts.bot: robô que joga; opts.rapido: simulação sem nada visual (para testar fases escondido)
  constructor(def, opts = {}) {
    this.def = def;
    this.nivel = new Nivel(def);
    this.cordas = new Cordas(this.nivel, def.cordas ?? 1);
    this.cordas.rapido = !!opts.rapido;
    this.herois = ORDEM.map((id) => { const s = this.nivel.spawns[id]; return new Heroi(id, s.x, s.y).encaixa(this.nivel); });
    this.cordas.herois = this.herois;
    this.inimigos = [...this.nivel.inimigosDef, ...(def.inimigos || [])].map((d) => new Inimigo(d));
    this.grampos = []; this.bolinhas = [];
    this.rapido = !!opts.rapido;
    this.bot = opts.bot || null;
    this.ativo = 0;
    this.estado = 'jogando';
    this.efeitos = [];
    this.particulas = []; // poeira (Mundo.poeira)
    this.sacode = 0;
    this.parada = 0; // golpe forte: o mundo congela um instante no impacto (como nos jogos de luta)
    this.t = opts.t || 0;
    this.tSala = 0;
    this.tVenceu = null;
    this.log = [];
  }

  get heroi() { return this.herois[this.ativo]; }

  seleciona(i) {
    if (i === this.ativo || this.estado !== 'jogando') return;
    this.ativo = i;
    this.som('troca');
    const h = this.heroi;
    h.diz(FALAS.troca[h.id][Math.floor(this.t * 7) % 3], 0.9);
  }

  // estrela: explosão de impacto atrás do texto (golpe do Marreta)
  fx(texto, x, y, cor, esc = 1, estrela = false) {
    if (!this.rapido) this.efeitos.push({ texto, x, y, cor, esc, estrela, t0: this.t, dur: 0.8 });
    this.registra(texto);
    if (this.somAtivo && typeof Som !== 'undefined') this.som(Som.porTexto(texto));
  }
  // Poeira de papelão (02/10, acabamento — usuário: "falta alguma polida... pequenos efeitos"): bolinhas que saem dos pés
  // e somem crescendo (pulo, pouso, corrida, freada, bundada, carimbo, estojo caindo). Só no mundo da tela (as simulações
  // do robô não desenham). o: n bolinhas, forca (tamanho e velocidade), dir (1/-1: só para esse lado; 0: os dois)
  poeira(x, y, o = {}) {
    if (this.rapido || (typeof Jogo !== 'undefined' && !Jogo.polida) || this.particulas.length > POEIRA.max) return;
    const n = o.n || 4, k = o.forca || 1, dir = o.dir || 0;
    for (let i = 0; i < n; i++) {
      const lado = dir || (i % 2 ? 1 : -1), a = Math.random(), b = Math.random();
      this.particulas.push({ x: x + lado * (3 + a * 10 * k), y: y - 3 - b * 4, vx: lado * (50 + a * 110) * k, vy: -(15 + b * 55) * k,
        r0: (4 + a * 3) * k, r1: (10 + b * 7) * k, t0: this.t, dur: 0.32 + b * 0.22 });
    }
  }
  // som (src/som.js): só no mundo que está na tela (as simulações do robô ficam mudas)
  som(nome, o) { if (this.somAtivo && nome && typeof Som !== 'undefined') Som.toca(nome, o); }
  tremer(q) { this.sacode = Math.max(this.sacode, q); }
  registra(txt) { this.log.push(`${this.tSala.toFixed(2)} ${txt}`); if (this.log.length > 400) this.log.shift(); }

  passo(dt, E) {
    this.sacode = Math.max(0, this.sacode - dt * 30);
    if (this.parada > 0) { this.parada -= dt; return; } // impacto: tudo parado (o robô também espera)
    this.t += dt;
    this.tSala += dt;
    if (this.particulas.length) this.particulas = this.particulas.filter((p) => this.t - p.t0 < p.dur);
    if (this.bot) E = this.bot.passo(this, dt);
    if (this.estado === 'jogando') {
      if (E.troca) this.seleciona((this.ativo + 1) % 3);
      if (E.sel != null) this.seleciona(E.sel);
    }
    const falasAntes = this.herois.map((h) => h.fala && h.fala.texto);
    this.herois.forEach((h, i) => h.atualiza(dt, i === this.ativo && this.estado === 'jogando' ? E : null, this));
    this.herois.forEach((h, i) => {
      if (!h.fala || h.fala.texto === falasAntes[i] || h.fala.t !== 0) return;
      this.registra(`${h.id}: ${h.fala.texto}`);
      this.som('voz', { id: h.id, n: h.fala.texto.length, txt: h.fala.texto });
    });
    this.cordas.atualiza(dt, this.herois);
    for (const k of this.nivel.carimbos) k.atualiza(dt, this); // (antes dos inimigos: achatado na descida é PLAFT!)
    for (const o of this.inimigos) o.atualiza(dt, this);
    for (const r of this.nivel.durex) r.atualiza(dt, this);
    for (const e of this.nivel.estojos) e.atualiza(dt, this);
    for (const r of this.nivel.trenas) r.atualiza(dt, this);
    for (const g of this.nivel.gangorras) g.atualiza(dt, this);
    for (const p of this.nivel.postits) p.atualiza(dt, this);
    this._grampos(dt);
    this._bolinhas(dt);
    this._contato();
    const caiu = this.estado === 'jogando' && this.herois.find((h) => h.estado === 'caido');
    if (caiu) { // sem coração: a fase recomeça (os três precisam chegar)
      this.estado = 'perdeu';
      this.tPerdeu = this.t;
      this.registra(`PERDEU: ${caiu.id} sem coração`);
      this.som('derrota');
    }
    this.nivel.atualizaCanais(dt, this.herois, this.inimigos, this);
    this._chaves();
    this._rolos();
    this._pontos();
    this.nivel.atualiza(dt);
    this._saida();
    if (this.efeitos.length) this.efeitos = this.efeitos.filter((e) => this.t - e.t0 < e.dur);
  }

  // Encostar em inimigo machuca (tira um coração e volta ao último lugar seguro). Amigo arremessado: o Pudim (pesado)
  // derruba; o Fiapo se machuca. A régua do escudeiro de frente não machuca: empurra.
  _contato() {
    for (const o of this.inimigos) {
      if (!o.vivo) continue;
      const ox0 = o.x - o.cfg.w / 2 + 4, ox1 = o.x + o.cfg.w / 2 - 4, oy0 = o.y - o.cfg.h + 4, oy1 = o.y;
      for (const h of this.herois) {
        if (h.estado === 'machucado' || h.estado === 'caido') continue;
        const b = h.caixa();
        if (b.x1 < ox0 || b.x0 > ox1 || b.y1 < oy0 || b.y0 > oy1) continue;
        // o blindado (a lata) é parede que anda: encostar empurra (não machuca) e ninguém atravessa — nem piscando, logo
        // depois de um dano (01/10: o Fiapo levava 1 coração no blindado e passava por ele piscando; a trena perdia a razão)
        if (o.cfg.blindado && h.estado !== 'arremessado') {
          const sai = Math.sign(h.x - o.x) || -o.f;
          if (Math.sign(h.vx) !== sai) o.clang(this);
          h.vx = sai * (h.estado === 'rolando' ? 240 : 420); h.empurrado = 0.3; o.tEmpurrou = this.t;
          continue;
        }
        if (h.pisca > 0) continue;
        if (h.estado === 'arremessado') {
          if (h.id !== 'pudim') { if (o.especie !== 'grampeador') h._machuca(this); } // o Fiapo é leve: quem apanha é ele
          else if (o.escudoPara(h.x)) { h.vx = -h.vx * 0.3; this.fx('TOC!', o.x, o.y - 70, '#e9c77a'); o.tBloqueio = this.t; }
          else if (o.cfg.blindado) { o.clang(this); h.vx = -h.vx * 0.3; } // (a lata)
          else if (o.especie !== 'grampeador') { o.derrota(Math.sign(h.vx) * 380, this, 'PAF!'); h.vx *= 0.3; }
          continue;
        }
        // boliche (01/10, equilíbrio — usuário: "o Pudim tá muito forte... sai rolando, invulnerável, mata todos"): a bola
        // não derruba mais ninguém. Quem está desarmado (o guarda com o lápis quebrado, o tesoureiro preso, quem é pego
        // pelas costas, a lixeira, quem já está zonzo) leva um empurrão e fica zonzo; quem derruba é o Marreta. De frente,
        // a ponta fura a bola: o lápis do guarda e a tesoura machucam o Pudim (escudo ele é em pé, com a barriga). Régua
        // de frente e grampeador (metal) seguram; a borracha devolve.
        if (h.estado === 'rolando') {
          const esp = o.especie, volta = -(Math.sign(o.x - h.x) || 1), costas = Math.sign(h.x - o.x) !== o.f;
          const desarmado = (esp === 'guarda' && (o.tonto > 0 || costas)) || (esp === 'tesoureiro' && (o.preso > 0 || costas))
            || (esp === 'escudeiro' && !o.escudoPara(h.x)) || esp === 'lixeira' || o.zonzo > 0;
          if (!desarmado && (esp === 'guarda' || esp === 'tesoureiro')) {
            this.fx(esp === 'guarda' ? 'TUC!' : 'TSC!', (h.x + o.x) / 2, o.y - 50, '#e9e9f0', 0.9);
            h._machuca(this);
            continue;
          }
          if (Math.sign(h.vx) !== volta) { // uma batida só
            const borracha = esp === 'borracha';
            if (o.cfg.blindado) o.clang(this);
            else this.fx(desarmado ? 'BUM!' : borracha ? 'BOING' : 'TOC!', (h.x + o.x) / 2, o.y - 50, borracha ? '#f28aa0' : '#e9c77a', 0.9);
            if (desarmado) o.atordoa(this, 3, '', -volta * 320);
            else { o.tBloqueio = this.t; if (borracha) o.tQuica = this.t; }
          }
          h.vx = volta * (esp === 'borracha' ? 420 : 240);
          continue;
        }
        if (h.id === 'pudim' && o.especie === 'borracha') { // borracha quica na barriga
          o.f = Math.sign(o.x - h.x) || -o.f;
          o.x = h.x + o.f * (h.cfg.w / 2 + o.cfg.w / 2 + 2);
          if (this.t - o.tQuica > 0.3) this.fx('BOING', o.x, o.y - 44, '#f28aa0', 0.8); // (presa contra a parede quica sem parar)
          o.tQuica = this.t;
          continue;
        }
        if (o.especie === 'grampeador' || o.especie === 'lixeira') continue; // encostar não machuca; o que eles atiram, sim
        if (o.escudoPara(h.x)) { // régua de frente: empurra (perto de buraco, cai)
          h.vx = (Math.sign(h.x - o.x) || -o.f) * 420; h.empurrado = 0.3; o.tEmpurrou = this.t;
          if (this.t - o.tEmpurra > 0.4) { this.fx('TUM!', (h.x + o.x) / 2, o.y - 60, '#e9c77a', 0.8); o.tEmpurra = this.t; }
          continue;
        }
        if (o.tonto > 0 || o.preso > 0 || o.zonzo > 0) continue; // guarda tonto apontando o lápis, tesoureiro preso, zonzo: não atacam
        h._machuca(this);
      }
    }
  }

  // Grampos voando: machucam; no Pudim quicam de volta e aí derrubam quem atirou
  _grampos(dt) {
    for (const g of this.grampos) {
      g.x += g.vx * dt; g.vida -= dt;
      if (this.nivel.solidoEm(g.x, g.y) || this.nivel.noEstojo(g.x, g.y)) { g.vida = 0; continue; }
      if (g.rebatido) {
        for (const o of this.inimigos) {
          if (o.vivo && Math.abs(o.x - g.x) < o.cfg.w / 2 + 6 && g.y > o.y - o.cfg.h - 6 && g.y < o.y + 2) {
            o.derrota(Math.sign(g.vx) * 300, this, o.especie === 'grampeador' ? 'CRÁS!' : 'PAF!');
            g.vida = 0;
            break;
          }
        }
        continue;
      }
      for (const h of this.herois) {
        if (h.estado === 'machucado') continue;
        const b = h.caixa();
        if (g.x < b.x0 || g.x > b.x1 || g.y < b.y0 || g.y > b.y1) continue;
        if (h.id === 'pudim') {
          g.vx = -g.vx; g.rebatido = true; g.x += Math.sign(g.vx) * 12;
          this.fx('PLIN!', g.x, g.y - 22, '#ffd23f', 0.9);
        } else if (h.pisca <= 0) { h._machuca(this); g.vida = 0; }
        break;
      }
    }
    if (this.grampos.length) this.grampos = this.grampos.filter((g) => g.vida > 0);
  }

  // Bolinhas de papel da lixeira: arco (gravidade própria); somem na parede; machucam; na barriga do Pudim quicam para
  // cima; rebatidas pelo Marreta voltam em arco e derrubam quem pegarem (na lixeira dona: CESTA!)
  _bolinhas(dt) {
    const L = LIXEIRA;
    for (const b of this.bolinhas) {
      b.vy += L.g * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.vida -= dt; b.giro += b.vx * dt / L.raio;
      if (this.nivel.solidoEm(b.x, b.y) || this.nivel.noEstojo(b.x, b.y) || b.y > this.nivel.altura + 50) { b.vida = 0; this.fx('puf', b.x, b.y - 10, '#fffdf6', 0.6); continue; }
      if (b.rebatida) {
        for (const o of this.inimigos) {
          const k = o.caixa();
          if (!o.vivo || b.x < k.x0 - L.raio || b.x > k.x1 + L.raio || b.y < k.y0 - L.raio || b.y > k.y1 + L.raio) continue;
          o.derrota(Math.sign(b.vx) * 260, this, o === b.dono ? 'CESTA!' : 'PAF!', -420);
          if (o === b.dono) { // caiu dentro: tranco (mundo parado um instante) e tomba para trás, caindo da prateleira
            Object.assign(o.morte, { cesta: true, vx: Math.sign(b.vx) * 110, vy: -260, vr: Math.sign(b.vx) * 4 });
            this.parada = Math.max(this.parada || 0, 0.1);
          }
          b.vida = 0;
          break;
        }
        continue;
      }
      for (const h of this.herois) {
        if (!alvoDoGuarda(h)) continue;
        const c = h.caixa();
        if (b.x < c.x0 - L.raio || b.x > c.x1 + L.raio || b.y < c.y0 - L.raio || b.y > c.y1 + L.raio) continue;
        if (h.id === 'pudim') { // barriga: quica para cima
          b.vx = -b.vx * 0.3; b.vy = -560; b.y = c.y0 + h.cfg.h * 0.3; h.squash = 0.3;
          this.fx('BOING', b.x, b.y - 16, '#fffdf6', 0.8);
        } else { h._machuca(this); this.fx('PAF!', b.x, b.y, '#fffdf6', 0.9); b.vida = 0; }
        break;
      }
    }
    if (this.bolinhas.length) this.bolinhas = this.bolinhas.filter((b) => b.vida > 0);
  }

  // Chave: quem passa por cima pega; encostar na porta da mesma cor abre
  _chaves() {
    for (const k of this.nivel.chaves) {
      if (k.usada) continue;
      if (k.portador) { const h = k.portador; k.x = h.x + h.f * 16; k.y = h.y - h.cfg.h - 18; continue; }
      for (const h of this.herois) {
        if (h.chave || h.estado === 'machucado') continue;
        if (Math.abs(h.x - k.x) < 32 && k.y > h.y - h.cfg.h - 10 && k.y < h.y + 12) {
          k.portador = h; h.chave = k;
          h.diz(`Chave ${NOME_COR[k.cor]}!`);
          this.fx('PLIM!', k.x, k.y - 24, CORES_CHAVE[k.cor]);
          break;
        }
      }
    }
    for (const p of this.nivel.portas) {
      if (!p.fechado) continue;
      const x0 = p.c * TILE - 10, x1 = p.c1 * TILE + 10, y0 = p.l0 * TILE, y1 = p.l1 * TILE;
      for (const h of this.herois) {
        if (!h.chave || h.chave.cor !== p.cor) continue;
        if (h.x + h.cfg.w / 2 > x0 && h.x - h.cfg.w / 2 < x1 && h.y > y0 && h.y - h.cfg.h < y1) {
          this.nivel.abrePorta(p);
          h.chave.usada = true; h.chave.portador = null; h.chave = null;
          this.fx('CLIC!', (x0 + x1) / 2, y0 - 10, CORES_CHAVE[p.cor]);
          h.diz('Abriu!');
        }
      }
    }
  }

  // Ponto de controle (bandeirinha, 'K'): o primeiro herói de pé que encosta pega; o Jogo guarda a fase inteira
  _pontos() {
    for (const p of this.nivel.pontos) {
      if (p.pego) continue;
      const h = this.herois.find((q) => !['machucado', 'caido', 'arremessado'].includes(q.estado) && Math.abs(q.x - p.x) < 34 && q.y > p.y - 60 && q.y <= p.y + 4);
      if (!h) continue;
      p.pego = true;
      this.pontoNovo = p;
      this.fx('PONTO SALVO!', p.x, p.y - 130, '#3fb56a', 1.1);
      this.som('chegou');
    }
  }

  // Rolo de barbante no caminho: o Fiapo pega e ganha mais uma corda
  _rolos() {
    const f = this.herois.find((h) => h.id === 'fiapo');
    for (const r of this.nivel.rolos) {
      if (r.pego || Math.abs(f.x - r.x) > 30 || Math.abs(f.y - r.y) > 40) continue;
      r.pego = true;
      this.cordas.estoque++;
      f.diz('Mais barbante!');
      this.fx('+1 CORDA', r.x, r.y - 50, '#c89a5b');
    }
  }

  // Chegou quem está de pé no tapete da saída (a porta e um bloco de cada lado: Nivel.zonaSaida)
  _saida() {
    const s = this.nivel.saida, z = this.nivel.zonaSaida();
    let dentro = 0;
    for (const h of this.herois) {
      const antes = h.dentro;
      h.dentro = h.noChao && h.x > z.x0 && h.x < z.x1 && h.y > s.y0 + 10 && h.y <= s.y1 + 2;
      if (h.dentro && !antes && this.estado === 'jogando') this.som('chegou');
      if (h.dentro) dentro++;
    }
    if (this.estado === 'jogando' && dentro === 3) {
      this.estado = 'venceu';
      this.tVenceu = this.t;
      this.herois.forEach((h, i) => { h.muda('festa'); h.diz(['Passamos!', 'Eeeba!', 'Ufa...'][i], 1.6); });
      this.registra('VENCEU');
      this.som('vitoria');
    }
  }

  // Tecla sugerida em cima do personagem ativo quando há algo para fazer ali
  dicaTecla(h) {
    if (this.estado !== 'jogando') return null;
    const c = this.cordas, n = this.nivel;
    if (h.estado === 'escalando' || h.estado === 'escada') return '↑ ↓';
    if (h.estado !== 'chao' || !h.noChao) return null;
    if (n.alavancaPerto(h)) return 'E alavanca';
    const esc = n.escadaEm(h), topo = n.topoEscada(h);
    if (esc) return n.cabeNaEscada(h, esc) ? '↑ sobe' : 'só o Fiapo cabe';
    if (topo && n.cabeNaEscada(h, topo)) return '↓ desce';
    if (h._linhaAlcance(this) || h._linhaPerto(this)) return '↑ sobe';
    if (c.linhas().some((L) => !(L.anc !== h && L.corda.usaHeroi(h)) && h.podeDescer(L))) return '↓ desce';
    if (h.id === 'fiapo') {
      const car = c.carregada();
      if (car) {
        const anc = car.ancoraPerto(h, this.herois), p = car.A.pino;
        if (anc) return car.mesma(anc, car.A) ? 'E recolhe' : 'E amarra';
        return p && Math.abs(h.y - p.y) <= 20 && Math.abs(h.x - p.x) <= PERTO_LARGA && car._linhaPendurada() ? 'E larga a corda' : null;
      }
      for (const q of c.lista) {
        if (q.pertoDaPonta(h)) return 'E pega';
        const anc = q.ancoraPerto(h, this.herois);
        if (anc && q.mesma(anc, q.A) && q.estado === 'solta') return 'E recolhe';
        if (anc && (q.mesma(anc, q.A) || q.mesma(anc, q.B))) return 'E desamarra';
      }
      if (c.estoque > 0 && (this._teste || (this._teste = new CordaJogo(n))).ancoraPerto(h, this.herois)) return 'E amarra';
      return null;
    }
    if (h.id === 'marreta') {
      const ini = h.inimigoNaFrente(this.inimigos);
      if (ini) return ini.escudoPara(h.x) ? 'régua: ↓+E gancho!' : 'E soco';
      if (h.alvoGancho(this.herois, 'gancho')) return 'E: longe · ↓+E: alto';
      if (h.alvoGancho(this.herois, 'soco')) return 'E: longe · (↓+E: mais perto)';
      if (h.rachadoNaFrente(n)) return 'E soco';
      return null;
    }
    // Pudim: E no chão rola, E no ar (pulando) é bundada
    const l = Math.floor((h.y + 1) / TILE);
    for (let cc = Math.floor((h.x - h.cfg.w / 2 + 2) / TILE); cc <= Math.floor((h.x + h.cfg.w / 2 - 2) / TILE); cc++) {
      if (n.tile(cc, l) === 'F') return 'pule + E: bundada';
    }
    const cf = Math.floor((h.x + h.f * (h.cfg.w / 2 + 16)) / TILE), lp = l - 1;
    if (!n.solido(cf, lp) && !n.solido(cf, lp - 1) && n.solido(cf, lp - 2)) return 'E rola (duto)';
    // a bola só derruba desarmado; a borracha devolve a bola: bundada
    const perto = this.inimigos.filter((o) => o.vivo && Math.abs(o.x - h.x) < 220 && Math.abs(o.y - h.y) < 50);
    if (perto.some((o) => o.especie === 'borracha')) return 'pule + E: bundada';
    if (perto.some((o) => (o.especie === 'guarda' && o.tonto > 0) || (o.especie === 'tesoureiro' && o.preso > 0)
      || (o.especie === 'escudeiro' && !o.escudoPara(h.x)))) return 'E rola: derruba!';
    return null;
  }
}

// ---------------------------------------------------------------------------
const Jogo = {
  W: 1280, H: 720, PASSO: 1 / 120,
  idx: 0, m: null, def: null, t: 0, acum: 0, modo: 'menu',
  teclas: {}, bordas: {}, cache: null, cortina: null, intro: 1, recorde: 0, semente: 1, salva: true,
  polida: typeof location === 'undefined' || !new URLSearchParams(location.search).has('crua'), // acabamento (POEIRA, SOMBRA, CLIMA)
  cam: { x: 0, y: 0, z: 1 }, mapa: false,

  // Sai do menu e começa a jogar a fase i
  inicia(i) {
    this.modo = 'jogo';
    this.intro = i === 0 ? 1 : 0;
    this.cortina = null;
    this.teclas = {};
    this.carrega(i);
  },

  // Fases 1-3 são feitas à mão (tutorial); da 4 em diante saem do gerador
  defSala(i) {
    if (i < SALAS.length) return Object.assign({ roteiro: ROTEIROS[i] }, SALAS[i]);
    const d = Gerador.sala(i + 1, this.semente);
    return d || Object.assign({ roteiro: ROTEIROS[i % SALAS.length] }, SALAS[i % SALAS.length]);
  },

  carrega(i, def) {
    this.idx = i;
    this.ponto = null; // (fase do começo: sem ponto de controle)
    this.def = def || this.defSala(i);
    let roteiro = this.def.roteiro;
    if (this.alt != null && ROTEIROS_ALT[this.alt] && ROTEIROS_ALT[this.alt].sala === i) roteiro = ROTEIROS_ALT[this.alt].r;
    this.m = new Mundo(this.def, { bot: this.demo && roteiro ? new Bot(roteiro) : null, t: this.t });
    this.m.somAtivo = true;
    this.cache = null;
    this.mapa = false;
    this.atualizaCamera(0, true);
    if (this.salva) Progresso.entrou(i, this.def.nome);
  },

  // Ponto de controle (30/09, usuário: "tem que salvar o status de quando você passou no checkpoint: as alavancas já
  // apertadas, os itens já usados"): a fase volta a ser a cópia guardada quando pegou a bandeirinha — os três onde
  // estavam, corações, alavancas, portões, portas, chaves, cordas, paredes quebradas, inimigos. A cópia fica guardada
  // (dá para voltar de novo).
  voltaAoPonto() {
    this.m = this.clona(this.ponto);
    this.m.somAtivo = true;
    this.m.fx('DE VOLTA AO PONTO!', this.m.heroi.x, this.m.heroi.y - 150, '#3fb56a', 1.1);
    this.cache = null;
    this.mapa = false;
    this.atualizaCamera(0, true);
  },
  // Cópia funda do mundo: cada objeto e lista copiados, com a mesma classe e as mesmas ligações entre eles (quem segura
  // a corda, de quem é a bolinha, o portão que está no mapa e na lista); o que não muda no jogo fica o mesmo: a
  // definição da fase, os personagens (Cast), imagens, canvas e objetos do navegador
  clona(m) {
    const comum = new Set([m.def, ...Object.values(Cast), ...Object.values(CFG), BOLA, ...Object.values(CFG_INIMIGO)]), vistos = new Map(), nativo = /\[native code\]/;
    const copia = (o) => {
      if (o === null || typeof o !== 'object') return o;
      if (vistos.has(o)) return vistos.get(o);
      if (comum.has(o)) return o;
      let c;
      if (Array.isArray(o)) { c = []; vistos.set(o, c); for (const x of o) c.push(copia(x)); return c; }
      if (o instanceof Map) { c = new Map(); vistos.set(o, c); for (const [k, v] of o) c.set(copia(k), copia(v)); return c; }
      if (o instanceof Set) { c = new Set(); vistos.set(o, c); for (const v of o) c.add(copia(v)); return c; }
      if (ArrayBuffer.isView(o)) { c = o.slice(); vistos.set(o, c); return c; }
      const k = o.constructor;
      if (typeof k === 'function' && k !== Object && nativo.test(Function.prototype.toString.call(k))) return o; // (canvas, imagem...)
      c = Object.create(Object.getPrototypeOf(o)); vistos.set(o, c);
      for (const q of Object.keys(o)) c[q] = copia(o[q]);
      return c;
    };
    return copia(m);
  },

  // Câmera: segue quem você controla e olha um pouco para a frente; no mapa (M) mostra a fase inteira
  atualizaCamera(dt, pula = false) {
    const n = this.m.nivel, h = this.m.heroi, cam = this.cam;
    const zAlvo = this.mapa ? Math.min(1, this.W / n.largura, (this.H - 60) / n.altura) : 1;
    cam.z = pula ? zAlvo : cam.z + (zAlvo - cam.z) * Math.min(1, dt * 7);
    const vw = this.W / cam.z, vh = this.H / cam.z;
    let tx, ty;
    if (this.mapa) { tx = (n.largura - vw) / 2; ty = (n.altura - vh) / 2 - 30 / cam.z; }
    else {
      tx = n.largura <= vw ? (n.largura - vw) / 2 : U.clamp(h.x + h.f * 140 - vw / 2, 0, n.largura - vw);
      ty = n.altura <= vh ? (n.altura - vh) / 2 : U.clamp(h.y - 70 - vh / 2, 0, n.altura - vh);
    }
    const k = pula ? 1 : Math.min(1, dt * (this.mapa ? 7 : 5));
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  },

  // entrada do quadro: teclas seguradas + toques (bordas) consumidos uma vez
  entrada() {
    const k = this.teclas, b = this.bordas;
    const E = {
      esq: !!k.esq, dir: !!k.dir, cima: !!k.cima, baixo: !!k.baixo,
      pulo: !!b.pulo, pulaCima: !!b.cima, acao: !!b.acao, troca: !!b.troca, reinicia: !!b.reinicia, nova: !!b.nova,
      sel: b.s1 ? 0 : b.s2 ? 1 : b.s3 ? 2 : null, mapa: !!b.mapa,
      menu: !!b.menu, bCima: !!b.cima, bBaixo: !!b.baixo, bEsq: !!b.esq, bDir: !!b.dir, // toques (para o menu)
    };
    this.bordas = {};
    return E;
  },

  passo(dt, E) {
    this.t += dt;
    if (E.mapa) this.mapa = !this.mapa;
    if (E.menu && this.mapa) { this.mapa = false; return; }
    if (E.menu && !this.demo) { Menu.abre(this); return; }
    if (E.reinicia) { if (this.ponto) this.voltaAoPonto(); else this.carrega(this.idx, this.def); return; }
    if (E.nova && !this.cortina) { this.cortina = this.avulsa ? { t0: this.t, prox: this.idx, def: this.def, trocou: false } : { t0: this.t, prox: this.idx + 1, trocou: false }; }
    if (this.mapa && !this.demo) return; // mapa aberto: jogo parado para planejar
    if (E.esq || E.dir || E.pulo || E.acao || E.troca) this.intro = Math.min(this.intro, 0.99);
    if (this.intro < 1) this.intro = Math.max(0, this.intro - dt * 2);
    this.m.passo(dt, E);
    const m = this.m;
    if (m.pontoNovo) { m.pontoNovo = null; this.ponto = this.clona(m); } // pegou a bandeirinha: guarda a fase como está
    if (m.estado === 'venceu' && m.t - m.tVenceu > 1.9 && !this.cortina) {
      // fase avulsa (?fase=): vencer recomeça a mesma — ou vai para a seguinte de uma sequência (a demo publicada:
      // depoisDaFase devolve { idx, def }, ou 'fim' e a página mostra o fim, com o jogo parado)
      const seg = this.avulsa && this.depoisDaFase ? this.depoisDaFase(this.idx) : null;
      if (seg === 'fim') return;
      this.cortina = seg ? { t0: this.t, prox: seg.idx, def: seg.def, trocou: false }
        : this.avulsa ? { t0: this.t, prox: this.idx, def: this.def, trocou: false } : { t0: this.t, prox: this.idx + 1, trocou: false };
      if (this.salva) Progresso.venceu(this.idx);
      this.recorde = Math.max(this.recorde, this.idx + 1);
    }
    if (m.estado === 'perdeu' && m.t - m.tPerdeu > 2.4 && !this.cortina) this.cortina = { t0: this.t, prox: this.idx, def: this.def, trocou: false, ponto: !!this.ponto };
    const c = this.cortina;
    if (c && !c.trocou && this.t - c.t0 >= 0.5) { c.trocou = true; if (c.ponto) this.voltaAoPonto(); else this.carrega(c.prox, c.def); }
    if (c && this.t - c.t0 >= 1.0) this.cortina = null;
  },

  // Fase do editor: fases/<nome>.json, "~" = a que o editor mandou jogar agora (guardada no localStorage) ou
  // "minha:<id>" = uma das Minhas fases (src/minhas.js)
  async leFase(nome) {
    try {
      if (nome === '~') return JSON.parse(localStorage.getItem('lostkings-editor'));
      if (nome.startsWith('minha:')) return typeof MinhasFases !== 'undefined' ? MinhasFases.le(nome.slice(6)) : null;
      const r = await fetch(`fases/${encodeURIComponent(nome)}.json`, { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  },

  // ---------------------------------------------------------------------------
  _fundo() {
    const n = this.m.nivel, quarto = this.polida; // (o quarto: a parede com janela e estantes na frente da paisagem)
    const tela = (w, h) => {
      const c = document.createElement('canvas'); c.width = Math.ceil(w * this.escala); c.height = Math.ceil(h * this.escala);
      c._nativa = true; // (montado na resolução da tela: a conferência de resolução mede o que vai nele)
      const g = c.getContext('2d'); g.setTransform(this.escala, 0, 0, this.escala, 0, 0); return [c, g];
    };
    const p = quarto ? QUARTO.longe : 0.2, dx = Math.max(0, n.largura - this.W), dy = Math.max(0, n.altura - this.H);
    const bw = this.W + dx * p + 40, bh = this.H + dy * p + 40;
    const [c, g] = tela(bw, bh);
    const [c1, c2, c3] = Cenario.coresColina(), f1 = 1.0 + this.m.def.nome.length;
    // no quarto, a crista do meio cai a 55% da altura do vidro com a câmera no meio da fase (a paisagem e a parede
    // andam em velocidades diferentes: subindo e descendo, o horizonte passeia pela janela)
    const pw = this.W + dx * 0.2 + 40, ph = this.H + dy * 0.2 + 40, plano = quarto && Cenario.planoQuarto(pw, ph);
    const meio = plano ? plano.jt + 0.55 * plano.jh - 0.08 * dy * 0.5 : bh - 240;
    Cenario.ceu(g, bw, bh); // (o sol vai em Jogo.desenha: quase parado na tela, como um sol de verdade)
    Cenario.colina(g, bw, bh, meio - 60, 26, 0.006, f1, c1, 2);
    Cenario.enfeites(g, bw, meio - 60, 26, 0.006, f1, 11, 50, ['arvore1', 'arvore2', 'arvores'], 230);
    for (let x = 700; x < bw; x += 1400) Cenario.castelo(g, x, meio - 50, 0.55);
    Cenario.colina(g, bw, bh, meio, 22, 0.009, 2.2, c2, 3);
    Cenario.enfeites(g, bw, meio, 22, 0.009, 2.2, 23, 86, ['arvore1', 'arvores', 'arvore2', 'arbusto1', 'arbustos'], 300);
    Cenario.colina(g, bw, bh, meio + 80, 16, 0.012, 4.0, c3, 4);
    Cenario.enfeites(g, bw, meio + 80, 16, 0.012, 4.0, 37, 46, ['arbusto1', 'arbusto2', 'arbustos', 'tufo'], 220);
    // (as nuvens saíram da paisagem: ficam no plano da frente, Jogo._nuvens)
    if (!quarto) return { c, bw, bh, nuvens: this._nuvens() };
    // a parede (a 0,2 da câmera) com os vidros furados; o sol lá fora, onde a 1ª janela fica com a câmera no meio da fase
    const [parede, pg] = tela(pw, ph);
    const v0 = Cenario.quarto(pg, pw, ph)[0];
    Cenario.sol(g, v0.x1 - 110 - dx * 0.04, Math.max(70, meio - 190), 40, 0);
    return { c, bw, bh, parede, pw, ph, nuvens: this._nuvens() };
  },

  // Nuvens no plano da frente (30/09, usuário: "ficariam mais legais se viessem para frente", "mais em cima, no lugar
  // mais livre"), andando um pouco mais rápido que a câmera (1,12x, em volta do meio da tela).
  // 01/10 (usuário: "o fio termina e não está amarrado em lugar nenhum... tem que esticar até o topo da tela sempre";
  // "parece em lugares aleatórios"; "nuvens maiores"): o fio vai sempre até o alto da tela (está no plano da frente:
  // passa na frente das plataformas, preso lá em cima, fora da vista). Antes ia até o "teto" achado no mapa, mas a
  // paralaxe tirava a nuvem de baixo dele e o fio acabava no ar. Lugar, por regra (NUVEM): a nuvem grande inteira
  // (com a folga da paralaxe) em ar livre, longe de qualquer coisa de jogo (objetos, inimigos, saída, estante) e com
  // NUVEM.vao blocos livres embaixo (fora do alcance do pulo de quem anda no chão de baixo); em cada trecho de
  // NUVEM.passo px, a mais alta que couber — fica no céu de cima, não colada no chão.
  _nuvens() {
    const n = this.m.nivel, T = TILE, N = NUVEM, livre = (c, l) => l < 0 || (c >= 0 && c < n.cols && l < n.lins && n.grade[l][c] === '.');
    const pontos = [...n.pinos, ...n.controles, ...n.chaves, ...n.rolos, ...n.pontos, ...n.durex, ...n.gangorras, ...n.postits,
      ...n.inimigosDef, ...Object.values(n.spawns)];
    const coisas = [
      ...pontos.map((p) => [p.x - 70, p.y - 170, p.x + 70, p.y + 10]),
      ...n.carimbos.map((k) => [k.x - 80, k.teto - 10, k.x + 80, k.chao + 10]),
      ...n.estantes.map((e) => [e.x0 - 20, e.y0 - 20, e.x1 + 20, e.y1 + 10]),
      [n.saida.x0 - 40, n.saida.y0 - 60, n.saida.x1 + 40, n.saida.y1 + 10],
    ];
    const cabe = (c, l) => { // l = a linha do meio da nuvem
      const c0 = c - N.meiaLarg, c1 = c + N.meiaLarg, l0 = l - N.cima, l1 = l + N.baixo + N.vao;
      for (let q = l0; q <= l1; q++) for (let k = c0; k <= c1; k++) if (!livre(k, q)) return false;
      const x0 = c0 * T, x1 = (c1 + 1) * T, y0 = l0 * T, y1 = (l + N.baixo + 1) * T;
      return !coisas.some(([a, b, d, e]) => a < x1 && d > x0 && b < y1 && e > y0);
    };
    // (de cima para baixo: a primeira que cabe no trecho e, mais embaixo, outra a cada N.andar px — o céu de cada andar)
    const lista = [], perto = (x, y) => lista.some((o) => Math.abs(o.x - x) < N.passo * 0.7 && Math.abs(o.y - y) < N.andar);
    for (let x0 = 0; x0 < n.largura; x0 += N.passo) {
      // (o topo dela a N.topo px do alto da fase, no mínimo: com a câmera lá em cima, a paralaxe a sobe para trás do HUD)
      for (let l = N.cima + Math.ceil(N.topo / T); l < n.lins - N.baixo - N.vao; l++) {
        for (let c = Math.floor(x0 / T) + N.meiaLarg; c < Math.floor((x0 + N.passo) / T) - N.meiaLarg; c++) {
          const x = (c + 0.5) * T, y = (l + 0.5) * T;
          if (perto(x, y) || !cabe(c, l)) continue;
          const i = lista.length, grande = i % 2 === 0;
          lista.push({ x, y, s: grande ? N.grande : N.media, tipo: grande ? 0 : 1, fase: i * 1.7 });
          break;
        }
      }
    }
    return lista;
  },

  desenha(ctx) {
    const W = this.W, H = this.H, t = this.t, m = this.m, n = m.nivel, cam = this.cam, z = cam.z;
    if (!this.cache) this.cache = { fundo: this._fundo() };
    ctx.save();
    ctx.fillStyle = '#b8e0dc';
    ctx.fillRect(0, 0, W, H);
    const f = this.cache.fundo;
    if (z > 0.9 && f.parede) { // o quarto: a paisagem pela janela (mais longe, mais devagar), a parede, a névoa
      const cx = Math.max(0, cam.x), cy = Math.max(0, cam.y);
      ctx.drawImage(f.c, -cx * QUARTO.longe, -cy * QUARTO.longe - 20, f.bw, f.bh);
      ctx.fillStyle = CLIMA.vidro; ctx.fillRect(0, 0, W, H); // (lá fora, atrás do vidro)
      ctx.drawImage(f.parede, -cx * 0.2, -cy * 0.2 - 20, f.pw, f.ph);
      ctx.fillStyle = CLIMA.quarto; ctx.fillRect(0, 0, W, H); // a parede um pouco para trás
    } else if (z > 0.9) { // paralaxe: o fundo anda mais devagar (as nuvens com ele)
      const ox = -Math.max(0, cam.x) * 0.2, oy = -Math.max(0, cam.y) * 0.2 - 20;
      ctx.drawImage(f.c, ox, oy, f.bw, f.bh);
      if (this.polida) { ctx.fillStyle = CLIMA.nevoa; ctx.fillRect(0, 0, W, H); } // a paisagem um pouco para trás
      // o sol, longe de tudo, quase não anda: fica no canto de cima em qualquer andar (preso à paisagem, numa fase alta
      // como a Mesa ele sumia lá embaixo ou aparecia no meio da tela lá em cima)
      Cenario.sol(ctx, W - 130 - Math.max(0, cam.x) * 0.02, 130 - Math.max(0, cam.y) * 0.01, 40, 0);
    }
    else { // no mapa: a paisagem (ou o quarto) cobrindo a tela, com um véu claro por cima para a fase aparecer
      const F = f.parede ? { c: f.parede, w: f.pw, h: f.ph } : { c: f.c, w: f.bw, h: f.bh }, s = Math.max(W / F.w, H / F.h);
      if (f.parede) ctx.drawImage(f.c, (W - f.bw * s) / 2, H - f.bh * s, f.bw * s, f.bh * s);
      ctx.drawImage(F.c, (W - F.w * s) / 2, H - F.h * s, F.w * s, F.h * s);
      if (!f.parede) Cenario.sol(ctx, W - 130, 130, 40, 0);
      ctx.fillStyle = 'rgba(236, 246, 244, 0.42)'; ctx.fillRect(0, 0, W, H);
    }
    if (m.sacode > 0) ctx.translate((Math.random() - 0.5) * m.sacode, (Math.random() - 0.5) * m.sacode);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);
    const v = { x0: cam.x, y0: cam.y, x1: cam.x + W / z, y1: cam.y + H / z, par: z > 0.95 }; // par: com paralaxe
    if (z < 0.95) this._fixoMapa(ctx, n); else n.desenhaFixo(ctx, v);
    // tudo o que se mexe é desenhado PROF.pisa px para dentro do tampo (02/10; o desenhaVivo escolhe o que vai junto)
    ctx.save(); ctx.translate(0, -PROF.pisa);
    if (this.polida && z > 0.95) this._sombras(ctx, m, n, v); // no chão, por baixo de tudo o que se mexe
    ctx.restore();
    n.desenhaVivo(ctx, t, m.herois.map((h) => !!h.dentro), v);
    ctx.save(); ctx.translate(0, -PROF.pisa);
    m.cordas.desenha(ctx);
    for (const o of m.inimigos) if (o.x > v.x0 - 120 && o.x < v.x1 + 120) o.desenha(ctx, m.t); // tempo do mundo (bloqueou, empurrou...)
    // o estojo, não: é como o papelão (a tampa dele é desenhada atrás dos pés, como a faixa) e no fosso vira chão
    ctx.restore(); n.desenhaEstojos(ctx, v); ctx.save(); ctx.translate(0, -PROF.pisa);
    for (const g of m.grampos) desenhaGrampo(ctx, g);
    for (const b of m.bolinhas) desenhaBolinha(ctx, b);

    // personagens (o ativo por cima)
    const ordem = m.herois.map((h, i) => i).sort((a, b) => (a === m.ativo) - (b === m.ativo));
    for (const i of ordem) {
      const h = m.herois[i];
      if (h.pisca > 0 && Math.floor(h.pisca * 12) % 2) continue;
      const V = h.visual(t, n);
      if (!this.polida && !V.mole && h.noChao) Desenho.sombraChao(ctx, h.x + ((V.quadro && V.quadro.dx) || 0), h.y + 2, h.cfg.w * 0.9);
      const st = Object.assign({ f: h.f, t, rosto: V.rosto, escala: ESC, pesPlanos: !V.mole && !V.giro, giro: V.giro ? h.giro : null,
        quadro: V.quadro || null, pe: { x: h.x, y: h.y }, squash: h.squash * 0.35, amarrado: m.cordas.usaHeroi(h) && h.id === 'pudim' },
        V.extra, h.id === 'fiapo' ? { semRolo: m.cordas.estoque <= 0 } : {});
      Desenho.personagem(ctx, h.ch, V.M, st);
    }
    if (this.polida) this._poeira(ctx, m); // na frente dos pés
    ctx.restore();
    n.desenhaFrente(ctx, v, m.estado === 'jogando' && !this.mapa ? m.heroi : null); // pilares: os heróis passam por trás
    // plano da frente: as nuvens (por cima do jogo, por baixo da seta, das falas e dos efeitos)
    if (v.par) {
      const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
      for (const q of this.cache.fundo.nuvens) {
        const x = cx + (q.x - cx) * 1.12, y = cy + (q.y - cy) * 1.12;
        if (x > v.x0 - 200 && x < v.x1 + 200 && y > v.y0 - 120 && y < v.y1 + 120) Cenario.nuvem(ctx, x, y, q.s, t, q.fase, v.y0 - 10, q.tipo);
      }
    }
    // no mapa: marcadores grandes em cima de cada um, da chave e da saída (e a seta do ativo: junto deles, PROF.pisa)
    ctx.save(); ctx.translate(0, -PROF.pisa);
    if (this.mapa) {
      const r = 18 / z;
      const marca = (x, y, txt, cor) => {
        Estilo.forma(ctx, (c) => U.circulo(c, x, y, r), { cor }, { elev: 0, linha: 3 / z, cel: false });
        ctx.save(); ctx.font = `${Math.round(20 / z)}px ${FONTE_TITULO}`; ctx.fillStyle = '#2b1f2e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, x, y + 1 / z); ctx.restore();
      };
      m.herois.forEach((h, i) => marca(h.x, h.y - h.cfg.h - r * 1.4, String(i + 1), i === m.ativo ? '#ffd23f' : '#fffdf6'));
      for (const k of n.chaves) if (!k.usada && !k.portador) marca(k.x, k.y - r * 1.6, '⚿', CORES_CHAVE[k.cor]);
      const s = n.saida;
      marca((s.x0 + s.x1) / 2, s.y0 - r * 2, '★', '#ffe483');
    }
    // seta no ativo + tecla sugerida
    const a = m.heroi;
    if (m.estado === 'jogando' && !this.mapa) {
      const ay = a.y - a.cfg.h - 34 + Math.sin(t * 6) * 4;
      Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(a.x - 11, ay - 10); c.lineTo(a.x + 11, ay - 10); c.lineTo(a.x, ay + 4); c.closePath(); },
        { cor: '#ffd23f' }, { elev: 1, linha: 2.5, cel: false });
      const dica = !a.fala && m.dicaTecla(a);
      if (dica) {
        ctx.save();
        ctx.font = `17px ${FONTE_TITULO}`;
        const w = ctx.measureText(dica).width + 18, yy = ay - 40;
        Estilo.forma(ctx, (c) => U.retRed(c, a.x - w / 2, yy - 13, w, 26, 7), { cor: '#fffdf6' }, { elev: 1.5, linha: 2.5, cel: false });
        ctx.fillStyle = '#2b1f2e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dica, a.x, yy + 1);
        ctx.restore();
      }
    }
    ctx.restore();
    // efeitos de texto (o golpe forte leva uma estrela de impacto atrás: estoura grande e encolhe)
    for (const e of m.efeitos) {
      const p = (m.t - e.t0) / e.dur;
      const k = (p < 0.25 ? U.ease.outBack(p / 0.25) : 1) * e.esc;
      ctx.save();
      ctx.globalAlpha = 1 - U.prog(p, 0.7, 1);
      if (e.estrela && p < 0.55) {
        const r = 30 * e.esc * (p < 0.06 ? 1.2 : 1 - 0.55 * U.prog(p, 0.06, 0.55)), n = 9; // pequena: não esconde a pose
        Estilo.forma(ctx, (c) => {
          c.beginPath();
          for (let i = 0; i < 2 * n; i++) {
            const a = (i / (2 * n)) * U.TAU + 0.2, rr = i % 2 ? r * 0.48 : r * (i % 4 ? 0.86 : 1);
            c.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
          }
          c.closePath();
        }, { cor: p < 0.06 ? '#fffdf6' : '#ffe483' }, { elev: 0, linha: 3, cel: false });
      }
      Estilo.texto(ctx, e.texto, e.x, e.y - p * 24, { tam: 28 * k, cor: e.cor, rot: -0.08 });
      ctx.restore();
    }
    // falas
    for (const h of m.herois) {
      if (!h.fala) continue;
      const k = U.ease.outBack(U.prog(h.fala.t, 0, 0.18)) * (1 - U.ease.in(U.prog(h.fala.t, h.fala.dur - 0.12, h.fala.dur)));
      const x = U.clamp(h.x + 30, v.x0 + 90, v.x1 - 90), y = Math.max(v.y0 + 60, h.y - PROF.pisa - h.cfg.h - 26);
      Cenario.balao(ctx, x, y, h.fala.texto, { k, tam: 22, lado: 1 });
    }
    ctx.restore();
    if (this.polida && !this.mapa) ctx.drawImage(this._acab().vinheta, 0, 0, W, H);
    this._foraDaTela(ctx);
    this.hud(ctx);
    Toque.desenha(ctx, this);
    if (this.mapa) {
      ctx.save();
      Estilo.forma(ctx, (c) => U.retRed(c, W / 2 - 250, H - 58, 500, 44, 12), { cor: '#fffdf6' }, { elev: 2, linha: 3 });
      ctx.font = `22px ${FONTE_FALA}`; ctx.fillStyle = '#2b1f2e'; ctx.textAlign = 'center';
      ctx.fillText(`MAPA da fase — ${Toque.ativo ? 'toque em MAPA' : 'M'} volta ao jogo (o tempo está parado)`, W / 2, H - 29);
      ctx.restore();
    }
    if (this.cortina) this.desenhaCortina(ctx, (t - this.cortina.t0) / 1.0);
  },

  // Acabamento: os desenhos dele feitos uma vez (sombra, bolinha de pó, vinheta) — nada de gradiente por quadro
  _acab() {
    if (this._acabC) return this._acabC;
    // (na resolução nativa ou acima: a sombra e a poeira chegam a ~3x o tamanho do desenho na tela; U.tela)
    const tela = (w, h, r = 2) => U.tela(w, h, r).c;
    const sombra = tela(128, 32, 3), gs = sombra.getContext('2d');
    gs.scale(1, 0.25);
    const rg = gs.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(48,28,20,1)'); rg.addColorStop(0.6, 'rgba(48,28,20,0.75)'); rg.addColorStop(1, 'rgba(48,28,20,0)');
    gs.fillStyle = rg; gs.fillRect(0, 0, 128, 128);
    const puff = tela(48, 48), gp = puff.getContext('2d');
    gp.beginPath(); gp.arc(24, 24, 20, 0, U.TAU); gp.fillStyle = POEIRA.cor; gp.fill();
    gp.lineWidth = 3; gp.strokeStyle = POEIRA.linha; gp.stroke();
    gp.beginPath(); gp.arc(18, 17, 7, 0, U.TAU); gp.fillStyle = 'rgba(255,255,255,0.7)'; gp.fill(); // brilho
    const vinheta = tela(this.W, this.H, ARTE_RES), gv = vinheta.getContext('2d');
    const rv = gv.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.42, this.W / 2, this.H / 2, this.H * 1.02);
    rv.addColorStop(0, 'rgba(40,24,16,0)'); rv.addColorStop(1, `rgba(40,24,16,${CLIMA.vinheta})`);
    gv.fillStyle = rv; gv.fillRect(0, 0, this.W, this.H);
    return (this._acabC = { sombra, puff, vinheta });
  },
  // o chão embaixo de (x, y): bloco, rampa ou plataforma (gangorra, post-it, carimbo, trena), até SOMBRA.alto abaixo
  _chaoEmbaixo(n, x, y) {
    const c = Math.floor(x / TILE);
    let chao = null;
    for (let l = Math.max(0, Math.floor(y / TILE)); l <= Math.min(n.lins - 1, Math.floor((y + SOMBRA.alto) / TILE)); l++) {
      if (n.rampa(c, l)) { const yr = n.chaoRampa(c, l, x); if (yr >= y - 1) { chao = yr; break; } }
      if (n.solido(c, l) && l * TILE >= y - 1) { chao = l * TILE; break; }
    }
    for (const p of n.plataformas()) { const s = p.superficie(x); if (s != null && s >= y - 1 && (chao == null || s < chao)) chao = s; }
    return chao;
  },
  // Sombras no chão: heróis (no ar também, fracas e pequenas pelo tanto de altura), inimigos, estojo, durex e carimbo
  // (a sombra dele cresce e escurece enquanto desce: avisa que ele vem)
  _sombras(ctx, m, n, v) {
    const S = this._acab().sombra, A = SOMBRA;
    const poe = (x, fy, rx, a) => {
      if (fy == null || a <= 0.02 || x + rx < v.x0 || x - rx > v.x1 || fy < v.y0 - 10 || fy > v.y1 + 30) return;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(S, x - rx, fy - A.recua - rx * A.achata, rx * 2, rx * 2 * A.achata);
    };
    const corpo = (x, y, noChao, w, forca = 1) => {
      const fy = noChao ? y : this._chaoEmbaixo(n, x, y);
      if (fy == null) return;
      const k = U.clamp(1 - (fy - y) / A.alto, 0, 1);
      poe(x, fy, w * (0.5 + 0.35 * k), A.alfa * forca * k);
    };
    ctx.save();
    for (const h of m.herois) {
      if (h.estado === 'machucado' || h.estado === 'caido' && !h.noChao) continue;
      const bola = h.estado === 'rolando', apoiado = h.noChao && !h.apoio;
      corpo(h.x, h.y, apoiado, bola ? BOLA.w : h.cfg.w);
    }
    for (const o of m.inimigos) if (o.vivo && o.x > v.x0 - 100 && o.x < v.x1 + 100) corpo(o.x, o.y, o.noChao, o.cfg.w);
    for (const e of n.estojos) corpo(e.x, e.y + PROF.pisa, e.noChao, ESTOJO.w * 0.8, 0.8); // (o estojo não sobe: PROF.pisa)
    for (const r of n.durex) corpo(r.x, r.y, r.noChao, DUREX.w, 0.9);
    for (const k of n.carimbos) { const d = k.descida(k.t); poe(k.x, k.chao + PROF.pisa, CARIMBO.w * (0.38 + 0.12 * d), A.alfa * (0.2 + 0.7 * d)); } // (o carimbo não sobe: PROF.pisa)
    ctx.restore();
  },
  _poeira(ctx, m) {
    if (!m.particulas.length) return;
    const P = this._acab().puff;
    ctx.save();
    for (const p of m.particulas) {
      const u = (m.t - p.t0) / p.dur, e = 1 - (1 - u) * (1 - u); // sai rápido e freia
      const x = p.x + p.vx * p.dur * e * 0.6, y = p.y + p.vy * p.dur * e * 0.6, r = p.r0 + (p.r1 - p.r0) * e;
      ctx.globalAlpha = 0.9 * (1 - u * u);
      ctx.drawImage(P, x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  },

  // No mapa a fase inteira aparece de uma vez: a parte que não muda (salas, papelão, escadas) vira uma imagem só
  _fixoMapa(ctx, n) {
    const esc = this.escala * Math.min(1, this.W / n.largura, (this.H - 60) / n.altura);
    if (!this.cache.mapa || this.cache.mapa.esc !== esc) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(n.largura * esc); c.height = Math.ceil(n.altura * esc);
      const g = c.getContext('2d');
      g.setTransform(esc, 0, 0, esc, 0, 0);
      n.desenhaFixo(g, { x0: 0, y0: 0, x1: n.largura, y1: n.altura });
      this.cache.mapa = { c, esc };
    }
    ctx.drawImage(this.cache.mapa.c, 0, 0, n.largura, n.altura);
  },

  // Quem está fora da tela aparece numa bolinha na beirada, apontando para onde está
  _foraDaTela(ctx) {
    const m = this.m, cam = this.cam, z = cam.z, W = this.W, H = this.H;
    m.herois.forEach((h, i) => {
      if (i === m.ativo) return;
      const sx = (h.x - cam.x) * z, sy = (h.y - h.cfg.h / 2 - cam.y) * z;
      if (sx > -10 && sx < W + 10 && sy > -10 && sy < H + 10) return;
      const px = U.clamp(sx, 44, W - 44), py = U.clamp(sy, 120, H - 44);
      const ang = Math.atan2(sy - py, sx - px);
      ctx.save();
      ctx.translate(px, py);
      Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(Math.cos(ang) * 44, Math.sin(ang) * 44); c.lineTo(Math.cos(ang + 0.5) * 26, Math.sin(ang + 0.5) * 26); c.lineTo(Math.cos(ang - 0.5) * 26, Math.sin(ang - 0.5) * 26); c.closePath(); },
        { cor: '#ffd23f' }, { elev: 1, linha: 2.5, cel: false });
      Estilo.forma(ctx, (c) => U.circulo(c, 0, 0, 28), { cor: '#fffdf6' }, { elev: 2, linha: 3, cel: false });
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, U.TAU); ctx.clip();
      ctx.translate(-2, 6);
      ctx.scale(0.42, 0.42);
      Desenho.cabeca(ctx, h.ch, { t: this.t, rosto: Rosto.expr(h.estado === 'machucado' ? 'grito' : h.ch.exprBase) });
      ctx.restore();
      ctx.save();
      ctx.font = `16px ${FONTE_TITULO}`; ctx.fillStyle = '#2b1f2e'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), px + 22, py + 26);
      ctx.restore();
    });
  },

  // Dica do trecho em que o personagem ativo está (fases geradas) ou as dicas fixas (tutorial)
  _dicas() {
    const d = this.m.def;
    if (d.trechos) {
      const h = this.m.heroi, x = h.x, y = h.y - 20;
      const tr = d.trechos.find((q) => x >= q.x0 && x < q.x1 && (q.y0 == null || (y >= q.y0 && y < q.y1))) || d.trechos[0];
      return tr ? (tr.dicas || (tr.dica ? [tr.dica] : [])) : [];
    }
    return d.dicas || [];
  },

  hud(ctx) {
    const t = this.t, m = this.m;
    m.herois.forEach((h, i) => {
      const ativo = i === m.ativo;
      const x = 14 + i * 182, y = ativo ? 8 : 14;
      Estilo.forma(ctx, (c) => U.retRed(c, x, y, 172, 76, 10), { cor: ativo ? '#ffe483' : '#fbf7ec' }, { elev: 2, linha: 2.5, cel: false });
      for (let k = 0; k < VIDAS; k++) desenhaCoracao(ctx, x + 64 + k * 19, y + 64, 6.5, k < h.vidas);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, 172, 76); ctx.clip();
      ctx.translate(x + 30, y + 40);
      ctx.scale(0.55, 0.55);
      const rosto = Rosto.expr(h.estado === 'arremessado' || h.estado === 'machucado' ? 'grito' : h.estado === 'tonto' ? 'tonto' : h.ch.exprBase);
      Desenho.cabeca(ctx, h.ch, { t, rosto });
      ctx.restore();
      ctx.fillStyle = '#2b1f2e';
      ctx.font = `20px ${FONTE_TITULO}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1} ${h.ch.nome}`, x + 58, y + 27);
      ctx.font = `17px ${FONTE_FALA}`;
      ctx.fillStyle = '#5b4a52';
      const hab = h.id === 'fiapo' ? `E: corda ×${m.cordas.estoque}` : HABIL[h.id], cabe = 172 - 58 - 6;
      const larg = ctx.measureText(hab).width;
      if (larg > cabe) ctx.font = `${Math.floor(17 * cabe / larg)}px ${FONTE_FALA}`; // texto comprido encolhe até caber no cartão
      ctx.fillText(hab, x + 58, y + 48);
      if (h.chave) Nivel.desenhaChave(ctx, x + 156, y + 20, CORES_CHAVE[h.chave.cor], 0.6, t);
    });
    if (m.estado === 'perdeu') {
      const h = m.herois.find((q) => q.estado === 'caido');
      Estilo.texto(ctx, `${h ? h.ch.nome : 'Alguém'} não aguentou! ${this.ponto ? 'Voltando ao ponto de controle...' : 'Recomeçando...'}`, this.W / 2, this.H / 2 - 40, { tam: 40, cor: '#fffdf6' });
    }
    // no toque, os botões MAPA/menu ocupam o canto de cima: o nome da fase desce e as teclas não aparecem
    const toque = Toque.ativo, yNome = toque ? 94 : 58;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = `17px ${FONTE_FALA}`;
    ctx.fillStyle = '#2b1f2e';
    // (acabamento: as teclas somem depois de 25 s na fase — estão no menu do Esc; no começo de cada fase voltam)
    const aTec = this.polida ? U.clamp(1 - (m.tSala - 25) / 1.5, 0, 1) : 1;
    ctx.globalAlpha = aTec;
    if (!toque && aTec > 0) ctx.fillText(`← → anda (2x corre)   ↑/espaço pula   Tab troca   E habilidade   M mapa   R ${this.ponto ? 'volta ao ponto' : 'recomeça'}   V som/música   Esc menu`, this.W - 16, 26);
    ctx.globalAlpha = 1;
    Estilo.texto(ctx, `Fase ${this.idx + 1} — ${m.def.nome}`, this.W - 16, yNome, { tam: 24, cor: '#fffdf6', alinha: 'right' });
    const rec = this.salva ? Progresso.recorde() : this.recorde;
    if (rec > 0) {
      ctx.font = `18px ${FONTE_FALA}`;
      ctx.fillStyle = '#2b1f2e';
      ctx.fillText(`recorde: ${rec} ${rec === 1 ? 'fase' : 'fases'} · progresso salvo`, this.W - 16, yNome + 28);
    }
    ctx.restore();
    // dicas embaixo (no toque, em cima: embaixo ficam os botões)
    const dicas = this._dicas();
    if (dicas.length && !this.mapa && this.polida) {
      // cartão como os dos heróis, com a etiqueta DICA; dica nova entra subindo (0,25 s)
      const chave = dicas.join('|');
      if (chave !== this._dicaTxt) { this._dicaTxt = chave; this._dicaT0 = this.t; }
      const k = U.ease.out(U.clamp((this.t - this._dicaT0) / 0.25, 0, 1));
      ctx.save();
      ctx.font = `17px ${FONTE_FALA}`;
      const larg = Math.max(...dicas.map((d) => ctx.measureText(d).width)) + 28, alt = dicas.length * 20 + 14;
      const topo = (toque ? 92 : this.H - 14 - alt) + (1 - k) * 18;
      ctx.globalAlpha = k;
      Estilo.forma(ctx, (c) => U.retRed(c, 12, topo, larg, alt, 10), { cor: '#fbf7ec' }, { elev: 2, linha: 2.5, cel: false });
      Estilo.forma(ctx, (c) => U.retRed(c, 22, topo - 11, 54, 20, 6), { cor: '#ffe483' }, { elev: 1, linha: 2, cel: false });
      ctx.fillStyle = '#2b1f2e'; ctx.textAlign = 'left';
      ctx.font = `14px ${FONTE_TITULO}`; ctx.fillText('DICA', 31, topo + 5);
      ctx.font = `17px ${FONTE_FALA}`;
      dicas.forEach((d, i) => ctx.fillText(d, 26, topo + 24 + i * 20));
      ctx.restore();
    } else if (dicas.length && !this.mapa) {
      ctx.save();
      ctx.font = `17px ${FONTE_FALA}`;
      const larg = Math.max(...dicas.map((d) => ctx.measureText(d).width)) + 24;
      const topo = toque ? 88 : this.H - 16 - dicas.length * 20;
      ctx.globalAlpha = 0.85;
      Estilo.forma(ctx, (c) => U.retRed(c, 12, topo, larg, dicas.length * 20 + 8, 8), { cor: '#fffdf6' }, { elev: 1, linha: 2, cel: false });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2b1f2e';
      ctx.textAlign = 'left';
      dicas.forEach((d, i) => ctx.fillText(d, 24, topo + 15 + i * 20));
      ctx.restore();
    }
    if (this.intro > 0 && this.idx === 0 && m.estado === 'jogando') {
      ctx.save();
      ctx.globalAlpha = this.intro;
      Estilo.forma(ctx, (c) => U.retRed(c, 390, 250, 500, 170, 16), { cor: '#fbf7ec' }, { elev: 3, linha: 3.5 });
      Estilo.texto(ctx, 'THE LOST KINGS', 640, 292, { tam: 40, cor: '#f1bf3a' });
      ctx.font = `23px ${FONTE_FALA}`;
      ctx.fillStyle = '#2b1f2e';
      ctx.textAlign = 'center';
      ctx.fillText('Leve os três até a SAÍDA.', 640, 345);
      ctx.fillText(Toque.ativo ? 'Toque no rosto para trocar • E usa a habilidade' : 'Tab troca de personagem • E usa a habilidade', 640, 380);
      ctx.restore();
    }
  },

  desenhaCortina(ctx, p) {
    const W = this.W, H = this.H, larg = W + 160;
    const x0 = W - p * (2 * W + 160);
    Estilo.forma(ctx, (c) => {
      c.beginPath();
      c.moveTo(x0, -20);
      for (let y = -20; y <= H + 20; y += 18) c.lineTo(x0 + (Math.floor(y / 18) % 2 ? 9 : -4), y);
      c.lineTo(x0 + larg, H + 20);
      for (let y = H + 20; y >= -20; y -= 18) c.lineTo(x0 + larg + (Math.floor(y / 18) % 2 ? -9 : 4), y);
      c.closePath();
    }, { cor: '#f6ecd6' }, { elev: 8, linha: 4, cel: false });
    const prox = this.cortina.prox;
    const sub = this.cortina.trocou ? this.m.def.nome : this.cortina.def ? this.cortina.def.nome : prox < SALAS.length ? SALAS[prox].nome : 'Fase nova';
    Estilo.texto(ctx, `Fase ${prox + 1}`, x0 + larg / 2, H / 2 - 20, { tam: 70, cor: '#f1bf3a', rot: -0.04 });
    ctx.font = `34px ${FONTE_FALA}`;
    ctx.fillStyle = '#6b5a60';
    ctx.textAlign = 'center';
    ctx.fillText(sub, x0 + larg / 2, H / 2 + 44);
  },

  // ---------------------------------------------------------------------------
  // A tela do jogo é sempre a NATIVA (1920 x 1080, util.js: a arte é feita para ela, em 1:1); a janela só estica a tela
  // pronta, por igual, pelo CSS. (Antes ela seguia a janela: 1,5x no PC, ~1x no celular — e a arte ampliava diferente.)
  redimensiona() {
    const w = Math.max(320, Math.min(window.innerWidth, window.innerHeight * 16 / 9));
    const h = w * 9 / 16;
    this.cv.style.width = `${w}px`;
    this.cv.style.height = `${h}px`;
    const W2 = NATIVA.w, H2 = NATIVA.h;
    if (this.cv.width === W2 && this.cv.height === H2) return;
    this.cv.width = W2; // mudar o tamanho apaga o canvas
    this.cv.height = H2;
    this.escala = this.cv.width / this.W;
    this.cache = null;
    Menu.fundo = null;
    if (this.congelado) this.pinta();
  },

  pinta() {
    this.ctx.setTransform(this.escala, 0, 0, this.escala, 0, 0);
    this.desenha(this.ctx);
  },

  // V liga/desliga o som: aviso no meio da tela por um instante (no jogo e no menu)
  desenhaAvisoSom(ctx) {
    const a = this.avisoSom;
    if (!a || performance.now() - a.t > 1300) return;
    ctx.save();
    ctx.globalAlpha = U.clamp((1300 - (performance.now() - a.t)) / 300, 0, 1);
    Estilo.texto(ctx, a.texto, this.W / 2, 150, { tam: 30, cor: '#fffdf6' });
    ctx.restore();
  },

  quadro(agora) {
    // um laço só: outro requestAnimationFrame caindo no mesmo quadro (mesmo horário) para aqui e não se repete —
    // laços a mais desenhavam a tela inteira várias vezes por quadro e deixavam tudo em câmera lenta
    if (agora === this.agoraQuadro) return;
    this.agoraQuadro = agora;
    const dt = this.ultimo ? Math.min(0.05, (agora - this.ultimo) / 1000) : 0;
    this.ultimo = agora;
    const ctx = this.ctx;
    ctx.setTransform(this.escala, 0, 0, this.escala, 0, 0);
    let E = this.entrada();
    if (this.modo === 'pausa') { // parado atrás de uma tela da página (a escolha de fase da página publicada)
      if (this.m) this.desenha(ctx);
      requestAnimationFrame((a) => this.quadro(a));
      return;
    }
    if (this.modo === 'menu') {
      this.t += dt;
      Menu.entrada(E, this);
      if (this.modo === 'menu') { Menu.desenha(ctx, this); this.desenhaAvisoSom(ctx); }
      requestAnimationFrame((a) => this.quadro(a));
      return;
    }
    this.acum += dt;
    let n = 0;
    while (this.acum >= this.PASSO && n++ < 10 && this.modo === 'jogo') {
      this.passo(this.PASSO, E);
      E = Object.assign({}, E, { pulo: false, pulaCima: false, acao: false, troca: false, reinicia: false, nova: false, sel: null, menu: false, mapa: false,
        bCima: false, bBaixo: false, bEsq: false, bDir: false }); // toques valem uma vez (dois no mesmo quadro não são "dois toques")
      this.acum -= this.PASSO;
    }
    if (n >= 10) this.acum = 0;
    if (this.modo === 'jogo') { this.atualizaCamera(dt); this.desenha(ctx); } else Menu.desenha(ctx, this);
    this.desenhaAvisoSom(ctx);
    requestAnimationFrame((a) => this.quadro(a));
  },

  // Antes do 1º quadro, os desenhos da IA (heróis, inimigos, cenário) têm que ter chegado: o desenho antigo, por código,
  // não aparece nem por um instante (02/10, usuário: "sempre que carrega, carrega com a arte vetorial antiga"). Enquanto
  // isso, a tela de carregando, com a barra.
  async _esperaArte(max = 30000) {
    const ids = Object.keys(Sprites.CONJUNTOS), t0 = performance.now();
    const feitos = () => ids.filter((id) => Sprites.pronto(id)).length + (typeof Objetos === 'undefined' || Objetos.pronto() ? 1 : 0);
    while (feitos() < ids.length + 1 && performance.now() - t0 < max) {
      const ctx = this.ctx, W = this.W, H = this.H, k = feitos() / (ids.length + 1);
      ctx.setTransform(this.escala, 0, 0, this.escala, 0, 0);
      ctx.fillStyle = '#1d1916'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = '#f1bf3a'; ctx.font = `40px ${FONTE_TITULO}`;
      ctx.fillText('THE LOST KINGS', W / 2, H / 2 - 30);
      ctx.fillStyle = '#4a3d31'; ctx.fillRect(W / 2 - 200, H / 2 + 6, 400, 14);
      ctx.fillStyle = '#f1bf3a'; ctx.fillRect(W / 2 - 200, H / 2 + 6, 400 * k, 14);
      ctx.fillStyle = '#c9bba6'; ctx.font = `22px ${FONTE_FALA}`; ctx.fillText('carregando os desenhos...', W / 2, H / 2 + 52);
      await new Promise((ok) => setTimeout(ok, 50));
    }
  },

  async init() {
    Estilo.init();
    Estilo.atual = 'cartoon';
    Sprites.init();
    if (typeof Objetos !== 'undefined') Objetos.init(); // objetos do cenário da IA (o padrão; ?codigo desliga)
    if (typeof Som !== 'undefined') Som.init();
    if (typeof Musica !== 'undefined') Musica.liga(); // começa quando o áudio abrir (primeira tecla ou toque)
    this.cv = document.getElementById('jogo');
    this.ctx = this.cv.getContext('2d');
    this.redimensiona();
    window.addEventListener('resize', () => this.redimensiona());
    await this._esperaArte();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyV' && typeof Som !== 'undefined' && !e.repeat) this.avisoSom = { texto: Som.alterna(), t: performance.now() };
      const n = TECLAS[e.code];
      if (!n) return;
      e.preventDefault();
      if (!this.teclas[n]) this.bordas[n] = true;
      this.teclas[n] = true;
    });
    window.addEventListener('keyup', (e) => { const n = TECLAS[e.code]; if (n) this.teclas[n] = false; });
    window.addEventListener('blur', () => { this.teclas = {}; });
    // mouse no menu
    const pos = (e) => { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * this.W, y: (e.clientY - r.top) / r.height * this.H }; };
    this.cv.addEventListener('mousemove', (e) => { if (this.modo === 'menu') Menu.mouse(pos(e), this, false); });
    this.cv.addEventListener('click', (e) => {
      if (this.modo === 'menu') Menu.mouse(pos(e), this, true);
      else { const i = Toque.cartao(pos(e)); if (i != null) this.bordas[`s${i + 1}`] = true; } // clicar no rosto escolhe
    });
    Toque.init(this);
    // Parâmetros de teste (não leem nem salvam progresso e pulam o menu):
    // ?sala=5 começa numa fase; ?semente=42 fixa o sorteio; ?demo o robô joga sozinho; ?t=5 congela (screenshot); ?mapa
    // ?vitrine: progresso de mentira só na memória (para screenshot do menu); ?vitrine=salas abre a escolha de fase
    // ?fase=nome: fase feita no editor (fases/nome.json); ?fase=~ é a que está aberta no editor agora
    const q = U.params();
    this.demo = q.has('demo') || q.has('t');
    this.alt = q.has('alt') ? parseInt(q.get('alt'), 10) || 0 : null;
    const avulsa = q.has('fase') ? await this.leFase(q.get('fase')) : null;
    this.avulsa = !!avulsa;
    const teste = this.demo || q.has('sala') || q.has('semente') || this.avulsa;
    this.salva = !teste;
    if (q.has('vitrine')) {
      Progresso.dados = { versao: 1, semente: 7, atual: 11, maior: 11, vencidas: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], nomes: {}, quando: 0 };
      Progresso.grava = () => {};
    } else if (!teste) await Progresso.carrega();
    if (!teste) {
      this.semente = Progresso.dados ? Progresso.dados.semente : Math.floor(Math.random() * 1e9);
      Menu.abre(this);
      if (q.get('vitrine') === 'salas') { Menu.tela = 'salas'; Menu.selSala = 11; }
      requestAnimationFrame((a) => this.quadro(a));
      return;
    }
    this.semente = q.has('semente') ? parseInt(q.get('semente'), 10) || 1 : Math.floor(Math.random() * 1e9);
    this.modo = 'jogo';
    this.carrega(avulsa ? 0 : Math.max(0, (parseInt(q.get('sala'), 10) || 1) - 1), avulsa || undefined);
    if (avulsa) this.intro = 0; // fase do editor: sem o cartaz de abertura do jogo
    if (q.get('t')) {
      const alvo = parseFloat(q.get('t')), inicio = this.m;
      this.intro = 0;
      while (this.m === inicio && this.m.tSala < alvo) this.passo(this.PASSO, {});
      if (q.has('mapa')) this.mapa = true;
      if (q.has('ativo')) this.m.ativo = parseInt(q.get('ativo'), 10) || 0;
      this.atualizaCamera(0, true);
      this.congelado = true;
      this.pinta();
      requestAnimationFrame(() => { this.pinta(); document.title = 'pronto'; });
      return;
    }
    requestAnimationFrame((a) => this.quadro(a));
  },
};
