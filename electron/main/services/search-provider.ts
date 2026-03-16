/**
 * input: SearchProviderConfig, native fetch
 * output: SearchProvider interface + adapters + factory
 * pos: Adapter layer for multi-engine web search
 */

import type { SearchProviderConfig, SearchProviderType } from "../models/settings";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface SearchOptions {
  site?: string;
  language?: string;
  maxResults?: number;
}

export interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

// API response types
interface TavilyResponse {
  results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string }>;
}

interface SerperResponse {
  organic?: Array<{ title?: string; link?: string; snippet?: string }>;
}

interface SearxngResponse {
  results?: Array<{ title?: string; url?: string; content?: string }>;
}

/** Tavily — AI-optimized, 1000 free/month, pure fetch */
class TavilyProvider implements SearchProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        max_results: options?.maxResults ?? 10,
        ...(options?.site && { include_domains: [options.site] }),
      }),
    });

    if (!resp.ok) throw new Error(`Tavily API error: ${resp.status}`);
    const data = (await resp.json()) as TavilyResponse;

    return (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.content ?? "",
      content: r.raw_content,
    }));
  }
}

/** Serper — Google quality, requires API key */
class SerperProvider implements SearchProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const q = options?.site ? `site:${options.site} ${query}` : query;
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q,
        num: options?.maxResults ?? 10,
        ...(options?.language && { hl: options.language }),
      }),
    });

    if (!resp.ok) throw new Error(`Serper API error: ${resp.status}`);
    const data = (await resp.json()) as SerperResponse;

    return (data.organic ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      snippet: r.snippet ?? "",
    }));
  }
}

/** SearXNG — self-hosted, no API key */
class SearxngProvider implements SearchProvider {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: options?.site ? `site:${options.site} ${query}` : query,
      format: "json",
      ...(options?.language && { language: options.language }),
    });

    const resp = await fetch(`${this.baseUrl}/search?${params}`);
    if (!resp.ok) throw new Error(`SearXNG error: ${resp.status}`);
    const data = (await resp.json()) as SearxngResponse;

    const max = options?.maxResults ?? 10;
    return (data.results ?? []).slice(0, max).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.content ?? "",
    }));
  }
}

/** Create SearchProvider from config, returns null if unconfigured */
export function createSearchProvider(config?: SearchProviderConfig): SearchProvider | null {
  if (!config?.provider) return null;

  const providers: Record<SearchProviderType, () => SearchProvider> = {
    tavily: () => {
      if (!config.apiKey) throw new Error("Tavily requires an API key");
      return new TavilyProvider(config.apiKey);
    },
    serper: () => {
      if (!config.apiKey) throw new Error("Serper requires an API key");
      return new SerperProvider(config.apiKey);
    },
    searxng: () => {
      if (!config.baseUrl) throw new Error("SearXNG requires a base URL");
      return new SearxngProvider(config.baseUrl);
    },
  };

  return providers[config.provider]();
}
