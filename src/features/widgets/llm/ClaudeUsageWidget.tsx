import { z } from 'zod'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { CLAUDE } from './claude'
import { UsagePanel } from './UsagePanel'

// One widget per provider rather than one widget with a row each, so a tile only
// asks for the host permission of the provider you actually use.

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
