/** Short, collision-resistant ids for tiles, widgets and stored media. */
export const uid = (prefix = ''): string => {
  const random = crypto.getRandomValues(new Uint32Array(2))
  const body = Array.from(random, (n) => n.toString(36)).join('')
  return prefix ? `${prefix}_${body}` : body
}
