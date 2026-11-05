/**
 * Aplicação Principal: Studio (Módulo 1) + Modo Apresentação (Módulo 2).
 * - Na inicialização, restaura o projeto salvo no IndexedDB ou gera o projeto
 *   procedural de demonstração (duas fotos 360° de drone + Masterplan 2D + Quadra)
 * - Auto-salva alterações automaticamente no IndexedDB
 * - Gerencia atalhos de teclado, desenho de polígonos e subdivisão de quadras
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Undo2,
  X,
  Grid3X3,
  Pentagon,
  Navigation,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { useStore } from './store/useStore.js';
import {
  loadProject as loadDbProject,
  saveProject as saveDbProject,
  getImage,
  putImage,
  garbageCollectImages,
  referencedImageIds,
  requestPersistentStorage,
  clearAll,
} from './lib/db.js';
import { buildDemoProject, DEMO_CAMERAS, demoBlockCorners } from './lib/demo.js';
import {
  lotMarkers,
  hotspotMarkers,
  blockMarkers,
  vertexHandles,
  draftMarkers,
  lotCentroid,
} from './lib/markers.js';
import Viewer360 from './components/Viewer360.jsx';
import TopToolbar from './components/TopToolbar.jsx';
import ScenesPanel from './components/ScenesPanel.jsx';
import LayersAndInspector from './components/LayersAndInspector.jsx';
import MasterplanWidget from './components/MasterplanWidget.jsx';
import BlockGeneratorModal from './components/BlockGeneratorModal.jsx';
import PresentationView from './components/PresentationView.jsx';

export default function App() {
  const viewerRef = useRef(null);
  const [bootMessage, setBootMessage] = useState('Inicializando motor 360° e IndexedDB…');
  const [bootProgress, setBootProgress] = useState(0.1);
  const [cursorPos, setCursorPos] = useState(null);
  const [viewYaw, setViewYaw] = useState(0);
  const [placingMapPin, setPlacingMapPin] = useState(false);

  const ready = useStore((s) => s.ready);
  const mode = useStore((s) => s.mode);
  const project = useStore((s) => s.project);
  const imageUrls = useStore((s) => s.imageUrls);
  const activeSceneId = useStore((s) => s.activeSceneId);
  const tool = useStore((s) => s.tool);
  const draft = useStore((s) => s.draft);
  const pendingBlock = useStore((s) => s.pendingBlock);
  const adjustingBlockId = useStore((s) => s.adjustingBlockId);
  const selectedLotIds = useStore((s) => s.selectedLotIds);
  const selectedHotspotId = useStore((s) => s.selectedHotspotId);
  const selectedBlockId = useStore((s) => s.selectedBlockId);
  const toast = useStore((s) => s.toast);

  const setReady = useStore((s) => s.setReady);
  const setMode = useStore((s) => s.setMode);
  const setTool = useStore((s) => s.setTool);
  const loadProject = useStore((s) => s.loadProject);
  const setActiveScene = useStore((s) => s.setActiveScene);
  const updateScene = useStore((s) => s.updateScene);
  const setMasterplanFile = useStore((s) => s.setMasterplanFile);
  const removeMasterplan = useStore((s) => s.removeMasterplan);
  const addDraftPoint = useStore((s) => s.addDraftPoint);
  const popDraftPoint = useStore((s) => s.popDraftPoint);
  const clearDraft = useStore((s) => s.clearDraft);
  const setPendingBlock = useStore((s) => s.setPendingBlock);
  const finishPolygon = useStore((s) => s.finishPolygon);
  const addHotspot = useStore((s) => s.addHotspot);
  const selectLots = useStore((s) => s.selectLots);
  const selectHotspot = useStore((s) => s.selectHotspot);
  const clearSelection = useStore((s) => s.clearSelection);
  const updateBlock = useStore((s) => s.updateBlock);
  const setAdjustingBlock = useStore((s) => s.setAdjustingBlock);
  const moveLotVertex = useStore((s) => s.moveLotVertex);
  const removeLots = useStore((s) => s.removeLots);
  const removeHotspot = useStore((s) => s.removeHotspot);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const showToast = useStore((s) => s.showToast);

  /* --------------------------------------------------- Inicialização IndexedDB */
  const initOrResetDemo = useCallback(
    async (forceDemo = false) => {
      setReady(false);
      await requestPersistentStorage();
      if (forceDemo) await clearAll();

      const saved = !forceDemo ? await loadDbProject() : null;
      if (saved && saved.scenes?.length > 0) {
        setBootMessage('Carregando panoramas 360° do IndexedDB…');
        const ids = referencedImageIds(saved);
        const urls = {};
        let missing = false;
        for (const id of ids) {
          const blob = await getImage(id);
          if (!blob) {
            missing = true;
            break;
          }
          urls[id] = URL.createObjectURL(blob);
        }
        if (!missing) {
          loadProject(saved, urls);
          setReady(true);
          return;
        }
      }

      // Constrói loteamento 360° procedural de demonstração
      const { project: demoPrj, images } = await buildDemoProject((msg, p) => {
        setBootMessage(msg);
        setBootProgress(p);
      });
      const urls = {};
      for (const [id, blob] of Object.entries(images)) {
        await putImage(id, blob);
        urls[id] = URL.createObjectURL(blob);
      }
      await saveDbProject(demoPrj);
      loadProject(demoPrj, urls);
      setReady(true);
    },
    [loadProject, setReady],
  );

  useEffect(() => {
    initOrResetDemo(false);
  }, [initOrResetDemo]);

  /* --------------------------------------------------- Auto-Save no IndexedDB */
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(async () => {
      await saveDbProject(project);
      await garbageCollectImages(project);
    }, 350);
    return () => clearTimeout(t);
  }, [project, ready]);

  /* --------------------------------------------------- Atalhos de Teclado */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mode !== 'editor') return;

      if (e.key === 'Escape') {
        if (draft.length || pendingBlock) clearDraft();
        else if (adjustingBlockId) setAdjustingBlock(null);
        else clearSelection();
      } else if (e.key === 'Enter' && tool === 'polygon' && draft.length >= 3) {
        finishPolygon();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !draft.length) {
        if (selectedLotIds.length) removeLots(selectedLotIds);
        else if (selectedHotspotId) removeHotspot(selectedHotspotId);
      } else if (e.key.toLowerCase() === 'v') setTool('select');
      else if (e.key.toLowerCase() === 'p') setTool('polygon');
      else if (e.key.toLowerCase() === 'g') setTool('grid');
      else if (e.key.toLowerCase() === 'h') setTool('hotspot');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    mode,
    tool,
    draft,
    pendingBlock,
    adjustingBlockId,
    selectedLotIds,
    selectedHotspotId,
    clearDraft,
    setAdjustingBlock,
    clearSelection,
    finishPolygon,
    removeLots,
    removeHotspot,
    setTool,
    undo,
    redo,
  ]);

  const activeScene = useMemo(
    () => project.scenes.find((s) => s.id === activeSceneId) || project.scenes[0] || null,
    [project.scenes, activeSceneId],
  );

  const scenesById = useMemo(
    () => Object.fromEntries(project.scenes.map((s) => [s.id, s])),
    [project.scenes],
  );

  const sceneLots = useMemo(
    () => project.lots.filter((l) => l.sceneId === activeScene?.id),
    [project.lots, activeScene?.id],
  );

  const sceneBlocks = useMemo(
    () => project.blocks.filter((b) => b.sceneId === activeScene?.id),
    [project.blocks, activeScene?.id],
  );

  const sceneHotspots = useMemo(
    () => project.hotspots.filter((h) => h.sceneId === activeScene?.id),
    [project.hotspots, activeScene?.id],
  );

  const selectedSet = useMemo(() => new Set(selectedLotIds), [selectedLotIds]);

  /* --------------------------------------------------- Construção de Markers */
  const markers = useMemo(() => {
    if (!activeScene) return [];
    const out = [
      ...lotMarkers(sceneLots, {
        selected: selectedSet,
        showLabels: project.settings?.showLabels !== false,
        presentation: false,
      }),
      ...hotspotMarkers(sceneHotspots, {
        selectedId: selectedHotspotId,
        scenesById,
      }),
    ];

    for (const blk of sceneBlocks) {
      out.push(
        ...blockMarkers(blk, {
          adjusting: adjustingBlockId === blk.id,
          selected: selectedBlockId === blk.id,
        }),
      );
    }

    // Vértices arrastáveis quando 1 lote manual (sem quadra) está selecionado
    if (selectedLotIds.length === 1) {
      const lot = sceneLots.find((l) => l.id === selectedLotIds[0]);
      if (lot && !lot.blockId) out.push(...vertexHandles(lot));
    }

    // Rascunho (polígono livre ou 4 pontos da quadra)
    out.push(
      ...draftMarkers({
        tool,
        draft,
        cursor: tool === 'polygon' || tool === 'grid' ? cursorPos : null,
        pendingBlock,
      }),
    );

    return out;
  }, [
    activeScene,
    sceneLots,
    sceneBlocks,
    sceneHotspots,
    selectedSet,
    selectedLotIds,
    selectedHotspotId,
    selectedBlockId,
    adjustingBlockId,
    project.settings?.showLabels,
    scenesById,
    tool,
    draft,
    cursorPos,
    pendingBlock,
  ]);

  /* --------------------------------------------------- Interações na Esfera 360° */
  const handleSphereClick = (pos, marker, originalEvent) => {
    const pt = { yaw: +pos.yaw.toFixed(6), pitch: +pos.pitch.toFixed(6) };
    const data = marker?.config?.data || marker?.data;

    // 1. Ferramenta Polígono Livre (Lote Manual)
    if (tool === 'polygon') {
      if (data?.type === 'draft-vertex' && data.index === 0 && draft.length >= 3) {
        finishPolygon();
        return;
      }
      addDraftPoint(pt);
      return;
    }

    // 2. Ferramenta Subdivisão Automática de Quadra (4 Cantos)
    if (tool === 'grid') {
      if (pendingBlock) return;
      const next = [...draft, pt];
      if (next.length >= 4) {
        setPendingBlock({
          corners: next.slice(0, 4),
          preview: { cols: 10, rows: 2, method: 'perspective' },
        });
      } else {
        addDraftPoint(pt);
      }
      return;
    }

    // 3. Ferramenta Hotspot de Transição
    if (tool === 'hotspot') {
      addHotspot(pt);
      return;
    }

    // 4. Modo Seleção
    if (!data) {
      clearSelection();
      return;
    }
    if (data.type === 'lot' || data.type === 'label') {
      const additive = !!(originalEvent?.shiftKey || originalEvent?.ctrlKey || originalEvent?.metaKey);
      selectLots([data.id], { additive });
    } else if (data.type === 'hotspot') {
      selectHotspot(data.id);
    }
  };

  const handleSphereDblClick = () => {
    if (tool === 'polygon' && draft.length >= 3) {
      finishPolygon();
    }
  };

  /* Arraste em tempo real dos 4 pinos da quadra ou vértices de lote manual */
  const dragInitialRef = useRef(null);
  const handleDragStart = () => {
    dragInitialRef.current = useStore.getState().project;
  };
  const handleDrag = (handle, pos) => {
    if (handle.kind === 'block') {
      const blk = useStore.getState().project.blocks.find((b) => b.id === handle.id);
      if (!blk) return;
      const corners = blk.corners.map((c, i) => (i === handle.index ? pos : c));
      updateBlock(blk.id, { corners }, { history: false });
    } else if (handle.kind === 'lot') {
      moveLotVertex(handle.id, handle.index, pos, false);
    }
  };
  const handleDragEnd = () => {
    if (dragInitialRef.current) {
      const prev = dragInitialRef.current;
      dragInitialRef.current = null;
      useStore.setState((s) => ({ past: [...s.past.slice(-59), prev], future: [] }));
    }
  };

  /* Preenchimento rápido de 4 cantos de exemplo para testar a ferramenta de Quadra */
  const fillSampleQuadraCorners = () => {
    const cam = DEMO_CAMERAS[0];
    // Escolhe uma quadra vizinha livre (ex: Quadra 09 à esquerda da Quadra 10)
    const corners = demoBlockCorners(cam, -1, 1);
    viewerRef.current?.animateTo({ yaw: -0.52, pitch: -0.68 }, 35);
    setPendingBlock({
      corners,
      preview: { cols: 10, rows: 2, method: 'perspective' },
    });
  };

  /* --------------------------------------------------- Tela de Carregamento */
  if (!ready) {
    return (
      <div className="h-full w-full bg-ink-950 grid place-items-center p-6 select-none">
        <div className="w-full max-w-md glass rounded-2xl p-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-lime text-ink-950 font-black text-lg grid place-items-center mx-auto shadow-[0_0_30px_rgba(163,230,53,0.45)]">
            360
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Lote360 Studio</h1>
            <p className="text-xs text-mute mt-1">{bootMessage}</p>
          </div>
          <div className="h-2 rounded-full bg-ink-900 overflow-hidden border border-white/[0.06]">
            <div
              className="h-full bg-lime transition-all duration-200"
              style={{ width: `${Math.round(bootProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------- Modo Apresentação (Player) */
  if (mode === 'presentation') {
    return (
      <PresentationView
        project={project}
        imageUrls={imageUrls}
        onExitEditor={() => setMode('editor')}
      />
    );
  }

  const panoramaUrl = activeScene ? imageUrls[activeScene.imageId] : null;
  const masterplanUrl = project.masterplan?.imageId ? imageUrls[project.masterplan.imageId] : null;
  const adjustingBlock = project.blocks.find((b) => b.id === adjustingBlockId) || null;

  /* --------------------------------------------------- Modo Studio (Editor) */
  return (
    <div className="h-full w-full flex flex-col bg-ink-950 overflow-hidden">
      <TopToolbar onResetDemo={() => initOrResetDemo(true)} />

      <div className="flex-1 flex min-h-0">
        {/* Painel Esquerdo: Cenas 360° */}
        <ScenesPanel
          onCaptureInitialView={(sceneId) => {
            const pos = viewerRef.current?.getPosition();
            if (pos) {
              updateScene(sceneId, {
                initialView: {
                  yaw: +pos.yaw.toFixed(4),
                  pitch: +pos.pitch.toFixed(4),
                  zoom: Math.round(pos.zoom),
                },
              });
              showToast('Ângulo inicial da câmera salvo para esta cena.', 'ok');
            }
          }}
        />

        {/* Viewport Central 360° */}
        <main className="relative flex-1 bg-ink-950 overflow-hidden">
          {activeScene && panoramaUrl ? (
            <Viewer360
              ref={viewerRef}
              panoramaUrl={panoramaUrl}
              sceneKey={activeScene.id}
              initialView={activeScene.initialView}
              markers={markers}
              onSphereClick={handleSphereClick}
              onSphereDblClick={handleSphereDblClick}
              onPointerMove={tool === 'polygon' || tool === 'grid' ? setCursorPos : undefined}
              onHandleDragStart={handleDragStart}
              onHandleDrag={handleDrag}
              onHandleDragEnd={handleDragEnd}
              onViewChange={(pos) => setViewYaw(pos.yaw)}
            />
          ) : (
            <div className="grid place-items-center h-full text-sm text-mute">
              Envie um panorama 360° no painel esquerdo para começar.
            </div>
          )}

          {/* HUD Flutuante da Ferramenta Ativa */}
          {tool === 'polygon' && (
            <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-xl px-3.5 py-2 flex items-center gap-3">
              <Pentagon className="w-4 h-4 text-lime" />
              <span className="text-xs text-neutral-200">
                <strong>Desenho de Lote Manual:</strong> clique nos cantos do terreno ({draft.length}{' '}
                {draft.length === 1 ? 'vértice' : 'vértices'}). Duplo-clique para fechar.
              </span>
              {draft.length > 0 && (
                <button
                  type="button"
                  onClick={popDraftPoint}
                  className="btn-outline !py-1 !px-2 text-xs"
                >
                  <Undo2 className="w-3 h-3" />
                  Desfazer ponto
                </button>
              )}
              {draft.length >= 3 && (
                <button
                  type="button"
                  onClick={finishPolygon}
                  className="btn-primary !py-1 !px-2.5 text-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Fechar Lote
                </button>
              )}
              <button
                type="button"
                onClick={() => setTool('select')}
                className="icon-btn !w-6 !h-6"
                title="Cancelar (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {tool === 'grid' && !pendingBlock && (
            <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-xl px-3.5 py-2 flex items-center gap-3">
              <Grid3X3 className="w-4 h-4 text-lime" />
              <span className="text-xs text-neutral-200">
                <strong>Subdivisão de Quadra:</strong> clique nos 4 cantos externos na foto 360° —{' '}
                <span className="text-lime font-bold">
                  P{draft.length + 1}/4 (
                  {['Topo-Esquerda', 'Topo-Direita', 'Base-Direita', 'Base-Esquerda'][draft.length]}
                  )
                </span>
              </span>
              <button
                type="button"
                onClick={fillSampleQuadraCorners}
                className="btn-outline !py-1 !px-2.5 text-xs"
                title="Demarcar automaticamente uma quadra da foto de demonstração"
              >
                <Sparkles className="w-3.5 h-3.5 text-lime" />
                Demarcar Quadra Exemplo
              </button>
              {draft.length > 0 && (
                <button
                  type="button"
                  onClick={popDraftPoint}
                  className="btn-outline !py-1 !px-2 text-xs"
                >
                  <Undo2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setTool('select')}
                className="icon-btn !w-6 !h-6"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {tool === 'hotspot' && (
            <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-xl px-3.5 py-2 flex items-center gap-3">
              <Navigation className="w-4 h-4 text-lime" />
              <span className="text-xs text-neutral-200">
                Clique em qualquer ponto da esfera 360° para criar um{' '}
                <strong>Hotspot de Transição</strong> para outra cena.
              </span>
              <button
                type="button"
                onClick={() => setTool('select')}
                className="icon-btn !w-6 !h-6"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {adjustingBlock && (
            <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-xl px-3.5 py-2 flex items-center gap-3 border border-lime/40">
              <Move className="w-4 h-4 text-lime" />
              <span className="text-xs text-neutral-200">
                Reajustando <strong>{adjustingBlock.name}</strong>: arraste os pinos{' '}
                <span className="text-lime font-bold">P1..P4</span> para alinhar todos os lotes em tempo real.
              </span>
              <button
                type="button"
                onClick={() => setAdjustingBlock(null)}
                className="btn-primary !py-1 !px-2.5 text-xs"
              >
                <Check className="w-3.5 h-3.5" />
                Concluir
              </button>
            </div>
          )}

          {/* Controles rápidos de câmera (canto inferior esquerdo) */}
          <div className="pointer-events-auto absolute left-3 bottom-3 z-20 flex items-center gap-1 glass rounded-xl p-1">
            <button
              type="button"
              onClick={() => viewerRef.current?.zoomIn()}
              className="icon-btn !w-7 !h-7"
              title="Zoom +"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => viewerRef.current?.zoomOut()}
              className="icon-btn !w-7 !h-7"
              title="Zoom -"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => viewerRef.current?.toggleFullscreen()}
              className="icon-btn !w-7 !h-7"
              title="Tela cheia"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Masterplan 2D retrátil (canto inferior direito) */}
          <div className="pointer-events-auto absolute right-3 bottom-3 z-20">
            <MasterplanWidget
              masterplanUrl={masterplanUrl}
              scenes={project.scenes}
              activeSceneId={activeScene?.id}
              viewYaw={viewYaw}
              editable
              placingPin={placingMapPin}
              onSelectScene={(id) => setActiveScene(id)}
              onTogglePlacePin={() => setPlacingMapPin((p) => !p)}
              onPlacePin={(mapPos) => {
                if (activeScene) {
                  updateScene(activeScene.id, { mapPos });
                  setPlacingMapPin(false);
                  showToast(`Pino de "${activeScene.name}" atualizado no Masterplan 2D.`, 'ok');
                }
              }}
              onUploadMasterplan={async (file) => {
                await setMasterplanFile(file);
                showToast('Masterplan 2D atualizado!', 'ok');
              }}
              onRemoveMasterplan={removeMasterplan}
            />
          </div>

          {/* Toast de feedback */}
          {toast && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-2 text-xs font-semibold text-white border border-lime/40 shadow-lg animate-[var(--animate-pop)]">
              <span className="text-lime mr-1.5">●</span>
              {toast.message}
            </div>
          )}
        </main>

        {/* Painel Direito: Camadas Agrupadas + Inspector de Propriedades */}
        <LayersAndInspector
          onFocusLot={(lot) => {
            if (lot.sceneId !== activeScene?.id) setActiveScene(lot.sceneId);
            const c = lotCentroid(lot);
            viewerRef.current?.animateTo(c);
          }}
          onFocusHotspot={(hs) => {
            viewerRef.current?.animateTo({ yaw: hs.yaw, pitch: hs.pitch });
          }}
        />
      </div>

      {/* Modal de Subdivisão Automática de Quadra */}
      <BlockGeneratorModal />
    </div>
  );
}
