import { VideoPromptSchema, type CanonicalGenerationRequest } from "@studio/domain";

/** Contract testlerinde kullanılan örnek kanonik istek. */
export function sampleGenerationRequest(
  overrides: Partial<CanonicalGenerationRequest> = {},
): CanonicalGenerationRequest {
  return {
    capability: "textToVideo",
    providerId: "mock",
    modelId: "mock-video-fast",
    prompt: VideoPromptSchema.parse({
      subject: { description: "Gün batımında sahilde koşan bir köpek" },
      scene: { environment: "kumsal", timeOfDay: "gün-batımı" },
      camera: { shotType: "wide", movement: "pan" },
      output: { aspectRatio: "16:9", durationSec: 5, fps: 24, resolution: "720p" },
    }),
    ...overrides,
  };
}
