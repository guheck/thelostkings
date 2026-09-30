'use strict';

// Progresso: semente das fases geradas, fase atual, até onde chegou e quais venceu.
// Rodando pelo servidor local (node tools/serve.js), fica num arquivo da pasta do jogo (progresso.json) e vale para
// qualquer navegador. Sem ele (abrindo o index.html direto, ou publicado num site), fica só no navegador.
// Quando o gerador muda, as fases geradas mudam: sobe o número para os nomes guardados serem refeitos.
const GERADOR_VERSAO = 10; // 6: soco reto × gancho do Marreta (mureta pede gancho; fosso de teto baixo pede soco reto); 7: mureta com cola; 8: placa no buraco com durex; 9: lixeira; 10: tesoureiro
const Progresso = {
  CHAVE: 'the-lost-kings:progresso', CHAVE_VELHA: 'lk-progresso', // nome único: sites de jogos dividem o armazenamento
  URL: 'api/progresso',
  dados: null,
  arquivo: false, // o servidor local está guardando o progresso em progresso.json

  // Lê do navegador e do arquivo; fica o mais recente e os dois ficam iguais
  async carrega() {
    let local = null;
    try { local = this._valido(JSON.parse(localStorage.getItem(this.CHAVE) || localStorage.getItem(this.CHAVE_VELHA))); } catch (e) { /* sem armazenamento */ }
    const arq = await this._lerArquivo();
    this.dados = [local, arq].filter(Boolean).sort((a, b) => (b.quando || 0) - (a.quando || 0))[0] || null;
    if (this.dados) this._salva();
    return this.dados;
  },
  _valido(d) {
    if (!d || d.versao !== 1) return null;
    // o gerador mudou: nomes antigos das fases geradas não valem mais
    if (d.gerador !== GERADOR_VERSAO) { for (const k of Object.keys(d.nomes || {})) if (+k >= 3) delete d.nomes[k]; d.gerador = GERADOR_VERSAO; }
    d.nomes = d.nomes || {};
    return d;
  },
  // Só pergunta pelo arquivo quando o jogo está rodando no próprio computador ou na rede de casa
  async _lerArquivo() {
    const h = location.hostname;
    const local = location.protocol.startsWith('http') && (h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
      || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h));
    if (!local) return null;
    const ctl = new AbortController(), limite = setTimeout(() => ctl.abort(), 1500);
    try {
      const r = await fetch(this.URL, { cache: 'no-store', signal: ctl.signal });
      const j = await r.json();
      if (!j || j.arquivo !== true) return null;
      this.arquivo = true;
      return this._valido(j.dados);
    } catch (e) { return null; } finally { clearTimeout(limite); }
  },
  grava() {
    if (!this.dados) return;
    this.dados.quando = Date.now();
    this._salva();
  },
  _salva() {
    const txt = JSON.stringify(this.dados);
    try { localStorage.setItem(this.CHAVE, txt); localStorage.removeItem(this.CHAVE_VELHA); } catch (e) { /* sem armazenamento */ }
    if (this.arquivo) {
      fetch(this.URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: txt, keepalive: true }).catch(() => {});
    }
  },
  novo(semente) {
    this.dados = { versao: 1, gerador: GERADOR_VERSAO, semente, atual: 0, maior: 0, vencidas: [], nomes: {}, quando: Date.now() };
    this.grava();
  },
  entrou(i, nome) {
    const d = this.dados;
    if (!d) return;
    d.atual = i;
    d.maior = Math.max(d.maior, i);
    d.nomes[i] = nome;
    d.quando = Date.now();
    this.grava();
  },
  venceu(i) {
    const d = this.dados;
    if (!d) return;
    if (!d.vencidas.includes(i)) d.vencidas.push(i);
    d.maior = Math.max(d.maior, i + 1); // libera a próxima
    this.grava();
  },
  recorde() { const v = this.dados ? this.dados.vencidas : []; return v.length ? Math.max(...v) + 1 : 0; },
};

// Menu inicial e escolha de sala (desenhados no próprio canvas; teclado e mouse)
const Menu = {
  tela: 'menu', // 'menu' | 'salas'
  sel: 0,
  confirma: false,
  selSala: 0,
  botoes: [],
  nomesGerados: {},

  opcoes() {
    const d = Progresso.dados, o = [];
    if (d) {
      const nome = this.nomeSala(d.atual);
      o.push({ id: 'continuar', txt: 'Continuar', sub: `Fase ${d.atual + 1}${nome ? ' — ' + nome : ''}` });
      const v = d.vencidas.length;
      o.push({ id: 'escolher', txt: 'Escolher fase', sub: `${d.maior + 1} ${d.maior ? 'fases liberadas' : 'fase liberada'} · ${v} ${v === 1 ? 'vencida' : 'vencidas'}` });
    }
    o.push(this.confirma
      ? { id: 'novo', txt: 'Tem certeza?', sub: 'Apaga o progresso e começa da fase 1', perigo: true }
      : { id: 'novo', txt: 'Novo jogo', sub: 'Começa da fase 1' });
    return o;
  },

  nomeSala(i) {
    const d = Progresso.dados;
    if (i < SALAS.length) return SALAS[i].nome;
    if (d && d.nomes[i]) return d.nomes[i];
    const k = `${d ? d.semente : 0}:${i}`;
    if (!(k in this.nomesGerados)) { const g = d && Gerador.sala(i + 1, d.semente); this.nomesGerados[k] = g ? g.nome : ''; }
    return this.nomesGerados[k];
  },

  abre(J) { this.tela = 'menu'; this.sel = 0; this.confirma = false; J.modo = 'menu'; },

  // teclado (E = entrada do quadro, com toques de seta)
  entrada(E, J) {
    if (this.tela === 'menu') {
      const n = this.opcoes().length;
      if (E.bCima) { this.sel = (this.sel + n - 1) % n; this.confirma = false; }
      if (E.bBaixo) { this.sel = (this.sel + 1) % n; this.confirma = false; }
      if (E.acao || E.pulo) this.ativa(this.opcoes()[Math.min(this.sel, n - 1)].id, J);
      if (E.menu) this.confirma = false;
    } else {
      const max = Progresso.dados ? Progresso.dados.maior : 0, col = 8;
      if (E.bEsq) this.selSala = Math.max(0, this.selSala - 1);
      if (E.bDir) this.selSala = Math.min(max, this.selSala + 1);
      if (E.bCima) this.selSala = Math.max(0, this.selSala - col);
      if (E.bBaixo) this.selSala = Math.min(max, this.selSala + col);
      if (E.acao || E.pulo) J.inicia(this.selSala);
      if (E.menu) this.tela = 'menu';
    }
  },

  ativa(id, J) {
    const d = Progresso.dados;
    if (id === 'continuar' && d) { J.semente = d.semente; J.inicia(d.atual); }
    else if (id === 'escolher' && d) { this.tela = 'salas'; this.selSala = d.atual; }
    else if (id === 'novo') {
      if (d && !this.confirma) { this.confirma = true; return; }
      const s = Math.floor(Math.random() * 1e9);
      Progresso.novo(s);
      this.nomesGerados = {};
      J.semente = s;
      J.inicia(0);
    }
  },

  // mouse: passa por cima seleciona, clique ativa
  mouse(p, J, clicou) {
    const b = this.botoes.find((q) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h);
    if (!b) return;
    if (this.tela === 'menu') {
      if (b.i !== this.sel) { this.sel = b.i; if (!clicou) this.confirma = false; }
      if (clicou) this.ativa(b.id, J);
    } else if (b.id === 'voltar') { if (clicou) this.tela = 'menu'; }
    else if (b.id === 'rolaCima' || b.id === 'rolaBaixo') {
      const max = Progresso.dados ? Progresso.dados.maior : 0;
      if (clicou) this.selSala = U.clamp(this.selSala + (b.id === 'rolaCima' ? -8 : 8), 0, max);
    } else {
      this.selSala = b.i;
      if (clicou) J.inicia(b.i);
    }
  },

  // ---------------------------------------------------------------------------
  desenha(ctx, J) {
    const W = J.W, H = J.H, t = J.t;
    if (!this.fundo || this.fundo.width !== J.cv.width) {
      const c = document.createElement('canvas');
      c.width = J.cv.width; c.height = J.cv.height;
      const g = c.getContext('2d');
      g.setTransform(J.escala, 0, 0, J.escala, 0, 0);
      Cenario.ceu(g, W, H);
      Cenario.sol(g, 1120, 150, 44, 0);
      const [c1, c2] = Cenario.coresColina();
      Cenario.colina(g, W, H, 470, 26, 0.006, 1.3, c1, 2);
      Cenario.enfeites(g, W, 470, 26, 0.006, 1.3, 5, 56, ['arvore1', 'arvore2', 'arvores'], 240);
      Cenario.castelo(g, 900, 468, 0.7);
      Cenario.colina(g, W, H, 540, 20, 0.009, 2.6, c2, 3);
      Cenario.enfeites(g, W, 540, 20, 0.009, 2.6, 9, 60, ['arbusto1', 'arvores', 'arbustos', 'arbusto2', 'arvore1'], 260);
      Cenario.plataforma(g, -20, 620, W + 40, 130);
      Cenario.faixa(g, -20, W + 20, 620, 0, 0);
      this.fundo = c;
    }
    ctx.drawImage(this.fundo, 0, 0, W, H);
    Cenario.nuvem(ctx, 200, 150, 1, t, 0);
    Cenario.nuvem(ctx, 980, 90, 0.8, t, 2);
    this._herois(ctx, t);
    Estilo.texto(ctx, 'THE LOST KINGS', W / 2, 92 + Math.sin(t * 2) * 3, { tam: 76, cor: '#f1bf3a', rot: -0.02 });
    ctx.save();
    ctx.font = `22px ${FONTE_FALA}`;
    ctx.fillStyle = '#2b1f2e';
    ctx.textAlign = 'center';
    ctx.fillText('protótipo', W / 2, 148);
    ctx.restore();
    this.botoes = [];
    if (this.tela === 'menu') this._menu(ctx, J); else this._salas(ctx, J);
  },

  _herois(ctx, t) {
    const lista = [['marreta', 170, 1], ['pudim', 300, 1], ['fiapo', 1110, -1]];
    lista.forEach(([id, x, f], i) => {
      const ch = Cast[id];
      const tt = t + i * 0.9;
      const festa = (tt % 6) > 5;
      const I = Poses.idle[id](tt);
      const pose = festa ? Poses.comemora(tt, id) : I.pose;
      const P = Rig.fk(ch.p, pose);
      const py = 620 - (Rig.alturaPelve(ch.p, pose) - (festa ? 0 : I.dy)) * 1.25;
      let rosto = Rosto.expr(festa ? 'feliz' : ch.exprBase, { olhar: { x: 0.6, y: -0.2 } });
      if (piscando(tt, i + 1) && rosto.olhos === 'normal' && rosto.palp < 0.5) rosto.palp = 1;
      Desenho.sombraChao(ctx, x, 622, 60);
      if (Sprites.desenhaAnim(ctx, id, festa ? 'festa' : 'parado', tt, x, 620, f, 1.25 / ESC)) return; // desenhos da IA
      Desenho.personagem(ctx, ch, Rig.mundo(P, x, py, 1), Object.assign({ f, t: tt, rosto, escala: 1.25, pesPlanos: true }, I.extra || {}));
    });
  },

  _menu(ctx, J) {
    const ops = this.opcoes(), w = 420, h = 74, x = J.W / 2 - w / 2;
    let y = 210;
    ops.forEach((o, i) => {
      const s = i === this.sel;
      const yy = y + (s ? -3 : 0);
      Estilo.forma(ctx, (c) => U.retRed(c, x, yy, w, h, 14), { cor: o.perigo ? '#f9b4a6' : s ? '#ffe483' : '#fbf7ec' }, { elev: s ? 3 : 2, linha: 3 });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2b1f2e';
      ctx.font = `30px ${FONTE_TITULO}`;
      ctx.fillText(o.txt, J.W / 2, yy + 36);
      ctx.font = `19px ${FONTE_FALA}`;
      ctx.fillStyle = '#5b4a52';
      ctx.fillText(o.sub, J.W / 2, yy + 60);
      ctx.restore();
      if (s) {
        Estilo.forma(ctx, (c) => { c.beginPath(); c.moveTo(x - 30, yy + 25); c.lineTo(x - 12, yy + 37); c.lineTo(x - 30, yy + 49); c.closePath(); },
          { cor: '#f1bf3a' }, { elev: 1, linha: 2.5, cel: false });
      }
      this.botoes.push({ x, y, w, h, id: o.id, i });
      y += h + 16;
    });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `19px ${FONTE_FALA}`;
    ctx.fillStyle = '#2b1f2e';
    ctx.fillText(Toque.ativo ? 'Toque numa opção' : '↑ ↓ escolhe   Enter confirma   (ou use o mouse)', J.W / 2, 590);
    ctx.restore();
  },

  _salas(ctx, J) {
    const d = Progresso.dados;
    const max = d ? d.maior : 0, col = 8, cw = 92, chh = 70, gap = 12;
    const px = J.W / 2 - (col * cw + (col - 1) * gap) / 2 - 24, py = 176, pw = col * cw + (col - 1) * gap + 48, ph = 400;
    Estilo.forma(ctx, (c) => U.retRed(c, px, py, pw, ph, 18), { cor: '#fbf7ec' }, { elev: 3, linha: 3 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = `28px ${FONTE_TITULO}`;
    ctx.fillStyle = '#2b1f2e';
    ctx.fillText('Escolher fase', px + 24, py + 42);
    ctx.restore();
    // voltar
    const vb = { x: px + pw - 140, y: py + 14, w: 116, h: 38, id: 'voltar' };
    Estilo.forma(ctx, (c) => U.retRed(c, vb.x, vb.y, vb.w, vb.h, 10), { cor: '#e8dbc0' }, { elev: 1.5, linha: 2.5, cel: false });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `18px ${FONTE_FALA}`;
    ctx.fillStyle = '#2b1f2e';
    ctx.fillText(Toque.ativo ? 'Voltar' : 'Esc voltar', vb.x + vb.w / 2, vb.y + 25);
    ctx.restore();
    this.botoes.push(vb);
    // grade (rola para manter a selecionada à vista); com muitas fases, setas do lado rolam (mouse e toque)
    const linhasVisiveis = 4;
    const linhaSel = Math.floor(this.selSala / col);
    const primeira = Math.max(0, Math.min(linhaSel - 1, Math.floor(max / col) - linhasVisiveis + 1));
    if (Math.floor(max / col) + 1 > linhasVisiveis) {
      for (const [id, y, seta] of [['rolaCima', py + 66, '▲'], ['rolaBaixo', py + 66 + 3 * (chh + gap), '▼']]) {
        const b = { x: px + pw + 12, y, w: 58, h: chh, id };
        Estilo.forma(ctx, (c) => U.retRed(c, b.x, b.y, b.w, b.h, 12), { cor: '#fbf7ec' }, { elev: 1.5, linha: 2.5, cel: false });
        ctx.save(); ctx.textAlign = 'center'; ctx.font = `28px ${FONTE_TITULO}`; ctx.fillStyle = '#2b1f2e';
        ctx.fillText(seta, b.x + b.w / 2, b.y + 46); ctx.restore();
        this.botoes.push(b);
      }
    }
    for (let i = primeira * col; i <= max && i < (primeira + linhasVisiveis) * col; i++) {
      const lin = Math.floor(i / col) - primeira, cc = i % col;
      const x = px + 24 + cc * (cw + gap), y = py + 66 + lin * (chh + gap);
      const s = i === this.selSala, venceu = d && d.vencidas.includes(i), atual = d && d.atual === i;
      Estilo.forma(ctx, (c) => U.retRed(c, x, y - (s ? 3 : 0), cw, chh, 12),
        { cor: s ? '#ffe483' : venceu ? '#d7efc8' : '#ffffff' }, { elev: s ? 3 : 1.5, linha: 2.5, cel: false });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2b1f2e';
      ctx.font = `30px ${FONTE_TITULO}`;
      ctx.fillText(String(i + 1), x + cw / 2, y + 42 - (s ? 3 : 0));
      ctx.font = `15px ${FONTE_FALA}`;
      ctx.fillStyle = '#5b4a52';
      ctx.fillText(venceu ? '✓ vencida' : atual ? 'parou aqui' : 'nova', x + cw / 2, y + 62 - (s ? 3 : 0));
      ctx.restore();
      this.botoes.push({ x, y, w: cw, h: chh, id: 'sala', i });
    }
    const nome = this.nomeSala(this.selSala);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `22px ${FONTE_FALA}`;
    ctx.fillStyle = '#2b1f2e';
    ctx.fillText(`Fase ${this.selSala + 1}${nome ? ' — ' + nome : ''}   ·   ${Toque.ativo ? 'toque na fase para jogar' : 'setas escolhem, Enter joga'}`, J.W / 2, py + ph - 18);
    ctx.restore();
  },
};
