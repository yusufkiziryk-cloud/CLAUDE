import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID, buildPlaceholderPng } from "@studio/provider-mock";
import { LocalDiskObjectStore, MemoryStorageDriver } from "@studio/shared";
import { TemplateScriptGenerator } from "@studio/creative-engine";
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

async function createProject(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/projects",
    payload: { name: "Depo Testi", purpose: "reklam", aspectRatio: "16:9", targetDurationSec: 30 },
  });
  return res.json().id as string;
}

function multipartBody(fileName: string, mimeType: string, data: Buffer) {
  const boundary = "----testboundary42";
  const head = Buffer.from(
    `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: ${mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, data, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

describe("Faz 5: nesne deposu + upload + iptal", () => {
  it("PNG yükleme → varlık oluşur → /files üzerinden servis edilir", async () => {
    const projectId = await createProject();
    const png = buildPlaceholderPng(64, 64);
    const { payload, headers } = multipartBody("kapak.png", "image/png", png);

    const upload = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/assets`,
      payload,
      headers,
    });
    expect(upload.statusCode).toBe(201);
    const asset = upload.json();
    expect(asset.kind).toBe("image");
    expect(asset.name).toBe("kapak.png");
    expect(asset.uri).toMatch(/^\/files\/uploads\//);
    expect(asset.sizeBytes).toBe(png.length);

    const served = await app.inject({ method: "GET", url: asset.uri });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(served.rawPayload.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const list = await app.inject({ method: "GET", url: `/projects/${projectId}/assets` });
    expect(list.json().assets).toHaveLength(1);
  });

  it("desteklenmeyen dosya türü 415 ile reddedilir", async () => {
    const projectId = await createProject();
    const { payload, headers } = multipartBody(
      "zarar.exe",
      "application/x-msdownload",
      Buffer.from("MZ"),
    );
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/assets`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(415);
  });

  it("mock üretim çıktısı artık nesne deposuna yazılır (/files URI)", async () => {
    const projectId = await createProject();
    const { sampleGenerationRequest } = await import("@studio/test-utils");
    const res = await app.inject({
      method: "POST",
      url: "/generations",
      payload: { projectId, request: sampleGenerationRequest(), idempotencyKey: "p5" },
    });
    expect(res.statusCode).toBe(202);
    await queue.drain();
    const assets = (
      await app.inject({ method: "GET", url: `/projects/${projectId}/assets` })
    ).json();
    expect(assets.assets[0].uri).toMatch(/^\/files\/assets\//);
    const served = await app.inject({ method: "GET", url: assets.assets[0].uri });
    expect(served.statusCode).toBe(200);
  });

  it("kuyruktaki render işi iptal edilebilir; bitmiş iş 409 döner", async () => {
    const projectId = await createProject();
    // sequence oluştur (boş) — render başlatmadan job'ı elle kuyruğa koymadan test:
    const now = new Date().toISOString();
    await storage.createRenderJob({
      id: "rnd_test",
      projectId,
      sequenceId: "seq_x",
      preset: "480p",
      status: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
    });
    const cancel = await app.inject({ method: "POST", url: "/render-jobs/rnd_test/cancel" });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().status).toBe("cancelled");

    await storage.updateRenderJob("rnd_test", { status: "succeeded" });
    const again = await app.inject({ method: "POST", url: "/render-jobs/rnd_test/cancel" });
    expect(again.statusCode).toBe(409);
  });

  it("/files path traversal reddedilir", async () => {
    const res = await app.inject({ method: "GET", url: "/files/..%2F..%2Fetc%2Fpasswd" });
    expect(res.statusCode).toBe(404);
  });
});
