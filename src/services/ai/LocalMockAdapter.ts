// LocalMockAdapter.ts - High-Availability Offline Simulation Engine for DAKH Defense & Testing
import fs from 'fs';
import path from 'path';
import { IAIProvider } from './IAIProvider';
import { AIResult } from '../session/types';

export class LocalMockAdapter implements IAIProvider {
  public name = 'PixelPilot Local Engine (Offline / Demo Mode)';
  private testImagesDir: string;

  constructor(workspaceRoot?: string) {
    this.testImagesDir = workspaceRoot
      ? path.join(workspaceRoot, 'pixel-pilot-vscode', 'test_images')
      : path.join(__dirname, '..', '..', '..', 'test_images');
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private findPrecomputedMatch(imageInput: string): string | null {
    // Check if input image is one of the test cases (TC1-TC5)
    for (const tc of ['TC1', 'TC2', 'TC3', 'TC4', 'TC5']) {
      if (imageInput.includes(tc)) {
        const candidate = path.join(this.testImagesDir, '03_runware_birefnet', `${tc}.png`);
        if (fs.existsSync(candidate)) {
          const b64 = fs.readFileSync(candidate).toString('base64');
          return `data:image/png;base64,${b64}`;
        }
      }
    }
    return null;
  }

  public async removeBackground(imageInput: string): Promise<AIResult> {
    await this.sleep(380); // Realistic BiRefNet sub-second latency
    const match = this.findPrecomputedMatch(imageInput);
    const output = match || imageInput;

    return {
      success: true,
      outputImageUri: output,
      metrics: {
        model: 'BiRefNet Matting (Local Mock)',
        latencyMs: 380,
        costUsd: 0.0006,
        softMattingRatio: 38.5
      }
    };
  }

  public async upscale(imageInput: string, factor: 2 | 4): Promise<AIResult> {
    await this.sleep(620);
    return {
      success: true,
      outputImageUri: imageInput,
      metrics: {
        model: `ESRGAN Super-Resolution ${factor}x (Local)`,
        latencyMs: 620,
        costUsd: 0.001
      }
    };
  }

  public async vectorize(imageInput: string): Promise<AIResult> {
    await this.sleep(450);
    const mockSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#38bdf8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#818cf8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Vectorized Contour by PixelPilot AI -->
  <circle cx="250" cy="250" r="200" fill="url(#grad1)" opacity="0.8"/>
  <path d="M150,250 Q250,100 350,250 T250,400 Z" fill="#ffffff" opacity="0.9"/>
  <text x="250" y="470" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="16">PixelPilot Vector Asset (SVG)</text>
</svg>`;

    const b64Svg = `data:image/svg+xml;base64,${Buffer.from(mockSvg).toString('base64')}`;
    return {
      success: true,
      outputImageUri: b64Svg,
      textResult: mockSvg,
      metrics: {
        model: 'Local Potrace/Recraft Vectorizer',
        latencyMs: 450,
        costUsd: 0.003
      }
    };
  }

  public async inpaint(imageInput: string, maskInput: string, prompt: string): Promise<AIResult> {
    await this.sleep(850);
    return {
      success: true,
      outputImageUri: imageInput,
      maskUri: maskInput,
      metrics: {
        model: 'SDXL Inpaint Engine (Offline)',
        latencyMs: 850,
        costUsd: 0.002
      }
    };
  }

  public async extractMask(imageInput: string): Promise<AIResult> {
    await this.sleep(250);
    return {
      success: true,
      outputImageUri: imageInput,
      maskUri: imageInput,
      metrics: {
        model: 'SAM Binary Mask (Local)',
        latencyMs: 250,
        costUsd: 0
      }
    };
  }

  public async detectEdges(imageInput: string, method: 'canny' | 'lineart' | 'softedge' | 'depth'): Promise<AIResult> {
    await this.sleep(300);
    return {
      success: true,
      outputImageUri: imageInput,
      metrics: {
        model: `OpenCV ${method.toUpperCase()} Edge Filter`,
        latencyMs: 300,
        costUsd: 0.0005
      }
    };
  }

  public async generateCaption(imageInput: string): Promise<AIResult> {
    await this.sleep(400);
    const altText = 'A high-contrast graphic object with delicate transparent edge boundaries, suitable for web UI asset integration.';
    return {
      success: true,
      textResult: altText,
      metrics: {
        model: 'LLaVA-1.6 Vision (Local)',
        latencyMs: 400,
        costUsd: 0.0004
      }
    };
  }

  public async extendCanvas(imageInput: string, direction: 'all' | 'horizontal' | 'vertical', prompt?: string): Promise<AIResult> {
    await this.sleep(700);
    return {
      success: true,
      outputImageUri: imageInput,
      metrics: {
        model: 'Outpainting Pad Filter (Local)',
        latencyMs: 700,
        costUsd: 0.002
      }
    };
  }
}
