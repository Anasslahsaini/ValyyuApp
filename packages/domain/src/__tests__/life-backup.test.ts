/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLifeState, upsertRecord } from '../life';
import {
  assertBackupSize,
  MAX_BACKUP_BYTES,
  parseWorkspaceBackup,
  restorePortableWorkspace,
  serializeWorkspaceBackup,
  validateBackupPhoto,
} from '../life-backup';

// Real encoded PNG bytes, not a URI to a file on the exporting device.
const photo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE9sAAAAASUVORK5CYII=';
function workspace() {
  let state = upsertRecord(newLifeState(), 'wardrobe', {
    id: 'shirt',
    name: 'Chemise',
    category: 'top',
    color: 'bleu',
    imageUri: photo,
  });
  state = upsertRecord(state, 'outfits', {
    id: 'outfit',
    name: 'Lundi',
    itemIds: ['shirt'],
    date: '2026-10-14',
    notes: 'Réunion',
  });
  state = upsertRecord(state, 'groceries', {
    id: 'rice',
    name: 'Riz',
    quantity: '1 kg',
    estimatedCost: 3,
    checked: true,
  });
  state.settings.weeklyBudget = 100;
  return state;
}
test('Portable round trip preserves image bytes, IDs, outfit links, settings and all collections', async () => {
  const original = workspace();
  const contents = await serializeWorkspaceBackup(original, true, async (uri) => uri);
  const backup = parseWorkspaceBackup(contents);
  let saved;
  const restored = await restorePortableWorkspace(
    backup.workspace,
    async (uri) => uri,
    () => assert.fail('Unexpected cleanup'),
    async (state) => {
      saved = state;
    },
  );
  assert.deepEqual(restored, original);
  assert.deepEqual(saved, original);
  assert.deepEqual(original.wardrobe[0].imageUri, photo);
});
test('Native media is read for export and relocated for restore without changing references', async () => {
  const original = workspace();
  original.wardrobe[0].imageUri = 'file:///old-device/shirt.jpg';
  const contents = await serializeWorkspaceBackup(original, true, async (uri) => {
    assert.equal(uri, 'file:///old-device/shirt.jpg');
    return photo;
  });
  const restored = await restorePortableWorkspace(
    parseWorkspaceBackup(contents).workspace,
    async (uri) => {
      assert.equal(uri, photo);
      return 'file:///new-device/valyyu-wardrobe/copied.png';
    },
    () => assert.fail('Unexpected cleanup'),
    async () => {},
  );
  assert.equal(restored.wardrobe[0].imageUri, 'file:///new-device/valyyu-wardrobe/copied.png');
  assert.deepEqual(restored.outfits, original.outfits);
});
test('Optional photo-free exports keep clothing and outfit references, never mutate original', async () => {
  const original = workspace();
  const contents = await serializeWorkspaceBackup(original, false, async () =>
    assert.fail('Photo should not be read'),
  );
  const backup = parseWorkspaceBackup(contents);
  assert.equal(backup.photosIncluded, false);
  assert.equal(backup.workspace.wardrobe[0].imageUri, undefined);
  assert.equal(original.wardrobe[0].imageUri, photo);
  assert.deepEqual(backup.workspace.outfits, original.outfits);
});
test('Invalid JSON, version, unknown fields, duplicates and dangling references are rejected', async () => {
  const valid = JSON.parse(await serializeWorkspaceBackup(workspace(), true, async (uri) => uri));
  for (const change of [
    (v: any) => {
      v.version = 99;
    },
    (v: any) => {
      v.workspace.wardrobe.push(v.workspace.wardrobe[0]);
    },
    (v: any) => {
      v.workspace.outfits[0].itemIds = ['missing'];
    },
    (v: any) => {
      v.workspace.settings.currency = '';
    },
    (v: any) => {
      v.workspace.wardrobe[0].extra = 'unknown';
    },
    (v: any) => {
      v.workspace.wardrobe[0].imageUri = 'file:///other-device.jpg';
    },
    (v: any) => {
      v.workspace.wardrobe[0].imageUri = 'https://example.com/photo.jpg';
    },
    (v: any) => {
      v.workspace.wardrobe[0].imageUri = '';
    },
    (v: any) => {
      v.photosIncluded = false;
    },
  ]) {
    const invalid = structuredClone(valid);
    change(invalid);
    assert.throws(() => parseWorkspaceBackup(JSON.stringify(invalid)));
  }
  assert.throws(() => parseWorkspaceBackup('{not json'));
});
test('Size caps and unsafe or mismatched photo encodings are rejected', () => {
  assert.throws(() => assertBackupSize(MAX_BACKUP_BYTES + 1));
  assert.throws(() => parseWorkspaceBackup(' '.repeat(MAX_BACKUP_BYTES + 1)));
  assert.throws(() => validateBackupPhoto(photo.replace('image/png', 'image/jpeg')));
  assert.throws(() => validateBackupPhoto('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='));
  assert.throws(() => validateBackupPhoto('data:image/png;base64,%%%%'));
  assert.throws(() => validateBackupPhoto(`data:image/png;base64,${'A'.repeat(1900000)}`));
});
test('Photo staging failure never writes and deletes only new copies', async () => {
  const input = workspace();
  input.wardrobe.push({ ...input.wardrobe[0], id: 'second' });
  const deleted: string[] = [];
  let copies = 0;
  await assert.rejects(
    restorePortableWorkspace(
      input,
      async () => {
        if (++copies === 2) throw new Error('Disk full');
        return 'file:///staged-copy.png';
      },
      (uri) => deleted.push(uri),
      async () => assert.fail('Must not commit'),
    ),
  );
  assert.deepEqual(deleted, ['file:///staged-copy.png']);
  assert.equal(input.wardrobe[0].imageUri, photo);
});
test('Persistence failure removes staged copies and leaves existing persisted state untouched', async () => {
  const previous = workspace();
  const stored = JSON.stringify(previous);
  const deleted: string[] = [];
  await assert.rejects(
    restorePortableWorkspace(
      workspace(),
      async () => 'file:///new-copy.png',
      (uri) => deleted.push(uri),
      async () => {
        throw new Error('Storage quota');
      },
    ),
  );
  assert.deepEqual(deleted, ['file:///new-copy.png']);
  assert.equal(JSON.stringify(previous), stored);
});
test('Old version-one exports restore without inventing photos', () => {
  const input = workspace();
  delete input.wardrobe[0].imageUri;
  const preview = parseWorkspaceBackup(
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      photoNotice: 'Photos not included.',
      workspace: input,
    }),
  );
  assert.equal(preview.legacy, true);
  assert.equal(preview.photosIncluded, false);
  assert.deepEqual(preview.workspace, input);
});

test('Backups exported under the previous app name still restore', () => {
  const old = JSON.stringify({
    format: 'vayylo-workspace',
    version: 2,
    exportedAt: new Date().toISOString(),
    photosIncluded: false,
    workspace: newLifeState(),
  });
  const preview = parseWorkspaceBackup(old);
  assert.equal(preview.format, 'valyyu-workspace');
  assert.equal(preview.legacy, false);
});
