import type {
  CanonicalGenerationRequest,
  CanonicalGenerationResult,
  CancelResult,
  CostEstimate,
  GeneratedArtifact,
  MediaProviderAdapter,
  ModelManifest,
  ProviderJob,
  ProviderJobStatus,
  ProviderManifest,
  ProviderRequest,
  SubmissionContext,
  ValidationIssue,
  ValidationResult,
} from "@studio/provider-sdk";
import { toErrorEnvelope, validateParams } from "@studio/provider-sdk";
import { compileToText } from "@studio/prompt-engine";

export const FAL_PROVIDER_ID = "fal";

/**
 * fal.ai kuyruk API adaptörü.
 *
 * Sözleşme resmî kaynaklardan doğrulandı (2026-08-02):
 * - Gönderim: POST https://queue.fal.run/{model_id}  (Authorization: Key <FAL_KEY>)
 *   isteğe bağlı webhook: ?fal_webhook=<url>
 * - Durum:    GET  .../requests/{request_id}/status → status: IN_QUEUE | IN_PROGRESS | COMPLETED
 * - Sonuç:    GET  .../requests/{request_id}
 * - İptal:    PUT  .../requests/{request_id}/cancel
 * Kaynaklar: docs.fal.ai kuyruk dokümantasyonu ve resmî fal-js istemcisi
 * (libs/client/src/queue.ts, types/common.ts).
 */

export interface FalModelConfig {
  /** fal model kimliği, ör. "fal-ai/minimax/video-01" */
  id: string;
  displayName: string;
  capabilities: string[];
  /** Bilgilendirme amaçlı seçenekler; girdiye yalnızca desteklenen alanlar yazılır. */
  durationsSec: number[];
  resolutions: string[];
  aspectRatios: string[];
  fps: number[];
  maxPromptChars: number;
  supportsNegativePrompt: boolean;
  /** USD / video. Kaynak fal.ai model sayfasıdır; elle doğrulanmalıdır. */
  estimatedUsdPerVideo: number;
  pricingAsOf: string;
  notes?: string[];
}

/**
 * Varsayılan model kataloğu. Girdi şeması resmî API örneğiyle doğrulanan alanlar
 * yalnızca `prompt`'tur; ek parametreler bilinçli olarak GÖNDERİLMEZ (tahmin yasağı).
 */
export const DEFAULT_FAL_MODELS: FalModelConfig[] = [
  {
    id: "fal-ai/minimax/video-01",
    displayName: "MiniMax (Hailuo) Video 01 — Metinden Video",
    capabilities: ["textToVideo"],
    durationsSec: [6],
    resolutions: ["720p"],
    aspectRatios: ["16:9"],
    fps: [25],
    maxPromptChars: 2000,
    supportsNegativePrompt: false,
    estimatedUsdPerVideo: 0.5,
    pricingAsOf: "2026-08-02",
    notes: [
      "Süre ve çözünürlük modele sabittir; girdi olarak gönderilmez.",
      "Fiyat fal.ai model sayfasından elle doğrulanmalıdır; tahmin kesin değildir.",
    ],
  },
];

export interface FalAdapterOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  models?: FalModelConfig[];
}

interface FalSubmitResponse {
  request_id: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  queue_position?: number;
}

export class FalProviderAdapter implements MediaProviderAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly models: FalModelConfig[];
  private readonly byIdempotencyKey = new Map<string, ProviderJob>();

  constructor(options: FalAdapterOptions) {
    if (!options.apiKey) {
      throw new Error("FalProviderAdapter için apiKey zorunludur (FAL_API_KEY).");
    }
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://queue.fal.run";
    this.models = options.models ?? DEFAULT_FAL_MODELS;
  }

  async manifest(): Promise<ProviderManifest> {
    return {
      providerId: FAL_PROVIDER_ID,
      displayName: "fal.ai (toplayıcı)",
      mock: false,
      cacheTtlSec: 3600,
      models: this.models.map((m) => this.toManifest(m)),
    };
  }

  private toManifest(m: FalModelConfig): ModelManifest {
    return {
      id: m.id,
      displayName: m.displayName,
      providerId: FAL_PROVIDER_ID,
      apiVersion: "queue.fal.run (2026-08)",
      capabilities: m.capabilities,
      inputs: {
        types: ["text"],
        mimeTypes: [],
        maxBytes: 0,
      },
      options: {
        durationsSec: m.durationsSec,
        resolutions: m.resolutions,
        fps: m.fps,
        aspectRatios: m.aspectRatios,
      },
      promptLimits: { maxChars: m.maxPromptChars, negativePrompt: m.supportsNegativePrompt },
      params: {},
      limits: { concurrency: 2, rateLimitPerMin: 30 },
      pricing: {
        unit: "video",
        estimatedUsd: m.estimatedUsdPerVideo,
        asOf: m.pricingAsOf,
        source: `fal.ai model sayfası (https://fal.ai/models/${m.id}) — elle doğrulayın`,
      },
      delivery: "both",
      safety: { restrictions: m.notes ?? [] },
    };
  }

  validate(request: CanonicalGenerationRequest): ValidationResult {
    const issues: ValidationIssue[] = [];
    const model = this.models.find((m) => m.id === request.modelId);
    if (!model) {
      return {
        ok: false,
        issues: [
          {
            field: "modelId",
            message: `Bilinmeyen fal modeli: ${request.modelId}`,
            kind: "invalid",
          },
        ],
      };
    }
    if (!model.capabilities.includes(request.capability)) {
      issues.push({
        field: "capability",
        message: `${model.displayName} '${request.capability}' yeteneğini desteklemiyor.`,
        kind: "unsupported",
      });
    }
    issues.push(...validateParams(request.params, {}));
    if (!model.durationsSec.includes(request.prompt.output.durationSec)) {
      issues.push({
        field: "output.durationSec",
        message: `Bu model sabit süre üretir: ${model.durationsSec.join(", ")} sn.`,
        kind: "unsupported",
      });
    }
    if (!model.aspectRatios.includes(request.prompt.output.aspectRatio)) {
      issues.push({
        field: "output.aspectRatio",
        message: `Desteklenen oranlar: ${model.aspectRatios.join(", ")}.`,
        kind: "unsupported",
      });
    }
    if (request.prompt.negative.length > 0 && !model.supportsNegativePrompt) {
      issues.push({
        field: "negative",
        message: "Bu model negatif prompt desteklemiyor; alan gönderilmeyecek.",
        kind: "unsupported",
      });
    }
    const text = compileToText(request.prompt);
    if (text.length > model.maxPromptChars) {
      issues.push({
        field: "prompt",
        message: `Derlenen prompt ${text.length} karakter; limit ${model.maxPromptChars}.`,
        kind: "invalid",
      });
    }
    return { ok: issues.length === 0, issues };
  }

  async estimate(request: CanonicalGenerationRequest): Promise<CostEstimate> {
    const model = this.models.find((m) => m.id === request.modelId);
    return {
      currency: "USD",
      amount: model?.estimatedUsdPerVideo ?? 0,
      source: `fal.ai model sayfası (${request.modelId}) — fiyat elle doğrulanmalı`,
      asOf: model?.pricingAsOf ?? "bilinmiyor",
      isExact: false,
    };
  }

  compile(request: CanonicalGenerationRequest): ProviderRequest {
    // Yalnızca resmî örnekle doğrulanmış alan gönderilir: prompt.
    return {
      providerId: FAL_PROVIDER_ID,
      modelId: request.modelId,
      payload: {
        input: { prompt: compileToText(request.prompt) },
      },
    };
  }

  async submit(request: ProviderRequest, context: SubmissionContext): Promise<ProviderJob> {
    const existing = this.byIdempotencyKey.get(context.idempotencyKey);
    if (existing) return existing;

    const url = new URL(`${this.baseUrl}/${request.modelId}`);
    if (context.webhookUrl) url.searchParams.set("fal_webhook", context.webhookUrl);

    const response = await this.fetchImpl(url.toString(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(request.payload["input"] ? request.payload["input"] : request.payload),
    });
    if (!response.ok) {
      throw new Error(
        `fal.ai gönderimi başarısız: HTTP ${response.status} ${await safeText(response)}`,
      );
    }
    const body = (await response.json()) as FalSubmitResponse;
    const job: ProviderJob = {
      providerId: FAL_PROVIDER_ID,
      // modelId durum/sonuç URL'leri için gerekli → externalJobId içinde taşınır.
      externalJobId: `${request.modelId}::${body.request_id}`,
      submittedAt: new Date().toISOString(),
    };
    this.byIdempotencyKey.set(context.idempotencyKey, job);
    return job;
  }

  async getStatus(job: ProviderJob): Promise<ProviderJobStatus> {
    const [modelId, requestId] = splitJobId(job.externalJobId);
    const statusUrl = `${this.baseUrl}/${modelId}/requests/${requestId}/status`;
    const response = await this.fetchImpl(statusUrl, { headers: this.headers() });

    if (response.status === 429 || response.status >= 500) {
      // Geçici hata: iş kaybolmadı, sonraki poll'da tekrar denenir.
      return { state: "running" };
    }
    if (!response.ok) {
      return {
        state: "failed",
        error: toErrorEnvelope(
          new Error(`fal.ai durum sorgusu: HTTP ${response.status} ${await safeText(response)}`),
          { code: "FAL_STATUS_ERROR", retryable: false },
        ),
      };
    }
    const body = (await response.json()) as FalStatusResponse;
    if (body.status === "IN_QUEUE") return { state: "queued" };
    if (body.status === "IN_PROGRESS") return { state: "running" };

    // COMPLETED → sonucu getir ve raw olarak taşı
    const resultUrl = `${this.baseUrl}/${modelId}/requests/${requestId}`;
    const resultResponse = await this.fetchImpl(resultUrl, { headers: this.headers() });
    if (!resultResponse.ok) {
      return {
        state: "failed",
        error: toErrorEnvelope(new Error(`fal.ai sonuç alınamadı: HTTP ${resultResponse.status}`), {
          code: "FAL_RESULT_ERROR",
          retryable: true,
        }),
      };
    }
    const result = (await resultResponse.json()) as unknown;
    return { state: "succeeded", progress: 100, raw: { modelId, result } };
  }

  async cancel(job: ProviderJob): Promise<CancelResult> {
    const [modelId, requestId] = splitJobId(job.externalJobId);
    const response = await this.fetchImpl(
      `${this.baseUrl}/${modelId}/requests/${requestId}/cancel`,
      { method: "PUT", headers: this.headers() },
    );
    return {
      cancelled: response.ok,
      ...(response.ok ? {} : { reason: `HTTP ${response.status}` }),
    };
  }

  async normalizeResult(raw: unknown): Promise<CanonicalGenerationResult> {
    const { modelId, result } = raw as { modelId: string; result: unknown };
    const artifacts = extractArtifacts(result);
    if (artifacts.length === 0) {
      throw new Error(
        `fal.ai sonucunda bilinen medya alanı bulunamadı (video.url / videos[].url / images[].url bekleniyordu): ${JSON.stringify(result).slice(0, 300)}`,
      );
    }
    const model = this.models.find((m) => m.id === modelId);
    return {
      artifacts,
      provenance: {
        providerId: FAL_PROVIDER_ID,
        modelId,
        parameters: {},
        generatedAt: new Date().toISOString(),
        mock: false,
      },
      ...(model ? { actualCostUsd: model.estimatedUsdPerVideo } : {}),
    };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Key ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }
}

function splitJobId(externalJobId: string): [string, string] {
  const separator = externalJobId.lastIndexOf("::");
  if (separator === -1) throw new Error(`Geçersiz fal job kimliği: ${externalJobId}`);
  return [externalJobId.slice(0, separator), externalJobId.slice(separator + 2)];
}

/** fal model çıktılarında yaygın medya alanlarını savunmacı biçimde arar. */
function extractArtifacts(result: unknown): GeneratedArtifact[] {
  if (typeof result !== "object" || result === null) return [];
  const r = result as Record<string, unknown>;
  const found: GeneratedArtifact[] = [];

  const pushFile = (file: unknown, kind: "video" | "image") => {
    if (typeof file !== "object" || file === null) return;
    const f = file as Record<string, unknown>;
    if (typeof f["url"] === "string") {
      found.push({
        kind,
        url: f["url"],
        mimeType:
          typeof f["content_type"] === "string"
            ? f["content_type"]
            : kind === "video"
              ? "video/mp4"
              : "image/png",
      });
    }
  };

  pushFile(r["video"], "video");
  if (Array.isArray(r["videos"])) for (const v of r["videos"]) pushFile(v, "video");
  if (Array.isArray(r["images"])) for (const i of r["images"]) pushFile(i, "image");
  pushFile(r["image"], "image");
  return found;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return "";
  }
}
