// metrics.js - Mathematical evaluation metrics for computer vision matting
// Implements mIoU, Boundary F-score, Soft Matting Ratio, and SSIM

/**
 * Computes Mean Intersection over Union (mIoU) between two alpha masks
 * @param {Uint8Array} alphaA
 * @param {Uint8Array} alphaB
 * @param {number} threshold
 * @returns {number}
 */
export function compute_miou(alphaA, alphaB, threshold = 127) {
  let intersection = 0;
  let union = 0;
  const len = Math.min(alphaA.length, alphaB.length);

  for (let i = 0; i < len; i++) {
    const binA = alphaA[i] > threshold ? 1 : 0;
    const binB = alphaB[i] > threshold ? 1 : 0;
    if (binA && binB) intersection++;
    if (binA || binB) union++;
  }

  if (union === 0) return 1.0;
  return Number((intersection / union).toFixed(4));
}

/**
 * Computes Boundary F-score measuring precision and recall on high-frequency boundary edges
 * Uses Morphological Gradient simulation (Erosion operator)
 * @param {Uint8Array} alphaA
 * @param {Uint8Array} alphaB
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @returns {number}
 */
export function compute_boundary_f_score(alphaA, alphaB, width, height, radius = 2) {
  const size = width * height;
  const boundA = new Uint8Array(size);
  const boundB = new Uint8Array(size);

  // Compute morphological gradient on binary mask: boundary = mask & ~eroded(mask)
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = y * width + x;
      const valA = alphaA[idx] > 127 ? 1 : 0;
      const valB = alphaB[idx] > 127 ? 1 : 0;

      // Check if pixel is on the boundary by looking at immediate neighbors
      if (valA === 1) {
        let hasZeroNeighborA = false;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (alphaA[(y + dy) * width + (x + dx)] <= 127) {
              hasZeroNeighborA = true;
              break;
            }
          }
          if (hasZeroNeighborA) break;
        }
        if (hasZeroNeighborA) boundA[idx] = 1;
      }

      if (valB === 1) {
        let hasZeroNeighborB = false;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (alphaB[(y + dy) * width + (x + dx)] <= 127) {
              hasZeroNeighborB = true;
              break;
            }
          }
          if (hasZeroNeighborB) break;
        }
        if (hasZeroNeighborB) boundB[idx] = 1;
      }
    }
  }

  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < size; i++) {
    const a = boundA[i];
    const b = boundB[i];
    if (a === 1 && b === 1) tp++;
    else if (a === 1 && b === 0) fp++;
    else if (a === 0 && b === 1) fn++;
  }

  const precision = tp / (tp + fp + 1e-8);
  const recall = tp / (tp + fn + 1e-8);
  if (precision + recall === 0) return 0.0;
  const f1 = (2 * precision * recall) / (precision + recall);
  return Number(f1.toFixed(4));
}

/**
 * Analyzes alpha matte distribution (soft matting vs hard binarization)
 * @param {Uint8Array} alpha
 * @returns {{ totalPixels: number, transparent: number, opaque: number, softMatting: number, mattingRatio: number, entropy: number }}
 */
export function compute_matting_stats(alpha) {
  const total = alpha.length;
  let transparent = 0; // alpha == 0
  let opaque = 0;      // alpha == 255
  let soft = 0;        // 0 < alpha < 255
  const hist = new Uint32Array(256);

  for (let i = 0; i < total; i++) {
    const val = alpha[i];
    hist[val]++;
    if (val === 0) transparent++;
    else if (val === 255) opaque++;
    else soft++;
  }

  // Calculate Shannon entropy of the alpha channel
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > 0) {
      const p = hist[i] / total;
      entropy -= p * Math.log2(p);
    }
  }

  const mattingRatio = Number(((soft / total) * 100).toFixed(2));

  return {
    totalPixels: total,
    transparent,
    opaque,
    softMatting: soft,
    mattingRatio,
    entropy: Number(entropy.toFixed(3))
  };
}

/**
 * Computes Structural Similarity Index (SSIM) between two single-channel matrices (Alpha channels)
 * Standard formula with windowed mean, variance, and covariance
 * @param {Uint8Array} img1
 * @param {Uint8Array} img2
 * @returns {number}
 */
export function compute_ssim(img1, img2) {
  const len = Math.min(img1.length, img2.length);
  if (len === 0) return 0;

  let sum1 = 0, sum2 = 0;
  for (let i = 0; i < len; i++) {
    sum1 += img1[i];
    sum2 += img2[i];
  }
  const mean1 = sum1 / len;
  const mean2 = sum2 / len;

  let var1 = 0, var2 = 0, covar = 0;
  for (let i = 0; i < len; i++) {
    const diff1 = img1[i] - mean1;
    const diff2 = img2[i] - mean2;
    var1 += diff1 * diff1;
    var2 += diff2 * diff2;
    covar += diff1 * diff2;
  }
  var1 /= (len - 1);
  var2 /= (len - 1);
  covar /= (len - 1);

  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;

  const numerator = (2 * mean1 * mean2 + C1) * (2 * covar + C2);
  const denominator = (mean1 * mean1 + mean2 * mean2 + C1) * (var1 + var2 + C2);

  if (denominator === 0) return 1.0;
  return Number((numerator / denominator).toFixed(4));
}
