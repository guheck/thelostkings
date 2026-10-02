'use strict';

// Sprites: desenhos gerados por IA (OpenArt, GPT Image 2.5) e recortados com tools/recorta.py, no lugar do desenho
// por código. É o padrão (?codigo desliga). Jeitos de desenhar, do melhor para o reserva:
// - quadros inteiros: as animações de assets/<id>/animacoes.js. Sprites.escolhe() acha a animação e o quadro de cada
//   estado do herói, com as transições (freada, pouso, enrolar). O personagem sai inteiro, como foi desenhado.
// - peças no mesmo esqueleto (só o Pudim tem): onde ainda falta quadro. A bola do Pudim é um desenho inteiro girando.
// - o desenho por código, para quem não tem nem uma coisa nem outra naquele estado.
// Ritmo de cada animação: fps, tempos (segundos de cada quadro) ou seq ([quadro, segundos]... em laço); vaiVolta =
// 1-2-3-4-3-2. O andar vai pela distância: passo = px andados por quadro (sem ele, é medido nos pés da folha). contatos
// (quadros com os dois pés no chão) e comeca: fração do ciclo. ancora: 'pe' (padrão: o pé mais baixo no chão), 'base'
// (o chão da fileira: pulinho desenhado continua pulinho) ou 'centro' (voando, caindo: o meio do corpo, que pode girar).
// ajuste: multiplica o tamanho daquela folha. afunda: px da folha que o desenho desce abaixo do chão — o que fica NA
// FRENTE do corpo deitado (língua, migalhas) cai na faixa clara de cima do papelão e o corpo fica no chão.
// Cada personagem só escreve o que muda.
// Ponto do quadro que fica no pé do personagem: [x, y] entre os pontos que o tools/recorta.py mede. 'pe' = barriga
// (bom no Pudim, que é uma barriga); 'cabeca' = a cabeça, que quase não sai do lugar no andar e no ar; 'pes' = o meio dos
// pés no chão (parado, gancho, alavanca: os pés não escorregam); 'centro'/'massa' = pelo meio do corpo, girando no ar.
// 'ar' = no ar: a cabeça na altura de quem está em pé (encolher as pernas sobe os pés, não desce a cabeça), sem o pé
// passar do chão da caixa.
// 'tronco' = a fivela do cinto / a camisa: no andar é o que vai liso para a frente (a cabeça balança com o passo).
// 'massaPe' = o centro de massa em x, o pé no chão em y: para quadro em que os "pés" medidos enganam (lasca de lápis
// caindo, régua deitada, pés para cima, a IA mudando o pé de lugar entre os 2 quadros da alavanca).
const ANCORAS = {
  pe: ['px', 'py'], cabeca: ['hx', 'py'], pes: ['fx', 'py'], base: ['px', 'base'], pesBase: ['fx', 'base'],
  centro: ['cx', 'cy'], massa: ['mx', 'my'], ar: ['hx', 'hy'], tronco: ['tx', 'py'], massaPe: ['mx', 'py'],
};
const RITMO = {
  // freia desligada (28/09): a pose de "freada derrapando", com as mãos para a frente, ficava estranha num andar lento.
  // Parando, ele termina o passo com os dois pés no chão (quadro de contato do andar) e vai para o parado.
  parado: { fps: 3, vaiVolta: true }, freia: { tempos: [0.09, 0.13], desliga: true }, espera: { tempos: [1.3, 0.9], depois: 8, intervalo: 11 },
  anda: { contatos: [0, 0.5], comeca: 0.25 },
  pulo: {}, queda: { fps: 10, ancora: 'centro' }, aterrissa: {},
  bundada: {}, escala: {}, tonto: { fps: 6 }, festa: { fps: 7, ancora: 'base' },
  // alavanca: nos 2 quadros a IA pôs os pés em lugares diferentes — pelo centro do corpo ele não pula de lado
  voa: { fps: 8, ancora: 'centro' }, dor: { fps: 10 }, enrola: {}, alavanca: { ancora: 'massaPe' }, amarra: {}, surfa: { fps: 6 },
  gancho: {}, soco: {},
};
// O desenho não entra no sólido: animações que recuam encostadas (golpe, escada, voo e surfe, não) e a altura das faixas
// do perfil (px acima do pé)
const ENCOSTA = new Set(['parado', 'espera', 'anda', 'empurra', 'freia', 'aterrissa', 'pulo', 'queda', 'tonto', 'dor', 'festa', 'bundada']);
const FAIXA = 10;
// quem encosta a mão no que empurra: a mão fica na face em TODO quadro (o corpo é que mexe um pouco), não só no mais comprido
const POR_QUADRO = new Set(['empurra']);
const Sprites = {
  ativo: false,
  // escala = unidades do esqueleto por pixel da folha original; px/py = ponto de encaixe (junta) na folha original;
  // fator = quanto as imagens salvas foram reduzidas (tools/recorta.py --escala).
  // As peças de membro ficam em pé, com a junta de cima no pivô, e descem ao longo do osso.
  CONJUNTOS: {
    pudim: {
      pasta: 'assets/pudim/',
      escala: 0.13, fator: 0.3,
      esqueleto: {
        tronco: 48, pescoco: 18, raioCabeca: 32,
        ombro: { E: [20, 12], D: [-25, 11] }, quadril: { E: [-12, 5], D: [10, 5] },
        braco: 16, antebraco: 20, coxa: 14, canela: 13, sola: 14,
      },
      pecas: {
        tronco: ['tronco', 325, 430], bracoSup: ['bracoSup', 95, 45], antebraco: ['antebraco', 82, 35], mao: ['mao', 90, 35],
        coxa: ['coxa', 117, 40], canela: ['canela', 107, 35], pe: ['pe', 105, 40],
      },
      cabeca: [285, 300],
      // rolando: um desenho inteiro do Pudim enrolado (girado), em vez das peças — [imagem, px, py, escala]
      bola: ['bola', 387, 545, 0.12],
      // Quadros inteiros. A IA desenha cada folha numa escala; a área do boneco quase não muda com a pose, então o
      // tamanho no jogo sai dela: tamanho = raiz da área do boneco no jogo, em px (a 1ª folha do andar ficava boa em 0,18).
      // (Quem não tem tamanho usa altura: a altura em pé no jogo, medida nos quadros de parado.)
      tamanho: 81.5,
      ritmo: {
        // parado: segura a pose e de vez em quando pisca, olha para cima, enche a bochecha (não troca de cara sem parar)
        parado: { seq: [[0, 1.5], [3, 0.12], [0, 1.3], [1, 0.8], [0, 1.0], [3, 0.12], [0, 0.6], [2, 0.7]] },
        espera: { tempos: [1.3, 0.9], depois: 8, intervalo: 11 }, // segurando o pum... e o alívio
        anda: { comeca: 0.25, igual: true }, // andar tirado de vídeo (ver o Marreta)
        // dor: só o quadro dele sentado no ar (o 2º chuta a perna para a frente e, alternando, parecia que corria)
        dor: { usa: [1] },
      },
      caretas: {
        segurando: 'careta-segurando', feliz: 'careta-feliz', alivio: 'careta-feliz', grito: 'careta-grito', tonto: 'careta-tonto',
        esforco: 'careta-esforco', susto: 'careta-susto', neutro: 'careta-neutro', confia: 'careta-neutro', piscando: 'careta-piscando',
      },
    },
    // Marreta e Fiapo: só quadros inteiros (sem peças); estado sem quadro sai no desenho por código.
    // altura em pé no jogo: a proporção do trio no lineup (Pudim ~117 px), um pouco acima da caixa de colisão.
    // Apoio: pelos pés no chão (a barriga do desenho cai na luva do Marreta e no rolo de corda do Fiapo); pelo tronco
    // (fivela/camisa) no andar; pela cabeça no ar. Andar: 8 quadros tirados de VÍDEO (PixVerse; a IA de imagem não
    // alternava as pernas) — receita no GDD, "Andar por VÍDEO".
    marreta: {
      pasta: 'assets/marreta/', altura: 132, ancora: 'pes',
      ritmo: {
        // parado: guarda de boxeador balançando (sobe na ponta do pé, desce), piscando de vez em quando
        parado: { seq: [[0, 0.2], [1, 0.2], [0, 0.2], [2, 0.2], [0, 0.2], [1, 0.2], [0, 0.2], [2, 0.2], [3, 0.14], [0, 0.2], [1, 0.2], [0, 0.2], [2, 0.26]] },
        espera: { tempos: [1.0, 1.3], depois: 6, intervalo: 9 }, // bate uma luva na outra... e mostra o muque
        // (a fivela some atrás da luva em 2 quadros: a cabeça é mais firme). Andar tirado de vídeo (PixVerse, 1 a
        // cada 3 quadros de um ciclo de 24): tempo igual por quadro
        anda: { ancora: 'cabeca', comeca: 0.25, igual: true },
        // empurrando (30/09, vídeo PixVerse restaurado): cabeça parada (no vídeo ela quase não sai do lugar, e com ela as
        // luvas). A ponta das luvas vai 53 px à frente e a caixa 23: o desenho recua até elas encostarem (Sprites.escolhe).
        // Ciclo do vídeo ~1 s.
        empurra: { ancora: 'cabeca', fps: 7.5 },
        // Golpes: limites = até quando (s desde o E) fica cada quadro. Gancho, 6 quadros: desce · carga (agachado,
        // luva no chão) · disparo (0,03 s) · IMPACTO (acerta aos 0,17 + mundo parado) · pulinho · guarda.
        // Soco reto, 5 quadros: arma · disparo · IMPACTO (0,11) · continua · guarda. Apoio: os pés e o chão da folha
        // (o pulinho desenhado continua pulinho). agacha = quadro de quem segura ↓ antes do E.
        gancho: { limites: [0.05, 0.14, 0.17, 0.34, 0.43], ancora: 'pesBase', agacha: 1 },
        soco: { limites: [0.08, 0.11, 0.26, 0.34], ancora: 'pesBase' },
        pulo: { ancora: 'ar' }, queda: { ancora: 'ar' }, dor: { ancora: 'ar' },
        escala: { ancora: 'cabeca' }, surfa: { ancora: 'cabeca' }, festa: { ancora: 'pesBase' },
      },
      escala: 0.15, fator: 0.3, cabeca: [230, 300],
      caretas: {
        confia: 'careta-confia', neutro: 'careta-confia', feliz: 'careta-feliz', alivio: 'careta-feliz', grito: 'careta-grito',
        tonto: 'careta-tonto', esforco: 'careta-esforco', segurando: 'careta-esforco', susto: 'careta-susto', piscando: 'careta-piscando',
      },
    },
    fiapo: {
      pasta: 'assets/fiapo/', altura: 150, ancora: 'pes',
      ritmo: {
        // parado: sorriso bobo; pisca, olha para cima, olha para trás desconfiado
        parado: { seq: [[0, 1.4], [3, 0.12], [0, 1.0], [1, 0.9], [0, 0.8], [2, 1.0], [0, 0.6], [3, 0.12]] },
        espera: { tempos: [1.4, 1.2], depois: 7, intervalo: 10 }, // bocejo e coçada na cabeça
        anda: { ancora: 'tronco', comeca: 0.25, igual: true }, // andar tirado de vídeo (ver o Marreta)
        // escada: a IA não alternou a mão; de costas ele é simétrico, então o quadro espelhado é a outra mão
        escala: { usa: [1, 2, -1, -2], ancora: 'cabeca' },
        pulo: { ancora: 'ar' }, queda: { ancora: 'ar' }, dor: { ancora: 'ar' },
        surfa: { ancora: 'cabeca' }, voa: { ancora: 'massa' }, festa: { ancora: 'pesBase' },
      },
      // caretas (HUD e marcador de quem está fora da tela): cabeças inteiras, apoiadas no meio do rosto
      escala: 0.15, fator: 0.3, cabeca: [215, 300],
      caretas: {
        neutro: 'careta-neutro', confia: 'careta-neutro', feliz: 'careta-feliz', alivio: 'careta-feliz', grito: 'careta-grito',
        tonto: 'careta-tonto', esforco: 'careta-esforco', segurando: 'careta-esforco', susto: 'careta-susto', piscando: 'careta-piscando',
      },
    },
    // Inimigos (28/09): uma folha de ações (GPT Image, 8 quadros em grade) e, no guarda e no escudeiro, o andar tirado de
    // vídeo. Quem escolhe o quadro é o Inimigo._quadro (inimigos.js). mesmaEscala: as animações da folha do parado usam a
    // escala dele (a área muda muito entre as poses: lápis esticado, deitado amassado). altura = altura do parado no
    // jogo, do tamanho da caixa (CFG_INIMIGO): a ponta do lápis na estocada cai a 102 px do pé (ESTOCADA.alcance).
    // Onde os "pés" medidos enganam, o apoio é o corpo: lascas do lápis caindo (tonto), régua ou lápis deitados ao lado
    // (amassado), pés para cima (nocauteado, que gira pelo meio do corpo).
    // Amassado: o ponto mais baixo vai no chão. A IA desenhou a régua caída 40 px (da folha) abaixo das mãos do escudeiro
    // e o corpo ficava flutuando: a régua foi subida na própria folha até a linha das mãos (original em
    // assets/estudo/revisao/backup/escudeiro/). No guarda, as mãos e a língua já são o mais baixo.
    guarda: { pasta: 'assets/guarda/', altura: 118, ancora: 'pes', mesmaEscala: true, ritmo: {
      anda: { ancora: 'cabeca', igual: true }, tonto: { fps: 5, ancora: 'cabeca' }, derrotado: { ancora: 'massa' }, amassado: { ancora: 'pe' },
      // lápis quebrando na barriga do Pudim (folha guarda-quebra-1, 28/09): impacto e susto. Outra folha, outra escala:
      // o parado dela mede 709 px (o da folha de ações, 516) -> ajuste = (516/709)·√(181916/94962) = 1,007
      quebra: { ajuste: 1.007 } } },
    escudeiro: { pasta: 'assets/escudeiro/', altura: 110, ancora: 'pes', mesmaEscala: true, ritmo: {
      anda: { ancora: 'cabeca', igual: true }, derrotado: { ancora: 'massa' }, amassado: { ancora: 'pe' } } },
    // borracha: o andar veio de vídeo (os pezinhos da folha da IA quase não mudavam): ciclo de 16,5 quadros a 24/s
    // = 0,69 s; a 190 px/s dá 131 px por ciclo, 16 px por quadro. A medida vem da folha de ações (derrapando, 41 px
    // = a mesma escala de antes); o andar, de outra folha, acerta pela área.
    // amassado: a língua pendurada desce 20 px (da folha) abaixo dos pezinhos; sem afundar, ela ia no chão e o corpo
    // ficava ~3 px no ar.
    borracha: { pasta: 'assets/borracha/', altura: 41, ref: 'freia', ancora: 'massaPe', mesmaEscala: true, ritmo: {
      anda: { passo: 16 }, freia: { desliga: false }, derrotado: { ancora: 'massa' }, amassado: { afunda: 20 } } },
    grampeador: { pasta: 'assets/grampeador/', altura: 40, ancora: 'pes', mesmaEscala: true, ritmo: { parado: { fps: 2 } } },
    // lixeira (folha lixeira-1, 28/09; a bolinha voando do quadro "atira" saiu por código: o jogo tem a de verdade).
    // Apoio no fundo do cesto: inclinando (arma, susto) ela gira em volta dele. Nocauteada gira pelo corpo.
    // tesoureiro (folha tesoureiro-1, 28/09): mesma escala do guarda; apoio na fivela (a tesoura comprida não puxa o
    // corpo para trás). Correndo, as pernas são uma roda de desenho animado (2 quadros).
    tesoureiro: { pasta: 'assets/tesoureiro/', altura: 113, ancora: 'tronco', mesmaEscala: true, ritmo: {
      corre: { fps: 14 }, derrotado: { ancora: 'massa' }, amassado: { ancora: 'massaPe' } } },
    lixeira: { pasta: 'assets/lixeira/', altura: 62, ancora: 'pes', mesmaEscala: true, ritmo: { derrotado: { ancora: 'massa' } } },
    // blindado (folha blindado-1, 01/10): soldadinho de lata de corda, tampinha de garrafa de capacete. Andar de
    // brinquedo: passo, parado, o outro passo, parado (os 2 quadros de andar e o parado, a cada 12 px)
    blindado: { pasta: 'assets/blindado/', altura: 110, ancora: 'pes', mesmaEscala: true, ritmo: {
      anda: { usa: [2, 1, 3, 1], passo: 12 }, cai: { ancora: 'massa' }, derrotado: { ancora: 'massa' } } },
  },
  imgs: {},
  prontos: {},
  _falta: {},

  // carrega as imagens e troca o esqueleto do personagem pelas proporções do desenho (padrão; ?codigo desliga)
  init() {
    if (!U.arteIA()) return;
    this.ativo = true;
    for (const id in this.CONJUNTOS) {
      const C = this.CONJUNTOS[id];
      const r = C.ritmo || {};
      C.ritmo = {};
      // as do RITMO e as só do personagem (amassado, nocauteado... dos inimigos não estão no RITMO)
      for (const n of new Set([...Object.keys(RITMO), ...Object.keys(r)])) C.ritmo[n] = Object.assign({}, RITMO[n], r[n]);
      if (C.esqueleto) { Cast[id].pVetor = Cast[id].p; Cast[id].p = C.esqueleto; }
      this._conta(id, 1); // o manifesto das animações (ele chama Sprites.anims() antes do onload)
      this._carrega(id, [...Object.values(C.pecas || {}).map((q) => q[0]), ...Object.values(C.caretas || {}), ...(C.bola ? [C.bola[0]] : [])], true);
      const s = document.createElement('script');
      s.src = `${C.pasta}animacoes.js`;
      s.onload = s.onerror = () => this._conta(id, -1);
      document.head.appendChild(s);
    }
  },
  pronto(id) { return this.ativo && !!this.prontos[id]; },

  _conta(id, k) {
    this._falta[id] = (this._falta[id] || 0) + k;
    if (this._falta[id] > 0) return;
    this.prontos[id] = true;
    if (typeof Jogo !== 'undefined' && Jogo.congelado) Jogo.pinta(); // screenshot: redesenha com os desenhos
  },
  _carrega(id, nomes, escura) {
    const C = this.CONJUNTOS[id];
    for (const n of new Set(nomes)) {
      const chave = `${id}:${n}`;
      if (this.imgs[chave]) continue;
      this.imgs[chave] = {};
      this._conta(id, 1);
      const img = new Image();
      img.onload = () => { this.imgs[chave] = { img, escura: escura ? this._escurece(img) : img }; this._conta(id, -1); };
      img.onerror = () => { console.warn(`sprite faltando: ${img.src}`); this._conta(id, -1); };
      img.src = `${C.pasta}${n}.png`;
    }
  },

  // Chamado por assets/<id>/animacoes.js (gerado pelo tools/recorta.py): registra as animações e carrega os quadros
  anims(id, dados) {
    const C = this.CONJUNTOS[id];
    if (!C) return;
    const A = (C.anims = {});
    for (const nome in dados) {
      const a = dados[nome];
      if (!a || !Array.isArray(a.quadros) || !a.quadros.length) continue; // formato antigo: ignora
      a.r = C.ritmo[nome] || {};
      if (a.r.desliga) continue; // animação desligada no ritmo (os quadros ficam na pasta, para voltar atrás)
      // usa: só esses quadros, nessa ordem (1 = o primeiro da folha; negativo = o mesmo quadro espelhado)
      if (a.r.usa) a.quadros = a.r.usa.map((n) => Object.assign({}, a.quadros[Math.abs(n) - 1], n < 0 ? { espelho: true } : {}));
      a.duracao = a.r.seq ? a.r.seq.reduce((s, p) => s + p[1], 0)
        : a.r.tempos ? a.quadros.reduce((s, q, j) => s + this._tempo(a.r, j), 0) : a.quadros.length / (a.r.fps || 10);
      A[nome] = a;
    }
    const ref = (C.ref && A[C.ref]) || A.parado || A.anda; // C.ref: a animação que dá a medida (altura é a dela)
    if (!C.tamanho && C.altura && ref) C.tamanho = (C.altura / this._mediana(ref.quadros.map((q) => q.h))) * Math.sqrt(ref.area);
    const sRef = ref ? (C.tamanho / Math.sqrt(ref.area)) * (ref.r.ajuste || 1) : 0;
    for (const a of Object.values(A)) { // px do jogo por px da folha
      a.s = C.mesmaEscala && ref && a.folha === ref.folha ? sRef : (C.tamanho / Math.sqrt(a.area)) * (a.r.ajuste || 1);
    }
    if (A.anda) this._passos(A.anda, C);
    // altura do meio do corpo acima do pé (para os quadros desenhados pelo centro / centro de massa)
    C.alturaCentro = ref ? this._mediana(ref.quadros.map((q) => (q.py - q.cy) * ref.s)) : 50;
    C.alturaMassa = ref && ref.quadros[0].my != null ? this._mediana(ref.quadros.map((q) => (q.py - q.my) * ref.s)) : C.alturaCentro;
    C.alturaCabeca = ref && ref.quadros[0].hy != null ? this._mediana(ref.quadros.map((q) => (q.py - q.hy) * ref.s)) : C.alturaCentro;
    this._carrega(id, Object.values(A).flatMap((a) => a.quadros.map((q) => q.img)), false);
  },
  _mediana(v) { const o = [...v].sort((a, b) => a - b); return o.length ? o[o.length >> 1] : 0; },
  _tempo(r, j) { return r.tempos[Math.min(j, r.tempos.length - 1)]; },

  // Andar: quanto o corpo anda enquanto cada quadro fica na tela = quanto o pé plantado recua até o quadro seguinte,
  // medido na folha (pes = [x a partir da cabeça, altura acima do chão]). Assim o pé fica no chão em vez de patinar,
  // mesmo quando a IA desenhou passos de tamanhos diferentes. Folha antiga (pes = só x no chão): passo igual para todos.
  _passos(a, C) {
    const Q = a.quadros, k = Q.length;
    const novo = Q.every((q) => Array.isArray(q.pes) && q.pes.length && Array.isArray(q.pes[0]));
    // x de cada pé a partir do ponto de apoio da animação (o que fica parado na tela é o apoio)
    const [kx] = this._ancora(C, a);
    const rel = (q, f) => q.hx + f[0] - (q[kx] ?? q.hx);
    if (a.r.passo) a.passos = Q.map(() => a.r.passo);
    else if (novo) {
      // O pé plantado de um quadro para o seguinte (quanto ele recua = quanto o corpo anda):
      // saindo de um contato (dois pés no chão), é o pé da FRENTE, que recebe o peso; chegando num contato, é o de
      // TRÁS (o que ainda empurra); no meio do passo, o único pé no chão.
      a.passos = Q.map((q, j) => {
        const p = Q[(j + 1) % k];
        const chaoQ = q.pes.filter((f) => f[1] <= 0.06 * q.h).map((f) => rel(q, f)).sort((u, v) => u - v);
        const chaoP = p.pes.filter((f) => f[1] <= 0.04 * p.h).map((f) => rel(p, f)).sort((u, v) => u - v);
        if (!chaoQ.length || !chaoP.length) return null;
        let de = chaoQ[0], para = chaoP[0];
        if (chaoQ.length >= 2) { // sai de um contato: o pé da frente, e no quadro seguinte o que recuou menos
          de = chaoQ[chaoQ.length - 1];
          para = chaoP.filter((x) => de - x >= -10).sort((u, v) => (de - u) - (de - v))[0];
          if (para == null) return null;
        }
        // pé que foi um pouco para a frente (a IA desenhou o "subida" quase no lugar do contato): quadro rápido
        return Math.max(0, de - para) * a.s;
      });
      if (a.passos.some((p) => p == null)) a.passos = null;
    }
    if (!a.passos) { const p = this._passoAntigo(a); a.passos = Q.map(() => p); }
    // Quadros tirados de vídeo (igual: true): o vídeo já anda em ritmo constante e os quadros foram pegos a intervalos
    // iguais — cada um fica o mesmo tanto. O ciclo = 2 passos, e o passo = a abertura dos pés no contato (os dois no
    // chão, o de trás na ponta e o da frente no calcanhar): somar o recuo quadro a quadro acumula o erro da medição.
    if (a.r.igual) {
      const abertura = Q.filter((q) => Array.isArray(q.pes))
        .map((q) => q.pes.filter((f) => Array.isArray(f) && f[1] <= 0.06 * q.h).map((f) => f[0]))
        .filter((xs) => xs.length >= 2).map((xs) => Math.max(...xs) - Math.min(...xs));
      const total = abertura.length ? 2 * Math.max(...abertura) * a.s : a.passos.reduce((s, p) => s + p, 0);
      a.passos = Q.map(() => total / k);
    }
    // Nenhum quadro some: quadro que ficaria na tela quase nada (o pé da frente ainda no ar antes do contato) ganha
    // um mínimo, tirado do quadro de antes. Troca um tiquinho de pé escorregando por ver a perna chegando.
    const med = a.passos.reduce((s, p) => s + p, 0) / k, minimo = (a.r.minimo ?? 0.3) * med;
    for (let j = 0; j < k; j++) {
      if (a.passos[j] >= minimo) continue;
      const ant = (j - 1 + k) % k, tira = Math.min(minimo - a.passos[j], Math.max(0, a.passos[ant] - minimo));
      a.passos[ant] -= tira; a.passos[j] += tira;
    }
    a.ciclo = a.passos.reduce((s, p) => s + p, 0) || 1;
    a.passo = a.ciclo / k;
  },
  _passoAntigo(a) {
    const Q = a.quadros, d = [];
    Q.forEach((q, j) => {
      const prox = Q[(j + 1) % Q.length].pes || [];
      for (const x0 of q.pes || []) {
        const recuos = prox.map((x1) => x0 - x1).filter((r) => r > -8); // o pé plantado só vai para trás
        if (recuos.length) d.push(Math.min(...recuos));
      }
    });
    const med = this._mediana(d.filter((r) => r > 2));
    return med ? med * a.s : 92 / Q.length;
  },
  // x dos pés no recorte (folha nova: a partir da cabeça; antiga: a partir da barriga)
  _pesX(q) { return (q.pes || []).map((p) => (Array.isArray(p) ? q.hx + p[0] : q.px + p)); },

  // Quadro do tempo t numa animação (laço, ida-e-volta ou parando no último)
  _noTempo(a, t, laco = true) {
    const r = a.r, k = a.quadros.length;
    if (r.seq) {
      if (laco) t %= a.duracao;
      for (let j = 0, s = 0; j < r.seq.length; j++) if (t < (s += r.seq[j][1])) return Math.min(r.seq[j][0], k - 1);
      return Math.min(r.seq[r.seq.length - 1][0], k - 1);
    }
    if (r.tempos) {
      if (laco) t %= a.duracao;
      for (let j = 0, s = 0; j < k; j++) if (t < (s += this._tempo(r, j))) return j;
      return k - 1;
    }
    const n = Math.floor(t * (r.fps || 10));
    if (r.vaiVolta && k > 2) { const p = n % (2 * k - 2); return p < k ? p : 2 * k - 2 - p; }
    return laco ? n % k : Math.min(n, k - 1);
  },

  // Animação e quadro para o estado do herói: { anim, i, gira?, ancora? }, ou null (peças no esqueleto / bola girando).
  // h.spr guarda o que estava tocando e desde quando, para as transições.
  // O desenho passa da caixa (30/09, o usuário viu as luvas do Marreta dentro do bloco: parado, elas vão 47 px à frente e
  // a caixa 23; o pé do Fiapo andando vai 42 e a caixa 16; a barriga do Pudim 45 e a caixa 36). Encostado num sólido, o
  // desenho recua o quanto entraria nele, faixa a faixa de altura (o perfil da animação, medido nos pixels), entrando e
  // saindo suave. A caixa (a física) não muda.
  // Empurrando, a mão encosta quadro a quadro (30/09, o usuário viu ~2 px de vão na parede): o recuo pelo quadro mais
  // comprido entra suave e a diferença de cada quadro entra na hora.
  escolhe(h, t, nivel) {
    const Q = this._escolhe(h, t), m = h.spr;
    if (!m) return Q;
    const encosta = Q && nivel && ENCOSTA.has(Q.nome), dtq = U.clamp(t - (m.tq ?? t), 0, 0.1);
    const alvo = encosta ? this._encosta(h, Q.nome, nivel) : 0;
    m.tq = t; m.dx = (m.dx || 0) + (alvo - (m.dx || 0)) * Math.min(1, dtq * 18);
    const dx = m.dx + (encosta && POR_QUADRO.has(Q.nome) ? this._encosta(h, Q.nome, nivel, Q.i) - alvo : 0);
    if (Q && dx) Q.dx = (Q.dx || 0) + dx;
    return Q;
  },

  // quanto mexer o desenho em x para ele não entrar no sólido da frente nem no das costas (i: só o quadro i)
  _encosta(h, nome, n, i) {
    const P0 = this._perfil(h.id, nome);
    if (!P0) return 0;
    const P = i == null ? P0 : P0.q[i], aperta = i == null ? 0 : 0.5; // a mão aperta meio px: o contorno junta com o da parede
    const meia = h.cfg.w / 2, f = h.f;
    let frente = 0, costas = 0;
    for (let k = 0; k < P.frente.length; k++) {
      const y0 = h.y - (k + 1) * FAIXA, y1 = h.y - k * FAIXA - 1;
      if (P.frente[k] > meia) frente = Math.max(frente, P.frente[k] - aperta - this._livre(n, h.x, f, meia, P.frente[k], y0, y1));
      if (P.costas[k] > meia) costas = Math.max(costas, P.costas[k] - this._livre(n, h.x, -f, meia, P.costas[k], y0, y1));
    }
    return f * (costas - frente);
  },
  // até onde está livre para o lado s (px a partir do meio da caixa, de meia até ate), entre as alturas y0 e y1 (os
  // blocos e o estojo de zíper, que também é uma face: quem empurra encosta a mão nele)
  _livre(n, x, s, meia, ate, y0, y1) {
    const l0 = Math.floor(y0 / TILE), l1 = Math.floor(y1 / TILE);
    let livre = ate;
    for (let c = Math.floor((x + s * (meia + 0.5)) / TILE); ; c += s) {
      const face = s > 0 ? c * TILE - x : x - (c + 1) * TILE;
      if (face >= ate) break;
      let bate = false;
      for (let l = l0; l <= l1; l++) if (n.solido(c, l)) bate = true;
      if (bate) { livre = Math.max(meia, face); break; }
    }
    for (const e of n.estojos || []) {
      const k = e.caixa(), face = s > 0 ? k.x0 - x : x - k.x1;
      if (k.y1 > y0 && k.y0 < y1 && face >= meia - 1 && face < livre) livre = Math.max(meia, face);
    }
    return livre;
  },
  // Perfil da animação: até onde o desenho vai para a frente e para as costas (px do jogo a partir do meio da caixa,
  // olhando para a direita), por faixa de altura acima do pé; o de cada quadro (q) e o maior deles. Medido uma vez, até
  // a borda suavizada do contorno (alfa 40: com 100 sobrava um fio de vão entre a luva e a parede); a mão de quem
  // empurra, desenhada a 4x (de 0,25 em 0,25 px: pixel inteiro deixava a luva variar 1 px de um quadro para o outro).
  _perfil(id, nome) {
    const a = this.CONJUNTOS[id].anims[nome];
    if (a._perfil !== undefined) return a._perfil;
    if (a.quadros.some((q) => !this._img(id, q.img))) return null; // carregando: mede depois
    const L = 400, px = L / 2, py = L - 40, nf = Math.ceil(py / FAIXA), zeros = () => new Array(nf).fill(0);
    const Z = POR_QUADRO.has(nome) ? 4 : 1, LZ = L * Z, P = { frente: zeros(), costas: zeros(), q: [] };
    try {
      const c = document.createElement('canvas'); c.width = c.height = LZ;
      const g = c.getContext('2d', { willReadFrequently: true });
      for (let i = 0; i < a.quadros.length; i++) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, LZ, LZ); g.setTransform(Z, 0, 0, Z, 0, 0);
        this.quadro(g, id, { anim: a, nome, i }, { f: 1, pe: { x: px, y: py } });
        const d = g.getImageData(0, 0, LZ, LZ).data, Q = { frente: zeros(), costas: zeros() };
        for (let y = 0; y < py * Z; y++) {
          let x0 = 0, x1 = LZ - 1;
          while (x0 < LZ && d[(y * LZ + x0) * 4 + 3] < 40) x0++;
          if (x0 === LZ) continue;
          while (d[(y * LZ + x1) * 4 + 3] < 40) x1--;
          const k = Math.floor((py * Z - 1 - y) / (FAIXA * Z));
          Q.frente[k] = Math.max(Q.frente[k], (x1 + 1) / Z - px); Q.costas[k] = Math.max(Q.costas[k], px - x0 / Z);
        }
        P.q.push(Q);
        for (let k = 0; k < nf; k++) { P.frente[k] = Math.max(P.frente[k], Q.frente[k]); P.costas[k] = Math.max(P.costas[k], Q.costas[k]); }
      }
    } catch (e) { return (a._perfil = null); } // (página aberta do disco: o navegador não deixa ler os pixels)
    return (a._perfil = P);
  },

  _escolhe(h, t) {
    const C = this.CONJUNTOS[h.id], A = C && C.anims;
    if (!A) return null;
    const e = h.estado, te = h.tEst;
    const m = h.spr || (h.spr = { nome: null, t0: t, d0: 0 });
    const dist = h.fase / 0.055; // h.fase cresce 0,055 por px andado no chão
    const toca = (n) => { if (m.nome !== n) { m.nome = n; m.t0 = t; m.d0 = dist; } return t - m.t0; };
    const Q = (n, i, extra) => Object.assign({ anim: A[n], nome: n, i: U.clamp(i, 0, A[n].quadros.length - 1) }, extra);
    const ultimo = (n) => A[n].quadros.length - 1;
    const anda = e === 'chao' && Math.abs(h.vx) > 20;

    // estados com animação própria
    if (e === 'rolando') { // enrolando (depois é a bola girando)
      if (te < 0.12 && A.enrola) { toca('enrola'); return Q('enrola', Math.floor(te / 0.06)); }
      m.nome = 'bola';
      return null;
    }
    if (e === 'arremessado' && A.voa) { const tt = toca('voa'); return Q('voa', this._noTempo(A.voa, tt), { gira: tt * 7 * h.f }); }
    if (e === 'machucado' && A.dor) return Q('dor', this._noTempo(A.dor, toca('dor')));
    if ((e === 'tonto' || e === 'caido') && A.tonto) return Q('tonto', this._noTempo(A.tonto, toca('tonto')));
    if (e === 'festa' && A.festa) return Q('festa', this._noTempo(A.festa, toca('festa')));
    if ((e === 'escada' || e === 'escalando') && A.escala) { toca('escala'); return Q('escala', Math.floor(h.fase / (Math.PI / 2)) % A.escala.quadros.length); }
    if (e === 'bundada' && A.bundada) { toca('bundada'); return Q('bundada', te < 0.08 ? 0 : 1); }
    if (e === 'amarrando') { // puxando a alavanca, ou o Fiapo amarrando a corda
      const n = h.puxou === false && A.amarra ? 'amarra' : A.alavanca ? 'alavanca' : null;
      // alavanca: mãos no alto (alcança) e depois embaixo (puxa o cabo para baixo); desligando, ao contrário
      const i = te < 0.12 ? 0 : 1;
      if (n) { toca(n); return Q(n, n === 'alavanca' && h.desliga ? 1 - i : i); }
    }
    // Golpes do Marreta: cada quadro até o seu limite de tempo (ritmo.limites, em s desde o E). A física acerta em
    // GOLPES[...].acerta (heroi.js) e o mundo para um instante no impacto: o quadro do impacto fica segurado.
    if ((e === 'gancho' || e === 'soco') && A[e]) {
      if (m.nome !== e) m.jaAgachado = m.nome === 'agacha'; // vinha segurando ↓: já está na carga, pula a descida
      toca(e);
      const L = A[e].r.limites || [];
      let i = 0;
      while (i < L.length && te >= L[i]) i++;
      if (m.jaAgachado && e === 'gancho') i = Math.max(i, A.gancho.r.agacha || 0);
      return Q(e, i);
    }
    // segurando ↓ parado, o Marreta já agacha para o gancho (↓ + E)
    if (e === 'chao' && h.id === 'marreta' && h.seguraBaixo && !anda && A.gancho) { toca('agacha'); return Q('gancho', A.gancho.r.agacha || 0); }
    if (e === 'ar') {
      if (h.vy > 650 && A.queda) return Q('queda', this._noTempo(A.queda, toca('queda')));
      if (!A.pulo) return null;
      toca('pulo');
      return Q('pulo', h.vy < -150 ? (te < 0.07 ? 0 : 1) : h.vy <= 150 ? 2 : 3);
    }
    if (e !== 'chao') return null;
    if (h.apoio && h.apoio.tipo === 'tirolesa') { // surfando a corda: inclina morro abaixo e desce até a corda passar entre os pés
      if (!A.surfa) return null;
      const q0 = A.surfa.quadros[0], ax = q0[this._ancora(C, A.surfa)[0]] ?? q0.px;
      const ang = Math.min(1.1, Math.abs(h.apoio.ang || 0.6)), frente = Math.max(0, ...this._pesX(q0).map((x) => x - ax)) * A.surfa.s;
      return Q('surfa', this._noTempo(A.surfa, toca('surfa')), { gira: h.f * ang * 0.35, dy: frente * 0.5 * Math.tan(ang) });
    }

    // chegando no chão: o fim da bundada (sentado, depois orgulhoso), desenrolar, o pouso. Andando, a transição encurta.
    if (h.antes === 'bundada' && te < (anda ? 0.15 : 0.45) && A.bundada && A.bundada.quadros.length >= 4) { toca('senta'); return Q('bundada', te < 0.25 ? 2 : 3); }
    if (h.antes === 'rolando' && te < 0.12 && A.enrola) { toca('desenrola'); return Q('enrola', ultimo('enrola') - Math.floor(te / 0.06)); }
    if (h.antes === 'ar' && (h.tAntes || 0) > 0.12 && te < (anda ? 0.07 : 0.16) && A.aterrissa) { toca('aterrissa'); return Q('aterrissa', te < 0.08 ? 0 : 1); }

    // empurrando (travado de frente num bloqueio alto, segurando para o lado dele): as pernas andam no lugar, as luvas
    // paradas na face do bloqueio (o desenho recua até elas encostarem: escolhe)
    if (h.empurra && A.empurra) {
      const tt = toca('empurra');
      return Q('empurra', this._noTempo(A.empurra, tt));
    }
    // andando: o quadro vai pela distância (cada quadro fica o quanto o pé plantado recua nele), começando numa passada
    const k = A.anda ? A.anda.quadros.length : 0;
    const contatos = A.anda ? (A.anda.r.contatos || [0]).map((c) => Math.round(c * k) % k) : [];
    if (anda && A.anda) {
      const W = A.anda;
      if (m.nome !== 'anda') { toca('anda'); m.i0 = Math.round((W.r.comeca || 0) * k); }
      let u = dist - m.d0;
      for (let j = 0; j < m.i0; j++) u += W.passos[j];
      u %= W.ciclo;
      let i = 0;
      while (i < k - 1 && u >= W.passos[i]) u -= W.passos[i++];
      m.i = i;
      return Q('anda', i);
    }
    // parou de andar: a freada (o corpo vai para a frente e volta); sem ela, termina o passo com os dois pés no chão
    if (m.nome === 'anda' || m.nome === 'freia' || m.nome === 'para') {
      if (A.freia) {
        const tt = toca('freia');
        if (tt < A.freia.duracao) return Q('freia', this._noTempo(A.freia, tt, false));
      } else if (A.anda) {
        if (m.nome === 'anda') { const i = m.i; m.ip = contatos.reduce((b, c) => (Math.abs(c - i) < Math.abs(b - i) ? c : b)); }
        if (toca('para') < 0.1) return Q('anda', m.ip);
      }
    }
    // parado: respirando; de vez em quando (parado há um tempo), a espera — segurando o pum
    const tp = toca('parado');
    if (A.parado) {
      const r = A.espera && A.espera.r;
      if (r && tp > r.depois) {
        const u = (tp - r.depois) % (A.espera.duracao + r.intervalo);
        if (u < A.espera.duracao) return Q('espera', this._noTempo(A.espera, u, false));
      }
      return Q('parado', this._noTempo(A.parado, tp));
    }
    return A.anda ? Q('anda', contatos[0]) : null; // sem quadros de parado: o do andar com os dois pés no chão
  },

  careta(id, rosto) {
    const C = this.CONJUNTOS[id], nome = rosto && rosto.nome;
    if (rosto && rosto.olhos === 'normal' && rosto.palp >= 0.5) return C.caretas.piscando;
    return C.caretas[nome] || C.caretas.neutro;
  },

  _img(id, nome, escura) { const q = this.imgs[`${id}:${nome}`]; return q && (escura ? q.escura : q.img); },

  // cópia mais escura (membros do lado de trás), feita uma vez
  _escurece(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(40,20,50,0.22)';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  },

  // desenha a imagem com o ponto (px, py) da folha original na origem
  _peca(ctx, id, nome, px, py, escura) {
    const im = this._img(id, nome, escura), C = this.CONJUNTOS[id], s = C.escala, k = s / C.fator;
    if (im) ctx.drawImage(im, -px * s, -py * s, im.width * k, im.height * k);
  },

  // false = não tem caretas: fica a cabeça por código
  cabeca(ctx, ch, st) {
    const C = this.CONJUNTOS[ch.id];
    if (!C.caretas) return false;
    this._peca(ctx, ch.id, this.careta(ch.id, st.rosto), C.cabeca[0], C.cabeca[1]);
    return true;
  },

  // As poses de código abrem os braços do Pudim redondo para os lados; no desenho da IA os braços caem do lado da
  // barriga. Parado/andando/festa, os braços ficam pendurados (e balançam andando), sem cruzar a barriga.
  ajustaPose(id, e, pose, fase) {
    if (id !== 'pudim') return pose;
    if (e === 'chao' || e === 'amarrando' || e === 'tonto') {
      const s = fase == null ? 0 : Math.sin(fase) * 0.35;
      return Object.assign({}, pose, { bracoD: 0.1 + s, cotoveloD: 0.3, bracoE: -0.05 - s, cotoveloE: 0.3 });
    }
    if (e === 'festa') return Object.assign({}, pose, { bracoD: 2.7, cotoveloD: 0.3, bracoE: 2.5, cotoveloE: 0.3 });
    return pose;
  },

  // Uma animação tocando pelo tempo, fora do jogo (menu): pés em (x, y), esc = vezes o tamanho do jogo. false = não tem.
  desenhaAnim(ctx, id, nome, t, x, y, f, esc = 1) {
    const C = this.CONJUNTOS[id], a = this.pronto(id) && C.anims && C.anims[nome];
    if (!a) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(esc, esc);
    this.quadro(ctx, id, { anim: a, i: this._noTempo(a, t) }, { f, pe: { x: 0, y: 0 } });
    ctx.restore();
    return true;
  },

  // Qual ponto do quadro fica no pé do personagem: [campo x, campo y] do manifesto (ver ANCORAS)
  _ancora(C, a, Q) {
    const modo = (Q && Q.ancora) || a.r.ancora || C.ancora || 'pe';
    return ANCORAS[modo] || ANCORAS.pe;
  },

  // Quadro inteiro (de Sprites.escolhe): o pé no chão do personagem, ou o meio do corpo (voando, girando)
  quadro(ctx, id, Q, st) {
    const C = this.CONJUNTOS[id], a = Q.anim, q = a.quadros[Q.i], s = a.s, k = s / a.fator, im = this._img(id, q.img);
    const [kx, ky] = this._ancora(C, a, Q), f = st.f || 1, solto = ky === 'cy' || ky === 'my' || ky === 'hy';
    const ax = q[kx] ?? q.px, ay = q[ky] ?? q.py; // folhas antigas não têm os pontos novos
    let y = st.pe.y + (Q.dy || 0) + (a.r.afunda || 0) * s;
    if (ky === 'cy') y -= C.alturaCentro; else if (ky === 'my') y -= C.alturaMassa;
    else if (ky === 'hy') y = Math.min(y - C.alturaCabeca, y - (q.py - ay) * s); // no ar: cabeça em pé, pé não passa da caixa
    ctx.save();
    ctx.translate(st.pe.x + (Q.dx || 0), y);
    if (st.squash && !solto) ctx.scale(1 + st.squash, 1 - st.squash);
    if (Q.gira) ctx.rotate(Q.gira);
    ctx.scale(q.espelho ? -f : f, 1);
    ctx.imageSmoothingQuality = 'high';
    if (im) ctx.drawImage(im, -ax * s, -ay * s, im.width * k, im.height * k);
    ctx.restore();
    if (st.amarrado) { // corda amarrada na barriga (é daí que ela sai: Cordas.ponto)
      const cx = st.pe.x + f * 2, cy = st.pe.y - 42;
      Estilo.traco(ctx, (c) => { c.beginPath(); c.ellipse(cx, cy, 37, 6, 0, 0.05, Math.PI - 0.05); }, '#c89a5b', 4, { elev: 1, contorno: true });
    }
  },

  // Quadro inteiro, a bola girando ou a mesma montagem do Desenho.personagem, peça por peça.
  // false = não tem desenho para isso (fica o desenho por código).
  personagem(ctx, ch, M, st) {
    const C = this.CONJUNTOS[ch.id], pc = C.pecas, id = ch.id;
    const f = st.f || 1, esc = st.escala || 1;
    if (st.quadro && st.pe) { this.quadro(ctx, id, st.quadro, st); return true; }
    if (st.giro != null && C.bola) { // rolando: o desenho inteiro da bola, girando
      const [nome, bx, by, bs] = C.bola, im = this._img(id, nome), k = bs / C.fator;
      ctx.save();
      ctx.translate((M.pelve.x + M.peito.x) / 2, (M.pelve.y + M.peito.y) / 2);
      ctx.rotate(st.giro);
      ctx.scale(f * esc, esc);
      if (im) ctx.drawImage(im, -bx * bs, -by * bs, im.width * k, im.height * k);
      ctx.restore();
      return true;
    }
    if (!pc) return false;
    const px = M.pelve.x, py = M.pelve.y;
    const P = Rig.local(M, px, py, f);
    const p = ch.p;
    ctx.save();
    ctx.translate(px, py);
    if (st.squash) {
      const pe = Math.max(P.peE.y, P.peD.y) + p.sola;
      ctx.translate(0, pe * esc);
      ctx.scale(1 + st.squash, 1 - st.squash);
      ctx.translate(0, -pe * esc);
    }
    ctx.scale(f * esc, esc);
    const osso = (A, B, fn) => {
      ctx.save();
      ctx.translate(A.x, A.y);
      ctx.rotate(Math.atan2(B.y - A.y, B.x - A.x) - Math.PI / 2);
      fn();
      ctx.restore();
    };
    const peca = (nome, escura) => this._peca(ctx, id, pc[nome][0], pc[nome][1], pc[nome][2], escura);
    // da ponta para o corpo: cada peça tampa a boca da seguinte (mão debaixo do antebraço, canela debaixo da coxa)
    const braco = (l) => {
      const o = P[`ombro${l}`], c = P[`cotovelo${l}`], m = P[`mao${l}`], esc2 = l === 'E';
      osso(c, m, () => {
        ctx.save(); ctx.translate(0, U.dist(c.x, c.y, m.x, m.y)); peca('mao', esc2); ctx.restore();
        peca('antebraco', esc2);
      });
      osso(o, c, () => peca('bracoSup', esc2));
    };
    const perna = (l) => {
      const q = P[`quadril${l}`], j = P[`joelho${l}`], pe = P[`pe${l}`], esc2 = l === 'E';
      ctx.save();
      ctx.translate(pe.x, pe.y);
      if (!st.pesPlanos) ctx.rotate(Math.atan2(pe.y - j.y, pe.x - j.x) - Math.PI / 2);
      peca('pe', esc2);
      ctx.restore();
      osso(j, pe, () => peca('canela', esc2));
      osso(q, j, () => peca('coxa', esc2));
    };
    braco('E');
    perna('E');
    perna('D');
    ctx.save();
    ctx.translate(P.pelve.x, P.pelve.y);
    ctx.rotate(Math.atan2(P.peito.x - P.pelve.x, -(P.peito.y - P.pelve.y)));
    peca('tronco');
    ctx.restore();
    braco('D');
    // cabeça por último: braço levantado passa por trás dela, não tapa a careta
    ctx.save();
    ctx.translate(P.cabeca.x, P.cabeca.y);
    ctx.rotate(Math.atan2(P.cabeca.x - P.peito.x, -(P.cabeca.y - P.peito.y)));
    this.cabeca(ctx, ch, st);
    ctx.restore();
    ctx.restore();
    return true;
  },
};
