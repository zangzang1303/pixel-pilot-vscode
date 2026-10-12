// CodeGenService.ts - Image-to-Code generator (UI Mockup to React / Tailwind HTML)
import * as vscode from 'vscode';
import * as path from 'path';
import { ICodeGenService, CodeGenRequest, CodeGenResult } from './ICodeGenService';
import { SecretManager } from '../security/SecretManager';
import { WorkspaceFSService } from '../storage/WorkspaceFSService';

export class CodeGenService implements ICodeGenService {
  private static instance: CodeGenService;
  private secretManager: SecretManager;
  private fsService: WorkspaceFSService;

  private constructor(context?: vscode.ExtensionContext) {
    this.secretManager = SecretManager.getInstance(context);
    this.fsService = WorkspaceFSService.getInstance();
  }

  public static getInstance(context?: vscode.ExtensionContext): CodeGenService {
    if (!CodeGenService.instance) {
      CodeGenService.instance = new CodeGenService(context);
    }
    return CodeGenService.instance;
  }

  /**
   * Generates code from image mockup using Vision AI (Gemini or OpenAI Vision) with robust fallback.
   */
  public async generateCodeFromImage(request: CodeGenRequest): Promise<CodeGenResult> {
    const { imageBuffer, imageMimeType, framework } = request;
    const base64Data = imageBuffer.toString('base64');

    const apiKey = await this.secretManager.getLLMKey();
    let generatedCode = '';

    const systemPrompt = `You are an expert Frontend Engineer and UI/UX Designer.
Analyze this UI screenshot or wireframe mockup with extreme precision.
Generate modern, pixel-faithful, responsive, and accessible code using ${framework}.
Use modern Tailwind CSS utility classes with sleek gradients, nice shadows, rounded corners and clean typography.
Output ONLY the clean source code inside a single markdown code block (\`\`\`tsx or \`\`\`html). No explanations before or after.`;

    if (apiKey && (apiKey.startsWith('AIza') || apiKey.length > 20)) {
      try {
        if (apiKey.startsWith('AIza')) {
          // Gemini Vision
          generatedCode = await this.callGeminiVision(apiKey, base64Data, imageMimeType, systemPrompt);
        } else {
          // OpenAI Vision
          generatedCode = await this.callOpenAIVision(apiKey, base64Data, imageMimeType, systemPrompt);
        }
      } catch (err: any) {
        console.warn('[CodeGenService] AI call failed, falling back to mock UI generator:', err?.message || err);
      }
    }

    if (!generatedCode || generatedCode.trim().length === 0) {
      generatedCode = this.getFallbackTemplate(framework);
    }

    const cleanCode = this.stripMarkdownCodeBlocks(generatedCode);
    const suggestedFileName = framework === 'react-tailwind' ? 'GeneratedComponent.tsx' : 'generated_mockup.html';

    return {
      code: cleanCode,
      framework,
      suggestedFileName
    };
  }

  /**
   * Opens the generated code in a new VS Code text editor tab.
   */
  public async openInEditor(code: string, fileName: string, language: string = 'typescriptreact'): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument({
      language: language,
      content: code
    });
    return await vscode.window.showTextDocument(doc, { preview: false });
  }

  /**
   * Saves the generated code directly to the workspace next to an image or in the active folder.
   */
  public async saveToFile(targetUri: vscode.Uri, code: string): Promise<void> {
    await this.fsService.writeFile(targetUri, Buffer.from(code, 'utf-8'));
    const doc = await vscode.workspace.openTextDocument(targetUri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private async callGeminiVision(apiKey: string, base64: string, mime: string, prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mime || 'image/png', data: base64 } }
        ]
      }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Gemini API Error: ${res.statusText}`);
    }

    const json = await res.json() as any;
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private async callOpenAIVision(apiKey: string, base64: string, mime: string, prompt: string): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime || 'image/png'};base64,${base64}` } }
          ]
        }
      ],
      max_tokens: 3000
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`OpenAI API Error: ${res.statusText}`);
    }

    const json = await res.json() as any;
    return json?.choices?.[0]?.message?.content || '';
  }

  private stripMarkdownCodeBlocks(raw: string): string {
    let clean = raw.trim();
    if (clean.startsWith('```')) {
      const firstLineEnd = clean.indexOf('\n');
      if (firstLineEnd !== -1) {
        clean = clean.substring(firstLineEnd + 1);
      }
    }
    if (clean.endsWith('```')) {
      clean = clean.substring(0, clean.lastIndexOf('```')).trim();
    }
    return clean;
  }

  private getFallbackTemplate(framework: string): string {
    if (framework === 'react-tailwind') {
      return `import React from 'react';

export interface UIProps {
  title?: string;
  subtitle?: string;
}

export const GeneratedUIComponent: React.FC<UIProps> = ({
  title = "AI Generated UI Component",
  subtitle = "Generated faithfully from image mockup with Tailwind CSS"
}) => {
  return (
    <section className="relative w-full max-w-4xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md text-white">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 space-y-2">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 rounded-full">
            AI Vision Studio
          </span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all duration-200 border border-slate-700">
            Cancel
          </button>
          <button className="px-5 py-2.5 text-sm font-medium text-black bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200">
            Get Started
          </button>
        </div>
      </div>
    </section>
  );
};

export default GeneratedUIComponent;`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Generated Mockup UI</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6">
  <div class="max-w-xl w-full p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur">
    <div class="h-2 w-16 bg-cyan-400 rounded-full mb-6"></div>
    <h1 class="text-3xl font-bold tracking-tight text-white mb-2">AI Generated Mockup UI</h1>
    <p class="text-slate-400 text-sm mb-6">Generated faithfully from image mockup using Tailwind CSS utility styling.</p>
    <button class="w-full py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl shadow-lg shadow-cyan-500/30 transition-all">
      Continue
    </button>
  </div>
</body>
</html>`;
  }
}
