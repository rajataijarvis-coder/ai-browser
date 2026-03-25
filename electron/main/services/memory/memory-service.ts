/**
 * INPUT: MemoryStore, MemoryIndexer, SettingsManager, ConfigManager
 * OUTPUT: Unified memory recall, extraction, and management API
 * POSITION: Core orchestrator for cross-session memory system
 */

import { MemoryStore } from './memory-store';
import { MemoryIndexer } from './memory-indexer';
import { tokenize } from './tokenizer';
import { SettingsManager } from '../../utils/settings-manager';
import { ConfigManager } from '../../utils/config-manager';
import type { MemoryEntry, MemoryFilter, MemoryStats, ScoredMemory } from './types';

const EXTRACTION_PROMPT = `Analyze the conversation below and extract key information worth remembering for future conversations.

Rules:
- Extract atomic facts, user preferences, instructions, or important context
- Each memory should be 1-2 sentences, concise and self-contained
- Include relevant tags (2-5 keywords) for each memory
- If nothing worth remembering, return empty array
- Do NOT extract trivial greetings or temporary task details

Return ONLY a valid JSON array (no markdown, no explanation):
[{"content": "...", "tags": ["..."]}]

Conversation:
`;

const DEDUP_THRESHOLD = 0.6;

export class MemoryService {
  private store: MemoryStore;
  private indexer: MemoryIndexer;
  private initialized = false;

  constructor() {
    this.store = new MemoryStore();
    this.indexer = new MemoryIndexer();
  }

  /** Load store and rebuild index */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.store.load();
    this.indexer.rebuild(this.store.getAll());
    this.initialized = true;

    // Run cleanup on startup
    const settings = SettingsManager.getInstance().getAppSettings().memory;
    if (settings?.retentionDays > 0) {
      const removed = this.store.cleanup(settings.retentionDays);
      if (removed > 0) {
        this.indexer.rebuild(this.store.getAll());
        console.log(`[MemoryService] Cleaned up ${removed} expired memories`);
      }
    }
    console.log(`[MemoryService] Initialized with ${this.store.size} memories`);
  }

  /** Search memories relevant to prompt, return formatted string */
  async recall(_chatId: string, prompt: string): Promise<string> {
    const settings = SettingsManager.getInstance().getAppSettings().memory;
    if (!settings?.enabled || !settings?.autoRecall) return '';
    if (this.store.size === 0) return '';

    const entries = new Map(this.store.getAll().map(e => [e.id, e]));
    const results = this.indexer.search(
      prompt,
      entries,
      settings.maxRecallResults,
      settings.similarityThreshold
    );

    if (results.length === 0) return '';

    // Record access for recalled memories
    for (const { entry } of results) {
      this.store.recordAccess(entry.id);
    }

    return results
      .map(({ entry }) => {
        const date = new Date(entry.updatedAt).toISOString().slice(0, 10);
        return `- ${entry.content} (${date})`;
      })
      .join('\n');
  }

  /** Extract memories from conversation using LLM */
  async extractFromConversation(
    messages: Array<{ role: string; content: string }>
  ): Promise<MemoryEntry[]> {
    const settings = SettingsManager.getInstance().getAppSettings().memory;
    if (!settings?.enabled || !settings?.autoExtract) return [];
    if (messages.length < 2) return [];

    try {
      const llmConfig = this.resolveLlmConfig(settings.memoryModel);
      if (!llmConfig) {
        console.warn('[MemoryService] No LLM available for memory extraction');
        return [];
      }

      const conversation = messages
        .slice(-10) // Last 10 messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const response = await this.callLlm(llmConfig, EXTRACTION_PROMPT + conversation);
      return this.parseAndSaveExtraction(response);
    } catch (err) {
      console.error('[MemoryService] Extraction failed:', err);
      return [];
    }
  }

  /** Resolve LLM config: memoryModel → compressModel → default */
  private resolveLlmConfig(memoryModel?: string): LlmCallConfig | null {
    const configManager = ConfigManager.getInstance();

    // Priority 1: dedicated memory model
    if (memoryModel) {
      const config = configManager.buildLlmConfig(memoryModel);
      if (config) return this.toLlmCallConfig(config);
    }

    // Priority 2: compress model
    const llms = configManager.getLLMsConfig();
    if (llms.compress) return this.toLlmCallConfig(llms.compress);

    // Priority 3: default model
    if (llms.default) return this.toLlmCallConfig(llms.default);

    return null;
  }

  private toLlmCallConfig(config: Record<string, unknown>): LlmCallConfig | null {
    const apiKey = config.apiKey;
    const model = config.model;
    const provider = config.provider;
    if (typeof apiKey !== 'string' || !apiKey || typeof model !== 'string' || !model) return null;
    const innerConfig = config.config as Record<string, unknown> | undefined;
    return {
      apiKey,
      model,
      provider: typeof provider === 'string' ? provider : '',
      baseUrl: typeof innerConfig?.baseURL === 'string' ? innerConfig.baseURL : '',
    };
  }

  /** Call LLM with provider-specific API format */
  private async callLlm(config: LlmCallConfig, prompt: string): Promise<string> {
    console.log(`[MemoryService] Calling LLM: ${config.provider}/${config.model} for extraction`);

    if (config.provider === 'anthropic') {
      return this.callAnthropicLlm(config, prompt);
    }
    return this.callOpenAiCompatibleLlm(config, prompt);
  }

  /** OpenAI-compatible /chat/completions call */
  private async callOpenAiCompatibleLlm(config: LlmCallConfig, prompt: string): Promise<string> {
    const baseUrl = this.resolveBaseUrl(config);
    const url = `${baseUrl}/chat/completions`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`LLM call failed: ${resp.status} ${text.slice(0, 200)}`);
    }

    const data = await resp.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content || '';
  }

  /** Anthropic /messages call */
  private async callAnthropicLlm(config: LlmCallConfig, prompt: string): Promise<string> {
    const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.anthropic.com/v1';
    const url = `${baseUrl}/messages`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Anthropic call failed: ${resp.status} ${text.slice(0, 200)}`);
    }

    const data = await resp.json() as {
      content?: Array<{ type: string; text?: string }>;
    };
    return data.content?.find(c => c.type === 'text')?.text || '';
  }

  private resolveBaseUrl(config: LlmCallConfig): string {
    if (config.baseUrl) return config.baseUrl.replace(/\/$/, '');
    // Default base URLs by provider
    const defaults: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      google: 'https://generativelanguage.googleapis.com/v1beta',
      anthropic: 'https://api.anthropic.com/v1',
    };
    return defaults[config.provider] || config.baseUrl || '';
  }

  /** Parse LLM response and save memories with dedup */
  private parseAndSaveExtraction(response: string): MemoryEntry[] {
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    let items: Array<{ content: string; tags?: string[] }>;
    try {
      items = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn('[MemoryService] Failed to parse extraction response');
      return [];
    }

    if (!Array.isArray(items) || items.length === 0) return [];

    const saved: MemoryEntry[] = [];
    const entries = new Map(this.store.getAll().map(e => [e.id, e]));

    for (const item of items) {
      if (!item.content?.trim()) continue;

      // Dedup: check if similar memory exists
      const similar = this.indexer.search(item.content, entries, 1, DEDUP_THRESHOLD);
      if (similar.length > 0) {
        // Update existing instead of creating new
        this.store.update(similar[0].entry.id, {
          content: item.content.trim(),
          tags: item.tags || [],
        });
        continue;
      }

      const entry = this.store.add(
        item.content.trim(),
        'auto',
        item.tags || tokenize(item.content).slice(0, 5)
      );
      this.indexer.addDocument(entry);
      entries.set(entry.id, entry);
      saved.push(entry);
    }

    return saved;
  }

  // --- Management APIs ---

  getMemories(filter?: MemoryFilter): MemoryEntry[] {
    if (!filter) return this.store.getAll();
    return this.store.filter(filter);
  }

  deleteMemory(id: string): boolean {
    this.indexer.removeDocument(id);
    return this.store.delete(id);
  }

  clearAll(): void {
    this.store.clear();
    this.indexer.rebuild([]);
  }

  addManual(content: string): MemoryEntry {
    const tags = tokenize(content).slice(0, 5);
    const entry = this.store.add(content, 'manual', tags);
    this.indexer.addDocument(entry);
    return entry;
  }

  getStats(): MemoryStats {
    return this.store.getStats();
  }

  /** Search memories (for Settings UI) */
  searchMemories(query: string, maxResults = 20): ScoredMemory[] {
    const entries = new Map(this.store.getAll().map(e => [e.id, e]));
    return this.indexer.search(query, entries, maxResults, 0);
  }

  /** Flush pending writes */
  async flush(): Promise<void> {
    await this.store.flush();
  }
}

interface LlmCallConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
}
