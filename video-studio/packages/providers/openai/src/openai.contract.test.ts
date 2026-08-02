import { describe, expect, it } from "vitest";
import { runProviderContractSuite, sampleGenerationRequest } from "@studio/test-utils";
import type { CanonicalGenerationRequest } from "@studio/domain";
import { OpenAIProviderAdapter } from "./index.js";

/** Fixture'lar resmî OpenAPI spec'ine göre yazıldı; testler AĞSIZ çalışır. */
function fakeOpenAIFetch(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/v1/images/generations")) {
      const body = JSON.parse(String(init?.body)) as { prompt: string };
      expect(body.prompt.length).toBeGreaterThan(0);
      return new Response(
        JSON.stringify({
          created: 1713833628,
          data: [{ b64_json: Buffer.from("sahte-png").toString("base64") }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.endsWith("/v1/audio/speech")) {
      return new Response(Buffer.from("sahte-mp3"), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

function imageRequest(
  overrides: Partial<CanonicalGenerationRequest> = {},
): CanonicalGenerationRequest {
  return sampleGenerationRequest({
    capability: "textToImage",
    providerId: "openai",
    modelId: "gpt-image-1",
    ...overrides,
  });
}

runProviderContractSuite({
  makeAdapter: () => new OpenAIProviderAdapter({ apiKey: "test", fetchImpl: fakeOpenAIFetch() }),
  validRequest: imageRequest(),
  unsupportedRequest: imageRequest({ capability: "textToVideo" }),
});

describe("openai adaptörüne özgü davranış", () => {
  it("apiKey olmadan kurulamaz", () => {
    expect(() => new OpenAIProviderAdapter({ apiKey: "" })).toThrow(/OPENAI_API_KEY/);
  });

  it("16:9 oranı gpt-image-1 için 1536x1024 boyutuna derlenir", () => {
    const adapter = new OpenAIProviderAdapter({ apiKey: "k", fetchImpl: fakeOpenAIFetch() });
    const compiled = adapter.compile(imageRequest());
    const body = compiled.payload["body"] as { size: string; model: string };
    expect(body.size).toBe("1536x1024");
    expect(body.model).toBe("gpt-image-1");
  });

  it("TTS: anlatıcı metni yoksa 'missing' doğrulama hatası döner", () => {
    const adapter = new OpenAIProviderAdapter({ apiKey: "k", fetchImpl: fakeOpenAIFetch() });
    const request = sampleGenerationRequest({
      capability: "textToSpeech",
      providerId: "openai",
      modelId: "gpt-4o-mini-tts",
    });
    const result = adapter.validate(request);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.kind === "missing")).toBe(true);
  });

  it("TTS akışı: anlatıcı metniyle uçtan uca ses varlığı üretir", async () => {
    const adapter = new OpenAIProviderAdapter({ apiKey: "k", fetchImpl: fakeOpenAIFetch() });
    const request = sampleGenerationRequest({
      capability: "textToSpeech",
      providerId: "openai",
      modelId: "gpt-4o-mini-tts",
    });
    request.prompt.audio.narration = "Merhaba, bu bir test seslendirmesidir.";

    expect(adapter.validate(request).ok).toBe(true);
    const estimate = await adapter.estimate(request);
    expect(estimate.amount).toBeGreaterThan(0);
    expect(estimate.isExact).toBe(false);

    const job = await adapter.submit(adapter.compile(request), {
      idempotencyKey: "tts-1",
      correlationId: "c",
    });
    const status = await adapter.getStatus(job);
    expect(status.state).toBe("succeeded");
    const result = await adapter.normalizeResult(status.raw);
    expect(result.artifacts[0]?.mimeType).toBe("audio/mpeg");
    expect(result.artifacts[0]?.url.startsWith("data:audio/mpeg;base64,")).toBe(true);
  });

  it("negatif prompt gpt-image-1'de unsupported olarak işaretlenir", () => {
    const adapter = new OpenAIProviderAdapter({ apiKey: "k", fetchImpl: fakeOpenAIFetch() });
    const request = imageRequest();
    request.prompt.negative = ["bulanık"];
    const result = adapter.validate(request);
    expect(result.issues.some((i) => i.field === "negative" && i.kind === "unsupported")).toBe(
      true,
    );
  });
});
