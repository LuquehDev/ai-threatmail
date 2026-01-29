export type SparseVec = Map<number, number>;

export function dot(w: Float64Array, x: SparseVec): number {
  let s = 0;
  for (const [i, v] of x) s += w[i] * v;
  return s;
}

export function addScaled(w: Float64Array, x: SparseVec, scale: number) {
  for (const [i, v] of x) w[i] += scale * v;
}

export function trainOVR(opts: {
  X: SparseVec[];
  y: number[];          // class index 0..C-1
  numClasses: number;
  dim: number;
  epochs: number;
  lr: number;
}): { W: Float64Array[]; b: Float64Array } {
  const { X, y, numClasses, dim, epochs, lr } = opts;

  const W = Array.from({ length: numClasses }, () => new Float64Array(dim));
  const b = new Float64Array(numClasses);

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let n = 0; n < X.length; n++) {
      const x = X[n];
      const trueC = y[n];

      for (let c = 0; c < numClasses; c++) {
        const target = c === trueC ? 1 : -1;
        const score = dot(W[c], x) + b[c];
        const pred = score >= 0 ? 1 : -1;

        if (pred !== target) {
          addScaled(W[c], x, lr * target);
          b[c] += lr * target;
        }
      }
    }
  }

  return { W, b };
}
