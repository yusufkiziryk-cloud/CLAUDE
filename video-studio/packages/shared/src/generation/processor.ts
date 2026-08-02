import { CanonicalGenerationRequest, newId, type Asset, type GenerationJob } from "@studio/domain";
import {
  toErrorEnvelope,
  type CanonicalGenerationResult,
  type ProviderRegistry,
} from "@studio/provider-sdk";
import type { StorageDriver } from "../storage/types.js";
import { extFromMime, type ObjectStore } from "../objectstore/types.js";

export interface ProcessorDeps {
  storage: StorageDriver;
  registry: ProviderRegistry;
  /**
   * Verilirse üretim çıktıları nesne deposuna yazılır ve varlık URI'si /files/*
   * olur; verilmezse data URI olarak saklanır (eski davranış, testler için).
   */
  objectStore?: ObjectStore;
  /** Sağlayıcı durum sorguları arasındaki bekleme (test için düşürülebilir). */
  pollIntervalMs?: number;
  /** Bu sayıda sorgudan sonra iş 'expired' sayılır. */
  maxPolls?: number;
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}

/** Sağlayıcı sonuç URL'lerini indirirken üst sınırlar (kaynak tükenmesi koruması). */
const DOWNLOAD_TIMEOUT_MS = 120_000;
const DOWNLOAD_MAX_BYTES = 200 * 1024 * 1024;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tek bir üretim işini uçtan uca yürütür: submit → durum takibi → sonuç varlıkları.
 * Hem süreç içi kuyruk (geliştirme) hem BullMQ worker'ı (üretim) bu fonksiyonu çağırır.
 * Aynı job'ın ikinci kez teslim edilmesine karşı idempotenttir.
 */
export async function processGenerationJob(jobId: string, deps: ProcessorDeps): Promise<void> {
  const { storage, registry } = deps;
  const pollIntervalMs = deps.pollIntervalMs ?? 750;
  const maxPolls = deps.maxPolls ?? 400;
  const log = deps.logger ?? (() => {});

  const job = await storage.getGenerationJob(jobId);
  if (!job) {
    log("İş bulunamadı, atlanıyor", { jobId });
    return;
  }
  if (job.status !== "queued") {
    log("İş zaten işlenmiş, atlanıyor (idempotent teslim)", { jobId, status: job.status });
    return;
  }

  const request = CanonicalGenerationRequest.parse(job.request);

  try {
    await storage.updateGenerationJob(jobId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const adapter = registry.get(request.providerId);
    const compiled = adapter.compile(request);
    const providerJob = await adapter.submit(compiled, {
      idempotencyKey: job.idempotencyKey,
      correlationId: jobId,
    });
    log("Sağlayıcıya gönderildi", { jobId, externalJobId: providerJob.externalJobId });

    for (let poll = 0; poll < maxPolls; poll++) {
      const status = await adapter.getStatus(providerJob);

      if (status.state === "succeeded") {
        const result = await adapter.normalizeResult(status.raw);
        const assets = await persistArtifacts(job, result, storage, deps.objectStore);

        // Sunucu tarafı bağlama: bu iş bir sahnenin storyboard'u veya seslendirmesiyse
        // üretilen varlık sahneye yazılır.
        const storyboardScene = await storage.findSceneByStoryboardJob(jobId);
        if (storyboardScene && assets[0]) {
          await storage.updateScene(storyboardScene.id, { storyboardAssetId: assets[0].id });
          log("Storyboard varlığı sahneye bağlandı", { jobId, sceneId: storyboardScene.id });
        }
        const narrationScene = await storage.findSceneByNarrationJob(jobId);
        if (narrationScene && assets[0]) {
          await storage.updateScene(narrationScene.id, { narrationAssetId: assets[0].id });
          log("Seslendirme varlığı sahneye bağlandı", { jobId, sceneId: narrationScene.id });
        }
        await storage.updateGenerationJob(jobId, {
          status: "succeeded",
          progress: 100,
          resultAssetIds: assets.map((a) => a.id),
          ...(result.actualCostUsd !== undefined ? { actualCostUsd: result.actualCostUsd } : {}),
          finishedAt: new Date().toISOString(),
        });
        log("İş tamamlandı", { jobId, assetCount: assets.length });
        return;
      }

      if (status.state === "failed" || status.state === "cancelled") {
        await storage.updateGenerationJob(jobId, {
          status: status.state,
          ...(status.error ? { error: status.error } : {}),
          finishedAt: new Date().toISOString(),
        });
        log("İş başarısız/iptal", { jobId, state: status.state });
        return;
      }

      if (status.progress !== undefined) {
        await storage.updateGenerationJob(jobId, { progress: Math.round(status.progress) });
      }
      await sleep(pollIntervalMs);
    }

    await storage.updateGenerationJob(jobId, {
      status: "expired",
      error: {
        code: "POLL_TIMEOUT",
        userMessage:
          "Üretim beklenenden uzun sürdü ve zaman aşımına uğradı. Tekrar deneyebilirsiniz.",
        developerMessage: `maxPolls=${maxPolls} aşıldı`,
        retryable: true,
      },
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    await storage.updateGenerationJob(jobId, {
      status: "failed",
      error: toErrorEnvelope(error, { correlationId: jobId, retryable: true }),
      finishedAt: new Date().toISOString(),
    });
    log("İş hata ile sonlandı", { jobId, error: String(error) });
  }
}

async function persistArtifacts(
  job: GenerationJob,
  result: CanonicalGenerationResult,
  storage: StorageDriver,
  objectStore?: ObjectStore,
): Promise<Asset[]> {
  const assets: Asset[] = [];
  for (const [index, artifact] of result.artifacts.entries()) {
    const assetId = newId("ast");
    let uri = artifact.url;
    let sizeBytes = estimateSizeBytes(artifact.url);

    if (objectStore) {
      const bytes = await artifactBytes(artifact.url);
      const ext = extFromMime(artifact.mimeType) ?? "bin";
      const key = `assets/${assetId}.${ext}`;
      await objectStore.put(key, bytes, artifact.mimeType);
      uri = objectStore.publicPath(key);
      sizeBytes = bytes.length;
    }

    const asset: Asset = {
      id: assetId,
      projectId: job.projectId,
      kind: artifact.kind,
      name: `Üretim ${job.id.slice(-8)} — çıktı ${index + 1}`,
      uri,
      mimeType: artifact.mimeType,
      sizeBytes,
      ...(artifact.durationSec !== undefined ? { durationSec: artifact.durationSec } : {}),
      ...(artifact.width !== undefined ? { width: artifact.width } : {}),
      ...(artifact.height !== undefined ? { height: artifact.height } : {}),
      provenance: result.provenance,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    assets.push(await storage.createAsset(asset));
  }
  return assets;
}

/** Artifact içeriğini alır: data URI çözülür; sağlayıcı URL'i sınırlı indirme ile çekilir. */
async function artifactBytes(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    return Buffer.from(url.split(",")[1] ?? "", "base64");
  }
  if (!/^https:\/\//.test(url)) {
    throw new Error(`Desteklenmeyen artifact URL şeması: ${url.slice(0, 30)}`);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Sağlayıcı çıktısı indirilemedi: HTTP ${response.status}`);
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > DOWNLOAD_MAX_BYTES) {
    throw new Error(`Sağlayıcı çıktısı boyut sınırını aşıyor (${length} bayt).`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > DOWNLOAD_MAX_BYTES) {
    throw new Error(`Sağlayıcı çıktısı boyut sınırını aşıyor (${bytes.length} bayt).`);
  }
  return bytes;
}

function estimateSizeBytes(url: string): number {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1] ?? "";
    return Math.floor((base64.length * 3) / 4);
  }
  return 0;
}
