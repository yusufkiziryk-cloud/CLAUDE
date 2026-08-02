import { rm } from "node:fs/promises";
import { join, normalize } from "node:path";
import type { ObjectStore } from "./objectstore/types.js";
import type { StorageDriver } from "./storage/types.js";

/**
 * Veri saklama süpürücüsü (KVKK: veri minimizasyonu). Saklama süresini aşan
 * BİTMİŞ üretim/render işlerini ve onların sonuç varlıklarını siler.
 *
 * Kurallar:
 * - Yalnızca finishedAt < cutoff olan işler dokunulur; kuyruktaki/çalışan işler asla.
 * - Bir sahnede (storyboard/anlatıcı) veya mevcut timeline'da hâlâ referanslanan
 *   varlık SİLİNMEZ — projenin yaratıcı durumu bozulmaz; yalnızca iş kaydı gider.
 * - DATA_RETENTION_DAYS tanımlı değilse süpürücü HİÇ çalıştırılmaz (çağıran karar verir).
 */
export interface RetentionOptions {
  storage: StorageDriver;
  objectStore: ObjectStore;
  /** Bitmiş işlerin saklanacağı gün sayısı. */
  retentionDays: number;
  /** Render çıktılarının kök dizini; verilirse süresi dolan MP4 dosyaları da silinir. */
  rendersDir?: string;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface RetentionReport {
  cutoffIso: string;
  deletedGenerationJobs: number;
  deletedRenderJobs: number;
  deletedAssets: number;
  /** Sahne/timeline referansı nedeniyle korunan varlık sayısı. */
  keptReferencedAssets: number;
}

export async function purgeExpiredData(options: RetentionOptions): Promise<RetentionReport> {
  const { storage, objectStore, retentionDays } = options;
  const log = options.log ?? (() => {});
  const nowMs = (options.now ?? (() => new Date()))().getTime();
  const cutoffIso = new Date(nowMs - retentionDays * 86_400_000).toISOString();

  // Yaratıcı durumda hâlâ kullanılan varlıklar korunur.
  const referencedAssetIds = new Set<string>();
  for (const project of await storage.listProjects()) {
    for (const scene of await storage.listScenes(project.id)) {
      if (scene.storyboardAssetId) referencedAssetIds.add(scene.storyboardAssetId);
      if (scene.narrationAssetId) referencedAssetIds.add(scene.narrationAssetId);
    }
    const sequence = await storage.getSequenceByProject(project.id);
    for (const track of sequence?.tracks ?? []) {
      for (const clip of track.clips) {
        if (clip.assetId) referencedAssetIds.add(clip.assetId);
      }
    }
  }

  const report: RetentionReport = {
    cutoffIso,
    deletedGenerationJobs: 0,
    deletedRenderJobs: 0,
    deletedAssets: 0,
    keptReferencedAssets: 0,
  };

  for (const job of await storage.listFinishedGenerationJobsBefore(cutoffIso)) {
    for (const assetId of job.resultAssetIds) {
      if (referencedAssetIds.has(assetId)) {
        report.keptReferencedAssets += 1;
        continue;
      }
      const asset = await storage.getAsset(assetId);
      if (!asset) continue;
      if (asset.uri.startsWith("/files/")) {
        try {
          await objectStore.delete(asset.uri.slice("/files/".length));
        } catch (error) {
          log(`[retention] nesne silinemedi (${asset.uri}): ${String(error)}`);
        }
      }
      if (await storage.deleteAsset(assetId)) report.deletedAssets += 1;
    }
    if (await storage.deleteGenerationJob(job.id)) report.deletedGenerationJobs += 1;
  }

  for (const job of await storage.listFinishedRenderJobsBefore(cutoffIso)) {
    if (options.rendersDir && job.outputPath?.startsWith("/renders/")) {
      const fileName = job.outputPath.slice("/renders/".length);
      const target = normalize(join(options.rendersDir, fileName));
      if (target.startsWith(normalize(options.rendersDir)) && !fileName.includes("..")) {
        await rm(target, { force: true });
      }
    }
    if (await storage.deleteRenderJob(job.id)) report.deletedRenderJobs += 1;
  }

  log(
    `[retention] süpürme bitti (sınır ${cutoffIso}): ${report.deletedGenerationJobs} üretim işi, ` +
      `${report.deletedRenderJobs} render işi, ${report.deletedAssets} varlık silindi; ` +
      `${report.keptReferencedAssets} referanslı varlık korundu.`,
  );
  return report;
}
