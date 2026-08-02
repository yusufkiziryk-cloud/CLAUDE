import type { Sequence, TimelineClip } from "@studio/domain";
import { sequenceDurationSec } from "@studio/timeline-engine";

/**
 * Doğrulanmış render planı → FFmpeg ARGÜMAN DİZİSİ üretimi.
 * GÜVENLİK: asla shell string birleştirilmez; çıktı doğrudan spawn(cmd, args)
 * ile çalıştırılır. Metin klipleri drawtext için filtre-kaçışından geçirilir.
 */

export class RenderGraphError extends Error {}

export interface RenderAssetFile {
  /** Diskteki mutlak dosya yolu (API, data URI'leri geçici dosyaya açar). */
  path: string;
  mimeType: string;
}

export interface RenderGraphOptions {
  width: number;
  height: number;
  fps: number;
  outputPath: string;
}

export interface RenderGraph {
  args: string[];
  durationSec: number;
}

const SUPPORTED_IMAGE = ["image/png", "image/jpeg"];
const SUPPORTED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const SUPPORTED_AUDIO = ["audio/mpeg", "audio/wav", "audio/aac", "audio/mp4"];

/** drawtext filtre değeri kaçışı (tek tırnak, iki nokta, ters bölü, virgül). */
export function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\\\\\'")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/%/g, "\\%");
}

export function buildRenderGraph(
  sequence: Sequence,
  assetFiles: Map<string, RenderAssetFile>,
  options: RenderGraphOptions,
): RenderGraph {
  const durationSec = sequenceDurationSec(sequence);
  if (durationSec <= 0) {
    throw new RenderGraphError("Timeline boş: dışa aktarılacak klip yok.");
  }

  const videoTracks = sequence.tracks.filter((t) => t.kind === "video" && t.clips.length > 0);
  if (videoTracks.length > 1) {
    throw new RenderGraphError(
      "Faz 4 MVP tek video track destekler; ek video track'lerini boşaltın.",
    );
  }
  const videoClips = [...(videoTracks[0]?.clips ?? [])].sort((a, b) => a.startSec - b.startSec);
  const audioClips = sequence.tracks
    .filter((t) => t.kind === "audio")
    .flatMap((t) => t.clips)
    .sort((a, b) => a.startSec - b.startSec);
  const textClips = sequence.tracks.filter((t) => t.kind === "text").flatMap((t) => t.clips);

  const { width, height, fps } = options;
  const inputs: string[] = [];
  const filters: string[] = [];
  let inputIndex = 0;

  // Zemin: siyah tuval
  filters.push(
    `color=black:size=${width}x${height}:rate=${fps}:duration=${durationSec.toFixed(3)}[base]`,
  );

  // Video/görsel klipleri: ölçekle, zamana yerleştir, overlay zinciri
  let lastVideoLabel = "base";
  for (const [i, clip] of videoClips.entries()) {
    const file = requireAsset(assetFiles, clip, "video");
    const isImage = SUPPORTED_IMAGE.includes(file.mimeType);
    if (!isImage && !SUPPORTED_VIDEO.includes(file.mimeType)) {
      throw new RenderGraphError(
        `Desteklenmeyen video/görsel türü: ${file.mimeType} (klip ${clip.id}).`,
      );
    }
    if (isImage) {
      inputs.push("-loop", "1", "-t", clip.durationSec.toFixed(3), "-i", file.path);
    } else {
      inputs.push("-ss", clip.inSec.toFixed(3), "-t", clip.durationSec.toFixed(3), "-i", file.path);
    }
    const label = `v${i}`;
    filters.push(
      `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},` +
        `setpts=PTS-STARTPTS+${clip.startSec.toFixed(3)}/TB[${label}]`,
    );
    const outLabel = `ov${i}`;
    filters.push(
      `[${lastVideoLabel}][${label}]overlay=eof_action=pass:enable='between(t,${clip.startSec.toFixed(3)},${(clip.startSec + clip.durationSec).toFixed(3)})'[${outLabel}]`,
    );
    lastVideoLabel = outLabel;
    inputIndex += 1;
  }

  // Metin klipleri: drawtext zinciri
  let textFilterChain = "";
  for (const clip of textClips) {
    const text = escapeDrawText(clip.text ?? "");
    textFilterChain +=
      `,drawtext=text='${text}':fontcolor=white:fontsize=${Math.round(height / 12)}:` +
      `x=(w-text_w)/2:y=h-text_h-${Math.round(height / 18)}:box=1:boxcolor=black@0.5:boxborderw=8:` +
      `enable='between(t,${clip.startSec.toFixed(3)},${(clip.startSec + clip.durationSec).toFixed(3)})'`;
  }
  filters.push(`[${lastVideoLabel}]format=yuv420p${textFilterChain}[vout]`);

  // Ses: klipler adelay+volume ile karıştırılır; hiç yoksa sessizlik üretilir
  if (audioClips.length > 0) {
    const audioLabels: string[] = [];
    for (const [i, clip] of audioClips.entries()) {
      const file = requireAsset(assetFiles, clip, "ses");
      if (!SUPPORTED_AUDIO.includes(file.mimeType)) {
        throw new RenderGraphError(`Desteklenmeyen ses türü: ${file.mimeType} (klip ${clip.id}).`);
      }
      inputs.push("-ss", clip.inSec.toFixed(3), "-t", clip.durationSec.toFixed(3), "-i", file.path);
      const delayMs = Math.round(clip.startSec * 1000);
      const label = `a${i}`;
      filters.push(
        `[${inputIndex}:a]volume=${clip.volume.toFixed(2)},adelay=${delayMs}|${delayMs}[${label}]`,
      );
      audioLabels.push(`[${label}]`);
      inputIndex += 1;
    }
    filters.push(
      `${audioLabels.join("")}amix=inputs=${audioLabels.length}:normalize=0,apad=whole_dur=${durationSec.toFixed(3)}[aout]`,
    );
  } else {
    filters.push(
      `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${durationSec.toFixed(3)}[aout]`,
    );
  }

  const args = [
    "-y",
    "-hide_banner",
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-t",
    durationSec.toFixed(3),
    "-movflags",
    "+faststart",
    options.outputPath,
  ];

  return { args, durationSec };
}

function requireAsset(
  assetFiles: Map<string, RenderAssetFile>,
  clip: TimelineClip,
  kindLabel: string,
): RenderAssetFile {
  if (!clip.assetId) {
    throw new RenderGraphError(`${kindLabel} klibinin varlık bağlantısı yok (klip ${clip.id}).`);
  }
  const file = assetFiles.get(clip.assetId);
  if (!file) {
    throw new RenderGraphError(
      `Klibin varlığı bulunamadı: ${clip.assetId}. Kayıp medyayı yeniden bağlayın.`,
    );
  }
  return file;
}

/** Ön kontrol: render başlamadan kullanıcıya gösterilecek sorunlar. */
export function validateSequenceForRender(
  sequence: Sequence,
  assetFiles: Map<string, RenderAssetFile>,
): string[] {
  const problems: string[] = [];
  if (sequenceDurationSec(sequence) <= 0) problems.push("Timeline boş.");
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      if (track.kind !== "text" && clip.assetId && !assetFiles.has(clip.assetId)) {
        problems.push(`"${track.name}" track'inde kayıp medya: ${clip.assetId}`);
      }
      if (track.kind === "text" && !clip.text?.trim()) {
        problems.push(`"${track.name}" track'inde boş metin klibi var.`);
      }
    }
  }
  return problems;
}
