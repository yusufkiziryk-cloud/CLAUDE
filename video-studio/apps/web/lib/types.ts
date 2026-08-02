/** API'nin /providers ucundan dönen manifest tipinin istemci tarafı görünümü. */
export interface ModelManifestView {
  id: string;
  displayName: string;
  providerId: string;
  capabilities: string[];
  options: {
    durationsSec: number[];
    resolutions: string[];
    fps: number[];
    aspectRatios: string[];
  };
  promptLimits: { maxChars: number; negativePrompt: boolean };
  pricing: { unit: string; estimatedUsd: number; asOf: string; source: string };
}

export interface ProviderManifest {
  providerId: string;
  displayName: string;
  mock: boolean;
  models: ModelManifestView[];
}
