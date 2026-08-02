import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { MemoryStorageDriver } from "@studio/shared";
import { TemplateScriptGenerator } from "@studio/creative-engine";
import { buildServer } from "./server.js";
import { MemoryGenerationQueue } from "./queue.js";

let app: FastifyInstance;
let queue: MemoryGenerationQueue;

beforeEach(() => {
  const storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 1 }));
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
      name: "Kahve Tanıtımı",
      purpose: "reklam",
      aspectRatio: "16:9",
      targetDurationSec: 30,
    },
  });
  return res.json().id as string;
}

async function setupBrief(projectId: string) {
  const res = await app.inject({
    method: "PUT",
    url: `/projects/${projectId}/brief`,
    payload: {
      audience: "Genç profesyoneller",
      goal: "Yeni kahve markasını tanıtmak",
      tone: "samimi",
      platform: "Instagram Reels",
      cta: "Şimdi dene",
      keyMessages: ["Taze kavrulmuş"],
    },
  });
  expect([200, 201]).toContain(res.statusCode);
  return res.json();
}

describe("Faz 3: brief → senaryo → sahne → storyboard", () => {
  it("brief olmadan senaryo istenirse 422 BRIEF_REQUIRED döner", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/script`,
      payload: { format: "reklam" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("BRIEF_REQUIRED");
  });

  it("uçtan uca: brief → senaryo (template etiketi) → sahne planı → tutarlılık", async () => {
    const projectId = await createProject();
    await setupBrief(projectId);

    const script = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/script`,
      payload: { format: "reklam" },
    });
    expect(script.statusCode).toBe(201);
    expect(script.json().generator).toBe("template");
    expect(script.json().sections.length).toBeGreaterThanOrEqual(3);

    const scenes = await app.inject({
      method: "POST",
      url: `/scripts/${script.json().id}/scenes`,
      payload: {},
    });
    expect(scenes.statusCode).toBe(201);
    const sceneList = scenes.json().scenes;
    expect(sceneList.length).toBe(script.json().sections.length);
    const total = sceneList.reduce((s: number, x: { durationSec: number }) => s + x.durationSec, 0);
    expect(Math.abs(total - 30)).toBeLessThanOrEqual(5);

    const continuity = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/continuity`,
    });
    expect(continuity.statusCode).toBe(200);
    expect(Array.isArray(continuity.json().issues)).toBe(true);
  });

  it("sahne süresi güncellenebilir ve süre sapması tutarlılıkta görünür", async () => {
    const projectId = await createProject();
    await setupBrief(projectId);
    const script = (
      await app.inject({
        method: "POST",
        url: `/projects/${projectId}/script`,
        payload: { format: "reklam" },
      })
    ).json();
    const scenes = (
      await app.inject({ method: "POST", url: `/scripts/${script.id}/scenes`, payload: {} })
    ).json().scenes;

    const patch = await app.inject({
      method: "PATCH",
      url: `/scenes/${scenes[0].id}`,
      payload: { durationSec: 300 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().durationSec).toBe(300);

    const continuity = (
      await app.inject({ method: "GET", url: `/projects/${projectId}/continuity` })
    ).json();
    expect(
      continuity.issues.some((i: { code: string }) => i.code === "TOTAL_DURATION_MISMATCH"),
    ).toBe(true);
  });

  it("bible CRUD çalışır; rızasız gerçek kişi storyboard'u 403 ile engellenir", async () => {
    const projectId = await createProject();
    await setupBrief(projectId);
    const script = (
      await app.inject({
        method: "POST",
        url: `/projects/${projectId}/script`,
        payload: { format: "reklam" },
      })
    ).json();
    const scenes = (
      await app.inject({ method: "POST", url: `/scripts/${script.id}/scenes`, payload: {} })
    ).json().scenes;

    const card = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/bible`,
      payload: {
        kind: "character",
        name: "Ayşe",
        description: "Gerçek sunucu",
        isRealPerson: true,
        consentConfirmed: false,
      },
    });
    expect(card.statusCode).toBe(201);

    await app.inject({
      method: "PATCH",
      url: `/scenes/${scenes[0].id}`,
      payload: { characterNames: ["Ayşe"] },
    });

    const blocked = await app.inject({
      method: "POST",
      url: `/scenes/${scenes[0].id}/storyboard`,
      payload: { providerId: "mock", modelId: "mock-image" },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe("CONSENT_REQUIRED");

    // Rıza onaylanınca üretim açılır
    await app.inject({
      method: "PATCH",
      url: `/bible/${card.json().id}`,
      payload: { consentConfirmed: true },
    });
    const allowed = await app.inject({
      method: "POST",
      url: `/scenes/${scenes[0].id}/storyboard`,
      payload: { providerId: "mock", modelId: "mock-image" },
    });
    expect(allowed.statusCode).toBe(202);
  });

  it("storyboard üretimi: kilitli parça prompta eklenir, job tamamlanır, varlık oluşur", async () => {
    const projectId = await createProject();
    await setupBrief(projectId);
    const script = (
      await app.inject({
        method: "POST",
        url: `/projects/${projectId}/script`,
        payload: { format: "reklam" },
      })
    ).json();
    const scenes = (
      await app.inject({ method: "POST", url: `/scripts/${script.id}/scenes`, payload: {} })
    ).json().scenes;

    await app.inject({
      method: "POST",
      url: `/projects/${projectId}/bible`,
      payload: {
        kind: "character",
        name: "Barista",
        description: "Kahveci",
        promptFragment: "yeşil önlüklü barista",
      },
    });
    await app.inject({
      method: "PATCH",
      url: `/scenes/${scenes[0].id}`,
      payload: { characterNames: ["Barista"] },
    });

    const job = await app.inject({
      method: "POST",
      url: `/scenes/${scenes[0].id}/storyboard`,
      payload: { providerId: "mock", modelId: "mock-image" },
    });
    expect(job.statusCode).toBe(202);
    expect(job.json().request.prompt.subject.description).toContain("yeşil önlüklü barista");
    expect(job.json().request.capability).toBe("textToImage");

    await queue.drain();

    const done = await app.inject({ method: "GET", url: `/generations/${job.json().id}` });
    expect(done.json().status).toBe("succeeded");
    expect(done.json().resultAssetIds.length).toBeGreaterThan(0);

    // Sahnede storyboardJobId bağlanmış olmalı
    const sceneList = (
      await app.inject({ method: "GET", url: `/projects/${projectId}/scenes` })
    ).json();
    expect(sceneList.scenes[0].storyboardJobId).toBe(job.json().id);
  });
});
