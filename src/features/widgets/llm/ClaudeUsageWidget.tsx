import { z } from 'zod'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { CLAUDE } from './claude'
import { UsagePanel } from './UsagePanel'

/**
 * Claude's usage widget.
 *
 * One widget per provider rather than one widget with a row per provider: each
 * gets its own tile, asks for only its own host permission, and a user adds
 * just the ones they have accounts with. Everything but the adapter and this
 * registration is shared, so a second provider is a file beside `claude.ts` and
 * a copy of this.
 */

const ClaudeUsageConfig = z.object({})
type ClaudeUsageConfig = z.infer<typeof ClaudeUsageConfig>

function ClaudeUsageWidget({ sizeName }: WidgetProps<ClaudeUsageConfig>) {
  return <UsagePanel provider={CLAUDE} sizeName={sizeName} />
}

registerWidget<ClaudeUsageConfig>({
  type: 'claude-usage',
  name: 'Claude Usage',
  description: 'Your Claude limits and spend, read on demand from your signed-in session.',
  icon: 'stocks',
  configSchema: ClaudeUsageConfig,
  sizes: ['small', 'medium', 'large'],
  defaultSize: 'medium',
  permissions: ['tabs'],
  origins: CLAUDE.origins,
  Component: ClaudeUsageWidget,
})
