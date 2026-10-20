import type { ExerciseImage } from './exercises';

export const MAX_CACHE_BYTES = 30 * 1024 * 1024;
export const MAX_BATCH_IMAGES = 60;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export type CachedImage = { key: string; bytes: number; uri: string };
export interface ImageStore {
  list(): Promise<CachedImage[]>;
  put(image: ExerciseImage, bytes: Uint8Array): Promise<void>;
  remove(key: string): Promise<void>;
}
export type CacheFailure = 'network' | 'limit' | 'storage' | 'invalid';
export class ImageCacheError extends Error {
  constructor(public code: CacheFailure) {
    super(code);
  }
}

/** Only public images. No workspace, auth, AsyncStorage, backup or sync dependencies. */
export class ExerciseImageCache {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private store: ImageStore,
    private download: (image: ExerciseImage) => Promise<Uint8Array>,
  ) {}
  list() {
    return this.store.list();
  }
  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => undefined);
    return result;
  }
  save(images: readonly ExerciseImage[], progress?: (done: number, total: number) => void) {
    return this.exclusive(async () => {
      const unique = [...new Map(images.map((image) => [image.key, image])).values()];
      if (unique.length > MAX_BATCH_IMAGES) throw new ImageCacheError('limit');
      let cached = await this.store.list();
      const expected = new Map(unique.map((image) => [image.key, image.bytes]));
      for (const entry of cached) {
        if (expected.has(entry.key) && entry.bytes !== expected.get(entry.key))
          await this.store.remove(entry.key);
      }
      cached = cached.filter((entry) => !expected.has(entry.key) || entry.bytes === expected.get(entry.key));
      const keys = new Set(cached.map((entry) => entry.key));
      const pending = unique.filter((image) => !keys.has(image.key));
      let used = cached.reduce((sum, entry) => sum + entry.bytes, 0);
      if (
        pending.some((image) => image.bytes <= 0 || image.bytes > MAX_IMAGE_BYTES) ||
        used + pending.reduce((sum, image) => sum + image.bytes, 0) > MAX_CACHE_BYTES
      ) {
        throw new ImageCacheError('limit');
      }
      progress?.(0, pending.length);
      for (let i = 0; i < pending.length; i++) {
        const image = pending[i];
        // Commit one complete verified file at a time; a failed batch remains resumable.
        const bytes = await this.download(image);
        if (bytes.length !== image.bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
          throw new ImageCacheError('invalid');
        }
        if (used + bytes.length > MAX_CACHE_BYTES) throw new ImageCacheError('limit');
        try {
          await this.store.put(image, bytes);
        } catch {
          throw new ImageCacheError('storage');
        }
        used += bytes.length;
        progress?.(i + 1, pending.length);
      }
    });
  }
  remove(keys?: readonly string[]) {
    return this.exclusive(async () => {
      const selected = keys && new Set(keys);
      for (const image of await this.store.list()) {
        if (!selected || selected.has(image.key)) await this.store.remove(image.key);
      }
    });
  }
}
