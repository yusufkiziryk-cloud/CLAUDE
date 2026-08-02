"use client";

import { useCallback, useEffect, useState } from "react";
import type { PromptTemplate, VideoPromptInput } from "@studio/domain";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, TextInput } from "@studio/ui";
import { api, ApiError } from "@/lib/api";

/** Prompt kütüphanesi: şablon kaydetme, uygulama ve silme. */
export function TemplatePanel({
  currentPrompt,
  promptReady,
  onApply,
}: {
  currentPrompt: VideoPromptInput;
  promptReady: boolean;
  onApply: (body: VideoPromptInput) => void;
}) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTemplates((await api.listTemplates()).templates);
    } catch (e) {
      setError(e instanceof ApiError ? e.body.userMessage : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api.createTemplate({ name, body: currentPrompt });
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.body.userMessage : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteTemplate(id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.body.userMessage : String(e));
    }
  }

  return (
    <Card title="Şablonlar">
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Geçerli promptu şablon olarak kaydet">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Şablon adı, örn. Sinematik sokak"
                maxLength={200}
              />
            </Field>
          </div>
          <Button onClick={save} disabled={!promptReady || name.trim() === "" || saving}>
            Kaydet
          </Button>
        </div>

        {error ? <ErrorNote message={error} /> : null}

        {templates.length === 0 ? (
          <EmptyState
            title="Henüz şablon yok"
            description="Sık kullandığınız prompt yapılarını kaydedin."
          />
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border border-zinc-700 p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-200">{t.name}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(t.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="neutral">şablon</Badge>
                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    onClick={() => onApply(t.body)}
                  >
                    Uygula
                  </Button>
                  <Button
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    onClick={() => void remove(t.id)}
                  >
                    Sil
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
