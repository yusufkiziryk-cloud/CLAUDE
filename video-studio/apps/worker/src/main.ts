import { Worker } from "bullmq";
import { z } from "zod";
import { ProviderRegistry } from "@studio/provider-sdk";
import { processGenerationJob, registerConfiguredProviders } from "@studio/shared";

/**
 * Ayrı üretim işçisi süreci (QUEUE_DRIVER=redis modu).
 * API kuyruğa yalnızca jobId bırakır; iş burada yürütülür.
 * Durum paylaşımı kalıcı depolama gerektirdiğinden PostgreSQL (prisma) zorunludur.
 */
const EnvSchema = z.object({
  REDIS_URL: z.string().min(1, "Worker için REDIS_URL zorunludur."),
  DATABASE_URL: z.string().min(1, "Worker için DATABASE_URL zorunludur (prisma depolama)."),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
});

const GENERATION_QUEUE_NAME = "generation";

async function main(): Promise<void> {
  const env = EnvSchema.parse(process.env);

  const { PrismaStorageDriver } = await import("@studio/shared/prisma");
  const storage = new PrismaStorageDriver();

  const registry = new ProviderRegistry();
  registerConfiguredProviders(registry, {
    FAL_API_KEY: process.env["FAL_API_KEY"],
    OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
  });

  const worker = new Worker<{ jobId: string }>(
    GENERATION_QUEUE_NAME,
    async (job) => {
      await processGenerationJob(job.data.jobId, {
        storage,
        registry,
        logger: (message, meta) => console.log(`[worker] ${message}`, meta ?? ""),
      });
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  worker.on("failed", (job, error) => {
    console.error(`[worker] BullMQ job başarısız: ${job?.id}`, error);
  });

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`Üretim işçisi hazır (eşzamanlılık: ${env.WORKER_CONCURRENCY}).`);
}

main().catch((error) => {
  console.error("Worker başlatılamadı:", error);
  process.exit(1);
});
