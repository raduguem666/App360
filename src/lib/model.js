/** Modelo de dados, constantes de status e utilitários de formatação. */

export const STATUS = {
  disponivel: { key: 'disponivel', label: 'Disponível', plural: 'Disponíveis', color: '#22c55e' },
  reservado: { key: 'reservado', label: 'Reservado', plural: 'Reservados', color: '#eab308' },
  vendido: { key: 'vendido', label: 'Vendido', plural: 'Vendidos', color: '#ef4444' },
};
export const STATUS_LIST = Object.values(STATUS);

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const formatBRL = (v) => (v === null || v === undefined || v === '' || isNaN(+v) ? '—' : brl.format(+v));
export const formatNumber = (v) => (v === null || v === undefined || v === '' || isNaN(+v) ? '—' : num.format(+v));
export const formatArea = (v) => (v === null || v === undefined || v === '' || isNaN(+v) ? '—' : `${num.format(+v)} m²`);
export const formatMeters = (v) => (v === null || v === undefined || v === '' || isNaN(+v) ? '—' : `${num.format(+v)} m`);

export const pad = (n, size = 2) => String(n).padStart(size, '0');

/** Converte número digitado (aceita vírgula decimal) */
export function parseNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** Deriva a sigla da quadra: "Quadra 01" → "Q01", "Quadra B" → "QB" */
export function blockCodeFromName(name) {
  const m = String(name).trim().match(/([0-9]+|[A-Za-z])\s*$/);
  return m ? `Q${m[1].toUpperCase()}` : 'Q';
}

export function lotDisplayName(code, number) {
  return `${code} - Lote ${pad(number)}`;
}

export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`;
}

export function defaultBranding() {
  return {
    enabled: true,
    logoImageId: null,
    position: 'top-left', // 'top-left' | 'top-right' | 'bottom-left'
    height: 38, // 24 to 72 px
    opacity: 100, // 40 to 100%
    companyUrl: '',
    showSceneTitleOnPano: true,
    sceneTitlePosition: 'top-center', // 'top-center' | 'top-left' | 'bottom-left' | 'bottom-center'
    watermarkText: '',
  };
}

export function defaultSettings() {
  return {
    developmentName: 'Residencial Vista Verde',
    companyName: 'Lote360 Empreendimentos',
    showLabels: true,
    branding: defaultBranding(),
    action: {
      type: 'whatsapp', // 'whatsapp' | 'proposal' | 'link'
      label: 'Falar no WhatsApp',
      phone: '5511999999999',
      message: 'Olá! Tenho interesse no {lote} ({quadra}) do {empreendimento}, valor {preco}.',
      url: '',
    },
  };
}

export function emptyProject() {
  return {
    version: 1,
    id: uid('prj'),
    name: 'Novo Loteamento',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: defaultSettings(),
    scenes: [],
    hotspots: [],
    blocks: [],
    lots: [],
    masterplan: null,
    startSceneId: null,
  };
}

/** Garante campos novos em projetos antigos/importados. */
export function normalizeProject(p) {
  const base = emptyProject();
  return {
    ...base,
    ...p,
    settings: {
      ...base.settings,
      ...(p.settings || {}),
      branding: {
        ...defaultBranding(),
        ...(p.settings?.branding || {}),
      },
      action: {
        ...base.settings.action,
        ...(p.settings?.action || {}),
      },
    },
    scenes: (p.scenes || []).map((s) => ({
      subtitle: '',
      showTitleOnPano: true,
      ...s,
    })),
    hotspots: p.hotspots || [],
    blocks: p.blocks || [],
    lots: p.lots || [],
  };
}

export function statusCounts(lots) {
  const c = { total: lots.length, disponivel: 0, reservado: 0, vendido: 0 };
  for (const l of lots) c[l.status] = (c[l.status] || 0) + 1;
  return c;
}

/** Monta a mensagem do botão de ação substituindo variáveis. */
export function fillTemplate(tpl, lot, block, settings) {
  return String(tpl || '')
    .replaceAll('{lote}', lot?.name ?? '')
    .replaceAll('{numero}', lot ? pad(lot.number) : '')
    .replaceAll('{quadra}', block?.name ?? 'Avulso')
    .replaceAll('{preco}', formatBRL(lot?.price))
    .replaceAll('{area}', formatArea(lot?.area))
    .replaceAll('{empreendimento}', settings?.developmentName ?? '');
}
