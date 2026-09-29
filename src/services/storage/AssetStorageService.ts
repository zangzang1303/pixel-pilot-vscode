// AssetStorageService.ts - Enterprise Disk-Backed Binary Asset Cache & Memory Manager
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export class AssetStorageService {
  private cacheDir: string;

  constructor(context: vscode.ExtensionContext) {
    // Prefer extension global storage, fallback to workspace temporary directory
    const baseDir = context.globalStorageUri?.fsPath || path.join(context.extensionPath, '.cache');
    this.cacheDir = path.join(baseDir, 'asset_cache');

    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Persists an image (Data URI or Buffer) directly to disk cache.
   * Returns the absolute file path on disk.
   */
  public async saveToCache(
    dataUriOrBuffer: string | Buffer,
    hintExtension = 'png',
    subKey?: string
  ): Promise<string> {
    this.ensureCacheDir();

    let buffer: Buffer;
    let ext = hintExtension;

    if (typeof dataUriOrBuffer === 'string') {
      if (dataUriOrBuffer.startsWith('data:')) {
        const matches = dataUriOrBuffer.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches) {
          ext = matches[1].replace('+xml', '');
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          // If raw SVG or plain string
          buffer = Buffer.from(dataUriOrBuffer, 'utf-8');
          ext = 'svg';
        }
      } else if (fs.existsSync(dataUriOrBuffer)) {
        // It's already a file path on disk, return as-is
        return dataUriOrBuffer;
      } else {
        buffer = Buffer.from(dataUriOrBuffer, 'utf-8');
      }
    } else {
      buffer = dataUriOrBuffer;
    }

    // Generate deterministic sha256 hash or unique key to avoid duplicate caching
    const hash = subKey || crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    const fileName = `asset_${hash}.${ext}`;
    const targetPath = path.join(this.cacheDir, fileName);

    if (!fs.existsSync(targetPath)) {
      await fs.promises.writeFile(targetPath, buffer);
    }

    return targetPath;
  }

  /**
   * Converts a cached file path to Webview URI for ultra-fast GPU rendering without IPC memory pressure
   */
  public getWebviewUri(filePath: string, webview: vscode.Webview): string {
    if (!filePath) return '';
    if (filePath.startsWith('data:')) return filePath;
    return webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
  }

  /**
   * Reads a cached file as Base64 Data URI if legacy component explicitly requests it
   */
  public async readAsDataUri(filePath: string): Promise<string> {
    if (!filePath || !fs.existsSync(filePath)) return '';
    const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
    const buf = await fs.promises.readFile(filePath);
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  /**
   * Cleans up entire cache directory
   */
  public async clearCache(): Promise<void> {
    if (fs.existsSync(this.cacheDir)) {
      const files = await fs.promises.readdir(this.cacheDir);
      for (const file of files) {
        try {
          await fs.promises.unlink(path.join(this.cacheDir, file));
        } catch {
          // Ignore locks
        }
      }
    }
  }

  /**
   * Gets total size of the cache directory in megabytes
   */
  public getCacheSizeMb(): number {
    if (!fs.existsSync(this.cacheDir)) return 0;
    try {
      const files = fs.readdirSync(this.cacheDir);
      let totalBytes = 0;
      for (const f of files) {
        const stat = fs.statSync(path.join(this.cacheDir, f));
        totalBytes += stat.size;
      }
      return +(totalBytes / (1024 * 1024)).toFixed(2);
    } catch {
      return 0;
    }
  }
}
