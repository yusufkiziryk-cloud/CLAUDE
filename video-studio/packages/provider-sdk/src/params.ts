import type { ParamSpec, ValidationIssue } from "./types.js";

/**
 * İstekle gelen modele özgü parametreleri manifest beyanına göre doğrular.
 * Beyan edilmemiş anahtar SESSİZCE YUTULMAZ → 'unsupported' issue döner.
 */
export function validateParams(
  params: Record<string, string | number | boolean>,
  declared: Record<string, ParamSpec>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [key, value] of Object.entries(params)) {
    const spec = declared[key];
    if (!spec) {
      issues.push({
        field: `params.${key}`,
        message: `Bu model '${key}' parametresini desteklemiyor.`,
        kind: "unsupported",
      });
      continue;
    }
    if (spec.type === "enum") {
      if (typeof value !== "string" || !(spec.values ?? []).includes(value)) {
        issues.push({
          field: `params.${key}`,
          message: `Geçerli değerler: ${(spec.values ?? []).join(", ")}.`,
          kind: "invalid",
        });
      }
    } else if (spec.type === "number" || spec.type === "integer") {
      if (typeof value !== "number") {
        issues.push({ field: `params.${key}`, message: "Sayı bekleniyor.", kind: "invalid" });
      } else {
        if (spec.min !== undefined && value < spec.min) {
          issues.push({
            field: `params.${key}`,
            message: `En az ${spec.min} olmalı.`,
            kind: "invalid",
          });
        }
        if (spec.max !== undefined && value > spec.max) {
          issues.push({
            field: `params.${key}`,
            message: `En çok ${spec.max} olmalı.`,
            kind: "invalid",
          });
        }
        if (spec.type === "integer" && !Number.isInteger(value)) {
          issues.push({ field: `params.${key}`, message: "Tam sayı bekleniyor.", kind: "invalid" });
        }
      }
    } else if (spec.type === "boolean" && typeof value !== "boolean") {
      issues.push({ field: `params.${key}`, message: "true/false bekleniyor.", kind: "invalid" });
    } else if (spec.type === "string" && typeof value !== "string") {
      issues.push({ field: `params.${key}`, message: "Metin bekleniyor.", kind: "invalid" });
    }
  }
  return issues;
}
