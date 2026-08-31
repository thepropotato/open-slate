import { useState } from 'react'
import { Icon } from '@/core/icons'
import { Button, Modal, TextInput } from '@/core/ui'
import { allWidgets } from '@/core/widgets/registry'
import type { AnyWidgetDefinition } from '@/core/widgets/types'
import { permissions } from '@/core/platform/browser'
import './WidgetPicker.css'

// Widget gallery. Optional permissions are requested when a widget is added,
// not at install, so the extension asks only for what's actually used.
export function WidgetPicker({
  onAdd,
  onClose,
}: {
  onAdd: (definition: AnyWidgetDefinition) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [denied, setDenied] = useState<string | null>(null)

  const needle = query.trim().toLowerCase()
  const items = allWidgets().filter(
    (w) =>
      !needle ||
      w.name.toLowerCase().includes(needle) ||
      w.description.toLowerCase().includes(needle),
  )

  const add = async (definition: AnyWidgetDefinition) => {
    const needs = definition.permissions ?? []
    const origins = definition.origins ?? []
    if (needs.length > 0 || origins.length > 0) {
      const granted =
        (await permissions.has(needs, origins)) || (await permissions.request(needs, origins))
      if (!granted) {
        setDenied(definition.name)
        return
      }
    }
    onAdd(definition)
  }

  return (
    <Modal title="Add a widget" width={680} onClose={onClose}>
      <div className="picker">
        <TextInput value={query} onChange={setQuery} placeholder="Search widgets" wide type="search" />

        {denied ? (
          <p className="picker__denied">
            <Icon name="warning" /> {denied} needs browser access that was declined. It can be
            added once that permission is granted.
          </p>
        ) : null}

        <ul className="picker__grid">
          {items.map((definition) => (
            <li key={definition.type}>
              <button type="button" className="picker__item" onClick={() => void add(definition)}>
                <span className="picker__icon">
                  <Icon name={definition.icon} />
                </span>
                <span className="picker__text">
                  <span className="picker__name">{definition.name}</span>
                  <span className="picker__desc">{definition.description}</span>
                </span>
                {definition.permissions?.length ? (
                  <span className="picker__perm" title="Asks for browser access when added">
                    <Icon name="lock" />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        {items.length === 0 ? <p className="picker__empty">No widget matches that.</p> : null}

        <div className="picker__foot">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
