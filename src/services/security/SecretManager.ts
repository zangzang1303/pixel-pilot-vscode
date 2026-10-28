// SecretManager.ts - Enterprise-grade Secret Management using vscode.SecretStorage
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SecretManager {
  private static instance?: SecretManager;
  private static readonly RUNWARE_KEY_ID = 'pixelPilot.runwareApiKey';
  private static readonly RUNWARE_DISCONNECTED_ID = 'pixelPilot.runwareDisconnected';
  private static readonly ENTERPRISE_GATEWAY_TOKEN = 'pixelPilot.enterpriseGatewayToken';
  private secrets: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.secrets = context.secrets;
    SecretManager.instance = this;
  }

  public static getInstance(context?: vscode.ExtensionContext): SecretManager {
    if (!SecretManager.instance) {
      if (context) {
        SecretManager.instance = new SecretManager(context);
      } else {
        // Fallback dummy SecretStorage if context not yet provided
        SecretManager.instance = new SecretManager({ secrets: { get: async () => undefined, store: async () => {}, delete: async () => {}, onDidChange: () => ({ dispose: () => {} }) } } as any);
      }
    }
    return SecretManager.instance;
  }

  public async getLLMKey(): Promise<string> {
    return this.getLlmApiKey();
  }

  private getEnvKey(name: string): string {
    try {
      const folders = vscode.workspace.workspaceFolders;
      if (folders && Array.isArray(folders) && folders.length > 0) {
        for (const folder of folders) {
          const envPath = path.join(folder.uri.fsPath, '.env');
          if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const regex = new RegExp(`^\\s*${name}\\s*=\\s*['"]?([^'"\\r\\n]+)['"]?`, 'm');
            const match = content.match(regex);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
      }
    } catch {}
    return '';
  }

  /**
   * Retrieves the Runware API key exclusively from VS Code SecretStorage,
   * with fallback to .env when available.
   * A legacy settings value is imported once and then removed.
   */
  public async getApiKey(): Promise<string> {
    if (await this.secrets.get(SecretManager.RUNWARE_DISCONNECTED_ID)) return '';
    const secretKey = await this.secrets.get(SecretManager.RUNWARE_KEY_ID);
    if (secretKey && secretKey.trim()) {
      return secretKey.trim();
    }

    // Explicit one-time migration from the legacy setting.
    const config = vscode.workspace.getConfiguration('pixelPilot');
    // Only global settings can migrate into the global vault without crossing
    // workspace boundaries. Workspace-scoped keys require an explicit import.
    const legacyKey = config.inspect<string>('apiKey')?.globalValue;
    if (legacyKey && legacyKey.trim()) {
      // Migrate to SecretStorage
      await this.setApiKey(legacyKey.trim());
      // Clean up plain text key from settings.json
      await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        '🔒 Pixel Pilot Enterprise: Đã tự động di chuyển API Key từ settings.json sang kho bảo mật mã hóa SecretStorage của hệ điều hành!'
      );
      return legacyKey.trim();
    }

    const envKey = this.getEnvKey('RUNWARE_API_KEY');
    if (envKey) return envKey;

    return '';
  }

  /**
   * Stores an API Key securely in OS Encrypted Vault
   */
  public async setApiKey(apiKey: string): Promise<void> {
    await this.secrets.store(SecretManager.RUNWARE_KEY_ID, apiKey.trim());
    await this.secrets.delete(SecretManager.RUNWARE_DISCONNECTED_ID);
  }

  /**
   * Clears the API Key from SecretStorage
   */
  public async deleteApiKey(): Promise<void> {
    await this.secrets.store(SecretManager.RUNWARE_DISCONNECTED_ID, '1');
    await this.secrets.delete(SecretManager.RUNWARE_KEY_ID);
  }

  /**
   * Sets Enterprise Gateway Token for On-Premise / Private Cloud inference
   */
  public async setEnterpriseToken(token: string): Promise<void> {
    await this.secrets.store(SecretManager.ENTERPRISE_GATEWAY_TOKEN, token.trim());
  }

  /**
   * Gets Enterprise Gateway Token
   */
  public async getEnterpriseToken(): Promise<string> {
    return (await this.secrets.get(SecretManager.ENTERPRISE_GATEWAY_TOKEN)) || '';
  }

  private static readonly LLM_KEY_ID = 'pixelPilot.llmApiKey';
  private static readonly LLM_KEY_PROVIDER_ID = 'pixelPilot.llmApiKeyProvider';
  private static readonly LLM_DISCONNECTED_ID = 'pixelPilot.llmDisconnected';
  private static readonly LLM_PROVIDER_ID = 'pixelPilot.llmProvider';

  private static llmProviderKeyId(provider: string): string {
    return `pixelPilot.llmApiKey.${provider}`;
  }

  private static llmProviderDisconnectedId(provider: string): string {
    return `pixelPilot.llmDisconnected.${provider}`;
  }

  private async retireLegacyLlmKey(provider: string): Promise<void> {
    const legacyKey = await this.secrets.get(SecretManager.LLM_KEY_ID);
    if (!legacyKey) return;
    const tagged = await this.secrets.get(SecretManager.LLM_KEY_PROVIDER_ID);
    const configured = vscode.workspace.getConfiguration('pixelPilot').inspect<string>('llmProvider')?.globalValue;
    const owner = tagged || configured || provider;
    if (owner === provider) {
      await this.secrets.delete(SecretManager.LLM_KEY_ID);
      await this.secrets.delete(SecretManager.LLM_KEY_PROVIDER_ID);
    } else if (!tagged) {
      await this.secrets.store(SecretManager.LLM_KEY_PROVIDER_ID, owner);
    }
  }

  /**
   * Retrieves the LLM API Key (Gemini, OpenAI, Groq, etc.)
   */
  public async getLlmApiKey(): Promise<string> {
    const provider = await this.getLlmProvider();
    if (provider === 'local' || provider === 'ollama') return '';
    if (await this.secrets.get(SecretManager.llmProviderDisconnectedId(provider))) return '';
    const providerKey = await this.secrets.get(SecretManager.llmProviderKeyId(provider));
    if (providerKey?.trim()) return providerKey.trim();

    // A legacy global disconnect prevents old settings and the old single-key
    // slot from coming back, while newly connected provider slots still work.
    if (await this.secrets.get(SecretManager.LLM_DISCONNECTED_ID)) return '';
    const secretKey = await this.secrets.get(SecretManager.LLM_KEY_ID);
    if (secretKey && secretKey.trim()) {
      const keyProvider = await this.secrets.get(SecretManager.LLM_KEY_PROVIDER_ID);
      const config = vscode.workspace.getConfiguration('pixelPilot');
      const legacyProvider = keyProvider || config.inspect<string>('llmProvider')?.globalValue || 'gemini';
      if (legacyProvider === provider) {
        await this.secrets.store(SecretManager.llmProviderKeyId(provider), secretKey.trim());
        await this.secrets.delete(SecretManager.LLM_KEY_ID);
        await this.secrets.delete(SecretManager.LLM_KEY_PROVIDER_ID);
        return secretKey.trim();
      }
    }
    const config = vscode.workspace.getConfiguration('pixelPilot');
    const legacyKey = config.inspect<string>('llmApiKey')?.globalValue;
    if (legacyKey && legacyKey.trim()) {
      const legacyProvider = config.inspect<string>('llmProvider')?.globalValue || 'gemini';
      if (legacyProvider !== provider) return '';
      await this.setLlmApiKey(legacyKey.trim());
      await config.update('llmApiKey', undefined, vscode.ConfigurationTarget.Global);
      return legacyKey.trim();
    }

    const envKey = this.getEnvKey(provider === 'gemini' ? 'GEMINI_API_KEY' : `${provider.toUpperCase()}_API_KEY`);
    if (envKey) return envKey;

    return '';
  }

  public async setLlmApiKey(apiKey: string): Promise<void> {
    const provider = await this.getLlmProvider();
    if (provider === 'local' || provider === 'ollama') throw new Error('A cloud LLM provider is required to store an API key.');
    if (!apiKey.trim()) throw new Error('An API key is required.');
    await this.secrets.store(SecretManager.llmProviderKeyId(provider), apiKey.trim());
    await this.secrets.delete(SecretManager.llmProviderDisconnectedId(provider));
    await this.retireLegacyLlmKey(provider);
  }

  public async deleteLlmApiKey(): Promise<void> {
    const provider = await this.getLlmProvider();
    if (provider === 'local' || provider === 'ollama') return;
    await this.secrets.store(SecretManager.llmProviderDisconnectedId(provider), '1');
    await this.secrets.delete(SecretManager.llmProviderKeyId(provider));
    await this.retireLegacyLlmKey(provider);
  }

  public async getLlmProvider(): Promise<'gemini' | 'openai' | 'groq' | 'openrouter' | 'ollama' | 'local'> {
    const prov = await this.secrets.get(SecretManager.LLM_PROVIDER_ID);
    const config = vscode.workspace.getConfiguration('pixelPilot');
    const selected = prov || config.get<string>('llmProvider') || 'gemini';
    return ['gemini', 'openai', 'groq', 'openrouter', 'ollama', 'local'].includes(selected)
      ? selected as 'gemini' | 'openai' | 'groq' | 'openrouter' | 'ollama' | 'local'
      : 'local';
  }

  public async setLlmProvider(provider: string): Promise<void> {
    if (!['gemini', 'openai', 'groq', 'openrouter', 'ollama', 'local'].includes(provider)) {
      throw new Error('Unsupported LLM provider.');
    }
    const existingKey = await this.secrets.get(SecretManager.LLM_KEY_ID);
    const boundProvider = await this.secrets.get(SecretManager.LLM_KEY_PROVIDER_ID);
    if (existingKey && !boundProvider) {
      const previousProvider = await this.getLlmProvider();
      if (previousProvider !== 'local' && previousProvider !== 'ollama') {
        await this.secrets.store(SecretManager.LLM_KEY_PROVIDER_ID, previousProvider);
      }
    }
    await this.secrets.store(SecretManager.LLM_PROVIDER_ID, provider);
  }

  public async getMaskedLlmKey(): Promise<string> {
    const key = await this.getLlmApiKey();
    if (!key) return '';
    if (key.length <= 4) return '••••';
    return '••••••••' + key.slice(-4);
  }

  /**
   * Returns a masked preview of the Runware API key (e.g. ••••••••4kof)
   */
  public async getMaskedApiKey(): Promise<string> {
    const key = await this.getApiKey();
    if (!key) return '';
    if (key.length <= 4) return '••••';
    return '••••••••' + key.slice(-4);
  }
}
