import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/core/icons'
import { BrandMark } from './BrandMark'
import type { WidgetSizeName } from '@/core/widgets/types'
import {
  hasAccess,
  hasNumbers,
  readCache,
  refreshUsage,
  requestAccess,
  type CachedUsage,
  type ProviderAdapter,
  type ProviderSpend,
  type ProviderWindow,
} from './api'
import './llm.css'

// The body of a provider's usage widget: connect prompt, meters, refresh. Shared,
// since every provider renders the same way once normalised.

type Phase = 'checking' | 'needs-access' | 'ready'

export function UsagePanel({
  provider,
  sizeName = 'medium',
}: {
  provider: ProviderAdapter
  sizeName?: WidgetSizeName
}) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [cache, setCache] = useState<CachedUsage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      const granted = await hasAccess(provider)
      if (!live) return
      setPhase(granted ? 'ready' : 'needs-access')
      if (granted) setCache((await readCache(provider.id)) ?? null)
    })()
    return () => {
      live = false
    }
  }, [provider])

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setCache(await refreshUsage(provider.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read usage.')
    } finally {
      setBusy(false)
    }
  }, [provider.id])

  const grant = useCallback(async () => {
    const ok = await requestAccess(provider)
    if (!ok) return
    setPhase('ready')
    setCache((await readCache(provider.id)) ?? null)
    void refresh()
  }, [provider, refresh])

  return (
    <div className="usage" data-size={sizeName}>
      <header className="usage__head">
        <span className="usage__title">
          <span className="usage__badge" style={{ background: provider.tint }}>
            <BrandMark
              name={provider.badge}
              className={`usage__mark usage__mark--${provider.badge}`}
            />
          </span>
          {provider.label}
        </span>
        {phase === 'ready' ? (
          <button
            className="usage__refresh is-icon-btn"
            onClick={() => void refresh()}
            disabled={busy}
            title={`Refresh ${provider.label}`}
          >
            <Icon name={busy ? 'spinner' : 'reset'} spin={busy} />
          </button>
        ) : null}
      </header>

      <PanelBody
        provider={provider}
        phase={phase}
        cache={cache}
        busy={busy}
        error={error}
        sizeName={sizeName}
        onConnect={() => void grant()}
        onRefresh={() => void refresh()}
      />
    </div>
  )
}

function PanelBody({
  provider,
  phase,
  cache,
  busy,
  error,
  sizeName,
  onConnect,
  onRefresh,
}: {
  provider: ProviderAdapter
  phase: Phase
  cache: CachedUsage | null
  busy: boolean
  error: string | null
  sizeName: WidgetSizeName
  onConnect: () => void
  onRefresh: () => void
}) {
  if (phase === 'checking') {
    return (
      <div className="usage__body usage__body--center">
        <Icon name="spinner" spin />
      </div>
    )
  }

  if (phase === 'needs-access') {
    return (
      <div className="usage__body">
        <button className="usage__connect" onClick={onConnect}>
          <Icon name="link" /> Connect {provider.host}
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="usage__body">
        <p className="usage__error">{error}</p>
      </div>
    )
  }

  if (!cache) {
    return (
      <div className="usage__body">
        <button className="usage__connect" onClick={onRefresh} disabled={busy}>
          <Icon name={busy ? 'spinner' : 'reset'} spin={busy} /> Read usage
        </button>
      </div>
    )
  }

  if (!hasNumbers(cache.usage)) {
    return (
      <div className="usage__body">
        <p className="usage__note">No usage reported for this account.</p>
      </div>
    )
  }

  const meters = [
    ...(cache.usage.spend ? [{ kind: 'spend' as const, spend: cache.usage.spend }] : []),
    ...cache.usage.windows.map((w) => ({ kind: 'window' as const, window: w })),
  ]
  const compact = sizeName === 'small'

  // Height limits how many meters fit, and `small` and `medium` are both one
  // cell tall; a one-cell tile shows one meter and counts the rest in the footer.
  const oneCellTall = sizeName === 'small' || sizeName === 'medium'
  const shown = oneCellTall ? meters.slice(0, 1) : meters
  const hidden = meters.length - shown.length

  // The closest to its limit is the one worth showing.
  if (oneCellTall && meters.length > 1) {
    const severity = (m: (typeof meters)[number]) =>
      m.kind === 'spend' ? (m.spend.limit > 0 ? (m.spend.used / m.spend.limit) * 100 : 0) : m.window.percent
    shown[0] = [...meters].sort((a, b) => severity(b) - severity(a))[0]
  }

  return (
    <div className="usage__body" data-count={shown.length}>
      {shown.map((m) =>
        m.kind === 'spend' ? (
          <SpendMeter
            key="spend"
            spend={m.spend}
            stamp={ago(cache.at)}
            compact={compact}
            more={hidden}
          />
        ) : (
          <Meter
            key={m.window.label}
            window={m.window}
            stamp={ago(cache.at)}
            compact={compact}
            more={hidden}
          />
        ),
      )}
    </div>
  )
}

// Older engines throw a RangeError for `currencyDisplay: 'narrowSymbol'`, which
// would take the whole tile down; probed once rather than guarded per call.
const NARROW_SYMBOL = (() => {
  try {
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'narrowSymbol',
    })
    return true
  } catch {
    return false
  }
})()

function levelFor(pct: number): string {
  return pct >= 90 ? 'high' : pct >= 70 ? 'mid' : 'low'
}

// Dollars are the headline; the percentage is carried by the bar.
function SpendMeter({
  spend,
  stamp,
  compact,
  more,
}: {
  spend: ProviderSpend
  stamp: string
  compact: boolean
  more: number
}) {
  const money = (value: number, cents: boolean) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: spend.currency,
      // Plain "$", not "US$": outside en-US the default disambiguates USD, which
      // the tile does not need - the currency is repeated in the denominator.
      ...(NARROW_SYMBOL ? { currencyDisplay: 'narrowSymbol' as const } : {}),
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    }).format(value)

  const pct =
    spend.limit > 0 ? Math.min(100, Math.max(0, Math.round((spend.used / spend.limit) * 100))) : 0

  // Rounded down past $100 so the spend is never overstated; below that the
  // cents stay.
  const big = spend.used >= 100
  const used = big ? money(Math.floor(spend.used), false) : money(spend.used, spend.used % 1 !== 0)

  // Splits the symbol out so it can be set smaller than the digits. Uses
  // `formatToParts`, since the symbol does not always lead (de-DE: "414 $").
  const parts = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: spend.currency,
    ...(NARROW_SYMBOL ? { currencyDisplay: 'narrowSymbol' as const } : {}),
    minimumFractionDigits: big ? 0 : spend.used % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: big ? 0 : spend.used % 1 !== 0 ? 2 : 0,
  }).formatToParts(big ? Math.floor(spend.used) : spend.used)

  return (
    <div className="usage__meter">
      <div className="usage__value">
        <span className="usage__figure" title={used}>
          {parts.map((p, i) =>
            p.type === 'currency' ? (
              <span key={i} className="usage__unit">
                {p.value}
              </span>
            ) : (
              p.value
            ),
          )}
        </span>
        <span className="usage__of">of {money(spend.limit, spend.limit % 1 !== 0)}</span>
      </div>
      <div className="usage__track">
        <div className="usage__fill" data-level={levelFor(pct)} style={{ width: `${pct}%` }} />
      </div>
      <Foot
        resetsAt={spend.resetsAt}
        stamp={stamp}
        lead={`${pct}% used`}
        compact={compact}
        more={more}
      />
    </div>
  )
}

function Meter({
  window: w,
  stamp,
  compact,
  more,
}: {
  window: ProviderWindow
  stamp: string
  compact: boolean
  more: number
}) {
  const pct = Math.min(100, Math.max(0, Math.round(w.percent)))
  return (
    <div className="usage__meter">
      <div className="usage__value">
        <span className="usage__figure">
          {pct}
          <span className="usage__unit">%</span>
        </span>
        <span className="usage__of">{w.label}</span>
      </div>
      <div className="usage__track">
        <div className="usage__fill" data-level={levelFor(pct)} style={{ width: `${pct}%` }} />
      </div>
      <Foot resetsAt={w.resetsAt} stamp={stamp} compact={compact} more={more} />
    </div>
  )
}

// `lead` is the percentage for a spend meter, whose headline is in dollars; a
// window meter already leads with its percentage and passes none.
function Foot({
  resetsAt,
  stamp,
  lead,
  compact,
  more,
}: {
  resetsAt: string | null
  stamp: string
  lead?: string
  compact: boolean
  more: number
}) {
  const reset = resetsAt ? `Resets ${resetLabel(resetsAt)}` : null
  // A 1x1 tile fits only one, so keep whichever the headline doesn't already say.
  const parts = compact ? [lead ?? reset] : [lead, reset]
  const left = parts.filter(Boolean).join(' \u00b7 ')

  return (
    <div className="usage__foot">
      <span className="usage__reset">{left}</span>
      {/* A short tile says what it withheld rather than looking complete. */}
      {more > 0 ? <span className="usage__more">+{more} more</span> : null}
      <span className="usage__stamp">{stamp}</span>
    </div>
  )
}

function ago(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function resetLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'now'
  const h = Math.round(ms / 3.6e6)
  if (h < 1) return `in ${Math.max(1, Math.round(ms / 6e4))}m`
  if (h < 48) return `in ${h}h`
  return `in ${Math.round(h / 24)}d`
}
