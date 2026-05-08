import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/locales/')) {
            return 'locales';
          }

          if (!id.includes('/node_modules/')) {
            return undefined;
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/loose-envify/')
          ) {
            return 'vendor-react';
          }

          if (id.includes('/react-router') || id.includes('/@remix-run/')) {
            return 'vendor-router';
          }

          if (id.includes('/@tanstack/')) {
            return 'vendor-tanstack';
          }

          if (id.includes('/i18next/') || id.includes('/react-i18next/')) {
            return 'vendor-i18n';
          }

          if (id.includes('/@auth0/') || id.includes('/axios/')) {
            return 'vendor-api-auth';
          }

          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@locales': fileURLToPath(new URL('./src/locales', import.meta.url)),
      '@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
      '@test': fileURLToPath(new URL('./src/test', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
