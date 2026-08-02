"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalGenerationRequest, GenerationJob, VideoPromptInput } from "@studio/domain";
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
import { api, ApiError } from "@/lib/api";
import type { EstimateResponse, ModelManifestView, ProviderManifest } from "@/lib/types";

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

const CAPABILITY_LABELS: Record<string, string> = {
  textToVideo: "Metinden Video",
  imageToVideo: "Görselden Video",
  startEndFrame: "Başlangıç/Bitiş Karesi",
  textToImage: "Metinden Görsel",
  textToSpeech: "Seslendirme (TTS)",
};

export function GenerationLab({
  projectId,
  promptInput,
  promptReady,
  onResultsChanged,
  onJobCreated,
}: {
  projectId: string;
  promptInput: VideoPromptInput;
  promptReady: boolean;
  onResultsChanged: () => void;
  onJobCreated: () => void;
}) {
  const [providers, setProviders] = useState<ProviderManifest[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [capability, setCapability] = useState<string>("textToVideo");
  const [durationSec, setDurationSec] = useState<number>(5);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [resolution, setResolution] = useState<string>("720p");
  const [params, setParams] = useState<Record<string, string | number>>({});
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const succeededCount = useRef(0);
  // Aynı projedeki üretimler tek prompt soyağacında sürümlenir (v1, v2, ...).
  const promptIdRef = useRef<string | undefined>(undefined);

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
        if (first) selectModel(first);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.body.userMessage : String(e)));
  }, []);

  function selectModel(m: ModelManifestView) {
    setModelId(m.id);
    setCapability(m.capabilities[0] ?? "textToVideo");
    if (m.options.durationsSec[0]) setDurationSec(m.options.durationsSec[0]);
    if (m.options.aspectRatios[0]) setAspectRatio(m.options.aspectRatios[0]);
    if (m.options.resolutions[0]) setResolution(m.options.resolutions[0]);
    // Manifest'te beyan edilen parametrelerin varsayılanları uygulanır.
    const defaults: Record<string, string | number> = {};
    for (const [key, spec] of Object.entries(m.params)) {
      if (spec.default !== undefined && typeof spec.default !== "boolean")
        defaults[key] = spec.default;
    }
    setParams(defaults);
  }

  const buildRequest = useCallback((): CanonicalGenerationRequest | null => {
    if (!model) return null;
    return {
      capability: capability as never,
      providerId: model.providerId,
      modelId: model.id,
      params,
      prompt: {
        ...promptInput,
        output: {
          durationSec: model.options.durationsSec.length > 0 ? durationSec : 5,
          aspectRatio: (model.options.aspectRatios.length > 0 ? aspectRatio : "16:9") as never,
          resolution: (model.options.resolutions.length > 0 &&
          ["480p", "720p", "1080p", "4k"].includes(resolution)
            ? resolution
            : "720p") as never,
          fps: model.options.fps[0] ?? 24,
          variations: 1,
        },
      },
    } as never;
  }, [model, capability, params, promptInput, durationSec, aspectRatio, resolution]);

  // Üretim öncesi canlı doğrulama + maliyet tahmini (yarım saniye gecikmeli)
  useEffect(() => {
    if (!promptReady || !model) {
      setEstimate(null);
      return;
    }
    const request = buildRequest();
    if (!request) return;
    const timer = setTimeout(() => {
      api
        .estimate(request)
        .then(setEstimate)
        .catch(() => setEstimate(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [promptReady, model, buildRequest]);

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
      // geçici hata; sonraki turda tekrar denenir
    }
  }, [projectId, onResultsChanged]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void refreshJobs(), 1500);
    return () => clearInterval(timer);
  }, [hasActive, refreshJobs]);

  async function generate() {
    const request = buildRequest();
    if (!request) return;
    setError(null);
    setSubmitting(true);
    try {
      const version = await api.createPromptVersion(projectId, promptInput, promptIdRef.current);
      promptIdRef.current = version.promptId;
      await api.createGeneration({
        projectId,
        promptVersionId: version.id,
        request,
        idempotencyKey: crypto.randomUUID(),
      });
      onJobCreated();
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

  const validationOk = estimate?.validation.ok ?? false;

  return (
    <Card title="Üretim Laboratuvarı">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Model">
            <Select
              value={modelId}
              onChange={(e) => {
                const m = models.find((x) => x.id === e.target.value);
                if (m) selectModel(m);
              }}
            >
              {providers.map((p) => (
                <optgroup key={p.providerId} label={`${p.displayName}${p.mock ? " (DEMO)" : ""}`}>
                  {p.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Yetenek">
            <Select value={capability} onChange={(e) => setCapability(e.target.value)}>
              {(model?.capabilities ?? []).map((c) => (
                <option key={c} value={c}>
                  {CAPABILITY_LABELS[c] ?? c}
                </option>
              ))}
            </Select>
          </Field>
          {model && model.options.durationsSec.length > 0 ? (
            <Field label="Süre (sn)">
              <Select value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))}>
                {model.options.durationsSec.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {model && model.options.aspectRatios.length > 0 ? (
            <Field label="En-boy oranı">
              <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                {model.options.aspectRatios.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          {model &&
          model.options.resolutions.filter((r) => ["480p", "720p", "1080p", "4k"].includes(r))
            .length > 0 ? (
            <Field label="Çözünürlük">
              <Select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                {model.options.resolutions
                  .filter((r) => ["480p", "720p", "1080p", "4k"].includes(r))
                  .map((r) => (
                    <option key={r}>{r}</option>
                  ))}
              </Select>
            </Field>
          ) : null}
          {/* Modele özgü parametreler manifestten türetilir */}
          {model
            ? Object.entries(model.params).map(([key, spec]) => (
                <Field key={key} label={spec.description ?? key}>
                  {spec.type === "enum" ? (
                    <Select
                      value={String(params[key] ?? "")}
                      onChange={(e) => setParams({ ...params, [key]: e.target.value })}
                    >
                      {(spec.values ?? []).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      type={spec.type === "string" ? "text" : "number"}
                      value={String(params[key] ?? "")}
                      min={spec.min}
                      max={spec.max}
                      step={spec.type === "integer" ? 1 : 0.05}
                      onChange={(e) =>
                        setParams({
                          ...params,
                          [key]: spec.type === "string" ? e.target.value : Number(e.target.value),
                        })
                      }
                    />
                  )}
                </Field>
              ))
            : null}
        </div>

        {provider?.mock ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Badge variant="mock">MOCK / DEMO</Badge>
            <span>
              Bu sağlayıcı gerçek AI üretimi yapmaz; akışı test etmek için yer tutucu çıktı üretir.
            </span>
          </div>
        ) : null}

        {estimate ? (
          estimate.validation.ok && estimate.estimate ? (
            <p className="text-xs text-zinc-400">
              Tahmini maliyet:{" "}
              <span className="font-semibold text-zinc-200">
                ${estimate.estimate.amount.toFixed(4)}
                {estimate.estimate.isExact ? "" : " (yaklaşık)"}
              </span>{" "}
              <span className="text-zinc-500">
                ({estimate.estimate.source} — {estimate.estimate.asOf})
              </span>
            </p>
          ) : (
            <ul className="space-y-1">
              {estimate.validation.issues.map((issue) => (
                <li key={`${issue.field}-${issue.message}`} className="text-xs text-amber-400">
                  ⚠ {issue.field}: {issue.message}
                </li>
              ))}
            </ul>
          )
        ) : null}

        {error ? <ErrorNote message={error} /> : null}

        <Button onClick={generate} disabled={!promptReady || !model || submitting || !validationOk}>
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
