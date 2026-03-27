/**
 * INPUT: none (pure type definitions)
 * OUTPUT: MemoryEntry, MemorySource, MemoryStats types
 * POSITION: Core types for cross-session memory system
 */

export type MemorySource = 'auto' | 'manual';

export interface MemoryEntry {
  id: string;
  content: string;
  source: MemorySource;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
  tags: string[];
  embedding?: number[];
  embeddingModel?: string;
}

export interface MemoryStats {
  total: number;
  auto: number;
  manual: number;
}

export interface MemoryFilter {
  keyword?: string;
  source?: MemorySource;
}

export interface ScoredMemory {
  entry: MemoryEntry;
  score: number;
}
