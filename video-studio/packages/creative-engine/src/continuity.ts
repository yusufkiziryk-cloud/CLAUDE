import { compileToText } from "@studio/prompt-engine";
import type { BibleCard, ContinuityIssue, Scene } from "@studio/domain";
import { countWords, WORDS_PER_SECOND_TR } from "./scene-planner.js";

export interface ContinuityInput {
  targetDurationSec: number;
  scenes: Scene[];
  bibleCards: BibleCard[];
}

/** Deterministik (LLM'siz) devamlılık ve tutarlılık denetçisi. */
export function checkContinuity(input: ContinuityInput): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const { scenes, bibleCards, targetDurationSec } = input;
  const ordered = [...scenes].sort((a, b) => a.order - b.order);

  // 1) Toplam süre hedeften ±%20'den fazla sapıyorsa uyar
  const total = ordered.reduce((sum, s) => sum + s.durationSec, 0);
  if (ordered.length > 0 && Math.abs(total - targetDurationSec) > targetDurationSec * 0.2) {
    issues.push({
      severity: "warning",
      code: "TOTAL_DURATION_MISMATCH",
      message: `Sahnelerin toplam süresi ${total} sn; proje hedefi ${targetDurationSec} sn. Süre tahsisini gözden geçirin.`,
    });
  }

  const characterCards = bibleCards.filter((c) => c.kind === "character");
  const characterNames = new Set(characterCards.map((c) => c.name.toLocaleLowerCase("tr")));

  for (const scene of ordered) {
    const compiled = compileToText(scene.prompt).toLocaleLowerCase("tr");

    // 2) Sahnede geçen karakter bible'da tanımlı mı?
    for (const name of scene.characterNames) {
      if (!characterNames.has(name.toLocaleLowerCase("tr"))) {
        issues.push({
          severity: "warning",
          code: "UNKNOWN_CHARACTER",
          sceneId: scene.id,
          message: `"${scene.title}" sahnesindeki "${name}" karakteri için kart tanımlı değil; görünüm tutarsız olabilir.`,
        });
      }
    }

    // 3) Kilitli prompt parçası sahne promptunda var mı? / 6) Gerçek kişi rızası
    for (const card of characterCards) {
      const referenced = scene.characterNames.some(
        (n) => n.toLocaleLowerCase("tr") === card.name.toLocaleLowerCase("tr"),
      );
      if (!referenced) continue;
      if (card.isRealPerson && !card.consentConfirmed) {
        issues.push({
          severity: "error",
          code: "CONSENT_REQUIRED",
          sceneId: scene.id,
          message: `"${card.name}" gerçek bir kişiyi temsil ediyor ve rıza kaydı onaylanmamış; bu sahne için üretim engellenir.`,
        });
      }
      if (card.promptFragment && !compiled.includes(card.promptFragment.toLocaleLowerCase("tr"))) {
        issues.push({
          severity: "warning",
          code: "MISSING_LOCKED_FRAGMENT",
          sceneId: scene.id,
          message: `"${scene.title}" sahnesinin promptu, "${card.name}" kartının kilitli parçasını ("${card.promptFragment}") içermiyor.`,
        });
      }
    }

    // 4) Anlatım hızı: kelime sayısı süreye sığmıyorsa uyar
    const words = countWords(scene.narration);
    if (words > 0 && words / scene.durationSec > WORDS_PER_SECOND_TR * 1.3) {
      issues.push({
        severity: "warning",
        code: "NARRATION_TOO_FAST",
        sceneId: scene.id,
        message: `"${scene.title}" sahnesinde ${words} kelime ${scene.durationSec} sn'ye sığmaz (~${WORDS_PER_SECOND_TR} kelime/sn). Metni kısaltın veya süreyi artırın.`,
      });
    }
  }

  // 5) Ardışık sahnelerde aynı mekân, farklı günün saati → devamlılık uyarısı
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const curr = ordered[i]!;
    if (
      prev.locationName &&
      curr.locationName &&
      prev.locationName.toLocaleLowerCase("tr") === curr.locationName.toLocaleLowerCase("tr") &&
      prev.timeOfDay &&
      curr.timeOfDay &&
      prev.timeOfDay !== "belirsiz" &&
      curr.timeOfDay !== "belirsiz" &&
      prev.timeOfDay !== curr.timeOfDay
    ) {
      issues.push({
        severity: "warning",
        code: "LOCATION_TIME_JUMP",
        sceneId: curr.id,
        message: `"${curr.title}" sahnesi aynı mekânda (${curr.locationName}) ama günün saati öncekiyle çelişiyor (${prev.timeOfDay} → ${curr.timeOfDay}).`,
      });
    }
  }

  return issues;
}
