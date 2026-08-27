import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { icons, type IconName } from './registry'

export interface IconProps {
  name: IconName
  /** Any CSS length; defaults to inheriting the surrounding font size. */
  size?: string
  className?: string
  spin?: boolean
  title?: string
  style?: React.CSSProperties
}

export function Icon({ name, size, className, spin, title, style }: IconProps) {
  return (
    <FontAwesomeIcon
      icon={icons[name]}
      className={className}
      spin={spin}
      style={{ fontSize: size, ...style }}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  )
}

export type { IconName }
