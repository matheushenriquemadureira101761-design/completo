import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O servidor entrega o painel em /painel (depois do "npm run build").
// Em desenvolvimento ("npm run dev"), as chamadas /admin vão para o servidor local.
export default defineConfig({
  base: '/painel/',
  plugins: [react()],
  server: { port: 5173, proxy: { '/admin': 'http://localhost:3333', '/fotos': 'http://localhost:3333' } },
});
