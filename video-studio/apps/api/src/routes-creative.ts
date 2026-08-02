import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CreateBibleCardInput,
  ScriptFormat,
  UpdateSceneInput,
  UpsertBriefInput,
  newId,
  type BibleCard,
  type CreativeBrief,
  type GenerationJob,
  type Script,
} from "@studio/domain";
import { checkContinuity, planScenes, type ScriptGenerator } from "@studio/creative-engine";
import type { ProviderRegistry } from "@studio/provider-sdk";
import type { StorageDriver } from "@studio/shared";
import type { GenerationQueue } from "./queue.js";

export interface CreativeRouteDeps {
  storage: StorageDriver;
  registry: ProviderRegistry;
  queue: GenerationQueue;
  scriptGenerator: ScriptGenerator;
}

const notFound = (
  reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  message: string,
) => reply.status(404).send({ code: "NOT_FOUND", userMessage: message, retryable: false });

/** exactOptionalPropertyTypes uyumu: undefined değerli anahtarlar yamadan çıkarılır. */
function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]?: NonNullable<T[K]> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: NonNullable<T[K]>;
  };
}

export function registerCreativeRoutes(app: FastifyInstance, deps: CreativeRouteDeps): void {
  const { storage, registry, queue, scriptGenerator } = deps;

  // ---- Brief ----
  app.put("/projects/:id/brief", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const input = UpsertBriefInput.parse(request.body);
    const existing = await storage.getBrief(id);
    const now = new Date().toISOString();
    const brief: CreativeBrief = {
      id: existing?.id ?? newId("brf"),
      projectId: id,
      audience: input.audience,
      goal: input.goal,
      tone: input.tone,
      platform: input.platform,
      ...(input.cta !== undefined ? { cta: input.cta } : {}),
      keyMessages: input.keyMessages ?? [],
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await storage.upsertBrief(brief);
    return reply.status(existing ? 200 : 201).send(brief);
  });

  app.get("/projects/:id/brief", async (request, reply) => {
    const { id } = request.params as { id: string };
    const brief = await storage.getBrief(id);
    if (!brief) return notFound(reply, "Bu proje için brief tanımlanmamış.");
    return brief;
  });

  // ---- Senaryo üretimi ----
  app.post("/projects/:id/script", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const brief = await storage.getBrief(id);
    if (!brief) {
      return reply.status(422).send({
        code: "BRIEF_REQUIRED",
        userMessage: "Senaryo üretmek için önce brief'i doldurun.",
        retryable: false,
      });
    }
    const { format } = z.object({ format: ScriptFormat }).parse(request.body);
    const generated = await scriptGenerator.generate({
      brief,
      format,
      targetDurationSec: project.targetDurationSec,
      language: project.language,
    });
    const script: Script = {
      id: newId("scr"),
      projectId: id,
      briefId: brief.id,
      format,
      generator: generated.generator,
      title: generated.title,
      sections: generated.sections,
      createdAt: new Date().toISOString(),
    };
    await storage.createScript(script);
    return reply.status(201).send(script);
  });

  app.get("/projects/:id/scripts", async (request) => {
    const { id } = request.params as { id: string };
    return { scripts: await storage.listScripts(id) };
  });

  // ---- Sahne planı ----
  app.post("/scripts/:id/scenes", async (request, reply) => {
    const { id } = request.params as { id: string };
    const script = await storage.getScript(id);
    if (!script) return notFound(reply, "Senaryo bulunamadı.");
    const project = await storage.getProject(script.projectId);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const scenes = planScenes(script, project.targetDurationSec);
    await storage.replaceScenes(id, scenes);
    return reply.status(201).send({ scenes });
  });

  app.get("/projects/:id/scenes", async (request) => {
    const { id } = request.params as { id: string };
    return { scenes: await storage.listScenes(id) };
  });

  app.patch("/scenes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await storage.getScene(id);
    if (!scene) return notFound(reply, "Sahne bulunamadı.");
    const patch = UpdateSceneInput.parse(request.body);
    const updated = await storage.updateScene(id, stripUndefined(patch));
    return updated;
  });

  // ---- Bible kartları ----
  app.post("/projects/:id/bible", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const input = CreateBibleCardInput.parse(request.body);
    const now = new Date().toISOString();
    const card: BibleCard = {
      id: newId("bib"),
      projectId: id,
      kind: input.kind,
      name: input.name,
      description: input.description,
      ...(input.promptFragment !== undefined ? { promptFragment: input.promptFragment } : {}),
      isRealPerson: input.isRealPerson ?? false,
      consentConfirmed: input.consentConfirmed ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await storage.createBibleCard(card);
    return reply.status(201).send(card);
  });

  app.get("/projects/:id/bible", async (request) => {
    const { id } = request.params as { id: string };
    return { cards: await storage.listBibleCards(id) };
  });

  app.patch("/bible/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const patch = CreateBibleCardInput.partial().parse(request.body);
    try {
      return await storage.updateBibleCard(id, stripUndefined(patch));
    } catch {
      return notFound(reply, "Kart bulunamadı.");
    }
  });

  app.delete("/bible/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await storage.deleteBibleCard(id);
    if (!deleted) return notFound(reply, "Kart bulunamadı.");
    return reply.status(204).send();
  });

  // ---- Tutarlılık denetimi ----
  app.get("/projects/:id/continuity", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const [scenes, cards] = await Promise.all([storage.listScenes(id), storage.listBibleCards(id)]);
    return {
      issues: checkContinuity({
        targetDurationSec: project.targetDurationSec,
        scenes,
        bibleCards: cards,
      }),
    };
  });

  // ---- Sahne storyboard üretimi ----
  app.post("/scenes/:id/storyboard", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await storage.getScene(id);
    if (!scene) return notFound(reply, "Sahne bulunamadı.");
    const project = await storage.getProject(scene.projectId);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const { providerId, modelId } = z
      .object({ providerId: z.string().min(1), modelId: z.string().min(1) })
      .parse(request.body);

    // Güvenlik: rızasız gerçek kişi kartı bu sahnede geçiyorsa üretim ENGELLENİR.
    const cards = await storage.listBibleCards(scene.projectId);
    const consentIssues = checkContinuity({
      targetDurationSec: project.targetDurationSec,
      scenes: [scene],
      bibleCards: cards,
    }).filter((i) => i.code === "CONSENT_REQUIRED");
    if (consentIssues.length > 0) {
      return reply.status(403).send({
        code: "CONSENT_REQUIRED",
        userMessage: consentIssues[0]?.message,
        retryable: false,
      });
    }

    // Kilitli prompt parçaları sahne promptuna eklenir (görsel tutarlılık).
    const referencedFragments = cards
      .filter(
        (c) =>
          c.kind === "character" &&
          c.promptFragment &&
          scene.characterNames.some(
            (n) => n.toLocaleLowerCase("tr") === c.name.toLocaleLowerCase("tr"),
          ),
      )
      .map((c) => c.promptFragment as string)
      .filter(
        (f) =>
          !scene.prompt.subject.description
            .toLocaleLowerCase("tr")
            .includes(f.toLocaleLowerCase("tr")),
      );

    const prompt = {
      ...scene.prompt,
      subject: {
        ...scene.prompt.subject,
        description: [scene.prompt.subject.description, ...referencedFragments].join(", "),
      },
      output: { ...scene.prompt.output, aspectRatio: project.aspectRatio },
    };

    const generationRequest = {
      capability: "textToImage" as const,
      providerId,
      modelId,
      params: {},
      prompt,
    };
    let adapter;
    try {
      adapter = registry.get(providerId);
    } catch {
      return reply.status(404).send({
        code: "PROVIDER_NOT_CONFIGURED",
        userMessage: `'${providerId}' sağlayıcısı yapılandırılmamış (API anahtarı eksik olabilir).`,
        retryable: false,
      });
    }
    const validation = adapter.validate(generationRequest);
    if (!validation.ok) {
      return reply.status(422).send({
        code: "UNSUPPORTED_REQUEST",
        userMessage: "Seçilen model bu storyboard isteğini desteklemiyor.",
        issues: validation.issues,
        retryable: false,
      });
    }
    const costEstimate = await adapter.estimate(generationRequest);
    const now = new Date().toISOString();
    const job: GenerationJob = {
      id: newId("gen"),
      projectId: scene.projectId,
      request: generationRequest,
      status: "queued",
      progress: 0,
      idempotencyKey: newId("idem"),
      costEstimate,
      resultAssetIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await storage.createGenerationJob(job);
    await storage.updateScene(id, { storyboardJobId: job.id });
    await queue.enqueue(job.id);
    return reply.status(202).send(job);
  });
}
