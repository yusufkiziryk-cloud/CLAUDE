import { CaptionCueSchema, type CaptionCue } from "./cue.js";

/** SRT ve WebVTT serileştirme/ayrıştırma. Round-trip kayıpsızdır (10 ms hassasiyet). */

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function formatTime(sec: number, msSeparator: string): string {
  const totalMs = Math.round(sec * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${msSeparator}${pad(ms, 3)}`;
}

function parseTime(raw: string): number {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(raw.trim());
  if (!match) throw new Error(`Geçersiz zaman damgası: "${raw}"`);
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number((match[4] as string).padEnd(3, "0")) / 1000
  );
}

export function toSrt(cues: CaptionCue[]): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatTime(cue.startSec, ",")} --> ${formatTime(cue.endSec, ",")}\n${cue.text}`,
    )
    .join("\n\n");
}

export function toVtt(cues: CaptionCue[]): string {
  const body = cues
    .map(
      (cue) => `${formatTime(cue.startSec, ".")} --> ${formatTime(cue.endSec, ".")}\n${cue.text}`,
    )
    .join("\n\n");
  return `WEBVTT\n\n${body}`;
}

export interface ParsedCaptions {
  cues: CaptionCue[];
  warnings: string[];
}

/** SRT veya VTT içeriğini ayrıştırır; bozuk bloklar sessizce yutulmaz, uyarı olur. */
export function parseCaptions(content: string): ParsedCaptions {
  const cues: CaptionCue[] = [];
  const warnings: string[] = [];
  const normalized = content.replace(/\r\n/g, "\n").replace(/^WEBVTT.*\n?/i, "");
  const blocks = normalized.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const timeLineIndex = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIndex === -1) {
      // yalnız sıra numarası veya başlık bloğu olabilir; metin varsa uyar
      if (lines.length > 1 || !/^\d+$/.test(lines[0] ?? "")) {
        warnings.push(`Zaman damgasız blok atlandı: "${lines[0]?.slice(0, 40)}"`);
      }
      continue;
    }
    const [startRaw, endRaw] = (lines[timeLineIndex] as string).split("-->");
    const text = lines.slice(timeLineIndex + 1).join(" ");
    if (!text) {
      warnings.push(`Metinsiz altyazı bloğu atlandı (${startRaw?.trim()}).`);
      continue;
    }
    try {
      const cue = CaptionCueSchema.parse({
        startSec: parseTime(startRaw ?? ""),
        // VTT satır sonunda hizalama ayarları olabilir: yalnızca ilk belirteç zamandır.
        endSec: parseTime((endRaw ?? "").trim().split(/\s+/)[0] ?? ""),
        text,
      });
      cues.push(cue);
    } catch (error) {
      warnings.push(
        `Blok ayrıştırılamadı: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return { cues, warnings };
}
