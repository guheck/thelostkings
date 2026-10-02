'use strict';

// Editor de fases: selecionar, mover e redimensionar (30/09, usuário: "não consigo escolher direito o que eu vou
// mexer"; "a estante precisava poder redimensionar"; "ponha bastante coisa que facilite o uso"). Tudo o que se mexe
// é um ITEM:
//   peca    herói, inimigo, objeto, chave (um bloco); saída, portão, porta, escada (o grupo inteiro)
//   bloco   um retângulo de terreno da mesma letra (papelão, livros, parede fraca, papel, lápis, poça, rampa)
//   estante a estante (def.estantes), com o que está dentro dela e o que está em pé em cima
//   deco    um enfeite (def.decoracao)
//   area    um retângulo qualquer, arrastado no vazio (copiar, colar, encher, apagar)
// Clique seleciona (o painel "Selecionado" mostra o que dá para mudar; as alças dos cantos e dos lados mudam o
// tamanho); arrastar move VENDO a fase mudar (a prévia é uma cópia da fase com a mudança) e só solta onde cabe (em
// vermelho: não cabe). Teclas: setas empurram um bloco, Delete apaga, Ctrl+C / Ctrl+V / Ctrl+D, F vira, Esc solta.
// Com uma peça de pintar na mão, a fase também mostra como fica antes do clique.

const copiaFase = (f) => JSON.parse(JSON.stringify(f));
const noRet = (r, c, l) => c >= r.c0 && c <= r.c1 && l >= r.l0 && l <= r.l1;
const desloca = (r, dc, dl) => ({ c0: r.c0 + dc, c1: r.c1 + dc, l0: r.l0 + dl, l1: r.l1 + dl });
const nomeCurto = (s) => (s || '').split(/ — |: | \(/)[0];
const ALCA = 7; // meio lado da alça, em px da tela
const TIPOS_BLOCO = [['#', 'Papelão'], ['b', 'Livros deitados'], ['C', 'Parede fraca'], ['F', 'Folha de papel'], ['^', 'Lápis'], ['k', 'Cola'], ['w', 'Corretivo']];

function limpaBloco(f, c, l) {
  f.grade[l][c] = '.';
  delete f.extras[`${c},${l}`];
  if (f.livros) delete f.livros[`${c},${l}`];
  f.canais = f.canais.filter((q) => q.c !== c || q.l !== l);
}
// Leva os blocos (com o canal, os extras do inimigo e o ritmo do carimbo) dc, dl. livre: o destino tem que estar vazio
// (ou ser deles); senão, cobre o que houver lá. Não cabe: false (e não mexe em nada).
function levaBlocos(f, tiles, dc, dl, livre) {
  const cols = f.grade[0].length, lins = f.grade.length, orig = new Set(tiles.map(([c, l]) => `${c},${l}`));
  for (const [c, l] of tiles) {
    const nc = c + dc, nl = l + dl;
    if (nc < 0 || nl < 0 || nc >= cols || nl >= lins) return false;
    if (livre && !orig.has(`${nc},${nl}`) && f.grade[nl][nc] !== '.') return false;
  }
  const pega = tiles.map(([c, l]) => ({ c, l, k: f.grade[l][c], canal: f.canais.find((q) => q.c === c && q.l === l), ex: f.extras[`${c},${l}`], cor: (f.livros || {})[`${c},${l}`] }));
  for (const p of pega) limpaBloco(f, p.c, p.l);
  for (const p of pega) {
    const nc = p.c + dc, nl = p.l + dl;
    limpaBloco(f, nc, nl);
    f.grade[nl][nc] = p.k;
    if (p.cor != null) (f.livros = f.livros || {})[`${nc},${nl}`] = p.cor;
    if (p.canal) f.canais.push({ c: nc, l: nl, canal: p.canal.canal });
    if (p.ex) f.extras[`${nc},${nl}`] = Object.assign({}, p.ex, { x: p.ex.x != null ? p.ex.x + dc * TILE : p.ex.x, y: p.ex.y != null ? p.ex.y + dl * TILE : p.ex.y });
  }
  for (const q of f.carimbos || []) if (orig.has(`${q.c},${q.l}`)) { q.c += dc; q.l += dl; }
  return true;
}
// O retângulo de terreno do bloco: a fileira dele (os vizinhos da mesma letra) e as de cima e de baixo com a mesma
// fileira, nem maior nem menor (como o desenho junta: a prateleira sem a mureta em cima dela)
function retTerreno(f, c, l) {
  const G = f.grade, k = G[l][c], cols = G[0].length, lins = G.length;
  let c0 = c, c1 = c;
  while (c0 > 0 && G[l][c0 - 1] === k) c0--;
  while (c1 + 1 < cols && G[l][c1 + 1] === k) c1++;
  const igual = (y) => y >= 0 && y < lins && G[y].slice(c0, c1 + 1).every((t) => t === k) && (c0 === 0 || G[y][c0 - 1] !== k) && (c1 + 1 >= cols || G[y][c1 + 1] !== k);
  let l0 = l, l1 = l;
  while (igual(l0 - 1)) l0--;
  while (igual(l1 + 1)) l1++;
  return { c0, c1, l0, l1 };
}

Object.assign(Ed, {
  sel: null, previa: null, prancheta: null, modoDaqui: false,

  // ------------------------------------------------------------------ itens
  // o que o clique pega: peça > estante > bloco de terreno > enfeite
  itemEm(b) {
    const f = this.f;
    if (b.dentro) {
      const k = f.grade[b.l][b.c], p = this.pecaEm(b.c, b.l);
      if (p) return { tipo: 'peca', k, tiles: p };
      const ei = (f.estantes || []).findIndex((e) => noRet(e, b.c, b.l));
      if (ei >= 0) return { tipo: 'estante', i: ei };
      if (k !== '.' && TERRENO.includes(k)) return { tipo: 'bloco', k, r: retTerreno(f, b.c, b.l) };
    }
    const di = this.decoEm(b.wx, b.wy);
    return di >= 0 ? { tipo: 'deco', i: di } : null;
  },
  retItem(it, f = this.f) {
    if (it.tipo === 'peca') {
      const xs = it.tiles.map((t) => t[0]), ys = it.tiles.map((t) => t[1]);
      return { c0: Math.min(...xs), c1: Math.max(...xs), l0: Math.min(...ys), l1: Math.max(...ys) };
    }
    if (it.tipo === 'estante') { const e = f.estantes[it.i]; return { c0: e.c0, c1: e.c1, l0: e.l0, l1: e.l1 }; }
    return it.r;
  },
  // caixa no mundo (px)
  caixaItem(it, f = this.f) {
    if (it.tipo === 'deco') {
      const d = f.decoracao[it.i], img = d && Objetos.imgs[`decoracao/${d.p}`];
      if (!img) return null;
      const w = d.a * img.width / img.height, y1 = d.y + ((d.c || 'fundo') === 'fundo' ? DECO.afunda : 0);
      return { x0: d.x - w / 2, y0: y1 - d.a, x1: d.x + w / 2, y1 };
    }
    const r = this.retItem(it, f);
    return { x0: r.c0 * TILE, y0: r.l0 * TILE, x1: (r.c1 + 1) * TILE, y1: (r.l1 + 1) * TILE };
  },
  itemValido(it) {
    const f = this.f;
    if (!it) return false;
    if (it.tipo === 'estante') return !!(f.estantes || [])[it.i];
    if (it.tipo === 'deco') return !!(f.decoracao || [])[it.i];
    if (it.tipo === 'peca') return it.tiles.every(([c, l]) => this.dentro(c, l) && f.grade[l][c] === it.k);
    return true;
  },
  nomeItem(it, f = this.f) {
    const r = it.tipo === 'deco' ? null : this.retItem(it, f), tam = r ? `${r.c1 - r.c0 + 1} × ${r.l1 - r.l0 + 1}` : '';
    if (it.tipo === 'peca') return nomeCurto(NOME_PECA[it.k]) || it.k;
    if (it.tipo === 'bloco') return `${(TIPOS_BLOCO.find((t) => t[0] === it.k) || [, nomeCurto(NOME_PECA[it.k])])[1]} ${tam}`;
    if (it.tipo === 'estante') return `Estante ${tam}`;
    if (it.tipo === 'deco') return `Enfeite: ${f.decoracao[it.i].p} (${f.decoracao[it.i].a} px)`;
    return `Área ${tam}`;
  },
  // dá para mudar o tamanho? 'ret' (8 alças: canto e lado) ou 'canto' (o enfeite: cresce por igual)
  estica(it) {
    if (it.tipo === 'deco') return 'canto';
    if (it.tipo === 'bloco' || it.tipo === 'estante' || it.tipo === 'area') return 'ret';
    return it.tipo === 'peca' && 'HGPLXYZ'.includes(it.k) ? 'ret' : null;
  },
  // o que está dentro da estante e o que está em pé em cima dela (a alavanca) vai junto
  tilesEstante(f, e) {
    const t = [];
    for (let l = e.l0; l <= e.l1; l++) for (let c = e.c0; c <= e.c1; c++) if (f.grade[l][c] !== '.') t.push([c, l]);
    if (e.l0 > 0) for (let c = e.c0; c <= e.c1; c++) { const k = f.grade[e.l0 - 1][c]; if (k !== '.' && !TERRENO.includes(k)) t.push([c, e.l0 - 1]); }
    return t;
  },

  // ------------------------------------------------------------------ operações (numa cópia da fase)
  // move o item dc, dl blocos (o enfeite: dx px, pousando no chão embaixo de yBase). { f, sel, ok }
  opMove(it, dc, dl, dx = 0, yBase = 0) {
    const f = copiaFase(this.f);
    if (it.tipo === 'peca') return { f, ok: levaBlocos(f, it.tiles, dc, dl, true), sel: Object.assign({}, it, { tiles: it.tiles.map(([c, l]) => [c + dc, l + dl]) }) };
    if (it.tipo === 'bloco') {
      const t = [];
      for (let l = it.r.l0; l <= it.r.l1; l++) for (let c = it.r.c0; c <= it.r.c1; c++) if (f.grade[l][c] === it.k) t.push([c, l]);
      return { f, ok: levaBlocos(f, t, dc, dl, true), sel: Object.assign({}, it, { r: desloca(it.r, dc, dl) }) };
    }
    if (it.tipo === 'estante') {
      const e = f.estantes[it.i], ok = levaBlocos(f, this.tilesEstante(f, e), dc, dl, true);
      if (ok) Object.assign(e, desloca(e, dc, dl));
      return { f, ok, sel: it };
    }
    if (it.tipo === 'area') {
      const r = it.r, t = [];
      for (let l = r.l0; l <= r.l1; l++) for (let c = r.c0; c <= r.c1; c++) t.push([c, l]);
      const ok = levaBlocos(f, t, dc, dl, false);
      if (ok) { // o que é da área vai junto: estante inteira dentro dela, enfeites, "idas sem volta"
        for (const e of f.estantes || []) if (noRet(r, e.c0, e.l0) && noRet(r, e.c1, e.l1)) Object.assign(e, desloca(e, dc, dl));
        for (const d of f.decoracao || []) if (noRet(r, Math.floor(d.x / TILE), Math.floor((d.y - 1) / TILE))) { d.x += dc * TILE; d.y += dl * TILE; }
        for (const q of f.semVolta || []) if (noRet(r, q.para[0], q.para[1])) { q.para[0] += dc; q.para[1] += dl; }
      }
      return { f, ok, sel: { tipo: 'area', r: desloca(r, dc, dl) } };
    }
    // enfeite: anda em x e pousa no chão embaixo de onde a base ficou (a etiqueta: na cara da frente do chão)
    const d = f.decoracao[it.i], d0 = this.f.decoracao[it.i], off = (d0.c || 'fundo') !== 'fundo' ? (ENFEITES[d0.p] || {}).dy || 90 : 0;
    const x = Math.round((d0.x + dx) / 5) * 5, chao = this.chaoEm(x, yBase);
    if (chao == null) return { f, ok: false, sel: it };
    d.x = x; d.y = chao + off;
    return { f, ok: true, sel: it };
  },
  // muda o tamanho para o retângulo r2 (blocos). Terreno e grupos: tira o que saiu, enche o vazio que entrou
  opEstica(it, r2) {
    if (it.tipo === 'area') return { f: this.f, ok: true, sel: { tipo: 'area', r: r2 }, semMudar: true };
    const f = copiaFase(this.f);
    if (it.tipo === 'estante') { this.refazEstante(f, it.i, r2); return { f, ok: true, sel: it }; }
    const r = this.retItem(it), k = it.k, canal = it.tipo === 'peca' ? f.canais.find((q) => noRet(r, q.c, q.l) && f.grade[q.l][q.c] === k) : null;
    // (livro: o pedaço novo de cada fileira fica da cor dela; as fileiras novas, da de cima ou da de baixo)
    const corDe = (l) => (f.livros || {})[`${r.c0},${U.clamp(l, r.l0, r.l1)}`];
    const cores = {};
    for (let l = r2.l0; l <= r2.l1; l++) cores[l] = corDe(l);
    for (let l = r.l0; l <= r.l1; l++) for (let c = r.c0; c <= r.c1; c++) if (f.grade[l][c] === k && !noRet(r2, c, l)) limpaBloco(f, c, l);
    const tiles = [];
    for (let l = r2.l0; l <= r2.l1; l++) {
      for (let c = r2.c0; c <= r2.c1; c++) {
        if (f.grade[l][c] === '.') {
          f.grade[l][c] = k;
          if (canal) f.canais.push({ c, l, canal: canal.canal });
          if (k === 'b' && cores[l] != null) (f.livros = f.livros || {})[`${c},${l}`] = cores[l];
        }
        if (f.grade[l][c] === k) tiles.push([c, l]);
      }
    }
    return { f, ok: tiles.length > 0, sel: it.tipo === 'bloco' ? Object.assign({}, it, { r: r2 }) : Object.assign({}, it, { tiles }) };
  },
  // Estante de novo no retângulo r2: a passagem embaixo (as fileiras que não estão cheias) continua do mesmo tamanho, a
  // não ser que o painel mande outra (o.passa); o livro-portão (portão L na passagem) vai para a penúltima coluna
  refazEstante(f, i, r2, o = {}) {
    const e = f.estantes[i], larg = e.c1 - e.c0 + 1;
    const cheia = (l) => f.grade[l].slice(e.c0, e.c1 + 1).every((t) => t === '#');
    let passa = 0;
    while (passa < e.l1 - e.l0 && !cheia(e.l1 - passa)) passa++;
    let livro = null;
    for (let l = e.l0; l <= e.l1 && !livro; l++) for (let c = e.c0; c <= e.c1; c++) if (f.grade[l][c] === 'L') { livro = { canal: f.canais.find((q) => q.c === c && q.l === l) }; break; }
    for (let l = e.l0; l <= e.l1; l++) for (let c = e.c0; c <= e.c1; c++) if (f.grade[l][c] === '#' || f.grade[l][c] === 'L') limpaBloco(f, c, l);
    Object.assign(e, r2);
    const alt = e.l1 - e.l0 + 1;
    passa = U.clamp(o.passa ?? passa, 0, alt - 1);
    const poeLivro = (o.livro ?? !!livro) && passa > 0;
    for (let l = e.l0; l <= e.l1 - passa; l++) for (let c = e.c0; c <= e.c1; c++) if (f.grade[l][c] === '.') f.grade[l][c] = '#';
    if (poeLivro) {
      const gc = e.c1 - e.c0 >= 1 ? e.c1 - 1 : e.c1;
      for (let l = e.l1 - passa + 1; l <= e.l1; l++) {
        if (f.grade[l][gc] !== '.') continue;
        f.grade[l][gc] = 'L';
        if (livro && livro.canal) f.canais.push({ c: gc, l, canal: livro.canal.canal });
      }
    }
    return larg;
  },
  // retângulo novo, puxando a alça a até o bloco b
  retEsticado(a, b) {
    const r = Object.assign({}, a.r0), h = a.alca, min = a.item.tipo === 'estante' ? 2 : 1;
    if (h.includes('w')) r.c0 = Math.min(Math.max(0, b.c), r.c1 - min + 1);
    if (h.includes('e')) r.c1 = Math.max(Math.min(this.cols - 1, b.c), r.c0 + min - 1);
    if (h.includes('n')) r.l0 = Math.min(Math.max(0, b.l), r.l1 - min + 1);
    if (h.includes('s')) r.l1 = Math.max(Math.min(this.lins - 1, b.l), r.l0 + min - 1);
    return r;
  },
  apagaItem(it) {
    const f = copiaFase(this.f);
    if (it.tipo === 'deco') f.decoracao.splice(it.i, 1);
    else if (it.tipo === 'peca') for (const [c, l] of it.tiles) limpaBloco(f, c, l);
    else {
      const r = this.retItem(it);
      for (let l = r.l0; l <= r.l1; l++) {
        for (let c = r.c0; c <= r.c1; c++) {
          const k = f.grade[l][c];
          if (it.tipo === 'area' || (it.tipo === 'bloco' && k === it.k) || (it.tipo === 'estante' && (k === '#' || k === 'L'))) limpaBloco(f, c, l);
        }
      }
      if (it.tipo === 'estante') f.estantes.splice(it.i, 1);
      if (it.tipo === 'area') {
        f.estantes = (f.estantes || []).filter((e) => !(noRet(r, e.c0, e.l0) && noRet(r, e.c1, e.l1)));
        f.decoracao = (f.decoracao || []).filter((d) => !noRet(r, Math.floor(d.x / TILE), Math.floor((d.y - 1) / TILE)));
      }
    }
    this.foto(); this.f = f; this.sel = null; this.mudou();
  },
  // muda a fase aberta com fn (para o painel): desfazer guarda o antes
  aplica(fn, sel = this.sel) {
    const f = copiaFase(this.f);
    if (fn(f) === false) return;
    this.foto(); this.f = f; this.sel = sel; this.mudou();
  },

  // ------------------------------------------------------------------ copiar e colar
  copia(it = this.sel) {
    if (!it) return false;
    const f = this.f;
    if (it.tipo === 'deco') { this.prancheta = { deco: Object.assign({}, f.decoracao[it.i]) }; return true; }
    const ret = this.retItem(it), r = it.tipo === 'estante' && ret.l0 > 0 ? Object.assign({}, ret, { l0: ret.l0 - 1 }) : ret;
    const meus = it.tipo === 'peca' ? new Set(it.tiles.map(([c, l]) => `${c},${l}`)) : null, tiles = [];
    for (let l = r.l0; l <= r.l1; l++) {
      for (let c = r.c0; c <= r.c1; c++) {
        const k = f.grade[l][c];
        const vai = it.tipo === 'area' ? true : it.tipo === 'peca' ? meus.has(`${c},${l}`) : it.tipo === 'bloco' ? k === it.k
          : l < ret.l0 ? k !== '.' && !TERRENO.includes(k) : k !== '.';
        if (!vai) continue;
        const q = f.canais.find((x) => x.c === c && x.l === l), car = (f.carimbos || []).find((x) => x.c === c && x.l === l);
        tiles.push({ dc: c - r.c0, dl: l - r.l0, k, canal: q && q.canal, ex: f.extras[`${c},${l}`], car: car && Object.assign({}, car), cor: (f.livros || {})[`${c},${l}`] });
      }
    }
    const est = (f.estantes || []).filter((e) => noRet(r, e.c0, e.l0) && noRet(r, e.c1, e.l1)).map((e) => desloca(e, -r.c0, -r.l0));
    const decos = it.tipo === 'area' ? (f.decoracao || []).filter((d) => noRet(r, Math.floor(d.x / TILE), Math.floor((d.y - 1) / TILE)))
      .map((d) => Object.assign({}, d, { x: d.x - r.c0 * TILE, y: d.y - r.l0 * TILE })) : [];
    this.prancheta = { w: r.c1 - r.c0 + 1, h: r.l1 - r.l0 + 1, tiles, est, decos, area: it.tipo === 'area', tipo: it.tipo, k: it.k };
    return true;
  },
  // a cópia cabe com o canto em (c, l)? (área: sempre, cobre o que houver; peça, bloco, estante: só no vazio)
  cabe(c, l) {
    const P = this.prancheta;
    if (c < 0 || l < 0 || c + P.w > this.cols || l + P.h > this.lins) return false;
    if (P.area) return true;
    return P.tiles.every((t) => t.k === '.' || '123S'.includes(t.k) || this.f.grade[l + t.dl][c + t.dc] === '.');
  },
  // cola com o canto de cima à esquerda no bloco (c, l); o enfeite, no x. Heróis e saída não se duplicam.
  cola(c, l, x) {
    const P = this.prancheta;
    if (!P) { this.msg('Nada copiado ainda: selecione e Ctrl+C.'); return; }
    if (P.deco) {
      const ch = this.chaoEm(x, l * TILE);
      if (ch == null) { this.msg('Sem chão ali embaixo para o enfeite.'); return; }
      const off = (P.deco.c || 'fundo') !== 'fundo' ? (ENFEITES[P.deco.p] || {}).dy || 90 : 0;
      const f = copiaFase(this.f);
      f.decoracao = f.decoracao || [];
      f.decoracao.push(Object.assign({}, P.deco, { x: Math.round(x / 5) * 5, y: ch + off }));
      this.foto(); this.f = f; this.sel = { tipo: 'deco', i: f.decoracao.length - 1 }; this.mudou();
      return;
    }
    if (!P.area && P.tiles.every((t) => '123S'.includes(t.k))) { this.msg('Herói e saída não se duplicam: cada fase tem um de cada (arraste para mudar de lugar).'); return false; }
    c = U.clamp(c, 0, this.cols - P.w); l = U.clamp(l, 0, this.lins - P.h);
    if (!this.cabe(c, l)) { this.msg('Ali não cabe: tem outra coisa no lugar. Ponha o mouse num lugar vazio.'); return false; }
    const f = copiaFase(this.f);
    let unicos = 0;
    for (const t of P.tiles) {
      if ('123S'.includes(t.k)) { unicos++; continue; }
      const nc = c + t.dc, nl = l + t.dl;
      if (t.k === '.' && !P.area) continue;
      limpaBloco(f, nc, nl);
      f.grade[nl][nc] = t.k;
      if (t.cor != null) (f.livros = f.livros || {})[`${nc},${nl}`] = t.cor;
      if (t.canal) f.canais.push({ c: nc, l: nl, canal: t.canal });
      if (t.ex) f.extras[`${nc},${nl}`] = Object.assign({}, t.ex, { x: t.ex.x != null ? nc * TILE + TILE / 2 : t.ex.x, y: t.ex.y != null ? (nl + 1) * TILE : t.ex.y });
      if (t.car) (f.carimbos = f.carimbos || []).push(Object.assign({}, t.car, { c: nc, l: nl }));
    }
    for (const e of P.est) (f.estantes = f.estantes || []).push(desloca(e, c, l));
    for (const d of P.decos) (f.decoracao = f.decoracao || []).push(Object.assign({}, d, { x: d.x + c * TILE, y: d.y + l * TILE }));
    this.foto(); this.f = f;
    // fica selecionada a coisa nova (do mesmo tipo da copiada)
    const r = { c0: c, c1: c + P.w - 1, l0: l, l1: l + P.h - 1 }, meus = P.tiles.filter((t) => t.k !== '.' && !'123S'.includes(t.k));
    if (P.tipo === 'bloco') this.sel = { tipo: 'bloco', k: P.k, r };
    else if (P.tipo === 'peca' && meus.length) this.sel = { tipo: 'peca', k: P.k, tiles: meus.map((t) => [c + t.dc, l + t.dl]) };
    else if (P.tipo === 'estante' && P.est.length) this.sel = { tipo: 'estante', i: f.estantes.length - 1 };
    else this.sel = { tipo: 'area', r };
    this.mudou();
    if (unicos) this.msg('Herói e saída não se duplicam: ficaram de fora da cópia.');
    return true;
  },
  // Ctrl+D: a cópia no lugar vazio mais perto (do lado, do outro lado, embaixo, em cima, cada vez mais longe)
  duplica(it = this.sel) {
    if (!it || !this.copia(it)) return;
    if (it.tipo === 'deco') { const d = this.f.decoracao[it.i]; this.cola(0, Math.floor((d.y - 1) / TILE), d.x + 80); return; }
    const r = this.retItem(it), P = this.prancheta, top = r.l0 - (P.h - (r.l1 - r.l0 + 1));
    for (let d = 0; d < 12; d++) {
      for (const [c, l] of [[r.c1 + 1 + d, top], [r.c0 - P.w - d, top], [r.c0, r.l1 + 1 + d], [r.c0, top - P.h - d]]) {
        if (this.cabe(c, l)) { this.cola(c, l); return; }
      }
    }
    this.msg('Não achei lugar vazio perto para a cópia: copie (Ctrl+C) e cole (Ctrl+V) onde quiser.');
  },

  // ------------------------------------------------------------------ mouse
  alcaEm(b) {
    const it = this.sel;
    if (!it || !this.itemValido(it) || !this.estica(it)) return null;
    for (const [nome, x, y] of this.alcas(it)) {
      const V = this.vista, sx = (x - V.x) * V.z, sy = (y - V.y) * V.z;
      if (Math.abs(sx - b.mx) <= ALCA + 3 && Math.abs(sy - b.my) <= ALCA + 3) return nome;
    }
    return null;
  },
  alcas(it, f = this.f) {
    const k = this.caixaItem(it, f);
    if (!k) return [];
    const mx = (k.x0 + k.x1) / 2, my = (k.y0 + k.y1) / 2;
    const cantos = [['nw', k.x0, k.y0], ['ne', k.x1, k.y0], ['sw', k.x0, k.y1], ['se', k.x1, k.y1]];
    return this.estica(it) === 'canto' ? cantos : [...cantos, ['n', mx, k.y0], ['s', mx, k.y1], ['w', k.x0, my], ['e', k.x1, my]];
  },
  selDown(b, e) {
    const apaga = e.button === 2;
    const h = !apaga && this.alcaEm(b);
    if (h) {
      const it = this.sel;
      this.arrasto = { sel: true, modo: 'estica', alca: h, item: it, ini: b, fim: b, r0: it.tipo === 'deco' ? null : Object.assign({}, this.retItem(it)) };
      return;
    }
    const caixa = this.sel && this.itemValido(this.sel) && this.caixaItem(this.sel);
    const noSel = caixa && b.wx >= caixa.x0 && b.wx <= caixa.x1 && b.wy >= caixa.y0 && b.wy <= caixa.y1;
    const it = noSel ? this.sel : this.itemEm(b);
    if (apaga) { // direito: tira a peça, o enfeite ou a estante; no terreno, só aquele bloco (como a borracha)
      if (!it) return;
      if (it.tipo === 'bloco' || it.tipo === 'area') { this.foto(); this._troca(b.c, b.l, '.'); this.sel = null; this.mudou(); }
      else this.apagaItem(it);
      return;
    }
    if (it) {
      this.sel = it; this.mostraSel();
      this.arrasto = { sel: true, modo: 'move', item: it, ini: b, fim: b };
      this.gv.style.cursor = 'grabbing';
    } else {
      this.sel = null; this.mostraSel();
      if (b.dentro) this.arrasto = { sel: true, modo: 'banda', ini: b, fim: b };
    }
    this.pede();
  },
  selMove(b) {
    const a = this.arrasto;
    a.fim = b;
    if (a.modo === 'banda') { this.pede(); return; }
    const it = a.item, deco = it.tipo === 'deco';
    let chave, res = null;
    if (a.modo === 'move') {
      const dc = b.c - a.ini.c, dl = b.l - a.ini.l, dx = Math.round((b.wx - a.ini.wx) / 5) * 5, dy = b.wy - a.ini.wy;
      chave = deco ? `${dx}|${Math.floor((this.f.decoracao[it.i].y + dy - 1) / TILE)}` : `${dc}|${dl}`;
      if (chave === a.chave) { this.pede(); return; }
      if (deco) {
        const d0 = this.f.decoracao[it.i], off = (d0.c || 'fundo') !== 'fundo' ? (ENFEITES[d0.p] || {}).dy || 90 : 0;
        res = (dx || Math.abs(dy) > 20) ? this.opMove(it, 0, 0, dx, d0.y - off + dy - 1) : null;
      } else res = dc || dl ? this.opMove(it, dc, dl) : null;
    } else if (deco) { // alça do enfeite: a altura vai até o mouse (a base fica)
      const k = this.caixaItem(it), alt = Math.round(U.clamp(k.y1 - b.wy, 30, 700));
      chave = `${alt}`;
      if (chave === a.chave) { this.pede(); return; }
      const f = copiaFase(this.f);
      f.decoracao[it.i].a = alt;
      res = { f, ok: true, sel: it };
    } else {
      const r2 = this.retEsticado(a, b);
      chave = `${r2.c0}|${r2.c1}|${r2.l0}|${r2.l1}`;
      if (chave === a.chave) { this.pede(); return; }
      const r0 = a.r0, igual = r2.c0 === r0.c0 && r2.c1 === r0.c1 && r2.l0 === r0.l0 && r2.l1 === r0.l1;
      res = igual ? null : this.opEstica(it, r2);
    }
    a.chave = chave; a.res = res;
    this.previa = res && res.ok && !res.semMudar ? { f: res.f } : null;
    this.pede();
  },
  selUp(a) {
    this.previa = null;
    if (a.modo === 'banda') {
      const r = this.retDe(a.ini, a.fim);
      this.sel = r.c0 === r.c1 && r.l0 === r.l1 ? null : { tipo: 'area', r };
      this.mostraSel();
      return;
    }
    const r = a.res;
    if (!r) return; // (só clicou: fica selecionado)
    if (!r.ok) { this.msg(a.modo === 'move' ? 'Ali não cabe: tem outra coisa no lugar (o contorno fica vermelho). Solte num lugar vazio.' : 'Não dá para esse tamanho.'); this.mostraSel(); return; }
    if (r.semMudar) { this.sel = r.sel; this.mostraSel(); return; }
    this.foto(); this.f = r.f; this.sel = r.sel; this.mudou();
  },
  // com a peça de pintar (ou um enfeite) na mão: a fase como fica se clicar aqui
  previaPinta(b) {
    const k = this.peca;
    if (k === 'mover' || k === 'sala' || k === 'estante' || this.modoDaqui || !b.dentro) { this.previa = null; return; }
    if (k.startsWith('deco:')) {
      const x = Math.round(b.wx / 10) * 10, chave = `${k}|${x}|${b.l}`;
      if (this.previa && this.previa.chave === chave) return;
      const p = k.slice(5), E = ENFEITES[p], ch = this.chaoEm(x, b.wy);
      if (ch == null) { this.previa = null; return; }
      const f = copiaFase(this.f);
      (f.decoracao = f.decoracao || []).push({ p, x, y: ch + (E.dy || 0), a: E.a, c: E.c || 'fundo' });
      this.previa = { f, chave };
      return;
    }
    const chave = `${k}|${b.c}|${b.l}|${this.canal}`;
    if (this.previa && this.previa.chave === chave) return;
    const f = copiaFase(this.f), real = this.f;
    this.f = f;
    let mudou = false;
    try { mudou = this.poe(b.c, b.l, k); } finally { this.f = real; }
    this.previa = mudou ? { f, chave } : null;
  },

  // ------------------------------------------------------------------ teclado
  selTecla(e) {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (k === '?' || (e.key === 'F1')) { this.ajuda(); return true; }
    if (ctrl && k === 'v') { const m = this.mouse; if (m) this.cola(m.c, m.l, m.wx); else this.msg('Ponha o mouse onde colar e Ctrl+V.'); return true; }
    if (this.peca !== 'mover') return false;
    const it = this.sel && this.itemValido(this.sel) ? this.sel : null;
    if (e.key === 'Escape' && (it || this.modoDaqui)) { this.sel = null; this.modoDaqui = false; this.mostraSel(); this.pede(); return true; }
    if (!it) return false;
    if (ctrl && k === 'c') { this.copia(it); this.msg('Copiado: ponha o mouse onde quer e Ctrl+V.'); return true; }
    if (ctrl && k === 'd') { this.duplica(it); return true; }
    if (ctrl) return false;
    if (e.key === 'Delete' || e.key === 'Backspace') { this.apagaItem(it); return true; }
    const seta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (seta) {
      let r;
      if (it.tipo === 'deco') {
        if (!seta[0]) return true;
        const d = this.f.decoracao[it.i], off = (d.c || 'fundo') !== 'fundo' ? (ENFEITES[d.p] || {}).dy || 90 : 0;
        r = this.opMove(it, 0, 0, seta[0] * 10, d.y - off - 1);
      } else r = this.opMove(it, seta[0], seta[1]);
      if (r.ok) { this.foto(); this.f = r.f; this.sel = r.sel; this.mudou(); } else this.msg('Ali não cabe.');
      return true;
    }
    if (k === 'f') { this.vira(it); return true; }
    if ((e.key === '+' || e.key === '=' || e.key === '-') && it.tipo === 'deco') {
      const q = e.key === '-' ? 1 / 1.1 : 1.1;
      this.aplica((f) => { const d = f.decoracao[it.i]; d.a = Math.round(U.clamp(d.a * q, 30, 700)); });
      return true;
    }
    return false;
  },
  // vira o enfeite ou o inimigo (para que lado olha)
  vira(it) {
    if (it.tipo === 'deco') { this.aplica((f) => { const d = f.decoracao[it.i]; if (d.e) delete d.e; else d.e = 1; }); return; }
    if (it.tipo !== 'peca') return;
    const [c, l] = it.tiles[0], par = { q: 'Q', Q: 'q', v: 'V', V: 'v' }[it.k]; // grampeador e gangorra: a outra letra
    if (par) { this.aplica((f) => { f.grade[l][c] = par; }, Object.assign({}, it, { k: par })); return; }
    if (!ESPECIES[it.k]) return;
    this.aplica((f) => { const x = f.extras[`${c},${l}`] || (f.extras[`${c},${l}`] = {}); x.f = (x.f ?? -1) > 0 ? -1 : 1; });
  },

  // Alcance do inimigo (30/09, usuário: "quando eu clicar no personagem, aparecer o range de ação dele"): por onde ele
  // anda (amarelo: até o "anda até", a parede ou a beirada, como no jogo) e onde ele ataca (vermelho: o que ele vê e
  // até onde chega o golpe) — com as mesmas medidas do jogo (ESTOCADA, TESOURA, LIXEIRA, o grampo)
  alcanceInimigo(g, z, it, f = this.f, fraco = false) {
    const [c, l] = it.tiles[0], esp = ESPECIES[it.k], ex = f.extras[`${c},${l}`] || {}, cfg = CFG_INIMIGO[esp];
    const n = (this.previa && this.previa.cena ? this.previa.cena : this.cena).nivel;
    const x = ex.x ?? c * TILE + TILE / 2, y = ex.y ?? (l + 1) * TILE, olha = it.k === 'Q' ? 1 : it.k === 'q' ? -1 : ex.f ?? -1;
    const A = fraco ? 0.55 : 1;
    // da frente do corpo para o lado s, até max: para na parede ou na beirada (sem parede: até a parede, o que for)
    const ate = (s, max, beirada = true) => {
      let d = 0;
      while (d < max) {
        const fr = x + s * (d + cfg.w / 2 + 4);
        if (n.solidoEm(fr, y - 10) || n.solidoEm(fr, y - cfg.h + 10) || (beirada && !n.solidoEm(fr, y + 4) && n.rampaEntre(fr, y - 2, y + TILE) == null)) break;
        d += 4;
      }
      return d;
    };
    const faixa = (x0, x1, y0, y1, cor) => { g.fillStyle = cor; g.fillRect(x0, y0, x1 - x0, y1 - y0); };
    const rotulo = (txt, x0, y0, cor) => {
      g.font = `${13 / z}px ${FONTE_FALA}`; g.fillStyle = cor; g.textBaseline = 'bottom'; g.fillText(txt, x0, y0); g.textBaseline = 'alphabetic';
    };
    const vermelho = `rgba(226,67,58,${0.2 * A})`, linhaV = `rgba(190,40,35,${0.9 * A})`, amarelo = `rgba(255,210,63,${0.9 * A})`;
    let a0 = x, a1 = x;
    if (cfg.vel > 0) { // anda: a faixa amarela no pé, com as pontas
      const alc = ex.alcance ?? 170;
      a0 = x - ate(-1, alc); a1 = x + ate(1, alc);
      g.strokeStyle = amarelo; g.lineWidth = 6 / z; g.lineCap = 'round';
      g.beginPath(); g.moveTo(a0, y - 3); g.lineTo(a1, y - 3); g.moveTo(a0, y - 18); g.lineTo(a0, y + 8); g.moveTo(a1, y - 18); g.lineTo(a1, y + 8); g.stroke();
      rotulo('anda', a0, y - 22 / z, amarelo);
    }
    if (esp === 'guarda') { // vê na frente (para onde estiver indo) e estoca com o lápis
      const v = ESTOCADA.ve;
      faixa(a0 - v, a1 + v, y - 80, y, vermelho);
      rotulo(`vê ${v} px e estoca ${ESTOCADA.alcance}`, a0 - v, y - 84, linhaV);
    } else if (esp === 'tesoureiro') { // vira de um lado para o outro; viu, corre até a parede
      const v = TESOURA.ve, ce = ate(-1, 3000, false), cd = ate(1, 3000, false);
      faixa(x - Math.min(v, ce + cfg.w / 2), x + Math.min(v, cd + cfg.w / 2), y - 80, y, vermelho);
      g.setLineDash([10 / z, 7 / z]); g.strokeStyle = linhaV; g.lineWidth = 3 / z;
      g.beginPath(); g.moveTo(x - ce - cfg.w / 2, y - 48); g.lineTo(x + cd + cfg.w / 2, y - 48); g.stroke(); g.setLineDash([]);
      rotulo(`vê ${v} px; corre até a parede`, x - Math.min(v, ce), y - 84, linhaV);
    } else if (esp === 'grampeador') { // o grampo vai reto para a frente até a parede (ou some a 532 px)
      const d = ate(olha, 380 * 1.4, false), x0 = x + olha * 40, x1 = x + olha * (d + cfg.w / 2);
      g.strokeStyle = linhaV; g.lineWidth = 4 / z;
      g.beginPath(); g.moveTo(x0, y - 18); g.lineTo(x1, y - 18); g.lineTo(x1 - olha * 12, y - 26); g.moveTo(x1, y - 18); g.lineTo(x1 - olha * 12, y - 10); g.stroke();
      rotulo('atira', Math.min(x0, x1), y - 30, linhaV);
    } else if (esp === 'lixeira') { // joga em arco em quem está embaixo dela, até 280 px para cada lado
      const v = LIXEIRA.ve;
      faixa(x - v, x + v, y - 40, y + 8 * TILE, vermelho);
      rotulo(`joga em quem está aqui embaixo (até ${v} px), se a bolinha chega`, x - v, y - 44, linhaV);
    } else if (esp === 'escudeiro') rotulo('empurra com a régua', a0, y - 40 / z, linhaV);
  },

  // ------------------------------------------------------------------ desenho da seleção (na camada de cima)
  selGuia(g, z) {
    const a = this.arrasto, m = this.mouse;
    const contorno = (k, cor, traco) => {
      g.setLineDash(traco ? [8 / z, 6 / z] : []); g.strokeStyle = cor; g.lineWidth = 3 / z;
      g.strokeRect(k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0); g.setLineDash([]);
    };
    const etiqueta = (txt, x, y) => {
      g.font = `${14 / z}px ${FONTE_FALA}`;
      const w = g.measureText(txt).width + 12 / z, h = 20 / z;
      g.fillStyle = 'rgba(43,31,46,0.88)'; g.beginPath(); g.roundRect(x, y - h, w, h, 5 / z); g.fill();
      g.fillStyle = '#fffdf6'; g.textBaseline = 'middle'; g.fillText(txt, x + 6 / z, y - h / 2 + 1 / z); g.textBaseline = 'alphabetic';
    };
    // passando o mouse: o que o clique pega
    if (!a && m && !this.modoDaqui) {
      const it = this.itemEm(m);
      if (it && !(this.sel && JSON.stringify(it) === JSON.stringify(this.sel))) {
        const k = this.caixaItem(it);
        if (it.tipo === 'peca' && ESPECIES[it.k]) this.alcanceInimigo(g, z, it, this.f, true);
        if (k) { contorno(k, 'rgba(255,253,246,0.75)', true); etiqueta(this.nomeItem(it), k.x0, k.y0 - 4 / z); }
      }
    }
    if (this.modoDaqui && m) { g.fillStyle = 'rgba(63,181,106,0.35)'; g.fillRect((m.c - 1) * TILE, m.l * TILE, 3 * TILE, TILE); }
    if (a && a.sel && a.modo === 'banda') {
      const r = this.retDe(a.ini, a.fim);
      g.fillStyle = 'rgba(255,253,246,0.14)'; g.fillRect(r.c0 * TILE, r.l0 * TILE, (r.c1 - r.c0 + 1) * TILE, (r.l1 - r.l0 + 1) * TILE);
      contorno({ x0: r.c0 * TILE, y0: r.l0 * TILE, x1: (r.c1 + 1) * TILE, y1: (r.l1 + 1) * TILE }, '#fffdf6', true);
      return;
    }
    let it = this.sel && this.itemValido(this.sel) ? this.sel : null;
    if (!it) return;
    // arrastando: a seleção vai junto (onde não cabe, o contorno no destino fica vermelho)
    let f = this.f;
    if (a && a.sel && a.res && a.res.ok) { it = a.res.sel; f = a.res.f; }
    let k = this.caixaItem(it, f);
    if (a && a.sel && a.modo === 'move' && a.res && !a.res.ok && it.tipo !== 'deco') {
      const dc = a.fim.c - a.ini.c, dl = a.fim.l - a.ini.l;
      const r = desloca(this.retItem(it), dc, dl);
      g.fillStyle = 'rgba(226,67,58,0.22)'; g.fillRect(r.c0 * TILE, r.l0 * TILE, (r.c1 - r.c0 + 1) * TILE, (r.l1 - r.l0 + 1) * TILE);
      contorno({ x0: r.c0 * TILE, y0: r.l0 * TILE, x1: (r.c1 + 1) * TILE, y1: (r.l1 + 1) * TILE }, '#e2433a', false);
    }
    if (!k) return;
    if (it.tipo === 'peca' && ESPECIES[it.k]) this.alcanceInimigo(g, z, it, f);
    contorno(k, it.tipo === 'area' ? '#fffdf6' : '#ffd23f', it.tipo === 'area');
    etiqueta(this.nomeItem(it, f), k.x0, k.y0 - 4 / z);
    if (this.estica(it) && !(a && a.modo === 'move')) {
      for (const [, x, y] of this.alcas(it, f)) {
        const s = ALCA / z;
        g.fillStyle = '#fffdf6'; g.strokeStyle = '#2b1f2e'; g.lineWidth = 2 / z;
        g.fillRect(x - s, y - s, 2 * s, 2 * s); g.strokeRect(x - s, y - s, 2 * s, 2 * s);
      }
    }
  },

  // ------------------------------------------------------------------ painel "Selecionado"
  mostraSel() {
    const box = document.getElementById('sel-info');
    if (!box) return;
    box.innerHTML = '';
    const it = this.peca === 'mover' && this.sel && this.itemValido(this.sel) ? this.sel : null;
    const p = (txt) => { const e = document.createElement('p'); e.textContent = txt; box.appendChild(e); return e; };
    if (!it) {
      p(this.peca === 'mover'
        ? 'Nada. Clique numa peça, num bloco (a prateleira inteira), na estante ou num enfeite. Arraste no vazio para pegar uma área.'
        : 'Com uma peça na mão, a fase mostra onde ela vai ficar antes do clique. Esc volta para Selecionar.');
      return;
    }
    const f = this.f, h = document.createElement('div'); h.className = 'sel-nome'; h.textContent = this.nomeItem(it); box.appendChild(h);
    const linha = () => { const d = document.createElement('div'); d.className = 'linha'; box.appendChild(d); return d; };
    const botao = (pai, txt, fn, titulo) => { const b = document.createElement('button'); b.textContent = txt; if (titulo) b.title = titulo; b.onclick = fn; pai.appendChild(b); return b; };
    const numero = (rot, val, min, max, fn, passo = 1) => {
      const l = document.createElement('label'); l.className = 'linha campo'; l.textContent = rot;
      const i = document.createElement('input'); i.type = 'number'; i.min = min; i.max = max; i.step = passo; i.value = val;
      i.onchange = () => { const v = parseFloat(i.value); if (Number.isFinite(v)) fn(U.clamp(v, min, max)); };
      l.appendChild(i); box.appendChild(l); return i;
    };
    const escolha = (rot, opcoes, val, fn) => {
      const l = document.createElement('label'); l.className = 'linha campo'; l.textContent = rot;
      const s = document.createElement('select');
      for (const [v, t] of opcoes) { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === val) o.selected = true; s.appendChild(o); }
      s.onchange = () => fn(s.value);
      l.appendChild(s); box.appendChild(l); return s;
    };
    const marca = (rot, val, fn) => {
      const l = document.createElement('label'); l.className = 'linha campo';
      const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!val; i.onchange = () => fn(i.checked);
      l.append(i, ` ${rot}`); box.appendChild(l); return i;
    };
    if (it.tipo === 'peca') {
      const [c, l] = it.tiles[0], ex = f.extras[`${c},${l}`] || {};
      p(`Coluna ${c}, linha ${l}${it.tiles.length > 1 ? ` (${it.tiles.length} blocos)` : ''}. Arraste para mudar de lugar${this.estica(it) ? '; as alças mudam o tamanho' : ''}.`);
      if (COM_CANAL.includes(it.k)) {
        const q = f.canais.find((x) => x.c === c && x.l === l);
        const ops = [['', 'padrão'], ...CANAIS_ED.map((k) => [k, `canal ${k.slice(1)}`])];
        escolha('Canal (quem abre o quê)', ops, q ? q.canal : '', (v) => this.aplica((g) => {
          for (const [cc, ll] of it.tiles) { g.canais = g.canais.filter((x) => x.c !== cc || x.l !== ll); if (v) g.canais.push({ c: cc, l: ll, canal: v }); }
        }));
      }
      if (ESPECIES[it.k]) {
        const olha = it.k === 'Q' ? 1 : it.k === 'q' ? -1 : ex.f ?? -1;
        const d = linha(); d.append('Olhando para ');
        botao(d, olha < 0 ? '◀ esquerda' : 'direita ▶', () => this.vira(it), 'Vira (tecla F)');
        if (!'qQj'.includes(it.k)) {
          numero('Anda até (px de cada lado)', ex.alcance ?? 150, 0, 2000, (v) => this.aplica((g) => {
            const x = g.extras[`${c},${l}`] || (g.extras[`${c},${l}`] = {}); x.alcance = v;
          }), 10);
        }
      }
      if (it.k === 'v' || it.k === 'V') {
        const d = linha(); d.append('Ponta de baixo: ');
        botao(d, it.k === 'v' ? '◀ esquerda' : 'direita ▶', () => this.vira(it), 'Vira (tecla F)');
      }
      if (it.k === 'c') {
        const q = (f.carimbos || []).find((x) => x.c === c && x.l === l) || {};
        const muda = (campo, v) => this.aplica((g) => {
          g.carimbos = g.carimbos || [];
          let k = g.carimbos.find((x) => x.c === c && x.l === l);
          if (!k) { k = { c, l }; g.carimbos.push(k); }
          k[campo] = v;
        });
        numero('Ritmo (segundos por descida)', q.ritmo ?? CARIMBO.ritmo, 0.8, 10, (v) => muda('ritmo', v), 0.1);
        numero('Começa em (0 a 1 do ritmo)', q.fase ?? 0, 0, 0.99, (v) => muda('fase', v), 0.05);
      }
    } else if (it.tipo === 'bloco') {
      const r = it.r;
      p(`${r.c1 - r.c0 + 1} × ${r.l1 - r.l0 + 1} blocos, da coluna ${r.c0} à ${r.c1}. Arraste para mover; as alças mudam o tamanho.`);
      escolha('Tipo', TIPOS_BLOCO, it.k, (v) => this.aplica((g) => {
        for (let l = r.l0; l <= r.l1; l++) for (let c = r.c0; c <= r.c1; c++) if (g.grade[l][c] === it.k) g.grade[l][c] = v;
      }, Object.assign({}, it, { k: v })));
      if (it.k === 'b') { // a cor de cada livro (cada fileira), de cima para baixo, ou de todos
        const pinta = (l0, l1, cor) => this.aplica((g) => {
          g.livros = g.livros || {};
          for (let l = l0; l <= l1; l++) for (let c = r.c0; c <= r.c1; c++) if (g.grade[l][c] === 'b') { if (cor == null) delete g.livros[`${c},${l}`]; else g.livros[`${c},${l}`] = cor; }
        });
        const amostras = (rot, l0, l1) => {
          const d = linha(); d.append(rot);
          const atual = (f.livros || {})[`${r.c0},${l0}`];
          for (const [i, [cor, nome]] of [[null, ['', '?']], ...CORES_LIVRO.map((q, j) => [j, q])]) {
            const b = botao(d, nome === '?' ? '?' : '', () => pinta(l0, l1, i), nome === '?' ? 'sorteada' : nome);
            b.className = 'amostra'; if (cor) b.style.background = cor;
            if ((atual ?? null) === i && l0 === l1) b.classList.add('sel');
          }
        };
        if (r.l1 > r.l0) amostras('Todos ', r.l0, r.l1);
        for (let l = r.l0; l <= r.l1; l++) amostras(r.l1 > r.l0 ? `Livro ${l - r.l0 + 1} ` : 'Cor ', l, l);
      }
    } else if (it.tipo === 'estante') {
      const e = f.estantes[it.i], alt = e.l1 - e.l0 + 1;
      const cheia = (l) => f.grade[l].slice(e.c0, e.c1 + 1).every((t) => t === '#');
      let passa = 0;
      while (passa < e.l1 - e.l0 && !cheia(e.l1 - passa)) passa++;
      let livro = false;
      for (let l = e.l0; l <= e.l1; l++) for (let c = e.c0; c <= e.c1; c++) if (f.grade[l][c] === 'L') livro = true;
      p(`${e.c1 - e.c0 + 1} × ${alt} blocos. Arraste para mover (o que está em cima vai junto); as alças mudam o tamanho.`);
      numero('Passagem embaixo (blocos de altura)', passa, 0, alt - 1, (v) => this.aplica((g) => { this.refazEstante(g, it.i, g.estantes[it.i], { passa: v }); }));
      numero('Altura de cada andar (blocos)', e.andar || 3, 2, 6, (v) => this.aplica((g) => { g.estantes[it.i].andar = v; }));
      p('Os andares têm todos essa altura, contados de baixo para cima; o de cima fica com o que sobrar (sobrando 1 bloco, vira o tampo).');
      marca('Livro-portão na passagem (abre com a alavanca)', livro, (v) => this.aplica((g) => {
        this.refazEstante(g, it.i, g.estantes[it.i], { livro: v, passa: v && !passa ? Math.min(4, alt - 1) : undefined });
      }));
    } else if (it.tipo === 'deco') {
      const d = f.decoracao[it.i];
      p('Arraste para mudar de lugar (pousa no chão embaixo); as alças dos cantos mudam o tamanho. Só desenho: ninguém pisa.');
      escolha('Enfeite', Object.keys(ENFEITES).map((k) => [k, k]), d.p, (v) => this.aplica((g) => {
        const q = g.decoracao[it.i], E = ENFEITES[v];
        const chao = q.y - ((q.c || 'fundo') !== 'fundo' ? (ENFEITES[q.p] || {}).dy || 90 : 0);
        Object.assign(q, { p: v, a: E.a, c: E.c || 'fundo', y: chao + (E.dy || 0) });
      }));
      numero('Altura (px)', d.a, 30, 700, (v) => this.aplica((g) => { g.decoracao[it.i].a = v; }), 10);
      marca('Virado (espelho)', d.e, () => this.vira(it));
    } else {
      const r = it.r;
      p(`${r.c1 - r.c0 + 1} × ${r.l1 - r.l0 + 1} blocos. Arraste para levar tudo (cobre o que estiver lá); as alças mudam a área.`);
      const d = linha();
      const enche = (k) => this.aplica((g) => {
        for (let l = r.l0; l <= r.l1; l++) for (let c = r.c0; c <= r.c1; c++) { limpaBloco(g, c, l); if (k) g.grade[l][c] = k; }
      });
      botao(d, 'Encher: papelão', () => enche('#'));
      botao(d, 'Encher: livros', () => enche('b'));
      botao(d, 'Esvaziar', () => enche(null));
    }
    const d = linha();
    botao(d, 'Duplicar', () => this.duplica(it), 'Ctrl+D');
    botao(d, 'Copiar', () => { this.copia(it); this.msg('Copiado: ponha o mouse onde quer e Ctrl+V.'); }, 'Ctrl+C (cola com Ctrl+V onde estiver o mouse)');
    botao(d, 'Apagar', () => this.apagaItem(it), 'Delete');
  },

  // ------------------------------------------------------------------ jogar daqui e ajuda
  jogarDaqui() {
    if (this.faltaHeroi) { this.msg('Para jogar, a fase precisa dos três heróis (1, 2 e 3).'); return; }
    this.escolhe('mover');
    this.modoDaqui = true;
    this.gv.style.cursor = 'cell';
    this.msg('Clique no chão onde os três heróis começam (botão direito cancela).');
  },
  jogaDaqui(b) {
    this.modoDaqui = false;
    this.gv.style.cursor = 'default';
    const ch = b.dentro ? this.chaoEm(b.wx, b.wy) : null;
    if (ch == null) { this.msg('Clique em cima de um chão.'); return; }
    const f = copiaFase(this.f), l = ch / TILE - 1, livres = [];
    for (const row of f.grade) for (let i = 0; i < row.length; i++) if ('123'.includes(row[i])) row[i] = '.';
    const pisa = (c) => c >= 0 && c < this.cols && l >= 0 && f.grade[l][c] === '.' && '#CFb'.includes(f.grade[l + 1][c]);
    for (let d = 0; d < 6 && livres.length < 3; d++) for (const c of d ? [b.c - d, b.c + d] : [b.c]) if (livres.length < 3 && pisa(c)) livres.push(c);
    if (livres.length < 3) { this.msg('Não cabem os três ali: escolha um chão mais largo.'); return; }
    livres.sort((x, y) => x - y).forEach((c, i) => { f.grade[l][c] = '312'[i]; });
    const def = this.paraDef(f);
    delete def.roteiro;
    if (!guarda(CHAVE_JOGAR, JSON.stringify(def))) { this.msg('O navegador não deixou guardar a fase para o jogo (localStorage bloqueado).'); return; }
    this.guardaRascunho(); // (volta para esta fase, com os heróis onde estavam)
    location.href = 'index.html?fase=~';
  },
  ajuda() { document.getElementById('dlg-ajuda').showModal(); },
});
