import { ProviderRegistry } from "@studio/provider-sdk";
import {
  MemoryStorageDriver,
  registerConfiguredProviders,
  type StorageDriver,
} from "@studio/shared";
import {
  OpenAIScriptGenerator,
  TemplateScriptGenerator,
  type ScriptGenerator,
} from "@studio/creative-engine";
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
  const providers = registerConfiguredProviders(registry, {
    FAL_API_KEY: process.env["FAL_API_KEY"],
    OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
  });
  console.log(`[providers] kayıtlı sağlayıcılar: ${providers.registered.join(", ")}`);

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

  // Senaryo üretici: OpenAI anahtarı varsa gerçek LLM; yoksa açıkça etiketli şablon taslağı.
  let scriptGenerator: ScriptGenerator;
  const openaiKey = process.env["OPENAI_API_KEY"];
  if (openaiKey) {
    scriptGenerator = new OpenAIScriptGenerator({ apiKey: openaiKey });
    console.log("[script] OpenAI senaryo üretici aktif (gpt-4o-mini).");
  } else {
    scriptGenerator = new TemplateScriptGenerator();
    console.warn(
      "[script] OPENAI_API_KEY yok → şablon tabanlı taslak üretici kullanılacak (LLM DEĞİL, arayüzde etiketlenir).",
    );
  }

  const app = buildServer({ storage, registry, queue, scriptGenerator });

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
