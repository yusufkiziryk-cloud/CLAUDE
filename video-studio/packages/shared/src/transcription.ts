export interface TranscriptionCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  cues: TranscriptionCue[];
  /** "openai:whisper-1" veya "mock" — arayüz mock'u açıkça etiketler. */
  engine: string;
}

export interface Transcriber {
  transcribe(input: {
    data: Buffer;
    mimeType: string;
    fileName: string;
    language?: string;
  }): Promise<TranscriptionResult>;
}

/**
 * MOCK transkripsiyon: gerçek konuşma tanıma YAPMAZ. Akış testi için, açıkça
 * etiketlenmiş bir yer tutucu metin döndürür (engine="mock").
 */
export class MockTranscriber implements Transcriber {
  async transcribe(input: { data: Buffer; mimeType: string }): Promise<TranscriptionResult> {
    const text =
      "[MOCK] Bu örnek bir transkripttir — gerçek konuşma tanıma değildir. " +
      `(${input.mimeType}, ${Math.round(input.data.length / 1024)} KB)`;
    return {
      text,
      cues: [{ startSec: 0, endSec: 3, text }],
      engine: "mock",
    };
  }
}

/**
 * OpenAI Whisper transkripsiyon. Sözleşme resmî OpenAPI spec'ten doğrulandı:
 * POST /v1/audio/transcriptions (multipart: file, model=whisper-1,
 * response_format=verbose_json → segments[start/end/text], language).
 */
export class OpenAITranscriber implements Transcriber {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; fetchImpl?: typeof fetch; baseUrl?: string }) {
    if (!options.apiKey) throw new Error("OpenAITranscriber için apiKey zorunludur.");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com";
  }

  async transcribe(input: {
    data: Buffer;
    mimeType: string;
    fileName: string;
    language?: string;
  }): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.data)], { type: input.mimeType }),
      input.fileName,
    );
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    if (input.language) form.append("language", input.language);

    const response = await this.fetchImpl(`${this.baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(
        `Transkripsiyon başarısız: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
      );
    }
    const body = (await response.json()) as {
      text?: string;
      segments?: { start: number; end: number; text: string }[];
    };
    return {
      text: body.text ?? "",
      cues: (body.segments ?? []).map((segment) => ({
        startSec: segment.start,
        endSec: segment.end,
        text: segment.text.trim(),
      })),
      engine: "openai:whisper-1",
    };
  }
}
