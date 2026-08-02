export interface ParamSpecView {
  type: "number" | "integer" | "string" | "boolean" | "enum";
  min?: number;
  max?: number;
  values?: string[];
  default?: number | string | boolean;
  description?: string;
}

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
  params: Record<string, ParamSpecView>;
  pricing: { unit: string; estimatedUsd: number; asOf: string; source: string };
}

export interface EstimateResponse {
  validation: { ok: boolean; issues: { field: string; message: string; kind: string }[] };
  estimate: {
    currency: string;
    amount: number;
    source: string;
    asOf: string;
    isExact: boolean;
  } | null;
}

export interface ProviderManifest {
  providerId: string;
  displayName: string;
  mock: boolean;
  models: ModelManifestView[];
}
