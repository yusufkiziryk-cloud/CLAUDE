import { z } from "zod";
import type {
  CanonicalGenerationRequest,
  Capability,
  CostEstimate,
  ErrorEnvelope,
  Provenance,
} from "@studio/domain";

/** Bir modelin desteklediği tek parametrenin tanımı — UI formları bundan türetilir. */
export const ParamSpec = z.object({
  type: z.enum(["number", "integer", "string", "boolean", "enum"]),
  min: z.number().optional(),
  max: z.number().optional(),
  values: z.array(z.string()).optional(),
  default: z.union([z.number(), z.string(), z.boolean()]).optional(),
  description: z.string().optional(),
});
export type ParamSpec = z.infer<typeof ParamSpec>;

export const ModelManifestSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  providerId: z.string().min(1),
  apiVersion: z.string().min(1),
  capabilities: z.array(z.string()).min(1),
  inputs: z.object({
    types: z.array(z.enum(["text", "image", "video", "audio", "mask"])),
    mimeTypes: z.array(z.string()),
    maxBytes: z.number().int().positive(),
  }),
  options: z.object({
    durationsSec: z.array(z.number().positive()),
    resolutions: z.array(z.string()),
    fps: z.array(z.number().int().positive()),
    aspectRatios: z.array(z.string()),
  }),
  promptLimits: z.object({
    maxChars: z.number().int().positive(),
    negativePrompt: z.boolean(),
  }),
  params: z.record(ParamSpec).default({}),
  limits: z.object({
    concurrency: z.number().int().positive(),
    rateLimitPerMin: z.number().int().positive(),
  }),
  pricing: z.object({
    unit: z.enum(["second", "video", "megapixel", "character"]),
    estimatedUsd: z.number().nonnegative(),
    asOf: z.string(),
    source: z.string(),
  }),
  delivery: z.enum(["polling", "webhook", "both"]),
  safety: z.object({
    regions: z.array(z.string()).optional(),
    restrictions: z.array(z.string()).default([]),
  }),
});
export type ModelManifest = z.infer<typeof ModelManifestSchema>;

export const ProviderManifestSchema = z.object({
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  /** true ise bu sağlayıcı gerçek AI üretimi yapmaz — arayüzde MOCK/DEMO etiketi zorunludur. */
  mock: z.boolean().default(false),
  models: z.array(ModelManifestSchema),
  /** Manifest önbelleği ne kadar süre geçerli sayılır (saniye). */
  cacheTtlSec: z.number().int().positive().default(3600),
});
export type ProviderManifest = z.infer<typeof ProviderManifestSchema>;

export interface ValidationIssue {
  field: string;
  message: string;
  /** Desteklenmeyen parametre sessizce yutulmaz: unsupported ayrı bir sınıftır. */
  kind: "invalid" | "unsupported" | "missing";
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/** compile() çıktısı: sağlayıcıya gidecek somut istek. Gizli anahtar İÇERMEZ. */
export interface ProviderRequest {
  providerId: string;
  modelId: string;
  payload: Record<string, unknown>;
}

export interface SubmissionContext {
  idempotencyKey: string;
  webhookUrl?: string;
  correlationId: string;
}

export interface ProviderJob {
  providerId: string;
  externalJobId: string;
  submittedAt: string;
}

export interface ProviderJobStatus {
  state: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress?: number;
  error?: ErrorEnvelope;
  /** succeeded durumunda sağlayıcının ham sonuç verisi. */
  raw?: unknown;
}

export interface GeneratedArtifact {
  kind: "video" | "image" | "audio";
  /** Sağlayıcıdan indirilecek URL veya data URI. */
  url: string;
  mimeType: string;
  durationSec?: number;
  width?: number;
  height?: number;
}

export interface CanonicalGenerationResult {
  artifacts: GeneratedArtifact[];
  provenance: Provenance;
  actualCostUsd?: number;
}

export interface CancelResult {
  cancelled: boolean;
  reason?: string;
}

export interface WebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
}

export interface VerifiedWebhookEvent {
  externalJobId: string;
  status: ProviderJobStatus;
}

/**
 * Tüm sağlayıcı adaptörlerinin uyması gereken ortak sözleşme.
 * Çekirdek sistem sağlayıcı adlarını bilmez; yalnızca bu arayüzü bilir.
 */
export interface MediaProviderAdapter {
  manifest(): Promise<ProviderManifest>;
  validate(request: CanonicalGenerationRequest): ValidationResult;
  estimate(request: CanonicalGenerationRequest): Promise<CostEstimate>;
  compile(request: CanonicalGenerationRequest): ProviderRequest;
  submit(request: ProviderRequest, context: SubmissionContext): Promise<ProviderJob>;
  getStatus(job: ProviderJob): Promise<ProviderJobStatus>;
  cancel?(job: ProviderJob): Promise<CancelResult>;
  normalizeResult(result: unknown): Promise<CanonicalGenerationResult>;
  verifyWebhook?(request: WebhookRequest): Promise<VerifiedWebhookEvent>;
}

export type { CanonicalGenerationRequest, Capability, CostEstimate, ErrorEnvelope };
