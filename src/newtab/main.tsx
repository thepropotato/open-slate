import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/tokens.css'
import { SettingsProvider } from '@/core/settings/SettingsProvider'
import { ThemeProvider } from '@/core/theme/ThemeProvider'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </SettingsProvider>
  </StrictMode>,
)
