import { z } from "zod";

/** Tek altyazı satırı (cue). Süreler saniye cinsindendir. */
export const CaptionCueSchema = z
  .object({
    startSec: z.number().min(0),
    endSec: z.number().positive(),
    text: z.string().min(1).max(500),
  })
  .refine((cue) => cue.endSec > cue.startSec, {
    message: "Altyazı bitişi başlangıcından sonra olmalı.",
  });
export type CaptionCue = z.infer<typeof CaptionCueSchema>;

/** Cümle bölme: Türkçe noktalama işaretlerine göre. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface SceneForCaptions {
  narration: string;
  durationSec: number;
  /** Sahnenin timeline üzerindeki başlangıcı (sn). */
  startSec: number;
}

/**
 * Sahnelerden deterministik altyazı üretir: anlatım cümlelere bölünür, süre sahne
 * içinde kelime sayısıyla orantılı dağıtılır. Bu, sesin STT dökümü DEĞİL, senaryodan
 * türetilmiş altyazıdır (kaynak: senaryo metni).
 */
export function cuesFromScenes(scenes: SceneForCaptions[]): CaptionCue[] {
  const cues: CaptionCue[] = [];
  for (const scene of scenes) {
    const sentences = splitSentences(scene.narration);
    if (sentences.length === 0) continue;
    const wordCounts = sentences.map((s) => Math.max(1, s.split(/\s+/).length));
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let cursor = scene.startSec;
    for (const [index, sentence] of sentences.entries()) {
      const share = ((wordCounts[index] ?? 1) / totalWords) * scene.durationSec;
      const duration = Math.max(0.5, Math.round(share * 100) / 100);
      cues.push({
        startSec: Math.round(cursor * 100) / 100,
        endSec: Math.round((cursor + duration) * 100) / 100,
        text: sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence,
      });
      cursor += duration;
    }
  }
  return cues;
}
