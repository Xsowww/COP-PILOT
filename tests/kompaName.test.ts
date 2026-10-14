import { describe, expect, it } from 'vitest';
import { toKompa } from '../src/lib/kompaName';

describe('toKompa', () => {
  it('renames the old app and assistant names', () => {
    expect(toKompa('Bienvenue sur COP-PILOT 👋')).toBe('Bienvenue sur Kompa 👋');
    expect(toKompa('<p>clique sur <strong>Copilot</strong></p>')).toBe('<p>clique sur <strong>Kompa</strong></p>');
  });
  it('leaves links to the site alone', () => {
    expect(toKompa('https://cop-pilot.onrender.com')).toBe('https://cop-pilot.onrender.com');
  });
});
