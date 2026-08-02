import { stringify } from "yaml";
import type { VideoPrompt } from "@studio/domain";
import { compileToText } from "./compile.js";

export type PromptExportFormat = "json" | "yaml" | "text";

/** Prompt'u paylaşılabilir üç formattan birine serileştirir. API anahtarı/kişisel veri içermez. */
export function exportPrompt(prompt: VideoPrompt, format: PromptExportFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(prompt, null, 2);
    case "yaml":
      return stringify(prompt);
    case "text":
      return compileToText(prompt);
  }
}

export function exportFileName(format: PromptExportFormat): string {
  return `prompt.${format === "text" ? "txt" : format}`;
}
