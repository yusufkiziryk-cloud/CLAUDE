import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { MemoryStorageDriver } from "@studio/shared";
import { sampleGenerationRequest } from "@studio/test-utils";
import { TemplateScriptGenerator } from "@studio/creative-engine";
import { buildServer } from "./server.js";
import { MemoryGenerationQueue } from "./queue.js";

let app: FastifyInstance;
let queue: MemoryGenerationQueue;

beforeEach(() => {
  const storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 2 }));
  queue = new MemoryGenerationQueue({ storage, registry, pollIntervalMs: 1 });
  app = buildServer({ storage, registry, queue, scriptGenerator: new TemplateScriptGenerator() });
});

afterEach(async () => {
  await app.close();
});

async function createProject(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/projects",
    payload: {
      name: "Test Projesi",
      purpose: "reklam",
      aspectRatio: "16:9",
      targetDurationSec: 30,
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

describe("API uçtan uca (memory sürücüleri)", () => {
  it("health çalışır", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("proje oluşturma → listeleme → getirme akışı", async () => {
    const id = await createProject();
    const list = await app.inject({ method: "GET", url: "/projects" });
    expect(list.json().projects).toHaveLength(1);
    const get = await app.inject({ method: "GET", url: `/projects/${id}` });
    expect(get.json().name).toBe("Test Projesi");
  });

  it("geçersiz proje girdisi 400 + hata zarfı döner", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { name: "", purpose: "reklam", aspectRatio: "16:9", targetDurationSec: 30 },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.userMessage).toBeTruthy();
    expect(body.correlationId).toBeTruthy();
  });

  it("prompt sürümleri artan versiyon numarası alır", async () => {
    const projectId = await createProject();
    const body = { body: sampleGenerationRequest().prompt };
    const v1 = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/prompts`,
      payload: body,
    });
    expect(v1.statusCode).toBe(201);
    expect(v1.json().version).toBe(1);

    const v2 = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/prompts`,
      payload: { ...body, promptId: v1.json().promptId },
    });
    expect(v2.json().version).toBe(2);
  });

  it("providers manifest listesi mock sağlayıcıyı mock=true ile döner", async () => {
    const res = await app.inject({ method: "GET", url: "/providers" });
    const providers = res.json().providers;
    expect(providers).toHaveLength(1);
    expect(providers[0].providerId).toBe("mock");
    expect(providers[0].mock).toBe(true);
  });

  it("üretim: gönder → kuyruk işler → succeeded → varlık galeride", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: "/generations",
      payload: {
        projectId,
        request: sampleGenerationRequest(),
        idempotencyKey: "test-key-1",
      },
    });
    expect(res.statusCode).toBe(202);
    const job = res.json();
    expect(job.status).toBe("queued");
    expect(job.costEstimate.amount).toBe(0);

    await queue.drain();

    const done = await app.inject({ method: "GET", url: `/generations/${job.id}` });
    expect(done.json().status).toBe("succeeded");
    expect(done.json().resultAssetIds.length).toBeGreaterThan(0);

    const assets = await app.inject({ method: "GET", url: `/projects/${projectId}/assets` });
    const asset = assets.json().assets[0];
    expect(asset.provenance.mock).toBe(true);
    expect(asset.uri).toMatch(/^data:image\/png/);
  });

  it("aynı idempotency key ikinci istekte aynı işi döner (202 değil 200)", async () => {
    const projectId = await createProject();
    const payload = {
      projectId,
      request: sampleGenerationRequest(),
      idempotencyKey: "tekrar-deneme",
    };
    const first = await app.inject({ method: "POST", url: "/generations", payload });
    expect(first.statusCode).toBe(202);
    const second = await app.inject({ method: "POST", url: "/generations", payload });
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    await queue.drain();
  });

  it("desteklenmeyen ayar 422 + unsupported issue döner (sessizce yutulmaz)", async () => {
    const projectId = await createProject();
    const bad = sampleGenerationRequest();
    bad.prompt.output.durationSec = 42;
    const res = await app.inject({
      method: "POST",
      url: "/generations",
      payload: { projectId, request: bad },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().issues.some((i: { kind: string }) => i.kind === "unsupported")).toBe(true);
  });

  it("var olmayan projeye üretim isteği 404 döner", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/generations",
      payload: { projectId: "prj_yok", request: sampleGenerationRequest() },
    });
    expect(res.statusCode).toBe(404);
  });
});
