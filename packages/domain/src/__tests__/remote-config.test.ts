import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeConfig, type AppConfig } from '../remote-config';

const base: AppConfig = {
  revenueCatIosKey: 'appl_build',
  revenueCatAndroidKey: '',
  entitlement: 'plus',
  privacyUrl: '',
  termsUrl: 'https://eula',
  phoneSignIn: false,
  notice: '',
};

test('server values win, empty server values keep the build value', () => {
  const c = mergeConfig(base, {
    revenueCatIosKey: 'appl_admin',
    revenueCatAndroidKey: '',
    privacyUrl: 'https://valyyu.app/privacy',
    termsUrl: '  ',
    phoneSignIn: true,
    notice: ' Maintenance ce soir ',
  });
  assert.equal(c.revenueCatIosKey, 'appl_admin');
  assert.equal(c.revenueCatAndroidKey, '');
  assert.equal(c.privacyUrl, 'https://valyyu.app/privacy');
  assert.equal(c.termsUrl, 'https://eula');
  assert.equal(c.phoneSignIn, true);
  assert.equal(c.notice, 'Maintenance ce soir');
});
test('no server answer keeps the build config', () => {
  assert.deepEqual(mergeConfig(base, null), base);
});
