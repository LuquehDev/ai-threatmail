import fs from "node:fs";
import path from "node:path";
import type { ClassLabel, ModelJSON } from "./model-types";
import { tokenize } from "./tokenize";
import { extractExtraCounts, makeText } from "./features";

type Result = {
  label: ClassLabel;
  score: number; // 0..100
  probs: Record<ClassLabel, number>;
  evidences: string[];
};

let cachedModel: ModelJSON | null = null;

function loadModel(): ModelJSON {
  if (cachedModel) return cachedModel;
  const p = path.join(process.cwd(), "model", "model.json");
  const raw = fs.readFileSync(p, "utf-8");
  cachedModel = JSON.parse(raw) as ModelJSON;
  return cachedModel!;
}

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);
  const exps = xs.map(x => Math.exp(x - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

export function classifyEmail(subject: string, body: string): Result {
  const model = loadModel();
  const text = makeText(subject, body);
  const toks = tokenize(text);

  const vocabIndex = new Map(model.vocab.map((t, i) => [t, i] as const));

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
  x.set(base + 0, Math.min(extra.tokenCount / 2000, 1));
  x.set(base + 1, Math.min(extra.urlCount / 50, 1));
  x.set(base + 2, Math.min(extra.suspiciousWordCount / 50, 1));
  x.set(base + 3, Math.min(extra.upperRatio, 1));

  // scores
  const scores = model.classes.map((_, c) => {
    let s = model.bias[c];
    const w = model.weights[c];
    for (const [j, v] of x) s += w[j] * v;
    return s;
  });

  const probsArr = softmax(scores);
  const probs = Object.fromEntries(
    model.classes.map((c, i) => [c, probsArr[i]])
  ) as Record<ClassLabel, number>;

  // label = argmax
  let best: ClassLabel = model.classes[0];
  for (const c of model.classes) if (probs[c] > probs[best]) best = c;

  const score = Math.round(probs[best] * 100);

  // evidences: top tokens por |peso * tfidf|
  const classIndex = model.classes.indexOf(best);
  const wBest = model.weights[classIndex];

  const evidencePairs: Array<{ token: string; strength: number }> = [];
  for (const [i, v] of x) {
    if (i >= model.vocab.length) continue; // ignora extras na lista de tokens
    const strength = Math.abs(wBest[i] * v);
    if (strength > 0) evidencePairs.push({ token: model.vocab[i], strength });
  }
  evidencePairs.sort((a, b) => b.strength - a.strength);
  const evidences = evidencePairs.slice(0, 12).map(e => e.token);

  return { label: best, score, probs, evidences };
}
