import type {
  Asset,
  BibleCard,
  CreativeBrief,
  GenerationJob,
  Project,
  PromptTemplate,
  PromptVersion,
  RenderJob,
  Scene,
  Script,
  Sequence,
} from "@studio/domain";
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
  private readonly briefs = new Map<string, CreativeBrief>(); // key: projectId
  private readonly scripts = new Map<string, Script>();
  private readonly scenes = new Map<string, Scene>();
  private readonly bibleCards = new Map<string, BibleCard>();

  async upsertBrief(brief: CreativeBrief): Promise<CreativeBrief> {
    this.briefs.set(brief.projectId, brief);
    return brief;
  }

  async getBrief(projectId: string): Promise<CreativeBrief | null> {
    return this.briefs.get(projectId) ?? null;
  }

  async createScript(script: Script): Promise<Script> {
    this.scripts.set(script.id, script);
    return script;
  }

  async listScripts(projectId: string): Promise<Script[]> {
    return [...this.scripts.values()]
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getScript(id: string): Promise<Script | null> {
    return this.scripts.get(id) ?? null;
  }

  async replaceScenes(scriptId: string, scenes: Scene[]): Promise<Scene[]> {
    for (const [id, scene] of this.scenes) {
      if (scene.scriptId === scriptId) this.scenes.delete(id);
    }
    for (const scene of scenes) this.scenes.set(scene.id, scene);
    return scenes;
  }

  async listScenes(projectId: string): Promise<Scene[]> {
    return [...this.scenes.values()]
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async getScene(id: string): Promise<Scene | null> {
    return this.scenes.get(id) ?? null;
  }

  async updateScene(id: string, patch: Partial<Scene>): Promise<Scene> {
    const current = this.scenes.get(id);
    if (!current) throw new Error(`Sahne bulunamadı: ${id}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.scenes.set(id, next);
    return next;
  }

  async createBibleCard(card: BibleCard): Promise<BibleCard> {
    this.bibleCards.set(card.id, card);
    return card;
  }

  async listBibleCards(projectId: string): Promise<BibleCard[]> {
    return [...this.bibleCards.values()]
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  async updateBibleCard(id: string, patch: Partial<BibleCard>): Promise<BibleCard> {
    const current = this.bibleCards.get(id);
    if (!current) throw new Error(`Kart bulunamadı: ${id}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.bibleCards.set(id, next);
    return next;
  }

  async deleteBibleCard(id: string): Promise<boolean> {
    return this.bibleCards.delete(id);
  }

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

  private readonly sequences = new Map<string, Sequence>(); // key: projectId
  private readonly renderJobs = new Map<string, RenderJob>();

  async getSequenceByProject(projectId: string): Promise<Sequence | null> {
    return this.sequences.get(projectId) ?? null;
  }

  async saveSequence(sequence: Sequence): Promise<Sequence> {
    this.sequences.set(sequence.projectId, sequence);
    return sequence;
  }

  async createRenderJob(job: RenderJob): Promise<RenderJob> {
    this.renderJobs.set(job.id, job);
    return job;
  }

  async getRenderJob(id: string): Promise<RenderJob | null> {
    return this.renderJobs.get(id) ?? null;
  }

  async listRenderJobs(projectId: string): Promise<RenderJob[]> {
    return [...this.renderJobs.values()]
      .filter((j) => j.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listRenderJobsByStatus(status: RenderJob["status"]): Promise<RenderJob[]> {
    return [...this.renderJobs.values()].filter((j) => j.status === status);
  }

  async listGenerationJobsByStatus(status: GenerationJob["status"]): Promise<GenerationJob[]> {
    return [...this.jobs.values()].filter((j) => j.status === status);
  }

  async findSceneByStoryboardJob(jobId: string): Promise<Scene | null> {
    for (const scene of this.scenes.values()) {
      if (scene.storyboardJobId === jobId) return scene;
    }
    return null;
  }

  async findSceneByNarrationJob(jobId: string): Promise<Scene | null> {
    for (const scene of this.scenes.values()) {
      if (scene.narrationJobId === jobId) return scene;
    }
    return null;
  }

  async updateRenderJob(id: string, patch: Partial<RenderJob>): Promise<RenderJob> {
    const current = this.renderJobs.get(id);
    if (!current) throw new Error(`Render işi bulunamadı: ${id}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.renderJobs.set(id, next);
    return next;
  }

  async listFinishedGenerationJobsBefore(cutoffIso: string): Promise<GenerationJob[]> {
    return [...this.jobs.values()].filter(
      (j) => j.finishedAt !== undefined && j.finishedAt < cutoffIso,
    );
  }

  async listFinishedRenderJobsBefore(cutoffIso: string): Promise<RenderJob[]> {
    return [...this.renderJobs.values()].filter(
      (j) => j.finishedAt !== undefined && j.finishedAt < cutoffIso,
    );
  }

  async deleteGenerationJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  async deleteRenderJob(id: string): Promise<boolean> {
    return this.renderJobs.delete(id);
  }

  async deleteAsset(id: string): Promise<boolean> {
    return this.assets.delete(id);
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
