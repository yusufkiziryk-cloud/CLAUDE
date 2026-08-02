"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PromptVersion, VideoPromptInput } from "@studio/domain";
import { diffPrompts } from "@studio/prompt-engine";
import { Badge, Button, Card, EmptyState } from "@studio/ui";
import { api } from "@/lib/api";

/** Sürüm geçmişi: yükleme ve iki sürüm arasında alan bazlı diff. */
export function VersionHistory({
  projectId,
  refreshKey,
  onLoad,
}: {
  projectId: string;
  refreshKey: number;
  onLoad: (body: VideoPromptInput) => void;
}) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      setVersions((await api.listPromptVersions(projectId)).promptVersions);
    } catch {
      // geçici hata; bir sonraki yenilemede tekrar denenir
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current.slice(-1), id],
    );
  }

  const diff = useMemo(() => {
    if (selected.length !== 2) return null;
    const [a, b] = selected.map((id) => versions.find((v) => v.id === id));
    if (!a || !b) return null;
    const [older, newer] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
    return { older, newer, entries: diffPrompts(older.body, newer.body) };
  }, [selected, versions]);

  return (
    <Card title="Prompt Sürüm Geçmişi">
      {versions.length === 0 ? (
        <EmptyState
          title="Henüz kaydedilmiş sürüm yok"
          description="Her üretim, kullanılan promptu sürüm olarak saklar."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Karşılaştırmak için iki sürüm işaretleyin; forma geri yüklemek için "Yükle".
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 rounded border border-zinc-800 px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(v.id)}
                  onChange={() => toggle(v.id)}
                  aria-label={`Sürüm ${v.version} seç`}
                />
                <Badge variant="neutral">v{v.version}</Badge>
                <span className="truncate text-xs text-zinc-400">
                  {v.body.subject.description.slice(0, 60)}
                </span>
                <span className="ml-auto shrink-0 text-xs text-zinc-400">
                  {new Date(v.createdAt).toLocaleTimeString("tr-TR")}
                </span>
                <Button
                  variant="secondary"
                  className="px-2 py-0.5 text-xs"
                  onClick={() => onLoad(v.body)}
                >
                  Yükle
                </Button>
              </li>
            ))}
          </ul>

          {diff ? (
            <div className="rounded-md border border-zinc-700 bg-zinc-950 p-3">
              <p className="mb-2 text-xs font-semibold text-zinc-400">
                v{diff.older.version} → v{diff.newer.version} farkları
              </p>
              {diff.entries.length === 0 ? (
                <p className="text-xs text-zinc-400">İçerik aynı.</p>
              ) : (
                <ul className="space-y-1">
                  {diff.entries.map((entry) => (
                    <li key={entry.path} className="text-xs">
                      <span className="font-mono text-indigo-400">{entry.path}</span>{" "}
                      <span className="text-red-400 line-through">{formatValue(entry.before)}</span>{" "}
                      <span className="text-emerald-400">{formatValue(entry.after)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined) return "(yok)";
  if (typeof value === "string") return value === "" ? "(boş)" : value;
  return JSON.stringify(value);
}
