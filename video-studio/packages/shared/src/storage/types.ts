import type {
  Asset,
  GenerationJob,
  GenerationJobStatus,
  Project,
  PromptVersion,
} from "@studio/domain";

/**
 * Kalıcılık sözleşmesi. İki sürücü vardır:
 *  - memory: harici servis gerektirmez (geliştirme ve test)
 *  - prisma: PostgreSQL (docker compose ile)
 * İş mantığı yalnızca bu arayüzü bilir.
 */
export interface StorageDriver {
  // Projeler
  createProject(project: Project): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  updateProject(id: string, patch: Partial<Project>): Promise<Project>;

  // Prompt sürümleri
  createPromptVersion(version: PromptVersion): Promise<PromptVersion>;
  listPromptVersions(projectId: string): Promise<PromptVersion[]>;
  getPromptVersion(id: string): Promise<PromptVersion | null>;

  // Varlıklar
  createAsset(asset: Asset): Promise<Asset>;
  getAsset(id: string): Promise<Asset | null>;
  listAssets(projectId: string): Promise<Asset[]>;

  // Üretim işleri
  createGenerationJob(job: GenerationJob): Promise<GenerationJob>;
  getGenerationJob(id: string): Promise<GenerationJob | null>;
  findJobByIdempotencyKey(key: string): Promise<GenerationJob | null>;
  listGenerationJobs(projectId: string): Promise<GenerationJob[]>;
  updateGenerationJob(
    id: string,
    patch: Partial<
      Pick<
        GenerationJob,
        | "status"
        | "progress"
        | "error"
        | "resultAssetIds"
        | "actualCostUsd"
        | "startedAt"
        | "finishedAt"
        | "updatedAt"
      >
    >,
  ): Promise<GenerationJob>;
}

export type { GenerationJobStatus };
