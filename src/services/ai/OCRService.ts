// OCRService.ts - Optical Character Recognition & Text Extraction to Clipboard
import * as vscode from 'vscode';
import { IOCRService, OCRResult } from './IOCRService';
import { SecretManager } from '../security/SecretManager';
import { PolicyService } from '../security/PolicyService';
import { validateImageBuffer } from '../../utils/imageData';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export class OCRService implements IOCRService {
  private static instance: OCRService;
  private secretManager: SecretManager;
  private readonly policy = new PolicyService();

  private constructor(context?: vscode.ExtensionContext) {
    this.secretManager = SecretManager.getInstance(context);
  }

  public static getInstance(context?: vscode.ExtensionContext): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService(context);
    }
    return OCRService.instance;
  }

  /**
   * Extracts text from an image buffer using Vision AI models.
   */
  public async extractText(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    validateImageBuffer(imageBuffer, mimeType);
    const provider = await this.secretManager.getLlmProvider();
    if (provider !== 'gemini' && provider !== 'openai') {
      throw new Error(`OCR is unavailable for provider ${provider}. Select Gemini or OpenAI.`);
    }
    const apiKey = await this.secretManager.getLLMKey();
    if (!apiKey) throw new Error(`${provider} API key is required for OCR.`);
    await this.policy.requireCloudConsent(provider, 'OCR text extraction');
    const base64Data = imageBuffer.toString('base64');

    const ocrPrompt = `You are a high-accuracy OCR (Optical Character Recognition) engine.
Extract ALL text visible in this image verbatim.
Preserve paragraph structure, line breaks, formatting, and language (English, Vietnamese, numbers, symbols, code).
Do NOT summarize, do NOT omit, and do NOT add explanatory text. Output ONLY the extracted text.`;

    const extractedText = provider === 'gemini'
      ? await this.callGeminiOCR(apiKey, base64Data, mimeType, ocrPrompt)
      : await this.callOpenAIOCR(apiKey, base64Data, mimeType, ocrPrompt);

    const lines = extractedText.split('\n').filter(l => l.trim().length > 0);

    return {
      fullText: extractedText.trim(),
      lines,
      // The provider does not expose a calibrated OCR confidence here.
    };
  }

  /**
   * Extracts text and automatically copies it to the system clipboard.
   */
  public async extractAndCopy(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    const result = await this.extractText(imageBuffer, mimeType);
    if (result.fullText) {
      await vscode.env.clipboard.writeText(result.fullText);
      vscode.window.showInformationMessage(
        `📋 Đã trích xuất ${result.lines.length} dòng chữ và sao chép vào Clipboard!`,
        'Xem trước'
      ).then(action => {
        if (action === 'Xem trước') {
          vscode.workspace.openTextDocument({
            content: result.fullText,
            language: 'text'
          }).then(doc => vscode.window.showTextDocument(doc));
        }
      });
    } else {
      vscode.window.showWarningMessage('Không phát hiện thấy văn bản trong hình ảnh.');
    }
    return result;
  }

  private async callGeminiOCR(apiKey: string, base64: string, mime: string, prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mime || 'image/png', data: base64 } }
        ]
      }]
    };

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Gemini OCR Error: ${res.statusText}`);
    }

    const json = await res.json() as any;
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private async callOpenAIOCR(apiKey: string, base64: string, mime: string, prompt: string): Promise<string> {
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
      max_tokens: 2000
    };

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`OpenAI OCR Error: ${res.statusText}`);
    }

    const json = await res.json() as any;
    return json?.choices?.[0]?.message?.content || '';
  }
}
