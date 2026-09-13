import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/mp-api': {
        target: 'https://api.mercadopago.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mp-api/, '')
      }
    }
  }
})
