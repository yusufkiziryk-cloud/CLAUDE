import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry, type ProviderManifest } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { LocalDiskObjectStore, MemoryStorageDriver } from "@studio/shared";
import { TemplateScriptGenerator } from "@studio/creative-engine";
import { newId, type GenerationJob } from "@studio/domain";
import { sampleGenerationRequest } from "@studio/test-utils";
import { buildServer } from "./server.js";
import { MemoryGenerationQueue } from "./queue.js";

/** Manifest çağrılarını sayan sarmalayıcı: önbellek/yenileme davranışını doğrular. */
class CountingMockAdapter extends MockProviderAdapter {
  manifestCalls = 0;

  override async manifest(): Promise<ProviderManifest> {
    this.manifestCalls += 1;
    return super.manifest();
  }
}

let app: FastifyInstance;
let storage: MemoryStorageDriver;
let queue: MemoryGenerationQueue;
let countingAdapter: CountingMockAdapter;

beforeEach(() => {
  storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  countingAdapter = new CountingMockAdapter({ completeAfterPolls: 1 });
  registry.register(MOCK_PROVIDER_ID, countingAdapter);
  const objectStore = new LocalDiskObjectStore(mkdtempSync(join(tmpdir(), "objects-")));
  queue = new MemoryGenerationQueue({ storage, registry, objectStore, pollIntervalMs: 1 });
  app = buildServer({
    storage,
    registry,
    queue,
    scriptGenerator: new TemplateScriptGenerator(),
    objectStore,
    rendersDir: mkdtempSync(join(tmpdir(), "renders-")),
  });
});

afterEach(async () => {
  await app.close();
});

async function createProject(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/projects",
    payload: { name: "Analitik", purpose: "reklam", aspectRatio: "16:9", targetDurationSec: 30 },
  });
  return res.json().id as string;
}

function makeJob(
  projectId: string,
  overrides: Partial<GenerationJob> & { modelId?: string },
): GenerationJob {
  const now = new Date().toISOString();
  const { modelId, ...jobOverrides } = overrides;
  return {
    id: newId("gen"),
    projectId,
    request: sampleGenerationRequest({
      providerId: MOCK_PROVIDER_ID,
      modelId: modelId ?? "mock-video-fast",
    }),
    status: "succeeded",
    progress: 100,
    idempotencyKey: newId("idem"),
    resultAssetIds: [],
    createdAt: now,
    updatedAt: now,
    ...jobOverrides,
  };
}

describe("Faz 7: sağlayıcı manifest yenileme", () => {
  it("GET /providers manifesti TTL önbelleğinden verir; POST /providers/refresh taze çeker", async () => {
    await app.inject({ method: "GET", url: "/providers" });
    await app.inject({ method: "GET", url: "/providers" });
    expect(countingAdapter.manifestCalls).toBe(1); // ikinci çağrı önbellekten

    const res = await app.inject({ method: "POST", url: "/providers/refresh" });
    expect(res.statusCode).toBe(200);
    expect(countingAdapter.manifestCalls).toBe(2); // önbellek boşaltıldı, taze çekildi
    const body = res.json();
    expect(body.providers.length).toBeGreaterThan(0);
    expect(typeof body.refreshedAt).toBe("string");
  });
});

describe("Faz 7: proje analitiği", () => {
  it("bilinmeyen proje 404 döner", async () => {
    const res = await app.inject({ method: "GET", url: "/projects/yok/analytics" });
    expect(res.statusCode).toBe(404);
  });

  it("boş projede sıfır iş ve boş model listesi döner", async () => {
    const projectId = await createProject();
    const res = await app.inject({ method: "GET", url: `/projects/${projectId}/analytics` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ projectId, totalJobs: 0, models: [] });
  });

  it("model bazında sayı, başarı oranı, ortalama süre ve gerçek maliyeti toplar", async () => {
    const projectId = await createProject();
    const t0 = "2026-08-02T10:00:00.000Z";

    // mock-video-fast: 2 başarılı (4sn ve 6sn), 1 başarısız, 1 kuyrukta (orana dahil değil)
    await storage.createGenerationJob(
      makeJob(projectId, {
        modelId: "mock-video-fast",
        startedAt: t0,
        finishedAt: "2026-08-02T10:00:04.000Z",
        actualCostUsd: 0.05,
      }),
    );
    await storage.createGenerationJob(
      makeJob(projectId, {
        modelId: "mock-video-fast",
        startedAt: t0,
        finishedAt: "2026-08-02T10:00:06.000Z",
        actualCostUsd: 0.07,
      }),
    );
    await storage.createGenerationJob(
      makeJob(projectId, { modelId: "mock-video-fast", status: "failed" }),
    );
    await storage.createGenerationJob(
      makeJob(projectId, { modelId: "mock-video-fast", status: "queued", progress: 0 }),
    );
    // mock-video-quality: 1 başarılı, süre/maliyet bilgisi yok
    await storage.createGenerationJob(makeJob(projectId, { modelId: "mock-video-quality" }));

    const res = await app.inject({ method: "GET", url: `/projects/${projectId}/analytics` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalJobs).toBe(5);
    expect(body.models).toHaveLength(2);

    const fast = body.models.find((m: { modelId: string }) => m.modelId === "mock-video-fast");
    expect(fast).toMatchObject({
      providerId: MOCK_PROVIDER_ID,
      total: 4,
      succeeded: 2,
      failed: 1,
      avgDurationSec: 5, // (4+6)/2
      totalCostUsd: 0.12,
    });
    expect(fast.successRate).toBeCloseTo(2 / 3, 3);

    const quality = body.models.find(
      (m: { modelId: string }) => m.modelId === "mock-video-quality",
    );
    expect(quality).toMatchObject({
      total: 1,
      succeeded: 1,
      failed: 0,
      successRate: 1,
      avgDurationSec: null,
      totalCostUsd: 0,
    });
  });
});
