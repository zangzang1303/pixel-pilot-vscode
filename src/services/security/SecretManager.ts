// SecretManager.ts - Enterprise-grade Secret Management using vscode.SecretStorage
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SecretManager {
  private static instance?: SecretManager;
  private static readonly RUNWARE_KEY_ID = 'pixelPilot.runwareApiKey';
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

  /**
   * Helper to parse workspace .env file directly (handles spaces around =, quotes, etc.)
   */
  private readLocalEnvFile(): Record<string, string> {
    const envVars: Record<string, string> = {};
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const candidates = [
      'd:/CODE/DAKH/pixel-pilot-vscode/.env',
      'd:\\CODE\\DAKH\\pixel-pilot-vscode\\.env',
      workspaceRoot ? path.join(workspaceRoot, '.env') : '',
      workspaceRoot ? path.join(workspaceRoot, 'pixel-pilot-vscode', '.env') : '',
      'd:/CODE/DAKH/.env',
      path.resolve('.env'),
      path.resolve(process.cwd(), '.env'),
      path.resolve(__dirname, '../../../../.env'),
      path.resolve(__dirname, '../../../.env')
    ].filter(Boolean);

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          const content = fs.readFileSync(cand, 'utf-8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const k = trimmed.substring(0, eqIdx).trim();
              let v = trimmed.substring(eqIdx + 1).trim();
              if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                v = v.slice(1, -1).trim();
              }
              if (k && v && !envVars[k]) {
                envVars[k] = v;
              }
            }
          }
        } catch (e) {
          console.warn('[SecretManager] Error reading .env file:', e);
        }
      }
    }
    return envVars;
  }

  /**
   * Retrieves the Runware API Key with enterprise precedence:
   * 1. Local workspace .env file (RUNWARE_API_KEY)
   * 2. OS-level Encrypted SecretStorage
   * 3. Environment variable (RUNWARE_API_KEY / PIXEL_PILOT_KEY)
   * 4. Legacy settings.json
   */
  public async getApiKey(): Promise<string> {
    // 1. Check local workspace .env file
    const envFileVars = this.readLocalEnvFile();
    if (
      envFileVars.RUNWARE_API_KEY &&
      envFileVars.RUNWARE_API_KEY.trim() &&
      envFileVars.RUNWARE_API_KEY.trim() !== 'YOUR_RUNWARE_API_KEY'
    ) {
      return envFileVars.RUNWARE_API_KEY.trim();
    }

    // 2. Check SecretStorage (most secure)
    const secretKey = await this.secrets.get(SecretManager.RUNWARE_KEY_ID);
    if (secretKey && secretKey.trim()) {
      return secretKey.trim();
    }

    // 3. Check corporate environment variables
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
    const envFileVars = this.readLocalEnvFile();
    if (envFileVars.GEMINI_API_KEY && envFileVars.GEMINI_API_KEY.trim()) {
      return envFileVars.GEMINI_API_KEY.trim();
    }
    if (envFileVars.OPENAI_API_KEY && envFileVars.OPENAI_API_KEY.trim()) {
      return envFileVars.OPENAI_API_KEY.trim();
    }
    if (envFileVars.GROQ_API_KEY && envFileVars.GROQ_API_KEY.trim()) {
      return envFileVars.GROQ_API_KEY.trim();
    }
    if (envFileVars.LLM_API_KEY && envFileVars.LLM_API_KEY.trim()) {
      return envFileVars.LLM_API_KEY.trim();
    }
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

  public async getLlmProvider(): Promise<'gemini' | 'openai' | 'groq' | 'openrouter' | 'ollama' | 'local'> {
    const prov = await this.secrets.get(SecretManager.LLM_PROVIDER_ID);
    if (prov) return prov as any;
    const envFileVars = this.readLocalEnvFile();
    if (envFileVars.LLM_PROVIDER) return envFileVars.LLM_PROVIDER as any;
    if (envFileVars.GEMINI_API_KEY) return 'gemini';
    if (envFileVars.GROQ_API_KEY) return 'groq';
    if (envFileVars.OPENAI_API_KEY) return 'openai';
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
