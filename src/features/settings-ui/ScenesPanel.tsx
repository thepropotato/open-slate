import { useEffect, useState } from 'react'
import { Button, TextInput } from '@/core/ui'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { applySlate } from '@/core/settings/slateCode'
import {
  listScenes,
  saveScenes,
  sceneFromSettings,
  setSceneCursor,
  type Scene,
} from '@/core/settings/scenes'
import { getWidget } from '@/core/widgets/registry'
import { uid } from '@/core/util/id'
import './ScenesPanel.css'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Save the current layout under a name, switch between saved ones, and schedule them. */
export function ScenesPanel() {
  const settings = useSettings()
  const { replace } = useSettingsActions()
  const [name, setName] = useState('')
  const [loaded, setLoaded] = useState<Scene[] | null>(null)

  useEffect(() => {
    let alive = true
    void listScenes().then((list) => alive && setLoaded(list))
    return () => {
      alive = false
    }
  }, [])

  if (!loaded) return null

  // Shown straight away, saved behind it, so a control never blinks while storage answers.
  const persist = async (next: Scene[]) => {
    setLoaded(next)
    await saveScenes(next)
  }

  const patch = (id: string, change: Partial<Scene>) =>
    persist(loaded.map((scene) => (scene.id === id ? { ...scene, ...change } : scene)))

  return (
    <div className="scenes">
      <form
        className="scenes__add"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          void persist([...loaded, sceneFromSettings(settings, name)])
          setName('')
        }}
      >
        <TextInput value={name} onChange={setName} placeholder="Name this layout, such as Work" wide />
        <Button type="submit" icon="add" disabled={!name.trim()}>
          Save current layout
        </Button>
      </form>

      {loaded.length === 0 ? (
        <p className="scenes__empty">Arrange the page how you like it, then save it here to switch back any time.</p>
      ) : (
        <ul className="scenes__list">
          {loaded.map((scene) => {
            const schedule = scene.schedule
            return (
              <li key={scene.id} className="scenes__item">
                <div className="scenes__row">
                  <strong>{scene.name}</strong>
                  <div className="scenes__actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        replace(applySlate(settings, scene.code, uid, (type) => getWidget(type) !== undefined))
                        void setSceneCursor(scene.id)
                      }}
                    >
                      Switch to
                    </Button>
                    <Button variant="ghost" icon="remove" title={`Delete ${scene.name}`} onClick={() => void persist(loaded.filter((s) => s.id !== scene.id))} />
                  </div>
                </div>

                <label className="scenes__toggle">
                  <input
                    type="checkbox"
                    checked={schedule !== null}
                    onChange={(event) =>
                      void patch(scene.id, {
                        schedule: event.target.checked ? { days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' } : null,
                      })
                    }
                  />
                  Use automatically
                </label>

                {schedule ? (
                  <div className="scenes__schedule">
                    <div className="scenes__days" role="group" aria-label="Days">
                      {DAYS.map((label, day) => (
                        <button
                          key={DAY_NAMES[day]}
                          type="button"
                          title={DAY_NAMES[day]}
                          aria-pressed={schedule.days.includes(day)}
                          onClick={() =>
                            void patch(scene.id, {
                              schedule: {
                                ...schedule,
                                days: schedule.days.includes(day)
                                  ? schedule.days.filter((d) => d !== day)
                                  : [...schedule.days, day].sort(),
                              },
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="scenes__times">
                      <input
                        className="ctl-input"
                        type="time"
                        aria-label="From"
                        value={schedule.from}
                        onChange={(event) => void patch(scene.id, { schedule: { ...schedule, from: event.target.value } })}
                      />
                      <span>to</span>
                      <input
                        className="ctl-input"
                        type="time"
                        aria-label="To"
                        value={schedule.to}
                        onChange={(event) => void patch(scene.id, { schedule: { ...schedule, to: event.target.value } })}
                      />
                    </div>
                    <p className="scenes__note">Applied when you open a new tab inside this window.</p>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
