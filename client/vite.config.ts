import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(currentDir, './src') } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    cors: false,
    fs: { strict: true },
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', changeOrigin: true, ws: true }
    }
  },
  build: { outDir: 'dist', sourcemap: false }
})
