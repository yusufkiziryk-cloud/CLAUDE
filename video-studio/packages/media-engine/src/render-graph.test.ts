import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addClip, createDefaultSequence } from "@studio/timeline-engine";
import {
  RenderGraphError,
  buildRenderGraph,
  escapeDrawText,
  validateSequenceForRender,
  type RenderAssetFile,
} from "./render-graph.js";

function ffmpegAvailable(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function sampleSequence() {
  let s = createDefaultSequence("prj_1");
  const video = s.tracks.find((t) => t.kind === "video")!;
  const text = s.tracks.find((t) => t.kind === "text")!;
  s = addClip(s, { trackId: video.id, startSec: 0, durationSec: 2, assetId: "img1" });
  s = addClip(s, { trackId: text.id, startSec: 0.5, durationSec: 1, text: "Merhaba Dünya" });
  return s;
}

const assets = (path = "/tmp/x.png"): Map<string, RenderAssetFile> =>
  new Map([["img1", { path, mimeType: "image/png" }]]);

describe("buildRenderGraph", () => {
  it("argüman DİZİSİ üretir (shell string yok) ve girdi/filtre/çıktıyı içerir", () => {
    const graph = buildRenderGraph(sampleSequence(), assets(), {
      width: 320,
      height: 180,
      fps: 24,
      outputPath: "/tmp/out.mp4",
    });
    expect(Array.isArray(graph.args)).toBe(true);
    expect(graph.durationSec).toBe(2);
    expect(graph.args).toContain("-filter_complex");
    expect(graph.args).toContain("/tmp/x.png");
    expect(graph.args.at(-1)).toBe("/tmp/out.mp4");
    const filter = graph.args[graph.args.indexOf("-filter_complex") + 1]!;
    expect(filter).toContain("drawtext");
    expect(filter).toContain("Merhaba Dünya");
    expect(filter).toContain("anullsrc"); // ses klibi yok → sessizlik
  });

  it("boş timeline ve kayıp medya anlaşılır hata verir", () => {
    const empty = createDefaultSequence("prj_1");
    expect(() =>
      buildRenderGraph(empty, new Map(), {
        width: 320,
        height: 180,
        fps: 24,
        outputPath: "/tmp/o.mp4",
      }),
    ).toThrow(RenderGraphError);

    expect(() =>
      buildRenderGraph(sampleSequence(), new Map(), {
        width: 320,
        height: 180,
        fps: 24,
        outputPath: "/tmp/o.mp4",
      }),
    ).toThrow(/Kayıp medyayı yeniden bağlayın|varlığı bulunamadı/);

    const problems = validateSequenceForRender(sampleSequence(), new Map());
    expect(problems.some((p) => p.includes("kayıp medya") || p.includes("Kayıp"))).toBe(true);
  });

  it("drawtext kaçışı tehlikeli karakterleri etkisizleştirir", () => {
    const escaped = escapeDrawText("a:b,c'd%e");
    expect(escaped).not.toContain("a:b");
    expect(escaped).toContain("\\:");
    expect(escaped).toContain("\\,");
    expect(escaped).toContain("\\%");
  });
});

describe.skipIf(!ffmpegAvailable())("gerçek FFmpeg smoke testi", () => {
  it("örnek görsel + metin klibinden geçerli MP4 üretir", () => {
    const dir = mkdtempSync(join(tmpdir(), "render-"));
    const imgPath = join(dir, "in.png");
    // Test girdisi: ffmpeg ile tek karelik PNG üret
    execFileSync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=red:size=320x180",
      "-frames:v",
      "1",
      imgPath,
    ]);
    const outputPath = join(dir, "out.mp4");
    const graph = buildRenderGraph(sampleSequence(), assets(imgPath), {
      width: 320,
      height: 180,
      fps: 24,
      outputPath,
    });
    execFileSync("ffmpeg", graph.args, { stdio: "ignore" });
    expect(existsSync(outputPath)).toBe(true);

    const probe = execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      outputPath,
    ])
      .toString()
      .trim();
    expect(Math.abs(Number(probe) - 2)).toBeLessThan(0.3);
  }, 60000);
});
