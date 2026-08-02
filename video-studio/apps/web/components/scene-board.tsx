"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContinuityIssue, Scene, Script } from "@studio/domain";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Select } from "@studio/ui";
import { api, ApiError, resolveAssetUrl } from "@/lib/api";
import type { ProviderManifest } from "@/lib/types";

/** Senaryo üretimi + sahne planı + storyboard + tutarlılık paneli. */
export function SceneBoard({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [issues, setIssues] = useState<ContinuityIssue[]>([]);
  const [providers, setProviders] = useState<ProviderManifest[]>([]);
  const [format, setFormat] = useState("reklam");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const script = scripts[0] ?? null;

  const imageModels = useMemo(
    () =>
      providers.flatMap((p) =>
        p.models
          .filter((m) => m.capabilities.includes("textToImage"))
          .map((m) => ({ ...m, providerMock: p.mock })),
      ),
    [providers],
  );
  const [imageModelId, setImageModelId] = useState("");
  const imageModel = imageModels.find((m) => m.id === imageModelId) ?? imageModels[0];

  const refresh = useCallback(async () => {
    try {
      const [scriptsRes, scenesRes, continuityRes] = await Promise.all([
        api.listScripts(projectId),
        api.listScenes(projectId),
        api.getContinuity(projectId),
      ]);
      setScripts(scriptsRes.scripts);
      setScenes(scenesRes.scenes);
      setIssues(continuityRes.issues);
    } catch {
      // geçici hata
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
    api
      .listProviders()
      .then((r) => setProviders(r.providers))
      .catch(() => {});
  }, [refresh, refreshKey]);

  // Storyboard job'ı süren sahneler varken canlı takip; biten job'ın varlığı sahneye bağlanır.
  const pending = scenes.filter((s) => s.storyboardJobId && !s.storyboardAssetId);
  useEffect(() => {
    if (pending.length === 0) return;
    const timer = setInterval(async () => {
      for (const scene of pending) {
        try {
          const job = await api.getGeneration(scene.storyboardJobId as string);
          if (job.status === "succeeded") {
            // Varlık sunucu tarafında sahneye bağlanır (Faz 5); yalnızca tazeleriz.
            await refresh();
          } else if (["failed", "expired", "cancelled"].includes(job.status)) {
            setError(job.error?.userMessage ?? "Storyboard üretimi başarısız oldu.");
            await api.updateScene(scene.id, { storyboardJobId: "" });
            await refresh();
          }
        } catch {
          // geçici hata
        }
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(label);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.body.userMessage : String(err));
    } finally {
      setBusy(null);
    }
  }

  const generatorBadge = (generator: string) =>
    generator === "template" ? (
      <Badge variant="warning">Şablon taslağı — LLM değil</Badge>
    ) : (
      <Badge variant="success">LLM: {generator}</Badge>
    );

  return (
    <div className="space-y-4">
      <Card title="2) Senaryo">
        <div className="flex items-end gap-2">
          <Field label="Format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="reklam">Reklam</option>
              <option value="anlatici">Anlatıcı metni</option>
              <option value="egitim">Eğitim</option>
              <option value="sosyal-medya">Sosyal medya</option>
              <option value="haber">Haber / brifing</option>
              <option value="kisa-film">Kısa film</option>
            </Select>
          </Field>
          <Button
            onClick={() => void run("script", () => api.generateScript(projectId, format as never))}
            disabled={busy !== null}
          >
            {busy === "script" ? "Üretiliyor…" : script ? "Senaryoyu Yeniden Üret" : "Senaryo Üret"}
          </Button>
          {script ? (
            <Button
              variant="secondary"
              onClick={() => void run("plan", () => api.planScenes(script.id))}
              disabled={busy !== null}
            >
              {busy === "plan" ? "Bölünüyor…" : "Sahnelere Böl"}
            </Button>
          ) : null}
        </div>

        {error ? (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        ) : null}

        {script ? (
          <div className="mt-3 space-y-2 rounded-md border border-zinc-800 p-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-200">{script.title}</h3>
              {generatorBadge(script.generator)}
            </div>
            <ol className="list-decimal space-y-1 pl-5">
              {script.sections.map((s) => (
                <li key={s.heading} className="text-xs text-zinc-400">
                  <span className="font-medium text-zinc-300">{s.heading}:</span> {s.narration}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            Brief'i kaydettikten sonra senaryo üretin. OPENAI_API_KEY tanımlıysa gerçek LLM, değilse
            açıkça etiketlenmiş şablon taslağı kullanılır.
          </p>
        )}
      </Card>

      <Card title="3) Sahne Planı ve Storyboard">
        {scenes.length === 0 ? (
          <EmptyState
            title="Henüz sahne yok"
            description="Senaryoyu 'Sahnelere Böl' ile planlayın."
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>Storyboard modeli:</span>
              <Select
                value={imageModel?.id ?? ""}
                onChange={(e) => setImageModelId(e.target.value)}
                aria-label="Storyboard modeli"
              >
                {imageModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </Select>
              {imageModel?.providerMock ? <Badge variant="mock">MOCK / DEMO</Badge> : null}
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {scenes.map((scene) => (
                <li key={scene.id} className="rounded-md border border-zinc-700 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">#{scene.order + 1}</Badge>
                    <span className="truncate text-sm font-medium text-zinc-200">
                      {scene.title}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-zinc-500">
                      {scene.durationSec} sn
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{scene.summary}</p>
                  <p className="mt-1 text-xs text-zinc-500">🎙 {scene.narration.slice(0, 100)}…</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      defaultValue={scene.characterNames.join(", ")}
                      placeholder="Karakterler (virgülle)"
                      aria-label={`Sahne ${scene.order + 1} karakterleri`}
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                      onBlur={(e) =>
                        void run("chars", () =>
                          api.updateScene(scene.id, {
                            characterNames: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }),
                        )
                      }
                    />
                    <Button
                      variant="secondary"
                      className="shrink-0 px-2 py-1 text-xs"
                      disabled={
                        !imageModel ||
                        busy !== null ||
                        Boolean(scene.storyboardJobId && !scene.storyboardAssetId)
                      }
                      onClick={() =>
                        void run("sb", () =>
                          api.createStoryboard(scene.id, imageModel!.providerId, imageModel!.id),
                        )
                      }
                    >
                      {scene.storyboardJobId && !scene.storyboardAssetId
                        ? "Üretiliyor…"
                        : "🎬 Storyboard"}
                    </Button>
                  </div>
                  {scene.storyboardAssetId ? (
                    <StoryboardThumb assetId={scene.storyboardAssetId} />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="4) Tutarlılık Denetimi">
        {issues.length === 0 ? (
          <p className="text-xs text-emerald-400">Sorun bulunamadı.</p>
        ) : (
          <ul className="space-y-1">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="flex items-start gap-2 text-xs">
                <Badge
                  variant={
                    issue.severity === "error"
                      ? "error"
                      : issue.severity === "warning"
                        ? "warning"
                        : "info"
                  }
                >
                  {issue.severity === "error"
                    ? "engel"
                    : issue.severity === "warning"
                      ? "uyarı"
                      : "bilgi"}
                </Badge>
                <span className="text-zinc-300">{issue.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StoryboardThumb({ assetId }: { assetId: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    api
      .getAsset(assetId)
      .then((a) => setUri(resolveAssetUrl(a.uri)))
      .catch(() => {});
  }, [assetId]);
  if (!uri) return null;
  return (
    <img src={uri} alt="Storyboard karesi" className="mt-2 w-full rounded border border-zinc-700" />
  );
}
