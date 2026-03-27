<!-- Update me when files in this folder change -->

Cross-session memory system: hybrid search (BM25 + vector cosine) + JSON persistence + LLM auto-extraction.

- `types.ts` — MemoryEntry (with optional embedding), MemoryStats, MemoryFilter, ScoredMemory
- `memory-store.ts` — JSON file persistence with in-memory Map cache and debounced atomic writes
- `memory-indexer.ts` — BM25 inverted index + vector cosine similarity + hybrid fusion search
- `embedding-provider.ts` — Embedding API calls (OpenAI/Gemini), auto-detects user-configured provider
- `tokenizer.ts` — Chinese/English text segmentation using Intl.Segmenter with fallback
- `memory-service.ts` — Core orchestrator: hybrid recall, LLM extraction, background embedding
- `index.ts` — Public module exports
