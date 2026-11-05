import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Build de arquivo único do Studio + Player + Exportador:
// Em modo library (IIFE), o Vite embute todos os assets (fontes, ícones) em Base64,
// permitindo injetar o Studio inteiro dentro de um único .html autossuficiente.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'studio-single',
    emptyOutDir: true,
    copyPublicDir: false,
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: 'src/main.jsx',
      name: 'Lote360StudioApp',
      formats: ['iife'],
      fileName: () => 'studio.js',
      cssFileName: 'studio',
    },
  },
});
