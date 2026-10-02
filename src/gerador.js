'use strict';

// Gerador de fases (o "traçado"). Da fase 4 em diante cada fase é um prédio de papelão com andares e salas, no
// estilo Metroidvania: o caminho sobe, desce, vai para a esquerda e para a direita.
//   1) planta: uma árvore ligando salas vizinhas (sorteia várias e fica com a melhor);
//   2) caminho do começo até a saída; nas passagens dele entram travas (porta com chave, portão, parede rachada,
//      mureta, fosso, placa, alçapão, poço da corda) e, nas salas, inimigos;
//   3) a chave, a alavanca ou o botão de cada porta/portão fica num "galho" fora do caminho — às vezes noutro
//      andar, às vezes onde só um deles passa (fresta e janela alta: só o Fiapo; túnel baixo: o Fiapo não passa);
//   4) o robô joga esse plano do começo ao fim. A fase só vale se ele vencer.
// Qualquer outra solução que o jogador inventar também vale.
const X = (c) => c * TILE + TILE / 2;
const CW = 16;      // colunas por sala (a última é a parede com a sala do lado)
const FUNDO = 4;    // linhas de chão embaixo do térreo (onde cabe o fosso de lápis)

// Distância horizontal que o Fiapo voa no gancho (ou no soco reto) até pousar dy px abaixo (dy negativo = mais alto)
function alcanceFiapo(dy, reto = false) {
  const { vx, vy } = (reto ? ARREMESSO_RETO : ARREMESSO).fiapo;
  return vx * (-vy + Math.sqrt(vy * vy + 2 * GRAV * dy)) / GRAV;
}
const TETO_BAIXO = 6; // fosso de teto baixo: linhas livres acima do chão (o Fiapo no soco reto passa; no gancho, bate)

const DICAS = {
  inicio: 'Fase de andares: o caminho sobe, desce e volta. M mostra o mapa inteiro.',
  saida: 'Chegou! Leve os três até a SAÍDA.',
  escada: 'Escada: ↑ sobe; em cima dela, ↓ desce.',
  fresta: 'Fresta: só o Fiapo (o magrinho) cabe nessa escada.',
  janela: 'Janela alta: só o Fiapo pula tão alto.',
  tunel: 'Túnel baixo: o Fiapo é alto demais. O Marreta e o Pudim passam.',
  duto: 'Duto baixinho: só o Pudim passa — virando bola (E andando).',
  porta: (cor) => `Porta ${cor} trancada: a chave está em outra sala (M mostra o mapa).`,
  chave: (cor) => `Chave ${cor}! Quem passar por cima pega. Leve até a porta ${cor}.`,
  portaoL: 'Portão fechado: a alavanca da mesma cor está em outra sala (M mostra o mapa).',
  portaoB: 'Portão fechado: o botão pesado da mesma cor está em outra sala. Só o Pudim afunda botão.',
  alavanca: 'Alavanca: E liga e desliga o portão da mesma cor.',
  botao: 'Botão pesado (kg): só o Pudim afunda. Abre o portão da mesma cor.',
  rachada: 'Parede fraca: o soco do Marreta (E) quebra.',
  mureta: 'Mureta: o Marreta e o Fiapo pulam. O Pudim não — o gancho do Marreta (↓+E) joga ele por cima.',
  muretaCola: 'Cola antes da mureta: de dentro dela ninguém pula. Salte antes da poça; o Pudim, só o Marreta arremessa.',
  fosso: 'Fosso: o Fiapo amarra a corda na tachinha e o Marreta arremessa ele (E) para o outro lado.',
  fossoTeto: 'Fosso de teto baixo: o gancho (↓+E) bate no teto. O soco reto (E) manda o Fiapo rente, por baixo.',
  placa: 'Placa: o portão só abre enquanto alguém pisa. Do outro lado tem alavanca da mesma cor.',
  placaDurex: 'Placa no buraco: empurre o rolo de durex para dentro — ele segura o portão e vira ponte.',
  corda: 'Buraco no teto: o Fiapo sobe pela fresta, amarra na tachinha e larga a corda (E) para os outros.',
  alcapao: 'Alçapão de papel: o Pudim pula e dá a bundada (E no ar) — rasga, e todo mundo desce.',
  buraco: 'Buraco no chão: dá para descer, mas não para voltar por ele.',
  rolo: 'Rolo de barbante: o Fiapo pega e ganha mais uma corda.',
  recolhe: 'Depois que os três subirem, o Fiapo recolhe a corda (E na tachinha) e leva para a frente.',
  reusa: 'Sem barbante? A corda do poço lá atrás dá pra recolher (E na tachinha) e trazer.',
  guarda: 'Guarda: a estocada do lápis vai longe. Marreta: deixe ele estocar e soque na volta. Na barriga do Pudim a ponta quebra.',
  escudeiro: 'Escudeiro: a régua segura o soco reto e empurra. O gancho (↓+E) derruba — ou o Pudim caindo de cima.',
  borracha: 'Borracha: pule por cima na hora certa. É de borracha: a bola do Pudim volta — só a bundada (pule e E no ar) amassa.',
  grampeador: 'Grampeador: o Pudim vai na frente — o grampo bate na barriga e volta nele.',
  lixeira: 'Lixeira: a bolinha de papel vem em arco. Marreta: soque de volta (caindo do alto, ↓+E) — CESTA!',
  tesoureiro: 'Tesoureiro: corre sem frear. Espere na frente da parede e pule (o Fiapo pula alto): a tesoura crava e ele fica preso. A barriga do Pudim também segura.',
};
const NOMES = {
  porta: 'A Porta Trancada', portao: 'O Portão', corda: 'O Poço da Corda', fosso: 'O Fosso', alcapao: 'O Alçapão',
  fresta: 'A Fresta', janela: 'A Janela Alta', duto: 'O Duto', tunel: 'O Túnel', mureta: 'A Mureta', placa: 'A Placa',
  rachada: 'A Parede Fraca', grampeador: 'O Grampeador', escudeiro: 'O Escudeiro', borracha: 'A Borracha',
  guarda: 'O Guarda', cola: 'A Poça de Cola', durex: 'O Rolo de Durex', lixeira: 'A Lixeira', tesoureiro: 'O Tesoureiro',
};
// Nomes engraçados de lugar (a papelaria é grande)
const LUGARES = ['na Gaveta', 'no Estojo', 'na Estante', 'no Fichário', 'na Mochila', 'no Porta-Lápis', 'na Caixa de Clipes', 'no Caderno'];
const LUTA = { guarda: ['marreta', 'soca'], escudeiro: ['marreta', 'soca'], borracha: ['pudim', 'bundada'], grampeador: ['pudim', 'rebate'], lixeira: ['marreta', 'cesta'], tesoureiro: ['marreta', 'soca'] };
const GRUPO = ['fiapo', 'marreta', 'pudim'];

// Uma tentativa de fase: planta, travas, mapa e o roteiro do robô
class Obra {
  constructor(n, rng) {
    this.n = n; this.rng = rng;
    this.canais = []; this.inimigos = [];
  }
  sorteia(lista) { return lista[Math.floor(this.rng() * lista.length)]; }
  // [[valor, peso], ...] -> valor sorteado pelo peso
  pesado(op) {
    const ok = op.filter((o) => o[1] > 0), tot = ok.reduce((s, o) => s + o[1], 0);
    let x = this.rng() * tot;
    for (const o of ok) { x -= o[1]; if (x <= 0) return o[0]; }
    return ok[ok.length - 1][0];
  }
  falha(m) { Gerador.ultimoErro = m; return null; }

  monta() {
    const n = this.n, r = this.rng;
    const A = n < 6 ? 2 : n < 10 ? (r() < 0.5 ? 2 : 3) : n < 15 ? 3 : (r() < 0.5 ? 3 : 4);
    const K = n < 6 ? 3 : n < 10 ? (r() < 0.5 ? 3 : 4) : n < 15 ? 4 : (r() < 0.5 ? 4 : 5);
    this.qTravas = n < 6 ? 1 : n < 10 ? 1 + (r() < 0.5 ? 1 : 0) : 2 + (r() < 0.4 ? 1 : 0);
    this.planta(A, K);
    this.escolheArvore();
    this.poeTravas();
    if (!this.travas.length) return this.falha('planta sem galho para a chave');
    this.tipaCaminho();
    for (const e of this.arestas) if (!e.tipo) e.tipo = e.v ? 'escada' : 'livre'; // galhos vazios
    for (const e of this.arestas) if (e.tipo === 'escada') for (const s of [e.s1, e.s2]) this.salas[s].dicas.push([2, DICAS.escada]);
    this.carva();
    if (!this.constroi() || !this.poeCoisas()) return this.falha(`não coube: ${this.motivo}`);
    this.roteiro();
    return this.def();
  }

  // ---------------------------------------------------------------- planta
  // Andar 0 é o térreo (mais alto: cabe o arremesso por cima do fosso). S[a] = linha do chão do andar a.
  planta(A, K) {
    const alt = [];
    for (let a = 0; a < A; a++) alt.push(a === 0 ? 10 : 8);
    const S = [];
    let acc = 0;
    for (let a = A - 1; a >= 0; a--) { acc += alt[a]; S[a] = acc; }
    Object.assign(this, { A, K, alt, S, cols: K * CW + 1, lins: S[0] + FUNDO + 1 });
    this.salas = [];
    for (let a = 0; a < A; a++) for (let k = 0; k < K; k++) {
      this.salas.push({ id: a * K + k, a, k, c0: 1 + k * CW, c1: (k + 1) * CW - 1, chao: S[a], teto: a + 1 < A ? S[a + 1] : 0,
        viz: [], ocupa: new Set(), perigo: new Set(), ar: new Set(), dicas: [], inimigo: null, degrau: false });
    }
  }

  // Árvore sorteada ligando salas vizinhas (s1 = da esquerda / de baixo)
  arvore() {
    const { A, K } = this;
    const pai = this.salas.map((s) => s.id);
    const acha = (x) => (pai[x] === x ? x : (pai[x] = acha(pai[x])));
    const cand = [];
    for (let a = 0; a < A; a++) for (let k = 0; k < K; k++) {
      if (k < K - 1) cand.push({ v: false, s1: a * K + k, s2: a * K + k + 1, p: this.rng() });
      if (a < A - 1) cand.push({ v: true, s1: a * K + k, s2: (a + 1) * K + k, p: 0.3 + this.rng() });
    }
    cand.sort((p, q) => p.p - q.p);
    const arv = [];
    for (const e of cand) if (acha(e.s1) !== acha(e.s2)) { pai[acha(e.s1)] = acha(e.s2); arv.push(e); }
    return arv;
  }

  // Começo, saída (a sala mais longe), caminho entre os dois e os galhos pendurados nele
  avalia(arv) {
    const N = this.salas.length, viz = Array.from({ length: N }, () => []);
    arv.forEach((e, i) => { viz[e.s1].push([i, e.s2]); viz[e.s2].push([i, e.s1]); });
    const bfs = (ini, bloq) => {
      const dist = new Array(N).fill(-1), pai = new Array(N).fill(null), fila = [ini];
      dist[ini] = 0;
      while (fila.length) {
        const u = fila.shift();
        for (const [ei, w] of viz[u]) if (dist[w] < 0 && !(bloq && bloq.has(w))) { dist[w] = dist[u] + 1; pai[w] = [u, ei]; fila.push(w); }
      }
      return { dist, pai };
    };
    const a0 = this.A > 1 && this.rng() < 0.25 ? this.A - 1 : 0;
    const ini = a0 * this.K + Math.floor(this.rng() * this.K);
    const { dist, pai } = bfs(ini);
    const maxd = Math.max(...dist), folga = this.rng() < 0.3 ? 1 : 0;
    const fim = this.sorteia(dist.map((d, i) => [d, i]).filter(([d]) => d >= maxd - folga && d > 0).map(([, i]) => i));
    const cam = [fim], camA = [];
    for (let u = fim; u !== ini; u = pai[u][0]) { camA.unshift(pai[u][1]); cam.unshift(pai[u][0]); }
    const naCam = new Set(cam);
    const galhos = [];
    cam.forEach((s, j) => {
      for (const [ei, w] of viz[s]) {
        if (naCam.has(w)) continue;
        const b = bfs(w, naCam);
        const salas = [];
        b.dist.forEach((d, i) => { if (d >= 0) salas.push(i); });
        galhos.push({ j, ei, raiz: w, salas, dist: b.dist, pai: b.pai });
      }
    });
    const verticais = camA.filter((i) => arv[i].v).length;
    return { ini, fim, cam, camA, galhos, verticais };
  }

  escolheArvore() {
    let melhor = null;
    for (let t = 0; t < 12; t++) {
      const arv = this.arvore(), c = this.avalia(arv);
      const nota = c.cam.length + 1.6 * c.verticais + 2.5 * Math.min(c.galhos.length, this.qTravas + 1) + this.rng() * 2;
      if (!melhor || nota > melhor.nota) melhor = Object.assign(c, { arv, nota });
    }
    this.arestas = melhor.arv.map((e, i) => ({ id: i, v: e.v, s1: e.s1, s2: e.s2, tipo: null }));
    for (const e of this.arestas) { this.salas[e.s1].viz.push({ e, s: e.s2 }); this.salas[e.s2].viz.push({ e, s: e.s1 }); }
    Object.assign(this, { ini: melhor.ini, fim: melhor.fim, cam: melhor.cam, galhos: melhor.galhos });
    this.camA = melhor.camA.map((i) => this.arestas[i]);
  }

  // ---------------------------------------------------------------- travas
  // Porta/portão numa passagem de lado do caminho; o item fica na sala mais funda de um galho que sai antes dela
  poeTravas() {
    this.travas = [];
    const cores = ['x', 'y', 'z'], livres = this.galhos.slice();
    for (let t = 0; t < this.qTravas; t++) {
      const op = [];
      this.camA.forEach((e, i) => {
        if (e.v || e.tipo) return;
        for (const g of livres) if (g.j <= i) op.push([{ e, i, g }, 1 / (1 + 0.7 * (i - g.j))]);
      });
      if (!op.length) break;
      const { e, i, g } = this.pesado(op);
      livres.splice(livres.indexOf(g), 1);
      const r = this.rng();
      const item = r < 0.42 && cores.length ? 'chave' : r < 0.74 ? 'alavanca' : 'botao';
      if (item === 'chave') { e.tipo = 'porta'; e.cor = cores.shift(); }
      else { e.tipo = 'portao'; e.canal = `k${e.id}`; e.letra = item === 'botao' ? 'G' : 'L'; }
      const maxd = Math.max(...g.salas.map((s) => g.dist[s]));
      const sala = this.sorteia(g.salas.filter((s) => g.dist[s] === maxd));
      const rota = [];
      for (let u = sala; u !== g.raiz; u = g.pai[u][0]) rota.unshift(this.arestas[g.pai[u][1]]);
      rota.unshift(this.arestas[g.ei]);
      const quem = this.tipaRota(rota, item);
      e.item = { tipo: item, sala, quem, i, galho: g };
      this.travas.push(e);
      this.salas[this.cam[i]].dicas.push([9, item === 'chave' ? DICAS.porta(NOME_COR[e.cor]) : item === 'botao' ? DICAS.portaoB : DICAS.portaoL]);
      this.salas[sala].dicas.push([8, item === 'chave' ? DICAS.chave(NOME_COR[e.cor]) : DICAS[item]]);
    }
  }

  // Passagens do galho até o item: o jeito delas decide quem pode ir buscar
  tipaRota(rota, item) {
    const quem = item === 'botao' ? 'pudim' : this.pesado([['fiapo', 1.3], ['marreta', 1], ['pudim', 0.7]]);
    rota.forEach((e, k) => {
      if (e.v) e.tipo = quem === 'fiapo' && (k === 0 || this.rng() < 0.5) ? 'fresta' : 'escada';
      else if (quem === 'fiapo') e.tipo = this.sorteia(k === 0 ? ['janela', 'janela', 'mureta'] : ['livre', 'janela', 'mureta']);
      else if (quem === 'marreta') e.tipo = this.sorteia(k === 0 ? ['rachada', 'tunel'] : ['livre', 'tunel', 'rachada', 'mureta']);
      else e.tipo = k === 0 ? 'duto' : this.sorteia(['livre', 'tunel', 'duto']);
      // mureta baixa com cola na frente (o lado da cola é sorteado: quem vai e volta passa pelos dois)
      if (e.tipo === 'mureta' && this.n >= 5 && this.rng() < 0.4) { e.cola = true; e.d = this.rng() < 0.5 ? 1 : -1; }
      if (['fresta', 'janela', 'tunel', 'duto', 'rachada', 'mureta'].includes(e.tipo)) for (const s of [e.s1, e.s2]) this.salas[s].dicas.push([7, DICAS[e.cola ? 'muretaCola' : e.tipo]]);
    });
    return quem;
  }

  // Passagens do caminho que não são porta/portão
  tipaCaminho() {
    let fossos = 0, ant = null;
    const usos = {};
    this.camA.forEach((e, i) => {
      const de = this.salas[this.cam[i]], para = this.salas[this.cam[i + 1]];
      if (!e.v) e.d = para.k > de.k ? 1 : -1;
      if (e.tipo) { ant = e.tipo; return; }
      // alguém ainda vai ter que voltar por aqui para buscar um item? então nada de mão única (nem mureta, se for o Pudim)
      const pend = this.travas.filter((t) => t.item.i > i && t.item.galho.j <= i);
      const volta = pend.length > 0, pudimVolta = pend.some((t) => t.item.quem === 'pudim');
      let op;
      if (!e.v) {
        op = [['livre', 1.4], ['rachada', 1.8], ['mureta', pudimVolta ? 0 : 1.8]];
        if (de.a === 0 && fossos < (this.n >= 10 ? 2 : 1)) op.push(['fosso', 2.6]);
        if (this.n >= 6) op.push(['placa', 1.4]);
      } else if (para.a > de.a) {
        op = [['escada', 2], ['corda', this.n >= 5 && this.pontaLivre(para) ? 2.6 : 0]];
      } else {
        op = [['escada', 1.4], ['alcapao', volta ? 0 : 2.4], ['buraco', !volta && this.pontaLivre(de) ? 1 : 0]];
      }
      // o mesmo desafio repetido perde a graça: cada uso anterior derruba o peso
      for (const o of op) if (o[0] !== 'livre' && o[0] !== 'escada') o[1] *= Math.pow(0.15, usos[o[0]] || 0);
      const semRepetir = op.filter((o) => o[0] !== ant && o[1] > 0);
      e.tipo = this.pesado(semRepetir.length ? semRepetir : op);
      usos[e.tipo] = (usos[e.tipo] || 0) + 1;
      if (e.tipo === 'fosso') fossos++;
      if (e.tipo === 'fosso' && this.n >= 7 && this.rng() < 0.5) e.teto = true; // só o soco reto do Marreta cruza
      if (e.tipo === 'mureta' && this.n >= 5 && this.rng() < 0.5) e.cola = true; // mureta baixa com cola na frente
      if (e.tipo === 'placa') e.canal = `kp${e.id}`;
      if (e.tipo === 'placa' && de.a === 0 && this.rng() < 0.7) e.durex = true; // no térreo (tem chão fundo para o buraco)
      ant = e.tipo;
      if (e.tipo !== 'livre' && e.tipo !== 'escada') de.dicas.push([6, DICAS[e.teto ? 'fossoTeto' : e.cola ? 'muretaCola' : e.durex ? 'placaDurex' : e.tipo]]);
    });
  }

  // Lado da sala sem passagem para a vizinha ('esq'/'dir'): lá cabe um buraco no chão sem atrapalhar ninguém
  pontaLivre(s) {
    const tem = { esq: false, dir: false };
    for (const v of s.viz) if (!v.e.v) tem[this.salas[v.s].k < s.k ? 'esq' : 'dir'] = true;
    const op = ['esq', 'dir'].filter((l) => !tem[l]);
    return op.length ? this.sorteia(op) : null;
  }

  // ---------------------------------------------------------------- mapa
  carva() {
    this.g = Array.from({ length: this.lins }, () => new Array(this.cols).fill('#'));
    for (const s of this.salas) for (let l = s.teto + 1; l < s.chao; l++) for (let c = s.c0; c <= s.c1; c++) this.g[l][c] = '.';
  }
  livre(s, c0, c1) {
    for (let c = c0; c <= c1; c++) if (c < s.c0 || c > s.c1 || s.ocupa.has(c)) return false;
    return true;
  }
  reserva(s, c0, c1, perigo = false) {
    for (let c = c0; c <= c1; c++) if (c >= s.c0 && c <= s.c1) { s.ocupa.add(c); if (perigo) s.perigo.add(c); }
  }
  // Coluna c com [c - margem, c + larg - 1 + margem] livre no chão da sala (a mais longe de x, se pedir)
  achaChao(s, larg, margem = 1, longeDe = null) {
    const op = [];
    for (let c = s.c0; c + larg - 1 <= s.c1; c++) if (this.livre(s, Math.max(s.c0, c - margem), Math.min(s.c1, c + larg - 1 + margem))) op.push(c);
    if (!op.length) return null;
    if (longeDe == null) return this.sorteia(op);
    op.sort((p, q) => Math.abs(X(q) - longeDe) - Math.abs(X(p) - longeDe));
    return op[Math.floor(this.rng() * Math.min(3, op.length))];
  }
  // Coluna para passagem vertical: livre nas duas salas (a de baixo e a de cima)
  achaVertical(Lo, Up, larg, margem) {
    const op = [];
    for (let c = Lo.c0 + margem; c + larg - 1 + margem <= Lo.c1; c++) {
      if (this.livre(Lo, c - margem, c + larg - 1 + margem) && this.livre(Up, c - margem, c + larg - 1 + margem)) op.push(c);
    }
    return op.length ? this.sorteia(op) : null;
  }

  constroi() {
    const prio = { fosso: 0, placa: 1, mureta: 2, janela: 2, corda: 3, buraco: 3, alcapao: 4, escada: 5, fresta: 5 };
    const ordem = this.arestas.slice().sort((p, q) => (prio[p.tipo] ?? 2.5) - (prio[q.tipo] ?? 2.5));
    for (const e of ordem) {
      // passagens de pulo, arremesso, corda e escada precisam do alto livre (ar): nada pendurado em cima delas
      const salas = [this.salas[e.s1], this.salas[e.s2]], ar = e.v || ['mureta', 'janela', 'fosso'].includes(e.tipo);
      const antes = salas.map((s) => new Set(s.ocupa));
      if (!this.constroiAresta(e)) { this.motivo = e.tipo; return false; }
      if (ar) salas.forEach((s, k) => { for (const c of s.ocupa) if (!antes[k].has(c)) s.ar.add(c); });
    }
    return true;
  }

  constroiAresta(e) {
    const g = this.g, A = this.salas[e.s1], B = this.salas[e.s2];
    if (!e.v) {
      const L = A, R = B, b = L.c1 + 1, S = L.chao, topo = L.teto + 1;
      e.b = b;
      const abre = (l0, l1, t) => { for (let l = l0; l <= l1; l++) g[l][b] = t; };
      const lados = (nl, nr) => {
        if (!this.livre(L, L.c1 - nl + 1, L.c1) || !this.livre(R, R.c0, R.c0 + nr - 1)) return false;
        this.reserva(L, L.c1 - nl + 1, L.c1); this.reserva(R, R.c0, R.c0 + nr - 1);
        return true;
      };
      const canal = (c, l) => this.canais.push({ c, l, canal: e.canal });
      switch (e.tipo) {
        case 'livre': abre(topo, S - 1, '.'); return lados(1, 1);
        case 'porta': abre(S - 4, S - 1, e.cor.toUpperCase()); return lados(2, 2);
        case 'portao': abre(S - 4, S - 1, e.letra); for (let l = S - 4; l < S; l++) canal(b, l); return lados(2, 2);
        case 'rachada': abre(S - 4, S - 1, 'C'); return lados(2, 2);
        case 'tunel': abre(S - 3, S - 1, '.'); return lados(2, 2);
        case 'duto': abre(S - 2, S - 1, '.'); return lados(3, 3); // 2 blocos: só a bola do Pudim passa
        case 'janela': abre(S - 7, S - 4, '.'); return lados(3, 3);
        case 'mureta': {
          if (!e.cola) { abre(topo, S - 3, '.'); return lados(5, 5); }
          // mureta de 1 bloco com 2 blocos de cola na frente (do lado de onde vem quem anda no sentido e.d): de dentro
          // da cola ninguém pula; Marreta e Fiapo saltam antes dela; o Pudim, arremessado
          abre(topo, S - 2, '.');
          if (!lados(5, 5)) return false;
          for (const c of [b - e.d, b - 2 * e.d]) { g[S - 1][c] = 'k'; (c < b ? L : R).perigo.add(c); } // ninguém espera na cola
          return true;
        }
        case 'placa': {
          if (e.durex) {
            // placa no fundo de um buraco raso (2 blocos, 1 de fundo) antes do portão e o rolo de durex 8 blocos antes: empurrado
            // para dentro, segura o portão e vira ponte baixa. Sem alavanca: quem segurar a placa com o corpo fica para trás
            const d = e.d, pit = [b - 4 * d, b - 3 * d].sort((p, q) => p - q), cr = b - 8 * d;
            if (!(d > 0 ? lados(10, 2) : lados(2, 10))) return false;
            abre(S - 4, S - 1, 'L');
            for (let l = S - 4; l < S; l++) canal(b, l);
            for (const c of pit) g[S][c] = '.';
            e.cp = b - 4 * d; g[S][e.cp] = 'p'; canal(e.cp, S);
            g[S - 1][cr] = 'd';
            Object.assign(e, { pit0: pit[0], cr });
            for (const c of [...pit, cr - 1, cr, cr + 1]) (d > 0 ? L : R).perigo.add(c); // ninguém espera no buraco nem no rolo
            return true;
          }
          if (!lados(4, 4)) return false;
          abre(S - 4, S - 1, 'L');
          for (let l = S - 4; l < S; l++) canal(b, l);
          e.cp = b - 3 * e.d; e.cl = b + 2 * e.d;
          g[S - 1][e.cp] = 'p'; g[S - 1][e.cl] = 'l';
          canal(e.cp, S - 1); canal(e.cl, S - 1);
          return true;
        }
        case 'fosso': {
          const w = 6 + Math.floor(this.rng() * 3), p0 = b - Math.floor(w / 2), p1 = p0 + w - 1, d = e.d;
          const n0 = d > 0 ? p0 - 6 : p0 - 3, n1 = d > 0 ? p1 + 3 : p1 + 6;
          if (!this.livre(L, n0, L.c1) || !this.livre(R, R.c0, n1)) return false;
          for (let c = p0; c <= p1; c++) { for (let l = topo; l <= S + 2; l++) g[l][c] = '.'; g[S + 3][c] = '^'; }
          const pa = d > 0 ? p0 - 1 : p1 + 1, pb = d > 0 ? p1 + 2 : p0 - 2;
          g[S - 1][pa] = 'T'; g[S - 1][pb] = 'T';
          // teto baixo em cima do fosso e de onde se arremessa: o gancho (alto) bate e cai nos lápis
          if (e.teto) for (let c = n0; c <= n1; c++) for (let l = topo; l < S - TETO_BAIXO; l++) g[l][c] = '#';
          const alc = alcanceFiapo(0, !!e.teto);
          const xF = d > 0 ? U.clamp((p1 + 1) * TILE + 70 - alc, (p0 - 5) * TILE, p0 * TILE - 18)
            : U.clamp(p0 * TILE - 70 + alc, (p1 + 1) * TILE + 18, (p1 + 6) * TILE);
          Object.assign(e, { p0, p1, pa, pb, xF });
          this.reserva(L, n0, L.c1); this.reserva(R, R.c0, n1);
          for (const s of [L, R]) for (let c = p0; c <= p1; c++) if (c >= s.c0 && c <= s.c1) s.perigo.add(c);
          return true;
        }
      }
      return false;
    }
    const Lo = A, Up = B, r = Up.chao; // a laje entre as duas salas
    const furo = (c0, c1, t) => { for (let c = c0; c <= c1; c++) g[r][c] = t; };
    const escada = (c0, c1) => { for (let c = c0; c <= c1; c++) for (let l = r; l < Lo.chao; l++) g[l][c] = 'H'; };
    const ambas = (c0, c1, perigoUp = false) => { this.reserva(Lo, c0, c1); this.reserva(Up, c0, c1, perigoUp); };
    switch (e.tipo) {
      case 'escada': {
        const h = this.achaVertical(Lo, Up, 2, 1);
        if (h == null) return false;
        escada(h, h + 1); e.x = (h + 1) * TILE; ambas(h - 1, h + 2);
        return true;
      }
      case 'fresta': {
        const h = this.achaVertical(Lo, Up, 1, 1);
        if (h == null) return false;
        escada(h, h); e.x = X(h); ambas(h - 1, h + 1);
        return true;
      }
      case 'alcapao': {
        const h = this.achaVertical(Lo, Up, 3, 1);
        if (h == null) return false;
        furo(h, h + 2, 'F'); e.xMeio = X(h + 1); ambas(h - 1, h + 3);
        return true;
      }
      case 'buraco': {
        const lado = this.pontaLivre(Up);
        if (!lado) return false;
        const h = lado === 'dir' ? Up.c1 - 2 : Up.c0;
        if (!this.livre(Up, h, h + 2) || !this.livre(Lo, h, h + 2)) return false;
        furo(h, h + 2, '.'); e.xMeio = X(h + 1); ambas(h, h + 2, true);
        return true;
      }
      case 'corda': {
        // buraco na ponta livre da sala de cima, tachinha do lado e uma fresta (só o Fiapo) para ele subir primeiro
        const lado = this.pontaLivre(Up);
        if (!lado) return false;
        const h0 = lado === 'dir' ? Up.c1 - 1 : Up.c0, h1 = h0 + 1, pin = lado === 'dir' ? h0 - 1 : h1 + 1;
        const u0 = Math.min(pin, h0), u1 = Math.max(pin, h1);
        if (!this.livre(Up, u0, u1) || !this.livre(Lo, h0, h1)) return false;
        const fs = [];
        for (let f = Lo.c0 + 1; f < Lo.c1; f++) {
          if ((lado === 'dir' ? f > pin - 3 : f < pin + 3)) continue;
          if (this.livre(Lo, f - 1, f + 1) && this.livre(Up, f - 1, f + 1)) fs.push(f);
        }
        if (!fs.length) return false;
        const f = this.sorteia(fs);
        furo(h0, h1, '.'); g[r - 1][pin] = 'T'; escada(f, f);
        // onde a corda pendura e onde quem sobe sai lá em cima (mesma conta do CordaJogo._beira)
        if (lado === 'dir') Object.assign(e, { xLinha: h0 * TILE + 12, xTopo: h0 * TILE - 24, fora: -76 });
        else Object.assign(e, { xLinha: (h1 + 1) * TILE - 12, xTopo: (h1 + 1) * TILE + 24, fora: 76 });
        Object.assign(e, { pin, xf: X(f), xMeio: (h0 + 1) * TILE });
        this.reserva(Up, u0, u1); for (let c = h0; c <= h1; c++) Up.perigo.add(c);
        this.reserva(Lo, h0, h1); ambas(f - 1, f + 1);
        return true;
      }
    }
    return false;
  }

  // Onde o grupo chega na sala cam[i] (i ≥ 1)
  xEntrada(i) {
    const e = this.camA[i - 1], de = this.salas[this.cam[i - 1]], para = this.salas[this.cam[i]];
    if (!e.v) { const d = para.k > de.k ? 1 : -1; return e.tipo === 'fosso' ? X((d > 0 ? e.p1 : e.p0) + 3 * d) : X(e.b + 2 * d); }
    if (para.a > de.a) return e.tipo === 'corda' ? e.xTopo : e.x;
    return e.tipo === 'escada' ? e.x : e.xMeio;
  }

  poeCoisas() {
    const g = this.g;
    // começo: os três lado a lado
    const si = this.salas[this.ini], c = this.achaChao(si, 5, 0);
    if (c == null) { this.motivo = 'começo'; return false; }
    g[si.chao - 1][c] = '3'; g[si.chao - 1][c + 2] = '1'; g[si.chao - 1][c + 4] = '2';
    this.pos0 = { pudim: X(c), marreta: X(c + 2), fiapo: X(c + 4) };
    this.reserva(si, c - 1, c + 5);
    si.dicas.push([3, DICAS.inicio]);
    // saída, longe de onde o grupo chega
    const sf = this.salas[this.fim], cs = this.achaChao(sf, 2, 1, this.xEntrada(this.cam.length - 1));
    if (cs == null) { this.motivo = 'saída'; return false; }
    for (let l = sf.chao - 3; l < sf.chao; l++) { g[l][cs] = 'S'; g[l][cs + 1] = 'S'; }
    this.xSaida = cs * TILE;
    this.reserva(sf, cs - 1, cs + 2);
    sf.dicas.push([4, DICAS.saida]);
    // chave / alavanca / botão de cada trava
    for (const e of this.travas) {
      const it = e.item, s = this.salas[it.sala], ci = this.achaChao(s, 1, 1);
      if (ci == null) { this.motivo = 'item'; return false; }
      g[s.chao - 1][ci] = it.tipo === 'chave' ? e.cor : it.tipo === 'alavanca' ? 'l' : 'B';
      if (it.tipo !== 'chave') this.canais.push({ c: ci, l: s.chao - 1, canal: e.canal });
      it.x = X(ci);
      this.reserva(s, ci - 1, ci + 1);
    }
    // Cordas na conta certa, sem sobrar: o Fiapo começa com 1. A do fosso fica (é a ponte); a do poço ele recolhe
    // depois que os três subiram e leva para a próxima (menos se alguém que não é o Fiapo ainda tiver que voltar
    // subindo por ali). Rolo de barbante só onde a corda faltar.
    const usosCorda = [];
    this.camA.forEach((e, i) => { if (e.tipo === 'fosso' || e.tipo === 'corda') usosCorda.push(i); });
    let estoque = 1, recolheu = false;
    for (const [u, i] of usosCorda.entries()) {
      const e = this.camA[i], antes = this.salas[this.cam[i]];
      if (estoque === 0) {
        const cr = this.achaChao(antes, 1, 1);
        if (cr == null) { this.motivo = 'rolo'; return false; }
        g[antes.chao - 1][cr] = 'r';
        e.rolo = { sala: antes.id, x: X(cr) };
        this.reserva(antes, cr - 1, cr + 1);
        antes.dicas.push([5, DICAS.rolo]);
        estoque++;
      } else if (recolheu) antes.dicas.push([5, DICAS.reusa]);
      estoque--;
      recolheu = false;
      const volta = this.travas.some((t) => t.item.i > i && t.item.galho.j <= i && t.item.quem !== 'fiapo');
      if (e.tipo === 'corda' && u < usosCorda.length - 1 && !volta) {
        e.recolhe = true; estoque++; recolheu = true;
        this.salas[this.cam[i + 1]].dicas.push([5, DICAS.recolhe]);
      }
    }
    this.poeInimigos();
    return true;
  }

  poeInimigos() {
    const n = this.n;
    const especies = ['guarda'].concat(n >= 5 ? ['borracha'] : [], n >= 6 ? ['escudeiro'] : [], n >= 7 ? ['grampeador'] : [],
      n >= 8 ? ['lixeira'] : [], n >= 9 ? ['tesoureiro'] : []);
    let qtd = n < 5 ? 1 : n < 8 ? 1 + (this.rng() < 0.5 ? 1 : 0) : n < 12 ? 2 : 3;
    const idx = [];
    for (let i = 1; i < this.cam.length - 1; i++) idx.push(i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (const i of idx) {
      if (qtd <= 0) break;
      const s = this.salas[this.cam[i]], e = this.camA[i - 1];
      const deLado = !e.v && e.tipo !== 'fosso' && e.tipo !== 'mureta';
      const esp = this.sorteia(especies.filter((q) => q !== 'grampeador' || deLado));
      const pos = esp === 'grampeador' ? this.poeGrampeador(s, i) : esp === 'lixeira' ? this.poeLixeira(s, i) : this.poePatrulha(s, esp, this.chegada(i));
      if (pos) qtd--;
    }
  }

  // Trecho da sala cam[i] por onde o grupo passa ao chegar (e onde espera): inimigo nenhum pode ficar aí.
  // No poço da corda o Fiapo chega antes, sozinho, pela fresta — e anda até a tachinha.
  chegada(i) {
    const [x0, x1] = this.chegadaX(i);
    return [Math.floor(x0 / TILE), Math.floor(x1 / TILE)];
  }
  chegadaX(i) {
    const e = this.camA[i - 1], T = this.salas[this.cam[i]];
    const base = this.xEntrada(i), dir = Math.sign(X((T.c0 + T.c1) / 2) - base) || 1;
    const xs = [base, base + dir * 160];
    if (e.tipo === 'corda') xs.push(e.xf, X(e.pin), X(e.pin) + e.fora);
    if (e.tipo === 'alcapao' || e.tipo === 'buraco') xs.push(e.xMeio + dir * 210);
    if (e.tipo === 'fosso') xs.push(X(e.pb));
    if (e.tipo === 'mureta') xs.push(X(e.b + 7 * dir)); // o Pudim arremessado cai longe
    return [Math.min(...xs), Math.max(...xs)];
  }

  // Inimigo que anda de um lado para o outro num trecho livre, longe de onde o grupo chega
  poePatrulha(s, esp, [ca, cb]) {
    // chão firme por onde ele pode andar (pode passar no pé de escada, na chave, na alavanca; não em placa nem buraco)
    const g = this.g, S = s.chao;
    const pisa = (c) => g[S][c] === '#' && '.HxyzlBrT'.includes(g[S - 1][c]);
    const runs = [];
    for (let c = s.c0; c <= s.c1;) {
      if (!pisa(c)) { c++; continue; }
      const a = c;
      while (c <= s.c1 && pisa(c)) c++;
      runs.push([a, c - 1]);
    }
    let melhor = null;
    // o lápis do guarda alcança 2,5 blocos e o tesoureiro vê 6: ninguém espera ao alcance deles
    const folga = esp === 'guarda' ? 5 : esp === 'tesoureiro' ? 7 : 3;
    for (const [a, b] of runs) {
      for (let [z0, z1] of [[Math.max(a, cb + folga), b], [a, Math.min(b, ca - folga)]]) {
        if (z1 - z0 < (esp === 'borracha' ? 5 : esp === 'tesoureiro' ? 1 : 4)) continue; // o tesoureiro fica parado
        const direita = z0 > cb;
        if (z1 - z0 > 8) { if (direita) z0 = z1 - 8; else z1 = z0 + 8; }
        const dist = direita ? z0 - cb : ca - z1;
        if (!melhor || dist > melhor.dist) melhor = { z0, z1, dist };
      }
    }
    if (!melhor) return false;
    const { z0, z1 } = melhor, xm = (z0 + z1 + 1) * TILE / 2;
    this.inimigos.push({ especie: esp, x: xm, y: s.chao * TILE, f: z0 > cb ? -1 : 1, alcance: esp === 'tesoureiro' ? 0 : (z1 - z0 + 1) * TILE / 2 - 32 });
    this.reserva(s, z0, z1, true);
    const cols = [], m = esp === 'guarda' ? 3 : 1;
    for (let c = z0 - m; c <= z1 + m; c++) { s.perigo.add(c); cols.push(c); } // ninguém espera colado nele (nem no lápis)
    s.inimigo = { especie: esp, x0: z0 * TILE, x1: (z1 + 1) * TILE, cols };
    s.dicas.push([7, DICAS[esp]]);
    return true;
  }

  // Grampeador no fundo da sala, olhando para a entrada; uma mureta de 1 bloco perto da entrada segura os grampos
  poeGrampeador(s, i) {
    const de = this.salas[this.cam[i - 1]], d = s.k > de.k ? 1 : -1;
    const cb = d > 0 ? s.c0 + 3 : s.c1 - 3, cg = d > 0 ? s.c1 - 1 : s.c0 + 1;
    if (!this.livre(s, cb, cb) || !this.livre(s, Math.min(cg, cg - d), Math.max(cg, cg - d))) return false;
    this.g[s.chao - 1][cb] = '#';
    this.inimigos.push({ especie: 'grampeador', x: X(cg), y: s.chao * TILE, f: -d, alcance: 0 });
    this.reserva(s, cb, cb); this.reserva(s, Math.min(cg, cg - d), Math.max(cg, cg - d));
    const cols = [];
    for (let c = Math.min(cb, cg); c <= Math.max(cb, cg); c++) { s.perigo.add(c); cols.push(c); }
    s.degrau = true;
    s.inimigo = { especie: 'grampeador', x0: s.c0 * TILE, x1: (s.c1 + 1) * TILE, cols };
    s.dicas.push([7, DICAS.grampeador]);
    return true;
  }

  // Lixeira numa prateleira de 2 blocos (160 px acima da cabeça de todo mundo: pode ficar em cima de porta, chave ou
  // alavanca, não de pulo, corda ou escada) no fundo da sala, longe de onde o grupo chega: ela só atira em quem está a
  // menos de LIXEIRA.ve. Chão firme da chegada até embaixo dela (o Marreta vai lá).
  poeLixeira(s, i) {
    const [xa, xb] = this.chegadaX(i), ca = Math.floor(xa / TILE), cb = Math.floor(xb / TILE), g = this.g, S = s.chao, L = S - 5;
    if (L - 2 <= s.teto) return false;
    const pisa = (c) => g[S][c] === '#' && '.HxyzlBrT'.includes(g[S - 1][c]);
    const vazio = (c) => {
      if (s.ar.has(c) || !'.xyzlBr'.includes(g[S - 1][c])) return false;
      for (let l = s.teto + 1; l < S - 1; l++) if (g[l][c] !== '.') return false;
      return true;
    };
    const op = [];
    for (let c = s.c0; c + 1 <= s.c1; c++) {
      const x = (c + 1) * TILE, d = x > xb ? 1 : x < xa ? -1 : 0;
      if (!d || (d > 0 ? x - xb : xa - x) < LIXEIRA.ve + 10) continue; // quem espera na chegada fica fora do alcance
      const m0 = Math.max(s.c0, c - 1), m1 = Math.min(s.c1, c + 2);
      let ok = true;
      for (let k = m0; ok && k <= m1; k++) ok = vazio(k);
      for (let k = d > 0 ? cb : c; ok && k <= (d > 0 ? c + 1 : ca); k++) ok = pisa(k);
      if (ok) op.push(c);
    }
    if (!op.length) return false;
    const c = this.sorteia(op), x = (c + 1) * TILE;
    g[L][c] = g[L][c + 1] = '#';
    this.inimigos.push({ especie: 'lixeira', x, y: L * TILE, f: x > xb ? -1 : 1, alcance: 0 });
    this.reserva(s, c - 1, c + 2);
    const cols = [];
    for (let k = Math.floor((x - LIXEIRA.ve) / TILE); k <= Math.floor((x + LIXEIRA.ve) / TILE); k++) { s.perigo.add(k); cols.push(k); }
    s.inimigo = { especie: 'lixeira', x0: s.c0 * TILE, x1: (s.c1 + 1) * TILE, cols };
    s.dicas.push([7, DICAS.lixeira]);
    return true;
  }

  // ---------------------------------------------------------------- roteiro do robô
  roteiro() {
    this.rot = []; this.ativo = null; this.aberta = new Set(); this.quedas = 0;
    const si = this.ini;
    this.pos = { pudim: { s: si, x: this.pos0.pudim }, marreta: { s: si, x: this.pos0.marreta }, fiapo: { s: si, x: this.pos0.fiapo } };
    this.camA.forEach((e, i) => {
      if (e.rolo) this.leva('fiapo', e.rolo.sala, e.rolo.x);
      if (e.item) this.busca(e, i);
      this.cruza(e, i);
      const s = this.salas[this.cam[i + 1]];
      if (s.inimigo) this.luta(s, this.cam[i + 1]);
      if (e.recolhe) { // todos subiram: o Fiapo recolhe a corda do poço e leva para a próxima
        this.leva('fiapo', this.cam[i + 1], X(e.pin));
        this.rot.push(['acao'], ['espera', 0.5]);
        this.aberta.delete(e.id);
      }
    });
    const sf = this.salas[this.fim];
    GRUPO.forEach((id, k) => this.leva(id, sf.id, this.xSaida + 24 + 16 * k));
    this.rot.push(['espera', 0.6]);
  }

  ativa(id) { if (this.ativo !== id) { this.rot.push(['ativa', id]); this.ativo = id; } }
  andaEm(s, x) { return [s.degrau ? 'vai' : 'anda', x]; }

  // Quem pode passar por essa passagem, a partir da sala "de", no estado atual
  pode(id, e, de) {
    const sobe = e.v && de === e.s1;
    switch (e.tipo) {
      case 'livre': case 'escada': return true;
      case 'fresta': case 'janela': return id === 'fiapo';
      case 'tunel': return id !== 'fiapo';
      case 'duto': return id === 'pudim';
      case 'mureta': return id !== 'pudim';
      case 'rachada': return this.aberta.has(e.id) || id === 'marreta';
      case 'porta': case 'portao': case 'placa': case 'fosso': return this.aberta.has(e.id);
      case 'corda': return !sobe || id === 'fiapo' || this.aberta.has(e.id);
      case 'alcapao': return !sobe && this.aberta.has(e.id);
      case 'buraco': return !sobe;
    }
    return false;
  }

  rota(id, de, para) {
    if (de === para) return [];
    const pai = new Map([[de, null]]), fila = [de];
    while (fila.length) {
      const u = fila.shift();
      for (const { e, s } of this.salas[u].viz) {
        if (pai.has(s) || !this.pode(id, e, u)) continue;
        pai.set(s, [u, e]);
        if (s === para) {
          const r = [];
          for (let w = para; w !== de; w = pai.get(w)[0]) r.unshift([pai.get(w)[1], pai.get(w)[0], w]);
          return r;
        }
        fila.push(s);
      }
    }
    return null;
  }

  // Leva um deles até a sala "para" (e anda até x lá dentro)
  leva(id, para, x) {
    const r = this.rota(id, this.pos[id].s, para);
    if (!r) throw new Error(`${id} não chega na sala ${para}`);
    this.ativa(id);
    for (const [e, de, pa] of r) this.passa(id, e, de, pa);
    if (x != null) { this.rot.push(this.andaEm(this.salas[para], x)); this.pos[id].x = x; }
  }

  // Um deles atravessa uma passagem (já aberta para ele)
  passa(id, e, de, para) {
    const S = this.salas[de], T = this.salas[para];
    if (!e.v) {
      const d = T.k > S.k ? 1 : -1;
      if (e.tipo === 'rachada' && !this.aberta.has(e.id)) { // o Marreta abre no caminho
        this.rot.push(this.andaEm(S, d > 0 ? e.b * TILE - 30 : (e.b + 1) * TILE + 30), ['olha', d], ['acao'], ['espera', 0.7]);
        this.aberta.add(e.id);
      }
      if (e.tipo === 'duto') { // o Pudim vira bola e passa rolando
        const x = X(e.b + 3 * d);
        this.rot.push(['rola', x]);
        this.pos[id] = { s: para, x };
        return;
      }
      const x = e.tipo === 'fosso' ? X((d > 0 ? e.p1 : e.p0) + 3 * d) : X(e.b + 2 * d);
      if (e.tipo === 'mureta' && e.cola && d === e.d) { // vem do lado da cola: salta antes da poça
        this.rot.push(['salta', d > 0 ? (e.b - 2) * TILE - 14 : (e.b + 3) * TILE + 14, x]);
        this.pos[id] = { s: para, x };
        return;
      }
      const pula = e.tipo === 'mureta' || e.tipo === 'janela' || (e.tipo === 'placa' && e.durex) || S.degrau || T.degrau;
      this.rot.push([pula ? 'vai' : 'anda', x]);
      this.pos[id] = { s: para, x };
      return;
    }
    const sobe = para === e.s2;
    if (e.tipo === 'escada' || e.tipo === 'fresta' || (e.tipo === 'corda' && id === 'fiapo')) {
      const x = e.tipo === 'corda' ? e.xf : e.x;
      this.rot.push(this.andaEm(S, x), [sobe ? 'sobe' : 'desce']);
      this.pos[id] = { s: para, x };
    } else if (sobe) { // sobe pela corda pendurada no poço
      this.rot.push(this.andaEm(S, e.xLinha), ['sobe']);
      this.pos[id] = { s: para, x: e.xTopo };
    } else { // cai pelo buraco (buraco, alçapão rasgado ou poço da corda) e sai de baixo dele
      const fora = this.xFora(T, e.xMeio);
      this.rot.push(this.andaEm(S, e.xMeio), ['esperaChao', id, 5], this.andaEm(T, fora));
      this.pos[id] = { s: para, x: fora };
    }
  }

  // x perto do pedido, fora de buraco e de inimigo
  xLivre(s, x) {
    const c = U.clamp(Math.floor(x / TILE), s.c0, s.c1);
    for (let k = 0; k <= s.c1 - s.c0; k++) {
      for (const cc of [c + k, c - k]) {
        if (cc < s.c0 || cc > s.c1 || s.perigo.has(cc)) continue;
        return k === 0 && x >= s.c0 * TILE + 20 && x <= (s.c1 + 1) * TILE - 20 ? x : X(cc);
      }
    }
    return X(c);
  }
  // Depois de cair por um buraco: sai de baixo dele (senão quem cair depois quica no Pudim)
  xFora(T, x) {
    this.quedas++;
    const dir = Math.sign(X((T.c0 + T.c1) / 2) - x) || 1;
    return this.xLivre(T, x + dir * (100 + 45 * (this.quedas % 3)));
  }

  // Alguém vai buscar a chave / puxar a alavanca / apertar o botão e volta para a porta
  busca(e, i) {
    const it = e.item, F = it.quem, de = this.cam[i], para = this.cam[i + 1];
    const d = this.salas[para].k > this.salas[de].k ? 1 : -1;
    this.leva(F, it.sala, it.x);
    if (it.tipo === 'alavanca') this.rot.push(['acao'], ['espera', 0.7]);
    else this.rot.push(['espera', it.tipo === 'botao' ? 0.6 : 0.2]);
    if (it.tipo !== 'chave') this.aberta.add(e.id);
    this.leva(F, de, X(e.b - 2 * d));
    if (it.tipo === 'chave') { // encosta na porta com a chave: abre
      this.aberta.add(e.id);
      const x = X(e.b + 2 * d);
      this.rot.push(['anda', x]);
      this.pos[F] = { s: para, x };
    }
  }

  // O grupo atravessa a passagem i do caminho (as que precisam de ajuda têm roteiro próprio)
  cruza(e, i) {
    const de = this.cam[i], para = this.cam[i + 1], T = this.salas[para];
    const d = e.v ? 0 : (T.k > this.salas[de].k ? 1 : -1);
    switch (e.tipo) {
      case 'rachada':
        this.leva('marreta', de, d > 0 ? e.b * TILE - 30 : (e.b + 1) * TILE + 30);
        this.rot.push(['olha', d], ['acao'], ['espera', 0.7]);
        this.aberta.add(e.id);
        break;
      case 'mureta': { // o Pudim não pula: o Marreta arremessa
        const xl = d > 0 ? e.b * TILE - 126 : (e.b + 1) * TILE + 126;
        this.leva('pudim', de, xl);
        this.leva('marreta', de, xl - d * 40);
        // gancho: alto. Na mureta baixa com cola qualquer golpe passa: vai o soco reto (a prova "soco reto não passa a
        // mureta" é só da alta)
        this.rot.push(['olha', d], [e.cola ? 'acao' : 'gancho'], ['espera', 0.6], ['esperaChao', 'pudim', 5]);
        this.ativa('pudim');
        const xp = X(e.b + d * 6);
        this.rot.push(['anda', xp]);
        this.pos.pudim = { s: para, x: xp };
        break;
      }
      case 'fosso': { // corda na tachinha, gancho no Fiapo, corda na tachinha do outro lado: ponte
        this.leva('fiapo', de, X(e.pa));
        this.rot.push(['acao'], ['espera', 0.4], ['anda', e.xF]);
        this.leva('marreta', de, e.xF - d * 40);
        this.rot.push(['olha', d], [e.teto ? 'acao' : 'gancho'], ['espera', 0.5], ['esperaChao', 'fiapo', 5]); // teto baixo: soco reto
        this.ativa('fiapo');
        this.rot.push(['anda', X(e.pb)], ['acao'], ['espera', 0.4]);
        this.pos.fiapo = { s: para, x: X(e.pb) };
        this.aberta.add(e.id);
        break;
      }
      case 'placa':
        if (e.durex) { // o Marreta empurra o rolo de durex para dentro do buraco da placa (encostado: 54 px do meio dele)
          const xm = (e.pit0 + 1) * TILE - d * (DUREX.w / 2 + CFG.marreta.w / 2);
          this.leva('marreta', de, X(e.cr - 2 * d));
          this.rot.push(['anda', xm], ['espera', 0.8]);
          this.pos.marreta.x = xm;
          this.aberta.add(e.id);
          break;
        }
        // o Pudim segura o portão na placa; o Fiapo passa e liga a alavanca do outro lado
        this.leva('pudim', de, X(e.cp));
        this.rot.push(['espera', 0.5]);
        this.aberta.add(e.id);
        this.leva('fiapo', para, X(e.cl));
        this.rot.push(['acao'], ['espera', 0.7]);
        break;
      case 'corda': { // o Fiapo sobe pela fresta, amarra na tachinha e larga a corda para os outros
        this.leva('fiapo', para, X(e.pin));
        const xs = X(e.pin) + e.fora;
        this.rot.push(['acao'], ['espera', 0.4], ['anda', xs], ['acao'], ['espera', 0.6]);
        this.pos.fiapo.x = xs;
        this.aberta.add(e.id);
        break;
      }
      case 'alcapao': { // pula, bundada (E no ar) rasga o papel e o Pudim cai primeiro
        this.leva('pudim', de, e.xMeio);
        this.rot.push(['pula'], ['espera', 0.12], ['acao'], ['espera', 1.2], ['esperaChao', 'pudim', 5]);
        const fora = this.xFora(T, e.xMeio);
        this.rot.push(this.andaEm(T, fora));
        this.pos.pudim = { s: para, x: fora };
        this.aberta.add(e.id);
        break;
      }
    }
    // o resto do grupo atravessa e espera perto da chegada
    const base = this.xEntrada(i + 1), dir = Math.sign(X((T.c0 + T.c1) / 2) - base) || 1;
    GRUPO.forEach((id, k) => { if (this.pos[id].s !== para) this.leva(id, para, this.xLivre(T, base + dir * (30 + 60 * k))); });
  }

  luta(s, si) {
    const [quem, op] = LUTA[s.inimigo.especie], faixa = [s.c0 * TILE, (s.c1 + 1) * TILE], meio = (s.inimigo.x0 + s.inimigo.x1) / 2;
    if (s.inimigo.especie === 'tesoureiro') { // o Pudim de escudo: a tesoura quica na barriga (preso) e o Marreta derruba
      if (this.pos.marreta.s !== si) this.leva('marreta', si);
      this.ativa('pudim');
      this.rot.push(['barriga', ...faixa]);
      this.pos.pudim.x = meio;
    }
    this.ativa(quem);
    this.rot.push([op, ...faixa], ['esperaChao', quem, 3], ['espera', 0.3]);
    this.pos[quem].x = meio;
    for (const c of s.inimigo.cols) s.perigo.delete(c);
    s.inimigo = null;
  }

  // ---------------------------------------------------------------- definição da fase
  def() {
    // nome: uma das travas mais marcantes da fase
    const tem = new Set([...this.arestas.map((e) => e.tipo), ...this.inimigos.map((o) => o.especie)]);
    if (this.arestas.some((e) => e.cola)) tem.add('cola');
    if (this.arestas.some((e) => e.durex)) tem.add('durex');
    const marcantes = Object.keys(NOMES).filter((k) => tem.has(k)).slice(0, 3);
    const nome = `${NOMES[marcantes.length ? this.sorteia(marcantes) : 'porta']} ${this.sorteia(LUGARES)}`;
    // papel de parede: salas ligadas por passagem aberta dividem o mesmo papel
    const pai = this.salas.map((s) => s.id);
    const acha = (x) => (pai[x] === x ? x : (pai[x] = acha(pai[x])));
    const junta = (e) => !e.v && ['livre', 'fosso', 'mureta'].includes(e.tipo);
    for (const e of this.arestas) if (junta(e)) pai[acha(e.s1)] = acha(e.s2);
    const tipos = Object.keys(PAPEIS), papelDe = new Map(), salas = [], trechos = [];
    for (const s of this.salas) {
      const raiz = acha(s.id);
      if (!papelDe.has(raiz)) papelDe.set(raiz, tipos[(papelDe.size * 5 + Math.floor(this.rng() * 3)) % tipos.length]);
      const aberta = s.viz.some((v) => this.salas[v.s].k > s.k && junta(v.e));
      const x0 = s.c0 * TILE, x1 = (s.c1 + 1 + (aberta ? 1 : 0)) * TILE, y0 = (s.teto + 1) * TILE, y1 = s.chao * TILE;
      salas.push({ x0, y0, x1, y1, papel: papelDe.get(raiz) });
      const dicas = s.dicas.sort((p, q) => q[0] - p[0]).map((q) => q[1]).filter((q, i, a) => a.indexOf(q) === i).slice(0, 2);
      trechos.push({ x0, x1: (s.c1 + 2) * TILE, y0: s.teto * TILE, y1: (s.chao + 1) * TILE, dicas, dica: dicas[0] || '' });
    }
    return {
      nome, mapa: this.g.map((l) => l.join('')), roteiro: this.rot, gerada: true, n: this.n,
      canais: this.canais, inimigos: this.inimigos, cordas: 1, trechos, salas, andares: this.A,
      passagens: this.arestas.map((e) => e.tipo), caminho: this.camA.map((e) => e.tipo),
      tmax: 90 + this.rot.length * 2.2,
    };
  }
}

const Gerador = {
  TENTATIVAS: 14,
  ultimoErro: '',

  // Fase n (n ≥ 4). Mesma semente + mesmo n = mesma fase.
  sala(n, semente) {
    for (let k = 0; k < this.TENTATIVAS; k++) {
      const rng = U.rng(Math.floor(U.hash(semente * 7919 + n * 104729 + k * 31337) * 4294967296));
      let def;
      try { def = new Obra(n, rng).monta(); } catch (e) { this.ultimoErro = `plano: ${e.message}`; continue; }
      if (!def) continue;
      const r = simula(def, def.roteiro, def.tmax);
      if (!r.venceu) {
        this.ultimoErro = `robô não passou (${def.nome}, comando ${r.comando} ${JSON.stringify(r.cmd)}): ${r.herois.join(' / ')} :: ${r.log.slice(-4).join(' | ')}`;
        continue;
      }
      def.tentativas = k + 1;
      def.tempoRobo = r.t;
      return def;
    }
    return null;
  },
};
