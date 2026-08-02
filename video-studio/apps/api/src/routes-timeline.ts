import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SequenceSchema, newId, type RenderJob } from "@studio/domain";
import { createDefaultSequence } from "@studio/timeline-engine";
import type { StorageDriver } from "@studio/shared";
import { executeRenderJob, ffmpegAvailable } from "./render.js";

export interface TimelineRouteDeps {
  storage: StorageDriver;
  rendersDir: string;
}

const notFound = (
  reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  message: string,
) => reply.status(404).send({ code: "NOT_FOUND", userMessage: message, retryable: false });

export function registerTimelineRoutes(app: FastifyInstance, deps: TimelineRouteDeps): void {
  const { storage, rendersDir } = deps;

  // ---- Sequence (proje başına tek ana kurgu) ----
  app.get("/projects/:id/sequence", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const existing = await storage.getSequenceByProject(id);
    if (existing) return existing;
    const created = await storage.saveSequence(createDefaultSequence(id));
    return created;
  });

  app.put("/projects/:id/sequence", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const sequence = SequenceSchema.parse((request.body as { sequence: unknown }).sequence);
    if (sequence.projectId !== id) {
      return reply.status(400).send({
        code: "PROJECT_MISMATCH",
        userMessage: "Sequence başka bir projeye ait.",
        retryable: false,
      });
    }
    return storage.saveSequence(sequence);
  });

  // ---- Render ----
  app.post("/projects/:id/render", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await storage.getProject(id);
    if (!project) return notFound(reply, "Proje bulunamadı.");
    const { preset } = z
      .object({ preset: z.enum(["480p", "720p", "1080p"]).default("480p") })
      .parse(request.body ?? {});

    if (!(await ffmpegAvailable())) {
      return reply.status(501).send({
        code: "FFMPEG_NOT_FOUND",
        userMessage:
          "FFmpeg bulunamadı. Dışa aktarma için FFmpeg kurulmalı (https://ffmpeg.org). " +
          "Windows masaüstü sürümünde FFmpeg uygulamayla birlikte gelecek.",
        retryable: false,
      });
    }

    const sequence = await storage.getSequenceByProject(id);
    if (!sequence) return notFound(reply, "Bu projede kurgu (sequence) yok.");

    const now = new Date().toISOString();
    const job: RenderJob = {
      id: newId("rnd"),
      projectId: id,
      sequenceId: sequence.id,
      preset,
      status: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    await storage.createRenderJob(job);
    // Faz 4: API süreci içinde asenkron çalışır; ayrı render worker Faz 5'te.
    void executeRenderJob(job, sequence, { storage, rendersDir }).catch(() => {});
    return reply.status(202).send(job);
  });

  app.get("/render-jobs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await storage.getRenderJob(id);
    if (!job) return notFound(reply, "Render işi bulunamadı.");
    return job;
  });

  app.get("/projects/:id/renders", async (request) => {
    const { id } = request.params as { id: string };
    return { jobs: await storage.listRenderJobs(id) };
  });

  // ---- Çıktı dosya servisi (path traversal korumalı) ----
  app.get("/renders/:file", async (request, reply) => {
    const { file } = request.params as { file: string };
    if (!/^[\w.-]+\.mp4$/.test(file)) {
      return reply.status(400).send({
        code: "INVALID_FILE",
        userMessage: "Geçersiz dosya adı.",
        retryable: false,
      });
    }
    const path = normalize(join(rendersDir, file));
    if (!path.startsWith(normalize(rendersDir)) || !existsSync(path)) {
      return notFound(reply, "Çıktı dosyası bulunamadı.");
    }
    const info = await stat(path);
    reply.header("content-type", "video/mp4");
    reply.header("content-length", info.size);
    return reply.send(createReadStream(path));
  });
}
