import { z } from "zod";
import {
  ScriptSectionSchema,
  type CreativeBrief,
  type ScriptFormat,
  type ScriptSection,
} from "@studio/domain";

export interface ScriptGenerationInput {
  brief: CreativeBrief;
  format: ScriptFormat;
  targetDurationSec: number;
  language: "tr" | "en";
}

export interface GeneratedScript {
  title: string;
  sections: ScriptSection[];
  /** "template" veya "openai:<model>" — arayüz buna göre etiket gösterir. */
  generator: string;
}

export interface ScriptGenerator {
  generate(input: ScriptGenerationInput): Promise<GeneratedScript>;
}

const FORMAT_LABELS: Record<ScriptFormat, string> = {
  anlatici: "anlatıcı metni",
  reklam: "reklam filmi",
  egitim: "eğitim videosu",
  "kisa-film": "sinematik kısa film",
  haber: "haber/brifing",
  "sosyal-medya": "sosyal medya videosu",
};

/**
 * LLM'siz, KURAL TABANLI taslak üretici. Gerçek yaratıcı yazım YAPMAZ;
 * brief alanlarını yapılandırılmış bir taslağa yerleştirir. Arayüzde
 * "Şablon taslağı — LLM değil" olarak etiketlenmek ZORUNDADIR (generator="template").
 */
export class TemplateScriptGenerator implements ScriptGenerator {
  async generate(input: ScriptGenerationInput): Promise<GeneratedScript> {
    const { brief, format } = input;
    const sections: ScriptSection[] = [];

    sections.push({
      heading: "Açılış",
      narration: `${brief.audience} için hazırlanan bu ${FORMAT_LABELS[format]}, ${brief.goal} hedefiyle açılır. Dikkat çekici ilk cümle burada yer alır.`,
      visual: `Açılış sahnesi: ${brief.goal} temasını görselleştiren, ${brief.tone} tonunda bir açılış görüntüsü`,
    });

    for (const [index, message] of brief.keyMessages.entries()) {
      sections.push({
        heading: `Ana mesaj ${index + 1}`,
        narration: `${message}. Bu bölümde mesaj ${brief.tone} bir dille açılır ve örneklendirilir.`,
        visual: `${message} mesajını destekleyen görsel anlatım, ${brief.tone} ton`,
      });
    }
    if (brief.keyMessages.length === 0) {
      sections.push({
        heading: "Gelişme",
        narration: `${brief.goal} bu bölümde ayrıntılandırılır; ${brief.audience} hedef kitlesinin ihtiyaçlarına bağlanır.`,
        visual: `Konuyu geliştiren ara sahneler, ${brief.tone} ton`,
      });
    }

    sections.push({
      heading: "Kapanış",
      narration: brief.cta
        ? `Kapanışta izleyici net bir eyleme çağrılır: ${brief.cta}`
        : `Kapanış: ana mesaj özetlenir ve ${brief.platform} için akılda kalıcı bir son cümle kurulur.`,
      visual: `Kapanış karesi: marka/mesaj vurgusu${brief.cta ? ` ve "${brief.cta}" çağrısı` : ""}`,
    });

    return {
      title: `${brief.goal.slice(0, 60)} — ${FORMAT_LABELS[format]} taslağı`,
      sections,
      generator: "template",
    };
  }
}

const LlmScriptResponse = z.object({
  title: z.string().min(1).max(300),
  sections: z.array(ScriptSectionSchema).min(2).max(12),
});

export interface OpenAIScriptGeneratorOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  model?: string;
}

/**
 * OpenAI chat completions ile gerçek senaryo üretimi.
 * Sözleşme resmî OpenAPI spec'ten doğrulandı: POST /v1/chat/completions
 * {model, messages, response_format:{type:"json_object"}}.
 */
export class OpenAIScriptGenerator implements ScriptGenerator {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OpenAIScriptGeneratorOptions) {
    if (!options.apiKey) throw new Error("OpenAIScriptGenerator için apiKey zorunludur.");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com";
    this.model = options.model ?? "gpt-4o-mini";
  }

  async generate(input: ScriptGenerationInput): Promise<GeneratedScript> {
    const { brief, format, targetDurationSec, language } = input;
    const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Sen deneyimli bir video senaristisin. Yanıtı YALNIZCA şu JSON şemasında ver: ` +
              `{"title": string, "sections": [{"heading": string, "narration": string, "visual": string}]}. ` +
              `"narration" seslendirme metnidir; "visual" o bölümde ekranda görünecek sahnenin tarifidir. ` +
              `Dil: ${language === "tr" ? "Türkçe" : "İngilizce"}. Bölüm sayısı 3-8 arası olsun. ` +
              `Toplam anlatım, yaklaşık ${targetDurationSec} saniyede okunacak uzunlukta olsun ` +
              `(Türkçe konuşma hızı ~2,3 kelime/sn).`,
          },
          {
            role: "user",
            content:
              `Format: ${FORMAT_LABELS[format]}\nHedef kitle: ${brief.audience}\nAmaç: ${brief.goal}\n` +
              `Ton: ${brief.tone}\nPlatform: ${brief.platform}\n` +
              (brief.keyMessages.length > 0
                ? `Ana mesajlar: ${brief.keyMessages.join("; ")}\n`
                : "") +
              (brief.cta ? `Eylem çağrısı: ${brief.cta}\n` : "") +
              (brief.notes ? `Notlar: ${brief.notes}\n` : ""),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI senaryo isteği başarısız: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
      );
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI yanıtında içerik bulunamadı.");

    const parsed = LlmScriptResponse.parse(JSON.parse(content));
    return { ...parsed, generator: `openai:${this.model}` };
  }
}
