// AssetStorageService.ts - Enterprise Disk-Backed Binary Asset Cache & Memory Manager
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { decodeImageInput, imageMimeType, validateImageBuffer } from '../../utils/imageData';

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

  /** Only files stored by this service may be rehydrated into a webview. */
  public isStoredArtifact(filePath: string): boolean {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return false;
    try {
      const cacheRoot = fs.realpathSync(this.cacheDir);
      const resolved = fs.realpathSync(filePath);
      const relative = path.relative(cacheRoot, resolved);
      return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative) && fs.statSync(resolved).isFile();
    } catch {
      return false;
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
    let ext = hintExtension.toLowerCase().replace(/^\./, '');

    if (typeof dataUriOrBuffer === 'string') {
      const decoded = decodeImageInput(dataUriOrBuffer);
      buffer = decoded.buffer;
      ext = decoded.extension;
    } else {
      buffer = dataUriOrBuffer;
      if (!['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'svg'].includes(ext)) {
        throw new Error('Unsupported artifact format.');
      }
      validateImageBuffer(buffer, imageMimeType(ext));
    }

    // Generate deterministic sha256 hash or unique key to avoid duplicate caching
    if (subKey && !/^[A-Za-z0-9_-]{1,64}$/.test(subKey)) throw new Error('Invalid artifact key.');
    const hash = subKey || crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    const fileName = `asset_${hash}.${ext}`;
    const targetPath = path.join(this.cacheDir, fileName);

    if (!fs.existsSync(targetPath)) {
      await fs.promises.writeFile(targetPath, buffer);
    }

    return targetPath;
  }

  /**
   * Converts a cached file path to Webview URI.
   * Reads local files as Data URI so they are 100% guaranteed to render inside Webview without sandbox or 403 blocks.
   */
  public getWebviewUri(filePath: string, webview?: vscode.Webview): string {
    if (typeof filePath !== 'string' || !filePath) return '';
    if (filePath.startsWith('data:')) {
      try { decodeImageInput(filePath); return filePath; } catch { return ''; }
    }
    if (this.isStoredArtifact(filePath)) {
      try {
        const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
        const buf = fs.readFileSync(filePath);
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch (e) {
        if (webview) {
          return webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
        }
      }
    }
    return '';
  }

  /**
   * Reads a cached file as Base64 Data URI if legacy component explicitly requests it
   */
  public async readAsDataUri(filePath: string): Promise<string> {
    if (!this.isStoredArtifact(filePath)) return '';
    const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
    const buf = await fs.promises.readFile(filePath);
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  /** Removes disposable cache files without deleting artifacts referenced by history. */
  public async clearCache(referencedArtifacts: ReadonlySet<string> = new Set()): Promise<{ removed: number; retained: number }> {
    let removed = 0;
    let retained = 0;
    if (fs.existsSync(this.cacheDir)) {
      const files = await fs.promises.readdir(this.cacheDir);
      for (const file of files) {
        const target = path.resolve(this.cacheDir, file);
        if (referencedArtifacts.has(target)) {
          retained++;
          continue;
        }
        try {
          await fs.promises.unlink(target);
          removed++;
        } catch {
          // Ignore locks
        }
      }
    }
    return { removed, retained };
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
