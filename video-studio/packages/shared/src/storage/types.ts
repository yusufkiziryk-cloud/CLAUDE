import type {
  Asset,
  BibleCard,
  CreativeBrief,
  GenerationJob,
  GenerationJobStatus,
  Project,
  PromptTemplate,
  PromptVersion,
  RenderJob,
  Scene,
  Script,
  Sequence,
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

  // Prompt şablonları (kütüphane)
  createPromptTemplate(template: PromptTemplate): Promise<PromptTemplate>;
  listPromptTemplates(): Promise<PromptTemplate[]>;
  deletePromptTemplate(id: string): Promise<boolean>;

  // Yaratıcı ön prodüksiyon (Faz 3)
  upsertBrief(brief: CreativeBrief): Promise<CreativeBrief>;
  getBrief(projectId: string): Promise<CreativeBrief | null>;
  createScript(script: Script): Promise<Script>;
  listScripts(projectId: string): Promise<Script[]>;
  getScript(id: string): Promise<Script | null>;
  /** Bir senaryonun sahne setini atomik olarak değiştirir (yeniden planlama). */
  replaceScenes(scriptId: string, scenes: Scene[]): Promise<Scene[]>;
  listScenes(projectId: string): Promise<Scene[]>;
  getScene(id: string): Promise<Scene | null>;
  updateScene(id: string, patch: Partial<Scene>): Promise<Scene>;
  createBibleCard(card: BibleCard): Promise<BibleCard>;
  listBibleCards(projectId: string): Promise<BibleCard[]>;
  updateBibleCard(id: string, patch: Partial<BibleCard>): Promise<BibleCard>;
  deleteBibleCard(id: string): Promise<boolean>;

  // Timeline (Faz 4) — MVP'de proje başına tek ana sequence
  getSequenceByProject(projectId: string): Promise<Sequence | null>;
  saveSequence(sequence: Sequence): Promise<Sequence>;
  createRenderJob(job: RenderJob): Promise<RenderJob>;
  getRenderJob(id: string): Promise<RenderJob | null>;
  listRenderJobs(projectId: string): Promise<RenderJob[]>;
  listRenderJobsByStatus(status: RenderJob["status"]): Promise<RenderJob[]>;
  updateRenderJob(id: string, patch: Partial<RenderJob>): Promise<RenderJob>;

  // Crash recovery + sunucu tarafı bağlama
  listGenerationJobsByStatus(status: GenerationJobStatus): Promise<GenerationJob[]>;
  findSceneByStoryboardJob(jobId: string): Promise<Scene | null>;
  findSceneByNarrationJob(jobId: string): Promise<Scene | null>;

  // Veri saklama (Faz 8): süpürücünün kullandığı sorgu + silme işlemleri
  listFinishedGenerationJobsBefore(cutoffIso: string): Promise<GenerationJob[]>;
  listFinishedRenderJobsBefore(cutoffIso: string): Promise<RenderJob[]>;
  deleteGenerationJob(id: string): Promise<boolean>;
  deleteRenderJob(id: string): Promise<boolean>;
  deleteAsset(id: string): Promise<boolean>;

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
