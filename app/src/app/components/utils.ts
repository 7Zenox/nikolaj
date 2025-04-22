// components/utils.ts

/** Euclidean distance between two 2‑D points */
function euclidean(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

/**
 * Compute the overall silhouette score for a clustering.
 *
 * @param features  Array of [lat, lon] points
 * @param labels    Array of integer cluster assignments, same length as features
 * @returns         The average silhouette score (–1 to +1)
 */
export function computeSilhouetteScore(
  features: [number, number][],
  labels: number[]
): number {
  const n = features.length;
  if (n === 0) return 0;

  // Group indices by cluster
  const clusters = new Map<number, number[]>();
  labels.forEach((c, i) => {
    const arr = clusters.get(c) ?? [];
    arr.push(i);
    clusters.set(c, arr);
  });

  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const ownLabel = labels[i];
    const ownGroup = clusters.get(ownLabel)!;

    // a(i): average distance to other points in the same cluster
    let a = 0;
    if (ownGroup.length > 1) {
      for (const j of ownGroup) {
        if (j === i) continue;
        a += euclidean(features[i], features[j]);
      }
      a /= (ownGroup.length - 1);
    }

    // b(i): minimum average distance to all other clusters
    let b = Infinity;
    for (const [otherLabel, idxs] of clusters.entries()) {
      if (otherLabel === ownLabel) continue;
      let sum = 0;
      for (const j of idxs) {
        sum += euclidean(features[i], features[j]);
      }
      b = Math.min(b, sum / idxs.length);
    }

    const s = b === Infinity && a === 0 ? 0 : (b - a) / Math.max(a, b);
    totalScore += s;
  }

  return totalScore / n;
}

/** Returns the minimum value in a number array */
export function getMin(arr: number[]): number {
  return arr.reduce((min, cur) => (cur < min ? cur : min), Infinity);
}

/** Returns the maximum value in a number array */
export function getMax(arr: number[]): number {
  return arr.reduce((max, cur) => (cur > max ? cur : max), -Infinity);
}
