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

export const REPLICATE_PROVIDER_ID = "replicate";

/**
 * Replicate adaptörü. Sözleşme resmî OpenAPI spec'inden doğrulandı
 * (https://api.replicate.com/openapi.json, 2026-08-02):
 * - Taban: https://api.replicate.com/v1, kimlik: `Authorization: Bearer <token>`
 * - Resmî model tahmini: POST /models/{owner}/{name}/predictions {input}
 * - Durum: GET /predictions/{id} → starting|processing|succeeded|failed|canceled|aborted
 * - İptal: POST /predictions/{id}/cancel
 */

export interface ReplicateModelConfig {
  /** "owner/name" biçiminde resmî model kimliği. */
  id: string;
  displayName: string;
  capabilities: string[];
  durationsSec: number[];
  aspectRatios: string[];
  maxPromptChars: number;
  estimatedUsdPerRun: number;
  pricingAsOf: string;
  notes?: string[];
}

/**
 * Varsayılan katalog. Girdiye yalnızca doğrulanmış alan (`prompt`) yazılır;
 * model sayfası şemaları elle doğrulanana dek ek parametre GÖNDERİLMEZ.
 */
export const DEFAULT_REPLICATE_MODELS: ReplicateModelConfig[] = [
  {
    id: "minimax/video-01",
    displayName: "MiniMax Video 01 (Replicate) — Metinden Video",
    capabilities: ["textToVideo"],
    durationsSec: [6],
    aspectRatios: ["16:9"],
    maxPromptChars: 2000,
    estimatedUsdPerRun: 0.5,
    pricingAsOf: "2026-08-02",
    notes: [
      "Süre modele sabittir; girdi olarak gönderilmez.",
      "Fiyat Replicate model sayfasından elle doğrulanmalıdır.",
    ],
  },
];

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled" | "aborted";
  output?: unknown;
  error?: unknown;
}

export interface ReplicateAdapterOptions {
  apiToken: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  models?: ReplicateModelConfig[];
}

export class ReplicateProviderAdapter implements MediaProviderAdapter {
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly models: ReplicateModelConfig[];
  private readonly byIdempotencyKey = new Map<string, ProviderJob>();

  constructor(options: ReplicateAdapterOptions) {
    if (!options.apiToken) {
      throw new Error("ReplicateProviderAdapter için apiToken zorunludur (REPLICATE_API_TOKEN).");
    }
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.replicate.com/v1";
    this.models = options.models ?? DEFAULT_REPLICATE_MODELS;
  }

  async manifest(): Promise<ProviderManifest> {
    return {
      providerId: REPLICATE_PROVIDER_ID,
      displayName: "Replicate (toplayıcı)",
      mock: false,
      cacheTtlSec: 3600,
      models: this.models.map((m) => this.toManifest(m)),
    };
  }

  private toManifest(m: ReplicateModelConfig): ModelManifest {
    return {
      id: m.id,
      displayName: m.displayName,
      providerId: REPLICATE_PROVIDER_ID,
      apiVersion: "api.replicate.com/v1 (2026-08)",
      capabilities: m.capabilities,
      inputs: { types: ["text"], mimeTypes: [], maxBytes: 0 },
      options: {
        durationsSec: m.durationsSec,
        resolutions: ["720p"],
        fps: [25],
        aspectRatios: m.aspectRatios,
      },
      promptLimits: { maxChars: m.maxPromptChars, negativePrompt: false },
      params: {},
      limits: { concurrency: 2, rateLimitPerMin: 30 },
      pricing: {
        unit: "video",
        estimatedUsd: m.estimatedUsdPerRun,
        asOf: m.pricingAsOf,
        source: `Replicate model sayfası (https://replicate.com/${m.id}) — elle doğrulayın`,
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
            message: `Bilinmeyen Replicate modeli: ${request.modelId}`,
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
    if (request.prompt.negative.length > 0) {
      issues.push({
        field: "negative",
        message: "Bu model için negatif prompt doğrulanmadı; alan gönderilmeyecek.",
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
      amount: model?.estimatedUsdPerRun ?? 0,
      source: `Replicate model sayfası (${request.modelId}) — fiyat elle doğrulanmalı`,
      asOf: model?.pricingAsOf ?? "bilinmiyor",
      isExact: false,
    };
  }

  compile(request: CanonicalGenerationRequest): ProviderRequest {
    return {
      providerId: REPLICATE_PROVIDER_ID,
      modelId: request.modelId,
      payload: { input: { prompt: compileToText(request.prompt) } },
    };
  }

  async submit(request: ProviderRequest, context: SubmissionContext): Promise<ProviderJob> {
    const existing = this.byIdempotencyKey.get(context.idempotencyKey);
    if (existing) return existing;

    const response = await this.fetchImpl(`${this.baseUrl}/models/${request.modelId}/predictions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ input: request.payload["input"] }),
    });
    if (!response.ok) {
      throw new Error(
        `Replicate gönderimi başarısız: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
      );
    }
    const prediction = (await response.json()) as ReplicatePrediction;
    const job: ProviderJob = {
      providerId: REPLICATE_PROVIDER_ID,
      externalJobId: prediction.id,
      submittedAt: new Date().toISOString(),
    };
    this.byIdempotencyKey.set(context.idempotencyKey, job);
    return job;
  }

  async getStatus(job: ProviderJob): Promise<ProviderJobStatus> {
    const response = await this.fetchImpl(`${this.baseUrl}/predictions/${job.externalJobId}`, {
      headers: this.headers(),
    });
    if (response.status === 429 || response.status >= 500) {
      return { state: "running" }; // geçici hata: sonraki poll'da tekrar denenir
    }
    if (!response.ok) {
      return {
        state: "failed",
        error: toErrorEnvelope(new Error(`Replicate durum sorgusu: HTTP ${response.status}`), {
          code: "REPLICATE_STATUS_ERROR",
          retryable: false,
        }),
      };
    }
    const prediction = (await response.json()) as ReplicatePrediction;
    switch (prediction.status) {
      case "starting":
        return { state: "queued" };
      case "processing":
        return { state: "running" };
      case "succeeded":
        return { state: "succeeded", progress: 100, raw: prediction };
      case "canceled":
        return { state: "cancelled" };
      default:
        return {
          state: "failed",
          error: toErrorEnvelope(
            new Error(
              `Replicate tahmini başarısız: ${JSON.stringify(prediction.error).slice(0, 200)}`,
            ),
            { code: "REPLICATE_PREDICTION_FAILED", retryable: true },
          ),
        };
    }
  }

  async cancel(job: ProviderJob): Promise<CancelResult> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/predictions/${job.externalJobId}/cancel`,
      { method: "POST", headers: this.headers() },
    );
    return {
      cancelled: response.ok,
      ...(response.ok ? {} : { reason: `HTTP ${response.status}` }),
    };
  }

  async normalizeResult(raw: unknown): Promise<CanonicalGenerationResult> {
    const prediction = raw as ReplicatePrediction & { model?: string };
    const artifacts = extractArtifacts(prediction.output);
    if (artifacts.length === 0) {
      throw new Error(
        `Replicate çıktısında medya URL'i bulunamadı: ${JSON.stringify(prediction.output).slice(0, 300)}`,
      );
    }
    return {
      artifacts,
      provenance: {
        providerId: REPLICATE_PROVIDER_ID,
        modelId: prediction.model ?? "bilinmiyor",
        parameters: {},
        generatedAt: new Date().toISOString(),
        mock: false,
      },
    };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }
}

/** Replicate çıktısı string, string[] veya nesne olabilir; https URL'leri savunmacı toplanır. */
function extractArtifacts(output: unknown): GeneratedArtifact[] {
  const urls: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "string" && value.startsWith("https://")) urls.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === "object" && value !== null) Object.values(value).forEach(visit);
  };
  visit(output);
  return urls.map((url) => {
    const lower = url.toLowerCase();
    const isVideo = lower.includes(".mp4") || lower.includes(".webm");
    const isAudio = lower.includes(".mp3") || lower.includes(".wav");
    return {
      kind: isVideo ? ("video" as const) : isAudio ? ("audio" as const) : ("image" as const),
      url,
      mimeType: isVideo ? "video/mp4" : isAudio ? "audio/mpeg" : "image/png",
    };
  });
}
