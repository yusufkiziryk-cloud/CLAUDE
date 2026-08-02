import { z } from "zod";
import { VideoPromptSchema } from "./prompt.js";

/** Yeniden kullanılabilir prompt şablonu (prompt kütüphanesi). */
export const PromptTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  body: VideoPromptSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

export const CreatePromptTemplateInput = PromptTemplateSchema.pick({
  name: true,
  body: true,
}).extend({
  description: z.string().max(1000).optional(),
});
export type CreatePromptTemplateInput = z.infer<typeof CreatePromptTemplateInput>;
