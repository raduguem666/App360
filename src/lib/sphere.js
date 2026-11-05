/**
 * Geometria esférica para o mapeamento de lotes sobre panoramas 360°.
 *
 * Convenção (idêntica à do Photo Sphere Viewer):
 *   - yaw   ∈ (-π, π]   longitude, 0 = centro da imagem equiretangular, cresce para a direita
 *   - pitch ∈ [-π/2, π/2] latitude, positivo para cima
 *
 * Vetor cartesiano na esfera unitária:
 *   x = cos(pitch)·sin(yaw)   y = sin(pitch)   z = cos(pitch)·cos(yaw)
 *
 * Toda interpolação é feita em 3D (nunca diretamente em yaw/pitch), o que elimina
 * o "rasgo" de polígonos que cruzam o meridiano ±π e as distorções perto dos polos
 * (nadir — muito comum em fotos de drone).
 */

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ vetores */

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a) => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** {yaw, pitch} → vetor unitário [x, y, z] */
export function toVec({ yaw, pitch }) {
  const cp = Math.cos(pitch);
  return [cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw)];
}

/** vetor (qualquer norma) → {yaw, pitch} com yaw normalizado em (-π, π] */
export function fromVec(v) {
  const n = normalize(v);
  return {
    yaw: Math.atan2(n[0], n[2]),
    pitch: Math.asin(Math.max(-1, Math.min(1, n[1]))),
  };
}

export function normalizeYaw(yaw) {
  let y = yaw % TAU;
  if (y > Math.PI) y -= TAU;
  if (y <= -Math.PI) y += TAU;
  return y;
}

/** Distância angular (rad) entre duas posições esféricas */
export function angularDistance(a, b) {
  return Math.acos(Math.max(-1, Math.min(1, dot(toVec(a), toVec(b)))));
}

/* ------------------------------------------------- projeção gnomônica local */

/**
 * Cria uma projeção gnomônica (plano tangente) centrada em `center` (vetor unitário).
 * Na projeção gnomônica, círculos máximos viram retas e — mais importante — um plano
 * do mundo real (o terreno) é mapeado por uma transformação projetiva. Isso permite
 * cálculos planares exatos (centroide, homografia) sem distorção angular.
 */
export function makeGnomonic(center) {
  const c = normalize(center);
  const helper = Math.abs(c[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const e1 = normalize(cross(helper, c));
  const e2 = cross(c, e1);
  return {
    project(v) {
      const s = dot(v, c);
      // s <= 0 → ponto atrás do plano tangente; clampa para evitar infinito
      const d = s > 1e-6 ? s : 1e-6;
      return [dot(v, e1) / d, dot(v, e2) / d];
    },
    unproject([x, y]) {
      return normalize(add(add(c, scale(e1, x)), scale(e2, y)));
    },
  };
}

/** Vetor médio normalizado de uma lista de posições */
export function meanVector(points) {
  let acc = [0, 0, 0];
  for (const p of points) acc = add(acc, toVec(p));
  if (length(acc) < 1e-9) return toVec(points[0]);
  return normalize(acc);
}

/* ------------------------------------------------------------- centroide */

/**
 * Centroide geométrico (ponderado por área) de um polígono esférico.
 * 1) projeta o polígono no plano tangente ao vetor médio;
 * 2) calcula o centroide planar pela fórmula do "shoelace";
 * 3) re-projeta para a esfera.
 * Para polígonos degenerados (área ~0) recai no vetor médio.
 */
export function sphericalCentroid(points) {
  if (!points || points.length === 0) return { yaw: 0, pitch: 0 };
  if (points.length < 3) return fromVec(meanVector(points));
  const center = meanVector(points);
  const g = makeGnomonic(center);
  const pts = points.map((p) => g.project(toVec(p)));
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) return fromVec(center);
  a *= 0.5;
  return fromVec(g.unproject([cx / (6 * a), cy / (6 * a)]));
}

/* ----------------------------------------------------- interpoladores de quadra */

/**
 * Interpolação bilinear esférica: combina os 4 cantos como vetores 3D e normaliza.
 * P1 = (u0,v0) Topo-Esq, P2 = (u1,v0) Topo-Dir, P3 = (u1,v1) Base-Dir, P4 = (u0,v1) Base-Esq.
 */
export function makeBilinearMapper(corners) {
  const [a, b, c, d] = corners.map(toVec);
  return (u, v) =>
    fromVec(
      add(
        add(scale(a, (1 - u) * (1 - v)), scale(b, u * (1 - v))),
        add(scale(c, u * v), scale(d, (1 - u) * v)),
      ),
    );
}

/**
 * Homografia quadrado-unitário → quadrilátero (Heckbert, 1989).
 * Retorna função (u, v) → [x, y].
 */
export function squareToQuad(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) {
    a = x1 - x0; b = x2 - x1; c = x0;
    d = y1 - y0; e = y2 - y1; f = y0;
    g = 0; h = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
  };
}

/**
 * Interpolação com correção de perspectiva: como o terreno de uma quadra é
 * (aproximadamente) plano, sua imagem no plano tangente gnomônico é uma
 * transformação projetiva de um retângulo. Lotes distantes ficam menores, como
 * na foto real do drone.
 */
export function makePerspectiveMapper(corners) {
  const g = makeGnomonic(meanVector(corners));
  const quad = corners.map((p) => g.project(toVec(p)));
  const H = squareToQuad(quad);
  return (u, v) => fromVec(g.unproject(H(u, v)));
}

export function makeMapper(corners, method = 'perspective') {
  return method === 'bilinear' ? makeBilinearMapper(corners) : makePerspectiveMapper(corners);
}

/**
 * Subdivide uma quadra (4 cantos) em cols × rows sub-polígonos.
 * Cada célula recebe `edgeSegments` pontos intermediários por aresta, para que os
 * lados acompanhem a curvatura correta mesmo com campos de visão amplos.
 *
 * @returns Array<{ row, col, points: Array<{yaw,pitch}> }>
 */
export function subdivideBlock(corners, cols, rows, method = 'perspective', edgeSegments = 2) {
  const map = makeMapper(corners, method);
  const cells = [];
  const seg = Math.max(1, edgeSegments);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = c / cols;
      const u1 = (c + 1) / cols;
      const v0 = r / rows;
      const v1 = (r + 1) / rows;
      const pts = [];
      // topo (esq → dir)
      for (let i = 0; i < seg; i++) pts.push(map(u0 + ((u1 - u0) * i) / seg, v0));
      // direita (topo → base)
      for (let i = 0; i < seg; i++) pts.push(map(u1, v0 + ((v1 - v0) * i) / seg));
      // base (dir → esq)
      for (let i = 0; i < seg; i++) pts.push(map(u1 - ((u1 - u0) * i) / seg, v1));
      // esquerda (base → topo)
      for (let i = 0; i < seg; i++) pts.push(map(u0, v1 - ((v1 - v0) * i) / seg));
      cells.push({ row: r, col: c, points: pts.map(roundPos) });
    }
  }
  return cells;
}

/** Contorno densificado da quadra inteira (para desenhar o perímetro). */
export function blockOutline(corners, method = 'perspective', perEdge = 12) {
  const map = makeMapper(corners, method);
  const pts = [];
  const edges = [
    [0, 0, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
    [0, 1, 0, 0],
  ];
  for (const [ua, va, ub, vb] of edges) {
    for (let i = 0; i < perEdge; i++) {
      const t = i / perEdge;
      pts.push(map(ua + (ub - ua) * t, va + (vb - va) * t));
    }
  }
  return pts.map(roundPos);
}

/** Grade interna (linhas divisórias) para pré-visualização da subdivisão. */
export function blockGridLines(corners, cols, rows, method = 'perspective', perLine = 10) {
  const map = makeMapper(corners, method);
  const lines = [];
  for (let c = 1; c < cols; c++) {
    const u = c / cols;
    const line = [];
    for (let i = 0; i <= perLine; i++) line.push(map(u, i / perLine));
    lines.push(line.map(roundPos));
  }
  for (let r = 1; r < rows; r++) {
    const v = r / rows;
    const line = [];
    for (let i = 0; i <= perLine; i++) line.push(map(i / perLine, v));
    lines.push(line.map(roundPos));
  }
  return lines;
}

function roundPos(p) {
  return { yaw: +p.yaw.toFixed(6), pitch: +p.pitch.toFixed(6) };
}

/** Desloca um conjunto de pontos rigidamente (rotação na esfera) de `from` até `to`. */
export function rotatePoints(points, from, to) {
  const a = toVec(from);
  const b = toVec(to);
  const axis = cross(a, b);
  const s = length(axis);
  const c = dot(a, b);
  if (s < 1e-9) return points.map((p) => ({ ...p }));
  const k = scale(axis, 1 / s);
  // Rodrigues
  return points.map((p) => {
    const v = toVec(p);
    const kv = cross(k, v);
    const kdv = dot(k, v);
    const r = add(add(scale(v, c), scale(kv, s)), scale(k, kdv * (1 - c)));
    return roundPos(fromVec(r));
  });
}

/** Converte [[yaw,pitch]] para o formato aceito pelo Photo Sphere Viewer. */
export const toPsvPolygon = (points) => points.map((p) => [p.yaw, p.pitch]);
