import type { MediaProviderAdapter, ProviderManifest } from "./types.js";

/**
 * Adaptör kayıt defteri. Uygulama açılışında adaptörler buraya kaydolur;
 * çekirdek kod sağlayıcıya yalnızca providerId üzerinden erişir.
 */
export class ProviderRegistry {
  private readonly adapters = new Map<string, MediaProviderAdapter>();
  private readonly manifestCache = new Map<string, { manifest: ProviderManifest; at: number }>();

  register(providerId: string, adapter: MediaProviderAdapter): void {
    if (this.adapters.has(providerId)) {
      throw new Error(`Sağlayıcı zaten kayıtlı: ${providerId}`);
    }
    this.adapters.set(providerId, adapter);
  }

  get(providerId: string): MediaProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Bilinmeyen sağlayıcı: ${providerId}`);
    }
    return adapter;
  }

  list(): string[] {
    return [...this.adapters.keys()];
  }

  /** Manifestleri TTL'e göre önbellekler; sağlayıcı API'sine gereksiz çağrıyı önler. */
  async manifest(providerId: string, now: () => number = Date.now): Promise<ProviderManifest> {
    const cached = this.manifestCache.get(providerId);
    if (cached && (now() - cached.at) / 1000 < cached.manifest.cacheTtlSec) {
      return cached.manifest;
    }
    const manifest = await this.get(providerId).manifest();
    this.manifestCache.set(providerId, { manifest, at: now() });
    return manifest;
  }

  async allManifests(): Promise<ProviderManifest[]> {
    return Promise.all(this.list().map((id) => this.manifest(id)));
  }
}
