import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Studio (editor). O bundle do Player (player-dist/) é importado como texto (?raw)
// e embutido no HTML offline exportado.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 4000 },
});
