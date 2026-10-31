import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './shell/App'
import './styles/app.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  void navigator.serviceWorker.register('./sw.js').catch(() => {})
}

const root = document.getElementById('root')
if (!root) throw new Error('找不到 #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
