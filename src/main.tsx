import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './shell/App'
import './styles/app.css'

if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}

const root = document.getElementById('root')
if (!root) throw new Error('找不到 #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
