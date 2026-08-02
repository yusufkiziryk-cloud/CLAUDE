import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { assertValidKey, mimeFromKey, type ObjectStore } from "./types.js";

/** Yerel disk sürücüsü: geliştirme ve Windows masaüstü için varsayılan. */
export class LocalDiskObjectStore implements ObjectStore {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    assertValidKey(key);
    const path = normalize(join(this.baseDir, key));
    if (!path.startsWith(normalize(this.baseDir))) {
      throw new Error(`Geçersiz nesne anahtarı (dizin dışı): ${key}`);
    }
    return path;
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const data = await readFile(this.resolve(key));
      return { data, contentType: mimeFromKey(key) };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  publicPath(key: string): string {
    assertValidKey(key);
    return `/files/${key}`;
  }
}
