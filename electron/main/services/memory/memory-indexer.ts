/**
 * INPUT: MemoryEntry[], tokenizer
 * OUTPUT: BM25 + vector hybrid search with time decay
 * POSITION: Index layer for memory retrieval
 */

import type { MemoryEntry, ScoredMemory } from './types';
import { tokenize } from './tokenizer';

const BM25_K1 = 1.5;
const BM25_B = 0.75;
const TIME_DECAY_HALF_LIFE_DAYS = 30;
const VECTOR_WEIGHT = 0.6;
const BM25_WEIGHT = 0.4;

export class MemoryIndexer {
  /** term → Set<entryId> */
  private invertedIndex = new Map<string, Set<string>>();
  /** entryId → token count */
  private docLengths = new Map<string, number>();
  /** entryId → term frequencies */
  private termFreqs = new Map<string, Map<string, number>>();
  private avgDocLength = 0;

  /** Rebuild index from all entries */
  rebuild(entries: MemoryEntry[]): void {
    this.invertedIndex.clear();
    this.docLengths.clear();
    this.termFreqs.clear();
    for (const entry of entries) {
      this.addDocument(entry);
    }
    this.recalcAvgDocLength();
  }

  /** Add single document to index */
  addDocument(entry: MemoryEntry): void {
    const tokens = tokenize(entry.content + ' ' + entry.tags.join(' '));
    const tf = new Map<string, number>();

    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
      let postings = this.invertedIndex.get(token);
      if (!postings) {
        postings = new Set();
        this.invertedIndex.set(token, postings);
      }
      postings.add(entry.id);
    }

    const docLen = tokens.length;
    const prevTotal = this.avgDocLength * this.docLengths.size;
    this.docLengths.set(entry.id, docLen);
    this.termFreqs.set(entry.id, tf);
    this.avgDocLength = (prevTotal + docLen) / this.docLengths.size;
  }

  /** Remove document from index */
  removeDocument(id: string): void {
    const tf = this.termFreqs.get(id);
    if (!tf) return;

    for (const term of tf.keys()) {
      const postings = this.invertedIndex.get(term);
      if (postings) {
        postings.delete(id);
        if (postings.size === 0) this.invertedIndex.delete(term);
      }
    }

    const removedLen = this.docLengths.get(id) || 0;
    const prevTotal = this.avgDocLength * this.docLengths.size;
    this.docLengths.delete(id);
    this.termFreqs.delete(id);
    this.avgDocLength = this.docLengths.size > 0 ? (prevTotal - removedLen) / this.docLengths.size : 0;
  }

  /** BM25 search with time decay */
  search(query: string, entries: Map<string, MemoryEntry>, topK: number, minScore: number): ScoredMemory[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const totalDocs = this.docLengths.size;
    if (totalDocs === 0 || this.avgDocLength === 0) return [];

    const scores = new Map<string, number>();

    for (const term of queryTokens) {
      const postings = this.invertedIndex.get(term);
      if (!postings) continue;

      const df = postings.size;
      const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);

      for (const docId of postings) {
        const tf = this.termFreqs.get(docId)?.get(term) || 0;
        const docLen = this.docLengths.get(docId) || 0;
        const numerator = tf * (BM25_K1 + 1);
        const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * docLen / this.avgDocLength);
        const bm25Score = idf * numerator / denominator;

        scores.set(docId, (scores.get(docId) || 0) + bm25Score);
      }
    }

    // Apply time decay and normalize
    const now = Date.now();
    const results: ScoredMemory[] = [];

    for (const [id, rawScore] of scores) {
      const entry = entries.get(id);
      if (!entry) continue;

      const ageDays = (now - entry.updatedAt) / (24 * 60 * 60 * 1000);
      const decay = 1 / (1 + ageDays / TIME_DECAY_HALF_LIFE_DAYS);
      const finalScore = rawScore * decay;

      if (finalScore >= minScore) {
        results.push({ entry, score: finalScore });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** Cosine similarity vector search */
  vectorSearch(queryEmbedding: number[], entries: Map<string, MemoryEntry>, topK: number, minScore: number): ScoredMemory[] {
    const now = Date.now();
    const results: ScoredMemory[] = [];

    for (const entry of entries.values()) {
      if (!entry.embedding?.length) continue;
      const cosine = cosineSimilarity(queryEmbedding, entry.embedding);
      const ageDays = (now - entry.updatedAt) / (24 * 60 * 60 * 1000);
      const decay = 1 / (1 + ageDays / TIME_DECAY_HALF_LIFE_DAYS);
      const score = cosine * decay;

      if (score >= minScore) {
        results.push({ entry, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /** Hybrid search: BM25 + vector with weighted fusion */
  hybridSearch(
    query: string,
    queryEmbedding: number[],
    entries: Map<string, MemoryEntry>,
    topK: number,
    minScore: number,
  ): ScoredMemory[] {
    const bm25Results = this.search(query, entries, topK * 2, 0);
    const vectorResults = this.vectorSearch(queryEmbedding, entries, topK * 2, 0);

    // Normalize scores to [0, 1] within each result set
    const bm25Max = bm25Results[0]?.score || 1;
    const vectorMax = vectorResults[0]?.score || 1;

    // Merge by entry id with weighted fusion
    const merged = new Map<string, { entry: MemoryEntry; score: number }>();

    for (const r of bm25Results) {
      const normalized = r.score / bm25Max;
      merged.set(r.entry.id, { entry: r.entry, score: BM25_WEIGHT * normalized });
    }

    for (const r of vectorResults) {
      const normalized = r.score / vectorMax;
      const existing = merged.get(r.entry.id);
      if (existing) {
        existing.score += VECTOR_WEIGHT * normalized;
      } else {
        merged.set(r.entry.id, { entry: r.entry, score: VECTOR_WEIGHT * normalized });
      }
    }

    return Array.from(merged.values())
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private recalcAvgDocLength(): void {
    if (this.docLengths.size === 0) {
      this.avgDocLength = 0;
      return;
    }
    let total = 0;
    for (const len of this.docLengths.values()) total += len;
    this.avgDocLength = total / this.docLengths.size;
  }
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
