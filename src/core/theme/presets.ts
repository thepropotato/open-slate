/**
 * Colour presets, each with a light and a dark palette for `auto` mode. Chrome
 * exposes no API for the installed theme's colours, so `auto` tracks only light vs dark.
 */

export interface Palette {
  bg: string
  bgElevated: string
  fg: string
  fgMuted: string
  fgSubtle: string
  accent: string
  accentFg: string
  line: string
  // `r g b` triplet for translucent panel fills.
  surfaceBase: string
  // `r g b` for overlays drawn on top of content. Inverts between light and dark,
  // or those fills disappear into the background.
  surfaceTint: string
}

export interface ThemePreset {
  id: string
  label: string
  dark: Palette
  light: Palette
}

const dark = (over: Partial<Palette>): Palette => ({
  bg: '#0b0d12',
  bgElevated: '#15181f',
  fg: '#eef1f6',
  fgMuted: '#a2abbb',
  fgSubtle: '#6d768a',
  accent: '#6ea8fe',
  accentFg: '#06090f',
  line: 'rgb(255 255 255 / 12%)',
  surfaceBase: '12 14 19',
  surfaceTint: '255 255 255',
  ...over,
})

const light = (over: Partial<Palette>): Palette => ({
  bg: '#f4f5f8',
  bgElevated: '#ffffff',
  fg: '#171a21',
  fgMuted: '#525a68',
  fgSubtle: '#858d9c',
  accent: '#2f6fed',
  accentFg: '#ffffff',
  line: 'rgb(0 0 0 / 12%)',
  surfaceBase: '255 255 255',
  surfaceTint: '17 22 32',
  ...over,
})

export const themePresets: ThemePreset[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    dark: dark({}),
    light: light({}),
  },
  {
    id: 'graphite',
    label: 'Graphite',
    dark: dark({ bg: '#101010', bgElevated: '#1b1b1b', accent: '#d6d6d6', accentFg: '#101010', surfaceBase: '18 18 18' }),
    light: light({ bg: '#f0f0ef', accent: '#2b2b2b', accentFg: '#ffffff' }),
  },
  {
    id: 'ocean',
    label: 'Ocean',
    dark: dark({ bg: '#071620', bgElevated: '#0d2531', accent: '#4cc9d9', accentFg: '#04121a', surfaceBase: '8 26 35' }),
    light: light({ bg: '#eef7fa', accent: '#0d7d90', accentFg: '#ffffff' }),
  },
  {
    id: 'nord',
    label: 'Nord',
    dark: dark({ bg: '#2e3440', bgElevated: '#3b4252', accent: '#88c0d0', accentFg: '#2e3440', surfaceBase: '46 52 64' }),
    light: light({ bg: '#eceff4', accent: '#5e81ac', accentFg: '#ffffff' }),
  },
  {
    id: 'ember',
    label: 'Ember',
    dark: dark({ bg: '#150d0c', bgElevated: '#241514', accent: '#f4784f', accentFg: '#1a0c09', surfaceBase: '32 18 16' }),
    light: light({ bg: '#fbf2ee', accent: '#c2451c', accentFg: '#ffffff' }),
  },
  {
    id: 'forest',
    label: 'Forest',
    dark: dark({ bg: '#0a1410', bgElevated: '#14231c', accent: '#7bd88f', accentFg: '#08110d', surfaceBase: '12 24 18' }),
    light: light({ bg: '#eef6f0', accent: '#1f7a4d', accentFg: '#ffffff' }),
  },
  {
    id: 'violet',
    label: 'Violet',
    dark: dark({ bg: '#120e1c', bgElevated: '#1e1830', accent: '#b18cff', accentFg: '#0d0a15', surfaceBase: '24 18 40' }),
    light: light({ bg: '#f5f2fd', accent: '#6d40d8', accentFg: '#ffffff' }),
  },
  {
    id: 'paper',
    label: 'Paper',
    dark: dark({ bg: '#191714', bgElevated: '#241f1a', accent: '#e8c88a', accentFg: '#191714', surfaceBase: '30 27 22' }),
    light: light({ bg: '#faf7f0', bgElevated: '#fffdf8', accent: '#8a6a2f', accentFg: '#ffffff', surfaceBase: '255 253 248' }),
  },
]

export const getPreset = (id: string): ThemePreset =>
  themePresets.find((p) => p.id === id) ?? themePresets[0]
