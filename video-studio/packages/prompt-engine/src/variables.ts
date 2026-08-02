/**
 * Şablon değişkenleri: ${var}, {{var}} ve [[var]] formatlarını tek modele indirger
 * (prompts.chat'in çoklu değişken formatı normalizasyonundan esinlenildi).
 */
const PATTERNS = [/\$\{([\w.-]+)\}/g, /\{\{\s*([\w.-]+)\s*\}\}/g, /\[\[\s*([\w.-]+)\s*\]\]/g];

export function detectVariables(text: string): string[] {
  const names = new Set<string>();
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1];
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

export function substituteVariables(text: string, values: Record<string, string>): string {
  let result = text;
  for (const pattern of PATTERNS) {
    result = result.replace(pattern, (whole, name: string) =>
      Object.prototype.hasOwnProperty.call(values, name) ? (values[name] as string) : whole,
    );
  }
  return result;
}
