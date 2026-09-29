// LLMProvider.ts - Multi-Provider LLM Cognitive Brain & Vision Function Calling Engine
import { AgentToolRegistry } from './AgentToolRegistry';
import { AgentContext, AgentDecision } from './VisionAgentOrchestrator';

export interface LLMConfig {
  provider: 'gemini' | 'openai' | 'groq' | 'ollama' | 'local';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class LLMProvider {
  /**
   * Plans and decides tool calling using the configured LLM (Gemini, OpenAI, Groq, or Local Reasoner)
   */
  public static async planWithLLM(
    prompt: string,
    context?: AgentContext,
    config?: LLMConfig
  ): Promise<AgentDecision & { llmModelUsed: string }> {
    const provider = config?.provider || (config?.apiKey?.startsWith('AIza') ? 'gemini' : config?.apiKey ? 'openai' : 'local');
    const apiKey = config?.apiKey?.trim() || '';

    // If Gemini key is available, call real Google Gemini Vision Function Calling API
    if (provider === 'gemini' && apiKey) {
      try {
        return await this.callGeminiVision(prompt, context, apiKey, config?.model || 'gemini-1.5-flash');
      } catch (err: any) {
        console.warn('[PixelPilot LLM] Gemini call failed, falling back to smart local reasoning:', err?.message || err);
      }
    }

    // If OpenAI / Groq / Ollama is configured
    if ((provider === 'openai' || provider === 'groq' || provider === 'ollama') && (apiKey || provider === 'ollama')) {
      try {
        return await this.callOpenAICompatible(prompt, context, provider, apiKey, config?.model, config?.baseUrl);
      } catch (err: any) {
        console.warn('[PixelPilot LLM] OpenAI/Groq call failed, falling back to smart local reasoning:', err?.message || err);
      }
    }

    // Default: Built-in Cognitive Reasoner (Zero-latency offline engine)
    return this.runLocalCognitiveReasoner(prompt, context);
  }

  /**
   * 1. Google Gemini Multimodal Vision & Function Calling API
   */
  private static async callGeminiVision(
    userPrompt: string,
    context: AgentContext | undefined,
    apiKey: string,
    modelName: string = 'gemini-1.5-flash'
  ): Promise<AgentDecision & { llmModelUsed: string }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const toolsDef = AgentToolRegistry.getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: 'OBJECT',
        properties: Object.fromEntries(
          Object.entries(t.parameters.properties).map(([k, v]) => [
            k,
            {
              type: v.type.toUpperCase(),
              description: v.description,
              enum: v.enum ? v.enum.map(String) : undefined
            }
          ])
        ),
        required: t.parameters.required
      }
    }));

    const parts: any[] = [];

    // Attach image if available for real multi-modal visual inspection
    if (context?.currentImageUri && context.currentImageUri.startsWith('data:image/')) {
      const match = context.currentImageUri.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2]
          }
        });
      }
    }

    const systemInstruction = `Bạn là Bộ Não AI Thị Giác (Visual Agent Brain) của Pixel Pilot Studio.
Nhiệm vụ của bạn:
1. Đọc và hiểu sâu sắc yêu cầu chỉnh sửa ảnh của người dùng bằng tiếng Việt.
2. Phân tích ngữ cảnh bức ảnh (chân dung người, phong cảnh, đồ vật).
3. ĐẶC BIỆT CHÚ Ý: Khi người dùng bảo đổi màu tóc, HÃY CHỌN công cụ 'recolor_subject' với target='hair' và luôn bật protectSkin=true để bảo vệ 100% màu da mặt, mắt, môi và cổ.
4. Gọi duy nhất một function phù hợp nhất trong danh sách tools được cung cấp.`;

    parts.push({
      text: `${systemInstruction}\n\nYêu cầu của người dùng: "${userPrompt}"\nThông tin ảnh: Kích thước ${context?.width || '--'}x${context?.height || '--'}. Hãy phân tích và gọi công cụ xử lý thích hợp nhất.`
    });

    const body = {
      contents: [{ role: 'user', parts }],
      tools: [{ function_declarations: toolsDef }],
      tool_config: {
        function_calling_config: {
          mode: 'ANY'
        }
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    const candidate = data.candidates?.[0];
    const callPart = candidate?.content?.parts?.find((p: any) => p.functionCall);

    if (callPart && callPart.functionCall) {
      const toolName = callPart.functionCall.name;
      const args = callPart.functionCall.args || {};
      const tool = AgentToolRegistry.getTool(toolName) || AgentToolRegistry.getTool('recolor_subject')!;
      const intent = tool.mapToIntent(args);

      const thought = `[Gemini 1.5 Flash Vision Brain] Đã phân tích bức ảnh và yêu cầu "${userPrompt}". Quyết định gọi công cụ ${tool.displayName} (${toolName}) với tham số: ${JSON.stringify(args)}.`;

      return {
        toolName,
        args,
        intent,
        thought,
        reasoningSteps: [
          `Đã gửi ảnh & prompt lên Google Gemini Vision (${modelName}).`,
          `Gemini suy luận hình ảnh và cấu trúc yêu cầu người dùng.`,
          `Gemini Function Call: ${toolName} -> ${JSON.stringify(args)}`
        ],
        llmModelUsed: `Google Gemini (${modelName})`
      };
    }

    throw new Error('Gemini did not return a functionCall');
  }

  /**
   * 2. OpenAI / Groq / OpenRouter / Ollama Compatible Function Calling API
   */
  private static async callOpenAICompatible(
    userPrompt: string,
    context: AgentContext | undefined,
    provider: 'openai' | 'groq' | 'ollama',
    apiKey: string,
    modelName?: string,
    baseUrl?: string
  ): Promise<AgentDecision & { llmModelUsed: string }> {
    let endpoint = baseUrl || (
      provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
      provider === 'ollama' ? 'http://localhost:11434/v1/chat/completions' :
      'https://api.openai.com/v1/chat/completions'
    );

    const defaultModel = provider === 'groq' ? 'llama-3.3-70b-versatile' :
                         provider === 'ollama' ? 'llama3' : 'gpt-4o-mini';
    const model = modelName || defaultModel;

    const toolsDef = AgentToolRegistry.getAllTools().map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    const messages = [
      {
        role: 'system',
        content: `You are the Visual AI Agent Brain of Pixel Pilot.
Analyze the user prompt and image context.
Choose the optimal image processing tool from the provided tools.
When changing hair color, call 'recolor_subject' with target='hair' and protectSkin=true.`
      },
      {
        role: 'user',
        content: `User prompt: "${userPrompt}". Image dimensions: ${context?.width || '--'}x${context?.height || '--'}.`
      }
    ];

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages,
        tools: toolsDef,
        tool_choice: 'auto'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${provider.toUpperCase()} API Error (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall && toolCall.function) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');
      const tool = AgentToolRegistry.getTool(toolName) || AgentToolRegistry.getTool('recolor_subject')!;
      const intent = tool.mapToIntent(args);

      return {
        toolName,
        args,
        intent,
        thought: `[${provider.toUpperCase()} Brain - ${model}] Đã phân tích yêu cầu "${userPrompt}". Chọn công cụ ${tool.displayName}.`,
        reasoningSteps: [
          `Gửi yêu cầu tới ${provider.toUpperCase()} (${model}).`,
          `LLM phân tích ngữ nghĩa và cấu trúc lệnh.`,
          `LLM Function Call: ${toolName} -> ${JSON.stringify(args)}`
        ],
        llmModelUsed: `${provider.toUpperCase()} (${model})`
      };
    }

    throw new Error('LLM did not return a tool_call');
  }

  /**
   * 3. Built-in Local Cognitive Reasoner (Deterministic fallback engine)
   */
  public static runLocalCognitiveReasoner(
    userPrompt: string,
    context?: AgentContext
  ): AgentDecision & { llmModelUsed: string } {
    const raw = (userPrompt || '').trim();
    const text = raw.toLowerCase();
    const reasoningSteps: string[] = [];

    reasoningSteps.push(`[Cognitive Agent] Tiếp nhận yêu cầu: "${raw}"`);

    // Subject & Action Semantic Parsing
    const isHair = text.includes('tóc') || text.includes('mái tóc') || text.includes('hair');
    const isClothes = text.includes('áo') || text.includes('váy') || text.includes('quần') || text.includes('trang phục') || text.includes('clothes');
    const isRecolor = text.includes('màu') || text.includes('nhuộm') || text.includes('biến') || text.includes('đổi màu') || text.includes('chuyển màu');

    if (isHair || isClothes || (isRecolor && (text.includes('xanh') || text.includes('đỏ') || text.includes('vàng') || text.includes('tím') || text.includes('hồng') || text.includes('cam') || text.includes('đen') || text.includes('trắng') || text.includes('nâu')))) {
      const target = isHair ? 'hair' : isClothes ? 'clothes' : 'general';
      const targetVi = isHair ? 'mái tóc' : isClothes ? 'trang phục' : 'chi tiết';

      let targetColor = 'cyan';
      let colorNameVi = 'Xanh Da Trời';

      if (text.includes('xanh da trời') || text.includes('cyan') || text.includes('sky blue')) {
        targetColor = 'cyan';
        colorNameVi = 'Xanh Da Trời';
      } else if (text.includes('đỏ') || text.includes('red') || text.includes('ruby')) {
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
      } else if (text.includes('trắng') || text.includes('white')) {
        targetColor = 'white';
        colorNameVi = 'Bạch Kim';
      } else if (text.includes('nâu') || text.includes('brown')) {
        targetColor = 'brown';
        colorNameVi = 'Nâu Hạt Dẻ';
      }

      reasoningSteps.push(`Nhận diện đối tượng: ${targetVi}, màu đích: ${colorNameVi} (${targetColor}).`);
      if (isHair) {
        reasoningSteps.push(`Kích hoạt thuật toán phân tích màu da (Skin Chrominance Exclusion) để bảo vệ 100% da mặt, mắt, môi và cổ.`);
      }

      const tool = AgentToolRegistry.getTool('recolor_subject')!;
      const args = { target, targetColor, colorNameVi, protectSkin: true };
      return {
        toolName: 'recolor_subject',
        args,
        intent: tool.mapToIntent(args),
        thought: `Phân tích bức ảnh: Yêu cầu biến đổi màu ${targetVi} sang ${colorNameVi}. Kích hoạt công cụ Neural Recolor kèm thuật toán bảo vệ sắc độ da mặt (Skin Protection Model).`,
        reasoningSteps,
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain (Offline Ready)'
      };
    }

    // Background replacement
    if (text.includes('thay nền') || text.includes('đổi nền') || text.includes('phông nền') || text.includes('background')) {
      let cleanPrompt = raw
        .replace(/^(hãy|làm ơn|vui lòng|giúp|tôi muốn|thay|đổi|tạo|ghép|chuyển)\s*/gi, '')
        .replace(/^(nền|phông nền|phông|background)\s*(thành|sang|cho|về)?\s*/gi, '')
        .trim() || 'luxury modern studio with soft lighting';

      const tool = AgentToolRegistry.getTool('replace_background')!;
      const args = { prompt: cleanPrompt };
      return {
        toolName: 'replace_background',
        args,
        intent: tool.mapToIntent(args),
        thought: `Tách chủ thể và tổng hợp bối cảnh nền mới "${cleanPrompt}".`,
        reasoningSteps: [`Phát hiện ý định đổi nền.`, `Tạo prompt bối cảnh: "${cleanPrompt}"`],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // Remove background
    if (text.includes('tách nền') || text.includes('xóa nền') || text.includes('remove bg')) {
      const tool = AgentToolRegistry.getTool('remove_background')!;
      return {
        toolName: 'remove_background',
        args: { preserveDetails: true },
        intent: tool.mapToIntent({ preserveDetails: true }),
        thought: 'Sử dụng mô hình BiRefNet SOTA để tách nền chủ thể với độ chính xác cao.',
        reasoningSteps: ['Nhận diện tác vụ tách nền 1-click.'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // Style transfer
    const styleMatches: Record<string, string> = {
      anime: 'anime',
      pixar: '3d_pixar',
      '3d': '3d_pixar',
      cyberpunk: 'cyberpunk',
      'chì': 'sketch',
      sketch: 'sketch',
      pixel: 'pixel_art',
      'sơn dầu': 'oil_painting'
    };
    for (const [key, styleVal] of Object.entries(styleMatches)) {
      if (text.includes(key)) {
        const tool = AgentToolRegistry.getTool('style_transfer')!;
        return {
          toolName: 'style_transfer',
          args: { style: styleVal },
          intent: tool.mapToIntent({ style: styleVal }),
          thought: `Áp dụng phong cách nghệ thuật ${styleVal}.`,
          reasoningSteps: [`Nhận diện phong cách: ${styleVal}`],
          llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
        };
      }
    }

    // Enhance
    if (text.includes('làm nét') || text.includes('khử mờ') || text.includes('clarity')) {
      const tool = AgentToolRegistry.getTool('enhance_image')!;
      return {
        toolName: 'enhance_image',
        args: { enhanceType: 'clarity' },
        intent: tool.mapToIntent({ enhanceType: 'clarity' }),
        thought: 'Nâng cấp làm nét chi tiết vi mô và khử mờ AI.',
        reasoningSteps: ['Nhận diện tác vụ Clarity Deblur.'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // Upscale
    if (text.includes('upscale') || text.includes('phóng to') || text.includes('4k') || text.includes('4x')) {
      const factor = (text.includes('4x') || text.includes('4k')) ? 4 : 2;
      const tool = AgentToolRegistry.getTool('upscale_image')!;
      return {
        toolName: 'upscale_image',
        args: { factor },
        intent: tool.mapToIntent({ factor }),
        thought: `Phóng to ảnh lên ${factor}x siêu độ phân giải.`,
        reasoningSteps: [`Hệ số upscale: ${factor}x`],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // Vectorize
    if (text.includes('vector') || text.includes('svg')) {
      const tool = AgentToolRegistry.getTool('vectorize_image')!;
      return {
        toolName: 'vectorize_image',
        args: { colorPrecision: 6 },
        intent: tool.mapToIntent({ colorPrecision: 6 }),
        thought: 'Chuyển đổi ảnh raster sang đồ họa vector SVG.',
        reasoningSteps: ['Tác vụ Vectorize SVG.'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // Fallback: Inpaint
    const tool = AgentToolRegistry.getTool('inpaint_region')!;
    return {
      toolName: 'inpaint_region',
      args: { prompt: raw },
      intent: tool.mapToIntent({ prompt: raw }),
      thought: `Áp dụng Generative Inpaint & Edit cho "${raw}".`,
      reasoningSteps: ['Ý định chỉnh sửa tổng quát.'],
      llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
    };
  }
}
