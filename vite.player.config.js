import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Player exportável: compila React + Photo Sphere Viewer + three.js em um único
// IIFE (player.js) + uma folha de estilo (player.css). Em "library mode" o Vite
// embute todos os assets (fontes) como data-URI, garantindo funcionamento 100%
// offline via file://.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'player-dist',
    emptyOutDir: true,
    copyPublicDir: false,
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: 'src/player/main.jsx',
      name: 'Lote360Player',
      formats: ['iife'],
      fileName: () => 'player.js',
      cssFileName: 'player',
    },
  },
});
