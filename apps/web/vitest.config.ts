import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/design', replacement: path.resolve(__dirname, '../../design') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: 'virtual:pwa-register/react', replacement: path.resolve(__dirname, './src/test/mocks/pwa-register.ts') },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
