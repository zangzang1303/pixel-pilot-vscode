// IAIProvider.ts - Interface abstraction for AI Vision Providers
import { AIResult } from '../session/types';

export interface IAIProvider {
  name: string;

  /**
   * Tách nền đối tượng sử dụng SOTA Alpha Matting (BiRefNet)
   */
  removeBackground(imageInput: string, options?: { model?: string }): Promise<AIResult>;

  /**
   * Nâng độ phân giải siêu nét (Super Resolution 2x/4x)
   */
  upscale(imageInput: string, factor: 2 | 4): Promise<AIResult>;

  /**
   * Chuyển đổi ảnh bitmap (PNG/JPG) sang định dạng vector SVG
   */
  vectorize(imageInput: string): Promise<AIResult>;

  /**
   * Chỉnh sửa ảnh theo vùng vẽ mask và câu lệnh văn bản (Inpaint / Generative Fill)
   */
  inpaint(imageInput: string, maskInput: string, prompt: string): Promise<AIResult>;

  /**
   * Trích xuất mặt nạ phân vùng nhị phân (Binary Mask Extraction)
   */
  extractMask(imageInput: string): Promise<AIResult>;

  /**
   * Nhận diện đường biên và nét vẽ (Canny, Lineart, SoftEdge, Depth)
   */
  detectEdges(imageInput: string, method: 'canny' | 'lineart' | 'softedge' | 'depth'): Promise<AIResult>;

  /**
   * Phân tích ảnh và tự động sinh câu mô tả (Alt Text / CSS / Code comments)
   */
  generateCaption(imageInput: string): Promise<AIResult>;

  /**
   * Mở rộng biên khung hình (Outpainting / Extend)
   */
  extendCanvas(imageInput: string, direction: 'all' | 'horizontal' | 'vertical', prompt?: string): Promise<AIResult>;
}
