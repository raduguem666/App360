/**
 * Painel Lateral Direito (estilo Mozari):
 * - Aba 1: Camadas agrupadas por Quadras e Lotes, busca rápida, filtro por status,
 *          seleção individual ou múltipla (Ctrl/Shift ou "Selecionar todos").
 * - Aba 2: Inspector de Propriedades (edição individual ou em massa de lotes,
 *          reajuste/clonagem de Quadra, edição de Hotspot e configuração do CTA).
 */
import { useMemo, useState } from 'react';
import {
  Layers,
  Sliders,
  Search,
  ChevronDown,
  ChevronRight,
  Move,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  CheckSquare,
  Navigation,
  Settings2,
  Building2,
  Camera,
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  Type,
} from 'lucide-react';
import { useStore } from '../store/useStore.js';
import {
  STATUS,
  STATUS_LIST,
  formatBRL,
  parseNum,
  pad,
} from '../lib/model.js';

export default function LayersAndInspector({ onFocusLot, onFocusHotspot }) {
  const [tab, setTab] = useState('layers'); // 'layers' | 'settings'
  const [collapsedBlocks, setCollapsedBlocks] = useState({});

  const project = useStore((s) => s.project);
  const imageUrls = useStore((s) => s.imageUrls);
  const activeSceneId = useStore((s) => s.activeSceneId);
  const selectedLotIds = useStore((s) => s.selectedLotIds);
  const selectedBlockId = useStore((s) => s.selectedBlockId);
  const selectedHotspotId = useStore((s) => s.selectedHotspotId);
  const adjustingBlockId = useStore((s) => s.adjustingBlockId);
  const layerFilter = useStore((s) => s.layerFilter);

  const setLayerFilter = useStore((s) => s.setLayerFilter);
  const selectLots = useStore((s) => s.selectLots);
  const selectBlock = useStore((s) => s.selectBlock);
  const selectHotspot = useStore((s) => s.selectHotspot);
  const clearSelection = useStore((s) => s.clearSelection);
  const updateLots = useStore((s) => s.updateLots);
  const removeLots = useStore((s) => s.removeLots);
  const updateBlock = useStore((s) => s.updateBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const setAdjustingBlock = useStore((s) => s.setAdjustingBlock);
  const cloneBlockToScene = useStore((s) => s.cloneBlockToScene);
  const updateHotspot = useStore((s) => s.updateHotspot);
  const removeHotspot = useStore((s) => s.removeHotspot);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateAction = useStore((s) => s.updateAction);
  const updateBranding = useStore((s) => s.updateBranding);
  const setCompanyLogoFile = useStore((s) => s.setCompanyLogoFile);
  const removeCompanyLogo = useStore((s) => s.removeCompanyLogo);
  const updateScene = useStore((s) => s.updateScene);

  const selectedSet = useMemo(() => new Set(selectedLotIds), [selectedLotIds]);

  const filteredLots = useMemo(() => {
    const q = layerFilter.search.trim().toLowerCase();
    return project.lots.filter((l) => {
      if (!layerFilter.allScenes && l.sceneId !== activeSceneId) return false;
      if (layerFilter.status !== 'all' && l.status !== layerFilter.status) return false;
      if (q && !l.name.toLowerCase().includes(q) && !String(l.number).includes(q)) return false;
      return true;
    });
  }, [project.lots, activeSceneId, layerFilter]);

  const sceneBlocks = useMemo(
    () =>
      project.blocks.filter((b) => layerFilter.allScenes || b.sceneId === activeSceneId),
    [project.blocks, activeSceneId, layerFilter.allScenes],
  );

  const looseLots = useMemo(
    () => filteredLots.filter((l) => !l.blockId),
    [filteredLots],
  );

  const sceneHotspots = useMemo(
    () => project.hotspots.filter((h) => h.sceneId === activeSceneId),
    [project.hotspots, activeSceneId],
  );

  const selectedLots = useMemo(
    () => project.lots.filter((l) => selectedSet.has(l.id)),
    [project.lots, selectedSet],
  );

  const activeBlock = useMemo(() => {
    if (selectedBlockId) return project.blocks.find((b) => b.id === selectedBlockId) || null;
    if (selectedLots.length > 0) {
      const firstBlockId = selectedLots[0].blockId;
      if (firstBlockId && selectedLots.every((l) => l.blockId === firstBlockId)) {
        return project.blocks.find((b) => b.id === firstBlockId) || null;
      }
    }
    return null;
  }, [project.blocks, selectedBlockId, selectedLots]);

  const selectedHotspot = useMemo(
    () => project.hotspots.find((h) => h.id === selectedHotspotId) || null,
    [project.hotspots, selectedHotspotId],
  );

  const toggleBlockCollapse = (id) =>
    setCollapsedBlocks((c) => ({ ...c, [id]: !c[id] }));

  return (
    <aside className="w-80 shrink-0 surface border-l border-white/[0.06] flex flex-col select-none">
      {/* Abas superiores */}
      <div className="grid grid-cols-2 border-b border-white/[0.06] bg-ink-900/50">
        <button
          type="button"
          onClick={() => setTab('layers')}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            tab === 'layers'
              ? 'border-lime text-lime bg-white/[0.02]'
              : 'border-transparent text-mute hover:text-neutral-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Camadas & Lotes
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            tab === 'settings'
              ? 'border-lime text-lime bg-white/[0.02]'
              : 'border-transparent text-mute hover:text-neutral-200'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Apresentação & CTA
        </button>
      </div>

      {tab === 'settings' ? (
        <SettingsTab
          project={project}
          imageUrls={imageUrls}
          activeScene={activeScene}
          updateSettings={updateSettings}
          updateAction={updateAction}
          updateBranding={updateBranding}
          setCompanyLogoFile={setCompanyLogoFile}
          removeCompanyLogo={removeCompanyLogo}
          updateScene={updateScene}
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Busca + Filtro de Camadas */}
          <div className="p-2.5 border-b border-white/[0.06] space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-mute absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                className="field !pl-8 !py-1 !text-xs"
                placeholder="Buscar quadra ou lote (ex: Q10, 05)..."
                value={layerFilter.search}
                onChange={(e) => setLayerFilter({ search: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <StatusChip
                  active={layerFilter.status === 'all'}
                  onClick={() => setLayerFilter({ status: 'all' })}
                  label="Todos"
                />
                {STATUS_LIST.map((st) => (
                  <StatusChip
                    key={st.key}
                    active={layerFilter.status === st.key}
                    onClick={() => setLayerFilter({ status: st.key })}
                    label={st.label.slice(0, 4)}
                    color={st.color}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  selectedLotIds.length === filteredLots.length && filteredLots.length > 0
                    ? clearSelection()
                    : selectLots(filteredLots.map((l) => l.id))
                }
                title="Selecionar todos os lotes filtrados (edição em massa)"
                className="text-[11px] text-soft hover:text-lime flex items-center gap-1"
              >
                {selectedLotIds.length === filteredLots.length && filteredLots.length > 0 ? (
                  <CheckSquare className="w-3.5 h-3.5 text-lime" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                Massa
              </button>
            </div>
          </div>

          {/* Árvore de Quadras, Lotes Avulsos e Hotspots */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[160px]">
            {sceneBlocks.map((block) => {
              const blockLots = filteredLots
                .filter((l) => l.blockId === block.id)
                .sort((a, b) => a.number - b.number);
              const isCollapsed = !!collapsedBlocks[block.id];
              const isBlockSelected = selectedBlockId === block.id;
              const isAdjusting = adjustingBlockId === block.id;

              return (
                <div
                  key={block.id}
                  className={`rounded-lg border overflow-hidden ${
                    isBlockSelected || isAdjusting
                      ? 'border-lime/60 bg-ink-850'
                      : 'border-white/[0.06] bg-ink-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-ink-900/90">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleBlockCollapse(block.id)}
                        className="text-mute hover:text-white"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectBlock(block.id)}
                        className="text-xs font-bold text-white hover:text-lime truncate"
                      >
                        {block.name}
                      </button>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-mute tabular">
                        {block.cols}×{block.rows} ({blockLots.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdjustingBlock(isAdjusting ? null : block.id)}
                      title="Reajustar os 4 pinos da quadra na esfera 360°"
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition ${
                        isAdjusting
                          ? 'bg-lime text-ink-950'
                          : 'bg-white/[0.06] text-soft hover:text-white'
                      }`}
                    >
                      <Move className="w-3 h-3" />
                      {isAdjusting ? 'Ajustando' : 'Reajustar'}
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="divide-y divide-white/[0.04]">
                      {blockLots.map((lot) => (
                        <LotRow
                          key={lot.id}
                          lot={lot}
                          selected={selectedSet.has(lot.id)}
                          onClick={(e) => {
                            selectLots([lot.id], { additive: e.shiftKey || e.ctrlKey || e.metaKey });
                            onFocusLot?.(lot);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Lotes manuais (polígono livre) */}
            {looseLots.length > 0 && (
              <div className="rounded-lg border border-white/[0.06] bg-ink-900/60 overflow-hidden">
                <div className="px-2.5 py-1.5 bg-ink-900/90 text-xs font-bold text-neutral-300">
                  Lotes Manuais ({looseLots.length})
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {looseLots.map((lot) => (
                    <LotRow
                      key={lot.id}
                      lot={lot}
                      selected={selectedSet.has(lot.id)}
                      onClick={(e) => {
                        selectLots([lot.id], { additive: e.shiftKey || e.ctrlKey || e.metaKey });
                        onFocusLot?.(lot);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Hotspots de Transição */}
            {sceneHotspots.length > 0 && (
              <div className="rounded-lg border border-white/[0.06] bg-ink-900/60 overflow-hidden">
                <div className="px-2.5 py-1.5 bg-ink-900/90 text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <Navigation className="w-3 h-3 text-lime" />
                  Hotspots de Navegação ({sceneHotspots.length})
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {sceneHotspots.map((hs) => (
                    <button
                      key={hs.id}
                      type="button"
                      onClick={() => {
                        selectHotspot(hs.id);
                        onFocusHotspot?.(hs);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs transition ${
                        selectedHotspotId === hs.id
                          ? 'bg-lime/15 text-lime font-semibold'
                          : 'text-neutral-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="truncate">{hs.label}</span>
                      <span className="text-[10px] text-mute uppercase">{hs.style}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sceneBlocks.length === 0 && looseLots.length === 0 && sceneHotspots.length === 0 && (
              <div className="py-10 px-4 text-center text-xs text-mute">
                Use as ferramentas <strong className="text-neutral-300">Quadra 4 Pontos</strong> ou{' '}
                <strong className="text-neutral-300">Lote Manual</strong> na barra superior para mapear terrenos.
              </div>
            )}
          </div>

          {/* Inspector de Propriedades (fixo na metade inferior) */}
          <div className="border-t border-white/[0.08] bg-ink-900/95 max-h-[54%] overflow-y-auto p-3 space-y-3">
            {selectedHotspot ? (
              <HotspotInspector
                hotspot={selectedHotspot}
                scenes={project.scenes}
                onChange={(patch) => updateHotspot(selectedHotspot.id, patch)}
                onDelete={() => removeHotspot(selectedHotspot.id)}
              />
            ) : selectedLots.length > 0 ? (
              <LotsInspector
                lots={selectedLots}
                block={activeBlock}
                scenes={project.scenes}
                activeSceneId={activeSceneId}
                adjustingBlockId={adjustingBlockId}
                onUpdateLots={(patch) => updateLots(selectedLotIds, patch)}
                onDeleteLots={() => removeLots(selectedLotIds)}
                onUpdateBlock={(patch) => activeBlock && updateBlock(activeBlock.id, patch)}
                onDeleteBlock={() => activeBlock && removeBlock(activeBlock.id)}
                onToggleAdjust={() =>
                  activeBlock &&
                  setAdjustingBlock(adjustingBlockId === activeBlock.id ? null : activeBlock.id)
                }
                onCloneBlock={(targetSceneId) =>
                  activeBlock && cloneBlockToScene(activeBlock.id, targetSceneId)
                }
              />
            ) : (
              <div className="py-4 text-center text-xs text-mute flex flex-col items-center gap-1">
                <Sliders className="w-4 h-4 text-mute" />
                Selecione um lote, quadra ou hotspot para editar propriedades (ou Shift+Clique para edição em massa).
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function LotRow({ lot, selected, onClick }) {
  const st = STATUS[lot.status] || STATUS.disponivel;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs transition ${
        selected ? 'bg-lime/15 text-white font-semibold' : 'text-neutral-300 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
        <span className="truncate">{lot.name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 tabular text-[11px] text-mute">
        {lot.area ? <span>{lot.area}m²</span> : null}
        {lot.price ? <span className="text-neutral-300">{formatBRL(lot.price)}</span> : null}
      </div>
    </button>
  );
}

function StatusChip({ active, onClick, label, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
        active ? 'bg-white/15 text-white' : 'text-mute hover:text-neutral-200'
      }`}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

/* ----------------------------------------------------- Inspector de Lotes / Quadra */
function LotsInspector({
  lots,
  block,
  scenes,
  activeSceneId,
  adjustingBlockId,
  onUpdateLots,
  onDeleteLots,
  onUpdateBlock,
  onDeleteBlock,
  onToggleAdjust,
  onCloneBlock,
}) {
  const isMulti = lots.length > 1;
  const first = lots[0];
  const otherScenes = scenes.filter((s) => s.id !== activeSceneId);
  const [cloneTarget, setCloneTarget] = useState(otherScenes[0]?.id || '');

  const sharedVal = (key) => {
    const v = first[key];
    return lots.every((l) => l[key] === v) ? (v ?? '') : '';
  };

  return (
    <div className="space-y-3">
      {/* Cabeçalho da seleção */}
      <div className="flex items-center justify-between">
        <div>
          <div className="label-xs text-lime">
            {isMulti ? `${lots.length} Lotes Selecionados (Massa)` : 'Propriedades do Lote'}
          </div>
          <div className="text-xs font-bold text-white truncate">
            {isMulti ? (block ? block.name : 'Seleção Múltipla') : first.name}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateLots({ showLabel: first.showLabel === false })}
            title="Mostrar/ocultar número do lote no centro do polígono 360°"
            className="icon-btn !w-7 !h-7"
          >
            {first.showLabel === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-lime" />}
          </button>
          <button
            type="button"
            onClick={onDeleteLots}
            title="Excluir lote(s) selecionado(s)"
            className="icon-btn !w-7 !h-7 hover:!text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Controles da Quadra quando aplicável */}
      {block && (
        <div className="rounded-lg p-2.5 bg-ink-850 border border-white/[0.07] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-200">{block.name}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleAdjust}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                  adjustingBlockId === block.id ? 'bg-lime text-ink-950' : 'bg-white/10 text-white'
                }`}
              >
                <Move className="w-3 h-3" />
                {adjustingBlockId === block.id ? 'Concluir Pinos' : 'Reajustar Quadra'}
              </button>
              <button
                type="button"
                onClick={onDeleteBlock}
                title="Excluir quadra inteira"
                className="icon-btn !w-6 !h-6 hover:!text-red-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="label-xs block">Colunas</label>
              <input
                type="number"
                min={1}
                max={40}
                className="field !py-1 !text-xs tabular"
                value={block.cols}
                onChange={(e) =>
                  onUpdateBlock({ cols: Math.max(1, Math.min(40, +e.target.value || 1)) })
                }
              />
            </div>
            <div>
              <label className="label-xs block">Fileiras</label>
              <input
                type="number"
                min={1}
                max={10}
                className="field !py-1 !text-xs tabular"
                value={block.rows}
                onChange={(e) =>
                  onUpdateBlock({ rows: Math.max(1, Math.min(10, +e.target.value || 1)) })
                }
              />
            </div>
            <div>
              <label className="label-xs block">Projeção</label>
              <select
                className="field !py-1 !text-xs"
                value={block.method || 'perspective'}
                onChange={(e) => onUpdateBlock({ method: e.target.value })}
              >
                <option value="perspective">Perspectiva</option>
                <option value="bilinear">Bilinear</option>
              </select>
            </div>
          </div>

          {otherScenes.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <select
                className="field !py-1 !text-xs flex-1"
                value={cloneTarget || otherScenes[0]?.id}
                onChange={(e) => setCloneTarget(e.target.value)}
              >
                {otherScenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    Clonar p/ {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onCloneBlock(cloneTarget || otherScenes[0]?.id)}
                className="btn-outline !py-1 !px-2 text-xs shrink-0"
              >
                <Copy className="w-3 h-3" />
                Clonar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status SVG dinâmico (Disponível / Reservado / Vendido) */}
      <div>
        <label className="label-xs block mb-1">Status de Disponibilidade</label>
        <div className="grid grid-cols-3 gap-1.5">
          {STATUS_LIST.map((st) => {
            const active = lots.every((l) => l.status === st.key);
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => onUpdateLots({ status: st.key })}
                style={{
                  borderColor: active ? st.color : 'rgba(255,255,255,0.08)',
                  backgroundColor: active ? `${st.color}28` : 'transparent',
                  color: active ? '#fff' : '#b9b9b9',
                }}
                className="py-1.5 px-2 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Identificador individual */}
      {!isMulti && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="label-xs block mb-1">Identificador</label>
            <input
              className="field !py-1 !text-xs"
              value={first.name}
              onChange={(e) => onUpdateLots({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="label-xs block mb-1">Nº Lote</label>
            <input
              type="number"
              className="field !py-1 !text-xs tabular"
              value={first.number ?? 1}
              onChange={(e) => onUpdateLots({ number: parseInt(e.target.value, 10) || 1 })}
            />
          </div>
        </div>
      )}

      {/* Área + Valor */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-xs block mb-1">Área Total (m²)</label>
          <input
            type="number"
            step="0.01"
            placeholder={isMulti ? 'Manter individuais' : '250'}
            className="field !py-1 !text-xs tabular"
            value={sharedVal('area')}
            onChange={(e) => onUpdateLots({ area: parseNum(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-xs block mb-1">Valor (R$)</label>
          <input
            type="number"
            step="100"
            placeholder={isMulti ? 'Manter individuais' : '129900'}
            className="field !py-1 !text-xs tabular"
            value={sharedVal('price')}
            onChange={(e) => onUpdateLots({ price: parseNum(e.target.value) })}
          />
        </div>
      </div>

      {/* Frente, Fundo, Laterais */}
      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="label-xs block mb-1">Frente</label>
          <input
            type="number"
            step="0.1"
            className="field !py-1 !text-xs tabular"
            value={sharedVal('front')}
            onChange={(e) => onUpdateLots({ front: parseNum(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-xs block mb-1">Fundo</label>
          <input
            type="number"
            step="0.1"
            className="field !py-1 !text-xs tabular"
            value={sharedVal('back')}
            onChange={(e) => onUpdateLots({ back: parseNum(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-xs block mb-1">Lat. E</label>
          <input
            type="number"
            step="0.1"
            className="field !py-1 !text-xs tabular"
            value={sharedVal('sideLeft')}
            onChange={(e) => onUpdateLots({ sideLeft: parseNum(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-xs block mb-1">Lat. D</label>
          <input
            type="number"
            step="0.1"
            className="field !py-1 !text-xs tabular"
            value={sharedVal('sideRight')}
            onChange={(e) => onUpdateLots({ sideRight: parseNum(e.target.value) })}
          />
        </div>
      </div>

      {/* Condições & Observações */}
      <div>
        <label className="label-xs block mb-1">Condições de Pagamento</label>
        <input
          className="field !py-1 !text-xs"
          placeholder="Ex: Entrada 10% + 120x"
          value={sharedVal('conditions')}
          onChange={(e) => onUpdateLots({ conditions: e.target.value })}
        />
      </div>
      <div>
        <label className="label-xs block mb-1">Observações</label>
        <textarea
          rows={2}
          className="field !py-1 !text-xs"
          placeholder="Topografia, esquina, sol da manhã..."
          value={sharedVal('notes')}
          onChange={(e) => onUpdateLots({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------- Inspector de Hotspot */
function HotspotInspector({ hotspot, scenes, onChange, onDelete }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-xs text-lime">Hotspot de Transição</div>
          <div className="text-xs font-bold text-white">{hotspot.label}</div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="icon-btn !w-7 !h-7 hover:!text-red-400"
          title="Excluir hotspot"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div>
        <label className="label-xs block mb-1">Texto da Etiqueta</label>
        <input
          className="field !py-1 !text-xs"
          value={hotspot.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-xs block mb-1">Cena de Destino</label>
          <select
            className="field !py-1 !text-xs"
            value={hotspot.targetSceneId}
            onChange={(e) => onChange({ targetSceneId: e.target.value })}
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-xs block mb-1">Estilo Visual</label>
          <select
            className="field !py-1 !text-xs"
            value={hotspot.style || 'ground'}
            onChange={(e) => onChange({ style: e.target.value })}
          >
            <option value="ground">Seta no Chão</option>
            <option value="float">Ícone no Ar</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- Aba de Configurações do Player e Marca */
function SettingsTab({
  project,
  imageUrls,
  activeScene,
  updateSettings,
  updateAction,
  updateBranding,
  setCompanyLogoFile,
  removeCompanyLogo,
  updateScene,
}) {
  const logoInputRef = useState(null);
  const settings = project.settings || {};
  const branding = settings.branding || {};
  const action = settings.action || {};
  const logoUrl = branding.logoImageId ? imageUrls[branding.logoImageId] : null;

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
      {/* -------------------- 1. LOGO DA EMPRESA -------------------- */}
      <div className="rounded-xl p-3.5 bg-ink-900/80 border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="label-xs text-lime flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Logo da Empresa / Construtora
          </div>
          <label className="text-[11px] text-soft flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={branding.enabled !== false}
              onChange={(e) => updateBranding({ enabled: e.target.checked })}
              className="accent-[#a3e635] w-3.5 h-3.5"
            />
            Ativar
          </label>
        </div>

        {/* Upload / Preview do Logo */}
        <div className="flex items-center gap-3">
          <div className="relative w-20 h-14 rounded-lg bg-ink-950 border border-white/10 flex items-center justify-center overflow-hidden p-1">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo da Empresa"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center text-[10px] text-mute flex flex-col items-center">
                <ImageIcon className="w-4 h-4 mb-0.5 text-mute" />
                Sem logo
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1.5">
            <label className="btn-primary !py-1 !px-2.5 text-xs cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              {logoUrl ? 'Trocar Logo' : 'Enviar Logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setCompanyLogoFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            {logoUrl && (
              <button
                type="button"
                onClick={removeCompanyLogo}
                className="btn-danger !py-1 !px-2 text-xs ml-1.5 inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Remover
              </button>
            )}
            <p className="text-[10px] text-mute leading-tight">
              Formatos recomendados: PNG transparente ou SVG
            </p>
          </div>
        </div>

        {/* Nome da Empresa */}
        <div>
          <label className="label-xs block mb-1">Nome da Empresa</label>
          <input
            className="field"
            value={settings.companyName || ''}
            onChange={(e) => updateSettings({ companyName: e.target.value })}
            placeholder="Ex: Lote360 Empreendimentos"
          />
        </div>

        {/* Posição e Altura do Logo na Tela */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-xs block mb-1">Posição do Logo</label>
            <select
              className="field !py-1 !text-xs"
              value={branding.position || 'top-left'}
              onChange={(e) => updateBranding({ position: e.target.value })}
            >
              <option value="top-left">Superior Esquerdo</option>
              <option value="top-right">Superior Direito</option>
              <option value="bottom-left">Inferior Esquerdo</option>
            </select>
          </div>
          <div>
            <label className="label-xs block mb-1">
              Altura do Logo: <strong className="text-white">{branding.height || 38}px</strong>
            </label>
            <input
              type="range"
              min="24"
              max="72"
              value={branding.height || 38}
              onChange={(e) => updateBranding({ height: +e.target.value })}
              className="w-full accent-[#a3e635] mt-1"
            />
          </div>
        </div>

        {/* Link do Logo */}
        <div>
          <label className="label-xs block mb-1 flex items-center gap-1">
            <LinkIcon className="w-3 h-3" />
            Link ao Clicar no Logo (Opcional)
          </label>
          <input
            className="field !py-1 !text-xs"
            value={branding.companyUrl || ''}
            onChange={(e) => updateBranding({ companyUrl: e.target.value })}
            placeholder="https://suaimobiliaria.com.br"
          />
        </div>
      </div>

      {/* -------------------- 2. NOME NA IMAGEM 360° -------------------- */}
      <div className="rounded-xl p-3.5 bg-ink-900/80 border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="label-xs text-lime flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" />
            Nome e Identificação na Imagem 360°
          </div>
          <label className="text-[11px] text-soft flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={branding.showSceneTitleOnPano !== false}
              onChange={(e) => updateBranding({ showSceneTitleOnPano: e.target.checked })}
              className="accent-[#a3e635] w-3.5 h-3.5"
            />
            Exibir na Foto
          </label>
        </div>

        <div>
          <label className="label-xs block mb-1">Posição do Nome na Imagem</label>
          <select
            className="field !py-1 !text-xs"
            value={branding.sceneTitlePosition || 'top-center'}
            onChange={(e) => updateBranding({ sceneTitlePosition: e.target.value })}
          >
            <option value="top-center">Topo Centro (Padrão)</option>
            <option value="top-left">Topo Esquerda</option>
            <option value="bottom-center">Base Centro</option>
            <option value="bottom-left">Base Esquerda</option>
          </select>
        </div>

        {/* Edição do Nome e Subtítulo da Foto Ativa */}
        {activeScene && (
          <div className="rounded-lg p-2.5 bg-ink-950 border border-white/[0.06] space-y-2">
            <div className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-lime" />
              Foto Atual: <span className="text-white">{activeScene.name}</span>
            </div>
            <div>
              <label className="label-xs block mb-1">Nome desta Foto 360°</label>
              <input
                className="field !py-1 !text-xs"
                value={activeScene.name || ''}
                onChange={(e) => updateScene(activeScene.id, { name: e.target.value })}
                placeholder="Ex: Drone 01 — Portaria"
              />
            </div>
            <div>
              <label className="label-xs block mb-1">Subtítulo / Descrição na Imagem</label>
              <input
                className="field !py-1 !text-xs"
                value={activeScene.subtitle || ''}
                onChange={(e) => updateScene(activeScene.id, { subtitle: e.target.value })}
                placeholder="Ex: Altitude 95m • Vista Aérea Norte"
              />
            </div>
          </div>
        )}

        {/* Marca d'Água Textual */}
        <div>
          <label className="label-xs block mb-1">Texto de Marca d'Água (Opcional)</label>
          <input
            className="field !py-1 !text-xs"
            value={branding.watermarkText || ''}
            onChange={(e) => updateBranding({ watermarkText: e.target.value })}
            placeholder="Ex: © Lote360 • Imagens Ilustrativas"
          />
        </div>
      </div>

      {/* -------------------- 3. INFORMAÇÕES GERAIS -------------------- */}
      <div>
        <label className="label-xs block mb-1">Nome do Empreendimento</label>
        <input
          className="field"
          value={settings.developmentName || ''}
          onChange={(e) => updateSettings({ developmentName: e.target.value })}
          placeholder="Ex: Residencial Vista Verde"
        />
      </div>

      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-ink-900/80 border border-white/[0.06]">
        <span className="text-xs text-neutral-200">Exibir numeração dos lotes em 360°</span>
        <input
          type="checkbox"
          checked={settings.showLabels !== false}
          onChange={(e) => updateSettings({ showLabels: e.target.checked })}
          className="accent-[#a3e635] w-4 h-4"
        />
      </div>

      {/* -------------------- 4. BOTÃO DE AÇÃO / CTA -------------------- */}
      <div className="rounded-xl p-3.5 bg-ink-900/80 border border-white/[0.06] space-y-3">
        <div className="label-xs text-lime">Botão de Ação no Tablet / Player</div>
        <div>
          <label className="label-xs block mb-1">Tipo de Ação Principal</label>
          <select
            className="field"
            value={action.type || 'whatsapp'}
            onChange={(e) => updateAction({ type: e.target.value })}
          >
            <option value="whatsapp">Enviar mensagem no WhatsApp</option>
            <option value="proposal">Abrir Formulário de Proposta Offline (.json)</option>
            <option value="link">Abrir Link Externo / CRM</option>
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1">Texto do Botão</label>
          <input
            className="field"
            value={action.label || ''}
            onChange={(e) => updateAction({ label: e.target.value })}
            placeholder="Reservar / Falar no WhatsApp"
          />
        </div>

        {action.type === 'whatsapp' && (
          <>
            <div>
              <label className="label-xs block mb-1">WhatsApp (DDI + DDD + Número)</label>
              <input
                className="field tabular"
                value={action.phone || ''}
                onChange={(e) => updateAction({ phone: e.target.value })}
                placeholder="5511999999999"
              />
            </div>
            <div>
              <label className="label-xs block mb-1">
                Mensagem ({'{lote}'}, {'{quadra}'}, {'{preco}'}, {'{empreendimento}'})
              </label>
              <textarea
                rows={3}
                className="field text-xs"
                value={action.message || ''}
                onChange={(e) => updateAction({ message: e.target.value })}
              />
            </div>
          </>
        )}

        {action.type === 'link' && (
          <div>
            <label className="label-xs block mb-1">URL de Destino</label>
            <input
              className="field"
              value={action.url || ''}
              onChange={(e) => updateAction({ url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
