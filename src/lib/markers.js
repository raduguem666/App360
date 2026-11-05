/**
 * Constrói a lista de markers do Photo Sphere Viewer a partir do estado do projeto.
 * Compartilhado entre Studio (editor) e Player (apresentação).
 */
import { STATUS, hexToRgba, pad } from './model.js';
import { sphericalCentroid, toPsvPolygon, blockOutline, blockGridLines } from './sphere.js';

export const ACCENT = '#A3E635';

const centroidCache = new WeakMap();
/** Centroide memoizado por identidade do array de pontos (imutável). */
export function lotCentroid(lot) {
  let c = centroidCache.get(lot.points);
  if (!c) {
    c = sphericalCentroid(lot.points);
    centroidCache.set(lot.points, c);
  }
  return c;
}

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/* -------------------------------------------------------------------- lotes */
export function lotMarkers(lots, { selected = new Set(), dimmed = null, showLabels = true, presentation = false, priceFmt } = {}) {
  const out = [];
  for (const lot of lots) {
    const st = STATUS[lot.status] || STATUS.disponivel;
    const isSel = selected.has(lot.id);
    const isDim = dimmed ? dimmed(lot) : false;
    out.push({
      id: `lot:${lot.id}`,
      polygon: toPsvPolygon(lot.points),
      className: `lot-poly${isSel ? ' is-selected' : ''}${isDim ? ' is-dimmed' : ''}`,
      svgStyle: {
        fill: hexToRgba(st.color, isDim ? 0.08 : isSel ? 0.58 : 0.4),
        stroke: isSel ? ACCENT : isDim ? hexToRgba(st.color, 0.35) : st.color,
        strokeWidth: isSel ? '3px' : '2px',
        strokeLinejoin: 'round',
        cursor: 'pointer',
      },
      tooltip: presentation && !isDim
        ? {
            content: `<div class="lt-tip"><strong>${escapeHtml(lot.name)}</strong><span style="color:${st.color}">● ${st.label}</span>${
              priceFmt && lot.price ? `<em>${priceFmt(lot.price)}</em>` : ''
            }</div>`,
            className: 'lt-tooltip',
            position: 'top center',
          }
        : undefined,
      data: { type: 'lot', id: lot.id },
    });
    if (showLabels && lot.showLabel !== false && lot.points.length >= 3 && !isDim) {
      const text = pad(lot.number);
      out.push({
        id: `label:${lot.id}`,
        position: lotCentroid(lot),
        html: `<span class="lot-label-inner${isSel ? ' is-selected' : ''}">${escapeHtml(text)}</span>`,
        size: { width: 14 + text.length * 8, height: 20 },
        anchor: 'center center',
        className: 'lot-label',
        data: { type: 'label', id: lot.id },
      });
    }
  }
  return out;
}

/* ----------------------------------------------------------------- hotspots */
const ARROW_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/><path d="m6 20 6-6 6 6" opacity=".45"/></svg>';
const PIN_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3"/></svg>';

export function hotspotMarkers(hotspots, { selectedId = null, scenesById = {} } = {}) {
  return hotspots.map((h) => {
    const target = scenesById[h.targetSceneId];
    const label = h.label || (target ? `Ir para ${target.name}` : 'Hotspot');
    const ground = h.style === 'ground';
    return {
      id: `hs:${h.id}`,
      position: { yaw: h.yaw, pitch: h.pitch },
      html: `<div class="hs ${ground ? 'hs-ground' : 'hs-float'}${h.id === selectedId ? ' is-selected' : ''}"><div class="hs-icon">${
        ground ? ARROW_SVG : PIN_SVG
      }</div><div class="hs-label">${escapeHtml(label)}</div></div>`,
      size: { width: 56, height: 56 },
      anchor: 'center center',
      className: 'hs-marker',
      data: { type: 'hotspot', id: h.id },
    };
  });
}

/* -------------------------------------------------------------- quadras */
export function blockMarkers(block, { adjusting = false, selected = false } = {}) {
  const out = [];
  if (!adjusting && !selected) return out;
  out.push({
    id: `blk-outline:${block.id}`,
    polygon: toPsvPolygon(blockOutline(block.corners, block.method)),
    className: 'no-pointer',
    svgStyle: {
      fill: 'none',
      stroke: ACCENT,
      strokeWidth: '2px',
      strokeDasharray: '8 6',
    },
    data: { type: 'block-outline', id: block.id },
  });
  if (adjusting) {
    block.corners.forEach((c, i) => {
      out.push({
        id: `handle:${block.id}:${i}`,
        position: c,
        html: `<div class="corner-handle" data-handle="block:${block.id}:${i}"><span>P${i + 1}</span></div>`,
        size: { width: 34, height: 34 },
        anchor: 'center center',
        className: 'handle-marker',
        data: { type: 'handle', id: block.id, index: i },
      });
    });
  }
  return out;
}

/** Vértices arrastáveis de um lote avulso (polígono livre) selecionado. */
export function vertexHandles(lot) {
  return lot.points.map((p, i) => ({
    id: `vtx:${lot.id}:${i}`,
    position: p,
    html: `<div class="vertex-handle" data-handle="lot:${lot.id}:${i}"></div>`,
    size: { width: 18, height: 18 },
    anchor: 'center center',
    className: 'handle-marker',
    data: { type: 'vertex', id: lot.id, index: i },
  }));
}

/* ---------------------------------------------------------- rascunhos */
export function draftMarkers({ tool, draft, cursor, pendingBlock }) {
  const out = [];
  if (pendingBlock) {
    const { corners, preview } = pendingBlock;
    const method = preview?.method || 'perspective';
    out.push({
      id: 'pending-outline',
      polygon: toPsvPolygon(blockOutline(corners, method)),
      className: 'no-pointer',
      svgStyle: { fill: hexToRgba(ACCENT, 0.12), stroke: ACCENT, strokeWidth: '2.5px' },
    });
    if (preview?.cols && preview?.rows) {
      blockGridLines(corners, preview.cols, preview.rows, method).forEach((line, i) =>
        out.push({
          id: `pending-grid:${i}`,
          polyline: toPsvPolygon(line),
          className: 'no-pointer',
          svgStyle: { stroke: ACCENT, strokeWidth: '1.5px', strokeDasharray: '5 4', fill: 'none' },
        }),
      );
    }
    corners.forEach((c, i) => out.push(cornerDot(`pending-c:${i}`, c, `P${i + 1}`)));
    return out;
  }
  if (!draft.length && !cursor) return out;
  if (tool === 'polygon' || tool === 'grid') {
    const path = cursor ? [...draft, cursor] : draft;
    if (tool === 'grid' && draft.length === 3 && cursor) path.push(draft[0]);
    if (path.length >= 2) {
      out.push({
        id: 'draft-line',
        polyline: toPsvPolygon(path),
        className: 'no-pointer',
        svgStyle: { stroke: ACCENT, strokeWidth: '2.5px', strokeDasharray: tool === 'grid' ? '7 5' : 'none', fill: 'none' },
      });
    }
    if (tool === 'polygon' && draft.length >= 3) {
      out.push({
        id: 'draft-fill',
        polygon: toPsvPolygon(path),
        className: 'no-pointer',
        svgStyle: { fill: hexToRgba(ACCENT, 0.15), stroke: 'none' },
      });
    }
    draft.forEach((p, i) => {
      if (tool === 'grid') out.push(cornerDot(`draft-v:${i}`, p, `P${i + 1}`));
      else
        out.push({
          id: `draft-v:${i}`,
          position: p,
          html: `<div class="draft-vertex${i === 0 && draft.length >= 3 ? ' is-closer' : ''}"></div>`,
          size: { width: 16, height: 16 },
          anchor: 'center center',
          className: i === 0 && draft.length >= 3 ? 'draft-closer' : 'no-pointer',
          data: { type: 'draft-vertex', index: i },
        });
    });
  }
  return out;
}

function cornerDot(id, pos, label) {
  return {
    id,
    position: pos,
    html: `<div class="corner-handle is-static"><span>${label}</span></div>`,
    size: { width: 34, height: 34 },
    anchor: 'center center',
    className: 'no-pointer',
  };
}
