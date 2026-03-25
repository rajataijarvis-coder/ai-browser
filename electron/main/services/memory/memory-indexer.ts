/**
 * INPUT: MemoryEntry[], tokenizer
 * OUTPUT: BM25 full-text search with time decay
 * POSITION: Index layer for memory retrieval
 */

import type { MemoryEntry, ScoredMemory } from './types';
import { tokenize } from './tokenizer';

const BM25_K1 = 1.5;
const BM25_B = 0.75;
const TIME_DECAY_HALF_LIFE_DAYS = 30;

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
