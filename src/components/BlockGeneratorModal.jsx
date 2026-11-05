/**
 * Modal de Configuração / Subdivisão Automática de Quadra (Grid Generator).
 * É exibido após o usuário clicar nos 4 cantos da quadra na esfera 360° (P1..P4).
 * Atualiza `pendingBlock.preview` em tempo real para que o usuário veja as linhas
 * subdivididas diretamente sobre o panorama antes de confirmar.
 */
import { useEffect, useState } from 'react';
import { Grid3X3, Sparkles, X } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { blockCodeFromName, parseNum } from '../lib/model.js';

export default function BlockGeneratorModal() {
  const pendingBlock = useStore((s) => s.pendingBlock);
  const blocksCount = useStore((s) => s.project.blocks.length);
  const setPendingBlock = useStore((s) => s.setPendingBlock);
  const createBlock = useStore((s) => s.createBlock);
  const clearDraft = useStore((s) => s.clearDraft);

  const nextIndex = blocksCount + 1;
  const defaultName = `Quadra ${String(nextIndex).padStart(2, '0')}`;

  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState(blockCodeFromName(defaultName));
  const [cols, setCols] = useState(10);
  const [rows, setRows] = useState(2);
  const [startNumber, setStartNumber] = useState(1);
  const [numbering, setNumbering] = useState('snake'); // 'snake' | 'rows' | 'cols'
  const [method, setMethod] = useState('perspective'); // 'perspective' | 'bilinear'
  const [area, setArea] = useState('250');
  const [price, setPrice] = useState('129900');
  const [front, setFront] = useState('10');
  const [back, setBack] = useState('10');
  const [sideLeft, setSideLeft] = useState('25');
  const [sideRight, setSideRight] = useState('25');
  const [conditions, setConditions] = useState('Entrada de 10% + 120x sem juros');

  useEffect(() => {
    const n = `Quadra ${String(blocksCount + 1).padStart(2, '0')}`;
    setName(n);
    setCode(blockCodeFromName(n));
  }, [blocksCount, pendingBlock?.corners]);

  // Atualiza o preview da grade em tempo real na esfera 360°
  useEffect(() => {
    if (!pendingBlock) return;
    const c = Math.max(1, Math.min(40, +cols || 1));
    const r = Math.max(1, Math.min(10, +rows || 1));
    const cur = pendingBlock.preview;
    if (!cur || cur.cols !== c || cur.rows !== r || cur.method !== method) {
      setPendingBlock({ ...pendingBlock, preview: { cols: c, rows: r, method } });
    }
  }, [cols, rows, method, pendingBlock, setPendingBlock]);

  if (!pendingBlock) return null;

  const totalLots = Math.max(1, +cols || 1) * Math.max(1, +rows || 1);

  const handleSubmit = (e) => {
    e.preventDefault();
    createBlock({
      name: name.trim() || defaultName,
      code: (code.trim() || blockCodeFromName(name)).toUpperCase(),
      cols: Math.max(1, Math.min(40, parseInt(cols, 10) || 1)),
      rows: Math.max(1, Math.min(10, parseInt(rows, 10) || 1)),
      startNumber: Math.max(1, parseInt(startNumber, 10) || 1),
      numbering,
      method,
      defaults: {
        area: parseNum(area),
        price: parseNum(price),
        front: parseNum(front),
        back: parseNum(back),
        sideLeft: parseNum(sideLeft),
        sideRight: parseNum(sideRight),
        conditions: conditions.trim(),
      },
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 animate-[var(--animate-fade-in)]">
      <form
        onSubmit={handleSubmit}
        className="glass w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden animate-[var(--animate-pop)]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-ink-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-lime/15 border border-lime/40 grid place-items-center text-lime">
              <Grid3X3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Subdivisão Automática de Quadra</h3>
              <p className="text-[11px] text-mute">
                4 cantos capturados na esfera 360° • Pré-visualização ativa ao fundo
              </p>
            </div>
          </div>
          <button type="button" onClick={clearDraft} className="icon-btn" title="Cancelar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Identificação */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label-xs block mb-1">Nome / Letra da Quadra</label>
              <input
                className="field"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setCode(blockCodeFromName(e.target.value));
                }}
                placeholder="Ex: Quadra 01"
              />
            </div>
            <div>
              <label className="label-xs block mb-1">Sigla</label>
              <input
                className="field uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Q01"
              />
            </div>
          </div>

          {/* Malha (Colunas × Fileiras) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-xs block mb-1">Colunas (Frente)</label>
              <input
                type="number"
                min={1}
                max={40}
                className="field tabular"
                value={cols}
                onChange={(e) => setCols(e.target.value)}
              />
            </div>
            <div>
              <label className="label-xs block mb-1">Fileiras (Fundo)</label>
              <input
                type="number"
                min={1}
                max={10}
                className="field tabular"
                value={rows}
                onChange={(e) => setRows(e.target.value)}
              />
            </div>
            <div>
              <label className="label-xs block mb-1">Nº Inicial</label>
              <input
                type="number"
                min={1}
                className="field tabular"
                value={startNumber}
                onChange={(e) => setStartNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Interpolação Esférica + Sequência */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs block mb-1">Geometria Esférica 3D</label>
              <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="perspective">Homografia Gnomônica (Perspectiva)</option>
                <option value="bilinear">Bilinear Esférica (Vetores 3D)</option>
              </select>
            </div>
            <div>
              <label className="label-xs block mb-1">Ordem de Numeração</label>
              <select className="field" value={numbering} onChange={(e) => setNumbering(e.target.value)}>
                <option value="snake">Serpentina (Ida e Volta)</option>
                <option value="rows">Por Fileiras (Esq → Dir)</option>
                <option value="cols">Por Colunas</option>
              </select>
            </div>
          </div>

          {/* Dimensões e Valor Padrão */}
          <div className="rounded-xl p-3.5 bg-ink-900/70 border border-white/[0.06] space-y-3">
            <div className="label-xs text-lime">Padrão dos Lotes Gerados</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-xs block mb-1">Área Padrão (m²)</label>
                <input className="field tabular" value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
              <div>
                <label className="label-xs block mb-1">Preço Padrão (R$)</label>
                <input className="field tabular" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="label-xs block mb-1">Frente (m)</label>
                <input className="field tabular" value={front} onChange={(e) => setFront(e.target.value)} />
              </div>
              <div>
                <label className="label-xs block mb-1">Fundo (m)</label>
                <input className="field tabular" value={back} onChange={(e) => setBack(e.target.value)} />
              </div>
              <div>
                <label className="label-xs block mb-1">Lat. Esq (m)</label>
                <input className="field tabular" value={sideLeft} onChange={(e) => setSideLeft(e.target.value)} />
              </div>
              <div>
                <label className="label-xs block mb-1">Lat. Dir (m)</label>
                <input className="field tabular" value={sideRight} onChange={(e) => setSideRight(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label-xs block mb-1">Condições de Pagamento</label>
              <input
                className="field"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Ex: Entrada + parcelamento direto"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.07] bg-ink-900/80">
          <span className="text-xs text-soft">
            Serão gerados <strong className="text-lime tabular">{totalLots}</strong> lotes instantaneamente
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={clearDraft} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Sparkles className="w-4 h-4" />
              Gerar {totalLots} Lotes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
