import fs from "node:fs";
import path from "node:path";
import type { ClassLabel, ModelJSON } from "./model-types";
import { tokenize } from "./tokenize";
import { extractExtraCounts, makeText } from "./features";

export type PerceptronResult = {
  label: ClassLabel;
  score: number; // 0..100
  evidence: string[];
};

type HashedModel = {
  version: 1;
  kind: "hashed_perceptron";
  dim: number;
  bias: number;
  weights: number[];
  threshold: number;
  meta?: any;
};

let cachedAnyModel: ModelJSON | HashedModel | null = null;
let cachedVocabIndex: Map<string, number> | null = null;

function resolveModelPath(): string {
  return process.env.PERCEPTRON_MODEL_PATH ?? path.join(process.cwd(), "model", "model.json");
}

function isHashed(m: any): m is HashedModel {
  return m && m.kind === "hashed_perceptron" && typeof m.dim === "number" && Array.isArray(m.weights);
}

function loadAnyModel(): ModelJSON | HashedModel {
  if (cachedAnyModel) return cachedAnyModel;

  const p = resolveModelPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `Modelo do perceptron não encontrado em: ${p}. Garante que existe model/model.json (ou define PERCEPTRON_MODEL_PATH).`
    );
  }

  const raw = fs.readFileSync(p, "utf-8");
  const parsed = JSON.parse(raw);

  cachedAnyModel = parsed as any;

  // Só constrói vocabIndex se for TF-IDF (ModelJSON)
  if (!isHashed(parsed)) {
    const tfidf = parsed as ModelJSON;
    cachedVocabIndex = new Map(tfidf.vocab.map((t, i) => [t, i] as const));
  } else {
    cachedVocabIndex = null;
  }

  return cachedAnyModel!;
}

// ===== helpers hashed =====
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashedScore(model: HashedModel, tokens: string[]): number {
  let s = model.bias;
  const dimMask = model.dim - 1;

  // weights vem como number[]; usar acesso directo
  for (const tok of tokens) {
    const idx = fnv1a32(tok) & dimMask;
    s += model.weights[idx] ?? 0;
  }
  return s;
}

// comprime score para prob sem saturar tudo em 100
function sigmoid(x: number): number {
  // dividir por 6 reduz o “100 para tudo”
  const z = x / 6;
  return 1 / (1 + Math.exp(-z));
}

function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// ===== TF-IDF original (o teu) =====
function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * Classifica um email a partir de subject+body
 */
export function classifyEmail(subject: string, body: string): PerceptronResult {
  const modelAny = loadAnyModel();

  // -------------------------
  // (A) hashed_perceptron (Spam vs Ham)
  // -------------------------
  if (isHashed(modelAny)) {
    const text = makeText(subject, body);
    const toks = tokenize(text);

    const s = hashedScore(modelAny, toks);
    const pSpam = sigmoid(s); // 0..1
    const score = Math.round(pSpam * 100);

    const label: ClassLabel = pSpam >= 0.5 ? "SPAM" : "LEGITIMO";

    const extra = extractExtraCounts(subject, body);
    const evidence: string[] = [];
    if (extra.urlCount > 0) evidence.push(`Contém URLs (${extra.urlCount})`);
    if (extra.upperRatio >= 0.35) evidence.push("Uso elevado de MAIÚSCULAS");
    if (extra.suspiciousWordCount > 0) evidence.push(`Termos suspeitos (${extra.suspiciousWordCount})`);
    if (extra.tokenCount < 20) evidence.push("Mensagem muito curta");

    // Tokens “amostra” (não dá para provar pesos num modelo hashed)
    const sample = toks.slice(0, 10);
    if (sample.length) evidence.push(`Tokens (amostra): ${sample.join(", ")}`);

    return { label, score, evidence: evidence.slice(0, 6) };
  }

  // -------------------------
  // (B) TF-IDF multiclasses (o teu modelo antigo)
  // -------------------------
  const model = modelAny as ModelJSON;
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

  const x = new Map<number, number>();
  for (const [i, c] of tf) {
    const tfNorm = c / maxTF;
    x.set(i, tfNorm * model.idf[i]);
  }

  const extra = extractExtraCounts(subject, body);
  const base = model.vocab.length;
  x.set(base + 0, clamp01(extra.tokenCount / 2000));
  x.set(base + 1, clamp01(extra.urlCount / 50));
  x.set(base + 2, clamp01(extra.suspiciousWordCount / 50));
  x.set(base + 3, clamp01(extra.upperRatio));

  const scores = model.classes.map((_, c) => {
    let s2 = model.bias[c];
    const w = model.weights[c];
    for (const [j, v] of x) s2 += w[j] * v;
    return s2;
  });

  const probsArr = softmax(scores);

  let bestIndex = 0;
  for (let i = 1; i < probsArr.length; i++) if (probsArr[i] > probsArr[bestIndex]) bestIndex = i;

  const label = model.classes[bestIndex];
  const score = Math.round(probsArr[bestIndex] * 100);

  const wBest = model.weights[bestIndex];
  const tokenEvidencePairs: Array<{ token: string; strength: number }> = [];

  for (const [i, v] of x) {
    if (i >= model.vocab.length) continue;
    const strength = Math.abs(wBest[i] * v);
    if (strength > 0) tokenEvidencePairs.push({ token: model.vocab[i], strength });
  }

  tokenEvidencePairs.sort((a, b) => b.strength - a.strength);
  const topTokens = tokenEvidencePairs.slice(0, 8).map((e) => e.token);

  const featureEvidence: string[] = [];
  if (extra.urlCount > 0) featureEvidence.push(`Contém URLs (${extra.urlCount})`);
  if (extra.upperRatio >= 0.35) featureEvidence.push("Uso elevado de MAIÚSCULAS");
  if (extra.suspiciousWordCount > 0) featureEvidence.push(`Termos suspeitos (${extra.suspiciousWordCount})`);
  if (extra.tokenCount < 20) featureEvidence.push("Mensagem muito curta");
  if (extra.tokenCount > 1200) featureEvidence.push("Mensagem muito longa");

  const evidence = [
    ...featureEvidence,
    ...(topTokens.length ? [`Tokens relevantes: ${topTokens.join(", ")}`] : []),
  ].slice(0, 6);

  return { label, score, evidence };
}

export function classifyEmailText(fullText: string): PerceptronResult {
  return classifyEmail("", fullText);
}
