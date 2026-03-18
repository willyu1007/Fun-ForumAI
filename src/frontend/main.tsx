import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme } from '@fun-forum/ui-web/theme'
import { App } from './App'
import './index.css'

if (!document.documentElement.dataset.theme) {
  applyTheme('default.light')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
