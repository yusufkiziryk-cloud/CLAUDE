import { describe, expect, it } from "vitest";
import { runProviderContractSuite, sampleGenerationRequest } from "@studio/test-utils";
import type { CanonicalGenerationRequest } from "@studio/domain";
import { FalProviderAdapter } from "./index.js";

/**
 * Contract testleri kayıtlı fixture'larla, AĞSIZ çalışır.
 * Fixture'lar resmî fal queue API sözleşmesine göre yazılmıştır
 * (POST submit → request_id; GET status → IN_QUEUE/IN_PROGRESS/COMPLETED; GET result).
 */
function fakeFalFetch(): typeof fetch {
  const statusCalls = new Map<string, number>();
  let counter = 0;

  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (method === "POST") {
      counter += 1;
      return jsonResponse({ request_id: `req-${counter}` });
    }
    if (method === "PUT" && url.endsWith("/cancel")) {
      return jsonResponse({ status: "CANCELLATION_REQUESTED" });
    }
    if (url.endsWith("/status")) {
      const key = url;
      const call = (statusCalls.get(key) ?? 0) + 1;
      statusCalls.set(key, call);
      if (call === 1) return jsonResponse({ status: "IN_QUEUE", queue_position: 2 });
      if (call === 2) return jsonResponse({ status: "IN_PROGRESS" });
      return jsonResponse({ status: "COMPLETED" });
    }
    // sonuç ucu
    return jsonResponse({
      video: { url: "https://fal.example/output.mp4", content_type: "video/mp4" },
    });
  }) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function falRequest(
  overrides: Partial<CanonicalGenerationRequest> = {},
): CanonicalGenerationRequest {
  const base = sampleGenerationRequest({
    providerId: "fal",
    modelId: "fal-ai/minimax/video-01",
  });
  base.prompt.output.durationSec = 6; // model sabit ~6 sn üretir
  return { ...base, ...overrides };
}

runProviderContractSuite({
  makeAdapter: () => new FalProviderAdapter({ apiKey: "test-key", fetchImpl: fakeFalFetch() }),
  validRequest: falRequest(),
  unsupportedRequest: falRequest({ capability: "imageToVideo" }),
});

describe("fal adaptörüne özgü davranış", () => {
  it("apiKey olmadan kurulamaz", () => {
    expect(() => new FalProviderAdapter({ apiKey: "" })).toThrow(/FAL_API_KEY/);
  });

  it("submit doğru URL'e, Key auth başlığıyla, yalnızca prompt alanını gönderir", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const spyFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) });
      return jsonResponse({ request_id: "r1" });
    }) as typeof fetch;

    const adapter = new FalProviderAdapter({ apiKey: "gizli", fetchImpl: spyFetch });
    const compiled = adapter.compile(falRequest());
    await adapter.submit(compiled, { idempotencyKey: "k1", correlationId: "c1" });

    expect(calls[0]?.url).toBe("https://queue.fal.run/fal-ai/minimax/video-01");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Key gizli");
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["prompt"]);
  });

  it("beklenmedik sonuç şeklinde normalizeResult anlaşılır hata fırlatır", async () => {
    const adapter = new FalProviderAdapter({ apiKey: "k", fetchImpl: fakeFalFetch() });
    await expect(
      adapter.normalizeResult({ modelId: "fal-ai/minimax/video-01", result: { garip: true } }),
    ).rejects.toThrow(/bilinen medya alanı bulunamadı/);
  });

  it("5xx durum yanıtında iş kaybolmaz (running döner, retry edilir)", async () => {
    const flakyFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? "GET") === "POST") return jsonResponse({ request_id: "r2" });
      if (url.endsWith("/status")) return new Response("oops", { status: 503 });
      return jsonResponse({});
    }) as typeof fetch;
    const adapter = new FalProviderAdapter({ apiKey: "k", fetchImpl: flakyFetch });
    const job = await adapter.submit(adapter.compile(falRequest()), {
      idempotencyKey: "k2",
      correlationId: "c2",
    });
    expect((await adapter.getStatus(job)).state).toBe("running");
  });
});
