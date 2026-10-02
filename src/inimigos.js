'use strict';

// Inimigos de papelaria. Cada um tem um herói e um jeito certo (decidido com o usuário, 28/09):
//   guarda      — lança de lápis: viu herói na frente, arma (aviso) e ESTOCA, mais longe que o soco do Marreta; depois
//                 demora a recolher (a brecha). Marreta: deixa a estocada passar e soca na volta. Na barriga do Pudim a
//                 ponta quebra e ele fica tonto apontando o lápis. Pudim rolando derruba; bundada só caindo de cima.
//   escudeiro   — régua de escudo na frente: soco reto, Pudim rolando e amigo arremessado batem e voltam; encostar de
//                 frente não machuca, mas ele EMPURRA. O gancho do Marreta vem por baixo e derruba; pelas costas, qualquer
//                 golpe; o Pudim, só caindo de cima (bundada).
//   borracha    — rola rápido; quica no Pudim; a bundada (baixinha: basta o pulo) ou o Pudim rolando acabam com ela
//   grampeador  — atira grampos; o Pudim rebate na barriga e o grampo volta nele
//   lixeira     — cesto de lixo parado lá no alto: joga bolinha de papel em ARCO (passa por cima de mureta, cai atrás
//                 de parede). O soco ou o gancho do Marreta na hora certa rebate: a bolinha volta em arco e cai
//                 dentro dela — CESTA!
//                 Na barriga do Pudim quica para cima; embaixo de laje, protege
// Amigo arremessado em cima: só o Pudim (pesado) derruba; o Fiapo se machuca.
// Caixas conferidas com os desenhos (28/09): a régua do escudeiro vai a 44 px do pé (a caixa ia só a 22: o herói
// entrava na régua antes do empurrão); borracha e grampeador do tamanho do desenho. O guarda fica um pouco mais estreito
// que o desenho (o lápis tem que alcançar mais que o soco do Marreta).
// cabeca: topo do desenho parado no meio (±16 px, sem a ponta do lápis), medido no tamanho do jogo (01/10): onde o pisão
// do Fiapo e a bundada do Pudim pegam e onde giram as estrelinhas do zonzo.
const CFG_INIMIGO = {
  guarda: { w: 38, h: 96, vel: 70, cabeca: 107 },
  escudeiro: { w: 70, h: 98, vel: 55, cabeca: 110 },
  borracha: { w: 60, h: 36, vel: 190, cabeca: 35 },
  grampeador: { w: 64, h: 44, vel: 0, intervalo: 1.7, cabeca: 34 },
  tesoureiro: { w: 40, h: 96, vel: 0, cabeca: 107 },
  lixeira: { w: 50, h: 56, vel: 0, intervalo: 2.2, cabeca: 62 }, // caixa pelo desenho: cesto 46-54 de largura, aro a 46 px, papel até 57
  // Blindado (01/10, usuário: "por que derrubar da régua se pode simplesmente matar? Tem que ser invencível, com armadura"):
  // soldadinho de lata de corda; nada o derruba (CLANG) — só cair (lápis, fosso, a trena recolhida). Caixa pelo desenho
  // da IA (folha blindado-1): a lata de -27 a 23 px do meio, a tampinha até 110 px do pé.
  blindado: { w: 50, h: 104, vel: 50, cabeca: 110, blindado: true },
};
// Lixeira: vê herói até 280 px na horizontal (qualquer altura abaixo dela), avisa 0,35 s e joga a bolinha mirando o
// peito dele, com tempo de voo de 0,7 a 1,3 s (gravidade da bolinha: 1300). Rebatida, volta num arco que cai dentro
// dela (voo de 0,55 a 0,9 s: tem que descer no fim para "cair na cesta").
const LIXEIRA = { ve: 280, arma: 0.35, g: 1300, raio: 10, volta: [0.55, 0.9] };
// Arco da bolinha de (x0, y0) até (tx, ty) em T s. Teto baixo: arco mais achatado — sobe no máximo o vão até o teto
// (o tempo de voo sai da conta do arco).
function arcoBolinha(M, x0, y0, tx, ty, T) {
  const L = LIXEIRA;
  let vao = 0;
  while (vao < 400 && !M.nivel.solidoEm(x0, y0 - vao - L.raio - 4)) vao += 4;
  const V = Math.sqrt(2 * L.g * vao), tTeto = (V + Math.sqrt(Math.max(0, V * V + 2 * L.g * (ty - y0)))) / L.g;
  T = Math.max(0.3, Math.min(T, tTeto));
  return { vx: (tx - x0) / T, vy: (ty - y0) / T - 0.5 * L.g * T, T };
}
// Tesoureiro (soldado da tesoura): de guarda parado, olhando para um lado e para o outro (vira a cada 2,6 s). Vê herói
// na frente (até 240 px, na mesma altura, sem parede no meio): arma 0,4 s (aviso: abre e fecha a tesoura) e CORRE a
// 460 px/s sem frear nem virar até cravar a tesoura na parede, no portão ou no durex, grudar na cola, quicar na barriga
// do Pudim (tonto) — preso 3 s em qualquer um: não machuca e qualquer golpe derruba — ou cair num buraco. Na corrida a
// tesoura corta a corda que pegar: ela cai enrolada no chão embaixo do corte (o Fiapo pega de volta, se der).
// Medidas do desenho (folha tesoureiro-1, no tamanho do jogo, a partir da fivela): correndo, a ponta chega a 74-81 px
// (ponta 78) na altura de 47 px acima do pé (lâmina de 36 a 60); cravado, a lâmina desenhada acaba a ~50 px — a ponta
// fica 28 px dentro da parede (crava).
const TESOURA = { ve: 240, arma: 0.4, corre: 460, vira: 2.6, preso: 3, ponta: 78, y0: -60, y1: -36, crava: 28 };
// Estocada do guarda (s e px do jogo): vê a até 200 px na frente; arma 0,45 s (aviso); a ponta fica esticada 0,25 s
// alcançando 100 px do meio dele (o soco do Marreta chega a 91 do meio DELE: quem vai direto leva primeiro); recolhe
// em 0,8 s (a brecha). Na barriga do Pudim, tonto por 3 s.
const ESTOCADA = { ve: 200, alcance: 100, arma: 0.45, estica: 0.25, recolhe: 0.8, tonto: 3, y0: -78, y1: -42 };
const alvoDoGuarda = (h) => !['machucado', 'caido', 'arremessado'].includes(h.estado) && !(h.pisca > 0);

class Inimigo {
  constructor(d) {
    this.especie = d.especie;
    this.cfg = CFG_INIMIGO[d.especie];
    this.x = d.x; this.y = d.y; this.vx = 0; this.vy = 0; this.f = d.f || -1;
    this.noChao = true; this.vivo = true; this.morte = null; this.t = U.hash(d.x) * 5;
    const alc = d.alcance ?? 170;
    this.x0 = d.x - alc; this.x1 = d.x + alc;
    this.recarga = 0.8 + U.hash(d.x + 3) * 0.6;
    this.boca = 0;
    this.golpe = null; this.tonto = 0; this.tEmpurra = -9;
    this.modo = 'guarda'; this.preso = 0; this.armando = 0; // tesoureiro
    // para o desenho: quanto andou (quadro do andar) e quando bloqueou, empurrou, virou, quicou (tempo do mundo)
    this.dist = 0; this.tBloqueio = this.tEmpurrou = this.tVirou = this.tQuica = -9;
    if (d.especie === 'tesoureiro') this.tVirou = 0; // de guarda: a primeira virada vem depois de TESOURA.vira
  }

  atualiza(dt, M) {
    this.t += dt;
    if (!this.vivo) {
      const m = this.morte;
      m.t += dt;
      if (m.cesta && m.t < 0.3) return; // a bolinha caiu dentro: segura o tranco antes de tombar
      if (!m.amassado) { m.vy += 1800 * dt; this.x += m.vx * dt; this.y += m.vy * dt; m.rot += m.vr * dt; } // amassado fica
      return;
    }
    const n = M.nivel;
    // zonzo (o pisão do Fiapo, a bola ou a bundada do Pudim: atordoa): parado, sem atacar
    const zonzo = this.zonzo > 0 && this.especie !== 'tesoureiro';
    if (zonzo) { this.zonzo -= dt; this.golpe = null; this.jogando = null; this.recarga = Math.max(this.recarga, 0.5); }
    if (zonzo && (this.especie === 'lixeira' || this.especie === 'grampeador')) return;
    if (this.especie === 'lixeira') { this._lixeira(dt, M); return; }
    if (this.especie === 'grampeador') {
      this.boca = Math.max(0, this.boca - dt * 4);
      this.recarga -= dt;
      if (this.recarga <= 0) {
        this.recarga = this.cfg.intervalo;
        this.boca = 1;
        M.grampos.push({ x: this.x + this.f * 40, y: this.y - 18, vx: this.f * 380, dono: this, rebatido: false, vida: 1.4 }); // sai da boca do desenho
        M.som('grampo');
      }
      return;
    }
    if (this.especie === 'tesoureiro') this._tesoura(dt, M);
    else if (zonzo || this._lanca(dt, M)) this.vx = this.kb || 0; // zonzo, estocando ou tonto: no lugar (a bola empurra)
    else {
      // patrulha: vira na beirada, na parede ou no fim do trecho. Na cola anda devagar; no corretivo escorrega: só
      // vira na parede (na beirada, cai)
      const piso = this.noChao ? n.piso(this.x, this.y) : null;
      const frente = this.x + this.f * (this.cfg.w / 2 + 4);
      const semChao = this.noChao && !n.solidoEm(frente, this.y + 4) && n.rampaEntre(frente, this.y - 2, this.y + TILE) == null;
      const parede = n.solidoEm(frente, this.y - 10) || n.solidoEm(frente, this.y - this.cfg.h + 10);
      const fim = (this.f > 0 && this.x > this.x1) || (this.f < 0 && this.x < this.x0);
      if (parede || this.bateuDurex || (piso !== 'w' && (semChao || fim))) { this.f *= -1; this.tVirou = M.t; }
      this.bateuDurex = false;
      this.vx = this.f * this.cfg.vel * (piso === 'k' ? POCA.colaInimigo : 1);
    }
    if (this.kb) { this.kb *= Math.max(0, 1 - dt * 5); if (Math.abs(this.kb) < 8) this.kb = 0; }
    this.dist += Math.abs(this.vx) * dt;
    this.vy = Math.min(QUEDA_MAX, this.vy + GRAV * dt);
    const corria = this.modo === 'corre' && this.vx !== 0;
    moveX(this, n, dt);
    moveY(this, n, dt);
    // correndo, bateu o corpo (mureta mais baixa que a tesoura, durex): para ali mesmo
    if (corria && (this.vx === 0 || this.bateuDurex)) this._prende(M, 'cravado', 'TÓIN!');
    if (n.perigo(this.x - this.cfg.w / 2, this.y - this.cfg.h, this.x + this.cfg.w / 2, this.y, true) || this.y > n.altura + 100) this.derrota(0, M, 'PLOC!', -680, false, true);
  }

  // Zonzo (01/10, equilíbrio — usuário: "o Pudim tá muito forte... sai rolando, invulnerável, mata todos os inimigos";
  // "o Fiapo [sozinho]... o timing é bem judioso"): o pisão do Fiapo, a bola e a bundada do Pudim deixam o inimigo zonzo
  // s segundos — parado, estrelinhas, não ataca, encostar não machuca e o escudo cai (qualquer golpe derruba) — mas
  // não matam: quem derrota é o Marreta (e a bundada na borracha). kb: o empurrão da bola (vai parando). O tesoureiro
  // fica preso tonto (o mesmo de quando a tesoura quica na barriga).
  atordoa(M, s, texto = '', kb = 0) {
    if (!this.vivo) return;
    if (this.cfg.blindado) { this.clang(M); return; } // (a lata: nem zonzo)
    if (this.especie === 'tesoureiro') { if (!(this.preso > 0)) this._prende(M, 'tonto', ''); }
    else this.zonzo = Math.max(this.zonzo || 0, s);
    this.kb = this.especie === 'tesoureiro' ? 0 : kb;
    if (texto) M.fx(texto, this.x, this.y - this.cfg.cabeca - 46, '#fffdf6', 0.9); // (acima das estrelinhas)
    M.registra(`${this.especie} zonzo`);
  }

  // vy: para onde voa (o gancho do Marreta manda para o alto; o soco reto, para longe). amassado (bundada): fica
  // achatado no lugar e some.
  // A lata do blindado: o golpe bate e não faz nada
  clang(M) {
    if (M.t - (this.tClang ?? -9) < 0.25) return;
    this.tClang = M.t; this.tBloqueio = M.t;
    M.fx('CLANG!', this.x, this.y - this.cfg.h - 10, '#c9cfd6', 0.9);
    M.tremer(3);
    M.registra('blindado: CLANG (não adianta)');
  }

  // perigo: caiu nos lápis ou para fora da fase (a única coisa que derruba o blindado)
  derrota(vx, M, texto, vy = -680, amassado = false, perigo = false) {
    if (!this.vivo) return;
    if (this.cfg.blindado && !perigo) { this.clang(M); return; }
    this.vivo = false;
    this.morte = amassado ? { vx: 0, vy: 0, rot: 0, vr: 0, t: 0, amassado: true }
      : { vx: vx || (this.f * -200), vy, rot: 0, vr: (Math.sign(vx) || 1) * 9, t: 0 };
    if (texto) M.fx(texto, this.x, this.y - this.cfg.h - 10, '#ffd23f', 1.1); // (o golpe do Marreta põe o seu)
    M.tremer(5);
    M.registra(`${this.especie} derrotado`);
  }

  // Guarda: estocada de lápis (ESTOCADA). Devolve true enquanto fica parado no lugar (armando, estocando, recolhendo
  // ou tonto apontando o lápis).
  _lanca(dt, M) {
    if (this.especie !== 'guarda') return false;
    const G = ESTOCADA;
    if (this.tonto > 0) { this.tonto -= dt; return true; }
    if (!this.golpe) {
      // (e o estojo de zíper vindo para cima dele: estoca nele — TOC — e é empurrado do mesmo jeito)
      const ve = M.herois.some((h) => alvoDoGuarda(h) && Math.sign(h.x - this.x) === this.f
        && Math.abs(h.x - this.x) < G.ve && Math.abs(h.y - this.y) < 40)
        || (M.nivel.estojos || []).some((e) => M.t - (e.tAndou ?? -9) < 0.3 && e.anda === -this.f && Math.abs(e.y - this.y) < 40
          && this.f * ((this.f > 0 ? e.caixa().x0 : e.caixa().x1) - this.x) > 0 && Math.abs((this.f > 0 ? e.caixa().x0 : e.caixa().x1) - this.x) < G.ve - 60);
      if (!ve) return false;
      this.golpe = { t: 0, acertou: false };
    }
    const g = this.golpe;
    g.t += dt;
    if (g.t >= G.arma && g.t - dt < G.arma) M.som('estoca');
    if (!g.acertou && g.t >= G.arma && g.t < G.arma + G.estica) {
      const a = this.x + this.f * 10, b = this.x + this.f * G.alcance; // da mão até a ponta, na altura do peito
      const x0 = Math.min(a, b), x1 = Math.max(a, b), y0 = this.y + G.y0, y1 = this.y + G.y1;
      // o estojo de zíper no meio: a ponta bate nele (TOC) e não chega em ninguém
      const est = (M.nivel.estojos || []).find((e) => { const k = e.caixa(); return k.x0 < x1 && k.x1 > x0 && k.y0 < y1 && k.y1 > y0; });
      if (est) { g.acertou = true; M.fx('TOC!', this.f > 0 ? est.caixa().x0 : est.caixa().x1, this.y - 60, '#e9c77a', 0.8); M.registra('lápis bateu no estojo'); }
      for (const h of (est ? [] : M.herois)) {
        const c = h.caixa();
        if (!alvoDoGuarda(h) || c.x0 >= x1 || c.x1 <= x0 || c.y0 >= y1 || c.y1 <= y0) continue;
        g.acertou = true;
        if (h.id === 'pudim' && h.estado !== 'rolando') { // barriga: a ponta quebra (impacto segurado, susto, tonto);
          // (rolando, a ponta fura a bola: TUC, como nos outros — 01/10)
          this.tonto = G.tonto; this.golpe = null; this.tQuebrou = M.t;
          M.parada = Math.max(M.parada, 0.1); M.tremer(6);
          h.squash = 0.4;
          M.fx('PLEC!', this.x + this.f * (G.alcance - 20), this.y - 105, '#f2c230', 1); // acima: a ponta voando aparece
          M.registra('guarda: a ponta do lápis quebrou');
          return true;
        }
        M.fx('TUC!', h.x, h.y - 60, '#f2c230', 0.9);
        h._machuca(M);
        break;
      }
    }
    if (g.t >= G.arma + G.estica + G.recolhe) this.golpe = null;
    return true;
  }

  // Lixeira: parada; mira o herói mais perto à vista, avisa (arma) e joga a bolinha em arco
  _lixeira(dt, M) {
    const L = LIXEIRA;
    this.susto = M.bolinhas.some((b) => b.rebatida && b.dono === this); // a bolinha vem voltando: olho arregalado
    this.recarga -= dt;
    if (this.jogando != null) {
      this.jogando += dt;
      if (this.jogando >= L.arma) {
        this.jogando = null; this.recarga = this.cfg.intervalo; this.tJogou = M.t;
        const h = this.alvoLixeira(M);
        if (h) {
          const { x0, y0, tx, ty, T } = this.miraLixeira(h), v = arcoBolinha(M, x0, y0, tx, ty, T);
          M.bolinhas.push({ x: x0, y: y0, vx: v.vx, vy: v.vy, dono: this, rebatida: false, vida: 4, giro: 0 });
          M.registra(`lixeira joga em ${h.id}`);
          M.som('arremesso');
        }
      }
      return;
    }
    const h = this.alvoLixeira(M);
    if (h) this.f = Math.sign(h.x - this.x) || this.f;
    if (h && this.recarga <= 0) { this.jogando = 0; M.fx('!', h.x, h.y - h.cfg.h - 26, '#f2553d', 1.1); } // (avisa quem vai levar)
  }
  // Alvo (30/09, usuário: "visibilidade"; "o jeito que ela escolhe o alvo não está legal"): só quem a bolinha ALCANÇA —
  // o arco de ida passa livre até o peito dele (embaixo de laje ou atrás de parede alta, está a salvo; por cima de
  // mureta o arco passa, como antes) — e ela fica no mesmo alvo enquanto ele estiver ao alcance; só troca quando ele se
  // esconde ou sai. Antes: o mais perto em x, trocando a toda hora, e mirando até em quem estava embaixo de laje.
  alvoLixeira(M) {
    const ok = (h) => alvoDoGuarda(h) && Math.abs(h.x - this.x) < LIXEIRA.ve && h.y > this.y - 40 && this.arcoLivre(M, h);
    if (!(this.alvo && ok(this.alvo))) {
      this.alvo = M.herois.filter(ok).sort((p, q) => Math.abs(p.x - this.x) - Math.abs(q.x - this.x))[0] || null;
    }
    return this.alvo;
  }
  miraLixeira(h) {
    const f = Math.sign(h.x - this.x) || this.f, x0 = this.x + f * 12, y0 = this.y - this.cfg.h + 4, tx = h.x, ty = h.y - h.cfg.h * 0.6;
    return { x0, y0, tx, ty, T: U.clamp(Math.hypot(tx - x0, ty - y0) / 420, 0.7, 1.3) };
  }
  // o arco até o herói passa sem bater em nada? (a mesma conta do arremesso, ponto a ponto, como a bolinha voa)
  arcoLivre(M, h) {
    const L = LIXEIRA, { x0, y0, tx, ty, T } = this.miraLixeira(h), v = arcoBolinha(M, x0, y0, tx, ty, T);
    for (let t = 0.04; t < v.T - 0.08; t += 0.03) {
      if (M.nivel.solidoEm(x0 + v.vx * t, y0 + v.vy * t + 0.5 * L.g * t * t)) return false;
    }
    return true;
  }

  // Tesoureiro (TESOURA): de guarda, arma, corre sem frear; preso (cravado, grudado ou tonto) não ataca
  _tesoura(dt, M) {
    const T = TESOURA, n = M.nivel;
    this.bateuDurex = false;
    if (this.preso > 0) {
      this.preso -= dt;
      if (this.noChao) this.vx = 0; // quicou na barriga: voa um pouco para trás e cai sentado
      if (this.preso <= 0) { this.modo = 'guarda'; this.tVirou = M.t; }
      return;
    }
    if (this.modo === 'arma') {
      this.vx = 0; this.armando += dt;
      if (this.armando >= T.arma) { this.modo = 'corre'; M.som('corrida'); }
      return;
    }
    if (this.modo === 'corre') {
      this.vx = this.f * T.corre;
      const yp = this.y + (T.y0 + T.y1) / 2, xp = this.x + this.f * T.ponta, xn = xp + this.vx * dt;
      // a ponta entra na parede (ou no portão fechado): crava — fica 12 px lá dentro
      if (n.solidoEm(xn, yp)) {
        const c = Math.floor(xn / TILE), face = this.f > 0 ? c * TILE : (c + 1) * TILE;
        this.x = face + this.f * (T.crava - T.ponta);
        return this._prende(M, 'cravado', 'CRAVOU!');
      }
      if ((n.durex || []).some((r) => Math.hypot(r.x - xn, r.y - DUREX.r - yp) < DUREX.r)) return this._prende(M, 'cravado', 'CRAVOU!');
      if ((n.estojos || []).some((e) => { const k = e.caixa(); return xn > k.x0 && xn < k.x1 && yp > k.y0 && yp < k.y1; })) return this._prende(M, 'cravado', 'CRAVOU!');
      if (this.noChao && n.piso(this.x, this.y) === 'k') return this._prende(M, 'grudado', 'GRUDOU!');
      this._cortaCorda(M, xp, yp, dt);
      // quem a tesoura pega: a barriga do Pudim devolve (BOING, tonto); nos outros, TSC! (a bola do Pudim e o amigo
      // arremessado: quem decide é o contato)
      const x0 = Math.min(this.x, xp), x1 = Math.max(this.x, xp);
      for (const h of M.herois) {
        const c = h.caixa();
        if (!alvoDoGuarda(h) || h.estado === 'rolando' || c.x0 >= x1 || c.x1 <= x0 || c.y0 >= this.y + T.y1 || c.y1 <= this.y + T.y0) continue;
        if (h.id === 'pudim') {
          h.squash = 0.4;
          M.fx('BOING', xp, yp - 30, '#f28aa0', 0.9);
          this.vx = -this.f * 260; this.vy = -320; this.noChao = false;
          return this._prende(M, 'tonto', '');
        }
        h._machuca(M);
        M.fx('TSC!', xp, yp, '#e9e9f0', 1);
      }
      return;
    }
    // de guarda: olha para um lado e para o outro; herói na frente, na mesma altura, sem parede no meio: arma
    this.vx = 0; this.modo = 'guarda';
    if (M.t - this.tVirou > T.vira) { this.f *= -1; this.tVirou = M.t; }
    const ve = M.herois.some((h) => alvoDoGuarda(h) && Math.sign(h.x - this.x) === this.f && Math.abs(h.x - this.x) < T.ve
      && Math.abs(h.y - this.y) < 40 && !this._paredeAte(n, h.x));
    if (ve) { this.modo = 'arma'; this.armando = 0; M.som('tesoura'); }
  }
  _paredeAte(n, x) {
    for (let k = this.x; Math.abs(k - this.x) < Math.abs(x - this.x); k += this.f * 20) if (n.solidoEm(k, this.y - 50)) return true;
    return false;
  }
  _prende(M, modo, texto) {
    this.modo = modo; this.preso = TESOURA.preso; this.tPreso = M.t;
    if (modo !== 'tonto') this.vx = 0;
    if (texto) M.fx(texto, this.x + this.f * TESOURA.ponta, this.y - 84, '#e9e9f0', 1);
    M.tremer(modo === 'cravado' ? 6 : 3);
    M.registra(`tesoureiro ${modo} x=${Math.round(this.x)}`);
  }
  // A tesoura passou por uma corda amarrada (ponte, rampa, tirolesa, pendurada): corta. A corda cai enrolada no chão
  // embaixo do corte (vira rolo de barbante). A lâmina varre, neste passo, do corpo até a ponta e o que ele caiu.
  _cortaCorda(M, xp, yp, dt) {
    if (!M.cordas) return;
    const xa = Math.min(this.x, xp), xb = Math.max(this.x, xp), ya = yp - Math.max(0, this.vy) * dt - 6, yb = yp + 6;
    for (const c of M.cordas.lista.slice()) {
      let a, b;
      if (c.estado === 'presa2') { const sg = c.segmento(); if (!sg) continue; a = sg.a; b = sg.b; }
      else if (c.estado === 'solta' && c.pendurada) { const q = c.pendurada; a = { x: q.x, y: q.y0 }; b = { x: q.x, y: q.y1 }; }
      else continue;
      const k = Math.max(1, Math.ceil(U.dist(a.x, a.y, b.x, b.y) / 4));
      let corte = null;
      for (let i = 0; i <= k && !corte; i++) {
        const x = a.x + (b.x - a.x) * i / k, y = a.y + (b.y - a.y) * i / k;
        if (x >= xa && x <= xb && y >= ya && y <= yb) corte = { x, y };
      }
      if (!corte) continue;
      M.cordas.lista.splice(M.cordas.lista.indexOf(c), 1);
      M.nivel.rolos.push({ x: corte.x, y: c._chaoAbaixo(corte.x, corte.y), pego: false });
      M.fx('SNIP!', corte.x, corte.y - 20, '#e9e9f0', 1.1);
      M.registra('tesoureiro cortou a corda');
    }
  }

  // O escudo está virado para quem vem de x?
  escudoPara(x) { return this.especie === 'escudeiro' && !(this.zonzo > 0) && Math.sign(x - this.x) === this.f; }
  caixa() { const c = this.cfg; return { x0: this.x - c.w / 2, y0: this.y - c.h, x1: this.x + c.w / 2, y1: this.y }; }

  // Quadro do desenho da IA para o estado do inimigo: { anim, i }; null = desenho por código
  _quadro(t) {
    const A = Sprites.CONJUNTOS[this.especie].anims || {}, esp = this.especie;
    const Q = (n, i = 0) => (A[n] ? { anim: A[n], i: U.clamp(i, 0, A[n].quadros.length - 1) } : null);
    const toca = (n, tt) => (A[n] ? Q(n, Sprites._noTempo(A[n], tt)) : null);
    if (!this.vivo) {
      if (this.morte.cesta && this.morte.t < 0.3 && A.cesta) return Q('cesta'); // a bolinha caiu dentro dela: tranco
      return Q(this.morte.amassado ? 'amassado' : 'derrotado') || Q('quebrado') || Q('derrotado');
    }
    if (esp === 'tesoureiro') { // armando (e grudado na cola: agachado, fazendo força), correndo, cravado, tonto
      const m = this.modo;
      if (m === 'arma' || m === 'grudado') return Q('arma');
      if (m === 'corre') return toca('corre', this.t);
      if (m === 'cravado' || m === 'tonto') return Q(m);
      return Q('parado');
    }
    if (esp === 'lixeira') { // pega a bolinha lá dentro, arma, joga; olho arregalado quando ela volta
      if (this.jogando != null) return Q(this.jogando < LIXEIRA.arma / 2 ? 'pega' : 'arma');
      if (t - (this.tJogou ?? -9) < 0.3) return Q('atira');
      if (this.susto) return Q('susto');
      return this.t % 5 < 0.8 ? Q('desconfia') : Q('parado');
    }
    if (esp === 'guarda') {
      if (this.tonto > 0) { // lápis quebrou na barriga: impacto (a ponta voando) e susto olhando o toco, antes do tonto
        const q = t - (this.tQuebrou ?? -9);
        if (A.quebra && q < 0.32) return Q('quebra', 0);
        if (A.quebra && q < 0.85) return Q('quebra', 1);
        return toca('tonto', this.t);
      }
      if (this.golpe) { const G = ESTOCADA, g = this.golpe.t; return Q(g < G.arma ? 'arma' : g < G.arma + G.estica ? 'estoca' : 'recolhe'); }
    }
    if (esp === 'escudeiro') {
      if (t - this.tBloqueio < 0.35) return Q('bloqueia');
      if (t - this.tEmpurrou < 0.08) return Q('arma');
      if (t - this.tEmpurrou < 0.35) return Q('empurra');
      if (t - this.tVirou < 0.2) return Q('vira');
    }
    if (esp === 'blindado') { // caindo da fita, CLANG (golpe ou bola), empurrando quem encosta; parado, desconfia
      if (!this.noChao) return Q('cai');
      if (t - (this.tClang ?? -9) < 0.3) return Q('clang');
      if (t - this.tEmpurrou < 0.3) return Q('empurra');
      if (!this.vx && this.t % 6 < 0.9) return Q('olha');
    }
    if (esp === 'borracha' && t - this.tQuica < 0.3) return Q('quica');
    if (esp === 'grampeador') {
      if (this.boca > 0.7) return Q('atira');
      if (this.boca > 0.3) return Q('recuo');
      if (this.recarga < 0.35) return Q('arma');
      return this.t % 6 < 0.9 ? Q('desconfia') : toca('parado', this.t);
    }
    if (this.vx && A.anda && !(this.zonzo > 0)) return Q('anda', Math.floor(this.dist / A.anda.passo) % A.anda.quadros.length);
    if (esp === 'escudeiro' && this.t % 3.5 < 0.14) return Q('pisca');
    return Q('parado') || Q('freia') || Q('anda');
  }

  desenha(ctx, t) {
    if (!this.vivo && this.morte.t > 1.4) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (!this.vivo) {
      ctx.globalAlpha = U.clamp(1.4 - this.morte.t, 0, 1);
      if (!this.morte.amassado) { ctx.translate(0, -this.cfg.h / 2); ctx.rotate(this.morte.rot); ctx.translate(0, this.cfg.h / 2); }
    }
    const zonzo = this.vivo && this.zonzo > 0;
    ctx.save();
    if (zonzo) ctx.rotate(Math.sin(this.t * 7) * 0.07); // zonzo: balança em cima dos pés
    const Q = Sprites.pronto(this.especie) && this._quadro(t);
    if (Q) Sprites.quadro(ctx, this.especie, Q, { f: this.f, pe: { x: 0, y: 0 } });
    else {
      ctx.save();
      ctx.scale(this.f, 1);
      const passo = this.vx ? Math.sin(this.t * 10) : 0;
      const esp = this.especie;
      if (esp === 'guarda' || esp === 'escudeiro') this._soldado(ctx, passo, esp === 'escudeiro');
      else if (esp === 'tesoureiro') this._tesoureiro(ctx);
      else if (esp === 'borracha') this._borracha(ctx);
      else if (esp === 'lixeira') this._cesto(ctx);
      else if (esp === 'blindado') this._blindado(ctx, passo);
      else this._grampeador(ctx);
      ctx.restore();
    }
    if (zonzo) this._estrelas(ctx, -this.cfg.cabeca - 12);
    ctx.restore();
    ctx.restore();
  }

  // estrelinhas de 5 pontas girando em cima da cabeça (zonzo): as de trás menores, como um anel visto de lado
  _estrelas(ctx, y) {
    for (let i = 0; i < 3; i++) {
      const a = this.t * 5 + (i * U.TAU) / 3, r = 6.5 + Math.sin(a) * 1.5;
      Estilo.forma(ctx, (c) => {
        const x0 = Math.cos(a) * 22, y0 = y + Math.sin(a) * 6;
        c.beginPath();
        for (let k = 0; k < 10; k++) {
          const ang = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
          c.lineTo(x0 + Math.cos(ang) * rr, y0 + Math.sin(ang) * rr);
        }
        c.closePath();
      }, { cor: '#ffd23f' }, { elev: 0, linha: 1.8, cel: false });
    }
  }

  _olhos(ctx, x, y, r, bravo = true) {
    for (const dx of [-r * 1.3, r * 1.3]) {
      Estilo.forma(ctx, (c) => U.elipse(c, x + dx, y, r, r * 1.15), { cor: '#fffdf6' }, { elev: 0, linha: 2, cel: false });
      Estilo.forma(ctx, (c) => U.circulo(c, x + dx + r * 0.35, y + 1, r * 0.5), { cor: '#1d1622' }, { elev: 0, linha: 0, cel: false });
    }
    if (bravo) {
      Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(x - r * 2.5, y - r * 1.6); c.lineTo(x - r * 0.3, y - r * 0.9); c.moveTo(x + r * 0.3, y - r * 0.9); c.lineTo(x + r * 2.5, y - r * 1.6); }, '#1d1622', 3, { elev: 0 });
    }
  }

  // Soldadinho de papel com chapéu de jornal (o escudeiro carrega um escudo de régua; o guarda, o lápis)
  _soldado(ctx, passo, escudo, corpo = escudo ? '#e0703a' : '#35467a') {
    for (const [dx, k] of [[-8, passo], [8, -passo]]) {
      Estilo.forma(ctx, (c) => U.retRed(c, dx - 6, -26 + Math.max(0, k) * -5, 12, 26, 5), { cor: '#2b2b3a' }, { elev: 1, linha: 2.5 });
    }
    Estilo.forma(ctx, (c) => U.retRed(c, -17, -64, 34, 42, 9), { cor: corpo }, { elev: 1.5, linha: 3 });
    for (const y of [-54, -44, -34]) Estilo.forma(ctx, (c) => U.circulo(c, 4, y, 2.5), { cor: '#f4d36a' }, { elev: 0, linha: 1.2, cel: false });
    Estilo.forma(ctx, (c) => U.circulo(c, 0, -76, 15), { cor: '#f0c29a' }, { elev: 1.5, linha: 3 });
    this._olhos(ctx, 4, -78, 4);
    Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(-2, -68); c.quadraticCurveTo(6, -64, 13, -68); }, '#4a2e22', 3, { elev: 0 });
    // chapéu de jornal
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(-19, -86); c.lineTo(0, -108); c.lineTo(19, -86); c.closePath(); }, { cor: '#f4f1e8' }, { elev: 1, linha: 2.5 });
    ctx.save(); ctx.strokeStyle = 'rgba(60,60,70,0.45)'; ctx.lineWidth = 1.5;
    for (const y of [-94, -90]) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8, y); ctx.stroke(); }
    ctx.restore();
    if (escudo) {
      // escudo de régua na frente
      Estilo.forma(ctx, (c) => U.retRed(c, 16, -88, 14, 76, 4), { cor: '#e9c77a' }, { elev: 1.5, linha: 3 });
      ctx.save(); ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1.5;
      for (let y = -82; y < -16; y += 8) { ctx.beginPath(); ctx.moveTo(26, y); ctx.lineTo(29, y); ctx.stroke(); }
      ctx.restore();
    } else if (this.especie !== 'guarda') {
      // (o tesoureiro desenha a tesoura por cima)
    } else if (this.golpe) {
      // estocada: lápis deitado na altura do peito — puxado para trás (armando), esticado até o alcance, recolhendo
      const G = ESTOCADA, t = this.golpe.t;
      const k = t < G.arma ? 0 : t < G.arma + G.estica ? 1 : 1 - U.prog(t, G.arma + G.estica, G.arma + G.estica + G.recolhe);
      const b = U.lerp(45, G.alcance, k), a = b - 85, y = (G.y0 + G.y1) / 2;
      Estilo.forma(ctx, (c) => U.retRed(c, a, y - 3.5, b - a - 14, 7, 2), { cor: '#f2c230' }, { elev: 1, linha: 2.2 });
      Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(b - 14, y - 3.5); c.lineTo(b, y); c.lineTo(b - 14, y + 3.5); c.closePath(); }, { cor: '#efcf9c' }, { elev: 0, linha: 2, cel: false });
    } else {
      // lança de lápis em pé (tonto: a ponta quebrou — ele fica apontando, com estrelinhas girando na cabeça)
      Estilo.forma(ctx, (c) => U.retRed(c, 14, -100, 7, 74, 2), { cor: '#f2c230' }, { elev: 1, linha: 2.2 });
      if (this.tonto > 0) {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + (i * U.TAU) / 3;
          Estilo.forma(ctx, (c) => U.circulo(c, Math.cos(a) * 16, -116 + Math.sin(a) * 4, 3.5), { cor: '#ffd23f' }, { elev: 0, linha: 1.5, cel: false });
        }
      } else Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(14, -100); c.lineTo(17.5, -114); c.lineTo(21, -100); c.closePath(); }, { cor: '#efcf9c' }, { elev: 0, linha: 2, cel: false });
    }
  }

  // Tesoureiro (desenho por código): soldadinho de jaqueta verde com a tesoura grande na frente, na altura do peito
  // (a ponta onde ela corta: TESOURA.ponta). Armando, abre e fecha; correndo, inclina; cravado, puxa para trás.
  _tesoureiro(ctx) {
    const T = TESOURA, y = (T.y0 + T.y1) / 2, m = this.modo;
    ctx.save();
    ctx.rotate(m === 'corre' ? 0.16 : m === 'cravado' || m === 'grudado' ? -0.1 : 0);
    this._soldado(ctx, m === 'corre' ? Math.sin(this.t * 30) : 0, false, '#3f8a5a');
    ctx.restore();
    const abre = m === 'arma' ? Math.abs(Math.sin(this.armando * 30)) * 0.35 : 0.05, L = T.ponta - 12;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(12, y); ctx.rotate(s * abre);
      Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(0, -4); c.lineTo(L, 0); c.lineTo(0, 4); c.closePath(); }, { cor: '#d5dbe2' }, { elev: 0.5, linha: 2 });
      Estilo.forma(ctx, (c) => U.circulo(c, -7, s * 6, 5.5), { cor: '#e2433a' }, { elev: 0.5, linha: 2, cel: false });
      ctx.restore();
    }
    if (m === 'tonto') {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 5 + (i * U.TAU) / 3;
        Estilo.forma(ctx, (c) => U.circulo(c, Math.cos(a) * 16, -116 + Math.sin(a) * 4, 3.5), { cor: '#ffd23f' }, { elev: 0, linha: 1.5, cel: false });
      }
    }
  }

  // Blindado (desenho por código): o soldadinho dentro de uma lata de lápis de metal — só as pernas embaixo e os olhos
  // bravos na fresta; CLANG: a lata treme
  _blindado(ctx, passo) {
    for (const [dx, k] of [[-9, passo], [9, -passo]]) {
      Estilo.forma(ctx, (c) => U.retRed(c, dx - 6, -26 + Math.max(0, k) * -5, 12, 26, 5), { cor: '#2b2b3a' }, { elev: 1, linha: 2.5 });
    }
    Estilo.forma(ctx, (c) => U.retRed(c, -22, -96, 44, 74, 8), { cor: '#9aa3ad' }, { elev: 2, linha: 3.5 });
    Estilo.forma(ctx, (c) => U.retRed(c, -14, -92, 8, 66, 4), { cor: '#d7dde3', luz: false }, { elev: 0, linha: 0, cel: false }); // brilho
    for (const y of [-40, -60]) Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(-22, y); c.lineTo(22, y); }, '#6c747d', 2.5, { elev: 0 }); // frisos
    Estilo.forma(ctx, (c) => U.retRed(c, -24, -100, 48, 10, 4), { cor: '#7d868f' }, { elev: 1, linha: 2.5 }); // a borda de cima
    Estilo.forma(ctx, (c) => U.retRed(c, -16, -84, 32, 12, 4), { cor: '#1d1622' }, { elev: 0, linha: 2, cel: false }); // a fresta
    this._olhos(ctx, 2, -78, 3.6);
    for (const x of [-16, 16]) Estilo.forma(ctx, (c) => U.circulo(c, x, -50, 2.2), { cor: '#c9cfd6' }, { elev: 0, linha: 1, cel: false }); // rebites
  }

  // Lixeira (desenho por código): cesto azul com papel saindo; armando, inclina para trás com a bolinha em cima
  _cesto(ctx) {
    const k = this.jogando != null ? U.clamp(this.jogando / LIXEIRA.arma, 0, 1) : 0;
    ctx.save();
    ctx.rotate(-k * 0.2);
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(-18, 0); c.lineTo(-24, -50); c.lineTo(24, -50); c.lineTo(18, 0); c.closePath(); }, { cor: '#5f8fb8' }, { elev: 1.5, linha: 3 });
    ctx.save(); ctx.strokeStyle = 'rgba(30,50,80,0.45)'; ctx.lineWidth = 2;
    for (const x of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(x * 0.8, -4); ctx.lineTo(x, -46); ctx.stroke(); }
    ctx.restore();
    for (const [x, y, r] of [[-9, -52, 8], [7, -55, 7]]) Estilo.forma(ctx, (c) => U.circulo(c, x, y, r), { cor: '#fbf7ec' }, { elev: 1, linha: 2.2 });
    if (k > 0) Estilo.forma(ctx, (c) => U.circulo(c, -4, -62 - k * 6, LIXEIRA.raio), { cor: '#fbf7ec' }, { elev: 1, linha: 2.2 });
    Estilo.forma(ctx, (c) => U.retRed(c, -27, -54, 54, 7, 3), { cor: '#4a7399' }, { elev: 1, linha: 2.5 });
    this._olhos(ctx, 6, -34, 4.5);
    ctx.restore();
  }

  _borracha(ctx) {
    const b = Math.sin(this.t * 22) * 2;
    ctx.save();
    ctx.rotate(Math.sin(this.t * 22) * 0.05);
    Estilo.forma(ctx, (c) => U.retRed(c, -25, -34 + Math.abs(b), 50, 34 - Math.abs(b), 9), { cor: '#f28aa0' }, { elev: 1.5, linha: 3 });
    Estilo.forma(ctx, (c) => U.retRed(c, -25, -34 + Math.abs(b), 22, 34 - Math.abs(b), 9), { cor: '#6fa8e8' }, { elev: 0, linha: 3, cel: false });
    this._olhos(ctx, 8, -20, 4.5);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(80,60,60,0.35)'; ctx.lineWidth = 2;
    for (const y of [-26, -16, -8]) { ctx.beginPath(); ctx.moveTo(-34, y); ctx.lineTo(-44 - Math.random() * 6, y); ctx.stroke(); }
    ctx.restore();
  }

  _grampeador(ctx) {
    const abre = this.boca * 0.35;
    Estilo.forma(ctx, (c) => U.retRed(c, -30, -12, 60, 12, 4), { cor: '#3d3a4a' }, { elev: 1.5, linha: 3 });
    ctx.save();
    ctx.translate(-26, -14);
    ctx.rotate(-abre);
    Estilo.forma(ctx, (c) => U.retRed(c, 0, -22, 60, 20, 7), { cor: '#e0443a' }, { elev: 1.5, linha: 3 });
    this._olhos(ctx, 36, -12, 4);
    ctx.restore();
    Estilo.forma(ctx, (c) => U.circulo(c, -26, -14, 5), { cor: '#9aa3ad' }, { elev: 0, linha: 2, cel: false });
  }
}

// Bolinha de papel da lixeira em voo (desenho da IA; rebatida, com um brilho amarelo)
function desenhaBolinha(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.rebatida) Estilo.forma(ctx, (c) => U.circulo(c, 0, 0, LIXEIRA.raio + 5), { cor: '#ffe483', luz: false }, { elev: 0, linha: 0, cel: false });
  ctx.rotate(b.giro);
  if (typeof Objetos !== 'undefined' && Objetos.pronto() && Objetos.imgs.bolinha) {
    const [w, h] = Objetos.d.durex.bolinha;
    ctx.drawImage(Objetos.imgs.bolinha, -w / 2, -h / 2, w, h);
  } else {
    Estilo.forma(ctx, (c) => U.circulo(c, 0, 0, LIXEIRA.raio), { cor: '#fbf7ec' }, { elev: 1, linha: 2.2 });
    Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(-5, -4); c.lineTo(1, 0); c.lineTo(-2, 6); c.moveTo(1, 0); c.lineTo(6, -3); }, '#9aa3ad', 1.4, { elev: 0 });
  }
  ctx.restore();
}

// Grampo em voo (desenho)
function desenhaGrampo(ctx, g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(Math.sign(g.vx) || 1, 1);
  Estilo.traco(ctx, (c) => { c.beginPath(); c.moveTo(6, -6); c.lineTo(-6, -6); c.lineTo(-6, 6); c.lineTo(6, 6); }, g.rebatido ? '#ffd23f' : '#c9cfd6', 4, { elev: 0, contorno: true });
  ctx.restore();
}
