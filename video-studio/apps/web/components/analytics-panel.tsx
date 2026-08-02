"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorNote } from "@studio/ui";
import { api, ApiError } from "@/lib/api";
import type { ProjectAnalytics } from "@/lib/types";

/**
 * Model bazlı üretim analitiği: sayı, başarı oranı, ortalama süre, gerçek maliyet.
 * Maliyet yalnızca gerçekleşen tutarlardan gelir; tahminler bu tabloya karışmaz.
 */
export function AnalyticsPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAnalytics(await api.getAnalytics(projectId));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.body.userMessage : String(e));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <Card title="Model Analitiği">
      <div className="space-y-3">
        {error ? <ErrorNote message={error} /> : null}
        {analytics && analytics.models.length === 0 ? (
          <EmptyState title="Henüz üretim istatistiği yok" />
        ) : null}
        {analytics && analytics.models.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">İş</th>
                  <th className="py-2 pr-3 font-medium">Başarı</th>
                  <th className="py-2 pr-3 font-medium">Ort. süre</th>
                  <th className="py-2 font-medium">Gerçek maliyet</th>
                </tr>
              </thead>
              <tbody>
                {analytics.models.map((m) => (
                  <tr
                    key={`${m.providerId}-${m.modelId}`}
                    className="border-b border-zinc-800 text-zinc-300"
                  >
                    <td className="py-2 pr-3">
                      <span className="font-medium">{m.modelId}</span>{" "}
                      <span className="text-zinc-400">({m.providerId})</span>
                    </td>
                    <td className="py-2 pr-3">
                      {m.total}
                      <span className="text-zinc-400">
                        {" "}
                        ({m.succeeded}✓ {m.failed}✗)
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {m.successRate === null ? "—" : `%${Math.round(m.successRate * 100)}`}
                    </td>
                    <td className="py-2 pr-3">
                      {m.avgDurationSec === null ? "—" : `${m.avgDurationSec} sn`}
                    </td>
                    <td className="py-2">${m.totalCostUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          {analytics ? (
            <span className="text-xs text-zinc-400">Toplam {analytics.totalJobs} üretim işi</span>
          ) : (
            <span className="text-xs text-zinc-400">Yükleniyor…</span>
          )}
          <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => void load()}>
            Yenile
          </Button>
        </div>
      </div>
    </Card>
  );
}
