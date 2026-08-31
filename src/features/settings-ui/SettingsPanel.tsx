import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/core/icons'
import { Button, TextInput } from '@/core/ui'
import { useDraftSettings } from '@/core/settings/SettingsProvider'
import { FieldRenderer } from './FieldRenderer'
import { SaveBar } from './SaveBar'
import { SettingsPreview } from './SettingsPreview'
import { sections as allSections } from './sections'
import type { Field, Section } from './types'
import { validateSpecPaths } from './validate'
import './SettingsPanel.css'

// Renders the declared settings spec. The only settings surface: the new tab
// navigates here rather than sliding a narrower second copy over the page.
export function SettingsPanel({
  sections = allSections,
  onClose,
  footer,
  preview = true,
}: {
  sections?: Section[]
  onClose?: () => void
  footer?: React.ReactNode
  /** Shows the live preview column. Dropped on a narrow window by the stylesheet. */
  preview?: boolean
}) {
  const settings = useDraftSettings()
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const problems = validateSpecPaths(sections)
    if (problems.length) console.error('[settings spec]\n' + problems.join('\n'))
  }, [sections])

  const searching = query.trim().length > 1
  const needle = query.trim().toLowerCase()

  const matches = (field: Field, section: Section) =>
    [field.label, field.help, field.keywords, field.path, section.label]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)

  const visible = useMemo(() => {
    const source = searching ? sections : sections.filter((s) => s.id === activeId)
    return source
      .map((section) => ({
        ...section,
        groups: section.groups
          .filter((group) => !group.when || group.when(settings))
          .map((group) => ({
            ...group,
            fields: searching ? group.fields.filter((f) => matches(f, section)) : group.fields,
          }))
          .filter((group) => group.fields.length > 0),
      }))
      .filter((section) => section.groups.length > 0)
    // `matches` closes over `needle`, which is derived from `query`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, activeId, searching, needle, settings])

  return (
    // The wrapper reports its width to the container queries below; a container
    // query never styles its own container.
    <div className="settings-shell">
      {/* Above the columns, not inside one: the close button must not move as
          the preview appears or the window narrows. */}
      <header className="settings__header">
        <h1 className="settings__apptitle">Settings</h1>
        {onClose ? (
          <Button icon="close" title="Back to new tab" variant="ghost" onClick={onClose} />
        ) : null}
      </header>

    <div className="settings" data-preview={preview}>
      <aside className="settings__nav">
        <div className="settings__search">
          <Icon name="search" />
          <TextInput value={query} onChange={setQuery} placeholder="Search settings" wide />
        </div>
        <nav>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className="settings__navitem"
              aria-current={!searching && section.id === activeId}
              onClick={() => {
                setQuery('')
                setActiveId(section.id)
              }}
            >
              <Icon name={section.icon} />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
        {footer ? <div className="settings__navfooter">{footer}</div> : null}

        {/* Below the nav, so a change made anywhere can be saved without
            hunting for its section. */}
        <SaveBar />
      </aside>

      {/* Between the nav and the controls, so a control borders the thing it
          changes rather than sitting a whole column away from it. */}
      {preview ? <SettingsPreview /> : null}

      <div className="settings__body scroll-y">
        {visible.length === 0 ? (
          <p className="settings__empty">No settings match “{query}”.</p>
        ) : null}

        {visible.map((section) => (
          <section key={section.id} className="settings__section">
            {searching ? <h2 className="settings__sectiontitle">{section.label}</h2> : null}
            {section.groups.map((group) => (
              <div key={group.id} className="settings__group">
                {group.label ? <h3 className="settings__grouptitle">{group.label}</h3> : null}
                {group.help ? <p className="settings__grouphelp">{group.help}</p> : null}
                <div className="settings__fields">
                  {group.fields.map((field, index) => (
                    <FieldRenderer key={field.path ?? `${group.id}-${index}`} field={field} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
    </div>
  )
}
