import { ProviderRegistry } from "@studio/provider-sdk";
import {
  LocalDiskObjectStore,
  MemoryStorageDriver,
  S3ObjectStore,
  recoverInterruptedJobs,
  registerConfiguredProviders,
  type ObjectStore,
  type StorageDriver,
} from "@studio/shared";
import {
  OpenAIScriptGenerator,
  TemplateScriptGenerator,
  type ScriptGenerator,
} from "@studio/creative-engine";
import { loadEnv } from "./env.js";
import { buildServer } from "./server.js";
import {
  MemoryGenerationQueue,
  MemoryRenderQueue,
  RedisGenerationQueue,
  RedisRenderQueue,
  type GenerationQueue,
  type RenderQueue,
} from "./queue.js";

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

  const dataDir = process.env["DATA_DIR"] ?? `${process.cwd()}/data`;
  let objectStore: ObjectStore;
  if (env.OBJECT_STORE === "s3") {
    objectStore = new S3ObjectStore({
      endpoint: env.S3_ENDPOINT as string,
      accessKeyId: env.S3_ACCESS_KEY as string,
      secretAccessKey: env.S3_SECRET_KEY as string,
      bucket: env.S3_BUCKET as string,
    });
    console.log(`[objects] S3/MinIO deposu aktif: ${env.S3_ENDPOINT}/${env.S3_BUCKET}`);
  } else {
    objectStore = new LocalDiskObjectStore(`${dataDir}/objects`);
    console.log(`[objects] yerel disk deposu: ${dataDir}/objects`);
    if (env.QUEUE_DRIVER === "redis") {
      console.warn(
        "[objects] UYARI: redis kuyruğu + disk deposu yalnızca API ve worker AYNI makinede ve aynı DATA_DIR ile çalışırken doğrudur; dağıtık kurulumda OBJECT_STORE=s3 kullanın.",
      );
    }
  }

  const registry = new ProviderRegistry();
  const providers = registerConfiguredProviders(registry, {
    FAL_API_KEY: process.env["FAL_API_KEY"],
    OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
  });
  console.log(`[providers] kayıtlı sağlayıcılar: ${providers.registered.join(", ")}`);

  const rendersDir = `${dataDir}/renders`;
  let queue: GenerationQueue;
  let renderQueue: RenderQueue;
  if (env.QUEUE_DRIVER === "redis") {
    queue = new RedisGenerationQueue(env.REDIS_URL as string);
    renderQueue = new RedisRenderQueue(env.REDIS_URL as string);
    console.log(
      "[queue] BullMQ/Redis kuyrukları aktif (üretim + render) — apps/worker sürecinin çalıştığından emin olun.",
    );
  } else {
    queue = new MemoryGenerationQueue({ storage, registry, objectStore });
    renderQueue = new MemoryRenderQueue({ storage, rendersDir, objectStore });
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

  // Crash recovery: önceki çalışmadan 'running' kalmış işler retryable failed yapılır.
  // (redis modunda bu işi worker da yapar; işlem idempotenttir.)
  await recoverInterruptedJobs(storage, console.warn);

  const app = buildServer({
    storage,
    registry,
    queue,
    scriptGenerator,
    objectStore,
    renderQueue,
    rendersDir,
    enableLogger: true,
  });

  const shutdown = async () => {
    await app.close();
    await queue.close();
    await renderQueue.close();
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
