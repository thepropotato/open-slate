import { useSetting, useDraftSettings } from '@/core/settings/SettingsProvider'
import { usePreviewMode } from '@/core/theme/ThemeProvider'
import { themePresets } from '@/core/theme/presets'
import { Icon } from '@/core/icons'
import './PresetPicker.css'

/** Swatch grid for `appearance.preset`, previewed in the active light/dark mode. */
export function PresetPicker() {
  const [preset, setPreset] = useSetting<string>('appearance.preset')
  // The draft's mode, so the swatches preview alongside the rest of the draft.
  const mode = usePreviewMode(useDraftSettings().appearance.mode)

  return (
    <div className="preset-grid">
      {themePresets.map((option) => {
        const palette = option[mode]
        const active = option.id === preset
        return (
          <button
            key={option.id}
            type="button"
            className="preset"
            aria-pressed={active}
            onClick={() => setPreset(option.id)}
            title={option.label}
          >
            <span
              className="preset__swatch"
              style={{ background: palette.bg, borderColor: palette.line }}
            >
              <span className="preset__dot" style={{ background: palette.accent }} />
              <span className="preset__bar" style={{ background: palette.fgMuted }} />
              {active ? (
                <span className="preset__check" style={{ color: palette.accent }}>
                  <Icon name="check" />
                </span>
              ) : null}
            </span>
            <span className="preset__label">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
