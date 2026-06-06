import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonStore<T> {
  private loaded = false;
  private value: T;
  private readonly path: string;

  constructor(path: string, initialValue: T) {
    this.path = path;
    this.value = initialValue;
  }

  async read(): Promise<T> {
    await this.load();
    return this.value;
  }

  async update(mutator: (value: T) => void): Promise<T> {
    await this.load();
    mutator(this.value);
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.value, null, 2));
    return this.value;
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
