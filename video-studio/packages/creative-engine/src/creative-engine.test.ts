import { describe, expect, it } from "vitest";
import { ScriptSchema, type CreativeBrief, type Script } from "@studio/domain";
import { OpenAIScriptGenerator, TemplateScriptGenerator } from "./script-generator.js";
import { planScenes } from "./scene-planner.js";
import { checkContinuity } from "./continuity.js";

const brief = (): CreativeBrief => ({
  id: "brf_1",
  projectId: "prj_1",
  audience: "Genç profesyoneller",
  goal: "Yeni kahve markasını tanıtmak",
  tone: "samimi",
  platform: "Instagram Reels",
  cta: "Şimdi dene",
  keyMessages: ["Taze kavrulmuş", "Sürdürülebilir üretim"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function toScript(generated: {
  title: string;
  sections: Script["sections"];
  generator: string;
}): Script {
  return ScriptSchema.parse({
    id: "scr_1",
    projectId: "prj_1",
    format: "reklam",
    generator: generated.generator,
    title: generated.title,
    sections: generated.sections,
    createdAt: new Date().toISOString(),
  });
}

describe("TemplateScriptGenerator", () => {
  it("brief alanlarından açılış+mesajlar+kapanış üretir ve 'template' etiketi taşır", async () => {
    const result = await new TemplateScriptGenerator().generate({
      brief: brief(),
      format: "reklam",
      targetDurationSec: 30,
      language: "tr",
    });
    expect(result.generator).toBe("template");
    expect(result.sections.length).toBe(4); // açılış + 2 mesaj + kapanış
    expect(result.sections[0]?.heading).toBe("Açılış");
    expect(result.sections.at(-1)?.narration).toContain("Şimdi dene");
  });
});

describe("OpenAIScriptGenerator", () => {
  it("chat/completions'a json_object formatıyla istek atar ve yanıtı doğrular", async () => {
    let capturedBody: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Kahve Hikâyesi",
                  sections: [
                    {
                      heading: "Açılış",
                      narration: "Sabahın ilk ışıkları...",
                      visual: "Buharı tüten fincan",
                    },
                    { heading: "Kapanış", narration: "Şimdi dene.", visual: "Logo ve ambalaj" },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const generator = new OpenAIScriptGenerator({ apiKey: "k", fetchImpl: fakeFetch });
    const result = await generator.generate({
      brief: brief(),
      format: "reklam",
      targetDurationSec: 30,
      language: "tr",
    });
    expect(result.generator).toBe("openai:gpt-4o-mini");
    expect(result.sections).toHaveLength(2);
    expect(capturedBody["response_format"]).toEqual({ type: "json_object" });
    expect(capturedBody["model"]).toBe("gpt-4o-mini");
  });

  it("bozuk LLM yanıtında anlaşılır hata fırlatır (sahte başarı yok)", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"yanlis": true}' } }] }), {
        status: 200,
      })) as typeof fetch;
    const generator = new OpenAIScriptGenerator({ apiKey: "k", fetchImpl: fakeFetch });
    await expect(
      generator.generate({
        brief: brief(),
        format: "reklam",
        targetDurationSec: 30,
        language: "tr",
      }),
    ).rejects.toThrow();
  });
});

describe("planScenes", () => {
  it("süreyi kelime sayısıyla orantılı dağıtır ve prompt taslağı yazar", async () => {
    const generated = await new TemplateScriptGenerator().generate({
      brief: brief(),
      format: "reklam",
      targetDurationSec: 40,
      language: "tr",
    });
    const scenes = planScenes(toScript(generated), 40);
    expect(scenes).toHaveLength(4);
    const total = scenes.reduce((s, x) => s + x.durationSec, 0);
    expect(Math.abs(total - 40)).toBeLessThanOrEqual(6); // yuvarlama payı
    expect(scenes[0]?.prompt.subject.description).toContain("Açılış sahnesi");
    expect(scenes[0]?.prompt.audio.narration).toBeTruthy();
    expect(scenes.every((s, i) => s.order === i)).toBe(true);
  });
});

describe("checkContinuity", () => {
  it("rızasız gerçek kişi kartı için error üretir", async () => {
    const generated = await new TemplateScriptGenerator().generate({
      brief: brief(),
      format: "reklam",
      targetDurationSec: 30,
      language: "tr",
    });
    const scenes = planScenes(toScript(generated), 30);
    scenes[0]!.characterNames = ["Ayşe"];
    const issues = checkContinuity({
      targetDurationSec: 30,
      scenes,
      bibleCards: [
        {
          id: "bib_1",
          projectId: "prj_1",
          kind: "character",
          name: "Ayşe",
          description: "Sunucu",
          isRealPerson: true,
          consentConfirmed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    expect(issues.some((i) => i.code === "CONSENT_REQUIRED" && i.severity === "error")).toBe(true);
  });

  it("kilitli parça eksikse ve karakter tanımsızsa uyarır; süre sapmasını yakalar", async () => {
    const generated = await new TemplateScriptGenerator().generate({
      brief: brief(),
      format: "reklam",
      targetDurationSec: 30,
      language: "tr",
    });
    const scenes = planScenes(toScript(generated), 30);
    scenes[0]!.characterNames = ["Bilinmeyen Kişi", "Barista"];
    scenes[0]!.durationSec = 200; // toplamı hedeften saptır
    const issues = checkContinuity({
      targetDurationSec: 30,
      scenes,
      bibleCards: [
        {
          id: "bib_2",
          projectId: "prj_1",
          kind: "character",
          name: "Barista",
          description: "Kahveci",
          promptFragment: "yeşil önlüklü barista",
          isRealPerson: false,
          consentConfirmed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    expect(issues.some((i) => i.code === "UNKNOWN_CHARACTER")).toBe(true);
    expect(issues.some((i) => i.code === "MISSING_LOCKED_FRAGMENT")).toBe(true);
    expect(issues.some((i) => i.code === "TOTAL_DURATION_MISMATCH")).toBe(true);
  });

  it("aynı mekânda saat sıçramasını yakalar", async () => {
    const generated = await new TemplateScriptGenerator().generate({
      brief: brief(),
      format: "reklam",
      targetDurationSec: 30,
      language: "tr",
    });
    const scenes = planScenes(toScript(generated), 30).slice(0, 2);
    scenes[0]!.locationName = "Kafe";
    scenes[0]!.timeOfDay = "gündüz";
    scenes[1]!.locationName = "Kafe";
    scenes[1]!.timeOfDay = "gece";
    const issues = checkContinuity({ targetDurationSec: 30, scenes, bibleCards: [] });
    expect(issues.some((i) => i.code === "LOCATION_TIME_JUMP")).toBe(true);
  });
});
