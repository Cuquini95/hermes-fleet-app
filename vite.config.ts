import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APPS, appUrl } from './src/apps/catalog';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_HERMES_API_URL || 'https://5-78-204-80.sslip.io/hermes-api';

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'focused-app-manifests',
        generateBundle() {
          for (const app of APPS) {
            const url = appUrl(app);
            this.emitFile({
              type: 'asset',
              fileName: `${url.slice(1)}.webmanifest`,
              source: JSON.stringify({
                id: url,
                name: `${app.label} · Hermes`,
                short_name: app.label,
                scope: `${url}/`,
                start_url: `${url}/`,
                theme_color: '#162252',
                background_color: '#F1F5F9',
                display: 'standalone',
                orientation: 'portrait',
                lang: 'es-MX',
                icons: [
                  { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                  { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                ],
              }),
            });
          }
        },
      },
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons.svg', 'logo-transplus.svg'],
        manifest: {
          name: 'Hermes Fleet — GTP',
          short_name: 'Hermes GTP',
          description: 'Gestión de flota, diagnóstico IA y control de mantenimiento GTP',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          lang: 'es-MX',
          icons: [
            {
              src: '/pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png',
            },
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/apple-touch-icon-180x180.png',
              sizes: '180x180',
              type: 'image/png',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
        },
      }),
    ],
    server: {
      proxy: {
        '/hermes-api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hermes-api/, ''),
        },
      },
    },
  };
});
