import { MultiStepPlan, PlanIntentType, PlannerContext, PlanStep } from './types';
import { PlanValidator } from './PlanValidator';

const ADVERSARIAL_OR_SECURITY_PATTERNS = [
  /(?:bỏ\s+qua|bypass|override)\s+(?:toàn\s+bộ\s+)?(?:chính\s+sách|bảo\s+mật)/i,
  /(?:ignore|bypass)\s+(?:previous\s+)?(?:safety|guidelines|policy|workspace)/i,
  /(?:đọc\s+file\s+\.env|in\s+api\s+key|gửi\s+secret|dump\s+(?:all\s+)?(?:environment|secrets?|secretstorage)|system\s+(?:override|prompt\s+injection))/i
];

const NEGATION_PATTERNS = [
  /(?:không|đừng|chớ|ngưng|dừng|bỏ\s+qua|không\s+cần)\s+(?:sửa|chỉnh|chỉnh\s+sửa|thay\s+đổi|đổi|tách|xóa|can\s+thiệp|làm)/i,
  /(?:don'?t|do\s+not|never|stop|please\s+stop)\s+(?:edit|modify|change|touch|alter|remove|recolor|upscale|generate|inpaint)/i,
  /(?:giữ\s+nguyên|keep\s+(?:original|it\s+as\s+is)|leave\s+it)/i
];

const DEFINITION_OR_INFO_QUESTION_PATTERNS = [
  /(?:là\s+gì|như\s+thế\s+nào|nhu\s+the\s+nao|hoạt\s+động\s+như\s+thế\s+nào|thế\s+nào|sao\s+vậy|sao\s+đắt|hết\s+bao\s+nhiêu)/i,
  /(?:what\s+is|how\s+does|how\s+do\s+i|who\s+created|what\s+time|which\s+image\s+formats)/i,
  /(?:xin\s+chào|chào\s+buổi|hello|good\s+morning|cảm\s+ơn|cam\s+on|thank\s+you|bạn\s+là\s+ai)/i,
  /^(?:bức\s+ảnh|ảnh\s+này|hình\s+này)\s+(?:có\s+đẹp|thế\s+nào|sao)/i,
  /(?:look\s+good\s+to\s+you|take\s+better\s+photos)/i
];

const ANALYZE_PATTERNS = [
  /(?:phân\s+tích|phan\s+tich|đo\s+lường|do\s+luong|đo\s+sáng|do\s+sang|thông\s+số|thong\s+so|thông\s+tin\s+chi\s+tiết|thong\s+tin\s+chi\s+tiet)/i,
  /(?:kiểm\s+tra\s+(?:độ\s+sáng|thông\s+số|kỹ\s+thuật|histogram|ánh\s+sáng|vùng\s+tối|tương\s+phản|ảnh)|kiem\s+tra)/i,
  /(?:analyze|inspect|measurements?|exposure|histogram|mean\s+lighting|visual\s+inspection|contrast\s+distribution|full\s+analysis)/i
];

const LOCAL_INPAINT_PATTERNS = [
  /(?:xóa|xoa)\s+(?:bỏ\s+|chiếc\s+|con\s+|cái\s+|hình\s+)?(?:vật\s+thể|vat\s+the|người|nguoi|xe|vết|vet|vết\s+bẩn|vet\s+ban|chi\s+tiết|chi\s+tiet|logo|bóng|bong|chữ|watermark|khuyết\s+điểm|vùng\s+này|vung\s+nay)/i,
  /(?:tẩy\s+xóa|tay\s+xoa|inpaint|chi\s+tiết\s+bị\s+rách)/i,
  /(?:remove|erase)\s+(?:the\s+|this\s+|that\s+|a\s+|an\s+)?(?:person|car|object|stain|logo|watermark|pole|bystander|scratch|detail|telephone\s+pole|parked\s+car)/i,
  /(?:inpaint\s+(?:this|the|unwanted|area|scratch|damaged|texture))/i
];


const GENERATE_PATTERNS = [
  /^(?:tạo\s+ảnh|vẽ\s+ảnh|sinh\s+ảnh|tao\s+anh|ve\s+anh|generate\s+(?:an?\s+)?image|create\s+(?:an?\s+)?image)\s*(.*)/i
];

const COLOR_NAMES: Record<string, string> = {
  đỏ: 'red', do: 'red', red: 'red',
  xanh: 'blue', 'xanh dương': 'blue', 'xanh duong': 'blue', blue: 'blue',
  'xanh lá': 'green', 'xanh la': 'green', green: 'green',
  vàng: 'yellow', vang: 'yellow', yellow: 'yellow', blond: 'yellow', blonde: 'yellow', golden: 'yellow',
  tím: 'purple', tim: 'purple', purple: 'purple',
  hồng: 'pink', hong: 'pink', pink: 'pink',
  đen: 'black', den: 'black', black: 'black',
  trắng: 'white', trang: 'white', white: 'white',
  cam: 'orange', orange: 'orange',
  nâu: 'brown', nau: 'brown', brown: 'brown',
  xám: 'gray', xam: 'gray', gray: 'gray', grey: 'gray'
};

/**
 * RulePlanner (B22)
 * Deterministic rule-first multi-step planner.
 * Accurately classifies chat, analyze, edit, and clarify intents.
 * Binds sequential steps up to 5 steps max.
 */
export class RulePlanner {
  public static plan(prompt: string, context: PlannerContext = {}): MultiStepPlan {
    const trimmed = prompt.trim();
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Security / Adversarial injection detection -> chat, strictly zero tools
    for (const pat of ADVERSARIAL_OR_SECURITY_PATTERNS) {
      if (pat.test(trimmed)) {
        return {
          planId,
          intent: 'chat',
          prompt: trimmed,
          steps: [],
          summary: 'Yêu cầu không hợp lệ hoặc vi phạm chính sách bảo mật, từ chối thực thi tool.'
        };
      }
    }

    // 2. Negation detection ("đừng sửa", "don't edit", "không cần thay đổi", "keep original") -> chat, no edit
    for (const pat of NEGATION_PATTERNS) {
      if (pat.test(trimmed)) {
        return {
          planId,
          intent: 'chat',
          prompt: trimmed,
          steps: [],
          summary: 'Người dùng yêu cầu giữ nguyên ảnh, không chỉnh sửa.'
        };
      }
    }

    // 3. Informational or definition questions -> chat, no edit
    for (const pat of DEFINITION_OR_INFO_QUESTION_PATTERNS) {
      if (pat.test(trimmed)) {
        return {
          planId,
          intent: 'chat',
          prompt: trimmed,
          steps: [],
          summary: 'Câu hỏi thông tin hoặc giao tiếp, không phát sinh chỉnh sửa ảnh.'
        };
      }
    }

    // General question mark check (if not explicit imperative edit)
    if (/[?？]$/.test(trimmed) && !this.isExplicitImperativeEdit(trimmed)) {
      return {
        planId,
        intent: 'chat',
        prompt: trimmed,
        steps: [],
        summary: 'Câu hỏi giao tiếp, không phát sinh chỉnh sửa ảnh.'
      };
    }

    // 4. Image analysis
    if (ANALYZE_PATTERNS.some(p => p.test(trimmed))) {
      return {
        planId,
        intent: 'analyze',
        prompt: trimmed,
        steps: [
          {
            stepId: 'step_1',
            toolName: 'image.analyze',
            args: {
              imageId: context.currentImageId || 'active_image',
              includeCaption: true
            },
            description: 'Phân tích thông số ánh sáng, tương phản và chất lượng ảnh'
          }
        ],
        summary: 'Phân tích chi tiết hình ảnh hiện tại.'
      };
    }

    // 5. Missing mask clarification for inpainting/localized object removal
    if (LOCAL_INPAINT_PATTERNS.some(p => p.test(trimmed)) && !context.maskId) {
      return {
        planId,
        intent: 'clarify',
        prompt: trimmed,
        steps: [],
        clarificationMessage:
          'Thao tác xóa vật thể/inpaint yêu cầu bạn dùng công cụ cọ vẽ (Brush) trên Canvas để khoanh vùng (tạo mask) trước.',
        summary: 'Yêu cầu người dùng cung cấp mask vùng cần xóa.'
      };
    }

    // 6. Image generation
    const genMatch = trimmed.match(GENERATE_PATTERNS[0]);
    if (genMatch) {
      const genPrompt = genMatch[1]?.trim() || trimmed;
      return {
        planId,
        intent: 'edit',
        prompt: trimmed,
        steps: [
          {
            stepId: 'step_1',
            toolName: 'image.generate',
            args: {
              prompt: genPrompt,
              width: 512,
              height: 512
            },
            description: `Tạo hình ảnh mới với mô tả: "${genPrompt}"`
          }
        ],
        summary: `Sinh ảnh mới từ mô tả "${genPrompt}".`
      };
    }

    // 7. Sequential extraction (up to 5 steps)
    const stepStrings = trimmed
      .split(/\s+(?:rồi|roi|sau\s+đó|sau\s+do|then|and\s+then)\s+/iu)
      .map(s => s.trim())
      .filter(Boolean);


    if (stepStrings.length > 5) {
      throw new Error('Kế hoạch chỉ cho phép tối đa 5 bước liên tiếp.');
    }

    const steps: PlanStep[] = [];
    const stepSummaries: string[] = [];

    for (let i = 0; i < stepStrings.length; i++) {
      const stepStr = stepStrings[i];
      const isSubsequent = steps.length > 0;
      const stepId = `step_${steps.length + 1}`;
      const parsed = this.parseIndividualStep(stepStr, stepId, isSubsequent, context);

      if (parsed) {
        steps.push(parsed);
        stepSummaries.push(parsed.description || parsed.toolName);
      }
    }

    if (steps.length === 0) {
      return {
        planId,
        intent: 'chat',
        prompt: trimmed,
        steps: [],
        summary: 'Không nhận diện được tác vụ chỉnh sửa ảnh cụ thể, phản hồi hội thoại.'
      };
    }

    const plan: MultiStepPlan = {
      planId,
      intent: 'edit',
      prompt: trimmed,
      steps,
      summary: `Kế hoạch ${steps.length} bước: ${stepSummaries.join(' -> ')}`
    };

    PlanValidator.validate(plan);
    return plan;
  }

  private static parseIndividualStep(
    stepStr: string,
    stepId: string,
    isSubsequent: boolean,
    context: PlannerContext
  ): PlanStep | null {
    // 1. Remove background / Cutout
    if (/(?:tách\s+nền|tach\s+nen|xóa\s+phông|xoa\s+phong|tách\s+phông|tach\s+phong|cutout|remove\s+(?:the\s+)?background)/i.test(stepStr)) {
      return {
        stepId,
        toolName: 'image.remove_background',
        args: {
          imageId: isSubsequent ? '$prev.artifactId' : (context.currentImageId || 'active_image'),
          quality: 'model',
          preserveDetails: true
        },
        inputBindings: isSubsequent ? { imageId: '$prev.artifactId' } : undefined,
        description: 'Tách phông nền giữ lại chủ thể'
      };
    }

    // 2. Recolor (clothes, hair, background)
    if (/(?:đổi\s+màu|doi\s+mau|nhuộm|nhuom|chuyển\s+màu|thay\s+màu|đổi\s+áo|doi\s+ao|đổi\s+tóc|doi\s+toc|đổi\s+phông|đổi\s+nền|recolor|change\s+hair|change\s+clothes|make\s+(?:the\s+)?hair)/i.test(stepStr)) {
      let target: 'hair' | 'clothes' | 'background' = 'clothes';
      if (/tóc|hair/i.test(stepStr)) target = 'hair';
      else if (/nền|phông|background/i.test(stepStr)) target = 'background';

      let resolvedColor = 'blue';
      for (const [name, val] of Object.entries(COLOR_NAMES)) {
        if (new RegExp(`\\b${name}\\b`, 'i').test(stepStr)) {
          resolvedColor = val;
          break;
        }
      }

      return {
        stepId,
        toolName: 'image.recolor',
        args: {
          imageId: isSubsequent ? '$prev.artifactId' : (context.currentImageId || 'active_image'),
          target,
          color: resolvedColor
        },
        inputBindings: isSubsequent ? { imageId: '$prev.artifactId' } : undefined,
        description: `Đổi màu ${target} sang màu ${resolvedColor}`
      };
    }

    // 3. Inpaint (when mask is available)
    if (LOCAL_INPAINT_PATTERNS.some(p => p.test(stepStr))) {
      return {
        stepId,
        toolName: 'image.inpaint',
        args: {
          imageId: isSubsequent ? '$prev.artifactId' : (context.currentImageId || 'active_image'),
          maskId: context.maskId || 'mask_active',
          prompt: stepStr
        },
        inputBindings: isSubsequent ? { imageId: '$prev.artifactId' } : undefined,
        description: 'Inpaint/xóa đối tượng theo vùng mask'
      };
    }

    // 4. Upscale
    if (/(?:phóng\s+to|phong\s+to|upscale|tăng\s+nét|tang\s+net)/i.test(stepStr)) {
      return {
        stepId,
        toolName: 'upscale_image',
        args: {
          factor: /4x/i.test(stepStr) ? 4 : 2
        },
        inputBindings: isSubsequent ? { imageId: '$prev.artifactId' } : undefined,
        description: 'Phóng to và nâng cao chi tiết hình ảnh'
      };
    }

    return null;
  }

  private static isExplicitImperativeEdit(text: string): boolean {
    return /^(?:hãy\s+|làm\s+ơn\s+|please\s+)?(?:tách\s+nền|xóa\s+phông|đổi\s+màu|phóng\s+to|upscale|cutout|recolor|remove\s+background)/i.test(text);
  }
}
