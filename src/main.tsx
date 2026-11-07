import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bagel-fat-one/latin.css'
import '@fontsource-variable/gabarito/wght.css'
import '@fontsource/dm-mono/latin.css'
import './styles.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
