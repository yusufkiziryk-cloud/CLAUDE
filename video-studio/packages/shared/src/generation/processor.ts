import { CanonicalGenerationRequest, newId, type Asset, type GenerationJob } from "@studio/domain";
import {
  toErrorEnvelope,
  type CanonicalGenerationResult,
  type ProviderRegistry,
} from "@studio/provider-sdk";
import type { StorageDriver } from "../storage/types.js";

export interface ProcessorDeps {
  storage: StorageDriver;
  registry: ProviderRegistry;
  /** Sağlayıcı durum sorguları arasındaki bekleme (test için düşürülebilir). */
  pollIntervalMs?: number;
  /** Bu sayıda sorgudan sonra iş 'expired' sayılır. */
  maxPolls?: number;
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}

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
        const assets = await persistArtifacts(job, result, storage);
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
): Promise<Asset[]> {
  const assets: Asset[] = [];
  for (const [index, artifact] of result.artifacts.entries()) {
    const asset: Asset = {
      id: newId("ast"),
      projectId: job.projectId,
      kind: artifact.kind,
      name: `Üretim ${job.id.slice(-8)} — çıktı ${index + 1}`,
      uri: artifact.url,
      mimeType: artifact.mimeType,
      sizeBytes: estimateSizeBytes(artifact.url),
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

function estimateSizeBytes(url: string): number {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1] ?? "";
    return Math.floor((base64.length * 3) / 4);
  }
  return 0;
}
