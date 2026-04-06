import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_HERMES_API_URL || 'http://5.78.204.80:8000';

  return {
    plugins: [react(), tailwindcss()],
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
