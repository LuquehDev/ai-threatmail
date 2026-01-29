import type { VerdictLabel } from "@/lib/ml/classifyEmail";

export function combineVerdict(args: {
  perceptronLabel: VerdictLabel;
  perceptronScore: number; // 0-100
  malwareHits: number;     // 0..N
}): { finalLabel: VerdictLabel; finalScore: number } {
  // malware pesa bastante; ajusta depois no relatório se precisares
  const malwareBoost = Math.min(40, args.malwareHits * 20); // 0, 20, 40...
  const finalScore = Math.max(0, Math.min(100, Math.round(args.perceptronScore + malwareBoost)));

  // regra simples e justificável
  if (args.malwareHits > 0) return { finalLabel: "MALWARE", finalScore };
  if (args.perceptronLabel === "MALWARE") return { finalLabel: "MALWARE", finalScore };
  if (finalScore >= 60) return { finalLabel: "SPAM", finalScore };
  return { finalLabel: "LEGITIMO", finalScore };
}
