/**
 * input: SearchProvider, ChatService interface from @jarvis-agent/core
 * output: AppChatService implementing ChatService
 * pos: Global chat service bridging eko-core with Electron search/file capabilities
 */

import type { ChatService, WebSearchResult, EkoMessage } from "@jarvis-agent/core";
import type { SearchProvider } from "./search-provider";
import { createSearchProvider } from "./search-provider";
import type { SearchProviderConfig } from "../models/settings";

export class AppChatService implements ChatService {
  private searchProvider: SearchProvider | null;

  constructor(config?: SearchProviderConfig) {
    this.searchProvider = createSearchProvider(config);
  }

  /** Hot-swap search provider on config change */
  updateSearchProvider(config?: SearchProviderConfig): void {
    this.searchProvider = createSearchProvider(config);
  }

  /** Web search via configured provider */
  async websearch(
    _chatId: string,
    query: string,
    site?: string,
    language?: string,
    maxResults?: number
  ): Promise<WebSearchResult[]> {
    if (!this.searchProvider) {
      console.warn("[AppChatService] No search provider configured");
      return [];
    }

    try {
      const results = await this.searchProvider.search(query, { site, language, maxResults });
      return results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        content: r.content,
      }));
    } catch (error) {
      console.error("[AppChatService] Search failed:", error);
      return [];
    }
  }

  /** Messages managed by frontend */
  async loadMessages(_chatId: string): Promise<EkoMessage[]> {
    return [];
  }

  /** Messages managed by frontend */
  async addMessage(_chatId: string, _messages: EkoMessage[]): Promise<void> {}

  /** Memory recall — reserved for future extension */
  async memoryRecall(_chatId: string, _prompt: string): Promise<string> {
    return "";
  }

  /** Convert file to data URL */
  async uploadFile(
    file: { base64Data: string; mimeType: string; filename?: string },
    _chatId: string,
    _taskId?: string
  ): Promise<{ fileId: string; url: string }> {
    const fileId = `file_${Date.now()}`;
    const url = `data:${file.mimeType};base64,${file.base64Data}`;
    return { fileId, url };
  }
}
