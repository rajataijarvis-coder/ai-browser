/**
 * INPUT: fs, app path for JSON persistence
 * OUTPUT: CRUD operations for MemoryEntry with debounced disk write
 * POSITION: Storage layer for cross-session memory system
 */

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import type { MemoryEntry, MemorySource, MemoryStats, MemoryFilter } from './types';

const SAVE_DEBOUNCE_MS = 500;

export class MemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private dataDir: string;
  private filePath: string;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'memory');
    this.filePath = path.join(this.dataDir, 'memories.json');
  }

  /** Load entries from disk */
  async load(): Promise<void> {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = await fs.promises.readFile(this.filePath, 'utf-8');
      const entries: MemoryEntry[] = JSON.parse(raw);
      for (const entry of entries) {
        this.entries.set(entry.id, entry);
      }
      console.log(`[MemoryStore] Loaded ${this.entries.size} memories`);
    } catch (err) {
      console.error('[MemoryStore] Failed to load:', err);
    }
  }

  /** Debounced save to disk */
  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS);
  }

  /** Flush to disk immediately (atomic write) */
  async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    try {
      if (!fs.existsSync(this.dataDir)) {
        await fs.promises.mkdir(this.dataDir, { recursive: true });
      }
      const data = JSON.stringify(this.getAll(), null, 2);
      const tmpPath = `${this.filePath}.tmp`;
      await fs.promises.writeFile(tmpPath, data, 'utf-8');
      await fs.promises.rename(tmpPath, this.filePath);
    } catch (err) {
      console.error('[MemoryStore] Failed to save:', err);
      this.dirty = true;
    }
  }

  /** Create a new memory entry */
  add(content: string, source: MemorySource, tags: string[] = []): MemoryEntry {
    const now = Date.now();
    const entry: MemoryEntry = {
      id: randomUUID(),
      content,
      source,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now,
      tags,
    };
    this.entries.set(entry.id, entry);
    this.scheduleSave();
    return entry;
  }

  /** Update an existing entry */
  update(id: string, partial: Partial<Pick<MemoryEntry, 'content' | 'tags'>>): MemoryEntry | null {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (partial.content !== undefined) entry.content = partial.content;
    if (partial.tags !== undefined) entry.tags = partial.tags;
    entry.updatedAt = Date.now();
    this.scheduleSave();
    return entry;
  }

  /** Record an access (recall hit) */
  recordAccess(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.scheduleSave();
  }

  /** Trigger save after external mutation */
  markDirty(): void {
    this.scheduleSave();
  }

  delete(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) this.scheduleSave();
    return deleted;
  }

  clear(): void {
    this.entries.clear();
    this.scheduleSave();
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  /** Filter memories by keyword or source */
  filter(f: MemoryFilter): MemoryEntry[] {
    let results = this.getAll();
    if (f.source) results = results.filter(e => e.source === f.source);
    if (f.keyword) {
      const q = f.keyword.toLowerCase();
      results = results.filter(e =>
        e.content.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return results;
  }

  /** Remove entries older than retentionDays */
  cleanup(retentionDays: number): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (entry.updatedAt < cutoff && entry.accessCount === 0) {
        this.entries.delete(id);
        removed++;
      }
    }
    if (removed > 0) this.scheduleSave();
    return removed;
  }

  getStats(): MemoryStats {
    let auto = 0;
    let manual = 0;
    for (const entry of this.entries.values()) {
      if (entry.source === 'auto') auto++;
      else manual++;
    }
    return { total: this.entries.size, auto, manual };
  }

  get size(): number {
    return this.entries.size;
  }
}
