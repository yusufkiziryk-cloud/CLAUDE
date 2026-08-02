import { describe, expect, it, vi } from "vitest";
import { ProviderRegistry } from "./registry.js";
import { toErrorEnvelope } from "./errors.js";
import type { MediaProviderAdapter, ProviderManifest } from "./types.js";

function fakeAdapter(manifest: ProviderManifest): MediaProviderAdapter {
  return {
    manifest: vi.fn(async () => manifest),
    validate: () => ({ ok: true, issues: [] }),
    estimate: async () => ({
      currency: "USD" as const,
      amount: 0,
      source: "test",
      asOf: new Date().toISOString(),
      isExact: false,
    }),
    compile: () => ({ providerId: manifest.providerId, modelId: "m", payload: {} }),
    submit: async () => ({
      providerId: manifest.providerId,
      externalJobId: "e1",
      submittedAt: new Date().toISOString(),
    }),
    getStatus: async () => ({ state: "succeeded" as const }),
    normalizeResult: async () => ({
      artifacts: [],
      provenance: {
        providerId: manifest.providerId,
        modelId: "m",
        parameters: {},
        generatedAt: new Date().toISOString(),
        mock: true,
      },
    }),
  };
}

const manifest: ProviderManifest = {
  providerId: "test",
  displayName: "Test",
  mock: true,
  cacheTtlSec: 60,
  models: [],
};

describe("ProviderRegistry", () => {
  it("kayıt ve erişim çalışır; çift kayıt reddedilir", () => {
    const registry = new ProviderRegistry();
    const adapter = fakeAdapter(manifest);
    registry.register("test", adapter);
    expect(registry.get("test")).toBe(adapter);
    expect(registry.list()).toEqual(["test"]);
    expect(() => registry.register("test", adapter)).toThrow(/zaten kayıtlı/);
  });

  it("bilinmeyen sağlayıcı için anlaşılır hata fırlatır", () => {
    expect(() => new ProviderRegistry().get("yok")).toThrow(/Bilinmeyen sağlayıcı/);
  });

  it("manifest TTL içinde önbellekten döner, TTL sonrasında yenilenir", async () => {
    const registry = new ProviderRegistry();
    const adapter = fakeAdapter(manifest);
    registry.register("test", adapter);

    let now = 0;
    await registry.manifest("test", () => now);
    await registry.manifest("test", () => now + 30_000);
    expect(adapter.manifest).toHaveBeenCalledTimes(1);

    now = 120_000; // 60sn TTL aşıldı
    await registry.manifest("test", () => now);
    expect(adapter.manifest).toHaveBeenCalledTimes(2);
  });
});

describe("toErrorEnvelope", () => {
  it("ham hatayı Türkçe kullanıcı mesajlı zarfa çevirir", () => {
    const envelope = toErrorEnvelope(new Error("boom"), { code: "X", retryable: true });
    expect(envelope.code).toBe("X");
    expect(envelope.retryable).toBe(true);
    expect(envelope.developerMessage).toBe("boom");
    expect(envelope.userMessage).toMatch(/tekrar deneyebilirsiniz/);
  });
});
