import { z } from "zod";

// Basit, taşınabilir kimlik üretimi (crypto.randomUUID Node 20+ ve tarayıcılarda mevcut).
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export const ProjectId = z.string().min(1);
export const AssetId = z.string().min(1);
export const PromptId = z.string().min(1);
export const PromptVersionId = z.string().min(1);
export const GenerationJobId = z.string().min(1);

export type ProjectId = z.infer<typeof ProjectId>;
export type AssetId = z.infer<typeof AssetId>;
export type PromptId = z.infer<typeof PromptId>;
export type PromptVersionId = z.infer<typeof PromptVersionId>;
export type GenerationJobId = z.infer<typeof GenerationJobId>;
