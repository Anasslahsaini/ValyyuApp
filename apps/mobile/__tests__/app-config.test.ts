import { app } from '@workspace/config';
import config from '../app.config';

describe('app.config', () => {
  it('reads its identity from @workspace/config', () => {
    expect(config.name).toBe(app.name);
    expect(config.slug).toBe(app.slug);
    expect(config.scheme).toBe(app.scheme);
    expect(config.ios?.bundleIdentifier).toBe(app.iosBundleId);
    expect(config.android?.package).toBe(app.androidPackage);
  });

  it('forces light mode', () => {
    expect(config.userInterfaceStyle).toBe('light');
  });
});
