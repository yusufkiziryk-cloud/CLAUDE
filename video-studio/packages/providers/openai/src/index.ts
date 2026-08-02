import type {
  CanonicalGenerationRequest,
  CanonicalGenerationResult,
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
import { validateParams, type ParamSpec } from "@studio/provider-sdk";
import { compileToText } from "@studio/prompt-engine";

export const OPENAI_PROVIDER_ID = "openai";

/**
 * OpenAI adaptörü — görsel üretimi (gpt-image-1) ve TTS (gpt-4o-mini-tts).
 *
 * Sözleşme resmî OpenAPI spec'inden doğrulandı (github.com/openai/openai-openapi, 2026-08-02):
 * - POST https://api.openai.com/v1/images/generations
 *   gpt-image-1: prompt ≤32000; size: 1024x1024|1536x1024|1024x1536|auto;
 *   quality: low|medium|high|auto; yanıt HER ZAMAN base64 (data[].b64_json).
 * - POST https://api.openai.com/v1/audio/speech
 *   {model, input ≤4096, voice, response_format: mp3|..., speed} → ikili ses gövdesi.
 *
 * OpenAI uçları eşzamanlıdır (kuyruk yok): submit çağrıyı yapar, sonucu bellekte tutar;
 * getStatus hemen succeeded döner. Fiyat tahminleri kesin DEĞİLDİR (isExact=false).
 */

const IMAGE_MODEL = "gpt-image-1";
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICES = ["alloy", "ash", "coral", "echo", "nova", "onyx", "sage", "shimmer"];

const IMAGE_PARAMS: Record<string, ParamSpec> = {
  quality: {
    type: "enum",
    values: ["low", "medium", "high", "auto"],
    default: "medium",
    description: "Görsel kalitesi (maliyeti etkiler)",
  },
};

const TTS_PARAMS: Record<string, ParamSpec> = {
  voice: { type: "enum", values: TTS_VOICES, default: "alloy", description: "Ses karakteri" },
  speed: { type: "number", min: 0.25, max: 4, default: 1, description: "Konuşma hızı" },
};

export interface OpenAIAdapterOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class OpenAIProviderAdapter implements MediaProviderAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly results = new Map<string, unknown>();
  private readonly byIdempotencyKey = new Map<string, ProviderJob>();
  private counter = 0;

  constructor(options: OpenAIAdapterOptions) {
    if (!options.apiKey) {
      throw new Error("OpenAIProviderAdapter için apiKey zorunludur (OPENAI_API_KEY).");
    }
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com";
  }

  async manifest(): Promise<ProviderManifest> {
    return {
      providerId: OPENAI_PROVIDER_ID,
      displayName: "OpenAI (doğrudan)",
      mock: false,
      cacheTtlSec: 3600,
      models: [
        {
          id: IMAGE_MODEL,
          displayName: "GPT Image 1 — Metinden Görsel",
          providerId: OPENAI_PROVIDER_ID,
          apiVersion: "v1/images/generations (2026-08)",
          capabilities: ["textToImage"],
          inputs: { types: ["text"], mimeTypes: [], maxBytes: 0 },
          options: {
            durationsSec: [],
            resolutions: ["1024x1024", "1536x1024", "1024x1536"],
            fps: [],
            aspectRatios: ["1:1", "16:9", "9:16"],
          },
          promptLimits: { maxChars: 32000, negativePrompt: false },
          params: IMAGE_PARAMS,
          limits: { concurrency: 4, rateLimitPerMin: 60 },
          pricing: {
            unit: "megapixel",
            estimatedUsd: 0.04,
            asOf: "2026-08-02",
            source:
              "OpenAI fiyatlandırma sayfası (orta kalite 1024x1024 yaklaşık değeri) — elle doğrulayın",
          },
          delivery: "polling",
          safety: { restrictions: ["Eşzamanlı uç; üretim isteği anında işlenir."] },
        },
        {
          id: TTS_MODEL,
          displayName: "GPT-4o mini TTS — Seslendirme",
          providerId: OPENAI_PROVIDER_ID,
          apiVersion: "v1/audio/speech (2026-08)",
          capabilities: ["textToSpeech"],
          inputs: { types: ["text"], mimeTypes: [], maxBytes: 0 },
          options: { durationsSec: [], resolutions: [], fps: [], aspectRatios: [] },
          promptLimits: { maxChars: 4096, negativePrompt: false },
          params: TTS_PARAMS,
          limits: { concurrency: 4, rateLimitPerMin: 60 },
          pricing: {
            unit: "character",
            estimatedUsd: 0.000015,
            asOf: "2026-08-02",
            source: "OpenAI fiyatlandırma sayfası (karakter başı yaklaşık) — elle doğrulayın",
          },
          delivery: "polling",
          safety: {
            restrictions: ["Metin `audio.narration` veya `audio.dialogue` alanından alınır."],
          },
        },
      ],
    };
  }

  validate(request: CanonicalGenerationRequest): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (request.modelId === IMAGE_MODEL || request.modelId === TTS_MODEL) {
      issues.push(
        ...validateParams(
          request.params,
          request.modelId === IMAGE_MODEL ? IMAGE_PARAMS : TTS_PARAMS,
        ),
      );
    }
    if (request.modelId === IMAGE_MODEL) {
      if (request.capability !== "textToImage") {
        issues.push({
          field: "capability",
          message: `${IMAGE_MODEL} yalnızca 'textToImage' destekler.`,
          kind: "unsupported",
        });
      }
      if (!["1:1", "16:9", "9:16"].includes(request.prompt.output.aspectRatio)) {
        issues.push({
          field: "output.aspectRatio",
          message: "gpt-image-1 için desteklenen oranlar: 1:1, 16:9, 9:16.",
          kind: "unsupported",
        });
      }
      const text = compileToText(request.prompt);
      if (text.length > 32000) {
        issues.push({
          field: "prompt",
          message: "Prompt 32000 karakteri aşıyor.",
          kind: "invalid",
        });
      }
      if (request.prompt.negative.length > 0) {
        issues.push({
          field: "negative",
          message: "gpt-image-1 ayrı negatif prompt alanı desteklemiyor.",
          kind: "unsupported",
        });
      }
    } else if (request.modelId === TTS_MODEL) {
      if (request.capability !== "textToSpeech") {
        issues.push({
          field: "capability",
          message: `${TTS_MODEL} yalnızca 'textToSpeech' destekler.`,
          kind: "unsupported",
        });
      }
      const speechText = request.prompt.audio.narration ?? request.prompt.audio.dialogue ?? "";
      if (speechText.trim().length === 0) {
        issues.push({
          field: "audio.narration",
          message: "Seslendirme için 'anlatıcı' veya 'diyalog' metni gerekli.",
          kind: "missing",
        });
      } else if (speechText.length > 4096) {
        issues.push({
          field: "audio.narration",
          message: "Seslendirme metni 4096 karakteri aşamaz.",
          kind: "invalid",
        });
      }
    } else {
      issues.push({
        field: "modelId",
        message: `Bilinmeyen OpenAI modeli: ${request.modelId}`,
        kind: "invalid",
      });
    }
    return { ok: issues.length === 0, issues };
  }

  async estimate(request: CanonicalGenerationRequest): Promise<CostEstimate> {
    let amount = 0;
    if (request.modelId === IMAGE_MODEL) {
      amount = 0.04;
    } else if (request.modelId === TTS_MODEL) {
      const text = request.prompt.audio.narration ?? request.prompt.audio.dialogue ?? "";
      amount = text.length * 0.000015;
    }
    return {
      currency: "USD",
      amount: Math.round(amount * 10000) / 10000,
      source: "OpenAI fiyatlandırma sayfası (yaklaşık) — elle doğrulayın",
      asOf: "2026-08-02",
      isExact: false,
    };
  }

  compile(request: CanonicalGenerationRequest): ProviderRequest {
    if (request.modelId === IMAGE_MODEL) {
      return {
        providerId: OPENAI_PROVIDER_ID,
        modelId: IMAGE_MODEL,
        payload: {
          endpoint: "/v1/images/generations",
          body: {
            model: IMAGE_MODEL,
            prompt: compileToText(request.prompt),
            n: 1,
            size: aspectToSize(request.prompt.output.aspectRatio),
            quality:
              typeof request.params["quality"] === "string" ? request.params["quality"] : "medium",
          },
        },
      };
    }
    const speechText = request.prompt.audio.narration ?? request.prompt.audio.dialogue ?? "";
    return {
      providerId: OPENAI_PROVIDER_ID,
      modelId: TTS_MODEL,
      payload: {
        endpoint: "/v1/audio/speech",
        body: {
          model: TTS_MODEL,
          input: speechText,
          voice: typeof request.params["voice"] === "string" ? request.params["voice"] : "alloy",
          ...(typeof request.params["speed"] === "number"
            ? { speed: request.params["speed"] }
            : {}),
          response_format: "mp3",
        },
      },
    };
  }

  async submit(request: ProviderRequest, context: SubmissionContext): Promise<ProviderJob> {
    const existing = this.byIdempotencyKey.get(context.idempotencyKey);
    if (existing) return existing;

    const endpoint = String(request.payload["endpoint"]);
    const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.payload["body"]),
    });
    if (!response.ok) {
      throw new Error(
        `OpenAI isteği başarısız: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
      );
    }

    const externalJobId = `oai-${++this.counter}`;
    if (endpoint === "/v1/images/generations") {
      const body = (await response.json()) as { data?: { b64_json?: string }[] };
      this.results.set(externalJobId, { kind: "image", modelId: request.modelId, body });
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      this.results.set(externalJobId, {
        kind: "audio",
        modelId: request.modelId,
        base64: buffer.toString("base64"),
      });
    }

    const job: ProviderJob = {
      providerId: OPENAI_PROVIDER_ID,
      externalJobId,
      submittedAt: new Date().toISOString(),
    };
    this.byIdempotencyKey.set(context.idempotencyKey, job);
    return job;
  }

  async getStatus(job: ProviderJob): Promise<ProviderJobStatus> {
    const raw = this.results.get(job.externalJobId);
    if (!raw) {
      return {
        state: "failed",
        error: {
          code: "RESULT_LOST",
          userMessage: "Üretim sonucu bulunamadı; lütfen tekrar deneyin.",
          developerMessage: `OpenAI sonucu bellekte yok: ${job.externalJobId} (süreç yeniden mi başladı?)`,
          retryable: true,
        },
      };
    }
    return { state: "succeeded", progress: 100, raw };
  }

  async normalizeResult(raw: unknown): Promise<CanonicalGenerationResult> {
    const r = raw as
      | { kind: "image"; modelId: string; body: { data?: { b64_json?: string }[] } }
      | { kind: "audio"; modelId: string; base64: string };

    if (r.kind === "image") {
      const items = (r.body.data ?? []).filter((d) => typeof d.b64_json === "string");
      if (items.length === 0) throw new Error("OpenAI görsel yanıtında b64_json bulunamadı.");
      return {
        artifacts: items.map((d) => ({
          kind: "image" as const,
          url: `data:image/png;base64,${d.b64_json}`,
          mimeType: "image/png",
        })),
        provenance: {
          providerId: OPENAI_PROVIDER_ID,
          modelId: r.modelId,
          parameters: {},
          generatedAt: new Date().toISOString(),
          mock: false,
        },
      };
    }
    return {
      artifacts: [
        {
          kind: "audio",
          url: `data:audio/mpeg;base64,${r.base64}`,
          mimeType: "audio/mpeg",
        },
      ],
      provenance: {
        providerId: OPENAI_PROVIDER_ID,
        modelId: r.modelId,
        parameters: {},
        generatedAt: new Date().toISOString(),
        mock: false,
      },
    };
  }
}

function aspectToSize(aspectRatio: string): string {
  // Resmî spec'te gpt-image-1 için desteklenen sabit boyutlar.
  if (aspectRatio === "16:9") return "1536x1024";
  if (aspectRatio === "9:16") return "1024x1536";
  return "1024x1024";
}
