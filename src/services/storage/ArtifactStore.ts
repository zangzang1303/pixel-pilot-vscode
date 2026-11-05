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
  private manifestWrite: Promise<void> = Promise.resolve();

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
        this.loadManifestFile(this.manifestPath);
        return;
      } catch {
        const quarantinePath = `${this.manifestPath}.corrupt-${Date.now()}`;
        try { fs.renameSync(this.manifestPath, quarantinePath); } catch { /* Keep the original if quarantine is blocked. */ }
      }
    }

    const backupPath = `${this.manifestPath}.bak`;
    if (fs.existsSync(backupPath)) {
      try {
        this.loadManifestFile(backupPath);
        return;
      } catch {
        try { fs.renameSync(backupPath, `${backupPath}.corrupt-${Date.now()}`); } catch { /* Keep the backup if quarantine is blocked. */ }
      }
    }
  }

  private loadManifestFile(filePath: string): void {
    const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(raw)) throw new Error('Artifact manifest must be an array.');
    const records = raw as ArtifactRecord[];
    const seenIds = new Set<string>();
    const seenHashes = new Set<string>();
    for (const item of records) {
      if (!item || typeof item.id !== 'string' || !item.id.startsWith('art_') ||
          typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256) ||
          typeof item.storageKey !== 'string' || path.basename(item.storageKey) !== item.storageKey ||
          !['image', 'mask', 'svg'].includes(item.kind) || typeof item.mime !== 'string' ||
          !Number.isFinite(item.byteSize) || item.byteSize < 1 || !Number.isFinite(item.createdAt) ||
          !item.provenance || typeof item.provenance !== 'object' || seenIds.has(item.id) || seenHashes.has(item.sha256)) {
        throw new Error('Artifact manifest contains an invalid record.');
      }
      seenIds.add(item.id);
      seenHashes.add(item.sha256);
    }
    this.records.clear();
    this.hashIndex.clear();
    for (const item of records) {
      this.records.set(item.id, item);
      this.hashIndex.set(item.sha256, item.id);
    }
  }

  private async saveManifest(): Promise<void> {
    const write = this.manifestWrite.then(async () => {
      const list = Array.from(this.records.values());
      const json = JSON.stringify(list, null, 2);
      const backupPath = `${this.manifestPath}.bak`;
      const backupTemp = `${backupPath}.${crypto.randomUUID()}.tmp`;
      const manifestTemp = `${this.manifestPath}.${crypto.randomUUID()}.tmp`;
      try {
        if (fs.existsSync(this.manifestPath)) {
          await fs.promises.copyFile(this.manifestPath, backupTemp);
          await fs.promises.rename(backupTemp, backupPath);
        }
        await fs.promises.writeFile(manifestTemp, json, { encoding: 'utf8', flag: 'wx' });
        await fs.promises.rename(manifestTemp, this.manifestPath);
      } catch (error) {
        await Promise.all([backupTemp, manifestTemp].map(async file => {
          try { await fs.promises.unlink(file); } catch { /* No temporary file remains. */ }
        }));
        throw error;
      }
    });
    this.manifestWrite = write.catch(() => undefined);
    return write;
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

    const protectedIds = new Set(referencedIds);
    const pending = [...protectedIds];
    while (pending.length) {
      const id = pending.pop()!;
      const record = this.records.get(id);
      for (const relatedId of [record?.parentArtifactId, record?.previewArtifactId]) {
        if (relatedId && !protectedIds.has(relatedId)) {
          protectedIds.add(relatedId);
          pending.push(relatedId);
        }
      }
    }

    let changed = false;
    for (const [id, record] of [...this.records.entries()]) {
      if (protectedIds.has(id)) {
        retained++;
        continue;
      }

      const fullPath = path.resolve(this.baseDir, record.storageKey);
      const relative = path.relative(this.baseDir, fullPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        retained++;
        continue;
      }
      try {
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
        }
        this.hashIndex.delete(record.sha256);
        this.records.delete(id);
        deleted++;
        changed = true;
      } catch {
        retained++;
      }
    }

    if (changed) {
      await this.saveManifest();
    }

    return { deleted, retained };
  }

  /** Prunes by persisted paths so session DAG references remain authoritative. */
  public async pruneUnreferencedPaths(
    referencedPaths: ReadonlySet<string>
  ): Promise<{ deleted: number; retained: number }> {
    const normalizedPaths = new Set(Array.from(referencedPaths, value => path.resolve(value)));
    const referencedIds = new Set<string>();
    for (const [id, record] of this.records) {
      const fullPath = path.resolve(this.baseDir, record.storageKey);
      if (normalizedPaths.has(fullPath)) referencedIds.add(id);
    }
    return this.pruneUnreferenced(referencedIds);
  }
}
