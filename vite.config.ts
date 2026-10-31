import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))
const distDir = fileURLToPath(new URL('./dist', import.meta.url))
const cacheDir = fileURLToPath(new URL('./node_modules/.vite', import.meta.url))

function githubPagesSpaFallback(): Plugin {
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    closeBundle: {
      order: 'post',
      handler() {
        const indexPath = path.join(distDir, 'index.html')
        if (!existsSync(indexPath)) return
        copyFileSync(indexPath, path.join(distDir, '404.html'))
      },
    },
  }
}

// root 設在 src，建置產物寫到倉庫根的 dist/，不改動根目錄舊 index.html。
// 靜態檔來自 src/public（含圖示與 sql-wasm.wasm）。
export default defineConfig({
  root: srcDir,
  base: '/',
  appType: 'spa',
  cacheDir,
  plugins: [
    tailwindcss(),
    react(),
    githubPagesSpaFallback(),
  ],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  build: {
    outDir: distDir,
    emptyOutDir: true,
  },
})
