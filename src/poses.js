'use strict';

// Poses animadas (em função do tempo). Cada uma retorna { pose, dy, extra }.
const Poses = {
  idle: {
    marreta(t) {
      const s = Math.sin(t * 5.2), b = Math.abs(s);
      return {
        pose: Rig.pose({
          tronco: 0.16, cabeca: -0.12,
          bracoD: 0.5 + s * 0.06, cotoveloD: 2.2, bracoE: 1.6, cotoveloE: 1.2 - s * 0.05,
          pernaE: -0.36, joelhoE: 0.06, pernaD: 0.3, joelhoD: -0.42,
        }),
        dy: -b * 5,
      };
    },
    fiapo(t) {
      const bat = Math.max(0, Math.sin(t * 9)) ** 2;
      return {
        pose: Rig.pose({
          tronco: 0.03 * Math.sin(t * 1.7), cabeca: -0.04 + 0.07 * Math.sin(t * 1.3),
          bracoD: -0.06, cotoveloD: 0.4, bracoE: 0.14, cotoveloE: 0.5,
          pernaE: -0.08, joelhoE: 0.03, pernaD: 0.14 + bat * 0.12, joelhoD: -0.1 - bat * 0.28,
        }),
        dy: 0,
      };
    },
    pudim(t) {
      const r = Math.sin(t * 2.2);
      return {
        pose: Rig.pose({
          escalaY: 1 + 0.03 * r, tronco: 0.02 * r, cabeca: 0.03 * Math.sin(t * 1.1),
          bracoD: 0.85, cotoveloD: -0.6, bracoE: -0.8, cotoveloE: 0.6,
          pernaE: -0.18, joelhoE: 0, pernaD: 0.18, joelhoD: 0,
        }),
        dy: 0,
        extra: { jiggle: r * 1.6 },
      };
    },
  },

  // Marreta: preparando o gancho (t de 0 a 1)
  preparaGancho(k) {
    return Rig.pose({
      tronco: U.lerp(0.16, 0.42, k), cabeca: U.lerp(-0.12, -0.3, k),
      bracoD: U.lerp(0.5, -0.5, k), cotoveloD: U.lerp(2.2, 1.2, k), bracoE: 1.6, cotoveloE: 1.2,
      pernaE: -0.4, joelhoE: U.lerp(0.06, 0.4, k), pernaD: U.lerp(0.3, 0.55, k), joelhoD: U.lerp(-0.42, -1.0, k),
    });
  },
  // Marreta: gancho lá em cima
  gancho() {
    return Rig.pose({
      tronco: -0.12, cabeca: -0.25,
      bracoD: 2.7, cotoveloD: 0.5, bracoE: 0.4, cotoveloE: 1.6,
      pernaE: -0.45, joelhoE: 0.05, pernaD: 0.2, joelhoD: -0.1,
    });
  },
  // Marreta: armando o soco reto (luva para trás, perto do queixo) e o soco esticado para a frente
  preparaSoco(k) {
    return Rig.pose({
      tronco: U.lerp(0.1, -0.08, k), cabeca: -0.1,
      bracoD: U.lerp(0.6, 0.15, k), cotoveloD: U.lerp(2.0, 2.5, k), bracoE: 1.5, cotoveloE: 1.5,
      pernaE: -0.35, joelhoE: 0.15, pernaD: 0.35, joelhoD: -0.3,
    });
  },
  soco() {
    return Rig.pose({
      tronco: 0.3, cabeca: -0.2,
      bracoD: 1.62, cotoveloD: 0.05, bracoE: 1.2, cotoveloE: 1.9,
      pernaE: -0.55, joelhoE: 0.08, pernaD: 0.45, joelhoD: -0.45,
    });
  },
  comemora(t, id) {
    const s = Math.sin(t * 8);
    if (id === 'marreta') {
      return Rig.pose({ tronco: -0.05, cabeca: -0.15, bracoD: 3.0 + s * 0.1, cotoveloD: 0.2, bracoE: 0.9, cotoveloE: 1.9, pernaE: -0.2, pernaD: 0.2 });
    }
    if (id === 'fiapo') {
      return Rig.pose({ tronco: 0, cabeca: -0.1, bracoD: 2.8 + s * 0.15, cotoveloD: 0.3, bracoE: -2.6 - s * 0.15, cotoveloE: -0.3, pernaE: -0.15, pernaD: 0.15 });
    }
    return Rig.pose({ escalaY: 1.02, bracoD: 1.6 + s * 0.1, cotoveloD: 0.6, bracoE: -1.6, cotoveloE: -0.6, pernaE: -0.18, pernaD: 0.18 });
  },
  // Pudim puxando a corda (inclinado para trás, fazendo força)
  puxa(t, k) {
    const tr = Math.sin(t * 40) * 0.015 * k;
    return Rig.pose({
      tronco: -0.28 * k + tr, cabeca: 0.1 * k, escalaY: 1,
      bracoD: 1.5 * k + 0.85 * (1 - k), cotoveloD: -0.2, bracoE: 1.2 * k - 0.8 * (1 - k), cotoveloE: 0.1,
      pernaE: -0.3 * k - 0.18, joelhoE: 0.1, pernaD: 0.45 * k + 0.18 * (1 - k), joelhoD: -0.1,
    });
  },
  // Fiapo agachado amarrando a corda
  amarra(t) {
    const s = Math.sin(t * 16);
    return Rig.pose({
      tronco: 0.55, cabeca: 0.2,
      bracoD: 1.1 + s * 0.2, cotoveloD: 0.4, bracoE: 0.9 - s * 0.2, cotoveloE: 0.5,
      pernaE: -0.2, joelhoE: 1.5, pernaD: 1.3, joelhoD: -1.6,
    });
  },

  // --- Poses do jogo -------------------------------------------------------
  // Caminhada: fase avança com a distância andada
  anda(id, fase, t) {
    const amp = id === 'pudim' ? 0.34 : id === 'fiapo' ? 0.62 : 0.48;
    const perna = (ph) => ({ coxa: amp * Math.sin(ph), joelho: -amp * 1.5 * Math.max(0, Math.cos(ph)) });
    const d = perna(fase), e = perna(fase + Math.PI);
    const base = {
      pernaD: d.coxa, joelhoD: d.joelho, pernaE: e.coxa, joelhoE: e.joelho,
      bracoD: -amp * 0.9 * Math.sin(fase), cotoveloD: 0.35, bracoE: amp * 0.9 * Math.sin(fase), cotoveloE: 0.35,
      tronco: id === 'fiapo' ? 0.12 : 0.05, cabeca: -0.04,
    };
    if (id === 'marreta') { // anda de guarda alta
      const g = Poses.idle.marreta(t).pose;
      Object.assign(base, { bracoD: g.bracoD, cotoveloD: g.cotoveloD, bracoE: g.bracoE, cotoveloE: g.cotoveloE, tronco: 0.14 });
    }
    if (id === 'pudim') { // gingado
      Object.assign(base, { tronco: 0.08 * Math.sin(fase), bracoD: 0.85 + 0.2 * Math.sin(fase), cotoveloD: -0.5, bracoE: -0.8 - 0.2 * Math.sin(fase), cotoveloE: 0.5 });
    }
    return { pose: Rig.pose(base), dy: -Math.abs(Math.cos(fase)) * (id === 'pudim' ? 2 : 3) };
  },
  pulo(id) {
    return Rig.pose({ tronco: 0.05, cabeca: -0.15, bracoD: 2.5, cotoveloD: 0.4, bracoE: 2.2, cotoveloE: 0.5, pernaD: 0.7, joelhoD: -1.3, pernaE: 0.25, joelhoE: -0.9 });
  },
  cai(id, t) {
    const s = Math.sin(t * 22);
    return Rig.pose({ tronco: -0.05, cabeca: -0.2, bracoD: 2.7 + s * 0.3, cotoveloD: 0.2, bracoE: -2.6 - s * 0.3, cotoveloE: -0.2, pernaD: 0.3 + s * 0.2, joelhoD: -0.3, pernaE: -0.2 - s * 0.2, joelhoE: 0.1 });
  },
  escala(id, fase) {
    const s = Math.sin(fase);
    return Rig.pose({ tronco: 0, cabeca: -0.3, bracoD: 2.7 + s * 0.35, cotoveloD: 0.35, bracoE: 2.7 - s * 0.35, cotoveloE: 0.35, pernaD: 0.6 + s * 0.4, joelhoD: -1.0, pernaE: 0.6 - s * 0.4, joelhoE: -1.0 });
  },
  surfa(id, t) {
    const s = Math.sin(t * 14) * 0.08;
    return Rig.pose({ tronco: 0.25 + s, cabeca: -0.2, bracoD: 1.7, cotoveloD: 0.2, bracoE: -1.5, cotoveloE: -0.2, pernaD: 0.55, joelhoD: -0.9, pernaE: -0.35, joelhoE: 0.2 });
  },
  // Pudim encolhido virando bola (o desenho gira o boneco inteiro)
  bola() {
    return Rig.pose({ tronco: 0.55, cabeca: 0.55, bracoD: 1.1, cotoveloD: 2.1, bracoE: 0.9, cotoveloE: 2.1, pernaD: 1.9, joelhoD: -2.4, pernaE: 1.7, joelhoE: -2.4 });
  },
  bundada() {
    return Rig.pose({ tronco: -0.25, cabeca: 0.1, bracoD: 2.8, cotoveloD: 0.2, bracoE: -2.8, cotoveloE: -0.2, pernaD: 1.5, joelhoD: 0, pernaE: 1.3, joelhoE: 0 });
  },
  tonto(id, t) {
    const b = Poses.idle[id](t).pose;
    b.tronco += 0.12 * Math.sin(t * 7);
    b.cabeca += 0.15 * Math.sin(t * 7 + 1);
    return b;
  },
};

// Piscada: verdadeiro durante ~0,13 s a cada ~3 s (defasado por personagem)
function piscando(t, semente) {
  const periodo = 2.6 + U.hash(semente) * 1.6;
  return (t + semente * 1.37) % periodo < 0.13;
}
