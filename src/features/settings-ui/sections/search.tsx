import { searchEngines } from '@/features/search/engines'
import type { Section } from '../types'

export const searchSection: Section = {
  id: 'search',
  label: 'Search',
  icon: 'search',
  groups: [
    {
      id: 'general',
      fields: [
        { path: 'search.enabled', label: 'Show the search box', control: { kind: 'toggle' } },
        {
          path: 'search.engineId',
          label: 'Default engine',
          control: {
            kind: 'select',
            options: searchEngines.map((engine) => ({ value: engine.id, label: engine.name })),
          },
          when: (s) => s.search.enabled,
        },
        {
          path: 'search.showEnginePicker',
          label: 'Engine picker',
          control: { kind: 'toggle' },
          when: (s) => s.search.enabled,
        },
        {
          path: 'search.autofocus',
          label: 'Focus on open',
          help: 'Off by default: it swallows keyboard shortcuts meant for the page.',
          control: { kind: 'toggle' },
          when: (s) => s.search.enabled,
        },
        {
          path: 'search.placeholder',
          label: 'Placeholder',
          control: { kind: 'text', placeholder: 'Search the web' },
          when: (s) => s.search.enabled,
        },
      ],
    },
    {
      id: 'behaviour',
      label: 'What the box understands',
      when: (s) => s.search.enabled,
      fields: [
        {
          path: 'search.bangs',
          label: 'Bang shortcuts',
          help: 'Typing "!yt cats" searches YouTube. Works as a suffix too.',
          control: { kind: 'toggle' },
        },
        {
          path: 'search.calculator',
          label: 'Calculator',
          help: 'Evaluates arithmetic as you type. Enter copies the result.',
          control: { kind: 'toggle' },
        },
        {
          path: 'search.suggestions',
          label: 'Suggestions',
          help: 'From your own tabs, tiles, bookmarks and history. Nothing is sent anywhere.',
          control: { kind: 'toggle' },
        },
      ],
    },
    {
      id: 'size',
      label: 'Size',
      when: (s) => s.search.enabled,
      fields: [
        {
          path: 'search.width',
          label: 'Width',
          control: { kind: 'slider', min: 240, max: 1200, step: 10, unit: 'px' },
        },
        {
          path: 'search.height',
          label: 'Height',
          control: { kind: 'slider', min: 36, max: 88, unit: 'px' },
        },
      ],
    },
  ],
}
