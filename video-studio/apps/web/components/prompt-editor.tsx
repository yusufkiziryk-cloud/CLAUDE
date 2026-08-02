"use client";

import { useMemo, useState } from "react";
import type { VideoPrompt, VideoPromptInput } from "@studio/domain";
import {
  checkQuality,
  compileToText,
  createVideoPrompt,
  exportFileName,
  exportPrompt,
  parseEditableText,
  promptToEditableText,
  type PromptExportFormat,
} from "@studio/prompt-engine";
import { Badge, Button, Card, Field, Select, TextArea, TextInput } from "@studio/ui";

export interface PromptFields {
  subjectDescription: string;
  appearance: string;
  subjectEmotion: string;
  subjectAction: string;
  environment: string;
  timeOfDay: string;
  weather: string;
  era: string;
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  lens: string;
  lightType: string;
  lightingTemperature: string;
  visualStyle: string;
  colorPalette: string;
  filmLook: string;
  /** "0sn: aksiyon; 3sn: aksiyon" biçiminde */
  temporal: string;
  narration: string;
  dialogue: string;
  ambience: string;
  music: string;
  negative: string;
}

export const emptyPromptFields: PromptFields = {
  subjectDescription: "",
  appearance: "",
  subjectEmotion: "",
  subjectAction: "",
  environment: "",
  timeOfDay: "",
  weather: "",
  era: "",
  shotType: "",
  cameraAngle: "",
  cameraMovement: "",
  lens: "",
  lightType: "",
  lightingTemperature: "",
  visualStyle: "",
  colorPalette: "",
  filmLook: "",
  temporal: "",
  narration: "",
  dialogue: "",
  ambience: "",
  music: "",
  negative: "",
};

const opt = (value: string) => (value.trim() !== "" ? value : undefined);

/** Form alanlarını domain VideoPromptInput'una çevirir (boş alanlar gönderilmez). */
export function fieldsToPromptInput(fields: PromptFields): VideoPromptInput {
  const temporal = fields.temporal
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const match = /^(\d+(?:\.\d+)?)\s*sn\s*:\s*(.+)$/.exec(part);
      return match ? [{ atSec: Number(match[1]), action: match[2] as string }] : [];
    });

  return {
    subject: {
      description: fields.subjectDescription,
      ...(opt(fields.appearance) ? { appearance: fields.appearance } : {}),
      ...(opt(fields.subjectEmotion) ? { emotion: fields.subjectEmotion } : {}),
      ...(opt(fields.subjectAction) ? { action: fields.subjectAction } : {}),
    },
    scene: {
      ...(opt(fields.environment) ? { environment: fields.environment } : {}),
      ...(opt(fields.timeOfDay) ? { timeOfDay: fields.timeOfDay as never } : {}),
      ...(opt(fields.weather) ? { weather: fields.weather } : {}),
      ...(opt(fields.era) ? { era: fields.era } : {}),
    },
    camera: {
      ...(opt(fields.shotType) ? { shotType: fields.shotType as never } : {}),
      ...(opt(fields.cameraAngle) ? { angle: fields.cameraAngle } : {}),
      ...(opt(fields.cameraMovement) ? { movement: fields.cameraMovement as never } : {}),
      ...(opt(fields.lens) ? { lens: fields.lens } : {}),
    },
    lighting: {
      ...(opt(fields.lightType) ? { type: fields.lightType } : {}),
      ...(opt(fields.lightingTemperature)
        ? { colorTemperature: fields.lightingTemperature as never }
        : {}),
    },
    style: {
      ...(opt(fields.visualStyle) ? { visualStyle: fields.visualStyle } : {}),
      ...(opt(fields.colorPalette) ? { colorPalette: fields.colorPalette } : {}),
      ...(opt(fields.filmLook) ? { filmLook: fields.filmLook } : {}),
    },
    temporal,
    audio: {
      ...(opt(fields.narration) ? { narration: fields.narration } : {}),
      ...(opt(fields.dialogue) ? { dialogue: fields.dialogue } : {}),
      ...(opt(fields.ambience) ? { ambience: fields.ambience } : {}),
      ...(opt(fields.music) ? { music: fields.music } : {}),
    },
    negative: fields.negative
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** Ters yön: kaydedilmiş prompt gövdesini form alanlarına açar (sürüm/şablon yükleme). */
export function promptInputToFields(input: VideoPromptInput): PromptFields {
  return {
    subjectDescription: input.subject.description ?? "",
    appearance: input.subject.appearance ?? "",
    subjectEmotion: input.subject.emotion ?? "",
    subjectAction: input.subject.action ?? "",
    environment: input.scene?.environment ?? "",
    timeOfDay: input.scene?.timeOfDay === "belirsiz" ? "" : (input.scene?.timeOfDay ?? ""),
    weather: input.scene?.weather ?? "",
    era: input.scene?.era ?? "",
    shotType: input.camera?.shotType ?? "",
    cameraAngle: input.camera?.angle ?? "",
    cameraMovement: input.camera?.movement ?? "",
    lens: input.camera?.lens ?? "",
    lightType: input.lighting?.type ?? "",
    lightingTemperature: input.lighting?.colorTemperature ?? "",
    visualStyle: input.style?.visualStyle ?? "",
    colorPalette: input.style?.colorPalette ?? "",
    filmLook: input.style?.filmLook ?? "",
    temporal: (input.temporal ?? []).map((t) => `${t.atSec}sn: ${t.action}`).join("; "),
    narration: input.audio?.narration ?? "",
    dialogue: input.audio?.dialogue ?? "",
    ambience: input.audio?.ambience ?? "",
    music: input.audio?.music ?? "",
    negative: (input.negative ?? []).join(", "),
  };
}

const SHOT_TYPES = [
  "",
  "extreme-wide",
  "wide",
  "medium",
  "medium-close",
  "close-up",
  "extreme-close-up",
];
const MOVEMENTS = [
  "",
  "static",
  "pan",
  "tilt",
  "dolly",
  "truck",
  "crane",
  "orbit",
  "handheld",
  "steadicam",
  "drone",
  "zoom",
];
const TIMES = ["", "gündüz", "gece", "gün-batımı", "gün-doğumu"];
const TEMPS = ["", "sıcak", "soğuk", "nötr"];

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function PromptEditor({
  fields,
  onChange,
}: {
  fields: PromptFields;
  onChange: (next: PromptFields) => void;
}) {
  const [tab, setTab] = useState<"form" | "text">("form");
  const [textDraft, setTextDraft] = useState("");
  const [textWarnings, setTextWarnings] = useState<string[]>([]);

  const set = (key: keyof PromptFields) => (e: { target: { value: string } }) =>
    onChange({ ...fields, [key]: e.target.value });

  const { prompt, preview, issues, parseError } = useMemo(() => {
    if (fields.subjectDescription.trim() === "") {
      return { prompt: null as VideoPrompt | null, preview: "", issues: [], parseError: null };
    }
    try {
      const p = createVideoPrompt(fieldsToPromptInput(fields));
      return { prompt: p, preview: compileToText(p), issues: checkQuality(p), parseError: null };
    } catch (error) {
      return { prompt: null, preview: "", issues: [], parseError: String(error) };
    }
  }, [fields]);

  function openTextTab() {
    // Form → metin senkronu: geçerli form içeriği düzenlenebilir metne çevrilir.
    setTextDraft(prompt ? promptToEditableText(prompt) : "");
    setTextWarnings([]);
    setTab("text");
  }

  function applyTextToForm() {
    // Metin → form senkronu: satırlar ayrıştırılır, tanınmayanlar uyarı olur.
    const { input, warnings } = parseEditableText(textDraft);
    setTextWarnings(warnings);
    onChange(promptInputToFields(input));
    if (warnings.length === 0) setTab("form");
  }

  function doExport(format: PromptExportFormat) {
    if (!prompt) return;
    downloadText(exportFileName(format), exportPrompt(prompt, format));
  }

  return (
    <Card title="Prompt Stüdyosu (v2)">
      <div className="space-y-3">
        {/* Dışa aktarma düğmeleri tablist'in DIŞINDA: tablist yalnızca tab rolü içerebilir (a11y). */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2" role="tablist" aria-label="Editör modu">
            <Button
              variant={tab === "form" ? "primary" : "secondary"}
              role="tab"
              aria-selected={tab === "form"}
              onClick={() => setTab("form")}
            >
              Form
            </Button>
            <Button
              variant={tab === "text" ? "primary" : "secondary"}
              role="tab"
              aria-selected={tab === "text"}
              onClick={openTextTab}
            >
              Serbest Metin
            </Button>
          </div>
          <span className="ml-auto flex gap-1">
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={!prompt}
              onClick={() => doExport("json")}
            >
              JSON
            </Button>
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={!prompt}
              onClick={() => doExport("yaml")}
            >
              YAML
            </Button>
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={!prompt}
              onClick={() => doExport("text")}
            >
              TXT
            </Button>
          </span>
        </div>

        {tab === "text" ? (
          <div className="space-y-2">
            <Field
              label="Serbest metin (Etiket: değer)"
              hint="Her satır 'Etiket: değer'. Örn: Özne: koşan bir köpek — Forma Uygula ile senkronlanır."
            >
              <TextArea
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                rows={14}
                className="min-h-64 font-mono"
              />
            </Field>
            {textWarnings.length > 0 ? (
              <ul className="space-y-1">
                {textWarnings.map((w) => (
                  <li key={w} className="text-xs text-amber-400">
                    ⚠ {w}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button onClick={applyTextToForm}>Forma Uygula</Button>
          </div>
        ) : (
          <>
            <Field
              label="Özne / ana konu"
              hint="Videoda ne veya kim görünecek? En az bir cümle yazın."
            >
              <TextArea
                value={fields.subjectDescription}
                onChange={set("subjectDescription")}
                placeholder="Örn. Kırmızı yağmurluklu genç bir kadın, tarihi bir sokakta yürüyor"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duygu">
                <TextInput
                  value={fields.subjectEmotion}
                  onChange={set("subjectEmotion")}
                  placeholder="huzurlu"
                />
              </Field>
              <Field label="Aksiyon">
                <TextInput
                  value={fields.subjectAction}
                  onChange={set("subjectAction")}
                  placeholder="kameraya doğru yürüyor"
                />
              </Field>
              <Field label="Ortam / mekân">
                <TextInput
                  value={fields.environment}
                  onChange={set("environment")}
                  placeholder="arnavut kaldırımlı sokak"
                />
              </Field>
              <Field label="Günün saati">
                <Select value={fields.timeOfDay} onChange={set("timeOfDay")}>
                  {TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t === "" ? "— seçilmedi —" : t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Çekim ölçeği">
                <Select value={fields.shotType} onChange={set("shotType")}>
                  {SHOT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t === "" ? "— seçilmedi —" : t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kamera hareketi">
                <Select value={fields.cameraMovement} onChange={set("cameraMovement")}>
                  {MOVEMENTS.map((t) => (
                    <option key={t} value={t}>
                      {t === "" ? "— seçilmedi —" : t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Işık sıcaklığı">
                <Select value={fields.lightingTemperature} onChange={set("lightingTemperature")}>
                  {TEMPS.map((t) => (
                    <option key={t} value={t}>
                      {t === "" ? "— seçilmedi —" : t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Görsel stil">
                <TextInput
                  value={fields.visualStyle}
                  onChange={set("visualStyle")}
                  placeholder="sinematik, 35mm film"
                />
              </Field>
            </div>

            <details className="rounded-md border border-zinc-700 p-3">
              <summary className="cursor-pointer text-sm font-medium text-zinc-300">
                Gelişmiş alanlar (görünüm, hava, lens, zaman planı, ses…)
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Görünüm / kıyafet">
                  <TextInput value={fields.appearance} onChange={set("appearance")} />
                </Field>
                <Field label="Hava durumu">
                  <TextInput
                    value={fields.weather}
                    onChange={set("weather")}
                    placeholder="hafif yağmur"
                  />
                </Field>
                <Field label="Dönem">
                  <TextInput value={fields.era} onChange={set("era")} placeholder="1970'ler" />
                </Field>
                <Field label="Kamera açısı">
                  <TextInput
                    value={fields.cameraAngle}
                    onChange={set("cameraAngle")}
                    placeholder="alçak açı"
                  />
                </Field>
                <Field label="Lens">
                  <TextInput
                    value={fields.lens}
                    onChange={set("lens")}
                    placeholder="35mm, sığ alan derinliği"
                  />
                </Field>
                <Field label="Işık tipi">
                  <TextInput
                    value={fields.lightType}
                    onChange={set("lightType")}
                    placeholder="doğal, yumuşak"
                  />
                </Field>
                <Field label="Renk paleti">
                  <TextInput
                    value={fields.colorPalette}
                    onChange={set("colorPalette")}
                    placeholder="turuncu-teal"
                  />
                </Field>
                <Field label="Film görünümü">
                  <TextInput
                    value={fields.filmLook}
                    onChange={set("filmLook")}
                    placeholder="35mm film greni"
                  />
                </Field>
              </div>
              <div className="mt-3 space-y-3">
                <Field label="Zaman planı" hint="Noktalı virgülle ayırın: 0sn: yürür; 3sn: durur">
                  <TextInput value={fields.temporal} onChange={set("temporal")} />
                </Field>
                <Field label="Anlatıcı metni" hint="Seslendirme (TTS) üretiminde bu metin okunur.">
                  <TextArea value={fields.narration} onChange={set("narration")} rows={2} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Diyalog">
                    <TextInput value={fields.dialogue} onChange={set("dialogue")} />
                  </Field>
                  <Field label="Ortam sesi">
                    <TextInput value={fields.ambience} onChange={set("ambience")} />
                  </Field>
                  <Field label="Müzik">
                    <TextInput value={fields.music} onChange={set("music")} />
                  </Field>
                </div>
              </div>
            </details>

            <Field label="Kaçınılacaklar (negatif)" hint="Virgülle ayırın: bulanık, bozuk eller">
              <TextInput value={fields.negative} onChange={set("negative")} />
            </Field>
          </>
        )}

        {parseError ? (
          <p className="text-xs text-red-400">Prompt doğrulanamadı: {parseError}</p>
        ) : null}

        {preview && tab === "form" ? (
          <div className="rounded-md border border-zinc-700 bg-zinc-950 p-3">
            <p className="mb-1 text-xs font-semibold text-zinc-400">Derlenmiş önizleme</p>
            <p className="text-xs text-zinc-300">{preview}</p>
            <p className="mt-1 text-right text-xs text-zinc-400">{preview.length} karakter</p>
          </div>
        ) : null}

        {issues.length > 0 && tab === "form" ? (
          <ul className="space-y-1">
            {issues.map((issue) => (
              <li key={issue.code} className="flex items-center gap-2 text-xs">
                <Badge
                  variant={
                    issue.severity === "error"
                      ? "error"
                      : issue.severity === "warning"
                        ? "warning"
                        : "info"
                  }
                >
                  {issue.severity === "error"
                    ? "hata"
                    : issue.severity === "warning"
                      ? "uyarı"
                      : "bilgi"}
                </Badge>
                <span className="text-zinc-300">{issue.message}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}
