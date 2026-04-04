import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

export interface CacheOptions {
  readonly ttlMs: number;
  readonly cacheDir: string;
}

export class PersistentCache {
  private readonly memory: Map<string, { value: any; expiresAt: number }> = new Map();
  private readonly ttlMs: number;
  private readonly cacheDir: string;

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
    this.cacheDir = options.cacheDir;
  }

  private async ensureDir() {
    await mkdir(this.cacheDir, { recursive: true });
  }

  private getFilePath(key: string): string {
    const hash = createHash("md5").update(key).digest("hex");
    return join(this.cacheDir, `${hash}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // Check memory
    const cached = this.memory.get(key);
    if (cached) {
      if (cached.expiresAt > now) {
        return cached.value as T;
      }
      this.memory.delete(key);
    }

    // Check disk
    const filePath = this.getFilePath(key);
    try {
      const raw = await readFile(filePath, "utf8");
      const data = JSON.parse(raw);
      if (data.expiresAt > now) {
        // Hydrate memory
        this.memory.set(key, data);
        return data.value as T;
      }
      // Cleanup expired
      this.memory.delete(key);
    } catch {
      // Not found or malformed
    }

    return null;
  }

  async set(key: string, value: any, customTtl?: number): Promise<void> {
    const expiresAt = Date.now() + (customTtl ?? this.ttlMs);
    const data = { value, expiresAt };

    // Update memory
    this.memory.set(key, data);

    // Update disk
    const filePath = this.getFilePath(key);
    try {
      await this.ensureDir();
      await writeFile(filePath, JSON.stringify(data), "utf8");
    } catch (err) {
      console.warn(`[Cache] Failed to persist key ${key}`, err);
    }
  }

  async clear(): Promise<void> {
    this.memory.clear();
    // Disk clearing would require readdir/unlink, skipping for now for safety
  }
}

// Singleton for common use
let globalInferenceCache: PersistentCache | null = null;

export function getInferenceCache(root: string): PersistentCache {
  if (!globalInferenceCache) {
    globalInferenceCache = new PersistentCache({
      ttlMs: 1000 * 60 * 60 * 24, // 24 hours
      cacheDir: join(root, ".srp", "cache", "inference")
    });
  }
  return globalInferenceCache;
}
