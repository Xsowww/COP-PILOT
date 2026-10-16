import { describe, expect, it } from 'vitest';
import { normalize } from '../src/lib/utils';

// The Drive index loads the stores, which read the browser globals.
const memory = new Map<string, string>();
const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
Object.assign(globalThis, { location: new URL('http://localhost/'), localStorage: storage, sessionStorage: storage });
const { fold } = await import('../src/lib/textIndex');

describe('search: the apostrophe of phone keyboards', () => {
  it('normalize: ’ and ‘ are a plain apostrophe', () => {
    expect(normalize('L’Apostrophe')).toBe("l'apostrophe");
    expect(normalize("l'apostrophe").includes(normalize('l’apostrophe'))).toBe(true);
    expect(normalize('l’été').includes(normalize("l'ete"))).toBe(true);
  });

  it('fold (Drive contents) keeps the length and folds ’ too', () => {
    expect(fold('L’Été')).toBe("l'ete");
    expect(fold('Aujourd‘hui').length).toBe('Aujourd‘hui'.length);
  });
});
