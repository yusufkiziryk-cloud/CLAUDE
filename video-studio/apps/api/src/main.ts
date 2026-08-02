import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { MemoryStorageDriver, type StorageDriver } from "@studio/shared";
import { loadEnv } from "./env.js";
import { buildServer } from "./server.js";
import { MemoryGenerationQueue, RedisGenerationQueue, type GenerationQueue } from "./queue.js";

async function main(): Promise<void> {
  const env = loadEnv();

  let storage: StorageDriver;
  if (env.STORAGE_DRIVER === "prisma") {
    // Dinamik import: memory modunda @prisma/client hiç yüklenmez.
    const { PrismaStorageDriver } = await import("@studio/shared/prisma");
    storage = new PrismaStorageDriver();
  } else {
    storage = new MemoryStorageDriver();
    console.warn(
      "[dev] STORAGE_DRIVER=memory: veriler süreç belleğinde tutuluyor, yeniden başlatınca silinir.",
    );
  }

  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter());
  // Faz 2: gerçek sağlayıcı adaptörleri (fal.ai, OpenAI) burada kaydolacak.

  let queue: GenerationQueue;
  if (env.QUEUE_DRIVER === "redis") {
    queue = new RedisGenerationQueue(env.REDIS_URL as string);
    console.log(
      "[queue] BullMQ/Redis kuyruğu aktif — apps/worker sürecinin çalıştığından emin olun.",
    );
  } else {
    queue = new MemoryGenerationQueue({ storage, registry });
    console.warn("[dev] QUEUE_DRIVER=memory: işler API süreci içinde işleniyor.");
  }

  const app = buildServer({ storage, registry, queue });

  const shutdown = async () => {
    await app.close();
    await queue.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  console.log(`API hazır: http://${env.API_HOST}:${env.API_PORT}`);
}

main().catch((error) => {
  console.error("API başlatılamadı:", error);
  process.exit(1);
});
