// IntentRouter.ts - Natural Language Prompt & Intent Dispatcher (Codex-style)
import { ParsedIntent } from '../session/types';

export class IntentRouter {
  /**
   * Parses user input text and resolves the appropriate image operation
   */
  public static parsePrompt(inputText: string): ParsedIntent {
    const raw = inputText.trim();
    const text = raw.toLowerCase();

    // 1. Slash Commands
    if (text.startsWith('/remove-bg') || text.startsWith('/nobg') || text.startsWith('/tach-nen')) {
      return { operation: 'remove_background', label: 'Tách nền 1-Click (BiRefNet SOTA)' };
    }
    if (text.startsWith('/vectorize') || text.startsWith('/svg')) {
      return { operation: 'vectorize', label: 'Vectorize sang SVG' };
    }
    if (text.startsWith('/upscale-4x') || text.includes('4x') || text.includes('4k')) {
      return { operation: 'upscale', label: 'Upscale 4x Ultra HD', factor: 4 };
    }
    if (text.startsWith('/upscale')) {
      return { operation: 'upscale', label: 'Upscale 2x HD', factor: 2 };
    }
    if (text.startsWith('/canny') || text.startsWith('/edge')) {
      return { operation: 'canny', label: 'Canny Edge Detection', preprocessor: 'canny' };
    }
    if (text.startsWith('/lineart') || text.startsWith('/sketch')) {
      return { operation: 'lineart', label: 'Line Art Extraction', preprocessor: 'lineart' };
    }
    if (text.startsWith('/mask')) {
      return { operation: 'mask', label: 'Trích xuất Mặt nạ (Mask)' };
    }
    if (text.startsWith('/caption') || text.startsWith('/alt')) {
      return { operation: 'caption', label: 'AI Image Caption & Alt-Text' };
    }
    if (text.startsWith('/extend') || text.startsWith('/outpaint')) {
      const promptParam = raw.replace(/^\/(extend|outpaint)\s*/i, '');
      return { operation: 'extend', label: 'Mở rộng khung hình (Extend)', promptText: promptParam };
    }
    if (text.startsWith('/white-bg') || text.startsWith('/whitebg') || text.startsWith('/ecommerce')) {
      return { operation: 'white_bg', label: 'Nền trắng Studio E-Commerce' };
    }
    if (text.startsWith('/avatar') || text.startsWith('/pfp')) {
      return { operation: 'avatar', label: 'Tạo Avatar Tròn / Bo góc' };
    }
    if (text.startsWith('/icons') || text.startsWith('/favicon')) {
      return { operation: 'icons', label: 'Xuất bộ Favicon & App Icons' };
    }
    if (text.startsWith('/webp') || text.startsWith('/export-webp')) {
      return { operation: 'export_webp', label: 'Nén Quick Export WebP (85%)' };
    }
    if (text.startsWith('/inpaint') || text.startsWith('/edit') || text.startsWith('/fill')) {
      const promptParam = raw.replace(/^\/(inpaint|edit|fill)\s*/i, '');
      return { operation: 'inpaint', label: 'Generative Inpaint Fill', promptText: promptParam };
    }

    // 2. Natural Language Intent Matching (Vietnamese & English)
    // Background Matting
    if (
      text.includes('tách nền') ||
      text.includes('xóa nền') ||
      text.includes('xóa phông') ||
      text.includes('bóc nền') ||
      text.includes('remove background') ||
      text.includes('remove bg') ||
      text.includes('cutout') ||
      text.includes('birefnet')
    ) {
      return { operation: 'remove_background', label: 'Tách nền 1-Click (BiRefNet SOTA)' };
    }

    // Vectorize / SVG
    if (
      text.includes('vector') ||
      text.includes('svg') ||
      text.includes('vectorize') ||
      text.includes('chuyển sang vector')
    ) {
      return { operation: 'vectorize', label: 'Vectorize sang SVG' };
    }

    // Upscale
    if (text.includes('4x') || text.includes('4k') || text.includes('cực nét')) {
      return { operation: 'upscale', label: 'Upscale 4x Ultra HD', factor: 4 };
    }
    if (
      text.includes('upscale') ||
      text.includes('phóng to') ||
      text.includes('làm nét') ||
      text.includes('tăng độ phân giải') ||
      text.includes('super resolution') ||
      text.includes('2x')
    ) {
      return { operation: 'upscale', label: 'Upscale 2x HD', factor: 2 };
    }

    // Canny & Edges
    if (text.includes('canny') || text.includes('đường viền') || text.includes('phát hiện biên') || text.includes('edge')) {
      return { operation: 'canny', label: 'Canny Edge Detection', preprocessor: 'canny' };
    }

    // Line Art
    if (text.includes('line art') || text.includes('lineart') || text.includes('nét vẽ') || text.includes('anime') || text.includes('sketch') || text.includes('phác thảo')) {
      return { operation: 'lineart', label: 'Line Art Extraction', preprocessor: 'lineart' };
    }

    // Caption & Alt Text
    if (text.includes('caption') || text.includes('mô tả') || text.includes('alt text') || text.includes('alt-text') || text.includes('chú thích ảnh')) {
      return { operation: 'caption', label: 'AI Image Caption & Alt-Text' };
    }

    // Mask
    if (text.includes('tạo mask') || text.includes('trích mask') || text.includes('mặt nạ') || text.includes('silhouette')) {
      return { operation: 'mask', label: 'Trích xuất Mặt nạ (Mask)' };
    }

    // Outpainting / Extend
    if (text.includes('mở rộng ảnh') || text.includes('nới rộng') || text.includes('outpaint') || text.includes('extend')) {
      return { operation: 'extend', label: 'Mở rộng khung hình (Extend)', promptText: raw };
    }

    // White Studio E-Commerce
    if (text.includes('nền trắng') || text.includes('phông trắng') || text.includes('white background') || text.includes('ecommerce') || text.includes('sản phẩm')) {
      return { operation: 'white_bg', label: 'Nền trắng Studio E-Commerce' };
    }

    // Avatar Maker
    if (text.includes('avatar') || text.includes('ảnh đại diện') || text.includes('hình tròn') || text.includes('profile')) {
      return { operation: 'avatar', label: 'Tạo Avatar Tròn / Bo góc' };
    }

    // Icons / Favicon
    if (text.includes('favicon') || text.includes('tạo icon') || text.includes('bộ icon') || text.includes('app icon')) {
      return { operation: 'icons', label: 'Xuất bộ Favicon & App Icons' };
    }

    // WebP Export
    if (text.includes('webp') || text.includes('nén ảnh') || text.includes('tối ưu dung lượng')) {
      return { operation: 'export_webp', label: 'Nén Quick Export WebP (85%)' };
    }

    // 3. Default: Generative Inpaint & Edit with user prompt
    return {
      operation: 'inpaint',
      label: `Chỉnh sửa Generative: "${raw}"`,
      promptText: raw
    };
  }
}
