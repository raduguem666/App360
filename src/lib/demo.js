/**
 * Demonstração procedural: gera panoramas equiretangulares 360° "de drone" e um
 * masterplan 2D coerentes entre si, a partir de um loteamento fictício
 * (ruas em grade, quadras de 100 m × 50 m com lotes de 10 m × 25 m).
 *
 * Cada pixel do panorama é um raio que parte da câmera (drone) e intercepta o plano
 * do terreno — por isso as quadras aparecem com perspectiva real, ideal para testar
 * a ferramenta de subdivisão de 4 pontos.
 */
import { uid, emptyProject } from './model.js';
import { generateBlockLots } from './blocks.js';

/* ------------------------------------------------------------ layout do mundo */
const ROAD_HALF = 6; // ruas de 12 m
const BLOCK_W = 100; // frente da quadra (eixo X)
const BLOCK_D = 50; // profundidade (eixo Z)
const PX = BLOCK_W + ROAD_HALF * 2; // período em X (112 m)
const PZ = BLOCK_D + ROAD_HALF * 2; // período em Z (62 m)
const DEV_X = PX * 3; // 336 → 6 quadras em X
const DEV_Z = PZ * 3; // 186 → 6 quadras em Z

export const DEMO_CAMERAS = [
  { name: 'Drone 01 — Portaria', subtitle: 'Altitude 95m • Entrada Principal e Acesso', x: 0, z: 0, h: 95 },
  { name: 'Drone 02 — Área Verde', subtitle: 'Altitude 75m • Bosque Preservado e Lazer', x: -PX * 2, z: PZ * 2, h: 75 },
];

/* --------------------------------------------------------------- ruído */
function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mod = (a, n) => ((a % n) + n) % n;

const C = {
  asphalt: [58, 60, 64],
  curb: [196, 192, 182],
  earth: [156, 112, 78],
  earthDark: [122, 86, 60],
  grass: [92, 128, 62],
  grassDry: [146, 150, 88],
  tree: [34, 66, 34],
  roofA: [176, 86, 58],
  roofB: [128, 132, 138],
  haze: [196, 210, 222],
  lake: [44, 92, 112],
};

/**
 * Cor do terreno no ponto (X, Z) do mundo. `fw` = tamanho do pixel em metros,
 * usado para suavizar (anti-aliasing) detalhes finos à distância.
 */
function groundColor(X, Z, fw) {
  const n1 = vnoise(X * 0.018, Z * 0.018);
  const n2 = vnoise(X * 0.13 + 17, Z * 0.13 - 9);
  const inDev = Math.abs(X) < DEV_X + ROAD_HALF && Math.abs(Z) < DEV_Z + ROAD_HALF;

  if (!inDev) {
    // lago a sudeste
    const lx = (X - 470) / 140;
    const lz = (Z + 120) / 90;
    const ld = lx * lx + lz * lz + (n1 - 0.5) * 0.6;
    if (ld < 1) return mixc(C.lake, [70, 120, 132], n2 * 0.4);
    let col = mixc(C.grass, C.grassDry, clamp01(n1 * 1.4 - 0.2));
    col = mixc(col, [70, 100, 50], n2 * 0.35);
    // fileiras de plantação a oeste
    if (X < -DEV_X - 60 && Z > -260) {
      const row = Math.abs(mod(Z, 4) - 2) / 2;
      col = mixc(col, [74, 104, 44], clamp01(1 - row * 2) * clamp01(1.2 / fw) * 0.6);
    }
    const t = vnoise(X * 0.035 + 50, Z * 0.035 - 30) + n2 * 0.18;
    if (t > 0.68) col = mixc(C.tree, [52, 90, 44], n2);
    return col;
  }

  const gx = mod(X, PX);
  const gz = mod(Z, PZ);
  const dx = Math.min(gx, PX - gx);
  const dz = Math.min(gz, PZ - gz);
  const dRoad = Math.min(dx, dz);
  const insideDev = Math.abs(X) < DEV_X && Math.abs(Z) < DEV_Z;

  if (dRoad < ROAD_HALF || !insideDev) {
    let col = mixc(C.asphalt, [72, 74, 78], n2 * 0.5);
    // faixa central tracejada
    const center = dx < dz ? dx : dz;
    const along = dx < dz ? Z : X;
    if (center < 0.12 + fw * 0.3 && mod(along, 6) < 3) col = mixc(col, [214, 190, 92], clamp01(0.5 / fw));
    // meio-fio
    const curb = clamp01(1 - Math.abs(dRoad - (ROAD_HALF - 0.35)) / Math.max(0.35, fw * 0.6));
    return mixc(col, C.curb, curb * clamp01(1.5 / fw));
  }

  // dentro da quadra
  const lx = gx - ROAD_HALF; // 0..100
  const lz = gz - ROAD_HALF; // 0..50
  const col10 = Math.floor(lx / 10);
  const row = lz < BLOCK_D / 2 ? 0 : 1;
  const bx = Math.floor(X / PX);
  const bz = Math.floor(Z / PZ);
  const lotSeed = hash(bx * 31 + col10, bz * 17 + row * 7);

  let col = mixc(C.earth, C.earthDark, n2 * 0.7);
  col = mixc(col, C.grass, clamp01((n1 - 0.55) * 3) * 0.8);

  // casas em alguns lotes
  if (lotSeed < 0.16) {
    const hx = lx - col10 * 10;
    const hz = row === 0 ? lz : BLOCK_D - lz;
    if (hx > 1.5 && hx < 8.5 && hz > 4 && hz < 15) {
      const roof = lotSeed < 0.08 ? C.roofA : C.roofB;
      return hx < 5 ? roof : mixc(roof, [0, 0, 0], 0.22);
    }
    col = mixc(col, C.grass, 0.6);
  }

  // linhas divisórias dos lotes (marcação de piquetes)
  const lineX = Math.min(mod(lx, 10), 10 - mod(lx, 10));
  const lineZ = Math.abs(lz - BLOCK_D / 2);
  const lw = Math.max(0.18, fw * 0.5);
  const lineA = Math.max(clamp01(1 - lineX / lw), clamp01(1 - lineZ / lw)) * clamp01(0.8 / fw);
  return mixc(col, [228, 214, 186], lineA * 0.55);
}

function skyColor(dirX, dirY, dirZ, sun) {
  const t = clamp01(dirY);
  let col = mixc(C.haze, [62, 118, 196], Math.pow(t, 0.55));
  const sd = dirX * sun[0] + dirY * sun[1] + dirZ * sun[2];
  col = mixc(col, [255, 246, 220], Math.pow(clamp01(sd), 48) * 0.9 + Math.pow(clamp01(sd), 6) * 0.15);
  if (dirY > 0.02) {
    const k = 1200 / dirY;
    const cx = dirX * k * 0.0016;
    const cz = dirZ * k * 0.0016;
    const cl = vnoise(cx, cz) * 0.65 + vnoise(cx * 2.7, cz * 2.7) * 0.35;
    const cov = clamp01((cl - 0.52) * 3.2) * clamp01(dirY * 6);
    col = mixc(col, [248, 250, 252], cov * 0.85);
  }
  return col;
}

/** Renderiza um panorama equiretangular W×(W/2) a partir de uma câmera. */
export async function renderPanorama(cam, width = 4096, onProgress) {
  const W = width;
  const H = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const sun = [Math.sin(2.3) * Math.cos(0.55), Math.sin(0.55), Math.cos(2.3) * Math.cos(0.55)];
  const pixAngle = (Math.PI * 2) / W;
  const sinYaw = new Float64Array(W);
  const cosYaw = new Float64Array(W);
  for (let u = 0; u < W; u++) {
    const yaw = ((u + 0.5) / W) * Math.PI * 2 - Math.PI;
    sinYaw[u] = Math.sin(yaw);
    cosYaw[u] = Math.cos(yaw);
  }
  for (let v = 0; v < H; v++) {
    const pitch = Math.PI / 2 - ((v + 0.5) / H) * Math.PI;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    for (let u = 0; u < W; u++) {
      const dX = cp * sinYaw[u];
      const dZ = cp * cosYaw[u];
      let col;
      if (sp < -0.004) {
        const t = cam.h / -sp;
        const X = cam.x + dX * t;
        const Z = cam.z + dZ * t;
        const fw = (t * pixAngle) / Math.max(-sp, 0.06);
        col = groundColor(X, Z, fw);
        const fog = 1 - Math.exp(-t / 1400);
        col = mixc(col, C.haze, fog * 0.9);
      } else {
        col = skyColor(dX, sp, dZ, sun);
      }
      const i = (v * W + u) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = 255;
    }
    if (v % 96 === 0) {
      onProgress?.(v / H);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
}

/* -------------------------------------------------------------- masterplan */
const MP = { x0: -440, x1: 440, z0: -280, z1: 280 };
export const worldToMap = (x, z) => ({ x: (x - MP.x0) / (MP.x1 - MP.x0), y: (MP.z1 - z) / (MP.z1 - MP.z0) });

export async function renderMasterplan(width = 1760) {
  const W = width;
  const H = Math.round((width * (MP.z1 - MP.z0)) / (MP.x1 - MP.x0));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const mpp = (MP.x1 - MP.x0) / W;
  for (let py = 0; py < H; py++) {
    const Z = MP.z1 - (py + 0.5) * mpp;
    for (let px = 0; px < W; px++) {
      const X = MP.x0 + (px + 0.5) * mpp;
      const col = groundColor(X, Z, mpp);
      const i = (py * W + px) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
    if (py % 120 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  ctx.putImageData(img, 0, 0);

  // rótulos das quadras
  ctx.font = `600 ${Math.round(W / 70)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let n = 1;
  for (let bz = 2; bz >= -3; bz--) {
    for (let bx = -3; bx <= 2; bx++) {
      const cx = bx * PX + PX / 2;
      const cz = bz * PZ + PZ / 2;
      const p = worldToMap(cx, cz);
      const label = `Q${String(n++).padStart(2, '0')}`;
      ctx.fillStyle = 'rgba(18,18,18,0.55)';
      const w = ctx.measureText(label).width + 18;
      ctx.beginPath();
      ctx.roundRect(p.x * W - w / 2, p.y * H - W / 110, w, W / 55, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, p.x * W, p.y * H + 1);
    }
  }
  // rosa dos ventos
  ctx.fillStyle = 'rgba(18,18,18,0.6)';
  ctx.beginPath();
  ctx.arc(W - 60, 60, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#A3E635';
  ctx.beginPath();
  ctx.moveTo(W - 60, 34);
  ctx.lineTo(W - 70, 64);
  ctx.lineTo(W - 50, 64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 18px Inter, system-ui, sans-serif`;
  ctx.fillText('N', W - 60, 78);
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
}

export async function renderDemoLogo() {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');
  // Fundo translúcido escuro
  ctx.fillStyle = 'rgba(18, 18, 18, 0.9)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 440, 110, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(163, 230, 53, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Ícone verde lima
  ctx.fillStyle = '#a3e635';
  ctx.beginPath();
  ctx.roundRect(20, 20, 70, 70, 14);
  ctx.fill();
  ctx.fillStyle = '#121212';
  ctx.font = '900 34px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('360', 55, 57);

  // Tipografia da Empresa
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px Inter, system-ui, sans-serif';
  ctx.fillText('VISTA VERDE', 106, 48);
  ctx.fillStyle = '#a3e635';
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.letterSpacing = '0.08em';
  ctx.fillText('LOTE360 EMPREENDIMENTOS', 106, 74);

  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

/* ------------------------------------------------- posições exatas na foto */
function worldToSpherical(cam, X, Z, Y = 0) {
  const dX = X - cam.x;
  const dZ = Z - cam.z;
  return {
    yaw: +Math.atan2(dX, dZ).toFixed(6),
    pitch: +(-Math.atan2(cam.h - Y, Math.hypot(dX, dZ))).toFixed(6),
  };
}

/** Cantos (P1 TL, P2 TR, P3 BR, P4 BL) de uma quadra vista da câmera 1 (olhando +Z). */
export function demoBlockCorners(cam, bx, bz) {
  const x0 = bx * PX + ROAD_HALF;
  const x1 = x0 + BLOCK_W;
  const z0 = bz * PZ + ROAD_HALF;
  const z1 = z0 + BLOCK_D;
  return [
    worldToSpherical(cam, x0, z1),
    worldToSpherical(cam, x1, z1),
    worldToSpherical(cam, x1, z0),
    worldToSpherical(cam, x0, z0),
  ];
}

/* -------------------------------------------------------- projeto de demo */
export async function buildDemoProject(onProgress = () => {}) {
  const images = {};
  const project = emptyProject();
  project.name = 'Residencial Vista Verde (Demo)';
  project.settings.developmentName = 'Residencial Vista Verde';

  const scenes = [];
  for (let i = 0; i < DEMO_CAMERAS.length; i++) {
    const cam = DEMO_CAMERAS[i];
    onProgress(`Renderizando panorama 360° ${i + 1}/${DEMO_CAMERAS.length}…`, i / (DEMO_CAMERAS.length + 1));
    const blob = await renderPanorama(cam, 2048, (p) =>
      onProgress(`Renderizando panorama 360° ${i + 1}/${DEMO_CAMERAS.length}…`, (i + p) / (DEMO_CAMERAS.length + 1)),
    );
    const imageId = uid('img');
    images[imageId] = blob;
    const mp = worldToMap(cam.x, cam.z);
    scenes.push({
      id: uid('scn'),
      name: cam.name,
      subtitle: cam.subtitle || '',
      showTitleOnPano: true,
      imageId,
      initialView: { yaw: 0, pitch: -0.55, zoom: 35 },
      mapPos: { x: +mp.x.toFixed(4), y: +mp.y.toFixed(4) },
      mapHeading: 0,
    });
  }
  onProgress('Gerando masterplan 2D e marca da empresa…', DEMO_CAMERAS.length / (DEMO_CAMERAS.length + 1));
  const mpBlob = await renderMasterplan();
  const mpId = uid('img');
  images[mpId] = mpBlob;

  const logoBlob = await renderDemoLogo();
  const logoId = uid('img');
  images[logoId] = logoBlob;

  project.scenes = scenes;
  project.startSceneId = scenes[0].id;
  project.masterplan = { imageId: mpId };
  project.settings.branding.logoImageId = logoId;
  project.settings.branding.enabled = true;
  project.settings.branding.watermarkText = 'Residencial Vista Verde • Lote360';

  // hotspots de transição (no chão, sobre a posição da outra câmera)
  const [c1, c2] = DEMO_CAMERAS;
  project.hotspots = [
    {
      id: uid('hs'),
      sceneId: scenes[0].id,
      ...worldToSpherical(c1, c2.x, c2.z),
      targetSceneId: scenes[1].id,
      label: 'Ir para Área Verde',
      style: 'ground',
    },
    {
      id: uid('hs'),
      sceneId: scenes[1].id,
      ...worldToSpherical(c2, c1.x, c1.z),
      targetSceneId: scenes[0].id,
      label: 'Voltar à Portaria',
      style: 'ground',
    },
  ];

  // Uma quadra já subdividida (Quadra 10 do masterplan) para demonstrar o modo apresentação.
  // As demais quadras ficam livres para testar a ferramenta "Quadra (4 pontos)".
  const block = {
    id: uid('blk'),
    sceneId: scenes[0].id,
    name: 'Quadra 10',
    code: 'Q10',
    corners: demoBlockCorners(c1, 0, 1),
    cols: 10,
    rows: 2,
    startNumber: 1,
    numbering: 'snake',
    method: 'perspective',
    defaults: { area: 250, price: 129900, front: 10, back: 10, sideLeft: 25, sideRight: 25 },
  };
  project.blocks = [block];
  project.lots = generateDemoLots(block);
  onProgress('Pronto!', 1);
  return { project, images };
}

function generateDemoLots(block) {
  const pattern = ['vendido', 'vendido', 'disponivel', 'reservado', 'disponivel', 'disponivel', 'vendido', 'disponivel', 'disponivel', 'reservado'];
  return generateBlockLots(block).map((lot) => {
    const idx = lot.number - block.startNumber;
    const corner = lot.cell.col === 0 || lot.cell.col === block.cols - 1;
    return {
      ...lot,
      status: pattern[(idx * 7) % pattern.length],
      area: corner ? 275 : 250,
      front: corner ? 11 : 10,
      back: corner ? 11 : 10,
      price: corner ? 149900 : 129900,
      conditions: 'Entrada de 10% + 120x sem juros',
      notes: corner ? 'Lote de esquina' : '',
    };
  });
}
