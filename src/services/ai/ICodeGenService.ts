// ICodeGenService.ts - Interface contract for Image-to-Code generation (UI Mockup to React/HTML/Tailwind)
import { CodeFramework } from '../security/ConfigManager';

export interface CodeGenRequest {
  imageBuffer: Buffer;
  imageMimeType: string;
  framework: CodeFramework;
  customInstructions?: string;
}

export interface CodeGenResult {
  code: string;
  framework: CodeFramework;
  suggestedFileName: string;
  previewHtml?: string;
}

export interface ICodeGenService {
  /**
   * Analyzes UI screenshot/mockup and generates frontend code (React JSX / Tailwind HTML).
   */
  generateCodeFromImage(request: CodeGenRequest): Promise<CodeGenResult>;
}
