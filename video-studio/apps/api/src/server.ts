import { randomBytes, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
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
  /** CORS origin (WEB_ORIGIN). Verilmezse geliştirme/test için serbesttir. */
  corsOrigin?: string | boolean;
  /** Dakika başına istek sınırı (IP başına). false → kapalı (testler). */
  rateLimitPerMin?: number | false;
  /** JSON gövde üst sınırı (bayt). Varsayılan 2 MiB. */
  bodyLimitBytes?: number;
  /** Tek dosya yükleme üst sınırı (bayt). Varsayılan 200 MiB. */
  maxUploadBytes?: number;
  /** Tanımlıysa tüm uçlar (health/login/medya hariç) Bearer oturum token'ı ister. */
  authPassword?: string;
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
    // Sınırsız JSON gövdesi kabul edilmez (varsayılan 2 MiB; multipart ayrı sınırlıdır).
    bodyLimit: deps.bodyLimitBytes ?? 2 * 1024 * 1024,
  });

  // Güvenlik başlıkları. CSP API yanıtları için anlamlı değil; /files/* medyası
  // web arayüzü tarafından FARKLI origin'den yüklendiğinden CORP cross-origin olmalı.
  void app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // İstek sınırı (IP başına, dakikalık sabit pencere). Süreç içi sayaçtır;
  // çok kopyalı dağıtımda paylaşımlı depo gerekir (docs/SECURITY.md).
  if (deps.rateLimitPerMin !== false) {
    const max = deps.rateLimitPerMin ?? 300;
    const hits = new Map<string, { count: number; resetAt: number }>();
    app.addHook("onRequest", async (request, reply) => {
      const now = Date.now();
      const entry = hits.get(request.ip);
      if (!entry || now >= entry.resetAt) {
        // Süresi geçen tüm pencereler temizlenir; harita sınırsız büyümez.
        if (hits.size > 10_000) {
          for (const [ip, e] of hits) if (now >= e.resetAt) hits.delete(ip);
        }
        hits.set(request.ip, { count: 1, resetAt: now + 60_000 });
        return;
      }
      entry.count += 1;
      if (entry.count > max) {
        const afterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        // Bu kanca CORS eklentisinden ÖNCE koşar; başlık olmadan tarayıcı yanıtı
        // "ağ hatası" olarak gizler. İzinli origin'i elle ekleriz.
        const origin =
          typeof deps.corsOrigin === "string" ? deps.corsOrigin : (request.headers.origin ?? "*");
        return reply
          .status(429)
          .header("retry-after", String(afterSec))
          .header("access-control-allow-origin", origin)
          .send({
            code: "RATE_LIMITED",
            userMessage: `Çok fazla istek gönderildi; lütfen ${afterSec} saniye sonra tekrar deneyin.`,
            developerMessage: `IP başına sınır: ${max}/dk`,
            retryable: true,
            correlationId: request.id,
          });
      }
    });
  }

  // Kimlik doğrulama (opsiyonel): authPassword tanımlıysa tüm uçlar oturum ister.
  // Oturumlar süreç içidir (API tek süreçtir; worker HTTP servis etmez).
  if (deps.authPassword) {
    const password = Buffer.from(deps.authPassword);
    const sessions = new Map<string, number>(); // token → geçerlilik sonu (ms)
    const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

    app.post("/auth/login", async (request, reply) => {
      const body = z.object({ password: z.string().min(1) }).parse(request.body);
      const given = Buffer.from(body.password);
      const ok = given.length === password.length && timingSafeEqual(given, password);
      if (!ok) {
        return reply.status(401).send({
          code: "INVALID_CREDENTIALS",
          userMessage: "Parola hatalı.",
          retryable: false,
          correlationId: request.id,
        });
      }
      const token = randomBytes(32).toString("hex");
      sessions.set(token, Date.now() + SESSION_TTL_MS);
      return { token, expiresInSec: SESSION_TTL_MS / 1000 };
    });

    // preHandler: CORS eklentisinin onRequest kancasından SONRA koşar; böylece
    // 401 yanıtı da CORS başlıkları taşır ve tarayıcıda okunabilir kalır.
    app.addHook("preHandler", async (request, reply) => {
      if (request.method === "OPTIONS") return; // CORS preflight kimliksizdir
      const path = request.url.split("?")[0] ?? "";
      if (path === "/health" || path === "/auth/login") return;
      // Medya <img>/<audio>/<video> etiketleriyle başlıksız yüklenir; anahtarlar
      // tahmin edilemez kimlikler içerir — imzalı URL'ler yol haritasında (SECURITY.md).
      if (
        request.method === "GET" &&
        (path.startsWith("/files/") || path.startsWith("/renders/"))
      ) {
        return;
      }
      const header = request.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
      const expiresAt = token ? sessions.get(token) : undefined;
      if (!token || expiresAt === undefined || expiresAt < Date.now()) {
        if (token) sessions.delete(token);
        return reply.status(401).send({
          code: "UNAUTHORIZED",
          userMessage: "Oturum gerekli: parolayla giriş yapın.",
          retryable: false,
          correlationId: request.id,
        });
      }
    });
  }

  registerCreativeRoutes(app, { storage, registry, queue, scriptGenerator });
  registerTimelineRoutes(app, { storage, rendersDir, renderQueue });
  registerFileRoutes(app, {
    storage,
    objectStore,
    ...(deps.maxUploadBytes !== undefined ? { maxUploadBytes: deps.maxUploadBytes } : {}),
  });
  registerAudioRoutes(app, {
    storage,
    registry,
    queue,
    objectStore,
    transcriber: deps.transcriber ?? new MockTranscriber(),
  });

  void app.register(cors, {
    // Üretimde WEB_ORIGIN env ile tek origin'e daraltılır; verilmezse (test/dev) serbesttir.
    origin: deps.corsOrigin ?? true,
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
    // Fastify'nin kendi HTTP hataları (413 gövde sınırı, 415, 404...) 500'e düşürülmez.
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        code: (error as { code?: string }).code ?? "REQUEST_ERROR",
        userMessage:
          statusCode === 413
            ? "İstek gövdesi izin verilen boyutu aşıyor."
            : "İstek işlenemedi; girdilerinizi kontrol edin.",
        developerMessage: error instanceof Error ? error.message : String(error),
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

  /** Manifest önbelleğini boşaltıp taze manifestleri döner ("Modelleri Yenile"). */
  app.post("/providers/refresh", async () => {
    registry.invalidateManifests();
    const manifests = await registry.allManifests();
    return { providers: manifests, refreshedAt: new Date().toISOString() };
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
      ...(input.budgetUsd !== undefined ? { budgetUsd: input.budgetUsd } : {}),
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

    // Bütçe kapısı: gerçekleşen harcama + aktif işlerin tahmini + bu isteğin
    // tahmini proje bütçesini aşarsa iş HİÇ kuyruğa alınmaz (402).
    if (project.budgetUsd !== undefined) {
      const jobs = await storage.listGenerationJobs(input.projectId);
      const committedUsd = jobs.reduce((sum, j) => {
        if (j.actualCostUsd !== undefined) return sum + j.actualCostUsd;
        if (j.status === "queued" || j.status === "running")
          return sum + (j.costEstimate?.amount ?? 0);
        return sum;
      }, 0);
      if (committedUsd + costEstimate.amount > project.budgetUsd) {
        return reply.status(402).send({
          code: "BUDGET_EXCEEDED",
          userMessage: `Proje bütçesi aşılıyor: bütçe $${project.budgetUsd.toFixed(2)}, taahhüt $${committedUsd.toFixed(4)}, bu istek ~$${costEstimate.amount.toFixed(4)}. Bütçeyi artırın veya bekleyen işleri iptal edin.`,
          retryable: false,
          correlationId: request.id,
        });
      }
    }

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

  /**
   * Model bazlı analiz: sayı, başarı oranı, ortalama süre ve toplam maliyet.
   * Süre yalnızca startedAt+finishedAt olan işlerden; maliyet yalnızca
   * gerçekleşen (actualCostUsd) tutarlardan hesaplanır — tahmin karıştırılmaz.
   */
  app.get("/projects/:id/analytics", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const jobs = await storage.listGenerationJobs(id);

    const byModel = new Map<string, GenerationJob[]>();
    for (const job of jobs) {
      const key = `${job.request.providerId}::${job.request.modelId}`;
      const bucket = byModel.get(key) ?? [];
      bucket.push(job);
      byModel.set(key, bucket);
    }

    const models = [...byModel.entries()].map(([key, group]) => {
      const [providerId, modelId] = key.split("::") as [string, string];
      const succeeded = group.filter((j) => j.status === "succeeded").length;
      const failed = group.filter((j) => j.status === "failed").length;
      const finished = succeeded + failed;
      const durations = group
        .filter((j) => j.startedAt && j.finishedAt)
        .map((j) => (Date.parse(j.finishedAt as string) - Date.parse(j.startedAt as string)) / 1000)
        .filter((sec) => sec >= 0);
      const avgDurationSec =
        durations.length > 0
          ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 100) / 100
          : null;
      const totalCostUsd =
        Math.round(group.reduce((sum, j) => sum + (j.actualCostUsd ?? 0), 0) * 10000) / 10000;
      return {
        providerId,
        modelId,
        total: group.length,
        succeeded,
        failed,
        successRate: finished > 0 ? Math.round((succeeded / finished) * 1000) / 1000 : null,
        avgDurationSec,
        totalCostUsd,
      };
    });
    models.sort((a, b) => b.total - a.total || a.modelId.localeCompare(b.modelId));

    return { projectId: id, totalJobs: jobs.length, models };
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
