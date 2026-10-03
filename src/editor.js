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

// (30/09, usuário: "como eu seleciono um objeto? precisava clicar e arrastar"; "não estou vendo livro, estante") —
// Mover é a ferramenta de começo; estante, livros deitados e enfeites entraram na paleta; a sala foi para o fim
const GRUPOS = [
  ['Ferramentas', [['mover', 'Selecionar (Esc): clique numa peça, num bloco, na estante ou num enfeite; arraste para mudar de lugar; os quadradinhos mudam o tamanho; no vazio, arraste para pegar uma área. O painel à direita mostra o que dá para mudar'],
    ['.', 'Apagar'],
    ['comentar', 'Comentar: arraste um retângulo em cima do que quer mudar e escreva o que é (clique num comentário para mudar o texto; botão direito dentro apaga). "Enviar comentários", em cima, manda todos para o Claude']]],
  ['Blocos', [['#', 'Papelão'], ['b', 'Livros deitados: bloco sólido como o papelão; cada fileira é um livro (empilhe para degrau)'],
    ['estante', 'Estante de livros: arraste um retângulo, do topo até o chão. Os blocos dela viram prateleiras cheias de livros (o topo se pisa). Apague embaixo para abrir a passagem; um portão da alavanca (L) dentro dela vira o livro-portão. Botão direito dentro tira a estante'],
    ['C', 'Parede fraca (papelão remendado) — o soco do Marreta quebra'], ['F', 'Folha de papel — a bundada do Pudim rasga'],
    ['^', 'Lápis — machuca'], ['H', 'Escada de palitos (1 bloco de largura: só o Fiapo cabe)'],
    ['/', 'Rampa subindo para a direita (emende na diagonal para rampa longa)'], ['\\', 'Rampa subindo para a esquerda']]],
  ['Pisos', [['k', 'Cola (no bloco em cima do chão): anda devagar e não pula; inimigo e bola do Pudim grudam'],
    ['w', 'Corretivo (no bloco em cima do chão): escorrega — embalado, não freia nem vira']]],
  ['Corda', [['T', 'Tachinha — o Fiapo amarra a corda'], ['r', 'Rolo de barbante — mais uma corda para o Fiapo']]],
  ['Objetos', [['R', 'Trena (no bloco em cima do chão, na beira de um vão) — a fita é a ponte por cima do vão; a bundada do Pudim no botão recolhe (quem está nela cai) e estica de novo. Do chão o Pudim não alcança o botão: ponha um degrau de 1 bloco do lado'],
    ['E', 'Estojo de zíper (no bloco em cima do chão: o meio dele; 5 blocos de largura, 2 de altura) — só o Marreta empurra; em cima é piso; empurra inimigo, segura a estocada; cai em buraco de 5 blocos e 2 de fundo e fica rente ao chão'],
    ['d', 'Rolo de durex — empurra; o soco do Marreta ou a bola do Pudim manda rolando (boliche); degrau; segura a placa'],
    ['v', 'Régua-gangorra (no bloco do calço) — quem cai na ponta de cima lança quem está na outra; a bundada do Pudim lança o Fiapo alto. A ponta que fica embaixo: tecla F ou o painel'],
    ['n', 'Post-it colado no fundo (a dobra é um degrau na linha de baixo do bloco) — pisou, treme, cai e volta piscando; de 3 em 3 blocos só o Fiapo sobe'],
    ['c', 'Carimbo (no bloco logo abaixo de um teto) — desce até o chão num ritmo; encostar machuca, inimigo embaixo é achatado. Com 6 blocos de vão todos passam por baixo no tempo certo']]],
  ['Botões e portões', [['B', 'Botão pesado — só o Pudim, fica apertado'], ['p', 'Placa — só enquanto alguém pisa'], ['l', 'Alavanca'],
    ['G', 'Portão do botão'], ['P', 'Portão da placa'], ['L', 'Portão da alavanca']]],
  ['Chaves e portas', [['x', 'Chave vermelha'], ['y', 'Chave azul'], ['z', 'Chave amarela'],
    ['X', 'Porta vermelha'], ['Y', 'Porta azul'], ['Z', 'Porta amarela']]],
  ['Inimigos', [['g', 'Guarda — lança de lápis'], ['e', 'Escudeiro — régua de escudo'], ['o', 'Borracha'],
    ['q', 'Grampeador — atira grampos para a frente; o Pudim rebate. Para que lado olha: tecla F ou o painel'],
    ['j', 'Lixeira — joga bolinha de papel em arco; o soco na hora certa rebate (CESTA!). Ponha no alto'],
    ['u', 'Tesoureiro — de guarda; viu, corre sem frear: crava na parede, gruda na cola, cai no buraco, corta corda'],
    ['a', 'Blindado — soldadinho numa lata: nada derruba (soco, bola, bundada, pisão: CLANG); só cair (lápis, fosso, a trena recolhida)']]],
  ['Heróis e saída', [['1', 'Marreta'], ['2', 'Fiapo'], ['3', 'Pudim'], ['S', 'Saída (2 × 3 blocos; o clique é o canto de baixo à esquerda)'],
    ['K', 'Ponto de controle (bandeirinha, no chão): o primeiro herói que encosta guarda a fase inteira — alavancas, portões, cordas, inimigos; quem perde os corações (ou aperta R) volta para lá']]],
  ['Enfeites (sem física, no fundo)', [['deco:pote', 'Pote de lápis'], ['deco:caderno', 'Caderno em pé'], ['deco:luminaria', 'Luminária'],
    ['deco:caneca', 'Caneca de pincéis'], ['deco:etiqueta', 'Etiqueta (na frente do chão)']]],
  ['Na frente (sem física)', [['I', 'Pilar de lápis (no bloco em cima do chão): sobe até o teto, como se o segurasse; os heróis passam por trás'],
    ['i', 'Pilar de marca-texto (no bloco em cima do chão): sobe até o teto; os heróis passam por trás']]],
  ['Fundo de prédio', [['sala', 'Parede de sala (papel de parede), para fases dentro de um prédio: com uma sala na fase, o céu some e fora das salas fica escuro. Arraste um retângulo; botão direito dentro apaga']]],
];
// (30/09, usuário: "por que tem dois grampeadores, se já dá para virar?" — uma peça só; a outra letra continua no mapa)
const NOME_PECA = Object.assign(Object.fromEntries(GRUPOS.flatMap((g) => g[1])),
  { Q: 'Grampeador olhando para a direita', V: 'Régua-gangorra com a ponta direita embaixo' });
// livros deitados: as cores (a ordem dos desenhos em LIVRO_DEITADO.nomes); sem cor escolhida, sorteada pela posição
const CORES_LIVRO = [['#d0463c', 'vermelho'], ['#3b6fc4', 'azul'], ['#3f9a5a', 'verde'], ['#8a55c2', 'roxo']];
// enfeites (def.decoracao): altura padrão na escala dos da Mesa (~1,27 px por px do desenho); a etiqueta vai na cara da
// frente do chão. (Os pequenos e os livros de 3/4 ficaram de fora: sumiam atrás do tampo ou pediam para pular em cima.)
const ENFEITES = { pote: { a: 300 }, caderno: { a: 250 }, luminaria: { a: 300 }, caneca: { a: 230 }, etiqueta: { a: 60, c: 'frente', dy: 90 } };
const TERRENO = '#CF^/\\kwb'; // o Mover não pega bloco (arrastar ali seleciona uma área)
const GRUPO_INTEIRO = 'SGPLXYZH'; // peças de vários blocos: o Mover leva o grupo junto
const CANAIS_ED = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'];
const COM_CANAL = 'BplGPL';
const LETRA_ESPECIE = { guarda: 'g', escudeiro: 'e', borracha: 'o', lixeira: 'j', tesoureiro: 'u', blindado: 'a' }; // grampeador: q (←) ou Q (→)
// comandos do robô com x (posição no comando). (01/10: faltavam bundadaEm, pulaEm, carimbo, salta, cesta, isca e
// espreita — a fase do usuário crescida 11 blocos para a esquerda ficou com o robô pulando no lugar velho)
const OPS_X = { anda: [1], vai: [1], rola: [1], soca: [1, 2], bundada: [1, 2], barriga: [1, 2], rebate: [1, 2], desvia: [2], pisa: [2],
  empurra: [1], bundadaEm: [1, 2], pulaEm: [1], carimbo: [1], salta: [1, 2], cesta: [1, 2], isca: [1], espreita: [2] };
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
  if (k === 'R') return ['......', '.....R', '#....#', '#^^^^#', '######'];
  if (k === 'E') return ['.......', '.......', '...E...', '#######'];
  if (k === 'b') return ['.....', '..bb.', '.bbb.', 'bbbbb', '#####'];
  if (k === 'v' || k === 'V') return ['.......', '.......', `...${k}...`, '#######'];
  if (k === 'c') return ['#####', '..c..', '.....', '.....', '#####'];
  if (k === 'n') return ['.....', '..n..', '.....', '.....', '#####'];
  if (k === 'I' || k === 'i') return ['#####', '.....', '.....', `..${k}..`, '#####'];
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
  n.desenhaEstojos(g, v);
  for (const h of cena.herois) {
    const V = h.visual(0);
    Desenho.sombraChao(g, h.x, h.y + 2, h.cfg.w * 0.9);
    Desenho.personagem(g, h.ch, V.M, Object.assign({ f: h.f, t: 0, rosto: V.rosto, escala: ESC, pesPlanos: !V.mole && !V.giro,
      giro: null, quadro: V.quadro || null, pe: { x: h.x, y: h.y }, squash: 0, amarrado: false }, V.extra));
  }
  n.desenhaFrente(g, v, null); // pilares (na frente dos heróis)
}

function montaCena(def) {
  const nivel = new Nivel(def);
  const herois = ORDEM.filter((id) => nivel.spawns[id]).map((id) => new Heroi(id, nivel.spawns[id].x, nivel.spawns[id].y).encaixa(nivel));
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
  peca: 'mover', canal: null, papel: 'quadriculado', corLivro: null, // (corLivro: índice em CORES_LIVRO; null = sorteada)
  vista: { z: 1, x: 0, y: 0 }, dpr: 1, grade: true,
  desfaz: [], refaz: [], cena: null, def: null,
  mouse: null, arrasto: null, espaco: false, pedido: 0,
  sel: null, // o item selecionado (editor-sel.js)

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
      const ok = Object.keys(Sprites.CONJUNTOS).every((id) => Sprites.pronto(id)) && Objetos.pronto();
      if (!ok && (this.esperou = (this.esperou || 0) + 1) < 400) { setTimeout(espera, 60); return; }
      this.pronto = true; this.cena = null; this.pede(); this.pintaIcones();
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
    this.f = { nome: 'Fase nova', grade: G, canais: [], extras: {}, salas: [], dicas: [], trechos: null, roteiro: null, tmax: null, cordas: 1, origem: '', comentarios: [] };
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
      chaoMesa: !!def.chaoMesa, // (o chão de baixo é o tampo de madeira da mesa)
      decoracao: (def.decoracao || []).map((q) => Object.assign({}, q)), // enfeites (Mover arrasta; + e − o tamanho)
      // (também não se editam aqui ainda: o ritmo de cada carimbo, as estantes de livros e a cor fixa de um canal)
      carimbos: (def.carimbos || []).map((q) => Object.assign({}, q)), estantes: (def.estantes || []).map((q) => Object.assign({}, q)),
      coresCanal: def.coresCanal || null,
      semVolta: (def.semVolta || []).map((q) => Object.assign({}, q, { para: q.para.slice() })), // (idas sem volta de propósito: confereVolta)
      livros: Object.fromEntries((def.livros || []).map(([c, l, cor]) => [`${c},${l}`, cor])), // cor de cada bloco de livro ("c,l": 0-3)
      comentarios: (def.comentarios || []).map((q) => Object.assign({}, q)), // retângulos com o que o usuário quer mudar (Comentar)
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

  // A fase no formato do jogo (o mesmo do gerador e das salas à mão); f: a aberta ou uma cópia mudada (a prévia)
  paraDef(f = this.f) {
    const inimigos = [];
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
    if (f.decoracao && f.decoracao.length) d.decoracao = f.decoracao;
    if (f.carimbos && f.carimbos.length) d.carimbos = f.carimbos;
    if (f.estantes && f.estantes.length) d.estantes = f.estantes;
    if (f.coresCanal) d.coresCanal = f.coresCanal;
    if (f.semVolta && f.semVolta.length) d.semVolta = f.semVolta;
    if (f.chaoMesa) d.chaoMesa = true;
    if (f.comentarios && f.comentarios.length) d.comentarios = f.comentarios;
    const livros = Object.entries(f.livros || {}).map(([k, cor]) => [...k.split(',').map(Number), cor]).filter(([c, l]) => f.grade[l] && f.grade[l][c] === 'b');
    if (livros.length) d.livros = livros.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
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
    this.sel = null;
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
    const corAntes = (this.f.livros || {})[`${c},${l}`] ?? null; // (livro: pintar de outra cor por cima muda a cor)
    if (G[l][c] === k && (antes ? antes.canal : null) === canal && (k !== 'b' || corAntes === this.corLivro)) return false;
    this._troca(c, l, k, canal);
    return true;
  },
  _troca(c, l, k, canal = null) {
    const ch = `${c},${l}`;
    this.f.grade[l][c] = k;
    delete this.f.extras[ch];
    this.f.canais = this.f.canais.filter((q) => q.c !== c || q.l !== l);
    if (canal) this.f.canais.push({ c, l, canal });
    if (this.f.livros) delete this.f.livros[ch];
    if (k === 'b' && this.corLivro != null) (this.f.livros = this.f.livros || {})[ch] = this.corLivro;
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
    for (const q of [...f.canais, ...(f.carimbos || [])]) { q.c += dc; q.l += dl; }
    for (const e of [...(f.estantes || []), ...(f.comentarios || [])]) { e.c0 += dc; e.c1 += dc; e.l0 += dl; e.l1 += dl; }
    for (const q of f.semVolta || []) { q.para[0] += dc; q.para[1] += dl; }
    for (const q of f.decoracao || []) { q.x += dx; q.y += dy; }
    f.livros = Object.fromEntries(Object.entries(f.livros || {}).map(([k, cor]) => { const [c, l] = k.split(',').map(Number); return [`${c + dc},${l + dl}`, cor]; }));
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
    this.cena = null; this.previa = null;
    this.avisos();
    if (this.mostraSel) this.mostraSel();
    document.getElementById('tam').textContent = `${this.cols} × ${this.lins} blocos`;
    const nc = (this.f.comentarios || []).length;
    document.getElementById('b-coment').textContent = nc ? `💬 Enviar comentários (${nc})` : '💬 Enviar comentários';
    if (rascunho) this.guardaRascunho();
    this.pede();
  },
  guardaRascunho() { guarda(CHAVE_RASCUNHO, JSON.stringify({ def: this.def, salvaId: this.salvaId })); },
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
    if (!this.pronto) { // a arte da IA ainda chegando: nada do desenho antigo, por código (02/10, usuário)
      g.fillStyle = '#c9bba6'; g.font = `${Math.round(22 * this.dpr)}px "Patrick Hand", "Comic Sans MS", sans-serif`;
      g.textAlign = 'center'; g.fillText('Carregando os desenhos...', this.cv.width / 2, this.cv.height / 2);
      return;
    }
    if (!this.cena) this.cena = montaCena(this.def);
    // prévia: arrastando ou com a peça na mão, a fase como vai ficar (a cópia mudada)
    const P = this.previa, cena = P ? (P.cena || (P.cena = montaCena(this.paraDef(P.f)))) : this.cena;
    const n = cena.nivel;
    this.transforma(g);
    g.save();
    g.beginPath(); g.rect(0, 0, n.largura, n.altura); g.clip();
    desenhaCena(g, cena, this.visivel(), true);
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
    this.desenhaComentarios(g, z);
    // estantes: contorno quando a ferramenta da estante está na mão
    if (this.peca === 'estante') {
      g.setLineDash([8 / z, 6 / z]); g.strokeStyle = '#f1bf3a'; g.lineWidth = 2.5 / z;
      for (const e of this.f.estantes || []) g.strokeRect(e.c0 * TILE, e.l0 * TILE, (e.c1 - e.c0 + 1) * TILE, (e.l1 - e.l0 + 1) * TILE);
      g.setLineDash([]);
    }
    if (this.peca === 'mover') this.selGuia(g, z); // seleção, alças, o que o clique pega (editor-sel.js)
    else if (a && (a.tipo === 'ret' || a.tipo === 'sala' || a.tipo === 'estante' || a.tipo === 'coment') && a.fim) {
      const cor = a.tipo === 'sala' ? 'rgba(59,123,224,0.22)' : a.tipo === 'coment' || a.k === '.' ? 'rgba(226,67,58,0.25)' : 'rgba(255,210,63,0.28)';
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
        const rotulo = k === '.' ? 'apagar' : k === 'mover' ? 'selecionar' : k === 'comentar' ? 'comentar' : k.startsWith('deco:') ? k.slice(5) : k;
        b.innerHTML = `<canvas width="112" height="112"></canvas><span>${rotulo}</span>`;
        b.onclick = () => this.escolhe(k);
        box.appendChild(b);
        this.botoes[k] = b;
      }
      if (grupo === 'Blocos') { // a cor dos livros deitados (aparece com os livros na mão)
        const c = document.createElement('div'); c.className = 'chips'; c.id = 'cores-livro'; c.hidden = true; c.dataset.rotulo = 'Cor do livro (cores diferentes lado a lado = livros separados)';
        for (const [i, [cor, nome]] of [[null, ['', 'sorteada']], ...CORES_LIVRO.map((q, j) => [j, q])]) {
          const b = document.createElement('button'); b.textContent = nome; b.dataset.cor = i == null ? '' : i;
          if (cor) { b.style.background = cor; b.style.color = '#fffdf6'; }
          b.onclick = () => { this.corLivro = i; this.marcaChips(); this.previa = null; };
          c.appendChild(b);
        }
        pal.appendChild(c);
      }
      if (grupo === 'Botões e portões') {
        const c = document.createElement('div'); c.className = 'chips'; c.id = 'canais'; c.dataset.rotulo = 'Canal (qual portão cada um abre)';
        c.title = 'Canal: botão, placa ou alavanca abre o portão do mesmo canal. "padrão": B abre G, p abre P, l abre L.';
        pal.appendChild(c);
      }
      if (grupo === 'Fundo de prédio') {
        const c = document.createElement('div'); c.className = 'chips'; c.id = 'papeis'; c.hidden = true; c.dataset.rotulo = 'Papel de parede da sala';
        for (const p of Object.keys(PAPEIS)) {
          const b = document.createElement('button'); b.textContent = p; b.dataset.p = p;
          b.onclick = () => { this.papel = p; this.marcaChips(); };
          c.appendChild(b);
        }
        pal.appendChild(c);
      }
    }
    this.escolhe('mover');
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
    for (const b of document.querySelectorAll('#cores-livro button')) b.classList.toggle('sel', b.dataset.cor === (this.corLivro == null ? '' : String(this.corLivro)));
  },
  escolhe(k) {
    this.peca = k;
    for (const [q, b] of Object.entries(this.botoes)) b.classList.toggle('sel', q === k);
    document.getElementById('papeis').hidden = k !== 'sala';
    document.getElementById('cores-livro').hidden = k !== 'b';
    this.marcaChips();
    if (k !== 'mover') this.sel = null;
    this.previa = null; this.modoDaqui = false;
    this.gv.style.cursor = k === 'mover' ? 'default' : 'crosshair';
    if (this.f && this.mostraSel) this.mostraSel();
    this.pede();
  },
  pintaIcones() {
    if (!this.pronto) return; // (os ícones saem com os desenhos da IA, quando chegarem)
    for (const [k, b] of Object.entries(this.botoes)) {
      const cv = b.querySelector('canvas'), g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      if (k === 'mover') { // seta do mouse com as quatro setinhas de arrastar
        g.lineWidth = 5; g.strokeStyle = '#2b1f2e'; g.lineJoin = 'round'; g.fillStyle = '#fffdf6';
        g.beginPath(); g.moveTo(40, 24); g.lineTo(40, 84); g.lineTo(54, 71); g.lineTo(64, 92); g.lineTo(74, 87); g.lineTo(64, 66); g.lineTo(82, 66); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = '#f1bf3a'; g.lineWidth = 3;
        for (const [x, y, r] of [[84, 30, 0], [84, 30, Math.PI / 2], [84, 30, Math.PI], [84, 30, -Math.PI / 2]]) {
          g.save(); g.translate(x, y); g.rotate(r); g.beginPath(); g.moveTo(16, 0); g.lineTo(7, -7); g.lineTo(7, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
        }
        continue;
      }
      if (k.startsWith('deco:')) { // o próprio desenho do enfeite
        const img = Objetos.imgs[`decoracao/${k.slice(5)}`];
        if (img) { const s = Math.min(96 / img.width, 96 / img.height); g.drawImage(img, 56 - img.width * s / 2, 104 - img.height * s, img.width * s, img.height * s); }
        continue;
      }
      if (k === 'estante') {
        try {
          const mapa = ['......', '.####.', '.####.', '.####.', '.####.', '.####.', '######'];
          const cena = montaCena({ nome: k, mapa, canais: [], salas: [], estantes: [{ c0: 1, c1: 4, l0: 1, l1: 5 }] });
          const L = 6 * TILE, A = 7 * TILE, s = Math.min(cv.width / L, cv.height / A) * 0.96;
          g.save(); g.translate((cv.width - L * s) / 2, (cv.height - A * s) / 2); g.scale(s, s);
          desenhaCena(g, cena, { x0: 0, y0: 0, x1: L, y1: A }, false);
          g.restore();
        } catch (e) { console.warn('ícone', k, e); }
        continue;
      }
      if (k === 'comentar') { // retângulo vermelho tracejado com um balão de fala
        g.fillStyle = 'rgba(226,67,58,0.22)'; g.fillRect(14, 30, 64, 52);
        g.setLineDash([7, 5]); g.strokeStyle = '#d93636'; g.lineWidth = 4; g.strokeRect(14, 30, 64, 52); g.setLineDash([]);
        g.lineWidth = 4; g.strokeStyle = '#2b1f2e'; g.fillStyle = '#fffdf6'; g.lineJoin = 'round';
        g.beginPath(); g.roundRect(48, 14, 52, 36, 9); g.moveTo(60, 50); g.lineTo(56, 62); g.lineTo(70, 50); g.fill(); g.stroke();
        g.fillStyle = '#2b1f2e'; for (const x of [62, 74, 86]) { g.beginPath(); g.arc(x, 32, 3.5, 0, U.TAU); g.fill(); }
        continue;
      }
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
      if (this.modoDaqui) { if (e.button === 0) this.jogaDaqui(b); else { this.modoDaqui = false; this.msg('Jogar daqui: cancelado.'); } return; }
      if (e.button === 0 && e.altKey) { if (b.dentro) this.pega(b); return; }
      const apaga = e.button === 2;
      this.previa = null;
      // o × de um comentário apaga; o número e o texto abrem para mudar (a alça do selecionado, rente ao ×, vem antes)
      const cb = e.button === 0 && !(this.peca === 'mover' && this.alcaEm(b)) && this.botaoComent(b);
      if (cb) { if (cb.tipo === 'x') this.apagaComent(cb.i); else this.abreComent(cb.i); this.pede(); return; }
      if (this.peca === 'sala') {
        if (apaga) this.tiraSala(b.wx, b.wy);
        else this.arrasto = { tipo: 'sala', ini: b, fim: b };
        this.pede();
        return;
      }
      if (this.peca === 'comentar') {
        if (apaga) { const i = this.comentEm(b.wx, b.wy); if (i >= 0) this.apagaComent(i); }
        else if (b.dentro) this.arrasto = { tipo: 'coment', ini: b, fim: b };
        this.pede();
        return;
      }
      if (this.peca === 'estante') {
        if (apaga) this.tiraEstante(b.c, b.l);
        else if (b.dentro) this.arrasto = { tipo: 'estante', ini: b, fim: b };
        this.pede();
        return;
      }
      if (this.peca.startsWith('deco:')) {
        if (apaga) { const i = this.decoEm(b.wx, b.wy); if (i >= 0) { this.foto(); this.f.decoracao.splice(i, 1); this.mudou(); } }
        else this.poeDeco(b, this.peca.slice(5));
        return;
      }
      if (this.peca === 'mover') { this.selDown(b, e); return; }
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
      if (!a) { this.previaPinta(b); this.pede(); return; }
      if (a.tipo === 'mao') { this.vista.x = a.vx - (e.clientX - a.x) / this.vista.z; this.vista.y = a.vy - (e.clientY - a.y) / this.vista.z; this.pede(); return; }
      if (a.sel) { this.selMove(b); return; }
      if (['ret', 'sala', 'estante', 'coment'].includes(a.tipo)) { a.fim = b; this.pede(); return; }
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
      if (a.tipo === 'estante') this.poeEstante(a.ini, a.fim);
      if (a.tipo === 'coment') this.soltaComent(a.ini, a.fim);
      if (a.sel) this.selUp(a);
      this.gv.style.cursor = this.peca === 'mover' ? 'default' : 'crosshair';
      this.pede();
    };
    gv.addEventListener('pointerup', solta);
    gv.addEventListener('pointercancel', solta);
    gv.addEventListener('pointerleave', () => { if (!this.arrasto) { this.mouse = null; this.previa = null; this.pede(); } });
    gv.addEventListener('wheel', (e) => { e.preventDefault(); const b = this.bloco(e); this.zoom(Math.exp(-e.deltaY * 0.0015), b.mx, b.my); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const campo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.salva(); return; }
      if (campo) return;
      if (this.selTecla(e)) { e.preventDefault(); return; } // setas, Delete, Esc, Ctrl+C/V/D, F, + e − (editor-sel.js)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.volta(this.refaz, this.desfaz); else this.volta(this.desfaz, this.refaz); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.volta(this.refaz, this.desfaz); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') { this.espaco = true; e.preventDefault(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { this.escolhe('.'); return; }
      if (e.key === 'm' || e.key === 'M' || e.key === 'Escape') { this.escolhe('mover'); return; }
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
    liga('b-daqui', () => this.jogarDaqui());
    liga('b-ajuda', () => this.ajuda());
    liga('b-coment', () => this.dialogoEnviar());
    liga('b-envia', () => this.enviaComentarios());
    document.querySelector('#dlg-enviar .fecha').onclick = () => document.getElementById('dlg-enviar').close();
    document.querySelector('#dlg-ajuda .fecha').onclick = () => document.getElementById('dlg-ajuda').close();
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
    // Copiar JSON (01/10): no link do claude.ai baixar não funciona e salvar fica só neste navegador; copiado, o usuário
    // cola na conversa. Sem permissão da área de transferência, o JSON vai para a caixa "Colar JSON", selecionado.
    document.getElementById('b-copiar').onclick = () => {
      const txt = formata(this.paraDef()), caixa = document.getElementById('colar');
      const mostra = () => { caixa.value = txt; caixa.focus(); caixa.select(); this.msg('Não deu para copiar sozinho: o JSON está na caixa "Colar JSON", já selecionado — Ctrl+C.'); };
      try {
        navigator.clipboard.writeText(txt).then(() => { dlg.close(); this.msg(`JSON de "${this.f.nome}" copiado (${Math.round(txt.length / 1024)} KB): cole na conversa.`); }, mostra);
      } catch (e) { mostra(); }
    };
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
  // ------------------------------------------------------------------ Mover, estante e enfeites
  retDe(a, b) {
    const c0 = U.clamp(Math.min(a.c, b.c), 0, this.cols - 1), c1 = U.clamp(Math.max(a.c, b.c), 0, this.cols - 1);
    const l0 = U.clamp(Math.min(a.l, b.l), 0, this.lins - 1), l1 = U.clamp(Math.max(a.l, b.l), 0, this.lins - 1);
    return { c0, c1, l0, l1 };
  },
  // a peça no bloco (os blocos dela: o grupo inteiro na saída, portão, porta, escada) ou null (vazio e terreno)
  pecaEm(c, l) {
    const G = this.f.grade, k = G[l][c];
    if (k === '.' || TERRENO.includes(k)) return null;
    if (!GRUPO_INTEIRO.includes(k)) return [[c, l]];
    const vistos = new Set([`${c},${l}`]), fila = [[c, l]], r = [];
    while (fila.length) {
      const [x, y] = fila.pop();
      r.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (this.dentro(nx, ny) && G[ny][nx] === k && !vistos.has(`${nx},${ny}`)) { vistos.add(`${nx},${ny}`); fila.push([nx, ny]); }
      }
    }
    return r;
  },
  // o enfeite embaixo do ponto (o de cima primeiro), ou -1
  decoEm(wx, wy) {
    const L = this.f.decoracao || [];
    for (let i = L.length - 1; i >= 0; i--) {
      const d = L[i], img = Objetos.imgs[`decoracao/${d.p}`];
      if (!img) continue;
      const w = d.a * img.width / img.height, y1 = d.y + ((d.c || 'fundo') === 'fundo' ? DECO.afunda : 0);
      if (wx >= d.x - w / 2 && wx <= d.x + w / 2 && wy >= y1 - d.a && wy <= y1) return i;
    }
    return -1;
  },
  // o chão embaixo do ponto (a linha de cima do primeiro bloco sólido), ou null
  chaoEm(x, y) {
    const c = Math.floor(x / TILE), G = this.f.grade, solido = (l) => '#CFb'.includes(G[l][c]);
    if (c < 0 || c >= this.cols) return null;
    let l = U.clamp(Math.floor(y / TILE), 0, this.lins - 1);
    while (l > 0 && solido(l) && solido(l - 1)) l--; // (dentro do bloco: sobe até o topo dele)
    for (; l < this.lins; l++) if (solido(l)) return l * TILE;
    return null;
  },
  // enfeite novo: no chão embaixo do clique; fica selecionado (com o Selecionar) para ajustar
  poeDeco(b, p) {
    const E = ENFEITES[p], x = Math.round(b.wx / 5) * 5, chao = this.chaoEm(x, b.wy);
    if (chao == null) { this.msg('Sem chão ali embaixo: o enfeite fica em pé num chão.'); return; }
    this.foto();
    this.f.decoracao = this.f.decoracao || [];
    this.f.decoracao.push({ p, x, y: chao + (E.dy || 0), a: E.a, c: E.c || 'fundo' });
    this.escolhe('mover');
    this.sel = { tipo: 'deco', i: this.f.decoracao.length - 1 };
    this.mudou();
    this.msg('Enfeite posto (é só desenho, fica no fundo). Arraste para mudar de lugar; as alças dos cantos mudam o tamanho.');
  },
  // Estante: os blocos vazios do retângulo viram a parte cheia de livros; embaixo fica uma passagem de 4 blocos (se
  // couber). Fica selecionada: as alças mudam o tamanho, o painel muda a passagem e põe o livro-portão
  poeEstante(a, b) {
    const r = this.retDe(a, b), f = this.f;
    if (r.c1 - r.c0 < 1 || r.l1 - r.l0 < 1) { this.msg('Arraste um retângulo de pelo menos 2 × 2 blocos, do topo até o chão.'); return; }
    this.foto();
    f.estantes = (f.estantes || []).filter((e) => e.c1 < r.c0 || e.c0 > r.c1 || e.l1 < r.l0 || e.l0 > r.l1); // (tira a que encavala)
    f.estantes.push(r);
    const passa = r.l1 - r.l0 + 1 >= 6 ? 4 : 0;
    for (let l = r.l0; l <= r.l1 - passa; l++) for (let c = r.c0; c <= r.c1; c++) if (f.grade[l][c] === '.') this._troca(c, l, '#');
    this.escolhe('mover');
    this.sel = { tipo: 'estante', i: f.estantes.length - 1 };
    this.mudou();
    this.msg('Estante posta. Arraste as alças para mudar o tamanho; no painel à direita: a passagem embaixo e o livro-portão.');
  },
  tiraEstante(c, l) {
    const f = this.f, i = (f.estantes || []).findIndex((e) => c >= e.c0 && c <= e.c1 && l >= e.l0 && l <= e.l1);
    if (i < 0) return;
    this.foto();
    const e = f.estantes.splice(i, 1)[0];
    for (let y = e.l0; y <= e.l1; y++) for (let x = e.c0; x <= e.c1; x++) if (f.grade[y][x] === '#') this._troca(x, y, '.');
    this.mudou();
  },
  // ------------------------------------------------------------------ comentários (02/10, usuário: "marco a região que
  // eu quero comentar... aí eu mando enviar e você consegue ler"). Retângulos em blocos, guardados na fase
  // (def.comentarios: { id, c0, l0, c1, l1, texto, enviado? }); o Enviar manda a fase inteira com eles.
  comentEm(wx, wy) {
    const c = Math.floor(wx / TILE), l = Math.floor(wy / TILE);
    // (o menor que contém o ponto: um comentário dentro de outro continua clicável)
    let melhor = -1, area = Infinity;
    (this.f.comentarios || []).forEach((q, i) => {
      const a = (q.c1 - q.c0 + 1) * (q.l1 - q.l0 + 1);
      if (c >= q.c0 && c <= q.c1 && l >= q.l0 && l <= q.l1 && a < area) { melhor = i; area = a; }
    });
    return melhor;
  },
  soltaComent(a, b) {
    const c0 = U.clamp(Math.min(a.c, b.c), 0, this.cols - 1), c1 = U.clamp(Math.max(a.c, b.c), 0, this.cols - 1);
    const l0 = U.clamp(Math.min(a.l, b.l), 0, this.lins - 1), l1 = U.clamp(Math.max(a.l, b.l), 0, this.lins - 1);
    const i = c0 === c1 && l0 === l1 ? this.comentEm(a.wx, a.wy) : -1; // um clique só em cima de um: abre ele
    if (i >= 0) this.abreComent(i);
    else this.abreComent(-1, { c0, l0, c1, l1 });
  },
  abreComent(i, novo = null) {
    const dlg = document.getElementById('dlg-coment'), txt = document.getElementById('coment-texto');
    const q = i >= 0 ? this.f.comentarios[i] : novo;
    document.getElementById('coment-num').textContent = i >= 0 ? `nº ${i + 1}` : 'novo';
    document.getElementById('coment-onde').textContent = `Blocos ${q.c0}-${q.c1} (colunas) × ${q.l0}-${q.l1} (linhas)`;
    txt.value = i >= 0 ? q.texto : '';
    document.getElementById('coment-apaga').hidden = i < 0;
    const fecha = () => { dlg.close(); this.pede(); };
    document.getElementById('coment-ok').onclick = () => {
      const t = txt.value.trim();
      if (!t) { txt.focus(); return; }
      this.foto();
      if (i >= 0) { Object.assign(this.f.comentarios[i], { texto: t }); delete this.f.comentarios[i].enviado; }
      else (this.f.comentarios = this.f.comentarios || []).push(Object.assign({ id: `c${Date.now().toString(36)}`, texto: t }, novo));
      this.mudou(); fecha();
      this.msg(`Comentário guardado na fase (${this.f.comentarios.length} ao todo). Quando terminar: "Enviar comentários", em cima.`);
    };
    document.getElementById('coment-apaga').onclick = () => { this.foto(); this.f.comentarios.splice(i, 1); this.mudou(); fecha(); };
    document.getElementById('coment-cancela').onclick = fecha;
    dlg.showModal(); txt.focus();
  },
  // botões desenhados em cada comentário (mundo, px): o × apaga, o número e o texto abrem para mudar (qualquer ferramenta)
  botaoComent(b) {
    for (const k of (this._comBotoes || []).slice().reverse()) {
      if (k.tipo === 'x' ? Math.hypot(b.wx - k.x, b.wy - k.y) <= k.r * 1.25 : b.wx >= k.x0 && b.wx <= k.x1 && b.wy >= k.y0 && b.wy <= k.y1) return k;
    }
    return null;
  },
  apagaComent(i) {
    this.foto(); this.f.comentarios.splice(i, 1);
    if (this.sel && this.sel.tipo === 'coment') this.sel = null;
    this.mudou(); this.mostraSel();
    this.msg('Comentário apagado (Ctrl+Z desfaz).');
  },
  desenhaComentarios(g, z) {
    const cs = ((this.previa && this.previa.f) || this.f).comentarios || []; // (arrastando um comentário: ele vai junto)
    this._comBotoes = [];
    if (!cs.length) return;
    const ativo = this.peca === 'comentar';
    cs.forEach((q, i) => {
      const x = q.c0 * TILE, y = q.l0 * TILE, w = (q.c1 - q.c0 + 1) * TILE, h = (q.l1 - q.l0 + 1) * TILE;
      g.fillStyle = ativo ? 'rgba(226,52,52,0.22)' : 'rgba(226,52,52,0.14)'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#d93636'; g.lineWidth = 3 / z; g.setLineDash(q.enviado ? [] : [10 / z, 6 / z]); g.strokeRect(x, y, w, h); g.setLineDash([]);
      // número (verde com ✓ depois de enviado) e o começo do texto, no canto do retângulo
      const r = 13 / z;
      g.beginPath(); g.arc(x + r, y + r, r, 0, U.TAU); g.fillStyle = q.enviado ? '#3fb56a' : '#d93636'; g.fill();
      g.fillStyle = '#fffdf6'; g.font = `${15 / z}px ${FONTE_TITULO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(q.enviado ? '✓' : String(i + 1), x + r, y + r + 1 / z);
      // × no outro canto: apaga
      const xx = x + w - r - 3 / z, xy = y + r + 3 / z, s = r * 0.42;
      g.beginPath(); g.arc(xx, xy, r, 0, U.TAU); g.fillStyle = '#fffdf6'; g.fill();
      g.strokeStyle = '#d93636'; g.lineWidth = 2 / z; g.stroke();
      g.lineWidth = 3 / z; g.lineCap = 'round';
      g.beginPath(); g.moveTo(xx - s, xy - s); g.lineTo(xx + s, xy + s); g.moveTo(xx + s, xy - s); g.lineTo(xx - s, xy + s); g.stroke();
      g.lineCap = 'butt';
      this._comBotoes.push({ tipo: 'x', i, x: xx, y: xy, r }, { tipo: 'abre', i, x0: x, y0: y, x1: x + 2 * r, y1: y + 2 * r });
      g.font = `${15 / z}px ${FONTE_FALA}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const max = Math.max(w - 4 * r, 160 / z), linhas = [];
      let lin = '';
      for (const p of q.texto.split(/\s+/)) {
        const t = lin ? `${lin} ${p}` : p;
        if (g.measureText(t).width > max && lin) { linhas.push(lin); lin = p; } else lin = t;
        if (linhas.length === 3) break;
      }
      if (lin && linhas.length < 3) linhas.push(lin);
      const lh = 18 / z, bw = Math.max(...linhas.map((t) => g.measureText(t).width)) + 12 / z, by = y + 2 * r + 4 / z;
      g.fillStyle = 'rgba(255,253,246,0.92)'; g.fillRect(x + 4 / z, by, bw, linhas.length * lh + 6 / z);
      g.fillStyle = '#7a1f1f'; linhas.forEach((t, j) => g.fillText(t, x + 10 / z, by + (j + 1) * lh - 2 / z));
      this._comBotoes.push({ tipo: 'abre', i, x0: x + 4 / z, y0: by, x1: x + 4 / z + bw, y1: by + linhas.length * lh + 6 / z });
    });
  },
  dialogoEnviar() {
    const cs = this.f.comentarios || [], dlg = document.getElementById('dlg-enviar'), ol = document.getElementById('lista-coment');
    if (!cs.length) { this.escolhe('comentar'); this.msg('Nenhum comentário ainda: com "comentar" na mão (já está), arraste um retângulo na fase e escreva.'); return; }
    ol.innerHTML = '';
    cs.forEach((q, i) => {
      const li = document.createElement('li'), t = document.createElement('span'); t.textContent = q.texto;
      const sm = document.createElement('small'); sm.textContent = ` — blocos ${q.c0}-${q.c1} × ${q.l0}-${q.l1}${q.enviado ? ' (já enviado)' : ''}`;
      const x = document.createElement('button'); x.className = 'apaga-coment'; x.textContent = '🗑'; x.title = 'Apagar este comentário';
      x.onclick = () => { this.apagaComent(i); if ((this.f.comentarios || []).length) this.dialogoEnviar(); else dlg.close(); };
      li.append(t, sm, x); ol.appendChild(li);
    });
    document.getElementById('b-apaga-todos').onclick = () => {
      this.foto(); this.f.comentarios = []; this.sel = null; this.mudou(); this.mostraSel(); dlg.close();
      this.msg('Comentários apagados (Ctrl+Z desfaz).');
    };
    document.getElementById('envio-res').textContent = '';
    if (!dlg.open) dlg.showModal();
  },
  async enviaComentarios() {
    const res = document.getElementById('envio-res'), quando = new Date().toISOString(), id = this.salvaId || slug(this.f.nome);
    const pacote = { fase: this.f.nome, id, quando, comentarios: (this.f.comentarios || []).map((q, i) => Object.assign({ n: i + 1,
      px: { x0: q.c0 * TILE, y0: q.l0 * TILE, x1: (q.c1 + 1) * TILE, y1: (q.l1 + 1) * TILE } }, q)), def: this.paraDef() };
    const ok = (onde) => {
      this.foto(); for (const q of this.f.comentarios) q.enviado = quando; this.mudou();
      res.textContent = `Enviado ${onde}. Agora é só avisar na conversa: "mandei os comentários".`;
      this.msg(`Comentários enviados ${onde}.`);
    };
    res.textContent = 'Enviando...';
    // 1) no PC: o servidor do jogo grava fases/comentarios/<fase>-<quando>.json
    try {
      const r = await fetch(`api/comentarios?nome=${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pacote, null, 1) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { ok(`para ${j.arquivo}`); return; }
    } catch (e) { /* sem o servidor do PC */ }
    // 2) no link do claude.ai: o banco de dados do link (o Claude lê de lá)
    try {
      const db = window.claude && typeof claude.use === 'function' ? await claude.use('db') : null;
      if (db) { await db.collection('comentarios').add(pacote); ok('pelo link do claude.ai'); return; }
    } catch (e) { console.warn('comentários: banco do link', e); }
    // 3) sem nenhum dos dois: o pacote vai para a área de transferência, para colar na conversa
    const txt = JSON.stringify(pacote);
    try { await navigator.clipboard.writeText(txt); ok('para a área de transferência: cole na conversa'); }
    catch (e) { res.textContent = 'Não consegui enviar nem copiar: use Abrir → Copiar JSON (os comentários vão junto com a fase).'; }
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
      // enfeite: chão embaixo dele inteiro (a regra do testaFases; senão o pé aparece pendurado num vão)
      if (typeof confereDecoracao === 'function' && Objetos.ativo && Objetos.pronto()) for (const e of confereDecoracao(this.def)) av.push(`Enfeite ${e}.`);
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
    this.guardaRascunho(); // ("Voltar ao editor" abre o rascunho: tem que ser esta, mesmo sem mudança)
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
