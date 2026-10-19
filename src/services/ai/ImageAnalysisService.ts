import sharp from 'sharp';
import { ComfyUIAdapter } from './ComfyUIAdapter';
import { ParsedIntent } from '../session/types';

export interface EditSuggestion {
  label: string;
  reason: string;
  intent: ParsedIntent;
}

export interface ImageAnalysis {
  width: number;
  height: number;
  meanLight: number;
  darkPercent: number;
  brightPercent: number;
  contrast: number;
  caption?: string;
  suggestions: EditSuggestion[];
}

/** Ground image advice in measured pixels and an optional local vision caption. */
export class ImageAnalysisService {
  public static async analyze(image: string, adapter = new ComfyUIAdapter()): Promise<ImageAnalysis> {
    const buffer = Buffer.from(image.replace(/^data:image\/[\w+.-]+;base64,/, ''), 'base64');
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (!width || !height) throw new Error('Không đọc được kích thước ảnh.');

    const { data, info } = await sharp(buffer).flatten({ background: '#ffffff' })
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const luminance: number[] = [];
    let sum = 0;
    let dark = 0;
    let bright = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const value = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      luminance.push(value);
      sum += value;
      if (value < 40) dark++;
      if (value > 245) bright++;
    }
    luminance.sort((a, b) => a - b);
    const count = luminance.length;
    const meanLight = Math.round(sum / count);
    const darkPercent = Math.round(dark / count * 100);
    const brightPercent = Math.round(bright / count * 100);
    const contrast = luminance[Math.floor(count * 0.90)] - luminance[Math.floor(count * 0.10)];

    let caption: string | undefined;
    try {
      const result = await adapter.generateCaption(image);
      if (result.success && result.metrics.model.startsWith('Florence') && result.textResult) caption = result.textResult.trim();
    } catch { /* Pixel measurements still work without ComfyUI. */ }

    const suggestions: EditSuggestion[] = [];
    if (Math.max(width, height) < 1100) {
      suggestions.push({ label: 'Phóng to 2x', reason: `Cạnh dài hiện ${Math.max(width, height)} px; có thể cần thêm độ phân giải khi xuất ảnh.`, intent: { operation: 'upscale', factor: 2, label: 'Phóng to 2x' } });
    }
    if (meanLight < 90 && darkPercent > 12 && brightPercent < 10) {
      suggestions.push({ label: 'Thử tăng sáng', reason: `${darkPercent}% điểm ảnh rất tối; xem bản xem trước trước khi giữ kết quả.`, intent: { operation: 'enhance', enhanceType: 'hdr', label: 'Thử tăng sáng' } });
    } else if (contrast < 85 && brightPercent < 10) {
      suggestions.push({ label: 'Thử tăng độ rõ', reason: `Khoảng sáng tối p10–p90 là ${contrast}/255; ảnh có thể hưởng lợi từ tăng tương phản.`, intent: { operation: 'enhance', enhanceType: 'clarity', label: 'Thử tăng độ rõ' } });
    }
    if (caption && /\b(person|woman|man|girl|boy|people|portrait|product|bottle|shoe|bag|cat|dog|animal|bird)\b/i.test(caption)) {
      suggestions.push({ label: 'Tách nền', reason: 'Ảnh có chủ thể được mô hình nhận diện; hữu ích nếu bạn cần ảnh ghép hoặc nền trong suốt.', intent: { operation: 'remove_background', label: 'Tách nền' } });
    }
    return { width, height, meanLight, darkPercent, brightPercent, contrast, caption, suggestions: suggestions.slice(0, 3) };
  }

  public static format(analysis: ImageAnalysis): string {
    const lines = [
      `Ảnh ${analysis.width} × ${analysis.height} px.`,
      analysis.caption ? `Nội dung (Florence-2): ${analysis.caption}` : 'Chưa có mô hình thị giác để nhận diện chủ thể; phần dưới dựa trên điểm ảnh.',
      `Ánh sáng trung bình ${analysis.meanLight}/255; vùng rất tối ${analysis.darkPercent}%, vùng rất sáng ${analysis.brightPercent}%; độ trải sáng p10–p90 ${analysis.contrast}/255.`
    ];
    if (analysis.brightPercent > 12) lines.push('Nhiều vùng gần trắng; nên kiểm tra chi tiết vùng sáng trước khi tăng sáng thêm.');
    if (analysis.suggestions.length) {
      lines.push('Gợi ý chỉnh sửa:');
      analysis.suggestions.forEach((item, index) => lines.push(`${index + 1}. ${item.label}: ${item.reason}`));
      lines.push('Chọn một gợi ý bên dưới để tạo bản chỉnh sửa mới; ảnh gốc vẫn nằm trong lịch sử phiên.');
    } else {
      lines.push('Chưa thấy vấn đề kỹ thuật rõ qua các phép đo này. Bạn có thể nêu mục tiêu cụ thể như tách nền, đổi màu hoặc sửa một vùng ảnh.');
    }
    return lines.join('\n');
  }

  public static context(analysis: ImageAnalysis): string {
    return this.format(analysis).replace(/Chọn một gợi ý[^\n]*/, '');
  }
}
