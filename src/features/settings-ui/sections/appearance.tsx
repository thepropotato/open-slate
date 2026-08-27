import { fontOptions } from '@/core/theme/fonts'
import { PresetPicker } from '../PresetPicker'
import type { Section } from '../types'

export const appearanceSection: Section = {
  id: 'appearance',
  label: 'Appearance',
  icon: 'palette',
  groups: [
    {
      id: 'theme',
      label: 'Theme',
      fields: [
        {
          path: 'appearance.mode',
          label: 'Light / dark',
          help: 'Auto follows the browser’s light or dark setting.',
          control: {
            kind: 'segmented',
            options: [
              { value: 'auto', label: 'Auto', icon: 'auto' },
              { value: 'light', label: 'Light', icon: 'light' },
              { value: 'dark', label: 'Dark', icon: 'dark' },
            ],
          },
        },
        {
          label: 'Palette',
          control: { kind: 'custom', render: () => <PresetPicker />, stacked: true },
          keywords: 'colour color preset',
        },
        {
          path: 'appearance.accentSource',
          label: 'Accent colour',
          control: {
            kind: 'segmented',
            options: [
              { value: 'preset', label: 'From palette' },
              { value: 'wallpaper', label: 'From wallpaper' },
              { value: 'custom', label: 'Custom' },
            ],
          },
        },
        {
          path: 'appearance.accent',
          label: 'Custom accent',
          control: { kind: 'color' },
          when: (s) => s.appearance.accentSource === 'custom',
        },
      ],
    },
    {
      id: 'shape',
      label: 'Shape and surfaces',
      fields: [
        {
          path: 'appearance.radius',
          label: 'Corner radius',
          help: 'Zero is fully boxy. Applies to tiles, widgets and panels alike.',
          control: { kind: 'slider', min: 0, max: 40, unit: 'px' },
          keywords: 'rounded boxy square corners',
        },
        {
          path: 'appearance.surface',
          label: 'Surface style',
          control: {
            kind: 'segmented',
            options: [
              { value: 'glass', label: 'Glass' },
              { value: 'solid', label: 'Solid' },
              { value: 'outline', label: 'Outline' },
              { value: 'none', label: 'None' },
            ],
          },
        },
        {
          path: 'appearance.surfaceOpacity',
          label: 'Surface opacity',
          control: { kind: 'slider', min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
          when: (s) => s.appearance.surface !== 'none',
        },
        {
          path: 'appearance.surfaceBlur',
          label: 'Backdrop blur',
          control: { kind: 'slider', min: 0, max: 40, unit: 'px' },
          when: (s) => s.appearance.surface === 'glass',
        },
        {
          path: 'appearance.shadow',
          label: 'Shadow',
          control: {
            kind: 'segmented',
            options: [
              { value: 'none', label: 'None' },
              { value: 'soft', label: 'Soft' },
              { value: 'strong', label: 'Strong' },
            ],
          },
        },
      ],
    },
    {
      id: 'type',
      label: 'Typography and rhythm',
      fields: [
        {
          path: 'appearance.fontFamily',
          label: 'Font',
          help: 'Only locally installed fonts — a new tab should never wait on a download.',
          control: {
            kind: 'select',
            options: fontOptions.map((f) => ({ value: f.id, label: f.label })),
          },
        },
        {
          path: 'appearance.fontScale',
          label: 'Text size',
          control: { kind: 'slider', min: 0.75, max: 1.5, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
        },
        {
          path: 'appearance.density',
          label: 'Density',
          control: {
            kind: 'segmented',
            options: [
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ],
          },
        },
      ],
    },
    {
      id: 'motion',
      label: 'Motion',
      fields: [
        {
          path: 'appearance.animations',
          label: 'Animations',
          help: 'Turned off automatically when the system asks for reduced motion.',
          control: { kind: 'toggle' },
        },
        {
          path: 'appearance.zenMode',
          label: 'Zen mode',
          help: 'Fades everything but the wallpaper until you move the pointer.',
          control: { kind: 'toggle' },
        },
      ],
    },
  ],
}
