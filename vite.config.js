import { defineConfig } from 'vite'

export default defineConfig({
  server: { 
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://wax3.vercel.app',
        changeOrigin: true
      }
    }
  },
  build: { outDir: 'dist', sourcemap: false },
})
