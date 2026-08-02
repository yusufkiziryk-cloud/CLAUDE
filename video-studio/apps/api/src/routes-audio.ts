import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SequenceSchema, newId, type GenerationJob, type Sequence } from "@studio/domain";
import type { ProviderRegistry } from "@studio/provider-sdk";
import type { ObjectStore, StorageDriver, Transcriber } from "@studio/shared";
import type { GenerationQueue } from "./queue.js";

export interface AudioRouteDeps {
  storage: StorageDriver;
  registry: ProviderRegistry;
  queue: GenerationQueue;
  objectStore: ObjectStore;
  transcriber: Transcriber;
}

const notFound = (
  reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  message: string,
) => reply.status(404).send({ code: "NOT_FOUND", userMessage: message, retryable: false });

export function registerAudioRoutes(app: FastifyInstance, deps: AudioRouteDeps): void {
  const { storage, registry, queue, objectStore, transcriber } = deps;

  // ---- Sahne seslendirme (TTS) ----
  app.post("/scenes/:id/narration", async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await storage.getScene(id);
    if (!scene) return notFound(reply, "Sahne bulunamadı.");
    if (scene.narration.trim() === "") {
      return reply.status(422).send({
        code: "NARRATION_REQUIRED",
        userMessage: "Bu sahnenin anlatıcı metni boş; önce sahneye anlatım yazın.",
        retryable: false,
      });
    }
    const { providerId, modelId, params } = z
      .object({
        providerId: z.string().min(1),
        modelId: z.string().min(1),
        params: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
      })
      .parse(request.body);

    const generationRequest = {
      capability: "textToSpeech" as const,
      providerId,
      modelId,
      params,
      prompt: { ...scene.prompt, audio: { ...scene.prompt.audio, narration: scene.narration } },
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
        userMessage: "Seçilen model bu seslendirme isteğini desteklemiyor.",
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
    await storage.updateScene(id, { narrationJobId: job.id });
    await queue.enqueue(job.id);
    return reply.status(202).send(job);
  });

  // ---- Animatic: sahnelerden timeline kurgusu ----
  app.post("/projects/:id/sequence/from-scenes", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const scenes = await storage.listScenes(id);
    if (scenes.length === 0) {
      return reply.status(422).send({
        code: "NO_SCENES",
        userMessage: "Animatic için önce sahne planı oluşturun (Senaryo & Storyboard sayfası).",
        retryable: false,
      });
    }

    const existing = await storage.getSequenceByProject(id);
    const now = new Date().toISOString();
    const warnings: string[] = [];
    const videoClips = [];
    const audioClips = [];
    const textClips = [];

    let cursor = 0;
    for (const scene of [...scenes].sort((a, b) => a.order - b.order)) {
      if (scene.storyboardAssetId) {
        videoClips.push({
          id: newId("clp"),
          assetId: scene.storyboardAssetId,
          startSec: cursor,
          durationSec: scene.durationSec,
          inSec: 0,
          volume: 1,
        });
      } else {
        warnings.push(`"${scene.title}" sahnesinin storyboard'u yok; video boş kalacak.`);
      }
      if (scene.narrationAssetId) {
        const narrationAsset = await storage.getAsset(scene.narrationAssetId);
        const duration = Math.min(
          narrationAsset?.durationSec ?? scene.durationSec,
          scene.durationSec,
        );
        audioClips.push({
          id: newId("clp"),
          assetId: scene.narrationAssetId,
          startSec: cursor,
          durationSec: duration,
          inSec: 0,
          volume: 1,
        });
      } else {
        warnings.push(`"${scene.title}" sahnesinin seslendirmesi yok; ses boş kalacak.`);
      }
      textClips.push({
        id: newId("clp"),
        startSec: cursor,
        durationSec: Math.min(3, scene.durationSec),
        inSec: 0,
        volume: 1,
        text: scene.title,
      });
      cursor += scene.durationSec;
    }

    const sequence: Sequence = SequenceSchema.parse({
      id: existing?.id ?? newId("seq"),
      projectId: id,
      name: "Animatic (sahnelerden)",
      fps: existing?.fps ?? 24,
      width: existing?.width ?? 1280,
      height: existing?.height ?? 720,
      tracks: [
        { id: newId("trk"), kind: "video", name: "Video 1", order: 0, clips: videoClips },
        { id: newId("trk"), kind: "audio", name: "Anlatıcı", order: 1, clips: audioClips },
        { id: newId("trk"), kind: "text", name: "Başlıklar", order: 2, clips: textClips },
      ],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    await storage.saveSequence(sequence);
    return { sequence, warnings };
  });

  // ---- Transkripsiyon (STT) ----
  app.post("/assets/:id/transcribe", async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await storage.getAsset(id);
    if (!asset) return notFound(reply, "Varlık bulunamadı.");
    if (!asset.mimeType.startsWith("audio/") && !asset.mimeType.startsWith("video/")) {
      return reply.status(422).send({
        code: "NOT_TRANSCRIBABLE",
        userMessage: "Yalnızca ses veya video varlıkları transkript edilebilir.",
        retryable: false,
      });
    }
    const { language } = z
      .object({ language: z.string().length(2).optional() })
      .parse(request.body ?? {});

    let data: Buffer;
    if (asset.uri.startsWith("data:")) {
      data = Buffer.from(asset.uri.split(",")[1] ?? "", "base64");
    } else if (asset.uri.startsWith("/files/")) {
      const object = await objectStore.get(asset.uri.replace("/files/", ""));
      if (!object) return notFound(reply, "Varlık dosyası nesne deposunda bulunamadı.");
      data = object.data;
    } else {
      return reply.status(422).send({
        code: "UNSUPPORTED_URI",
        userMessage: "Bu varlık konumu transkripsiyon için desteklenmiyor.",
        retryable: false,
      });
    }

    const result = await transcriber.transcribe({
      data,
      mimeType: asset.mimeType,
      fileName: asset.name,
      ...(language ? { language } : {}),
    });
    return result;
  });
}
