import { describe, expect, it } from "vitest";
import { createVideoPrompt } from "./builder.js";
import { promptToEditableText, parseEditableText } from "./editable-text.js";
import { diffPrompts } from "./diff.js";
import { exportPrompt } from "./export.js";

const sample = () =>
  createVideoPrompt({
    subject: {
      description: "Kırmızı yağmurluklu genç bir kadın",
      emotion: "huzurlu",
      action: "tarihi sokakta yürüyor",
    },
    scene: { environment: "arnavut kaldırımlı sokak", timeOfDay: "gün-batımı" },
    camera: { shotType: "medium", movement: "dolly" },
    lighting: { colorTemperature: "sıcak" },
    style: { visualStyle: "sinematik", filmLook: "35mm" },
    temporal: [
      { atSec: 0, action: "kameraya doğru yürür" },
      { atSec: 3, action: "vitrine bakar" },
    ],
    audio: { narration: "Şehrin kalbinde bir akşam." },
    negative: ["bulanık", "bozuk eller"],
  });

describe("editable-text çift yönlü senkron", () => {
  it("round-trip: metne çevir → ayrıştır → aynı prompt", () => {
    const original = sample();
    const text = promptToEditableText(original);
    const { input, warnings } = parseEditableText(text);
    expect(warnings).toEqual([]);
    const reparsed = createVideoPrompt({ ...input, output: original.output });
    expect(reparsed).toEqual(original);
  });

  it("bilinmeyen etiket ve bozuk satır uyarı üretir, sessizce yutulmaz", () => {
    const { warnings } = parseEditableText("Özne: bir kedi\nUçuşHızı: 5\nsadece metin satırı");
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("UçuşHızı");
  });

  it("zaman planı satırı ayrıştırılır ve hatalı öğe uyarı verir", () => {
    const { input, warnings } = parseEditableText(
      "Özne: koşan köpek\nZaman: 0sn: koşar; 4sn: durur; bozuköğe",
    );
    expect(input.temporal).toEqual([
      { atSec: 0, action: "koşar" },
      { atSec: 4, action: "durur" },
    ]);
    expect(warnings.some((w) => w.includes("bozuköğe"))).toBe(true);
  });
});

describe("diffPrompts", () => {
  it("aynı promptlar için boş fark döner", () => {
    expect(diffPrompts(sample(), sample())).toEqual([]);
  });

  it("değişen alanları yol bazında bildirir", () => {
    const a = sample();
    const b = createVideoPrompt({
      ...a,
      camera: { ...a.camera, movement: "orbit" },
      negative: ["bulanık"],
    });
    const diff = diffPrompts(a, b);
    const paths = diff.map((d) => d.path);
    expect(paths).toContain("camera.movement");
    expect(paths.some((p) => p.startsWith("negative"))).toBe(true);
    const movement = diff.find((d) => d.path === "camera.movement");
    expect(movement?.before).toBe("dolly");
    expect(movement?.after).toBe("orbit");
  });
});

describe("exportPrompt", () => {
  it("üç format da üretilir ve içerik taşır", () => {
    const p = sample();
    expect(JSON.parse(exportPrompt(p, "json"))).toEqual(p);
    expect(exportPrompt(p, "yaml")).toContain("description: Kırmızı yağmurluklu genç bir kadın");
    expect(exportPrompt(p, "text")).toContain("Kamera:");
  });
});
