import type { VideoPrompt } from "@studio/domain";
import { compileToText } from "./compile.js";

export interface QualityIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

/**
 * API çağrısı gerektirmeyen yerel prompt kalite denetimi
 * (prompts.chat'in yerel kalite skorlama yaklaşımından esinlenildi).
 */
export function checkQuality(prompt: VideoPrompt): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (prompt.subject.description.trim().length < 10) {
    issues.push({
      severity: "warning",
      code: "SUBJECT_TOO_SHORT",
      message: "Özne tanımı çok kısa; model tutarsız sonuç üretebilir. En az bir cümle yazın.",
    });
  }

  const text = compileToText(prompt);
  if (text.length > 2000) {
    issues.push({
      severity: "warning",
      code: "PROMPT_TOO_LONG",
      message: `Derlenen prompt ${text.length} karakter; birçok model 2000 karakter üzerinde kırpar.`,
    });
  }

  const subjectWords = new Set(
    prompt.subject.description
      .toLocaleLowerCase("tr")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  for (const neg of prompt.negative) {
    if (subjectWords.has(neg.toLocaleLowerCase("tr"))) {
      issues.push({
        severity: "error",
        code: "CONTRADICTION",
        message: `"${neg}" hem öznede hem kaçınılacaklar listesinde geçiyor; çelişkiyi giderin.`,
      });
    }
  }

  const overflow = prompt.temporal.filter((t) => t.atSec > prompt.output.durationSec);
  if (overflow.length > 0) {
    issues.push({
      severity: "error",
      code: "TEMPORAL_OVERFLOW",
      message: `Zaman planındaki ${overflow.length} aksiyon video süresinin (${prompt.output.durationSec}sn) dışında.`,
    });
  }

  if (prompt.temporal.length === 0 && prompt.output.durationSec > 8) {
    issues.push({
      severity: "info",
      code: "NO_TEMPORAL_PLAN",
      message: "8 saniyeden uzun videolarda saniye bazlı zaman planı tutarlılığı artırır.",
    });
  }

  return issues;
}
