import { z } from "zod";
import { ProjectId } from "./ids.js";

export const AspectRatio = z.enum(["16:9", "9:16", "1:1", "4:5", "21:9"]);
export type AspectRatio = z.infer<typeof AspectRatio>;

export const ProjectPurpose = z.enum([
  "sosyal-medya",
  "reklam",
  "egitim",
  "kurumsal",
  "sinematik",
  "haber",
  "slayt",
  "diger",
]);
export type ProjectPurpose = z.infer<typeof ProjectPurpose>;

export const ProjectSchema = z.object({
  id: ProjectId,
  name: z.string().min(1).max(200),
  purpose: ProjectPurpose,
  aspectRatio: AspectRatio,
  targetDurationSec: z.number().int().positive().max(3600),
  language: z.enum(["tr", "en"]).default("tr"),
  resolution: z.enum(["720p", "1080p", "4k"]).default("1080p"),
  style: z.string().max(500).optional(),
  /** Üretim bütçesi (USD). Tanımsız → sınırsız. Aşılırsa yeni üretim reddedilir. */
  budgetUsd: z.number().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().default(null),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInput = ProjectSchema.pick({
  name: true,
  purpose: true,
  aspectRatio: true,
  targetDurationSec: true,
}).extend({
  language: z.enum(["tr", "en"]).optional(),
  resolution: z.enum(["720p", "1080p", "4k"]).optional(),
  style: z.string().max(500).optional(),
  budgetUsd: z.number().positive().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;
