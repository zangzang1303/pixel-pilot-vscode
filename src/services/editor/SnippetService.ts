// SnippetService.ts - Automatically generates and inserts image tags/snippets into active editor
import * as vscode from 'vscode';
import * as path from 'path';
import { ISnippetService, SnippetOptions } from './ISnippetService';
import { ConfigManager, SnippetFormat } from '../security/ConfigManager';
import { WorkspaceFSService } from '../storage/WorkspaceFSService';

export class SnippetService implements ISnippetService {
  private static instance: SnippetService;
  private configManager: ConfigManager;
  private fsService: WorkspaceFSService;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
    this.fsService = WorkspaceFSService.getInstance();
  }

  public static getInstance(): SnippetService {
    if (!SnippetService.instance) {
      SnippetService.instance = new SnippetService();
    }
    return SnippetService.instance;
  }

  /**
   * Generates formatted snippet string for an image path.
   */
  public generateSnippet(options: SnippetOptions): string {
    const format: SnippetFormat = options.format || this.configManager.getSnippetFormat();
    const alt = options.altText || path.basename(options.imagePath, path.extname(options.imagePath));
    const targetEditor = options.targetEditor || vscode.window.activeTextEditor;

    let relativePath = options.imagePath;

    // Calculate relative path if an active document exists
    if (targetEditor && path.isAbsolute(options.imagePath)) {
      const docFolder = path.dirname(targetEditor.document.uri.fsPath);
      relativePath = this.fsService.getRelativePath(docFolder, vscode.Uri.file(options.imagePath));
    } else if (vscode.workspace.workspaceFolders && path.isAbsolute(options.imagePath)) {
      const rootFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
      relativePath = this.fsService.getRelativePath(rootFolder, vscode.Uri.file(options.imagePath));
    }

    switch (format) {
      case 'markdown':
        return `![${alt}](${relativePath})`;
      case 'html':
        return `<img src="${relativePath}" alt="${alt}" />`;
      case 'react-jsx':
        return `<img src="${relativePath}" alt="${alt}" className="w-auto h-auto" />`;
      default:
        return `![${alt}](${relativePath})`;
    }
  }

  /**
   * Inserts the snippet directly at current cursor position in active text editor.
   */
  public async insertIntoActiveEditor(options: SnippetOptions): Promise<boolean> {
    const editor = options.targetEditor || vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Không có file văn bản nào đang mở để chèn snippet ảnh.');
      return false;
    }

    const snippetText = this.generateSnippet({
      ...options,
      targetEditor: editor
    });

    const success = await editor.edit((editBuilder) => {
      const position = editor.selection.active;
      editBuilder.insert(position, snippetText);
    });

    if (success) {
      vscode.window.showInformationMessage(`✅ Đã chèn mã ảnh vào vị trí con trỏ: ${snippetText}`);
    }

    return success;
  }
}
