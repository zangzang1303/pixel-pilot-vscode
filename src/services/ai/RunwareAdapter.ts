// RunwareAdapter.ts - Pure Real Production Implementation for Runware SOTA Cloud Vision API
import fs from 'fs';
import path from 'path';
import { IAIProvider } from './IAIProvider';
import { AIResult } from '../session/types';

export class RunwareAdapter implements IAIProvider {
  public name = 'Runware SOTA Cloud Vision';
  private apiKey: string = '';
  private endpoint = 'https://api.runware.ai/v1';

  constructor(apiKey?: string) {
    this.updateApiKey(apiKey);
  }

  public updateApiKey(key?: string): void {
    if (key && key.trim()) {
      this.apiKey = key.trim();
      return;
    }

    // Try environment variable
    if (process.env.RUNWARE_API_KEY && process.env.RUNWARE_API_KEY.trim()) {
      this.apiKey = process.env.RUNWARE_API_KEY.trim();
      return;
    }

    // Try reading from .env files in common workspace locations
    const possibleEnvPaths = [
      path.resolve('.env'),
      path.resolve('pixel-pilot-vscode', '.env'),
      path.resolve('..', '.env'),
      'd:/CODE/DAKH/pixel-pilot-vscode/.env',
      'd:/CODE/DAKH/.env'
    ];

    for (const envPath of possibleEnvPaths) {
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, 'utf-8');
          const match = content.match(/RUNWARE_API_KEY=["']?([^"'\r\n]+)["']?/);
          if (match && match[1] && match[1].trim() && match[1].trim() !== 'YOUR_RUNWARE_API_KEY') {
            this.apiKey = match[1].trim();
            console.log(`[RunwareAdapter] Loaded API Key from: ${envPath}`);
            return;
          }
        } catch (e) {
          // ignore read error
        }
      }
    }
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public setApiKey(key: string): void {
    this.apiKey = (key || '').trim();
  }

  private normalizeImageInput(imageInput: string): string {
    if (!imageInput) return '';
    if (imageInput.startsWith('data:image')) {
      return imageInput;
    }
    if (fs.existsSync(imageInput)) {
      const ext = path.extname(imageInput).toLowerCase().replace('.', '') || 'png';
      const base64 = fs.readFileSync(imageInput).toString('base64');
      return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`;
    }
    return imageInput;
  }

  /**
   * Universal extractor for image outputs returned by Runware API
   */
  private extractImageOutput(res: any): string | null {
    if (!res) return null;
    return (
      res.imageDataURI ||
      res.imageURL ||
      res.guideImageDataURI ||
      res.guideImageURL ||
      res.dataURI ||
      (res.base64Data ? `data:image/png;base64,${res.base64Data}` : null) ||
      res.image ||
      res.svg ||
      null
    );
  }

  private async dispatchTasks(tasks: any[]): Promise<{ data: any; latencyMs: number }> {
    // Refresh key if needed
    if (!this.apiKey) {
      this.updateApiKey();
    }

    if (!this.apiKey || this.apiKey.trim() === '' || this.apiKey === 'YOUR_RUNWARE_API_KEY') {
      throw new Error('Chưa cấu hình Runware API Key. Hãy nhập API Key của bạn để gửi request thật lên Runware AI (Đăng ký nhận credits tại https://runware.ai)');
    }

    console.log(`[Runware API] Đang gửi request tới: ${this.endpoint} (Tasks: ${tasks.map(t => t.taskType).join(', ')})`);
    const startTime = Date.now();

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tasks)
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr: any = null;
      try { parsedErr = JSON.parse(errText); } catch {}
      const errMsg = parsedErr?.errors?.[0]?.message || parsedErr?.error || errText;
      throw new Error(`Runware HTTP ${response.status}: ${errMsg}`);
    }

    const json = (await response.json()) as any;
    if (json.errors && json.errors.length > 0) {
      const messages = json.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ');
      throw new Error(`Lỗi từ Runware API: ${messages}`);
    }

    const resultData = json.data || json;
    console.log(`[Runware API] Phản hồi thành công trong ${latencyMs}ms`);
    return { data: resultData, latencyMs };
  }

  /**
   * 1. Remove Background (BiRefNet SOTA Matting)
   */
  public async removeBackground(imageInput: string, options?: { model?: string }): Promise<AIResult> {
    try {
      const img = this.normalizeImageInput(imageInput);
      const taskUUID = crypto.randomUUID();
      const payload = [
        {
          taskType: 'removeBackground',
          taskUUID,
          model: options?.model || 'runware:112@9', // BiRefNet Matting
          outputFormat: 'PNG',
          outputType: 'dataURI',
          inputs: { image: img }
        }
      ];

      const { data, latencyMs } = await this.dispatchTasks(payload);
      const res = Array.isArray(data) ? data[0] : data;
      const outputImage = this.extractImageOutput(res);

      if (!outputImage) {
        throw new Error('Runware API không trả về dữ liệu ảnh kết quả. Phản hồi: ' + JSON.stringify(res));
      }

      return {
        success: true,
        outputImageUri: outputImage,
        metrics: {
          model: 'Runware BiRefNet (runware:112@9)',
          latencyMs,
          costUsd: 0.0006
        }
      };
    } catch (err: any) {
      return {
        success: false,
        metrics: { model: 'Runware BiRefNet', latencyMs: 0, costUsd: 0 },
        error: err.message || String(err)
      };
    }
  }

  /**
   * 2. Upscale (2x / 4x Super-Resolution)
   */
  public async upscale(imageInput: string, factor: 2 | 4): Promise<AIResult> {
    try {
      const img = this.normalizeImageInput(imageInput);
      const taskUUID = crypto.randomUUID();
      const payload = [
        {
          taskType: 'upscale',
          taskUUID,
          upscaleFactor: factor,
          outputFormat: 'PNG',
          outputType: 'dataURI',
          inputImage: img
        }
      ];

      const { data, latencyMs } = await this.dispatchTasks(payload);
      const res = Array.isArray(data) ? data[0] : data;
      const outputImage = this.extractImageOutput(res);

      if (!outputImage) {
        throw new Error('Runware API không trả về ảnh upscale. Phản hồi: ' + JSON.stringify(res));
      }

      return {
        success: true,
        outputImageUri: outputImage,
        metrics: {
          model: `Runware Upscale ${factor}x`,
          latencyMs,
          costUsd: factor === 4 ? 0.002 : 0.001
        }
      };
    } catch (err: any) {
      return {
        success: false,
        metrics: { model: 'Runware Upscale', latencyMs: 0, costUsd: 0 },
        error: err.message || String(err)
      };
    }
  }

  /**
   * 3. Vectorize (Raster to Vector SVG)
   */
  public async vectorize(imageInput: string): Promise<AIResult> {
    try {
      const img = this.normalizeImageInput(imageInput);
      const taskUUID = crypto.randomUUID();
      const payload = [
        {
          taskType: 'vectorize',
          taskUUID,
          inputImage: img,
          outputType: 'dataURI'
        }
      ];

      const { data, latencyMs } = await this.dispatchTasks(payload);
      const res = Array.isArray(data) ? data[0] : data;
      const outputUri = this.extractImageOutput(res);

      if (!outputUri) {
        throw new Error('Runware API không trả về dữ liệu Vector SVG. Phản hồi: ' + JSON.stringify(res));
      }

      let svgCode = '';
      if (typeof outputUri === 'string') {
        if (outputUri.startsWith('data:image/svg+xml;base64,')) {
          svgCode = Buffer.from(outputUri.split(',')[1], 'base64').toString('utf-8');
        } else if (outputUri.includes('<svg')) {
          svgCode = outputUri;
        }
      }

      return {
        success: true,
        outputImageUri: outputUri,
        textResult: svgCode || outputUri,
        metrics: {
          model: 'Runware Recraft Vectorizer',
          latencyMs,
          costUsd: 0.003
        }
      };
    } catch (err: any) {
      return {
        success: false,
        metrics: { model: 'Runware Vectorize', latencyMs: 0, costUsd: 0 },
        error: err.message || String(err)
      };
    }
  }

  /**
   * 4. Inpaint / Generative Edit
   */
  public async inpaint(imageInput: string, maskInput: string, prompt: string): Promise<AIResult> {
    try {
      const seedImg = this.normalizeImageInput(imageInput);
      const maskImg = maskInput ? this.normalizeImageInput(maskInput) : seedImg;
      const taskUUID = crypto.randomUUID();
      const payload = [
        {
          taskType: 'imageInference',
          taskUUID,
          positivePrompt: prompt || 'high quality restoration, seamless blending',
          seedImage: seedImg,
          maskImage: maskImg,
          model: 'runware:100@1',
          outputFormat: 'PNG',
          outputType: 'dataURI'
        }
      ];

      const { data, latencyMs } = await this.dispatchTasks(payload);
      const res = Array.isArray(data) ? data[0] : data;
      const outputImage = this.extractImageOutput(res);

      if (!outputImage) {
        throw new Error('Runware API không trả về ảnh inpaint. Phản hồi: ' + JSON.stringify(res));
      }

      return {
        success: true,
        outputImageUri: outputImage,
        maskUri: maskInput,
        metrics: {
          model: 'Runware Generative Inpainting',
          latencyMs,
          costUsd: 0.002
        }
      };
    } catch (err: any) {
      return {
        success: false,
        metrics: { model: 'Runware Inpaint', latencyMs: 0, costUsd: 0 },
        error: err.message || String(err)
      };
    }
  }

  /**
   * 5. Extract Binary Mask
   */
  public async extractMask(imageInput: string): Promise<AIResult> {
    return this.removeBackground(imageInput);
  }

  /**
   * 6. Edge Detection & Line Art (Canny, Lineart, SoftEdge, Depth)
   */
  public async detectEdges(imageInput: string, method: 'canny' | 'lineart' | 'softedge' | 'depth'): Promise<AIResult> {
    try {
      const img = this.normalizeImageInput(imageInput);
      const taskUUID = crypto.randomUUID();
      const payload = [
        {
          taskType: 'controlNetPreprocess',
          taskUUID,
          preProcessorType: method,
          inputImage: img,
          outputType: 'dataURI'
        }
      ];

      const { data, latencyMs } = await this.dispatchTasks(payload);
      const res = Array.isArray(data) ? data[0] : data;
      const outputImage = this.extractImageOutput(res);

      if (!outputImage) {
        throw new Error(`Runware API không trả về ảnh ${method}. Phản hồi: ` + JSON.stringify(res));
      }

      return {
        success: true,
        outputImageUri: outputImage,
        metrics: {
          model: `Runware Preprocessor (${method.toUpperCase()})`,
          latencyMs,
          costUsd: 0.0005
        }
      };
    } catch (err: any) {
      return {
        success: false,
        metrics: { model: `Runware Edge (${method})`, latencyMs: 0, costUsd: 0 },
        error: err.message || String(err)
      };
    }
  }

  /**
   * 7. Image Caption & Alt Text
   */
  public async generateCaption(imageInput: string): Promise<AIResult> {
    try {
      const img = this.normalizeImageInput(imageInput);
      const taskUUID = crypto.randomUUID();
      const payload = [
        {
          taskType: 'imageCaption',
          taskUUID,
          model: 'runware:152@1',
          inputImage: img
        }
      ];

      const { data, latencyMs } = await this.dispatchTasks(payload);
      const res = Array.isArray(data) ? data[0] : data;
      const captionText = res.text || res.caption || (typeof res === 'string' ? res : 'Graphic asset');

      return {
        success: true,
        textResult: captionText,
        metrics: {
          model: 'Runware Vision Captioner',
          latencyMs,
          costUsd: 0.0004
        }
      };
    } catch (err: any) {
      return {
        success: false,
        metrics: { model: 'Runware Caption', latencyMs: 0, costUsd: 0 },
        error: err.message || String(err)
      };
    }
  }

  /**
   * 8. Extend Canvas
   */
  public async extendCanvas(imageInput: string, direction: 'all' | 'horizontal' | 'vertical', prompt?: string): Promise<AIResult> {
    return this.inpaint(imageInput, imageInput, prompt || 'seamless environment extension');
  }
}
