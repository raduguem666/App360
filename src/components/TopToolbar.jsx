/**
 * Barra Superior do Studio (inspirada no Mozari / DaVinci Resolve):
 * - Identidade do projeto + indicador de salvamento automático em IndexedDB
 * - Ferramentas de mapeamento 360°: Selecionar, Lote Manual (Polígono),
 *   Subdivisão de Quadra (4 Pontos), Hotspot de Transição
 * - Desfazer / Refazer
 * - Alternância para Modo Apresentação (Player Tela Cheia)
 * - Exportação 100% Offline (`tour-offline.html`) e Backup (`.mozari.json`)
 */
import { useRef, useState } from 'react';
import {
  MousePointer,
  Pentagon,
  Grid3X3,
  Navigation,
  Undo2,
  Redo2,
  Play,
  Download,
  FileJson,
  Upload,
  RotateCcw,
  HardDrive,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '../store/useStore.js';
import {
  exportOfflineHtml,
  exportMozariBackup,
  importMozariBackup,
} from '../lib/exporter.js';

export default function TopToolbar({ onResetDemo }) {
  const importRef = useRef(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [busyMessage, setBusyMessage] = useState(null);

  const project = useStore((s) => s.project);
  const tool = useStore((s) => s.tool);
  const pastLen = useStore((s) => s.past.length);
  const futureLen = useStore((s) => s.future.length);
  const activeSceneId = useStore((s) => s.activeSceneId);

  const setTool = useStore((s) => s.setTool);
  const setMode = useStore((s) => s.setMode);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const renameProject = useStore((s) => s.renameProject);
  const loadProject = useStore((s) => s.loadProject);
  const showToast = useStore((s) => s.showToast);
  const hotspotTarget = useStore((s) => s.hotspotTarget);
  const setHotspotTarget = useStore((s) => s.setHotspotTarget);

  const otherScenes = project.scenes.filter((s) => s.id !== activeSceneId);

  const handleExportHtml = async () => {
    setExportMenuOpen(false);
    try {
      setBusyMessage('Gerando tour-offline.html…');
      const { sizeBytes, canceled, filePath } = await exportOfflineHtml(project, (msg) =>
        setBusyMessage(msg),
      );
      if (canceled) return;
      const mb = (sizeBytes / (1024 * 1024)).toFixed(2);
      showToast(
        `Salvo (${mb} MB): ${filePath} — pronto para abrir com duplo-clique sem internet!`,
        'ok',
      );
    } catch (err) {
      console.error(err);
      showToast('Falha ao exportar HTML offline.', 'warn');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleExportBackup = async () => {
    setExportMenuOpen(false);
    try {
      setBusyMessage('Exportando backup .mozari.json…');
      const { canceled, filePath } = await exportMozariBackup(project, (msg) =>
        setBusyMessage(msg),
      );
      if (canceled) return;
      showToast(`Backup salvo em ${filePath}!`, 'ok');
    } catch (err) {
      console.error(err);
      showToast('Falha ao exportar backup.', 'warn');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleImportBackup = async (fileOrText) => {
    setExportMenuOpen(false);
    try {
      setBusyMessage('Importando projeto .mozari.json…');
      const { project: imported, imageUrls } = await importMozariBackup(fileOrText, (msg) =>
        setBusyMessage(msg),
      );
      loadProject(imported, imageUrls);
      showToast(`Projeto "${imported.name}" restaurado!`, 'ok');
    } catch (err) {
      console.error(err);
      showToast('Arquivo .mozari.json inválido.', 'warn');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleClickImport = async () => {
    if (typeof window !== 'undefined' && window.desktopAPI?.openFile) {
      setExportMenuOpen(false);
      const res = await window.desktopAPI.openFile({
        filters: [{ name: 'Projeto Lote360 (.mozari.json)', extensions: ['json'] }],
      });
      if (!res?.canceled && res?.text) {
        await handleImportBackup(res.text);
      }
      return;
    }
    importRef.current?.click();
  };

  return (
    <header className="h-13 shrink-0 surface border-b border-white/[0.06] px-3.5 flex items-center justify-between gap-3 select-none z-30">
      {/* Esquerda: Marca + Nome do Projeto + Status IndexedDB */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-lime text-ink-950 font-black text-xs grid place-items-center shadow-[0_0_15px_rgba(163,230,53,0.4)]">
            360
          </div>
          <h1 className="text-xs font-extrabold tracking-wider uppercase text-white hidden sm:block">
            Lote360 <span className="text-lime">Studio</span>
          </h1>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <input
          aria-label="Nome do projeto"
          className="bg-transparent text-xs font-semibold text-neutral-200 hover:text-white focus:text-white focus:bg-ink-900 px-2 py-1 rounded border border-transparent focus:border-lime/50 outline-none w-48 truncate"
          value={project.name}
          onChange={(e) => renameProject(e.target.value)}
        />

        <span
          title="Armazenamento local de alta capacidade via IndexedDB (suporta panoramas 4K/8K)"
          className="hidden lg:inline-flex items-center gap-1 text-[10px] font-medium text-mute px-2 py-0.5 rounded bg-white/[0.04]"
        >
          <HardDrive className="w-3 h-3 text-lime" />
          IndexedDB Offline
        </span>
      </div>

      {/* Centro: Ferramentas de Mapeamento 360° */}
      <div className="flex items-center gap-1 bg-ink-900 p-1 rounded-xl border border-white/[0.06]">
        <ToolButton
          active={tool === 'select'}
          onClick={() => setTool('select')}
          icon={MousePointer}
          label="Selecionar"
          shortcut="V"
        />
        <ToolButton
          active={tool === 'polygon'}
          onClick={() => setTool('polygon')}
          icon={Pentagon}
          label="Lote Manual"
          shortcut="P"
        />
        <ToolButton
          active={tool === 'grid'}
          onClick={() => setTool('grid')}
          icon={Grid3X3}
          label="Quadra (4 Pontos)"
          shortcut="G"
        />
        <ToolButton
          active={tool === 'hotspot'}
          onClick={() => setTool('hotspot')}
          icon={Navigation}
          label="Hotspot 360°"
          shortcut="H"
        />

        {tool === 'hotspot' && otherScenes.length > 0 && (
          <select
            className="field !w-36 !py-0.5 !text-xs ml-1"
            value={hotspotTarget || otherScenes[0]?.id || ''}
            onChange={(e) => setHotspotTarget(e.target.value)}
            title="Cena de destino ao clicar na esfera"
          >
            {otherScenes.map((s) => (
              <option key={s.id} value={s.id}>
                → {s.name}
              </option>
            ))}
          </select>
        )}

        <div className="h-4 w-px bg-white/10 mx-1" />

        <button
          type="button"
          disabled={!pastLen}
          onClick={undo}
          title="Desfazer (Ctrl+Z)"
          className="icon-btn !w-7 !h-7"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={!futureLen}
          onClick={redo}
          title="Refazer (Ctrl+Y)"
          className="icon-btn !w-7 !h-7"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Direita: Apresentação & Exportação Offline */}
      <div className="flex items-center gap-2">
        {busyMessage && (
          <span className="text-xs text-lime animate-pulse hidden md:inline">{busyMessage}</span>
        )}

        <button
          type="button"
          onClick={() => setMode('presentation')}
          className="btn-outline !py-1.5 !px-3 text-xs font-semibold"
          title="Testar Modo Apresentação (Player do Cliente / Tablet)"
        >
          <Play className="w-3.5 h-3.5 text-lime fill-current" />
          Modo Apresentação
        </button>

        {/* Menu de Exportação Offline / Backup */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportMenuOpen((v) => !v)}
            className="btn-primary !py-1.5 !px-3 text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Offline
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {exportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setExportMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 glass rounded-xl border border-white/10 p-1.5 z-40 space-y-1 animate-[var(--animate-pop)]">
                <button
                  type="button"
                  onClick={handleExportHtml}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg text-left hover:bg-white/[0.07] transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-lime/15 border border-lime/40 grid place-items-center text-lime shrink-0 mt-0.5">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      Single-File Offline HTML (tour-offline.html)
                    </div>
                    <p className="text-[11px] text-mute leading-snug mt-0.5">
                      Compila todas as fotos 360°, Masterplan, lotes e motor WebGL em um único arquivo{' '}
                      <code className="text-lime">.html</code> que abre com duplo-clique sem internet.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg text-left hover:bg-white/[0.07] transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/15 grid place-items-center text-neutral-200 shrink-0 mt-0.5">
                    <FileJson className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      Exportar Backup (.mozari.json)
                    </div>
                    <p className="text-[11px] text-mute leading-snug mt-0.5">
                      Salva todo o estado do projeto (imagens + coordenadas dos lotes) para continuar editando depois.
                    </p>
                  </div>
                </button>

                <div className="h-px bg-white/[0.07] my-1" />

                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportBackup(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={handleClickImport}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-neutral-200 hover:bg-white/[0.07] transition"
                >
                  <Upload className="w-3.5 h-3.5 text-lime" />
                  Importar Backup (.mozari.json)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    onResetDemo?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-soft hover:text-white hover:bg-white/[0.07] transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Recarregar Loteamento de Demonstração
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ToolButton({ active, onClick, icon: Icon, label, shortcut }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
        active
          ? 'bg-lime text-ink-950 shadow'
          : 'text-soft hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {shortcut && (
        <span
          className={`text-[10px] px-1 rounded ${
            active ? 'bg-black/20 text-ink-950' : 'bg-white/[0.06] text-mute'
          }`}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}
