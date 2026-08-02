"use client";

import { use, useEffect, useMemo, useState } from "react";
import type { Project, VideoPromptInput } from "@studio/domain";
import { Badge, ErrorNote } from "@studio/ui";
import { api, ApiError } from "@/lib/api";
import {
  PromptEditor,
  emptyPromptFields,
  fieldsToPromptInput,
  promptInputToFields,
  type PromptFields,
} from "@/components/prompt-editor";
import { GenerationLab } from "@/components/generation-lab";
import { Gallery } from "@/components/gallery";
import { TemplatePanel } from "@/components/template-panel";
import { VersionHistory } from "@/components/version-history";

export default function ProjectStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<PromptFields>(emptyPromptFields);
  const [galleryKey, setGalleryKey] = useState(0);
  const [versionKey, setVersionKey] = useState(0);

  useEffect(() => {
    api
      .getProject(id)
      .then(setProject)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.body.userMessage : String(e)));
  }, [id]);

  const promptInput = useMemo(() => fieldsToPromptInput(fields), [fields]);
  const promptReady = fields.subjectDescription.trim().length > 0;

  function loadPromptBody(body: VideoPromptInput) {
    setFields(promptInputToFields(body));
  }

  if (error) return <ErrorNote message={error} />;
  if (!project) return <p className="text-sm text-zinc-400">Yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">{project.name}</h1>
        <Badge variant="info">{project.aspectRatio}</Badge>
        <Badge variant="neutral">{project.resolution}</Badge>
        <Badge variant="neutral">hedef {project.targetDurationSec} sn</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <PromptEditor fields={fields} onChange={setFields} />
          <TemplatePanel
            currentPrompt={promptInput}
            promptReady={promptReady}
            onApply={loadPromptBody}
          />
        </div>
        <div className="space-y-4">
          <GenerationLab
            projectId={id}
            promptInput={promptInput}
            promptReady={promptReady}
            onResultsChanged={() => setGalleryKey((k) => k + 1)}
            onJobCreated={() => setVersionKey((k) => k + 1)}
          />
          <VersionHistory projectId={id} refreshKey={versionKey} onLoad={loadPromptBody} />
        </div>
      </div>

      <Gallery projectId={id} refreshKey={galleryKey} />
    </div>
  );
}
