import { describe, expect, it } from "vitest";
import { newId, type GenerationJob } from "@studio/domain";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { sampleGenerationRequest } from "@studio/test-utils";
import { MemoryStorageDriver } from "../storage/memory.js";
import { processGenerationJob } from "./processor.js";

function setup() {
  const storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 2 }));
  return { storage, registry };
}

function makeJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  const now = new Date().toISOString();
  return {
    id: newId("gen"),
    projectId: "prj_test",
    request: sampleGenerationRequest(),
    status: "queued",
    progress: 0,
    idempotencyKey: newId("idem"),
    resultAssetIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("processGenerationJob", () => {
  it("queued işi succeeded'a taşır ve provenance'lı varlık üretir", async () => {
    const { storage, registry } = setup();
    const job = await storage.createGenerationJob(makeJob());

    await processGenerationJob(job.id, { storage, registry, pollIntervalMs: 1 });

    const done = await storage.getGenerationJob(job.id);
    expect(done?.status).toBe("succeeded");
    expect(done?.progress).toBe(100);
    expect(done?.resultAssetIds.length).toBeGreaterThan(0);
    expect(done?.actualCostUsd).toBe(0);

    const asset = await storage.getAsset(done!.resultAssetIds[0]!);
    expect(asset?.provenance?.mock).toBe(true);
    expect(asset?.provenance?.providerId).toBe(MOCK_PROVIDER_ID);
    expect(asset?.uri.startsWith("data:image/png")).toBe(true);
  });

  it("aynı iş ikinci kez teslim edilirse yeniden işlemez (idempotent)", async () => {
    const { storage, registry } = setup();
    const job = await storage.createGenerationJob(makeJob());

    await processGenerationJob(job.id, { storage, registry, pollIntervalMs: 1 });
    const afterFirst = await storage.getGenerationJob(job.id);

    await processGenerationJob(job.id, { storage, registry, pollIntervalMs: 1 });
    const afterSecond = await storage.getGenerationJob(job.id);

    expect(afterSecond?.resultAssetIds).toEqual(afterFirst?.resultAssetIds);
    expect((await storage.listAssets("prj_test")).length).toBe(
      afterFirst?.resultAssetIds.length ?? 0,
    );
  });

  it("bilinmeyen sağlayıcıda işi failed'a taşır ve hata zarfı yazar", async () => {
    const { storage, registry } = setup();
    const job = await storage.createGenerationJob(
      makeJob({ request: sampleGenerationRequest({ providerId: "yok-boyle-saglayici" }) }),
    );

    await processGenerationJob(job.id, { storage, registry, pollIntervalMs: 1 });

    const done = await storage.getGenerationJob(job.id);
    expect(done?.status).toBe("failed");
    expect(done?.error?.userMessage).toBeTruthy();
    expect(done?.error?.correlationId).toBe(job.id);
  });

  it("hiç tamamlanmayan sağlayıcıda maxPolls sonrası expired olur", async () => {
    const { storage } = setup();
    // 100 poll'da tamamlanacak ama maxPolls=3 → zaman aşımı
    const slowRegistry = new ProviderRegistry();
    slowRegistry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 100 }));
    const job = await storage.createGenerationJob(makeJob());

    await processGenerationJob(job.id, {
      storage,
      registry: slowRegistry,
      pollIntervalMs: 1,
      maxPolls: 3,
    });

    const done = await storage.getGenerationJob(job.id);
    expect(done?.status).toBe("expired");
    expect(done?.error?.retryable).toBe(true);
  });
});
