import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId, type GenerationJob, type RenderJob } from "@studio/domain";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { sampleGenerationRequest } from "@studio/test-utils";
import { MemoryStorageDriver } from "./storage/memory.js";
import { LocalDiskObjectStore } from "./objectstore/local-disk.js";
import { S3ObjectStore } from "./objectstore/s3.js";
import { recoverInterruptedJobs } from "./recovery.js";
import { processGenerationJob } from "./generation/processor.js";

describe("LocalDiskObjectStore", () => {
  const store = new LocalDiskObjectStore(mkdtempSync(join(tmpdir(), "objects-")));

  it("put/get/delete döngüsü ve içerik türü", async () => {
    await store.put("assets/a.png", Buffer.from("veri"), "image/png");
    const got = await store.get("assets/a.png");
    expect(got?.data.toString()).toBe("veri");
    expect(got?.contentType).toBe("image/png");
    expect(store.publicPath("assets/a.png")).toBe("/files/assets/a.png");
    await store.delete("assets/a.png");
    expect(await store.get("assets/a.png")).toBeNull();
  });

  it("path traversal anahtarları reddedilir", async () => {
    await expect(store.put("../kacis.txt", Buffer.from("x"), "text/plain")).rejects.toThrow(
      /Geçersiz nesne anahtarı/,
    );
    expect(() => store.publicPath("a/../../b")).toThrow(/Geçersiz/);
  });
});

describe("S3ObjectStore (sahte S3 sunucusuyla contract)", () => {
  const objects = new Map<string, { data: Buffer; type: string }>();
  let server: Server;
  let endpoint: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const key = (req.url ?? "").split("?")[0] ?? "";
      if (req.method === "PUT") {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          objects.set(key, {
            data: Buffer.concat(chunks),
            type: req.headers["content-type"] ?? "application/octet-stream",
          });
          res.writeHead(200, { ETag: '"ok"' }).end();
        });
        return;
      }
      if (req.method === "GET") {
        const found = objects.get(key);
        if (!found) return res.writeHead(404).end();
        res.writeHead(200, { "content-type": found.type, "content-length": found.data.length });
        return res.end(found.data);
      }
      if (req.method === "DELETE") {
        objects.delete(key);
        return res.writeHead(204).end();
      }
      res.writeHead(400).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    endpoint = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  afterAll(() => server.close());

  it("SDK üzerinden put/get/delete akışı path-style çalışır", async () => {
    const store = new S3ObjectStore({
      endpoint,
      accessKeyId: "test",
      secretAccessKey: "test",
      bucket: "studio",
    });
    await store.put("assets/b.png", Buffer.from("s3veri"), "image/png");
    expect(objects.has("/studio/assets/b.png")).toBe(true);
    const got = await store.get("assets/b.png");
    expect(got?.data.toString()).toBe("s3veri");
    expect(got?.contentType).toBe("image/png");
    await store.delete("assets/b.png");
    expect(objects.has("/studio/assets/b.png")).toBe(false);
  });
});

describe("recoverInterruptedJobs", () => {
  it("running işleri retryable failed olarak işaretler; diğerlerine dokunmaz", async () => {
    const storage = new MemoryStorageDriver();
    const now = new Date().toISOString();
    const base = {
      projectId: "prj_1",
      request: sampleGenerationRequest(),
      progress: 50,
      resultAssetIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const running: GenerationJob = {
      ...base,
      id: "gen_r",
      status: "running",
      idempotencyKey: "k1",
    };
    const done: GenerationJob = { ...base, id: "gen_d", status: "succeeded", idempotencyKey: "k2" };
    await storage.createGenerationJob(running);
    await storage.createGenerationJob(done);

    const renderRunning: RenderJob = {
      id: "rnd_r",
      projectId: "prj_1",
      sequenceId: "seq_1",
      preset: "480p",
      status: "running",
      progress: 40,
      createdAt: now,
      updatedAt: now,
    };
    await storage.createRenderJob(renderRunning);

    const result = await recoverInterruptedJobs(storage);
    expect(result).toEqual({ generation: 1, render: 1 });
    expect((await storage.getGenerationJob("gen_r"))?.status).toBe("failed");
    expect((await storage.getGenerationJob("gen_r"))?.error?.retryable).toBe(true);
    expect((await storage.getGenerationJob("gen_d"))?.status).toBe("succeeded");
    expect((await storage.getRenderJob("rnd_r"))?.status).toBe("failed");
  });
});

describe("processor + ObjectStore + storyboard bağlama", () => {
  it("çıktı store'a yazılır, uri /files olur; storyboard sahnesi bağlanır", async () => {
    const storage = new MemoryStorageDriver();
    const registry = new ProviderRegistry();
    registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter({ completeAfterPolls: 1 }));
    const objectStore = new LocalDiskObjectStore(mkdtempSync(join(tmpdir(), "objects-")));

    const now = new Date().toISOString();
    const job: GenerationJob = {
      id: newId("gen"),
      projectId: "prj_1",
      request: sampleGenerationRequest(),
      status: "queued",
      progress: 0,
      idempotencyKey: newId("idem"),
      resultAssetIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await storage.createGenerationJob(job);

    // Bu işi storyboard olarak bekleyen bir sahne
    await storage.replaceScenes("scr_1", [
      {
        id: "scn_1",
        projectId: "prj_1",
        scriptId: "scr_1",
        order: 0,
        title: "Açılış",
        summary: "x",
        narration: "y",
        durationSec: 5,
        characterNames: [],
        prompt: sampleGenerationRequest().prompt,
        storyboardJobId: job.id,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await processGenerationJob(job.id, { storage, registry, objectStore, pollIntervalMs: 1 });

    const done = await storage.getGenerationJob(job.id);
    expect(done?.status).toBe("succeeded");
    const asset = await storage.getAsset(done!.resultAssetIds[0]!);
    expect(asset?.uri).toMatch(/^\/files\/assets\/ast_.*\.png$/);
    expect((await objectStore.get(asset!.uri.replace("/files/", "")))?.contentType).toBe(
      "image/png",
    );

    const scene = await storage.getScene("scn_1");
    expect(scene?.storyboardAssetId).toBe(asset?.id);
  });
});
