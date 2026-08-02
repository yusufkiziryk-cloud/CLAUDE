import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { z, ZodError } from "zod";
import {
  CanonicalGenerationRequest,
  CreateProjectInput,
  CreatePromptTemplateInput,
  VideoPromptSchema,
  newId,
  type GenerationJob,
  type Project,
  type PromptTemplate,
  type PromptVersion,
} from "@studio/domain";
import type { ProviderRegistry } from "@studio/provider-sdk";
import {
  LocalDiskObjectStore,
  MockTranscriber,
  type ObjectStore,
  type StorageDriver,
  type Transcriber,
} from "@studio/shared";
import type { ScriptGenerator } from "@studio/creative-engine";
import { MemoryRenderQueue, type GenerationQueue, type RenderQueue } from "./queue.js";
import { registerCreativeRoutes } from "./routes-creative.js";
import { registerTimelineRoutes } from "./routes-timeline.js";
import { registerFileRoutes } from "./routes-files.js";
import { registerAudioRoutes } from "./routes-audio.js";

export interface ServerDeps {
  storage: StorageDriver;
  registry: ProviderRegistry;
  queue: GenerationQueue;
  scriptGenerator: ScriptGenerator;
  /** Render çıktılarının yazılacağı dizin (varsayılan: ./data/renders). */
  rendersDir?: string;
  /** Varlık nesne deposu (varsayılan: yerel disk ./data/objects). */
  objectStore?: ObjectStore;
  /** Render kuyruğu (varsayılan: süreç içi). */
  renderQueue?: RenderQueue;
  /** Yapılandırılmış log (pino) — testlerde kapalı tutulur. */
  enableLogger?: boolean;
  /** Transkripsiyon motoru (varsayılan: MOCK — arayüzde açıkça etiketlenir). */
  transcriber?: Transcriber;
}

const CreatePromptVersionBody = z.object({
  promptId: z.string().optional(),
  language: z.enum(["tr", "en"]).optional(),
  body: VideoPromptSchema,
});

const CreateGenerationBody = z.object({
  projectId: z.string().min(1),
  promptVersionId: z.string().optional(),
  request: CanonicalGenerationRequest,
  idempotencyKey: z.string().min(1).optional(),
});

export function buildServer(deps: ServerDeps): FastifyInstance {
  const { storage, registry, queue, scriptGenerator } = deps;
  const rendersDir = deps.rendersDir ?? `${process.cwd()}/data/renders`;
  const objectStore = deps.objectStore ?? new LocalDiskObjectStore(`${process.cwd()}/data/objects`);
  const renderQueue =
    deps.renderQueue ?? new MemoryRenderQueue({ storage, rendersDir, objectStore });

  const app = Fastify({
    // Gözlemlenebilirlik: yapılandırılmış log + hassas başlık redaksiyonu.
    logger: deps.enableLogger
      ? {
          level: process.env["LOG_LEVEL"] ?? "info",
          redact: {
            paths: ["req.headers.authorization", "req.headers.cookie", 'req.headers["x-api-key"]'],
            censor: "[GİZLİ]",
          },
        }
      : false,
  });
  registerCreativeRoutes(app, { storage, registry, queue, scriptGenerator });
  registerTimelineRoutes(app, { storage, rendersDir, renderQueue });
  registerFileRoutes(app, { storage, objectStore });
  registerAudioRoutes(app, {
    storage,
    registry,
    queue,
    objectStore,
    transcriber: deps.transcriber ?? new MockTranscriber(),
  });

  void app.register(cors, {
    // Faz 1 geliştirme modu: yerel web istemcisi. Üretim sertleştirmesi Faz 8'dedir.
    origin: true,
  });

  app.setErrorHandler((error, request, reply) => {
    const correlationId = request.id;
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        userMessage: "Gönderilen veri geçersiz. Alanları kontrol edin.",
        developerMessage: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        retryable: false,
        correlationId,
      });
    }
    request.log?.error?.(error);
    return reply.status(500).send({
      code: "INTERNAL_ERROR",
      userMessage: "Beklenmeyen bir hata oluştu. Girdileriniz korunuyor; tekrar deneyin.",
      developerMessage: error instanceof Error ? error.message : String(error),
      retryable: true,
      correlationId,
    });
  });

  app.get("/health", async () => ({ status: "ok" }));

  // ---- Sağlayıcılar ----
  app.get("/providers", async () => {
    const manifests = await registry.allManifests();
    return { providers: manifests };
  });

  // ---- Projeler ----
  app.post("/projects", async (request, reply) => {
    const input = CreateProjectInput.parse(request.body);
    const now = new Date().toISOString();
    const project: Project = {
      id: newId("prj"),
      name: input.name,
      purpose: input.purpose,
      aspectRatio: input.aspectRatio,
      targetDurationSec: input.targetDurationSec,
      language: input.language ?? "tr",
      resolution: input.resolution ?? "1080p",
      ...(input.style !== undefined ? { style: input.style } : {}),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await storage.createProject(project);
    return reply.status(201).send(project);
  });

  app.get("/projects", async () => ({ projects: await storage.listProjects() }));

  app.get("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    return project;
  });

  // ---- Prompt sürümleri ----
  app.post("/projects/:id/prompts", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");

    const input = CreatePromptVersionBody.parse(request.body);
    const promptId = input.promptId ?? newId("pmt");
    const existing = await storage.listPromptVersions(id);
    const latest = existing.filter((v) => v.promptId === promptId);
    const version: PromptVersion = {
      id: newId("pmv"),
      promptId,
      projectId: id,
      version: (latest[0]?.version ?? 0) + 1,
      language: input.language ?? "tr",
      body: input.body,
      createdAt: new Date().toISOString(),
    };
    await storage.createPromptVersion(version);
    return reply.status(201).send(version);
  });

  app.get("/projects/:id/prompts", async (request) => {
    const { id } = request.params as { id: string };
    return { promptVersions: await storage.listPromptVersions(id) };
  });

  // ---- Varlıklar ----
  app.get("/projects/:id/assets", async (request) => {
    const { id } = request.params as { id: string };
    return { assets: await storage.listAssets(id) };
  });

  app.get("/assets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await storage.getAsset(id);
    if (!asset) return notFound(reply, "Varlık bulunamadı.");
    return asset;
  });

  // ---- Prompt şablonları (kütüphane) ----
  app.post("/templates", async (request, reply) => {
    const input = CreatePromptTemplateInput.parse(request.body);
    const now = new Date().toISOString();
    const template: PromptTemplate = {
      id: newId("tpl"),
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      body: input.body,
      createdAt: now,
      updatedAt: now,
    };
    await storage.createPromptTemplate(template);
    return reply.status(201).send(template);
  });

  app.get("/templates", async () => ({ templates: await storage.listPromptTemplates() }));

  app.delete("/templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await storage.deletePromptTemplate(id);
    if (!deleted) return notFound(reply, "Şablon bulunamadı.");
    return reply.status(204).send();
  });

  // ---- Üretim öncesi doğrulama + maliyet tahmini ----
  app.post("/estimate", async (request, reply) => {
    const input = z.object({ request: CanonicalGenerationRequest }).parse(request.body);
    let adapter;
    try {
      adapter = registry.get(input.request.providerId);
    } catch {
      return reply.status(404).send({
        code: "PROVIDER_NOT_CONFIGURED",
        userMessage:
          `'${input.request.providerId}' sağlayıcısı bu sunucuda yapılandırılmamış ` +
          "(API anahtarı eksik olabilir — .env dosyasını kontrol edin).",
        retryable: false,
        correlationId: request.id,
      });
    }
    const validation = adapter.validate(input.request);
    const estimate = validation.ok ? await adapter.estimate(input.request) : null;
    return { validation, estimate };
  });

  // ---- Üretim işleri ----
  app.post("/generations", async (request, reply) => {
    const input = CreateGenerationBody.parse(request.body);

    const project = await storage.getProject(input.projectId);
    if (!project) return notFound(reply, "Proje bulunamadı.");

    // İdempotency: aynı anahtar ikinci kez gelirse mevcut iş döner, yeni ücret oluşmaz.
    const idempotencyKey = input.idempotencyKey ?? newId("idem");
    const existing = await storage.findJobByIdempotencyKey(idempotencyKey);
    if (existing) return reply.status(200).send(existing);

    // Politika katmanı: dudak senkronu / avatar üretimi, gerçek kişi kötüye
    // kullanımına açık olduğundan açık rıza onayı olmadan ÇALIŞTIRILMAZ.
    if (["lipSync", "avatarVideo"].includes(input.request.capability)) {
      if (input.request.params["consentConfirmed"] !== true) {
        return reply.status(403).send({
          code: "CONSENT_REQUIRED",
          userMessage:
            "Dudak senkronu/avatar üretimi için ilgili kişilerin açık rızasının alındığını onaylamanız gerekir (params.consentConfirmed=true).",
          retryable: false,
          correlationId: request.id,
        });
      }
      delete input.request.params["consentConfirmed"];
    }

    const adapter = registry.get(input.request.providerId);
    const validation = adapter.validate(input.request);
    if (!validation.ok) {
      return reply.status(422).send({
        code: "UNSUPPORTED_REQUEST",
        userMessage: "Seçilen model bu isteğin bazı ayarlarını desteklemiyor.",
        issues: validation.issues,
        retryable: false,
        correlationId: request.id,
      });
    }

    const costEstimate = await adapter.estimate(input.request);
    const now = new Date().toISOString();
    const job: GenerationJob = {
      id: newId("gen"),
      projectId: input.projectId,
      ...(input.promptVersionId !== undefined ? { promptVersionId: input.promptVersionId } : {}),
      request: input.request,
      status: "queued",
      progress: 0,
      idempotencyKey,
      costEstimate,
      resultAssetIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await storage.createGenerationJob(job);
    await queue.enqueue(job.id);
    return reply.status(202).send(job);
  });

  app.get("/generations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await storage.getGenerationJob(id);
    if (!job) return notFound(reply, "Üretim işi bulunamadı.");
    return job;
  });

  app.get("/projects/:id/generations", async (request) => {
    const { id } = request.params as { id: string };
    return { jobs: await storage.listGenerationJobs(id) };
  });

  app.post("/generations/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await storage.getGenerationJob(id);
    if (!job) return notFound(reply, "Üretim işi bulunamadı.");
    // Faz 1 sınırı: yalnızca kuyrukta bekleyen iş iptal edilir; çalışan işin
    // sağlayıcı tarafında iptali Faz 5'te (kalıcı providerJob kaydı ile) gelecek.
    if (job.status !== "queued") {
      return reply.status(409).send({
        code: "CANNOT_CANCEL",
        userMessage:
          "Bu iş artık kuyrukta değil; Faz 1'de yalnızca kuyruktaki işler iptal edilebilir.",
        retryable: false,
        correlationId: request.id,
      });
    }
    const cancelled = await storage.updateGenerationJob(id, {
      status: "cancelled",
      finishedAt: new Date().toISOString(),
    });
    return cancelled;
  });

  return app;
}

function notFound(
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  message: string,
) {
  return reply.status(404).send({
    code: "NOT_FOUND",
    userMessage: message,
    retryable: false,
  });
}
