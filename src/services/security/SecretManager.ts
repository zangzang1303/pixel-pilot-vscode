// SecretManager.ts - Enterprise-grade Secret Management using vscode.SecretStorage
import * as vscode from 'vscode';

export class SecretManager {
  private static readonly RUNWARE_KEY_ID = 'pixelPilot.runwareApiKey';
  private static readonly ENTERPRISE_GATEWAY_TOKEN = 'pixelPilot.enterpriseGatewayToken';
  private secrets: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.secrets = context.secrets;
  }

  /**
   * Retrieves the Runware API Key with enterprise precedence:
   * 1. OS-level Encrypted SecretStorage
   * 2. Environment variable (RUNWARE_API_KEY / PIXEL_PILOT_KEY)
   * 3. Legacy settings.json (with automatic migration to SecretStorage)
   */
  public async getApiKey(): Promise<string> {
    // 1. Check SecretStorage (most secure)
    const secretKey = await this.secrets.get(SecretManager.RUNWARE_KEY_ID);
    if (secretKey && secretKey.trim()) {
      return secretKey.trim();
    }

    // 2. Check corporate environment variables
    const envKey = process.env.RUNWARE_API_KEY || process.env.PIXEL_PILOT_KEY || process.env.PIXEL_PILOT_ENTERPRISE_KEY;
    if (envKey && envKey.trim()) {
      return envKey.trim();
    }

    // 3. Check legacy settings.json and auto-migrate
    const config = vscode.workspace.getConfiguration('pixelPilot');
    const legacyKey = config.get<string>('apiKey');
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

    return '';
  }

  /**
   * Stores an API Key securely in OS Encrypted Vault
   */
  public async setApiKey(apiKey: string): Promise<void> {
    await this.secrets.store(SecretManager.RUNWARE_KEY_ID, apiKey.trim());
  }

  /**
   * Clears the API Key from SecretStorage
   */
  public async deleteApiKey(): Promise<void> {
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
  private static readonly LLM_PROVIDER_ID = 'pixelPilot.llmProvider';

  /**
   * Retrieves the LLM API Key (Gemini, OpenAI, Groq, etc.)
   */
  public async getLlmApiKey(): Promise<string> {
    const secretKey = await this.secrets.get(SecretManager.LLM_KEY_ID);
    if (secretKey && secretKey.trim()) {
      return secretKey.trim();
    }
    const envKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
    if (envKey && envKey.trim()) {
      return envKey.trim();
    }
    const config = vscode.workspace.getConfiguration('pixelPilot');
    const legacyKey = config.get<string>('llmApiKey');
    if (legacyKey && legacyKey.trim()) {
      await this.setLlmApiKey(legacyKey.trim());
      return legacyKey.trim();
    }
    return '';
  }

  public async setLlmApiKey(apiKey: string): Promise<void> {
    await this.secrets.store(SecretManager.LLM_KEY_ID, apiKey.trim());
  }

  public async deleteLlmApiKey(): Promise<void> {
    await this.secrets.delete(SecretManager.LLM_KEY_ID);
  }

  public async getLlmProvider(): Promise<'gemini' | 'openai' | 'groq' | 'ollama' | 'local'> {
    const prov = await this.secrets.get(SecretManager.LLM_PROVIDER_ID);
    if (prov) return prov as any;
    const config = vscode.workspace.getConfiguration('pixelPilot');
    return (config.get<string>('llmProvider') as any) || 'gemini';
  }

  public async setLlmProvider(provider: string): Promise<void> {
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
