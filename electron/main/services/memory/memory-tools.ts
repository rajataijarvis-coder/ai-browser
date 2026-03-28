/**
 * INPUT: MemoryService, DialogueTool interface from @jarvis-agent/core
 * OUTPUT: memory_search and memory_save tools for ChatAgent
 * POSITION: LLM-callable tools for proactive memory access in Chat mode
 */

import type { DialogueTool, ToolResult } from '@jarvis-agent/core';
import type { MemoryService } from './memory-service';

/** Search existing memories by semantic query */
export class MemorySearchTool implements DialogueTool {
  readonly name = 'memory_search';
  readonly description = 'Search cross-session memories for relevant information about user preferences, past instructions, or facts learned from previous conversations.';
  readonly parameters: JSONSchema7 = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to find relevant memories.',
      },
      maxResults: {
        type: 'integer',
        description: 'Maximum number of results (default: 5, max: 20).',
        default: 5,
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['query'],
  };

  constructor(private memoryService: MemoryService) {}

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args.query as string;
    if (!query?.trim()) {
      return { content: [{ type: 'text', text: 'Error: query is required' }], isError: true };
    }

    const maxResults = Math.min(Math.max((args.maxResults as number) || 5, 1), 20);
    const results = this.memoryService.searchMemories(query.trim(), maxResults);

    if (results.length === 0) {
      return { content: [{ type: 'text', text: 'No matching memories found.' }] };
    }

    const formatted = results.map(({ entry, score }) => ({
      content: entry.content,
      tags: entry.tags,
      source: entry.source,
      score: Math.round(score * 100) / 100,
      date: new Date(entry.updatedAt).toISOString().slice(0, 10),
    }));

    return { content: [{ type: 'text', text: JSON.stringify(formatted) }] };
  }
}

/** Save a new memory from conversation context */
export class MemorySaveTool implements DialogueTool {
  readonly name = 'memory_save';
  readonly description = 'Save important information to cross-session memory. Use this to remember user preferences, instructions, key facts, or context that would be valuable in future conversations.';
  readonly parameters: JSONSchema7 = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The information to remember. Should be a concise, self-contained fact or preference (1-2 sentences).',
      },
    },
    required: ['content'],
  };

  constructor(private memoryService: MemoryService) {}

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const content = (args.content as string)?.trim();
    if (!content) {
      return { content: [{ type: 'text', text: 'Error: content is required' }], isError: true };
    }

    const entry = this.memoryService.addManual(content);
    return {
      content: [{ type: 'text', text: `Memory saved: "${entry.content}" (id: ${entry.id})` }],
    };
  }
}

/** Build memory DialogueTools for ChatAgent injection */
export function buildMemoryTools(memoryService: MemoryService): DialogueTool[] {
  return [
    new MemorySearchTool(memoryService),
    new MemorySaveTool(memoryService),
  ];
}
