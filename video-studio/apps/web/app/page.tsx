"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@studio/domain";
import { Badge, Button, Card, EmptyState, ErrorNote } from "@studio/ui";
import { api, ApiError } from "@/lib/api";

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((r) => setProjects(r.projects))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.body.userMessage : String(e)));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Projeler</h1>
        <Link href="/projects/new">
          <Button>+ Yeni Proje</Button>
        </Link>
      </div>

      {error ? <ErrorNote message={error} /> : null}
      {!error && projects === null ? <p className="text-sm text-zinc-400">Yükleniyor…</p> : null}

      {projects && projects.length === 0 ? (
        <EmptyState
          title="Henüz proje yok"
          description="Yeni Proje düğmesiyle ilk projenizi oluşturun; mock sağlayıcıyla akışı hemen deneyebilirsiniz."
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="h-full transition-colors hover:border-indigo-500">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{p.name}</h2>
                <Badge variant="info">{p.aspectRatio}</Badge>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Amaç: {p.purpose} · Hedef süre: {p.targetDurationSec} sn · {p.resolution}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Oluşturma: {new Date(p.createdAt).toLocaleString("tr-TR")}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
