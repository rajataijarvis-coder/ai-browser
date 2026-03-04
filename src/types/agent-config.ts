/**
 * Agent configuration types
 */

import { AgentMcpConfig } from '@/models/settings';

export interface AgentConfig {
  browserAgent: {
    enabled: boolean
    customPrompt?: string
    mcpServices: AgentMcpConfig
  }
  fileAgent: {
    enabled: boolean
    customPrompt?: string
    mcpServices: AgentMcpConfig
  }
}
