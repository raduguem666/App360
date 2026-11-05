/**
 * Mini-Mapa Masterplan 2D retrátil no canto da tela.
 * - Exibe a ortofoto/planta baixa do loteamento
 * - Pinos de cada cena 360°, destacando a câmera ativa + cone de direção (yaw)
 * - No editor com ferramenta 'mappin', clicar posiciona o pino da cena ativa
 */
import { useState, useRef } from 'react';
import { Map as MapIcon, ChevronDown, ChevronUp, Upload, Trash2, Compass } from 'lucide-react';

export default function MasterplanWidget({
  masterplanUrl,
  scenes = [],
  activeSceneId,
  viewYaw = 0,
  editable = false,
  placingPin = false,
  onSelectScene,
  onPlacePin,
  onUploadMasterplan,
  onRemoveMasterplan,
  onTogglePlacePin,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef(null);
  const mapRef = useRef(null);

  if (!masterplanUrl && !editable) return null;

  const handleMapClick = (e) => {
    if (!editable || !placingPin || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height));
    onPlacePin?.({ x: +x.toFixed(4), y: +y.toFixed(4) });
  };

  return (
    <div
      className={`glass rounded-xl overflow-hidden transition-all duration-200 select-none ${
        collapsed ? 'w-52' : expanded ? 'w-[420px]' : 'w-72'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-ink-900/60">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-xs font-semibold text-neutral-200 hover:text-white"
        >
          <MapIcon className="w-3.5 h-3.5 text-lime" />
          <span>Masterplan 2D</span>
          {collapsed ? <ChevronUp className="w-3.5 h-3.5 text-mute" /> : <ChevronDown className="w-3.5 h-3.5 text-mute" />}
        </button>
        <div className="flex items-center gap-1">
          {!collapsed && masterplanUrl && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Reduzir mapa' : 'Expandir mapa'}
              className="text-[11px] px-1.5 py-0.5 rounded text-soft hover:text-white hover:bg-white/[0.06]"
            >
              {expanded ? '1x' : '2x'}
            </button>
          )}
          {editable && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadMasterplan?.(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Enviar imagem do Masterplan 2D"
                className="icon-btn !w-6 !h-6"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              {masterplanUrl && (
                <>
                  <button
                    type="button"
                    onClick={onTogglePlacePin}
                    title="Posicionar pino da câmera ativa no mapa"
                    className={`icon-btn !w-6 !h-6 ${placingPin ? '!bg-lime !text-ink-900' : ''}`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveMasterplan}
                    title="Remover Masterplan"
                    className="icon-btn !w-6 !h-6 hover:!text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-2">
          {masterplanUrl ? (
            <div
              ref={mapRef}
              onClick={handleMapClick}
              className={`relative rounded-lg overflow-hidden border border-white/[0.07] bg-ink-950 ${
                placingPin ? 'cursor-crosshair ring-2 ring-lime' : ''
              }`}
            >
              <img src={masterplanUrl} alt="Masterplan 2D" className="w-full h-auto block pointer-events-none" />

              {placingPin && (
                <div className="absolute inset-x-2 top-2 rounded bg-ink-950/85 px-2 py-1 text-[11px] text-lime text-center border border-lime/40">
                  Clique no mapa para posicionar o pino da cena ativa
                </div>
              )}

              {scenes
                .filter((s) => s.mapPos)
                .map((s) => {
                  const isActive = s.id === activeSceneId;
                  const deg = ((viewYaw + (s.mapHeading || 0)) * 180) / Math.PI;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      title={s.name}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectScene?.(s.id);
                      }}
                      style={{ left: `${s.mapPos.x * 100}%`, top: `${s.mapPos.y * 100}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                    >
                      {isActive && (
                        <svg
                          viewBox="-30 -30 60 60"
                          className="w-14 h-14 -m-5 pointer-events-none transition-transform duration-75"
                          style={{ transform: `rotate(${deg}deg)` }}
                        >
                          <path d="M 0 0 L -16 -26 A 28 28 0 0 1 16 -26 Z" fill="rgba(163,230,53,0.32)" stroke="#a3e635" strokeWidth="1" />
                        </svg>
                      )}
                      <span
                        className={`relative flex items-center justify-center w-4 h-4 rounded-full border-2 transition-transform group-hover:scale-125 ${
                          isActive
                            ? 'bg-lime border-ink-950 shadow-[0_0_0_4px_rgba(163,230,53,0.35)]'
                            : 'bg-ink-900 border-white/80 hover:border-lime'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-ink-950' : 'bg-white'}`} />
                      </span>
                      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap rounded bg-ink-950/90 px-1.5 py-0.5 text-[10px] font-medium text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        {s.name}
                      </span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full py-5 px-3 rounded-lg border border-dashed border-ink-600 hover:border-lime/60 text-center text-xs text-mute hover:text-neutral-200 transition"
            >
              <Upload className="w-4 h-4 mx-auto mb-1 text-lime" />
              Enviar planta baixa / ortofoto 2D
            </button>
          )}
        </div>
      )}
    </div>
  );
}
