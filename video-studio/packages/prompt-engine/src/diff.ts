import type { VideoPrompt } from "@studio/domain";

export interface PromptDiffEntry {
  /** Nokta ayraçlı alan yolu, ör. "camera.movement" */
  path: string;
  before: unknown;
  after: unknown;
}

/** İki prompt sürümü arasındaki alan bazlı farkları döndürür (sürüm karşılaştırma görünümü için). */
export function diffPrompts(before: VideoPrompt, after: VideoPrompt): PromptDiffEntry[] {
  const entries: PromptDiffEntry[] = [];
  walk(before, after, "", entries);
  return entries;
}

function walk(a: unknown, b: unknown, path: string, out: PromptDiffEntry[]): void {
  if (deepEqual(a, b)) return;

  const bothPlainObjects =
    isPlainObject(a) && isPlainObject(b) && !Array.isArray(a) && !Array.isArray(b);
  if (!bothPlainObjects) {
    out.push({ path: path || "(kök)", before: a, after: b });
    return;
  }

  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const key of [...keys].sort()) {
    walk(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      path ? `${path}.${key}` : key,
      out,
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}
