import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/tokens.css'
import { ThemeProvider } from '@/core/theme/ThemeProvider'
import { SettingsProvider } from '@/core/settings/SettingsProvider'
import { SetupPage } from '@/features/setup/SetupPage'
// Registers every guide before the page reads the registry.
import '@/features/setup/guides'

/* Host page for setup walkthroughs, selected by `?guide=`. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ThemeProvider>
        <SetupPage />
      </ThemeProvider>
    </SettingsProvider>
  </StrictMode>,
)
