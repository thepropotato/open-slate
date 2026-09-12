import { z } from 'zod'
import { decodeSlate, type SlatePayload } from './slateCode'

/**
 * The community gallery: slates people have submitted, reviewed by hand and
 * merged into the repository. There is no server and no database - a slate is a
 * JSON file in `slates/`, git history is the provenance, and merging a pull
 * request is what publishes it.
 *
 * Everything here treats an entry as untrusted text. It was written by whoever
 * opened the pull request, it is rendered in the extension and on the site, and
 * a reviewer reading a diff is not a parser. So the length caps and the
 * character rules below are enforced in code rather than asked for in a
 * contributing guide.
 */

/** Room for a real sentence, and not enough to hide a payload in. */
const NAME_MAX = 40
const DESCRIPTION_MAX = 140
const AUTHOR_MAX = 39 // A GitHub username cannot be longer.

/**
 * No control characters, and nothing from the bidirectional overrides: those
 * reorder text on screen, so a name can read one way in a reviewed diff and
 * another in the gallery.
 *
 * The control characters are the subject of the rule, not an accident of it.
 */
// eslint-disable-next-line no-control-regex
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/

const MARKUP = /[<>&]/

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !UNSAFE_TEXT.test(value), 'contains characters that are not allowed')
    // A layout is called "Focus", never "<script>". React escapes text nodes and
    // the site generator escapes what it writes, but this text is rendered in two
    // places today and will be rendered in more; refusing the characters is one
    // rule to keep, where "every consumer escapes correctly" is a standing bet.
    .refine((value) => !MARKUP.test(value), 'cannot contain < > or &')

export const GalleryEntry = z.object({
  /** Stable, and the file name. Lowercase so it cannot collide case-insensitively. */
  id: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, digits and hyphens only'),
  name: safeText(NAME_MAX),
  description: safeText(DESCRIPTION_MAX),
  /**
   * GitHub username, for credit. No email, no display name, nothing else.
   *
   * On its own this is a claim, not a proof - it is a string in a file anyone
   * can write. What makes it mean something is `check-slate-authorship.mjs`,
   * which compares it against the account that opened the pull request, an
   * identity the submitter cannot fill in themselves. The field is kept rather
   * than derived so that credit survives in the file after merge, and so a
   * maintainer can submit someone else's layout with the original credit intact.
   */
  author: z
    .string()
    .trim()
    .min(1)
    .max(AUTHOR_MAX)
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/, 'not a GitHub username'),
  /** The slate itself, exactly as the extension hands it out. */
  code: z.string().startsWith('ns1.').max(4000),
  /** ISO date the entry was merged, filled in by the reviewer. */
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type GalleryEntry = z.infer<typeof GalleryEntry>

export const GalleryIndex = z.object({
  version: z.literal(1),
  slates: z.array(GalleryEntry),
})

export type GalleryIndex = z.infer<typeof GalleryIndex>

/**
 * A gallery entry is only as good as the code inside it, so validation decodes
 * it rather than trusting that it parses. Returns the decoded payload, which the
 * preview is drawn from - a picture generated from the code cannot disagree with
 * the code the way a submitted screenshot can.
 */
export function validateEntry(
  raw: unknown,
  isKnownType: (type: string) => boolean = () => true,
): { entry: GalleryEntry; payload: SlatePayload } {
  const parsed = GalleryEntry.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  }
  const entry = parsed.data

  const payload = decodeSlate(entry.code)
  if (payload.widgets.length === 0) throw new Error('code: the slate has no widgets')

  const unknown = [...new Set(payload.widgets.map((w) => w.type).filter((t) => !isKnownType(t)))]
  if (unknown.length > 0) throw new Error(`code: unknown widget types: ${unknown.join(', ')}`)

  // A slate wider than its own grid lands half off the canvas for everyone who
  // applies it, and no reviewer can see that in a diff of base64.
  const overflow = payload.widgets.some((w) => w.x < 0 || w.y < 0 || w.x + w.w > payload.columns)
  if (overflow) throw new Error('code: a widget sits outside the grid')

  if (overlaps(payload)) throw new Error('code: two widgets claim the same cell')

  return { entry, payload }
}

/** Whether two widgets claim the same cell, which is a layout nobody designed. */
export function overlaps(payload: SlatePayload): boolean {
  const taken = new Set<string>()
  for (const widget of payload.widgets) {
    for (let x = widget.x; x < widget.x + widget.w; x += 1) {
      for (let y = widget.y; y < widget.y + widget.h; y += 1) {
        const cell = `${x},${y}`
        if (taken.has(cell)) return true
        taken.add(cell)
      }
    }
  }
  return false
}
