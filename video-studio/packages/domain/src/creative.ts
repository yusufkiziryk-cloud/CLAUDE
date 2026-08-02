import { z } from "zod";
import { ProjectId } from "./ids.js";
import { VideoPromptSchema } from "./prompt.js";

/** Yaratıcı brief: senaryo üretiminin girdisi. */
export const CreativeBriefSchema = z.object({
  id: z.string().min(1),
  projectId: ProjectId,
  audience: z.string().min(1).max(500),
  goal: z.string().min(1).max(1000),
  tone: z.string().min(1).max(200),
  platform: z.string().min(1).max(200),
  cta: z.string().max(300).optional(),
  keyMessages: z.array(z.string().max(300)).default([]),
  notes: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;

export const UpsertBriefInput = CreativeBriefSchema.pick({
  audience: true,
  goal: true,
  tone: true,
  platform: true,
}).extend({
  cta: z.string().max(300).optional(),
  keyMessages: z.array(z.string().max(300)).optional(),
  notes: z.string().max(2000).optional(),
});
export type UpsertBriefInput = z.infer<typeof UpsertBriefInput>;

export const ScriptFormat = z.enum([
  "anlatici",
  "reklam",
  "egitim",
  "kisa-film",
  "haber",
  "sosyal-medya",
]);
export type ScriptFormat = z.infer<typeof ScriptFormat>;

export const ScriptSectionSchema = z.object({
  heading: z.string().min(1).max(200),
  /** Seslendirme / anlatıcı metni */
  narration: z.string().min(1).max(4000),
  /** Görüntüde ne olacağının tarifi (storyboard prompt tabanı) */
  visual: z.string().min(1).max(2000),
});
export type ScriptSection = z.infer<typeof ScriptSectionSchema>;

export const ScriptSchema = z.object({
  id: z.string().min(1),
  projectId: ProjectId,
  briefId: z.string().optional(),
  format: ScriptFormat,
  /**
   * Bu senaryoyu ne üretti: "template" = LLM'siz, kural tabanlı taslak (arayüzde
   * açıkça etiketlenir); "openai:<model>" = gerçek LLM üretimi.
   */
  generator: z.string().min(1),
  title: z.string().min(1).max(300),
  sections: z.array(ScriptSectionSchema).min(1),
  createdAt: z.string().datetime(),
});
export type Script = z.infer<typeof ScriptSchema>;

export const SceneSchema = z.object({
  id: z.string().min(1),
  projectId: ProjectId,
  scriptId: z.string().min(1),
  order: z.number().int().nonnegative(),
  title: z.string().min(1).max(300),
  summary: z.string().max(2000),
  narration: z.string().max(4000),
  durationSec: z.number().positive().max(600),
  locationName: z.string().max(200).optional(),
  timeOfDay: z.enum(["gündüz", "gece", "gün-batımı", "gün-doğumu", "belirsiz"]).optional(),
  characterNames: z.array(z.string().max(200)).default([]),
  /** Sahnenin storyboard/üretim promptu */
  prompt: VideoPromptSchema,
  storyboardJobId: z.string().optional(),
  storyboardAssetId: z.string().optional(),
  narrationJobId: z.string().optional(),
  narrationAssetId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const UpdateSceneInput = z.object({
  title: z.string().min(1).max(300).optional(),
  summary: z.string().max(2000).optional(),
  narration: z.string().max(4000).optional(),
  durationSec: z.number().positive().max(600).optional(),
  locationName: z.string().max(200).optional(),
  timeOfDay: z.enum(["gündüz", "gece", "gün-batımı", "gün-doğumu", "belirsiz"]).optional(),
  characterNames: z.array(z.string().max(200)).optional(),
  storyboardJobId: z.string().optional(),
  storyboardAssetId: z.string().optional(),
  narrationJobId: z.string().optional(),
  narrationAssetId: z.string().optional(),
});
export type UpdateSceneInput = z.infer<typeof UpdateSceneInput>;

/** Karakter / mekân / stil kartı ("bible"). */
export const BibleCardSchema = z.object({
  id: z.string().min(1),
  projectId: ProjectId,
  kind: z.enum(["character", "location", "style"]),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  /** Sahne promptlarına kilitlenen parça; tutarlılık denetçisi varlığını kontrol eder. */
  promptFragment: z.string().max(500).optional(),
  /** Gerçek bir kişiyi temsil ediyorsa açık rıza kaydı zorunludur. */
  isRealPerson: z.boolean().default(false),
  consentConfirmed: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BibleCard = z.infer<typeof BibleCardSchema>;

export const CreateBibleCardInput = BibleCardSchema.pick({
  kind: true,
  name: true,
  description: true,
}).extend({
  promptFragment: z.string().max(500).optional(),
  isRealPerson: z.boolean().optional(),
  consentConfirmed: z.boolean().optional(),
});
export type CreateBibleCardInput = z.infer<typeof CreateBibleCardInput>;

export const ContinuityIssueSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  code: z.string(),
  message: z.string(),
  sceneId: z.string().optional(),
});
export type ContinuityIssue = z.infer<typeof ContinuityIssueSchema>;
