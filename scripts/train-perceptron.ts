// scripts/train-perceptron.ts
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";

type Row = {
  label?: string; // Spam | Ham
  text?: string;

  // fallbacks (caso uses outro CSV)
  "Spam/Ham"?: string;
  Message?: string;
  Subject?: string;
  message?: string;
  subject?: string;
  file?: string;
  "Message ID"?: string;
};

type Model = {
  version: 1;
  kind: "hashed_perceptron";
  dim: number;
  bias: number;
  weights: number[];
  threshold: number; // 0
  meta: {
    trainedAt: string;
    epochs: number;
    lr: number;
    testSplitMod: number;
    testSplitRemainder: number;
    seenTrain: number;
    seenTest: number;
    skipped: number;
  };
};

const DIM = 1 << 16; // 65536
const EPOCHS = 3;
const LR = 1;
const TEST_SPLIT_MOD = 10; // 10% teste
const TEST_SPLIT_REMAINDER = 0;

function pick(row: Row, keys: (keyof Row)[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

// Tokenização simples e robusta
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// FNV-1a 32-bit
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// split determinístico (não depende da ordem do CSV)
function isTestRow(row: Row): boolean {
  const id = pick(row, ["file", "Message ID"]);
  const txt = pick(row, ["text", "Message", "message"]).slice(0, 80);
  const key = `${id}|${txt}`;
  return fnv1a32(key) % TEST_SPLIT_MOD === TEST_SPLIT_REMAINDER;
}

function labelFromRow(row: Row): 0 | 1 | null {
  const raw = pick(row, ["label", "Spam/Ham"]).toLowerCase().trim();
  if (!raw) return null;

  if (raw === "spam") return 1;
  if (raw === "ham") return 0;

  if (raw === "1" || raw === "true" || raw === "yes") return 1;
  if (raw === "0" || raw === "false" || raw === "no") return 0;

  return null;
}

function textFromRow(row: Row): string {
  // dataset novo: label + text
  const txt = pick(row, ["text"]);
  if (txt) return txt;

  // fallback genérico
  const subject = pick(row, ["Subject", "subject"]);
  const msg = pick(row, ["Message", "message"]);
  return `${subject}\n${msg}`.trim();
}

function hashedFeatures(tokens: string[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const tok of tokens) {
    const idx = fnv1a32(tok) & (DIM - 1);
    m.set(idx, (m.get(idx) ?? 0) + 1);
  }
  return m;
}

function score(weights: Float64Array, bias: number, feats: Map<number, number>): number {
  let s = bias;
  for (const [idx, c] of feats) s += weights[idx] * c;
  return s;
}

function predict(weights: Float64Array, bias: number, feats: Map<number, number>): 0 | 1 {
  return score(weights, bias, feats) >= 0 ? 1 : 0;
}

// CSV streaming (tolerante)
async function* readCsvRows(csvPath: string): AsyncGenerator<Row> {
  const rs = fs.createReadStream(csvPath);

  const parser = parse({
    columns: true,
    bom: true,
    trim: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    relax_column_count_less: true,
    relax_column_count_more: true,
    skip_records_with_error: true,
  });

  rs.pipe(parser);

  try {
    for await (const record of parser) {
      yield record as Row;
    }
  } catch (e: any) {
    // Se o CSV for “sujo” no fim (quote aberta), aproveita o que já leu
    if (String(e?.code ?? "").includes("CSV_QUOTE_NOT_CLOSED")) {
      console.warn("Aviso: CSV com quote não fechado no fim. A treinar com registos válidos lidos.");
      return;
    }
    throw e;
  }
}

async function train(csvPath: string) {
  const weights = new Float64Array(DIM);
  let bias = 0;

  let skipped = 0;
  let seenTrainTotal = 0;

  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    let seen = 0;
    let updates = 0;
    let lines = 0;

    for await (const row of readCsvRows(csvPath)) {
      lines++;

      const y = labelFromRow(row);
      if (y === null) {
        skipped++;
        continue;
      }

      if (isTestRow(row)) continue;

      const text = textFromRow(row);
      if (!text) {
        skipped++;
        continue;
      }

      const feats = hashedFeatures(tokenize(text));
      const yhat = predict(weights, bias, feats);

      if (yhat !== y) {
        const delta = (y === 1 ? 1 : -1) * LR;
        for (const [idx, c] of feats) weights[idx] += delta * c;
        bias += delta;
        updates++;
      }

      seen++;
      if (lines % 200_000 === 0) {
        console.log(
          `[epoch ${epoch}/${EPOCHS}] linhas=${lines.toLocaleString()} seen=${seen.toLocaleString()} updates=${updates.toLocaleString()} skipped=${skipped.toLocaleString()}`
        );
      }
    }

    seenTrainTotal += seen;
    console.log(`[epoch ${epoch}/${EPOCHS}] DONE seen=${seen} updates=${updates} skipped=${skipped}`);
  }

  // avaliação
  let tp = 0, tn = 0, fp = 0, fn = 0;
  let seenTest = 0;

  for await (const row of readCsvRows(csvPath)) {
    const y = labelFromRow(row);
    if (y === null) continue;

    if (!isTestRow(row)) continue;

    const text = textFromRow(row);
    if (!text) continue;

    const feats = hashedFeatures(tokenize(text));
    const yhat = predict(weights, bias, feats);

    if (y === 1 && yhat === 1) tp++;
    else if (y === 0 && yhat === 0) tn++;
    else if (y === 0 && yhat === 1) fp++;
    else if (y === 1 && yhat === 0) fn++;

    seenTest++;
  }

  const total = tp + tn + fp + fn;
  const acc = total ? ((tp + tn) / total) * 100 : 0;

  console.log(`\n[Test] total=${total} tp=${tp} tn=${tn} fp=${fp} fn=${fn}`);
  console.log(`[Test] accuracy=${acc.toFixed(2)}%`);

  const model: Model = {
    version: 1,
    kind: "hashed_perceptron",
    dim: DIM,
    bias,
    weights: Array.from(weights),
    threshold: 0,
    meta: {
      trainedAt: new Date().toISOString(),
      epochs: EPOCHS,
      lr: LR,
      testSplitMod: TEST_SPLIT_MOD,
      testSplitRemainder: TEST_SPLIT_REMAINDER,
      seenTrain: seenTrainTotal,
      seenTest,
      skipped,
    },
  };

  const outDir = path.join(process.cwd(), "model");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "model.json"), JSON.stringify(model));
  console.log(`\nOK: gravado em ${path.join("model", "model.json")}`);
}

async function main() {
  const csvPathArg = process.argv[2];
  if (!csvPathArg) {
    console.log("Uso: npx tsx scripts/train-perceptron.ts <path-para-csv>");
    process.exit(1);
  }

  const csvPath = path.resolve(csvPathArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV não encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log(`A ler CSV em stream: ${csvPath}`);
  await train(csvPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
