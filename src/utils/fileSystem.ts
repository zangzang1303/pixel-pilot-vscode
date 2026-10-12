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

    const fileUri = vscode.Uri.joinPath(assetsDirUri, finalFileName);
    const data = imageBuffer instanceof Buffer ? new Uint8Array(imageBuffer) : imageBuffer;

    await vscode.workspace.fs.writeFile(fileUri, data);

    const relativePath = `./assets/${finalFileName}`;
    return {
      uri: fileUri,
      relativePath,
      fileName: finalFileName
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
}
