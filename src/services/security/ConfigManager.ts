// ConfigManager.ts - Type-safe configuration management using vscode.workspace.getConfiguration
import * as vscode from 'vscode';
import { CONFIG_SECTION, CONFIG_KEYS } from '../../constants';

export type CompressionFormat = 'webp' | 'avif' | 'png' | 'jpeg';
export type SnippetFormat = 'markdown' | 'html' | 'react-jsx';
export type CodeFramework = 'react-tailwind' | 'html-tailwind' | 'vue' | 'svelte';
export type AIProviderType = 'runware' | 'openai' | 'gemini' | 'huggingface' | 'local';

export class ConfigManager {
  private static instance: ConfigManager;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(CONFIG_SECTION);
  }

  public getAIProvider(): AIProviderType {
    return this.getConfig().get<AIProviderType>(CONFIG_KEYS.AI_PROVIDER, 'runware');
  }

  public getDefaultModel(): string {
    return this.getConfig().get<string>(CONFIG_KEYS.DEFAULT_MODEL, 'birefnet-v2');
  }

  public getDefaultDimension(): string {
    return this.getConfig().get<string>(CONFIG_KEYS.DEFAULT_DIMENSION, '1024x1024');
  }

  public getCompressionFormat(): CompressionFormat {
    return this.getConfig().get<CompressionFormat>(CONFIG_KEYS.COMPRESSION_FORMAT, 'webp');
  }

  public getCompressionQuality(): number {
    return this.getConfig().get<number>(CONFIG_KEYS.COMPRESSION_QUALITY, 85);
  }

  public getSnippetFormat(): SnippetFormat {
    return this.getConfig().get<SnippetFormat>(CONFIG_KEYS.SNIPPET_FORMAT, 'markdown');
  }

  public getImageToCodeFramework(): CodeFramework {
    return this.getConfig().get<CodeFramework>(CONFIG_KEYS.IMAGE_TO_CODE_FRAMEWORK, 'react-tailwind');
  }

  public isAutoSaveEnabled(): boolean {
    return this.getConfig().get<boolean>(CONFIG_KEYS.AUTO_SAVE, true);
  }

  public isOfflineMode(): boolean {
    return this.getConfig().get<boolean>(CONFIG_KEYS.OFFLINE_MODE, false);
  }

  public async updateConfig<T>(key: string, value: T, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    await this.getConfig().update(key, value, target);
  }
}
