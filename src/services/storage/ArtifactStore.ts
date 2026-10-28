import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { validateImageBuffer } from '../../utils/imageData';

export interface ArtifactProvenance {
  mode: 'import' | 'basic' | 'model' | 'mock';
  provider?: string;
  modelId?: string;
  modelVersion?: string;
  toolRunId?: string;
}

export interface ArtifactRecord {
  id: string;
  sha256: string;
  kind: 'image' | 'mask' | 'svg';
  mime: string;
  width: number;
  height: number;
  byteSize: number;
  storageKey: string;
  createdAt: number;
  parentArtifactId?: string;
  previewArtifactId?: string;
  provenance: ArtifactProvenance;
}

export interface StoreArtifactOptions {
  kind: 'image' | 'mask' | 'svg';
  parentArtifactId?: string;
  previewArtifactId?: string;
  provenance?: ArtifactProvenance;
}

/**
 * ArtifactStore (B15)
 * Content-addressable, typed, and referenced-checked persistent artifact storage.
 */
export class ArtifactStore {
  private baseDir: string;
  private manifestPath: string;
  private records = new Map<string, ArtifactRecord>();
  private hashIndex = new Map<string, string>(); // sha256 -> id

  constructor(storageRoot: string) {
    this.baseDir = path.resolve(storageRoot, 'artifacts');
    this.manifestPath = path.resolve(this.baseDir, 'manifest.json');
    this.ensureDir();
    this.loadManifest();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private loadManifest(): void {
    if (fs.existsSync(this.manifestPath)) {
      try {
        const raw = fs.readFileSync(this.manifestPath, 'utf8');
        const list: ArtifactRecord[] = JSON.parse(raw);
        for (const item of list) {
          this.records.set(item.id, item);
          this.hashIndex.set(item.sha256, item.id);
        }
      } catch {
        // Corrupted manifest will be quarantined or rebuilt
      }
    }
  }

  private async saveManifest(): Promise<void> {
    const list = Array.from(this.records.values());
    const tempPath = `${this.manifestPath}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(list, null, 2), 'utf8');
    await fs.promises.rename(tempPath, this.manifestPath);
  }

  /**
   * Stores an image or mask buffer into content-addressable storage.
   * Deduplicates by SHA-256 and validates image buffer structure.
   */
  public async store(
    buffer: Buffer,
    mime: string,
    options: StoreArtifactOptions
  ): Promise<ArtifactRecord> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Artifact buffer must be a non-empty Buffer.');
    }

    validateImageBuffer(buffer, mime);

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Deduplication check: if existing artifact has the exact same content
    const existingId = this.hashIndex.get(sha256);
    if (existingId && this.records.has(existingId)) {
      const existing = this.records.get(existingId)!;
      const fullPath = path.resolve(this.baseDir, existing.storageKey);
      if (fs.existsSync(fullPath)) {
        return existing;
      }
    }

    let width = 0;
    let height = 0;
    if (mime !== 'image/svg+xml') {
      try {
        const meta = await sharp(buffer).metadata();
        width = meta.width || 0;
        height = meta.height || 0;
      } catch {
        // Fallback for non-raster formats
      }
    }

    const id = `art_${crypto.randomUUID()}`;
    const ext = mime === 'image/svg+xml' ? 'svg' : mime.replace('image/', '').replace('jpeg', 'jpg');
    const storageKey = `${sha256}.${ext}`;
    const targetPath = path.resolve(this.baseDir, storageKey);

    if (!fs.existsSync(targetPath)) {
      await fs.promises.writeFile(targetPath, buffer);
    }

    const record: ArtifactRecord = {
      id,
      sha256,
      kind: options.kind,
      mime,
      width,
      height,
      byteSize: buffer.length,
      storageKey,
      createdAt: Date.now(),
      parentArtifactId: options.parentArtifactId,
      previewArtifactId: options.previewArtifactId,
      provenance: options.provenance || { mode: 'basic' }
    };

    this.records.set(id, record);
    this.hashIndex.set(sha256, id);
    await this.saveManifest();

    return record;
  }

  /**
   * Retrieves an artifact record and its buffer by ID.
   */
  public async get(id: string): Promise<{ record: ArtifactRecord; buffer: Buffer } | undefined> {
    const record = this.records.get(id);
    if (!record) return undefined;

    const fullPath = path.resolve(this.baseDir, record.storageKey);
    // Path traversal check
    const relative = path.relative(this.baseDir, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path traversal detected.');
    }

    if (!fs.existsSync(fullPath)) return undefined;
    const buffer = await fs.promises.readFile(fullPath);
    return { record, buffer };
  }

  /**
   * Looks up an artifact record by its SHA-256 hash.
   */
  public getByHash(sha256: string): ArtifactRecord | undefined {
    const id = this.hashIndex.get(sha256);
    return id ? this.records.get(id) : undefined;
  }

  /**
   * Returns absolute path on disk for a valid artifact ID.
   */
  public getAbsolutePath(id: string): string | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    return path.resolve(this.baseDir, record.storageKey);
  }

  /**
   * Prunes unreferenced artifacts while strictly preserving all referenced ones.
   */
  public async pruneUnreferenced(
    referencedIds: ReadonlySet<string>
  ): Promise<{ deleted: number; retained: number }> {
    let deleted = 0;
    let retained = 0;

    const toDeleteIds: string[] = [];
    for (const [id, record] of this.records.entries()) {
      if (referencedIds.has(id)) {
        retained++;
        continue;
      }

      // Candidate for deletion
      toDeleteIds.push(id);
      const fullPath = path.resolve(this.baseDir, record.storageKey);
      try {
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
        }
        deleted++;
      } catch {
        // Ignore file lock errors
      }
    }

    for (const id of toDeleteIds) {
      const rec = this.records.get(id);
      if (rec) {
        this.hashIndex.delete(rec.sha256);
        this.records.delete(id);
      }
    }

    if (deleted > 0) {
      await this.saveManifest();
    }

    return { deleted, retained };
  }
}
