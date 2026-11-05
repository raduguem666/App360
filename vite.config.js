import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Studio (editor). O bundle do Player (player-dist/) é importado como texto (?raw)
// e embutido no HTML offline exportado.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 4000 },
});
