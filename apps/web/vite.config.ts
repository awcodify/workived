import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '.test.',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: '@/design', replacement: path.resolve(__dirname, '../../design') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                status: 'degraded',
                message: '🏖️ Backend is on leave.',
              }))
            }
          })
        },
      },
    },
  },
})
