import type {
  CanonicalGenerationRequest,
  CanonicalGenerationResult,
  CancelResult,
  CostEstimate,
  MediaProviderAdapter,
  ProviderJob,
  ProviderJobStatus,
  ProviderManifest,
  ProviderRequest,
  SubmissionContext,
  ValidationIssue,
  ValidationResult,
} from "@studio/provider-sdk";
import { compileToText } from "@studio/prompt-engine";

export const MOCK_PROVIDER_ID = "mock";

/**
 * MOCK/DEMO SAĞLAYICI — gerçek AI üretimi YAPMAZ.
 *
 * Amaç: kuyruğun, durum geçişlerinin, galeri ve provenance akışının API anahtarı ve
 * maliyet olmadan uçtan uca test edilebilmesi. Çıktı olarak prompt metnini gösteren
 * bir SVG yer tutucu görsel üretir. Tüm sonuçlar provenance.mock=true taşır ve
 * arayüzde MOCK/DEMO etiketiyle gösterilmek ZORUNDADIR.
 */
const MANIFEST: ProviderManifest = {
  providerId: MOCK_PROVIDER_ID,
  displayName: "Mock Sağlayıcı (DEMO)",
  mock: true,
  cacheTtlSec: 3600,
  models: [
    {
      id: "mock-video-fast",
      displayName: "Mock Video — Hızlı (DEMO)",
      providerId: MOCK_PROVIDER_ID,
      apiVersion: "mock-v1",
      capabilities: ["textToVideo", "imageToVideo"],
      inputs: {
        types: ["text", "image"],
        mimeTypes: ["image/png", "image/jpeg"],
        maxBytes: 10 * 1024 * 1024,
      },
      options: {
        durationsSec: [3, 5, 8],
        resolutions: ["480p", "720p"],
        fps: [24],
        aspectRatios: ["16:9", "9:16", "1:1"],
      },
      promptLimits: { maxChars: 2000, negativePrompt: true },
      params: {
        seed: { type: "integer", min: 0, description: "Tekrarlanabilirlik için sabit tohum" },
      },
      limits: { concurrency: 4, rateLimitPerMin: 60 },
      pricing: {
        unit: "second",
        estimatedUsd: 0,
        asOf: "2026-08-02",
        source: "MOCK — ücretsiz demo, gerçek fiyat değildir",
      },
      delivery: "polling",
      safety: { restrictions: ["Gerçek üretim yapmaz; yalnızca akış testi içindir."] },
    },
    {
      id: "mock-video-quality",
      displayName: "Mock Video — Kalite (DEMO)",
      providerId: MOCK_PROVIDER_ID,
      apiVersion: "mock-v1",
      capabilities: ["textToVideo", "startEndFrame"],
      inputs: {
        types: ["text", "image"],
        mimeTypes: ["image/png", "image/jpeg"],
        maxBytes: 20 * 1024 * 1024,
      },
      options: {
        durationsSec: [5, 8, 10],
        resolutions: ["720p", "1080p"],
        fps: [24, 30],
        aspectRatios: ["16:9", "9:16"],
      },
      promptLimits: { maxChars: 2000, negativePrompt: true },
      params: {
        seed: { type: "integer", min: 0 },
        guidance: { type: "number", min: 1, max: 20, default: 7 },
      },
      limits: { concurrency: 2, rateLimitPerMin: 20 },
      pricing: {
        unit: "second",
        estimatedUsd: 0,
        asOf: "2026-08-02",
        source: "MOCK — ücretsiz demo, gerçek fiyat değildir",
      },
      delivery: "polling",
      safety: { restrictions: ["Gerçek üretim yapmaz; yalnızca akış testi içindir."] },
    },
  ],
};

interface MockJobState {
  request: ProviderRequest;
  polls: number;
  cancelled: boolean;
}

export interface MockAdapterOptions {
  /** Kaç getStatus çağrısından sonra job tamamlanır (deterministik test için). */
  completeAfterPolls?: number;
}

export class MockProviderAdapter implements MediaProviderAdapter {
  private readonly jobs = new Map<string, MockJobState>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private readonly completeAfterPolls: number;
  private counter = 0;

  constructor(options: MockAdapterOptions = {}) {
    this.completeAfterPolls = options.completeAfterPolls ?? 3;
  }

  async manifest(): Promise<ProviderManifest> {
    return MANIFEST;
  }

  validate(request: CanonicalGenerationRequest): ValidationResult {
    const issues: ValidationIssue[] = [];
    const model = MANIFEST.models.find((m) => m.id === request.modelId);
    if (!model) {
      return {
        ok: false,
        issues: [
          { field: "modelId", message: `Bilinmeyen model: ${request.modelId}`, kind: "invalid" },
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
    const { output } = request.prompt;
    if (!model.options.durationsSec.includes(output.durationSec)) {
      issues.push({
        field: "output.durationSec",
        message: `Desteklenen süreler: ${model.options.durationsSec.join(", ")} sn.`,
        kind: "unsupported",
      });
    }
    if (!model.options.aspectRatios.includes(output.aspectRatio)) {
      issues.push({
        field: "output.aspectRatio",
        message: `Desteklenen oranlar: ${model.options.aspectRatios.join(", ")}.`,
        kind: "unsupported",
      });
    }
    if (!model.options.resolutions.includes(output.resolution)) {
      issues.push({
        field: "output.resolution",
        message: `Desteklenen çözünürlükler: ${model.options.resolutions.join(", ")}.`,
        kind: "unsupported",
      });
    }
    const text = compileToText(request.prompt);
    if (text.length > model.promptLimits.maxChars) {
      issues.push({
        field: "prompt",
        message: `Derlenen prompt ${text.length} karakter; limit ${model.promptLimits.maxChars}.`,
        kind: "invalid",
      });
    }
    return { ok: issues.length === 0, issues };
  }

  async estimate(request: CanonicalGenerationRequest): Promise<CostEstimate> {
    return {
      currency: "USD",
      amount: 0,
      source: `MOCK sağlayıcı (${request.modelId}) — ücretsiz demo`,
      asOf: new Date().toISOString(),
      isExact: true,
    };
  }

  compile(request: CanonicalGenerationRequest): ProviderRequest {
    return {
      providerId: MOCK_PROVIDER_ID,
      modelId: request.modelId,
      payload: {
        promptText: compileToText(request.prompt),
        negative: [...request.prompt.negative].sort().join(", "),
        durationSec: request.prompt.output.durationSec,
        aspectRatio: request.prompt.output.aspectRatio,
        resolution: request.prompt.output.resolution,
        fps: request.prompt.output.fps,
        ...(request.prompt.output.seed !== undefined ? { seed: request.prompt.output.seed } : {}),
      },
    };
  }

  async submit(request: ProviderRequest, context: SubmissionContext): Promise<ProviderJob> {
    // İdempotency: aynı anahtar ikinci kez gönderilirse aynı job döner (çift ücret koruması).
    const existing = this.byIdempotencyKey.get(context.idempotencyKey);
    if (existing) {
      return {
        providerId: MOCK_PROVIDER_ID,
        externalJobId: existing,
        submittedAt: new Date().toISOString(),
      };
    }
    const externalJobId = `mockjob_${++this.counter}`;
    this.jobs.set(externalJobId, { request, polls: 0, cancelled: false });
    this.byIdempotencyKey.set(context.idempotencyKey, externalJobId);
    return { providerId: MOCK_PROVIDER_ID, externalJobId, submittedAt: new Date().toISOString() };
  }

  async getStatus(job: ProviderJob): Promise<ProviderJobStatus> {
    const state = this.jobs.get(job.externalJobId);
    if (!state) {
      return {
        state: "failed",
        error: {
          code: "JOB_NOT_FOUND",
          userMessage: "Üretim işi bulunamadı.",
          developerMessage: `Mock job yok: ${job.externalJobId}`,
          retryable: false,
        },
      };
    }
    if (state.cancelled) return { state: "cancelled" };
    state.polls += 1;
    if (state.polls < this.completeAfterPolls) {
      return {
        state: "running",
        progress: Math.min(99, Math.round((state.polls / this.completeAfterPolls) * 100)),
      };
    }
    return { state: "succeeded", progress: 100, raw: state.request };
  }

  async cancel(job: ProviderJob): Promise<CancelResult> {
    const state = this.jobs.get(job.externalJobId);
    if (!state) return { cancelled: false, reason: "Job bulunamadı" };
    state.cancelled = true;
    return { cancelled: true };
  }

  async normalizeResult(result: unknown): Promise<CanonicalGenerationResult> {
    const request = result as ProviderRequest;
    const promptText = String(request.payload["promptText"] ?? "");
    const svg = buildPlaceholderSvg(promptText, String(request.payload["aspectRatio"] ?? "16:9"));
    return {
      artifacts: [
        {
          kind: "image",
          url: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`,
          mimeType: "image/svg+xml",
          width: 1280,
          height: 720,
        },
      ],
      provenance: {
        providerId: MOCK_PROVIDER_ID,
        modelId: request.modelId,
        parameters: request.payload,
        costUsd: 0,
        generatedAt: new Date().toISOString(),
        mock: true,
      },
      actualCostUsd: 0,
    };
  }
}

function buildPlaceholderSvg(promptText: string, aspectRatio: string): string {
  const escaped = promptText
    .slice(0, 200)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#1a1a2e"/>
  <rect x="24" y="24" width="220" height="56" rx="8" fill="#e94560"/>
  <text x="134" y="60" font-family="sans-serif" font-size="28" font-weight="bold" fill="#fff" text-anchor="middle">MOCK / DEMO</text>
  <text x="640" y="340" font-family="sans-serif" font-size="24" fill="#eee" text-anchor="middle">Bu bir yer tutucudur — gerçek AI üretimi değildir.</text>
  <text x="640" y="390" font-family="sans-serif" font-size="16" fill="#aaa" text-anchor="middle">${escaped}</text>
  <text x="640" y="680" font-family="sans-serif" font-size="14" fill="#666" text-anchor="middle">oran: ${aspectRatio}</text>
</svg>`;
}
