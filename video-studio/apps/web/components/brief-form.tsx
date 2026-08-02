"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorNote, Field, TextArea, TextInput } from "@studio/ui";
import { api, ApiError } from "@/lib/api";

/** Yaratıcı brief formu: senaryo üretiminin girdisi. */
export function BriefForm({ projectId, onSaved }: { projectId: string; onSaved: () => void }) {
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [cta, setCta] = useState("");
  const [keyMessages, setKeyMessages] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getBrief(projectId)
      .then((b) => {
        setAudience(b.audience);
        setGoal(b.goal);
        setTone(b.tone);
        setPlatform(b.platform);
        setCta(b.cta ?? "");
        setKeyMessages(b.keyMessages.join(", "));
        setSaved(true);
      })
      .catch(() => {
        // brief henüz yok; form boş başlar
      });
  }, [projectId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.upsertBrief(projectId, {
        audience,
        goal,
        tone,
        platform,
        ...(cta.trim() ? { cta } : {}),
        keyMessages: keyMessages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.body.userMessage : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="1) Yaratıcı Brief">
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hedef kitle">
            <TextInput
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Genç profesyoneller"
              required
            />
          </Field>
          <Field label="Ton">
            <TextInput
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="samimi, enerjik"
              required
            />
          </Field>
          <Field label="Platform">
            <TextInput
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="Instagram Reels"
              required
            />
          </Field>
          <Field label="Eylem çağrısı (CTA)">
            <TextInput
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Şimdi dene"
            />
          </Field>
        </div>
        <Field label="Amaç">
          <TextArea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Yeni kahve markasını tanıtmak"
            required
            rows={2}
          />
        </Field>
        <Field label="Ana mesajlar" hint="Virgülle ayırın">
          <TextInput
            value={keyMessages}
            onChange={(e) => setKeyMessages(e.target.value)}
            placeholder="Taze kavrulmuş, Sürdürülebilir üretim"
          />
        </Field>
        {error ? <ErrorNote message={error} /> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Kaydediliyor…" : saved ? "Brief'i Güncelle" : "Brief'i Kaydet"}
        </Button>
      </form>
    </Card>
  );
}
