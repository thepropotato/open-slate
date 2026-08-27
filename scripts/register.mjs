import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL(new URL('ts-resolve.mjs', import.meta.url).pathname))
