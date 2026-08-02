import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { LocalDiskObjectStore, MemoryStorageDriver } from "@studio/shared";
import { TemplateScriptGenerator } from "@studio/creative-engine";
import { newId, type GenerationJob } from "@studio/domain";
import { sampleGenerationRequest } from "@studio/test-utils";
import { buildServer, type ServerDeps } from "./server.js";
import { MemoryGenerationQueue } from "./queue.js";

let app: FastifyInstance;

function makeApp(overrides: Partial<ServerDeps> = {}): {
  app: FastifyInstance;
  storage: MemoryStorageDriver;
} {
  const storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 1 }));
  const objectStore = new LocalDiskObjectStore(mkdtempSync(join(tmpdir(), "objects-")));
  const queue = new MemoryGenerationQueue({ storage, registry, objectStore, pollIntervalMs: 1 });
  app = buildServer({
    storage,
    registry,
    queue,
    scriptGenerator: new TemplateScriptGenerator(),
    objectStore,
    rendersDir: mkdtempSync(join(tmpdir(), "renders-")),
    rateLimitPerMin: false, // her test kendi limitini açar
    ...overrides,
  });
  return { app, storage };
}

afterEach(async () => {
  await app.close();
});

async function createProject(appRef: FastifyInstance, budgetUsd?: number): Promise<string> {
  const res = await appRef.inject({
    method: "POST",
    url: "/projects",
    payload: {
      name: "Sertleştirme",
      purpose: "reklam",
      aspectRatio: "16:9",
      targetDurationSec: 30,
      ...(budgetUsd !== undefined ? { budgetUsd } : {}),
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

describe("Faz 8: güvenlik başlıkları ve limitler", () => {
  it("helmet başlıkları döner; /files medyası cross-origin okunabilir kalır", async () => {
    makeApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("corsOrigin verilince yalnızca o origin'e izin verilir", async () => {
    makeApp({ corsOrigin: "http://localhost:3000" });
    const ok = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:3000" },
    });
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    // Statik origin yapılandırması her yanıtta aynı değeri döner; farklı origin'den
    // gelen isteğe İZİN VERİLMEDİĞİNİ tarayıcı bu uyuşmazlıktan anlar.
    const other = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://kotu-site.example" },
    });
    expect(other.headers["access-control-allow-origin"]).not.toBe("https://kotu-site.example");
  });

  it("istek sınırı aşılınca hata zarfıyla 429 döner", async () => {
    makeApp({ rateLimitPerMin: 3 });
    for (let i = 0; i < 3; i++) {
      expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    }
    const limited = await app.inject({ method: "GET", url: "/health" });
    expect(limited.statusCode).toBe(429);
    const body = limited.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.retryable).toBe(true);
  });

  it("gövde sınırını aşan JSON 413 ile reddedilir", async () => {
    makeApp({ bodyLimitBytes: 1024 });
    const res = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { name: "x".repeat(5000), purpose: "reklam" },
    });
    expect(res.statusCode).toBe(413);
  });

  it("/files path traversal girişimi 404 döner", async () => {
    makeApp();
    const res = await app.inject({ method: "GET", url: "/files/..%2F..%2Fetc%2Fpasswd" });
    expect(res.statusCode).toBe(404);
  });
});

describe("Faz 8: proje bütçesi", () => {
  function spentJob(projectId: string, actualCostUsd: number): GenerationJob {
    const now = new Date().toISOString();
    return {
      id: newId("gen"),
      projectId,
      request: sampleGenerationRequest({
        providerId: MOCK_PROVIDER_ID,
        modelId: "mock-video-fast",
      }),
      status: "succeeded",
      progress: 100,
      idempotencyKey: newId("idem"),
      actualCostUsd,
      resultAssetIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  it("bütçesiz projede üretim serbesttir", async () => {
    const { app: a } = makeApp();
    const projectId = await createProject(a);
    const res = await a.inject({
      method: "POST",
      url: "/generations",
      payload: {
        projectId,
        request: sampleGenerationRequest({
          providerId: MOCK_PROVIDER_ID,
          modelId: "mock-video-fast",
        }),
        idempotencyKey: newId("idem"),
      },
    });
    expect(res.statusCode).toBe(202);
  });

  it("gerçekleşen harcama bütçeyi aşmışsa yeni üretim 402 BUDGET_EXCEEDED döner", async () => {
    const { app: a, storage } = makeApp();
    const projectId = await createProject(a, 1.0);
    await storage.createGenerationJob(spentJob(projectId, 2.0)); // bütçe zaten aşıldı

    const res = await a.inject({
      method: "POST",
      url: "/generations",
      payload: {
        projectId,
        request: sampleGenerationRequest({
          providerId: MOCK_PROVIDER_ID,
          modelId: "mock-video-fast",
        }),
        idempotencyKey: newId("idem"),
      },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().code).toBe("BUDGET_EXCEEDED");
  });

  it("bütçe içindeyse üretim kabul edilir (mock tahmini $0)", async () => {
    const { app: a, storage } = makeApp();
    const projectId = await createProject(a, 5.0);
    await storage.createGenerationJob(spentJob(projectId, 1.5));

    const res = await a.inject({
      method: "POST",
      url: "/generations",
      payload: {
        projectId,
        request: sampleGenerationRequest({
          providerId: MOCK_PROVIDER_ID,
          modelId: "mock-video-fast",
        }),
        idempotencyKey: newId("idem"),
      },
    });
    expect(res.statusCode).toBe(202);
  });
});
