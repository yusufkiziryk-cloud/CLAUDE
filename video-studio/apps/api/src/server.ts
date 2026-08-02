import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { z, ZodError } from "zod";
import {
  CanonicalGenerationRequest,
  CreateProjectInput,
  VideoPromptSchema,
  newId,
  type GenerationJob,
  type Project,
  type PromptVersion,
} from "@studio/domain";
import type { ProviderRegistry } from "@studio/provider-sdk";
import type { StorageDriver } from "@studio/shared";
import type { GenerationQueue } from "./queue.js";

export interface ServerDeps {
  storage: StorageDriver;
  registry: ProviderRegistry;
  queue: GenerationQueue;
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
  const { storage, registry, queue } = deps;
  const app = Fastify({ logger: false });

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

  // ---- Üretim işleri ----
  app.post("/generations", async (request, reply) => {
    const input = CreateGenerationBody.parse(request.body);

    const project = await storage.getProject(input.projectId);
    if (!project) return notFound(reply, "Proje bulunamadı.");

    // İdempotency: aynı anahtar ikinci kez gelirse mevcut iş döner, yeni ücret oluşmaz.
    const idempotencyKey = input.idempotencyKey ?? newId("idem");
    const existing = await storage.findJobByIdempotencyKey(idempotencyKey);
    if (existing) return reply.status(200).send(existing);

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
