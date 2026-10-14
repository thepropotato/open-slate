import { useState } from 'react'
import { Button, Select, TextInput } from '@/core/ui'
import { useSetting } from '@/core/settings/SettingsProvider'
import { fontOptions, googleFontId, googleFontName, parseGoogleFont } from '@/core/theme/fonts'
import { loadGoogleFont } from '@/core/theme/googleFonts'
import './FontPicker.css'

/** Bundled fonts, any Google fonts added by the user, and a field to add another. */
export function FontPicker() {
  const [family, setFamily] = useSetting<string>('appearance.fontFamily')
  const [custom, setCustom] = useSetting<string[]>('appearance.customFonts')
  const [input, setInput] = useState('')
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'bad'; text?: string }>({ kind: 'idle' })

  const options = [
    ...fontOptions.map((font) => ({ value: font.id, label: font.label })),
    ...custom.map((name) => ({ value: googleFontId(name), label: name })),
  ]
  const using = googleFontName(family)

  const add = async () => {
    const name = parseGoogleFont(input)
    if (!name) {
      setState({ kind: 'bad', text: 'Paste a Google Fonts link, or type a font name such as Space Mono.' })
      return
    }
    setState({ kind: 'busy' })
    if (!(await loadGoogleFont(name))) {
      setState({ kind: 'bad', text: `Google Fonts did not return "${name}". Check the spelling, or your connection.` })
      return
    }
    if (!custom.includes(name)) setCustom([...custom, name])
    setFamily(googleFontId(name))
    setInput('')
    setState({ kind: 'idle' })
  }

  const remove = (name: string) => {
    setCustom(custom.filter((entry) => entry !== name))
    if (using === name) setFamily('system')
  }

  return (
    <div className="fontpicker">
      <Select value={family} onChange={setFamily} options={options} />

      <form
        className="fontpicker__add"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <TextInput value={input} onChange={setInput} placeholder="Add from Google Fonts: link or name" wide />
        <Button type="submit" icon="add" disabled={state.kind === 'busy' || !input.trim()}>
          {state.kind === 'busy' ? 'Adding' : 'Add'}
        </Button>
      </form>
      {state.kind === 'bad' ? <p className="fontpicker__bad">{state.text}</p> : null}
      <p className="fontpicker__note">
        An added font is fetched from Google Fonts when you add it and whenever it is in use, and kept
        by the browser. The fonts above it never leave your device.
      </p>

      {custom.length > 0 ? (
        <ul className="fontpicker__list">
          {custom.map((name) => (
            <li key={name}>
              <span>{name}</span>
              <Button variant="ghost" icon="remove" title={`Remove ${name}`} onClick={() => remove(name)} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
