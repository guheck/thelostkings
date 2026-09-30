'use strict';

// Monta o boneco de papel a partir dos pontos do esqueleto (vindos da pose ou da física).
// No estilo papel cada peça vira um "carimbo" (desenhado uma vez e só colado depois): é o que deixa fluido.
const CX_MEMBRO = (len) => [-26, -26, 26, len + 26];
const CX_MAO = [-32, -18, 32, 48];
const CX_PE = [-24, -30, 50, 16];
const CX_TRONCO = [-85, -135, 85, 45];
const CX_CABECA = [-72, -80, 62, 64];
const CX_CABECA_F = [-40, -70, 45, 50];

const Desenho = {
  // M = pontos no mundo; st = { f, t, rosto, escala, pesPlanos, squash, ... }
  personagem(ctx, ch, M, st) {
    if (Sprites.pronto(ch.id) && Sprites.personagem(ctx, ch, M, st)) return; // sprite (quando tem desenho para isso)
    const f = st.f || 1, esc = st.escala || 1;
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

    // peça de membro: carimbo com o comprimento de repouso, apontado de A para B
    const seg = (A, B, fn) => {
      ctx.save();
      ctx.translate(A.x, A.y);
      ctx.rotate(Math.atan2(B.y - A.y, B.x - A.x) - Math.PI / 2);
      fn();
      ctx.restore();
    };
    const peca = (nome, l, len, fn, elev = 2.2) =>
      Estilo.carimbo(ctx, `${ch.id}:${nome}:${l}`, CX_MEMBRO(len), (g) => fn(g), elev);

    const bracoCompleto = (l) => {
      const o = P['ombro' + l], c = P['cotovelo' + l], m = P['mao' + l];
      seg(o, c, () => peca('bracoSup', l, p.braco, (g) => ch.bracoSup(g, p.braco, l)));
      seg(c, m, () => {
        peca('antebraco', l, p.antebraco, (g) => ch.antebraco(g, p.antebraco, l));
        ctx.translate(0, U.dist(c.x, c.y, m.x, m.y));
        Estilo.carimbo(ctx, `${ch.id}:mao:${l}`, CX_MAO, (g) => ch.mao(g, l), 2.4);
      });
    };
    const pernaCompleta = (l) => {
      const q = P['quadril' + l], j = P['joelho' + l], pe = P['pe' + l];
      seg(q, j, () => peca('coxa', l, p.coxa, (g) => ch.coxa(g, p.coxa, l)));
      seg(j, pe, () => peca('canela', l, p.canela, (g) => ch.canela(g, p.canela, l)));
      ctx.save();
      ctx.translate(pe.x, pe.y);
      if (!st.pesPlanos) ctx.rotate(Math.atan2(pe.y - j.y, pe.x - j.x) - Math.PI / 2);
      Estilo.carimbo(ctx, `${ch.id}:pe:${l}`, CX_PE, (g) => ch.pe(g, l));
      ctx.restore();
    };
    const br = p.raioCabeca > 28 ? 3.6 : 3.2;

    bracoCompleto('E');
    Estilo.colchete(ctx, P.cotoveloE.x, P.cotoveloE.y, br * 0.9);
    pernaCompleta('E');
    Estilo.colchete(ctx, P.joelhoE.x, P.joelhoE.y, br * 0.9);
    pernaCompleta('D');
    Estilo.colchete(ctx, P.joelhoD.x, P.joelhoD.y, br);

    // tronco (variações entram na chave do carimbo)
    ctx.save();
    ctx.translate(P.pelve.x, P.pelve.y);
    ctx.rotate(Math.atan2(P.peito.x - P.pelve.x, -(P.peito.y - P.pelve.y)));
    const jig = Math.round((st.jiggle || 0) * 2) / 2;
    const stT = { jiggle: jig, amarrado: !!st.amarrado, semRolo: !!st.semRolo };
    Estilo.carimbo(ctx, `${ch.id}:tronco:${jig}:${+stT.amarrado}:${+stT.semRolo}`, CX_TRONCO, (g) => ch.torso(g, stT), 2.6);
    ctx.restore();
    Estilo.colchete(ctx, P.quadrilD.x, P.quadrilD.y, br);

    // cabeça (corpo por código leva cabeça por código, mesmo com sprites)
    ctx.save();
    ctx.translate(P.cabeca.x, P.cabeca.y);
    ctx.rotate(Math.atan2(P.cabeca.x - P.peito.x, -(P.cabeca.y - P.peito.y)));
    Desenho.cabeca(ctx, ch, st, true);
    ctx.restore();

    bracoCompleto('D');
    Estilo.colchete(ctx, P.ombroD.x, P.ombroD.y, br);
    Estilo.colchete(ctx, P.cotoveloD.x, P.cotoveloD.y, br);
    ctx.restore();
  },

  // Cabeça em camadas: trás (animada) -> base (carimbo) -> meio (animado) -> rosto (vivo) -> frente (carimbo)
  cabeca(ctx, ch, st, soCodigo) {
    if (!soCodigo && Sprites.pronto(ch.id) && Sprites.cabeca(ctx, ch, st)) return;
    if (ch.cabecaTras) ch.cabecaTras(ctx, st);
    Estilo.carimbo(ctx, ch.id + ':cabeca', CX_CABECA, (g) => ch.cabecaBase(g), 2.4);
    if (ch.cabecaMeio) ch.cabecaMeio(ctx, st);
    Rosto.desenha(ctx, ch, st.rosto, st.t || 0);
    Estilo.carimbo(ctx, ch.id + ':cabecaF', CX_CABECA_F, (g) => ch.cabecaFrente(g), 1.6);
  },

  // Sombra de contato no chão (elipse suave)
  sombraChao(ctx, x, y, w, forca = 1) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, w);
    g.addColorStop(0, `rgba(50,28,20,${0.28 * forca})`);
    g.addColorStop(1, 'rgba(50,28,20,0)');
    ctx.fillStyle = g;
    ctx.translate(x, y);
    ctx.scale(1, 0.22);
    U.circulo(ctx, 0, 0, w);
    ctx.fill();
    ctx.restore();
  },
};
