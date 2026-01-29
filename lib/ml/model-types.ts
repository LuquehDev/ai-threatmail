export type ClassLabel = "LEGITIMO" | "SPAM" | "MALWARE";

export type ModelJSON = {
  version: 1;
  vocab: string[];            // index -> token
  idf: number[];              // index -> idf
  classes: ClassLabel[];
  weights: number[][];        // [classIndex][featureIndex]  (featureIndex == vocabIndex + extraFeatures)
  bias: number[];             // [classIndex]
  extraFeatureNames: string[];// para debug/relatório
  thresholds: { spam: number; malware: number }; // regras score
};
