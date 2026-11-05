/**
 * Overlay de Marca e Identificação na Imagem 360° (Logo da Empresa + Nome da Cena na Foto).
 * Usado tanto no Studio (Editor) quanto no Modo Apresentação (Player do Cliente / Tablet).
 *
 * 1. Logo da Empresa:
 *    - Imagem enviada pelo usuário (PNG transparente, JPG, SVG, WebP)
 *    - Posicionamento dinâmico (Topo Esquerda, Topo Direita, Base Esquerda)
 *    - Altura e opacidade ajustáveis, link opcional para o site da imobiliária
 *
 * 2. Nome e Subtítulo na Imagem (Panorama Badge):
 *    - Exibe o nome da foto 360° e subtítulo (ex: "Drone 01 — Portaria", "Altitude 95m • Vista Norte")
 *    - Posicionamento (Topo Centro, Topo Esquerda, Base Centro, Base Esquerda)
 *    - No modo Editor: botão de edição rápida (lápis) para renomear e mudar o subtítulo direto na tela!
 *
 * 3. Marca d'Água (Watermark):
 *    - Texto opcional com direitos autorais / nome da imobiliária
 */
import { useState, useRef } from 'react';
import {
  Building2,
  Camera,
  Edit2,
  Check,
  X,
  ExternalLink,
  Upload,
  Compass,
} from 'lucide-react';

export default function PanoOverlayBranding({
  project,
  imageUrls = {},
  activeScene,
  editable = false,
  onUpdateScene,
  onUploadLogo,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempName, setTempName] = useState(activeScene?.name || '');
  const [tempSubtitle, setTempSubtitle] = useState(activeScene?.subtitle || '');
  const fileInputRef = useRef(null);

  const settings = project?.settings || {};
  const branding = settings.branding || {};
  const logoUrl = branding.logoImageId ? imageUrls[branding.logoImageId] : null;

  if (!activeScene) return null;

  const showLogo = branding.enabled !== false;
  const showSceneTitle =
    branding.showSceneTitleOnPano !== false && activeScene.showTitleOnPano !== false;

  const logoPosition = branding.position || 'top-left';
  const titlePosition = branding.sceneTitlePosition || 'top-center';

  const handleSaveSceneTitle = () => {
    if (activeScene && onUpdateScene) {
      onUpdateScene(activeScene.id, {
        name: tempName.trim() || activeScene.name,
        subtitle: tempSubtitle.trim(),
      });
    }
    setEditingTitle(false);
  };

  const handleStartEdit = () => {
    setTempName(activeScene.name || '');
    setTempSubtitle(activeScene.subtitle || '');
    setEditingTitle(true);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden select-none">
      {/* ---------------------------------------------------- LOGO DA EMPRESA */}
      {showLogo && (
        <div
          className={`absolute p-4 z-20 flex items-center ${
            logoPosition === 'top-right'
              ? 'top-0 right-0'
              : logoPosition === 'bottom-left'
              ? 'bottom-4 left-4'
              : 'top-0 left-0'
          }`}
        >
          <div className="pointer-events-auto group relative flex items-center">
            {logoUrl ? (
              <a
                href={branding.companyUrl || undefined}
                target={branding.companyUrl ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={`block transition-transform hover:scale-105 ${
                  branding.companyUrl ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  opacity: Math.max(0.2, (branding.opacity ?? 100) / 100),
                }}
              >
                <img
                  src={logoUrl}
                  alt={settings.companyName || 'Logo da Empresa'}
                  style={{ height: `${branding.height || 38}px` }}
                  className="w-auto max-w-[220px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] filter"
                />
              </a>
            ) : (
              // Badge padrão com nome da empresa
              <div
                className="glass rounded-xl px-3 py-1.5 flex items-center gap-2 border border-white/10 shadow-lg"
                style={{
                  opacity: Math.max(0.3, (branding.opacity ?? 100) / 100),
                }}
              >
                <div className="w-7 h-7 rounded-lg bg-lime text-ink-950 font-black text-xs grid place-items-center shadow-[0_0_12px_rgba(163,230,53,0.35)]">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white leading-tight">
                    {settings.companyName || 'Lote360 Empreendimentos'}
                  </div>
                  {settings.developmentName && (
                    <div className="text-[10px] text-lime font-medium leading-tight">
                      {settings.developmentName}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ação rápida de trocar o logo no modo Editor */}
            {editable && onUploadLogo && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadLogo(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Trocar logo da empresa (PNG transparente recomendado)"
                  className="p-1 rounded bg-ink-900/90 text-neutral-200 hover:text-lime hover:bg-black border border-white/10 shadow text-[10px] flex items-center gap-1"
                >
                  <Upload className="w-3 h-3 text-lime" />
                  Trocar Logo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------- NOME / TÍTULO NA IMAGEM 360° */}
      {showSceneTitle && (
        <div
          className={`absolute p-4 z-20 flex ${
            titlePosition === 'top-left'
              ? 'top-14 left-0'
              : titlePosition === 'bottom-left'
              ? 'bottom-16 left-0'
              : titlePosition === 'bottom-center'
              ? 'bottom-5 inset-x-0 justify-center'
              : 'top-3 inset-x-0 justify-center'
          }`}
        >
          <div className="pointer-events-auto">
            {!editingTitle ? (
              <div className="group glass rounded-xl px-4 py-2 border border-white/10 shadow-2xl flex items-center gap-3 animate-[var(--animate-fade-in)]">
                <div className="w-8 h-8 rounded-lg bg-lime/15 border border-lime/30 grid place-items-center text-lime shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {activeScene.name}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        title="Editar nome e subtítulo da foto 360°"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-soft hover:text-lime"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {activeScene.subtitle ? (
                    <div className="text-[11px] text-neutral-300 font-medium">
                      {activeScene.subtitle}
                    </div>
                  ) : editable ? (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="text-[10px] text-mute hover:text-lime block"
                    >
                      + Adicionar subtítulo (ex: Altitude 95m)
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              // Formulário inline para editar nome da foto na imagem
              <div className="glass rounded-xl p-3 border border-lime/50 shadow-2xl flex flex-col gap-2 min-w-[280px] animate-[var(--animate-pop)]">
                <div className="flex items-center justify-between">
                  <span className="label-xs text-lime">Identificação da Imagem 360°</span>
                  <button
                    type="button"
                    onClick={() => setEditingTitle(false)}
                    className="text-mute hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  className="field !py-1 !text-xs"
                  placeholder="Nome da foto (ex: Drone 01 — Portaria)"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                />
                <input
                  className="field !py-1 !text-xs"
                  placeholder="Subtítulo na foto (ex: Altitude 95m • Vista Norte)"
                  value={tempSubtitle}
                  onChange={(e) => setTempSubtitle(e.target.value)}
                />
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingTitle(false)}
                    className="btn-ghost !py-0.5 !px-2 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSceneTitle}
                    className="btn-primary !py-0.5 !px-2.5 text-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar na Foto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- MARCA D'ÁGUA TEXTUAL */}
      {branding.watermarkText && (
        <div className="absolute bottom-2 right-3 pointer-events-none z-10">
          <span className="text-[10.5px] font-medium tracking-wider uppercase text-white/35 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {branding.watermarkText}
          </span>
        </div>
      )}
    </div>
  );
}
