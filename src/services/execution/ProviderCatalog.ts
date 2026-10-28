export type ProviderId = 'sharp' | 'comfyui' | 'invokeai' | 'runware' | 'ollama' | 'cloud_llm';

export type PriorityToolName =
  | 'image.analyze'
  | 'image.remove_background'
  | 'image.recolor'
  | 'image.inpaint'
  | 'image.generate';

export interface ProviderCapability {
  providerId: ProviderId;
  name: string;
  isOnline: boolean;
  supportedTools: PriorityToolName[];
  models?: string[];
  unavailableReasons?: Partial<Record<PriorityToolName, string>>;
}

export type ProviderProbe = () => Promise<ProviderCapability>;

/**
 * ProviderCatalog (B13)
 * Manages provider capabilities, health probes, and per-tool availability.
 * Rejects "health = all-tools-ready" assumptions.
 */
export class ProviderCatalog {
  private probes = new Map<ProviderId, ProviderProbe>();

  constructor() {
    this.registerDefaultProbes();
  }

  /**
   * Registers or overrides a probe function for a provider.
   */
  public registerProbe(providerId: ProviderId, probe: ProviderProbe): void {
    this.probes.set(providerId, probe);
  }

  /**
   * Probes a specific provider for real-time capability and health.
   */
  public async probe(providerId: ProviderId): Promise<ProviderCapability> {
    const probe = this.probes.get(providerId);
    if (!probe) {
      return {
        providerId,
        name: providerId,
        isOnline: false,
        supportedTools: [],
        unavailableReasons: {
          'image.analyze': `Provider '${providerId}' is not registered in catalog.`,
          'image.remove_background': `Provider '${providerId}' is not registered in catalog.`,
          'image.recolor': `Provider '${providerId}' is not registered in catalog.`,
          'image.inpaint': `Provider '${providerId}' is not registered in catalog.`,
          'image.generate': `Provider '${providerId}' is not registered in catalog.`
        }
      };
    }
    try {
      return await probe();
    } catch (err: any) {
      return {
        providerId,
        name: providerId,
        isOnline: false,
        supportedTools: [],
        unavailableReasons: {
          'image.analyze': `Probe failed: ${err.message}`,
          'image.remove_background': `Probe failed: ${err.message}`,
          'image.recolor': `Probe failed: ${err.message}`,
          'image.inpaint': `Probe failed: ${err.message}`,
          'image.generate': `Probe failed: ${err.message}`
        }
      };
    }
  }

  /**
   * Probes all registered providers.
   */
  public async probeAll(): Promise<Map<ProviderId, ProviderCapability>> {
    const results = new Map<ProviderId, ProviderCapability>();
    const entries = Array.from(this.probes.entries());
    await Promise.all(
      entries.map(async ([id]) => {
        const cap = await this.probe(id);
        results.set(id, cap);
      })
    );
    return results;
  }

  /**
   * Finds all providers capable of executing the requested tool right now.
   */
  public async getAvailableProvidersForTool(tool: PriorityToolName): Promise<ProviderId[]> {
    const available: ProviderId[] = [];
    for (const [id] of this.probes.entries()) {
      const cap = await this.probe(id);
      if (cap.isOnline && cap.supportedTools.includes(tool)) {
        available.push(id);
      }
    }
    return available;
  }

  /**
   * Checks if a specific provider supports a given tool right now.
   */
  public async isToolSupported(providerId: ProviderId, tool: PriorityToolName): Promise<{ supported: boolean; reason?: string }> {
    const cap = await this.probe(providerId);
    if (!cap.isOnline) {
      return { supported: false, reason: `Provider '${providerId}' is offline or unconfigured.` };
    }
    if (!cap.supportedTools.includes(tool)) {
      return {
        supported: false,
        reason: cap.unavailableReasons?.[tool] || `Tool '${tool}' is not supported by '${providerId}'.`
      };
    }
    return { supported: true };
  }

  private registerDefaultProbes(): void {
    // Sharp (Local Basic image processing)
    this.registerProbe('sharp', async () => {
      const supportedTools: PriorityToolName[] = ['image.analyze', 'image.remove_background', 'image.inpaint'];
      const unavailableReasons: Partial<Record<PriorityToolName, string>> = {
        'image.generate': 'Sharp is a raster processor and does not support image generation.',
        // The production recolor path additionally needs a Python/ONNX mask
        // runtime and a ComfyUI foreground model. Sharp alone must never be
        // advertised as a semantic recolor provider.
        'image.recolor': 'Semantic recolor requires configured Python, the selfie_multiclass ONNX model, and a ComfyUI foreground model.'
      };

      return {
        providerId: 'sharp',
        name: 'Sharp (Local Basic)',
        isOnline: true,
        supportedTools,
        unavailableReasons
      };
    });
  }
}

