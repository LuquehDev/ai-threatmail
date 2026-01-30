import fs from "node:fs";
import path from "node:path";
import type { ClassLabel, ModelJSON } from "./model-types";
import { tokenize } from "./tokenize";
import { extractExtraCounts, makeText } from "./features";

export type PerceptronResult = {
  label: ClassLabel;
  score: number; // 0..100
  evidence: string[]; // lista curta e humana
};

let cachedModel: ModelJSON | null = null;
let cachedVocabIndex: Map<string, number> | null = null;

function resolveModelPath(): string {
  return (
    process.env.PERCEPTRON_MODEL_PATH ??
    path.join(process.cwd(), "model", "model.json")
  );
}

function loadModel(): ModelJSON {
  if (cachedModel) return cachedModel;

  const p = resolveModelPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `Modelo do perceptron não encontrado em: ${p}. Garante que existe model/model.json (ou define PERCEPTRON_MODEL_PATH).`
    );
  }

  const raw = fs.readFileSync(p, "utf-8");
  cachedModel = JSON.parse(raw) as ModelJSON;
  cachedVocabIndex = new Map(cachedModel.vocab.map((t, i) => [t, i] as const));

  return cachedModel!;
}

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Classifica um email a partir de subject+body
 */
export function classifyEmail(subject: string, body: string): PerceptronResult {
  const model = loadModel();
  const vocabIndex = cachedVocabIndex!;

  const text = makeText(subject, body);
  const toks = tokenize(text);

  // TF
  const tf = new Map<number, number>();
  for (const t of toks) {
    const i = vocabIndex.get(t);
    if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1);
  }

  let maxTF = 1;
  for (const v of tf.values()) if (v > maxTF) maxTF = v;

  // sparse vector (token features)
  const x = new Map<number, number>();
  for (const [i, c] of tf) {
    const tfNorm = c / maxTF;
    x.set(i, tfNorm * model.idf[i]);
  }

  // extras
  const extra = extractExtraCounts(subject, body);
  const base = model.vocab.length;
  x.set(base + 0, clamp01(extra.tokenCount / 2000));
  x.set(base + 1, clamp01(extra.urlCount / 50));
  x.set(base + 2, clamp01(extra.suspiciousWordCount / 50));
  x.set(base + 3, clamp01(extra.upperRatio));

  // scores
  const scores = model.classes.map((_, c) => {
    let s = model.bias[c];
    const w = model.weights[c];
    for (const [j, v] of x) s += w[j] * v;
    return s;
  });

  const probsArr = softmax(scores);

  // label = argmax
  let bestIndex = 0;
  for (let i = 1; i < probsArr.length; i++) {
    if (probsArr[i] > probsArr[bestIndex]) bestIndex = i;
  }
  const label = model.classes[bestIndex];

  const score = Math.round(probsArr[bestIndex] * 100);

  // evidências: top tokens por |peso * tfidf|
  const wBest = model.weights[bestIndex];
  const tokenEvidencePairs: Array<{ token: string; strength: number }> = [];

  for (const [i, v] of x) {
    if (i >= model.vocab.length) continue; // ignora extras na lista de tokens
    const strength = Math.abs(wBest[i] * v);
    if (strength > 0) tokenEvidencePairs.push({ token: model.vocab[i], strength });
  }

  tokenEvidencePairs.sort((a, b) => b.strength - a.strength);
  const topTokens = tokenEvidencePairs.slice(0, 8).map((e) => e.token);

  // evidências “humanas” (features)
  const featureEvidence: string[] = [];
  if (extra.urlCount > 0) featureEvidence.push(`Contém URLs (${extra.urlCount})`);
  if (extra.upperRatio >= 0.35) featureEvidence.push("Uso elevado de MAIÚSCULAS");
  if (extra.suspiciousWordCount > 0)
    featureEvidence.push(`Termos suspeitos (${extra.suspiciousWordCount})`);
  if (extra.tokenCount < 20) featureEvidence.push("Mensagem muito curta");
  if (extra.tokenCount > 1200) featureEvidence.push("Mensagem muito longa");

  // juntar evidências (curtas e úteis)
  const evidence = [
    ...featureEvidence,
    ...(topTokens.length ? [`Tokens relevantes: ${topTokens.join(", ")}`] : []),
  ].slice(0, 6);

  return { label, score, evidence };
}

/**
 * Classifica a partir de um texto completo (título+assunto+corpo já concatenados).
 * Útil para o teu fluxo /api/analysis/[id]/stream.
 */
export function classifyEmailText(fullText: string): PerceptronResult {
  return classifyEmail("", fullText);
}