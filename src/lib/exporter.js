/**
 * Módulo 3: Exportação 100% Offline & Backup completo (.mozari.json).
 *
 * 1) `exportOfflineHtml(project)`:
 *    - Converte todas as imagens 360° e o Masterplan 2D do IndexedDB para Data-URL Base64
 *    - Embute o estado + imagens em `<script id="project-data" type="application/json">`
 *    - Embute o CSS (`player-dist/player.css`) e o JS IIFE (`player-dist/player.js`)
 *      pré-compilados com React + Photo Sphere Viewer + Three.js + Fontes
 *    - Gera e baixa `tour-offline.html`, que abre com duplo-clique em `file://`
 *      em qualquer notebook ou tablet Android/iPad sem internet e sem CORS.
 *
 * 2) `exportMozariBackup(project)` & `importMozariBackup(file)`:
 *    - Salva/restaura todo o estado do projeto + imagens Base64 em `.mozari.json`
 *      para continuar editando posteriormente.
 */
import playerJs from '../../player-dist/player.js?raw';
import playerCss from '../../player-dist/player.css?raw';
import { getImage, putImage, referencedImageIds } from './db.js';
import { normalizeProject } from './model.js';

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Coleta todas as imagens referenciadas pelo projeto como Data-URLs Base64. */
export async function collectBase64Images(project, onProgress) {
  const ids = referencedImageIds(project);
  const out = {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    onProgress?.(`Codificando imagem ${i + 1}/${ids.length} em Base64…`, (i + 0.3) / (ids.length + 1));
    const blob = await getImage(id);
    if (blob) {
      out[id] = await blobToDataUrl(blob);
    }
  }
  return out;
}

/** Escapa `</script` dentro de JSON/JS para nunca quebrar a tag HTML onde é injetado. */
function safeInlineScript(str) {
  return String(str).replace(/<\/(script)/gi, '<\\/$1');
}

function escapeTitle(str) {
  return String(str || 'Tour 360° Offline').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

async function saveContent(content, filename, filters) {
  if (typeof window !== 'undefined' && window.desktopAPI?.saveFile) {
    const res = await window.desktopAPI.saveFile({
      defaultName: filename,
      filters,
      content,
    });
    return { canceled: !!res?.canceled, filePath: res?.filePath || filename };
  }
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { canceled: false, filePath: filename };
}

/**
 * Gera e salva o arquivo único `tour-offline.html` (100% autossuficiente).
 */
export async function exportOfflineHtml(project, onProgress) {
  onProgress?.('Preparando imagens 360° e Masterplan…', 0.05);
  const images = await collectBase64Images(project, onProgress);

  onProgress?.('Empacotando motor 360° e dados no HTML único…', 0.85);
  const dataJson = safeInlineScript(JSON.stringify({ project, images }));
  const inlineJs = safeInlineScript(playerJs);
  const title = escapeTitle(project.settings?.developmentName || project.name);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#121212" />
<title>${title} — Tour 360° Offline</title>
<style>${playerCss}</style>
</head>
<body class="bg-ink-900 text-neutral-200">
<div id="root" style="width:100vw;height:100vh;overflow:hidden;"></div>
<script id="project-data" type="application/json">${dataJson}</script>
<script>${inlineJs}</script>
</body>
</html>`;

  const sizeBytes = new Blob([html]).size;
  const saved = await saveContent(html, 'tour-offline.html', [
    { name: 'Tour 360° Offline HTML', extensions: ['html'] },
  ]);
  onProgress?.('Exportação concluída!', 1);
  return { sizeBytes, ...saved };
}

/**
 * Exporta backup completo do projeto (`.mozari.json`) com imagens embutidas em Base64.
 */
export async function exportMozariBackup(project, onProgress) {
  onProgress?.('Serializando imagens do projeto…', 0.1);
  const images = await collectBase64Images(project, onProgress);
  const backup = {
    format: 'lote360-mozari-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    images,
  };
  const json = JSON.stringify(backup);
  const slug = (project.name || 'projeto')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'loteamento';
  const sizeBytes = new Blob([json]).size;
  const saved = await saveContent(json, `${slug}.mozari.json`, [
    { name: 'Projeto Lote360 (.mozari.json)', extensions: ['json'] },
  ]);
  onProgress?.('Backup concluído!', 1);
  return { sizeBytes, ...saved };
}

/**
 * Importa um arquivo `.mozari.json` (File ou texto vindo do diálogo nativo do Windows),
 * grava os Blobs no IndexedDB e devolve `{ project, imageUrls }` prontos para carregar na store.
 */
export async function importMozariBackup(fileOrText, onProgress) {
  onProgress?.('Lendo arquivo .mozari.json…', 0.15);
  const text = typeof fileOrText === 'string' ? fileOrText : await fileOrText.text();
  const parsed = JSON.parse(text);
  const rawProject = parsed.project || parsed;
  const project = normalizeProject(rawProject);
  const images = parsed.images || {};
  const entries = Object.entries(images);
  const imageUrls = {};

  for (let i = 0; i < entries.length; i++) {
    const [id, dataUrl] = entries[i];
    onProgress?.(`Restaurando imagem ${i + 1}/${entries.length} no IndexedDB…`, 0.2 + (0.75 * i) / Math.max(1, entries.length));
    const blob = await dataUrlToBlob(dataUrl);
    await putImage(id, blob);
    imageUrls[id] = URL.createObjectURL(blob);
  }
  onProgress?.('Projeto restaurado!', 1);
  return { project, imageUrls };
}
