import { useId, type ChangeEvent, type ReactNode } from 'react'
import { Icon, type IconName } from '@/core/icons'
import './controls.css'

export function Row({
  title,
  help,
  children,
  stacked = false,
}: {
  title: ReactNode
  help?: ReactNode
  children: ReactNode
  stacked?: boolean
}) {
  return (
    <div className={`ctl-row${stacked ? ' ctl-row--stacked' : ''}`}>
      <div className="ctl-row__label">
        <span className="ctl-row__title">{title}</span>
        {help ? <span className="ctl-row__help">{help}</span> : null}
      </div>
      <div className="ctl-row__control">{children}</div>
    </div>
  )
}

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean
  onChange: (next: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      className="ctl-toggle"
      onClick={() => onChange(!value)}
    />
  )
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  format,
}: {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  format?: (value: number) => string
}) {
  return (
    <div className="ctl-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
      />
      <span className="ctl-slider__value">
        {format ? format(value) : `${round(value)}${unit}`}
      </span>
    </div>
  )
}

const round = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 100) / 100)

export interface Choice<T extends string = string> {
  value: T
  label?: string
  icon?: IconName
  title?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: Choice<T>[]
}) {
  return (
    <div className="ctl-seg" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="ctl-seg__item"
          aria-pressed={value === option.value}
          title={option.title ?? option.label}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} /> : null}
          {option.label ? <span>{option.label}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: Choice<T>[]
}) {
  return (
    <select
      className="ctl-select"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label ?? option.value}
        </option>
      ))}
    </select>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  wide,
  type = 'text',
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  wide?: boolean
  type?: 'text' | 'url' | 'search'
}) {
  return (
    <input
      className={`ctl-input${wide ? ' ctl-input--wide' : ''}`}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      className="ctl-textarea"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
    />
  )
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <input
      className="ctl-input ctl-number"
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const next = Number(e.target.value)
        if (Number.isFinite(next)) onChange(next)
      }}
    />
  )
}

export function ColorInput({
  value,
  onChange,
  showHex = true,
}: {
  value: string
  onChange: (next: string) => void
  showHex?: boolean
}) {
  const id = useId()
  return (
    <div className="ctl-color">
      <label className="ctl-color__swatch" htmlFor={id}>
        <input
          id={id}
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {showHex ? (
        <input
          className="ctl-input ctl-color__hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : null}
    </div>
  )
}

/** `<input type="color">` only accepts `#rrggbb`. */
function normalizeHex(value: string): string {
  const v = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  if (/^#[0-9a-fA-F]{3}$/.test(v))
    return '#' + v.slice(1).split('').map((c) => c + c).join('')
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7)
  return '#000000'
}

export function Button({
  children,
  onClick,
  variant = 'default',
  icon,
  disabled,
  title,
  type = 'button',
}: {
  children?: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  icon?: IconName
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
}) {
  const modifier = variant === 'default' ? '' : ` ctl-btn--${variant}`
  const iconOnly = !children ? ' ctl-btn--icon' : ''
  return (
    <button
      type={type}
      className={`ctl-btn${modifier}${iconOnly}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={!children ? title : undefined}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  )
}
