import { Worker } from "bullmq";
import { z } from "zod";
import { ProviderRegistry } from "@studio/provider-sdk";
import {
  LocalDiskObjectStore,
  S3ObjectStore,
  executeRenderJob,
  processGenerationJob,
  recoverInterruptedJobs,
  registerConfiguredProviders,
  type ObjectStore,
} from "@studio/shared";

/**
 * Ayrı işçi süreci (QUEUE_DRIVER=redis modu): üretim VE render kuyruklarını tüketir.
 * Durum paylaşımı kalıcı depolama gerektirdiğinden PostgreSQL (prisma) zorunludur.
 */
const EnvSchema = z.object({
  REDIS_URL: z.string().min(1, "Worker için REDIS_URL zorunludur."),
  DATABASE_URL: z.string().min(1, "Worker için DATABASE_URL zorunludur (prisma depolama)."),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  OBJECT_STORE: z.enum(["disk", "s3"]).default("disk"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  DATA_DIR: z.string().optional(),
});

const GENERATION_QUEUE_NAME = "generation";
const RENDER_QUEUE_NAME = "render";

async function main(): Promise<void> {
  const env = EnvSchema.parse(process.env);

  const { PrismaStorageDriver } = await import("@studio/shared/prisma");
  const storage = new PrismaStorageDriver();

  const dataDir = env.DATA_DIR ?? `${process.cwd()}/data`;
  let objectStore: ObjectStore;
  if (env.OBJECT_STORE === "s3") {
    objectStore = new S3ObjectStore({
      endpoint: env.S3_ENDPOINT as string,
      accessKeyId: env.S3_ACCESS_KEY as string,
      secretAccessKey: env.S3_SECRET_KEY as string,
      bucket: env.S3_BUCKET as string,
    });
  } else {
    objectStore = new LocalDiskObjectStore(`${dataDir}/objects`);
    console.warn(
      `[objects] disk deposu (${dataDir}/objects): API ile AYNI makinede ve aynı DATA_DIR ile çalıştığınızdan emin olun.`,
    );
  }

  const registry = new ProviderRegistry();
  registerConfiguredProviders(registry, {
    FAL_API_KEY: process.env["FAL_API_KEY"],
    OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
    REPLICATE_API_TOKEN: process.env["REPLICATE_API_TOKEN"],
    ELEVENLABS_API_KEY: process.env["ELEVENLABS_API_KEY"],
  });

  await recoverInterruptedJobs(storage, console.warn);

  const connection = { url: env.REDIS_URL };

  const generationWorker = new Worker<{ jobId: string }>(
    GENERATION_QUEUE_NAME,
    async (job) => {
      await processGenerationJob(job.data.jobId, {
        storage,
        registry,
        objectStore,
        logger: (message, meta) => console.log(`[worker:gen] ${message}`, meta ?? ""),
      });
    },
    { connection, concurrency: env.WORKER_CONCURRENCY },
  );

  const renderWorker = new Worker<{ jobId: string }>(
    RENDER_QUEUE_NAME,
    async (job) => {
      const renderJob = await storage.getRenderJob(job.data.jobId);
      if (!renderJob) return;
      const sequence = await storage.getSequenceByProject(renderJob.projectId);
      if (!sequence) return;
      await executeRenderJob(renderJob, sequence, {
        storage,
        objectStore,
        rendersDir: `${dataDir}/renders`,
        onLog: (message) => console.log(`[worker:render] ${message}`),
      });
    },
    { connection, concurrency: 1 }, // render CPU-yoğundur; tek tek işlenir
  );

  for (const [name, worker] of [
    ["generation", generationWorker],
    ["render", renderWorker],
  ] as const) {
    worker.on("failed", (job, error) => {
      console.error(`[worker:${name}] BullMQ job başarısız: ${job?.id}`, error.message);
    });
  }

  const shutdown = async () => {
    await generationWorker.close();
    await renderWorker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(
    `İşçi hazır: üretim (eşzamanlılık ${env.WORKER_CONCURRENCY}) + render kuyrukları dinleniyor.`,
  );
}

main().catch((error) => {
  console.error("Worker başlatılamadı:", error);
  process.exit(1);
});
