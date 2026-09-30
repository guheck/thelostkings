'use strict';

// Editor de fases (editor.html): pinta a grade de letras do nivel.js — um caractere por bloco de 40 px — vendo o
// desenho do jogo. Abre sala do tutorial, fase gerada (número + semente, para retocar) ou fase salva (fases/*.json).
// Salvar guarda em Minhas fases (src/minhas.js: neste navegador, com o nome dado; aparecem no menu do jogo, também no
// publicado) e, no PC, também pelo servidor local (tools/serve.js: POST /api/fase -> fases/<id>.json). ▶ Jogar testa
// na mesma aba (index.html?fase=~: a que está aberta aqui, passada pelo localStorage; o Esc de lá volta ao editor).
// Tudo o que muda fica no rascunho: sair e voltar não perde nada. Fase gerada ou do tutorial vem com o roteiro do
// robô: "Robô testa" confere se o retoque não quebrou a solução (fase feita do zero não tem roteiro: testa jogando).
// Na URL: ?minha=id (Minhas fases), ?abre=nome (fases/nome.json), ?gerada=6&semente=7, ?tutorial=2, ?nova (em branco)
// — sem nada, volta o rascunho.

const GRUPOS = [
  ['Ferramentas', [['.', 'Apagar'], ['sala', 'Sala (papel de parede): arraste um retângulo; botão direito dentro apaga']]],
  ['Blocos', [['#', 'Papelão'], ['C', 'Parede fraca (papelão remendado) — o soco do Marreta quebra'], ['F', 'Folha de papel — a bundada do Pudim rasga'],
    ['^', 'Lápis — machuca'], ['H', 'Escada de palitos (1 bloco de largura: só o Fiapo cabe)'],
    ['/', 'Rampa subindo para a direita (emende na diagonal para rampa longa)'], ['\\', 'Rampa subindo para a esquerda']]],
  ['Pisos', [['k', 'Cola (no bloco em cima do chão): anda devagar e não pula; inimigo e bola do Pudim grudam'],
    ['w', 'Corretivo (no bloco em cima do chão): escorrega — embalado, não freia nem vira']]],
  ['Corda', [['T', 'Tachinha — o Fiapo amarra a corda'], ['r', 'Rolo de barbante — mais uma corda para o Fiapo']]],
  ['Objetos', [['d', 'Rolo de durex — empurra; o soco do Marreta ou a bola do Pudim manda rolando (boliche); degrau; segura a placa'],
    ['v', 'Régua-gangorra (no bloco do calço), ponta esquerda embaixo — quem cai na ponta de cima lança quem está na outra; a bundada do Pudim lança o Fiapo alto'],
    ['V', 'Régua-gangorra, ponta direita embaixo'],
    ['n', 'Post-it colado no fundo (a dobra é um degrau na linha de baixo do bloco) — pisou, treme, cai e volta piscando; de 3 em 3 blocos só o Fiapo sobe'],
    ['c', 'Carimbo (no bloco logo abaixo de um teto) — desce até o chão num ritmo; encostar machuca, inimigo embaixo é achatado. Com 6 blocos de vão todos passam por baixo no tempo certo']]],
  ['Botões e portões', [['B', 'Botão pesado — só o Pudim, fica apertado'], ['p', 'Placa — só enquanto alguém pisa'], ['l', 'Alavanca'],
    ['G', 'Portão do botão'], ['P', 'Portão da placa'], ['L', 'Portão da alavanca']]],
  ['Chaves e portas', [['x', 'Chave vermelha'], ['y', 'Chave azul'], ['z', 'Chave amarela'],
    ['X', 'Porta vermelha'], ['Y', 'Porta azul'], ['Z', 'Porta amarela']]],
  ['Inimigos', [['g', 'Guarda — lança de lápis'], ['e', 'Escudeiro — régua de escudo'], ['o', 'Borracha'],
    ['q', 'Grampeador olhando para a esquerda'], ['Q', 'Grampeador olhando para a direita'],
    ['j', 'Lixeira — joga bolinha de papel em arco; o soco na hora certa rebate (CESTA!). Ponha no alto'],
    ['u', 'Tesoureiro — de guarda; viu, corre sem frear: crava na parede, gruda na cola, cai no buraco, corta corda']]],
  ['Heróis e saída', [['1', 'Marreta'], ['2', 'Fiapo'], ['3', 'Pudim'], ['S', 'Saída (2 × 3 blocos; o clique é o canto de baixo à esquerda)']]],
];
const NOME_PECA = Object.fromEntries(GRUPOS.flatMap((g) => g[1]));
const CANAIS_ED = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'];
const COM_CANAL = 'BplGPL';
const LETRA_ESPECIE = { guarda: 'g', escudeiro: 'e', borracha: 'o', lixeira: 'j', tesoureiro: 'u' }; // grampeador: q (←) ou Q (→)
const OPS_X = { anda: [1], vai: [1], rola: [1], soca: [1, 2], bundada: [1, 2], rolaEm: [1, 2], rebate: [1, 2] }; // comandos do robô com x
const CHAVE_JOGAR = 'lostkings-editor', CHAVE_RASCUNHO = 'lostkings-editor-rascunho';
const guarda = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
// Confirmação no próprio botão: o 1º clique troca o texto (por 3 s), o 2º confirma — confirm() não aparece no claude.ai
const certeza = (b, pergunta) => {
  if (b.dataset.certeza) { clearTimeout(+b.dataset.certeza); delete b.dataset.certeza; b.textContent = b.dataset.texto; return true; }
  b.dataset.texto = b.textContent; b.textContent = pergunta;
  b.dataset.certeza = setTimeout(() => { delete b.dataset.certeza; b.textContent = b.dataset.texto; }, 3000);
  return false;
};
const le = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

// Mapa pequeno para o ícone de cada peça na paleta (a peça em pé num chão)
function miniMapa(k) {
  if (k === 'S') return ['....', '.SS.', '.SS.', '.SS.', '####'];
  if ('123geoqQj'.includes(k)) return ['...', '...', '...', `.${k}.`, '###'];
  if (k === '^') return ['...', '...', '#^#'];
  if (k === 'H') return ['#H#', '.H.', '.H.', '###'];
  if (k === 'F') return ['...', '#F#', '...'];
  if (k === 'k' || k === 'w') return ['...', k.repeat(3), '###'];
  if (k === 'd') return ['...', '...', '.d.', '###'];
  if (k === 'v' || k === 'V') return ['.......', '.......', `...${k}...`, '#######'];
  if (k === 'c') return ['#####', '..c..', '.....', '.....', '#####'];
  if (k === 'n') return ['.....', '..n..', '.....', '.....', '#####'];
  if (k === 'l') return ['...', '...', '.l.', '###'];
  if ('CGPLXYZ'.includes(k)) return [`.${k}.`, `.${k}.`, '###'];
  return ['...', `.${k}.`, '###'];
}

// Desenho de uma fase parada, na mesma ordem do Jogo.desenha (sem HUD)
function desenhaCena(g, cena, v, ceu) {
  const n = cena.nivel;
  if (ceu && !n.salas.length) Cenario.ceu(g, n.largura, n.altura);
  n.desenhaFixo(g, v);
  n.desenhaVivo(g, 0, [false, false, false], v);
  for (const o of cena.inimigos) o.desenha(g, 0);
  for (const h of cena.herois) {
    const V = h.visual(0);
    Desenho.sombraChao(g, h.x, h.y + 2, h.cfg.w * 0.9);
    Desenho.personagem(g, h.ch, V.M, Object.assign({ f: h.f, t: 0, rosto: V.rosto, escala: ESC, pesPlanos: !V.mole && !V.giro,
      giro: null, quadro: V.quadro || null, pe: { x: h.x, y: h.y }, squash: 0, amarrado: false }, V.extra));
  }
}

function montaCena(def) {
  const nivel = new Nivel(def);
  const herois = ORDEM.filter((id) => nivel.spawns[id]).map((id) => new Heroi(id, nivel.spawns[id].x, nivel.spawns[id].y));
  const inimigos = [...nivel.inimigosDef, ...(def.inimigos || [])].map((d) => new Inimigo(d));
  return { nivel, herois, inimigos };
}

// JSON legível: uma linha do mapa (e um objeto) por linha, para dar para ler e comparar no git
function formata(d) {
  const ks = Object.keys(d);
  return `{\n${ks.map((k, i) => {
    const v = d[k], fim = i < ks.length - 1 ? ',' : '';
    if (Array.isArray(v) && v.length) return `  ${JSON.stringify(k)}: [\n${v.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]${fim}`;
    return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}${fim}`;
  }).join('\n')}\n}\n`;
}
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'fase';

const Ed = {
  f: null, // a fase aberta: { nome, grade: [[letra]], canais, extras, salas, dicas, trechos, roteiro, tmax, cordas, origem }
  peca: '#', canal: null, papel: 'quadriculado',
  vista: { z: 1, x: 0, y: 0 }, dpr: 1, grade: true,
  desfaz: [], refaz: [], cena: null, def: null,
  mouse: null, arrasto: null, espaco: false, pedido: 0,

  init() {
    Estilo.init();
    Estilo.atual = 'cartoon';
    Sprites.init();
    Objetos.init();
    this.cv = document.getElementById('fase'); this.g = this.cv.getContext('2d');
    this.gv = document.getElementById('guia'); this.gg = this.gv.getContext('2d');
    this.area = document.getElementById('area');
    this.montaPaleta();
    this.ligaEventos();
    new ResizeObserver(() => this.redimensiona()).observe(this.area);
    this.redimensiona();
    const q = new URLSearchParams(location.search);
    let rasc = null;
    try { rasc = JSON.parse(le(CHAVE_RASCUNHO)); } catch (e) { rasc = null; }
    this.novo(); // começa com uma fase; o que foi pedido abre por cima
    if (q.has('minha')) { const id = q.get('minha'); if (!this.abreDef(MinhasFases.le(id), id, true)) this.msg('Essa fase não está mais em Minhas fases.'); else this.msg(`Aberta: ${this.f.nome}.`); }
    else if (q.has('nova')) this.msg('Fase nova: dê um nome e salve para ela ir para Minhas fases.');
    else if (q.has('abre')) this.abreSalva(q.get('abre'));
    else if (q.has('gerada')) this.abreGerada(parseInt(q.get('gerada'), 10) || 4, parseInt(q.get('semente'), 10) || 7);
    else if (q.has('tutorial')) this.abreTutorial((parseInt(q.get('tutorial'), 10) || 1) - 1);
    else if (rasc && rasc.def && this.abreDef(rasc.def, rasc.salvaId, true)) this.msg('Rascunho recuperado (o que estava aberto da última vez).');
    // os desenhos da IA chegam depois: refaz a tela e os ícones quando estiverem prontos
    const espera = () => {
      const ok = [...ORDEM, 'guarda', 'escudeiro', 'borracha', 'grampeador'].every((id) => !Sprites.pronto || Sprites.pronto(id)) && (!Objetos.ativo || Objetos.pronto());
      if (!ok && (this.esperou = (this.esperou || 0) + 1) < 200) { setTimeout(espera, 60); return; }
      this.cena = null; this.pede(); this.pintaIcones(); this.pronto = true;
    };
    espera();
  },

  // ------------------------------------------------------------------ fase
  vazia(cols, lins) { return Array.from({ length: lins }, () => Array(cols).fill('.')); },
  novo() {
    const G = this.vazia(32, 18);
    for (const l of [16, 17]) G[l].fill('#');
    G[15][2] = '3'; G[15][5] = '1'; G[15][7] = '2';
    for (let l = 13; l <= 15; l++) G[l][27] = G[l][28] = 'S';
    this.f = { nome: 'Fase nova', grade: G, canais: [], extras: {}, salas: [], dicas: [], trechos: null, roteiro: null, tmax: null, cordas: 1, origem: '' };
    this.salvaId = null; this.desfaz = []; this.refaz = [];
    this.abriu();
  },
  abreDef(def, salvaId = null, quieto = false) {
    if (!def || !Array.isArray(def.mapa) || !def.mapa.length) { this.msg('Não consegui abrir: a fase não tem mapa.'); return false; }
    const cols = Math.max(...def.mapa.map((l) => l.length));
    const grade = def.mapa.map((l) => l.padEnd(cols, '.').split(''));
    const extras = {};
    // inimigos das fases geradas vêm numa lista (com a patrulha); aqui viram letra na grade e o resto fica guardado
    for (const o of def.inimigos || []) {
      const c = Math.floor(o.x / TILE), l = Math.round(o.y / TILE) - 1;
      if (!grade[l] || c < 0 || c >= cols) continue;
      grade[l][c] = o.especie === 'grampeador' ? (o.f > 0 ? 'Q' : 'q') : LETRA_ESPECIE[o.especie] || 'g';
      extras[`${c},${l}`] = { x: o.x, y: o.y, f: o.f, alcance: o.alcance };
    }
    this.f = {
      nome: def.nome || 'Sem nome', grade, extras, canais: (def.canais || []).map((q) => Object.assign({}, q)),
      salas: (def.salas || []).map((s) => Object.assign({}, s)), dicas: (def.dicas || []).slice(), trechos: def.trechos || null,
      roteiro: def.roteiro || null, tmax: def.tmax || null, cordas: def.cordas ?? 1, origem: def.origem || '',
      decoracao: def.decoracao || null, // (não se edita aqui ainda: só não se perde ao salvar)
    };
    this.salvaId = salvaId; this.desfaz = []; this.refaz = [];
    this.abriu();
    if (!quieto) this.msg(`Aberta: ${this.f.nome}${this.f.roteiro ? ' (com roteiro do robô)' : ''}.`);
    return true;
  },
  abriu() {
    document.getElementById('nome').value = this.f.nome;
    document.getElementById('dicas').value = this.f.dicas.join('\n');
    document.getElementById('cordas').value = this.f.cordas;
    document.getElementById('resultado').textContent = '';
    this.ajusta();
    this.mudou(false);
  },
  abreTutorial(i) {
    if (!SALAS[i]) return;
    this.abreDef(Object.assign({ roteiro: ROTEIROS[i], origem: `tutorial ${i + 1}` }, SALAS[i]));
  },
  abreGerada(n, semente) {
    const d = Gerador.sala(Math.max(4, n), semente);
    if (!d) { this.msg(`O gerador não achou fase válida (${Gerador.ultimoErro}).`); return; }
    this.abreDef(Object.assign({}, d, { origem: `gerada: fase ${Math.max(4, n)}, semente ${semente}` }));
  },
  async abreSalva(id) {
    try {
      const r = await fetch(`fases/${encodeURIComponent(id)}.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.abreDef(await r.json(), id);
    } catch (e) { this.msg(`Não consegui abrir fases/${id}.json (${e.message}).`); }
  },

  // A fase no formato do jogo (o mesmo do gerador e das salas à mão)
  paraDef() {
    const f = this.f, inimigos = [];
    const mapa = f.grade.map((lin, l) => lin.map((k, c) => {
      const x = f.extras[`${c},${l}`];
      if (x && ESPECIES[k]) {
        inimigos.push({ especie: ESPECIES[k], x: x.x ?? c * TILE + TILE / 2, y: x.y ?? (l + 1) * TILE, f: k === 'Q' ? 1 : k === 'q' ? -1 : x.f ?? -1, alcance: x.alcance });
        return '.';
      }
      return k;
    }).join(''));
    const d = { nome: f.nome || 'Sem nome', mapa, canais: f.canais, inimigos, salas: f.salas, cordas: f.cordas };
    if (f.dicas.length) d.dicas = f.dicas;
    if (f.trechos) d.trechos = f.trechos;
    if (f.roteiro) { d.roteiro = f.roteiro; d.tmax = f.tmax || 90 + f.roteiro.length * 2.2; }
    if (f.origem) d.origem = f.origem;
    if (f.decoracao) d.decoracao = f.decoracao;
    return JSON.parse(JSON.stringify(d));
  },

  get cols() { return this.f.grade[0].length; },
  get lins() { return this.f.grade.length; },
  dentro(c, l) { return c >= 0 && l >= 0 && c < this.cols && l < this.lins; },

  // ------------------------------------------------------------------ pintar
  foto() { this.desfaz.push(JSON.stringify(this.f)); if (this.desfaz.length > 150) this.desfaz.shift(); this.refaz = []; },
  volta(de, para) {
    if (!de.length) return;
    para.push(JSON.stringify(this.f));
    this.f = JSON.parse(de.pop());
    document.getElementById('dicas').value = this.f.dicas.join('\n');
    document.getElementById('cordas').value = this.f.cordas;
    this.mudou();
  },

  // Põe a peça k no bloco (c, l); devolve true se mudou algo
  poe(c, l, k) {
    if (!this.dentro(c, l)) return false;
    const G = this.f.grade;
    if (k === 'S') {
      const c0 = Math.min(c, this.cols - 2), l0 = Math.max(0, l - 2);
      for (const lin of G) for (let i = 0; i < lin.length; i++) if (lin[i] === 'S') lin[i] = '.';
      for (let y = l0; y < l0 + 3; y++) for (let x = c0; x < c0 + 2; x++) this._troca(x, y, 'S');
      return true;
    }
    if (k === '.' && G[l][c] === 'S') { for (const lin of G) for (let i = 0; i < lin.length; i++) if (lin[i] === 'S') lin[i] = '.'; return true; }
    if ('123'.includes(k)) for (const lin of G) for (let i = 0; i < lin.length; i++) if (lin[i] === k) lin[i] = '.';
    const canal = COM_CANAL.includes(k) ? this.canal : null;
    const antes = this.f.canais.find((q) => q.c === c && q.l === l);
    if (G[l][c] === k && (antes ? antes.canal : null) === canal) return false;
    this._troca(c, l, k, canal);
    return true;
  },
  _troca(c, l, k, canal = null) {
    this.f.grade[l][c] = k;
    delete this.f.extras[`${c},${l}`];
    this.f.canais = this.f.canais.filter((q) => q.c !== c || q.l !== l);
    if (canal) this.f.canais.push({ c, l, canal });
  },
  // Linha de blocos entre dois pontos (arrastar rápido não deixa buraco)
  linha(a, b, k) {
    let mudou = false;
    const n = Math.max(Math.abs(b.c - a.c), Math.abs(b.l - a.l), 1);
    for (let i = 0; i <= n; i++) mudou = this.poe(Math.round(a.c + (b.c - a.c) * i / n), Math.round(a.l + (b.l - a.l) * i / n), k) || mudou;
    return mudou;
  },
  retangulo(a, b, k) {
    let mudou = false;
    for (let l = Math.min(a.l, b.l); l <= Math.max(a.l, b.l); l++) for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) mudou = this.poe(c, l, k) || mudou;
    return mudou;
  },

  // Aumenta (+1) ou diminui (-1) a grade de um lado; esquerda e cima deslocam tudo (salas, inimigos, roteiro do robô)
  tamanho(lado, d) {
    const G = this.f.grade;
    if (d < 0 && ((lado === 'esq' || lado === 'dir') ? this.cols : this.lins) <= 4) return;
    this.foto();
    if (lado === 'dir') { if (d > 0) G.forEach((r) => r.push('.')); else G.forEach((r) => r.pop()); }
    if (lado === 'baixo') { if (d > 0) G.push(Array(this.cols).fill('.')); else G.pop(); }
    if (lado === 'esq') { if (d > 0) G.forEach((r) => r.unshift('.')); else G.forEach((r) => r.shift()); this.desloca(d, 0); }
    if (lado === 'cima') { if (d > 0) G.unshift(Array(this.cols).fill('.')); else G.shift(); this.desloca(0, d); }
    const f = this.f;
    f.canais = f.canais.filter((q) => this.dentro(q.c, q.l));
    for (const k of Object.keys(f.extras)) { const [c, l] = k.split(',').map(Number); if (!this.dentro(c, l)) delete f.extras[k]; }
    this.mudou();
  },
  desloca(dc, dl) {
    const f = this.f, dx = dc * TILE, dy = dl * TILE;
    for (const q of f.canais) { q.c += dc; q.l += dl; }
    const ex = {};
    for (const [k, v] of Object.entries(f.extras)) {
      const [c, l] = k.split(',').map(Number);
      ex[`${c + dc},${l + dl}`] = Object.assign(v, { x: v.x != null ? v.x + dx : v.x, y: v.y != null ? v.y + dy : v.y });
    }
    f.extras = ex;
    for (const s of [...f.salas, ...(f.trechos || [])]) {
      s.x0 += dx; s.x1 += dx;
      if (s.y0 != null) { s.y0 += dy; s.y1 += dy; }
    }
    if (f.roteiro && dx) f.roteiro = f.roteiro.map((cmd) => cmd.map((v, i) => ((OPS_X[cmd[0]] || []).includes(i) && typeof v === 'number' ? v + dx : v)));
    this.vista.x += dx; this.vista.y += dy;
  },

  // ------------------------------------------------------------------ desenho
  mudou(rascunho = true) {
    this.def = this.paraDef();
    this.cena = null;
    this.avisos();
    document.getElementById('tam').textContent = `${this.cols} × ${this.lins} blocos`;
    if (rascunho) guarda(CHAVE_RASCUNHO, JSON.stringify({ def: this.def, salvaId: this.salvaId }));
    this.pede();
  },
  pede() { if (!this.pedido) this.pedido = requestAnimationFrame(() => { this.pedido = 0; this.pinta(); this.pintaGuia(); }); },
  redimensiona() {
    const r = this.area.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.W = r.width; this.H = r.height;
    for (const c of [this.cv, this.gv]) { c.width = Math.round(r.width * this.dpr); c.height = Math.round(r.height * this.dpr); }
    if (this.f && !this.ajustou) this.ajusta();
    this.pede();
  },
  ajusta() {
    if (!this.W) return;
    const L = this.cols * TILE, A = this.lins * TILE, z = Math.min(this.W / L, this.H / A) * 0.94;
    this.vista = { z, x: L / 2 - this.W / 2 / z, y: A / 2 - this.H / 2 / z };
    this.ajustou = true;
    this.pede();
  },
  zoom(k, mx = this.W / 2, my = this.H / 2) {
    const V = this.vista, wx = V.x + mx / V.z, wy = V.y + my / V.z;
    V.z = U.clamp(V.z * k, 0.08, 3);
    V.x = wx - mx / V.z; V.y = wy - my / V.z;
    this.pede();
  },
  transforma(g) { const V = this.vista, d = this.dpr; g.setTransform(d * V.z, 0, 0, d * V.z, -V.x * V.z * d, -V.y * V.z * d); },
  visivel() { const V = this.vista; return { x0: V.x, y0: V.y, x1: V.x + this.W / V.z, y1: V.y + this.H / V.z }; },

  pinta() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#2a231f';
    g.fillRect(0, 0, this.cv.width, this.cv.height);
    if (!this.f) return;
    if (!this.cena) this.cena = montaCena(this.def);
    const n = this.cena.nivel;
    this.transforma(g);
    g.save();
    g.beginPath(); g.rect(0, 0, n.largura, n.altura); g.clip();
    desenhaCena(g, this.cena, this.visivel(), true);
    g.restore();
  },

  pintaGuia() {
    const g = this.gg, V = this.vista, z = V.z;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.gv.width, this.gv.height);
    if (!this.f || !this.cena) return;
    this.transforma(g);
    const L = this.cols * TILE, A = this.lins * TILE, v = this.visivel();
    if (this.grade && z >= 0.22) {
      g.strokeStyle = 'rgba(43,31,46,0.22)'; g.lineWidth = 1 / z;
      g.beginPath();
      for (let c = Math.max(0, Math.floor(v.x0 / TILE)); c <= Math.min(this.cols, Math.ceil(v.x1 / TILE)); c++) { g.moveTo(c * TILE, 0); g.lineTo(c * TILE, A); }
      for (let l = Math.max(0, Math.floor(v.y0 / TILE)); l <= Math.min(this.lins, Math.ceil(v.y1 / TILE)); l++) { g.moveTo(0, l * TILE); g.lineTo(L, l * TILE); }
      g.stroke();
    }
    g.strokeStyle = '#f1bf3a'; g.lineWidth = 2.5 / z; g.strokeRect(0, 0, L, A);
    // salas (papel de parede): contorno quando a ferramenta de sala está na mão
    if (this.peca === 'sala') {
      g.setLineDash([8 / z, 6 / z]); g.strokeStyle = '#3b7be0'; g.lineWidth = 2.5 / z;
      g.font = `${14 / z}px ${FONTE_FALA}`; g.fillStyle = '#1f4f9c';
      for (const s of this.f.salas) { g.strokeRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); g.fillText(s.papel, s.x0 + 6 / z, s.y0 + 16 / z); }
      g.setLineDash([]);
    }
    // canal de cada botão/placa/alavanca e portão: etiqueta branca com a borda da cor do canal (a mesma do jogo) —
    // etiqueta e não bolinha, para não parecer parte do desenho (uma bolinha colorida parecia um botão na alavanca)
    const n = this.cena.nivel, r = Math.max(7, 9 / z);
    const marca = (x, y, canal) => {
      const cor = n.corCanal[canal] || '#888', txt = /^k/.test(canal) ? canal.replace(/^k/, '') : canal === 'b' ? 'B' : canal === 'p' ? 'P' : canal === 'l' ? 'L' : canal;
      g.font = `${r * 1.2}px ${FONTE_TITULO}`;
      const w = g.measureText(txt).width + r * 1.1;
      g.beginPath(); g.roundRect(x - w / 2, y - r, w, r * 2, r * 0.35);
      g.fillStyle = '#fffdf6'; g.fill(); g.lineWidth = 3 / z; g.strokeStyle = cor; g.stroke();
      g.fillStyle = '#2b1f2e'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, x, y + r * 0.1); g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    };
    if (z >= 0.15) {
      // acima da peça (em cima dela parecia um botão colado na alavanca)
      for (const k of n.controles) marca(k.x, k.y - ({ alavanca: 112, botao: 30, placa: 18 }[k.tipo] || 30) - r - 4 / z, k.canal);
      for (const p of n.portoes) marca(p.c * TILE + TILE / 2, p.l0 * TILE - r - 3 / z, p.canal);
    }
    // o que vai ser pintado: o bloco embaixo do mouse, ou o retângulo sendo arrastado
    const a = this.arrasto, m = this.mouse;
    const caixa = (c0, l0, c1, l1, cor) => {
      g.fillStyle = cor; g.fillRect(c0 * TILE, l0 * TILE, (c1 - c0 + 1) * TILE, (l1 - l0 + 1) * TILE);
      g.strokeStyle = '#ffd23f'; g.lineWidth = 2.5 / z; g.strokeRect(c0 * TILE, l0 * TILE, (c1 - c0 + 1) * TILE, (l1 - l0 + 1) * TILE);
    };
    if (a && (a.tipo === 'ret' || a.tipo === 'sala') && a.fim) {
      const cor = a.tipo === 'sala' ? 'rgba(59,123,224,0.22)' : a.k === '.' ? 'rgba(226,67,58,0.25)' : 'rgba(255,210,63,0.28)';
      caixa(Math.min(a.ini.c, a.fim.c), Math.min(a.ini.l, a.fim.l), Math.max(a.ini.c, a.fim.c), Math.max(a.ini.l, a.fim.l), cor);
    } else if (m && m.dentro && !a) {
      if (this.peca === 'S') caixa(Math.min(m.c, this.cols - 2), Math.max(0, m.l - 2), Math.min(m.c, this.cols - 2) + 1, Math.max(0, m.l - 2) + 2, 'rgba(255,210,63,0.28)');
      else caixa(m.c, m.l, m.c, m.l, this.peca === '.' ? 'rgba(226,67,58,0.2)' : 'rgba(255,210,63,0.22)');
    }
  },

  // ------------------------------------------------------------------ paleta
  montaPaleta() {
    const pal = document.getElementById('paleta');
    this.botoes = {};
    for (const [grupo, pecas] of GRUPOS) {
      const h = document.createElement('h3'); h.textContent = grupo; pal.appendChild(h);
      const box = document.createElement('div'); box.className = 'pecas'; pal.appendChild(box);
      for (const [k, nome] of pecas) {
        const b = document.createElement('button');
        b.className = 'peca'; b.title = `${nome}${k.length === 1 && k !== '.' ? ` — tecla ${k}` : ''}`;
        b.innerHTML = `<canvas width="112" height="112"></canvas><span>${k === 'sala' ? 'sala' : k === '.' ? 'apagar' : k}</span>`;
        b.onclick = () => this.escolhe(k);
        box.appendChild(b);
        this.botoes[k] = b;
      }
      if (grupo === 'Botões e portões') {
        const c = document.createElement('div'); c.className = 'chips'; c.id = 'canais'; c.dataset.rotulo = 'Canal (qual portão cada um abre)';
        c.title = 'Canal: botão, placa ou alavanca abre o portão do mesmo canal. "padrão": B abre G, p abre P, l abre L.';
        pal.appendChild(c);
      }
      if (grupo === 'Ferramentas') {
        const c = document.createElement('div'); c.className = 'chips'; c.id = 'papeis'; c.hidden = true; c.dataset.rotulo = 'Papel de parede da sala';
        for (const p of Object.keys(PAPEIS)) {
          const b = document.createElement('button'); b.textContent = p; b.dataset.p = p;
          b.onclick = () => { this.papel = p; this.marcaChips(); };
          c.appendChild(b);
        }
        pal.appendChild(c);
      }
    }
    this.escolhe('#');
  },
  montaCanais() {
    const c = document.getElementById('canais');
    const usados = new Set(this.f ? this.f.canais.map((q) => q.canal) : []);
    const lista = [null, ...CANAIS_ED, ...[...usados].filter((k) => !CANAIS_ED.includes(k))];
    c.innerHTML = '';
    for (const k of lista) {
      const b = document.createElement('button'); b.textContent = k ? k.replace(/^k/, '') : 'padrão'; b.dataset.k = k || '';
      b.onclick = () => { this.canal = k; this.marcaChips(); };
      c.appendChild(b);
    }
    this.marcaChips();
  },
  marcaChips() {
    for (const b of document.querySelectorAll('#canais button')) b.classList.toggle('sel', (b.dataset.k || null) === this.canal);
    for (const b of document.querySelectorAll('#papeis button')) b.classList.toggle('sel', b.dataset.p === this.papel);
  },
  escolhe(k) {
    this.peca = k;
    for (const [q, b] of Object.entries(this.botoes)) b.classList.toggle('sel', q === k);
    document.getElementById('papeis').hidden = k !== 'sala';
    this.pede();
  },
  pintaIcones() {
    for (const [k, b] of Object.entries(this.botoes)) {
      const cv = b.querySelector('canvas'), g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      if (k === '.' || k === 'sala') { // ícones que não são peça: desenho simples
        g.lineWidth = 5; g.strokeStyle = '#2b1f2e'; g.lineJoin = 'round';
        if (k === '.') {
          g.save(); g.translate(56, 58); g.rotate(-0.6);
          g.fillStyle = '#f39bb0'; g.fillRect(-30, -16, 38, 32); g.strokeRect(-30, -16, 38, 32);
          g.fillStyle = '#3b7be0'; g.fillRect(8, -16, 26, 32); g.strokeRect(8, -16, 26, 32);
          g.restore();
        } else {
          g.fillStyle = PAPEIS.quadriculado.fundo; g.fillRect(18, 22, 76, 64);
          g.strokeStyle = '#cad9e5'; g.lineWidth = 2; g.beginPath();
          for (let x = 30; x < 94; x += 14) { g.moveTo(x, 22); g.lineTo(x, 86); }
          for (let y = 34; y < 86; y += 14) { g.moveTo(18, y); g.lineTo(94, y); }
          g.stroke(); g.setLineDash([7, 5]); g.strokeStyle = '#3b7be0'; g.lineWidth = 4; g.strokeRect(18, 22, 76, 64);
        }
        continue;
      }
      try {
        const mapa = miniMapa(k), cena = montaCena({ nome: k, mapa, canais: [], salas: [] });
        const L = mapa[0].length * TILE, A = mapa.length * TILE, s = Math.min(cv.width / L, cv.height / A) * 0.96;
        g.save();
        g.translate((cv.width - L * s) / 2, (cv.height - A * s) / 2);
        g.scale(s, s);
        desenhaCena(g, cena, { x0: 0, y0: 0, x1: L, y1: A }, false);
        g.restore();
      } catch (e) { console.warn('ícone', k, e); }
    }
  },

  // ------------------------------------------------------------------ mouse e teclado
  bloco(e) {
    const r = this.gv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, V = this.vista;
    const wx = V.x + mx / V.z, wy = V.y + my / V.z, c = Math.floor(wx / TILE), l = Math.floor(wy / TILE);
    return { mx, my, wx, wy, c, l, dentro: this.f && this.dentro(c, l) };
  },
  ligaEventos() {
    const gv = this.gv;
    gv.addEventListener('contextmenu', (e) => e.preventDefault());
    gv.addEventListener('pointerdown', (e) => {
      gv.setPointerCapture(e.pointerId);
      const b = this.bloco(e);
      this.mouse = b;
      if (e.button === 1 || (e.button === 0 && this.espaco)) { this.arrasto = { tipo: 'mao', x: e.clientX, y: e.clientY, vx: this.vista.x, vy: this.vista.y }; return; }
      if (e.button !== 0 && e.button !== 2) return;
      if (e.button === 0 && e.altKey) { if (b.dentro) this.pega(b); return; }
      const apaga = e.button === 2;
      if (this.peca === 'sala') {
        if (apaga) this.tiraSala(b.wx, b.wy);
        else this.arrasto = { tipo: 'sala', ini: b, fim: b };
        this.pede();
        return;
      }
      const k = apaga ? '.' : this.peca;
      if (e.shiftKey) { this.arrasto = { tipo: 'ret', k, ini: b, fim: b }; this.pede(); return; }
      this.foto();
      this.arrasto = { tipo: 'pinta', k, ult: b, mudou: false };
      if (this.poe(b.c, b.l, k)) { this.arrasto.mudou = true; this.mudou(); }
    });
    gv.addEventListener('pointermove', (e) => {
      const b = this.bloco(e), a = this.arrasto;
      this.mouse = b;
      this.mostraPosicao(b);
      if (!a) { this.pede(); return; }
      if (a.tipo === 'mao') { this.vista.x = a.vx - (e.clientX - a.x) / this.vista.z; this.vista.y = a.vy - (e.clientY - a.y) / this.vista.z; this.pede(); return; }
      if (a.tipo === 'ret' || a.tipo === 'sala') { a.fim = b; this.pede(); return; }
      if (a.tipo === 'pinta' && (b.c !== a.ult.c || b.l !== a.ult.l)) {
        const k = a.k === 'S' || '123'.includes(a.k) ? null : a.k; // saída e herói: arrastar move (põe só onde soltou)
        if (k != null ? this.linha(a.ult, b, k) : this.poe(b.c, b.l, a.k)) { a.mudou = true; this.mudou(); }
        a.ult = b;
      }
    });
    const solta = () => {
      const a = this.arrasto;
      this.arrasto = null;
      if (!a) return;
      if (a.tipo === 'pinta' && !a.mudou) this.desfaz.pop(); // clique que não mudou nada não entra no desfazer
      if (a.tipo === 'ret') { this.foto(); if (this.retangulo(a.ini, a.fim, a.k)) this.mudou(); else this.desfaz.pop(); }
      if (a.tipo === 'sala') this.poeSala(a.ini, a.fim);
      this.pede();
    };
    gv.addEventListener('pointerup', solta);
    gv.addEventListener('pointercancel', solta);
    gv.addEventListener('pointerleave', () => { if (!this.arrasto) { this.mouse = null; this.pede(); } });
    gv.addEventListener('wheel', (e) => { e.preventDefault(); const b = this.bloco(e); this.zoom(Math.exp(-e.deltaY * 0.0015), b.mx, b.my); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const campo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.salva(); return; }
      if (campo) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.volta(this.refaz, this.desfaz); else this.volta(this.desfaz, this.refaz); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.volta(this.refaz, this.desfaz); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') { this.espaco = true; e.preventDefault(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { this.escolhe('.'); return; }
      if (NOME_PECA[e.key] && e.key !== '.') this.escolhe(e.key); // a letra da peça (a mesma do mapa) escolhe a peça
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.espaco = false; });
    window.addEventListener('blur', () => { this.espaco = false; });
    const liga = (id, fn) => { document.getElementById(id).onclick = fn; };
    // Novo: o segundo clique confirma (confirm() não aparece no link do claude.ai)
    liga('b-novo', (e) => {
      if (!certeza(e.currentTarget, 'Certeza?')) { this.msg('Clique de novo em "Certeza?" para começar uma fase nova (o que não foi salvo fica só no desfazer).'); return; }
      this.foto(); const d = this.desfaz; this.novo(); this.desfaz = d;
    });
    liga('b-abrir', () => this.dialogoAbrir());
    liga('b-salvar', () => this.salva());
    liga('b-jogar', () => this.jogar(false));
    liga('b-desfaz', () => this.volta(this.desfaz, this.refaz));
    liga('b-refaz', () => this.volta(this.refaz, this.desfaz));
    liga('b-menos', () => this.zoom(1 / 1.25));
    liga('b-mais', () => this.zoom(1.25));
    liga('b-ajusta', () => this.ajusta());
    liga('b-robo', () => this.robo());
    liga('b-ver-robo', () => this.jogar(true));
    document.getElementById('c-grade').onchange = (e) => { this.grade = e.target.checked; this.pede(); };
    for (const b of document.querySelectorAll('[data-lado]')) b.onclick = () => this.tamanho(b.dataset.lado, +b.dataset.d);
    document.getElementById('nome').addEventListener('change', (e) => { this.foto(); this.f.nome = e.target.value.trim() || 'Sem nome'; this.mudou(); });
    document.getElementById('cordas').addEventListener('change', (e) => { this.foto(); this.f.cordas = U.clamp(parseInt(e.target.value, 10) || 0, 0, 9); e.target.value = this.f.cordas; this.mudou(); });
    document.getElementById('dicas').addEventListener('change', (e) => {
      this.foto();
      this.f.dicas = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      this.f.trechos = null; // as dicas daqui valem para a fase toda (as do gerador eram por sala)
      this.mudou();
    });
    // diálogo Abrir
    const dlg = document.getElementById('dlg-abrir');
    dlg.querySelector('.fecha').onclick = () => dlg.close();
    document.getElementById('b-gerada').onclick = () => {
      dlg.close();
      this.msg('Gerando...');
      setTimeout(() => this.abreGerada(parseInt(document.getElementById('ger-n').value, 10) || 4, parseInt(document.getElementById('ger-s').value, 10) || 7), 30);
    };
    document.getElementById('b-baixar').onclick = () => this.baixa();
    document.getElementById('b-colar').onclick = () => {
      try { this.abreDef(JSON.parse(document.getElementById('colar').value)); dlg.close(); } catch (e) { dlg.close(); this.msg(`Não é um JSON de fase: ${e.message}`); }
    };
  },
  mostraPosicao(b) {
    const k = b.dentro ? this.f.grade[b.l][b.c] : null;
    document.getElementById('pos').textContent = b.dentro ? `coluna ${b.c} · linha ${b.l} · ${k === '.' ? 'vazio' : NOME_PECA[k] || k}` : '';
  },
  pega(b) { // conta-gotas (Alt + clique): a peça do bloco vira a peça na mão
    const k = this.f.grade[b.l][b.c];
    if (k === '.') return;
    const q = this.f.canais.find((x) => x.c === b.c && x.l === b.l);
    if (COM_CANAL.includes(k)) { this.canal = q ? q.canal : null; this.marcaChips(); }
    this.escolhe(k);
  },
  poeSala(a, b) {
    const c0 = U.clamp(Math.min(a.c, b.c), 0, this.cols - 1), c1 = U.clamp(Math.max(a.c, b.c), 0, this.cols - 1);
    const l0 = U.clamp(Math.min(a.l, b.l), 0, this.lins - 1), l1 = U.clamp(Math.max(a.l, b.l), 0, this.lins - 1);
    this.foto();
    this.f.salas.push({ x0: c0 * TILE, y0: l0 * TILE, x1: (c1 + 1) * TILE, y1: (l1 + 1) * TILE, papel: this.papel });
    this.mudou();
  },
  tiraSala(x, y) {
    const i = this.f.salas.map((s) => x >= s.x0 && x < s.x1 && y >= s.y0 && y < s.y1).lastIndexOf(true);
    if (i < 0) return;
    this.foto();
    this.f.salas.splice(i, 1);
    this.mudou();
  },

  // ------------------------------------------------------------------ conferir, salvar, jogar
  avisos() {
    const f = this.f, G = f.grade, tem = (k) => G.some((l) => l.includes(k)), av = [];
    for (const [k, nome] of [['1', 'Marreta'], ['2', 'Fiapo'], ['3', 'Pudim']]) if (!tem(k)) av.push(`Falta o ${nome} (${k}).`);
    if (!tem('S')) av.push('Falta a saída (S).');
    let n = null;
    try { n = new Nivel(this.def); } catch (e) { av.push(`A fase não monta: ${e.message}`); }
    if (n) {
      const nomeCanal = (k) => (/^k/.test(k) ? `canal ${k.slice(1)}` : { b: 'canal padrão do botão', p: 'canal padrão da placa', l: 'canal padrão da alavanca' }[k] || `canal ${k}`);
      const abre = new Set(n.controles.map((k) => k.canal)), abertos = new Set(n.portoes.map((p) => p.canal));
      for (const k of abertos) if (!abre.has(k)) av.push(`Portão sem nada que abra (${nomeCanal(k)}).`);
      for (const k of abre) if (!abertos.has(k)) av.push(`Botão/placa/alavanca sem portão (${nomeCanal(k)}).`);
      const chaves = new Set(n.chaves.map((k) => k.cor));
      for (const p of n.portas) if (!chaves.has(p.cor)) av.push(`Porta ${NOME_COR[p.cor]} sem chave da mesma cor.`);
    }
    const ul = document.getElementById('avisos');
    ul.innerHTML = av.length ? av.map((a) => `<li>${a}</li>`).join('') : '<li class="ok">Tudo no lugar.</li>';
    document.getElementById('origem').textContent = f.origem ? `Origem: ${f.origem}` : '';
    document.getElementById('b-robo').disabled = document.getElementById('b-ver-robo').disabled = !f.roteiro;
    document.getElementById('sem-roteiro').hidden = !!f.roteiro;
    document.getElementById('nota-dicas').hidden = !f.trechos;
    if (this.montouCanais !== f.canais.length) { this.montouCanais = f.canais.length; this.montaCanais(); }
    this.faltaHeroi = av.some((a) => a.startsWith('Falta o'));
    return av;
  },
  // Salvar: em Minhas fases (neste navegador: aparece no menu do jogo, também no publicado) e, no PC com o servidor do
  // jogo, também em fases/<id>.json. Sem nome ainda, pede o nome no campo de cima (prompt() não aparece no claude.ai).
  async salva() {
    const campo = document.getElementById('nome'), nome = campo.value.trim();
    if (!nome || nome === 'Fase nova' || nome === 'Sem nome') {
      campo.value = ''; campo.focus();
      this.msg('Escreva o nome da sua fase no campo "Nome da fase" (em cima) e clique em Salvar.');
      return;
    }
    if (nome !== this.f.nome) { this.f.nome = nome; this.mudou(); }
    const id = this.salvaId && slug(this.f.nome) === this.salvaId ? this.salvaId : slug(this.f.nome);
    const def = this.paraDef();
    if (!MinhasFases.grava(id, def)) { this.msg('O navegador não deixou guardar (localStorage bloqueado). Use Abrir → Baixar esta fase.'); return; }
    this.salvaId = id; this.mudou();
    let noPC = '';
    try {
      const r = await fetch(`api/fase?nome=${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: formata(def) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) noPC = ` e em ${j.arquivo}`;
    } catch (e) { /* sem o servidor do jogo (publicado): fica só em Minhas fases */ }
    this.msg(`"${this.f.nome}" salva em Minhas fases${noPC}. Ela aparece no menu do jogo.`);
  },
  baixa() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([formata(this.paraDef())], { type: 'application/json' }));
    a.download = `${this.salvaId || slug(this.f.nome)}.json`; a.click();
  },
  jogar(robo) {
    if (this.faltaHeroi) { this.msg('Para jogar, a fase precisa dos três heróis (1, 2 e 3).'); return; }
    if (!guarda(CHAVE_JOGAR, JSON.stringify(this.paraDef()))) { this.msg('O navegador não deixou guardar a fase para o jogo (localStorage bloqueado).'); return; }
    // na mesma aba (aba nova é bloqueada no link do claude.ai e atrapalha no celular); o Esc de lá tem "Voltar ao
    // editor", e o editor volta com o rascunho
    location.href = `index.html?fase=~${robo ? '&demo' : ''}`;
  },
  robo() {
    const res = document.getElementById('resultado');
    if (!this.f.roteiro) return;
    if (this.faltaHeroi) { res.textContent = 'Falta herói: o robô não tem com quem jogar.'; return; }
    res.textContent = 'O robô está jogando...';
    setTimeout(() => {
      const d = this.paraDef(), r = simula(d, d.roteiro, d.tmax);
      res.className = r.venceu ? 'ok' : 'erro';
      res.textContent = r.venceu ? `✔ O robô passou (${r.t} s de jogo).`
        : `✘ O robô travou no comando ${r.comando} ${JSON.stringify(r.cmd || '')}.\n${r.log.slice(-4).join('\n')}`;
    }, 30);
  },
  async dialogoAbrir() {
    const dlg = document.getElementById('dlg-abrir'), lista = document.getElementById('lista-salvas');
    const tut = document.getElementById('lista-tutorial');
    tut.innerHTML = '';
    SALAS.forEach((s, i) => {
      const b = document.createElement('button'); b.textContent = `${i + 1}. ${s.nome}`;
      b.onclick = () => { dlg.close(); this.abreTutorial(i); };
      tut.appendChild(b);
    });
    // Minhas fases: abrir e apagar (×)
    const minhas = document.getElementById('lista-minhas');
    minhas.innerHTML = '';
    const lm = MinhasFases.lista();
    if (!lm.length) minhas.textContent = 'Nenhuma ainda: dê um nome e clique em Salvar.';
    for (const f of lm) {
      const caixa = document.createElement('span'); caixa.className = 'minha';
      const b = document.createElement('button'); b.textContent = f.nome;
      b.onclick = () => { dlg.close(); if (this.abreDef(MinhasFases.le(f.id), f.id)) this.mudou(); };
      const x = document.createElement('button'); x.textContent = '×'; x.className = 'apaga'; x.title = `Apagar ${f.nome}`;
      x.onclick = () => {
        if (!certeza(x, 'apagar?')) return; // o segundo clique apaga
        MinhasFases.apaga(f.id);
        if (this.salvaId === f.id) this.salvaId = null;
        caixa.remove();
      };
      caixa.append(b, x);
      minhas.appendChild(caixa);
    }
    // fases do jogo: a lista do servidor do PC; sem servidor (publicado), as da demo
    lista.textContent = 'Procurando...';
    dlg.showModal();
    let fases = null;
    try {
      const r = await fetch('api/fases', { cache: 'no-store' });
      if (r.ok) fases = (await r.json()).fases.map((f) => ({ id: f.id, txt: f.erro ? f.nome : `${f.nome} (${f.cols} × ${f.lins})` }));
    } catch (e) { /* sem o servidor do jogo */ }
    if (!fases) fases = [{ id: 'mesa', txt: 'A Mesa' }, { id: 'mesa3', txt: 'A Mesa nova' }];
    lista.innerHTML = '';
    for (const f of fases) {
      const b = document.createElement('button');
      b.textContent = f.txt;
      b.onclick = () => { dlg.close(); this.abreSalva(f.id); };
      lista.appendChild(b);
    }
  },
  msg(t) { const m = document.getElementById('msg'); m.textContent = t; m.classList.remove('pisca'); void m.offsetWidth; m.classList.add('pisca'); },
};
