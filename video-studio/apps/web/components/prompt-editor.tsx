"use client";

import { useMemo } from "react";
import type { VideoPromptInput } from "@studio/domain";
import { checkQuality, compileToText, createVideoPrompt } from "@studio/prompt-engine";
import { Badge, Card, Field, Select, TextArea, TextInput } from "@studio/ui";

export interface PromptFields {
  subjectDescription: string;
  subjectEmotion: string;
  subjectAction: string;
  environment: string;
  timeOfDay: string;
  shotType: string;
  cameraMovement: string;
  lightingTemperature: string;
  visualStyle: string;
  negative: string;
}

export const emptyPromptFields: PromptFields = {
  subjectDescription: "",
  subjectEmotion: "",
  subjectAction: "",
  environment: "",
  timeOfDay: "",
  shotType: "",
  cameraMovement: "",
  lightingTemperature: "",
  visualStyle: "",
  negative: "",
};

/** Form alanlarını domain VideoPromptInput'una çevirir (boş alanlar gönderilmez). */
export function fieldsToPromptInput(fields: PromptFields): VideoPromptInput {
  return {
    subject: {
      description: fields.subjectDescription,
      ...(fields.subjectEmotion ? { emotion: fields.subjectEmotion } : {}),
      ...(fields.subjectAction ? { action: fields.subjectAction } : {}),
    },
    scene: {
      ...(fields.environment ? { environment: fields.environment } : {}),
      ...(fields.timeOfDay ? { timeOfDay: fields.timeOfDay as never } : {}),
    },
    camera: {
      ...(fields.shotType ? { shotType: fields.shotType as never } : {}),
      ...(fields.cameraMovement ? { movement: fields.cameraMovement as never } : {}),
    },
    lighting: {
      ...(fields.lightingTemperature
        ? { colorTemperature: fields.lightingTemperature as never }
        : {}),
    },
    style: {
      ...(fields.visualStyle ? { visualStyle: fields.visualStyle } : {}),
    },
    negative: fields.negative
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
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

export function PromptEditor({
  fields,
  onChange,
}: {
  fields: PromptFields;
  onChange: (next: PromptFields) => void;
}) {
  const set = (key: keyof PromptFields) => (e: { target: { value: string } }) =>
    onChange({ ...fields, [key]: e.target.value });

  const { preview, issues, parseError } = useMemo(() => {
    if (fields.subjectDescription.trim() === "") {
      return { preview: "", issues: [], parseError: null };
    }
    try {
      const prompt = createVideoPrompt(fieldsToPromptInput(fields));
      return { preview: compileToText(prompt), issues: checkQuality(prompt), parseError: null };
    } catch (error) {
      return { preview: "", issues: [], parseError: String(error) };
    }
  }, [fields]);

  return (
    <Card title="Prompt Stüdyosu (v1)">
      <div className="space-y-3">
        <Field label="Özne / ana konu" hint="Videoda ne veya kim görünecek? En az bir cümle yazın.">
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
        <Field label="Kaçınılacaklar (negatif)" hint="Virgülle ayırın: bulanık, bozuk eller">
          <TextInput value={fields.negative} onChange={set("negative")} />
        </Field>

        {parseError ? (
          <p className="text-xs text-red-400">Prompt doğrulanamadı: {parseError}</p>
        ) : null}

        {preview ? (
          <div className="rounded-md border border-zinc-700 bg-zinc-950 p-3">
            <p className="mb-1 text-xs font-semibold text-zinc-400">Derlenmiş önizleme</p>
            <p className="text-xs text-zinc-300">{preview}</p>
            <p className="mt-1 text-right text-xs text-zinc-500">{preview.length} karakter</p>
          </div>
        ) : null}

        {issues.length > 0 ? (
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
