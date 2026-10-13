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
import '@/styles/ui-font.css'
import './SettingsPanel.css'

// The drawer groups the nine sections into five tabs.
const TABS = [
  { id: 'looks', label: 'Looks', sections: ['appearance', 'background'] },
  { id: 'layout', label: 'Layout', sections: ['layout'] },
  { id: 'content', label: 'Content', sections: ['tiles', 'widgets', 'slates'] },
  { id: 'search', label: 'Search', sections: ['search'] },
  { id: 'more', label: 'More', sections: ['behavior', 'data'] },
] as const

// Renders the declared settings spec. The only settings surface: the new tab
// navigates here rather than sliding a narrower second copy over the page.
export function SettingsPanel({
  sections = allSections,
  initialSection,
  onClose,
  footer,
  preview = true,
  layout = 'page',
}: {
  sections?: Section[]
  initialSection?: string
  onClose?: () => void
  footer?: React.ReactNode
  /** Shows the live preview column. Dropped on a narrow window by the stylesheet. */
  preview?: boolean
  /** `drawer` is the narrow panel beside the live page: tabs on top, no preview. */
  layout?: 'page' | 'drawer'
}) {
  const settings = useDraftSettings()
  const [activeId, setActiveId] = useState(
    () => (initialSection && sections.some((s) => s.id === initialSection) ? initialSection : sections[0]?.id ?? ''),
  )
  const [query, setQuery] = useState('')
  const drawer = layout === 'drawer'
  const [barHeight, setBarHeight] = useState(0)
  const [subId, setSubId] = useState(initialSection ?? '')
  const [tabId, setTabId] = useState<string>(
    () => TABS.find((tab) => (tab.sections as readonly string[]).includes(initialSection ?? ''))?.id ?? 'looks',
  )

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

  // A tab holding several sections shows one at a time, chosen by the pills beneath the tabs.
  const tabSections = sections.filter((s) =>
    ((TABS.find((tab) => tab.id === tabId)?.sections ?? []) as readonly string[]).includes(s.id),
  )
  const activeSubId = tabSections.some((s) => s.id === subId) ? subId : (tabSections[0]?.id ?? '')

  const visible = useMemo(() => {
    const source = searching
      ? sections
      : drawer
        ? sections.filter((s) => s.id === activeSubId)
        : sections.filter((s) => s.id === activeId)
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
  }, [sections, activeId, activeSubId, drawer, searching, needle, settings])

  const renderBody = () => (
      <div className="settings__body scroll-y">
      {visible.length === 0 ? (
        <p className="settings__empty">No settings match “{query}”.</p>
      ) : null}

      {visible.map((section) => (
        <section key={section.id} className="settings__section">
          {searching ? <h2 className="settings__sectiontitle">{section.label}</h2> : null}
          {section.groups.map((group, index) => (
            <GroupBlock
              key={group.id}
              label={group.label}
              help={group.help}
              collapsible={drawer && !searching}
              // Long sections open on their first four groups; the rest are one click away.
              defaultOpen={index < 4 || section.groups.length <= 5}
            >
              <div className="settings__fields">
                {group.fields.map((field, fieldIndex) => (
                  <FieldRenderer key={field.path ?? `${group.id}-${fieldIndex}`} field={field} />
                ))}
              </div>
            </GroupBlock>
          ))}
        </section>
      ))}
    </div>
  )

  if (drawer) {
    return (
      <div className="settings-drawer" style={{ '--savebar-h': `${barHeight}px` } as React.CSSProperties}>
        <header className="drawer__head">
          <div className="drawer__title">
            <h1>Customise</h1>
            {onClose ? <Button icon="close" title="Close" variant="ghost" onClick={onClose} /> : null}
          </div>
          <div className="settings__search">
            <Icon name="search" />
            <TextInput value={query} onChange={setQuery} placeholder="Search settings" wide />
          </div>
        </header>
        {searching ? null : (
          <nav className="drawer__tabs" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="drawer__tab"
                aria-current={tab.id === tabId}
                onClick={() => {
                  setTabId(tab.id)
                  setSubId('')
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
        {searching || tabSections.length < 2 ? null : (
          <div className="drawer__subtabs">
            <div className="drawer__switch" role="tablist" aria-label="Section">
              {tabSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  className="drawer__switchitem"
                  aria-selected={section.id === activeSubId}
                  onClick={() => setSubId(section.id)}
                >
                  <Icon name={section.icon} />
                  <span>{section.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {renderBody()}
        <SaveBar onSize={setBarHeight} />
      </div>
    )
  }

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

      {renderBody()}
    </div>
    </div>
  )
}

/** A titled group of settings. In the drawer it folds, so a long section reads as a short list of headings. */
function GroupBlock({
  label,
  help,
  collapsible,
  defaultOpen,
  children,
}: {
  label?: string
  help?: string
  collapsible: boolean
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const shown = !collapsible || open || !label

  return (
    <div className="settings__group" data-open={shown}>
      {label ? (
        collapsible ? (
          <button type="button" className="settings__grouphead" aria-expanded={shown} onClick={() => setOpen((current) => !current)}>
            <span className="settings__grouptitle">{label}</span>
            <Icon name="chevronDown" className="settings__chev" />
          </button>
        ) : (
          <h3 className="settings__grouptitle">{label}</h3>
        )
      ) : null}
      {shown ? (
        <>
          {help ? <p className="settings__grouphelp">{help}</p> : null}
          {children}
        </>
      ) : null}
    </div>
  )
}
