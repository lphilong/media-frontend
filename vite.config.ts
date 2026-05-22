import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          const localeMatch = normalizedId.match(/\/src\/locales\/([^/]+)\//);
          if (localeMatch) {
            return `locales-${localeMatch[1]}`;
          }

          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          if (
            normalizedId.includes('/react/') ||
            normalizedId.includes('/react-dom/') ||
            normalizedId.includes('/scheduler/') ||
            normalizedId.includes('/loose-envify/')
          ) {
            return 'vendor-react';
          }

          if (normalizedId.includes('/react-router') || normalizedId.includes('/@remix-run/')) {
            return 'vendor-router';
          }

          if (normalizedId.includes('/@tanstack/')) {
            return 'vendor-tanstack';
          }

          if (normalizedId.includes('/i18next/') || normalizedId.includes('/react-i18next/')) {
            return 'vendor-i18n';
          }

          if (normalizedId.includes('/@auth0/') || normalizedId.includes('/axios/')) {
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
