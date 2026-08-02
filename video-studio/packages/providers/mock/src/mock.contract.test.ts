import { describe, expect, it } from "vitest";
import { runProviderContractSuite, sampleGenerationRequest } from "@studio/test-utils";
import { MockProviderAdapter } from "./index.js";

runProviderContractSuite({
  makeAdapter: () => new MockProviderAdapter({ completeAfterPolls: 2 }),
  validRequest: sampleGenerationRequest(),
  unsupportedRequest: sampleGenerationRequest({
    prompt: {
      ...sampleGenerationRequest().prompt,
      output: {
        ...sampleGenerationRequest().prompt.output,
        durationSec: 42, // mock-video-fast yalnızca 3/5/8 sn destekler
      },
    },
  }),
});

describe("mock adaptörüne özgü davranış", () => {
  it("iptal edilen job cancelled durumuna geçer", async () => {
    const adapter = new MockProviderAdapter({ completeAfterPolls: 10 });
    const compiled = adapter.compile(sampleGenerationRequest());
    const job = await adapter.submit(compiled, { idempotencyKey: "c1", correlationId: "x" });
    await adapter.getStatus(job);
    const cancel = await adapter.cancel(job);
    expect(cancel.cancelled).toBe(true);
    expect((await adapter.getStatus(job)).state).toBe("cancelled");
  });

  it("yer tutucu görsel MOCK/DEMO ibaresi taşır", async () => {
    const adapter = new MockProviderAdapter({ completeAfterPolls: 1 });
    const compiled = adapter.compile(sampleGenerationRequest());
    const job = await adapter.submit(compiled, { idempotencyKey: "c2", correlationId: "y" });
    const status = await adapter.getStatus(job);
    const result = await adapter.normalizeResult(status.raw);
    const svg = Buffer.from(
      (result.artifacts[0]?.url ?? "").replace("data:image/svg+xml;base64,", ""),
      "base64",
    ).toString("utf8");
    expect(svg).toContain("MOCK / DEMO");
    expect(result.provenance.mock).toBe(true);
  });
});
