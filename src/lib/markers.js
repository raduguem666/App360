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

/* ------------------------------------------------------------- textos 360° */
export const TEXT_ICONS = {
  'map-pin': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
  tree: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 3-6h-2l3-5h-2l3-5H7l3 5H8l3 5H9l3 6z"/><path d="M12 19v3"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1 1.3-1.3z"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  car: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11 2 11.5 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
  waves: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
};

export function textMarkers(texts, { selectedId = null, editable = false } = {}) {
  return texts.map((t) => {
    const isSel = t.id === selectedId;
    const style = t.style || 'pin';
    const color = t.color || '#A3E635';
    const bgColor = t.bgColor || '#121212';
    const iconSvg = t.icon && TEXT_ICONS[t.icon] ? TEXT_ICONS[t.icon] : '';
    const fsClass = t.fontSize === 'sm' ? 'text-xs' : t.fontSize === 'lg' ? 'text-base' : t.fontSize === 'xl' ? 'text-lg font-black' : 'text-sm font-bold';

    let innerHtml = '';
    if (style === 'glow') {
      innerHtml = `
        <div class="pano-text-glow ${fsClass} ${isSel ? 'is-selected' : ''}" style="color: ${color}">
          ${iconSvg ? `<span class="pano-text-ico">${iconSvg}</span>` : ''}
          <div class="pano-text-col">
            <span class="pano-text-main">${escapeHtml(t.text)}</span>
            ${t.subtitle ? `<span class="pano-text-glow-sub">${escapeHtml(t.subtitle)}</span>` : ''}
          </div>
        </div>`;
    } else if (style === 'badge') {
      innerHtml = `
        <div class="pano-text-badge ${fsClass} ${isSel ? 'is-selected' : ''}" style="--badge-color: ${color}; --badge-bg: ${bgColor}">
          ${iconSvg ? `<span class="pano-text-ico">${iconSvg}</span>` : ''}
          <div class="pano-text-col">
            <span class="pano-text-main">${escapeHtml(t.text)}</span>
            ${t.subtitle ? `<span class="pano-text-sub">${escapeHtml(t.subtitle)}</span>` : ''}
          </div>
        </div>`;
    } else if (style === 'card') {
      innerHtml = `
        <div class="pano-text-card ${isSel ? 'is-selected' : ''}" style="--card-accent: ${color}">
          <div class="pano-text-card-head">
            ${iconSvg ? `<span class="pano-text-ico" style="color: ${color}">${iconSvg}</span>` : ''}
            <span class="pano-text-card-title ${fsClass}">${escapeHtml(t.text)}</span>
          </div>
          ${t.subtitle ? `<div class="pano-text-card-sub">${escapeHtml(t.subtitle)}</div>` : ''}
        </div>`;
    } else {
      // pin default (haste apontando para o ponto exato da foto 360°)
      innerHtml = `
        <div class="pano-text-pin ${isSel ? 'is-selected' : ''}" style="--pin-color: ${color}; --pin-bg: ${bgColor}">
          <div class="pano-text-pin-body">
            ${iconSvg ? `<span class="pano-text-ico">${iconSvg}</span>` : ''}
            <div class="pano-text-col">
              <span class="pano-text-main ${fsClass}">${escapeHtml(t.text)}</span>
              ${t.subtitle ? `<span class="pano-text-sub">${escapeHtml(t.subtitle)}</span>` : ''}
            </div>
          </div>
          <div class="pano-text-pin-stem" style="background-color: ${color}"></div>
          <div class="pano-text-pin-dot" style="background-color: ${color}; box-shadow: 0 0 10px ${color}"></div>
        </div>`;
    }

    const handleAttr = editable ? `data-handle="text:${t.id}:0"` : '';
    const anchor = style === 'pin' ? 'bottom center' : 'center center';

    return {
      id: `text:${t.id}`,
      position: { yaw: t.yaw, pitch: t.pitch },
      html: `<div class="pano-text-wrapper ${isSel ? 'is-selected' : ''}" ${handleAttr}>${innerHtml}</div>`,
      anchor,
      className: `pano-text-marker ${editable ? 'is-draggable' : ''}`,
      data: { type: 'text', id: t.id },
    };
  });
}

/* -------------------------------------------------- imagens e logo no 360° */
export function panoImageMarkers(panoImages, { imageUrls = {}, defaultLogoUrl = null, selectedId = null, editable = false } = {}) {
  return panoImages
    .map((img) => {
      const isSel = img.id === selectedId;
      const url = (img.imageId && imageUrls[img.imageId]) || defaultLogoUrl;
      if (!url) return null;
      const isNadir = Boolean(img.isNadir);
      const size = img.size || (isNadir ? 240 : 160);
      const opacity = (img.opacity ?? 100) / 100;
      const shape = img.shape || 'circle';
      const shapeClass = shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-2xl' : 'rounded-none';
      const handleAttr = editable ? `data-handle="panoImage:${img.id}:0"` : '';

      return {
        id: `pimg:${img.id}`,
        position: isNadir ? { yaw: img.yaw || 0, pitch: -Math.PI / 2 } : { yaw: img.yaw, pitch: img.pitch },
        html: `
          <div class="pano-spatial-image ${shapeClass} ${isNadir ? 'is-nadir' : ''} ${isSel ? 'is-selected' : ''}"
               ${handleAttr}
               style="width: ${size}px; height: ${size}px; opacity: ${opacity};"
               title="${escapeHtml(img.title || (isNadir ? 'Logo da Empresa (Nadir 360°)' : 'Imagem 360°'))}">
            <img src="${url}" alt="360 Image" class="w-full h-full object-contain pointer-events-none ${shapeClass}" />
            ${img.title && !isNadir ? `<span class="pano-img-caption">${escapeHtml(img.title)}</span>` : ''}
            ${editable && isSel ? '<div class="pano-img-drag-hint">Arraste para mover</div>' : ''}
          </div>`,
        size: { width: size, height: size },
        anchor: 'center center',
        className: `pano-img-marker ${editable ? 'is-draggable' : ''}`,
        data: { type: 'panoImage', id: img.id },
      };
    })
    .filter(Boolean);
}
