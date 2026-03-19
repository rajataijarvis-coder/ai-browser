/**
 * INPUT: App data path, skill directories (builtin + user)
 * OUTPUT: SkillService interface for jarvis-agent integration
 * POSITION: Core service for skill lifecycle in Electron main process
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { app } from "electron";

// Skill types aligned with @jarvis-agent/core skill.types.ts
// Will be replaced with core imports after next jarvis-agent release

export interface SkillMetadata {
  name: string;
  description: string;
  metadata?: {
    author?: string;
    version?: string;
    tags?: string[];
    auto_activate?: boolean;
    [key: string]: unknown;
  };
}

export interface SkillPackage extends SkillMetadata {
  path: string;
  source: "builtin" | "user";
  enabled: boolean;
}

export interface SkillContent {
  metadata: SkillMetadata;
  instructions: string;
  resources: string[];
  basePath: string;
}

interface ISkillService {
  getAllMetadata(): SkillPackage[];
  loadSkill(name: string): Promise<SkillContent | null>;
  loadResource(skillName: string, relativePath: string): Promise<string | null>;
}

const SKILL_NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESC_LENGTH = 1024;
const MAX_PACKAGE_SIZE = 1024 * 1024; // 1MB

export class SkillService implements ISkillService {
  private builtinDir: string;
  private userDir: string;
  private cache: Map<string, SkillPackage> = new Map();

  constructor() {
    this.builtinDir = app.isPackaged
      ? path.join(process.resourcesPath, "skills")
      : path.join(process.cwd(), "resources", "skills");
    this.userDir = path.join(app.getPath("userData"), "skills");
    this.ensureDir(this.userDir);
    this.refresh();
  }

  // --- SkillService interface ---

  /** Return cached metadata (no disk I/O) */
  getAllMetadata(): SkillPackage[] {
    return Array.from(this.cache.values());
  }

  /** Load full skill content */
  async loadSkill(name: string): Promise<SkillContent | null> {
    const pkg = this.cache.get(name);
    if (!pkg) return null;
    return this.readContent(pkg);
  }

  /** Load a resource file with path traversal guard */
  async loadResource(
    skillName: string,
    relativePath: string
  ): Promise<string | null> {
    const pkg = this.cache.get(skillName);
    if (!pkg) return null;

    const resolved = path.resolve(pkg.path, relativePath);
    if (!resolved.startsWith(pkg.path + path.sep)) return null;
    if (!fs.existsSync(resolved)) return null;

    return fs.readFileSync(resolved, "utf-8");
  }

  // --- CRUD for frontend ---

  /** Rescan directories and rebuild cache */
  refresh(): void {
    this.cache.clear();
    this.scanDir(this.builtinDir, "builtin");
    this.scanDir(this.userDir, "user");
    console.log(
      `[SkillService] Loaded ${this.cache.size} skills`
    );
  }

  /** Import skill from folder */
  async importFromFolder(folderPath: string): Promise<SkillPackage> {
    const metadata = this.parseSkillMd(
      path.join(folderPath, "SKILL.md")
    );
    if (!metadata) {
      throw new Error("Invalid SKILL.md: missing name or description");
    }

    this.validatePackage(folderPath, metadata);

    const dest = path.join(this.userDir, metadata.name);
    if (fs.existsSync(dest)) {
      throw new Error(`Skill "${metadata.name}" already exists`);
    }

    this.copyDir(folderPath, dest);
    this.refresh();
    return this.cache.get(metadata.name)!;
  }

  /** Import skill from zip */
  async importFromZip(zipBuffer: Buffer): Promise<SkillPackage> {
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(zipBuffer);
    const tempDir = path.join(
      app.getPath("temp"),
      `skill-${Date.now()}`
    );

    try {
      zip.extractAllTo(tempDir, true);
      const skillRoot = this.findSkillRoot(tempDir);
      return this.importFromFolder(skillRoot);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /** Delete a user skill */
  async deleteSkill(name: string): Promise<void> {
    const pkg = this.cache.get(name);
    if (!pkg) throw new Error(`Skill "${name}" not found`);
    if (pkg.source === "builtin") {
      throw new Error("Cannot delete builtin skills");
    }

    fs.rmSync(pkg.path, { recursive: true, force: true });
    this.cache.delete(name);
  }

  // --- Private helpers ---

  /** Scan a directory for skill packages */
  private scanDir(dir: string, source: "builtin" | "user"): void {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const skillFile = path.join(dir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;

      const metadata = this.parseSkillMd(skillFile);
      if (!metadata || metadata.name !== entry.name) continue;

      this.cache.set(metadata.name, {
        ...metadata,
        path: path.join(dir, entry.name),
        source,
        enabled: true,
      });
    }
  }

  /** Parse SKILL.md frontmatter (js-yaml + fallback) */
  private parseSkillMd(filePath: string): SkillMetadata | null {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;

    // Primary: js-yaml
    try {
      const parsed = yaml.load(match[1]) as Record<string, unknown>;
      if (parsed?.name && parsed?.description) {
        return {
          name: String(parsed.name),
          description: String(parsed.description),
          metadata: (parsed.metadata as SkillMetadata["metadata"]) ?? undefined,
        };
      }
    } catch {
      /* fall through to fallback */
    }

    return this.parseFallback(match[1]);
  }

  /** Fallback frontmatter parser for edge cases */
  private parseFallback(text: string): SkillMetadata | null {
    const lines = text.split(/\r?\n/);
    let name: string | undefined;
    let description: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const nameMatch = lines[i].match(/^\s*name:\s*(.+)$/);
      if (nameMatch) {
        name = nameMatch[1].trim();
        continue;
      }

      const descMatch = lines[i].match(/^\s*description:\s*(.*)$/);
      if (descMatch) {
        const parts = [descMatch[1].trim()];
        while (i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1])) {
          parts.push(lines[++i].trim());
        }
        description = parts.filter(Boolean).join(" ");
      }
    }

    return name && description ? { name, description } : null;
  }

  /** Read full skill content from disk */
  private readContent(pkg: SkillPackage): SkillContent | null {
    const filePath = path.join(pkg.path, "SKILL.md");
    const content = fs.readFileSync(filePath, "utf-8");
    const endIdx = content.indexOf("---", content.indexOf("---") + 3);
    if (endIdx === -1) return null;

    const instructions = content.slice(endIdx + 3).trim();
    const resources = this.listResources(pkg.path);

    return {
      metadata: {
        name: pkg.name,
        description: pkg.description,
        metadata: pkg.metadata,
      },
      instructions,
      resources,
      basePath: pkg.path,
    };
  }

  /** List files in skill dir (excluding SKILL.md) */
  private listResources(dir: string, prefix = ""): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        files.push(...this.listResources(path.join(dir, entry.name), rel));
      } else if (entry.name !== "SKILL.md") {
        files.push(rel);
      }
    }
    return files;
  }

  /** Find SKILL.md root in extracted archive */
  private findSkillRoot(tempDir: string): string {
    if (fs.existsSync(path.join(tempDir, "SKILL.md"))) return tempDir;

    const entries = fs.readdirSync(tempDir, { withFileTypes: true });
    const sub = entries.find((e) => e.isDirectory());
    if (
      sub &&
      fs.existsSync(path.join(tempDir, sub.name, "SKILL.md"))
    ) {
      return path.join(tempDir, sub.name);
    }

    throw new Error("SKILL.md not found in archive");
  }

  /** Validate skill package before import */
  private validatePackage(dir: string, meta: SkillMetadata): void {
    if (!SKILL_NAME_REGEX.test(meta.name)) {
      throw new Error(`Invalid skill name: "${meta.name}"`);
    }
    if (meta.name.length > MAX_NAME_LENGTH) {
      throw new Error("Skill name too long (max 64)");
    }
    if (!meta.description || meta.description.length > MAX_DESC_LENGTH) {
      throw new Error("Description required (max 1024 chars)");
    }
    if (this.dirSize(dir) > MAX_PACKAGE_SIZE) {
      throw new Error("Package too large (max 1MB)");
    }
  }

  /** Calculate total directory size */
  private dirSize(dir: string): number {
    let size = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      size += entry.isDirectory()
        ? this.dirSize(p)
        : fs.statSync(p).size;
    }
    return size;
  }

  /** Recursively copy directory */
  private copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      entry.isDirectory() ? this.copyDir(s, d) : fs.copyFileSync(s, d);
    }
  }

  /** Ensure directory exists */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
