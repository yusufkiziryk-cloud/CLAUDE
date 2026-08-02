import { z } from "zod";

const EnvSchema = z
  .object({
    STORAGE_DRIVER: z.enum(["memory", "prisma"]).default("memory"),
    QUEUE_DRIVER: z.enum(["memory", "redis"]).default("memory"),
    DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_HOST: z.string().default("127.0.0.1"),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === "prisma" && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "STORAGE_DRIVER=prisma için DATABASE_URL zorunludur.",
      });
    }
    if (env.QUEUE_DRIVER === "redis" && !env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "QUEUE_DRIVER=redis için REDIS_URL zorunludur.",
      });
    }
    if (env.QUEUE_DRIVER === "redis" && env.STORAGE_DRIVER === "memory") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "QUEUE_DRIVER=redis, STORAGE_DRIVER=memory ile kullanılamaz: API ve worker ayrı süreçlerdir, durum paylaşmak için kalıcı depolama (prisma) gerekir.",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}
