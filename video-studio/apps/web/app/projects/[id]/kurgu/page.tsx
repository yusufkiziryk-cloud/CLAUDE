"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Asset, RenderJob, Sequence, TimelineClip, TimelineTrack } from "@studio/domain";
import {
  TimelineHistory,
  addClip,
  moveClip,
  removeClip,
  sequenceDurationSec,
  splitClip,
  trimClip,
  updateClip,
} from "@studio/timeline-engine";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  ProgressBar,
  Select,
  TextInput,
} from "@studio/ui";
import { API_URL, api, ApiError } from "@/lib/api";

const PX_PER_SEC = 40;

const TRACK_COLORS: Record<string, string> = {
  video: "bg-indigo-800 border-indigo-500",
  audio: "bg-emerald-900 border-emerald-500",
  text: "bg-amber-900 border-amber-500",
};

export default function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const historyRef = useRef<TimelineHistory | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<{ trackId: string; clipId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"clean" | "dirty" | "saving">("clean");
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [preset, setPreset] = useState<"480p" | "720p" | "1080p">("480p");
  const [newText, setNewText] = useState("");

  useEffect(() => {
    Promise.all([api.getSequence(id), api.listAssets(id)])
      .then(([seq, assetsRes]) => {
        historyRef.current = new TimelineHistory(seq);
        setSequence(seq);
        setAssets(assetsRes.assets);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.body.userMessage : String(e)));
  }, [id]);

  // Render işi canlı takibi
  useEffect(() => {
    if (!renderJob || ["succeeded", "failed"].includes(renderJob.status)) return;
    const timer = setInterval(async () => {
      try {
        setRenderJob(await api.getRenderJob(renderJob.id));
      } catch {
        // geçici hata
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [renderJob]);

  const apply = useCallback((command: (s: Sequence) => Sequence) => {
    const history = historyRef.current;
    if (!history) return;
    setError(null);
    try {
      setSequence(history.apply(command));
      setSaveState("dirty");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const undo = () => {
    const history = historyRef.current;
    if (history?.canUndo) {
      setSequence(history.undo());
      setSaveState("dirty");
    }
  };
  const redo = () => {
    const history = historyRef.current;
    if (history?.canRedo) {
      setSequence(history.redo());
      setSaveState("dirty");
    }
  };

  async function save() {
    if (!sequence) return;
    setSaveState("saving");
    try {
      await api.saveSequence(id, sequence);
      setSaveState("clean");
    } catch (e) {
      setError(e instanceof ApiError ? e.body.userMessage : String(e));
      setSaveState("dirty");
    }
  }

  async function startRender() {
    if (!sequence) return;
    setError(null);
    try {
      if (saveState !== "clean") await save();
      setRenderJob(await api.startRender(id, preset));
    } catch (e) {
      setError(e instanceof ApiError ? e.body.userMessage : String(e));
    }
  }

  const durationSec = sequence ? sequenceDurationSec(sequence) : 0;
  const selectedClip: { track: TimelineTrack; clip: TimelineClip } | null = useMemo(() => {
    if (!sequence || !selected) return null;
    const track = sequence.tracks.find((t) => t.id === selected.trackId);
    const clip = track?.clips.find((c) => c.id === selected.clipId);
    return track && clip ? { track, clip } : null;
  }, [sequence, selected]);

  function trackEnd(track: TimelineTrack): number {
    return track.clips.reduce((max, c) => Math.max(max, c.startSec + c.durationSec), 0);
  }

  function addAssetClip(asset: Asset) {
    if (!sequence) return;
    const kind = asset.kind === "audio" ? "audio" : "video";
    const track = sequence.tracks.find((t) => t.kind === kind);
    if (!track) return setError(`${kind} track'i bulunamadı.`);
    const duration =
      asset.kind === "audio" || asset.kind === "video" ? (asset.durationSec ?? 5) : 3;
    apply((s) =>
      addClip(s, {
        trackId: track.id,
        startSec: trackEnd(s.tracks.find((t) => t.id === track.id)!),
        durationSec: duration,
        assetId: asset.id,
      }),
    );
  }

  function addTextClip() {
    if (!sequence || newText.trim() === "") return;
    const track = sequence.tracks.find((t) => t.kind === "text");
    if (!track) return setError("Metin track'i bulunamadı.");
    apply((s) =>
      addClip(s, {
        trackId: track.id,
        startSec: trackEnd(s.tracks.find((t) => t.id === track.id)!),
        durationSec: 3,
        text: newText,
      }),
    );
    setNewText("");
  }

  if (error && !sequence) return <ErrorNote message={error} />;
  if (!sequence) return <p className="text-sm text-zinc-400">Yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Kurgu — {sequence.name}</h1>
        <Badge variant="neutral">{durationSec.toFixed(1)} sn</Badge>
        <Badge variant={saveState === "clean" ? "success" : "warning"}>
          {saveState === "clean"
            ? "kaydedildi"
            : saveState === "saving"
              ? "kaydediliyor…"
              : "kaydedilmedi"}
        </Badge>
        <span className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={undo} disabled={!historyRef.current?.canUndo}>
            ↩ Geri Al
          </Button>
          <Button variant="secondary" onClick={redo} disabled={!historyRef.current?.canRedo}>
            İleri Al ↪
          </Button>
          <Button onClick={save} disabled={saveState !== "dirty"}>
            Kaydet
          </Button>
          <Link href={`/projects/${id}`} className="text-sm text-indigo-400 hover:underline">
            ← Stüdyo
          </Link>
        </span>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <Card title="Zaman Çizelgesi">
        <div className="overflow-x-auto pb-2">
          <div style={{ width: Math.max(600, (durationSec + 5) * PX_PER_SEC) }}>
            {/* zaman cetveli */}
            <div className="relative mb-1 h-5 border-b border-zinc-700 text-[10px] text-zinc-500">
              {Array.from({ length: Math.ceil(durationSec + 5) }, (_, i) => (
                <span key={i} className="absolute" style={{ left: i * PX_PER_SEC }}>
                  {i}s
                </span>
              ))}
            </div>
            {sequence.tracks.map((track) => (
              <div key={track.id} className="mb-1 flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-zinc-400">{track.name}</span>
                <div className="relative h-12 flex-1 rounded bg-zinc-900">
                  {track.clips.map((clip) => (
                    <button
                      key={clip.id}
                      onClick={() => setSelected({ trackId: track.id, clipId: clip.id })}
                      className={`absolute top-1 h-10 overflow-hidden rounded border px-1 text-left text-[10px] text-zinc-100 ${TRACK_COLORS[track.kind]} ${
                        selected?.clipId === clip.id ? "ring-2 ring-white" : ""
                      }`}
                      style={{
                        left: clip.startSec * PX_PER_SEC,
                        width: Math.max(20, clip.durationSec * PX_PER_SEC),
                      }}
                      aria-label={`Klip: ${clip.text ?? clip.assetId ?? clip.id}`}
                    >
                      {clip.text ?? assets.find((a) => a.id === clip.assetId)?.name ?? clip.assetId}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Varlık Ekle">
          {assets.length === 0 ? (
            <EmptyState
              title="Varlık yok"
              description="Üretim Laboratuvarı'ndan veya storyboard'dan varlık üretin."
            />
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {assets.map((asset) => (
                <li
                  key={asset.id}
                  className="flex items-center gap-2 rounded border border-zinc-800 p-1.5"
                >
                  {asset.mimeType.startsWith("image/") ? (
                    <img src={asset.uri} alt="" className="h-8 w-14 rounded object-cover" />
                  ) : (
                    <span className="text-lg">{asset.kind === "audio" ? "🎵" : "🎬"}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                    {asset.name}
                  </span>
                  {asset.provenance?.mock ? <Badge variant="mock">MOCK</Badge> : null}
                  <Button
                    variant="secondary"
                    className="px-2 py-0.5 text-xs"
                    onClick={() => addAssetClip(asset)}
                  >
                    + Ekle
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Field label="Metin / altyazı klibi">
                <TextInput
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Ekranda görünecek metin"
                />
              </Field>
            </div>
            <Button variant="secondary" onClick={addTextClip} disabled={newText.trim() === ""}>
              + Metin
            </Button>
          </div>
        </Card>

        <Card title="Seçili Klip">
          {!selectedClip ? (
            <EmptyState
              title="Klip seçilmedi"
              description="Zaman çizelgesinde bir klibe tıklayın."
            />
          ) : (
            <ClipInspector
              key={selectedClip.clip.id}
              track={selectedClip.track}
              clip={selectedClip.clip}
              onMove={(start) =>
                apply((s) => moveClip(s, selectedClip.track.id, selectedClip.clip.id, start))
              }
              onTrim={(patch) =>
                apply((s) => trimClip(s, selectedClip.track.id, selectedClip.clip.id, patch))
              }
              onSplit={(at) =>
                apply((s) => splitClip(s, selectedClip.track.id, selectedClip.clip.id, at))
              }
              onUpdate={(patch) =>
                apply((s) => updateClip(s, selectedClip.track.id, selectedClip.clip.id, patch))
              }
              onDelete={() => {
                apply((s) => removeClip(s, selectedClip.track.id, selectedClip.clip.id));
                setSelected(null);
              }}
            />
          )}
        </Card>

        <Card title="Dışa Aktar (MP4)">
          <div className="space-y-3">
            <Field label="Kalite">
              <Select value={preset} onChange={(e) => setPreset(e.target.value as never)}>
                <option value="480p">480p (hızlı örnek)</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </Select>
            </Field>
            <Button
              onClick={startRender}
              disabled={durationSec === 0 || renderJob?.status === "running"}
            >
              🎞 Render Et
            </Button>
            {durationSec === 0 ? (
              <p className="text-xs text-zinc-500">Önce timeline'a klip ekleyin.</p>
            ) : null}
            {renderJob ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant={
                      renderJob.status === "succeeded"
                        ? "success"
                        : renderJob.status === "failed"
                          ? "error"
                          : "info"
                    }
                  >
                    {renderJob.status === "succeeded"
                      ? "tamamlandı"
                      : renderJob.status === "failed"
                        ? "başarısız"
                        : "render ediliyor"}
                  </Badge>
                  <span className="text-zinc-400">{renderJob.preset}</span>
                </div>
                {renderJob.status === "running" || renderJob.status === "queued" ? (
                  <ProgressBar value={renderJob.progress} />
                ) : null}
                {renderJob.error ? <ErrorNote message={renderJob.error.userMessage} /> : null}
                {renderJob.status === "succeeded" && renderJob.outputPath ? (
                  <video
                    src={`${API_URL}${renderJob.outputPath}`}
                    controls
                    className="w-full rounded border border-zinc-700"
                    aria-label="Render çıktısı"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ClipInspector({
  track,
  clip,
  onMove,
  onTrim,
  onSplit,
  onUpdate,
  onDelete,
}: {
  track: TimelineTrack;
  clip: TimelineClip;
  onMove: (startSec: number) => void;
  onTrim: (patch: { durationSec?: number; inSec?: number }) => void;
  onSplit: (atSec: number) => void;
  onUpdate: (patch: { text?: string; volume?: number }) => void;
  onDelete: () => void;
}) {
  const [start, setStart] = useState(String(clip.startSec));
  const [duration, setDuration] = useState(String(clip.durationSec));
  const [splitAt, setSplitAt] = useState(String((clip.startSec + clip.durationSec / 2).toFixed(2)));
  const [text, setText] = useState(clip.text ?? "");
  const [volume, setVolume] = useState(String(clip.volume));

  return (
    <div className="space-y-2 text-xs">
      <p className="text-zinc-400">
        <Badge variant="neutral">{track.kind}</Badge> {clip.text ?? clip.assetId}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Başlangıç (sn)">
          <TextInput
            type="number"
            min={0}
            step={0.1}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            onBlur={() => onMove(Number(start))}
          />
        </Field>
        <Field label="Süre (sn)">
          <TextInput
            type="number"
            min={0.1}
            step={0.1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={() => onTrim({ durationSec: Number(duration) })}
          />
        </Field>
      </div>
      {track.kind === "text" ? (
        <Field label="Metin">
          <TextInput
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => onUpdate({ text })}
          />
        </Field>
      ) : null}
      {track.kind === "audio" ? (
        <Field label="Ses seviyesi (0-2)">
          <TextInput
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            onBlur={() => onUpdate({ volume: Number(volume) })}
          />
        </Field>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Bölme noktası (sn)">
            <TextInput
              type="number"
              step={0.1}
              value={splitAt}
              onChange={(e) => setSplitAt(e.target.value)}
            />
          </Field>
        </div>
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          onClick={() => onSplit(Number(splitAt))}
        >
          ✂ Böl
        </Button>
        <Button variant="danger" className="px-2 py-1 text-xs" onClick={onDelete}>
          Sil
        </Button>
      </div>
    </div>
  );
}
