import { useState } from 'react'
import { Icon } from '@/core/icons'
import { Button, TextInput } from '@/core/ui'
import type { FieldScope } from '@/features/settings-ui/FieldRenderer'
import {
  colorOf,
  forgetCalendar,
  normaliseUrl,
  probeCalendar,
  requestCalendarAccess,
  urlLabel,
  type CalendarSource,
} from './api'

// Subscription management, reading and writing through the field scope so the
// settings layer never has to know what a calendar is.
export function CalendarList({ scope }: { scope?: FieldScope }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sources = Array.isArray(scope?.values.sources)
    ? (scope.values.sources as CalendarSource[])
    : []
  const write = (next: CalendarSource[]) => scope?.write('sources', next)

  const add = async () => {
    const url = normaliseUrl(draft)
    if (!url) {
      setError('That does not look like a calendar address.')
      return
    }
    if (sources.some((source) => source.url === url)) {
      setError('That calendar is already here.')
      return
    }
    setBusy(true)
    if (!(await requestCalendarAccess(url))) {
      setBusy(false)
      setError(`Reading ${urlLabel(url)} needs permission for that site.`)
      return
    }
    // Named from the feed itself. A failed probe is not fatal — the URL may be
    // right and merely unreachable.
    const probed = await probeCalendar(url)
    setBusy(false)
    if (!probed) {
      setError('Could not read a calendar there. Check the address.')
      return
    }
    setError('')
    setDraft('')
    write([...sources, { url, name: probed.name, color: nextColor(sources) }])
  }

  const remove = (url: string) => {
    write(sources.filter((source) => source.url !== url))
    void forgetCalendar(url)
  }

  return (
    <div className="callist">
      {sources.map((source) => (
        <div className="callist__row" key={source.url}>
          <span className="callist__dot" style={{ background: colorOf(source.color) }} />
          <span title={source.url}>{source.name || urlLabel(source.url)}</span>
          <button
            type="button"
            className="is-icon-btn"
            onClick={() => remove(source.url)}
            title={`Remove ${source.name}`}
            aria-label={`Remove ${source.name}`}
          >
            <Icon name="remove" />
          </button>
        </div>
      ))}

      <div className="callist__add">
        <TextInput
          value={draft}
          onChange={setDraft}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          wide
          type="url"
        />
        <Button
          icon={busy ? 'spinner' : 'add'}
          onClick={() => void add()}
          disabled={busy}
          title="Add this calendar"
        />
      </div>

      {error ? (
        <p className="cal__error">
          <Icon name="warning" /> {error}
        </p>
      ) : (
        <p className="callist__help">
          In Google Calendar, open a calendar&apos;s settings and copy its{' '}
          <strong>secret address in iCal format</strong>. It stays up to date on its own; the
          address is read-only and can be reset from that same page.
        </p>
      )}
    </div>
  )
}

// First unused colour, so two calendars added in a row differ.
function nextColor(sources: CalendarSource[]): number {
  const taken = new Set(sources.map((source) => source.color))
  for (let index = 0; index < 8; index += 1) if (!taken.has(index)) return index
  return sources.length
}
