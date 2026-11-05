/**
 * Painel Esquerdo: Gestão de Panoramas 360° (Múltiplas Cenas) + Masterplan 2D.
 * - Upload de fotos equiretangulares 4K/8K (salvas como Blob no IndexedDB)
 * - Definir cena inicial do tour, capturar ângulo inicial, reordenar ou excluir
 * - Gerador procedural embutido para testar novas cenas 360°
 */
import { useRef, useState } from 'react';
import {
  Camera,
  Plus,
  Star,
  Trash2,
  Crosshair,
  ChevronUp,
  ChevronDown,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { renderPanorama, DEMO_CAMERAS, worldToMap } from '../lib/demo.js';
import { putImage } from '../lib/db.js';
import { uid } from '../lib/model.js';

export default function ScenesPanel({ onCaptureInitialView }) {
  const fileRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const scenes = useStore((s) => s.project.scenes);
  const startSceneId = useStore((s) => s.project.startSceneId);
  const lots = useStore((s) => s.project.lots);
  const hotspots = useStore((s) => s.project.hotspots);
  const imageUrls = useStore((s) => s.imageUrls);
  const activeSceneId = useStore((s) => s.activeSceneId);

  const setActiveScene = useStore((s) => s.setActiveScene);
  const addSceneFiles = useStore((s) => s.addSceneFiles);
  const updateScene = useStore((s) => s.updateScene);
  const removeScene = useStore((s) => s.removeScene);
  const moveScene = useStore((s) => s.moveScene);
  const commit = useStore((s) => s.commit);
  const showToast = useStore((s) => s.showToast);

  const setAsStart = (id) => {
    commit((p) => ({ ...p, startSceneId: id }));
    showToast('Cena inicial do tour atualizada.', 'ok');
  };

  const handleGenerateExtraDemoScene = async () => {
    setGenerating(true);
    try {
      const idx = scenes.length + 1;
      const cam = {
        name: `Drone 0${idx} — Vista Sul`,
        x: 112,
        z: -62,
        h: 85,
      };
      const blob = await renderPanorama(cam, 2048);
      const imageId = uid('img');
      await putImage(imageId, blob);
      const url = URL.createObjectURL(blob);
      const mp = worldToMap(cam.x, cam.z);
      const scene = {
        id: uid('scn'),
        name: cam.name,
        imageId,
        initialView: { yaw: -0.35, pitch: -0.5, zoom: 38 },
        mapPos: { x: +mp.x.toFixed(4), y: +mp.y.toFixed(4) },
        mapHeading: 0,
      };
      useStore.setState((s) => ({ imageUrls: { ...s.imageUrls, [imageId]: url } }));
      commit((p) => ({ ...p, scenes: [...p.scenes, scene] }));
      setActiveScene(scene.id);
      showToast(`${scene.name} gerada e salva no IndexedDB.`, 'ok');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <aside className="w-64 shrink-0 surface border-r border-white/[0.06] flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-lime" />
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Cenas 360° ({scenes.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (files.length) {
                await addSceneFiles(files);
                showToast(`${files.length} panorama(s) 360° adicionado(s).`, 'ok');
              }
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-primary !px-2.5 !py-1 text-xs"
            title="Enviar fotos equiretangulares 360° (JPG/PNG)"
          >
            <Plus className="w-3.5 h-3.5" />
            Subir 360°
          </button>
        </div>
      </div>

      {/* Lista de Cenas */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {scenes.map((scene, idx) => {
          const isActive = scene.id === activeSceneId;
          const isStart = scene.id === startSceneId;
          const thumb = imageUrls[scene.imageId];
          const lotCount = lots.filter((l) => l.sceneId === scene.id).length;
          const hsCount = hotspots.filter((h) => h.sceneId === scene.id).length;

          return (
            <div
              key={scene.id}
              onClick={() => setActiveScene(scene.id)}
              className={`group rounded-xl overflow-hidden border transition cursor-pointer ${
                isActive
                  ? 'border-lime bg-ink-850 shadow-[0_0_0_1px_rgba(163,230,53,0.35)]'
                  : 'border-white/[0.06] bg-ink-900/70 hover:border-white/15'
              }`}
            >
              {/* Thumbnail */}
              <div className="relative h-24 bg-ink-950 overflow-hidden">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={scene.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="grid place-items-center h-full text-xs text-mute">Sem imagem</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

                {/* Badges */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  {isStart && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-lime text-ink-950 text-[10px] font-bold">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      INICIAL
                    </span>
                  )}
                  {scene.mapPos && (
                    <span
                      title="Posicionado no Masterplan 2D"
                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-black/70 text-lime text-[10px]"
                    >
                      <MapPin className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Contadores */}
                <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[11px] text-neutral-200">
                  <span className="font-semibold truncate">{scene.name}</span>
                  <span className="shrink-0 tabular text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-soft">
                    {lotCount} lotes • {hsCount} pinos
                  </span>
                </div>
              </div>

              {/* Barra de Ações da Cena */}
              {isActive && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 bg-ink-900 border-t border-white/[0.06] space-y-1.5"
                >
                  <input
                    className="field !py-1 !text-xs font-semibold"
                    value={scene.name}
                    onChange={(e) => updateScene(scene.id, { name: e.target.value })}
                    placeholder="Nome da cena (ex: Drone 01)"
                  />
                  <input
                    className="field !py-1 !text-[11px]"
                    value={scene.subtitle || ''}
                    onChange={(e) => updateScene(scene.id, { subtitle: e.target.value })}
                    placeholder="Subtítulo na foto (ex: Altitude 95m)"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setAsStart(scene.id)}
                        title="Definir como cena inicial"
                        className={`icon-btn !w-6 !h-6 ${isStart ? '!text-lime' : ''}`}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCaptureInitialView?.(scene.id)}
                        title="Fixar vista atual da câmera como ângulo inicial desta cena"
                        className="icon-btn !w-6 !h-6"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveScene(scene.id, -1)}
                        title="Mover para cima"
                        className="icon-btn !w-6 !h-6"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === scenes.length - 1}
                        onClick={() => moveScene(scene.id, 1)}
                        title="Mover para baixo"
                        className="icon-btn !w-6 !h-6"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {scenes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeScene(scene.id)}
                        title="Excluir cena"
                        className="icon-btn !w-6 !h-6 hover:!text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rodapé: Gerador de Cena 360° Procedural para Testes */}
      <div className="p-2.5 border-t border-white/[0.06] bg-ink-900/60">
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateExtraDemoScene}
          className="btn-outline w-full text-xs !py-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-lime" />
          {generating ? 'Renderizando 360°…' : 'Gerar Foto 360° de Teste'}
        </button>
      </div>
    </aside>
  );
}
