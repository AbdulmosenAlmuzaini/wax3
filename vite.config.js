import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
  // جاهز للنشر على Vercel بدون إعدادات إضافية
})
