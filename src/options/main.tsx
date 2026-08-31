import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/tokens.css'
import { SettingsProvider } from '@/core/settings/SettingsProvider'
import { ThemeProvider } from '@/core/theme/ThemeProvider'
import { SettingsPanel } from '@/features/settings-ui/SettingsPanel'

/* The settings page. The new tab's settings button navigates here. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ThemeProvider>
        <SettingsPanel onClose={() => window.location.assign('/newtab.html')} />
      </ThemeProvider>
    </SettingsProvider>
  </StrictMode>,
)
