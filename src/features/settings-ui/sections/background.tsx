import { MediaLibrary } from '@/features/background/MediaLibrary'
import { WallpaperPresets } from '@/features/background/WallpaperPresets'
import { presetIdOf } from '@/features/background/presets'
import { useSetting } from '@/core/settings/SettingsProvider'
import { TextInput } from '@/core/ui'
import type { Section } from '../types'

/** The address box stays available over a built-in wallpaper; it just starts empty. */
function ImageAddress() {
  const [url, setUrl] = useSetting<string>('background.image.url')
  const builtIn = presetIdOf(url) !== null
  return (
    <TextInput
      value={builtIn ? '' : url}
      onChange={setUrl}
      placeholder={builtIn ? 'Using a built-in wallpaper. Paste a link for your own.' : 'https://…/photo.jpg'}
      wide
    />
  )
}

const usesMedia = (type: string) => type === 'image' || type === 'video' || type === 'slideshow'

export const backgroundSection: Section = {
  id: 'background',
  label: 'Wallpaper',
  icon: 'image',
  groups: [
    {
      id: 'presets',
      label: 'Built-in',
      help: 'Drawn for Open Slate. They ship with the extension, so nothing is downloaded.',
      fields: [
        {
          label: 'Wallpapers',
          control: { kind: 'custom', bare: true, render: () => <WallpaperPresets /> },
          keywords: 'wallpaper preset built-in dawn dusk night mist landscape',
        },
      ],
    },
    {
      id: 'source',
      fields: [
        {
          path: 'background.type',
          label: 'Type',
          control: {
            kind: 'segmented',
            options: [
              { value: 'gradient', label: 'Gradient' },
              { value: 'solid', label: 'Solid' },
              { value: 'pattern', label: 'Pattern' },
              { value: 'image', label: 'Image' },
              { value: 'video', label: 'Video' },
              { value: 'slideshow', label: 'Slideshow' },
            ],
          },
          keywords: 'wallpaper background pattern',
        },
        {
          path: 'background.followTheme',
          label: 'Match the theme',
          help: 'Derives the colour or gradient from the palette, so light and dark agree.',
          control: { kind: 'toggle' },
          when: (s) => s.background.type === 'solid' || s.background.type === 'gradient' || s.background.type === 'pattern',
        },
        {
          path: 'background.color',
          label: 'Colour',
          control: { kind: 'color' },
          when: (s) => (s.background.type === 'solid' || s.background.type === 'pattern') && !s.background.followTheme,
        },
        {
          path: 'background.gradient.from',
          label: 'Gradient start',
          control: { kind: 'color' },
          when: (s) => s.background.type === 'gradient' && !s.background.followTheme,
        },
        {
          path: 'background.gradient.to',
          label: 'Gradient end',
          control: { kind: 'color' },
          when: (s) => s.background.type === 'gradient' && !s.background.followTheme,
        },
        {
          path: 'background.gradient.angle',
          label: 'Gradient angle',
          control: { kind: 'slider', min: 0, max: 360, unit: 'deg' },
          when: (s) => s.background.type === 'gradient',
        },
      ],
    },
    {
      id: 'pattern',
      label: 'Pattern',
      when: (s) => s.background.type === 'pattern',
      fields: [
        {
          path: 'background.pattern.style',
          label: 'Pattern style',
          control: {
            kind: 'select',
            options: [
              { value: 'dots', label: 'Dot grid' },
              { value: 'grid', label: 'Blueprint grid' },
              { value: 'stripes', label: 'Diagonal lines' },
              { value: 'isometric', label: 'Isometric perspective' },
              { value: 'waves', label: 'Contour waves' },
              { value: 'mesh', label: 'Ambient mesh' },
            ],
          },
          keywords: 'dots grid blueprint texture pattern mesh isometric',
        },
        {
          path: 'background.pattern.spacing',
          label: 'Scale / spacing',
          control: { kind: 'slider', min: 14, max: 72, step: 2, unit: 'px' },
          when: (s) => s.background.pattern.style !== 'mesh',
        },
        {
          path: 'background.pattern.opacity',
          label: 'Intensity',
          control: { kind: 'slider', min: 0.02, max: 0.45, step: 0.01 },
        },
      ],
    },
    {
      id: 'library',
      label: 'Library',
      help: 'Stored in this browser only. Nothing is uploaded anywhere.',
      when: (s) => usesMedia(s.background.type),
      fields: [
        {
          label: 'Your media',
          control: { kind: 'custom', bare: true, render: () => <MediaLibrary /> },
          keywords: 'upload wallpaper video image',
        },
      ],
    },
    {
      id: 'remote',
      label: 'From a link',
      when: (s) => s.background.type === 'image' || s.background.type === 'video',
      fields: [
        {
          label: 'Image address',
          help: 'Takes priority over a library selection and replaces a built-in wallpaper.',
          control: { kind: 'custom', stacked: true, render: () => <ImageAddress /> },
          keywords: 'image url link address photo remote',
          when: (s) => s.background.type === 'image',
        },
        {
          path: 'background.video.url',
          label: 'Video address',
          control: { kind: 'text', placeholder: 'https://…/loop.mp4', wide: true },
          when: (s) => s.background.type === 'video',
        },
      ],
    },
    {
      id: 'video',
      label: 'Video playback',
      when: (s) => s.background.type === 'video',
      fields: [
        { path: 'background.video.loop', label: 'Loop', control: { kind: 'toggle' } },
        { path: 'background.video.muted', label: 'Muted', control: { kind: 'toggle' } },
        {
          path: 'background.video.playbackRate',
          label: 'Speed',
          control: { kind: 'slider', min: 0.25, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}x` },
        },
        {
          path: 'background.video.pauseWhenHidden',
          label: 'Pause on other tabs',
          help: 'Strongly recommended: video decoding is the main battery cost here.',
          control: { kind: 'toggle' },
        },
      ],
    },
    {
      id: 'slideshow',
      label: 'Slideshow',
      when: (s) => s.background.type === 'slideshow',
      fields: [
        {
          path: 'background.slideshow.onNewTab',
          label: 'Change on every new tab',
          help: 'A fresh picture each time you open a tab, rather than on a timer.',
          control: { kind: 'toggle' },
        },
        {
          path: 'background.slideshow.intervalMinutes',
          label: 'Change every',
          when: (s) => !s.background.slideshow.onNewTab,
          control: {
            kind: 'slider',
            min: 1,
            max: 1440,
            format: (v) => (v < 60 ? `${v} min` : `${Math.round((v / 60) * 10) / 10} h`),
          },
        },
        { path: 'background.slideshow.shuffle', label: 'Shuffle', control: { kind: 'toggle' } },
        { path: 'background.slideshow.crossfade', label: 'Cross-fade', control: { kind: 'toggle' } },
      ],
    },
    {
      id: 'framing',
      label: 'Framing',
      when: (s) => usesMedia(s.background.type),
      fields: [
        {
          path: 'background.fit',
          label: 'Fit',
          control: {
            kind: 'segmented',
            options: [
              { value: 'cover', label: 'Cover' },
              { value: 'contain', label: 'Contain' },
              { value: 'fill', label: 'Fill' },
              { value: 'tile', label: 'Tile' },
              { value: 'center', label: 'Centre' },
            ],
          },
        },
        {
          path: 'background.scale',
          label: 'Zoom',
          control: { kind: 'slider', min: 1, max: 1.5, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
        },
        {
          path: 'background.kenBurns',
          label: 'Slow drift',
          help: 'A very slow zoom and pan. Ignored when reduced motion is on.',
          control: { kind: 'toggle' },
          when: (s) => s.background.type === 'image' || s.background.type === 'slideshow',
        },
      ],
    },
    {
      id: 'adjust',
      label: 'Adjustments',
      help: 'Applies to images and video only.',
      when: (s) => usesMedia(s.background.type),
      fields: [
        {
          path: 'background.dim',
          label: 'Dim',
          help: 'The quickest way to make text readable over a busy photo.',
          control: { kind: 'slider', min: 0, max: 1, step: 0.02, format: (v) => `${Math.round(v * 100)}%` },
        },
        {
          path: 'background.blur',
          label: 'Blur',
          control: { kind: 'slider', min: 0, max: 60, unit: 'px' },
        },
        {
          path: 'background.brightness',
          label: 'Brightness',
          control: { kind: 'slider', min: 0.2, max: 2, step: 0.02, format: (v) => `${Math.round(v * 100)}%` },
        },
        {
          path: 'background.saturation',
          label: 'Saturation',
          control: { kind: 'slider', min: 0, max: 2, step: 0.02, format: (v) => `${Math.round(v * 100)}%` },
        },
        {
          path: 'background.vignette',
          label: 'Vignette',
          control: { kind: 'slider', min: 0, max: 1, step: 0.02, format: (v) => `${Math.round(v * 100)}%` },
        },
      ],
    },
  ],
}
