import { z } from "zod";
import { GenerationJobId, ProjectId, PromptVersionId } from "./ids.js";
import { VideoPromptSchema } from "./prompt.js";

export const Capability = z.enum([
  "textToVideo",
  "imageToVideo",
  "videoToVideo",
  "startEndFrame",
  "videoExtend",
  "inpainting",
  "motionBrush",
  "characterReference",
  "lipSync",
  "avatarVideo",
  "textToImage",
  "imageEdit",
  "textToSpeech",
  "speechToText",
  "musicGeneration",
  "soundEffectGeneration",
  "upscale",
  "interpolation",
]);
export type Capability = z.infer<typeof Capability>;

/** Sağlayıcıdan bağımsız kanonik üretim isteği. Adaptörler bunu kendi formatlarına derler. */
export const CanonicalGenerationRequest = z.object({
  capability: Capability,
  prompt: VideoPromptSchema,
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  /** Modele özgü ayarlar (manifest.params'ta beyan edilenler); bilinmeyen anahtar 'unsupported' sayılır. */
  params: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});
export type CanonicalGenerationRequest = z.infer<typeof CanonicalGenerationRequest>;

export const GenerationJobStatus = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
]);
export type GenerationJobStatus = z.infer<typeof GenerationJobStatus>;

export const CostEstimateSchema = z.object({
  currency: z.literal("USD"),
  amount: z.number().nonnegative(),
  /** Fiyat bilgisinin kaynağı ve tarihi — belirsiz fiyat kesinmiş gibi gösterilmez. */
  source: z.string(),
  /** Fiyatın doğrulandığı tarih (ISO tarih veya tarih-saat). */
  asOf: z.string().min(1),
  isExact: z.boolean().default(false),
});
export type CostEstimate = z.infer<typeof CostEstimateSchema>;

export const ErrorEnvelopeSchema = z.object({
  code: z.string(),
  userMessage: z.string(),
  developerMessage: z.string().optional(),
  retryable: z.boolean().default(false),
  correlationId: z.string().optional(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export const GenerationJobSchema = z.object({
  id: GenerationJobId,
  projectId: ProjectId,
  promptVersionId: PromptVersionId.optional(),
  request: CanonicalGenerationRequest,
  status: GenerationJobStatus,
  progress: z.number().min(0).max(100).default(0),
  idempotencyKey: z.string().min(1),
  costEstimate: CostEstimateSchema.optional(),
  actualCostUsd: z.number().nonnegative().optional(),
  error: ErrorEnvelopeSchema.optional(),
  resultAssetIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
