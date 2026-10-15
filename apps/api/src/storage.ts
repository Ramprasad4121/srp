import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Single-process JSON file store. Writes are serialized and atomic (temp file + rename), so concurrent
 * requests cannot interleave and a crash mid-write cannot leave a truncated file.
 * Not for multi-replica deployments; see docs/deployment.md.
 */
export class JsonStore<T> {
  private loaded = false;
  private value: T;
  private readonly path: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(path: string, initialValue: T) {
    this.path = path;
    this.value = initialValue;
  }

  async read(): Promise<T> {
    await this.load();
    return this.value;
  }

  update(mutator: (value: T) => void): Promise<T> {
    const run = this.queue.then(async () => {
      await this.load();
      mutator(this.value);
      await mkdir(dirname(this.path), { recursive: true });
      const temp = `${this.path}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(this.value));
      await rename(temp, this.path);
      return this.value;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      this.value = JSON.parse(await readFile(this.path, "utf8")) as T;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    this.loaded = true;
  }
}
