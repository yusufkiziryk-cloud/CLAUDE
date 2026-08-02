import { spawn, execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newId, type Asset, type RenderJob, type Sequence } from "@studio/domain";
import { buildRenderGraph, type RenderAssetFile } from "@studio/media-engine";
import type { ObjectStore } from "../objectstore/types.js";
import type { StorageDriver } from "../storage/types.js";

export const RENDER_PRESETS = {
  "480p": { width: 854, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
} as const;

export function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("ffmpeg", ["-version"], (error) => resolve(!error));
  });
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** Varlıkları (nesne deposu veya data URI) render için geçici dosyalara açar. */
async function materializeAssets(
  sequence: Sequence,
  storage: StorageDriver,
  objectStore: ObjectStore | undefined,
  workDir: string,
): Promise<Map<string, RenderAssetFile>> {
  const files = new Map<string, RenderAssetFile>();
  const assetIds = new Set<string>();
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId) assetIds.add(clip.assetId);
    }
  }
  for (const assetId of assetIds) {
    const asset = await storage.getAsset(assetId);
    if (!asset) continue; // buildRenderGraph anlaşılır hata verir
    const file = await materializeAsset(asset, objectStore, workDir);
    files.set(assetId, file);
  }
  return files;
}

async function materializeAsset(
  asset: Asset,
  objectStore: ObjectStore | undefined,
  workDir: string,
): Promise<RenderAssetFile> {
  const extension = MIME_EXTENSIONS[asset.mimeType];
  if (!extension) throw new Error(`Render için desteklenmeyen medya türü: ${asset.mimeType}`);
  const path = join(workDir, `${asset.id}.${extension}`);

  if (asset.uri.startsWith("data:")) {
    await writeFile(path, Buffer.from(asset.uri.split(",")[1] ?? "", "base64"));
    return { path, mimeType: asset.mimeType };
  }
  if (asset.uri.startsWith("/files/") && objectStore) {
    const object = await objectStore.get(asset.uri.replace("/files/", ""));
    if (!object) throw new Error(`Varlık nesne deposunda bulunamadı: ${asset.name}`);
    await writeFile(path, object.data);
    return { path, mimeType: asset.mimeType };
  }
  throw new Error(
    `Varlık '${asset.name}' desteklenmeyen bir konumda (${asset.uri.slice(0, 30)}...); ` +
      "yalnızca nesne deposu (/files) ve data URI varlıkları render edilebilir.",
  );
}

export interface RenderExecutorDeps {
  storage: StorageDriver;
  rendersDir: string;
  objectStore?: ObjectStore;
  onLog?: (message: string) => void;
}

/**
 * Render işini yürütür: varlıkları dosyaya açar, FFmpeg'i ARGÜMAN DİZİSİYLE
 * (shell yok) izole süreç olarak çalıştırır, stderr'den ilerlemeyi okur.
 */
export async function executeRenderJob(
  job: RenderJob,
  sequence: Sequence,
  deps: RenderExecutorDeps,
): Promise<void> {
  const { storage, rendersDir } = deps;
  const log = deps.onLog ?? (() => {});
  const workDir = join(rendersDir, `work-${job.id}-${newId("tmp").slice(-6)}`);
  await mkdir(workDir, { recursive: true });
  await mkdir(rendersDir, { recursive: true });

  try {
    // İptal edilmiş bir iş kuyruktan gelmiş olabilir (yarış): işlenmez.
    const fresh = await storage.getRenderJob(job.id);
    if (fresh?.status === "cancelled") return;

    await storage.updateRenderJob(job.id, { status: "running" });
    const assetFiles = await materializeAssets(sequence, storage, deps.objectStore, workDir);
    const preset = RENDER_PRESETS[job.preset];
    const outputPath = join(rendersDir, `${job.id}.mp4`);
    const graph = buildRenderGraph(sequence, assetFiles, {
      width: preset.width,
      height: preset.height,
      fps: sequence.fps,
      outputPath,
    });

    log(`ffmpeg başlatılıyor (${graph.args.length} argüman, süre ${graph.durationSec}s)`);
    const cancelled = await runFfmpeg(
      graph.args,
      graph.durationSec,
      async (progress) => {
        await storage.updateRenderJob(job.id, { progress });
      },
      async () => (await storage.getRenderJob(job.id))?.status === "cancelled",
    );
    if (cancelled) {
      log(`render iptal edildi: ${job.id}`);
      return; // durum zaten 'cancelled'; üzerine yazılmaz
    }

    await storage.updateRenderJob(job.id, {
      status: "succeeded",
      progress: 100,
      outputPath: `/renders/${job.id}.mp4`,
      finishedAt: new Date().toISOString(),
    });
    log(`render tamam: ${outputPath}`);
  } catch (error) {
    if ((await storage.getRenderJob(job.id))?.status === "cancelled") return;
    await storage.updateRenderJob(job.id, {
      status: "failed",
      error: {
        code: "RENDER_FAILED",
        userMessage:
          "Dışa aktarma başarısız oldu. Timeline'daki medya türlerini kontrol edin ve tekrar deneyin.",
        developerMessage: error instanceof Error ? error.message.slice(0, 500) : String(error),
      },
      finishedAt: new Date().toISOString(),
    });
    log(`render hatası: ${String(error)}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function runFfmpeg(
  args: string[],
  totalDurationSec: number,
  onProgress: (percent: number) => Promise<void>,
  shouldCancel?: () => Promise<boolean>,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderrTail = "";
    let wasCancelled = false;

    // İptal denetimi: kullanıcı iptal ettiyse ffmpeg süreci sonlandırılır.
    const cancelTimer = shouldCancel
      ? setInterval(() => {
          void shouldCancel()
            .then((cancel) => {
              if (cancel) {
                wasCancelled = true;
                child.kill("SIGKILL");
              }
            })
            .catch(() => {});
        }, 1000)
      : null;

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-2000);
      const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
      if (match && totalDurationSec > 0) {
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
        const percent = Math.min(99, Math.round((seconds / totalDurationSec) * 100));
        void onProgress(percent).catch(() => {});
      }
    });

    child.on("error", (error) => {
      if (cancelTimer) clearInterval(cancelTimer);
      reject(new Error(`ffmpeg başlatılamadı: ${error.message}`));
    });
    child.on("close", (code) => {
      if (cancelTimer) clearInterval(cancelTimer);
      if (wasCancelled) resolve(true);
      else if (code === 0) resolve(false);
      else reject(new Error(`ffmpeg ${code} koduyla çıktı. Son çıktı: ${stderrTail.slice(-400)}`));
    });
  });
}
