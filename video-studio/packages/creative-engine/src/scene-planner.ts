import { VideoPromptSchema, newId, type Scene, type Script } from "@studio/domain";

/** Türkçe ortalama konuşma hızı (kelime/saniye) — süre tahsisinde kullanılır. */
export const WORDS_PER_SECOND_TR = 2.3;

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Senaryoyu sahnelere böler ve hedef süreyi bölümlerin anlatım uzunluğuyla
 * orantılı dağıtır (min 3 sn/sahne). Her sahneye storyboard promptu taslağı yazar.
 */
export function planScenes(script: Script, targetDurationSec: number): Scene[] {
  const now = new Date().toISOString();
  const wordCounts = script.sections.map((s) => Math.max(1, countWords(s.narration)));
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);

  return script.sections.map((section, index) => {
    const share = (wordCounts[index] ?? 1) / totalWords;
    const durationSec = Math.max(3, Math.round(targetDurationSec * share));
    return {
      id: newId("scn"),
      projectId: script.projectId,
      scriptId: script.id,
      order: index,
      title: section.heading,
      summary: section.visual,
      narration: section.narration,
      durationSec,
      characterNames: [],
      prompt: VideoPromptSchema.parse({
        subject: { description: section.visual },
        audio: { narration: section.narration },
        output: { durationSec: Math.min(durationSec, 60) },
      }),
      createdAt: now,
      updatedAt: now,
    } satisfies Scene;
  });
}
