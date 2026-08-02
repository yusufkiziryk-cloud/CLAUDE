"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@studio/domain";
import { Badge, ErrorNote } from "@studio/ui";
import { api, ApiError } from "@/lib/api";
import { BriefForm } from "@/components/brief-form";
import { SceneBoard } from "@/components/scene-board";
import { BiblePanel } from "@/components/bible-panel";

export default function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api
      .getProject(id)
      .then(setProject)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.body.userMessage : String(e)));
  }, [id]);

  if (error) return <ErrorNote message={error} />;
  if (!project) return <p className="text-sm text-zinc-400">Yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">{project.name} — Senaryo & Storyboard</h1>
        <Badge variant="neutral">hedef {project.targetDurationSec} sn</Badge>
        <Link href={`/projects/${id}`} className="ml-auto text-sm text-indigo-400 hover:underline">
          ← Üretim Stüdyosu
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <BriefForm projectId={id} onSaved={() => setRefreshKey((k) => k + 1)} />
          <BiblePanel projectId={id} onChanged={() => setRefreshKey((k) => k + 1)} />
        </div>
        <SceneBoard projectId={id} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
