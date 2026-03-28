/**
 * INPUT: User-configured AI providers + embeddingModel setting
 * OUTPUT: Text embedding vectors via provider APIs
 * POSITION: Embedding layer for vector-based memory search
 */

import { net } from 'electron';
import { SettingsManager } from '../../utils/settings-manager';
import type { ProviderConfig } from '../../models/settings';

const proxyFetch = net.fetch.bind(net);

export interface EmbeddingConfig {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  format: 'openai' | 'gemini';
}

/** Detect API format by provider id */
function detectFormat(providerId: string): 'openai' | 'gemini' {
  return providerId === 'google' ? 'gemini' : 'openai';
}

/** Get embedding model options from user's fetched model lists */
export function getAvailableEmbeddingModels(): Array<{ value: string; label: string; group: string }> {
  const providers = SettingsManager.getInstance().getAppSettings().providers;
  const results: Array<{ value: string; label: string; group: string }> = [];

  for (const provider of Object.values(providers)) {
    if (!provider.enabled || !provider.apiKey) continue;

    for (const model of provider.models) {
      if (!model.enabled) continue;
      const name = model.id.toLowerCase();
      if (!name.includes('embed')) continue;
      results.push({
        value: `${provider.id}:${model.id}`,
        label: model.name || model.id,
        group: provider.name,
      });
    }
  }

  return results;
}

/** Resolve embedding config from user's explicit setting */
export function resolveEmbeddingProvider(): EmbeddingConfig | null {
  const settings = SettingsManager.getInstance().getAppSettings();
  const embeddingModel = settings.memory?.embeddingModel;
  if (!embeddingModel) return null;

  // Format: "providerId:modelId"
  const colonIdx = embeddingModel.indexOf(':');
  if (colonIdx <= 0) return null;
  const providerId = embeddingModel.slice(0, colonIdx);
  const modelId = embeddingModel.slice(colonIdx + 1);
  if (!modelId) return null;

  const provider = settings.providers[providerId];
  if (!provider?.enabled || !provider.apiKey) return null;

  return {
    providerId,
    apiKey: provider.apiKey,
    baseUrl: resolveBaseUrl(providerId, provider),
    model: modelId,
    format: detectFormat(providerId),
  };
}

/** Generate embedding for a single text */
export async function embed(config: EmbeddingConfig, text: string): Promise<number[]> {
  if (config.format === 'gemini') return embedGemini(config, text);
  return embedOpenAI(config, text);
}

/** Generate embeddings for multiple texts */
export async function embedBatch(config: EmbeddingConfig, texts: string[]): Promise<number[][]> {
  if (config.format === 'gemini') {
    return Promise.all(texts.map(t => embedGemini(config, t)));
  }
  return embedOpenAIBatch(config, texts);
}

// --- API implementations ---

async function embedOpenAI(config: EmbeddingConfig, text: string): Promise<number[]> {
  const results = await embedOpenAIBatch(config, [text]);
  return results[0];
}

async function embedOpenAIBatch(config: EmbeddingConfig, texts: string[]): Promise<number[][]> {
  const url = `${config.baseUrl}/embeddings`;

  const resp = await proxyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, input: texts }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Embedding failed: ${resp.status} ${body.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    data?: Array<{ embedding: number[]; index: number }>;
  };
  if (!data.data?.length) throw new Error('Empty embedding response');

  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

async function embedGemini(config: EmbeddingConfig, text: string): Promise<number[]> {
  const modelPath = config.model.startsWith('models/') ? config.model : `models/${config.model}`;
  // Strip /openai suffix from baseUrl — Gemini embedding uses native API path
  const baseUrl = config.baseUrl.replace(/\/openai\/?$/, '');
  const url = `${baseUrl}/${modelPath}:embedContent?key=${config.apiKey}`;

  const resp = await proxyFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelPath,
      content: { parts: [{ text }] },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Gemini embedding failed: ${resp.status} ${body.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    embedding?: { values: number[] };
  };
  if (!data.embedding?.values?.length) throw new Error('Empty Gemini embedding response');
  return data.embedding.values;
}

function resolveBaseUrl(providerId: string, provider: ProviderConfig): string {
  if (provider.baseUrl) return provider.baseUrl.replace(/\/$/, '');
  const defaults: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta',
    deepseek: 'https://api.deepseek.com/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  };
  return defaults[providerId] || provider.baseUrl || '';
}
