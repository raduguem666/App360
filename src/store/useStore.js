/**
 * Estado global do Studio (zustand).
 * - `project`: documento persistido (IndexedDB) e exportado
 * - `imageUrls`: object URLs das imagens carregadas (não persistido)
 * - estado de UI: cena ativa, ferramenta, seleção, rascunhos, histórico (undo/redo)
 */
import { create } from 'zustand';
import { uid, emptyProject, normalizeProject, lotDisplayName, blockCodeFromName } from '../lib/model.js';
import { generateBlockLots } from '../lib/blocks.js';
import { putImage } from '../lib/db.js';

const HISTORY_LIMIT = 60;

export const useStore = create((set, get) => ({
  project: emptyProject(),
  imageUrls: {},
  ready: false,

  mode: 'editor', // 'editor' | 'presentation'
  activeSceneId: null,
  tool: 'select', // 'select' | 'polygon' | 'grid' | 'hotspot' | 'mappin'
  draft: [], // pontos em desenho (polígono livre ou 4 cantos da quadra)
  pendingBlock: null, // { corners } aguardando configuração da quadra
  adjustingBlockId: null,
  hotspotTarget: null,
  selectedLotIds: [],
  selectedHotspotId: null,
  selectedBlockId: null,
  selectedTextId: null,
  selectedPanoImageId: null,
  layerFilter: { search: '', status: 'all', allScenes: false },
  toast: null,
  past: [],
  future: [],

  /* ------------------------------------------------------------ infra */
  setReady: (ready) => set({ ready }),
  showToast: (message, kind = 'info') => {
    const id = Date.now();
    set({ toast: { id, message, kind } });
    setTimeout(() => get().toast?.id === id && set({ toast: null }), 3200);
  },

  loadProject: (project, imageUrls) => {
    const old = get().imageUrls;
    Object.values(old).forEach((u) => u.startsWith('blob:') && !Object.values(imageUrls).includes(u) && URL.revokeObjectURL(u));
    const p = normalizeProject(project);
    set({
      project: p,
      imageUrls,
      activeSceneId: p.startSceneId || p.scenes[0]?.id || null,
      tool: 'select',
      draft: [],
      pendingBlock: null,
      adjustingBlockId: null,
      selectedLotIds: [],
      selectedHotspotId: null,
      selectedBlockId: null,
      selectedTextId: null,
      selectedPanoImageId: null,
      past: [],
      future: [],
    });
  },

  /** Aplica uma mutação imutável no projeto, registrando histórico. */
  commit: (fn, { history = true } = {}) => {
    const prev = get().project;
    const next = fn(prev);
    if (!next || next === prev) return;
    next.updatedAt = Date.now();
    set((s) => ({
      project: next,
      past: history ? [...s.past.slice(-HISTORY_LIMIT + 1), prev] : s.past,
      future: history ? [] : s.future,
    }));
  },
  undo: () => {
    const { past, project, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], ...sanitizeSelection(prev, get()) });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length) return;
    const next = future[0];
    set({ project: next, past: [...past, project], future: future.slice(1), ...sanitizeSelection(next, get()) });
  },

  /* ------------------------------------------------------------ modo / UI */
  setMode: (mode) => set({ mode, tool: 'select', draft: [], adjustingBlockId: null, pendingBlock: null }),
  setTool: (tool) =>
    set((s) => ({
      tool,
      draft: [],
      pendingBlock: null,
      adjustingBlockId: tool === 'select' ? s.adjustingBlockId : null,
    })),
  setHotspotTarget: (id) => set({ hotspotTarget: id }),
  setLayerFilter: (patch) => set((s) => ({ layerFilter: { ...s.layerFilter, ...patch } })),
  setActiveScene: (id) =>
    set({ activeSceneId: id, draft: [], pendingBlock: null, adjustingBlockId: null, selectedHotspotId: null, selectedBlockId: null, selectedLotIds: [], selectedTextId: null, selectedPanoImageId: null }),

  /* ------------------------------------------------------------ seleção */
  selectLots: (ids, { additive = false } = {}) =>
    set((s) => {
      let next = ids;
      if (additive) {
        const cur = new Set(s.selectedLotIds);
        ids.forEach((id) => (cur.has(id) ? cur.delete(id) : cur.add(id)));
        next = [...cur];
      }
      return { selectedLotIds: next, selectedHotspotId: null, selectedBlockId: null, selectedTextId: null, selectedPanoImageId: null };
    }),
  selectHotspot: (id) => set({ selectedHotspotId: id, selectedLotIds: [], selectedBlockId: null, selectedTextId: null, selectedPanoImageId: null }),
  selectBlock: (id) => {
    const lots = get().project.lots.filter((l) => l.blockId === id).map((l) => l.id);
    set({ selectedBlockId: id, selectedLotIds: lots, selectedHotspotId: null, selectedTextId: null, selectedPanoImageId: null });
  },
  selectText: (id) => set({ selectedTextId: id, selectedLotIds: [], selectedHotspotId: null, selectedBlockId: null, selectedPanoImageId: null }),
  selectPanoImage: (id) => set({ selectedPanoImageId: id, selectedLotIds: [], selectedHotspotId: null, selectedBlockId: null, selectedTextId: null }),
  clearSelection: () => set({ selectedLotIds: [], selectedHotspotId: null, selectedBlockId: null, selectedTextId: null, selectedPanoImageId: null }),

  /* ------------------------------------------------------------ rascunho */
  addDraftPoint: (pt) => set((s) => ({ draft: [...s.draft, pt] })),
  popDraftPoint: () => set((s) => ({ draft: s.draft.slice(0, -1) })),
  clearDraft: () => set({ draft: [], pendingBlock: null }),
  setPendingBlock: (pb) => set({ pendingBlock: pb }),

  /* ------------------------------------------------------------ cenas */
  addSceneFiles: async (files) => {
    const created = [];
    for (const file of files) {
      const imageId = uid('img');
      await putImage(imageId, file);
      const url = URL.createObjectURL(file);
      created.push({ scene: newScene(file.name.replace(/\.[^.]+$/, ''), imageId), url, imageId });
    }
    set((s) => ({ imageUrls: { ...s.imageUrls, ...Object.fromEntries(created.map((c) => [c.imageId, c.url])) } }));
    get().commit((p) => ({
      ...p,
      scenes: [...p.scenes, ...created.map((c) => c.scene)],
      startSceneId: p.startSceneId || created[0]?.scene.id || null,
    }));
    if (!get().activeSceneId && created[0]) set({ activeSceneId: created[0].scene.id });
    return created.map((c) => c.scene);
  },
  updateScene: (id, patch) => get().commit((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
  removeScene: (id) => {
    get().commit((p) => {
      const scenes = p.scenes.filter((s) => s.id !== id);
      return {
        ...p,
        scenes,
        startSceneId: p.startSceneId === id ? scenes[0]?.id || null : p.startSceneId,
        hotspots: p.hotspots.filter((h) => h.sceneId !== id && h.targetSceneId !== id),
        blocks: p.blocks.filter((b) => b.sceneId !== id),
        lots: p.lots.filter((l) => l.sceneId !== id),
      };
    });
    if (get().activeSceneId === id) get().setActiveScene(get().project.scenes[0]?.id || null);
  },
  moveScene: (id, dir) =>
    get().commit((p) => {
      const i = p.scenes.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.scenes.length) return p;
      const scenes = [...p.scenes];
      [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
      return { ...p, scenes };
    }),

  /* ------------------------------------------------------------ masterplan */
  setMasterplanFile: async (file) => {
    const imageId = uid('img');
    await putImage(imageId, file);
    set((s) => ({ imageUrls: { ...s.imageUrls, [imageId]: URL.createObjectURL(file) } }));
    get().commit((p) => ({ ...p, masterplan: { imageId } }));
  },
  removeMasterplan: () => get().commit((p) => ({ ...p, masterplan: null })),

  /* ------------------------------------------------------------ hotspots */
  addHotspot: (pos) => {
    const { activeSceneId, hotspotTarget, project } = get();
    const target = hotspotTarget || project.scenes.find((s) => s.id !== activeSceneId)?.id;
    if (!target) return get().showToast('Adicione uma segunda cena para criar hotspots de transição.', 'warn');
    const targetScene = project.scenes.find((s) => s.id === target);
    const hs = {
      id: uid('hs'),
      sceneId: activeSceneId,
      yaw: pos.yaw,
      pitch: pos.pitch,
      targetSceneId: target,
      label: `Ir para ${targetScene?.name ?? 'cena'}`,
      style: pos.pitch < -0.15 ? 'ground' : 'float',
    };
    get().commit((p) => ({ ...p, hotspots: [...p.hotspots, hs] }));
    set({ selectedHotspotId: hs.id, selectedLotIds: [], tool: 'select' });
  },
  updateHotspot: (id, patch) => get().commit((p) => ({ ...p, hotspots: p.hotspots.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
  removeHotspot: (id) => {
    get().commit((p) => ({ ...p, hotspots: p.hotspots.filter((h) => h.id !== id) }));
    set({ selectedHotspotId: null });
  },

  /* ------------------------------------------------------------ lotes */
  finishPolygon: () => {
    const { draft, activeSceneId, project } = get();
    const pts = dedupe(draft);
    if (pts.length < 3) return get().showToast('Um lote precisa de pelo menos 3 vértices.', 'warn');
    const loose = project.lots.filter((l) => !l.blockId);
    const number = loose.reduce((m, l) => Math.max(m, l.number || 0), 0) + 1;
    const lot = {
      id: uid('lot'),
      sceneId: activeSceneId,
      blockId: null,
      cell: null,
      number,
      name: lotDisplayName('AV', number),
      autoName: true,
      status: 'disponivel',
      area: null,
      front: null,
      back: null,
      sideLeft: null,
      sideRight: null,
      price: null,
      conditions: '',
      notes: '',
      showLabel: true,
      points: pts,
    };
    get().commit((p) => ({ ...p, lots: [...p.lots, lot] }));
    set({ draft: [], selectedLotIds: [lot.id], selectedHotspotId: null, selectedBlockId: null });
    get().showToast(`${lot.name} criado.`, 'ok');
  },
  updateLots: (ids, patch) => {
    const set_ = new Set(ids);
    get().commit((p) => ({
      ...p,
      lots: p.lots.map((l) => {
        if (!set_.has(l.id)) return l;
        const next = { ...l, ...patch };
        if ('name' in patch) next.autoName = false;
        return next;
      }),
    }));
  },
  removeLots: (ids) => {
    const s = new Set(ids);
    get().commit((p) => ({ ...p, lots: p.lots.filter((l) => !s.has(l.id)) }));
    set({ selectedLotIds: [] });
  },
  /** Arrasta um vértice de lote avulso */
  moveLotVertex: (lotId, index, pos, history = false) =>
    get().commit(
      (p) => ({
        ...p,
        lots: p.lots.map((l) => (l.id === lotId ? { ...l, points: l.points.map((pt, i) => (i === index ? pos : pt)) } : l)),
      }),
      { history },
    ),

  /* ------------------------------------------------------------ quadras */
  createBlock: (config) => {
    const { pendingBlock, activeSceneId } = get();
    if (!pendingBlock) return;
    const block = {
      id: uid('blk'),
      sceneId: activeSceneId,
      name: config.name,
      code: config.code || blockCodeFromName(config.name),
      corners: pendingBlock.corners,
      cols: config.cols,
      rows: config.rows,
      startNumber: config.startNumber,
      numbering: config.numbering,
      method: config.method,
      defaults: config.defaults,
    };
    const lots = generateBlockLots(block);
    get().commit((p) => ({ ...p, blocks: [...p.blocks, block], lots: [...p.lots, ...lots] }));
    set({ pendingBlock: null, draft: [], tool: 'select', selectedBlockId: block.id, selectedLotIds: lots.map((l) => l.id) });
    get().showToast(`${block.name}: ${lots.length} lotes gerados.`, 'ok');
  },
  /** Atualiza configuração/cantos da quadra e regenera a geometria dos lotes. */
  updateBlock: (id, patch, { history = true } = {}) =>
    get().commit(
      (p) => {
        const block = p.blocks.find((b) => b.id === id);
        if (!block) return p;
        const next = { ...block, ...patch };
        if (patch.name && !patch.code) next.code = blockCodeFromName(patch.name);
        const own = p.lots.filter((l) => l.blockId === id);
        const inGrid = own.filter((l) => l.cell && l.cell.row < next.rows && l.cell.col < next.cols);
        const regenerated = generateBlockLots(next, inGrid);
        return {
          ...p,
          blocks: p.blocks.map((b) => (b.id === id ? next : b)),
          lots: [...p.lots.filter((l) => l.blockId !== id), ...regenerated],
        };
      },
      { history },
    ),
  removeBlock: (id) => {
    get().commit((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id), lots: p.lots.filter((l) => l.blockId !== id) }));
    set({ selectedBlockId: null, selectedLotIds: [], adjustingBlockId: null });
  },
  setAdjustingBlock: (id) => set({ adjustingBlockId: id, tool: 'select', draft: [] }),
  /** Clona a quadra (com propriedades dos lotes) para outra cena 360°. */
  cloneBlockToScene: (id, sceneId) => {
    const { project } = get();
    const block = project.blocks.find((b) => b.id === id);
    if (!block) return;
    const nb = { ...block, id: uid('blk'), sceneId, corners: block.corners.map((c) => ({ ...c })) };
    const srcLots = project.lots.filter((l) => l.blockId === id);
    const lots = generateBlockLots(
      nb,
      srcLots.map((l) => ({ ...l, id: uid('lot'), blockId: nb.id })),
    );
    get().commit((p) => ({ ...p, blocks: [...p.blocks, nb], lots: [...p.lots, ...lots] }));
    set({ activeSceneId: sceneId, adjustingBlockId: nb.id, selectedBlockId: nb.id, selectedLotIds: [], tool: 'select' });
    get().showToast(`${nb.name} clonada. Arraste os 4 pinos para alinhar nesta cena.`, 'ok');
  },

  /* ------------------------------------------------------------ ajustes e marca */
  updateSettings: (patch) => get().commit((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
  updateAction: (patch) => get().commit((p) => ({ ...p, settings: { ...p.settings, action: { ...p.settings.action, ...patch } } })),
  updateBranding: (patch) =>
    get().commit((p) => ({
      ...p,
      settings: {
        ...p.settings,
        branding: { ...(p.settings?.branding || {}), ...patch },
      },
    })),
  setCompanyLogoFile: async (file) => {
    const imageId = uid('img');
    await putImage(imageId, file);
    const url = URL.createObjectURL(file);
    set((s) => ({ imageUrls: { ...s.imageUrls, [imageId]: url } }));
    get().commit((p) => ({
      ...p,
      settings: {
        ...p.settings,
        branding: {
          ...(p.settings?.branding || {}),
          logoImageId: imageId,
          enabled: true,
        },
      },
    }));
    get().showToast('Logo da empresa atualizado com sucesso!', 'ok');
  },
  removeCompanyLogo: () => {
    get().commit((p) => ({
      ...p,
      settings: {
        ...p.settings,
        branding: {
          ...(p.settings?.branding || {}),
          logoImageId: null,
        },
      },
    }));
    get().showToast('Logo da empresa removido.', 'ok');
  },
  /* ------------------------------------------------------------ textos 360° */
  addPanoText: ({ sceneId, yaw, pitch, text = 'Novo Rótulo', subtitle = '', style = 'pin', fontSize = 'base', color = '#A3E635', bgColor = '#121212', icon = 'map-pin' }) => {
    const t = {
      id: uid('txt'),
      sceneId: sceneId || get().activeSceneId,
      yaw: +yaw.toFixed(6),
      pitch: +pitch.toFixed(6),
      text,
      subtitle,
      style,
      fontSize,
      color,
      bgColor,
      icon,
    };
    get().commit((p) => ({ ...p, texts: [...(p.texts || []), t] }));
    set({ selectedTextId: t.id, tool: 'select', selectedLotIds: [], selectedHotspotId: null, selectedBlockId: null, selectedPanoImageId: null });
    get().showToast('Texto adicionado na imagem 360°!', 'ok');
    return t;
  },
  updatePanoText: (id, patch, { history = true } = {}) =>
    get().commit(
      (p) => ({
        ...p,
        texts: (p.texts || []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }),
      { history },
    ),
  removePanoText: (id) => {
    get().commit((p) => ({
      ...p,
      texts: (p.texts || []).filter((t) => t.id !== id),
    }));
    set((s) => ({ selectedTextId: s.selectedTextId === id ? null : s.selectedTextId }));
    get().showToast('Texto removido da imagem.', 'ok');
  },
  movePanoText: (id, pos, history = false) =>
    get().commit(
      (p) => ({
        ...p,
        texts: (p.texts || []).map((t) => (t.id === id ? { ...t, yaw: pos.yaw, pitch: pos.pitch } : t)),
      }),
      { history },
    ),

  /* ------------------------------------------------------------ imagens e logo no 360° */
  addPanoImage: ({ sceneId, imageId = null, yaw = 0, pitch = 0, isNadir = false, size = 240, shape = 'circle', opacity = 100, title = '' }) => {
    const targetImageId = imageId || get().project.settings.branding?.logoImageId;
    if (!targetImageId) {
      get().showToast('Faça o upload da logo da empresa para inserir na esfera 360°!', 'warn');
      return null;
    }
    const img = {
      id: uid('pimg'),
      sceneId: sceneId || get().activeSceneId,
      imageId: targetImageId,
      isNadir: Boolean(isNadir),
      yaw: isNadir ? 0 : +yaw.toFixed(6),
      pitch: isNadir ? -1.570796 : +pitch.toFixed(6),
      size,
      shape,
      opacity,
      title: title || (isNadir ? 'Logo da Empresa (Nadir)' : 'Logo 360°'),
    };
    get().commit((p) => ({ ...p, panoImages: [...(p.panoImages || []), img] }));
    set({ selectedPanoImageId: img.id, tool: 'select', selectedLotIds: [], selectedHotspotId: null, selectedBlockId: null, selectedTextId: null });
    get().showToast(isNadir ? 'Logo posicionada no chão da foto 360° (Nadir)!' : 'Logo inserida na foto 360°!', 'ok');
    return img;
  },
  addNadirLogo: (sceneId) => {
    const targetSceneId = sceneId || get().activeSceneId;
    const existing = (get().project.panoImages || []).find((p) => p.sceneId === targetSceneId && p.isNadir);
    if (existing) {
      set({ selectedPanoImageId: existing.id, tool: 'select', selectedLotIds: [], selectedHotspotId: null, selectedBlockId: null, selectedTextId: null });
      get().showToast('Logo do Nadir já existe nesta cena. Selecionada para edição!', 'info');
      return existing;
    }
    return get().addPanoImage({
      sceneId: targetSceneId,
      isNadir: true,
      size: 260,
      shape: 'circle',
      opacity: 100,
      title: 'Logo no Nadir',
    });
  },
  updatePanoImage: (id, patch, { history = true } = {}) =>
    get().commit(
      (p) => ({
        ...p,
        panoImages: (p.panoImages || []).map((img) => (img.id === id ? { ...img, ...patch } : img)),
      }),
      { history },
    ),
  removePanoImage: (id) => {
    get().commit((p) => ({
      ...p,
      panoImages: (p.panoImages || []).filter((img) => img.id !== id),
    }));
    set((s) => ({ selectedPanoImageId: s.selectedPanoImageId === id ? null : s.selectedPanoImageId }));
    get().showToast('Imagem/Logo removida da foto 360°.', 'ok');
  },
  movePanoImage: (id, pos, history = false) =>
    get().commit(
      (p) => ({
        ...p,
        panoImages: (p.panoImages || []).map((img) =>
          img.id === id && !img.isNadir ? { ...img, yaw: pos.yaw, pitch: pos.pitch } : img
        ),
      }),
      { history },
    ),

  renameProject: (name) => get().commit((p) => ({ ...p, name })),
}));

function newScene(name, imageId) {
  return {
    id: uid('scn'),
    name,
    subtitle: '',
    showTitleOnPano: true,
    imageId,
    initialView: { yaw: 0, pitch: -0.4, zoom: 40 },
    mapPos: null,
    mapHeading: 0,
  };
}

function dedupe(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.yaw - p.yaw) > 1e-4 || Math.abs(last.pitch - p.pitch) > 1e-4) out.push(p);
  }
  if (out.length > 2) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a.yaw - b.yaw) < 1e-4 && Math.abs(a.pitch - b.pitch) < 1e-4) out.pop();
  }
  return out;
}

function sanitizeSelection(project, state) {
  const lotIds = new Set(project.lots.map((l) => l.id));
  return {
    selectedLotIds: state.selectedLotIds.filter((id) => lotIds.has(id)),
    selectedHotspotId: project.hotspots.some((h) => h.id === state.selectedHotspotId) ? state.selectedHotspotId : null,
    selectedBlockId: project.blocks.some((b) => b.id === state.selectedBlockId) ? state.selectedBlockId : null,
    selectedTextId: (project.texts || []).some((t) => t.id === state.selectedTextId) ? state.selectedTextId : null,
    selectedPanoImageId: (project.panoImages || []).some((img) => img.id === state.selectedPanoImageId) ? state.selectedPanoImageId : null,
    adjustingBlockId: project.blocks.some((b) => b.id === state.adjustingBlockId) ? state.adjustingBlockId : null,
    activeSceneId: project.scenes.some((s) => s.id === state.activeSceneId) ? state.activeSceneId : project.scenes[0]?.id || null,
  };
}
