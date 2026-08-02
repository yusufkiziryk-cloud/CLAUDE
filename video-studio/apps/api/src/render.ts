import { spawn, execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newId, type Asset, type RenderJob, type Sequence } from "@studio/domain";
import { buildRenderGraph, type RenderAssetFile } from "@studio/media-engine";
import type { StorageDriver } from "@studio/shared";

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

/**
 * data: URI varlıklarını render için geçici dosyalara açar.
 * (Uzak URL indirme Faz 5'te SSRF allowlist'iyle gelecek; şimdilik reddedilir.)
 */
async function materializeAssets(
  sequence: Sequence,
  storage: StorageDriver,
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
    const file = await materializeAsset(asset, workDir);
    files.set(assetId, file);
  }
  return files;
}

async function materializeAsset(asset: Asset, workDir: string): Promise<RenderAssetFile> {
  if (!asset.uri.startsWith("data:")) {
    throw new Error(
      `Varlık '${asset.name}' uzak/harici bir konumda (${asset.uri.slice(0, 30)}...); ` +
        "Faz 4 render'ı yalnızca yerel (data URI) varlıkları destekler. Uzak medya Faz 5'te.",
    );
  }
  const base64 = asset.uri.split(",")[1] ?? "";
  const extension = MIME_EXTENSIONS[asset.mimeType];
  if (!extension) throw new Error(`Render için desteklenmeyen medya türü: ${asset.mimeType}`);
  const path = join(workDir, `${asset.id}.${extension}`);
  await writeFile(path, Buffer.from(base64, "base64"));
  return { path, mimeType: asset.mimeType };
}

export interface RenderExecutorDeps {
  storage: StorageDriver;
  rendersDir: string;
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
    await storage.updateRenderJob(job.id, { status: "running" });
    const assetFiles = await materializeAssets(sequence, storage, workDir);
    const preset = RENDER_PRESETS[job.preset];
    const outputPath = join(rendersDir, `${job.id}.mp4`);
    const graph = buildRenderGraph(sequence, assetFiles, {
      width: preset.width,
      height: preset.height,
      fps: sequence.fps,
      outputPath,
    });

    log(`ffmpeg başlatılıyor (${graph.args.length} argüman, süre ${graph.durationSec}s)`);
    await runFfmpeg(graph.args, graph.durationSec, async (progress) => {
      await storage.updateRenderJob(job.id, { progress });
    });

    await storage.updateRenderJob(job.id, {
      status: "succeeded",
      progress: 100,
      outputPath: `/renders/${job.id}.mp4`,
      finishedAt: new Date().toISOString(),
    });
    log(`render tamam: ${outputPath}`);
  } catch (error) {
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
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderrTail = "";

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

    child.on("error", (error) => reject(new Error(`ffmpeg başlatılamadı: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg ${code} koduyla çıktı. Son çıktı: ${stderrTail.slice(-400)}`));
    });
  });
}
