import { z } from "zod";
import { AssetId, ProjectId } from "./ids.js";

export const AssetKind = z.enum(["image", "video", "audio", "font", "subtitle", "document"]);
export type AssetKind = z.infer<typeof AssetKind>;

/** Üretim kökeni: her AI çıktısının nereden geldiği izlenebilir olmalı. */
export const ProvenanceSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
  promptVersionId: z.string().optional(),
  parameters: z.record(z.unknown()).default({}),
  costUsd: z.number().nonnegative().optional(),
  generatedAt: z.string().datetime(),
  /** true ise bu çıktı gerçek bir AI üretimi DEĞİLDİR; arayüzde MOCK/DEMO etiketi zorunludur. */
  mock: z.boolean().default(false),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const AssetSchema = z.object({
  id: AssetId,
  projectId: ProjectId,
  kind: AssetKind,
  name: z.string().min(1).max(300),
  uri: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().length(64).optional(),
  durationSec: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  thumbnailUri: z.string().optional(),
  provenance: ProvenanceSchema.optional(),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().default(null),
});
export type Asset = z.infer<typeof AssetSchema>;
