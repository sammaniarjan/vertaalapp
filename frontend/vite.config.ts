import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use relative paths so Electron can load via file:// protocol
  base: './',
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:8001',
        ws: true,
      },
      '/health': {
        target: 'http://localhost:8001',
      },
    },
  },
})
