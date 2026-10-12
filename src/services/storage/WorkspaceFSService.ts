// WorkspaceFSService.ts - Safe file and workspace operations using vscode.workspace.fs
import * as vscode from 'vscode';
import * as path from 'path';

export class WorkspaceFSService {
  private static instance: WorkspaceFSService;

  private constructor() {}

  public static getInstance(): WorkspaceFSService {
    if (!WorkspaceFSService.instance) {
      WorkspaceFSService.instance = new WorkspaceFSService();
    }
    return WorkspaceFSService.instance;
  }

  /**
   * Reads a file buffer from a vscode.Uri.
   */
  public async readFile(uri: vscode.Uri): Promise<Buffer> {
    const uint8Array = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(uint8Array);
  }

  /**
   * Writes a Buffer or Uint8Array to a vscode.Uri, creating parent directories if needed.
   */
  public async writeFile(uri: vscode.Uri, data: Buffer | Uint8Array): Promise<void> {
    const parentDir = vscode.Uri.file(path.dirname(uri.fsPath));
    await this.ensureDirectoryExists(parentDir);
    await vscode.workspace.fs.writeFile(uri, data);
  }

  /**
   * Checks if a file or directory exists at the given URI.
   */
  public async exists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates directory recursively if it does not already exist.
   */
  public async ensureDirectoryExists(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(uri);
    } catch {
      // Already exists or handled
    }
  }

  /**
   * Generates a non-conflicting output file URI with a specified suffix and extension.
   * e.g. "image.png" -> "image_nobg.png" or "image_nobg_1.png"
   */
  public async getAvailableFileUri(originalUri: vscode.Uri, suffix: string, newExtension?: string): Promise<vscode.Uri> {
    const dir = path.dirname(originalUri.fsPath);
    const originalExt = path.extname(originalUri.fsPath);
    const ext = newExtension ? (newExtension.startsWith('.') ? newExtension : `.${newExtension}`) : originalExt;
    const baseName = path.basename(originalUri.fsPath, originalExt);

    let candidateName = `${baseName}_${suffix}${ext}`;
    let candidateUri = vscode.Uri.file(path.join(dir, candidateName));
    let counter = 1;

    while (await this.exists(candidateUri)) {
      candidateName = `${baseName}_${suffix}_${counter}${ext}`;
      candidateUri = vscode.Uri.file(path.join(dir, candidateName));
      counter++;
    }

    return candidateUri;
  }

  /**
   * Computes the relative path from a reference file/folder to the target image file.
   */
  public getRelativePath(fromUriOrPath: vscode.Uri | string, targetUri: vscode.Uri): string {
    const fromPath = typeof fromUriOrPath === 'string' 
      ? fromUriOrPath 
      : (path.extname(fromUriOrPath.fsPath) ? path.dirname(fromUriOrPath.fsPath) : fromUriOrPath.fsPath);
    
    let relPath = path.relative(fromPath, targetUri.fsPath).replace(/\\/g, '/');
    if (!relPath.startsWith('.') && !relPath.startsWith('/')) {
      relPath = `./${relPath}`;
    }
    return relPath;
  }
}
