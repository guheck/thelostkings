'use strict';

// Minhas fases: as fases feitas no editor, guardadas no navegador (localStorage) com o nome que o jogador deu —
// funcionam no jogo publicado, sem servidor. No PC, o editor também grava fases/<id>.json pelo servidor.
// O jogo abre uma delas com ?fase=minha:<id> (Jogo.leFase). Guardado: { id: { nome, def, quando } }.
const MinhasFases = {
  CHAVE: 'lostkings-minhas-fases',
  todas() {
    try { return JSON.parse(localStorage.getItem(this.CHAVE)) || {}; } catch (e) { return {}; }
  },
  // as mais recentes primeiro
  lista() {
    return Object.entries(this.todas()).map(([id, q]) => ({ id, nome: q.nome, quando: q.quando })).sort((a, b) => b.quando - a.quando);
  },
  le(id) { const q = this.todas()[id]; return q ? q.def : null; },
  grava(id, def) {
    const t = this.todas();
    t[id] = { nome: def.nome, def, quando: Date.now() };
    try { localStorage.setItem(this.CHAVE, JSON.stringify(t)); return true; } catch (e) { return false; }
  },
  apaga(id) {
    const t = this.todas();
    delete t[id];
    try { localStorage.setItem(this.CHAVE, JSON.stringify(t)); } catch (e) { /* navegador sem localStorage */ }
  },
};
