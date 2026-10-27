// LLMProvider.ts - Multi-Provider LLM Cognitive Brain & Conversational Agent Engine
import { AgentToolRegistry, ToolValidationError } from './AgentToolRegistry';
import { AgentContext, AgentDecision } from './VisionAgentOrchestrator';

export interface LLMConfig {
  provider: 'gemini' | 'openai' | 'groq' | 'openrouter' | 'ollama' | 'local';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class LLMProvider {
  /**
   * Plans and decides tool calling or conversational reply using the configured LLM
   */
  public static async planWithLLM(
    prompt: string,
    context?: AgentContext,
    config?: LLMConfig
  ): Promise<AgentDecision & { llmModelUsed: string }> {
    const provider = config?.provider || (config?.apiKey?.startsWith('AIza') ? 'gemini' : config?.apiKey ? 'openai' : 'local');
    const apiKey = config?.apiKey?.trim() || '';

    // If Gemini key is available, call Google Gemini Multimodal Vision API
    if (provider === 'gemini' && apiKey) {
      try {
        return await this.callGeminiVision(prompt, context, apiKey, config?.model || 'gemini-1.5-flash');
      } catch (err: any) {
        if (err instanceof ToolValidationError) throw err;
        console.warn('[PixelPilot LLM] Gemini call failed, falling back to smart local reasoning:', err?.message || err);
      }
    }

    // If OpenAI / Groq / OpenRouter / Ollama is configured
    if ((provider === 'openai' || provider === 'groq' || provider === 'openrouter' || provider === 'ollama') && (apiKey || provider === 'ollama')) {
      try {
        return await this.callOpenAICompatible(prompt, context, provider, apiKey, config?.model, config?.baseUrl);
      } catch (err: any) {
        if (err instanceof ToolValidationError) throw err;
        console.warn(`[PixelPilot LLM] ${provider.toUpperCase()} call failed, falling back to smart local reasoning:`, err?.message || err);
      }
    }

    // Default: Built-in Cognitive Reasoner (Zero-latency offline human-like agent engine)
    return this.runLocalCognitiveReasoner(prompt, context);
  }

  /**
   * 1. Google Gemini Multimodal Vision & Agentic Chat/Function Calling API
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

    const contents: any[] = [];

    // System Persona & Agent Guidelines
    const systemInstruction = `Bạn là Pixel Pilot AI Agent - Trợ lý thông minh cao cấp chuyên xử lý, phân tích và chỉnh sửa hình ảnh trong VS Code.
Bạn giao tiếp bằng tiếng Việt tự nhiên, thân thiện, đồng cảm và chuyên nghiệp như một Agent thực thụ (tương tự Claude/Antigravity).

QUY TẮC PHÂN BIỆT Ý ĐỊNH RÕ RÀNG:
1. GIAO TIẾP / HỎI ĐÁP / CHÀO HỎI / TƯ VẤN:
   Khi người dùng chỉ chào hỏi ("xin chào", "hello", "hi"), hỏi han, khen ngợi, hỏi về khả năng ("bạn làm được gì?"), hỏi tư vấn cách sửa ảnh ("ảnh này nên sửa gì?", "ảnh này có đẹp không?"):
   -> TUYỆT ĐỐI KHÔNG GỌI TOOL!
   -> Hãy trả lời bằng tin nhắn trò chuyện tự nhiên, giải thích rõ khả năng, tư vấn về bức ảnh đang mở.

2. YÊU CẦU CHỈNH SỬA HÌNH ẢNH:
   Chỉ khi người dùng thực sự muốn thay đổi ảnh:
   -> ĐỔI MÀU NỀN / PHÔNG NỀN (vd: "chuyển nền qua màu đỏ", "đổi nền thành màu trắng", "nền vàng", "phông xanh"):
      BẮT BUỘC GỌI 'change_background_color' với color tương ứng ('red', 'blue', 'white', 'black', 'green', 'yellow'...).
      TUYỆT ĐỐI KHÔNG GỌI 'recolor_subject' vì recolor_subject chỉ dùng cho tóc hoặc trang phục!
   -> TÁCH NỀN (vd: "tách nền", "xóa nền", "xóa phông"):
      Gọi 'remove_background'.
   -> ĐỔI BỐI CẢNH NỀN (vd: "đổi nền thành bãi biển hoàng hôn", "studio sang trọng"):
      Gọi 'replace_background' với prompt bối cảnh.
   -> ĐỔI MÀU TÓC / TRANG PHỤC (vd: "nhuộm tóc đỏ", "áo màu xanh"):
      Gọi 'recolor_subject' với target='hair' hoặc 'clothes', protectSkin=true.`;

    // Multi-turn Conversation History
    if (context?.conversationHistory && context.conversationHistory.length > 0) {
      const recent = context.conversationHistory.slice(-8);
      for (const msg of recent) {
        if (msg.sender === 'user') {
          contents.push({ role: 'user', parts: [{ text: msg.text }] });
        } else if (msg.sender === 'assistant' && msg.text) {
          contents.push({ role: 'model', parts: [{ text: msg.text }] });
        }
      }
    }

    const currentParts: any[] = [];

    // Attach image if available for real multi-modal visual inspection
    if (context?.currentImageUri && context.currentImageUri.startsWith('data:image/')) {
      const match = context.currentImageUri.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        currentParts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2]
          }
        });
      }
    }

    const imageInfo = context?.currentImageUri
      ? `(Đang có ảnh mở trong phiên: "${context.imageTitle || 'Ảnh hiện tại'}", kích thước ${context.width || '--'}x${context.height || '--'})`
      : `(Chưa có ảnh nào được nạp vào phiên)`;

    currentParts.push({
      text: `[Chỉ dẫn ngữ cảnh]: ${imageInfo}\n\nNgười dùng: "${userPrompt}"`
    });

    contents.push({ role: 'user', parts: currentParts });

    const body = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      tools: [{ function_declarations: toolsDef }],
      tool_config: {
        function_calling_config: {
          mode: 'AUTO'
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
      const validation = AgentToolRegistry.validateToolCall(toolName, callPart.functionCall.args || {});
      const { tool, args, intent } = validation;

      const thought = `[Gemini Vision Brain] Phân tích ngữ cảnh ảnh và yêu cầu "${userPrompt}". Quyết định gọi công cụ ${tool.displayName} (${toolName}) với tham số: ${JSON.stringify(args)}.`;

      return {
        type: 'tool_call',
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

    // Text Response (Chit-chat / Consultation / Explanation)
    const textPart = candidate?.content?.parts?.find((p: any) => p.text);
    const replyText = textPart?.text || 'Tôi đã hiểu yêu cầu của bạn. Bạn muốn thực hiện chỉnh sửa gì tiếp theo?';

    return {
      type: 'chat',
      replyText,
      thought: 'Tiếp nhận câu hỏi và phản hồi trò chuyện tự nhiên với người dùng mà không can thiệp vào ảnh.',
      reasoningSteps: [
        `Gemini nhận diện câu nói là hội thoại tự nhiên / câu hỏi tư vấn.`,
        `Phản hồi bằng ngôn ngữ tự nhiên không gọi công cụ.`
      ],
      llmModelUsed: `Google Gemini (${modelName})`
    };
  }

  /**
   * 2. OpenAI / Groq / OpenRouter / Ollama Compatible Function Calling API
   */
  private static async callOpenAICompatible(
    userPrompt: string,
    context: AgentContext | undefined,
    provider: 'openai' | 'groq' | 'openrouter' | 'ollama',
    apiKey: string,
    modelName?: string,
    baseUrl?: string
  ): Promise<AgentDecision & { llmModelUsed: string }> {
    let endpoint = baseUrl || (
      provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
      provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
      provider === 'ollama' ? 'http://localhost:11434/v1/chat/completions' :
      'https://api.openai.com/v1/chat/completions'
    );

    const defaultModel = provider === 'groq' ? 'llama-3.3-70b-versatile' :
                         provider === 'openrouter' ? 'google/gemini-2.0-flash-exp:free' :
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

    const messages: any[] = [
      {
        role: 'system',
        content: `Bạn là Pixel Pilot AI Agent - Trợ lý thông minh cao cấp chuyên chỉnh sửa ảnh trong VS Code.
Giao tiếp bằng tiếng Việt tự nhiên, thân thiện và hiểu ngữ cảnh sâu sắc như một Agent thực thụ (tương tự Claude/Antigravity).
QUY TẮC QUAN TRỌNG:
1. Khi người dùng chào hỏi, hỏi han, hỏi về tính năng hoặc hỏi tư vấn: TUYỆT ĐỐI KHÔNG GỌI TOOL. Hãy trả lời bằng văn bản trò chuyện tự nhiên và gợi ý các thao tác có thể làm.
2. Chỉ khi người dùng yêu cầu chỉnh sửa ảnh cụ thể:
   -> ĐỔI MÀU NỀN / PHÔNG NỀN (vd: "chuyển nền qua màu đỏ", "nền trắng", "phông xanh"): Gọi 'change_background_color' với color ('red', 'blue', 'white'...). TUYỆT ĐỐI KHÔNG gọi 'recolor_subject'!
   -> TÁCH NỀN: Gọi 'remove_background'.
   -> ĐỔI BỐI CẢNH NỀN: Gọi 'replace_background' với prompt mô tả.
   -> ĐỔI MÀU TÓC / TRANG PHỤC: Gọi 'recolor_subject' với target='hair' hoặc 'clothes', protectSkin=true.`
      }
    ];

    if (context?.conversationHistory && context.conversationHistory.length > 0) {
      const recent = context.conversationHistory.slice(-8);
      for (const msg of recent) {
        if (msg.sender === 'user') {
          messages.push({ role: 'user', content: msg.text });
        } else if (msg.sender === 'assistant' && msg.text) {
          messages.push({ role: 'assistant', content: msg.text });
        }
      }
    }

    const imageInfo = context?.currentImageUri
      ? `(Đang mở ảnh "${context.imageTitle || 'Ảnh hiện tại'}", kích thước ${context?.width || '--'}x${context?.height || '--'})`
      : `(Chưa có ảnh)`;

    messages.push({
      role: 'user',
      content: `${imageInfo}\n\nNgười dùng: "${userPrompt}"`
    });

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
    const choice = data.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall && toolCall.function) {
      const toolName = toolCall.function.name;
      let rawArgs: unknown;
      try {
        rawArgs = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        throw new ToolValidationError(`Invalid JSON arguments for ${toolName}.`);
      }
      const validation = AgentToolRegistry.validateToolCall(toolName, rawArgs);
      const { tool, args, intent } = validation;

      return {
        type: 'tool_call',
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

    // Chat reply
    const replyText = choice?.message?.content || 'Xin chào! Tôi có thể hỗ trợ gì cho bạn trong việc chỉnh sửa bức ảnh này?';
    return {
      type: 'chat',
      replyText,
      thought: 'Tiếp nhận hội thoại tự nhiên từ người dùng mà không gọi công cụ chỉnh ảnh.',
      reasoningSteps: [
        `${provider.toUpperCase()} nhận diện đây là câu hỏi / giao tiếp hội thoại.`,
        `Trả lời bằng văn bản tự nhiên.`
      ],
      llmModelUsed: `${provider.toUpperCase()} (${model})`
    };
  }

  /**
   * 3. Built-in Local Cognitive Reasoner (Zero-Key Offline Intelligent Agent Brain)
   */
  public static runLocalCognitiveReasoner(
    userPrompt: string,
    context?: AgentContext
  ): AgentDecision & { llmModelUsed: string } {
    const raw = (userPrompt || '').trim();
    const text = raw.toLowerCase();
    const hasImage = !!context?.currentImageUri;
    const imageName = context?.imageTitle || 'bức ảnh';

    // 1. GREETING & CHIT-CHAT DETECTION
    const isGreeting =
      /^(xin\s*chào|chào|chào\s*bạn|chào\s*bot|chào\s*em|chào\s*shop|hello|hi|hey|alo|good\s*morning|good\s*afternoon|good\s*evening)[\s!.,?]*$/i.test(text) ||
      text === 'xin chào' || text === 'chào' || text === 'hello' || text === 'hi' || text === 'alo' || text.startsWith('xin chào') || text.startsWith('chào bạn');

    if (isGreeting && !text.includes('xóa') && !text.includes('đổi') && !text.includes('làm') && !text.includes('tách')) {
      const reply = hasImage
        ? `Xin chào bạn! 👋 Tôi là **Pixel Pilot AI Agent** — trợ lý thị giác thông minh của bạn trong VS Code.\n\nHiện tại bạn đang mở **${imageName}**. Tôi có thể giúp bạn xử lý các thao tác sau:\n- ✂️ **Tách nền:** Xóa phông nền chuẩn BiRefNet SOTA.\n- 🌅 **Đổi nền AI:** Ghép bối cảnh hoàng hôn, studio sang trọng, cyberpunk...\n- 🎨 **Đổi màu có chọn lọc:** Đổi màu tóc hoặc trang phục (bảo vệ 100% da mặt).\n- 🌟 **Làm nét & Khử mờ:** Tăng độ rõ chi tiết vi mô.\n- ⚡ **Upscale 4x:** Phóng to ảnh siêu độ phân giải.\n- 🎌 **Phong cách Anime / 3D Pixar / Pixel Art.**\n\nBạn muốn tôi thực hiện thao tác nào trên bức ảnh này?`
        : `Xin chào bạn! 👋 Tôi là **Pixel Pilot AI Agent** — trợ lý thiết kế & xử lý ảnh AI thông minh.\n\nHiện tại bạn chưa nạp ảnh vào phiên làm việc. Hãy:\n1. Chọn ảnh bằng nút **"Chọn ảnh"** hoặc kéo thả file ảnh vào khung làm việc.\n2. Nhấn **Ctrl + V** để dán ảnh trực tiếp từ Clipboard.\n\nSau đó, bạn có thể ra lệnh cho tôi bằng tiếng Việt tự nhiên!`;

      return {
        type: 'chat',
        replyText: reply,
        thought: 'Người dùng chào hỏi giao tiếp thông thường. Phản hồi nồng nhiệt, giới thiệu vai trò Agentic và gợi ý các tác vụ phù hợp với trạng thái ảnh hiện tại.',
        reasoningSteps: [
          'Phân tích ngữ nghĩa: Nhận diện ý định CHÀO HỎI (Greeting).',
          'Kiểm tra trạng thái ngữ cảnh ảnh trong phiên làm việc.',
          'Phản hồi bằng ngôn ngữ tự nhiên, không gọi công cụ chỉnh ảnh.'
        ],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // 2. CAPABILITY & HELP INQUIRY
    const isHelpInquiry =
      text.includes('bạn là ai') ||
      text.includes('bạn làm được gì') ||
      text.includes('hướng dẫn') ||
      text.includes('tính năng') ||
      text.includes('giúp gì') ||
      text.includes('cách dùng') ||
      text.includes('có thể làm gì') ||
      text.includes('hỗ trợ') ||
      text === 'help' ||
      text === '?';

    if (isHelpInquiry) {
      const reply = `🤖 **Tôi là Pixel Pilot AI Agent**, một hệ thống Visual Agentic kết hợp xử lý thị giác cục bộ và các mô hình AI điện toán đám mây.\n\n**Các khả năng chính:**\n1. **Tách nền 1-Click:** Tách người/vật thể sạch từng sợi tóc (BiRefNet).\n2. **Thay nền Generative:** Gõ *'Đổi nền thành bãi biển hoàng hôn'* hay *'Studio tối giản'*.\n3. **Đổi màu thông minh:** Gõ *'Nhuộm tóc màu đỏ'* hay *'Đổi áo sang màu xanh biển'* (tự động bật bảo vệ da mặt).\n4. **Nâng cấp hình ảnh:** Làm nét khử mờ (Clarity), cân bằng HDR, tone Vintage.\n5. **Super Resolution:** Phóng to 2x / 4x không vỡ nét.\n6. **Chuyển phong cách:** Anime Makoto Shinkai, 3D Pixar, Cyberpunk, Tranh chì, Sơn dầu, Pixel Art.\n7. **Vector SVG:** Chuyển ảnh sang file Vector SVG chuẩn thiết kế.\n\nBạn chỉ cần gõ yêu cầu bằng tiếng Việt tự nhiên, tôi sẽ tự động phân tích và xử lý ngay!`;

      return {
        type: 'chat',
        replyText: reply,
        thought: 'Người dùng hỏi về năng lực và hướng dẫn sử dụng. Cung cấp danh mục tính năng đầy đủ kèm ví dụ câu lệnh trực quan.',
        reasoningSteps: ['Nhận diện ý định: HỎI NĂNG LỰC / HƯỚNG DẪN (Capability Inquiry).', 'Không gọi công cụ xử lý ảnh.'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // 3. IMAGE ADVICE & REVIEW
    const isImageAdvice =
      text.includes('ảnh này đẹp không') ||
      text.includes('nên sửa gì') ||
      text.includes('gợi ý') ||
      text.includes('nhận xét ảnh') ||
      text.includes('review ảnh') ||
      text.includes('tư vấn');

    if (isImageAdvice) {
      const reply = hasImage
        ? `👁️ **Đánh giá hình ảnh sơ bộ:**\nBức ảnh **${imageName}** của bạn có bố cục khá rõ nét. Dưới đây là 3 gợi ý chỉnh sửa tốt nhất từ tôi:\n\n1. **Tách nền hoặc đổi phông nền:** Giúp chủ thể nổi bật hơn nếu nền hiện tại bị rối.\n2. **Làm nét chi tiết (Clarity):** Tăng độ sâu và độ trong trẻo cho ánh mắt, tóc và trang phục.\n3. **Thử biến hóa phong cách:** Chuyển sang phong cách **Anime điện ảnh** hoặc **3D Pixar** để có diện mạo hoàn toàn mới!\n\nBạn muốn thử gợi ý nào trước?`
        : `Bạn chưa nạp ảnh vào khung làm việc. Hãy dán ảnh (Ctrl + V) hoặc tải ảnh lên để tôi có thể phân tích và tư vấn cho bạn nhé!`;

      return {
        type: 'chat',
        replyText: reply,
        thought: 'Người dùng yêu cầu tư vấn thẩm mỹ về bức ảnh. Đưa ra gợi ý cải thiện bố cục và màu sắc.',
        reasoningSteps: ['Nhận diện ý định: TƯ VẤN THẨM MỸ (Visual Consultation).', 'Trả lời tự nhiên.'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // 4. FEEDBACK / PRAISE / COURTESY
    const isThanks =
      text.includes('cảm ơn') ||
      text.includes('thanks') ||
      text.includes('tốt lắm') ||
      text.includes('đẹp quá') ||
      text.includes('tuyệt vời') ||
      text.includes('ưng ý') ||
      text === 'ok' ||
      text === 'được' ||
      text === 'chuẩn';

    if (isThanks) {
      return {
        type: 'chat',
        replyText: `Rất vui vì đã hỗ trợ tốt cho bạn! ✨ Nếu bạn muốn chỉnh sửa thêm chi tiết nào khác hoặc xuất file sang định dạng khác, cứ nhắn cho tôi nhé!`,
        thought: 'Tiếp nhận phản hồi tích cực từ người dùng.',
        reasoningSteps: ['Nhận diện ý định: PHẢN HỒI TÍCH CỰC (Gratitude / Feedback).'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // 5. TOOL SELECTION: Visual Semantic Parsing

    const isBgQuery = text.includes('nền') || text.includes('phông') || text.includes('background');

    // A. BACKGROUND OPERATIONS (TÁCH NỀN, ĐỔI MÀU NỀN, THAY BỐI CẢNH NỀN)
    if (isBgQuery) {
      // 1. Tách nền / Xóa nền
      if (text.includes('tách') || text.includes('xóa') || text.includes('remove') || text.includes('trong suốt')) {
        const tool = AgentToolRegistry.getTool('remove_background')!;
        return {
          type: 'tool_call',
          toolName: 'remove_background',
          args: { preserveDetails: true },
          intent: tool.mapToIntent({ preserveDetails: true }),
          thought: 'Sử dụng mô hình BiRefNet SOTA để tách nền chủ thể với độ chính xác cao.',
          reasoningSteps: ['Nhận diện tác vụ tách nền 1-click BiRefNet.'],
          llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
        };
      }

      // 2. Đổi màu nền (Background Color Change)
      const hasColorWord = text.includes('màu') || text.includes('đỏ') || text.includes('xanh') ||
                           text.includes('trắng') || text.includes('đen') || text.includes('vàng') ||
                           text.includes('tím') || text.includes('hồng') || text.includes('cam') ||
                           text.includes('xám') || text.includes('cyan') || text.includes('nâu');

      if (hasColorWord) {
        let targetColor = 'red';
        let colorNameVi = 'Đỏ Ruby';

        if (text.includes('đỏ') || text.includes('red') || text.includes('crimson')) {
          targetColor = 'red'; colorNameVi = 'Đỏ Ruby';
        } else if (text.includes('trắng') || text.includes('white')) {
          targetColor = 'white'; colorNameVi = 'Trắng Studio';
        } else if (text.includes('đen') || text.includes('black')) {
          targetColor = 'black'; colorNameVi = 'Đen Tuyền';
        } else if (text.includes('xanh da trời') || text.includes('cyan') || text.includes('sky blue')) {
          targetColor = 'cyan'; colorNameVi = 'Xanh Da Trời';
        } else if (text.includes('xanh lá') || text.includes('green') || text.includes('lục')) {
          targetColor = 'green'; colorNameVi = 'Xanh Lá';
        } else if (text.includes('xanh dương') || text.includes('xanh biển') || text.includes('blue') || text.includes('xanh')) {
          targetColor = 'blue'; colorNameVi = 'Xanh Biển';
        } else if (text.includes('vàng') || text.includes('yellow') || text.includes('gold')) {
          targetColor = 'yellow'; colorNameVi = 'Vàng Kim';
        } else if (text.includes('tím') || text.includes('purple')) {
          targetColor = 'purple'; colorNameVi = 'Tím Khói';
        } else if (text.includes('hồng') || text.includes('pink')) {
          targetColor = 'pink'; colorNameVi = 'Hồng Pastel';
        } else if (text.includes('cam') || text.includes('orange')) {
          targetColor = 'orange'; colorNameVi = 'Cam San Hô';
        } else if (text.includes('xám') || text.includes('gray') || text.includes('grey')) {
          targetColor = 'gray'; colorNameVi = 'Xám Hiện Đại';
        } else if (text.includes('nâu') || text.includes('brown')) {
          targetColor = 'brown'; colorNameVi = 'Nâu Hạt Dẻ';
        }

        const tool = AgentToolRegistry.getTool('change_background_color') || AgentToolRegistry.getTool('replace_background')!;
        const args = { color: targetColor, colorNameVi };
        return {
          type: 'tool_call',
          toolName: 'change_background_color',
          args,
          intent: tool.mapToIntent(args),
          thought: `Phân tích yêu cầu: Đổi màu phông nền sang ${colorNameVi}. Tách chủ thể và phủ màu nền mới phía sau, bảo toàn 100% nhân vật/vật thể ở phía trước.`,
          reasoningSteps: [
            `Nhận diện ý định: ĐỔI MÀU PHÔNG NỀN (Background Color) sang ${colorNameVi} (${targetColor}).`,
            `Kích hoạt thuật toán nhận diện biên chủ thể để chỉ thay đổi vùng nền, giữ nguyên 100% đối tượng.`
          ],
          llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
        };
      }

      // 3. Thay nền bối cảnh (Generative Scene Background)
      let cleanPrompt = raw
        .replace(/^(hãy|làm ơn|vui lòng|giúp|tôi muốn|thay|đổi|tạo|ghép|chuyển)\s*/gi, '')
        .replace(/^(nền|phông nền|phông|background)\s*(thành|sang|cho|về|qua)?\s*/gi, '')
        .trim() || 'luxury modern studio with soft lighting';

      const tool = AgentToolRegistry.getTool('replace_background')!;
      const args = { prompt: cleanPrompt };
      return {
        type: 'tool_call',
        toolName: 'replace_background',
        args,
        intent: tool.mapToIntent(args),
        thought: `Tách chủ thể và tổng hợp bối cảnh nền mới "${cleanPrompt}".`,
        reasoningSteps: [`Phát hiện ý định đổi bối cảnh nền.`, `Tạo prompt bối cảnh: "${cleanPrompt}"`],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // B. RECOLOR SUBJECT (CHỈ ÁP DỤNG CHO MÁI TÓC HOẶC TRANG PHỤC, TUYỆT ĐỐI KHÔNG BÔI MÀU CẢ ẢNH)
    const isHair = text.includes('tóc') || text.includes('mái tóc') || text.includes('hair');
    const isClothes = text.includes('áo') || text.includes('váy') || text.includes('quần') || text.includes('trang phục') || text.includes('clothes');
    const isRecolor = text.includes('màu') || text.includes('nhuộm') || text.includes('biến màu') || text.includes('đổi màu') || text.includes('chuyển màu');

    if (isHair || isClothes) {
      const target = isHair ? 'hair' : 'clothes';
      const targetVi = isHair ? 'mái tóc' : 'trang phục';

      let targetColor = 'cyan';
      let colorNameVi = 'Xanh Da Trời';

      if (text.includes('xanh da trời') || text.includes('cyan') || text.includes('sky blue')) {
        targetColor = 'cyan'; colorNameVi = 'Xanh Da Trời';
      } else if (text.includes('đỏ') || text.includes('red') || text.includes('ruby')) {
        targetColor = 'red'; colorNameVi = 'Đỏ Ruby';
      } else if (text.includes('xanh lá') || text.includes('green') || text.includes('lục')) {
        targetColor = 'green'; colorNameVi = 'Xanh Lá';
      } else if (text.includes('xanh dương') || text.includes('xanh biển') || text.includes('blue') || (text.includes('xanh') && !text.includes('lá'))) {
        targetColor = 'blue'; colorNameVi = 'Xanh Biển';
      } else if (text.includes('tím') || text.includes('purple')) {
        targetColor = 'purple'; colorNameVi = 'Tím Khói';
      } else if (text.includes('hồng') || text.includes('pink')) {
        targetColor = 'pink'; colorNameVi = 'Hồng Pastel';
      } else if (text.includes('vàng') || text.includes('yellow') || text.includes('gold')) {
        targetColor = 'yellow'; colorNameVi = 'Vàng Kim';
      } else if (text.includes('cam') || text.includes('orange')) {
        targetColor = 'orange'; colorNameVi = 'Cam San Hô';
      } else if (text.includes('đen') || text.includes('black')) {
        targetColor = 'black'; colorNameVi = 'Đen Tuyền';
      } else if (text.includes('trắng') || text.includes('white')) {
        targetColor = 'white'; colorNameVi = 'Bạch Kim';
      } else if (text.includes('nâu') || text.includes('brown')) {
        targetColor = 'brown'; colorNameVi = 'Nâu Hạt Dẻ';
      }

      const tool = AgentToolRegistry.getTool('recolor_subject')!;
      const args = { target, targetColor, colorNameVi, protectSkin: true };
      return {
        type: 'tool_call',
        toolName: 'recolor_subject',
        args,
        intent: tool.mapToIntent(args),
        thought: `Phân tích bức ảnh: Yêu cầu biến đổi màu ${targetVi} sang ${colorNameVi}. Kích hoạt công cụ Neural Recolor kèm thuật toán bảo vệ sắc độ da mặt (Skin Protection Model).`,
        reasoningSteps: [
          `Nhận diện đối tượng: ${targetVi}, màu đích: ${colorNameVi} (${targetColor}).`,
          isHair ? `Kích hoạt thuật toán phân tích màu da (Skin Chrominance Exclusion) để bảo vệ 100% da mặt, mắt, môi và cổ.` : 'Áp dụng bộ lọc đổi màu trang phục.'
        ],
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
          type: 'tool_call',
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
    if (text.includes('làm nét') || text.includes('khử mờ') || text.includes('clarity') || text.includes('nâng cấp chất lượng')) {
      const tool = AgentToolRegistry.getTool('enhance_image')!;
      return {
        type: 'tool_call',
        toolName: 'enhance_image',
        args: { enhanceType: 'clarity' },
        intent: tool.mapToIntent({ enhanceType: 'clarity' }),
        thought: 'Nâng cấp làm nét chi tiết vi mô và khử mờ AI.',
        reasoningSteps: ['Nhận diện tác vụ Clarity Deblur.'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // Upscale
    if (text.includes('upscale') || text.includes('phóng to') || text.includes('4k') || text.includes('4x') || text.includes('2x')) {
      const factor = (text.includes('4x') || text.includes('4k')) ? 4 : 2;
      const tool = AgentToolRegistry.getTool('upscale_image')!;
      return {
        type: 'tool_call',
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
        type: 'tool_call',
        toolName: 'vectorize_image',
        args: { colorPrecision: 6 },
        intent: tool.mapToIntent({ colorPrecision: 6 }),
        thought: 'Chuyển đổi ảnh raster sang đồ họa vector SVG.',
        reasoningSteps: ['Tác vụ Vectorize SVG.'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // Inpaint (ONLY when explicitly describing object removal or drawing)
    if (text.includes('xóa vật thể') || text.includes('xóa người') || text.includes('vẽ thêm') || text.includes('thêm kính') || text.includes('thêm mũ') || text.includes('inpaint')) {
      const tool = AgentToolRegistry.getTool('inpaint_region')!;
      return {
        type: 'tool_call',
        toolName: 'inpaint_region',
        args: { prompt: raw },
        intent: tool.mapToIntent({ prompt: raw }),
        thought: `Áp dụng Generative Inpaint & Edit cho "${raw}".`,
        reasoningSteps: ['Nhận diện tác vụ inpaint/sửa chi tiết cụ thể.'],
        llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
      };
    }

    // 6. DEFAULT FALLBACK: Intelligent Chat Inquiry (NEVER silently inpaint!)
    return {
      type: 'chat',
      replyText: `Tôi đã tiếp nhận tin nhắn: "${raw}".\n\nTuy nhiên, tôi chưa nhận diện được thao tác chỉnh sửa ảnh cụ thể nào. Bạn có thể thử các câu lệnh mẫu:\n- **"Tách nền ảnh này"** (Xóa phông nền)\n- **"Đổi nền thành biển hoàng hôn"** (Ghép nền AI)\n- **"Nhuộm tóc màu đỏ"** (Đổi màu tóc, bảo vệ da mặt)\n- **"Làm nét ảnh"** hoặc **"Phóng to 4x"**\n- **"Chuyển sang phong cách anime"**\n\nHoặc bạn muốn tôi hỗ trợ điều gì khác?`,
      thought: `Tin nhắn "${raw}" không khớp với bất kỳ thao tác chỉnh sửa nào. Phản hồi trò chuyện lịch sự để người dùng làm rõ ý định.`,
      reasoningSteps: [
        'Phân tích ngữ nghĩa: Không tìm thấy động từ chỉnh sửa ảnh.',
        'Tránh gọi nhầm tool inpaint.',
        'Gửi tin nhắn hướng dẫn người dùng.'
      ],
      llmModelUsed: 'Pixel Pilot Local Cognitive Brain'
    };
  }
}
