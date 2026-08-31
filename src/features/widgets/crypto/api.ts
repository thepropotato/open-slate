import { localStore, permissions } from '@/core/platform/browser'

// CoinGecko's public price endpoint: no API key, so no credential to embed in a
// published extension. Results are cached. Equities are absent because every
// free quote API requires a key.

export const CRYPTO_ORIGINS = ['https://api.coingecko.com/*']

const PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price'
const CACHE_KEY = 'cryptoCache'
const CACHE_TTL_MS = 3 * 60 * 1000

// A small, stable set, so no coin search UI is needed.
export const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
]

export const CURRENCIES = ['usd', 'eur', 'gbp', 'inr', 'jpy', 'aud', 'cad', 'chf', 'brl', 'zar']

export interface Quote {
  id: string
  symbol: string
  name: string
  price: number
  changePercent: number
}

interface CacheEntry {
  at: number
  quotes: Quote[]
}

export const hasCryptoAccess = (): Promise<boolean> => permissions.has([], CRYPTO_ORIGINS)

export const requestCryptoAccess = (): Promise<boolean> => permissions.request([], CRYPTO_ORIGINS)

export async function fetchQuotes(ids: string[], currency: string): Promise<Quote[] | null> {
  if (ids.length === 0) return []
  const cacheKey = `${ids.slice().sort().join(',')}:${currency}`
  const cache = (await localStore.get<Record<string, CacheEntry>>(CACHE_KEY)) ?? {}
  const hit = cache[cacheKey]
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.quotes

  const params = new URLSearchParams({
    ids: ids.join(','),
    vs_currencies: currency,
    include_24hr_change: 'true',
  })

  try {
    const response = await fetch(`${PRICE_URL}?${params}`)
    if (!response.ok) return hit?.quotes ?? null
    const data = (await response.json()) as Record<string, Record<string, number>>
    const quotes: Quote[] = ids
      .map((id) => {
        const entry = data[id]
        const coin = COINS.find((candidate) => candidate.id === id)
        if (!entry || !coin) return null
        return {
          id,
          symbol: coin.symbol,
          name: coin.name,
          price: entry[currency] ?? 0,
          changePercent: entry[`${currency}_24h_change`] ?? 0,
        }
      })
      .filter((quote): quote is Quote => quote !== null)

    await localStore.set(CACHE_KEY, { ...cache, [cacheKey]: { at: Date.now(), quotes } })
    return quotes
  } catch {
    // Offline, or the host permission was revoked; the widget labels staleness.
    return hit?.quotes ?? null
  }
}
