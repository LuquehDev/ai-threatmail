import type { VerdictLabel } from "@prisma/client";

export function combineVerdict(args: {
  perceptronLabel: VerdictLabel;
  perceptronScore: number;
  malwareHits: number;     
}): { finalLabel: VerdictLabel; finalScore: number } {
  const malwareBoost = Math.min(40, args.malwareHits * 20);
  const finalScore = Math.max(0, Math.min(100, Math.round(args.perceptronScore + malwareBoost)));

  if (args.malwareHits > 0) return { finalLabel: "MALWARE", finalScore };
  if (args.perceptronLabel === "MALWARE") return { finalLabel: "MALWARE", finalScore };
  if (finalScore >= 60) return { finalLabel: "SPAM", finalScore };
  return { finalLabel: "LEGITIMO", finalScore };
}
