/**
 * Node resolver hook for the self-test.
 *
 * The app source uses bundler-style imports - no file extensions, and `@/` for
 * the source root - which Node cannot resolve on its own. Teaching it these two
 * rules is enough to run the pure modules directly under Node's TypeScript
 * stripping, with no build step and no test framework.
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const srcRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '../src')
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

export async function resolve(specifier, context, next) {
  let target = specifier

  if (target.startsWith('@/')) {
    target = pathToFileURL(join(srcRoot, target.slice(2))).href
  }

  // Relative and aliased specifiers may be missing their extension.
  if (/^(\.{1,2}\/|file:)/.test(target)) {
    const base = target.startsWith('file:')
      ? fileURLToPath(target)
      : resolvePath(dirname(fileURLToPath(context.parentURL)), target)

    if (!existsSync(base)) {
      for (const extension of EXTENSIONS) {
        if (existsSync(base + extension)) {
          target = pathToFileURL(base + extension).href
          break
        }
      }
    } else {
      target = pathToFileURL(base).href
    }
  }

  return next(target, context)
}
