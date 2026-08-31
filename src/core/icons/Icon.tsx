import type { CSSProperties } from 'react'
import { icons, type IconName } from './registry'
import './icon.css'

/**
 * Renders a Font Awesome definition (`[width, height, ligatures, unicode, path]`)
 * as one `<svg>`, dropping ~90KB of `fontawesome-svg-core` and `react-fontawesome`.
 */
export interface IconProps {
  name: IconName
  // Any CSS length; defaults to 1em, so icons follow the surrounding text.
  size?: string
  className?: string
  spin?: boolean
  // A title makes the icon meaningful to assistive tech.
  title?: string
  style?: CSSProperties
}

export function Icon({ name, size, className, spin, title, style }: IconProps) {
  const definition = icons[name]
  const [width, height, , , path] = definition.icon
  const d = Array.isArray(path) ? path.join(' ') : path

  return (
    <svg
      className={['icon', spin ? 'icon--spin' : '', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${width} ${height}`}
      style={size ? { fontSize: size, ...style } : style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  )
}

export type { IconName }
