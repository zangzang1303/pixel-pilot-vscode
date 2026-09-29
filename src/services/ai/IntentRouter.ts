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
    if (text.startsWith('/replace-bg') || text.startsWith('/bg ') || text.startsWith('/doi-nen')) {
      const promptParam = raw.replace(/^\/(replace-bg|bg|doi-nen)\s*/i, '').trim();
      return {
        operation: 'replace_bg',
        label: `Đổi nền AI: "${promptParam || 'Studio hiện đại'}"`,
        promptText: promptParam || 'luxury modern studio with soft lighting'
      };
    }
    if (text.startsWith('/anime')) {
      return { operation: 'style_transfer', style: 'anime', label: 'Phong cách Anime (Makoto Shinkai)' };
    }
    if (text.startsWith('/3d') || text.startsWith('/pixar')) {
      return { operation: 'style_transfer', style: '3d_pixar', label: 'Phong cách 3D Pixar Animation' };
    }
    if (text.startsWith('/pixel') || text.startsWith('/pixelart')) {
      return { operation: 'style_transfer', style: 'pixel_art', label: 'Phong cách Pixel Art 16-bit Retro' };
    }
    if (text.startsWith('/cyberpunk')) {
      return { operation: 'style_transfer', style: 'cyberpunk', label: 'Phong cách Cyberpunk Neon Synthwave' };
    }
    if (text.startsWith('/oil') || text.startsWith('/oilpainting')) {
      return { operation: 'style_transfer', style: 'oil_painting', label: 'Phong cách Tranh Sơn Dầu Cổ Điển' };
    }
    if (text.startsWith('/sketch') || text.startsWith('/chi-than')) {
      return { operation: 'style_transfer', style: 'sketch', label: 'Phong cách Phác thảo Chì Than' };
    }
    if (text.startsWith('/style')) {
      const styleName = raw.replace(/^\/style\s*/i, '').trim() || 'anime';
      return { operation: 'style_transfer', style: styleName, label: `Biến đổi phong cách: ${styleName}`, promptText: styleName };
    }
    if (text.startsWith('/hdr') || text.startsWith('/tang-sang')) {
      return { operation: 'enhance', enhanceType: 'hdr', label: 'Tăng sáng & Cân bằng HDR AI' };
    }
    if (text.startsWith('/enhance') || text.startsWith('/lam-net') || text.startsWith('/restore')) {
      return { operation: 'enhance', enhanceType: 'clarity', label: 'Nâng cấp làm nét & Khử mờ AI' };
    }
    if (text.startsWith('/vintage') || text.startsWith('/film')) {
      return { operation: 'enhance', enhanceType: 'vintage', label: 'Tone màu Vintage Film cổ điển' };
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
    if (text.startsWith('/lineart')) {
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

    // Background Replacement / Generative Background
    if (
      text.includes('thay nền') ||
      text.includes('đổi nền') ||
      text.includes('ghép nền') ||
      text.includes('tạo nền') ||
      text.includes('đổi phông') ||
      text.includes('chuyển nền') ||
      text.includes('replace background') ||
      text.includes('change background') ||
      text.includes('new background') ||
      (text.includes('nền') && (text.includes('bãi biển') || text.includes('hoàng hôn') || text.includes('studio') || text.includes('văn phòng') || text.includes('cyberpunk') || text.includes('thiên nhiên') || text.includes('vũ trụ') || text.includes('quán cà phê') || text.includes('gradient')))
    ) {
      // Clean query to formulate prompt
      let cleanPrompt = raw
        .replace(/^(hãy|làm ơn|vui lòng|giúp|tôi muốn|thay|đổi|tạo|ghép|chuyển)\s*/gi, '')
        .replace(/^(nền|phông nền|phông|background)\s*(thành|sang|cho|về)?\s*/gi, '')
        .trim();
      if (!cleanPrompt) cleanPrompt = 'luxury minimalist studio background';
      return {
        operation: 'replace_bg',
        label: `Đổi nền AI: "${cleanPrompt}"`,
        promptText: cleanPrompt
      };
    }

    // Background Matting / Removal
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

    // AI Style Transfer
    if (text.includes('anime') || text.includes('manga') || text.includes('hoạt hình nhật') || text.includes('ghibli')) {
      return { operation: 'style_transfer', style: 'anime', label: 'Phong cách Anime (Makoto Shinkai)', promptText: raw };
    }
    if (text.includes('pixar') || text.includes('disney') || text.includes('hoạt hình 3d') || (text.includes('3d') && text.includes('phong cách'))) {
      return { operation: 'style_transfer', style: '3d_pixar', label: 'Phong cách 3D Pixar Animation', promptText: raw };
    }
    if (text.includes('pixel') || text.includes('pixel art') || text.includes('8-bit') || text.includes('16-bit')) {
      return { operation: 'style_transfer', style: 'pixel_art', label: 'Phong cách Pixel Art 16-bit Retro', promptText: raw };
    }
    if (text.includes('cyberpunk') || text.includes('synthwave') || text.includes('neon') || text.includes('tương lai')) {
      return { operation: 'style_transfer', style: 'cyberpunk', label: 'Phong cách Cyberpunk Neon Synthwave', promptText: raw };
    }
    if (text.includes('sơn dầu') || text.includes('oil painting') || text.includes('tranh vẽ cổ điển')) {
      return { operation: 'style_transfer', style: 'oil_painting', label: 'Phong cách Tranh Sơn Dầu Cổ Điển', promptText: raw };
    }
    if (text.includes('chì than') || text.includes('phác thảo') || text.includes('sketch') || text.includes('bút chì')) {
      return { operation: 'style_transfer', style: 'sketch', label: 'Phong cách Phác thảo Chì Than', promptText: raw };
    }

    // AI Enhancements & Retouch
    if (text.includes('tăng sáng') || text.includes('hdr') || text.includes('cân bằng sáng') || text.includes('relight')) {
      return { operation: 'enhance', enhanceType: 'hdr', label: 'Tăng sáng & Cân bằng HDR AI' };
    }
    if (text.includes('vintage') || text.includes('màu phim') || text.includes('phim cổ điển') || text.includes('hoài cổ')) {
      return { operation: 'enhance', enhanceType: 'vintage', label: 'Tone màu Vintage Film cổ điển' };
    }
    if (text.includes('làm nét') || text.includes('khử mờ') || text.includes('làm rõ') || text.includes('phục hồi') || text.includes('deblur')) {
      return { operation: 'enhance', enhanceType: 'clarity', label: 'Nâng cấp làm nét & Khử mờ AI' };
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
    if (text.includes('line art') || text.includes('lineart') || text.includes('nét vẽ')) {
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

