import { describe, expect, it } from "vitest";
import { runProviderContractSuite, sampleGenerationRequest } from "@studio/test-utils";
import type { CanonicalGenerationRequest } from "@studio/domain";
import { ReplicateProviderAdapter } from "./index.js";

/** Fixture'lar resmî OpenAPI spec'e göre yazıldı; testler AĞSIZ çalışır. */
function fakeReplicateFetch(): typeof fetch {
  const polls = new Map<string, number>();
  let counter = 0;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if ((init?.method ?? "GET") === "POST" && url.includes("/models/")) {
      counter += 1;
      return json({ id: `pred-${counter}`, status: "starting" });
    }
    if (url.includes("/cancel")) return json({ status: "canceled" });
    if (url.includes("/predictions/")) {
      const id = url.split("/predictions/")[1] ?? "";
      const n = (polls.get(id) ?? 0) + 1;
      polls.set(id, n);
      if (n === 1) return json({ id, status: "starting" });
      if (n === 2) return json({ id, status: "processing" });
      return json({
        id,
        status: "succeeded",
        model: "minimax/video-01",
        output: "https://replicate.delivery/out.mp4",
      });
    }
    return json({}, 404);
  }) as typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function replicateRequest(
  overrides: Partial<CanonicalGenerationRequest> = {},
): CanonicalGenerationRequest {
  const base = sampleGenerationRequest({ providerId: "replicate", modelId: "minimax/video-01" });
  base.prompt.output.durationSec = 6;
  return { ...base, ...overrides };
}

runProviderContractSuite({
  makeAdapter: () =>
    new ReplicateProviderAdapter({ apiToken: "test", fetchImpl: fakeReplicateFetch() }),
  validRequest: replicateRequest(),
  unsupportedRequest: replicateRequest({ capability: "imageToVideo" }),
});

describe("replicate adaptörüne özgü davranış", () => {
  it("apiToken olmadan kurulamaz", () => {
    expect(() => new ReplicateProviderAdapter({ apiToken: "" })).toThrow(/REPLICATE_API_TOKEN/);
  });

  it("submit resmî model ucuna Bearer auth ile yalnızca prompt gönderir", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const spy = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) });
      return json({ id: "p1", status: "starting" });
    }) as typeof fetch;
    const adapter = new ReplicateProviderAdapter({ apiToken: "gizli", fetchImpl: spy });
    await adapter.submit(adapter.compile(replicateRequest()), {
      idempotencyKey: "k",
      correlationId: "c",
    });
    expect(calls[0]?.url).toBe("https://api.replicate.com/v1/models/minimax/video-01/predictions");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer gizli");
    const body = JSON.parse(String(calls[0]?.init?.body)) as { input: Record<string, unknown> };
    expect(Object.keys(body.input)).toEqual(["prompt"]);
  });

  it("çıktı dizisi ve iç içe nesnelerden URL'ler savunmacı toplanır", async () => {
    const adapter = new ReplicateProviderAdapter({
      apiToken: "k",
      fetchImpl: fakeReplicateFetch(),
    });
    const result = await adapter.normalizeResult({
      id: "p",
      status: "succeeded",
      model: "minimax/video-01",
      output: { videos: ["https://x.dev/a.mp4", "https://x.dev/b.png"] },
    });
    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts[0]?.kind).toBe("video");
    expect(result.artifacts[1]?.kind).toBe("image");

    await expect(
      adapter.normalizeResult({ id: "p", status: "succeeded", output: null }),
    ).rejects.toThrow(/medya URL'i bulunamadı/);
  });
});
