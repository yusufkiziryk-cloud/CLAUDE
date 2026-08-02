import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID, buildPlaceholderPng } from "@studio/provider-mock";
import { MemoryStorageDriver } from "@studio/shared";
import { TemplateScriptGenerator } from "@studio/creative-engine";
import { addClip } from "@studio/timeline-engine";
import type { Sequence } from "@studio/domain";
import { buildServer } from "./server.js";
import { MemoryGenerationQueue } from "./queue.js";
import { ffmpegAvailable } from "./render.js";

let app: FastifyInstance;
let storage: MemoryStorageDriver;
const hasFfmpeg = await ffmpegAvailable();

beforeEach(() => {
  storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 1 }));
  app = buildServer({
    storage,
    registry,
    queue: new MemoryGenerationQueue({ storage, registry, pollIntervalMs: 1 }),
    scriptGenerator: new TemplateScriptGenerator(),
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
    payload: { name: "Kurgu Testi", purpose: "reklam", aspectRatio: "16:9", targetDurationSec: 30 },
  });
  return res.json().id as string;
}

describe("Faz 4: sequence + render", () => {
  it("GET sequence yoksa varsayılanı oluşturur (video+ses+metin track)", async () => {
    const projectId = await createProject();
    const res = await app.inject({ method: "GET", url: `/projects/${projectId}/sequence` });
    expect(res.statusCode).toBe(200);
    const sequence = res.json();
    expect(sequence.tracks.map((t: { kind: string }) => t.kind)).toEqual([
      "video",
      "audio",
      "text",
    ]);

    // İkinci istek aynı sequence'i döner (yeniden oluşturmaz)
    const again = await app.inject({ method: "GET", url: `/projects/${projectId}/sequence` });
    expect(again.json().id).toBe(sequence.id);
  });

  it("PUT sequence doğrular ve kalıcılaştırır; yanlış proje reddedilir", async () => {
    const projectId = await createProject();
    const sequence = (
      await app.inject({ method: "GET", url: `/projects/${projectId}/sequence` })
    ).json() as Sequence;

    const videoTrack = sequence.tracks.find((t) => t.kind === "video")!;
    const updated = addClip(sequence, {
      trackId: videoTrack.id,
      startSec: 0,
      durationSec: 2,
      assetId: "ast_x",
    });
    const put = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/sequence`,
      payload: { sequence: updated },
    });
    expect(put.statusCode).toBe(200);
    const reloaded = (
      await app.inject({ method: "GET", url: `/projects/${projectId}/sequence` })
    ).json() as Sequence;
    expect(reloaded.tracks.find((t) => t.kind === "video")!.clips).toHaveLength(1);

    const wrong = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/sequence`,
      payload: { sequence: { ...updated, projectId: "prj_baska" } },
    });
    expect(wrong.statusCode).toBe(400);
  });

  it.skipIf(!hasFfmpeg)(
    "render: PNG varlığı + metin klibi → gerçek MP4 üretilir ve servis edilir",
    async () => {
      const projectId = await createProject();

      // PNG varlığı doğrudan depoya eklenir (mock üretim çıktısıyla aynı biçim)
      const png = buildPlaceholderPng(320, 180);
      await storage.createAsset({
        id: "ast_png",
        projectId,
        kind: "image",
        name: "Test PNG",
        uri: `data:image/png;base64,${png.toString("base64")}`,
        mimeType: "image/png",
        sizeBytes: png.length,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      });

      let sequence = (
        await app.inject({ method: "GET", url: `/projects/${projectId}/sequence` })
      ).json() as Sequence;
      const videoTrack = sequence.tracks.find((t) => t.kind === "video")!;
      const textTrack = sequence.tracks.find((t) => t.kind === "text")!;
      sequence = addClip(sequence, {
        trackId: videoTrack.id,
        startSec: 0,
        durationSec: 2,
        assetId: "ast_png",
      });
      sequence = addClip(sequence, {
        trackId: textTrack.id,
        startSec: 0.2,
        durationSec: 1.5,
        text: "Deneme Altyazısı",
      });
      await app.inject({
        method: "PUT",
        url: `/projects/${projectId}/sequence`,
        payload: { sequence },
      });

      const started = await app.inject({
        method: "POST",
        url: `/projects/${projectId}/render`,
        payload: { preset: "480p" },
      });
      expect(started.statusCode).toBe(202);
      const jobId = started.json().id as string;

      // Gerçek ffmpeg işini bekle
      let job = started.json();
      for (let i = 0; i < 120 && !["succeeded", "failed"].includes(job.status); i++) {
        await new Promise((r) => setTimeout(r, 500));
        job = (await app.inject({ method: "GET", url: `/render-jobs/${jobId}` })).json();
      }
      expect(job.status).toBe("succeeded");
      expect(job.outputPath).toBe(`/renders/${jobId}.mp4`);

      const file = await app.inject({ method: "GET", url: job.outputPath });
      expect(file.statusCode).toBe(200);
      expect(file.headers["content-type"]).toBe("video/mp4");
      expect(file.rawPayload.length).toBeGreaterThan(1000);
      // MP4 kutu imzası: 'ftyp' 4. bayttan itibaren
      expect(file.rawPayload.subarray(4, 8).toString("ascii")).toBe("ftyp");
    },
    120000,
  );

  it("path traversal denemesi reddedilir", async () => {
    const res = await app.inject({ method: "GET", url: "/renders/..%2F..%2Fetc%2Fpasswd" });
    expect([400, 404]).toContain(res.statusCode);
  });
});
