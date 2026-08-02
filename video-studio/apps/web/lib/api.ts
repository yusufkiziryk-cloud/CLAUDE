import type {
  Asset,
  CanonicalGenerationRequest,
  CreateProjectInput,
  GenerationJob,
  Project,
  PromptTemplate,
  PromptVersion,
  VideoPromptInput,
} from "@studio/domain";
import type { EstimateResponse, ProviderManifest } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

  listPromptVersions: (projectId: string) =>
    request<{ promptVersions: PromptVersion[] }>(`/projects/${projectId}/prompts`),

  estimate: (generationRequest: CanonicalGenerationRequest) =>
    request<EstimateResponse>("/estimate", {
      method: "POST",
      body: JSON.stringify({ request: generationRequest }),
    }),

  listTemplates: () => request<{ templates: PromptTemplate[] }>("/templates"),
  createTemplate: (input: { name: string; description?: string; body: VideoPromptInput }) =>
    request<PromptTemplate>("/templates", { method: "POST", body: JSON.stringify(input) }),
  deleteTemplate: (id: string) => request<void>(`/templates/${id}`, { method: "DELETE" }),
};
