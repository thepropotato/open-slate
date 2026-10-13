import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/tokens.css'
import '@/styles/ui-font.css'
import { ThemeProvider } from '@/core/theme/ThemeProvider'
import { SettingsProvider } from '@/core/settings/SettingsProvider'
import { PopupApp } from './PopupApp'

/* Toolbar popup: adds the current page as a tile without opening the new tab. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ThemeProvider>
        <PopupApp />
      </ThemeProvider>
    </SettingsProvider>
  </StrictMode>,
)
