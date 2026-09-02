import { getPath } from '@/core/util/path'
import type { Settings } from './schema'

/**
 * Which settings are edited as a draft rather than written straight through.
 *
 * Knobs (radius, opacity, counts) are staged: overwriting one loses the old
 * value irrecoverably. Content (tiles, notes, tasks) commits at once - a
 * discarded draft must never eat work the reader never saw as a setting.
 */

/** Trees whose scalars are staged. */
const STAGED_TREES = [
  'appearance',
  'background',
  'layout',
  'search',
  'tiles',
  'widgets',
  'behavior',
] as const

/**
 * Content paths inside those trees, which commit at once.
 * Matched as prefixes: `tiles.items` also covers `tiles.items.3.title`.
 */
const IMMEDIATE = [
  'tiles.items',
  'tiles.pages',
  'widgets.instances',
  'widgets.layout',
  // The blob is already in IndexedDB by now; staging the reference alone would
  // leave the two out of step.
  'background.image.blobId',
  'background.video.blobId',
  'background.slideshow.blobIds',
  'background.slideshow.urls',
  // A record of what you did, not a preference.
  'layout.lastPane',
] as const

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '.')

/** Whether writes to this dot-path are held in the draft. */
export function isStagedPath(path: string): boolean {
  if (IMMEDIATE.some((prefix) => isUnder(path, prefix))) return false
  return STAGED_TREES.some((tree) => isUnder(path, tree))
}

/**
 * The staged paths whose draft value differs from what is saved. Compared leaf
 * by leaf, so the Save bar's count matches what the reader actually changed.
 */
export function stagedDiff(saved: Settings, draft: Settings): string[] {
  const out: string[] = []
  for (const tree of STAGED_TREES) {
    walk(saved, draft, tree, out)
  }
  return out
}

function walk(saved: unknown, draft: unknown, path: string, out: string[]): void {
  if (IMMEDIATE.some((prefix) => isUnder(path, prefix))) return

  const a = getPath(saved, path)
  const b = getPath(draft, path)
  if (Object.is(a, b)) return

  // Arrays and scalars are one value to the reader: "order" changed, not four things.
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const key of keys) walk(saved, draft, `${path}.${key}`, out)
    return
  }

  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(path)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
