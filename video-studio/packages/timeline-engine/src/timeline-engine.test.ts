import { describe, expect, it } from "vitest";
import { SequenceSchema } from "@studio/domain";
import {
  TimelineError,
  addClip,
  addTrack,
  createDefaultSequence,
  moveClip,
  removeClip,
  removeTrack,
  sequenceDurationSec,
  splitClip,
  trimClip,
  updateClip,
} from "./commands.js";
import { TimelineHistory } from "./history.js";

const seq = () => createDefaultSequence("prj_1");
const videoTrack = (s: ReturnType<typeof seq>) => s.tracks.find((t) => t.kind === "video")!;
const textTrack = (s: ReturnType<typeof seq>) => s.tracks.find((t) => t.kind === "text")!;

describe("komutlar", () => {
  it("varsayılan sequence 3 track ile doğrulanır ve serileştirme round-trip çalışır", () => {
    const s = seq();
    expect(s.tracks).toHaveLength(3);
    const reparsed = SequenceSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(reparsed).toEqual(s);
  });

  it("addClip: video track'ine assetId zorunlu, metin track'ine text zorunlu", () => {
    const s = seq();
    expect(() => addClip(s, { trackId: videoTrack(s).id, startSec: 0, durationSec: 5 })).toThrow(
      TimelineError,
    );
    expect(() => addClip(s, { trackId: textTrack(s).id, startSec: 0, durationSec: 3 })).toThrow(
      TimelineError,
    );
    const withClip = addClip(s, {
      trackId: videoTrack(s).id,
      startSec: 0,
      durationSec: 5,
      assetId: "ast_1",
    });
    expect(videoTrack(withClip).clips).toHaveLength(1);
    // saflık: orijinal değişmedi
    expect(videoTrack(s).clips).toHaveLength(0);
  });

  it("çakışan klip reddedilir; bitişik klip kabul edilir", () => {
    let s = seq();
    const trackId = videoTrack(s).id;
    s = addClip(s, { trackId, startSec: 0, durationSec: 5, assetId: "a" });
    expect(() => addClip(s, { trackId, startSec: 3, durationSec: 4, assetId: "b" })).toThrow(
      /çakışıyor/,
    );
    s = addClip(s, { trackId, startSec: 5, durationSec: 4, assetId: "b" });
    expect(videoTrack(s).clips).toHaveLength(2);
  });

  it("moveClip çakışmayı önler ve sıralamayı korur", () => {
    let s = seq();
    const trackId = videoTrack(s).id;
    s = addClip(s, { trackId, startSec: 0, durationSec: 5, assetId: "a" });
    s = addClip(s, { trackId, startSec: 10, durationSec: 5, assetId: "b" });
    const [first] = videoTrack(s).clips;
    expect(() => moveClip(s, trackId, first!.id, 8)).toThrow(/çakışıyor/);
    s = moveClip(s, trackId, first!.id, 20);
    expect(videoTrack(s).clips.map((c) => c.startSec)).toEqual([10, 20]);
  });

  it("splitClip: süreler ve kaynak giriş noktası doğru bölünür", () => {
    let s = seq();
    const trackId = videoTrack(s).id;
    s = addClip(s, { trackId, startSec: 2, durationSec: 6, assetId: "a", inSec: 1 });
    const clip = videoTrack(s).clips[0]!;
    s = splitClip(s, trackId, clip.id, 5); // 2+3 anında böl
    const clips = videoTrack(s).clips;
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ startSec: 2, durationSec: 3, inSec: 1 });
    expect(clips[1]).toMatchObject({ startSec: 5, durationSec: 3, inSec: 4 });
    expect(() => splitClip(s, trackId, clips[0]!.id, 2)).toThrow(/içinde/);
  });

  it("trim, updateClip, removeClip, removeTrack ve süre hesabı çalışır", () => {
    let s = seq();
    const trackId = videoTrack(s).id;
    s = addClip(s, { trackId, startSec: 0, durationSec: 8, assetId: "a" });
    const clipId = videoTrack(s).clips[0]!.id;
    s = trimClip(s, trackId, clipId, { durationSec: 4, inSec: 2 });
    expect(videoTrack(s).clips[0]).toMatchObject({ durationSec: 4, inSec: 2 });
    s = updateClip(s, trackId, clipId, { volume: 0.5 });
    expect(videoTrack(s).clips[0]!.volume).toBe(0.5);
    expect(sequenceDurationSec(s)).toBe(4);
    s = removeClip(s, trackId, clipId);
    expect(videoTrack(s).clips).toHaveLength(0);
    const trackCount = s.tracks.length;
    s = addTrack(s, "audio", "Ses 2");
    expect(s.tracks).toHaveLength(trackCount + 1);
    s = removeTrack(s, s.tracks.at(-1)!.id);
    expect(s.tracks).toHaveLength(trackCount);
  });
});

describe("TimelineHistory (undo/redo)", () => {
  it("apply → undo → redo döngüsü ve yeni komutla redo temizliği", () => {
    const history = new TimelineHistory(seq());
    const trackId = videoTrack(history.current).id;

    history.apply((s) => addClip(s, { trackId, startSec: 0, durationSec: 5, assetId: "a" }));
    history.apply((s) => addClip(s, { trackId, startSec: 5, durationSec: 5, assetId: "b" }));
    expect(videoTrack(history.current).clips).toHaveLength(2);

    history.undo();
    expect(videoTrack(history.current).clips).toHaveLength(1);
    history.redo();
    expect(videoTrack(history.current).clips).toHaveLength(2);

    history.undo();
    history.apply((s) => addClip(s, { trackId, startSec: 10, durationSec: 2, assetId: "c" }));
    expect(history.canRedo).toBe(false);
    expect(videoTrack(history.current).clips.map((c) => c.startSec)).toEqual([0, 10]);
  });

  it("başarısız komut durumu bozmaz", () => {
    const history = new TimelineHistory(seq());
    const trackId = videoTrack(history.current).id;
    history.apply((s) => addClip(s, { trackId, startSec: 0, durationSec: 5, assetId: "a" }));
    expect(() =>
      history.apply((s) => addClip(s, { trackId, startSec: 1, durationSec: 2, assetId: "b" })),
    ).toThrow(TimelineError);
    expect(videoTrack(history.current).clips).toHaveLength(1);
    expect(history.canUndo).toBe(true);
  });
});
