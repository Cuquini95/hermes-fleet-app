import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/hermes-api': {
        target: 'http://5.78.204.80:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hermes-api/, ''),
      },
    },
  },
})
