"use client";

import { useState } from "react";
import { cuesFromScenes, parseCaptions, toSrt, toVtt, type CaptionCue } from "@studio/captions";
import { Badge, Button, Card, EmptyState, ErrorNote, TextInput } from "@studio/ui";
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
        <p className="text-xs text-zinc-500">
          "Sahnelerden Üret" senaryo metninden türetir (ses dökümü değildir); süreler kelime
          sayısıyla orantılanır.
        </p>

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
