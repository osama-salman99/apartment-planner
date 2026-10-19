import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8230',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // preview.html (one piece of furniture on its own) is a development aid: `vite` still serves
    // it locally, but it is left out of the build so the live site doesn't publish it.
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});
