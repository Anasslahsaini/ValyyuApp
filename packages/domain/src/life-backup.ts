import { z } from 'zod';
import { validateRestorableLife, type LifeState } from './life';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
// Kept below the existing wardrobe imageUri limit, including the data URL header.
export const MAX_PHOTO_BYTES = 1400000;
const Envelope = z
  .object({
    // 'vayylo-workspace' = backups exported before the rename to Valyyu.
    format: z.enum(['valyyu-workspace', 'vayylo-workspace']),
    version: z.literal(2),
    exportedAt: z.string().datetime(),
    photosIncluded: z.boolean(),
    workspace: z.unknown(),
  })
  .strict();
const LegacyEnvelope = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    photoNotice: z.string().max(1000),
    workspace: z.unknown(),
  })
  .strict();
export type WorkspaceBackup = {
  format: 'valyyu-workspace';
  version: 2;
  exportedAt: string;
  photosIncluded: boolean;
  workspace: LifeState;
};
export type BackupPreview = WorkspaceBackup & { legacy: boolean; byteSize: number };

export function assertBackupSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 1 || bytes > MAX_BACKUP_BYTES)
    throw new Error('Backup must be between 1 byte and 20 MB.');
}
export function utf8Size(text: string) {
  // TextEncoder is not available on every native Hermes version.
  let size = 0;
  for (const character of text) {
    const point = character.codePointAt(0)!;
    size += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return size;
}

/** Only bounded, canonical raster data URLs; never executable SVG or external/local paths. */
export function validateBackupPhoto(uri: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);
  if (!match || match[2].length % 4 !== 0) throw new Error('Invalid backup photo.');
  const [, type, base64] = match;
  const size = (base64.length / 4) * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  if (size < 12 || size > MAX_PHOTO_BYTES) throw new Error('Photo exceeds the 1.4 MB limit or is invalid.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  // Signature check does not decode the whole image into another large allocation.
  for (let index = 0; index < 16; index += 4) {
    const bits =
      (alphabet.indexOf(base64[index]) << 18) |
      (alphabet.indexOf(base64[index + 1]) << 12) |
      (alphabet.indexOf(base64[index + 2]) << 6) |
      alphabet.indexOf(base64[index + 3]);
    bytes.push((bits >> 16) & 255, (bits >> 8) & 255, bits & 255);
  }
  const starts = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const valid =
    type === 'jpeg'
      ? starts([255, 216, 255])
      : type === 'png'
        ? starts([137, 80, 78, 71, 13, 10, 26, 10])
        : starts([82, 73, 70, 70]) && bytes.slice(8, 12).join(',') === '87,69,66,80';
  const last = base64.endsWith('==')
    ? base64[base64.length - 3]
    : base64.endsWith('=')
      ? base64[base64.length - 2]
      : null;
  if (!valid || (last && (alphabet.indexOf(last) & (base64.endsWith('==') ? 15 : 3)) !== 0))
    throw new Error('Invalid photo encoding.');
  return { type, base64, size };
}

export function parseWorkspaceBackup(contents: string): BackupPreview {
  if (contents.length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 20 MB.');
  const byteSize = utf8Size(contents);
  assertBackupSize(byteSize);
  const raw: unknown = JSON.parse(contents.replace(/^\uFEFF/, ''));
  const legacy = typeof raw === 'object' && raw !== null && 'version' in raw && raw.version === 1;
  const envelope = legacy ? LegacyEnvelope.parse(raw) : Envelope.parse(raw);
  const workspace = validateRestorableLife(envelope.workspace);
  const photosIncluded = !legacy && 'photosIncluded' in envelope && envelope.photosIncluded;
  for (const item of workspace.wardrobe) {
    if (item.imageUri !== undefined) {
      if (!photosIncluded) throw new Error('Unexpected photo in a photo-free backup.');
      validateBackupPhoto(item.imageUri);
    }
  }
  return {
    format: 'valyyu-workspace',
    version: 2,
    exportedAt: envelope.exportedAt,
    photosIncluded,
    workspace,
    legacy,
    byteSize,
  };
}

export async function serializeWorkspaceBackup(
  input: LifeState,
  includePhotos: boolean,
  readPhoto: (uri: string) => Promise<string>,
): Promise<string> {
  const workspace = validateRestorableLife(input);
  let bytes = utf8Size(
    JSON.stringify({
      ...workspace,
      wardrobe: workspace.wardrobe.map(({ imageUri: _photo, ...item }) => item),
    }),
  );
  const wardrobe = [];
  for (const item of workspace.wardrobe) {
    const { imageUri, ...rest } = item;
    if (includePhotos && imageUri) {
      const portable = await readPhoto(imageUri);
      validateBackupPhoto(portable);
      bytes += portable.length;
      assertBackupSize(bytes);
      wardrobe.push({ ...rest, imageUri: portable });
    } else wardrobe.push(rest);
  }
  const backup: WorkspaceBackup = {
    format: 'valyyu-workspace',
    version: 2,
    exportedAt: new Date().toISOString(),
    photosIncluded: includePhotos,
    workspace: { ...workspace, wardrobe },
  };
  const contents = JSON.stringify(backup);
  assertBackupSize(utf8Size(contents));
  return contents;
}

/** Stage all photos before the one storage commit. On failure only staged copies are deleted. */
export async function restorePortableWorkspace(
  input: LifeState,
  retain: (dataUrl: string) => Promise<string>,
  discard: (uri: string) => void,
  persist: (state: LifeState) => Promise<void>,
): Promise<LifeState> {
  const portable = validateRestorableLife(input);
  portable.wardrobe.forEach((item) => {
    if (item.imageUri !== undefined) validateBackupPhoto(item.imageUri);
  });
  const staged: string[] = [];
  try {
    const wardrobe = [];
    for (const item of portable.wardrobe) {
      if (item.imageUri) {
        const imageUri = await retain(item.imageUri);
        staged.push(imageUri);
        wardrobe.push({ ...item, imageUri });
      } else wardrobe.push(item);
    }
    const next = validateRestorableLife({ ...portable, wardrobe });
    await persist(next);
    return next;
  } catch (error) {
    staged.forEach(discard);
    throw error;
  }
}
