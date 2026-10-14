import { useSetting } from '@/core/settings/SettingsProvider'
import { Select } from '@/core/ui'

type Band = 'widgets' | 'search' | 'tiles'

/** Which of the two bands sits first on a single page; search always leads. */
export function BandOrder() {
  const [order, setOrder] = useSetting<Band[]>('layout.order')
  const first = order.find((band) => band !== 'search') === 'widgets' ? 'widgets' : 'tiles'
  return (
    <Select
      value={first}
      onChange={(next) => setOrder(['search', next, next === 'widgets' ? 'tiles' : 'widgets'])}
      options={[
        { value: 'tiles', label: 'Tiles first' },
        { value: 'widgets', label: 'Widgets first' },
      ]}
    />
  )
}
