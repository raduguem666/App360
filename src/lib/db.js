/**
 * Persistência local do Studio em IndexedDB.
 * - store "projects": documento JSON do projeto (cenas, quadras, lotes...)
 * - store "images":   Blobs das imagens 360° / masterplan (4K/8K sem limite de 5 MB)
 */
import { openDB } from 'idb';

const DB_NAME = 'lote360-studio';
const DB_VERSION = 1;
const CURRENT_KEY = 'current';

let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects');
        if (!database.objectStoreNames.contains('images')) database.createObjectStore('images');
      },
    });
  }
  return dbPromise;
}

export async function saveProject(project) {
  return (await db()).put('projects', project, CURRENT_KEY);
}

export async function loadProject() {
  return (await db()).get('projects', CURRENT_KEY);
}

export async function putImage(id, blob) {
  return (await db()).put('images', blob, id);
}

export async function getImage(id) {
  return (await db()).get('images', id);
}

export async function deleteImage(id) {
  return (await db()).delete('images', id);
}

export async function listImageIds() {
  return (await db()).getAllKeys('images');
}

/** Remove do banco as imagens que não são mais referenciadas pelo projeto. */
export async function garbageCollectImages(project) {
  const used = new Set(referencedImageIds(project));
  const all = await listImageIds();
  await Promise.all(all.filter((id) => !used.has(id)).map((id) => deleteImage(id)));
}

export async function clearAll() {
  const d = await db();
  await d.clear('projects');
  await d.clear('images');
}

export function referencedImageIds(project) {
  const ids = project.scenes.map((s) => s.imageId);
  if (project.masterplan?.imageId) ids.push(project.masterplan.imageId);
  if (project.settings?.branding?.logoImageId) ids.push(project.settings.branding.logoImageId);
  if (project.panoImages) {
    project.panoImages.forEach((p) => p.imageId && ids.push(p.imageId));
  }
  return ids;
}

/** Pede ao navegador armazenamento persistente (evita limpeza automática). */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* sem suporte — segue normalmente */
  }
}
