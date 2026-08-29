import { z } from 'zod'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { CHATGPT } from './chatgpt'
import { UsagePanel } from './UsagePanel'

/**
 * ChatGPT's usage widget.
 *
 * Everything but the adapter and this registration is shared with Claude's — see
 * `ClaudeUsageWidget.tsx` for why each provider gets its own tile rather than
 * one widget with a row per provider.
 */

const ChatGPTUsageConfig = z.object({})
type ChatGPTUsageConfig = z.infer<typeof ChatGPTUsageConfig>

function ChatGPTUsageWidget({ sizeName }: WidgetProps<ChatGPTUsageConfig>) {
  return <UsagePanel provider={CHATGPT} sizeName={sizeName} />
}

registerWidget<ChatGPTUsageConfig>({
  type: 'chatgpt-usage',
  name: 'ChatGPT Usage',
  description: 'Your ChatGPT rate limits, read on demand from your signed-in session.',
  icon: 'stocks',
  configSchema: ChatGPTUsageConfig,
  sizes: ['small', 'medium', 'large'],
  defaultSize: 'medium',
  permissions: ['tabs'],
  origins: CHATGPT.origins,
  Component: ChatGPTUsageWidget,
})
