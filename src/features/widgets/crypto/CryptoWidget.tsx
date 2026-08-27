import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { Button } from '@/core/ui'
import { useSettings } from '@/core/settings/SettingsProvider'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { resolveLocale } from '@/core/util/time'
import { ListLoading } from '@/features/widgets/shared/ListShell'
import {
  COINS,
  CRYPTO_ORIGINS,
  CURRENCIES,
  fetchQuotes,
  hasCryptoAccess,
  requestCryptoAccess,
} from './api'
import './crypto.css'

const CryptoConfig = z.object({
  coins: z.array(z.string()).default(['bitcoin', 'ethereum']),
  currency: z.string().default('usd'),
  layout: z.enum(['rows', 'compact']).default('rows'),
  showChange: z.boolean().default(true),
  showName: z.boolean().default(true),
})

type CryptoConfig = z.infer<typeof CryptoConfig>

function CryptoWidget({ config }: WidgetProps<CryptoConfig>) {
  const { behavior } = useSettings()
  const locale = resolveLocale(behavior.locale)

  const granted = useAsyncValue('crypto-access', hasCryptoAccess)
  const quotes = useAsyncValue(
    granted ? `crypto:${config.coins.join(',')}:${config.currency}` : null,
    () => fetchQuotes(config.coins, config.currency),
  )

  if (granted === null) return <ListLoading />

  if (!granted) {
    return (
      <div className="crypto crypto--setup">
        <p>Prices come from CoinGecko, which needs access to {CRYPTO_ORIGINS[0]}.</p>
        <Button
          icon="check"
          onClick={() => void requestCryptoAccess().then(() => window.location.reload())}
        >
          Allow
        </Button>
      </div>
    )
  }

  if (!quotes) return <ListLoading />

  if (quotes.length === 0) {
    return (
      <div className="crypto crypto--setup">
        <p>No coins selected. Pick some in this widget&rsquo;s options.</p>
      </div>
    )
  }

  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: config.currency.toUpperCase(),
    // Small-value coins need more decimals than large ones to say anything.
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
  const smallMoney = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: config.currency.toUpperCase(),
    maximumSignificantDigits: 4,
  })

  return (
    <ul className="crypto scroll-y" data-layout={config.layout}>
      {quotes.map((quote) => {
        const up = quote.changePercent >= 0
        return (
          <li key={quote.id} className="crypto__row">
            <span className="crypto__symbol">{quote.symbol}</span>
            {config.showName && config.layout === 'rows' ? (
              <span className="crypto__name">{quote.name}</span>
            ) : null}
            <span className="crypto__price">
              {quote.price >= 1 ? money.format(quote.price) : smallMoney.format(quote.price)}
            </span>
            {config.showChange ? (
              <span className="crypto__change" data-up={up}>
                <Icon name={up ? 'chevronUp' : 'chevronDown'} />
                {Math.abs(quote.changePercent).toFixed(1)}%
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

registerWidget<CryptoConfig>({
  type: 'crypto',
  name: 'Crypto prices',
  description: 'Prices and 24-hour change from CoinGecko. No account needed.',
  icon: 'stocks',
  configSchema: CryptoConfig,
  sizes: ['small', 'medium', 'large'],
  defaultSize: 'medium',
  origins: CRYPTO_ORIGINS,
  Component: CryptoWidget,
  fields: [
    {
      label: 'Coins',
      control: {
        kind: 'custom',
        stacked: true,
        render: (scope) => {
          const selected = Array.isArray(scope?.values.coins) ? (scope.values.coins as string[]) : []
          return (
            <div className="crypto__picker">
              {COINS.map((coin) => {
                const on = selected.includes(coin.id)
                return (
                  <button
                    key={coin.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      scope?.write(
                        'coins',
                        on ? selected.filter((id) => id !== coin.id) : [...selected, coin.id],
                      )
                    }
                  >
                    {coin.symbol}
                  </button>
                )
              })}
            </div>
          )
        },
      },
      keywords: 'bitcoin ethereum coins',
    },
    {
      path: 'currency',
      label: 'Currency',
      control: {
        kind: 'select',
        options: CURRENCIES.map((code) => ({ value: code, label: code.toUpperCase() })),
      },
    },
    {
      path: 'layout',
      label: 'Layout',
      control: {
        kind: 'segmented',
        options: [
          { value: 'rows', label: 'Rows' },
          { value: 'compact', label: 'Compact' },
        ],
      },
    },
    { path: 'showChange', label: 'Show 24-hour change', control: { kind: 'toggle' } },
    {
      path: 'showName',
      label: 'Show the full name',
      control: { kind: 'toggle' },
      whenLocal: (c) => c.layout === 'rows',
    },
  ],
})
