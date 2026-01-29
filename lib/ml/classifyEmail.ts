import fs from "node:fs";
import path from "node:path";
import { tokenize } from "@/lib/ml/tokenize";
import { extractExtraCounts, makeText } from "@/lib/ml/features";
import type { ModelJSON, ClassLabel } from "@/lib/ml/model-types";

export type VerdictLabel = "LEGITIMO" | "SPAM" | "MALWARE";

export type PerceptronResult = {
  label: VerdictLabel;
  score: number; // 0-100
  evidence: string[]; // frases curtas
};

type SparseVec = Map<number, number>;

const DEFAULT_MODEL_PATH = path.join(process.cwd(), "model", "model.json");

// cache global (evita ler o ficheiro a cada request)
const globalForModel = globalThis as unknown as { __perceptronModel?: ModelJSON };

function loadModel(): ModelJSON {
  if (globalForModel.__perceptronModel) return globalForModel.__perceptronModel;

  const p = process.env.PERCEPTRON_MODEL_PATH
    ? path.resolve(process.env.PERCEPTRON_MODEL_PATH)
    : DEFAULT_MODEL_PATH;

  if (!fs.existsSync(p)) {
    throw new Error(
      `Modelo do perceptron não encontrado em: ${p}. Garante que existe model/model.json (ou define PERCEPTRON_MODEL_PATH).`
    );
  }

  const raw = fs.readFileSync(p, "utf-8");
  const model = JSON.parse(raw) as ModelJSON;

  // validação mínima
  if (!model.vocab?.length || !model.idf?.length || !model.weights?.length) {
    throw new Error("model.json inválido (vocab/idf/weights em falta).");
  }

  globalForModel.__perceptronModel = model;
  return model;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function argMax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

function vectorize(
  toks: string[],
  vocabIndex: Map<string, number>,
  idf: number[],
  extra: { tokenCount: number; urlCount: number; suspiciousWordCount: number; upperRatio: number }
): SparseVec {
  const tf = new Map<number, number>();

  for (const t of toks) {
    const i = vocabIndex.get(t);
    if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1);
  }

  const x: SparseVec = new Map();

  let maxTF = 1;
  for (const v of tf.values()) if (v > maxTF) maxTF = v;

  for (const [i, c] of tf) {
    const tfNorm = c / maxTF;
    x.set(i, tfNorm * idf[i]);
  }

  const base = vocabIndex.size;
  x.set(base + 0, Math.min(extra.tokenCount / 2000, 1));
  x.set(base + 1, Math.min(extra.urlCount / 50, 1));
  x.set(base + 2, Math.min(extra.suspiciousWordCount / 50, 1));
  x.set(base + 3, Math.min(extra.upperRatio, 1));

  return x;
}

function buildEvidence(args: {
  model: ModelJSON;
  classIndex: number;
  x: SparseVec;
  maxItems?: number;
}): string[] {
  const { model, classIndex, x } = args;
  const maxItems = args.maxItems ?? 6;

  const W = model.weights[classIndex]; // number[]
  const vocabSize = model.vocab.length;
  const extras = model.extraFeatureNames ?? ["tokenCount", "urlCount", "suspiciousWordCount", "upperRatio"];

  // contribuições = w_j * x_j (ordenar desc)
  const contribs: Array<{ idx: number; value: number }> = [];
  for (const [j, v] of x) {
    const c = (W[j] ?? 0) * v;
    if (c > 0) contribs.push({ idx: j, value: c });
  }

  contribs.sort((a, b) => b.value - a.value);

  const ev: string[] = [];
  for (const item of contribs.slice(0, maxItems)) {
    const j = item.idx;
    if (j < vocabSize) {
      ev.push(`Indicador lexical: "${model.vocab[j]}"`);
    } else {
      const k = j - vocabSize;
      const name = extras[k] ?? `extra_${k}`;
      if (name === "urlCount") ev.push("Presença de links/URLs no email.");
      else if (name === "upperRatio") ev.push("Percentagem elevada de maiúsculas (tom alarmista).");
      else if (name === "suspiciousWordCount") ev.push("Ocorrência de palavras consideradas suspeitas.");
      else if (name === "tokenCount") ev.push("Comprimento/volume de texto fora do padrão.");
      else ev.push(`Feature adicional: ${name}`);
    }
  }

  // fallback
  if (!ev.length) return ["Sem evidências fortes detetadas (confiança baixa/moderada)."];
  return ev;
}

function coerceVerdictLabel(x: ClassLabel): VerdictLabel {
  if (x === "LEGITIMO" || x === "SPAM" || x === "MALWARE") return x;
  // fallback defensivo
  return "LEGITIMO";
}

/**
 * Classifica texto do email (título+assunto+corpo) usando o modelo treinado.
 * Devolve label (3 classes), score 0-100 e evidências.
 */
export async function classifyEmail(text: string): Promise<PerceptronResult> {
  const model = loadModel();

  // montar índices
  const vocabIndex = new Map(model.vocab.map((t, i) => [t, i] as const));

  // features
  const toks = tokenize(text);
  const extra = extractExtraCounts("", text); // subject vazio aqui; o text já vem combinado
  const x = vectorize(toks, vocabIndex, model.idf, extra);

  // logits por classe
  const logits = model.classes.map((_, c) => {
    let sum = model.bias[c] ?? 0;
    const W = model.weights[c];
    for (const [j, v] of x) sum += (W[j] ?? 0) * v;
    return sum;
  });

  // prob via softmax (interpretação mais simples)
  const probs = softmax(logits);
  const best = argMax(probs);

  const pred = model.classes[best];
  const label = coerceVerdictLabel(pred);

  const score = Math.max(0, Math.min(100, Math.round((probs[best] ?? 0) * 100)));

  const evidence = buildEvidence({
    model,
    classIndex: best,
    x,
    maxItems: 6,
  });

  return { label, score, evidence };
}

/**
 * Helper opcional: cria o texto combinado (título+assunto+corpo) no mesmo estilo do treino.
 * Usa isto na rota antes de chamar classifyEmail().
 */
export function makeEmailText(subject: string, body: string) {
  return makeText(subject ?? "", body ?? "");
}
