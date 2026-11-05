/**
 * Entrypoint do Player Exportável (`tour-offline.html`).
 * Lê o JSON + imagens Base64 embutidos na tag `<script id="project-data" type="application/json">`
 * e monta o PresentationView em tela cheia — 100% offline, compatível com `file://`.
 */
import { createRoot } from 'react-dom/client';
import '../index.css';
import { loadFonts } from '../lib/fonts.js';
import { normalizeProject } from '../lib/model.js';
import PresentationView from '../components/PresentationView.jsx';

loadFonts();

function boot() {
  const el = document.getElementById('project-data');
  if (!el) return;
  let payload = {};
  try {
    payload = JSON.parse(el.textContent || '{}');
  } catch (err) {
    console.error('Erro ao ler #project-data:', err);
  }
  const project = normalizeProject(payload.project || {});
  const imageUrls = payload.images || {};
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(<PresentationView project={project} imageUrls={imageUrls} />);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
