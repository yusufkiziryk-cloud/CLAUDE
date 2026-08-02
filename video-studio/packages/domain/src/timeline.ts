import { z } from "zod";
import { ProjectId } from "./ids.js";

/**
 * Timeline veri modeli. UI bileşenlerinden tamamen bağımsızdır;
 * komut mantığı @studio/timeline-engine paketindedir.
 */

export const TrackKind = z.enum(["video", "audio", "text"]);
export type TrackKind = z.infer<typeof TrackKind>;

export const TimelineClipSchema = z.object({
  id: z.string().min(1),
  /** video/görsel/ses klipleri bir varlığa bağlanır; metin klipleri bağlanmaz. */
  assetId: z.string().optional(),
  /** Timeline üzerindeki başlangıç anı (sn). */
  startSec: z.number().min(0),
  /** Klibin timeline'daki uzunluğu (sn). */
  durationSec: z.number().positive(),
  /** Kaynak medyada başlama noktası (trim in, sn). Görsel/metin için 0. */
  inSec: z.number().min(0).default(0),
  /** Metin klipleri için içerik. */
  text: z.string().max(500).optional(),
  /** Ses seviyesi (0-2, 1 = orijinal). Ses klipleri ve video sesi için. */
  volume: z.number().min(0).max(2).default(1),
});
export type TimelineClip = z.infer<typeof TimelineClipSchema>;

export const TimelineTrackSchema = z.object({
  id: z.string().min(1),
  kind: TrackKind,
  name: z.string().min(1).max(100),
  order: z.number().int().nonnegative(),
  /** true ise (ör. müzik) diğer ses track'lerinde konuşma çalarken bu track kısılır. */
  duck: z.boolean().default(false),
  clips: z.array(TimelineClipSchema).default([]),
});
export type TimelineTrack = z.infer<typeof TimelineTrackSchema>;

export const SequenceSchema = z.object({
  id: z.string().min(1),
  projectId: ProjectId,
  name: z.string().min(1).max(200),
  fps: z.number().int().positive().max(60).default(24),
  width: z.number().int().positive().default(1280),
  height: z.number().int().positive().default(720),
  tracks: z.array(TimelineTrackSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Sequence = z.infer<typeof SequenceSchema>;

export const RenderJobStatus = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);
export type RenderJobStatus = z.infer<typeof RenderJobStatus>;

export const RenderJobSchema = z.object({
  id: z.string().min(1),
  projectId: ProjectId,
  sequenceId: z.string().min(1),
  preset: z.enum(["480p", "720p", "1080p"]),
  status: RenderJobStatus,
  progress: z.number().min(0).max(100).default(0),
  error: z
    .object({
      code: z.string(),
      userMessage: z.string(),
      developerMessage: z.string().optional(),
    })
    .optional(),
  /** Çıktı dosyasının API'den servis edilen göreli yolu. */
  outputPath: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
});
export type RenderJob = z.infer<typeof RenderJobSchema>;
