import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { newId, type Asset } from "@studio/domain";
import { extFromMime, type ObjectStore, type StorageDriver } from "@studio/shared";

export interface FileRouteDeps {
  storage: StorageDriver;
  objectStore: ObjectStore;
  /** Tek dosya üst sınırı (bayt). */
  maxUploadBytes?: number;
}

const UPLOADABLE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
]);

export function registerFileRoutes(app: FastifyInstance, deps: FileRouteDeps): void {
  const { storage, objectStore } = deps;
  const maxUploadBytes = deps.maxUploadBytes ?? 200 * 1024 * 1024;

  void app.register(multipart, { limits: { fileSize: maxUploadBytes, files: 1 } });

  // Nesne deposundan dosya servisi (varlık URI'lerinin hedefi)
  app.get("/files/*", async (request, reply) => {
    const key = (request.params as { "*": string })["*"];
    let object: Awaited<ReturnType<ObjectStore["get"]>>;
    try {
      object = await objectStore.get(key);
    } catch {
      object = null; // geçersiz anahtar → 404
    }
    if (!object) {
      return reply.status(404).send({
        code: "NOT_FOUND",
        userMessage: "Dosya bulunamadı.",
        retryable: false,
      });
    }
    reply.header("content-type", object.contentType);
    reply.header("cache-control", "private, max-age=3600");
    return reply.send(object.data);
  });

  // Medya yükleme (MVP: tek istekte; parçalı/devam ettirilebilir yükleme yol haritasında)
  app.post("/projects/:id/assets", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) {
      return reply
        .status(404)
        .send({ code: "NOT_FOUND", userMessage: "Proje bulunamadı.", retryable: false });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({
        code: "NO_FILE",
        userMessage: "Yüklenecek dosya bulunamadı (multipart 'file' alanı bekleniyor).",
        retryable: false,
      });
    }
    // MIME doğrulama: uzantıya güvenilmez, bildirilen içerik türü allowlist'te olmalı.
    if (!UPLOADABLE_MIMES.has(file.mimetype)) {
      return reply.status(415).send({
        code: "UNSUPPORTED_MEDIA_TYPE",
        userMessage: `Desteklenmeyen dosya türü: ${file.mimetype}. Desteklenen: PNG, JPEG, MP4, WebM, MP3, WAV.`,
        retryable: false,
      });
    }

    const data = await file.toBuffer();
    const assetId = newId("ast");
    const key = `uploads/${id}/${assetId}.${extFromMime(file.mimetype) ?? "bin"}`;
    await objectStore.put(key, data, file.mimetype);

    const kind = file.mimetype.startsWith("image/")
      ? ("image" as const)
      : file.mimetype.startsWith("video/")
        ? ("video" as const)
        : ("audio" as const);
    const asset: Asset = {
      id: assetId,
      projectId: id,
      kind,
      name: file.filename || `Yükleme ${assetId.slice(-6)}`,
      uri: objectStore.publicPath(key),
      mimeType: file.mimetype,
      sizeBytes: data.length,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    await storage.createAsset(asset);
    return reply.status(201).send(asset);
  });
}
