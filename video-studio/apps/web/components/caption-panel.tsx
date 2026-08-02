"use client";

import { useEffect, useState } from "react";
import type { Asset } from "@studio/domain";
import { cuesFromScenes, parseCaptions, toSrt, toVtt, type CaptionCue } from "@studio/captions";
import { Badge, Button, Card, EmptyState, ErrorNote, Select, TextInput } from "@studio/ui";
import { api } from "@/lib/api";

function download(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Altyazı editörü: sahnelerden üret / SRT içe aktar / düzenle / timeline'a uygula / dışa aktar. */
export function CaptionPanel({
  projectId,
  onApply,
}: {
  projectId: string;
  onApply: (cues: CaptionCue[]) => void;
}) {
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Sesten hizalı altyazı (STT): projedeki ses varlıkları + kullanılan motor
  const [audioAssets, setAudioAssets] = useState<Asset[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [sttEngine, setSttEngine] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    api
      .listAssets(projectId)
      .then(({ assets }) => {
        const audio = assets.filter((a) => a.kind === "audio");
        setAudioAssets(audio);
        if (audio[0]) setSelectedAudioId(audio[0].id);
      })
      .catch(() => {
        // ses listesi yüklenemedi; STT düğmesi devre dışı kalır
      });
  }, [projectId]);

  async function transcribeFromAudio() {
    if (!selectedAudioId) return;
    setError(null);
    setTranscribing(true);
    try {
      const result = await api.transcribeAsset(selectedAudioId, "tr");
      setCues(result.cues.map((c) => ({ startSec: c.startSec, endSec: c.endSec, text: c.text })));
      setWarnings([]);
      setSttEngine(result.engine);
    } catch (e) {
      setError(String(e));
    } finally {
      setTranscribing(false);
    }
  }

  async function generateFromScenes() {
    setError(null);
    try {
      const { scenes } = await api.listScenes(projectId);
      if (scenes.length === 0) {
        setError("Sahne planı yok; önce Senaryo & Storyboard sayfasında sahne oluşturun.");
        return;
      }
      let cursor = 0;
      const input = [...scenes]
        .sort((a, b) => a.order - b.order)
        .map((scene) => {
          const item = {
            narration: scene.narration,
            durationSec: scene.durationSec,
            startSec: cursor,
          };
          cursor += scene.durationSec;
          return item;
        });
      setCues(cuesFromScenes(input));
      setWarnings([]);
    } catch (e) {
      setError(String(e));
    }
  }

  function importFile(file: File) {
    void file.text().then((content) => {
      const parsed = parseCaptions(content);
      setCues(parsed.cues);
      setWarnings(parsed.warnings);
    });
  }

  function updateCue(index: number, patch: Partial<CaptionCue>) {
    setCues((current) => current.map((cue, i) => (i === index ? { ...cue, ...patch } : cue)));
  }

  return (
    <Card title="Altyazılar">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => void generateFromScenes()}
          >
            Sahnelerden Üret
          </Button>
          <label className="cursor-pointer rounded-md bg-zinc-700 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-600">
            SRT/VTT İçe Aktar
            <input
              type="file"
              accept=".srt,.vtt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            disabled={cues.length === 0}
            onClick={() => download("altyazi.srt", toSrt(cues))}
          >
            SRT İndir
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            disabled={cues.length === 0}
            onClick={() => download("altyazi.vtt", toVtt(cues))}
          >
            VTT İndir
          </Button>
          <Button
            className="px-2 py-1 text-xs"
            disabled={cues.length === 0}
            onClick={() => onApply(cues)}
          >
            ⬇ Metin Track'ine Uygula
          </Button>
        </div>
        <p className="text-xs text-zinc-400">
          "Sahnelerden Üret" senaryo metninden türetir (ses dökümü değildir); süreler kelime
          sayısıyla orantılanır.
        </p>

        {/* Sesten hizalı altyazı: transkripsiyon cue'ları zaman damgalıdır */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 p-2">
          <Select
            aria-label="Transkripsiyon için ses varlığı"
            value={selectedAudioId}
            onChange={(e) => setSelectedAudioId(e.target.value)}
            disabled={audioAssets.length === 0}
            className="max-w-56 text-xs"
          >
            {audioAssets.length === 0 ? <option value="">Ses varlığı yok</option> : null}
            {audioAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            disabled={!selectedAudioId || transcribing}
            onClick={() => void transcribeFromAudio()}
          >
            {transcribing ? "Çözümleniyor…" : "🎧 Sesten Üret (STT)"}
          </Button>
          {sttEngine ? (
            sttEngine.toLowerCase().includes("mock") ? (
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Badge variant="mock">MOCK / DEMO</Badge> gerçek konuşma tanıma değil ({sttEngine})
              </span>
            ) : (
              <span className="text-xs text-zinc-400">motor: {sttEngine}</span>
            )
          ) : null}
        </div>

        {error ? <ErrorNote message={error} /> : null}
        {warnings.map((w) => (
          <p key={w} className="text-xs text-amber-400">
            ⚠ {w}
          </p>
        ))}

        {cues.length === 0 ? (
          <EmptyState
            title="Altyazı yok"
            description="Sahnelerden üretin veya SRT/VTT içe aktarın."
          />
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {cues.map((cue, index) => (
              <li
                key={index}
                className="flex items-center gap-1 rounded border border-zinc-800 p-1"
              >
                <Badge variant="neutral">{index + 1}</Badge>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={cue.startSec}
                  aria-label={`Altyazı ${index + 1} başlangıç`}
                  className="w-16 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-xs text-zinc-200"
                  onChange={(e) => updateCue(index, { startSec: Number(e.target.value) })}
                />
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={cue.endSec}
                  aria-label={`Altyazı ${index + 1} bitiş`}
                  className="w-16 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-xs text-zinc-200"
                  onChange={(e) => updateCue(index, { endSec: Number(e.target.value) })}
                />
                <TextInput
                  value={cue.text}
                  aria-label={`Altyazı ${index + 1} metni`}
                  onChange={(e) => updateCue(index, { text: e.target.value })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
