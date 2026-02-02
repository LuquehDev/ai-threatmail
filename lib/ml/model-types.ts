export type ClassLabel = "LEGITIMO" | "SPAM" | "MALWARE";

export type ModelJSON = {
  version: 1;
  vocab: string[];            
  idf: number[];              
  classes: ClassLabel[];
  weights: number[][];        
  bias: number[];             
  extraFeatureNames: string[];
  thresholds: { spam: number; malware: number };
};
