import { PrismaClient } from "@prisma/client";
import {
  AssetSchema,
  BibleCardSchema,
  CreativeBriefSchema,
  GenerationJobSchema,
  ProjectSchema,
  PromptTemplateSchema,
  PromptVersionSchema,
  SceneSchema,
  ScriptSchema,
  type Asset,
  type BibleCard,
  type CreativeBrief,
  type GenerationJob,
  type Project,
  type PromptTemplate,
  type PromptVersion,
  RenderJobSchema,
  SequenceSchema,
  type RenderJob,
  type Scene,
  type Script,
  type Sequence,
} from "@studio/domain";
import type { StorageDriver } from "./types.js";

/**
 * PostgreSQL sürücüsü (Prisma). QUEUE_DRIVER=redis modunda zorunludur çünkü
 * API ve worker ayrı süreçlerdir ve durumu paylaşmalıdır.
 * Bu modül yalnızca STORAGE_DRIVER=prisma iken dinamik import edilir.
 */
export class PrismaStorageDriver implements StorageDriver {
  constructor(private readonly db: PrismaClient = new PrismaClient()) {}

  async createProject(project: Project): Promise<Project> {
    const row = await this.db.project.create({ data: toProjectRow(project) });
    return fromProjectRow(row);
  }

  async getProject(id: string): Promise<Project | null> {
    const row = await this.db.project.findFirst({ where: { id, deletedAt: null } });
    return row ? fromProjectRow(row) : null;
  }

  async listProjects(): Promise<Project[]> {
    const rows = await this.db.project.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(fromProjectRow);
  }

  async updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    const data: Record<string, unknown> = { ...patch };
    delete data["id"];
    delete data["createdAt"];
    delete data["updatedAt"];
    if (typeof patch.deletedAt === "string") data["deletedAt"] = new Date(patch.deletedAt);
    const row = await this.db.project.update({ where: { id }, data });
    return fromProjectRow(row);
  }

  async createPromptVersion(version: PromptVersion): Promise<PromptVersion> {
    const row = await this.db.promptVersion.create({
      data: {
        id: version.id,
        promptId: version.promptId,
        projectId: version.projectId,
        version: version.version,
        language: version.language,
        body: version.body as object,
        createdAt: new Date(version.createdAt),
      },
    });
    return fromPromptVersionRow(row);
  }

  async listPromptVersions(projectId: string): Promise<PromptVersion[]> {
    const rows = await this.db.promptVersion.findMany({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    return rows.map(fromPromptVersionRow);
  }

  async getPromptVersion(id: string): Promise<PromptVersion | null> {
    const row = await this.db.promptVersion.findUnique({ where: { id } });
    return row ? fromPromptVersionRow(row) : null;
  }

  async createAsset(asset: Asset): Promise<Asset> {
    const row = await this.db.asset.create({
      data: {
        id: asset.id,
        projectId: asset.projectId,
        kind: asset.kind,
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        sha256: asset.sha256 ?? null,
        durationSec: asset.durationSec ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
        thumbnailUri: asset.thumbnailUri ?? null,
        ...(asset.provenance ? { provenance: asset.provenance as object } : {}),
        createdAt: new Date(asset.createdAt),
      },
    });
    return fromAssetRow(row);
  }

  async getAsset(id: string): Promise<Asset | null> {
    const row = await this.db.asset.findUnique({ where: { id } });
    return row ? fromAssetRow(row) : null;
  }

  async listAssets(projectId: string): Promise<Asset[]> {
    const rows = await this.db.asset.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(fromAssetRow);
  }

  async createPromptTemplate(template: PromptTemplate): Promise<PromptTemplate> {
    const row = await this.db.promptTemplate.create({
      data: {
        id: template.id,
        name: template.name,
        description: template.description ?? null,
        body: template.body as object,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt),
      },
    });
    return fromTemplateRow(row);
  }

  async listPromptTemplates(): Promise<PromptTemplate[]> {
    const rows = await this.db.promptTemplate.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(fromTemplateRow);
  }

  async deletePromptTemplate(id: string): Promise<boolean> {
    try {
      await this.db.promptTemplate.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async upsertBrief(brief: CreativeBrief): Promise<CreativeBrief> {
    const data = {
      audience: brief.audience,
      goal: brief.goal,
      tone: brief.tone,
      platform: brief.platform,
      cta: brief.cta ?? null,
      keyMessages: brief.keyMessages,
      notes: brief.notes ?? null,
    };
    const row = await this.db.creativeBrief.upsert({
      where: { projectId: brief.projectId },
      create: { id: brief.id, projectId: brief.projectId, ...data },
      update: data,
    });
    return fromBriefRow(row);
  }

  async getBrief(projectId: string): Promise<CreativeBrief | null> {
    const row = await this.db.creativeBrief.findUnique({ where: { projectId } });
    return row ? fromBriefRow(row) : null;
  }

  async createScript(script: Script): Promise<Script> {
    const row = await this.db.script.create({
      data: {
        id: script.id,
        projectId: script.projectId,
        briefId: script.briefId ?? null,
        format: script.format,
        generator: script.generator,
        title: script.title,
        sections: script.sections as object[],
        createdAt: new Date(script.createdAt),
      },
    });
    return fromScriptRow(row);
  }

  async listScripts(projectId: string): Promise<Script[]> {
    const rows = await this.db.script.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(fromScriptRow);
  }

  async getScript(id: string): Promise<Script | null> {
    const row = await this.db.script.findUnique({ where: { id } });
    return row ? fromScriptRow(row) : null;
  }

  async replaceScenes(scriptId: string, scenes: Scene[]): Promise<Scene[]> {
    await this.db.$transaction([
      this.db.scene.deleteMany({ where: { scriptId } }),
      this.db.scene.createMany({ data: scenes.map(toSceneRow) }),
    ]);
    return scenes;
  }

  async listScenes(projectId: string): Promise<Scene[]> {
    const rows = await this.db.scene.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
    return rows.map(fromSceneRow);
  }

  async getScene(id: string): Promise<Scene | null> {
    const row = await this.db.scene.findUnique({ where: { id } });
    return row ? fromSceneRow(row) : null;
  }

  async updateScene(id: string, patch: Partial<Scene>): Promise<Scene> {
    const data: Record<string, unknown> = {};
    for (const key of [
      "title",
      "summary",
      "narration",
      "durationSec",
      "locationName",
      "timeOfDay",
      "characterNames",
      "storyboardJobId",
      "storyboardAssetId",
      "narrationJobId",
      "narrationAssetId",
    ] as const) {
      if (patch[key] !== undefined) data[key] = patch[key];
    }
    if (patch.prompt !== undefined) data["prompt"] = patch.prompt as object;
    const row = await this.db.scene.update({ where: { id }, data });
    return fromSceneRow(row);
  }

  async createBibleCard(card: BibleCard): Promise<BibleCard> {
    const row = await this.db.bibleCard.create({
      data: {
        id: card.id,
        projectId: card.projectId,
        kind: card.kind,
        name: card.name,
        description: card.description,
        promptFragment: card.promptFragment ?? null,
        isRealPerson: card.isRealPerson,
        consentConfirmed: card.consentConfirmed,
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt),
      },
    });
    return fromBibleRow(row);
  }

  async listBibleCards(projectId: string): Promise<BibleCard[]> {
    const rows = await this.db.bibleCard.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
    return rows.map(fromBibleRow);
  }

  async updateBibleCard(id: string, patch: Partial<BibleCard>): Promise<BibleCard> {
    const data: Record<string, unknown> = {};
    for (const key of [
      "name",
      "description",
      "promptFragment",
      "isRealPerson",
      "consentConfirmed",
    ] as const) {
      if (patch[key] !== undefined) data[key] = patch[key];
    }
    const row = await this.db.bibleCard.update({ where: { id }, data });
    return fromBibleRow(row);
  }

  async deleteBibleCard(id: string): Promise<boolean> {
    try {
      await this.db.bibleCard.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getSequenceByProject(projectId: string): Promise<Sequence | null> {
    const row = await this.db.sequence.findUnique({ where: { projectId } });
    return row ? fromSequenceRow(row) : null;
  }

  async saveSequence(sequence: Sequence): Promise<Sequence> {
    const data = {
      name: sequence.name,
      fps: sequence.fps,
      width: sequence.width,
      height: sequence.height,
      tracks: sequence.tracks as object[],
    };
    const row = await this.db.sequence.upsert({
      where: { projectId: sequence.projectId },
      create: { id: sequence.id, projectId: sequence.projectId, ...data },
      update: data,
    });
    return fromSequenceRow(row);
  }

  async createRenderJob(job: RenderJob): Promise<RenderJob> {
    const row = await this.db.renderJob.create({
      data: {
        id: job.id,
        projectId: job.projectId,
        sequenceId: job.sequenceId,
        preset: job.preset,
        status: job.status,
        progress: job.progress,
        ...(job.error ? { error: job.error as object } : {}),
        outputPath: job.outputPath ?? null,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt),
      },
    });
    return fromRenderJobRow(row);
  }

  async getRenderJob(id: string): Promise<RenderJob | null> {
    const row = await this.db.renderJob.findUnique({ where: { id } });
    return row ? fromRenderJobRow(row) : null;
  }

  async listRenderJobs(projectId: string): Promise<RenderJob[]> {
    const rows = await this.db.renderJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(fromRenderJobRow);
  }

  async listRenderJobsByStatus(status: RenderJob["status"]): Promise<RenderJob[]> {
    const rows = await this.db.renderJob.findMany({ where: { status } });
    return rows.map(fromRenderJobRow);
  }

  async listGenerationJobsByStatus(status: GenerationJob["status"]): Promise<GenerationJob[]> {
    const rows = await this.db.generationJob.findMany({ where: { status } });
    return rows.map(fromJobRow);
  }

  async findSceneByStoryboardJob(jobId: string): Promise<Scene | null> {
    const row = await this.db.scene.findFirst({ where: { storyboardJobId: jobId } });
    return row ? fromSceneRow(row) : null;
  }

  async findSceneByNarrationJob(jobId: string): Promise<Scene | null> {
    const row = await this.db.scene.findFirst({ where: { narrationJobId: jobId } });
    return row ? fromSceneRow(row) : null;
  }

  async updateRenderJob(id: string, patch: Partial<RenderJob>): Promise<RenderJob> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data["status"] = patch.status;
    if (patch.progress !== undefined) data["progress"] = Math.round(patch.progress);
    if (patch.error !== undefined) data["error"] = patch.error as object;
    if (patch.outputPath !== undefined) data["outputPath"] = patch.outputPath;
    if (patch.finishedAt !== undefined) data["finishedAt"] = new Date(patch.finishedAt);
    const row = await this.db.renderJob.update({ where: { id }, data });
    return fromRenderJobRow(row);
  }

  async createGenerationJob(job: GenerationJob): Promise<GenerationJob> {
    const row = await this.db.generationJob.create({ data: toJobRow(job) });
    return fromJobRow(row);
  }

  async getGenerationJob(id: string): Promise<GenerationJob | null> {
    const row = await this.db.generationJob.findUnique({ where: { id } });
    return row ? fromJobRow(row) : null;
  }

  async findJobByIdempotencyKey(key: string): Promise<GenerationJob | null> {
    const row = await this.db.generationJob.findUnique({ where: { idempotencyKey: key } });
    return row ? fromJobRow(row) : null;
  }

  async listGenerationJobs(projectId: string): Promise<GenerationJob[]> {
    const rows = await this.db.generationJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(fromJobRow);
  }

  async updateGenerationJob(
    id: string,
    patch: Parameters<StorageDriver["updateGenerationJob"]>[1],
  ): Promise<GenerationJob> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data["status"] = patch.status;
    if (patch.progress !== undefined) data["progress"] = patch.progress;
    if (patch.error !== undefined) data["error"] = patch.error as object;
    if (patch.resultAssetIds !== undefined) data["resultAssetIds"] = patch.resultAssetIds;
    if (patch.actualCostUsd !== undefined) data["actualCostUsd"] = patch.actualCostUsd;
    if (patch.startedAt !== undefined) data["startedAt"] = new Date(patch.startedAt);
    if (patch.finishedAt !== undefined) data["finishedAt"] = new Date(patch.finishedAt);
    const row = await this.db.generationJob.update({ where: { id }, data });
    return fromJobRow(row);
  }
}

type ProjectRow = Awaited<ReturnType<PrismaClient["project"]["create"]>>;
type TemplateRow = Awaited<ReturnType<PrismaClient["promptTemplate"]["create"]>>;
type BriefRow = Awaited<ReturnType<PrismaClient["creativeBrief"]["create"]>>;
type ScriptRow = Awaited<ReturnType<PrismaClient["script"]["create"]>>;
type SceneRow = Awaited<ReturnType<PrismaClient["scene"]["create"]>>;
type BibleRow = Awaited<ReturnType<PrismaClient["bibleCard"]["create"]>>;
type SequenceRow = Awaited<ReturnType<PrismaClient["sequence"]["create"]>>;
type RenderJobRow = Awaited<ReturnType<PrismaClient["renderJob"]["create"]>>;

function fromSequenceRow(row: SequenceRow): Sequence {
  return SequenceSchema.parse({
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    fps: row.fps,
    width: row.width,
    height: row.height,
    tracks: row.tracks,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function fromRenderJobRow(row: RenderJobRow): RenderJob {
  return RenderJobSchema.parse({
    id: row.id,
    projectId: row.projectId,
    sequenceId: row.sequenceId,
    preset: row.preset,
    status: row.status,
    progress: row.progress,
    error: row.error ?? undefined,
    outputPath: row.outputPath ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : undefined,
  });
}

function fromBriefRow(row: BriefRow): CreativeBrief {
  return CreativeBriefSchema.parse({
    id: row.id,
    projectId: row.projectId,
    audience: row.audience,
    goal: row.goal,
    tone: row.tone,
    platform: row.platform,
    cta: row.cta ?? undefined,
    keyMessages: row.keyMessages,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function fromScriptRow(row: ScriptRow): Script {
  return ScriptSchema.parse({
    id: row.id,
    projectId: row.projectId,
    briefId: row.briefId ?? undefined,
    format: row.format,
    generator: row.generator,
    title: row.title,
    sections: row.sections,
    createdAt: row.createdAt.toISOString(),
  });
}

function toSceneRow(s: Scene) {
  return {
    id: s.id,
    projectId: s.projectId,
    scriptId: s.scriptId,
    order: s.order,
    title: s.title,
    summary: s.summary,
    narration: s.narration,
    durationSec: s.durationSec,
    locationName: s.locationName ?? null,
    timeOfDay: s.timeOfDay ?? null,
    characterNames: s.characterNames,
    prompt: s.prompt as object,
    storyboardJobId: s.storyboardJobId ?? null,
    storyboardAssetId: s.storyboardAssetId ?? null,
    narrationJobId: s.narrationJobId ?? null,
    narrationAssetId: s.narrationAssetId ?? null,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  };
}

function fromSceneRow(row: SceneRow): Scene {
  return SceneSchema.parse({
    id: row.id,
    projectId: row.projectId,
    scriptId: row.scriptId,
    order: row.order,
    title: row.title,
    summary: row.summary,
    narration: row.narration,
    durationSec: row.durationSec,
    locationName: row.locationName ?? undefined,
    timeOfDay: row.timeOfDay ?? undefined,
    characterNames: row.characterNames,
    prompt: row.prompt,
    storyboardJobId: row.storyboardJobId ?? undefined,
    storyboardAssetId: row.storyboardAssetId ?? undefined,
    narrationJobId: row.narrationJobId ?? undefined,
    narrationAssetId: row.narrationAssetId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function fromBibleRow(row: BibleRow): BibleCard {
  return BibleCardSchema.parse({
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    name: row.name,
    description: row.description,
    promptFragment: row.promptFragment ?? undefined,
    isRealPerson: row.isRealPerson,
    consentConfirmed: row.consentConfirmed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function fromTemplateRow(row: TemplateRow): PromptTemplate {
  return PromptTemplateSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
type PromptVersionRow = Awaited<ReturnType<PrismaClient["promptVersion"]["create"]>>;
type AssetRow = Awaited<ReturnType<PrismaClient["asset"]["create"]>>;
type JobRow = Awaited<ReturnType<PrismaClient["generationJob"]["create"]>>;

function toProjectRow(p: Project) {
  return {
    id: p.id,
    name: p.name,
    purpose: p.purpose,
    aspectRatio: p.aspectRatio,
    targetDurationSec: p.targetDurationSec,
    language: p.language,
    resolution: p.resolution,
    style: p.style ?? null,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
  };
}

function fromProjectRow(row: ProjectRow): Project {
  return ProjectSchema.parse({
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    aspectRatio: row.aspectRatio,
    targetDurationSec: row.targetDurationSec,
    language: row.language,
    resolution: row.resolution,
    style: row.style ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  });
}

function fromPromptVersionRow(row: PromptVersionRow): PromptVersion {
  return PromptVersionSchema.parse({
    id: row.id,
    promptId: row.promptId,
    projectId: row.projectId,
    version: row.version,
    language: row.language,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  });
}

function fromAssetRow(row: AssetRow): Asset {
  return AssetSchema.parse({
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    name: row.name,
    uri: row.uri,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256 ?? undefined,
    durationSec: row.durationSec ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    thumbnailUri: row.thumbnailUri ?? undefined,
    provenance: row.provenance ?? undefined,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  });
}

function toJobRow(j: GenerationJob) {
  return {
    id: j.id,
    projectId: j.projectId,
    promptVersionId: j.promptVersionId ?? null,
    request: j.request as object,
    status: j.status,
    progress: j.progress,
    idempotencyKey: j.idempotencyKey,
    ...(j.costEstimate ? { costEstimate: j.costEstimate as object } : {}),
    actualCostUsd: j.actualCostUsd ?? null,
    ...(j.error ? { error: j.error as object } : {}),
    resultAssetIds: j.resultAssetIds,
    createdAt: new Date(j.createdAt),
    updatedAt: new Date(j.updatedAt),
    startedAt: j.startedAt ? new Date(j.startedAt) : null,
    finishedAt: j.finishedAt ? new Date(j.finishedAt) : null,
  };
}

function fromJobRow(row: JobRow): GenerationJob {
  return GenerationJobSchema.parse({
    id: row.id,
    projectId: row.projectId,
    promptVersionId: row.promptVersionId ?? undefined,
    request: row.request,
    status: row.status,
    progress: row.progress,
    idempotencyKey: row.idempotencyKey,
    costEstimate: row.costEstimate ?? undefined,
    actualCostUsd: row.actualCostUsd ?? undefined,
    error: row.error ?? undefined,
    resultAssetIds: row.resultAssetIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : undefined,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : undefined,
  });
}
