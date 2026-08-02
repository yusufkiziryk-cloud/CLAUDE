import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { MemoryStorageDriver } from "@studio/shared";
import { sampleGenerationRequest } from "@studio/test-utils";
import { buildServer } from "./server.js";
import { MemoryGenerationQueue } from "./queue.js";

let app: FastifyInstance;

beforeEach(() => {
  const storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 1 }));
  app = buildServer({
    storage,
    registry,
    queue: new MemoryGenerationQueue({ storage, registry, pollIntervalMs: 1 }),
  });
});

afterEach(async () => {
  await app.close();
});

describe("Faz 2 API uçları", () => {
  it("şablon oluştur → listele → sil akışı", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/templates",
      payload: {
        name: "Sinematik sokak",
        description: "Akşam sokak sahneleri için taban",
        body: sampleGenerationRequest().prompt,
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const list = await app.inject({ method: "GET", url: "/templates" });
    expect(list.json().templates).toHaveLength(1);
    expect(list.json().templates[0].name).toBe("Sinematik sokak");

    const del = await app.inject({ method: "DELETE", url: `/templates/${id}` });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/templates" })).json().templates).toHaveLength(
      0,
    );

    const delAgain = await app.inject({ method: "DELETE", url: `/templates/${id}` });
    expect(delAgain.statusCode).toBe(404);
  });

  it("/estimate geçerli istekte tahmin döner", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/estimate",
      payload: { request: sampleGenerationRequest() },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.validation.ok).toBe(true);
    expect(body.estimate.currency).toBe("USD");
    expect(body.estimate.source).toBeTruthy();
  });

  it("/estimate desteklenmeyen istekte tahmin yerine doğrulama sorunları döner", async () => {
    const bad = sampleGenerationRequest();
    bad.prompt.output.durationSec = 42;
    const res = await app.inject({ method: "POST", url: "/estimate", payload: { request: bad } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.validation.ok).toBe(false);
    expect(body.estimate).toBeNull();
  });

  it("/estimate yapılandırılmamış sağlayıcı için anlaşılır 404 döner", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/estimate",
      payload: { request: sampleGenerationRequest({ providerId: "fal" }) },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("PROVIDER_NOT_CONFIGURED");
    expect(res.json().userMessage).toContain("API anahtarı");
  });
});
