import { VideoPromptSchema, type VideoPrompt, type VideoPromptInput } from "@studio/domain";

/** Girdiyi doğrulayıp varsayılanları uygulanmış tam bir VideoPrompt döndürür. */
export function createVideoPrompt(input: VideoPromptInput): VideoPrompt {
  return VideoPromptSchema.parse(input);
}

/** Kısmi güncelleme: mevcut prompt üzerine yamayı uygular ve yeniden doğrular. */
export function updateVideoPrompt(
  current: VideoPrompt,
  patch: Partial<VideoPromptInput>,
): VideoPrompt {
  return VideoPromptSchema.parse({ ...current, ...patch });
}
