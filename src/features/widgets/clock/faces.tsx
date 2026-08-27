import type { TimeParts } from '@/core/util/time'

/**
 * Clock faces.
 *
 * Hand-built rather than pulled from a library: the maintained analog-clock
 * packages offer one look each, and the point here is a range of looks that all
 * read from the same theme tokens. Every face sizes itself in container units,
 * so a face fills whatever the user resizes the widget to.
 */

export interface FaceProps {
  time: TimeParts
  showSeconds: boolean
  hour12: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

const digits = ({ time, hour12 }: FaceProps) => ({
  hours: pad(hour12 ? time.hours12 : time.hours24),
  minutes: pad(time.minutes),
  seconds: pad(time.seconds),
})

/* ------------------------------------------------------------------ digital */

export function DigitalFace(props: FaceProps) {
  const { hours, minutes, seconds } = digits(props)
  return (
    <div className="face face--digital">
      <span className="face__time">
        {hours}
        <span className="face__colon">:</span>
        {minutes}
        {props.showSeconds ? (
          <>
            <span className="face__colon face__colon--small">:</span>
            <span className="face__seconds">{seconds}</span>
          </>
        ) : null}
      </span>
      {props.hour12 ? <span className="face__meridiem">{props.time.meridiem}</span> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ minimal */

export function MinimalFace(props: FaceProps) {
  const { hours, minutes, seconds } = digits(props)
  return (
    <div className="face face--minimal">
      <span className="face__time">
        {props.hour12 ? String(props.time.hours12) : hours}:{minutes}
        {props.showSeconds ? <span className="face__seconds">:{seconds}</span> : null}
      </span>
      {props.hour12 ? <span className="face__meridiem">{props.time.meridiem}</span> : null}
    </div>
  )
}

/* --------------------------------------------------------------------- mono */

export function MonoFace(props: FaceProps) {
  const { hours, minutes, seconds } = digits(props)
  return (
    <div className="face face--mono">
      <span className="face__time">
        {hours}:{minutes}
        {props.showSeconds ? `:${seconds}` : ''}
        {props.hour12 ? <span className="face__meridiem">{props.time.meridiem}</span> : null}
      </span>
    </div>
  )
}

/* --------------------------------------------------------------------- flip */

export function FlipFace(props: FaceProps) {
  const { hours, minutes, seconds } = digits(props)
  return (
    <div className="face face--flip">
      <FlipCard value={hours} />
      <span className="face__colon">:</span>
      <FlipCard value={minutes} />
      {props.showSeconds ? (
        <>
          <span className="face__colon">:</span>
          <FlipCard value={seconds} small />
        </>
      ) : null}
      {props.hour12 ? <span className="face__meridiem">{props.time.meridiem}</span> : null}
    </div>
  )
}

function FlipCard({ value, small = false }: { value: string; small?: boolean }) {
  return (
    // Keying on the value restarts the flip animation whenever it changes.
    <span key={value} className="flip" data-small={small}>
      <span className="flip__value">{value}</span>
      <span className="flip__seam" />
    </span>
  )
}

/* --------------------------------------------------------------------- text */

const ONES = [
  'twelve', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
]

/** "It is quarter past nine" — the phrasing people actually use out loud. */
export function TextFace({ time }: FaceProps) {
  const minute = time.minutes
  const nearest = Math.round(minute / 5) * 5
  const hourIndex = (nearest > 30 ? time.hours12 % 12 : time.hours12 % 12)
  const spokenHour = ONES[nearest > 30 ? (hourIndex + 1) % 12 : hourIndex]

  const phrase =
    nearest === 0 || nearest === 60
      ? `${ONES[nearest === 60 ? (hourIndex + 1) % 12 : hourIndex]} o'clock`
      : nearest === 30
        ? `half past ${ONES[hourIndex]}`
        : nearest === 15
          ? `quarter past ${ONES[hourIndex]}`
          : nearest === 45
            ? `quarter to ${spokenHour}`
            : nearest < 30
              ? `${nearest} past ${ONES[hourIndex]}`
              : `${60 - nearest} to ${spokenHour}`

  return (
    <div className="face face--text">
      <span className="face__phrase">{phrase}</span>
    </div>
  )
}

/* ------------------------------------------------------------------- binary */

/** Binary-coded decimal, one column per digit — the classic hacker clock. */
export function BinaryFace(props: FaceProps) {
  const { hours, minutes, seconds } = digits(props)
  const columns = [...hours, ...minutes, ...(props.showSeconds ? [...seconds] : [])].map(Number)

  return (
    <div className="face face--binary">
      {columns.map((value, index) => (
        <span className="binary__col" key={index}>
          {[8, 4, 2, 1].map((bit) => (
            <span
              key={bit}
              className="binary__dot"
              data-on={(value & bit) !== 0}
              // A leading digit can never reach 8, so that lamp is never wired.
              data-dead={bit > maxForColumn(index, props.showSeconds)}
            />
          ))}
        </span>
      ))}
    </div>
  )
}

function maxForColumn(index: number, showSeconds: boolean): number {
  const pattern = showSeconds ? [2, 9, 5, 9, 5, 9] : [2, 9, 5, 9]
  return pattern[index] ?? 9
}

/* ------------------------------------------------------------------- analog */

type AnalogVariant = 'classic' | 'minimal' | 'bauhaus'

export function AnalogFace({
  time,
  showSeconds,
  variant,
}: FaceProps & { variant: AnalogVariant }) {
  // Smooth, not stepped: the hour hand should sit between marks at half past.
  const secondAngle = time.seconds * 6
  const minuteAngle = time.minutes * 6 + time.seconds * 0.1
  const hourAngle = (time.hours24 % 12) * 30 + time.minutes * 0.5

  return (
    <div className="face face--analog" data-variant={variant}>
      <svg viewBox="-50 -50 100 100" className="analog">
        {variant === 'bauhaus' ? (
          <circle className="analog__dial" r="46" />
        ) : (
          <circle className="analog__rim" r="46" />
        )}

        {variant !== 'minimal'
          ? Array.from({ length: variant === 'classic' ? 60 : 12 }, (_, i) => {
              const major = i % 5 === 0 || variant === 'bauhaus'
              const angle = (i * (variant === 'classic' ? 6 : 30) * Math.PI) / 180
              const outer = 42
              const inner = major ? 34 : 39
              return (
                <line
                  key={i}
                  className="analog__tick"
                  data-major={major}
                  x1={Math.sin(angle) * inner}
                  y1={-Math.cos(angle) * inner}
                  x2={Math.sin(angle) * outer}
                  y2={-Math.cos(angle) * outer}
                />
              )
            })
          : Array.from({ length: 4 }, (_, i) => {
              const angle = (i * 90 * Math.PI) / 180
              return (
                <line
                  key={i}
                  className="analog__tick"
                  data-major
                  x1={Math.sin(angle) * 36}
                  y1={-Math.cos(angle) * 36}
                  x2={Math.sin(angle) * 42}
                  y2={-Math.cos(angle) * 42}
                />
              )
            })}

        <line
          className="analog__hand analog__hand--hour"
          y2={-22}
          transform={`rotate(${hourAngle})`}
        />
        <line
          className="analog__hand analog__hand--minute"
          y2={-33}
          transform={`rotate(${minuteAngle})`}
        />
        {showSeconds ? (
          <line
            className="analog__hand analog__hand--second"
            y1={7}
            y2={-36}
            transform={`rotate(${secondAngle})`}
          />
        ) : null}
        <circle className="analog__pin" r={variant === 'bauhaus' ? 3.4 : 2.2} />
      </svg>
    </div>
  )
}

/* -------------------------------------------------------------------- rings */

/** Three concentric arcs filling as the hour, minute and second progress. */
export function RingsFace({ time, showSeconds, hour12 }: FaceProps) {
  const rings = [
    { r: 44, value: (time.hours24 % (hour12 ? 12 : 24)) / (hour12 ? 12 : 24), label: 'hour' },
    { r: 34, value: time.minutes / 60, label: 'minute' },
    ...(showSeconds ? [{ r: 24, value: time.seconds / 60, label: 'second' }] : []),
  ]

  return (
    <div className="face face--rings">
      <svg viewBox="-50 -50 100 100" className="rings">
        {rings.map((ring) => {
          const circumference = 2 * Math.PI * ring.r
          return (
            <g key={ring.label} data-ring={ring.label}>
              <circle className="rings__track" r={ring.r} />
              <circle
                className="rings__value"
                r={ring.r}
                strokeDasharray={`${circumference * ring.value} ${circumference}`}
                transform="rotate(-90)"
              />
            </g>
          )
        })}
        <text className="rings__label" y="4">
          {pad(hour12 ? time.hours12 : time.hours24)}:{pad(time.minutes)}
        </text>
      </svg>
    </div>
  )
}
