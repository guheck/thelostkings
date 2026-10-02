'use strict';

// Uma fase: grade de blocos de qualquer tamanho, objetos (tachinhas, botões, placas, alavancas, portões, portas com
// chave, chaves, rolos de corda, inimigos, saída), colisão e desenho.
//
// Mapa (um caractere por bloco de 40 px):
//   #  papelão            ^  lápis (machuca)      T  tachinha          S  saída          1 2 3  Marreta, Fiapo, Pudim
//   C  papelão rachado    F  folha de papel       r  rolo de barbante (mais uma corda para o Fiapo)
//   B  botão pesado (só o Pudim, fica apertado)   p  placa (qualquer um; só enquanto alguém pisa)   l  alavanca (E)
//   G / P / L  portões do botão / da placa / da alavanca (o def pode ligar outros canais em def.canais)
//   x y z  chaves (vermelha, azul, amarela)       X Y Z  portas trancadas da mesma cor
//   g  guarda   e  escudeiro   o  borracha   q  grampeador olhando para a esquerda   Q  para a direita
//   j  lixeira (joga bolinha de papel; ponha no alto)   u  tesoureiro (corre sem frear e crava a tesoura na parede)
//   a  blindado (soldadinho numa lata: nada derruba, só cair — em cima da trena, a fita recolhida)
//   H  escada de palitos (↑ sobe, ↓ desce; o topo é piso). Com 1 bloco de largura (fresta), só o Fiapo cabe.
//   k  poça de cola (no bloco vazio logo acima do chão): anda devagar e não pula; inimigo e bola do Pudim grudam
//   w  poça de corretivo (idem): escorrega — quem entra embalado não freia nem vira até sair
//   d  rolo de durex (fita larga, deitado): empurra, rola, degrau; o soco ou a bola do Pudim manda rolando (boliche)
//   /  \  rampa de 45° (sobe para a direita / para a esquerda); emendadas na diagonal fazem rampas longas. Quem anda
//         sobe e desce; o durex e a bola do Pudim descem sozinhos, ganhando velocidade
//   v  V  régua-gangorra (no bloco do calço, em cima do chão): v com a ponta esquerda embaixo, V com a direita
//   c  carimbo (no bloco logo abaixo de um teto; desce até o chão embaixo): def.carimbos [{c, l, ritmo, fase}]
//   n  post-it colado no fundo (a dobra da frente é um degrau na linha de baixo do bloco): pisou, treme, cai e volta
//   b  livros deitados: sólido como o papelão; cada fileira de "b" é um livro (a capa de cima é o chão de quem pisa)
//   K  ponto de controle (bandeirinha): o primeiro herói que encosta guarda a fase INTEIRA naquele instante (Jogo.ponto);
//      quem perde os corações (ou aperta R) volta para lá, com alavancas, portões, cordas e inimigos como estavam
//   R  trena (no bloco em cima do chão, na beira de um vão): a fita é a ponte; a bundada do Pudim no botão recolhe / estica
//   E  estojo de zíper (no bloco em cima do chão, o meio dele): só o Marreta empurra; em cima é piso; pesa na placa
//   I  i  pilar da frente (lápis / marca-texto; no bloco logo acima do chão): sobe até o primeiro teto, como se o
//         segurasse; fica no plano da frente (os heróis passam por trás) e não é sólido
const TILE = 40, COLS = 32, LINS = 18; // tamanho padrão (salas do tutorial)
// Profundidade no tampo do chão (FAIXA_CHAO), em px acima da linha da frente. Os heróis pisam na frente (pé da frente na
// linha, o de trás uns 8 px acima): é a pista. Portão e porta ficam em pé na pista (PROF.pista); a saída, um pouco atrás
// dela, com o tapete na frente (PROF.saida); a decoração fica no plano de trás (DECO). (30/09, usuário: a régua e a
// porta "furando o chão", a saída "mais para trás".)
const PROF = { pista: 6, saida: 16 };
// Decoração no plano de trás (30/09, usuário: "tem que ficar mais para trás, numa coloração diferente, meio
// esfumaçado, para indicar que não é interativo"): com névoa (a cor do céu por cima, DECO.nevoa), o pé escondido atrás
// do tampo (a base DECO.afunda px abaixo da linha do chão: a faixa e a laje, desenhadas depois, cobrem) e andando um
// pouco mais devagar que a câmera (DECO.paralaxe, só em x). Os livros de 3/4 saíram: pediam para pular em cima (vão
// virar plataforma), e as peças pequenas (cola, post-its...) sumiam atrás do tampo.
const DECO = { nevoa: 0.45, afunda: 24, paralaxe: 0.9, deriva: 64 }; // deriva: o máximo que a paralaxe desloca (640 x 0,1)
// Pilar da frente (I/i, Nivel.desenhaFrente): em pé na beira da frente do tampo (o pé PILAR.pe px abaixo da linha do
// chão: está na frente da pista; o lápis, cravado: Objetos.pilar); o topo encosta embaixo do teto. Escurecido (na
// frente, fora da luz: como o lápis do estudo de arte). atras: a transparência com o herói ativo atrás dele.
// encaixe: o topo entra na cara da frente do papelão de cima (o pilar aperta a laje; 01/10, estudo de variantes: em par,
// nas duas pontas de uma prateleira solta, com o topo encaixado, ele parece segurar de verdade)
const PILAR = { pe: 4, meiaLarg: 30, atras: 0.5, escuro: 0.28, encaixe: 14 };
const CORES_CHAVE = { x: '#e0443a', y: '#3b7be0', z: '#f1bf3a' };
const NOME_COR = { x: 'vermelha', y: 'azul', z: 'amarela' };
const ESPECIES = { g: 'guarda', e: 'escudeiro', o: 'borracha', q: 'grampeador', Q: 'grampeador', j: 'lixeira', u: 'tesoureiro', a: 'blindado' };
const CANAL_PADRAO = { B: 'b', p: 'p', l: 'l', G: 'b', P: 'p', L: 'l' };
const CORES_CANAL = ['#e2433a', '#3b7be0', '#3fb56a', '#9b6bd6', '#f08a24', '#1fa3b5'];

// Rolo de durex (fita larga, deitado: rola). Grande (68 px): o soco do Marreta, que só pega da cintura para cima,
// alcança. Herói no chão empurra (a 60% da velocidade; a bola do Pudim, com tudo); o soco manda rolando e, rápido, ele
// derruba inimigo como boliche (a régua do escudeiro de frente segura). Para na cola, desliza no corretivo, dá para
// subir nele (degrau) e, parado na placa, segura o portão.
const DUREX = { r: 34, w: 62, empurra: 0.6, atrito: 300, soco: 560, gancho: { vx: 260, vy: -520 }, strike: 220, desce: 1000 };
// Trena (R; 01/10, plano do esboço 3 da Mesa): a caixa da trena no chão, na beira de um vão; a fita é a ponte por cima
// dele — as células do vão viram chão enquanto a fita passa por elas (herói, inimigo e a patrulha dele pisam como em
// papelão). A BUNDADA DO PUDIM no botão (em cima da caixa: pisa-se de cima, como o post-it) recolhe a fita (TREC!) —
// quem está nela cai — ou estica de novo (ZIIP!). Rápida como trena de verdade (usuário, 30/09: estica e recolhe "na
// hora"). Esticando, não entra em quem está no vão: para antes dele. Caixa: o desenho a 0,36 (40 x 40, 1 bloco; trena
// de verdade é pequena): o pulo do Pudim (46 px) passa por cima do botão do chão mesmo. Com 67 px pedia um degrau do lado
// (01/10, usuário: o livro do lado da trena "ficou zoado"). O desafio vem do LUGAR: a caixa na beira de LÁ do vão, e o
// inimigo da fita é o blindado (só cai) — o Pudim chega no botão por outro caminho (o duto, em bola).
const TRENA = { w: 40, h: 40, estica: 1400, recolhe: 2200, escala: 0.36, fita: 16 }; // fita: a altura do desenho da fita (px)
class Trena {
  constructor(n, c, l) {
    const lado = !n.parede(c - 1, l + 1) ? -1 : 1; // o vão: onde o chão acaba junto da caixa
    const celulas = [];
    for (let k = c + lado; k >= 0 && k < n.cols && n.grade[l + 1][k] === '.'; k += lado) celulas.push({ c: k, l: l + 1, fechado: true, tipo: 'fita' });
    Object.assign(this, { x: c * TILE + TILE / 2, chao: (l + 1) * TILE, c, l, lado, celulas, L: celulas.length * TILE, esticada: true });
    for (const q of celulas) n.dyn.set(q.l * n.cols + q.c, q);
  }
  get topo() { return this.chao - TRENA.h; }
  // onde a fita começa (a beira do vão, junto da caixa)
  get boca() { return this.lado < 0 ? this.c * TILE : (this.c + 1) * TILE; }
  superficie(x) { return Math.abs(x - this.x) <= TRENA.w / 2 + 8 ? this.topo : null; } // (+8: o pé de quem está na beira)
  em(M) { return M.herois.filter((h) => h.plat === this); }
  pousa(h, v, M) {
    if (h.id !== 'pudim' || h.estado !== 'bundada') return;
    this.esticada = !this.esticada;
    M.fx(this.esticada ? 'ZIIP!' : 'TREC!', this.x, this.topo - 34, '#ffd23f', 0.9);
    M.tremer(4);
    M.registra(`trena ${this.esticada ? 'estica' : 'recolhe'}`);
  }
  atualiza(dt, M) {
    const n = M.nivel;
    let alvo = this.esticada ? this.celulas.length * TILE : 0;
    if (this.esticada) { // não estica para dentro de quem está no vão
      const i = this.celulas.findIndex((q) => !q.fechado && n._ocupado({ c: q.c, c1: q.c + 1, l0: q.l, l1: q.l + 1 }, M.herois, M.inimigos));
      if (i >= 0) alvo = Math.min(alvo, i * TILE);
    }
    const v = this.esticada ? TRENA.estica : TRENA.recolhe;
    this.L += U.clamp(alvo - this.L, -v * dt, v * dt);
    this.celulas.forEach((q, i) => {
      const fecha = this.L >= (i + 1) * TILE - 2;
      if (fecha !== q.fechado) { q.fechado = fecha; n.versao++; }
    });
  }
}

// Estojo de zíper (E; 01/10, plano do esboço 3 da Mesa): caixa pesada que SÓ O MARRETA empurra (a 45% da velocidade
// dele, na pose de empurrar; os outros travam nele e fazem força). Não rola: para assim que ninguém empurra. Em cima é
// piso (degrau); parado na placa, segura o portão. No caminho dele: empurra o inimigo da frente (para o fosso, se tiver
// um), segura a estocada do lápis (TOC), a tesoura crava nele, grampo e bolinha param nele. Cai em buraco de 5 blocos e
// o fecha (vira chão). Caixa pelo desenho (assets/mesa/estojo.png, 189 x 90, já no tamanho do jogo).
// 01/10, usuário: "tem que ficar totalmente rente ao chão... as plataformas têm aquela faixa que fica para trás dos
// pés dos heróis; o estojo, como é um objeto que você sobe em cima, também tem que ter isso": a linha de pisar é a
// divisa da tampa (vista de cima, com o zíper) com a frente — a linha 25 do desenho —, a tampa fica ATRÁS dos pés com a
// altura da faixa do papelão (tampa), e a frente tem 2 blocos (h): no fosso de 2 blocos ele fica rente ao chão. Largo
// de 5 blocos, o tamanho do fosso (desenho de 200; a frente fica 16% mais alta que o desenho, numa caixa redonda nem
// aparece; com 6, sem deformar, não cabia entre o fosso e a corda dos post-its na Mesa nova).
const ESTOJO = { w: 198, h: 80, tampa: 28, desenho: 200, divisa: 25, empurra: 0.45, escorrega: 160 }; // escorrega: px/s, o meio já fora da beirada
class Estojo {
  constructor(x, y) { Object.assign(this, { x, y, vx: 0, vy: 0, noChao: true, eEstojo: true, travado: 0, cfg: { w: ESTOJO.w, h: ESTOJO.h } }); }
  caixa() { return { x0: this.x - ESTOJO.w / 2, y0: this.y - ESTOJO.h, x1: this.x + ESTOJO.w / 2, y1: this.y }; }
  atualiza(dt, M) {
    const n = M.nivel, x0 = this.x;
    // o meio já passou da beirada (apoiado só de um lado): escorrega sozinho para o buraco e cai (não fica pendurado)
    // (empurrado para lá, vai no mais rápido dos dois)
    if (this.noChao && !n.solidoEm(this.x, this.y + 2)) {
      const e = n.solidoEm(this.x - ESTOJO.w / 2 + 6, this.y + 2), d = n.solidoEm(this.x + ESTOJO.w / 2 - 6, this.y + 2), s = e ? 1 : -1;
      if (e !== d && s * this.vx >= 0) this.vx = s * Math.max(Math.abs(this.vx), ESTOJO.escorrega);
    }
    const vx0 = this.vx;
    this.vy = Math.min(QUEDA_MAX, this.vy + GRAV * dt);
    moveX(this, n, dt);
    // quem está na frente (inimigo ou herói) vai junto (preso na parede, segura o estojo)
    const s = Math.sign(this.x - x0);
    if (s) {
      const c = this.caixa();
      for (const o of [...M.inimigos, ...M.herois]) {
        if (o.vivo === false || o.y <= c.y0 + 4 || o.y - o.cfg.h >= c.y1 - 2 || Math.sign(o.x - this.x) !== s) continue;
        const borda = s > 0 ? c.x1 + o.cfg.w / 2 : c.x0 - o.cfg.w / 2;
        if (s * (borda - o.x) <= 0) continue;
        const ox = o.x, ov = o.vx;
        o.vx = (borda - o.x) / dt; moveX(o, n, dt); o.vx = ov;
        if (Math.abs(o.x - borda) > 0.5) { this.x -= borda - o.x; if (Math.abs(this.x - x0) < 0.5) this.x = x0; }
        if (o.x !== ox && !o.tEmpurradoEstojo) { o.tEmpurradoEstojo = M.t; M.registra(`estojo empurra ${o.especie || o.id}`); }
      }
    }
    this.travado = vx0 && Math.abs(this.x - x0) < 0.01 ? Math.sign(vx0) : this.x !== x0 ? 0 : this.travado;
    this.vx = 0; // não desliza: só anda enquanto empurram
    const dx = this.x - x0;
    if (dx) { this.anda = Math.sign(dx); this.tAndou = M.t; } // (o guarda vê o estojo vindo e estoca nele)
    if (dx) { // quem está em cima vai junto (sem atravessar parede)
      for (const o of [...M.herois, ...M.inimigos]) {
        if (!o.noChao || Math.abs(o.y - this.topo()) > 1.5 || Math.abs(o.x - x0) >= (ESTOJO.w + o.cfg.w) / 2 - 8) continue;
        const ov = o.vx; o.vx = dx / dt; moveX(o, n, dt); o.vx = ov;
      }
    }
    const noChaoAntes = this.noChao, yAntes = this.y;
    moveY(this, n, dt);
    if (this.noChao && !noChaoAntes && this.y - yAntes >= 0 && this.vyAntes > 300) { M.tremer(6); M.fx('PUF!', this.x, this.y - 20, '#e8d6b4', 0.8); M.registra(`estojo caiu x=${Math.round(this.x)}`); }
  }
  // de pé em cima? (piso para heróis e inimigos)
  topo() { return this.y - ESTOJO.h; }
}
// Régua-gangorra (30/09, esboço 3 da Mesa): régua de 384 px num calço de 46 px, girando na ponta dele (o desenho da IA,
// assets/mesa/gangorra-nivel.png). Inclinada, a ponta de baixo encosta no chão e o tampo da de cima fica a 125 px.
// Quem CAI na ponta de cima vira a régua (0,12 s) e lança quem está na outra: a altura vem da queda (v²/2g), do peso de
// quem cai sobre o de quem voa, da bundada do Pudim e de quão na ponta está quem voa. O Fiapo, leve, vai mais alto.
// Mais peso do lado de cima (andando para lá) vira devagar, sem lançar. Pisa-se só de cima, como a corda; a ponta de
// baixo sobe como degrau.
// Ajustes do usuário (30/09, "o Fiapo sobe verticalmente, não cai na plataforma"; "depois que você pula não consegue
// mais resolver"; "se erra o timing, atravessa a gangorra"): quem voa sai em ARCO para fora (vx, para o lado da ponta
// que o lança, e segue o arco sem comando: Heroi.lancado); sem ninguém em cima, a régua volta sozinha para a posição do
// mapa (repouso) depois de um tempo; e quem cai numa ponta que está subindo pousa (superficieAntes).
// Força (medida no confereGangorra): a bundada do Pudim do alto da escadinha de 4 livros lança o Fiapo a ~480 px, acima
// do quicar na barriga (~344: o pé do Fiapo no alto do BOING!) — um lugar a 400 px só se alcança pela gangorra.
// vx: o arco. Com a estante a 80 px da ponta (Mesa nova), 240 px/s chegava na quina 21 px abaixo do topo e batia na
// parede; de ~80 a ~240 passa a quina e pousa em cima; 170 deixa folga dos dois lados (e ainda serve com bundada de 420).
const GANGORRA = { L: 384, calco: 46, espessura: 32, ganho: 0.88, bundada: 1.5, max: 520, rapida: 0.12, lenta: 0.4, degrau: 44,
  vx: 170, volta: 0.8, peso: { marreta: 2, fiapo: 1, pudim: 3 } };
GANGORRA.ang = Math.asin(GANGORRA.calco / (GANGORRA.L / 2));
class Gangorra {
  constructor(x, chao, lado) { Object.assign(this, { x, chao, lado, repouso: lado, ang: lado * GANGORRA.ang, angAntes: lado * GANGORRA.ang, vel: GANGORRA.lenta, vazia: 0 }); }
  get py() { return this.chao - GANGORRA.calco; } // o pivô: a ponta do calço (a régua gira em volta dele)
  // altura do tampo da régua em x (null fora dela), com a régua no ângulo a
  superficie(x, a = this.ang) {
    const d = x - this.x, c = Math.cos(a);
    if (Math.abs(d) > GANGORRA.L / 2 * c) return null;
    return this.py + Math.tan(a) * d - GANGORRA.espessura / c;
  }
  superficieAntes(x) { return this.superficie(x, this.angAntes); }
  // ponta da régua (lado -1 esquerda, 1 direita): onde pisa quem fica bem na ponta
  ponta(lado) { return this.x + lado * (GANGORRA.L / 2 - 30) * Math.cos(this.ang); }
  em(M) { return M.herois.filter((h) => h.plat === this); }
  // h caiu nela com velocidade v: na ponta de cima, vira rápido e lança quem está na outra ponta
  pousa(h, v, M) {
    const lado = Math.sign(h.x - this.x), G = GANGORRA;
    if (!lado || lado === this.lado || v < 250) return;
    this.lado = lado; this.vel = G.rapida;
    M.fx('TOIN!', this.ponta(-lado), this.py - 70, '#e9c77a', 0.8); // na ponta que sobe (a bundada faz o POF! na outra)
    const hQueda = v * v / (2 * GRAV), forca = h.estado === 'bundada' ? G.bundada : 1;
    for (const o of this.em(M)) {
      if (o === h || Math.sign(o.x - this.x) !== -lado) continue;
      const braco = U.clamp(Math.abs(o.x - this.x) / (G.L / 2 * 0.7), 0.3, 1);
      const alt = Math.min(G.max, G.ganho * hQueda * G.peso[h.id] / G.peso[o.id] * forca * braco);
      o.vy = -Math.sqrt(2 * GRAV * alt); o.noChao = false; o.plat = null; o.apoio = null;
      o.vx = -lado * G.vx; o.lancado = true; // em arco, para fora (o lado da ponta que o lança)
      if (o.estado === 'chao') o.muda('ar');
      M.registra(`gangorra lança ${o.id} ${alt.toFixed(0)} px`);
    }
  }
  atualiza(dt, M) {
    this.angAntes = this.ang;
    const alvo = this.lado * GANGORRA.ang, quem = this.em(M);
    this.vazia = quem.length ? 0 : this.vazia + dt;
    if (this.ang === alvo) { // parada: mais peso do lado de cima vira devagar (sem lançar)
      let torque = 0;
      for (const h of quem) torque += GANGORRA.peso[h.id] * (h.x - this.x);
      if (torque && Math.sign(torque) !== this.lado) { this.lado = Math.sign(torque); this.vel = GANGORRA.lenta; }
      // ninguém em cima faz um tempo: volta devagar para a posição do mapa (dá para lançar de novo)
      else if (!torque && this.lado !== this.repouso && this.vazia >= GANGORRA.volta) { this.lado = this.repouso; this.vel = GANGORRA.lenta; }
    }
    const passo = 2 * GANGORRA.ang / this.vel * dt, a = this.lado * GANGORRA.ang;
    this.ang += U.clamp(a - this.ang, -passo, passo);
  }
}

// Carimbo (30/09, esboço 3 da Mesa): preso embaixo de um teto, desce num ritmo, carimba e sobe; a haste estica do teto
// até o corpo (o desenho da IA sem a bola do cabo: ela ficaria em cima do teto, no caminho de quem anda lá). Encostar
// no corpo machuca; inimigo embaixo dele na descida é achatado. Com 6 blocos de vão, parado lá em cima o corpo fica a
// 162 px do chão: todos passam por baixo no tempo certo. Ciclo, em fração do ritmo: parado em cima 46%, desce 6%
// (acelerando), carimbando 17%, sobe 31%. Carimbou uma vez, fica a marca de tinta no chão.
// Ajuste do usuário (30/09): o corpo é sólido — do lado é parede, em cima é plataforma (dá para passar por cima enquanto
// ele está embaixo) e só machuca quem fica ESPREMIDO: embaixo dele quando desce (Heroi._carimbos) ou em cima dele
// contra o teto quando sobe (aqui). pega: quanto o herói tem que estar embaixo do corpo para ser espremido (menos que
// isso, na quina, ele é empurrado para o lado).
const CARIMBO = { w: 120, h: 70, folga: 8, ritmo: 2.6, fases: [0.46, 0.06, 0.17, 0.31], pega: 14 };
class Carimbo {
  constructor(x, teto, chao, ritmo, fase) { Object.assign(this, { x, teto, chao, ritmo, fase, t: 0, tAntes: 0, marcou: false, carimbou: false }); }
  // plataforma (pisa-se de cima, como a gangorra): o tampo do corpo
  superficie(x, t = this.t) { return Math.abs(x - this.x) <= CARIMBO.w / 2 - 4 ? this.caixa(t).y0 : null; }
  superficieAntes(x) { return this.superficie(x, this.tAntes); }
  caixaAntes() { return this.caixa(this.tAntes); }
  em(M) { return M.herois.filter((h) => h.plat === this); }
  pousa() {}
  _u(t) { return ((t / this.ritmo + this.fase) % 1 + 1) % 1; }
  // quanto desceu no tempo t (0 = lá em cima, 1 = carimbando)
  descida(t) {
    const [a, b, c] = CARIMBO.fases, u = this._u(t);
    if (u < a) return 0;
    if (u < a + b) { const k = (u - a) / b; return k * k; }
    if (u < a + b + c) return 1;
    return 1 - (u - a - b - c) / (1 - a - b - c);
  }
  descendo(t) { const [a, b, c] = CARIMBO.fases, u = this._u(t); return u >= a && u < a + b + c; }
  get curso() { return this.chao - 4 - CARIMBO.h - (this.teto + CARIMBO.folga); }
  caixa(t = this.t) {
    const y0 = this.teto + CARIMBO.folga + this.descida(t) * this.curso;
    return { x0: this.x - CARIMBO.w / 2, y0, x1: this.x + CARIMBO.w / 2, y1: y0 + CARIMBO.h };
  }
  toca(x0, y0, x1, y1, t = this.t) { const k = this.caixa(t); return x1 > k.x0 + 6 && x0 < k.x1 - 6 && y1 > k.y0 + 4 && y0 < k.y1 - 2; }
  atualiza(dt, M) {
    this.tAntes = this.t; this.t = M.t;
    const d = this.descida(this.t);
    if (d >= 1 && !this.carimbou) { this.carimbou = this.marcou = true; M.fx('TUM!', this.x, this.chao - 30, '#e9c77a', 0.8); M.tremer(3); }
    if (d < 1) this.carimbou = false;
    // em cima dele quando sobe: a cabeça bate no teto — espremido
    const y0 = this.caixa().y0;
    for (const h of this.em(M)) if (y0 - h.cfg.h < this.teto - 2) { M.registra(`${h.id} espremido no teto pelo carimbo`); h._espremido(M, this); }
    if (!this.descendo(this.t)) return;
    for (const o of M.inimigos) {
      if (!o.vivo) continue;
      const k = o.caixa();
      if (this.toca(k.x0, k.y0, k.x1, k.y1)) o.derrota(0, M, 'PLAFT!', 0, true); // achatado no lugar
    }
  }
}

// Post-it (30/09, esboço 3 da Mesa): colado no fundo (da estante, da parede), com a ponta de baixo dobrada para a
// frente: a dobra é um degrau (pisa-se de cima, como a gangorra). Pisou, ele treme 0,9 s preso pela cola, solta e cai
// girando (0,8 s); some e, 2,5 s depois, pisca (0,7 s) e volta ao lugar ("sai da fase e volta para tentar de novo").
// Em zigue-zague de 3 blocos (120 px), só o Fiapo sobe (pulo de 132 px). O desenho da IA (assets/mesa/postit-colado)
// tem a dobra na linha 87: é ela que fica na linha do degrau.
const POSTIT = { w: 96, treme: 0.9, cai: 0.8, fora: 2.5, volta: 0.7, dobra: 87 };
class Postit {
  constructor(x, y) { Object.assign(this, { x, y, estado: 'colado', t: 0 }); }
  firme() { return this.estado === 'colado' || this.estado === 'treme'; }
  superficie(x) { return this.firme() && Math.abs(x - this.x) <= POSTIT.w / 2 ? this.y : null; }
  em(M) { return M.herois.filter((h) => h.plat === this); }
  pousa() { if (this.estado === 'colado') { this.estado = 'treme'; this.t = 0; } }
  atualiza(dt, M) {
    this.t += dt;
    if (this.estado === 'colado' && this.em(M).length) this.pousa(); // (subiu andando)
    const prox = { treme: ['cai', POSTIT.treme], cai: ['fora', POSTIT.cai], fora: ['volta', POSTIT.fora], volta: ['colado', POSTIT.volta] }[this.estado];
    if (prox && this.t >= prox[1]) {
      this.estado = prox[0]; this.t = 0;
      if (this.estado === 'cai') M.registra('post-it soltou');
    }
  }
}

class Durex {
  constructor(x, y) {
    Object.assign(this, { x, y, vx: 0, vy: 0, noChao: true, giro: 0, eDurex: true, travado: 0, cfg: { w: DUREX.w, h: 2 * DUREX.r } });
  }
  caixa() { return { x0: this.x - DUREX.w / 2, y0: this.y - 2 * DUREX.r, x1: this.x + DUREX.w / 2, y1: this.y }; }
  atualiza(dt, M) {
    const n = M.nivel, piso = this.noChao ? n.piso(this.x, this.y) : null;
    if (this.noChao) {
      if (piso === 'k') this.vx *= Math.max(0, 1 - dt * 12);
      else { const a = (piso === 'w' ? 30 : DUREX.atrito) * dt; this.vx = Math.abs(this.vx) <= a ? 0 : this.vx - Math.sign(this.vx) * a; }
      const r = n.inclinacao(this.x, this.y); // na rampa desce sozinho, ganhando velocidade
      if (r) this.vx -= r * DUREX.desce * dt;
      // redondo: apoiado só pela beirada (o meio já passou da quina), tomba para o lado livre
      else if (!n.solidoEm(this.x, this.y + 2) && n.rampaEntre(this.x, this.y, this.y + 6) == null) {
        const e = n.solidoEm(this.x - DUREX.w / 2 + 6, this.y + 2), d = n.solidoEm(this.x + DUREX.w / 2 - 6, this.y + 2);
        if (e !== d) this.vx += (e ? 1 : -1) * DUREX.desce * dt;
      }
    }
    this.vy = Math.min(QUEDA_MAX, this.vy + GRAV * dt);
    const vx0 = this.vx, x0 = this.x;
    moveX(this, n, dt);
    // bateu (parede, degrau): quem empurra para desse lado; rápido, quica de volta
    this.travado = vx0 && !this.vx ? Math.sign(vx0) : this.x !== x0 ? 0 : this.travado;
    if (this.travado && Math.abs(vx0) > 150) { this.vx = -vx0 * 0.3; M.fx('TUM!', this.x + this.travado * DUREX.r, this.y - DUREX.r, '#e8d6b4', 0.8); }
    moveY(this, n, dt);
    this.giro += (this.x - x0) / DUREX.r;
    if (Math.abs(this.vx) > DUREX.strike) { // boliche
      const c = this.caixa();
      for (const o of M.inimigos) {
        const k = o.caixa();
        if (!o.vivo || k.x1 < c.x0 || k.x0 > c.x1 || k.y1 < c.y0 || k.y0 > c.y1) continue;
        if (o.escudoPara(this.x)) { M.fx('TOC!', (o.x + this.x) / 2, o.y - 60, '#e9c77a'); o.tBloqueio = M.t; this.vx = -this.vx * 0.4; }
        else { o.derrota(Math.sign(this.vx) * 440, M, 'STRIKE!'); this.vx *= 0.6; }
      }
    }
  }
}

// Papel de parede das salas (fases de andares): cada sala é um papel de caderno diferente, bem clarinho
const PAPEIS = {
  quadriculado: { w: 40, h: 40, fundo: '#f3efe2', desenha(q) { q.strokeStyle = '#cad9e5'; q.lineWidth = 1.2; q.beginPath(); for (const v of [0.5, 20.5]) { q.moveTo(v, 0); q.lineTo(v, 40); q.moveTo(0, v); q.lineTo(40, v); } q.stroke(); } },
  pautado: { w: 40, h: 32, fundo: '#f6f1df', margem: '#e9a3a0', desenha(q) { q.strokeStyle = '#bdd0e2'; q.lineWidth = 1.4; q.beginPath(); q.moveTo(0, 31); q.lineTo(40, 31); q.stroke(); } },
  pontilhado: { w: 24, h: 24, fundo: '#efe9da', desenha(q) { q.fillStyle = '#beb39d'; q.beginPath(); q.arc(12, 12, 1.7, 0, Math.PI * 2); q.fill(); } },
  milimetrado: { w: 40, h: 40, fundo: '#edf2e2', desenha(q) {
    q.strokeStyle = '#dce8d0'; q.lineWidth = 1; q.beginPath();
    for (let v = 8.5; v < 40; v += 8) { q.moveTo(v, 0); q.lineTo(v, 40); q.moveTo(0, v); q.lineTo(40, v); }
    q.stroke(); q.strokeStyle = '#c2d7ae'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(0.5, 0); q.lineTo(0.5, 40); q.moveTo(0, 0.5); q.lineTo(40, 0.5); q.stroke();
  } },
  kraft: { w: 64, h: 64, fundo: '#e2cda6', desenha(q) { const r = U.rng(5); q.fillStyle = 'rgba(120,85,45,0.18)'; for (let i = 0; i < 26; i++) q.fillRect(r() * 64, r() * 64, 1 + r() * 2, 1 + r() * 2); } },
  cartolina: { w: 36, h: 36, fundo: '#f3e0d8', desenha(q) { q.strokeStyle = 'rgba(210,150,140,0.16)'; q.lineWidth = 6; q.beginPath(); q.moveTo(-9, 45); q.lineTo(45, -9); q.moveTo(-27, 27); q.lineTo(27, -27); q.moveTo(9, 63); q.lineTo(63, 9); q.stroke(); } },
};

class Nivel {
  constructor(def) {
    this.def = def;
    this.grade = def.mapa.map((l) => l.split(''));
    this.lins = this.grade.length;
    this.cols = Math.max(...this.grade.map((l) => l.length));
    for (const l of this.grade) while (l.length < this.cols) l.push('.');
    this.largura = this.cols * TILE;
    this.altura = this.lins * TILE;
    this.pinos = []; this.controles = []; this.portoes = []; this.portas = [];
    this.chaves = []; this.rolos = []; this.pontos = []; this.inimigosDef = []; this.durex = []; this.gangorras = []; this.carimbos = []; this.postits = [];
    this.pilares = []; this.estojos = []; this.trenas = [];
    const trenas = []; // (montadas depois da grade: a fita olha o chão embaixo)
    this.spawns = {}; this.detritos = []; this.dyn = new Map(); this.versao = 0;
    this.corCanal = {};
    let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity;
    const ids = { 1: 'marreta', 2: 'fiapo', 3: 'pudim' };
    for (let l = 0; l < this.lins; l++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.grade[l][c];
        const x = c * TILE + TILE / 2, chao = (l + 1) * TILE;
        let limpa = true;
        if (t === 'T') this.pinos.push({ x, y: chao, c, l });
        else if (t === 'B' || t === 'p' || t === 'l') {
          const tipo = { B: 'botao', p: 'placa', l: 'alavanca' }[t];
          this.controles.push({ tipo, x, y: chao, c, l, canal: this._canal(c, l, CANAL_PADRAO[t]), ativo: false, ligada: false, tremida: 0 });
        } else if (t === 'S') {
          sx0 = Math.min(sx0, c * TILE); sx1 = Math.max(sx1, (c + 1) * TILE);
          sy0 = Math.min(sy0, l * TILE); sy1 = Math.max(sy1, (l + 1) * TILE);
        } else if (CORES_CHAVE[t]) this.chaves.push({ cor: t, x, y: chao - 22, x0: x, y0: chao - 22, portador: null, usada: false });
        else if (t === 'r') this.rolos.push({ x, y: chao, pego: false });
        else if (t === 'K') this.pontos.push({ x, y: chao, c, l, pego: false });
        else if (t === 'I' || t === 'i') { // o teto: o primeiro bloco sólido acima (sem ele, passa do alto da fase)
          let l2 = l - 1;
          while (l2 >= 0 && !['#', 'C', 'F', 'b'].includes(this.grade[l2][c])) l2--;
          this.pilares.push({ x, c, l, chao, teto: l2 >= 0 ? (l2 + 1) * TILE : -240, p: t === 'I' ? 'lapis-frente' : 'marcatexto-frente' });
        }
        else if (t === 'd') this.durex.push(new Durex(x, chao));
        else if (t === 'E') this.estojos.push(new Estojo(x, chao));
        else if (t === 'R') trenas.push([c, l]);
        // (em pé na pista, como o portão: o calço e a ponta de baixo ficam PROF.pista acima da linha da frente)
        else if (t === 'v' || t === 'V') this.gangorras.push(new Gangorra(x, chao - (this.parede(c, l + 1) ? PROF.pista : 0), t === 'v' ? -1 : 1));
        else if (t === 'n') this.postits.push(new Postit(x, chao));
        else if (t === 'c') { // o teto é o bloco de cima; o chão, o primeiro sólido embaixo (em pé na pista)
          let l2 = l + 1;
          while (l2 < this.lins && !this.parede(c, l2)) l2++;
          const o = (def.carimbos || []).find((q) => q.c === c && q.l === l) || {};
          this.carimbos.push(new Carimbo(x, l * TILE, l2 * TILE - PROF.pista, o.ritmo || CARIMBO.ritmo, o.fase || 0));
        }
        else if (ESPECIES[t]) this.inimigosDef.push({ especie: ESPECIES[t], x, y: chao, f: t === 'Q' ? 1 : -1 });
        else if (ids[t]) this.spawns[ids[t]] = { x, y: chao };
        else limpa = false;
        if (limpa) this.grade[l][c] = '.';
      }
    }
    this.saida = { x0: sx0, y0: sy0, x1: sx1, y1: sy1 };
    this.trenas = trenas.map(([c, l]) => new Trena(this, c, l));
    // portões e portas: grupos de blocos iguais; ficam na grade, mas a solidez vem do estado do objeto
    for (const tipo of ['G', 'P', 'L']) {
      for (const g of this._grupos(tipo)) {
        let canal = CANAL_PADRAO[tipo];
        for (const [c, l] of g) canal = this._canal(c, l, canal);
        const o = { tipo, tiles: g, canal, fechado: true, abertura: 0 };
        this.portoes.push(o);
        for (const [c, l] of g) this.dyn.set(l * this.cols + c, o);
      }
    }
    for (const tipo of ['X', 'Y', 'Z']) {
      for (const g of this._grupos(tipo)) {
        const o = { tipo: 'porta', cor: tipo.toLowerCase(), tiles: g, fechado: true, abertura: 0 };
        this.portas.push(o);
        for (const [c, l] of g) this.dyn.set(l * this.cols + c, o);
      }
    }
    // cor de cada canal (portão e quem abre ficam da mesma cor)
    const canais = [...new Set([...this.controles.map((k) => k.canal), ...this.portoes.map((g) => g.canal)])];
    canais.forEach((k, i) => { this.corCanal[k] = { b: CORES_CANAL[0], p: CORES_CANAL[1], l: CORES_CANAL[2] }[k] || CORES_CANAL[(i + 3) % CORES_CANAL.length]; });
    Object.assign(this.corCanal, def.coresCanal || {}); // a fase pode fixar a cor de um canal (o livro-portão amarelo)
    for (const g of [...this.portoes, ...this.portas]) {
      g.c = Math.min(...g.tiles.map((q) => q[0])); g.c1 = Math.max(...g.tiles.map((q) => q[0])) + 1;
      g.l0 = Math.min(...g.tiles.map((q) => q[1])); g.l1 = Math.max(...g.tiles.map((q) => q[1])) + 1;
    }
    // Estantes de livros (def.estantes [{c0, c1, l0, l1}], do topo até o chão; 30/09, usuário: o portão ali "deveria
    // ser a estante de livros"): a parte de blocos sólidos é a estante cheia de livros (o topo se pisa), embaixo dela
    // passa a pista, e o portão dentro dela é o LIVRO-PORTÃO — o livro puxado para a pista, que a alavanca empurra para
    // dentro. cheio = até onde vão os blocos sólidos (a tábua de baixo, em cima da pista).
    this.estantes = (def.estantes || []).map((e) => {
      let l = e.l0;
      while (l <= e.l1 && [...Array(e.c1 - e.c0 + 1)].every((_, i) => this.grade[l][e.c0 + i] === '#')) l++;
      return Object.assign({ x0: e.c0 * TILE, x1: (e.c1 + 1) * TILE, y0: e.l0 * TILE, y1: (e.l1 + 1) * TILE, cheio: l * TILE }, e);
    });
    for (const g of this.portoes) {
      const e = this.estantes.find((q) => g.c >= q.c0 && g.c1 - 1 <= q.c1 && g.l0 >= q.l0 && g.l1 - 1 <= q.l1);
      g.livro = !!e;
      if (e) e.portaX = Math.min(e.portaX ?? Infinity, g.c * TILE); // (os livros do fundo da pista ficam longe dele)
    }
    // escadas: cada grupo de "H" vira uma escada (x = meio, w = largura, do topo até o chão de baixo)
    this.escadas = this._grupos('H').map((g) => {
      const c0 = Math.min(...g.map((q) => q[0])), c1 = Math.max(...g.map((q) => q[0]));
      const l0 = Math.min(...g.map((q) => q[1])), l1 = Math.max(...g.map((q) => q[1]));
      return { c0, c1, x: (c0 + c1 + 1) * TILE / 2, w: (c1 - c0 + 1) * TILE, yTopo: l0 * TILE, yBase: (l1 + 1) * TILE };
    });
    this.salas = def.salas || [];
    // cor de cada bloco de livro deitado (def.livros [[c, l, cor]], do editor); sem cor, sorteada pela posição
    this.corLivro = new Map((def.livros || []).map(([c, l, cor]) => [l * this.cols + c, cor]));
    this._ret0 = this._retangulos();
  }

  // Escada ao alcance de quem está embaixo ou no meio dela (para subir) / de quem está em cima do topo (para descer)
  escadaEm(h) { return this.escadas.find((L) => Math.abs(h.x - L.x) <= Math.max(L.w / 2, 26) && h.y > L.yTopo + 4 && h.y <= L.yBase + 2) || null; }
  topoEscada(h) { return this.escadas.find((L) => Math.abs(h.x - L.x) <= Math.max(L.w / 2, 26) && Math.abs(h.y - L.yTopo) <= 3) || null; }
  cabeNaEscada(h, L) { return h.cfg.w <= L.w - 4; }
  // Topo de escada funciona como piso para quem cai de cima (pés cruzando a linha do topo)
  topoEntre(x0, x1, yAntes, ny) {
    for (const L of this.escadas) {
      if (yAntes <= L.yTopo + 0.5 && ny >= L.yTopo && x1 > L.c0 * TILE && x0 < (L.c1 + 1) * TILE) return L.yTopo;
    }
    return null;
  }

  _canal(c, l, padrao) {
    const o = (this.def.canais || []).find((q) => q.c === c && q.l === l);
    return o ? o.canal : padrao;
  }

  tile(c, l) {
    if (c < 0 || c >= this.cols) return '#';
    if (l < 0 || l >= this.lins) return '.';
    return this.grade[l][c];
  }
  solido(c, l) {
    const t = this.tile(c, l);
    if (t === '#' || t === 'C' || t === 'F' || t === 'b') return true;
    if (c < 0 || c >= this.cols || l < 0 || l >= this.lins) return false;
    const o = this.dyn.get(l * this.cols + c);
    return !!(o && o.fechado);
  }
  // parede fixa (bloco, parede fraca, papel): portão e porta não contam — a faixa do chão passa por baixo deles
  parede(c, l) { const t = this.tile(c, l); return t === '#' || t === 'C' || t === 'F' || t === 'b'; }
  solidoEm(x, y) {
    const c = Math.floor(x / TILE), l = Math.floor(y / TILE);
    if (this.rampa(c, l)) return y >= this.chaoRampa(c, l, x); // rampa: só a parte cheia, embaixo da inclinação
    return this.solido(c, l);
  }
  // o que se pisa só de cima e se mexe (gangorra, post-it): superficie(x), pousa(h, v, M)
  plataformas() { return this._plats || (this._plats = [...this.gangorras, ...this.postits, ...this.carimbos, ...this.trenas]); }
  // embaixo de um carimbo (em qualquer altura dele): não é lugar seguro para reaparecer
  sobCarimbo(x0, x1, y) { return this.carimbos.some((k) => x1 > k.x - CARIMBO.w / 2 && x0 < k.x + CARIMBO.w / 2 && y > k.teto && y <= k.chao + 8); }
  // Rampa de 45°: 1 = '/' (sobe para a direita), -1 = '\' (sobe para a esquerda), 0 = não é rampa
  rampa(c, l) {
    if (c < 0 || c >= this.cols || l < 0 || l >= this.lins) return 0;
    const t = this.grade[l][c];
    return t === '/' ? 1 : t === '\\' ? -1 : 0;
  }
  // y do chão da rampa (c, l) no ponto x
  chaoRampa(c, l, x) {
    const d = U.clamp(x - c * TILE, 0, TILE);
    return this.rampa(c, l) > 0 ? (l + 1) * TILE - d : l * TILE + d;
  }
  // Chão de rampa embaixo do ponto x com y entre y0 e y1 (o mais alto), ou null
  rampaEntre(x, y0, y1) {
    const c = Math.floor(x / TILE);
    for (let l = Math.floor(y0 / TILE); l <= Math.floor(y1 / TILE); l++) {
      if (!this.rampa(c, l)) continue;
      const y = this.chaoRampa(c, l, x);
      if (y >= y0 - 0.5 && y <= y1) return y;
    }
    return null;
  }
  // Pés em cima de rampa? Devolve a direção dela (1 '/', -1 '\'); a descida é para o lado -r
  inclinacao(x, y) {
    const c = Math.floor(x / TILE);
    for (const l of [Math.floor((y - 1) / TILE), Math.floor((y + 1) / TILE)]) {
      const r = this.rampa(c, l);
      if (r && Math.abs(this.chaoRampa(c, l, x) - y) < 3) return r;
    }
    return 0;
  }
  // Poça em que os pés estão ('k' cola, 'w' corretivo) ou null: o bloco logo acima do chão, no meio do corpo
  piso(x, y) {
    const t = this.tile(Math.floor(x / TILE), Math.floor((y - 1) / TILE));
    return t === 'k' || t === 'w' ? t : null;
  }

  // Zona dos lápis: o bloco "^" e um pedaço acima (as pontas saem para fora)
  // (semCarimbo: o inimigo; o carimbo mesmo é que achata quem está embaixo dele na descida)
  perigo(x0, y0, x1, y1, semCarimbo) {
    if (!semCarimbo) for (const k of this.carimbos) if (k.toca(x0, y0, x1, y1)) return true;
    const c0 = Math.floor(x0 / TILE), c1 = Math.floor(x1 / TILE);
    const l0 = Math.floor(y0 / TILE), l1 = Math.floor((y1 + 30) / TILE);
    for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
      if (this.tile(c, l) === '^' && y1 > l * TILE - 26) return true;
    }
    return false;
  }

  // Grupos de blocos ligados do mesmo tipo
  _grupos(tipo) {
    const vistos = new Set(), grupos = [], C = this.cols;
    for (let l = 0; l < this.lins; l++) for (let c = 0; c < C; c++) {
      if (this.grade[l][c] !== tipo || vistos.has(l * C + c)) continue;
      const g = [], fila = [[c, l]];
      vistos.add(l * C + c);
      while (fila.length) {
        const [cc, ll] = fila.pop();
        g.push([cc, ll]);
        for (const [dc, dl] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = cc + dc, nl = ll + dl;
          if (this.tile(nc, nl) === tipo && !vistos.has(nl * C + nc)) { vistos.add(nl * C + nc); fila.push([nc, nl]); }
        }
      }
      grupos.push(g);
    }
    return grupos;
  }
  grupoEm(c, l) {
    const tipo = this.tile(c, l);
    return this._grupos(tipo).find((g) => g.some(([cc, ll]) => cc === c && ll === l)) || [];
  }

  // Quebra o grupo inteiro (papelão rachado ou folha de papel) e solta pedaços
  quebra(c, l) {
    const tipo = this.tile(c, l);
    if (tipo !== 'C' && tipo !== 'F') return false;
    const r = U.rng(c * 131 + l * 7);
    const coresC = comObjetos() ? Objetos.d.fraca.cores : ['#c48b52', '#dcaa70']; // pedaços da cor do desenho
    this.versao++;
    for (const [cc, ll] of this.grupoEm(c, l)) {
      this.grade[ll][cc] = '.';
      for (let i = 0; i < 5; i++) {
        this.detritos.push({
          x: cc * TILE + r() * TILE, y: ll * TILE + r() * TILE, vx: (r() - 0.5) * 420, vy: -150 - r() * 350,
          rot: r() * 6, vr: (r() - 0.5) * 14, vida: 1.2 + r() * 0.5, tam: 8 + r() * 10,
          cor: tipo === 'C' ? coresC[Math.floor(r() * coresC.length)] : (r() < 0.5 ? '#fbf7ec' : '#e8eef8'),
        });
      }
    }
    return true;
  }

  // Alavanca ao alcance de alguém (para o E)
  alavancaPerto(h) {
    return this.controles.find((k) => k.tipo === 'alavanca' && Math.abs(k.x - h.x) < 42 && Math.abs(k.y - h.y) < 24) || null;
  }

  // Canais: botão pesado fica apertado; placa só enquanto alguém pisa; alavanca liga/desliga.
  // Portão fecha quando o canal desliga — mas nunca em cima de alguém.
  atualizaCanais(dt, herois, inimigos, M) {
    const ativos = {};
    const pisa = (k, o) => o.noChao && Math.abs(o.x - k.x) < 26 && Math.abs(o.y - k.y) < 5;
    for (const k of this.controles) {
      k.tremida = Math.max(0, k.tremida - dt);
      if (k.tipo === 'botao') {
        for (const h of herois) {
          if (!pisa(k, h)) continue;
          if (h.id === 'pudim') {
            if (!k.ativo) { k.ativo = true; h.diz('Clique!'); M.fx('CLIQUE!', k.x, k.y - 40, '#3fb56a'); }
          } else if (!k.ativo && k.tremida <= 0) { k.tremida = 1.6; h.diz('Leve demais...'); }
        }
      } else if (k.tipo === 'placa') {
        const antes = k.ativo;
        // o rolo de durex é largo: vale qualquer parte dele em cima da placa
        const rolo = this.durex.some((o) => o.noChao && Math.abs(o.x - k.x) < DUREX.w / 2 + 4 && Math.abs(o.y - k.y) < 5)
          || this.estojos.some((o) => o.noChao && Math.abs(o.x - k.x) < ESTOJO.w / 2 + 4 && Math.abs(o.y - k.y) < 5); // (o estojo também)
        k.ativo = herois.some((h) => pisa(k, h)) || inimigos.some((o) => o.vivo && pisa(k, o)) || rolo;
        if (k.ativo && !antes) M.fx('clic', k.x, k.y - 30, '#fffdf6', 0.7);
      } else { // alavanca: ligada, fica inclinada para o lado de quem puxou; desligada, em pé (vai girando, não pula)
        k.ativo = k.ligada;
        const alvo = k.ligada ? (k.lado || 1) * 0.32 : 0;
        // giro em 0,14 s, sem freio: o desenho da IA troca de posição junto com a pose de quem puxa (0,12 s)
        k.ang = k.ang == null ? alvo : k.ang + U.clamp(alvo - k.ang, -dt * 0.32 / 0.14, dt * 0.32 / 0.14);
      }
      if (k.ativo) ativos[k.canal] = true;
    }
    for (const g of this.portoes) {
      const aberto = !!ativos[g.canal];
      if (aberto && g.fechado) { g.fechado = false; this.versao++; }
      else if (!aberto && !g.fechado && !this._ocupado(g, herois, inimigos)) { g.fechado = true; this.versao++; }
    }
    for (const g of [...this.portoes, ...this.portas]) g.abertura += ((g.fechado ? 0 : 1) - g.abertura) * Math.min(1, dt * 7);
  }
  _ocupado(g, herois, inimigos) {
    const x0 = g.c * TILE, x1 = g.c1 * TILE, y0 = g.l0 * TILE, y1 = g.l1 * TILE;
    return [...herois, ...inimigos.filter((o) => o.vivo)].some((o) => o.x + o.cfg.w / 2 > x0 && o.x - o.cfg.w / 2 < x1 && o.y > y0 && o.y - o.cfg.h < y1);
  }
  abrePorta(p) { if (p.fechado) { p.fechado = false; this.versao++; } }

  // Retângulos sólidos atuais (para o barbante colidir)
  retsFisica() {
    if (this._rets && this._versao === this.versao) return this._rets;
    const rets = [];
    for (let l = 0; l < this.lins; l++) {
      let c = 0;
      while (c < this.cols) {
        if (!this.solido(c, l)) { c++; continue; }
        const c0 = c;
        while (c < this.cols && this.solido(c, l)) c++;
        rets.push({ x: c0 * TILE, y: l * TILE, w: (c - c0) * TILE, h: TILE });
      }
    }
    this._rets = rets;
    this._versao = this.versao;
    return rets;
  }

  atualiza(dt) {
    for (const d of this.detritos) {
      d.vy += 1600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.vida -= dt;
    }
    if (this.detritos.length) this.detritos = this.detritos.filter((d) => d.vida > 0 && d.y < this.altura + 200);
  }

  // --- desenho --------------------------------------------------------------
  // Retângulos de papelão: junta blocos "#" em faixas e depois empilha faixas iguais
  _retangulos() {
    const faixas = [];
    for (let l = 0; l < this.lins; l++) {
      let c = 0;
      while (c < this.cols) {
        if ((this.def.mapa[l][c] || '.') !== '#') { c++; continue; }
        const c0 = c;
        while (c < this.cols && this.def.mapa[l][c] === '#') c++;
        faixas.push({ c0, c1: c, l0: l, l1: l + 1 });
      }
    }
    const rets = [];
    for (const f of faixas) {
      const r = rets.find((q) => q.c0 === f.c0 && q.c1 === f.c1 && q.l1 === f.l0);
      if (r) r.l1 = f.l1; else rets.push({ ...f });
    }
    return rets.sort((a, b) => b.l0 - a.l0);
  }

  // Papelão, lápis e tachinhas só da parte visível (v = retângulo do mundo na tela)
  desenhaFixo(g, v) {
    const dentro = (x0, y0, x1, y1) => x1 >= v.x0 - 60 && x0 <= v.x1 + 60 && y1 >= v.y0 - 140 && y0 <= v.y1 + 60;
    if (this.salas.length) this._desenhaSalas(g, v, dentro);
    const c0 = Math.max(0, Math.floor(v.x0 / TILE) - 2), c1 = Math.min(this.cols - 1, Math.ceil(v.x1 / TILE) + 2);
    this._decoracao(g, 'fundo', dentro, v); // plano de trás: antes de tudo do plano do jogo (o tampo cobre o pé)
    for (let l = 0; l < this.lins; l++) for (let c = c0; c <= c1; c++) {
      if ((this.def.mapa[l][c] || '.') !== '^') continue;
      const cores = ['#f2c230', '#e0533d', '#3b7be0', '#3fb56a', '#9b6bd6'];
      const h = 70 + U.hash(c * 7 + l) * 34, rot = (U.hash(c * 11 + l * 3) - 0.5) * 0.22;
      Cenario.lapis(g, c * TILE + 20, (l + 1) * TILE + 8, h, rot, cores[(c + l) % cores.length]);
    }
    for (const r of this._ret0) {
      const x = r.c0 * TILE, y = r.l0 * TILE, w = (r.c1 - r.c0) * TILE, h = (r.l1 - r.l0) * TILE + (r.l1 >= this.lins ? 30 : 0);
      if (dentro(x, y, x + w, y + h)) Cenario.plataforma(g, x, y, w, h);
    }
    this._faixas(g, c0, c1, dentro);
    // chão de baixo das fases da Mesa (def.chaoMesa): o tampo de madeira da mesa por cima do papelão e da faixa
    if (this.def.chaoMesa && comObjetos()) {
      for (const r of this._ret0) {
        if (r.l1 < this.lins || r.c0 > 0 || r.c1 < this.cols) continue;
        const y = r.l0 * TILE;
        if (dentro(0, y - 40, this.largura, this.altura)) Objetos.tampo(g, 0, this.largura, y, this.altura + 30);
      }
    }
    // livros deitados: um por fileira de "b" da mesma cor, de baixo para cima (o de cima cobre a capa do de baixo; a
    // capa do último é o chão). Cor escolhida no editor (sem ela, sorteada); comprimento um pouco diferente e
    // desalinhado de leve (não passa de parede nem entra no livro do lado)
    const corEm = (c, l) => { // a escolhida, ou a da fileira inteira de "b" (sorteada pela ponta dela)
      const k = this.corLivro.get(l * this.cols + c);
      if (k != null) return k;
      let a = c;
      while (a > 0 && this.grade[l][a - 1] === 'b') a--;
      return Math.floor(U.hash(a * 3 + l * 17) * 4);
    };
    for (let l = this.lins - 1; l >= 0; l--) for (let c = c0; c <= c1; c++) {
      if (this.grade[l][c] !== 'b') continue;
      const cor = corEm(c, l);
      if (c > c0 && this.grade[l][c - 1] === 'b' && corEm(c - 1, l) === cor) continue;
      let a = c, b = c;
      while (a > 0 && this.grade[l][a - 1] === 'b' && corEm(a - 1, l) === cor) a--;
      while (b + 1 < this.cols && this.grade[l][b + 1] === 'b' && corEm(b + 1, l) === cor) b++;
      const r = U.hash(a * 13 + l * 7), s = U.hash(b * 5 + l * 11), solto = (cc) => !this.parede(cc, l);
      const x0 = a * TILE - (solto(a - 1) ? 2 + r * 6 : 0), x1 = (b + 1) * TILE + (solto(b + 1) ? 2 + s * 6 : 0);
      if (!dentro(x0, l * TILE - 30, x1, (l + 1) * TILE)) continue;
      if (!(comObjetos() && Objetos.livroDeitado(g, x0, x1, (l + 1) * TILE, cor))) Nivel.desenhaLivroDeitado(g, x0, x1, (l + 1) * TILE, cor);
    }
    for (const e of this.estantes) { // por cima dos blocos dela (que são a parte cheia de livros)
      if (dentro(e.x0 - 20, e.y0 - 40, e.x1 + 20, e.y1) && !(comObjetos() && Objetos.estante(g, e))) Nivel.desenhaEstante(g, e);
    }

    // poças de cola e de corretivo: uma por fileira de blocos iguais, deitada no chão (desenhada no primeiro bloco dela)
    for (let l = 0; l < this.lins; l++) for (let c = c0; c <= c1; c++) {
      const t = this.grade[l][c];
      if ((t !== 'k' && t !== 'w') || (c > c0 && this.grade[l][c - 1] === t)) continue;
      let a = c, b = c;
      while (a > 0 && this.grade[l][a - 1] === t) a--;
      while (b + 1 < this.cols && this.grade[l][b + 1] === t) b++;
      // o frasco/caneta fica na ponta aberta (as duas fechadas: dentro da poça, na direita)
      const lado = !this.solido(b + 1, l) ? 1 : !this.solido(a - 1, l) ? -1 : 0;
      if (!(comObjetos() && Objetos.poca(g, t, a * TILE, (l + 1) * TILE, b - a + 1, lado))) Nivel.desenhaPoca(g, t, a * TILE, (l + 1) * TILE, (b - a + 1) * TILE);
    }
    for (let l = 0; l < this.lins; l++) for (let c = c0; c <= c1; c++) {
      const r = this.rampa(c, l);
      if (r && dentro(c * TILE, l * TILE, (c + 1) * TILE, (l + 1) * TILE)) Cenario.rampa(g, c * TILE, l * TILE, r, !this.solido(c + (r > 0 ? 1 : -1), l));
    }
    this._faixas(g, c0, c1, dentro, 'rampa');
    this._faixas(g, c0, c1, dentro, 'linha');
    for (const p of this.pinos) if (dentro(p.x - 20, p.y - 40, p.x + 20, p.y)) Cenario.tachinha(g, p.x, p.y);
    for (const L of this.escadas) if (dentro(L.x - L.w / 2, L.yTopo - 40, L.x + L.w / 2, L.yBase)) Nivel.desenhaEscada(g, L);
    this._decoracao(g, 'frente', dentro);
  }

  // Estojos de zíper: depois dos inimigos (a ponta do lápis que bate nele fica atrás da face) e antes dos heróis
  desenhaEstojos(ctx, v) {
    for (const e of this.estojos) {
      if (e.x + 100 < v.x0 || e.x - 100 > v.x1 || e.y < v.y0 || e.y - 100 > v.y1) continue;
      if (!(comObjetos() && Objetos.estojo(ctx, e))) Nivel.desenhaEstojo(ctx, e);
    }
  }
  // (x, y) dentro de um estojo de zíper? (grampo e bolinha param nele)
  noEstojo(x, y) { return this.estojos.some((e) => { const k = e.caixa(); return x > k.x0 && x < k.x1 && y > k.y0 && y < k.y1; }); }

  // Plano da frente do mapa, depois dos heróis: os pilares (I/i; 01/10, usuário: "um pilar... cravado no chão, indo
  // até o teto... você passa por trás desse pilar mas você atravessa ele"). Com o herói ativo atrás, meio transparente
  // (quem você controla nunca some).
  desenhaFrente(g, v, ativo) {
    for (const P of this.pilares) {
      if (P.x + 50 < v.x0 || P.x - 50 > v.x1 || P.chao + 30 < v.y0 || P.teto > v.y1) continue;
      const atras = !!ativo && Math.abs(ativo.x - P.x) < ativo.cfg.w / 2 + PILAR.meiaLarg && ativo.y > P.teto && ativo.y - ativo.cfg.h < P.chao;
      const a = atras ? PILAR.atras : 1;
      if (!(comObjetos() && Objetos.pilar(g, P, a))) Nivel.desenhaPilar(g, P, a);
    }
  }
  // (sem a arte da IA) pilar marrom-escuro com a ponta de lápis ou a tampa
  static desenhaPilar(g, P, a) {
    const w = PILAR.meiaLarg * 2, x0 = P.x - w / 2, y1 = P.chao + PILAR.pe, lapis = P.p === 'lapis-frente', y0 = P.teto + (lapis ? 40 : 0);
    g.save(); g.globalAlpha = a;
    if (lapis) Estilo.forma(g, (c) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(P.x, P.teto); c.lineTo(x0 + w, y0); c.closePath(); }, { cor: '#8a7356' }, { elev: 0, linha: 3, cel: false });
    Estilo.forma(g, (c) => U.retRed(c, x0, y0, w, y1 - y0, 4), { cor: lapis ? '#7d6a33' : '#8f8f86' }, { elev: 0, linha: 3, cel: false });
    if (!lapis) Estilo.forma(g, (c) => U.retRed(c, x0 - 3, P.teto, w + 6, 70, 8), { cor: '#2f6b3a' }, { elev: 0, linha: 3, cel: false });
    g.restore();
  }

  // Decoração da fase (def.decoracao, posta à mão: tools/piloto_mesa.py): peças da IA sem física.
  // Camada 'fundo': no plano de trás (DECO), em pé atrás do tampo do chão y. Camada 'frente': na cara da frente do chão
  // (etiqueta), por cima de tudo. { p: peça, x: meio, y: chão, a: altura, c: camada, e: espelha }. Sem a arte da IA, nada.
  // v.par: com a câmera do jogo (paralaxe em volta do meio da tela); no mapa e no editor, cada peça no seu x.
  _decoracao(g, camada, dentro, v = {}) {
    if (!this.def.decoracao || !comObjetos()) return;
    const cx = (v.x0 + v.x1) / 2;
    for (const d of this.def.decoracao) {
      if ((d.c || 'fundo') !== camada || !dentro(d.x - d.a * 1.5 - DECO.deriva, d.y - d.a - 20, d.x + d.a * 1.5 + DECO.deriva, d.y + DECO.afunda)) continue;
      if (camada !== 'fundo') { Objetos.peca(g, `decoracao/${d.p}`, d.x, d.y, d.a, false, !!d.e); continue; }
      const chave = Objetos.nevoa(`decoracao/${d.p}`, DECO.nevoa), x = v.par ? cx + (d.x - cx) * DECO.paralaxe : d.x;
      if (chave) Objetos.peca(g, chave, x, d.y + DECO.afunda, d.a, false, !!d.e);
    }
  }


  // Faixa do tampo (Cenario.faixa) em todo bloco em que dá para ficar em cima (papelão, parede fraca, papel), sem marcar
  // nada no mapa: modo 'reta', uma por fileira de blocos de cima (só onde o de cima está livre); 'rampa', uma em cada
  // rampa, inclinada (desenhada depois delas); 'linha', a linha da frente do chão, um traço só passando por blocos e
  // rampas (por cima de tudo: nas emendas os contornos da quina, da rampa e da faixa deixavam risquinhos sobrando).
  _faixas(g, c0, c1, dentro, modo = 'reta') {
    const F = FAIXA_CHAO, bloco = (t) => t === '#' || t === 'C'; // o papel ('F') não: a folha cobre a altura da faixa
    const topo = (c, l) => bloco(this.grade[l][c]) && l > 0 && !this.parede(c, l - 1) && this.grade[l - 1][c] !== '^' && !this.rampa(c, l - 1);
    if (modo === 'linha') {
      // pedaços (da esquerda para a direita) e emendas pelas pontas
      const seg = [], ini = new Map();
      for (let l = 1; l < this.lins; l++) for (let c = Math.max(0, c0 - 1); c <= Math.min(this.cols - 1, c1 + 1); c++) {
        const r = this.rampa(c, l), x = c * TILE, y = l * TILE;
        let s = null;
        if (topo(c, l)) s = [x, y, x + TILE, y];
        else if (r > 0) s = [x, y + TILE, x + TILE, y];
        else if (r < 0) s = [x, y, x + TILE, y + TILE];
        if (!s) continue;
        s.livre0 = !r && !this.parede(c - 1, l - 1) && !this.rampa(c - 1, l) && !this.rampa(c - 1, l - 1); // ponta solta: quina
        s.livre1 = !r && !this.parede(c + 1, l - 1) && !this.rampa(c + 1, l) && !this.rampa(c + 1, l - 1);
        seg.push(s); ini.set(`${s[0]},${s[1]}`, s);
      }
      const temAntes = new Set(seg.map((s) => `${s[2]},${s[3]}`));
      g.strokeStyle = F.linha; g.lineWidth = 2.6; g.lineJoin = 'round'; g.lineCap = 'butt';
      for (const s0 of seg) {
        if (temAntes.has(`${s0[0]},${s0[1]}`)) continue; // não é começo de corrente
        g.beginPath(); g.moveTo(s0[0] + (s0.livre0 ? F.quina : 0), s0[1] + 0.8);
        let s = s0, fim = s0;
        while (s) { g.lineTo(s[2] - (s.livre1 && !ini.has(`${s[2]},${s[3]}`) ? F.quina : 0), s[3] + 0.8); fim = s; s = ini.get(`${s[2]},${s[3]}`); }
        if (dentro(s0[0], Math.min(s0[1], fim[3]) - 40, fim[2], Math.max(s0[1], fim[3]) + 40)) g.stroke();
      }
      return;
    }
    if (modo === 'reta') {
      for (let l = 1; l < this.lins; l++) for (let c = c0; c <= c1; c++) {
        if (!topo(c, l) || (c > c0 && topo(c - 1, l))) continue;
        let b = c;
        while (b + 1 < this.cols && topo(b + 1, l)) b++;
        const x0 = c * TILE, x1 = (b + 1) * TILE, y = l * TILE;
        // as pontas livres recuam um pouco no fundo (perspectiva); encostadas numa parede, vão até ela; encostadas numa
        // rampa (no pé dela ou no topo), emendam reto na faixa inclinada (null)
        const papel = (cc) => this.grade[l][cc] === 'F' && !this.solido(cc, l - 1);
        const e0 = this.rampa(c - 1, l) === 1 || this.rampa(c - 1, l - 1) === -1 ? null : papel(c - 1) ? 'emenda' : this.parede(c - 1, l - 1) ? 0 : F.recuo;
        const e1 = this.rampa(b + 1, l) === -1 || this.rampa(b + 1, l - 1) === 1 ? null : papel(b + 1) ? 'emenda' : this.parede(b + 1, l - 1) ? 0 : F.recuo;
        if (dentro(x0, y - F.h, x1, y)) Cenario.faixa(g, x0, x1, y, e0, e1);
      }
      return;
    }
    for (let l = 0; l < this.lins; l++) for (let c = c0; c <= c1; c++) { // rampas: a faixa sobe junto
      const r = this.rampa(c, l);
      if (!r || !dentro(c * TILE, l * TILE - F.h, (c + 1) * TILE, (l + 1) * TILE)) continue;
      const xa = c * TILE, xb = (c + 1) * TILE, ya = r > 0 ? (l + 1) * TILE : l * TILE, yb = r > 0 ? l * TILE : (l + 1) * TILE;
      g.beginPath(); g.moveTo(xa, ya + 1); g.lineTo(xa, ya - F.h); g.lineTo(xb, yb - F.h); g.lineTo(xb, yb + 1); g.closePath();
      // o mesmo degradê da faixa reta (frente clara, fundo escuro), atravessando a faixa inclinada
      const gr = g.createLinearGradient(xa, ya, xa - r * F.h / 2, ya - F.h / 2);
      gr.addColorStop(0, F.frente); gr.addColorStop(1, F.fundo);
      g.fillStyle = gr; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = F.linha; g.beginPath(); g.moveTo(xa, ya - F.h); g.lineTo(xb, yb - F.h); g.stroke();
    }
  }

  // Fundo do prédio (aparece nos buracos das lajes) e o papel de parede de cada sala, com sombra embaixo da laje
  _desenhaSalas(g, v, dentro) {
    const x0 = Math.max(0, v.x0 - 60), y0 = Math.max(0, v.y0 - 60);
    g.fillStyle = '#7d5c3f';
    g.fillRect(x0, y0, Math.min(this.largura, v.x1 + 60) - x0, Math.min(this.altura, v.y1 + 60) - y0);
    for (const s of this.salas) {
      if (!dentro(s.x0, s.y0, s.x1, s.y1)) continue;
      const P = PAPEIS[s.papel] || PAPEIS.quadriculado, w = s.x1 - s.x0, h = s.y1 - s.y0;
      g.fillStyle = P.fundo; g.fillRect(s.x0, s.y0, w, h);
      g.fillStyle = this._padrao(g, s.papel); g.fillRect(s.x0, s.y0, w, h);
      if (P.margem) { g.fillStyle = P.margem; g.fillRect(s.x0 + 64, s.y0, 2.5, h); }
      const sg = g.createLinearGradient(0, s.y0, 0, s.y0 + 36);
      sg.addColorStop(0, 'rgba(70,45,25,0.24)'); sg.addColorStop(1, 'rgba(70,45,25,0)');
      g.fillStyle = sg; g.fillRect(s.x0, s.y0, w, 36);
    }
  }
  _padrao(g, tipo) {
    const todos = Nivel._padroes || (Nivel._padroes = new WeakMap());
    let cache = todos.get(g);
    if (!cache) { cache = {}; todos.set(g, cache); }
    if (!cache[tipo]) {
      const P = PAPEIS[tipo] || PAPEIS.quadriculado, cv = document.createElement('canvas');
      cv.width = P.w * 2; cv.height = P.h * 2;
      const q = cv.getContext('2d');
      q.scale(2, 2);
      P.desenha(q);
      const pat = g.createPattern(cv, 'repeat');
      if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.5));
      cache[tipo] = pat;
    }
    return cache[tipo];
  }

  // Escada de palitos de picolé: dois palitos em pé e os degraus deitados (passa pelo buraco da laje)
  static desenhaEscada(g, L) {
    if (comObjetos() && Objetos.escada(g, L)) return;
    const larga = L.w > 60, tr = larga ? 10 : 8;
    const xa = L.x - L.w / 2 + (larga ? 11 : 5), xb = L.x + L.w / 2 - (larga ? 11 : 5) - tr;
    const yt = L.yTopo - 30, yb = L.yBase;
    Estilo.forma(g, (c) => {
      c.beginPath();
      for (let y = yb - 22; y > L.yTopo - 16; y -= 30) c.roundRect(xa - 4, y - 4, xb + tr - xa + 8, 8, 4);
    }, { cor: '#e6c083' }, { elev: 1, linha: 2.2, celK: 2 });
    Estilo.forma(g, (c) => { c.beginPath(); c.roundRect(xa, yt, tr, yb - yt, 5); c.roundRect(xb, yt, tr, yb - yt, 5); },
      { cor: '#f0d39c' }, { elev: 1.5, linha: 2.5, celK: 2 });
  }

  // Zona de chegada: a porta e mais um bloco de cada lado (onde não for parede) — o tapete. Três lado a lado não
  // cabem numa porta de 2 blocos, e o Pudim desenhado é mais largo que a caixa dele.
  zonaSaida() {
    const s = this.saida, l = Math.floor((s.y1 - 1) / TILE);
    const c0 = Math.floor(s.x0 / TILE), c1 = Math.floor((s.x1 - 1) / TILE);
    return { x0: s.x0 - (this.solido(c0 - 1, l) ? 0 : TILE), x1: s.x1 + (this.solido(c1 + 1, l) ? 0 : TILE) };
  }

  // naSaida: quem já está na zona de chegada (um por herói, na ordem Marreta, Fiapo, Pudim)
  desenhaVivo(ctx, t, naSaida, v) {
    const dentro = (x0, y0, x1, y1) => x1 >= v.x0 - 60 && x0 <= v.x1 + 60 && y1 >= v.y0 - 100 && y0 <= v.y1 + 60;
    const todosDentro = naSaida.every(Boolean);
    for (const p of this.pontos) if (dentro(p.x - 30, p.y - 110, p.x + 60, p.y)) Nivel.desenhaPonto(ctx, p, t);
    // saída: portinha de castelo, com o tapete da chegada na frente e uma coroinha acesa para cada um que chegou
    const s = this.saida;
    if (s.x1 > s.x0 && dentro(s.x0 - TILE, s.y0 - 40, s.x1 + TILE, s.y1)) {
      const w = s.x1 - s.x0, h = s.y1 - s.y0, z = this.zonaSaida(), pr = PROF.saida;
      // o tapete deitado no tampo, da porta (lá atrás) até perto da linha da frente; a porta fica em pé atrás dele. Visto
      // de cima como a faixa: fundo mais escuro, frente mais clara, contorno fino e uma barra dourada (sem "altura")
      const tx = z.x0 + 6, tw = z.x1 - z.x0 - 12, ty = s.y1 - pr - 1, th = pr - 2, [c0, c1] = todosDentro ? ['#e8c65a', '#ffe483'] : ['#8f2c3a', '#c24453'];
      const gt = ctx.createLinearGradient(0, ty, 0, ty + th);
      gt.addColorStop(0, c0); gt.addColorStop(1, c1);
      ctx.save();
      U.retRed(ctx, tx, ty, tw, th, 3); ctx.fillStyle = gt; ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(43,26,18,0.85)'; ctx.stroke();
      U.retRed(ctx, tx + 5, ty + 3, tw - 10, th - 6, 2); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,214,90,0.8)'; ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.translate(0, -pr);
      // uma bolinha por herói (ordem do HUD): dourada = chegou, vazia = falta
      for (let i = 0; i < naSaida.length; i++) {
        Estilo.forma(ctx, (c) => U.circulo(c, s.x0 + w / 2 + (i - 1) * 20, s.y0 - 38, 7),
          { cor: naSaida[i] ? '#ffd23f' : '#fffdf6' }, { elev: 0, linha: 2.5, cel: false });
      }
      if (!(comObjetos() && Objetos.saida(ctx, s, todosDentro, t))) {
        Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(s.x0, s.y1); c.lineTo(s.x0, s.y0 + w / 2); c.arc(s.x0 + w / 2, s.y0 + w / 2, w / 2, Math.PI, 0); c.lineTo(s.x1, s.y1); c.closePath(); },
          { cor: '#c6b3dc' }, { elev: 2, linha: 3 });
        Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(s.x0 + 12, s.y1); c.lineTo(s.x0 + 12, s.y0 + w / 2 + 6); c.arc(s.x0 + w / 2, s.y0 + w / 2 + 6, w / 2 - 12, Math.PI, 0); c.lineTo(s.x1 - 12, s.y1); c.closePath(); },
          { cor: todosDentro ? '#ffe483' : '#6d5a86' }, { elev: 1, linha: 2.5, cel: false });
        coroa(ctx, s.x0 + w / 2, s.y0 - 4 + Math.sin(t * 3) * 2, 34, 22, Math.sin(t * 2) * 0.08);
      }
      Estilo.texto(ctx, 'SAÍDA', s.x0 + w / 2, s.y0 + h * 0.62, { tam: 17, cor: '#fffdf6', borda: 5 });
      ctx.restore();
    }
    // controles
    for (const k of this.controles) {
      if (!dentro(k.x - 60, k.y - 110, k.x + 60, k.y)) continue;
      const cor = this.corCanal[k.canal] || '#e2433a';
      if (k.tipo === 'botao') {
        const afunda = k.ativo ? 7 : 0, trem = k.tremida > 0 ? Math.sin(t * 60) * 1.5 : 0;
        if (comObjetos() && Objetos.botao(ctx, k, k.ativo ? '#3fb56a' : cor, k.ativo, trem)) continue;
        Estilo.forma(ctx, (c) => U.retRed(c, k.x - 18, k.y - 7, 36, 7, 2), { cor: '#8e8a96' }, { elev: 1.5, linha: 2.5 });
        Estilo.forma(ctx, (c) => U.retRed(c, k.x - 13 + trem, k.y - 18 + afunda, 26, 12, 5), { cor: k.ativo ? '#3fb56a' : cor }, { elev: 1.5, linha: 2.5 });
        Estilo.texto(ctx, 'kg', k.x + trem, k.y - 12 + afunda, { tam: 11, cor: '#fffdf6', borda: 3 });
      } else if (k.tipo === 'placa') {
        const afunda = k.ativo ? 4 : 0;
        Estilo.forma(ctx, (c) => U.retRed(c, k.x - 22, k.y - 5, 44, 5, 2), { cor: '#8e8a96' }, { elev: 1, linha: 2.2 });
        Estilo.forma(ctx, (c) => U.retRed(c, k.x - 18, k.y - 10 + afunda, 36, 6, 3), { cor }, { elev: 1, linha: 2.2 });
      } else {
        // alavanca alta (28/09): a manopla fica na altura das mãos dos heróis (os desenhos deles puxam de cima para
        // baixo, na altura do peito); ligada, inclina para quem puxou
        if (comObjetos() && Objetos.alavanca(ctx, k, cor, k.ang ?? (k.ligada ? 0.32 : 0))) continue;
        ctx.save();
        ctx.translate(k.x, k.y - 8);
        ctx.rotate(k.ang ?? (k.ligada ? 0.32 : 0));
        Estilo.forma(ctx, (c) => U.retRed(c, -4.5, -84, 9, 84, 3), { cor: '#f2c230' }, { elev: 1.5, linha: 2.2 });
        Estilo.forma(ctx, (c) => U.circulo(c, 0, -88, 10), { cor }, { elev: 1.5, linha: 2.2 });
        ctx.restore();
        Estilo.forma(ctx, (c) => U.retRed(c, k.x - 18, k.y - 14, 36, 14, 4), { cor: '#8e8a96' }, { elev: 1.5, linha: 2.5 });
      }
    }
    // portões (régua da cor do canal que sobe) e portas trancadas (afundam no chão)
    for (const g of this.portoes) {
      const x0 = g.c * TILE, y0 = g.l0 * TILE, h = (g.l1 - g.l0) * TILE;
      // apoiado num chão, fica em pé na pista (PROF.pista acima da linha da frente, com a faixa passando por trás)
      const pe = this.parede(g.c, g.l1) ? PROF.pista : 0;
      if (g.livro) { // livro-portão: aberto, continua lá, empurrado para dentro da estante (na sombra dela)
        if (dentro(x0, y0, x0 + TILE, y0 + h) && !(comObjetos() && Objetos.livroPortao(ctx, g, this.corCanal[g.canal]))) Nivel.desenhaLivroPortao(ctx, g, this.corCanal[g.canal], pe);
        continue;
      }
      if (g.abertura > 0.985 || !dentro(x0, y0, x0 + TILE, y0 + h)) continue;
      const sobe = U.ease.inOut(g.abertura) * h, cor = this.corCanal[g.canal] || '#e9c77a';
      const x = x0 + 8, y = y0 - sobe - pe, w = TILE - 16;
      ctx.save();
      ctx.beginPath(); ctx.rect(x - 10, y0 - h - 10 - pe, w + 20, h * 2 + 10); ctx.clip();
      ctx.beginPath(); ctx.rect(x - 10, -1e4, w + 20, y0 + h - pe + 1e4); ctx.clip();
      if (!(comObjetos() && Objetos.portao(ctx, x, y, h, cor))) {
        Estilo.forma(ctx, (cc) => U.retRed(cc, x, y, w, h, 3), { cor: U.mistura('#e9c77a', cor, 0.45) }, { elev: 2, linha: 3 });
        ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1.5;
        for (let i = 1; i < h / 10; i++) {
          const yy = y + i * 10, lg = i % 5 === 0 ? 11 : 6;
          ctx.beginPath(); ctx.moveTo(x + w - lg, yy); ctx.lineTo(x + w - 2, yy); ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (const p of this.portas) {
      const x0 = p.c * TILE, y0 = p.l0 * TILE, w = (p.c1 - p.c) * TILE, h = (p.l1 - p.l0) * TILE;
      if (p.abertura > 0.985 || !dentro(x0, y0, x0 + w, y0 + h)) continue;
      const desce = U.ease.inOut(p.abertura) * h, cor = CORES_CHAVE[p.cor];
      const pe = this.parede(p.c, p.l1) ? PROF.pista : 0; // em pé na pista; abrindo, afunda no tampo
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 - 6, y0 - 6 - pe, w + 12, h + 6); ctx.clip();
      const y = y0 + desce - pe;
      if (comObjetos() && Objetos.porta(ctx, x0, y, w, h, cor)) { ctx.restore(); continue; }
      Estilo.forma(ctx, (c) => U.retRed(c, x0 + 3, y, w - 6, h, 6), { cor: '#8c5a3a' }, { elev: 2, linha: 3 });
      Estilo.forma(ctx, (c) => U.retRed(c, x0 + 8, y + 6, w - 16, h - 12, 4), { cor }, { elev: 1, linha: 2.5, cel: false });
      Estilo.forma(ctx, (c) => { c.beginPath(); c.arc(x0 + w / 2, y + h / 2 - 6, 6, 0, U.TAU); c.moveTo(x0 + w / 2 - 3, y + h / 2); c.lineTo(x0 + w / 2 + 3, y + h / 2); c.lineTo(x0 + w / 2 + 5, y + h / 2 + 14); c.lineTo(x0 + w / 2 - 5, y + h / 2 + 14); c.closePath(); },
        { cor: '#2b1f2e' }, { elev: 0, linha: 0, cel: false });
      ctx.restore();
    }
    // chaves (paradas balançando ou na mão de alguém) e rolos de barbante
    for (const k of this.chaves) {
      if (k.usada || !dentro(k.x - 30, k.y - 30, k.x + 30, k.y + 30)) continue;
      Nivel.desenhaChave(ctx, k.x, k.y + (k.portador ? 0 : Math.sin(t * 3 + k.x) * 4), CORES_CHAVE[k.cor], k.portador ? 0.75 : 1, t);
    }
    for (const r of this.rolos) {
      if (r.pego || !dentro(r.x - 30, r.y - 50, r.x + 30, r.y)) continue;
      const ry = r.y - 22 + Math.sin(t * 3 + r.x) * 3;
      if (!(comObjetos() && Objetos.rolo(ctx, r.x, ry))) rolo(ctx, r.x, ry, 13, 11, 0.2);
    }
    for (const g of this.gangorras) {
      if (dentro(g.x - 200, g.chao - 140, g.x + 200, g.chao) && !(comObjetos() && Objetos.gangorra(ctx, g))) Nivel.desenhaGangorra(ctx, g);
    }
    for (const k of this.carimbos) {
      if (dentro(k.x - 70, k.teto, k.x + 70, k.chao) && !(comObjetos() && Objetos.carimbo(ctx, k))) Nivel.desenhaCarimbo(ctx, k);
    }
    for (const p of this.postits) {
      if (p.estado === 'fora' || !dentro(p.x - 60, p.y - 100, p.x + 60, p.y + 400)) continue;
      // treme preso pela cola (o canto de cima), solta, gira e cai sumindo; pisca de volta
      let ang = 0, dy = 0, al = 1;
      if (p.estado === 'treme') ang = Math.sin(t * 60) * 0.035 * Math.min(1, p.t / POSTIT.treme + 0.3);
      else if (p.estado === 'cai') { const q = p.t; ang = q * 0.9; dy = q * q * 520; al = 1 - q / POSTIT.cai; }
      else if (p.estado === 'volta') al = Math.floor(p.t * 10) % 2 ? 0.25 : 0.9;
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      if (!(comObjetos() && Objetos.postit(ctx, p, ang, dy))) Nivel.desenhaPostit(ctx, p, ang, dy);
      ctx.restore();
    }
    for (const r of this.durex) {
      if (dentro(r.x - 50, r.y - 80, r.x + 50, r.y) && !(comObjetos() && Objetos.durex && Objetos.durex(ctx, r))) Nivel.desenhaDurex(ctx, r);
    }
    for (const r of this.trenas) if (dentro(r.x - r.L - 60, r.topo - 20, r.x + r.L + 60, r.chao + 40) && !(comObjetos() && Objetos.trena(ctx, r))) Nivel.desenhaTrena(ctx, r);
    // (o estojo de zíper vai depois dos inimigos: desenhaEstojos — a estocada do lápis bate na face dele, não atravessa)
    // papelão rachado e folha de papel
    const c0 = Math.max(0, Math.floor(v.x0 / TILE) - 1), c1 = Math.min(this.cols - 1, Math.ceil(v.x1 / TILE) + 1);
    for (let l = 0; l < this.lins; l++) for (let c = c0; c <= c1; c++) {
      const tp = this.grade[l][c], x = c * TILE, y = l * TILE;
      const ia = comObjetos();
      if (tp === 'C' && ia) { // um painel por coluna de "C" (desenhado no bloco de cima dela)
        if (l > 0 && this.grade[l - 1][c] === 'C') continue;
        let n = 1;
        while (l + n < this.lins && this.grade[l + n][c] === 'C') n++;
        Objetos.fraca(ctx, x, y, n * TILE, c % 2 === 1);
      } else if (tp === 'F' && ia) { // uma tira por fileira de "F" (desenhada no primeiro bloco dela que aparece)
        if (c > c0 && this.grade[l][c - 1] === 'F') continue;
        let a = c, b = c;
        while (a > 0 && this.grade[l][a - 1] === 'F') a--;
        while (b + 1 < this.cols && this.grade[l][b + 1] === 'F') b++;
        Objetos.folha(ctx, a * TILE, y, b - a + 1);
      } else if (tp === 'C') {
        Estilo.forma(ctx, (q) => U.retRed(q, x + 1, y + 1, TILE - 2, TILE - 2, 3), { cor: '#c48b52' }, { elev: 2, linha: 2.5 });
        Estilo.traco(ctx, (q) => { q.beginPath(); q.moveTo(x + 8, y + 4); q.lineTo(x + 18, y + 16); q.lineTo(x + 12, y + 24); q.lineTo(x + 26, y + 36); q.moveTo(x + 18, y + 16); q.lineTo(x + 32, y + 12); }, '#6e4a2a', 2, { elev: 0 });
      } else if (tp === 'F') {
        const fh = FAIXA_CHAO.h; // (a folha cobre também a altura da faixa do chão)
        Estilo.forma(ctx, (q) => { q.beginPath(); q.rect(x, y - fh, TILE, 16 + fh); }, { cor: '#fbf7ec' }, { elev: 1.5, linha: 2.5, cel: false });
        ctx.save();
        ctx.strokeStyle = 'rgba(80,140,210,0.7)'; ctx.lineWidth = 1.5;
        for (const yy of [y - 4, y + 3, y + 10]) { ctx.beginPath(); ctx.moveTo(x + 2, yy); ctx.lineTo(x + TILE - 2, yy); ctx.stroke(); }
        ctx.restore();
      }
    }
    // pedaços voando
    for (const d of this.detritos) {
      ctx.save();
      ctx.globalAlpha = U.clamp(d.vida * 2, 0, 1);
      ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      Estilo.forma(ctx, (q) => { q.beginPath(); q.rect(-d.tam / 2, -d.tam / 3, d.tam, d.tam * 0.66); }, { cor: d.cor }, { elev: 1, linha: 2, cel: false });
      ctx.restore();
    }
  }

  // Post-it (desenho por código): o quadrado amarelo com a dobra da frente, girando em volta do canto de cima
  static desenhaPostit(ctx, p, ang, dy) {
    const w = POSTIT.w, x0 = p.x - w / 2, y0 = p.y - POSTIT.dobra;
    ctx.save(); ctx.translate(x0 + 8, y0 + 8 + dy); ctx.rotate(ang);
    Estilo.forma(ctx, (c) => U.retRed(c, -8, -8, w, 78, 4), { cor: '#ffe066' }, { elev: 1, linha: 2.5 });
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(-10, 70); c.lineTo(w - 6, 70); c.lineTo(w - 12, 92); c.lineTo(-4, 92); c.closePath(); }, { cor: '#fff1a8' }, { elev: 0.5, linha: 2.5 });
    ctx.restore();
  }

  // Estante (desenho por código, reserva do desenho da IA): moldura de madeira, a tábua em cima da pista e o fundo escuro
  static desenhaEstante(ctx, e) {
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0);
    for (const [x, y, w, h] of [[e.x0 - 4, e.y0 - 10, e.x1 - e.x0 + 8, 20], [e.x0, e.cheio - 12, e.x1 - e.x0, 14], [e.x0, e.y0, 14, e.y1 - e.y0], [e.x1 - 14, e.y0, 14, e.y1 - e.y0]]) {
      Estilo.forma(ctx, (c) => U.retRed(c, x, y, w, h, 3), { cor: '#b0703c' }, { elev: 1, linha: 2.5, cel: false });
    }
  }
  // Ponto de controle (desenho por código): bandeirinha num palito fincado na pista, balançando; ainda não pego: branca
  // com um "?"; pego: verde, com um visto
  static desenhaPonto(ctx, p, t) {
    const y0 = p.y - PROF.pista, alto = 96, x = p.x - 14, onda = Math.sin(t * 4 + p.x * 0.01) * 4;
    Estilo.forma(ctx, (c) => U.retRed(c, x - 3, y0 - alto, 6, alto + 2, 3), { cor: '#d9b07a' }, { elev: 1, linha: 2.2 });
    Estilo.forma(ctx, (c) => U.circulo(c, x, y0 - alto - 3, 6), { cor: '#f2c230' }, { elev: 1, linha: 2.2 });
    const cor = p.pego ? '#3fb56a' : '#fbf7ec';
    Estilo.forma(ctx, (c) => {
      c.beginPath(); c.moveTo(x + 3, y0 - alto + 2);
      c.quadraticCurveTo(x + 24, y0 - alto + 6 + onda, x + 46, y0 - alto + 16 + onda);
      c.quadraticCurveTo(x + 24, y0 - alto + 24 - onda, x + 3, y0 - alto + 32); c.closePath();
    }, { cor }, { elev: 1.5, linha: 2.5 });
    ctx.save();
    ctx.strokeStyle = p.pego ? '#fbf7ec' : '#2b1f2e'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (p.pego) { ctx.moveTo(x + 12, y0 - alto + 17); ctx.lineTo(x + 18, y0 - alto + 23); ctx.lineTo(x + 28, y0 - alto + 11); }
    else { ctx.font = `bold 18px ${FONTE_TITULO}`; ctx.fillStyle = '#2b1f2e'; ctx.textAlign = 'center'; ctx.fillText('?', x + 19, y0 - alto + 24 + onda * 0.3); }
    ctx.stroke();
    ctx.restore();
  }
  // Livro deitado (desenho por código): a lombada de frente (o bloco) e a capa por cima, vista do alto
  static desenhaLivroDeitado(g, x0, x1, y, cor) {
    const C = [['#d0463c', '#e8665a'], ['#3b6fc4', '#5b8fe0'], ['#3f9a5a', '#5cb877'], ['#8a55c2', '#a879dc']][cor % 4];
    Estilo.forma(g, (c) => U.retRed(c, x0, y - TILE - 18, x1 - x0, 22, 5), { cor: C[1] }, { elev: 0.5, linha: 2.5, cel: false });
    Estilo.forma(g, (c) => U.retRed(c, x0, y - TILE, x1 - x0, TILE, 5), { cor: C[0] }, { elev: 1, linha: 2.5 });
  }
  // Livro-portão (desenho por código): o livro em pé no vão de baixo da estante (cabe nele: até embaixo da tábua, que
  // vai até cheio + 2); aberto, vai para o fundo e escurece
  static desenhaLivroPortao(ctx, g, cor, pe) {
    const k = U.ease.inOut(g.abertura), yb = g.l1 * TILE - pe * k, h = g.l1 * TILE - pe - (g.l0 * TILE + 2) - 4;
    Estilo.forma(ctx, (c) => U.retRed(c, g.c * TILE + 1, yb - h, TILE - 2, h, 4), { cor: U.mistura(cor || '#f1bf3a', '#3a2616', 0.34 * k) }, { elev: 1.5, linha: 3 });
  }

  // Carimbo (desenho por código): a haste do teto até o corpo de madeira, a borracha vermelha embaixo e a marca no chão
  static desenhaCarimbo(ctx, k) {
    const b = k.caixa(), W = CARIMBO.w;
    if (k.marcou) Estilo.forma(ctx, (c) => U.retRed(c, k.x - W / 2 + 6, k.chao - 10, W - 12, 12, 4), { cor: '#e0533d' }, { elev: 0, linha: 0, cel: false });
    Estilo.forma(ctx, (c) => U.retRed(c, k.x - 11, k.teto - 2, 22, b.y0 - k.teto + 6, 3), { cor: '#f0c77a' }, { elev: 0.5, linha: 2.5 });
    Estilo.forma(ctx, (c) => U.retRed(c, b.x0, b.y0, W, CARIMBO.h - 14, 7), { cor: '#b87a3e' }, { elev: 1.5, linha: 3 });
    Estilo.forma(ctx, (c) => U.retRed(c, b.x0 + 2, b.y1 - 16, W - 4, 14, 4), { cor: '#e0443a' }, { elev: 0.5, linha: 3 });
  }

  // Régua-gangorra (desenho por código): o calço de madeira e a régua com as marcas, girando na ponta do calço
  static desenhaGangorra(ctx, g) {
    const G = GANGORRA, L = G.L, e = G.espessura * 0.7;
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(g.x - 30, g.chao); c.lineTo(g.x + 30, g.chao); c.lineTo(g.x + 5, g.py); c.lineTo(g.x - 5, g.py); c.closePath(); },
      { cor: '#b98a55' }, { elev: 1, linha: 3 });
    ctx.save(); ctx.translate(g.x, g.py); ctx.rotate(g.ang);
    Estilo.forma(ctx, (c) => U.retRed(c, -L / 2, -e, L, e, 4), { cor: '#7fcf8a' }, { elev: 1.5, linha: 3 });
    ctx.strokeStyle = 'rgba(40,70,45,0.7)'; ctx.lineWidth = 1.5;
    for (let x = -L / 2 + 12; x < L / 2 - 6; x += 16) { ctx.beginPath(); ctx.moveTo(x, -e); ctx.lineTo(x, -e + ((x + L / 2) % 64 < 16 ? e * 0.6 : e * 0.3)); ctx.stroke(); }
    ctx.restore();
  }

  // Trena (desenho por código): a fita amarela do vão até onde ela vai, a caixa com o botão
  static desenhaTrena(ctx, r) {
    const b = r.boca, x1 = b + r.lado * r.L;
    if (r.L > 2) Estilo.forma(ctx, (q) => q.rect(Math.min(b, x1), r.chao - 6, Math.abs(x1 - b), 14), { cor: '#f2c230' }, { elev: 0.5, linha: 2.5, cel: false });
    Estilo.forma(ctx, (q) => U.retRed(q, r.x - TRENA.w / 2, r.topo + 8, TRENA.w, TRENA.h - 8, 18), { cor: '#d8463c' }, { elev: 1.5, linha: 3 });
    Estilo.forma(ctx, (q) => U.retRed(q, r.x - 12, r.topo, 24, 12, 4), { cor: '#3a3a44' }, { elev: 0.5, linha: 2, cel: false });
  }
  // Estojo de zíper (desenho por código): caixa de pano com o zíper em cima
  static desenhaEstojo(ctx, e) {
    const c = e.caixa();
    Estilo.forma(ctx, (q) => U.retRed(q, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, 22), { cor: '#4f7fc4' }, { elev: 1.5, linha: 3 });
    Estilo.traco(ctx, (q) => { q.beginPath(); q.moveTo(c.x0 + 18, c.y0 + 14); q.lineTo(c.x1 - 18, c.y0 + 14); }, '#d8dde4', 4, { elev: 0 });
    Estilo.forma(ctx, (q) => U.retRed(q, c.x1 - 34, c.y0 + 8, 14, 22, 4), { cor: '#d8dde4' }, { elev: 0.5, linha: 2, cel: false });
  }
  // Rolo de durex (desenho por código): anel de fita com o miolo de papelão e a ponta solta, girando
  static desenhaDurex(ctx, r) {
    const R = DUREX.r;
    ctx.save();
    ctx.translate(r.x, r.y - R); ctx.rotate(r.giro);
    Estilo.forma(ctx, (c) => { c.beginPath(); c.arc(0, 0, R, 0, U.TAU); c.moveTo(15, 0); c.arc(0, 0, 15, 0, U.TAU, true); }, { cor: '#ecdcaa' }, { elev: 1.5, linha: 3 });
    Estilo.forma(ctx, (c) => { c.beginPath(); c.arc(0, 0, 15, 0, U.TAU); c.moveTo(10, 0); c.arc(0, 0, 10, 0, U.TAU, true); }, { cor: '#b98a55' }, { elev: 0, linha: 2, cel: false });
    ctx.strokeStyle = 'rgba(150,120,70,0.35)'; ctx.lineWidth = 1.2;
    for (const rr of [21, 27]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, U.TAU); ctx.stroke(); }
    Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(R - 3, -7); c.lineTo(R + 8, 1); c.lineTo(R + 4, 9); c.lineTo(R - 3, 5); c.closePath(); }, { cor: '#f3e7c0' }, { elev: 0.5, linha: 2, cel: false });
    ctx.restore();
  }

  // Poça no chão (y = linha do chão, w = largura): cola amarelada com bolhas; corretivo branco com brilho azulado
  static desenhaPoca(g, t, x, y, w) {
    const cola = t === 'k', h = cola ? 9 : 7;
    Estilo.forma(g, (q) => {
      q.beginPath();
      q.moveTo(x + 3, y + 1);
      for (let xx = x + 3; xx <= x + w - 3; xx += 6) q.lineTo(xx, y - h + Math.sin(xx * 0.19) * 2);
      q.lineTo(x + w - 3, y + 1);
      q.closePath();
    }, { cor: cola ? '#f0dc8c' : '#fcfcf7', luz: true }, { elev: 0.6, linha: 2.2, cel: false });
    g.save();
    g.fillStyle = cola ? 'rgba(255,253,235,0.95)' : 'rgba(170,195,220,0.9)';
    for (let xx = x + 9; xx < x + w - 6; xx += 17) {
      const r = cola ? 1.6 + U.hash(xx) * 1.6 : 1.3, dy = 3 + U.hash(xx + 7) * 3;
      g.beginPath();
      if (cola) g.arc(xx + U.hash(xx * 3) * 6, y - dy, r, 0, U.TAU); else g.ellipse(xx + 4, y - 4, 5, 1.1, 0, 0, U.TAU);
      g.fill();
    }
    g.restore();
  }

  static desenhaChave(ctx, x, y, cor, esc = 1, t = 0) {
    if (comObjetos() && Objetos.chave(ctx, x, y, cor, esc, t)) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(esc, esc);
    ctx.rotate(Math.sin(t * 2 + x) * 0.15);
    Estilo.forma(ctx, (c) => {
      c.beginPath();
      c.arc(-10, 0, 9, 0, U.TAU);
      c.moveTo(-1, -3); c.lineTo(18, -3); c.lineTo(18, 9); c.lineTo(13, 9); c.lineTo(13, 3); c.lineTo(9, 3); c.lineTo(9, 7);
      c.lineTo(5, 7); c.lineTo(5, 3); c.lineTo(-1, 3); c.closePath();
    }, { cor }, { elev: 1.5, linha: 2.5 });
    Estilo.forma(ctx, (c) => U.circulo(c, -10, 0, 3.5), { cor: '#fffdf6' }, { elev: 0, linha: 2, cel: false });
    ctx.restore();
  }
}
