import { useState } from 'react'
import { Icon } from '@/core/icons'
import { Button, TextInput } from '@/core/ui'
import { hostLabel } from '@/features/search/providers'
import type { FieldScope } from '@/features/settings-ui/FieldRenderer'
import { originOf, requestFeedAccess } from './api'

// Feed list editor for the widget's options dialog. Reads and writes through the
// field scope, so the settings layer needs to know nothing about feeds.
export function FeedList({ scope }: { scope?: FieldScope }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const urls = Array.isArray(scope?.values.urls) ? (scope.values.urls as string[]) : []
  const write = (next: string[]) => scope?.write('urls', next)

  const add = async () => {
    const value = draft.trim()
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`
    if (!value || !originOf(url)) {
      setError('That does not look like a feed address.')
      return
    }
    if (urls.includes(url)) {
      setError('That feed is already here.')
      return
    }
    if (!(await requestFeedAccess(url))) {
      setError(`Reading ${hostLabel(url)} needs permission for that site.`)
      return
    }
    setError('')
    setDraft('')
    write([...urls, url])
  }

  return (
    <div className="feedlist">
      {urls.map((url) => (
        <div className="feedlist__row" key={url}>
          <span title={url}>{hostLabel(url)}</span>
          <button
            type="button"
            className="is-icon-btn"
            onClick={() => write(urls.filter((candidate) => candidate !== url))}
            title={`Remove ${hostLabel(url)}`}
            aria-label={`Remove ${hostLabel(url)}`}
          >
            <Icon name="remove" />
          </button>
        </div>
      ))}

      <div className="feedlist__add">
        <TextInput
          value={draft}
          onChange={setDraft}
          placeholder="https://example.com/feed.xml"
          wide
          type="url"
        />
        <Button icon="add" onClick={() => void add()} title="Add this feed" />
      </div>

      {error ? (
        <p className="feed__error">
          <Icon name="warning" /> {error}
        </p>
      ) : null}
    </div>
  )
}
