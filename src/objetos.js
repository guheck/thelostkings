'use strict';

// Objetos do cenário desenhados pela IA (folha assets/estudo/cenario/cenario-objetos-1.png, fatias e medidas feitas por
// tools/cenario_pecas.py em assets/cenario/) no lugar do desenho por código. É o padrão, junto com os personagens (?codigo desliga).
// Cada função desenha e devolve true; devolve false enquanto as imagens não chegaram (aí o desenho por código segue).
// Tamanhos em px do jogo, os mesmos do desenho por código: a física não muda. Os blocos de papelão ("#") e a parede fraca
// ("C") vêm de outra folha (assets/estudo/cenario/cenario-blocos-1.png): laje em 9 fatias e painel remendado.
// O vermelho da manopla, da cúpula do botão, do painel da porta e da chave vira a cor do canal / da chave (tinge).
const CORES_LAPIS = ['#f2c230', '#e0533d', '#3b7be0', '#3fb56a', '#9b6bd6']; // a ordem do nivel.js
const PECAS_FUNDO = ['sol', 'nuvem1', 'nuvem2', 'nuvem3', 'castelo', 'arvore1', 'arvore2', 'arvores', 'arbusto1', 'arbusto2', 'arbustos', 'tufo'];
// decoração das fases (folha assets/estudo/fases/mesa-decoracao-1.png, a Mesa): as 5 primeiras são de fundo (névoa)
const PECAS_DECORACAO = ['pote', 'caderno', 'livros', 'luminaria', 'caneca', 'borracha', 'apontador', 'postits', 'cola', 'giz', 'clipes', 'etiqueta'];
// obstáculos novos da Mesa (folha assets/estudo/mesa/obstaculos-1.png, recortada em assets/mesa/, já no tamanho do jogo)
const PECAS_MESA = ['gangorra-nivel', 'carimbo', 'carimbo-marca', 'postit-colado', 'estante-lateral', 'estante-tabua', 'estante-topo',
  'empe-amarelo', 'empe-azul', 'empe-verde', 'empe-laranja', 'deitado-vermelho', 'deitado-azul', 'deitado-verde', 'deitado-roxo',
  'lapis-frente', 'marcatexto-frente', 'estojo', 'trena', 'trena-fita', 'trena-ponta', 'mesa-tampo', 'mesa-perna'];
// Tampo da mesa (mesa-tampo, medido no estudo-mesa.js, KIT): as pontas não esticam; a linha de baixo da tira (o tampo
// visto de cima) na linha 30,5 da imagem; prof = a altura da tira, que fica na altura da faixa do chão
const TAMPO = { pontas: 14, tira: 30.5, prof: 27 };
// Pilar da frente: linhas da imagem que não esticam (medidas no estudo-mesa.js, KIT): topo = a ponta do lápis / a tampa.
// vira: de cabeça para baixo; crava: quantos px da ponta ficam enterrados embaixo da linha do chão (o grafite e um pouco);
// entra: quantos px de cima ficam escondidos dentro da laje (02/10, estudo pilar-estudo.png: desenhado por cima da cara
// da frente da laje, "não está natural", parecia colado na frente; entrando nela, com a sombra dela, segura)
const PILAR_PECA = { 'lapis-frente': { topo: 73, pe: 6, vira: true, crava: 22, entra: 14 }, 'marcatexto-frente': { topo: 90, pe: 6, entra: 24 } };
// a sombra que a laje faz no alto do pilar (px de altura e força)
const PILAR_SOMBRA = { alto: 28, forca: 0.6 };
// Livro deitado (assets/estudo/mesa/livros-1.png, o estudo aprovado da "Mesa com estante"): 5 fatias na horizontal,
// medidas no recorte — ponta esquerda, miolo que estica, a etiqueta (não estica), miolo, ponta direita. Lombada de 63 px
// (da linha escura embaixo da capa até o pé) e capa de 34 por cima.
const LIVRO_DEITADO = { lombada: 63, nomes: ['deitado-vermelho', 'deitado-azul', 'deitado-verde', 'deitado-roxo'],
  fatias: { 'deitado-vermelho': [35, 62, 160, 187], 'deitado-azul': [35, 73, 171, 210], 'deitado-verde': [35, 62, 161, 191], 'deitado-roxo': [35, 69, 166, 199] } };
// Estante (o kit de assets/estudo/mesa/estante-1.png, os cortes medidos no estudo-mesa.js): nas horizontais as pontas
// ficam e o meio estica, com a linha de baixo da tira (o tampo visto de cima) em y; nas verticais topo e pé ficam.
// Livro em pé (empe-*): topo (as páginas vistas de cima) 80 px da imagem, pé 45, o meio estica; a lombada tem 35 de
// topo. O que está no plano de trás leva a mesma sombra (SOMBRA_FUNDO); o livro-portão, puxado para a pista, não.
const KIT_ESTANTE = { 'estante-tabua': { pontas: 10, tira: 17 }, 'estante-topo': { pontas: 16, tira: 28 }, 'estante-lateral': { topo: 14, pe: 12 } };
const LIVRO_EMPE = { cima: 80, baixo: 45, topo: 35 };
const LIVROS_COR = { 'empe-amarelo': '#f1bf3a', 'empe-azul': '#3b6fc4', 'empe-verde': '#3f9a5a', 'empe-laranja': '#e07b2e' };
const SOMBRA_FUNDO = 'rgba(52, 34, 22, 0.34)';
// Régua-gangorra montada da pose nivelada (medidas no recorte, as mesmas do estudo-mesa.js): a régua é a faixa de
// cima (linhas 0-31, 235 px) e fica longa REPETINDO o trecho entre duas marcas longas (colunas 59 a 91), sem esticar
// (esticada ficava embaçada): ponta esquerda 0-59, 9 trechos, ponta direita 198-235 = 384 px. O calço é o resto (linhas
// 32-77, ponta no x 117, 46 px de altura).
const RECORTE_GANGORRA = { reguaH: 32, calcoY: 32, ponta: 117, esq: 59, passo: [59, 91], dir: 198, n: 9 };
const Objetos = {
  ativo: false,
  d: null, // medidas (assets/cenario/objetos.js)
  imgs: {},
  _falta: 0,
  _tintas: {},
  _feitos: {},

  init() {
    if (this.ativo || !U.arteIA()) return; // ?codigo: desenho antigo (comparar na cenario.html)
    this.ativo = true;
    // peças do fundo (folha assets/estudo/fundo/fundo-pecas-1.png, recortada por tools/recorta_fundo.py)
    for (const [pasta, nomes] of [['fundo', PECAS_FUNDO], ['decoracao', PECAS_DECORACAO], ['mesa', PECAS_MESA]]) {
      for (const n of nomes) {
        this._conta(1);
        const img = new Image();
        img.onload = () => { this.imgs[`${pasta}/${n}`] = img; this._marca(`${pasta}/${n}`); this._conta(-1); };
        img.onerror = () => { console.warn(`peça faltando: ${img.src}`); this._conta(-1); };
        img.src = `assets/${pasta}/${n}.png`;
      }
    }
    // os manifestos (chamam Objetos.dados / Objetos.tamanhos antes do onload): as medidas do cenário e o tamanho lógico
    // das peças da Mesa, recortadas na resolução nativa (tools/recorta_nativo.py)
    for (const src of ['assets/cenario/objetos.js', 'assets/mesa/tamanhos.js']) {
      this._conta(1);
      const s = document.createElement('script');
      s.src = src;
      s.onload = s.onerror = () => this._conta(-1);
      document.head.appendChild(s);
    }
  },
  // peças da Mesa em alta: o tamanho lógico (o das medidas) no lugar do da imagem (U.altaRes)
  tamanhos(t) { this.tam = t; for (const n in t) this._marca(`mesa/${n}`); },
  _marca(chave) {
    const img = this.imgs[chave], t = this.tam && chave.startsWith('mesa/') && this.tam[chave.slice(5)];
    if (img && t && !img._rx) U.altaRes(img, t[0], t[1]);
  },
  dados(d) {
    this.d = d;
    const nomes = ['saida', 'saida-acesa', 'saida-coroa', 'alavanca-cima', 'alavanca-deitada', 'alavanca-baixo', 'botao-cupula',
      'botao-base', 'portao-topo', 'portao-meio', 'portao-base', 'laje', 'laje-miolo', 'fraca', 'folha-esq', 'folha-meio',
      'folha-dir', 'tachinha', 'escada-trilho', 'cola-esq', 'cola-meio', 'cola-dir', 'cola-frasco', 'corretivo-esq',
      'corretivo-meio', 'corretivo-dir', 'corretivo-caneta', 'durex', 'bolinha', 'escada-degrau', 'rolo', 'porta-topo', 'porta-faixa', 'porta-base', 'porta-dobradica',
      'porta-fechadura', 'chave', ...d.lapis.map((q) => q.img)];
    for (const n of nomes) {
      this._conta(1);
      const img = new Image();
      img.onload = () => { this.imgs[n] = img; this._conta(-1); };
      img.onerror = () => { console.warn(`objeto faltando: ${img.src}`); this._conta(-1); };
      img.src = `assets/cenario/${n}.png`;
    }
  },
  _conta(k) {
    this._falta += k;
    if (this._falta > 0 || typeof Jogo === 'undefined') return;
    Jogo.cache = null; // o mapa inteiro (M) guarda o fixo numa imagem: refaz com os desenhos
    if (typeof Menu !== 'undefined') Menu.fundo = null; // o fundo do menu também (sol, castelo, árvores)
    if (Jogo.congelado) Jogo.pinta();
  },
  pronto() { return this.ativo && this._falta === 0 && !!this.d; },

  // Peça (pasta/nome) com altura alt (px do jogo): meio embaixo em (x, y), ou o centro em (x, y) com meio = true;
  // espelha = virada para o outro lado
  peca(ctx, chave, x, y, alt, meio = false, espelha = false) {
    const img = this.imgs[chave];
    if (!this.pronto() || !img) return false;
    const w = alt * img.width / img.height, y0 = meio ? y - alt / 2 : y - alt;
    if (!espelha) { ctx.drawImage(img, x - w / 2, y0, w, alt); return true; }
    ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, y0, w, alt); ctx.restore();
    return true;
  },
  fundo(ctx, nome, x, y, alt, meio = false) { return this.peca(ctx, `fundo/${nome}`, x, y, alt, meio); },
  // Post-it: um desenho só (a dobra da frente na linha 87 fica na linha do degrau), girando em volta do canto de cima
  postit(ctx, p, ang, dy) {
    const im = this.imgs['mesa/postit-colado'];
    if (!this.pronto() || !im) return false;
    const x0 = p.x - im.width / 2, y0 = p.y - POSTIT.dobra;
    ctx.save(); ctx.translate(x0 + 8, y0 + 8 + dy); ctx.rotate(ang); ctx.drawImage(im, -8, -8); ctx.restore();
    return true;
  },
  // Carimbo: a haste (o pescoço do desenho, linhas 47-65) esticada do teto até o corpo (linhas 66-135: madeira e a
  // borracha vermelha); a bola do cabo (linhas 0-46) não vai (ficaria em cima do teto). Carimbou, a marca no chão.
  carimbo(ctx, k) {
    const im = this.imgs['mesa/carimbo'], mc = this.imgs['mesa/carimbo-marca'];
    if (!this.pronto() || !im || !mc) return false;
    const b = k.caixa(), x0 = k.x - im.width / 2;
    if (k.marcou) ctx.drawImage(mc, k.x - mc.width / 2, k.chao + 6 - mc.height);
    ctx.drawImage(im, 0, 47, im.width, 19, x0, k.teto - 2, im.width, b.y0 - k.teto + 3);
    ctx.drawImage(im, 0, 66, im.width, 70, x0, b.y0, im.width, 70);
    return true;
  },
  // peça horizontal do kit da estante de x0 a x1, com a linha de baixo da tira em y
  _kitH(ctx, n, x0, x1, y) {
    const img = this.imgs[`mesa/${n}`], D = KIT_ESTANTE[n], w = img.width, h = img.height, p = D.pontas, yt = y - D.tira;
    ctx.drawImage(img, 0, 0, p, h, x0, yt, p + 0.5, h);
    ctx.drawImage(img, p, 0, w - 2 * p, h, x0 + p, yt, x1 - x0 - 2 * p + 0.5, h);
    ctx.drawImage(img, w - p, 0, p, h, x1 - p, yt, p, h);
  },
  // peça vertical do kit com largura lw, de y0 a y1 (x = o meio)
  _kitV(ctx, n, x, lw, y0, y1) {
    const img = this.imgs[`mesa/${n}`], D = KIT_ESTANTE[n], w = img.width, h = img.height, k = lw / w, t = D.topo * k, pb = D.pe * k;
    ctx.drawImage(img, 0, 0, w, D.topo, x - lw / 2, y0, lw, t + 0.5);
    ctx.drawImage(img, 0, D.topo, w, h - D.topo - D.pe, x - lw / 2, y0 + t, lw, y1 - y0 - t - pb + 0.5);
    ctx.drawImage(img, 0, h - D.pe, w, D.pe, x - lw / 2, y1 - pb, lw, pb);
  },
  // Livro deitado (bloco "b"): a lombada ocupa o bloco (de y - TILE a y), a capa aparece por cima (é o chão de quem pisa)
  livroDeitado(ctx, x0, x1, y, cor) {
    const nome = LIVRO_DEITADO.nomes[cor % 4], img = this.imgs[`mesa/${nome}`];
    if (!this.pronto() || !img) return false;
    const [a, b, c, d] = LIVRO_DEITADO.fatias[nome], k = TILE / LIVRO_DEITADO.lombada, W0 = img.width, H0 = img.height;
    const L = x1 - x0, h = H0 * k, pe = a * k, et = (c - b) * k, pd = (W0 - d) * k, sobra = L - pe - et - pd;
    if (sobra < 4) { ctx.drawImage(img, x0, y - h, L, h); return true; }
    let x = x0;
    for (const [s0, s1, dw] of [[0, a, pe], [a, b, sobra / 2], [b, c, et], [c, d, sobra / 2], [d, W0, pd]]) {
      ctx.drawImage(img, s0, 0, s1 - s0, H0, x, y - h, dw + 0.5, h);
      x += dw;
    }
    return true;
  },
  // livro em pé (lombada de w x h, as páginas vistas de cima aparecendo em cima), com o pé em yBase
  _livro(ctx, nome, x, yBase, w, h, img = this.imgs[`mesa/${nome}`]) {
    const L = LIVRO_EMPE, W0 = U.lw(img), s = w / W0, H0 = U.lh(img);
    const total = h + L.topo * s, cima = L.cima * s, baixo = L.baixo * s, meio = total - cima - baixo;
    if (meio < 2) { ctx.drawImage(img, x, yBase - total, w, total); return; }
    ctx.drawImage(img, 0, 0, W0, L.cima, x, yBase - total, w, cima + 0.5);
    ctx.drawImage(img, 0, L.cima, W0, H0 - L.cima - L.baixo, x, yBase - total + cima, w, meio + 0.5);
    ctx.drawImage(img, 0, H0 - L.baixo, W0, L.baixo, x, yBase - baixo, w, baixo);
  },
  // Estante (Nivel.estantes, 30/09, o kit do estudo aprovado da "Mesa com estante"): fundo, livros em pé nas
  // prateleiras, tábuas, laterais e o topo. A parte cheia (os blocos sólidos) vira prateleiras de ~3 blocos; embaixo
  // dela passa a pista (livros lá no fundo, longe do livro-portão). Montada uma vez num canvas (não se mexe).
  // 30/09, usuário: "a parte mais escurinha, que parece que está para trás, bloqueia os personagens"; "não dá para casar
  // com o chão da fase". A regra do jogo: CLARO bloqueia, ESCURO passa — a parte cheia fica clara (na frente: é parede),
  // só a passagem fica na sombra do plano de trás; o topo emenda na altura da faixa das prateleiras de papelão; sem
  // passagem, a tábua de baixo fica no chão (antes ia para a frente do tampo).
  // Andares (1/10, usuário: "um está curtinho, o outro mais longo; não entendi o critério"): todos da mesma altura
  // (e.andar blocos, 3 se não disser; escolhida no painel do editor), contados de baixo para cima a partir da tábua de
  // cima da passagem, alinhados na grade; o de cima fica com o que sobra (2 blocos ou mais); sobrando 1, é o tampo
  // (sem livros). A passagem é sempre o andar de baixo.
  estante(ctx, e) {
    if (!this.pronto() || !this.imgs['mesa/estante-topo']) return false;
    const R = ARTE_RES, m = 30, W = e.x1 - e.x0 + 2 * m, H = e.y1 - e.y0 + 2 * m, andar = (e.andar || 3) * TILE;
    const chave = `estante|${e.x0}|${e.y0}|${e.x1}|${e.y1}|${e.cheio}|${e.portaX}|${andar}`; // (passagem, livro e andar mudam o desenho)
    if (!this._feitos[chave]) {
      const c = document.createElement('canvas'); c.width = W * R; c.height = H * R; c._nativa = true; // (vai 1:1 para a tela)
      const g = c.getContext('2d'); g.scale(R, R); g.translate(m - e.x0, m - e.y0);
      // (sem passagem, a tábua de baixo fica inteira em cima do chão: a linha de baixo dela na linha de trás da pista)
      const tb0 = this.imgs['mesa/estante-tabua'], sobra = (tb0 ? tb0.height : 38) - KIT_ESTANTE['estante-tabua'].tira;
      const x0 = e.x0, x1 = e.x1, base = e.y1 - PROF.pista, cheio = e.cheio >= base ? base - sobra : e.cheio;
      const tabuas = [cheio]; // de baixo para cima: a de cima da passagem (ou a do chão) e uma a cada andar
      for (let y = cheio - andar; y - e.y0 >= 2 * TILE - 1; y -= andar) tabuas.unshift(y);
      const n = tabuas.length, tampo = tabuas[0] - e.y0 < 2 * TILE - 1; // (sobrou 1 bloco em cima: é o tampo, sem livros)
      g.fillStyle = '#5a3a22'; g.fillRect(x0 + 4, e.y0, x1 - x0 - 8, base - e.y0);
      if (tampo) { g.fillStyle = '#9a6538'; g.fillRect(x0 + 4, e.y0, x1 - x0 - 8, tabuas[0] - e.y0); }
      const livros = Object.keys(LIVROS_COR), porta = e.portaX ?? Infinity;
      [...tabuas, base].forEach((yb, i) => {
        const teto = i ? tabuas[i - 1] + 14 : e.y0 + 22, alt = yb - teto - 6;
        if (alt < 16 || (i === 0 && tampo)) return; // (sem passagem: não tem o vão de baixo; o tampo não tem livros)
        let x = x0 + 22, j = 0;
        while (x < x1 - 40 && !(i === n && x + 30 > porta - 10)) {
          const r = U.hash(e.c0 * 31 + i * 17 + j * 7), w = 22 + r * 16, hh = alt * (i === n ? 0.55 + r * 0.25 : 0.72 + U.hash(j * 13 + i) * 0.28);
          this._livro(g, livros[(j * 3 + i + e.c0) % livros.length], x, yb, w, hh);
          x += w + 2; j++;
        }
      });
      for (const yb of tabuas) this._kitH(g, 'estante-tabua', x0, x1, yb);
      for (const x of [x0 + 10, x1 - 10]) this._kitV(g, 'estante-lateral', x, 20, e.y0 + 20, base);
      // a passagem (onde se anda: atrás do herói) na sombra do plano de trás; da tábua de cima dela para baixo
      const tb = this.imgs['mesa/estante-tabua'], fimTabua = cheio - KIT_ESTANTE['estante-tabua'].tira + (tb ? tb.height : 21);
      if (base - fimTabua > 4) { g.fillStyle = SOMBRA_FUNDO; g.fillRect(x0 - 2, fimTabua, x1 - x0 + 4, base - fimTabua); }
      this._kitH(g, 'estante-topo', x0 - 6, x1 + 6, e.y0); // o topo, que se pisa, na altura da faixa do papelão
      this._feitos[chave] = c;
    }
    ctx.drawImage(this._feitos[chave], e.x0 - m, e.y0 - m, W, H);
    return true;
  },
  // Livro-portão (portão dentro de uma estante): o livro da cor do canal, em pé no vão de baixo da estante. Cabe nele
  // (30/09, usuário: "está maior do que a própria estante"): do chão até um pouco abaixo da tábua, da largura da coluna
  // do portão (a face é onde o herói para). Fechado, puxado para a frente (o pé na linha da frente da pista); abrindo,
  // vai para o fundo (a linha dos outros livros) e escurece até a sombra da estante.
  livroPortao(ctx, g, cor) {
    if (!this.pronto() || !this.imgs['mesa/empe-amarelo']) return false;
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const alvo = /^#[0-9a-f]{6}$/i.test(cor || '') ? rgb(cor) : rgb('#f1bf3a');
    const nome = Object.keys(LIVROS_COR).sort((a, b) => {
      const d = (q) => rgb(LIVROS_COR[q]).reduce((s, v, i) => s + (v - alvo[i]) ** 2, 0);
      return d(a) - d(b);
    })[0];
    const tb = this.imgs['mesa/estante-tabua'], tabua = g.l0 * TILE - KIT_ESTANTE['estante-tabua'].tira + (tb ? tb.height : 21);
    const k = U.ease.inOut(g.abertura), w = TILE, x = g.c * TILE, s = w / this.imgs[`mesa/${nome}`].width;
    const yb = g.l1 * TILE - PROF.pista * k, h = g.l1 * TILE - PROF.pista - tabua - 4 - LIVRO_EMPE.topo * s;
    this._livro(ctx, nome, x, yb, w, h);
    if (k > 0.01) { // a sombra só no livro (o mesmo desenho escurecido por cima, cada vez mais forte)
      const ch = `sombra|${nome}`;
      if (!this._feitos[ch]) {
        const im = this.imgs[`mesa/${nome}`], { c, g: q } = U.tela(U.lw(im), U.lh(im), im._rx || 1, im._ry || 1);
        q.drawImage(im, 0, 0); q.globalCompositeOperation = 'source-atop';
        q.fillStyle = 'rgba(52, 34, 22, 0.6)'; q.fillRect(0, 0, U.lw(im), U.lh(im)); this._feitos[ch] = c;
      }
      ctx.save(); ctx.globalAlpha = 0.6 * k; this._livro(ctx, nome, x, yb, w, h, this._feitos[ch]); ctx.restore();
    }
    return true;
  },
  // Régua-gangorra: o calço parado e a régua longa girando na ponta dele (g.ang)
  gangorra(ctx, g) {
    const im = this.imgs['mesa/gangorra-nivel'], R = RECORTE_GANGORRA;
    if (!this.pronto() || !im) return false;
    if (!this._reguaGangorra) {
      const [p0, p1] = R.passo, w = p1 - p0, fim = im.width - R.dir, L = R.esq + R.n * w + fim;
      const { c, g: q } = U.tela(L, R.reguaH, im._rx || 1, im._ry || 1);
      q.drawImage(im, 0, 0, R.esq, R.reguaH, 0, 0, R.esq, R.reguaH);
      for (let i = 0; i < R.n; i++) q.drawImage(im, p0, 0, w, R.reguaH, R.esq + i * w, 0, w, R.reguaH);
      q.drawImage(im, R.dir, 0, fim, R.reguaH, L - fim, 0, fim, R.reguaH);
      this._reguaGangorra = c;
    }
    const rg = this._reguaGangorra;
    ctx.drawImage(im, 0, R.calcoY, im.width, im.height - R.calcoY, g.x - R.ponta, g.py, im.width, im.height - R.calcoY);
    ctx.save(); ctx.translate(g.x, g.py); ctx.rotate(g.ang);
    ctx.drawImage(rg, -U.lw(rg) / 2, -R.reguaH);
    ctx.restore();
    return true;
  },
  // Trena: a fita (trena-fita: as pontas chanfradas ficam, o miolo de 20 a 222 se repete — esticado, as marcas
  // borravam) da boca até onde ela vai, com a ponta de metal no fim; a caixa (trena.png a TRENA.escala) com a saída da
  // fita virada para o vão
  trena(ctx, r) {
    const cx = this.imgs['mesa/trena'], fi = this.imgs['mesa/trena-fita'], po = this.imgs['mesa/trena-ponta'];
    if (!this.pronto() || !cx || !fi || !po) return false;
    const s = r.lado, L = r.L;
    if (L > 4) {
      // (a fita na escala da caixa: k = a altura dela; o comprimento repete o miolo, sem esticar as marcas)
      ctx.save(); ctx.translate(r.boca, 0); ctx.scale(s, 1); // daqui em diante, x cresce para dentro do vão
      const k = TRENA.fita / fi.height, h = TRENA.fita, y = r.chao - 4, m0 = 20, m1 = fi.width - 20, passo = (m1 - m0) * k;
      ctx.drawImage(fi, 0, 0, m0, fi.height, -6, y, m0 * k, h); // (a beirinha entra na caixa)
      let x = m0 * k - 6;
      while (x < L - 20 * k) { const w = Math.min(passo, L - 20 * k - x); ctx.drawImage(fi, m0, 0, w / k, fi.height, x, y, w + 0.5, h); x += w; }
      ctx.drawImage(fi, m1, 0, fi.width - m1, fi.height, x, y, (fi.width - m1) * k, h);
      ctx.drawImage(po, x - 4, y - 5, 37 * k * 1.1, 44 * k * 1.1); // a ponta de metal, com o gancho para baixo
      ctx.restore();
    }
    const w = cx.width * TRENA.escala, h = cx.height * TRENA.escala;
    ctx.save(); ctx.translate(r.x, 0); if (s < 0) ctx.scale(-1, 1);
    ctx.drawImage(cx, -w / 2, r.chao - h + 2, w, h);
    ctx.restore();
    return true;
  },
  // Tampo da mesa (o chão de baixo da fase com def.chaoMesa; o kit da estante, assets/mesa/mesa-tampo, como no estudo
  // aprovado da Mesa com estante): a tira de cima (a madeira vista de cima, na altura da faixa do chão) e a borda da
  // frente com veios; as pontas ficam e o meio estica. Embaixo, o vão escuro debaixo da mesa, com as pernas nas pontas.
  tampo(ctx, x0, x1, y, y1) {
    const im = this.imgs['mesa/mesa-tampo'], perna = this.imgs['mesa/mesa-perna'];
    if (!this.pronto() || !im) return false;
    const k = FAIXA_CHAO.h / TAMPO.prof, w = im.width, h = im.height, p = TAMPO.pontas, pk = p * k, yt = y - TAMPO.tira * k;
    const gr = ctx.createLinearGradient(0, y + 20, 0, y1);
    gr.addColorStop(0, '#4a3326'); gr.addColorStop(1, '#2a1d16');
    ctx.fillStyle = gr; ctx.fillRect(x0, y + 20, x1 - x0, y1 - y - 20);
    if (perna) {
      for (const px of [x0 + 70, x1 - 70]) { // (topo e pé ficam, o meio estica)
        const lw = 40, kp = lw / perna.width, t = 14 * kp, pb = 19 * kp, ya = y + 20, yb = y1 + 20;
        ctx.drawImage(perna, 0, 0, perna.width, 14, px - lw / 2, ya, lw, t + 0.5);
        ctx.drawImage(perna, 0, 14, perna.width, perna.height - 33, px - lw / 2, ya + t, lw, yb - ya - t - pb + 0.5);
        ctx.drawImage(perna, 0, perna.height - 19, perna.width, 19, px - lw / 2, yb - pb, lw, pb);
      }
    }
    ctx.drawImage(im, 0, 0, p, h, x0, yt, pk + 0.5, h * k);
    ctx.drawImage(im, p, 0, w - 2 * p, h, x0 + pk, yt, x1 - x0 - 2 * pk + 0.5, h * k);
    ctx.drawImage(im, w - p, 0, p, h, x1 - pk, yt, pk, h * k);
    return true;
  },
  // Estojo de zíper: a tampa (linhas 0 a ESTOJO.divisa do desenho) na altura da faixa do chão, atrás dos pés (em cima
  // da linha de pisar), e a frente com os 2 blocos da caixa; ESTOJO.desenho de largura
  estojo(ctx, e) {
    const im = this.imgs['mesa/estojo'];
    if (!this.pronto() || !im) return false;
    const E = ESTOJO, x0 = e.x - E.desenho / 2, topo = e.y - E.h;
    ctx.drawImage(im, 0, 0, im.width, E.divisa, x0, topo - E.tampa, E.desenho, E.tampa + 0.5);
    ctx.drawImage(im, 0, E.divisa, im.width, im.height - E.divisa, x0, topo, E.desenho, E.h + 2);
    return true;
  },
  // Pilar da frente (I/i): o lápis ou o marca-texto do kit da estante (assets/mesa/*-frente.png), escurecido. As pontas
  // ficam (a ponta do lápis, a tampa, o pé), o meio estica do teto até o chão. O lápis vai de ponta para baixo, CRAVADO
  // (01/10, usuário: "cravado no chão, indo até o teto"): a ponta entra no tampo (cortada na linha do chão, num furo) e o
  // cabo aperta o papelão de cima. O marca-texto fica em pé, de tampa para cima. Os dois na beira da frente do tampo. O
  // alto entra na laje (D.entra: cortado na beira de baixo dela, com a sombra dela). Montado uma vez num canvas (P.arte).
  pilar(ctx, P, a = 1) {
    const D = PILAR_PECA[P.p], chave = this.escurece(`mesa/${P.p}`, PILAR.escuro, D.vira), img = chave && this.imgs[chave];
    if (!this.pronto() || !img) return false;
    const w = U.lw(img), x0 = P.x - w / 2, y0 = P.teto - D.entra, y1 = P.chao + (D.crava ?? PILAR.pe);
    const k = `${chave}|${Math.round(y1 - y0)}`;
    if (!P.arte || P.arte.k !== k) P.arte = { k, c: this._montaPilar(img, D, Math.round(y1 - y0)) };
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(40, 26, 14, 0.45)'; // o furo (ou a sombra do pé) na beira da frente do tampo
    ctx.beginPath(); ctx.ellipse(P.x, P.chao - 1, w * (D.crava ? 0.3 : 0.48), D.crava ? 4 : 5, 0, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.rect(x0 - 2, P.teto, w + 4, (D.crava ? P.chao + 1 : y1 + 2) - P.teto); ctx.clip();
    ctx.drawImage(P.arte.c, x0, y0);
    ctx.restore();
    return true;
  },
  // o pilar inteiro com altura alt: as pontas da imagem, o meio esticado e a sombra da laje no alto
  _montaPilar(img, D, alt) { // (na resolução da peça: U.tela; tudo em px lógicos)
    const w = U.lw(img), h = U.lh(img), cima = D.vira ? D.pe : D.topo, baixo = D.vira ? D.topo : D.pe, meio = Math.max(1, alt - cima - baixo);
    const { c, g } = U.tela(w, alt, img._rx || 1, img._ry || 1);
    g.drawImage(img, 0, 0, w, cima, 0, 0, w, cima + 0.5);
    g.drawImage(img, 0, cima, w, h - cima - baixo, 0, cima, w, meio + 0.5);
    g.drawImage(img, 0, h - baixo, w, baixo, 0, cima + meio, w, baixo);
    g.globalCompositeOperation = 'source-atop';
    const s = g.createLinearGradient(0, D.entra, 0, D.entra + PILAR_SOMBRA.alto);
    s.addColorStop(0, `rgba(30, 20, 12, ${PILAR_SOMBRA.forca})`); s.addColorStop(1, 'rgba(30, 20, 12, 0)');
    g.fillStyle = s; g.fillRect(0, 0, w, alt);
    return c;
  },
  // Cópia escurecida (cor de sombra por cima, na força pedida; vira = de cabeça para baixo), para o plano da frente;
  // devolve a chave dela. As cópias ficam na resolução da peça (U.tela).
  escurece(chave, forca, vira = false) {
    const nova = `${chave}|escuro${forca}${vira ? '|vira' : ''}`, img = this.imgs[chave];
    if (this.imgs[nova] || !img) return img ? nova : null;
    const { c, g } = U.tela(U.lw(img), U.lh(img), img._rx || 1, img._ry || 1);
    if (vira) { g.translate(0, U.lh(img)); g.scale(1, -1); }
    g.drawImage(img, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(38, 30, 48, ${forca})`;
    g.fillRect(0, 0, c.width, c.height);
    this.imgs[nova] = c;
    return nova;
  },
  // Cópia de uma peça com névoa (a cor do céu por cima, na força pedida), para o plano de trás; devolve a chave dela
  nevoa(chave, forca) {
    const nova = `${chave}|nevoa${forca}`, img = this.imgs[chave];
    if (this.imgs[nova] || !img) return img ? nova : null;
    const { c, g } = U.tela(U.lw(img), U.lh(img), img._rx || 1, img._ry || 1);
    g.drawImage(img, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(214, 236, 240, ${forca})`;
    g.fillRect(0, 0, c.width, c.height);
    this.imgs[nova] = c;
    return nova;
  },

  // Pinta o vermelho do desenho com a cor pedida (mesmo claro/escuro); o resto fica igual. Guardado por imagem e cor.
  tinge(nome, cor) {
    const img = this.imgs[nome];
    if (!cor || /^#e2433a$/i.test(cor)) return img;
    const chave = `${nome}|${cor}`;
    if (this._tintas[chave]) return this._tintas[chave];
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    try {
      const px = g.getImageData(0, 0, c.width, c.height), p = px.data;
      const [ht, st, lt] = Objetos._hsl(...[1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16)));
      const LREF = 0.53; // luz do vermelho da folha (manopla: 232, 41, 43)
      for (let i = 0; i < p.length; i += 4) {
        if (p[i + 3] < 8) continue;
        const [h, s, l] = Objetos._hsl(p[i], p[i + 1], p[i + 2]);
        if (!((h < 0.045 || h > 0.955) && s > 0.35 && l > 0.1)) continue;
        const nl = l <= LREF ? l * (lt / LREF) : lt + ((l - LREF) * (1 - lt)) / (1 - LREF);
        const [r, gg, b] = Objetos._rgb(ht, st * Math.min(1, s / 0.75), nl);
        p[i] = r; p[i + 1] = gg; p[i + 2] = b;
      }
      g.putImageData(px, 0, 0);
    } catch (e) { return img; } // imagem de outra origem (arquivo aberto sem servidor): fica vermelha
    return (this._tintas[chave] = c);
  },
  _hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 1e-6) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, Math.min(1, s), l];
  },
  _rgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h * 6) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h * 6) % 6];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  },
  // Pedaço [y0, y1) (px do jogo, na escala da imagem) de uma imagem, desenhado no retângulo pedido
  _faixa(ctx, img, y0, y1, x, y, w, h) {
    const R = this.d.R;
    ctx.drawImage(img, 0, y0 * R, img.width, Math.max(1, (y1 - y0) * R), x, y, w, h);
  },

  // Porta de saída: o arco de 96 px (porta de 2 blocos) escala com a largura; a faixa reta estica até a altura da porta.
  // Acesa (os três chegaram): as tábuas viram dourado. A coroa flutua em cima, balançando.
  saida(ctx, s, todos, t) {
    if (!this.pronto()) return false;
    const D = this.d.saida, W = s.x1 - s.x0 + 16, k = W / D.arco[0];
    const natural = D.arco[1] * k, alvo = s.y1 - s.y0 - 6, extra = Math.max(0, alvo - natural);
    const H = natural + extra, x = s.x0 - 8, y = s.y1 - H, img = this.imgs[todos ? 'saida-acesa' : 'saida'];
    const [f0, f1] = D.faixa;
    this._faixa(ctx, img, 0, f0, x, y, W, f0 * k);
    this._faixa(ctx, img, f0, f1, x, y + f0 * k, W, (f1 - f0) * k + extra);
    this._faixa(ctx, img, f1, D.arco[1], x, y + f1 * k + extra, W, (D.arco[1] - f1) * k);
    const cx = x + W / 2 + D.coroaDx * k, cy = y + D.coroaDy * k + Math.sin(t * 3) * 2;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 2) * 0.08);
    ctx.drawImage(this.imgs['saida-coroa'], -D.coroa[0] * k / 2, -D.coroa[1] * k / 2, D.coroa[0] * k, D.coroa[1] * k);
    ctx.restore();
    return true;
  },

  // Alavanca de puxar para baixo: o desenho inteiro em três posições do cabo — em cima (desligada), deitado e embaixo
  // (ligada) —, apoiado no chão pelo meio do poste. A posição segue o giro (k.ang, 0 a ±0,32 em 0,14 s) e troca junto
  // com a pose do herói (0,12 s): ligando, desce aos 85% do giro; desligando, sobe aos 15%. O cabo deitado aponta para
  // quem puxou (desenhado para a esquerda; da direita, espelhado). A bola vermelha vira a cor do canal.
  alavanca(ctx, k, cor, ang) {
    if (!this.pronto()) return false;
    const p = Math.min(1, Math.abs(ang) / 0.32);
    const n = k.ligada ? (p < 0.4 ? 'cima' : p < 0.85 ? 'deitada' : 'baixo') : (p > 0.6 ? 'baixo' : p > 0.15 ? 'deitada' : 'cima');
    const D = this.d.alavanca[n];
    ctx.save();
    if (n === 'deitada' && (k.lado || Math.sign(ang)) > 0) { ctx.translate(2 * k.x, 0); ctx.scale(-1, 1); }
    ctx.drawImage(this.tinge(`alavanca-${n}`, cor), k.x + D.x, k.y + D.y, D.tam[0], D.tam[1]);
    ctx.restore();
    return true;
  },

  // Botão pesado: a cúpula (cor do canal; verde apertado) afunda atrás da base
  botao(ctx, k, cor, apertado, trem) {
    if (!this.pronto()) return false;
    const D = this.d.botao, afunda = apertado ? 9 : 0;
    ctx.drawImage(this.tinge('botao-cupula', cor), k.x + D.cupX + trem, k.y + D.cupY + afunda, D.cupula[0], D.cupula[1]);
    ctx.drawImage(this.imgs['botao-base'], k.x + D.baseX, k.y + D.baseY, D.base[0], D.base[1]);
    Estilo.texto(ctx, 'kg', k.x + trem, k.y + D.cupY + D.cupula[1] * 0.55 + afunda, { tam: 10, cor: '#fffdf6', borda: 3 });
    return true;
  },

  // Portão de régua (24 px de largura): topo, meio repetido (2 marcas por pedaço) e base; puxado para a cor do canal.
  // Montado uma vez por altura e cor.
  _regua(h, cor) {
    const chave = `regua|${h}|${cor}`;
    if (this._feitos[chave]) return this._feitos[chave];
    const D = this.d.portao, R = this.d.R, w = D.topo[0];
    const c = document.createElement('canvas');
    c.width = Math.round(w * R); c.height = Math.round(h * R);
    const g = c.getContext('2d');
    g.scale(R, R);
    const baseY = h - D.base[1];
    for (let y = D.topo[1] - 0.5; y < baseY; y += D.meio[1] - 0.34) g.drawImage(this.imgs['portao-meio'], 0, y, w, D.meio[1]);
    g.drawImage(this.imgs['portao-base'], 0, baseY, w, D.base[1]);
    g.drawImage(this.imgs['portao-topo'], 0, 0, w, D.topo[1]);
    if (cor) { // multiplica por um tom claro da cor do canal e devolve a transparência do desenho
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = U.mistura('#ffffff', cor, 0.55);
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in';
      const m = this._regua(h, null);
      g.drawImage(m, 0, 0);
    }
    return (this._feitos[chave] = c);
  },
  portao(ctx, x, y, h, cor) {
    if (!this.pronto()) return false;
    ctx.drawImage(this._regua(h, cor), x, y, this.d.portao.topo[0], h);
    return true;
  },

  // Porta trancada (36 px por bloco de largura): topo, faixa esticada, base; dobradiças a 30% e 70%, fechadura no meio.
  // Painel da cor da chave. Montada uma vez por altura e cor.
  _porta(h, cor) {
    const chave = `porta|${h}|${cor}`;
    if (this._feitos[chave]) return this._feitos[chave];
    const D = this.d.porta, R = this.d.R, w = D.topo[0];
    const c = document.createElement('canvas');
    c.width = Math.round(w * R); c.height = Math.round(h * R);
    const g = c.getContext('2d');
    g.scale(R, R);
    g.drawImage(this.imgs['porta-faixa'], 0, D.topo[1] - 0.5, w, h - D.topo[1] - D.base[1] + 1);
    g.drawImage(this.imgs['porta-topo'], 0, 0, w, D.topo[1]);
    g.drawImage(this.imgs['porta-base'], 0, h - D.base[1], w, D.base[1]);
    for (const f of [0.3, 0.7]) g.drawImage(this.imgs['porta-dobradica'], D.dobX, h * f - D.dobradica[1] / 2, D.dobradica[0], D.dobradica[1]);
    g.drawImage(this.imgs['porta-fechadura'], D.fechX, h * 0.5 - D.fechadura[1] / 2, D.fechadura[0], D.fechadura[1]);
    this.imgs[chave] = c;
    return (this._feitos[chave] = this.tinge(chave, cor));
  },
  porta(ctx, x, y, w, h, cor) {
    if (!this.pronto()) return false;
    ctx.drawImage(this._porta(h, cor), x + 2, y, w - 4, h);
    return true;
  },

  // Laje de papelão (retângulo de blocos "#") em 9 fatias: cantos como desenhados; a faixa ondulada de cima repete um
  // período inteiro por vez (n períodos, esticados até caber: a onda não quebra); bordas esticadas; o miolo é um
  // padrão espelhado (sem emenda). Pilar de 1 bloco = canto + 1 período + canto. Mais baixa que topo + base: encolhe.
  laje(ctx, x, y, w, h) {
    if (!this.pronto()) return false;
    const D = this.d.laje, img = this.imgs.laje, R = this.d.R, [W, H] = D.tam;
    const E = D.e / R, P = D.p / R, Dd = (W - D.d) / R, T = D.t / R, B = (H - D.b) / R;
    const meio = w - E - Dd, n = Math.max(0, Math.round(meio / P));
    const k = n ? 1 : w / (E + Dd), ex = E * k, dx = Dd * k, pw = n ? meio / n : 0;
    const ky = Math.min(1, h / (T + B)), tt = T * ky, bb = B * ky, mh = h - tt - bb, xm = x + ex, wm = w - ex - dx;
    const d = (sx, sy, sw, sh, X, Y, L, A) => { if (L > 0 && A > 0) ctx.drawImage(img, sx, sy, sw, sh, X, Y, L, A); };
    // de cima: canto, períodos, canto (+0,4 px de sobra: sem risco claro entre as fatias)
    d(0, 0, D.e, D.t, x, y, ex + 0.4, tt);
    for (let i = 0; i < n; i++) d(D.e, 0, D.p, D.t, xm + i * pw, y, pw + 0.4, tt);
    d(D.d, 0, W - D.d, D.t, x + w - dx, y, dx, tt);
    if (mh > 0) {
      d(0, D.t, D.e, D.b - D.t, x, y + tt - 0.2, ex + 0.4, mh + 0.6);
      d(D.d, D.t, W - D.d, D.b - D.t, x + w - dx, y + tt - 0.2, dx, mh + 0.6);
      if (wm > 0) {
        const pat = this._miolo(ctx);
        pat.setTransform(new DOMMatrix().translate(xm, y + tt).scale(1 / R));
        ctx.fillStyle = pat;
        ctx.fillRect(xm, y + tt - 0.2, wm + 0.4, mh + 0.6);
      }
    }
    d(0, D.b, D.e, H - D.b, x, y + h - bb, ex + 0.4, bb);
    d(D.e, D.b, D.d - D.e, H - D.b, xm, y + h - bb, wm + 0.4, bb);
    d(D.d, D.b, W - D.d, H - D.b, x + w - dx, y + h - bb, dx, bb);
    return true;
  },
  // Miolo da laje como padrão: o ladrilho só com a textura fina (laje-miolo) espelhado 2x2 (as bordas se encontram)
  _miolo(ctx) {
    const todos = this._padroes || (this._padroes = new WeakMap());
    if (todos.has(ctx)) return todos.get(ctx);
    const img = this.imgs['laje-miolo'], w = img.width, h = img.height, c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d');
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      g.setTransform(sx, 0, 0, sy, sx < 0 ? w * 2 : 0, sy < 0 ? h * 2 : 0);
      g.drawImage(img, 0, 0);
    }
    const pat = ctx.createPattern(c, 'repeat');
    todos.set(ctx, pat);
    return pat;
  },

  // Parede fraca: um painel de papelão remendado por coluna de blocos "C", da altura da coluna. Mais alta que o desenho,
  // estica só os dois trechos lisos entre as fitas; mais baixa, encolhe inteiro. espelha: colunas vizinhas não iguais.
  fraca(ctx, x, y, h, espelha) {
    if (!this.pronto()) return false;
    const D = this.d.fraca, img = this.imgs.fraca, [w, hn] = D.tam, k = img.height / hn;
    ctx.save();
    if (espelha) { ctx.translate(2 * x + w, 0); ctx.scale(-1, 1); }
    if (h <= hn) ctx.drawImage(img, x, y, w, h);
    else {
      const [[a0, a1], [b0, b1]] = D.estica, mais = (h - hn) / 2;
      let yy = y;
      for (const [s0, s1, m] of [[0, a0, 0], [a0, a1, mais], [a1, b0, 0], [b0, b1, mais], [b1, hn, 0]]) {
        const hh = s1 - s0 + m;
        ctx.drawImage(img, 0, s0 * k, img.width, (s1 - s0) * k, x, yy, w, hh + (s1 < hn ? 0.4 : 0));
        yy += hh;
      }
    }
    ctx.restore();
    return true;
  },

  // Poça de cola ('k') ou de corretivo ('w') numa fileira de n blocos (y = linha do chão): pontas como desenhadas, meio
  // esticado. O frasco de cola / a caneta de corretivo fica deitado na ponta aberta (lado: 1 direita, -1 esquerda), com
  // o bico entrando na poça; sem ponta aberta (0), inteiro dentro dela, na direita.
  poca(ctx, t, x, y, n, lado = 1) {
    if (!this.pronto()) return false;
    const D = this.d.pocas[t], nome = t === 'k' ? 'cola' : 'corretivo', img = (q) => this.imgs[`${nome}-${q}`];
    const W = n * TILE - 4, x0 = x + 2, k = Math.min(1, W / (D.esq[0] + D.dir[0] + 4)), e = D.esq[0] * k, d = D.dir[0] * k, h = D.meio[1];
    ctx.drawImage(img('meio'), x0 + e - 0.5, y - h + 1, W - e - d + 1, h);
    ctx.drawImage(img('esq'), x0, y - h + 1, e, h);
    ctx.drawImage(img('dir'), x0 + W - d, y - h + 1, d, h);
    const [ow, oh] = D.obj, entra = lado ? ow * D.entra : ow;
    ctx.save();
    if (lado >= 0) ctx.translate(x0 + W - entra, y + 1 - oh);
    else { ctx.translate(x0 + entra, y + 1 - oh); ctx.scale(-1, 1); }
    ctx.drawImage(img(t === 'k' ? 'frasco' : 'caneta'), 0, 0, ow, oh);
    ctx.restore();
    return true;
  },

  // Rolo de durex: o desenho gira pelo meio do anel (a ponta solta da fita fica de fora)
  durex(ctx, r) {
    if (!this.pronto()) return false;
    const D = this.d.durex.durex;
    ctx.save();
    ctx.translate(r.x, r.y - DUREX.r); ctx.rotate(r.giro);
    ctx.drawImage(this.imgs.durex, -D.centro[0], -D.centro[1], D.tam[0], D.tam[1]);
    ctx.restore();
    return true;
  },

  // Folha de papel: uma tira por fileira de blocos "F" (pontas enroladas + meio esticado)
  // A folha sobe a altura da faixa do chão (FAIXA_CHAO.h) e cobre ela: o papel é o próprio tampo (29/09, usuário).
  // Em 3 fatias na vertical: o topo (ponta enrolada + contorno) e a base (contorno) só crescem 1,3x e o miolo pautado
  // estica. Crescer a folha inteira (2,35x com a faixa de 28) engrossava o contorno e as pontas: virava uma banheira.
  folha(ctx, x, y, n) {
    if (!this.pronto()) return false;
    const D = this.d.folha, W = n * TILE, H = D.esq[1], kf = 1.3;
    const P = 62, rTopo = 17, rBase = 56, rLinha = 11, u = H / P * kf; // linhas da imagem (62 px): contorno de cima na 11
    const yTopo = y - FAIXA_CHAO.h + 1 - rLinha * u, hTopo = rTopo * u, hBase = (P - rBase) * u;
    const hMeio = y - D.sobe + H - yTopo - hTopo - hBase; // a base fica onde a folha original acabava
    const e = Math.min(D.esq[0] * kf, W / 3), dd = Math.min(D.dir[0] * kf, W / 3);
    const tira = (img, dx, dw) => {
      ctx.drawImage(img, 0, 0, img.width, rTopo, dx, yTopo, dw, hTopo + 0.5);
      ctx.drawImage(img, 0, rTopo, img.width, rBase - rTopo, dx, yTopo + hTopo, dw, hMeio + 0.5);
      ctx.drawImage(img, 0, rBase, img.width, P - rBase, dx, yTopo + hTopo + hMeio, dw, hBase);
    };
    tira(this.imgs['folha-meio'], x + e - 0.5, W - e - dd + 1);
    tira(this.imgs['folha-esq'], x, e);
    tira(this.imgs['folha-dir'], x + W - dd, dd);
    return true;
  },

  // Lápis espetado (18 px de largura): ponta como desenhada, corpo esticado até a altura sorteada pelo nível
  lapis(ctx, x, yBase, h, rot, cor) {
    if (!this.pronto()) return false;
    const L = this.d.lapis[Math.max(0, CORES_LAPIS.indexOf(cor))], img = this.imgs[L.img];
    const [w, hn] = L.tam, p = Math.min(L.corpo, h * 0.5);
    ctx.save();
    ctx.translate(x, yBase); ctx.rotate(rot);
    this._faixa(ctx, img, 0, L.corpo, -w / 2, -h, w, p);
    this._faixa(ctx, img, L.corpo, hn, -w / 2, -h + p, w, h - p);
    ctx.restore();
    return true;
  },

  tachinha(ctx, x, y) {
    if (!this.pronto()) return false;
    const [w, h] = this.d.tachinha;
    ctx.drawImage(this.imgs.tachinha, x - w / 2, y - h, w, h);
    return true;
  },

  // Escada de palitos: degraus (esticados até os trilhos) e os dois trilhos por cima, com a ponta redonda sem esticar.
  // Mesma geometria da escada do código (trilho de 10 px, 8 na fresta; degrau a cada 30 px).
  escada(ctx, L) {
    if (!this.pronto()) return false;
    const D = this.d.escada, larga = L.w > 60, tr = larga ? 10 : 8, q = tr / 10;
    const xa = L.x - L.w / 2 + (larga ? 11 : 5), xb = L.x + L.w / 2 - (larga ? 11 : 5) - tr;
    const yt = L.yTopo - 30, yb = L.yBase, hd = D.degrau[1] * q;
    for (let y = yb - 22; y > L.yTopo - 16; y -= 30) ctx.drawImage(this.imgs['escada-degrau'], xa, y - hd / 2, xb + tr - xa, hd);
    const wt = D.trilho[0] * q, pt = D.ponta * q, img = this.imgs['escada-trilho'];
    for (const xx of [xa, xb]) {
      const x = xx + tr / 2 - wt / 2;
      this._faixa(ctx, img, 0, D.ponta, x, yt, wt, pt);
      this._faixa(ctx, img, D.ponta, D.trilho[1] - D.ponta, x, yt + pt - 0.3, wt, yb - yt - 2 * pt + 0.6);
      this._faixa(ctx, img, D.trilho[1] - D.ponta, D.trilho[1], x, yb - pt, wt, pt);
    }
    return true;
  },

  // Rolo de barbante (mais uma corda): (x, y) = meio do rolo
  rolo(ctx, x, y) {
    if (!this.pronto()) return false;
    const D = this.d.rolo;
    ctx.drawImage(this.imgs.rolo, x - D.cx, y - D.cy, D.tam[0], D.tam[1]);
    return true;
  },

  chave(ctx, x, y, cor, esc, t) {
    if (!this.pronto()) return false;
    const [w, h] = this.d.chave.tam;
    ctx.save();
    ctx.translate(x, y); ctx.scale(esc, esc); ctx.rotate(Math.sin(t * 2 + x) * 0.15);
    ctx.drawImage(this.tinge('chave', cor), -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  },
};
