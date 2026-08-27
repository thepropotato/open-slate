/** Dot-path helpers used by the schema-driven settings UI. */

export function getPath<T = unknown>(obj: unknown, path: string): T | undefined {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj) as T | undefined
}

/** Returns a structurally-shared copy of `obj` with `path` set to `value`. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const source = (obj ?? {}) as Record<string, unknown>
  const next: Record<string, unknown> = { ...source }
  next[head] = rest.length === 0 ? value : setPath(source[head] ?? {}, rest.join('.'), value)
  return next as T
}
