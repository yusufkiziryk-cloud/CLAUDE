import { describe, expect, it } from "vitest";
import { cuesFromScenes, splitSentences } from "./cue.js";
import { parseCaptions, toSrt, toVtt } from "./srt.js";

const sampleCues = [
  { startSec: 0, endSec: 2.5, text: "Merhaba dünya." },
  { startSec: 2.5, endSec: 5, text: "İkinci satır, virgüllü." },
  { startSec: 61.25, endSec: 65.999, text: "Bir dakikadan sonra." },
];

describe("SRT/VTT serileştirme", () => {
  it("SRT round-trip kayıpsızdır", () => {
    const srt = toSrt(sampleCues);
    expect(srt).toContain("00:00:00,000 --> 00:00:02,500");
    expect(srt).toContain("00:01:01,250");
    const { cues, warnings } = parseCaptions(srt);
    expect(warnings).toEqual([]);
    expect(cues).toEqual(sampleCues);
  });

  it("VTT round-trip kayıpsızdır ve WEBVTT başlığı taşır", () => {
    const vtt = toVtt(sampleCues);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:02.500");
    const { cues, warnings } = parseCaptions(vtt);
    expect(warnings).toEqual([]);
    expect(cues).toEqual(sampleCues);
  });

  it("bozuk bloklar uyarıyla atlanır, sağlamlar korunur", () => {
    const dirty = `1\n00:00:00,000 --> 00:00:01,000\nSağlam satır\n\nbozuk blok zaman yok\n\n2\n00:00:02,000 --> 00:00:01,000\nters süre`;
    const { cues, warnings } = parseCaptions(dirty);
    expect(cues).toHaveLength(1);
    expect(cues[0]?.text).toBe("Sağlam satır");
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("cuesFromScenes", () => {
  it("cümleleri böler ve süreyi kelime sayısıyla orantılar", () => {
    const cues = cuesFromScenes([
      {
        narration: "Kısa cümle. Bu ise biraz daha uzun bir ikinci cümle oldu!",
        durationSec: 10,
        startSec: 5,
      },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0]?.startSec).toBe(5);
    expect(cues[1]?.startSec).toBeCloseTo(cues[0]!.endSec, 5);
    expect(cues[1]!.endSec).toBeCloseTo(15, 0);
    // uzun cümle daha fazla süre almalı
    expect(cues[1]!.endSec - cues[1]!.startSec).toBeGreaterThan(
      cues[0]!.endSec - cues[0]!.startSec,
    );
  });

  it("sahne başlangıç ofsetleri korunur; boş anlatım atlanır", () => {
    const cues = cuesFromScenes([
      { narration: "", durationSec: 3, startSec: 0 },
      { narration: "Tek cümle.", durationSec: 4, startSec: 3 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ startSec: 3, endSec: 7 });
  });

  it("splitSentences Türkçe noktalamayı tanır", () => {
    expect(splitSentences("Bir. İki! Üç? Dört… Beş")).toHaveLength(5);
  });
});
