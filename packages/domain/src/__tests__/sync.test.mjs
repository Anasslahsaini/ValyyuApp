import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeWorkspaces } from '@workspace/life-data';
import { newLifeState } from '../life.ts';
test('Downloading a workspace adds missing records without mutating either copy', () => {
  const local = newLifeState(),
    remote = newLifeState();
  local.pantry.push({ id: 'local', name: 'Rice', quantity: '1 bag' });
  remote.pantry.push({ id: 'remote', name: 'Tomatoes', quantity: '2' });
  const merged = mergeWorkspaces(local, remote);
  assert.equal(merged.pantry.length, 2);
  assert.equal(local.pantry.length, 1);
  assert.equal(remote.pantry.length, 1);
});
test('Conflicting edits are refused without silently replacing device records', () => {
  const local = newLifeState(),
    remote = newLifeState();
  local.groceries.push({ id: 'same', name: 'Milk', quantity: '1', estimatedCost: 2, checked: false });
  remote.groceries.push({ ...local.groceries[0], checked: true });
  assert.throws(() => mergeWorkspaces(local, remote), /Conflicting/);
  assert.equal(local.groceries[0].checked, false);
});
test('Device photo paths and portable cloud photos do not create a false clothing conflict', () => {
  const local = newLifeState(),
    remote = newLifeState();
  local.wardrobe.push({
    id: 'shirt',
    name: 'Shirt',
    category: 'top',
    color: 'Blue',
    imageUri: 'file:///valyyu-wardrobe/photo.jpg',
  });
  remote.wardrobe.push({ ...local.wardrobe[0], imageUri: 'data:image/jpeg;base64,/9j/AA==' });
  const merged = mergeWorkspaces(local, remote);
  assert.equal(merged.wardrobe.length, 1);
  assert.equal(merged.wardrobe[0].imageUri, local.wardrobe[0].imageUri);
});
test('A new phone gets saved account goals, but existing custom device goals are retained', () => {
  const remote = newLifeState();
  remote.settings.proteinTarget = 120;
  assert.equal(mergeWorkspaces(newLifeState(), remote).settings.proteinTarget, 120);
  const local = newLifeState();
  local.settings.proteinTarget = 80;
  assert.equal(mergeWorkspaces(local, remote).settings.proteinTarget, 80);
});
