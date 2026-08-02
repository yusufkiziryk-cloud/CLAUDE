import {
  SequenceSchema,
  newId,
  type Sequence,
  type TimelineClip,
  type TimelineTrack,
  type TrackKind,
} from "@studio/domain";

/**
 * Saf komut fonksiyonları: her komut yeni bir Sequence döndürür (girdi değişmez).
 * Geçersiz işlem (çakışma, bulunamayan klip...) anlaşılır Türkçe hata fırlatır.
 * Undo/redo bu saflık sayesinde snapshot ile çalışır (bkz. history.ts).
 */

export class TimelineError extends Error {}

function clone(sequence: Sequence): Sequence {
  return structuredClone(sequence);
}

function touch(sequence: Sequence): Sequence {
  sequence.updatedAt = new Date().toISOString();
  return SequenceSchema.parse(sequence);
}

function findTrack(sequence: Sequence, trackId: string): TimelineTrack {
  const track = sequence.tracks.find((t) => t.id === trackId);
  if (!track) throw new TimelineError(`Track bulunamadı: ${trackId}`);
  return track;
}

function findClip(track: TimelineTrack, clipId: string): TimelineClip {
  const clip = track.clips.find((c) => c.id === clipId);
  if (!clip) throw new TimelineError(`Klip bulunamadı: ${clipId}`);
  return clip;
}

/** Aynı track'te klipler üst üste binemez. */
function assertNoOverlap(track: TimelineTrack, candidate: TimelineClip, ignoreId?: string): void {
  const start = candidate.startSec;
  const end = start + candidate.durationSec;
  for (const other of track.clips) {
    if (other.id === ignoreId || other.id === candidate.id) continue;
    const otherEnd = other.startSec + other.durationSec;
    if (start < otherEnd - 1e-9 && other.startSec < end - 1e-9) {
      throw new TimelineError(
        `Klipler çakışıyor: ${candidate.startSec}-${end.toFixed(2)} sn aralığı "${track.name}" track'inde dolu.`,
      );
    }
  }
}

function sortClips(track: TimelineTrack): void {
  track.clips.sort((a, b) => a.startSec - b.startSec);
}

export function addTrack(sequence: Sequence, kind: TrackKind, name: string): Sequence {
  const next = clone(sequence);
  next.tracks.push({ id: newId("trk"), kind, name, order: next.tracks.length, clips: [] });
  return touch(next);
}

export function removeTrack(sequence: Sequence, trackId: string): Sequence {
  const next = clone(sequence);
  findTrack(next, trackId);
  next.tracks = next.tracks.filter((t) => t.id !== trackId).map((t, i) => ({ ...t, order: i }));
  return touch(next);
}

export interface AddClipInput {
  trackId: string;
  startSec: number;
  durationSec: number;
  assetId?: string;
  inSec?: number;
  text?: string;
  volume?: number;
}

export function addClip(sequence: Sequence, input: AddClipInput): Sequence {
  const next = clone(sequence);
  const track = findTrack(next, input.trackId);
  if (track.kind === "text" && !input.text) {
    throw new TimelineError("Metin track'ine eklenen klip için 'text' zorunludur.");
  }
  if (track.kind !== "text" && !input.assetId) {
    throw new TimelineError("Video/ses track'ine eklenen klip için 'assetId' zorunludur.");
  }
  const clip: TimelineClip = {
    id: newId("clp"),
    startSec: input.startSec,
    durationSec: input.durationSec,
    inSec: input.inSec ?? 0,
    volume: input.volume ?? 1,
    ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
    ...(input.text !== undefined ? { text: input.text } : {}),
  };
  assertNoOverlap(track, clip);
  track.clips.push(clip);
  sortClips(track);
  return touch(next);
}

export function removeClip(sequence: Sequence, trackId: string, clipId: string): Sequence {
  const next = clone(sequence);
  const track = findTrack(next, trackId);
  findClip(track, clipId);
  track.clips = track.clips.filter((c) => c.id !== clipId);
  return touch(next);
}

export function moveClip(
  sequence: Sequence,
  trackId: string,
  clipId: string,
  newStartSec: number,
): Sequence {
  if (newStartSec < 0) throw new TimelineError("Klip 0'dan önceye taşınamaz.");
  const next = clone(sequence);
  const track = findTrack(next, trackId);
  const clip = findClip(track, clipId);
  const moved = { ...clip, startSec: newStartSec };
  assertNoOverlap(track, moved, clipId);
  clip.startSec = newStartSec;
  sortClips(track);
  return touch(next);
}

/** Trim: klibin timeline süresini ve kaynak giriş noktasını günceller. */
export function trimClip(
  sequence: Sequence,
  trackId: string,
  clipId: string,
  patch: { durationSec?: number; inSec?: number },
): Sequence {
  const next = clone(sequence);
  const track = findTrack(next, trackId);
  const clip = findClip(track, clipId);
  const updated = {
    ...clip,
    ...(patch.durationSec !== undefined ? { durationSec: patch.durationSec } : {}),
    ...(patch.inSec !== undefined ? { inSec: patch.inSec } : {}),
  };
  if (updated.durationSec <= 0) throw new TimelineError("Klip süresi pozitif olmalı.");
  if (updated.inSec < 0) throw new TimelineError("Kaynak giriş noktası negatif olamaz.");
  assertNoOverlap(track, updated, clipId);
  Object.assign(clip, updated);
  return touch(next);
}

/** Split: klibi verilen timeline anında ikiye böler. */
export function splitClip(
  sequence: Sequence,
  trackId: string,
  clipId: string,
  atSec: number,
): Sequence {
  const next = clone(sequence);
  const track = findTrack(next, trackId);
  const clip = findClip(track, clipId);
  const offset = atSec - clip.startSec;
  if (offset <= 1e-9 || offset >= clip.durationSec - 1e-9) {
    throw new TimelineError("Bölme noktası klibin içinde olmalı.");
  }
  const second: TimelineClip = {
    ...clip,
    id: newId("clp"),
    startSec: atSec,
    durationSec: clip.durationSec - offset,
    inSec: clip.inSec + offset,
  };
  clip.durationSec = offset;
  track.clips.push(second);
  sortClips(track);
  return touch(next);
}

export function updateClip(
  sequence: Sequence,
  trackId: string,
  clipId: string,
  patch: { text?: string; volume?: number },
): Sequence {
  const next = clone(sequence);
  const track = findTrack(next, trackId);
  const clip = findClip(track, clipId);
  if (patch.text !== undefined) clip.text = patch.text;
  if (patch.volume !== undefined) {
    if (patch.volume < 0 || patch.volume > 2)
      throw new TimelineError("Ses seviyesi 0-2 aralığında olmalı.");
    clip.volume = patch.volume;
  }
  return touch(next);
}

/** Sequence'in toplam süresi = en geç biten klibin bitişi. */
export function sequenceDurationSec(sequence: Sequence): number {
  let max = 0;
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, clip.startSec + clip.durationSec);
    }
  }
  return max;
}

/** Boş bir varsayılan sequence üretir (video + ses + metin track'leri). */
export function createDefaultSequence(projectId: string, name = "Ana Kurgu"): Sequence {
  const now = new Date().toISOString();
  return SequenceSchema.parse({
    id: newId("seq"),
    projectId,
    name,
    tracks: [
      { id: newId("trk"), kind: "video", name: "Video 1", order: 0, clips: [] },
      { id: newId("trk"), kind: "audio", name: "Ses 1", order: 1, clips: [] },
      { id: newId("trk"), kind: "text", name: "Metin 1", order: 2, clips: [] },
    ],
    createdAt: now,
    updatedAt: now,
  });
}
