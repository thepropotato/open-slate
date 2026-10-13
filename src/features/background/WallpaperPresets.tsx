import { useSetting } from '@/core/settings/SettingsProvider'
import { Icon } from '@/core/icons'
import { AUTO_PRESET, WALLPAPER_PRESETS, presetRef, presetThumb } from './presets'
import './WallpaperPresets.css'

/** Built-in wallpapers. Choosing one switches the wallpaper to an image at that address. */
export function WallpaperPresets() {
  const [type, setType] = useSetting<string>('background.type')
  const [url, setUrl] = useSetting<string>('background.image.url')
  const [, setBlob] = useSetting<string>('background.image.blobId')

  return (
    <div
      className="wp-grid"
      style={{ '--wp-dark': `url(${presetThumb('dawn')})`, '--wp-light': `url(${presetThumb('mist')})` } as React.CSSProperties}
    >
      {[{ id: AUTO_PRESET, label: 'Match theme' }, ...WALLPAPER_PRESETS].map((preset) => {
        const active = type === 'image' && url === presetRef(preset.id)
        return (
          <button
            key={preset.id}
            type="button"
            className="wp"
            aria-pressed={active}
            title={preset.label}
            onClick={() => {
              setBlob('')
              setUrl(presetRef(preset.id))
              setType('image')
            }}
          >
            <span
              className={`wp__thumb${preset.id === AUTO_PRESET ? ' wp__thumb--auto' : ''}`}
              style={preset.id === AUTO_PRESET ? undefined : { backgroundImage: `url(${presetThumb(preset.id)})` }}
            >
              {active ? (
                <span className="wp__check">
                  <Icon name="check" />
                </span>
              ) : null}
            </span>
            <span className="wp__label">{preset.label}</span>
          </button>
        )
      })}
    </div>
  )
}
