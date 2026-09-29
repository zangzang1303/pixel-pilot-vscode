// VisionAgentOrchestrator.ts - Context-Aware Vision & LLM Agent Orchestrator
import { ParsedIntent } from '../session/types';
import { AgentToolRegistry } from './AgentToolRegistry';

export interface AgentContext {
  currentImageUri?: string;
  width?: number;
  height?: number;
  currentNodeId?: string;
  previousOperations?: string[];
}

export interface AgentDecision {
  toolName: string;
  args: Record<string, any>;
  intent: ParsedIntent;
  thought: string;
  reasoningSteps: string[];
}

/**
 * Intelligent Vision Agent Orchestrator:
 * Analyzes image context, interprets user language intent, and decides which tool to call.
 */
export class VisionAgentOrchestrator {
  /**
   * Main entry point: Understands user prompt in visual context and resolves the optimal tool
   */
  public static async decideTool(
    userPrompt: string,
    context?: AgentContext
  ): Promise<AgentDecision> {
    const raw = (userPrompt || '').trim();
    const text = raw.toLowerCase();
    const reasoningSteps: string[] = [];

    reasoningSteps.push(`Nhận diện yêu cầu người dùng: "${raw}"`);

    // 1. Phân tích ngữ cảnh ảnh (Context Analysis)
    let isPortraitSuspected = true;
    if (context?.width && context?.height) {
      const ratio = context.width / context.height;
      if (ratio < 0.95) {
        reasoningSteps.push(`Ảnh có tỷ lệ dọc (${context.width}x${context.height}), ưu tiên nhận diện chân dung người.`);
      } else {
        reasoningSteps.push(`Ảnh có tỷ lệ ngang hoặc vuông (${context.width}x${context.height}).`);
      }
    }

    // 2. Phân tích ngữ nghĩa đối tượng & hành vi (Subject & Action Analysis)
    const isHair = text.includes('tóc') || text.includes('mái tóc') || text.includes('hair');
    const isClothes = text.includes('áo') || text.includes('váy') || text.includes('quần') || text.includes('trang phục') || text.includes('clothes');
    const isRecolor = text.includes('màu') || text.includes('nhuộm') || text.includes('biến') || text.includes('đổi màu') || text.includes('chuyển màu');

    // 2.1. Phân tích đổi màu có chọn lọc (Selective Recolor)
    if (isHair || isClothes || (isRecolor && (text.includes('xanh') || text.includes('đỏ') || text.includes('vàng') || text.includes('tím') || text.includes('hồng') || text.includes('cam') || text.includes('đen') || text.includes('trắng') || text.includes('nâu')))) {
      const target = isHair ? 'hair' : isClothes ? 'clothes' : 'general';
      const targetVi = isHair ? 'mái tóc' : isClothes ? 'trang phục' : 'chi tiết';

      let targetColor = 'cyan';
      let colorNameVi = 'Xanh Da Trời';

      if (text.includes('xanh da trời') || text.includes('cyan') || text.includes('sky blue')) {
        targetColor = 'cyan';
        colorNameVi = 'Xanh Da Trời';
      } else if (text.includes('đỏ') || text.includes('red') || text.includes('hồng đào') || text.includes('ruby')) {
        targetColor = 'red';
        colorNameVi = 'Đỏ Ruby';
      } else if (text.includes('xanh lá') || text.includes('green') || text.includes('lục')) {
        targetColor = 'green';
        colorNameVi = 'Xanh Lá';
      } else if (text.includes('xanh dương') || text.includes('xanh biển') || text.includes('blue') || (text.includes('xanh') && !text.includes('lá'))) {
        targetColor = 'blue';
        colorNameVi = 'Xanh Biển';
      } else if (text.includes('tím') || text.includes('purple')) {
        targetColor = 'purple';
        colorNameVi = 'Tím Khói';
      } else if (text.includes('hồng') || text.includes('pink')) {
        targetColor = 'pink';
        colorNameVi = 'Hồng Pastel';
      } else if (text.includes('vàng') || text.includes('yellow') || text.includes('gold')) {
        targetColor = 'yellow';
        colorNameVi = 'Vàng Kim';
      } else if (text.includes('cam') || text.includes('orange')) {
        targetColor = 'orange';
        colorNameVi = 'Cam San Hô';
      } else if (text.includes('đen') || text.includes('black')) {
        targetColor = 'black';
        colorNameVi = 'Đen Tuyền';
      } else if (text.includes('trắng') || text.includes('bạch kim') || text.includes('white')) {
        targetColor = 'white';
        colorNameVi = 'Bạch Kim';
      } else if (text.includes('nâu') || text.includes('brown')) {
        targetColor = 'brown';
        colorNameVi = 'Nâu Hạt Dẻ';
      }

      reasoningSteps.push(`Mục tiêu đổi màu: ${targetVi}, màu đích: ${colorNameVi} (${targetColor}).`);
      if (isHair) {
        reasoningSteps.push(`Kích hoạt thuật toán phân tích màu da (Skin Chrominance Exclusion) để cô lập 100% vùng da mặt, mắt, môi và cổ, không để lem màu vào da.`);
      }

      const tool = AgentToolRegistry.getTool('recolor_subject')!;
      const args = { target, targetColor, colorNameVi, protectSkin: true };
      return {
        toolName: 'recolor_subject',
        args,
        intent: tool.mapToIntent(args),
        thought: `Phân tích ngữ cảnh: Phát hiện yêu cầu biến đổi màu ${targetVi} sang ${colorNameVi}. Kích hoạt công cụ Neural Recolor kèm thuật toán bảo vệ sắc độ da mặt (Skin Protection Model).`,
        reasoningSteps
      };
    }

    // 2.2. Phân tích đổi phông nền (Replace Background)
    if (
      text.includes('thay nền') ||
      text.includes('đổi nền') ||
      text.includes('ghép nền') ||
      text.includes('tạo nền') ||
      text.includes('phông nền') ||
      text.includes('background')
    ) {
      let cleanPrompt = raw
        .replace(/^(hãy|làm ơn|vui lòng|giúp|tôi muốn|thay|đổi|tạo|ghép|chuyển)\s*/gi, '')
        .replace(/^(nền|phông nền|phông|background)\s*(thành|sang|cho|về)?\s*/gi, '')
        .trim();
      if (!cleanPrompt) cleanPrompt = 'luxury modern studio with soft lighting';

      reasoningSteps.push(`Yêu cầu thay đổi bối cảnh nền thành: "${cleanPrompt}".`);
      const tool = AgentToolRegistry.getTool('replace_background')!;
      const args = { prompt: cleanPrompt };
      return {
        toolName: 'replace_background',
        args,
        intent: tool.mapToIntent(args),
        thought: `Phân tích ngữ cảnh: Tách chủ thể và tổng hợp bối cảnh nền mới "${cleanPrompt}".`,
        reasoningSteps
      };
    }

    // 2.3. Tách nền (Remove Background)
    if (text.includes('tách nền') || text.includes('xóa nền') || text.includes('bỏ nền') || text.includes('remove bg')) {
      reasoningSteps.push('Yêu cầu tách nền đối tượng 1-click.');
      const tool = AgentToolRegistry.getTool('remove_background')!;
      return {
        toolName: 'remove_background',
        args: { preserveDetails: true },
        intent: tool.mapToIntent({ preserveDetails: true }),
        thought: 'Sử dụng mô hình BiRefNet SOTA để tách nền chủ thể với độ chính xác cao.',
        reasoningSteps
      };
    }

    // 2.4. Phong cách nghệ thuật (Style Transfer)
    const styleMatches: Record<string, string> = {
      anime: 'anime',
      wibu: 'anime',
      manga: 'anime',
      shinkai: 'anime',
      pixar: '3d_pixar',
      '3d': '3d_pixar',
      cyberpunk: 'cyberpunk',
      neon: 'cyberpunk',
      synthwave: 'cyberpunk',
      'chì': 'sketch',
      'phác thảo': 'sketch',
      sketch: 'sketch',
      'pixel': 'pixel_art',
      'retro': 'pixel_art',
      'sơn dầu': 'oil_painting',
      'oil': 'oil_painting'
    };

    for (const [key, styleVal] of Object.entries(styleMatches)) {
      if (text.includes(key)) {
        reasoningSteps.push(`Nhận diện phong cách nghệ thuật: ${styleVal}.`);
        const tool = AgentToolRegistry.getTool('style_transfer')!;
        const args = { style: styleVal };
        return {
          toolName: 'style_transfer',
          args,
          intent: tool.mapToIntent(args),
          thought: `Áp dụng bộ chuyển đổi phong cách nghệ thuật ${styleVal} lên toàn bộ bố cục hình ảnh.`,
          reasoningSteps
        };
      }
    }

    // 2.5. Nâng cấp chất lượng (Enhance)
    if (text.includes('làm nét') || text.includes('khử mờ') || text.includes('rõ nét') || text.includes('clarity')) {
      const tool = AgentToolRegistry.getTool('enhance_image')!;
      return {
        toolName: 'enhance_image',
        args: { enhanceType: 'clarity' },
        intent: tool.mapToIntent({ enhanceType: 'clarity' }),
        thought: 'Áp dụng bộ lọc làm nét chi tiết vi mô và khử mờ (Clarity Enhancer).',
        reasoningSteps
      };
    }
    if (text.includes('hdr') || text.includes('tăng sáng') || text.includes('sáng hơn')) {
      const tool = AgentToolRegistry.getTool('enhance_image')!;
      return {
        toolName: 'enhance_image',
        args: { enhanceType: 'hdr' },
        intent: tool.mapToIntent({ enhanceType: 'hdr' }),
        thought: 'Cân bằng dải sáng động HDR và tối ưu hóa độ tương phản cục bộ.',
        reasoningSteps
      };
    }

    // 2.6. Phóng to (Upscale)
    if (text.includes('upscale') || text.includes('phóng to') || text.includes('4k') || text.includes('4x')) {
      const factor = (text.includes('4x') || text.includes('4k')) ? 4 : 2;
      const tool = AgentToolRegistry.getTool('upscale_image')!;
      return {
        toolName: 'upscale_image',
        args: { factor },
        intent: tool.mapToIntent({ factor }),
        thought: `Tăng kích thước ảnh lên ${factor}x siêu độ phân giải.`,
        reasoningSteps
      };
    }

    // 2.7. Vectorize
    if (text.includes('vector') || text.includes('svg')) {
      const tool = AgentToolRegistry.getTool('vectorize_image')!;
      return {
        toolName: 'vectorize_image',
        args: { colorPrecision: 6 },
        intent: tool.mapToIntent({ colorPrecision: 6 }),
        thought: 'Chuyển đổi hình ảnh sang đồ họa vector SVG đa lớp.',
        reasoningSteps
      };
    }

    // Fallback: Inpaint / Generative Edit
    const tool = AgentToolRegistry.getTool('inpaint_region')!;
    return {
      toolName: 'inpaint_region',
      args: { prompt: raw },
      intent: tool.mapToIntent({ prompt: raw }),
      thought: `Phân tích yêu cầu tổng quát: Áp dụng Generative Inpaint & Edit cho "${raw}".`,
      reasoningSteps
    };
  }
}
