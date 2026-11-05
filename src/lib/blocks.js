/** Geração / regeneração dos lotes de uma quadra subdividida. */
import { subdivideBlock } from './sphere.js';
import { uid, lotDisplayName } from './model.js';

/** Índice sequencial da célula conforme o padrão de numeração escolhido. */
export function cellIndex(block, row, col) {
  const { cols, rows } = block;
  switch (block.numbering) {
    case 'cols':
      return col * rows + row;
    case 'snake':
      return row % 2 === 0 ? row * cols + col : row * cols + (cols - 1 - col);
    case 'rows':
    default:
      return row * cols + col;
  }
}

/**
 * Gera (ou regenera) os lotes de uma quadra.
 * Lotes já existentes na mesma célula (row/col) preservam id, status, preço e
 * demais propriedades — apenas a geometria e (se automático) o nome mudam.
 */
export function generateBlockLots(block, existing = []) {
  const byCell = new Map(existing.filter((l) => l.cell).map((l) => [`${l.cell.row}:${l.cell.col}`, l]));
  const cells = subdivideBlock(block.corners, block.cols, block.rows, block.method || 'perspective');
  const d = block.defaults || {};
  return cells.map((cell) => {
    const number = (block.startNumber ?? 1) + cellIndex(block, cell.row, cell.col);
    const prev = byCell.get(`${cell.row}:${cell.col}`);
    if (prev) {
      return {
        ...prev,
        sceneId: block.sceneId,
        number,
        name: prev.autoName !== false ? lotDisplayName(block.code, number) : prev.name,
        points: cell.points,
      };
    }
    return {
      id: uid('lot'),
      sceneId: block.sceneId,
      blockId: block.id,
      cell: { row: cell.row, col: cell.col },
      number,
      name: lotDisplayName(block.code, number),
      autoName: true,
      status: 'disponivel',
      area: d.area ?? null,
      front: d.front ?? null,
      back: d.back ?? null,
      sideLeft: d.sideLeft ?? null,
      sideRight: d.sideRight ?? null,
      price: d.price ?? null,
      conditions: d.conditions ?? '',
      notes: '',
      showLabel: true,
      points: cell.points,
    };
  });
}
