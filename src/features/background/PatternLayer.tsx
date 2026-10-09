import { useId } from 'react'
import type { Background } from '@/core/settings/schema'
import type { Palette } from '@/core/theme/presets'
import { isDark } from '@/core/theme/color'

export function PatternLayer({
  background,
  palette,
}: {
  background: Background
  palette: Palette
}) {
  const { pattern } = background
  const { style, spacing, opacity } = pattern
  const id = `bgpat${useId().replace(/[:]/g, '')}`

  if (style === 'mesh') {
    return (
      <div
        className="bg__pattern bg__pattern--mesh"
        style={{
          opacity,
          backgroundImage: `
            radial-gradient(at 15% 15%, ${palette.accent} 0px, transparent 55%),
            radial-gradient(at 85% 20%, rgb(var(--surface-tint) / 18%) 0px, transparent 50%),
            radial-gradient(at 50% 80%, ${palette.accent} 0px, transparent 50%),
            radial-gradient(at 80% 85%, rgb(var(--surface-tint) / 14%) 0px, transparent 50%)
          `,
        }}
      />
    )
  }

  const ink = isDark(palette.bg) ? '#ffffff' : '#000000'

  return (
    <svg
      className="bg__pattern"
      style={{
        color: ink,
        opacity,
      }}
      aria-hidden="true"
    >
      <defs>
        {style === 'dots' && (
          <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
            <circle cx={spacing / 2} cy={spacing / 2} r="1.5" fill="currentColor" />
          </pattern>
        )}

        {style === 'grid' && (
          <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
            <path
              d={`M ${spacing} 0 L 0 0 0 ${spacing}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
        )}

        {style === 'stripes' && (
          <pattern
            id={id}
            width={spacing}
            height={spacing}
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2={spacing} stroke="currentColor" strokeWidth="1.2" />
          </pattern>
        )}

        {style === 'isometric' && (
          <pattern
            id={id}
            width={spacing * 1.732}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M 0 ${spacing} L ${(spacing * 1.732) / 2} 0 L ${spacing * 1.732} ${spacing} Z M 0 0 L ${(spacing * 1.732) / 2} ${spacing} L ${spacing * 1.732} 0 Z`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
          </pattern>
        )}

        {style === 'waves' && (
          <pattern id={id} width={spacing * 2} height={spacing} patternUnits="userSpaceOnUse">
            <path
              d={`M 0 ${spacing / 2} Q ${spacing / 2} 0, ${spacing} ${spacing / 2} T ${spacing * 2} ${spacing / 2}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

