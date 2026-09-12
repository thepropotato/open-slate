import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/tokens.css'
import { SettingsProvider } from '@/core/settings/SettingsProvider'
import { ThemeProvider } from '@/core/theme/ThemeProvider'
import { SlatePreviewPage } from '@/features/slates/SlatePreviewPage'
import '@/features/widgets/index'

/* Previewing a slate from the gallery before it is applied. Reached by link. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ThemeProvider>
        <SlatePreviewPage />
      </ThemeProvider>
    </SettingsProvider>
  </StrictMode>,
)
