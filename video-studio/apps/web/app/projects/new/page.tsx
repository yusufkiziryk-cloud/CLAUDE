"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorNote, Field, Select, TextInput } from "@studio/ui";
import { api, ApiError } from "@/lib/api";

const PURPOSES = [
  ["sosyal-medya", "Sosyal medya"],
  ["reklam", "Reklam"],
  ["egitim", "Eğitim"],
  ["kurumsal", "Kurumsal anlatım"],
  ["sinematik", "Sinematik kısa film"],
  ["haber", "Haber / brifing"],
  ["slayt", "Slayt / fotoğraf gösterisi"],
  ["diger", "Diğer"],
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<string>("sosyal-medya");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(30);
  const [resolution, setResolution] = useState("1080p");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const project = await api.createProject({
        name,
        purpose: purpose as never,
        aspectRatio: aspectRatio as never,
        targetDurationSec: duration,
        resolution: resolution as never,
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.userMessage : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Yeni Proje Sihirbazı</h1>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Proje adı">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ürün tanıtım videosu"
              required
              maxLength={200}
            />
          </Field>
          <Field label="Amaç">
            <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {PURPOSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="En-boy oranı">
              <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                {["16:9", "9:16", "1:1", "4:5", "21:9"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Çözünürlük">
              <Select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                {["720p", "1080p", "4k"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Hedef süre (saniye)" hint="Nihai videonun hedef uzunluğu (1–3600 sn)">
            <TextInput
              type="number"
              min={1}
              max={3600}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              required
            />
          </Field>
          {error ? <ErrorNote message={error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push("/")}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving || name.trim() === ""}>
              {saving ? "Oluşturuluyor…" : "Projeyi Oluştur"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
