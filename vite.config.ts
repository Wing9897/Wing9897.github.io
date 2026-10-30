import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vite'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))
const distDir = fileURLToPath(new URL('./dist', import.meta.url))
const cacheDir = fileURLToPath(new URL('./node_modules/.vite', import.meta.url))

// tokens.css：淺色頂欄 --color-surface、畫布 --color-bg
const themeColor = '#f7f6f2'
const backgroundColor = '#e6e3db'

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
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['sql-wasm.wasm'],
      manifest: {
        name: 'Wing9897 Tools Hub',
        short_name: 'Tools Hub',
        lang: 'zh-Hant',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: themeColor,
        background_color: backgroundColor,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // 只預快取應用殼、圖示與 wasm。不對外部 API 做 runtimeCaching。
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
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
