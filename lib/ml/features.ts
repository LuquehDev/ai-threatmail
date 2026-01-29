import { tokenize, normalizeText } from "./tokenize";

export type ExtraCounts = {
  tokenCount: number;
  urlCount: number;
  suspiciousWordCount: number;
  upperRatio: number;
};

const SUSPICIOUS = [
  "urgente", "clique", "verifique", "conta", "senha", "bloqueada", "pagamento",
  "fatura", "invoice", "attachment", "anexo", "macro", "macros", "enable", "content",
  "atualize", "confirme", "prize", "winner", "security", "alert"
];

export function extractExtraCounts(subject: string, body: string): ExtraCounts {
  const raw = `${subject}\n${body}`;
  const norm = normalizeText(raw);

  const tokens = tokenize(norm);
  const urlCount = (raw.match(/https?:\/\/\S+/gi) ?? []).length;

  const suspiciousWordCount = tokens.reduce((acc, w) => acc + (SUSPICIOUS.includes(w) ? 1 : 0), 0);

  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const uppers = raw.replace(/[^A-ZÀ-ÖØ-Þ]/g, "");
  const upperRatio = letters.length > 0 ? uppers.length / letters.length : 0;

  return {
    tokenCount: tokens.length,
    urlCount,
    suspiciousWordCount,
    upperRatio,
  };
}

export function makeText(subject: string, body: string): string {
  return `${subject ?? ""}\n${body ?? ""}`;
}
