export function normalizeText(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")           // strip HTML tags (simples)
    .replace(/https?:\/\/\S+/g, " URL ") // normaliza URLs
    .replace(/[^\p{L}\p{N}\s]/gu, " ")  // remove pontuação
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  const t = normalizeText(s);
  if (!t) return [];
  // tokens curtos demais tendem a ser ruído
  return t.split(" ").filter(w => w.length >= 3 && w.length <= 24);
}
