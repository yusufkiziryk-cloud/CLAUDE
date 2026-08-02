"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Asset,
  CanonicalGenerationRequest,
  GenerationJob,
  VideoPromptInput,
} from "@studio/domain";
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
import { api, ApiError, resolveAssetUrl } from "@/lib/api";
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

/** İşin gerçek çalışma süresi (saniye); zaman damgaları yoksa null. */
function jobDurationSec(job: GenerationJob): number | null {
  if (!job.startedAt || !job.finishedAt) return null;
  const sec = (Date.parse(job.finishedAt) - Date.parse(job.startedAt)) / 1000;
  return sec >= 0 ? Math.round(sec * 100) / 100 : null;
}

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
  const [refreshing, setRefreshing] = useState(false);
  // Karşılaştırma modu: aynı prompt seçilen N modele gönderilir, sonuçlar yan yana izlenir.
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [compareJobIds, setCompareJobIds] = useState<string[]>([]);
  const [compareAssets, setCompareAssets] = useState<Record<string, Asset>>({});
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

  /** Manifest önbelleğini sunucuda boşaltıp model listesini tazeler. */
  async function refreshModels() {
    setRefreshing(true);
    try {
      const r = await api.refreshProviders();
      setProviders(r.providers);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.userMessage : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  /** Karşılaştırma isteği: her model kendi manifest varsayılanlarıyla derlenir. */
  const buildRequestForModel = useCallback(
    (m: ModelManifestView): CanonicalGenerationRequest => {
      const defaults: Record<string, string | number> = {};
      for (const [key, spec] of Object.entries(m.params)) {
        if (spec.default !== undefined && typeof spec.default !== "boolean")
          defaults[key] = spec.default;
      }
      return {
        capability: (m.capabilities.includes(capability) ? capability : m.capabilities[0]) as never,
        providerId: m.providerId,
        modelId: m.id,
        params: defaults,
        prompt: {
          ...promptInput,
          output: {
            durationSec: m.options.durationsSec[0] ?? 5,
            aspectRatio: (m.options.aspectRatios[0] ?? "16:9") as never,
            resolution: (m.options.resolutions.find((r) =>
              ["480p", "720p", "1080p", "4k"].includes(r),
            ) ?? "720p") as never,
            fps: m.options.fps[0] ?? 24,
            variations: 1,
          },
        },
      } as never;
    },
    [capability, promptInput],
  );

  async function runComparison() {
    const selected = models.filter((m) => compareSelection.includes(m.id));
    if (selected.length < 2) return;
    setError(null);
    setSubmitting(true);
    try {
      const version = await api.createPromptVersion(projectId, promptInput, promptIdRef.current);
      promptIdRef.current = version.promptId;
      const created = await Promise.all(
        selected.map((m) =>
          api.createGeneration({
            projectId,
            promptVersionId: version.id,
            request: buildRequestForModel(m),
            idempotencyKey: crypto.randomUUID(),
          }),
        ),
      );
      setCompareJobIds(created.map((j) => j.id));
      setCompareAssets({});
      onJobCreated();
      await refreshJobs();
    } catch (err) {
      setError(err instanceof ApiError ? err.body.userMessage : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const compareJobs = useMemo(
    () =>
      compareJobIds
        .map((id) => jobs.find((j) => j.id === id))
        .filter((j): j is GenerationJob => Boolean(j)),
    [compareJobIds, jobs],
  );

  // Biten karşılaştırma işlerinin ilk sonucu önizleme için indirilir.
  useEffect(() => {
    for (const job of compareJobs) {
      const assetId = job.resultAssetIds[0];
      if (job.status === "succeeded" && assetId && !compareAssets[assetId]) {
        api
          .getAsset(assetId)
          .then((asset) => setCompareAssets((prev) => ({ ...prev, [assetId]: asset })))
          .catch(() => {
            // önizleme yüklenemedi; durum kartı yine de gösterilir
          });
      }
    }
  }, [compareJobs, compareAssets]);

  const validationOk = estimate?.validation.ok ?? false;
  const comparableModels = models.filter((m) => m.capabilities.includes(capability));

  return (
    <Card title="Üretim Laboratuvarı">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
            />
            Karşılaştırma modu (aynı prompt, birden çok model)
          </label>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => void refreshModels()}
            disabled={refreshing}
          >
            {refreshing ? "Yenileniyor…" : "⟳ Modelleri Yenile"}
          </Button>
        </div>

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
              <span className="text-zinc-400">
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

        {compareMode ? (
          <div className="rounded-md border border-zinc-700 p-3">
            <p className="mb-2 text-xs text-zinc-400">
              Karşılaştırılacak modelleri seçin ({CAPABILITY_LABELS[capability] ?? capability}):
            </p>
            <div className="flex flex-wrap gap-3">
              {comparableModels.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={compareSelection.includes(m.id)}
                    onChange={(e) =>
                      setCompareSelection((prev) =>
                        e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                      )
                    }
                  />
                  {m.displayName}
                </label>
              ))}
            </div>
            <Button
              className="mt-3"
              onClick={() => void runComparison()}
              disabled={!promptReady || submitting || compareSelection.length < 2}
            >
              {submitting ? "Gönderiliyor…" : `⚖ Karşılaştır (${compareSelection.length} model)`}
            </Button>
            {compareSelection.length < 2 ? (
              <p className="mt-1 text-xs text-zinc-400">En az iki model seçin.</p>
            ) : null}
          </div>
        ) : (
          <Button
            onClick={generate}
            disabled={!promptReady || !model || submitting || !validationOk}
          >
            {submitting ? "Gönderiliyor…" : "▶ Üret"}
          </Button>
        )}
        {!promptReady ? (
          <p className="text-xs text-zinc-400">Üretim için önce özne alanını doldurun.</p>
        ) : null}

        {compareJobs.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-300">Karşılaştırma sonuçları</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {compareJobs.map((job) => {
                const status = STATUS_LABELS[job.status] ?? STATUS_LABELS["queued"]!;
                const duration = jobDurationSec(job);
                const assetId = job.resultAssetIds[0];
                const asset = assetId ? compareAssets[assetId] : undefined;
                return (
                  <div
                    key={job.id}
                    data-testid="compare-card"
                    className="rounded-md border border-zinc-700 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-zinc-200">
                        {job.request.modelId}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <dl className="mt-2 space-y-0.5 text-xs text-zinc-400">
                      <div className="flex justify-between">
                        <dt>Süre</dt>
                        <dd>{duration === null ? "—" : `${duration} sn`}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Maliyet</dt>
                        <dd>
                          {job.actualCostUsd !== undefined
                            ? `$${job.actualCostUsd.toFixed(4)}`
                            : job.costEstimate
                              ? `~$${job.costEstimate.amount.toFixed(4)} (tahmin)`
                              : "—"}
                        </dd>
                      </div>
                    </dl>
                    {job.status === "running" ? (
                      <div className="mt-2">
                        <ProgressBar value={job.progress} />
                      </div>
                    ) : null}
                    {asset ? (
                      <div className="mt-2">
                        {asset.mimeType.startsWith("image/") ? (
                          <img
                            src={resolveAssetUrl(asset.uri)}
                            alt={asset.name}
                            className="w-full rounded"
                          />
                        ) : asset.mimeType.startsWith("audio/") ? (
                          <audio controls src={resolveAssetUrl(asset.uri)} className="w-full" />
                        ) : (
                          <p className="text-xs text-zinc-400">{asset.mimeType}</p>
                        )}
                        {asset.provenance?.mock ? (
                          <div className="mt-1">
                            <Badge variant="mock">MOCK / DEMO</Badge>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {job.error ? (
                      <p className="mt-2 text-xs text-red-400">{job.error.userMessage}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
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
                        <span className="text-xs text-zinc-400">
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
