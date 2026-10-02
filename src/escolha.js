'use strict';

// Tela de escolha de fase (index.html e escolha.html). Carregado ANTES dos outros scripts: decide logo de onde o jogo
// lê os parâmetros (window.PARAMETROS_JOGO, ver U.params). Três jeitos:
// - 'publico' (GitHub Pages, itch.io; ?publico mostra assim no PC): a demo — "Jogar" vai da Mesa para a Mesa nova
//   (DEMO) —, as Minhas fases e o editor;
// - 'pc' (no PC e no link do claude.ai): todas as fases — as de fases/*.json (a lista do servidor; sem servidor, as
//   FIXAS), o tutorial, as geradas —, a demo, as Minhas fases e o editor;
// - 'editor' (?fase=~, o ▶ Jogar do editor): o jogo abre direto; o Esc dá Continuar, Recomeçar e Voltar ao editor.
// Link com parâmetro de teste (?fase=, ?sala=, ?demo...) abre o jogo direto, e o Esc abre esta tela (nunca o menu
// antigo). ?t= (congelado para print) fica como sempre foi, sem tela nenhuma.
// A tela abre no começo, no Esc e no botão do canto; o jogo fica parado atrás ('pausa') e a fase troca sem recarregar.
const Escolha = {
  // a demo publicada: vencer uma leva à seguinte; depois da última, a tela de fim
  DEMO: [{ id: 'mesa', nome: 'A Mesa' }, { id: 'mesa3', nome: 'A Mesa nova' }],
  // fases/*.json com descrição (a lista do servidor acrescenta as outras, pelo nome gravado nelas)
  FIXAS: [
    { id: 'mesa', nome: 'A Mesa', sub: 'a fase 1 (a demo publicada)' },
    { id: 'mesa3', nome: 'A Mesa nova', sub: 'esboço 3, a fase 2 da demo: gangorra, carimbos e post-its (trena e estojo de zíper ainda provisórios)' },
    { id: 'teste-gangorra', nome: 'Teste: gangorra', sub: 'a bundada do Pudim lança o Fiapo em arco até a estante' },
    { id: 'teste-carimbo', nome: 'Teste: carimbo', sub: 'por baixo no tempo certo, ou por cima; o lado é parede' },
    { id: 'teste-postits', nome: 'Teste: post-its', sub: 'o Fiapo sobe o zigue-zague' },
    { id: 'teste-estante', nome: 'Teste: estante', sub: 'claro bloqueia, escuro passa; livros deitados de degrau; o livro-portão' },
  ],
  GERADAS: [4, 12], // fases geradas listadas (da 4 em diante saem do gerador), com a semente fixa
  SEMENTE: 7,
  TESTE: ['fase', 'sala', 'demo', 'semente', 'vitrine', 'alt', 'mapa', 'ativo'],
  modo: 'pc',
  publico: false,
  iniciou: false,
  carregou: false,
  acabou: false, // venceu a última fase da demo
  extra: '', // ?codigo continua valendo depois da escolha
  demoDefs: {},

  prepara() {
    // no link do claude.ai o endereço da página não é nosso: só vale o ?fase=~ que o editor põe ao testar
    const noClaude = /claude|anthropic/.test(location.hostname), q0 = new URLSearchParams(location.search);
    const q = noClaude ? new URLSearchParams(q0.get('fase') === '~' ? `fase=~${q0.has('demo') ? '&demo' : ''}` : '') : q0;
    this.extra = q.has('codigo') ? '&codigo' : '';
    const quandoPronto = (fn) => window.addEventListener('load', () => {
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fn);
    });
    if (q.has('t')) { quandoPronto(() => Jogo.init()); return; } // print: como sempre foi
    this.publico = q.has('publico') || /(\.github\.io|(^|\.)itch\.io|(^|\.)itch\.zone|\.hwcdn\.net)$/.test(location.hostname);
    this.modo = q.get('fase') === '~' ? 'editor' : this.publico ? 'publico' : 'pc';
    const direto = this.modo === 'editor' || (!this.publico && this.TESTE.some((k) => q.has(k)));
    if (this.modo === 'editor') window.PARAMETROS_JOGO = `fase=~${q.has('demo') ? '&demo' : ''}${this.extra}`;
    else if (!direto) window.PARAMETROS_JOGO = this.extra.slice(1); // o endereço não vale: a fase vem da escolha
    window.addEventListener('load', () => this.monta());
    quandoPronto(() => {
      this.carregou = true;
      if (!direto) return;
      this.iniciou = true; this.tela.hidden = true; this.trocar.hidden = false;
      Jogo.init().then(() => this.assume());
    });
  },
  // o Esc do jogo abre esta tela
  assume() { Menu.abre = () => this.abre(); },

  // --- tela ------------------------------------------------------------------------------------------------------
  monta() {
    const css = document.createElement('style');
    css.textContent = `
      #escolha { position: fixed; inset: 0; z-index: 5; display: flex; flex-direction: column; align-items: center;
        justify-content: safe center; gap: 14px; overflow-y: auto; padding: 24px 16px; box-sizing: border-box;
        background: rgba(29, 25, 22, 0.93); text-align: center; color: #f1bf3a;
        font: 34px "Luckiest Guy", "Arial Black", sans-serif; }
      #escolha[hidden], #trocar[hidden] { display: none; }
      #gire { z-index: 6; }
      #escolha .sub { font: 22px "Patrick Hand", "Comic Sans MS", sans-serif; color: #fbf7ec; }
      #escolha h2 { margin: 6px 0 0; font: 20px "Luckiest Guy", "Arial Black", sans-serif; color: #c9bba6; letter-spacing: 1px; }
      #escolha .fases { display: grid; gap: 10px; width: min(560px, 100%); }
      #escolha .fases button { display: grid; gap: 2px; text-align: left; padding: 12px 18px; border-radius: 10px; cursor: pointer;
        background: #2b241e; color: #fbf7ec; border: 2px solid #4a3d31; font: 26px "Luckiest Guy", "Arial Black", sans-serif; }
      #escolha .fases button small { font: 19px "Patrick Hand", "Comic Sans MS", sans-serif; color: #c9bba6; }
      #escolha .fases button.continua { border-color: #3fb56a; }
      #escolha .miudas { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: min(560px, 100%); }
      #escolha .minha { display: inline-flex; gap: 4px; }
      #escolha .versao { font: 15px "Patrick Hand", "Comic Sans MS", sans-serif; color: #8f8272; }
      #escolha .miudas button, #escolha .miudas a { padding: 6px 12px; border-radius: 8px; cursor: pointer; background: #2b241e;
        color: #fbf7ec; border: 2px solid #4a3d31; font: 19px "Patrick Hand", "Comic Sans MS", sans-serif; text-decoration: none; }
      #escolha .miudas a.forte { border-color: #f1bf3a; color: #f1bf3a; }
      #escolha button:hover, #escolha button:focus-visible, #escolha a:hover, #escolha a:focus-visible {
        border-color: #f1bf3a; outline: none; color: #f1bf3a; }
      #trocar { position: fixed; bottom: 10px; right: 12px; z-index: 4; font: 18px "Patrick Hand", "Comic Sans MS", sans-serif;
        color: #fbf7ec; background: rgba(29, 25, 22, 0.7); border: 1px solid #4a3d31; border-radius: 8px; padding: 4px 10px; cursor: pointer; }`;
    document.head.appendChild(css);
    this.tela = document.createElement('div');
    this.tela.id = 'escolha';
    document.body.appendChild(this.tela);
    this.trocar = document.createElement('button');
    this.trocar.type = 'button'; this.trocar.id = 'trocar'; this.trocar.hidden = true;
    this.trocar.textContent = this.modo === 'pc' ? 'Trocar fase (Esc)' : 'Menu (Esc)';
    this.trocar.addEventListener('click', () => { this.trocar.blur(); this.abre(); });
    document.body.appendChild(this.trocar);
    // Esc com a tela aberta (e o jogo rodando atrás): volta para a fase como estava
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.tela.hidden && this.iniciou && !this.acabou) { e.stopImmediatePropagation(); this.continua(); }
    }, true);
    this.fases = this.FIXAS;
    this.desenha();
    if (this.modo === 'pc') this._lista(); // o servidor do PC lista fases/ (fase nova aparece sozinha)
  },

  async _lista() {
    try {
      const r = await fetch('api/fases', { cache: 'no-store' });
      if (!r.ok) return;
      const { fases } = await r.json();
      const fixas = this.FIXAS.filter((f) => fases.some((q) => q.id === f.id));
      const novas = fases.filter((q) => !q.erro && !this.FIXAS.some((f) => f.id === q.id)).map((q) => ({ id: q.id, nome: q.nome, sub: `fases/${q.id}.json` }));
      this.servidor = true;
      this.fases = [...fixas, ...novas];
      this.desenha();
    } catch (e) { /* sem servidor (link do claude.ai): fica a lista fixa */ }
  },

  desenha() {
    const t = this.tela, h = (tag, props = {}, filhos = []) => {
      const el = Object.assign(document.createElement(tag), props);
      for (const f of filhos) el.append(f);
      return el;
    };
    const botao = (txt, sub, acao, cls) => {
      const b = h('button', { type: 'button', className: cls || '' }, [txt, ...(sub ? [h('small', { textContent: sub })] : [])]);
      b.addEventListener('click', () => { b.blur(); acao(); });
      return b;
    };
    t.replaceChildren();
    const lista = h('div', { className: 'fases' });
    if (this.iniciou && !this.acabou) lista.append(botao('Continuar', 'volta para a fase como estava (Esc)', () => this.continua(), 'continua'));
    if (this.modo === 'editor') {
      t.append('Testando a sua fase');
      lista.append(botao('Recomeçar', 'a fase do começo', () => this.joga({ fase: '~' })),
        botao('Voltar ao editor', 'a fase continua lá, do jeito que estava', () => this.voltaEditor()));
      t.append(lista);
    } else {
      const demo = botao(this.iniciou ? 'Jogar a demo do começo' : 'Jogar', 'Fase 1: A Mesa · depois, Fase 2: A Mesa nova', () => this.joga({ demo: 0 }));
      if (this.publico) {
        t.append('The Lost Kings', h('div', { className: 'sub', textContent: this.acabou ? 'Você terminou a demo! Obrigado por jogar.' : 'Demo' }));
        lista.append(demo, botao('Fase 2: A Mesa nova', '', () => this.joga({ demo: 1 })));
        t.append(lista);
      } else {
        t.append(this.acabou ? 'Fim da demo! Escolha a fase' : 'Escolha a fase');
        lista.append(demo);
        for (const f of this.fases) lista.append(botao(f.nome, f.sub, () => this.joga({ fase: f.id })));
        t.append(lista);
      }
      this._minhas(t, h, botao);
      if (!this.publico) {
        const tut = h('div', { className: 'miudas' });
        SALAS.forEach((s, i) => tut.append(botao(`${i + 1}. ${s.nome}`, '', () => this.joga({ sala: i + 1 }))));
        const ger = h('div', { className: 'miudas' });
        for (let n = this.GERADAS[0]; n <= this.GERADAS[1]; n++) ger.append(botao(`Fase ${n}`, '', () => this.joga({ sala: n })));
        t.append(h('h2', { textContent: 'Tutorial' }), tut, h('h2', { textContent: `Geradas (semente ${this.SEMENTE})` }), ger);
        if (this.servidor) {
          t.append(h('h2', { textContent: 'Ferramentas' }), h('div', { className: 'miudas' }, [
            h('a', { href: 'index.html?publico', target: '_blank', textContent: 'Ver como a demo publicada' }),
          ]));
        }
      }
    }
    t.append(h('div', { className: 'sub', textContent: '← → anda (2x corre) · ↑ pula · Tab troca · E habilidade · M mapa · V som/música · Esc volta aqui' }));
    // a versão publicada (o tools/monta_dist.js grava na index.html do dist): para conferir se o app atualizou
    if (window.VERSAO_JOGO) t.append(h('div', { className: 'versao', textContent: `versão ${window.VERSAO_JOGO}` }));
    const primeiro = t.querySelector('button');
    if (primeiro && !t.hidden) primeiro.focus();
  },

  // Minhas fases (as salvas no editor, neste navegador): jogar (▶) e editar (✎); e o editor
  _minhas(t, h, botao) {
    const minhas = typeof MinhasFases !== 'undefined' ? MinhasFases.lista() : [];
    const caixa = h('div', { className: 'miudas' });
    for (const f of minhas) {
      caixa.append(h('span', { className: 'minha' }, [
        botao(`▶ ${f.nome}`, '', () => this.joga({ fase: `minha:${f.id}` })),
        h('a', { href: `editor.html?minha=${encodeURIComponent(f.id)}`, title: `Editar ${f.nome}`, textContent: '✎' }),
      ]));
    }
    caixa.append(h('a', { href: 'editor.html', className: 'forte', textContent: '✎ Editor de fases' }));
    t.append(h('h2', { textContent: 'Minhas fases' }));
    if (!minhas.length) t.append(h('div', { className: 'sub', textContent: 'Nenhuma ainda: crie no editor e salve com um nome.' }));
    t.append(caixa);
  },

  // --- abrir, fechar, jogar --------------------------------------------------------------------------------------
  abre() {
    if (this.iniciou && Jogo.modo === 'jogo') Jogo.modo = 'pausa';
    this.tela.hidden = false; this.trocar.hidden = true;
    this.desenha(); // com o "Continuar" e as Minhas fases de agora
  },
  fecha() { this.tela.hidden = true; this.trocar.hidden = !this.iniciou; window.focus(); },
  continua() { this.fecha(); Jogo.modo = 'jogo'; },
  voltaEditor() { location.href = 'editor.html'; }, // o editor volta com o rascunho (a fase como estava)

  // o = { demo: 0 } (a sequência da demo), { fase: 'mesa' } (fases/mesa.json, 'minha:<id>' ou '~') ou { sala: 4 }
  joga(o) {
    this.acabou = false;
    this.fecha();
    const d = o.demo != null ? this.DEMO[o.demo] : null;
    if (d) this.DEMO.forEach((q) => { if (!this.demoDefs[q.id]) Jogo.leFase(q.id).then((def) => { this.demoDefs[q.id] = def; }); });
    const alvo = d ? { fase: d.id, nome: d.nome, idx: o.demo } : o;
    const poe = (def) => { // fase avulsa: vencer recomeça a mesma, ou vai para a seguinte da demo
      Jogo.avulsa = true;
      Jogo.depoisDaFase = d ? (i) => this._seguinte(i) : null;
      Jogo.carrega(alvo.idx || 0, alvo.nome ? Object.assign({}, def, { nome: alvo.nome }) : def);
      Jogo.intro = 0; Jogo.cortina = null; Jogo.modo = 'jogo';
    };
    if (!this.iniciou) {
      this.iniciou = true; this.trocar.hidden = false;
      window.PARAMETROS_JOGO = (alvo.fase ? `fase=${alvo.fase}` : `sala=${alvo.sala}&semente=${this.SEMENTE}`) + this.extra;
      const vai = () => {
        if (!this.carregou) { setTimeout(vai, 50); return; }
        Jogo.init().then(() => { this.assume(); if (d) poe(Jogo.def); });
      };
      vai();
      return;
    }
    if (alvo.fase) {
      Jogo.leFase(alvo.fase).then((def) => { if (def) poe(def); else { Jogo.modo = 'jogo'; this.abre(); } });
    } else {
      Jogo.avulsa = false; Jogo.depoisDaFase = null; Jogo.semente = this.SEMENTE;
      Jogo.carrega(alvo.sala - 1); Jogo.intro = alvo.sala === 1 ? 1 : 0; Jogo.cortina = null; Jogo.modo = 'jogo';
    }
  },
  // venceu a fase i da demo: a seguinte ({ idx, def }) ou o fim (a tela, com o jogo parado)
  _seguinte(i) {
    const q = this.DEMO[i + 1], def = q && this.demoDefs[q.id];
    if (!q) { this.acabou = true; this.abre(); return 'fim'; }
    return def ? { idx: i + 1, def: Object.assign({}, def, { nome: q.nome }) } : null;
  },
};
Escolha.prepara();
