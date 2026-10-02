'use strict';

// Robô de teste: segue um roteiro e aperta as teclas. Serve para provar que cada sala tem solução.
// Comandos: ['ativa', id] ['anda', x] ['vai', x] (anda e pula quando trava) ['olha', ±1] ['acao'] ['pula']
//           ['salta', xPulo, x] (corre até x e pula ao passar de xPulo: vão, poça) ['marca'] (anota no registro onde
//           o herói ativo está: 'marca marreta x=512')
//           ['gancho'] (↓ + E: o gancho do Marreta, que arremessa para o alto; só ['acao'] é o soco reto)
//           ['segura', tecla, s] ['espera', s] ['esperaChao', id, limite]
//           ['sobe'] / ['desce'] (segura ↑/↓ até terminar a escada ou a corda)
//           ['rola', x] (Pudim: vira bola andando, rola até x, freia e levanta)
//           ['soca' | 'bundada' | 'barriga' | 'rebate', x0, x1] (luta com o inimigo entre x0 e x1; barriga: o Pudim
//           desarma o guarda ou o tesoureiro e fica de escudo na frente — quem derruba é o Marreta)
//           ['pisa', espécie, x] (Fiapo: pula na cabeça do inimigo — ele fica zonzo — e segue até x)
//           ['empurra', x] (Marreta: empurra o estojo de zíper até o meio dele chegar em x; para se ele cair ou travar)
//           ['desvia', espécie, x] (quem não luta pula por cima no caminho até x) ['espreita', espécie, x, ±1] (espera o
//           inimigo passar por x indo naquele sentido)
//           ['bundadaEm', xPulo, x] (Pudim: anda para x, pula ao passar de xPulo e dá a bundada em cima de x: gangorra)
//           ['carimbo', x] (anda até x passando pelos carimbos no tempo certo: espera antes do que vai descer em cima)
//           ['pulaEm', x] (pula já e se ajeita no ar até x: post-its, plataformas; termina ao pousar)
class Bot {
  constructor(roteiro) { this.r = roteiro; this.i = 0; this.tCmd = 0; this.tPulo = -1; this.recarga = 0; this.preso = 0; }

  passo(J, dt) {
    const E = { esq: false, dir: false, cima: false, baixo: false, pulo: false, acao: false, troca: false, reinicia: false, sel: null };
    if (this.i >= this.r.length) return E;
    const [op, a, b, c] = this.r[this.i];
    const h = J.heroi;
    // a bola do Pudim deixada para trás continua bola: antes de seguir o roteiro, ele levanta
    if (h.id === 'pudim' && h.estado === 'rolando' && !['rola', 'espera', 'esperaChao', 'ativa', 'marca', 'rolo', 'acao', 'pula'].includes(op)) {
      if (h.noChao && Math.abs(h.vx) < 30) E.acao = true;
      return E;
    }
    this.tCmd += dt;
    let feito = false;
    if (op === 'ativa') { E.sel = ORDEM.indexOf(a); feito = true; }
    else if (op === 'anda') {
      const d = a - h.x;
      const travado = this.tCmd > 0.3 && Math.abs(h.vx) < 5 && h.estado === 'chao';
      if (Math.abs(d) < 4 || travado || this.tCmd > 10) feito = true;
      else if (d > 0) E.dir = true; else E.esq = true;
    } else if (op === 'vai') {
      const d = a - h.x;
      if (Math.abs(d) < 6 || this.tCmd > 12) feito = true;
      else {
        if (d > 0) E.dir = true; else E.esq = true;
        const parado = h.noChao && h.estado === 'chao' && Math.abs(h.vx) < 15 && this.tCmd > 0.15;
        if (parado && this.tCmd - this.tPulo > 0.5) { E.pulo = true; this.tPulo = this.tCmd; }
      }
    } else if (op === 'bundadaEm') {
      const d = b - h.x;
      if (this.pulou && h.noChao && h.estado === 'chao') feito = true;
      else if (h.noChao && h.estado === 'chao') { // (já em cima do alvo: pula sem andar — andando, passava dele)
        if (Math.abs(d) > 6) E[d > 0 ? 'dir' : 'esq'] = true;
        if (Math.abs(d) <= 6 || (a - h.x) * Math.sign(d) <= 0) { E.pulo = true; this.pulou = true; }
      }
      else if (h.estado === 'ar') { if (Math.abs(d) > 6) E[d > 0 ? 'dir' : 'esq'] = true; if (Math.abs(d) < 16 && h.vy > -80) E.acao = true; }
      if (this.tCmd > 8) feito = true;
    } else if (op === 'pulaEm') {
      const d = a - h.x;
      if (this.pulou && h.noChao && h.estado === 'chao' && this.tCmd > 0.15) feito = true;
      else if (!this.pulou && h.noChao) { E.pulo = true; this.pulou = true; }
      if (!feito && Math.abs(d) > 6) E[d > 0 ? 'dir' : 'esq'] = true;
      if (this.tCmd > 4) feito = true;
    } else if (op === 'carimbo') {
      const d = a - h.x, s = Math.sign(d) || 1;
      if (Math.abs(d) < 6 || this.tCmd > 25) feito = true;
      else {
        // zona de cada carimbo = onde o corpo pega o herói. Nunca para dentro de uma (segue); de fora, só entra se, andando,
        // atravessa até um lugar livre (a próxima zona emendada conta junto: entre elas não dá para parar) sem nenhum
        // corpo abaixo da cabeça dele no caminho
        const v = h.cfg.vel, w = h.cfg.w / 2, topo = h.y - h.cfg.h;
        const zonas = J.nivel.carimbos.filter((k) => Math.abs(k.chao - h.y) <= 60)
          .map((k) => ({ k, z0: k.x - CARIMBO.w / 2 - w, z1: k.x + CARIMBO.w / 2 + w }))
          .filter((z) => (s > 0 ? z.z1 > h.x && z.z0 < a : z.z0 < h.x && z.z1 > a))
          .sort((p, q) => (s > 0 ? p.z0 - q.z0 : q.z1 - p.z1));
        let pode = true;
        if (!zonas.some((z) => h.x > z.z0 && h.x < z.z1)) {
          for (let i = 0; i < zonas.length; i++) {
            const z = zonas[i], dEntra = s > 0 ? z.z0 - h.x : h.x - z.z1, dSai = s > 0 ? z.z1 - h.x : h.x - z.z0;
            if (i === 0 && dEntra > 90) break; // longe ainda: decide perto
            for (let tt = Math.max(0, dEntra) / v; tt <= dSai / v + 0.15; tt += 0.03) if (z.k.caixa(J.t + tt).y1 > topo - 6) { pode = false; break; }
            const prox = zonas[i + 1];
            if (!pode || !prox || (s > 0 ? prox.z0 - z.z1 : z.z0 - prox.z1) >= 8) break;
          }
        }
        if (pode) E[s > 0 ? 'dir' : 'esq'] = true;
      }
    } else if (op === 'olha') { if (a > 0) E.dir = true; else E.esq = true; feito = true; }
    else if (op === 'rola') {
      const d = a - h.x, dir = Math.sign(d) || 1;
      if (h.estado === 'rolando') {
        this.rolou = true;
        if (Math.abs(d) > (h.vx * h.vx) / (2 * 650) + 8) E[dir > 0 ? 'dir' : 'esq'] = true; // perto: solta e a bola freia
        else if (h.noChao && Math.abs(h.vx) < 30) E.acao = true; // parou: E levanta
      } else if (this.rolou) feito = h.noChao && h.estado === 'chao';
      else if (h.noChao && h.estado === 'chao') { E[dir > 0 ? 'dir' : 'esq'] = true; if (this.tCmd > 0.08) E.acao = true; }
      if (this.tCmd > 14) feito = true;
    }
    else if (op === 'soca' || op === 'bundada' || op === 'barriga' || op === 'rebate') {
      // luta com o inimigo vivo mais perto à frente (a partir de x = a, se dado)
      // (bundada pulando do chão só amassa a borracha: guarda e escudeiro, só caindo de cima)
      const tipos = { soca: ['guarda', 'escudeiro', 'tesoureiro'], bundada: ['borracha'], barriga: ['guarda', 'tesoureiro'], rebate: ['grampeador'] }[op];
      // (100 px de folga: o tesoureiro que quica na barriga voa ~75 px para trás e pode sair da faixa da sala)
      const x0 = a != null ? a - 100 : h.x - 60, x1 = b != null ? b + 100 : Infinity;
      const alvo = J.inimigos.filter((o) => o.vivo && tipos.includes(o.especie) && o.x > x0 && o.x < x1 && Math.abs(o.y - h.y) < 120)
        .sort((p, q) => Math.abs(p.x - h.x) - Math.abs(q.x - h.x))[0];
      if (!alvo || this.tCmd > 25) feito = true;
      else if (h.estado === 'chao' || h.estado === 'ar' || h.estado === 'rolando') {
        const d = alvo.x - h.x, dir = Math.sign(d) || 1;
        this.recarga = Math.max(0, (this.recarga || 0) - dt);
        if (op === 'soca') {
          // guarda: fica fora do lápis enquanto ele arma e estoca, e soca na volta. Escudeiro de frente: gancho (vem por
          // baixo da régua); de costas, soco.
          const G = ESTOCADA, golpe = alvo.escudoPara(h.x) ? 'gancho' : 'soco';
          const lapis = alvo.especie === 'guarda' && alvo.golpe && alvo.golpe.t < G.arma + G.estica;
          // tesoureiro solto e virado para ele: espera (a tesoura chega antes da luva); preso, vai e soca — se der tempo de
          // chegar antes de ele soltar (perto e sem tempo, espera atrás do escudo: o Pudim)
          const chega = Math.max(0, Math.abs(d) - 80) / h.cfg.vel + 0.15;
          const tesoura = alvo.especie === 'tesoureiro' && Math.sign(h.x - alvo.x) === alvo.f
            && (!(alvo.preso > 0) || (alvo.preso < chega && Math.abs(d) < TESOURA.ve + 60));
          if (lapis) { if (Math.abs(d) < G.alcance + 50) E[dir > 0 ? 'esq' : 'dir'] = true; } // recua da estocada
          else if (tesoura) { /* parado */ }
          else if (h.f !== dir) E[dir > 0 ? 'dir' : 'esq'] = true;
          else if (h.inimigoNaFrente([alvo], golpe)) {
            if (this.recarga <= 0) { E.acao = true; E.baixo = golpe === 'gancho'; this.recarga = 0.5; }
          } else E[dir > 0 ? 'dir' : 'esq'] = true;
        } else if (op === 'barriga') { // Pudim de escudo: chega perto (sem encostar: pelas costas a ponta machuca) e
          // espera ele vir — o lápis quebra na barriga, a tesoura quica. Desarmado, fica ali na frente.
          const desarmado = (alvo.especie === 'guarda' && alvo.tonto > 0) || (alvo.especie === 'tesoureiro' && alvo.preso > 0);
          if (desarmado) feito = true;
          else if (Math.abs(d) > (alvo.cfg.w + h.cfg.w) / 2 + 40) E[dir > 0 ? 'dir' : 'esq'] = true;
          else if (h.f !== dir) E[dir > 0 ? 'dir' : 'esq'] = true;
        } else if (op === 'bundada') { // pula e, lá em cima, E: bundada
          const vem = Math.sign(alvo.vx || -dir) === -dir;
          // presa (contra a parede ela quica na barriga e fica sempre a 68 px, fora do alcance da bundada): no ar, se ajeita
          // em cima dela. Andando, não: ela vem para baixo dele
          const parada = Math.abs(alvo.x - (this.xAlvo ?? alvo.x)) < 0.5; this.xAlvo = alvo.x;
          if (!h.noChao && parada && Math.abs(d) > 8) E[dir > 0 ? 'dir' : 'esq'] = true;
          if (h.estado === 'ar' && this.bundar && h.vy > -120) { E.acao = true; this.bundar = false; }
          else if (h.noChao && h.estado === 'chao' && Math.abs(d) < (vem ? 150 : 80) && this.recarga <= 0) { E.pulo = true; this.bundar = true; this.recarga = 1.3; }
          else if (h.noChao && Math.abs(d) > 60 && !(vem && Math.abs(d) < 220)) E[dir > 0 ? 'dir' : 'esq'] = true;
        } else if (Math.abs(d) > 60) E[dir > 0 ? 'dir' : 'esq'] = true; // rebate: é só ir andando na frente
        // travou numa mureta andando (parado um tempinho, não só no primeiro passo): pula
        const parado = h.noChao && h.estado === 'chao' && Math.abs(h.vx) < 15 && (E.dir || E.esq);
        this.preso = parado ? this.preso + dt : 0;
        if (this.preso > 0.25 && this.tCmd - this.tPulo > 0.6) { E.pulo = true; this.tPulo = this.tCmd; }
      }
    }
    else if (op === 'sobe' || op === 'desce') {
      E[op === 'sobe' ? 'cima' : 'baixo'] = true;
      const subindo = h.estado === 'escada' || h.estado === 'escalando';
      if (subindo) this.subiu = true;
      feito = (this.subiu && !subindo && h.noChao) || this.tCmd > (a || 14);
    }
    else if (op === 'salta') {
      const d = b - h.x, ida = Math.sign(b - a) || 1;
      if (!this.saltou && ida * (h.x - a) >= 0 && h.noChao) { E.pulo = true; this.saltou = true; }
      if (Math.abs(d) < 6 || this.tCmd > 10) feito = true; else E[d > 0 ? 'dir' : 'esq'] = true;
    }
    else if (op === 'cesta') { // Marreta rebate a bolinha da lixeira de volta nela: CESTA!
      const alvo = J.inimigos.find((o) => o.vivo && o.especie === 'lixeira' && (a == null || (o.x > a && o.x < b)));
      if (!alvo || this.tCmd > 30) feito = true;
      else if (h.estado === 'chao' && h.noChao) {
        const d = alvo.x - h.x, dir = Math.sign(d) || 1;
        if (Math.abs(d) > LIXEIRA.ve - 40) E[dir > 0 ? 'dir' : 'esq'] = true; // chega no alcance dela
        else if (Math.abs(d) < 150) E[dir > 0 ? 'esq' : 'dir'] = true;  // nem colado embaixo
        else if (h.f !== dir) E[dir > 0 ? 'dir' : 'esq'] = true;        // vira para ela
        else { // a bolinha vai estar na luva (e ainda fora do corpo, senão já bateu nele) quando o golpe acertar? bate.
          // Vindo reta (lixeira na mesma altura) serve o soco; caindo do alto, o gancho (↓+E) que sobe até a cabeça.
          const r = LIXEIRA.raio;
          const vem = (g) => {
            const t = GOLPES[g].acerta, z = h.zonaGolpe(g);
            return J.bolinhas.some((q) => {
              if (q.rebatida) return false;
              const x = q.x + q.vx * t, y = q.y + q.vy * t + 0.5 * LIXEIRA.g * t * t;
              return x > z.x0 - r && x < z.x1 + r && y > z.y0 - r && y < z.y1 + r && Math.abs(x - h.x) > h.cfg.w / 2 + r + 2;
            });
          };
          if (vem('soco')) E.acao = true;
          else if (vem('gancho')) { E.acao = true; E.baixo = true; }
        }
      }
    }
    else if (op === 'desvia') { // pula por cima do inimigo (espécie a) no caminho até b — quem não luta (o Fiapo). Do
      // guarda, fica fora do lápis enquanto ele arma e estoca, e pula quando recolhe; da borracha, pula quando ela chega
      const d = b - h.x, dir = Math.sign(d) || 1, vai = () => { E[dir > 0 ? 'dir' : 'esq'] = true; };
      const o = J.inimigos.filter((q) => q.vivo && q.especie === a && Math.sign(q.x - h.x) === dir && Math.abs(q.y - h.y) < 60)
        .sort((p, q) => Math.abs(p.x - h.x) - Math.abs(q.x - h.x))[0];
      const dx = o ? Math.abs(o.x - h.x) : Infinity;
      // pula quando o ponto mais alto do pulo cai em cima do inimigo (antes, a descida pousa nele: encostar machuca)
      const pico = h.cfg.vel * Math.sqrt(2 * GRAV * h.cfg.pulo) / GRAV + 4;
      if (Math.abs(d) < 8 || this.tCmd > 25) feito = true;
      else if (!h.noChao || !o) vai();
      else if (a === 'guarda') {
        const G = ESTOCADA, g = o.golpe;
        if (g && g.t < G.arma + G.estica) { if (dx < G.alcance + 70) E[dir > 0 ? 'esq' : 'dir'] = true; } // recua da estocada
        else if (g) { vai(); if (dx < pico) E.pulo = true; } // recolhendo: passa por cima
        else if (dx > 170) vai(); // chega perto para ele estocar
      } else if (o.f === dir && dx < 160) { // indo embora: espera (senão alcança e cai em cima dela)
      } else { vai(); if (dx < pico && o.f !== dir) E.pulo = true; } // vindo: pula na hora
    }
    else if (op === 'isca') { // Fiapo de isca: para em a e, quando a tesoura vem correndo, pula (o tesoureiro passa embaixo)
      const o = J.inimigos.filter((q) => q.vivo && q.especie === 'tesoureiro').sort((p, q) => Math.abs(p.x - h.x) - Math.abs(q.x - h.x))[0];
      if (!o || (o.preso > 0 && h.noChao && h.estado === 'chao') || this.tCmd > 15) feito = true;
      else if (o.modo === 'corre') {
        const ponta = o.x + o.f * TESOURA.ponta, borda = h.x - o.f * h.cfg.w / 2;
        if (h.noChao && o.f * (borda - ponta) < 90) E.pulo = true;
      } else if (o.modo !== 'arma' && a != null && Math.abs(a - h.x) > 6) E[a > h.x ? 'dir' : 'esq'] = true;
    }
    else if (op === 'pisa') { // Fiapo: pula e cai na cabeça do inimigo (espécie a) — ele fica zonzo — e segue até b. Do
      // guarda, fica fora do lápis enquanto ele arma e estoca; pula de onde o pulo desce em cima da cabeça dele
      const d = b - h.x, dir = Math.sign(d) || 1, vai = (x) => { if (Math.abs(x - h.x) > 4) E[x > h.x ? 'dir' : 'esq'] = true; };
      const o = J.inimigos.filter((q) => q.vivo && q.especie === a && Math.sign(q.x - h.x) === dir && Math.abs(q.y - h.y) < 60)
        .sort((p, q) => Math.abs(p.x - h.x) - Math.abs(q.x - h.x))[0];
      const v0 = Math.sqrt(2 * GRAV * h.cfg.pulo), cai = o ? Math.max(0, h.cfg.pulo - Math.max(o.cfg.cabeca, o.cfg.h)) : 0;
      const alcance = h.cfg.vel * (v0 / GRAV + Math.sqrt(2 * cai / GRAV)); // do pulo até a descida passar pela cabeça
      if (Math.abs(d) < 8 || this.tCmd > 25) feito = true;
      else if (!h.noChao) { if (o && !(o.zonzo > 0) && !this.pisou) vai(o.x); else vai(b); }
      else if (!o || o.zonzo > 0) { this.pisou = !!o; vai(b); }
      else {
        // (onde ele vai estar quando a descida passar pela cabeça: andando, ele sai do lugar)
        const dx = Math.abs(o.x + o.vx * (alcance / h.cfg.vel) - h.x), G = ESTOCADA, g = a === 'guarda' && o.golpe;
        if (g && g.t < G.arma + G.estica) { if (Math.abs(o.x - h.x) < G.alcance + 70) E[dir > 0 ? 'esq' : 'dir'] = true; } // recua da estocada
        else { vai(b); if (dx <= alcance) E.pulo = true; }
      }
    }
    else if (op === 'empurra') { // o Marreta empurra o estojo de zíper até o meio dele chegar em a (ou cair, ou travar)
      const e = (J.nivel.estojos || []).slice().sort((p, q) => Math.abs(p.x - h.x) - Math.abs(q.x - h.x))[0];
      if (!e || this.tCmd > 30) feito = true;
      else {
        if (this.yEstojo == null) this.yEstojo = e.y;
        const d = a - e.x, dir = Math.sign(d) || 1;
        if (Math.abs(d) < 4 || e.y > this.yEstojo + 20 || (e.travado === dir && this.tCmd > 1)) feito = true;
        else E[dir > 0 ? 'dir' : 'esq'] = true;
      }
    }
    else if (op === 'espreita') { // espera o inimigo (espécie a) passar por b indo no sentido c (ex.: a borracha indo embora)
      const o = J.inimigos.filter((q) => q.vivo && q.especie === a).sort((p, q) => Math.abs(p.x - h.x) - Math.abs(q.x - h.x))[0];
      feito = !o || this.tCmd > 20 || (o.f === c && c * (o.x - b) >= 0 && c * (o.x - b) < 40);
    }
    else if (op === 'rolo') { J.registra(`rolo x=${Math.round(J.nivel.durex[0].x)}`); feito = true; } // onde está o durex
    else if (op === 'marca') { J.registra(`marca ${h.id} x=${Math.round(h.x)}`); feito = true; }
    else if (op === 'acao') { E.acao = true; feito = true; }
    else if (op === 'gancho') { E.acao = true; E.baixo = true; feito = true; }
    else if (op === 'pula') { E.pulo = true; feito = true; }
    else if (op === 'segura') { E[a] = true; feito = this.tCmd >= b; }
    else if (op === 'espera') feito = this.tCmd >= a;
    else if (op === 'esperaChao') {
      const o = J.herois.find((x) => x.id === a);
      feito = (o.estado === 'chao' && o.noChao && !o.apoio) || this.tCmd > (b || 6);
    }
    if (feito) { this.i++; this.tCmd = 0; this.tPulo = -1; this.subiu = false; this.recarga = 0; this.preso = 0; this.rolou = false; this.bundar = false; this.saltou = false; this.pulou = false; this.pisou = false; this.xAlvo = null; this.yEstojo = null; }
    return E;
  }
}

// Roda um roteiro numa sala, em velocidade máxima e sem desenhar
function simula(def, roteiro, tmax = 90) {
  const m = new Mundo(def, { bot: new Bot(roteiro), rapido: true });
  let t = 0;
  while (t < tmax && m.estado === 'jogando') { m.passo(Jogo.PASSO, {}); t += Jogo.PASSO; }
  return {
    venceu: m.estado === 'venceu', t: +t.toFixed(2), comando: `${m.bot.i}/${roteiro.length}`, cmd: roteiro[m.bot.i],
    herois: m.herois.map((h) => `${h.id} x=${h.x.toFixed(0)} y=${h.y.toFixed(0)} ${h.estado}`),
    corda: m.cordas.resumo(), log: m.log.slice(-30), logTodo: m.log, m,
  };
}

// Uma solução para cada sala (a de "referência"; o jogador pode achar outras)
const ROTEIROS = [
  [
    ['ativa', 'fiapo'], ['anda', 420], ['acao'], ['espera', 0.4],
    ['ativa', 'marreta'], ['anda', 382], ['acao'], ['espera', 0.5], ['esperaChao', 'fiapo'],
    ['ativa', 'fiapo'], ['anda', 820], ['acao'], ['espera', 0.4],
    ['ativa', 'marreta'], ['anda', 1160],
    ['ativa', 'pudim'], ['anda', 1160],
    ['ativa', 'fiapo'], ['anda', 1160], ['espera', 0.5],
  ],
  [
    ['ativa', 'pudim'], ['anda', 644],
    ['ativa', 'fiapo'], ['anda', 560], ['pula'], ['segura', 'dir', 1.2], ['esperaChao', 'fiapo'],
    ['anda', 700], ['acao'], ['espera', 0.4], ['anda', 770], ['acao'], ['espera', 0.5],
    ['ativa', 'marreta'], ['anda', 670], ['segura', 'cima', 3], ['espera', 0.3],
    ['ativa', 'pudim'], ['anda', 670], ['segura', 'cima', 4], ['espera', 0.3], ['anda', 820], ['espera', 1.0],
    ['anda', 960], ['ativa', 'marreta'], ['anda', 960], ['ativa', 'fiapo'], ['anda', 960], ['espera', 0.5],
  ],
  [
    ['ativa', 'fiapo'], ['anda', 460], ['acao'], ['espera', 0.4], ['anda', 300],
    ['ativa', 'marreta'], ['anda', 262], ['acao'], ['espera', 0.5], ['esperaChao', 'fiapo'],
    ['ativa', 'fiapo'], ['anda', 780], ['acao'], ['espera', 0.4],
    ['ativa', 'marreta'], ['anda', 470], ['espera', 2.0], ['anda', 1010], ['acao'], ['espera', 0.6],
    ['ativa', 'pudim'], ['anda', 470], ['espera', 2.5], ['anda', 1160], ['pula'], ['espera', 0.12], ['acao'], ['espera', 1.2], ['anda', 1222],
    ['ativa', 'marreta'], ['anda', 1140], ['espera', 0.8],
    ['ativa', 'fiapo'], ['anda', 1140], ['espera', 0.8],
  ],
];

// Outras soluções (as que jogadores de verdade tentaram) — também precisam funcionar
const ROTEIROS_ALT = [
  { sala: 1, nome: 'corda da tachinha até o Pudim', r: [
    ['ativa', 'pudim'], ['anda', 644],
    ['ativa', 'fiapo'], ['anda', 560], ['pula'], ['segura', 'dir', 1.2], ['esperaChao', 'fiapo'],
    ['anda', 700], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['anda', 560],
    ['ativa', 'fiapo'], ['anda', 630], ['esperaChao', 'fiapo'], ['anda', 600], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['anda', 610], ['segura', 'cima', 4.5], ['espera', 0.3], ['anda', 820], ['espera', 1.0], ['anda', 960],
    ['ativa', 'marreta'], ['anda', 660], ['segura', 'cima', 3], ['espera', 0.3], ['anda', 960],
    ['ativa', 'fiapo'], ['anda', 660], ['segura', 'cima', 3], ['espera', 0.3], ['anda', 960], ['espera', 0.5],
  ] },
  { sala: 1, nome: 'rampa: Pudim longe da parede, Marreta pula na corda e sobe andando', r: [
    ['ativa', 'pudim'], ['anda', 644],
    ['ativa', 'fiapo'], ['anda', 560], ['pula'], ['segura', 'dir', 1.2], ['esperaChao', 'fiapo'],
    ['anda', 700], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['anda', 360],
    ['ativa', 'fiapo'], ['anda', 630], ['esperaChao', 'fiapo'], ['anda', 420], ['acao'], ['espera', 0.4],
    ['ativa', 'marreta'], ['anda', 430], ['pula'], ['espera', 0.7], ['anda', 720], ['espera', 0.3],
    ['ativa', 'pudim'], ['anda', 610], ['segura', 'cima', 6], ['espera', 0.3], ['anda', 820], ['espera', 1.0], ['anda', 960],
    ['ativa', 'fiapo'], ['anda', 660], ['segura', 'cima', 3], ['espera', 0.3], ['anda', 960],
    ['ativa', 'marreta'], ['anda', 960], ['espera', 0.5],
  ] },
  { sala: 1, nome: 'amarra primeiro no Pudim, depois na tachinha', r: [
    ['ativa', 'pudim'], ['anda', 644],
    ['ativa', 'fiapo'], ['anda', 575], ['acao'], ['espera', 0.4], ['anda', 560], ['pula'], ['segura', 'dir', 1.2], ['esperaChao', 'fiapo'],
    ['anda', 700], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['segura', 'cima', 4.5], ['espera', 0.3], ['anda', 820], ['espera', 1.0], ['anda', 960],
    ['ativa', 'marreta'], ['anda', 660], ['segura', 'cima', 3], ['espera', 0.3], ['anda', 960],
    ['ativa', 'fiapo'], ['anda', 960], ['espera', 0.5],
  ] },
  { sala: 1, nome: 'E longe do Pudim (não pode largar a corda) e depois perto', r: [
    ['ativa', 'pudim'], ['anda', 644],
    ['ativa', 'fiapo'], ['anda', 560], ['pula'], ['segura', 'dir', 1.2], ['esperaChao', 'fiapo'],
    ['anda', 700], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['anda', 470],
    ['ativa', 'fiapo'], ['anda', 630], ['esperaChao', 'fiapo'], ['acao'], ['espera', 0.4], ['anda', 520], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['anda', 610], ['segura', 'cima', 5], ['espera', 0.3], ['anda', 820], ['espera', 1.0], ['anda', 960],
    ['ativa', 'marreta'], ['anda', 660], ['segura', 'cima', 3], ['espera', 0.3], ['anda', 960],
    ['ativa', 'fiapo'], ['anda', 660], ['segura', 'cima', 3], ['espera', 0.3], ['anda', 960], ['espera', 0.5],
  ] },
];

// Parede rachada alta (ninguém pula por cima) entre os três e a saída
const PAREDE_SOCO = { nome: 'teste do soco', mapa: [
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '................................', '..............C.................', '..............C.................',
  '..............C............SS...', '..............C............SS...', '.3.2.1........C............SS...',
  '################################', '################################', '################################',
] };

// Chão reto com um inimigo no meio, entre os três e a saída (enquanto ele vive, ninguém passa: quem encosta volta
// para trás). Escadinha: os três começam num degrau 3 blocos acima do chão do guarda (bundada de cima).
const CHAO_RETO = [
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '...........................SS...', '...........................SS...', '.3.2.1.....................SS...',
  '################################', '################################', '################################',
];
const comInimigo = (especie, x, f, alcance, mapa = CHAO_RETO) => ({ nome: `teste: ${especie}`, mapa, inimigos: [{ especie, x, y: 480, f, alcance }] });
const DEGRAU = [
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '................................', '................................', '.3.2.1..........................',
  '##########.................SS...', '##########.................SS...', '##########.................SS...',
  '################################', '################################', '################################',
];

// Estojo de zíper (01/10): chão reto com um fosso de lápis de 5 blocos e 2 de fundo (colunas 10-14) e a saída do outro lado; o estojo
// na coluna 22, os heróis atrás dele (Marreta na frente); guarda (opcional) entre o estojo e o fosso, olhando para eles
const ESTOJO_FOSSO = (guarda) => {
  const L = [];
  for (let l = 0; l < 15; l++) L.push('.'.repeat(32).split(''));
  for (let c = 0; c < 32; c++) for (let l = 12; l < 15; l++) L[l][c] = '#';
  for (let c = 10; c <= 14; c++) { L[12][c] = '.'; L[13][c] = '^'; }
  for (let l = 9; l <= 11; l++) { L[l][1] = 'S'; L[l][2] = 'S'; }
  L[11][22] = 'E'; L[11][27] = '1'; L[11][29] = '2'; L[11][30] = '3';
  return { nome: 'teste: estojo e fosso', mapa: L.map((r) => r.join('')), inimigos: guarda ? [{ especie: 'guarda', x: 700, y: 480, f: 1, alcance: 30 }] : [] };
};
// Trena com o blindado (01/10, usuário: o inimigo da fita tem que ser invencível e o botão do outro lado — "só o
// Pudim, passando por um buraco menor, rolando, chega do outro lado, encolhe a régua e depois ativa de novo para os
// outros"): vão de 9 blocos (colunas 10-18) com lápis embaixo e a fita esticada, a trena na beira de LÁ (coluna 9), o
// blindado patrulhando na fita, um duto de 2 blocos (80 px: só a bola) por cima da ponte, com escada até a boca dele;
// heróis à direita, saída à esquerda. O teto do duto fica baixo: ninguém pula por cima do blindado.
const TRENA_BLINDADO = () => {
  const L = [];
  for (let l = 0; l < 15; l++) L.push('.'.repeat(32).split(''));
  for (let c = 0; c < 32; c++) for (let l = 12; l < 15; l++) L[l][c] = '#';
  for (let c = 10; c <= 18; c++) { L[12][c] = '.'; L[13][c] = '^'; }
  // o duto: teto e chão (o chão dele a 200 px do chão da fase: em cima da caixa da trena cabe o Fiapo, 132 px — com
  // 160 ele batia a cabeça e travava; e o pulo por cima do blindado continua batendo no duto)
  for (let c = 4; c <= 21; c++) { L[3][c] = '#'; L[6][c] = '#'; }
  for (let l = 6; l <= 11; l++) { L[l][22] = 'H'; L[l][23] = 'H'; } // escada até a boca do duto
  for (let l = 9; l <= 11; l++) { L[l][1] = 'S'; L[l][2] = 'S'; }
  L[11][9] = 'R'; L[11][27] = '1'; L[11][29] = '2'; L[11][30] = '3';
  return { nome: 'teste: trena e blindado', mapa: L.map((r) => r.join('')), inimigos: [{ especie: 'blindado', x: 560, y: 480, f: 1, alcance: 100 }] };
};
// Poça (cola "kk" ou nada "..") de 2 blocos logo antes de um degrau de 1 bloco; a saída em cima do degrau
const POCA_DEGRAU = (p) => ({ nome: 'teste: poça antes do degrau', mapa: [
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '................................', '................................', '...........................SS...',
  '...........................SS...', '...........................SS...', `.3.2.1....${p}####################`,
  '################################', '################################', '################################',
] });
// Chão reto com uma poça de 17 blocos no meio ('k' cola, 'w' corretivo, '.' nada)
const POCA_CHAO = (p) => ({ nome: 'teste: poça no chão', mapa: [
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '...........................SS...', '...........................SS...', `.3.2.1..${p.repeat(17)}..SS...`,
  '################################', '################################', '################################',
] });
// Placa no fundo de um buraco raso (2 blocos, 1 de fundo) e o portão da placa adiante; um rolo de durex ('d') antes do
// buraco (ou nada: '.')
const DUREX_PLACA = (d) => ({ nome: 'teste: durex na placa', mapa: [
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '................................', '................................', '....................P...........',
  '....................P......SS...', '....................P......SS...', `.3.2.1...${d}..........P......SS...`,
  '##############p.################', '################################', '################################',
] });
// Chão reto com um rolo de durex e um guarda adiante
const DUREX_GUARDA = { nome: 'teste: boliche', mapa: CHAO_RETO.map((l, i) => (i === 11 ? `${l.slice(0, 8)}d${l.slice(9)}` : l)),
  inimigos: [{ especie: 'guarda', x: 740, y: 480, f: -1, alcance: 40 }] };
// Chão reto com uma prateleira alta (linha 7) e a lixeira em cima dela, entre os três e a saída
const LIXEIRA_ALTA = { nome: 'teste: lixeira', mapa: CHAO_RETO.map((l, i) => (i === 7 ? `${l.slice(0, 20)}##${l.slice(22)}` : l)),
  inimigos: [{ especie: 'lixeira', x: 840, y: 280, f: -1, alcance: 0 }] };
// Tesoureiro: parede (degrau alto) à esquerda; o Fiapo de isca na frente dela; o Marreta e o Pudim atrás do tesoureiro
const TESOURA_PAREDE = { nome: 'teste: tesoureiro na parede', mapa: [
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '#####......................SS...', '#####......................SS...', '#####...2...........1.3....SS...',
  '################################', '################################', '################################',
], inimigos: [{ especie: 'tesoureiro', x: 560, y: 480, f: -1, alcance: 0 }] };
// cola (2 blocos) entre o Fiapo e o tesoureiro
const TESOURA_COLA = { nome: 'teste: tesoureiro na cola', mapa: CHAO_RETO.map((l, i) => (i === 11 ? `${l.slice(0, 12)}kk${l.slice(14)}` : l)),
  inimigos: [{ especie: 'tesoureiro', x: 640, y: 480, f: -1, alcance: 0 }] };
// Rampa: morro de 3 blocos com rampa dos dois lados (o Marreta e o Pudim não pulam tão alto); rampa = '.' tira elas
const RAMPA_MORRO = (rampa = true, durex = false) => ({ nome: 'teste: rampa', mapa: [
  '................................', '................................', '................................',
  '................................', '................................', '................................',
  '................................', '................................', durex ? '..................d.............' : '................................',
  '............/#####\\........SS...', '.........../#######\\.......SS...', '.3.2.1..../#########\\......SS...',
  '################################', '################################', '################################',
].map((l) => (rampa ? l : l.replace(/[/\\]/g, '.'))) });
// x do herói anotado pelo comando ['marca'] do robô
const marcado = (m, id) => { const l = m.log.find((q) => q.includes(`marca ${id} `)); return l ? +l.split('x=')[1] : NaN; };

// Coisas que NÃO podem funcionar (bugs que o jogador achou). O teste passa se o robô NÃO vencer.
// (sala = índice das salas feitas à mão; def = fase de teste própria)
const ROTEIROS_PROIBIDOS = [
  // sem as rampas, o morro de 3 blocos é parede para o Marreta e o Pudim
  { def: RAMPA_MORRO(false), nome: 'morro sem rampa: o Pudim não passa', r: [
    ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
  ] },
  // sem o rolo: o Marreta segura a placa com o próprio peso, os outros passam, e ele fica para trás (o portão fecha)
  { def: DUREX_PLACA('.'), nome: 'placa no buraco sem o durex: quem segura passa depois', r: [
    ['ativa', 'marreta'], ['anda', 590], ['espera', 0.5], ['ativa', 'pudim'], ['vai', 1110], ['ativa', 'fiapo'], ['vai', 1110],
    ['ativa', 'marreta'], ['vai', 1110], ['espera', 0.5],
  ] },
  // na cola ninguém pula: o Pudim salta antes da poça, cai nela (pula pouco) e não sai mais pelo degrau
  { def: POCA_DEGRAU('kk'), nome: 'Pudim pula o degrau saindo da cola', r: [
    ['ativa', 'pudim'], ['anda', 250], ['salta', 385, 1110], ['vai', 1110],
    ['ativa', 'fiapo'], ['anda', 250], ['salta', 385, 1110], ['ativa', 'marreta'], ['anda', 250], ['salta', 385, 1110], ['espera', 0.5],
  ] },
  // bundada só amassa quem está embaixo: pulando do chão o Pudim sobe ~46 px, bem menos que a altura do guarda.
  // (A barriga quebra o lápis antes e o Pudim fica colado no guarda tonto; depois espera o tonto passar.)
  { def: comInimigo('guarda', 620, -1, 60), nome: 'bundada pulando do chão amassa o guarda', r: [
    ['ativa', 'pudim'], ['anda', 640], ['pula'], ['espera', 0.12], ['acao'], ['espera', 3.5],
    ['anda', 1110], ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
  ] },
  // amigo arremessado: só o Pudim (pesado) derruba inimigo; o Fiapo se machuca e o guarda continua lá
  { def: comInimigo('guarda', 620, -1, 60), nome: 'Fiapo arremessado derruba o guarda', r: [
    ['ativa', 'fiapo'], ['anda', 300], ['ativa', 'marreta'], ['anda', 262], ['acao'], ['espera', 1.5],
    ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
  ] },
  { sala: 0, nome: 'Fiapo só segurando a ponta vira ponte', r: [
    ['ativa', 'fiapo'], ['anda', 420], ['acao'], ['espera', 0.4],
    ['ativa', 'marreta'], ['anda', 382], ['acao'], ['espera', 0.5], ['esperaChao', 'fiapo'],
    ['ativa', 'marreta'], ['anda', 1160], ['ativa', 'pudim'], ['anda', 1160], ['ativa', 'fiapo'], ['anda', 1160], ['espera', 1],
  ] },
  { sala: 1, nome: 'Pudim sobe corda inclinada (tirolesa) amarrada nele', r: [
    ['ativa', 'pudim'], ['anda', 644],
    ['ativa', 'fiapo'], ['anda', 560], ['pula'], ['segura', 'dir', 1.2], ['esperaChao', 'fiapo'],
    ['anda', 700], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['anda', 470],
    ['ativa', 'fiapo'], ['anda', 630], ['esperaChao', 'fiapo'], ['anda', 520], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['segura', 'cima', 5], ['espera', 0.3], ['anda', 820], ['espera', 1.0], ['anda', 960],
    ['ativa', 'marreta'], ['anda', 660], ['segura', 'cima', 3], ['espera', 0.3], ['anda', 960],
    ['ativa', 'fiapo'], ['anda', 660], ['segura', 'cima', 3], ['espera', 0.3], ['anda', 960], ['espera', 0.5],
  ] },
  { sala: 1, nome: 'andar na rampa pela "continuação" invisível até o chão', r: [
    ['ativa', 'pudim'], ['anda', 644],
    ['ativa', 'fiapo'], ['anda', 560], ['pula'], ['segura', 'dir', 1.2], ['esperaChao', 'fiapo'],
    ['anda', 700], ['acao'], ['espera', 0.4],
    ['ativa', 'pudim'], ['anda', 360],
    ['ativa', 'fiapo'], ['anda', 630], ['esperaChao', 'fiapo'], ['anda', 420], ['acao'], ['espera', 0.4],
    ['ativa', 'marreta'], ['anda', 200], ['anda', 720], ['espera', 0.3],
    ['ativa', 'pudim'], ['anda', 610], ['segura', 'cima', 6], ['espera', 0.3], ['anda', 820], ['espera', 1.0], ['anda', 960],
    ['ativa', 'marreta'], ['anda', 960], ['ativa', 'fiapo'], ['anda', 960], ['espera', 0.5],
  ] },
  { def: PAREDE_SOCO, nome: 'soco de longe (a luva não chega na parede) quebra a parede', r: [
    ['ativa', 'marreta'], ['anda', 427], ['acao'], ['espera', 0.6], // corpo a ~110 px: a luva para ~40 px antes
    ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
  ] },
];

// Polimento (29/09, bugs que o usuário achou jogando a Mesa)
// o Fiapo parado na rampa (pé 25 px acima do Marreta): o gancho tem que pegar
const GANCHO_RAMPA = { nome: 'teste: gancho na rampa', mapa: CHAO_RETO.map((l, i) => (i === 11 ? `${l.slice(0, 10)}/#${l.slice(12)}` : l)) };
// parede fraca (3 blocos, coluna 12) com o Fiapo encostado nela
const SOCO_PAREDE = { nome: 'teste: soco com amigo na parede', mapa: CHAO_RETO.map((l, i) => (i >= 9 && i <= 11 ? `${l.slice(0, 12)}C${l.slice(13)}` : l)) };
// a coleira da corda (960 px): chão comprido com tachinha na coluna 6; e uma prateleira alta com tachinha e escada
// comprida até o chão
const CORDA_CHAO = { nome: 'teste: corda esticada', mapa: CHAO_RETO.map((l, i) => {
  const r = `${l.slice(0, 27)}${'.'.repeat(21)}${l.slice(27)}`.replace(/S/g, '.').replace(/[#]{32}/, '#'.repeat(32));
  const s = i >= 9 && i <= 11 ? `${r.slice(0, 44)}SS${r.slice(46)}` : r;
  return i === 11 ? `${s.slice(0, 6)}T${s.slice(7)}` : i >= 12 ? '#'.repeat(53) : s;
}) };
const CORDA_ESCADA = { nome: 'teste: corda na escada', mapa: (() => {
  const g = [];
  for (let l = 0; l < 40; l++) g.push('.'.repeat(32).split(''));
  for (let c = 0; c < 32; c++) g[39][c] = '#';
  for (let c = 0; c < 10; c++) g[4][c] = '#';
  for (let l = 4; l <= 38; l++) g[l][8] = g[l][9] = 'H';
  g[3][3] = 'T'; g[3][5] = '2'; g[38][2] = '1'; g[38][4] = '3';
  for (let l = 36; l <= 38; l++) g[l][27] = g[l][28] = 'S';
  return g.map((l) => l.join(''));
})() };
// escada pendurada numa prateleira (a ponta de baixo 3 blocos acima do chão): só pulando e segurando ↑ no ar
const ESCADA_NO_AR = { nome: 'teste: escada no ar', mapa: CHAO_RETO.map((l, i) => {
  if (i === 3) return `${l.slice(0, 12)}${'#'.repeat(9)}${l.slice(21)}`;
  return i > 3 && i <= 8 ? `${l.slice(0, 12)}HH${l.slice(14)}` : l;
}).map((l, i) => (i === 3 ? `${l.slice(0, 12)}HH${l.slice(14)}` : l)) };
const marcas = (m, id) => m.log.filter((q) => q.includes(`marca ${id} `)).map((q) => +q.split('x=')[1]);

// Fases de teste pequenas, feitas só para travar bugs que o jogador achou (o robô tem que vencer)
const TESTES = [
  {
    nome: 'E longe da tachinha do outro lado do fosso não larga a corda (ela ia parar lá atrás, fora do alcance)',
    def: { nome: 'teste da corda', mapa: [
      '................................', '................................', '................................',
      '................................', '................................', '................................',
      '................................', '................................', '................................',
      '...........................SS...', '...........................SS...', '.3.1.2....T........T.......SS...',
      '###########.......##############', '###########^^^^^^^##############', '################################',
    ] },
    r: [
      ['ativa', 'fiapo'], ['anda', 420], ['acao'], ['espera', 0.4], ['anda', 341],
      ['ativa', 'marreta'], ['anda', 301], ['olha', 1], ['acao'], ['espera', 0.5], ['esperaChao', 'fiapo', 5],
      ['ativa', 'fiapo'], ['anda', 1000], ['acao'], ['espera', 0.5], // longe da tachinha: não pode largar a corda
      ['anda', 780], ['acao'], ['espera', 0.4],                       // agora encostado na tachinha: ponte
      ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // o lápis alcança mais que o soco: o Marreta deixa a estocada passar e soca na volta, sem perder coração
    nome: 'Marreta derruba o guarda na volta da estocada', def: comInimigo('guarda', 620, -1, 60), nunca: [/marreta: -1/],
    r: [
      ['ativa', 'marreta'], ['soca', 400, 900], ['esperaChao', 'marreta', 3],
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // a estocada na barriga do Pudim quebra a ponta: o guarda fica tonto e o Marreta (esperando atrás) derruba
    nome: 'barriga do Pudim quebra o lápis do guarda; o Marreta derruba', def: comInimigo('guarda', 620, -1, 60),
    deve: [/ponta do lápis quebrou/, /guarda derrotado/], nunca: [/: -1 /],
    r: [
      ['ativa', 'marreta'], ['anda', 340], ['ativa', 'pudim'], ['barriga', 400, 900], ['ativa', 'marreta'], ['soca', 400, 900],
      ['esperaChao', 'marreta', 3], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // a bola não derruba mais ninguém (01/10, equilíbrio): no guarda desarmado, BUM e zonzo — ele continua lá
    nome: 'bola no guarda de lápis quebrado: zonzo, não derruba', def: comInimigo('guarda', 620, -1, 60), perde: true,
    deve: [/ponta do lápis quebrou/, /BUM/, /guarda zonzo/], nunca: [/guarda derrotado/, /pudim: -1/],
    r: [['ativa', 'pudim'], ['barriga', 400, 900], ['rola', 1000], ['espera', 0.5]],
  },
  {
    // de frente, a ponta fura a bola: rolando no guarda virado para ele, o Pudim se machuca (a estocada não quebra)
    nome: 'bola de frente no guarda: o lápis fura', def: comInimigo('guarda', 620, -1, 0), perde: true,
    deve: [/pudim: -1/], nunca: [/guarda derrotado/, /guarda zonzo/, /ponta do lápis quebrou/],
    r: [['ativa', 'pudim'], ['rola', 1000], ['espera', 0.5]],
  },
  {
    // pelas costas, a bola pega desarmado: BUM, zonzo (não derruba)
    nome: 'bola pelas costas do guarda: zonzo', def: comInimigo('guarda', 620, 1, 400), perde: true, // (indo embora)
    deve: [/BUM/, /guarda zonzo/], nunca: [/guarda derrotado/, /pudim: -1/],
    r: [['ativa', 'pudim'], ['rola', 1000], ['espera', 0.5]],
  },
  {
    // bundada de cima: o Pudim sai do degrau e cai sentado no guarda lá embaixo — PLAFT, zonzo; o Marreta derruba
    nome: 'bundada caindo de cima deixa o guarda zonzo', deve: [/PLAFT/, /guarda zonzo/, /guarda derrotado/], nunca: [/: -1 /],
    def: { nome: 'teste: degrau', mapa: DEGRAU, inimigos: [{ especie: 'guarda', x: 430, y: 480, f: -1, alcance: 10 }] },
    r: [
      ['ativa', 'marreta'], ['anda', 340], // o Marreta espera na beira do degrau
      ['ativa', 'pudim'], ['anda', 450], ['acao'], ['esperaChao', 'pudim', 3], ['anda', 560], // já saiu do degrau: no ar
      ['ativa', 'marreta'], ['anda', 470], ['soca', 300, 900], // desce do degrau atrás dele ['esperaChao', 'marreta', 3],
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // pisão (01/10): o Fiapo cai na cabeça do guarda, quica, o guarda fica zonzo e ele passa sem se machucar
    nome: 'pisão do Fiapo: o guarda fica zonzo e ele passa', def: comInimigo('guarda', 620, -1, 60),
    deve: [/guarda zonzo/], nunca: [/fiapo: -1/], // (o Fiapo não volta: chegou na saída pelo pisão)
    r: [
      ['ativa', 'fiapo'], ['pisa', 'guarda', 1110], ['ativa', 'marreta'], ['soca', 400, 900], ['esperaChao', 'marreta', 3],
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // o jogador viu a luva passar pela parede sem quebrar: só quebrava encostado. A luva chega a 91 px do meio dele.
    nome: 'soco quebra a parede rachada sem encostar (onde a luva desenhada chega)',
    def: PAREDE_SOCO,
    r: [
      ['ativa', 'marreta'], ['anda', 487], ['acao'], ['espera', 0.6], // corpo a ~50 px da parede
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  // ---- cola e corretivo (28/09) ----
  {
    // na cola ninguém pula: o degrau de 1 bloco logo depois da poça só dá para passar arremessado (o Pudim) ou
    // pulando antes dela (Marreta e Fiapo pulam longe o bastante; o Pudim não)
    nome: 'cola antes do degrau: o Marreta arremessa o Pudim, os outros saltam a poça', def: POCA_DEGRAU('kk'),
    r: [
      ['ativa', 'pudim'], ['anda', 380], ['ativa', 'marreta'], ['anda', 340], ['olha', 1], ['gancho'], ['espera', 0.6],
      ['esperaChao', 'pudim', 5], ['ativa', 'pudim'], ['anda', 1110],
      ['ativa', 'fiapo'], ['anda', 250], ['salta', 385, 1110], ['ativa', 'marreta'], ['anda', 250], ['salta', 385, 1110],
      ['espera', 0.5],
    ],
  },
  {
    // controle do proibido "Pudim pula o degrau saindo da cola": sem a cola, o mesmo Pudim sobe sozinho
    nome: 'sem cola o Pudim pula o degrau de 1 bloco', def: POCA_DEGRAU('..'),
    r: [
      ['ativa', 'pudim'], ['vai', 1110], ['ativa', 'fiapo'], ['vai', 1110], ['ativa', 'marreta'], ['vai', 1110], ['espera', 0.5],
    ],
  },
  {
    // na cola anda a 30%: atravessar 18 blocos leva bem mais que os ~12 s sem ela
    nome: 'cola: anda devagar', def: POCA_CHAO('k'), confere: (m) => m.t > 25,
    r: [ // (o 'anda' do robô desiste em 10 s: na cola, dois seguidos)
      ['ativa', 'marreta'], ['anda', 1110], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['anda', 1110],
      ['ativa', 'fiapo'], ['anda', 1110], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // corretivo: entra embalado e solta — escorrega longe (no chão seco para em ~10 px)
    nome: 'corretivo: embalado, escorrega', def: POCA_CHAO('w'), confere: (m) => marcado(m, 'marreta') > 450,
    r: [
      ['ativa', 'marreta'], ['anda', 250], ['segura', 'dir', 0.4], ['espera', 1], ['marca'],
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    nome: 'chão seco: soltou, para (controle do corretivo)', def: POCA_CHAO('.'), confere: (m) => marcado(m, 'marreta') < 380,
    r: [
      ['ativa', 'marreta'], ['anda', 250], ['segura', 'dir', 0.4], ['espera', 1], ['marca'],
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  // ---- rolo de durex (28/09) ----
  {
    // empurrado para dentro do buraco da placa, o rolo segura o portão e vira ponte baixa (até o Pudim sobe nele)
    nome: 'durex no buraco da placa segura o portão', def: DUREX_PLACA('d'),
    r: [
      ['ativa', 'marreta'], ['anda', 548], ['espera', 0.8], ['vai', 1110],
      ['ativa', 'pudim'], ['vai', 1110], ['ativa', 'fiapo'], ['vai', 1110], ['espera', 0.5],
    ],
  },
  {
    // boliche: o soco do Marreta manda o rolo rolando e ele derruba o guarda lá na frente
    nome: 'soco no durex derruba o guarda (boliche)', def: DUREX_GUARDA, deve: [/STRIKE/], nunca: [/: -1 coração/],
    r: [
      ['ativa', 'marreta'], ['anda', 282], ['olha', 1], ['acao'], ['espera', 2],
      ['vai', 1110], ['ativa', 'pudim'], ['vai', 1110], ['ativa', 'fiapo'], ['vai', 1110], ['espera', 0.5],
    ],
  },
  // ---- lixeira (28/09) ----
  {
    // o amigo na rampa, um pouco acima do Marreta: a luva encosta, então arremessa (antes pedia o pé na mesma altura)
    nome: 'gancho pega o amigo em cima da rampa', def: GANCHO_RAMPA, deve: [/UPPER!/], nunca: [/: -1 /],
    r: [['ativa', 'fiapo'], ['anda', 425], ['ativa', 'marreta'], ['anda', 372], ['olha', 1], ['gancho'], ['espera', 1.5],
      ['ativa', 'fiapo'], ['anda', 1110], ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['espera', 0.5]],
  },
  {
    // o Fiapo encostado na parede fraca: o soco arremessa ele E quebra a parede (antes só pegava nele)
    nome: 'soco com o amigo encostado na parede fraca: voa e a parede quebra', def: SOCO_PAREDE, deve: [/POW!/, /CRAC!/],
    r: [['ativa', 'fiapo'], ['anda', 470], ['ativa', 'marreta'], ['anda', 400], ['olha', 1], ['acao'], ['espera', 1.5],
      ['ativa', 'fiapo'], ['anda', 1110], ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['espera', 0.5]],
  },
  {
    // a escada começa 3 blocos acima do chão: o Fiapo pula e, no ar, ↑ agarra ali mesmo; sobe, desce e segue
    nome: 'pulando, ↑ agarra a escada no ar', def: ESCADA_NO_AR, deve: [/fiapo: agarrou a escada no ar/], nunca: [/: -1 /],
    r: [['ativa', 'fiapo'], ['anda', 520], ['pula'], ['espera', 0.2], ['sobe'], ['anda', 700], ['anda', 520], ['desce'], ['esperaChao', 'fiapo', 3],
      ['anda', 1110], ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['espera', 0.5]],
  },
  {
    // corda amarrada: longe demais, o Fiapo para (a corda estica) e volta andando; recolhe e segue
    nome: 'corda esticada segura o Fiapo, e ele volta', def: CORDA_CHAO, nunca: [/: -1 /],
    confere: (m) => { const [ida, volta] = marcas(m, 'fiapo'); return ida > 1180 && ida < 1260 && Math.abs(volta - 900) < 12; }, // tachinha em 260 + 960 de corda
    r: [['ativa', 'fiapo'], ['anda', 260], ['acao'], ['espera', 0.3], ['vai', 1000], ['anda', 1900], ['marca'], ['anda', 900], ['marca'],
      ['anda', 260], ['acao'], ['espera', 0.3], ['vai', 1000], ['anda', 1790], ['ativa', 'marreta'], ['vai', 1000], ['anda', 1790],
      ['ativa', 'pudim'], ['vai', 900], ['anda', 1790], ['espera', 0.5]],
  },
  {
    // descendo a escada com a corda, além do comprimento: o nó escapa e a corda volta para a mão (antes ele ficava
    // grudado no x da tachinha, sem andar para os lados)
    nome: 'corda na escada: longe demais, o nó escapa', def: CORDA_ESCADA, nunca: [/: -1 /],
    confere: (m) => m.cordas.estoque === 1 && !m.cordas.lista.length,
    r: [['ativa', 'fiapo'], ['anda', 140], ['acao'], ['espera', 0.3], ['anda', 360], ['desce'], ['anda', 1110],
      ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['espera', 0.5]],
  },
  {
    // rampa: os três sobem e descem andando (o morro tem 3 blocos: o Marreta e o Pudim não pulam isso)
    nome: 'rampa: os três sobem e descem o morro', def: RAMPA_MORRO(), nunca: [/: -1 /],
    r: [['ativa', 'pudim'], ['anda', 1110], ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5]],
  },
  {
    // o durex em cima da rampa desce sozinho, ganhando velocidade (parado no topo: x = 740; o pé da rampa é 840)
    nome: 'rampa: o durex desce sozinho', def: RAMPA_MORRO(true, true),
    confere: (m) => { const l = m.log.find((q) => q.includes('rolo x=')); return !!l && +l.split('x=')[1] > 900; },
    r: [['espera', 2.5], ['rolo'], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'marreta'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5]],
  },
  {
    // o Fiapo espera na frente da parede; o tesoureiro corre, o Fiapo pula, a tesoura crava; o Marreta soca pelas costas
    nome: 'Fiapo de isca: o tesoureiro crava na parede', def: TESOURA_PAREDE,
    deve: [/CRAVOU/, /tesoureiro derrotado/], nunca: [/fiapo: -1/, /marreta: -1/, /TÓIN/],
    // pelo desenho: cravado, a lâmina desenhada acaba a 50 px do meio dele — encosta na parede (face em x = 200)
    confere: (m) => { const l = m.log.find((q) => q.includes('tesoureiro cravado')); return !!l && Math.abs(+l.split('x=')[1] - 250) <= 1; },
    r: [
      ['ativa', 'fiapo'], ['isca'], ['ativa', 'marreta'], ['soca', 0, 1280], ['esperaChao', 'marreta', 3],
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // de frente, a tesoura chega antes da luva
    nome: 'Marreta indo direto leva a tesourada', def: comInimigo('tesoureiro', 640, -1, 0), perde: true,
    deve: [/marreta: -1/, /TSC/],
    r: [['ativa', 'marreta'], ['anda', 470], ['espera', 2.5]],
  },
  {
    // a tesoura quica na barriga (BOING): tonto; o Marreta, esperando atrás do Pudim, vai e soca
    nome: 'tesoura quica na barriga do Pudim; o Marreta derruba', def: comInimigo('tesoureiro', 640, -1, 0),
    deve: [/BOING/, /tesoureiro tonto/, /tesoureiro derrotado/], nunca: [/: -1 /],
    r: [
      ['ativa', 'marreta'], ['anda', 300], ['ativa', 'pudim'], ['barriga', 0, 1280], ['ativa', 'marreta'], ['soca', 0, 1280],
      ['esperaChao', 'marreta', 3], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // trena com o blindado (01/10): o Pudim sobe a escada, rola pelo duto (só a bola cabe), cai do outro lado, bundada
    // no botão — a fita recolhe e o blindado cai nos lápis —, outra bundada estica; aí todos passam
    nome: 'blindado na trena: o Pudim vai pelo duto, recolhe a fita e estica de novo', def: TRENA_BLINDADO(),
    deve: [/trena recolhe/, /blindado derrotado/, /trena estica/], nunca: [/: -1 /],
    r: [
      ['ativa', 'pudim'], ['anda', 920], ['sobe'], ['rola', 120], ['bundadaEm', 350, 380], ['esperaChao', 'pudim', 3],
      ['espera', 1.2], ['bundadaEm', 380, 380], ['esperaChao', 'pudim', 3], ['espera', 0.5], ['anda', 100],
      ['ativa', 'marreta'], ['anda', 100], ['ativa', 'fiapo'], ['anda', 100], ['espera', 0.5],
    ],
  },
  {
    // nem o Fiapo pula por cima do blindado: o duto corta o pulo (senão a trena ficava sem razão)
    nome: 'blindado: o Fiapo não pula por cima dele', def: TRENA_BLINDADO(), perde: true,
    confere: (m) => m.herois.find((h) => h.id === 'fiapo').x > 400,
    r: [['ativa', 'fiapo'], ['anda', 740], ['espreita', 'blindado', 600, 1], ['pula'], ['segura', 'esq', 1.4], ['espera', 1]],
  },
  {
    // o blindado não cai de golpe nenhum: o soco e a bola do Pudim só fazem CLANG (ninguém passa)
    nome: 'blindado: soco e bola fazem CLANG, não derrubam', def: TRENA_BLINDADO(), perde: true,
    deve: [/CLANG/], nunca: [/blindado derrotado/, /trena recolhe/],
    r: [
      ['ativa', 'marreta'], ['anda', 760], ['olha', -1], ['acao'], ['espera', 0.6], ['acao'], ['espera', 0.6], ['gancho'], ['espera', 0.8],
      ['ativa', 'pudim'], ['rola', 300], ['espera', 1.5],
    ],
  },
  {
    // estojo de zíper (01/10): o Marreta empurra; a estocada bate no estojo (TOC); o estojo leva o guarda para o fosso e
    // cai nele, fechando o buraco: todos passam por cima
    nome: 'Marreta empurra o estojo: o guarda cai no fosso e o estojo vira chão', def: ESTOJO_FOSSO(true),
    // (e fica rente: o topo dele na linha do chão — 01/10, usuário: "tem que ficar totalmente rente ao chão")
    confere: (m) => Math.abs(m.nivel.estojos[0].topo() - 480) < 0.5,
    deve: [/estojo empurra guarda/, /lápis bateu no estojo/, /guarda derrotado/, /estojo caiu/], nunca: [/: -1 /],
    r: [
      ['ativa', 'marreta'], ['empurra', 500], ['esperaChao', 'marreta', 3], ['espera', 0.5], ['anda', 100],
      ['ativa', 'fiapo'], ['anda', 100], ['ativa', 'pudim'], ['anda', 100], ['espera', 0.5],
    ],
  },
  {
    // só o Marreta empurra: o Fiapo para nele (o estojo não sai do lugar) e o fosso continua aberto
    nome: 'Fiapo e Pudim não empurram o estojo', def: ESTOJO_FOSSO(false), perde: true, nunca: [/estojo caiu/],
    confere: (m) => Math.abs(m.nivel.estojos[0].x - 900) < 1,
    r: [['ativa', 'fiapo'], ['anda', 600], ['ativa', 'pudim'], ['anda', 600], ['espera', 0.5]],
  },
  {
    // correndo na cola ele gruda: preso, o Marreta soca de frente
    nome: 'tesoureiro gruda na cola', def: TESOURA_COLA,
    deve: [/GRUDOU/, /tesoureiro derrotado/], nunca: [/: -1 /, /TÓIN|CRAVOU/],
    r: [
      ['ativa', 'fiapo'], ['anda', 420], ['espera', 1.2], ['ativa', 'marreta'], ['soca', 0, 1280], ['esperaChao', 'marreta', 3],
      ['anda', 1110], ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110],
      ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // ponte de corda no fosso: o tesoureiro corre atrás do Fiapo, cai no fosso cortando a ponte (SNIP!) e morre nos
    // lápis; a corda cai lá embaixo: o Marreta e o Pudim ficam do outro lado (a fase fica sem saída)
    nome: 'tesoureiro corta a ponte', perde: true,
    def: Object.assign({}, SALAS[0], { inimigos: [{ especie: 'tesoureiro', x: 1100, y: 480, f: -1, alcance: 0 }] }),
    deve: [/cortou a corda/, /PLOC/], nunca: [/fiapo: -1/],
    r: [
      ['ativa', 'fiapo'], ['anda', 420], ['acao'], ['espera', 0.4],
      ['ativa', 'marreta'], ['anda', 382], ['acao'], ['espera', 0.5], ['esperaChao', 'fiapo'],
      ['ativa', 'fiapo'], ['anda', 820], ['acao'], ['espera', 0.4], ['isca', 880], ['espera', 2],
      ['ativa', 'marreta'], ['anda', 1160], ['espera', 1],
    ],
  },
  {
    // o Marreta soca a bolinha na hora que ela chega: volta reta e cai dentro dela
    nome: 'Marreta rebate a bolinha na lixeira (CESTA!)', def: LIXEIRA_ALTA, deve: [/CESTA/], nunca: [/marreta: -1/],
    r: [
      ['ativa', 'marreta'], ['cesta'], ['esperaChao', 'marreta', 3],
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
  {
    // na barriga do Pudim a bolinha quica: ele passa embaixo da lixeira sem se machucar
    nome: 'bolinha quica na barriga do Pudim', def: LIXEIRA_ALTA, deve: [/BOING/], nunca: [/pudim: -1/],
    r: [
      ['ativa', 'pudim'], ['anda', 620], ['espera', 2.5], ['anda', 200], ['ativa', 'marreta'], ['cesta'], ['esperaChao', 'marreta', 3],
      ['anda', 1110], ['ativa', 'pudim'], ['anda', 1110], ['ativa', 'fiapo'], ['anda', 1110], ['espera', 0.5],
    ],
  },
];

Jogo.simula = function (i, roteiro = ROTEIROS[i], tmax = 90) { return Object.assign({ sala: i + 1 }, simula(SALAS[i], roteiro, tmax)); };

// Salas feitas à mão + soluções alternativas + N salas geradas (semente fixa, para repetir)
Jogo.testaTudo = function (geradas = 0, semente = 7) {
  const r = SALAS.map((s, i) => this.simula(i));
  for (const a of ROTEIROS_ALT) r.push(Object.assign(this.simula(a.sala, a.r), { nome: a.nome }));
  for (const a of ROTEIROS_PROIBIDOS) {
    const x = a.def ? Object.assign(simula(a.def, a.r, 60), { sala: '-' }) : this.simula(a.sala, a.r, 60);
    r.push(Object.assign(x, { nome: `proibido: ${a.nome}`, venceu: !x.venceu })); // "venceu" = o teste passou
  }
  for (const a of TESTES) { // deve / nunca: o que tem que (ou não pode) aparecer no registro da fase
    const x = Object.assign(simula(a.def, a.r, 60), { sala: '-', nome: `teste: ${a.nome}` });
    if (a.perde) x.venceu = !x.venceu; // a fase tem que ficar sem saída (ex.: a ponte cortada)
    const viu = (re) => x.logTodo.some((l) => re.test(l));
    if ((a.deve || []).some((re) => !viu(re)) || (a.nunca || []).some(viu)) x.venceu = false;
    if (a.confere && !a.confere(x.m)) x.venceu = false; // o que o registro não mostra (posição, tempo...)
    r.push(x);
  }
  for (const v of VAOS) {
    const n = contaSaltos(v.vao, v.sobe);
    r.push({ sala: '-', nome: `vão: ${v.nome}`, venceu: v.ok(n), log: [`pontos de pulo que dão certo: ${JSON.stringify(n)}`] });
  }
  for (let n = 4; n < 4 + geradas; n++) {
    const d = Gerador.sala(n, semente);
    r.push(d ? Object.assign(simula(d, d.roteiro, d.tmax), { sala: n, nome: `gerada: ${d.nome} (tentativa ${d.tentativas})` })
      : { sala: n, nome: 'gerada', venceu: false, log: [`nenhuma sala válida: ${Gerador.ultimoErro}`] });
    if (d) for (const p of provaGolpes(d)) r.push(Object.assign(p, { sala: n }));
  }
  return r;
};

// Vãos que separam os heróis: pulando de cada ponto da beirada (de 2 em 2 px, andando e correndo), quantos chegam do
// outro lado. As fases à mão contam com isso (a Mesa: no porta-lápis só o Fiapo passa — degrau de 3 com vão de 2).
const VAOS = [
  { nome: 'degrau de 3 com vão de 2: só o Fiapo', vao: 2, sobe: 3, ok: (n) => n.fiapo >= 40 && !n.marreta && !n.pudim },
  { nome: 'vão de 4 no plano: o Fiapo folgado, o Marreta quase nunca', vao: 4, sobe: 0, ok: (n) => n.fiapo >= 40 && n.marreta <= 4 && !n.pudim },
];
function contaSaltos(vao, sobe) {
  const W = 40, H = 14, L = 9, B = 15, g = [];
  for (let l = 0; l < H; l++) g.push(Array(W).fill('.'));
  for (let c = 0; c < W; c++) { g[H - 1][c] = '#'; g[H - 2][c] = '^'; } // errou: cai nos lápis
  for (let l = 0; l < H; l++) g[l][0] = g[l][W - 1] = '#';
  for (let c = 1; c < B; c++) g[L][c] = '#';
  for (let c = B + vao; c < W - 1; c++) for (let l = L - sobe; l <= L; l++) g[l][c] = '#';
  g[L - 1][2] = '1'; g[L - 1][3] = '2'; g[L - 1][4] = '3';
  const def = { nome: 'vão', mapa: g.map((l) => l.join('')), inimigos: [], cordas: 0 }, n = {};
  for (const id of ORDEM) {
    n[id] = 0;
    for (let x0 = B * TILE - 60; x0 <= B * TILE + 40; x0 += 2) for (const corre of [false, true]) {
      const r = [['ativa', id], ['anda', x0 - (corre ? 200 : 120)], ['salta', x0, (B + vao) * TILE + 120], ['esperaChao', id, 3]];
      const m = new Mundo(def, { bot: new Bot(r), rapido: true }), h = m.herois.find((q) => q.id === id);
      for (let t = 0; t < 12 && m.estado === 'jogando' && m.bot.i < r.length; t += Jogo.PASSO) {
        if (corre && m.bot.i === 2) { h.correndo = true; h.ultToque = { d: 1, t: m.t }; } // os dois toques: correndo
        m.passo(Jogo.PASSO, {});
      }
      if (h.x > (B + vao) * TILE && h.y <= (L - sobe) * TILE + 1 && h.vidas === VIDAS) n[id]++;
    }
  }
  return n;
}

// Fases feitas à mão no formato do editor (fases/<nome>.json, com o roteiro do robô dentro): o robô tem que vencer sem
// ninguém perder coração. No console: await Jogo.testaFases()
const FASES_PROVADAS = ['mesa', 'mesa3'];
// Atalhos falsos (o jogador gasta tempo e não adianta): o teste passa se o herói NUNCA pisar lá.
// Mesa: o Fiapo quicando no Pudim na ponta do livro 1 subia na prateleira de baixo — mas a chave está lá embaixo
// (29/09, usuário: "não vale a pena dar a entender que tem um shortcut"). Vários pontos do Pudim e do pulo.
// Buraco da corda na prateleira do alto: o Fiapo quicando no Pudim embaixo dele subia sem passar pelo porta-lápis (o pé
// chegava a 365 com a prateleira em 480; subiu para 320). prepara: põe os heróis no lugar antes do roteiro.
const FASES_PROIBIDAS = {
  mesa: [
    ...[1560, 1590, 1620].flatMap((px) => [1440, 1470, 1500].map((x0) => ({
      nome: `Fiapo quicando no Pudim (x ${px}, pulo ${x0}) não sobe na prateleira antes da chave`, id: 'fiapo', ymax: 1361,
      r: [['ativa', 'pudim'], ['vai', 1300], ['vai', px], ['ativa', 'fiapo'], ['vai', 1300], ['anda', x0 - 60], ['salta', x0, 1760], ['espera', 2]],
    }))),
    ...[1880, 1920, 1960].flatMap((px) => [-100, 100].map((dx) => ({
      nome: `Fiapo quicando no Pudim embaixo do buraco da corda (x ${px}, de ${dx > 0 ? 'lá' : 'cá'}) não sobe na prateleira do alto`,
      id: 'fiapo', ymax: 700,
      prepara: (m) => { const [f, p] = [m.herois[1], m.herois[2]]; p.x = px; p.y = 800; f.x = px + dx; f.y = 800; },
      r: [['ativa', 'fiapo'], ['salta', px + dx, px - dx], ['segura', 'cima', 1.5], ['espera', 1]],
    }))),
  ],
  // Mesa nova, etapa 1 (30/09, usuário: "eu simplesmente estou pulando com o Fiapo em cima do Pudim e subo lá em cima"):
  // a estante tem 400 px — só a gangorra leva o Fiapo lá; quicar na barriga (o Pudim encostado nela ou na ponta da régua)
  // e o gancho do Marreta não chegam
  // (01/10: a fase do usuário cresceu 11 blocos para a esquerda: tudo 440 px para a direita)
  mesa3: [
    ...[1200, 1242].flatMap((px) => [1060, 1120].map((x0) => ({
      nome: `Fiapo quicando no Pudim (x ${px}, pulo ${x0}) não sobe na estante sem a gangorra`, id: 'fiapo', ymax: 1521,
      prepara: (m) => { const [f, p] = [m.herois[1], m.herois[2]]; p.x = px; p.y = 1920; f.x = x0 - 80; f.y = 1920; },
      r: [['ativa', 'fiapo'], ['salta', x0, 1400], ['espera', 2]],
    }))),
    {
      nome: 'o gancho do Marreta não joga o Fiapo no alto da estante', id: 'fiapo', ymax: 1521,
      prepara: (m) => { const [ma, f] = m.herois; f.x = 1240; f.y = 1920; ma.x = 1196; ma.y = 1920; ma.f = 1; },
      r: [['ativa', 'marreta'], ['gancho'], ['espera', 2]],
    },
    // Trena (etapa 7, 01/10): o lado de lá do vão (a caixa e o chão até a escada) só se alcança pelo duto, em bola. Nem o
    // Fiapo correndo (do alto do piso do estojo ou do pé da escada), nem o Marreta arremessando o Fiapo ou dando o gancho
    // no Pudim: o chão do duto, 160 px acima da fita, corta todos os arcos (e o blindado está na fita)
    {
      nome: 'trena: o Fiapo correndo do alto do estojo (já no fosso) não pula o vão', id: 'fiapo', onde: TRENA_LA,
      prepara: (m) => {
        const f = m.herois[1], e = m.nivel.estojos[0];
        e.x = 2420; e.y = 1360; m.inimigos = m.inimigos.filter((o) => !(o.especie === 'guarda' && o.y === 1280));
        f.x = 2640; f.y = 1280;
      },
      r: [['ativa', 'fiapo'], ['segura', 'esq', 0.05], ['espera', 0.05], ['salta', 2285, 1500], ['espera', 2]],
    },
    {
      nome: 'trena: o Fiapo do pé da escada não pula o vão', id: 'fiapo', onde: TRENA_LA,
      prepara: (m) => { const f = m.herois[1]; f.x = 2236; f.y = 1360; },
      r: [['ativa', 'fiapo'], ['salta', 2236, 1500], ['espera', 2]],
    },
    {
      nome: 'trena: do alto da escada do duto, o Fiapo não pula para o lado de lá', id: 'fiapo', onde: TRENA_LA,
      prepara: (m) => { const f = m.herois[1]; f.x = 2200; f.y = 1360; },
      r: [['ativa', 'fiapo'], ['sobe', 3], ['salta', 2200, 1500], ['espera', 2]],
    },
    {
      nome: 'trena: o Marreta não arremessa o Fiapo por cima do vão', id: 'fiapo', onde: TRENA_LA,
      prepara: (m) => { const [ma, f] = m.herois; f.x = 2190; f.y = 1360; ma.x = 2228; ma.y = 1360; ma.f = -1; },
      r: [['ativa', 'marreta'], ['acao'], ['espera', 2.5]],
    },
    {
      nome: 'trena: o gancho do Marreta não joga o Pudim por cima do vão', id: 'pudim', onde: TRENA_LA,
      prepara: (m) => { const [ma, , p] = m.herois; p.x = 2180; p.y = 1360; ma.x = 2236; ma.y = 1360; ma.f = -1; },
      r: [['ativa', 'marreta'], ['gancho'], ['espera', 2.5]],
    },
  ],
};
// o lado de lá do vão da trena na Mesa nova: o chão entre a escada e a caixa (x < 1880, y 1360) ou em cima da caixa
function TRENA_LA(h) { return h.noChao && h.x < 1925 && h.x > 1600 && h.y > 1300 && h.y < 1365; }
// Erros que o jogador comete e de que tem que dar para se recuperar (30/09, usuário: "não só assim, o jogador fez tudo
// certo e conseguiu passar; e se der algo errado?"): o robô erra de propósito, conserta e o teste confere que chegou
// (ok) sem perder coração. Com as coisas que mexem com o tempo (a gangorra); o resto, o confereVolta.
const FASES_ERROS = {
  mesa3: [
    { nome: 'o Pudim pula na régua sem a bundada (o Fiapo voa baixo e cai), volta pela escada e acerta',
      r: [['ativa', 'fiapo'], ['vai', 1177.28], ['anda', 1177.28], ['ativa', 'pudim'], ['vai', 780], ['anda', 782], ['salta', 796, 862.72],
        ['esperaChao', 'fiapo'], ['anda', 760], ['sobe'], ['ativa', 'fiapo'], ['vai', 1177.28], ['anda', 1177.28],
        ['ativa', 'pudim'], ['anda', 782], ['espera', 1.5], ['bundadaEm', 796, 862.72], ['esperaChao', 'fiapo'], ['espera', 0.5]] },
    { nome: 'o Fiapo no meio da régua voa baixo; volta para a ponta e o Pudim, pela escada, lança de novo',
      r: [['ativa', 'fiapo'], ['vai', 1100], ['anda', 1100], ['ativa', 'pudim'], ['vai', 780], ['anda', 782], ['bundadaEm', 796, 862.72],
        ['esperaChao', 'fiapo'], ['anda', 760], ['sobe'], ['ativa', 'fiapo'], ['vai', 1177.28], ['anda', 1177.28],
        ['ativa', 'pudim'], ['anda', 782], ['espera', 1.5], ['bundadaEm', 796, 862.72], ['esperaChao', 'fiapo'], ['espera', 0.5]] },
  ].map((e) => Object.assign(e, { ok: (m) => { const f = m.herois[1]; return f.noChao && Math.abs(f.y - 1520) < 1 && f.x > 1280 && f.x < 1440; } })),
};

// Decoração no plano de trás (def.decoracao, camada 'fundo'; Nivel._decoracao): a parte de baixo da peça fica escondida
// atrás do tampo e da laje, então embaixo da peça inteira tem que haver chão — contando o que a paralaxe desloca
// (DECO.deriva) —, senão o pé aparece pendurado num vão. (29/09, usuário: "você tem que olhar como é que ficou" — a
// regra que o olho usa, escrita)
function confereDecoracao(def) {
  const n = new Nivel(def), erros = [];
  for (const d of def.decoracao || []) {
    if ((d.c || 'fundo') !== 'fundo') continue;
    const img = Objetos.imgs[`decoracao/${d.p}`];
    if (!img) { erros.push(`${d.p} x=${d.x}: sem imagem`); continue; }
    const w = d.a * img.width / img.height, l = Math.round(d.y / TILE), m = w * 0.45 + DECO.deriva;
    for (let x = d.x - m; x <= d.x + m; x += 8) {
      if (!n.parede(Math.floor(x / TILE), l)) { erros.push(`${d.p} x=${d.x}: sem chão embaixo em x=${Math.round(x)} (com a paralaxe)`); break; }
    }
  }
  return erros;
}

// Colado na parede (30/09, usuário: "o Pudim às vezes entra debaixo do piso e fica travado no início da fase"): ele tem
// 72 px e nascia no bloco colado na borda, 16 px dentro dela; pulando ali, o bloco da parede virava teto e jogava ele
// para baixo do chão. Agora nasce encostado (Heroi.encaixa) e, mesmo enfiado de lado na parede, o pulo não afunda.
function confereParede() {
  const L = [];
  for (let l = 0; l < 15; l++) L.push('.'.repeat(32).split(''));
  for (let c = 0; c < 32; c++) for (let l = 12; l < 15; l++) L[l][c] = '#';
  for (let l = 0; l < 12; l++) L[l][0] = '#';
  L[11][1] = '3'; L[11][3] = '1'; L[11][5] = '2'; L[2][30] = 'S';
  const def = { nome: 'parede', mapa: L.map((x) => x.join('')) }, r = [];
  let m = new Mundo(def, { rapido: true }), p = m.herois[2];
  r.push({ sala: 'parede', nome: 'colado na parede: o Pudim nasce encostado, fora dela', venceu: Math.abs(p.x - (TILE + p.cfg.w / 2)) < 1, log: [`x=${p.x.toFixed(1)}`] });
  m = new Mundo(def, { rapido: true }); p = m.herois[2]; m.seleciona(2);
  p.x = TILE + 20; // (enfiado 16 px na parede, como nascia antes)
  let fundo = 0;
  for (let t = 0; t < 1.5; t += Jogo.PASSO) { m.passo(Jogo.PASSO, t < 0.05 ? { pulo: true } : {}); fundo = Math.max(fundo, p.y); }
  r.push({ sala: 'parede', nome: 'colado na parede: pulando, o Pudim não afunda no chão', venceu: fundo <= 12 * TILE + 0.5 && p.noChao, log: [`y máx=${fundo.toFixed(1)} (chão 480)`] });
  return r;
}

// Ponto de controle (30/09, usuário: "tem que salvar o status de quando passou no checkpoint: alavancas, itens"): o robô
// joga a fase; no primeiro ponto pego, guarda a cópia (Jogo.clona) e segue até o fim; depois volta para a cópia e joga
// de novo até o fim: tem que vencer do mesmo jeito (no mesmo tempo, os três no mesmo lugar) — a cópia leva tudo.
function conferePonto(def) {
  const m = new Mundo(def, { bot: new Bot(def.roteiro), rapido: true });
  let copia = null;
  const ate = (w) => { for (let t = 0; t < (def.tmax || 300) && w.estado === 'jogando'; t += Jogo.PASSO) { w.passo(Jogo.PASSO, {}); if (w.pontoNovo && !copia) { w.pontoNovo = null; copia = Jogo.clona(w); } } return w; };
  const fim = (w) => `${w.estado} t=${w.t.toFixed(2)} ${w.herois.map((h) => `${h.id} ${Math.round(h.x)},${Math.round(h.y)}`).join(' ')}`;
  const a = fim(ate(m));
  if (!copia) return { sala: def.nome, nome: 'ponto de controle: o robô não pegou nenhum', venceu: false, log: [a] };
  const b = fim(ate(Jogo.clona(copia)));
  return { sala: def.nome, nome: 'ponto de controle: voltando para ele, o robô termina igual', venceu: a === b && /^venceu/.test(a), log: [a, b] };
}

// Lixeira (30/09, usuário: "visibilidade"; o alvo): só mira em quem a bolinha alcança (embaixo de laje, a salvo) e
// fica no mesmo alvo enquanto ele estiver ao alcance. Lixeira numa prateleira alta (linha 7, colunas 20-21).
function confereLixeira() {
  const mapa = (extra) => {
    const L = [];
    for (let l = 0; l < 15; l++) L.push('.'.repeat(32).split(''));
    for (let c = 0; c < 32; c++) for (let l = 12; l < 15; l++) L[l][c] = '#';
    L[7][20] = L[7][21] = '#'; L[2][30] = 'S';
    extra(L);
    return { nome: 'lixeira', mapa: L.map((x) => x.join('')), inimigos: [{ especie: 'lixeira', x: 840, y: 280, f: -1, alcance: 0 }] };
  };
  const joga = (def, prepara, t = 6) => {
    const m = new Mundo(def, { rapido: true });
    if (prepara) prepara(m);
    for (let s = 0; s < t; s += Jogo.PASSO) m.passo(Jogo.PASSO, {});
    return m.log.filter((l) => /lixeira joga em/.test(l)).map((l) => l.split('joga em ')[1]);
  };
  const r = [];
  // o Pudim parado embaixo de uma laje ao alcance dela; os outros longe
  const laje = (com) => mapa((L) => { if (com) for (let c = 12; c < 19; c++) L[8][c] = '#'; L[11][15] = '3'; L[11][1] = '1'; L[11][2] = '2'; });
  let x = joga(laje(true));
  r.push({ sala: 'lixeira', nome: 'lixeira: embaixo da laje, o Pudim está a salvo (ela não joga)', venceu: !x.length, log: [`jogou em: ${x.join(', ') || 'ninguém'}`] });
  x = joga(laje(false));
  r.push({ sala: 'lixeira', nome: 'lixeira: sem a laje, ela joga no Pudim', venceu: x.length > 0 && x.every((q) => q === 'pudim'), log: [`jogou em: ${x.join(', ')}`] });
  // o Pudim ao alcance primeiro (a bolinha quica na barriga: não machuca); o Marreta chega mais perto dela depois: ela
  // continua no Pudim
  const dois = mapa((L) => { L[11][16] = '3'; L[11][1] = '1'; L[11][2] = '2'; });
  x = joga(dois, (m) => { m.bot = new Bot([['ativa', 'marreta'], ['espera', 1], ['anda', 700], ['espera', 4]]); }, 9);
  r.push({ sala: 'lixeira', nome: 'lixeira: fica no mesmo alvo (o Pudim), mesmo com o Marreta chegando mais perto', venceu: x.length >= 3 && x.every((q) => q === 'pudim'), log: [`jogou em: ${x.join(', ')}`] });
  return r;
}

// Pose de empurrar (heroi.js, travaAlto): o Marreta anda para a direita contra cada obstáculo e tem que empurrar só
// quando trava num bloqueio acima das mãos. (30/09, usuário: "obstáculo baixinho, que dá para pular, não"; rampa não.)
function confereEmpurra() {
  const casos = [['bloco de 80 px (dá para pular)', 2, false], ['bloco de 120 px', 3, true], ['parede', 8, true], ['rampa', 'r', false]];
  return casos.map(([nome, alt, deve]) => {
    const L = [];
    for (let l = 0; l < 15; l++) L.push('.'.repeat(32).split(''));
    for (let c = 0; c < 32; c++) for (let l = 12; l < 15; l++) L[l][c] = '#';
    if (alt === 'r') { L[11][14] = '/'; for (let c = 15; c < 32; c++) L[11][c] = '#'; }
    else for (let l = 12 - alt; l < 12; l++) for (let c = 14; c < 32; c++) L[l][c] = '#';
    L[11][2] = '3'; L[11][4] = '2'; L[11][8] = '1'; L[2][30] = 'S';
    const m = new Mundo({ nome: 'empurra', mapa: L.map((x) => x.join('')) }, { rapido: true });
    let empurrou = false;
    for (let t = 0; t < 3; t += Jogo.PASSO) { m.passo(Jogo.PASSO, { dir: true }); if (m.herois[0].empurra) empurrou = true; }
    return { sala: 'empurra', nome: `empurrar: ${nome} ${deve ? 'empurra' : 'não empurra'}`, venceu: empurrou === deve, log: [`empurrou=${empurrou}`] };
  });
}

// O desenho não entra no sólido (30/09): cada herói anda até uma parede (dos dois lados), segura para ela e depois
// solta; o quadro que o jogo desenha (com o recuo do Sprites.escolhe) não pode ter pixel dentro da parede
// Régua-gangorra (30/09; refeita no mesmo dia, depois do teste do usuário): escadinha de 4 livros (o Pudim sobe
// pulando), a gangorra com a ponta direita embaixo e uma estante de 400 px logo depois da ponta. Só a bundada do Pudim,
// caindo do alto da escadinha na ponta de cima, lança o Fiapo — em ARCO, sem ninguém controlar — até o alto da estante;
// o Pudim só pulando e o Marreta lançam baixo; quicar na barriga do Pudim e o gancho do Marreta não chegam lá
// (proibidos: era o atalho que o usuário achou). Andando para o lado de cima ela vira devagar e ninguém voa; sem ninguém
// em cima, volta sozinha para a posição do mapa (dá para lançar de novo).
function confereGangorra() {
  const TOPO = 80; // o alto da estante: 400 px acima do chão (y = 480)
  const mapa = (extra) => {
    const L = [];
    for (let l = 0; l < 15; l++) L.push('.'.repeat(32).split(''));
    for (let c = 0; c < 32; c++) for (let l = 12; l < 15; l++) L[l][c] = '#';
    for (let k = 1; k <= 4; k++) for (let l = 12 - k; l < 12; l++) L[l][1 + k] = '#'; // escadinha
    for (let l = 2; l < 12; l++) for (let c = 18; c < 22; c++) L[l][c] = '#';        // estante (topo em y = 80)
    L[11][11] = 'V'; L[11][0] = '3'; L[11][1] = '1'; L[11][16] = '2'; L[1][19] = 'S';
    if (extra) extra(L);
    return { nome: 'gangorra', mapa: L.map((x) => x.join('')) };
  };
  const def = mapa(), g = new Nivel(def).gangorras[0], xa = g.ponta(1), xb = g.ponta(-1);
  const noAlto = (h) => h.noChao && Math.abs(h.y - TOPO) < 1 && h.x > 720 && h.x < 880;
  const casos = [
    ['a bundada do Pudim lança o Fiapo em arco até o alto da estante, sem ninguém controlar', 'pudim', true, true],
    ['o Pudim só pulando não lança o Fiapo lá (proibido)', 'pudim', false, false],
    ['o Marreta pulando não lança o Fiapo lá (proibido)', 'marreta', false, false],
  ];
  const r = casos.map(([nome, quem, bundada, deve]) => {
    const rot = [['ativa', 'fiapo'], ['anda', xa], ['ativa', quem], ['vai', 220], ['anda', 222],
      bundada ? ['bundadaEm', 236, xb] : ['salta', 236, xb], ['esperaChao', 'fiapo'], ['espera', 0.5]];
    const x = simula(def, rot, 30), fi = x.m.herois.find((h) => h.id === 'fiapo');
    const chegou = noAlto(fi), lancou = x.logTodo.some((l) => /gangorra lança fiapo/.test(l));
    return { sala: 'gangorra', nome: `gangorra: ${nome}`, venceu: lancou && chegou === deve, log: [x.logTodo.filter((l) => /gangorra/.test(l)).join(' ; '), `fiapo x=${fi.x.toFixed(0)} y=${fi.y.toFixed(0)}`] };
  });
  // o Fiapo cai na ponta de cima (vira a régua) e sai dela: vazia, ela volta sozinha para a posição do mapa (a ponta
  // direita embaixo) e dá para lançar de novo
  {
    const vazio = mapa((L) => { for (let c = 2; c <= 5; c++) for (let l = 8; l < 12; l++) L[l][c] = '.'; L[11][16] = '.'; L[11][3] = '2'; });
    const rot = [['ativa', 'fiapo'], ['salta', 250, 330], ['esperaChao', 'fiapo'], ['anda', 110], ['espera', 2]];
    const m = new Mundo(vazio, { bot: new Bot(rot), rapido: true }), gg = m.nivel.gangorras[0];
    let virou = false;
    for (let t = 0; t < 20 && m.bot.i < rot.length; t += Jogo.PASSO) { m.passo(Jogo.PASSO, {}); if (gg.lado === -1) virou = true; }
    r.push({ sala: 'gangorra', nome: 'gangorra: vazia, volta sozinha para a posição do mapa (dá para lançar de novo)', venceu: virou && gg.lado === 1 && gg.ang === GANGORRA.ang,
      log: [`virou=${virou} lado=${gg.lado} ang=${gg.ang.toFixed(3)} fiapo x=${m.herois[1].x.toFixed(0)}`] });
  }
  // atalhos (sem a gangorra): o Fiapo quicando na barriga do Pudim encostado na estante, e o gancho do Marreta
  const sem = mapa((L) => { L[11][11] = '.'; });
  const tenta = (prepara, rot) => {
    const m = new Mundo(sem, { bot: new Bot(rot), rapido: true }), fi = m.herois.find((h) => h.id === 'fiapo');
    prepara(m.herois);
    let subiu = false;
    for (let t = 0; t < 10 && m.bot.i < rot.length; t += Jogo.PASSO) { m.passo(Jogo.PASSO, {}); if (noAlto(fi)) subiu = true; }
    return subiu;
  };
  const poe = (h, x) => { h.x = x; h.y = 480; };
  for (const x0 of [520, 580, 620]) {
    const subiu = tenta(([ma, fi, pu]) => { poe(pu, 682); poe(fi, 440); poe(ma, 300); }, [['ativa', 'fiapo'], ['salta', x0, 820], ['espera', 2]]);
    r.push({ sala: 'gangorra', nome: `gangorra: o Fiapo quicando no Pudim encostado na estante (pulo em ${x0}) não sobe nela (proibido)`, venceu: !subiu, log: [subiu ? 'subiu' : 'não subiu'] });
  }
  const subiu = tenta(([ma, fi, pu]) => { poe(fi, 690); poe(ma, 646); ma.f = 1; poe(pu, 300); }, [['ativa', 'marreta'], ['gancho'], ['espera', 2]]);
  r.push({ sala: 'gangorra', nome: 'gangorra: o gancho do Marreta não joga o Fiapo no alto da estante (proibido)', venceu: !subiu, log: [subiu ? 'subiu' : 'não subiu'] });
  // os dois na ponta de baixo; o Pudim anda para a de cima: vira devagar e o Fiapo sobe junto, sem voar
  const rot = [['ativa', 'fiapo'], ['anda', xa], ['ativa', 'pudim'], ['vai', 300], ['espera', 1]];
  const L = def.mapa.map((q) => q.split('')); L[11][0] = '.'; L[11][17] = '3'; // (fora da régua: embaixo dela passa por baixo)
  const x = simula({ nome: 'gangorra', mapa: L.map((q) => q.join('')) }, rot, 20), fi = x.m.herois.find((h) => h.id === 'fiapo');
  const gg = x.m.nivel.gangorras[0], subiuJunto = fi.plat === gg && fi.y < 480 - 100;
  r.push({ sala: 'gangorra', nome: 'gangorra: andando para o lado de cima, vira devagar e o Fiapo sobe junto, sem voar',
    venceu: gg.lado === -1 && subiuJunto && !x.logTodo.some((l) => /gangorra lança/.test(l)), log: [`lado=${gg.lado} fiapo y=${fi.y.toFixed(0)}`] });
  return r;
}

// Carimbo (30/09): teto com 6 blocos de vão e um carimbo no meio do corredor. Os três passam no tempo certo (comando
// 'carimbo') sem perder coração; andando direto, o Marreta leva a carimbada; uma borracha embaixo é achatada.
// Ajuste do usuário (30/09): o corpo é sólido e só machuca ESPREMIDO — encostar do lado é parede (sem dano); com ele
// embaixo, o Fiapo passa por cima; parado em cima quando ele sobe, é espremido no teto (proibido).
function confereCarimbo() {
  const mapa = (extra, carimbos) => {
    const L = [];
    for (let l = 0; l < 15; l++) L.push('.'.repeat(32).split(''));
    for (let c = 0; c < 32; c++) for (let l = 12; l < 15; l++) L[l][c] = '#';
    for (let c = 10; c < 23; c++) for (let l = 4; l < 6; l++) L[l][c] = '#'; // teto (vão de 6 blocos até o chão)
    L[6][16] = 'c'; L[11][2] = '1'; L[11][4] = '2'; L[11][6] = '3'; L[9][29] = 'S';
    if (extra) extra(L);
    return { nome: 'carimbo', mapa: L.map((x) => x.join('')), carimbos };
  };
  const dano = (x) => x.logTodo.filter((l) => /-1 cora/.test(l));
  const r = [];
  let x = simula(mapa(), [['ativa', 'marreta'], ['carimbo', 900], ['ativa', 'fiapo'], ['carimbo', 900], ['ativa', 'pudim'], ['carimbo', 900]], 60);
  const passaram = x.m.herois.every((h) => h.x > 880);
  r.push({ sala: 'carimbo', nome: 'carimbo: os três passam por baixo no tempo certo, sem perder coração', venceu: passaram && !dano(x).length,
    log: [x.m.herois.map((h) => `${h.id} x=${h.x.toFixed(0)}`).join(' '), dano(x).join(' ; ')] });
  x = simula(mapa((L) => { L[11][16] = 'o'; }), [['espera', 4]], 6);
  const plaft = x.logTodo.some((l) => /PLAFT/.test(l));
  r.push({ sala: 'carimbo', nome: 'carimbo: a borracha embaixo dele é achatada', venceu: plaft, log: [plaft ? 'PLAFT!' : 'escapou'] });
  // à mão (teclas por quadro): ritmo de 4 s — embaixo de 2,08 s a 2,76 s, depois sobe
  const RITMO = 4, embaixo = RITMO * 0.52, borda = 16 * TILE + 20 - CARIMBO.w / 2;
  const joga = (id, x0, teclas, ate) => {
    const m = new Mundo(mapa(null, [{ c: 16, l: 6, ritmo: RITMO }]), { rapido: true }), h = m.herois.find((q) => q.id === id), k = m.nivel.carimbos[0];
    m.ativo = m.herois.indexOf(h); h.x = x0;
    let emCima = false, xMax = -1e9;
    for (let t = 0; t < ate; t += Jogo.PASSO) {
      m.passo(Jogo.PASSO, teclas(t));
      if (h.plat === k) emCima = true;
      if (t > embaixo) xMax = Math.max(xMax, h.x);
    }
    return { h, emCima, xMax, dano: VIDAS - h.vidas };
  };
  // parado embaixo dele (lá em cima, sem encostar), espera: ele desce em cima
  let j = joga('marreta', 16 * TILE + 20, () => ({}), embaixo + 0.5);
  r.push({ sala: 'carimbo', nome: 'carimbo: parado embaixo dele, o Marreta leva a carimbada (proibido)', venceu: j.dano > 0, log: [`dano=${j.dano}`] });
  // encosta do lado com ele embaixo (segura para a direita 0,3 s) e sai antes de ele subir
  j = joga('marreta', borda - 60, (t) => (t > embaixo && t < embaixo + 0.3 ? { dir: true } : t >= embaixo + 0.3 && t < embaixo + 0.9 ? { esq: true } : {}), embaixo + 1);
  r.push({ sala: 'carimbo', nome: 'carimbo: encostar do lado não machuca (é parede)', venceu: !j.dano && j.xMax <= borda - 23 + 1,
    log: [`dano=${j.dano} x máx=${j.xMax.toFixed(0)} (parede em ${borda - 23})`] });
  // com ele embaixo, o Fiapo pula, atravessa por cima e desce do outro lado
  let pulou = false;
  j = joga('fiapo', borda - 24, (t) => { if (t <= embaixo) return {}; const e = { dir: true, pulo: !pulou }; pulou = true; return e; }, embaixo + 1.2);
  r.push({ sala: 'carimbo', nome: 'carimbo: com ele embaixo, o Fiapo passa por cima (é plataforma)', venceu: j.emCima && !j.dano && j.h.x > borda + CARIMBO.w + 16,
    log: [`em cima=${j.emCima} dano=${j.dano} x=${j.h.x.toFixed(0)}`] });
  // pula em cima e fica: quando ele sobe, a cabeça bate no teto
  pulou = false;
  j = joga('fiapo', borda - 24, (t) => { if (t <= embaixo) return {}; const e = { dir: t < embaixo + 0.25, pulo: !pulou }; pulou = true; return e; }, embaixo + 2);
  r.push({ sala: 'carimbo', nome: 'carimbo: parado em cima quando ele sobe, é espremido no teto (proibido)', venceu: j.emCima && j.dano > 0,
    log: [`em cima=${j.emCima} dano=${j.dano}`] });
  return r;
}

// Post-its (30/09): coluna em zigue-zague de 3 em 3 blocos até uma prateleira. O Fiapo sobe (cada um cai 0,9 s
// depois de pisado: sem parar); o Marreta não alcança o primeiro; parado em cima, o Fiapo cai com o post-it, que
// volta piscando.
function conferePostit() {
  const L = [];
  for (let l = 0; l < 20; l++) L.push('.'.repeat(32).split(''));
  for (let c = 0; c < 32; c++) for (let l = 17; l < 20; l++) L[l][c] = '#';
  for (let c = 1; c < 8; c++) L[5][c] = '#';                       // a prateleira lá em cima, à esquerda (piso em y = 200)
  L[13][9] = 'n'; L[10][11] = 'n'; L[7][9] = 'n';                   // pisos em 560, 440, 320 (o chão: 680)
  L[16][4] = '1'; L[16][6] = '2'; L[16][2] = '3'; L[3][3] = 'S';
  const def = { nome: 'post-its', mapa: L.map((x) => x.join('')) }, X = (c) => c * 40 + 20;
  const r = [];
  let x = simula(def, [['ativa', 'fiapo'], ['anda', X(8)], ['pulaEm', X(9)], ['pulaEm', X(11)], ['pulaEm', X(9)], ['pulaEm', X(6)], ['anda', X(3)]], 20);
  let h = x.m.herois.find((q) => q.id === 'fiapo');
  r.push({ sala: 'post-it', nome: 'post-its: o Fiapo sobe o zigue-zague até a prateleira', venceu: Math.abs(h.y - 200) < 1, log: [`fiapo x=${h.x.toFixed(0)} y=${h.y.toFixed(0)}`] });
  x = simula(def, [['ativa', 'marreta'], ['anda', X(8)], ['pulaEm', X(9)], ['espera', 0.5]], 10);
  h = x.m.herois.find((q) => q.id === 'marreta');
  r.push({ sala: 'post-it', nome: 'post-its: o Marreta não alcança o primeiro (proibido)', venceu: Math.abs(h.y - 680) < 1, log: [`marreta y=${h.y.toFixed(0)}`] });
  x = simula(def, [['ativa', 'fiapo'], ['anda', X(8)], ['pulaEm', X(9)], ['espera', 2.5]], 10);
  h = x.m.herois.find((q) => q.id === 'fiapo');
  // (a simulação vai até 10 s: o post-it pisado aos ~0,8 s solta aos ~1,7 e volta aos ~5,7)
  const caiu = Math.abs(h.y - 680) < 1, soltou = x.logTodo.filter((l) => /post-it soltou/.test(l)).length === 1;
  const volta = x.m.nivel.postits.find((q) => q.y === 560).estado === 'colado';
  r.push({ sala: 'post-it', nome: 'post-its: parado em cima, o Fiapo cai junto; o post-it volta depois', venceu: caiu && soltou && volta,
    log: [`fiapo y=${h.y.toFixed(0)} soltou=${soltou} voltou=${volta}`] });
  return r;
}

const A_EMPURRA_QUADROS = (id) => Sprites.CONJUNTOS[id].anims.empurra.quadros.length;
function confereEncosta(semRecuo) {
  if (typeof Sprites === 'undefined' || !Sprites.ativo) return [];
  const r = [];
  ORDEM.forEach((id, i) => {
    if (!Sprites.pronto(id)) { r.push({ sala: 'encosta', nome: `desenho não entra na parede: ${id}`, venceu: false, log: ['os desenhos não carregaram'] }); return; }
    for (const s of [1, -1]) for (const segura of [true, false]) {
      const L = [];
      for (let l = 0; l < 15; l++) L.push('.'.repeat(32).split(''));
      for (let c = 0; c < 32; c++) for (let l = 12; l < 15; l++) L[l][c] = '#';
      for (let l = 4; l < 12; l++) for (let c = 0; c < 32; c++) if (s > 0 ? c >= 20 : c < 6) L[l][c] = '#';
      const cols = s > 0 ? [2, 4] : [27, 29]; // os outros longe, do outro lado
      ORDEM.forEach((q, j) => { L[11][j === i ? (s > 0 ? 16 : 9) : cols.shift()] = String(j + 1); });
      L[2][s > 0 ? 10 : 20] = 'S';
      const m = new Mundo({ nome: 'encosta', mapa: L.map((x) => x.join('')) }, { rapido: true });
      m.seleciona(i);
      const E = s > 0 ? { dir: true } : { esq: true }, h = m.herois[i];
      let Q = null;
      for (let t = 0; t < 2.5; t += Jogo.PASSO) {
        const aperta = segura || t < 2;
        m.passo(Jogo.PASSO, aperta ? E : {});
        Q = Sprites.escolhe(h, m.t, semRecuo ? null : m.nivel);
      }
      const face = (s > 0 ? 20 : 6) * TILE, W = 400, H = 320, ox = Math.round(h.x - W / 2), oy = Math.round(h.y - H + 20);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.translate(-ox, -oy);
      if (Q) Sprites.quadro(g, id, Q, { f: h.f, pe: { x: h.x, y: h.y } });
      const d = g.getImageData(0, 0, W, H).data;
      let dentro = 0, maior = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] < 100) continue;
        const pen = s > 0 ? x + ox - face : face - (x + ox + 1); // (1 px de folga: a borda suavizada)
        if (pen >= 1) { dentro++; maior = Math.max(maior, pen); }
      }
      r.push({ sala: 'encosta', nome: `desenho não entra na parede: ${id} ${s > 0 ? 'à direita' : 'à esquerda'}, ${segura ? 'segurando' : 'soltou'}`,
        venceu: !!Q && dentro === 0, log: [`${Q ? Q.nome : 'sem quadro'}: ${dentro} px dentro (até ${maior} px)`] });
      // empurrando, a mão fica RENTE à face em todo quadro (30/09, o usuário viu ~2 px de vão): cada quadro do ciclo
      // desenhado a 4x, sem fundo; a ponta da mão (alfa 40) fica encostada, até 1 px dentro da face (junta os contornos)
      if (segura && Q && Q.nome === 'empurra') {
        const vistos = new Map();
        for (let t = 0; t < 1.5; t += Jogo.PASSO) {
          m.passo(Jogo.PASSO, E);
          const q = Sprites.escolhe(h, m.t, semRecuo ? null : m.nivel);
          if (q && q.nome === 'empurra' && !vistos.has(q.i)) vistos.set(q.i, q);
        }
        const Z = 4, W4 = 160 * Z, H4 = 200 * Z, x0 = face - 80, y0 = h.y - 180, vaos = [];
        const c4 = document.createElement('canvas'); c4.width = W4; c4.height = H4;
        const g4 = c4.getContext('2d');
        for (const [i, q] of [...vistos].sort((a, b) => a[0] - b[0])) {
          g4.setTransform(Z, 0, 0, Z, -x0 * Z, -y0 * Z); g4.clearRect(x0, y0, W4, H4);
          Sprites.quadro(g4, id, q, { f: h.f, pe: { x: h.x, y: h.y } });
          const d4 = g4.getImageData(0, 0, W4, H4).data;
          let ponta = s > 0 ? -1e9 : 1e9;
          for (let y = 0; y < H4; y++) for (let x = 0; x < W4; x++) {
            if (d4[(y * W4 + x) * 4 + 3] < 40) continue;
            const wx = x0 + (s > 0 ? x + 1 : x) / Z;
            ponta = s > 0 ? Math.max(ponta, wx) : Math.min(ponta, wx);
          }
          vaos.push({ i, vao: s > 0 ? face - ponta : ponta - face });
        }
        const ok = vaos.length === A_EMPURRA_QUADROS(id) && vaos.every((v) => v.vao <= 0 && v.vao >= -1);
        r.push({ sala: 'encosta', nome: `empurrando, a mão fica rente à parede em todo quadro: ${id} ${s > 0 ? 'à direita' : 'à esquerda'}`,
          venceu: ok, log: [vaos.map((v) => `${v.i}: ${v.vao.toFixed(2)}`).join('  ')] });
      }
    }
  });
  return r;
}

// Ida sem volta (30/09, usuário: "e se der algo errado? E se o personagem cair num lugar e não consegue voltar? Tem que
// ter a oportunidade de se recuperar de um erro"). Cada herói SOZINHO, no motor de verdade: de cada lugar em que ele
// fica em pé, tenta os movimentos dele (anda um pouco, pula parado, para cada lado, pulinho, sobe e desce escada; o
// Pudim também vira bola) e anota onde parou. Começa dos lugares por onde o robô passa na solução e segue tudo o que dá
// para alcançar dali — os erros também. Lugares que se alcançam um ao outro são uma ILHA; o movimento que leva a outra
// ilha sem caminho de volta é uma IDA SEM VOLTA: feito por engano, aquele herói não volta sozinho. Cada uma se conserta
// na fase ou fica declarada nela, com o motivo (def.semVolta: [{ quem: id | [ids] | 'todos', para: [c, l], situacao?,
// motivo }]: a ilha de chegada que tem o bloco c, l). Duas situações: 'inicio' (a fase como abre: nada resolvido) e
// 'fim' (o mundo do robô no fim da solução: portões abertos, papel rasgado, as cordas que ficaram — e elas valem de
// caminho: ponte, escalar). Sem inimigos, carimbos e gangorra (mexem com o tempo); quem cai no lápis se machuca e volta
// ao ponto seguro (não conta).
const VOLTA = { q: 8, max: 6000 };
function mundoSozinho(m) {
  const n = m.nivel;
  m.bot = null; m.inimigos = []; n.carimbos = []; n.gangorras = []; n._plats = null;
  n.atualizaCanais = () => {}; m._chaves = () => {}; m._rolos = () => {}; m._saida = () => {};
  n.versao++;
  m.durex0 = n.durex.map((r) => [r.x, r.y]);
  m.estojos0 = n.estojos.map((r) => [r.x, r.y]);
  return m;
}
function movimentosVolta(id, bola) {
  const lado = (s) => (s > 0 ? { dir: true } : { esq: true }), M = [];
  for (const s of [-1, 1]) {
    // (segurando, a bola sobe a rampa; E no meio dela levanta — no pé, encostada, não cabe em pé)
    if (bola) { M.push({ n: `rola ${s}`, T: 0.4, E: () => lado(s) }, { n: `rola e levanta ${s}`, T: 0.9, E: (t, k) => Object.assign(lado(s), { acao: k === 60 }) }); continue; }
    M.push({ n: `anda ${s}`, T: 0.12, E: () => lado(s) });
    M.push({ n: `pula ${s}`, T: 1.6, pulo: true, E: () => lado(s) });
    M.push({ n: `pulinho ${s}`, T: 1.6, pulo: true, E: (t) => (t < 0.15 ? lado(s) : {}) });
    if (id === 'pudim') M.push({ n: `bola ${s}`, T: 0.6, E: (t, k) => Object.assign(lado(s), { acao: k === 10 }) });
  }
  M.push({ n: 'pula', T: 1.6, pulo: true, E: () => ({}) }, { n: 'espera', T: 3, E: () => ({}) }); // (em cima do post-it: cai com ele)
  // escada ou corda: ↑ / ↓ até sair dela (se em 0,8 s não pegou nada, não vale)
  if (!bola) M.push({ n: 'sobe', T: 8, sobe: true, E: () => ({ cima: true }) }, { n: 'desce', T: 8, sobe: true, E: () => ({ baixo: true }) });
  return M;
}
const PARADO_VOLTA = { n: 'parado', T: 0, E: () => ({}) };
// um movimento a partir de s (o herói novo, sozinho): onde ele para em pé (ou a bola do Pudim parada), ou null
function rodaVolta(m, id, s, mov) {
  const n = m.nivel, h = new Heroi(id, s.x, s.y).encaixa(n);
  if (s.bola) { h.cfg = BOLA; h.muda('rolando'); }
  // (semente com o meio do corpo dentro de um sólido — o portão fechado por onde o robô passou aberto — não vale; na
  // rampa os pés entram no bloco cheio embaixo dela: a conta para 20 px acima do pé)
  if (bloqueado(n, Math.floor(h.x / TILE), h.y - h.cfg.h + 4, h.y - 20)) return null;
  if (mov.n === 'espera' && !s.plat) return null;
  if (mov.sobe && !(mov.n === 'sobe' ? n.escadaEm(h) || h._linhaPerto(m) || h._linhaAlcance(m)
    : n.topoEscada(h) || m.cordas.linhas().some((q) => h.podeDescer(q)))) return null;
  m.herois = [h]; m.cordas.herois = m.herois; m.ativo = 0; m.estado = 'jogando'; m.parada = 0;
  for (const p of n.postits) { p.estado = 'colado'; p.t = 0; }
  n.durex.forEach((r, i) => { [r.x, r.y] = m.durex0[i]; r.vx = r.vy = 0; r.noChao = true; });
  n.estojos.forEach((r, i) => { [r.x, r.y] = m.estojos0[i]; r.vx = r.vy = 0; r.noChao = true; });
  let firme = 0, solta = false, subiu = false;
  for (let k = 0, t = 0; t < mov.T + 3; k++, t += Jogo.PASSO) {
    if (t >= mov.T || (mov.pulo && k > 2 && h.noChao) || (mov.sobe && subiu && h.estado === 'chao')) solta = true;
    m.passo(Jogo.PASSO, solta ? {} : Object.assign({ pulo: !!mov.pulo && k === 0 }, mov.E(t, k)));
    if (h.vidas < VIDAS || h.estado === 'machucado') return null;
    if (h.estado === 'escada' || h.estado === 'escalando') subiu = true;
    if (mov.sobe && !subiu && t > 0.8) return null;
    const parado = solta && h.noChao && Math.abs(h.vx) < 20 && (h.estado === 'chao' || h.estado === 'rolando');
    firme = parado ? firme + Jogo.PASSO : 0;
    // (a bola parada levanta sozinha em 0,2 s onde cabe em pé: espera; bola que fica bola é a do duto)
    if (firme >= 0.35) return { x: h.x, y: Math.round(h.y), bola: h.estado === 'rolando', plat: !!h.plat };
  }
  return null;
}
// As ilhas de um herói numa situação: { nos, ilha (chave -> nº), idas: [{ para, de, movs, pontos }] }
function mapaVolta(m, id, sementes) {
  const Q = VOLTA.q;
  const chave = (s) => `${s.bola ? 1 : 0}|${Math.round(s.x / Q)}|${s.y}`;
  const nos = new Map(), sai = new Map(), fila = [];
  const poe = (s) => { const k = chave(s); if (!nos.has(k) && nos.size < VOLTA.max) { nos.set(k, s); sai.set(k, []); fila.push(k); } return nos.has(k) ? k : null; };
  const vistas = new Set();
  for (const s of sementes) {
    if (vistas.has(chave(s))) continue;
    vistas.add(chave(s));
    const r = rodaVolta(m, id, s, PARADO_VOLTA);
    if (r) poe(r);
  }
  while (fila.length) {
    const k = fila.shift(), s = nos.get(k);
    for (const mov of movimentosVolta(id, s.bola)) {
      const r = rodaVolta(m, id, s, mov), k2 = r && poe(r);
      if (k2 && k2 !== k) sai.get(k).push([k2, mov.n]);
    }
  }
  // ilhas: componentes fortemente ligados (Tarjan, sem recursão)
  const ilha = new Map(), idx = new Map(), low = new Map(), pilha = [], naPilha = new Set();
  let cont = 0, nIlhas = 0;
  for (const raiz of nos.keys()) {
    if (idx.has(raiz)) continue;
    const trilha = [[raiz, 0]];
    idx.set(raiz, cont); low.set(raiz, cont); cont++; pilha.push(raiz); naPilha.add(raiz);
    while (trilha.length) {
      const topo = trilha[trilha.length - 1], [v, i] = topo, viz = sai.get(v);
      if (i < viz.length) {
        topo[1]++;
        const w = viz[i][0];
        if (!idx.has(w)) { idx.set(w, cont); low.set(w, cont); cont++; pilha.push(w); naPilha.add(w); trilha.push([w, 0]); }
        else if (naPilha.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
        continue;
      }
      trilha.pop();
      if (trilha.length) { const u = trilha[trilha.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
      if (low.get(v) === idx.get(v)) {
        let w;
        do { w = pilha.pop(); naPilha.delete(w); ilha.set(w, nIlhas); } while (w !== v);
        nIlhas++;
      }
    }
  }
  // Ilha de passagem (até 3 lugares, ou só de post-it, que cai) com saída: um pouso no caminho da queda (o pé da rampa,
  // a quina de um degrau). Não é chegada nem partida: conta onde se vai parar depois dela.
  const tam = new Array(nIlhas).fill(0), soPlat = new Array(nIlhas).fill(true), saidas = [...Array(nIlhas)].map(() => new Map());
  for (const [k, s] of nos) { tam[ilha.get(k)]++; if (!s.plat) soPlat[ilha.get(k)] = false; }
  for (const [k, viz] of sai) {
    for (const [k2, mov] of viz) {
      const a = ilha.get(k), b = ilha.get(k2);
      if (a === b) continue;
      if (!saidas[a].has(b)) saidas[a].set(b, new Set());
      saidas[a].get(b).add(mov);
    }
  }
  const passagem = (i) => (tam[i] <= 3 || soPlat[i]) && saidas[i].size > 0, memo = new Map();
  const destinos = (i) => {
    if (!passagem(i)) return [i];
    if (!memo.has(i)) { memo.set(i, []); const r = new Set(); for (const j of saidas[i].keys()) for (const d of destinos(j)) r.add(d); memo.set(i, [...r]); }
    return memo.get(i);
  };
  const grupos = new Map();
  for (let a = 0; a < nIlhas; a++) {
    if (passagem(a)) continue;
    for (const [b, movs] of saidas[a]) {
      for (const d of destinos(b)) {
        const g = grupos.get(d) || { para: d, de: new Set(), movs: new Set() };
        g.de.add(a); movs.forEach((x) => g.movs.add(x)); grupos.set(d, g);
      }
    }
  }
  return { nos, ilha, nIlhas, idas: [...grupos.values()], m };
}
// Faixa de blocos de uma ilha (para ler: "c 9-23, l 47" = das colunas 9 a 23, em pé na linha 47)
function faixaIlha(V, n) {
  const ls = new Map();
  for (const [k, s] of V.nos) {
    if (V.ilha.get(k) !== n) continue;
    const l = Math.round(s.y / TILE) - 1, c = Math.floor(s.x / TILE), f = ls.get(l) || [Infinity, -Infinity];
    ls.set(l, [Math.min(f[0], c), Math.max(f[1], c)]);
  }
  return [...ls].sort((a, b) => b[0] - a[0]).map(([l, [c0, c1]]) => `c ${c0}-${c1} l ${l}`).join(', ');
}
// Por onde cada herói passa em pé na solução do robô (as sementes) e o mundo dele no fim
function trilhaRobo(def) {
  const m = new Mundo(def, { bot: new Bot(def.roteiro), rapido: true }), s = { marreta: [], fiapo: [], pudim: [] };
  for (let t = 0, k = 0; t < (def.tmax || 90) && m.estado === 'jogando'; t += Jogo.PASSO, k++) {
    m.passo(Jogo.PASSO, {});
    if (k % 12) continue;
    for (const h of m.herois) if (h.noChao && h.estado === 'chao' && !h.apoio && !h.plat) s[h.id].push({ x: h.x, y: Math.round(h.y) });
  }
  return { sementes: s, fim: m };
}
function confereVolta(def) {
  const r = [], { sementes, fim } = trilhaRobo(def), decl = def.semVolta || [];
  const mundos = { inicio: mundoSozinho(new Mundo(def, { rapido: true })), fim: mundoSozinho(fim) };
  const ids = (d) => (d.quem === 'todos' ? ORDEM : [].concat(d.quem));
  for (const id of ORDEM) {
    for (const situacao of ['inicio', 'fim']) {
      const V = mapaVolta(mundos[situacao], id, sementes[id]);
      const naIlha = (g, [c, l]) => [...V.nos].some(([k, s]) => V.ilha.get(k) === g.para && Math.floor(s.x / TILE) === c && Math.round(s.y / TILE) - 1 === l);
      const soltas = V.idas.filter((g) => !decl.some((d) => ids(d).includes(id) && (!d.situacao || d.situacao === situacao) && naIlha(g, d.para)));
      r.push({ sala: def.nome, nome: `ida sem volta: ${id}, ${situacao === 'inicio' ? 'no começo' : 'com tudo resolvido'} (${V.nos.size} lugares, ${V.nIlhas} ilhas)`,
        venceu: !soltas.length && V.nos.size < VOLTA.max,
        log: soltas.map((g) => `cai em [${faixaIlha(V, g.para)}] vindo de [${[...g.de].map((i) => faixaIlha(V, i)).join(' | ')}] (${[...g.movs].join(', ')})`) });
    }
  }
  return r;
}
Jogo.voltas = async function (nome = 'mesa3') {
  const def = await (await fetch(`fases/${nome}.json`, { cache: 'no-store' })).json();
  return confereVolta(def);
};

Jogo.testaFases = async function () {
  if (typeof Sprites !== 'undefined' && Sprites.ativo) { // (os desenhos carregando: espera, senão a conferência do desenho não roda)
    for (let i = 0; i < 200 && !ORDEM.every((id) => Sprites.pronto(id)); i++) await new Promise((ok) => setTimeout(ok, 50));
  }
  const r = [...confereParede(), ...confereLixeira(), ...confereEmpurra(), ...confereEncosta(), ...confereGangorra(), ...confereCarimbo(), ...conferePostit()];
  for (const nome of FASES_PROVADAS) {
    const def = await (await fetch(`fases/${nome}.json`, { cache: 'no-store' })).json();
    const x = simula(def, def.roteiro, def.tmax);
    const dano = x.logTodo.filter((l) => /: -1 /.test(l));
    r.push(Object.assign(x, { sala: nome, nome: `fase: ${def.nome}`, venceu: x.venceu && !dano.length }));
    if (def.decoracao && typeof Objetos !== 'undefined' && Objetos.ativo) {
      for (let i = 0; i < 100 && !Objetos.pronto(); i++) await new Promise((ok) => setTimeout(ok, 50));
      const erros = confereDecoracao(def);
      r.push({ sala: nome, nome: `decoração da ${def.nome}: chão embaixo da peça inteira`, venceu: !erros.length, log: erros });
    }
    for (const a of FASES_PROIBIDAS[nome] || []) {
      const m = new Mundo(def, { bot: new Bot(a.r), rapido: true }), h = m.herois.find((q) => q.id === a.id);
      if (a.prepara) a.prepara(m);
      let pisou = false;
      for (let t = 0; t < 40 && m.bot.i < a.r.length; t += Jogo.PASSO) { m.passo(Jogo.PASSO, {}); if (a.onde ? a.onde(h) : h.noChao && h.y <= a.ymax) pisou = true; }
      r.push({ sala: nome, nome: `proibido: ${a.nome}`, venceu: !pisou, log: [`${a.id} x=${h.x.toFixed(0)} y=${h.y.toFixed(0)}`] });
    }
    for (const e of FASES_ERROS[nome] || []) {
      const m = new Mundo(def, { bot: new Bot(e.r), rapido: true });
      for (let t = 0; t < 60 && m.bot.i < e.r.length; t += Jogo.PASSO) m.passo(Jogo.PASSO, {});
      const dano = m.log.filter((l) => /: -1 /.test(l));
      r.push({ sala: nome, nome: `erro: ${e.nome}`, venceu: m.bot.i >= e.r.length && e.ok(m) && !dano.length,
        log: [`comando ${m.bot.i}/${e.r.length}`, m.herois.map((h) => `${h.id} x=${h.x.toFixed(0)} y=${h.y.toFixed(0)}`).join(' '), ...dano] });
    }
    r.push(...confereVolta(def));
    if (def.mapa.some((l) => l.includes('K'))) r.push(conferePonto(def));
  }
  return r;
};

// Cada golpe do Marreta tem que ser preciso onde a fase pede: trocando pelo outro, o robô tem que PERDER.
// Mureta: o soco reto não levanta o Pudim o bastante. Fosso de teto baixo: o gancho bate no teto.
function provaGolpes(d) {
  const provas = [];
  const troca = (acha, novo, nome) => {
    const r = d.roteiro.map((c) => c.slice());
    let n = 0;
    for (let i = 0; i + 2 < r.length; i++) if (acha(r, i)) { r[i] = [novo]; n++; }
    if (!n) return;
    const x = simula(d, r, d.tmax);
    provas.push(Object.assign(x, { nome: `proibido: ${nome}`, venceu: !x.venceu }));
  };
  troca((r, i) => r[i][0] === 'gancho' && r[i + 2][0] === 'esperaChao' && r[i + 2][1] === 'pudim', 'acao', 'Pudim passa a mureta com soco reto');
  troca((r, i) => i > 0 && r[i - 1][0] === 'olha' && r[i][0] === 'acao' && r[i + 2][0] === 'esperaChao' && r[i + 2][1] === 'fiapo',
    'gancho', 'Fiapo passa o fosso de teto baixo com gancho');
  return provas;
}
