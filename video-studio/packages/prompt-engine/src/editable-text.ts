import type { VideoPrompt, VideoPromptInput } from "@studio/domain";

/**
 * Çift yönlü senkron için insan-düzenlenebilir metin formatı.
 * `Etiket: değer` satırlarından oluşur; form ↔ metin kayıpsız çevrilebilir.
 * (Sağlayıcıya giden derlenmiş prompt bundan ayrıdır — bkz. compileToText.)
 */

const LABELS = {
  subject: "Özne",
  appearance: "Görünüm",
  emotion: "Duygu",
  action: "Aksiyon",
  environment: "Sahne",
  timeOfDay: "Saat",
  weather: "Hava",
  era: "Dönem",
  shotType: "Çekim",
  cameraAngle: "Açı",
  cameraMovement: "Kamera",
  lens: "Lens",
  lightType: "Işık",
  lightTemperature: "Işık-sıcaklığı",
  visualStyle: "Stil",
  colorPalette: "Renk",
  filmLook: "Film",
  temporal: "Zaman",
  narration: "Anlatıcı",
  dialogue: "Diyalog",
  ambience: "Ortam-sesi",
  music: "Müzik",
  negative: "Negatif",
} as const;

export function promptToEditableText(prompt: VideoPrompt): string {
  const lines: string[] = [];
  const add = (label: string, value: string | undefined) => {
    if (value && value.trim() !== "") lines.push(`${label}: ${value}`);
  };

  add(LABELS.subject, prompt.subject.description);
  add(LABELS.appearance, prompt.subject.appearance);
  add(LABELS.emotion, prompt.subject.emotion);
  add(LABELS.action, prompt.subject.action);
  add(LABELS.environment, prompt.scene.environment);
  add(LABELS.timeOfDay, prompt.scene.timeOfDay === "belirsiz" ? undefined : prompt.scene.timeOfDay);
  add(LABELS.weather, prompt.scene.weather);
  add(LABELS.era, prompt.scene.era);
  add(LABELS.shotType, prompt.camera.shotType);
  add(LABELS.cameraAngle, prompt.camera.angle);
  add(LABELS.cameraMovement, prompt.camera.movement);
  add(LABELS.lens, prompt.camera.lens);
  add(LABELS.lightType, prompt.lighting.type);
  add(LABELS.lightTemperature, prompt.lighting.colorTemperature);
  add(LABELS.visualStyle, prompt.style.visualStyle);
  add(LABELS.colorPalette, prompt.style.colorPalette);
  add(LABELS.filmLook, prompt.style.filmLook);
  if (prompt.temporal.length > 0) {
    add(
      LABELS.temporal,
      [...prompt.temporal]
        .sort((a, b) => a.atSec - b.atSec)
        .map((t) => `${t.atSec}sn: ${t.action}`)
        .join("; "),
    );
  }
  add(LABELS.narration, prompt.audio.narration);
  add(LABELS.dialogue, prompt.audio.dialogue);
  add(LABELS.ambience, prompt.audio.ambience);
  add(LABELS.music, prompt.audio.music);
  if (prompt.negative.length > 0) add(LABELS.negative, prompt.negative.join(", "));

  return lines.join("\n");
}

export interface ParsedEditableText {
  input: VideoPromptInput;
  /** Tanınmayan satırlar sessizce yutulmaz; uyarı olarak döner. */
  warnings: string[];
}

export function parseEditableText(text: string): ParsedEditableText {
  const warnings: string[] = [];
  const values = new Map<string, string>();

  for (const [index, rawLine] of text.split("\n").entries()) {
    const line = rawLine.trim();
    if (line === "") continue;
    const separator = line.indexOf(":");
    if (separator === -1) {
      warnings.push(
        `Satır ${index + 1} anlaşılamadı (Etiket: değer bekleniyor): "${line.slice(0, 60)}"`,
      );
      continue;
    }
    const label = line.slice(0, separator).trim().toLocaleLowerCase("tr");
    const value = line.slice(separator + 1).trim();
    const known = Object.values(LABELS).find((l) => l.toLocaleLowerCase("tr") === label);
    if (!known) {
      warnings.push(`Satır ${index + 1}: bilinmeyen etiket "${line.slice(0, separator)}"`);
      continue;
    }
    values.set(known, value);
  }

  const get = (label: string) => values.get(label);

  const temporal = (get(LABELS.temporal) ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const match = /^(\d+(?:\.\d+)?)\s*sn\s*:\s*(.+)$/.exec(part);
      if (!match) {
        warnings.push(`Zaman planı öğesi anlaşılamadı: "${part}" ("3sn: aksiyon" bekleniyor)`);
        return [];
      }
      return [{ atSec: Number(match[1]), action: match[2] as string }];
    });

  const input: VideoPromptInput = {
    subject: {
      description: get(LABELS.subject) ?? "",
      ...(get(LABELS.appearance) ? { appearance: get(LABELS.appearance) as string } : {}),
      ...(get(LABELS.emotion) ? { emotion: get(LABELS.emotion) as string } : {}),
      ...(get(LABELS.action) ? { action: get(LABELS.action) as string } : {}),
    },
    scene: {
      ...(get(LABELS.environment) ? { environment: get(LABELS.environment) as string } : {}),
      ...(get(LABELS.timeOfDay) ? { timeOfDay: get(LABELS.timeOfDay) as never } : {}),
      ...(get(LABELS.weather) ? { weather: get(LABELS.weather) as string } : {}),
      ...(get(LABELS.era) ? { era: get(LABELS.era) as string } : {}),
    },
    camera: {
      ...(get(LABELS.shotType) ? { shotType: get(LABELS.shotType) as never } : {}),
      ...(get(LABELS.cameraAngle) ? { angle: get(LABELS.cameraAngle) as string } : {}),
      ...(get(LABELS.cameraMovement) ? { movement: get(LABELS.cameraMovement) as never } : {}),
      ...(get(LABELS.lens) ? { lens: get(LABELS.lens) as string } : {}),
    },
    lighting: {
      ...(get(LABELS.lightType) ? { type: get(LABELS.lightType) as string } : {}),
      ...(get(LABELS.lightTemperature)
        ? { colorTemperature: get(LABELS.lightTemperature) as never }
        : {}),
    },
    style: {
      ...(get(LABELS.visualStyle) ? { visualStyle: get(LABELS.visualStyle) as string } : {}),
      ...(get(LABELS.colorPalette) ? { colorPalette: get(LABELS.colorPalette) as string } : {}),
      ...(get(LABELS.filmLook) ? { filmLook: get(LABELS.filmLook) as string } : {}),
    },
    temporal,
    audio: {
      ...(get(LABELS.narration) ? { narration: get(LABELS.narration) as string } : {}),
      ...(get(LABELS.dialogue) ? { dialogue: get(LABELS.dialogue) as string } : {}),
      ...(get(LABELS.ambience) ? { ambience: get(LABELS.ambience) as string } : {}),
      ...(get(LABELS.music) ? { music: get(LABELS.music) as string } : {}),
    },
    negative: (get(LABELS.negative) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };

  return { input, warnings };
}
