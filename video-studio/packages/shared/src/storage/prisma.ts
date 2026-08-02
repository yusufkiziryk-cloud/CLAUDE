import { PrismaClient } from "@prisma/client";
import {
  AssetSchema,
  GenerationJobSchema,
  ProjectSchema,
  PromptTemplateSchema,
  PromptVersionSchema,
  type Asset,
  type GenerationJob,
  type Project,
  type PromptTemplate,
  type PromptVersion,
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
