import { TopSitesAction } from '@/features/tiles/TopSitesAction'
import type { Section } from '../types'

export const tilesSection: Section = {
  id: 'tiles',
  label: 'Tiles',
  icon: 'layers',
  groups: [
    {
      id: 'general',
      fields: [
        { path: 'tiles.enabled', label: 'Show tiles', control: { kind: 'toggle' } },
        {
          path: 'tiles.openIn',
          label: 'Open links in',
          control: {
            kind: 'segmented',
            options: [
              { value: 'current', label: 'This tab' },
              { value: 'newTab', label: 'New tab' },
            ],
          },
        },
        {
          path: 'tiles.showAddButton',
          label: 'Show the add button',
          control: { kind: 'toggle' },
        },
        {
          label: 'Most-visited sites',
          help: 'Adds the sites you visit most, skipping any already pinned.',
          control: { kind: 'custom', render: () => <TopSitesAction /> },
          keywords: 'top sites frequent',
        },
      ],
    },
    {
      id: 'shape',
      label: 'Size and shape',
      when: (s) => s.tiles.enabled,
      fields: [
        {
          path: 'tiles.columns',
          label: 'Columns',
          help: 'Zero fits as many as the width allows.',
          control: { kind: 'slider', min: 0, max: 16, format: (v) => (v === 0 ? 'Auto' : String(v)) },
        },
        {
          path: 'tiles.width',
          label: 'Tile width',
          control: { kind: 'slider', min: 60, max: 400, step: 2, unit: 'px' },
        },
        {
          path: 'tiles.aspect',
          label: 'Shape',
          help: 'Ratio of width to height. 1.0 is a square.',
          control: { kind: 'slider', min: 0.5, max: 3, step: 0.05, format: (v) => `${v.toFixed(2)}:1` },
        },
        {
          path: 'tiles.gap',
          label: 'Spacing',
          control: { kind: 'slider', min: 0, max: 64, unit: 'px' },
        },
        {
          path: 'tiles.radius',
          label: 'Corner radius',
          help: 'Inherits the global radius unless overridden here.',
          control: {
            kind: 'nullableSlider',
            min: 0,
            max: 60,
            unit: 'px',
            inheritLabel: 'Inherit',
            fallback: (s) => s.appearance.radius,
          },
          keywords: 'rounded boxy square',
        },
      ],
    },
    {
      id: 'artwork',
      label: 'Artwork',
      when: (s) => s.tiles.enabled,
      fields: [
        {
          path: 'tiles.plateStyle',
          label: 'Plate colour',
          help: 'Brand paints the tile in the site colour; neutral keeps the theme surface.',
          control: {
            kind: 'segmented',
            options: [
              { value: 'brand', label: 'Brand' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'tinted', label: 'Tinted' },
              { value: 'transparent', label: 'None' },
            ],
          },
        },
        {
          path: 'tiles.imageFit',
          label: 'Image fit',
          control: {
            kind: 'segmented',
            options: [
              { value: 'contain', label: 'Contain' },
              { value: 'cover', label: 'Cover' },
            ],
          },
        },
        {
          path: 'tiles.imagePadding',
          label: 'Image padding',
          control: { kind: 'slider', min: 0, max: 40, unit: 'px' },
        },
        {
          path: 'tiles.hoverEffect',
          label: 'Hover effect',
          control: {
            kind: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'lift', label: 'Lift' },
              { value: 'zoom', label: 'Zoom' },
              { value: 'glow', label: 'Glow' },
              { value: 'tilt', label: 'Tilt' },
            ],
          },
        },
      ],
    },
    {
      id: 'labels',
      label: 'Labels and favicons',
      when: (s) => s.tiles.enabled,
      fields: [
        {
          path: 'tiles.labelPlacement',
          label: 'Title position',
          control: {
            kind: 'select',
            options: [
              { value: 'below', label: 'Below the tile' },
              { value: 'inside-bottom', label: 'Inside, bottom' },
              { value: 'inside-top', label: 'Inside, top' },
              { value: 'none', label: 'Hidden' },
            ],
          },
        },
        {
          path: 'tiles.labelVisibility',
          label: 'Show title',
          control: {
            kind: 'segmented',
            options: [
              { value: 'always', label: 'Always' },
              { value: 'hover', label: 'On hover' },
              { value: 'never', label: 'Never' },
            ],
          },
          when: (s) => s.tiles.labelPlacement !== 'none',
        },
        {
          path: 'tiles.labelAlign',
          label: 'Title alignment',
          control: {
            kind: 'segmented',
            options: [
              { value: 'start', label: 'Left' },
              { value: 'center', label: 'Centre' },
              { value: 'end', label: 'Right' },
            ],
          },
          when: (s) => s.tiles.labelPlacement !== 'none',
        },
        {
          path: 'tiles.faviconVisibility',
          label: 'Show favicon badge',
          control: {
            kind: 'segmented',
            options: [
              { value: 'always', label: 'Always' },
              { value: 'hover', label: 'On hover' },
              { value: 'never', label: 'Never' },
            ],
          },
        },
        {
          path: 'tiles.faviconCorner',
          label: 'Favicon corner',
          control: {
            kind: 'select',
            options: [
              { value: 'top-left', label: 'Top left' },
              { value: 'top-right', label: 'Top right' },
              { value: 'bottom-left', label: 'Bottom left' },
              { value: 'bottom-right', label: 'Bottom right' },
            ],
          },
          when: (s) => s.tiles.faviconVisibility !== 'never',
        },
        {
          path: 'tiles.faviconSize',
          label: 'Favicon size',
          control: { kind: 'slider', min: 12, max: 48, unit: 'px' },
          when: (s) => s.tiles.faviconVisibility !== 'never',
        },
      ],
    },
  ],
}
