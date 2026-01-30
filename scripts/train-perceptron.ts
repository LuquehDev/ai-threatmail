import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { tokenize } from "../lib/ml/tokenize";
import { extractExtraCounts, makeText } from "../lib/ml/features";
import type { ModelJSON, ClassLabel } from "../lib/ml/model-types";
import { trainOVR, type SparseVec } from "../lib/ml/perceptron-ovr";

type RawRow = Record<string, unknown>;

const CLASSES: ClassLabel[] = ["LEGITIMO", "SPAM", "MALWARE"];

// Indicadores para “MALWARE” (rotulagem fraca, transparente no relatório)
const MALWARE_HINTS = [
  "macro",
  "macros",
  "enable",
  "content",
  "payload",
  "trojan",
  "ransom",
  "encrypted",
  "exe",
  "scr",
  "js",
  "vbs",
  "bat",
  "ps1",
  "jar",
  "iso",
  "img",
  "lnk",
  "hta",
  "invoice",
  "fatura",
  "payment",
  "pagamento",
  "attachment",
  "anexo",
];

function getStr(row: RawRow, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

function isSpamLabel(label: string): boolean {
  const v = (label ?? "").toString().trim().toLowerCase();
  // dataset Enron Spam Data: "spam" / "ham"
  if (v === "spam") return true;
  if (v === "ham") return false;

  // fallback genérico (caso uses outro CSV no futuro)
  return v === "1" || v === "true" || v === "yes";
}

function weakMalwareLabel(subject: string, body: string): boolean {
  const tokens = tokenize(makeText(subject, body));
  let hits = 0;
  for (const t of tokens) if (MALWARE_HINTS.includes(t)) hits++;
  return hits >= 2; // evita marcar tudo como malware
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildVocab(docs: string[][], topN: number): string[] {
  const freq = new Map<string, number>();
  for (const toks of docs) {
    for (const t of toks) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([t]) => t);
}

function computeIdf(docs: string[][], vocabIndex: Map<string, number>): number[] {
  const df = new Array(vocabIndex.size).fill(0);
  for (const toks of docs) {
    const seen = new Set<number>();
    for (const t of toks) {
      const i = vocabIndex.get(t);
      if (i !== undefined) seen.add(i);
    }
    for (const i of seen) df[i] += 1;
  }
  const N = docs.length;
  return df.map((dfi) => Math.log((N + 1) / (dfi + 1)) + 1);
}

function vectorize(
  toks: string[],
  vocabIndex: Map<string, number>,
  idf: number[],
  extra: {
    tokenCount: number;
    urlCount: number;
    suspiciousWordCount: number;
    upperRatio: number;
  }
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

function argMax(arr: number[]): number {
  let bestI = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[bestI]) bestI = i;
  return bestI;
}

async function main() {
  const csvPathArg = process.argv[2];
  if (!csvPathArg) {
    console.error("Uso: npx tsx scripts/train-perceptron.ts <path-para-csv>");
    process.exit(1);
  }

  const csvPath = path.resolve(csvPathArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV não encontrado: ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true }) as RawRow[];

  // preparar dataset com 3 classes
  const samples = records
    .map((r) => {
      // ✅ COLUNAS DO TEU CSV
      const subject = getStr(r, "Subject");
      const body = getStr(r, "Message");
      const spamHam = getStr(r, "Spam/Ham");

      const spam = isSpamLabel(spamHam);

      let label: ClassLabel = spam ? "SPAM" : "LEGITIMO";
      if (spam && weakMalwareLabel(subject, body)) label = "MALWARE";

      return { subject, body, label };
    })
    .filter((s) => s.subject || s.body);

  if (samples.length < 50) {
    console.error(
      `Poucas amostras válidas (${samples.length}). Confirma se o CSV tem as colunas: Subject, Message, Spam/Ham.`
    );
    process.exit(1);
  }

  shuffle(samples);

  // split 85/15
  const split = Math.floor(samples.length * 0.85);
  const train = samples.slice(0, split);
  const test = samples.slice(split);

  // tokenização
  const trainDocs = train.map((s) => tokenize(makeText(s.subject, s.body)));
  const testDocs = test.map((s) => tokenize(makeText(s.subject, s.body)));

  // vocab e idf
  const TOP_N = 25000;
  const vocab = buildVocab(trainDocs, TOP_N);
  const vocabIndex = new Map(vocab.map((t, i) => [t, i] as const));
  const idf = computeIdf(trainDocs, vocabIndex);

  const extraNames = ["tokenCount", "urlCount", "suspiciousWordCount", "upperRatio"];
  const dim = vocab.length + extraNames.length;

  // vectorizar
  const Xtrain: SparseVec[] = [];
  const ytrain: number[] = [];

  for (let i = 0; i < train.length; i++) {
    const s = train[i];
    const extra = extractExtraCounts(s.subject, s.body);
    const x = vectorize(trainDocs[i], vocabIndex, idf, extra);
    Xtrain.push(x);
    ytrain.push(CLASSES.indexOf(s.label));
  }

  // treinar (One-vs-Rest)
  const { W, b } = trainOVR({
    X: Xtrain,
    y: ytrain,
    numClasses: CLASSES.length,
    dim,
    epochs: 3,
    lr: 0.1,
  });

  // avaliação simples
  let correct = 0;
  for (let i = 0; i < test.length; i++) {
    const s = test[i];
    const extra = extractExtraCounts(s.subject, s.body);
    const x = vectorize(testDocs[i], vocabIndex, idf, extra);

    const scores = CLASSES.map((_, c) => {
      let sum = b[c];
      for (const [j, v] of x) sum += W[c][j] * v;
      return sum;
    });

    const pred = CLASSES[argMax(scores)];
    if (pred === s.label) correct++;
  }
  const acc = correct / test.length;
  console.log(`Teste: accuracy ~ ${(acc * 100).toFixed(2)}% em ${test.length} amostras`);

  // export
  const model: ModelJSON = {
    version: 1,
    vocab,
    idf,
    classes: CLASSES,
    weights: W.map((w) => Array.from(w)),
    bias: Array.from(b),
    extraFeatureNames: extraNames,
    thresholds: { spam: 0.7, malware: 0.8 },
  };

  const outDir = path.join(process.cwd(), "model");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "model.json"), JSON.stringify(model));
  console.log("Modelo guardado em: model/model.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});