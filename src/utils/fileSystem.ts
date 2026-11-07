import * as vscode from 'vscode';
import * as path from 'path';

export interface SavedImageResult {
  uri: vscode.Uri;
  relativePath: string;
  fileName: string;
}

/**
 * Utility functions for Workspace File System interactions and Code Snippet insertions.
 */
export class FileSystemUtils {
  private static readonly pendingWorkspacePaths = new Set<string>();

  private static async reserveUnusedPath(parent: vscode.Uri, preferredName: string, isFile: boolean): Promise<{
    uri: vscode.Uri; name: string; release: () => void;
  }> {
    const parsed = path.parse(preferredName);
    for (let suffix = 0; suffix < 1000; suffix++) {
      const candidate = suffix === 0 ? preferredName
        : isFile ? `${parsed.name}_${suffix}${parsed.ext}` : `${preferredName}_${suffix}`;
      const uri = vscode.Uri.joinPath(parent, candidate);
      const key = uri.toString();
      if (this.pendingWorkspacePaths.has(key)) continue;
      try {
        await vscode.workspace.fs.stat(uri);
        continue;
      } catch (error) {
        if ((error as vscode.FileSystemError).code !== 'FileNotFound') throw error;
      }
      if (this.pendingWorkspacePaths.has(key)) continue;
      this.pendingWorkspacePaths.add(key);
      return { uri, name: candidate, release: () => this.pendingWorkspacePaths.delete(key) };
    }
    throw new Error('No available workspace name for asset export.');
  }

  /**
   * Save an image buffer to the `assets/` directory of the active workspace.
   * Creates the directory if it does not already exist.
   */
  public static async saveImageToWorkspace(
    imageBuffer: Buffer | Uint8Array,
    preferredName?: string
  ): Promise<SavedImageResult> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let assetsDirUri: vscode.Uri;

    if (workspaceFolders && workspaceFolders.length > 0) {
      assetsDirUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'assets');
    } else {
      // Fallback if no workspace is opened
      assetsDirUri = vscode.Uri.file(path.join(process.cwd(), 'assets'));
    }

    // Ensure assets/ directory exists
    try {
      await vscode.workspace.fs.createDirectory(assetsDirUri);
    } catch (err) {
      console.warn('Could not create assets directory or it already exists:', err);
    }

    // Determine filename
    const timestamp = Date.now();
    const cleanName = preferredName
      ? preferredName.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      : `pixel_pilot_${timestamp}.png`;
    const finalFileName =
      cleanName.endsWith('.png') ||
      cleanName.endsWith('.jpg') ||
      cleanName.endsWith('.webp') ||
      cleanName.endsWith('.svg') ||
      cleanName.endsWith('.avif')
        ? cleanName
        : `${cleanName}.png`;

    const reserved = await this.reserveUnusedPath(assetsDirUri, finalFileName, true);
    const data = imageBuffer instanceof Buffer ? new Uint8Array(imageBuffer) : imageBuffer;
    try {
      await vscode.workspace.fs.writeFile(reserved.uri, data);
    } finally {
      reserved.release();
    }

    const relativePath = `./assets/${reserved.name}`;
    return {
      uri: reserved.uri,
      relativePath,
      fileName: reserved.name
    };
  }

  /**
   * Save a complete web/PWA icon set together so exported assets do not end up
   * scattered across the workspace. Uses the VS Code filesystem API, which
   * also works with remote workspaces and virtual file systems.
   */
  public static async saveIconBundle(
    icons: ReadonlyArray<{ size: number; buffer: Buffer | Uint8Array }>,
    bundleName = 'pixel_pilot_icons'
  ): Promise<{ directory: vscode.Uri; relativeDirectory: string; files: string[] }> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const root = workspaceFolder?.uri || vscode.Uri.file(process.cwd());
    const safeName = bundleName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'pixel_pilot_icons';
    const assetsDir = vscode.Uri.joinPath(root, 'assets');
    await vscode.workspace.fs.createDirectory(assetsDir);
    const reserved = await this.reserveUnusedPath(assetsDir, safeName, false);
    const files: string[] = [];
    const attemptedFiles: vscode.Uri[] = [];
    let created = false;
    try {
      await vscode.workspace.fs.createDirectory(reserved.uri);
      created = true;
      for (const icon of icons) {
        const fileName = `icon-${icon.size}x${icon.size}.png`;
        const iconUri = vscode.Uri.joinPath(reserved.uri, fileName);
        attemptedFiles.push(iconUri);
        await vscode.workspace.fs.writeFile(iconUri, new Uint8Array(icon.buffer));
        files.push(fileName);
      }
    } catch (error) {
      if (created) {
        for (const iconUri of attemptedFiles.reverse()) {
          try { await vscode.workspace.fs.delete(iconUri, { useTrash: false }); }
          catch { /* Best-effort cleanup of a partial export. */ }
        }
        try { await vscode.workspace.fs.delete(reserved.uri, { useTrash: false }); }
        catch { /* Preserve the original export error. */ }
      }
      throw error;
    } finally {
      reserved.release();
    }

    return {
      directory: reserved.uri,
      relativeDirectory: `./assets/${reserved.name}`,
      files
    };
  }

  /**
   * Automatically insert an image snippet into the active editor at the current cursor position.
   * Markdown -> ![alt_text](./assets/filename.png)
   * HTML/TSX/JSX -> <img src="./assets/filename.png" />
   */
  public static async autoInsertImageSnippet(
    relativePath: string,
    altText: string = 'Pixel Pilot AI Image'
  ): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return false;
    }

    const doc = editor.document;
    const ext = path.extname(doc.uri.fsPath).toLowerCase();
    const langId = doc.languageId.toLowerCase();

    let snippet = '';

    if (langId === 'markdown' || ext === '.md' || ext === '.markdown' || ext === '.mdown') {
      snippet = `![${altText}](${relativePath})`;
    } else if (
      langId === 'html' ||
      langId === 'javascriptreact' ||
      langId === 'typescriptreact' ||
      ['.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte'].includes(ext)
    ) {
      snippet = `<img src="${relativePath}" alt="${altText}" />`;
    } else if (langId === 'css' || langId === 'scss' || langId === 'less') {
      snippet = `url('${relativePath}')`;
    } else {
      // Default to markdown or commented path
      snippet = `![${altText}](${relativePath})`;
    }

    const position = editor.selection.active;
    const success = await editor.edit((editBuilder) => {
      editBuilder.insert(position, snippet);
    });

    if (success) {
      vscode.window.showInformationMessage(`Inserted image snippet: ${snippet}`);
    }

    return success;
  }

  /**
   * Delete an exported image or file from the workspace if a downstream commit fails.
   */
  public static async deleteWorkspaceFile(uriOrRelativePath: vscode.Uri | string): Promise<boolean> {
    try {
      let fileUri: vscode.Uri;
      if (typeof uriOrRelativePath === 'string') {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, uriOrRelativePath.replace(/^\.\//, ''));
        } else {
          fileUri = vscode.Uri.file(path.resolve(process.cwd(), uriOrRelativePath));
        }
      } else {
        fileUri = uriOrRelativePath;
      }
      await vscode.workspace.fs.delete(fileUri, { useTrash: false });
      return true;
    } catch {
      return false;
    }
  }
}
