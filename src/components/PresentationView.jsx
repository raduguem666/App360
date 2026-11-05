/**
 * Módulo 2: Modo Apresentação (Player do Cliente / Tablet).
 * Reutilizado tanto dentro do Studio (botão "Modo Apresentação") quanto no
 * bundle standalone embutido dentro do HTML offline (`tour-offline.html`).
 */
import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Maximize2,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Layers,
  MessageCircle,
  Download,
  ExternalLink,
  X,
  Compass,
  Sparkles,
} from 'lucide-react';
import Viewer360 from './Viewer360.jsx';
import MasterplanWidget from './MasterplanWidget.jsx';
import PanoOverlayBranding from './PanoOverlayBranding.jsx';
import {
  STATUS,
  STATUS_LIST,
  statusCounts,
  formatBRL,
  formatArea,
  formatMeters,
  fillTemplate,
  pad,
} from '../lib/model.js';
import { lotMarkers, hotspotMarkers, lotCentroid } from '../lib/markers.js';

export default function PresentationView({ project, imageUrls, onExitEditor = null }) {
  const viewerRef = useRef(null);
  const [activeSceneId, setActiveSceneId] = useState(
    () => project.startSceneId || project.scenes[0]?.id || null,
  );
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'disponivel' | 'reservado' | 'vendido'
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [viewYaw, setViewYaw] = useState(0);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalClient, setProposalClient] = useState({ name: '', phone: '', email: '', notes: '' });
  const [proposalSaved, setProposalSaved] = useState(false);

  const activeScene = useMemo(
    () => project.scenes.find((s) => s.id === activeSceneId) || project.scenes[0] || null,
    [project.scenes, activeSceneId],
  );

  const scenesById = useMemo(
    () => Object.fromEntries(project.scenes.map((s) => [s.id, s])),
    [project.scenes],
  );

  const blocksById = useMemo(
    () => Object.fromEntries(project.blocks.map((b) => [b.id, b])),
    [project.blocks],
  );

  const sceneLots = useMemo(
    () => project.lots.filter((l) => l.sceneId === activeScene?.id),
    [project.lots, activeScene?.id],
  );

  const counts = useMemo(() => statusCounts(sceneLots), [sceneLots]);

  const selectedLot = useMemo(
    () => project.lots.find((l) => l.id === selectedLotId) || null,
    [project.lots, selectedLotId],
  );

  const selectedBlock = selectedLot?.blockId ? blocksById[selectedLot.blockId] : null;

  const markers = useMemo(() => {
    if (!activeScene) return [];
    const sel = selectedLotId ? new Set([selectedLotId]) : new Set();
    const dimmed = statusFilter === 'all' ? null : (lot) => lot.status !== statusFilter;
    const lotsM = lotMarkers(sceneLots, {
      selected: sel,
      dimmed,
      showLabels: project.settings?.showLabels !== false,
      presentation: true,
      priceFmt: formatBRL,
    });
    const hsM = hotspotMarkers(
      project.hotspots.filter((h) => h.sceneId === activeScene.id),
      { scenesById },
    );
    return [...lotsM, ...hsM];
  }, [activeScene, sceneLots, project.hotspots, project.settings?.showLabels, selectedLotId, statusFilter, scenesById]);

  const handleSphereClick = (_pos, marker) => {
    const data = marker?.config?.data || marker?.data;
    if (!data) {
      setSelectedLotId(null);
      return;
    }
    if (data.type === 'lot' || data.type === 'label') {
      const lot = project.lots.find((l) => l.id === data.id);
      if (lot && (statusFilter === 'all' || lot.status === statusFilter)) {
        setSelectedLotId(lot.id);
        setProposalOpen(false);
        setProposalSaved(false);
      }
    } else if (data.type === 'hotspot') {
      const hs = project.hotspots.find((h) => h.id === data.id);
      if (hs?.targetSceneId) {
        setSelectedLotId(null);
        setActiveSceneId(hs.targetSceneId);
      }
    }
  };

  const focusLot = (lot) => {
    setSelectedLotId(lot.id);
    if (lot.sceneId !== activeScene?.id) {
      setActiveSceneId(lot.sceneId);
    } else {
      const c = lotCentroid(lot);
      viewerRef.current?.animateTo(c);
    }
  };

  const handlePrimaryAction = () => {
    if (!selectedLot) return;
    const act = project.settings?.action || {};
    if (act.type === 'proposal') {
      setProposalOpen(true);
      return;
    }
    if (act.type === 'link' && act.url) {
      window.open(act.url, '_blank', 'noopener,noreferrer');
      return;
    }
    // WhatsApp (default)
    const phone = String(act.phone || '').replace(/\D/g, '');
    const text = fillTemplate(
      act.message || 'Olá! Tenho interesse no {lote} ({quadra}) do {empreendimento}, valor {preco}.',
      selectedLot,
      selectedBlock,
      project.settings,
    );
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveOfflineProposal = (e) => {
    e.preventDefault();
    if (!selectedLot) return;
    const payload = {
      geradoEm: new Date().toISOString(),
      empreendimento: project.settings?.developmentName || project.name,
      quadra: selectedBlock?.name || 'Avulso',
      lote: selectedLot.name,
      numero: pad(selectedLot.number),
      status: STATUS[selectedLot.status]?.label || selectedLot.status,
      areaM2: selectedLot.area,
      dimensoes: {
        frente: selectedLot.front,
        fundo: selectedLot.back,
        lateralEsquerda: selectedLot.sideLeft,
        lateralDireita: selectedLot.sideRight,
      },
      valorBRL: formatBRL(selectedLot.price),
      condicoes: selectedLot.conditions,
      observacoesLote: selectedLot.notes,
      cliente: proposalClient,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `proposta-${selectedLot.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setProposalSaved(true);
  };

  const panoramaUrl = activeScene ? imageUrls[activeScene.imageId] : null;
  const masterplanUrl = project.masterplan?.imageId ? imageUrls[project.masterplan.imageId] : null;

  return (
    <div className="relative w-full h-full bg-ink-950 overflow-hidden select-none">
      {/* Viewer 360° */}
      {activeScene && panoramaUrl ? (
        <Viewer360
          ref={viewerRef}
          panoramaUrl={panoramaUrl}
          sceneKey={activeScene.id}
          initialView={activeScene.initialView}
          markers={markers}
          onSphereClick={handleSphereClick}
          onViewChange={(pos) => setViewYaw(pos.yaw)}
        />
      ) : (
        <div className="grid place-items-center h-full text-mute text-sm">Nenhuma cena 360° disponível.</div>
      )}

      {/* Logo da Empresa e Identificação da Foto 360° no Player */}
      <PanoOverlayBranding
        project={project}
        imageUrls={imageUrls}
        activeScene={activeScene}
        editable={false}
      />

      {/* Barra Superior: Identidade + Filtros rápidos de Status */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="pointer-events-auto flex items-center gap-2.5 glass rounded-xl px-3.5 py-2">
          {onExitEditor && (
            <button
              type="button"
              onClick={onExitEditor}
              className="btn-outline !py-1 !px-2.5 text-xs mr-1"
              title="Voltar ao Modo Editor"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Editor
            </button>
          )}
          <div className="w-2.5 h-2.5 rounded-full bg-lime shadow-[0_0_10px_#a3e635]" />
          <div>
            <div className="text-xs font-bold text-white leading-tight">
              {project.settings?.developmentName || project.name}
            </div>
            <div className="text-[11px] text-mute leading-tight flex items-center gap-1">
              <MapPin className="w-3 h-3 text-lime" />
              {activeScene?.name || 'Vista 360°'}
            </div>
          </div>
        </div>

        {/* Filtro Rápido: Todos / Disponíveis / Reservados / Vendidos */}
        <div className="pointer-events-auto flex items-center gap-1.5 glass rounded-xl p-1.5">
          <FilterPill
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label="Todos"
            count={counts.total}
            dotColor="#a3e635"
          />
          {STATUS_LIST.map((st) => (
            <FilterPill
              key={st.key}
              active={statusFilter === st.key}
              onClick={() => setStatusFilter(st.key)}
              label={st.plural}
              count={counts[st.key] || 0}
              dotColor={st.color}
            />
          ))}
        </div>

        {/* Controles de zoom / tela cheia */}
        <div className="pointer-events-auto flex items-center gap-1 glass rounded-xl p-1.5">
          <button
            type="button"
            onClick={() => viewerRef.current?.zoomIn()}
            className="icon-btn"
            title="Aproximar (Zoom +)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => viewerRef.current?.zoomOut()}
            className="icon-btn"
            title="Afastar (Zoom -)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => viewerRef.current?.toggleFullscreen()}
            className="icon-btn"
            title="Tela cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Seletor de Cenas (rodapé esquerdo) */}
      {project.scenes.length > 1 && (
        <div className="pointer-events-auto absolute left-4 bottom-4 z-20 flex items-center gap-1.5 glass rounded-xl p-1.5 max-w-[60vw] overflow-x-auto">
          <Compass className="w-4 h-4 text-lime ml-1.5 mr-0.5 shrink-0" />
          {project.scenes.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => {
                setSelectedLotId(null);
                setActiveSceneId(sc.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                sc.id === activeScene?.id
                  ? 'bg-lime text-ink-950 font-semibold shadow'
                  : 'text-soft hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {sc.name}
            </button>
          ))}
        </div>
      )}

      {/* Masterplan 2D retrátil (canto inferior direito) */}
      {masterplanUrl && (
        <div className="pointer-events-auto absolute right-4 bottom-4 z-20">
          <MasterplanWidget
            masterplanUrl={masterplanUrl}
            scenes={project.scenes}
            activeSceneId={activeScene?.id}
            viewYaw={viewYaw}
            editable={false}
            onSelectScene={(id) => {
              setSelectedLotId(null);
              setActiveSceneId(id);
            }}
          />
        </div>
      )}

      {/* Drawer Lateral de Detalhes do Lote */}
      {selectedLot && (
        <aside className="pointer-events-auto absolute top-0 right-0 bottom-0 z-30 w-full max-w-md glass border-l border-white/10 flex flex-col animate-[var(--animate-slide-in)]">
          {/* Topo do Drawer */}
          <div className="flex items-start justify-between gap-3 p-5 border-b border-white/[0.07]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={selectedLot.status} />
                {selectedBlock && (
                  <span className="text-xs font-medium text-mute px-2 py-0.5 rounded bg-white/[0.05]">
                    {selectedBlock.name}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">{selectedLot.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLotId(null)}
              className="icon-btn"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo rolável */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Preço de Destaque */}
            <div className="rounded-xl p-4 bg-ink-900/90 border border-white/[0.07]">
              <div className="label-xs mb-1">Valor do Investimento</div>
              <div className="text-2xl font-extrabold text-lime tabular">
                {formatBRL(selectedLot.price)}
              </div>
              {selectedLot.conditions && (
                <div className="text-xs text-soft mt-1.5">{selectedLot.conditions}</div>
              )}
            </div>

            {/* Tabela de Medidas */}
            <div>
              <div className="label-xs mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-lime" />
                Dimensões e confrontações
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <MetricCard label="Área Total" value={formatArea(selectedLot.area)} highlight />
                <MetricCard label="Frente" value={formatMeters(selectedLot.front)} />
                <MetricCard label="Fundo" value={formatMeters(selectedLot.back)} />
                <MetricCard
                  label="Laterais (E / D)"
                  value={`${formatMeters(selectedLot.sideLeft)} / ${formatMeters(selectedLot.sideRight)}`}
                />
              </div>
            </div>

            {/* Observações */}
            {selectedLot.notes && (
              <div className="rounded-xl p-3.5 bg-ink-900/60 border border-white/[0.06]">
                <div className="label-xs mb-1">Observações</div>
                <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line">
                  {selectedLot.notes}
                </p>
              </div>
            )}

            {/* Formulário de Proposta Offline */}
            {proposalOpen && (
              <form
                onSubmit={handleSaveOfflineProposal}
                className="rounded-xl p-4 bg-ink-900/95 border border-lime/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-lime uppercase tracking-wider">
                    Proposta / Reserva Offline
                  </span>
                  <button
                    type="button"
                    onClick={() => setProposalOpen(false)}
                    className="text-xs text-mute hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
                <input
                  required
                  placeholder="Nome completo do cliente"
                  className="field"
                  value={proposalClient.name}
                  onChange={(e) => setProposalClient((c) => ({ ...c, name: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    placeholder="Telefone / WhatsApp"
                    className="field"
                    value={proposalClient.phone}
                    onChange={(e) => setProposalClient((c) => ({ ...c, phone: e.target.value }))}
                  />
                  <input
                    placeholder="E-mail (opcional)"
                    className="field"
                    value={proposalClient.email}
                    onChange={(e) => setProposalClient((c) => ({ ...c, email: e.target.value }))}
                  />
                </div>
                <textarea
                  rows={2}
                  placeholder="Condição / observações da proposta..."
                  className="field"
                  value={proposalClient.notes}
                  onChange={(e) => setProposalClient((c) => ({ ...c, notes: e.target.value }))}
                />
                <button type="submit" className="btn-primary w-full py-2">
                  <Download className="w-4 h-4" />
                  Baixar Proposta (.json)
                </button>
                {proposalSaved && (
                  <p className="text-xs text-ok text-center">
                    Proposta salva no dispositivo para envio posterior!
                  </p>
                )}
              </form>
            )}

            {/* Navegação rápida entre lotes da mesma quadra */}
            {selectedBlock && (
              <div>
                <div className="label-xs mb-2">Outros lotes em {selectedBlock.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {sceneLots
                    .filter((l) => l.blockId === selectedBlock.id)
                    .sort((a, b) => a.number - b.number)
                    .map((l) => {
                      const st = STATUS[l.status] || STATUS.disponivel;
                      const isCur = l.id === selectedLot.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => focusLot(l)}
                          style={{ borderColor: isCur ? '#a3e635' : st.color }}
                          className={`px-2 py-1 rounded text-xs font-semibold tabular border transition ${
                            isCur
                              ? 'bg-lime text-ink-950'
                              : 'bg-ink-900/80 text-neutral-200 hover:bg-ink-750'
                          }`}
                        >
                          {pad(l.number)}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Rodapé com Ações */}
          <div className="p-4 border-t border-white/[0.07] bg-ink-900/90 space-y-2">
            {selectedLot.status !== 'vendido' ? (
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="btn-primary w-full py-2.5 text-sm font-bold"
                >
                  {project.settings?.action?.type === 'proposal' ? (
                    <Download className="w-4 h-4" />
                  ) : project.settings?.action?.type === 'link' ? (
                    <ExternalLink className="w-4 h-4" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                  {project.settings?.action?.label || 'Reservar / Falar no WhatsApp'}
                </button>
                {project.settings?.action?.type !== 'proposal' && !proposalOpen && (
                  <button
                    type="button"
                    onClick={() => setProposalOpen(true)}
                    className="btn-outline w-full py-2 text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-lime" />
                    Salvar Proposta Offline no Tablet
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-red-300 bg-bad/10 rounded-lg border border-bad/30">
                Este lote já foi comercializado. Selecione outro lote verde no panorama.
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label, count, dotColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition tabular ${
        active
          ? 'bg-white/15 text-white shadow-inner'
          : 'text-soft hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
      <span>{label}</span>
      <span className="px-1.5 py-0.2 rounded bg-black/40 text-[11px] text-neutral-300">{count}</span>
    </button>
  );
}

function StatusBadge({ status }) {
  const st = STATUS[status] || STATUS.disponivel;
  const Icon = status === 'disponivel' ? CheckCircle2 : status === 'reservado' ? Clock : XCircle;
  return (
    <span
      style={{
        backgroundColor: `${st.color}22`,
        borderColor: `${st.color}66`,
        color: st.color,
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border"
    >
      <Icon className="w-3.5 h-3.5" />
      {st.label}
    </span>
  );
}

function MetricCard({ label, value, highlight = false }) {
  return (
    <div className="rounded-lg p-3 bg-ink-900/70 border border-white/[0.06]">
      <div className="text-[11px] text-mute">{label}</div>
      <div className={`text-sm font-bold mt-0.5 tabular ${highlight ? 'text-white' : 'text-neutral-200'}`}>
        {value}
      </div>
    </div>
  );
}
