import type {
  Asset,
  BibleCard,
  CanonicalGenerationRequest,
  ContinuityIssue,
  CreateBibleCardInput,
  CreateProjectInput,
  CreativeBrief,
  GenerationJob,
  Project,
  PromptTemplate,
  PromptVersion,
  RenderJob,
  Scene,
  Script,
  Sequence,
  ScriptFormat,
  UpdateSceneInput,
  UpsertBriefInput,
  VideoPromptInput,
} from "@studio/domain";
import type { EstimateResponse, ProviderManifest } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Varlık URI'sini görüntülenebilir URL'e çevirir (nesne deposu yolları API'den servis edilir). */
export function resolveAssetUrl(uri: string): string {
  return uri.startsWith("data:") ? uri : `${API_URL}${uri}`;
}

/** Medya dosyası yükler (multipart). */
export async function uploadAsset(projectId: string, file: File): Promise<Asset> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/projects/${projectId}/assets`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      code: "UNKNOWN",
      userMessage: "Yükleme başarısız oldu.",
    }))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }
  return (await response.json()) as Asset;
}

export interface ApiErrorBody {
  code: string;
  userMessage: string;
  developerMessage?: string;
  issues?: { field: string; message: string; kind: string }[];
  correlationId?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.userMessage);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, {
      code: "NETWORK_ERROR",
      userMessage: `API'ye ulaşılamıyor (${API_URL}). API sürecinin çalıştığından emin olun.`,
    });
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      code: "UNKNOWN",
      userMessage: "Bilinmeyen bir hata oluştu.",
    }))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listProjects: () => request<{ projects: Project[] }>("/projects"),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (input: CreateProjectInput) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(input) }),

  listProviders: () => request<{ providers: ProviderManifest[] }>("/providers"),

  createPromptVersion: (projectId: string, body: VideoPromptInput, promptId?: string) =>
    request<PromptVersion>(`/projects/${projectId}/prompts`, {
      method: "POST",
      body: JSON.stringify({ body, promptId }),
    }),

  createGeneration: (input: {
    projectId: string;
    promptVersionId?: string;
    request: CanonicalGenerationRequest;
    idempotencyKey: string;
  }) => request<GenerationJob>("/generations", { method: "POST", body: JSON.stringify(input) }),

  getGeneration: (id: string) => request<GenerationJob>(`/generations/${id}`),
  listGenerations: (projectId: string) =>
    request<{ jobs: GenerationJob[] }>(`/projects/${projectId}/generations`),
  cancelGeneration: (id: string) =>
    request<GenerationJob>(`/generations/${id}/cancel`, { method: "POST" }),

  listAssets: (projectId: string) => request<{ assets: Asset[] }>(`/projects/${projectId}/assets`),
  getAsset: (id: string) => request<Asset>(`/assets/${id}`),

  // ---- Faz 4: timeline + render ----
  getSequence: (projectId: string) => request<Sequence>(`/projects/${projectId}/sequence`),
  saveSequence: (projectId: string, sequence: Sequence) =>
    request<Sequence>(`/projects/${projectId}/sequence`, {
      method: "PUT",
      body: JSON.stringify({ sequence }),
    }),
  startRender: (projectId: string, preset: "480p" | "720p" | "1080p") =>
    request<RenderJob>(`/projects/${projectId}/render`, {
      method: "POST",
      body: JSON.stringify({ preset }),
    }),
  getRenderJob: (id: string) => request<RenderJob>(`/render-jobs/${id}`),

  listPromptVersions: (projectId: string) =>
    request<{ promptVersions: PromptVersion[] }>(`/projects/${projectId}/prompts`),

  estimate: (generationRequest: CanonicalGenerationRequest) =>
    request<EstimateResponse>("/estimate", {
      method: "POST",
      body: JSON.stringify({ request: generationRequest }),
    }),

  // ---- Faz 3: ön prodüksiyon ----
  getBrief: (projectId: string) => request<CreativeBrief>(`/projects/${projectId}/brief`),
  upsertBrief: (projectId: string, input: UpsertBriefInput) =>
    request<CreativeBrief>(`/projects/${projectId}/brief`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  generateScript: (projectId: string, format: ScriptFormat) =>
    request<Script>(`/projects/${projectId}/script`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }),
  listScripts: (projectId: string) =>
    request<{ scripts: Script[] }>(`/projects/${projectId}/scripts`),
  planScenes: (scriptId: string) =>
    request<{ scenes: Scene[] }>(`/scripts/${scriptId}/scenes`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  listScenes: (projectId: string) => request<{ scenes: Scene[] }>(`/projects/${projectId}/scenes`),
  updateScene: (sceneId: string, patch: UpdateSceneInput) =>
    request<Scene>(`/scenes/${sceneId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  createStoryboard: (sceneId: string, providerId: string, modelId: string) =>
    request<GenerationJob>(`/scenes/${sceneId}/storyboard`, {
      method: "POST",
      body: JSON.stringify({ providerId, modelId }),
    }),
  listBibleCards: (projectId: string) =>
    request<{ cards: BibleCard[] }>(`/projects/${projectId}/bible`),
  createBibleCard: (projectId: string, input: CreateBibleCardInput) =>
    request<BibleCard>(`/projects/${projectId}/bible`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateBibleCard: (id: string, patch: Partial<CreateBibleCardInput>) =>
    request<BibleCard>(`/bible/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteBibleCard: (id: string) => request<void>(`/bible/${id}`, { method: "DELETE" }),
  getContinuity: (projectId: string) =>
    request<{ issues: ContinuityIssue[] }>(`/projects/${projectId}/continuity`),

  listTemplates: () => request<{ templates: PromptTemplate[] }>("/templates"),
  createTemplate: (input: { name: string; description?: string; body: VideoPromptInput }) =>
    request<PromptTemplate>("/templates", { method: "POST", body: JSON.stringify(input) }),
  deleteTemplate: (id: string) => request<void>(`/templates/${id}`, { method: "DELETE" }),
};
