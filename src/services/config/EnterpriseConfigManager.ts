// EnterpriseConfigManager.ts - Enterprise Workspace Configuration & Design System Rules (.pixelpilotrc.json)
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface EnterpriseConfig {
  version: string;
  designSystem?: {
    iconSizes?: number[];
    defaultFormat?: 'png' | 'webp' | 'svg' | 'jpg';
    webpQuality?: number;
    maxDimension?: number;
    namingConvention?: 'kebab-case' | 'snake_case' | 'camelCase';
    autoCleanSvg?: boolean;
  };
  enterpriseApi?: {
    customEndpoint?: string;
    timeoutMs?: number;
    zeroDataRetention?: boolean;
  };
  auditLogging?: {
    enabled?: boolean;
    logFileName?: string;
  };
}

export class EnterpriseConfigManager {
  private static readonly CONFIG_FILE_NAME = '.pixelpilotrc.json';
  private workspaceRoot?: string;
  private currentConfig: EnterpriseConfig;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot;
    this.currentConfig = this.loadConfig();
  }

  public setWorkspaceRoot(root?: string): void {
    this.workspaceRoot = root;
    this.currentConfig = this.loadConfig();
  }

  public getConfig(): EnterpriseConfig {
    return this.currentConfig;
  }

  /**
   * Loads .pixelpilotrc.json from workspace root if it exists, otherwise provides enterprise defaults
   */
  public loadConfig(): EnterpriseConfig {
    const defaults: EnterpriseConfig = {
      version: '1.0',
      designSystem: {
        iconSizes: [16, 24, 32, 48, 64],
        defaultFormat: 'png',
        webpQuality: 85,
        maxDimension: 2048,
        namingConvention: 'kebab-case',
        autoCleanSvg: true
      },
      enterpriseApi: {
        zeroDataRetention: true,
        timeoutMs: 60000
      },
      auditLogging: {
        enabled: true,
        logFileName: '.pixelpilot_audit.log'
      }
    };

    if (!this.workspaceRoot) return defaults;

    const configPath = path.join(this.workspaceRoot, EnterpriseConfigManager.CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...defaults,
          ...parsed,
          designSystem: { ...defaults.designSystem, ...parsed.designSystem },
          enterpriseApi: { ...defaults.enterpriseApi, ...parsed.enterpriseApi },
          auditLogging: { ...defaults.auditLogging, ...parsed.auditLogging }
        };
      } catch (e) {
        console.warn('Không thể đọc .pixelpilotrc.json, dùng cấu hình mặc định:', e);
      }
    }

    return defaults;
  }

  /**
   * Creates a sample .pixelpilotrc.json in workspace root if not present
   */
  public async initConfigFile(): Promise<string | null> {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('Vui lòng mở một Workspace hoặc Folder trong VS Code trước khi khởi tạo cấu hình!');
      return null;
    }

    const configPath = path.join(this.workspaceRoot, EnterpriseConfigManager.CONFIG_FILE_NAME);
    if (fs.existsSync(configPath)) {
      vscode.window.showInformationMessage(`Tập tin ${EnterpriseConfigManager.CONFIG_FILE_NAME} đã tồn tại trong workspace!`);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
      await vscode.window.showTextDocument(doc);
      return configPath;
    }

    const sampleConfig: EnterpriseConfig = {
      version: '1.0',
      designSystem: {
        iconSizes: [16, 24, 32, 48, 64],
        defaultFormat: 'webp',
        webpQuality: 85,
        maxDimension: 2048,
        namingConvention: 'kebab-case',
        autoCleanSvg: true
      },
      enterpriseApi: {
        customEndpoint: '',
        timeoutMs: 60000,
        zeroDataRetention: true
      },
      auditLogging: {
        enabled: true,
        logFileName: '.pixelpilot_audit.log'
      }
    };

    await fs.promises.writeFile(configPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');
    vscode.window.showInformationMessage(`✨ Đã khởi tạo cấu hình chuẩn doanh nghiệp: ${EnterpriseConfigManager.CONFIG_FILE_NAME}`);
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
    await vscode.window.showTextDocument(doc);
    return configPath;
  }
}
