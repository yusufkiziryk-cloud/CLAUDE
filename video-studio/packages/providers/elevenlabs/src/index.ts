import type {
  CanonicalGenerationRequest,
  CanonicalGenerationResult,
  CostEstimate,
  MediaProviderAdapter,
  ParamSpec,
  ProviderJob,
  ProviderJobStatus,
  ProviderManifest,
  ProviderRequest,
  SubmissionContext,
  ValidationIssue,
  ValidationResult,
} from "@studio/provider-sdk";
import { validateParams } from "@studio/provider-sdk";

export const ELEVENLABS_PROVIDER_ID = "elevenlabs";

/**
 * ElevenLabs TTS adaptörü. Sözleşme resmî OpenAPI spec'inden doğrulandı
 * (https://api.elevenlabs.io/openapi.json, 2026-08-02):
 * - POST /v1/text-to-speech/{voice_id} — kimlik: `xi-api-key` başlığı
 * - Gövde: { text (zorunlu), model_id (varsayılan eleven_multilingual_v2), seed... }
 * - `output_format` sorgu parametresi; yanıt ikili ses gövdesidir.
 * Uç eşzamanlıdır: submit çağrıyı yapar, getStatus hemen succeeded döner.
 */

const TTS_MODEL = "eleven_multilingual_v2";
/** ElevenLabs'in herkese açık hazır (premade) seslerinden bilinen kimlikler. */
const PREMADE_VOICES = ["21m00Tcm4TlvDq8ikWAM", "AZnzlk1XvdvUeBnXmlld", "pNInz6obpgDQGcFmaJgB"];

const TTS_PARAMS: Record<string, ParamSpec> = {
  voiceId: {
    type: "string",
    default: PREMADE_VOICES[0] as string,
    description: "ElevenLabs ses kimliği (hazır sesler veya kendi ses kimliğiniz)",
  },
  seed: { type: "integer", min: 0, description: "Tekrarlanabilirlik için sabit tohum" },
};

export interface ElevenLabsAdapterOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class ElevenLabsProviderAdapter implements MediaProviderAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly results = new Map<string, { base64: string; voiceId: string }>();
  private readonly byIdempotencyKey = new Map<string, ProviderJob>();
  private counter = 0;

  constructor(options: ElevenLabsAdapterOptions) {
    if (!options.apiKey) {
      throw new Error("ElevenLabsProviderAdapter için apiKey zorunludur (ELEVENLABS_API_KEY).");
    }
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.elevenlabs.io";
  }

  async manifest(): Promise<ProviderManifest> {
    return {
      providerId: ELEVENLABS_PROVIDER_ID,
      displayName: "ElevenLabs (ses)",
      mock: false,
      cacheTtlSec: 3600,
      models: [
        {
          id: TTS_MODEL,
          displayName: "ElevenLabs Multilingual v2 — Seslendirme (TR destekli)",
          providerId: ELEVENLABS_PROVIDER_ID,
          apiVersion: "v1/text-to-speech (2026-08)",
          capabilities: ["textToSpeech"],
          inputs: { types: ["text"], mimeTypes: [], maxBytes: 0 },
          options: { durationsSec: [], resolutions: [], fps: [], aspectRatios: [] },
          promptLimits: { maxChars: 5000, negativePrompt: false },
          params: TTS_PARAMS,
          limits: { concurrency: 4, rateLimitPerMin: 60 },
          pricing: {
            unit: "character",
            estimatedUsd: 0.00003,
            asOf: "2026-08-02",
            source: "ElevenLabs fiyatlandırma sayfası (karakter başı yaklaşık) — elle doğrulayın",
          },
          delivery: "polling",
          safety: {
            restrictions: [
              "Ses klonlama bu adaptörde bilinçli olarak KAPALIDIR (izin katmanı gerektirir).",
              "Metin `audio.narration` veya `audio.dialogue` alanından alınır.",
            ],
          },
        },
      ],
    };
  }

  validate(request: CanonicalGenerationRequest): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (request.modelId !== TTS_MODEL) {
      return {
        ok: false,
        issues: [
          {
            field: "modelId",
            message: `Bilinmeyen ElevenLabs modeli: ${request.modelId}`,
            kind: "invalid",
          },
        ],
      };
    }
    if (request.capability !== "textToSpeech") {
      issues.push({
        field: "capability",
        message: "ElevenLabs adaptörü yalnızca 'textToSpeech' destekler.",
        kind: "unsupported",
      });
    }
    issues.push(...validateParams(request.params, TTS_PARAMS));
    const speech = request.prompt.audio.narration ?? request.prompt.audio.dialogue ?? "";
    if (speech.trim().length === 0) {
      issues.push({
        field: "audio.narration",
        message: "Seslendirme için 'anlatıcı' veya 'diyalog' metni gerekli.",
        kind: "missing",
      });
    } else if (speech.length > 5000) {
      issues.push({
        field: "audio.narration",
        message: "Seslendirme metni 5000 karakteri aşamaz.",
        kind: "invalid",
      });
    }
    return { ok: issues.length === 0, issues };
  }

  async estimate(request: CanonicalGenerationRequest): Promise<CostEstimate> {
    const speech = request.prompt.audio.narration ?? request.prompt.audio.dialogue ?? "";
    return {
      currency: "USD",
      amount: Math.round(speech.length * 0.00003 * 10000) / 10000,
      source: "ElevenLabs fiyatlandırma sayfası (yaklaşık) — elle doğrulayın",
      asOf: "2026-08-02",
      isExact: false,
    };
  }

  compile(request: CanonicalGenerationRequest): ProviderRequest {
    const speech = request.prompt.audio.narration ?? request.prompt.audio.dialogue ?? "";
    const voiceId =
      typeof request.params["voiceId"] === "string"
        ? request.params["voiceId"]
        : (PREMADE_VOICES[0] as string);
    return {
      providerId: ELEVENLABS_PROVIDER_ID,
      modelId: TTS_MODEL,
      payload: {
        voiceId,
        body: {
          text: speech,
          model_id: TTS_MODEL,
          ...(typeof request.params["seed"] === "number" ? { seed: request.params["seed"] } : {}),
        },
      },
    };
  }

  async submit(request: ProviderRequest, context: SubmissionContext): Promise<ProviderJob> {
    const existing = this.byIdempotencyKey.get(context.idempotencyKey);
    if (existing) return existing;

    const voiceId = String(request.payload["voiceId"]);
    const response = await this.fetchImpl(
      `${this.baseUrl}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(request.payload["body"]),
      },
    );
    if (!response.ok) {
      throw new Error(
        `ElevenLabs isteği başarısız: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const externalJobId = `el-${++this.counter}`;
    this.results.set(externalJobId, { base64: buffer.toString("base64"), voiceId });

    const job: ProviderJob = {
      providerId: ELEVENLABS_PROVIDER_ID,
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
          userMessage: "Seslendirme sonucu bulunamadı; lütfen tekrar deneyin.",
          developerMessage: `ElevenLabs sonucu bellekte yok: ${job.externalJobId}`,
          retryable: true,
        },
      };
    }
    return { state: "succeeded", progress: 100, raw };
  }

  async normalizeResult(raw: unknown): Promise<CanonicalGenerationResult> {
    const result = raw as { base64: string; voiceId: string };
    return {
      artifacts: [
        {
          kind: "audio",
          url: `data:audio/mpeg;base64,${result.base64}`,
          mimeType: "audio/mpeg",
        },
      ],
      provenance: {
        providerId: ELEVENLABS_PROVIDER_ID,
        modelId: TTS_MODEL,
        parameters: { voiceId: result.voiceId },
        generatedAt: new Date().toISOString(),
        mock: false,
      },
    };
  }
}
