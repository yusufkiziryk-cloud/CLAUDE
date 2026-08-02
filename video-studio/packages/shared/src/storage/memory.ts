import type { Asset, GenerationJob, Project, PromptTemplate, PromptVersion } from "@studio/domain";
import type { StorageDriver } from "./types.js";

/** Harici servis gerektirmeyen geliştirme/test sürücüsü. Süreç yeniden başlayınca veri silinir. */
export class MemoryStorageDriver implements StorageDriver {
  private readonly projects = new Map<string, Project>();
  private readonly promptVersions = new Map<string, PromptVersion>();
  private readonly assets = new Map<string, Asset>();
  private readonly jobs = new Map<string, GenerationJob>();

  async createProject(project: Project): Promise<Project> {
    this.projects.set(project.id, project);
    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    const p = this.projects.get(id);
    return p && p.deletedAt === null ? p : null;
  }

  async listProjects(): Promise<Project[]> {
    return [...this.projects.values()]
      .filter((p) => p.deletedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    const current = this.projects.get(id);
    if (!current) throw new Error(`Proje bulunamadı: ${id}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.projects.set(id, next);
    return next;
  }

  async createPromptVersion(version: PromptVersion): Promise<PromptVersion> {
    this.promptVersions.set(version.id, version);
    return version;
  }

  async listPromptVersions(projectId: string): Promise<PromptVersion[]> {
    return [...this.promptVersions.values()]
      .filter((v) => v.projectId === projectId)
      .sort((a, b) => b.version - a.version);
  }

  async getPromptVersion(id: string): Promise<PromptVersion | null> {
    return this.promptVersions.get(id) ?? null;
  }

  async createAsset(asset: Asset): Promise<Asset> {
    this.assets.set(asset.id, asset);
    return asset;
  }

  async getAsset(id: string): Promise<Asset | null> {
    return this.assets.get(id) ?? null;
  }

  async listAssets(projectId: string): Promise<Asset[]> {
    return [...this.assets.values()]
      .filter((a) => a.projectId === projectId && a.deletedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private readonly templates = new Map<string, PromptTemplate>();

  async createPromptTemplate(template: PromptTemplate): Promise<PromptTemplate> {
    this.templates.set(template.id, template);
    return template;
  }

  async listPromptTemplates(): Promise<PromptTemplate[]> {
    return [...this.templates.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deletePromptTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  async createGenerationJob(job: GenerationJob): Promise<GenerationJob> {
    this.jobs.set(job.id, job);
    return job;
  }

  async getGenerationJob(id: string): Promise<GenerationJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async findJobByIdempotencyKey(key: string): Promise<GenerationJob | null> {
    for (const job of this.jobs.values()) {
      if (job.idempotencyKey === key) return job;
    }
    return null;
  }

  async listGenerationJobs(projectId: string): Promise<GenerationJob[]> {
    return [...this.jobs.values()]
      .filter((j) => j.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateGenerationJob(
    id: string,
    patch: Parameters<StorageDriver["updateGenerationJob"]>[1],
  ): Promise<GenerationJob> {
    const current = this.jobs.get(id);
    if (!current) throw new Error(`Üretim işi bulunamadı: ${id}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.jobs.set(id, next);
    return next;
  }
}
