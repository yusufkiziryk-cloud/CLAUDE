import { z } from "zod";

const EnvSchema = z
  .object({
    STORAGE_DRIVER: z.enum(["memory", "prisma"]).default("memory"),
    QUEUE_DRIVER: z.enum(["memory", "redis"]).default("memory"),
    OBJECT_STORE: z.enum(["disk", "s3"]).default("disk"),
    DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_HOST: z.string().default("127.0.0.1"),
    /** Web arayüzünün origin'i; CORS bu değere daraltılır. */
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    /** IP başına dakikalık istek sınırı. 0 → kapalı (yalnızca güvenilir ağda!). */
    RATE_LIMIT_PER_MIN: z.coerce.number().int().nonnegative().default(300),
    /** Tek dosya yükleme üst sınırı (MiB). */
    UPLOAD_MAX_MB: z.coerce.number().int().positive().default(200),
    /** Bitmiş iş/varlık saklama süresi (gün). Tanımsız → süpürme KAPALI. */
    DATA_RETENTION_DAYS: z.coerce.number().int().positive().optional(),
    /** Tanımlıysa API parola korumalıdır (min 8 karakter). Tanımsız → açık geliştirme modu. */
    AUTH_PASSWORD: z.string().min(8, "AUTH_PASSWORD en az 8 karakter olmalıdır.").optional(),
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
    if (
      env.OBJECT_STORE === "s3" &&
      (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_BUCKET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "OBJECT_STORE=s3 için S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET zorunludur.",
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
