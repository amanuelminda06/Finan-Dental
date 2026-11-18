import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedAssetPath } from './seed-asset-path';

describe('seedAssetPath', () => {
  it('resolves starter images to plain paths under public/', () => {
    expect(seedAssetPath('hero.jpg')).toBe(resolve(process.cwd(), 'public', 'hero.jpg'));
    expect(seedAssetPath('doctors/dr-abebe-kebede.png')).toBe(
      resolve(process.cwd(), 'public', 'doctors', 'dr-abebe-kebede.png'),
    );
  });

  it('rejects paths that could escape public/', () => {
    expect(() => seedAssetPath('../.env')).toThrow(/Unsafe seed asset path/);
    expect(() => seedAssetPath('/etc/passwd')).toThrow(/Unsafe seed asset path/);
  });

  it('does not rely on a real WHATWG URL instance', () => {
    const OriginalURL = globalThis.URL;
    class BundlerURL {
      href: string;
      pathname: string;

      constructor(input: string) {
        this.href = input;
        this.pathname = input;
      }
    }
    Object.setPrototypeOf(BundlerURL.prototype, OriginalURL.prototype);
    globalThis.URL = BundlerURL as unknown as typeof URL;

    try {
      // This is the shape Turbopack emits in the production server bundle;
      // node:url rejects it, which is why seed assets cannot use fileURLToPath.
      expect(() => fileURLToPath(new URL('file:///tmp/hero.jpg'))).toThrow();
      expect(seedAssetPath('hero.jpg')).toBe(resolve(process.cwd(), 'public', 'hero.jpg'));
    } finally {
      globalThis.URL = OriginalURL;
    }
  });
});
