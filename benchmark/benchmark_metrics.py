# benchmark_metrics.py
# Python academic evaluation suite for Alpha Matting and Image Segmentation
# Compatible with OpenCV and Scikit-Image

import os
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim

def compute_miou(pred_mask: np.ndarray, gt_mask: np.ndarray, threshold: int = 127) -> float:
    """Calculates Mean Intersection over Union (mIoU) between binary masks"""
    pred = (pred_mask > threshold).astype(np.uint8)
    gt = (gt_mask > threshold).astype(np.uint8)
    
    intersection = np.logical_and(pred, gt).sum()
    union = np.logical_or(pred, gt).sum()
    if union == 0:
        return 1.0
    return float(intersection / union)

def compute_boundary_f_score(pred_mask: np.ndarray, gt_mask: np.ndarray, bound_th: int = 3) -> float:
    """Measures precision and recall around the boundary contour using Morphological Gradient"""
    pred_bin = (pred_mask > 127).astype(np.uint8)
    gt_bin = (gt_mask > 127).astype(np.uint8)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (bound_th * 2 + 1, bound_th * 2 + 1))
    pred_bound = cv2.morphologyEx(pred_bin, cv2.MORPH_GRADIENT, kernel)
    gt_bound = cv2.morphologyEx(gt_bin, cv2.MORPH_GRADIENT, kernel)
    
    tp = np.logical_and(pred_bound, gt_bound).sum()
    fp = np.logical_and(pred_bound, np.logical_not(gt_bound)).sum()
    fn = np.logical_and(np.logical_not(pred_bound), gt_bound).sum()
    
    precision = tp / (tp + fp + 1e-8)
    recall = tp / (tp + fn + 1e-8)
    if precision + recall == 0:
        return 0.0
    return float(2 * (precision * recall) / (precision + recall))

def compute_matting_ratio(alpha_channel: np.ndarray) -> float:
    """Calculates percentage of soft alpha pixels (0 < alpha < 255)"""
    total = alpha_channel.size
    soft = np.logical_and(alpha_channel > 0, alpha_channel < 255).sum()
    return float((soft / total) * 100.0)

def evaluate_pair(pred_path: str, gt_path: str):
    pred = cv2.imread(pred_path, cv2.IMREAD_UNCHANGED)
    gt = cv2.imread(gt_path, cv2.IMREAD_UNCHANGED)
    
    pred_alpha = pred[:, :, 3] if pred.shape[2] == 4 else cv2.cvtColor(pred, cv2.COLOR_BGR2GRAY)
    gt_alpha = gt[:, :, 3] if gt.shape[2] == 4 else cv2.cvtColor(gt, cv2.COLOR_BGR2GRAY)
    
    miou = compute_miou(pred_alpha, gt_alpha)
    boundary_f = compute_boundary_f_score(pred_alpha, gt_alpha)
    sim = ssim(pred_alpha, gt_alpha)
    matting_ratio = compute_matting_ratio(pred_alpha)
    
    return {
        "mIoU": round(miou, 4),
        "Boundary_F": round(boundary_f, 4),
        "SSIM": round(sim, 4),
        "Matting_Ratio_Percent": round(matting_ratio, 2)
    }

if __name__ == "__main__":
    print("Benchmark Metrics Suite ready for evaluation.")
