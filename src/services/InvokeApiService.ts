import * as vscode from 'vscode';

interface HttpResponse<T = any> { status: number; data: T; }

/** Small fetch client that avoids Axios' Node navigator migration failure in
 * newer VS Code Extension Hosts. */
class InvokeHttpClient {
  public defaults: { baseURL: string };

  constructor(baseURL: string, private readonly defaultTimeout = 120000) {
    this.defaults = { baseURL };
  }

  public get(pathname: string, options?: { timeout?: number; responseType?: 'arraybuffer' }): Promise<HttpResponse> {
    return this.request('GET', pathname, undefined, options);
  }

  public post(pathname: string, body?: unknown, options?: { timeout?: number; headers?: Record<string, string>; responseType?: 'arraybuffer' }): Promise<HttpResponse> {
    return this.request('POST', pathname, body, options);
  }

  private async request(method: string, pathname: string, body?: unknown, options?: { timeout?: number; headers?: Record<string, string>; responseType?: 'arraybuffer' }): Promise<HttpResponse> {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!isForm) headers['Content-Type'] = 'application/json';
    for (const [key, value] of Object.entries(options?.headers || {})) {
      if (!(isForm && key.toLowerCase() === 'content-type')) headers[key] = value;
    }

    const response = await fetch(`${this.defaults.baseURL}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body as FormData : JSON.stringify(body),
      signal: AbortSignal.timeout(options?.timeout || this.defaultTimeout)
    });
    const data = options?.responseType === 'arraybuffer'
      ? await response.arrayBuffer()
      : await response.json().catch(async () => ({ message: await response.text().catch(() => '') }));
    if (!response.ok) {
      const message = (data as any)?.message || (data as any)?.detail || response.statusText;
      throw new Error(`HTTP ${response.status}: ${message}`);
    }
    return { status: response.status, data };
  }
}

export interface InvokeModel {
  key: string;
  name: string;
  hash?: string;
  base_model?: string;
  base?: string;
  type?: string;
  description?: string;
}

export interface GenerationOptions {
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  scheduler?: string;
}

export interface GenerationResult {
  imageBuffer: Buffer;
  base64: string;
  dataUrl: string;
  imageName: string;
  metadata?: any;
}

/**
 * Service to communicate with local InvokeAI backend via REST & OpenAPI endpoints.
 */
export class InvokeApiService {
  private client: InvokeHttpClient;
  private baseUrl: string;
  private cachedModels: InvokeModel[] = [];

  constructor(serverUrl?: string) {
    this.baseUrl = serverUrl || this.getConfiguredServerUrl();
    this.client = new InvokeHttpClient(this.baseUrl);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getServerUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
    this.client.defaults.baseURL = this.baseUrl;
  }

  private getConfiguredServerUrl(): string {
    const config = vscode.workspace.getConfiguration('pixelPilot');
    const url = config.get<string>('invokeAIServerUrl') || 'http://127.0.0.1:9090';
    return url.replace(/\/+$/, '');
  }

  /**
   * Ping InvokeAI server to verify connectivity.
   */
  public async ping(): Promise<boolean> {
    try {
      // Try /api/v1/app/version or /api/v1/app/config or /
      const response = await this.client.get('/api/v1/app/version', { timeout: 3000 });
      return response.status >= 200 && response.status < 300;
    } catch {
      try {
        const fallback = await this.client.get('/api/v1/app/config', { timeout: 3000 });
        return fallback.status >= 200 && fallback.status < 300;
      } catch {
        try {
          const root = await this.client.get('/', { timeout: 3000 });
          return root.status >= 200 && root.status < 400;
        } catch {
          return false;
        }
      }
    }
  }

  /**
   * Fetch available models from InvokeAI (SD 1.5, SDXL, Flux, etc.)
   */
  public async getModels(): Promise<InvokeModel[]> {
    try {
      // InvokeAI v2/v3/v4 models endpoints
      let modelsData: any = null;
      try {
        const res = await this.client.get('/api/v2/models/?model_type=main');
        modelsData = res.data;
      } catch {
        const res = await this.client.get('/api/v1/models/');
        modelsData = res.data;
      }

      // InvokeAI keeps database records when model files are deleted outside
      // Model Manager. Exclude these unusable records from Pixel Pilot's model
      // picker so generation cannot be queued with a known-broken model.
      const missingKeys = new Set<string>();
      try {
        const missingResponse = await this.client.get('/api/v2/models/missing');
        const missingList = Array.isArray(missingResponse.data)
          ? missingResponse.data
          : missingResponse.data?.models;
        if (Array.isArray(missingList)) {
          for (const item of missingList) {
            if (typeof item?.key === 'string') missingKeys.add(item.key);
          }
        }
      } catch {
        // Older InvokeAI versions do not expose the missing-model endpoint.
      }

      const models: InvokeModel[] = [];

      if (Array.isArray(modelsData)) {
        for (const item of modelsData) {
          models.push({
            key: item.key || item.name || item.id,
            name: item.name || item.model_name || item.key,
            hash: item.hash,
            base_model: item.base_model || item.base || 'sd-1',
            base: item.base || item.base_model || 'sd-1',
            type: item.type || item.model_type || 'main',
            description: item.description
          });
        }
      } else if (modelsData && typeof modelsData === 'object') {
        const list = modelsData.models || modelsData.entities || Object.values(modelsData);
        if (Array.isArray(list)) {
          for (const item of list) {
            models.push({
              key: item.key || item.name || item.id,
              name: item.name || item.model_name || item.key,
              hash: item.hash,
              base_model: item.base_model || item.base || 'sd-1',
              base: item.base || item.base_model || 'sd-1',
              type: item.type || item.model_type || 'main',
              description: item.description
            });
          }
        }
      }

      const usableModels = models.filter((model) =>
        !missingKeys.has(model.key) && (model.type === 'main' || !model.type)
      );
      this.cachedModels = usableModels;
      return usableModels;
    } catch (error: any) {
      console.error('Failed to get models from InvokeAI:', error?.message || error);
      throw new Error(
        `Could not retrieve models from InvokeAI (${this.baseUrl}). Please ensure InvokeAI is running.`
      );
    }
  }

  /**
   * Generate Text-to-Image via InvokeAI's graph execution and queue polling.
   */
  public async generateTextToImage(
    prompt: string,
    model: string | { key: string; name: string; base_model?: string; hash?: string },
    options?: GenerationOptions,
    onProgress?: (status: string, percentage?: number) => void
  ): Promise<GenerationResult> {
    const isOnline = await this.ping();
    if (!isOnline) {
      throw new Error(
        `InvokeAI server is not reachable at ${this.baseUrl}. Please verify your local InvokeAI instance is started.`
      );
    }

    onProgress?.('Preparing generation graph...', 5);

    // Refresh model cache if empty
    if (this.cachedModels.length === 0) {
      try {
        await this.getModels();
      } catch {
        // Continue even if models fetch failed
      }
    }

    if (this.cachedModels.length === 0) {
      throw new Error('InvokeAI is online but has no usable main model. Reinstall a model in InvokeAI Model Manager or use ComfyUI.');
    }

    let resolvedModel: InvokeModel | undefined;
    if (typeof model === 'string') {
      resolvedModel = this.cachedModels.find((m) => m.key === model || m.name === model);
    } else if (model && typeof model === 'object') {
      resolvedModel = this.cachedModels.find(
        (m) => m.key === (model as any).key || m.name === (model as any).name
      );
    }

    if (!resolvedModel && this.cachedModels.length > 0) {
      resolvedModel = this.cachedModels[0];
    }

    // InvokeAI v6 requires key, hash, name, base, type in model_loader node
    const modelParam: any = {
      key: resolvedModel?.key || (typeof model === 'object' ? (model as any).key : model),
      name: resolvedModel?.name || (typeof model === 'object' ? (model as any).name : model),
      base: resolvedModel?.base || resolvedModel?.base_model || (typeof model === 'object' ? (model as any).base_model : 'sd-1'),
      type: resolvedModel?.type || 'main'
    };
    if (resolvedModel?.hash || (typeof model === 'object' && (model as any).hash)) {
      modelParam.hash = resolvedModel?.hash || (model as any).hash;
    }

    const width = options?.width || 512;
    const height = options?.height || 512;
    const steps = options?.steps || 25;
    const cfgScale = options?.cfgScale || 7.5;
    const seed = options?.seed !== undefined ? options.seed : Math.floor(Math.random() * 2147483647);
    const negativePrompt = options?.negativePrompt || '';
    const scheduler = options?.scheduler || 'euler';

    // Construct InvokeAI Execution Graph
    const graph = {
      id: `t2i_${Date.now()}`,
      nodes: {
        model_loader: {
          id: 'model_loader',
          type: 'main_model_loader',
          model: modelParam
        },
        positive_conditioning: {
          id: 'positive_conditioning',
          type: 'compel',
          prompt: prompt
        },
        negative_conditioning: {
          id: 'negative_conditioning',
          type: 'compel',
          prompt: negativePrompt
        },
        noise: {
          id: 'noise',
          type: 'noise',
          width: width,
          height: height,
          seed: seed
        },
        denoise: {
          id: 'denoise',
          type: 'denoise_latents',
          steps: steps,
          cfg_scale: cfgScale,
          scheduler: scheduler
        },
        latents_to_image: {
          id: 'latents_to_image',
          type: 'l2i'
        }
      },
      edges: [
        {
          source: { node_id: 'model_loader', field: 'unet' },
          destination: { node_id: 'denoise', field: 'unet' }
        },
        {
          source: { node_id: 'model_loader', field: 'clip' },
          destination: { node_id: 'positive_conditioning', field: 'clip' }
        },
        {
          source: { node_id: 'model_loader', field: 'clip' },
          destination: { node_id: 'negative_conditioning', field: 'clip' }
        },
        {
          source: { node_id: 'positive_conditioning', field: 'conditioning' },
          destination: { node_id: 'denoise', field: 'positive_conditioning' }
        },
        {
          source: { node_id: 'negative_conditioning', field: 'conditioning' },
          destination: { node_id: 'denoise', field: 'negative_conditioning' }
        },
        {
          source: { node_id: 'noise', field: 'noise' },
          destination: { node_id: 'denoise', field: 'noise' }
        },
        {
          source: { node_id: 'denoise', field: 'latents' },
          destination: { node_id: 'latents_to_image', field: 'latents' }
        },
        {
          source: { node_id: 'model_loader', field: 'vae' },
          destination: { node_id: 'latents_to_image', field: 'vae' }
        }
      ]
    };

    onProgress?.('Submitting job to InvokeAI queue...', 15);

    // Enqueue Batch
    let itemId: string | number | undefined;
    let batchId: string | undefined;

    try {
      const enqueueRes = await this.client.post('/api/v1/queue/default/enqueue_batch', {
        prepend: false,
        batch: {
          graph: graph,
          runs: 1
        }
      });

      const batchData = enqueueRes.data;
      if (batchData.item_ids && batchData.item_ids.length > 0) {
        itemId = batchData.item_ids[0];
      }
      batchId = batchData.batch?.batch_id || batchData.batch_id;
    } catch (enqueueErr: any) {
      console.warn('Queue enqueue failed, attempting session API fallback...', enqueueErr?.message);
      // Fallback for InvokeAI session API
      return await this.generateViaSession(graph, onProgress);
    }

    if (!itemId && !batchId) {
      throw new Error('Failed to retrieve task item ID from InvokeAI queue.');
    }

    onProgress?.('Job enqueued. Generating image...', 25);

    // Poll for completion (every 1.5 seconds)
    const imageName = await this.pollQueueStatus(itemId, batchId, onProgress);

    onProgress?.('Fetching generated image asset...', 90);

    // Download full image binary
    const imageBuffer = await this.downloadImage(imageName);
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    onProgress?.('Done!', 100);

    return {
      imageBuffer,
      base64,
      dataUrl,
      imageName
    };
  }

  /**
   * Polls the queue item or batch status until completed or failed.
   */
  private async pollQueueStatus(
    itemId?: string | number,
    batchId?: string,
    onProgress?: (status: string, percentage?: number) => void
  ): Promise<string> {
    const maxAttempts = 150; // ~3.5 minutes maximum polling
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        let status = 'pending';
        let itemData: any = null;

        if (itemId) {
          // In InvokeAI v6, endpoint is /api/v1/queue/default/i/{itemId}
          const res = await this.client.get(`/api/v1/queue/default/i/${itemId}`);
          itemData = res.data;
          status = itemData.status;
        } else if (batchId) {
          const res = await this.client.get(`/api/v1/queue/default/b/${batchId}/status`);
          itemData = res.data;
          if (itemData.completed > 0) {
            status = 'completed';
          } else if (itemData.failed > 0) {
            status = 'failed';
          } else if (itemData.canceled > 0) {
            status = 'canceled';
          } else {
            status = itemData.in_progress > 0 ? 'in_progress' : 'pending';
          }
        }

        const pct = Math.min(25 + Math.floor((attempts / 30) * 60), 88);
        onProgress?.(`Rendering: status is "${status}" (tick ${attempts})...`, pct);

        if (status === 'completed') {
          let imageName: string | undefined;

          // 1. Scan session results for image_output node (keys are random UUIDs in InvokeAI 6)
          if (itemData?.session?.results) {
            for (const nodeResult of Object.values(itemData.session.results) as any[]) {
              if (nodeResult?.image?.image_name) {
                imageName = nodeResult.image.image_name;
                break;
              }
            }
          }

          // 2. Direct results check
          if (!imageName && itemData?.result?.image?.image_name) {
            imageName = itemData.result.image.image_name;
          }

          if (!imageName) {
            throw new Error('Image generation finished but no image result was attached to this InvokeAI job.');
          }

          return imageName;
        }

        if (status === 'failed' || status === 'canceled') {
          const errorMsg = itemData?.error || itemData?.message || `Job was ${status} by InvokeAI.`;
          throw new Error(`Generation failed: ${errorMsg}`);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Generation failed:')) {
          throw err;
        }
        console.warn(`Polling error (attempt ${attempts}):`, err?.message);
      }
    }


    throw new Error('Timed out waiting for InvokeAI to finish image generation.');
  }

  /**
   * Session API fallback execution for alternative InvokeAI configurations.
   */
  private async generateViaSession(
    graph: any,
    onProgress?: (status: string, percentage?: number) => void
  ): Promise<GenerationResult> {
    const sessionRes = await this.client.post('/api/v1/sessions/', graph);
    const sessionId = sessionRes.data.id;

    onProgress?.('Invoking session graph...', 30);
    await this.client.post(`/api/v1/sessions/${sessionId}/invoke`);

    // Poll session
    const maxAttempts = 150;
    let attempts = 0;
    let imageName: string | undefined;

    while (attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const statusRes = await this.client.get(`/api/v1/sessions/${sessionId}`);
      const session = statusRes.data;

      const pct = Math.min(30 + Math.floor((attempts / 30) * 55), 85);
      onProgress?.(`Processing session (tick ${attempts})...`, pct);

      if (session.results && session.results.latents_to_image) {
        imageName = session.results.latents_to_image.image?.image_name;
        break;
      }

      if (session.errors && session.errors.length > 0) {
        throw new Error(`Session execution failed: ${JSON.stringify(session.errors)}`);
      }
    }

    if (!imageName) {
      throw new Error('Session completed without an image result attached to this session.');
    }

    const imageBuffer = await this.downloadImage(imageName);
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    return {
      imageBuffer,
      base64,
      dataUrl,
      imageName
    };
  }

  /**
   * Upscale an image using InvokeAI ESRGAN invocation.
   */
  public async upscaleImage(
    imageBuffer: Buffer,
    factor: number = 2,
    onProgress?: (status: string, percentage?: number) => void
  ): Promise<GenerationResult> {
    const isOnline = await this.ping();
    if (!isOnline) {
      throw new Error(`InvokeAI server is not reachable at ${this.baseUrl}.`);
    }

    onProgress?.('Uploading image to InvokeAI...', 10);

    // Upload image to InvokeAI first
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
    formData.append('file', blob, 'upscale_input.png');

    const uploadRes = await this.client.post('/api/v1/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    const uploadedImageName = uploadRes.data.image_name;
    if (!uploadedImageName) {
      throw new Error('Failed to upload image to InvokeAI for upscaling.');
    }

    onProgress?.('Building upscale graph...', 30);

    const graph = {
      id: `upscale_${Date.now()}`,
      nodes: {
        esrgan: {
          id: 'esrgan',
          type: 'esrgan',
          image: { image_name: uploadedImageName },
          model_name: factor >= 4 ? 'RealESRGAN_x4plus' : 'RealESRGAN_x2plus'
        }
      },
      edges: []
    };

    const enqueueRes = await this.client.post('/api/v1/queue/default/enqueue_batch', {
      prepend: false,
      batch: { graph, runs: 1 }
    });

    const itemId = enqueueRes.data.item_ids?.[0];
    const batchId = enqueueRes.data.batch?.batch_id;

    onProgress?.('Upscaling in progress...', 50);
    const upscaledName = await this.pollQueueStatus(itemId, batchId, onProgress);

    const resultBuffer = await this.downloadImage(upscaledName);
    const base64 = resultBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    return {
      imageBuffer: resultBuffer,
      base64,
      dataUrl,
      imageName: upscaledName
    };
  }

  /**
   * Helper to download raw image buffer from InvokeAI by image_name.
   */
  public async downloadImage(imageName: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/api/v1/images/i/${imageName}/full`, {
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (err: any) {
      throw new Error(`Failed to download image ${imageName} from InvokeAI: ${err.message}`);
    }
  }

}
