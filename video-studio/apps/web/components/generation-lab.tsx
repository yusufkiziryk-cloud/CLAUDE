"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GenerationJob, VideoPromptInput } from "@studio/domain";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, ProgressBar, Select } from "@studio/ui";
import { api, ApiError } from "@/lib/api";
import type { ModelManifestView, ProviderManifest } from "@/lib/types";

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "neutral" | "info" | "success" | "error" | "warning" }
> = {
  queued: { label: "kuyrukta", variant: "neutral" },
  running: { label: "çalışıyor", variant: "info" },
  succeeded: { label: "tamamlandı", variant: "success" },
  failed: { label: "başarısız", variant: "error" },
  cancelled: { label: "iptal edildi", variant: "warning" },
  expired: { label: "zaman aşımı", variant: "warning" },
};

export function GenerationLab({
  projectId,
  promptInput,
  promptReady,
  onResultsChanged,
}: {
  projectId: string;
  promptInput: VideoPromptInput;
  promptReady: boolean;
  onResultsChanged: () => void;
}) {
  const [providers, setProviders] = useState<ProviderManifest[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [durationSec, setDurationSec] = useState<number>(5);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [resolution, setResolution] = useState<string>("720p");
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const succeededCount = useRef(0);

  const models: ModelManifestView[] = useMemo(
    () => providers.flatMap((p) => p.models),
    [providers],
  );
  const model = models.find((m) => m.id === modelId);
  const provider = providers.find((p) => p.providerId === model?.providerId);

  useEffect(() => {
    api
      .listProviders()
      .then((r) => {
        setProviders(r.providers);
        const first = r.providers[0]?.models[0];
        if (first) {
          setModelId(first.id);
          if (first.options.durationsSec[0]) setDurationSec(first.options.durationsSec[0]);
          if (first.options.aspectRatios[0]) setAspectRatio(first.options.aspectRatios[0]);
          if (first.options.resolutions[0]) setResolution(first.options.resolutions[0]);
        }
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.body.userMessage : String(e)));
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const { jobs: next } = await api.listGenerations(projectId);
      setJobs(next);
      const succeeded = next.filter((j) => j.status === "succeeded").length;
      if (succeeded !== succeededCount.current) {
        succeededCount.current = succeeded;
        onResultsChanged();
      }
    } catch {
      // liste yenileme hatası geçicidir; bir sonraki turda tekrar denenir
    }
  }, [projectId, onResultsChanged]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  // Aktif iş varken canlı durum takibi
  const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void refreshJobs(), 1500);
    return () => clearInterval(timer);
  }, [hasActive, refreshJobs]);

  // Model değişince desteklenmeyen seçimleri modele uygun değerlere çek
  useEffect(() => {
    if (!model) return;
    if (!model.options.durationsSec.includes(durationSec) && model.options.durationsSec[0]) {
      setDurationSec(model.options.durationsSec[0]);
    }
    if (!model.options.aspectRatios.includes(aspectRatio) && model.options.aspectRatios[0]) {
      setAspectRatio(model.options.aspectRatios[0]);
    }
    if (!model.options.resolutions.includes(resolution) && model.options.resolutions[0]) {
      setResolution(model.options.resolutions[0]);
    }
  }, [model, durationSec, aspectRatio, resolution]);

  async function generate() {
    if (!model) return;
    setError(null);
    setSubmitting(true);
    try {
      // Önce prompt sürümü kalıcılaştırılır (provenance için), sonra iş kuyruklanır.
      const version = await api.createPromptVersion(projectId, promptInput);
      const request = {
        capability: "textToVideo" as const,
        providerId: model.providerId,
        modelId: model.id,
        prompt: {
          ...promptInput,
          output: {
            durationSec,
            aspectRatio: aspectRatio as never,
            resolution: resolution as never,
            fps: model.options.fps[0] ?? 24,
            variations: 1,
          },
        },
      };
      await api.createGeneration({
        projectId,
        promptVersionId: version.id,
        request: request as never,
        idempotencyKey: crypto.randomUUID(),
      });
      await refreshJobs();
    } catch (err) {
      if (err instanceof ApiError && err.body.issues) {
        setError(
          `${err.body.userMessage} ${err.body.issues.map((i) => `${i.field}: ${i.message}`).join(" ")}`,
        );
      } else {
        setError(err instanceof ApiError ? err.body.userMessage : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: string) {
    try {
      await api.cancelGeneration(id);
      await refreshJobs();
    } catch (err) {
      setError(err instanceof ApiError ? err.body.userMessage : String(err));
    }
  }

  return (
    <Card title="Üretim Laboratuvarı">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Model">
            <Select value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Süre (sn)"
            hint={model ? `Bu model: ${model.options.durationsSec.join(", ")} sn` : undefined}
          >
            <Select value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))}>
              {model?.options.durationsSec.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="En-boy oranı">
            <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
              {model?.options.aspectRatios.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Çözünürlük">
            <Select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              {model?.options.resolutions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
        </div>

        {provider?.mock ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Badge variant="mock">MOCK / DEMO</Badge>
            <span>
              Bu sağlayıcı gerçek AI üretimi yapmaz; akışı test etmek için yer tutucu çıktı üretir.
            </span>
          </div>
        ) : null}

        {model ? (
          <p className="text-xs text-zinc-400">
            Tahmini maliyet:{" "}
            <span className="font-semibold text-zinc-200">
              ${(model.pricing.estimatedUsd * durationSec).toFixed(2)}
            </span>{" "}
            <span className="text-zinc-500">
              ({model.pricing.source} — {model.pricing.asOf})
            </span>
          </p>
        ) : null}

        {error ? <ErrorNote message={error} /> : null}

        <Button onClick={generate} disabled={!promptReady || !model || submitting}>
          {submitting ? "Gönderiliyor…" : "▶ Üret"}
        </Button>
        {!promptReady ? (
          <p className="text-xs text-zinc-500">Üretim için önce özne alanını doldurun.</p>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-300">Üretim kuyruğu</h3>
          {jobs.length === 0 ? (
            <EmptyState title="Henüz üretim işi yok" />
          ) : (
            <ul className="space-y-2">
              {jobs.map((job) => {
                const status = STATUS_LABELS[job.status] ?? STATUS_LABELS["queued"]!;
                return (
                  <li key={job.id} className="rounded-md border border-zinc-700 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <span className="text-xs text-zinc-400">{job.request.modelId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          {new Date(job.createdAt).toLocaleTimeString("tr-TR")}
                        </span>
                        {job.status === "queued" ? (
                          <Button
                            variant="danger"
                            className="px-2 py-1 text-xs"
                            onClick={() => void cancel(job.id)}
                          >
                            İptal
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {job.status === "running" ? (
                      <div className="mt-2">
                        <ProgressBar value={job.progress} />
                      </div>
                    ) : null}
                    {job.error ? (
                      <p className="mt-2 text-xs text-red-400">{job.error.userMessage}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
