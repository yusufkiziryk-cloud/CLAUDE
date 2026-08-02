import { z } from "zod";
import { PromptId, PromptVersionId, ProjectId } from "./ids.js";
import { AspectRatio } from "./project.js";

/**
 * Video prompt domain modeli v1.
 * prompts.chat'in özne/sahne/kamera/ışık ayrımından esinlenmiştir (MIT — bkz. ADR-0004),
 * ancak temporal plan, referanslar ve çıktı ayarlarıyla genişletilmiştir.
 */

export const ShotType = z.enum([
  "extreme-wide",
  "wide",
  "medium",
  "medium-close",
  "close-up",
  "extreme-close-up",
]);

export const CameraMovement = z.enum([
  "static",
  "pan",
  "tilt",
  "dolly",
  "truck",
  "crane",
  "orbit",
  "handheld",
  "steadicam",
  "drone",
  "zoom",
]);

export const SubjectSpec = z.object({
  description: z.string().min(1).max(1000),
  appearance: z.string().max(1000).optional(),
  emotion: z.string().max(200).optional(),
  action: z.string().max(1000).optional(),
});

export const SceneSpec = z.object({
  environment: z.string().max(1000).optional(),
  timeOfDay: z.enum(["gündüz", "gece", "gün-batımı", "gün-doğumu", "belirsiz"]).optional(),
  weather: z.string().max(200).optional(),
  era: z.string().max(200).optional(),
});

export const CameraSpec = z.object({
  shotType: ShotType.optional(),
  angle: z.string().max(200).optional(),
  movement: CameraMovement.optional(),
  lens: z.string().max(200).optional(),
  depthOfField: z.enum(["shallow", "deep", "medium"]).optional(),
});

export const LightingSpec = z.object({
  type: z.string().max(200).optional(),
  direction: z.string().max(200).optional(),
  colorTemperature: z.enum(["sıcak", "soğuk", "nötr"]).optional(),
  contrast: z.enum(["düşük", "orta", "yüksek"]).optional(),
});

export const StyleSpec = z.object({
  visualStyle: z.string().max(500).optional(),
  colorPalette: z.string().max(500).optional(),
  filmLook: z.string().max(200).optional(),
});

export const TemporalAction = z.object({
  atSec: z.number().min(0),
  action: z.string().min(1).max(500),
});

export const AudioSpec = z.object({
  dialogue: z.string().max(2000).optional(),
  narration: z.string().max(2000).optional(),
  ambience: z.string().max(500).optional(),
  music: z.string().max(500).optional(),
});

export const ReferenceInput = z.object({
  assetId: z.string().min(1),
  role: z.enum(["style", "character", "start-frame", "end-frame", "source-video", "mask"]),
  weight: z.number().min(0).max(1).optional(),
});

export const OutputSpec = z.object({
  aspectRatio: AspectRatio.default("16:9"),
  durationSec: z.number().positive().max(60).default(5),
  fps: z.number().int().positive().max(60).default(24),
  resolution: z.enum(["480p", "720p", "1080p", "4k"]).default("720p"),
  seed: z.number().int().nonnegative().optional(),
  variations: z.number().int().min(1).max(8).default(1),
});

export const VideoPromptSchema = z.object({
  subject: SubjectSpec,
  scene: SceneSpec.default({}),
  camera: CameraSpec.default({}),
  lighting: LightingSpec.default({}),
  style: StyleSpec.default({}),
  temporal: z.array(TemporalAction).default([]),
  audio: AudioSpec.default({}),
  negative: z.array(z.string().max(200)).default([]),
  references: z.array(ReferenceInput).default([]),
  output: OutputSpec.default({}),
});
export type VideoPrompt = z.infer<typeof VideoPromptSchema>;
export type VideoPromptInput = z.input<typeof VideoPromptSchema>;

export const PromptVersionSchema = z.object({
  id: PromptVersionId,
  promptId: PromptId,
  projectId: ProjectId,
  version: z.number().int().positive(),
  /** Kullanıcının yazdığı orijinal dil korunur; çeviri ayrıca saklanır. */
  language: z.enum(["tr", "en"]).default("tr"),
  body: VideoPromptSchema,
  createdAt: z.string().datetime(),
});
export type PromptVersion = z.infer<typeof PromptVersionSchema>;
