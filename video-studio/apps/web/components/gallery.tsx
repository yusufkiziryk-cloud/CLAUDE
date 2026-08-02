"use client";

import { useEffect, useState } from "react";
import type { Asset } from "@studio/domain";
import { Badge, Card, EmptyState } from "@studio/ui";
import { api, resolveAssetUrl } from "@/lib/api";

export function Gallery({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    api
      .listAssets(projectId)
      .then((r) => setAssets(r.assets))
      .catch(() => {
        // galeri yenileme hatası geçicidir; bir sonraki refreshKey'de tekrar denenir
      });
  }, [projectId, refreshKey]);

  return (
    <Card title="Sonuç Galerisi">
      {assets.length === 0 ? (
        <EmptyState
          title="Henüz üretilmiş varlık yok"
          description="Üretim Laboratuvarı'ndan bir iş başlatın; sonuçlar burada görünecek."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {assets.map((asset) => (
            <figure key={asset.id} className="overflow-hidden rounded-md border border-zinc-700">
              {asset.mimeType.startsWith("image/") ? (
                /* data: URI'ler next/image ile kullanılamaz; Faz 1'de düz img yeterli */
                <img src={resolveAssetUrl(asset.uri)} alt={asset.name} className="w-full" />
              ) : (
                <div className="p-4 text-xs text-zinc-400">{asset.mimeType}</div>
              )}
              <figcaption className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs text-zinc-300">{asset.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {asset.provenance?.mock ? <Badge variant="mock">MOCK / DEMO</Badge> : null}
                  {asset.provenance ? (
                    <Badge variant="neutral">{asset.provenance.modelId}</Badge>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Card>
  );
}
