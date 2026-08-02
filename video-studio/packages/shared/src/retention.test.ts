import { mkdtempSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { newId, type Asset, type GenerationJob, type Project } from "@studio/domain";
import { sampleGenerationRequest } from "@studio/test-utils";
import { MemoryStorageDriver } from "./storage/memory.js";
import { LocalDiskObjectStore } from "./objectstore/local-disk.js";
import { purgeExpiredData } from "./retention.js";

const NOW = new Date("2026-08-02T12:00:00.000Z");
const OLD = "2026-06-01T00:00:00.000Z"; // 62 gün önce
const FRESH = "2026-08-01T00:00:00.000Z"; // 1 gün önce

function makeProject(): Project {
  return {
    id: newId("prj"),
    name: "Saklama testi",
    purpose: "reklam",
    aspectRatio: "16:9",
    targetDurationSec: 30,
    language: "tr",
    resolution: "1080p",
    createdAt: OLD,
    updatedAt: OLD,
    deletedAt: null,
  };
}

function makeAsset(projectId: string, key: string): Asset {
  return {
    id: newId("ast"),
    projectId,
    kind: "image",
    name: "test.png",
    uri: `/files/${key}`,
    mimeType: "image/png",
    sizeBytes: 4,
    createdAt: OLD,
    deletedAt: null,
  };
}

function makeJob(
  projectId: string,
  finishedAt: string | undefined,
  resultAssetIds: string[],
): GenerationJob {
  return {
    id: newId("gen"),
    projectId,
    request: sampleGenerationRequest({ providerId: "mock", modelId: "mock-video-fast" }),
    status: finishedAt ? "succeeded" : "running",
    progress: finishedAt ? 100 : 50,
    idempotencyKey: newId("idem"),
    resultAssetIds,
    createdAt: OLD,
    updatedAt: OLD,
    ...(finishedAt ? { startedAt: OLD, finishedAt } : { startedAt: OLD }),
  };
}

describe("purgeExpiredData (veri saklama)", () => {
  it("süresi dolan işleri+varlıkları siler; referanslı, taze ve çalışan işlere dokunmaz", async () => {
    const storage = new MemoryStorageDriver();
    const baseDir = mkdtempSync(join(tmpdir(), "retention-"));
    const objectStore = new LocalDiskObjectStore(baseDir);
    const project = makeProject();
    await storage.createProject(project);

    // 1) süresi dolmuş iş + varlığı (silinmeli)
    const expiredAsset = makeAsset(project.id, "old/expired.png");
    await objectStore.put("old/expired.png", Buffer.from("eski"), "image/png");
    await storage.createAsset(expiredAsset);
    await storage.createGenerationJob(makeJob(project.id, OLD, [expiredAsset.id]));

    // 2) süresi dolmuş ama timeline'da referanslı varlık (korunmalı; iş kaydı silinir)
    const referencedAsset = makeAsset(project.id, "old/referenced.png");
    await objectStore.put("old/referenced.png", Buffer.from("ref"), "image/png");
    await storage.createAsset(referencedAsset);
    await storage.createGenerationJob(makeJob(project.id, OLD, [referencedAsset.id]));
    await storage.saveSequence({
      id: newId("seq"),
      projectId: project.id,
      name: "Ana kurgu",
      fps: 24,
      width: 1280,
      height: 720,
      tracks: [
        {
          id: "t1",
          kind: "video",
          name: "Video",
          order: 0,
          clips: [
            {
              id: "c1",
              assetId: referencedAsset.id,
              startSec: 0,
              durationSec: 3,
              inSec: 0,
              volume: 1,
            },
          ],
        },
      ],
      createdAt: OLD,
      updatedAt: OLD,
    });

    // 3) taze iş (korunmalı) + 4) hâlâ çalışan eski iş (korunmalı)
    const freshJob = makeJob(project.id, FRESH, []);
    await storage.createGenerationJob(freshJob);
    const runningJob = makeJob(project.id, undefined, []);
    await storage.createGenerationJob(runningJob);

    // 5) süresi dolmuş render işi + çıktı dosyası (silinmeli)
    const rendersDir = mkdtempSync(join(tmpdir(), "renders-"));
    writeFileSync(join(rendersDir, "eski.mp4"), "mp4");
    const expiredRender = {
      id: newId("rnd"),
      projectId: project.id,
      sequenceId: "seq",
      preset: "720p" as const,
      status: "succeeded" as const,
      progress: 100,
      outputPath: "/renders/eski.mp4",
      createdAt: OLD,
      updatedAt: OLD,
      finishedAt: OLD,
    };
    await storage.createRenderJob(expiredRender);

    const report = await purgeExpiredData({
      storage,
      objectStore,
      retentionDays: 30,
      rendersDir,
      now: () => NOW,
    });

    expect(report.deletedGenerationJobs).toBe(2); // iki süresi dolmuş üretim işi
    expect(report.deletedAssets).toBe(1); // yalnızca referanssız varlık
    expect(report.keptReferencedAssets).toBe(1);
    expect(report.deletedRenderJobs).toBe(1);

    expect(await storage.getAsset(expiredAsset.id)).toBeNull();
    expect(await objectStore.get("old/expired.png")).toBeNull();
    expect(await storage.getAsset(referencedAsset.id)).not.toBeNull();
    expect(await objectStore.get("old/referenced.png")).not.toBeNull();
    expect(await storage.getGenerationJob(freshJob.id)).not.toBeNull();
    expect(await storage.getGenerationJob(runningJob.id)).not.toBeNull();
    expect(await storage.getRenderJob(expiredRender.id)).toBeNull();
    expect(existsSync(join(rendersDir, "eski.mp4"))).toBe(false);
  });

  it("path traversal içeren outputPath render dizini dışına çıkamaz", async () => {
    const storage = new MemoryStorageDriver();
    const baseDir = mkdtempSync(join(tmpdir(), "retention2-"));
    const objectStore = new LocalDiskObjectStore(baseDir);
    const project = makeProject();
    await storage.createProject(project);

    const outside = mkdtempSync(join(tmpdir(), "outside-"));
    writeFileSync(join(outside, "gizli.txt"), "gizli");
    const rendersDir = join(outside, "renders");
    mkdirSync(rendersDir);

    await storage.createRenderJob({
      id: newId("rnd"),
      projectId: project.id,
      sequenceId: "seq",
      preset: "720p",
      status: "succeeded",
      progress: 100,
      outputPath: "/renders/../gizli.txt",
      createdAt: OLD,
      updatedAt: OLD,
      finishedAt: OLD,
    });

    await purgeExpiredData({ storage, objectStore, retentionDays: 30, rendersDir, now: () => NOW });
    expect(existsSync(join(outside, "gizli.txt"))).toBe(true); // dizin dışı dosya silinmedi
  });
});
