import { describe, expect, it } from "vitest";
import { runProviderContractSuite, sampleGenerationRequest } from "@studio/test-utils";
import type { CanonicalGenerationRequest } from "@studio/domain";
import { ElevenLabsProviderAdapter } from "./index.js";

/** Fixture'lar resmî OpenAPI spec'e göre; testler AĞSIZ çalışır. */
function fakeElevenLabsFetch(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/v1/text-to-speech/") && (init?.method ?? "GET") === "POST") {
      const body = JSON.parse(String(init?.body)) as { text: string; model_id: string };
      expect(body.text.length).toBeGreaterThan(0);
      expect(body.model_id).toBe("eleven_multilingual_v2");
      return new Response(Buffer.from("sahte-mp3-ses"), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

function ttsRequest(
  overrides: Partial<CanonicalGenerationRequest> = {},
): CanonicalGenerationRequest {
  const base = sampleGenerationRequest({
    capability: "textToSpeech",
    providerId: "elevenlabs",
    modelId: "eleven_multilingual_v2",
  });
  base.prompt.audio.narration = "Merhaba, bu bir Türkçe seslendirme testidir.";
  return { ...base, ...overrides };
}

runProviderContractSuite({
  makeAdapter: () =>
    new ElevenLabsProviderAdapter({ apiKey: "test", fetchImpl: fakeElevenLabsFetch() }),
  validRequest: ttsRequest(),
  unsupportedRequest: ttsRequest({ capability: "textToVideo" }),
});

describe("elevenlabs adaptörüne özgü davranış", () => {
  it("apiKey olmadan kurulamaz", () => {
    expect(() => new ElevenLabsProviderAdapter({ apiKey: "" })).toThrow(/ELEVENLABS_API_KEY/);
  });

  it("submit xi-api-key başlığı ve output_format ile doğru uca gider", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const spy = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) });
      return new Response(Buffer.from("ses"), { status: 200 });
    }) as typeof fetch;
    const adapter = new ElevenLabsProviderAdapter({ apiKey: "gizli", fetchImpl: spy });
    await adapter.submit(adapter.compile(ttsRequest()), {
      idempotencyKey: "k",
      correlationId: "c",
    });
    expect(calls[0]?.url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM?output_format=mp3_44100_128",
    );
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("gizli");
  });

  it("anlatıcı metni yoksa missing doğrulaması döner; sonuç mp3 data URI olur", async () => {
    const adapter = new ElevenLabsProviderAdapter({
      apiKey: "k",
      fetchImpl: fakeElevenLabsFetch(),
    });
    const empty = sampleGenerationRequest({
      capability: "textToSpeech",
      providerId: "elevenlabs",
      modelId: "eleven_multilingual_v2",
    });
    expect(adapter.validate(empty).issues.some((i) => i.kind === "missing")).toBe(true);

    const job = await adapter.submit(adapter.compile(ttsRequest()), {
      idempotencyKey: "k2",
      correlationId: "c2",
    });
    const status = await adapter.getStatus(job);
    const result = await adapter.normalizeResult(status.raw);
    expect(result.artifacts[0]?.url.startsWith("data:audio/mpeg;base64,")).toBe(true);
    expect(result.provenance.parameters["voiceId"]).toBe("21m00Tcm4TlvDq8ikWAM");
  });
});
