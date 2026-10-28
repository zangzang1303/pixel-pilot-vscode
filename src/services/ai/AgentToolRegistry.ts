// AgentToolRegistry.ts - Standardized Visual AI Tool Registry & Function Calling Schemas
import { OperationType, ParsedIntent } from '../session/types';

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: (string | number)[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  displayName: string;
  category: 'core' | 'background' | 'style' | 'enhance' | 'recolor' | 'export';
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
  mapToIntent: (args: Record<string, any>) => ParsedIntent;
  executor?: (context: any, args: Record<string, any>) => Promise<any>;
  capability?: 'sharp' | 'comfyui' | 'invokeai' | 'runware';
  unavailableReason?: string;
}

export interface ValidatedToolCall {
  tool: ToolDefinition;
  args: Record<string, unknown>;
  intent: ParsedIntent;
}

/**
 * A tool call is untrusted input even when it came from a model provider.
 * Keeping this error separate lets callers show a useful message without
 * silently substituting a different editing operation.
 */
export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

/**
 * Registry of all concrete image editing primitives available in Pixel Pilot.
 * Compatible with OpenAI / Gemini Function Calling format.
 */
export class AgentToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  static {
    // 1. Tool Change Background Color (Dedicated Background Replacement with 100% Subject Preservation)
    this.register({
      name: 'change_background_color',
      displayName: 'Đổi màu phông nền (Background Color)',
      category: 'background',
      description: 'Phát hiện biên chủ thể và đổi toàn bộ màu sắc của phông nền phía sau sang một màu đơn sắc hoặc gradient mới (Đỏ, Xanh biển, Trắng Studio, Đen Tuyền, Vàng, Hồng, Tím, Cam, Xám...), bảo toàn 100% nhân vật/vật thể (khuôn mặt, mái tóc, trang phục) phía trước.',
      parameters: {
        type: 'object',
        properties: {
          color: {
            type: 'string',
            description: 'Mã màu sắc đích cho phông nền',
            enum: ['red', 'blue', 'cyan', 'green', 'purple', 'pink', 'yellow', 'orange', 'black', 'white', 'brown', 'gray']
          },
          colorNameVi: {
            type: 'string',
            description: 'Tên màu sắc tiếng Việt (ví dụ: Đỏ Ruby, Xanh Biển, Trắng Studio, Đen Tuyền...)'
          }
        },
        required: ['color']
      },
      mapToIntent: (args) => {
        const colorMap: Record<string, string> = {
          red: 'Đỏ Ruby',
          blue: 'Xanh Biển',
          cyan: 'Xanh Da Trời',
          green: 'Xanh Lá',
          white: 'Trắng Studio',
          black: 'Đen Tuyền',
          yellow: 'Vàng Kim',
          purple: 'Tím Khói',
          pink: 'Hồng Pastel',
          orange: 'Cam San Hô',
          brown: 'Nâu Hạt Dẻ',
          gray: 'Xám Hiện Đại'
        };
        const colorLabel = args.colorNameVi || colorMap[args.color] || args.color;
        return {
          operation: 'change_bg_color',
          label: `Đổi màu nền sang ${colorLabel} (Bảo toàn chủ thể)`,
          colorTarget: 'background',
          targetColor: args.color,
          promptText: args.color
        };
      }
    });

    // 2. Tool Recolor (Selective Object / Hair / Clothes Recolor with Skin Protection)
    this.register({
      name: 'recolor_subject',
      displayName: 'Đổi màu có chọn lọc (Recolor)',
      category: 'recolor',
      description: 'Phân tích bức ảnh và đổi màu MÁI TÓC hoặc TRANG PHỤC của nhân vật sang màu sắc mới, tự động kích hoạt bộ lọc bảo vệ da mặt (Skin-Tone Protection). CHÚ Ý: CHỈ dùng cho tóc hoặc áo quần, TUYỆT ĐỐI KHÔNG dùng khi người dùng yêu cầu đổi màu nền (đổi màu nền phải dùng change_background_color).',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Đối tượng cần đổi màu (chỉ tóc hoặc trang phục)',
            enum: ['hair', 'clothes'],
            default: 'hair'
          },
          targetColor: {
            type: 'string',
            description: 'Màu sắc đích cần chuyển đổi sang',
            enum: ['cyan', 'blue', 'red', 'green', 'purple', 'pink', 'yellow', 'orange', 'black', 'white', 'brown']
          },
          colorNameVi: {
            type: 'string',
            description: 'Tên màu sắc tiếng Việt (ví dụ: Xanh Da Trời, Đỏ Ruby, Xanh Biển...)'
          },
          protectSkin: {
            type: 'boolean',
            description: 'Có kích hoạt bộ lọc bảo vệ sắc độ da mặt và cơ thể không (mặc định luôn true)',
            default: true
          }
        },
        required: ['target', 'targetColor']
      },
      mapToIntent: (args) => {
        const targetLabel = args.target === 'hair' ? 'mái tóc' : 'trang phục';
        const colorLabel = args.colorNameVi || args.targetColor;
        return {
          operation: 'recolor',
          label: `Biến đổi màu ${targetLabel} sang ${colorLabel} (Bảo vệ da mặt)`,
          colorTarget: args.target === 'clothes' ? 'clothes' : 'hair',
          targetColor: args.targetColor || 'cyan'
        };
      }
    });

    // 2. Tool Remove Background (BiRefNet SOTA)
    this.register({
      name: 'remove_background',
      displayName: 'Tách nền AI (BiRefNet)',
      category: 'background',
      description: 'Tách nền đối tượng chính (người, sản phẩm, vật thể) ra khỏi phông nền với chất lượng cao chuẩn SOTA BiRefNet, giữ nguyên từng sợi tóc và viền mượt.',
      parameters: {
        type: 'object',
        properties: {
          preserveDetails: {
            type: 'boolean',
            description: 'Giữ lại tối đa chi tiết sợi tóc và biên mờ',
            default: true
          }
        }
      },
      mapToIntent: () => ({
        operation: 'remove_background',
        label: 'Tách nền 1-Click (BiRefNet SOTA)'
      })
    });

    // 3. Tool Replace Background
    this.register({
      name: 'replace_background',
      displayName: 'Đổi phông nền AI',
      category: 'background',
      description: 'Thay thế phông nền hiện tại của bức ảnh bằng một bối cảnh mới (Bãi biển hoàng hôn, Studio chuyên nghiệp, Cyberpunk neon, Quán cà phê, Thiên nhiên...).',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Mô tả bối cảnh phông nền mới'
          },
          preset: {
            type: 'string',
            description: 'Gợi ý phong cách nền nhanh',
            enum: ['beach_sunset', 'luxury_studio', 'cyberpunk_city', 'minimalist_gradient', 'nature_forest']
          }
        },
        required: ['prompt']
      },
      mapToIntent: (args) => ({
        operation: 'replace_bg',
        label: `Đổi nền AI: "${args.prompt}"`,
        promptText: args.prompt,
        bgPreset: args.preset
      })
    });

    // 4. Tool Inpaint & Generative Fill
    this.register({
      name: 'inpaint_region',
      displayName: 'Cọ vẽ Generative Inpaint',
      category: 'core',
      description: 'Chỉnh sửa, xóa vật thể hoặc vẽ bù sinh ảnh tại một vùng chọn cụ thể theo cọ vẽ hoặc câu lệnh.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Mô tả nội dung muốn thay đổi hoặc vẽ thêm'
          },
          maskUri: {
            type: 'string',
            description: 'Đường dẫn mặt nạ mask nhị phân (nếu người dùng dùng cọ vẽ)'
          }
        },
        required: ['prompt']
      },
      mapToIntent: (args) => ({
        operation: 'inpaint',
        label: `Generative Inpaint: "${args.prompt}"`,
        promptText: args.prompt
      })
    });

    // 5. Tool Enhance Quality (Clarity, HDR, Vintage)
    this.register({
      name: 'enhance_image',
      displayName: 'Nâng cấp chất lượng ảnh',
      category: 'enhance',
      description: 'Tăng cường chất lượng hình ảnh: làm nét khử mờ (clarity), tăng dải sáng động cân bằng HDR, hoặc áp tone màu vintage film.',
      parameters: {
        type: 'object',
        properties: {
          enhanceType: {
            type: 'string',
            description: 'Chế độ tăng cường hình ảnh',
            enum: ['clarity', 'hdr', 'vintage', 'face_restore'],
            default: 'clarity'
          }
        },
        required: ['enhanceType']
      },
      mapToIntent: (args) => {
        const type = args.enhanceType || 'clarity';
        const labels: Record<string, string> = {
          clarity: 'Nâng cấp làm nét & Khử mờ AI',
          hdr: 'Tăng sáng & Cân bằng HDR AI',
          vintage: 'Tone màu Vintage Film cổ điển',
          face_restore: 'Phục hồi & Làm mịn da mặt AI'
        };
        return {
          operation: 'enhance',
          label: labels[type] || 'Nâng cấp chất lượng AI',
          enhanceType: type
        };
      }
    });

    // 6. Tool Style Transfer
    this.register({
      name: 'style_transfer',
      displayName: 'Chuyển đổi phong cách (Style Transfer)',
      category: 'style',
      description: 'Chuyển đổi toàn bộ bức ảnh sang phong cách mỹ thuật đặc trưng (Anime Makoto Shinkai, 3D Pixar Animation, Cyberpunk Synthwave, Phác thảo chì Sketch, Pixel Art 16-bit, Tranh sơn dầu).',
      parameters: {
        type: 'object',
        properties: {
          style: {
            type: 'string',
            description: 'Tên phong cách nghệ thuật',
            enum: ['anime', '3d_pixar', 'cyberpunk', 'sketch', 'pixel_art', 'oil_painting']
          }
        },
        required: ['style']
      },
      mapToIntent: (args) => {
        const style = args.style || 'anime';
        const labels: Record<string, string> = {
          anime: 'Phong cách Anime (Makoto Shinkai)',
          '3d_pixar': 'Phong cách 3D Pixar Animation',
          cyberpunk: 'Phong cách Cyberpunk Neon Synthwave',
          sketch: 'Phong cách Phác thảo Chì Than',
          pixel_art: 'Phong cách Pixel Art 16-bit Retro',
          oil_painting: 'Phong cách Tranh Sơn Dầu Cổ Điển'
        };
        return {
          operation: 'style_transfer',
          label: labels[style] || `Phong cách: ${style}`,
          style
        };
      }
    });

    // 7. Tool Upscale (Super Resolution)
    this.register({
      name: 'upscale_image',
      displayName: 'Phóng to siêu độ phân giải (Upscale)',
      category: 'core',
      description: 'Phóng to kích thước hình ảnh lên 2x hoặc 4x mà không vỡ hạt, tái tạo chi tiết vi mô sắc nét bằng Real-ESRGAN / Neural Upscaler.',
      parameters: {
        type: 'object',
        properties: {
          factor: {
            type: 'number',
            description: 'Hệ số phóng to (2 hoặc 4)',
            enum: [2, 4],
            default: 2
          }
        },
        required: ['factor']
      },
      mapToIntent: (args) => ({
        operation: 'upscale',
        label: `Upscale ${args.factor || 2}x Ultra HD`,
        factor: args.factor || 2
      })
    });

    // 8. Tool Vectorize (Raster to SVG)
    this.register({
      name: 'vectorize_image',
      displayName: 'Vector hóa sang SVG (VTracer)',
      category: 'core',
      description: 'Chuyển đổi hình ảnh raster (PNG, JPG) thành các đường cong bezier vector định dạng SVG chuẩn, vô hạn độ phân giải.',
      parameters: {
        type: 'object',
        properties: {
          colorPrecision: {
            type: 'number',
            description: 'Độ chính xác màu sắc (1-8)',
            default: 6
          }
        }
      },
      mapToIntent: () => ({
        operation: 'vectorize',
        label: 'Vectorize sang SVG'
      })
    });

    // 9. Tool Export Utilities
    this.register({
      name: 'export_utility',
      displayName: 'Công cụ tiện ích xuất file',
      category: 'export',
      description: 'Các tiện ích nhanh cho nhà phát triển: Nền trắng Studio E-commerce, Cắt avatar tròn bo góc, Xuất bộ Favicon/App Icons đa kích thước (16-512px), Nén Quick Export WebP 85%.',
      parameters: {
        type: 'object',
        properties: {
          utilityType: {
            type: 'string',
            description: 'Loại tiện ích xuất',
            enum: ['white_bg', 'avatar', 'icons', 'export_webp']
          }
        },
        required: ['utilityType']
      },
      mapToIntent: (args) => {
        const type = args.utilityType as OperationType;
        const labels: Record<string, string> = {
          white_bg: 'Nền trắng Studio E-Commerce',
          avatar: 'Tạo Avatar Tròn / Bo góc',
          icons: 'Xuất bộ Favicon & App Icons',
          export_webp: 'Nén Quick Export WebP (85%)'
        };
        return {
          operation: type || 'white_bg',
          label: labels[type] || 'Tiện ích xuất file'
        };
      }
    });

    // 10. Tool Image Analyze (Contract 1)
    this.registerInternal({
      name: 'image.analyze',
      displayName: 'Phân tích đo lường hình ảnh',
      category: 'core',
      description: 'Phân tích số đo độ sáng, tương phản và đề xuất cải thiện hình ảnh.',
      parameters: {
        type: 'object',
        properties: {
          imageId: { type: 'string', description: 'ID hoặc URI ảnh cần phân tích' },
          includeCaption: { type: 'boolean', description: 'Có sinh caption mô tả không' }
        },
        required: ['imageId']
      },
      mapToIntent: () => ({
        operation: 'preprocess',
        label: 'Phân tích số đo ảnh'
      })
    });

    // 11. Tool Image Generate (Contract 5)
    this.registerInternal({
      name: 'image.generate',
      displayName: 'Sinh ảnh từ văn bản',
      category: 'core',
      description: 'Sinh hình ảnh mới từ prompt mô tả.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Mô tả hình ảnh' },
          width: { type: 'number', description: 'Chiều rộng ảnh' },
          height: { type: 'number', description: 'Chiều cao ảnh' },
          negativePrompt: { type: 'string', description: 'Prompt loại trừ' }
        },
        required: ['prompt']
      },
      mapToIntent: (args) => ({
        operation: 'generate',
        label: `Sinh ảnh: "${args.prompt}"`,
        promptText: args.prompt
      })
    });

    // 12. Tool Image Remove Background (Contract 2)
    this.registerInternal({
      name: 'image.remove_background',
      displayName: 'Tách nền hình ảnh',
      category: 'core',
      description: 'Tách nền đối tượng chính với chất lượng model hoặc basic.',
      parameters: {
        type: 'object',
        properties: {
          imageId: { type: 'string', description: 'ID hoặc URI ảnh nguồn' },
          quality: { type: 'string', enum: ['model', 'basic'], description: 'Chất lượng tách nền' },
          preserveDetails: { type: 'boolean', description: 'Bảo toàn chi tiết viền' }
        },
        required: ['imageId']
      },
      mapToIntent: (args) => ({
        operation: 'remove_background',
        label: `Tách nền ảnh (${args.quality || 'basic'})`
      })
    });

    // 13. Tool Image Recolor (Contract 3)
    this.registerInternal({
      name: 'image.recolor',
      displayName: 'Đổi màu đối tượng',
      category: 'core',
      description: 'Đổi màu tóc, trang phục hoặc nền với bảo toàn chi tiết.',
      parameters: {
        type: 'object',
        properties: {
          imageId: { type: 'string', description: 'ID hoặc URI ảnh nguồn' },
          target: { type: 'string', enum: ['hair', 'clothes', 'background'], description: 'Đối tượng cần đổi màu' },
          color: { type: 'string', description: 'Màu mục tiêu' }
        },
        required: ['imageId', 'target', 'color']
      },
      mapToIntent: (args) => ({
        operation: 'recolor',
        label: `Đổi màu ${args.target} sang ${args.color}`,
        colorTarget: args.target,
        targetColor: args.color
      })
    });

    // 14. Tool Image Inpaint (Contract 4)
    this.registerInternal({
      name: 'image.inpaint',
      displayName: 'Vẽ chèn / Chỉnh sửa theo vùng mask',
      category: 'core',
      description: 'Chỉnh sửa chi tiết trong vùng mask theo prompt mô tả.',
      parameters: {
        type: 'object',
        properties: {
          imageId: { type: 'string', description: 'ID hoặc URI ảnh nguồn' },
          maskId: { type: 'string', description: 'ID hoặc URI mask đánh dấu' },
          prompt: { type: 'string', description: 'Mô tả nội dung cần sửa' },
          seed: { type: 'number', description: 'Seed ngẫu nhiên' }
        },
        required: ['imageId', 'maskId', 'prompt']
      },
      mapToIntent: (args) => ({
        operation: 'inpaint',
        label: `Chỉnh sửa vùng chọn: "${args.prompt}"`,
        promptText: args.prompt
      })
    });
  }

  private static registerInternal(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  public static register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered. Duplicate tool names are not permitted.`);
    }
    this.tools.set(tool.name, tool);
  }

  public static registerExecutor(name: string, executor: (context: any, args: Record<string, any>) => Promise<any>): void {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Cannot register executor for unknown tool: ${name}`);
    tool.executor = executor;
  }

  public static async execute(name: string, rawArgs: unknown, context?: any): Promise<any> {
    const validated = this.validateToolCall(name, rawArgs);
    if (validated.tool.executor) {
      return await validated.tool.executor(context, validated.args);
    }
    if (validated.tool.unavailableReason) {
      throw new Error(`Tool ${name} is unavailable: ${validated.tool.unavailableReason}`);
    }
    throw new Error(`Tool ${name} has no registered executor.`);
  }

  public static getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public static getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Resolve and validate an LLM/UI tool call before it can reach an executor. */
  public static validateToolCall(name: unknown, rawArgs: unknown): ValidatedToolCall {
    if (typeof name !== 'string' || !name.trim()) {
      throw new ToolValidationError('Tool name is required.');
    }
    const tool = this.getTool(name);
    if (!tool) {
      throw new ToolValidationError(`Unknown tool: ${name}`);
    }
    if (rawArgs === null || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
      throw new ToolValidationError(`Arguments for ${name} must be an object.`);
    }

    const args = rawArgs as Record<string, unknown>;
    for (const required of tool.parameters.required || []) {
      if (!(required in args) || args[required] === undefined || args[required] === null || args[required] === '') {
        throw new ToolValidationError(`Missing required argument "${required}" for ${name}.`);
      }
    }

    for (const [key, value] of Object.entries(args)) {
      const property = tool.parameters.properties[key];
      if (!property) {
        throw new ToolValidationError(`Unknown argument "${key}" for ${name}.`);
      }
      if (property.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
        throw new ToolValidationError(`Argument "${key}" for ${name} must be a finite number.`);
      }
      if (property.type === 'string' && typeof value !== 'string') {
        throw new ToolValidationError(`Argument "${key}" for ${name} must be a string.`);
      }
      if (property.type === 'boolean' && typeof value !== 'boolean') {
        throw new ToolValidationError(`Argument "${key}" for ${name} must be a boolean.`);
      }
      if (property.enum && !property.enum.includes(value as string | number)) {
        throw new ToolValidationError(`Argument "${key}" for ${name} has an unsupported value.`);
      }
    }

    const normalized = { ...args } as Record<string, any>;
    for (const [key, property] of Object.entries(tool.parameters.properties)) {
      if (normalized[key] === undefined && property.default !== undefined) normalized[key] = property.default;
    }
    return { tool, args: normalized, intent: tool.mapToIntent(normalized) };
  }

  /**
   * Generates standard OpenAI / Gemini Function Calling definitions
   */
  public static getFunctionCallingDefinitions() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }
}
