import { describe, expect, it } from "vitest";
import { createVideoPrompt } from "./builder.js";
import { compileToText, compileToJson } from "./compile.js";
import { checkQuality } from "./quality.js";
import { detectVariables, substituteVariables } from "./variables.js";

const sample = () =>
  createVideoPrompt({
    subject: {
      description: "Kırmızı yağmurlukla yürüyen genç bir kadın",
      emotion: "huzurlu",
      action: "İstanbul'da arnavut kaldırımlı sokakta yürüyor",
    },
    scene: { environment: "tarihi sokak", timeOfDay: "gün-batımı", weather: "hafif yağmur" },
    camera: { shotType: "medium", movement: "dolly", depthOfField: "shallow" },
    lighting: { colorTemperature: "sıcak", contrast: "orta" },
    style: { visualStyle: "sinematik", filmLook: "35mm film" },
    temporal: [
      { atSec: 0, action: "kadın kameraya doğru yürür" },
      { atSec: 3, action: "durup vitrine bakar" },
    ],
    negative: ["bulanık", "bozuk eller"],
    output: { aspectRatio: "16:9", durationSec: 5, fps: 24, resolution: "720p" },
  });

describe("builder", () => {
  it("varsayılanları uygular", () => {
    const p = createVideoPrompt({ subject: { description: "bir kedi" } });
    expect(p.output.durationSec).toBe(5);
    expect(p.output.aspectRatio).toBe("16:9");
    expect(p.negative).toEqual([]);
  });

  it("geçersiz girdiyi reddeder", () => {
    expect(() => createVideoPrompt({ subject: { description: "" } })).toThrow();
  });
});

describe("compile", () => {
  it("deterministiktir: aynı girdi aynı çıktı", () => {
    expect(compileToText(sample())).toBe(compileToText(sample()));
    expect(compileToJson(sample())).toBe(compileToJson(sample()));
  });

  it("tüm bölümleri içerir", () => {
    const text = compileToText(sample());
    expect(text).toContain("Kırmızı yağmurluk");
    expect(text).toContain("Sahne:");
    expect(text).toContain("Kamera:");
    expect(text).toContain("Işık:");
    expect(text).toContain("Zaman planı: 0sn:");
    expect(text).toContain("Kaçınılacaklar:");
  });

  it("temporal aksiyonları saniyeye göre sıralar", () => {
    const p = createVideoPrompt({
      subject: { description: "uzun bir tanım burada" },
      temporal: [
        { atSec: 4, action: "son" },
        { atSec: 1, action: "ilk" },
      ],
    });
    const text = compileToText(p);
    expect(text.indexOf("1sn: ilk")).toBeLessThan(text.indexOf("4sn: son"));
  });
});

describe("quality", () => {
  it("temiz prompt'ta error üretmez", () => {
    const issues = checkQuality(sample());
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("çelişkiyi yakalar", () => {
    const p = createVideoPrompt({
      subject: { description: "yağmurlu sokakta yürüyen adam" },
      negative: ["yağmurlu"],
    });
    expect(checkQuality(p).some((i) => i.code === "CONTRADICTION")).toBe(true);
  });

  it("süre dışına taşan zaman planını yakalar", () => {
    const p = createVideoPrompt({
      subject: { description: "uzun bir özne tanımı" },
      temporal: [{ atSec: 30, action: "geç aksiyon" }],
      output: { durationSec: 5 },
    });
    expect(checkQuality(p).some((i) => i.code === "TEMPORAL_OVERFLOW")).toBe(true);
  });
});

describe("variables", () => {
  it("üç formatı da algılar", () => {
    expect(detectVariables("Merhaba ${ad}, {{sehir}} ve [[hava]]")).toEqual([
      "ad",
      "hava",
      "sehir",
    ]);
  });

  it("değer verilmeyen değişkeni olduğu gibi bırakır", () => {
    expect(substituteVariables("${a} ve {{b}}", { a: "bir" })).toBe("bir ve {{b}}");
  });
});
