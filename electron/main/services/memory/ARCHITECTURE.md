<!-- Update me when files in this folder change -->

Cross-session memory system: BM25 full-text search + JSON persistence + LLM auto-extraction.

- `types.ts` — MemoryEntry, MemoryStats, MemoryFilter, ScoredMemory type definitions
- `memory-store.ts` — JSON file persistence with in-memory Map cache and debounced atomic writes
- `memory-indexer.ts` — Inverted index with BM25 scoring and time decay
- `tokenizer.ts` — Chinese/English text segmentation using Intl.Segmenter with fallback
- `memory-service.ts` — Core orchestrator: recall, LLM extraction, management APIs
- `index.ts` — Public module exports
