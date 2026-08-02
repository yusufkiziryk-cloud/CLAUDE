import type { VideoPrompt } from "@studio/domain";

/**
 * Prompt'u insan-okur düz metne derler. Deterministiktir: aynı girdi her zaman
 * aynı çıktıyı üretir (sağlayıcı compile() determinizm sözleşmesinin temeli).
 */
export function compileToText(prompt: VideoPrompt): string {
  const parts: string[] = [];

  const subject = [
    prompt.subject.description,
    prompt.subject.appearance,
    prompt.subject.emotion ? `duygu: ${prompt.subject.emotion}` : undefined,
    prompt.subject.action,
  ].filter(Boolean);
  parts.push(subject.join(", "));

  const scene = [
    prompt.scene.environment,
    prompt.scene.era,
    prompt.scene.timeOfDay,
    prompt.scene.weather,
  ].filter(Boolean);
  if (scene.length > 0) parts.push(`Sahne: ${scene.join(", ")}`);

  const camera = [
    prompt.camera.shotType,
    prompt.camera.angle,
    prompt.camera.movement ? `kamera hareketi: ${prompt.camera.movement}` : undefined,
    prompt.camera.lens,
    prompt.camera.depthOfField ? `alan derinliği: ${prompt.camera.depthOfField}` : undefined,
  ].filter(Boolean);
  if (camera.length > 0) parts.push(`Kamera: ${camera.join(", ")}`);

  const lighting = [
    prompt.lighting.type,
    prompt.lighting.direction,
    prompt.lighting.colorTemperature,
    prompt.lighting.contrast ? `kontrast: ${prompt.lighting.contrast}` : undefined,
  ].filter(Boolean);
  if (lighting.length > 0) parts.push(`Işık: ${lighting.join(", ")}`);

  const style = [prompt.style.visualStyle, prompt.style.colorPalette, prompt.style.filmLook].filter(
    Boolean,
  );
  if (style.length > 0) parts.push(`Stil: ${style.join(", ")}`);

  if (prompt.temporal.length > 0) {
    const timeline = [...prompt.temporal]
      .sort((a, b) => a.atSec - b.atSec)
      .map((t) => `${t.atSec}sn: ${t.action}`)
      .join("; ");
    parts.push(`Zaman planı: ${timeline}`);
  }

  const audio = [
    prompt.audio.dialogue ? `diyalog: ${prompt.audio.dialogue}` : undefined,
    prompt.audio.narration ? `anlatıcı: ${prompt.audio.narration}` : undefined,
    prompt.audio.ambience ? `ortam sesi: ${prompt.audio.ambience}` : undefined,
    prompt.audio.music ? `müzik: ${prompt.audio.music}` : undefined,
  ].filter(Boolean);
  if (audio.length > 0) parts.push(`Ses: ${audio.join(", ")}`);

  if (prompt.negative.length > 0) {
    parts.push(`Kaçınılacaklar: ${[...prompt.negative].sort().join(", ")}`);
  }

  return parts.join(". ");
}

/** Kanonik JSON: alan sırası sabit — diff ve sürüm karşılaştırması için güvenilir. */
export function compileToJson(prompt: VideoPrompt): string {
  return JSON.stringify(prompt, Object.keys(prompt).sort(), 2);
}
