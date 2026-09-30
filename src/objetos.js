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
const PECAS_MESA = ['gangorra-nivel', 'carimbo', 'carimbo-marca', 'postit-colado'];
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
        img.onload = () => { this.imgs[`${pasta}/${n}`] = img; this._conta(-1); };
        img.onerror = () => { console.warn(`peça faltando: ${img.src}`); this._conta(-1); };
        img.src = `assets/${pasta}/${n}.png`;
      }
    }
    this._conta(1); // o manifesto (ele chama Objetos.dados antes do onload)
    const s = document.createElement('script');
    s.src = 'assets/cenario/objetos.js';
    s.onload = s.onerror = () => this._conta(-1);
    document.head.appendChild(s);
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
  // Régua-gangorra: o calço parado e a régua longa girando na ponta dele (g.ang)
  gangorra(ctx, g) {
    const im = this.imgs['mesa/gangorra-nivel'], R = RECORTE_GANGORRA;
    if (!this.pronto() || !im) return false;
    if (!this._reguaGangorra) {
      const [p0, p1] = R.passo, w = p1 - p0, fim = im.width - R.dir, L = R.esq + R.n * w + fim;
      const c = document.createElement('canvas'); c.width = L; c.height = R.reguaH;
      const q = c.getContext('2d');
      q.drawImage(im, 0, 0, R.esq, R.reguaH, 0, 0, R.esq, R.reguaH);
      for (let i = 0; i < R.n; i++) q.drawImage(im, p0, 0, w, R.reguaH, R.esq + i * w, 0, w, R.reguaH);
      q.drawImage(im, R.dir, 0, fim, R.reguaH, L - fim, 0, fim, R.reguaH);
      this._reguaGangorra = c;
    }
    const rg = this._reguaGangorra;
    ctx.drawImage(im, 0, R.calcoY, im.width, im.height - R.calcoY, g.x - R.ponta, g.py, im.width, im.height - R.calcoY);
    ctx.save(); ctx.translate(g.x, g.py); ctx.rotate(g.ang);
    ctx.drawImage(rg, -rg.width / 2, -R.reguaH);
    ctx.restore();
    return true;
  },
  // Cópia de uma peça com névoa (a cor do céu por cima, na força pedida), para o plano de trás; devolve a chave dela
  nevoa(chave, forca) {
    const nova = `${chave}|nevoa${forca}`, img = this.imgs[chave];
    if (this.imgs[nova] || !img) return img ? nova : null;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
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
