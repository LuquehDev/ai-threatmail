export function normalizeText(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")           
    .replace(/https?:\/\/\S+/g, " URL ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")  
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  const t = normalizeText(s);
  if (!t) return [];
  return t.split(" ").filter(w => w.length >= 3 && w.length <= 24);
}
