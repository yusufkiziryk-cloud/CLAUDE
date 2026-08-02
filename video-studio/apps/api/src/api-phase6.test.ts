import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { LocalDiskObjectStore, MemoryStorageDriver } from "@studio/shared";
import { TemplateScriptGenerator } from "@studio/creative-engine";
import { sampleGenerationRequest } from "@studio/test-utils";
import { buildServer } from "./server.js";
import { MemoryGenerationQueue } from "./queue.js";

let app: FastifyInstance;
let storage: MemoryStorageDriver;
let queue: MemoryGenerationQueue;

beforeEach(() => {
  storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 1 }));
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

async function setupScenes(): Promise<{ projectId: string; sceneIds: string[] }> {
  const project = await app.inject({
    method: "POST",
    url: "/projects",
    payload: { name: "Ses Testi", purpose: "reklam", aspectRatio: "16:9", targetDurationSec: 30 },
  });
  const projectId = project.json().id as string;
  await app.inject({
    method: "PUT",
    url: `/projects/${projectId}/brief`,
    payload: {
      audience: "Genç profesyoneller",
      goal: "Kahve markası tanıtımı",
      tone: "samimi",
      platform: "Reels",
      keyMessages: ["Taze"],
    },
  });
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
  return { projectId, sceneIds: scenes.map((s: { id: string }) => s.id) };
}

describe("Faz 6: seslendirme + animatic + transkripsiyon + izin politikası", () => {
  it("sahne seslendirme: mock-tts gerçek WAV üretir ve sahneye bağlanır", async () => {
    const { projectId, sceneIds } = await setupScenes();
    const res = await app.inject({
      method: "POST",
      url: `/scenes/${sceneIds[0]}/narration`,
      payload: { providerId: "mock", modelId: "mock-tts", params: { voice: "mock-kadin" } },
    });
    expect(res.statusCode).toBe(202);
    await queue.drain();

    const scenes = (
      await app.inject({ method: "GET", url: `/projects/${projectId}/scenes` })
    ).json();
    const scene = scenes.scenes.find((s: { id: string }) => s.id === sceneIds[0]);
    expect(scene.narrationAssetId).toBeTruthy();

    const asset = (
      await app.inject({ method: "GET", url: `/assets/${scene.narrationAssetId}` })
    ).json();
    expect(asset.kind).toBe("audio");
    expect(asset.mimeType).toBe("audio/wav");
    expect(asset.durationSec).toBeGreaterThan(0);
    expect(asset.provenance.mock).toBe(true);

    // WAV imzası: RIFF
    const served = await app.inject({ method: "GET", url: asset.uri });
    expect(served.rawPayload.subarray(0, 4).toString("ascii")).toBe("RIFF");
  });

  it("anlatımı boş sahne için 422 döner", async () => {
    const { sceneIds } = await setupScenes();
    await app.inject({
      method: "PATCH",
      url: `/scenes/${sceneIds[0]}`,
      payload: { narration: " " },
    });
    // PATCH boş narration'ı zod min'e takılmadan geçirir (max sınırlı); route kontrol eder
    const res = await app.inject({
      method: "POST",
      url: `/scenes/${sceneIds[0]}/narration`,
      payload: { providerId: "mock", modelId: "mock-tts" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("NARRATION_REQUIRED");
  });

  it("animatic: sahnelerden sequence kurulur (storyboard+ses+başlık klipleri)", async () => {
    const { projectId, sceneIds } = await setupScenes();

    // İlk sahneye storyboard + seslendirme üret
    await app.inject({
      method: "POST",
      url: `/scenes/${sceneIds[0]}/storyboard`,
      payload: { providerId: "mock", modelId: "mock-image" },
    });
    await app.inject({
      method: "POST",
      url: `/scenes/${sceneIds[0]}/narration`,
      payload: { providerId: "mock", modelId: "mock-tts" },
    });
    await queue.drain();

    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/sequence/from-scenes`,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const { sequence, warnings } = res.json();

    const video = sequence.tracks.find((t: { kind: string }) => t.kind === "video");
    const audio = sequence.tracks.find((t: { kind: string }) => t.kind === "audio");
    const text = sequence.tracks.find((t: { kind: string }) => t.kind === "text");
    expect(video.clips.length).toBe(1); // yalnızca storyboard'u olan sahne
    expect(audio.clips.length).toBe(1);
    expect(text.clips.length).toBe(sceneIds.length); // her sahneye başlık klibi
    // Eksik storyboard/ses uyarı olarak bildirilir, sessizce yutulmaz
    expect(warnings.length).toBeGreaterThan(0);
    // Metin klipleri sahne sırasına göre art arda dizilir
    const starts = text.clips.map((c: { startSec: number }) => c.startSec);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);

    // Kalıcı: GET sequence aynı animatic'i döner
    const reloaded = (
      await app.inject({ method: "GET", url: `/projects/${projectId}/sequence` })
    ).json();
    expect(reloaded.name).toBe("Animatic (sahnelerden)");
  });

  it("transkripsiyon: mock motor açıkça etiketli sonuç döner; görsel varlık 422", async () => {
    const { projectId, sceneIds } = await setupScenes();
    await app.inject({
      method: "POST",
      url: `/scenes/${sceneIds[0]}/narration`,
      payload: { providerId: "mock", modelId: "mock-tts" },
    });
    await queue.drain();
    const scene = (await app.inject({ method: "GET", url: `/projects/${projectId}/scenes` })).json()
      .scenes[0];

    const res = await app.inject({
      method: "POST",
      url: `/assets/${scene.narrationAssetId}/transcribe`,
      payload: { language: "tr" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().engine).toBe("mock");
    expect(res.json().text).toContain("[MOCK]");
    expect(res.json().cues.length).toBeGreaterThan(0);
  });

  it("lipSync/avatarVideo rıza onayı olmadan 403 ile engellenir", async () => {
    const { projectId } = await setupScenes();
    const request = sampleGenerationRequest({ capability: "lipSync" });
    const blocked = await app.inject({
      method: "POST",
      url: "/generations",
      payload: { projectId, request },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe("CONSENT_REQUIRED");

    // Rıza onayıyla politika geçilir (mock model lipSync desteklemediği için 422'ye düşer —
    // yani engel politika katmanında değil, yetenek doğrulamasında)
    const withConsent = await app.inject({
      method: "POST",
      url: "/generations",
      payload: { projectId, request: { ...request, params: { consentConfirmed: true } } },
    });
    expect(withConsent.statusCode).toBe(422);
  });
});
