import { describe, expect, it } from "vitest";
import { CreateProjectInput, GenerationJobSchema, ProvenanceSchema, newId } from "./index.js";

describe("domain şemaları", () => {
  it("newId öneki uygular ve benzersizdir", () => {
    const a = newId("prj");
    const b = newId("prj");
    expect(a).toMatch(/^prj_/);
    expect(a).not.toBe(b);
  });

  it("CreateProjectInput geçersiz süreyi reddeder", () => {
    const result = CreateProjectInput.safeParse({
      name: "Test",
      purpose: "reklam",
      aspectRatio: "16:9",
      targetDurationSec: -5,
    });
    expect(result.success).toBe(false);
  });

  it("Provenance mock bayrağı varsayılanı false'tur", () => {
    const p = ProvenanceSchema.parse({
      providerId: "x",
      modelId: "y",
      generatedAt: new Date().toISOString(),
    });
    expect(p.mock).toBe(false);
  });

  it("GenerationJob geçersiz durum değerini reddeder", () => {
    const base = {
      id: "gen_1",
      projectId: "prj_1",
      request: {
        capability: "textToVideo",
        providerId: "mock",
        modelId: "m",
        prompt: { subject: { description: "yeterince uzun bir tanım" } },
      },
      status: "uçuyor",
      idempotencyKey: "k",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(GenerationJobSchema.safeParse(base).success).toBe(false);
  });
});
